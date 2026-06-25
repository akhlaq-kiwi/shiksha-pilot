import { apiClient } from './apiClient';

export const studentService = {
  // Dashboard
  async getDashboard() {
    return apiClient.get('/api/student/dashboard');
  },

  // Academics
  async getTimetable() {
    return apiClient.get('/api/student/timetable');
  },
  async getSubjects() {
    return apiClient.get('/api/student/subjects');
  },
  async getResults() {
    return apiClient.get('/api/student/results');
  },
  async getReportCards() {
    return apiClient.get('/api/student/report-cards');
  },

  // Assignments
  async getAssignments() {
    return apiClient.get('/api/student/assignments');
  },
  async submitAssignment(assignmentId, formData) {
    return apiClient.post(`/api/student/assignments/${assignmentId}/submit`, formData, {
      headers: { /* let browser set multipart boundary */ },
    });
  },
  async getAssignmentHistory() {
    return apiClient.get('/api/student/assignments/history');
  },

  // Attendance
  async getAttendance(month, year) {
    return apiClient.get(`/api/student/attendance?month=${month}&year=${year}`);
  },
  async getAttendanceSummary() {
    return apiClient.get('/api/student/attendance/summary');
  },

  // Fees
  async getFees() {
    return apiClient.get('/api/student/fees');
  },
  async initiatePayment(paymentData) {
    return apiClient.post('/api/student/fees/pay', paymentData);
  },
  async getReceipts() {
    return apiClient.get('/api/student/fees/receipts');
  },

  // Learning Resources
  async getNotes() {
    return apiClient.get('/api/student/resources/notes');
  },
  async getVideos() {
    return apiClient.get('/api/student/resources/videos');
  },
  async getStudyMaterials() {
    return apiClient.get('/api/student/resources/materials');
  },

  // Parent-specific
  async getChildren() {
    return apiClient.get('/api/parent/children');
  },
  async getChildData(childId, section) {
    return apiClient.get(`/api/parent/children/${childId}/${section}`);
  },
  async submitLeaveRequest(childId, leaveData) {
    return apiClient.post(`/api/parent/children/${childId}/leave`, leaveData);
  },
};
