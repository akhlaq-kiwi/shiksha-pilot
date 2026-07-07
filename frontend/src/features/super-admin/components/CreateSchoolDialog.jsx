import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Dialog } from '../../../common/ui/dialog';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { platformService } from '../../../common/services/platformService';

const generatePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const EMPTY = {
  name: '', plan: '',
  contact_phone: '', contact_email: '', admin_phone: '', admin_password: '',
};

export default function CreateSchoolDialog({ isOpen, onClose, onSubmit, creating }) {
  const [form, setForm] = useState({ ...EMPTY, admin_password: generatePassword() });
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      platformService.getPlans()
        .then(data => {
          const activePlans = (data || []).filter(p => p.is_active === 1 || p.is_active === '1' || p.is_active === true);
          setPlans(activePlans);
          if (activePlans.length > 0) {
            setForm(prev => ({ ...prev, plan: activePlans[0].name, admin_password: generatePassword() }));
          } else {
            setForm(prev => ({ ...prev, plan: '', admin_password: generatePassword() }));
          }
        })
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen]);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const refreshPassword = useCallback(() => {
    setForm(prev => ({ ...prev, admin_password: generatePassword() }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form, () => setForm({ ...EMPTY, admin_password: generatePassword() }));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add New School"
      description="Provision a school and set up the administrator account."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={creating || plans.length === 0}>
            {creating ? 'Creating...' : 'Create School'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {plans.length === 0 && !loading && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-bold leading-normal">
            Please create and activate at least one subscription plan before adding a school.
          </div>
        )}

        {/* School details */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase">School Name</label>
          <Input placeholder="e.g. Cambridge Academy" value={form.name} onChange={set('name')} required />
        </div>

        {/* Plan selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-secondary uppercase">Pricing Plan</label>
          <Select value={form.plan} onChange={set('plan')} disabled={plans.length === 0}>
            {plans.length === 0 ? (
              <option value="">No active subscription plans available.</option>
            ) : (
              plans.map(p => (
                <option key={p.id} value={p.name}>
                  {p.name} — {p.price > 0 ? `₹${Number(p.price).toLocaleString()}` : 'Free'}
                </option>
              ))
            )}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
            <Input placeholder="e.g. 9900000001" value={form.contact_phone} onChange={set('contact_phone')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">School Owner Email Address *</label>
            <Input type="email" placeholder="e.g. owner@school.com" value={form.contact_email} onChange={set('contact_email')} required />
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
