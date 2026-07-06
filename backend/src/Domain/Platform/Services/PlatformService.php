<?php

declare(strict_types=1);

namespace App\Domain\Platform\Services;

use App\Domain\Auth\Repositories\AuthRepository;
use App\Domain\Platform\Repositories\AuditLogRepository;
use App\Domain\Platform\Repositories\PlansRepository;
use App\Domain\Platform\Repositories\SchoolRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Validation\Validator;
use PDO;
use Psr\Log\LoggerInterface;

class PlatformService extends BaseService
{
    public function __construct(
        private SchoolRepository   $schools,
        private AuditLogRepository $auditLogs,
        private AuthRepository     $users,
        private PlansRepository    $plans,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    private function actorInfo(array $actor): array
    {
        $name = $actor['name'] ?? null;
        $role = $actor['role'] ?? null;

        if (!$name && !empty($actor['id'])) {
            $user = $this->users->findById((int) $actor['id']);
            if ($user) {
                $name = $user['name'] ?? null;
                $role = $role ?? $user['role'] ?? null;
            }
        }

        return [
            'name' => $name ?? $actor['phone'] ?? $actor['email'] ?? 'system',
            'role' => $role,
        ];
    }

    // -------------------------------------------------------------------------
    // Schools
    // -------------------------------------------------------------------------

    public function getSchools(): array
    {
        $schools = $this->schools->findAll([], 'id DESC');
        $pdo = $this->schools->getPdo();
        $today = date('Y-m-d');

        foreach ($schools as &$school) {
            $stmt = $pdo->prepare("
                SELECT plan_name, start_date, expiry_date, duration_value, duration_unit 
                FROM subscriptions 
                WHERE school_id = :school_id AND status = 'PAID'
                ORDER BY expiry_date DESC, id DESC
                LIMIT 1
            ");
            $stmt->execute([':school_id' => $school['id']]);
            $sub = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($sub && $today <= $sub['expiry_date'] && $school['status'] === 'ACTIVE') {
                $school['active_plan'] = $sub['plan_name'];
                $school['subscription_expiry'] = $sub['expiry_date'];
                $school['subscription_start'] = $sub['start_date'];
                $school['subscription_duration_value'] = $sub['duration_value'];
                $school['subscription_duration_unit'] = $sub['duration_unit'];
            } else {
                $school['active_plan'] = null; // No Active Subscription
                $school['subscription_expiry'] = null;
                $school['subscription_start'] = null;
                $school['subscription_duration_value'] = null;
                $school['subscription_duration_unit'] = null;
            }
        }

        return $schools;
    }

    private function addSubscriptionForSchool(PDO $pdo, int $schoolId, string $planName, string $type = 'new'): void
    {
        $stmtPlan = $pdo->prepare("SELECT price, duration_value, duration_unit FROM plans WHERE name = :name LIMIT 1");
        $stmtPlan->execute([':name' => $planName]);
        $plan = $stmtPlan->fetch(PDO::FETCH_ASSOC);

        $price = 0;
        $durationValue = 12;
        $durationUnit = 'month';

        if ($plan) {
            $price = (int)$plan['price'];
            $durationValue = (int)($plan['duration_value'] ?? 12);
            $durationUnit = $plan['duration_unit'] ?? 'month';
        } else {
            if ($planName === 'Trial' || str_contains(strtolower($planName), 'trial')) {
                $price = 0;
                $durationValue = 1;
                $durationUnit = 'month';
            } elseif ($planName === 'Standard') {
                $price = 7999;
                $durationValue = 1;
                $durationUnit = 'month';
            } elseif ($planName === 'Premium') {
                $price = 19999;
                $durationValue = 1;
                $durationUnit = 'month';
            } elseif ($planName === 'Enterprise') {
                $price = 39999;
                $durationValue = 12;
                $durationUnit = 'month';
            }
        }

        $startDate = date('Y-m-d');
        if ($durationUnit === 'year') {
            $expiryDate = date('Y-m-d', strtotime("+$durationValue years"));
        } else {
            $expiryDate = date('Y-m-d', strtotime("+$durationValue months"));
        }

        $invoiceNo = 'INV-' . time() . '-' . rand(100, 999);

        $stmtIns = $pdo->prepare("
            INSERT INTO subscriptions (school_id, invoice_no, amount, billing_cycle, status, plan_name, duration_value, duration_unit, start_date, expiry_date, type)
            VALUES (:school_id, :invoice_no, :amount, :billing_cycle, 'PAID', :plan_name, :duration_value, :duration_unit, :start_date, :expiry_date, :type)
        ");
        $stmtIns->execute([
            ':school_id' => $schoolId,
            ':invoice_no' => $invoiceNo,
            ':amount' => $price,
            ':billing_cycle' => $durationValue . ' ' . ucfirst($durationUnit) . ($durationValue > 1 ? 's' : ''),
            ':plan_name' => $planName,
            ':duration_value' => $durationValue,
            ':duration_unit' => $durationUnit,
            ':start_date' => $startDate,
            ':expiry_date' => $expiryDate,
            ':type' => $type
        ]);
    }

    public function createSchool(array $data, array $actor): array
    {
        $data['contact_email'] = isset($data['contact_email']) ? trim((string)$data['contact_email']) : '';

        Validator::make($data, [
            'name'          => 'required',
            'subdomain'     => 'required',
            'contact_email' => 'required|email',
        ])->validate();

        $subdomain = strtolower((string) $data['subdomain']);

        if ($this->schools->findBySubdomain($subdomain) !== null) {
            throw new \App\Shared\Exceptions\ValidationException(
                ['subdomain' => 'Subdomain prefix already registered.'],
                'Subdomain prefix already registered.',
            );
        }

        $schoolId = $this->schools->create([
            'name'          => $data['name'],
            'subdomain'     => $subdomain,
            'plan'          => $data['plan'] ?? 'Premium',
            'status'        => 'ACTIVE',
            'contact_phone' => $data['contact_phone'] ?? '',
            'contact_email' => $data['contact_email'],
        ]);

        $pdo = $this->schools->getPdo();
        $this->addSubscriptionForSchool($pdo, $schoolId, $data['plan'] ?? 'Premium', 'new');

        // Create school admin user if credentials provided
        if (!empty($data['admin_phone'])) {
            $this->users->createUser([
                'phone'                 => (string) $data['admin_phone'],
                'password'              => (string) ($data['admin_password'] ?? 'changeme123'),
                'name'                  => (string) ($data['name'] . ' Admin'),
                'role'                  => 'SCHOOL_ADMIN',
                'status'                => 'ACTIVE',
                'school_id'             => $schoolId,
                'force_password_change' => 1,
            ]);
        }

        $actorInfo = $this->actorInfo($actor);
        $this->auditLogs->log(
            'Create school',
            (string) $data['name'],
            $actorInfo['name'],
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
            $actorInfo['role'],
        );

        $school = $this->schools->findById($schoolId);

        if ($school === null) {
            throw new \RuntimeException('Failed to retrieve created school.');
        }

        return $school;
    }

    public function inviteSchool(array $data, array $actor): array
    {
        // Normalise: inviteSchool uses 'school_name' in the request body.
        if (!isset($data['name']) && isset($data['school_name'])) {
            $data['name'] = $data['school_name'];
        }

        return $this->createSchool($data, $actor);
    }

    public function updateSchool(int $id, array $data, array $actor): array
    {
        $school = $this->schools->findById($id);

        if ($school === null) {
            throw new NotFoundException('School tenant not found.');
        }

        if (isset($data['contact_email'])) {
            $data['contact_email'] = trim((string) $data['contact_email']);
            Validator::make($data, [
                'contact_email' => 'required|email',
            ])->validate();
        }

        $newSubdomain = strtolower($data['subdomain'] ?? $school['subdomain']);
        $newStatus    = $data['status']        ?? $school['status'];
        $newName      = $data['name']          ?? $school['name'];
        $planChanged  = isset($data['plan']) && $data['plan'] !== $school['plan'];

        $this->schools->update($id, [
            'name'          => $newName,
            'subdomain'     => $newSubdomain,
            'plan'          => $data['plan']          ?? $school['plan'],
            'status'        => $newStatus,
            'contact_phone' => $data['contact_phone'] ?? $school['contact_phone'],
            'contact_email' => $data['contact_email'] ?? $school['contact_email'],
            'portal_theme'  => $data['portal_theme']  ?? $school['portal_theme'] ?? 'default',
        ]);

        if (isset($data['plan'])) {
            $pdo = $this->schools->getPdo();
            
            // Check if there is an active subscription for this school with the selected plan
            $today = date('Y-m-d');
            $stmt = $pdo->prepare("
                SELECT COUNT(*) 
                FROM subscriptions 
                WHERE school_id = :school_id AND plan_name = :plan_name AND status = 'PAID' AND expiry_date >= :today
            ");
            $stmt->execute([':school_id' => $id, ':plan_name' => $data['plan'], ':today' => $today]);
            $hasActiveSub = (int)$stmt->fetchColumn() > 0;
            
            if (!$hasActiveSub || $planChanged) {
                $type = $planChanged ? 'upgrade' : 'new';
                $this->addSubscriptionForSchool($pdo, $id, $data['plan'], $type);
            }
        }

        $action = ($school['status'] !== $newStatus)
            ? "Update school status to {$newStatus}"
            : 'Update school details';

        $actorInfo = $this->actorInfo($actor);
        $this->auditLogs->log(
            $action,
            $newName,
            $actorInfo['name'],
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
            $actorInfo['role'],
        );

        $updated = $this->schools->findById($id);

        if ($updated === null) {
            throw new \RuntimeException('Failed to retrieve updated school.');
        }

        return $updated;
    }

    public function deleteSchool(int $id, array $actor): void
    {
        $school = $this->schools->findById($id);

        if ($school === null) {
            throw new NotFoundException('School tenant not found.');
        }

        $pdo = $this->schools->getPdo();

        // Check subscriptions count
        $stmtSub = $pdo->prepare("SELECT COUNT(*) FROM subscriptions WHERE school_id = :school_id");
        $stmtSub->execute([':school_id' => $id]);
        $subCount = (int)$stmtSub->fetchColumn();

        if ($school['status'] === 'ACTIVE' && $subCount > 0) {
            throw new \App\Shared\Exceptions\ValidationException([
                'delete' => 'Cannot delete an active school that has subscription history. Please suspend the school first.'
            ]);
        }

        $this->schools->delete($id);

        $actorInfo = $this->actorInfo($actor);
        $this->auditLogs->log(
            'Delete school tenant',
            (string) $school['name'],
            $actorInfo['name'],
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
            $actorInfo['role'],
        );
    }

    // -------------------------------------------------------------------------
    // Platform Admins (SUPER_ADMIN users)
    // -------------------------------------------------------------------------

    public function getAdmins(): array
    {
        $pdo  = $this->schools->getPdo();
        $stmt = $pdo->prepare(
            "SELECT id, name, phone, role, status, created_at FROM users WHERE role = 'SUPER_ADMIN' ORDER BY id ASC"
        );
        $stmt->execute();
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function createAdmin(array $data, array $actor): array
    {
        Validator::make($data, [
            'name'     => 'required',
            'phone'    => 'required|numeric',
            'password' => 'required|min:6',
        ])->validate();

        if ($this->users->findByPhone((string) $data['phone']) !== null) {
            throw new \App\Shared\Exceptions\ValidationException(
                ['phone' => 'Phone number already registered.'],
                'Phone number already registered.',
            );
        }

        $id = $this->users->createUser([
            'name'                  => (string) $data['name'],
            'phone'                 => (string) $data['phone'],
            'password'              => (string) $data['password'],
            'role'                  => 'SUPER_ADMIN',
            'status'                => 'ACTIVE',
            'force_password_change' => 0,
        ]);

        $actorInfo = $this->actorInfo($actor);
        $this->auditLogs->log(
            'Create admin user',
            (string) $data['name'],
            $actorInfo['name'],
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
            $actorInfo['role'],
        );

        $admin = $this->users->findById($id);
        unset($admin['password']);
        return $admin;
    }

    // -------------------------------------------------------------------------
    // Plans
    // -------------------------------------------------------------------------

    public function getPlans(): array
    {
        return $this->plans->allActive();
    }

    public function createPlan(array $data): array
    {
        Validator::make($data, [
            'name'  => 'required',
            'price' => 'required|numeric',
        ])->validate();

        $type = $data['type'] ?? 'custom';

        $id = $this->plans->create([
            'name'           => (string) $data['name'],
            'price'          => (int) $data['price'],
            'student_limit'  => isset($data['student_limit']) && $data['student_limit'] !== '' ? (int) $data['student_limit'] : null,
            'description'    => $data['description'] ?? null,
            'type'           => in_array($type, ['standard', 'trial', 'custom']) ? $type : 'custom',
            'trial_duration' => isset($data['trial_duration']) ? (int) $data['trial_duration'] : null,
            'trial_unit'     => $data['trial_unit'] ?? null,
            'is_active'      => 1,
        ]);

        return $this->plans->findById($id);
    }

    public function updatePlan(int $id, array $data): array
    {
        $plan = $this->plans->findById($id);
        if ($plan === null) {
            throw new NotFoundException('Plan not found.');
        }

        $this->plans->update($id, [
            'name'          => $data['name']          ?? $plan['name'],
            'price'         => isset($data['price']) ? (int) $data['price'] : $plan['price'],
            'student_limit' => array_key_exists('student_limit', $data)
                ? ($data['student_limit'] !== '' && $data['student_limit'] !== null ? (int) $data['student_limit'] : null)
                : $plan['student_limit'],
            'description'   => $data['description']  ?? $plan['description'],
        ]);

        return $this->plans->findById($id);
    }

    // -------------------------------------------------------------------------
    // Subscriptions
    // -------------------------------------------------------------------------

    public function getSubscriptions(): array
    {
        $pdo  = $this->auditLogs->getPdo();
        $stmt = $pdo->query("
            SELECT s.*, sch.name AS school_name, sch.plan AS plan
            FROM subscriptions s
            JOIN schools sch ON s.school_id = sch.id
            ORDER BY s.id DESC
        ");

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // -------------------------------------------------------------------------
    // Audit logs
    // -------------------------------------------------------------------------

    public function getAuditLogs(): array
    {
        return $this->auditLogs->recent(50);
    }

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------

    public function getStats(): array
    {
        $pdo = $this->schools->getPdo();
        $today = date('Y-m-d');

        // 1. Fetch schools with active subscription
        $stmtActiveSubs = $pdo->prepare("
            SELECT DISTINCT school_id 
            FROM subscriptions 
            WHERE status = 'PAID' AND start_date <= :today AND expiry_date >= :today
        ");
        $stmtActiveSubs->execute([':today' => $today]);
        $activeSubSchoolIds = $stmtActiveSubs->fetchAll(PDO::FETCH_COLUMN);

        $activeSchoolsWithSub = [];
        if (!empty($activeSubSchoolIds)) {
            $idsStr = implode(',', array_map('intval', $activeSubSchoolIds));
            $stmtFilteredSchools = $pdo->query("
                SELECT id 
                FROM schools 
                WHERE status = 'ACTIVE' AND id IN ($idsStr)
            ");
            $activeSchoolsWithSub = $stmtFilteredSchools->fetchAll(PDO::FETCH_COLUMN);
        }
        $totalActiveSchoolsCount = count($activeSchoolsWithSub);

        // 2. Count Active Teachers across Active schools with active subscription
        $totalTeachers = 0;
        if (!empty($activeSchoolsWithSub)) {
            $schoolIdsStr = implode(',', array_map('intval', $activeSchoolsWithSub));
            $stmtTeachers = $pdo->query("
                SELECT COUNT(*) 
                FROM users 
                WHERE role = 'TEACHER' AND status = 'ACTIVE' AND school_id IN ($schoolIdsStr)
            ");
            $totalTeachers = (int)$stmtTeachers->fetchColumn();
        }

        // 3. Count Active Students across Active schools with active subscription
        $totalStudents = 0;
        if (!empty($activeSchoolsWithSub)) {
            $schoolIdsStr = implode(',', array_map('intval', $activeSchoolsWithSub));
            $stmtStudents = $pdo->query("
                SELECT COUNT(*) 
                FROM users 
                WHERE role = 'STUDENT' AND status = 'ACTIVE' AND school_id IN ($schoolIdsStr)
            ");
            $totalStudents = (int)$stmtStudents->fetchColumn();
        }

        // 4. Calculate Financial Year Revenue (1 April to 31 March)
        $currentMonth = (int)date('m');
        $currentYear = (int)date('Y');

        if ($currentMonth >= 4) {
            $fyStart = "$currentYear-04-01";
            $fyEnd = ($currentYear + 1) . "-03-31";
        } else {
            $fyStart = ($currentYear - 1) . "-04-01";
            $fyEnd = "$currentYear-03-31";
        }

        $stmtRev = $pdo->prepare("
            SELECT COALESCE(SUM(amount), 0) 
            FROM subscriptions 
            WHERE status = 'PAID' AND created_at >= :fy_start AND created_at <= :fy_end
        ");
        $stmtRev->execute([
            ':fy_start' => $fyStart . ' 00:00:00',
            ':fy_end' => $fyEnd . ' 23:59:59'
        ]);
        $totalRevenue = (float)$stmtRev->fetchColumn();

        $totalSchools = $this->schools->count();
        $suspendedSchools = $this->schools->countByStatus('SUSPENDED');

        $planCounts  = $this->schools->countByPlan();
        $allPlans    = $this->plans->allActive();
        $priceByName = [];
        foreach ($allPlans as $p) {
            $priceByName[$p['name']] = (int) $p['price'];
        }
        $mrr = 0;
        foreach ($planCounts as $row) {
            $price = $priceByName[$row['plan']] ?? 0;
            $mrr  += $price * (int) $row['count'];
        }

        return [
            'schools_count'     => $totalSchools,
            'active_schools'    => $totalActiveSchoolsCount,
            'suspended_schools' => $suspendedSchools,
            'billing_mrr'       => $mrr,
            'total_students'    => $totalStudents,
            'total_teachers'    => $totalTeachers,
            'total_revenue'     => $totalRevenue,
        ];
    }

    public function getGrowthChart(): array
    {
        $pdo  = $this->schools->getPdo();
        $stmt = $pdo->query(
            "SELECT DATE_FORMAT(created_at, '%b') AS month,
                    DATE_FORMAT(created_at, '%Y-%m') AS month_key,
                    COUNT(*) AS count
               FROM schools
              WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
              GROUP BY month_key, month
              ORDER BY month_key ASC
              LIMIT 6"
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fill in the last 6 months in order, with 0 for missing months
        $result = [];
        for ($i = 5; $i >= 0; $i--) {
            $key   = date('Y-m', strtotime("-{$i} months"));
            $label = date('M', strtotime("-{$i} months"));
            $found = array_filter($rows, fn($r) => $r['month_key'] === $key);
            $result[] = [
                'month' => $label,
                'count' => $found ? (int) array_values($found)[0]['count'] : 0,
            ];
        }

        return $result;
    }

    public function getSchoolStats(int $id): array
    {
        $school = $this->schools->findById($id);
        if ($school === null) {
            throw new \App\Shared\Exceptions\NotFoundException('School not found.');
        }

        $pdo  = $this->schools->getPdo();
        $stmt = $pdo->prepare(
            "SELECT role, COUNT(*) AS count FROM users WHERE school_id = :id GROUP BY role"
        );
        $stmt->execute(['id' => $id]);

        $counts = ['STUDENT' => 0, 'TEACHER' => 0, 'SCHOOL_ADMIN' => 0];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['role']] = (int) $row['count'];
        }

        return [
            'students'     => $counts['STUDENT'],
            'teachers'     => $counts['TEACHER'],
            'school_admins' => $counts['SCHOOL_ADMIN'],
            'total_staff'  => $counts['TEACHER'] + $counts['SCHOOL_ADMIN'],
            'plan'         => $school['plan'],
            'status'       => $school['status'],
        ];
    }

    public function getSchoolTeachers(int $schoolId): array
    {
        $pdo = $this->schools->getPdo();
        $stmt = $pdo->prepare("
            SELECT * 
            FROM staff 
            WHERE school_id = :school_id
            ORDER BY id DESC
        ");
        $stmt->execute([':school_id' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSchoolStudents(int $schoolId): array
    {
        $pdo = $this->schools->getPdo();
        $stmt = $pdo->prepare("
            SELECT s.*, c.name AS class_name, c.section, ay.name AS academic_year_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.school_id = :school_id
            ORDER BY s.id DESC
        ");
        $stmt->execute([':school_id' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSchoolSubscriptions(int $schoolId): array
    {
        $pdo = $this->schools->getPdo();
        $stmt = $pdo->prepare("
            SELECT * 
            FROM subscriptions 
            WHERE school_id = :school_id
            ORDER BY expiry_date DESC, id DESC
        ");
        $stmt->execute([':school_id' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function deletePlan(int $id): void
    {
        $plan = $this->plans->findById($id);
        if ($plan === null) {
            throw new NotFoundException('Plan not found.');
        }
        $this->plans->delete($id);
    }

    public function getSchoolAcademicYears(int $schoolId): array
    {
        $pdo = $this->schools->getPdo();
        $stmt = $pdo->prepare("
            SELECT * 
            FROM academic_years 
            WHERE school_id = :school_id
            ORDER BY start_date DESC
        ");
        $stmt->execute([':school_id' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSchoolClasses(int $schoolId): array
    {
        $pdo = $this->schools->getPdo();
        $stmt = $pdo->prepare("
            SELECT c.*, ay.name AS academic_year_name, ay.status AS academic_year_status,
                   (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS students_count
            FROM classes c
            LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE c.school_id = :school_id
            ORDER BY c.name ASC, c.section ASC
        ");
        $stmt->execute([':school_id' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
