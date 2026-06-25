import React from 'react';
import { BookOpen, Users, CheckSquare, Calendar, Clock, Star } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { SectionHeader, StatCard, StatusBadge, PriorityDot } from '../shared';

export default function DashboardPage({ schedule, tasks, upcomingExams, classes }) {
  return (
    <div className="space-y-7">
      <SectionHeader
        title="Good morning, Ms. Khalid"
        description={`Today is ${new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={BookOpen}    label="Classes"       value={classes.length}                                          sub="Assigned this term"        accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={Users}       label="Students"      value={classes.reduce((a, c) => a + (c.students || 0), 0)}      sub="Total enrolled"            accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
        <StatCard icon={CheckSquare} label="Pending Tasks" value={tasks.length}                                            sub="Require attention"         accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard icon={Calendar}    label="Exam Days"     value={upcomingExams.length}                                    sub="Upcoming examinations"     accent="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" />
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
