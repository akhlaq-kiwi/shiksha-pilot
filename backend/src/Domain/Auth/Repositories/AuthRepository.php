<?php

declare(strict_types=1);

namespace App\Domain\Auth\Repositories;

use App\Shared\BaseRepository;

class AuthRepository extends BaseRepository
{
    protected string $table = 'users';

    /**
     * Find a user row by phone number, or return null when not found.
     */
    public function findByPhone(string $phone): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT u.*, s.portal_theme AS school_portal_theme, s.status AS school_status
               FROM users u
               LEFT JOIN schools s ON s.id = u.school_id
              WHERE u.phone = :phone
              LIMIT 1"
        );
        $stmt->execute(['phone' => $phone]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }

    /**
     * Insert a new user row, hashing the plain-text password before storage.
     * Returns the new user's primary key.
     */
    public function createUser(array $data): int
    {
        if (isset($data['password'])) {
            $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        return $this->create($data);
    }

    /**
     * Update password and clear force_password_change flag.
     */
    public function updatePassword(int $userId, string $newPassword): void
    {
        $this->update($userId, [
            'password'              => password_hash($newPassword, PASSWORD_BCRYPT),
            'force_password_change' => 0,
        ]);
    }
}
