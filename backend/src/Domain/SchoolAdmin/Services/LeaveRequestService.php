<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use App\Domain\SchoolAdmin\Repositories\LeaveRequestRepository;
use App\Domain\SchoolAdmin\Repositories\AttendanceRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Exceptions\ForbiddenException;
use Psr\Log\LoggerInterface;
use PDO;

class LeaveRequestService extends BaseService
{
    public function __construct(
        private readonly LeaveRequestRepository $repo,
        private readonly SchoolAdminService $schoolAdminService,
        private readonly AttendanceRepository $attendanceRepo,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    public function getChildrenForUser(array $user): array
    {
        return $this->resolveStudentsForUser($user);
    }

    public function getLeaveRequests(array $user, array $filters): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        // Retrieve active academic year if not provided
        if (empty($filters['academic_year_id'])) {
            $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, $schoolId);
            $filters['academic_year_id'] = $workingYear ? (int)$workingYear['id'] : 0;
        }

        $role = $user['role'] ?? '';

        if ($role === 'SUPER_ADMIN') {
            return $this->repo->findWithDetails($schoolId, $filters);
        } elseif ($role === 'SCHOOL_ADMIN') {
            return $this->repo->findWithDetails($schoolId, $filters);
        } elseif ($role === 'TEACHER') {
            $teacher = $this->resolveTeacher($user);
            $teacherId = (int)$teacher['id'];

            // A teacher can view:
            // 1. Their own leave requests
            // 2. Student leave requests for classes they teach (if class_id is taught by them)
            $type = $filters['view_type'] ?? 'OWN'; // 'OWN' or 'STUDENTS'

            if ($type === 'OWN') {
                $filters['teacher_id'] = $teacherId;
                $filters['applicant_role'] = 'TEACHER';
                return $this->repo->findWithDetails($schoolId, $filters);
            } else {
                // Fetch classes the teacher teaches
                $classIds = $this->getAssignedClassIds($teacherId, $schoolId);
                if (empty($classIds)) {
                    return [];
                }

                $filters['applicant_role'] = 'STUDENT';
                $allLeaves = $this->repo->findWithDetails($schoolId, $filters);

                // Filter leaves by assigned classes
                return array_values(array_filter($allLeaves, function($lr) use ($classIds) {
                    return in_array((int)($lr['class_id'] ?? 0), $classIds, true);
                }));
            }
        } elseif ($role === 'PARENT' || $role === 'STUDENT') {
            // Resolve students linked to parent/student
            $students = $this->resolveStudentsForUser($user);
            if (empty($students)) {
                return [];
            }

            $studentIds = array_map(fn($s) => (int)$s['id'], $students);
            $filters['applicant_role'] = 'STUDENT';
            $allLeaves = $this->repo->findWithDetails($schoolId, $filters);

            return array_values(array_filter($allLeaves, function($lr) use ($studentIds) {
                return in_array((int)($lr['student_id'] ?? 0), $studentIds, true);
            }));
        }

        return [];
    }

    public function applyLeaveRequest(array $user, array $data): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();
        $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear && $workingYear['status'] === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
        }

        // 1. Validate basic inputs
        if (empty($data['leave_type'])) {
            throw new ValidationException(['leave_type' => 'Leave Type is required.']);
        }
        if (empty($data['from_date']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['from_date'])) {
            throw new ValidationException(['from_date' => 'Valid start date (YYYY-MM-DD) is required.']);
        }
        if (empty($data['to_date']) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['to_date'])) {
            throw new ValidationException(['to_date' => 'Valid end date (YYYY-MM-DD) is required.']);
        }
        if (strtotime($data['to_date']) < strtotime($data['from_date'])) {
            throw new ValidationException(['to_date' => 'End date cannot be earlier than start date.']);
        }
        if (empty($data['reason'])) {
            throw new ValidationException(['reason' => 'Reason for leave is required.']);
        }

        // 2. Validate reason length (max 100 words)
        $wordCount = count(array_filter(explode(' ', preg_replace('/\s+/', ' ', trim($data['reason'])))));
        if ($wordCount > 100) {
            throw new ValidationException(['reason' => 'Reason cannot exceed 100 words. Current count: ' . $wordCount]);
        }

        // 3. Boundary validation: check if dates fall inside active academic year
        $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear === null) {
            throw new ValidationException(['from_date' => 'No active academic year found for this school.']);
        }

        $startDate = $workingYear['start_date'];
        $endDate = $workingYear['end_date'];
        $ayid = (int)$workingYear['id'];

        if ($data['from_date'] < $startDate || $data['to_date'] > $endDate) {
            throw new ValidationException([
                'from_date' => "Leave dates must fall within the current academic year ($startDate to $endDate)."
            ]);
        }

        // 4. Resolve applicant details based on role
        $role = $user['role'] ?? '';
        $studentId = null;
        $teacherId = null;
        $applicantRole = 'STUDENT';

        if ($role === 'TEACHER') {
            $teacher = $this->resolveTeacher($user);
            $teacherId = (int)$teacher['id'];
            $applicantRole = 'TEACHER';
        } elseif ($role === 'PARENT' || $role === 'STUDENT') {
            $applicantRole = 'STUDENT';
            if ($role === 'PARENT') {
                if (empty($data['student_id'])) {
                    throw new ValidationException(['student_id' => 'Please select a child.']);
                }
                $studentId = (int)$data['student_id'];
                // Verify student belongs to parent
                $students = $this->resolveStudentsForUser($user);
                $allowedIds = array_map(fn($s) => (int)$s['id'], $students);
                if (!in_array($studentId, $allowedIds, true)) {
                    throw new ForbiddenException('You are not authorized to apply leave for this student.');
                }
            } else {
                $students = $this->resolveStudentsForUser($user);
                if (empty($students)) {
                    throw new NotFoundException('Student record not found.');
                }
                $studentId = (int)$students[0]['id'];
            }
        } else {
            throw new ForbiddenException('Only teachers, students, or parents can apply for leave.');
        }

        // 5. Create leave request record
        $id = $this->repo->create([
            'school_id' => $schoolId,
            'academic_year_id' => $ayid,
            'applicant_role' => $applicantRole,
            'student_id' => $studentId,
            'teacher_id' => $teacherId,
            'leave_type' => $data['leave_type'],
            'from_date' => $data['from_date'],
            'to_date' => $data['to_date'],
            'reason' => trim($data['reason']),
            'attachment_path' => $data['attachment_path'] ?? null,
            'status' => 'PENDING',
            'created_by' => (int)$user['id']
        ]);

        // 6. Notify School Admins
        $applicantName = $role === 'TEACHER' ? $teacher['name'] : ($this->getStudentName($pdo, $studentId) ?? 'Student');
        $this->createNotification(
            $pdo,
            $schoolId,
            'SCHOOL_ADMIN',
            'New Leave Request',
            "Leave request submitted by $applicantName ($applicantRole)",
            '/school-admin/leave-requests'
        );

        $this->log('Leave request applied', ['id' => $id, 'role' => $applicantRole, 'school_id' => $schoolId]);

        return $this->repo->findByIdWithDetails($schoolId, $id);
    }

    public function updateLeaveStatus(array $user, int $id, array $data): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();
        $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear && $workingYear['status'] === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
        }

        $leave = $this->repo->findById($id);
        if ($leave === null || (int)$leave['school_id'] !== $schoolId) {
            throw new NotFoundException('Leave request not found.');
        }

        if (($leave['status'] ?? '') !== 'PENDING') {
            throw new ValidationException(['status' => 'Only pending leave requests can be updated.']);
        }

        $newStatus = $data['status'] ?? '';
        if (!in_array($newStatus, ['APPROVED', 'REJECTED'], true)) {
            throw new ValidationException(['status' => 'Invalid status. Can only approve or reject.']);
        }

        $rejectReason = null;
        if ($newStatus === 'REJECTED') {
            if (empty($data['reject_reason'])) {
                throw new ValidationException(['reject_reason' => 'Reason for rejection is required.']);
            }
            $rejectReason = trim($data['reject_reason']);
        }

        $this->beginTransaction($pdo);
        try {
            $updateData = [
                'status' => $newStatus,
                'updated_at' => date('Y-m-d H:i:s')
            ];

            if ($newStatus === 'APPROVED') {
                $updateData['approved_by'] = (int)$user['id'];
                $updateData['approved_at'] = date('Y-m-d H:i:s');

                // If student leave, integrate with attendance
                if ($leave['applicant_role'] === 'STUDENT') {
                    $studentId = (int)$leave['student_id'];
                    $classId = $this->getStudentClassId($pdo, $studentId);

                    // Fetch holidays
                    $holidays = $this->getHolidaysList($pdo, $schoolId);

                    // Iterate dates
                    $current = strtotime($leave['from_date']);
                    $end = strtotime($leave['to_date']);

                    while ($current <= $end) {
                        $dateStr = date('Y-m-d', $current);
                        $dayOfWeek = (int)date('N', $current);

                        // Skip Sunday (7) and Holidays
                        if ($dayOfWeek !== 7 && !in_array($dateStr, $holidays, true)) {
                            // Upsert attendance record as Leave
                            $stmtCheck = $pdo->prepare("SELECT id FROM attendance WHERE student_id = :sid AND date = :date LIMIT 1");
                            $stmtCheck->execute([':sid' => $studentId, ':date' => $dateStr]);
                            $attId = $stmtCheck->fetchColumn();

                            if ($attId !== false) {
                                $stmtUp = $pdo->prepare("UPDATE attendance SET status = 'Leave', marked_by = :marked_by WHERE id = :id");
                                $stmtUp->execute([':marked_by' => $user['id'], ':id' => $attId]);
                            } else {
                                $stmtIn = $pdo->prepare("
                                    INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by)
                                    VALUES (:school_id, :student_id, :class_id, :date, 'Leave', :marked_by)
                                ");
                                $stmtIn->execute([
                                    ':school_id' => $schoolId,
                                    ':student_id' => $studentId,
                                    ':class_id' => $classId,
                                    ':date' => $dateStr,
                                    ':marked_by' => $user['id']
                                ]);
                            }
                        }
                        $current = strtotime('+1 day', $current);
                    }
                }
            } else {
                $updateData['rejected_by'] = (int)$user['id'];
                $updateData['rejected_at'] = date('Y-m-d H:i:s');
                $updateData['reject_reason'] = $rejectReason;
            }

            $this->repo->update($id, $updateData);

            // Notify applicant
            $applicantUserRole = $leave['applicant_role'] === 'TEACHER' ? 'TEACHER' : 'PARENT';
            $title = $newStatus === 'APPROVED' ? "🎉 Leave Application Approved" : "⚠️ Leave Application Rejected";
            $message = $newStatus === 'APPROVED' 
                ? "Your leave request has been APPROVED by the School Admin."
                : "Your leave request has been REJECTED. Reason: $rejectReason";

            $this->createNotification(
                $pdo,
                $schoolId,
                $applicantUserRole,
                $title,
                $message,
                $leave['applicant_role'] === 'TEACHER' ? '/teacher/leaves' : '/parent/leaves'
            );

            $this->commit($pdo);
        } catch (\Exception $e) {
            $this->rollback($pdo);
            throw $e;
        }

        $this->log('Leave request status updated', ['id' => $id, 'status' => $newStatus, 'school_id' => $schoolId]);

        return $this->repo->findByIdWithDetails($schoolId, $id);
    }

    public function cancelLeaveRequest(array $user, int $id): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();
        $workingYear = $this->schoolAdminService->getWorkingAcademicYear($pdo, $schoolId);
        if ($workingYear && $workingYear['status'] === 'Archived') {
            throw new ValidationException(['fields' => 'Archived academic years are read-only and cannot be modified.']);
        }

        $leave = $this->repo->findById($id);
        if ($leave === null || (int)$leave['school_id'] !== $schoolId) {
            throw new NotFoundException('Leave request not found.');
        }

        // Cancel permission: Applicant user or school admin
        $isAdmin = in_array($user['role'] ?? '', ['SUPER_ADMIN', 'SCHOOL_ADMIN'], true);
        $isCreator = (int)($leave['created_by'] ?? 0) === (int)$user['id'];

        if (!$isAdmin && !$isCreator) {
            throw new ForbiddenException('You are not authorized to cancel this leave request.');
        }

        if (in_array($leave['status'] ?? '', ['CANCELLED', 'REJECTED'], true)) {
            throw new ValidationException(['status' => 'This leave request is already rejected or cancelled.']);
        }

        $this->beginTransaction($pdo);
        try {
            $oldStatus = $leave['status'];

            $this->repo->update($id, [
                'status' => 'CANCELLED',
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            // Revert attendance if the leave was previously APPROVED
            if ($oldStatus === 'APPROVED' && $leave['applicant_role'] === 'STUDENT') {
                $studentId = (int)$leave['student_id'];
                $from = $leave['from_date'];
                $to = $leave['to_date'];

                // Delete 'Leave' attendance records created for this leave request
                $stmtDel = $pdo->prepare("
                    DELETE FROM attendance 
                    WHERE student_id = :sid 
                      AND date BETWEEN :from_date AND :to_date 
                      AND status = 'Leave'
                ");
                $stmtDel->execute([
                    ':sid' => $studentId,
                    ':from_date' => $from,
                    ':to_date' => $to
                ]);
            }

            // If creator cancelled, notify admin. If admin cancelled, notify creator.
            if ($isCreator) {
                $this->createNotification(
                    $pdo,
                    $schoolId,
                    'SCHOOL_ADMIN',
                    'Leave Request Cancelled',
                    "A leave request was cancelled by the applicant.",
                    '/school-admin/leave-requests'
                );
            } else {
                $applicantUserRole = $leave['applicant_role'] === 'TEACHER' ? 'TEACHER' : 'PARENT';
                $this->createNotification(
                    $pdo,
                    $schoolId,
                    $applicantUserRole,
                    "Leave Request Cancelled by Admin",
                    "Your leave request has been cancelled by an administrator.",
                    $leave['applicant_role'] === 'TEACHER' ? '/teacher/leaves' : '/parent/leaves'
                );
            }

            $this->commit($pdo);
        } catch (\Exception $e) {
            $this->rollback($pdo);
            throw $e;
        }

        $this->log('Leave request cancelled', ['id' => $id, 'school_id' => $schoolId]);

        return $this->repo->findByIdWithDetails($schoolId, $id);
    }

    // Helpers

    private function resolveTeacher(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        // 1. Direct ID match check
        $stmt = $pdo->prepare("SELECT * FROM staff WHERE id = :id AND school_id = :sid LIMIT 1");
        $stmt->execute([':id' => $user['id'], ':sid' => $schoolId]);
        $staff = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($staff) {
            return $staff;
        }

        // 2. Email or Phone match
        if (!empty($user['phone'])) {
            $stmt = $pdo->prepare("SELECT * FROM staff WHERE phone = :phone AND school_id = :sid LIMIT 1");
            $stmt->execute([':phone' => $user['phone'], ':sid' => $schoolId]);
            $staff = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($staff) {
                return $staff;
            }
        }

        if (!empty($user['email'])) {
            $stmt = $pdo->prepare("SELECT * FROM staff WHERE email = :email AND school_id = :sid LIMIT 1");
            $stmt->execute([':email' => $user['email'], ':sid' => $schoolId]);
            $staff = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($staff) {
                return $staff;
            }
        }

        throw new NotFoundException('Teacher profile record not found.');
    }

    private function resolveStudentsForUser(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $pdo = $this->repo->getPdo();

        if ($user['role'] === 'STUDENT') {
            $stmt = $pdo->prepare("SELECT * FROM students WHERE email = :email AND school_id = :sid");
            $stmt->execute([':email' => $user['email'] ?? '', ':sid' => $schoolId]);
            $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($students) && !empty($user['phone'])) {
                $stmt = $pdo->prepare("SELECT * FROM students WHERE student_mobile = :phone AND school_id = :sid");
                $stmt->execute([':phone' => $user['phone'], ':sid' => $schoolId]);
                $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            return $students;
        } else {
            // PARENT: match via phone (fallback to father_phone, guardian_phone, or student_mobile)
            $stmt = $pdo->prepare("SELECT * FROM students WHERE (parent_phone = :phone1 OR father_phone = :phone2 OR guardian_phone = :phone3 OR student_mobile = :phone4) AND school_id = :sid");
            $stmt->execute([
                ':phone1' => $user['phone'] ?? '',
                ':phone2' => $user['phone'] ?? '',
                ':phone3' => $user['phone'] ?? '',
                ':phone4' => $user['phone'] ?? '',
                ':sid' => $schoolId
            ]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    private function getAssignedClassIds(int $teacherId, int $schoolId): array
    {
        $stmt = $this->repo->getPdo()->prepare("
            SELECT DISTINCT class_id 
            FROM subjects 
            WHERE teacher_id = :teacher_id AND school_id = :school_id
        ");
        $stmt->execute([':teacher_id' => $teacherId, ':school_id' => $schoolId]);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    private function getStudentName(PDO $pdo, int $studentId): ?string
    {
        $stmt = $pdo->prepare("SELECT name FROM students WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $studentId]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (string)$val : null;
    }

    private function getStudentClassId(PDO $pdo, int $studentId): ?int
    {
        $stmt = $pdo->prepare("SELECT class_id FROM students WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $studentId]);
        $val = $stmt->fetchColumn();
        return $val !== false ? (int)$val : null;
    }

    private function getHolidaysList(PDO $pdo, int $schoolId): array
    {
        $stmt = $pdo->prepare("SELECT date FROM holidays WHERE school_id = :sid");
        $stmt->execute([':sid' => $schoolId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    private function createNotification(PDO $pdo, int $schoolId, string $role, string $title, string $message, ?string $link = null): void
    {
        $stmt = $pdo->prepare("
            INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, is_read)
            VALUES (:school_id, :user_role, :title, :message, :link, 0)
        ");
        $stmt->execute([
            ':school_id' => $schoolId,
            ':user_role' => $role,
            ':title' => $title,
            ':message' => $message,
            ':link' => $link
        ]);
    }
}
