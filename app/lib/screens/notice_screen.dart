import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:school_hub/services/http_service.dart' as http;

class NoticeScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final String userRole;
  final int? studentId;
  final bool isEmbedded;

  const NoticeScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    required this.userRole,
    this.studentId,
    this.isEmbedded = false,
  });

  @override
  State<NoticeScreen> createState() => _NoticeScreenState();
}

class _NoticeScreenState extends State<NoticeScreen> with SingleTickerProviderStateMixin {
  // Theme palette matching Teachers Attendance Report (TAR)
  static const Color _kCanvasBg = Color(0xFFFBF8F2);
  static const Color _kTealPrimary = Color(0xFF0F766E);
  static const Color _kTealLight = Color(0xFFF0FDFA);
  static const Color _kTealBorder = Color(0xFFCCFBF1);
  static const Color _kDarkSlate = Color(0xFF0F172A);
  static const Color _kMutedSlate = Color(0xFF475569);
  static const Color _kSubtleSlate = Color(0xFF94A3B8);
  static const Color _kBorderSlate = Color(0xFFE2E8F0);
  static const Color _kCardBg = Colors.white;

  List<dynamic> _allNotices = [];
  List<dynamic> _filteredNotices = [];
  bool _isLoading = true;
  String _errorText = '';
  final TextEditingController _searchController = TextEditingController();

  // Role detection
  bool _isPrincipal = false;

  // Audio Playback State
  final AudioPlayer _audioPlayer = AudioPlayer();
  int? _currentlyPlayingNoticeId;
  PlayerState _playerState = PlayerState.stopped;
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;
  StreamSubscription<PlayerState>? _playerStateSub;
  StreamSubscription<Duration>? _playerPositionSub;
  StreamSubscription<Duration>? _playerDurationSub;
  StreamSubscription<void>? _playerCompleteSub;

  // Voice Recording State (WhatsApp Hold-to-Record)
  final AudioRecorder _audioRecorder = AudioRecorder();
  bool _isRecording = false;
  int _recordDurationSeconds = 0;
  Timer? _recordTimer;
  final ScrollController _scrollController = ScrollController();
  String? _currentRecordingPath;

  @override
  void initState() {
    super.initState();
    _checkPrincipalRole();
    _fetchNotices();
    _searchController.addListener(_filterNotices);
    _initAudioPlayerListeners();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _recordTimer?.cancel();
    _playerStateSub?.cancel();
    _playerPositionSub?.cancel();
    _playerDurationSub?.cancel();
    _playerCompleteSub?.cancel();
    _audioPlayer.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<void> _checkPrincipalRole() async {
    final prefs = await SharedPreferences.getInstance();
    final roleUpper = widget.userRole.toUpperCase();
    final isPrinc = (roleUpper == 'PRINCIPAL' || (prefs.getBool('is_principal') == true));
    if (mounted) {
      setState(() {
        _isPrincipal = isPrinc;
      });
    }
  }

  void _initAudioPlayerListeners() {
    _playerStateSub = _audioPlayer.onPlayerStateChanged.listen((state) {
      if (mounted) {
        setState(() {
          _playerState = state;
          if (state == PlayerState.stopped || state == PlayerState.completed) {
            _currentlyPlayingNoticeId = null;
            _audioPosition = Duration.zero;
          }
        });
      }
    });

    _playerPositionSub = _audioPlayer.onPositionChanged.listen((pos) {
      if (mounted) {
        setState(() {
          _audioPosition = pos;
        });
      }
    });

    _playerDurationSub = _audioPlayer.onDurationChanged.listen((dur) {
      if (mounted) {
        setState(() {
          _audioDuration = dur;
        });
      }
    });

    _playerCompleteSub = _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _currentlyPlayingNoticeId = null;
          _playerState = PlayerState.completed;
          _audioPosition = Duration.zero;
        });
      }
    });
  }

  int _compareNoticesChronologically(dynamic a, dynamic b) {
    final aStr = (a['created_at'] ?? '').toString();
    final bStr = (b['created_at'] ?? '').toString();
    final aDate = DateTime.tryParse(aStr);
    final bDate = DateTime.tryParse(bStr);
    if (aDate != null && bDate != null) {
      final cmp = aDate.compareTo(bDate);
      if (cmp != 0) return cmp;
    }
    final aId = (a['id'] as num?)?.toInt() ?? 0;
    final bId = (b['id'] as num?)?.toInt() ?? 0;
    return aId.compareTo(bId);
  }

  void _scrollToBottom({bool animated = false}) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        if (animated) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        } else {
          _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        }
      }
      Future.delayed(const Duration(milliseconds: 60), () {
        if (mounted && _scrollController.hasClients) {
          if (animated) {
            _scrollController.animateTo(
              _scrollController.position.maxScrollExtent,
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOut,
            );
          } else {
            _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
          }
        }
      });
    });
  }

  Future<void> _fetchNotices() async {
    setState(() {
      _isLoading = true;
      _errorText = '';
    });

    try {
      final uri = Uri.parse('${widget.baseUrl}/api/student/announcements');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
        if (widget.userRole.toUpperCase() == 'PARENT' && widget.studentId != null)
          'X-Student-Id': widget.studentId.toString(),
      };

      final response = await http.get(uri, headers: headers);
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final List<dynamic> data = decoded['data'] ?? [];
        data.sort(_compareNoticesChronologically);
        if (mounted) {
          setState(() {
            _allNotices = data;
            _filteredNotices = data;
            _isLoading = false;
          });
          _scrollToBottom();
        }
      } else {
        if (mounted) {
          setState(() {
            _errorText = 'Unable to load announcements.\nPlease check your internet connection.';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorText = 'Unable to load announcements.\nPlease check your internet connection.';
          _isLoading = false;
        });
      }
    }
  }

  void _filterNotices() {
    final query = _searchController.text.toLowerCase().trim();
    if (query.isEmpty) {
      setState(() {
        _filteredNotices = _allNotices;
      });
      _scrollToBottom();
      return;
    }

    setState(() {
      _filteredNotices = _allNotices.where((notice) {
        final subject = (notice['subject'] ?? '').toString().toLowerCase();
        final description = (notice['description'] ?? '').toString().toLowerCase();
        return subject.contains(query) || description.contains(query);
      }).toList()..sort(_compareNoticesChronologically);
    });
    _scrollToBottom();
  }

  Future<void> _markAsRead(int noticeId) async {
    try {
      final uri = Uri.parse('${widget.baseUrl}/api/student/announcements/$noticeId/read');
      final headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${widget.token}',
      };

      final response = await http.post(uri, headers: headers);
      if (response.statusCode == 200) {
        setState(() {
          for (var notice in _allNotices) {
            if (notice['id'] == noticeId) {
              notice['is_read'] = 1;
            }
          }
          _filteredNotices = List.from(_filteredNotices);
        });
      }
    } catch (_) {
      // Ignore background marking failure
    }
  }

  String _stripHtml(String html) {
    return html
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }


  String _formatTimeOnly(String dateStr) {
    try {
      final date = DateTime.parse(dateStr).toLocal();
      int hour = date.hour;
      final minute = date.minute.toString().padLeft(2, '0');
      final ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour == 0) hour = 12;
      final hourStr = hour.toString().padLeft(2, '0');
      return '$hourStr:$minute $ampm';
    } catch (_) {
      return dateStr;
    }
  }

  String _getDateHeaderTitle(String dateStr) {
    if (dateStr.isEmpty) return 'Recent';
    try {
      final date = DateTime.parse(dateStr).toLocal();
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final yesterday = today.subtract(const Duration(days: 1));
      final noticeDate = DateTime(date.year, date.month, date.day);

      if (noticeDate == today) {
        return 'Today';
      } else if (noticeDate == yesterday) {
        return 'Yesterday';
      } else {
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return '${date.day} ${months[date.month - 1]} ${date.year}';
      }
    } catch (_) {
      return 'Recent';
    }
  }

  List<_NoticeListItem> _getGroupedNotices() {
    final List<_NoticeListItem> items = [];
    String? lastHeader;

    final sortedNotices = List<dynamic>.from(_filteredNotices)
      ..sort(_compareNoticesChronologically);

    for (final notice in sortedNotices) {
      final dateStr = (notice['created_at'] ?? '').toString();
      final header = _getDateHeaderTitle(dateStr);
      if (header != lastHeader) {
        lastHeader = header;
        items.add(_NoticeListItem.header(header));
      }
      items.add(_NoticeListItem.notice(notice));
    }

    return items;
  }

  String _formatDuration(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  String _resolveAudioUrl(String audioUrl) {
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      return audioUrl;
    }
    final base = widget.baseUrl.endsWith('/')
        ? widget.baseUrl.substring(0, widget.baseUrl.length - 1)
        : widget.baseUrl;
    final path = audioUrl.startsWith('/') ? audioUrl : '/$audioUrl';
    return '$base$path';
  }

  // ---------------------------------------------------------------------------
  // Audio Playback Handling
  // ---------------------------------------------------------------------------
  Future<void> _toggleAudioPlay(int noticeId, String audioUrl) async {
    final resolvedUrl = _resolveAudioUrl(audioUrl);

    if (_currentlyPlayingNoticeId == noticeId) {
      if (_playerState == PlayerState.playing) {
        await _audioPlayer.pause();
      } else if (_playerState == PlayerState.paused) {
        await _audioPlayer.resume();
      } else {
        await _audioPlayer.play(UrlSource(resolvedUrl));
      }
    } else {
      await _audioPlayer.stop();
      setState(() {
        _currentlyPlayingNoticeId = noticeId;
        _audioPosition = Duration.zero;
      });
      await _audioPlayer.play(UrlSource(resolvedUrl));
    }
  }

  // ---------------------------------------------------------------------------
  // Voice Recording (WhatsApp Hold-to-Record)
  // ---------------------------------------------------------------------------
  Future<void> _startVoiceRecording() async {
    try {
      final hasPermission = await _audioRecorder.hasPermission();
      if (!hasPermission) {
        _showSnackBar('Microphone permission is required to record audio.', isError: true);
        return;
      }

      // Stop any audio playing
      if (_playerState == PlayerState.playing) {
        await _audioPlayer.stop();
      }

      final tempDir = await getTemporaryDirectory();
      final filePath = p.join(
        tempDir.path,
        'voice_announcement_${DateTime.now().millisecondsSinceEpoch}.m4a',
      );

      await _audioRecorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 128000, sampleRate: 44100),
        path: filePath,
      );

      setState(() {
        _isRecording = true;
        _recordDurationSeconds = 0;
        _currentRecordingPath = filePath;
      });

      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (mounted && _isRecording) {
          setState(() {
            _recordDurationSeconds++;
          });
        }
      });
    } catch (e) {
      _showSnackBar('Could not start recording: $e', isError: true);
    }
  }

  Future<void> _stopVoiceRecording({bool cancelOnly = false}) async {
    if (!_isRecording) return;
    _recordTimer?.cancel();

    try {
      final path = await _audioRecorder.stop();
      final recordedPath = path ?? _currentRecordingPath;
      final finalDuration = _recordDurationSeconds;

      setState(() {
        _isRecording = false;
        _recordDurationSeconds = 0;
      });

      if (cancelOnly) {
        if (recordedPath != null) {
          final f = File(recordedPath);
          if (f.existsSync()) await f.delete();
        }
        _showSnackBar('Recording cancelled');
        return;
      }

      if (finalDuration < 1) {
        if (recordedPath != null) {
          final f = File(recordedPath);
          if (f.existsSync()) await f.delete();
        }
        _showSnackBar('Hold longer to record announcement');
        return;
      }

      if (recordedPath != null && File(recordedPath).existsSync()) {
        _showVoiceAnnouncementPreviewDialog(recordedPath, finalDuration);
      }
    } catch (e) {
      _showSnackBar('Error saving recording: $e', isError: true);
    }
  }

  // ---------------------------------------------------------------------------
  // Dialog: Voice Announcement Review & Publish
  // ---------------------------------------------------------------------------
  void _showVoiceAnnouncementPreviewDialog(String localAudioPath, int durationSeconds) {
    String selectedAudience = 'Both';
    bool isUploading = false;
    final localPlayer = AudioPlayer();
    bool isPreviewPlaying = false;
    Duration previewPosition = Duration.zero;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            localPlayer.onPlayerStateChanged.listen((state) {
              if (modalCtx.mounted) {
                setModalState(() {
                  isPreviewPlaying = state == PlayerState.playing;
                });
              }
            });
            localPlayer.onPositionChanged.listen((pos) {
              if (modalCtx.mounted) {
                setModalState(() {
                  previewPosition = pos;
                });
              }
            });

            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
              ),
              decoration: const BoxDecoration(
                color: _kCanvasBg,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Send Voice Announcement',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: _kDarkSlate,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: _kMutedSlate),
                          onPressed: () {
                            localPlayer.stop();
                            localPlayer.dispose();
                            Navigator.pop(modalCtx);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Audio Waveform & Preview Card
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: _kBorderSlate),
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () async {
                              if (isPreviewPlaying) {
                                await localPlayer.pause();
                              } else {
                                await localPlayer.play(DeviceFileSource(localAudioPath));
                              }
                            },
                            child: CircleAvatar(
                              radius: 22,
                              backgroundColor: _kTealPrimary,
                              child: Icon(
                                isPreviewPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                color: Colors.white,
                                size: 24,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.mic_rounded, color: _kTealPrimary, size: 16),
                                    const SizedBox(width: 4),
                                    Text(
                                      'Voice Note (${_formatDuration(durationSeconds)})',
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: _kDarkSlate,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                LinearProgressIndicator(
                                  value: durationSeconds > 0
                                      ? (previewPosition.inSeconds / durationSeconds).clamp(0.0, 1.0)
                                      : 0.0,
                                  backgroundColor: _kBorderSlate,
                                  valueColor: const AlwaysStoppedAnimation<Color>(_kTealPrimary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Audience label and radio buttons
                    const Text(
                      'AUDIENCE *',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _kMutedSlate,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildAudienceRadioItem(
                      title: 'For Teachers & Students',
                      value: 'Both',
                      groupValue: selectedAudience,
                      onChanged: (val) => setModalState(() => selectedAudience = val!),
                    ),
                    _buildAudienceRadioItem(
                      title: 'For Teachers Only',
                      value: 'Teachers',
                      groupValue: selectedAudience,
                      onChanged: (val) => setModalState(() => selectedAudience = val!),
                    ),
                    _buildAudienceRadioItem(
                      title: 'For Students Only',
                      value: 'Students',
                      groupValue: selectedAudience,
                      onChanged: (val) => setModalState(() => selectedAudience = val!),
                    ),
                    const SizedBox(height: 20),

                    // Action buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: isUploading
                                ? null
                                : () {
                                    localPlayer.stop();
                                    localPlayer.dispose();
                                    Navigator.pop(modalCtx);
                                  },
                            style: OutlinedButton.styleFrom(
                              foregroundColor: _kDarkSlate,
                              side: const BorderSide(color: _kSubtleSlate),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            child: const Text('CANCEL', style: TextStyle(fontWeight: FontWeight.w700)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            onPressed: isUploading
                                ? null
                                : () async {
                                    setModalState(() => isUploading = true);
                                    localPlayer.stop();

                                    final success = await _uploadAndPublishVoiceAnnouncement(
                                      audioFile: File(localAudioPath),
                                      durationSeconds: durationSeconds,
                                      subject: 'Voice Note',
                                      audience: selectedAudience,
                                    );

                                    localPlayer.dispose();
                                    if (modalCtx.mounted) {
                                      Navigator.pop(modalCtx);
                                    }

                                    if (success) {
                                      _showSnackBar('Voice announcement published successfully!');
                                      _fetchNotices();
                                    } else {
                                      _showSnackBar('Failed to publish voice announcement', isError: true);
                                    }
                                  },
                            icon: isUploading
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.send_rounded, size: 18),
                            label: Text(
                              isUploading ? 'SENDING...' : 'PUBLISH NOTICE',
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _kTealPrimary,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<bool> _uploadAndPublishVoiceAnnouncement({
    required File audioFile,
    required int durationSeconds,
    required String subject,
    required String audience,
  }) async {
    try {
      // 1. Upload audio file
      final uploadUri = Uri.parse('${widget.baseUrl}/api/school/announcements/upload-audio');
      final request = http.MultipartRequest('POST', uploadUri);
      request.headers['Authorization'] = 'Bearer ${widget.token}';
      request.headers['Accept'] = 'application/json';

      final fileStream = http.ByteStream(audioFile.openRead());
      final length = await audioFile.length();
      final filename = p.basename(audioFile.path);

      final multipartFile = http.MultipartFile(
        'audio',
        fileStream,
        length,
        filename: filename.isNotEmpty ? filename : 'voice_note.m4a',
      );
      request.files.add(multipartFile);

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 200 && response.statusCode != 201) {
        return false;
      }

      final decodedUpload = json.decode(response.body);
      final data = decodedUpload['data'] ?? {};
      final String? audioUrl = data['audio_url'] ?? data['url'];

      if (audioUrl == null || audioUrl.isEmpty) {
        return false;
      }

      // 2. Create Announcement with audio_url and audio_duration
      final createUri = Uri.parse('${widget.baseUrl}/api/school/announcements');
      final createBody = json.encode({
        'subject': subject,
        'description': '<p>Voice Announcement</p>',
        'audience': audience,
        'status': 'Published',
        'audio_url': audioUrl,
        'audio_duration': durationSeconds,
      });

      final createRes = await http.post(
        createUri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
        body: createBody,
      );

      return createRes.statusCode == 200 || createRes.statusCode == 201;
    } catch (_) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Dialog: Text Announcement Creation (Matching Image 2)
  // ---------------------------------------------------------------------------
  void _showCreateAnnouncementModal() {
    final TextEditingController subjectCtrl = TextEditingController();
    final TextEditingController descCtrl = TextEditingController();
    String selectedAudience = 'Both';
    bool isSubmitting = false;

    void insertHtmlTag(String openTag, String closeTag) {
      final text = descCtrl.text;
      final selection = descCtrl.selection;
      if (selection.start >= 0 && selection.end >= 0 && selection.start != selection.end) {
        final selectedText = text.substring(selection.start, selection.end);
        final newText = text.replaceRange(selection.start, selection.end, '$openTag$selectedText$closeTag');
        descCtrl.value = TextEditingValue(
          text: newText,
          selection: TextSelection(
            baseOffset: selection.start,
            extentOffset: selection.start + openTag.length + selectedText.length + closeTag.length,
          ),
        );
      } else {
        final pos = selection.start >= 0 ? selection.start : text.length;
        final newText = text.replaceRange(pos, pos, '$openTag$closeTag');
        descCtrl.value = TextEditingValue(
          text: newText,
          selection: TextSelection.collapsed(offset: pos + openTag.length),
        );
      }
    }

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Dialog(
              backgroundColor: _kCanvasBg,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 500),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 22),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Create Announcement',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: _kDarkSlate,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, color: _kMutedSlate, size: 22),
                              onPressed: () => Navigator.pop(modalCtx),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),

                        // Subject Label & Input (Matching Image 2 pill shape)
                        const Text(
                          'SUBJECT',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: _kMutedSlate,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: subjectCtrl,
                          style: const TextStyle(fontSize: 14, color: _kDarkSlate, fontWeight: FontWeight.w500),
                          decoration: InputDecoration(
                            hintText: 'e.g. School Reopens from 15 July',
                            hintStyle: const TextStyle(fontSize: 13, color: _kSubtleSlate),
                            filled: false,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: const BorderSide(color: Color(0xFF64748B)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: const BorderSide(color: Color(0xFF64748B)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(24),
                              borderSide: const BorderSide(color: _kDarkSlate, width: 1.5),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Description Label & Box with Bold, Italic, Underline Toolbar
                        const Text(
                          'DESCRIPTION *',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: _kMutedSlate,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFF64748B)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Toolbar with B, I, U
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                child: Row(
                                  children: [
                                    InkWell(
                                      onTap: () => insertHtmlTag('<b>', '</b>'),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        child: const Text(
                                          'B',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w900,
                                            fontSize: 15,
                                            color: _kDarkSlate,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    InkWell(
                                      onTap: () => insertHtmlTag('<i>', '</i>'),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        child: const Text(
                                          'I',
                                          style: TextStyle(
                                            fontStyle: FontStyle.italic,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 15,
                                            color: _kDarkSlate,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    InkWell(
                                      onTap: () => insertHtmlTag('<u>', '</u>'),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        child: const Text(
                                          'U',
                                          style: TextStyle(
                                            decoration: TextDecoration.underline,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 15,
                                            color: _kDarkSlate,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Divider(height: 1, thickness: 1, color: Color(0xFF64748B)),
                              // Multiline input
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                child: TextField(
                                  controller: descCtrl,
                                  maxLines: 6,
                                  minLines: 4,
                                  style: const TextStyle(fontSize: 14, color: _kDarkSlate),
                                  decoration: const InputDecoration(
                                    border: InputBorder.none,
                                    hintText: 'Enter announcement details...',
                                    hintStyle: TextStyle(fontSize: 13, color: _kSubtleSlate),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Audience Label
                        const Text(
                          'AUDIENCE *',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: _kMutedSlate,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 12,
                          runSpacing: 4,
                          children: [
                            _buildAudienceRadioOption(
                              title: 'For Teachers Only',
                              value: 'Teachers',
                              groupValue: selectedAudience,
                              onChanged: (val) => setModalState(() => selectedAudience = val!),
                            ),
                            _buildAudienceRadioOption(
                              title: 'For Students Only',
                              value: 'Students',
                              groupValue: selectedAudience,
                              onChanged: (val) => setModalState(() => selectedAudience = val!),
                            ),
                            _buildAudienceRadioOption(
                              title: 'For Teachers & Students',
                              value: 'Both',
                              groupValue: selectedAudience,
                              onChanged: (val) => setModalState(() => selectedAudience = val!),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        const Divider(thickness: 1, color: Color(0xFFCBD5E1)),
                        const SizedBox(height: 18),

                        // Bottom Actions: CANCEL, PUBLISH
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton(
                              onPressed: isSubmitting ? null : () => Navigator.pop(modalCtx),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _kDarkSlate,
                                side: const BorderSide(color: Color(0xFF64748B)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                              ),
                              child: const Text('CANCEL', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton(
                              onPressed: isSubmitting
                                  ? null
                                  : () async {
                                      final subj = subjectCtrl.text.trim();
                                      final desc = descCtrl.text.trim();
                                      if (subj.isEmpty || desc.isEmpty) {
                                        _showSnackBar('Subject and description are required', isError: true);
                                        return;
                                      }
                                      setModalState(() => isSubmitting = true);
                                      final ok = await _submitTextAnnouncement(
                                        subject: subj,
                                        description: desc,
                                        audience: selectedAudience,
                                        status: 'Published',
                                      );
                                      if (modalCtx.mounted) Navigator.pop(modalCtx);
                                      if (ok) {
                                        _showSnackBar('Announcement published successfully');
                                        _fetchNotices();
                                      } else {
                                        _showSnackBar('Failed to publish announcement', isError: true);
                                      }
                                    },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF635E54), // matching Image 2 brownish-slate
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                              ),
                              child: const Text('PUBLISH', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<bool> _submitTextAnnouncement({
    required String subject,
    required String description,
    required String audience,
    required String status,
  }) async {
    try {
      final formattedDesc = description.contains('<p>') || description.contains('<br>')
          ? description
          : '<p>${description.replaceAll('\n', '<br>')}</p>';

      final uri = Uri.parse('${widget.baseUrl}/api/school/announcements');
      final body = json.encode({
        'subject': subject,
        'description': formattedDesc,
        'audience': audience,
        'status': status,
      });

      final res = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
        body: body,
      );

      return res.statusCode == 200 || res.statusCode == 201;
    } catch (_) {
      return false;
    }
  }

  Widget _buildAudienceRadioItem({
    required String title,
    required String value,
    required String groupValue,
    required ValueChanged<String?> onChanged,
  }) {
    final bool isSelected = value == groupValue;
    return InkWell(
      onTap: () => onChanged(value),
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? _kTealPrimary : const Color(0xFF94A3B8),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: _kTealPrimary,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 10),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: _kDarkSlate,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAudienceRadioOption({
    required String title,
    required String value,
    required String groupValue,
    required ValueChanged<String?> onChanged,
  }) {
    final bool isSelected = value == groupValue;
    return InkWell(
      onTap: () => onChanged(value),
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Center(
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                color: _kDarkSlate,
              ),
            ),
          ],
        ),
      ),
    );
  }


  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : _kTealPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Build Method
  // ---------------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    final Widget bodyContent = Column(
      children: [
        // Modern Clean Search Bar matching TAR style (No Indigo/Blue)
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Container(
            height: 46,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorderSlate),
            ),
            child: TextField(
              controller: _searchController,
              style: const TextStyle(fontSize: 14, color: _kDarkSlate, fontWeight: FontWeight.w500),
              decoration: InputDecoration(
                hintText: 'Search notices...',
                hintStyle: const TextStyle(fontSize: 14, color: _kSubtleSlate),
                prefixIcon: const Icon(Icons.search_rounded, color: _kMutedSlate, size: 20),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, color: _kMutedSlate, size: 18),
                        onPressed: () => _searchController.clear(),
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
              ),
            ),
          ),
        ),

        // Active Recording Banner (Visible when holding mic)
        if (_isRecording)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFFFEF2F2),
            child: Row(
              children: [
                const Icon(Icons.fiber_manual_record_rounded, color: Colors.red, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Recording: ${_formatDuration(_recordDurationSeconds)}',
                  style: const TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),

        // Notice List
        Expanded(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: _kTealPrimary),
                )
              : _errorText.isNotEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.wifi_off_rounded, size: 56, color: _kSubtleSlate),
                            const SizedBox(height: 14),
                            Text(
                              _errorText,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 14,
                                color: _kDarkSlate,
                                height: 1.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton.icon(
                              onPressed: _fetchNotices,
                              icon: const Icon(Icons.refresh_rounded, size: 18),
                              label: const Text('RETRY'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _kTealPrimary,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : _filteredNotices.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.campaign_outlined, size: 68, color: _kSubtleSlate),
                                const SizedBox(height: 16),
                                const Text(
                                  'No Announcements Available',
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: _kDarkSlate,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'There are currently no announcements for you.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 13, color: _kMutedSlate),
                                ),
                              ],
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          color: _kTealPrimary,
                          onRefresh: _fetchNotices,
                          child: Builder(
                            builder: (context) {
                              final groupedItems = _getGroupedNotices();
                              return ListView.builder(
                                controller: _scrollController,
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.only(left: 14, right: 14, top: 8, bottom: 20),
                                itemCount: groupedItems.length,
                                itemBuilder: (context, index) {
                                  final item = groupedItems[index];
                                  if (item.isHeader) {
                                    return _buildDateHeader(item.headerText!);
                                  }
                                  return _buildNoticeCard(item.notice);
                                },
                              );
                            },
                          ),
                        ),
        ),

        // Principal Bottom Action Bar (Only for Principal)
        if (_isPrincipal && !widget.isEmbedded) _buildPrincipalBottomBar(),
      ],
    );

    if (widget.isEmbedded) {
      return bodyContent;
    }

    return Scaffold(
      backgroundColor: _kCanvasBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Padding(
          padding: EdgeInsets.only(top: 4.0),
          child: Text(
            'NOTICE BOARD',
            style: TextStyle(
              color: _kDarkSlate,
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 0.6,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF1E293B), size: 20),
            tooltip: 'Refresh',
            onPressed: _fetchNotices,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: bodyContent,
    );
  }

  Widget _buildDateHeader(String title) {
    return Container(
      margin: const EdgeInsets.only(top: 14, bottom: 8),
      alignment: Alignment.center,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
        decoration: BoxDecoration(
          color: const Color(0xFFE2E8F0).withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFF475569),
            letterSpacing: 0.2,
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Notice Card Widget
  // ---------------------------------------------------------------------------
  Widget _buildNoticeCard(dynamic notice) {
    final int noticeId = (notice['id'] as num).toInt();
    final String subject = notice['subject'] ?? '';
    final String description = notice['description'] ?? '';
    final String dateStr = notice['created_at'] ?? '';
    final String? audioUrl = notice['audio_url'];
    final int? audioDuration = notice['audio_duration'] != null ? (notice['audio_duration'] as num).toInt() : null;
    final String audience = notice['audience'] ?? 'Both';
    final String status = notice['status'] ?? 'Published';
    final String authorName = (notice['author_name'] ?? notice['created_by'] ?? '').toString().trim();
    final bool isRead = (notice['is_read'] ?? 0) == 1;
    final bool isAudio = audioUrl != null && audioUrl.isNotEmpty;
    final bool isPlayingThis = _currentlyPlayingNoticeId == noticeId && _playerState == PlayerState.playing;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: _kCardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _kBorderSlate),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Tag Row: Audience Badge (Principal only), Author Name, Time
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Audience Tag - ONLY for Principal
                if (_isPrincipal) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _kTealLight,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _kTealBorder),
                    ),
                    child: Text(
                      audience == 'Both'
                          ? 'All'
                          : audience == 'Teachers'
                              ? 'Teachers'
                              : 'Students',
                      style: const TextStyle(
                        color: _kTealPrimary,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (status == 'Draft') ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'DRAFT',
                        style: TextStyle(
                          color: Color(0xFF92400E),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(width: 8),
                ],

                // Author / Sender Name
                if (authorName.isNotEmpty) ...[
                  Expanded(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.person_rounded, size: 14, color: _kMutedSlate),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            authorName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: _kMutedSlate,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ] else
                  const Spacer(),

                Icon(Icons.access_time_rounded, size: 12, color: _kSubtleSlate),
                const SizedBox(width: 4),
                Text(
                  _formatTimeOnly(dateStr),
                  style: const TextStyle(
                    fontSize: 10,
                    color: _kSubtleSlate,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),

            // Subject Title (Hidden for pure voice announcements without custom title)
            if (!isAudio || (subject.isNotEmpty && !subject.toLowerCase().startsWith('voice announcement') && subject.toLowerCase() != 'voice note')) ...[
              const SizedBox(height: 10),
              Text(
                subject,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: isRead ? FontWeight.w700 : FontWeight.w900,
                  color: _kDarkSlate,
                  height: 1.25,
                ),
              ),
            ],

            // Inline Audio Player (if Voice Announcement)
            if (isAudio) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _kBorderSlate),
                ),
                child: Row(
                  children: [
                    InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () {
                        if (!isRead) {
                          _markAsRead(noticeId);
                        }
                        _toggleAudioPlay(noticeId, audioUrl);
                      },
                      child: CircleAvatar(
                        radius: 17,
                        backgroundColor: _kTealPrimary,
                        child: Icon(
                          isPlayingThis ? Icons.pause_rounded : Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.mic_rounded, color: _kTealPrimary, size: 13),
                              const SizedBox(width: 4),
                              Text(
                                'Voice Note${audioDuration != null ? ' • ${_formatDuration(audioDuration)}' : ''}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: _kTealPrimary,
                                ),
                              ),
                              if (isPlayingThis) ...[
                                const Spacer(),
                                Text(
                                  _formatDuration(_audioPosition.inSeconds),
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: _kMutedSlate,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (isPlayingThis && _audioDuration.inSeconds > 0) ...[
                            const SizedBox(height: 3),
                            LinearProgressIndicator(
                              value: (_audioPosition.inMilliseconds / _audioDuration.inMilliseconds)
                                  .clamp(0.0, 1.0),
                              backgroundColor: _kBorderSlate,
                              valueColor: const AlwaysStoppedAnimation<Color>(_kTealPrimary),
                              minHeight: 3,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Text preview if exists (for non-audio or detailed notes)
            if (description.isNotEmpty && _stripHtml(description).isNotEmpty && _stripHtml(description) != 'Voice Announcement' && _stripHtml(description) != 'Voice Note') ...[
              const SizedBox(height: 8),
              Text(
                _stripHtml(description),
                style: const TextStyle(
                  fontSize: 13,
                  color: _kMutedSlate,
                  height: 1.35,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Principal Bottom Action Bar (Only for Principal)
  // ---------------------------------------------------------------------------
  Widget _buildPrincipalBottomBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: _kBorderSlate)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Create Announcement Button (Opens modal matching Image 2)
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _showCreateAnnouncementModal,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text(
                  'NEW NOTICE',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, letterSpacing: 0.4),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kTealPrimary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // WhatsApp-style Hold-to-Record Mic Button
            GestureDetector(
              onLongPressStart: (_) => _startVoiceRecording(),
              onLongPressEnd: (_) => _stopVoiceRecording(),
              onTap: () {
                _showSnackBar('Hold mic to record voice note, release to send');
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: EdgeInsets.all(_isRecording ? 16 : 12),
                decoration: BoxDecoration(
                  color: _isRecording ? Colors.red.shade600 : _kTealPrimary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: (_isRecording ? Colors.red : _kTealPrimary).withValues(alpha: 0.3),
                      blurRadius: _isRecording ? 12 : 6,
                      spreadRadius: _isRecording ? 3 : 0,
                    ),
                  ],
                ),
                child: Icon(
                  _isRecording ? Icons.mic_rounded : Icons.mic_none_rounded,
                  color: Colors.white,
                  size: _isRecording ? 26 : 22,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------------
// Detailed Notice Screen (Matching TAR Aesthetic & Audio Support)
// -----------------------------------------------------------------------------
class NoticeDetailsScreen extends StatefulWidget {
  final String? baseUrl;
  final String? token;
  final String subject;
  final String description;
  final String publishDate;
  final String? audioUrl;
  final int? audioDuration;
  final String? audience;

  const NoticeDetailsScreen({
    super.key,
    this.baseUrl,
    this.token,
    required this.subject,
    required this.description,
    required this.publishDate,
    this.audioUrl,
    this.audioDuration,
    this.audience,
  });

  @override
  State<NoticeDetailsScreen> createState() => _NoticeDetailsScreenState();
}

class _NoticeDetailsScreenState extends State<NoticeDetailsScreen> {
  static const Color _kCanvasBg = Color(0xFFFBF8F2);
  static const Color _kTealPrimary = Color(0xFF0F766E);
  static const Color _kDarkSlate = Color(0xFF0F172A);
  static const Color _kMutedSlate = Color(0xFF475569);
  static const Color _kBorderSlate = Color(0xFFE2E8F0);

  final AudioPlayer _player = AudioPlayer();
  PlayerState _state = PlayerState.stopped;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  double _playbackSpeed = 1.0;

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _state = s);
    });
    _player.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
    _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String _resolveAudioUrl(String audioUrl) {
    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      return audioUrl;
    }
    final rawBase = widget.baseUrl ?? '';
    final base = rawBase.endsWith('/')
        ? rawBase.substring(0, rawBase.length - 1)
        : rawBase;
    final path = audioUrl.startsWith('/') ? audioUrl : '/$audioUrl';
    return '$base$path';
  }

  String _formatDuration(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  List<TextSpan> _parseHtml(String html, TextStyle baseStyle) {
    final List<TextSpan> spans = [];
    int index = 0;
    bool isBold = false;
    bool isItalic = false;
    bool isUnderline = false;

    final tagRegex = RegExp(r'<[^>]+>');
    final matches = tagRegex.allMatches(html);

    for (final match in matches) {
      if (match.start > index) {
        final text = html.substring(index, match.start);
        spans.add(_createTextSpan(text, baseStyle, isBold, isItalic, isUnderline));
      }

      final tag = match.group(0)!.toLowerCase();
      if (tag == '<b>' || tag == '<strong>') {
        isBold = true;
      } else if (tag == '</b>' || tag == '</strong>') {
        isBold = false;
      } else if (tag == '<i>' || tag == '<em>') {
        isItalic = true;
      } else if (tag == '</i>' || tag == '</em>') {
        isItalic = false;
      } else if (tag == '<u>') {
        isUnderline = true;
      } else if (tag == '</u>') {
        isUnderline = false;
      } else if (tag == '<br>' || tag == '<br />' || tag == '<br/>') {
        spans.add(const TextSpan(text: '\n'));
      } else if (tag == '<p>') {
        if (spans.isNotEmpty) {
          spans.add(const TextSpan(text: '\n'));
        }
      } else if (tag == '</p>') {
        spans.add(const TextSpan(text: '\n'));
      }

      index = match.end;
    }

    if (index < html.length) {
      final text = html.substring(index);
      spans.add(_createTextSpan(text, baseStyle, isBold, isItalic, isUnderline));
    }

    return spans;
  }

  TextSpan _createTextSpan(String text, TextStyle base, bool bold, bool italic, bool underline) {
    String decoded = text
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");

    return TextSpan(
      text: decoded,
      style: base.copyWith(
        fontWeight: bold ? FontWeight.bold : base.fontWeight,
        fontStyle: italic ? FontStyle.italic : base.fontStyle,
        decoration: underline ? TextDecoration.underline : base.decoration,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool hasAudio = widget.audioUrl != null && widget.audioUrl!.isNotEmpty;

    return Scaffold(
      backgroundColor: _kCanvasBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Padding(
          padding: EdgeInsets.only(top: 4.0),
          child: Text(
            'NOTICE DETAILS',
            style: TextStyle(
              color: _kDarkSlate,
              fontWeight: FontWeight.w900,
              fontSize: 16,
              letterSpacing: 0.6,
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Audience & Date header
            Row(
              children: [
                if (widget.audience != null && widget.audience!.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: const Color(0xFFCCFBF1)),
                    ),
                    child: Text(
                      widget.audience == 'Both'
                          ? 'Audience: All'
                          : widget.audience == 'Teachers'
                              ? 'Audience: Teachers Only'
                              : 'Audience: Students Only',
                      style: const TextStyle(
                        color: _kTealPrimary,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                const Spacer(),
                Icon(Icons.calendar_today_rounded, size: 13, color: Colors.grey.shade500),
                const SizedBox(width: 6),
                Text(
                  widget.publishDate,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Subject Title Heading
            Text(
              widget.subject,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: _kDarkSlate,
                height: 1.3,
              ),
            ),
            const SizedBox(height: 16),

            // Audio Player Section if available
            if (hasAudio) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _kBorderSlate),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.mic_rounded, color: _kTealPrimary, size: 18),
                        const SizedBox(width: 6),
                        const Text(
                          'Voice Announcement',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: _kDarkSlate,
                          ),
                        ),
                        const Spacer(),
                        InkWell(
                          onTap: () {
                            setState(() {
                              if (_playbackSpeed == 1.0) {
                                _playbackSpeed = 1.5;
                              } else if (_playbackSpeed == 1.5) {
                                _playbackSpeed = 2.0;
                              } else {
                                _playbackSpeed = 1.0;
                              }
                              _player.setPlaybackRate(_playbackSpeed);
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${_playbackSpeed}x',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: _kDarkSlate,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        InkWell(
                          onTap: () async {
                            if (_state == PlayerState.playing) {
                              await _player.pause();
                            } else {
                              final resolved = _resolveAudioUrl(widget.audioUrl!);
                              await _player.play(UrlSource(resolved));
                            }
                          },
                          child: CircleAvatar(
                            radius: 24,
                            backgroundColor: _kTealPrimary,
                            child: Icon(
                              _state == PlayerState.playing
                                  ? Icons.pause_rounded
                                  : Icons.play_arrow_rounded,
                              color: Colors.white,
                              size: 28,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  activeTrackColor: _kTealPrimary,
                                  inactiveTrackColor: _kBorderSlate,
                                  thumbColor: _kTealPrimary,
                                  trackHeight: 4,
                                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                ),
                                child: Slider(
                                  value: _position.inMilliseconds.toDouble().clamp(
                                        0.0,
                                        (_duration.inMilliseconds > 0
                                                ? _duration.inMilliseconds
                                                : (widget.audioDuration ?? 1) * 1000)
                                            .toDouble(),
                                      ),
                                  max: (_duration.inMilliseconds > 0
                                          ? _duration.inMilliseconds
                                          : (widget.audioDuration ?? 1) * 1000)
                                      .toDouble(),
                                  onChanged: (val) {
                                    _player.seek(Duration(milliseconds: val.toInt()));
                                  },
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _formatDuration(_position.inSeconds),
                                      style: const TextStyle(fontSize: 11, color: _kMutedSlate),
                                    ),
                                    Text(
                                      _formatDuration(
                                        _duration.inSeconds > 0
                                            ? _duration.inSeconds
                                            : (widget.audioDuration ?? 0),
                                      ),
                                      style: const TextStyle(fontSize: 11, color: _kMutedSlate),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            const Divider(color: _kBorderSlate),
            const SizedBox(height: 16),

            // Description styled text rendering
            if (widget.description.isNotEmpty && widget.description != '<p>Voice Announcement</p>')
              RichText(
                text: TextSpan(
                  children: _parseHtml(
                    widget.description,
                    const TextStyle(
                      fontSize: 15,
                      color: _kDarkSlate,
                      height: 1.6,
                      fontFamily: 'Roboto',
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NoticeListItem {
  final bool isHeader;
  final String? headerText;
  final dynamic notice;

  _NoticeListItem.header(this.headerText)
      : isHeader = true,
        notice = null;

  _NoticeListItem.notice(this.notice)
      : isHeader = false,
        headerText = null;
}
