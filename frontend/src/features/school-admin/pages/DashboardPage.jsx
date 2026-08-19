import React, { useState, useEffect } from 'react';
import {
  Users, UserCog, Banknote, FileText, UserPlus, ClipboardCheck,
  CreditCard, BookMarked, PieChart
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { Dialog } from '../../../common/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../common/ui/table';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { LineChart } from '../../../common/ui/charts/LineChart';
import { ChartCard } from '../../../common/ui/charts/ChartCard';
import { SkeletonStatGrid, SkeletonChart } from '../../../common/ui/skeleton';
import { StatCard } from '../../../common/components/StatCard';
import { formatCurrency } from '../../../common/utils/format';
import { OnboardingChecklist } from '../../../common/components/OnboardingChecklist';

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

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [todayTimetable, setTodayTimetable] = useState([]);
  const [periodConfigs, setPeriodConfigs] = useState([]);
  const [timetableSettings, setTimetableSettings] = useState(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState('');
  const [feeStructures, setFeeStructures] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [stuData, stfData, exData, fpData, statsData, classesList, settings, feeStructData] = await Promise.all([
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
        schoolAdminService.getTimetableSettings().catch(() => null),
        schoolService.getFeeStructures().catch(() => [])
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
      setFeeStructures(feeStructData || []);
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
      <div className="space-y-8">
        <SkeletonStatGrid count={4} />
        <div className="grid grid-cols-1 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

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
      {/*
        Persists until every step is complete or the admin dismisses it.
        A new school admin previously had to infer setup order by hitting
        errors (e.g. adding a class before an academic year exists).
      */}
      <OnboardingChecklist
        scopeKey={currentYear?.school_id ?? currentYear?.id ?? 'default'}
        items={[
          { id: 'classes', label: 'Add classes & sections', done: classes.length > 0, onClick: () => onNavigate?.('classes') },
          { id: 'fee-structure', label: 'Set up a fee structure', done: feeStructures.length > 0, onClick: () => onNavigate?.('finance') },
          { id: 'teachers', label: 'Add teachers', done: staff.length > 0, onClick: () => onNavigate?.('staff') },
          { id: 'students', label: 'Enrol students', done: students.length > 0, onClick: () => onNavigate?.('classes') },
          { id: 'timetable', label: 'Build the timetable', done: !!timetableSettings, onClick: () => onNavigate?.('timetable') },
          { id: 'exams', label: 'Create an examination', done: exams.length > 0, onClick: () => onNavigate?.('exams') },
        ]}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/*
          Real StatCard: consistent tokenised styling, an icon anchor per
          metric, and click-through to the filtered view where one exists.
          No delta/trend is shown - the backend does not yet return a prior-
          period comparison, and a fabricated trend arrow would be worse than
          none (see phase-0 principle: never invent data the source can't back).
        */}
        <StatCard label="Total students" value={totalStudents} icon={Users} />
        <StatCard label="Total teachers" value={totalStaff} icon={UserCog} />
        <StatCard
          label="Fee collected"
          value={formatCurrency(totalFeeCollected)}
          icon={Banknote}
          color="bg-chart-2/10 text-chart-2"
          onClick={onNavigate ? () => onNavigate('collection-history') : undefined}
        />
        <StatCard
          label="Dues pending"
          value={formatCurrency(pendingFees)}
          icon={CreditCard}
          color="bg-warning-50 text-warning-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Monthly Fee Collection */}
        <ChartCard
          title="Monthly fee collection"
          subtitle={`Collection per month for academic year ${currentYear?.name || ''}`}
          icon={Banknote}
          iconTone="text-chart-2"
          loading={loading}
          isEmpty={!FEE_DATA.some(d => (d.amount || 0) > 0)}
          emptyMessage="No fee payments recorded for this academic year yet."
        >
          <LineChart data={FEE_DATA} series={2} formatValue={formatCurrency} />
        </ChartCard>

        {/* Salary Disbursement */}
        <ChartCard
          title="Salary disbursement"
          subtitle="Monthly staff salary disbursements"
          icon={CreditCard}
          iconTone="text-chart-6"
          loading={loading}
          isEmpty={!SALARY_DATA.some(d => (d.amount || 0) > 0)}
          emptyMessage="No salary disbursements recorded for this academic year yet."
        >
          <LineChart
            data={SALARY_DATA}
            series={6}
            formatValue={formatCurrency}
            onPointClick={(item) => onNavigate('salary-disbursement?month=' + encodeURIComponent(item.label))}
          />
        </ChartCard>
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
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Period {p.period_number}</span>
                        <span className="text-[11px] font-bold text-text-primary font-mono whitespace-nowrap">
                          {timingStr}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-text-primary truncate">{p.subject_name}</h4>
                        <p className="text-xs text-text-secondary font-semibold truncate flex items-center gap-1.5">
                          {teacherName}
                          {p.is_backup && (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full select-none">
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
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Interval Break</span>
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">
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
