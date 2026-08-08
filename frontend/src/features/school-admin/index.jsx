import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, School, BookOpen, Users, UserCog, Clock,
  ClipboardCheck, FileText, DollarSign, BarChart2, Shield, Settings, RefreshCw, Landmark,
  AlertCircle, AlertTriangle, Copy, Phone, Mail, ExternalLink, PhoneCall, Megaphone, ShieldAlert, Trophy
} from 'lucide-react';
import { useToast } from '../../common/components/Toast';

import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AcademicPage from './pages/AcademicPage';
import ClassesPage from './pages/ClassesPage';
import StaffPage from './pages/StaffPage';
import TimetablePage from './pages/TimetablePage';
import AttendancePage from './pages/AttendancePage';
import AttendanceLeaderboardPage from './pages/AttendanceLeaderboardPage';
import ExamsPage from './pages/ExamsPage';
import SeatingPlanPage from './pages/SeatingPlanPage';
import QuestionPaperDesignerPage from './pages/QuestionPaperDesignerPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import FinancialReportsPage from './pages/FinancialReportsPage';
import FinanceManagementPage from './pages/FinanceManagementPage';
import AuditsSettingsPage from './pages/AuditsSettingsPage';
import SecurityPage from './pages/SecurityPage';
import SalaryDisbursementPage from './pages/SalaryDisbursementPage';
import FeeFollowUpPage from './pages/FeeFollowUpPage';
import LeaveRequestsPage from './pages/LeaveRequestsPage';
import CollectionHistoryPage from './pages/CollectionHistoryPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AchievementsPage from '../achievements/pages/AchievementsPage';

import { schoolService } from '../../common/services/schoolService';
import { apiClient } from '../../common/services/apiClient';
import { Card } from '../../common/ui/card';
import { Input } from '../../common/ui/input';
import { Dialog } from '../../common/ui/dialog';
import { Button } from '../../common/ui/button';

import { useAcademicYear } from '../../common/contexts/AcademicYearContext';
import AppSidebar from '../../common/components/AppSidebar';

// ─── Nav Items ────────────────────────────────────────────────────────────────

/**
 * Navigation, grouped.
 *
 * Previously this was a flat list of 15 destinations, which exceeds comfortable
 * scanning — and three of them ("Fees Portal", "Financial Reports", "Finance
 * Management") were named so similarly that a new admin had to open all three to
 * learn the difference. Four labelled groups of 2-5 replaces one list of 15.
 *
 * IMPORTANT: `permissionKey` is the value teacher permissions are stored against
 * server-side. It must keep the ORIGINAL label text even where the displayed
 * label changes, or renaming a menu item would silently revoke a teacher's
 * access to that page.
 */
const NAV_ITEMS = [
  { path: '/school-admin',                    label: 'Dashboard',         permissionKey: 'Dashboard',          icon: LayoutDashboard, exact: true },
  { path: '/school-admin/staff',              label: 'Teachers',          permissionKey: 'Teachers',           icon: UserCog },
  { path: '/school-admin/classes',            label: 'Classes',           permissionKey: 'Classes',            icon: Users },
  { path: '/school-admin/finance',            label: 'Fee collection',    permissionKey: 'Fees Portal',        icon: DollarSign },
  { path: '/school-admin/financial-reports',  label: 'Financial report',  permissionKey: 'Financial Reports',  icon: FileText },
  { path: '/school-admin/finance-management', label: 'Accounts & payroll', permissionKey: 'Finance Management', icon: Landmark },
  { path: '/school-admin/fee-follow-ups',     label: 'Fee follow-up',     permissionKey: 'Fee Follow-up',      icon: PhoneCall },
  { path: '/school-admin/timetable',          label: 'Timetable',         permissionKey: 'Timetable',          icon: Clock },
  { path: '/school-admin/attendance',         label: 'Attendance',        permissionKey: 'Attendance',         icon: ClipboardCheck },
  { path: '/school-admin/announcements',       label: 'Announcements',     permissionKey: 'Announcements',      icon: Megaphone },
  { path: '/school-admin/leave-requests',     label: 'Leave requests',    permissionKey: 'Manage Leaves',      icon: FileText },
  { path: '/school-admin/exams',              label: 'Examinations',      permissionKey: 'Examinations',       icon: FileText },
  { path: '/school-admin/achievements',       label: 'Achievements',     permissionKey: 'Achievements',       icon: Trophy },
  { path: '/school-admin/audits-settings',     label: 'Settings',          permissionKey: 'Audits & Settings',  icon: Settings },
  { path: '/school-admin/security',            label: 'Security',          permissionKey: 'Security',           icon: Shield },
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
        <h3 className="text-xl font-bold text-text-primary tracking-tight font-display">Welcome to Shiksha Pilot</h3>
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

export function ContactSuperAdminDialog({ isOpen, onClose, message, description }) {
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
      description={description !== undefined ? description : ""}
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
          {message || "Please get in touch with the ShikshaPilot Support Team using any of the contact methods below for assistance with report card template assignment, account setup, or queries."}
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
              className="flex items-center gap-1 font-bold text-[11px] py-1 px-2.5 h-7 rounded-lg"
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
              className="flex items-center gap-1 font-bold text-[11px] py-1 px-2.5 h-7 rounded-lg"
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

  const hasNoPlan = !profile?.active_plan || profile?.active_plan === 'None' || profile?.active_plan === '';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] w-full px-4 py-12 bg-zinc-50/50 dark:bg-zinc-950/20">
      <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in duration-300">
        <div className="max-w-md mx-auto space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">
            {hasNoPlan ? 'Subscription Required' : 'Subscription Expired'}
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed font-medium">
            {hasNoPlan 
              ? 'No subscription plan has been assigned to your school yet.' 
              : 'Your subscription has expired.'}
          </p>
          <p className="text-sm text-text-secondary leading-relaxed font-medium mt-1">
            Please purchase a subscription plan to continue using <span className="font-bold text-text-primary">ShikshaPilot</span>
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-6">Available Plans</h3>
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Fetching plans...</p>
            </div>
          ) : (() => {
            const availablePlans = (plans || []).filter(p => parseFloat(p.price || 0) > 0);
            if (availablePlans.length === 0) {
              return (
                <div className="py-12 border border-border bg-surface rounded-2xl text-text-muted text-sm font-semibold max-w-lg mx-auto space-y-1.5 p-6">
                  <p className="text-text-primary font-bold">No subscription plans are currently available.</p>
                  <p className="text-xs font-medium">Please contact the Super Admin for assistance.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
                {availablePlans.map(p => (
                  <Card key={p.id} className="shadow-sm border-border bg-surface flex flex-col justify-between p-6 rounded-2xl min-h-[350px] relative hover:shadow-md transition-all duration-200">
                    <div className="space-y-4">
                      <div className="border-b border-border/60 pb-4">
                        <h4 className="text-base font-bold text-text-primary font-display">{p.name}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-2xl font-bold text-text-primary tracking-tight">
                            ₹{parseFloat(p.price).toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs font-bold text-text-secondary bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg">
                            {(() => {
                              const v = parseInt(p.duration_value, 10) || 1;
                              const u = (p.duration_unit || 'month').toLowerCase();
                              if (u === 'month' || u === 'months') {
                                if (v === 12) return 'Validity 1 Year';
                                return `Validity ${v} Month${v > 1 ? 's' : ''}`;
                              }
                              if (u === 'year' || u === 'years') {
                                return `Validity ${v} Year${v > 1 ? 's' : ''}`;
                              }
                              return `Validity ${v} ${p.duration_unit}`;
                            })()}
                          </span>
                        </div>
                        <p className="text-[11px] text-primary font-bold uppercase mt-2.5 block">
                          {p.student_limit ? `Up to ${p.student_limit.toLocaleString()} Students` : 'Unlimited Students'}
                        </p>
                      </div>

                      <div className="text-xs text-text-secondary leading-relaxed font-medium whitespace-pre-line break-words">
                        {p.description || 'No plan description provided.'}
                      </div>
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
            );
          })()}
        </div>
      </div>

      <ContactSuperAdminDialog isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}

function ServerConnectionErrorScreen({ onRetry, retrying }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] w-full px-4 py-12 bg-zinc-50/50 dark:bg-zinc-950/20">
      <Card className="max-w-md w-full shadow-xl border border-border bg-surface/80 backdrop-blur-md p-8 text-center animate-in fade-in zoom-in-95 duration-200 rounded-3xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />

        <div className="relative space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center animate-pulse">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-text-primary tracking-tight font-display">
              Connection Failed
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed font-medium">
              We are unable to connect to the backend server.
            </p>
            <p className="text-xs text-text-muted leading-relaxed mt-1">
              Please make sure your backend development server is running and accessible, then try again.
            </p>
          </div>

          <div className="pt-2">
            <Button 
              onClick={onRetry} 
              disabled={retrying}
              className="w-full font-bold bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-2 py-2.5 rounded-xl shadow-md transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Connecting...' : 'Retry Connection'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Portal Root ──────────────────────────────────────────────────────────────

export default function SchoolAdminPortal() {
  const nav = useNavigate();
  const location = useLocation();

  const { academicYears, loading: loadingYears, refreshYears } = useAcademicYear();

  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_school_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // --- User Permissions Hook ---
  const [permissions, setPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [accessRemoved, setAccessRemoved] = useState(false);

  const role = localStorage.getItem('shiksha_pilot_role') || '';

  // Sidebar dynamic navigation list filtering.
  // Matches on permissionKey, not the display label — the labels are now
  // human-facing copy and must be free to change without affecting access.
  const isPermitted = (item) => {
    if (role !== 'TEACHER') return true;
    if (item.permissionKey === 'Achievements') return true;
    if (loadingPermissions || permissions === null) return false;
    return permissions.includes(item.permissionKey);
  };

  const visibleNavItems = NAV_ITEMS.filter(isPermitted);

  // URL route guard access logic
  const currentItem = NAV_ITEMS.find(item => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  });

  const hasAccess = (() => {
    if (role !== 'TEACHER') return true;
    if (currentItem && currentItem.permissionKey === 'Achievements') return true;
    if (loadingPermissions) return true;
    if (!currentItem) return true; // Profile pages, change-password are open to all logged in users
    if (permissions === null) return true;
    return permissions.includes(currentItem.permissionKey);
  })();

  // Redirect unpermitted pages immediately
  useEffect(() => {
    if (role === 'TEACHER' && !loadingPermissions && permissions && permissions.length > 0) {
      if (!hasAccess) {
        const firstPermitted = visibleNavItems[0];
        if (firstPermitted) {
          nav(firstPermitted.path, { replace: true });
        }
      }
    }
  }, [permissions, hasAccess, location.pathname, role, loadingPermissions, visibleNavItems, nav]);

  useEffect(() => {
    if (role === 'TEACHER') {
      schoolService.getMyPermissions()
        .then(data => {
          const perms = data.permissions || [];
          if (perms.length === 0) {
            localStorage.removeItem('shiksha_pilot_token');
            localStorage.removeItem('shiksha_pilot_role');
            localStorage.removeItem('shiksha_pilot_user');
            localStorage.removeItem('cached_school_profile');
            setAccessRemoved(true);
          } else {
            setPermissions(perms);
          }
        })
        .catch(err => {
          console.error("Failed to load user permissions", err);
          setPermissions([]);
        })
        .finally(() => {
          setLoadingPermissions(false);
        });
    } else {
      setPermissions(null); // SCHOOL_ADMIN has all permissions
      setLoadingPermissions(false);
    }
  }, []);

  // Lightweight polling for permission changes
  useEffect(() => {
    if (role !== 'TEACHER' || accessRemoved) return;

    const fetchPermissions = async () => {
      try {
        const data = await schoolService.getMyPermissions();
        const newPerms = data.permissions || [];
        
        if (newPerms.length === 0) {
          localStorage.removeItem('shiksha_pilot_token');
          localStorage.removeItem('shiksha_pilot_role');
          localStorage.removeItem('shiksha_pilot_user');
          localStorage.removeItem('cached_school_profile');
          setAccessRemoved(true);
          return;
        }

        setPermissions(prevPerms => {
          const prev = prevPerms || [];
          if (prev.length !== newPerms.length || !newPerms.every(p => prev.includes(p))) {
            return newPerms;
          }
          return prevPerms;
        });
      } catch (err) {
        console.error("Failed to sync teacher permissions", err);
      }
    };

    const interval = setInterval(fetchPermissions, 5000);
    return () => clearInterval(interval);
  }, [accessRemoved]);

  const loadProfile = async () => {
    try {
      const data = await schoolService.getSchoolProfile();
      setProfile(data || null);
      if (data) {
        localStorage.setItem('cached_school_profile', JSON.stringify(data));
      }
      setLoadError(false);
    } catch (err) {
      console.error("Failed to load school profile in portal index", err);
      setLoadError(true);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();

    const handleProfileUpdate = (e) => {
      if (e.detail) {
        setProfile(e.detail);
      }
    };
    window.addEventListener('school-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('school-profile-updated', handleProfileUpdate);
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await Promise.all([
        refreshYears(),
        loadProfile()
      ]);
    } catch (err) {
      console.error("Retry failed", err);
    } finally {
      setRetrying(false);
    }
  };

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

  if (loadError) {
    return <ServerConnectionErrorScreen onRetry={handleRetry} retrying={retrying} />;
  }

  if (loadingYears || loadingProfile || (role === 'TEACHER' && loadingPermissions)) {
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

  const hasYear = role === 'TEACHER' || academicYears.length > 0;
  const remainingDays = getRemainingDays(profile?.subscription_expiry);

  if (accessRemoved) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-6 animate-in fade-in duration-300">
        <Card className="max-w-md w-full shadow-2xl border border-border bg-surface p-8 text-center flex flex-col items-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 animate-bounce">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-text-primary text-xl tracking-tight font-display">
              Access Removed
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Your School Administrator has removed all your portal permissions.
            </p>
            <p className="text-xs text-text-muted leading-relaxed mt-1">
              Please contact your School Administrator if you believe this is a mistake.
            </p>
          </div>
          <Button 
            onClick={() => {
              window.location.href = '/login';
            }} 
            className="w-full font-bold bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl shadow-md transition-all duration-200"
          >
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row w-full min-h-[calc(100vh-56px)] bg-background">

      {/* Sidebar — shared across portals; groups on desktop, drawer on mobile */}
      <AppSidebar
        items={visibleNavItems}
        isActive={(item) => isActive(item.path, item.exact)}
        onNavigate={(path) => nav(path)}
        title={role === 'TEACHER' ? 'Teacher menu' : 'School admin menu'}
      />

      {/* Main Area */}
      <div className="flex-1 min-w-0 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {remainingDays !== null && (remainingDays === 7 || remainingDays === 3 || remainingDays === 1) && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-2xl text-sm font-semibold flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              {remainingDays === 7 && (
                <>
                  <p className="font-bold">Your subscription plan will expire in 7 days.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Please renew your subscription to avoid interruption.</p>
                </>
              )}
              {remainingDays === 3 && (
                <>
                  <p className="font-bold">Your subscription plan will expire in 3 days.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Renew your subscription before expiry.</p>
                </>
              )}
              {remainingDays === 1 && (
                <>
                  <p className="font-bold">Your subscription expires tomorrow.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Renew now to continue uninterrupted access.</p>
                </>
              )}
            </div>
          </div>
        )}

        {!hasAccess ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] w-full px-4 text-center animate-in fade-in duration-300">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/20 flex items-center justify-center mb-4 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-text-primary tracking-tight font-display">Access Denied</h3>
            <p className="text-xs text-text-secondary mt-3 leading-relaxed max-w-sm">
              You do not have permission to access this module.
            </p>
            <div className="mt-6">
              <Button onClick={() => nav('/school-admin')} className="font-bold py-2 px-6 shadow-sm bg-primary text-white">
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : !hasYear && location.pathname !== '/school-admin/audits-settings' ? (
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
            <Route path="leave-requests" element={<LeaveRequestsPage />} />
            <Route path="attendance/leaderboard" element={<AttendanceLeaderboardPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="exams/seating-plan" element={<SeatingPlanPage />} />
            <Route path="exams/question-paper-designer" element={<QuestionPaperDesignerPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audits-settings" element={<AuditsSettingsPage onYearsUpdated={() => refreshYears()} />} />
            <Route path="financial-reports" element={<FinancialReportsPage />} />
            <Route path="finance-management" element={<FinanceManagementPage />} />
            <Route path="salary-disbursement" element={<SalaryDisbursementPage />} />
            <Route path="fee-follow-ups" element={<FeeFollowUpPage />} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="collection-history" element={<CollectionHistoryPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="*" element={<Navigate to="/school-admin" replace />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
