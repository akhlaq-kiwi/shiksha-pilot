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

const getCurrentAcademicYearDefaults = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    ay_name: `${startYear}–${endYear}`,
    ay_start_date: `${startYear}-04-01`,
    ay_end_date: `${endYear}-03-31`,
  };
};

const EMPTY = {
  name: '',
  contact_phone: '', contact_email: '', admin_phone: '', admin_password: '',
  ay_name: '', ay_start_date: '', ay_end_date: '',
};

export default function CreateSchoolDialog({ isOpen, onClose, onSubmit, creating, validationErrors = {} }) {
  const [form, setForm] = useState({ 
    ...EMPTY, 
    admin_password: generatePassword(),
    ...getCurrentAcademicYearDefaults()
  });
  const [localErrors, setLocalErrors] = useState({});

  useEffect(() => {
    setLocalErrors(validationErrors || {});
  }, [validationErrors]);

  useEffect(() => {
    if (isOpen) {
      setLocalErrors({});
      setForm({ 
        ...EMPTY, 
        admin_password: generatePassword(),
        ...getCurrentAcademicYearDefaults()
      });
    }
  }, [isOpen]);

  const set = (key) => (e) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    if (localErrors[key]) {
      setLocalErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    // Cross-clear duplicate phone alerts on typing
    if (key === 'admin_phone' && localErrors.contact_phone) {
      setLocalErrors(prev => {
        const next = { ...prev };
        delete next.contact_phone;
        return next;
      });
    }
    if (key === 'contact_phone' && localErrors.admin_phone) {
      setLocalErrors(prev => {
        const next = { ...prev };
        delete next.admin_phone;
        return next;
      });
    }
  };

  const refreshPassword = useCallback(() => {
    setForm(prev => ({ ...prev, admin_password: generatePassword() }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form, () => setForm({ 
      ...EMPTY, 
      admin_password: generatePassword(),
      ...getCurrentAcademicYearDefaults()
    }));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add New School"
      description="Provision a school, set up initial Academic Year, and configure the administrator account."
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
          <label htmlFor="school-name" className="text-xs font-bold text-text-secondary uppercase">School Name *</label>
          <Input id="school-name" placeholder="e.g. Cambridge Academy" value={form.name} onChange={set('name')} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="contact-phone" className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
            <Input id="contact-phone"
              placeholder="e.g. 9900000001"
              value={form.contact_phone}
              onChange={set('contact_phone')}
              className={localErrors?.contact_phone ? 'border-red-500 ring-1 ring-red-500' : ''}
            />
            {localErrors?.contact_phone && (
              <p className="text-[11px] font-bold text-red-500 mt-0.5">{localErrors.contact_phone}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="school-owner-email-address" className="text-xs font-bold text-text-secondary uppercase">School Owner Email Address *</label>
            <Input id="school-owner-email-address"
              type="email"
              placeholder="e.g. owner@school.com"
              value={form.contact_email}
              onChange={set('contact_email')}
              required
              className={localErrors?.contact_email ? 'border-red-500 ring-1 ring-red-500' : ''}
            />
            {localErrors?.contact_email && (
              <p className="text-[11px] font-bold text-red-500 mt-0.5">{localErrors.contact_email}</p>
            )}
          </div>
        </div>

        {/* Initial Academic Year Setup */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-text-secondary uppercase mb-3">Initial Academic Year Setup *</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ay-name" className="text-xs font-bold text-text-secondary uppercase">Year Title *</label>
              <Input id="ay-name"
                placeholder="e.g. 2026–2027"
                value={form.ay_name}
                onChange={set('ay_name')}
                required
                className={localErrors?.ay_name ? 'border-red-500 ring-1 ring-red-500' : ''}
              />
              {localErrors?.ay_name && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{localErrors.ay_name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ay-start-date" className="text-xs font-bold text-text-secondary uppercase">Start Date *</label>
              <Input id="ay-start-date"
                type="date"
                value={form.ay_start_date}
                onChange={set('ay_start_date')}
                required
                className={localErrors?.ay_start_date ? 'border-red-500 ring-1 ring-red-500' : ''}
              />
              {localErrors?.ay_start_date && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{localErrors.ay_start_date}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ay-end-date" className="text-xs font-bold text-text-secondary uppercase">End Date *</label>
              <Input id="ay-end-date"
                type="date"
                value={form.ay_end_date}
                onChange={set('ay_end_date')}
                required
                className={localErrors?.ay_end_date ? 'border-red-500 ring-1 ring-red-500' : ''}
              />
              {localErrors?.ay_end_date && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{localErrors.ay_end_date}</p>
              )}
            </div>
          </div>
        </div>

        {/* Admin credentials */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold text-text-secondary uppercase mb-3">School Admin Account *</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-phone" className="text-xs font-bold text-text-secondary uppercase">Admin Phone *</label>
              <Input id="admin-phone"
                placeholder="e.g. 9800000001"
                value={form.admin_phone}
                onChange={set('admin_phone')}
                required
                className={localErrors?.admin_phone ? 'border-red-500 ring-1 ring-red-500' : ''}
              />
              {localErrors?.admin_phone && (
                <p className="text-[11px] font-bold text-red-500 mt-0.5">{localErrors.admin_phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-text-secondary uppercase">Password *</label>
              <div className="flex items-center gap-1.5">
                <Input id="password"
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
