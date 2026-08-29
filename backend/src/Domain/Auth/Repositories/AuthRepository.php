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
            "SELECT u.*, s.portal_theme AS school_portal_theme, s.status AS school_status, s.name AS school_name, st.photo_path AS staff_photo_path
               FROM users u
               LEFT JOIN schools s ON s.id = u.school_id
               LEFT JOIN staff st ON st.phone = u.phone AND st.school_id = u.school_id
              WHERE u.phone = :phone
              LIMIT 1"
        );
        $stmt->execute(['phone' => $phone]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }

    /**
     * Find a user row by primary ID.
     */
    public function findById(string|int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT u.*, s.portal_theme AS school_portal_theme, s.status AS school_status, s.name AS school_name, st.photo_path AS staff_photo_path
               FROM users u
               LEFT JOIN schools s ON s.id = u.school_id
               LEFT JOIN staff st ON st.phone = u.phone AND st.school_id = u.school_id
              WHERE u.id = :id
              LIMIT 1"
        );
        $stmt->execute(['id' => $id]);
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
            'plain_password'        => $newPassword,
            'force_password_change' => 0,
        ]);
    }

    // ---------------------------------------------------------------------
    // Account deletion requests (PF-04)
    // ---------------------------------------------------------------------

    /** The user's most recent request, whatever its status, or null. */
    public function findLatestDeletionRequest(int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT id, status, reason, resolution_note, created_at, resolved_at
               FROM account_deletion_requests
              WHERE user_id = :uid
           ORDER BY id DESC
              LIMIT 1"
        );
        $stmt->execute(['uid' => $userId]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    public function findPendingDeletionRequest(int $userId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT id, status, reason, created_at
               FROM account_deletion_requests
              WHERE user_id = :uid AND status = 'PENDING'
           ORDER BY id DESC
              LIMIT 1"
        );
        $stmt->execute(['uid' => $userId]);
        $row = $stmt->fetch();

        return $row ?: null;
    }

    /**
     * Record a new request. Name and phone are copied from the user row on
     * purpose: completing the request anonymises that row, and without a copy
     * there would be no way to contact the requester or audit the decision.
     */
    public function createDeletionRequest(array $user, ?string $reason): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO account_deletion_requests
                    (user_id, school_id, contact_phone, contact_name, reason)
             VALUES (:uid, :sid, :phone, :name, :reason)"
        );
        $stmt->execute([
            'uid'    => (int)$user['id'],
            'sid'    => $user['school_id'] !== null ? (int)$user['school_id'] : null,
            'phone'  => (string)($user['phone'] ?? ''),
            'name'   => (string)($user['name'] ?? ''),
            'reason' => ($reason === null || $reason === '') ? null : $reason,
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    public function cancelDeletionRequest(int $userId, int $requestId): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE account_deletion_requests
                SET status = 'CANCELLED', resolved_at = NOW()
              WHERE id = :id AND user_id = :uid AND status = 'PENDING'"
        );
        $stmt->execute(['id' => $requestId, 'uid' => $userId]);

        return $stmt->rowCount() > 0;
    }
}
