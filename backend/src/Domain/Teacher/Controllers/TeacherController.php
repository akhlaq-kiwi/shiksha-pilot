<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Database\Connection;
use PDO;

class TeacherController
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

    public function getMyClasses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();

        // Classes where teacher has subjects assigned
        $stmt = $pdo->prepare("
            SELECT DISTINCT c.*, ay.name as academic_year_name
            FROM subjects s
            JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE s.teacher_id = :teacher_id AND c.school_id = :school_id
            ORDER BY c.name
        ");
        $stmt->execute(['teacher_id' => $user['id'], 'school_id' => $user['school_id']]);
        $classes = $stmt->fetchAll();

        $response->getBody()->write(json_encode($classes));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getStudentList(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $params = $request->getQueryParams();
        $classId = $params['class_id'] ?? null;

        if (!$classId) {
            $response->getBody()->write(json_encode(['error' => 'class_id query parameter is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            SELECT s.*, c.name as class_name, c.section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.class_id = :class_id AND s.school_id = :school_id AND s.status = 'ACTIVE'
            ORDER BY s.name
        ");
        $stmt->execute(['class_id' => $classId, 'school_id' => $user['school_id']]);
        $students = $stmt->fetchAll();

        $response->getBody()->write(json_encode($students));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function markAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $body = $request->getParsedBody();
        $studentId = $body['student_id'] ?? null;
        $date = $body['date'] ?? date('Y-m-d');
        $status = $body['status'] ?? 'Present';

        if (!$studentId) {
            $response->getBody()->write(json_encode(['error' => 'student_id is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by)
            VALUES (:school_id, :student_id, :class_id, :date, :status, :marked_by)
            ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)
        ");
        $stmt->execute([
            'school_id'  => $user['school_id'],
            'student_id' => $studentId,
            'class_id'   => $body['class_id'] ?? null,
            'date'       => $date,
            'status'     => $status,
            'marked_by'  => $user['id'],
        ]);

        $response->getBody()->write(json_encode(['success' => true, 'date' => $date, 'status' => $status]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getAttendanceHistory(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $params = $request->getQueryParams();
        $pdo = $this->db->getPdo();

        $where = 'a.marked_by = :teacher_id';
        $bindings = ['teacher_id' => $user['id']];

        if (!empty($params['class_id'])) {
            $where .= ' AND a.class_id = :class_id';
            $bindings['class_id'] = $params['class_id'];
        }
        if (!empty($params['date'])) {
            $where .= ' AND a.date = :date';
            $bindings['date'] = $params['date'];
        }

        $stmt = $pdo->prepare("
            SELECT a.*, s.name as student_name, c.name as class_name
            FROM attendance a
            LEFT JOIN students s ON a.student_id = s.id
            LEFT JOIN classes c ON a.class_id = c.id
            WHERE {$where}
            ORDER BY a.date DESC, a.id DESC
        ");
        $stmt->execute($bindings);
        $records = $stmt->fetchAll();

        $response->getBody()->write(json_encode($records));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getAssignments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            SELECT a.*, c.name as class_name, s.name as subject_name
            FROM assignments a
            LEFT JOIN classes c ON a.class_id = c.id
            LEFT JOIN subjects s ON a.subject_id = s.id
            WHERE a.teacher_id = :teacher_id AND a.school_id = :school_id
            ORDER BY a.due_date DESC
        ");
        $stmt->execute(['teacher_id' => $user['id'], 'school_id' => $user['school_id']]);
        $assignments = $stmt->fetchAll();

        $response->getBody()->write(json_encode($assignments));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createAssignment(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $body = $request->getParsedBody();
        $title = $body['title'] ?? null;

        if (!$title) {
            $response->getBody()->write(json_encode(['error' => 'Assignment title is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO assignments (school_id, class_id, subject_id, teacher_id, title, description, due_date)
            VALUES (:school_id, :class_id, :subject_id, :teacher_id, :title, :description, :due_date)
        ");
        $stmt->execute([
            'school_id'   => $user['school_id'],
            'class_id'    => $body['class_id'] ?? null,
            'subject_id'  => $body['subject_id'] ?? null,
            'teacher_id'  => $user['id'],
            'title'       => $title,
            'description' => $body['description'] ?? null,
            'due_date'    => $body['due_date'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM assignments WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $assignment = $stmt->fetch();

        $response->getBody()->write(json_encode($assignment));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function getMaterials(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            SELECT lm.*, c.name as class_name, s.name as subject_name
            FROM learning_materials lm
            LEFT JOIN classes c ON lm.class_id = c.id
            LEFT JOIN subjects s ON lm.subject_id = s.id
            WHERE lm.teacher_id = :teacher_id AND lm.school_id = :school_id
            ORDER BY lm.id DESC
        ");
        $stmt->execute(['teacher_id' => $user['id'], 'school_id' => $user['school_id']]);
        $materials = $stmt->fetchAll();

        $response->getBody()->write(json_encode($materials));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createMaterial(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $body = $request->getParsedBody();
        $title = $body['title'] ?? null;

        if (!$title) {
            $response->getBody()->write(json_encode(['error' => 'Material title is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO learning_materials (school_id, class_id, subject_id, teacher_id, title, type, url)
            VALUES (:school_id, :class_id, :subject_id, :teacher_id, :title, :type, :url)
        ");
        $stmt->execute([
            'school_id'  => $user['school_id'],
            'class_id'   => $body['class_id'] ?? null,
            'subject_id' => $body['subject_id'] ?? null,
            'teacher_id' => $user['id'],
            'title'      => $title,
            'type'       => $body['type'] ?? 'Other',
            'url'        => $body['url'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM learning_materials WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $material = $stmt->fetch();

        $response->getBody()->write(json_encode($material));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function getExams(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $pdo = $this->db->getPdo();

        // Exams for subjects this teacher teaches
        $stmt = $pdo->prepare("
            SELECT e.*, c.name as class_name, s.name as subject_name
            FROM exams e
            LEFT JOIN classes c ON e.class_id = c.id
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE e.subject_id IN (
                SELECT id FROM subjects WHERE teacher_id = :teacher_id AND school_id = :school_id
            )
            ORDER BY e.exam_date DESC
        ");
        $stmt->execute(['teacher_id' => $user['id'], 'school_id' => $user['school_id']]);
        $exams = $stmt->fetchAll();

        $response->getBody()->write(json_encode($exams));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function enterMarks(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $body = $request->getParsedBody();
        $examId = $body['exam_id'] ?? null;
        $studentId = $body['student_id'] ?? null;

        if (!$examId || !$studentId) {
            $response->getBody()->write(json_encode(['error' => 'exam_id and student_id are required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO exam_marks (exam_id, student_id, marks_obtained, grade, remarks)
            VALUES (:exam_id, :student_id, :marks_obtained, :grade, :remarks)
            ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained), grade = VALUES(grade), remarks = VALUES(remarks)
        ");
        $stmt->execute([
            'exam_id'        => $examId,
            'student_id'     => $studentId,
            'marks_obtained' => $body['marks_obtained'] ?? null,
            'grade'          => $body['grade'] ?? null,
            'remarks'        => $body['remarks'] ?? null,
        ]);

        $response->getBody()->write(json_encode(['success' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getTodaySchedule(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'TEACHER') {
            return $this->unauthorizedResponse($response);
        }

        $today = date('l'); // Full day name e.g. Monday
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT t.*, c.name as class_name, s.name as subject_name
            FROM timetable t
            LEFT JOIN classes c ON t.class_id = c.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            WHERE t.teacher_id = :teacher_id AND t.school_id = :school_id AND t.day_of_week = :day
            ORDER BY t.start_time
        ");
        $stmt->execute(['teacher_id' => $user['id'], 'school_id' => $user['school_id'], 'day' => $today]);
        $schedule = $stmt->fetchAll();

        $response->getBody()->write(json_encode($schedule));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
