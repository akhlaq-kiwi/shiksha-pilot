<?php

namespace App\Shared;

use Psr\Http\Message\ResponseInterface as Response;

abstract class BaseController
{
    protected function success(Response $response, mixed $data, int $status = 200): Response
    {
        $payload = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        $response->getBody()->write($payload);
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    protected function error(Response $response, string $message, int $status = 400): Response
    {
        $payload = json_encode(['error' => $message], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        $response->getBody()->write($payload);
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }

    protected function getJsonData(\Psr\Http\Message\ServerRequestInterface $request): array
    {
        $parsed = $request->getParsedBody();
        if (is_array($parsed)) {
            return $parsed;
        }
        try {
            $body = $request->getBody();
            $body->rewind();
            $contents = $body->getContents();
            return json_decode($contents, true) ?: [];
        } catch (\Exception $e) {
            return [];
        }
    }
}
