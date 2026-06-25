<?php

declare(strict_types=1);

namespace App\Domain\Platform\Services;

use App\Domain\Auth\Repositories\AuthRepository;
use App\Domain\Platform\Repositories\AuditLogRepository;
use App\Domain\Platform\Repositories\SchoolRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Validation\Validator;
use PDO;
use Psr\Log\LoggerInterface;

class PlatformService extends BaseService
{
    private const PLAN_PRICES = [
        'Standard'   => 7999,
        'Premium'    => 19999,
        'Enterprise' => 39999,
    ];

    public function __construct(
        private SchoolRepository   $schools,
        private AuditLogRepository $auditLogs,
        private AuthRepository     $users,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
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

        $this->auditLogs->log(
            'Create school',
            (string) $data['name'],
            (string) ($actor['name'] ?? $actor['email'] ?? 'system'),
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
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
        ]);

        $action = ($school['status'] !== $newStatus)
            ? "Update school status to {$newStatus}"
            : 'Update school details';

        $this->auditLogs->log(
            $action,
            $newName,
            (string) ($actor['name'] ?? $actor['email'] ?? 'system'),
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
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

        $this->auditLogs->log(
            'Delete school tenant',
            (string) $school['name'],
            (string) ($actor['name'] ?? $actor['email'] ?? 'system'),
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
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

        $this->auditLogs->log(
            'Create admin user',
            (string) $data['name'],
            (string) ($actor['name'] ?? 'system'),
            (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'),
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
        return array_map(
            static fn(string $id, int $price) => ['id' => $id, 'name' => $id, 'price' => $price],
            array_keys(self::PLAN_PRICES),
            self::PLAN_PRICES,
        );
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

        $planCounts = $this->schools->countByPlan();
        $mrr        = 0;

        foreach ($planCounts as $row) {
            $price = self::PLAN_PRICES[$row['plan']] ?? self::PLAN_PRICES['Premium'];
            $mrr  += $price * (int) $row['count'];
        }

        $pdo        = $this->schools->getPdo();
        $stmt       = $pdo->query("SELECT COUNT(*) AS count FROM users");
        $usersCount = (int) $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        return [
            'schools_count'    => $totalSchools,
            'active_schools'   => $activeSchools,
            'suspended_schools' => $suspendedSchools,
            'billing_mrr'      => $mrr,
            'total_users'      => ($activeSchools * 1250) + $usersCount,
        ];
    }
}
