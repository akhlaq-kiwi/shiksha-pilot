<?php

declare(strict_types=1);

namespace App\Domain\Platform\Repositories;

use App\Shared\BaseRepository;

class PlansRepository extends BaseRepository
{
    protected string $table = 'plans';

    public function allActive(): array
    {
        return $this->findAll(['is_active' => 1], 'id ASC');
    }

    public function findByName(string $name): ?array
    {
        return $this->findOne(['name' => $name]);
    }
}
