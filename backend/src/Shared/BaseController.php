<?php

declare(strict_types=1);

namespace App\Shared;

use App\Shared\Auth\TokenService;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\UnauthorizedException;
use App\Shared\Http\ResponseFormatter;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

abstract class BaseController
{
    public function __construct(protected TokenService $tokenService) {}

    // -------------------------------------------------------------------------
    // Auth helpers
    // -------------------------------------------------------------------------

    /**
     * Decode and return the authenticated user payload from the Bearer token.
     *
     * @throws UnauthorizedException when no valid token is present.
     */
    protected function authenticate(Request $request): array
    {
        $user = $this->tokenService->fromRequest($request);

        if ($user === null) {
            throw new UnauthorizedException();
        }

        // Verify active account status and handle token invalidation if password changed
        if (isset($user['id']) && isset($user['pwd'])) {
            $pdo = $this->tokenService->getPdo();
            $stmt = $pdo->prepare("SELECT password, status FROM users WHERE id = :id LIMIT 1");
            $stmt->execute(['id' => $user['id']]);
            $dbUser = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$dbUser || $dbUser['status'] !== 'ACTIVE' || substr($dbUser['password'], 0, 10) !== $user['pwd']) {
                throw new UnauthorizedException("Session invalid or password changed. Please login again.");
            }
        }

        return $user;
    }

    /**
     * Assert the authenticated user holds one of the required roles.
     *
     * @param string|string[] $roles  A single role name or a list of accepted roles.
     * @throws ForbiddenException when the user's role is not in the allowed set.
     */
    protected function requireRole(array $user, string|array $roles): void
    {
        $allowed  = is_array($roles) ? $roles : [$roles];
        $userRole = (string) ($user['role'] ?? '');

        if (!in_array($userRole, $allowed, true)) {
            throw new ForbiddenException();
        }
    }

    // -------------------------------------------------------------------------
    // Response shortcuts
    // -------------------------------------------------------------------------

    protected function success(
        Response $response,
        mixed $data = null,
        string $message = 'Success',
        int $code = 200,
    ): Response {
        return ResponseFormatter::success($response, $data, $message, $code);
    }

    protected function error(
        Response $response,
        string $message,
        int $code = 400,
        mixed $errors = null,
    ): Response {
        return ResponseFormatter::error($response, $message, $code, $errors);
    }
}
