<?php

declare(strict_types=1);

namespace App\Domain\SchoolAdmin\Controllers;

use App\Domain\SchoolAdmin\Services\LeaveRequestService;
use App\Domain\SchoolAdmin\Services\SchoolAdminService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use App\Shared\Http\RequestParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class LeaveRequestController extends BaseController
{
    public function __construct(
        TokenService $tokenService,
        private readonly LeaveRequestService $service,
        private readonly SchoolAdminService $schoolAdminService,
    ) {
        parent::__construct($tokenService);
    }

    public function getLeaveRequests(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $params = $request->getQueryParams();

        $data = $this->service->getLeaveRequests($user, $params);

        return $this->success($response, $data);
    }

    public function applyLeaveRequest(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $body = RequestParser::body($request);

        $data = $this->service->applyLeaveRequest($user, $body);

        return $this->success($response, $data, 'Leave request submitted successfully.');
    }

    public function updateLeaveStatus(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']);

        $id = (int)$args['id'];
        $body = RequestParser::body($request);

        $data = $this->service->updateLeaveStatus($user, $id, $body);

        return $this->success($response, $data, 'Leave request status updated successfully.');
    }

    public function cancelLeaveRequest(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $id = (int)$args['id'];

        $data = $this->service->cancelLeaveRequest($user, $id);

        return $this->success($response, $data, 'Leave request cancelled successfully.');
    }

    public function uploadAttachment(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        // Any authenticated user can upload leave attachments (teachers, parents, students)

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No files uploaded', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->error($response, 'Failed to upload file', 400);
        }

        $url = $this->schoolAdminService->handleFileUpload($uploadedFile);

        return $this->success($response, ['url' => $url], 'Attachment uploaded successfully');
    }

    public function getChildren(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);

        $data = $this->service->getChildrenForUser($user);

        return $this->success($response, $data);
    }
}
