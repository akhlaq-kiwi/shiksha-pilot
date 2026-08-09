import 'package:flutter/material.dart';

/// Notification categories, mirroring backend NotificationCatalog::CAT_*.
///
/// Each category is also an Android notification channel. Channels matter
/// beyond cosmetics: on Android 8+ the channel owns the importance, sound and
/// vibration, and the user can mute one channel without muting the app. So a
/// parent can silence fee-ledger bookkeeping while keeping "your child was
/// marked absent" arriving with sound — which is impossible if everything
/// shares a single channel, as it did before.
///
/// The `category` field on an FCM data payload is used verbatim as the
/// channel_id (see FcmClient), so these ids must match the backend's strings.
class NotificationCategory {
  final String id;
  final String name;
  final String description;
  final IconData icon;
  final Color color;
  final bool highImportance;

  const NotificationCategory({
    required this.id,
    required this.name,
    required this.description,
    required this.icon,
    required this.color,
    this.highImportance = true,
  });

  static const academic = NotificationCategory(
    id: 'ACADEMIC',
    name: 'Homework & Classes',
    description: 'Homework assignments, timetable changes and substitutions',
    icon: Icons.menu_book_rounded,
    color: Color(0xFF6A45C4),
  );

  static const attendance = NotificationCategory(
    id: 'ATTENDANCE',
    name: 'Attendance',
    description: 'Absence alerts and reminders to mark attendance',
    icon: Icons.fact_check_rounded,
    color: Color(0xFF1F8F66),
  );

  static const fees = NotificationCategory(
    id: 'FEES',
    name: 'Fees & Payments',
    description: 'Fee dues, receipts, penalties and payment reminders',
    icon: Icons.payments_rounded,
    color: Color(0xFFC97B12),
  );

  static const leave = NotificationCategory(
    id: 'LEAVE',
    name: 'Leave & Holidays',
    description: 'Leave request decisions and school holidays',
    icon: Icons.event_available_rounded,
    color: Color(0xFF1687AD),
  );

  static const exam = NotificationCategory(
    id: 'EXAM',
    name: 'Exams & Results',
    description: 'Exam schedules, admit cards and published results',
    icon: Icons.school_rounded,
    color: Color(0xFFD1442C),
  );

  static const announcement = NotificationCategory(
    id: 'ANNOUNCEMENT',
    name: 'Notices',
    description: 'School notices and announcements',
    icon: Icons.campaign_rounded,
    color: Color(0xFFA67A04),
  );

  static const admin = NotificationCategory(
    id: 'ADMIN',
    name: 'Administration',
    description: 'Subscription and school administration updates',
    icon: Icons.admin_panel_settings_rounded,
    color: Color(0xFF5B6B78),
    highImportance: false,
  );

  static const achievement = NotificationCategory(
    id: 'ACHIEVEMENT',
    name: 'Achievements',
    description: 'Certificates and awards earned',
    icon: Icons.emoji_events_rounded,
    color: Color(0xFFE8A020),
    highImportance: false,
  );

  static const system = NotificationCategory(
    id: 'SYSTEM',
    name: 'Downloads & App',
    description: 'File downloads and app messages',
    icon: Icons.download_rounded,
    color: Color(0xFF5B6B78),
    highImportance: false,
  );

  static const all = <NotificationCategory>[
    academic,
    attendance,
    fees,
    leave,
    exam,
    announcement,
    achievement,
    admin,
    system,
  ];

  static NotificationCategory byId(String? id) {
    if (id == null || id.isEmpty) return system;
    return all.firstWhere(
      (c) => c.id == id.toUpperCase(),
      orElse: () => system,
    );
  }
}

/// Event keys, mirroring the backend catalog. Used for deep-link routing so
/// the app no longer has to guess intent by substring-matching notification
/// copy — the old approach broke whenever wording changed, and could not tell
/// an exam result from an admit card because both carry the exam name as their
/// title.
class NotificationEvent {
  static const leaveRequestSubmitted = 'LEAVE_REQUEST_SUBMITTED';
  static const leaveApproved = 'LEAVE_APPROVED';
  static const leaveRejected = 'LEAVE_REJECTED';
  static const leaveCancelledByApplicant = 'LEAVE_CANCELLED_BY_APPLICANT';
  static const leaveCancelledByAdmin = 'LEAVE_CANCELLED_BY_ADMIN';
  static const holidayAnnounced = 'HOLIDAY_ANNOUNCED';

  static const homeworkAssigned = 'HOMEWORK_ASSIGNED';
  static const homeworkDueReminder = 'HOMEWORK_DUE_REMINDER';
  static const timetableUpdated = 'TIMETABLE_UPDATED';
  static const substituteAssigned = 'SUBSTITUTE_ASSIGNED';

  static const examScheduled = 'EXAM_SCHEDULED';
  static const examSchemePublished = 'EXAM_SCHEME_PUBLISHED';
  static const examSchemeUnpublished = 'EXAM_SCHEME_UNPUBLISHED';
  static const examAdmitCardPublished = 'EXAM_ADMIT_CARD_PUBLISHED';
  static const examAdmitCardUnpublished = 'EXAM_ADMIT_CARD_UNPUBLISHED';
  static const examResultPublished = 'EXAM_RESULT_PUBLISHED';
  static const examStartsTomorrow = 'EXAM_STARTS_TOMORROW';

  static const attendanceMarkedAbsent = 'ATTENDANCE_MARKED_ABSENT';
  static const attendanceNotMarkedReminder = 'ATTENDANCE_NOT_MARKED_REMINDER';

  static const feeAdmissionAdded = 'FEE_ADMISSION_ADDED';
  static const feeAnnualAdded = 'FEE_ANNUAL_ADDED';
  static const feeTransportGenerated = 'FEE_TRANSPORT_GENERATED';
  static const feePaymentRecorded = 'FEE_PAYMENT_RECORDED';
  static const feePaymentReverted = 'FEE_PAYMENT_REVERTED';
  static const feePenaltyApplied = 'FEE_PENALTY_APPLIED';
  static const feeDueReminder = 'FEE_DUE_REMINDER';
  static const feeFollowupDueToday = 'FEE_FOLLOWUP_DUE_TODAY';
  static const feeFollowupOverdue = 'FEE_FOLLOWUP_OVERDUE';

  static const announcementPublished = 'ANNOUNCEMENT_PUBLISHED';

  static const achievementAttendanceAward = 'ACHIEVEMENT_ATTENDANCE_AWARD';
  static const achievementAcademicTopper = 'ACHIEVEMENT_ACADEMIC_TOPPER';

  static const subscriptionUpgraded = 'SUBSCRIPTION_UPGRADED';
  static const fileDownloadComplete = 'FILE_DOWNLOAD_COMPLETE';
}
