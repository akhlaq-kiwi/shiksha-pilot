import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/http_service.dart' as http;
import '../services/leave_service.dart';

class RestrictionsScreen extends StatefulWidget {
  final LeaveService leaveService;

  const RestrictionsScreen({
    super.key,
    required this.leaveService,
  });

  @override
  State<RestrictionsScreen> createState() => _RestrictionsScreenState();
}

class _RestrictionsScreenState extends State<RestrictionsScreen> {
  bool _isLoading = true;
  String? _errorMessage;

  // Document Restriction States
  bool _enableDueRestriction = false;
  final TextEditingController _maxAllowedDueController = TextEditingController();
  bool _restrictAdmitCard = true;
  bool _restrictExamResult = true;
  bool _isSavingRestrictions = false;

  @override
  void initState() {
    super.initState();
    _maxAllowedDueController.addListener(_onTextChanged);
    _loadFinanceSettings();
  }

  void _onTextChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _maxAllowedDueController.removeListener(_onTextChanged);
    _maxAllowedDueController.dispose();
    super.dispose();
  }

  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token') ?? widget.leaveService.token;
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<void> _loadFinanceSettings() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final headers = await _getHeaders();
      final baseUrl = widget.leaveService.baseUrl;

      final response = await http.get(
        Uri.parse('$baseUrl/api/school/finance-settings'),
        headers: headers,
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final setts = (data is Map && data['data'] != null) ? data['data'] : data;
        if (setts is Map) {
          final rawDueRest = setts['enable_due_restriction'];
          _enableDueRestriction = rawDueRest == 1 || rawDueRest == '1' || rawDueRest == true;

          final rawMaxDue = setts['max_allowed_due'];
          if (rawMaxDue != null) {
            final d = double.tryParse(rawMaxDue.toString()) ?? 0;
            if (d > 0) {
              _maxAllowedDueController.text = d.round().toString();
            } else {
              _maxAllowedDueController.text = '';
            }
          } else {
            _maxAllowedDueController.text = '';
          }

          final rawAdmit = setts['restrict_admit_card'];
          _restrictAdmitCard = rawAdmit == 1 || rawAdmit == '1' || rawAdmit == true;

          final rawResult = setts['restrict_exam_result'];
          _restrictExamResult = rawResult == 1 || rawResult == '1' || rawResult == true;
        }
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
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

  bool get _canSave {
    if (_isSavingRestrictions) return false;
    final text = _maxAllowedDueController.text.trim();
    if (text.isEmpty) return false;
    final val = int.tryParse(text);
    return val != null && val >= 0;
  }

  Future<void> _saveDocumentRestrictions() async {
    if (!_canSave) return;

    final maxDueText = _maxAllowedDueController.text.trim();
    final maxDue = maxDueText.isEmpty ? 0 : (int.tryParse(maxDueText) ?? 0);

    setState(() => _isSavingRestrictions = true);

    try {
      final headers = await _getHeaders();
      final baseUrl = widget.leaveService.baseUrl;

      final response = await http.post(
        Uri.parse('$baseUrl/api/school/finance-settings'),
        headers: headers,
        body: json.encode({
          'enable_due_restriction': _enableDueRestriction ? 1 : 0,
          'max_allowed_due': maxDue,
          'restrict_admit_card': _restrictAdmitCard ? 1 : 0,
          'restrict_exam_result': _restrictExamResult ? 1 : 0,
        }),
      );

      final resData = json.decode(response.body);
      if (response.statusCode == 200 && resData['status'] == 'success') {
        _showSnackBar(resData['message'] ?? 'Permission settings saved successfully.');
      } else {
        final errMsg = resData['message'] ?? 'Failed to save restriction settings.';
        _showSnackBar(errMsg, isError: true);
      }
    } catch (e) {
      _showSnackBar(e.toString().replaceAll('Exception: ', ''), isError: true);
    } finally {
      if (mounted) setState(() => _isSavingRestrictions = false);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline_rounded : Icons.check_circle_rounded,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? const Color(0xFFDC2626) : const Color(0xFFD97706),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFFBF8F2),
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_ios_new_rounded, color: isDark ? Colors.white : const Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1B4B) : const Color(0xFFE0E7FF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isDark ? const Color(0xFF3730A3) : const Color(0xFFC7D2FE)),
              ),
              child: const Icon(Icons.lock_person_outlined, color: Color(0xFF4F46E5), size: 18),
            ),
            const SizedBox(width: 10),
            Text(
              'RESTRICTIONS',
              style: TextStyle(
                color: isDark ? Colors.white : const Color(0xFF0F172A),
                fontWeight: FontWeight.w800,
                fontSize: 16,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 0.5,
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        behavior: HitTestBehavior.opaque,
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Color(0xFFD97706),
                ),
              )
            : _errorMessage != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFDC2626)),
                          const SizedBox(height: 12),
                          Text(
                            _errorMessage!,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 14, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569), fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: _loadFinanceSettings,
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: const Text('Retry'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    color: const Color(0xFFD97706),
                    onRefresh: _loadFinanceSettings,
                    child: SingleChildScrollView(
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildDocumentRestrictionSection(isDark),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
      ),
    );
  }

  Widget _buildDocumentRestrictionSection(bool isDark) {
    final bool canSubmit = _canSave;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFFFFDF8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFF1EDE4), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.02),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Title Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E1B4B) : const Color(0xFFE0E7FF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.lock_person_outlined, color: Color(0xFF4F46E5), size: 16),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'STUDENT DOCUMENT RESTRICTION',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Control access to student documents based on outstanding fee amount.',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          Divider(color: isDark ? const Color(0xFF334155) : const Color(0xFFF1EDE4), height: 1),
          const SizedBox(height: 14),

          // Toggle Box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ENABLE DUE AMOUNT RESTRICTION',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Toggle to block access to selected student documents when dues exceed the allowed limit.',
                        style: TextStyle(
                          fontSize: 10.5,
                          color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Switch.adaptive(
                  value: _enableDueRestriction,
                  activeColor: const Color(0xFFD97706),
                  onChanged: (val) {
                    setState(() {
                      _enableDueRestriction = val;
                    });
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Maximum Allowed Due Amount (₹) *
            _buildFieldLabel('MAXIMUM ALLOWED DUE AMOUNT (₹) *', isDark),
            const SizedBox(height: 6),
            TextFormField(
              controller: _maxAllowedDueController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
              ],
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'e.g. 1000',
                hintStyle: TextStyle(fontSize: 13, color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8), fontWeight: FontWeight.normal),
                prefixText: '₹ ',
                prefixStyle: TextStyle(fontWeight: FontWeight.bold, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                filled: isDark,
                fillColor: isDark ? const Color(0xFF0F172A) : Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: isDark ? const Color(0xFF334155) : const Color(0xFFCBD5E1)),
                ),
                focusedBorder: const OutlineInputBorder(
                  borderRadius: BorderRadius.all(Radius.circular(10)),
                  borderSide: BorderSide(color: Color(0xFFD97706), width: 1.5),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Students whose outstanding dues are greater than this amount will not be able to access the selected documents.',
              style: TextStyle(fontSize: 10.5, color: isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
            ),

            const SizedBox(height: 14),

            // Restriction Applies To Checkboxes
            _buildFieldLabel('RESTRICTION APPLIES TO', isDark),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        _restrictAdmitCard = !_restrictAdmitCard;
                      });
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _restrictAdmitCard
                            ? (isDark ? const Color(0xFF2E2415) : const Color(0xFFFFFBEB))
                            : (isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC)),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _restrictAdmitCard
                              ? (isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A))
                              : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                        ),
                      ),
                      child: Row(
                        children: [
                          Checkbox(
                            value: _restrictAdmitCard,
                            activeColor: const Color(0xFFD97706),
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                            onChanged: (val) {
                              setState(() {
                                _restrictAdmitCard = val ?? false;
                              });
                            },
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Admit Card',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        _restrictExamResult = !_restrictExamResult;
                      });
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _restrictExamResult
                            ? (isDark ? const Color(0xFF2E2415) : const Color(0xFFFFFBEB))
                            : (isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC)),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _restrictExamResult
                              ? (isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A))
                              : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                        ),
                      ),
                      child: Row(
                        children: [
                          Checkbox(
                            value: _restrictExamResult,
                            activeColor: const Color(0xFFD97706),
                            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                            onChanged: (val) {
                              setState(() {
                                _restrictExamResult = val ?? false;
                              });
                            },
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              'Exam Result',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF0F172A)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),

          const SizedBox(height: 14),

          // Informational box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2E2415) : const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isDark ? const Color(0xFF78350F) : const Color(0xFFFDE68A)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFFD97706)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'HOW THIS WORKS',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: isDark ? const Color(0xFFF59E0B) : const Color(0xFFB45309),
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "If a student's outstanding fee is greater than the amount you enter above, they will not be able to view their Admit Card or Exam Result in the mobile application.\n\nOnce the pending amount is paid and comes within the allowed limit, access will be restored automatically.\n\nNote: This restriction does not apply to the Scheme section.",
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? const Color(0xFFFCD34D) : const Color(0xFF92400E),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Save Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: canSubmit ? _saveDocumentRestrictions : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: canSubmit ? const Color(0xFFD97706) : (isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                foregroundColor: canSubmit ? Colors.white : (isDark ? const Color(0xFF64748B) : const Color(0xFF94A3B8)),
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isSavingRestrictions
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'SAVE PERMISSION SETTINGS',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(String label, [bool isDark = false]) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
        letterSpacing: 0.3,
      ),
    );
  }
}

