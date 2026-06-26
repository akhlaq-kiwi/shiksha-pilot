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

        const totalFeeCollected = statsData?.total_collected || feePayments.filter(f => f.status === 'PAID').reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
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
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Reports</h2>
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
              <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">{item.k}</p>
              <p className="text-2xl font-black text-text-primary mt-1 font-display">{item.v}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
