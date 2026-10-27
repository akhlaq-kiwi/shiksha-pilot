import 'package:flutter/material.dart';
import 'package:school_hub/services/staff_salary_service.dart';

class TeacherProfileSalaryScreen extends StatefulWidget {
  final String baseUrl;
  final String token;
  final int staffId;
  final String? initialTeacherName;
  final String? academicYearName;
  final String? academicYearStartDate;

  const TeacherProfileSalaryScreen({
    super.key,
    required this.baseUrl,
    required this.token,
    required this.staffId,
    this.initialTeacherName,
    this.academicYearName,
    this.academicYearStartDate,
  });

  @override
  State<TeacherProfileSalaryScreen> createState() => _TeacherProfileSalaryScreenState();
}

class _TeacherProfileSalaryScreenState extends State<TeacherProfileSalaryScreen> {
  late StaffSalaryService _salaryService;
  bool _isLoading = true;
  String _errorMessage = '';
  Map<String, dynamic>? _teacher;
  String _academicYearName = '2026–2027';
  String? _academicYearStartDate;

  bool _isActionLoading = false;
  String _actionError = '';

  static const List<String> _allAcademicMonths = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
  ];

  @override
  void initState() {
    super.initState();
    _salaryService = StaffSalaryService(baseUrl: widget.baseUrl, token: widget.token);
    if (widget.academicYearName != null && widget.academicYearName!.isNotEmpty) {
      _academicYearName = widget.academicYearName!;
    }
    _academicYearStartDate = widget.academicYearStartDate;
    _loadTeacherDetails();
  }

  Future<void> _loadTeacherDetails() async {
    setState(() {
      _isLoading = true;
      _isActionLoading = false;
      _errorMessage = '';
    });

    try {
      if (_academicYearStartDate == null || _academicYearStartDate!.isEmpty) {
        final years = await _salaryService.getAcademicYears();
        final current = years.firstWhere(
          (y) => y['is_current'] == 1 || y['is_current'] == true || y['is_current'] == '1',
          orElse: () => years.isNotEmpty ? years.first : {},
        );
        if (current.isNotEmpty) {
          _academicYearName = current['name']?.toString() ?? _academicYearName;
          _academicYearStartDate = current['start_date']?.toString();
        }
      }

      final data = await _salaryService.getStaffDetails(widget.staffId);
      if (mounted) {
        setState(() {
          _teacher = data;
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

  List<String> _getVisibleMonths(String? joiningDateStr, String? workingYearStartStr) {
    if (joiningDateStr == null || joiningDateStr.isEmpty) return _allAcademicMonths;
    if (workingYearStartStr == null || workingYearStartStr.isEmpty) return _allAcademicMonths;

    try {
      final joiningDate = DateTime.parse(joiningDateStr);
      final workingYearStart = DateTime.parse(workingYearStartStr);

      final joiningYear = joiningDate.year;
      final joiningMonth = joiningDate.month;

      final startYear = workingYearStart.year;
      final startMonth = workingYearStart.month;

      final diffMonths = (joiningYear - startYear) * 12 + (joiningMonth - startMonth);

      if (diffMonths <= 0) {
        return _allAcademicMonths;
      }
      if (diffMonths >= 12) {
        return [];
      }

      return _allAcademicMonths.sublist(diffMonths);
    } catch (e) {
      return _allAcademicMonths;
    }
  }

  void _showDisburseDialog(String month, double amount, bool isProrated) {
    _actionError = '';
    _isActionLoading = false;
    showDialog(
      context: context,
      barrierDismissible: !_isActionLoading,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: const [
                Icon(Icons.payments_rounded, color: Color(0xFFD97706), size: 24),
                SizedBox(width: 8),
                Text(
                  'Disburse Salary',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_actionError.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.red, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _actionError,
                            style: TextStyle(color: Colors.red.shade800, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const Text(
                  'Please confirm salary disbursement details below:',
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFAF9F6),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      _buildDialogRow('Teacher:', _teacher?['name'] ?? '—', isBold: true),
                      const SizedBox(height: 8),
                      _buildDialogRow('Month:', '$month $_academicYearName', isBold: true),
                      const SizedBox(height: 8),
                      _buildDialogRow(
                        'Amount:',
                        '₹${amount.round().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}${isProrated ? ' (Prorated)' : ''}',
                        textColor: const Color(0xFFD97706),
                        isBold: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'This action will record the salary payment.',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: _isActionLoading ? null : () => Navigator.pop(dialogCtx),
                child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
                onPressed: _isActionLoading
                    ? null
                    : () async {
                        final messenger = ScaffoldMessenger.of(context);
                        setDialogState(() {
                          _isActionLoading = true;
                          _actionError = '';
                        });
                        try {
                          await _salaryService.payStaffSalary(
                            staffId: widget.staffId,
                            month: month,
                          );
                          if (dialogCtx.mounted) {
                            Navigator.pop(dialogCtx);
                          }
                          if (mounted) {
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('Salary for $month disbursed successfully!'),
                                backgroundColor: const Color(0xFF16A34A),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            _loadTeacherDetails();
                          }
                        } catch (err) {
                          if (dialogCtx.mounted) {
                            setDialogState(() {
                              _actionError = err.toString().replaceAll('Exception:', '').trim();
                            });
                          }
                        } finally {
                          if (dialogCtx.mounted) {
                            setDialogState(() {
                              _isActionLoading = false;
                            });
                          } else {
                            _isActionLoading = false;
                          }
                        }
                      },
                child: _isActionLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Confirm Disbursement', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showPrevYearDisburseDialog(List<String> months, double totalAmount) {
    _actionError = '';
    _isActionLoading = false;
    final prevAY = _teacher?['previous_year_pending']?['academic_year_name'] ?? 'Previous Year';
    showDialog(
      context: context,
      barrierDismissible: !_isActionLoading,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: const [
                Icon(Icons.history_edu_rounded, color: Color(0xFFD97706), size: 24),
                SizedBox(width: 8),
                Text(
                  'Disburse Previous Year',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_actionError.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Text(
                      _actionError,
                      style: TextStyle(color: Colors.red.shade800, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
                const Text(
                  'Confirm previous year salary disbursement:',
                  style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      _buildDialogRow('Teacher:', _teacher?['name'] ?? '—', isBold: true),
                      const SizedBox(height: 8),
                      _buildDialogRow('Academic Year:', prevAY, isBold: true),
                      const SizedBox(height: 8),
                      _buildDialogRow('Pending Months:', months.join(', '), isBold: true),
                      const SizedBox(height: 8),
                      _buildDialogRow(
                        'Total Payable:',
                        '₹${totalAmount.round().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                        textColor: const Color(0xFFD97706),
                        isBold: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: _isActionLoading ? null : () => Navigator.pop(dialogCtx),
                child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD97706),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _isActionLoading
                    ? null
                    : () async {
                        final messenger = ScaffoldMessenger.of(context);
                        setDialogState(() {
                          _isActionLoading = true;
                          _actionError = '';
                        });
                        try {
                          await _salaryService.disbursePreviousYearStaffSalary(
                            staffId: widget.staffId,
                            months: months,
                          );
                          if (dialogCtx.mounted) {
                            Navigator.pop(dialogCtx);
                          }
                          if (mounted) {
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Previous year salary disbursed successfully!'),
                                backgroundColor: Color(0xFF16A34A),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            _loadTeacherDetails();
                          }
                        } catch (err) {
                          if (dialogCtx.mounted) {
                            setDialogState(() {
                              _actionError = err.toString().replaceAll('Exception:', '').trim();
                            });
                          }
                        } finally {
                          if (dialogCtx.mounted) {
                            setDialogState(() {
                              _isActionLoading = false;
                            });
                          } else {
                            _isActionLoading = false;
                          }
                        }
                      },
                child: _isActionLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Confirm Disbursement', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildDialogRow(String label, String value, {bool isBold = false, Color? textColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: textColor ?? const Color(0xFF1E293B),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = _teacher;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pop(context, true);
      },
      child: Scaffold(
      backgroundColor: const Color(0xFFFAF9F6), // Warm light background like screenshot
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E293B), size: 18),
          onPressed: () => Navigator.pop(context, true),
        ),
        title: const Text(
          'Teacher Profile',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.bold,
            fontSize: 18,
            letterSpacing: -0.3,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF475569)),
            onPressed: _loadTeacherDetails,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF0D9488)),
            )
          : _errorMessage.isNotEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Colors.red),
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadTeacherDetails,
                          child: const Text('Try Again'),
                        ),
                      ],
                    ),
                  ),
                )
              : t == null
                  ? const Center(child: Text('Teacher profile not found'))
                  : RefreshIndicator(
                      onRefresh: _loadTeacherDetails,
                      color: const Color(0xFF0D9488),
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // 1. Teacher Info Card
                            _buildProfileHeaderCard(t),

                            const SizedBox(height: 16),

                            // 2. Salary Card Section (Academic Year)
                            _buildSalaryCardSection(t),

                            // 4. Previous Year Salary Card Section (if pending)
                            if (t['previous_year_pending'] != null) ...[
                              const SizedBox(height: 16),
                              _buildPreviousYearSalaryCardSection(t),
                            ],

                            const SizedBox(height: 32),
                          ],
                        ),
                      ),
                    ),
      ),
    );
  }

  Widget _buildProfileHeaderCard(Map<String, dynamic> t) {
    final name = t['name']?.toString() ?? 'Teacher';
    final empId = t['employee_id']?.toString();
    final status = t['status']?.toString().toUpperCase() ?? 'ACTIVE';
    final photo = t['photo_path']?.toString() ?? '';

    final initials = name.split(' ').where((s) => s.isNotEmpty).map((s) => s[0]).take(2).join('').toUpperCase();

    // Fallback if employee_id is missing or '-'
    final displayEmpId = (empId != null && empId.isNotEmpty && empId != '-')
        ? empId
        : 'EMP-${widget.staffId.toString().padLeft(3, '0')}';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Profile Photo
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2FE),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFBAE6FD), width: 2),
            ),
            clipBehavior: Clip.antiAlias,
            child: photo.isNotEmpty
                ? Image.network(
                    photo.startsWith('http') ? photo : '${widget.baseUrl}$photo',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Center(
                      child: Text(
                        initials.isNotEmpty ? initials : '??',
                        style: const TextStyle(
                          color: Color(0xFF0369A1),
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
                  )
                : Center(
                    child: Text(
                      initials.isNotEmpty ? initials : '??',
                      style: const TextStyle(
                        color: Color(0xFF0369A1),
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 14),

          // Teacher Name, Employee ID, Active/Inactive status
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'EMPLOYEE ID: $displayEmpId',
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: status == 'ACTIVE' ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: status == 'ACTIVE' ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: status == 'ACTIVE' ? const Color(0xFF15803D) : const Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSalaryCardSection(Map<String, dynamic> t) {
    final joiningDateStr = t['joining_date']?.toString();
    final visibleMonths = _getVisibleMonths(joiningDateStr, _academicYearStartDate);
    final salaryPayments = (t['salary_payments'] as List?) ?? [];
    final defaultSalary = double.tryParse((t['salary'] ?? 0).toString()) ?? 0.0;
    final staffId = widget.staffId;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'SALARY CARD',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  'Academic Year: $_academicYearName',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // Monthly Cards
          Padding(
            padding: const EdgeInsets.all(14),
            child: visibleMonths.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24.0),
                      child: Text('No salary cards available for this academic year.'),
                    ),
                  )
                : Column(
                    children: visibleMonths.map((month) {
                      // Determine payment info
                      final payment = salaryPayments.firstWhere(
                        (p) =>
                            p['payment_month'] == month &&
                            !p['payment_month'].toString().startsWith('Previous Year - ') &&
                            int.tryParse(p['staff_id'].toString()) == staffId,
                        orElse: () => null,
                      );

                      final isPaid = payment != null;
                      double salaryAmount = defaultSalary;
                      bool isProrated = false;

                      if (isPaid) {
                        salaryAmount = double.tryParse((payment['amount_paid'] ?? 0).toString()) ?? defaultSalary;
                        isProrated = payment['is_prorated'] == true ||
                            payment['is_prorated'] == 1 ||
                            salaryAmount < defaultSalary ||
                            payment['proration_details'] != null;
                      } else {
                        final joiningMonthProration = t['joining_month_proration'];
                        final isJoiningMonth = joiningMonthProration != null && joiningMonthProration['month'] == month;
                        if (isJoiningMonth) {
                          salaryAmount = double.tryParse((joiningMonthProration['payable_salary'] ?? 0).toString()) ?? defaultSalary;
                          isProrated = true;
                        } else if (t['monthly_salaries'] != null && t['monthly_salaries'][month] != null) {
                          salaryAmount = double.tryParse((t['monthly_salaries'][month] ?? 0).toString()) ?? defaultSalary;
                          if (salaryAmount < defaultSalary) {
                            isProrated = true;
                          }
                        }
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isPaid ? const Color(0xFFF8FAFC) : Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isPaid ? const Color(0xFFE2E8F0) : const Color(0xFFCBD5E1),
                          ),
                        ),
                        child: Row(
                          children: [
                            // Left details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    month,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Row(
                                    children: [
                                      Text(
                                        isPaid
                                            ? (isProrated ? 'PAID (PRORATED)' : 'PAID')
                                            : (isProrated ? 'PENDING (PRORATED)' : 'PENDING'),
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                                          letterSpacing: 0.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '₹${salaryAmount.round().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Right Action Button (Disburse or Paid badge)
                            if (isPaid)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDCFCE7),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFBBF7D0)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: const [
                                    Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 14),
                                    SizedBox(width: 4),
                                    Text(
                                      'Paid',
                                      style: TextStyle(
                                        color: Color(0xFF16A34A),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            else
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFD97706), // Amber button like screenshot
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                                ),
                                onPressed: () => _showDisburseDialog(month, salaryAmount, isProrated),
                                child: const Text(
                                  'Disburse',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviousYearSalaryCardSection(Map<String, dynamic> t) {
    final prevPending = t['previous_year_pending'];
    if (prevPending == null) return const SizedBox.shrink();

    final prevAYName = prevPending['academic_year_name']?.toString() ?? 'Previous Year';
    final List<dynamic> pendingMonthsRaw = prevPending['pending_months'] ?? [];
    final List<String> pendingMonths = pendingMonthsRaw.map((e) => e.toString()).toList();
    final defaultSalary = double.tryParse((prevPending['salary'] ?? 0).toString()) ?? 0.0;

    double totalPrevPayable = 0.0;
    for (final m in pendingMonths) {
      if (prevPending['monthly_salaries'] != null && prevPending['monthly_salaries'][m] != null) {
        totalPrevPayable += double.tryParse(prevPending['monthly_salaries'][m].toString()) ?? defaultSalary;
      } else {
        totalPrevPayable += defaultSalary;
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              color: Color(0xFFFFF7ED),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.warning_amber_rounded, size: 18, color: Color(0xFFD97706)),
                    SizedBox(width: 6),
                    Text(
                      'PREVIOUS YEAR SALARY CARD',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF9A3412),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFED7AA),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'AY: $prevAYName',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF9A3412)),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFFED7AA)),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${pendingMonths.length} Pending Month${pendingMonths.length > 1 ? 's' : ''}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          pendingMonths.join(', '),
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                    Text(
                      '₹${totalPrevPayable.round().toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFD97706)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 11),
                    ),
                    onPressed: () => _showPrevYearDisburseDialog(pendingMonths, totalPrevPayable),
                    child: const Text('Disburse All Previous Year Dues', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
