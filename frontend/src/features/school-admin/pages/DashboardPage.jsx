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

// Modern SVG Line Chart Widget (12 Bullets with Hover Tooltip, No Bars, No Total Box)
function LineChartWidget({ title, subtitle, icon: Icon, data, colorTheme = 'emerald', onPointClick }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const amounts = (data || []).map(d => d.amount || 0);
  const maxVal = Math.max(...amounts, 1);

  // SVG dimensions
  const width = 1000;
  const height = 200;
  const paddingX = 40;
  const topY = 40;
  const bottomY = 155;
  const usableH = bottomY - topY;
  const usableW = width - (paddingX * 2);

  const points = (data || []).map((item, i) => {
    const amt = item.amount || 0;
    const ratio = maxVal > 0 ? (amt / maxVal) : 0;
    const x = paddingX + (i / Math.max((data || []).length - 1, 1)) * usableW;
    const y = bottomY - (ratio * usableH);
    return { x, y, amt, month: item.month, label: item.label, raw: item, i };
  });

  // Smooth Bezier Curve Path
  let linePathD = '';
  let areaPathD = '';

  if (points.length > 0) {
    linePathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      linePathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    areaPathD = `${linePathD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  }

  const strokeColor = colorTheme === 'indigo' ? '#6366f1' : '#10b981';
  const gradientId = `gradient-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      {/* Card Header without Total Box */}
      <div className="mb-6 border-b border-border/60 pb-4">
        <h3 className="text-base font-black text-text-primary tracking-tight font-display flex items-center gap-2">
          {Icon && <Icon className={`h-5 w-5 ${colorTheme === 'indigo' ? 'text-indigo-500' : 'text-primary'}`} />}
          {title}
        </h3>
        {subtitle && <p className="text-xs text-text-muted font-medium mt-0.5">{subtitle}</p>}
      </div>

      <div className="w-full overflow-x-auto scrollbar-none">
        <div className="min-w-[760px] relative pt-6 pb-2">
          {/* Background Grid Lines */}
          <div className="absolute inset-x-0 top-6 bottom-12 flex flex-col justify-between pointer-events-none opacity-30">
            <div className="border-b border-dashed border-border/80 w-full"></div>
            <div className="border-b border-dashed border-border/50 w-full"></div>
            <div className="border-b border-dashed border-border/50 w-full"></div>
            <div className="border-b border-dashed border-border/50 w-full"></div>
            <div className="border-b border-border w-full"></div>
          </div>

          {/* SVG Line Chart Graph */}
          <div className="relative h-56 w-full">
            <svg 
              viewBox={`0 0 ${width} ${height}`} 
              preserveAspectRatio="none" 
              className="w-full h-44 overflow-visible"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area Under Curve */}
              {areaPathD && <path d={areaPathD} fill={`url(#${gradientId})`} />}

              {/* Connected Line Path */}
              {linePathD && (
                <path 
                  d={linePathD} 
                  fill="none" 
                  stroke={strokeColor} 
                  strokeWidth="3.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              )}

              {/* Perpendicular Vertical Drop Guidelines for each Bullet Point */}
              {points.map((pt) => (
                <line 
                  key={`drop-${pt.i}`}
                  x1={pt.x} 
                  y1={pt.y} 
                  x2={pt.x} 
                  y2={bottomY} 
                  stroke={strokeColor} 
                  strokeWidth="1.5" 
                  strokeDasharray="3 3" 
                  strokeOpacity={hoveredIdx === pt.i ? "0.6" : "0.15"} 
                  className="transition-opacity duration-200"
                />
              ))}

              {/* 12 Bullet Points (Dots) on Line */}
              {points.map((pt) => {
                const isHovered = hoveredIdx === pt.i;
                return (
                  <g key={pt.i}>
                    {isHovered && (
                      <circle 
                        cx={pt.x} 
                        cy={pt.y} 
                        r="12" 
                        fill={strokeColor} 
                        fillOpacity="0.25" 
                        className="animate-ping"
                      />
                    )}
                    <circle 
                      cx={pt.x} 
                      cy={pt.y} 
                      r={isHovered ? "7" : "5.5"} 
                      fill="#ffffff" 
                      stroke={strokeColor} 
                      strokeWidth={isHovered ? "4" : "3"} 
                      className="transition-all duration-200 cursor-pointer shadow-md"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Column Triggers, Hover Tooltips & Month Labels */}
            <div className="absolute inset-0 flex justify-between pointer-events-none">
              {points.map((pt) => {
                const isHovered = hoveredIdx === pt.i;
                const pctX = (pt.x / width) * 100;
                const pctY = (pt.y / height) * 100;

                return (
                  <div 
                    key={pt.i} 
                    className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-auto cursor-pointer group"
                    style={{ left: `${pctX}%`, transform: 'translateX(-50%)', width: '60px' }}
                    onMouseEnter={() => setHoveredIdx(pt.i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={onPointClick ? () => onPointClick(pt.raw) : undefined}
                  >
                    {/* Floating Tooltip Badge on Hover */}
                    <div 
                      className={`absolute transition-all duration-200 pointer-events-none select-none z-20 ${
                        isHovered ? 'opacity-100 scale-105 -translate-y-2' : 'opacity-0 scale-95 translate-y-0'
                      }`}
                      style={{ top: `calc(${pctY * 0.78}% - 34px)` }}
                    >
                      <div className="px-2.5 py-1 text-[11px] font-black rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xl border border-zinc-700 dark:border-zinc-200 whitespace-nowrap">
                        ₹{Math.round(pt.amt).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* X-Axis Month Label at the bottom */}
                    <div className="absolute bottom-0 text-center">
                      <span className={`text-[11px] font-extrabold transition-colors select-none ${
                        isHovered ? (colorTheme === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' : 'text-primary') : 'text-text-muted'
                      }`}>
                        {pt.month}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        schoolService.getStudents().catch(() => []),
        schoolService.getStaff().catch(() => []),
        schoolService.getExams().catch(() => []),
        schoolService.getFeePayments().catch(() => []),
        schoolService.getStats().catch(() => ({
          students_count: 0,
          staff_count: 0,
          classes_count: 0,
          pending_fees: 0,
          total_collected: 0,
          fee_collection_chart: [],
          salary_disbursement_chart: []
        })),
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

    const handleRefresh = () => {
      fetchDashboardData();
    };

    window.addEventListener('fee-payment-updated', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    return () => {
      window.removeEventListener('fee-payment-updated', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
    };
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

  const handleDownloadSalarySlip = (staffObj, monthName) => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const basic = Math.round((staffObj.salary || 0) * 0.7);
    const allowances = Math.round((staffObj.salary || 0) * 0.25);
    const bonus = monthName === 'December' ? 13000 : 0;
    const deductions = Math.round((staffObj.salary || 0) * 0.05);
    const netPaid = basic + allowances + bonus - deductions;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Salary Slip - ${staffObj.name || ''} - ${monthName} 2026</title>
  <meta charset="utf-8" />
  <style>
    body { font-family: sans-serif; padding: 40px; color: #1f2937; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; background: #f9fafb; padding: 20px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    .text-right { text-align: right; }
    .total { font-weight: bold; background: #f9fafb; }
  </style>
</head>
<body>
  <div class="header">
    <div><h2>SHIKSHA PILOT SCHOOL</h2><p>Official Salary Statement</p></div>
    <div style="text-align:right"><h2>Salary Slip</h2><p>${monthName} 2026</p></div>
  </div>
  <div class="details">
    <div>
      <p><strong>Employee:</strong> ${staffObj.name || '-'}</p>
      <p><strong>Designation:</strong> ${staffObj.designation || '-'}</p>
    </div>
    <div>
      <p><strong>Payment Month:</strong> ${monthName} 2026</p>
      <p><strong>Date:</strong> ${today}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead>
    <tbody>
      <tr><td>Basic Salary</td><td class="text-right">Rs ${basic.toLocaleString()}</td></tr>
      <tr><td>Allowances</td><td class="text-right">Rs ${allowances.toLocaleString()}</td></tr>
      <tr><td>Bonus</td><td class="text-right">Rs ${bonus.toLocaleString()}</td></tr>
      <tr><td>Deductions</td><td class="text-right">Rs ${deductions.toLocaleString()}</td></tr>
      <tr class="total"><td>Net Salary Paid</td><td class="text-right">Rs ${netPaid.toLocaleString()}</td></tr>
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    printWindow.document.write(html);
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
    const num = Math.round(parseFloat(val || 0));
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
          { label: 'Fee Collected', value: formatCurrency(totalFeeCollected), clickPath: currentYear?.status === 'ACTIVE' ? 'collection-history' : null },
          { label: 'Dues Pending', value: formatCurrency(pendingFees) },
        ].map(card => {
          return (
            <Card 
              key={card.label} 
              className={`shadow-sm ${card.clickPath ? 'cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-md' : ''}`}
              onClick={card.clickPath && onNavigate ? () => onNavigate(card.clickPath) : undefined}
            >
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
        <LineChartWidget
          title="Monthly Fee Collection"
          subtitle={`Live collection breakdown per month for academic year ${currentYear?.name || ''}`}
          icon={Banknote}
          data={FEE_DATA}
          colorTheme="emerald"
        />

        {/* Salary Disbursement */}
        <LineChartWidget
          title="Salary Disbursement"
          subtitle="Live monthly staff salary disbursements"
          icon={CreditCard}
          data={SALARY_DATA}
          colorTheme="emerald"
          onPointClick={(item) => onNavigate('salary-disbursement?month=' + encodeURIComponent(item.label))}
        />
      </div>

        {/* Today's Timetable Panel */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Today&apos;s Timetable</h3>
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
              <span>Loading today&apos;s timetable...</span>
            </div>
          ) : timetableError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold text-center">
              {timetableError}
            </div>
          ) : todayTimetable.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border/80 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 px-6">
              <p className="text-sm font-bold text-text-primary">No timetable has been published for today.</p>
              <p className="text-xs text-text-secondary mt-1">Please publish today&apos;s timetable to view scheduled periods.</p>
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
    );
  }
