import React, { useState } from 'react';
import { ClipboardList, Clock, Upload, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Dialog } from '../../../common/ui/dialog';

const subjectColors = {
  'Mathematics': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Physics': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Chemistry': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'English': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'History': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const getSubjectColor = (subject) =>
  subjectColors[subject] || 'bg-zinc-100 text-zinc-700 dark:text-zinc-400';

const statusConfig = {
  pending: { label: 'PENDING', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  submitted: { label: 'Submitted', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  graded: { label: 'Graded', cls: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  overdue: { label: 'Overdue', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

export default function AssignmentsPage({ assignments }) {
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submitFile, setSubmitFile] = useState(null);
  const [submitNote, setSubmitNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  const openSubmitDialog = (assignment) => {
    setSelectedAssignment(assignment);
    setSubmitFile(null);
    setSubmitNote('');
    setSubmitDone(false);
    setSubmitDialogOpen(true);
  };

  const handleSubmitAssignment = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitDone(true);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Assignments</h2>
        <p className="text-text-secondary text-sm mt-1">View, submit, and track your homework and assignments.</p>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All', 'PENDING', 'Submitted', 'Graded', 'Overdue'].map(f => (
          <button
            key={f}
            className="px-3 py-1.5 rounded-full text-xs font-bold border border-border bg-surface text-text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-text-primary transition-all"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Assignments List */}
      <div className="space-y-4">
        {assignments.map(hw => {
          const cfg = statusConfig[hw.status];
          const canSubmit = hw.status === 'pending' || hw.status === 'overdue';
          return (
            <div key={hw.id} className="p-5 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg flex-shrink-0 ${getSubjectColor(hw.subject)}`}>
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-text-primary">{hw.title}</h4>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">{hw.subject} · {hw.teacher}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="h-3 w-3 text-text-muted" />
                      <span className={`text-[11px] font-semibold ${hw.status === 'overdue' ? 'text-red-600' : 'text-text-muted'}`}>
                        Due {hw.dueDate}
                      </span>
                    </div>
                    {hw.status === 'graded' && (
                      <p className="text-[11px] font-bold text-emerald-600 mt-1">
                        Grade received: <span className="text-lg">{hw.grade}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  {canSubmit && (
                    <Button
                      onClick={() => openSubmitDialog(hw)}
                      className="text-xs font-bold flex items-center gap-1.5"
                    >
                      <Upload className="h-3.5 w-3.5" /> Submit
                    </Button>
                  )}
                  {hw.status === 'submitted' && (
                    <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Awaiting review
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Assignment History */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Submission History</h3>
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold text-text-primary py-3.5">Organic Compounds Lab Report</TableCell>
                <TableCell className="text-xs text-text-secondary">Chemistry</TableCell>
                <TableCell className="text-xs text-text-muted">2026-06-18</TableCell>
                <TableCell><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Graded</span></TableCell>
                <TableCell className="font-bold text-emerald-600">A</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold text-text-primary py-3.5">Motion Graphs Analysis</TableCell>
                <TableCell className="text-xs text-text-secondary">Physics</TableCell>
                <TableCell className="text-xs text-text-muted">2026-06-10</TableCell>
                <TableCell><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Graded</span></TableCell>
                <TableCell className="font-bold text-blue-600">B+</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold text-text-primary py-3.5">Algebra Problem Set 2</TableCell>
                <TableCell className="text-xs text-text-secondary">Mathematics</TableCell>
                <TableCell className="text-xs text-text-muted">2026-06-03</TableCell>
                <TableCell><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Graded</span></TableCell>
                <TableCell className="font-bold text-emerald-600">A+</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Submit Assignment Dialog */}
      <Dialog
        isOpen={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        title="Submit Assignment"
        description={selectedAssignment ? `${selectedAssignment.title} — ${selectedAssignment.subject}` : ''}
        footer={
          submitDone ? (
            <Button onClick={() => setSubmitDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitAssignment} disabled={submitting}>
                {submitting ? 'Uploading...' : 'Submit Assignment'}
              </Button>
            </>
          )
        }
      >
        {submitDone ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Assignment Submitted</h3>
            <p className="text-sm text-text-secondary">Your submission has been recorded and sent to the teacher for review.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitAssignment} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Upload File</label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-6 w-6 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-semibold text-text-secondary">
                  {submitFile ? submitFile.name : 'Click to upload PDF, DOCX, or image'}
                </p>
                <p className="text-[11px] text-text-muted mt-1">Max file size: 10 MB</p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  className="hidden"
                  onChange={e => setSubmitFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Note to Teacher (optional)</label>
              <textarea
                value={submitNote}
                onChange={e => setSubmitNote(e.target.value)}
                rows={3}
                placeholder="Any note about your submission..."
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg resize-none text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
