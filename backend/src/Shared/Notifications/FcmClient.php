<?php

declare(strict_types=1);

namespace App\Shared\Notifications;

use PDO;
use RuntimeException;

/**
 * Firebase Cloud Messaging (HTTP v1) client, hand-rolled on cURL + openssl.
 *
 * Deliberately has no composer dependency. The obvious choice would be
 * kreait/firebase-php, but it pulls in Guzzle, guzzle promises, PSR bridges
 * and a dozen transitive packages for what amounts to "sign a JWT and POST
 * some JSON" — and this runs on shared hosting where vendor/ size and
 * per-request autoload cost are real constraints. openssl_sign gives us
 * RS256 directly, so the whole client is one file.
 *
 * Two cost controls matter on cheap hosting:
 *   1. The OAuth access token is cached in the DB for its full hour rather
 *      than minted per send. Minting costs an RS256 signature plus a TLS
 *      round trip to oauth2.googleapis.com; doing that on every notification
 *      would roughly double the latency of every write that notifies.
 *   2. Broadcasts go to a topic — one HTTP request reaches every subscribed
 *      device. FCM v1 has no multicast, so the alternative is one request per
 *      token, i.e. 500 requests for a 500-parent school. See PushDispatcher
 *      for which events use which path and why.
 */
final class FcmClient
{
    private const OAUTH_URL   = 'https://oauth2.googleapis.com/token';
    private const SCOPE       = 'https://www.googleapis.com/auth/firebase.messaging';
    private const TOKEN_SKEW  = 60;   // refresh a minute early, clock drift guard
    private const HTTP_TIMEOUT = 6;   // seconds; a slow FCM must not stall a request

    public function __construct(private PDO $pdo) {}

    /**
     * True when Firebase is configured. Every send path checks this first so
     * the whole feature degrades to "DB notification only" on an install that
     * has not set up Firebase yet — which is the local/dev default.
     */
    public function isConfigured(): bool
    {
        return $this->serviceAccount() !== null;
    }

    /**
     * Send to a single device token.
     *
     * @return string '' on success, otherwise the FCM error status
     *                (UNREGISTERED / INVALID_ARGUMENT / ...). The caller uses
     *                that to deactivate dead tokens.
     */
    public function sendToToken(string $token, array $notification, array $data, string $priority = 'high'): string
    {
        return $this->send(['token' => $token], $notification, $data, $priority);
    }

    /** Send to a topic. Returns '' on success, else the FCM error status. */
    public function sendToTopic(string $topic, array $notification, array $data, string $priority = 'high'): string
    {
        return $this->send(['topic' => $topic], $notification, $data, $priority);
    }

    private function send(array $target, array $notification, array $data, string $priority): string
    {
        $sa = $this->serviceAccount();
        if ($sa === null) {
            return 'NOT_CONFIGURED';
        }

        $accessToken = $this->accessToken($sa);
        if ($accessToken === null) {
            return 'OAUTH_FAILED';
        }

        // FCM requires every data value to be a string.
        $stringData = [];
        foreach ($data as $k => $v) {
            $stringData[(string) $k] = $v === null ? '' : (string) $v;
        }

        $message = $target + [
            'notification' => $notification,
            'data'         => $stringData,
            'android'      => [
                'priority'     => $priority === 'high' ? 'HIGH' : 'NORMAL',
                'notification' => [
                    // Channel must match the one created in the Flutter app,
                    // or Android 8+ silently drops the notification's sound
                    // and importance settings.
                    'channel_id'   => $stringData['category'] ?? 'SYSTEM',
                    'sound'        => 'default',
                    'default_vibrate_timings' => true,
                ],
            ],
        ];

        [$status, $body] = $this->httpPost(
            "https://fcm.googleapis.com/v1/projects/{$sa['project_id']}/messages:send",
            json_encode(['message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ['Authorization: Bearer ' . $accessToken, 'Content-Type: application/json']
        );

        if ($status === 200) {
            return '';
        }

        $decoded = json_decode((string) $body, true);
        $reason  = $decoded['error']['details'][0]['errorCode']
            ?? $decoded['error']['status']
            ?? "HTTP_{$status}";

        return (string) $reason;
    }

    // ------------------------------------------------------------------
    // OAuth
    // ------------------------------------------------------------------

    private function accessToken(array $sa): ?string
    {
        $now = time();

        $stmt = $this->pdo->query("SELECT access_token, expires_at FROM push_oauth_cache WHERE id = 1");
        $row  = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && (int) $row['expires_at'] > $now + self::TOKEN_SKEW) {
            return (string) $row['access_token'];
        }

        $jwt = $this->signedJwt($sa, $now);
        if ($jwt === null) {
            return null;
        }

        [$status, $body] = $this->httpPost(
            self::OAUTH_URL,
            http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion'  => $jwt,
            ]),
            ['Content-Type: application/x-www-form-urlencoded']
        );

        if ($status !== 200) {
            return null;
        }

        $decoded = json_decode((string) $body, true);
        $token   = $decoded['access_token'] ?? null;
        if (!is_string($token) || $token === '') {
            return null;
        }
        $expiresAt = $now + (int) ($decoded['expires_in'] ?? 3600);

        $upsert = $this->pdo->prepare("
            INSERT INTO push_oauth_cache (id, access_token, expires_at)
            VALUES (1, :tok, :exp)
            ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), expires_at = VALUES(expires_at)
        ");
        $upsert->execute([':tok' => $token, ':exp' => $expiresAt]);

        return $token;
    }

    private function signedJwt(array $sa, int $now): ?string
    {
        $header  = ['alg' => 'RS256', 'typ' => 'JWT'];
        $claims  = [
            'iss'   => $sa['client_email'],
            'scope' => self::SCOPE,
            'aud'   => self::OAUTH_URL,
            'iat'   => $now,
            'exp'   => $now + 3600,
        ];

        $input = $this->base64Url(json_encode($header)) . '.' . $this->base64Url(json_encode($claims));

        $key = openssl_pkey_get_private($sa['private_key']);
        if ($key === false) {
            return null;
        }

        $signature = '';
        if (!openssl_sign($input, $signature, $key, OPENSSL_ALGO_SHA256)) {
            return null;
        }

        return $input . '.' . $this->base64Url($signature);
    }

    private function base64Url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    // ------------------------------------------------------------------
    // Service account
    // ------------------------------------------------------------------

    /**
     * Resolved once per request.
     *
     * Only three of the ten fields in Google's service-account JSON are ever
     * used, so they are configured as three discrete env vars rather than by
     * shipping the whole file. That keeps the credential in the same place as
     * every other secret this app has (SMTP, DB, JWT), keeps the deploy
     * workflow writing one flat .env from GitHub Secrets, and avoids having to
     * place a file outside the web root on shared hosting — where you often
     * can't.
     *
     *   FIREBASE_PROJECT_ID
     *   FIREBASE_CLIENT_EMAIL
     *   FIREBASE_PRIVATE_KEY   (one line, with \n escapes — see below)
     */
    private ?array $cachedSa = null;
    private bool $saResolved = false;

    private function serviceAccount(): ?array
    {
        if ($this->saResolved) {
            return $this->cachedSa;
        }
        $this->saResolved = true;

        // Option 1: Full JSON string or base64-encoded JSON string in env var
        $jsonEnv = getenv('FIREBASE_SERVICE_ACCOUNT_JSON') ?: getenv('FIREBASE_SERVICE_ACCOUNT') ?: getenv('FIREBASE_CREDENTIALS_JSON') ?: '';
        if ($jsonEnv !== '') {
            $rawJson = trim($jsonEnv);
            // If base64-encoded, decode it first
            if (!str_starts_with($rawJson, '{') && base64_decode($rawJson, true) !== false) {
                $rawJson = (string) base64_decode($rawJson, true);
            }
            $decoded = json_decode($rawJson, true);
            if (
                is_array($decoded) &&
                !empty($decoded['project_id']) &&
                !empty($decoded['client_email']) &&
                !empty($decoded['private_key'])
            ) {
                $privateKey = str_replace('\n', "\n", (string) $decoded['private_key']);
                if (str_contains($privateKey, 'BEGIN PRIVATE KEY')) {
                    $this->cachedSa = [
                        'project_id'   => (string) $decoded['project_id'],
                        'client_email' => (string) $decoded['client_email'],
                        'private_key'  => $privateKey,
                    ];
                    return $this->cachedSa;
                }
            }
        }

        // Option 2: Check for JSON service account file (explicit path or standard locations)
        $pathCandidates = array_filter([
            getenv('FIREBASE_CREDENTIALS_PATH') ?: null,
            dirname(__DIR__, 3) . '/config/firebase-service-account.json',
            dirname(__DIR__, 3) . '/firebase-service-account.json',
        ]);

        foreach ($pathCandidates as $filePath) {
            if (is_file($filePath) && is_readable($filePath)) {
                $jsonContent = file_get_contents($filePath);
                $decoded     = json_decode((string) $jsonContent, true);
                if (
                    is_array($decoded) &&
                    !empty($decoded['project_id']) &&
                    !empty($decoded['client_email']) &&
                    !empty($decoded['private_key'])
                ) {
                    $privateKey = str_replace('\n', "\n", (string) $decoded['private_key']);
                    if (str_contains($privateKey, 'BEGIN PRIVATE KEY')) {
                        $this->cachedSa = [
                            'project_id'   => (string) $decoded['project_id'],
                            'client_email' => (string) $decoded['client_email'],
                            'private_key'  => $privateKey,
                        ];
                        return $this->cachedSa;
                    }
                }
            }
        }

        // Option 3: Fallback to discrete env vars
        $projectId   = getenv('FIREBASE_PROJECT_ID') ?: '';
        $clientEmail = getenv('FIREBASE_CLIENT_EMAIL') ?: '';
        $privateKey  = getenv('FIREBASE_PRIVATE_KEY') ?: '';

        if ($projectId === '' || $clientEmail === '' || $privateKey === '') {
            return null;
        }

        $privateKey = str_replace('\n', "\n", $privateKey);

        if (!str_contains($privateKey, 'BEGIN PRIVATE KEY')) {
            error_log('[push] FIREBASE_PRIVATE_KEY does not look like a PEM private key.');
            return null;
        }

        $this->cachedSa = [
            'project_id'   => $projectId,
            'client_email' => $clientEmail,
            'private_key'  => $privateKey,
        ];

        return $this->cachedSa;
    }

    // ------------------------------------------------------------------

    /** @return array{0:int,1:string|false} [httpStatus, body] */
    private function httpPost(string $url, string $payload, array $headers): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::HTTP_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => 3,
        ]);
        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return [$status, $body];
    }
}
