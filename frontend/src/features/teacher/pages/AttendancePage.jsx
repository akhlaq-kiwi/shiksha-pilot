import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Send } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { teacherService } from '../../../common/services/teacherService';
import { SectionHeader, Label, FormSelect, formatDate } from '../shared';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function AttendancePage({ classes, allStudents }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [date, setDate] = useState(today());
  const [attendance, setAttendance] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('mark');

  const students = allStudents[selectedClass] || [];

  useEffect(() => {
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
