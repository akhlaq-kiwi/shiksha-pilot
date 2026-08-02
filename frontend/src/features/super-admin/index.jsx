import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, Settings, AlertCircle, Inbox } from 'lucide-react';
import { platformService } from '../../common/services/platformService';
import AppSidebar from '../../common/components/AppSidebar';
import { useToast } from '../../common/components/Toast';
import { useConfirm } from '../../common/components/ConfirmDialog';
import DashboardPage from './pages/DashboardPage';
import SchoolsPage from './pages/SchoolsPage';
import SchoolDetailPage from './pages/SchoolDetailPage';
import PlansPage from './pages/PlansPage';
import SchoolTeachersPage from './pages/SchoolTeachersPage';
import SchoolStudentsPage from './pages/SchoolStudentsPage';
import SchoolHistoryPage from './pages/SchoolHistoryPage';
import ReportCardTemplatesPage from './pages/ReportCardTemplatesPage';
import WebsiteLeadsPage from './pages/WebsiteLeadsPage';
import CreateSchoolDialog from './components/CreateSchoolDialog';

const NAV = [
  { path: '/super-admin',          label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/super-admin/schools',  label: 'Manage Schools',   icon: Building2 },
  { path: '/super-admin/plans',    label: 'Manage Plans',   icon: CreditCard },
  { path: '/super-admin/report-card-templates', label: 'Report Cards', icon: Settings },
  { path: '/super-admin/website-leads', label: 'Website Leads', icon: Inbox },
];

export default function SuperAdminPortal() {
  const toast    = useToast();
  const confirm  = useConfirm();
  const nav      = useNavigate();
  const location = useLocation();

  const [schools,   setSchools]   = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [plans,     setPlans]     = useState([]);
  const [stats, setStats] = useState({
    schools_count: 0, active_schools: 0, suspended_schools: 0,
    billing_mrr: 0, total_students: 0, total_teachers: 0, total_users: 0,
  });
  const [error,   setError]   = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [isCreateSchoolOpen, setIsCreateSchoolOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState({});

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setError('');
    setStatsLoading(true);
    try {
      const schoolsData = await platformService.getSchools();
      setSchools(schoolsData || []);
    } catch (err) {
      setError('Failed to sync data. Check backend status.');
      setStatsLoading(false);
      return;
    }

    // Platform stats, plans and audit logs fail independently of the schools
    // list. Previously each of these swallowed its error entirely (bare
    // `catch {}`), so a failed stats call silently left every dashboard
    // number at its zeroed default with nothing telling the admin it wasn't
    // real data - indistinguishable from "0 schools" being the actual truth.
    try {
      const d = await platformService.getStats();
      if (d) setStats(p => ({ ...p, ...d }));
    } catch (err) {
      toast.error(err?.message || 'Could not load platform statistics.', 'Stats unavailable');
    } finally {
      setStatsLoading(false);
    }
    try {
      const d = await platformService.getPlans();
      setPlans(d || []);
    } catch (err) {
      toast.error(err?.message || 'Could not load subscription plans.', 'Plans unavailable');
    }
    try {
      const d = await platformService.getAuditLogs();
      setAuditLogs(d || []);
    } catch (err) {
      toast.error(err?.message || 'Could not load audit logs.', 'Audit log unavailable');
    }
  };

  const handleToggleStatus = async (school) => {
    const suspending = school.status === 'ACTIVE';
    const nextStatus = suspending ? 'SUSPENDED' : 'ACTIVE';

    if (suspending) {
      const ok = await confirm({
        title: `Suspend ${school.name}?`,
        message: 'The school admin will lose access until the account is reactivated.',
        confirmLabel: 'Suspend',
        danger: true,
      });
      if (!ok) return;
    }

    try {
      await platformService.updateSchool(school.id, { ...school, status: nextStatus });
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, status: nextStatus } : s));
      try { const d = await platformService.getAuditLogs(); setAuditLogs(d || []); } catch {}
      toast.success(`${school.name} ${suspending ? 'suspended' : 'activated'}.`);
    } catch (err) {
      toast.error(err.message || 'Failed to update school status');
    }
  };

  const handleDeleteSchool = async (id) => {
    const school = schools.find(s => s.id === id);
    const ok = await confirm({
      title: 'Delete school?',
      message: `This will permanently delete "${school?.name}". This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await platformService.deleteSchool(id);
      setSchools(prev => prev.filter(s => s.id !== id));
      try { const d = await platformService.getAuditLogs(); setAuditLogs(d || []); } catch {}
      toast.success('School deleted.');
      nav('/super-admin/schools');
    } catch (err) {
      toast.error(err.message || 'Failed to delete school');
    }
  };

  const refreshSchools = async () => {
    try {
      const d = await platformService.getSchools();
      setSchools(d || []);
    } catch (err) {
      toast.error(err?.message || 'Could not refresh the school list.', 'Refresh failed');
    }
    try {
      const d = await platformService.getStats();
      if (d) setStats(p => ({ ...p, ...d }));
    } catch (err) {
      toast.error(err?.message || 'Could not refresh platform statistics.', 'Stats unavailable');
    }
    try {
      const d = await platformService.getAuditLogs();
      setAuditLogs(d || []);
    } catch (err) {
      toast.error(err?.message || 'Could not refresh audit logs.', 'Audit log unavailable');
    }
  };

  const handleCreateSchool = async (newSchool, onSuccess) => {
    if (!newSchool.name) return;
    setCreating(true);
    setCreateErrors({});
    setError('');
    try {
      let effectivePlan = newSchool.plan;

      await platformService.inviteSchool({
        school_name:    newSchool.name,
        contact_phone:  newSchool.contact_phone || '',
        contact_email:  newSchool.contact_email ? newSchool.contact_email.trim() : '',
        plan:           effectivePlan,
        admin_phone:    newSchool.admin_phone || '',
        admin_password: newSchool.admin_password || '',
      });
      // Close dialog and reset form immediately after successful creation
      setIsCreateSchoolOpen(false);
      if (onSuccess) onSuccess();
      toast.success('School created successfully.', 'School Created');
    } catch (err) {
      if (err.data && err.data.errors && typeof err.data.errors === 'object' && Object.keys(err.data.errors).length > 0) {
        setCreateErrors(err.data.errors);
      } else if (err.data && typeof err.data === 'object' && !err.data.errors && Object.keys(err.data).length > 0) {
        setCreateErrors(err.data);
      } else {
        setError(err.message || 'Failed to create school');
        toast.error(err.message || 'Failed to create school', 'Error');
      }
    } finally {
      setCreating(false);
      // Always re-fetch so the list reflects the current DB state,
      // even if creation partially succeeded or subsequent calls failed.
      refreshSchools();
    }
  };

  const isActive = (path, exact) => exact
    ? location.pathname === path
    : location.pathname.startsWith(path);

  return (
    <div className="flex flex-col md:flex-row w-full min-h-[calc(100vh-56px)] bg-background">

      {/* Sidebar — shared shell */}
      <AppSidebar
        groups={[{ label: 'Management', items: NAV }]}
        isActive={(item) => isActive(item.path, item.exact)}
        onNavigate={(path) => nav(path)}
        title="Platform menu"
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Routes>
          <Route index element={
            <DashboardPage schools={schools} stats={stats} loading={statsLoading} />
          } />
          <Route path="schools" element={
            <SchoolsPage
              schools={schools}
              onCreateSchool={() => setIsCreateSchoolOpen(true)}
              onToggleStatus={handleToggleStatus}
              onDeleteSchool={handleDeleteSchool}
              onSchoolUpdated={refreshSchools}
            />
          } />
          <Route path="schools/:id" element={
            <SchoolDetailPage
              schools={schools}
              onToggleStatus={handleToggleStatus}
              onDeleteSchool={handleDeleteSchool}
              onSchoolUpdated={refreshSchools}
            />
          } />
          <Route path="schools/:id/teachers" element={
            <SchoolTeachersPage />
          } />
          <Route path="schools/:id/students" element={
            <SchoolStudentsPage />
          } />
          <Route path="schools/:id/history" element={
            <SchoolHistoryPage />
          } />
          <Route path="plans" element={
            <PlansPage />
          } />
          <Route path="report-card-templates" element={
            <ReportCardTemplatesPage />
          } />
          <Route path="website-leads" element={
            <WebsiteLeadsPage />
          } />
          <Route path="*" element={<Navigate to="/super-admin" replace />} />
        </Routes>
      </div>

      <CreateSchoolDialog
        isOpen={isCreateSchoolOpen}
        onClose={() => {
          setIsCreateSchoolOpen(false);
          setCreateErrors({});
        }}
        onSubmit={handleCreateSchool}
        creating={creating}
        validationErrors={createErrors}
      />
    </div>
  );
}
