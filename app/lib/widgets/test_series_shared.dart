import 'dart:convert';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/test_series_service.dart';
import 'profile_avatar_view.dart';

class TsColors {
  TsColors._();

  // Warm Ivory & Charcoal Slate palette — matched directly with TimetableScreen
  static const Color canvas = Color(0xFFF9F6EE);
  static const Color cardIvory = Color(0xFFFFFDF7);
  static const Color ink = Color(0xFF1E293B);
  static const Color inkSecondary = Color(0xFF475569);
  static const Color inkMuted = Color(0xFF64748B);
  static const Color border = Color(0xFFE2E8F0);
  static const Color accent = Color(0xFFC26600);
  static const Color accentBright = Color(0xFFD97706);
  static const Color accentSoft = Color(0xFFFEF3C7);
  static const Color accentBorder = Color(0xFFFDE68A);
  static const Color success = Color(0xFF16A34A);

  static const Color darkBorder = Color(0xFF334155);
  static const Color darkSurfaceElevated = Color(0xFF283548);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color emerald900 = Color(0xFF064E3B);
  static const Color rose900 = Color(0xFF881337);
  static const Color amber100 = Color(0xFFFEF3C7);
  static const Color amber300 = Color(0xFFFCD34D);
  static const Color amber400 = Color(0xFFFBBF24);
  static const Color amber800 = Color(0xFF92400E);
  static const Color amber900 = Color(0xFF78350F);
}

const List<String> _kMonths = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

String _two(int n) => n.toString().padLeft(2, '0');

String formatTime12h(DateTime dt) {
  final h24 = dt.hour;
  final period = h24 >= 12 ? 'PM' : 'AM';
  final h12 = h24 % 12 == 0 ? 12 : h24 % 12;
  return '${_two(h12)}:${_two(dt.minute)} $period';
}

String formatSqlDateTime(DateTime dt) {
  return '${dt.year}-${_two(dt.month)}-${_two(dt.day)} ${_two(dt.hour)}:${_two(dt.minute)}:${_two(dt.second)}';
}

String formatDisplayDateMultiline(DateTime dt) {
  final m = _kMonths[(dt.month - 1).clamp(0, 11)];
  return '${_two(dt.day)} $m ${dt.year}\n${formatTime12h(dt)}';
}

String formatDateSingleLine(DateTime dt) {
  final m = _kMonths[(dt.month - 1).clamp(0, 11)];
  return '${_two(dt.day)} $m ${dt.year}, ${formatTime12h(dt)}';
}

String formatShortDateFromDateTime(DateTime dt) {
  final m = _kMonths[(dt.month - 1).clamp(0, 11)];
  return '${_two(dt.day)} $m, ${formatTime12h(dt)}';
}

String formatTestDateTime(String? raw) {
  if (raw == null || raw.trim().isEmpty) return '';
  final dt = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
  if (dt == null) return raw;
  final m = _kMonths[(dt.month - 1).clamp(0, 11)];
  return '${_two(dt.day)} $m ${dt.year}, ${formatTime12h(dt)}';
}

String formatShortDateTime(String? raw) {
  if (raw == null || raw.trim().isEmpty) return '';
  final dt = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
  if (dt == null) return raw;
  return formatShortDateFromDateTime(dt);
}

String formatCountdown(int totalSeconds) {
  if (totalSeconds <= 0) return '0s';
  final days = totalSeconds ~/ 86400;
  final hours = (totalSeconds % 86400) ~/ 3600;
  final mins = (totalSeconds % 3600) ~/ 60;
  final secs = totalSeconds % 60;
  if (days > 0) return '${days}d ${hours}h';
  if (hours > 0) return '${hours}h ${mins}m';
  if (mins > 0) return '${mins}m ${secs.toString().padLeft(2, '0')}s';
  return '${secs}s';
}

String formatDurationSeconds(int seconds) {
  if (seconds <= 0) return '0s';
  final mins = seconds ~/ 60;
  final secs = seconds % 60;
  if (mins >= 60) {
    final hrs = mins ~/ 60;
    final remM = mins % 60;
    return '${hrs}h ${remM}m ${secs}s';
  }
  if (mins > 0) return '${mins}m ${secs}s';
  return '${secs}s';
}

String formatTimerClock(int totalSeconds) {
  final safe = totalSeconds < 0 ? 0 : totalSeconds;
  final hrs = safe ~/ 3600;
  final mins = (safe % 3600) ~/ 60;
  final secs = safe % 60;
  if (hrs > 0) {
    return '${_two(hrs)}:${_two(mins)}:${_two(secs)}';
  }
  return '${_two(mins)}:${_two(secs)}';
}

String formatMarks(num value) {
  final d = (value.toDouble() * 100).round() / 100;
  if ((d - d.roundToDouble()).abs() < 0.001) {
    return d.round().toString();
  }
  final s = d.toStringAsFixed(2);
  if (s.endsWith('0')) {
    return s.substring(0, s.length - 1);
  }
  return s;
}

String studentInitials(String name) {
  final parts =
      name.trim().split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
  if (parts.isEmpty) return 'ST';
  if (parts.length == 1) {
    return parts.first
        .substring(0, parts.first.length >= 2 ? 2 : 1)
        .toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}

void showTestSeriesImageZoom(BuildContext context, String imageUrl,
    {String? caption}) {
  if (imageUrl.trim().isEmpty) return;
  showDialog(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.92),
    builder: (ctx) {
      return Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 4.5,
                      child: CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.contain,
                        placeholder: (_, __) => const SizedBox(
                          height: 180,
                          width: 180,
                          child: Center(
                            child:
                                CircularProgressIndicator(color: Colors.white),
                          ),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          padding: const EdgeInsets.all(24),
                          color: Colors.black54,
                          child: const Icon(Icons.broken_image_rounded,
                              color: Colors.white54, size: 54),
                        ),
                      ),
                    ),
                  ),
                ),
                if (caption != null && caption.trim().isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black87,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      caption,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ],
            ),
            Positioned(
              top: 4,
              right: 4,
              child: Material(
                color: Colors.black54,
                shape: const CircleBorder(),
                child: IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}

class StudentAvatarCircle extends StatelessWidget {
  final String? photoUrl;
  final String name;
  final double radius;
  final Color borderColor;
  final double borderWidth;
  final bool enableZoom;
  final String? heroTag;
  final String? baseUrl;
  final VoidCallback? onTap;

  const StudentAvatarCircle({
    super.key,
    required this.photoUrl,
    required this.name,
    this.radius = 24,
    this.borderColor = TsColors.accent,
    this.borderWidth = 2,
    this.enableZoom = true,
    this.heroTag,
    this.baseUrl,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ProfileAvatarView(
      photoUrl: photoUrl ?? '',
      baseUrl: baseUrl,
      name: name,
      size: radius * 2,
      entityType: 'student',
      borderColor: borderColor,
      borderWidth: borderWidth,
      fallbackColor: TsColors.accent,
      fallbackBgColor: TsColors.accentSoft,
      enableZoom: enableZoom,
      heroTag: heroTag,
      onTap: onTap,
    );
  }
}

class TestSeriesClassBadges extends StatelessWidget {
  final String classLabel;
  final String? sectionLabel;
  final bool isDark;

  const TestSeriesClassBadges({
    super.key,
    required this.classLabel,
    this.sectionLabel,
    required this.isDark,
  });

  static ({String className, String sectionName}) parse(
    String rawClass,
    String? rawSection,
  ) {
    final trimmedClass = rawClass.trim();
    final trimmedSec = (rawSection ?? '').trim();
    if (trimmedSec.isNotEmpty) {
      final prefix = ' - $trimmedSec';
      if (trimmedClass.endsWith(prefix)) {
        return (
          className: trimmedClass
              .substring(0, trimmedClass.length - prefix.length)
              .trim(),
          sectionName: trimmedSec,
        );
      }
      return (className: trimmedClass, sectionName: trimmedSec);
    }

    final idx = trimmedClass.lastIndexOf(' - ');
    if (idx > 0 && idx + 3 < trimmedClass.length) {
      return (
        className: trimmedClass.substring(0, idx).trim(),
        sectionName: trimmedClass.substring(idx + 3).trim(),
      );
    }
    return (className: trimmedClass, sectionName: '');
  }

  @override
  Widget build(BuildContext context) {
    final parsed = parse(classLabel, sectionLabel);
    if (parsed.className.isEmpty) return const SizedBox.shrink();

    final secRaw = parsed.sectionName;
    final secDisplay = secRaw.isEmpty
        ? ''
        : (secRaw.toLowerCase().startsWith('sec')
            ? secRaw
            : 'Section $secRaw');

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2.5),
          decoration: BoxDecoration(
            color: isDark
                ? TsColors.amber900.withValues(alpha: 0.45)
                : TsColors.accentSoft,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? TsColors.amber800 : TsColors.accentBorder,
              width: 1.1,
            ),
          ),
          child: Text(
            parsed.className,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              color: isDark ? TsColors.amber300 : TsColors.amber800,
              letterSpacing: 0.2,
            ),
          ),
        ),
        if (secDisplay.isNotEmpty) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2.5),
            decoration: BoxDecoration(
              color: isDark ? TsColors.darkSurfaceElevated : TsColors.ink,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark ? TsColors.darkBorder : TsColors.ink,
                width: 1.1,
              ),
            ),
            child: Text(
              secDisplay,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class TestSeriesDraftStore {
  TestSeriesDraftStore._();

  static Future<String> _keyForClass(int classId) async {
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getInt('user_id') ?? 0;
    final phone = (prefs.getString('user_phone') ?? '').trim();
    final identity = phone.isNotEmpty ? phone : 'u$uid';
    return 'ts_drafts_v2_${identity}_c$classId';
  }

  static Future<String> _legacyKeyForClass(int classId) async {
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getInt('user_id') ?? 0;
    final phone = (prefs.getString('user_phone') ?? '').trim();
    final identity = phone.isNotEmpty ? phone : 'u$uid';
    return 'ts_draft_v1_${identity}_c$classId';
  }

  /// Loads all drafts for this teacher and class, migrating any legacy v1 draft if found,
  /// and synchronizing with cloud-saved drafts.
  static Future<List<Map<String, dynamic>>> loadDrafts(int classId, {bool syncRemote = true}) async {
    if (classId <= 0) return [];
    final prefs = await SharedPreferences.getInstance();
    final key = await _keyForClass(classId);
    final raw = prefs.getString(key);
    List<Map<String, dynamic>> drafts = [];
    if (raw != null && raw.trim().isNotEmpty) {
      try {
        final decoded = json.decode(raw);
        if (decoded is List) {
          drafts = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      } catch (_) {}
    }

    // Check if legacy draft exists and migrate it seamlessly
    final legacyKey = await _legacyKeyForClass(classId);
    final legacyRaw = prefs.getString(legacyKey);
    if (legacyRaw != null && legacyRaw.trim().isNotEmpty) {
      try {
        final legacyDecoded = json.decode(legacyRaw);
        if (legacyDecoded is Map) {
          final legacyMap = Map<String, dynamic>.from(legacyDecoded);
          legacyMap['id'] ??= 'draft_${DateTime.now().millisecondsSinceEpoch}';
          drafts.insert(0, legacyMap);
          await prefs.remove(legacyKey);
          await prefs.setString(key, json.encode(drafts));
        }
      } catch (_) {}
    }

    // Cloud sync: fetch remote drafts from server
    if (syncRemote) {
      try {
        final service = await TestSeriesService.create();
        if (service.token.isNotEmpty) {
          final remoteList = await service.fetchTeacherDrafts(classId: classId);
          if (remoteList.isNotEmpty) {
            final draftMap = <String, Map<String, dynamic>>{};
            for (final d in drafts) {
              final did = d['id']?.toString() ?? '';
              if (did.isNotEmpty) draftMap[did] = d;
            }
            for (final rd in remoteList) {
              final did = rd['id']?.toString() ?? '';
              if (did.isNotEmpty) {
                draftMap[did] = rd;
              }
            }
            drafts = draftMap.values.toList();
            drafts.sort((a, b) {
              final sa = (a['saved_at'] ?? a['updated_at'] ?? '').toString();
              final sb = (b['saved_at'] ?? b['updated_at'] ?? '').toString();
              return sb.compareTo(sa);
            });
            await prefs.setString(key, json.encode(drafts));
          }
        }
      } catch (_) {}
    }

    return drafts;
  }

  static Future<int> getDraftCount(int classId) async {
    final list = await loadDrafts(classId, syncRemote: false);
    return list.length;
  }

  static Future<bool> hasDraft(int classId) async {
    final count = await getDraftCount(classId);
    return count > 0;
  }

  static Future<Map<String, dynamic>?> loadDraftById(int classId, String draftId) async {
    final list = await loadDrafts(classId, syncRemote: false);
    for (final d in list) {
      if (d['id']?.toString() == draftId) return d;
    }
    return null;
  }

  /// Backward-compatible single draft loader (returns first draft if any)
  static Future<Map<String, dynamic>?> loadDraft(int classId) async {
    final list = await loadDrafts(classId);
    return list.isNotEmpty ? list.first : null;
  }

  /// Saves or updates a draft in the teacher's personal draft list.
  /// Returns the assigned draftId.
  static Future<String> saveDraft(int classId, Map<String, dynamic> data, {String? draftId}) async {
    if (classId <= 0) return '';
    final drafts = await loadDrafts(classId, syncRemote: false);
    final effectiveId = (draftId != null && draftId.isNotEmpty)
        ? draftId
        : (data['id']?.toString() ?? 'draft_${DateTime.now().millisecondsSinceEpoch}');

    final updatedData = Map<String, dynamic>.from(data);
    updatedData['id'] = effectiveId;
    updatedData['class_id'] = classId;
    updatedData['saved_at'] = DateTime.now().toIso8601String();

    final existingIndex = drafts.indexWhere((d) => d['id']?.toString() == effectiveId);
    if (existingIndex >= 0) {
      drafts[existingIndex] = updatedData;
    } else {
      drafts.insert(0, updatedData);
    }

    final prefs = await SharedPreferences.getInstance();
    final key = await _keyForClass(classId);
    await prefs.setString(key, json.encode(drafts));

    // Asynchronously push to server
    try {
      final service = await TestSeriesService.create();
      if (service.token.isNotEmpty) {
        service.saveTeacherDraft(updatedData).ignore();
      }
    } catch (_) {}

    return effectiveId;
  }

  static Future<void> deleteDraft(int classId, String draftId) async {
    if (classId <= 0 || draftId.isEmpty) return;
    final drafts = await loadDrafts(classId, syncRemote: false);
    drafts.removeWhere((d) => d['id']?.toString() == draftId);
    final prefs = await SharedPreferences.getInstance();
    final key = await _keyForClass(classId);
    await prefs.setString(key, json.encode(drafts));

    // Asynchronously delete on server
    try {
      final service = await TestSeriesService.create();
      if (service.token.isNotEmpty) {
        service.deleteTeacherDraft(draftId).ignore();
      }
    } catch (_) {}
  }

  /// Backward-compatible clearDraft: clears first draft or all
  static Future<void> clearDraft(int classId) async {
    if (classId <= 0) return;
    final prefs = await SharedPreferences.getInstance();
    final legacyKey = await _legacyKeyForClass(classId);
    await prefs.remove(legacyKey);
    final drafts = await loadDrafts(classId);
    if (drafts.isNotEmpty) {
      drafts.removeAt(0);
      final key = await _keyForClass(classId);
      await prefs.setString(key, json.encode(drafts));
    }
  }

  static Future<void> clearAllDrafts(int classId) async {
    if (classId <= 0) return;
    final prefs = await SharedPreferences.getInstance();
    final key = await _keyForClass(classId);
    final legacyKey = await _legacyKeyForClass(classId);
    await prefs.remove(key);
    await prefs.remove(legacyKey);
  }
}
