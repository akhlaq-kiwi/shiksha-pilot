import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, User, UserCog, Upload, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';

// Self-healing avatar image component to handle loading errors gracefully
const TeacherAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : `http://localhost:8000${src}`;
    const cleanUrl = updatedAt ? `${fileUrl}?v=${encodeURIComponent(updatedAt)}` : `${fileUrl}?v=${Date.now()}`;
    return (
      <img 
        src={cleanUrl} 
        alt={name} 
        onError={() => setError(true)} 
        className="w-full h-full object-cover animate-in fade-in duration-200" 
      />
    );
  }
  
  // Use first letters of name as fallback or a clean initials display
  const initials = name
    ? name.split(' ').filter(n => n).filter((_, i) => i < 2).map(n => n[0]).join('').toUpperCase()
    : 'T';
    
  return (
    <div className="w-full h-full bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 flex items-center justify-center text-xl font-black">
      {initials}
    </div>
  );
};

export default function StaffPage() {
  const [view, setView] = useState('list'); // 'list', 'details'
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  
  const [newStaff, setNewStaff] = useState({ 
    id: null,
    name: '', 
    role: 'Teacher', 
    department: 'Mathematics', 
    email: '', 
    phone: '',
    photo_path: '',
    assigned_periods: 0,
    max_periods: 8
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await schoolService.getStaff();
      setStaff(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load teachers list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Teachers...</p>
        </div>
      </div>
    );
  }

  const teachers = staff.filter(s => s.role === 'TEACHER' || s.role === 'Teacher');
  const totalTeachers = teachers.length;
  const activeTeachersCount = teachers.filter(s => s.status === 'ACTIVE').length;

  const filteredStaff = teachers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(staffSearch.toLowerCase()));
    const matchesDept = !selectedDeptFilter || s.department === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  // Sort by assigned periods descending (highest workload first)
  const sortedStaff = [...filteredStaff].sort((a, b) => {
    const periodsA = a.assigned_periods || 0;
    const periodsB = b.assigned_periods || 0;
    return periodsB - periodsA;
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await schoolService.uploadDocument(formData);
      if (res && res.url) {
        setNewStaff(prev => ({ ...prev, photo_path: res.url }));
        setSuccess('Photo uploaded successfully.');
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to upload photo.');
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: newStaff.name,
        role: newStaff.role.toUpperCase(),
        department: newStaff.department,
        email: newStaff.email || `${newStaff.name.toLowerCase().replace(/\s+/g, '')}@shiksha.edu`,
        phone: newStaff.phone || null,
        photo_path: newStaff.photo_path || null,
        assigned_periods: parseInt(newStaff.assigned_periods, 10) || 0,
        max_periods: parseInt(newStaff.max_periods, 10) || 8,
        status: 'ACTIVE',
      };

      if (newStaff.id) {
        // Edit Mode
        await schoolService.updateStaff(newStaff.id, payload);
        setSuccess('Teacher profile updated successfully.');
      } else {
        // Create Mode
        const employee_id = `EMP-${Date.now().toString().slice(-4)}`;
        await schoolService.createStaff({
          ...payload,
          employee_id,
          joining_date: new Date().toISOString().split('T')[0]
        });
        setSuccess('Teacher enrolled successfully.');
      }
      
      setIsAddStaffOpen(false);
      setNewStaff({ 
        id: null,
        name: '', 
        role: 'Teacher', 
        department: 'Mathematics', 
        email: '', 
        phone: '',
        photo_path: '',
        assigned_periods: 0,
        max_periods: 8
      });
      await loadStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save teacher details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Redesigned Details View */}
      {view === 'details' && (() => {
        const t = staff.find(x => x.id === selectedTeacherId);
        if (!t) {
          setView('list');
          return null;
        }
        
        const assignedPeriods = t.assigned_periods || 0;
        const maxPeriods = t.max_periods || 8;
        const isOccupied = assignedPeriods >= maxPeriods;
        
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 gap-4 bg-surface p-4 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setView('list')} 
                  className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs"
                >
                  Back
                </button>
                <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Teacher Profile</h2>
              </div>
              <Button variant="outline" className="flex items-center gap-2 font-bold" onClick={() => {
                setNewStaff({
                  id: t.id,
                  name: t.name,
                  role: t.role,
                  department: t.department,
                  email: t.email,
                  phone: t.phone,
                  photo_path: t.photo_path || '',
                  assigned_periods: t.assigned_periods || 0,
                  max_periods: t.max_periods || 8
                });
                setIsAddStaffOpen(true);
              }}>
                <Edit className="h-4 w-4" /> Edit Profile
              </Button>
            </div>

            {/* Profile Info Panel */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Photo / Avatar */}
                <div className="w-24 h-24 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden shadow-2xs flex-shrink-0">
                  <TeacherAvatar src={t.photo_path} name={t.name} updatedAt={t.updated_at} />
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <h3 className="text-2xl font-black text-text-primary tracking-tight font-display">{t.name}</h3>
                    <p className="text-xs text-text-muted mt-1 font-bold uppercase tracking-wider">Employee ID: <span className="font-mono text-text-primary font-extrabold">{t.employee_id || '-'}</span></p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black uppercase border ${
                      isOccupied 
                        ? 'bg-red-500/10 text-red-600 border-red-500/20' 
                        : 'bg-green-500/10 text-green-600 border-green-500/20'
                    }`}>
                      {isOccupied ? 'Occupied' : 'Available'}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-zinc-100 text-text-secondary dark:bg-zinc-800 uppercase">
                      Assigned {assignedPeriods}/{maxPeriods} Periods
                    </span>
                  </div>
                </div>
              </div>

              <hr className="border-border my-6" />

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-xs">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Role</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{t.role}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Department</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{t.department || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Joining Date</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{t.joining_date || t.joining || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{t.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Phone</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{t.phone || '—'}</p>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Roster Listing View */}
      {view === 'list' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Teachers</h2>
              <p className="text-text-secondary text-sm mt-1">{totalTeachers} teachers · {activeTeachersCount} active</p>
            </div>
            <Button className="flex items-center gap-2 font-bold" onClick={() => {
              setNewStaff({
                id: null,
                name: '',
                role: 'Teacher',
                department: 'Mathematics',
                email: '',
                phone: '',
                photo_path: '',
                assigned_periods: 0,
                max_periods: 8
              });
              setIsAddStaffOpen(true);
            }}>
              <Plus className="h-4 w-4" /> Add Teacher
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-xs font-semibold">
              {success}
            </div>
          )}

          {/* Filters */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
              <Input placeholder="Search teachers..." className="pl-9" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
            </div>
            <Select className="w-full md:w-48" value={selectedDeptFilter} onChange={e => setSelectedDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Science">Science</option>
              <option value="English">English</option>
              <option value="Social Studies">Social Studies</option>
              <option value="Administration">Administration</option>
            </Select>
          </div>

          {/* Cards Grid */}
          {sortedStaff.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-xs shadow-xs">
              No teachers found.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedStaff.map(t => {
                const assignedPeriods = t.assigned_periods || 0;
                const maxPeriods = t.max_periods || 8;
                const isOccupied = assignedPeriods >= maxPeriods;

                return (
                  <div 
                    key={t.id}
                    onClick={() => { setSelectedTeacherId(t.id); setView('details'); }}
                    className="flex flex-col items-center justify-center p-6 bg-surface border border-border rounded-2xl hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-200 text-center select-none"
                  >
                    {/* Photo / Avatar */}
                    <div className="w-20 h-20 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden mb-4 shadow-2xs">
                      <TeacherAvatar src={t.photo_path} name={t.name} updatedAt={t.updated_at} />
                    </div>
                    
                    {/* Name */}
                    <h3 className="font-extrabold text-text-primary text-base hover:text-primary transition-colors leading-tight truncate w-full px-1">
                      {t.name}
                    </h3>
                    
                    {/* Bottom Status & Spacing */}
                    <div className="flex items-center justify-between w-full mt-4 text-xs">
                      {/* Availability Badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                        isOccupied 
                          ? 'bg-red-500/10 text-red-600 border-red-500/20' 
                          : 'bg-green-500/10 text-green-600 border-green-500/20'
                      }`}>
                        {isOccupied ? 'Occupied' : 'Available'}
                      </span>
                      
                      {/* Workload */}
                      <span className="text-[11px] text-text-muted font-bold tracking-tight">
                        Assigned {assignedPeriods}/{maxPeriods}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add / Edit Teacher Dialog */}
      <Dialog isOpen={isAddStaffOpen} onClose={() => setIsAddStaffOpen(false)}
        title={newStaff.id ? "Edit Teacher details" : "Add Teacher Member"} description={newStaff.id ? "Update details of the selected teacher." : "Add a new teacher to the school."}
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStaff} disabled={submitting}>{submitting ? 'Saving...' : (newStaff.id ? 'Save Changes' : 'Add Teacher')}</Button>
        </>}>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Full Name</label>
            <Input placeholder="e.g. Ms. Anita Sharma" value={newStaff.name} onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Role</label>
              <Select value={newStaff.role} onChange={e => setNewStaff(p => ({ ...p, role: e.target.value }))}>
                <option value="Teacher">Teacher</option>
                <option value="Admin">Admin</option>
                <option value="Accountant">Accountant</option>
                <option value="Librarian">Librarian</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Department</label>
              <Select value={newStaff.department} onChange={e => setNewStaff(p => ({ ...p, department: e.target.value }))}>
                <option value="Mathematics">Mathematics</option>
                <option value="Science">Science</option>
                <option value="English">English</option>
                <option value="Social Studies">Social Studies</option>
                <option value="Administration">Administration</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Email</label>
              <Input type="email" placeholder="e.g. anita.sharma@school.edu" value={newStaff.email} onChange={e => setNewStaff(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Phone</label>
              <Input placeholder="Mobile number" value={newStaff.phone} onChange={e => setNewStaff(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          {/* Workload Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Assigned Periods</label>
              <Input type="number" min={0} max={newStaff.max_periods} value={newStaff.assigned_periods} onChange={e => setNewStaff(p => ({ ...p, assigned_periods: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Max Allowed Periods</label>
              <Input type="number" min={1} value={newStaff.max_periods} onChange={e => setNewStaff(p => ({ ...p, max_periods: parseInt(e.target.value, 10) || 8 }))} />
            </div>
          </div>

          {/* Photo upload handling */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-text-secondary uppercase">Teacher Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                <TeacherAvatar src={newStaff.photo_path} name={newStaff.name || 'Preview'} />
              </div>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-secondary bg-surface hover:bg-zinc-50 cursor-pointer shadow-2xs transition-all">
                <Upload className="h-3.5 w-3.5" /> Upload File
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
