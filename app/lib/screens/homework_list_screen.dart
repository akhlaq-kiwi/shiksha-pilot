import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:school_hub/services/http_service.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/homework_service.dart';
import '../widgets/create_edit_homework_modal.dart';
import '../utils/class_formatter.dart';
import 'attachment_gallery_screen.dart';

class HomeworkListScreen extends StatefulWidget {
  final String userRole;
  final int? selectedStudentId;
  final String baseUrl;

  const HomeworkListScreen({
    Key? key,
    required this.userRole,
    this.selectedStudentId,
    required this.baseUrl,
  }) : super(key: key);

  @override
  State<HomeworkListScreen> createState() => _HomeworkListScreenState();
}

class _HomeworkListScreenState extends State<HomeworkListScreen> {
  late HomeworkService _homeworkService;
  List<dynamic> _homeworkList = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Voice recording state
  final AudioRecorder _audioRecorder = AudioRecorder();
  bool _isRecording = false;
  int _recordDurationSeconds = 0;
  Timer? _recordTimer;
  String? _currentRecordingPath;

  // Audio player state for voice homework cards
  final ScrollController _scrollController = ScrollController();
  final AudioPlayer _audioPlayer = AudioPlayer();
  int? _currentlyPlayingHomeworkId;
  PlayerState _playerState = PlayerState.stopped;
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;
  StreamSubscription? _playerStateSub;
  StreamSubscription? _playerPositionSub;
  StreamSubscription? _playerDurationSub;
  StreamSubscription? _playerCompleteSub;

  @override
  void initState() {
    super.initState();
    _initAudioListeners();
    _initServiceAndFetch();
  }

  void _initAudioListeners() {
    _playerStateSub = _audioPlayer.onPlayerStateChanged.listen((state) {
      if (mounted) setState(() => _playerState = state);
    });
    _playerPositionSub = _audioPlayer.onPositionChanged.listen((pos) {
      if (mounted) setState(() => _audioPosition = pos);
    });
    _playerDurationSub = _audioPlayer.onDurationChanged.listen((dur) {
      if (mounted) setState(() => _audioDuration = dur);
    });
    _playerCompleteSub = _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _playerState = PlayerState.stopped;
          _currentlyPlayingHomeworkId = null;
          _audioPosition = Duration.zero;
        });
      }
    });
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
    _audioRecorder.dispose();
    _playerStateSub?.cancel();
    _playerPositionSub?.cancel();
    _playerDurationSub?.cancel();
    _playerCompleteSub?.cancel();
    _audioPlayer.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  int _compareHomeworkChronologically(dynamic a, dynamic b) {
    final aMap = a is Map ? a : (a as dynamic);
    final bMap = b is Map ? b : (b as dynamic);
    final aStr = (aMap['created_at'] ?? '').toString();
    final bStr = (bMap['created_at'] ?? '').toString();
    final aDate = DateTime.tryParse(aStr);
    final bDate = DateTime.tryParse(bStr);
    if (aDate != null && bDate != null) {
      final cmp = aDate.compareTo(bDate);
      if (cmp != 0) return cmp;
    }
    final aId = (aMap['id'] as num?)?.toInt() ?? int.tryParse(aMap['id']?.toString() ?? '0') ?? 0;
    final bId = (bMap['id'] as num?)?.toInt() ?? int.tryParse(bMap['id']?.toString() ?? '0') ?? 0;
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

  Future<void> _initServiceAndFetch() async {
    _homeworkService = await HomeworkService.create();
    _markHomeworkNotificationsRead();
    _fetchHomework();
  }

  Future<void> _markHomeworkNotificationsRead() async {
    try {
      if (_isTeacher) return;
      final token = _homeworkService.token;
      if (token.isEmpty) return;
      final effectiveBase = widget.baseUrl.isNotEmpty ? widget.baseUrl : _homeworkService.baseUrl;
      final uri = Uri.parse('$effectiveBase/api/student/notifications/0/read').replace(
        queryParameters: widget.selectedStudentId != null
            ? {'student_id': widget.selectedStudentId.toString()}
            : null,
      );
      await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
          if (widget.selectedStudentId != null) 'X-Student-Id': widget.selectedStudentId.toString(),
        },
        body: json.encode({'module': 'homework'}),
      );
    } catch (_) {}
  }

  Future<void> _fetchHomework() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _homeworkService.fetchHomeworkList(
        userRole: widget.userRole,
        selectedStudentId: widget.selectedStudentId,
      );
      list.sort(_compareHomeworkChronologically);
      if (mounted) {
        setState(() {
          _homeworkList = list;
          _isLoading = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  bool get _isTeacher {
    final role = widget.userRole.toUpperCase();
    return role == 'TEACHER' || role == 'SCHOOL_ADMIN' || role == 'PRINCIPAL';
  }

  bool _isWithinOneHour(Map<String, dynamic> item) {
    final raw = item['created_at']?.toString() ?? '';
    if (raw.isEmpty) return false;
    final dt = DateTime.tryParse(raw);
    if (dt == null) return false;
    return DateTime.now().difference(dt).inMinutes <= 60;
  }

  Future<void> _openCreateModal() async {
    final res = await CreateEditHomeworkModal.show(
      context,
      homeworkService: _homeworkService,
    );
    if (res == true) {
      await _fetchHomework();
      _scrollToBottom(animated: true);
    }
  }

  Future<void> _openEditModal(Map<String, dynamic> homework) async {
    final res = await CreateEditHomeworkModal.show(
      context,
      homeworkService: _homeworkService,
      initialHomework: homework,
    );
    if (res == true) {
      _fetchHomework();
    }
  }

  Future<void> _confirmDelete(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: Colors.white,
        elevation: 8,
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626), size: 24),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Text(
                      'Delete Homework',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text(
                'Are you sure you want to delete this homework? This action cannot be undone.',
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF475569),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 20),
              const Divider(color: Color(0xFFE2E8F0), height: 1),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          foregroundColor: const Color(0xFF475569),
                        ),
                        onPressed: () => Navigator.pop(dialogCtx, false),
                        child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () => Navigator.pop(dialogCtx, true),
                        child: const Text('Delete', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true) {
      try {
        await _homeworkService.deleteHomework(id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Homework deleted successfully'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Color(0xFF0F766E),
              duration: Duration(seconds: 2),
            ),
          );
          _fetchHomework();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.toString().replaceAll('Exception: ', '')),
              behavior: SnackBarBehavior.floating,
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Voice Recording Mechanics
  // ---------------------------------------------------------------------------
  Future<void> _startVoiceRecording() async {
    try {
      final hasPermission = await _audioRecorder.hasPermission();
      if (!hasPermission) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Microphone permission is required to record audio.')),
          );
        }
        return;
      }

      if (_playerState == PlayerState.playing) {
        await _audioPlayer.stop();
      }

      final tempDir = await getTemporaryDirectory();
      final filePath = p.join(
        tempDir.path,
        'voice_hw_${DateTime.now().millisecondsSinceEpoch}.m4a',
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

      _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (mounted) {
          setState(() {
            _recordDurationSeconds++;
          });
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error starting recording: $e')),
        );
      }
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
        return;
      }

      if (finalDuration < 1) {
        if (recordedPath != null) {
          final f = File(recordedPath);
          if (f.existsSync()) await f.delete();
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Hold longer to record voice homework')),
          );
        }
        return;
      }

      if (recordedPath != null && File(recordedPath).existsSync()) {
        _showVoiceHomeworkPreviewDialog(recordedPath, finalDuration);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving recording: $e')),
        );
      }
    }
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
    final effectiveBase = widget.baseUrl.isNotEmpty ? widget.baseUrl : _homeworkService.baseUrl;
    final base = effectiveBase.endsWith('/') ? effectiveBase.substring(0, effectiveBase.length - 1) : effectiveBase;
    final path = audioUrl.startsWith('/') ? audioUrl : '/$audioUrl';
    return '$base$path';
  }

  Future<void> _toggleAudioPlay(int homeworkId, String audioUrl) async {
    final resolvedUrl = _resolveAudioUrl(audioUrl);

    if (_currentlyPlayingHomeworkId == homeworkId) {
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
        _currentlyPlayingHomeworkId = homeworkId;
        _audioPosition = Duration.zero;
      });
      await _audioPlayer.play(UrlSource(resolvedUrl));
    }
  }

  // ---------------------------------------------------------------------------
  // Voice Homework Preview & Class Selection Dialog
  // ---------------------------------------------------------------------------
  Future<List<dynamic>> _fetchClasses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      final effectiveBase = widget.baseUrl.isNotEmpty ? widget.baseUrl : _homeworkService.baseUrl;
      final response = await http.get(
        Uri.parse('$effectiveBase/api/teacher/classes'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        final decoded = json.decode(response.body);
        final list = decoded['data'] ?? decoded['classes'] ?? [];
        if (list is List) {
          final Set<int> seenIds = {};
          final List unique = [];
          for (var c in list) {
            final int? id = c['id'] is int ? c['id'] : int.tryParse(c['id'].toString());
            if (id != null && !seenIds.contains(id)) {
              seenIds.add(id);
              unique.add(c);
            }
          }
          return unique;
        }
      }
    } catch (_) {}
    return [];
  }

  void _showVoiceHomeworkPreviewDialog(String localAudioPath, int durationSeconds) {
    int? selectedClassId;
    List<dynamic> classesList = [];
    bool isLoadingClasses = true;
    bool isSubmitting = false;
    final previewPlayer = AudioPlayer();
    bool isPreviewPlaying = false;
    Duration previewPosition = Duration.zero;
    final TextEditingController titleCtrl = TextEditingController(text: 'Voice Homework');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            previewPlayer.onPlayerStateChanged.listen((state) {
              if (modalCtx.mounted) {
                setModalState(() => isPreviewPlaying = state == PlayerState.playing);
              }
            });
            previewPlayer.onPositionChanged.listen((pos) {
              if (modalCtx.mounted) {
                setModalState(() => previewPosition = pos);
              }
            });
            previewPlayer.onPlayerComplete.listen((_) {
              if (modalCtx.mounted) {
                setModalState(() {
                  isPreviewPlaying = false;
                  previewPosition = Duration.zero;
                });
              }
            });

            if (isLoadingClasses) {
              _fetchClasses().then((list) {
                if (modalCtx.mounted) {
                  setModalState(() {
                    classesList = list;
                    if (classesList.isNotEmpty && selectedClassId == null) {
                      final first = classesList.first;
                      selectedClassId = first['id'] is int ? first['id'] : int.tryParse(first['id'].toString());
                    }
                    isLoadingClasses = false;
                  });
                }
              });
            }

            final sortedClasses = sortClassesAscending(classesList);
            String currentLabel = 'Select Class';
            for (var c in classesList) {
              final int id = c['id'] is int ? c['id'] : int.parse(c['id'].toString());
              if (id == selectedClassId) {
                final String rawName = c['name']?.toString() ?? '';
                final String sec = c['section']?.toString() ?? '';
                currentLabel = formatShortClassName(rawName, section: sec);
                break;
              }
            }

            final bottomInset = MediaQuery.of(modalCtx).viewInsets.bottom;

            return Container(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 24 + bottomInset),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Assign Voice Homework',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _formatDuration(durationSeconds),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFFB45309)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Audio Player Preview Card
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: Row(
                        children: [
                          InkWell(
                            borderRadius: BorderRadius.circular(24),
                            onTap: () async {
                              if (isPreviewPlaying) {
                                await previewPlayer.pause();
                              } else {
                                await previewPlayer.play(DeviceFileSource(localAudioPath));
                              }
                            },
                            child: CircleAvatar(
                              radius: 20,
                              backgroundColor: const Color(0xFFC26600),
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
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text(
                                      'Recorded Audio Note',
                                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                    ),
                                    Text(
                                      _formatDuration(previewPosition.inSeconds),
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                LinearProgressIndicator(
                                  value: durationSeconds > 0
                                      ? (previewPosition.inSeconds / durationSeconds).clamp(0.0, 1.0)
                                      : 0.0,
                                  backgroundColor: const Color(0xFFE2E8F0),
                                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFC26600)),
                                  minHeight: 4,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Title / Subject Name Field
                    TextField(
                      controller: titleCtrl,
                      onTapOutside: (_) => FocusScope.of(context).unfocus(),
                      decoration: InputDecoration(
                        labelText: 'Subject / Title',
                        hintText: 'e.g. English, Math, General',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Target Class curved dropdown
                    const Text(
                      'Select Target Class',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF475569)),
                    ),
                    const SizedBox(height: 6),
                    isLoadingClasses
                        ? const SizedBox(
                            height: 36,
                            child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFC26600))),
                          )
                        : Builder(
                            builder: (btnCtx) {
                              return InkWell(
                                onTap: sortedClasses.isEmpty
                                    ? null
                                    : () async {
                                        FocusScope.of(modalCtx).unfocus();
                                        final renderBox = btnCtx.findRenderObject() as RenderBox?;
                                        if (renderBox == null) return;
                                        final offset = renderBox.localToGlobal(Offset.zero);
                                        final size = renderBox.size;
                                        final overlay = Overlay.of(modalCtx).context.findRenderObject() as RenderBox?;
                                        if (overlay == null) return;

                                        final position = RelativeRect.fromRect(
                                          Rect.fromLTWH(offset.dx, offset.dy + size.height + 4, size.width, size.height),
                                          Offset.zero & overlay.size,
                                        );

                                        final selected = await showMenu<int>(
                                          context: modalCtx,
                                          position: position,
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                          color: Colors.white,
                                          elevation: 6,
                                          constraints: BoxConstraints(
                                            minWidth: size.width,
                                            maxWidth: size.width,
                                            maxHeight: 280,
                                          ),
                                          items: sortedClasses.map((c) {
                                            final int id = c['id'] is int ? c['id'] : int.parse(c['id'].toString());
                                            final String rawName = c['name']?.toString() ?? '';
                                            final String sec = c['section']?.toString() ?? '';
                                            final String label = formatShortClassName(rawName, section: sec);
                                            final isSelected = id == selectedClassId;

                                            return PopupMenuItem<int>(
                                              value: id,
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              child: Container(
                                                decoration: BoxDecoration(
                                                  color: isSelected ? const Color(0xFFFEF3C7) : Colors.transparent,
                                                  borderRadius: BorderRadius.circular(10),
                                                ),
                                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                child: Row(
                                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        label,
                                                        style: TextStyle(
                                                          fontSize: 13,
                                                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                                          color: isSelected ? const Color(0xFFB45309) : const Color(0xFF0F172A),
                                                        ),
                                                      ),
                                                    ),
                                                    if (isSelected)
                                                      const Icon(Icons.check_rounded, size: 16, color: Color(0xFFD97706)),
                                                  ],
                                                ),
                                              ),
                                            );
                                          }).toList(),
                                        );

                                        if (selected != null) {
                                          setModalState(() {
                                            selectedClassId = selected;
                                          });
                                        }
                                      },
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        currentLabel,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                      ),
                                      const Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: Color(0xFF475569)),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                    const SizedBox(height: 22),

                    // Submit & Cancel buttons
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 46,
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Color(0xFFCBD5E1)),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                foregroundColor: const Color(0xFF475569),
                              ),
                              onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                              child: const Text('Cancel', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SizedBox(
                            height: 46,
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFC26600),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: isSubmitting
                                  ? null
                                  : () async {
                                      if (selectedClassId == null) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(content: Text('Please select a target class')),
                                        );
                                        return;
                                      }

                                      setModalState(() => isSubmitting = true);
                                      try {
                                        // 1. Upload audio
                                        final audioFile = File(localAudioPath);
                                        final uploaded = await _homeworkService.uploadAttachment(audioFile);

                                        // 2. Create homework
                                        final subject = titleCtrl.text.trim().isNotEmpty
                                            ? titleCtrl.text.trim()
                                            : 'Voice Homework';

                                        await _homeworkService.createHomework(
                                          title: subject,
                                          description: 'Voice note assignment',
                                          classId: selectedClassId,
                                          attachments: [uploaded],
                                        );

                                        if (modalCtx.mounted) Navigator.pop(ctx);
                                        if (mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('Voice homework assigned successfully!'),
                                              backgroundColor: Color(0xFF0F766E),
                                              behavior: SnackBarBehavior.floating,
                                            ),
                                          );
                                          await _fetchHomework();
                                          _scrollToBottom(animated: true);
                                        }
                                      } catch (err) {
                                        setModalState(() => isSubmitting = false);
                                        if (mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                http.isNetworkError(err)
                                                    ? http.kNetworkErrorMessage
                                                    : 'Failed: ${http.formatErrorMessage(err)}',
                                              ),
                                              backgroundColor: Colors.red.shade700,
                                              behavior: SnackBarBehavior.floating,
                                            ),
                                          );
                                        }
                                      }
                                    },
                              child: isSubmitting
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                                    )
                                  : const Text('Assign Homework', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
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
    ).whenComplete(() {
      previewPlayer.dispose();
    });
  }

  void _openGalleryView(List attachments, [int initialIndex = 0]) {
    if (attachments.isEmpty) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AttachmentGalleryScreen(
          attachments: attachments,
          initialIndex: initialIndex,
          baseUrl: widget.baseUrl.isNotEmpty ? widget.baseUrl : _homeworkService.baseUrl,
        ),
      ),
    );
  }

  String _getDateHeaderTitle(String dateStr) {
    if (dateStr.isEmpty) return 'Recent';
    try {
      DateTime? dt;
      if (RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(dateStr)) {
        dt = DateTime.parse(dateStr).toLocal();
      } else {
        final parts = dateStr.split(' ');
        if (parts.length >= 3) {
          final day = int.tryParse(parts[0]) ?? 1;
          final monthStr = parts[1].toLowerCase();
          final year = int.tryParse(parts[2]) ?? DateTime.now().year;
          const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          final monthIndex = months.indexWhere((m) => monthStr.startsWith(m));
          if (monthIndex != -1) {
            dt = DateTime(year, monthIndex + 1, day);
          }
        }
      }

      if (dt == null) return dateStr;

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final yesterday = today.subtract(const Duration(days: 1));
      final hwDate = DateTime(dt.year, dt.month, dt.day);

      if (hwDate == today) {
        return 'Today';
      } else if (hwDate == yesterday) {
        return 'Yesterday';
      } else {
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
      }
    } catch (_) {
      return 'Recent';
    }
  }

  List<_HomeworkListItem> _getGroupedHomework() {
    final List<_HomeworkListItem> items = [];
    String? lastHeader;

    final sortedList = List<dynamic>.from(_homeworkList)
      ..sort(_compareHomeworkChronologically);

    for (final hw in sortedList) {
      final hwMap = Map<String, dynamic>.from(hw);
      final dateStr = (hwMap['created_at'] ?? hwMap['assigned_date'] ?? '').toString();
      final header = _getDateHeaderTitle(dateStr);
      if (header != lastHeader) {
        lastHeader = header;
        items.add(_HomeworkListItem.header(header));
      }
      items.add(_HomeworkListItem.homework(hwMap));
    }

    return items;
  }

  Widget _buildDateHeader(String dateLabel) {
    return Center(
      child: Container(
        margin: const EdgeInsets.only(top: 8, bottom: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade300),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          dateLabel,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Colors.grey.shade800,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text(
          'Homework',
          style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
      ),
      bottomNavigationBar: _isTeacher ? _buildTeacherBottomBar() : null,
      body: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchHomework,
              color: const Color(0xFF0F766E),
              child: _buildBody(),
            ),
          ),
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
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  const Text(
                    'Tap mic to stop',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTeacherBottomBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Full-length green Assign Homework button matching Notice Board
            Expanded(
              child: SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: _openCreateModal,
                  icon: const Icon(Icons.add_rounded, size: 20),
                  label: const Text(
                    'ASSIGN HOMEWORK',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, letterSpacing: 0.4),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E), // Green matching Notice screen
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // WhatsApp-style Hold-to-Record Mic Button
            GestureDetector(
              onLongPressStart: (_) => _startVoiceRecording(),
              onLongPressEnd: (_) => _stopVoiceRecording(),
              onTap: () {
                if (_isRecording) {
                  _stopVoiceRecording();
                } else {
                  _startVoiceRecording();
                }
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: EdgeInsets.all(_isRecording ? 16 : 12),
                decoration: BoxDecoration(
                  color: _isRecording ? Colors.red.shade600 : const Color(0xFF0F766E),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: (_isRecording ? Colors.red : const Color(0xFF0F766E)).withOpacity(0.3),
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

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFC26600)),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded, size: 54, color: Colors.red.shade400),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, color: Colors.black87),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchHomework,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFC26600),
                  foregroundColor: Colors.white,
                ),
                child: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    if (_homeworkList.isEmpty) {
      return ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.25),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.menu_book_rounded, size: 64, color: Colors.amber.shade200),
                const SizedBox(height: 16),
                Text(
                  'No Homework Assigned Yet',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _isTeacher
                      ? 'Tap "Assign Homework" or Mic to post your first assignment.'
                      : 'Check back later for new homework from your teachers.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final groupedItems = _getGroupedHomework();

    return ListView.builder(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(left: 16, right: 16, top: 8, bottom: 20),
      itemCount: groupedItems.length,
      itemBuilder: (context, index) {
        final item = groupedItems[index];
        if (item.isHeader) {
          return _buildDateHeader(item.headerText!);
        }
        return _buildHomeworkCard(Map<String, dynamic>.from(item.homework));
      },
    );
  }

  Widget _buildHomeworkCard(Map<String, dynamic> item) {
    final int id = item['id'] is int ? item['id'] : int.parse(item['id'].toString());
    final String title = item['title'] ?? '';
    final String description = item['description'] ?? '';
    final String className = item['class_name'] ?? '';
    final String assignedDate = item['assigned_date'] ?? '';
    final String assignedTime = item['assigned_time'] ?? '';
    final List attachments = (item['attachments'] is List) ? item['attachments'] : [];

    // Find any audio attachment for voice homework
    dynamic audioAtt;
    for (var a in attachments) {
      final ftype = (a['file_type'] ?? '').toString().toLowerCase();
      final fpath = (a['file_path'] ?? '').toString().toLowerCase();
      if (ftype == 'audio' || fpath.endsWith('.m4a') || fpath.endsWith('.mp3') || fpath.endsWith('.aac') || fpath.endsWith('.wav')) {
        audioAtt = a;
        break;
      }
    }

    final List nonAudioAtts = attachments.where((a) => a != audioAtt).toList();
    final bool isPlayingThis = _currentlyPlayingHomeworkId == id && _playerState == PlayerState.playing;
    final String subjectDisplay = title.isNotEmpty ? title : 'General';
    final bool canEditOrDelete = _isTeacher && _isWithinOneHour(item);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Subject Name + Class Badge + 3-dots Menu (Only within 1 hour)
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFFFEF3C7),
                  radius: 20,
                  child: Icon(
                    audioAtt != null ? Icons.mic_rounded : Icons.menu_book_rounded,
                    color: const Color(0xFFC26600),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    subjectDisplay,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Text(
                    className.isNotEmpty ? className : 'All Classes',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFB45309),
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
                if (canEditOrDelete) ...[
                  const SizedBox(width: 6),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF64748B), size: 22),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    color: Colors.white,
                    surfaceTintColor: Colors.transparent,
                    elevation: 6,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 160),
                    onSelected: (val) {
                      if (val == 'edit') {
                        _openEditModal(item);
                      } else if (val == 'delete') {
                        _confirmDelete(id);
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit_outlined, size: 18, color: Color(0xFF0F172A)),
                            SizedBox(width: 10),
                            Text('Edit Homework', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                            SizedBox(width: 10),
                            Text('Delete Homework', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFDC2626))),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),

            // Voice Note Player (if voice homework)
            if (audioAtt != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () => _toggleAudioPlay(id, audioAtt['file_path'] ?? ''),
                      child: CircleAvatar(
                        radius: 18,
                        backgroundColor: const Color(0xFF0F766E),
                        child: Icon(
                          isPlayingThis ? Icons.pause_rounded : Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.mic_rounded, color: Color(0xFF0F766E), size: 14),
                              const SizedBox(width: 4),
                              const Text(
                                'Voice Note',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                              if (isPlayingThis) ...[
                                const Spacer(),
                                Text(
                                  _formatDuration(_audioPosition.inSeconds),
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                                ),
                              ],
                            ],
                          ),
                          if (isPlayingThis && _audioDuration.inSeconds > 0) ...[
                            const SizedBox(height: 4),
                            LinearProgressIndicator(
                              value: (_audioPosition.inMilliseconds / _audioDuration.inMilliseconds).clamp(0.0, 1.0),
                              backgroundColor: const Color(0xFFE2E8F0),
                              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF0F766E)),
                              minHeight: 3,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Description
            if (description.isNotEmpty && description != 'Voice note assignment' && description != 'Voice note') ...[
              SelectableText(
                description,
                style: const TextStyle(
                  fontSize: 14,
                  color: Colors.black87,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Non-audio Attachments
            if (nonAudioAtts.isNotEmpty) ...[
              const Divider(height: 1),
              const SizedBox(height: 10),
              InkWell(
                onTap: () => _openGalleryView(nonAudioAtts, 0),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.attach_file_rounded, size: 18, color: Color(0xFFC26600)),
                      const SizedBox(width: 6),
                      Text(
                        '${nonAudioAtts.length} ${nonAudioAtts.length == 1 ? 'Attachment' : 'Attachments'}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFC26600),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFC26600)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Footer: Date & Time
            const Divider(height: 1),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.calendar_today_rounded, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text(
                      assignedDate,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                Row(
                  children: [
                    Icon(Icons.access_time_rounded, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text(
                      assignedTime,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeworkListItem {
  final bool isHeader;
  final String? headerText;
  final dynamic homework;

  _HomeworkListItem.header(this.headerText)
      : isHeader = true,
        homework = null;

  _HomeworkListItem.homework(this.homework)
      : isHeader = false,
        headerText = null;
}
