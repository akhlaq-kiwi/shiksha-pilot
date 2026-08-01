import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';

const statusBadge = (status) => {
  const map = {
    Current: 'bg-green-500/10 text-green-600',
    Completed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
    ACTIVE: 'bg-green-500/10 text-green-600',
    Inactive: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function AcademicPage() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', section: '', stream: '' });
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
      setError('Failed to load academic data.');
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
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Academic Management...</p>
        </div>
      </div>
    );
  }

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name) return;
    setSubmitting(true);
    setError('');
    try {
      await schoolService.createClass({
        name: newClass.name,
        section: newClass.section || null,
        stream: newClass.stream || null
      });
      setIsAddClassOpen(false);
      setNewClass({ name: '', section: '', stream: '' });
      loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create class.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Academic Management</h2>
        <p className="text-text-secondary text-sm mt-1">Configure academic years, classes, sections, and subjects.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic Years */}
        <Card>
          <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-text-primary">Academic Years</CardTitle>
            <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Terms</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {[{ y: '2025–2026', t: 2, s: 'Current' }].map(r => (
                <TableRow key={r.y}>
                  <TableCell className="font-semibold text-text-primary">{r.y}</TableCell>
                  <TableCell className="text-text-secondary text-xs">{r.t} Terms</TableCell>
                  <TableCell>{statusBadge(r.s)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Classes */}
        <Card>
          <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-text-primary">Classes & Sections</CardTitle>
            <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1" onClick={() => setIsAddClassOpen(true)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Section</TableHead><TableHead>Stream</TableHead><TableHead>Students</TableHead></TableRow></TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-6 text-text-muted">No classes defined.</TableCell></TableRow>
              ) : classes.map(c => {
                const classStudentCount = students.filter(s => String(s.class_id) === String(c.id)).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold text-text-primary">{c.name}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{c.section || '-'}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{c.stream || '-'}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{classStudentCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Subjects */}
        <Card className="md:col-span-2">
          <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-text-primary">Subjects</CardTitle>
            <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add Subject</Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Classes</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { n: 'Mathematics', code: 'MATH-01', dept: 'Mathematics', cl: 'All', type: 'Core' },
                { n: 'Science', code: 'SCI-01', dept: 'Science', cl: 'Class 1–10', type: 'Core' },
                { n: 'English Language', code: 'ENG-01', dept: 'English', cl: 'All', type: 'Core' },
                { n: 'Social Studies', code: 'SS-01', dept: 'Social Studies', cl: 'Class 1–10', type: 'Core' },
                { n: 'Physics', code: 'PHY-01', dept: 'Science', cl: 'Class 11–12', type: 'Core' },
                { n: 'Computer Science', code: 'CS-01', dept: 'Science', cl: 'Class 9–12', type: 'Elective' },
              ].map(r => (
                <TableRow key={r.code}>
                  <TableCell className="font-semibold text-text-primary">{r.n}</TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{r.code}</TableCell>
                  <TableCell className="text-text-secondary text-xs">{r.dept}</TableCell>
                  <TableCell className="text-text-secondary text-xs">{r.cl}</TableCell>
                  <TableCell><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.type === 'Core' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}`}>{r.type}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Add Class Dialog */}
      <Dialog isOpen={isAddClassOpen} onClose={() => setIsAddClassOpen(false)}
        title="Add Class & Section" description="Create a new class group."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddClassOpen(false)}>Cancel</Button>
          <Button onClick={handleAddClass} disabled={submitting}>{submitting ? 'Creating...' : 'Create Class'}</Button>
        </>}>
        <form onSubmit={handleAddClass} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Class Name</label>
            <Input placeholder="e.g. Class 10" value={newClass.name} onChange={e => setNewClass(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Section</label>
              <Input placeholder="e.g. A" value={newClass.section} onChange={e => setNewClass(p => ({ ...p, section: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Stream / Specialization</label>
              <Input placeholder="e.g. Science" value={newClass.stream} onChange={e => setNewClass(p => ({ ...p, stream: e.target.value }))} />
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
