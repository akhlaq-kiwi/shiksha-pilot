import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:school_hub/config.dart';
import 'package:school_hub/screens/full_screen_image_screen.dart';

/// Reusable profile avatar with consistent circular border highlight,
/// fullscreen zoom badge, and tap-to-expand preview functionality.
class ProfileAvatarView extends StatelessWidget {
  final String photoUrl;
  final String? baseUrl;
  final String name;
  final double size;
  final String? heroTag;
  final String entityType; // 'student' | 'teacher' | 'staff'
  final Color? fallbackColor;
  final Color? fallbackBgColor;
  final Color? borderColor;
  final double borderWidth;
  final bool singleInitial;
  final bool enableZoom;
  final VoidCallback? onTap;

  const ProfileAvatarView({
    super.key,
    required this.photoUrl,
    this.baseUrl,
    required this.name,
    this.size = 44,
    this.heroTag,
    this.entityType = 'student',
    this.fallbackColor,
    this.fallbackBgColor,
    this.borderColor,
    this.borderWidth = 1.5,
    this.singleInitial = false,
    this.enableZoom = true,
    this.onTap,
  });

  /// Helper to safely resolve full image URLs from relative or raw paths.
  static String cleanUrl(String raw, [String? baseUrl]) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty ||
        trimmed == 'null' ||
        trimmed == '—' ||
        trimmed == 'undefined') {
      return '';
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final effectiveBase = (baseUrl != null && baseUrl.isNotEmpty)
        ? baseUrl
        : kEnvBaseUrl;
    final cleanBase = effectiveBase.replaceAll(RegExp(r'/+$'), '');
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$cleanBase$cleanPath';
  }

  String _getInitials() {
    final clean = name.trim();
    if (clean.isEmpty) {
      return (entityType == 'teacher' || entityType == 'staff') ? 'T' : 'S';
    }
    if (singleInitial) {
      return clean[0].toUpperCase();
    }
    final parts = clean.split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
    if (parts.length == 1) {
      return parts[0][0].toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = cleanUrl(photoUrl, baseUrl);
    final initials = _getInitials();
    final effectiveHeroTag = heroTag ??
        'avatar_${entityType}_${name}_${resolvedUrl.isNotEmpty ? resolvedUrl.hashCode : hashCode}';

    final effectiveFallbackColor = fallbackColor ??
        (entityType == 'student'
            ? const Color(0xFFD97706)
            : const Color(0xFF0F766E));

    final effectiveBgColor = fallbackBgColor ?? const Color(0xFFF1F5F9);
    final effectiveBorderColor = borderColor ?? const Color(0xFFCBD5E1);

    final fontSize = (size * (initials.length > 1 ? 0.36 : 0.42)).clamp(11.0, 32.0);
    final textStyle = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      color: effectiveFallbackColor,
    );

    final zoomIconSize = (size * 0.20).clamp(11.0, 16.0);
    final zoomPadding = (size * 0.05).clamp(2.5, 5.0);

    return GestureDetector(
      onTap: () {
        if (onTap != null) {
          onTap!();
          return;
        }
        if (!enableZoom) return;

        if (resolvedUrl.isNotEmpty) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => FullScreenImageScreen(
                imageUrl: resolvedUrl,
                title: name,
                heroTag: effectiveHeroTag,
              ),
            ),
          );
        } else {
          final isStaff = entityType == 'teacher' || entityType == 'staff';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isStaff
                    ? 'No profile photo uploaded for this teacher.'
                    : 'No profile photo uploaded for this student.',
              ),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      },
      child: Stack(
        alignment: Alignment.bottomRight,
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: effectiveBgColor,
              border: Border.all(
                color: effectiveBorderColor,
                width: borderWidth,
              ),
            ),
            child: ClipOval(
              child: resolvedUrl.isNotEmpty
                  ? Hero(
                      tag: effectiveHeroTag,
                      child: CachedNetworkImage(
                        imageUrl: resolvedUrl,
                        width: size,
                        height: size,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Center(
                          child: Text(initials, style: textStyle),
                        ),
                        errorWidget: (context, url, error) => Center(
                          child: Text(initials, style: textStyle),
                        ),
                      ),
                    )
                  : Center(
                      child: Text(initials, style: textStyle),
                    ),
            ),
          ),
          if (resolvedUrl.isNotEmpty && enableZoom)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                padding: EdgeInsets.all(zoomPadding),
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 3,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.fullscreen_rounded,
                  size: zoomIconSize,
                  color: const Color(0xFF475569),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

