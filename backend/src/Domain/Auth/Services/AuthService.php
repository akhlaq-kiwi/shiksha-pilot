<?php

namespace App\Domain\Auth\Services;

use App\Shared\BaseService;
use PDO;
use Firebase\JWT\JWT;
use PHPMailer\PHPMailer\PHPMailer;

class AuthService extends BaseService
{
    private string $jwtSecret;

    public function __construct(
        private ?PDO $db = null
    ) {
        $this->jwtSecret = getenv('JWT_SECRET') ?: 'super_secret_erp_key_2026';
    }

    public function identify(string $identifier): array
    {
        $identifier = trim($identifier);
        $isEmail = filter_var($identifier, FILTER_VALIDATE_EMAIL) !== false || strpos($identifier, '@') !== false;

        if ($this->db === null) {
            // Mock Fallback
            $mockUsersFile = __DIR__ . '/../../../../mock_users.json';
            if (file_exists($mockUsersFile)) {
                $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
                foreach ($mockUsers as $mu) {
                    if ($isEmail) {
                        if (trim(strtolower($mu['email'] ?? '')) === trim(strtolower($identifier)) && $mu['role'] === 'School Admin') {
                            return ['exists' => true, 'type' => 'email', 'role' => 'School Admin'];
                        }
                    } else {
                        if (trim($mu['phone'] ?? '') === $identifier) {
                            return ['exists' => true, 'type' => 'phone', 'role' => $mu['role']];
                        }
                    }
                }
            }

            if ($isEmail) {
                if (trim(strtolower($identifier)) === 'admin@yopmail.com') {
                    return ['exists' => true, 'type' => 'email', 'role' => 'School Admin'];
                }
                return ['exists' => false, 'type' => 'email', 'detail' => 'No School Admin account found with this email address.'];
            } else {
                if ($identifier === '9876543210') {
                    return ['exists' => true, 'type' => 'phone', 'role' => 'Parent'];
                }
                return ['exists' => true, 'type' => 'phone', 'role' => 'Teacher']; // fallback mock
            }
        }

        // Database mode
        if ($isEmail) {
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = :email AND role = 'School Admin' AND is_active = 1 LIMIT 1");
            $stmt->execute(['email' => $identifier]);
            $user = $stmt->fetch();

            if ($user) {
                return ['exists' => true, 'type' => 'email', 'role' => 'School Admin'];
            }
            return ['exists' => false, 'type' => 'email', 'detail' => 'No School Admin account found with this email address.'];
        } else {
            $stmt = $this->db->prepare("SELECT * FROM teachers WHERE phone = :phone AND status = 'Active' LIMIT 1");
            $stmt->execute(['phone' => $identifier]);
            $teacher = $stmt->fetch();

            if ($teacher) {
                return ['exists' => true, 'type' => 'phone', 'role' => 'Teacher'];
            }

            $stmt = $this->db->prepare("SELECT * FROM students WHERE phone = :phone OR emergency_contact = :phone LIMIT 1");
            $stmt->execute(['phone' => $identifier]);
            $student = $stmt->fetch();

            if ($student) {
                return ['exists' => true, 'type' => 'phone', 'role' => 'Parent'];
            }

            return ['exists' => false, 'type' => 'phone', 'detail' => 'No account found with this mobile number.'];
        }
    }

    public function login(string $input, string $password): array
    {
        $input = trim($input);
        if (trim(strtolower($input)) === 'test@yopmail.com') {
            $input = 'bilalnashi6@gmail.com';
        }

        $isEmail = filter_var($input, FILTER_VALIDATE_EMAIL) !== false;

        if ($this->db === null) {
            // Database connection failed, trigger mock login checking
            if ($input === 'Bilal@yopmail.com' && ($password === 'Bilal@123' || $password === hash('sha256', 'Bilal@123'))) {
                return [
                    'access_token' => 'mock-super-token',
                    'email' => $input,
                    'role' => 'Super Admin',
                    'permissions' => ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
                    'school_id' => null,
                    'setup_completed' => 1
                ];
            }
            if ($input === 'Admin@yopmail.com' && ($password === 'Admin@123' || $password === hash('sha256', 'Admin@123'))) {
                return [
                    'access_token' => 'mock-token',
                    'email' => $input,
                    'role' => 'School Admin',
                    'permissions' => ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'],
                    'school_id' => 1,
                    'setup_completed' => 1,
                    'school_name' => "St. Xavier's International School"
                ];
            }
            if ($input === '9876543210' && ($password === 'Test@123' || $password === hash('sha256', 'Test@123'))) {
                return [
                    'access_token' => 'mock-parent-token',
                    'phone' => '9876543210',
                    'role' => 'Parent',
                    'permissions' => ['parent_portal'],
                    'linked_student_ids' => [1, 2],
                    'school_id' => 1,
                    'setup_completed' => 1,
                    'school_name' => "St. Xavier's International School"
                ];
            }
            if ($input === '9876543211' && ($password === 'Test@123' || $password === hash('sha256', 'Test@123'))) {
                return [
                    'access_token' => 'mock-teacher-token',
                    'phone' => '9876543211',
                    'role' => 'Teacher',
                    'permissions' => ['attendance', 'performance'],
                    'school_id' => 1,
                    'setup_completed' => 1,
                    'school_name' => "St. Xavier's International School"
                ];
            }

            // Check dynamic mock users in mock_users.json
            $mockUsersFile = __DIR__ . '/../../../../mock_users.json';
            if (file_exists($mockUsersFile)) {
                $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
                foreach ($mockUsers as $u) {
                    if (trim(strtolower($u['email'] ?? '')) === trim(strtolower($input)) || trim($u['phone'] ?? '') === trim($input)) {
                        $verify = password_verify($password, $u['password']);
                        if ($verify) {
                            $roleName = $u['role'];
                            $perms = [];
                            if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
                                $perms = ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'];
                            } else if ($roleName === 'Parent') {
                                $perms = ['parent_portal'];
                            } else {
                                $perms = ['attendance', 'performance'];
                            }
                            return [
                                'access_token' => 'mock-token-' . $u['school_id'] . '-' . str_replace('/', '_', base64_encode($u['email'] ?? $u['phone'])),
                                'email' => $u['email'] ?? '',
                                'phone' => $u['phone'] ?? '',
                                'role' => $roleName,
                                'permissions' => $perms,
                                'linked_student_ids' => $u['linked_student_ids'] ?? [],
                                'school_id' => $u['school_id'],
                                'setup_completed' => (int)$u['setup_completed'],
                                'school_name' => $u['school_name'] ?? 'BN School'
                            ];
                        }
                    }
                }
            }

            throw new \Exception("Invalid credentials. Please verify and try again.", 401);
        }

        // Database mode
        if ($isEmail) {
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = :input LIMIT 1");
        } else {
            $stmt = $this->db->prepare("SELECT * FROM users WHERE phone = :input LIMIT 1");
        }
        $stmt->execute(['input' => $input]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            throw new \Exception("Invalid credentials. Please verify and try again.", 401);
        }

        if (!$user['is_active']) {
            throw new \Exception("Account deactivated. Please contact administrator.", 403);
        }

        $school_id = $user['school_id'];
        $setup_completed = 1;
        $school_name = 'BN School';

        if ($school_id) {
            $schStmt = $this->db->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
            $schStmt->execute(['id' => $school_id]);
            $school = $schStmt->fetch();

            if ($school) {
                if ($school['status'] === 'Inactive') {
                    throw new \Exception("School subscription or account has been deactivated.", 403);
                }

                $today = date('Y-m-d');
                if ($school['subscription_end'] < $today) {
                    throw new \Exception("Your school subscription has expired. Please contact the platform Super Admin.", 403);
                }

                $setup_completed = (int)$school['setup_completed'];
                $school_name = $school['name'];
            }
        }

        $updateLoginStmt = $this->db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = :id");
        $updateLoginStmt->execute(['id' => $user['id']]);

        // Determine dynamic permissions
        $permissions = [];
        $roleName = $user['role'];
        $roleId = $user['role_id'];

        if ($roleId) {
            $permStmt = $this->db->prepare("SELECT permission_name FROM role_permissions WHERE role_id = :role_id");
            $permStmt->execute(['role_id' => $roleId]);
            $permissions = $permStmt->fetchAll(PDO::FETCH_COLUMN);

            $roleInfoStmt = $this->db->prepare("SELECT name FROM roles WHERE id = :role_id");
            $roleInfoStmt->execute(['role_id' => $roleId]);
            $customRoleName = $roleInfoStmt->fetchColumn();
            if ($customRoleName) {
                $roleName = $customRoleName;
            }
        } else {
            if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
                $permissions = ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'];
            } else if ($roleName === 'Parent') {
                $permissions = ['parent_portal'];
            } else {
                $permissions = ['attendance', 'performance'];
            }
        }

        $linkedStudentIds = [];
        if ($roleName === 'Parent' || in_array('parent_portal', $permissions)) {
            $linkStmt = $this->db->prepare("SELECT student_id FROM parent_student_mappings WHERE parent_user_id = :user_id");
            $linkStmt->execute(['user_id' => $user['id']]);
            $linkedStudentIds = $linkStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        $token = $this->generateJwt($user['id'], $user['email'] ?? $user['phone'], $roleName, $school_id, $setup_completed);

        // Audit Log
        $this->logAudit($school_id, $user['email'] ?? $user['phone'], 'Login', 'User logged in successfully.');

        return [
            'access_token' => $token,
            'email' => $user['email'] ?? $user['phone'],
            'phone' => $user['phone'] ?? '',
            'role' => $roleName,
            'permissions' => $permissions,
            'linked_student_ids' => $linkedStudentIds,
            'school_id' => $school_id,
            'setup_completed' => (int)$setup_completed,
            'school_name' => $school_name
        ];
    }

    public function otpLogin(string $phone, string $otp): array
    {
        $phone = trim($phone);
        $otp = trim($otp);

        $verified = $this->verifyOtpService($phone, $otp);
        if (!$verified) {
            throw new \Exception("Invalid or expired OTP.", 400);
        }

        if ($this->db === null) {
            // Mock Login for phone
            if ($phone === '9876543210') {
                return [
                    'access_token' => 'mock-parent-token',
                    'phone' => '9876543210',
                    'role' => 'Parent',
                    'permissions' => ['parent_portal'],
                    'linked_student_ids' => [1, 2],
                    'school_id' => 1,
                    'setup_completed' => 1,
                    'school_name' => "St. Xavier's International School"
                ];
            }
            return [
                'access_token' => 'mock-teacher-token',
                'phone' => $phone,
                'role' => 'Teacher',
                'permissions' => ['attendance', 'performance'],
                'school_id' => 1,
                'setup_completed' => 1,
                'school_name' => "St. Xavier's International School"
            ];
        }

        // Database mode
        $stmt = $this->db->prepare("SELECT * FROM users WHERE phone = :phone LIMIT 1");
        $stmt->execute(['phone' => $phone]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new \Exception("Mobile number is not registered.", 404);
        }

        if (!$user['is_active']) {
            throw new \Exception("Account deactivated. Please contact administrator.", 403);
        }

        $school_id = $user['school_id'];
        $setup_completed = 1;
        $school_name = 'BN School';

        if ($school_id) {
            $schStmt = $this->db->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
            $schStmt->execute(['id' => $school_id]);
            $school = $schStmt->fetch();

            if ($school) {
                if ($school['status'] === 'Inactive') {
                    throw new \Exception("School subscription or account has been deactivated.", 403);
                }

                $today = date('Y-m-d');
                if ($school['subscription_end'] < $today) {
                    throw new \Exception("Your school subscription has expired. Please contact the platform Super Admin.", 403);
                }

                $setup_completed = (int)$school['setup_completed'];
                $school_name = $school['name'];
            }
        }

        $updateLoginStmt = $this->db->prepare("UPDATE users SET last_login_at = NOW() WHERE id = :id");
        $updateLoginStmt->execute(['id' => $user['id']]);

        // Permissions
        $permissions = [];
        $roleName = $user['role'];
        $roleId = $user['role_id'];

        if ($roleId) {
            $permStmt = $this->db->prepare("SELECT permission_name FROM role_permissions WHERE role_id = :role_id");
            $permStmt->execute(['role_id' => $roleId]);
            $permissions = $permStmt->fetchAll(PDO::FETCH_COLUMN);

            $roleInfoStmt = $this->db->prepare("SELECT name FROM roles WHERE id = :role_id");
            $roleInfoStmt->execute(['role_id' => $roleId]);
            $customRoleName = $roleInfoStmt->fetchColumn();
            if ($customRoleName) {
                $roleName = $customRoleName;
            }
        } else {
            if ($roleName === 'Super Admin' || $roleName === 'School Admin') {
                $permissions = ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration'];
            } else if ($roleName === 'Parent') {
                $permissions = ['parent_portal'];
            } else {
                $permissions = ['attendance', 'performance'];
            }
        }

        $linkedStudentIds = [];
        if ($roleName === 'Parent' || in_array('parent_portal', $permissions)) {
            $linkStmt = $this->db->prepare("SELECT student_id FROM parent_student_mappings WHERE parent_user_id = :user_id");
            $linkStmt->execute(['user_id' => $user['id']]);
            $linkedStudentIds = $linkStmt->fetchAll(PDO::FETCH_COLUMN);
        }

        $token = $this->generateJwt($user['id'], $user['email'] ?? $user['phone'], $roleName, $school_id, $setup_completed);

        $this->logAudit($school_id, $user['email'] ?? $user['phone'], 'Login', 'User logged in successfully via OTP.');

        return [
            'access_token' => $token,
            'email' => $user['email'] ?? $user['phone'],
            'phone' => $user['phone'] ?? '',
            'role' => $roleName,
            'permissions' => $permissions,
            'linked_student_ids' => $linkedStudentIds,
            'school_id' => $school_id,
            'setup_completed' => (int)$setup_completed,
            'school_name' => $school_name
        ];
    }

    public function forgotPassword(string $email): array
    {
        $email = trim($email);
        if (trim(strtolower($email)) === 'test@yopmail.com') {
            $email = 'bilalnashi6@gmail.com';
        }

        $otp = '1234';

        if ($this->db === null) {
            // Sandbox Mode
            $mockUsersFile = __DIR__ . '/../../../../mock_users.json';
            $emailExists = false;
            if (file_exists($mockUsersFile)) {
                $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
                foreach ($mockUsers as $u) {
                    if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                        $emailExists = true;
                        break;
                    }
                }
            }

            if (trim(strtolower($email)) === 'bilal@yopmail.com' || trim(strtolower($email)) === 'admin@yopmail.com') {
                $emailExists = true;
            }

            if (!$emailExists) {
                throw new \Exception("Email address is not registered.", 404);
            }

            // Save sandbox OTP
            $otpsFile = __DIR__ . '/../../../../sandbox_otps.json';
            $otps = [];
            if (file_exists($otpsFile)) {
                $otps = json_decode(file_get_contents($otpsFile), true) ?: [];
            }
            $otps[trim(strtolower($email))] = [
                'otp' => $otp,
                'expiry' => time() + 900 // 15 minutes
            ];
            file_put_contents($otpsFile, json_encode($otps, JSON_PRETTY_PRINT));

            $logMessage = "[" . date('Y-m-d H:i:s') . "] Sandbox Password Reset OTP for $email: $otp\n";
            file_put_contents(__DIR__ . '/../../../../sent_emails.log', $logMessage, FILE_APPEND);

            $this->sendForgotPasswordOTPEmail($email, $otp);

            return [
                'success' => true,
                'message' => 'OTP sent successfully.',
                'otp' => $otp
            ];
        }

        // Database Mode
        $stmt = $this->db->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1");
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if (!$user) {
            throw new \Exception("Email address is not registered.", 404);
        }

        $upd = $this->db->prepare("UPDATE users SET reset_otp = :otp, reset_otp_expiry = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = :id");
        $upd->execute(['otp' => $otp, 'id' => $user['id']]);

        $logMessage = "[" . date('Y-m-d H:i:s') . "] Password Reset OTP for $email: $otp\n";
        file_put_contents(__DIR__ . '/../../../../sent_emails.log', $logMessage, FILE_APPEND);

        $this->sendForgotPasswordOTPEmail($email, $otp);

        return [
            'success' => true,
            'message' => 'OTP sent successfully.'
        ];
    }

    public function verifyOtp(string $email, string $otp): bool
    {
        $email = trim($email);
        $otp = trim($otp);

        if (trim(strtolower($email)) === 'test@yopmail.com') {
            $email = 'bilalnashi6@gmail.com';
        }

        if ($this->db === null) {
            // Sandbox Mode
            $otpsFile = __DIR__ . '/../../../../sandbox_otps.json';
            if (!file_exists($otpsFile)) {
                return false;
            }
            $otps = json_decode(file_get_contents($otpsFile), true) ?: [];
            $key = trim(strtolower($email));
            if (!isset($otps[$key]) || $otps[$key]['otp'] !== $otp || $otps[$key]['expiry'] < time()) {
                return false;
            }
            return true;
        }

        // Database Mode
        $stmt = $this->db->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND reset_otp = :otp AND reset_otp_expiry >= NOW() LIMIT 1");
        $stmt->execute(['email' => $email, 'otp' => $otp]);
        return (bool)$stmt->fetch();
    }

    public function resetPassword(string $email, string $otp, string $password): bool
    {
        $email = trim($email);
        $otp = trim($otp);

        if (trim(strtolower($email)) === 'test@yopmail.com') {
            $email = 'bilalnashi6@gmail.com';
        }

        if ($this->db === null) {
            // Sandbox Mode
            $otpsFile = __DIR__ . '/../../../../sandbox_otps.json';
            if (!file_exists($otpsFile)) {
                return false;
            }
            $otps = json_decode(file_get_contents($otpsFile), true) ?: [];
            $key = trim(strtolower($email));
            if (!isset($otps[$key]) || $otps[$key]['otp'] !== $otp || $otps[$key]['expiry'] < time()) {
                return false;
            }

            unset($otps[$key]);
            file_put_contents($otpsFile, json_encode($otps, JSON_PRETTY_PRINT));

            // Update mock users
            $mockUsersFile = __DIR__ . '/../../../../mock_users.json';
            if (file_exists($mockUsersFile)) {
                $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
                $found = false;
                foreach ($mockUsers as &$u) {
                    if (trim(strtolower($u['email'])) === trim(strtolower($email))) {
                        $u['password'] = password_hash($password, PASSWORD_BCRYPT);
                        $found = true;
                        break;
                    }
                }
                if ($found) {
                    file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));
                }
            }
            return true;
        }

        // Database Mode
        $stmt = $this->db->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND reset_otp = :otp AND reset_otp_expiry >= NOW() LIMIT 1");
        $stmt->execute(['email' => $email, 'otp' => $otp]);
        $user = $stmt->fetch();

        if (!$user) {
            return false;
        }

        $hashed = password_hash($password, PASSWORD_BCRYPT);
        $upd = $this->db->prepare("UPDATE users SET password = :password, reset_otp = NULL, reset_otp_expiry = NULL WHERE id = :id");
        $upd->execute(['password' => $hashed, 'id' => $user['id']]);
        return true;
    }

    public function verifyPassword(int $userId, string $password): bool
    {
        if ($this->db === null) {
            return $password === 'Admin@123' || $password === 'Bilal@123';
        }

        $stmt = $this->db->prepare("SELECT password FROM users WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $userId]);
        $hashed = $stmt->fetchColumn();

        if (!$hashed) {
            return false;
        }

        return password_verify($password, $hashed);
    }

    // Helper functions rewritten as services methods
    private function generateJwt(int $userId, string $email, string $role, ?int $schoolId = null, int $setupCompleted = 1, ?string $phone = null): string
    {
        if ($phone === null && is_numeric($email)) {
            $phone = $email;
        }
        $payload = [
            'iss' => 'bn_school_sp',
            'iat' => time(),
            'exp' => time() + (3600 * 24), // 24 hours
            'sub' => $userId,
            'email' => $email,
            'phone' => $phone,
            'role' => $role,
            'school_id' => $schoolId,
            'setup_completed' => $setupCompleted
        ];
        return JWT::encode($payload, $this->jwtSecret, 'HS256');
    }

    private function logAudit(?int $schoolId, string $username, string $action, string $detail): void
    {
        if ($this->db === null) {
            return;
        }
        try {
            $stmt = $this->db->prepare("INSERT INTO audit_logs (school_id, username, action, details) VALUES (:school_id, :username, :action, :details)");
            $stmt->execute([
                'school_id' => $schoolId,
                'username' => $username,
                'action' => $action,
                'details' => $detail
            ]);
        } catch (\Exception $e) {}
    }

    private function verifyOtpService(string $phone, string $otp): bool
    {
        if ($this->db === null) {
            return $otp === '1234';
        }
        $now = date('Y-m-d H:i:s');
        try {
            $delExpired = $this->db->prepare("DELETE FROM phone_otps WHERE expiry < :now");
            $delExpired->execute(['now' => $now]);
        } catch (\Exception $e) {}

        $stmt = $this->db->prepare("SELECT * FROM phone_otps WHERE phone = :phone AND otp = :otp AND expiry >= :now LIMIT 1");
        $stmt->execute(['phone' => $phone, 'otp' => $otp, 'now' => $now]);
        $record = $stmt->fetch();
        if ($record) {
            $del = $this->db->prepare("DELETE FROM phone_otps WHERE phone = :phone");
            $del->execute(['phone' => $phone]);
            return true;
        }
        return false;
    }

    private function sendForgotPasswordOTPEmail(string $toEmail, string $otp): bool
    {
        $smtpHost = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
        $smtpPort = (int)(getenv('SMTP_PORT') ?: 587);
        $smtpUser = getenv('SMTP_USER') ?: '';
        $smtpPass = getenv('SMTP_PASS') ?: '';
        $fromName = getenv('SMTP_FROM_NAME') ?: 'BN Shiksha Pilot (SP) Control Panel';

        if (empty($smtpUser) || empty($smtpPass) || $smtpUser === 'your_email@gmail.com') {
            $logMessage = "[" . date('Y-m-d H:i:s') . "] Outgoing password recovery OTP: To: $toEmail | OTP: $otp\n";
            file_put_contents(__DIR__ . '/../../../../sent_emails.log', $logMessage, FILE_APPEND);
            return false;
        }

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $smtpHost;
            $mail->SMTPAuth = true;
            $mail->Username = $smtpUser;
            $mail->Password = $smtpPass;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $smtpPort;

            $mail->setFrom($smtpUser, $fromName);
            $mail->addAddress($toEmail);

            $mail->isHTML(true);
            $mail->Subject = "Password Reset Verification Code - BN College Portal";
            $mail->Body = "OTP code is <b>$otp</b>"; // Shorthand simplified version for verification

            $mail->send();
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
