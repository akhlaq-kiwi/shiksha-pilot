import React, { useState, useEffect } from 'react';
import { 
  Building2, CreditCard, Shield, Activity, Plus, Search, 
  Trash2, Edit, Ban, UserCheck, Key, RefreshCw, Calendar, 
  AlertCircle, ArrowUpRight, ArrowDownRight, LayoutDashboard,
  Settings, UserPlus, HardDrive, CheckCircle2, ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { platformService } from '../../common/services/platformService';
import { Button } from '../../common/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../common/ui/table';
import { Input } from '../../common/ui/input';
import { Select } from '../../common/ui/select';
import { Dialog } from '../../common/ui/dialog';

export default function SuperAdminPortal() {
  const [currentPage, setCurrentPage] = useState('dashboard'); // dashboard, schools, school-detail, billing, settings
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);

  // Search & Filter state
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState('all');

  // API states
  const [schools, setSchools] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({
    schools_count: 0,
    active_schools: 0,
    suspended_schools: 0,
    billing_mrr: 1200000,
    total_users: 7260
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals state
  const [isCreateSchoolOpen, setIsCreateSchoolOpen] = useState(false);
  const [newSchool, setNewSchool] = useState({ name: '', subdomain: '', plan: 'Premium', contact_phone: '', contact_email: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch schools
      const schoolsData = await platformService.getSchools();
      setSchools(schoolsData || []);

      // Fetch stats
      try {
        const statsData = await platformService.getStats();
        if (statsData) setStats(prev => ({ ...prev, ...statsData }));
      } catch (e) {
        console.warn('Failed to load stats, using defaults', e);
      }

      // Fetch plans
      try {
        const plansData = await platformService.getPlans();
        setPlans(plansData || []);
      } catch (e) {
        console.warn('Failed to load plans', e);
      }

      // Fetch audit logs
      try {
        const logsData = await platformService.getAuditLogs();
        setAuditLogs(logsData || []);
      } catch (e) {
        console.warn('Failed to load audit logs', e);
      }

    } catch (err) {
      setError('Failed to sync data with platform API endpoints. Check backend status.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (school) => {
    const nextStatus = school.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await platformService.updateSchool(school.id, { 
        ...school,
        status: nextStatus 
      });
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, status: nextStatus } : s));
      // Re-fetch logs to update audit trails
      const logsData = await platformService.getAuditLogs();
      setAuditLogs(logsData || []);
    } catch (err) {
      alert(err.message || 'Failed to update tenant status');
    }
  };

  const handleDeleteSchool = async (id) => {
    if (!confirm('Are you sure you want to delete this school tenant? This will wipe their isolated space.')) return;
    try {
      await platformService.deleteSchool(id);
      setSchools(prev => prev.filter(s => s.id !== id));
      if (selectedSchoolId === id) {
        setSelectedSchoolId(null);
        setCurrentPage('schools');
      }
      const logsData = await platformService.getAuditLogs();
      setAuditLogs(logsData || []);
    } catch (err) {
      alert(err.message || 'Failed to delete school tenant');
    }
  };

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    if (!newSchool.name || !newSchool.subdomain) return;
    setCreating(true);
    setError('');
    try {
      await platformService.inviteSchool({
        school_name: newSchool.name,
        subdomain: newSchool.subdomain.toLowerCase(),
        contact_phone: newSchool.contact_phone || '555-0100',
        contact_email: newSchool.contact_email || 'admin@sub.school',
        plan: newSchool.plan
      });
      
      // Reload schools
      const schoolsData = await platformService.getSchools();
      setSchools(schoolsData || []);
      
      // Reload stats
      const statsData = await platformService.getStats();
      if (statsData) setStats(prev => ({ ...prev, ...statsData }));
      
      // Reload logs
      const logsData = await platformService.getAuditLogs();
      setAuditLogs(logsData || []);

      setIsCreateSchoolOpen(false);
      setNewSchool({ name: '', subdomain: '', plan: 'Premium', contact_phone: '', contact_email: '' });
      alert('School workspace successfully provisioned.');
    } catch (err) {
      setError(err.message || 'Failed to provision school tenant');
    } finally {
      setCreating(false);
    }
  };

  const filteredSchools = Array.isArray(schools) ? schools.filter(s => {
    const matchSearch = (s.name || '').toLowerCase().includes(schoolSearch.toLowerCase()) || (s.subdomain || '').toLowerCase().includes(schoolSearch.toLowerCase());
    const matchStatus = schoolStatusFilter === 'all' || (s.status || '').toLowerCase() === schoolStatusFilter.toLowerCase();
    return matchSearch && matchStatus;
  }) : [];

  // Generate color palette based on school name for visual excellence
  const getSchoolColor = (name) => {
    const colors = [
      'bg-blue-500 text-white',
      'bg-emerald-500 text-white',
      'bg-amber-500 text-white',
      'bg-indigo-500 text-white',
      'bg-teal-500 text-white',
      'bg-purple-500 text-white',
      'bg-rose-500 text-white',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  // Find currently selected school
  const currentSchool = schools.find(s => s.id === selectedSchoolId);

  // Mock data to enrich presentation to match mockup designs
  const recentSignups = schools.slice(0, 2);
  const mockAdmins = [
    { name: 'Sarah Connor', role: 'SUPER_ADMIN', email: 's.connor@sp.school', lastLogin: '12 mins ago', status: 'ACTIVE' },
    { name: 'Marcus Chen', role: 'Infrastructure Lead', email: 'm.chen@sp.school', lastLogin: '4 hours ago', status: 'ACTIVE' },
    { name: 'Sarah Jenkins', role: 'Security Officer', email: 's.jenkins@sp.school', lastLogin: 'Yesterday', status: 'Away' }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8 w-full min-h-[calc(100vh-140px)]">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-[240px] flex-shrink-0 flex flex-col justify-between border-r border-border pr-6 py-2 space-y-6">
        <div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-4 px-3">Management</p>
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
            <button 
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${currentPage === 'dashboard' ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setCurrentPage('schools')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${currentPage === 'schools' || currentPage === 'school-detail' ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
            >
              <Building2 className="h-4 w-4" />
              <span>Schools</span>
            </button>
            <button 
              onClick={() => setCurrentPage('billing')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${currentPage === 'billing' ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Billing</span>
            </button>
            <button 
              onClick={() => setCurrentPage('settings')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${currentPage === 'settings' ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900' : 'text-text-secondary hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800'}`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Health Widget */}
        <div className="hidden md:block bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-bold text-primary mb-1">Infrastructure Health</p>
          <p className="text-[11px] text-text-muted mb-3">All systems operational across 12 clusters.</p>
          <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>99.98% Uptime</span>
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <div className="flex-1 min-w-0">
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. DASHBOARD PAGE */}
        {/* ========================================================================= */}
        {currentPage === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Super Admin Overview</h2>
                <p className="text-text-secondary text-sm mt-1 max-w-2xl">Monitor system health, institutional growth, and platform-wide revenue metrics.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-green-500/5 border border-green-500/10 rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-xs text-green-600 font-bold">Systems Normal</span>
                </div>
              </div>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Building2 className="h-5 w-5" /></div>
                    <span className="text-green-600 text-xs font-bold bg-green-500/10 px-2 py-0.5 rounded-full">+{schools.length} total</span>
                  </div>
                  <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Total Schools</p>
                  <p className="text-3xl font-black text-text-primary mt-1 font-display">{schools.length || stats.schools_count}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-teal-500/10 rounded-xl text-teal-600"><CreditCard className="h-5 w-5" /></div>
                    <span className="text-green-600 text-xs font-bold bg-green-500/10 px-2 py-0.5 rounded-full">Normal cycle</span>
                  </div>
                  <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Monthly Revenue</p>
                  <p className="text-3xl font-black text-text-primary mt-1 font-display">₹{(stats.billing_mrr).toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600"><Activity className="h-5 w-5" /></div>
                    <span className="text-blue-600 text-xs font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">Active isolation</span>
                  </div>
                  <p className="text-text-muted text-xs uppercase tracking-wider font-semibold">Simulated Users</p>
                  <p className="text-3xl font-black text-text-primary mt-1 font-display">{(stats.total_users).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Subscriptions Chart and Signups */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Chart */}
              <div className="lg:col-span-8 bg-surface border border-border rounded-2xl p-6 sm:p-8">
                <h3 className="text-base font-bold text-text-primary mb-6">Active Subscriptions Growth</h3>
                <div className="h-64 relative flex items-end justify-between px-2 sm:px-6 border-b border-border pb-2">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
                    <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
                    <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
                    <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
                    <div className="border-b border-zinc-100 dark:border-zinc-800/40 w-full"></div>
                  </div>
                  {/* Chart bars */}
                  {[45, 60, 55, 78, 92, 100].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer z-10">
                      <div 
                        className="w-8 sm:w-12 bg-primary/10 border-t-2 border-primary rounded-t group-hover:bg-primary/20 transition-all"
                        style={{ height: `${h * 1.8}px` }}
                      ></div>
                      <span className="mt-2 text-xs text-text-muted font-medium">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Signups */}
              <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary mb-4">Recent Sign-ups</h3>
                  <div className="space-y-3">
                    {recentSignups.length === 0 ? (
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-xl text-center text-xs text-text-muted font-medium">
                        No provisions registered yet.
                      </div>
                    ) : (
                      recentSignups.map(school => (
                        <div 
                          key={school.id} 
                          onClick={() => {
                            setSelectedSchoolId(school.id);
                            setCurrentPage('school-detail');
                          }}
                          className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer shadow-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${getSchoolColor(school.name)}`}>
                              {school.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-primary">{school.name}</p>
                              <p className="text-xs text-text-secondary">{school.plan} • Active</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-text-muted" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <Button 
                  onClick={() => setCurrentPage('schools')} 
                  variant="outline" 
                  className="w-full justify-center text-xs font-bold py-2.5"
                >
                  View All Institutions
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. SCHOOLS LIST PAGE */}
        {/* ========================================================================= */}
        {currentPage === 'schools' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Institutions Management</h2>
                <p className="text-text-secondary text-sm mt-1">Manage and monitor schools across the multi-tenant core.</p>
              </div>
              <Button className="flex items-center gap-2 justify-center" onClick={() => setIsCreateSchoolOpen(true)}>
                <Plus className="h-4 w-4" /> Provision Tenant
              </Button>
            </div>

            {/* Filters Bar */}
            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
                <Input 
                  placeholder="Search schools by name or subdomain..." 
                  className="pl-9"
                  value={schoolSearch}
                  onChange={e => setSchoolSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap w-full md:w-auto scrollbar-none pb-1 md:pb-0">
                {['all', 'active', 'suspended'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setSchoolStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${schoolStatusFilter === filter ? 'bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50' : 'bg-transparent text-text-secondary border-border hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Schools Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSchools.length === 0 ? (
                <div className="col-span-full py-12 text-center text-text-muted text-sm border-2 border-dashed border-border rounded-2xl">
                  No school tenants match your filters.
                </div>
              ) : (
                filteredSchools.map(school => (
                  <div 
                    key={school.id}
                    onClick={() => {
                      setSelectedSchoolId(school.id);
                      setCurrentPage('school-detail');
                    }}
                    className="bg-surface border border-border rounded-xl p-5 hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group cursor-pointer flex flex-col justify-between h-44 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${getSchoolColor(school.name)}`}>
                        {school.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${school.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${school.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {school.status}
                      </span>
                    </div>
                    <div className="mt-4">
                      <h3 className="font-bold text-base text-text-primary group-hover:text-primary transition-colors">{school.name}</h3>
                      <p className="text-text-muted text-xs font-semibold">{school.subdomain}.saas.school</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-text-secondary">
                      <span>{school.plan} Plan</span>
                      <ChevronRight className="h-4 w-4 text-text-muted group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))
              )}

              {/* Add New Tenant Dash Card */}
              <div 
                onClick={() => setIsCreateSchoolOpen(true)}
                className="border-2 border-dashed border-border hover:border-zinc-400 dark:hover:border-zinc-600 rounded-xl flex flex-col items-center justify-center p-6 text-center hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer group h-44"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Plus className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <h3 className="font-bold text-sm text-text-primary">Add New School</h3>
                <p className="text-xs text-text-secondary mt-0.5">Provision a new isolated tenant.</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. SCHOOL DETAIL PAGE */}
        {/* ========================================================================= */}
        {currentPage === 'school-detail' && currentSchool && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-text-muted font-bold">
              <button onClick={() => setCurrentPage('schools')} className="hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Schools
              </button>
              <ChevronRight className="h-3 w-3" />
              <span className="text-text-primary font-semibold">{currentSchool.name}</span>
            </nav>

            {/* Detail Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
              <div className="flex items-center gap-5">
                <div className={`h-16 w-16 rounded-xl flex items-center justify-center font-bold text-xl ${getSchoolColor(currentSchool.name)}`}>
                  {currentSchool.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black text-text-primary tracking-tight font-display">{currentSchool.name}</h1>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${currentSchool.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {currentSchool.status}
                    </span>
                  </div>
                  <p className="text-primary text-xs font-bold mt-1 flex items-center gap-1">
                    {currentSchool.subdomain}.saas.school
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => handleToggleStatus(currentSchool)} 
                  variant="outline" 
                  className="text-xs font-bold flex items-center gap-1.5"
                >
                  {currentSchool.status === 'ACTIVE' ? <Ban className="h-3.5 w-3.5 text-orange-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-600" />}
                  <span>{currentSchool.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}</span>
                </Button>
                <Button 
                  onClick={() => handleDeleteSchool(currentSchool.id)}
                  variant="ghost" 
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Tenant</span>
                </Button>
              </div>
            </div>

            {/* Detail Layout */}
            <div className="grid grid-cols-12 gap-8">
              {/* Left Side Details */}
              <div className="col-span-12 lg:col-span-7 space-y-6">
                <Card>
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-bold text-text-primary">School Profile Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Tenant Workspace ID</p>
                      <p className="text-sm font-bold text-text-primary mt-1">T-992-GWA-2026-{currentSchool.id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Deployment Region</p>
                      <p className="text-sm font-bold text-text-primary mt-1">North America East</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Primary Admin Email</p>
                      <p className="text-sm font-bold text-text-primary mt-1">{currentSchool.contact_email || 'admin@sub.school'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Phone</p>
                      <p className="text-sm font-bold text-text-primary mt-1">{currentSchool.contact_phone || '555-0100'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-sm text-text-primary mb-4">Branding & Assets</h3>
                    <div className="flex gap-6 items-center flex-wrap">
                      <div className="h-12 w-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-zinc-50 dark:text-zinc-900 font-bold">
                        {currentSchool.name.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Primary Theme Color</p>
                        <p className="text-sm font-bold text-text-primary mt-0.5">#18181b (Default Zinc)</p>
                      </div>
                      <button className="text-xs text-primary font-bold hover:underline">Update Portal Theme</button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Side Details */}
              <div className="col-span-12 lg:col-span-5 space-y-6">
                <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-900 dark:text-zinc-50 rounded-2xl p-6 shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-zinc-800/30 blur-xl"></div>
                  <div className="relative z-10">
                    <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-1">Current Plan</p>
                    <h2 className="text-2xl font-black mb-6 font-display">{currentSchool.plan} Plan</h2>
                    <div className="space-y-3 mb-6 border-b border-zinc-800 pb-4">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-zinc-400">Next Billing Date</span>
                        <span>2026-07-25</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-zinc-400">Monthly Cost</span>
                        <span>
                          {currentSchool.plan === 'Standard' ? '₹7,999.00' : currentSchool.plan === 'Enterprise' ? '₹39,999.00' : '₹19,999.00'}
                        </span>
                      </div>
                    </div>
                    {/* Simulated student limit progress */}
                    <div className="space-y-1.5 mb-6">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-zinc-400">Active Students</span>
                        <span>1,250 / {currentSchool.plan === 'Standard' ? '1,500' : currentSchool.plan === 'Enterprise' ? 'Unlimited' : '5,000'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-100 rounded-full" style={{ width: '35%' }}></div>
                      </div>
                    </div>
                    <Button className="w-full bg-zinc-50 text-zinc-900 hover:bg-zinc-200 border-none font-bold py-2.5 text-xs">Manage Subscription</Button>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-bold text-sm text-text-primary mb-4">Infrastructure Status</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-text-secondary">Database Health</span>
                          <span className="text-green-600">99.98%</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: '99%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1.5">
                          <span className="text-text-secondary">Isolated Storage</span>
                          <span className="text-primary">1.2 TB / 2.0 TB</span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: '60%' }}></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. BILLING PAGE */}
        {/* ========================================================================= */}
        {currentPage === 'billing' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Revenue & Subscriptions</h2>
              <p className="text-text-secondary text-sm mt-1">Global billing history and institution tier management.</p>
            </div>

            {/* ARR Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Total ARR Estimate</p>
                  <p className="text-2xl font-black text-primary mt-1 font-display">₹{(stats.billing_mrr * 12).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Active Invoices</p>
                  <p className="text-2xl font-black text-text-primary mt-1 font-display">{schools.filter(s=>s.status==='ACTIVE').length}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Avg Ticket Size</p>
                  <p className="text-2xl font-black text-text-primary mt-1 font-display">₹19,999</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Churn Rate</p>
                  <p className="text-2xl font-black text-green-600 mt-1 font-display">1.8%</p>
                </CardContent>
              </Card>
            </div>

            {/* Pricing Tiers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Standard', price: 7999, desc: 'Includes standard gradebooks and audit logs up to 1,500 students.', popular: false },
                { name: 'Premium', price: 19999, desc: 'Includes dynamic timetables, color themes, and multi-branch configurations.', popular: true },
                { name: 'Enterprise', price: 39999, desc: 'Unlimited students, custom domain matching, and dedicated audit log exports.', popular: false },
              ].map(tier => (
                <div 
                  key={tier.name}
                  className={`p-6 sm:p-8 rounded-2xl border flex flex-col justify-between bg-surface relative shadow-xs ${tier.popular ? 'border-zinc-900 border-2 dark:border-zinc-50' : 'border-border'}`}
                >
                  {tier.popular && (
                    <span className="absolute top-3 right-3 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[9px] font-bold py-0.5 px-2 rounded uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{tier.name} Plan</h3>
                    <p className="text-xs text-text-secondary mt-2">{tier.desc}</p>
                    <div className="my-6 flex items-baseline gap-0.5">
                      <span className="text-3xl font-black text-text-primary">₹{tier.price.toLocaleString()}</span>
                      <span className="text-xs text-text-muted">/month</span>
                    </div>
                  </div>
                  <Button variant={tier.popular ? 'default' : 'outline'} className="w-full py-2.5 text-xs font-bold justify-center">
                    Configure Plan
                  </Button>
                </div>
              ))}
            </div>

            {/* Invoices List */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Tenant Invoices & Billing States</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School Tenant</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount Due</TableHead>
                    <TableHead>Billing State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-text-muted">
                        No billing data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    schools.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-bold text-text-primary py-3.5">{s.name}</TableCell>
                        <TableCell>{s.plan}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-text-primary">
                          {s.plan === 'Standard' ? '₹7,999.00' : s.plan === 'Enterprise' ? '₹39,999.00' : '₹19,999.00'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                            {s.status === 'ACTIVE' ? 'Paid / Active' : 'SUSPENDED'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. SETTINGS PAGE */}
        {/* ========================================================================= */}
        {currentPage === 'settings' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">System Settings</h2>
                <p className="text-text-secondary text-sm mt-1">Manage platform administrators and global security parameters.</p>
              </div>
              <Button className="flex items-center gap-2 justify-center">
                <UserPlus className="h-4 w-4" /> Add Administrator
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Admins Table */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="overflow-hidden">
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold text-text-primary">Administrator Directory</CardTitle>
                    <span className="text-[10px] font-black text-green-600 flex items-center gap-1 uppercase bg-green-500/10 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> Active Session
                    </span>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Administrator</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockAdmins.map(admin => (
                        <TableRow key={admin.name}>
                          <TableCell className="py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 font-bold text-xs flex items-center justify-center">
                                {admin.name.split(' ').map(n=>n[0]).join('')}
                              </div>
                              <div>
                                <p className="font-bold text-text-primary">{admin.name}</p>
                                <p className="text-[10px] text-text-muted font-semibold">{admin.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-text-secondary">{admin.role}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${admin.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                              {admin.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Security Audit widget */}
              <div className="lg:col-span-4 space-y-6">
                <Card>
                  <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-bold text-text-primary">System Config</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                      <span className="font-semibold text-text-secondary">Platform Version</span>
                      <span className="font-mono font-bold text-text-primary">v2.1.0-RC1</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                      <span className="font-semibold text-text-secondary">Node Environment</span>
                      <span className="font-mono font-bold text-text-primary">production</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="font-semibold text-text-secondary">Database Host</span>
                      <span className="font-mono font-bold text-teal-600">sp-db:3306</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Audit Logs */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Isolated Event Triggers & Audit Trails</CardTitle>
                <CardDescription className="text-xs text-text-secondary">Immutable logs tracking provision events and tenant administrative actions.</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action Event</TableHead>
                    <TableHead>Scope Details</TableHead>
                    <TableHead>Actor User</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-text-muted">
                        No system log records returned.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-bold text-text-primary py-3.5 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                          {log.action}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.target_school || 'SaaS Core'}</TableCell>
                        <TableCell className="text-xs">{log.user || 'SaaS System'}</TableCell>
                        <TableCell className="font-mono text-xs text-text-muted">{log.created_at || log.date}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600">
                            Success
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

      </div>

      {/* Provision School Modal Dialog */}
      <Dialog 
        isOpen={isCreateSchoolOpen} 
        onClose={() => setIsCreateSchoolOpen(false)}
        title="Provision School Tenant Workspace"
        description="Creates an isolated school tenant datastore space."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateSchoolOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSchool} disabled={creating}>
              {creating ? 'Provisioning...' : 'Provision School'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSchool} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Tenant Name</label>
            <Input 
              placeholder="e.g. Cambridge Academy"
              value={newSchool.name}
              onChange={e => setNewSchool(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Subdomain Prefix</label>
            <div className="flex items-center space-x-1.5">
              <Input 
                placeholder="subdomain"
                value={newSchool.subdomain}
                onChange={e => setNewSchool(prev => ({ ...prev, subdomain: e.target.value }))}
                required
                className="flex-1"
              />
              <span className="text-sm font-semibold text-text-muted">.saas.school</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Subscription Plan</label>
              <Select 
                value={newSchool.plan}
                onChange={e => setNewSchool(prev => ({ ...prev, plan: e.target.value }))}
              >
                <option value="Standard">Standard (₹7,999/m)</option>
                <option value="Premium">Premium (₹19,999/m)</option>
                <option value="Enterprise">Enterprise (₹39,999/m)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
              <Input 
                placeholder="e.g. 555-0100"
                value={newSchool.contact_phone}
                onChange={e => setNewSchool(prev => ({ ...prev, contact_phone: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
