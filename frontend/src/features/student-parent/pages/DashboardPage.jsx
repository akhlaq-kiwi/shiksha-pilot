import React from 'react';
import {
  LayoutDashboard, BookOpen, ClipboardList, CalendarCheck,
  CreditCard, ChevronRight, Clock, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';

const subjectColors = {
  'Mathematics': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Physics': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Chemistry': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'English': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'History': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Geography': 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Computer Sc.': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Computer Science': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
};

const getSubjectColor = (subject) =>
  subjectColors[subject] || 'bg-zinc-100 text-zinc-700 dark:text-zinc-400';

const statusConfig = {
  pending: { label: 'PENDING', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  submitted: { label: 'Submitted', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  graded: { label: 'Graded', cls: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  overdue: { label: 'Overdue', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

export default function DashboardPage({ homework, upcomingExams, attendance, fees, isParent, selectedChild, displayName, onNavigate, onPayNow }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">
            {isParent ? `Welcome back` : `Good morning`}
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            {isParent
              ? `Viewing ${selectedChild?.name}'s academic overview.`
              : `Here's your academic snapshot for today, ${displayName?.split(' ')[0]}.`}
          </p>
        </div>
        <div className="text-xs text-text-muted font-semibold">Wednesday, 25 June 2026</div>
      </div>

      {/* Fee Banner */}
      {fees.outstanding > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-amber-500/8 border border-amber-500/25 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-text-primary">Fee payment due on {fees.dueDate}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Outstanding balance: <span className="font-black text-amber-700 dark:text-amber-400 tabular-nums">₹{fees.outstanding.toLocaleString()}</span>
              </p>
            </div>
          </div>
          <Button
            onClick={onPayNow}
            className="bg-amber-600 hover:bg-amber-700 text-white border-none text-xs font-bold flex-shrink-0"
          >
            Pay Fees
          </Button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><CalendarCheck className="h-4 w-4" /></div>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {attendance.percentage}%
              </span>
            </div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Attendance</p>
            <p className="text-2xl font-black text-text-primary mt-1 tabular-nums font-display">
              {attendance.present}<span className="text-text-muted text-sm font-semibold">/{attendance.total}</span>
            </p>
            <div className="mt-3 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${attendance.percentage}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600"><BookOpen className="h-4 w-4" /></div>
            </div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Upcoming Exams</p>
            <p className="text-2xl font-black text-text-primary mt-1 font-display">{upcomingExams.length}</p>
            <p className="text-xs text-text-muted mt-2">Next: <span className="font-bold text-text-primary">{upcomingExams[0]?.subject}</span> on {upcomingExams[0]?.date}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600"><ClipboardList className="h-4 w-4" /></div>
              <span className="text-[10px] font-black text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                {homework.filter(h => h.status === 'overdue').length} overdue
              </span>
            </div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Pending Tasks</p>
            <p className="text-2xl font-black text-text-primary mt-1 font-display">
              {homework.filter(h => h.status === 'pending').length}
            </p>
            <p className="text-xs text-text-muted mt-2">assignments to submit</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600"><CreditCard className="h-4 w-4" /></div>
              <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">Due</span>
            </div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Fee Balance</p>
            <p className="text-2xl font-black text-text-primary mt-1 tabular-nums font-display">
              ₹{fees.outstanding.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted mt-2">due {fees.dueDate}</p>
          </CardContent>
        </Card>
      </div>

      {/* Homework & Exams grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-text-primary">Pending Homework</h3>
            <button
              onClick={() => onNavigate('assignments')}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {homework.slice(0, 4).map(hw => {
              const cfg = statusConfig[hw.status];
              return (
                <div key={hw.id} className="flex items-start justify-between p-4 bg-surface border border-border rounded-xl shadow-xs hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 text-[10px] font-black px-2 py-0.5 rounded ${getSubjectColor(hw.subject)}`}>
                      {hw.subject.substring(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary leading-tight">{hw.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Due {hw.dueDate} · {hw.teacher}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-text-primary">Upcoming Exams</h3>
            <button
              onClick={() => onNavigate('academics')}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              View timetable <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {upcomingExams.map(exam => (
              <div key={exam.id} className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl shadow-xs">
                <div className="flex-shrink-0 text-center bg-blue-500/8 border border-blue-500/15 rounded-lg px-3 py-2 min-w-[58px]">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">{exam.date.split('-')[1] === '07' ? 'Jul' : 'Jun'}</p>
                  <p className="text-lg font-black text-text-primary tabular-nums leading-none">{exam.date.split('-')[2]}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-primary">{exam.subject}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{exam.time} · {exam.room}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5 italic">{exam.syllabus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
