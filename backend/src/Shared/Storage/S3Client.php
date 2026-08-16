<?php

declare(strict_types=1);

namespace App\Shared\Storage;

/**
 * Minimal AWS S3 client speaking Signature Version 4 over cURL.
 *
 * We deliberately avoid pulling in aws/aws-sdk-php: `vendor/` is an anonymous
 * Docker volume, so a new Composer dependency would require rebuilding the
 * backend image on every environment. Only the handful of operations this
 * application needs are implemented — PUT, GET, DELETE and HEAD of a single
 * object.
 */
class S3Client
{
    /** Total tries for one operation, including the first. */
    private const MAX_ATTEMPTS = 3;

    private string $accessKey;
    private string $secretKey;
    private string $region;
    private string $bucket;
    private string $endpoint;

    public function __construct(
        string $accessKey,
        string $secretKey,
        string $region,
        string $bucket,
        string $endpoint = ''
    ) {
        $this->accessKey = $accessKey;
        $this->secretKey = $secretKey;
        $this->region    = $region;
        $this->bucket    = $bucket;
        // Virtual-hosted-style endpoint, e.g. https://my-bucket.s3.ap-south-1.amazonaws.com
        $this->endpoint  = rtrim($endpoint, '/') ?: sprintf(
            'https://%s.s3.%s.amazonaws.com',
            $bucket,
            $region
        );
    }

    public function isConfigured(): bool
    {
        return $this->accessKey !== '' && $this->secretKey !== '' && $this->bucket !== '';
    }

    public function getObjectUrl(string $key): string
    {
        return $this->endpoint . '/' . $this->encodeKey($key);
    }

    /**
     * Upload a string payload. Returns the public object URL.
     *
     * @throws StorageException
     */
    public function putObject(string $key, string $body, string $contentType = 'application/octet-stream'): string
    {
        $this->request('PUT', $key, $body, [
            'content-type' => $contentType,
            // Objects are served straight to browsers and the mobile app, and
            // are immutable (every key is random), so cache them hard.
            'cache-control' => 'public, max-age=31536000, immutable',
        ]);

        return $this->getObjectUrl($key);
    }

    /**
     * Upload a file from the local filesystem by streaming it into memory.
     * Upload limits in this application top out at 25MB, so this is safe.
     *
     * @throws StorageException
     */
    public function putFile(string $key, string $sourcePath, string $contentType = 'application/octet-stream'): string
    {
        $body = @file_get_contents($sourcePath);
        if ($body === false) {
            throw new StorageException('Unable to read the uploaded file from disk.');
        }

        return $this->putObject($key, $body, $contentType);
    }

    /** Returns the object body, or null when it does not exist. */
    public function getObject(string $key): ?string
    {
        try {
            return $this->request('GET', $key);
        } catch (StorageException $e) {
            return null;
        }
    }

    public function doesObjectExist(string $key): bool
    {
        try {
            $this->request('HEAD', $key);
            return true;
        } catch (StorageException $e) {
            return false;
        }
    }

    public function deleteObject(string $key): bool
    {
        try {
            $this->request('DELETE', $key);
            return true;
        } catch (StorageException $e) {
            return false;
        }
    }

    /**
     * Build a time-limited presigned GET URL. Used when the bucket is private,
     * so the browser/app can fetch the object directly without credentials.
     */
    public function presignedUrl(string $key, int $expiresInSeconds = 3600): string
    {
        $now       = time();
        $amzDate   = gmdate('Ymd\THis\Z', $now);
        $dateStamp = gmdate('Ymd', $now);
        $host      = parse_url($this->endpoint, PHP_URL_HOST) ?: '';
        $scope     = "{$dateStamp}/{$this->region}/s3/aws4_request";

        $query = [
            'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential'    => "{$this->accessKey}/{$scope}",
            'X-Amz-Date'          => $amzDate,
            'X-Amz-Expires'       => (string)$expiresInSeconds,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort($query);

        $canonicalQuery = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $canonicalUri   = '/' . $this->encodeKey($key);

        $canonicalRequest = implode("\n", [
            'GET',
            $canonicalUri,
            $canonicalQuery,
            "host:{$host}\n",
            'host',
            'UNSIGNED-PAYLOAD',
        ]);

        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256',
            $amzDate,
            $scope,
            hash('sha256', $canonicalRequest),
        ]);

        $signature = hash_hmac('sha256', $stringToSign, $this->signingKey($dateStamp));

        return $this->endpoint . $canonicalUri . '?' . $canonicalQuery . '&X-Amz-Signature=' . $signature;
    }

    // -------------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------------

    /**
     * Sign and perform a single-object request.
     *
     * @param array<string,string> $extraHeaders
     * @throws StorageException on any non-2xx response or transport failure.
     */
    private function request(string $method, string $key, string $body = '', array $extraHeaders = []): string
    {
        if (!$this->isConfigured()) {
            throw new StorageException('S3 storage is not configured. Check AWS_* environment variables.');
        }

        $now          = time();
        $amzDate      = gmdate('Ymd\THis\Z', $now);
        $dateStamp    = gmdate('Ymd', $now);
        $host         = parse_url($this->endpoint, PHP_URL_HOST) ?: '';
        $payloadHash  = hash('sha256', $body);
        $canonicalUri = '/' . $this->encodeKey($key);

        // Header names must be lower-cased and sorted for the canonical request.
        $headers = array_change_key_case($extraHeaders, CASE_LOWER);
        $headers['host']                 = $host;
        $headers['x-amz-content-sha256'] = $payloadHash;
        $headers['x-amz-date']           = $amzDate;
        ksort($headers);

        $canonicalHeaders = '';
        foreach ($headers as $name => $value) {
            $canonicalHeaders .= $name . ':' . trim($value) . "\n";
        }
        $signedHeaders = implode(';', array_keys($headers));

        $canonicalRequest = implode("\n", [
            $method,
            $canonicalUri,
            '',
            $canonicalHeaders,
            $signedHeaders,
            $payloadHash,
        ]);

        $scope        = "{$dateStamp}/{$this->region}/s3/aws4_request";
        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256',
            $amzDate,
            $scope,
            hash('sha256', $canonicalRequest),
        ]);

        $signature = hash_hmac('sha256', $stringToSign, $this->signingKey($dateStamp));

        $authorization = sprintf(
            'AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s',
            $this->accessKey,
            $scope,
            $signedHeaders,
            $signature
        );

        $curlHeaders = ['Authorization: ' . $authorization];
        foreach ($headers as $name => $value) {
            if ($name === 'host') {
                continue; // cURL sets Host itself.
            }
            $curlHeaders[] = $name . ': ' . $value;
        }

        // Every operation here targets a unique key and is idempotent, so a
        // transport failure or 5xx can safely be retried. Without this a single
        // dropped connection surfaces to the user as a failed upload.
        $attempts = 0;
        $result   = false;
        $status   = 0;
        $error    = '';

        while (true) {
            $attempts++;

            $ch = curl_init($this->endpoint . $canonicalUri);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST  => $method,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER     => $curlHeaders,
                CURLOPT_TIMEOUT        => 60,
                CURLOPT_CONNECTTIMEOUT => 15,
            ]);
            if ($method === 'PUT') {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
            if ($method === 'HEAD') {
                curl_setopt($ch, CURLOPT_NOBODY, true);
            }

            $result = curl_exec($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error  = curl_error($ch);
            curl_close($ch);

            $retryable = ($result === false || $status >= 500 || $status === 429);
            if (!$retryable || $attempts >= self::MAX_ATTEMPTS) {
                break;
            }

            usleep(200000 * $attempts); // 0.2s, then 0.4s
        }

        if ($result === false) {
            throw new StorageException(sprintf(
                'S3 request failed after %d attempt(s): %s',
                $attempts,
                $error ?: 'unknown transport error'
            ));
        }

        if ($status < 200 || $status >= 300) {
            throw new StorageException(sprintf(
                'S3 %s on "%s" returned HTTP %d: %s',
                $method,
                $key,
                $status,
                $this->extractS3Error((string)$result)
            ));
        }

        return (string)$result;
    }

    private function signingKey(string $dateStamp): string
    {
        $kDate    = hash_hmac('sha256', $dateStamp, 'AWS4' . $this->secretKey, true);
        $kRegion  = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);

        return hash_hmac('sha256', 'aws4_request', $kService, true);
    }

    /** Percent-encode each path segment, leaving the separating slashes intact. */
    private function encodeKey(string $key): string
    {
        $segments = explode('/', ltrim($key, '/'));

        return implode('/', array_map('rawurlencode', $segments));
    }

    /** Pull the <Message> out of an S3 XML error body for readable logs. */
    private function extractS3Error(string $xml): string
    {
        if ($xml === '') {
            return 'empty response body';
        }
        if (preg_match('#<Message>(.*?)</Message>#s', $xml, $m) === 1) {
            return trim($m[1]);
        }

        return substr(trim($xml), 0, 300);
    }
}
