import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, CalendarCheck,
  CreditCard, Library, Users, ChevronRight, ChevronDown,
  AlertCircle, CheckCircle2, Clock, Download, Play,
  Upload, ArrowLeft, FileText, TrendingUp, Bell, User,
  Calendar, DollarSign, BookMarked, Video, Folder,
  XCircle, AlertTriangle, Send, Eye, BarChart2
} from 'lucide-react';
import { Button } from '../../common/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../common/ui/table';
import { Input } from '../../common/ui/input';
import { Select } from '../../common/ui/select';
import { Dialog } from '../../common/ui/dialog';
import { authService } from '../../common/services/authService';

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
      // day → status: 'P' | 'A' | 'L' | null
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
    { id: 'h2', subject: 'Physics', title: 'Newton\'s Laws — Problem Sheet', dueDate: '2026-06-28', status: 'submitted', teacher: 'Ms. Sharma' },
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
      { id: 'n2', title: 'Newton\'s Laws Summary', subject: 'Physics', size: '1.1 MB', date: '2026-06-12', type: 'PDF' },
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

// ─── Utility Helpers ────────────────────────────────────────────────────────────

const subjectColors = {
  'Mathematics': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Physics': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Chemistry': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'English': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'History': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Geography': 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Computer Sc.': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Computer Science': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Physical Ed.': 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Art & Craft': 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  'Class Activity': 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

const getSubjectColor = (subject) =>
  subjectColors[subject] || 'bg-zinc-100 text-zinc-700 dark:text-zinc-400';

const statusConfig = {
  pending: { label: 'PENDING', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  submitted: { label: 'Submitted', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  graded: { label: 'Graded', cls: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  overdue: { label: 'Overdue', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

const AttendanceDot = ({ status }) => {
  if (!status) return <span className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 inline-block" title="Weekend/Holiday" />;
  const map = {
    P: 'bg-emerald-500 title-P',
    A: 'bg-red-500',
    L: 'bg-amber-400',
  };
  const titles = { P: 'Present', A: 'Absent', L: 'Leave' };
  return (
    <span
      className={`h-6 w-6 rounded-full inline-flex items-center justify-center ${map[status]} text-white`}
      style={{ fontSize: '9px', fontWeight: 700 }}
      title={titles[status]}
    >
      {status}
    </span>
  );
};

const ScoreBar = ({ score, max = 100 }) => {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-text-primary w-8 text-right">{score}</span>
    </div>
  );
};

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-4 px-3">{children}</p>
);

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function StudentParentPortal() {
  const user = authService.getCurrentUser();
  const role = authService.getUserRole(); // 'STUDENT' | 'PARENT'

  const [currentPage, setCurrentPage] = useState('dashboard');

  // Parent-mode state
  const [selectedChild, setSelectedChild] = useState(MOCK_CHILDREN[0]);

  // Attendance month selector
  const [attendanceMonth, setAttendanceMonth] = useState('June 2026');

  // Dialogs
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  // Payment form
  const [payForm, setPayForm] = useState({ cardName: '', cardNumber: '', expiry: '', cvv: '', amount: '14500' });
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ childId: MOCK_CHILDREN[0]?.id, fromDate: '', toDate: '', reason: '' });
  const [leaveSent, setLeaveSent] = useState(false);

  // Assignment submission
  const [submitFile, setSubmitFile] = useState(null);
  const [submitNote, setSubmitNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  const isParent = role === 'PARENT';
  const displayName = isParent ? `${user?.name || 'PARENT'}` : `${user?.name || 'STUDENT'}`;
  const data = MOCK_DATA;

  const nav = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'academics', icon: BookOpen, label: 'Academics' },
    { id: 'assignments', icon: ClipboardList, label: 'Assignments' },
    { id: 'attendance', icon: CalendarCheck, label: 'Attendance' },
    { id: 'fees', icon: CreditCard, label: 'Fees' },
    { id: 'resources', icon: Library, label: 'Resources' },
    ...(isParent ? [{ id: 'parent', icon: Users, label: 'My Children' }] : []),
  ];

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaySuccess(true);
    }, 1800);
  };

  const handleSubmitAssignment = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitDone(true);
    }, 1500);
  };

  const handleLeaveSubmit = (e) => {
    e.preventDefault();
    setTimeout(() => setLeaveSent(true), 800);
  };

  const openSubmitDialog = (assignment) => {
    setSelectedAssignment(assignment);
    setSubmitFile(null);
    setSubmitNote('');
    setSubmitDone(false);
    setSubmitDialogOpen(true);
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full min-h-[calc(100vh-140px)]">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-full md:w-[240px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-6 py-2 space-y-6">
        <div>
          {/* Student/Child identity card */}
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
                  onChange={e => setSelectedChild(MOCK_CHILDREN.find(c => c.id === e.target.value))}
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

          <SectionLabel>Portal</SectionLabel>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            {nav.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setCurrentPage(id)}
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
          {data.feeStatus.outstanding > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
              <p className="text-xs font-black text-amber-700 dark:text-amber-400 mb-1">Fee Due</p>
              <p className="text-lg font-black text-text-primary tabular-nums">
                ₹{data.feeStatus.outstanding.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Due {data.feeStatus.dueDate}</p>
              <Button
                onClick={() => { setCurrentPage('fees'); setPaymentDialogOpen(true); }}
                className="mt-3 w-full text-xs py-1.5 justify-center bg-amber-600 hover:bg-amber-700 border-none text-white"
              >
                Pay Now
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* DASHBOARD                                                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">
                  {isParent ? `Welcome back` : `Good morning`}
                </h2>
                <p className="text-text-secondary text-sm mt-1">
                  {isParent
                    ? `Viewing ${selectedChild.name}'s academic overview.`
                    : `Here's your academic snapshot for today, ${displayName.split(' ')[0]}.`}
                </p>
              </div>
              <div className="text-xs text-text-muted font-semibold">Wednesday, 25 June 2026</div>
            </div>

            {/* Fee Banner */}
            {data.feeStatus.outstanding > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-text-primary">Fee payment due on {data.feeStatus.dueDate}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Outstanding balance: <span className="font-black text-amber-700 dark:text-amber-400 tabular-nums">₹{data.feeStatus.outstanding.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => { setCurrentPage('fees'); setPaymentDialogOpen(true); }}
                  className="bg-amber-600 hover:bg-amber-700 text-white border-none text-xs font-bold flex-shrink-0"
                >
                  Pay Fees
                </Button>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Attendance */}
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><CalendarCheck className="h-4 w-4" /></div>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {data.attendance.percentage}%
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Attendance</p>
                  <p className="text-2xl font-black text-text-primary mt-1 tabular-nums font-display">
                    {data.attendance.present}<span className="text-text-muted text-sm font-semibold">/{data.attendance.total}</span>
                  </p>
                  {/* Mini visual bar */}
                  <div className="mt-3 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${data.attendance.percentage}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Exams */}
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600"><BookOpen className="h-4 w-4" /></div>
                  </div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Upcoming Exams</p>
                  <p className="text-2xl font-black text-text-primary mt-1 font-display">{data.exams.length}</p>
                  <p className="text-xs text-text-muted mt-2">Next: <span className="font-bold text-text-primary">{data.exams[0].subject}</span> on {data.exams[0].date}</p>
                </CardContent>
              </Card>

              {/* Homework Due */}
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600"><ClipboardList className="h-4 w-4" /></div>
                    <span className="text-[10px] font-black text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                      {data.homework.filter(h => h.status === 'overdue').length} overdue
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Pending Tasks</p>
                  <p className="text-2xl font-black text-text-primary mt-1 font-display">
                    {data.homework.filter(h => h.status === 'pending').length}
                  </p>
                  <p className="text-xs text-text-muted mt-2">assignments to submit</p>
                </CardContent>
              </Card>

              {/* Fee Status */}
              <Card className="shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600"><CreditCard className="h-4 w-4" /></div>
                    <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">Due</span>
                  </div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Fee Balance</p>
                  <p className="text-2xl font-black text-text-primary mt-1 tabular-nums font-display">
                    ₹{data.feeStatus.outstanding.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted mt-2">due {data.feeStatus.dueDate}</p>
                </CardContent>
              </Card>
            </div>

            {/* Homework & Exams grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Homework */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-text-primary">Pending Homework</h3>
                  <button
                    onClick={() => setCurrentPage('assignments')}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {data.homework.slice(0, 4).map(hw => {
                    const cfg = statusConfig[hw.status];
                    return (
                      <div key={hw.id} className="flex items-start justify-between p-4 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 text-[10px] font-black px-2 py-0.5 rounded ${getSubjectColor(hw.subject)}`}>
                            {hw.subject.substring(0, 3).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary leading-tight">{hw.title}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">Due {hw.dueDate} · {hw.teacher}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcoming Exams */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-text-primary">Upcoming Exams</h3>
                  <button
                    onClick={() => setCurrentPage('academics')}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                  >
                    View timetable <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {data.exams.map(exam => (
                    <div key={exam.id} className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl shadow-xs">
                      <div className="flex-shrink-0 text-center bg-blue-500/8 border border-blue-500/15 rounded-lg px-3 py-2 min-w-[58px]">
                        <p className="text-[10px] font-bold text-blue-600 uppercase">{exam.date.split('-')[1] === '07' ? 'Jul' : 'Jun'}</p>
                        <p className="text-lg font-black text-text-primary tabular-nums leading-none">{exam.date.split('-')[2]}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary">{exam.subject}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{exam.time} · {exam.room}</p>
                        <p className="text-[10px] text-text-secondary mt-0.5 italic">{exam.syllabus}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ACADEMICS                                                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'academics' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Academics</h2>
              <p className="text-text-secondary text-sm mt-1">Timetable, subject results, and performance overview.</p>
            </div>

            {/* Timetable */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Weekly Timetable</h3>
              <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900">
                      <th className="p-3 text-left font-black text-text-muted uppercase tracking-wider border-b border-border w-28">Time Slot</th>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                        <th key={d} className="p-3 text-center font-black text-text-primary uppercase tracking-wider border-b border-border">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.timetable.Mon.map((slot, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50/50 dark:bg-zinc-900/30'}>
                        <td className="p-3 font-bold text-text-muted border-r border-border whitespace-nowrap">{slot.time}</td>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                          const cell = data.timetable[day][idx];
                          return (
                            <td key={day} className="p-2 text-center border-r border-border last:border-r-0">
                              {cell ? (
                                <div className={`rounded-lg px-2 py-1.5 ${getSubjectColor(cell.subject)}`}>
                                  <p className="font-bold text-[11px] leading-tight">{cell.subject}</p>
                                  <p className="text-[9px] opacity-70 mt-0.5">{cell.room}</p>
                                </div>
                              ) : (
                                <span className="text-text-muted text-[10px]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Subjects & Results */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Subject Results</h3>
              <Card className="overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.subjects.map(sub => (
                      <TableRow key={sub.code}>
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${getSubjectColor(sub.name)}`}>
                              {sub.code.split('-')[0]}
                            </span>
                            <span className="font-bold text-text-primary">{sub.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-text-secondary">{sub.teacher}</TableCell>
                        <TableCell className="font-mono font-bold text-text-primary tabular-nums">{sub.score}/{sub.maxScore}</TableCell>
                        <TableCell className="w-40">
                          <ScoreBar score={sub.score} max={sub.maxScore} />
                        </TableCell>
                        <TableCell>
                          <span className={`font-black text-sm ${sub.score >= 90 ? 'text-emerald-600' : sub.score >= 75 ? 'text-blue-600' : sub.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {sub.grade}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Performance Chart */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Performance Overview</h3>
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {data.subjects.map(sub => {
                      const pct = Math.round((sub.score / sub.maxScore) * 100);
                      const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={sub.code} className="flex items-center gap-4">
                          <span className="text-xs font-semibold text-text-secondary w-32 flex-shrink-0 truncate">{sub.name}</span>
                          <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden relative">
                            <div
                              className={`h-full ${barColor} rounded flex items-center justify-end pr-2 transition-all duration-500`}
                              style={{ width: `${pct}%` }}
                            >
                              <span className="text-[10px] font-black text-white tabular-nums">{pct}%</span>
                            </div>
                          </div>
                          <span className={`w-10 text-right text-xs font-black tabular-nums ${pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-blue-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {sub.grade}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Class average line indicator */}
                  <div className="mt-6 pt-5 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-text-muted font-semibold">Overall Average</span>
                    <span className="font-black text-lg text-text-primary tabular-nums">
                      {Math.round(data.subjects.reduce((a, s) => a + s.score, 0) / data.subjects.length)}
                      <span className="text-text-muted text-sm font-semibold">/100</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Report Cards */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Report Cards</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {['Term 1 — 2025', 'Term 2 — 2025', 'Term 3 — 2026'].map((term, i) => (
                  <div key={term} className="flex items-center justify-between p-4 border border-border rounded-xl bg-surface shadow-xs hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-text-muted flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-text-primary">{term}</p>
                        <p className="text-[10px] text-text-muted">Grade Card · PDF</p>
                      </div>
                    </div>
                    <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-text-secondary hover:text-text-primary">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ASSIGNMENTS                                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'assignments' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Assignments</h2>
              <p className="text-text-secondary text-sm mt-1">View, submit, and track your homework and assignments.</p>
            </div>

            {/* Filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {['All', 'PENDING', 'Submitted', 'Graded', 'Overdue'].map(f => (
                <button
                  key={f}
                  className="px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-surface text-text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-text-primary transition-all"
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Assignments List */}
            <div className="space-y-4">
              {data.homework.map(hw => {
                const cfg = statusConfig[hw.status];
                const canSubmit = hw.status === 'pending' || hw.status === 'overdue';
                return (
                  <div key={hw.id} className="p-5 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-lg flex-shrink-0 ${getSubjectColor(hw.subject)}`}>
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-text-primary">{hw.title}</h4>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                          </div>
                          <p className="text-xs text-text-secondary mt-1">{hw.subject} · {hw.teacher}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="h-3 w-3 text-text-muted" />
                            <span className={`text-[11px] font-semibold ${hw.status === 'overdue' ? 'text-red-600' : 'text-text-muted'}`}>
                              Due {hw.dueDate}
                            </span>
                          </div>
                          {hw.status === 'graded' && (
                            <p className="text-[11px] font-bold text-emerald-600 mt-1">
                              Grade received: <span className="text-lg">{hw.grade}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        {canSubmit && (
                          <Button
                            onClick={() => openSubmitDialog(hw)}
                            className="text-xs font-bold flex items-center gap-1.5"
                          >
                            <Upload className="h-3.5 w-3.5" /> Submit
                          </Button>
                        )}
                        {hw.status === 'submitted' && (
                          <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Awaiting review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assignment History */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Submission History</h3>
              <Card className="overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold text-text-primary py-3.5">Organic Compounds Lab Report</TableCell>
                      <TableCell className="text-xs text-text-secondary">Chemistry</TableCell>
                      <TableCell className="text-xs text-text-muted">2026-06-18</TableCell>
                      <TableCell><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Graded</span></TableCell>
                      <TableCell className="font-black text-emerald-600">A</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-text-primary py-3.5">Motion Graphs Analysis</TableCell>
                      <TableCell className="text-xs text-text-secondary">Physics</TableCell>
                      <TableCell className="text-xs text-text-muted">2026-06-10</TableCell>
                      <TableCell><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Graded</span></TableCell>
                      <TableCell className="font-black text-blue-600">B+</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-text-primary py-3.5">Algebra Problem Set 2</TableCell>
                      <TableCell className="text-xs text-text-secondary">Mathematics</TableCell>
                      <TableCell className="text-xs text-text-muted">2026-06-03</TableCell>
                      <TableCell><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Graded</span></TableCell>
                      <TableCell className="font-black text-emerald-600">A+</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ATTENDANCE                                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'attendance' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Attendance</h2>
                <p className="text-text-secondary text-sm mt-1">Daily records, monthly calendar, and attendance reports.</p>
              </div>
              <Select value={attendanceMonth} onChange={e => setAttendanceMonth(e.target.value)} className="w-40">
                <option>June 2026</option>
                <option>May 2026</option>
                <option>April 2026</option>
              </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Present', value: data.attendance.present, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                { label: 'Absent', value: data.attendance.absent, color: 'text-red-600', bg: 'bg-red-500/10' },
                { label: 'Leave', value: 3, color: 'text-amber-600', bg: 'bg-amber-500/10' },
                { label: 'Percentage', value: `${data.attendance.percentage}%`, color: 'text-blue-600', bg: 'bg-blue-500/10' },
              ].map(s => (
                <Card key={s.label} className="shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
                    <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Attendance progress bar */}
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-text-primary">Attendance Rate — {attendanceMonth}</h3>
                  <span className="text-2xl font-black text-text-primary tabular-nums">{data.attendance.percentage}%</span>
                </div>
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${data.attendance.percentage >= 85 ? 'bg-emerald-500' : data.attendance.percentage >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${data.attendance.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-text-muted mt-2 font-semibold">
                  <span>0%</span>
                  <span className="text-amber-600 font-black">75% Minimum</span>
                  <span>100%</span>
                </div>
              </CardContent>
            </Card>

            {/* Calendar Grid */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Monthly Calendar — {attendanceMonth}</h3>
              <Card className="shadow-sm overflow-hidden">
                <CardContent className="p-6">
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-2 mb-3">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="text-center text-[10px] font-black text-text-muted uppercase">{d}</div>
                    ))}
                  </div>
                  {/* June 2026 starts on Monday (offset 1) */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* Empty offset for Sun */}
                    <div />
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                      const status = data.attendance.monthly[day];
                      // day 6,7,13,14,20,21,27,28 are Sat/Sun
                      const isWeekend = [6, 7, 13, 14, 20, 21, 27, 28].includes(day);
                      return (
                        <div key={day} className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-semibold ${isWeekend ? 'text-text-muted' : 'text-text-secondary'}`}>{day}</span>
                          {isWeekend ? (
                            <span className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 inline-block" title="Weekend" />
                          ) : (
                            <AttendanceDot status={status} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="mt-6 pt-4 border-t border-border flex items-center gap-6 flex-wrap text-xs font-semibold text-text-secondary">
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-emerald-500 inline-block" /> Present</div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-red-500 inline-block" /> Absent</div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-amber-400 inline-block" /> Leave</div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 inline-block" /> Holiday/Weekend</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Attendance Report */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Attendance Reports</h3>
              <Card className="overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Working Days</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { month: 'June 2026', working: 22, present: 19, absent: 3 },
                      { month: 'May 2026', working: 23, present: 20, absent: 3 },
                      { month: 'April 2026', working: 21, present: 18, absent: 3 },
                      { month: 'March 2026', working: 24, present: 22, absent: 2 },
                    ].map(r => {
                      const rate = Math.round((r.present / r.working) * 100);
                      return (
                        <TableRow key={r.month}>
                          <TableCell className="font-semibold text-text-primary py-3.5">{r.month}</TableCell>
                          <TableCell className="tabular-nums">{r.working}</TableCell>
                          <TableCell className="text-emerald-600 font-bold tabular-nums">{r.present}</TableCell>
                          <TableCell className="text-red-600 font-bold tabular-nums">{r.absent}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${rate >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${rate}%` }} />
                              </div>
                              <span className={`text-xs font-black tabular-nums ${rate >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>{rate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* FEES                                                             */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'fees' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Fees & Payments</h2>
                <p className="text-text-secondary text-sm mt-1">Outstanding balances, payment history, and receipts.</p>
              </div>
              <Button
                onClick={() => { setPaySuccess(false); setPaymentDialogOpen(true); }}
                className="flex items-center gap-2"
              >
                <CreditCard className="h-4 w-4" /> Pay Online
              </Button>
            </div>

            {/* Outstanding Fee Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 p-6 bg-zinc-950 dark:bg-zinc-900 text-zinc-50 rounded-2xl relative overflow-hidden shadow-lg">
                <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-zinc-800/40 blur-2xl pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Outstanding Balance</p>
                      <p className="text-4xl font-black tabular-nums mt-1">₹{data.feeStatus.outstanding.toLocaleString()}</p>
                    </div>
                    <span className="bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Due</span>
                  </div>
                  <div className="space-y-2 mb-6">
                    {data.feeStatus.breakdown.map(item => (
                      <div key={item.label} className="flex justify-between text-xs font-semibold border-b border-zinc-800 pb-2">
                        <span className="text-zinc-400">{item.label}</span>
                        <span className="tabular-nums">₹{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Due date: <span className="text-zinc-200 font-bold">{data.feeStatus.dueDate}</span></span>
                    <Button
                      onClick={() => { setPaySuccess(false); setPaymentDialogOpen(true); }}
                      className="bg-zinc-50 text-zinc-900 hover:bg-zinc-200 border-none text-xs font-bold py-2 px-4"
                    >
                      Pay Now
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Last Payment</p>
                    <p className="text-2xl font-black text-emerald-600 tabular-nums mt-1">₹{data.feeStatus.lastPaid.toLocaleString()}</p>
                    <p className="text-xs text-text-muted mt-1">{data.feeStatus.lastPaidDate}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Annual Fee Paid</p>
                    <p className="text-2xl font-black text-text-primary tabular-nums mt-1">₹66,000</p>
                    <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '75%' }} />
                    </div>
                    <p className="text-[10px] text-text-muted mt-1.5">75% of ₹88,000 annual fee</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Receipts */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Payment Receipts</h3>
              <Card className="overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt No.</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.receipts.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs font-bold text-text-primary py-3.5">{r.id}</TableCell>
                        <TableCell className="text-sm text-text-secondary">{r.description}</TableCell>
                        <TableCell className="text-xs text-text-muted">{r.date}</TableCell>
                        <TableCell>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-text-secondary">{r.mode}</span>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-text-primary tabular-nums">₹{r.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted hover:text-text-primary transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* LEARNING RESOURCES                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'resources' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Learning Resources</h2>
              <p className="text-text-secondary text-sm mt-1">Notes, video lessons, and study materials from your teachers.</p>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Class Notes</h3>
              <div className="space-y-3">
                {data.resources.notes.map(note => (
                  <div key={note.id} className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-lg ${getSubjectColor(note.subject)}`}>
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{note.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${getSubjectColor(note.subject)}`}>{note.subject}</span>
                          <span className="text-[10px] text-text-muted">{note.size} · {note.date}</span>
                        </div>
                      </div>
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-text-primary transition-colors">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Videos */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Video Lessons</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.resources.videos.map(vid => (
                  <div key={vid.id} className="p-4 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow flex items-center gap-4">
                    <div className="h-16 w-24 rounded-lg bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-primary leading-tight">{vid.title}</p>
                      <p className={`text-[10px] font-black mt-1 ${getSubjectColor(vid.subject)} px-2 py-0.5 rounded w-fit`}>{vid.subject}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-text-muted">{vid.duration} · {vid.date}</span>
                        <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                          Watch <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Materials */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-4">Study Materials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.resources.materials.map(mat => (
                  <div key={mat.id} className="flex items-center justify-between p-4 border border-border rounded-xl bg-surface shadow-xs hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      <Folder className="h-5 w-5 text-text-muted flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-text-primary">{mat.title}</p>
                        <p className="text-[10px] text-text-muted">{mat.type} · {mat.size}</p>
                      </div>
                    </div>
                    <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-text-muted hover:text-text-primary">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PARENT — MY CHILDREN                                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {currentPage === 'parent' && isParent && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">My Children</h2>
                <p className="text-text-secondary text-sm mt-1">Monitor attendance, progress, and fees for each child.</p>
              </div>
              <Button onClick={() => { setLeaveSent(false); setLeaveDialogOpen(true); }} variant="outline" className="flex items-center gap-2 text-xs font-bold">
                <Send className="h-3.5 w-3.5" /> Request Leave
              </Button>
            </div>

            {/* Child selector tabs */}
            <div className="flex gap-3">
              {MOCK_CHILDREN.map(child => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                    selectedChild.id === child.id
                      ? 'bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 border-zinc-900 dark:border-zinc-50 shadow-md'
                      : 'bg-surface border-border text-text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400'
                  }`}
                >
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${selectedChild.id === child.id ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    {child.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{child.name}</p>
                    <p className={`text-[10px] font-semibold ${selectedChild.id === child.id ? 'opacity-70' : 'text-text-muted'}`}>{child.grade}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Child Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Attendance</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">88%</p>
                  <p className="text-[10px] text-text-muted mt-0.5">132/150 days</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Avg Score</p>
                  <p className="text-2xl font-black text-blue-600 mt-1">84</p>
                  <p className="text-[10px] text-text-muted mt-0.5">out of 100</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Due Fee</p>
                  <p className="text-2xl font-black text-amber-600 tabular-nums mt-1">₹14.5K</p>
                  <p className="text-[10px] text-text-muted mt-0.5">due Jul 15</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Pending HW</p>
                  <p className="text-2xl font-black text-text-primary mt-1">2</p>
                  <p className="text-[10px] text-text-muted mt-0.5">assignments</p>
                </CardContent>
              </Card>
            </div>

            {/* Attendance + Academic side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Attendance mini */}
              <Card className="shadow-sm">
                <CardHeader className="py-4 border-b border-border">
                  <CardTitle className="text-sm font-bold text-text-primary">Attendance — June 2026</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-center">
                      <p className="text-3xl font-black text-emerald-600">88%</p>
                      <p className="text-[10px] text-text-muted font-semibold mt-0.5">attendance rate</p>
                    </div>
                    <div className="flex gap-6 text-center">
                      <div>
                        <p className="text-xl font-black text-text-primary">19</p>
                        <p className="text-[10px] text-text-muted font-semibold">Present</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-red-600">3</p>
                        <p className="text-[10px] text-text-muted font-semibold">Absent</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-amber-500">1</p>
                        <p className="text-[10px] text-text-muted font-semibold">Leave</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                  </div>
                </CardContent>
              </Card>

              {/* Academic progress mini */}
              <Card className="shadow-sm">
                <CardHeader className="py-4 border-b border-border">
                  <CardTitle className="text-sm font-bold text-text-primary">Academic Progress</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-2.5">
                  {data.subjects.slice(0, 5).map(sub => (
                    <div key={sub.code} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-text-secondary w-24 flex-shrink-0 truncate">{sub.name}</span>
                      <div className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                        <div
                          className={`h-full rounded flex items-center justify-end pr-2 ${sub.score >= 90 ? 'bg-emerald-500' : sub.score >= 75 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${sub.score}%` }}
                        >
                          <span className="text-[9px] font-black text-white">{sub.score}</span>
                        </div>
                      </div>
                      <span className="w-6 text-right text-[10px] font-black text-text-primary">{sub.grade}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Fee tracking */}
            <Card className="shadow-sm">
              <CardHeader className="py-4 border-b border-border">
                <CardTitle className="text-sm font-bold text-text-primary">Fee Tracking — {selectedChild.name}</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee Head</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.feeStatus.breakdown.map(f => (
                    <TableRow key={f.label}>
                      <TableCell className="font-semibold text-text-primary py-3.5">{f.label}</TableCell>
                      <TableCell className="font-mono font-bold tabular-nums">₹{f.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Due</span>
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">{data.feeStatus.dueDate}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold text-text-primary py-3.5">May Term Payment</TableCell>
                    <TableCell className="font-mono font-bold tabular-nums">₹22,000</TableCell>
                    <TableCell>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Paid</span>
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">2026-06-01</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>

            {/* Leave history */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-text-primary">Leave Requests</h3>
                <Button onClick={() => { setLeaveSent(false); setLeaveDialogOpen(true); }} variant="outline" className="text-xs font-bold flex items-center gap-1.5">
                  <Send className="h-3 w-3" /> New Request
                </Button>
              </div>
              <Card className="overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dates</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold text-text-primary py-3.5">Jun 11, 2026</TableCell>
                      <TableCell className="text-xs text-text-secondary">Medical appointment</TableCell>
                      <TableCell className="text-xs text-text-muted">Jun 9, 2026</TableCell>
                      <TableCell><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Approved</span></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-text-primary py-3.5">May 22–23, 2026</TableCell>
                      <TableCell className="text-xs text-text-secondary">Family function</TableCell>
                      <TableCell className="text-xs text-text-muted">May 19, 2026</TableCell>
                      <TableCell><span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Approved</span></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        )}

      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}

      {/* Payment Dialog */}
      <Dialog
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        title="Online Fee Payment"
        description={`Pay outstanding fee of ₹${data.feeStatus.outstanding.toLocaleString()} securely.`}
        footer={
          paySuccess ? (
            <Button onClick={() => setPaymentDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button onClick={handlePaymentSubmit} disabled={paying}>
                {paying ? 'Processing...' : `Pay ₹${parseInt(payForm.amount || 0).toLocaleString()}`}
              </Button>
            </>
          )
        }
      >
        {paySuccess ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-lg font-black text-text-primary">Payment Successful</h3>
            <p className="text-sm text-text-secondary">₹{parseInt(payForm.amount || 0).toLocaleString()} has been received. Receipt will be emailed shortly.</p>
          </div>
        ) : (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input
                type="number"
                value={payForm.amount}
                onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="14500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Cardholder Name</label>
              <Input
                value={payForm.cardName}
                onChange={e => setPayForm(p => ({ ...p, cardName: e.target.value }))}
                placeholder="As it appears on card"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Card Number</label>
              <Input
                value={payForm.cardNumber}
                onChange={e => setPayForm(p => ({ ...p, cardNumber: e.target.value }))}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Expiry</label>
                <Input
                  value={payForm.expiry}
                  onChange={e => setPayForm(p => ({ ...p, expiry: e.target.value }))}
                  placeholder="MM / YY"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">CVV</label>
                <Input
                  value={payForm.cvv}
                  onChange={e => setPayForm(p => ({ ...p, cvv: e.target.value }))}
                  placeholder="•••"
                  maxLength={4}
                  required
                />
              </div>
            </div>
            <p className="text-[10px] text-text-muted flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-text-muted flex items-center justify-center text-[7px]">🔒</span>
              Simulated secure payment. No real data is transmitted.
            </p>
          </form>
        )}
      </Dialog>

      {/* Submit Assignment Dialog */}
      <Dialog
        isOpen={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        title="Submit Assignment"
        description={selectedAssignment ? `${selectedAssignment.title} — ${selectedAssignment.subject}` : ''}
        footer={
          submitDone ? (
            <Button onClick={() => setSubmitDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitAssignment} disabled={submitting}>
                {submitting ? 'Uploading...' : 'Submit Assignment'}
              </Button>
            </>
          )
        }
      >
        {submitDone ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-black text-text-primary">Assignment Submitted</h3>
            <p className="text-sm text-text-secondary">Your submission has been recorded and sent to the teacher for review.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitAssignment} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Upload File</label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-6 w-6 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-semibold text-text-secondary">
                  {submitFile ? submitFile.name : 'Click to upload PDF, DOCX, or image'}
                </p>
                <p className="text-[10px] text-text-muted mt-1">Max file size: 10 MB</p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  className="hidden"
                  onChange={e => setSubmitFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Note to Teacher (optional)</label>
              <textarea
                value={submitNote}
                onChange={e => setSubmitNote(e.target.value)}
                rows={3}
                placeholder="Any note about your submission..."
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg resize-none text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </form>
        )}
      </Dialog>

      {/* Leave Request Dialog */}
      <Dialog
        isOpen={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        title="Request Leave"
        description="Submit a leave application for your child."
        footer={
          leaveSent ? (
            <Button onClick={() => setLeaveDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleLeaveSubmit}>Submit Request</Button>
            </>
          )
        }
      >
        {leaveSent ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="text-lg font-black text-text-primary">Leave Request Sent</h3>
            <p className="text-sm text-text-secondary">The class teacher has been notified. You'll receive confirmation shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleLeaveSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Child</label>
              <Select
                value={leaveForm.childId}
                onChange={e => setLeaveForm(p => ({ ...p, childId: e.target.value }))}
              >
                {MOCK_CHILDREN.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">From Date</label>
                <Input
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={e => setLeaveForm(p => ({ ...p, fromDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">To Date</label>
                <Input
                  type="date"
                  value={leaveForm.toDate}
                  onChange={e => setLeaveForm(p => ({ ...p, toDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Reason</label>
              <textarea
                value={leaveForm.reason}
                onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                rows={3}
                placeholder="Brief reason for leave..."
                required
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg resize-none text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </form>
        )}
      </Dialog>

    </div>
  );
}
