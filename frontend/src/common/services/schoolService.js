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

  updateClass(classData) {
    return apiClient.put('/api/school/classes', classData);
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

  updateAdditionalFeeType(id, data) {
    return apiClient.put(`/api/school/additional-fees/types/${id}`, data);
  },

  deleteAdditionalFeeType(id) {
    return apiClient.delete(`/api/school/additional-fees/types/${id}`);
  },

  getAdditionalFeePayments() {
    return apiClient.get('/api/school/additional-fees/payments');
  },

  collectAdditionalFeePayment(id) {
    return apiClient.post(`/api/school/additional-fees/payments/${id}/pay`);
  },

  revertAdditionalFeePayment(id) {
    return apiClient.post(`/api/school/additional-fees/payments/${id}/revert`);
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
  }
};

