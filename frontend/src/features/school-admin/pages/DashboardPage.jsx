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
    total_collected: 0,
    fee_collection_chart: [],
    salary_disbursement_chart: []
  });
  const [loading, setLoading] = useState(true);
  const [auditLogs] = useState(MOCK_AUDIT_LOGS);

  const [staffPaymentsList, setStaffPaymentsList] = useState([]);
  const [loadingSalary, setLoadingSalary] = useState(false);

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
        total_collected: 0,
        fee_collection_chart: [],
        salary_disbursement_chart: []
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchSalaryPayments = async (monthLabel) => {
    if (!monthLabel) return;
    setLoadingSalary(true);
    try {
      const list = await schoolService.getStaffPayments({ month: monthLabel });
      setStaffPaymentsList(list || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSalary(false);
    }
  };

  const handlePaySalary = async (staffId) => {
    try {
      await schoolService.payStaffSalary({
        staff_id: staffId,
        month: selectedSalaryMonthLabel
      });
      await fetchSalaryPayments(selectedSalaryMonthLabel);
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to pay salary.');
    }
  };

  const handleRevertSalary = async (paymentId) => {
    if (window.confirm('Are you sure you want to revert this salary payment?')) {
      try {
        await schoolService.revertStaffSalary(paymentId);
        await fetchSalaryPayments(selectedSalaryMonthLabel);
        await fetchDashboardData();
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || 'Failed to revert salary payment.');
      }
    }
  };

  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState('');
  const [selectedSalaryMonthLabel, setSelectedSalaryMonthLabel] = useState('');
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const FEE_DATA = dbStats.fee_collection_chart || [];
  const SALARY_DATA = dbStats.salary_disbursement_chart || [];

  const handleDownloadSalarySlip = (staff, monthName) => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const basic = Math.round(staff.salary * 0.7);
    const allowances = Math.round(staff.salary * 0.25);
    const bonus = monthName === 'December' ? 13000 : 0;
    const deductions = Math.round(staff.salary * 0.05);
    const netPaid = basic + allowances + bonus - deductions;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salary Slip - ${staff.name} - ${monthName} 2026</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <style>
          body {
            font-family: 'Inter', sans-serif;
            color: #1f2937;
            background-color: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 14px;
            line-height: 1.5;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-school {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-icon {
            width: 40px;
            height: 40px;
            background-color: #111827;
            color: #ffffff;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 20px;
          }
          .school-name {
            font-size: 20px;
            font-weight: 800;
            color: #111827;
            margin: 0;
          }
          .school-info {
            font-size: 12px;
            color: #4b5563;
            margin: 2px 0 0 0;
          }
          .slip-title {
            text-align: right;
          }
          .slip-title h2 {
            font-size: 24px;
            font-weight: 800;
            color: #111827;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .slip-title p {
            font-size: 12px;
            color: #6b7280;
            margin: 4px 0 0 0;
          }
          .details-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 35px;
            background-color: #f9fafb;
            border: 1px solid #f3f4f6;
            border-radius: 8px;
            padding: 20px;
          }
          .details-col p {
            margin: 6px 0;
            font-size: 13px;
          }
          .details-col p strong {
            color: #374151;
            font-weight: 600;
            display: inline-block;
            width: 130px;
          }
          .details-col p span {
            color: #4b5563;
          }
          .table-title {
            font-size: 14px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          th {
            background-color: #f3f4f6;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 12px;
            border-bottom: 2px solid #e5e7eb;
            font-size: 12px;
            text-transform: uppercase;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            color: #4b5563;
          }
          .text-right {
            text-align: right;
          }
          .font-mono {
            font-family: monospace;
            font-size: 14px;
          }
          .total-row {
            font-weight: 700;
            background-color: #f9fafb;
          }
          .total-row td {
            color: #111827;
            border-top: 2px solid #e5e7eb;
            border-bottom: 2px solid #e5e7eb;
          }
          .footer-container {
            margin-top: 60px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .footer-note {
            font-size: 11px;
            color: #9ca3af;
            max-width: 60%;
          }
          .seal-placeholder {
            width: 100px;
            height: 100px;
            border: 2px dashed #d1d5db;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            color: #9ca3af;
            text-align: center;
            font-weight: 600;
            padding: 10px;
            box-sizing: border-box;
            background-color: #f9fafb;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="logo-school">
            <div class="logo-icon">S</div>
            <div>
              <h1 class="school-name">Shiksha Pilot Academy</h1>
              <p class="school-info">123 Education Enclave, New Delhi, India</p>
              <p class="school-info">Contact: +91 98765 43210 | info@shikshapilot.edu</p>
            </div>
          </div>
          <div class="slip-title">
            <h2>Salary Slip</h2>
            <p>Academic Year 2025-2026</p>
          </div>
        </div>

        <div class="details-grid">
          <div class="details-col">
            <p><strong>Employee Name:</strong> <span>${staff.name}</span></p>
            <p><strong>Employee ID:</strong> <span>SP-2026-0${Math.floor(Math.random() * 90) + 10}</span></p>
            <p><strong>Designation:</strong> <span>${staff.designation}</span></p>
          </div>
          <div class="details-col">
            <p><strong>Department:</strong> <span>Academics</span></p>
            <p><strong>Payment Month:</strong> <span>${monthName} 2026</span></p>
            <p><strong>Payment Date:</strong> <span>${staff.date}</span></p>
          </div>
        </div>

        <div class="table-title">Earnings & Deductions Statement</div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td class="text-right font-mono">₹${basic.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Allowances (HRA, TA, Medical)</td>
              <td class="text-right font-mono">₹${allowances.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Bonus${bonus > 0 ? ' (Festival Bonus)' : ''}</td>
              <td class="text-right font-mono">₹${bonus.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Deductions (Provident Fund, Tax)</td>
              <td class="text-right font-mono">₹${deductions.toLocaleString()}</td>
            </tr>
            <tr class="total-row">
              <td>Net Salary Paid</td>
              <td class="text-right font-mono">₹${netPaid.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-container">
          <div class="footer-note">
            <p style="margin: 0 0 4px 0;"><strong>Note:</strong> This is a system-generated salary slip and does not require a physical signature.</p>
            <p style="margin: 0;">Generated on: ${today}</p>
          </div>
          <div class="seal-placeholder">
            <div>SHIKSHA PILOT</div>
            <div style="font-size: 6px; margin-top: 2px;">OFFICIAL SEAL</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2).replace(/\.00$/, '')}L`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
  const totalStaff = staff.length;
  const totalFeeCollected = dbStats.total_collected || feePayments.filter(f => f.status === 'PAID').reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
  const pendingFees = dbStats.pending_fees || 0;

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
          { label: 'Total Teachers', value: totalStaff },
          { label: 'Fee Collected', value: formatCurrency(totalFeeCollected) },
          { label: 'Dues Pending', value: formatCurrency(pendingFees) },
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
      <div className="grid grid-cols-1 gap-6">
        {/* Monthly Fee Collection */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-text-primary">Monthly Fee Collection</h3>
          </div>
          <div className="w-full overflow-x-auto scrollbar-none">
            <div className="min-w-[760px] flex items-stretch h-64 pt-6 pb-2">
              {/* Chart Grid & Bars Area */}
              <div className="flex-1 relative flex items-end justify-around pb-8 border-b border-border pr-2">
                {/* Bars */}
                {FEE_DATA.map((item, i) => {
                  const maxVal = Math.max(...FEE_DATA.map(d => d.amount), 10000);
                  const percentage = (item.amount / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group cursor-pointer z-10 relative">
                      {/* Amount Label on top of bar */}
                      <span className="text-[9px] font-bold text-text-muted mb-1.5 select-none transition-opacity duration-300 opacity-80 group-hover:opacity-100 text-center whitespace-nowrap">
                        ₹{item.amount.toLocaleString()}
                      </span>

                      {/* Bar */}
                      <div 
                        className="w-10 bg-primary/15 border-t-2 border-primary rounded-t-md hover:bg-primary/25 transition-all duration-700 ease-out"
                        style={{ height: isAnimated ? `${percentage}%` : '0%' }}
                      ></div>

                      {/* X-Axis Label */}
                      <span className="absolute -bottom-6 text-[10px] font-semibold text-text-muted mt-2">{item.month}</span>

                      {/* Tooltip Popover */}
                      <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center pointer-events-none z-30 animate-in fade-in slide-in-from-bottom-1 duration-200">
                        <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[10px] font-semibold p-2.5 rounded-lg shadow-lg whitespace-nowrap flex flex-col gap-0.5 border border-border/10">
                          <span className="font-bold border-b border-zinc-800 dark:border-zinc-200 pb-0.5 mb-1">{item.label}</span>
                          <span>Total Collection: ₹{item.amount.toLocaleString()}</span>
                          <span>{item.studentsPaid} Fee Transactions</span>
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

        {/* Salary Disbursement */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-text-primary">Salary Disbursement</h3>
          </div>
          <div className="w-full overflow-x-auto scrollbar-none">
            <div className="min-w-[760px] flex items-stretch h-64 pt-6 pb-2">
              {/* Chart Grid & Bars Area */}
              <div className="flex-1 relative flex items-end justify-around pb-8 border-b border-border pr-2">
                {/* Bars */}
                {SALARY_DATA.map((item, i) => {
                  const maxVal = Math.max(...SALARY_DATA.map(d => d.amount), 10000);
                  const percentage = (item.amount / maxVal) * 100;
                  return (
                    <div 
                      key={i} 
                      onClick={() => {
                        setSelectedSalaryMonth(item.month);
                        setSelectedSalaryMonthLabel(item.label);
                        fetchSalaryPayments(item.label);
                        setIsSalaryDialogOpen(true);
                      }}
                      className="flex-1 flex flex-col items-center group cursor-pointer z-10 relative"
                    >
                      {/* Amount Label on top of bar */}
                      <span className="text-[9px] font-bold text-text-muted mb-1.5 select-none transition-opacity duration-300 opacity-80 group-hover:opacity-100 text-center whitespace-nowrap">
                        ₹{item.amount.toLocaleString()}
                      </span>

                      {/* Bar */}
                      <div 
                        className="w-10 bg-indigo-500/10 border-t-2 border-indigo-500 rounded-t-md hover:bg-indigo-500/25 transition-all duration-700 ease-out"
                        style={{ height: isAnimated ? `${percentage}%` : '0%' }}
                      ></div>

                      {/* X-Axis Label */}
                      <span className="absolute -bottom-6 text-[10px] font-semibold text-text-muted mt-2">{item.month}</span>

                      {/* Tooltip Popover */}
                      <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col items-center pointer-events-none z-30 animate-in fade-in slide-in-from-bottom-1 duration-200">
                        <div className="bg-zinc-950 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 text-[10px] font-semibold p-2.5 rounded-lg shadow-lg whitespace-nowrap flex flex-col gap-0.5 border border-border/10">
                          <span className="font-bold border-b border-zinc-800 dark:border-zinc-200 pb-0.5 mb-1">{item.label}</span>
                          <span>Salary Disbursed: ₹{item.amount.toLocaleString()}</span>
                          <span>{item.teachersPaid} Teachers Paid</span>
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
      </div>

      {/* Salary Disbursement Details Dialog */}
      <Dialog
        isOpen={isSalaryDialogOpen}
        onClose={() => setIsSalaryDialogOpen(false)}
        title={`Salary Disbursement — ${selectedSalaryMonthLabel}`}
        description=""
        className="w-[90vw] md:max-w-4xl"
      >
        {loadingSalary ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Loading staff records...</p>
          </div>
        ) : staffPaymentsList.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-secondary">
            No active staff records found for this period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Staff Name</TableHead>
                <TableHead className="whitespace-nowrap">Designation</TableHead>
                <TableHead className="whitespace-nowrap">Salary Amount</TableHead>
                <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                <TableHead className="whitespace-nowrap">Payment Status</TableHead>
                <TableHead className="whitespace-nowrap">Salary Slip</TableHead>
                <TableHead className="text-right whitespace-nowrap">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffPaymentsList.map((staff, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-semibold text-text-primary text-sm whitespace-nowrap">{staff.name}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{staff.designation}</TableCell>
                  <TableCell className="font-mono text-sm font-semibold whitespace-nowrap">₹{staff.salary.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{staff.date}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      staff.status === 'Paid' 
                        ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {staff.status}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {staff.status === 'Paid' ? (
                      <button 
                        onClick={() => handleDownloadSalarySlip(staff, selectedSalaryMonthLabel)}
                        className="text-xs text-primary hover:underline font-semibold text-teal-600 dark:text-teal-400"
                      >
                        Download Salary Slip
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {staff.status === 'Paid' ? (
                      <Button 
                        variant="secondary"
                        onClick={() => handleRevertSalary(staff.payment_id)}
                        className="h-7 text-[10px] font-bold px-3 border border-red-500/20 hover:border-red-500/50 hover:bg-red-50 text-red-600 dark:hover:bg-red-950/20"
                      >
                        Revert Payout
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handlePaySalary(staff.id)}
                        className="h-7 text-[10px] font-bold px-3"
                      >
                        Pay Salary
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Dialog>
    </div>
  );
}
