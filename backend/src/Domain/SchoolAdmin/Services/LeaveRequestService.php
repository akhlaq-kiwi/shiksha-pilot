<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Services;

use App\Domain\SchoolAdmin\Repositories\LeaveRequestRepository;
use App\Domain\SchoolAdmin\Repositories\AttendanceRepository;
use App\Shared\BaseService;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Notifications\NotificationCatalog;
use App\Shared\Notifications\PushDispatcher;
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
            '/school-admin/leave-requests',
            'LEAVE_REQUEST_SUBMITTED'
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
            } else {
                $updateData['rejected_by'] = (int)$user['id'];
                $updateData['rejected_at'] = date('Y-m-d H:i:s');
                $updateData['reject_reason'] = $rejectReason;
            }

            $this->repo->update($id, $updateData);

            // Notify applicant (In-App & Push Notification to Teacher/Student/Parent)
            $dateRange = $this->formatLeaveDateRange($leave['from_date'], $leave['to_date']);

            if ($newStatus === 'APPROVED') {
                $title = 'Leave Request Approved';
                $message = "Your leave request for $dateRange has been approved.";
                $eventKey = 'LEAVE_APPROVED';
            } else {
                $title = 'Leave Request Rejected';
                $message = !empty($rejectReason)
                    ? "Your leave request for $dateRange has been rejected. Reason: $rejectReason"
                    : "Your leave request for $dateRange has been rejected.";
                $eventKey = 'LEAVE_REJECTED';
            }

            $recipients = $this->resolveRecipientsForLeaveRequest($pdo, $leave);
            if (!empty($recipients)) {
                $dispatcher = new PushDispatcher($pdo, new \App\Shared\Notifications\FcmClient($pdo));
                foreach ($recipients as $rec) {
                    $recRole = $rec['role'];
                    $recUserId = (int)$rec['user_id'];
                    $link = ($recRole === 'TEACHER') 
                        ? '/teacher/leaves' 
                        : (($recRole === 'STUDENT') ? '/student/leaves' : '/parent/leaves');

                    $dispatcher->toUser($schoolId, $recUserId, $recRole, $eventKey, $title, $message, $link);
                }
            } else {
                $applicantUserRole = $leave['applicant_role'] === 'TEACHER' ? 'TEACHER' : 'PARENT';
                $link = $leave['applicant_role'] === 'TEACHER' ? '/teacher/leaves' : '/parent/leaves';
                $this->createNotification($pdo, $schoolId, $applicantUserRole, $title, $message, $link, $eventKey);
            }

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

            // If creator cancelled, notify admin. If admin cancelled, notify creator.
            if ($isCreator) {
                $this->createNotification(
                    $pdo,
                    $schoolId,
                    'SCHOOL_ADMIN',
                    'Leave Request Cancelled',
                    "A leave request was cancelled by the applicant.",
                    '/school-admin/leave-requests',
                    'LEAVE_CANCELLED_BY_APPLICANT'
                );
            } else {
                $applicantUserRole = $leave['applicant_role'] === 'TEACHER' ? 'TEACHER' : 'PARENT';
                $this->createNotification(
                    $pdo,
                    $schoolId,
                    $applicantUserRole,
                    "Leave Request Cancelled by Admin",
                    "Your leave request has been cancelled by an administrator.",
                    $leave['applicant_role'] === 'TEACHER' ? '/teacher/leaves' : '/parent/leaves',
                    'LEAVE_CANCELLED_BY_ADMIN'
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

        // Return a virtual staff record fallback if no staff table row exists yet
        return [
            'id'        => (int)$user['id'],
            'school_id' => $schoolId,
            'name'      => $user['name'] ?? 'Teacher User',
            'phone'     => $user['phone'] ?? '',
            'email'     => $user['email'] ?? '',
            'role'      => 'Teacher'
        ];
    }

    private function resolveStudentsForUser(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $phone = trim((string)($user['phone'] ?? ''));
        $email = trim((string)($user['email'] ?? ''));
        $pdo = $this->repo->getPdo();

        if (empty($phone) && isset($user['id'])) {
            $stmt = $pdo->prepare("SELECT phone, email FROM users WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $user['id']]);
            $uRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($uRow) {
                if (empty($phone)) $phone = trim((string)($uRow['phone'] ?? ''));
                if (empty($email)) $email = trim((string)($uRow['email'] ?? ''));
            }
        }

        if (empty($phone) || strlen($phone) < 10) {
            if (!empty($email)) {
                $stmt = $pdo->prepare("
                    SELECT s.*, 
                           c.name AS class_name, 
                           c.section AS section_name,
                           ay.name AS academic_year_name,
                           ay.is_current AS is_current_academic_year
                    FROM students s
                    LEFT JOIN classes c ON s.class_id = c.id
                    LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
                    WHERE s.school_id = :sid
                      AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
                      AND s.exit_date IS NULL
                      AND LOWER(s.email) = LOWER(:email)
                    ORDER BY COALESCE(ay.is_current, 0) DESC, s.id DESC
                ");
                $stmt->execute([':sid' => $schoolId, ':email' => $email]);
                $raw = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                $filtered = [];
                $seen = [];
                foreach ($raw as $st) {
                    $identity = !empty($st['admission_no']) ? 'ADM_' . $st['admission_no'] : 'NAME_' . mb_strtolower(trim($st['name'] ?? ''));
                    if (!isset($seen[$identity])) {
                        $seen[$identity] = true;
                        $filtered[] = $st;
                    }
                }
                return $filtered;
            }
            return [];
        }

        $stmt = $pdo->prepare("
            SELECT s.*, 
                   c.name AS class_name, 
                   c.section AS section_name,
                   ay.name AS academic_year_name,
                   ay.is_current AS is_current_academic_year
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
            WHERE s.school_id = :sid
              AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
              AND s.exit_date IS NULL
              AND (
                (s.parent_phone = :p1 AND s.parent_phone IS NOT NULL AND s.parent_phone != '') OR
                (s.father_phone = :p2 AND s.father_phone IS NOT NULL AND s.father_phone != '') OR
                (s.guardian_phone = :p3 AND s.guardian_phone IS NOT NULL AND s.guardian_phone != '') OR
                (s.student_mobile = :p4 AND s.student_mobile IS NOT NULL AND s.student_mobile != '')
              )
            ORDER BY COALESCE(ay.is_current, 0) DESC, s.id DESC
        ");

        $stmt->execute([
            ':sid' => $schoolId,
            ':p1'  => $phone,
            ':p2'  => $phone,
            ':p3'  => $phone,
            ':p4'  => $phone
        ]);

        $rawStudents = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $filtered = [];
        $seenIdentityMap = [];
        foreach ($rawStudents as $st) {
            $identity = !empty($st['admission_no']) ? 'ADM_' . $st['admission_no'] : 'NAME_' . mb_strtolower(trim($st['name'] ?? ''));
            if (!isset($seenIdentityMap[$identity])) {
                $seenIdentityMap[$identity] = true;
                $filtered[] = $st;
            }
        }

        return $filtered;
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

    private function formatLeaveDateRange(string $fromDate, string $toDate): string
    {
        $fromTs = strtotime($fromDate);
        $toTs = strtotime($toDate);

        if ($fromTs === $toTs) {
            return date('j M Y', $fromTs);
        }

        return date('j M Y', $fromTs) . ' - ' . date('j M Y', $toTs);
    }

    private function resolveRecipientsForLeaveRequest(PDO $pdo, array $leave): array
    {
        $recipients = [];
        $addedUserIds = [];

        $schoolId = (int)($leave['school_id'] ?? 0);
        $createdBy = (int)($leave['created_by'] ?? 0);

        // 1. Creator user
        if ($createdBy > 0) {
            $stmt = $pdo->prepare("SELECT id, role FROM users WHERE id = :id AND school_id = :sid LIMIT 1");
            $stmt->execute([':id' => $createdBy, ':sid' => $schoolId]);
            $creator = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($creator) {
                $recipients[] = [
                    'user_id' => (int)$creator['id'],
                    'role' => $creator['role']
                ];
                $addedUserIds[(int)$creator['id']] = true;
            }
        }

        // 2. If TEACHER leave request, also match staff details to user
        if (($leave['applicant_role'] ?? '') === 'TEACHER' && !empty($leave['teacher_id'])) {
            $stmtStaff = $pdo->prepare("SELECT phone, email FROM staff WHERE id = :id LIMIT 1");
            $stmtStaff->execute([':id' => (int)$leave['teacher_id']]);
            $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
            if ($staff) {
                $phone = trim($staff['phone'] ?? '');
                $email = trim($staff['email'] ?? '');
                if ($phone !== '' || $email !== '') {
                    $conds = [];
                    $params = [':sid' => $schoolId];
                    if ($phone !== '') {
                        $conds[] = "phone = :phone";
                        $params[':phone'] = $phone;
                    }
                    if ($email !== '') {
                        $conds[] = "email = :email";
                        $params[':email'] = $email;
                    }
                    $sql = "SELECT id, role FROM users WHERE school_id = :sid AND UPPER(role) = 'TEACHER' AND (" . implode(' OR ', $conds) . ")";
                    $stmtUser = $pdo->prepare($sql);
                    $stmtUser->execute($params);
                    $teachers = $stmtUser->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($teachers as $t) {
                        $tId = (int)$t['id'];
                        if (!isset($addedUserIds[$tId])) {
                            $recipients[] = [
                                'user_id' => $tId,
                                'role' => $t['role']
                            ];
                            $addedUserIds[$tId] = true;
                        }
                    }
                }
            }
        }

        // 3. If STUDENT leave request, resolve specific student & parent user accounts ONLY
        if (($leave['applicant_role'] ?? '') === 'STUDENT' && !empty($leave['student_id'])) {
            $studentId = (int)$leave['student_id'];
            $stmtSt = $pdo->prepare("
                SELECT id, student_mobile, parent_phone, father_phone, guardian_phone, email, student_email 
                FROM students 
                WHERE id = :id LIMIT 1
            ");
            $stmtSt->execute([':id' => $studentId]);
            $st = $stmtSt->fetch(PDO::FETCH_ASSOC);
            if ($st) {
                $parentPhones = array_values(array_filter(array_map('trim', [
                    $st['parent_phone'] ?? '',
                    $st['father_phone'] ?? '',
                    $st['guardian_phone'] ?? ''
                ])));
                $studentPhones = array_values(array_filter(array_map('trim', [
                    $st['student_mobile'] ?? ''
                ])));
                $studentEmails = array_values(array_filter(array_map('trim', [
                    $st['student_email'] ?? '',
                    $st['email'] ?? ''
                ])));

                // A. Match PARENT user accounts
                if (!empty($parentPhones) || !empty($studentEmails)) {
                    $pConds = [];
                    $pParams = [':sid' => $schoolId];

                    if (!empty($parentPhones)) {
                        $pPlaceholders = [];
                        foreach ($parentPhones as $idx => $ph) {
                            $k = ":pph_$idx";
                            $pPlaceholders[] = "phone = $k";
                            $pParams[$k] = $ph;
                        }
                        $pConds[] = "(" . implode(' OR ', $pPlaceholders) . ")";
                    }
                    if (!empty($studentEmails)) {
                        $ePlaceholders = [];
                        foreach ($studentEmails as $idx => $em) {
                            $k = ":pem_$idx";
                            $ePlaceholders[] = "email = $k";
                            $pParams[$k] = $em;
                        }
                        $pConds[] = "(" . implode(' OR ', $ePlaceholders) . ")";
                    }

                    $sqlParent = "SELECT id, role FROM users WHERE school_id = :sid AND UPPER(role) = 'PARENT' AND (" . implode(' OR ', $pConds) . ")";
                    $stmtP = $pdo->prepare($sqlParent);
                    $stmtP->execute($pParams);
                    $parents = $stmtP->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($parents as $p) {
                        $pId = (int)$p['id'];
                        if (!isset($addedUserIds[$pId])) {
                            $recipients[] = [
                                'user_id' => $pId,
                                'role' => $p['role']
                            ];
                            $addedUserIds[$pId] = true;
                        }
                    }
                }

                // B. Match STUDENT user account ONLY if student_mobile or student_email matches specifically for THIS student
                if (!empty($studentPhones) || !empty($studentEmails)) {
                    $sConds = [];
                    $sParams = [':sid' => $schoolId];

                    if (!empty($studentPhones)) {
                        $sPlaceholders = [];
                        foreach ($studentPhones as $idx => $sph) {
                            $k = ":sph_$idx";
                            $sPlaceholders[] = "phone = $k";
                            $sParams[$k] = $sph;
                        }
                        $sConds[] = "(" . implode(' OR ', $sPlaceholders) . ")";
                    }
                    if (!empty($studentEmails)) {
                        $sePlaceholders = [];
                        foreach ($studentEmails as $idx => $sem) {
                            $k = ":sem_$idx";
                            $sePlaceholders[] = "email = $k";
                            $sParams[$k] = $sem;
                        }
                        $sConds[] = "(" . implode(' OR ', $sePlaceholders) . ")";
                    }

                    $sqlStudent = "SELECT id, role FROM users WHERE school_id = :sid AND UPPER(role) = 'STUDENT' AND (" . implode(' OR ', $sConds) . ")";
                    $stmtS = $pdo->prepare($sqlStudent);
                    $stmtS->execute($sParams);
                    $students = $stmtS->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($students as $s) {
                        $sId = (int)$s['id'];
                        if (!isset($addedUserIds[$sId])) {
                            $recipients[] = [
                                'user_id' => $sId,
                                'role' => $s['role']
                            ];
                            $addedUserIds[$sId] = true;
                        }
                    }
                }
            }
        }

        return $recipients;
    }

    private function createNotification(PDO $pdo, int $schoolId, string $role, string $title, string $message, ?string $link = null, ?string $eventKey = null): void
    {
        $stmt = $pdo->prepare("
            INSERT INTO dashboard_notifications (school_id, user_role, title, message, link, category, event_key, is_read)
            VALUES (:school_id, :user_role, :title, :message, :link, :category, :event_key, 0)
        ");
        $stmt->execute([
            ':school_id' => $schoolId,
            ':user_role' => $role,
            ':title' => $title,
            ':message' => $message,
            ':link' => $link,
            ':category' => $eventKey !== null ? NotificationCatalog::categoryFor($eventKey) : null,
            ':event_key' => $eventKey,
        ]);

        if ($eventKey !== null) {
            PushDispatcher::pushOnly($pdo, $schoolId, $role, null, $eventKey, $title, $message, $link);
        }
    }
}
