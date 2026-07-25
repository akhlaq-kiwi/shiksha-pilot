import React, { useState, useEffect } from 'react';
import { BookOpen, Users, CheckSquare, Calendar, Clock, Star } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../common/ui/card';
import { SectionHeader, StatCard, StatusBadge, PriorityDot } from '../shared';

export default function DashboardPage({ schedule, tasks, upcomingExams, classes }) {
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || 0);
  const [schoolName, setSchoolName] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_school_profile');
      return cached ? JSON.parse(cached)?.name || 'School Portal' : 'School Portal';
    } catch {
      return 'School Portal';
    }
  });

  return (
    <div className="space-y-7">
      <SectionHeader
        title={schoolName}
        description="Teacher Portal"
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

function TeacherVocabReport({ classId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await studentService.getTeacherVocabularyReport(classId);
        if (res?.success) {
          setReport(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (classId) {
      fetchReport();
    }
  }, [classId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        Loading Class Vocabulary analytics...
      </div>
    );
  }

  if (!report) {
    return <div className="text-xs text-text-muted py-4 font-bold">No class metrics found.</div>;
  }

  const { summary, weak_categories, difficult_words, active_students } = report;

  return (
    <div className="space-y-6">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#FAF9F6] border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Avg Accuracy</p>
          <p className="text-2xl font-black text-purple-600 mt-1 tabular-nums">{summary.average_accuracy}%</p>
        </div>
        <div className="bg-[#FAF9F6] border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Avg Stage Unlocked</p>
          <p className="text-2xl font-black text-text-primary mt-1 tabular-nums">{summary.average_stage}</p>
        </div>
        <div className="bg-[#FAF9F6] border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] font-black text-text-muted uppercase tracking-wider font-sans">Words Learned</p>
          <p className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">{summary.total_words_learned}</p>
        </div>
        <div className="bg-[#FAF9F6] border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[10px] font-black text-text-muted uppercase tracking-wider font-sans">Words Mastered</p>
          <p className="text-2xl font-black text-blue-600 mt-1 tabular-nums">{summary.total_words_mastered}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active students */}
        <Card className="border border-border shadow-2xs bg-white rounded-2xl">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-xs font-black text-text-primary uppercase tracking-wider">Most Active Students</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {active_students.map((student, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                <span className="text-text-primary">{student.first_name} {student.last_name}</span>
                <span className="text-text-secondary font-black tabular-nums">{student.score} XP</span>
              </div>
            ))}
            {active_students.length === 0 && (
              <p className="text-[10px] text-text-muted italic">No student sessions recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Difficult words */}
        <Card className="border border-border shadow-2xs bg-white rounded-2xl">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-xs font-black text-text-primary uppercase tracking-wider">Difficult Words</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {difficult_words.map((w, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                <span className="text-text-primary uppercase font-mono">{w.word}</span>
                <span className="text-red-500 font-black tabular-nums">{w.total_wrongs} Mistakes</span>
              </div>
            ))}
            {difficult_words.length === 0 && (
              <p className="text-[10px] text-text-muted italic">No word failure counts recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Weak categories */}
        <Card className="border border-border shadow-2xs bg-white rounded-2xl">
          <CardHeader className="py-3 px-4 border-b border-border">
            <CardTitle className="text-xs font-black text-text-primary uppercase tracking-wider">Weak Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {weak_categories.map((c, idx) => {
              const total = parseInt(c.correct) + parseInt(c.wrong);
              const rate = total > 0 ? Math.round((parseInt(c.correct) / total) * 100) : 0;
              return (
                <div key={idx} className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-text-primary">{c.category}</span>
                  <span className="text-red-500 font-black">{rate}% Accuracy</span>
                </div>
              );
            })}
            {weak_categories.length === 0 && (
              <p className="text-[10px] text-text-muted italic">No category counters recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
