import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class FullScreenImageScreen extends StatelessWidget {
  final String imageUrl;
  final String? title;
  final String? heroTag;

  const FullScreenImageScreen({
    Key? key,
    required this.imageUrl,
    this.title,
    this.heroTag,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final imageWidget = CachedNetworkImage(
      imageUrl: imageUrl,
      fit: BoxFit.contain,
      placeholder: (context, url) => const Center(
        child: CircularProgressIndicator(color: Colors.white),
      ),
      errorWidget: (context, url, error) => const Center(
        child: Icon(Icons.broken_image, size: 64, color: Colors.white70),
      ),
    );

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        title: title != null && title!.isNotEmpty
            ? Text(
                title!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              )
            : null,
      ),
      body: Center(
        child: InteractiveViewer(
          maxScale: 4.0,
          child: heroTag != null && heroTag!.isNotEmpty
              ? Hero(
                  tag: heroTag!,
                  child: imageWidget,
                )
              : imageWidget,
        ),
      ),
    );
  }
}
