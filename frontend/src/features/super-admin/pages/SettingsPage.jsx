import React, { useState, useEffect } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';

function AddAdminDialog({ onClose, onAdd }) {
  const [form, setForm]   = useState({ name: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState('');
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const admin = await platformService.createAdmin(form);
      onAdd(admin);
      onClose();
    } catch (error) {
      setErr(error.message || 'Failed to create administrator');
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
            <h3 className="text-base font-bold text-text-primary">Add Administrator</h3>
            <p className="text-xs text-text-muted mt-0.5">Creates a new SUPER_ADMIN account</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 font-semibold">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="full-name" className="text-xs font-bold text-text-secondary uppercase">Full Name</label>
            <Input id="full-name" placeholder="e.g. John Smith" value={form.name} onChange={set('name')} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-bold text-text-secondary uppercase">Phone</label>
              <Input id="phone" placeholder="e.g. 1000000004" value={form.phone} onChange={set('phone')} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-text-secondary uppercase">Password</label>
              <Input id="password" type="password" placeholder="Min. 6 chars" value={form.password} onChange={set('password')} required minLength={6} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Creating…' : 'Add Administrator'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SettingsPage({ auditLogs }) {
  const toast = useToast();
  const [admins,    setAdmins]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);

  useEffect(() => {
    platformService.getAdmins()
      .then(data => setAdmins(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = (admin) => {
    setAdmins(prev => [...prev, admin]);
    toast.success(`${admin.name} added as administrator.`, 'Admin Created');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">System Settings</h2>
          <p className="text-text-secondary text-sm mt-1">Manage platform administrators and global security parameters.</p>
        </div>
        <Button className="flex items-center gap-2 justify-center" onClick={() => setShowAdd(true)}>
          <UserPlus className="h-4 w-4" /> Add Administrator
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Admins Table */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary">Administrator Directory</CardTitle>
              <span className="text-[11px] font-bold text-green-600 flex items-center gap-1 uppercase bg-green-500/10 px-2 py-0.5 rounded-full">
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-text-muted text-sm">Loading…</TableCell>
                  </TableRow>
                ) : admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-text-muted text-sm">No administrators found.</TableCell>
                  </TableRow>
                ) : (
                  admins.map(admin => (
                    <TableRow key={admin.id}>
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 font-bold text-xs flex items-center justify-center">
                            {(admin.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-text-primary">{admin.name}</p>
                            <p className="text-[11px] text-text-muted font-semibold">{admin.phone}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-text-secondary">{admin.role}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${admin.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                          {admin.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* System Config */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">System Config</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-border/60">
                <span className="font-semibold text-text-secondary">Platform Version</span>
                <span className="font-mono font-bold text-text-primary">v1.0.0</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/60">
                <span className="font-semibold text-text-secondary">Environment</span>
                <span className="font-mono font-bold text-text-primary">development</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-semibold text-text-secondary">Database</span>
                <span className="font-mono font-bold text-teal-600">sp-db:3306</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audit Logs */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Audit Trail</CardTitle>
          <CardDescription className="text-xs text-text-secondary">Platform-wide event logs and administrative actions.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-text-muted">No audit records found.</TableCell>
              </TableRow>
            ) : (
              auditLogs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-bold text-text-primary py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 flex-shrink-0" />
                      {log.action}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.target_school || 'Platform'}</TableCell>
                  <TableCell className="text-xs">
                    {log.user
                      ? log.user_role
                        ? `${log.user} (${log.user_role.replace('_', ' ')})`
                        : log.user
                      : 'System'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{log.created_at || log.date}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-500/10 text-green-600">
                      Success
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {showAdd && <AddAdminDialog onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  );
}
