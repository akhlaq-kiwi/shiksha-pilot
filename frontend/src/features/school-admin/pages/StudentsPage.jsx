import React, { useState } from 'react';
import { Plus, Search, Edit } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';

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

export default function StudentsPage({ students, setStudents }) {
  const [studentSearch, setStudentSearch] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', class: 'Class 9', section: 'A', gender: 'Male', parent: '', phone: '', dob: '' });
  const [submitting, setSubmitting] = useState(false);

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.roll.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.class.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!newStudent.name) return;
    setSubmitting(true);
    try {
      const id = students.length + 1;
      const roll = `S-2024-00${id}`;
      setStudents(prev => [...prev, { ...newStudent, id, roll, status: 'ACTIVE' }]);
      setIsAddStudentOpen(false);
      setNewStudent({ name: '', class: 'Class 9', section: 'A', gender: 'Male', parent: '', phone: '', dob: '' });
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

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
          <Input placeholder="Search by name, roll, or class..." className="pl-9" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
        </div>
        <Select className="w-full md:w-40">
          <option value="">All Classes</option>
          <option>Class 9</option><option>Class 10</option><option>Class 11</option>
        </Select>
        <Select className="w-full md:w-40">
          <option value="">All Status</option>
          <option>Active</option><option>Inactive</option>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll No.</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-text-muted">No students found.</TableCell></TableRow>
            ) : filteredStudents.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-text-muted">{s.roll}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black flex-shrink-0">
                      {s.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-text-primary text-sm">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-secondary text-xs">{s.class}</TableCell>
                <TableCell className="text-text-secondary text-xs">{s.section}</TableCell>
                <TableCell className="text-text-secondary text-xs">{s.parent}</TableCell>
                <TableCell className="text-text-secondary text-xs font-mono">{s.phone}</TableCell>
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
              <Select value={newStudent.class} onChange={e => setNewStudent(p => ({ ...p, class: e.target.value }))}>
                <option>Class 9</option><option>Class 10</option><option>Class 11</option><option>Class 12</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Section</label>
              <Select value={newStudent.section} onChange={e => setNewStudent(p => ({ ...p, section: e.target.value }))}>
                <option>A</option><option>B</option><option>Science</option><option>Commerce</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Gender</label>
              <Select value={newStudent.gender} onChange={e => setNewStudent(p => ({ ...p, gender: e.target.value }))}>
                <option>Male</option><option>Female</option><option>Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Date of Birth</label>
              <Input type="date" value={newStudent.dob} onChange={e => setNewStudent(p => ({ ...p, dob: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Parent / Guardian Name</label>
            <Input placeholder="e.g. Suresh Verma" value={newStudent.parent} onChange={e => setNewStudent(p => ({ ...p, parent: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Contact Phone</label>
            <Input placeholder="10-digit mobile number" value={newStudent.phone} onChange={e => setNewStudent(p => ({ ...p, phone: e.target.value }))} />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
