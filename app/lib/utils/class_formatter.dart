/// Utility helper to format class names consistently across the mobile app.
/// Classes before Class 1 like "Lower Kindergarten (LKG)", "Upper Kindergarten (UKG)", 
/// "Pre-Nursery (P-NUR)" etc. are converted to their short name e.g. "LKG", "UKG", "NUR", "PG".
String formatShortClassName(String? rawName, {String? section}) {
  if (rawName == null || rawName.trim().isEmpty) return '';

  String name = rawName.trim();

  // 1. If name contains parenthesis with short code, e.g. "Lower Kindergarten (LKG)" -> "LKG"
  final match = RegExp(r'\(([^)]+)\)').firstMatch(name);
  if (match != null && match.group(1) != null) {
    final insideParen = match.group(1)!.trim();
    if (insideParen.length <= 8) {
      name = insideParen;
    }
  }

  // 2. Normalize common long pre-primary names if parentheses weren't present or name is still long
  final lower = name.toLowerCase();
  if (lower.contains('lower kindergarten') || lower.contains('lower kg')) {
    name = 'LKG';
  } else if (lower.contains('upper kindergarten') || lower.contains('upper kg')) {
    name = 'UKG';
  } else if (lower.contains('pre-nursery') || lower.contains('pre nursery')) {
    name = 'Pre-NUR';
  } else if (lower.contains('kindergarten')) {
    name = 'KG';
  } else if (lower.contains('play group') || lower.contains('playgroup')) {
    name = 'PG';
  }

  // 3. Format section cleanly if passed
  final secStr = section?.trim() ?? '';
  if (secStr.isNotEmpty) {
    if (!name.endsWith('-$secStr') && !name.endsWith(' $secStr')) {
      return '$name-$secStr';
    }
  }

  return name;
}

/// Returns a numeric sort rank for a class name so classes can be ordered ascending:
/// PG (1) -> Pre-NUR (2) -> NUR (3) -> LKG (4) -> UKG (5) -> KG (6) -> 1st/Class 1 (11) -> Class 2 (12) ... Class 12 (22)
int getClassSortRank(String? rawName) {
  if (rawName == null || rawName.trim().isEmpty) return 999;
  final lower = rawName.toLowerCase().trim();

  if (lower.contains('play group') || lower.contains('playgroup') || lower == 'pg') {
    return 1;
  }
  if (lower.contains('pre-nursery') || lower.contains('pre nursery') || lower.contains('p-nur')) {
    return 2;
  }
  if (lower.contains('nursery') || lower == 'nur') {
    return 3;
  }
  if (lower.contains('lower kindergarten') || lower.contains('lower kg') || lower == 'lkg') {
    return 4;
  }
  if (lower.contains('upper kindergarten') || lower.contains('upper kg') || lower == 'ukg') {
    return 5;
  }
  if (lower.contains('kindergarten') || lower == 'kg') {
    return 6;
  }

  // Check for numeric digits e.g. "Class 1", "1st", "1", "10th", "Class 12"
  final numMatch = RegExp(r'\d+').firstMatch(lower);
  if (numMatch != null) {
    final val = int.tryParse(numMatch.group(0)!);
    if (val != null) {
      return 10 + val; // e.g. Class 1 -> 11, Class 12 -> 22
    }
  }

  return 100; // Fallback for unmatched class names
}

/// Comparator to sort dynamic class items (maps or objects) in ascending class order (small class to big class)
int compareClassItems(dynamic a, dynamic b) {
  final nameA = (a is Map ? (a['full_class_name'] ?? a['name'] ?? a['class_name'] ?? '') : a).toString();
  final nameB = (b is Map ? (b['full_class_name'] ?? b['name'] ?? b['class_name'] ?? '') : b).toString();

  final rankA = getClassSortRank(nameA);
  final rankB = getClassSortRank(nameB);

  if (rankA != rankB) {
    return rankA.compareTo(rankB);
  }

  // If ranks are equal, compare section or full name alphabetically
  final secA = (a is Map ? (a['section'] ?? a['class_section'] ?? '') : '').toString();
  final secB = (b is Map ? (b['section'] ?? b['class_section'] ?? '') : '').toString();

  if (secA.isNotEmpty && secB.isNotEmpty && secA != secB) {
    return secA.compareTo(secB);
  }

  return nameA.compareTo(nameB);
}

/// Helper to sort a list of classes in place in ascending order (small class to big class)
List<T> sortClassesAscending<T>(List<T> classesList) {
  classesList.sort((a, b) => compareClassItems(a, b));
  return classesList;
}
