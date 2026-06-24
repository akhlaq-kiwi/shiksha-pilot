<?php

namespace App\Shared;

use PDO;

abstract class BaseRepository
{
    public function __construct(
        protected PDO $db
    ) {}
}
