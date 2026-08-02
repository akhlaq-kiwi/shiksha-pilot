import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { SectionHeader, StatusBadge, Label, Textarea, formatDate } from '../shared';

export default function ClassesPage({ classes, allStudents }) {
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
                { date: '2026-06-15', text: "Need to bring printed formula sheets next class. 60% of students don't have textbooks yet." },
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
