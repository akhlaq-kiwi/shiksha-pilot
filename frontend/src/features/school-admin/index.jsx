import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, School, BookOpen, Users, UserCog, Clock,
  ClipboardCheck, FileText, DollarSign, BarChart2, Shield, Settings, RefreshCw
} from 'lucide-react';

import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AcademicPage from './pages/AcademicPage';
import ClassesPage from './pages/ClassesPage';
import StaffPage from './pages/StaffPage';
import TimetablePage from './pages/TimetablePage';
import AttendancePage from './pages/AttendancePage';
import ExamsPage from './pages/ExamsPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import AuditsSettingsPage from './pages/AuditsSettingsPage';
import SecurityPage from './pages/SecurityPage';

import { schoolService } from '../../common/services/schoolService';
import { apiClient } from '../../common/services/apiClient';
import { Card } from '../../common/ui/card';
import { Input } from '../../common/ui/input';
import { Dialog } from '../../common/ui/dialog';
import { Button } from '../../common/ui/button';

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/school-admin',            label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/school-admin/classes',    label: 'Classes', icon: Users },
  { path: '/school-admin/staff',      label: 'Teachers', icon: UserCog },
  { path: '/school-admin/timetable',  label: 'Timetable', icon: Clock },
  { path: '/school-admin/attendance', label: 'Attendance', icon: ClipboardCheck },
  { path: '/school-admin/exams',      label: 'Examinations', icon: FileText },
  { path: '/school-admin/finance',    label: 'Finance', icon: DollarSign },
  { path: '/school-admin/reports',    label: 'Reports', icon: BarChart2 },
  { path: '/school-admin/audits-settings', label: 'Audits & Settings', icon: Settings },
  { path: '/school-admin/security',   label: 'Security', icon: Shield },
];

// Onboarding content screen when no active academic year is present
function OnboardingScreen() {
  const nav = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] w-full px-4 py-12">
      <Card className="max-w-md w-full shadow-lg border border-border bg-surface p-6 text-center animate-in fade-in duration-300">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <School className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-xl font-black text-text-primary tracking-tight font-display">Welcome to Shiksha Pilot</h3>
        <p className="text-xs text-text-secondary mt-3 leading-relaxed">
          Before you begin managing your school, please create your first Academic Year.
        </p>
        <p className="text-xs text-text-secondary mt-2 leading-relaxed">
          An Academic Year is required before adding classes, students, teachers, attendance, examinations, and finance records.
        </p>
        <div className="mt-6">
          <Button onClick={() => nav('/school-admin/audits-settings')} className="font-bold w-full py-2.5 shadow-sm">
            Create Academic Year
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── Portal Root ──────────────────────────────────────────────────────────────

export default function SchoolAdminPortal() {
  const nav = useNavigate();
  const location = useLocation();

  const [academicYears, setAcademicYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(true);

  const loadAcademicYears = async () => {
    try {
      const list = await schoolService.getAcademicYears();
      setAcademicYears(list || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingYears(false);
    }
  };

  useEffect(() => {
    loadAcademicYears();
  }, []);

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
        className={`flex items-center justify-start gap-3 pl-1 pr-3 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 w-full text-left ${active ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.label}</span>
      </button>
    );
  };

  if (loadingYears) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Verifying Setup...</p>
      </div>
    );
  }

  const hasYear = academicYears.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full min-h-[calc(100vh-140px)]">

      {/* Sidebar */}
      <aside className="w-full md:w-[240px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-4 md:pr-10 pb-6 pt-2 md:sticky md:top-24 md:h-[calc(100vh-180px)]">
        <div className="overflow-y-auto scrollbar-none flex-1">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            {NAV_ITEMS.map(navBtn)}
          </nav>
        </div>
        <div className="hidden md:block mt-4 flex-shrink-0">
          <button
            onClick={() => nav('/school-admin/profile')}
            className={`flex items-center justify-start gap-3 pl-1 pr-3 py-2.5 rounded-lg text-sm font-bold transition-all w-full text-left border uppercase tracking-wider ${isActive('/school-admin/profile') ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50' : 'text-text-secondary border-zinc-200 bg-surface hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-900'}`}
          >
            <UserCog className="h-4 w-4 flex-shrink-0 text-text-secondary" />
            <span>PROFILE</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 min-w-0">
        {!hasYear && location.pathname !== '/school-admin/audits-settings' ? (
          <OnboardingScreen />
        ) : (
          <Routes>
            <Route index element={<DashboardPage onNavigate={(p) => nav(`/school-admin/${p}`)} />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audits-settings" element={<AuditsSettingsPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="*" element={<Navigate to="/school-admin" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
