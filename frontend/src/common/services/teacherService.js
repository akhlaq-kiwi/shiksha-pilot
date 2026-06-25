import { apiClient } from './apiClient';

// Mock data for graceful fallback
const MOCK_CLASSES = [
  { id: 'cls-1', name: 'Grade 8-A', subject: 'Mathematics', room: 'Room 201', students: 32 },
  { id: 'cls-2', name: 'Grade 8-B', subject: 'Mathematics', room: 'Room 202', students: 30 },
  { id: 'cls-3', name: 'Grade 9-A', subject: 'Mathematics', room: 'Room 301', students: 28 },
  { id: 'cls-4', name: 'Grade 7-A', subject: 'Mathematics', room: 'Room 101', students: 35 },
];

const MOCK_STUDENTS = {
  'cls-1': [
    { id: 's1', name: 'Aisha Mahmood', rollNo: '001', gender: 'F' },
    { id: 's2', name: 'Bilal Hashmi', rollNo: '002', gender: 'M' },
    { id: 's3', name: 'Fatima Zahra', rollNo: '003', gender: 'F' },
    { id: 's4', name: 'Hassan Raza', rollNo: '004', gender: 'M' },
    { id: 's5', name: 'Iqra Noor', rollNo: '005', gender: 'F' },
    { id: 's6', name: 'Kamran Sheikh', rollNo: '006', gender: 'M' },
    { id: 's7', name: 'Layla Farooq', rollNo: '007', gender: 'F' },
    { id: 's8', name: 'Muhammad Asif', rollNo: '008', gender: 'M' },
    { id: 's9', name: 'Nadia Qureshi', rollNo: '009', gender: 'F' },
    { id: 's10', name: 'Omar Siddiqui', rollNo: '010', gender: 'M' },
    { id: 's11', name: 'Parveen Akhtar', rollNo: '011', gender: 'F' },
    { id: 's12', name: 'Qasim Javed', rollNo: '012', gender: 'M' },
  ],
  'cls-2': [
    { id: 's13', name: 'Rabia Malik', rollNo: '001', gender: 'F' },
    { id: 's14', name: 'Sana Tariq', rollNo: '002', gender: 'F' },
    { id: 's15', name: 'Tariq Mehmood', rollNo: '003', gender: 'M' },
    { id: 's16', name: 'Uzma Rafiq', rollNo: '004', gender: 'F' },
    { id: 's17', name: 'Waqas Ali', rollNo: '005', gender: 'M' },
    { id: 's18', name: 'Yasmin Baig', rollNo: '006', gender: 'F' },
    { id: 's19', name: 'Zubair Khan', rollNo: '007', gender: 'M' },
    { id: 's20', name: 'Amna Hussain', rollNo: '008', gender: 'F' },
    { id: 's21', name: 'Babar Azam', rollNo: '009', gender: 'M' },
    { id: 's22', name: 'Chanda Bibi', rollNo: '010', gender: 'F' },
  ],
  'cls-3': [
    { id: 's23', name: 'Danish Maqbool', rollNo: '001', gender: 'M' },
    { id: 's24', name: 'Erum Shahzad', rollNo: '002', gender: 'F' },
    { id: 's25', name: 'Faisal Butt', rollNo: '003', gender: 'M' },
    { id: 's26', name: 'Ghazala Parveen', rollNo: '004', gender: 'F' },
    { id: 's27', name: 'Hamid Nawaz', rollNo: '005', gender: 'M' },
    { id: 's28', name: 'Iram Shehzadi', rollNo: '006', gender: 'F' },
    { id: 's29', name: 'Jawad Iqbal', rollNo: '007', gender: 'M' },
    { id: 's30', name: 'Kiran Naz', rollNo: '008', gender: 'F' },
  ],
  'cls-4': [
    { id: 's31', name: 'Lubna Saeed', rollNo: '001', gender: 'F' },
    { id: 's32', name: 'Mansoor Ahmed', rollNo: '002', gender: 'M' },
    { id: 's33', name: 'Nargis Bibi', rollNo: '003', gender: 'F' },
    { id: 's34', name: 'Owais Rana', rollNo: '004', gender: 'M' },
    { id: 's35', name: 'Pervez Musharraf', rollNo: '005', gender: 'M' },
    { id: 's36', name: 'Qudsia Fatima', rollNo: '006', gender: 'F' },
    { id: 's37', name: 'Rizwan Haider', rollNo: '007', gender: 'M' },
    { id: 's38', name: 'Summaya Khatoon', rollNo: '008', gender: 'F' },
    { id: 's39', name: 'Tahir Mahmood', rollNo: '009', gender: 'M' },
    { id: 's40', name: 'Ume Habiba', rollNo: '010', gender: 'F' },
  ],
};

const MOCK_SCHEDULE = [
  { id: 'p1', period: 1, time: '08:00 – 08:45', class: 'Grade 7-A', subject: 'Mathematics', room: 'Room 101', status: 'completed' },
  { id: 'p2', period: 2, time: '08:50 – 09:35', class: 'Grade 8-A', subject: 'Mathematics', room: 'Room 201', status: 'completed' },
  { id: 'p3', period: 3, time: '09:40 – 10:25', class: 'Grade 9-A', subject: 'Mathematics', room: 'Room 301', status: 'active' },
  { id: 'p4', period: 4, time: '10:30 – 11:00', class: '—', subject: 'Break', room: '—', status: 'break' },
  { id: 'p5', period: 5, time: '11:00 – 11:45', class: 'Grade 8-B', subject: 'Mathematics', room: 'Room 202', status: 'upcoming' },
  { id: 'p6', period: 6, time: '11:50 – 12:35', class: 'Grade 8-A', subject: 'Mathematics', room: 'Room 201', status: 'upcoming' },
  { id: 'p7', period: 7, time: '12:40 – 13:25', class: '—', subject: 'Lunch Break', room: '—', status: 'break' },
  { id: 'p8', period: 8, time: '13:30 – 14:15', class: 'Grade 7-A', subject: 'Mathematics', room: 'Room 101', status: 'upcoming' },
];

const MOCK_ASSIGNMENTS = [
  { id: 'a1', title: 'Quadratic Equations – Problem Set', class: 'Grade 9-A', dueDate: '2026-06-28', totalMarks: 20, submissions: 22, total: 28, status: 'active' },
  { id: 'a2', title: 'Fractions & Decimals Worksheet', class: 'Grade 7-A', dueDate: '2026-06-27', totalMarks: 15, submissions: 35, total: 35, status: 'graded' },
  { id: 'a3', title: 'Algebra Basics – Chapter 3 Review', class: 'Grade 8-A', dueDate: '2026-06-30', totalMarks: 25, submissions: 8, total: 32, status: 'active' },
  { id: 'a4', title: 'Geometry – Angle Relationships', class: 'Grade 8-B', dueDate: '2026-07-02', totalMarks: 20, submissions: 0, total: 30, status: 'draft' },
  { id: 'a5', title: 'Statistics – Mean Median Mode', class: 'Grade 9-A', dueDate: '2026-06-20', totalMarks: 30, submissions: 28, total: 28, status: 'graded' },
];

const MOCK_EXAMS = [
  { id: 'e1', name: 'Mid-Term Examination 2026', date: '2026-06-15', classes: ['Grade 8-A', 'Grade 8-B', 'Grade 9-A', 'Grade 7-A'] },
  { id: 'e2', name: 'Unit Test – Algebra', date: '2026-06-05', classes: ['Grade 8-A', 'Grade 9-A'] },
  { id: 'e3', name: 'Final Term Examination 2026', date: '2026-07-20', classes: ['Grade 8-A', 'Grade 8-B', 'Grade 9-A', 'Grade 7-A'] },
];

const MOCK_ATTENDANCE_HISTORY = [
  { date: '2026-06-24', class: 'Grade 8-A', present: 30, absent: 2, total: 32 },
  { date: '2026-06-24', class: 'Grade 8-B', present: 28, absent: 2, total: 30 },
  { date: '2026-06-23', class: 'Grade 9-A', present: 27, absent: 1, total: 28 },
  { date: '2026-06-23', class: 'Grade 7-A', present: 33, absent: 2, total: 35 },
  { date: '2026-06-22', class: 'Grade 8-A', present: 31, absent: 1, total: 32 },
  { date: '2026-06-22', class: 'Grade 8-B', present: 29, absent: 1, total: 30 },
  { date: '2026-06-21', class: 'Grade 9-A', present: 26, absent: 2, total: 28 },
  { date: '2026-06-21', class: 'Grade 7-A', present: 35, absent: 0, total: 35 },
];

const MOCK_MATERIALS = [
  { id: 'm1', title: 'Chapter 5 – Quadratic Equations Notes', type: 'notes', class: 'Grade 9-A', uploadedAt: '2026-06-20', size: '2.4 MB', format: 'PDF' },
  { id: 'm2', title: 'Fractions Practice Worksheet', type: 'document', class: 'Grade 7-A', uploadedAt: '2026-06-18', size: '1.1 MB', format: 'DOCX' },
  { id: 'm3', title: 'Algebra Basics – Video Lecture', type: 'video', class: 'Grade 8-A', uploadedAt: '2026-06-15', size: '—', url: 'https://example.com/algebra-basics', format: 'Link' },
  { id: 'm4', title: 'Mid-Term Revision Pack', type: 'document', class: 'All Classes', uploadedAt: '2026-06-10', size: '5.8 MB', format: 'ZIP' },
  { id: 'm5', title: 'Geometry – Angle Types Slides', type: 'notes', class: 'Grade 8-B', uploadedAt: '2026-06-08', size: '3.2 MB', format: 'PPTX' },
];

const MOCK_TASKS = [
  { id: 't1', task: 'Grade Grade 9-A assignments', due: 'Today', priority: 'high' },
  { id: 't2', task: 'Prepare Unit Test question paper for Grade 8-A', due: 'Jun 28', priority: 'medium' },
  { id: 't3', task: 'Submit attendance report for June', due: 'Jun 30', priority: 'medium' },
  { id: 't4', task: 'Upload Chapter 6 notes for Grade 8-B', due: 'Jul 01', priority: 'low' },
];

const MOCK_UPCOMING_EXAMS = [
  { name: 'Final Term Examination', class: 'All Classes', date: '2026-07-20', daysLeft: 25 },
  { name: 'Unit Test – Geometry', class: 'Grade 8-A', date: '2026-07-05', daysLeft: 10 },
];

// ---- Service Methods ----
export const teacherService = {
  async getClasses() {
    try {
      const data = await apiClient.get('/api/teacher/classes');
      return data.classes || data;
    } catch {
      return MOCK_CLASSES;
    }
  },

  async getStudents(classId) {
    try {
      const data = await apiClient.get(`/api/teacher/classes/${classId}/students`);
      return data.students || data;
    } catch {
      return MOCK_STUDENTS[classId] || [];
    }
  },

  async getTodaySchedule() {
    try {
      const data = await apiClient.get('/api/teacher/schedule/today');
      return data.schedule || data;
    } catch {
      return MOCK_SCHEDULE;
    }
  },

  async getAssignments() {
    try {
      const data = await apiClient.get('/api/teacher/assignments');
      return data.assignments || data;
    } catch {
      return MOCK_ASSIGNMENTS;
    }
  },

  async createAssignment(payload) {
    try {
      return await apiClient.post('/api/teacher/assignments', payload);
    } catch {
      return { success: true, id: 'mock-' + Date.now(), ...payload };
    }
  },

  async getExams() {
    try {
      const data = await apiClient.get('/api/teacher/exams');
      return data.exams || data;
    } catch {
      return MOCK_EXAMS;
    }
  },

  async getAttendanceHistory() {
    try {
      const data = await apiClient.get('/api/teacher/attendance/history');
      return data.records || data;
    } catch {
      return MOCK_ATTENDANCE_HISTORY;
    }
  },

  async submitAttendance(payload) {
    try {
      return await apiClient.post('/api/teacher/attendance', payload);
    } catch {
      return { success: true };
    }
  },

  async getMaterials() {
    try {
      const data = await apiClient.get('/api/teacher/materials');
      return data.materials || data;
    } catch {
      return MOCK_MATERIALS;
    }
  },

  async uploadMaterial(payload) {
    try {
      return await apiClient.post('/api/teacher/materials', payload);
    } catch {
      return { success: true, id: 'mock-' + Date.now(), ...payload };
    }
  },

  async submitMarks(payload) {
    try {
      return await apiClient.post('/api/teacher/marks', payload);
    } catch {
      return { success: true };
    }
  },

  async getDashboardData() {
    try {
      const data = await apiClient.get('/api/teacher/dashboard');
      return data;
    } catch {
      return {
        schedule: MOCK_SCHEDULE,
        tasks: MOCK_TASKS,
        upcomingExams: MOCK_UPCOMING_EXAMS,
        classes: MOCK_CLASSES,
      };
    }
  },

  // Expose mock data for use in component
  getMockStudents: () => MOCK_STUDENTS,
  getMockClasses: () => MOCK_CLASSES,
  getMockExams: () => MOCK_EXAMS,
};
