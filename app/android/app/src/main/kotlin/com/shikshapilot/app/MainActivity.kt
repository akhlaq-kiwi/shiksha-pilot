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
                        val lowerName = fileName.lowercase()
                        val (ext, mimeType) = when {
                            lowerName.endsWith(".xlsx") -> Pair(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                            lowerName.endsWith(".xls") -> Pair(".xls", "application/vnd.ms-excel")
                            lowerName.endsWith(".csv") -> Pair(".csv", "text/csv")
                            lowerName.endsWith(".pdf") -> Pair(".pdf", "application/pdf")
                            lowerName.endsWith(".png") -> Pair(".png", "image/png")
                            lowerName.endsWith(".jpg") -> Pair(".jpg", "image/jpeg")
                            lowerName.endsWith(".jpeg") -> Pair(".jpeg", "image/jpeg")
                            lowerName.endsWith(".zip") -> Pair(".zip", "application/zip")
                            else -> Pair(".pdf", "application/pdf")
                        }

                        val nameWithoutExt = if (lowerName.endsWith(ext)) {
                            fileName.substring(0, fileName.length - ext.length)
                        } else {
                            fileName
                        }
                        val clean = nameWithoutExt.replace(Regex("[^a-zA-Z0-9_\\-]"), "_").replace(Regex("_+"), "_").trim('_')
                        val baseName = if (clean.isEmpty()) "Download" else clean
                        val safeFileName = "$baseName$ext"

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
                                put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mimeType)
                                put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                                put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1)
                            }

                            val downloadsUri = android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI
                            val uri = resolver.insert(downloadsUri, contentValues)
                            if (uri != null) {
                                resolver.openOutputStream(uri)?.use { os ->
                                    os.write(bytes)
                                    os.flush()
                                }
                                contentValues.clear()
                                contentValues.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0)
                                resolver.update(uri, contentValues, null, null)

                                try {
                                    val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                                    val file = File(downloadDir, safeFileName)
                                    android.media.MediaScannerConnection.scanFile(
                                        applicationContext,
                                        arrayOf(file.absolutePath),
                                        arrayOf(mimeType),
                                        null
                                    )
                                } catch (_: Throwable) { }

                                result.success(uri.toString())
                            } else {
                                result.error("INSERT_ERROR", "Failed to insert file", null)
                            }
                        } else {
                            val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            if (!downloadDir.exists()) downloadDir.mkdirs()
                            val file = File(downloadDir, safeFileName)
                            file.writeBytes(bytes)
                            android.media.MediaScannerConnection.scanFile(
                                applicationContext,
                                arrayOf(file.absolutePath),
                                arrayOf(mimeType),
                                null
                            )
                            result.success(file.absolutePath)
                        }
                    } catch (t: Throwable) {
                        result.error("WRITE_ERROR", t.message ?: t.toString(), null)
                    }
                }
                "openFile" -> {
                    val fileUriStr = call.argument<String>("fileUri")
                    val fileName = call.argument<String>("fileName")
                    try {
                        val nameToCheck = fileName ?: fileUriStr ?: ""
                        val lower = nameToCheck.lowercase()
                        val mime = when {
                            lower.endsWith(".xlsx") -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            lower.endsWith(".xls") -> "application/vnd.ms-excel"
                            lower.endsWith(".csv") -> "text/csv"
                            lower.endsWith(".pdf") -> "application/pdf"
                            lower.endsWith(".png") -> "image/png"
                            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
                            else -> "*/*"
                        }

                        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                            if (fileUriStr != null && fileUriStr.startsWith("content://")) {
                                setDataAndType(Uri.parse(fileUriStr), mime)
                            } else {
                                val targetFile = if (fileUriStr != null && fileUriStr.startsWith("/")) {
                                    File(fileUriStr)
                                } else {
                                    val downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                                    File(downloadDir, fileName ?: "file")
                                }
                                val contentUri = androidx.core.content.FileProvider.getUriForFile(
                                    this@MainActivity,
                                    "${applicationContext.packageName}.fileprovider",
                                    targetFile
                                )
                                setDataAndType(contentUri, mime)
                            }
                            addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        val chooser = android.content.Intent.createChooser(intent, "Open with")
                        chooser.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(chooser)
                        result.success(true)
                    } catch (t: Throwable) {
                        result.error("OPEN_ERROR", t.message ?: t.toString(), null)
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
                "sharePdf" -> {
                    val fileName = call.argument<String>("fileName") ?: "Fee_Receipt.pdf"
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

                    if (bytes == null) {
                        result.error("INVALID_ARGUMENTS", "File bytes is null", null)
                        return@setMethodCallHandler
                    }

                    try {
                        val shareDir = File(cacheDir, "shared_receipts")
                        if (!shareDir.exists()) shareDir.mkdirs()
                        val file = File(shareDir, fileName)
                        file.writeBytes(bytes)

                        val uri = androidx.core.content.FileProvider.getUriForFile(
                            this,
                            "${applicationContext.packageName}.fileprovider",
                            file
                        )

                        val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                            type = "application/pdf"
                            putExtra(android.content.Intent.EXTRA_STREAM, uri)
                            putExtra(android.content.Intent.EXTRA_SUBJECT, "Fee Receipt")
                            addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }

                        val chooser = android.content.Intent.createChooser(intent, "Share Receipt")
                        chooser.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(chooser)
                        result.success(true)
                    } catch (t: Throwable) {
                        result.error("SHARE_ERROR", t.message ?: t.toString(), null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}