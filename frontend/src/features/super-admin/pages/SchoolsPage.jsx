import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit2, Trash2, Users, GraduationCap, Clock, X, HelpCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';
import { useConfirm } from '../../../common/components/ConfirmDialog';

const getSchoolColor = (name) => {
  const colors = [
    'bg-blue-500/10 text-blue-600',
    'bg-emerald-500/10 text-emerald-600',
    'bg-amber-500/10 text-amber-600',
    'bg-indigo-500/10 text-indigo-600',
    'bg-teal-500/10 text-teal-600',
    'bg-purple-500/10 text-purple-600',
    'bg-rose-500/10 text-rose-600',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
};

const getRemainingDaysText = (expiryDateStr) => {
  if (!expiryDateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `Expires in ${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
  } else if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return `Expired ${absDays} Day${absDays !== 1 ? 's' : ''} Ago`;
  } else {
    return 'Expires Today';
  }
};

function EditSchoolDialog({ school, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(school.name || '');
  const [subdomain, setSubdomain] = useState(school.subdomain || '');
  const [contactPhone, setContactPhone] = useState(school.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(school.contact_email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    if (!contactEmail.trim()) {
      setError('Contact email address is required.');
      setSaving(false);
      return;
    }

    try {
      const updated = await platformService.updateSchool(school.id, {
        name: name.trim(),
        subdomain: subdomain.trim().toLowerCase(),
        contact_phone: contactPhone.trim(),
        contact_email: contactEmail.trim(),
      });
      onSaved(updated);
      toast.success(`School details updated successfully.`, 'Updated');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update school details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-text-primary">Edit School Details</h3>
            <p className="text-xs text-text-muted mt-0.5">Update details for {school.name}.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Subdomain prefix</label>
            <Input value={subdomain} onChange={e => setSubdomain(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
            <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Contact Email</label>
            <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubscriptionDetailsDialog({ school, onClose }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const opt = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', opt);
  };

  const remainingText = getRemainingDaysText(school.subscription_expiry);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-text-primary">Subscription Details</h3>
            <p className="text-xs text-text-muted mt-0.5">{school.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-semibold text-text-secondary">
          <div className="flex justify-between border-b border-border/40 pb-2">
            <span>Current Plan:</span>
            <span className="text-text-primary font-bold">{school.active_plan} Plan</span>
          </div>
          <div className="flex justify-between border-b border-border/40 pb-2">
            <span>Duration:</span>
            <span className="text-text-primary font-bold">
              {school.subscription_duration_value} {school.subscription_duration_unit === 'month' ? 'Month' : 'Year'}{school.subscription_duration_value > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex justify-between border-b border-border/40 pb-2">
            <span>Purchase Date:</span>
            <span className="text-text-primary font-bold">{formatDate(school.subscription_start)}</span>
          </div>
          <div className="flex justify-between border-b border-border/40 pb-2">
            <span>Expiry Date:</span>
            <span className="text-text-primary font-bold">{formatDate(school.subscription_expiry)}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span>Status:</span>
            <span className={`font-black uppercase ${remainingText.includes('Expired') ? 'text-red-500' : 'text-green-600'}`}>
              {remainingText}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={onClose} className="w-full">Close</Button>
        </div>
      </div>
    </div>
  );
}

function PlanSelectionDialog({ school, onClose, onAssigned }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const toast = useToast();

  React.useEffect(() => {
    async function loadPlans() {
      try {
        const data = await platformService.getPlans();
        const activePlans = (data || []).filter(p => p.is_active === 1);
        setPlans(activePlans);
        if (activePlans.length > 0) {
          setSelectedPlanId(activePlans[0].id);
        }
      } catch {}
      setLoading(false);
    }
    loadPlans();
  }, []);

  const handleAssign = async () => {
    const selected = plans.find(p => String(p.id) === String(selectedPlanId));
    if (!selected) return;
    
    setAssigning(true);
    try {
      const updated = await platformService.updateSchool(school.id, {
        plan: selected.name
      });
      toast.success(`Assigned ${selected.name} plan to ${school.name}.`, 'Plan Assigned');
      onAssigned(updated);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to assign plan.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-5 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold text-text-primary">Upgrade Plan</h3>
            <p className="text-xs text-text-muted mt-0.5">Select a subscription plan for {school.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading available plans…</div>
        ) : plans.length === 0 ? (
          <div className="py-12 text-center text-xs text-text-muted flex flex-col items-center gap-2">
            <HelpCircle className="h-8 w-8 text-text-muted" />
            <span>No plans configured yet. Create a plan in "Manage Plans" first.</span>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
            <div className="grid grid-cols-1 gap-3">
              {plans.map(p => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col justify-between hover:border-primary/50 relative ${String(selectedPlanId) === String(p.id) ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-surface'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-text-primary flex items-center gap-1.5">
                        {p.name}
                        {String(selectedPlanId) === String(p.id) && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      </h4>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">{p.description || 'Standard plan benefits'}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-sm text-text-primary">
                        {p.price > 0 ? `₹${Number(p.price).toLocaleString()}` : 'Free'}
                      </span>
                      <p className="text-[10px] text-text-secondary font-bold uppercase mt-0.5">
                        {p.duration_value} {p.duration_unit === 'month' ? 'Month' : 'Year'}{p.duration_value > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-text-secondary font-bold border-t border-border/40 pt-2.5">
                    <span>Student Limit: {p.student_limit ? Number(p.student_limit).toLocaleString() : 'Unlimited'}</span>
                    <span className="text-primary uppercase tracking-wider font-extrabold">{String(selectedPlanId) === String(p.id) ? 'Selected' : 'Click to select'}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex gap-3 pt-4 border-t border-border/60">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={assigning}>Cancel</Button>
              <Button className="flex-1" onClick={handleAssign} disabled={assigning || !selectedPlanId}>
                {assigning ? 'Assigning…' : 'Assign Plan'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchoolsPage({ schools, onCreateSchool, onToggleStatus, onDeleteSchool, onSchoolUpdated }) {
  const nav = useNavigate();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [menuOpenSchoolId, setMenuOpenSchoolId] = useState(null);
  const [editingSchool, setEditingSchool] = useState(null);
  const [selectedSubSchool, setSelectedSubSchool] = useState(null);
  const [upgradeSchool, setUpgradeSchool] = useState(null);

  const filtered = Array.isArray(schools) ? schools.filter(s => {
    const matchSearch = (s.name || '').toLowerCase().includes(search.toLowerCase())
      || (s.subdomain || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all'
      || (s.status === 'ACTIVE' && statusFilter === 'active')
      || (s.status !== 'ACTIVE' && statusFilter === 'suspended');
    return matchSearch && matchStatus;
  }) : [];

  const handleDelete = async (school) => {
    setMenuOpenSchoolId(null);
    if (school.status === 'ACTIVE' && school.active_plan) {
      const ok = await confirm({
        title: 'Active Subscription Warning',
        message: `"${school.name}" has an active subscription. You cannot delete an active school with subscription history. Please suspend the school first if you wish to delete it.`,
        confirmLabel: 'Understood',
        danger: true,
      });
      if (ok) {
        try {
          await onDeleteSchool(school.id);
        } catch {}
      }
    } else {
      await onDeleteSchool(school.id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Manage Schools</h2>
          <p className="text-text-secondary text-sm mt-1">Configure subscription tiers, view active staff/students, and update details.</p>
        </div>
        <Button className="flex items-center gap-2 justify-center" onClick={onCreateSchool}>
          <Plus className="h-4 w-4" /> Add School
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search by name or subdomain..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap w-full md:w-auto scrollbar-none">
          {[
            { id: 'all', label: 'All Schools' },
            { id: 'active', label: 'Active' },
            { id: 'suspended', label: 'Inactive' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${statusFilter === f.id ? 'bg-primary text-zinc-50 border-primary dark:bg-zinc-50 dark:text-zinc-900 dark:border-zinc-50 shadow-xs' : 'bg-transparent text-text-secondary border-border hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of School Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-text-muted text-sm border-2 border-dashed border-border rounded-2xl bg-surface/50">
            No schools found matching your search.
          </div>
        ) : (
          filtered.map(school => (
            <div
              key={school.id}
              className="bg-surface border border-border rounded-2xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col justify-between h-48 relative group"
            >
              
              {/* Three-Dot Dropdown aligned absolutely to avoid overflows */}
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenSchoolId(menuOpenSchoolId === school.id ? null : school.id);
                  }}
                  className="p-1.5 rounded-md text-text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>

                {/* Actions Dropdown */}
                {menuOpenSchoolId === school.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpenSchoolId(null)} />
                    <div className="absolute right-0 top-7 bg-surface border border-border shadow-xl rounded-xl w-44 py-1.5 z-20 animate-in fade-in slide-in-from-top-1 duration-100 text-xs font-semibold">
                      <button
                        onClick={() => {
                          setMenuOpenSchoolId(null);
                          setEditingSchool(school);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-primary flex items-center gap-2"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit details
                      </button>
                      <button
                        onClick={() => nav(`/super-admin/schools/${school.id}/teachers`)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-primary flex items-center gap-2"
                      >
                        <Users className="h-3.5 w-3.5" /> View Teachers
                      </button>
                      <button
                        onClick={() => nav(`/super-admin/schools/${school.id}/students`)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-primary flex items-center gap-2"
                      >
                        <GraduationCap className="h-3.5 w-3.5" /> View Students
                      </button>
                      <button
                        onClick={() => nav(`/super-admin/schools/${school.id}/history`)}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-primary flex items-center gap-2"
                      >
                        <Clock className="h-3.5 w-3.5" /> History
                      </button>
                      <div className="h-px bg-border/60 my-1.5" />
                      <button
                        onClick={() => handleDelete(school)}
                        className="w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-600 dark:hover:bg-red-950/20 flex items-center gap-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Main Card Content */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0 pr-8">
                  {school.logo_path ? (
                    <img
                      src={school.logo_path}
                      alt={school.name}
                      className="w-12 h-12 rounded-xl object-cover border border-border"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${getSchoolColor(school.name)}`}>
                      {school.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-text-primary text-base truncate pr-2">{school.name}</h3>
                    <p className="text-text-secondary text-xs truncate">{school.subdomain}.shikshapilot.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pr-6">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${school.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {school.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Bottom Section - Plan Badge Popup or Upgrade Plan Button */}
              <div className="border-t border-border/60 pt-4 mt-auto flex items-center justify-between text-xs font-semibold">
                <span className="text-text-muted">Subscription Plan</span>
                {school.active_plan ? (
                  <button
                    onClick={() => setSelectedSubSchool(school)}
                    className="bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {school.active_plan}
                  </button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-lg"
                    onClick={() => setUpgradeSchool(school)}
                  >
                    Upgrade Plan
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {editingSchool && (
        <EditSchoolDialog
          school={editingSchool}
          onClose={() => setEditingSchool(null)}
          onSaved={onSchoolUpdated}
        />
      )}

      {selectedSubSchool && (
        <SubscriptionDetailsDialog
          school={selectedSubSchool}
          onClose={() => setSelectedSubSchool(null)}
        />
      )}

      {upgradeSchool && (
        <PlanSelectionDialog
          school={upgradeSchool}
          onClose={() => setUpgradeSchool(null)}
          onAssigned={onSchoolUpdated}
        />
      )}
    </div>
  );
}
