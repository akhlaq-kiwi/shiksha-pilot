<?php

declare(strict_types=1);

namespace App\Shared;

use PDO;
use Psr\Log\LoggerInterface;

abstract class BaseService
{
    public function __construct(protected ?LoggerInterface $logger = null) {}

    // -------------------------------------------------------------------------
    // Logging
    // -------------------------------------------------------------------------

    /**
     * Write a message to the logger when one is configured, silently skip otherwise.
     */
    protected function log(string $message, array $context = []): void
    {
        $this->logger?->info($message, $context);
    }

    // -------------------------------------------------------------------------
    // Transaction helpers
    // -------------------------------------------------------------------------

    protected function beginTransaction(PDO $pdo): void
    {
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
        }
    }

    protected function commit(PDO $pdo): void
    {
        if ($pdo->inTransaction()) {
            $pdo->commit();
        }
    }

    protected function rollback(PDO $pdo): void
    {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }
}
