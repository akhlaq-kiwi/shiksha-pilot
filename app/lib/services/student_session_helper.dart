import 'package:shared_preferences/shared_preferences.dart';

/// Resolves and persists the active student profile selection across
/// logins, profile switches, academic year states, and app restarts.
class StudentSessionHelper {
  static const String prefSelectedStudentId = 'selected_student_id';
  static const String prefSelectedStudentName = 'selected_student_name';
  static const String prefSelectedStudentAdmissionNo = 'selected_student_admission_no';

  /// Safely parses a student/child ID whether the backend JSON returns
  /// an `int`, `num`, or numeric `String` (e.g. PDO stringified fetches).
  static int? parseId(dynamic raw) {
    if (raw == null) return null;
    if (raw is int) return raw > 0 ? raw : null;
    if (raw is num) {
      final v = raw.toInt();
      return v > 0 ? v : null;
    }
    final parsed = int.tryParse(raw.toString().trim());
    return (parsed != null && parsed > 0) ? parsed : null;
  }

  /// Reads the saved student ID safely even if stored under `int` or `String`.
  static int? readSavedStudentId(SharedPreferences prefs) {
    return parseId(prefs.get(prefSelectedStudentId));
  }

  /// Finds the child entry whose ID equals [targetId], or returns `null`.
  static Map<String, dynamic>? findChildById(
    List<dynamic> children,
    int? targetId,
  ) {
    if (targetId == null || children.isEmpty) return null;
    for (final raw in children) {
      if (raw is Map && parseId(raw['id']) == targetId) {
        return Map<String, dynamic>.from(raw);
      }
    }
    return null;
  }

  /// Returns `true` when [child] belongs to an active/current academic year
  /// or has no academic year restriction.
  static bool isCurrentAcademicYear(dynamic child) {
    if (child is! Map) return false;
    final flag = child['is_current_academic_year'];
    if (flag == 1 || flag == true || flag == '1') {
      return true;
    }
    final ayStatus = (child['academic_year_status'] ?? '')
        .toString()
        .trim()
        .toUpperCase();
    if (ayStatus == 'ACTIVE') {
      return true;
    }
    return false;
  }

  /// Resolves which child profile should be active on launch/reload.
  ///
  /// Priority:
  /// 1. Exact [preferredStudentId] present in [children] (any academic year status,
  ///    since `/api/parent/children` already deduplicates per child prioritizing
  ///    active years — never reset a valid switched sibling back to `children[0]`).
  /// 2. If [preferredStudentId] is no longer present (for instance after academic
  ///    year promotion created a new `students.id`), match the same child by
  ///    [savedAdmissionNo] or exact unique [savedName].
  /// 3. Fallback only when no saved selection exists / matches: first child marked
  ///    as current academic year, or `children.first`.
  static Map<String, dynamic>? resolveActiveChild(
    List<dynamic> children, {
    int? preferredStudentId,
    String? savedAdmissionNo,
    String? savedName,
  }) {
    if (children.isEmpty) return null;

    if (preferredStudentId != null) {
      Map<String, dynamic>? idMatch;
      for (final raw in children) {
        if (raw is! Map) continue;
        if (parseId(raw['id']) == preferredStudentId) {
          final candidate = Map<String, dynamic>.from(raw);
          if (isCurrentAcademicYear(candidate)) {
            return candidate;
          }
          idMatch ??= candidate;
        }
      }
      if (idMatch != null) {
        return idMatch;
      }
    }

    final admClean = (savedAdmissionNo ?? '').trim().toLowerCase();
    if (admClean.isNotEmpty) {
      for (final raw in children) {
        if (raw is! Map) continue;
        final childAdm = (raw['admission_no'] ?? '').toString().trim().toLowerCase();
        if (childAdm.isNotEmpty && childAdm == admClean) {
          return Map<String, dynamic>.from(raw);
        }
      }
    }

    final nameClean = (savedName ?? '').trim().toLowerCase();
    if (nameClean.isNotEmpty && preferredStudentId != null) {
      final nameMatches = <Map<String, dynamic>>[];
      for (final raw in children) {
        if (raw is! Map) continue;
        final childName = (raw['name'] ?? '').toString().trim().toLowerCase();
        if (childName == nameClean) {
          nameMatches.add(Map<String, dynamic>.from(raw));
        }
      }
      if (nameMatches.length == 1) {
        return nameMatches.first;
      }
    }

    for (final raw in children) {
      if (raw is Map && isCurrentAcademicYear(raw)) {
        return Map<String, dynamic>.from(raw);
      }
    }

    final first = children.first;
    return first is Map ? Map<String, dynamic>.from(first) : null;
  }

  /// Persists the selected child's ID, name, admission number, and avatar photo.
  static Future<void> persistSelectedChild(
    SharedPreferences prefs,
    Map<String, dynamic> child,
  ) async {
    final childId = parseId(child['id']);
    if (childId == null) return;

    final name = (child['name'] ?? '').toString().trim();
    final admNo = (child['admission_no'] ?? '').toString().trim();
    final photo = (child['photo_path'] ?? child['photo'] ?? '').toString().trim();

    await prefs.setInt(prefSelectedStudentId, childId);
    await prefs.setString(prefSelectedStudentName, name);
    await prefs.setString(prefSelectedStudentAdmissionNo, admNo);
    if (name.isNotEmpty) {
      await prefs.setString('user_name', name);
    }
    await prefs.setString('user_photo', photo);
  }
}

