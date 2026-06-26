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
        return $this->schools->findAll([], 'id DESC');
    }

    public function createSchool(array $data, array $actor): array
    {
        Validator::make($data, [
            'name'      => 'required',
            'subdomain' => 'required',
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
            'contact_email' => $data['contact_email'] ?? '',
        ]);

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

        $newSubdomain = strtolower($data['subdomain'] ?? $school['subdomain']);
        $newStatus    = $data['status']        ?? $school['status'];
        $newName      = $data['name']          ?? $school['name'];

        $this->schools->update($id, [
            'name'          => $newName,
            'subdomain'     => $newSubdomain,
            'plan'          => $data['plan']          ?? $school['plan'],
            'status'        => $newStatus,
            'contact_phone' => $data['contact_phone'] ?? $school['contact_phone'],
            'contact_email' => $data['contact_email'] ?? $school['contact_email'],
            'portal_theme'  => $data['portal_theme']  ?? $school['portal_theme'] ?? 'default',
        ]);

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
        $totalSchools     = $this->schools->count();
        $activeSchools    = $this->schools->countByStatus('ACTIVE');
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

        $pdo = $this->schools->getPdo();

        $roleStmt = $pdo->query(
            "SELECT role, COUNT(*) AS count FROM users GROUP BY role"
        );
        $roleCounts = [];
        foreach ($roleStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $roleCounts[$row['role']] = (int) $row['count'];
        }

        return [
            'schools_count'     => $totalSchools,
            'active_schools'    => $activeSchools,
            'suspended_schools' => $suspendedSchools,
            'billing_mrr'       => $mrr,
            'total_students'    => $roleCounts['STUDENT']      ?? 0,
            'total_teachers'    => $roleCounts['TEACHER']      ?? 0,
            'total_admins'      => $roleCounts['SCHOOL_ADMIN'] ?? 0,
            'total_users'       => array_sum($roleCounts),
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
}
