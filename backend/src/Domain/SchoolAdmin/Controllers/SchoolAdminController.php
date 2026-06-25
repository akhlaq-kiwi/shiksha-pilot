<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use App\Database\Connection;
use PDO;

class SchoolAdminController
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

    public function getDashboardStats(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM students WHERE school_id = :sid AND status = 'ACTIVE'");
        $stmt->execute(['sid' => $schoolId]);
        $studentsCount = (int)$stmt->fetch()['count'];

        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM staff WHERE school_id = :sid AND status = 'ACTIVE'");
        $stmt->execute(['sid' => $schoolId]);
        $staffCount = (int)$stmt->fetch()['count'];

        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM classes WHERE school_id = :sid");
        $stmt->execute(['sid' => $schoolId]);
        $classesCount = (int)$stmt->fetch()['count'];

        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM fee_payments WHERE school_id = :sid AND status = 'Pending'");
        $stmt->execute(['sid' => $schoolId]);
        $pendingFees = (int)$stmt->fetch()['count'];

        $stats = [
            'students_count' => $studentsCount,
            'staff_count' => $staffCount,
            'classes_count' => $classesCount,
            'pending_fees' => $pendingFees,
        ];

        $response->getBody()->write(json_encode($stats));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getStudents(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT s.*, c.name as class_name, c.section
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.school_id = :sid
            ORDER BY s.id DESC
        ");
        $stmt->execute(['sid' => $schoolId]);
        $students = $stmt->fetchAll();

        $response->getBody()->write(json_encode($students));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createStudent(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $body = $request->getParsedBody();
        $name = $body['name'] ?? null;

        if (!$name) {
            $response->getBody()->write(json_encode(['error' => 'Student name is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO students (school_id, name, admission_no, class_id, parent_phone, email, status, dob, address)
            VALUES (:school_id, :name, :admission_no, :class_id, :parent_phone, :email, :status, :dob, :address)
        ");
        $stmt->execute([
            'school_id'    => $schoolId,
            'name'         => $name,
            'admission_no' => $body['admission_no'] ?? null,
            'class_id'     => $body['class_id'] ?? null,
            'parent_phone' => $body['parent_phone'] ?? null,
            'email'        => $body['email'] ?? null,
            'status'       => $body['status'] ?? 'ACTIVE',
            'dob'          => $body['dob'] ?? null,
            'address'      => $body['address'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM students WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $student = $stmt->fetch();

        $response->getBody()->write(json_encode($student));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function getStaff(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("SELECT * FROM staff WHERE school_id = :sid ORDER BY id DESC");
        $stmt->execute(['sid' => $schoolId]);
        $staff = $stmt->fetchAll();

        $response->getBody()->write(json_encode($staff));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createStaff(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $body = $request->getParsedBody();
        $name = $body['name'] ?? null;
        $role = $body['role'] ?? null;

        if (!$name || !$role) {
            $response->getBody()->write(json_encode(['error' => 'Staff name and role are required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO staff (school_id, name, employee_id, role, department, phone, email, status, salary, joining_date)
            VALUES (:school_id, :name, :employee_id, :role, :department, :phone, :email, :status, :salary, :joining_date)
        ");
        $stmt->execute([
            'school_id'   => $schoolId,
            'name'        => $name,
            'employee_id' => $body['employee_id'] ?? null,
            'role'        => $role,
            'department'  => $body['department'] ?? null,
            'phone'       => $body['phone'] ?? null,
            'email'       => $body['email'] ?? null,
            'status'      => $body['status'] ?? 'ACTIVE',
            'salary'      => $body['salary'] ?? null,
            'joining_date'=> $body['joining_date'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM staff WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $staffMember = $stmt->fetch();

        $response->getBody()->write(json_encode($staffMember));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function getClasses(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT c.*, ay.name as academic_year_name
            FROM classes c
            LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
            WHERE c.school_id = :sid
            ORDER BY c.id DESC
        ");
        $stmt->execute(['sid' => $schoolId]);
        $classes = $stmt->fetchAll();

        $response->getBody()->write(json_encode($classes));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createClass(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $body = $request->getParsedBody();
        $name = $body['name'] ?? null;

        if (!$name) {
            $response->getBody()->write(json_encode(['error' => 'Class name is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO classes (school_id, name, section, stream, academic_year_id)
            VALUES (:school_id, :name, :section, :stream, :academic_year_id)
        ");
        $stmt->execute([
            'school_id'        => $schoolId,
            'name'             => $name,
            'section'          => $body['section'] ?? null,
            'stream'           => $body['stream'] ?? null,
            'academic_year_id' => $body['academic_year_id'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM classes WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $class = $stmt->fetch();

        $response->getBody()->write(json_encode($class));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function getAcademicYears(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :sid ORDER BY id DESC");
        $stmt->execute(['sid' => $schoolId]);
        $years = $stmt->fetchAll();

        $response->getBody()->write(json_encode($years));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $params = $request->getQueryParams();
        $pdo = $this->db->getPdo();

        $where = 'a.school_id = :sid';
        $bindings = ['sid' => $schoolId];

        if (!empty($params['date'])) {
            $where .= ' AND a.date = :date';
            $bindings['date'] = $params['date'];
        }
        if (!empty($params['class_id'])) {
            $where .= ' AND a.class_id = :class_id';
            $bindings['class_id'] = $params['class_id'];
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

    public function markAttendance(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $body = $request->getParsedBody();
        $studentId = $body['student_id'] ?? null;
        $date = $body['date'] ?? date('Y-m-d');
        $status = $body['status'] ?? 'Present';

        if (!$studentId) {
            $response->getBody()->write(json_encode(['error' => 'student_id is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();

        // Upsert attendance
        $stmt = $pdo->prepare("
            INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by)
            VALUES (:school_id, :student_id, :class_id, :date, :status, :marked_by)
            ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)
        ");
        $stmt->execute([
            'school_id'  => $schoolId,
            'student_id' => $studentId,
            'class_id'   => $body['class_id'] ?? null,
            'date'       => $date,
            'status'     => $status,
            'marked_by'  => $user['id'],
        ]);

        $response->getBody()->write(json_encode(['success' => true, 'date' => $date, 'status' => $status]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getExams(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT e.*, c.name as class_name, s.name as subject_name
            FROM exams e
            LEFT JOIN classes c ON e.class_id = c.id
            LEFT JOIN subjects s ON e.subject_id = s.id
            WHERE e.school_id = :sid
            ORDER BY e.exam_date DESC
        ");
        $stmt->execute(['sid' => $schoolId]);
        $exams = $stmt->fetchAll();

        $response->getBody()->write(json_encode($exams));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function createExam(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $body = $request->getParsedBody();
        $name = $body['name'] ?? null;

        if (!$name) {
            $response->getBody()->write(json_encode(['error' => 'Exam name is required']));
            return $response->withHeader('Content-Type', 'application/json')->withStatus(400);
        }

        $pdo = $this->db->getPdo();
        $stmt = $pdo->prepare("
            INSERT INTO exams (school_id, name, class_id, subject_id, exam_date, max_marks)
            VALUES (:school_id, :name, :class_id, :subject_id, :exam_date, :max_marks)
        ");
        $stmt->execute([
            'school_id'  => $schoolId,
            'name'       => $name,
            'class_id'   => $body['class_id'] ?? null,
            'subject_id' => $body['subject_id'] ?? null,
            'exam_date'  => $body['exam_date'] ?? null,
            'max_marks'  => $body['max_marks'] ?? null,
        ]);

        $id = (int)$pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM exams WHERE id = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $exam = $stmt->fetch();

        $response->getBody()->write(json_encode($exam));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(201);
    }

    public function getExamMarks(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $params = $request->getQueryParams();
        $pdo = $this->db->getPdo();

        $where = '1=1';
        $bindings = [];

        if (!empty($params['exam_id'])) {
            $where .= ' AND em.exam_id = :exam_id';
            $bindings['exam_id'] = $params['exam_id'];
        }

        $stmt = $pdo->prepare("
            SELECT em.*, s.name as student_name, e.name as exam_name
            FROM exam_marks em
            LEFT JOIN students s ON em.student_id = s.id
            LEFT JOIN exams e ON em.exam_id = e.id
            WHERE {$where}
            ORDER BY em.id DESC
        ");
        $stmt->execute($bindings);
        $marks = $stmt->fetchAll();

        $response->getBody()->write(json_encode($marks));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function enterMarks(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $body = $request->getParsedBody();
        $examId = $body['exam_id'] ?? null;
        $studentId = $body['student_id'] ?? null;
        $marksObtained = $body['marks_obtained'] ?? null;

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
            'exam_id'       => $examId,
            'student_id'    => $studentId,
            'marks_obtained'=> $marksObtained,
            'grade'         => $body['grade'] ?? null,
            'remarks'       => $body['remarks'] ?? null,
        ]);

        $response->getBody()->write(json_encode(['success' => true]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getFeeStructures(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT fs.*, c.name as class_name
            FROM fee_structures fs
            LEFT JOIN classes c ON fs.class_id = c.id
            WHERE fs.school_id = :sid
            ORDER BY fs.id DESC
        ");
        $stmt->execute(['sid' => $schoolId]);
        $structures = $stmt->fetchAll();

        $response->getBody()->write(json_encode($structures));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getFeePayments(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT fp.*, s.name as student_name, fs.name as fee_structure_name
            FROM fee_payments fp
            LEFT JOIN students s ON fp.student_id = s.id
            LEFT JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.school_id = :sid
            ORDER BY fp.payment_date DESC
        ");
        $stmt->execute(['sid' => $schoolId]);
        $payments = $stmt->fetchAll();

        $response->getBody()->write(json_encode($payments));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getTimetable(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT t.*, c.name as class_name, s.name as subject_name, u.name as teacher_name
            FROM timetable t
            LEFT JOIN classes c ON t.class_id = c.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN users u ON t.teacher_id = u.id
            WHERE t.school_id = :sid
            ORDER BY FIELD(t.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), t.start_time
        ");
        $stmt->execute(['sid' => $schoolId]);
        $timetable = $stmt->fetchAll();

        $response->getBody()->write(json_encode($timetable));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getSubjects(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        if (!$user || $user['role'] !== 'SCHOOL_ADMIN') {
            return $this->unauthorizedResponse($response);
        }

        $schoolId = $user['school_id'];
        $pdo = $this->db->getPdo();

        $stmt = $pdo->prepare("
            SELECT s.*, c.name as class_name, u.name as teacher_name
            FROM subjects s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON s.teacher_id = u.id
            WHERE s.school_id = :sid
            ORDER BY s.id DESC
        ");
        $stmt->execute(['sid' => $schoolId]);
        $subjects = $stmt->fetchAll();

        $response->getBody()->write(json_encode($subjects));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
