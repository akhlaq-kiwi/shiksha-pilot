<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Psr\Http\Message\ResponseInterface as Response;

class ResponseFormatter
{
    public static function success(
        Response $response,
        mixed $data = null,
        string $message = 'Success',
        int $statusCode = 200,
    ): Response {
        $body = [
            'status'  => 'success',
            'message' => $message,
            'data'    => $data,
        ];

        return self::write($response, $body, $statusCode);
    }

    public static function error(
        Response $response,
        string $message,
        int $statusCode = 400,
        mixed $errors = null,
    ): Response {
        $body = [
            'status'  => 'error',
            'message' => $message,
            'data'    => $errors !== null ? ['errors' => $errors] : null,
        ];

        return self::write($response, $body, $statusCode);
    }

    public static function paginated(
        Response $response,
        array $items,
        int $total,
        int $page,
        int $perPage,
        string $message = 'Success',
    ): Response {
        $totalPages = $perPage > 0 ? (int) ceil($total / $perPage) : 1;

        $body = [
            'status'  => 'success',
            'message' => $message,
            'data'    => [
                'items'       => $items,
                'total'       => $total,
                'page'        => $page,
                'per_page'    => $perPage,
                'total_pages' => $totalPages,
            ],
        ];

        return self::write($response, $body, 200);
    }

    private static function write(Response $response, array $body, int $statusCode): Response
    {
        $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response->getBody()->write($json);

        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($statusCode);
    }
}
