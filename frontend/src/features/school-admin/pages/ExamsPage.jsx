import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';

const statusBadge = (status) => {
  const map = {
    Upcoming: 'bg-blue-500/10 text-blue-600',
    Completed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
    Published: 'bg-green-500/10 text-green-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function ExamsPage() {
  const { isReadOnly } = useAcademicYear();
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [newExam, setNewExam] = useState({ name: '', class_id: '', term: 'Term 1', date: '', total_marks: 100 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [exData, clsData, stuData] = await Promise.all([
        schoolService.getExams(),
        schoolService.getClasses(),
        schoolService.getStudents()
      ]);
      setExams(exData || []);
      setClasses(clsData || []);
      setStudents(stuData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleYearSwitch = () => {
      loadData();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Exams...</p>
        </div>
      </div>
    );
  }

  const getExamStatus = (examDate) => {
    if (!examDate) return 'Upcoming';
    const today = new Date().toISOString().split('T')[0];
    return examDate < today ? 'Completed' : 'Upcoming';
  };

  const upcomingCount = exams.filter(e => getExamStatus(e.exam_date) === 'Upcoming').length;
  const completedCount = exams.filter(e => getExamStatus(e.exam_date) === 'Completed').length;

  const handleAddExam = async (e) => {
    e.preventDefault();
    if (!newExam.name || !newExam.date) return;
    setSubmitting(true);
    setError('');
    try {
      await schoolService.createExam({
        name: newExam.name,
        class_id: newExam.class_id ? parseInt(newExam.class_id) : null,
        exam_date: newExam.date,
        max_marks: parseFloat(newExam.total_marks)
      });
      setIsAddExamOpen(false);
      setNewExam({ name: '', class_id: '', term: 'Term 1', date: '', total_marks: 100 });
      loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create exam.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Examinations</h2>
          <p className="text-text-secondary text-sm mt-1">Create exams, enter marks, calculate grades, and publish results.</p>
        </div>
        {!isReadOnly && (
          <Button className="flex items-center gap-2" onClick={() => setIsAddExamOpen(true)}>
            <Plus className="h-4 w-4" /> Create Exam
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', value: upcomingCount, color: 'text-blue-600' },
          { label: 'Completed', value: completedCount, color: 'text-zinc-600' },
          { label: 'Published', value: 0, color: 'text-green-600' },
        ].map(c => (
          <Card key={c.label} className="shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{c.label}</p>
              <p className={`text-3xl font-black mt-1 font-display ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam Name</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total Marks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exams.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No exams scheduled.</TableCell></TableRow>
            ) : exams.map(e => {
              const status = getExamStatus(e.exam_date);
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-semibold text-text-primary">{e.name}</TableCell>
                  <TableCell className="text-xs text-text-secondary">{e.class_name || '-'}</TableCell>
                  <TableCell className="text-xs text-text-secondary">Term 1</TableCell>
                  <TableCell className="text-xs font-mono text-text-muted">{e.exam_date || '-'}</TableCell>
                  <TableCell className="text-xs font-mono">{e.max_marks || e.total_marks || '-'}</TableCell>
                  <TableCell>{statusBadge(status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-7 px-2 text-xs">Marks</Button>
                      {status === 'Completed' && (
                        <Button variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-200">Publish</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Grade Scale */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Grading Scale</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead>Marks Range</TableHead><TableHead>Grade Points</TableHead><TableHead>Remark</TableHead></TableRow></TableHeader>
          <TableBody>
            {[
              { g: 'A+', r: '90–100', p: '10', rem: 'Outstanding' },
              { g: 'A', r: '80–89', p: '9', rem: 'Excellent' },
              { g: 'B+', r: '70–79', p: '8', rem: 'Very Good' },
              { g: 'B', r: '60–69', p: '7', rem: 'Good' },
              { g: 'C', r: '50–59', p: '6', rem: 'Average' },
              { g: 'D', r: '33–49', p: '5', rem: 'Pass' },
              { g: 'E', r: '0–32', p: '0', rem: 'Fail' },
            ].map(row => (
              <TableRow key={row.g}>
                <TableCell className="font-black text-primary">{row.g}</TableCell>
                <TableCell className="font-mono text-xs">{row.r}</TableCell>
                <TableCell className="font-mono text-xs">{row.p}</TableCell>
                <TableCell className="text-xs text-text-secondary">{row.rem}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create Exam Dialog */}
      <Dialog isOpen={isAddExamOpen} onClose={() => setIsAddExamOpen(false)}
        title="Create Examination" description="Schedule a new exam for a class."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddExamOpen(false)}>Cancel</Button>
          <Button onClick={handleAddExam} disabled={submitting}>{submitting ? 'Creating...' : 'Create Exam'}</Button>
        </>}>
        <form onSubmit={handleAddExam} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Exam Name</label>
            <Input placeholder="e.g. Unit Test 2" value={newExam.name} onChange={e => setNewExam(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              {classes.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                  No classes defined. Create classes in Academic page first.
                </div>
              ) : (
                <Select value={newExam.class_id} onChange={e => setNewExam(p => ({ ...p, class_id: e.target.value }))} required>
                  <option value="">Select class...</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Term</label>
              <Select value={newExam.term} onChange={e => setNewExam(p => ({ ...p, term: e.target.value }))}>
                <option>Term 1</option><option>Term 2</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Exam Date</label>
              <Input type="date" value={newExam.date} onChange={e => setNewExam(p => ({ ...p, date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Total Marks</label>
              <Input type="number" placeholder="100" value={newExam.total_marks} onChange={e => setNewExam(p => ({ ...p, total_marks: parseInt(e.target.value) || 100 }))} />
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
