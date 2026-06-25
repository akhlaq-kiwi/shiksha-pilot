import { apiClient } from './apiClient';

export const schoolAdminService = {
  // School Profile
  async getSchoolProfile() {
    return apiClient.get('/api/school/profile');
  },
  async updateSchoolProfile(data) {
    return apiClient.put('/api/school/profile', data);
  },

  // Academic Management
  async getAcademicYears() {
    return apiClient.get('/api/school/academic-years');
  },
  async createAcademicYear(data) {
    return apiClient.post('/api/school/academic-years', data);
  },
  async getClasses() {
    return apiClient.get('/api/school/classes');
  },
  async createClass(data) {
    return apiClient.post('/api/school/classes', data);
  },
  async getSections() {
    return apiClient.get('/api/school/sections');
  },
  async createSection(data) {
    return apiClient.post('/api/school/sections', data);
  },
  async getSubjects() {
    return apiClient.get('/api/school/subjects');
  },
  async createSubject(data) {
    return apiClient.post('/api/school/subjects', data);
  },
  async getTerms() {
    return apiClient.get('/api/school/terms');
  },
  async createTerm(data) {
    return apiClient.post('/api/school/terms', data);
  },

  // Student Management
  async getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/students${query ? '?' + query : ''}`);
  },
  async getStudent(id) {
    return apiClient.get(`/api/school/students/${id}`);
  },
  async createStudent(data) {
    return apiClient.post('/api/school/students', data);
  },
  async updateStudent(id, data) {
    return apiClient.put(`/api/school/students/${id}`, data);
  },
  async deleteStudent(id) {
    return apiClient.delete(`/api/school/students/${id}`);
  },
  async promoteStudents(data) {
    return apiClient.post('/api/school/students/promote', data);
  },
  async transferStudent(id, data) {
    return apiClient.post(`/api/school/students/${id}/transfer`, data);
  },

  // Staff Management
  async getStaff(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/staff${query ? '?' + query : ''}`);
  },
  async getStaffMember(id) {
    return apiClient.get(`/api/school/staff/${id}`);
  },
  async createStaff(data) {
    return apiClient.post('/api/school/staff', data);
  },
  async updateStaff(id, data) {
    return apiClient.put(`/api/school/staff/${id}`, data);
  },
  async deleteStaff(id) {
    return apiClient.delete(`/api/school/staff/${id}`);
  },
  async getLeaveRequests() {
    return apiClient.get('/api/school/staff/leaves');
  },
  async updateLeaveRequest(id, data) {
    return apiClient.put(`/api/school/staff/leaves/${id}`, data);
  },

  // Timetable
  async getTimetable(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/timetable${query ? '?' + query : ''}`);
  },
  async createTimetableEntry(data) {
    return apiClient.post('/api/school/timetable', data);
  },
  async updateTimetableEntry(id, data) {
    return apiClient.put(`/api/school/timetable/${id}`, data);
  },
  async deleteTimetableEntry(id) {
    return apiClient.delete(`/api/school/timetable/${id}`);
  },
  async getSubstitutes() {
    return apiClient.get('/api/school/timetable/substitutes');
  },

  // Attendance
  async getStudentAttendance(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/attendance/students${query ? '?' + query : ''}`);
  },
  async markStudentAttendance(data) {
    return apiClient.post('/api/school/attendance/students', data);
  },
  async getStaffAttendance(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/attendance/staff${query ? '?' + query : ''}`);
  },
  async markStaffAttendance(data) {
    return apiClient.post('/api/school/attendance/staff', data);
  },
  async getAttendanceReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/attendance/report${query ? '?' + query : ''}`);
  },

  // Examinations
  async getExams() {
    return apiClient.get('/api/school/exams');
  },
  async createExam(data) {
    return apiClient.post('/api/school/exams', data);
  },
  async updateExam(id, data) {
    return apiClient.put(`/api/school/exams/${id}`, data);
  },
  async getMarks(examId) {
    return apiClient.get(`/api/school/exams/${examId}/marks`);
  },
  async enterMarks(examId, data) {
    return apiClient.post(`/api/school/exams/${examId}/marks`, data);
  },
  async publishResults(examId) {
    return apiClient.post(`/api/school/exams/${examId}/publish`, {});
  },
  async getReportCards(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/exams/report-cards${query ? '?' + query : ''}`);
  },

  // Finance
  async getFeeStructures() {
    return apiClient.get('/api/school/finance/fee-structures');
  },
  async createFeeStructure(data) {
    return apiClient.post('/api/school/finance/fee-structures', data);
  },
  async getFeeCollections(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/finance/collections${query ? '?' + query : ''}`);
  },
  async collectFee(data) {
    return apiClient.post('/api/school/finance/collections', data);
  },
  async getExpenses() {
    return apiClient.get('/api/school/finance/expenses');
  },
  async createExpense(data) {
    return apiClient.post('/api/school/finance/expenses', data);
  },
  async getScholarships() {
    return apiClient.get('/api/school/finance/scholarships');
  },
  async createScholarship(data) {
    return apiClient.post('/api/school/finance/scholarships', data);
  },
  async getFinancialReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/finance/report${query ? '?' + query : ''}`);
  },
  async getPayroll() {
    return apiClient.get('/api/school/finance/payroll');
  },
  async processPayroll(data) {
    return apiClient.post('/api/school/finance/payroll', data);
  },

  // Reports
  async getStudentReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/reports/students${query ? '?' + query : ''}`);
  },
  async getAttendanceReportSummary(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/reports/attendance${query ? '?' + query : ''}`);
  },
  async getExamReport(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/reports/exams${query ? '?' + query : ''}`);
  },

  // Security
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/security/audit-logs${query ? '?' + query : ''}`);
  },
  async getLoginHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/api/school/security/login-history${query ? '?' + query : ''}`);
  },
};
