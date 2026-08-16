<?php

declare(strict_types=1);

namespace App\Shared\Storage;

use App\Shared\Exceptions\AppException;

class StorageException extends AppException
{
    public function __construct(string $message = 'File storage operation failed.')
    {
        parent::__construct($message, 500, 'STORAGE_ERROR');
    }
}
