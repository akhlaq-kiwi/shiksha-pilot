<?php

declare(strict_types=1);

namespace App\Domain\TestSeries\Services;

use App\Shared\BaseService;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Notifications\NotificationCatalog;
use App\Shared\Notifications\PushDispatcher;
use App\Shared\Storage\StorageService;
use PDO;
use Psr\Log\LoggerInterface;

class TestSeriesService extends BaseService
{
    public function __construct(
        private PDO $pdo,
        private StorageService $storage,
        ?LoggerInterface $logger = null,
    ) {
        parent::__construct($logger);
    }

    // -------------------------------------------------------------------------
    // Role, Principal & Permission Resolution
    // -------------------------------------------------------------------------

    private function resolveUserPhone(array $user): string
    {
        $phone = trim((string)($user['phone'] ?? ''));
        if ($phone !== '') {
            return $phone;
        }
        $uid = (int)($user['id'] ?? 0);
        if ($uid <= 0) {
            return '';
        }
        $stmt = $this->pdo->prepare("SELECT phone FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $uid]);
        return trim((string)($stmt->fetchColumn() ?: ''));
    }

    private function resolveStaffForUser(array $user): ?array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        if ($schoolId <= 0) {
            return null;
        }

        $phone = $this->resolveUserPhone($user);
        if ($phone === '') {
            return null;
        }

        $phoneDigits = preg_replace('/[^0-9]/', '', $phone) ?? '';
        $phone10 = strlen($phoneDigits) >= 10 ? substr($phoneDigits, -10) : '';

        $sql = "
            SELECT id, name, phone, email, role, department, is_principal, photo_path, status
            FROM staff
            WHERE school_id = :sid
              AND (status IS NULL OR status = '' OR UPPER(status) = 'ACTIVE')
              AND exit_date IS NULL
              AND (phone = :phone" . ($phone10 !== '' ? " OR RIGHT(phone, 10) = :phone10" : "") . ")
            ORDER BY id DESC
            LIMIT 1
        ";
        $params = [':sid' => $schoolId, ':phone' => $phone];
        if ($phone10 !== '') {
            $params[':phone10'] = $phone10;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function isPrincipal(array $user): bool
    {
        $role = strtoupper((string)($user['role'] ?? ''));
        if ($role === 'PRINCIPAL') {
            return true;
        }

        $staff = $this->resolveStaffForUser($user);
        if ($staff) {
            if ((int)($staff['is_principal'] ?? 0) === 1 || strtoupper((string)($staff['role'] ?? '')) === 'PRINCIPAL') {
                return true;
            }
        }

        return false;
    }

    public function canCreateTestSeries(array $user): bool
    {
        if ($this->isPrincipal($user)) {
            return true;
        }

        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        if ($schoolId <= 0 || $userId <= 0) {
            return false;
        }

        $staff = $this->resolveStaffForUser($user);
        if ($staff) {
            $stmt = $this->pdo->prepare("
                SELECT can_create
                FROM test_series_permissions
                WHERE school_id = :sid AND teacher_staff_id = :stid
                LIMIT 1
            ");
            $stmt->execute([':sid' => $schoolId, ':stid' => (int)$staff['id']]);
            $val = $stmt->fetchColumn();
            if ($val !== false && (int)$val === 1) {
                return true;
            }
        }

        $stmtUid = $this->pdo->prepare("
            SELECT can_create
            FROM test_series_permissions
            WHERE school_id = :sid AND user_id = :uid AND can_create = 1
            LIMIT 1
        ");
        $stmtUid->execute([':sid' => $schoolId, ':uid' => $userId]);
        return (int)$stmtUid->fetchColumn() === 1;
    }

    private function resolveCreatorDisplayName(array $user): string
    {
        $staff = $this->resolveStaffForUser($user);
        if ($staff && !empty($staff['name'])) {
            return trim((string)$staff['name']);
        }
        $uid = (int)($user['id'] ?? 0);
        if ($uid > 0) {
            $stmt = $this->pdo->prepare("SELECT name FROM users WHERE id = :id LIMIT 1");
            $stmt->execute([':id' => $uid]);
            $name = trim((string)($stmt->fetchColumn() ?: ''));
            if ($name !== '') {
                return $name;
            }
        }
        return 'Teacher';
    }

    private function getActiveAcademicYearId(int $schoolId): ?int
    {
        $stmt = $this->pdo->prepare("
            SELECT id
            FROM academic_years
            WHERE school_id = :sid AND (is_current = 1 OR UPPER(status) = 'ACTIVE')
            ORDER BY is_current DESC, id DESC
            LIMIT 1
        ");
        $stmt->execute([':sid' => $schoolId]);
        $id = $stmt->fetchColumn();
        return $id !== false ? (int)$id : null;
    }

    private function getActiveClasses(int $schoolId): array
    {
        $activeAyId = $this->getActiveAcademicYearId($schoolId);
        $nowStr = date('Y-m-d H:i:s');
        $sql = "
            SELECT c.id, c.name, c.section, c.academic_year_id,
                   COUNT(ts.id) AS total_tests,
                   COALESCE(SUM(CASE WHEN ts.id IS NOT NULL AND :now_live >= ts.starts_at AND :now_end < ts.ends_at THEN 1 ELSE 0 END), 0) AS live_tests
            FROM classes c
            LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
            LEFT JOIN test_series ts ON ts.class_id = c.id AND ts.school_id = c.school_id
            WHERE c.school_id = :sid
        ";
        $params = [
            ':now_live' => $nowStr,
            ':now_end' => $nowStr,
            ':sid' => $schoolId,
        ];
        if ($activeAyId !== null) {
            $sql .= " AND (c.academic_year_id = :ayid OR c.academic_year_id IS NULL)";
            $params[':ayid'] = $activeAyId;
        } else {
            $sql .= " AND (ay.is_current = 1 OR UPPER(ay.status) = 'ACTIVE' OR ay.id IS NULL)";
        }
        $sql .= " GROUP BY c.id, c.name, c.section, c.academic_year_id ORDER BY c.name ASC, c.section ASC, c.id ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(function (array $c): array {
            $name = trim((string)($c['name'] ?? ''));
            $section = trim((string)($c['section'] ?? ''));
            return [
                'id' => (int)$c['id'],
                'name' => $name,
                'section' => $section,
                'full_name' => $section !== '' ? ($name . ' - ' . $section) : $name,
                'total_tests' => (int)($c['total_tests'] ?? 0),
                'live_tests' => (int)($c['live_tests'] ?? 0),
            ];
        }, $rows);
    }

    public function getTeacherAccess(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $isPrincipal = $this->isPrincipal($user);
        $canCreate = $this->canCreateTestSeries($user);

        return [
            'is_principal' => $isPrincipal,
            'can_create' => $canCreate,
            'server_now' => date('Y-m-d H:i:s'),
            'classes' => $this->getActiveClasses($schoolId),
        ];
    }

    public function getPermissions(array $user): array
    {
        if (!$this->isPrincipal($user)) {
            throw new ForbiddenException('Only the Principal can manage Test Series creator permissions.');
        }

        $schoolId = (int)($user['school_id'] ?? 0);
        $stmt = $this->pdo->prepare("
            SELECT s.id AS staff_id, s.name, s.phone, s.department, s.role, s.is_principal, s.photo_path,
                   COALESCE(tsp.can_create, 0) AS can_create
            FROM staff s
            LEFT JOIN test_series_permissions tsp
                   ON tsp.school_id = s.school_id AND tsp.teacher_staff_id = s.id
            WHERE s.school_id = :sid
              AND (s.status IS NULL OR s.status = '' OR UPPER(s.status) = 'ACTIVE')
              AND s.exit_date IS NULL
            ORDER BY s.name ASC, s.id ASC
        ");
        $stmt->execute([':sid' => $schoolId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $teachers = [];
        foreach ($rows as $r) {
            $isRowPrincipal = ((int)($r['is_principal'] ?? 0) === 1) || strtoupper((string)($r['role'] ?? '')) === 'PRINCIPAL';
            if ($isRowPrincipal) {
                // Principal already has full creator access by default; exclude from delegation list
                continue;
            }
            $teachers[] = [
                'staff_id' => (int)$r['staff_id'],
                'name' => (string)($r['name'] ?? 'Teacher'),
                'phone' => (string)($r['phone'] ?? ''),
                'designation' => (string)($r['department'] ?? ''),
                'photo_path' => $r['photo_path'] ?? null,
                'is_principal' => false,
                'can_create' => ((int)($r['can_create'] ?? 0) === 1),
            ];
        }

        return [
            'teachers' => $teachers,
        ];
    }

    public function setPermission(array $user, array $body): array
    {
        if (!$this->isPrincipal($user)) {
            throw new ForbiddenException('Only the Principal can grant or revoke Test Series creation access.');
        }

        $schoolId = (int)($user['school_id'] ?? 0);
        $granterUserId = (int)($user['id'] ?? 0);
        $staffId = isset($body['staff_id']) ? (int)$body['staff_id'] : 0;
        $canCreate = !empty($body['can_create']) && $body['can_create'] !== '0' && $body['can_create'] !== 'false';

        if ($staffId <= 0) {
            throw new ValidationException(['staff_id' => 'Valid teacher staff_id is required.'], 'Valid teacher staff_id is required.');
        }

        $stmtStaff = $this->pdo->prepare("
            SELECT id, name, phone, is_principal, role
            FROM staff
            WHERE id = :stid AND school_id = :sid
              AND (status IS NULL OR status = '' OR UPPER(status) = 'ACTIVE')
              AND exit_date IS NULL
            LIMIT 1
        ");
        $stmtStaff->execute([':stid' => $staffId, ':sid' => $schoolId]);
        $staff = $stmtStaff->fetch(PDO::FETCH_ASSOC);
        if (!$staff) {
            throw new NotFoundException('Active teacher record not found.');
        }

        if (((int)($staff['is_principal'] ?? 0) === 1 || strtoupper((string)($staff['role'] ?? '')) === 'PRINCIPAL') && !$canCreate) {
            throw new ValidationException(['can_create' => 'Principal always retains Test Series creation access.'], 'Principal always retains Test Series creation access.');
        }

        $phone = trim((string)($staff['phone'] ?? ''));
        $targetUserId = null;
        if ($phone !== '') {
            $phone10 = substr(preg_replace('/[^0-9]/', '', $phone) ?? '', -10);
            $stmtUser = $this->pdo->prepare("
                SELECT id FROM users
                WHERE school_id = :sid AND (phone = :p" . (strlen($phone10) === 10 ? " OR RIGHT(phone, 10) = :p10" : "") . ")
                ORDER BY id DESC LIMIT 1
            ");
            $uParams = [':sid' => $schoolId, ':p' => $phone];
            if (strlen($phone10) === 10) {
                $uParams[':p10'] = $phone10;
            }
            $stmtUser->execute($uParams);
            $uidVal = $stmtUser->fetchColumn();
            if ($uidVal !== false) {
                $targetUserId = (int)$uidVal;
            }
        }

        $stmtUpsert = $this->pdo->prepare("
            INSERT INTO test_series_permissions (school_id, teacher_staff_id, user_id, can_create, granted_by_user_id)
            VALUES (:sid, :stid, :uid, :can_create, :granter)
            ON DUPLICATE KEY UPDATE
                can_create = VALUES(can_create),
                user_id = COALESCE(VALUES(user_id), user_id),
                granted_by_user_id = VALUES(granted_by_user_id)
        ");
        $stmtUpsert->execute([
            ':sid' => $schoolId,
            ':stid' => $staffId,
            ':uid' => $targetUserId,
            ':can_create' => $canCreate ? 1 : 0,
            ':granter' => $granterUserId,
        ]);

        return [
            'staff_id' => $staffId,
            'name' => (string)$staff['name'],
            'can_create' => $canCreate,
        ];
    }

    // -------------------------------------------------------------------------
    // Media Upload (Question & Option Images)
    // -------------------------------------------------------------------------

    public function uploadImage(array $user, $uploadedFile): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        $canUpload = $this->canCreateTestSeries($user);
        if (!$canUpload && $schoolId > 0 && $userId > 0) {
            // Creator can still upload images while editing an existing unclosed test series.
            $stmtOwn = $this->pdo->prepare("
                SELECT COUNT(*)
                FROM test_series
                WHERE school_id = :sid AND created_by_user_id = :uid AND ends_at > :now
            ");
            $stmtOwn->execute([':sid' => $schoolId, ':uid' => $userId, ':now' => date('Y-m-d H:i:s')]);
            $canUpload = (int)$stmtOwn->fetchColumn() > 0;
        }

        if (!$canUpload) {
            throw new ForbiddenException('You do not have permission to upload Test Series images. Ask the Principal for access.');
        }

        if ($uploadedFile === null || $uploadedFile->getError() !== UPLOAD_ERR_OK) {
            throw new ValidationException(['file' => 'Unable to upload image. Please try again.'], 'Unable to upload image. Please try again.');
        }

        $originalFilename = (string)$uploadedFile->getClientFilename();
        $extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

        if (!in_array($extension, $allowedExtensions, true)) {
            throw new ValidationException(['file' => 'Only JPG, PNG, WEBP, or GIF images are allowed.'], 'Only JPG, PNG, WEBP, or GIF images are allowed.');
        }

        $size = (int)$uploadedFile->getSize();
        if ($size <= 0 || $size > 2 * 1024 * 1024) {
            throw new ValidationException(['file' => 'File size cannot exceed 2 MB.'], 'File size cannot exceed 2 MB.');
        }

        $stored = $this->storage->storeUploadedFile($uploadedFile, StorageService::CATEGORY_TEST_SERIES, 'ts');

        return [
            'url' => $stored['url'],
            'filename' => $stored['filename'],
            'original_name' => $originalFilename,
            'size' => $stored['size'],
        ];
    }

    // -------------------------------------------------------------------------
    // Teacher / Principal CRUD & Listing
    // -------------------------------------------------------------------------

    private function computeStatus(string $startsAt, string $endsAt, ?int $nowTs = null): string
    {
        $now = $nowTs ?? time();
        $startTs = strtotime($startsAt);
        $endTs = strtotime($endsAt);
        if ($startTs !== false && $now < $startTs) {
            return 'UPCOMING';
        }
        if ($endTs !== false && $now >= $endTs) {
            return 'CLOSED';
        }
        return 'LIVE';
    }

    private function formatClassLabel(?string $name, ?string $section): string
    {
        $n = trim((string)($name ?? ''));
        $s = trim((string)($section ?? ''));
        if ($n === '') {
            return '';
        }
        return $s !== '' ? ($n . ' - ' . $s) : $n;
    }

    private function parseDateTime(mixed $value, string $field): string
    {
        $raw = trim((string)$value);
        if ($raw === '') {
            throw new ValidationException([$field => "The {$field} date & time is required."], "The {$field} date & time is required.");
        }
        $ts = strtotime($raw);
        if ($ts === false) {
            throw new ValidationException([$field => "Invalid {$field} date & time format."], "Invalid {$field} date & time format.");
        }
        return date('Y-m-d H:i:s', $ts);
    }

    private function validateQuestionsPayload(mixed $questions): array
    {
        if (!is_array($questions) || count($questions) === 0) {
            throw new ValidationException(['questions' => 'Please add at least 1 question.'], 'Please add at least 1 question.');
        }
        if (count($questions) > 100) {
            throw new ValidationException(['questions' => 'Maximum 100 questions allowed per Test Series.'], 'Maximum 100 questions allowed per Test Series.');
        }

        $normalized = [];
        foreach ($questions as $qIdx => $q) {
            if (!is_array($q)) {
                throw new ValidationException(['questions' => 'Invalid question format at item ' . ($qIdx + 1) . '.'], 'Invalid question format.');
            }
            $qNum = $qIdx + 1;
            $qText = trim((string)($q['question_text'] ?? ''));
            $qImage = trim((string)($q['question_image_url'] ?? ''));
            if ($qImage !== '' && !$this->storage->isOwnMedia($qImage)) {
                throw new ValidationException(["questions.{$qIdx}" => "Invalid question image reference in Question {$qNum}."], "Invalid question image reference in Question {$qNum}.");
            }
            if ($qText === '' && $qImage === '') {
                throw new ValidationException(["questions.{$qIdx}" => "Question {$qNum} must have text or an image."], "Question {$qNum} must have text or an image.");
            }

            $options = $q['options'] ?? [];
            if (!is_array($options) || count($options) < 2 || count($options) > 5) {
                throw new ValidationException(["questions.{$qIdx}.options" => "Question {$qNum} must have between 2 and 5 options."], "Question {$qNum} must have between 2 and 5 options.");
            }

            $correctCount = 0;
            $normOptions = [];
            foreach ($options as $oIdx => $opt) {
                if (!is_array($opt)) {
                    throw new ValidationException(["questions.{$qIdx}.options.{$oIdx}" => "Invalid option in Question {$qNum}."], "Invalid option in Question {$qNum}.");
                }
                $optNum = $oIdx + 1;
                $optLetter = chr(65 + $oIdx);
                $oText = trim((string)($opt['option_text'] ?? ''));
                $oImage = trim((string)($opt['option_image_url'] ?? ''));
                if ($oImage !== '' && !$this->storage->isOwnMedia($oImage)) {
                    throw new ValidationException(["questions.{$qIdx}.options.{$oIdx}" => "Invalid option image reference in Question {$qNum}, Option {$optLetter}."], "Invalid option image reference in Question {$qNum}.");
                }
                if ($oText === '' && $oImage === '') {
                    throw new ValidationException(["questions.{$qIdx}.options.{$oIdx}" => "Question {$qNum}, Option {$optLetter} needs text or an image."], "Question {$qNum}, Option {$optLetter} needs text or an image.");
                }

                $isCorrect = !empty($opt['is_correct']) && $opt['is_correct'] !== '0' && $opt['is_correct'] !== 'false';
                if ($isCorrect) {
                    $correctCount++;
                }

                $normOptions[] = [
                    'id' => isset($opt['id']) && is_numeric($opt['id']) ? (int)$opt['id'] : null,
                    'sort_order' => $optNum,
                    'option_text' => $oText !== '' ? $oText : null,
                    'option_image_url' => $oImage !== '' ? $oImage : null,
                    'is_correct' => $isCorrect ? 1 : 0,
                ];
            }

            if ($correctCount !== 1) {
                throw new ValidationException(["questions.{$qIdx}" => "Please select exactly 1 correct option for Question {$qNum}."], "Please select exactly 1 correct option for Question {$qNum}.");
            }

            $normalized[] = [
                'id' => isset($q['id']) && is_numeric($q['id']) ? (int)$q['id'] : null,
                'sort_order' => $qNum,
                'question_text' => $qText !== '' ? $qText : null,
                'question_image_url' => $qImage !== '' ? $qImage : null,
                'options' => $normOptions,
            ];
        }

        return $normalized;
    }

    private function parseNegativeConfig(array $body): array
    {
        $enabled = !empty($body['negative_marking_enabled'])
            && $body['negative_marking_enabled'] !== '0'
            && $body['negative_marking_enabled'] !== 'false';
        if (!$enabled) {
            return [false, 0.00];
        }

        $raw = $body['negative_mark_value'] ?? ($body['negative_mark_label'] ?? '');
        $str = trim((string)$raw);
        if ($str === '1' || $str === '1.0' || $str === '1.00') {
            return [true, 1.00];
        }
        if ($str === '1/2' || $str === '0.5' || $str === '0.50') {
            return [true, 0.50];
        }
        if ($str === '1/4' || $str === '0.25') {
            return [true, 0.25];
        }

        if (is_numeric($raw)) {
            $num = round((float)$raw, 2);
            if (abs($num - 1.0) < 0.01) {
                return [true, 1.00];
            }
            if (abs($num - 0.5) < 0.01) {
                return [true, 0.50];
            }
            if (abs($num - 0.25) < 0.01) {
                return [true, 0.25];
            }
        }

        throw new ValidationException(
            ['negative_mark_value' => 'Please select a valid negative mark deduction (1, 1/2, or 1/4).'],
            'Please select a valid negative mark deduction (1, 1/2, or 1/4).'
        );
    }

    private function formatNegativeLabel(float $val): string
    {
        if (abs($val - 1.0) < 0.01) {
            return '1';
        }
        if (abs($val - 0.5) < 0.01) {
            return '1/2';
        }
        if (abs($val - 0.25) < 0.01) {
            return '1/4';
        }
        return $val > 0 ? rtrim(rtrim(number_format($val, 2, '.', ''), '0'), '.') : '';
    }

    private function computeScoreBreakdown(
        int $correctCount,
        int $wrongCount,
        int $totalQuestions,
        bool $negEnabled,
        float $negValue
    ): array {
        $deductedMarks = ($negEnabled && $negValue > 0)
            ? round($wrongCount * $negValue, 2)
            : 0.0;
        $obtainedMarks = round((float)$correctCount - $deductedMarks, 2);
        $scorePercent = $totalQuestions > 0
            ? round(($obtainedMarks / $totalQuestions) * 100, 2)
            : 0.0;

        return [
            'obtained_marks' => $obtainedMarks,
            'deducted_marks' => $deductedMarks,
            'score_percent' => $scorePercent,
        ];
    }

    private function fetchAcademicYearAttendanceMap(
        int $schoolId,
        ?int $academicYearId,
        array $studentIds
    ): array {
        $cleanIds = array_values(array_unique(array_filter(array_map('intval', $studentIds), fn($id) => $id > 0)));
        if (empty($cleanIds)) {
            return [];
        }

        $ayStart = null;
        $ayEnd = null;
        $targetAyId = ($academicYearId !== null && $academicYearId > 0)
            ? $academicYearId
            : $this->getActiveAcademicYearId($schoolId);

        if ($targetAyId !== null && $targetAyId > 0) {
            $stmtAy = $this->pdo->prepare("
                SELECT start_date, end_date
                FROM academic_years
                WHERE id = :ayid AND school_id = :sid
                LIMIT 1
            ");
            $stmtAy->execute([':ayid' => $targetAyId, ':sid' => $schoolId]);
            $ay = $stmtAy->fetch(PDO::FETCH_ASSOC);
            if ($ay && !empty($ay['start_date']) && !empty($ay['end_date'])) {
                $ayStart = (string)$ay['start_date'];
                $ayEnd = (string)$ay['end_date'];
            }
        }

        $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
        $sql = "
            SELECT a.student_id,
                   COALESCE(SUM(CASE WHEN UPPER(a.status) IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END), 0) AS present_days
            FROM attendance a
            WHERE a.school_id = ?
              AND a.student_id IN ({$placeholders})
        ";
        $params = array_merge([$schoolId], $cleanIds);
        if ($ayStart !== null && $ayEnd !== null) {
            $sql .= " AND a.date BETWEEN ? AND ?";
            $params[] = $ayStart;
            $params[] = $ayEnd;
        }
        $sql .= " GROUP BY a.student_id";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $r) {
            $map[(int)$r['student_id']] = (int)$r['present_days'];
        }
        return $map;
    }

    private function sortAndRankAttempts(int $schoolId, array $seriesRow, array $rows): array
    {
        if (empty($rows)) {
            return [];
        }

        $negEnabled = ((int)($seriesRow['negative_marking_enabled'] ?? 0)) === 1;
        $negValue = (float)($seriesRow['negative_mark_value'] ?? 0.0);
        $totalQuestions = (int)($seriesRow['total_questions'] ?? 0);
        $ayId = isset($seriesRow['academic_year_id']) ? (int)$seriesRow['academic_year_id'] : null;

        $studentIds = array_map(fn($r) => (int)$r['student_id'], $rows);
        $attendanceMap = $this->fetchAcademicYearAttendanceMap($schoolId, $ayId, $studentIds);

        foreach ($rows as &$r) {
            $stuId = (int)$r['student_id'];
            $breakdown = $this->computeScoreBreakdown(
                (int)($r['correct_count'] ?? 0),
                (int)($r['wrong_count'] ?? 0),
                $totalQuestions,
                $negEnabled,
                $negValue
            );
            $r['_obtained_marks'] = $breakdown['obtained_marks'];
            $r['_deducted_marks'] = $breakdown['deducted_marks'];
            $r['_score_percent'] = $breakdown['score_percent'];
            $r['_attendance_present_days'] = $attendanceMap[$stuId] ?? 0;
        }
        unset($r);

        usort($rows, function (array $a, array $b): int {
            // 1. Higher obtained marks wins
            $scoreCmp = $b['_obtained_marks'] <=> $a['_obtained_marks'];
            if ($scoreCmp !== 0) {
                return $scoreCmp;
            }
            // 2. Tie-breaker 1: Faster completion time (fewer seconds) wins
            $timeCmp = ((int)$a['time_taken_seconds']) <=> ((int)$b['time_taken_seconds']);
            if ($timeCmp !== 0) {
                return $timeCmp;
            }
            // 3. Tie-breaker 2: Higher academic-year attendance (present days) wins
            $attCmp = ((int)$b['_attendance_present_days']) <=> ((int)$a['_attendance_present_days']);
            if ($attCmp !== 0) {
                return $attCmp;
            }
            // Deterministic display tie-order if all 3 metrics match
            $subCmp = strcmp((string)($a['submitted_at'] ?? ''), (string)($b['submitted_at'] ?? ''));
            if ($subCmp !== 0) {
                return $subCmp;
            }
            return ((int)($a['id'] ?? 0)) <=> ((int)($b['id'] ?? 0));
        });

        $counter = 0;
        $currentRank = 1;
        $prevKey = null;

        foreach ($rows as &$r) {
            $counter++;
            $tieKey = number_format((float)$r['_obtained_marks'], 2, '.', '')
                . '|' . (int)$r['time_taken_seconds']
                . '|' . (int)$r['_attendance_present_days'];
            if ($prevKey !== null && $tieKey !== $prevKey) {
                $currentRank = $counter;
            }
            $prevKey = $tieKey;
            $r['_rank'] = $currentRank;
        }
        unset($r);

        return $rows;
    }

    public function listForTeacher(array $user, array $params = []): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $isPrincipal = $this->isPrincipal($user);
        $canCreate = $this->canCreateTestSeries($user);
        $classFilter = isset($params['class_id']) && is_numeric($params['class_id']) ? (int)$params['class_id'] : null;
        $statusFilter = strtoupper(trim((string)($params['status'] ?? 'ALL')));

        $sql = "
            SELECT ts.id, ts.school_id, ts.class_id, ts.title, ts.description,
                   ts.created_by_user_id, ts.created_by_name,
                   ts.starts_at, ts.ends_at, ts.total_questions,
                   ts.show_timer, ts.negative_marking_enabled, ts.negative_mark_value,
                   (SELECT COUNT(*) FROM test_series_attempts a
                    WHERE a.test_series_id = ts.id AND a.status = 'SUBMITTED') AS submitted_count
            FROM test_series ts
            WHERE ts.school_id = :sid
        ";
        $bind = [':sid' => $schoolId];
        if ($classFilter !== null && $classFilter > 0) {
            $sql .= " AND ts.class_id = :cid";
            $bind[':cid'] = $classFilter;
        }
        $sql .= " ORDER BY ts.starts_at DESC, ts.id DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($bind);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $nowTs = time();
        $items = [];
        foreach ($rows as $row) {
            $status = $this->computeStatus((string)$row['starts_at'], (string)$row['ends_at'], $nowTs);
            if ($statusFilter !== '' && $statusFilter !== 'ALL' && $status !== $statusFilter) {
                continue;
            }

            $endTs = strtotime((string)$row['ends_at']) ?: $nowTs;
            $creatorUid = (int)$row['created_by_user_id'];
            $canEdit = ($creatorUid === $userId) && ($status !== 'CLOSED');
            $negEnabled = ((int)($row['negative_marking_enabled'] ?? 0)) === 1;
            $negValue = round((float)($row['negative_mark_value'] ?? 0), 2);

            $items[] = [
                'id' => (int)$row['id'],
                'class_id' => (int)$row['class_id'],
                'title' => (string)$row['title'],
                'description' => (string)($row['description'] ?? ''),
                'created_by_user_id' => $creatorUid,
                'created_by_name' => (string)($row['created_by_name'] ?? 'Teacher'),
                'starts_at' => (string)$row['starts_at'],
                'ends_at' => (string)$row['ends_at'],
                'status' => $status,
                'total_questions' => (int)$row['total_questions'],
                'show_timer' => ((int)($row['show_timer'] ?? 0)) === 1,
                'negative_marking_enabled' => $negEnabled,
                'negative_mark_value' => $negValue,
                'negative_mark_label' => $negEnabled ? $this->formatNegativeLabel($negValue) : '',
                'submitted_count' => (int)($row['submitted_count'] ?? 0),
                'can_edit' => $canEdit,
                'can_delete' => $isPrincipal,
                'seconds_remaining' => max(0, $endTs - $nowTs),
            ];
        }

        return [
            'is_principal' => $isPrincipal,
            'can_create' => $canCreate,
            'server_now' => date('Y-m-d H:i:s', $nowTs),
            'items' => $items,
        ];
    }

    private function loadSeriesHeader(int $schoolId, int $id): array
    {
        $stmt = $this->pdo->prepare("
            SELECT ts.*, c.name AS class_name, c.section AS class_section
            FROM test_series ts
            LEFT JOIN classes c ON ts.class_id = c.id
            WHERE ts.id = :id AND ts.school_id = :sid
            LIMIT 1
        ");
        $stmt->execute([':id' => $id, ':sid' => $schoolId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new NotFoundException('Test Series not found.');
        }
        return $row;
    }

    private function loadQuestionsWithOptions(int $testSeriesId, bool $includeCorrectFlag): array
    {
        $stmtQ = $this->pdo->prepare("
            SELECT id, test_series_id, sort_order, question_text, question_image_url
            FROM test_series_questions
            WHERE test_series_id = :tsid
            ORDER BY sort_order ASC, id ASC
        ");
        $stmtQ->execute([':tsid' => $testSeriesId]);
        $questions = $stmtQ->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (empty($questions)) {
            return [];
        }

        $qIds = array_map(fn($q) => (int)$q['id'], $questions);
        $inQ = implode(',', $qIds);

        $cols = $includeCorrectFlag
            ? 'id, question_id, sort_order, option_text, option_image_url, is_correct'
            : 'id, question_id, sort_order, option_text, option_image_url';

        $stmtO = $this->pdo->prepare("
            SELECT {$cols}
            FROM test_series_options
            WHERE question_id IN ({$inQ})
            ORDER BY sort_order ASC, id ASC
        ");
        $stmtO->execute();
        $opts = $stmtO->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $optMap = [];
        foreach ($opts as $o) {
            $qid = (int)$o['question_id'];
            $entry = [
                'id' => (int)$o['id'],
                'sort_order' => (int)$o['sort_order'],
                'option_text' => $o['option_text'] !== null ? (string)$o['option_text'] : '',
                'option_image_url' => $o['option_image_url'] !== null ? (string)$o['option_image_url'] : '',
            ];
            if ($includeCorrectFlag) {
                $entry['is_correct'] = ((int)$o['is_correct']) === 1;
            }
            $optMap[$qid][] = $entry;
        }

        $formatted = [];
        foreach ($questions as $q) {
            $qid = (int)$q['id'];
            $formatted[] = [
                'id' => $qid,
                'sort_order' => (int)$q['sort_order'],
                'question_text' => $q['question_text'] !== null ? (string)$q['question_text'] : '',
                'question_image_url' => $q['question_image_url'] !== null ? (string)$q['question_image_url'] : '',
                'options' => $optMap[$qid] ?? [],
            ];
        }
        return $formatted;
    }

    public function getTeacherTestSeriesDetail(array $user, int $id): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $isPrincipal = $this->isPrincipal($user);

        $row = $this->loadSeriesHeader($schoolId, $id);
        $status = $this->computeStatus((string)$row['starts_at'], (string)$row['ends_at']);
        $creatorUid = (int)$row['created_by_user_id'];
        $negEnabled = ((int)($row['negative_marking_enabled'] ?? 0)) === 1;
        $negValue = round((float)($row['negative_mark_value'] ?? 0), 2);

        return [
            'id' => (int)$row['id'],
            'class_id' => (int)$row['class_id'],
            'full_class_name' => $this->formatClassLabel($row['class_name'] ?? '', $row['class_section'] ?? ''),
            'title' => (string)$row['title'],
            'description' => (string)($row['description'] ?? ''),
            'created_by_user_id' => $creatorUid,
            'created_by_name' => (string)($row['created_by_name'] ?? 'Teacher'),
            'starts_at' => (string)$row['starts_at'],
            'ends_at' => (string)$row['ends_at'],
            'status' => $status,
            'total_questions' => (int)$row['total_questions'],
            'show_timer' => ((int)($row['show_timer'] ?? 0)) === 1,
            'negative_marking_enabled' => $negEnabled,
            'negative_mark_value' => $negValue,
            'negative_mark_label' => $negEnabled ? $this->formatNegativeLabel($negValue) : '',
            'can_edit' => ($creatorUid === $userId) && ($status !== 'CLOSED'),
            'can_delete' => $isPrincipal,
            'server_now' => date('Y-m-d H:i:s'),
            'questions' => $this->loadQuestionsWithOptions($id, true),
        ];
    }

    public function createTestSeries(array $user, array $body): array
    {
        if (!$this->canCreateTestSeries($user)) {
            throw new ForbiddenException('You do not have permission to create a Test Series. Please contact the Principal.');
        }

        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        $title = trim((string)($body['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 35) {
            throw new ValidationException(['title' => 'Please enter a valid Test Series title (max 35 characters).'], 'Please enter a valid Test Series title (max 35 characters).');
        }

        $classId = isset($body['class_id']) && is_numeric($body['class_id']) ? (int)$body['class_id'] : 0;
        if ($classId <= 0) {
            throw new ValidationException(['class_id' => 'Target class is required.'], 'Target class is required.');
        }

        $stmtClass = $this->pdo->prepare("SELECT id, name, section, academic_year_id FROM classes WHERE id = :cid AND school_id = :sid LIMIT 1");
        $stmtClass->execute([':cid' => $classId, ':sid' => $schoolId]);
        $classRow = $stmtClass->fetch(PDO::FETCH_ASSOC);
        if (!$classRow) {
            throw new ValidationException(['class_id' => 'Selected class does not belong to your school.'], 'Selected class does not belong to your school.');
        }

        $startsAt = $this->parseDateTime($body['starts_at'] ?? '', 'starts_at');
        $endsAt = $this->parseDateTime($body['ends_at'] ?? '', 'ends_at');

        $startsTs = strtotime($startsAt);
        $endsTs = strtotime($endsAt);
        $nowTs = time();
        $todayStartTs = strtotime(date('Y-m-d 00:00:00', $nowTs));

        // Block past calendar dates or past timestamps (allow a brief 3-minute grace for "Start Now" submits)
        if ($startsTs === false || $startsTs < $todayStartTs || $startsTs < ($nowTs - 180)) {
            throw new ValidationException(['starts_at' => 'Start date & time cannot be in the past.'], 'Start date & time cannot be in the past.');
        }
        if ($endsTs === false || $startsTs >= $endsTs) {
            throw new ValidationException(['ends_at' => 'End date & time must be after Start date & time.'], 'End date & time must be after Start date & time.');
        }
        if ($endsTs < $todayStartTs || $endsTs <= $nowTs) {
            throw new ValidationException(['ends_at' => 'End date & time must be in the future.'], 'End date & time must be in the future.');
        }

        $description = trim((string)($body['description'] ?? ''));
        $showTimer = !empty($body['show_timer']) && $body['show_timer'] !== '0' && $body['show_timer'] !== 'false' ? 1 : 0;
        [$negEnabled, $negValue] = $this->parseNegativeConfig($body);
        $questions = $this->validateQuestionsPayload($body['questions'] ?? []);
        $creatorName = $this->resolveCreatorDisplayName($user);
        $academicYearId = $classRow['academic_year_id'] !== null
            ? (int)$classRow['academic_year_id']
            : $this->getActiveAcademicYearId($schoolId);

        $this->pdo->beginTransaction();
        try {
            $stmtIns = $this->pdo->prepare("
                INSERT INTO test_series
                    (school_id, academic_year_id, class_id, title, subject_name, description,
                     created_by_user_id, created_by_name, starts_at, ends_at, total_questions,
                     show_timer, negative_marking_enabled, negative_mark_value)
                VALUES
                    (:sid, :ayid, :cid, :title, NULL, :descr, :uid, :uname, :starts, :ends, :qcount,
                     :show_timer, :neg_enabled, :neg_value)
            ");
            $stmtIns->execute([
                ':sid' => $schoolId,
                ':ayid' => $academicYearId,
                ':cid' => $classId,
                ':title' => $title,
                ':descr' => $description !== '' ? $description : null,
                ':uid' => $userId,
                ':uname' => $creatorName,
                ':starts' => $startsAt,
                ':ends' => $endsAt,
                ':qcount' => count($questions),
                ':show_timer' => $showTimer,
                ':neg_enabled' => $negEnabled ? 1 : 0,
                ':neg_value' => $negValue,
            ]);
            $testSeriesId = (int)$this->pdo->lastInsertId();

            $stmtQ = $this->pdo->prepare("
                INSERT INTO test_series_questions (test_series_id, sort_order, question_text, question_image_url)
                VALUES (:tsid, :sorder, :qtext, :qimg)
            ");
            $stmtO = $this->pdo->prepare("
                INSERT INTO test_series_options (question_id, sort_order, option_text, option_image_url, is_correct)
                VALUES (:qid, :sorder, :otext, :oimg, :is_corr)
            ");

            foreach ($questions as $q) {
                $stmtQ->execute([
                    ':tsid' => $testSeriesId,
                    ':sorder' => $q['sort_order'],
                    ':qtext' => $q['question_text'],
                    ':qimg' => $q['question_image_url'],
                ]);
                $qid = (int)$this->pdo->lastInsertId();
                foreach ($q['options'] as $opt) {
                    $stmtO->execute([
                        ':qid' => $qid,
                        ':sorder' => $opt['sort_order'],
                        ':otext' => $opt['option_text'],
                        ':oimg' => $opt['option_image_url'],
                        ':is_corr' => $opt['is_correct'],
                    ]);
                }
            }

            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        // Best-effort push + in-app notification to students & parents of target class
        $classLabel = $this->formatClassLabel($classRow['name'] ?? '', $classRow['section'] ?? '');
        $this->notifyClassTestSeriesPublished($schoolId, $classId, $classLabel, $title, $startsAt, $endsAt);

        return $this->getTeacherTestSeriesDetail($user, $testSeriesId);
    }

    public function updateTestSeries(array $user, int $id, array $body): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);

        $existing = $this->loadSeriesHeader($schoolId, $id);
        if ((int)$existing['created_by_user_id'] !== $userId) {
            throw new ForbiddenException('Only the teacher who created this Test Series can edit it.');
        }

        $nowTs = time();
        $existingEndTs = strtotime((string)$existing['ends_at']);
        if ($existingEndTs !== false && $nowTs >= $existingEndTs) {
            throw new ValidationException(['status' => 'This Test Series has already closed and cannot be edited.'], 'This Test Series has already closed and cannot be edited.');
        }

        $title = trim((string)($body['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 35) {
            throw new ValidationException(['title' => 'Please enter a valid Test Series title (max 35 characters).'], 'Please enter a valid Test Series title (max 35 characters).');
        }

        $classId = isset($body['class_id']) && is_numeric($body['class_id'])
            ? (int)$body['class_id']
            : (int)$existing['class_id'];

        $stmtClass = $this->pdo->prepare("SELECT id, name, section, academic_year_id FROM classes WHERE id = :cid AND school_id = :sid LIMIT 1");
        $stmtClass->execute([':cid' => $classId, ':sid' => $schoolId]);
        $classRow = $stmtClass->fetch(PDO::FETCH_ASSOC);
        if (!$classRow) {
            throw new ValidationException(['class_id' => 'Selected class does not belong to your school.'], 'Selected class does not belong to your school.');
        }

        // Start date & time stays locked to the original value after creation so editing title,
        // questions, or end date on a live test started on a prior day works without past-date errors.
        $startsAt = (string)$existing['starts_at'];
        $endsAt = $this->parseDateTime($body['ends_at'] ?? $existing['ends_at'], 'ends_at');

        $startsTs = strtotime($startsAt);
        $endsTs = strtotime($endsAt);
        $todayStartTs = strtotime(date('Y-m-d 00:00:00', $nowTs));

        if ($startsTs !== false && ($endsTs === false || $startsTs >= $endsTs)) {
            throw new ValidationException(['ends_at' => 'End date & time must be after Start date & time.'], 'End date & time must be after Start date & time.');
        }
        if ($endsTs === false || $endsTs < $todayStartTs || $endsTs <= $nowTs) {
            throw new ValidationException(['ends_at' => 'End date & time must remain in the future while editing.'], 'End date & time must remain in the future.');
        }

        $description = trim((string)($body['description'] ?? ''));
        $showTimer = !empty($body['show_timer']) && $body['show_timer'] !== '0' && $body['show_timer'] !== 'false' ? 1 : 0;
        [$negEnabled, $negValue] = $this->parseNegativeConfig($body);
        $questions = $this->validateQuestionsPayload($body['questions'] ?? []);

        // Track old media URLs so orphaned files can be deleted post-commit
        $oldMedia = $this->collectMediaUrls($id);

        $this->pdo->beginTransaction();
        try {
            $stmtUpd = $this->pdo->prepare("
                UPDATE test_series
                SET class_id = :cid,
                    academic_year_id = COALESCE(:ayid, academic_year_id),
                    title = :title,
                    subject_name = NULL,
                    description = :descr,
                    starts_at = :starts,
                    ends_at = :ends,
                    total_questions = :qcount,
                    show_timer = :show_timer,
                    negative_marking_enabled = :neg_enabled,
                    negative_mark_value = :neg_value
                WHERE id = :id AND school_id = :sid
            ");
            $stmtUpd->execute([
                ':cid' => $classId,
                ':ayid' => $classRow['academic_year_id'] !== null ? (int)$classRow['academic_year_id'] : null,
                ':title' => $title,
                ':descr' => $description !== '' ? $description : null,
                ':starts' => $startsAt,
                ':ends' => $endsAt,
                ':qcount' => count($questions),
                ':show_timer' => $showTimer,
                ':neg_enabled' => $negEnabled ? 1 : 0,
                ':neg_value' => $negValue,
                ':id' => $id,
                ':sid' => $schoolId,
            ]);

            $stmtExQ = $this->pdo->prepare("SELECT id FROM test_series_questions WHERE test_series_id = :tsid");
            $stmtExQ->execute([':tsid' => $id]);
            $existingQIds = array_map('intval', $stmtExQ->fetchAll(PDO::FETCH_COLUMN) ?: []);
            $existingQSet = array_flip($existingQIds);

            $stmtUpdQ = $this->pdo->prepare("
                UPDATE test_series_questions
                SET sort_order = :sorder, question_text = :qtext, question_image_url = :qimg
                WHERE id = :id AND test_series_id = :tsid
            ");
            $stmtInsQ = $this->pdo->prepare("
                INSERT INTO test_series_questions (test_series_id, sort_order, question_text, question_image_url)
                VALUES (:tsid, :sorder, :qtext, :qimg)
            ");

            $stmtExO = $this->pdo->prepare("SELECT id FROM test_series_options WHERE question_id = :qid");
            $stmtUpdO = $this->pdo->prepare("
                UPDATE test_series_options
                SET sort_order = :sorder, option_text = :otext, option_image_url = :oimg, is_correct = :is_corr
                WHERE id = :id AND question_id = :qid
            ");
            $stmtInsO = $this->pdo->prepare("
                INSERT INTO test_series_options (question_id, sort_order, option_text, option_image_url, is_correct)
                VALUES (:qid, :sorder, :otext, :oimg, :is_corr)
            ");

            $keptQIds = [];
            foreach ($questions as $q) {
                $qId = ($q['id'] !== null && isset($existingQSet[$q['id']])) ? (int)$q['id'] : 0;
                if ($qId > 0) {
                    $stmtUpdQ->execute([
                        ':sorder' => $q['sort_order'],
                        ':qtext' => $q['question_text'],
                        ':qimg' => $q['question_image_url'],
                        ':id' => $qId,
                        ':tsid' => $id,
                    ]);
                } else {
                    $stmtInsQ->execute([
                        ':tsid' => $id,
                        ':sorder' => $q['sort_order'],
                        ':qtext' => $q['question_text'],
                        ':qimg' => $q['question_image_url'],
                    ]);
                    $qId = (int)$this->pdo->lastInsertId();
                }
                $keptQIds[] = $qId;

                $stmtExO->execute([':qid' => $qId]);
                $existingOIds = array_map('intval', $stmtExO->fetchAll(PDO::FETCH_COLUMN) ?: []);
                $existingOSet = array_flip($existingOIds);

                $keptOIds = [];
                foreach ($q['options'] as $opt) {
                    $oId = ($opt['id'] !== null && isset($existingOSet[$opt['id']])) ? (int)$opt['id'] : 0;
                    if ($oId > 0) {
                        $stmtUpdO->execute([
                            ':sorder' => $opt['sort_order'],
                            ':otext' => $opt['option_text'],
                            ':oimg' => $opt['option_image_url'],
                            ':is_corr' => $opt['is_correct'],
                            ':id' => $oId,
                            ':qid' => $qId,
                        ]);
                    } else {
                        $stmtInsO->execute([
                            ':qid' => $qId,
                            ':sorder' => $opt['sort_order'],
                            ':otext' => $opt['option_text'],
                            ':oimg' => $opt['option_image_url'],
                            ':is_corr' => $opt['is_correct'],
                        ]);
                        $oId = (int)$this->pdo->lastInsertId();
                    }
                    $keptOIds[] = $oId;
                }

                $removedOIds = array_values(array_diff($existingOIds, $keptOIds));
                if (!empty($removedOIds)) {
                    $inRemovedO = implode(',', array_map('intval', $removedOIds));
                    $this->pdo->exec("
                        UPDATE test_series_attempt_answers
                        SET selected_option_id = NULL, is_correct = 0
                        WHERE question_id = {$qId} AND selected_option_id IN ({$inRemovedO})
                    ");
                    $this->pdo->exec("DELETE FROM test_series_options WHERE question_id = {$qId} AND id IN ({$inRemovedO})");
                }
            }

            $removedQIds = array_values(array_diff($existingQIds, $keptQIds));
            if (!empty($removedQIds)) {
                $inRemovedQ = implode(',', array_map('intval', $removedQIds));
                $this->pdo->exec("DELETE FROM test_series_questions WHERE test_series_id = {$id} AND id IN ({$inRemovedQ})");
            }

            // Re-grade any submitted attempts so running edits reflect immediately & accurately
            $this->regradeSubmittedAttempts($id, count($questions), $negEnabled, $negValue);

            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        // Delete orphaned images replaced during edit
        $newMedia = $this->collectMediaUrls($id);
        $removedMedia = array_diff($oldMedia, $newMedia);
        foreach ($removedMedia as $url) {
            $this->storage->delete($url);
        }

        return $this->getTeacherTestSeriesDetail($user, $id);
    }

    private function regradeSubmittedAttempts(
        int $testSeriesId,
        int $totalQuestions,
        bool $negEnabled = false,
        float $negValue = 0.0
    ): void {
        $stmtAttempts = $this->pdo->prepare("
            SELECT id FROM test_series_attempts
            WHERE test_series_id = :tsid AND status = 'SUBMITTED'
        ");
        $stmtAttempts->execute([':tsid' => $testSeriesId]);
        $attemptIds = array_map('intval', $stmtAttempts->fetchAll(PDO::FETCH_COLUMN) ?: []);
        if (empty($attemptIds)) {
            return;
        }

        // Refresh answer correctness from current options
        $stmtSyncAns = $this->pdo->prepare("
            UPDATE test_series_attempt_answers tsaa
            LEFT JOIN test_series_options tso
                   ON tsaa.selected_option_id = tso.id AND tsaa.question_id = tso.question_id
            SET tsaa.is_correct = CASE WHEN COALESCE(tso.is_correct, 0) = 1 THEN 1 ELSE 0 END
            WHERE tsaa.attempt_id = :aid
        ");
        $stmtCounts = $this->pdo->prepare("
            SELECT
                SUM(CASE WHEN selected_option_id IS NOT NULL AND is_correct = 1 THEN 1 ELSE 0 END) AS correct_cnt,
                SUM(CASE WHEN selected_option_id IS NOT NULL AND is_correct = 0 THEN 1 ELSE 0 END) AS wrong_cnt
            FROM test_series_attempt_answers
            WHERE attempt_id = :aid
        ");
        $stmtUpdAttempt = $this->pdo->prepare("
            UPDATE test_series_attempts
            SET total_questions = :tq,
                correct_count = :cc,
                wrong_count = :wc,
                unanswered_count = :uc,
                score_percent = :pct,
                obtained_marks = :om
            WHERE id = :aid
        ");

        foreach ($attemptIds as $aid) {
            $stmtSyncAns->execute([':aid' => $aid]);
            $stmtCounts->execute([':aid' => $aid]);
            $cnt = $stmtCounts->fetch(PDO::FETCH_ASSOC) ?: [];
            $correctCount = (int)($cnt['correct_cnt'] ?? 0);
            $wrongCount = (int)($cnt['wrong_cnt'] ?? 0);
            $unansweredCount = max(0, $totalQuestions - ($correctCount + $wrongCount));
            $breakdown = $this->computeScoreBreakdown(
                $correctCount,
                $wrongCount,
                $totalQuestions,
                $negEnabled,
                $negValue
            );

            $stmtUpdAttempt->execute([
                ':tq' => $totalQuestions,
                ':cc' => $correctCount,
                ':wc' => $wrongCount,
                ':uc' => $unansweredCount,
                ':pct' => $breakdown['score_percent'],
                ':om' => $breakdown['obtained_marks'],
                ':aid' => $aid,
            ]);
        }
    }

    private function collectMediaUrls(int $testSeriesId): array
    {
        $urls = [];
        $stmtQ = $this->pdo->prepare("
            SELECT question_image_url
            FROM test_series_questions
            WHERE test_series_id = :tsid AND question_image_url IS NOT NULL AND question_image_url != ''
        ");
        $stmtQ->execute([':tsid' => $testSeriesId]);
        foreach ($stmtQ->fetchAll(PDO::FETCH_COLUMN) ?: [] as $u) {
            $urls[] = (string)$u;
        }

        $stmtO = $this->pdo->prepare("
            SELECT o.option_image_url
            FROM test_series_options o
            JOIN test_series_questions q ON o.question_id = q.id
            WHERE q.test_series_id = :tsid AND o.option_image_url IS NOT NULL AND o.option_image_url != ''
        ");
        $stmtO->execute([':tsid' => $testSeriesId]);
        foreach ($stmtO->fetchAll(PDO::FETCH_COLUMN) ?: [] as $u) {
            $urls[] = (string)$u;
        }

        return array_values(array_unique($urls));
    }

    public function deleteTestSeries(array $user, int $id): array
    {
        if (!$this->isPrincipal($user)) {
            throw new ForbiddenException('Only the Principal can delete a Test Series.');
        }

        $schoolId = (int)($user['school_id'] ?? 0);
        $this->loadSeriesHeader($schoolId, $id);
        $mediaUrls = $this->collectMediaUrls($id);

        $stmtDel = $this->pdo->prepare("DELETE FROM test_series WHERE id = :id AND school_id = :sid");
        $stmtDel->execute([':id' => $id, ':sid' => $schoolId]);

        foreach ($mediaUrls as $url) {
            $this->storage->delete($url);
        }

        return ['deleted' => true, 'id' => $id];
    }

    // -------------------------------------------------------------------------
    // Leaderboard & Ranking (Teacher/Principal all classes, Student after close)
    // -------------------------------------------------------------------------

    private function formatStudentFullName(array $row): string
    {
        $parts = array_filter([
            trim((string)($row['first_name'] ?? '')),
            trim((string)($row['middle_name'] ?? '')),
            ($row['last_name'] ?? '') === '.' ? '' : trim((string)($row['last_name'] ?? '')),
        ], fn($p) => $p !== '');
        return !empty($parts) ? implode(' ', $parts) : 'Student';
    }

    private function buildLeaderboardPayload(int $schoolId, array $seriesRow, ?int $viewerStudentId = null, bool $includeAnswersForStudent = false): array
    {
        $tsId = (int)$seriesRow['id'];
        $status = $this->computeStatus((string)$seriesRow['starts_at'], (string)$seriesRow['ends_at']);
        $isClosed = ($status === 'CLOSED');
        $classLabel = $this->formatClassLabel($seriesRow['class_name'] ?? '', $seriesRow['class_section'] ?? '');

        $stmtSchool = $this->pdo->prepare("SELECT name, logo_path, principal_signature_path FROM schools WHERE id = :sid LIMIT 1");
        $stmtSchool->execute([':sid' => $schoolId]);
        $school = $stmtSchool->fetch(PDO::FETCH_ASSOC) ?: [];

        $ayName = '';
        if (!empty($seriesRow['academic_year_id'])) {
            $stmtAy = $this->pdo->prepare("SELECT name FROM academic_years WHERE id = :ayid LIMIT 1");
            $stmtAy->execute([':ayid' => (int)$seriesRow['academic_year_id']]);
            $ayName = (string)($stmtAy->fetchColumn() ?: '');
        }

        $negEnabled = ((int)($seriesRow['negative_marking_enabled'] ?? 0)) === 1;
        $negValue = (float)($seriesRow['negative_mark_value'] ?? 0.0);

        $seriesSummary = [
            'id' => $tsId,
            'title' => (string)$seriesRow['title'],
            'description' => (string)($seriesRow['description'] ?? ''),
            'class_id' => (int)$seriesRow['class_id'],
            'full_class_name' => $classLabel,
            'created_by_user_id' => (int)$seriesRow['created_by_user_id'],
            'created_by_name' => (string)($seriesRow['created_by_name'] ?? 'Teacher'),
            'starts_at' => (string)$seriesRow['starts_at'],
            'ends_at' => (string)$seriesRow['ends_at'],
            'status' => $status,
            'total_questions' => (int)$seriesRow['total_questions'],
            'show_timer' => ((int)($seriesRow['show_timer'] ?? 0)) === 1,
            'negative_marking_enabled' => $negEnabled,
            'negative_mark_value' => $negEnabled ? round($negValue, 2) : 0.0,
            'negative_mark_label' => $negEnabled ? $this->formatNegativeLabel($negValue) : '',
            'school_name' => (string)($school['name'] ?? 'School'),
            'school_logo_path' => $school['logo_path'] ?? null,
            'principal_signature_path' => $school['principal_signature_path'] ?? null,
            'academic_year_name' => $ayName,
        ];

        $stmtLiveCount = $this->pdo->prepare("
            SELECT COUNT(*) FROM test_series_attempts
            WHERE test_series_id = :tsid AND status = 'SUBMITTED'
        ");
        $stmtLiveCount->execute([':tsid' => $tsId]);
        $submittedCount = (int)$stmtLiveCount->fetchColumn();

        if (!$isClosed) {
            return [
                'test_series' => $seriesSummary,
                'is_closed' => false,
                'server_now' => date('Y-m-d H:i:s'),
                'live_attempts_count' => $submittedCount,
                'total_participants' => $submittedCount,
                'toppers' => [],
                'leaderboard' => [],
                'my_result' => null,
                'answer_review' => [],
                'message' => 'Results & Leaderboard will be generated automatically once the Test Series closes.',
            ];
        }

        $stmtAttempts = $this->pdo->prepare("
            SELECT a.*,
                   s.first_name, s.middle_name, s.last_name, s.roll_no, s.photo_path,
                   c.name AS student_class_name, c.section AS student_class_section
            FROM test_series_attempts a
            JOIN students s ON a.student_id = s.id
            LEFT JOIN classes c ON a.class_id = c.id
            WHERE a.test_series_id = :tsid AND a.status = 'SUBMITTED'
        ");
        $stmtAttempts->execute([':tsid' => $tsId]);
        $rawRows = $stmtAttempts->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $rows = $this->sortAndRankAttempts($schoolId, $seriesRow, $rawRows);

        $leaderboard = [];
        $toppers = [];
        $myResult = null;
        $myAttemptId = null;

        foreach ($rows as $row) {
            $currentRank = (int)$row['_rank'];
            $stuId = (int)$row['student_id'];
            $isTopper = ($currentRank <= 3);
            $stuClass = $this->formatClassLabel($row['student_class_name'] ?? $seriesRow['class_name'], $row['student_class_section'] ?? $seriesRow['class_section']);

            $entry = [
                'rank' => $currentRank,
                'is_topper' => $isTopper,
                'can_download_certificate' => $isTopper,
                'student_id' => $stuId,
                'student_name' => $this->formatStudentFullName($row),
                'student_photo' => $row['photo_path'] ?? null,
                'roll_no' => (string)($row['roll_no'] ?? ''),
                'class_name' => $stuClass,
                'correct_count' => (int)$row['correct_count'],
                'wrong_count' => (int)$row['wrong_count'],
                'unanswered_count' => (int)$row['unanswered_count'],
                'total_questions' => (int)$row['total_questions'],
                'max_marks' => (int)$seriesRow['total_questions'],
                'obtained_marks' => round((float)$row['_obtained_marks'], 2),
                'deducted_marks' => round((float)$row['_deducted_marks'], 2),
                'score_percent' => round((float)$row['_score_percent'], 2),
                'attendance_present_days' => (int)$row['_attendance_present_days'],
                'time_taken_seconds' => (int)$row['time_taken_seconds'],
                'submitted_at' => (string)$row['submitted_at'],
                'is_me' => ($viewerStudentId !== null && $stuId === $viewerStudentId),
            ];

            $leaderboard[] = $entry;
            if ($isTopper) {
                $toppers[] = $entry;
            }
            if ($viewerStudentId !== null && $stuId === $viewerStudentId) {
                $myResult = array_merge($entry, ['attempted' => true]);
                $myAttemptId = (int)$row['id'];
            }
        }

        if ($viewerStudentId !== null && $myResult === null) {
            $myResult = [
                'attempted' => false,
                'rank' => null,
                'is_topper' => false,
                'can_download_certificate' => false,
            ];
        }

        $answerReview = [];
        if ($includeAnswersForStudent && $viewerStudentId !== null && $myAttemptId !== null) {
            $answerReview = $this->buildAnswerReview($tsId, $myAttemptId);
        }

        return [
            'test_series' => $seriesSummary,
            'is_closed' => true,
            'server_now' => date('Y-m-d H:i:s'),
            'total_participants' => count($leaderboard),
            'toppers' => $toppers,
            'leaderboard' => $leaderboard,
            'my_result' => $myResult,
            'answer_review' => $answerReview,
        ];
    }

    private function buildAnswerReview(int $testSeriesId, int $attemptId): array
    {
        $questions = $this->loadQuestionsWithOptions($testSeriesId, true);
        $stmtAns = $this->pdo->prepare("
            SELECT question_id, selected_option_id, is_correct
            FROM test_series_attempt_answers
            WHERE attempt_id = :aid
        ");
        $stmtAns->execute([':aid' => $attemptId]);
        $ansRows = $stmtAns->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $ansMap = [];
        foreach ($ansRows as $a) {
            $ansMap[(int)$a['question_id']] = [
                'selected_option_id' => $a['selected_option_id'] !== null ? (int)$a['selected_option_id'] : null,
                'is_correct' => ((int)$a['is_correct']) === 1,
            ];
        }

        $review = [];
        foreach ($questions as $q) {
            $qid = (int)$q['id'];
            $correctOptId = null;
            foreach ($q['options'] as $opt) {
                if (!empty($opt['is_correct'])) {
                    $correctOptId = (int)$opt['id'];
                    break;
                }
            }
            $stuAns = $ansMap[$qid] ?? null;
            $review[] = [
                'question_id' => $qid,
                'sort_order' => (int)$q['sort_order'],
                'question_text' => $q['question_text'],
                'question_image_url' => $q['question_image_url'],
                'options' => $q['options'],
                'selected_option_id' => $stuAns ? $stuAns['selected_option_id'] : null,
                'correct_option_id' => $correctOptId,
                'is_student_correct' => $stuAns ? $stuAns['is_correct'] : false,
            ];
        }
        return $review;
    }

    public function getTeacherLeaderboard(array $user, int $id): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $seriesRow = $this->loadSeriesHeader($schoolId, $id);
        return $this->buildLeaderboardPayload($schoolId, $seriesRow, null, false);
    }

    // -------------------------------------------------------------------------
    // Student / Parent Flows (Strictly Class+Section Scoped, No Pre-Close Leaks)
    // -------------------------------------------------------------------------

    private function resolveActiveStudent(array $user): array
    {
        $schoolId = (int)($user['school_id'] ?? 0);
        $userId = (int)($user['id'] ?? 0);
        $requestedStudentId = isset($user['_requested_student_id']) ? (int)$user['_requested_student_id'] : null;

        $sql = "
            SELECT s.id, s.school_id, s.class_id, s.roll_no, s.first_name, s.middle_name, s.last_name, s.photo_path,
                   c.name AS class_name, c.section AS class_section
            FROM students s
            JOIN users u ON u.school_id = s.school_id AND (
                (s.student_mobile IS NOT NULL AND s.student_mobile != '' AND (u.phone = s.student_mobile OR RIGHT(u.phone, 10) = RIGHT(s.student_mobile, 10))) OR
                (s.parent_phone IS NOT NULL AND s.parent_phone != '' AND (u.phone = s.parent_phone OR RIGHT(u.phone, 10) = RIGHT(s.parent_phone, 10))) OR
                (s.father_phone IS NOT NULL AND s.father_phone != '' AND (u.phone = s.father_phone OR RIGHT(u.phone, 10) = RIGHT(s.father_phone, 10))) OR
                (s.mother_phone IS NOT NULL AND s.mother_phone != '' AND (u.phone = s.mother_phone OR RIGHT(u.phone, 10) = RIGHT(s.mother_phone, 10))) OR
                (s.guardian_phone IS NOT NULL AND s.guardian_phone != '' AND (u.phone = s.guardian_phone OR RIGHT(u.phone, 10) = RIGHT(s.guardian_phone, 10))) OR
                (u.email IS NOT NULL AND u.email != '' AND (u.email = s.email OR u.email = s.student_email))
            )
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE u.id = :uid
              AND s.school_id = :sid
              AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
              AND s.exit_date IS NULL
        ";
        $params = [':uid' => $userId, ':sid' => $schoolId];
        if ($requestedStudentId !== null && $requestedStudentId > 0) {
            $sql .= " AND s.id = :req_sid";
            $params[':req_sid'] = $requestedStudentId;
        }
        $sql .= " ORDER BY s.id DESC LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $student = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$student && $requestedStudentId !== null && $requestedStudentId > 0) {
            // Fall back to default child for this user if stale X-Student-Id header
            $fallbackUser = $user;
            unset($fallbackUser['_requested_student_id']);
            return $this->resolveActiveStudent($fallbackUser);
        }

        if (!$student) {
            throw new NotFoundException('Active student profile not found.');
        }
        return $student;
    }

    public function listForStudent(array $user, array $params = []): array
    {
        $student = $this->resolveActiveStudent($user);
        $schoolId = (int)$student['school_id'];
        $studentId = (int)$student['id'];
        $classId = (int)($student['class_id'] ?? 0);
        $statusFilter = strtoupper(trim((string)($params['status'] ?? 'ALL')));

        if ($classId <= 0) {
            return [
                'server_now' => date('Y-m-d H:i:s'),
                'items' => [],
            ];
        }

        $stmt = $this->pdo->prepare("
            SELECT ts.id, ts.class_id, ts.academic_year_id, ts.title, ts.description, ts.created_by_name,
                   ts.starts_at, ts.ends_at, ts.total_questions,
                   ts.show_timer, ts.negative_marking_enabled, ts.negative_mark_value,
                   a.status AS attempt_status,
                   a.correct_count AS attempt_correct_count,
                   a.wrong_count AS attempt_wrong_count,
                   a.obtained_marks AS attempt_obtained_marks,
                   a.score_percent AS attempt_score_percent,
                   a.time_taken_seconds AS attempt_time_taken_seconds,
                   a.elapsed_seconds AS attempt_elapsed_seconds
            FROM test_series ts
            LEFT JOIN test_series_attempts a
                   ON a.test_series_id = ts.id AND a.student_id = :stid
            WHERE ts.school_id = :sid AND ts.class_id = :cid
            ORDER BY ts.starts_at DESC, ts.id DESC
        ");
        $stmt->execute([
            ':stid' => $studentId,
            ':sid' => $schoolId,
            ':cid' => $classId,
        ]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $nowTs = time();
        $items = [];

        foreach ($rows as $row) {
            $status = $this->computeStatus((string)$row['starts_at'], (string)$row['ends_at'], $nowTs);
            if ($statusFilter !== '' && $statusFilter !== 'ALL' && $status !== $statusFilter) {
                continue;
            }

            $tsId = (int)$row['id'];
            $endTs = strtotime((string)$row['ends_at']) ?: $nowTs;
            $attemptStatus = (string)($row['attempt_status'] ?? 'NOT_STARTED');
            if ($attemptStatus === '') {
                $attemptStatus = 'NOT_STARTED';
            }

            $negEnabled = ((int)($row['negative_marking_enabled'] ?? 0)) === 1;
            $negValue = (float)($row['negative_mark_value'] ?? 0.0);

            // CRITICAL PRIVACY/SECURITY: NEVER expose scores/ranks while test is UPCOMING or LIVE!
            $isClosed = ($status === 'CLOSED');
            $myRank = null;
            $totalParticipants = null;
            $isTopper = false;
            $canDownloadCertificate = false;
            $myObtainedMarks = null;
            $myDeductedMarks = null;
            $myScorePercent = null;

            if ($isClosed) {
                $rankInfo = $this->computeSingleStudentRank($schoolId, $row, $studentId);
                $totalParticipants = $rankInfo['total_participants'];
                $myRank = $rankInfo['rank'];
                $isTopper = ($myRank !== null && $myRank <= 3);
                $canDownloadCertificate = $isTopper;

                if ($attemptStatus === 'SUBMITTED') {
                    $bd = $this->computeScoreBreakdown(
                        (int)($row['attempt_correct_count'] ?? 0),
                        (int)($row['attempt_wrong_count'] ?? 0),
                        (int)$row['total_questions'],
                        $negEnabled,
                        $negValue
                    );
                    $myObtainedMarks = $bd['obtained_marks'];
                    $myDeductedMarks = $bd['deducted_marks'];
                    $myScorePercent = $bd['score_percent'];
                }
            }

            $items[] = [
                'id' => $tsId,
                'class_id' => (int)$row['class_id'],
                'title' => (string)$row['title'],
                'description' => (string)($row['description'] ?? ''),
                'created_by_name' => (string)($row['created_by_name'] ?? 'Teacher'),
                'starts_at' => (string)$row['starts_at'],
                'ends_at' => (string)$row['ends_at'],
                'status' => $status,
                'total_questions' => (int)$row['total_questions'],
                'show_timer' => ((int)($row['show_timer'] ?? 0)) === 1,
                'negative_marking_enabled' => $negEnabled,
                'negative_mark_value' => $negEnabled ? round($negValue, 2) : 0.0,
                'negative_mark_label' => $negEnabled ? $this->formatNegativeLabel($negValue) : '',
                'attempt_status' => $attemptStatus,
                'seconds_remaining' => max(0, $endTs - $nowTs),
                'elapsed_seconds' => max(0, (int)($row['attempt_elapsed_seconds'] ?? 0)),
                // Only populated once CLOSED
                'my_rank' => $isClosed ? $myRank : null,
                'total_participants' => $isClosed ? $totalParticipants : null,
                'is_topper' => $isClosed ? $isTopper : false,
                'can_download_certificate' => $isClosed ? $canDownloadCertificate : false,
                'my_score_percent' => $myScorePercent,
                'my_correct_count' => ($isClosed && $attemptStatus === 'SUBMITTED') ? (int)$row['attempt_correct_count'] : null,
                'my_obtained_marks' => $myObtainedMarks,
                'my_deducted_marks' => $myDeductedMarks,
                'my_time_taken_seconds' => ($isClosed && $attemptStatus === 'SUBMITTED') ? (int)($row['attempt_time_taken_seconds'] ?? 0) : null,
            ];
        }

        return [
            'server_now' => date('Y-m-d H:i:s', $nowTs),
            'items' => $items,
        ];
    }

    private function computeSingleStudentRank(int $schoolId, array $seriesRow, int $studentId): array
    {
        $tsId = (int)$seriesRow['id'];
        $stmt = $this->pdo->prepare("
            SELECT id, student_id, correct_count, wrong_count, time_taken_seconds, submitted_at
            FROM test_series_attempts
            WHERE test_series_id = :tsid AND status = 'SUBMITTED'
        ");
        $stmt->execute([':tsid' => $tsId]);
        $rawRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $ranked = $this->sortAndRankAttempts($schoolId, $seriesRow, $rawRows);

        $total = count($ranked);
        foreach ($ranked as $row) {
            if ((int)$row['student_id'] === $studentId) {
                return ['rank' => (int)$row['_rank'], 'total_participants' => $total];
            }
        }

        return ['rank' => null, 'total_participants' => $total];
    }

    public function startOrResumeAttempt(array $user, int $id): array
    {
        $student = $this->resolveActiveStudent($user);
        $schoolId = (int)$student['school_id'];
        $studentId = (int)$student['id'];
        $studentClassId = (int)$student['class_id'];
        $userId = (int)($user['id'] ?? 0);

        $series = $this->loadSeriesHeader($schoolId, $id);
        if ((int)$series['class_id'] !== $studentClassId) {
            throw new ForbiddenException('This Test Series belongs to another class.');
        }

        $nowTs = time();
        $status = $this->computeStatus((string)$series['starts_at'], (string)$series['ends_at'], $nowTs);
        if ($status === 'UPCOMING') {
            throw new ValidationException(['status' => 'This Test Series has not started yet.'], 'This Test Series has not started yet.');
        }
        if ($status === 'CLOSED') {
            throw new ValidationException(['status' => 'This Test Series has closed. Attempts are no longer allowed.'], 'This Test Series has closed. Attempts are no longer allowed.');
        }

        $stmtAttempt = $this->pdo->prepare("
            SELECT * FROM test_series_attempts
            WHERE test_series_id = :tsid AND student_id = :stid
            LIMIT 1
        ");
        $stmtAttempt->execute([':tsid' => $id, ':stid' => $studentId]);
        $attempt = $stmtAttempt->fetch(PDO::FETCH_ASSOC);

        if ($attempt && $attempt['status'] === 'SUBMITTED') {
            throw new ValidationException(['attempt' => 'You have already submitted this Test Series. Results unlock after closing.'], 'You have already submitted this Test Series. Results unlock after closing.');
        }

        $nowStr = date('Y-m-d H:i:s', $nowTs);
        $elapsedSeconds = 0;
        if (!$attempt) {
            $stmtIns = $this->pdo->prepare("
                INSERT INTO test_series_attempts
                    (test_series_id, school_id, class_id, student_id, submitted_by_user_id, started_at, elapsed_seconds, total_questions, status)
                VALUES
                    (:tsid, :sid, :cid, :stid, :uid, :started, 0, :tq, 'IN_PROGRESS')
            ");
            $stmtIns->execute([
                ':tsid' => $id,
                ':sid' => $schoolId,
                ':cid' => $studentClassId,
                ':stid' => $studentId,
                ':uid' => $userId,
                ':started' => $nowStr,
                ':tq' => (int)$series['total_questions'],
            ]);
            $startedAt = $nowStr;
        } else {
            $startedAt = (string)$attempt['started_at'];
            $elapsedSeconds = max(0, (int)($attempt['elapsed_seconds'] ?? 0));
        }

        $endTs = strtotime((string)$series['ends_at']) ?: $nowTs;
        $negEnabled = ((int)($series['negative_marking_enabled'] ?? 0)) === 1;
        $negValue = (float)($series['negative_mark_value'] ?? 0.0);

        return [
            'test_series' => [
                'id' => (int)$series['id'],
                'title' => (string)$series['title'],
                'description' => (string)($series['description'] ?? ''),
                'created_by_name' => (string)($series['created_by_name'] ?? 'Teacher'),
                'starts_at' => (string)$series['starts_at'],
                'ends_at' => (string)$series['ends_at'],
                'total_questions' => (int)$series['total_questions'],
                'seconds_remaining' => max(0, $endTs - $nowTs),
                'show_timer' => ((int)($series['show_timer'] ?? 0)) === 1,
                'negative_marking_enabled' => $negEnabled,
                'negative_mark_value' => $negEnabled ? round($negValue, 2) : 0.0,
                'negative_mark_label' => $negEnabled ? $this->formatNegativeLabel($negValue) : '',
            ],
            'started_at' => $startedAt,
            'elapsed_seconds' => $elapsedSeconds,
            'server_now' => $nowStr,
            // CRITICAL: NEVER pass is_correct to student while test is live!
            'questions' => $this->loadQuestionsWithOptions($id, false),
        ];
    }

    public function pauseAttempt(array $user, int $id, array $body): array
    {
        $student = $this->resolveActiveStudent($user);
        $schoolId = (int)$student['school_id'];
        $studentId = (int)$student['id'];
        $studentClassId = (int)$student['class_id'];

        $series = $this->loadSeriesHeader($schoolId, $id);
        if ((int)$series['class_id'] !== $studentClassId) {
            throw new ForbiddenException('This Test Series belongs to another class.');
        }

        $stmtAttempt = $this->pdo->prepare("
            SELECT id, started_at, elapsed_seconds, status
            FROM test_series_attempts
            WHERE test_series_id = :tsid AND student_id = :stid
            LIMIT 1
        ");
        $stmtAttempt->execute([':tsid' => $id, ':stid' => $studentId]);
        $attempt = $stmtAttempt->fetch(PDO::FETCH_ASSOC);

        if (!$attempt || $attempt['status'] !== 'IN_PROGRESS') {
            return [
                'saved' => false,
                'elapsed_seconds' => $attempt ? max(0, (int)($attempt['elapsed_seconds'] ?? 0)) : 0,
            ];
        }

        $reportedElapsed = isset($body['elapsed_seconds']) && is_numeric($body['elapsed_seconds'])
            ? max(0, (int)$body['elapsed_seconds'])
            : 0;
        $startedTs = strtotime((string)$attempt['started_at']) ?: time();
        $maxReasonable = max(60, time() - $startedTs + 15);
        $clampedElapsed = min($reportedElapsed, $maxReasonable);

        $stmtUpd = $this->pdo->prepare("
            UPDATE test_series_attempts
            SET elapsed_seconds = GREATEST(elapsed_seconds, :sec)
            WHERE id = :aid AND status = 'IN_PROGRESS'
        ");
        $stmtUpd->execute([
            ':sec' => $clampedElapsed,
            ':aid' => (int)$attempt['id'],
        ]);

        $newElapsed = max((int)($attempt['elapsed_seconds'] ?? 0), $clampedElapsed);

        return [
            'saved' => true,
            'elapsed_seconds' => $newElapsed,
        ];
    }

    public function submitAttempt(array $user, int $id, array $body): array
    {
        $student = $this->resolveActiveStudent($user);
        $schoolId = (int)$student['school_id'];
        $studentId = (int)$student['id'];
        $studentClassId = (int)$student['class_id'];
        $userId = (int)($user['id'] ?? 0);

        $series = $this->loadSeriesHeader($schoolId, $id);
        if ((int)$series['class_id'] !== $studentClassId) {
            throw new ForbiddenException('This Test Series belongs to another class.');
        }

        $nowTs = time();
        $nowStr = date('Y-m-d H:i:s', $nowTs);
        $startTs = strtotime((string)$series['starts_at']) ?: $nowTs;
        $endTs = strtotime((string)$series['ends_at']) ?: $nowTs;

        if ($nowTs < $startTs) {
            throw new ValidationException(['status' => 'This Test Series has not started yet.'], 'This Test Series has not started yet.');
        }

        // Normalize answers: support [{question_id, selected_option_id}] OR {question_id: selected_option_id}
        $rawAnswers = $body['answers'] ?? [];
        $answerByQid = [];
        if (is_array($rawAnswers)) {
            foreach ($rawAnswers as $k => $v) {
                if (is_array($v) && isset($v['question_id'])) {
                    $qid = (int)$v['question_id'];
                    $optId = isset($v['selected_option_id']) && is_numeric($v['selected_option_id']) ? (int)$v['selected_option_id'] : null;
                    if ($qid > 0) {
                        $answerByQid[$qid] = $optId;
                    }
                } elseif (is_numeric($k)) {
                    $qid = (int)$k;
                    $optId = is_numeric($v) ? (int)$v : null;
                    if ($qid > 0) {
                        $answerByQid[$qid] = $optId;
                    }
                }
            }
        }

        $questions = $this->loadQuestionsWithOptions($id, true);
        $totalQuestions = count($questions);

        $this->pdo->beginTransaction();
        try {
            $stmtLock = $this->pdo->prepare("
                SELECT * FROM test_series_attempts
                WHERE test_series_id = :tsid AND student_id = :stid
                FOR UPDATE
            ");
            $stmtLock->execute([':tsid' => $id, ':stid' => $studentId]);
            $attempt = $stmtLock->fetch(PDO::FETCH_ASSOC);

            if ($attempt && $attempt['status'] === 'SUBMITTED') {
                throw new ValidationException(['attempt' => 'You have already submitted this Test Series.'], 'You have already submitted this Test Series.');
            }

            // Allow 15-second grace only for in-progress attempts that started before ends_at
            $startedBeforeClose = $attempt && (strtotime((string)$attempt['started_at']) < $endTs);
            if ($nowTs > $endTs + ($startedBeforeClose ? 15 : 0)) {
                throw new ValidationException(['status' => 'This Test Series has closed. Submissions are no longer accepted.'], 'This Test Series has closed. Submissions are no longer accepted.');
            }

            $startedAt = $attempt ? (string)$attempt['started_at'] : $nowStr;
            if (!$attempt) {
                $stmtIns = $this->pdo->prepare("
                    INSERT INTO test_series_attempts
                        (test_series_id, school_id, class_id, student_id, submitted_by_user_id, started_at, total_questions, status)
                    VALUES
                        (:tsid, :sid, :cid, :stid, :uid, :started, :tq, 'IN_PROGRESS')
                ");
                $stmtIns->execute([
                    ':tsid' => $id,
                    ':sid' => $schoolId,
                    ':cid' => $studentClassId,
                    ':stid' => $studentId,
                    ':uid' => $userId,
                    ':started' => $startedAt,
                    ':tq' => $totalQuestions,
                ]);
                $attemptId = (int)$this->pdo->lastInsertId();
            } else {
                $attemptId = (int)$attempt['id'];
            }

            // Wipe any partial rows just in case
            $stmtDelAns = $this->pdo->prepare("DELETE FROM test_series_attempt_answers WHERE attempt_id = :aid");
            $stmtDelAns->execute([':aid' => $attemptId]);

            $stmtInsAns = $this->pdo->prepare("
                INSERT INTO test_series_attempt_answers (attempt_id, question_id, selected_option_id, is_correct)
                VALUES (:aid, :qid, :oid, :corr)
            ");

            $correctCount = 0;
            $wrongCount = 0;
            $unansweredCount = 0;
            $answeredCount = 0;

            foreach ($questions as $q) {
                $qid = (int)$q['id'];
                $optMap = [];
                foreach ($q['options'] as $opt) {
                    $optMap[(int)$opt['id']] = !empty($opt['is_correct']);
                }

                $selectedOptId = $answerByQid[$qid] ?? null;
                if ($selectedOptId !== null && !array_key_exists($selectedOptId, $optMap)) {
                    $selectedOptId = null;
                }

                $isCorrect = false;
                if ($selectedOptId === null) {
                    $unansweredCount++;
                } else {
                    $answeredCount++;
                    $isCorrect = $optMap[$selectedOptId] === true;
                    if ($isCorrect) {
                        $correctCount++;
                    } else {
                        $wrongCount++;
                    }
                }

                $stmtInsAns->execute([
                    ':aid' => $attemptId,
                    ':qid' => $qid,
                    ':oid' => $selectedOptId,
                    ':corr' => $isCorrect ? 1 : 0,
                ]);
            }

            $startedTs = strtotime($startedAt) ?: $nowTs;
            $effectiveSubmitTs = min($nowTs, $endTs);
            $wallClockElapsed = max(1, $effectiveSubmitTs - $startedTs);
            $savedElapsed = $attempt ? max(0, (int)($attempt['elapsed_seconds'] ?? 0)) : 0;
            $reportedElapsed = isset($body['elapsed_seconds']) && is_numeric($body['elapsed_seconds'])
                ? max(0, (int)$body['elapsed_seconds'])
                : null;
            if ($reportedElapsed !== null) {
                $timeTaken = max(1, max($savedElapsed, min($reportedElapsed, $wallClockElapsed + 5)));
            } else {
                $timeTaken = max(1, $savedElapsed > 0 ? min($savedElapsed, $wallClockElapsed) : $wallClockElapsed);
            }

            $negEnabled = ((int)($series['negative_marking_enabled'] ?? 0)) === 1;
            $negValue = (float)($series['negative_mark_value'] ?? 0.0);
            $breakdown = $this->computeScoreBreakdown($correctCount, $wrongCount, $totalQuestions, $negEnabled, $negValue);
            $obtainedMarks = $breakdown['obtained_marks'];
            $scorePercent = $breakdown['score_percent'];

            $stmtFinal = $this->pdo->prepare("
                UPDATE test_series_attempts
                SET submitted_at = :sub_at,
                    submitted_by_user_id = :uid,
                    time_taken_seconds = :tts,
                    elapsed_seconds = :es,
                    total_questions = :tq,
                    correct_count = :cc,
                    wrong_count = :wc,
                    unanswered_count = :uc,
                    obtained_marks = :om,
                    score_percent = :pct,
                    status = 'SUBMITTED'
                WHERE id = :aid
            ");
            $stmtFinal->execute([
                ':sub_at' => $nowStr,
                ':uid' => $userId,
                ':tts' => $timeTaken,
                ':es' => $timeTaken,
                ':tq' => $totalQuestions,
                ':cc' => $correctCount,
                ':wc' => $wrongCount,
                ':uc' => $unansweredCount,
                ':om' => $obtainedMarks,
                ':pct' => $scorePercent,
                ':aid' => $attemptId,
            ]);

            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }

        // CRITICAL: Never return score, correct_count, or answers right after submit!
        return [
            'submitted' => true,
            'submitted_at' => $nowStr,
            'answered_count' => $answeredCount,
            'total_questions' => $totalQuestions,
            'time_taken_seconds' => $timeTaken,
            'show_timer' => ((int)($series['show_timer'] ?? 0)) === 1,
            'ends_at' => (string)$series['ends_at'],
            'message' => 'Your test has been submitted successfully. Results, Rank & Leaderboard will unlock after the test closes.',
        ];
    }

    public function getStudentResultAndLeaderboard(array $user, int $id): array
    {
        $student = $this->resolveActiveStudent($user);
        $schoolId = (int)$student['school_id'];
        $studentId = (int)$student['id'];
        $studentClassId = (int)$student['class_id'];

        $seriesRow = $this->loadSeriesHeader($schoolId, $id);
        if ((int)$seriesRow['class_id'] !== $studentClassId) {
            throw new ForbiddenException('This Test Series belongs to another class.');
        }

        $status = $this->computeStatus((string)$seriesRow['starts_at'], (string)$seriesRow['ends_at']);
        if ($status !== 'CLOSED') {
            throw new ForbiddenException('Results, Rank and Leaderboard will unlock automatically after the test closes.');
        }

        return $this->buildLeaderboardPayload($schoolId, $seriesRow, $studentId, true);
    }

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------

    private function notifyClassTestSeriesPublished(
        int $schoolId,
        int $classId,
        string $classLabel,
        string $title,
        string $startsAt,
        string $endsAt
    ): void {
        try {
            $stmtUsers = $this->pdo->prepare("
                SELECT DISTINCT s.id AS student_id, u.id AS user_id, u.role
                FROM students s
                JOIN users u ON u.school_id = s.school_id AND (
                    (s.student_mobile IS NOT NULL AND s.student_mobile != '' AND (u.phone = s.student_mobile OR RIGHT(u.phone, 10) = RIGHT(s.student_mobile, 10))) OR
                    (s.parent_phone IS NOT NULL AND s.parent_phone != '' AND (u.phone = s.parent_phone OR RIGHT(u.phone, 10) = RIGHT(s.parent_phone, 10))) OR
                    (s.father_phone IS NOT NULL AND s.father_phone != '' AND (u.phone = s.father_phone OR RIGHT(u.phone, 10) = RIGHT(s.father_phone, 10))) OR
                    (s.mother_phone IS NOT NULL AND s.mother_phone != '' AND (u.phone = s.mother_phone OR RIGHT(u.phone, 10) = RIGHT(s.mother_phone, 10))) OR
                    (s.guardian_phone IS NOT NULL AND s.guardian_phone != '' AND (u.phone = s.guardian_phone OR RIGHT(u.phone, 10) = RIGHT(s.guardian_phone, 10))) OR
                    (u.email IS NOT NULL AND u.email != '' AND (u.email = s.email OR u.email = s.student_email))
                )
                WHERE s.school_id = :school_id
                  AND s.class_id = :class_id
                  AND (s.status IS NULL OR UPPER(s.status) = 'ACTIVE')
                  AND s.exit_date IS NULL
                  AND (u.status IS NULL OR UPPER(u.status) = 'ACTIVE')
                  AND u.role IN ('STUDENT', 'PARENT')
            ");
            $stmtUsers->execute([':class_id' => $classId, ':school_id' => $schoolId]);
            $targetUsers = $stmtUsers->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (empty($targetUsers)) {
                return;
            }

            $eventKey = 'TEST_SERIES_PUBLISHED';
            $category = NotificationCatalog::categoryFor($eventKey);
            $link = '/test-series';
            $endFormatted = date('d M, h:i A', strtotime($endsAt) ?: time());
            $notifTitle = "New Test Series: {$title}";
            $notifMsg = ($classLabel !== '' ? "{$classLabel} — " : '') . "Ends on {$endFormatted}. Tap to attempt.";

            $stmtIns = $this->pdo->prepare("
                INSERT INTO dashboard_notifications (school_id, user_id, user_role, student_id, title, message, link, category, event_key, is_read)
                VALUES (:sid, :uid, :role, :stid, :title, :msg, :link, :cat, :ekey, 0)
            ");

            $pushedUserIds = [];
            foreach ($targetUsers as $u) {
                $uid = (int)$u['user_id'];
                $stId = (int)$u['student_id'];
                $uRole = (string)$u['role'];

                $stmtIns->execute([
                    ':sid' => $schoolId,
                    ':uid' => $uid,
                    ':role' => $uRole,
                    ':stid' => $stId,
                    ':title' => $notifTitle,
                    ':msg' => $notifMsg,
                    ':link' => $link,
                    ':cat' => $category,
                    ':ekey' => $eventKey,
                ]);
                $notifId = (int)$this->pdo->lastInsertId();

                if (!isset($pushedUserIds[$uid])) {
                    $pushedUserIds[$uid] = true;
                    PushDispatcher::pushOnly(
                        $this->pdo,
                        $schoolId,
                        $uRole,
                        $uid,
                        $eventKey,
                        $notifTitle,
                        $notifMsg,
                        $link,
                        $notifId
                    );
                }
            }
        } catch (\Throwable $e) {
            error_log('TestSeries notification error: ' . $e->getMessage());
        }
    }
}
