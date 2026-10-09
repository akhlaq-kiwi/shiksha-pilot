package com.shikshapilot.app

import android.net.Uri
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.content.ContentValues
import android.os.Environment
import java.io.File

class MainActivity : FlutterActivity() {
    // Named for the battery handlers it used to carry; today it only saves
    // generated PDFs (receipts, report cards, salary slips) to Downloads.
    private val CHANNEL = "com.shikshapilot.schoolhub/battery"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "saveFileToDownloads" -> {
                    val fileName = call.argument<String>("fileName")
                    val rawBytes = call.argument<Any>("bytes")
                    val bytes = when (rawBytes) {
                        is ByteArray -> rawBytes
                        is List<*> -> {
                            val byteArray = ByteArray(rawBytes.size)
                            for (i in rawBytes.indices) {
                                val item = rawBytes[i]
                                if (item is Number) {
                                    byteArray[i] = item.toByte()
                                }
                            }
                            byteArray
                        }
                        else -> null
                    }

                    if (fileName == null || bytes == null) {
                        result.error("INVALID_ARGUMENTS", "File name or bytes is null", null)
                        return@setMethodCallHandler
                    }

                    try {
                        val baseName = fileName.replace(Regex("[^a-zA-Z0-9_\\-]"), "_").replace(Regex("_+"), "_").trim('_')
                        val safeFileName = if (baseName.endsWith(".pdf", ignoreCase = true)) baseName else "${if (baseName.isEmpty()) "Question_Paper" else baseName}.pdf"

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            val resolver = contentResolver
                            try {
                                resolver.delete(
                                    android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                    "${android.provider.MediaStore.MediaColumns.DISPLAY_NAME} = ?",
                                    arrayOf(safeFileName)
                                )
                            } catch (e: Throwable) { }

                            val contentValues = ContentValues().apply {
                                put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safeFileName)
                                put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                                put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                            }

                            val downloadsUri = android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI
                            val uri = resolver.insert(downloadsUri, contentValues)
                            if (uri != null) {
                                resolver.openOutputStream(uri)?.use { os ->
                                    os.write(bytes)
                                    os.flush()
                                }
                                result.success(uri.toString())
                            } else {
                                result.error("INSERT_ERROR", "Failed to insert PDF", null)
                            }
                        } else {
                            val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            if (!downloadDir.exists()) downloadDir.mkdirs()
                            val file = File(downloadDir, safeFileName)
                            file.writeBytes(bytes)
                            android.media.MediaScannerConnection.scanFile(
                                applicationContext,
                                arrayOf(file.absolutePath),
                                arrayOf("application/pdf"),
                                null
                            )
                            result.success(file.absolutePath)
                        }
                    } catch (t: Throwable) {
                        result.error("WRITE_ERROR", t.message ?: t.toString(), null)
                    }
                }
                "openDownloadsFolder" -> {
                    try {
                        val intent = android.content.Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS)
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                        result.success(true)
                    } catch (t: Throwable) {
                        try {
                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW)
                            intent.setDataAndType(Uri.parse("content://media/external/downloads"), "*/*")
                            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                            result.success(true)
                        } catch (e: Throwable) {
                            result.error("INTENT_ERROR", t.message ?: t.toString(), null)
                        }
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
