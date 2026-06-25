import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';

const statusBadge = (status) => {
  const map = {
    Current: 'bg-green-500/10 text-green-600',
    Completed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function AcademicPage({ students = [] }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Academic Management</h2>
        <p className="text-text-secondary text-sm mt-1">Configure academic years, classes, sections, and subjects.</p>
      </div>

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
              {[{ y: '2025–2026', t: 2, s: 'Current' }, { y: '2024–2025', t: 2, s: 'Completed' }, { y: '2023–2024', t: 2, s: 'Completed' }].map(r => (
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
            <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Sections</TableHead><TableHead>Students</TableHead></TableRow></TableHeader>
            <TableBody>
              {[
                { c: 'Class 9', s: 'A, B', n: students.filter(x => x.class === 'Class 9').length },
                { c: 'Class 10', s: 'A, B', n: students.filter(x => x.class === 'Class 10').length },
                { c: 'Class 11', s: 'Science, Commerce', n: students.filter(x => x.class === 'Class 11').length },
                { c: 'Class 12', s: 'Science, Commerce', n: 0 },
              ].map(r => (
                <TableRow key={r.c}>
                  <TableCell className="font-semibold text-text-primary">{r.c}</TableCell>
                  <TableCell className="text-text-secondary text-xs">{r.s}</TableCell>
                  <TableCell className="text-text-secondary text-xs">{r.n}</TableCell>
                </TableRow>
              ))}
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
                  <TableCell><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.type === 'Core' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600'}`}>{r.type}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
