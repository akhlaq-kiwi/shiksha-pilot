import React, { useState, useEffect } from 'react';
import {
  Users, UserCog, Banknote, FileText, UserPlus, ClipboardCheck,
  CreditCard, BookMarked, PieChart
} from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
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
  const totalFeeCollected = dbStats.total_collected !== undefined && dbStats.total_collected !== null ? dbStats.total_collected : feePayments.filter(f => f.status === 'PAID').reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0);
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
                        onNavigate('salary-disbursement?month=' + encodeURIComponent(item.label));
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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
