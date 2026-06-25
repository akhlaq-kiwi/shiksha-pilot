<?php

namespace App\Domain\Timetable\Services;

use App\Shared\BaseService;
use PDO;
use DateTime;

class TimetableService extends BaseService
{
    public function __construct(
        private ?PDO $db = null
    ) {}

    // --- Subjects ---

    public function getSubjects(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $subjects = $this->getMockSubjects();
            $filtered = array_filter($subjects, function ($sub) use ($schoolId) {
                return (int)$sub['school_id'] === $schoolId;
            });
            return array_values($filtered);
        }

        $stmt = $pdo->prepare("SELECT * FROM subjects WHERE school_id = :school_id ORDER BY name ASC");
        $stmt->execute(['school_id' => $schoolId]);
        return $stmt->fetchAll();
    }

    public function createSubject(int $schoolId, array $data): array
    {
        $name = trim($data['name'] ?? '');
        if (empty($name)) {
            throw new \InvalidArgumentException('Subject name is required', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $subjects = $this->getMockSubjects();
            foreach ($subjects as $s) {
                if ((int)$s['school_id'] === $schoolId && strcasecmp($s['name'], $name) === 0) {
                    throw new \Exception('Subject already exists', 400);
                }
            }
            $newId = count($subjects) > 0 ? max(array_column($subjects, 'id')) + 1 : 1;
            $newSubject = [
                'id' => $newId,
                'school_id' => $schoolId,
                'name' => $name
            ];
            $subjects[] = $newSubject;
            $this->saveMockSubjects($subjects);
            return $newSubject;
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM subjects WHERE school_id = :school_id AND LOWER(name) = LOWER(:name)");
        $chk->execute(['school_id' => $schoolId, 'name' => $name]);
        if ($chk->fetchColumn() > 0) {
            throw new \Exception('Subject already exists', 400);
        }

        $stmt = $pdo->prepare("INSERT INTO subjects (school_id, name) VALUES (:school_id, :name)");
        $stmt->execute(['school_id' => $schoolId, 'name' => $name]);
        $newId = $pdo->lastInsertId();

        return [
            'id' => $newId,
            'school_id' => $schoolId,
            'name' => $name
        ];
    }

    public function updateSubject(int $schoolId, int $id, array $data): array
    {
        $name = trim($data['name'] ?? '');
        if (empty($name)) {
            throw new \InvalidArgumentException('Subject name is required', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $subjects = $this->getMockSubjects();
            $foundIdx = -1;
            foreach ($subjects as $idx => $s) {
                if ((int)$s['id'] === $id && (int)$s['school_id'] === $schoolId) {
                    $foundIdx = $idx;
                }
                if ((int)$s['school_id'] === $schoolId && (int)$s['id'] !== $id && strcasecmp($s['name'], $name) === 0) {
                    throw new \Exception('Another subject with this name already exists', 400);
                }
            }
            if ($foundIdx === -1) {
                throw new \Exception('Subject not found', 404);
            }
            $subjects[$foundIdx]['name'] = $name;
            $this->saveMockSubjects($subjects);
            return $subjects[$foundIdx];
        }

        $chk = $pdo->prepare("SELECT COUNT(*) FROM subjects WHERE school_id = :school_id AND LOWER(name) = LOWER(:name) AND id != :id");
        $chk->execute(['school_id' => $schoolId, 'name' => $name, 'id' => $id]);
        if ($chk->fetchColumn() > 0) {
            throw new \Exception('Another subject with this name already exists', 400);
        }

        $stmt = $pdo->prepare("UPDATE subjects SET name = :name WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['name' => $name, 'id' => $id, 'school_id' => $schoolId]);

        return [
            'id' => $id,
            'school_id' => $schoolId,
            'name' => $name
        ];
    }

    public function deleteSubject(int $schoolId, int $id): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $subjects = $this->getMockSubjects();
            $filtered = array_filter($subjects, function ($s) use ($id, $schoolId) {
                return !((int)$s['id'] === $id && (int)$s['school_id'] === $schoolId);
            });
            $this->saveMockSubjects(array_values($filtered));
            return ['message' => 'Subject deleted successfully'];
        }

        $stmt = $pdo->prepare("DELETE FROM subjects WHERE id = :id AND school_id = :school_id");
        $stmt->execute(['id' => $id, 'school_id' => $schoolId]);
        return ['message' => 'Subject deleted successfully'];
    }

    // --- Schedules ---

    public function getSchedules(int $schoolId, array $params): array
    {
        $classId = isset($params['class_id']) ? (int)$params['class_id'] : 0;
        $ayId = isset($params['academic_year_id']) ? (int)$params['academic_year_id'] : 0;

        if (!$classId || !$ayId) {
            throw new \InvalidArgumentException('class_id and academic_year_id are required', 400);
        }

        $weekStart = isset($params['week_start_date']) ? trim($params['week_start_date']) : '';
        $status = isset($params['status']) ? trim($params['status']) : '';
        $startDate = isset($params['start_date']) ? trim($params['start_date']) : '';
        $endDate = isset($params['end_date']) ? trim($params['end_date']) : '';

        $pdo = $this->db;
        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            $filtered = array_filter($schedules, function ($s) use ($schoolId, $classId, $ayId, $weekStart, $status, $startDate, $endDate) {
                if ((int)$s['school_id'] !== $schoolId) return false;
                if ((int)$s['class_id'] !== $classId) return false;
                if ((int)$s['academic_year_id'] !== $ayId) return false;

                if (!empty($weekStart) && $s['week_start_date'] !== $weekStart) return false;
                if (!empty($status) && strcasecmp($s['status'], $status) !== 0) return false;

                if (!empty($startDate) && strcmp($s['schedule_date'], $startDate) < 0) return false;
                if (!empty($endDate) && strcmp($s['schedule_date'], $endDate) > 0) return false;

                return true;
            });

            $results = array_values($filtered);
            foreach ($results as &$r) {
                $r['subjects'] = is_array($r['subjects']) ? $r['subjects'] : (json_decode($r['subjects'], true) ?: []);
            }
            unset($r);

            if ($weekStart) {
                $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                $existingDays = array_map(function($r) {
                    return $r['day_of_week'];
                }, $results);

                foreach ($days as $dayIndex => $dayName) {
                    if (!in_array($dayName, $existingDays)) {
                        $targetDate = date('Y-m-d', strtotime($weekStart . " +$dayIndex days"));

                        $priorRecord = null;
                        foreach ($schedules as $s) {
                            if ((int)$s['school_id'] === $schoolId &&
                                (int)$s['class_id'] === $classId &&
                                (int)$s['academic_year_id'] === $ayId &&
                                $s['day_of_week'] === $dayName &&
                                strcmp($s['schedule_date'], $targetDate) < 0) {
                                if ($priorRecord === null || strcmp($s['schedule_date'], $priorRecord['schedule_date']) > 0) {
                                    $priorRecord = $s;
                                }
                            }
                        }

                        if ($priorRecord) {
                            $subjects = is_array($priorRecord['subjects']) ? $priorRecord['subjects'] : (json_decode($priorRecord['subjects'], true) ?: []);
                            foreach ($subjects as &$sub) {
                                if (is_array($sub)) {
                                    $sub['backup_teacher_id'] = null;
                                    $sub['backup_teacher_name'] = null;
                                }
                            }
                            unset($sub);

                            $results[] = [
                                'school_id' => $schoolId,
                                'academic_year_id' => $ayId,
                                'class_id' => $classId,
                                'day_of_week' => $dayName,
                                'schedule_date' => $targetDate,
                                'week_start_date' => $weekStart,
                                'subjects' => $subjects,
                                'status' => $priorRecord['status']
                            ];
                        }
                    }
                }
            }

            usort($results, function ($a, $b) {
                return strcmp($a['schedule_date'], $b['schedule_date']);
            });
            return $results;
        }

        $sql = "SELECT * FROM class_schedules WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :ay_id";
        $binds = ['school_id' => $schoolId, 'class_id' => $classId, 'ay_id' => $ayId];

        if ($weekStart) {
            $sql .= " AND week_start_date = :week_start";
            $binds['week_start'] = $weekStart;
        }
        if ($status) {
            $sql .= " AND status = :status";
            $binds['status'] = $status;
        }
        if ($startDate) {
            $sql .= " AND schedule_date >= :start_date";
            $binds['start_date'] = $startDate;
        }
        if ($endDate) {
            $sql .= " AND schedule_date <= :end_date";
            $binds['end_date'] = $endDate;
        }

        $sql .= " ORDER BY schedule_date ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($binds);
        $results = $stmt->fetchAll();

        foreach ($results as &$r) {
            $r['subjects'] = json_decode($r['subjects'], true) ?: [];
        }
        unset($r);

        if ($weekStart) {
            $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            $existingDays = array_map(function($r) {
                return $r['day_of_week'];
            }, $results);

            foreach ($days as $dayIndex => $dayName) {
                if (!in_array($dayName, $existingDays)) {
                    $targetDate = date('Y-m-d', strtotime($weekStart . " +$dayIndex days"));

                    $subStmt = $pdo->prepare("SELECT * FROM class_schedules 
                        WHERE school_id = :school_id 
                          AND class_id = :class_id 
                          AND academic_year_id = :ay_id 
                          AND day_of_week = :day_of_week 
                          AND schedule_date < :target_date 
                        ORDER BY schedule_date DESC LIMIT 1");
                    $subStmt->execute([
                        'school_id' => $schoolId,
                        'class_id' => $classId,
                        'ay_id' => $ayId,
                        'day_of_week' => $dayName,
                        'target_date' => $targetDate
                    ]);
                    $priorRecord = $subStmt->fetch();

                    if ($priorRecord) {
                        $subjects = json_decode($priorRecord['subjects'], true) ?: [];
                        foreach ($subjects as &$sub) {
                            if (is_array($sub)) {
                                $sub['backup_teacher_id'] = null;
                                $sub['backup_teacher_name'] = null;
                            }
                        }
                        unset($sub);

                        $results[] = [
                            'school_id' => $schoolId,
                            'academic_year_id' => $ayId,
                            'class_id' => $classId,
                            'day_of_week' => $dayName,
                            'schedule_date' => $targetDate,
                            'week_start_date' => $weekStart,
                            'subjects' => $subjects,
                            'status' => $priorRecord['status']
                        ];
                    }
                }
            }

            usort($results, function ($a, $b) {
                return strcmp($a['schedule_date'], $b['schedule_date']);
            });
        }

        return $results;
    }

    public function saveSchedule(int $schoolId, array $data, string $performedBy): array
    {
        $classId = isset($data['class_id']) ? (int)$data['class_id'] : 0;
        $ayId = isset($data['academic_year_id']) ? (int)$data['academic_year_id'] : 0;
        $dayOfWeek = trim($data['day_of_week'] ?? '');
        $scheduleDate = trim($data['schedule_date'] ?? '');
        $weekStartDate = trim($data['week_start_date'] ?? '');
        $subjects = $data['subjects'] ?? [];
        $status = trim($data['status'] ?? 'Draft');

        if (!$classId || !$ayId || empty($dayOfWeek) || empty($scheduleDate) || empty($weekStartDate)) {
            throw new \InvalidArgumentException('class_id, academic_year_id, day_of_week, schedule_date, and week_start_date are required', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            $foundIdx = -1;
            foreach ($schedules as $idx => $s) {
                if ((int)$s['school_id'] === $schoolId &&
                    (int)$s['class_id'] === $classId &&
                    (int)$s['academic_year_id'] === $ayId &&
                    $s['schedule_date'] === $scheduleDate) {
                    $foundIdx = $idx;
                    break;
                }
            }

            $schedule = [
                'school_id' => $schoolId,
                'academic_year_id' => $ayId,
                'class_id' => $classId,
                'day_of_week' => $dayOfWeek,
                'schedule_date' => $scheduleDate,
                'week_start_date' => $weekStartDate,
                'subjects' => $subjects,
                'status' => $status
            ];

            if ($foundIdx !== -1) {
                $schedules[$foundIdx] = array_merge($schedules[$foundIdx], $schedule);
                $schedule = $schedules[$foundIdx];
            } else {
                $newId = count($schedules) > 0 ? max(array_column($schedules, 'id')) + 1 : 1;
                $schedule['id'] = $newId;
                $schedules[] = $schedule;
            }

            $propagate = (bool)($data['propagate'] ?? false);
            $propagateType = trim($data['propagate_type'] ?? '');
            $targetIndex = isset($data['target_index']) ? (int)$data['target_index'] : -1;

            if ($propagate && !empty($propagateType)) {
                foreach ($schedules as &$s) {
                    if ((int)$s['school_id'] === $schoolId &&
                        (int)$s['class_id'] === $classId &&
                        (int)$s['academic_year_id'] === $ayId &&
                        $s['day_of_week'] === $dayOfWeek &&
                        strcmp($s['schedule_date'], $scheduleDate) > 0) {

                        $futSubjects = is_array($s['subjects']) ? $s['subjects'] : (json_decode($s['subjects'], true) ?: []);
                        $modified = false;

                        if ($propagateType === 'add') {
                            if (count($subjects) > 0) {
                                $newPeriod = end($subjects);
                                if (is_array($newPeriod)) {
                                    $newPeriod['backup_teacher_id'] = null;
                                    $newPeriod['backup_teacher_name'] = null;
                                }
                                $futSubjects[] = $newPeriod;
                                $modified = true;
                            }
                        } elseif ($propagateType === 'remove') {
                            if ($targetIndex >= 0 && $targetIndex < count($futSubjects)) {
                                array_splice($futSubjects, $targetIndex, 1);
                                $modified = true;
                            }
                        } elseif ($propagateType === 'replace') {
                            if ($targetIndex >= 0 && $targetIndex < count($subjects) && $targetIndex < count($futSubjects)) {
                                $currentPeriod = $subjects[$targetIndex];
                                if (is_array($currentPeriod)) {
                                    $futSubjects[$targetIndex]['teacher_id'] = $currentPeriod['teacher_id'];
                                    $futSubjects[$targetIndex]['teacher_name'] = $currentPeriod['teacher_name'];
                                    $futSubjects[$targetIndex]['backup_teacher_id'] = null;
                                    $futSubjects[$targetIndex]['backup_teacher_name'] = null;
                                    $modified = true;
                                }
                            }
                        }

                        if ($modified) {
                            $s['subjects'] = $futSubjects;
                        }
                    }
                }
                unset($s);
            }

            $this->saveMockSchedules($schedules);
            return $schedule;
        }

        $chkCls = $pdo->prepare("SELECT COUNT(*) FROM classrooms WHERE id = :id AND school_id = :sid");
        $chkCls->execute(['id' => $classId, 'sid' => $schoolId]);
        if ($chkCls->fetchColumn() == 0) {
            throw new \Exception('Classroom not found', 404);
        }

        $subjectsJson = json_encode($subjects);

        $stmt = $pdo->prepare("INSERT INTO class_schedules (school_id, academic_year_id, class_id, day_of_week, schedule_date, week_start_date, subjects, status) 
            VALUES (:school_id, :academic_year_id, :class_id, :day_of_week, :schedule_date, :week_start_date, :subjects, :status)
            ON DUPLICATE KEY UPDATE day_of_week = :day_of_week_update, week_start_date = :week_start_date_update, subjects = :subjects_update, status = :status_update");

        $stmt->execute([
            'school_id' => $schoolId,
            'academic_year_id' => $ayId,
            'class_id' => $classId,
            'day_of_week' => $dayOfWeek,
            'schedule_date' => $scheduleDate,
            'week_start_date' => $weekStartDate,
            'subjects' => $subjectsJson,
            'status' => $status,

            'day_of_week_update' => $dayOfWeek,
            'week_start_date_update' => $weekStartDate,
            'subjects_update' => $subjectsJson,
            'status_update' => $status
        ]);

        $propagate = (bool)($data['propagate'] ?? false);
        $propagateType = trim($data['propagate_type'] ?? '');
        $targetIndex = isset($data['target_index']) ? (int)$data['target_index'] : -1;

        if ($propagate && !empty($propagateType)) {
            $futStmt = $pdo->prepare("SELECT id, subjects FROM class_schedules 
                WHERE school_id = :school_id 
                  AND class_id = :class_id 
                  AND academic_year_id = :ay_id 
                  AND day_of_week = :day_of_week 
                  AND schedule_date > :current_date");
            $futStmt->execute([
                'school_id' => $schoolId,
                'class_id' => $classId,
                'ay_id' => $ayId,
                'day_of_week' => $dayOfWeek,
                'current_date' => $scheduleDate
            ]);
            $futureSchedules = $futStmt->fetchAll();

            foreach ($futureSchedules as $fut) {
                $futSubjects = json_decode($fut['subjects'], true) ?: [];
                $modified = false;

                if ($propagateType === 'add') {
                    if (count($subjects) > 0) {
                        $newPeriod = end($subjects);
                        if (is_array($newPeriod)) {
                            $newPeriod['backup_teacher_id'] = null;
                            $newPeriod['backup_teacher_name'] = null;
                        }
                        $futSubjects[] = $newPeriod;
                        $modified = true;
                    }
                } elseif ($propagateType === 'remove') {
                    if ($targetIndex >= 0 && $targetIndex < count($futSubjects)) {
                        array_splice($futSubjects, $targetIndex, 1);
                        $modified = true;
                    }
                } elseif ($propagateType === 'replace') {
                    if ($targetIndex >= 0 && $targetIndex < count($subjects) && $targetIndex < count($futSubjects)) {
                        $currentPeriod = $subjects[$targetIndex];
                        if (is_array($currentPeriod)) {
                            $futSubjects[$targetIndex]['teacher_id'] = $currentPeriod['teacher_id'];
                            $futSubjects[$targetIndex]['teacher_name'] = $currentPeriod['teacher_name'];
                            $futSubjects[$targetIndex]['backup_teacher_id'] = null;
                            $futSubjects[$targetIndex]['backup_teacher_name'] = null;
                            $modified = true;
                        }
                    }
                }

                if ($modified) {
                    $updStmt = $pdo->prepare("UPDATE class_schedules SET subjects = :subj WHERE id = :id");
                    $updStmt->execute([
                        'subj' => json_encode($futSubjects),
                        'id' => $fut['id']
                    ]);
                }
            }
        }

        $this->logAudit($pdo, $schoolId, $performedBy, 'Schedule Updated', "Updated schedule for class ID $classId on $scheduleDate ($dayOfWeek).");

        return [
            'school_id' => $schoolId,
            'academic_year_id' => $ayId,
            'class_id' => $classId,
            'day_of_week' => $dayOfWeek,
            'schedule_date' => $scheduleDate,
            'week_start_date' => $weekStartDate,
            'subjects' => $subjects,
            'status' => $status
        ];
    }

    public function publishSchedule(int $schoolId, array $data, string $performedBy): array
    {
        $classId = isset($data['class_id']) ? (int)$data['class_id'] : 0;
        $ayId = isset($data['academic_year_id']) ? (int)$data['academic_year_id'] : 0;
        $weekStartDate = trim($data['week_start_date'] ?? '');
        $status = trim($data['status'] ?? 'Published');

        if (!$classId || !$ayId || empty($weekStartDate)) {
            throw new \InvalidArgumentException('class_id, academic_year_id, and week_start_date are required', 400);
        }

        $pdo = $this->db;
        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            foreach ($schedules as &$s) {
                if ((int)$s['school_id'] === $schoolId &&
                    (int)$s['class_id'] === $classId &&
                    (int)$s['academic_year_id'] === $ayId &&
                    $s['week_start_date'] === $weekStartDate) {
                    $s['status'] = $status;
                }
            }
            $this->saveMockSchedules($schedules);
            return ['success' => true, 'message' => "Schedule status updated to $status successfully"];
        }

        $stmt = $pdo->prepare("UPDATE class_schedules SET status = :status WHERE school_id = :school_id AND class_id = :class_id AND academic_year_id = :ay_id AND week_start_date = :week_start_date");
        $stmt->execute([
            'status' => $status,
            'school_id' => $schoolId,
            'class_id' => $classId,
            'ay_id' => $ayId,
            'week_start_date' => $weekStartDate
        ]);

        $this->logAudit($pdo, $schoolId, $performedBy, "Schedule Status Changed", "Set weekly schedule status to $status for class ID $classId on week starting $weekStartDate.");

        return ['success' => true, 'message' => "Schedule status updated to $status successfully"];
    }

    public function getTodaySchedule(int $classId, string $date): array
    {
        $dayOfWeek = date('l', strtotime($date));

        $pdo = $this->db;
        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            foreach ($schedules as $s) {
                if ((int)$s['class_id'] === $classId &&
                    $s['schedule_date'] === $date &&
                    $s['status'] === 'Published') {
                    return [
                        'day_of_week' => $dayOfWeek,
                        'schedule_date' => $date,
                        'subjects' => is_array($s['subjects']) ? $s['subjects'] : json_decode($s['subjects'], true),
                        'status' => 'Published'
                    ];
                }
            }
            return [
                'day_of_week' => $dayOfWeek,
                'schedule_date' => $date,
                'subjects' => [],
                'status' => 'Published'
            ];
        }

        $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE class_id = :class_id AND schedule_date = :today AND status = 'Published' LIMIT 1");
        $stmt->execute([
            'class_id' => $classId,
            'today' => $date
        ]);
        $schedule = $stmt->fetch();
        if ($schedule) {
            return [
                'day_of_week' => $schedule['day_of_week'],
                'schedule_date' => $schedule['schedule_date'],
                'subjects' => json_decode($schedule['subjects'], true) ?: [],
                'status' => 'Published'
            ];
        }
        return [
            'day_of_week' => $dayOfWeek,
            'schedule_date' => $date,
            'subjects' => [],
            'status' => 'Published'
        ];
    }

    public function getWeeklySchedule(int $classId, string $weekStart): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            $filtered = array_filter($schedules, function ($s) use ($classId, $weekStart) {
                return (int)$s['class_id'] === $classId && 
                       $s['week_start_date'] === $weekStart && 
                       $s['status'] === 'Published';
            });

            $results = array_values($filtered);
            usort($results, function ($a, $b) {
                return strcmp($a['schedule_date'], $b['schedule_date']);
            });
            return $results;
        }

        $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE class_id = :class_id AND week_start_date = :week_start AND status = 'Published' ORDER BY schedule_date ASC");
        $stmt->execute(['class_id' => $classId, 'week_start' => $weekStart]);
        $results = $stmt->fetchAll();
        foreach ($results as &$r) {
            $r['subjects'] = json_decode($r['subjects'], true) ?: [];
        }
        return $results;
    }

    public function getAllWeeklySchedules(int $schoolId, int $ayId, string $weekStart): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            $filtered = array_filter($schedules, function ($s) use ($schoolId, $ayId, $weekStart) {
                return (int)$s['school_id'] === $schoolId &&
                       (int)$s['academic_year_id'] === $ayId &&
                       $s['week_start_date'] === $weekStart &&
                       ($s['status'] === 'Published' || $s['status'] === 'Draft');
            });
            return array_values($filtered);
        }

        $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE school_id = :school_id AND academic_year_id = :ay_id AND week_start_date = :week_start AND status IN ('Published', 'Draft')");
        $stmt->execute(['school_id' => $schoolId, 'ay_id' => $ayId, 'week_start' => $weekStart]);
        $results = $stmt->fetchAll();
        foreach ($results as &$r) {
            $r['subjects'] = json_decode($r['subjects'], true) ?: [];
        }
        return $results;
    }

    public function triggerNotifications(int $schoolId, string $performedBy): array
    {
        $tomorrow = date('Y-m-d', strtotime('+1 day'));
        $tomorrowDay = date('l', strtotime('+1 day'));

        $pdo = $this->db;
        $notificationsCreated = 0;

        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            $classesFile = __DIR__ . '/../../../../mock_classes.json';
            $classes = file_exists($classesFile) ? json_decode(file_get_contents($classesFile), true) : [];

            $notificationsFile = __DIR__ . '/../../../../mock_notifications.json';
            $notifications = file_exists($notificationsFile) ? json_decode(file_get_contents($notificationsFile), true) : [];

            foreach ($schedules as $s) {
                if ((int)$s['school_id'] === $schoolId &&
                    $s['schedule_date'] === $tomorrow &&
                    $s['status'] === 'Published') {

                    $className = "Class " . $s['class_id'];
                    foreach ($classes as $c) {
                        if ((int)$c['id'] === (int)$s['class_id']) {
                            $className = $c['name'];
                            break;
                        }
                    }

                    $subjectNames = [];
                    foreach ($s['subjects'] as $subObj) {
                        $subjectNames[] = is_array($subObj) ? $subObj['subject'] : $subObj;
                    }

                    $subjectsListStr = implode(', ', $subjectNames);
                    if (empty($subjectsListStr)) $subjectsListStr = "No subjects scheduled";

                    $title = "Tomorrow's Schedule Details for $className";
                    $content = "Tomorrow's subjects: $subjectsListStr. Please ensure your child carries the required books and notebooks.";

                    $newNotif = [
                        'id' => count($notifications) > 0 ? max(array_column($notifications, 'id')) + 1 : 1,
                        'school_id' => $schoolId,
                        'title' => $title,
                        'content' => $content,
                        'type' => 'Academic',
                        'is_read' => 0,
                        'timestamp' => date('Y-m-d H:i:s')
                    ];
                    $notifications[] = $newNotif;
                    $notificationsCreated++;
                }
            }

            file_put_contents($notificationsFile, json_encode($notifications, JSON_PRETTY_PRINT));

            return [
                'success' => true, 
                'notifications_created' => $notificationsCreated,
                'message' => "Successfully triggered $notificationsCreated reminder notifications for tomorrow ($tomorrowDay, $tomorrow)."
            ];
        }

        $stmt = $pdo->prepare("SELECT cs.*, c.name as class_name 
                               FROM class_schedules cs 
                               JOIN classrooms c ON cs.class_id = c.id
                               WHERE cs.school_id = :school_id AND cs.schedule_date = :tomorrow AND cs.status = 'Published'");
        $stmt->execute([
            'school_id' => $schoolId,
            'tomorrow' => $tomorrow
        ]);

        $tomorrowSchedules = $stmt->fetchAll();

        foreach ($tomorrowSchedules as $s) {
            $subjectsArray = json_decode($s['subjects'], true) ?: [];
            $subjectNames = [];
            foreach ($subjectsArray as $subObj) {
                $subjectNames[] = is_array($subObj) ? $subObj['subject'] : $subObj;
            }

            $subjectsListStr = implode(', ', $subjectNames);
            if (empty($subjectsListStr)) $subjectsListStr = "No subjects scheduled";

            $className = $s['class_name'];
            $title = "Tomorrow's Schedule Details for $className";
            $content = "Tomorrow's subjects: $subjectsListStr. Please ensure your child carries the required books and notebooks.";

            $ins = $pdo->prepare("INSERT INTO notifications (school_id, title, content, type, is_read, timestamp) 
                                  VALUES (:school_id, :title, :content, :type, 0, :timestamp)");
            $ins->execute([
                'school_id' => $schoolId,
                'title' => $title,
                'content' => $content,
                'type' => 'Academic',
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            $notificationsCreated++;
        }

        $this->logAudit($pdo, $schoolId, $performedBy, 'Notifications Triggered', "Triggered $notificationsCreated schedule notifications for tomorrow.");

        return [
            'success' => true,
            'notifications_created' => $notificationsCreated,
            'message' => "Successfully triggered $notificationsCreated reminder notifications for tomorrow ($tomorrowDay, $tomorrow)."
        ];
    }

    public function initWhatsAppReminders(int $schoolId, array $data): array
    {
        $classId = (int)($data['class_id'] ?? 0);
        if (!$classId) {
            throw new \InvalidArgumentException('Class ID is required.', 400);
        }

        $tomorrow = date('Y-m-d', strtotime('+1 day'));
        $formattedTomorrow = date('d/m/Y', strtotime('+1 day'));

        $pdo = $this->db;
        $schedule = null;
        $students = [];
        $className = "Class " . $classId;

        if ($pdo === null) {
            $schedules = $this->getMockSchedules();
            foreach ($schedules as $s) {
                if ((int)$s['school_id'] === $schoolId && 
                    (int)$s['class_id'] === $classId && 
                    $s['schedule_date'] === $tomorrow && 
                    $s['status'] === 'Published') {
                    $schedule = $s;
                    break;
                }
            }
            if (!$schedule) {
                throw new \Exception("Tomorrow's schedule is not published for this class.", 400);
            }

            $classesFile = __DIR__ . '/../../../../mock_classes.json';
            $classes = file_exists($classesFile) ? json_decode(file_get_contents($classesFile), true) : [];
            foreach ($classes as $c) {
                if ((int)$c['id'] === $classId) {
                    $className = $c['name'];
                    break;
                }
            }

            $studentsFile = __DIR__ . '/../../../../mock_students.json';
            $allStudents = file_exists($studentsFile) ? json_decode(file_get_contents($studentsFile), true) : [];
            foreach ($allStudents as $st) {
                if ((int)$st['class_id'] === $classId && ($st['status'] ?? 'Active') === 'Active' && !empty($st['phone'])) {
                    $students[] = $st;
                }
            }
        } else {
            $stmt = $pdo->prepare("SELECT * FROM class_schedules WHERE school_id = :school_id AND class_id = :class_id AND schedule_date = :tomorrow AND status = 'Published'");
            $stmt->execute(['school_id' => $schoolId, 'class_id' => $classId, 'tomorrow' => $tomorrow]);
            $schedule = $stmt->fetch();
            if (!$schedule) {
                throw new \Exception("Tomorrow's schedule is not published for this class.", 400);
            }
            $schedule['subjects'] = json_decode($schedule['subjects'], true) ?: [];

            $classStmt = $pdo->prepare("SELECT name FROM classrooms WHERE id = :id");
            $classStmt->execute(['id' => $classId]);
            $className = $classStmt->fetchColumn() ?: "Class " . $classId;

            $studStmt = $pdo->prepare("SELECT * FROM students WHERE school_id = :school_id AND class_id = :class_id AND status = 'Active' AND phone IS NOT NULL AND phone != ''");
            $studStmt->execute(['school_id' => $schoolId, 'class_id' => $classId]);
            $students = $studStmt->fetchAll();
        }

        if (empty($students)) {
            throw new \Exception('No active students with WhatsApp numbers found in this class.', 400);
        }

        $subjectsList = "";
        $numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        foreach ($schedule['subjects'] as $idx => $subObj) {
            $subName = is_array($subObj) ? $subObj['subject'] : $subObj;
            $teacherName = is_array($subObj) && isset($subObj['teacher_name']) ? $subObj['teacher_name'] : 'Unassigned';
            $emoji = isset($numberEmojis[$idx]) ? $numberEmojis[$idx] : ($idx + 1) . '️⃣';
            $subjectsList .= "$emoji $subName\n👨🏫 Teacher: $teacherName\n\n";
        }
        $subjectsList = rtrim($subjectsList);

        $createdLogs = [];
        $dateSent = date('Y-m-d');

        if ($pdo === null) {
            $logsFile = __DIR__ . '/../../../../mock_whatsapp_logs.json';
            $logs = file_exists($logsFile) ? json_decode(file_get_contents($logsFile), true) : [];
            $nextId = count($logs) > 0 ? max(array_column($logs, 'id')) + 1 : 1;

            foreach ($students as $st) {
                $msg = "An reminder message for " . $st['name'];
                $newLog = [
                    'id' => $nextId++,
                    'school_id' => $schoolId,
                    'student_id' => $st['id'],
                    'student_name' => $st['name'],
                    'class_id' => $classId,
                    'recipient_number' => $st['phone'],
                    'type' => 'Schedule',
                    'message_content' => $msg,
                    'date_sent' => $dateSent,
                    'status' => 'Pending',
                    'error_message' => null,
                    'created_at' => date('Y-m-d H:i:s')
                ];
                $logs[] = $newLog;
                $createdLogs[] = $newLog;
            }
            file_put_contents($logsFile, json_encode($logs, JSON_PRETTY_PRINT));
        } else {
            $ins = $pdo->prepare("
                INSERT INTO whatsapp_delivery_logs (school_id, student_id, student_name, class_id, recipient_number, type, message_content, date_sent, status)
                VALUES (:school_id, :student_id, :student_name, :class_id, :recipient_number, 'Schedule', :message_content, :date_sent, 'Pending')
            ");

            foreach ($students as $st) {
                $msg = "🏫 BN School\n\n📚 Tomorrow's Class Schedule\n\n👨🎓 Student: {$st['name']}\n🏫 Class: $className\n📅 Date: $formattedTomorrow\n\n📖 Subjects for Tomorrow:\n\n$subjectsList\n\n🎒 Please ensure your child carries the required books, notebooks and study materials for the above subjects.\n\nThank you,\nBN School Administration";

                $ins->execute([
                    'school_id' => $schoolId,
                    'student_id' => $st['id'],
                    'student_name' => $st['name'],
                    'class_id' => $classId,
                    'recipient_number' => $st['phone'],
                    'message_content' => $msg,
                    'date_sent' => $dateSent
                ]);

                $logId = $pdo->lastInsertId();
                $createdLogs[] = [
                    'id' => $logId,
                    'school_id' => $schoolId,
                    'student_id' => $st['id'],
                    'student_name' => $st['name'],
                    'class_id' => $classId,
                    'recipient_number' => $st['phone'],
                    'type' => 'Schedule',
                    'message_content' => $msg,
                    'date_sent' => $dateSent,
                    'status' => 'Pending',
                    'error_message' => null
                ];
            }
        }

        return [
            'success' => true,
            'queue' => $createdLogs,
            'total' => count($createdLogs)
        ];
    }

    public function sendSingleWhatsAppReminder(int $schoolId, array $data): array
    {
        $logId = (int)($data['log_id'] ?? 0);
        if (!$logId) {
            throw new \InvalidArgumentException('Log ID is required.', 400);
        }

        $pdo = $this->db;
        $logRecord = null;

        if ($pdo === null) {
            $logsFile = __DIR__ . '/../../../../mock_whatsapp_logs.json';
            $logs = file_exists($logsFile) ? json_decode(file_get_contents($logsFile), true) : [];
            $foundIdx = -1;
            foreach ($logs as $idx => $lg) {
                if ((int)$lg['id'] === $logId && (int)$lg['school_id'] === $schoolId) {
                    $foundIdx = $idx;
                    $logRecord = $lg;
                    break;
                }
            }

            if ($foundIdx === -1) {
                throw new \Exception('Log record not found.', 404);
            }

            $phone = $logRecord['recipient_number'];
            $status = 'Sent';
            $error = null;
            if (strlen($phone) < 10 || strpos($phone, '999') !== false) {
                $status = 'Failed';
                $error = 'Invalid destination phone number / WhatsApp template validation failed';
            }

            $logs[$foundIdx]['status'] = $status;
            $logs[$foundIdx]['error_message'] = $error;
            file_put_contents($logsFile, json_encode($logs, JSON_PRETTY_PRINT));
            $logRecord = $logs[$foundIdx];
        } else {
            $stmt = $pdo->prepare("SELECT * FROM whatsapp_delivery_logs WHERE id = :id AND school_id = :school_id");
            $stmt->execute(['id' => $logId, 'school_id' => $schoolId]);
            $logRecord = $stmt->fetch();

            if (!$logRecord) {
                throw new \Exception('Log record not found.', 404);
            }

            $phone = $logRecord['recipient_number'];
            $status = 'Sent';
            $error = null;
            if (strlen($phone) < 10 || strpos($phone, '999') !== false) {
                $status = 'Failed';
                $error = 'Invalid destination phone number / WhatsApp template validation failed';
            }

            $up = $pdo->prepare("UPDATE whatsapp_delivery_logs SET status = :status, error_message = :error WHERE id = :id");
            $up->execute(['status' => $status, 'error' => $error, 'id' => $logId]);

            $logRecord['status'] = $status;
            $logRecord['error_message'] = $error;
        }

        return [
            'success' => true,
            'log' => $logRecord
        ];
    }

    public function getWhatsAppRemindersHistory(int $schoolId): array
    {
        $pdo = $this->db;
        if ($pdo === null) {
            $logsFile = __DIR__ . '/../../../../mock_whatsapp_logs.json';
            $logs = file_exists($logsFile) ? json_decode(file_get_contents($logsFile), true) : [];
            $filtered = array_filter($logs, function ($lg) use ($schoolId) {
                return (int)$lg['school_id'] === $schoolId;
            });
            $results = array_values($filtered);
            usort($results, function ($a, $b) {
                return strcmp($b['created_at'], $a['created_at']);
            });
            return $results;
        }

        $stmt = $pdo->prepare("SELECT * FROM whatsapp_delivery_logs WHERE school_id = :school_id ORDER BY created_at DESC");
        $stmt->execute(['school_id' => $schoolId]);
        return $stmt->fetchAll();
    }

    // --- Private Helper Methods ---

    private function getMockSubjects(): array
    {
        $file = __DIR__ . '/../../../../mock_subjects.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockSubjects(array $subjects): void
    {
        $file = __DIR__ . '/../../../../mock_subjects.json';
        file_put_contents($file, json_encode($subjects, JSON_PRETTY_PRINT));
    }

    private function getMockSchedules(): array
    {
        $file = __DIR__ . '/../../../../mock_schedules.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }

    private function saveMockSchedules(array $schedules): void
    {
        $file = __DIR__ . '/../../../../mock_schedules.json';
        file_put_contents($file, json_encode($schedules, JSON_PRETTY_PRINT));
    }

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
}
