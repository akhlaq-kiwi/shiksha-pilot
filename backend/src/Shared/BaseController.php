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

        // Verify active account status and handle token invalidation if password changed or account inactivated
        if (isset($user['id']) && isset($user['pwd'])) {
            $pdo = $this->tokenService->getPdo();
            $stmt = $pdo->prepare("SELECT id, role, phone, school_id, password, status FROM users WHERE id = :id LIMIT 1");
            $stmt->execute(['id' => $user['id']]);
            $dbUser = $stmt->fetch(\PDO::FETCH_ASSOC);

            if (!$dbUser || substr($dbUser['password'], 0, 10) !== $user['pwd']) {
                throw new UnauthorizedException("Session invalid or password changed. Please login again.");
            }

            $isInactive = ($dbUser['status'] !== 'ACTIVE');
            $userRole = strtoupper((string)($dbUser['role'] ?? ''));
            $schoolId = (int)($dbUser['school_id'] ?? 0);
            $phone = (string)($dbUser['phone'] ?? '');

            // For Teacher/Staff role: check if staff profile in school was marked Inactive or exit_date set
            if (!$isInactive && ($userRole === 'TEACHER' || $userRole === 'STAFF') && $schoolId > 0 && !empty($phone)) {
                $stmtStaff = $pdo->prepare("
                    SELECT status, exit_date FROM staff 
                    WHERE school_id = :sid AND phone = :phone 
                    ORDER BY id DESC LIMIT 1
                ");
                $stmtStaff->execute([':sid' => $schoolId, ':phone' => $phone]);
                $staffRow = $stmtStaff->fetch(\PDO::FETCH_ASSOC);
                if ($staffRow) {
                    $sStatus = strtoupper((string)($staffRow['status'] ?? ''));
                    if ($sStatus !== 'ACTIVE' || !empty($staffRow['exit_date'])) {
                        $isInactive = true;
                    }
                } else {
                    $isInactive = true;
                }
            }

            // For Student/Parent role: check if all matching student profiles were marked Inactive
            if (!$isInactive && ($userRole === 'STUDENT' || $userRole === 'PARENT') && $schoolId > 0 && !empty($phone)) {
                $stmtStu = $pdo->prepare("
                    SELECT COUNT(*) FROM students 
                    WHERE school_id = :sid 
                      AND (parent_phone = :p1 OR father_phone = :p2 OR student_mobile = :p3)
                      AND (status IS NULL OR UPPER(status) = 'ACTIVE')
                      AND exit_date IS NULL
                ");
                $stmtStu->execute([':sid' => $schoolId, ':p1' => $phone, ':p2' => $phone, ':p3' => $phone]);
                $activeStuCount = (int)$stmtStu->fetchColumn();
                if ($activeStuCount === 0) {
                    $isInactive = true;
                }
            }

            if ($isInactive) {
                $stmtOff = $pdo->prepare("UPDATE users SET status = 'INACTIVE' WHERE id = :id");
                $stmtOff->execute([':id' => $dbUser['id']]);
                throw new UnauthorizedException("This account is Inactive");
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
