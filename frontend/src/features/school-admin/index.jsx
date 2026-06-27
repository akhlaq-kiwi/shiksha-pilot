import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, School, BookOpen, Users, UserCog, Clock,
  ClipboardCheck, FileText, DollarSign, BarChart2, Shield
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

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/school-admin',            label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/school-admin/profile',    label: 'School Profile', icon: School },
  { path: '/school-admin/academic',   label: 'Academic', icon: BookOpen },
  { path: '/school-admin/students',   label: 'Students', icon: Users },
  { path: '/school-admin/staff',      label: 'Staff', icon: UserCog },
  { path: '/school-admin/timetable',  label: 'Timetable', icon: Clock },
  { path: '/school-admin/attendance', label: 'Attendance', icon: ClipboardCheck },
  { path: '/school-admin/exams',      label: 'Examinations', icon: FileText },
  { path: '/school-admin/finance',    label: 'Finance', icon: DollarSign },
  { path: '/school-admin/reports',    label: 'Reports', icon: BarChart2 },
  { path: '/school-admin/security',   label: 'Security', icon: Shield },
];

// ─── Portal Root ──────────────────────────────────────────────────────────────

export default function SchoolAdminPortal() {
  const nav = useNavigate();
  const location = useLocation();

  const isActive = (path, exact) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const navBtn = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path, item.exact);
    return (
      <button
        key={item.path}
        onClick={() => nav(item.path)}
        className={`flex items-center gap-3 pl-1 pr-3 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 w-full text-left ${active ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full min-h-[calc(100vh-140px)]">

      {/* Sidebar */}
      <aside className="w-full md:w-[200px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-2 py-2 space-y-6">
        <div>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            {NAV_ITEMS.map(navBtn)}
          </nav>
        </div>
        <div className="hidden md:block bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-bold text-primary mb-1">Academic Year</p>
          <p className="text-[11px] text-text-muted">2025–2026 (Current)</p>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 min-w-0">
        <Routes>
          <Route index element={<DashboardPage onNavigate={(p) => nav(`/school-admin/${p}`)} />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="academic" element={<AcademicPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="*" element={<Navigate to="/school-admin" replace />} />
        </Routes>
      </div>
    </div>
  );
}
