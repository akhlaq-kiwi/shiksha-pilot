<?php

declare(strict_types=1);

namespace App\Shared\Notifications;

use PDO;
use Throwable;

/**
 * The single place a notification is emitted from.
 *
 * Writes the dashboard_notifications row (the source of truth — the in-app
 * notification centre reads it, and it is what makes notifications survive a
 * device being offline) and then, best-effort, sends the FCM push.
 *
 * Two rules the whole design rests on:
 *
 *   1. The DB row is committed even if the push fails. A push is a courtesy
 *      copy; losing it must never lose the notification. Every send is wrapped
 *      so a Firebase outage cannot roll back a fee payment.
 *
 *   2. Broadcasts go to a topic, personal notifications go to tokens.
 *      FCM v1 has no multicast, so a 500-parent school broadcast is either one
 *      topic request or 500 token requests. Topics are therefore the only
 *      viable path on shared hosting. The tradeoff is that a client can
 *      subscribe to any topic name it likes, so topics carry only
 *      school-wide, non-personal content (a holiday, a published exam scheme).
 *      Anything naming a specific child, amount, or result is sent per-token.
 */
final class PushDispatcher
{
    /** Tokens fanned out per broadcast before we give up and rely on the DB row. */
    private const MAX_TOKEN_FANOUT = 40;

    /**
     * Total wall-clock seconds the whole fan-out may consume.
     *
     * The per-request timeout alone is not a sufficient bound: 40 tokens at the
     * 6s cURL timeout is 240 seconds of sequential sends, which on shared
     * hosting exceeds max_execution_time. A PHP execution timeout is a fatal
     * error, not an exception, so guard() cannot catch it — it would take down
     * the very write that triggered the notification (a teacher's homework save
     * returning 500 because Firebase was slow). This budget makes the fan-out
     * abandon remaining tokens instead. They still get the in-app notification.
     */
    private const FANOUT_TIME_BUDGET = 8;

    public function __construct(private PDO $pdo, private FcmClient $fcm) {}

    /**
     * Emit a notification to every user of a role in a school (user_id NULL).
     * Uses a topic — cheap regardless of how many devices are subscribed.
     */
    public function broadcast(
        int $schoolId,
        string $role,
        string $eventKey,
        string $title,
        string $message,
        ?string $link = null
    ): void {
        $notifId = $this->insertRow($schoolId, $role, null, $eventKey, $title, $message, $link);

        $this->guard(function () use ($schoolId, $role, $eventKey, $title, $message, $link, $notifId) {
            $this->fcm->sendToTopic(
                self::topicFor($schoolId, $role),
                ['title' => $title, 'body' => $message],
                $this->dataPayload($eventKey, $link, $notifId),
                NotificationCatalog::priorityFor($eventKey)
            );
        });
    }

    /**
     * Emit a notification to one specific user. Sends to that user's active
     * device tokens only — nothing personal ever goes near a topic.
     */
    public function toUser(
        int $schoolId,
        int $userId,
        string $role,
        string $eventKey,
        string $title,
        string $message,
        ?string $link = null
    ): void {
        $notifId = $this->insertRow($schoolId, $role, $userId, $eventKey, $title, $message, $link);

        $this->guard(function () use ($schoolId, $userId, $eventKey, $title, $message, $link, $notifId) {
            $tokens = $this->activeTokensForUser($schoolId, $userId);
            $this->fanOut($tokens, $eventKey, $title, $message, $link, $notifId);
        });
    }

    /**
     * Emit the same personal notification to several users at once (e.g. the
     * students of one class plus their parents). Rows are inserted for all of
     * them; the push fan-out is capped, since past the cap the per-request
     * cost stops being worth it and the in-app notification centre will show
     * it on next open anyway.
     *
     * @param array<int,array{user_id:int,role:string}> $recipients
     */
    public function toUsers(
        int $schoolId,
        array $recipients,
        string $eventKey,
        string $title,
        string $message,
        ?string $link = null
    ): void {
        $userIds = [];
        foreach ($recipients as $r) {
            $uid = (int) ($r['user_id'] ?? 0);
            if ($uid <= 0) {
                continue;
            }
            $this->insertRow($schoolId, (string) ($r['role'] ?? 'STUDENT'), $uid, $eventKey, $title, $message, $link);
            $userIds[] = $uid;
        }

        if ($userIds === []) {
            return;
        }

        $this->guard(function () use ($schoolId, $userIds, $eventKey, $title, $message, $link) {
            $tokens = $this->activeTokensForUsers($schoolId, $userIds);
            $this->fanOut($tokens, $eventKey, $title, $message, $link);
        });
    }

    /**
     * Static entry point for the existing notification helpers.
     *
     * The 19 pre-existing insert sites live in private helpers that receive a
     * raw `PDO $pdo` and are sometimes static, so they have no constructor to
     * inject into. Rather than restructure five services at once, they call
     * this. It mirrors SmtpMailer, which is likewise a static-only facade over
     * an outbound integration — the established convention here for exactly
     * this shape of problem.
     *
     * Note this only sends the FCM message; the caller still writes its own
     * dashboard_notifications row as it always has. That keeps the retrofit
     * additive: no existing INSERT changes behaviour, and a push failure
     * cannot affect a write that already worked.
     */
    public static function pushOnly(
        PDO $pdo,
        int $schoolId,
        string $role,
        ?int $userId,
        string $eventKey,
        string $title,
        string $message,
        ?string $link = null
    ): void {
        try {
            $dispatcher = new self($pdo, new FcmClient($pdo));
            if (!$dispatcher->fcm->isConfigured()) {
                return;
            }

            $notification = ['title' => $title, 'body' => $message];
            $data         = $dispatcher->dataPayload($eventKey, $link);
            $priority     = NotificationCatalog::priorityFor($eventKey);

            if ($userId === null) {
                // Role-wide broadcast: one topic request instead of one per device.
                $dispatcher->fcm->sendToTopic(self::topicFor($schoolId, $role), $notification, $data, $priority);
                return;
            }

            $dispatcher->fanOut(
                $dispatcher->activeTokensForUser($schoolId, $userId),
                $eventKey,
                $title,
                $message,
                $link
            );
        } catch (Throwable $e) {
            error_log('[push] pushOnly failed: ' . $e->getMessage());
        }
    }

    /** The topic a device of this role in this school subscribes to. */
    public static function topicFor(int $schoolId, string $role): string
    {
        // FCM topic names allow [a-zA-Z0-9-_.~%]+ only.
        return 'school_' . $schoolId . '_' . strtolower(preg_replace('/[^A-Za-z0-9_]/', '', $role));
    }

    // ------------------------------------------------------------------

    private function insertRow(
        int $schoolId,
        string $role,
        ?int $userId,
        string $eventKey,
        string $title,
        string $message,
        ?string $link
    ): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO dashboard_notifications
                (school_id, user_role, user_id, title, message, link, category, event_key, is_read)
            VALUES (:sid, :role, :uid, :title, :msg, :link, :cat, :ekey, 0)
        ");
        $stmt->execute([
            ':sid'   => $schoolId,
            ':role'  => $role,
            ':uid'   => $userId,
            ':title' => $title,
            ':msg'   => $message,
            ':link'  => $link,
            ':cat'   => NotificationCatalog::categoryFor($eventKey),
            ':ekey'  => $eventKey,
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    /** @param array<int,string> $tokens */
    private function fanOut(array $tokens, string $eventKey, string $title, string $message, ?string $link, ?int $notifId = null): void
    {
        $priority     = NotificationCatalog::priorityFor($eventKey);
        $notification = ['title' => $title, 'body' => $message];
        $data         = $this->dataPayload($eventKey, $link, $notifId);
        $dead         = [];
        $deadline     = microtime(true) + self::FANOUT_TIME_BUDGET;
        $sent         = 0;

        foreach (array_slice($tokens, 0, self::MAX_TOKEN_FANOUT) as $token) {
            if (microtime(true) >= $deadline) {
                error_log(sprintf(
                    '[push] fan-out budget exhausted for %s after %d/%d tokens; remainder rely on the in-app centre',
                    $eventKey,
                    $sent,
                    count($tokens)
                ));
                break;
            }

            $error = $this->fcm->sendToToken($token, $notification, $data, $priority);
            $sent++;
            if ($error === 'UNREGISTERED' || $error === 'INVALID_ARGUMENT') {
                $dead[] = $token;
            }
        }

        $this->deactivateTokens($dead);
    }

    private function dataPayload(string $eventKey, ?string $link, ?int $notifId = null): array
    {
        return [
            'event_key'       => $eventKey,
            'category'        => NotificationCatalog::categoryFor($eventKey),
            'link'            => $link ?? '',
            'notification_id' => $notifId ? (string)$notifId : '',
            'id'              => $notifId ? (string)$notifId : '',
            // Lets the app open the right screen without re-deriving intent
            // from the notification copy, which is what it does today.
            'click_action'    => 'FLUTTER_NOTIFICATION_CLICK',
        ];
    }

    /** @return array<int,string> */
    private function activeTokensForUser(int $schoolId, int $userId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT token FROM device_tokens
            WHERE school_id = :sid AND user_id = :uid AND is_active = 1
        ");
        $stmt->execute([':sid' => $schoolId, ':uid' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    /**
     * @param array<int,int> $userIds
     * @return array<int,string>
     */
    private function activeTokensForUsers(int $schoolId, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }
        // Ints are cast and inlined rather than bound: the list length varies
        // per call, so binding would mean rebuilding the prepared statement
        // every time anyway, and these never come from request input.
        $safe = implode(',', array_map('intval', $userIds));

        $stmt = $this->pdo->prepare("
            SELECT token FROM device_tokens
            WHERE school_id = :sid AND is_active = 1 AND user_id IN ({$safe})
            LIMIT " . self::MAX_TOKEN_FANOUT
        );
        $stmt->execute([':sid' => $schoolId]);

        return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    /** @param array<int,string> $tokens */
    private function deactivateTokens(array $tokens): void
    {
        if ($tokens === []) {
            return;
        }
        $stmt = $this->pdo->prepare("UPDATE device_tokens SET is_active = 0 WHERE token = :tok");
        foreach ($tokens as $token) {
            $stmt->execute([':tok' => $token]);
        }
    }

    /**
     * Push sending is never allowed to surface an exception. The business
     * transaction that triggered the notification has already succeeded (or is
     * about to commit); a Firebase timeout must not turn that into a 500.
     */
    private function guard(callable $fn): void
    {
        if (!$this->fcm->isConfigured()) {
            return;
        }
        try {
            $fn();
        } catch (Throwable $e) {
            error_log('[push] send failed: ' . $e->getMessage());
        }
    }
}
