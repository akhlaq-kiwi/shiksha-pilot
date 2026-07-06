import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit2, Trash2, Users, GraduationCap, Clock, X } from 'lucide-react';
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

export default function SchoolsPage({ schools, onCreateSchool, onToggleStatus, onDeleteSchool, onSchoolUpdated }) {
  const nav = useNavigate();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [menuOpenSchoolId, setMenuOpenSchoolId] = useState(null);
  const [editingSchool, setEditingSchool] = useState(null);

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
        message: `"${school.name}" has an active subscription. You cannot delete a school with an active subscription history. Please suspend the school first if you wish to delete it.`,
        confirmLabel: 'Understood',
        danger: true,
      });
      if (ok) {
        // Backend validation will also catch this
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
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {school.logo_path ? (
                    <img
                      src={school.logo_path}
                      alt={school.name}
                      className="w-12 h-12 rounded-xl object-cover border border-border"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${getSchoolColor(school.name)}`}>
                      {school.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-text-primary text-base truncate pr-6">{school.name}</h3>
                    <p className="text-text-secondary text-xs truncate">{school.subdomain}.shikshapilot.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 relative">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${school.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {school.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                  
                  {/* Three-Dot Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenSchoolId(menuOpenSchoolId === school.id ? null : school.id);
                    }}
                    className="p-1 rounded-md text-text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
              </div>

              {/* Bottom Section - Active Plan */}
              <div className="border-t border-border/60 pt-4 mt-auto flex items-center justify-between text-xs font-semibold">
                <span className="text-text-muted">Subscription Plan</span>
                {school.active_plan ? (
                  <span className="bg-primary/5 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                    {school.active_plan}
                  </span>
                ) : (
                  <span className="bg-zinc-100 dark:bg-zinc-800 text-text-muted px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                    No Active Subscription
                  </span>
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
    </div>
  );
}
