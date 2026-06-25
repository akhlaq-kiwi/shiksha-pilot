import React, { useState } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, CalendarCheck,
  CreditCard, Library, Users
} from 'lucide-react';
import { Select } from '../../common/ui/select';
import { Button } from '../../common/ui/button';
import { authService } from '../../common/services/authService';

import DashboardPage from './pages/DashboardPage';
import AcademicsPage from './pages/AcademicsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AttendancePage from './pages/AttendancePage';
import FeesPage from './pages/FeesPage';
import ResourcesPage from './pages/ResourcesPage';
import ParentPage from './pages/ParentPage';

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_CHILDREN = [
  { id: 'c1', name: 'Arjun Mehta', grade: 'Grade 9-A', rollNo: '2026-09-14', avatar: 'AM' },
  { id: 'c2', name: 'Priya Mehta', grade: 'Grade 6-B', rollNo: '2026-06-22', avatar: 'PM' },
];

const MOCK_DATA = {
  attendance: {
    percentage: 88,
    present: 132,
    absent: 18,
    total: 150,
    monthly: {
      1: 'P', 2: 'P', 3: 'A', 4: 'P', 5: 'P',
      6: null, 7: null, 8: 'P', 9: 'P', 10: 'P',
      11: 'L', 12: 'P', 13: 'A', 14: 'P', 15: 'P',
      16: 'P', 17: 'P', 18: 'P', 19: 'P', 20: null,
      21: null, 22: 'P', 23: 'P', 24: 'P', 25: 'A',
      26: 'P', 27: 'P', 28: null, 29: null, 30: 'P',
    },
  },
  homework: [
    { id: 'h1', subject: 'Mathematics', title: 'Trigonometry Practice Set 3', dueDate: '2026-06-27', status: 'pending', teacher: 'Mr. Iyer' },
    { id: 'h2', subject: 'Physics', title: "Newton's Laws — Problem Sheet", dueDate: '2026-06-28', status: 'submitted', teacher: 'Ms. Sharma' },
    { id: 'h3', subject: 'English', title: 'Essay: Environmental Responsibility', dueDate: '2026-06-30', status: 'pending', teacher: 'Mr. Kapoor' },
    { id: 'h4', subject: 'Chemistry', title: 'Organic Compounds Lab Report', dueDate: '2026-07-02', status: 'graded', grade: 'A', teacher: 'Ms. Reddy' },
    { id: 'h5', subject: 'History', title: 'Chapter 12 Summary Notes', dueDate: '2026-06-26', status: 'overdue', teacher: 'Mr. Pillai' },
  ],
  exams: [
    { id: 'e1', subject: 'Mathematics', date: '2026-07-05', time: '9:00 AM', room: 'Hall A', syllabus: 'Chapters 8–12' },
    { id: 'e2', subject: 'Physics', date: '2026-07-07', time: '9:00 AM', room: 'Hall B', syllabus: 'Units 4–6' },
    { id: 'e3', subject: 'Chemistry', date: '2026-07-09', time: '10:30 AM', room: 'Lab 2', syllabus: 'Organic Chemistry' },
    { id: 'e4', subject: 'English', date: '2026-07-11', time: '9:00 AM', room: 'Hall C', syllabus: 'Literature + Grammar' },
  ],
  feeStatus: {
    outstanding: 14500,
    dueDate: '2026-07-15',
    lastPaid: 22000,
    lastPaidDate: '2026-06-01',
    breakdown: [
      { label: 'Tuition Fee', amount: 10000, status: 'due' },
      { label: 'Library Fee', amount: 1500, status: 'due' },
      { label: 'Lab Fee', amount: 3000, status: 'due' },
    ],
  },
  receipts: [
    { id: 'R-2026-041', date: '2026-06-01', amount: 22000, description: 'May Term Full Payment', mode: 'Online' },
    { id: 'R-2026-019', date: '2026-05-01', amount: 22000, description: 'April Term Full Payment', mode: 'Online' },
    { id: 'R-2026-003', date: '2026-04-03', amount: 5500, description: 'Registration & Activity Fee', mode: 'Cheque' },
  ],
  timetable: {
    Mon: [
      { time: '8:00–8:45', subject: 'Mathematics', teacher: 'Mr. Iyer', room: 'R-201' },
      { time: '8:45–9:30', subject: 'Physics', teacher: 'Ms. Sharma', room: 'Lab-1' },
      { time: '9:30–10:15', subject: 'English', teacher: 'Mr. Kapoor', room: 'R-105' },
      { time: '10:45–11:30', subject: 'Chemistry', teacher: 'Ms. Reddy', room: 'Lab-2' },
      { time: '11:30–12:15', subject: 'Physical Ed.', teacher: 'Coach Rajan', room: 'Ground' },
      { time: '1:00–1:45', subject: 'History', teacher: 'Mr. Pillai', room: 'R-302' },
      { time: '1:45–2:30', subject: 'Computer Sc.', teacher: 'Ms. Nair', room: 'Lab-3' },
    ],
    Tue: [
      { time: '8:00–8:45', subject: 'English', teacher: 'Mr. Kapoor', room: 'R-105' },
      { time: '8:45–9:30', subject: 'Mathematics', teacher: 'Mr. Iyer', room: 'R-201' },
      { time: '9:30–10:15', subject: 'History', teacher: 'Mr. Pillai', room: 'R-302' },
      { time: '10:45–11:30', subject: 'Physics', teacher: 'Ms. Sharma', room: 'Lab-1' },
      { time: '11:30–12:15', subject: 'Chemistry', teacher: 'Ms. Reddy', room: 'Lab-2' },
      { time: '1:00–1:45', subject: 'Geography', teacher: 'Ms. Joshi', room: 'R-210' },
      { time: '1:45–2:30', subject: 'Mathematics', teacher: 'Mr. Iyer', room: 'R-201' },
    ],
    Wed: [
      { time: '8:00–8:45', subject: 'Computer Sc.', teacher: 'Ms. Nair', room: 'Lab-3' },
      { time: '8:45–9:30', subject: 'Chemistry', teacher: 'Ms. Reddy', room: 'Lab-2' },
      { time: '9:30–10:15', subject: 'Mathematics', teacher: 'Mr. Iyer', room: 'R-201' },
      { time: '10:45–11:30', subject: 'English', teacher: 'Mr. Kapoor', room: 'R-105' },
      { time: '11:30–12:15', subject: 'Physics', teacher: 'Ms. Sharma', room: 'Lab-1' },
      { time: '1:00–1:45', subject: 'Art & Craft', teacher: 'Ms. Desai', room: 'R-401' },
      { time: '1:45–2:30', subject: 'History', teacher: 'Mr. Pillai', room: 'R-302' },
    ],
    Thu: [
      { time: '8:00–8:45', subject: 'Physics', teacher: 'Ms. Sharma', room: 'Lab-1' },
      { time: '8:45–9:30', subject: 'Geography', teacher: 'Ms. Joshi', room: 'R-210' },
      { time: '9:30–10:15', subject: 'Chemistry', teacher: 'Ms. Reddy', room: 'Lab-2' },
      { time: '10:45–11:30', subject: 'Mathematics', teacher: 'Mr. Iyer', room: 'R-201' },
      { time: '11:30–12:15', subject: 'English', teacher: 'Mr. Kapoor', room: 'R-105' },
      { time: '1:00–1:45', subject: 'Computer Sc.', teacher: 'Ms. Nair', room: 'Lab-3' },
      { time: '1:45–2:30', subject: 'Physical Ed.', teacher: 'Coach Rajan', room: 'Ground' },
    ],
    Fri: [
      { time: '8:00–8:45', subject: 'History', teacher: 'Mr. Pillai', room: 'R-302' },
      { time: '8:45–9:30', subject: 'English', teacher: 'Mr. Kapoor', room: 'R-105' },
      { time: '9:30–10:15', subject: 'Geography', teacher: 'Ms. Joshi', room: 'R-210' },
      { time: '10:45–11:30', subject: 'Computer Sc.', teacher: 'Ms. Nair', room: 'Lab-3' },
      { time: '11:30–12:15', subject: 'Mathematics', teacher: 'Mr. Iyer', room: 'R-201' },
      { time: '1:00–1:45', subject: 'Chemistry', teacher: 'Ms. Reddy', room: 'Lab-2' },
      { time: '1:45–2:30', subject: 'Class Activity', teacher: 'Class Teacher', room: 'R-201' },
    ],
  },
  subjects: [
    { name: 'Mathematics', teacher: 'Mr. Iyer', code: 'MTH-401', score: 87, maxScore: 100, grade: 'A' },
    { name: 'Physics', teacher: 'Ms. Sharma', code: 'PHY-401', score: 79, maxScore: 100, grade: 'B+' },
    { name: 'Chemistry', teacher: 'Ms. Reddy', code: 'CHE-401', score: 92, maxScore: 100, grade: 'A+' },
    { name: 'English', teacher: 'Mr. Kapoor', code: 'ENG-401', score: 83, maxScore: 100, grade: 'A' },
    { name: 'History', teacher: 'Mr. Pillai', code: 'HIS-401', score: 74, maxScore: 100, grade: 'B' },
    { name: 'Geography', teacher: 'Ms. Joshi', code: 'GEO-401', score: 80, maxScore: 100, grade: 'A-' },
    { name: 'Computer Science', teacher: 'Ms. Nair', code: 'CS-401', score: 95, maxScore: 100, grade: 'A+' },
  ],
  resources: {
    notes: [
      { id: 'n1', title: 'Trigonometry — Complete Notes', subject: 'Mathematics', size: '2.4 MB', date: '2026-06-10', type: 'PDF' },
      { id: 'n2', title: "Newton's Laws Summary", subject: 'Physics', size: '1.1 MB', date: '2026-06-12', type: 'PDF' },
      { id: 'n3', title: 'Organic Chemistry Handbook', subject: 'Chemistry', size: '3.8 MB', date: '2026-06-15', type: 'PDF' },
      { id: 'n4', title: 'Grammar Rules & Exercises', subject: 'English', size: '960 KB', date: '2026-06-18', type: 'PDF' },
      { id: 'n5', title: 'Industrial Revolution — Key Events', subject: 'History', size: '1.6 MB', date: '2026-06-20', type: 'PDF' },
    ],
    videos: [
      { id: 'v1', title: 'Quadratic Equations Explained', subject: 'Mathematics', duration: '18:42', date: '2026-06-08', link: '#' },
      { id: 'v2', title: 'Projectile Motion Demo', subject: 'Physics', duration: '22:15', date: '2026-06-14', link: '#' },
      { id: 'v3', title: 'Balancing Chemical Equations', subject: 'Chemistry', duration: '15:30', date: '2026-06-16', link: '#' },
      { id: 'v4', title: 'Python for Beginners Part 1', subject: 'Computer Science', duration: '34:10', date: '2026-06-21', link: '#' },
    ],
    materials: [
      { id: 'm1', title: 'Mathematics Past Papers 2023–2025', type: 'Archive', size: '8.2 MB' },
      { id: 'm2', title: 'Science Lab Manual — Term 2', type: 'PDF', size: '4.5 MB' },
      { id: 'm3', title: 'Reference Atlas & Maps', type: 'PDF', size: '12.1 MB' },
      { id: 'm4', title: 'English Literature Anthology', type: 'eBook', size: '6.3 MB' },
    ],
  },
};

// ─── Sidebar ────────────────────────────────────────────────────────────────────

function AppSidebar({ currentPage, onNavigate, isParent, user, selectedChild, onSelectChild, feeStatus, onPayNow }) {
  const displayName = isParent ? (user?.name || 'PARENT') : (user?.name || 'STUDENT');

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'academics', icon: BookOpen, label: 'Academics' },
    { id: 'assignments', icon: ClipboardList, label: 'Assignments' },
    { id: 'attendance', icon: CalendarCheck, label: 'Attendance' },
    { id: 'fees', icon: CreditCard, label: 'Fees' },
    { id: 'resources', icon: Library, label: 'Resources' },
    ...(isParent ? [{ id: 'parent', icon: Users, label: 'My Children' }] : []),
  ];

  return (
    <aside className="w-full md:w-[240px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-6 py-2 space-y-6">
      <div>
        {/* Identity card */}
        <div className="mb-5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
              {isParent ? 'P' : (user?.name?.charAt(0) || 'S')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">{displayName}</p>
              <p className="text-[10px] text-text-muted font-semibold">{isParent ? 'Parent Account' : 'Grade 9-A · Roll 14'}</p>
            </div>
          </div>

          {isParent && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-2">Viewing child</p>
              <Select
                value={selectedChild.id}
                onChange={e => onSelectChild(MOCK_CHILDREN.find(c => c.id === e.target.value))}
                className="text-xs"
              >
                {MOCK_CHILDREN.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <p className="text-[10px] text-text-muted mt-1.5 font-semibold">{selectedChild.grade} · Roll {selectedChild.rollNo.split('-')[2]}</p>
            </div>
          )}
        </div>

        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-4 px-3">Portal</p>
        <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                currentPage === id
                  ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                  : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Fee alert widget */}
      <div className="hidden md:block">
        {feeStatus.outstanding > 0 && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
            <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">Fee Due</p>
            <p className="text-lg font-black text-text-primary tabular-nums">
              ₹{feeStatus.outstanding.toLocaleString()}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">Due {feeStatus.dueDate}</p>
            <Button
              onClick={onPayNow}
              className="mt-3 w-full text-xs py-1.5 justify-center bg-amber-600 hover:bg-amber-700 border-none text-white"
            >
              Pay Now
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Portal Root ────────────────────────────────────────────────────────────────

export default function StudentParentPortal() {
  const user = authService.getCurrentUser();
  const role = authService.getUserRole(); // 'STUDENT' | 'PARENT'
  const isParent = role === 'PARENT';
  const displayName = user?.name || (isParent ? 'PARENT' : 'STUDENT');

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedChild, setSelectedChild] = useState(MOCK_CHILDREN[0]);

  const data = MOCK_DATA;

  const handlePayNow = () => setCurrentPage('fees');

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full min-h-[calc(100vh-140px)]">
      <AppSidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isParent={isParent}
        user={user}
        selectedChild={selectedChild}
        onSelectChild={setSelectedChild}
        feeStatus={data.feeStatus}
        onPayNow={handlePayNow}
      />

      <div className="flex-1 min-w-0">
        {currentPage === 'dashboard' && (
          <DashboardPage
            homework={data.homework}
            upcomingExams={data.exams}
            attendance={data.attendance}
            fees={data.feeStatus}
            isParent={isParent}
            selectedChild={selectedChild}
            displayName={displayName}
            onNavigate={setCurrentPage}
            onPayNow={handlePayNow}
          />
        )}
        {currentPage === 'academics' && (
          <AcademicsPage
            timetable={data.timetable}
            subjects={data.subjects}
            results={data.subjects}
          />
        )}
        {currentPage === 'assignments' && (
          <AssignmentsPage assignments={data.homework} />
        )}
        {currentPage === 'attendance' && (
          <AttendancePage attendance={data.attendance} />
        )}
        {currentPage === 'fees' && (
          <FeesPage fees={data.feeStatus} payments={data.receipts} />
        )}
        {currentPage === 'resources' && (
          <ResourcesPage materials={data.resources} />
        )}
        {currentPage === 'parent' && isParent && (
          <ParentPage
            children={MOCK_CHILDREN}
            isParent={isParent}
            selectedChild={selectedChild}
            onSelectChild={setSelectedChild}
            data={data}
          />
        )}
      </div>
    </div>
  );
}
