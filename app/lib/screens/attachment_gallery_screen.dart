import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:printing/printing.dart';

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

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
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
      final response = await http.get(Uri.parse(fullUrl));
      if (response.statusCode == 200) {
        await Printing.sharePdf(
          bytes: response.bodyBytes,
          filename: filename,
        );
      } else {
        throw Exception('Failed to load PDF');
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
        },
        itemBuilder: (context, index) {
          final att = Map<String, dynamic>.from(widget.attachments[index]);
          final rawPath = att['file_path'] ?? '';
          final name = att['file_name'] ?? 'File';
          final type = att['file_type'] ?? '';

          final fullUrl = rawPath.startsWith('http') ? rawPath : '${widget.baseUrl}$rawPath';
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

          return Center(
            child: InteractiveViewer(
              maxScale: 4.0,
              child: Image.network(
                fullUrl,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  );
                },
                errorBuilder: (context, error, stackTrace) {
                  return Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.broken_image_rounded, size: 64, color: Colors.white54),
                      const SizedBox(height: 12),
                      Text(
                        'Unable to load image: $name',
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
