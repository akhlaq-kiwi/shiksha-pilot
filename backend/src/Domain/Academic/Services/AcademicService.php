<?php

namespace App\Domain\Academic\Services;

use App\Shared\BaseService;
use PDO;
use DateTime;

class AcademicService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    // --- Academic Years ---

    public function getAcademicYears(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $file = __DIR__ . '/../../../../mock_academic_years.json';
            if (file_exists($file)) {
                return json_decode(file_get_contents($file), true) ?: [];
            }
            return [
                ['id' => 1, 'school_id' => $schoolId, 'year_range' => '2025-2026', 'status' => 'Archived', 'is_active' => 0],
                ['id' => 2, 'school_id' => $schoolId, 'year_range' => '2026-2027', 'status' => 'Active', 'is_active' => 1]
            ];
        }

        $stmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :school_id ORDER BY id ASC");
        $stmt->execute(['school_id' => $schoolId]);
        return $stmt->fetchAll();
    }

    public function createAcademicYear(int $schoolId, array $data, string $performedBy): array
    {
        $range = $data['year_range'] ?? '';
        $startDate = $data['start_date'] ?? null;
        $endDate = $data['end_date'] ?? null;
        $description = $data['description'] ?? null;

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Academic year added successfully in sandbox', 'year_range' => $range];
        }

        if (empty($range)) {
            $maxStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE school_id = :school_id ORDER BY id DESC LIMIT 1");
            $maxStmt->execute(['school_id' => $schoolId]);
            $latest = $maxStmt->fetch();
            if ($latest) {
                $parts = explode('-', $latest['year_range']);
                $start = (int)$parts[0];
                if ($start) {
                    $range = ($start + 1) . '-' . ($start + 2);
                }
            }
            if (empty($range)) {
                $range = date('Y') . '-' . (date('Y') + 1);
            }
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM academic_years WHERE school_id = :school_id AND year_range = :range");
        $chk->execute(['school_id' => $schoolId, 'range' => $range]);
        if ($chk->fetchColumn() > 0) {
            throw new \Exception('Academic year range already exists', 400);
        }

        $feeStructure = $data['fee_structure'] ?? null;
        $feeStructureJson = null;
        if ($feeStructure) {
            $feeStructureJson = is_array($feeStructure) ? json_encode($feeStructure) : $feeStructure;
        } else {
            $feeStructureJson = json_encode([
                "April" => 0, "May" => 0, "June" => 0, "July" => 0, "August" => 0, 
                "September" => 0, "October" => 0, "November" => 0, "December" => 0, 
                "January" => 0, "February" => 0, "March" => 0
            ]);
        }

        $stmt = $pdo->prepare("INSERT INTO academic_years (school_id, year_range, start_date, end_date, description, status, fee_structure, is_active) VALUES (:school_id, :range, :start_date, :end_date, :description, 'Draft', :fee_structure, 0)");
        $stmt->execute([
            'school_id' => $schoolId,
            'range' => $range,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'description' => $description,
            'fee_structure' => $feeStructureJson
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Add Year', "Created academic year session $range in Draft status.");

        return ['message' => 'Year added successfully', 'year_range' => $range];
    }

    public function activateAcademicYear(int $schoolId, int $id, array $data, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Academic year activated successfully in sandbox', 'details' => 'Sandbox activate.'];
        }

        $pdo->beginTransaction();
        try {
            $targetStmt = $pdo->prepare("SELECT * FROM academic_years WHERE id = :id AND school_id = :school_id");
            $targetStmt->execute(['id' => $id, 'school_id' => $schoolId]);
            $targetYear = $targetStmt->fetch();
            if (!$targetYear) {
                $pdo->rollBack();
                throw new \Exception('Academic year not found', 404);
            }

            $currStmt = $pdo->prepare("SELECT * FROM academic_years WHERE school_id = :school_id AND status = 'Active'");
            $currStmt->execute(['school_id' => $schoolId]);
            $currYear = $currStmt->fetch();
            $old_ay_id = $currYear ? (int)$currYear['id'] : null;

            if ($old_ay_id) {
                $archStmt = $pdo->prepare("UPDATE academic_years SET status = 'Archived', is_active = 0 WHERE id = :id");
                $archStmt->execute(['id' => $old_ay_id]);
            }

            $actStmt = $pdo->prepare("UPDATE academic_years SET status = 'Active', is_active = 1 WHERE id = :id");
            $actStmt->execute(['id' => $targetYear['id']]);

            $promotedCount = 0;
            $repeatingCount = 0;
            $graduatedCount = 0;

            if ($old_ay_id) {
                $studentsStmt = $pdo->prepare("SELECT * FROM students WHERE school_id = :school_id AND academic_year_id = :ay_id");
                $studentsStmt->execute(['school_id' => $schoolId, 'ay_id' => $old_ay_id]);
                $oldStudents = $studentsStmt->fetchAll();

                $classMappings = $data['class_mappings'] ?? [];
                $studentStatus = $data['student_status'] ?? [];

                $insStudent = $pdo->prepare("INSERT INTO students (
                    school_id, academic_year_id, class_id, group_name, gender, name, roll_number, sr_no, phone, email, 
                    country, state, city, status, father_name, mother_name, address, date_of_birth, admission_date, 
                    emergency_contact, blood_group, aadhaar_number, nationality, caste, profile_image
                ) VALUES (
                    :school_id, :academic_year_id, :class_id, :group_name, :gender, :name, :roll_number, :sr_no, :phone, :email, 
                    :country, :state, :city, :status, :father_name, :mother_name, :address, :date_of_birth, :admission_date, 
                    :emergency_contact, :blood_group, :aadhaar_number, :nationality, :caste, :profile_image
                )");

                $updOldStudent = $pdo->prepare("UPDATE students SET status = :status WHERE id = :id");

                $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
                $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
                $insFees = $pdo->prepare("INSERT INTO fee_records (school_id, student_id, academic_year_id, month, amount, status, due_date) VALUES (:school_id, :student_id, :ay_id, :month, :amount, 'Pending', :due_date)");

                $rangeParts = explode('-', $targetYear['year_range']);
                $startYear = (int)$rangeParts[0];
                if (!$startYear) $startYear = (int)date('Y');

                foreach ($oldStudents as $student) {
                    $studId = $student['id'];
                    $oldClassId = $student['class_id'];

                    $statusChoice = $studentStatus[$studId] ?? null;
                    if (!$statusChoice) {
                        $mappedClass = $classMappings[$oldClassId] ?? null;
                        if ($mappedClass === 'Alumni' || $mappedClass === 'Alumni / Passed Out') {
                            $statusChoice = 'graduate';
                        } else {
                            $statusChoice = 'promote';
                        }
                    }

                    $newClassId = $oldClassId;
                    $newStatus = 'Active';

                    if ($statusChoice === 'graduate') {
                        $newStatus = 'Alumni';
                        $graduatedCount++;
                    } else if ($statusChoice === 'repeat') {
                        $newClassId = $oldClassId;
                        $newStatus = 'Active';
                        $repeatingCount++;
                    } else {
                        $mappedClass = $classMappings[$oldClassId] ?? null;
                        if ($mappedClass === 'Alumni' || $mappedClass === 'Alumni / Passed Out' || !$mappedClass) {
                            $newStatus = 'Alumni';
                            $graduatedCount++;
                        } else {
                            $newClassId = (int)$mappedClass;
                            $newStatus = 'Active';
                            $promotedCount++;
                        }
                    }

                    if ($student['status'] === 'Inactive') {
                        $newStatus = 'Inactive';
                    }

                    if ($newStatus === 'Alumni' || $newStatus === 'Inactive') {
                        $updOldStudent->execute(['status' => $newStatus, 'id' => $studId]);

                        $unpaidTuitionStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND status = 'Pending'");
                        $unpaidTuitionStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                        $unpaidTuition = (float)$unpaidTuitionStmt->fetchColumn() ?: 0.00;

                        $unpaidExtraStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id WHERE sef.student_id = :student_id AND sef.academic_year_id = :ay_id AND sef.status = 'Pending'");
                        $unpaidExtraStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                        $unpaidExtra = (float)$unpaidExtraStmt->fetchColumn() ?: 0.00;

                        $totalPrevDues = $unpaidTuition + $unpaidExtra;
                        if ($totalPrevDues > 0.00) {
                            $insCF = $pdo->prepare("INSERT INTO carry_forward_dues (school_id, student_id, original_academic_year_id, amount, paid_amount, status) VALUES (:school_id, :student_id, :original_academic_year_id, :amount, 0.00, 'Pending')");
                            $insCF->execute([
                                'school_id' => $schoolId,
                                'student_id' => $studId,
                                'original_academic_year_id' => $old_ay_id,
                                'amount' => $totalPrevDues
                            ]);
                        }
                        continue;
                    }

                    $insStudent->execute([
                        'school_id' => $schoolId,
                        'academic_year_id' => $targetYear['id'],
                        'class_id' => $newClassId,
                        'group_name' => $student['group_name'],
                        'gender' => $student['gender'],
                        'name' => $student['name'],
                        'roll_number' => $student['roll_number'],
                        'sr_no' => $student['sr_no'],
                        'phone' => $student['phone'],
                        'email' => $student['email'],
                        'country' => $student['country'],
                        'state' => $student['state'],
                        'city' => $student['city'],
                        'status' => $newStatus,
                        'father_name' => $student['father_name'],
                        'mother_name' => $student['mother_name'],
                        'address' => $student['address'],
                        'date_of_birth' => $student['date_of_birth'],
                        'admission_date' => $student['admission_date'],
                        'emergency_contact' => $student['emergency_contact'],
                        'blood_group' => $student['blood_group'],
                        'aadhaar_number' => $student['aadhaar_number'],
                        'nationality' => $student['nationality'],
                        'caste' => $student['caste'],
                        'profile_image' => $student['profile_image']
                    ]);

                    $newStudentId = $pdo->lastInsertId();

                    $unpaidTuitionStmt = $pdo->prepare("SELECT SUM(amount) FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id AND status = 'Pending'");
                    $unpaidTuitionStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                    $unpaidTuition = (float)$unpaidTuitionStmt->fetchColumn() ?: 0.00;

                    $unpaidExtraStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id WHERE sef.student_id = :student_id AND sef.academic_year_id = :ay_id AND sef.status = 'Pending'");
                    $unpaidExtraStmt->execute(['student_id' => $studId, 'ay_id' => $old_ay_id]);
                    $unpaidExtra = (float)$unpaidExtraStmt->fetchColumn() ?: 0.00;

                    $totalPrevDues = $unpaidTuition + $unpaidExtra;
                    if ($totalPrevDues > 0.00) {
                        $insCF = $pdo->prepare("INSERT INTO carry_forward_dues (school_id, student_id, original_academic_year_id, amount, paid_amount, status) VALUES (:school_id, :student_id, :original_academic_year_id, :amount, 0.00, 'Pending')");
                        $insCF->execute([
                            'school_id' => $schoolId,
                            'student_id' => $newStudentId,
                            'original_academic_year_id' => $old_ay_id,
                            'amount' => $totalPrevDues
                        ]);
                    }

                    $oldCFStmt = $pdo->prepare("SELECT * FROM carry_forward_dues WHERE student_id = :student_id AND status = 'Pending'");
                    $oldCFStmt->execute(['student_id' => $studId]);
                    $oldCFs = $oldCFStmt->fetchAll();

                    if (!empty($oldCFs)) {
                        $insOldCF = $pdo->prepare("INSERT INTO carry_forward_dues (school_id, student_id, original_academic_year_id, amount, paid_amount, status) VALUES (:school_id, :student_id, :original_academic_year_id, :amount, :paid_amount, 'Pending')");
                        foreach ($oldCFs as $cf) {
                            $insOldCF->execute([
                                'school_id' => $schoolId,
                                'student_id' => $newStudentId,
                                'original_academic_year_id' => $cf['original_academic_year_id'],
                                'amount' => $cf['amount'],
                                'paid_amount' => $cf['paid_amount']
                            ]);
                        }
                    }

                    if ($newStatus === 'Active') {
                        $cfStmt->execute([
                            'school_id' => $schoolId,
                            'ay_id' => $targetYear['id'],
                            'class_id' => $newClassId
                        ]);
                        $cfRes = $cfStmt->fetch();
                        $targetFeeStructure = [];
                        if ($cfRes) {
                            $targetFeeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
                        }

                        foreach ($months as $idx => $m) {
                            $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
                            $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
                            $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
                            $amount = isset($targetFeeStructure[$m]) ? (float)$targetFeeStructure[$m] : 0.00;
                            $insFees->execute([
                                'school_id' => $schoolId,
                                'student_id' => $newStudentId,
                                'ay_id' => $targetYear['id'],
                                'month' => $m,
                                'amount' => $amount,
                                'due_date' => $dueDate
                            ]);
                        }
                    }
                }
                $auditDetails = "Transitioned school session to {$targetYear['year_range']}. Promoted $promotedCount, repeating $repeatingCount, graduated $graduatedCount.";
            } else {
                $auditDetails = "Initialized active school session {$targetYear['year_range']}. No students to transition.";
            }

            $this->logAudit($pdo, $schoolId, $performedBy, 'Year Transition', $auditDetails);
            $pdo->commit();

            return ['message' => 'Academic year activated successfully', 'details' => $auditDetails];
        } catch (\Exception $e) {
            $pdo->rollBack();
            throw new \Exception('Activation transaction failed: ' . $e->getMessage(), 500);
        }
    }

    public function archiveAcademicYear(int $schoolId, int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Academic year archived successfully'];
        }

        $stmt = $pdo->prepare("UPDATE academic_years SET status = 'Archived', is_active = 0 WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $id, 'school_id' => $schoolId]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Archive Year', "Archived Academic Year ID $id.");

        return ['message' => 'Academic year archived successfully'];
    }

    // --- Classrooms ---

    public function getClassrooms(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $file = __DIR__ . '/../../../../mock_classes.json';
            if (file_exists($file)) {
                return json_decode(file_get_contents($file), true) ?: [];
            }
            return [
                ['id' => 1, 'school_id' => $schoolId, 'name' => 'Grade 1', 'room' => '101', 'class_teacher_id' => null, 'class_teacher_name' => '-']
            ];
        }

        $stmt = $pdo->prepare("
            SELECT c.*, t.name AS class_teacher_name, t.phone AS class_teacher_contact 
            FROM classrooms c
            LEFT JOIN teachers t ON c.class_teacher_id = t.id
            WHERE c.school_id = :school_id
        ");
        $stmt->execute(['school_id' => $schoolId]);
        $classes = $stmt->fetchAll();

        foreach ($classes as &$c) {
            $c['groups'] = [];
            $c['class_teacher_id'] = $c['class_teacher_id'] ? (int)$c['class_teacher_id'] : null;
        }
        return $classes;
    }

    public function createClassroom(int $schoolId, array $data, string $performedBy): array
    {
        $name = trim($data['name'] ?? '');
        $room = trim($data['room'] ?? '');
        $classTeacherId = $data['class_teacher_id'] ?? null;

        if (empty($name)) {
            throw new \InvalidArgumentException('Classroom name required', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Classroom created successfully in sandbox'];
        }

        $chkStmt = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE school_id = :school_id AND LOWER(name) = LOWER(:name)");
        $chkStmt->execute(['school_id' => $schoolId, 'name' => $name]);
        if ($chkStmt->fetchColumn() > 0) {
            throw new \Exception('Class name already exists', 400);
        }

        $stmt = $pdo->prepare("INSERT INTO classrooms (school_id, name, room, class_teacher_id) VALUES (:school_id, :name, :room, :class_teacher_id)");
        $stmt->execute([
            'school_id' => $schoolId,
            'name' => $name,
            'room' => $room,
            'class_teacher_id' => $classTeacherId ? (int)$classTeacherId : null
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Add Class', "Created classroom $name ($room).");

        return ['message' => 'Classroom created successfully'];
    }

    public function updateClassroom(int $schoolId, int $id, array $data, string $performedBy): array
    {
        $name = trim($data['name'] ?? '');
        $classTeacherId = $data['class_teacher_id'] ?? null;

        if (empty($name)) {
            throw new \InvalidArgumentException('Classroom name required', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Classroom updated successfully'];
        }

        $chk = $pdo->prepare("SELECT name FROM classrooms WHERE id = :id AND school_id = :school_id");
        $chk->execute(['id' => $id, 'school_id' => $schoolId]);
        $oldName = $chk->fetchColumn();
        if (!$oldName) {
            throw new \Exception('Class not found', 404);
        }

        $chkStmt = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE school_id = :school_id AND LOWER(name) = LOWER(:name) AND id != :id");
        $chkStmt->execute(['school_id' => $schoolId, 'name' => $name, 'id' => $id]);
        if ($chkStmt->fetchColumn() > 0) {
            throw new \Exception('Class name already exists', 400);
        }

        $stmt = $pdo->prepare("UPDATE classrooms SET name = :name, class_teacher_id = :class_teacher_id WHERE id = :id AND school_id = :school_id");
        $stmt->execute([
            'name' => $name,
            'class_teacher_id' => $classTeacherId ? (int)$classTeacherId : null,
            'id' => $id,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Update Class', "Updated classroom name from '$oldName' to '$name'.");

        return ['message' => 'Classroom updated successfully'];
    }

    public function deleteClassroom(int $schoolId, int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Class deleted successfully'];
        }

        $chk = $pdo->prepare("SELECT name FROM classrooms WHERE id = :id AND school_id = :school_id");
        $chk->execute(['id' => $id, 'school_id' => $schoolId]);
        $className = $chk->fetchColumn();
        if (!$className) {
            throw new \Exception('Class not found', 404);
        }

        if ($this->isClassroomLocked($pdo, $schoolId, $id)) {
            throw new \Exception('This classroom contains students with payments inside a finalized Financial Report and cannot be deleted.', 400);
        }

        $stmt = $pdo->prepare("DELETE FROM classrooms WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $id, 'school_id' => $schoolId]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Delete Class', "Deleted class $className (ID: $id) along with all cascade data.");

        return ['message' => 'Class deleted successfully'];
    }

    public function assignClassTeacher(int $schoolId, array $data, string $performedBy): array
    {
        $classId = (int)($data['class_id'] ?? 0);
        $teacherId = isset($data['teacher_id']) && $data['teacher_id'] !== '' ? (int)$data['teacher_id'] : null;

        if (!$classId) {
            throw new \InvalidArgumentException('class_id is required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['success' => true];
        }

        if ($teacherId !== null) {
            $chk = $pdo->prepare("SELECT COUNT(*) FROM teachers WHERE id = :tid AND school_id = :sid");
            $chk->execute(['tid' => $teacherId, 'sid' => $schoolId]);
            if ($chk->fetchColumn() == 0) {
                throw new \Exception('Teacher not found.', 404);
            }

            $chkTeach = $pdo->prepare("SELECT c.name FROM classrooms c JOIN teachers t ON c.class_teacher_id = t.id WHERE c.school_id = :sid AND c.class_teacher_id = :tid AND c.id != :cid");
            $chkTeach->execute(['sid' => $schoolId, 'tid' => $teacherId, 'cid' => $classId]);
            $existingClassName = $chkTeach->fetchColumn();
            if ($existingClassName) {
                throw new \Exception("This teacher is already assigned as Class Teacher for $existingClassName.", 400);
            }

            $stmt = $pdo->prepare("UPDATE classrooms SET class_teacher_id = :tid, class_teacher_assigned_at = CURDATE() WHERE id = :cid AND school_id = :sid");
            $stmt->execute([
                'tid' => $teacherId,
                'cid' => $classId,
                'sid' => $schoolId
            ]);

            $tName = $pdo->query("SELECT name FROM teachers WHERE id = $teacherId")->fetchColumn();
            $cName = $pdo->query("SELECT name FROM classrooms WHERE id = $classId")->fetchColumn();
            $this->logAudit($pdo, $schoolId, $performedBy, 'Assign Class Teacher', "Assigned $tName as class teacher for $cName.");
        } else {
            $cName = $pdo->query("SELECT name FROM classrooms WHERE id = $classId")->fetchColumn();
            $stmt = $pdo->prepare("UPDATE classrooms SET class_teacher_id = NULL, class_teacher_assigned_at = NULL WHERE id = :cid AND school_id = :sid");
            $stmt->execute([
                'cid' => $classId,
                'sid' => $schoolId
            ]);
            $this->logAudit($pdo, $schoolId, $performedBy, 'Remove Class Teacher', "Removed class teacher assignment for $cName.");
        }

        return ['success' => true];
    }

    // --- Teachers ---

    public function getTeachers(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $file = __DIR__ . '/../../../../mock_teachers.json';
            if (file_exists($file)) {
                return json_decode(file_get_contents($file), true) ?: [];
            }
            return [
                ['id' => 1, 'school_id' => $schoolId, 'name' => 'Mock Teacher A', 'subject' => 'Mathematics', 'status' => 'Active', 'phone' => '9876543211']
            ];
        }

        $stmt = $pdo->prepare("SELECT * FROM teachers WHERE school_id = :school_id");
        $stmt->execute(['school_id' => $schoolId]);
        return $stmt->fetchAll();
    }

    public function createTeacher(int $schoolId, array $data, string $performedBy): array
    {
        $name = $data['name'] ?? '';
        $subject = $data['subject'] ?? '';
        $salary = (float)($data['salary_amount'] ?? 3000.0);

        if (empty($name) || empty($subject)) {
            throw new \InvalidArgumentException('Teacher Name and Subject are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Teacher added successfully in sandbox'];
        }

        $stmt = $pdo->prepare("INSERT INTO teachers (school_id, name, gender, subject, phone, email, qualification, experience, aadhaar_number, pan_number, address, joining_date, exit_date, salary_amount, status, profile_image, documents) 
            VALUES (:school_id, :name, :gender, :subject, :phone, :email, :qualification, :experience, :aadhaar_number, :pan_number, :address, :joining_date, :exit_date, :salary_amount, 'Active', :profile_image, :documents)");
        $stmt->execute([
            'school_id' => $schoolId,
            'name' => $name,
            'gender' => $data['gender'] ?? 'Male',
            'subject' => $subject,
            'phone' => $data['phone'] ?? '',
            'email' => $data['email'] ?? '',
            'qualification' => $data['qualification'] ?? '',
            'experience' => $data['experience'] ?? '',
            'aadhaar_number' => $data['aadhaar_number'] ?? null,
            'pan_number' => $data['pan_number'] ?? null,
            'address' => $data['address'] ?? '',
            'joining_date' => $data['joining_date'] ?: date('Y-m-d'),
            'exit_date' => $data['exit_date'] ?: null,
            'salary_amount' => $salary,
            'profile_image' => $data['profile_image'] ?? null,
            'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Add Teacher', "Onboarded teacher $name.");

        return ['message' => 'Teacher added successfully'];
    }

    public function updateTeacher(int $schoolId, int $id, array $data, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Teacher updated successfully'];
        }

        if (isset($data['name']) || isset($data['subject'])) {
            $sql = "UPDATE teachers SET 
                name = :name, 
                gender = :gender,
                subject = :subject, 
                phone = :phone, 
                email = :email, 
                qualification = :qualification, 
                experience = :experience, 
                aadhaar_number = :aadhaar_number,
                pan_number = :pan_number,
                address = :address, 
                joining_date = :joining_date, 
                exit_date = :exit_date,
                salary_amount = :salary_amount,
                status = :status,
                profile_image = :profile_image,
                documents = :documents
                WHERE id = :id AND school_id = :school_id";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                'name' => $data['name'] ?? '',
                'gender' => $data['gender'] ?? 'Male',
                'subject' => $data['subject'] ?? '',
                'phone' => $data['phone'] ?? '',
                'email' => $data['email'] ?? '',
                'qualification' => $data['qualification'] ?? '',
                'experience' => $data['experience'] ?? '',
                'aadhaar_number' => $data['aadhaar_number'] ?? null,
                'pan_number' => $data['pan_number'] ?? null,
                'address' => $data['address'] ?? '',
                'joining_date' => $data['joining_date'] ?: null,
                'exit_date' => $data['exit_date'] ?: null,
                'salary_amount' => (float)($data['salary_amount'] ?? 3000.0),
                'status' => $data['status'] ?? 'Active',
                'profile_image' => $data['profile_image'] ?? null,
                'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null,
                'id' => $id,
                'school_id' => $schoolId
            ]);
            $this->logAudit($pdo, $schoolId, $performedBy, 'Modify Teacher', "Updated details of teacher $id.");
        } else {
            $status = $data['status'] ?? 'Active';
            $stmt = $pdo->prepare("UPDATE teachers SET status = :status WHERE id = :id AND school_id = :school_id");
            $stmt->execute(['status' => $status, 'id' => $id, 'school_id' => $schoolId]);
            $this->logAudit($pdo, $schoolId, $performedBy, 'Modify Teacher', "Updated status of teacher ID $id to $status.");
        }

        return ['message' => 'Teacher updated successfully'];
    }

    public function deleteTeacher(int $schoolId, int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Teacher deleted'];
        }

        if ($this->isTeacherLocked($pdo, $schoolId, $id)) {
            throw new \Exception('This teacher has salary disbursements inside a finalized Financial Report and cannot be deleted.', 400);
        }

        $stmt = $pdo->prepare("DELETE FROM teachers WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $id, 'school_id' => $schoolId]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Delete Teacher', "Removed teacher ID $id.");

        return ['message' => 'Teacher deleted'];
    }

    // --- Students ---

    public function getStudents(int $schoolId, ?int $ayId = null, ?int $classId = null): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $file = __DIR__ . '/../../../../mock_students.json';
            if (file_exists($file)) {
                return json_decode(file_get_contents($file), true) ?: [];
            }
            return [
                ['id' => 1, 'school_id' => $schoolId, 'academic_year_id' => 2, 'class_id' => 1, 'name' => 'Mock Student A', 'roll_number' => '101', 'status' => 'Active', 'phone' => '9876543210', 'total_dues' => 0.00, 'fee_status' => 'PAID']
            ];
        }

        $sql = "SELECT s.* FROM students s WHERE s.school_id = :school_id";
        $binds = ['school_id' => $schoolId];

        if ($ayId) {
            $sql .= " AND s.academic_year_id = :ay_id";
            $binds['ay_id'] = $ayId;
        }

        if ($classId) {
            $classChk = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :class_id AND school_id = :school_id");
            $classChk->execute(['class_id' => $classId, 'school_id' => $schoolId]);
            if ($classChk->fetchColumn() == 0) {
                throw new \Exception('The specified Class ID does not belong to your school.', 403);
            }
            $sql .= " AND s.class_id = :class_id";
            $binds['class_id'] = $classId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($binds);
        $students = $stmt->fetchAll();

        $now = new DateTime();
        $currentYear = (int)$now->format('Y');
        $currentMonth = (int)$now->format('n');

        $feeStmt = $pdo->prepare("SELECT due_date, status, amount FROM fee_records WHERE student_id = :student_id AND academic_year_id = :ay_id");
        $classFeeStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $extraFeeStmt = $pdo->prepare("SELECT SUM(eft.amount) FROM student_extra_fees sef
                                       JOIN extra_fee_types eft ON sef.extra_fee_type_id = eft.id
                                       WHERE sef.student_id = :student_id 
                                         AND sef.academic_year_id = :ay_id 
                                         AND sef.status = 'Pending'");

        foreach ($students as &$s) {
            $feeStmt->execute(['student_id' => $s['id'], 'ay_id' => $s['academic_year_id']]);
            $fees = $feeStmt->fetchAll();

            $pastUnpaidCount = 0;
            $isCurrentUnpaid = false;
            $totalUnpaid = 0;
            $totalDuesVal = 0.00;

            foreach ($fees as $f) {
                if ($f['status'] !== 'Paid') {
                    $parts = explode('-', $f['due_date']);
                    $dueY = isset($parts[0]) ? (int)$parts[0] : 0;
                    $dueM = isset($parts[1]) ? (int)$parts[1] : 0;

                    if ($dueY < $currentYear || ($dueY === $currentYear && $dueM <= $currentMonth)) {
                        $totalUnpaid++;
                        $totalDuesVal += (float)$f['amount'];

                        if ($dueY < $currentYear || ($dueY === $currentYear && $dueM < $currentMonth)) {
                            $pastUnpaidCount++;
                        } else if ($dueY === $currentYear && $dueM === $currentMonth) {
                            $isCurrentUnpaid = true;
                        }
                    }
                }
            }

            $extraFeeStmt->execute(['student_id' => $s['id'], 'ay_id' => $s['academic_year_id']]);
            $pendingExtraSum = (float)$extraFeeStmt->fetchColumn() ?: 0.00;
            $totalDuesVal += $pendingExtraSum;

            $s['total_dues'] = $totalDuesVal;

            $classFeeStmt->execute([
                'school_id' => $schoolId,
                'ay_id' => $s['academic_year_id'],
                'class_id' => $s['class_id']
            ]);
            $cfRes = $classFeeStmt->fetch();
            $monthlyFee = 0.00;
            $isConfigured = false;
            if ($cfRes) {
                $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
                $monthlyFee = isset($feeStructure['April']) ? (float)$feeStructure['April'] : 0.00;
                $isConfigured = true;
            }
            $s['monthly_fee'] = $monthlyFee;

            if (!$isConfigured) {
                $s['fee_status'] = 'FEE NOT SET';
            } else if ($totalUnpaid === 0) {
                $s['fee_status'] = 'PAID';
            } else if ($totalUnpaid === 1) {
                $s['fee_status'] = $isCurrentUnpaid ? 'DUES PENDING' : 'PAYMENT OVERDUE';
            } else if ($totalUnpaid === 2) {
                $s['fee_status'] = 'CRITICAL DUES';
            } else {
                $s['fee_status'] = 'DEFAULT ALERT';
            }
        }

        return $students;
    }

    public function createStudent(int $schoolId, array $data, string $performedBy): array
    {
        $name = trim($data['name'] ?? '');
        $roll = trim($data['roll_number'] ?? '');
        $class_id = (int)($data['class_id'] ?? 0);
        $ay_id = (int)($data['academic_year_id'] ?? 0);

        if (empty($name) || empty($roll) || !$class_id || !$ay_id) {
            throw new \InvalidArgumentException('Name, Roll, Class and Academic Year are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Student admitted successfully in sandbox'];
        }

        $classChk = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :class_id AND school_id = :school_id");
        $classChk->execute(['class_id' => $class_id, 'school_id' => $schoolId]);
        if ($classChk->fetchColumn() == 0) {
            throw new \Exception('The specified Class ID does not belong to your school.', 403);
        }

        $ayChk = $pdo->prepare("SELECT COUNT(*) FROM academic_years WHERE id = :ay_id AND school_id = :school_id");
        $ayChk->execute(['ay_id' => $ay_id, 'school_id' => $schoolId]);
        if ($ayChk->fetchColumn() == 0) {
            throw new \Exception('The specified Academic Year ID does not belong to your school.', 403);
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND roll_number = :roll AND academic_year_id = :ay_id");
        $chk->execute(['school_id' => $schoolId, 'roll' => $roll, 'ay_id' => $ay_id]);
        if ($chk->fetchColumn() > 0) {
            throw new \Exception('Duplicate Roll Number detected in this session!', 400);
        }

        $exit_date = isset($data['exit_date']) && trim($data['exit_date']) !== '' ? trim($data['exit_date']) : null;
        $status = ($exit_date !== null) ? 'Inactive' : 'Active';

        $stmt = $pdo->prepare("INSERT INTO students (school_id, academic_year_id, class_id, group_name, gender, name, roll_number, sr_no, phone, email, country, state, city, father_name, mother_name, address, date_of_birth, admission_date, exit_date, status, emergency_contact, blood_group, aadhaar_number, nationality, caste, profile_image, documents) VALUES (:school_id, :ay_id, :class_id, :group_name, :gender, :name, :roll, :sr_no, :phone, :email, :country, :state, :city, :father, :mother, :address, :dob, :adm_date, :exit_date, :status, :emergency, :blood, :aadhaar, :nationality, :caste, :profile_image, :documents)");
        $stmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ay_id,
            'class_id' => $class_id,
            'group_name' => isset($data['group_name']) ? (trim($data['group_name']) ?: null) : null,
            'gender' => $data['gender'] ?? 'Male',
            'name' => $name,
            'roll' => $roll,
            'sr_no' => $data['sr_no'] ?? null,
            'phone' => $data['phone'] ?? '',
            'email' => $data['email'] ?? '',
            'country' => $data['country'] ?? null,
            'state' => $data['state'] ?? null,
            'city' => $data['city'] ?? null,
            'father' => $data['father_name'] ?? '',
            'mother' => $data['mother_name'] ?? '',
            'address' => $data['address'] ?? '',
            'dob' => $data['date_of_birth'] ?? null,
            'adm_date' => $data['admission_date'] ?? date('Y-m-d'),
            'exit_date' => $exit_date,
            'status' => $status,
            'emergency' => $data['emergency_contact'] ?? '',
            'blood' => $data['blood_group'] ?? 'O+',
            'aadhaar' => $data['aadhaar_number'] ?? '',
            'nationality' => $data['nationality'] ?? 'Indian',
            'caste' => $data['caste'] ?? null,
            'profile_image' => $data['profile_image'] ?? null,
            'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null
        ]);

        $studentId = $pdo->lastInsertId();

        $ayStmt = $pdo->prepare("SELECT year_range FROM academic_years WHERE id = :id");
        $ayStmt->execute(['id' => $ay_id]);
        $ayInfo = $ayStmt->fetch();
        $startYear = (int)date('Y');
        if ($ayInfo) {
            $rangeParts = explode('-', $ayInfo['year_range']);
            $startYear = (int)$rangeParts[0] ?: $startYear;
        }

        $cfStmt = $pdo->prepare("SELECT fee_structure FROM class_fees WHERE school_id = :school_id AND academic_year_id = :ay_id AND class_id = :class_id");
        $cfStmt->execute([
            'school_id' => $schoolId,
            'ay_id' => $ay_id,
            'class_id' => $class_id
        ]);
        $cfRes = $cfStmt->fetch();
        $feeStructure = [];
        if ($cfRes) {
            $feeStructure = json_decode($cfRes['fee_structure'], true) ?: [];
        }

        $months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        $feeStmt = $pdo->prepare("INSERT INTO fee_records (school_id, student_id, academic_year_id, month, amount, status, due_date) VALUES (:school_id, :student_id, :ay_id, :month, :amount, 'Pending', :due_date)");
        foreach ($months as $idx => $m) {
            $mNum = ($idx + 4 > 12) ? ($idx - 8) : ($idx + 4);
            $mYear = ($idx <= 8) ? $startYear : ($startYear + 1);
            $dueDate = sprintf('%04d-%02d-15', $mYear, $mNum);
            $amount = isset($feeStructure[$m]) ? (float)$feeStructure[$m] : 0.00;
            $feeStmt->execute([
                'school_id' => $schoolId,
                'student_id' => $studentId,
                'ay_id' => $ay_id,
                'month' => $m,
                'amount' => $amount,
                'due_date' => $dueDate
            ]);
        }

        $this->logAudit($pdo, $schoolId, $performedBy, 'Admit Student', "Admitted student $name and pre-filled invoice ledger.");

        return ['message' => 'Student admitted successfully'];
    }

    public function updateStudent(int $schoolId, int $id, array $data, string $performedBy): array
    {
        $name = trim($data['name'] ?? '');
        $roll = trim($data['roll_number'] ?? '');
        $class_id = (int)($data['class_id'] ?? 0);

        if (empty($name) || empty($roll) || !$class_id) {
            throw new \InvalidArgumentException('Name, Roll, and Class are required.', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Student profile updated successfully'];
        }

        $chkStudent = $pdo->prepare("SELECT * FROM students WHERE id = :id AND school_id = :school_id");
        $chkStudent->execute(['id' => $id, 'school_id' => $schoolId]);
        $student = $chkStudent->fetch();
        if (!$student) {
            throw new \Exception('Student not found', 404);
        }

        $classChk = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :class_id AND school_id = :school_id");
        $classChk->execute(['class_id' => $class_id, 'school_id' => $schoolId]);
        if ($classChk->fetchColumn() == 0) {
            throw new \Exception('The specified Class ID does not belong to your school.', 403);
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM students WHERE school_id = :school_id AND roll_number = :roll AND academic_year_id = :ay_id AND id != :id");
        $chk->execute(['school_id' => $schoolId, 'roll' => $roll, 'ay_id' => $student['academic_year_id'], 'id' => $id]);
        if ($chk->fetchColumn() > 0) {
            throw new \Exception('Duplicate Roll Number detected in this session!', 400);
        }

        $exit_date = isset($data['exit_date']) && trim($data['exit_date']) !== '' ? trim($data['exit_date']) : null;
        $status = ($exit_date !== null) ? 'Inactive' : 'Active';

        $stmt = $pdo->prepare("
            UPDATE students 
            SET class_id = :class_id, group_name = :group_name, gender = :gender, name = :name, roll_number = :roll, sr_no = :sr_no, 
                phone = :phone, email = :email, country = :country, state = :state, city = :city,
                father_name = :father, mother_name = :mother, address = :address, 
                date_of_birth = :dob, admission_date = :adm_date, exit_date = :exit_date, status = :status, emergency_contact = :emergency, 
                blood_group = :blood, aadhaar_number = :aadhaar, nationality = :nationality, caste = :caste, profile_image = :profile_image,
                documents = :documents
            WHERE id = :id AND school_id = :school_id
        ");

        $stmt->execute([
            'class_id' => $class_id,
            'group_name' => isset($data['group_name']) ? (trim($data['group_name']) ?: null) : null,
            'gender' => $data['gender'] ?? 'Male',
            'name' => $name,
            'roll' => $roll,
            'sr_no' => $data['sr_no'] ?? null,
            'phone' => $data['phone'] ?? '',
            'email' => $data['email'] ?? '',
            'country' => $data['country'] ?? null,
            'state' => $data['state'] ?? null,
            'city' => $data['city'] ?? null,
            'father' => $data['father_name'] ?? '',
            'mother' => $data['mother_name'] ?? '',
            'address' => $data['address'] ?? '',
            'dob' => $data['date_of_birth'] ?? null,
            'adm_date' => $data['admission_date'] ?? date('Y-m-d'),
            'exit_date' => $exit_date,
            'status' => $status,
            'emergency' => $data['emergency_contact'] ?? '',
            'blood' => $data['blood_group'] ?? 'O+',
            'aadhaar' => $data['aadhaar_number'] ?? '',
            'nationality' => $data['nationality'] ?? 'Indian',
            'caste' => $data['caste'] ?? null,
            'profile_image' => $data['profile_image'] ?? null,
            'documents' => isset($data['documents']) ? (is_string($data['documents']) ? $data['documents'] : json_encode($data['documents'])) : null,
            'id' => $id,
            'school_id' => $schoolId
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Update Student', "Updated student profile $name (ID $id).");

        return ['message' => 'Student profile updated successfully'];
    }

    public function deleteStudent(int $schoolId, int $id, string $performedBy): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            return ['message' => 'Student removed'];
        }

        if ($this->isStudentLocked($pdo, $schoolId, $id)) {
            throw new \Exception('This student has payments inside a finalized Financial Report and cannot be deleted.', 400);
        }

        $stmt = $pdo->prepare("DELETE FROM students WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $id, 'school_id' => $schoolId]);

        $this->logAudit($pdo, $schoolId, $performedBy, 'Remove Student', "Deleted student profile ID $id.");

        return ['message' => 'Student removed'];
    }

    // --- Private Helper Methods ---

    private function logAudit(PDO $pdo, ?int $schoolId, string $username, string $action, string $details): void
    {
        try {
            $stmt = $pdo->prepare("INSERT INTO audit_logs (school_id, username, action, details) VALUES (:school_id, :username, :action, :details)");
            $stmt->execute([
                'school_id' => $schoolId,
                'username' => $username,
                'action' => $action,
                'details' => $details
            ]);
        } catch (\Exception $e) {}
    }

    private function isClassroomLocked(PDO $pdo, int $schoolId, int $classId): bool
    {
        if (function_exists('isClassroomLocked')) {
            return isClassroomLocked($pdo, $schoolId, $classId);
        }
        return false;
    }

    private function isTeacherLocked(PDO $pdo, int $schoolId, int $teacherId): bool
    {
        if (function_exists('isTeacherLocked')) {
            return isTeacherLocked($pdo, $schoolId, $teacherId);
        }
        return false;
    }

    private function isStudentLocked(PDO $pdo, int $schoolId, int $studentId): bool
    {
        if (function_exists('isStudentLocked')) {
            return isStudentLocked($pdo, $schoolId, $studentId);
        }
        return false;
    }
}
