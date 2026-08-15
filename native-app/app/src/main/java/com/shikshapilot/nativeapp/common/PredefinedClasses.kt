package com.shikshapilot.nativeapp.common

/**
 * Mirrors frontend/src/common/constants/predefinedClasses.js so the native app offers the same
 * fixed catalog of class names (Pre Nursery .. Class 12) instead of free-text entry.
 */
object PredefinedClasses {
    val NAMES: List<String> = listOf(
        "Pre Nursery",
        "Nursery",
        "Lower Kindergarten (LKG)",
        "Upper Kindergarten (UKG)",
        "KG",
        "Class 1",
        "Class 2",
        "Class 3",
        "Class 4",
        "Class 5",
        "Class 6",
        "Class 7",
        "Class 8",
        "Class 9",
        "Class 10",
        "Class 11",
        "Class 12"
    )
}
