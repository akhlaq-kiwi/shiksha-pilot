import React, { useState, useEffect } from 'react';
import {
  Users, UserCog, Banknote, FileText, UserPlus, ClipboardCheck,
  CreditCard, BookMarked, PieChart
} from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { schoolService } from '../../../common/services/schoolService';
import { Dialog } from '../../../common/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../common/ui/table';

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

  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState('');
  const [selectedSalaryMonthLabel, setSelectedSalaryMonthLabel] = useState('');
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const FEE_DATA = [
    { month: 'Apr', label: 'April', amount: 125000, studentsPaid: 25 },
    { month: 'May', label: 'May', amount: 140000, studentsPaid: 28 },
    { month: 'Jun', label: 'June', amount: 135000, studentsPaid: 27 },
    { month: 'Jul', label: 'July', amount: 150000, studentsPaid: 30 },
    { month: 'Aug', label: 'August', amount: 110000, studentsPaid: 22 },
    { month: 'Sep', label: 'September', amount: 120000, studentsPaid: 24 },
    { month: 'Oct', label: 'October', amount: 160000, studentsPaid: 32 },
    { month: 'Nov', label: 'November', amount: 145000, studentsPaid: 29 },
    { month: 'Dec', label: 'December', amount: 130000, studentsPaid: 26 },
    { month: 'Jan', label: 'January', amount: 155000, studentsPaid: 31 },
    { month: 'Feb', label: 'February', amount: 165000, studentsPaid: 33 },
    { month: 'Mar', label: 'March', amount: 180000, studentsPaid: 36 },
  ];

  const SALARY_DATA = [
    { month: 'Apr', label: 'April', amount: 82000 },
    { month: 'May', label: 'May', amount: 82000 },
    { month: 'Jun', label: 'June', amount: 82000 },
    { month: 'Jul', label: 'July', amount: 82000 },
    { month: 'Aug', label: 'August', amount: 82000 },
    { month: 'Sep', label: 'September', amount: 82000 },
    { month: 'Oct', label: 'October', amount: 82000 },
    { month: 'Nov', label: 'November', amount: 82000 },
    { month: 'Dec', label: 'December', amount: 95000 },
    { month: 'Jan', label: 'January', amount: 82000 },
    { month: 'Feb', label: 'February', amount: 82000 },
    { month: 'Mar', label: 'March', amount: 82000 },
  ];

  const getStaffPaymentsForMonth = (month) => {
    const baseStaff = [
      { name: 'Karan Sharma', designation: 'Senior Science Teacher', salary: 25000 },
      { name: 'Priya Patel', designation: 'Mathematics HOD', salary: 22000 },
      { name: 'Amit Verma', designation: 'English Lecturer', salary: 20000 },
      { name: 'Sunita Rao', designation: 'Head Librarian', salary: 15000 },
    ];
    
    if (month === 'Dec') {
      baseStaff.push({ name: 'Rajesh Kumar', designation: 'Guest Lecturer', salary: 13000 });
    }
    
    const monthNumMap = {
      'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09',
      'Oct': '10', 'Nov': '11', 'Dec': '12', 'Jan': '01', 'Feb': '02', 'Mar': '03'
    };
    
    const mNum = monthNumMap[month] || '06';
    const year = ['Jan', 'Feb', 'Mar'].includes(month) ? '2027' : '2026';
    
    return baseStaff.map((s, idx) => {
      let status = 'Paid';
      let date = `${year}-${mNum}-28`;
      
      if (month === 'Jun') {
        if (idx >= 2) {
          status = 'Pending';
          date = '-';
        } else {
          date = `${year}-${mNum}-26`;
        }
      } else if (['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].includes(month)) {
        status = 'Pending';
        date = '-';
      }
      
      return {
        ...s,
        status,
        date
      };
    });
  };

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
      </div>      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Monthly Fee Collection */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="text-sm font-bold text-text-primary">Monthly Fee Collection</h3>
            <p className="text-xs text-text-secondary">Fees received across the current academic session (April - March)</p>
          </div>
          <div className="w-full overflow-x-auto scrollbar-none">
            <div className="min-w-[760px] h-64 relative flex items-end justify-between px-2 pb-6 pt-10">
              {/* Y-Axis Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-12 pt-10 px-2">
                {[200000, 150000, 100000, 50000].map(v => (
                  <div key={v} className="flex items-center gap-4">
                    <span className="text-[9px] text-text-muted w-14 text-right">₹{v.toLocaleString()}</span>
                    <div className="flex-1 border-b border-zinc-100 dark:border-zinc-800/40"></div>
                  </div>
                ))}
              </div>

              {/* Bars */}
              {FEE_DATA.map((item, i) => {
                const maxVal = 200000;
                const percentage = (item.amount / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer z-10 ml-8 relative">
                    {/* Amount Label on top of bar */}
                    <span className="text-[9px] font-bold text-text-muted mb-1.5 select-none transition-opacity duration-300 opacity-80 group-hover:opacity-100">
                      ₹{item.amount.toLocaleString()}
                    </span>

                    {/* Bar */}
                    <div 
                      className="w-10 bg-primary/15 border-t-2 border-primary rounded-t-md hover:bg-primary/25 transition-all duration-700 ease-out"
                      style={{ height: isAnimated ? `${percentage * 1.6}px` : '0px' }}
                    ></div>

                    {/* X-Axis Label */}
                    <span className="absolute -bottom-6 text-[10px] font-semibold text-text-muted mt-2">{item.month}</span>

                    {/* Tooltip Popover */}
                    <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center pointer-events-none z-30 animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[10px] font-semibold p-2.5 rounded-lg shadow-lg whitespace-nowrap flex flex-col gap-0.5 border border-border/10">
                        <span className="font-bold border-b border-zinc-800 dark:border-zinc-200 pb-0.5 mb-1">{item.label}</span>
                        <span>Fee Collected: ₹{item.amount.toLocaleString()}</span>
                        <span>Students Paid: {item.studentsPaid}</span>
                      </div>
                      <div className="w-1.5 h-1.5 bg-zinc-950 dark:bg-zinc-50 rotate-45 -mt-1"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Salary Disbursement */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="text-sm font-bold text-text-primary">Salary Disbursement</h3>
            <p className="text-xs text-text-secondary">Monthly staff payroll distribution (Click a month's bar to view details)</p>
          </div>
          <div className="w-full overflow-x-auto scrollbar-none">
            <div className="min-w-[760px] h-64 relative flex items-end justify-between px-2 pb-6 pt-10">
              {/* Y-Axis Gridlines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-12 pt-10 px-2">
                {[100000, 75000, 50000, 25000].map(v => (
                  <div key={v} className="flex items-center gap-4">
                    <span className="text-[9px] text-text-muted w-14 text-right">₹{v.toLocaleString()}</span>
                    <div className="flex-1 border-b border-zinc-100 dark:border-zinc-800/40"></div>
                  </div>
                ))}
              </div>

              {/* Bars */}
              {SALARY_DATA.map((item, i) => {
                const maxVal = 100000;
                const percentage = (item.amount / maxVal) * 100;
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedSalaryMonth(item.month);
                      setSelectedSalaryMonthLabel(item.label);
                      setIsSalaryDialogOpen(true);
                    }}
                    className="flex-1 flex flex-col items-center group cursor-pointer z-10 ml-8 relative"
                  >
                    {/* Amount Label on top of bar */}
                    <span className="text-[9px] font-bold text-text-muted mb-1.5 select-none transition-opacity duration-300 opacity-80 group-hover:opacity-100">
                      ₹{item.amount.toLocaleString()}
                    </span>

                    {/* Bar */}
                    <div 
                      className="w-10 bg-indigo-500/10 border-t-2 border-indigo-500 rounded-t-md hover:bg-indigo-500/25 transition-all duration-700 ease-out"
                      style={{ height: isAnimated ? `${percentage * 1.6}px` : '0px' }}
                    ></div>

                    {/* X-Axis Label */}
                    <span className="absolute -bottom-6 text-[10px] font-semibold text-text-muted mt-2">{item.month}</span>

                    {/* Tooltip Popover */}
                    <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center pointer-events-none z-30 animate-in fade-in slide-in-from-bottom-1 duration-200">
                      <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[10px] font-semibold p-2.5 rounded-lg shadow-lg whitespace-nowrap flex flex-col gap-0.5 border border-border/10">
                        <span className="font-bold border-b border-zinc-800 dark:border-zinc-200 pb-0.5 mb-1">{item.label}</span>
                        <span>Salary Disbursed: ₹{item.amount.toLocaleString()}</span>
                        <span className="text-[9px] text-indigo-400 font-medium">Click to view staff list</span>
                      </div>
                      <div className="w-1.5 h-1.5 bg-zinc-950 dark:bg-zinc-50 rotate-45 -mt-1"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Salary Disbursement Details Dialog */}
      <Dialog
        isOpen={isSalaryDialogOpen}
        onClose={() => setIsSalaryDialogOpen(false)}
        title={`Salary Disbursement Details — ${selectedSalaryMonthLabel}`}
        description={`List of staff salary payments for ${selectedSalaryMonthLabel} 2026.`}
        className="max-w-2xl"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Salary Amount</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead>Payment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getStaffPaymentsForMonth(selectedSalaryMonth).map((staff, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-semibold text-text-primary text-sm">{staff.name}</TableCell>
                <TableCell className="text-xs">{staff.designation}</TableCell>
                <TableCell className="font-mono text-sm font-semibold">₹{staff.salary.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{staff.date}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    staff.status === 'Paid' 
                      ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}>
                    {staff.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Dialog>
    </div>
  );
}
