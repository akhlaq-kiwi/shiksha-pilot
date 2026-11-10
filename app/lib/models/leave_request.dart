class LeaveRequest {
  final int id;
  final int schoolId;
  final int academicYearId;
  final String applicantRole;
  final int? studentId;
  final int? teacherId;
  final String leaveType;
  final String fromDate;
  final String toDate;
  final String reason;
  final String? attachmentPath;
  final String status;
  final String? rejectReason;
  final String? studentName;
  final String? teacherName;
  final String? teacherDepartment;
  final String? classLabel;
  final String? rollNo;
  final String? teacherEmployeeId;
  final String? photoPath;


  LeaveRequest({
    required this.id,
    required this.schoolId,
    required this.academicYearId,
    required this.applicantRole,
    this.studentId,
    this.teacherId,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.reason,
    this.attachmentPath,
    required this.status,
    this.rejectReason,
    this.studentName,
    this.teacherName,
    this.teacherDepartment,
    this.classLabel,
    this.rollNo,
    this.teacherEmployeeId,
    this.photoPath,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      schoolId: json['school_id'] is int ? json['school_id'] : int.parse(json['school_id'].toString()),
      academicYearId: json['academic_year_id'] is int ? json['academic_year_id'] : int.parse(json['academic_year_id'].toString()),
      applicantRole: json['applicant_role'] ?? 'STUDENT',
      studentId: json['student_id'] != null ? (json['student_id'] is int ? json['student_id'] : int.parse(json['student_id'].toString())) : null,
      teacherId: json['teacher_id'] != null ? (json['teacher_id'] is int ? json['teacher_id'] : int.parse(json['teacher_id'].toString())) : null,
      leaveType: json['leave_type'] ?? '',
      fromDate: json['from_date'] ?? '',
      toDate: json['to_date'] ?? '',
      reason: json['reason'] ?? '',
      attachmentPath: json['attachment_path'],
      status: json['status'] ?? 'PENDING',
      rejectReason: json['reject_reason'],
      studentName: json['student_name'],
      teacherName: json['teacher_name'],
      teacherDepartment: json['teacher_department'],
      classLabel: json['class_name'] != null
          ? ((json['class_section'] != null && json['class_section'].toString().trim().isNotEmpty)
              ? "${json['class_name']} - ${json['class_section']}"
              : "${json['class_name']}")
          : null,
      rollNo: json['student_roll_no'] != null ? json['student_roll_no'].toString() : (json['roll_no'] != null ? json['roll_no'].toString() : null),
      teacherEmployeeId: json['teacher_employee_id'] != null 
          ? json['teacher_employee_id'].toString() 
          : (json['employee_id'] != null ? json['employee_id'].toString() : null),
      photoPath: json['photo_path'] ?? json['photo'] ?? json['student_photo'] ?? json['staff_photo_path'],
    );
  }

  String? get formattedEmpId {
    if (teacherEmployeeId != null && teacherEmployeeId!.trim().isNotEmpty) {
      final raw = teacherEmployeeId!.trim();
      final stripped = raw.replaceAll(RegExp(r'^EMP[-:\s]*', caseSensitive: false), '');
      return stripped.isNotEmpty ? stripped : raw;
    }
    if (teacherId != null) {
      return teacherId.toString();
    }
    return null;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'school_id': schoolId,
      'academic_year_id': academicYearId,
      'applicant_role': applicantRole,
      'student_id': studentId,
      'teacher_id': teacherId,
      'leave_type': leaveType,
      'from_date': fromDate,
      'to_date': toDate,
      'reason': reason,
      'attachment_path': attachmentPath,
      'status': status,
      'reject_reason': rejectReason,
    };
  }
}
