import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Ban, UserCheck, Trash2, KeyRound, Palette, X, Eye, EyeOff, MoreVertical, Users, GraduationCap, BookOpen, ShieldCheck, Edit } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';

const PRESET_PLANS = [
  { value: 'Standard',   label: 'Standard — ₹7,999/mo' },
  { value: 'Premium',    label: 'Premium — ₹19,999/mo' },
  { value: 'Enterprise', label: 'Enterprise — ₹39,999/mo' },
  { value: 'Trial',      label: 'Trial (free for a period)' },
  { value: 'Custom',     label: 'Custom plan…' },
];

function ManageSubscriptionDialog({ school, onClose, onSaved }) {
  const toast = useToast();
  const [plan,          setPlan]          = useState(school.plan || 'Premium');
  const [trialDuration, setTrialDuration] = useState('1');
  const [trialUnit,     setTrialUnit]     = useState('month');
  const [customName,    setCustomName]    = useState('');
  const [customPrice,   setCustomPrice]   = useState('');
  const [customLimit,   setCustomLimit]   = useState('');
  const [customDesc,    setCustomDesc]    = useState('');
  const [saving,        setSaving]        = useState(false);

  const isTrial  = plan === 'Trial';
  const isCustom = plan === 'Custom';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let effectivePlan = plan;

      if (isCustom) {
        // Persist the custom plan to the plans table first
        const created = await platformService.createPlan({
          name:          customName,
          price:         parseInt(customPrice, 10) || 0,
          student_limit: customLimit || null,
          description:   customDesc || null,
          type:          'custom',
        });
        effectivePlan = created.name;
      } else if (isTrial) {
        const created = await platformService.createPlan({
          name:           `Trial (${trialDuration} ${trialUnit})`,
          price:          0,
          student_limit:  null,
          description:    `Free trial for ${trialDuration} ${trialUnit}(s).`,
          type:           'trial',
          trial_duration: parseInt(trialDuration, 10),
          trial_unit:     trialUnit,
        });
        effectivePlan = created.name;
      }

      await platformService.updateSchool(school.id, { plan: effectivePlan });
      onSaved(effectivePlan);
      toast.success(`Subscription updated to ${effectivePlan} for ${school.name}.`, 'Plan Updated');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update subscription.', 'Error');
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
            <h3 className="text-base font-bold text-text-primary">Manage Subscription</h3>
            <p className="text-xs text-text-muted mt-0.5">{school.name} — current plan: <span className="font-bold text-text-primary">{school.plan}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Pricing Plan</label>
            <Select value={plan} onChange={e => setPlan(e.target.value)}>
              {PRESET_PLANS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </div>

          {isTrial && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Trial Period</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Duration</label>
                  <Input type="number" min="1" max="24" placeholder="e.g. 3" value={trialDuration} onChange={e => setTrialDuration(e.target.value)} required />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Unit</label>
                  <Select value={trialUnit} onChange={e => setTrialUnit(e.target.value)}>
                    <option value="day">Days</option>
                    <option value="month">Months</option>
                    <option value="year">Years</option>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                School gets free access for {trialDuration} {trialUnit}(s). Convert to paid plan anytime.
              </p>
            </div>
          )}

          {isCustom && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Custom Plan Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Plan Name</label>
                  <Input placeholder="e.g. District Pro" value={customName} onChange={e => setCustomName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Monthly Price (₹)</label>
                  <Input type="number" min="0" placeholder="e.g. 14999" value={customPrice} onChange={e => setCustomPrice(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-semibold">Student Limit</label>
                  <Input type="number" min="0" placeholder="Leave blank for unlimited" value={customLimit} onChange={e => setCustomLimit(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-semibold">Description</label>
                <Input placeholder="Brief description of this plan" value={customDesc} onChange={e => setCustomDesc(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Update Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const THEME_PRESETS = [
  { id: 'default',    label: 'Default',    swatch: '#18181b' },
  { id: 'enterprise', label: 'Enterprise', swatch: '#10b981' },
  { id: 'fintech',    label: 'Fintech',    swatch: '#f59e0b' },
  { id: 'healthcare', label: 'Healthcare', swatch: '#0d9488' },
];

const getSchoolColor = (name) => {
  const colors = [
    'bg-blue-500 text-white', 'bg-emerald-500 text-white', 'bg-amber-500 text-white',
    'bg-indigo-500 text-white', 'bg-teal-500 text-white', 'bg-purple-500 text-white', 'bg-rose-500 text-white',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
};

function ChangePasswordDialog({ schoolName, onClose, onSave }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const mismatch = confirm && password !== confirm;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!mismatch && password.length >= 6) { onSave(password); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-text-primary">Change Admin Password</h3>
            <p className="text-xs text-text-muted mt-0.5">{schoolName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">New Password</label>
            <div className="relative">
              <Input type={showPw ? 'text' : 'password'} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="pr-10" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Confirm Password</label>
            <Input type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required className={mismatch ? 'border-red-400' : ''} />
            {mismatch && <p className="text-xs text-red-500 font-semibold">Passwords do not match</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={mismatch || password.length < 6}>Save</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ThemePickerDialog({ school, onClose, onSaved }) {
  const toast   = useToast();
  const [selected, setSelected] = useState(school.portal_theme || 'default');
  const [saving,   setSaving]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await platformService.updateSchool(school.id, { portal_theme: selected });
      onSaved(selected);
      toast.success(`Portal theme updated to "${selected}" for ${school.name}.`, 'Theme Saved');
      onClose();
    } catch {
      toast.error('Failed to save portal theme.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-text-primary">Portal Theme</h3>
            <p className="text-xs text-text-muted mt-0.5">Applies only to {school.name}'s portal</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => setSelected(preset.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selected === preset.id ? 'border-primary bg-primary/5' : 'border-border hover:border-zinc-400'}`}
            >
              <span className="w-6 h-6 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: preset.swatch }} />
              <span className="text-sm font-bold text-text-primary">{preset.label}</span>
              {selected === preset.id && <span className="ml-auto text-primary text-xs font-black">✓</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Apply Theme'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionsMenu({ school, onToggleStatus, onChangePassword, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownItem onClick={onChangePassword}>
        <span className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Change Admin Password
        </span>
      </DropdownItem>
      <DropdownItem 
        destructive={school.status === 'ACTIVE'}
        onClick={() => onToggleStatus(school)}
      >
        <span className="flex items-center gap-2">
          {school.status === 'ACTIVE' ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          {school.status === 'ACTIVE' ? 'Suspend School' : 'Activate School'}
        </span>
      </DropdownItem>
      <div className="my-1 border-t border-border" />
      <DropdownItem destructive onClick={onDelete}>
        <span className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> Delete School
        </span>
      </DropdownItem>
    </DropdownMenu>
  );
}


function EditSchoolDetailsDialog({ school, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(school.name || '');
  const [contactPhone, setContactPhone] = useState(school.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(school.contact_email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    const trimmedEmail = contactEmail.trim();
    if (!trimmedEmail) {
      setError('School Owner Email Address is required.');
      setSaving(false);
      return;
    }

    try {
      const updated = await platformService.updateSchool(school.id, {
        name: name.trim(),
        contact_phone: contactPhone.trim(),
        contact_email: trimmedEmail,
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
            <p className="text-xs text-text-muted mt-0.5">Update the school details and owner contact email.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
              <Input placeholder="e.g. 9900000001" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">School Owner Email *</label>
              <Input type="email" placeholder="owner@school.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required />
            </div>
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


function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-border">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black text-text-primary font-display mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function SchoolDetailPage({ schools, onToggleStatus, onDeleteSchool, onSchoolUpdated }) {
  const { id }  = useParams();
  const nav     = useNavigate();
  const toast   = useToast();
  const baseSchool = schools.find(s => s.id === Number(id));

  const [school, setSchool] = useState(baseSchool);
  useEffect(() => { setSchool(baseSchool); }, [baseSchool]);

  const [schoolStats,            setSchoolStats]            = useState(null);
  const [allPlans,               setAllPlans]               = useState([]);
  const [showPasswordDialog,     setShowPasswordDialog]     = useState(false);
  const [showThemeDialog,        setShowThemeDialog]        = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [showEditDialog,         setShowEditDialog]         = useState(false);

  const handleSchoolDetailsSaved = (updated) => {
    setSchool(updated);
    if (onSchoolUpdated) onSchoolUpdated();
  };

  useEffect(() => {
    if (!id) return;
    platformService.getSchoolStats(Number(id))
      .then(d => setSchoolStats(d))
      .catch(() => {});
    platformService.getPlans()
      .then(d => setAllPlans(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [id]);

  if (!school) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        {schools.length === 0 ? 'Loading…' : 'School not found.'}
      </div>
    );
  }

  const handlePasswordSave = (password) => {
    // TODO: call API platformService.changeSchoolAdminPassword(school.id, password)
    toast.success(`Admin password updated for ${school.name}.`, 'Password Changed');
  };

  const handleThemeSaved = (theme) => {
    setSchool(prev => ({ ...prev, portal_theme: theme }));
  };

  const handlePlanSaved = (newPlan) => {
    setSchool(prev => ({ ...prev, plan: newPlan }));
  };

  const activeThemeLabel = THEME_PRESETS.find(p => p.id === (school.portal_theme || 'default'))?.label || 'Default';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-text-muted font-bold">
        <button onClick={() => nav('/super-admin/schools')} className="hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Schools
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text-primary font-semibold">{school.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
        <div className="flex items-center gap-5">
          <div className={`h-16 w-16 rounded-xl flex items-center justify-center font-bold text-xl ${getSchoolColor(school.name)}`}>
            {school.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-text-primary tracking-tight font-display">{school.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${school.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {school.status}
              </span>
            </div>
            <p className="text-primary text-xs font-bold mt-1">{window.location.host}</p>
          </div>
        </div>

        <ActionsMenu
          school={school}
          onToggleStatus={onToggleStatus}
          onChangePassword={() => setShowPasswordDialog(true)}
          onDelete={() => onDeleteSchool(school.id)}
        />
      </div>

      {/* School Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBox icon={GraduationCap} label="Students"     value={schoolStats ? schoolStats.students.toLocaleString()     : '—'} color="bg-blue-500/10 text-blue-600" />
        <StatBox icon={BookOpen}      label="Teachers"     value={schoolStats ? schoolStats.teachers.toLocaleString()     : '—'} color="bg-emerald-500/10 text-emerald-600" />
        <StatBox icon={ShieldCheck}   label="School Admins" value={schoolStats ? schoolStats.school_admins.toLocaleString() : '—'} color="bg-violet-500/10 text-violet-600" />
        <StatBox icon={Users}         label="Total Staff"  value={schoolStats ? schoolStats.total_staff.toLocaleString()  : '—'} color="bg-amber-500/10 text-amber-600" />
      </div>

      {/* Content */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary">School Profile</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="flex items-center gap-1.5 text-xs font-bold h-8">
                <Edit className="h-3.5 w-3.5" /> Edit Profile
              </Button>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">School ID</p>
                <p className="text-sm font-bold text-text-primary mt-1">SP-{String(school.id).padStart(4, '0')}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Login URL</p>
                <p className="text-sm font-bold text-text-primary mt-1">{window.location.host}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">School Owner Email</p>
                <p className="text-sm font-bold text-text-primary mt-1">{school.contact_email || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Admin Phone</p>
                <p className="text-sm font-bold text-text-primary mt-1">{school.admin_phone || school.contact_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Phone</p>
                <p className="text-sm font-bold text-text-primary mt-1">{school.contact_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Plan</p>
                <p className="text-sm font-bold text-text-primary mt-1">{school.plan}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Registered On</p>
                <p className="text-sm font-bold text-text-primary mt-1">{school.created_at ? new Date(school.created_at).toLocaleDateString() : '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold text-sm text-text-primary mb-4">Portal Branding</h3>
              <div className="flex gap-6 items-center flex-wrap">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg ${getSchoolColor(school.name)}`}>
                  {school.name.substring(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Active Theme</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{activeThemeLabel}</p>
                </div>
                <Button variant="outline" onClick={() => setShowThemeDialog(true)} className="flex items-center gap-1.5 text-xs">
                  <Palette className="h-3.5 w-3.5" /> Update Portal Theme
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Current plan card */}
          {(() => {
            const activePlan = allPlans.find(p => p.name === school.plan);
            const monthlyPrice = activePlan ? Number(activePlan.price) : null;
            const studentLimit = activePlan?.student_limit ? Number(activePlan.student_limit) : null;
            const usagePct = (schoolStats && studentLimit)
              ? Math.min(100, (schoolStats.students / studentLimit) * 100)
              : null;
            return (
              <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-zinc-800/30 blur-xl" />
                <div className="relative z-10">
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-1">Current Plan</p>
                  <h2 className="text-2xl font-black mb-6 font-display">{school.plan} Plan</h2>
                  <div className="space-y-3 mb-6 border-b border-zinc-800 pb-4">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400">Monthly Cost</span>
                      <span>{monthlyPrice != null ? `₹${monthlyPrice.toLocaleString()}` : '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400">Student Limit</span>
                      <span>{studentLimit ? studentLimit.toLocaleString() : 'Unlimited'}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-400">Enrolled Students</span>
                      <span>{schoolStats ? schoolStats.students.toLocaleString() : '—'}</span>
                    </div>
                  </div>
                  {usagePct !== null && (
                    <div className="mb-6">
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-100 rounded-full" style={{ width: `${usagePct.toFixed(1)}%` }} />
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {schoolStats.students} / {studentLimit.toLocaleString()} students
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full bg-zinc-50 text-zinc-900 hover:bg-zinc-200 border-none font-bold text-xs"
                    onClick={() => setShowSubscriptionDialog(true)}
                  >
                    Manage Subscription
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Standard plans selector */}
          <Card>
            <CardHeader className="py-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary">Available Plans</CardTitle>
              <button
                onClick={() => nav('/super-admin/billing')}
                className="text-xs font-bold text-primary hover:underline"
              >
                View all →
              </button>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {allPlans.filter(p => p.type === 'standard').slice(0, 3).map(p => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${school.plan === p.name ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div>
                    <p className="text-sm font-bold text-text-primary">{p.name}</p>
                    <p className="text-[10px] text-text-muted">{p.student_limit ? `${Number(p.student_limit).toLocaleString()} students` : 'Unlimited students'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-text-primary">₹{Number(p.price).toLocaleString()}</p>
                    <p className="text-[10px] text-text-muted">/month</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full text-xs font-bold" onClick={() => setShowSubscriptionDialog(true)}>
                Change Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {showPasswordDialog && (
        <ChangePasswordDialog schoolName={school.name} onClose={() => setShowPasswordDialog(false)} onSave={handlePasswordSave} />
      )}
      {showThemeDialog && (
        <ThemePickerDialog school={school} onClose={() => setShowThemeDialog(false)} onSaved={handleThemeSaved} />
      )}
      {showSubscriptionDialog && (
        <ManageSubscriptionDialog school={school} onClose={() => setShowSubscriptionDialog(false)} onSaved={handlePlanSaved} />
      )}
      {showEditDialog && (
        <EditSchoolDetailsDialog school={school} onClose={() => setShowEditDialog(false)} onSaved={handleSchoolDetailsSaved} />
      )}
    </div>
  );
}
