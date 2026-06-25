import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { authService } from '../services/authService';
import { useToast } from './Toast';

export default function ForcePasswordChange({ onDismiss }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const mismatch = confirm && password !== confirm;
  const valid = password.length >= 6 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await authService.changePassword(password);
      // Clear flag in local storage
      const user = authService.getCurrentUser();
      if (user) {
        user.force_password_change = 0;
        localStorage.setItem('shiksha_pilot_user', JSON.stringify(user));
      }
      toast.success('Password updated. Keep it safe!', 'Password Changed');
      onDismiss();
    } catch (err) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 fade-in duration-200">
        {/* Dismiss (optional) */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted"
          title="Skip for now"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>

        <h3 className="text-lg font-black text-text-primary">Set Your Password</h3>
        <p className="text-sm text-text-secondary mt-1 mb-5">
          Your account was created with a temporary password. Set a new one to secure your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">New Password</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Confirm Password</label>
            <Input
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className={mismatch ? 'border-red-400 focus:ring-red-400' : ''}
            />
            {mismatch && <p className="text-xs text-red-500 font-semibold">Passwords do not match</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1 text-xs" onClick={onDismiss}>
              Skip for now
            </Button>
            <Button type="submit" className="flex-1 text-xs" disabled={!valid || saving}>
              {saving ? 'Saving...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
