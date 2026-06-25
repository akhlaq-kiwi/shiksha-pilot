<?php

declare(strict_types=1);

namespace App\Shared\Exceptions;

class ValidationException extends AppException
{
    private array $errors;

    public function __construct(array $errors = [], string $message = 'Validation failed.')
    {
        parent::__construct($message, 400, 'VALIDATION_ERROR');
        $this->errors = $errors;
    }

    public static function fromErrors(array $errors): self
    {
        return new self($errors);
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}
