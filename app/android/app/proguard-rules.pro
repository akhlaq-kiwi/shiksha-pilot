# Flutter & WorkManager Proguard Rules

# Don't warn for missing Play Core split install classes in Flutter
-dontwarn com.google.android.play.core.**
-dontwarn io.flutter.embedding.engine.deferredcomponents.**

# Keep WorkManager implementation & database classes
-keep class androidx.work.** { *; }
-keep class * extends androidx.work.impl.WorkDatabase { *; }
-keep class androidx.work.impl.WorkDatabase_Impl {
    public <init>();
}

# Keep Flutter embedding & plugins
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.provider.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class com.shikshapilot.app.** { *; }
