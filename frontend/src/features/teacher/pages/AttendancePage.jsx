import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2, X, Send, Search, Loader2, AlertTriangle, Clock, FileCheck, Info,
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { teacherService } from '../../../common/services/teacherService';
import { useUnsavedChanges } from '../../../common/hooks/useUnsavedChanges';
import { SectionHeader, Label, FormSelect, formatDate } from '../shared';

function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Present/absent alone doesn't match how schools actually record attendance,
 * so late and excused are first-class states. `countsPresent` drives the
 * present total, which is what attendance percentage is derived from.
 */
const STATUSES = {
  present: { label: 'Present', short: 'P', countsPresent: true,  icon: CheckCircle2, dot: 'bg-success-500',  text: 'text-success-700 dark:text-success-300', row: '' },
  absent:  { label: 'Absent',  short: 'A', countsPresent: false, icon: X,            dot: 'bg-danger-500',   text: 'text-danger-700 dark:text-danger-300',   row: 'bg-danger-50/60 dark:bg-danger-500/10' },
  late:    { label: 'Late',    short: 'L', countsPresent: true,  icon: Clock,        dot: 'bg-warning-500',  text: 'text-warning-700 dark:text-warning-300', row: 'bg-warning-50/50 dark:bg-warning-500/10' },
  excused: { label: 'Excused', short: 'E', countsPresent: false, icon: FileCheck,    dot: 'bg-info-500',     text: 'text-info-700 dark:text-info-300',       row: 'bg-info-50/50 dark:bg-info-500/10' },
};
const STATUS_ORDER = ['present', 'absent', 'late', 'excused'];

export default function AttendancePage({ classes, allStudents }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [date, setDate] = useState(today());
  const [attendance, setAttendance] = useState({});
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('mark');

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [existing, setExisting] = useState({ marked: false });
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [query, setQuery] = useState('');
  const [absentOnly, setAbsentOnly] = useState(false);

  const students = allStudents[selectedClass] || [];
  const isFuture = date > today();

  useUnsavedChanges(isDirty, 'Attendance for this class is not submitted yet. Leave and lose it?');

  /**
   * Load whatever is already recorded for this class AND date.
   *
   * Previously this effect depended on [selectedClass] only, so changing the
   * date left the previous day's toggles on screen and never fetched existing
   * records — submitting then overwrote real attendance with defaults.
   */
  useEffect(() => {
    if (!selectedClass || !date) return;
    let cancelled = false;

    setLoadingExisting(true);
    setLoadError('');
    setSubmitted(false);
    setSubmitError('');

    teacherService
      .getAttendanceForDate(selectedClass, date)
      .then((res) => {
        if (cancelled) return;
        setExisting(res);
        const next = {};
        students.forEach((s) => {
          // Default to present (the common case), but never override a real record.
          next[s.id] = res.attendance?.[s.id] || 'present';
        });
        setAttendance(next);
        setIsDirty(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err?.message || 'Could not load existing attendance for this date.');
        setExisting({ marked: false });
        setAttendance({});
      })
      .finally(() => { if (!cancelled) setLoadingExisting(false); });

    return () => { cancelled = true; };
  }, [selectedClass, date, students.length]);

  useEffect(() => {
    teacherService.getAttendanceHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  /** Cycle through the four states on tap/click. */
  const cycle = useCallback((id) => {
    setAttendance((prev) => {
      const idx = STATUS_ORDER.indexOf(prev[id] || 'present');
      return { ...prev, [id]: STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] };
    });
    setIsDirty(true);
  }, []);

  const setAll = (status) => {
    const next = {};
    students.forEach((s) => { next[s.id] = status; });
    setAttendance(next);
    setIsDirty(true);
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    students.forEach((s) => { c[attendance[s.id] || 'present'] += 1; });
    return c;
  }, [students, attendance]);

  const presentTotal = counts.present + counts.late;

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (absentOnly && STATUSES[attendance[s.id] || 'present'].countsPresent) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || String(s.rollNo).toLowerCase().includes(q);
    });
  }, [students, query, absentOnly, attendance]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      await teacherService.submitAttendance({ classId: selectedClass, date, attendance });
      // Only now is it true.
      setSubmitted(true);
      setIsDirty(false);
      setExisting({ marked: true, markedAt: new Date().toISOString() });
    } catch (err) {
      setSubmitError(
        err?.message || 'Could not save attendance. Your marks are still on this page — check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const className = classes.find((c) => c.id === selectedClass)?.name;

  return (
    <div className="space-y-5">
      <SectionHeader title="Attendance" description="Mark daily attendance and review history" />

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Attendance views">
        {[{ id: 'mark', label: 'Mark Attendance' }, { id: 'history', label: 'Attendance History' }].map((t) => (
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

      {tab === 'mark' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[160px]">
                  <Label htmlFor="att-class">Class</Label>
                  <FormSelect id="att-class" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </FormSelect>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label htmlFor="att-date">Date</Label>
                  <Input
                    id="att-date"
                    type="date"
                    value={date}
                    max={today()}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  {STATUS_ORDER.map((k) => (
                    <span key={k} className={`font-semibold ${STATUSES[k].text}`}>
                      {counts[k]} {STATUSES[k].label}
                    </span>
                  ))}
                </div>
              </div>

              {/* State of this date — the screen used to give no indication at all */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
                {loadingExisting ? (
                  <span className="flex items-center gap-1.5 text-text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking existing records…
                  </span>
                ) : existing.marked ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-info-50 px-2.5 py-1 font-medium text-info-700 dark:bg-info-500/10 dark:text-info-300">
                    <Info className="h-3.5 w-3.5" />
                    Already marked{existing.markedAt ? ` at ${new Date(existing.markedAt).toLocaleTimeString()}` : ''}
                    {existing.markedBy ? ` by ${existing.markedBy}` : ''} — you are editing it
                  </span>
                ) : (
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-text-secondary">
                    Not yet marked for this date
                  </span>
                )}
                {isFuture && (
                  <span className="flex items-center gap-1.5 text-warning-700 dark:text-warning-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> Future date
                  </span>
                )}
              </div>

              {loadError && (
                <p className="mt-2 text-xs font-medium text-danger-700 dark:text-danger-300">{loadError}</p>
              )}
            </CardContent>
          </Card>

          {submitted ? (
            <Card>
              <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-10 w-10 text-success-500" />
                <p className="font-semibold text-text-primary">Attendance Submitted</p>
                <p className="text-sm text-text-muted">
                  {presentTotal} present ({counts.late} late), {counts.absent} absent, {counts.excused} excused for {className} on {formatDate(date)}.
                </p>
                <Button size="sm" variant="outline" onClick={() => setSubmitted(false)}>Edit Again</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">{className} — {formatDate(date)}</CardTitle>
                  <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
                    {STATUS_ORDER.map((k) => (
                      <span key={k} className="flex items-center gap-1.5">
                        <span className={`h-3 w-3 rounded-full inline-block ${STATUSES[k].dot}`} /> {STATUSES[k].label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Search + bulk actions — essential above ~30 students */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name or roll number…"
                      aria-label="Search students"
                      className="pl-8 h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={absentOnly ? 'default' : 'secondary'}
                    onClick={() => setAbsentOnly((v) => !v)}
                    aria-pressed={absentOnly}
                  >
                    Not present only
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setAll('present')}>All present</Button>
                  <Button size="sm" variant="secondary" onClick={() => setAll('absent')}>All absent</Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loadingExisting ? (
                  <div className="divide-y divide-border/40">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-6 py-3">
                        <div className="h-4 w-6 rounded skeleton-loader" />
                        <div className="h-4 w-10 rounded skeleton-loader" />
                        <div className="h-4 flex-1 rounded skeleton-loader" />
                        <div className="h-6 w-6 rounded-full skeleton-loader" />
                      </div>
                    ))}
                  </div>
                ) : visibleStudents.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-semibold text-text-primary">
                      {students.length === 0 ? 'No students in this class' : 'No students match your filters'}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {students.length === 0
                        ? 'Ask your school admin to enrol students into this class.'
                        : 'Try a different name, or clear the filters.'}
                    </p>
                    {students.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => { setQuery(''); setAbsentOnly(false); }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {visibleStudents.map((s) => {
                      const status = attendance[s.id] || 'present';
                      const cfg = STATUSES[status];
                      const Icon = cfg.icon;
                      const index = students.findIndex((x) => x.id === s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => cycle(s.id)}
                          aria-label={`${s.name}, currently ${cfg.label}. Activate to change.`}
                          className={`flex w-full items-center gap-4 px-6 py-3 text-left transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 hover:bg-secondary/50 ${cfg.row}`}
                        >
                          <span className="text-xs text-text-muted w-7 tabular-nums flex-shrink-0">{index + 1}</span>
                          <span className="font-mono text-xs text-text-muted w-10 flex-shrink-0">{s.rollNo}</span>
                          <span className="flex-1 text-sm font-medium text-text-primary truncate">{s.name}</span>
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-white ${cfg.dot}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className={`text-xs font-semibold w-16 text-right ${cfg.text}`}>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-text-muted">
                    Click a row to cycle Present → Absent → Late → Excused
                    {visibleStudents.length !== students.length &&
                      ` · showing ${visibleStudents.length} of ${students.length}`}
                  </p>
                  <div className="flex items-center gap-3">
                    {submitError && (
                      <span className="text-xs font-medium text-danger-700 dark:text-danger-300" role="alert">
                        {submitError}
                      </span>
                    )}
                    <Button onClick={handleSubmit} disabled={submitting || students.length === 0}>
                      {submitting
                        ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5 mr-1.5" />}
                      {submitting ? 'Submitting…' : existing.marked ? 'Update Attendance' : 'Submit Attendance'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance History</CardTitle>
            <CardDescription>Recent attendance records across all classes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Absent</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <p className="text-sm font-semibold text-text-primary">No attendance recorded yet</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Records appear here once you submit attendance for a class.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((r, i) => {
                    const rate = r.total ? Math.round((r.present / r.total) * 100) : 0;
                    return (
                      <TableRow key={`${r.date}-${r.class}-${i}`}>
                        <TableCell className="text-xs tabular-nums">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-medium text-text-primary">{r.class}</TableCell>
                        <TableCell className="text-right text-success-700 dark:text-success-300 font-semibold tabular-nums">{r.present}</TableCell>
                        <TableCell className="text-right text-danger-700 dark:text-danger-300 font-semibold tabular-nums">{r.absent}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{rate}%</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
