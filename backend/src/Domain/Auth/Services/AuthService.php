<?php

declare(strict_types=1);

namespace App\Domain\Auth\Services;

use App\Domain\Auth\Repositories\AuthRepository;
use App\Shared\Auth\TokenService;
use App\Shared\BaseService;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Notifications\NotificationCatalog;
use App\Shared\Notifications\PushDispatcher;

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
    public function login(string $phone, string $password, ?string $subdomain = null, ?string $clientType = null): array
    {
        $user = $this->repo->findByPhone($phone);

        if ($user === null) {
            $this->logAuditDirect(['email' => $phone, 'role' => 'Guest'], 'Security', 'Failed Login Attempt', 'Failed login attempt for unregistered phone number ' . $phone);
            throw new \App\Shared\Exceptions\ValidationException(
                ['phone' => 'No account found with this mobile number.'],
                'No account found with this mobile number.'
            );
        }

        if (!password_verify($password, (string) ($user['password'] ?? ''))) {
            $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Failed login attempt for user "' . ($user['name'] ?? $user['email']) . '"');
            throw new \App\Shared\Exceptions\ValidationException(
                ['password' => 'Incorrect password. Please try again.'],
                'Incorrect password. Please try again.'
            );
        }

        $role = strtoupper($user['role'] ?? '');
        $schoolId = isset($user['school_id']) ? (int)$user['school_id'] : 0;
        $pdo = $this->repo->getPdo();

        $isInactive = (($user['status'] ?? '') !== 'ACTIVE');

        if ($schoolId > 0 && ($user['school_status'] ?? '') !== 'ACTIVE') {
            $isInactive = true;
        }

        // For Teacher/Staff role: check if staff profile in school is inactive or exit_date set
        if (!$isInactive && ($role === 'TEACHER' || $role === 'STAFF') && $schoolId > 0) {
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

        // For Student/Parent role: check if all matching student profiles are inactive
        if (!$isInactive && ($role === 'STUDENT' || $role === 'PARENT') && $schoolId > 0) {
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
            $stmtOff->execute([':id' => $user['id']]);

            $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Failed login attempt for inactive user "' . ($user['name'] ?? $user['email']) . '"');
            throw new \App\Shared\Exceptions\ValidationException(
                ['phone' => 'This account is Inactive'],
                'This account is Inactive'
            );
        }



        // Apply Login Matrix restrictions based on clientType
        $role = strtoupper($user['role'] ?? '');
        if ($clientType === 'web') {
            // Temporarily bypass for local browser-agent screenshot capture
            /*
            if ($role === 'STUDENT' || $role === 'PARENT') {
                $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Web login blocked: Student/Parent cannot log in to web portal');
                throw new \App\Shared\Exceptions\ValidationException(['phone' => 'Invalid Credentials']);
            }
            */
            if ($role === 'TEACHER') {
                $pdo = $this->repo->getPdo();
                $stmtAllowedCheck = $pdo->prepare("
                    SELECT 1 
                    FROM staff s 
                    WHERE s.phone = :phone AND s.school_id = :school_id
                      AND EXISTS (SELECT 1 FROM teacher_menu_permissions tmp WHERE tmp.teacher_id = s.id)
                    LIMIT 1
                ");
                $stmtAllowedCheck->execute([
                    ':phone' => $user['phone'],
                    ':school_id' => $user['school_id']
                ]);
                $isAllowed = (bool)$stmtAllowedCheck->fetchColumn();
                if (!$isAllowed) {
                    $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Web login blocked: Teacher has no portal menu permissions');
                    throw new \App\Shared\Exceptions\ValidationException(['phone' => 'Invalid Credentials'], 'Invalid Credentials');
                }
            }
        } else {
            // Mobile app login (anything not explicitly marked as web client type)
            if ($role === 'SUPER_ADMIN') {
                $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Mobile login blocked: Super admin cannot log in to mobile app');
                throw new \App\Shared\Exceptions\ValidationException(['phone' => 'Invalid Credentials']);
            }
        }

        $safeUser = array_diff_key($user, ['password' => true]);

        $token = $this->tokenService->encode([
            'id'        => $user['id'],
            'role'      => $user['role'] ?? null,
            'phone'     => $user['phone'] ?? null,
            'email'     => $user['email'] ?? null,
            'school_id' => isset($user['school_id']) ? (int) $user['school_id'] : null,
            'pwd'       => isset($user['password']) ? substr($user['password'], 0, 10) : '',
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
    public function changePassword(int $userId, ?string $currentPassword, string $newPassword, string $role): void
    {
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new \App\Shared\Exceptions\NotFoundException('User not found.');
        }

        // Strictly verify current password for mobile roles
        if ($currentPassword !== null || in_array($role, ['TEACHER', 'STUDENT', 'PARENT', 'SCHOOL_ADMIN'], true)) {
            if ($currentPassword === null || trim((string)$currentPassword) === '') {
                throw new \App\Shared\Exceptions\ValidationException(['current_password' => 'Current password is required.']);
            }
            if (!password_verify($currentPassword, (string) ($user['password'] ?? ''))) {
                throw new \App\Shared\Exceptions\ValidationException(['current_password' => 'Current password is incorrect.'], 'Current password is incorrect.');
            }
        }

        if (empty(trim($newPassword))) {
            throw new \App\Shared\Exceptions\ValidationException(['new_password' => 'New password is required.']);
        }

        if ($currentPassword !== null && password_verify($newPassword, (string) ($user['password'] ?? ''))) {
            throw new \App\Shared\Exceptions\ValidationException(['new_password' => 'New password must be different from current password.']);
        }

        if (strlen($newPassword) < 6) {
            throw new \App\Shared\Exceptions\ValidationException(['new_password' => 'New password must be at least 6 characters.']);
        }

        $this->repo->updatePassword($userId, $newPassword);
        $this->log('Password changed', ['id' => $userId]);

        $this->logAuditDirect($user, 'Security', 'Password Changed', 'Password changed for user "' . ($user['name'] ?? $user['email']) . '"');
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

    public function getProfile(int $id): array
    {
        $user = $this->repo->findById($id);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $profile = array_diff_key($user, ['password' => true]);

        if ($user['role'] === 'TEACHER') {
            $stmt = $this->repo->getPdo()->prepare("
                SELECT department, employee_id, photo_path FROM staff 
                WHERE phone = :phone AND school_id = :sid AND status = 'ACTIVE'
                LIMIT 1
            ");
            $stmt->execute([':phone' => $user['phone'], ':sid' => $user['school_id']]);
            $staff = $stmt->fetch(\PDO::FETCH_ASSOC);
            if ($staff) {
                $profile['department'] = $staff['department'] ?? null;
                $profile['employee_id'] = $staff['employee_id'] ?? null;
                $profile['photo_path'] = $staff['photo_path'] ?? null;
            }
        }

        return $profile;
    }

    // ---------------------------------------------------------------------
    // Account deletion requests (PF-04)
    // ---------------------------------------------------------------------

    /**
     * Current deletion state for a user, shaped for the app's settings screen.
     */
    public function getDeletionRequest(int $userId): ?array
    {
        return $this->repo->findLatestDeletionRequest($userId);
    }

    /**
     * File a deletion request.
     *
     * Deliberately idempotent: tapping the button twice returns the existing
     * pending request rather than queuing a second one for the school admin to
     * wade through.
     *
     * @throws ValidationException when the account cannot be found.
     */
    public function requestDeletion(int $userId, ?string $reason): array
    {
        $existing = $this->repo->findPendingDeletionRequest($userId);
        if ($existing !== null) {
            return ['id' => (int)$existing['id'], 'status' => 'PENDING', 'already_pending' => true];
        }

        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new ValidationException(['account' => 'Account not found.']);
        }

        $id = $this->repo->createDeletionRequest($user, $reason);

        $this->notifyAdminsOfDeletionRequest($user);

        return ['id' => $id, 'status' => 'PENDING', 'already_pending' => false];
    }

    /** Withdraw a pending request. Returns false when there was nothing to cancel. */
    public function cancelDeletionRequest(int $userId, int $requestId): bool
    {
        return $this->repo->cancelDeletionRequest($userId, $requestId);
    }

    /**
     * Tell the school's administrators a request is waiting.
     *
     * Without this the only way to find a request is to visit the Security
     * page and look, while the public /delete-account page commits us to
     * acting within 30 days.
     *
     * Never allowed to fail the request itself: the user has done their part
     * the moment the row is written, and a push outage must not turn into an
     * error on their screen.
     */
    private function notifyAdminsOfDeletionRequest(array $user): void
    {
        $schoolId = isset($user['school_id']) ? (int)$user['school_id'] : 0;
        if ($schoolId <= 0) {
            return;
        }

        $name  = trim((string)($user['name'] ?? '')) ?: 'A user';
        $phone = trim((string)($user['phone'] ?? ''));

        $title   = 'Account deletion requested';
        $message = $phone !== ''
            ? sprintf('%s (%s) asked for their account to be deleted. Review it under Security.', $name, $phone)
            : sprintf('%s asked for their account to be deleted. Review it under Security.', $name);
        $link    = '/school-admin/security';
        $event   = 'ACCOUNT_DELETION_REQUESTED';

        try {
            $pdo  = $this->repo->getPdo();
            $stmt = $pdo->prepare(
                "INSERT INTO dashboard_notifications
                        (school_id, user_role, title, message, link, category, event_key, is_read)
                 VALUES (:school_id, 'SCHOOL_ADMIN', :title, :message, :link, :category, :event_key, 0)"
            );
            $stmt->execute([
                ':school_id' => $schoolId,
                ':title'     => $title,
                ':message'   => $message,
                ':link'      => $link,
                ':category'  => NotificationCatalog::categoryFor($event),
                ':event_key' => $event,
            ]);

            PushDispatcher::pushOnly($pdo, $schoolId, 'SCHOOL_ADMIN', null, $event, $title, $message, $link);
        } catch (\Throwable $e) {
            error_log('AuthService: could not notify admins of deletion request: ' . $e->getMessage());
        }
    }
}
