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
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
                ]);
                $this->pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
                $this->setPdoTimezone($this->pdo);
            } catch (PDOException $e) {
                // If DB doesn't exist yet, we try to connect to server without dbname to allow migrations creation
                $fallbackDsn = "mysql:host={$this->host};charset=utf8mb4";
                $this->pdo = new PDO($fallbackDsn, $this->user, $this->pass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
                ]);
                $this->pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
                $this->setPdoTimezone($this->pdo);
            }
        }

        return $this->pdo;
    }

    private function setPdoTimezone(PDO $pdo): void
    {
        $now = new \DateTime();
        $mins = $now->getOffset() / 60;
        $sgn = $mins < 0 ? -1 : 1;
        $mins = abs($mins);
        $hrs = (int)floor($mins / 60);
        $mins = (int)($mins % 60);
        $tz = sprintf('%s%02d:%02d', $sgn < 0 ? '-' : '+', $hrs, $mins);
        
        $pdo->exec("SET time_zone = '{$tz}'");
    }
}
