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

  getStaff() {
    return apiClient.get('/api/school/staff');
  },

  createStaff(staffData) {
    return apiClient.post('/api/school/staff', staffData);
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

  updateSchoolProfile(data) {
    return apiClient.post('/api/school/profile', data);
  }
};
