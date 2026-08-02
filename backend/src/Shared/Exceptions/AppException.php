<?php

declare(strict_types=1);

namespace App\Shared\Exceptions;

use RuntimeException;

class AppException extends RuntimeException
{
    public function __construct(
        string $message = 'An application error occurred.',
        protected int $statusCode = 500,
        protected string $errorCode = 'APP_ERROR',
    ) {
        parent::__construct($message);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
