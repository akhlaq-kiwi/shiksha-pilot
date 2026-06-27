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

  getStaff() {
    return apiClient.get('/api/school/staff');
  },

  createStaff(staffData) {
    return apiClient.post('/api/school/staff', staffData);
  },

  updateStaff(id, staffData) {
    return apiClient.put(`/api/school/staff/${id}`, staffData);
  },

  getAvailableStaff() {
    return this.getStaff().then(list => (list || []).filter(s => (s.assigned_periods || 0) < (s.max_periods || 8)));
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
  },

  updateClass(classData) {
    return apiClient.put('/api/school/classes', classData);
  },

  revertFeePayment(id) {
    return apiClient.delete(`/api/school/fee-payments/${id}`);
  }
};

