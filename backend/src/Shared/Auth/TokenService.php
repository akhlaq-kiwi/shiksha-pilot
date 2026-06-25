<?php

declare(strict_types=1);

namespace App\Shared\Auth;

use Psr\Http\Message\ServerRequestInterface as Request;

class TokenService
{
    private const TOKEN_TTL = 86400; // 24 hours in seconds

    /**
     * Encode a payload into a base64 token.
     * Appends an 'exp' claim set 24 hours from now.
     */
    public function encode(array $payload): string
    {
        $payload['exp'] = time() + self::TOKEN_TTL;

        return base64_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    }

    /**
     * Decode a base64 token back to its payload array.
     * Returns null when the token is malformed or has expired.
     */
    public function decode(string $token): ?array
    {
        if ($token === '') {
            return null;
        }

        $json = base64_decode($token, strict: true);

        if ($json === false) {
            return null;
        }

        $payload = json_decode($json, true);

        if (!is_array($payload)) {
            return null;
        }

        // Validate expiry claim.
        if (!isset($payload['exp']) || !is_int($payload['exp'])) {
            return null;
        }

        if (time() > $payload['exp']) {
            return null; // Token has expired.
        }

        return $payload;
    }

    /**
     * Extract and decode the Bearer token from the Authorization header.
     * Returns null when the header is absent, malformed, or the token is invalid.
     */
    public function fromRequest(Request $request): ?array
    {
        $header = $request->getHeaderLine('Authorization');

        if ($header === '') {
            return null;
        }

        if (!str_starts_with($header, 'Bearer ')) {
            return null;
        }

        $token = trim(substr($header, 7));

        if ($token === '') {
            return null;
        }

        return $this->decode($token);
    }
}
