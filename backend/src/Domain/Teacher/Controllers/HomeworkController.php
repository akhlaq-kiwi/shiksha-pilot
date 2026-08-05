<?php

declare(strict_types=1);

namespace App\Domain\Teacher\Controllers;

use App\Domain\Teacher\Services\HomeworkService;
use App\Shared\Auth\TokenService;
use App\Shared\BaseController;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class HomeworkController extends BaseController
{
    private HomeworkService $service;

    public function __construct(TokenService $tokenService, HomeworkService $service)
    {
        parent::__construct($tokenService);
        $this->service = $service;
    }

    public function uploadAttachment(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);

        $uploadedFiles = $request->getUploadedFiles();
        if (empty($uploadedFiles)) {
            return $this->error($response, 'No files uploaded', 400);
        }

        $fileKey = array_key_first($uploadedFiles);
        $uploadedFile = $uploadedFiles[$fileKey];

        $data = $this->service->uploadAttachment($uploadedFile);
        return $this->success($response, $data, 'Attachment uploaded successfully');
    }

    public function getTeacherHomework(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);

        $data = $this->service->getTeacherHomework($user);
        return $this->success($response, $data);
    }

    public function getStudentHomework(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['STUDENT', 'PARENT']);

        $headerStudentId = null;
        $studentIdHeader = $request->getHeaderLine('X-Student-Id');
        if (!empty($studentIdHeader)) {
            $headerStudentId = (int)$studentIdHeader;
        }

        $data = $this->service->getStudentHomework($user, $headerStudentId);
        return $this->success($response, $data);
    }

    public function createHomework(Request $request, Response $response): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);

        $body = (array)$request->getParsedBody();
        $data = $this->service->createHomework($user, $body);
        return $this->success($response, $data, 'Homework uploaded successfully');
    }

    public function updateHomework(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);

        $id = (int)$args['id'];
        $body = (array)$request->getParsedBody();
        $data = $this->service->updateHomework($user, $id, $body);
        return $this->success($response, $data, 'Homework updated successfully');
    }

    public function deleteHomework(Request $request, Response $response, array $args): Response
    {
        $user = $this->authenticate($request);
        $this->requireRole($user, ['TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL']);

        $id = (int)$args['id'];
        $data = $this->service->deleteHomework($user, $id);
        return $this->success($response, $data, 'Homework deleted successfully');
    }
}
