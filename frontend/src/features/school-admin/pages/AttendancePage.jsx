import React from 'react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';

const MOCK_ATTENDANCE = [
  { id: 1, student: 'Aryan Mehta', class: 'Class 10A', date: '2026-06-25', status: 'Present' },
  { id: 2, student: 'Priya Sharma', class: 'Class 10B', date: '2026-06-25', status: 'Present' },
  { id: 3, student: 'Rohan Das', class: 'Class 9A', date: '2026-06-25', status: 'Absent' },
  { id: 4, student: 'Sneha Gupta', class: 'Class 9B', date: '2026-06-25', status: 'Present' },
  { id: 5, student: 'Aditya Patel', class: 'Class 11 Sci', date: '2026-06-25', status: 'Late' },
];

const MOCK_STUDENTS_SLICE = [
  { id: 1, name: 'Aryan Mehta', class: 'Class 10' },
  { id: 2, name: 'Priya Sharma', class: 'Class 10' },
  { id: 3, name: 'Rohan Das', class: 'Class 9' },
  { id: 4, name: 'Sneha Gupta', class: 'Class 9' },
];

const statusBadge = (status) => {
  const map = {
    Present: 'bg-green-500/10 text-green-600',
    Absent: 'bg-red-500/10 text-red-600',
    Late: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function AttendancePage({ students }) {
  const { isReadOnly } = useAcademicYear();
  const attendance = MOCK_ATTENDANCE;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Attendance</h2>
          <p className="text-text-secondary text-sm mt-1">Mark daily student and staff attendance, view reports.</p>
        </div>
        <div className="flex gap-2">
          <Select className="w-40"><option>Class 10A</option><option>Class 9A</option><option>Class 11 Sci</option></Select>
          <Input type="date" defaultValue="2026-06-25" className="w-40" />
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Present', count: attendance.filter(a => a.status === 'Present').length, color: 'bg-green-500/10 text-green-600' },
          { label: 'Absent', count: attendance.filter(a => a.status === 'Absent').length, color: 'bg-red-500/10 text-red-600' },
          { label: 'Late', count: attendance.filter(a => a.status === 'Late').length, color: 'bg-amber-500/10 text-amber-600' },
        ].map(b => (
          <div key={b.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${b.color}`}>
            <span>{b.label}</span>
            <span className="text-base font-black">{b.count}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-text-primary">Student Attendance — 25 Jun 2026</CardTitle>
          {!isReadOnly && <Button className="text-xs h-8 px-3">Save Attendance</Button>}
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendance.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-text-muted">No attendance records.</TableCell></TableRow>
            ) : attendance.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold text-text-primary">{a.student}</TableCell>
                <TableCell className="text-xs text-text-secondary">{a.class}</TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                <TableCell>
                  <Select defaultValue={a.status} className="h-7 text-xs w-28" disabled={isReadOnly}>
                    <option>Present</option><option>Absent</option><option>Late</option>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Monthly Attendance Report</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Present Days</TableHead><TableHead>Absent Days</TableHead><TableHead>Attendance %</TableHead></TableRow></TableHeader>
          <TableBody>
            {MOCK_STUDENTS_SLICE.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-semibold text-text-primary">{s.name}</TableCell>
                <TableCell className="text-xs text-text-secondary">{s.class}</TableCell>
                <TableCell className="font-mono text-xs">20</TableCell>
                <TableCell className="font-mono text-xs">2</TableCell>
                <TableCell>
                  <span className="font-bold text-green-600 text-xs">91%</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
