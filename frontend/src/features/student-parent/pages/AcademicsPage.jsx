import React from 'react';
import { Download, FileText } from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';

const subjectColors = {
  'Mathematics': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Physics': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Chemistry': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'English': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'History': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Geography': 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Computer Sc.': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Computer Science': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Physical Ed.': 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Art & Craft': 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  'Class Activity': 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

const getSubjectColor = (subject) =>
  subjectColors[subject] || 'bg-zinc-100 text-zinc-700 dark:text-zinc-400';

const ScoreBar = ({ score, max = 100 }) => {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-text-primary w-8 text-right">{score}</span>
    </div>
  );
};

export default function AcademicsPage({ timetable, subjects, results }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Academics</h2>
        <p className="text-text-secondary text-sm mt-1">Timetable, subject results, and performance overview.</p>
      </div>

      {/* Timetable */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Weekly Timetable</h3>
        <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th className="p-3 text-left font-black text-text-muted uppercase tracking-wider border-b border-border w-28">Time Slot</th>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                  <th key={d} className="p-3 text-center font-black text-text-primary uppercase tracking-wider border-b border-border">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timetable.Mon.map((slot, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50/50 dark:bg-zinc-900/30'}>
                  <td className="p-3 font-bold text-text-muted border-r border-border whitespace-nowrap">{slot.time}</td>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                    const cell = timetable[day][idx];
                    return (
                      <td key={day} className="p-2 text-center border-r border-border last:border-r-0">
                        {cell ? (
                          <div className={`rounded-lg px-2 py-1.5 ${getSubjectColor(cell.subject)}`}>
                            <p className="font-bold text-[11px] leading-tight">{cell.subject}</p>
                            <p className="text-[9px] opacity-70 mt-0.5">{cell.room}</p>
                          </div>
                        ) : (
                          <span className="text-text-muted text-[10px]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subjects & Results */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Subject Results</h3>
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map(sub => (
                <TableRow key={sub.code}>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${getSubjectColor(sub.name)}`}>
                        {sub.code.split('-')[0]}
                      </span>
                      <span className="font-bold text-text-primary">{sub.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-text-secondary">{sub.teacher}</TableCell>
                  <TableCell className="font-mono font-bold text-text-primary tabular-nums">{sub.score}/{sub.maxScore}</TableCell>
                  <TableCell className="w-40">
                    <ScoreBar score={sub.score} max={sub.maxScore} />
                  </TableCell>
                  <TableCell>
                    <span className={`font-black text-sm ${sub.score >= 90 ? 'text-emerald-600' : sub.score >= 75 ? 'text-blue-600' : sub.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {sub.grade}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Performance Chart */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Performance Overview</h3>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-3">
              {subjects.map(sub => {
                const pct = Math.round((sub.score / sub.maxScore) * 100);
                const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={sub.code} className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-text-secondary w-32 flex-shrink-0 truncate">{sub.name}</span>
                    <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${barColor} rounded flex items-center justify-end pr-2 transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      >
                        <span className="text-[10px] font-black text-white tabular-nums">{pct}%</span>
                      </div>
                    </div>
                    <span className={`w-10 text-right text-xs font-black tabular-nums ${pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-blue-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {sub.grade}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-5 border-t border-border flex items-center justify-between text-xs">
              <span className="text-text-muted font-semibold">Overall Average</span>
              <span className="font-black text-lg text-text-primary tabular-nums">
                {Math.round(subjects.reduce((a, s) => a + s.score, 0) / subjects.length)}
                <span className="text-text-muted text-sm font-semibold">/100</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Report Cards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['Term 1 — 2025', 'Term 2 — 2025', 'Term 3 — 2026'].map(term => (
            <div key={term} className="flex items-center justify-between p-4 border border-border rounded-xl bg-surface shadow-xs hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-text-muted flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-text-primary">{term}</p>
                  <p className="text-[10px] text-text-muted">Grade Card · PDF</p>
                </div>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-text-secondary hover:text-text-primary">
                <Download className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
