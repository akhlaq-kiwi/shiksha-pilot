<?php

declare(strict_types=1);

namespace App\Shared;

use PDO;

abstract class BaseRepository
{
    /** Child classes must declare: protected string $table = 'table_name'; */
    protected string $table;

    public function __construct(protected PDO $pdo) {}

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    public function findById(int|string $id): ?array
    {
        $sql  = "SELECT * FROM {$this->table} WHERE id = :id LIMIT 1";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row !== false ? $row : null;
    }

    /**
     * Fetch multiple rows with optional equality conditions, ordering, and a row cap.
     *
     * @param array  $conditions  ['column' => value, ...]  — all joined with AND.
     * @param string $orderBy     e.g. 'created_at DESC'
     * @param int    $limit       Maximum rows to return.
     */
    public function findAll(
        array $conditions = [],
        string $orderBy = 'id DESC',
        int $limit = 1000,
    ): array {
        [$where, $params] = $this->buildWhere($conditions);

        $sql  = "SELECT * FROM {$this->table}{$where} ORDER BY {$orderBy} LIMIT :limit";
        $stmt = $this->pdo->prepare($sql);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Return the first row matching all conditions, or null.
     */
    public function findOne(array $conditions): ?array
    {
        [$where, $params] = $this->buildWhere($conditions);

        $sql  = "SELECT * FROM {$this->table}{$where} LIMIT 1";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row !== false ? $row : null;
    }

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Insert a new row and return the last inserted ID.
     */
    public function create(array $data): int
    {
        $columns      = array_keys($data);
        $placeholders = array_map(static fn($col) => ":{$col}", $columns);

        $backticked   = array_map(static fn($col) => "`{$col}`", $columns);
        $colList      = implode(', ', $backticked);
        $valList      = implode(', ', $placeholders);

        $sql  = "INSERT INTO {$this->table} ({$colList}) VALUES ({$valList})";
        $stmt = $this->pdo->prepare($sql);

        $bound = [];
        foreach ($data as $col => $value) {
            $bound[":{$col}"] = $value;
        }

        $stmt->execute($bound);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Update columns for a single row identified by id.
     */
    public function update(int|string $id, array $data): bool
    {
        if (count($data) === 0) {
            return false;
        }

        $setParts = array_map(static fn($col) => "`{$col}` = :{$col}", array_keys($data));
        $setClause = implode(', ', $setParts);

        $sql  = "UPDATE {$this->table} SET {$setClause} WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);

        $bound = [':id' => $id];
        foreach ($data as $col => $value) {
            $bound[":{$col}"] = $value;
        }

        $stmt->execute($bound);

        return $stmt->rowCount() > 0;
    }

    /**
     * Delete a row by its primary key.
     */
    public function delete(int|string $id): bool
    {
        $sql  = "DELETE FROM {$this->table} WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }

    // -------------------------------------------------------------------------
    // Aggregate
    // -------------------------------------------------------------------------

    public function count(array $conditions = []): int
    {
        [$where, $params] = $this->buildWhere($conditions);

        $sql  = "SELECT COUNT(*) FROM {$this->table}{$where}";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    public function exists(array $conditions): bool
    {
        return $this->count($conditions) > 0;
    }

    // -------------------------------------------------------------------------
    // Escape hatch
    // -------------------------------------------------------------------------

    public function getPdo(): PDO
    {
        return $this->pdo;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Build a WHERE clause string and a bound-parameter map from a conditions array.
     *
     * @return array{0: string, 1: array<string, mixed>}
     */
    private function buildWhere(array $conditions): array
    {
        if (count($conditions) === 0) {
            return ['', []];
        }

        $parts  = [];
        $params = [];

        foreach ($conditions as $column => $value) {
            $placeholder          = ":cond_{$column}";
            $parts[]              = "{$column} = {$placeholder}";
            $params[$placeholder] = $value;
        }

        $where = ' WHERE ' . implode(' AND ', $parts);

        return [$where, $params];
    }
}
