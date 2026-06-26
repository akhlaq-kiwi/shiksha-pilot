import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';

const statusBadge = (status) => {
  const map = {
    ACTIVE: 'bg-green-500/10 text-green-600',
    INACTIVE: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', class_id: '', gender: 'Male', parent: '', phone: '', dob: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [stuData, clsData] = await Promise.all([
        schoolService.getStudents(),
        schoolService.getClasses()
      ]);
      setStudents(stuData || []);
      setClasses(clsData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Students...</p>
        </div>
      </div>
    );
  }

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.admission_no && s.admission_no.toLowerCase().includes(studentSearch.toLowerCase())) ||
      (s.class_name && s.class_name.toLowerCase().includes(studentSearch.toLowerCase()));
    
    const matchesClass = !selectedClassFilter || String(s.class_id) === String(selectedClassFilter);
    const matchesStatus = !selectedStatusFilter || s.status === selectedStatusFilter;

    return matchesSearch && matchesClass && matchesStatus;
  });

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.name) return;
    setSubmitting(true);
    setError('');
    try {
      const admission_no = `S-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await schoolService.createStudent({
        name: newStudent.name,
        class_id: newStudent.class_id ? parseInt(newStudent.class_id) : null,
        parent_phone: newStudent.phone,
        email: `${newStudent.name.toLowerCase().replace(/\s+/g, '')}@student.shiksha.edu`,
        dob: newStudent.dob || null,
        admission_no,
        status: 'ACTIVE'
      });
      setIsAddStudentOpen(false);
      setNewStudent({ name: '', class_id: '', gender: 'Male', parent: '', phone: '', dob: '' });
      loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to enroll student.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Student Management</h2>
          <p className="text-text-secondary text-sm mt-1">{totalStudents} students enrolled · {activeStudents} active</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setIsAddStudentOpen(true)}>
          <Plus className="h-4 w-4" /> Enroll Student
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
          <Input placeholder="Search by name, roll, or class..." className="pl-9" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
        </div>
        <Select className="w-full md:w-40" value={selectedClassFilter} onChange={e => setSelectedClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
          ))}
        </Select>
        <Select className="w-full md:w-40" value={selectedStatusFilter} onChange={e => setSelectedStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="Inactive">Inactive</option>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admission No.</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Parent Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No students found.</TableCell></TableRow>
            ) : filteredStudents.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-text-muted">{s.admission_no || s.roll || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black flex-shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-text-primary text-sm">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-secondary text-xs">{s.class_name || s.class || '-'}</TableCell>
                <TableCell className="text-text-secondary text-xs">{s.section || '-'}</TableCell>
                <TableCell className="text-text-secondary text-xs font-mono">{s.parent_phone || s.phone || '-'}</TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
                <TableCell>
                  <button className="text-text-muted hover:text-primary transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Enroll Student Dialog */}
      <Dialog isOpen={isAddStudentOpen} onClose={() => setIsAddStudentOpen(false)}
        title="Enroll New Student" description="Add a student to the school roster."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddStudentOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStudent} disabled={submitting}>{submitting ? 'Enrolling...' : 'Enroll Student'}</Button>
        </>}>
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Full Name</label>
            <Input placeholder="e.g. Rahul Verma" value={newStudent.name} onChange={e => setNewStudent(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              {classes.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                  No classes defined. Create classes in Academic page.
                </div>
              ) : (
                <Select value={newStudent.class_id} onChange={e => setNewStudent(p => ({ ...p, class_id: e.target.value }))} required>
                  <option value="">Select class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Gender</label>
              <Select value={newStudent.gender} onChange={e => setNewStudent(p => ({ ...p, gender: e.target.value }))}>
                <option>Male</option><option>Female</option><option>Other</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Date of Birth</label>
              <Input type="date" value={newStudent.dob} onChange={e => setNewStudent(p => ({ ...p, dob: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
              <Input placeholder="10-digit mobile number" value={newStudent.phone} onChange={e => setNewStudent(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
