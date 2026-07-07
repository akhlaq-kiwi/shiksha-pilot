import React, { useState, useEffect } from 'react';
import {
  Users, UserCog, Banknote, FileText, UserPlus, ClipboardCheck,
  CreditCard, BookMarked, PieChart
} from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { Dialog } from '../../../common/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../common/ui/table';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';

const MOCK_AUDIT_LOGS = [
  { id: 1, action: 'Student Enrolled', user: 'admin@school.edu', detail: 'Aryan Mehta enrolled in Class 10A', date: '2026-06-20 09:12' },
  { id: 2, action: 'Fee Collected', user: 'accounts@school.edu', detail: '₹25,000 received from Aryan Mehta', date: '2026-06-20 11:45' },
  { id: 3, action: 'Exam Created', user: 'admin@school.edu', detail: 'Unit Test 1 created for Class 10', date: '2026-06-18 14:00' },
  { id: 4, action: 'Staff Added', user: 'admin@school.edu', detail: 'Mr. Vivek Tiwari added as Social Studies teacher', date: '2026-06-15 10:30' },
  { id: 5, action: 'Timetable Updated', user: 'admin@school.edu', detail: 'Monday schedule updated for Class 10A', date: '2026-06-12 16:20' },
];

export default function DashboardPage({ onNavigate }) {
  const { currentYear } = useAcademicYear();
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

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [todayTimetable, setTodayTimetable] = useState([]);
  const [periodConfigs, setPeriodConfigs] = useState([]);
  const [timetableSettings, setTimetableSettings] = useState(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [stuData, stfData, exData, fpData, statsData, classesList, settings] = await Promise.all([
        schoolService.getStudents(),
        schoolService.getStaff(),
        schoolService.getExams(),
        schoolService.getFeePayments(),
        schoolService.getStats(),
        schoolService.getClasses().catch(() => []),
        schoolAdminService.getTimetableSettings().catch(() => null)
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
      setClasses(classesList || []);
      if (classesList && classesList.length > 0 && !selectedClassId) {
        setSelectedClassId(String(classesList[0].id));
      }
      setTimetableSettings(settings || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentYear?.id]);

  const getTodayLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadTodayTimetable = async () => {
    if (!selectedClassId) return;
    setTimetableLoading(true);
    setTimetableError('');
    try {
      const todayDateStr = getTodayLocalDateStr();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDayName = days[new Date().getDay()];

      const [timetableRes, configsRes] = await Promise.all([
        schoolAdminService.getTimetable({
          class_id: selectedClassId,
          date: todayDateStr
        }).catch(() => ({})),
        schoolAdminService.getPeriodConfigurations({
          date: todayDateStr
        }).catch(() => [])
      ]);

      setPeriodConfigs(configsRes || []);
      const todayData = timetableRes[todayDayName]?.periods || [];
      
      // Filter only published periods
      const publishedTodayData = todayData.filter(p => p.is_published === 1 || p.is_published === true || String(p.is_published) === '1');
      setTodayTimetable(publishedTodayData);
    } catch (err) {
      console.error('Failed to load today timetable', err);
      setTimetableError('Failed to load today\'s timetable.');
    } finally {
      setTimetableLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      loadTodayTimetable();
    }
  }, [selectedClassId, currentYear?.id]);

  const getPeriodTimingStr = (num) => {
    const conf = periodConfigs.find(c => c.period_number === num);
    if (!conf) return '';
    
    const formatTime = (timeStr) => {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':');
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const formattedHr = hr % 12 || 12;
      return `${formattedHr}:${m} ${ampm}`;
    };

    return `${formatTime(conf.start_time)} – ${formatTime(conf.end_time)}`;
  };

  const getIntervalTimingStr = () => {
    if (!timetableSettings || !periodConfigs || periodConfigs.length === 0) return '';
    const afterNum = parseInt(timetableSettings.interval_after_period, 10);
    const duration = parseInt(timetableSettings.interval_duration, 10);
    if (!afterNum || !duration) return '';

    const afterConf = periodConfigs.find(c => c.period_number === afterNum);
    const beforeConf = periodConfigs.find(c => c.period_number === afterNum + 1);

    const formatTime = (timeStr) => {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':');
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const formattedHr = hr % 12 || 12;
      return `${formattedHr}:${m} ${ampm}`;
    };

    if (afterConf && beforeConf) {
      return `${formatTime(afterConf.end_time)} – ${formatTime(beforeConf.start_time)}`;
    }
    return '';
  };

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

        {/* Today's Timetable Panel */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Today's Timetable</h3>
            </div>
            {classes.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-secondary">Class:</span>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-border bg-surface text-xs font-semibold focus:outline-none shadow-2xs cursor-pointer min-w-[140px]"
                >
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {classes.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/80 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 px-6">
              <p className="text-sm font-bold text-text-primary">No classes available.</p>
              <p className="text-xs text-text-secondary mt-1">Please create a class to configure and view timetables.</p>
            </div>
          ) : timetableLoading ? (
            <div className="flex items-center justify-center py-12 text-xs text-text-muted font-semibold gap-2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Loading today's timetable...</span>
            </div>
          ) : timetableError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold text-center">
              {timetableError}
            </div>
          ) : todayTimetable.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/80 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 px-6">
              <p className="text-sm font-bold text-text-primary">No timetable has been published for today.</p>
              <p className="text-xs text-text-secondary mt-1">Please publish today's timetable to view scheduled periods.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(() => {
                const sortedPeriods = [...todayTimetable].sort((a, b) => a.period_number - b.period_number);
                const intervalAfter = timetableSettings ? parseInt(timetableSettings.interval_after_period, 10) : null;
                const intervalDuration = timetableSettings ? parseInt(timetableSettings.interval_duration, 10) : 0;
                
                return sortedPeriods.reduce((acc, p, idx) => {
                  const timingStr = getPeriodTimingStr(p.period_number);
                  const teacherName = p.is_backup ? p.backup_teacher_name : p.teacher_name;
                  
                  // Add normal period card
                  acc.push(
                    <div 
                      key={`period-${p.id}`} 
                      className="flex flex-col justify-between p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-border/60 rounded-xl space-y-2.5 shadow-2xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-wider">Period {p.period_number}</span>
                        <span className="text-[11px] font-black text-text-primary font-mono whitespace-nowrap">
                          {timingStr}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-text-primary truncate">{p.subject_name}</h4>
                        <p className="text-xs text-text-secondary font-semibold truncate flex items-center gap-1.5">
                          {teacherName}
                          {p.is_backup && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full select-none">
                              Backup
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );

                  // If interval exists after this period
                  if (intervalAfter && p.period_number === intervalAfter && intervalDuration > 0) {
                    const intervalTimeStr = getIntervalTimingStr();
                    acc.push(
                      <div 
                        key="interval-break" 
                        className="flex flex-col justify-between p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">Interval Break</span>
                          <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">
                            {intervalTimeStr}
                          </span>
                        </div>
                        <div className="py-1">
                          <span className="text-xs text-amber-600 dark:text-amber-400/80 font-bold uppercase tracking-wider">Break Time</span>
                        </div>
                      </div>
                    );
                  }

                  return acc;
                }, []);
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
