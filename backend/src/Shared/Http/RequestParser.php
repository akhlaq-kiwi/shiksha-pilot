<?php

declare(strict_types=1);

namespace App\Shared\Http;

use App\Shared\Exceptions\ValidationException;
use Psr\Http\Message\ServerRequestInterface as Request;

class RequestParser
{
    /**
     * Parse the request body as an array.
     * Handles both JSON payloads and URL-encoded / multipart form data.
     * Never returns null.
     */
    public static function body(Request $request): array
    {
        // Slim/PSR-7 already parses form data into getParsedBody().
        $parsed = $request->getParsedBody();

        if (is_array($parsed) && count($parsed) > 0) {
            return $parsed;
        }

        // Attempt to decode a raw JSON body.
        $raw = (string) $request->getBody();

        if ($raw !== '') {
            $decoded = json_decode($raw, true);

            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
    }

    /**
     * Return query-string parameters as an array.
     */
    public static function query(Request $request): array
    {
        $params = $request->getQueryParams();

        return is_array($params) ? $params : [];
    }

    /**
     * Assert that all listed fields are present and non-empty in $data.
     * Throws ValidationException listing every missing field at once.
     *
     * @param  string[] $fields
     * @throws ValidationException
     */
    public static function required(array $data, array $fields): void
    {
        $errors = [];

        foreach ($fields as $field) {
            $value = $data[$field] ?? null;

            if ($value === null || $value === '') {
                $errors[$field] = "The {$field} field is required.";
            }
        }

        if (count($errors) > 0) {
            throw ValidationException::fromErrors($errors);
        }
    }

    /**
     * Return a field value when present, or $default when absent / empty.
     */
    public static function optional(array $data, string $field, mixed $default = null): mixed
    {
        $value = $data[$field] ?? $default;

        // Treat empty string the same as absent so callers get the default.
        if ($value === '') {
            return $default;
        }

        return $value;
    }
}
