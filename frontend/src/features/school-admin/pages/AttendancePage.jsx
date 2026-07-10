import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Check, AlertCircle, Edit2, Save, FileText, CheckCircle2, Trash2, Plus, MoreVertical, Lock } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { schoolService } from '../../../common/services/schoolService';
import { useToast } from '../../../common/components/Toast';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';
import { Dialog } from '../../../common/ui/dialog';

export default function AttendancePage() {
  const { isReadOnly, currentYear } = useAcademicYear();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'report', or 'leave'

  // Common data
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Daily state
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [isCompletedMode, setIsCompletedMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Report state
  const [selectedReportMonth, setSelectedReportMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [reportStudents, setReportStudents] = useState([]);
  const [reportAttendance, setReportAttendance] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // Leave Days state
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [newLeaveTitle, setNewLeaveTitle] = useState('');
  const [newLeaveDate, setNewLeaveDate] = useState('');
  const [holidayFormError, setHolidayFormError] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Three-dot menu and inline editing state
  const [openMenuHolidayId, setOpenMenuHolidayId] = useState(null);
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState('');

  // Delete Holiday state
  const [holidayToDelete, setHolidayToDelete] = useState(null);
  const [deletingHoliday, setDeletingHoliday] = useState(false);

  // Load classes initially
  useEffect(() => {
    setLoadingClasses(true);
    schoolService.getClasses()
      .then(data => {
        setClasses(data || []);
        if (data && data.length > 0) {
          const names = Array.from(new Set(data.map(c => c.name)));
          setSelectedClassName(names[0] || '');
          setSelectedSection(''); // Always default to Select Section placeholder ('')
        }
      })
      .catch(() => {
        toast.error('Failed to load classes.');
      })
      .finally(() => {
        setLoadingClasses(false);
      });
  }, []);

  const handleClassChange = (e) => {
    const className = e.target.value;
    setSelectedClassName(className);
    setSelectedSection(''); // Always reset section selection on class change
    setStudents([]);
    setAttendanceRecords([]);
    setAttendanceMap({});
  };

  const handleSectionChange = (e) => {
    setSelectedSection(e.target.value);
    setStudents([]);
    setAttendanceRecords([]);
    setAttendanceMap({});
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    const todayStr = new Date().toISOString().split('T')[0];
    const minDate = currentYear?.start_date || '';
    
    if (minDate && val < minDate) {
      toast.warning(`Cannot select a date before the academic year started (${minDate}).`);
      setSelectedDate(minDate);
      return;
    }
    if (val > todayStr) {
      toast.warning("Cannot select a future date.");
      setSelectedDate(todayStr);
      return;
    }
    setSelectedDate(val);
  };

  const activeClass = classes.find(c => 
    c.name === selectedClassName && 
    ((c.section || '') === selectedSection || (!c.section && !selectedSection))
  );

  // Load daily attendance and students
  const loadDailyData = useCallback(async () => {
    if (!activeClass) return;
    setLoadingStudents(true);
    try {
      const stData = await schoolService.getStudents({ class_id: activeClass.id });
      setStudents(stData || []);

      const attData = await schoolService.getAttendance({ class_id: activeClass.id, date: selectedDate });
      setAttendanceRecords(attData || []);

      const map = {};
      if (attData && attData.length > 0) {
        attData.forEach(r => {
          map[r.student_id] = r.status;
        });
        setAttendanceMap(map);
        setIsCompletedMode(true);
        setIsEditing(false);
      } else {
        stData.forEach(s => {
          map[s.id] = 'Present';
        });
        setAttendanceMap(map);
        setIsCompletedMode(false);
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load daily attendance data.');
    } finally {
      setLoadingStudents(false);
    }
  }, [activeClass, selectedDate]);

  useEffect(() => {
    loadDailyData();
  }, [loadDailyData]);

  // Load report data
  const loadReportData = useCallback(async () => {
    if (!activeClass) return;
    setLoadingReport(true);
    try {
      const [stData, attData] = await Promise.all([
        schoolService.getStudents({ class_id: activeClass.id }),
        schoolService.getAttendance({ class_id: activeClass.id })
      ]);
      setReportStudents(stData || []);
      setReportAttendance(attData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load monthly attendance report data.');
    } finally {
      setLoadingReport(false);
    }
  }, [activeClass]);

  useEffect(() => {
    if (activeTab === 'report') {
      loadReportData();
    }
  }, [activeTab, loadReportData]);

  // Load Holidays list
  const loadHolidays = useCallback(() => {
    setLoadingHolidays(true);
    schoolService.getHolidays()
      .then(data => {
        setHolidays(data || []);
      })
      .catch(() => {
        toast.error('Failed to load holidays.');
      })
      .finally(() => {
        setLoadingHolidays(false);
      });
  }, [toast]);

  // Always load holidays initially and whenever academic year changes
  useEffect(() => {
    loadHolidays();
  }, [loadHolidays, currentYear]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSaveAttendance = async () => {
    if (!activeClass) return;
    setSavingAttendance(true);
    try {
      await Promise.all(
        students.map(s => {
          return schoolService.markAttendance({
            student_id: s.id,
            class_id: activeClass.id,
            date: selectedDate,
            status: attendanceMap[s.id] || 'Present'
          });
        })
      );
      toast.success('Attendance saved successfully.', 'Success');
      await loadDailyData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save student attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Holiday creation
  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    setHolidayFormError('');
    if (!newLeaveTitle.trim()) {
      setHolidayFormError('Holiday title is required.');
      return;
    }
    if (!newLeaveDate) {
      setHolidayFormError('Holiday date is required.');
      return;
    }

    if (currentYear) {
      if (newLeaveDate < currentYear.start_date || newLeaveDate > currentYear.end_date) {
        setHolidayFormError(`Holiday date must be within the active Academic Year (${currentYear.start_date} to ${currentYear.end_date}).`);
        return;
      }
    }

    setSavingHoliday(true);
    try {
      await schoolService.createHoliday({
        name: newLeaveTitle.trim(),
        date: newLeaveDate
      });
      toast.success('Holiday created successfully.');
      setNewLeaveTitle('');
      setNewLeaveDate('');
      loadHolidays();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to create holiday.';
      setHolidayFormError(errMsg);
    } finally {
      setSavingHoliday(false);
    }
  };

  // Holiday updating
  const handleUpdateHoliday = async (id) => {
    setEditError('');
    if (!editName.trim()) {
      setEditError('Holiday name is required.');
      return;
    }
    if (!editDate) {
      setEditError('Holiday date is required.');
      return;
    }

    if (currentYear) {
      if (editDate < currentYear.start_date || editDate > currentYear.end_date) {
        setEditError(`Holiday date must be within the active Academic Year (${currentYear.start_date} to ${currentYear.end_date}).`);
        return;
      }
    }

    try {
      await schoolService.updateHoliday(id, {
        name: editName.trim(),
        date: editDate
      });
      toast.success('Holiday updated successfully.');
      setEditingHolidayId(null);
      loadHolidays();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to update holiday.';
      setEditError(errMsg);
    }
  };

  // Holiday deleting modal trigger
  const handleDeleteHoliday = (h) => {
    setHolidayToDelete(h);
  };

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    setDeletingHoliday(true);
    try {
      await schoolService.deleteHoliday(holidayToDelete.id);
      toast.success('Holiday deleted successfully.');
      setHolidayToDelete(null);
      loadHolidays();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete holiday.');
    } finally {
      setDeletingHoliday(false);
    }
  };

  const startEditHoliday = (h) => {
    setEditingHolidayId(h.id);
    setEditName(h.name);
    setEditDate(h.date);
    setEditError('');
  };

  // Helper to check if a date is Sunday
  const getIsSunday = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.getDay() === 0;
  };

  // Helper to check if a date is a registered Holiday
  const getIsHoliday = (dateStr) => {
    return holidays.some(h => h.date === dateStr);
  };

  const isNonWorkingDaySelected = getIsSunday(selectedDate) || getIsHoliday(selectedDate);

  // Sort students by Roll Number in ascending order
  const getSortedStudents = (studentList) => {
    return [...studentList].sort((a, b) => {
      const aRoll = a.roll_no ? parseInt(a.roll_no, 10) : 999999;
      const bRoll = b.roll_no ? parseInt(b.roll_no, 10) : 999999;
      if (isNaN(aRoll) && isNaN(bRoll)) return 0;
      if (isNaN(aRoll)) return 1;
      if (isNaN(bRoll)) return -1;
      return aRoll - bRoll;
    });
  };

  const sortedStudents = getSortedStudents(students);
  const sortedReportStudents = getSortedStudents(reportStudents);

  // Calculations for Completed mode
  const presentCount = Object.values(attendanceMap).filter(v => v === 'Present').length;
  const totalDailyStudents = sortedStudents.length;
  const dailyAttendanceRate = totalDailyStudents > 0 
    ? Math.round((presentCount / totalDailyStudents) * 100) 
    : 0;

  // Monthly Report Calculations (Filter out Sundays and Holidays)
  const getYearForReportMonth = () => {
    if (!currentYear) return new Date().getFullYear();
    const start = new Date(currentYear.start_date);
    const end = new Date(currentYear.end_date);
    const startMonth = start.getMonth() + 1; // 1-12
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    return Number(selectedReportMonth) >= startMonth ? startYear : endYear;
  };

  const reportYear = getYearForReportMonth();

  const getFilteredReportRecords = () => {
    return reportAttendance.filter(r => {
      const d = new Date(r.date);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      return m === Number(selectedReportMonth) && y === Number(reportYear);
    });
  };

  const filteredRecords = getFilteredReportRecords();

  // Exclude Sundays and Holidays from the calculations
  const workingRecords = filteredRecords.filter(r => !getIsSunday(r.date) && !getIsHoliday(r.date));
  const uniqueDates = Array.from(new Set(workingRecords.map(r => r.date)));
  const totalWorkingDays = uniqueDates.length;

  const reportRows = sortedReportStudents.map(student => {
    const studentRecs = workingRecords.filter(r => r.student_id === student.id);
    const present = studentRecs.filter(r => r.status === 'Present').length;
    const absent = studentRecs.filter(r => r.status === 'Absent').length;
    const leave = studentRecs.filter(r => r.status === 'Leave' || r.status === 'Late').length;
    const percentage = totalWorkingDays > 0 ? Math.round((present / totalWorkingDays) * 100) : 0;

    return {
      student,
      present,
      absent,
      leave,
      percentage
    };
  });

  const totalReportRecords = workingRecords.length;
  const presentReportRecords = workingRecords.filter(r => r.status === 'Present').length;
  const monthlyAttendanceRate = totalReportRecords > 0 
    ? Math.round((presentReportRecords / totalReportRecords) * 100) 
    : 0;

  const uniqueClasses = Array.from(new Set(classes.map(c => c.name)));
  const uniqueSections = Array.from(new Set(classes.filter(c => c.name === selectedClassName && c.section).map(c => c.section))).sort();

  // Holidays list sorted chronologically
  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Attendance</h2>
          <p className="text-text-secondary text-sm mt-1">Mark student daily attendance and review reports.</p>
        </div>
        {isReadOnly && (
          <Button
            onClick={() => navigate('/school-admin/attendance/leaderboard')}
            className="h-10 px-5 font-black text-xs bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl shadow-lg shadow-amber-500/25 border-0 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center gap-2 tracking-wide uppercase"
          >
            🏆 Attendance Leaderboard
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'daily'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Daily Attendance
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'report'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Monthly Report
        </button>
        <button
          onClick={() => setActiveTab('leave')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'leave'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Leave Days
        </button>
      </div>

      {activeTab !== 'leave' && (
        /* Dropdown controls for Attendance marking and Report */
        <Card className="border border-border bg-zinc-50/40 dark:bg-zinc-900/40 shadow-sm">
          <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px] space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              <Select value={selectedClassName} onChange={handleClassChange} disabled={loadingClasses}>
                {loadingClasses ? (
                  <option>Loading...</option>
                ) : (
                  uniqueClasses.map(name => <option key={name} value={name}>{name}</option>)
                )}
              </Select>
            </div>

            {uniqueSections.length > 0 && (
              <div className="flex-1 min-w-[120px] space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Section</label>
                <Select 
                  value={selectedSection} 
                  onChange={handleSectionChange} 
                  disabled={loadingClasses}
                >
                  <option value="">Select Section</option>
                  {uniqueSections.map(sec => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {activeTab === 'daily' && (
              <div className="flex-1 min-w-[150px] space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Date</label>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={handleDateChange} 
                  min={currentYear?.start_date || ''}
                  max={new Date().toISOString().split('T')[0]}
                  className="h-9" 
                />
              </div>
            )}

            {activeTab === 'report' && (
              <div className="flex-1 min-w-[120px] space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Month</label>
                <Select value={selectedReportMonth} onChange={e => setSelectedReportMonth(e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const monthName = new Date(2026, m - 1).toLocaleString('default', { month: 'long' });
                    return <option key={m} value={m}>{monthName}</option>;
                  })}
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main tab area */}
      {loadingStudents || loadingReport || loadingHolidays ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Retrieving records...</p>
        </div>
      ) : activeTab === 'daily' ? (
        !activeClass ? (
          <Card className="border-dashed border-2 py-12 text-center text-text-muted">
            <CardContent>Please select a Class and Section to manage daily attendance.</CardContent>
          </Card>
        ) : isNonWorkingDaySelected ? (
          /* Professional Empty-State for Sundays & Holidays */
          <Card className="border-dashed border-2 py-16 text-center text-text-muted max-w-lg mx-auto mt-6">
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <Calendar className="h-10 w-10 text-text-muted mb-2 animate-bounce" />
              <h3 className="text-lg font-black text-text-primary">📅 No Attendance Required</h3>
              <p className="text-sm text-text-secondary max-w-sm">
                Attendance is not required for the selected date because it is a scheduled holiday or weekend.
              </p>
              <p className="text-xs text-text-muted">
                Please choose another working day to mark student attendance.
              </p>
            </CardContent>
          </Card>
        ) : sortedStudents.length === 0 ? (
          <Card className="border-dashed border-2 py-12 text-center text-text-muted">
            <CardContent>No students enrolled in the selected Class/Section.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Daily Header Controls */}
            {isCompletedMode && !isEditing ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-50 border border-border dark:bg-zinc-900/60 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Attendance Completed
                  </span>
                  {!isReadOnly && (
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-3.5 w-3.5" /> Update Attendance
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border ${
                    dailyAttendanceRate >= 75
                      ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : dailyAttendanceRate >= 50
                        ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-500/20'
                        : 'bg-red-100 dark:bg-red-950/40 text-red-700 border-red-500/20'
                  }`}>
                    <span className={`relative flex h-2 w-2`}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        dailyAttendanceRate >= 75
                          ? 'bg-emerald-400'
                          : dailyAttendanceRate >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                      }`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        dailyAttendanceRate >= 75
                          ? 'bg-emerald-500'
                          : dailyAttendanceRate >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`} />
                    </span>
                    Attendance Rate: {dailyAttendanceRate}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-50 border border-border dark:bg-zinc-900/60 rounded-xl">
                <div>
                  <span className="text-sm font-bold text-text-primary">Total Students: <strong className="text-base font-black">{sortedStudents.length}</strong></span>
                </div>
              </div>
            )}

            {/* Grid of Student Cards */}
            {isCompletedMode && !isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                {sortedStudents.map(s => {
                  const status = attendanceMap[s.id] || 'Present';
                  let cardStyle = '';
                  let badgeStyle = '';
                  
                  if (status === 'Present') {
                    cardStyle = 'border-emerald-500/30 bg-emerald-50/5 dark:bg-emerald-950/10 hover:border-emerald-500/50';
                    badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                  } else if (status === 'Absent') {
                    cardStyle = 'border-red-500/30 bg-red-50/5 dark:bg-red-950/10 hover:border-red-500/50';
                    badgeStyle = 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
                  } else {
                    cardStyle = 'border-amber-500/30 bg-amber-50/5 dark:bg-amber-950/10 hover:border-amber-500/50';
                    badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
                  }

                  return (
                    <Card key={s.id} className={`transition-all duration-300 border ${cardStyle} shadow-sm rounded-xl overflow-hidden`}>
                      <CardContent className="p-4 flex flex-col justify-between h-full gap-3">
                        <div>
                          <h4 className="font-bold text-text-primary text-sm tracking-tight">{s.name}</h4>
                          <p className="text-[10px] font-bold text-text-secondary uppercase mt-0.5">Roll No: {s.roll_no || 'N/A'}</p>
                        </div>
                        <div className="flex justify-end">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${badgeStyle}`}>
                            {status}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                {sortedStudents.map(s => {
                  const status = attendanceMap[s.id] || 'Present';
                  return (
                    <Card key={s.id} className="transition-all duration-200 border border-border bg-surface hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm rounded-xl overflow-hidden">
                      <CardContent className="p-4 flex flex-col justify-between h-full gap-4">
                        <div>
                          <h4 className="font-bold text-text-primary text-sm tracking-tight">{s.name}</h4>
                          <p className="text-[10px] font-bold text-text-secondary uppercase mt-0.5">Roll No: {s.roll_no || 'N/A'}</p>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            disabled={isReadOnly}
                            onClick={() => handleStatusChange(s.id, 'Present')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                              status === 'Present'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-text-secondary dark:bg-zinc-900/60 dark:border-zinc-800 dark:hover:bg-zinc-800'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            disabled={isReadOnly}
                            onClick={() => handleStatusChange(s.id, 'Absent')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                              status === 'Absent'
                                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-text-secondary dark:bg-zinc-900/60 dark:border-zinc-800 dark:hover:bg-zinc-800'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            disabled={isReadOnly}
                            onClick={() => handleStatusChange(s.id, 'Leave')}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                              status === 'Leave' || status === 'Late'
                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-text-secondary dark:bg-zinc-900/60 dark:border-zinc-800 dark:hover:bg-zinc-800'
                            }`}
                          >
                            Leave
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions */}
            {(!isCompletedMode || isEditing) && !isReadOnly && (
              <div className="flex justify-end gap-3 pt-4">
                {isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={savingAttendance}>
                    Cancel
                  </Button>
                )}
                <Button onClick={handleSaveAttendance} disabled={savingAttendance} className="shadow-sm">
                  {savingAttendance ? 'Saving...' : 'Save Attendance'}
                </Button>
              </div>
            )}
          </div>
        )
      ) : activeTab === 'report' ? (
        !activeClass ? (
          <Card className="border-dashed border-2 py-12 text-center text-text-muted">
            <CardContent>Please select a Class and Section to view the monthly report.</CardContent>
          </Card>
        ) : sortedReportStudents.length === 0 ? (
          <Card className="border-dashed border-2 py-12 text-center text-text-muted">
            <CardContent>No students enrolled in the selected Class/Section.</CardContent>
          </Card>
        ) : (
          <Card className="border border-border shadow-sm">
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary">Attendance Summary</CardTitle>
              {totalReportRecords > 0 && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border ${
                  monthlyAttendanceRate >= 75
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : monthlyAttendanceRate >= 50
                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-500/20'
                      : 'bg-red-100 dark:bg-red-950/40 text-red-700 border-red-500/20'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    monthlyAttendanceRate >= 75
                      ? 'bg-emerald-500'
                      : monthlyAttendanceRate >= 50
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`} />
                  Attendance Rate: {monthlyAttendanceRate}%
                </span>
              )}
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Roll Number</TableHead>
                  <TableHead className="text-center">Total Working Days</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Leave</TableHead>
                  <TableHead className="text-right">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map(row => (
                  <TableRow key={row.student.id}>
                    <TableCell className="font-semibold text-text-primary">{row.student.name}</TableCell>
                    <TableCell className="text-xs text-text-secondary">{row.student.roll_no || '—'}</TableCell>
                    <TableCell className="text-center font-mono text-xs">{totalWorkingDays}</TableCell>
                    <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-xs">{row.present}</TableCell>
                    <TableCell className="text-center font-semibold text-red-500 font-mono text-xs">{row.absent}</TableCell>
                    <TableCell className="text-center font-semibold text-amber-500 font-mono text-xs">{row.leave}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-black text-xs ${
                        row.percentage >= 75
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : row.percentage >= 50
                            ? 'text-amber-500'
                            : 'text-red-500'
                      }`}>
                        {row.percentage}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : (
        /* Leave Days Section */
        <div className="space-y-6">
          {/* Top Form */}
          {!isReadOnly && (
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Add Holiday / Leave Day
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleCreateHoliday} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Leave Title</label>
                    <Input
                      type="text"
                      placeholder="e.g. Republic Day"
                      value={newLeaveTitle}
                      onChange={e => setNewLeaveTitle(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Leave Date</label>
                    <Input
                      type="date"
                      value={newLeaveDate}
                      onChange={e => setNewLeaveDate(e.target.value)}
                      min={currentYear?.start_date || ''}
                      max={currentYear?.end_date || ''}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Button type="submit" className="w-full h-9 font-semibold" disabled={savingHoliday}>
                      {savingHoliday ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                  {holidayFormError && (
                    <div className="col-span-1 md:col-span-3">
                      <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {holidayFormError}
                      </p>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Below Holidays List */}
          <Card className="border border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">School Holidays List</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {sortedHolidays.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm border-dashed border-2 rounded-xl">
                  No holidays created for this academic year.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {sortedHolidays.map(h => {
                    const isEditingThis = editingHolidayId === h.id;
                    const isPast = h.date < todayStr;
                    const dateFormatted = new Date(h.date).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    });

                    return (
                      <Card key={h.id} className="border border-border hover:border-zinc-300 dark:hover:border-zinc-800 transition-all shadow-sm rounded-xl relative">
                        <CardContent className="p-4">
                          {isEditingThis ? (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-text-secondary">Holiday Name</label>
                                  <Input 
                                    value={editName} 
                                    onChange={e => setEditName(e.target.value)} 
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-text-secondary">Date</label>
                                  <Input 
                                    type="date"
                                    value={editDate} 
                                    onChange={e => setEditDate(e.target.value)} 
                                    min={currentYear?.start_date || ''}
                                    max={currentYear?.end_date || ''}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              {editError && (
                                <p className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {editError}</p>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => setEditingHolidayId(null)}>
                                  Cancel
                                </Button>
                                <Button size="sm" className="h-8 text-xs font-bold" onClick={() => handleUpdateHoliday(h.id)}>
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-text-primary text-sm tracking-tight">{h.name}</h4>
                                <p className="text-[10px] font-bold text-text-secondary uppercase mt-0.5 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {dateFormatted}
                                  {isPast && <Lock className="h-3 w-3 ml-1 text-text-muted" />}
                                </p>
                              </div>
                              
                              {!isReadOnly && !isPast && (
                                <DropdownMenu>
                                  <DropdownItem onClick={() => startEditHoliday(h)}>
                                    Edit
                                  </DropdownItem>
                                  <DropdownItem destructive onClick={() => handleDeleteHoliday(h)}>
                                    Delete
                                  </DropdownItem>
                                </DropdownMenu>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {/* Delete Holiday Confirmation Modal */}
      <Dialog
        isOpen={holidayToDelete !== null}
        onClose={() => setHolidayToDelete(null)}
        title="Delete Holiday"
        description="This action cannot be undone."
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHolidayToDelete(null)}
              disabled={deletingHoliday}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeleteHoliday}
              disabled={deletingHoliday}
            >
              {deletingHoliday ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <p className="text-sm text-text-secondary">
            Are you sure you want to delete the holiday <strong className="text-text-primary">"{holidayToDelete?.name}"</strong> scheduled for <strong className="text-text-primary">{holidayToDelete && new Date(holidayToDelete.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>?
          </p>
          <p className="text-xs text-red-500 font-medium">
            This will remove the holiday from the academic calendar and restore this date as a working day for attendance tracking.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
