import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:printing/printing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

class AttachmentGalleryScreen extends StatefulWidget {
  final List<dynamic> attachments;
  final int initialIndex;
  final String baseUrl;

  const AttachmentGalleryScreen({
    Key? key,
    required this.attachments,
    this.initialIndex = 0,
    required this.baseUrl,
  }) : super(key: key);

  @override
  State<AttachmentGalleryScreen> createState() => _AttachmentGalleryScreenState();
}

class _AttachmentGalleryScreenState extends State<AttachmentGalleryScreen> {
  late PageController _pageController;
  late int _currentIndex;
  final Map<int, Uint8List> _loadedImageBytes = {};
  final Map<int, bool> _loadingStates = {};
  final Map<int, String?> _errorStates = {};

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
    _loadImageForIndex(widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadImageForIndex(int index) async {
    if (index < 0 || index >= widget.attachments.length) return;
    if (_loadedImageBytes.containsKey(index) || _loadingStates[index] == true) return;

    final att = Map<String, dynamic>.from(widget.attachments[index]);
    final rawPath = att['file_path'] ?? '';
    final name = att['file_name'] ?? 'File';
    final type = att['file_type'] ?? '';
    final isPdf = type == 'pdf' || name.toLowerCase().endsWith('.pdf');
    if (isPdf) return;

    setState(() {
      _loadingStates[index] = true;
      _errorStates[index] = null;
    });

    final prefs = await SharedPreferences.getInstance();
    String activeBaseUrl = widget.baseUrl.trim();
    if (activeBaseUrl.isEmpty || !activeBaseUrl.startsWith('http')) {
      activeBaseUrl = resolveBaseUrlFrom(prefs);
    }
    final cleanBaseUrl = activeBaseUrl.replaceAll(RegExp(r'/$'), '');

    final List<String> candidateUrls = [];
    if (rawPath.startsWith('http')) {
      candidateUrls.add(rawPath);
    } else {
      final cleanRawPath = rawPath.startsWith('/') ? rawPath : '/$rawPath';
      candidateUrls.add('$cleanBaseUrl$cleanRawPath');
      if (cleanRawPath.contains('/uploads/homework/')) {
        candidateUrls.add('$cleanBaseUrl${cleanRawPath.replaceFirst('/uploads/homework/', '/uploads/')}');
      } else if (cleanRawPath.contains('/uploads/')) {
        candidateUrls.add('$cleanBaseUrl${cleanRawPath.replaceFirst('/uploads/', '/uploads/homework/')}');
      }
      if (cleanBaseUrl.startsWith('https://')) {
        final httpBaseUrl = cleanBaseUrl.replaceFirst('https://', 'http://');
        candidateUrls.add('$httpBaseUrl$cleanRawPath');
      }
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile)',
      'Accept': 'image/*,*/*',
    };

    String lastErr = 'Failed to load image';
    for (final url in candidateUrls) {
      try {
        final response = await http.get(Uri.parse(url), headers: headers);
        if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
          if (mounted) {
            setState(() {
              _loadedImageBytes[index] = response.bodyBytes;
              _loadingStates[index] = false;
            });
          }
          return;
        } else {
          lastErr = 'HTTP ${response.statusCode} on $url';
        }
      } catch (e) {
        lastErr = '$e on $url';
      }
    }

    if (mounted) {
      setState(() {
        _loadingStates[index] = false;
        _errorStates[index] = lastErr;
      });
    }
  }

  Future<void> _openPdf(String fullUrl, String filename) async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Opening PDF...'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 1),
      ),
    );

    try {
      final prefs = await SharedPreferences.getInstance();
      String activeBaseUrl = widget.baseUrl.trim();
      if (activeBaseUrl.isEmpty || !activeBaseUrl.startsWith('http')) {
        activeBaseUrl = resolveBaseUrlFrom(prefs);
      }
      final cleanBaseUrl = activeBaseUrl.replaceAll(RegExp(r'/$'), '');

      final List<String> candidateUrls = [];
      if (fullUrl.startsWith('http')) {
        candidateUrls.add(fullUrl);
      } else {
        final cleanRawPath = fullUrl.startsWith('/') ? fullUrl : '/$fullUrl';
        candidateUrls.add('$cleanBaseUrl$cleanRawPath');
        if (cleanRawPath.contains('/uploads/homework/')) {
          candidateUrls.add('$cleanBaseUrl${cleanRawPath.replaceFirst('/uploads/homework/', '/uploads/')}');
        } else if (cleanRawPath.contains('/uploads/')) {
          candidateUrls.add('$cleanBaseUrl${cleanRawPath.replaceFirst('/uploads/', '/uploads/homework/')}');
        }
      }

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile)',
        'Accept': 'application/pdf,*/*',
      };

      http.Response? response;
      for (final url in candidateUrls) {
        try {
          final res = await http.get(Uri.parse(url), headers: headers);
          if (res.statusCode == 200 && res.bodyBytes.isNotEmpty) {
            response = res;
            break;
          }
        } catch (_) {}
      }

      if (response != null && response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
        final pdfData = response.bodyBytes;
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => PdfViewerScreen(
                pdfBytes: pdfData,
                title: filename,
              ),
            ),
          );
        }
      } else {
        throw Exception('Failed to load PDF document from server');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Unable to open PDF: $e'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.attachments.isEmpty) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
        body: const Center(
          child: Text('No attachments found', style: TextStyle(color: Colors.white)),
        ),
      );
    }

    final currentAtt = Map<String, dynamic>.from(widget.attachments[_currentIndex]);
    final String currentName = currentAtt['file_name'] ?? 'Attachment';

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          currentName,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '${_currentIndex + 1} / ${widget.attachments.length}',
                style: const TextStyle(color: Colors.white70, fontSize: 14),
              ),
            ),
          ),
        ],
      ),
      body: PageView.builder(
        controller: _pageController,
        itemCount: widget.attachments.length,
        onPageChanged: (index) {
          setState(() {
            _currentIndex = index;
          });
          _loadImageForIndex(index);
        },
        itemBuilder: (context, index) {
          final att = Map<String, dynamic>.from(widget.attachments[index]);
          final rawPath = att['file_path'] ?? '';
          final name = att['file_name'] ?? 'File';
          final type = att['file_type'] ?? '';

          final cleanBaseUrl = widget.baseUrl.replaceAll(RegExp(r'/$'), '');
          final cleanRawPath = rawPath.startsWith('/') ? rawPath : '/$rawPath';
          final fullUrl = rawPath.startsWith('http') ? rawPath : '$cleanBaseUrl$cleanRawPath';
          final isPdf = type == 'pdf' || name.toLowerCase().endsWith('.pdf');

          if (isPdf) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.picture_as_pdf_rounded, size: 80, color: Colors.red.shade400),
                    const SizedBox(height: 16),
                    Text(
                      name,
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => _openPdf(fullUrl, name),
                      icon: const Icon(Icons.file_open_rounded),
                      label: const Text('Open PDF Document'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.indigo,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          final isLoading = _loadingStates[index] ?? false;
          final error = _errorStates[index];
          final bytes = _loadedImageBytes[index];

          if (isLoading) {
            return const Center(
              child: CircularProgressIndicator(color: Colors.white),
            );
          }

          if (error != null || bytes == null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.broken_image_rounded, size: 64, color: Colors.white54),
                    const SizedBox(height: 12),
                    Text(
                      'Unable to load image: $name',
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        error,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                        textAlign: TextAlign.center,
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      'URL: $fullUrl',
                      style: const TextStyle(color: Colors.white38, fontSize: 11),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: () {
                        _loadImageForIndex(index);
                      },
                      icon: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 18),
                      label: const Text('Retry', style: TextStyle(color: Colors.white70)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.white38),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return Center(
            child: InteractiveViewer(
              maxScale: 4.0,
              child: Image.memory(
                bytes,
                fit: BoxFit.contain,
              ),
            ),
          );
        },
      ),
    );
  }
}

class PdfViewerScreen extends StatelessWidget {
  final Uint8List pdfBytes;
  final String title;

  const PdfViewerScreen({
    Key? key,
    required this.pdfBytes,
    required this.title,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(
          title,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          overflow: TextOverflow.ellipsis,
        ),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: PdfPreview(
        build: (format) => pdfBytes,
        allowPrinting: true,
        allowSharing: true,
        canChangeOrientation: false,
        canChangePageFormat: false,
        maxPageWidth: 700,
        pdfFileName: title,
      ),
    );
  }
}
