import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, School, BookOpen, Users, UserCog, Clock,
  ClipboardCheck, FileText, DollarSign, BarChart2, Shield,
  Plus, Search, Edit, Trash2, ChevronRight, ArrowLeft,
  AlertCircle, CheckCircle2, XCircle, Calendar, Bell,
  TrendingUp, TrendingDown, UserPlus, BookMarked, Award,
  CreditCard, Banknote, Receipt, PieChart, Lock, Activity
} from 'lucide-react';
import { schoolAdminService } from '../../common/services/schoolAdminService';
import { Button } from '../../common/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../common/ui/table';
import { Input } from '../../common/ui/input';
import { Select } from '../../common/ui/select';
import { Dialog } from '../../common/ui/dialog';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_STUDENTS = [
  { id: 1, name: 'Aryan Mehta', roll: 'S-2024-001', class: 'Class 10', section: 'A', gender: 'Male', status: 'ACTIVE', parent: 'Rajesh Mehta', phone: '9876543210', dob: '2010-04-12' },
  { id: 2, name: 'Priya Sharma', roll: 'S-2024-002', class: 'Class 10', section: 'B', gender: 'Female', status: 'ACTIVE', parent: 'Sunita Sharma', phone: '9876543211', dob: '2010-07-22' },
  { id: 3, name: 'Rohan Das', roll: 'S-2024-003', class: 'Class 9', section: 'A', gender: 'Male', status: 'ACTIVE', parent: 'Kamal Das', phone: '9876543212', dob: '2011-01-05' },
  { id: 4, name: 'Sneha Gupta', roll: 'S-2024-004', class: 'Class 9', section: 'B', gender: 'Female', status: 'INACTIVE', parent: 'Ramesh Gupta', phone: '9876543213', dob: '2011-09-18' },
  { id: 5, name: 'Aditya Patel', roll: 'S-2024-005', class: 'Class 11', section: 'Science', gender: 'Male', status: 'ACTIVE', parent: 'Dinesh Patel', phone: '9876543214', dob: '2009-03-30' },
  { id: 6, name: 'Kavya Nair', roll: 'S-2024-006', class: 'Class 11', section: 'Commerce', gender: 'Female', status: 'ACTIVE', parent: 'Anitha Nair', phone: '9876543215', dob: '2009-11-14' },
];

const MOCK_STAFF = [
  { id: 1, name: 'Dr. Meena Iyer', role: 'Principal', department: 'Administration', email: 'meena.iyer@school.edu', phone: '9811000001', status: 'ACTIVE', joining: '2015-06-01' },
  { id: 2, name: 'Mr. Suresh Kumar', role: 'TEACHER', department: 'Mathematics', email: 'suresh.kumar@school.edu', phone: '9811000002', status: 'ACTIVE', joining: '2018-07-15' },
  { id: 3, name: 'Ms. Divya Rao', role: 'TEACHER', department: 'Science', email: 'divya.rao@school.edu', phone: '9811000003', status: 'ACTIVE', joining: '2019-07-10' },
  { id: 4, name: 'Mr. Akhil Singh', role: 'TEACHER', department: 'English', email: 'akhil.singh@school.edu', phone: '9811000004', status: 'ON_LEAVE', joining: '2020-06-01' },
  { id: 5, name: 'Ms. Rekha Joshi', role: 'Admin', department: 'Administration', email: 'rekha.joshi@school.edu', phone: '9811000005', status: 'ACTIVE', joining: '2017-03-20' },
  { id: 6, name: 'Mr. Vivek Tiwari', role: 'TEACHER', department: 'Social Studies', email: 'vivek.tiwari@school.edu', phone: '9811000006', status: 'ACTIVE', joining: '2021-07-01' },
];

const MOCK_EXAMS = [
  { id: 1, name: 'Unit Test 1', class: 'Class 10', term: 'Term 1', date: '2026-07-15', total_marks: 100, status: 'Upcoming' },
  { id: 2, name: 'Mid-Term Examination', class: 'Class 9', term: 'Term 1', date: '2026-08-10', total_marks: 200, status: 'Upcoming' },
  { id: 3, name: 'Unit Test 1', class: 'Class 11', term: 'Term 1', date: '2026-07-20', total_marks: 100, status: 'Upcoming' },
  { id: 4, name: 'Annual Examination', class: 'Class 8', term: 'Term 2', date: '2026-03-10', total_marks: 500, status: 'Completed' },
];

const MOCK_FEE_COLLECTIONS = [
  { id: 1, student: 'Aryan Mehta', class: 'Class 10', amount: 25000, type: 'Tuition Fee', date: '2026-06-01', status: 'PAID', method: 'Online' },
  { id: 2, student: 'Priya Sharma', class: 'Class 10', amount: 25000, type: 'Tuition Fee', date: '2026-06-02', status: 'PAID', method: 'Cash' },
  { id: 3, student: 'Rohan Das', class: 'Class 9', amount: 22000, type: 'Tuition Fee', date: '2026-06-03', status: 'PAID', method: 'Online' },
  { id: 4, student: 'Sneha Gupta', class: 'Class 9', amount: 22000, type: 'Tuition Fee', date: '2026-06-05', status: 'PENDING', method: '-' },
  { id: 5, student: 'Aditya Patel', class: 'Class 11', amount: 28000, type: 'Tuition Fee', date: '2026-06-06', status: 'PAID', method: 'Cheque' },
];

const MOCK_TIMETABLE = [
  { id: 1, day: 'Monday', period: '1st (8:00–8:45)', class: 'Class 10A', subject: 'Mathematics', teacher: 'Mr. Suresh Kumar', room: 'R-201' },
  { id: 2, day: 'Monday', period: '2nd (8:45–9:30)', class: 'Class 10A', subject: 'Science', teacher: 'Ms. Divya Rao', room: 'Lab-1' },
  { id: 3, day: 'Monday', period: '3rd (9:45–10:30)', class: 'Class 10B', subject: 'English', teacher: 'Mr. Akhil Singh', room: 'R-202' },
  { id: 4, day: 'Tuesday', period: '1st (8:00–8:45)', class: 'Class 9A', subject: 'Mathematics', teacher: 'Mr. Suresh Kumar', room: 'R-101' },
  { id: 5, day: 'Tuesday', period: '2nd (8:45–9:30)', class: 'Class 11 Sci', subject: 'Physics', teacher: 'Ms. Divya Rao', room: 'Lab-2' },
];

const MOCK_ATTENDANCE = [
  { id: 1, student: 'Aryan Mehta', class: 'Class 10A', date: '2026-06-25', status: 'Present' },
  { id: 2, student: 'Priya Sharma', class: 'Class 10B', date: '2026-06-25', status: 'Present' },
  { id: 3, student: 'Rohan Das', class: 'Class 9A', date: '2026-06-25', status: 'Absent' },
  { id: 4, student: 'Sneha Gupta', class: 'Class 9B', date: '2026-06-25', status: 'Present' },
  { id: 5, student: 'Aditya Patel', class: 'Class 11 Sci', date: '2026-06-25', status: 'Late' },
];

const MOCK_AUDIT_LOGS = [
  { id: 1, action: 'Student Enrolled', user: 'admin@school.edu', detail: 'Aryan Mehta enrolled in Class 10A', date: '2026-06-20 09:12' },
  { id: 2, action: 'Fee Collected', user: 'accounts@school.edu', detail: '₹25,000 received from Aryan Mehta', date: '2026-06-20 11:45' },
  { id: 3, action: 'Exam Created', user: 'admin@school.edu', detail: 'Unit Test 1 created for Class 10', date: '2026-06-18 14:00' },
  { id: 4, action: 'Staff Added', user: 'admin@school.edu', detail: 'Mr. Vivek Tiwari added as Social Studies teacher', date: '2026-06-15 10:30' },
  { id: 5, action: 'Timetable Updated', user: 'admin@school.edu', detail: 'Monday schedule updated for Class 10A', date: '2026-06-12 16:20' },
];

const MOCK_LOGIN_HISTORY = [
  { id: 1, user: 'admin@school.edu', role: 'SCHOOL_ADMIN', ip: '192.168.1.10', date: '2026-06-25 08:02', status: 'Success' },
  { id: 2, user: 'accounts@school.edu', role: 'Accountant', ip: '192.168.1.22', date: '2026-06-25 08:45', status: 'Success' },
  { id: 3, user: 'unknown@hacker.com', role: '-', ip: '45.33.32.156', date: '2026-06-24 23:11', status: 'Failed' },
  { id: 4, user: 'admin@school.edu', role: 'SCHOOL_ADMIN', ip: '192.168.1.10', date: '2026-06-24 17:55', status: 'Success' },
];

const MOCK_FEE_STRUCTURES = [
  { id: 1, name: 'Class 1–5 Tuition', class: 'Class 1–5', amount: 18000, frequency: 'Annual', due_day: 10 },
  { id: 2, name: 'Class 6–8 Tuition', class: 'Class 6–8', amount: 22000, frequency: 'Annual', due_day: 10 },
  { id: 3, name: 'Class 9–10 Tuition', class: 'Class 9–10', amount: 25000, frequency: 'Annual', due_day: 10 },
  { id: 4, name: 'Class 11–12 Tuition', class: 'Class 11–12', amount: 28000, frequency: 'Annual', due_day: 10 },
  { id: 5, name: 'Lab Fee', class: 'All Classes', amount: 5000, frequency: 'Annual', due_day: 15 },
  { id: 6, name: 'Transport Fee', class: 'All Classes', amount: 12000, frequency: 'Annual', due_day: 5 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusBadge = (status) => {
  const map = {
    Active: 'bg-green-500/10 text-green-600',
    Inactive: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
    'ON_LEAVE': 'bg-amber-500/10 text-amber-600',
    Present: 'bg-green-500/10 text-green-600',
    Absent: 'bg-red-500/10 text-red-600',
    Late: 'bg-amber-500/10 text-amber-600',
    Paid: 'bg-green-500/10 text-green-600',
    Pending: 'bg-amber-500/10 text-amber-600',
    Upcoming: 'bg-blue-500/10 text-blue-600',
    Completed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
    Published: 'bg-green-500/10 text-green-600',
    Success: 'bg-green-500/10 text-green-600',
    Failed: 'bg-red-500/10 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile', label: 'School Profile', icon: School },
  { id: 'academic', label: 'Academic', icon: BookOpen },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'staff', label: 'Staff', icon: UserCog },
  { id: 'timetable', label: 'Timetable', icon: Clock },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'exams', label: 'Examinations', icon: FileText },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'security', label: 'Security', icon: Shield },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SchoolAdminPortal() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data states
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [staff, setStaff] = useState(MOCK_STAFF);
  const [exams, setExams] = useState(MOCK_EXAMS);
  const [feeCollections, setFeeCollections] = useState(MOCK_FEE_COLLECTIONS);
  const [feeStructures, setFeeStructures] = useState(MOCK_FEE_STRUCTURES);
  const [timetable, setTimetable] = useState(MOCK_TIMETABLE);
  const [attendance, setAttendance] = useState(MOCK_ATTENDANCE);
  const [auditLogs, setAuditLogs] = useState(MOCK_AUDIT_LOGS);
  const [loginHistory, setLoginHistory] = useState(MOCK_LOGIN_HISTORY);

  // Search/filter
  const [studentSearch, setStudentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [feeSearch, setFeeSearch] = useState('');

  // Modals
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [isAddFeeStructureOpen, setIsAddFeeStructureOpen] = useState(false);
  const [isCollectFeeOpen, setIsCollectFeeOpen] = useState(false);

  const [newStudent, setNewStudent] = useState({ name: '', class: 'Class 9', section: 'A', gender: 'Male', parent: '', phone: '', dob: '' });
  const [newStaff, setNewStaff] = useState({ name: '', role: 'TEACHER', department: 'Mathematics', email: '', phone: '' });
  const [newExam, setNewExam] = useState({ name: '', class: 'Class 10', term: 'Term 1', date: '', total_marks: 100 });
  const [newFeeStructure, setNewFeeStructure] = useState({ name: '', class: '', amount: '', frequency: 'Annual', due_day: 10 });
  const [newCollection, setNewCollection] = useState({ student: '', class: '', amount: '', type: 'Tuition Fee', method: 'Online' });

  const [submitting, setSubmitting] = useState(false);

  // Stats
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const totalStaff = staff.length;
  const totalFeeCollected = feeCollections.filter(f => f.status === 'PAID').reduce((s, f) => s + f.amount, 0);
  const pendingFees = feeCollections.filter(f => f.status === 'PENDING').length;

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.roll.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.class.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.department.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const filteredFeeCollections = feeCollections.filter(f =>
    f.student.toLowerCase().includes(feeSearch.toLowerCase()) ||
    f.type.toLowerCase().includes(feeSearch.toLowerCase())
  );

  // Handlers
  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudent.name) return;
    setSubmitting(true);
    try {
      const id = students.length + 1;
      const roll = `S-2024-00${id}`;
      setStudents(prev => [...prev, { ...newStudent, id, roll, status: 'ACTIVE' }]);
      setIsAddStudentOpen(false);
      setNewStudent({ name: '', class: 'Class 9', section: 'A', gender: 'Male', parent: '', phone: '', dob: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaff.name) return;
    setSubmitting(true);
    try {
      const id = staff.length + 1;
      setStaff(prev => [...prev, { ...newStaff, id, status: 'ACTIVE', joining: new Date().toISOString().split('T')[0] }]);
      setIsAddStaffOpen(false);
      setNewStaff({ name: '', role: 'TEACHER', department: 'Mathematics', email: '', phone: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExam.name || !newExam.date) return;
    setSubmitting(true);
    try {
      const id = exams.length + 1;
      setExams(prev => [...prev, { ...newExam, id, status: 'Upcoming' }]);
      setIsAddExamOpen(false);
      setNewExam({ name: '', class: 'Class 10', term: 'Term 1', date: '', total_marks: 100 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFeeStructure = (e) => {
    e.preventDefault();
    if (!newFeeStructure.name || !newFeeStructure.amount) return;
    setSubmitting(true);
    try {
      const id = feeStructures.length + 1;
      setFeeStructures(prev => [...prev, { ...newFeeStructure, id, amount: parseInt(newFeeStructure.amount) }]);
      setIsAddFeeStructureOpen(false);
      setNewFeeStructure({ name: '', class: '', amount: '', frequency: 'Annual', due_day: 10 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollectFee = (e) => {
    e.preventDefault();
    if (!newCollection.student || !newCollection.amount) return;
    setSubmitting(true);
    try {
      const id = feeCollections.length + 1;
      setFeeCollections(prev => [...prev, {
        ...newCollection,
        id,
        amount: parseInt(newCollection.amount),
        date: new Date().toISOString().split('T')[0],
        status: 'PAID'
      }]);
      setIsCollectFeeOpen(false);
      setNewCollection({ student: '', class: '', amount: '', type: 'Tuition Fee', method: 'Online' });
    } finally {
      setSubmitting(false);
    }
  };

  const navBtn = (item) => {
    const Icon = item.icon;
    const active = currentPage === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setCurrentPage(item.id)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 w-full text-left ${active ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full min-h-[calc(100vh-140px)]">

      {/* Sidebar */}
      <aside className="w-full md:w-[220px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-4 py-2 space-y-6">
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3 px-3">School Admin</p>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            {NAV_ITEMS.map(navBtn)}
          </nav>
        </div>
        <div className="hidden md:block bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-bold text-primary mb-1">Academic Year</p>
          <p className="text-[11px] text-text-muted mb-1">2025–2026 (Current)</p>
          <p className="text-[10px] text-text-muted">Term 1 · Jun – Oct 2026</p>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 min-w-0">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {currentPage === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">School Overview</h2>
                <p className="text-text-secondary text-sm mt-1">Academic year 2025–2026 · Term 1 in progress</p>
              </div>
              <div className="bg-green-500/5 border border-green-500/10 rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs text-green-600 font-bold">School Active</span>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Students', value: totalStudents, sub: `${activeStudents} active`, icon: Users, color: 'bg-primary/10 text-primary' },
                { label: 'Total Staff', value: totalStaff, sub: `${staff.filter(s=>s.status==='ACTIVE').length} on duty`, icon: UserCog, color: 'bg-teal-500/10 text-teal-600' },
                { label: 'Fee Collected', value: `₹${(totalFeeCollected/1000).toFixed(0)}K`, sub: `${pendingFees} pending`, icon: Banknote, color: 'bg-emerald-500/10 text-emerald-600' },
                { label: 'Upcoming Exams', value: exams.filter(e=>e.status==='Upcoming').length, sub: 'This term', icon: FileText, color: 'bg-amber-500/10 text-amber-600' },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <Card key={card.label} className="shadow-sm">
                    <CardContent className="p-5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{card.label}</p>
                      <p className="text-2xl font-black text-text-primary mt-0.5 font-display">{card.value}</p>
                      <p className="text-[11px] text-text-muted mt-0.5">{card.sub}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Attendance bar chart */}
              <div className="lg:col-span-8 bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-sm font-bold text-text-primary mb-5">Monthly Attendance Rate (%)</h3>
                <div className="h-48 relative flex items-end justify-between px-2 border-b border-border pb-2">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-2">
                    {[100, 75, 50, 25].map(v => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="text-[9px] text-text-muted w-6 text-right">{v}</span>
                        <div className="flex-1 border-b border-zinc-100 dark:border-zinc-800/40"></div>
                      </div>
                    ))}
                  </div>
                  {[92, 88, 94, 91, 96, 89].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer z-10 ml-6">
                      <div className="w-8 bg-primary/15 border-t-2 border-primary rounded-t group-hover:bg-primary/25 transition-all"
                        style={{ height: `${h * 1.5}px` }}></div>
                      <span className="mt-2 text-[10px] text-text-muted">{['Jan','Feb','Mar','Apr','May','Jun'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="lg:col-span-4 bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-text-primary">Recent Activity</h3>
                <div className="space-y-3 flex-1">
                  {auditLogs.slice(0, 4).map(log => (
                    <div key={log.id} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{log.action}</p>
                        <p className="text-[10px] text-text-muted">{log.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: 'Enroll Student', page: 'students', icon: UserPlus },
                { label: 'Mark Attendance', page: 'attendance', icon: ClipboardCheck },
                { label: 'Collect Fee', page: 'finance', icon: CreditCard },
                { label: 'Create Exam', page: 'exams', icon: BookMarked },
                { label: 'View Reports', page: 'reports', icon: PieChart },
              ].map(q => {
                const Icon = q.icon;
                return (
                  <button key={q.label} onClick={() => setCurrentPage(q.page)}
                    className="flex flex-col items-center gap-2 p-4 bg-surface border border-border rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400 transition-all text-center group">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-text-secondary">{q.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SCHOOL PROFILE ── */}
        {currentPage === 'profile' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">School Profile</h2>
              <p className="text-text-secondary text-sm mt-1">Manage your school's identity, contact information, and academic configuration.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <Card>
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-text-primary">Basic Information</CardTitle>
                    <Button variant="outline" className="text-xs h-8 px-3">Edit Profile</Button>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[
                      ['School Name', 'Bright Horizon Academy'],
                      ['Registration No.', 'SCH-2015-MH-0042'],
                      ['Affiliation Board', 'CBSE New Delhi'],
                      ['School Type', 'Co-educational'],
                      ['Founded Year', '2008'],
                      ['Medium of Instruction', 'English'],
                      ['Contact Email', 'admin@brighthorizon.edu'],
                      ['Contact Phone', '+91 22 4567 8900'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{k}</p>
                        <p className="text-sm font-semibold text-text-primary mt-0.5">{v}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-bold text-text-primary">Address & Location</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {[
                      ['Street Address', '14, Prabhadevi Road'],
                      ['City', 'Mumbai'],
                      ['State', 'Maharashtra'],
                      ['PIN Code', '400025'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{k}</p>
                        <p className="text-sm font-semibold text-text-primary mt-0.5">{v}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-bold text-text-primary">Departments</CardTitle>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Head</TableHead>
                        <TableHead>Staff Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {['Mathematics','Science','English','Social Studies','Administration'].map((dept, i) => (
                        <TableRow key={dept}>
                          <TableCell className="font-semibold text-text-primary">{dept}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{staff.find(s=>s.department===dept)?.name || '—'}</TableCell>
                          <TableCell className="text-text-secondary text-xs">{staff.filter(s=>s.department===dept).length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              <div className="space-y-5">
                <Card>
                  <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                    <div className="w-20 h-20 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 flex items-center justify-center text-2xl font-black">BH</div>
                    <div>
                      <p className="font-bold text-text-primary">Bright Horizon Academy</p>
                      <p className="text-xs text-text-muted mt-0.5">brighthorizon.saas.school</p>
                    </div>
                    <Button variant="outline" className="text-xs w-full">Upload Logo</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-bold text-text-primary">Academic Session</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3 text-xs">
                    {[
                      ['Current Year', '2025–2026'],
                      ['Current Term', 'Term 1'],
                      ['Term Start', '01 June 2026'],
                      ['Term End', '31 October 2026'],
                      ['Classes Offered', '1 – 12'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
                        <span className="text-text-muted font-semibold">{k}</span>
                        <span className="font-bold text-text-primary">{v}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── ACADEMIC MANAGEMENT ── */}
        {currentPage === 'academic' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Academic Management</h2>
              <p className="text-text-secondary text-sm mt-1">Configure academic years, classes, sections, and subjects.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Academic Years */}
              <Card>
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-text-primary">Academic Years</CardTitle>
                  <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
                </CardHeader>
                <Table>
                  <TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Terms</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[{y:'2025–2026',t:2,s:'Current'},{y:'2024–2025',t:2,s:'Completed'},{y:'2023–2024',t:2,s:'Completed'}].map(r=>(
                      <TableRow key={r.y}>
                        <TableCell className="font-semibold text-text-primary">{r.y}</TableCell>
                        <TableCell className="text-text-secondary text-xs">{r.t} Terms</TableCell>
                        <TableCell>{statusBadge(r.s)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Classes */}
              <Card>
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-text-primary">Classes & Sections</CardTitle>
                  <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
                </CardHeader>
                <Table>
                  <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Sections</TableHead><TableHead>Students</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[
                      {c:'Class 9',s:'A, B',n:students.filter(x=>x.class==='Class 9').length},
                      {c:'Class 10',s:'A, B',n:students.filter(x=>x.class==='Class 10').length},
                      {c:'Class 11',s:'Science, Commerce',n:students.filter(x=>x.class==='Class 11').length},
                      {c:'Class 12',s:'Science, Commerce',n:0},
                    ].map(r=>(
                      <TableRow key={r.c}>
                        <TableCell className="font-semibold text-text-primary">{r.c}</TableCell>
                        <TableCell className="text-text-secondary text-xs">{r.s}</TableCell>
                        <TableCell className="text-text-secondary text-xs">{r.n}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Subjects */}
              <Card className="md:col-span-2">
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-text-primary">Subjects</CardTitle>
                  <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Subject</Button>
                </CardHeader>
                <Table>
                  <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Classes</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[
                      {n:'Mathematics',code:'MATH-01',dept:'Mathematics',cl:'All',type:'Core'},
                      {n:'Science',code:'SCI-01',dept:'Science',cl:'Class 1–10',type:'Core'},
                      {n:'English Language',code:'ENG-01',dept:'English',cl:'All',type:'Core'},
                      {n:'Social Studies',code:'SS-01',dept:'Social Studies',cl:'Class 1–10',type:'Core'},
                      {n:'Physics',code:'PHY-01',dept:'Science',cl:'Class 11–12',type:'Core'},
                      {n:'Computer Science',code:'CS-01',dept:'Science',cl:'Class 9–12',type:'Elective'},
                    ].map(r=>(
                      <TableRow key={r.code}>
                        <TableCell className="font-semibold text-text-primary">{r.n}</TableCell>
                        <TableCell className="font-mono text-xs text-text-muted">{r.code}</TableCell>
                        <TableCell className="text-text-secondary text-xs">{r.dept}</TableCell>
                        <TableCell className="text-text-secondary text-xs">{r.cl}</TableCell>
                        <TableCell><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.type==='Core'?'bg-primary/10 text-primary':'bg-amber-500/10 text-amber-600'}`}>{r.type}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        )}

        {/* ── STUDENTS ── */}
        {currentPage === 'students' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Student Management</h2>
                <p className="text-text-secondary text-sm mt-1">{totalStudents} students enrolled · {activeStudents} active</p>
              </div>
              <Button className="flex items-center gap-2" onClick={() => setIsAddStudentOpen(true)}>
                <Plus className="h-4 w-4" /> Enroll Student
              </Button>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
                <Input placeholder="Search by name, roll, or class..." className="pl-9" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
              </div>
              <Select className="w-full md:w-40">
                <option value="">All Classes</option>
                <option>Class 9</option><option>Class 10</option><option>Class 11</option>
              </Select>
              <Select className="w-full md:w-40">
                <option value="">All Status</option>
                <option>Active</option><option>Inactive</option>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-text-muted">No students found.</TableCell></TableRow>
                  ) : filteredStudents.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-text-muted">{s.roll}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {s.name.split(' ').map(n=>n[0]).join('')}
                          </div>
                          <span className="font-semibold text-text-primary text-sm">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-text-secondary text-xs">{s.class}</TableCell>
                      <TableCell className="text-text-secondary text-xs">{s.section}</TableCell>
                      <TableCell className="text-text-secondary text-xs">{s.parent}</TableCell>
                      <TableCell className="text-text-secondary text-xs font-mono">{s.phone}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell>
                        <button className="text-text-muted hover:text-primary transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* ── STAFF ── */}
        {currentPage === 'staff' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Staff Management</h2>
                <p className="text-text-secondary text-sm mt-1">{totalStaff} staff members · {staff.filter(s=>s.status==='ACTIVE').length} on duty</p>
              </div>
              <Button className="flex items-center gap-2" onClick={() => setIsAddStaffOpen(true)}>
                <Plus className="h-4 w-4" /> Add Staff
              </Button>
            </div>

            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
                <Input placeholder="Search staff..." className="pl-9" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
              </div>
              <Select className="w-full md:w-48">
                <option value="">All Departments</option>
                <option>Mathematics</option><option>Science</option><option>English</option><option>Administration</option>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No staff found.</TableCell></TableRow>
                  ) : filteredStaff.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {s.name.split(' ').filter((_,i)=>i<2).map(n=>n[0]).join('')}
                          </div>
                          <span className="font-semibold text-text-primary text-sm">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-text-secondary text-xs">{s.role}</TableCell>
                      <TableCell className="text-text-secondary text-xs">{s.department}</TableCell>
                      <TableCell className="text-text-muted text-xs font-mono">{s.email}</TableCell>
                      <TableCell className="text-text-muted text-xs">{s.joining}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell>
                        <button className="text-text-muted hover:text-primary transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Leave Requests */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Pending Leave Requests</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Staff Member</TableHead><TableHead>Leave Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold text-text-primary">Mr. Akhil Singh</TableCell>
                    <TableCell className="text-xs text-text-secondary">Sick Leave</TableCell>
                    <TableCell className="text-xs text-text-muted">2026-06-28</TableCell>
                    <TableCell className="text-xs text-text-muted">2026-06-30</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" className="h-7 px-3 text-xs text-green-600 border-green-200 hover:bg-green-50">Approve</Button>
                        <Button variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:bg-red-50">Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-text-muted text-xs">No other pending requests.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* ── TIMETABLE ── */}
        {currentPage === 'timetable' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Timetable Management</h2>
                <p className="text-text-secondary text-sm mt-1">Class schedules, teacher assignments, and room allocation.</p>
              </div>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Entry
              </Button>
            </div>

            <div className="flex gap-3">
              <Select className="w-48">
                <option>All Classes</option><option>Class 9A</option><option>Class 10A</option><option>Class 11 Sci</option>
              </Select>
              <Select className="w-40">
                <option>All Days</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option>
              </Select>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timetable.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No timetable entries.</TableCell></TableRow>
                  ) : timetable.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-semibold text-text-primary">{t.day}</TableCell>
                      <TableCell className="text-xs text-text-secondary font-mono">{t.period}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{t.class}</TableCell>
                      <TableCell className="text-xs font-semibold text-text-primary">{t.subject}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{t.teacher}</TableCell>
                      <TableCell><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-text-muted">{t.room}</span></TableCell>
                      <TableCell><button className="text-text-muted hover:text-primary"><Edit className="h-3.5 w-3.5" /></button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Substitute Assignments</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Absent Teacher</TableHead><TableHead>Substitute</TableHead><TableHead>Class</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-text-muted text-xs">No substitute assignments this week.</TableCell></TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {currentPage === 'attendance' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Attendance</h2>
                <p className="text-text-secondary text-sm mt-1">Mark daily student and staff attendance, view reports.</p>
              </div>
              <div className="flex gap-2">
                <Select className="w-40"><option>Class 10A</option><option>Class 9A</option><option>Class 11 Sci</option></Select>
                <Input type="date" defaultValue="2026-06-25" className="w-40" />
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex gap-3 flex-wrap">
              {[
                { label: 'Present', count: attendance.filter(a=>a.status==='Present').length, color: 'bg-green-500/10 text-green-600' },
                { label: 'Absent', count: attendance.filter(a=>a.status==='Absent').length, color: 'bg-red-500/10 text-red-600' },
                { label: 'Late', count: attendance.filter(a=>a.status==='Late').length, color: 'bg-amber-500/10 text-amber-600' },
              ].map(b => (
                <div key={b.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${b.color}`}>
                  <span>{b.label}</span>
                  <span className="text-base font-black">{b.count}</span>
                </div>
              ))}
            </div>

            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-text-primary">Student Attendance — 25 Jun 2026</CardTitle>
                <Button className="text-xs h-8 px-3">Save Attendance</Button>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-text-muted">No attendance records.</TableCell></TableRow>
                  ) : attendance.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-semibold text-text-primary">{a.student}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{a.class}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell>
                        <Select defaultValue={a.status} className="h-7 text-xs w-28">
                          <option>Present</option><option>Absent</option><option>Late</option>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Monthly Attendance Report</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Present Days</TableHead><TableHead>Absent Days</TableHead><TableHead>Attendance %</TableHead></TableRow></TableHeader>
                <TableBody>
                  {MOCK_STUDENTS.slice(0,4).map(s=>(
                    <TableRow key={s.id}>
                      <TableCell className="font-semibold text-text-primary">{s.name}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{s.class}</TableCell>
                      <TableCell className="font-mono text-xs">{Math.floor(Math.random()*5)+18}</TableCell>
                      <TableCell className="font-mono text-xs">{Math.floor(Math.random()*3)}</TableCell>
                      <TableCell>
                        <span className="font-bold text-green-600 text-xs">{(88+Math.floor(Math.random()*10))}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* ── EXAMINATIONS ── */}
        {currentPage === 'exams' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Examinations</h2>
                <p className="text-text-secondary text-sm mt-1">Create exams, enter marks, calculate grades, and publish results.</p>
              </div>
              <Button className="flex items-center gap-2" onClick={() => setIsAddExamOpen(true)}>
                <Plus className="h-4 w-4" /> Create Exam
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Upcoming', value: exams.filter(e=>e.status==='Upcoming').length, color: 'bg-blue-500/10 text-blue-600' },
                { label: 'Completed', value: exams.filter(e=>e.status==='Completed').length, color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800' },
                { label: 'Published', value: exams.filter(e=>e.status==='Published').length, color: 'bg-green-500/10 text-green-600' },
              ].map(c => (
                <Card key={c.label} className="shadow-sm">
                  <CardContent className="p-5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{c.label}</p>
                    <p className={`text-3xl font-black mt-1 font-display ${c.color.split(' ')[1]}`}>{c.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No exams scheduled.</TableCell></TableRow>
                  ) : exams.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-semibold text-text-primary">{e.name}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{e.class}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{e.term}</TableCell>
                      <TableCell className="text-xs font-mono text-text-muted">{e.date}</TableCell>
                      <TableCell className="text-xs font-mono">{e.total_marks}</TableCell>
                      <TableCell>{statusBadge(e.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" className="h-7 px-2 text-xs">Marks</Button>
                          {e.status === 'Completed' && (
                            <Button variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-200">Publish</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Grade Scale */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Grading Scale</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>Marks Range</TableHead><TableHead>Grade Points</TableHead><TableHead>Remark</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[
                    {g:'A+',r:'90–100',p:'10','rem':'Outstanding'},
                    {g:'A',r:'80–89',p:'9','rem':'Excellent'},
                    {g:'B+',r:'70–79',p:'8','rem':'Very Good'},
                    {g:'B',r:'60–69',p:'7','rem':'Good'},
                    {g:'C',r:'50–59',p:'6','rem':'Average'},
                    {g:'D',r:'33–49',p:'5','rem':'Pass'},
                    {g:'E',r:'0–32',p:'0','rem':'Fail'},
                  ].map(row=>(
                    <TableRow key={row.g}>
                      <TableCell className="font-black text-primary">{row.g}</TableCell>
                      <TableCell className="font-mono text-xs">{row.r}</TableCell>
                      <TableCell className="font-mono text-xs">{row.p}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{row.rem}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* ── FINANCE ── */}
        {currentPage === 'finance' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Finance</h2>
                <p className="text-text-secondary text-sm mt-1">Fee structures, collections, expenses, scholarships, and payroll.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex items-center gap-2 text-xs" onClick={() => setIsAddFeeStructureOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Fee Structure
                </Button>
                <Button className="flex items-center gap-2 text-xs" onClick={() => setIsCollectFeeOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Collect Fee
                </Button>
              </div>
            </div>

            {/* Finance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Collected', value: `₹${(totalFeeCollected/1000).toFixed(0)}K`, sub: 'This term', color: 'text-green-600' },
                { label: 'Pending Fees', value: pendingFees, sub: 'Students', color: 'text-amber-600' },
                { label: 'Expenses', value: '₹28K', sub: 'This month', color: 'text-red-500' },
                { label: 'Payroll Due', value: '₹3.2L', sub: 'June 2026', color: 'text-primary' },
              ].map(c => (
                <Card key={c.label} className="shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{c.label}</p>
                    <p className={`text-2xl font-black mt-1 font-display ${c.color}`}>{c.value}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{c.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Fee Structures */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Fee Structures</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Fee Name</TableHead><TableHead>Applicable Class</TableHead><TableHead>Amount</TableHead><TableHead>Frequency</TableHead><TableHead>Due Day</TableHead></TableRow></TableHeader>
                <TableBody>
                  {feeStructures.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-text-muted">No fee structures defined.</TableCell></TableRow>
                  ) : feeStructures.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-semibold text-text-primary">{f.name}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{f.class}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-text-primary">₹{f.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{f.frequency}</TableCell>
                      <TableCell className="text-xs text-text-muted">Day {f.due_day}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Fee Collections */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-text-primary">Fee Collections</CardTitle>
                <div className="relative w-60">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
                  <Input placeholder="Search..." className="pl-8 h-8 text-xs" value={feeSearch} onChange={e => setFeeSearch(e.target.value)} />
                </div>
              </CardHeader>
              <Table>
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Fee Type</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredFeeCollections.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-text-muted">No fee records.</TableCell></TableRow>
                  ) : filteredFeeCollections.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-semibold text-text-primary">{f.student}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{f.class}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{f.type}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">₹{f.amount.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{f.date}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{f.method}</TableCell>
                      <TableCell>{statusBadge(f.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Expenses & Scholarships */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-text-primary">Expenses</CardTitle>
                  <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
                </CardHeader>
                <Table>
                  <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[
                      {c:'Stationery',a:8500,d:'2026-06-10'},
                      {c:'Maintenance',a:12000,d:'2026-06-15'},
                      {c:'Utilities',a:7200,d:'2026-06-20'},
                    ].map((e,i)=>(
                      <TableRow key={i}>
                        <TableCell className="font-semibold text-text-primary text-sm">{e.c}</TableCell>
                        <TableCell className="font-mono text-xs font-bold">₹{e.a.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs text-text-muted">{e.d}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card>
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-text-primary">Scholarships & Discounts</CardTitle>
                  <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
                </CardHeader>
                <Table>
                  <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Type</TableHead><TableHead>Discount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[
                      {s:'Priya Sharma',t:'Merit Scholarship',d:'20%'},
                      {s:'Rohan Das',t:'Need-Based',d:'15%'},
                    ].map((r,i)=>(
                      <TableRow key={i}>
                        <TableCell className="font-semibold text-text-primary text-sm">{r.s}</TableCell>
                        <TableCell className="text-xs text-text-secondary">{r.t}</TableCell>
                        <TableCell><span className="text-xs font-bold text-green-600">{r.d}</span></TableCell>
                      </TableRow>
                    ))}
                    <TableRow><TableCell colSpan={3} className="text-center py-3 text-xs text-text-muted">2 scholarships active.</TableCell></TableRow>
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {currentPage === 'reports' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Reports</h2>
              <p className="text-text-secondary text-sm mt-1">Student, attendance, examination, financial, and staff reports.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Student Report', desc: 'Enrollment, demographics, class-wise breakdown', icon: Users, action: 'Generate' },
                { title: 'Attendance Report', desc: 'Daily and monthly attendance summaries', icon: ClipboardCheck, action: 'Generate' },
                { title: 'Examination Report', desc: 'Results, grade distributions, toppers list', icon: Award, action: 'Generate' },
                { title: 'Financial Report', desc: 'Collections, expenses, outstanding fees', icon: PieChart, action: 'Generate' },
                { title: 'Staff Report', desc: 'Staff attendance, leave records, payroll', icon: UserCog, action: 'Generate' },
                { title: 'Custom Report', desc: 'Build a custom report with filters', icon: BarChart2, action: 'Configure' },
              ].map(r => {
                const Icon = r.icon;
                return (
                  <div key={r.title} className="bg-surface border border-border rounded-xl p-5 hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group cursor-pointer flex flex-col gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-text-primary">{r.title}</h3>
                      <p className="text-xs text-text-muted mt-1">{r.desc}</p>
                    </div>
                    <Button variant="outline" className="text-xs w-full justify-center">{r.action}</Button>
                  </div>
                );
              })}
            </div>

            {/* Quick Stats Report */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Term 1 Summary — 2025–2026</CardTitle>
              </CardHeader>
              <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { k: 'Students Enrolled', v: totalStudents },
                  { k: 'Avg. Attendance', v: '91.4%' },
                  { k: 'Exams Conducted', v: exams.filter(e=>e.status==='Completed').length },
                  { k: 'Fee Collection Rate', v: `${Math.round((feeCollections.filter(f=>f.status==='PAID').length/feeCollections.length)*100)}%` },
                ].map(item => (
                  <div key={item.k}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">{item.k}</p>
                    <p className="text-2xl font-black text-text-primary mt-1 font-display">{item.v}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── SECURITY ── */}
        {currentPage === 'security' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Security</h2>
              <p className="text-text-secondary text-sm mt-1">Audit logs, login history, and access control.</p>
            </div>

            {/* Audit Logs */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Audit Logs</CardTitle>
                <CardDescription className="text-xs text-text-secondary mt-0.5">Immutable record of all administrative actions.</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-text-muted">No audit log records.</TableCell></TableRow>
                  ) : auditLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                          <span className="font-semibold text-text-primary text-xs">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary max-w-xs truncate">{log.detail}</TableCell>
                      <TableCell className="text-xs font-mono text-text-muted">{log.user}</TableCell>
                      <TableCell className="text-xs font-mono text-text-muted">{log.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Login History */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Login History</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginHistory.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-text-muted">No login records.</TableCell></TableRow>
                  ) : loginHistory.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs text-text-primary">{l.user}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{l.role}</TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{l.ip}</TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{l.date}</TableCell>
                      <TableCell>{statusBadge(l.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {/* Add Student */}
      <Dialog isOpen={isAddStudentOpen} onClose={() => setIsAddStudentOpen(false)}
        title="Enroll New Student" description="Add a student to the school roster."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddStudentOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStudent} disabled={submitting}>{submitting ? 'Enrolling...' : 'Enroll Student'}</Button>
        </>}>
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Full Name</label>
            <Input placeholder="e.g. Rahul Verma" value={newStudent.name} onChange={e => setNewStudent(p=>({...p,name:e.target.value}))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              <Select value={newStudent.class} onChange={e => setNewStudent(p=>({...p,class:e.target.value}))}>
                <option>Class 9</option><option>Class 10</option><option>Class 11</option><option>Class 12</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Section</label>
              <Select value={newStudent.section} onChange={e => setNewStudent(p=>({...p,section:e.target.value}))}>
                <option>A</option><option>B</option><option>Science</option><option>Commerce</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Gender</label>
              <Select value={newStudent.gender} onChange={e => setNewStudent(p=>({...p,gender:e.target.value}))}>
                <option>Male</option><option>Female</option><option>Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Date of Birth</label>
              <Input type="date" value={newStudent.dob} onChange={e => setNewStudent(p=>({...p,dob:e.target.value}))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Parent / Guardian Name</label>
            <Input placeholder="e.g. Suresh Verma" value={newStudent.parent} onChange={e => setNewStudent(p=>({...p,parent:e.target.value}))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
            <Input placeholder="10-digit mobile number" value={newStudent.phone} onChange={e => setNewStudent(p=>({...p,phone:e.target.value}))} />
          </div>
        </form>
      </Dialog>

      {/* Add Staff */}
      <Dialog isOpen={isAddStaffOpen} onClose={() => setIsAddStaffOpen(false)}
        title="Add Staff Member" description="Add a new staff member to the school."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStaff} disabled={submitting}>{submitting ? 'Adding...' : 'Add Staff'}</Button>
        </>}>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Full Name</label>
            <Input placeholder="e.g. Ms. Anita Sharma" value={newStaff.name} onChange={e => setNewStaff(p=>({...p,name:e.target.value}))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Role</label>
              <Select value={newStaff.role} onChange={e => setNewStaff(p=>({...p,role:e.target.value}))}>
                <option>Teacher</option><option>Admin</option><option>Accountant</option><option>Librarian</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Department</label>
              <Select value={newStaff.department} onChange={e => setNewStaff(p=>({...p,department:e.target.value}))}>
                <option>Mathematics</option><option>Science</option><option>English</option><option>Social Studies</option><option>Administration</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Email</label>
            <Input type="email" placeholder="e.g. anita.sharma@school.edu" value={newStaff.email} onChange={e => setNewStaff(p=>({...p,email:e.target.value}))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Phone</label>
            <Input placeholder="Mobile number" value={newStaff.phone} onChange={e => setNewStaff(p=>({...p,phone:e.target.value}))} />
          </div>
        </form>
      </Dialog>

      {/* Create Exam */}
      <Dialog isOpen={isAddExamOpen} onClose={() => setIsAddExamOpen(false)}
        title="Create Examination" description="Schedule a new exam for a class."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddExamOpen(false)}>Cancel</Button>
          <Button onClick={handleAddExam} disabled={submitting}>{submitting ? 'Creating...' : 'Create Exam'}</Button>
        </>}>
        <form onSubmit={handleAddExam} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Exam Name</label>
            <Input placeholder="e.g. Unit Test 2" value={newExam.name} onChange={e => setNewExam(p=>({...p,name:e.target.value}))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              <Select value={newExam.class} onChange={e => setNewExam(p=>({...p,class:e.target.value}))}>
                <option>Class 9</option><option>Class 10</option><option>Class 11</option><option>Class 12</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Term</label>
              <Select value={newExam.term} onChange={e => setNewExam(p=>({...p,term:e.target.value}))}>
                <option>Term 1</option><option>Term 2</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Exam Date</label>
              <Input type="date" value={newExam.date} onChange={e => setNewExam(p=>({...p,date:e.target.value}))} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Total Marks</label>
              <Input type="number" placeholder="100" value={newExam.total_marks} onChange={e => setNewExam(p=>({...p,total_marks:parseInt(e.target.value)||100}))} />
            </div>
          </div>
        </form>
      </Dialog>

      {/* Add Fee Structure */}
      <Dialog isOpen={isAddFeeStructureOpen} onClose={() => setIsAddFeeStructureOpen(false)}
        title="Add Fee Structure" description="Define a new fee category and amount."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddFeeStructureOpen(false)}>Cancel</Button>
          <Button onClick={handleAddFeeStructure} disabled={submitting}>{submitting ? 'Saving...' : 'Save Structure'}</Button>
        </>}>
        <form onSubmit={handleAddFeeStructure} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Fee Name</label>
            <Input placeholder="e.g. Class 8 Tuition Fee" value={newFeeStructure.name} onChange={e => setNewFeeStructure(p=>({...p,name:e.target.value}))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Applicable Class</label>
              <Input placeholder="e.g. Class 8" value={newFeeStructure.class} onChange={e => setNewFeeStructure(p=>({...p,class:e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input type="number" placeholder="e.g. 20000" value={newFeeStructure.amount} onChange={e => setNewFeeStructure(p=>({...p,amount:e.target.value}))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Frequency</label>
              <Select value={newFeeStructure.frequency} onChange={e => setNewFeeStructure(p=>({...p,frequency:e.target.value}))}>
                <option>Annual</option><option>Term-wise</option><option>Monthly</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Due Day of Month</label>
              <Input type="number" min={1} max={28} value={newFeeStructure.due_day} onChange={e => setNewFeeStructure(p=>({...p,due_day:parseInt(e.target.value)||10}))} />
            </div>
          </div>
        </form>
      </Dialog>

      {/* Collect Fee */}
      <Dialog isOpen={isCollectFeeOpen} onClose={() => setIsCollectFeeOpen(false)}
        title="Collect Fee" description="Record a fee payment from a student."
        footer={<>
          <Button variant="secondary" onClick={() => setIsCollectFeeOpen(false)}>Cancel</Button>
          <Button onClick={handleCollectFee} disabled={submitting}>{submitting ? 'Recording...' : 'Record Payment'}</Button>
        </>}>
        <form onSubmit={handleCollectFee} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Student Name</label>
            <Input placeholder="e.g. Aryan Mehta" value={newCollection.student} onChange={e => setNewCollection(p=>({...p,student:e.target.value}))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              <Select value={newCollection.class} onChange={e => setNewCollection(p=>({...p,class:e.target.value}))}>
                <option>Class 9</option><option>Class 10</option><option>Class 11</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input type="number" placeholder="e.g. 25000" value={newCollection.amount} onChange={e => setNewCollection(p=>({...p,amount:e.target.value}))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Fee Type</label>
              <Select value={newCollection.type} onChange={e => setNewCollection(p=>({...p,type:e.target.value}))}>
                <option>Tuition Fee</option><option>Lab Fee</option><option>Transport Fee</option><option>Exam Fee</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Payment Method</label>
              <Select value={newCollection.method} onChange={e => setNewCollection(p=>({...p,method:e.target.value}))}>
                <option>Online</option><option>Cash</option><option>Cheque</option><option>DD</option>
              </Select>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
