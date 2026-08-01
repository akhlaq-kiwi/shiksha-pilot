import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, AlertTriangle, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { useToast } from '../../../common/components/Toast';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { teacherService } from '../../../common/services/teacherService';
import { useUnsavedChanges } from '../../../common/hooks/useUnsavedChanges';
import { useDraft } from '../../../common/hooks/useDraft';
import { SectionHeader, Label, FormSelect } from '../shared';

/** Grade bands as a share of the exam total, so they work for a 25-, 50- or 100-mark paper. */
const GRADE_BANDS = [
  { label: 'A+', minPct: 90, tone: 'text-success-700 dark:text-success-300', bg: 'bg-success-50 dark:bg-success-500/10' },
  { label: 'A',  minPct: 80, tone: 'text-success-700 dark:text-success-300', bg: 'bg-success-50 dark:bg-success-500/10' },
  { label: 'B',  minPct: 70, tone: 'text-info-700 dark:text-info-300',       bg: 'bg-info-50 dark:bg-info-500/10' },
  { label: 'C',  minPct: 60, tone: 'text-warning-700 dark:text-warning-300', bg: 'bg-warning-50 dark:bg-warning-500/10' },
  { label: 'D',  minPct: 50, tone: 'text-warning-700 dark:text-warning-300', bg: 'bg-warning-50 dark:bg-warning-500/10' },
  { label: 'F',  minPct: 0,  tone: 'text-danger-700 dark:text-danger-300',   bg: 'bg-danger-50 dark:bg-danger-500/10' },
];

const NOT_ENTERED = { label: '—', tone: 'text-text-muted', bg: 'bg-surface' };

export default function ExaminationPage({ classes, exams, allStudents }) {
  const toast = useToast();
  const [selectedExam, setSelectedExam] = useState(exams[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [marks, setMarks] = useState({});
  const [remarks, setRemarks] = useState({});
  const [tab, setTab] = useState('entry'); // entry | gradebook
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const inputRefs = useRef({});

  const students = allStudents[selectedClass] || [];
  const exam = exams.find((e) => e.id === selectedExam);

  /**
   * The exam's real maximum. Previously hardcoded to 100, which produced wrong
   * grades and wrong percentages for every paper that wasn't out of 100.
   */
  const totalMarks = Number(exam?.totalMarks ?? exam?.total_marks ?? exam?.maxMarks ?? 100) || 100;

  const draftKey = `marks:${selectedExam}:${selectedClass}`;
  const draftValue = useMemo(() => ({ marks, remarks }), [marks, remarks]);
  const { draft, hasDraft, draftSavedAt, clearDraft } = useDraft(draftKey, draftValue, { enabled: isDirty });

  useUnsavedChanges(isDirty, 'Marks you have entered are not saved yet. Leave and lose them?');

  /**
   * Start empty. This page previously seeded every student with
   * `Math.random() * 31 + 60`, so a partially completed class saved fabricated
   * marks for everyone the teacher never reached.
   */
  useEffect(() => {
    const blankMarks = {};
    const blankRemarks = {};
    students.forEach((s) => { blankMarks[s.id] = ''; blankRemarks[s.id] = ''; });
    setMarks(blankMarks);
    setRemarks(blankRemarks);
    setIsDirty(false);
    setSavedAt(null);
  }, [selectedClass, selectedExam]);

  const restoreDraft = () => {
    if (!draft?.data) return;
    setMarks(draft.data.marks || {});
    setRemarks(draft.data.remarks || {});
    setIsDirty(true);
    toast.info('Your unsaved marks have been restored.', 'Draft restored');
  };

  const entered = students.filter((s) => marks[s.id] !== '' && marks[s.id] != null);
  const missing = students.length - entered.length;

  const invalid = students.filter((s) => {
    const raw = marks[s.id];
    if (raw === '' || raw == null) return false;
    const n = Number(raw);
    return Number.isNaN(n) || n < 0 || n > totalMarks;
  });

  const classAvg = entered.length
    ? Math.round(entered.reduce((sum, s) => sum + Number(marks[s.id] || 0), 0) / entered.length)
    : null;

  const gradeFor = (raw) => {
    if (raw === '' || raw == null) return NOT_ENTERED;
    const pct = (Number(raw) / totalMarks) * 100;
    return GRADE_BANDS.find((b) => pct >= b.minPct) || NOT_ENTERED;
  };

  const setMark = (id, value) => {
    setMarks((prev) => ({ ...prev, [id]: value }));
    setIsDirty(true);
  };

  /** Keyboard-first entry: Enter / ↓ move down, ↑ moves up — no mouse needed. */
  const handleKeyDown = useCallback((e, index) => {
    const move = (delta) => {
      const next = students[index + delta];
      if (!next) return;
      const el = inputRefs.current[next.id];
      if (el) { el.focus(); el.select?.(); }
      e.preventDefault();
    };
    if (e.key === 'Enter' || e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
  }, [students]);

  const handleSave = async () => {
    if (invalid.length > 0) {
      toast.error(
        `${invalid.length} score${invalid.length > 1 ? 's are' : ' is'} outside 0–${totalMarks}. Correct them before saving.`,
        'Cannot save'
      );
      return;
    }
    if (entered.length === 0) {
      toast.warning('Enter at least one score before saving.', 'Nothing to save');
      return;
    }
    if (missing > 0) {
      const ok = window.confirm(
        `${missing} of ${students.length} students have no score yet.\n\n` +
        `Only the ${entered.length} scores you entered will be saved. Continue?`
      );
      if (!ok) return;
    }

    // Send only what was actually entered — never invent values for blank rows.
    const payloadMarks = {};
    const payloadRemarks = {};
    entered.forEach((s) => {
      payloadMarks[s.id] = Number(marks[s.id]);
      if (remarks[s.id]) payloadRemarks[s.id] = remarks[s.id];
    });

    setSaving(true);
    try {
      await teacherService.submitMarks({
        examId: selectedExam,
        classId: selectedClass,
        totalMarks,
        marks: payloadMarks,
        remarks: payloadRemarks,
      });
      setIsDirty(false);
      setSavedAt(new Date());
      clearDraft();
      toast.success(`${entered.length} score${entered.length > 1 ? 's' : ''} saved.`, 'Saved');
    } catch (err) {
      toast.error(
        err?.message || 'Could not reach the server. Your entries are kept on this page — try again.',
        'Save failed'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Examination" description="Enter marks, view grade book, and add student remarks" />

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Examination views">
        {[{ id: 'entry', label: 'Marks Entry' }, { id: 'gradebook', label: 'Grade Book' }].map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Selectors */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="exam-select">Examination</Label>
              <FormSelect id="exam-select" value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
                {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </FormSelect>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label htmlFor="class-select">Class</Label>
              <FormSelect id="class-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </div>
            <div className="text-sm">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Class Average</p>
              <p className="text-xl font-semibold text-text-primary tabular-nums">
                {classAvg == null ? '—' : classAvg}
                <span className="text-xs text-text-muted ml-1">/ {totalMarks}</span>
              </p>
            </div>
            <div className="text-sm">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Entered</p>
              <p className="text-xl font-semibold text-text-primary tabular-nums">
                {entered.length}<span className="text-xs text-text-muted ml-1">/ {students.length}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Draft restore prompt */}
      {hasDraft && !isDirty && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info-200 bg-info-50 px-4 py-3 dark:border-info-500/30 dark:bg-info-500/10">
          <p className="text-sm text-text-secondary">
            You have unsaved marks for this exam and class from{' '}
            {new Date(draft.savedAt).toLocaleString()}.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={clearDraft}>Discard</Button>
            <Button size="sm" onClick={restoreDraft}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore
            </Button>
          </div>
        </div>
      )}

      {tab === 'entry' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Marks Entry</CardTitle>
                <CardDescription>
                  {exam?.name} — {classes.find((c) => c.id === selectedClass)?.name} · out of {totalMarks}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {/* Visible save state — replaces fire-and-forget saving */}
                <span className="text-xs text-text-muted" aria-live="polite">
                  {saving ? 'Saving…'
                    : savedAt ? `All changes saved · ${savedAt.toLocaleTimeString()}`
                    : isDirty ? (draftSavedAt ? 'Draft kept on this device' : 'Unsaved changes')
                    : ''}
                </span>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  {saving ? 'Saving…' : 'Save Marks'}
                </Button>
              </div>
            </div>

            {missing > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-700 dark:text-warning-300">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {missing} student{missing > 1 ? 's' : ''} not yet entered — blank rows are never saved with a guessed score.
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Score / {totalMarks}</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, i) => {
                  const raw = marks[s.id] ?? '';
                  const grade = gradeFor(raw);
                  const n = Number(raw);
                  const isInvalid = raw !== '' && (Number.isNaN(n) || n < 0 || n > totalMarks);
                  const isBlank = raw === '';
                  return (
                    <TableRow key={s.id} className={isBlank ? 'bg-secondary/30' : undefined}>
                      <TableCell className="text-text-muted tabular-nums text-xs">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{s.rollNo}</TableCell>
                      <TableCell className="font-medium text-text-primary">{s.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            ref={(el) => { inputRefs.current[s.id] = el; }}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={totalMarks}
                            value={raw}
                            placeholder="—"
                            aria-label={`Score for ${s.name}, out of ${totalMarks}`}
                            aria-invalid={isInvalid || undefined}
                            onChange={(e) => setMark(s.id, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, i)}
                            className={`h-8 w-20 text-center tabular-nums ${
                              isInvalid ? 'border-danger-500 focus-visible:ring-danger-500/40' : ''
                            }`}
                          />
                          {isInvalid && (
                            <span className="text-[11px] font-medium text-danger-600 dark:text-danger-400">
                              0–{totalMarks}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-semibold text-sm tabular-nums ${grade.tone}`}>{grade.label}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={remarks[s.id] || ''}
                          aria-label={`Remarks for ${s.name}`}
                          onChange={(e) => {
                            setRemarks((prev) => ({ ...prev, [s.id]: e.target.value }));
                            setIsDirty(true);
                          }}
                          placeholder="Optional…"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="px-6 py-3 border-t border-border">
              <p className="text-xs text-text-muted">
                Press <kbd className="px-1 py-0.5 rounded border border-border bg-secondary text-[10px]">Enter</kbd> or{' '}
                <kbd className="px-1 py-0.5 rounded border border-border bg-secondary text-[10px]">↓</kbd> to move to the next student.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'gradebook' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Book</CardTitle>
            <CardDescription>
              Score summary and grade distribution · {entered.length} of {students.length} entered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {entered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-text-muted" />
                <p className="text-sm font-semibold text-text-primary">No marks entered yet</p>
                <p className="text-xs text-text-muted">Enter scores in the Marks Entry tab to see the distribution.</p>
              </div>
            ) : (
              <>
                {/* Grade distribution — counts only students with a real score */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {GRADE_BANDS.map((band, idx) => {
                    const upperPct = idx === 0 ? Infinity : GRADE_BANDS[idx - 1].minPct;
                    const count = entered.filter((s) => {
                      const pct = (Number(marks[s.id]) / totalMarks) * 100;
                      return pct >= band.minPct && pct < upperPct;
                    }).length;
                    return (
                      <div key={band.label} className={`rounded-lg ${band.bg} p-3 text-center`}>
                        <p className={`text-xl font-semibold ${band.tone} tabular-nums`}>{count}</p>
                        <p className={`text-xs font-semibold ${band.tone} mt-0.5`}>Grade {band.label}</p>
                      </div>
                    );
                  })}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...students]
                      .sort((a, b) => {
                        const av = marks[a.id] === '' || marks[a.id] == null ? -1 : Number(marks[a.id]);
                        const bv = marks[b.id] === '' || marks[b.id] == null ? -1 : Number(marks[b.id]);
                        return bv - av;
                      })
                      .map((s, i) => {
                        const raw = marks[s.id] ?? '';
                        const isBlank = raw === '';
                        const grade = gradeFor(raw);
                        const pct = isBlank ? null : Math.round((Number(raw) / totalMarks) * 100);
                        return (
                          <TableRow key={s.id} className={isBlank ? 'bg-secondary/30' : undefined}>
                            <TableCell className="tabular-nums text-text-muted text-xs">{i + 1}</TableCell>
                            <TableCell className="font-medium text-text-primary">{s.name}</TableCell>
                            <TableCell className="tabular-nums font-semibold">
                              {isBlank ? <span className="text-text-muted font-normal">Not entered</span> : raw}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">{pct == null ? '—' : `${pct}%`}</TableCell>
                            <TableCell><span className={`font-semibold ${grade.tone}`}>{grade.label}</span></TableCell>
                            <TableCell className="text-xs text-text-muted">{remarks[s.id] || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
