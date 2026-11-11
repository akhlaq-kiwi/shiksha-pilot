import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:school_hub/services/http_service.dart' as http;
import '../services/fee_reminder_service.dart';
import '../utils/class_formatter.dart';

class FeeReminderScreen extends StatefulWidget {
  final FeeReminderService service;
  final String userRole;
  final bool? isPrincipal;
  final bool? isFeeCollector;

  const FeeReminderScreen({
    Key? key,
    required this.service,
    required this.userRole,
    this.isPrincipal,
    this.isFeeCollector,
  }) : super(key: key);

  @override
  State<FeeReminderScreen> createState() => _FeeReminderScreenState();
}

class _FeeReminderScreenState extends State<FeeReminderScreen> {
  // Theme constants matching Manage Fees
  static const Color _primaryColor = Color(0xFFD97706); // Amber 600
  static const Color _primaryDark = Color(0xFFC26600);
  static const Color _canvasBg = Color(0xFFFBF8F2); // Warm ivory background
  static const Color _textPrimary = Color(0xFF0F172A);
  static const Color _textSecondary = Color(0xFF64748B);
  static const Color _textMuted = Color(0xFF94A3B8);
  static const Color _borderColor = Color(0xFFE2E8F0);
  static const Color _inputBg = Color(0xFFF8FAFC);

  bool _isLoading = true;
  String _errorMessage = '';

  List<dynamic> _items = [];
  Map<String, dynamic> _stats = {
    'pending': 0,
    'due_today': 0,
    'upcoming': 0,
    'overdue': 0,
    'completed': 0,
  };
  Map<String, dynamic> _pagination = {
    'total_items': 0,
    'page': 1,
    'limit': 20,
    'total_pages': 1,
  };

  // Filters
  String _statusFilter = 'ALL';
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  // All students for lookup in Add Modal
  List<dynamic> _studentsList = [];

  @override
  void initState() {
    super.initState();
    _markFeeReminderNotificationsRead();
    _loadInitialData();
  }

  Future<void> _markFeeReminderNotificationsRead() async {
    try {
      final token = widget.service.token;
      if (token.isEmpty) return;
      final roleUpper = widget.userRole.toUpperCase();
      final isSchoolAdmin = roleUpper == 'SCHOOL_ADMIN' || roleUpper == 'SUPER_ADMIN';
      final path = isSchoolAdmin
          ? '/api/school/notifications/0/read'
          : '/api/teacher/notifications/0/read';
      final uri = Uri.parse('${widget.service.baseUrl}$path');
      await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({'module': 'fee_reminder'}),
      );
    } catch (_) {}
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final results = await Future.wait([
        widget.service.getFeeFollowUps(
          status: _statusFilter,
          studentSearch: _searchQuery,
          page: 1,
          limit: 20,
        ),
        widget.service.getStudents(limit: 1000),
      ]);

      final followUpsRes = results[0] as Map<String, dynamic>;
      final studentsRes = results[1] as List<dynamic>;

      if (mounted) {
        setState(() {
          _items = followUpsRes['items'] ?? [];
          _stats = followUpsRes['stats'] ?? _stats;
          _pagination = followUpsRes['pagination'] ?? _pagination;
          _studentsList = studentsRes;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _fetchFollowUps({int page = 1}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final res = await widget.service.getFeeFollowUps(
        status: _statusFilter,
        studentSearch: _searchQuery,
        page: page,
        limit: 20,
      );

      if (mounted) {
        setState(() {
          _items = res['items'] ?? [];
          _stats = res['stats'] ?? _stats;
          _pagination = res['pagination'] ?? _pagination;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception:', '').trim();
          _isLoading = false;
        });
      }
    }
  }

  void _onStatusFilterSelected(String status) {
    if (_statusFilter == status) {
      setState(() => _statusFilter = 'ALL');
    } else {
      setState(() => _statusFilter = status);
    }
    _fetchFollowUps(page: 1);
  }

  void _onSearchChanged(String val) {
    setState(() {
      _searchQuery = val;
    });
    // Debounce or instant fetch
    _fetchFollowUps(page: 1);
  }

  int _countWords(String str) {
    final trimmed = str.trim();
    if (trimmed.isEmpty) return 0;
    return trimmed.split(RegExp(r'\s+')).length;
  }

  String _formatDate(String? raw) {
    if (raw == null || raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw);
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return raw;
    }
  }

  String _formatAmount(dynamic amt) {
    if (amt == null) return '0';
    final n = amt is num ? amt.toDouble() : double.tryParse(amt.toString()) ?? 0.0;
    final wholeInt = n.round();
    String whole = wholeInt.toString();
    final reg = RegExp(r'\B(?=(\d{3})+(?!\d))');
    whole = whole.replaceAll(reg, ',');
    return whole;
  }

  void _showToast(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          msg,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF15803D),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  // =========================================================================
  // MODALS
  // =========================================================================

  // 1. Add / Edit Follow-up Modal
  void _openAddEditModal({Map<String, dynamic>? editItem}) {
    final bool isEdit = editItem != null;
    dynamic selectedStudent;
    if (isEdit) {
      selectedStudent = {
        'id': editItem['student_id'],
        'name': editItem['student_name'],
        'class_name': editItem['class_name'],
        'roll_no': editItem['roll_no'],
      };
    }

    String studentSearchVal = '';
    String initialAmt = '';
    if (isEdit && editItem['pending_amount'] != null) {
      initialAmt = editItem['pending_amount'].toString().split('.')[0];
    }
    final TextEditingController amountController = TextEditingController(
      text: initialAmt,
    );
    final TextEditingController reasonController = TextEditingController(
      text: isEdit ? (editItem['reason']?.toString() ?? '') : '',
    );
    final TextEditingController notesController = TextEditingController(
      text: isEdit ? (editItem['reminder_notes']?.toString() ?? '') : '',
    );

    String promisedDate = isEdit && editItem['promised_date'] != null
        ? editItem['promised_date'].toString().split('T')[0]
        : '';

    bool isSubmitting = false;
    String modalError = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;

            final activeStudents = _studentsList.where((s) {
              if (s['status'] != null && s['status'] != 'ACTIVE') return false;
              if (studentSearchVal.trim().isEmpty) return true;
              final q = studentSearchVal.toLowerCase().trim();
              final name = (s['name'] ?? '').toString().toLowerCase();
              final adm = (s['admission_no'] ?? '').toString().toLowerCase();
              final roll = (s['roll_no'] ?? '').toString().toLowerCase();
              return name.contains(q) || adm.contains(q) || roll.contains(q);
            }).toList();

            final currentWords = _countWords(reasonController.text);

            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: 24 + keyboardPadding,
              ),
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.90,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Title
                    Text(
                      isEdit ? 'Edit Commitment Details' : 'Create Payment Commitment',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: _textPrimary,
                      ),
                    ),
                    if (isEdit) ...[
                      const SizedBox(height: 4),
                      const Text(
                        'Update payment promise date, dues, or notes.',
                        style: TextStyle(fontSize: 12, color: _textSecondary),
                      ),
                    ],
                    const SizedBox(height: 16),

                    if (modalError.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          modalError,
                          style: const TextStyle(
                            color: Colors.redAccent,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Student Picker
                    const Text(
                      'SELECT STUDENT *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),

                    if (!isEdit && selectedStudent == null) ...[
                      Container(
                        decoration: BoxDecoration(
                          color: _inputBg,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: TextField(
                          onTapOutside: (_) => FocusScope.of(context).unfocus(),
                          onChanged: (val) => setModalState(() => studentSearchVal = val),
                          textAlignVertical: TextAlignVertical.center,
                          style: const TextStyle(fontSize: 13, color: _textPrimary, fontWeight: FontWeight.w500),
                          decoration: const InputDecoration(
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            hintText: 'Type student name, admission no or roll no...',
                            hintStyle: TextStyle(fontSize: 12, color: _textMuted),
                            prefixIcon: Icon(Icons.person_search_rounded, size: 20, color: _textMuted),
                            prefixIconConstraints: BoxConstraints(minWidth: 40, minHeight: 40),
                            border: InputBorder.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        constraints: const BoxConstraints(maxHeight: 215),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: _borderColor),
                        ),
                        child: activeStudents.isEmpty
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: Center(
                                  child: Text(
                                    'No matching students found',
                                    style: TextStyle(fontSize: 12, color: Colors.grey),
                                  ),
                                ),
                              )
                            : ListView.separated(
                                shrinkWrap: true,
                                itemCount: activeStudents.take(20).length,
                                separatorBuilder: (_, __) => const Divider(height: 1),
                                itemBuilder: (_, i) {
                                  final s = activeStudents[i];
                                  final sClass = formatShortClassName(
                                    s['class_name']?.toString(),
                                    section: s['section']?.toString(),
                                  );
                                  return ListTile(
                                    dense: true,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                                    title: Text(
                                      s['name'] ?? '',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: _textPrimary,
                                      ),
                                    ),
                                    subtitle: Text(
                                      'Class: $sClass • Roll: ${s['roll_no'] ?? '—'}',
                                      style: const TextStyle(fontSize: 11, color: _textSecondary),
                                    ),
                                    trailing: const Text(
                                      'Select',
                                      style: TextStyle(
                                        color: _primaryColor,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                    onTap: () async {
                                      final studentId = s['id'] is int
                                          ? s['id']
                                          : int.tryParse(s['id'].toString()) ?? 0;

                                      // Check if student already has an active commitment
                                      Map<String, dynamic>? activeCommitment;
                                      try {
                                        activeCommitment = await widget.service.getStudentActiveFollowUp(studentId);
                                      } catch (_) {}

                                      if (!mounted || !modalCtx.mounted) return;

                                      if (activeCommitment != null) {
                                        _showActiveCommitmentDialog(
                                          context: modalCtx,
                                          studentName: s['name']?.toString() ?? 'Student',
                                          className: sClass,
                                          rollNo: s['roll_no']?.toString() ?? '—',
                                          activeCommitment: activeCommitment,
                                        );
                                        return;
                                      }

                                      setModalState(() {
                                        selectedStudent = s;
                                      });
                                      // Auto-fetch outstanding dues
                                      try {
                                        final balance = await widget.service.getStudentOutstandingFee(studentId);
                                        amountController.text = balance.round().toString();
                                        setModalState(() {});
                                      } catch (_) {}
                                    },
                                  );
                                },
                              ),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7).withOpacity(0.4),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  selectedStudent['name'] ?? '',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: _textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Class: ${formatShortClassName(selectedStudent['class_name']?.toString())} • Roll: ${selectedStudent['roll_no'] ?? '—'}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: _primaryDark,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            if (!isEdit)
                              TextButton(
                                onPressed: () {
                                  setModalState(() {
                                    selectedStudent = null;
                                    amountController.clear();
                                  });
                                },
                                child: const Text(
                                  'Change',
                                  style: TextStyle(
                                    color: _primaryColor,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),

                    // Pending Amount
                    const Text(
                      'PENDING AMOUNT (₹) *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: _inputBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        controller: amountController,
                        onTapOutside: (_) => FocusScope.of(context).unfocus(),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        decoration: const InputDecoration(
                          hintText: '0.00',
                          hintStyle: TextStyle(fontSize: 13, color: _textMuted),
                          prefixText: '₹ ',
                          prefixStyle: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                          border: InputBorder.none,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Auto-fetched from student outstanding dues; editable if required.',
                      style: TextStyle(fontSize: 11, color: _textMuted),
                    ),
                    const SizedBox(height: 14),

                    // Promised Payment Date
                    const Text(
                      'PROMISED PAYMENT DATE *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final now = DateTime.now();
                        final tomorrow = now.add(const Duration(days: 1));
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: promisedDate.isNotEmpty
                              ? DateTime.tryParse(promisedDate) ?? tomorrow
                              : tomorrow,
                          firstDate: tomorrow,
                          lastDate: DateTime(now.year + 2),
                        );
                        if (picked != null) {
                          setModalState(() {
                            promisedDate =
                                '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: _inputBg,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              promisedDate.isNotEmpty ? _formatDate(promisedDate) : 'Select date...',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: promisedDate.isNotEmpty ? _textPrimary : _textMuted,
                              ),
                            ),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: _primaryColor),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Delay Reason (Optional)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'DELAY REASON (OPTIONAL)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _textSecondary,
                          ),
                        ),
                        Text(
                          '$currentWords / 25 words',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: currentWords > 25 ? Colors.red : _textMuted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: _inputBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: currentWords > 25 ? Colors.red : const Color(0xFFCBD5E1),
                        ),
                      ),
                      child: TextField(
                        controller: reasonController,
                        onTapOutside: (_) => FocusScope.of(context).unfocus(),
                        maxLines: 3,
                        maxLength: 500,
                        onChanged: (_) => setModalState(() {}),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        decoration: const InputDecoration(
                          hintText: 'Examples: Salary delayed, cheque clearing, family emergency...',
                          hintStyle: TextStyle(fontSize: 12, color: _textMuted),
                          border: InputBorder.none,
                          counterText: '',
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Maximum 25 words allowed.',
                      style: TextStyle(fontSize: 11, color: _textMuted),
                    ),
                    const SizedBox(height: 20),

                    // Action Buttons
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(modalCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(fontWeight: FontWeight.bold, color: _textSecondary),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    if (selectedStudent == null) {
                                      setModalState(() => modalError = 'Please select a student.');
                                      return;
                                    }
                                    final amt = double.tryParse(amountController.text.trim());
                                    if (amt == null || amt < 0) {
                                      setModalState(() => modalError = 'Pending amount cannot be negative.');
                                      return;
                                    }
                                    if (promisedDate.isEmpty) {
                                      setModalState(() => modalError = 'Promised payment date is required.');
                                      return;
                                    }
                                    final reason = reasonController.text.trim();
                                    if (reason.isNotEmpty && _countWords(reason) > 25) {
                                      setModalState(() => modalError = 'Maximum 25 words allowed for delay reason.');
                                      return;
                                    }

                                    setModalState(() {
                                      isSubmitting = true;
                                      modalError = '';
                                    });

                                    try {
                                      final payload = {
                                        'student_id': selectedStudent['id'],
                                        'promised_date': promisedDate,
                                        'reason': reason,
                                        'pending_amount': amt,
                                        'reminder_notes': notesController.text.trim(),
                                      };

                                      if (isEdit) {
                                        await widget.service.updateFeeFollowUp(
                                          editItem['id'] is int ? editItem['id'] : int.parse(editItem['id'].toString()),
                                          payload,
                                        );
                                        _showToast('Follow-up updated successfully');
                                      } else {
                                        await widget.service.createFeeFollowUp(payload);
                                        _showToast('Follow-up saved successfully');
                                      }

                                      Navigator.pop(modalCtx);
                                      _fetchFollowUps(page: _pagination['page'] ?? 1);
                                    } catch (err) {
                                      setModalState(() {
                                        isSubmitting = false;
                                        modalError = err.toString().replaceAll('Exception:', '').trim();
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _primaryColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: isSubmitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : Text(
                                    isEdit ? 'Update Follow-up' : 'Save Follow-up',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
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

  // 2. Extend Commitment Modal
  void _openExtendModal(Map<String, dynamic> item) {
    final currentPromisedDate = item['promised_date'] != null
        ? item['promised_date'].toString().split('T')[0]
        : '';
    String newPromisedDate = '';
    final TextEditingController reasonController = TextEditingController();
    bool isSubmitting = false;
    String modalError = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;
            final currentWords = _countWords(reasonController.text);

            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: 24 + keyboardPadding,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    const Text(
                      'Extend Payment Commitment',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: _textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Choose a later date when the parent agreed to pay.',
                      style: TextStyle(fontSize: 12, color: _textSecondary),
                    ),
                    const SizedBox(height: 16),

                    if (modalError.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          modalError,
                          style: const TextStyle(
                            color: Colors.redAccent,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Student Header
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: _borderColor),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['student_name'] ?? '',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: _textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Class: ${formatShortClassName(item['class_name']?.toString())} • Roll: ${item['roll_no'] ?? '—'}',
                                style: const TextStyle(fontSize: 12, color: _textSecondary),
                              ),
                            ],
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text(
                                'CURRENT DUE DATE',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: _textMuted,
                                ),
                              ),
                              Text(
                                _formatDate(currentPromisedDate),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: _primaryDark,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // New Promised Date
                    const Text(
                      'NEW PROMISED DATE *',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _textSecondary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: () async {
                        final now = DateTime.now();
                        DateTime minDate = now.add(const Duration(days: 1));
                        if (currentPromisedDate.isNotEmpty) {
                          final curDt = DateTime.tryParse(currentPromisedDate);
                          if (curDt != null && curDt.isAfter(now)) {
                            minDate = curDt.add(const Duration(days: 1));
                          }
                        }

                        final picked = await showDatePicker(
                          context: context,
                          initialDate: newPromisedDate.isNotEmpty
                              ? DateTime.tryParse(newPromisedDate) ?? minDate
                              : minDate,
                          firstDate: minDate,
                          lastDate: DateTime(now.year + 2),
                        );
                        if (picked != null) {
                          setModalState(() {
                            newPromisedDate =
                                '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: _inputBg,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              newPromisedDate.isNotEmpty ? _formatDate(newPromisedDate) : 'Select new future date...',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: newPromisedDate.isNotEmpty ? _textPrimary : _textMuted,
                              ),
                            ),
                            const Icon(Icons.calendar_today_rounded, size: 18, color: _primaryColor),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Extension Reason
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'REASON / UPDATE NOTES (OPTIONAL)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _textSecondary,
                          ),
                        ),
                        Text(
                          '$currentWords / 25 words',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: currentWords > 25 ? Colors.red : _textMuted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: _inputBg,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: currentWords > 25 ? Colors.red : const Color(0xFFCBD5E1),
                        ),
                      ),
                      child: TextField(
                        controller: reasonController,
                        onTapOutside: (_) => FocusScope.of(context).unfocus(),
                        maxLines: 3,
                        maxLength: 500,
                        onChanged: (_) => setModalState(() {}),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        decoration: const InputDecoration(
                          hintText: 'Reason for extension e.g. delay in crop sale, medical urgency...',
                          hintStyle: TextStyle(fontSize: 12, color: _textMuted),
                          border: InputBorder.none,
                          counterText: '',
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Actions
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(modalCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(fontWeight: FontWeight.bold, color: _textSecondary),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    if (newPromisedDate.isEmpty) {
                                      setModalState(() => modalError = 'New promised date is required.');
                                      return;
                                    }
                                    if (currentPromisedDate.isNotEmpty &&
                                        newPromisedDate.compareTo(currentPromisedDate) <= 0) {
                                      setModalState(() => modalError = 'New date must be later than current promise date.');
                                      return;
                                    }
                                    final reason = reasonController.text.trim();
                                    if (reason.isNotEmpty && _countWords(reason) > 25) {
                                      setModalState(() => modalError = 'Maximum 25 words allowed for reason.');
                                      return;
                                    }

                                    setModalState(() {
                                      isSubmitting = true;
                                      modalError = '';
                                    });

                                    try {
                                      final id = item['id'] is int
                                          ? item['id']
                                          : int.parse(item['id'].toString());
                                      await widget.service.extendFeeFollowUp(id, {
                                        'promised_date': newPromisedDate,
                                        'reason': reason,
                                      });
                                      _showToast('Commitment extended successfully');
                                      Navigator.pop(modalCtx);
                                      _fetchFollowUps(page: _pagination['page'] ?? 1);
                                    } catch (err) {
                                      setModalState(() {
                                        isSubmitting = false;
                                        modalError = err.toString().replaceAll('Exception:', '').trim();
                                      });
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _primaryColor,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: isSubmitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                  )
                                : const Text(
                                    'Extend Commitment',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
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

  // 3. View Details Modal
  void _openDetailsModal(Map<String, dynamic> item) async {
    final id = item['id'] is int ? item['id'] : int.parse(item['id'].toString());
    Map<String, dynamic> detail = item;
    bool loadingDetails = true;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            final keyboardPadding = MediaQuery.of(modalCtx).viewInsets.bottom;

            if (loadingDetails) {
              widget.service.getFeeFollowUpDetails(id).then((val) {
                if (modalCtx.mounted) {
                  setModalState(() {
                    detail = val;
                    loadingDetails = false;
                  });
                }
              }).catchError((_) {
                if (modalCtx.mounted) {
                  setModalState(() {
                    loadingDetails = false;
                  });
                }
              });
            }

            final notes = List<dynamic>.from(detail['notes'] ?? []);
            final isExtended = (detail['is_extended'] == true ||
                detail['is_extended'] == 1 ||
                detail['is_extended'] == '1' ||
                item['is_extended'] == true ||
                item['is_extended'] == 1 ||
                item['is_extended'] == '1' ||
                (detail['extended_count'] != null && (detail['extended_count'] as num) > 0) ||
                (item['extended_count'] != null && (item['extended_count'] as num) > 0));
            final extendedCount = detail['extended_count'] ?? item['extended_count'] ?? (isExtended ? 1 : 0);

            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: 24 + keyboardPadding,
              ),
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.88,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Payment Commitment Details',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: _textPrimary,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, size: 20, color: _textSecondary),
                          onPressed: () => Navigator.pop(modalCtx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Overview Card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: _borderColor),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('STUDENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                                    const SizedBox(height: 2),
                                    Text(
                                      detail['student_name'] ?? item['student_name'] ?? '—',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _textPrimary),
                                    ),
                                    Builder(builder: (_) {
                                      final rawClass = (detail['class_name'] ?? item['class_name'] ?? '').toString();
                                      final shortClass = formatShortClassName(rawClass);
                                      final classDisplay = shortClass.toLowerCase().startsWith('class')
                                          ? shortClass
                                          : (shortClass.isNotEmpty ? 'Class $shortClass' : '—');
                                      final rawRoll = detail['roll_no'] ?? item['roll_no'];
                                      final rollDisplay = (rawRoll != null && rawRoll.toString().trim().isNotEmpty && rawRoll.toString().trim() != '—')
                                          ? rawRoll.toString().trim()
                                          : '—';
                                      return Text(
                                        '$classDisplay • Roll $rollDisplay',
                                        style: const TextStyle(fontSize: 12, color: _textSecondary),
                                      );
                                    }),
                                  ],
                                ),
                              ),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _buildStatusBadge(detail['status']?.toString() ?? 'PENDING'),
                                  if (isExtended && (extendedCount is num ? extendedCount > 0 : (int.tryParse(extendedCount.toString()) ?? 0) > 0)) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF3E8FF),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        'Ext: $extendedCount',
                                        style: const TextStyle(
                                          color: Color(0xFF7E22CE),
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('PENDING AMOUNT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                                  const SizedBox(height: 2),
                                  Text(
                                    '₹${_formatAmount(detail['pending_amount'])}',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      color: _textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text('PROMISED DATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                                  const SizedBox(height: 2),
                                  Text(
                                    _formatDate(detail['promised_date']?.toString()),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _textPrimary),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('CONTACT MOBILE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                                  const SizedBox(height: 2),
                                  Text(
                                    detail['mobile_number']?.toString() ?? '—',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _textPrimary),
                                  ),
                                ],
                              ),
                              if (detail['mobile_number'] != null &&
                                  detail['mobile_number'].toString().trim() != '—' &&
                                  detail['mobile_number'].toString().trim().isNotEmpty)
                                ElevatedButton.icon(
                                  onPressed: () {
                                    final phone = detail['mobile_number'].toString().trim();
                                    Clipboard.setData(ClipboardData(text: phone));
                                    _showToast('Copied $phone to clipboard');
                                  },
                                  icon: const Icon(Icons.copy_rounded, size: 14),
                                  label: const Text('Copy Phone', style: TextStyle(fontSize: 11)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF0F172A),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Text('DELAY REASON', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                          const SizedBox(height: 2),
                          Text(
                            (detail['reason'] != null && detail['reason'].toString().trim().isNotEmpty)
                                ? detail['reason'].toString()
                                : 'reason is not mentioned',
                            style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: _textSecondary),
                          ),
                        ],
                      ),
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

  // 4. Delete Confirmation Dialog
  void _openDeleteConfirmModal(Map<String, dynamic> item) {
    bool isDeleting = false;
    final id = item['id'] is int ? item['id'] : int.parse(item['id'].toString());

    showDialog(
      context: context,
      barrierDismissible: !isDeleting,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dCtx, setDState) {
            return Dialog(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.transparent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              insetPadding: const EdgeInsets.symmetric(horizontal: 24),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFFEE2E2)),
                          ),
                          child: const Icon(
                            Icons.delete_outline_rounded,
                            color: Color(0xFFDC2626),
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Text(
                            'Delete Follow-up?',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: _textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Are you sure you want to delete payment follow-up commitment for ${item['student_name'] ?? 'this student'}? This action cannot be undone.',
                      style: const TextStyle(
                        fontSize: 13,
                        color: _textSecondary,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 22),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: isDeleting ? null : () => Navigator.pop(dCtx),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              side: const BorderSide(color: Color(0xFFCBD5E1)),
                              backgroundColor: const Color(0xFFF8FAFC),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _textSecondary,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: isDeleting
                                ? null
                                : () async {
                                    setDState(() => isDeleting = true);
                                    try {
                                      await widget.service.deleteFeeFollowUp(id);
                                      Navigator.pop(dCtx);
                                      _showToast('Follow-up deleted successfully');
                                      _fetchFollowUps(page: _pagination['page'] ?? 1);
                                    } catch (e) {
                                      setDState(() => isDeleting = false);
                                      _showToast(e.toString().replaceAll('Exception:', ''), isError: true);
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFDC2626),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: isDeleting
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'Delete',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
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

  // 5. Active Commitment Warning Dialog
  void _showActiveCommitmentDialog({
    required BuildContext context,
    required String studentName,
    required String className,
    required String rollNo,
    required Map<String, dynamic> activeCommitment,
  }) {
    final rawStatus = (activeCommitment['status'] ?? 'PENDING').toString().toUpperCase();
    final statusDisplay = rawStatus == 'DUE_TODAY'
        ? 'Due Today'
        : rawStatus == 'OVERDUE'
            ? 'Overdue'
            : 'Pending';
    final promiseDate = activeCommitment['promise_date']?.toString();
    final promisedAmount = activeCommitment['promised_amount'];

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return Dialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFFEDD5)),
                      ),
                      child: const Icon(
                        Icons.warning_amber_rounded,
                        color: _primaryColor,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Text(
                        'Active Commitment Exists',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: _textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              studentName,
                              style: const TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.bold,
                                color: _textPrimary,
                              ),
                            ),
                          ),
                          _buildStatusBadge(rawStatus),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Class: $className • Roll: $rollNo',
                        style: const TextStyle(fontSize: 11, color: _textSecondary),
                      ),
                      if (promiseDate != null && promiseDate.isNotEmpty) ...[
                        const Divider(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Promise Date: ${_formatDate(promiseDate)}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w600,
                                color: _textPrimary,
                              ),
                            ),
                            if (promisedAmount != null)
                              Text(
                                '₹${_formatAmount(promisedAmount)}',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                  color: _textPrimary,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'This student already has an active payment commitment marked as "$statusDisplay".\n\nPlease extend the current commitment, mark it as completed, or delete it from the follow-up list before adding a new one.',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: _textSecondary,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(dialogCtx),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primaryColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Understood',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // Toggle Status: Completed <-> Pending
  Future<void> _toggleStatus(Map<String, dynamic> item) async {
    final id = item['id'] is int ? item['id'] : int.parse(item['id'].toString());
    final newStatus = item['status'] == 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await widget.service.updateFeeFollowUpStatus(id, newStatus);
      _showToast('Marked as $newStatus');
      _fetchFollowUps(page: _pagination['page'] ?? 1);
    } catch (e) {
      _showToast(e.toString().replaceAll('Exception:', ''), isError: true);
    }
  }

  // Quick mark contacted
  Future<void> _quickMarkContacted(Map<String, dynamic> item) async {
    final id = item['id'] is int ? item['id'] : int.parse(item['id'].toString());
    try {
      await widget.service.markFollowUpContacted(id, comment: 'Contacted parent via mobile.');
      _showToast('Marked parent as contacted');
      _fetchFollowUps(page: _pagination['page'] ?? 1);
    } catch (e) {
      _showToast(e.toString().replaceAll('Exception:', ''), isError: true);
    }
  }

  // Status Badge Builder
  Widget _buildStatusBadge(String status) {
    Color bg;
    Color text;
    String label = status.replaceAll('_', ' ');

    switch (status) {
      case 'PENDING':
        bg = const Color(0xFFFEF3C7);
        text = const Color(0xFFB45309);
        break;
      case 'DUE_TODAY':
        bg = const Color(0xFFFFEDD5);
        text = const Color(0xFFC2410C);
        break;
      case 'UPCOMING':
        bg = const Color(0xFFF3E8FF);
        text = const Color(0xFF7E22CE);
        break;
      case 'OVERDUE':
        bg = const Color(0xFFFEE2E2);
        text = const Color(0xFFDC2626);
        break;
      case 'COMPLETED':
        bg = const Color(0xFFDCFCE7);
        text = const Color(0xFF15803D);
        break;
      default:
        bg = const Color(0xFFF1F5F9);
        text = const Color(0xFF475569);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: text,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // =========================================================================
  // BUILD
  // =========================================================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _canvasBg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'FEE REMINDER',
          style: TextStyle(
            color: _textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 18,
            letterSpacing: 0.5,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: ElevatedButton.icon(
              onPressed: () => _openAddEditModal(),
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text(
                'Add Follow-up',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: _primaryColor,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: _borderColor, height: 1),
        ),
      ),
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => FocusScope.of(context).unfocus(),
        child: RefreshIndicator(
          color: _primaryColor,
          onRefresh: () async => _fetchFollowUps(page: 1),
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.all(16),
          children: [
            // KPI Metric Summary Cards
            _buildKpiMetrics(),
            const SizedBox(height: 16),

            // Search and Status Filter bar
            _buildSearchBar(),
            const SizedBox(height: 16),

            // Main Listing
            if (_isLoading && _items.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator(color: _primaryColor)),
              )
            else if (_errorMessage.isNotEmpty && _items.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _borderColor),
                ),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 36),
                      const SizedBox(height: 8),
                      Text(
                        _errorMessage,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => _fetchFollowUps(page: 1),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _primaryColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              )
            else if (_items.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _borderColor),
                ),
                child: Center(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.event_note_rounded,
                          size: 40,
                          color: _textMuted,
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'No follow-up records found matching filter criteria.',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: _textSecondary,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              )
            else ...[
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, i) => _buildFollowUpCard(_items[i]),
              ),
              const SizedBox(height: 16),
              // Pagination
              if ((_pagination['total_pages'] ?? 1) > 1) _buildPaginationFooter(),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    ),
  );
}

  // 4 KPI Metric Summary Cards (No icons, fits screen without horizontal scroll)
  Widget _buildKpiMetrics() {
    final kpis = [
      {
        'status': 'OVERDUE',
        'label': 'Overdue',
        'count': _stats['overdue'] ?? 0,
        'color': const Color(0xFFDC2626),
      },
      {
        'status': 'DUE_TODAY',
        'label': 'Due Today',
        'count': _stats['due_today'] ?? 0,
        'color': const Color(0xFFEA580C),
      },
      {
        'status': 'PENDING',
        'label': 'Pending',
        'count': _stats['pending'] ?? 0,
        'color': const Color(0xFFD97706),
      },
      {
        'status': 'COMPLETED',
        'label': 'Completed',
        'count': _stats['completed'] ?? 0,
        'color': const Color(0xFF16A34A),
      },
    ];

    return Row(
      children: kpis.map((k) {
        final isSelected = _statusFilter == k['status'];
        final color = k['color'] as Color;

        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isSelected ? color : _borderColor,
                  width: isSelected ? 2 : 1,
                ),
                boxShadow: isSelected
                    ? [BoxShadow(color: color.withOpacity(0.18), blurRadius: 6, offset: const Offset(0, 2))]
                    : const [BoxShadow(color: Color(0x04000000), blurRadius: 4, offset: Offset(0, 2))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    (k['label'] as String).toUpperCase(),
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      color: isSelected ? color : _textMuted,
                      letterSpacing: 0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    k['count'].toString(),
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: isSelected ? color : _textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  // Search & Filter (Identical pattern to Teachers listing)
  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        controller: _searchController,
        onChanged: _onSearchChanged,
        onTapOutside: (_) => FocusScope.of(context).unfocus(),
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: 'Search by student name, roll no...',
          hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
          prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF64748B)),
          suffixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_searchQuery.isNotEmpty)
                IconButton(
                  icon: const Icon(Icons.clear_rounded, size: 18, color: Color(0xFF64748B)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    _searchController.clear();
                    _onSearchChanged('');
                  },
                ),
              if (_searchQuery.isNotEmpty) const SizedBox(width: 4),
              Container(
                height: 20,
                width: 1,
                color: const Color(0xFFCBD5E1),
                margin: const EdgeInsets.symmetric(horizontal: 4),
              ),
              InkWell(
                onTap: _openStatusFilterBottomSheet,
                borderRadius: BorderRadius.circular(20),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Icon(
                        Icons.tune_rounded,
                        size: 20,
                        color: _statusFilter != 'ALL'
                            ? _primaryColor
                            : const Color(0xFF0F172A),
                      ),
                      if (_statusFilter != 'ALL')
                        Positioned(
                          top: -2,
                          right: -2,
                          child: Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: _primaryColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          isDense: true,
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(30),
            borderSide: const BorderSide(color: _primaryColor, width: 1.5),
          ),
        ),
      ),
    );
  }

  void _openStatusFilterBottomSheet() {
    String tempStatus = _statusFilter;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Filter Follow-ups',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: _textPrimary,
                          ),
                        ),
                        if (tempStatus != 'ALL')
                          TextButton(
                            onPressed: () {
                              setModalState(() => tempStatus = 'ALL');
                            },
                            child: const Text(
                              'Reset',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          )
                        else
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: _textSecondary),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'STATUS',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: _textSecondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildFilterOption(
                      label: 'All Commitments',
                      subtitle: 'Show all follow-up payment commitments',
                      selected: tempStatus == 'ALL',
                      onTap: () => setModalState(() => tempStatus = 'ALL'),
                    ),
                    const SizedBox(height: 8),
                    _buildFilterOption(
                      label: 'Overdue',
                      subtitle: 'Promised date has passed and unpaid',
                      selected: tempStatus == 'OVERDUE',
                      onTap: () => setModalState(() => tempStatus = 'OVERDUE'),
                    ),
                    const SizedBox(height: 8),
                    _buildFilterOption(
                      label: 'Due Today',
                      subtitle: 'Promised date is today',
                      selected: tempStatus == 'DUE_TODAY',
                      onTap: () => setModalState(() => tempStatus = 'DUE_TODAY'),
                    ),
                    const SizedBox(height: 8),
                    _buildFilterOption(
                      label: 'Pending',
                      subtitle: 'Pending payment commitments',
                      selected: tempStatus == 'PENDING',
                      onTap: () => setModalState(() => tempStatus = 'PENDING'),
                    ),
                    const SizedBox(height: 8),
                    _buildFilterOption(
                      label: 'Completed',
                      subtitle: 'Commitments marked completed/paid',
                      selected: tempStatus == 'COMPLETED',
                      onTap: () => setModalState(() => tempStatus = 'COMPLETED'),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        setState(() {
                          _statusFilter = tempStatus;
                        });
                        _fetchFollowUps(page: 1);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _primaryColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Apply Filter', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
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

  Widget _buildFilterOption({
    required String label,
    required String subtitle,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFFEF3C7) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? _primaryColor : _borderColor,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: selected ? const Color(0xFF92400E) : _textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 11, color: _textSecondary),
                  ),
                ],
              ),
            ),
            if (selected)
              const Icon(Icons.check_circle_rounded, color: _primaryColor, size: 20)
            else
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // Follow-up Single Card
  Widget _buildFollowUpCard(dynamic item) {
    final status = (item['status'] ?? 'PENDING').toString();
    final isExtended = (item['is_extended'] == true ||
        item['is_extended'] == 1 ||
        item['is_extended'] == '1' ||
        (item['extended_count'] != null && (item['extended_count'] as num) > 0));
    final extendedCount = item['extended_count'] ?? (isExtended ? 1 : 0);

    final phone = (item['mobile_number'] ?? '—').toString().trim();
    final hasValidPhone = phone.isNotEmpty && phone != '—' && phone != 'null';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _borderColor),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Student Name + Badges + 3-dot Menu
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['student_name'] ?? '—',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: _textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Builder(builder: (_) {
                      final rawClass = (item['class_name'] ?? '').toString();
                      final shortClass = formatShortClassName(rawClass);
                      final classDisplay = shortClass.toLowerCase().startsWith('class')
                          ? shortClass
                          : (shortClass.isNotEmpty ? 'Class $shortClass' : '—');
                      final rawRoll = item['roll_no'];
                      final rollDisplay = (rawRoll != null && rawRoll.toString().trim().isNotEmpty && rawRoll.toString().trim() != '—')
                          ? rawRoll.toString().trim()
                          : '—';
                      return Text(
                        '$classDisplay • Roll: $rollDisplay',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: _textSecondary,
                        ),
                      );
                    }),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _buildStatusBadge(status),
                  // More Action Popup Menu
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, size: 20, color: _textSecondary),
                    padding: EdgeInsets.zero,
                    color: Colors.white,
                    surfaceTintColor: Colors.transparent,
                    elevation: 6,
                    shadowColor: Colors.black.withOpacity(0.12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    onSelected: (action) {
                      switch (action) {
                        case 'edit':
                          _openAddEditModal(editItem: item);
                          break;
                        case 'toggle_status':
                          _toggleStatus(item);
                          break;
                        case 'delete':
                          _openDeleteConfirmModal(item);
                          break;
                      }
                    },
                    itemBuilder: (ctx) => [
                      const PopupMenuItem(
                        value: 'edit',
                        height: 42,
                        child: Row(
                          children: [
                            Icon(Icons.edit_outlined, size: 18, color: _textSecondary),
                            SizedBox(width: 10),
                            Text('Edit', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _textPrimary)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'toggle_status',
                        height: 42,
                        child: Row(
                          children: [
                            Icon(
                              status == 'COMPLETED' ? Icons.replay_rounded : Icons.check_circle_outline_rounded,
                              size: 18,
                              color: status == 'COMPLETED' ? _textSecondary : const Color(0xFF16A34A),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              status == 'COMPLETED' ? 'Mark Pending' : 'Mark Complete',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: status == 'COMPLETED' ? _textPrimary : const Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const PopupMenuDivider(height: 1),
                      const PopupMenuItem(
                        value: 'delete',
                        height: 42,
                        child: Row(
                          children: [
                            Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFDC2626)),
                            SizedBox(width: 10),
                            Text(
                              'Delete',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFDC2626)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          const Divider(height: 18),

          // Amount and Promise Date Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('DUE AMOUNT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                  const SizedBox(height: 2),
                  Text(
                    '₹${_formatAmount(item['pending_amount'])}',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: _textPrimary,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('PROMISE DATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _textMuted)),
                  const SizedBox(height: 2),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.event_rounded, size: 14, color: _primaryColor),
                      const SizedBox(width: 4),
                      Text(
                        _formatDate(item['promised_date']?.toString()),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: _textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Bottom Action Row: Mobile Number + Quick Action Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Mobile number pill
              if (hasValidPhone)
                InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: phone));
                    _showToast('Copied $phone to clipboard');
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.phone_outlined, size: 13, color: _textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          phone,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _textPrimary,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.copy_rounded, size: 11, color: _textMuted),
                      ],
                    ),
                  ),
                )
              else
                const Text(
                  'No mobile number',
                  style: TextStyle(fontSize: 11, color: _textMuted),
                ),

              // Action buttons
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  OutlinedButton(
                    onPressed: () => _openExtendModal(item),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    child: const Text(
                      'Extend',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _textPrimary),
                    ),
                  ),
                  const SizedBox(width: 6),
                  ElevatedButton(
                    onPressed: () => _openDetailsModal(item),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primaryColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text(
                      'Details',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Pagination Footer
  Widget _buildPaginationFooter() {
    final page = _pagination['page'] ?? 1;
    final totalPages = _pagination['total_pages'] ?? 1;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _borderColor),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Page $page of $totalPages',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _textSecondary),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              OutlinedButton(
                onPressed: page > 1 ? () => _fetchFollowUps(page: page - 1) : null,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Prev', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: page < totalPages ? () => _fetchFollowUps(page: page + 1) : null,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Next', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

