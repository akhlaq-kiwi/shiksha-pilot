<?php

declare(strict_types=1);

namespace App\Bootstrap;

use App\Shared\Exceptions\AppException;
use App\Shared\Exceptions\ForbiddenException;
use App\Shared\Exceptions\NotFoundException;
use App\Shared\Exceptions\UnauthorizedException;
use App\Shared\Exceptions\ValidationException;
use App\Shared\Http\ResponseFormatter;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Throwable;

class ErrorHandler
{
    public function __construct(private ResponseFactoryInterface $responseFactory) {}

    public function __invoke(
        Request $request,
        Throwable $exception,
        bool $displayErrorDetails,
        bool $logErrors,
        bool $logErrorDetails,
    ): Response {
        $response = $this->responseFactory->createResponse();

        // --- Validation errors (400) ---
        if ($exception instanceof ValidationException) {
            return ResponseFormatter::error(
                $response,
                $exception->getMessage(),
                400,
                $exception->getErrors(),
            );
        }

        // --- Unauthorized (401) ---
        if ($exception instanceof UnauthorizedException) {
            return ResponseFormatter::error(
                $response,
                $exception->getMessage(),
                401,
            );
        }

        // --- Forbidden (403) ---
        if ($exception instanceof ForbiddenException) {
            return ResponseFormatter::error(
                $response,
                $exception->getMessage(),
                403,
            );
        }

        // --- Not found (404) ---
        if ($exception instanceof NotFoundException) {
            return ResponseFormatter::error(
                $response,
                $exception->getMessage(),
                404,
            );
        }

        // --- Generic application exceptions ---
        if ($exception instanceof AppException) {
            return ResponseFormatter::error(
                $response,
                $exception->getMessage(),
                $exception->getStatusCode(),
            );
        }

        // --- Unexpected / internal errors ---
        $message = $displayErrorDetails
            ? $exception->getMessage()
            : 'Internal server error.';

        return ResponseFormatter::error($response, $message, 500);
    }
}
