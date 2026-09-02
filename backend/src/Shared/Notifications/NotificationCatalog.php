<?php

declare(strict_types=1);

namespace App\Shared\Notifications;

/**
 * The canonical registry of every notification the platform can emit.
 *
 * Before this existed, a notification's "kind" was inferred by substring
 * matching on its title and message — both in the backend and again in the
 * Flutter app (see NotificationHelper.navigateToTarget). That breaks the
 * moment copy changes, and it already fails for exam and announcement
 * notifications, whose title is the exam/announcement name rather than a
 * fixed string. Every event here carries a stable event_key instead.
 *
 * DELIVERY is the axis that matters operationally:
 *   - PUSH  : a server-side business event. The backend writes a
 *             dashboard_notifications row and sends an FCM message.
 *   - LOCAL : scheduled on the device from data it already has. No server
 *             round trip, works offline, and costs the API nothing — which
 *             is why every reminder-shaped notification is LOCAL.
 */
final class NotificationCatalog
{
    // ---- Categories (also the Android notification channel keys) ----
    public const CAT_ACADEMIC     = 'ACADEMIC';
    public const CAT_ATTENDANCE   = 'ATTENDANCE';
    public const CAT_FEES         = 'FEES';
    public const CAT_LEAVE        = 'LEAVE';
    public const CAT_EXAM         = 'EXAM';
    public const CAT_ANNOUNCEMENT = 'ANNOUNCEMENT';
    public const CAT_ADMIN        = 'ADMIN';
    public const CAT_ACHIEVEMENT  = 'ACHIEVEMENT';
    public const CAT_SYSTEM       = 'SYSTEM';

    public const DELIVERY_PUSH  = 'PUSH';
    public const DELIVERY_LOCAL = 'LOCAL';

    /**
     * event_key => definition.
     *
     * priority 'high' maps to FCM priority high + Android IMPORTANCE_MAX; it
     * is reserved for things a user would want to be interrupted for. Fee
     * ledger bookkeeping and auto-generated charges are deliberately 'normal'
     * so they batch quietly instead of buzzing a parent's phone.
     */
    private const EVENTS = [
        // ---------------- LEAVE ----------------
        'LEAVE_REQUEST_SUBMITTED' => [
            'category' => self::CAT_LEAVE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['SCHOOL_ADMIN'],
            'priority' => 'high',
            'link'     => '/school-admin/leave-requests',
            'label'    => 'A teacher or student submitted a leave request',
        ],
        'LEAVE_APPROVED' => [
            'category' => self::CAT_LEAVE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'PARENT'],
            'priority' => 'high',
            'link'     => '/leaves',
            'label'    => 'Your leave request was approved',
        ],
        'LEAVE_REJECTED' => [
            'category' => self::CAT_LEAVE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'PARENT'],
            'priority' => 'high',
            'link'     => '/leaves',
            'label'    => 'Your leave request was rejected',
        ],
        'LEAVE_CANCELLED_BY_APPLICANT' => [
            'category' => self::CAT_LEAVE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['SCHOOL_ADMIN'],
            'priority' => 'normal',
            'link'     => '/school-admin/leave-requests',
            'label'    => 'An applicant cancelled their own leave request',
        ],
        'LEAVE_CANCELLED_BY_ADMIN' => [
            'category' => self::CAT_LEAVE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'PARENT'],
            'priority' => 'high',
            'link'     => '/leaves',
            'label'    => 'An administrator cancelled your leave request',
        ],
        'HOLIDAY_ANNOUNCED' => [
            'category' => self::CAT_LEAVE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/leaves',
            'label'    => 'A school holiday was added to the calendar',
        ],

        // ---------------- ACADEMIC ----------------
        'HOMEWORK_ASSIGNED' => [
            'category' => self::CAT_ACADEMIC,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/homework',
            'label'    => 'New homework was assigned to your class',
        ],
        'HOMEWORK_DUE_REMINDER' => [
            'category' => self::CAT_ACADEMIC,
            'delivery' => self::DELIVERY_LOCAL,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/homework',
            'label'    => 'Homework is due tomorrow (scheduled on device)',
        ],
        'TIMETABLE_UPDATED' => [
            'category' => self::CAT_ACADEMIC,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/timetable',
            'label'    => 'The class timetable changed',
        ],
        'SUBSTITUTE_ASSIGNED' => [
            'category' => self::CAT_ACADEMIC,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER'],
            'priority' => 'high',
            'link'     => '/timetable',
            'label'    => 'You were assigned as a substitute teacher',
        ],

        // ---------------- EXAM ----------------
        'EXAM_SCHEDULED' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/exams',
            'label'    => 'An examination was scheduled',
        ],
        'EXAM_SCHEME_PUBLISHED' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT', 'TEACHER'],
            'priority' => 'high',
            'link'     => '/exams',
            'label'    => 'The examination scheme was published',
        ],
        'EXAM_SCHEME_UNPUBLISHED' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT', 'TEACHER'],
            'priority' => 'normal',
            'link'     => '/exams',
            'label'    => 'The examination scheme was reverted to draft',
        ],
        'EXAM_ADMIT_CARD_PUBLISHED' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/exams',
            'label'    => 'Your admit card was published',
        ],
        'EXAM_ADMIT_CARD_UNPUBLISHED' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/exams',
            'label'    => 'Your admit card was reverted to draft',
        ],
        'EXAM_RESULT_PUBLISHED' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/exams',
            'label'    => 'Your examination result was published',
        ],
        'EXAM_STARTS_TOMORROW' => [
            'category' => self::CAT_EXAM,
            'delivery' => self::DELIVERY_LOCAL,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/exams',
            'label'    => 'An exam starts tomorrow (scheduled on device)',
        ],

        // ---------------- ATTENDANCE ----------------
        'ATTENDANCE_MARKED_ABSENT' => [
            'category' => self::CAT_ATTENDANCE,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/attendance',
            'label'    => 'You were marked absent today',
        ],
        'ATTENDANCE_NOT_MARKED_REMINDER' => [
            'category' => self::CAT_ATTENDANCE,
            'delivery' => self::DELIVERY_LOCAL,
            'audience' => ['TEACHER'],
            'priority' => 'high',
            'link'     => '/attendance',
            'label'    => "Reminder to mark today's attendance (scheduled on device)",
        ],

        // ---------------- FEES ----------------
        'FEE_ADMISSION_ADDED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/student/fees',
            'label'    => 'An admission fee was added to the ledger',
        ],
        'FEE_ANNUAL_ADDED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/student/fees',
            'label'    => 'An annual fee was added to the ledger',
        ],
        'FEE_TRANSPORT_GENERATED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/student/fees',
            'label'    => 'A monthly transport fee was generated',
        ],
        'FEE_PAYMENT_RECORDED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/student/fees',
            'label'    => 'A fee payment was recorded (receipt available)',
        ],
        'FEE_PAYMENT_REVERTED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/student/fees',
            'label'    => 'A previously recorded fee payment was reverted',
        ],
        'FEE_PENALTY_APPLIED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/student/fees',
            'label'    => 'A late payment penalty was applied',
        ],
        'FEE_DUE_REMINDER' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_LOCAL,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/student/fees',
            'label'    => 'A fee instalment is due soon (scheduled on device)',
        ],
        'FEE_FOLLOWUP_DUE_TODAY' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['SCHOOL_ADMIN'],
            'priority' => 'high',
            'link'     => '/school-admin/fee-follow-ups',
            'label'    => 'A fee follow-up promise date is today',
        ],
        'FEE_FOLLOWUP_OVERDUE' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['SCHOOL_ADMIN'],
            'priority' => 'high',
            'link'     => '/school-admin/fee-follow-ups',
            'label'    => 'A fee follow-up is overdue',
        ],
        'SALARY_DISBURSED' => [
            'category' => self::CAT_FEES,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER'],
            'priority' => 'high',
            'link'     => '/teacher/salary',
            'label'    => 'Salary has been disbursed',
        ],

        // ---------------- ANNOUNCEMENT ----------------
        'ANNOUNCEMENT_PUBLISHED' => [
            'category' => self::CAT_ANNOUNCEMENT,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['TEACHER', 'STUDENT', 'PARENT'],
            'priority' => 'high',
            'link'     => '/notice',
            'label'    => 'A school notice or announcement was published',
        ],

        // ---------------- ACHIEVEMENT ----------------
        'ACHIEVEMENT_ATTENDANCE_AWARD' => [
            'category' => self::CAT_ACHIEVEMENT,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/achievements',
            'label'    => 'An attendance champion certificate was issued',
        ],
        'ACHIEVEMENT_ACADEMIC_TOPPER' => [
            'category' => self::CAT_ACHIEVEMENT,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['STUDENT', 'PARENT'],
            'priority' => 'normal',
            'link'     => '/achievements',
            'label'    => 'An academic excellence certificate was issued',
        ],

        // ---------------- ADMIN / PLATFORM ----------------
        'SUBSCRIPTION_UPGRADED' => [
            'category' => self::CAT_ADMIN,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['SCHOOL_ADMIN'],
            'priority' => 'normal',
            'link'     => '/school-admin/profile/subscription',
            'label'    => "The school's subscription plan was upgraded",
        ],
        'ACCOUNT_DELETION_REQUESTED' => [
            'category' => self::CAT_ADMIN,
            'delivery' => self::DELIVERY_PUSH,
            'audience' => ['SCHOOL_ADMIN'],
            // High: the public /delete-account page commits to acting within
            // 30 days, and nothing else surfaces these requests.
            'priority' => 'high',
            'link'     => '/school-admin/security',
            'label'    => 'Someone requested deletion of their account',
        ],

        // ---------------- SYSTEM (device-only) ----------------
        'FILE_DOWNLOAD_COMPLETE' => [
            'category' => self::CAT_SYSTEM,
            'delivery' => self::DELIVERY_LOCAL,
            'audience' => ['TEACHER', 'STUDENT', 'PARENT', 'SCHOOL_ADMIN'],
            'priority' => 'normal',
            'link'     => null,
            'label'    => 'A PDF finished downloading (tap to open)',
        ],
    ];

    /** @return array<string,array>|null */
    public static function get(string $eventKey): ?array
    {
        return self::EVENTS[$eventKey] ?? null;
    }

    public static function categoryFor(string $eventKey): string
    {
        return self::EVENTS[$eventKey]['category'] ?? self::CAT_SYSTEM;
    }

    public static function priorityFor(string $eventKey): string
    {
        return self::EVENTS[$eventKey]['priority'] ?? 'normal';
    }

    public static function isPush(string $eventKey): bool
    {
        return (self::EVENTS[$eventKey]['delivery'] ?? null) === self::DELIVERY_PUSH;
    }

    /** @return array<string,array> */
    public static function all(): array
    {
        return self::EVENTS;
    }

    /** @return array<string,array> */
    public static function byDelivery(string $delivery): array
    {
        return array_filter(self::EVENTS, fn(array $e) => $e['delivery'] === $delivery);
    }
}
