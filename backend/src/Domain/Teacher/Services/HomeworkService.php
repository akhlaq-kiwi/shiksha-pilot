<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Services;

use App\Shared\BaseService;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Exceptions\NotFoundException;
use Psr\Log\LoggerInterface;
use PDO;

class HomeworkService extends BaseService
{
    private PDO $pdo;

    public function __construct(PDO $pdo, ?LoggerInterface $logger = null)
    {
        parent::__construct($logger);
        $this->pdo = $pdo;
    }

    private function syncExistingUploadsToWebRoot(string $targetWebDir): void
    {
        $candidateDirs = [
            dirname(__DIR__, 4) . '/public/uploads',
            dirname(__DIR__, 5) . '/backend/public/uploads',
            dirname(__DIR__, 4) . '/public/uploads/homework',
            dirname(__DIR__, 5) . '/backend/public/uploads/homework',
            dirname(__DIR__, 5) . '/public/uploads',
        ];

        foreach ($candidateDirs as $srcDir) {
            if ($srcDir === $targetWebDir || !is_dir($srcDir)) {
                continue;
            }
            $files = @glob($srcDir . '/*');
            if (is_array($files)) {
                foreach ($files as $file) {
                    if (is_file($file)) {
                        $dest = $targetWebDir . '/' . basename($file);
                        if (!file_exists($dest)) {
                            @copy($file, $dest);
                        }
                    }
                }
            }
        }
    }

    private function getUploadsDirectory(): string
    {
        $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
        if (!empty($docRoot) && is_dir($docRoot)) {
            $targetDir = rtrim($docRoot, '/\\') . '/uploads';
            if (!is_dir($targetDir)) {
                @mkdir($targetDir, 0777, true);
            }
            if (is_dir($targetDir) && is_writable($targetDir)) {
                $this->syncExistingUploadsToWebRoot($targetDir);
                return $targetDir;
            }
        }

        $baseDir = dirname(__DIR__, 4);
        $altPublic = dirname(__DIR__, 5) . '/public/uploads';
        if (is_dir($altPublic) && is_writable($altPublic)) {
            $this->syncExistingUploadsToWebRoot($altPublic);
            return $altPublic;
        }

        $targetDir = $baseDir . '/public/uploads';
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0777, true);
        }

        $this->syncExistingUploadsToWebRoot($targetDir);
        return $targetDir;
    }

    public function uploadAttachment($uploadedFile): array
    {
        if ($uploadedFile === null || $uploadedFile->getError() !== UPLOAD_ERR_OK) {
            throw new ValidationException(['file' => 'Unable to upload attachment. Please try again.'], 'Unable to upload attachment. Please try again.');
        }

        $originalFilename = $uploadedFile->getClientFilename();
        $extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
        $allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

        if (!in_array($extension, $allowedExtensions, true)) {
            throw new ValidationException(['file' => 'Unsupported file format.'], 'Unsupported file format.');
        }

        $size = $uploadedFile->getSize();
        if ($size > 10 * 1024 * 1024) { // 10MB limit
            throw new ValidationException(['file' => 'File size exceeds the allowed limit.'], 'File size exceeds the allowed limit.');
        }

        $directory = $this->getUploadsDirectory();
        $uniqueName = sprintf('hw_%s_%s.%s', bin2hex(random_bytes(8)), time(), $extension);
        $uploadedFile->moveTo($directory . DIRECTORY_SEPARATOR . $uniqueName);

        $fileType = ($extension === 'pdf') ? 'pdf' : 'image';

        return [
            'file_name' => $originalFilename,
            'file_path' => '/uploads/' . $uniqueName,
            'file_type' => $fileType,
            'file_size' => $size,
        ];
    }

    public function getTeacherHomework(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        // Fetch staff ID if teacher
        $teacherId = $userId;

        $stmt = $this->pdo->prepare("
            SELECT h.*, c.name AS class_name, c.section AS class_section,
                   (SELECT COUNT(*) FROM homework_attachments ha WHERE ha.homework_id = h.id) AS attachments_count
            FROM homework h
            LEFT JOIN classes c ON h.class_id = c.id
            WHERE h.school_id = :sid AND (h.teacher_id = :tid OR h.teacher_id = :uid)
            ORDER BY h.id DESC
        ");
        $stmt->execute([':sid' => $schoolId, ':tid' => $teacherId, ':uid' => $userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn($row) => $this->formatHomeworkRow($row), $rows);
    }

    public function getStudentHomework(array $user, ?int $headerStudentId = null): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        // Resolve student class_id
        $classId = null;
        $stmtStudent = $this->pdo->prepare("
            SELECT s.class_id, s.id AS student_id
            FROM students s
            JOIN users u ON u.school_id = s.school_id AND (
                u.phone = s.parent_phone OR u.phone = s.student_mobile OR u.phone = s.father_phone OR (u.email IS NOT NULL AND u.email = s.email)
            )
            WHERE u.id = :uid AND s.school_id = :sid " . ($headerStudentId ? "AND s.id = :header_sid " : "") . "
            LIMIT 1
        ");
        $params = [':uid' => $userId, ':sid' => $schoolId];
        if ($headerStudentId) {
            $params[':header_sid'] = $headerStudentId;
        }
        $stmtStudent->execute($params);
        $studentInfo = $stmtStudent->fetch(PDO::FETCH_ASSOC);

        if (!$studentInfo || empty($studentInfo['class_id'])) {
            // Fallback direct check on students table if user is student
            $stmtDirect = $this->pdo->prepare("SELECT class_id FROM students WHERE school_id = :sid " . ($headerStudentId ? "AND id = :header_sid " : "") . " LIMIT 1");
            $paramsDirect = [':sid' => $schoolId];
            if ($headerStudentId) {
                $paramsDirect[':header_sid'] = $headerStudentId;
            }
            $stmtDirect->execute($paramsDirect);
            $studentInfo = $stmtDirect->fetch(PDO::FETCH_ASSOC);
        }

        $classId = $studentInfo['class_id'] ?? null;

        if (!$classId) {
            return [];
        }

        $stmt = $this->pdo->prepare("
            SELECT h.*, c.name AS class_name, c.section AS class_section,
                   COALESCE(u.name, 'Teacher') AS teacher_name,
                   (SELECT COUNT(*) FROM homework_attachments ha WHERE ha.homework_id = h.id) AS attachments_count
            FROM homework h
            LEFT JOIN classes c ON h.class_id = c.id
            LEFT JOIN users u ON h.teacher_id = u.id
            WHERE h.school_id = :sid AND (h.class_id = :cid OR h.class_id IS NULL)
            ORDER BY h.id DESC
        ");
        $stmt->execute([':sid' => $schoolId, ':cid' => $classId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn($row) => $this->formatHomeworkRow($row), $rows);
    }

    public function createHomework(array $user, array $data): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        $title = trim((string)($data['title'] ?? ''));
        $description = trim((string)($data['description'] ?? ''));
        $classId = !empty($data['class_id']) ? (int)$data['class_id'] : null;
        $attachments = is_array($data['attachments'] ?? null) ? $data['attachments'] : [];

        if (empty($description) && empty($attachments)) {
            throw new ValidationException(['description' => 'Please enter a homework description or upload at least one attachment.'], 'Please enter a homework description or upload at least one attachment.');
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO homework (school_id, class_id, teacher_id, title, description)
            VALUES (:sid, :cid, :tid, :title, :desc)
        ");
        $stmt->execute([
            ':sid' => $schoolId,
            ':cid' => $classId,
            ':tid' => $userId,
            ':title' => !empty($title) ? $title : null,
            ':desc' => !empty($description) ? $description : null,
        ]);
        $homeworkId = (int)$this->pdo->lastInsertId();

        $this->saveAttachments($homeworkId, $attachments);

        // Send push notification to target class students & parents
        if ($classId) {
            $this->sendHomeworkNotification($schoolId, $classId, $homeworkId);
        }

        return $this->getHomeworkById($schoolId, $homeworkId);
    }

    public function updateHomework(array $user, int $id, array $data): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        $existing = $this->getHomeworkById($schoolId, $id);
        if (!$existing) {
            throw new NotFoundException('Homework not found');
        }

        $title = trim((string)($data['title'] ?? ''));
        $description = trim((string)($data['description'] ?? ''));
        $classId = !empty($data['class_id']) ? (int)$data['class_id'] : ($existing['class_id'] ?? null);
        $attachments = is_array($data['attachments'] ?? null) ? $data['attachments'] : [];

        if (empty($description) && empty($attachments)) {
            throw new ValidationException(['description' => 'Please enter a homework description or upload at least one attachment.'], 'Please enter a homework description or upload at least one attachment.');
        }

        $stmt = $this->pdo->prepare("
            UPDATE homework
            SET title = :title, description = :desc, class_id = :cid
            WHERE id = :id AND school_id = :sid
        ");
        $stmt->execute([
            ':title' => !empty($title) ? $title : null,
            ':desc' => !empty($description) ? $description : null,
            ':cid' => $classId,
            ':id' => $id,
            ':sid' => $schoolId,
        ]);

        // Remove old attachments and replace with updated set
        $stmtDel = $this->pdo->prepare("DELETE FROM homework_attachments WHERE homework_id = :hid");
        $stmtDel->execute([':hid' => $id]);

        $this->saveAttachments($id, $attachments);

        return $this->getHomeworkById($schoolId, $id);
    }

    public function deleteHomework(array $user, int $id): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $existing = $this->getHomeworkById($schoolId, $id);
        if (!$existing) {
            throw new NotFoundException('Homework not found');
        }

        // Delete physical attachment files from disk
        if (!empty($existing['attachments'])) {
            $uploadsDir = $this->getUploadsDirectory();
            foreach ($existing['attachments'] as $att) {
                if (!empty($att['file_path'])) {
                    $filename = basename($att['file_path']);
                    $fullPath = $uploadsDir . DIRECTORY_SEPARATOR . $filename;
                    if (file_exists($fullPath)) {
                        @unlink($fullPath);
                    }
                }
            }
        }

        $stmt = $this->pdo->prepare("DELETE FROM homework WHERE id = :id AND school_id = :sid");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);

        return ['status' => 'success', 'message' => 'Homework deleted successfully'];
    }

    private function getHomeworkById(int $schoolId, int $id): array
    {
        $stmt = $this->pdo->prepare("
            SELECT h.*, c.name AS class_name, c.section AS class_section,
                   COALESCE(u.name, 'Teacher') AS teacher_name,
                   (SELECT COUNT(*) FROM homework_attachments ha WHERE ha.homework_id = h.id) AS attachments_count
            FROM homework h
            LEFT JOIN classes c ON h.class_id = c.id
            LEFT JOIN users u ON h.teacher_id = u.id
            WHERE h.id = :id AND h.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->formatHomeworkRow($row) : [];
    }

    private function saveAttachments(int $homeworkId, array $attachments): void
    {
        if (empty($attachments)) return;

        $stmtAtt = $this->pdo->prepare("
            INSERT INTO homework_attachments (homework_id, file_name, file_path, file_type, file_size)
            VALUES (:hid, :fname, :fpath, :ftype, :fsize)
        ");

        foreach ($attachments as $att) {
            if (empty($att['file_name']) || empty($att['file_path'])) continue;
            $stmtAtt->execute([
                ':hid' => $homeworkId,
                ':fname' => $att['file_name'],
                ':fpath' => $att['file_path'],
                ':ftype' => $att['file_type'] ?? 'file',
                ':fsize' => (int)($att['file_size'] ?? 0),
            ]);
        }
    }

    private function formatHomeworkRow(array $row): array
    {
        $id = (int)$row['id'];

        // Fetch attachments
        $stmtAtt = $this->pdo->prepare("
            SELECT id, file_name, file_path, file_type, file_size
            FROM homework_attachments
            WHERE homework_id = :hid
            ORDER BY id ASC
        ");
        $stmtAtt->execute([':hid' => $id]);
        $attachments = $stmtAtt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $dt = new \DateTime($row['created_at'] ?? 'now');
        $assignedDate = $dt->format('d M Y'); // e.g. 05 Aug 2026
        $assignedTime = $dt->format('g:i A'); // e.g. 2:30 PM

        $className = !empty($row['class_name']) 
            ? $row['class_name'] . (!empty($row['class_section']) ? ' - ' . $row['class_section'] : '')
            : 'All Classes';

        return [
            'id' => $id,
            'school_id' => (int)$row['school_id'],
            'class_id' => $row['class_id'] !== null ? (int)$row['class_id'] : null,
            'class_name' => $className,
            'teacher_id' => $row['teacher_id'] !== null ? (int)$row['teacher_id'] : null,
            'teacher_name' => $row['teacher_name'] ?? 'Teacher',
            'title' => $row['title'] ?? '',
            'description' => $row['description'] ?? '',
            'assigned_date' => $assignedDate,
            'assigned_time' => $assignedTime,
            'created_at' => $row['created_at'],
            'attachments_count' => count($attachments),
            'attachments' => $attachments,
        ];
    }

    private function sendHomeworkNotification(int $schoolId, int $classId, int $homeworkId): void
    {
        $hw = $this->getHomeworkById($schoolId, $homeworkId);
        $subjectTitle = !empty($hw['title']) ? $hw['title'] : 'Homework';
        $className = !empty($hw['class_name']) ? $hw['class_name'] : '';

        // Query target student/parent user IDs for this class
        $stmtUsers = $this->pdo->prepare("
            SELECT DISTINCT u.id AS user_id, u.role
            FROM users u
            LEFT JOIN students s ON s.school_id = u.school_id AND (
                (s.student_mobile IS NOT NULL AND s.student_mobile != '' AND u.phone = s.student_mobile) OR
                (s.parent_phone IS NOT NULL AND s.parent_phone != '' AND u.phone = s.parent_phone) OR
                (s.father_phone IS NOT NULL AND s.father_phone != '' AND u.phone = s.father_phone) OR
                (s.guardian_phone IS NOT NULL AND s.guardian_phone != '' AND u.phone = s.guardian_phone) OR
                (s.email IS NOT NULL AND s.email != '' AND u.email = s.email)
            )
            WHERE u.school_id = :school_id
              AND u.role IN ('STUDENT', 'PARENT')
              AND (s.class_id = :class_id OR s.id IS NULL)
        ");
        $stmtUsers->execute([':class_id' => $classId, ':school_id' => $schoolId]);
        $targetUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $title = "New Homework: $subjectTitle";
        $message = "New homework assigned" . ($className ? " for $className" : "") . ". Tap to view.";
        $link = '/homework';

        $stmtIns = $this->pdo->prepare("
            INSERT INTO dashboard_notifications (school_id, user_id, user_role, title, message, link, is_read)
            VALUES (:sid, :uid, :role, :title, :msg, :link, 0)
        ");

        if (!empty($targetUsers)) {
            foreach ($targetUsers as $u) {
                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':uid' => $u['user_id'],
                    ':role' => $u['role'],
                    ':title' => $title,
                    ':msg' => $message,
                    ':link' => $link,
                ]);
            }
        } else {
            // Broadcast fallback only if no specific user mapping is found
            $stmtIns->execute([
                ':sid' => $schoolId,
                ':uid' => null,
                ':role' => 'STUDENT',
                ':title' => $title,
                ':msg' => $message,
                ':link' => $link,
            ]);
            $stmtIns->execute([
                ':sid' => $schoolId,
                ':uid' => null,
                ':role' => 'PARENT',
                ':title' => $title,
                ':msg' => $message,
                ':link' => $link,
            ]);
        }
    }
}
