import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, ClipboardList, CalendarCheck,
  CreditCard, Library, Users, FileText, Sparkles, Trophy
} from 'lucide-react';
import { Select } from '../../common/ui/select';
import { Button } from '../../common/ui/button';
import { authService } from '../../common/services/authService';
import AppSidebar from '../../common/components/AppSidebar';
import MobileTabBar from '../../common/components/MobileTabBar';

import DashboardPage from './pages/DashboardPage';
import AcademicsPage from './pages/AcademicsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AttendancePage from './pages/AttendancePage';
import FeesPage from './pages/FeesPage';
import ResourcesPage from './pages/ResourcesPage';
import ParentPage from './pages/ParentPage';
import ParentLeavePage from './pages/ParentLeavePage';
import SettingsPage from './pages/SettingsPage';
import AchievementsPage from '../achievements/pages/AchievementsPage';

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

/**
 * Student/Parent navigation.
 *
 * Built on the shared AppSidebar so this portal matches the others, with two
 * portal-specific slots:
 *  - header: identity card + child switcher. The child switcher was previously
 *    buried mid-sidebar; it now sits at the top and also appears in the mobile
 *    drawer, because showing a parent the wrong child's data destroys trust.
 *  - footer: the outstanding-fee widget.
 *
 * NAV_ITEMS is exported so the mobile bottom tab bar shows the same
 * destinations in the same order.
 */
export function getStudentNavItems(isParent) {
  return [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'attendance', icon: CalendarCheck, label: 'Attendance' },
    { id: 'fees', icon: CreditCard, label: 'Fees' },
    { id: 'academics', icon: BookOpen, label: 'Results' },
    { id: 'assignments', icon: ClipboardList, label: 'Assignments' },
    { id: 'leaves', icon: FileText, label: 'Leave' },
    { id: 'resources', icon: Library, label: 'Resources' },
    { id: 'achievements', icon: Trophy, label: 'Achievements' },
    ...(isParent ? [{ id: 'parent', icon: Users, label: 'My children' }] : []),
  ];
}

function StudentIdentityHeader({ isParent, user, selectedChild, onSelectChild }) {
  const displayName = isParent ? (user?.name || 'Parent') : (user?.name || 'Student');
  return (
    <div className="mb-5 flex-shrink-0 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg font-semibold">
          {isParent ? 'P' : (user?.name?.charAt(0) || 'S')}
        </div>
        <div className="min-w-0">
          <p className="truncate text-body-md font-semibold text-text-primary">{displayName}</p>
          <p className="text-body-sm text-text-muted">
            {isParent ? 'Parent account' : selectedChild?.grade || 'Student'}
          </p>
        </div>
      </div>

      {isParent && (
        <div className="mt-3 border-t border-border pt-3">
          <label
            htmlFor="child-switcher"
            className="mb-1.5 block text-overline text-text-muted"
          >
            Viewing child
          </label>
          <Select
            id="child-switcher"
            value={selectedChild.id}
            onChange={e => onSelectChild(MOCK_CHILDREN.find(c => c.id === e.target.value))}
          >
            {MOCK_CHILDREN.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <p className="mt-1.5 text-body-sm text-text-muted">
            {selectedChild.grade} · Roll {selectedChild.rollNo.split('-')[2]}
          </p>
        </div>
      )}
    </div>
  );
}

function FeeDueWidget({ feeStatus, onPayNow, currency }) {
  if (!feeStatus?.outstanding) return null;
  return (
    <div className="rounded-xl border border-warning-200 bg-warning-50 p-4">
      <p className="mb-1 text-body-sm font-semibold text-warning-700">Fee due</p>
      <p className="text-display-sm text-text-primary tabular-nums">
        {currency ? currency(feeStatus.outstanding) : `₹${feeStatus.outstanding.toLocaleString()}`}
      </p>
      <p className="mt-0.5 text-body-sm text-text-muted">Due {feeStatus.dueDate}</p>
      <Button onClick={onPayNow} size="touch" className="mt-3 w-full justify-center">
        Pay now
      </Button>
    </div>
  );
}

// ─── Portal Root ────────────────────────────────────────────────────────────────

export default function StudentParentPortal() {
  const user = authService.getCurrentUser();
  const role = authService.getUserRole(); // 'STUDENT' | 'PARENT'
  const isParent = role === 'PARENT';
  const displayName = user?.name || (isParent ? 'PARENT' : 'STUDENT');

  const location = useLocation();
  const navigate = useNavigate();

  const getPageFromPath = useCallback(() => {
    const path = location.pathname;
    if (path.endsWith('/leaves')) return 'leaves';
    if (path.endsWith('/academics')) return 'academics';
    if (path.endsWith('/assignments')) return 'assignments';
    if (path.endsWith('/attendance')) return 'attendance';
    if (path.endsWith('/fees')) return 'fees';
    if (path.endsWith('/resources')) return 'resources';
    if (path.endsWith('/parent')) return 'parent';
    if (path.endsWith('/settings')) return 'settings';
    if (path.endsWith('/game') || path.endsWith('/achievements')) return 'dashboard';
    return 'dashboard';
  }, [location.pathname]);

  const [currentPage, setCurrentPage] = useState(getPageFromPath);

  useEffect(() => {
    setCurrentPage(getPageFromPath());
  }, [location.pathname, getPageFromPath]);

  const handleNavigate = (id) => {
    const base = role === 'PARENT' ? '/parent' : '/student';
    navigate(id === 'dashboard' ? base : `${base}/${id}`);
  };

  const [selectedChild, setSelectedChild] = useState(MOCK_CHILDREN[0]);

  const data = MOCK_DATA;

  const handlePayNow = () => handleNavigate('fees');

  const navItems = getStudentNavItems(isParent);

  return (
    <div className="flex flex-col md:flex-row w-full min-h-[calc(100vh-56px)] bg-background">
      <AppSidebar
        items={navItems}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        title={isParent ? 'Parent menu' : 'Student menu'}
        header={
          <StudentIdentityHeader
            isParent={isParent}
            user={user}
            selectedChild={selectedChild}
            onSelectChild={setSelectedChild}
          />
        }
        footer={<FeeDueWidget feeStatus={data.feeStatus} onPayNow={handlePayNow} />}
      />

      <div className="flex-1 min-w-0 p-6 md:p-8 max-w-7xl mx-auto w-full">
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
        {currentPage === 'leaves' && (
          <ParentLeavePage />
        )}
        {currentPage === 'fees' && (
          <FeesPage fees={data.feeStatus} payments={data.receipts} />
        )}
        {currentPage === 'resources' && (
          <ResourcesPage materials={data.resources} />
        )}
        {currentPage === 'achievements' && (
          <AchievementsPage />
        )}
        {currentPage === 'settings' && (
          <SettingsPage />
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

        {/*
          Bottom tab bar for phones. These users are mobile-first and infrequent;
          a thumb-reachable bar beats a horizontally scrolling strip with no
          scroll affordance.
        */}
        <MobileTabBar
          items={navItems}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          primaryCount={4}
        />
      </div>
    </div>
  );
}
