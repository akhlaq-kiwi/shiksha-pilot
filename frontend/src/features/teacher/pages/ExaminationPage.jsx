import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useToast } from '../../../common/components/Toast';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { teacherService } from '../../../common/services/teacherService';
import { SectionHeader, Label, FormSelect } from '../shared';

export default function ExaminationPage({ classes, exams, allStudents }) {
  const toast = useToast();
  const [selectedExam, setSelectedExam] = useState(exams[0]?.id || '');
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '');
  const [marks, setMarks] = useState({});
  const [remarks, setRemarks] = useState({});
  const [tab, setTab] = useState('entry'); // entry | gradebook

  const students = allStudents[selectedClass] || [];

  useEffect(() => {
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

  const handleSave = async () => {
    try {
      await teacherService.submitMarks({ examId: selectedExam, classId: selectedClass, marks, remarks });
      toast.success('Marks saved successfully.', 'Saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save marks');
    }
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
