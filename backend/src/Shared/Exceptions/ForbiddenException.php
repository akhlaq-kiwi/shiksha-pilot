<?php

declare(strict_types=1);

namespace App\Shared\Exceptions;

class ForbiddenException extends AppException
{
    public function __construct(string $message = 'You do not have permission to perform this action.')
    {
        parent::__construct($message, 403, 'FORBIDDEN');
    }
}
