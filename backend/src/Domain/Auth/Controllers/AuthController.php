<?php

declare(strict_types=1);

namespace App\Domain\Auth\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Database\Connection;
use PDO;

class AuthController
{
    public function __construct(private Connection $db) {}

    public function identify(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $phone = $body['phone'] ?? null;

        if (!$phone) {
            $response->getBody()->write(json_encode(['error' => 'Phone number is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("SELECT id FROM users WHERE phone = :phone LIMIT 1");
        $stmt->execute(['phone' => $phone]);
        $user = $stmt->fetch();

        if (!$user) {
            $response->getBody()->write(json_encode(['error' => 'Phone number not recognized in system']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $response->getBody()->write(json_encode([
            'status' => 'success',
            'message' => 'Phone identified'
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function login(Request $request, Response $response): Response
    {
        $body = $request->getParsedBody();
        $phone = $body['phone'] ?? null;
        $password = $body['password'] ?? null;

        if (!$phone || !$password) {
            $response->getBody()->write(json_encode(['error' => 'Phone and password are required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("SELECT * FROM users WHERE phone = :phone LIMIT 1");
        $stmt->execute([
            'phone' => $phone
        ]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            $response->getBody()->write(json_encode(['error' => 'Invalid phone or password credentials']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        if ($user['status'] !== 'ACTIVE') {
            $response->getBody()->write(json_encode(['error' => 'Account is inactive. Please contact system admin.']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(403);
        }

        // Generate a token. In a real system, this would be a JWT or session token.
        $token = base64_encode(json_encode([
            'user_id' => $user['id'],
            'role' => $user['role'],
            'exp' => time() + 3600 * 24 // 24 hours
        ]));

        $response->getBody()->write(json_encode([
            'token' => $token,
            'user' => [
                'id' => $user['id'],
                'phone' => $user['phone'],
                'role' => $user['role'],
                'name' => $user['name'],
                'status' => $user['status']
            ]
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
