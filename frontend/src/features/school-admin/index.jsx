import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, School, BookOpen, Users, UserCog, Clock,
  ClipboardCheck, FileText, DollarSign, BarChart2, Shield, Settings, RefreshCw, Landmark,
  AlertCircle, AlertTriangle, Copy, Phone, Mail, ExternalLink
} from 'lucide-react';
import { useToast } from '../../common/components/Toast';

import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AcademicPage from './pages/AcademicPage';
import ClassesPage from './pages/ClassesPage';
import StaffPage from './pages/StaffPage';
import TimetablePage from './pages/TimetablePage';
import AttendancePage from './pages/AttendancePage';
import ExamsPage from './pages/ExamsPage';
import SeatingPlanPage from './pages/SeatingPlanPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import FinancialReportsPage from './pages/FinancialReportsPage';
import FinanceManagementPage from './pages/FinanceManagementPage';
import AuditsSettingsPage from './pages/AuditsSettingsPage';
import SecurityPage from './pages/SecurityPage';
import SalaryDisbursementPage from './pages/SalaryDisbursementPage';

import { schoolService } from '../../common/services/schoolService';
import { apiClient } from '../../common/services/apiClient';
import { Card } from '../../common/ui/card';
import { Input } from '../../common/ui/input';
import { Dialog } from '../../common/ui/dialog';
import { Button } from '../../common/ui/button';

import { useAcademicYear } from '../../common/contexts/AcademicYearContext';

// ─── Nav Items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/school-admin',            label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/school-admin/classes',    label: 'Classes', icon: Users },
  { path: '/school-admin/staff',      label: 'Teachers', icon: UserCog },
  { path: '/school-admin/timetable',  label: 'Timetable', icon: Clock },
  { path: '/school-admin/attendance', label: 'Attendance', icon: ClipboardCheck },
  { path: '/school-admin/exams',      label: 'Examinations', icon: FileText },
  { path: '/school-admin/finance',    label: 'Fees Portal', icon: DollarSign },
  { path: '/school-admin/financial-reports', label: 'Financial Reports', icon: FileText },
  { path: '/school-admin/finance-management', label: 'Finance Management', icon: Landmark },
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

function ContactSuperAdminDialog({ isOpen, onClose }) {
  const toast = useToast();

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied successfully.`, 'Copied');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Contact Super Admin"
      description="Get in touch with support to activate or renew subscription plans."
      className="max-w-md animate-in fade-in zoom-in-95 duration-200"
      footer={
        <div className="flex justify-end w-full">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm mt-3">
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
          To purchase or renew a subscription plan, please contact the ShikshaPilot Super Admin using any of the methods below.
          Our team will assist you with plan activation and account renewal.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-zinc-500" />
              <span className="text-text-primary font-bold">8650302499</span>
            </div>
            <Button 
              size="xs" 
              variant="outline" 
              className="flex items-center gap-1 font-bold text-[10px] py-1 px-2.5 h-7 rounded-lg"
              onClick={() => handleCopy('8650302499', 'Phone number')}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-zinc-500" />
              <span className="text-text-primary font-bold">Shikshapilot@gmail.com</span>
            </div>
            <Button 
              size="xs" 
              variant="outline" 
              className="flex items-center gap-1 font-bold text-[10px] py-1 px-2.5 h-7 rounded-lg"
              onClick={() => handleCopy('Shikshapilot@gmail.com', 'Email address')}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function SubscriptionExpiredScreen({ profile }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await schoolService.getActivePlans();
        const sorted = (data || []).sort((a, b) => a.price - b.price);
        setPlans(sorted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] w-full px-4 py-12 bg-zinc-50/50 dark:bg-zinc-950/20">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in duration-300">
        <div className="max-w-md mx-auto space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Subscription Expired</h2>
          <p className="text-sm text-text-secondary leading-relaxed font-medium">
            Your subscription has expired.
          </p>
          <p className="text-sm text-text-secondary leading-relaxed font-medium mt-1">
            Please purchase a new subscription plan to continue using ShikshaPilot.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-6">Available Active Plans</h3>
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fetching plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-border bg-surface rounded-2xl text-text-muted text-sm font-medium">
              No active subscription plans found. Please contact support.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
              {plans.map(p => (
                <Card key={p.id} className="shadow-sm border-border bg-surface flex flex-col justify-between p-6 rounded-2xl min-h-[350px] relative hover:shadow-md transition-all duration-200">
                  <div className="space-y-4">
                    <div className="border-b border-border/60 pb-4">
                      <h4 className="text-base font-black text-text-primary font-display">{p.name}</h4>
                      <p className="text-2xl font-black text-text-primary tracking-tight mt-1">
                        ₹{parseFloat(p.price).toLocaleString('en-IN')}
                        <span className="text-xs font-bold text-text-secondary tracking-normal">/mo</span>
                      </p>
                      <p className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md inline-block font-extrabold uppercase mt-2.5">
                        {p.student_limit ? `Up to ${p.student_limit.toLocaleString()} Students` : 'Unlimited Students'}
                      </p>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed font-medium">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-6">
                    <Button 
                      className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 shadow-sm text-xs py-2 rounded-xl"
                      onClick={() => setContactOpen(true)}
                    >
                      CONTACT SUPER ADMIN
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ContactSuperAdminDialog isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

// ─── Portal Root ──────────────────────────────────────────────────────────────

export default function SchoolAdminPortal() {
  const nav = useNavigate();
  const location = useLocation();

  const { academicYears, loading: loadingYears, refreshYears } = useAcademicYear();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await schoolService.getSchoolProfile();
        setProfile(data || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();

    const handleProfileUpdate = (e) => {
      if (e.detail) {
        setProfile(e.detail);
      }
    };
    window.addEventListener('school-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('school-profile-updated', handleProfileUpdate);
  }, []);

  const getRemainingDays = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const datePart = expiryDateStr.split(' ')[0];
    const expiry = new Date(datePart.replace(/-/g, '/'));
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isActive = (path, exact) => {
    if (exact) return location.pathname === path;
    if (path === '/school-admin/finance') {
      return location.pathname === '/school-admin/finance';
    }
    return location.pathname.startsWith(path);
  };

  const navBtn = (item) => {
    const Icon = item.icon;
    const active = isActive(item.path, item.exact);
    return (
      <button
        key={item.path}
        onClick={() => nav(item.path)}
        className={`flex items-center justify-start gap-3 py-2 rounded-lg transition-all flex-shrink-0 w-full text-left ${
          item.isSubmenu 
            ? 'pl-8 pr-3 text-xs font-medium text-text-secondary dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800' 
            : 'pl-1 pr-3 text-sm font-semibold text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'
        } ${active ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 font-bold' : ''}`}
      >
        <Icon className={`flex-shrink-0 ${item.isSubmenu ? 'h-3.5 w-3.5 ml-1' : 'h-4 w-4'}`} />
        <span>{item.label}</span>
      </button>
    );
  };

  if (loadingYears || loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Verifying Setup...</p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = !profile?.subscription_expiry || new Date(profile.subscription_expiry.split(' ')[0].replace(/-/g, '/')).setHours(0, 0, 0, 0) < today.getTime();

  if (isExpired) {
    return <SubscriptionExpiredScreen profile={profile} />;
  }

  const hasYear = academicYears.length > 0;
  const remainingDays = getRemainingDays(profile?.subscription_expiry);

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full min-h-[calc(100vh-140px)]">

      {/* Sidebar */}
      <aside className="w-full md:w-[240px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-4 md:pr-10 pb-6 pt-2 md:sticky md:top-24 md:h-[calc(100vh-180px)]">
        <div className="overflow-y-auto scrollbar-none flex-1 min-h-0">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            {NAV_ITEMS.map(navBtn)}
          </nav>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 min-w-0">
        {remainingDays !== null && (remainingDays === 7 || remainingDays === 3 || remainingDays === 1) && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl text-sm font-semibold flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              {remainingDays === 7 && (
                <>
                  <p className="font-extrabold">Your subscription plan will expire in 7 days.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Please renew your subscription to avoid interruption.</p>
                </>
              )}
              {remainingDays === 3 && (
                <>
                  <p className="font-extrabold">Your subscription plan will expire in 3 days.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Renew your subscription before expiry.</p>
                </>
              )}
              {remainingDays === 1 && (
                <>
                  <p className="font-extrabold">Your subscription expires tomorrow.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Renew now to continue uninterrupted access.</p>
                </>
              )}
            </div>
          </div>
        )}

        {!hasYear && location.pathname !== '/school-admin/audits-settings' ? (
          <OnboardingScreen />
        ) : (
          <Routes>
            <Route index element={<DashboardPage onNavigate={(p) => nav(`/school-admin/${p}`)} />} />
            <Route path="profile" element={<ProfilePage mode="details" />} />
            <Route path="profile/change-password" element={<ProfilePage mode="password" />} />
            <Route path="profile/subscription" element={<ProfilePage mode="plans" />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="timetable" element={<TimetablePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="exams/seating-plan" element={<SeatingPlanPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audits-settings" element={<AuditsSettingsPage onYearsUpdated={() => refreshYears()} />} />
            <Route path="financial-reports" element={<FinancialReportsPage />} />
            <Route path="finance-management" element={<FinanceManagementPage />} />
            <Route path="salary-disbursement" element={<SalaryDisbursementPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="*" element={<Navigate to="/school-admin" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
