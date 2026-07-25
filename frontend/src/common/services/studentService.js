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

  async getPublishedReportCards() {
    return apiClient.get('/api/student/exams-new/report-cards');
  },

  // Word Builder Game
  async getGameProgress() {
    return apiClient.get('/api/student/game/word-builder/progress');
  },
  async syncGameProgress(data) {
    return apiClient.post('/api/student/game/word-builder/progress', data);
  },
  async claimDailyLogin() {
    return apiClient.post('/api/student/game/word-builder/claim-daily');
  },

  // Gamification & Challenges
  async getDailyChallenge() {
    return apiClient.get('/api/student/vocabulary/challenge/daily');
  },
  async submitDailyChallenge(data) {
    return apiClient.post('/api/student/vocabulary/challenge/daily', data);
  },
  async getWeeklyChallenge() {
    return apiClient.get('/api/student/vocabulary/challenge/weekly');
  },
  async submitWeeklyChallenge(data) {
    return apiClient.post('/api/student/vocabulary/challenge/weekly', data);
  },
  async getVocabularyLeaderboard() {
    return apiClient.get('/api/student/vocabulary/leaderboard');
  },
  async getVocabularyAchievements() {
    return apiClient.get('/api/student/vocabulary/achievements');
  },

  // Dashboard Reports
  async getParentVocabularyReport(studentId = null) {
    const url = studentId ? `/api/parent/vocabulary/report?student_id=${studentId}` : '/api/parent/vocabulary/report';
    return apiClient.get(url);
  },
  async getTeacherVocabularyReport(classId) {
    return apiClient.get(`/api/teacher/vocabulary/report?class_id=${classId}`);
  },
  async getSchoolVocabularyAnalytics() {
    return apiClient.get('/api/school/vocabulary/analytics');
  },
};
