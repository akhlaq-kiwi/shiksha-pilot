<?php

declare(strict_types=1);

namespace App\Domain\Student\Services;

use App\Domain\Student\Repositories\StudentDataRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use Psr\Log\LoggerInterface;

class StudentService extends BaseService
{
    public function __construct(
        private StudentDataRepository $repo,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    // -------------------------------------------------------------------------
    // Student resolution
    // -------------------------------------------------------------------------

    /**
     * Resolve the student record for the authenticated user.
     *
     * - STUDENT role  → matched by email + school_id
     * - PARENT  role  → matched by parent_phone (taken from user.phone) + school_id
     *
     * @param array<string, mixed> $user  Decoded token payload / user row.
     * @throws NotFoundException when no matching student is found.
     * @return array<string, mixed>
     */
    public function resolveStudent(array $user): array
    {
        $schoolId = (int) ($user['school_id'] ?? 0);

        if ($user['role'] === 'STUDENT') {
            $student = $this->repo->findByUserEmail((string) ($user['email'] ?? ''), $schoolId);
        } else {
            // PARENT: match via phone stored on users.phone -> students.parent_phone
            $student = $this->repo->findByParentPhone((string) ($user['phone'] ?? ''), $schoolId);
        }

        if ($student === null) {
            throw new NotFoundException('Student record not found.');
        }

        return $student;
    }

    // -------------------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------------------

    /**
     * Build the dashboard payload: student profile + aggregated stats.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function getDashboard(array $user): array
    {
        $student   = $this->resolveStudent($user);
        $studentId = (int) $student['id'];

        $withClass = $this->repo->findWithClass($studentId) ?? $student;
        $stats     = $this->repo->getDashboardStats($studentId);

        $this->log('student.dashboard', ['student_id' => $studentId]);

        return [
            'student'        => $withClass,
            'attendance_pct' => $stats['attendance_pct'],
            'upcoming_exams' => $stats['upcoming_exams'],
            'pending_fees'   => $stats['pending_fees'],
        ];
    }

    // -------------------------------------------------------------------------
    // Timetable
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getTimetable(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getTimetable($classId, $schoolId);
    }

    // -------------------------------------------------------------------------
    // Attendance
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getAttendance(array $user): array
    {
        $student = $this->resolveStudent($user);

        return $this->repo->getAttendance((int) $student['id']);
    }

    // -------------------------------------------------------------------------
    // Exam results
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getExamResults(array $user): array
    {
        $student = $this->resolveStudent($user);

        return $this->repo->getResults((int) $student['id']);
    }

    // -------------------------------------------------------------------------
    // Assignments
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getAssignments(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getAssignments($classId, $schoolId);
    }

    // -------------------------------------------------------------------------
    // Fees
    // -------------------------------------------------------------------------

    /**
     * Applicable fee structures for the student's class.
     *
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getFees(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getFeeStructures($classId, $schoolId);
    }

    /**
     * Fee payment history for the student.
     *
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getFeePayments(array $user): array
    {
        $student = $this->resolveStudent($user);

        return $this->repo->getFeePayments((int) $student['id']);
    }

    // -------------------------------------------------------------------------
    // Learning materials
    // -------------------------------------------------------------------------

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function getMaterials(array $user): array
    {
        $student  = $this->resolveStudent($user);
        $classId  = (int) $student['class_id'];
        $schoolId = (int) ($user['school_id'] ?? 0);

        return $this->repo->getMaterials($classId, $schoolId);
    }
}
