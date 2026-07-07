import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, Settings, AlertCircle } from 'lucide-react';
import { platformService } from '../../common/services/platformService';
import { useToast } from '../../common/components/Toast';
import { useConfirm } from '../../common/components/ConfirmDialog';
import DashboardPage from './pages/DashboardPage';
import SchoolsPage from './pages/SchoolsPage';
import SchoolDetailPage from './pages/SchoolDetailPage';
import PlansPage from './pages/PlansPage';
import SchoolTeachersPage from './pages/SchoolTeachersPage';
import SchoolStudentsPage from './pages/SchoolStudentsPage';
import SchoolHistoryPage from './pages/SchoolHistoryPage';
import CreateSchoolDialog from './components/CreateSchoolDialog';

const NAV = [
  { path: '/super-admin',          label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/super-admin/schools',  label: 'Manage Schools',   icon: Building2 },
  { path: '/super-admin/plans',    label: 'Manage Plans',   icon: CreditCard },
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
  const [isCreateSchoolOpen, setIsCreateSchoolOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setError('');
    try {
      const schoolsData = await platformService.getSchools();
      setSchools(schoolsData || []);
      try { const d = await platformService.getStats();   if (d) setStats(p => ({ ...p, ...d })); } catch {}
      try { const d = await platformService.getPlans();   setPlans(d || []); } catch {}
      try { const d = await platformService.getAuditLogs(); setAuditLogs(d || []); } catch {}
    } catch (err) {
      setError('Failed to sync data. Check backend status.');
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
    } catch {}
    try { const d = await platformService.getStats();     if (d) setStats(p => ({ ...p, ...d })); } catch {}
    try { const d = await platformService.getAuditLogs(); setAuditLogs(d || []); } catch {}
  };

  const handleCreateSchool = async (newSchool, onSuccess) => {
    if (!newSchool.name) return;
    setCreating(true);
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
      setError(err.message || 'Failed to create school');
      toast.error(err.message || 'Failed to create school', 'Error');
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
    <div className="flex flex-col md:flex-row gap-8 w-full min-h-[calc(100vh-140px)]">

      {/* Sidebar */}
      <aside className="w-full md:w-[240px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-6 py-2 space-y-6 md:sticky md:top-24 md:h-[calc(100vh-180px)] md:overflow-y-auto scrollbar-none">
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-4 px-3">Management</p>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            {NAV.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path, item.exact);
              return (
                <button
                  key={item.path}
                  onClick={() => nav(item.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${active ? 'bg-primary text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Routes>
          <Route index element={
            <DashboardPage schools={schools} stats={stats} />
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
          <Route path="*" element={<Navigate to="/super-admin" replace />} />
        </Routes>
      </div>

      <CreateSchoolDialog
        isOpen={isCreateSchoolOpen}
        onClose={() => setIsCreateSchoolOpen(false)}
        onSubmit={handleCreateSchool}
        creating={creating}
      />
    </div>
  );
}
