import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Users, Check, AlertCircle, Save, Download, Clock, QrCode, UserCheck, ShieldAlert, Award, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { schoolService } from '../../../common/services/schoolService';
import { useToast } from '../../../common/components/Toast';

const getTodayLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ACADEMIC_MONTHS = [
  { value: 4, name: 'April' },
  { value: 5, name: 'May' },
  { value: 6, name: 'June' },
  { value: 7, name: 'July' },
  { value: 8, name: 'August' },
  { value: 9, name: 'September' },
  { value: 10, name: 'October' },
  { value: 11, name: 'November' },
  { value: 12, name: 'December' },
  { value: 1, name: 'January' },
  { value: 2, name: 'February' },
  { value: 3, name: 'March' },
];

const parseTimeString = (timeStr) => {
  if (!timeStr) return { hour: '08', minute: '30', period: 'AM' };
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2];
    const p = match[3].toUpperCase();
    return { hour: h, minute: m, period: p };
  }
  return { hour: '08', minute: '30', period: 'AM' };
};

export function TeacherAttendanceView() {
  const toast = useToast();
  const [teacherTab, setTeacherTab] = useState('daily'); // 'daily', 'report', 'settings'
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());

  const handleShiftDate = (days) => {
    if (!selectedDate) return;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return;
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dt.setDate(dt.getDate() + days);

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;

    const maxDate = getTodayLocalDateString();
    if (days > 0 && maxDate && newDateStr > maxDate) return;

    setSelectedDate(newDateStr);
  };

  // Daily State
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyData, setDailyData] = useState(null);
  const [dailyMap, setDailyMap] = useState({});
  const [savingDaily, setSavingDaily] = useState(false);

  // Monthly Report State
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Settings State
  const [entryHour, setEntryHour] = useState('08');
  const [entryMinute, setEntryMinute] = useState('30');
  const [entryPeriod, setEntryPeriod] = useState('AM');
  const [allowedLeaves, setAllowedLeaves] = useState('0');
  const [initialSettings, setInitialSettings] = useState({ entryTime: '08:30 AM', allowedLeaves: '0' });
  const [showSaveSettingsModal, setShowSaveSettingsModal] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // QR Token State
  const [qrPayload, setQrPayload] = useState('');
  const [qrSchoolName, setQrSchoolName] = useState('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [showConfirmQrModal, setShowConfirmQrModal] = useState(false);

  // Load Daily Data
  const loadDailyData = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const res = await schoolService.getTeacherAttendance({ date: selectedDate });
      const data = res.data?.data || res;
      setDailyData(data);
      const map = {};
      (data.records || []).forEach(r => {
        map[r.staff_id] = {
          status: r.status || 'Present',
          entry_time: r.entry_time || '—'
        };
      });
      setDailyMap(map);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load teacher attendance.');
    } finally {
      setLoadingDaily(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    if (teacherTab === 'daily') {
      loadDailyData();
    }
  }, [teacherTab, loadDailyData]);

  // Load Monthly Report
  const loadMonthlyReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const data = await schoolService.getTeacherAttendanceReport({ month: reportMonth, year: reportYear });
      setReportData(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load teacher monthly report.');
    } finally {
      setLoadingReport(false);
    }
  }, [reportMonth, reportYear, toast]);

  useEffect(() => {
    if (teacherTab === 'report') {
      loadMonthlyReport();
    }
  }, [teacherTab, loadMonthlyReport]);

  // Load Settings & QR
  const loadSettingsAndQr = useCallback(async () => {
    setLoadingSettings(true);
    setLoadingQr(true);
    try {
      const st = await schoolService.getTeacherAttendanceSettings();
      const rawTime = st.entry_time || '08:30 AM';
      const parsedTime = parseTimeString(rawTime);
      setEntryHour(parsedTime.hour);
      setEntryMinute(parsedTime.minute);
      setEntryPeriod(parsedTime.period);

      const leavesVal = (st.allowed_leaves !== null && st.allowed_leaves !== undefined && String(st.allowed_leaves).trim() !== '') 
        ? String(st.allowed_leaves) 
        : '0';
      setAllowedLeaves(leavesVal);

      const formattedTime = `${parsedTime.hour}:${parsedTime.minute} ${parsedTime.period}`;
      setInitialSettings({ entryTime: formattedTime, allowedLeaves: leavesVal });

      const qr = await schoolService.getTeacherAttendanceQrToken();
      setQrPayload(qr?.qr_payload || qr?.data?.qr_payload || qr?.data?.data?.qr_payload || '');
      setQrSchoolName(qr?.school_name || qr?.data?.school_name || qr?.data?.data?.school_name || '');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load teacher attendance settings.');
    } finally {
      setLoadingSettings(false);
      setLoadingQr(false);
    }
  }, [toast]);

  useEffect(() => {
    if (teacherTab === 'settings') {
      loadSettingsAndQr();
    }
  }, [teacherTab, loadSettingsAndQr]);

  // Handlers
  const handleStatusChange = (staffId, status) => {
    setDailyMap(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        status,
        entry_time: status === 'Present' ? (dailyData?.configured_entry_time || '08:30 AM') : '—'
      }
    }));
  };

  const handleSaveDaily = async () => {
    if (!dailyData || !dailyData.records) return;
    setSavingDaily(true);
    try {
      const records = dailyData.records.map(r => {
        const status = dailyMap[r.staff_id]?.status || r.status;
        return {
          staff_id: r.staff_id,
          status: status,
          entry_time: status === 'Present' ? (dailyData.configured_entry_time || '08:30 AM') : '—'
        };
      });
      await schoolService.markTeacherAttendance({ date: selectedDate, records });
      toast.success('Teacher attendance updated successfully.');
      loadDailyData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save teacher attendance.');
    } finally {
      setSavingDaily(false);
    }
  };

  const handleSaveSettingsClick = (e) => {
    e.preventDefault();
    setShowSaveSettingsModal(true);
  };

  const handleConfirmSaveSettings = async () => {
    setShowSaveSettingsModal(false);
    setSavingSettings(true);
    const formattedTime = `${entryHour}:${entryMinute} ${entryPeriod}`;
    try {
      await schoolService.saveTeacherAttendanceSettings({
        entry_time: formattedTime,
        allowed_leaves: allowedLeaves.trim() !== '' ? parseInt(allowedLeaves, 10) : 0
      });
      toast.success('Teacher attendance configurations updated successfully.');
      setInitialSettings({ entryTime: formattedTime, allowedLeaves: allowedLeaves });
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Generate QR Code Image Canvas
  const handleDownloadQr = () => {
    if (!qrPayload) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');

    // Fill White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 420);

    // Title text above QR Code ONLY
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Please scan me for Attendance', 200, 45);

    // Draw QR pattern container
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(50, 70, 300, 300, 16);
    } else {
      ctx.rect(50, 70, 300, 300);
    }
    ctx.fill();
    ctx.stroke();

    // Generate SVG/Image for QR
    const qrImg = new Image();
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;
    qrImg.crossOrigin = 'Anonymous';
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 75, 95, 250, 250);

      const link = document.createElement('a');
      link.download = `Teacher_Attendance_QR.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    qrImg.src = qrUrl;
  };

  const handleRefreshQr = async () => {
    setShowConfirmQrModal(false);
    setRefreshingQr(true);
    try {
      const res = await schoolService.refreshTeacherAttendanceQrToken();
      const payload = res?.qr_payload || res?.data?.qr_payload || res?.data?.data?.qr_payload || '';
      const schoolName = res?.school_name || res?.data?.school_name || res?.data?.data?.school_name || '';
      setQrPayload(payload);
      setQrSchoolName(schoolName);
      toast.success('QR Code regenerated successfully! Previous QR code is now expired.');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to regenerate QR code.');
    } finally {
      setRefreshingQr(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTeacherTab('daily')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            teacherTab === 'daily'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Daily Attendance
        </button>
        <button
          onClick={() => setTeacherTab('report')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            teacherTab === 'report'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Users className="h-4 w-4" />
          Monthly Report
        </button>
        <button
          onClick={() => setTeacherTab('settings')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-2 ${
            teacherTab === 'settings'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <QrCode className="h-4 w-4" />
          Settings & QR Code
        </button>
      </div>

      {/* TAB 1: DAILY ATTENDANCE */}
      {teacherTab === 'daily' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <Card className="border border-border bg-zinc-50/40 dark:bg-zinc-900/40 shadow-sm">
            <CardContent className="p-4 flex flex-wrap gap-4 items-end justify-between">
              <div className="flex items-center gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Select Date</label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleShiftDate(-1)}
                      className="h-10 w-10 shrink-0 bg-background border-border hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Previous Day"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      max={getTodayLocalDateString()}
                      className="h-10 bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleShiftDate(1)}
                      disabled={selectedDate >= getTodayLocalDateString()}
                      className="h-10 w-10 shrink-0 bg-background border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                      title="Next Day"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 hidden sm:block">
                  <span className="text-xs font-bold text-text-secondary uppercase block">Official Entry Time</span>
                  <span className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    {dailyData?.configured_entry_time || '08:30 AM'}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleSaveDaily}
                disabled={savingDaily || loadingDaily || dailyData?.is_disabled}
                className="h-10 px-5 font-bold text-xs bg-primary text-white rounded-xl shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {savingDaily ? 'Saving...' : 'Save Attendance'}
              </Button>
            </CardContent>
          </Card>

          {/* Sunday / Holiday Notice Banner */}
          {dailyData?.is_disabled && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-sm font-semibold flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{dailyData.disabled_reason || 'Attendance cannot be marked on Sundays or declared School Holidays.'}</span>
            </div>
          )}

          {/* Stats Bar */}
          {dailyData && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card className="p-3.5 bg-background border border-border">
                <p className="text-xs text-text-secondary font-medium">Total Teachers</p>
                <p className="text-2xl font-bold text-text-primary mt-1">{dailyData.total_teachers}</p>
              </Card>
              <Card className="p-3.5 bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Present</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{dailyData.present_count}</p>
              </Card>
              <Card className="p-3.5 bg-rose-500/5 border border-rose-500/20">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Absent</p>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{dailyData.absent_count}</p>
              </Card>
              <Card className="p-3.5 bg-amber-500/5 border border-amber-500/20">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Leave</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{dailyData.leave_count}</p>
              </Card>
              <Card className="p-3.5 bg-orange-500/5 border border-orange-500/20 col-span-2 sm:col-span-1">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Late Arrivals</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{dailyData.late_count}</p>
              </Card>
            </div>
          )}

          {/* Teacher Attendance Table */}
          <Card className="border border-border">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Daily Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDaily ? (
                <div className="p-8 text-center text-text-muted">Loading teacher attendance data...</div>
              ) : !dailyData || !dailyData.records || dailyData.records.length === 0 ? (
                <div className="p-8 text-center text-text-muted">No active teachers found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>EMP ID</TableHead>
                        <TableHead>Teacher Name</TableHead>
                        <TableHead>Entry Time</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Attendance Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyData.records.map(st => {
                        const mapItem = dailyMap[st.staff_id];
                        const currentStatus = mapItem?.status || st.status;
                        const isPresent = currentStatus === 'Present';
                        const displayEntryTime = isPresent
                          ? (mapItem?.entry_time || st.entry_time || dailyData.configured_entry_time)
                          : '—';
                        return (
                          <TableRow key={st.staff_id}>
                            <TableCell className="font-mono text-xs font-bold text-text-secondary">
                              {st.emp_id}
                            </TableCell>
                            <TableCell className="font-medium text-text-primary">
                              {st.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-text-primary">
                              {displayEntryTime}
                            </TableCell>
                            <TableCell>
                              {!isPresent ? (
                                <span className="text-xs text-text-secondary font-medium">—</span>
                              ) : st.is_late ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  {st.late_text || st.frequency_text || 'Late'}
                                </span>
                              ) : st.is_early ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  {st.early_text || st.frequency_text || 'Early'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  On Time
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {['Present', 'Absent', 'Leave'].map(stOption => {
                                  const isActive = currentStatus === stOption;
                                  let btnClass = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
                                  if (isActive) {
                                    if (stOption === 'Present') btnClass = 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
                                    if (stOption === 'Absent') btnClass = 'bg-rose-600 text-white border-rose-600 shadow-sm';
                                    if (stOption === 'Leave') btnClass = 'bg-amber-600 text-white border-amber-600 shadow-sm';
                                  }
                                  return (
                                    <button
                                      key={stOption}
                                      type="button"
                                      onClick={() => handleStatusChange(st.staff_id, stOption)}
                                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${btnClass}`}
                                    >
                                      {stOption}
                                    </button>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: MONTHLY REPORT */}
      {teacherTab === 'report' && (
        <div className="space-y-6">
          <Card className="border border-border bg-zinc-50/40 dark:bg-zinc-900/40 shadow-sm">
            <CardContent className="p-4 flex flex-wrap gap-4 items-end">
              <div className="w-56 space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Select Month</label>
                <Select value={reportMonth} onChange={(e) => setReportMonth(parseInt(e.target.value, 10))}>
                  {ACADEMIC_MONTHS.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-base font-bold">
                Attendance report for {ACADEMIC_MONTHS.find(m => m.value === reportMonth)?.name || 'August'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingReport ? (
                <div className="p-8 text-center text-text-muted">Loading monthly report...</div>
              ) : !reportData || (!reportData.teachers && !reportData.records) || ((reportData.teachers || reportData.records).length === 0) ? (
                <div className="p-8 text-center text-text-muted">No monthly records found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>EMP ID</TableHead>
                        <TableHead>Teacher Name</TableHead>
                        <TableHead className="text-center">Total Working Days</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Leave</TableHead>
                        <TableHead className="text-center">Late Days</TableHead>
                        <TableHead className="text-right">Attendance %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(reportData.teachers || reportData.records || []).map(t => (
                        <TableRow key={t.staff_id}>
                          <TableCell className="font-mono text-xs font-bold text-text-secondary">{t.emp_id}</TableCell>
                          <TableCell className="font-medium text-text-primary">{t.name}</TableCell>
                          <TableCell className="text-center font-semibold">{t.total_working_days}</TableCell>
                          <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400">{t.present_days}</TableCell>
                          <TableCell className="text-center font-semibold text-rose-600 dark:text-rose-400">{t.absent_days}</TableCell>
                          <TableCell className="text-center font-semibold text-amber-600 dark:text-amber-400">{t.leave_days}</TableCell>
                          <TableCell className="text-center font-semibold text-orange-600 dark:text-orange-400">{t.late_days}</TableCell>
                          <TableCell className="text-right font-bold text-primary">{t.attendance_percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: SETTINGS & QR CODE */}
      {teacherTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Settings */}
          <Card className="border border-border">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Teacher Attendance Configurations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loadingSettings ? (
                <div className="py-6 text-center text-text-muted">Loading configurations...</div>
              ) : (
                <form onSubmit={handleSaveSettingsClick} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary uppercase tracking-wide">
                      Official Teacher Entry Time
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={entryHour}
                        onChange={(e) => setEntryHour(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>

                      <select
                        value={entryMinute}
                        onChange={(e) => setEntryMinute(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      <select
                        value={entryPeriod}
                        onChange={(e) => setEntryPeriod(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Teachers scanning after this time will be automatically flagged as <strong className="text-rose-500">Late</strong>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary uppercase tracking-wide">
                      Allowed Teacher Leaves for each month
                    </label>
                    <Input
                      type="number"
                      value={allowedLeaves}
                      onChange={(e) => setAllowedLeaves(e.target.value)}
                      placeholder="0"
                      className="h-10"
                      min="0"
                    />
                    <p className="text-xs text-text-secondary">
                      If configured, leaves beyond this limit will automatically calculate extra unpaid leave deduction on monthly salary cards.
                    </p>
                  </div>

                  {(() => {
                    const currentFormattedTime = `${entryHour}:${entryMinute} ${entryPeriod}`;
                    const isDirty = (currentFormattedTime !== initialSettings.entryTime || allowedLeaves !== initialSettings.allowedLeaves);
                    return (
                      <Button
                        type="submit"
                        disabled={!isDirty || savingSettings}
                        className={`w-full h-10 font-bold rounded-xl shadow-md transition-all ${
                          !isDirty 
                            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border-0' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {savingSettings ? 'Saving...' : !isDirty ? 'Saved' : 'Save Configurations'}
                      </Button>
                    );
                  })()}
                </form>
              )}
            </CardContent>
          </Card>

          {/* QR Code Card */}
          <Card className="border border-border">
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Teacher Attendance QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center space-y-4">
              {loadingQr ? (
                <div className="py-12 text-text-muted">Generating secure QR code...</div>
              ) : (
                <>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-2xl inline-block shadow-inner">
                    {qrPayload ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`}
                        alt="Teacher Attendance QR Code"
                        className="w-52 h-52 mx-auto rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="w-52 h-52 flex items-center justify-center text-xs text-text-muted">
                        No QR Token
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-text-primary text-sm">{qrSchoolName || 'School Admin QR'}</h4>
                    <p className="text-xs text-text-secondary">Display or print this QR Code at the school entrance for teachers to scan via the Teacher Mobile App.</p>
                  </div>

                  <div className="pt-2 flex flex-wrap justify-center gap-3">
                    <Button
                      onClick={handleDownloadQr}
                      disabled={!qrPayload}
                      className="h-10 px-6 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download QR Code
                    </Button>
                    <Button
                      onClick={() => setShowConfirmQrModal(true)}
                      disabled={refreshingQr}
                      className="h-10 px-6 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2"
                    >
                      <RotateCw className={`h-4 w-4 ${refreshingQr ? 'animate-spin' : ''}`} />
                      {refreshingQr ? 'Regenerating...' : 'Regenerate QR Code'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal for Save Configurations */}
      {showSaveSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-lg font-bold text-text-primary">Confirm Configuration Update</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Are you sure you want to Update?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveSettingsModal(false)}
                disabled={savingSettings}
                className="h-10 px-5 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSaveSettings}
                disabled={savingSettings}
                className="h-10 px-5 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center gap-2"
              >
                {savingSettings ? 'Updating...' : 'Yes, Update'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Regenerate QR Code */}
      {showConfirmQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-border rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="text-lg font-bold text-text-primary">Regenerate Attendance QR Code?</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Are you sure you want to regenerate the Teacher Attendance QR Code? Once regenerated, the previous QR code will immediately expire and teachers will need to scan the new QR code to mark their attendance.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmQrModal(false)}
                className="h-10 px-5 font-semibold text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRefreshQr}
                disabled={refreshingQr}
                className="h-10 px-5 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md flex items-center gap-2"
              >
                {refreshingQr ? 'Regenerating...' : 'Regenerate QR Code'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
