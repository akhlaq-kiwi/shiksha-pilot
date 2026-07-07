<?php

declare(strict_types=1);

namespace App\Domain\Auth\Services;

use App\Domain\Auth\Repositories\AuthRepository;
use App\Shared\Auth\TokenService;
use App\Shared\BaseService;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;

class AuthService extends BaseService
{
    public function __construct(
        private readonly AuthRepository $repo,
        private readonly TokenService $tokenService,
        ?\Psr\Log\LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    /**
     * Confirm that a user with the given phone number exists.
     *
     * @throws NotFoundException when no account is registered for that phone.
     */
    public function identify(string $phone): bool
    {
        $user = $this->repo->findByPhone($phone);

        if ($user === null) {
            throw new NotFoundException('No account found for the provided phone number.');
        }

        $this->log('Auth identify check', ['phone' => $phone]);

        return true;
    }

    /**
     * Authenticate a user by phone + password and return a token with the user profile.
     *
     * @return array{token: string, user: array<string, mixed>}
     *
     * @throws NotFoundException       when the phone number is not registered.
     * @throws ValidationException     when the password does not match.
     * @throws ForbiddenException      when the account is not in ACTIVE status.
     */
    public function login(string $phone, string $password, ?string $subdomain = null): array
    {
        $user = $this->repo->findByPhone($phone);

        if ($user === null) {
            $this->logAuditDirect(['email' => $phone, 'role' => 'Guest'], 'Security', 'Failed Login Attempt', 'Failed login attempt for unregistered phone number ' . $phone);
            throw new NotFoundException('No account found for the provided phone number.');
        }

        if (!password_verify($password, (string) ($user['password'] ?? ''))) {
            $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Failed login attempt for user "' . ($user['name'] ?? $user['email']) . '" due to incorrect password');
            throw new ValidationException(['password' => 'Invalid credentials.']);
        }

        if (($user['status'] ?? '') !== 'ACTIVE') {
            $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Failed login attempt for inactive account of user "' . ($user['name'] ?? $user['email']) . '"');
            throw new ForbiddenException('Account is not active.');
        }



        $safeUser = array_diff_key($user, ['password' => true]);

        $token = $this->tokenService->encode([
            'id'        => $user['id'],
            'role'      => $user['role'] ?? null,
            'phone'     => $user['phone'] ?? null,
            'school_id' => isset($user['school_id']) ? (int) $user['school_id'] : null,
        ]);

        $this->log('User logged in', ['id' => $user['id']]);
        $this->logAuditDirect($user, 'Security', 'User Logged In', 'User "' . ($user['name'] ?? $user['email']) . '" logged in successfully');

        return [
            'token' => $token,
            'user'  => $safeUser,
        ];
    }

    /**
     * Change authenticated user's password and clear force_password_change flag.
     *
     * @throws ValidationException when the new password is too short.
     */
    public function changePassword(int $userId, string $newPassword): void
    {
        if (strlen($newPassword) < 6) {
            throw new ValidationException(['password' => 'Password must be at least 6 characters.']);
        }

        $this->repo->updatePassword($userId, $newPassword);
        $this->log('Password changed', ['id' => $userId]);

        $userObj = $this->repo->findById($userId);
        if ($userObj) {
            $this->logAuditDirect($userObj, 'Security', 'Password Changed', 'Password changed for user "' . ($userObj['name'] ?? $userObj['email']) . '"');
        }
    }

    private function logAuditDirect(
        array $actorUser,
        string $module,
        string $action,
        string $description
    ): void {
        $pdo = $this->repo->getPdo();
        $actorEmail = $actorUser['phone'] ?? $actorUser['email'] ?? 'system@school.edu';
        $actorName = $actorUser['phone'] ?? $actorUser['name'] ?? $actorEmail;
        $actorRole = $actorUser['role'] ?? 'Unknown';
        $schoolId = isset($actorUser['school_id']) ? (int)$actorUser['school_id'] : null;

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        }
        $device = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Device';
        $deviceStr = $this->parseUserAgent($device);

        $ayName = null;
        if ($schoolId !== null) {
            $stmt = $pdo->prepare("SELECT name FROM academic_years WHERE school_id = :sid AND status = 'ACTIVE' LIMIT 1");
            $stmt->execute([':sid' => $schoolId]);
            $ayName = $stmt->fetchColumn() ?: null;
        }

        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (action, module, description, target_school, user, performed_by, user_role, academic_year, ip_address, device)
            VALUES (:act, :mod, :desc, :sch, :usr, :perf, :role, :ay, :ip, :dev)
        ");
        $stmt->execute([
            ':act' => $action,
            ':mod' => $module,
            ':desc' => $description,
            ':sch' => $schoolId !== null ? (string)$schoolId : null,
            ':usr' => $actorEmail,
            ':perf' => $actorName,
            ':role' => $actorRole,
            ':ay' => $ayName,
            ':ip' => $ip,
            ':dev' => $deviceStr
        ]);
    }

    private function parseUserAgent(string $ua): string
    {
        if (empty($ua)) return 'Unknown';
        $browser = 'Unknown Browser';
        $os = 'Unknown OS';

        if (preg_match('/windows|win32/i', $ua)) {
            $os = 'Windows';
        } elseif (preg_match('/macintosh|mac os x/i', $ua)) {
            $os = 'macOS';
        } elseif (preg_match('/linux/i', $ua)) {
            $os = 'Linux';
        } elseif (preg_match('/iphone|ipad|ipod/i', $ua)) {
            $os = 'iOS';
        } elseif (preg_match('/android/i', $ua)) {
            $os = 'Android';
        }

        if (preg_match('/chrome/i', $ua) && !preg_match('/edge|edg/i', $ua) && !preg_match('/opr/i', $ua)) {
            $browser = 'Chrome';
        } elseif (preg_match('/safari/i', $ua) && !preg_match('/chrome/i', $ua)) {
            $browser = 'Safari';
        } elseif (preg_match('/firefox/i', $ua)) {
            $browser = 'Firefox';
        } elseif (preg_match('/edge|edg/i', $ua)) {
            $browser = 'Edge';
        } elseif (preg_match('/opr/i', $ua)) {
            $browser = 'Opera';
        }

        return "$browser ($os)";
    }
}
