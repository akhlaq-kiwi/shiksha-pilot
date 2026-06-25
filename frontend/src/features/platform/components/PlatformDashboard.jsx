import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Building, 
  CreditCard, 
  User, 
  Sun, 
  Moon, 
  Plus, 
  X, 
  Eye, 
  MoreVertical, 
  Trash2, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

const MOCK_SCHOOLS = [
  { id: 1, name: "St. Xavier's International School", code: "SCH-981763", contact_person: "Fr. Thomas Matthews", contact_number: "+1 (555) 019-8833", email: "xavier.admin@xavier.edu", status: "Active", subscription_start: "2026-04-01", subscription_end: "2027-03-31", setup_completed: 1, days_remaining: 305, address: "123 School Lane, Lucknow, Uttar Pradesh, India", logo_path: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%234f46e5'/><path d='M50 25 L80 40 L50 55 L20 40 Z' fill='%23ffffff'/><path d='M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5' fill='%23ffffff' opacity='0.9'/><path d='M72 43 L72 65 L75 65 L75 43 Z' fill='%23f59e0b'/><circle cx='73.5' cy='67' r='3' fill='%23f59e0b'/></svg>" },
  { id: 2, name: "Lincoln Technical College", code: "SCH-098716", contact_person: "Dr. Elizabeth Vance", contact_number: "+1 (555) 021-3311", email: "lincoln.tech@lincoln.edu", status: "Active", subscription_start: "2026-05-01", subscription_end: "2026-06-30", setup_completed: 1, days_remaining: 31, address: "456 Tech Parkway, City College, India", logo_path: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%238b5cf6'/><path d='M50 25 L80 40 L50 55 L20 40 Z' fill='%23ffffff'/><path d='M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5' fill='%23ffffff' opacity='0.9'/><path d='M72 43 L72 65 L75 65 L75 43 Z' fill='%23f59e0b'/><circle cx='73.5' cy='67' r='3' fill='%23f59e0b'/></svg>" }
];

const MOCK_SUPER_STATS = {
  total_schools: 2,
  active_schools: 2,
  inactive_schools: 0,
  total_students: 450,
  total_teachers: 35,
  total_revenue: 12450.00,
  recent_schools: [
    { name: "Lincoln Technical College", email: "lincoln.tech@lincoln.edu", status: "Active", created_at: "2026-05-01 10:00:00" },
    { name: "St. Xavier's International School", email: "xavier.admin@xavier.edu", status: "Active", created_at: "2026-04-01 09:00:00" }
  ]
};

export default function PlatformDashboard({
  token,
  adminProfile,
  isDarkMode,
  setIsDarkMode,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [superStats, setSuperStats] = useState(MOCK_SUPER_STATS);
  const [schools, setSchools] = useState(MOCK_SCHOOLS);
  const [superPlans, setSuperPlans] = useState([]);
  const [superSubscriptions, setSuperSubscriptions] = useState([]);
  const [superAuditLogs, setSuperAuditLogs] = useState([]);
  
  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(null);
  const [showEditSchoolModal, setShowEditSchoolModal] = useState(null);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(null);
  const [showManualSubModal, setShowManualSubModal] = useState(null);
  const [showSchoolDetailsModal, setShowSchoolDetailsModal] = useState(null);
  
  // Menu dropdowns
  const [activeSchoolMenuId, setActiveSchoolMenuId] = useState(null);
  
  // Form states
  const [inviteForm, setInviteForm] = useState({ email: '', plan_id: '' });
  const [extendMonths, setExtendMonths] = useState('12');
  const [editSchoolForm, setEditSchoolForm] = useState({
    name: '',
    contact_person: '',
    contact_number: '',
    subscription_end: '',
    status: 'Active'
  });
  const [planForm, setPlanForm] = useState({
    name: '',
    duration_days: '',
    price: '',
    is_active: 1,
    description: ''
  });
  const [manualSubForm, setManualSubForm] = useState({
    plan_id: '',
    action_type: 'Activate'
  });

  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [loading, setLoading] = useState(false);

  const getHeaders = (t) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${t || token}`
  });

  const fetchSuperAdminData = async (showLoader = false) => {
    if (!token) return;
    if (showLoader) setLoading(true);
    try {
      const headers = getHeaders();
      const statsRes = await fetch('/api/platform/stats', { headers });
      if (statsRes.ok) setSuperStats(await statsRes.json());
      
      const schoolRes = await fetch('/api/platform/schools', { headers });
      if (schoolRes.ok) setSchools(await schoolRes.json());
      
      const plansRes = await fetch('/api/platform/plans', { headers });
      if (plansRes.ok) setSuperPlans(await plansRes.json());
      
      const subsRes = await fetch('/api/platform/subscriptions', { headers });
      if (subsRes.ok) setSuperSubscriptions(await subsRes.json());
      
      const logsRes = await fetch('/api/platform/subscription/audit-logs', { headers });
      if (logsRes.ok) setSuperAuditLogs(await logsRes.json());
    } catch (err) {
      console.warn("Backend offline or connection issue. Utilizing mock fallbacks.");
      loadMockData();
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const loadMockData = () => {
    const savedSchools = JSON.parse(localStorage.getItem('bn_mock_schools') || '[]');
    const combinedSchools = [...savedSchools, ...MOCK_SCHOOLS];
    const updatedSchools = combinedSchools.map(s => {
      const end = new Date(s.subscription_end);
      const today = new Date();
      const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      return {
        ...s,
        days_remaining: diff > 0 ? diff : 0,
        status: diff <= 0 ? 'Inactive' : s.status
      };
    });
    setSchools(updatedSchools);
    
    setSuperPlans([
      { id: 1, name: 'Free Trial', duration_days: 30, price: 0.00, is_active: 1, description: '30 Days Free Trial.' },
      { id: 2, name: '1 Year Plan', duration_days: 365, price: 12000.00, is_active: 1, description: '1 Year full access.' }
    ]);
  };

  useEffect(() => {
    fetchSuperAdminData(true);
  }, [token]);

  const handleInviteSchoolSubmit = async (e) => {
    e.preventDefault();
    setIsSendingInvite(true);
    try {
      const res = await fetch('/api/platform/invitations', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(inviteForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send invitation");
      alert(data.message || "Invitation sent successfully!");
      setShowInviteModal(false);
      setInviteForm({ email: '', plan_id: '' });
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleExtendSubscription = async (e) => {
    e.preventDefault();
    if (!showExtendModal) return;
    try {
      const res = await fetch(`/api/platform/schools/${showExtendModal.id}/extend`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ months: parseInt(extendMonths) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to extend subscription");
      alert(data.message || "Subscription extended successfully!");
      setShowExtendModal(null);
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSchool = async (id) => {
    if (!confirm("Are you sure you want to delete this school? All associated tenant datasets will be permanently removed.")) return;
    try {
      const res = await fetch(`/api/platform/schools/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete school");
      alert(data.message || "School deleted successfully!");
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleSchoolStatus = async (school) => {
    const nextStatus = school.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`/api/platform/schools/${school.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditSchoolSubmit = async (e) => {
    e.preventDefault();
    if (!showEditSchoolModal) return;
    try {
      const res = await fetch(`/api/platform/schools/${showEditSchoolModal.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editSchoolForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update school profile");
      alert(data.message || "School profile updated successfully!");
      setShowEditSchoolModal(null);
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreatePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/platform/plans', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(planForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create plan");
      alert(data.message || "Plan created successfully!");
      setShowAddPlanModal(false);
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditPlanSubmit = async (e) => {
    e.preventDefault();
    if (!showEditPlanModal) return;
    try {
      const res = await fetch(`/api/platform/plans/${showEditPlanModal.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(planForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update plan");
      alert(data.message || "Plan updated successfully!");
      setShowEditPlanModal(null);
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePlan = async (id) => {
    if (!confirm("Are you sure you want to delete this plan? If it is currently in use, it will be deactivated instead.")) return;
    try {
      const res = await fetch(`/api/platform/plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete plan");
      alert(data.message || "Plan deleted successfully!");
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleManualSubSubmit = async (e) => {
    e.preventDefault();
    if (!showManualSubModal) return;
    try {
      const res = await fetch('/api/platform/subscriptions/activate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          school_id: showManualSubModal.school_id,
          plan_id: manualSubForm.plan_id,
          action_type: manualSubForm.action_type
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to modify subscription");
      alert(data.message || "Subscription updated successfully!");
      setShowManualSubModal(null);
      fetchSuperAdminData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewSchoolDetails = async (id) => {
    try {
      const res = await fetch(`/api/platform/schools/${id}/details`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch school details");
      const details = await res.json();
      setShowSchoolDetailsModal(details);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-placeholder" style={{ background: 'var(--color-primary)' }}>SP</div>
          <span className="sidebar-title">Shiksha Pilot</span>
        </div>

        <div className="sidebar-nav">
          <button 
            onClick={() => {
              setActiveTab('dashboard');
              window.scrollTo(0, 0);
            }} 
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <Activity size={18} /> Platform Stats
          </button>
          <button onClick={() => {
            setActiveTab('schools');
          }} className={`sidebar-item ${activeTab === 'schools' ? 'active' : ''}`}>
            <Building size={18} /> Manage Schools
          </button>
          <button onClick={() => {
            setActiveTab('subscriptions');
          }} className={`sidebar-item ${activeTab === 'subscriptions' ? 'active' : ''}`}>
            <CreditCard size={18} /> Manage Subscription
          </button>
        </div>

        <div className="sidebar-profile">
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {adminProfile?.name || 'Bilal Ahmed'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Super Admin
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="header" style={{ position: 'sticky', top: 0, zIndex: 120 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Platform Control Panel</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)' }} />
            <button onClick={onLogout} className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              Sign Out
            </button>
          </div>
        </header>

        <div className="content-body" style={{ padding: '24px' }}>
          {/* TAB 1: Platform Stats */}
          {activeTab === 'dashboard' && superStats && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="stats-grid">
                <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Schools Onboarded</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{superStats.total_schools}</div>
                  <span className="badge badge-primary" style={{ marginTop: '8px' }}>Active Tenants: {superStats.active_schools}</span>
                </div>
                <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Deactivated Schools</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#ef4444' }}>{superStats.inactive_schools}</div>
                  <span className="badge badge-danger" style={{ marginTop: '8px' }}>Action Required</span>
                </div>
                <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Platform Students</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{superStats.total_students}</div>
                  <span className="badge badge-success" style={{ marginTop: '8px' }}>Average 200/School</span>
                </div>
                <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Platform Revenue</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>${superStats.total_revenue?.toLocaleString()}</div>
                  <span className="badge badge-success" style={{ marginTop: '8px' }}>Tuition Collected</span>
                </div>
              </div>

              <div className="sp-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Recently Registered Schools</h3>
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>School Name</th>
                        <th>Admin Email</th>
                        <th>Status</th>
                        <th>Onboard Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superStats.recent_schools && superStats.recent_schools.map((school, i) => (
                        <tr key={i}>
                          <td 
                            onClick={() => handleViewSchoolDetails(school.id || 1)}
                            style={{ fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}
                          >
                            {school.name}
                          </td>
                          <td>{school.email}</td>
                          <td>
                            <span className="badge badge-success">
                              {school.status}
                            </span>
                          </td>
                          <td>{school.created_at}</td>
                          <td>
                            <button 
                              onClick={() => handleViewSchoolDetails(school.id || 1)}
                              className="btn-outline" 
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Manage Schools */}
          {activeTab === 'schools' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.15rem' }}>Schools Registry & Subscription Management</h3>
                <button onClick={() => setShowInviteModal(true)} className="btn-primary">
                  <Plus size={16} /> Onboard New School
                </button>
              </div>

              <div className="sp-card">
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>School Name</th>
                        <th>Subscription Expiry</th>
                        <th>Days Left</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schools.map(school => (
                        <tr key={school.id}>
                          <td>
                            <div 
                              onClick={() => handleViewSchoolDetails(school.id)}
                              style={{ fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}
                            >
                              {school.name}
                            </div>
                          </td>
                          <td>{school.subscription_end || '-'}</td>
                          <td>
                            <span className={`badge ${school.days_remaining > 15 ? 'badge-success' : 'badge-danger'}`}>
                              {school.days_remaining} Days
                            </span>
                          </td>
                          <td>
                            <button 
                              onClick={() => handleToggleSchoolStatus(school)}
                              className={`badge ${school.status === 'Active' ? 'badge-success' : 'badge-danger'}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              {school.status}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => handleViewSchoolDetails(school.id)}
                                className="btn-outline"
                                style={{ padding: '4px 8px' }}
                              >
                                View
                              </button>
                              <button 
                                onClick={() => {
                                  setEditSchoolForm({
                                    name: school.name,
                                    contact_person: school.contact_person,
                                    contact_number: school.contact_number,
                                    subscription_end: school.subscription_end,
                                    status: school.status
                                  });
                                  setShowEditSchoolModal(school);
                                }}
                                className="btn-outline"
                                style={{ padding: '4px 8px' }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => {
                                  setExtendMonths('12');
                                  setShowExtendModal(school);
                                }}
                                className="btn-outline"
                                style={{ padding: '4px 8px' }}
                              >
                                Extend
                              </button>
                              <button 
                                onClick={() => handleDeleteSchool(school.id)}
                                className="btn-outline"
                                style={{ padding: '4px 8px', color: '#ef4444', borderColor: '#fca5a5' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Manage Subscriptions */}
          {activeTab === 'subscriptions' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Subscription Management</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Manage pricing plans and current school subscription logs.</p>
                </div>
                <button 
                  onClick={() => {
                    setPlanForm({ name: '', duration_days: '', price: '', is_active: 1, description: '' });
                    setShowAddPlanModal(true);
                  }} 
                  className="btn-primary"
                >
                  <Plus size={16} /> Create Plan
                </button>
              </div>

              {/* Plans Table */}
              <div className="sp-card">
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>Subscription Plan Configurations</h4>
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Duration</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superPlans.map(plan => (
                        <tr key={plan.id}>
                          <td style={{ fontWeight: 600 }}>{plan.name}</td>
                          <td>{plan.duration_days} Days</td>
                          <td>₹{plan.price}</td>
                          <td>
                            <span className={`badge ${plan.is_active ? 'badge-primary' : 'badge-danger'}`}>
                              {plan.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => {
                                  setPlanForm({
                                    name: plan.name,
                                    duration_days: plan.duration_days,
                                    price: plan.price,
                                    is_active: plan.is_active,
                                    description: plan.description
                                  });
                                  setShowEditPlanModal(plan);
                                }}
                                className="btn-outline"
                                style={{ padding: '4px 8px' }}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeletePlan(plan.id)}
                                className="btn-outline"
                                style={{ padding: '4px 8px', color: '#ef4444', borderColor: '#fca5a5' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subscriptions Directory */}
              <div className="sp-card">
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>School Tenant Subscription Directory</h4>
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>School Name</th>
                        <th>Registered Email</th>
                        <th>Current Plan</th>
                        <th>Expiration</th>
                        <th>Days Left</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {superSubscriptions.map(sub => (
                        <tr key={sub.school_id}>
                          <td style={{ fontWeight: 600 }}>{sub.school_name}</td>
                          <td>{sub.school_email}</td>
                          <td>{sub.plan_name || 'No Plan'}</td>
                          <td>{sub.expiry_date}</td>
                          <td>{sub.remaining_days} Days</td>
                          <td>
                            <span className={`badge ${sub.status?.includes('Active') ? 'badge-success' : 'badge-danger'}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td>
                            <button 
                              onClick={() => {
                                setManualSubForm({ plan_id: sub.plan_id || '', action_type: 'Activate' });
                                setShowManualSubModal(sub);
                              }}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite School Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Onboard New School</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleInviteSchoolSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Admin Email Address</label>
                <input type="email" className="sp-input" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required placeholder="admin@school.com" />
              </div>
              <div>
                <label className="form-label">Subscription Plan</label>
                <select className="sp-input" value={inviteForm.plan_id} onChange={(e) => setInviteForm({ ...inviteForm, plan_id: e.target.value })} required>
                  <option value="" disabled>Select Plan</option>
                  {superPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value="without_plan">Without Plan (Inactive)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" disabled={isSendingInvite} style={{ justifyContent: 'center' }}>
                {isSendingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal */}
      {showExtendModal && (
        <div className="modal-overlay" onClick={() => setShowExtendModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Extend Subscription</h3>
              <button onClick={() => setShowExtendModal(null)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleExtendSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p>Extend license duration for <b>{showExtendModal.name}</b>.</p>
              <div>
                <label className="form-label">Duration Extension</label>
                <select value={extendMonths} onChange={(e) => setExtendMonths(e.target.value)} className="sp-input">
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months (1 Year)</option>
                  <option value="24">24 Months (2 Years)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Extend License</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit School Modal */}
      {showEditSchoolModal && (
        <div className="modal-overlay" onClick={() => setShowEditSchoolModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Edit School Profile</h3>
              <button onClick={() => setShowEditSchoolModal(null)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSchoolSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">School Name</label>
                <input type="text" className="sp-input" value={editSchoolForm.name} onChange={(e) => setEditSchoolForm({ ...editSchoolForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Contact Person</label>
                <input type="text" className="sp-input" value={editSchoolForm.contact_person} onChange={(e) => setEditSchoolForm({ ...editSchoolForm, contact_person: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Contact Number</label>
                <input type="text" className="sp-input" value={editSchoolForm.contact_number} onChange={(e) => setEditSchoolForm({ ...editSchoolForm, contact_number: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlanModal && (
        <div className="modal-overlay" onClick={() => setShowAddPlanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Create Pricing Plan</h3>
              <button onClick={() => setShowAddPlanModal(false)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Plan Name</label>
                <input type="text" className="sp-input" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required placeholder="e.g. Premium Plan" />
              </div>
              <div>
                <label className="form-label">Duration (Days)</label>
                <input type="number" className="sp-input" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })} required placeholder="e.g. 365" />
              </div>
              <div>
                <label className="form-label">Price (INR)</label>
                <input type="number" className="sp-input" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} required placeholder="e.g. 15000" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea className="sp-input" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} placeholder="Plan benefits..."></textarea>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save Plan</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditPlanModal && (
        <div className="modal-overlay" onClick={() => setShowEditPlanModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Edit Pricing Plan</h3>
              <button onClick={() => setShowEditPlanModal(null)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditPlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Plan Name</label>
                <input type="text" className="sp-input" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Duration (Days)</label>
                <input type="number" className="sp-input" value={planForm.duration_days} onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Price (INR)</label>
                <input type="number" className="sp-input" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea className="sp-input" value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}></textarea>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save Plan</button>
            </form>
          </div>
        </div>
      )}

      {/* Manage Manual Subscription Modal */}
      {showManualSubModal && (
        <div className="modal-overlay" onClick={() => setShowManualSubModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Manage School Subscription</h3>
              <button onClick={() => setShowManualSubModal(null)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleManualSubSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p>Configure manual subscription adjustments for <b>{showManualSubModal.school_name}</b>.</p>
              <div>
                <label className="form-label">Subscription Plan</label>
                <select className="sp-input" value={manualSubForm.plan_id} onChange={(e) => setManualSubForm({ ...manualSubForm, plan_id: e.target.value })} required>
                  <option value="" disabled>Select Plan</option>
                  {superPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Action Type</label>
                <select className="sp-input" value={manualSubForm.action_type} onChange={(e) => setManualSubForm({ ...manualSubForm, action_type: e.target.value })} required>
                  <option value="Activate">Activate / Renew</option>
                  <option value="Extend">Extend Duration</option>
                  <option value="Upgrade">Upgrade Plan</option>
                  <option value="Downgrade">Downgrade Plan</option>
                  <option value="Cancel">Cancel Subscription (Expire immediately)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save Configuration</button>
            </form>
          </div>
        </div>
      )}

      {/* School Details Modal */}
      {showSchoolDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowSchoolDetailsModal(null)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>School Profile Details</h3>
              <button onClick={() => setShowSchoolDetailsModal(null)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
              {/* Profile Card */}
              <div className="sp-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>School Name</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{showSchoolDetailsModal.school?.name}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unique Tenant Code</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{showSchoolDetailsModal.school?.code}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Contact Person</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{showSchoolDetailsModal.school?.contact_person || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Contact Number</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{showSchoolDetailsModal.school?.contact_number || '-'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admin Registered Email</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{showSchoolDetailsModal.school?.email}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Days Left</span>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{showSchoolDetailsModal.school?.days_remaining} Days</div>
                </div>
              </div>

              {/* Subscriptions History */}
              <div className="sp-card">
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Subscription License History</h4>
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Performed By</th>
                        <th>Pricing Plan</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showSchoolDetailsModal.subscription_history?.map((h, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{h.action}</td>
                          <td>{h.performed_by}</td>
                          <td>{h.plan_name}</td>
                          <td>{h.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tenant General Audit Logs */}
              <div className="sp-card">
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Tenant Action Audit Log Trail</h4>
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showSchoolDetailsModal.audit_logs?.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{log.action}</td>
                          <td>{log.details}</td>
                          <td>{log.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
