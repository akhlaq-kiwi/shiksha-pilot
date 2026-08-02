import React, { useState } from 'react';
import { Card, CardContent } from '../../../common/ui/card';
import { Select } from '../../../common/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';

const AttendanceDot = ({ status }) => {
  if (!status) return <span className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 inline-block" title="Weekend/Holiday" />;
  const map = { P: 'bg-emerald-500', A: 'bg-red-500', L: 'bg-amber-400' };
  const titles = { P: 'Present', A: 'Absent', L: 'Leave' };
  return (
    <span
      className={`h-6 w-6 rounded-full inline-flex items-center justify-center ${map[status]} text-white`}
      style={{ fontSize: '9px', fontWeight: 700 }}
      title={titles[status]}
    >
      {status}
    </span>
  );
};

export default function AttendancePage({ attendance }) {
  const [attendanceMonth, setAttendanceMonth] = useState('June 2026');

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Attendance</h2>
          <p className="text-text-secondary text-sm mt-1">Daily records, monthly calendar, and attendance reports.</p>
        </div>
        <Select value={attendanceMonth} onChange={e => setAttendanceMonth(e.target.value)} className="w-40">
          <option>June 2026</option>
          <option>May 2026</option>
          <option>April 2026</option>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Present', value: attendance.present, color: 'text-emerald-600' },
          { label: 'Absent', value: attendance.absent, color: 'text-red-600' },
          { label: 'Leave', value: 3, color: 'text-amber-600' },
          { label: 'Percentage', value: `${attendance.percentage}%`, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attendance progress bar */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-text-primary">Attendance Rate — {attendanceMonth}</h3>
            <span className="text-2xl font-bold text-text-primary tabular-nums">{attendance.percentage}%</span>
          </div>
          <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${attendance.percentage >= 85 ? 'bg-emerald-500' : attendance.percentage >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${attendance.percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-text-muted mt-2 font-semibold">
            <span>0%</span>
            <span className="text-amber-600 font-bold">75% Minimum</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Monthly Calendar — {attendanceMonth}</h3>
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-6">
            <div className="grid grid-cols-7 gap-2 mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[11px] font-bold text-text-muted uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              <div />
              {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
                const status = attendance.monthly[day];
                const isWeekend = [6, 7, 13, 14, 20, 21, 27, 28].includes(day);
                return (
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className={`text-[11px] font-semibold ${isWeekend ? 'text-text-muted' : 'text-text-secondary'}`}>{day}</span>
                    {isWeekend ? (
                      <span className="h-6 w-6 rounded-full bg-zinc-100 dark:bg-zinc-800 inline-block" title="Weekend" />
                    ) : (
                      <AttendanceDot status={status} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-center gap-6 flex-wrap text-xs font-semibold text-text-secondary">
              <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-emerald-500 inline-block" /> Present</div>
              <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-red-500 inline-block" /> Absent</div>
              <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-amber-400 inline-block" /> Leave</div>
              <div className="flex items-center gap-2"><span className="h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 inline-block" /> Holiday/Weekend</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Report */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Attendance Reports</h3>
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Working Days</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { month: 'June 2026', working: 22, present: 19, absent: 3 },
                { month: 'May 2026', working: 23, present: 20, absent: 3 },
                { month: 'April 2026', working: 21, present: 18, absent: 3 },
                { month: 'March 2026', working: 24, present: 22, absent: 2 },
              ].map(r => {
                const rate = Math.round((r.present / r.working) * 100);
                return (
                  <TableRow key={r.month}>
                    <TableCell className="font-semibold text-text-primary py-3.5">{r.month}</TableCell>
                    <TableCell className="tabular-nums">{r.working}</TableCell>
                    <TableCell className="text-emerald-600 font-bold tabular-nums">{r.present}</TableCell>
                    <TableCell className="text-red-600 font-bold tabular-nums">{r.absent}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${rate >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${rate >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>{rate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
