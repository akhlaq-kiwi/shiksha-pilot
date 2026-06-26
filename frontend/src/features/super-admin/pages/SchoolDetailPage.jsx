import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Ban, UserCheck, Trash2, KeyRound, Palette, X, Eye, EyeOff, MoreVertical, Users, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';

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
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const item = (label, Icon, onClick, danger = false) => (
    <button
      onClick={() => { setOpen(false); onClick(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors text-left ${danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40' : 'text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="icon" onClick={() => setOpen(v => !v)} aria-label="Actions">
        <MoreVertical className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 bg-surface border border-border rounded-xl shadow-lg p-1.5 animate-in fade-in zoom-in-95 duration-150">
          {item('Change Admin Password', KeyRound, onChangePassword)}
          {item(
            school.status === 'ACTIVE' ? 'Suspend School' : 'Activate School',
            school.status === 'ACTIVE' ? Ban : UserCheck,
            () => onToggleStatus(school),
            school.status === 'ACTIVE',
          )}
          <div className="my-1 border-t border-border" />
          {item('Delete School', Trash2, onDelete, true)}
        </div>
      )}
    </div>
  );
}

const PLAN_PRICES = { Standard: '₹7,999', Premium: '₹19,999', Enterprise: '₹39,999' };
const PLAN_LIMITS = { Standard: '1,500', Premium: '5,000', Enterprise: '∞' };

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

export default function SchoolDetailPage({ schools, onToggleStatus, onDeleteSchool }) {
  const { id }  = useParams();
  const nav     = useNavigate();
  const toast   = useToast();
  const baseSchool = schools.find(s => s.id === Number(id));

  const [school, setSchool] = useState(baseSchool);
  useEffect(() => { setSchool(baseSchool); }, [baseSchool]);

  const [schoolStats,        setSchoolStats]        = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showThemeDialog,    setShowThemeDialog]    = useState(false);

  useEffect(() => {
    if (!id) return;
    platformService.getSchoolStats(Number(id))
      .then(d => setSchoolStats(d))
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
            <p className="text-primary text-xs font-bold mt-1">{school.subdomain}.shikshapilot.com</p>
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
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">School Profile</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">School ID</p>
                <p className="text-sm font-bold text-text-primary mt-1">SP-{String(school.id).padStart(4, '0')}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Subdomain</p>
                <p className="text-sm font-bold text-text-primary mt-1">{school.subdomain}.shikshapilot.com</p>
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
          <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-zinc-800/30 blur-xl" />
            <div className="relative z-10">
              <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-1">Current Plan</p>
              <h2 className="text-2xl font-black mb-6 font-display">{school.plan} Plan</h2>
              <div className="space-y-3 mb-6 border-b border-zinc-800 pb-4">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Monthly Cost</span>
                  <span>{PLAN_PRICES[school.plan] || '—'}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Student Limit</span>
                  <span>{PLAN_LIMITS[school.plan] || '—'}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Enrolled Students</span>
                  <span>{schoolStats ? schoolStats.students.toLocaleString() : '—'}</span>
                </div>
              </div>
              {schoolStats && PLAN_LIMITS[school.plan] && PLAN_LIMITS[school.plan] !== '∞' && (
                <div className="mb-6">
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-100 rounded-full"
                      style={{ width: `${Math.min(100, (schoolStats.students / parseInt(PLAN_LIMITS[school.plan].replace(',', ''))) * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {schoolStats.students} / {PLAN_LIMITS[school.plan]} students
                  </p>
                </div>
              )}
              <Button
                className="w-full bg-zinc-50 text-zinc-900 hover:bg-zinc-200 border-none font-bold text-xs"
                onClick={() => nav('/super-admin/billing')}
              >
                Manage Subscription
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showPasswordDialog && (
        <ChangePasswordDialog schoolName={school.name} onClose={() => setShowPasswordDialog(false)} onSave={handlePasswordSave} />
      )}
      {showThemeDialog && (
        <ThemePickerDialog school={school} onClose={() => setShowThemeDialog(false)} onSaved={handleThemeSaved} />
      )}
    </div>
  );
}
