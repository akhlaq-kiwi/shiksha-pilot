import { apiClient } from './apiClient';

const buildUrl = (endpoint, params = {}) => {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `${endpoint}?${query}` : endpoint;
};

export const schoolService = {
  getStats() {
    return apiClient.get('/api/school/stats');
  },

  getStudents(params = {}) {
    return apiClient.get(buildUrl('/api/school/students', params));
  },

  createStudent(studentData) {
    return apiClient.post('/api/school/students', studentData);
  },

  getStudentById(id) {
    return apiClient.get(`/api/school/students/${id}`);
  },

  updateStudent(id, studentData) {
    return apiClient.put(`/api/school/students/${id}`, studentData);
  },

  advanceStudent(id, classId) {
    return apiClient.post(`/api/school/students/${id}/advance`, { class_id: classId });
  },

  uploadDocument(formData) {
    return apiClient.post('/api/school/upload', formData);
  },

  getAcademicYears() {
    return apiClient.get('/api/school/academic-years');
  },

  getStaff(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/staff${query ? '?' + query : ''}`);
  },

  getStaffDetails(id, params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/staff/${id}${query ? '?' + query : ''}`);
  },

  createStaff(staffData) {
    return apiClient.post('/api/school/staff', staffData);
  },

  updateStaff(id, staffData) {
    return apiClient.put(`/api/school/staff/${id}`, staffData);
  },

  getAvailableStaff() {
    return this.getStaff().then(list => (list || []).filter(s => s.status === 'ACTIVE' && (s.assigned_periods || 0) < (s.max_periods || 8)));
  },

  getClasses() {
    return apiClient.get('/api/school/classes');
  },

  createClass(classData) {
    return apiClient.post('/api/school/classes', classData);
  },

  deleteClass(className) {
    return apiClient.delete(`/api/school/classes?name=${encodeURIComponent(className)}`, { body: { name: className } });
  },

  deleteSection(classId) {
    return apiClient.delete('/api/school/classes/sections', { data: { class_id: classId } });
  },

  getExams() {
    return apiClient.get('/api/school/exams');
  },

  createExam(examData) {
    return apiClient.post('/api/school/exams', examData);
  },

  getAttendance(params = {}) {
    return apiClient.get(buildUrl('/api/school/attendance', params));
  },

  markAttendance(attendanceData) {
    return apiClient.post('/api/school/attendance', attendanceData);
  },

  getHolidays() {
    return apiClient.get('/api/school/holidays');
  },

  createHoliday(data) {
    return apiClient.post('/api/school/holidays', data);
  },

  updateHoliday(id, data) {
    return apiClient.put(`/api/school/holidays/${id}`, data);
  },

  deleteHoliday(id) {
    return apiClient.delete(`/api/school/holidays/${id}`);
  },

  getExaminations() {
    return apiClient.get('/api/school/exams-new');
  },

  createExamination(data) {
    return apiClient.post('/api/school/exams-new', data);
  },

  getExaminationDetails(id) {
    return apiClient.get(`/api/school/exams-new/${id}`);
  },

  deleteExamination(id) {
    return apiClient.delete(`/api/school/exams-new/${id}`);
  },

  updateExamination(id, data) {
    return apiClient.put(`/api/school/exams-new/${id}`, data);
  },

  getExamTimetable(examId, classId) {
    const url = buildUrl(`/api/school/exams-new/${examId}/timetable`, { class_id: classId });
    return apiClient.get(url);
  },

  saveExamTimetable(examId, classId, data) {
    const url = buildUrl(`/api/school/exams-new/${examId}/timetable`, { class_id: classId });
    return apiClient.post(url, data);
  },

  getExamMarksSheet(examId, classId, subjectId) {
    const url = buildUrl(`/api/school/exams-new/${examId}/marks`, { class_id: classId, subject_id: subjectId });
    return apiClient.get(url);
  },

  saveExamMark(examId, data) {
    return apiClient.post(`/api/school/exams-new/${examId}/marks`, data);
  },

  publishExamResults(examId, classId, status = 'Published') {
    return apiClient.post(`/api/school/exams-new/${examId}/publish`, { class_id: classId, status });
  },

  publishExamScheme(examId, classId) {
    return apiClient.post(`/api/school/exams-new/${examId}/publish-scheme`, { class_id: classId });
  },

  unpublishExamScheme(examId, classId) {
    return apiClient.post(`/api/school/exams-new/${examId}/unpublish-scheme`, { class_id: classId });
  },

  publishExamAdmitCards(examId, classId) {
    return apiClient.post(`/api/school/exams-new/${examId}/publish-admit-card`, { class_id: classId });
  },

  unpublishExamAdmitCards(examId, classId) {
    return apiClient.post(`/api/school/exams-new/${examId}/unpublish-admit-card`, { class_id: classId });
  },

  getReportCards(examId, classId, studentId = null) {
    const query = { class_id: classId };
    if (studentId) query.student_id = studentId;
    const url = buildUrl(`/api/school/exams-new/${examId}/report-cards`, query);
    return apiClient.get(url);
  },

  getExamClassStatuses(examId) {
    return apiClient.get(`/api/school/exams-new/${examId}/class-status`);
  },

  getExamInstructions(examId, classId) {
    return apiClient.get(`/api/school/exams-new/${examId}/instructions?class_id=${classId}`);
  },

  saveExamInstructions(examId, classId, data) {
    return apiClient.post(`/api/school/exams-new/${examId}/instructions?class_id=${classId}`, data);
  },

  getSeatingPlan(examId) {
    return apiClient.get(`/api/school/exams-new/${examId}/seating-plan`);
  },

  previewSeatingPlan(examId, data) {
    return apiClient.post(`/api/school/exams-new/${examId}/seating-plan/preview`, data);
  },

  generateSeatingPlan(examId, data) {
    return apiClient.post(`/api/school/exams-new/${examId}/seating-plan`, data);
  },

  deleteSeatingPlan(examId) {
    return apiClient.delete(`/api/school/exams-new/${examId}/seating-plan`);
  },

  getGradeConfigurations() {
    return apiClient.get('/api/school/grade-configurations');
  },

  saveGradeConfigurations(data) {
    return apiClient.post('/api/school/grade-configurations', data);
  },

  getFeeStructures() {
    return apiClient.get('/api/school/fee-structures');
  },

  createFeeStructure(data) {
    return apiClient.post('/api/school/fee-structures', data);
  },

  getFeePayments() {
    return apiClient.get('/api/school/fee-payments');
  },

  createFeePayment(data) {
    return apiClient.post('/api/school/fee-payments', data);
  },

  getTimetable() {
    return apiClient.get('/api/school/timetable');
  },

  getSubjects() {
    return apiClient.get('/api/school/subjects');
  },

  getSchoolProfile() {
    return apiClient.get('/api/school/profile');
  },

  getActivePlans() {
    return apiClient.get('/api/school/plans');
  },

  getSubscriptionHistory() {
    return apiClient.get('/api/school/subscriptions');
  },

  updateSchoolProfile(data) {
    return apiClient.post('/api/school/profile', data);
  },

  uploadSchoolLogo(formData) {
    return apiClient.post('/api/school/profile/logo', formData);
  },

  removeSchoolLogo() {
    return apiClient.delete('/api/school/profile/logo');
  },

  uploadPrincipalSignature(formData) {
    return apiClient.post('/api/school/profile/signature', formData);
  },

  removePrincipalSignature() {
    return apiClient.delete('/api/school/profile/signature');
  },

  updateClass(classData) {
    return apiClient.put('/api/school/classes', classData);
  },

  transferStudents(payload) {
    return apiClient.post('/api/school/classes/transfer-students', payload);
  },

  revertFeePayment(id) {
    return apiClient.delete(`/api/school/fee-payments/${id}`);
  },

  getClassFeeConfigurations(params = {}) {
    return apiClient.get(buildUrl('/api/school/class-fee-configurations', params));
  },

  saveClassFeeConfiguration(payload) {
    return apiClient.post('/api/school/class-fee-configurations', payload);
  },

  lockClassFeeConfiguration(payload) {
    return apiClient.post('/api/school/class-fee-configurations/lock', payload);
  },

  checkSrNoExists(params) {
    return apiClient.get(buildUrl('/api/school/students/check-sr-no', params));
  },

  createAcademicYear(data) {
    return apiClient.post('/api/school/academic-years', data);
  },

  activateAcademicYear(id, data) {
    return apiClient.post(`/api/school/academic-years/${id}/activate`, data);
  },

  migrateAcademicYear(id, data) {
    return apiClient.post(`/api/school/academic-years/${id}/migrate`, data);
  },

  getNextRollNo(classId) {
    return apiClient.get(`/api/school/classes/${classId}/next-roll-no`);
  },

  getStaffPayments(params) {
    return apiClient.get(buildUrl('/api/school/staff-payments', params));
  },

  payStaffSalary(data) {
    return apiClient.post('/api/school/staff-payments', data);
  },

  disbursePreviousYearStaffSalary(data) {
    return apiClient.post('/api/school/staff-payments/disburse-previous-year', data);
  },

  revertStaffSalary(id) {
    return apiClient.delete(`/api/school/staff-payments/${id}`);
  },

  getFinancialReports() {
    return apiClient.get('/api/school/financial-reports');
  },

  getFinancialPreview(params) {
    return apiClient.get(buildUrl('/api/school/financial-reports/preview', params));
  },

  createFinancialReport(data) {
    return apiClient.post('/api/school/financial-reports', data);
  },

  updateFinancialReportStatus(id, data) {
    return apiClient.put(`/api/school/financial-reports/${id}/settle`, data);
  },

  submitSettlementRequest(id) {
    return apiClient.post(`/api/school/financial-reports/${id}/settlement-request`);
  },

  exportFinancialReport(id) {
    return apiClient.get(`/api/school/financial-reports/${id}/export`);
  },

  getSchoolExpenses(params = {}) {
    return apiClient.get(buildUrl('/api/school/expenses', params));
  },

  createSchoolExpense(data) {
    return apiClient.post('/api/school/expenses', data);
  },

  updateSchoolExpense(id, data) {
    return apiClient.put(`/api/school/expenses/${id}`, data);
  },

  deleteSchoolExpense(id) {
    return apiClient.delete(`/api/school/expenses/${id}`);
  },

  getAdditionalFeeTypes() {
    return apiClient.get('/api/school/additional-fees/types');
  },

  createAdditionalFeeType(data) {
    return apiClient.post('/api/school/additional-fees/types', data);
  },

  createAnnualFee(data) {
    return apiClient.post('/api/school/annual-fees', data);
  },

  updateAdditionalFeeType(id, data) {
    return apiClient.put(`/api/school/additional-fees/types/${id}`, data);
  },

  deleteAdditionalFeeType(id) {
    return apiClient.delete(`/api/school/additional-fees/types/${id}`);
  },

  getAdditionalFeePayments() {
    return apiClient.get('/api/school/additional-fees/payments');
  },

  getTransportFees(params = {}) {
    return apiClient.get(buildUrl('/api/school/transport-fees', params));
  },

  assignTransportFee(data = {}) {
    return apiClient.post('/api/school/transport-fees', data);
  },

  updateTransportFee(id, data = {}) {
    return apiClient.put(`/api/school/transport-fees/${id}`, data);
  },

  deleteTransportFee(id) {
    return apiClient.delete(`/api/school/transport-fees/${id}`);
  },

  toggleTransportFeeStatus(id, data = {}) {
    return apiClient.put(`/api/school/transport-fees/${id}/status`, data);
  },

  collectAdditionalFeePayment(id, data = {}) {
    return apiClient.post(`/api/school/additional-fees/payments/${id}/pay`, data);
  },

  revertAdditionalFeePayment(id) {
    return apiClient.post(`/api/school/additional-fees/payments/${id}/revert`);
  },

  getCollectionHistory(params = {}) {
    return apiClient.get(buildUrl('/api/school/collection-history', params));
  },

  getHolidays() {
    return apiClient.get('/api/school/holidays');
  },

  getFeeFollowUps(params = {}) {
    return apiClient.get(buildUrl('/api/school/fee-follow-ups', params));
  },

  createFeeFollowUp(data) {
    return apiClient.post('/api/school/fee-follow-ups', data);
  },

  getFeeFollowUpDetails(id) {
    return apiClient.get(`/api/school/fee-follow-ups/${id}`);
  },

  updateFeeFollowUp(id, data) {
    return apiClient.put(`/api/school/fee-follow-ups/${id}`, data);
  },

  deleteFeeFollowUp(id) {
    return apiClient.delete(`/api/school/fee-follow-ups/${id}`);
  },

  extendFeeFollowUp(id, data) {
    return apiClient.put(`/api/school/fee-follow-ups/${id}/extend`, data);
  },

  updateFeeFollowUpStatus(id, data) {
    return apiClient.put(`/api/school/fee-follow-ups/${id}/status`, data);
  },

  addFollowUpNote(id, data) {
    return apiClient.post(`/api/school/fee-follow-ups/${id}/notes`, data);
  },

  markFollowUpContacted(id, data = {}) {
    return apiClient.post(`/api/school/fee-follow-ups/${id}/contacted`, data);
  },

  getStudentOutstandingFee(studentId) {
    return apiClient.get(`/api/school/students/${studentId}/outstanding-fee`);
  },

  getStudentFollowUps(studentId) {
    return apiClient.get(`/api/school/students/${studentId}/follow-ups`);
  },

  getNotifications() {
    return apiClient.get('/api/school/notifications');
  },

  markNotificationRead(id) {
    return apiClient.post(`/api/school/notifications/${id}/read`);
  },

  getLeaveRequests(params = {}) {
    return apiClient.get(buildUrl('/api/school/leave-requests', params));
  },

  applyLeaveRequest(data) {
    return apiClient.post('/api/school/leave-requests', data);
  },

  updateLeaveRequestStatus(id, data) {
    return apiClient.put(`/api/school/leave-requests/${id}/status`, data);
  },

  cancelLeaveRequest(id) {
    return apiClient.put(`/api/school/leave-requests/${id}/cancel`);
  },

  uploadLeaveAttachment(formData) {
    return apiClient.post('/api/school/leave-requests/upload', formData);
  },

  getMenuPermissions() {
    return apiClient.get('/api/school/menu-permissions');
  },

  saveMenuPermissions(payload) {
    return apiClient.post('/api/school/menu-permissions', payload);
  },

  getClassTeacherAssignments() {
    return apiClient.get('/api/school/class-teacher-assignments');
  },

  saveClassTeacherAssignments(payload) {
    return apiClient.post('/api/school/class-teacher-assignments', payload);
  },

  getMyPermissions() {
    return apiClient.get('/api/school/my-permissions');
  },
  getAnnouncements() {
    return apiClient.get('/api/school/announcements');
  },
  createAnnouncement(data) {
    return apiClient.post('/api/school/announcements', data);
  },
  updateAnnouncement(id, data) {
    return apiClient.put(`/api/school/announcements/${id}`, data);
  },
  deleteAnnouncement(id) {
    return apiClient.delete(`/api/school/announcements/${id}`);
  },
  getLatePaymentPenaltyStats() {
    return apiClient.get('/api/school/late-payment-penalty/stats');
  },
  getLatePaymentPenaltyConfig() {
    return apiClient.get('/api/school/late-payment-penalty/config');
  },
  saveLatePaymentPenaltyConfig(data) {
    return apiClient.post('/api/school/late-payment-penalty/config', data);
  },
  checkLatePaymentPenaltyConfig() {
    return apiClient.get('/api/school/late-payment-penalty/config/check');
  },
  deleteLatePaymentPenaltyConfig() {
    return apiClient.delete('/api/school/late-payment-penalty/config');
  },
  getFinanceSettings() {
    return apiClient.get('/api/school/finance-settings');
  },
  saveFinanceSettings(data) {
    return apiClient.post('/api/school/finance-settings', data);
  },
  getLatePaymentPenaltyHistory(params = {}) {
    return apiClient.get(buildUrl('/api/school/late-payment-penalty/history', params));
  },
  getReportCardTemplates() {
    return apiClient.get('/api/platform/report-card-templates');
  },
  createReportCardTemplate(templateData) {
    return apiClient.post('/api/platform/report-card-templates', templateData);
  },
  updateReportCardTemplate(id, templateData) {
    return apiClient.put(`/api/platform/report-card-templates/${id}`, templateData);
  },
  deleteReportCardTemplate(id) {
    return apiClient.delete(`/api/platform/report-card-templates/${id}`);
  },
  assignReportCardTemplateToSchool(schoolId, templateId) {
    return apiClient.post(`/api/platform/schools/${schoolId}/report-card-template`, { template_id: templateId });
  }
};

