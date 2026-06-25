import React from 'react';
import { Plus, Edit } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Select } from '../../../common/ui/select';

const MOCK_TIMETABLE = [
  { id: 1, day: 'Monday', period: '1st (8:00–8:45)', class: 'Class 10A', subject: 'Mathematics', teacher: 'Mr. Suresh Kumar', room: 'R-201' },
  { id: 2, day: 'Monday', period: '2nd (8:45–9:30)', class: 'Class 10A', subject: 'Science', teacher: 'Ms. Divya Rao', room: 'Lab-1' },
  { id: 3, day: 'Monday', period: '3rd (9:45–10:30)', class: 'Class 10B', subject: 'English', teacher: 'Mr. Akhil Singh', room: 'R-202' },
  { id: 4, day: 'Tuesday', period: '1st (8:00–8:45)', class: 'Class 9A', subject: 'Mathematics', teacher: 'Mr. Suresh Kumar', room: 'R-101' },
  { id: 5, day: 'Tuesday', period: '2nd (8:45–9:30)', class: 'Class 11 Sci', subject: 'Physics', teacher: 'Ms. Divya Rao', room: 'Lab-2' },
];

export default function TimetablePage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Timetable Management</h2>
          <p className="text-text-secondary text-sm mt-1">Class schedules, teacher assignments, and room allocation.</p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Entry
        </Button>
      </div>

      <div className="flex gap-3">
        <Select className="w-48">
          <option>All Classes</option><option>Class 9A</option><option>Class 10A</option><option>Class 11 Sci</option>
        </Select>
        <Select className="w-40">
          <option>All Days</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead>Room</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_TIMETABLE.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No timetable entries.</TableCell></TableRow>
            ) : MOCK_TIMETABLE.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-semibold text-text-primary">{t.day}</TableCell>
                <TableCell className="text-xs text-text-secondary font-mono">{t.period}</TableCell>
                <TableCell className="text-xs text-text-secondary">{t.class}</TableCell>
                <TableCell className="text-xs font-semibold text-text-primary">{t.subject}</TableCell>
                <TableCell className="text-xs text-text-secondary">{t.teacher}</TableCell>
                <TableCell><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-text-muted">{t.room}</span></TableCell>
                <TableCell><button className="text-text-muted hover:text-primary"><Edit className="h-3.5 w-3.5" /></button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Substitute Assignments</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Absent Teacher</TableHead><TableHead>Substitute</TableHead><TableHead>Class</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell colSpan={5} className="text-center py-6 text-text-muted text-xs">No substitute assignments this week.</TableCell></TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
