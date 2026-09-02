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

# MobileScanner, CameraX & MLKit ProGuard / R8 Keep Rules
-keep class dev.flutter.plugins.mobile_scanner.** { *; }
-keep class androidx.camera.** { *; }
-keep class * extends androidx.camera.core.UseCase { *; }
-keep class * extends androidx.camera.core.CameraXConfig$Provider { *; }
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode_bundled.** { *; }
-dontwarn androidx.camera.**
-dontwarn com.google.mlkit.**
-dontwarn dev.flutter.plugins.mobile_scanner.**

