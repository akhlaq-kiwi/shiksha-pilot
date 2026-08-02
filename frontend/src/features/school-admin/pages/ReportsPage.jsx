import React, { useState, useEffect } from 'react';
import { Users, ClipboardCheck, Award, PieChart, UserCog, BarChart2 } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { schoolService } from '../../../common/services/schoolService';

export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        const [statsData, students, exams, feePayments] = await Promise.all([
          schoolService.getStats(),
          schoolService.getStudents(),
          schoolService.getExams(),
          schoolService.getFeePayments()
        ]);
        
        const totalStudents = students.length;
        const activeStudents = students.filter(s => s.status === 'ACTIVE').length;

        const totalFeeCollected = statsData?.total_collected !== undefined && statsData?.total_collected !== null ? statsData.total_collected : feePayments.filter(f => f.status === 'PAID').reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
        const pendingFees = statsData?.pending_fees || feePayments.filter(f => f.status === 'Pending').length;

        setStats({
          totalStudents,
          activeStudents,
          totalFeeCollected,
          pendingFees,
          examsCompleted: exams.filter(e => e.status === 'Completed').length,
          feeCollectionRate: feePayments.length > 0 
            ? `${Math.round((feePayments.filter(f => f.status === 'PAID').length / feePayments.length) * 100)}%`
            : '0%',
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReportsData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Reports...</p>
        </div>
      </div>
    );
  }

  const { totalStudents, examsCompleted, feeCollectionRate } = stats || {};

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Reports</h2>
        <p className="text-text-secondary text-sm mt-1">Student, attendance, examination, financial, and staff reports.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Student Report', desc: 'Enrollment, demographics, class-wise breakdown', icon: Users, action: 'Generate' },
          { title: 'Attendance Report', desc: 'Daily and monthly attendance summaries', icon: ClipboardCheck, action: 'Generate' },
          { title: 'Examination Report', desc: 'Results, grade distributions, toppers list', icon: Award, action: 'Generate' },
          { title: 'Financial Report', desc: 'Collections, expenses, outstanding fees', icon: PieChart, action: 'Generate' },
          { title: 'Staff Report', desc: 'Staff attendance, leave records, payroll', icon: UserCog, action: 'Generate' },
          { title: 'Custom Report', desc: 'Build a custom report with filters', icon: BarChart2, action: 'Configure' },
        ].map(r => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="bg-surface border border-border rounded-xl p-5 hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all group cursor-pointer flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text-primary">{r.title}</h3>
                <p className="text-xs text-text-muted mt-1">{r.desc}</p>
              </div>
              <Button variant="outline" className="text-xs w-full justify-center">{r.action}</Button>
            </div>
          );
        })}
      </div>

      {/* Quick Stats Report */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Term 1 Summary — 2025–2026</CardTitle>
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { k: 'Students Enrolled', v: totalStudents ?? '—' },
            { k: 'Avg. Attendance', v: '91.4%' },
            { k: 'Exams Conducted', v: examsCompleted ?? '—' },
            { k: 'Fee Collection Rate', v: feeCollectionRate ?? '—' },
          ].map(item => (
            <div key={item.k}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{item.k}</p>
              <p className="text-2xl font-bold text-text-primary mt-1 font-display">{item.v}</p>
            </div>
          ))}
        </CardContent>
      </Card>


    </div>
  );
}

function VocabularyAnalyticsReport({ analytics }) {
  if (!analytics) return <p className="text-xs text-text-muted font-bold py-4">No vocabulary analytics data loaded.</p>;

  const { total_words_played, dau, mau, category_performance, grade_performance } = analytics;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-background dark:bg-zinc-900 border border-border p-5 rounded-xl shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Vocabulary Words Played</p>
          <p className="text-3xl font-bold text-text-primary mt-1.5 tabular-nums">{total_words_played.toLocaleString()}</p>
        </div>
        <div className="bg-background dark:bg-zinc-900 border border-border p-5 rounded-xl shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Daily Active Players (DAU)</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1.5 tabular-nums">{dau}</p>
        </div>
        <div className="bg-background dark:bg-zinc-900 border border-border p-5 rounded-xl shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Monthly Active Players (MAU)</p>
          <p className="text-3xl font-bold text-primary mt-1.5 tabular-nums">{mau}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade performance */}
        <Card className="border border-border bg-white rounded-2xl shadow-2xs">
          <CardHeader className="py-3.5 border-b border-border bg-background dark:bg-zinc-900/50">
            <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-wider">Accuracy by Grade Level</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            {grade_performance.map((gp, idx) => {
              const total = parseInt(gp.correct) + parseInt(gp.wrong);
              const rate = total > 0 ? Math.round((parseInt(gp.correct) / total) * 100) : 0;
              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-text-primary">{gp.academic_level}</span>
                    <span className="text-text-secondary font-bold">{rate}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
            {grade_performance.length === 0 && (
              <p className="text-xs text-text-muted italic">No grade session history yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Category performance */}
        <Card className="border border-border bg-white rounded-2xl shadow-2xs">
          <CardHeader className="py-3.5 border-b border-border bg-background dark:bg-zinc-900/50">
            <CardTitle className="text-xs font-bold text-text-primary uppercase tracking-wider">Accuracy by Word Category</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5">
            {category_performance.map((cp, idx) => {
              const total = parseInt(cp.correct) + parseInt(cp.wrong);
              const rate = total > 0 ? Math.round((parseInt(cp.correct) / total) * 100) : 0;
              return (
                <div key={idx} className="space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-text-primary">{cp.category}</span>
                    <span className="text-text-secondary font-bold">{rate}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
            {category_performance.length === 0 && (
              <p className="text-xs text-text-muted italic">No category session history yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
