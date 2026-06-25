<?php

namespace App\Domain\Platform\Services;

use App\Shared\BaseService;
use PDO;
use DateTime;

class PlatformService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    public function getPlans(): array
    {
        $pdo = $this->db ?: $this->getDbFallback();
        if ($pdo === null) {
            return [
                ['id' => 1, 'name' => 'Free Trial', 'duration_days' => 30, 'price' => 0.00, 'is_active' => 1, 'description' => '30 Days Trial'],
                ['id' => 2, 'name' => '1 Year Plan', 'duration_days' => 365, 'price' => 999.00, 'is_active' => 1, 'description' => '1 Year Subscription']
            ];
        }
        $stmt = $pdo->query("SELECT * FROM subscription_plans ORDER BY id ASC");
        return $stmt->fetchAll();
    }

    public function createPlan(array $data, string $performedBy): array
    {
        $name = $data['name'] ?? null;
        $duration = (int)($data['duration_days'] ?? 0);
        $price = (float)($data['price'] ?? 0);
        $is_active = (int)($data['is_active'] ?? 1);
        $description = $data['description'] ?? '';

        if (!$name || $duration <= 0) {
            throw new \InvalidArgumentException('Plan Name and valid Duration in days are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Plan created successfully in sandbox.', 'id' => 99];
        }

        $stmt = $pdo->prepare("INSERT INTO subscription_plans (name, duration_days, price, is_active, description) VALUES (:name, :duration, :price, :is_active, :description)");
        $stmt->execute([
            'name' => $name,
            'duration' => $duration,
            'price' => $price,
            'is_active' => $is_active,
            'description' => $description
        ]);
        $id = $pdo->lastInsertId();

        $this->logAudit($pdo, null, $performedBy, 'Create Plan', "Created subscription plan '$name' ($duration Days, Price: $price).");

        return ['message' => 'Plan created successfully.', 'id' => $id];
    }

    public function updatePlan(int $id, array $data, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Plan updated successfully in sandbox.'];
        }

        $check = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
        $check->execute(['id' => $id]);
        $plan = $check->fetch();
        if (!$plan) {
            throw new \Exception('Plan not found.', 404);
        }

        $name = $data['name'] ?? $plan['name'];
        $duration = (int)($data['duration_days'] ?? $plan['duration_days']);
        $price = (float)($data['price'] ?? $plan['price']);
        $is_active = (int)($data['is_active'] ?? $plan['is_active']);
        $description = isset($data['description']) ? $data['description'] : $plan['description'];

        $stmt = $pdo->prepare("UPDATE subscription_plans SET name = :name, duration_days = :duration, price = :price, is_active = :is_active, description = :description WHERE id = :id");
        $stmt->execute([
            'name' => $name,
            'duration' => $duration,
            'price' => $price,
            'is_active' => $is_active,
            'description' => $description,
            'id' => $id
        ]);

        $this->logAudit($pdo, null, $performedBy, 'Update Plan', "Updated subscription plan ID $id ('$name').");

        return ['message' => 'Plan updated successfully.'];
    }

    public function deletePlan(int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Plan deleted successfully in sandbox.'];
        }

        $check = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
        $check->execute(['id' => $id]);
        $plan = $check->fetch();
        if (!$plan) {
            throw new \Exception('Plan not found.', 404);
        }

        $inUseStmt = $pdo->prepare("SELECT COUNT(*) FROM school_subscriptions WHERE plan_id = :id");
        $inUseStmt->execute(['id' => $id]);
        $inUse = ($inUseStmt->fetchColumn() > 0);

        if ($inUse) {
            $stmt = $pdo->prepare("UPDATE subscription_plans SET is_active = 0 WHERE id = :id");
            $stmt->execute(['id' => $id]);
            $this->logAudit($pdo, null, $performedBy, 'Deactivate Plan', "Deactivated subscription plan ID $id because it is currently in use.");
            return ['message' => 'Plan is currently in use by active subscriptions. It has been deactivated instead of deleted.'];
        } else {
            $stmt = $pdo->prepare("DELETE FROM subscription_plans WHERE id = :id");
            $stmt->execute(['id' => $id]);
            $this->logAudit($pdo, null, $performedBy, 'Delete Plan', "Deleted subscription plan ID $id ('{$plan['name']}').");
            return ['message' => 'Plan deleted successfully.'];
        }
    }

    public function getSubscriptions(): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $subs = [];
            foreach ($schools as $s) {
                $subs[] = [
                    'school_id' => $s['id'],
                    'school_name' => $s['name'],
                    'school_email' => $s['email'],
                    'subscription_id' => $s['id'],
                    'plan_id' => 1,
                    'start_date' => $s['subscription_start'],
                    'expiry_date' => $s['subscription_end'],
                    'remaining_days' => 30,
                    'status' => $s['status'],
                    'plan_name' => 'Free Trial',
                    'price' => 0.00,
                    'duration_days' => 30
                ];
            }
            return $subs;
        }

        $stmt = $pdo->query("
            SELECT s.id AS school_id, s.name AS school_name, s.email AS school_email, 
                   ss.id AS subscription_id, ss.plan_id, ss.start_date, ss.expiry_date, ss.remaining_days, ss.status,
                   sp.name AS plan_name, sp.price, sp.duration_days
            FROM schools s
            LEFT JOIN school_subscriptions ss ON s.id = ss.school_id
            LEFT JOIN subscription_plans sp ON ss.plan_id = sp.id
            ORDER BY s.name ASC
        ");
        $subs = $stmt->fetchAll();

        $today = date('Y-m-d');
        foreach ($subs as &$s) {
            if ($s['subscription_id']) {
                $expiry = $s['expiry_date'];
                $diff = (strtotime($expiry) - strtotime($today)) / (60 * 60 * 24);
                $remaining = max(0, (int)ceil($diff));
                $isTrial = ($s['plan_name'] && stripos($s['plan_name'], 'Trial') !== false);

                $newStatus = $s['status'];
                if ($remaining <= 0) {
                    $newStatus = $isTrial ? 'Trial Expired' : 'Expired';
                } else if ($remaining < 15) {
                    $newStatus = 'Expiring Soon';
                } else {
                    $newStatus = $isTrial ? 'Trial Active' : 'Active';
                }

                $s['remaining_days'] = $remaining;
                $s['status'] = $newStatus;
            }
        }

        return $subs;
    }

    public function activateSubscription(array $data, string $performedBy): array
    {
        $schoolId = $data['school_id'] ?? null;
        $planId = $data['plan_id'] ?? null;
        $actionType = $data['action_type'] ?? 'Activate';

        if (!$schoolId) {
            throw new \InvalidArgumentException('School ID is required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['success' => true, 'message' => 'Subscription modified in sandbox.', 'expiry_date' => date('Y-m-d', strtotime('+30 days'))];
        }

        $schStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
        $schStmt->execute(['id' => $schoolId]);
        $school = $schStmt->fetch();
        if (!$school) {
            throw new \Exception('School not found.', 404);
        }

        if ($actionType === 'Cancel') {
            $checkStmt = $pdo->prepare("SELECT ss.*, sp.name AS plan_name FROM school_subscriptions ss LEFT JOIN subscription_plans sp ON ss.plan_id = sp.id WHERE ss.school_id = :school_id LIMIT 1");
            $checkStmt->execute(['school_id' => $schoolId]);
            $sub = $checkStmt->fetch();

            $planName = $sub ? $sub['plan_name'] : 'Unknown Plan';
            $today = date('Y-m-d');

            if ($sub) {
                $upSub = $pdo->prepare("UPDATE school_subscriptions SET expiry_date = :expiry, remaining_days = 0, status = 'Expired' WHERE id = :id");
                $upSub->execute(['expiry' => $today, 'id' => $sub['id']]);
            }

            $upSchool = $pdo->prepare("UPDATE schools SET subscription_end = :end, status = 'Inactive' WHERE id = :id");
            $upSchool->execute(['end' => $today, 'id' => $schoolId]);

            $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Plan Expired', :performer, :school_name, :plan_name)");
            $logStmt->execute([
                'performer' => $performedBy,
                'school_name' => $school['name'],
                'plan_name' => $planName
            ]);

            $this->logAudit($pdo, $schoolId, $performedBy, 'Cancel Subscription', "Cancelled subscription for school '{$school['name']}'.");

            return ['message' => 'Subscription cancelled and expired successfully.'];
        }

        if (!$planId) {
            throw new \InvalidArgumentException('Plan ID is required.', 400);
        }

        $planStmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
        $planStmt->execute(['id' => $planId]);
        $plan = $planStmt->fetch();
        if (!$plan) {
            throw new \Exception('Plan not found.', 404);
        }

        $isTrialPlan = (stripos($plan['name'], 'Trial') !== false);

        if ($isTrialPlan) {
            $regCheck = $pdo->prepare("SELECT COUNT(*) FROM trial_usage_registry WHERE email = :email");
            $regCheck->execute(['email' => $school['email']]);
            if ($regCheck->fetchColumn() > 0) {
                throw new \Exception('This school registered email has already consumed its Free Trial.', 400);
            }
        }

        $checkStmt = $pdo->prepare("SELECT * FROM school_subscriptions WHERE school_id = :school_id LIMIT 1");
        $checkStmt->execute(['school_id' => $schoolId]);
        $existingSub = $checkStmt->fetch();

        $startDate = date('Y-m-d');
        if ($existingSub) {
            $currentExpiry = $existingSub['expiry_date'];
            if (strtotime($currentExpiry) >= strtotime(date('Y-m-d'))) {
                $startDate = $existingSub['start_date'];
                $expiryDate = date('Y-m-d', strtotime("+$plan[duration_days] days", strtotime($currentExpiry)));
            } else {
                $startDate = date('Y-m-d');
                $expiryDate = date('Y-m-d', strtotime("+$plan[duration_days] days"));
            }
        } else {
            $startDate = date('Y-m-d');
            $expiryDate = date('Y-m-d', strtotime("+$plan[duration_days] days"));
        }

        $today = date('Y-m-d');
        $diff = (strtotime($expiryDate) - strtotime($today)) / (60 * 60 * 24);
        $remainingDays = max(0, (int)ceil($diff));

        $status = 'Active';
        if ($remainingDays <= 0) {
            $status = $isTrialPlan ? 'Trial Expired' : 'Expired';
        } else if ($remainingDays < 15) {
            $status = 'Expiring Soon';
        } else {
            $status = $isTrialPlan ? 'Trial Active' : 'Active';
        }

        if ($existingSub) {
            $updateSub = $pdo->prepare("
                UPDATE school_subscriptions 
                SET plan_id = :plan_id, start_date = :start_date, expiry_date = :expiry_date, remaining_days = :remaining, status = :status,
                    email_reminder_3 = 0, email_reminder_1 = 0, email_reminder_expired = 0
                WHERE id = :id
            ");
            $updateSub->execute([
                'plan_id' => $planId,
                'start_date' => $startDate,
                'expiry_date' => $expiryDate,
                'remaining' => $remainingDays,
                'status' => $status,
                'id' => $existingSub['id']
            ]);
        } else {
            $insertSub = $pdo->prepare("
                INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status, email_reminder_3, email_reminder_1, email_reminder_expired) 
                VALUES (:school_id, :plan_id, :start_date, :expiry_date, :remaining, :status, 0, 0, 0)
            ");
            $insertSub->execute([
                'school_id' => $schoolId,
                'plan_id' => $planId,
                'start_date' => $startDate,
                'expiry_date' => $expiryDate,
                'remaining' => $remainingDays,
                'status' => $status
            ]);
        }

        $upSchool = $pdo->prepare("UPDATE schools SET subscription_start = :start, subscription_end = :end, status = :school_status WHERE id = :id");
        $upSchool->execute([
            'start' => $startDate,
            'end' => $expiryDate,
            'school_status' => ($status === 'Expired' || $status === 'Trial Expired') ? 'Inactive' : 'Active',
            'id' => $schoolId
        ]);

        if ($isTrialPlan) {
            $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
            $regStmt->execute(['email' => $school['email']]);
        }

        $auditAction = 'Plan Activated';
        if ($isTrialPlan) {
            $auditAction = 'Trial Activated';
        } else if ($actionType === 'Extend') {
            $auditAction = 'Plan Extended';
        } else if ($actionType === 'Upgrade') {
            $auditAction = 'Plan Upgraded';
        } else if ($actionType === 'Downgrade') {
            $auditAction = 'Plan Downgraded';
        } else if ($existingSub && $existingSub['plan_id'] === $planId) {
            $auditAction = 'Plan Renewed';
        }

        $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES (:action, :performer, :school_name, :plan_name)");
        $logStmt->execute([
            'action' => $auditAction,
            'performer' => $performedBy,
            'school_name' => $school['name'],
            'plan_name' => $plan['name']
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, $auditAction, "Modified subscription for school '{$school['name']}': Plan '{$plan['name']}' (Expires: $expiryDate).");

        return [
            'success' => true,
            'message' => "Subscription successfully updated to Plan '{$plan['name']}'.",
            'expiry_date' => $expiryDate
        ];
    }

    public function getAuditLogs(): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }
        $stmt = $pdo->query("SELECT * FROM subscription_audit_logs ORDER BY id DESC LIMIT 500");
        return $stmt->fetchAll();
    }

    public function getActivePlans(): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [
                ['id' => 1, 'name' => 'Free Trial', 'duration_days' => 30, 'price' => 0.00, 'is_active' => 1, 'description' => '30 Days Trial'],
                ['id' => 2, 'name' => '1 Year Plan', 'duration_days' => 365, 'price' => 999.00, 'is_active' => 1, 'description' => '1 Year Subscription']
            ];
        }
        $stmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE is_active = 1 AND price > 0 ORDER BY duration_days ASC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function getStats(): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $total = count($schools);
            $active = 0;
            $inactive = 0;
            $today = new DateTime();
            $recent = [];

            foreach ($schools as $s) {
                $end = new DateTime($s['subscription_end']);
                $status = ($end < $today) ? 'Inactive' : $s['status'];
                if ($status === 'Active') $active++;
                else $inactive++;

                $recent[] = [
                    'id' => $s['id'],
                    'name' => $s['name'],
                    'email' => $s['email'],
                    'status' => $status,
                    'created_at' => ($s['subscription_start'] ?? date('Y-m-d')) . ' 10:00:00'
                ];
            }

            return [
                'total_schools' => $total,
                'active_schools' => $active,
                'inactive_schools' => $inactive,
                'total_students' => 450,
                'total_teachers' => 35,
                'total_revenue' => 12450.00,
                'recent_schools' => array_slice($recent, 0, 5)
            ];
        }

        $pdo->exec("UPDATE schools SET status = 'Inactive' WHERE subscription_end < CURRENT_DATE() AND status = 'Active'");

        $total_schools = (int)$pdo->query("SELECT COUNT(*) FROM schools")->fetchColumn();
        $active_schools = (int)$pdo->query("SELECT COUNT(*) FROM schools WHERE status = 'Active'")->fetchColumn();
        $inactive_schools = (int)$pdo->query("SELECT COUNT(*) FROM schools WHERE status = 'Inactive'")->fetchColumn();
        $total_students = (int)$pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();
        $total_teachers = (int)$pdo->query("SELECT COUNT(*) FROM teachers")->fetchColumn();
        $total_revenue = (float)$pdo->query("SELECT SUM(amount) FROM fee_records WHERE status = 'Paid'")->fetchColumn() ?: 0.0;

        $recent = $pdo->query("SELECT id, name, email, status, created_at FROM schools ORDER BY id DESC LIMIT 5")->fetchAll();

        return [
            'total_schools' => $total_schools,
            'active_schools' => $active_schools,
            'inactive_schools' => $inactive_schools,
            'total_students' => $total_students,
            'total_teachers' => $total_teachers,
            'total_revenue' => $total_revenue,
            'recent_schools' => $recent
        ];
    }

    public function getSchools(): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $today = new DateTime();
            foreach ($schools as &$s) {
                $end = new DateTime($s['subscription_end']);
                $interval = $today->diff($end);
                $s['days_remaining'] = $end >= $today ? (int)$interval->format('%r%a') : 0;
                $s['status'] = $end >= $today ? $s['status'] : 'Inactive';
            }
            return $schools;
        }

        $pdo->exec("UPDATE schools SET status = 'Inactive' WHERE subscription_end < CURRENT_DATE() AND status = 'Active'");
        $schools = $pdo->query("SELECT * FROM schools ORDER BY id DESC")->fetchAll();

        $today = new DateTime();
        foreach ($schools as &$s) {
            $end = new DateTime($s['subscription_end']);
            $interval = $today->diff($end);
            $s['days_remaining'] = $end >= $today ? (int)$interval->format('%r%a') : 0;
        }

        return $schools;
    }

    public function inviteSchool(array $data, string $performedBy): array
    {
        $email = $data['email'] ?? '';
        $name = '-';
        $contact_person = '-';
        $phone = '-';

        if (empty($email)) {
            throw new \InvalidArgumentException('Email address is required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $mockUsersFile = __DIR__ . '/../../../../mock_users.json';
            $mockUsers = [];
            if (file_exists($mockUsersFile)) {
                $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
            }
            foreach ($mockUsers as $u) {
                if (trim(strtolower($u['email'] ?? '')) === trim(strtolower($email))) {
                    $role = $u['role'] ?? 'School Admin';
                    if ($role === 'Super Admin') {
                        throw new \Exception('This email address is registered as a Platform Super Admin and cannot be used for a school.', 400);
                    } else {
                        throw new \Exception('Email address is already in use by another school tenant.', 400);
                    }
                }
            }

            $schools = $this->getMockSchools();
            $newSchoolId = count($schools) > 0 ? max(array_column($schools, 'id')) + 1 : 3;

            $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
            $start = date('Y-m-d');

            $planIdInput = $data['plan_id'] ?? null;
            if ($planIdInput === 'without_plan') {
                $end = date('Y-m-d', strtotime('-1 day'));
                $schoolStatus = 'Inactive';
            } else if ($planIdInput !== null) {
                $days = 30;
                if (intval($planIdInput) == 2) $days = 365;
                else if (intval($planIdInput) == 3) $days = 730;
                else if (intval($planIdInput) == 4) $days = 1095;
                $end = date('Y-m-d', strtotime("+$days days"));
                $schoolStatus = 'Active';
            } else {
                $end = date('Y-m-d', strtotime('+30 days'));
                $schoolStatus = 'Active';
            }

            $newSchool = [
                'id' => $newSchoolId,
                'name' => $name,
                'code' => $code,
                'contact_person' => $contact_person,
                'contact_number' => $phone,
                'email' => $email,
                'subscription_start' => $start,
                'subscription_end' => $end,
                'status' => $schoolStatus,
                'setup_completed' => 0
            ];
            $schools[] = $newSchool;
            $this->saveMockSchools($schools);

            $plainPassword = $this->generateSecurePassword();
            $mockUsers[] = [
                'email' => $email,
                'password' => password_hash(hash('sha256', $plainPassword), PASSWORD_BCRYPT),
                'role' => 'School Admin',
                'school_id' => $newSchoolId,
                'setup_completed' => 0,
                'school_name' => '-'
            ];
            file_put_contents($mockUsersFile, json_encode($mockUsers, JSON_PRETTY_PRINT));

            $this->sendCredentialsEmail($email, $name, $plainPassword);

            return [
                'success' => true,
                'email' => $email,
                'message' => 'School invitation generated successfully.'
            ];
        }

        // DB Mode
        $check = $pdo->prepare("SELECT role FROM users WHERE email = :email LIMIT 1");
        $check->execute(['email' => $email]);
        $userRow = $check->fetch();
        if ($userRow) {
            $role = $userRow['role'];
            if ($role === 'Super Admin') {
                throw new \Exception('This email address is registered as a Platform Super Admin and cannot be used for a school.', 400);
            } else {
                throw new \Exception('Email address is already in use by another school tenant.', 400);
            }
        }

        $trialCheck = $pdo->prepare("SELECT COUNT(*) FROM trial_usage_registry WHERE email = :email");
        $trialCheck->execute(['email' => $email]);
        $hasUsedTrial = ($trialCheck->fetchColumn() > 0);

        $trialPlanStmt = $pdo->prepare("SELECT id, is_active FROM subscription_plans WHERE name = 'Free Trial' LIMIT 1");
        $trialPlanStmt->execute();
        $trialPlanRow = $trialPlanStmt->fetch();

        $isTrialInactive = false;
        $freeTrialPlanId = null;
        if ($trialPlanRow) {
            $freeTrialPlanId = $trialPlanRow['id'];
            $isTrialInactive = ((int)$trialPlanRow['is_active'] === 0);
        }

        $planIdInput = $data['plan_id'] ?? null;

        if ($planIdInput === 'without_plan') {
            $start = date('Y-m-d');
            $end = date('Y-m-d', strtotime('-1 day'));
            $schoolStatus = 'Inactive';

            $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
            $schStmt = $pdo->prepare("INSERT INTO schools (name, code, contact_person, contact_number, email, subscription_start, subscription_end, status, setup_completed) VALUES (:name, :code, :contact_person, :phone, :email, :start, :end, :status, 0)");
            $schStmt->execute([
                'name' => $name,
                'code' => $code,
                'contact_person' => $contact_person,
                'phone' => $phone,
                'email' => $email,
                'start' => $start,
                'end' => $end,
                'status' => $schoolStatus
            ]);
            $schoolId = $pdo->lastInsertId();
        } else if ($planIdInput !== null) {
            $planStmt = $pdo->prepare("SELECT * FROM subscription_plans WHERE id = :id");
            $planStmt->execute(['id' => $planIdInput]);
            $plan = $planStmt->fetch();
            if (!$plan) {
                throw new \Exception('Subscription plan not found.', 404);
            }

            $start = date('Y-m-d');
            $duration = (int)$plan['duration_days'];
            $end = date('Y-m-d', strtotime("+$duration days"));
            $schoolStatus = 'Active';

            $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
            $schStmt = $pdo->prepare("INSERT INTO schools (name, code, contact_person, contact_number, email, subscription_start, subscription_end, status, setup_completed) VALUES (:name, :code, :contact_person, :phone, :email, :start, :end, :status, 0)");
            $schStmt->execute([
                'name' => $name,
                'code' => $code,
                'contact_person' => $contact_person,
                'phone' => $phone,
                'email' => $email,
                'start' => $start,
                'end' => $end,
                'status' => $schoolStatus
            ]);
            $schoolId = $pdo->lastInsertId();

            $isTrialPlan = (stripos($plan['name'], 'Trial') !== false);
            $remainingDays = $duration;

            $subStatus = 'Active';
            if ($remainingDays <= 0) {
                $subStatus = $isTrialPlan ? 'Trial Expired' : 'Expired';
            } else if ($remainingDays < 15) {
                $subStatus = 'Expiring Soon';
            } else {
                $subStatus = $isTrialPlan ? 'Trial Active' : 'Active';
            }

            $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, :remaining, :status)");
            $insSub->execute([
                'school_id' => $schoolId,
                'plan_id' => $plan['id'],
                'start' => $start,
                'end' => $end,
                'remaining' => $remainingDays,
                'status' => $subStatus
            ]);

            $auditAction = $isTrialPlan ? 'Trial Activated' : 'Plan Activated';
            $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES (:action, :performer, :school_name, :plan_name)");
            $logStmt->execute([
                'action' => $auditAction,
                'performer' => $performedBy,
                'school_name' => $name,
                'plan_name' => $plan['name']
            ]);

            if ($isTrialPlan) {
                $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
                $regStmt->execute(['email' => $email]);
            }
        } else {
            $start = date('Y-m-d');
            $shouldBeExpired = ($hasUsedTrial || $isTrialInactive);

            if ($shouldBeExpired) {
                $end = date('Y-m-d', strtotime('-1 day'));
            } else {
                $end = date('Y-m-d', strtotime('+30 days'));
            }

            $code = 'SCH-' . strtoupper(substr(uniqid(), -6));
            $schStmt = $pdo->prepare("INSERT INTO schools (name, code, contact_person, contact_number, email, subscription_start, subscription_end, status, setup_completed) VALUES (:name, :code, :contact_person, :phone, :email, :start, :end, 'Active', 0)");
            $schStmt->execute([
                'name' => $name,
                'code' => $code,
                'contact_person' => $contact_person,
                'phone' => $phone,
                'email' => $email,
                'start' => $start,
                'end' => $end
            ]);
            $schoolId = $pdo->lastInsertId();

            if ($shouldBeExpired) {
                $planId = null;
                $planName = 'Free Trial';
                if ($isTrialInactive && !$hasUsedTrial) {
                    $planId = $freeTrialPlanId;
                    $planName = 'Free Trial';
                }

                if (!$planId) {
                    $planStmt = $pdo->prepare("SELECT id, name FROM subscription_plans WHERE name = '1 Year Plan' LIMIT 1");
                    $planStmt->execute();
                    $pRow = $planStmt->fetch();
                    if ($pRow) {
                        $planId = $pRow['id'];
                        $planName = $pRow['name'];
                    }
                }

                if (!$planId) {
                    $planStmt = $pdo->prepare("SELECT id, name FROM subscription_plans LIMIT 1");
                    $planStmt->execute();
                    $pRow = $planStmt->fetch();
                    if ($pRow) {
                        $planId = $pRow['id'];
                        $planName = $pRow['name'];
                    }
                }

                if ($planId) {
                    $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, 0, 'Expired')");
                    $insSub->execute([
                        'school_id' => $schoolId,
                        'plan_id' => $planId,
                        'start' => $start,
                        'end' => $end
                    ]);

                    $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Plan Expired', 'System', :school_name, :plan_name)");
                    $logStmt->execute([
                        'school_name' => $name,
                        'plan_name' => $planName
                    ]);
                }
            } else {
                $planId = $freeTrialPlanId;
                if (!$planId) {
                    $planStmt = $pdo->prepare("SELECT id FROM subscription_plans WHERE name = 'Free Trial' LIMIT 1");
                    $planStmt->execute();
                    $planId = $planStmt->fetchColumn();
                }
                if (!$planId) {
                    $planStmt = $pdo->prepare("SELECT id FROM subscription_plans LIMIT 1");
                    $planStmt->execute();
                    $planId = $planStmt->fetchColumn();
                }

                if ($planId) {
                    $insSub = $pdo->prepare("INSERT INTO school_subscriptions (school_id, plan_id, start_date, expiry_date, remaining_days, status) VALUES (:school_id, :plan_id, :start, :end, 30, 'Trial Active')");
                    $insSub->execute([
                        'school_id' => $schoolId,
                        'plan_id' => $planId,
                        'start' => $start,
                        'end' => $end
                    ]);

                    $regStmt = $pdo->prepare("INSERT IGNORE INTO trial_usage_registry (email) VALUES (:email)");
                    $regStmt->execute(['email' => $email]);

                    $logStmt = $pdo->prepare("INSERT INTO subscription_audit_logs (action, performed_by, school_name, plan_name) VALUES ('Trial Activated', :performer, :school_name, 'Free Trial')");
                    $logStmt->execute([
                        'performer' => $performedBy,
                        'school_name' => $name
                    ]);
                }
            }
        }

        $plainPassword = $this->generateSecurePassword();
        $hashedPassword = password_hash(hash('sha256', $plainPassword), PASSWORD_BCRYPT);

        $userStmt = $pdo->prepare("INSERT INTO users (school_id, email, password, role, is_active) VALUES (:school_id, :email, :password, 'School Admin', 1)");
        $userStmt->execute([
            'school_id' => $schoolId,
            'email' => $email,
            'password' => $hashedPassword
        ]);

        $inviteCode = 'INV-' . strtoupper(substr(uniqid(), -8));
        $inviteStmt = $pdo->prepare("INSERT INTO invitations (school_name, email, contact_person, phone, code, status) VALUES (:school_name, :email, :contact_person, :phone, :code, 'Accepted')");
        $inviteStmt->execute([
            'school_name' => $name,
            'email' => $email,
            'contact_person' => $contact_person,
            'phone' => $phone,
            'code' => $inviteCode
        ]);

        $this->logAudit($pdo, null, $performedBy, 'Invite School', "Invited school '$name' and generated admin credentials.");

        $this->sendCredentialsEmail($email, $name, $plainPassword);

        return [
            'success' => true,
            'email' => $email,
            'message' => 'School invitation generated successfully.'
        ];
    }

    public function updateSchool(int $id, array $data, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $foundIdx = -1;
            foreach ($schools as $idx => $s) {
                if (strval($s['id']) === strval($id)) {
                    $foundIdx = $idx;
                    break;
                }
            }

            if ($foundIdx === -1) {
                throw new \Exception('School not found.', 404);
            }

            $school = $schools[$foundIdx];
            $schools[$foundIdx]['name'] = $data['name'] ?? $school['name'];
            $schools[$foundIdx]['status'] = $data['status'] ?? $school['status'];
            $schools[$foundIdx]['subscription_end'] = $data['subscription_end'] ?? $school['subscription_end'];
            $schools[$foundIdx]['contact_person'] = $data['contact_person'] ?? $school['contact_person'];
            $schools[$foundIdx]['contact_number'] = $data['contact_number'] ?? $school['contact_number'];

            $this->saveMockSchools($schools);
            return ['message' => 'School updated successfully.'];
        }

        $origStmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
        $origStmt->execute(['id' => $id]);
        $school = $origStmt->fetch();
        if (!$school) {
            throw new \Exception('School not found.', 404);
        }

        $name = $data['name'] ?? $school['name'];
        $status = $data['status'] ?? $school['status'];
        $sub_end = $data['subscription_end'] ?? $school['subscription_end'];
        $contact_person = $data['contact_person'] ?? $school['contact_person'];
        $contact_number = $data['contact_number'] ?? $school['contact_number'];

        $stmt = $pdo->prepare("UPDATE schools SET name = :name, status = :status, subscription_end = :sub_end, contact_person = :contact_person, contact_number = :contact_number WHERE id = :id");
        $stmt->execute([
            'name' => $name,
            'status' => $status,
            'sub_end' => $sub_end,
            'contact_person' => $contact_person,
            'contact_number' => $contact_number,
            'id' => $id
        ]);

        $this->logAudit($pdo, null, $performedBy, 'Update School', "Updated details for school ID $id.");

        return ['message' => 'School updated successfully.'];
    }

    public function extendSubscription(int $id, int $months, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $foundIdx = -1;
            foreach ($schools as $idx => $s) {
                if (strval($s['id']) === strval($id)) {
                    $foundIdx = $idx;
                    break;
                }
            }

            if ($foundIdx === -1) {
                throw new \Exception('School not found.', 404);
            }

            $school = $schools[$foundIdx];
            $currentEnd = new DateTime($school['subscription_end']);
            $currentEnd->modify("+$months months");
            $newEnd = $currentEnd->format('Y-m-d');

            $schools[$foundIdx]['subscription_end'] = $newEnd;
            $this->saveMockSchools($schools);

            return [
                'success' => true,
                'subscription_end' => $newEnd,
                'message' => 'Subscription extended successfully.'
            ];
        }

        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $school = $stmt->fetch();
        if (!$school) {
            throw new \Exception('School not found.', 404);
        }

        $currentEnd = new DateTime($school['subscription_end']);
        $currentEnd->modify("+$months months");
        $newEnd = $currentEnd->format('Y-m-d');

        $today = date('Y-m-d');
        $diff = (strtotime($newEnd) - strtotime($today)) / (60 * 60 * 24);
        $remainingDays = max(0, (int)ceil($diff));

        $status = 'Active';
        if ($remainingDays <= 0) {
            $status = 'Expired';
        } else if ($remainingDays < 15) {
            $status = 'Expiring Soon';
        }

        $updateStmt = $pdo->prepare("UPDATE schools SET subscription_end = :new_end, status = :status WHERE id = :id");
        $updateStmt->execute([
            'new_end' => $newEnd,
            'status' => $status === 'Expired' ? 'Inactive' : 'Active',
            'id' => $id
        ]);

        $updateSub = $pdo->prepare("UPDATE school_subscriptions SET expiry_date = :new_end, remaining_days = :remaining, status = :sub_status, email_reminder_3 = 0, email_reminder_1 = 0, email_reminder_expired = 0 WHERE school_id = :school_id");
        $updateSub->execute([
            'new_end' => $newEnd,
            'remaining' => $remainingDays,
            'sub_status' => $status,
            'school_id' => $id
        ]);

        $this->logAudit($pdo, null, $performedBy, 'Extend Subscription', "Extended school ID $id by $months months (New End: $newEnd).");

        return [
            'success' => true,
            'subscription_end' => $newEnd,
            'message' => 'Subscription extended successfully.'
        ];
    }

    public function deleteSchool(int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $updatedSchools = [];
            foreach ($schools as $s) {
                if (strval($s['id']) !== strval($id)) {
                    $updatedSchools[] = $s;
                }
            }
            $this->saveMockSchools($updatedSchools);

            $mockUsersFile = __DIR__ . '/../../../../mock_users.json';
            if (file_exists($mockUsersFile)) {
                $mockUsers = json_decode(file_get_contents($mockUsersFile), true) ?: [];
                $updatedUsers = [];
                foreach ($mockUsers as $u) {
                    if (strval($u['school_id'] ?? '') !== strval($id)) {
                        $updatedUsers[] = $u;
                    }
                }
                file_put_contents($mockUsersFile, json_encode($updatedUsers, JSON_PRETTY_PRINT));
            }

            return ['message' => 'School deleted successfully.'];
        }

        $stmt = $pdo->prepare("DELETE FROM schools WHERE id = :id");
        $stmt->execute(['id' => $id]);

        $this->logAudit($pdo, null, $performedBy, 'Delete School', "Removed school ID $id and all its tenant datasets.");

        return ['message' => 'School deleted successfully.'];
    }

    public function getSchoolDetails(int $id): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schools = $this->getMockSchools();
            $school = null;
            foreach ($schools as $s) {
                if (strval($s['id']) === strval($id)) {
                    $school = $s;
                    break;
                }
            }

            if (!$school) {
                throw new \Exception('School not found.', 404);
            }

            return [
                'school' => $school,
                'subscription_history' => [
                    [
                        'id' => 1,
                        'action' => 'Trial Activated',
                        'performed_by' => 'System',
                        'school_name' => $school['name'],
                        'plan_name' => 'Free Trial',
                        'created_at' => $school['subscription_start'] . ' 10:00:00'
                    ]
                ],
                'billing_history' => [
                    [
                        'id' => 1,
                        'type' => 'Subscription',
                        'amount' => 0.00,
                        'status' => 'Paid',
                        'description' => 'Free Trial Onboarding',
                        'date' => $school['subscription_start']
                    ]
                ],
                'audit_logs' => [
                    [
                        'id' => 1,
                        'operator' => 'System',
                        'action' => 'School Provisioned',
                        'timestamp' => $school['subscription_start'] . ' 10:00:00',
                        'details' => 'School database schema created successfully.'
                    ]
                ],
                'students_count' => 120,
                'classes_count' => 6,
                'teachers_count' => 12,
                'students' => [
                    ['id' => 1, 'name' => 'Mock Student A', 'roll_number' => '101', 'status' => 'Active'],
                    ['id' => 2, 'name' => 'Mock Student B', 'roll_number' => '102', 'status' => 'Active']
                ],
                'classes' => [
                    ['id' => 1, 'name' => 'Grade 1', 'room' => '101'],
                    ['id' => 2, 'name' => 'Grade 2', 'room' => '102']
                ],
                'teachers' => [
                    ['id' => 1, 'name' => 'Mock Teacher A', 'subject' => 'Mathematics', 'status' => 'Active'],
                    ['id' => 2, 'name' => 'Mock Teacher B', 'subject' => 'Science', 'status' => 'Active']
                ]
            ];
        }

        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $school = $stmt->fetch();
        if (!$school) {
            throw new \Exception('School not found.', 404);
        }

        $today = new DateTime();
        $end = new DateTime($school['subscription_end']);
        $interval = $today->diff($end);
        $school['days_remaining'] = $end >= $today ? (int)$interval->format('%r%a') : 0;

        $subLogsStmt = $pdo->prepare("SELECT * FROM subscription_audit_logs WHERE school_name = :name ORDER BY id DESC");
        $subLogsStmt->execute(['name' => $school['name']]);
        $subHistory = $subLogsStmt->fetchAll();

        if (empty($subHistory)) {
            $subHistory = [
                [
                    'id' => 0,
                    'action' => 'Plan Activated',
                    'performed_by' => 'System',
                    'school_name' => $school['name'],
                    'plan_name' => 'Onboarding Plan',
                    'created_at' => $school['subscription_start'] . ' 10:00:00'
                ]
            ];
        }

        $billingHistory = [];
        $idx = 1;
        foreach ($subHistory as $sh) {
            $planPriceStmt = $pdo->prepare("SELECT price FROM subscription_plans WHERE name = :name LIMIT 1");
            $planPriceStmt->execute(['name' => $sh['plan_name']]);
            $price = $planPriceStmt->fetchColumn();
            if ($price === false) {
                $price = ($sh['plan_name'] === 'Free Trial' ? 0.00 : 999.00);
            }

            $billingHistory[] = [
                'id' => $idx++,
                'type' => 'Subscription',
                'amount' => (float)$price,
                'status' => 'Paid',
                'description' => "Subscription: " . $sh['plan_name'] . " (" . $sh['action'] . ")",
                'date' => date('Y-m-d', strtotime($sh['created_at']))
            ];
        }

        $auditStmt = $pdo->prepare("SELECT * FROM audit_logs WHERE school_id = :school_id ORDER BY id DESC LIMIT 50");
        $auditStmt->execute(['school_id' => $id]);
        $auditLogs = $auditStmt->fetchAll();

        $studCount = (int)$pdo->query("SELECT COUNT(*) FROM students WHERE school_id = $id")->fetchColumn();
        $classCount = (int)$pdo->query("SELECT COUNT(*) FROM classrooms WHERE school_id = $id")->fetchColumn();
        $teachCount = (int)$pdo->query("SELECT COUNT(*) FROM teachers WHERE school_id = $id")->fetchColumn();

        $studStmt = $pdo->prepare("SELECT * FROM students WHERE school_id = :school_id ORDER BY name ASC");
        $studStmt->execute(['school_id' => $id]);
        $students = $studStmt->fetchAll();

        $classStmt = $pdo->prepare("SELECT * FROM classrooms WHERE school_id = :school_id ORDER BY name ASC");
        $classStmt->execute(['school_id' => $id]);
        $classes = $classStmt->fetchAll();

        $teachStmt = $pdo->prepare("SELECT * FROM teachers WHERE school_id = :school_id ORDER BY name ASC");
        $teachStmt->execute(['school_id' => $id]);
        $teachers = $teachStmt->fetchAll();

        return [
            'school' => $school,
            'subscription_history' => $subHistory,
            'billing_history' => $billingHistory,
            'audit_logs' => $auditLogs,
            'students_count' => $studCount,
            'classes_count' => $classCount,
            'teachers_count' => $teachCount,
            'students' => $students,
            'classes' => $classes,
            'teachers' => $teachers
        ];
    }

    public function getStudentFees(int $schoolId, int $studentId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $studStmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id AND school_id = :school_id");
        $studStmt->execute(['id' => $studentId, 'school_id' => $schoolId]);
        $student = $studStmt->fetch();
        $classId = $student ? $student['class_id'] : 0;

        $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_active = 1 LIMIT 1");
        $ayStmt->execute(['school_id' => $schoolId]);
        $ay_id = $ayStmt->fetchColumn() ?: 0;

        $isConfigured = false;
        if ($classId) {
            $cfStmt = $pdo->prepare("SELECT COUNT(*) FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
            $cfStmt->execute([
                'school_id' => $schoolId,
                'ay_id' => $ay_id,
                'class_id' => $classId
            ]);
            $isConfigured = ($cfStmt->fetchColumn() > 0);
        }

        $stmt = $pdo->prepare("SELECT * FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
        $stmt->execute(['student_id' => $studentId, 'ay_id' => $ay_id, 'school_id' => $schoolId]);
        $records = $stmt->fetchAll();

        if (!$isConfigured) {
            foreach ($records as &$rec) {
                if ($rec['status'] === 'Pending') {
                    $rec['amount'] = 0.00;
                }
            }
        }

        return $records;
    }

    public function getTeacherSalary(int $schoolId, int $teacherId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return [];
        }

        $ayStmt = $pdo->prepare("SELECT id FROM academic_years WHERE school_id = :school_id AND is_active = 1 LIMIT 1");
        $ayStmt->execute(['school_id' => $schoolId]);
        $ay_id = $ayStmt->fetchColumn() ?: 0;

        $stmt = $pdo->prepare("SELECT * FROM salary_records WHERE teacher_id = :teacher_id AND academic_year_id = :ay_id AND school_id = :school_id ORDER BY id ASC");
        $stmt->execute(['teacher_id' => $teacherId, 'ay_id' => $ay_id, 'school_id' => $schoolId]);
        return $stmt->fetchAll();
    }

    // --- Private Helper Methods ---

    private function getDbFallback(): ?PDO
    {
        return null;
    }

    private function logAudit(PDO $pdo, ?int $schoolId, string $username, string $action, string $details): void
    {
        try {
            $stmt = $pdo->prepare("INSERT INTO audit_logs (school_id, username, action, details) VALUES (:school_id, :username, :action, :details)");
            $stmt->execute([
                'school_id' => $schoolId,
                'username' => $username,
                'action' => $action,
                'details' => $details
            ]);
        } catch (\Exception $e) {}
    }

    private function getMockSchools(): array
    {
        $file = __DIR__ . '/../../../../mock_schools.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockSchools(array $schools): void
    {
        $file = __DIR__ . '/../../../../mock_schools.json';
        file_put_contents($file, json_encode($schools, JSON_PRETTY_PRINT));
    }

    private function generateSecurePassword(): string
    {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
        $pass = '';
        for ($i = 0; $i < 10; $i++) {
            $pass .= $chars[rand(0, strlen($chars) - 1)];
        }
        return $pass;
    }

    private function sendCredentialsEmail(string $toEmail, string $schoolName, string $plainPassword): void
    {
        $logMessage = "[" . date('Y-m-d H:i:s') . "] Onboarding Email sent to $toEmail. Password: $plainPassword\n";
        file_put_contents(__DIR__ . '/../../../../sent_emails.log', $logMessage, FILE_APPEND);
    }
}
