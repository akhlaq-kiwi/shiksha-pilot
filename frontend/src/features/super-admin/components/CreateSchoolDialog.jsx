import React, { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Dialog } from '../../../common/ui/dialog';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';

const generatePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const PRESET_PLANS = [
  { value: 'Standard',   label: 'Standard — ₹7,999/mo' },
  { value: 'Premium',    label: 'Premium — ₹19,999/mo' },
  { value: 'Enterprise', label: 'Enterprise — ₹39,999/mo' },
  { value: 'Trial',      label: 'Trial (free for a period)' },
  { value: 'Custom',     label: 'Custom plan…' },
];

const EMPTY = {
  name: '', subdomain: '', plan: 'Premium',
  contact_phone: '', admin_phone: '', admin_password: '',
  // trial fields
  trial_duration: '1', trial_unit: 'month',
  // custom plan fields
  custom_plan_name: '', custom_price: '', custom_limit: '', custom_desc: '',
};

export default function CreateSchoolDialog({ isOpen, onClose, onSubmit, creating }) {
  const [form, setForm] = useState({ ...EMPTY, admin_password: generatePassword() });

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const refreshPassword = useCallback(() => {
    setForm(prev => ({ ...prev, admin_password: generatePassword() }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form, () => setForm({ ...EMPTY, admin_password: generatePassword() }));
  };

  const isTrial  = form.plan === 'Trial';
  const isCustom = form.plan === 'Custom';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add New School"
      description="Provision a school and set up the administrator account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={creating}>
            {creating ? 'Creating...' : 'Create School'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* School details */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase">School Name</label>
          <Input placeholder="e.g. Cambridge Academy" value={form.name} onChange={set('name')} required />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase">Subdomain</label>
          <div className="flex items-center gap-1.5">
            <Input placeholder="subdomain" value={form.subdomain} onChange={set('subdomain')} required className="flex-1" />
            <span className="text-sm font-semibold text-text-muted whitespace-nowrap">.shikshapilot.com</span>
          </div>
        </div>

        {/* Plan selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase">Pricing Plan</label>
          <Select value={form.plan} onChange={set('plan')}>
            {PRESET_PLANS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>

        {/* Trial options */}
        {isTrial && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Trial Period</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-text-secondary font-semibold">Duration</label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  placeholder="e.g. 3"
                  value={form.trial_duration}
                  onChange={set('trial_duration')}
                  required
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-text-secondary font-semibold">Unit</label>
                <Select value={form.trial_unit} onChange={set('trial_unit')}>
                  <option value="day">Days</option>
                  <option value="month">Months</option>
                  <option value="year">Years</option>
                </Select>
              </div>
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              School gets free access for {form.trial_duration} {form.trial_unit}(s). Convert to paid plan anytime.
            </p>
          </div>
        )}

        {/* Custom plan options */}
        {isCustom && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Custom Plan Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-semibold">Plan Name</label>
                <Input placeholder="e.g. District Pro" value={form.custom_plan_name} onChange={set('custom_plan_name')} required={isCustom} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-semibold">Monthly Price (₹)</label>
                <Input type="number" min="0" placeholder="e.g. 14999" value={form.custom_price} onChange={set('custom_price')} required={isCustom} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-secondary font-semibold">Student Limit</label>
                <Input type="number" min="0" placeholder="Leave blank for unlimited" value={form.custom_limit} onChange={set('custom_limit')} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary font-semibold">Description</label>
              <Input placeholder="Brief description of this plan" value={form.custom_desc} onChange={set('custom_desc')} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
            <Input placeholder="e.g. 9900000001" value={form.contact_phone} onChange={set('contact_phone')} />
          </div>
        </div>

        {/* Admin credentials */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-text-secondary uppercase mb-3">School Admin Account</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Admin Phone</label>
              <Input placeholder="e.g. 9800000001" value={form.admin_phone} onChange={set('admin_phone')} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Password</label>
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="Password"
                  value={form.admin_password}
                  onChange={set('admin_password')}
                  required
                  className="flex-1 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={refreshPassword}
                  className="p-2 rounded-md border border-border hover:bg-zinc-50 dark:hover:bg-zinc-800 text-text-muted hover:text-text-primary transition-colors"
                  title="Generate new password"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
