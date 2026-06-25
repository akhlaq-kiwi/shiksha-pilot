import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  FileText,
  Award,
  FolderOpen,
  Clock,
  Users,
  CheckSquare,
  ChevronRight,
  Plus,
  Search,
  Upload,
  Link2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Calendar,
  Star,
  TrendingUp,
  X,
  Save,
  Send,
  Eye,
  Edit3,
  Download,
  Video,
  File,
  StickyNote,
} from 'lucide-react';
import { Button } from '../../common/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../common/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '../../common/ui/table';
import { Input } from '../../common/ui/input';
import { teacherService } from '../../common/services/teacherService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
  const map = {
    active:    { label: 'ACTIVE',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    graded:    { label: 'Graded',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    draft:     { label: 'Draft',     cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
    completed: { label: 'Completed', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
    upcoming:  { label: 'Upcoming',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    break:     { label: 'Break',     cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  };
  const cfg = map[status] || { label: status, cls: 'bg-zinc-100 text-zinc-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }) {
  const map = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-emerald-500' };
  return <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${map[priority] || 'bg-zinc-400'}`} />;
}

function SectionHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">{title}</h2>
        {description && <p className="text-sm text-text-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent || 'bg-primary/10 text-primary'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary font-display tabular-nums">{value}</p>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mt-0.5">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </div>
    </Card>
  );
}

// ─── Dialog shell ────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(9,9,11,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-bold text-text-primary text-base">{title}</h3>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:bg-background hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function FormSelect({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`w-full h-9 rounded-md border border-border bg-background text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-border bg-background text-text-primary text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors resize-none placeholder:text-text-muted"
    />
  );
}

// ─── Nav sidebar items ────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',        icon: LayoutDashboard },
  { id: 'classes',     label: 'My Classes',        icon: BookOpen },
  { id: 'attendance',  label: 'Attendance',        icon: ClipboardCheck },
  { id: 'assignments', label: 'Assignments',       icon: FileText },
  { id: 'examination', label: 'Examination',       icon: Award },
  { id: 'materials',   label: 'Learning Materials',icon: FolderOpen },
];

// ─── PAGE: Dashboard ─────────────────────────────────────────────────────────

function DashboardPage({ schedule, tasks, upcomingExams, classes }) {
  return (
    <div className="space-y-7">
      <SectionHeader
        title="Good morning, Ms. Khalid"
        description={`Today is ${new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={BookOpen}      label="Classes"       value={classes.length}         sub="Assigned this term"         accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={Users}         label="Students"      value={classes.reduce((a, c) => a + (c.students || 0), 0)} sub="Total enrolled"           accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
        <StatCard icon={CheckSquare}   label="Pending Tasks" value={tasks.length}           sub="Require attention"          accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard icon={Calendar}      label="Exam Days"     value={upcomingExams.length}   sub="Upcoming examinations"      accent="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Today's Schedule</CardTitle>
            </div>
            <CardDescription>Period-by-period class overview</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {schedule.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 px-6 py-3 transition-colors ${
                    p.status === 'active' ? 'bg-primary/5' : p.status === 'break' ? 'bg-background/40' : ''
                  }`}
                >
                  <div className="w-24 flex-shrink-0">
                    <p className="text-[11px] font-bold text-text-muted tabular-nums">{p.time}</p>
                  </div>
                  {p.status === 'break' ? (
                    <p className="text-xs text-text-muted italic">{p.subject}</p>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{p.class}</p>
                        <p className="text-xs text-text-muted">{p.subject} · {p.room}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* Pending tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Pending Tasks</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <PriorityDot priority={t.priority} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary leading-snug">{t.task}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Due: {t.due}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming exams */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Upcoming Exams</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {upcomingExams.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary leading-snug">{e.name}</p>
                    <p className="text-[11px] text-text-muted">{e.class}</p>
                  </div>
                  <span className="flex-shrink-0 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                    {e.daysLeft}d
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: Classes ────────────────────────────────────────────────────────────

function ClassesPage({ classes, allStudents }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [tab, setTab] = useState('students'); // students | plans | notes
  const [noteText, setNoteText] = useState('');
  const [planText, setPlanText] = useState('');

  const students = allStudents[selectedClass] || [];

  return (
    <div className="space-y-5">
      <SectionHeader title="My Classes" description="Student roster, lesson plans, and class notes" />

      {/* Class selector */}
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedClass(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              selectedClass === c.id
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-text-secondary border-border hover:border-primary/40 hover:text-text-primary'
            }`}
          >
            {c.name}
            <span className="ml-2 text-[11px] opacity-70">{c.students} students</span>
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: 'students', label: 'Student List' },
          { id: 'plans',    label: 'Lesson Plans' },
          { id: 'notes',    label: 'Class Notes' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'students' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {classes.find((c) => c.id === selectedClass)?.name} — Student Roster
            </CardTitle>
            <CardDescription>{students.length} students enrolled</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Roll No.</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-text-muted tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">{s.rollNo}</TableCell>
                    <TableCell className="font-medium text-text-primary">{s.name}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        s.gender === 'F'
                          ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                      }`}>
                        {s.gender === 'F' ? 'Female' : 'Male'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'plans' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lesson Plans</CardTitle>
            <CardDescription>Weekly lesson planning for {classes.find((c) => c.id === selectedClass)?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { week: 'Week 1 (Jun 2–6)',   topic: 'Introduction to Quadratic Equations',   status: 'completed' },
              { week: 'Week 2 (Jun 9–13)',  topic: 'Solving by Factorisation',               status: 'completed' },
              { week: 'Week 3 (Jun 16–20)', topic: 'Quadratic Formula & Discriminant',       status: 'completed' },
              { week: 'Week 4 (Jun 23–27)', topic: 'Word Problems & Applications',           status: 'active' },
              { week: 'Week 5 (Jun 30–4)',  topic: 'Revision & Mid-Unit Assessment',         status: 'upcoming' },
            ].map((row) => (
              <div key={row.week} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{row.topic}</p>
                  <p className="text-xs text-text-muted mt-0.5">{row.week}</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            ))}
            <div className="pt-2">
              <Label>Add Lesson Plan Note</Label>
              <Textarea value={planText} onChange={(e) => setPlanText(e.target.value)} placeholder="Describe the upcoming week's lesson objectives…" rows={3} />
              <Button size="sm" className="mt-3" onClick={() => setPlanText('')}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'notes' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Class Notes</CardTitle>
            <CardDescription>Private notes visible only to you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {[
                { date: '2026-06-24', text: 'Hassan and Bilal struggling with discriminant concept — pair them for next group exercise.' },
                { date: '2026-06-20', text: 'Overall class performed well in factorisation. Aisha showed excellent work — nominate for academic award.' },
                { date: '2026-06-15', text: 'Need to bring printed formula sheets next class. 60% of students don\'t have textbooks yet.' },
              ].map((n, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-4">
                  <p className="text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wide">{formatDate(n.date)}</p>
                  <p className="text-sm text-text-primary leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
            <div>
              <Label>New Note</Label>
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write a class note…" rows={3} />
              <Button size="sm" className="mt-3" onClick={() => setNoteText('')}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── PAGE: Attendance ────────────────────────────────────────────────────────

function AttendancePage({ classes, allStudents }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [date, setDate] = useState(today());
  const [attendance, setAttendance] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('mark');

  const students = allStudents[selectedClass] || [];

  useEffect(() => {
    // Init all present by default
    const init = {};
    students.forEach((s) => { init[s.id] = 'present'; });
    setAttendance(init);
    setSubmitted(false);
  }, [selectedClass]);

  useEffect(() => {
    teacherService.getAttendanceHistory().then(setHistory);
  }, []);

  const toggle = (id) => {
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === 'present' ? 'absent' : 'present' }));
  };

  const presentCount = Object.values(attendance).filter((v) => v === 'present').length;
  const absentCount = students.length - presentCount;

  const handleSubmit = async () => {
    await teacherService.submitAttendance({ classId: selectedClass, date, attendance });
    setSubmitted(true);
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Attendance" description="Mark daily attendance and review history" />

      <div className="flex gap-1 border-b border-border">
        {[{ id: 'mark', label: 'Mark Attendance' }, { id: 'history', label: 'Attendance History' }].map((t) => (
          <button
            key={t.id}
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
          {/* Controls */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[160px]">
                  <Label>Class</Label>
                  <FormSelect value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </FormSelect>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{presentCount} Present</span>
                  <span className="text-text-muted">/</span>
                  <span className="font-bold text-red-500">{absentCount} Absent</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {submitted ? (
            <Card>
              <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="font-bold text-text-primary">Attendance Submitted</p>
                <p className="text-sm text-text-muted">{presentCount} present, {absentCount} absent for {classes.find((c) => c.id === selectedClass)?.name} on {formatDate(date)}.</p>
                <Button size="sm" variant="outline" onClick={() => setSubmitted(false)}>Mark Again</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{classes.find((c) => c.id === selectedClass)?.name} — {formatDate(date)}</CardTitle>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" /> Present</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400 inline-block" /> Absent</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {students.map((s, i) => {
                    const isPresent = attendance[s.id] === 'present';
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggle(s.id)}
                        className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors select-none ${
                          isPresent ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/10' : 'bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      >
                        <span className="text-xs text-text-muted w-7 tabular-nums flex-shrink-0">{i + 1}</span>
                        <span className="font-mono text-xs text-text-muted w-10 flex-shrink-0">{s.rollNo}</span>
                        <span className="flex-1 text-sm font-medium text-text-primary">{s.name}</span>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          isPresent ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'
                        }`}>
                          {isPresent
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <X className="h-3.5 w-3.5" />}
                        </div>
                        <span className={`text-xs font-bold w-14 text-right ${isPresent ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                          {isPresent ? 'Present' : 'Absent'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-text-muted">Click a row to toggle presence</p>
                  <Button onClick={handleSubmit}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Submit Attendance
                  </Button>
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
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r, i) => {
                  const rate = Math.round((r.present / r.total) * 100);
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-xs tabular-nums">{formatDate(r.date)}</TableCell>
                      <TableCell className="font-medium text-text-primary">{r.class}</TableCell>
                      <TableCell className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{r.present}</TableCell>
                      <TableCell className="text-red-500 font-semibold tabular-nums">{r.absent}</TableCell>
                      <TableCell className="tabular-nums">{r.total}</TableCell>
                      <TableCell>
                        <span className={`font-bold text-xs tabular-nums ${rate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                          {rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── PAGE: Assignments ────────────────────────────────────────────────────────

function AssignmentsPage({ classes, assignments: initAssignments }) {
  const [assignments, setAssignments] = useState(initAssignments);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', class: '', dueDate: '', totalMarks: '', instructions: '' });

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.class.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    const newA = {
      id: 'a-' + Date.now(),
      ...form,
      totalMarks: Number(form.totalMarks) || 20,
      submissions: 0,
      total: classes.find((c) => c.name === form.class)?.students || 30,
      status: 'active',
    };
    teacherService.createAssignment(newA);
    setAssignments((prev) => [newA, ...prev]);
    setShowCreate(false);
    setForm({ title: '', class: '', dueDate: '', totalMarks: '', instructions: '' });
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Assignments"
        description="Create homework, track submissions, and grade work"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Assignment
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assignments…"
          className="pl-9 h-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold text-text-primary max-w-[220px]">
                    <p className="truncate">{a.title}</p>
                  </TableCell>
                  <TableCell className="text-xs">{a.class}</TableCell>
                  <TableCell className="text-xs tabular-nums">{formatDate(a.dueDate)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{a.totalMarks}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-text-primary">{a.submissions}</span>
                      <span className="text-text-muted text-xs">/ {a.total}</span>
                      <div className="h-1.5 w-16 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(a.submissions / a.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-background text-text-muted hover:text-text-primary transition-colors" title="View">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-background text-text-muted hover:text-text-primary transition-colors" title="Grade">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Assignment">
        <div className="space-y-4">
          <div>
            <Label>Assignment Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 5 Practice Problems" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Class</Label>
              <FormSelect value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </FormSelect>
            </div>
            <div>
              <Label>Total Marks</Label>
              <Input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} placeholder="20" className="h-9" />
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Describe what students should submit…" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!form.title || !form.class}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Assignment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── PAGE: Examination ────────────────────────────────────────────────────────

function ExaminationPage({ classes, exams, allStudents }) {
  const [selectedExam, setSelectedExam] = useState(exams[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [marks, setMarks] = useState({});
  const [remarks, setRemarks] = useState({});
  const [tab, setTab] = useState('entry'); // entry | gradebook

  const students = allStudents[selectedClass] || [];

  useEffect(() => {
    // Seed some mock marks
    const init = {};
    const initR = {};
    students.forEach((s) => {
      init[s.id] = Math.floor(Math.random() * 31) + 60; // 60–90
      initR[s.id] = '';
    });
    setMarks(init);
    setRemarks(initR);
  }, [selectedClass, selectedExam]);

  const totalMarks = 100;

  const getGrade = (score) => {
    if (score >= 90) return { label: 'A+', cls: 'text-emerald-600 dark:text-emerald-400' };
    if (score >= 80) return { label: 'A',  cls: 'text-emerald-600 dark:text-emerald-400' };
    if (score >= 70) return { label: 'B',  cls: 'text-blue-600 dark:text-blue-400' };
    if (score >= 60) return { label: 'C',  cls: 'text-amber-600 dark:text-amber-400' };
    if (score >= 50) return { label: 'D',  cls: 'text-orange-600 dark:text-orange-400' };
    return { label: 'F', cls: 'text-red-500' };
  };

  const classAvg = students.length
    ? Math.round(students.reduce((sum, s) => sum + (Number(marks[s.id]) || 0), 0) / students.length)
    : 0;

  const handleSave = () => {
    teacherService.submitMarks({ examId: selectedExam, classId: selectedClass, marks, remarks });
    alert('Marks saved successfully.');
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Examination" description="Enter marks, view grade book, and add student remarks" />

      <div className="flex gap-1 border-b border-border">
        {[{ id: 'entry', label: 'Marks Entry' }, { id: 'gradebook', label: 'Grade Book' }].map((t) => (
          <button
            key={t.id}
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
              <Label>Examination</Label>
              <FormSelect value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)}>
                {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </FormSelect>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label>Class</Label>
              <FormSelect value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FormSelect>
            </div>
            <div className="text-sm">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Class Average</p>
              <p className="text-xl font-bold text-text-primary tabular-nums">{classAvg}<span className="text-xs text-text-muted ml-1">/ {totalMarks}</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {tab === 'entry' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Marks Entry</CardTitle>
                <CardDescription>{exams.find((e) => e.id === selectedExam)?.name} — {classes.find((c) => c.id === selectedClass)?.name}</CardDescription>
              </div>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Marks
              </Button>
            </div>
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
                  const score = Number(marks[s.id]) || 0;
                  const grade = getGrade(score);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-text-muted tabular-nums text-xs">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs text-text-muted">{s.rollNo}</TableCell>
                      <TableCell className="font-medium text-text-primary">{s.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={totalMarks}
                          value={marks[s.id] ?? ''}
                          onChange={(e) => setMarks((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          className="h-8 w-20 text-center tabular-nums"
                        />
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold text-sm tabular-nums ${grade.cls}`}>{grade.label}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={remarks[s.id] || ''}
                          onChange={(e) => setRemarks((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="Optional…"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'gradebook' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Book</CardTitle>
            <CardDescription>Score summary and grade distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Grade distribution */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { grade: 'A+', min: 90, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { grade: 'A',  min: 80, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                { grade: 'B',  min: 70, color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20' },
                { grade: 'C',  min: 60, color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20' },
                { grade: 'D',  min: 50, color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-900/20' },
                { grade: 'F',  min: 0,  color: 'text-red-500',                           bg: 'bg-red-50 dark:bg-red-900/20' },
              ].map(({ grade, min, color, bg }) => {
                const max = grade === 'A+' ? 100 : grade === 'A' ? 89 : grade === 'B' ? 79 : grade === 'C' ? 69 : grade === 'D' ? 59 : 49;
                const count = students.filter((s) => {
                  const sc = Number(marks[s.id]) || 0;
                  return sc >= min && sc <= max;
                }).length;
                return (
                  <div key={grade} className={`rounded-lg ${bg} p-3 text-center`}>
                    <p className={`text-xl font-bold ${color} tabular-nums`}>{count}</p>
                    <p className={`text-xs font-semibold ${color} mt-0.5`}>Grade {grade}</p>
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
                  .sort((a, b) => (Number(marks[b.id]) || 0) - (Number(marks[a.id]) || 0))
                  .map((s, i) => {
                    const score = Number(marks[s.id]) || 0;
                    const pct = Math.round((score / totalMarks) * 100);
                    const grade = getGrade(score);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="tabular-nums text-text-muted text-xs">{i + 1}</TableCell>
                        <TableCell className="font-medium text-text-primary">{s.name}</TableCell>
                        <TableCell className="tabular-nums font-semibold">{score}</TableCell>
                        <TableCell className="tabular-nums text-xs">{pct}%</TableCell>
                        <TableCell><span className={`font-bold ${grade.cls}`}>{grade.label}</span></TableCell>
                        <TableCell className="text-xs text-text-muted">{remarks[s.id] || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── PAGE: Learning Materials ─────────────────────────────────────────────────

function MaterialsPage({ classes, materials: initMaterials }) {
  const [materials, setMaterials] = useState(initMaterials);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'notes', class: '', url: '', format: 'PDF' });
  const [search, setSearch] = useState('');

  const typeIcon = (type) => {
    if (type === 'video') return <Video className="h-4 w-4 text-violet-500" />;
    if (type === 'notes') return <StickyNote className="h-4 w-4 text-amber-500" />;
    return <File className="h-4 w-4 text-blue-500" />;
  };

  const filtered = materials.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.class.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = () => {
    const newM = {
      id: 'm-' + Date.now(),
      ...form,
      uploadedAt: today(),
      size: form.type === 'video' ? '—' : '—',
    };
    teacherService.uploadMaterial(newM);
    setMaterials((prev) => [newM, ...prev]);
    setShowUpload(false);
    setForm({ title: '', type: 'notes', class: '', url: '', format: 'PDF' });
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Learning Materials"
        description="Upload notes, documents, and video links for students"
        action={
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Material
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          className="pl-9 h-9"
        />
      </div>

      {/* Type filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Notes', 'Document', 'Video'].map((f) => (
          <button
            key={f}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary transition-colors"
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <Card key={m.id} className="flex flex-col">
            <CardContent className="p-4 flex flex-col gap-3 flex-1">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                  {typeIcon(m.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{m.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{m.class}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/40">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="px-1.5 py-0.5 rounded bg-background border border-border font-mono">{m.format}</span>
                  {m.size !== '—' && <span>{m.size}</span>}
                </div>
                <span className="text-[11px] text-text-muted">{formatDate(m.uploadedAt)}</span>
              </div>
              <div className="flex gap-2">
                {m.type === 'video' ? (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <Link2 className="h-3 w-3 mr-1" /> Open Link
                    </Button>
                  </a>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    <Download className="h-3 w-3 mr-1" /> Download
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Learning Material">
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 6 – Polynomials Notes" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <FormSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="notes">Notes</option>
                <option value="document">Document</option>
                <option value="video">Video Link</option>
              </FormSelect>
            </div>
            <div>
              <Label>Class</Label>
              <FormSelect value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                <option value="">Select class…</option>
                <option value="All Classes">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </FormSelect>
            </div>
          </div>
          {form.type === 'video' ? (
            <div>
              <Label>Video URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" className="h-9" />
            </div>
          ) : (
            <div>
              <Label>File Format</Label>
              <FormSelect value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                {['PDF', 'DOCX', 'PPTX', 'XLSX', 'ZIP'].map((f) => <option key={f} value={f}>{f}</option>)}
              </FormSelect>
              <div className="mt-3 border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">Drag & drop file or <span className="text-primary font-semibold">browse</span></p>
                <p className="text-xs text-text-muted mt-1">Max file size: 50 MB</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpload} disabled={!form.title || !form.class}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function TeacherPortal() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Data state
  const [schedule, setSchedule]     = useState([]);
  const [tasks, setTasks]           = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [classes, setClasses]       = useState([]);
  const [allStudents, setAllStudents] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams]           = useState([]);
  const [materials, setMaterials]   = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, cls, asn, ex, mat] = await Promise.all([
        teacherService.getDashboardData(),
        teacherService.getClasses(),
        teacherService.getAssignments(),
        teacherService.getExams(),
        teacherService.getMaterials(),
      ]);

      setSchedule(dash.schedule || []);
      setTasks(dash.tasks || []);
      setUpcomingExams(dash.upcomingExams || []);
      setClasses(cls);
      setAssignments(asn);
      setExams(ex);
      setMaterials(mat);

      // Load students for all classes
      const mockStudents = teacherService.getMockStudents();
      const studentMap = {};
      cls.forEach((c) => { studentMap[c.id] = mockStudents[c.id] || []; });
      setAllStudents(studentMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeNav = NAV_ITEMS.find((n) => n.id === currentPage);

  return (
    <div className="flex flex-col gap-6">

      {/* Portal identity strip */}
      <div className="flex items-center gap-3 pb-1 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <CheckSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary tracking-tight font-display">Teacher Workspace</h1>
          <p className="text-xs text-text-muted">BN School Management Platform</p>
        </div>
      </div>

      {/* Horizontal nav */}
      <nav className="flex flex-wrap gap-1 bg-background rounded-xl border border-border p-1" role="navigation" aria-label="Teacher portal sections">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentPage(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${
              currentPage === id
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Page content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-text-muted">Loading workspace…</p>
          </div>
        ) : (
          <>
            {currentPage === 'dashboard'   && <DashboardPage  schedule={schedule} tasks={tasks} upcomingExams={upcomingExams} classes={classes} />}
            {currentPage === 'classes'     && <ClassesPage    classes={classes} allStudents={allStudents} />}
            {currentPage === 'attendance'  && <AttendancePage classes={classes} allStudents={allStudents} />}
            {currentPage === 'assignments' && <AssignmentsPage classes={classes} assignments={assignments} />}
            {currentPage === 'examination' && <ExaminationPage classes={classes} exams={exams} allStudents={allStudents} />}
            {currentPage === 'materials'   && <MaterialsPage  classes={classes} materials={materials} />}
          </>
        )}
      </div>
    </div>
  );
}
