<?php

declare(strict_types=1);

namespace App\Domain\Student\Controllers;

use App\Domain\Student\Services\VocabularyService;
use App\Shared\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class VocabularyController extends BaseController
{
    public function __construct(
        \App\Shared\Auth\TokenService $tokenService,
        private VocabularyService $service
    ) {
        parent::__construct($tokenService);
    }

    // Core progress endpoints
    public function getGameProgress(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $data = $this->service->getGameProgress($user);
        return $this->success($response, $data);
    }

    public function syncGameProgress(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $body = (array) $request->getParsedBody();
        $data = $this->service->syncGameProgress($user, $body);
        return $this->success($response, $data);
    }

    // Daily Challenge
    public function getDailyChallenge(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $data = $this->service->getDailyChallenge($user);
        return $this->success($response, $data);
    }

    public function submitDailyChallenge(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $body = (array) $request->getParsedBody();
        $data = $this->service->submitDailyChallenge($user, $body);
        return $this->success($response, $data);
    }

    // Weekly Challenge
    public function getWeeklyChallenge(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $data = $this->service->getWeeklyChallenge($user);
        return $this->success($response, $data);
    }

    public function submitWeeklyChallenge(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $body = (array) $request->getParsedBody();
        $data = $this->service->submitWeeklyChallenge($user, $body);
        return $this->success($response, $data);
    }

    // Leaderboards
    public function getLeaderboard(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN']);
        $data = $this->service->getLeaderboard($user);
        return $this->success($response, $data);
    }

    // Achievements / Badges
    public function getAchievements(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);
        $data = $this->service->getAchievements($user);
        return $this->success($response, $data);
    }

    // Parent Dashboard Report
    public function getParentReport(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['PARENT', 'SCHOOL_ADMIN']);
        $queryParams = $request->getQueryParams();
        $studentId = isset($queryParams['student_id']) ? (int)$queryParams['student_id'] : 0;
        $data = $this->service->getParentReport($user, $studentId);
        return $this->success($response, $data);
    }

    // Teacher Dashboard Report
    public function getTeacherReport(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['TEACHER', 'SCHOOL_ADMIN']);
        $queryParams = $request->getQueryParams();
        $classId = isset($queryParams['class_id']) ? (int)$queryParams['class_id'] : 0;
        $data = $this->service->getTeacherReport($user, $classId);
        return $this->success($response, $data);
    }

    // School Principal / Admin Analytics
    public function getSchoolAnalytics(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SCHOOL_ADMIN']);
        $data = $this->service->getSchoolAnalytics($user);
        return $this->success($response, $data);
    }
}
