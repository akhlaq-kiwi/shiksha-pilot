<?php

declare(strict_types=1);

namespace App\Domain\Platform\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Database\Connection;
use PDO;

class PlatformController
{
    public function __construct(private Connection $db) {}

    private function authenticate(Request $request): ?array
    {
        $authHeader = $request->getHeaderLine('Authorization');
        if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return null;
        }

        $token = $matches[1];
        $data = json_decode(base64_decode($token), true);
        if (!$data || !isset($data['user_id'])) {
            return null;
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $data['user_id']]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    private function logAction(string $action, ?string $targetSchool, string $user): void
    {
        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (action, target_school, user, ip_address)
            VALUES (:action, :target, :user, :ip)
        ");
        $stmt->execute([
            'action' => $action,
            'target' => $targetSchool,
            'user' => $user,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);
    }

    public function getSchools(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->query("SELECT * FROM schools ORDER BY id DESC");
        $schools = $stmt->fetchAll();

        $response->getBody()->write(json_encode($schools));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createSchool(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $body = $request->getParsedBody();
        $name = $body['name'] ?? null;
        $subdomain = $body['subdomain'] ?? null;
        $plan = $body['plan'] ?? 'Premium';
        $contactPhone = $body['contact_phone'] ?? '';
        $contactEmail = $body['contact_email'] ?? '';

        if (!$name || !$subdomain) {
            $response->getBody()->write(json_encode(['error' => 'School name and subdomain prefix are required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $subdomain = strtolower($subdomain);

        $pdo = $this->db->getPdo();
        
        // Check if subdomain exists
        $stmt = $pdo->prepare("SELECT id FROM schools WHERE subdomain = :subdomain LIMIT 1");
        $stmt->execute(['subdomain' => $subdomain]);
        if ($stmt->fetch()) {
            $response->getBody()->write(json_encode(['error' => 'Subdomain prefix already registered']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO schools (name, subdomain, plan, status, contact_phone, contact_email)
            VALUES (:name, :subdomain, :plan, 'ACTIVE', :phone, :email)
        ");
        $stmt->execute([
            'name' => $name,
            'subdomain' => $subdomain,
            'plan' => $plan,
            'phone' => $contactPhone,
            'email' => $contactEmail
        ]);

        $schoolId = (int)$pdo->lastInsertId();
        
        // Log action
        $this->logAction("Provision school tenant", $name, $user['name']);

        // Fetch created school
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $schoolId]);
        $school = $stmt->fetch();

        $response->getBody()->write(json_encode($school));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(210); // Or 201
    }

    public function inviteSchool(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $body = $request->getParsedBody();
        $schoolName = $body['school_name'] ?? null;
        $subdomain = $body['subdomain'] ?? null;
        $plan = $body['plan'] ?? 'Premium';
        $contactPhone = $body['contact_phone'] ?? '';
        $contactEmail = $body['contact_email'] ?? '';

        if (!$schoolName || !$subdomain) {
            $response->getBody()->write(json_encode(['error' => 'School name and subdomain prefix are required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $subdomain = strtolower($subdomain);

        $pdo = $this->db->getPdo();

        // Check if subdomain exists
        $stmt = $pdo->prepare("SELECT id FROM schools WHERE subdomain = :subdomain LIMIT 1");
        $stmt->execute(['subdomain' => $subdomain]);
        if ($stmt->fetch()) {
            $response->getBody()->write(json_encode(['error' => 'Subdomain prefix already registered']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $stmt = $pdo->prepare("
            INSERT INTO schools (name, subdomain, plan, status, contact_phone, contact_email)
            VALUES (:name, :subdomain, :plan, 'ACTIVE', :phone, :email)
        ");
        $stmt->execute([
            'name' => $schoolName,
            'subdomain' => $subdomain,
            'plan' => $plan,
            'phone' => $contactPhone,
            'email' => $contactEmail
        ]);

        $schoolId = (int)$pdo->lastInsertId();

        // Log action
        $this->logAction("Provision school tenant", $schoolName, $user['name']);

        // Fetch created school
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $schoolId]);
        $school = $stmt->fetch();

        $response->getBody()->write(json_encode($school));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function updateSchool(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            $response->getBody()->write(json_encode(['error' => 'School ID is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $body = $request->getParsedBody();
        $name = $body['name'] ?? null;
        $subdomain = $body['subdomain'] ?? null;
        $plan = $body['plan'] ?? null;
        $status = $body['status'] ?? null;
        $contactPhone = $body['contact_phone'] ?? null;
        $contactEmail = $body['contact_email'] ?? null;

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $school = $stmt->fetch();

        if (!$school) {
            $response->getBody()->write(json_encode(['error' => 'School tenant not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        // Update fields if provided
        $updateName = $name ?? $school['name'];
        $updateSubdomain = strtolower($subdomain ?? $school['subdomain']);
        $updatePlan = $plan ?? $school['plan'];
        $updateStatus = $status ?? $school['status'];
        $updatePhone = $contactPhone ?? $school['contact_phone'];
        $updateEmail = $contactEmail ?? $school['contact_email'];

        $stmt = $pdo->prepare("
            UPDATE schools 
            SET name = :name, subdomain = :subdomain, plan = :plan, status = :status, contact_phone = :phone, contact_email = :email
            WHERE id = :id
        ");
        $stmt->execute([
            'name' => $updateName,
            'subdomain' => $updateSubdomain,
            'plan' => $updatePlan,
            'status' => $updateStatus,
            'phone' => $updatePhone,
            'email' => $updateEmail,
            'id' => $id
        ]);

        // Log action if status changed
        if ($school['status'] !== $updateStatus) {
            $this->logAction("Update school status to {$updateStatus}", $updateName, $user['name']);
        } else {
            $this->logAction("Update school details", $updateName, $user['name']);
        }

        // Fetch updated school
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $updatedSchool = $stmt->fetch();

        $response->getBody()->write(json_encode($updatedSchool));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function deleteSchool(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            $response->getBody()->write(json_encode(['error' => 'School ID is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("SELECT * FROM schools WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $school = $stmt->fetch();

        if (!$school) {
            $response->getBody()->write(json_encode(['error' => 'School tenant not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("DELETE FROM schools WHERE id = :id");
        $stmt->execute(['id' => $id]);

        // Log action
        $this->logAction("Delete school tenant", $school['name'], $user['name']);

        $response->getBody()->write(json_encode(['status' => 'success', 'message' => 'School tenant deleted successfully']));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getPlans(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $plans = [
            ['id' => 'Standard', 'name' => 'Standard', 'price' => 7999],
            ['id' => 'Premium', 'name' => 'Premium', 'price' => 19999],
            ['id' => 'Enterprise', 'name' => 'Enterprise', 'price' => 39999]
        ];

        $response->getBody()->write(json_encode($plans));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getSubscriptions(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->query("
            SELECT s.*, sch.name as school_name, sch.plan as plan
            FROM subscriptions s
            JOIN schools sch ON s.school_id = sch.id
            ORDER BY s.id DESC
        ");
        $subscriptions = $stmt->fetchAll();

        $response->getBody()->write(json_encode($subscriptions));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getAuditLogs(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50");
        $logs = $stmt->fetchAll();

        $response->getBody()->write(json_encode($logs));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getStats(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SUPER_ADMIN') {
            $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
        }

        $pdo = $this->db->getPdo();

        // 1. Total Tenants
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM schools");
        $totalSchools = (int)$stmt->fetch()['count'];

        // 2. Active Tenants
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM schools WHERE status = 'ACTIVE'");
        $activeSchools = (int)$stmt->fetch()['count'];

        // 3. Suspended Tenants
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM schools WHERE status = 'SUSPENDED'");
        $suspendedSchools = (int)$stmt->fetch()['count'];

        // 4. MRR Estimate (Sum of plan values for Active schools)
        $stmt = $pdo->query("SELECT plan, COUNT(*) as count FROM schools WHERE status = 'ACTIVE' GROUP BY plan");
        $planCounts = $stmt->fetchAll();
        
        $mrr = 0;
        foreach ($planCounts as $pc) {
            $price = 19999; // default premium
            if ($pc['plan'] === 'Standard') $price = 7999;
            elseif ($pc['plan'] === 'Enterprise') $price = 39999;
            $mrr += $price * (int)$pc['count'];
        }

        // 5. Simulated total users (e.g. active schools * 1500 + number of rows in users table)
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM users");
        $usersCount = (int)$stmt->fetch()['count'];
        $simulatedUsers = ($activeSchools * 1250) + $usersCount;

        $stats = [
            'schools_count' => $totalSchools,
            'active_schools' => $activeSchools,
            'suspended_schools' => $suspendedSchools,
            'billing_mrr' => $mrr,
            'total_users' => $simulatedUsers
        ];

        $response->getBody()->write(json_encode($stats));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
