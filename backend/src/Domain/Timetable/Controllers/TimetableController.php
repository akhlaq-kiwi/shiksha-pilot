<?php

namespace App\Domain\Timetable\Controllers;

use App\Shared\BaseController;
use App\Domain\Timetable\Services\TimetableService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class TimetableController extends BaseController
{
    public function __construct(
        private TimetableService $timetableService
    ) {}

    private function getSchoolId(Request $request): ?int
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            if ($auth && isset($auth['school_id'])) {
                return (int)$auth['school_id'];
            }
        }
        return null;
    }

    private function getAuthUserEmail(Request $request): string
    {
        if (function_exists('getAuthUser')) {
            $auth = getAuthUser($request);
            return $auth['email'] ?? $auth['phone'] ?? 'System';
        }
        return 'System';
    }

    // --- Subjects ---

    public function getSubjects(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $subjects = $this->timetableService->getSubjects($schoolId);
        return $this->success($response, $subjects);
    }

    public function createSubject(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->timetableService->createSubject($schoolId, $data);
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function updateSubject(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        $data = $this->getJsonData($request);
        try {
            $result = $this->timetableService->updateSubject($schoolId, $id, $data);
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function deleteSubject(Request $request, Response $response, array $args): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $id = (int)$args['id'];
        try {
            $result = $this->timetableService->deleteSubject($schoolId, $id);
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    // --- Schedules ---

    public function getSchedules(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $params = $request->getQueryParams();
        try {
            $schedules = $this->timetableService->getSchedules($schoolId, $params);
            return $this->success($response, $schedules);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function saveSchedule(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->timetableService->saveSchedule($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function publishSchedule(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->timetableService->publishSchedule($schoolId, $data, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function getTodaySchedule(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $classId = (int)($params['class_id'] ?? 0);
        $date = trim($params['date'] ?? date('Y-m-d'));

        if (!$classId) {
            return $this->error($response, 'class_id is required', 400);
        }

        $schedule = $this->timetableService->getTodaySchedule($classId, $date);
        return $this->success($response, $schedule);
    }

    public function getWeeklySchedule(Request $request, Response $response): Response
    {
        $params = $request->getQueryParams();
        $classId = (int)($params['class_id'] ?? 0);
        $weekStart = trim($params['week_start'] ?? '');

        if (!$classId || empty($weekStart)) {
            return $this->error($response, 'class_id and week_start are required', 400);
        }

        $schedule = $this->timetableService->getWeeklySchedule($classId, $weekStart);
        return $this->success($response, $schedule);
    }

    public function getAllWeeklySchedules(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $params = $request->getQueryParams();
        $ayId = (int)($params['academic_year_id'] ?? 0);
        $weekStart = trim($params['week_start'] ?? '');

        if (!$ayId || empty($weekStart)) {
            return $this->error($response, 'academic_year_id and week_start are required', 400);
        }

        $schedule = $this->timetableService->getAllWeeklySchedules($schoolId, $ayId, $weekStart);
        return $this->success($response, $schedule);
    }

    public function triggerNotifications(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        try {
            $result = $this->timetableService->triggerNotifications($schoolId, $this->getAuthUserEmail($request));
            return $this->success($response, $result);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function initWhatsAppReminders(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->timetableService->initWhatsAppReminders($schoolId, $data);
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function sendSingleWhatsAppReminder(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $data = $this->getJsonData($request);
        try {
            $result = $this->timetableService->sendSingleWhatsAppReminder($schoolId, $data);
            return $this->success($response, $result);
        } catch (\InvalidArgumentException $e) {
            return $this->error($response, $e->getMessage(), 400);
        } catch (\Exception $e) {
            return $this->error($response, $e->getMessage(), 400);
        }
    }

    public function getWhatsAppLogs(Request $request, Response $response): Response
    {
        $schoolId = $this->getSchoolId($request);
        if (!$schoolId) {
            return $this->error($response, 'Unauthorized', 401);
        }

        $logs = $this->timetableService->getWhatsAppLogs($schoolId);
        return $this->success($response, $logs);
    }
}
