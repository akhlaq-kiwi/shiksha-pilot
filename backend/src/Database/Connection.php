<?php

declare(strict_types=1);

namespace App\Database;

use PDO;
use PDOException;

class Connection
{
    private ?PDO $pdo = null;

    public function __construct(
        private string $host,
        private string $dbname,
        private string $user,
        private string $pass
    ) {}

    public function getPdo(): PDO
    {
        if ($this->pdo === null) {
            $dsn = "mysql:host={$this->host};dbname={$this->dbname};charset=utf8mb4";
            
            try {
                $this->pdo = new PDO($dsn, $this->user, $this->pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                // If DB doesn't exist yet, we try to connect to server without dbname to allow migrations creation
                $fallbackDsn = "mysql:host={$this->host};charset=utf8mb4";
                $this->pdo = new PDO($fallbackDsn, $this->user, $this->pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                ]);
            }
        }

        return $this->pdo;
    }
}
