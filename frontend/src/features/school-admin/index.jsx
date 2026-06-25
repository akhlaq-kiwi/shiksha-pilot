import React, { useState } from 'react';
import {
  LayoutDashboard, School, BookOpen, Users, UserCog, Clock,
  ClipboardCheck, FileText, DollarSign, BarChart2, Shield,
  AlertCircle
} from 'lucide-react';

import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AcademicPage from './pages/AcademicPage';
import StudentsPage from './pages/StudentsPage';
import StaffPage from './pages/StaffPage';
import TimetablePage from './pages/TimetablePage';
import AttendancePage from './pages/AttendancePage';
import ExamsPage from './pages/ExamsPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import SecurityPage from './pages/SecurityPage';

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

// ─── Portal Root ──────────────────────────────────────────────────────────────

export default function SchoolAdminPortal() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [error] = useState('');

  // Shared data state
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [staff, setStaff] = useState(MOCK_STAFF);
  const [exams, setExams] = useState(MOCK_EXAMS);
  const [auditLogs] = useState(MOCK_AUDIT_LOGS);
  const [loginHistory] = useState(MOCK_LOGIN_HISTORY);

  // Derived stats
  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const totalStaff = staff.length;

  const MOCK_FEE_COLLECTIONS_PAID = 4;
  const MOCK_FEE_COLLECTIONS_TOTAL = 5;
  const MOCK_FEE_TOTAL = 122000;
  const totalFeeCollected = MOCK_FEE_TOTAL;
  const pendingFees = 1;

  const stats = {
    totalStudents,
    activeStudents,
    totalStaff,
    totalFeeCollected,
    pendingFees,
    examsCompleted: exams.filter(e => e.status === 'Completed').length,
    feeCollectionRate: `${Math.round((MOCK_FEE_COLLECTIONS_PAID / MOCK_FEE_COLLECTIONS_TOTAL) * 100)}%`,
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

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage stats={stats} students={students} staff={staff} exams={exams} auditLogs={auditLogs} onNavigate={setCurrentPage} />;
      case 'profile':
        return <ProfilePage />;
      case 'academic':
        return <AcademicPage students={students} />;
      case 'students':
        return <StudentsPage students={students} setStudents={setStudents} />;
      case 'staff':
        return <StaffPage staff={staff} setStaff={setStaff} />;
      case 'timetable':
        return <TimetablePage />;
      case 'attendance':
        return <AttendancePage students={students} />;
      case 'exams':
        return <ExamsPage exams={exams} setExams={setExams} students={students} />;
      case 'finance':
        return <FinancePage students={students} />;
      case 'reports':
        return <ReportsPage stats={stats} />;
      case 'security':
        return <SecurityPage auditLogs={auditLogs} loginHistory={loginHistory} />;
      default:
        return null;
    }
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
        {renderPage()}
      </div>
    </div>
  );
}
