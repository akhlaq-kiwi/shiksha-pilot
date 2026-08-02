<?php

declare(strict_types=1);

namespace App\Shared\Exceptions;

class UnauthorizedException extends AppException
{
    public function __construct(string $message = 'Unauthorized. Please log in.')
    {
        parent::__construct($message, 401, 'UNAUTHORIZED');
    }
}
