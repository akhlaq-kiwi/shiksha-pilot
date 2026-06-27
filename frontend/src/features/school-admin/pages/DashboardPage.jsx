import React, { useState, useEffect } from 'react';
import {
  Users, UserCog, Banknote, FileText, UserPlus, ClipboardCheck,
  CreditCard, BookMarked, PieChart
} from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { schoolService } from '../../../common/services/schoolService';

const MOCK_AUDIT_LOGS = [
  { id: 1, action: 'Student Enrolled', user: 'admin@school.edu', detail: 'Aryan Mehta enrolled in Class 10A', date: '2026-06-20 09:12' },
  { id: 2, action: 'Fee Collected', user: 'accounts@school.edu', detail: '₹25,000 received from Aryan Mehta', date: '2026-06-20 11:45' },
  { id: 3, action: 'Exam Created', user: 'admin@school.edu', detail: 'Unit Test 1 created for Class 10', date: '2026-06-18 14:00' },
  { id: 4, action: 'Staff Added', user: 'admin@school.edu', detail: 'Mr. Vivek Tiwari added as Social Studies teacher', date: '2026-06-15 10:30' },
  { id: 5, action: 'Timetable Updated', user: 'admin@school.edu', detail: 'Monday schedule updated for Class 10A', date: '2026-06-12 16:20' },
];

export default function DashboardPage({ onNavigate }) {
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [exams, setExams] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [dbStats, setDbStats] = useState({
    students_count: 0,
    staff_count: 0,
    classes_count: 0,
    pending_fees: 0,
    total_collected: 0
  });
  const [loading, setLoading] = useState(true);
  const [auditLogs] = useState(MOCK_AUDIT_LOGS);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [stuData, stfData, exData, fpData, statsData] = await Promise.all([
          schoolService.getStudents(),
          schoolService.getStaff(),
          schoolService.getExams(),
          schoolService.getFeePayments(),
          schoolService.getStats()
        ]);
        setStudents(stuData || []);
        setStaff(stfData || []);
        setExams(exData || []);
        setFeePayments(fpData || []);
        setDbStats(statsData || {
          students_count: 0,
          staff_count: 0,
          classes_count: 0,
          pending_fees: 0,
          total_collected: 0
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const totalStaff = staff.length;
  const totalFeeCollected = dbStats.total_collected || feePayments.filter(f => f.status === 'PAID').reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
  const pendingFees = dbStats.pending_fees || feePayments.filter(f => f.status === 'Pending').length;

  const stats = {
    totalStudents,
    activeStudents,
    totalStaff,
    totalFeeCollected,
    pendingFees,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: totalStudents },
          { label: 'Total Staff', value: totalStaff },
          { label: 'Fee Collected', value: `₹${(totalFeeCollected / 1000).toFixed(0)}K` },
          { label: 'Dues Pending', value: exams.filter(e => e.status === 'Upcoming').length },
        ].map(card => {
          return (
            <Card key={card.label} className="shadow-sm">
              <CardContent className="p-5">
                <p className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{card.label}</p>
                <p className="text-2xl font-black text-text-primary mt-0.5 font-display">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Attendance bar chart */}
        <div className="lg:col-span-12 bg-surface border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary mb-5">Monthly Attendance Rate (%)</h3>
          <div className="h-48 relative flex items-end justify-between px-2 border-b border-border pb-2">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-2">
              {[100, 75, 50, 25].map(v => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-[9px] text-text-muted w-6 text-right">{v}</span>
                  <div className="flex-1 border-b border-zinc-100 dark:border-zinc-800/40"></div>
                </div>
              ))}
            </div>
            {[92, 88, 94, 91, 96, 89].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer z-10 ml-6">
                <div className="w-8 bg-primary/15 border-t-2 border-primary rounded-t group-hover:bg-primary/25 transition-all"
                  style={{ height: `${h * 1.5}px` }}></div>
                <span className="mt-2 text-[10px] text-text-muted">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: 'Enroll Student', page: 'students', icon: UserPlus },
          { label: 'Mark Attendance', page: 'attendance', icon: ClipboardCheck },
          { label: 'Collect Fee', page: 'finance', icon: CreditCard },
          { label: 'Create Exam', page: 'exams', icon: BookMarked },
          { label: 'View Reports', page: 'reports', icon: PieChart },
        ].map(q => {
          const Icon = q.icon;
          return (
            <button key={q.label} onClick={() => onNavigate(q.page)}
              className="flex flex-col items-center gap-2 p-4 bg-surface border border-border rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400 transition-all text-center group">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-text-secondary">{q.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
