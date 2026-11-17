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

        // 1. Check if school is active first for non-SUPER_ADMIN users
        if ($role !== 'SUPER_ADMIN' && $schoolId > 0) {
            $stmtSch = $pdo->prepare("SELECT status FROM schools WHERE id = :sid LIMIT 1");
            $stmtSch->execute([':sid' => $schoolId]);
            $schRow = $stmtSch->fetch(\PDO::FETCH_ASSOC);
            $schStatus = strtoupper((string)($schRow['status'] ?? ''));
            if ($schStatus !== 'ACTIVE') {
                $this->logAuditDirect($user, 'Security', 'Failed Login Attempt', 'Failed login attempt for school marked inactive: ' . ($user['name'] ?? $user['email']));
                throw new \App\Shared\Exceptions\ValidationException(
                    ['phone' => 'You have been marked as Inactive please contact Shiksha Pilot Team for for more details'],
                    'You have been marked as Inactive please contact Shiksha Pilot Team for for more details'
                );
            }
        }

        $isInactive = (($user['status'] ?? '') !== 'ACTIVE');

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

        $safeUser = array_diff_key($user, ['password' => true, 'app_lock_pin_hash' => true]);
        $safeUser['app_lock_enabled'] = (bool)($user['app_lock_enabled'] ?? false) && !empty($user['app_lock_pin_hash']);
        if (in_array(strtoupper((string)($user['role'] ?? '')), ['ADMIN', 'SCHOOL_ADMIN'], true)) {
            $safeUser['name'] = 'Admin';
            $safeUser['photo_path'] = !empty($user['school_logo_path']) ? $user['school_logo_path'] : null;
        }
        $isPrincipal = (strtoupper((string)($user['role'] ?? '')) === 'PRINCIPAL');
        $isFeeCollector = false;
        if (in_array(strtoupper((string)($user['role'] ?? '')), ['TEACHER', 'STAFF', 'PRINCIPAL'], true)) {
            $staffFlags = $this->resolveStaffFlags((int)($user['school_id'] ?? 0), (string)($user['phone'] ?? ''));
            if ($staffFlags['is_principal']) {
                $isPrincipal = true;
            }
            if ($staffFlags['is_fee_collector']) {
                $isFeeCollector = true;
            }
            if (!empty($staffFlags['photo_path'])) {
                $safeUser['photo_path'] = $staffFlags['photo_path'];
                $safeUser['staff_photo_path'] = $staffFlags['photo_path'];
            }
        }
        if (empty($safeUser['photo_path']) && !empty($user['staff_photo_path'])) {
            $safeUser['photo_path'] = $user['staff_photo_path'];
        }
        $safeUser['is_principal'] = $isPrincipal;
        $safeUser['is_fee_collector'] = $isFeeCollector;

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
            throw new \App\Shared\Exceptions\ValidationException(
                ['new_password' => 'New password must be at least 6 characters.'],
                'New password must be at least 6 characters.'
            );
        }

        if (!preg_match('/[a-zA-Z]/', $newPassword) || !preg_match('/[0-9]/', $newPassword)) {
            throw new \App\Shared\Exceptions\ValidationException(
                ['new_password' => 'Password must contain both letters and numbers.'],
                'Password must contain both letters and numbers.'
            );
        }

        $this->repo->updatePassword($userId, $newPassword);
        $this->log('Password changed', ['id' => $userId]);

        $this->logAuditDirect($user, 'Security', 'Password Changed', 'Password changed for user "' . ($user['name'] ?? $user['email']) . '"');
    }

    /**
     * Verify user password without changing anything.
     */
    public function verifyPassword(int $userId, string $password): bool
    {
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new \App\Shared\Exceptions\NotFoundException('User not found.');
        }
        return password_verify($password, (string) ($user['password'] ?? ''));
    }

    /**
     * Enable account-level 4-digit App Lock PIN after password verification.
     *
     * @return array{app_lock_enabled: bool}
     */
    public function enableAppLock(int $userId, string $pin, string $password): array
    {
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        if (!password_verify($password, (string) ($user['password'] ?? ''))) {
            throw new ValidationException(
                ['password' => 'Current password is incorrect.'],
                'Current password is incorrect.'
            );
        }

        $cleanPin = trim($pin);
        if (preg_match('/^\d{4}$/', $cleanPin) !== 1) {
            throw new ValidationException(
                ['pin' => 'PIN must be exactly 4 numeric digits.'],
                'PIN must be exactly 4 numeric digits.'
            );
        }

        $pinHash = password_hash($cleanPin, PASSWORD_BCRYPT);
        $this->repo->setAppLock($userId, $pinHash);

        $this->log('App Lock enabled', ['id' => $userId]);
        $this->logAuditDirect($user, 'Security', 'App Lock Enabled', 'Account-level App Lock enabled for "' . ($user['name'] ?? $user['phone'] ?? $user['email']) . '"');

        return ['app_lock_enabled' => true];
    }

    /**
     * Verify the user's 4-digit App Lock PIN server-side.
     */
    public function verifyAppLockPin(int $userId, string $pin): bool
    {
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $isEnabled = (bool)($user['app_lock_enabled'] ?? false);
        if (!$isEnabled) {
            return true;
        }

        $cleanPin = trim($pin);
        if (preg_match('/^\d{4}$/', $cleanPin) !== 1) {
            return false;
        }

        $pinHash = (string)($user['app_lock_pin_hash'] ?? '');
        if ($pinHash === '') {
            return false;
        }

        return password_verify($cleanPin, $pinHash);
    }

    /**
     * Disable account-level App Lock after password verification (also used by Forgot PIN).
     *
     * @return array{app_lock_enabled: bool}
     */
    public function disableAppLock(int $userId, string $password): array
    {
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        if (!password_verify($password, (string) ($user['password'] ?? ''))) {
            throw new ValidationException(
                ['password' => 'Current password is incorrect.'],
                'Current password is incorrect.'
            );
        }

        $this->repo->disableAppLock($userId);

        $this->log('App Lock disabled', ['id' => $userId]);
        $this->logAuditDirect($user, 'Security', 'App Lock Disabled', 'Account-level App Lock disabled for "' . ($user['name'] ?? $user['phone'] ?? $user['email']) . '"');

        return ['app_lock_enabled' => false];
    }

    /**
     * Request a 4-digit OTP for App Lock PIN Reset.
     *
     * @return array{success: bool, code?: string, message: string, email_masked?: string}
     */
    public function requestAppLockForgotPinOtp(int $userId): array
    {
        $this->repo->ensureAppLockSchema();
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $pdo = $this->repo->getPdo();
        $email = !empty($user['email']) ? trim((string)$user['email']) : '';

        // If email not set on users table, check staff or students table
        $userRole = strtoupper((string)($user['role'] ?? ''));
        $phone = trim((string)($user['phone'] ?? ''));
        $schoolId = (int)($user['school_id'] ?? 0);

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            if (!empty($phone)) {
                if (in_array($userRole, ['TEACHER', 'STAFF', 'PRINCIPAL'], true)) {
                    $stmt = $pdo->prepare("SELECT email FROM staff WHERE phone = :phone " . ($schoolId > 0 ? "AND school_id = :sid " : "") . "AND email IS NOT NULL AND TRIM(email) != '' ORDER BY id DESC LIMIT 1");
                    $params = [':phone' => $phone];
                    if ($schoolId > 0) $params[':sid'] = $schoolId;
                    $stmt->execute($params);
                    $found = $stmt->fetchColumn();
                    if ($found && filter_var(trim((string)$found), FILTER_VALIDATE_EMAIL)) {
                        $email = trim((string)$found);
                        $pdo->prepare("UPDATE users SET email = :email WHERE id = :id")->execute([':email' => $email, ':id' => $userId]);
                    }
                } elseif (in_array($userRole, ['STUDENT', 'PARENT'], true)) {
                    $stmt = $pdo->prepare("SELECT COALESCE(student_email, email) AS email FROM students WHERE (student_mobile = :p1 OR parent_phone = :p2 OR father_phone = :p3) " . ($schoolId > 0 ? "AND school_id = :sid " : "") . "AND (student_email IS NOT NULL OR email IS NOT NULL) ORDER BY id DESC LIMIT 1");
                    $params = [':p1' => $phone, ':p2' => $phone, ':p3' => $phone];
                    if ($schoolId > 0) $params[':sid'] = $schoolId;
                    $stmt->execute($params);
                    $found = $stmt->fetchColumn();
                    if ($found && filter_var(trim((string)$found), FILTER_VALIDATE_EMAIL)) {
                        $email = trim((string)$found);
                        $pdo->prepare("UPDATE users SET email = :email WHERE id = :id")->execute([':email' => $email, ':id' => $userId]);
                    }
                }
            }
        }

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return [
                'success' => false,
                'code' => 'NO_EMAIL_REGISTERED',
                'message' => 'Your email address is not registered. Please contact your school administrator to register your email address. You will be able to change your PIN after verifying your email.'
            ];
        }

        // Generate 4-digit OTP
        $otpCode = sprintf('%04d', random_int(1000, 9999));

        // Invalidate previous unused OTPs
        $stmtExpire = $pdo->prepare("UPDATE app_lock_otps SET is_used = 1 WHERE user_id = :uid AND is_used = 0");
        $stmtExpire->execute([':uid' => $userId]);

        // Insert new OTP with 10 minute expiry
        $stmtIns = $pdo->prepare("
            INSERT INTO app_lock_otps (school_id, user_id, email, otp_code, expires_at)
            VALUES (:sid, :uid, :email, :code, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
        ");
        $stmtIns->execute([
            ':sid'   => $schoolId > 0 ? $schoolId : null,
            ':uid'   => $userId,
            ':email' => strtolower($email),
            ':code'  => $otpCode,
        ]);

        // Mask email for user privacy (e.g. b***l@gmail.com)
        $parts = explode('@', $email);
        $local = $parts[0];
        $domain = $parts[1] ?? '';
        if (strlen($local) <= 2) {
            $maskedLocal = substr($local, 0, 1) . '*';
        } else {
            $maskedLocal = substr($local, 0, 1) . str_repeat('*', max(1, strlen($local) - 2)) . substr($local, -1);
        }
        $maskedEmail = $maskedLocal . '@' . $domain;

        // Send Email via SmtpMailer
        $displayName = $user['name'] ?? 'User';
        $subject = "App Lock PIN Reset OTP - ShikshaPilot";
        $bodyHtml = "
        <div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);\">
            <div style=\"background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 28px 24px; text-align: center;\">
                <h1 style=\"color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;\">ShikshaPilot</h1>
                <p style=\"color: #e0f2fe; margin: 6px 0 0; font-size: 13px;\">Security Verification Code</p>
            </div>
            <div style=\"padding: 32px 28px;\">
                <p style=\"font-size: 15px; color: #1e293b; margin-top: 0; line-height: 1.5;\">Hello <strong>" . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . "</strong>,</p>
                <p style=\"font-size: 14px; color: #475569; line-height: 1.6;\">You requested to reset your App Lock Security PIN. Use the following 4-digit verification code to complete your PIN reset:</p>
                
                <div style=\"margin: 28px 0; text-align: center;\">
                    <span style=\"display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #0284c7; background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 12px 24px; font-family: monospace;\">
                        {$otpCode}
                    </span>
                </div>

                <p style=\"font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;\">
                    This verification code is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email or contact your administrator immediately.
                </p>
            </div>
            <div style=\"background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center;\">
                <p style=\"font-size: 11px; color: #94a3b8; margin: 0;\">&copy; " . date('Y') . " ShikshaPilot. All rights reserved.</p>
            </div>
        </div>";

        try {
            \App\Domain\SchoolAdmin\Services\SmtpMailer::send(
                $email,
                $subject,
                $bodyHtml,
                '',
                ''
            );
        } catch (\Throwable $e) {
            $this->log('Failed to send App Lock OTP email', ['error' => $e->getMessage(), 'email' => $email]);
            throw new ValidationException(['email' => 'Failed to send OTP email. Please try again later.'], 'Failed to send OTP email: ' . $e->getMessage());
        }

        $this->log('App Lock Forgot PIN OTP sent', ['id' => $userId, 'email' => $email]);

        return [
            'success' => true,
            'email_masked' => $maskedEmail,
            'message' => 'A 4-digit OTP has been sent to your registered email address.'
        ];
    }

    /**
     * Verify 4-digit OTP and reset App Lock PIN.
     *
     * @return array{app_lock_enabled: bool, message: string}
     */
    public function resetAppLockPinWithOtp(int $userId, string $otp, string $newPin): array
    {
        $this->repo->ensureAppLockSchema();
        $user = $this->repo->findById($userId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $cleanOtp = trim($otp);
        if (preg_match('/^\d{4}$/', $cleanOtp) !== 1) {
            throw new ValidationException(['otp' => 'OTP must be exactly 4 numeric digits.'], 'OTP must be exactly 4 numeric digits.');
        }

        $cleanPin = trim($newPin);
        if (preg_match('/^\d{4}$/', $cleanPin) !== 1) {
            throw new ValidationException(['new_pin' => 'New PIN must be exactly 4 numeric digits.'], 'New PIN must be exactly 4 numeric digits.');
        }

        $pdo = $this->repo->getPdo();
        $stmt = $pdo->prepare("
            SELECT id, otp_code, attempts, expires_at 
            FROM app_lock_otps 
            WHERE user_id = :uid AND is_used = 0 
            ORDER BY id DESC LIMIT 1
        ");
        $stmt->execute([':uid' => $userId]);
        $otpRow = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$otpRow) {
            throw new ValidationException(['otp' => 'No active OTP found. Please request a new OTP.'], 'No active OTP found. Please request a new OTP.');
        }

        if (strtotime((string)$otpRow['expires_at']) < time()) {
            $pdo->prepare("UPDATE app_lock_otps SET is_used = 1 WHERE id = :id")->execute([':id' => (int)$otpRow['id']]);
            throw new ValidationException(['otp' => 'OTP has expired. Please request a new OTP.'], 'OTP has expired. Please request a new OTP.');
        }

        if ((int)$otpRow['attempts'] >= 5) {
            $pdo->prepare("UPDATE app_lock_otps SET is_used = 1 WHERE id = :id")->execute([':id' => (int)$otpRow['id']]);
            throw new ValidationException(['otp' => 'Too many failed attempts. Please request a new OTP.'], 'Too many failed attempts. Please request a new OTP.');
        }

        if ($cleanOtp !== (string)$otpRow['otp_code']) {
            $pdo->prepare("UPDATE app_lock_otps SET attempts = attempts + 1 WHERE id = :id")->execute([':id' => (int)$otpRow['id']]);
            throw new ValidationException(['otp' => 'Invalid OTP code. Please enter the correct 4-digit code.'], 'Invalid OTP code.');
        }

        // OTP is valid! Mark as used
        $pdo->prepare("UPDATE app_lock_otps SET is_used = 1 WHERE id = :id")->execute([':id' => (int)$otpRow['id']]);

        // Hash and update App Lock PIN
        $pinHash = password_hash($cleanPin, PASSWORD_BCRYPT);
        $this->repo->setAppLock($userId, $pinHash);

        $this->log('App Lock PIN reset successfully via OTP', ['id' => $userId]);
        $this->logAuditDirect($user, 'Security', 'App Lock PIN Reset', 'App Lock PIN successfully reset via Email OTP for "' . ($user['name'] ?? $user['phone'] ?? $user['email']) . '"');

        return [
            'app_lock_enabled' => true,
            'message' => 'App Lock PIN reset successfully.'
        ];
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

        $profile = array_diff_key($user, ['password' => true, 'app_lock_pin_hash' => true]);
        $profile['app_lock_enabled'] = (bool)($user['app_lock_enabled'] ?? false) && !empty($user['app_lock_pin_hash']);
        if (in_array(strtoupper((string)($user['role'] ?? '')), ['ADMIN', 'SCHOOL_ADMIN'], true)) {
            $profile['name'] = 'Admin';
            $profile['photo_path'] = !empty($user['school_logo_path']) ? $user['school_logo_path'] : null;
        }

        $isPrincipal = (strtoupper((string)($user['role'] ?? '')) === 'PRINCIPAL');
        $isFeeCollector = false;
        if (in_array(strtoupper((string)($user['role'] ?? '')), ['TEACHER', 'PRINCIPAL', 'STAFF'], true)) {
            $staffFlags = $this->resolveStaffFlags((int)($user['school_id'] ?? 0), (string)($user['phone'] ?? ''));
            if ($staffFlags['matched']) {
                $profile['department'] = $staffFlags['department'];
                $profile['employee_id'] = $staffFlags['employee_id'];
                $profile['photo_path'] = $staffFlags['photo_path'];
                $profile['staff_photo_path'] = $staffFlags['photo_path'];
                if ($staffFlags['is_principal']) {
                    $isPrincipal = true;
                }
                if ($staffFlags['is_fee_collector']) {
                    $isFeeCollector = true;
                }
            }
        }
        $profile['is_principal'] = $isPrincipal;
        $profile['is_fee_collector'] = $isFeeCollector;

        return $profile;
    }

    /**
     * Aggregate Principal & Fee Collector flags across matching active staff records
     * for the same school & phone so having both roles (even across academic years)
     * never hides Principal or Fee Collector capabilities.
     *
     * @return array{matched:bool,is_principal:bool,is_fee_collector:bool,photo_path:?string,department:?string,employee_id:?string}
     */
    private function resolveStaffFlags(int $schoolId, string $phone): array
    {
        $result = [
            'matched'          => false,
            'is_principal'     => false,
            'is_fee_collector' => false,
            'photo_path'       => null,
            'department'       => null,
            'employee_id'      => null,
        ];

        $phoneClean = trim($phone);
        if ($schoolId <= 0 || $phoneClean === '') {
            return $result;
        }

        $phone10 = substr(preg_replace('/[^0-9]/', '', $phoneClean), -10);
        $params = [':phone' => $phoneClean, ':sid' => $schoolId];
        $phoneCond = "phone = :phone";
        if (strlen($phone10) === 10) {
            $phoneCond .= " OR RIGHT(phone, 10) = :phone10";
            $params[':phone10'] = $phone10;
        }

        try {
            $stmt = $this->repo->getPdo()->prepare("
                SELECT role, department, employee_id, photo_path, is_principal, is_fee_collector
                FROM staff
                WHERE school_id = :sid
                  AND ($phoneCond)
                  AND (status IS NULL OR status = '' OR UPPER(status) = 'ACTIVE')
                ORDER BY id DESC
            ");
            $stmt->execute($params);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $e) {
            try {
                $stmt = $this->repo->getPdo()->prepare("
                    SELECT role, department, employee_id, photo_path
                    FROM staff
                    WHERE school_id = :sid
                      AND ($phoneCond)
                      AND (status IS NULL OR status = '' OR UPPER(status) = 'ACTIVE')
                    ORDER BY id DESC
                ");
                $stmt->execute($params);
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $ignored) {
                return $result;
            }
        }

        foreach ($rows as $row) {
            $result['matched'] = true;
            if ((int)($row['is_principal'] ?? 0) === 1 || strtoupper((string)($row['role'] ?? '')) === 'PRINCIPAL') {
                $result['is_principal'] = true;
            }
            if ((int)($row['is_fee_collector'] ?? 0) === 1) {
                $result['is_fee_collector'] = true;
            }
            if ($result['photo_path'] === null && !empty($row['photo_path'])) {
                $result['photo_path'] = (string)$row['photo_path'];
            }
            if ($result['department'] === null && isset($row['department']) && $row['department'] !== '') {
                $result['department'] = (string)$row['department'];
            }
            if ($result['employee_id'] === null && isset($row['employee_id']) && $row['employee_id'] !== '') {
                $result['employee_id'] = (string)$row['employee_id'];
            }
        }

        return $result;
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
