import 'dart:io';
import 'dart:math';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import '../services/leave_service.dart';
import '../utils/class_formatter.dart';

class VisualElement {
  String id;
  String type; // 'image' or 'shape'
  String? imagePath;
  String? shapeKey; // circle, square, rectangle, triangle, right_triangle, oval, star, pentagon, hexagon, octagon, diamond, parallelogram, trapezoid, arrow_right, arrow_up, line, parallel_lines, angle, cube, cylinder, cone
  String alignment; // 'left', 'center', 'right'
  double size; // 100.0 (small), 180.0 (medium), 260.0 (large) for image; 90.0, 140.0, 200.0 for shape
  double offsetX;
  double offsetY;

  VisualElement({
    required this.id,
    required this.type,
    this.imagePath,
    this.shapeKey,
    this.alignment = 'center',
    double? size,
    this.offsetX = 0.0,
    this.offsetY = 0.0,
  }) : size = size ?? (type == 'shape' ? 140.0 : 180.0);

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'imagePath': imagePath,
        'shapeKey': shapeKey,
        'alignment': alignment,
        'size': size,
        'offsetX': offsetX,
        'offsetY': offsetY,
      };

  factory VisualElement.fromJson(Map<String, dynamic> json) => VisualElement(
        id: json['id'] ?? 've_${DateTime.now().millisecondsSinceEpoch}',
        type: json['type'] ?? 'image',
        imagePath: json['imagePath'],
        shapeKey: json['shapeKey'],
        alignment: json['alignment'] ?? 'center',
        size: (json['size'] is num) ? (json['size'] as num).toDouble() : ((json['type'] == 'shape') ? 140.0 : 180.0),
        offsetX: (json['offsetX'] is num) ? (json['offsetX'] as num).toDouble() : 0.0,
        offsetY: (json['offsetY'] is num) ? (json['offsetY'] as num).toDouble() : 0.0,
      );
}

class QuestionBlock {
  String id;
  String type; // mcq, true_false, fill_blanks, matching, short_answer, long_answer, section, heading, group_instruction, image, shape
  String text;
  String bottomText;
  double marks;
  List<String> options;
  List<String> leftMatching;
  List<String> rightMatching;
  List<SubQuestion> subQuestions;
  bool isCollapsed;
  String? imagePath;
  String? shapeKey; // circle, square, rectangle, triangle, right_triangle, oval, star, pentagon, hexagon, octagon, diamond, parallelogram, trapezoid, arrow_right, arrow_up, line, parallel_lines, angle, cube, cylinder, cone
  String imageAlignment; // 'left', 'center', 'right'
  double imageSize; // 100.0 (small), 180.0 (medium), 260.0 (large)
  List<VisualElement> visualElements;

  QuestionBlock({
    required this.id,
    required this.type,
    required this.text,
    this.bottomText = '',
    this.marks = 0.0,
    List<String>? options,
    List<String>? leftMatching,
    List<String>? rightMatching,
    List<SubQuestion>? subQuestions,
    this.isCollapsed = false,
    this.imagePath,
    this.shapeKey,
    this.imageAlignment = 'center',
    this.imageSize = 180.0,
    List<VisualElement>? visualElements,
  })  : options = options ?? [],
        leftMatching = leftMatching ?? [],
        rightMatching = rightMatching ?? [],
        subQuestions = subQuestions ?? [],
        visualElements = visualElements ?? [];

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'text': text,
        'bottomText': bottomText,
        'marks': marks,
        'options': options,
        'leftMatching': leftMatching,
        'rightMatching': rightMatching,
        'subQuestions': subQuestions.map((s) => s.toJson()).toList(),
        'isCollapsed': isCollapsed,
        'imagePath': imagePath,
        'shapeKey': shapeKey,
        'imageAlignment': imageAlignment,
        'imageSize': imageSize,
        'visualElements': visualElements.map((v) => v.toJson()).toList(),
      };

  factory QuestionBlock.fromJson(Map<String, dynamic> json) {
    List<VisualElement> veList = [];
    if (json['visualElements'] is List) {
      veList = (json['visualElements'] as List)
          .map((v) => VisualElement.fromJson(Map<String, dynamic>.from(v)))
          .toList();
    }
    if (veList.isEmpty) {
      if (json['imagePath'] != null && json['imagePath'].toString().isNotEmpty) {
        veList.add(VisualElement(
          id: 've_legacy_img_${DateTime.now().millisecondsSinceEpoch}',
          type: 'image',
          imagePath: json['imagePath'],
          alignment: json['imageAlignment'] ?? 'center',
          size: (json['imageSize'] is num) ? (json['imageSize'] as num).toDouble() : 180.0,
        ));
      }
      if (json['shapeKey'] != null && json['shapeKey'].toString().isNotEmpty) {
        veList.add(VisualElement(
          id: 've_legacy_shp_${DateTime.now().millisecondsSinceEpoch}',
          type: 'shape',
          shapeKey: json['shapeKey'],
          alignment: json['imageAlignment'] ?? 'center',
          size: (json['imageSize'] is num) ? (json['imageSize'] as num).toDouble() : 140.0,
        ));
      }
    }

    return QuestionBlock(
      id: json['id'] ?? 'q-${DateTime.now().millisecondsSinceEpoch}',
      type: json['type'] ?? 'short_answer',
      text: json['text'] ?? '',
      bottomText: json['bottomText'] ?? '',
      marks: (json['marks'] is num) ? (json['marks'] as num).toDouble() : 0.0,
      options: List<String>.from(json['options'] ?? []),
      leftMatching: List<String>.from(json['leftMatching'] ?? []),
      rightMatching: List<String>.from(json['rightMatching'] ?? []),
      subQuestions: (json['subQuestions'] as List? ?? [])
          .map((s) => SubQuestion.fromJson(Map<String, dynamic>.from(s)))
          .toList(),
      isCollapsed: json['isCollapsed'] ?? false,
      imagePath: json['imagePath'],
      shapeKey: json['shapeKey'],
      imageAlignment: json['imageAlignment'] ?? 'center',
      imageSize: (json['imageSize'] is num) ? (json['imageSize'] as num).toDouble() : 180.0,
      visualElements: veList,
    );
  }
}

class SubQuestion {
  String id;
  String text;
  double marks;

  SubQuestion({
    required this.id,
    required this.text,
    this.marks = 1.0,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'text': text,
        'marks': marks,
      };

  factory SubQuestion.fromJson(Map<String, dynamic> json) => SubQuestion(
        id: json['id'] ?? 'sub-${DateTime.now().millisecondsSinceEpoch}',
        text: json['text'] ?? '',
        marks: (json['marks'] is num) ? (json['marks'] as num).toDouble() : 1.0,
      );
}

class QuestionPaperDesignerScreen extends StatefulWidget {
  final LeaveService leaveService;

  const QuestionPaperDesignerScreen({
    Key? key,
    required this.leaveService,
  }) : super(key: key);

  @override
  State<QuestionPaperDesignerScreen> createState() => _QuestionPaperDesignerScreenState();
}

class _QuestionPaperDesignerScreenState extends State<QuestionPaperDesignerScreen> {
  bool _isLoading = false;

  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  String? _selectedClassId;
  String? _selectedClassName;
  String? _selectedSubjectId;
  String? _selectedSubjectName;

  final TextEditingController _paperTitleController = TextEditingController(text: 'Terminal Assessment');
  final TextEditingController _examNameController = TextEditingController(text: 'Quarterly Examination');
  final TextEditingController _durationController = TextEditingController(text: '3 Hours');
  final TextEditingController _maxMarksController = TextEditingController(text: '100');
  final TextEditingController _instructionsController = TextEditingController(
    text: '1. All questions are compulsory.\n2. Write your answers neatly and legibly.\n3. Check your paper before submitting.',
  );

  List<QuestionBlock> _questions = [];
  String? _currentPaperId;
  String? _focusedBlockId;
  String? _selectedVisualElementId;
  String? _resizingVisualElementId;
  bool _isPointerOnVisualElement = false;
  bool _isPointerOnResizeLine = false;
  double _resizeLineDragOffsetX = 0.0;
  double _resizeLineDragOffsetY = 0.0;
  Offset? _dragStartGlobalPos;
  double _dragStartVeSize = 180.0;

  final TextEditingController _hController = TextEditingController();
  final TextEditingController _wController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _bootstrapData();
  }

  @override
  void dispose() {
    _paperTitleController.dispose();
    _examNameController.dispose();
    _durationController.dispose();
    _maxMarksController.dispose();
    _instructionsController.dispose();
    _hController.dispose();
    _wController.dispose();
    super.dispose();
  }

  Future<void> _bootstrapData() async {
    _classes = List.from(_fallbackClasses);
    _subjects = List.from(_fallbackSubjects);
    _selectedClassId = _classes.first['id'].toString();
    _selectedClassName = formatShortClassName(_classes.first['name']?.toString(), section: _classes.first['section']?.toString());
    _selectedSubjectId = _subjects.first['id'].toString();
    _selectedSubjectName = _subjects.first['name']?.toString();

    await _loadCurrentDraft();
    if (mounted) setState(() => _isLoading = false);

    // Fetch live backend classes & subjects asynchronously in background without blocking screen load
    _fetchClasses();
  }

  final List<Map<String, dynamic>> _fallbackClasses = const [
    {'id': '1', 'name': 'Nursery', 'section': ''},
    {'id': '2', 'name': 'LKG', 'section': ''},
    {'id': '3', 'name': 'UKG', 'section': ''},
    {'id': '4', 'name': 'Class 1', 'section': 'A'},
    {'id': '5', 'name': 'Class 2', 'section': 'A'},
    {'id': '6', 'name': 'Class 3', 'section': 'A'},
    {'id': '7', 'name': 'Class 4', 'section': 'A'},
    {'id': '8', 'name': 'Class 5', 'section': 'A'},
    {'id': '9', 'name': 'Class 6', 'section': 'A'},
    {'id': '10', 'name': 'Class 7', 'section': 'A'},
    {'id': '11', 'name': 'Class 8', 'section': 'A'},
    {'id': '12', 'name': 'Class 9', 'section': 'A'},
    {'id': '13', 'name': 'Class 10', 'section': 'A'},
    {'id': '14', 'name': 'Class 11', 'section': 'A'},
    {'id': '15', 'name': 'Class 12', 'section': 'A'},
  ];

  final List<Map<String, dynamic>> _fallbackSubjects = const [
    {'id': '101', 'name': 'English'},
    {'id': '102', 'name': 'Hindi'},
    {'id': '103', 'name': 'Mathematics'},
    {'id': '104', 'name': 'Science'},
    {'id': '105', 'name': 'Social Studies'},
    {'id': '106', 'name': 'EVS'},
    {'id': '107', 'name': 'GK'},
    {'id': '108', 'name': 'Computer Science'},
    {'id': '109', 'name': 'Physics'},
    {'id': '110', 'name': 'Chemistry'},
    {'id': '111', 'name': 'Biology'},
  ];

  Future<http.Response?> _getWithFallback(String path, String token, String primaryBaseUrl) async {
    final List<String> baseUrls = [
      primaryBaseUrl,
      if (!primaryBaseUrl.contains('10.237.103.71')) 'http://10.237.103.71:8000',
      if (!primaryBaseUrl.contains('127.0.0.1')) 'http://127.0.0.1:8000',
    ];

    for (final base in baseUrls) {
      try {
        final res = await http.get(
          Uri.parse('$base$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ).timeout(const Duration(milliseconds: 1200));
        if (res.statusCode == 200) {
          return res;
        }
      } catch (e) {
        debugPrint('Failed to connect to $base$path: $e');
      }
    }
    return null;
  }

  Future<void> _fetchClasses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final baseUrl = widget.leaveService.baseUrl;

      http.Response? response = await _getWithFallback('/api/teacher/classes', token, baseUrl);
      response ??= await _getWithFallback('/api/school/classes', token, baseUrl);

      if (response != null && response.statusCode == 200) {
        final data = json.decode(response.body);
        List<dynamic> rawList = [];
        if (data is List) {
          rawList = data;
        } else if (data is Map && data['data'] != null) {
          rawList = data['data'];
        } else if (data is Map && data['classes'] != null) {
          rawList = data['classes'];
        }
        if (rawList.isNotEmpty) {
          final sortedList = sortClassesAscending(rawList);
          setState(() {
            _classes = sortedList;
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching classes: $e');
    }

    if (_classes.isEmpty) {
      setState(() {
        _classes = List.from(_fallbackClasses);
      });
    }

    if (_selectedClassId == null && _classes.isNotEmpty) {
      _onClassSelected(_classes.first['id'].toString());
    } else if (_selectedClassId != null) {
      _fetchSubjects(_selectedClassId!);
    }
  }

  Future<void> _fetchSubjects(String classId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? widget.leaveService.token;
      final baseUrl = widget.leaveService.baseUrl;

      final response = await _getWithFallback('/api/school/subjects?class_id=$classId', token, baseUrl);

      if (response != null && response.statusCode == 200) {
        final data = json.decode(response.body);
        List<dynamic> rawSubjects = [];
        if (data is List) {
          rawSubjects = data;
        } else if (data is Map && data['data'] != null) {
          rawSubjects = data['data'];
        } else if (data is Map && data['subjects'] != null) {
          rawSubjects = data['subjects'];
        }
        if (rawSubjects.isNotEmpty) {
          setState(() {
            _subjects = rawSubjects;
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
    }

    if (_subjects.isEmpty) {
      setState(() {
        _subjects = List.from(_fallbackSubjects);
      });
    }

    if (_subjects.isNotEmpty) {
      final matched = _subjects.firstWhere(
        (sub) => sub['id']?.toString() == _selectedSubjectId,
        orElse: () => null,
      );
      setState(() {
        if (matched != null) {
          _selectedSubjectId = matched['id']?.toString();
          _selectedSubjectName = matched['name']?.toString();
        } else {
          final firstSub = _subjects.first;
          _selectedSubjectId = firstSub['id']?.toString();
          _selectedSubjectName = firstSub['name']?.toString();
        }
      });
    }
  }

  void _onClassSelected(String classId) {
    final matched = _classes.firstWhere(
      (c) => c['id'].toString() == classId,
      orElse: () => null,
    );
    setState(() {
      _selectedClassId = classId;
      if (matched != null) {
        _selectedClassName = formatShortClassName(
          matched['name']?.toString(),
          section: matched['section']?.toString(),
        );
      }
    });
    _fetchSubjects(classId);
  }

  double get _totalMarksCalculated {
    double sum = 0;
    for (var q in _questions) {
      sum += q.marks;
    }
    return sum;
  }

  // --- Draft Storage & Auto-save ---
  Future<void> _saveDraft({bool showToast = true}) async {
    final prefs = await SharedPreferences.getInstance();
    _currentPaperId ??= 'paper_${DateTime.now().millisecondsSinceEpoch}';

    final paperData = {
      'id': _currentPaperId,
      'class_id': _selectedClassId,
      'class_name': _selectedClassName,
      'subject_id': _selectedSubjectId,
      'subject_name': _selectedSubjectName,
      'paper_title': _paperTitleController.text,
      'exam_name': _examNameController.text,
      'duration': _durationController.text,
      'max_marks': _maxMarksController.text,
      'instructions': _instructionsController.text,
      'questions': _questions.map((q) => q.toJson()).toList(),
      'updated_at': DateTime.now().toIso8601String(),
    };

    await prefs.setString('qpd_current_draft', json.encode(paperData));

    // Save into list of saved papers
    final savedJson = prefs.getString('qpd_saved_papers');
    List<dynamic> savedList = savedJson != null ? json.decode(savedJson) : [];
    final idx = savedList.indexWhere((p) => p['id'] == _currentPaperId);
    if (idx >= 0) {
      savedList[idx] = paperData;
    } else {
      savedList.insert(0, paperData);
    }
    await prefs.setString('qpd_saved_papers', json.encode(savedList));

    if (showToast && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Question paper saved successfully!'),
          backgroundColor: Colors.teal,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _onQuestionsChanged() {
    _saveDraft(showToast: false);
  }

  Future<void> _loadCurrentDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final draftJson = prefs.getString('qpd_current_draft');
    if (draftJson != null) {
      try {
        final data = json.decode(draftJson);
        setState(() {
          _currentPaperId = data['id'];
          if (data['class_id'] != null) _selectedClassId = data['class_id'].toString();
          if (data['class_name'] != null) _selectedClassName = data['class_name'].toString();
          if (data['subject_id'] != null) _selectedSubjectId = data['subject_id'].toString();
          if (data['subject_name'] != null) _selectedSubjectName = data['subject_name'].toString();
          if (data['paper_title'] != null) _paperTitleController.text = data['paper_title'];
          if (data['exam_name'] != null) _examNameController.text = data['exam_name'];
          if (data['duration'] != null) _durationController.text = data['duration'];
          if (data['max_marks'] != null) _maxMarksController.text = data['max_marks'];
          if (data['instructions'] != null) _instructionsController.text = data['instructions'];

          if (data['questions'] is List) {
            _questions = (data['questions'] as List)
                .map((q) => QuestionBlock.fromJson(Map<String, dynamic>.from(q)))
                .toList();
          }
        });
        return;
      } catch (e) {
        debugPrint('Error loading draft: $e');
      }
    }
    // Default template if never loaded before
    _loadTemplate('unit_test');
  }

  // --- Templates ---
  void _loadTemplate(String key) {
    setState(() {
      _currentPaperId = null;
      if (key == 'blank') {
        _paperTitleController.text = 'Blank Paper';
        _maxMarksController.text = '100';
        _durationController.text = '3 Hours';
        _questions = [];
      } else if (key == 'unit_test') {
        _paperTitleController.text = 'Unit Test 1';
        _maxMarksController.text = '20';
        _durationController.text = '1 Hour';
        _instructionsController.text = '1. Attempt all questions.\n2. Write clearly and legibly.';
        _questions = [
          QuestionBlock(
            id: 'q-ut-1',
            type: 'mcq',
            text: 'Multiple Choice Questions:',
            marks: 2.0,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
          ),
          QuestionBlock(
            id: 'q-ut-2',
            type: 'fill_blanks',
            text: 'Water boils at _______ degrees Celsius.',
            marks: 2.0,
          ),
          QuestionBlock(
            id: 'q-ut-3',
            type: 'true_false',
            text: 'The sun rises in the West.',
            marks: 1.0,
          ),
          QuestionBlock(
            id: 'q-ut-4',
            type: 'matching',
            text: 'Match the columns:',
            marks: 4.0,
            leftMatching: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
            rightMatching: ['Matching A', 'Matching B', 'Matching C', 'Matching D'],
          ),
          QuestionBlock(
            id: 'q-ut-5',
            type: 'short_answer',
            text: 'Define Photosynthesis and write its basic formula.',
            marks: 5.0,
          ),
        ];
      }
      _onQuestionsChanged();
    });
  }

  // --- Quick Block Creators ---
  void _addQuestion(String type) {
    if (type == 'shape' || type == 'image') {
      QuestionBlock? targetBlock;
      if (_focusedBlockId != null) {
        final idx = _questions.indexWhere((q) => q.id == _focusedBlockId);
        if (idx != -1) targetBlock = _questions[idx];
      }
      if (targetBlock == null && _questions.isNotEmpty) {
        targetBlock = _questions.last;
      }

      if (targetBlock != null) {
        setState(() {
          _focusedBlockId = targetBlock!.id;
        });
        if (type == 'image') {
          _pickImageFromGallery(targetBlock);
        } else {
          _showShapeSelectorDialog(targetBlock);
        }
        return;
      }
    }

    final newId = 'q_${DateTime.now().millisecondsSinceEpoch}';
    QuestionBlock block;

    switch (type) {
      case 'mcq':
        block = QuestionBlock(
          id: newId,
          type: 'mcq',
          text: 'Multiple Choice Questions:',
          marks: 2.0,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
        );
        break;
      case 'true_false':
        block = QuestionBlock(
          id: newId,
          type: 'true_false',
          text: 'New True or False Question',
          marks: 1.0,
        );
        break;
      case 'fill_blanks':
        block = QuestionBlock(
          id: newId,
          type: 'fill_blanks',
          text: 'The capital of France is _______ .',
          marks: 2.0,
        );
        break;
      case 'matching':
        block = QuestionBlock(
          id: newId,
          type: 'matching',
          text: 'Match the columns:',
          marks: 4.0,
          leftMatching: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
          rightMatching: ['Matching A', 'Matching B', 'Matching C', 'Matching D'],
        );
        break;
      case 'short_answer':
        block = QuestionBlock(
          id: newId,
          type: 'short_answer',
          text: 'Short Answer Question',
          marks: 5.0,
        );
        break;
      case 'long_answer':
        block = QuestionBlock(
          id: newId,
          type: 'long_answer',
          text: 'Long Answer Question in detail',
          marks: 10.0,
        );
        break;
      case 'image':
        block = QuestionBlock(
          id: newId,
          type: 'image',
          text: 'Look at the image and answer the following:',
          marks: 2.0,
        );
        break;
      case 'shape':
        block = QuestionBlock(
          id: newId,
          type: 'shape',
          text: 'Identify the shape given below:',
          marks: 2.0,
        );
        break;
      case 'section':
        block = QuestionBlock(
          id: newId,
          type: 'section',
          text: 'SECTION B',
          marks: 0.0,
        );
        break;
      case 'heading':
        block = QuestionBlock(
          id: newId,
          type: 'heading',
          text: 'ANSWER ALL THE FOLLOWING QUESTIONS',
          marks: 0.0,
        );
        break;
      case 'group_instruction':
        block = QuestionBlock(
          id: newId,
          type: 'group_instruction',
          text: 'Note: Answer any 3 out of 5 questions.',
          marks: 0.0,
        );
        break;
      default:
        block = QuestionBlock(id: newId, type: 'short_answer', text: 'Question', marks: 5.0);
    }

    setState(() {
      _questions.add(block);
      _focusedBlockId = block.id;
      _onQuestionsChanged();
    });

    if (type == 'image') {
      _pickImageFromGallery(block);
    } else if (type == 'shape') {
      _showShapeSelectorDialog(block);
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Added ${type.replaceAll('_', ' ').toUpperCase()} block'),
        duration: const Duration(milliseconds: 900),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _moveQuestion(int index, int delta) {
    final newIndex = index + delta;
    if (newIndex < 0 || newIndex >= _questions.length) return;
    setState(() {
      final item = _questions.removeAt(index);
      _questions.insert(newIndex, item);
      _onQuestionsChanged();
    });
  }

  void _duplicateQuestion(int index) {
    final orig = _questions[index];
    final copyJson = orig.toJson();
    copyJson['id'] = 'q_${DateTime.now().millisecondsSinceEpoch}';
    final copyObj = QuestionBlock.fromJson(copyJson);

    setState(() {
      _questions.insert(index + 1, copyObj);
      _onQuestionsChanged();
    });
  }

  void _deleteQuestion(int index) {
    if (index < 0 || index >= _questions.length) return;
    final deletedId = _questions[index].id;
    setState(() {
      _questions.removeAt(index);
      if (_focusedBlockId == deletedId) {
        _focusedBlockId = null;
      }
      _onQuestionsChanged();
    });
  }

  // --- Image & Shape Pickers ---
  Future<void> _pickImageFromGallery(QuestionBlock q) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        allowMultiple: false,
      );
      if (result != null && result.files.single.path != null) {
        setState(() {
          final ve = VisualElement(
            id: 've_${DateTime.now().microsecondsSinceEpoch}',
            type: 'image',
            imagePath: result.files.single.path,
            alignment: 'center',
            size: 180.0,
          );
          q.visualElements.add(ve);
          _focusedBlockId = q.id;
          _onQuestionsChanged();
        });
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  final List<Map<String, String>> _allShapesList = const [
    {'key': 'circle', 'label': 'Circle'},
    {'key': 'square', 'label': 'Square'},
    {'key': 'rectangle', 'label': 'Rectangle'},
    {'key': 'triangle', 'label': 'Triangle'},
    {'key': 'right_triangle', 'label': 'Right Triangle'},
    {'key': 'oval', 'label': 'Oval / Ellipse'},
    {'key': 'star', 'label': 'Star'},
    {'key': 'pentagon', 'label': 'Pentagon'},
    {'key': 'hexagon', 'label': 'Hexagon'},
    {'key': 'octagon', 'label': 'Octagon'},
    {'key': 'diamond', 'label': 'Diamond / Rhombus'},
    {'key': 'parallelogram', 'label': 'Parallelogram'},
    {'key': 'trapezoid', 'label': 'Trapezoid'},
    {'key': 'arrow_right', 'label': 'Arrow Right'},
    {'key': 'arrow_up', 'label': 'Arrow Up'},
    {'key': 'line', 'label': 'Line'},
    {'key': 'parallel_lines', 'label': 'Parallel Lines'},
    {'key': 'angle', 'label': 'Angle'},
    {'key': 'cube', 'label': '3D Cube'},
    {'key': 'cylinder', 'label': '3D Cylinder'},
    {'key': 'cone', 'label': '3D Cone'},
  ];

  void _showShapeSelectorDialog(QuestionBlock q) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.65,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Select Geometric Shape', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 1.1,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: _allShapesList.length,
                itemBuilder: (context, idx) {
                  final s = _allShapesList[idx];
                  return InkWell(
                    onTap: () {
                      Navigator.pop(ctx);
                      setState(() {
                        final ve = VisualElement(
                          id: 've_${DateTime.now().microsecondsSinceEpoch}',
                          type: 'shape',
                          shapeKey: s['key'],
                          alignment: 'center',
                          size: 140.0,
                        );
                        q.visualElements.add(ve);
                        _focusedBlockId = q.id;
                        _onQuestionsChanged();
                      });
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        border: Border.all(color: Colors.grey.shade300, width: 1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 36,
                            height: 36,
                            child: CustomPaint(painter: ShapePainter(s['key']!, Colors.deepPurple.shade700)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            s['label']!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.normal),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSingleShapeChangeDialog(VisualElement ve) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.65,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Change Shape', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 1.1,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: _allShapesList.length,
                itemBuilder: (context, idx) {
                  final s = _allShapesList[idx];
                  final isSel = (ve.shapeKey == s['key']);
                  return InkWell(
                    onTap: () {
                      Navigator.pop(ctx);
                      setState(() {
                        ve.shapeKey = s['key'];
                        _onQuestionsChanged();
                      });
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      decoration: BoxDecoration(
                        color: isSel ? Colors.deepPurple.shade50 : Colors.grey.shade50,
                        border: Border.all(color: isSel ? Colors.deepPurple : Colors.grey.shade300, width: isSel ? 2 : 1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 36,
                            height: 36,
                            child: CustomPaint(painter: ShapePainter(s['key']!, Colors.deepPurple.shade700)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            s['label']!,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 10, fontWeight: isSel ? FontWeight.bold : FontWeight.normal),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Unsaved Alert Navigation ---
  Future<void> _handleSavedPapersNavigation() async {
    if (_questions.isEmpty) {
      _showSavedPapersDialog();
      return;
    }

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 24),
            SizedBox(width: 8),
            Text('Unsaved Draft', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: const Text(
          'You have an unsaved question paper draft in progress.\nOpening saved papers will replace your current editor draft.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            onPressed: () => Navigator.pop(ctx, 'cancel'),
          ),
          TextButton(
            child: const Text('Discard & Open', style: TextStyle(color: Colors.red)),
            onPressed: () => Navigator.pop(ctx, 'discard'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.teal, foregroundColor: Colors.white),
            child: const Text('Save & Open'),
            onPressed: () async {
              await _saveDraft(showToast: true);
              if (ctx.mounted) Navigator.pop(ctx, 'save_open');
            },
          ),
        ],
      ),
    );

    if (result == 'discard' || result == 'save_open') {
      _showSavedPapersDialog();
    }
  }

  // --- Saved Papers Modal ---
  Future<void> _showSavedPapersDialog() async {
    final prefs = await SharedPreferences.getInstance();
    final savedJson = prefs.getString('qpd_saved_papers');
    List<dynamic> papers = savedJson != null ? json.decode(savedJson) : [];

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.7,
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Saved Question Papers',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const Divider(),
                  if (papers.isEmpty)
                    const Expanded(
                      child: Center(
                        child: Text(
                          'No saved question papers found.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    )
                  else
                    Expanded(
                      child: ListView.builder(
                        itemCount: papers.length,
                        itemBuilder: (context, index) {
                          final item = papers[index];
                          final title = item['paper_title'] ?? 'Untitled Paper';
                          final cls = item['class_name'] ?? 'Class';
                          final sub = item['subject_name'] ?? 'Subject';
                          final date = item['updated_at'] != null
                              ? item['updated_at'].toString().split('T').first
                              : '';

                          return Container(
                            margin: const EdgeInsets.symmetric(vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              border: Border.all(color: Colors.grey.shade200),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: Colors.indigo.shade50,
                                child: Icon(Icons.description_outlined, color: Colors.indigo.shade700),
                              ),
                              title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text('$cls • $sub • $date', style: const TextStyle(fontSize: 11)),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                    onPressed: () async {
                                      papers.removeAt(index);
                                      await prefs.setString('qpd_saved_papers', json.encode(papers));
                                      setModalState(() {});
                                    },
                                  ),
                                  const Icon(Icons.chevron_right, color: Colors.grey),
                                ],
                              ),
                              onTap: () {
                                Navigator.pop(ctx);
                                setState(() {
                                  _currentPaperId = item['id'];
                                  if (item['class_id'] != null) _selectedClassId = item['class_id'].toString();
                                  if (item['class_name'] != null) _selectedClassName = item['class_name'].toString();
                                  if (item['subject_id'] != null) _selectedSubjectId = item['subject_id'].toString();
                                  if (item['subject_name'] != null) _selectedSubjectName = item['subject_name'].toString();
                                  if (item['paper_title'] != null) _paperTitleController.text = item['paper_title'];
                                  if (item['exam_name'] != null) _examNameController.text = item['exam_name'];
                                  if (item['duration'] != null) _durationController.text = item['duration'];
                                  if (item['max_marks'] != null) _maxMarksController.text = item['max_marks'];
                                  if (item['instructions'] != null) _instructionsController.text = item['instructions'];

                                  if (item['questions'] is List) {
                                    _questions = (item['questions'] as List)
                                        .map((q) => QuestionBlock.fromJson(Map<String, dynamic>.from(q)))
                                        .toList();
                                  }
                                  _onQuestionsChanged();
                                });
                              },
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --- Full Screen Live Preview & PDF Actions ---
  void _openLivePreviewModal() {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (ctx) => Scaffold(
          backgroundColor: const Color(0xFFF1F5F9),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 1,
            leading: IconButton(
              icon: const Icon(Icons.close_rounded, color: Colors.black87, size: 28),
              onPressed: () => Navigator.pop(ctx),
            ),
            title: const Text(
              'Live Preview',
              style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 16),
            ),
            actions: [
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.indigo.shade700,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
                icon: const Icon(Icons.download_rounded, size: 16),
                label: const Text('Download', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                onPressed: () => _downloadPdf(ctx),
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
            child: Center(
              child: Container(
                width: 595.0,
                padding: const EdgeInsets.only(left: 28, right: 28, top: 32, bottom: 32),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(4),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 15, offset: const Offset(0, 6)),
                  ],
                ),
                clipBehavior: Clip.hardEdge,
                child: _buildPrintablePaperContent(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDisplayImageWidget(QuestionBlock q) {
    final path = q.imagePath ?? '';
    final size = q.imageSize;

    if (path.isNotEmpty && File(path).existsSync()) {
      return Container(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Image.file(File(path), width: size, fit: BoxFit.contain),
      );
    }
    if (path.startsWith('http')) {
      return Image.network(path, width: size, fit: BoxFit.contain);
    }

    return InkWell(
      onTap: () => _pickImageFromGallery(q),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: size,
        height: size * 0.65,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          border: Border.all(color: Colors.grey.shade300, width: 1.5),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_photo_alternate_rounded, size: 36, color: Colors.grey),
            SizedBox(height: 4),
            Text('Tap to select image from Gallery', style: TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildDisplayShapeWidget(QuestionBlock q) {
    final key = q.shapeKey ?? 'circle';
    final size = q.imageSize;

    return Container(
      width: size,
      height: size * 0.75,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: CustomPaint(
        painter: ShapePainter(key, Colors.black87),
        size: Size(size, size * 0.75),
      ),
    );
  }

  Widget _buildPrintablePaperContent() {
    int qCounter = 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _examNameController.text.toUpperCase(),
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 2),
        Text(
          _paperTitleController.text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.black87),
        ),
        const SizedBox(height: 12),

        // Meta info row
        Container(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.black87, width: 1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Class: ${_selectedClassName ?? "N/A"}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              Text('Subject: ${_selectedSubjectName ?? "N/A"}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              Text('Max Marks: ${_maxMarksController.text}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              Text('Time: ${_durationController.text}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        // Questions List
        ..._questions.map((q) {
          if (q.type == 'section') {
            qCounter = 1;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: Text(
                  q.text.toUpperCase(),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, decoration: TextDecoration.underline),
                ),
              ),
            );
          }
          if (q.type == 'heading') {
            qCounter = 1;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Text(
                q.text.toUpperCase(),
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
              ),
            );
          }
          if (q.type == 'group_instruction') {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                q.text,
                style: const TextStyle(fontSize: 10.5, fontStyle: FontStyle.italic, color: Colors.black87),
              ),
            );
          }

          // Check if auto question number should be omitted (mcq, matching, image, shape headings)
          final isNoPrefixType = (q.type == 'mcq' || q.type == 'matching' || q.type == 'image' || q.type == 'shape');
          String prefixText = '';
          if (!isNoPrefixType) {
            prefixText = 'Q ${qCounter++}. ';
          }

          final alignEnum = q.imageAlignment == 'left'
              ? Alignment.centerLeft
              : q.imageAlignment == 'right'
                  ? Alignment.centerRight
                  : Alignment.center;

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (prefixText.isNotEmpty)
                      Text(prefixText, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: q.text, style: TextStyle(fontSize: 11.5, fontWeight: isNoPrefixType ? FontWeight.bold : FontWeight.w500)),
                            if (q.type == 'true_false')
                              const TextSpan(
                                text: '  (True/False)',
                                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold),
                              ),
                          ],
                        ),
                      ),
                    ),
                    if (q.marks > 0)
                      Text(
                        '${q.marks.toInt() == q.marks ? q.marks.toInt() : q.marks} Marks',
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold),
                      ),
                  ],
                ),

                // Visual Elements (Images & Shapes) - Exact Positioned Stack matching Editor Mode
                if (q.visualElements.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Builder(
                    builder: (ctx) {
                      double maxExtentY = 100.0;
                      for (final ve in q.visualElements) {
                        final hNeeded = ve.offsetY + (ve.size * 0.75) + 10.0;
                        if (hNeeded > maxExtentY) maxExtentY = hNeeded;
                      }

                      return SizedBox(
                        height: maxExtentY,
                        width: 539.0,
                        child: Stack(
                          clipBehavior: Clip.hardEdge,
                          children: q.visualElements.map((ve) {
                            final effectiveW = ve.size;

                            return Positioned(
                              left: ve.offsetX,
                              top: ve.offsetY,
                              child: _buildSingleVisualElementPreviewWithWidth(ve, effectiveW),
                            );
                          }).toList(),
                        ),
                      );
                    },
                  ),
                ],
                if (q.bottomText.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    q.bottomText,
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500),
                  ),
                ],

                // MCQ Options: strictly 2 options per line (2 top, 2 bottom)
                if (q.type == 'mcq' && q.options.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.only(left: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (int i = 0; i < q.options.length; i += 2)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    '(${String.fromCharCode(97 + i)}) ${q.options[i]}',
                                    style: const TextStyle(fontSize: 10.5),
                                  ),
                                ),
                                if (i + 1 < q.options.length)
                                  Expanded(
                                    child: Text(
                                      '(${String.fromCharCode(97 + i + 1)}) ${q.options[i + 1]}',
                                      style: const TextStyle(fontSize: 10.5),
                                    ),
                                  )
                                else
                                  const Spacer(),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ],

                // Matching Columns
                if (q.type == 'matching') ...[
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.only(left: 20),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: q.leftMatching.asMap().entries.map((e) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Text('${e.key + 1}. ${e.value}', style: const TextStyle(fontSize: 10.5)),
                              );
                            }).toList(),
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: q.rightMatching.asMap().entries.map((e) {
                              final labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                              final lbl = e.key < labels.length ? labels[e.key] : '${e.key + 1}';
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Text('$lbl. ${e.value}', style: const TextStyle(fontSize: 10.5)),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Future<pw.MemoryImage> _createShapePdfImage(String shapeKey, double width, double height) async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final painter = ShapePainter(shapeKey, Colors.black);
    final w = width.clamp(30.0, 600.0);
    final h = height.clamp(20.0, 500.0);
    painter.paint(canvas, Size(w, h));
    final picture = recorder.endRecording();
    final img = await picture.toImage(w.toInt(), h.toInt());
    final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
    return pw.MemoryImage(byteData!.buffer.asUint8List());
  }

  Future<pw.Document> _buildPdfDocument() async {
    final pdf = pw.Document();
    int qCounter = 1;

    final Map<String, pw.MemoryImage> shapePdfCache = {};
    for (final q in _questions) {
      for (final ve in q.visualElements) {
        if (ve.type == 'shape' && ve.shapeKey != null) {
          final cacheKey = '${ve.shapeKey}_${ve.size}';
          if (!shapePdfCache.containsKey(cacheKey)) {
            try {
              shapePdfCache[cacheKey] = await _createShapePdfImage(ve.shapeKey!, ve.size, ve.size * 0.75);
            } catch (e) {
              debugPrint('Error generating PDF shape image: $e');
            }
          }
        }
      }
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.only(left: 28, right: 28, top: 32, bottom: 32),
        build: (pw.Context ctx) {
          return [
            pw.Text(
              _examNameController.text.toUpperCase(),
              style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
              textAlign: pw.TextAlign.center,
            ),
            pw.SizedBox(height: 2),
            pw.Text(
              _paperTitleController.text,
              style: pw.TextStyle(fontSize: 11, fontStyle: pw.FontStyle.italic),
              textAlign: pw.TextAlign.center,
            ),
            pw.SizedBox(height: 10),

            pw.Container(
              padding: const pw.EdgeInsets.all(6),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(width: 1),
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('Class: ${_selectedClassName ?? "N/A"}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Subject: ${_selectedSubjectName ?? "N/A"}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Max Marks: ${_maxMarksController.text}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Time: ${_durationController.text}', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ),
            // Questions List
            ..._questions.map((q) {
              if (q.type == 'section') {
                qCounter = 1;
                return pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 8),
                  child: pw.Center(
                    child: pw.Text(
                      q.text.toUpperCase(),
                      style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
                    ),
                  ),
                );
              }
              if (q.type == 'heading') {
                qCounter = 1;
                return pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 4),
                  child: pw.Text(
                    q.text.toUpperCase(),
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                  ),
                );
              }
              if (q.type == 'group_instruction') {
                return pw.Padding(
                  padding: const pw.EdgeInsets.symmetric(vertical: 2),
                  child: pw.Text(
                    q.text,
                    style: pw.TextStyle(fontSize: 9.5, fontStyle: pw.FontStyle.italic),
                  ),
                );
              }

              final isNoPrefixType = (q.type == 'mcq' || q.type == 'matching' || q.type == 'image' || q.type == 'shape');
              final prefixText = isNoPrefixType ? '' : 'Q ${qCounter++}. ';

              return pw.Padding(
                padding: const pw.EdgeInsets.symmetric(vertical: 4),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Row(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        if (prefixText.isNotEmpty)
                          pw.Text(prefixText, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold)),
                        pw.Expanded(
                          child: pw.RichText(
                            text: pw.TextSpan(
                              children: [
                                pw.TextSpan(text: q.text, style: pw.TextStyle(fontSize: 10.5, fontWeight: isNoPrefixType ? pw.FontWeight.bold : pw.FontWeight.normal)),
                                if (q.type == 'true_false')
                                  pw.TextSpan(
                                    text: '  (True/False)',
                                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        if (q.marks > 0)
                          pw.Text(
                            '${q.marks.toInt() == q.marks ? q.marks.toInt() : q.marks} Marks',
                            style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold),
                          ),
                      ],
                    ),
                    if (q.visualElements.isNotEmpty) ...[
                      pw.SizedBox(height: 4),
                      pw.Builder(
                        builder: (pw.Context ctx) {
                          double maxExtentY = 100.0;
                          for (final ve in q.visualElements) {
                            final hNeeded = ve.offsetY + (ve.size * 0.75) + 10.0;
                            if (hNeeded > maxExtentY) maxExtentY = hNeeded;
                          }

                          return pw.SizedBox(
                            height: maxExtentY,
                            width: 539.0,
                            child: pw.Stack(
                              children: q.visualElements.map((ve) {
                                final effectiveW = ve.size;

                                if (ve.type == 'image' && ve.imagePath != null && ve.imagePath!.isNotEmpty && File(ve.imagePath!).existsSync()) {
                                  try {
                                    final bytes = File(ve.imagePath!).readAsBytesSync();
                                    final pdfImg = pw.MemoryImage(bytes);
                                    return pw.Positioned(
                                      left: ve.offsetX,
                                      top: ve.offsetY,
                                      child: pw.Image(pdfImg, width: effectiveW, fit: pw.BoxFit.contain),
                                    );
                                  } catch (e) {
                                    return pw.SizedBox();
                                  }
                                } else if (ve.type == 'shape' && ve.shapeKey != null) {
                                  final cacheKey = '${ve.shapeKey}_${ve.size}';
                                  final shapeImg = shapePdfCache[cacheKey];
                                  if (shapeImg != null) {
                                    return pw.Positioned(
                                      left: ve.offsetX,
                                      top: ve.offsetY,
                                      child: pw.Image(shapeImg, width: effectiveW, fit: pw.BoxFit.contain),
                                    );
                                  }
                                }
                                return pw.SizedBox();
                              }).toList(),
                            ),
                          );
                        },
                      ),
                    ],
                    if (q.bottomText.isNotEmpty) ...[
                      pw.SizedBox(height: 3),
                      pw.Text(
                        q.bottomText,
                        style: const pw.TextStyle(fontSize: 10),
                      ),
                    ],
                    if (q.type == 'mcq' && q.options.isNotEmpty) ...[
                      pw.SizedBox(height: 3),
                      pw.Padding(
                        padding: const pw.EdgeInsets.only(left: 18),
                        child: pw.Column(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            for (int i = 0; i < q.options.length; i += 2)
                              pw.Padding(
                                padding: const pw.EdgeInsets.symmetric(vertical: 1.5),
                                child: pw.Row(
                                  children: [
                                    pw.Expanded(
                                      child: pw.Text(
                                        '(${String.fromCharCode(97 + i)}) ${q.options[i]}',
                                        style: const pw.TextStyle(fontSize: 9.5),
                                      ),
                                    ),
                                    if (i + 1 < q.options.length)
                                      pw.Expanded(
                                        child: pw.Text(
                                          '(${String.fromCharCode(97 + i + 1)}) ${q.options[i + 1]}',
                                          style: const pw.TextStyle(fontSize: 9.5),
                                        ),
                                      )
                                    else
                                      pw.Spacer(),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }).toList(),
          ];
        },
      ),
    );

    return pdf;
  }

  Future<void> _downloadPdf(BuildContext context) async {
    try {
      final pdf = await _buildPdfDocument();
      final bytes = await pdf.save();
      final cls = (_selectedClassName != null && _selectedClassName!.trim().isNotEmpty) ? _selectedClassName!.trim() : 'Class';
      final sub = (_selectedSubjectName != null && _selectedSubjectName!.trim().isNotEmpty) ? _selectedSubjectName!.trim() : 'Subject';
      final rawName = '$cls - $sub';
      final cleanedName = rawName.replaceAll(RegExp(r'[\\/:*?"<>|]'), '').trim();
      final fileName = '${cleanedName.isEmpty ? "Question_Paper" : cleanedName}.pdf';

      bool savedViaChannel = false;

      // Primary: Save via Android MediaStore channel so it shows up in File Manager Downloads
      if (Platform.isAndroid) {
        try {
          final channel = MethodChannel('com.shikshapilot.schoolhub/battery');
          final result = await channel.invokeMethod('saveFileToDownloads', {
            'fileName': fileName,
            'bytes': bytes,
          });
          if (result != null) {
            savedViaChannel = true;
          }
        } catch (e) {
          debugPrint('Native saveFileToDownloads failed: $e');
        }
      }

      // Fallback: Direct IO write to Downloads folder
      if (!savedViaChannel) {
        Directory? saveDir;
        if (Platform.isAndroid) {
          saveDir = Directory('/storage/emulated/0/Download');
          if (!await saveDir.exists()) {
            saveDir = await getExternalStorageDirectory();
          }
        } else {
          saveDir = await getApplicationDocumentsDirectory();
        }

        if (saveDir != null) {
          final filePath = '${saveDir.path}/$fileName';
          final file = File(filePath);
          await file.writeAsBytes(bytes);
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'PDF downloaded successfully! ($fileName)',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ],
            ),
            backgroundColor: Colors.teal.shade800,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      debugPrint('Error downloading PDF: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to download PDF'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 3),
          ),
        );
      }
    }
  }

  // --- Main Build UI ---
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text(
          'Question Paper Designer',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Colors.black87),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.indigo.shade700,
        foregroundColor: Colors.white,
        elevation: 4,
        icon: const Icon(Icons.visibility_rounded),
        label: const Text('Live Preview', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _openLivePreviewModal,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  if (_selectedVisualElementId != null || _resizingVisualElementId != null) {
                    setState(() {
                      _selectedVisualElementId = null;
                      _resizingVisualElementId = null;
                    });
                  }
                },
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.only(left: 14, right: 14, top: 14, bottom: 84),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildConfigurationCard(),
                      const SizedBox(height: 16),
                      _buildQuickBlocksPanel(),
                      const SizedBox(height: 16),
                      _buildQuestionsListHeader(),
                      const SizedBox(height: 10),
                      _buildQuestionsCardList(),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildConfigurationCard() {
    final effectiveClasses = _classes.isNotEmpty ? _classes : _fallbackClasses;
    final effectiveSubjects = _subjects.isNotEmpty ? _subjects : _fallbackSubjects;

    final safeClassValue = effectiveClasses.any((c) => c['id'].toString() == _selectedClassId)
        ? _selectedClassId
        : (effectiveClasses.isNotEmpty ? effectiveClasses.first['id'].toString() : null);

    final safeSubjectValue = effectiveSubjects.any((s) => s['id'].toString() == _selectedSubjectId)
        ? _selectedSubjectId
        : (effectiveSubjects.isNotEmpty ? effectiveSubjects.first['id'].toString() : null);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.tune_rounded, color: Colors.indigo.shade700, size: 20),
              const SizedBox(width: 8),
              const Text('Paper Configuration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 12),

          // Class & Subject Row
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: safeClassValue,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Select Class *',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    border: OutlineInputBorder(),
                  ),
                  items: effectiveClasses.map((c) {
                    final shortName = formatShortClassName(c['name']?.toString(), section: c['section']?.toString());
                    return DropdownMenuItem<String>(
                      value: c['id'].toString(),
                      child: Text(shortName, overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) _onClassSelected(val);
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: safeSubjectValue,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Select Subject *',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    border: OutlineInputBorder(),
                  ),
                  items: effectiveSubjects.map((s) {
                    return DropdownMenuItem<String>(
                      value: s['id'].toString(),
                      child: Text(s['name']?.toString() ?? 'Subject', overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: (val) {
                    setState(() {
                      _selectedSubjectId = val;
                      final matched = effectiveSubjects.firstWhere((sub) => sub['id'].toString() == val, orElse: () => null);
                      if (matched != null) _selectedSubjectName = matched['name']?.toString();
                    });
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Title & Exam Name
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _paperTitleController,
                  decoration: const InputDecoration(
                    labelText: 'Paper Title',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _examNameController,
                  decoration: const InputDecoration(
                    labelText: 'Exam Name',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Duration & Max Marks
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _durationController,
                  decoration: const InputDecoration(
                    labelText: 'Duration',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _maxMarksController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Max Marks',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickBlocksPanel() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Quick Add Blocks:',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: [
              _buildBlockChip('+ MCQ', 'mcq', Colors.blue),
              _buildBlockChip('+ True/False', 'true_false', Colors.teal),
              _buildBlockChip('+ Fill Blank', 'fill_blanks', Colors.indigo),
              _buildBlockChip('+ Matching', 'matching', Colors.purple),
              _buildBlockChip('+ Short Q', 'short_answer', Colors.deepOrange),
              _buildBlockChip('+ Long Q', 'long_answer', Colors.pink),
              _buildBlockChip('+ Image', 'image', Colors.amber.shade800),
              _buildBlockChip('+ Shapes', 'shape', Colors.deepPurple),
              _buildBlockChip('+ Section', 'section', Colors.green),
              _buildBlockChip('+ Heading', 'heading', Colors.blueGrey),
              _buildBlockChip('+ Instruction', 'group_instruction', Colors.brown),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildBlockChip(String label, String type, Color color) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ActionChip(
        avatar: Icon(Icons.add, size: 16, color: color),
        label: Text(label, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: color)),
        backgroundColor: color.withOpacity(0.08),
        side: BorderSide(color: color.withOpacity(0.3)),
        onPressed: () => _addQuestion(type),
      ),
    );
  }

  Widget _buildQuestionsListHeader() {
    final targetMax = double.tryParse(_maxMarksController.text) ?? 100.0;
    final totalCalc = _totalMarksCalculated;
    final isMatch = (totalCalc == targetMax);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Questions List (${_questions.length})',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: isMatch ? Colors.green.shade50 : Colors.amber.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isMatch ? Colors.green.shade300 : Colors.amber.shade300),
          ),
          child: Text(
            'Total: ${totalCalc.toInt() == totalCalc ? totalCalc.toInt() : totalCalc} / ${targetMax.toInt()}',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 12,
              color: isMatch ? Colors.green.shade800 : Colors.amber.shade900,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildQuestionsCardList() {
    if (_questions.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(Icons.post_add_rounded, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 8),
            const Text(
              'No questions added yet.',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
            ),
            const SizedBox(height: 4),
            const Text(
              'Tap any Quick Add Block above to build your question paper.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _questions.length,
      itemBuilder: (context, index) {
        final q = _questions[index];
        return _buildQuestionEditorCard(q, index);
      },
    );
  }

  Widget _buildQuestionEditorCard(QuestionBlock q, int index) {
    final isHeaderType = (q.type == 'section' || q.type == 'heading' || q.type == 'group_instruction');
    final isFocused = (_focusedBlockId == q.id);

    return InkWell(
      onTap: () {
        setState(() {
          _focusedBlockId = q.id;
          _selectedVisualElementId = null;
          _resizingVisualElementId = null;
        });
      },
      borderRadius: BorderRadius.circular(14),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isHeaderType ? Colors.indigo.shade50.withOpacity(0.4) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isFocused
                ? Colors.deepPurple
                : (isHeaderType ? Colors.indigo.shade200 : Colors.grey.shade300),
            width: isFocused ? 2.0 : 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: isFocused ? Colors.deepPurple.withOpacity(0.12) : Colors.black.withOpacity(0.02),
              blurRadius: isFocused ? 10 : 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Bar
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: isHeaderType ? Colors.indigo.shade100 : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    q.type.replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.arrow_upward, size: 18),
                  onPressed: index > 0 ? () => _moveQuestion(index, -1) : null,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.arrow_downward, size: 18),
                  onPressed: index < _questions.length - 1 ? () => _moveQuestion(index, 1) : null,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18, color: Colors.blue),
                  onPressed: () => _duplicateQuestion(index),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Colors.red),
                  onPressed: () => _deleteQuestion(index),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: Icon(
                    q.isCollapsed ? Icons.expand_more_rounded : Icons.expand_less_rounded,
                    size: 22,
                    color: Colors.indigo.shade700,
                  ),
                  tooltip: q.isCollapsed ? 'Expand' : 'Collapse',
                  onPressed: () {
                    setState(() {
                      q.isCollapsed = !q.isCollapsed;
                      if (!q.isCollapsed) _focusedBlockId = q.id;
                    });
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            if (q.isCollapsed) ...[
              const SizedBox(height: 6),
              InkWell(
                onTap: () {
                  setState(() {
                    q.isCollapsed = false;
                    _focusedBlockId = q.id;
                  });
                },
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          q.text.trim().isEmpty ? '(No title/text entered)' : q.text,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: q.text.trim().isEmpty ? Colors.grey : Colors.black87,
                          ),
                        ),
                      ),
                      if (!isHeaderType && q.marks > 0) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.indigo.shade50,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '${q.marks.toInt() == q.marks ? q.marks.toInt() : q.marks} Marks',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.indigo.shade800),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ] else ...[
              const SizedBox(height: 8),
              // Unified Question Content Container Box
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(
                    color: isFocused ? Colors.indigo.shade600 : Colors.grey.shade400,
                    width: isFocused ? 1.5 : 1.0,
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            initialValue: q.text,
                            maxLines: null,
                            decoration: InputDecoration(
                              labelText: isHeaderType ? 'Header / Instruction Text' : 'Question / Heading Text',
                              isDense: true,
                              border: InputBorder.none,
                            ),
                            onTap: () {
                              if (_focusedBlockId != q.id) {
                                setState(() {
                                  _focusedBlockId = q.id;
                                });
                              }
                            },
                            onChanged: (val) {
                              q.text = val;
                              _onQuestionsChanged();
                            },
                          ),
                        ),
                        if (!isHeaderType) ...[
                          const SizedBox(width: 8),
                          SizedBox(
                            width: 70,
                            child: TextFormField(
                              initialValue: q.marks == 0 ? '' : q.marks.toString(),
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Marks',
                                isDense: true,
                                border: OutlineInputBorder(),
                              ),
                              onTap: () {
                                if (_focusedBlockId != q.id) {
                                  setState(() {
                                    _focusedBlockId = q.id;
                                  });
                                }
                              },
                              onChanged: (val) {
                                setState(() {
                                  q.marks = double.tryParse(val) ?? 0.0;
                                  _onQuestionsChanged();
                                });
                              },
                            ),
                          ),
                        ],
                      ],
                    ),

                    // Embedded Media & Visual Elements (Inside Question Content Box)
                    if (q.visualElements.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Divider(height: 1, color: Colors.indigo.shade100),
                      _buildMediaAndVisualElementsSection(q),
                    ],

                    // Text Below Images/Shapes (Inside Question Content Box)
                    if (q.visualElements.isNotEmpty || q.bottomText.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      const Divider(height: 1, color: Colors.grey),
                      const SizedBox(height: 4),
                      TextFormField(
                        initialValue: q.bottomText,
                        maxLines: null,
                        decoration: const InputDecoration(
                          hintText: 'Type text below image / shape (e.g. My text)...',
                          isDense: true,
                          border: InputBorder.none,
                        ),
                        onTap: () {
                          if (_focusedBlockId != q.id) {
                            setState(() {
                              _focusedBlockId = q.id;
                            });
                          }
                        },
                        onChanged: (val) {
                          q.bottomText = val;
                          _onQuestionsChanged();
                        },
                      ),
                    ],

                    const SizedBox(height: 6),
                    Row(
                      children: [
                        InkWell(
                          onTap: () => _pickImageFromGallery(q),
                          borderRadius: BorderRadius.circular(6),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.add_a_photo_rounded, size: 13, color: Colors.indigo),
                                SizedBox(width: 4),
                                Text('+ Add Image', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.indigo)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        InkWell(
                          onTap: () => _showShapeSelectorDialog(q),
                          borderRadius: BorderRadius.circular(6),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.category_rounded, size: 13, color: Colors.deepPurple),
                                SizedBox(width: 4),
                                Text('+ Add Shape', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            // MCQ Options Editor
            if (q.type == 'mcq') ...[
              const SizedBox(height: 10),
              const Text('Options (2 options per row in paper):', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
              const SizedBox(height: 4),
              ...q.options.asMap().entries.map((optEntry) {
                final labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                final label = optEntry.key < labels.length ? labels[optEntry.key] : '${optEntry.key + 1}';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: Colors.indigo.shade50,
                        child: Text(label, style: TextStyle(fontSize: 11, color: Colors.indigo.shade800, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          initialValue: optEntry.value,
                          decoration: const InputDecoration(
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (val) {
                            q.options[optEntry.key] = val;
                            _onQuestionsChanged();
                          },
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 16, color: Colors.red),
                        onPressed: () {
                          setState(() {
                            q.options.removeAt(optEntry.key);
                            _onQuestionsChanged();
                          });
                        },
                      ),
                    ],
                  ),
                );
              }).toList(),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Option'),
                  onPressed: () {
                    setState(() {
                      final nextLabel = String.fromCharCode(65 + (q.options.length % 26));
                      q.options.add('Option $nextLabel');
                      _onQuestionsChanged();
                    });
                  },
                ),
              ),
            ],

            // Matching Columns Editor (Dynamic Pair Length)
            if (q.type == 'matching') ...[
              const SizedBox(height: 10),
              const Text('Matching Column Pairs:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
              const SizedBox(height: 4),
              ...List.generate(
                q.leftMatching.length > q.rightMatching.length ? q.leftMatching.length : q.rightMatching.length,
                (idx) {
                  final leftVal = idx < q.leftMatching.length ? q.leftMatching[idx] : '';
                  final rightVal = idx < q.rightMatching.length ? q.rightMatching[idx] : '';
                  final rightLabel = String.fromCharCode(97 + (idx % 26));

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      children: [
                        Text('${idx + 1}. ', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        Expanded(
                          child: TextFormField(
                            initialValue: leftVal,
                            decoration: const InputDecoration(hintText: 'Left item', isDense: true, border: OutlineInputBorder()),
                            onChanged: (val) {
                              while (q.leftMatching.length <= idx) q.leftMatching.add('');
                              q.leftMatching[idx] = val;
                              _onQuestionsChanged();
                            },
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text('$rightLabel.', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.indigo)),
                        ),
                        Expanded(
                          child: TextFormField(
                            initialValue: rightVal,
                            decoration: const InputDecoration(hintText: 'Right item', isDense: true, border: OutlineInputBorder()),
                            onChanged: (val) {
                              while (q.rightMatching.length <= idx) q.rightMatching.add('');
                              q.rightMatching[idx] = val;
                              _onQuestionsChanged();
                            },
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                          onPressed: () {
                            setState(() {
                              if (idx < q.leftMatching.length) q.leftMatching.removeAt(idx);
                              if (idx < q.rightMatching.length) q.rightMatching.removeAt(idx);
                              _onQuestionsChanged();
                            });
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add Pair'),
                  onPressed: () {
                    setState(() {
                      final nextNum = q.leftMatching.length + 1;
                      final nextChar = String.fromCharCode(65 + (q.rightMatching.length % 26));
                      q.leftMatching.add('Item $nextNum');
                      q.rightMatching.add('Matching $nextChar');
                      _onQuestionsChanged();
                    });
                  },
                ),
              ),
            ],
          ],
        ],
      ),
    ),
  );
}

  Widget _buildMediaAndVisualElementsSection(QuestionBlock q) {
    if (q.visualElements.isEmpty) return const SizedBox.shrink();

    double maxExtentY = 120.0;
    for (final ve in q.visualElements) {
      final hNeeded = ve.offsetY + (ve.size * 0.75) + 36.0;
      if (hNeeded > maxExtentY) maxExtentY = hNeeded;
    }

    // Z-Index Sorting: Selected/Resizing elements are rendered LAST so their resize handles/line float ON TOP of all other elements!
    final sortedEntries = q.visualElements.asMap().entries.toList();
    sortedEntries.sort((a, b) {
      final aActive = (a.value.id == _selectedVisualElementId || a.value.id == _resizingVisualElementId);
      final bActive = (b.value.id == _selectedVisualElementId || b.value.id == _resizingVisualElementId);
      if (aActive && !bActive) return 1;
      if (!aActive && bActive) return -1;
      return 0;
    });

    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 4, left: 8, right: 54),
      child: SizedBox(
        height: maxExtentY,
        width: double.infinity,
        child: Stack(
          clipBehavior: Clip.none,
          children: sortedEntries.map((entry) {
            final idx = entry.key;
            final ve = entry.value;
            return Positioned(
              left: ve.offsetX,
              top: ve.offsetY,
              child: _buildInteractiveVisualElementTile(q, ve, idx),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildInteractiveVisualElementTile(QuestionBlock q, VisualElement ve, int idx) {
    final isSelected = (_selectedVisualElementId == ve.id);
    final isResizing = (_resizingVisualElementId == ve.id);
    final isImage = (ve.type == 'image');

    final aspectFactor = 0.75;
    final displayWidth = ve.size;
    final displayHeight = ve.size * aspectFactor;

    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: (event) {
        _isPointerOnVisualElement = true;
      },
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onPanStart: (details) {
          _isPointerOnVisualElement = true;
          if (_selectedVisualElementId != ve.id) {
            setState(() {
              _selectedVisualElementId = ve.id;
              _focusedBlockId = q.id;
            });
          }
        },
        onTap: () {
          _isPointerOnVisualElement = true;
          setState(() {
            _selectedVisualElementId = ve.id;
            _focusedBlockId = q.id;
          });
        },
        onPanUpdate: (details) {
          _isPointerOnVisualElement = true;
          setState(() {
            ve.offsetX = (ve.offsetX + details.delta.dx).clamp(0.0, 480.0);
            ve.offsetY = (ve.offsetY + details.delta.dy).clamp(0.0, 1000.0);
            _onQuestionsChanged();
          });
        },
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(
                  color: isSelected
                      ? Colors.deepPurple
                      : (isImage ? Colors.amber.shade400 : Colors.deepPurple.shade200),
                  width: isSelected ? 2.5 : 1.0,
                ),
                borderRadius: BorderRadius.circular(10),
                boxShadow: isSelected
                    ? [BoxShadow(color: Colors.deepPurple.withOpacity(0.25), blurRadius: 8, offset: const Offset(0, 2))]
                    : [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1))],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildSingleVisualElementPreview(ve),
                ],
              ),
            ),
            if (isSelected) ...[
              // Floating Dimension Badge (Width x Height)
              Positioned(
                top: -24,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.deepPurple.shade900,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                    ),
                    child: Text(
                      'W: ${displayWidth.toInt()}px × H: ${displayHeight.toInt()}px',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                ),
              ),
              // Top-Right Delete Action Handle (40px hit area)
              Positioned(
                top: -16,
                right: -16,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    setState(() {
                      q.visualElements.removeAt(idx);
                      if (_selectedVisualElementId == ve.id) _selectedVisualElementId = null;
                      if (_resizingVisualElementId == ve.id) _resizingVisualElementId = null;
                      _onQuestionsChanged();
                    });
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    color: Colors.transparent,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                          boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                        ),
                        child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
              // Top-Left Edit Shape Handle (for shape elements) (40px hit area)
              if (!isImage)
                Positioned(
                  top: -16,
                  left: -16,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _showSingleShapeChangeDialog(ve),
                    child: Container(
                      width: 40,
                      height: 40,
                      color: Colors.transparent,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Colors.deepPurple,
                            shape: BoxShape.circle,
                            boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
                          ),
                          child: const Icon(Icons.edit_rounded, size: 14, color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ),
              // Bottom-Right Corner 50% Larger 'S' Knob for Smooth Direct Drag Resizing
              Positioned(
                bottom: -22,
                right: -22,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onPanStart: (details) {
                    _isPointerOnVisualElement = true;
                    _isPointerOnResizeLine = true;
                    _dragStartGlobalPos = details.globalPosition;
                    _dragStartVeSize = ve.size;
                    if (_selectedVisualElementId != ve.id) {
                      setState(() {
                        _selectedVisualElementId = ve.id;
                        _focusedBlockId = q.id;
                      });
                    }
                  },
                  onPanUpdate: (details) {
                    _isPointerOnVisualElement = true;
                    _isPointerOnResizeLine = true;
                    if (_dragStartGlobalPos != null) {
                      final dx = details.globalPosition.dx - _dragStartGlobalPos!.dx;
                      final dy = details.globalPosition.dy - _dragStartGlobalPos!.dy;
                      final dragDistance = (dx + dy) * 0.85;
                      final newSize = (_dragStartVeSize + dragDistance).clamp(30.0, 520.0);
                      setState(() {
                        ve.size = newSize;
                        _onQuestionsChanged();
                      });
                    }
                  },
                  onPanEnd: (_) {
                    _dragStartGlobalPos = null;
                  },
                  onPanCancel: () {
                    _dragStartGlobalPos = null;
                  },
                  child: Container(
                    width: 56,
                    height: 56,
                    color: Colors.transparent,
                    child: Center(
                      child: Container(
                        width: 42,
                        height: 42,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.deepPurple.shade800,
                          shape: BoxShape.circle,
                          boxShadow: const [
                            BoxShadow(color: Colors.black45, blurRadius: 6, offset: Offset(0, 2)),
                          ],
                          border: Border.all(color: Colors.white, width: 2.0),
                        ),
                        child: const Text(
                          'S',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            height: 1.0,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSingleVisualElementPreview(VisualElement ve) {
    if (ve.type == 'image') {
      final path = ve.imagePath ?? '';
      final size = ve.size;
      if (path.isNotEmpty && File(path).existsSync()) {
        return Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Image.file(File(path), width: size, fit: BoxFit.contain),
        );
      }
      if (path.startsWith('http')) {
        return Image.network(path, width: size, fit: BoxFit.contain);
      }
      return Container(
        width: size,
        height: size * 0.6,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Center(
          child: Text('Image not found', style: TextStyle(fontSize: 10, color: Colors.grey)),
        ),
      );
    } else {
      final key = ve.shapeKey ?? 'circle';
      final size = ve.size;
      return Container(
        width: size,
        height: size * 0.75,
        child: CustomPaint(
          painter: ShapePainter(key, Colors.black87),
          size: Size(size, size * 0.75),
        ),
      );
    }
  }

  Widget _buildSingleVisualElementPreviewWithWidth(VisualElement ve, double targetWidth) {
    final aspectFactor = 0.75;
    final displayWidth = targetWidth;
    final displayHeight = targetWidth * aspectFactor;

    if (ve.type == 'image') {
      final path = ve.imagePath ?? '';
      if (path.isNotEmpty && File(path).existsSync()) {
        return Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Image.file(File(path), width: displayWidth, height: displayHeight, fit: BoxFit.contain),
        );
      }
      if (path.startsWith('http')) {
        return Image.network(path, width: displayWidth, height: displayHeight, fit: BoxFit.contain);
      }
      return Container(
        width: displayWidth,
        height: displayHeight,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(6),
        ),
        child: const Center(
          child: Text('Image not found', style: TextStyle(fontSize: 10, color: Colors.grey)),
        ),
      );
    } else {
      final key = ve.shapeKey ?? 'circle';
      return SizedBox(
        width: displayWidth,
        height: displayHeight,
        child: CustomPaint(
          painter: ShapePainter(key, Colors.black87),
          size: Size(displayWidth, displayHeight),
        ),
      );
    }
  }
}

// --- Custom Painter for All Geometric Shapes ---
class ShapePainter extends CustomPainter {
  final String shapeKey;
  final Color color;

  ShapePainter(this.shapeKey, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final w = size.width;
    final h = size.height;
    const m = 1.5;

    switch (shapeKey) {
      case 'circle':
        final r = ((w < h ? w : h) / 2) - m;
        canvas.drawCircle(Offset(w / 2, h / 2), r, paint);
        break;
      case 'square':
        final side = (w < h ? w : h) - 2 * m;
        final rect = Rect.fromCenter(center: Offset(w / 2, h / 2), width: side, height: side);
        canvas.drawRect(rect, paint);
        break;
      case 'rectangle':
        final rect = Rect.fromLTWH(m, m, w - 2 * m, h - 2 * m);
        canvas.drawRect(rect, paint);
        break;
      case 'triangle':
        final path = Path()
          ..moveTo(w / 2, m)
          ..lineTo(w - m, h - m)
          ..lineTo(m, h - m)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'right_triangle':
        final path = Path()
          ..moveTo(m, m)
          ..lineTo(m, h - m)
          ..lineTo(w - m, h - m)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'oval':
        final rect = Rect.fromLTWH(m, m, w - 2 * m, h - 2 * m);
        canvas.drawOval(rect, paint);
        break;
      case 'star':
        final path = Path();
        final cx = w / 2;
        final cy = h / 2;
        final outerR = ((w < h ? w : h) / 2) - m;
        final innerR = outerR * 0.45;
        for (int i = 0; i < 10; i++) {
          final r = i.isEven ? outerR : innerR;
          final angle = (i * 36 - 90) * (3.141592653589793 / 180);
          final x = cx + r * cos(angle);
          final y = cy + r * sin(angle);
          if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.close();
        canvas.drawPath(path, paint);
        break;
      case 'pentagon':
        _drawPolygon(canvas, size, 5, paint);
        break;
      case 'hexagon':
        _drawPolygon(canvas, size, 6, paint);
        break;
      case 'octagon':
        _drawPolygon(canvas, size, 8, paint);
        break;
      case 'diamond':
        final path = Path()
          ..moveTo(w / 2, m)
          ..lineTo(w - m, h / 2)
          ..lineTo(w / 2, h - m)
          ..lineTo(m, h / 2)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'parallelogram':
        final path = Path()
          ..moveTo(w * 0.25, m)
          ..lineTo(w - m, m)
          ..lineTo(w * 0.75, h - m)
          ..lineTo(m, h - m)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'trapezoid':
        final path = Path()
          ..moveTo(w * 0.2, m)
          ..lineTo(w * 0.8, m)
          ..lineTo(w - m, h - m)
          ..lineTo(m, h - m)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'arrow_right':
        final path = Path()
          ..moveTo(m, h * 0.3)
          ..lineTo(w * 0.55, h * 0.3)
          ..lineTo(w * 0.55, m)
          ..lineTo(w - m, h / 2)
          ..lineTo(w * 0.55, h - m)
          ..lineTo(w * 0.55, h * 0.7)
          ..lineTo(m, h * 0.7)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'arrow_up':
        final path = Path()
          ..moveTo(w * 0.3, h - m)
          ..lineTo(w * 0.3, h * 0.45)
          ..lineTo(m, h * 0.45)
          ..lineTo(w / 2, m)
          ..lineTo(w - m, h * 0.45)
          ..lineTo(w * 0.7, h * 0.45)
          ..lineTo(w * 0.7, h - m)
          ..close();
        canvas.drawPath(path, paint);
        break;
      case 'line':
        canvas.drawLine(Offset(m, h / 2), Offset(w - m, h / 2), paint);
        break;
      case 'parallel_lines':
        canvas.drawLine(Offset(m, h * 0.3), Offset(w - m, h * 0.3), paint);
        canvas.drawLine(Offset(m, h * 0.7), Offset(w - m, h * 0.7), paint);
        break;
      case 'angle':
        canvas.drawLine(Offset(m, m), Offset(m, h - m), paint);
        canvas.drawLine(Offset(m, h - m), Offset(w - m, h - m), paint);
        break;
      case 'cube':
        final fRect = Rect.fromLTWH(m, h * 0.25, w * 0.65 - m, h * 0.75 - m);
        canvas.drawRect(fRect, paint);
        final bRect = Rect.fromLTWH(w * 0.35 + m, m, w * 0.65 - m, h * 0.75 - m);
        canvas.drawRect(bRect, paint);
        canvas.drawLine(Offset(m, h * 0.25), Offset(w * 0.35 + m, m), paint);
        canvas.drawLine(Offset(w * 0.65, h * 0.25), Offset(w - m, m), paint);
        canvas.drawLine(Offset(m, h - m), Offset(w * 0.35 + m, h * 0.75), paint);
        canvas.drawLine(Offset(w * 0.65, h - m), Offset(w - m, h * 0.75), paint);
        break;
      case 'cylinder':
        final topOval = Rect.fromLTWH(m, m, w - 2 * m, h * 0.25);
        final botOval = Rect.fromLTWH(m, h * 0.75 - m, w - 2 * m, h * 0.25);
        canvas.drawOval(topOval, paint);
        canvas.drawOval(botOval, paint);
        canvas.drawLine(Offset(m, h * 0.125), Offset(m, h * 0.875), paint);
        canvas.drawLine(Offset(w - m, h * 0.125), Offset(w - m, h * 0.875), paint);
        break;
      case 'cone':
        final botOval = Rect.fromLTWH(m, h * 0.75 - m, w - 2 * m, h * 0.25);
        canvas.drawOval(botOval, paint);
        canvas.drawLine(Offset(w / 2, m), Offset(m, h * 0.875), paint);
        canvas.drawLine(Offset(w / 2, m), Offset(w - m, h * 0.875), paint);
        break;
      default:
        canvas.drawCircle(Offset(w / 2, h / 2), ((w < h ? w : h) / 2) - m, paint);
    }
  }

  void _drawPolygon(Canvas canvas, Size size, int sides, Paint paint) {
    final path = Path();
    final cx = size.width / 2;
    final cy = size.height / 2;
    const m = 1.5;
    final r = ((size.width < size.height ? size.width : size.height) / 2) - m;

    for (int i = 0; i < sides; i++) {
      final angle = (i * 360 / sides - 90) * (3.141592653589793 / 180);
      final x = cx + r * cos(angle);
      final y = cy + r * sin(angle);
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant ShapePainter oldDelegate) =>
      oldDelegate.shapeKey != shapeKey || oldDelegate.color != color;
}
