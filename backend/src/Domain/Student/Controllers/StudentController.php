<?php

declare(strict_types=1);

namespace App\Domain\Student\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Database\Connection;
use PDO;

class StudentController
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

    private function unauthorizedResponse(Response $response): Response
    {
        $response->getBody()->write(json_encode(['error' => 'Unauthorized session expired']));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(401);
    }

    private function isAllowed(?array $user): bool
    {
        return $user && in_array($user['role'], ['STUDENT', 'PARENT'], true);
    }

    /**
     * Resolve the student record linked to the authenticated user.
     * For Students: match by email. For Parents: match by parent_phone on the users phone field.
     */
    private function resolveStudent(array $user, PDO $pdo): ?array
    {
        if ($user['role'] === 'STUDENT') {
            $stmt = $pdo->prepare("SELECT * FROM students WHERE email = :email AND school_id = :school_id LIMIT 1");
            $stmt->execute(['email' => $user['email'], 'school_id' => $user['school_id']]);
        } else {
            // Parent: match by phone stored on parent_phone column
            $stmt = $pdo->prepare("SELECT * FROM students WHERE parent_phone = :phone AND school_id = :school_id LIMIT 1");
            $stmt->execute(['phone' => $user['phone'] ?? '', 'school_id' => $user['school_id']]);
        }
        $student = $stmt->fetch();
        return $student ?: null;
    }

    public function getDashboard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $studentId = $student['id'];

        // Attendance percentage (last 30 days)
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present
            FROM attendance
            WHERE student_id = :sid AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ");
        $stmt->execute(['sid' => $studentId]);
        $att = $stmt->fetch();
        $attendancePct = $att['total'] > 0 ? round(($att['present'] / $att['total']) * 100, 1) : 0;

        // Upcoming exams
        $stmt = $pdo->prepare("
            SELECT e.*, s.name as subject_name
            FROM exams e
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE e.class_id = :class_id AND e.exam_date >= CURDATE()
            ORDER BY e.exam_date ASC
            LIMIT 5
        ");
        $stmt->execute(['class_id' => $student['class_id']]);
        $upcomingExams = $stmt->fetchAll();

        // Fee status
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as pending_count, SUM(amount_paid) as total_paid
            FROM fee_payments
            WHERE student_id = :sid AND status IN ('Pending','Overdue')
        ");
        $stmt->execute(['sid' => $studentId]);
        $feeStatus = $stmt->fetch();

        $dashboard = [
            'student'         => $student,
            'attendance_pct'  => $attendancePct,
            'upcoming_exams'  => $upcomingExams,
            'pending_fees'    => (int)$feeStatus['pending_count'],
        ];

        $response->getBody()->write(json_encode($dashboard));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("
            SELECT t.*, s.name as subject_name, u.name as teacher_name
            FROM timetable t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN users u ON t.teacher_id = u.id
            WHERE t.class_id = :class_id AND t.school_id = :school_id
            ORDER BY FIELD(t.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), t.start_time
        ");
        $stmt->execute(['class_id' => $student['class_id'], 'school_id' => $user['school_id']]);
        $timetable = $stmt->fetchAll();

        $response->getBody()->write(json_encode($timetable));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("
            SELECT * FROM attendance
            WHERE student_id = :sid
            ORDER BY date DESC
        ");
        $stmt->execute(['sid' => $student['id']]);
        $records = $stmt->fetchAll();

        $response->getBody()->write(json_encode($records));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getExamResults(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("
            SELECT em.*, e.name as exam_name, e.max_marks, e.exam_date, s.name as subject_name
            FROM exam_marks em
            JOIN exams e ON em.exam_id = e.id
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE em.student_id = :sid
            ORDER BY e.exam_date DESC
        ");
        $stmt->execute(['sid' => $student['id']]);
        $results = $stmt->fetchAll();

        $response->getBody()->write(json_encode($results));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("
            SELECT a.*, s.name as subject_name, u.name as teacher_name
            FROM assignments a
            LEFT JOIN subjects s ON a.subject_id = s.id
            LEFT JOIN users u ON a.teacher_id = u.id
            WHERE a.class_id = :class_id AND a.school_id = :school_id
            ORDER BY a.due_date ASC
        ");
        $stmt->execute(['class_id' => $student['class_id'], 'school_id' => $user['school_id']]);
        $assignments = $stmt->fetchAll();

        $response->getBody()->write(json_encode($assignments));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getFees(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        // Return applicable fee structures for student's class
        $stmt = $pdo->prepare("
            SELECT fs.*
            FROM fee_structures fs
            WHERE fs.school_id = :school_id AND (fs.class_id = :class_id OR fs.class_id IS NULL)
            ORDER BY fs.id DESC
        ");
        $stmt->execute(['school_id' => $user['school_id'], 'class_id' => $student['class_id']]);
        $fees = $stmt->fetchAll();

        $response->getBody()->write(json_encode($fees));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getFeePayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("
            SELECT fp.*, fs.name as fee_structure_name
            FROM fee_payments fp
            LEFT JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.student_id = :sid
            ORDER BY fp.payment_date DESC
        ");
        $stmt->execute(['sid' => $student['id']]);
        $payments = $stmt->fetchAll();

        $response->getBody()->write(json_encode($payments));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getMaterials(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$this->isAllowed($user)) {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $student = $this->resolveStudent($user, $pdo);

        if (!$student) {
            $response->getBody()->write(json_encode(['error' => 'Student record not found']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(404);
        }

        $stmt = $pdo->prepare("
            SELECT lm.*, s.name as subject_name, u.name as teacher_name
            FROM learning_materials lm
            LEFT JOIN subjects s ON lm.subject_id = s.id
            LEFT JOIN users u ON lm.teacher_id = u.id
            WHERE lm.class_id = :class_id AND lm.school_id = :school_id
            ORDER BY lm.id DESC
        ");
        $stmt->execute(['class_id' => $student['class_id'], 'school_id' => $user['school_id']]);
        $materials = $stmt->fetchAll();

        $response->getBody()->write(json_encode($materials));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
