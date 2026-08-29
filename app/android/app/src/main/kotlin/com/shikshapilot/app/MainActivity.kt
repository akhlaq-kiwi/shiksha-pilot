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
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            val resolver = contentResolver
                            val contentValues = ContentValues().apply {
                                put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                                put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
                                put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                            }

                            val downloadsUri = Uri.parse("content://media/external/downloads")
                            val uri = resolver.insert(downloadsUri, contentValues)
                            if (uri != null) {
                                resolver.openOutputStream(uri)?.use { outputStream ->
                                    outputStream.write(bytes)
                                }
                                result.success(uri.toString())
                            } else {
                                result.error("INSERT_ERROR", "Failed to insert entry in downloads", null)
                            }
                        } else {
                            val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            val file = File(downloadDir, fileName)
                            file.writeBytes(bytes)
                            result.success(file.absolutePath)
                        }
                    } catch (t: Throwable) {
                        result.error("WRITE_ERROR", t.message ?: t.toString(), null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
