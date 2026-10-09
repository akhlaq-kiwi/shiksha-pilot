import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Check, AlertCircle, Edit2, Save, FileText, CheckCircle2, Trash2, Plus, MoreVertical, Lock, ChevronDown, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
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
import { TeacherAttendanceView } from '../components/TeacherAttendanceView';
import { getClassIndex, getShortClassName } from '../../../common/constants/predefinedClasses';

function CustomSelect({ options, value, onChange, placeholder = "Select...", disabled = false, className = "", buttonClassName = "", dropdownClassName = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex h-10 items-center justify-between gap-2.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold text-text-primary shadow-2xs outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-border focus-visible:border-border active:outline-none select-none transition-colors min-w-[120px] ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-border-strong'
        } ${buttonClassName}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform duration-200 flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className={`absolute left-0 right-0 top-full mt-1.5 min-w-[140px] rounded-2xl border border-border bg-surface shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150 ${dropdownClassName}`}>
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold outline-none focus:outline-none select-none transition-colors hover:bg-primary/10 ${isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-text-primary'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const getTodayLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AttendancePage() {
  const { isReadOnly, currentYear } = useAcademicYear();
  const toast = useToast();
  const navigate = useNavigate();

  const [userType, setUserType] = useState('Teacher'); // 'Teacher' by default
  const [activeTab, setActiveTab] = useState('daily'); // 'daily', 'report', or 'leave'

  // Common data
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDateString());

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

  // Load classes initially
  useEffect(() => {
    setLoadingClasses(true);
    schoolService.getClasses()
      .then(data => {
        setClasses(data || []);
        if (data && data.length > 0) {
          const rawNames = Array.from(new Set(data.map(c => getShortClassName(c.name))));
          const sortedNames = rawNames.sort((a, b) => getClassIndex(a) - getClassIndex(b));
          const firstClassName = sortedNames[0] || '';
          setSelectedClassName(firstClassName);
          const matchingSections = data.filter(c => getShortClassName(c.name) === firstClassName || c.name === firstClassName).map(c => c.section || '');
          const firstSection = matchingSections[0] || '';
          setSelectedSection(firstSection);
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
    const matchingSections = classes.filter(c => getShortClassName(c.name) === className || c.name === className).map(c => c.section || '');
    const firstSection = matchingSections[0] || '';
    setSelectedSection(firstSection);
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
    const todayStr = getTodayLocalDateString();
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

    const minDate = currentYear?.start_date || '';
    const todayStr = getTodayLocalDateString();

    if (days < 0 && minDate && newDateStr < minDate) {
      toast.warning(`Cannot select a date before the academic year started (${minDate}).`);
      return;
    }
    if (days > 0 && newDateStr > todayStr) {
      toast.warning("Cannot select a future date.");
      return;
    }

    setSelectedDate(newDateStr);
  };

  const activeClass = classes.find(c => 
    (c.name === selectedClassName || getShortClassName(c.name) === selectedClassName) && 
    ((c.section || '') === selectedSection || !selectedSection)
  );

  // Unsaved Changes Tracking for Student Attendance
  const [hasUnsavedStudentAtt, setHasUnsavedStudentAtt] = useState(false);
  const [showUnsavedStudentModal, setShowUnsavedStudentModal] = useState(false);
  const [pendingStudentNav, setPendingStudentNav] = useState(null);

  const executePendingStudentNav = (nav) => {
    if (!nav) return;
    if (nav.type === 'date') {
      setSelectedDate(nav.value);
    } else if (nav.type === 'class') {
      setSelectedClassName(nav.value);
      const matchingSections = classes.filter(c => getShortClassName(c.name) === nav.value || c.name === nav.value).map(c => c.section || '');
      const firstSection = matchingSections[0] || '';
      setSelectedSection(firstSection);
      setStudents([]);
      setAttendanceRecords([]);
      setAttendanceMap({});
    } else if (nav.type === 'section') {
      setSelectedSection(nav.value);
      setStudents([]);
      setAttendanceRecords([]);
      setAttendanceMap({});
    } else if (nav.type === 'tab') {
      setActiveTab(nav.value);
    } else if (nav.type === 'userType') {
      setUserType(nav.value);
    }
  };

  const requestStudentDateChange = (newDateStr) => {
    if (!newDateStr || newDateStr === selectedDate) return;
    if (hasUnsavedStudentAtt) {
      setPendingStudentNav({ type: 'date', value: newDateStr });
      setShowUnsavedStudentModal(true);
    } else {
      setSelectedDate(newDateStr);
    }
  };

  const requestStudentShiftDate = (days) => {
    if (!selectedDate) return;
    const parts = selectedDate.split('-');
    if (parts.length !== 3) return;
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dt.setDate(dt.getDate() + days);

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;

    const minDate = currentYear?.start_date || '';
    const todayStr = getTodayLocalDateString();

    if (days < 0 && minDate && newDateStr < minDate) {
      toast.warning(`Cannot select a date before the academic year started (${minDate}).`);
      return;
    }
    if (days > 0 && newDateStr > todayStr) {
      toast.warning("Cannot select a future date.");
      return;
    }

    requestStudentDateChange(newDateStr);
  };

  const requestClassChange = (e) => {
    const className = e.target.value;
    if (hasUnsavedStudentAtt) {
      setPendingStudentNav({ type: 'class', value: className });
      setShowUnsavedStudentModal(true);
    } else {
      setSelectedClassName(className);
      const matchingSections = classes.filter(c => c.name === className).map(c => c.section || '');
      const firstSection = matchingSections[0] || '';
      setSelectedSection(firstSection);
      setStudents([]);
      setAttendanceRecords([]);
      setAttendanceMap({});
    }
  };

  const requestSectionChange = (e) => {
    const sectionName = e.target.value;
    if (hasUnsavedStudentAtt) {
      setPendingStudentNav({ type: 'section', value: sectionName });
      setShowUnsavedStudentModal(true);
    } else {
      setSelectedSection(sectionName);
      setStudents([]);
      setAttendanceRecords([]);
      setAttendanceMap({});
    }
  };

  const requestStudentTabChange = (newTab) => {
    if (newTab === activeTab) return;
    if (activeTab === 'daily' && hasUnsavedStudentAtt) {
      setPendingStudentNav({ type: 'tab', value: newTab });
      setShowUnsavedStudentModal(true);
    } else {
      setActiveTab(newTab);
    }
  };

  const requestUserTypeChange = (newUserType) => {
    if (newUserType === userType) return;
    if (userType === 'Student' && activeTab === 'daily' && hasUnsavedStudentAtt) {
      setPendingStudentNav({ type: 'userType', value: newUserType });
      setShowUnsavedStudentModal(true);
    } else {
      setUserType(newUserType);
    }
  };

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
      // 1. Initialize default 'Present' for all students
      (stData || []).forEach(s => {
        map[s.id] = 'Present';
      });

      // 2. Override with saved attendance from DB
      if (attData && attData.length > 0) {
        attData.forEach(r => {
          map[r.student_id] = r.status;
        });
        setIsCompletedMode(true);
      } else {
        setIsCompletedMode(false);
      }

      setAttendanceMap(map);
      setIsEditing(false);
      setHasUnsavedStudentAtt(false);
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
    setHasUnsavedStudentAtt(true);
  };

  const handleSaveAttendance = async (navToExecute = null) => {
    if (!activeClass) return false;
    setSavingAttendance(true);
    try {
      const records = students.map(s => ({
        student_id: s.id,
        status: attendanceMap[s.id] || 'Present'
      }));

      await schoolService.markAttendance({
        class_id: activeClass.id,
        date: selectedDate,
        records: records
      });
      toast.success('Attendance saved successfully.', 'Success');
      setHasUnsavedStudentAtt(false);
      if (navToExecute) {
        executePendingStudentNav(navToExecute);
      } else {
        await loadDailyData();
      }
      return true;
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save student attendance.');
      return false;
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleSaveAndNavigateStudent = async () => {
    const nav = pendingStudentNav;
    setShowUnsavedStudentModal(false);
    setPendingStudentNav(null);
    await handleSaveAttendance(nav);
  };

  const handleIgnoreUnsavedStudent = () => {
    const nav = pendingStudentNav;
    setShowUnsavedStudentModal(false);
    setHasUnsavedStudentAtt(false);
    setPendingStudentNav(null);
    executePendingStudentNav(nav);
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
    if (selectedReportMonth === 'all' || String(selectedReportMonth) === 'all') {
      return reportAttendance;
    }
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
  }).sort((a, b) => {
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    const rollA = parseInt(a.student.roll_no, 10) || 0;
    const rollB = parseInt(b.student.roll_no, 10) || 0;
    return rollA - rollB;
  });

  const totalReportRecords = workingRecords.length;
  const presentReportRecords = workingRecords.filter(r => r.status === 'Present').length;
  const monthlyAttendanceRate = totalReportRecords > 0 
    ? Math.round((presentReportRecords / totalReportRecords) * 100) 
    : 0;

  const formatClassName = (name) => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    if (lower === 'nursery' || lower === 'nc') return 'NC';
    if (lower === 'pre nursery' || lower === 'pnc' || lower === 'playgroup') return 'PNC';
    if (lower === 'lower kindergarten' || lower === 'lkg') return 'LKG';
    if (lower === 'upper kindergarten' || lower === 'ukg') return 'UKG';
    if (lower === 'kindergarten' || lower === 'kg') return 'KG';
    return name;
  };

  const getClassIndex = (name) => {
    const formatted = formatClassName(name).toUpperCase();
    if (formatted === 'PNC' || formatted === 'PLAYGROUP') return 1;
    if (formatted === 'NC' || formatted === 'NURSERY') return 2;
    if (formatted === 'LKG') return 3;
    if (formatted === 'UKG') return 4;
    if (formatted === 'KG') return 5;
    const numMatch = formatted.match(/\d+/);
    if (numMatch) {
      return 10 + parseInt(numMatch[0], 10);
    }
    return 99;
  };

  const rawClasses = Array.from(new Set(classes.map(c => getShortClassName(c.name))));
  const uniqueClasses = rawClasses.sort((a, b) => getClassIndex(a) - getClassIndex(b));
  const uniqueSections = Array.from(new Set(classes.filter(c => (c.name === selectedClassName || getShortClassName(c.name) === selectedClassName) && c.section).map(c => c.section))).sort();

  // Holidays list sorted chronologically
  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  const todayStr = getTodayLocalDateString();

  if (loadingClasses) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-24 min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-xs font-bold text-text-primary uppercase tracking-wider">LOADING ATTENDANCE...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Title section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">ATTENDANCE</h2>
          <p className="text-text-secondary text-sm mt-1">
            {userType === 'Student' 
              ? 'Mark student daily attendance and review reports.' 
              : 'Manage teacher daily attendance, QR code generation, and monthly reports.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-surface border border-border px-3.5 py-1.5 rounded-full shadow-2xs">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider pl-1">SWITCH USER</span>
            <CustomSelect
              value={userType}
              onChange={(val) => requestUserTypeChange(val)}
              options={[
                { value: 'Teacher', label: 'Teacher' },
                { value: 'Student', label: 'Student' }
              ]}
              buttonClassName="h-8 border-0 bg-primary/10 text-primary font-extrabold hover:bg-primary/20 px-3 rounded-full min-w-[100px]"
            />
          </div>

          {userType === 'Student' && isReadOnly && (
            <Button
              onClick={() => navigate('/school-admin/attendance/leaderboard')}
              className="h-10 px-5 font-bold text-xs bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl shadow-lg shadow-amber-500/25 border-0 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center gap-2 tracking-wide uppercase"
            >
              🏆 Attendance Leaderboard
            </Button>
          )}
        </div>
      </div>

      {/* Render Teacher Attendance View when userType === 'Teacher' */}
      {userType === 'Teacher' ? (
        <TeacherAttendanceView />
      ) : (
        <>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => requestStudentTabChange('daily')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'daily'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Daily Attendance
        </button>
        <button
          onClick={() => requestStudentTabChange('report')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'report'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Monthly Report
        </button>
      </div>

      {(
        /* Dropdown controls for Attendance marking and Report */
        <Card className="relative z-30 border border-border bg-zinc-50/50 dark:bg-zinc-900/50 shadow-2xs rounded-2xl">
          <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px] space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              <CustomSelect
                value={selectedClassName}
                onChange={(val) => requestClassChange({ target: { value: val } })}
                disabled={loadingClasses}
                placeholder={loadingClasses ? "Loading..." : "Select Class"}
                options={uniqueClasses.map(name => ({ value: name, label: name }))}
                buttonClassName="w-full h-9 min-w-0"
              />
            </div>

            {uniqueSections.length > 0 && (
              <div className="flex-1 min-w-[120px] space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Section</label>
                <CustomSelect
                  value={selectedSection}
                  onChange={(val) => requestSectionChange({ target: { value: val } })}
                  disabled={loadingClasses}
                  placeholder="All Sections"
                  options={[
                    { value: '', label: 'All Sections' },
                    ...uniqueSections.map(sec => ({ value: sec, label: `Section ${sec}` }))
                  ]}
                  buttonClassName="w-full h-9 min-w-0"
                />
              </div>
            )}

            {activeTab === 'daily' && (
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Date</label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => requestStudentShiftDate(-1)}
                    className="h-9 w-9 shrink-0 bg-background border-border hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Previous Day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => requestStudentDateChange(e.target.value)} 
                    min={currentYear?.start_date || ''}
                    max={getTodayLocalDateString()}
                    className="h-9 bg-background outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-border focus-visible:border-border" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => requestStudentShiftDate(1)}
                    disabled={selectedDate >= getTodayLocalDateString()}
                    className="h-9 w-9 shrink-0 bg-background border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                    title="Next Day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'report' && (
              <div className="flex-1 min-w-[140px] space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Month</label>
                <CustomSelect
                  value={selectedReportMonth}
                  onChange={val => setSelectedReportMonth(val)}
                  options={[
                    { value: 'all', label: 'All Months' },
                    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(m => ({
                      value: m,
                      label: new Date(2026, m - 1).toLocaleString('default', { month: 'long' })
                    }))
                  ]}
                  buttonClassName="w-full h-9 min-w-0"
                />
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
              <h3 className="text-lg font-bold text-text-primary">No Attendance Required</h3>
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Attendance Completed
                  </span>
                  {!isReadOnly && (
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-3.5 w-3.5" /> Update Attendance
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
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
            ) : null}

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
                          <p className="text-[11px] font-bold text-text-secondary uppercase mt-0.5">Roll No: {s.roll_no || 'N/A'}</p>
                        </div>
                        <div className="flex justify-end">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeStyle}`}>
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
                          <p className="text-[11px] font-bold text-text-secondary uppercase mt-0.5">Roll No: {s.roll_no || 'N/A'}</p>
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
      ) : (
        !activeClass ? (
          <Card className="border-dashed border-2 py-12 text-center text-text-muted">
            <CardContent>Please select a Class and Section to view the monthly report.</CardContent>
          </Card>
        ) : sortedReportStudents.length === 0 ? (
          <Card className="border-dashed border-2 py-12 text-center text-text-muted">
            <CardContent>No students enrolled in the selected Class/Section.</CardContent>
          </Card>
        ) : (
          <Card className="border border-border rounded-2xl overflow-hidden bg-surface shadow-2xs">
            <CardHeader className="py-4 px-6 border-b border-border bg-surface flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary">Attendance Summary</CardTitle>
              {totalReportRecords > 0 && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
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
            <Table containerClassName="border-0 rounded-none shadow-none bg-transparent">
              <TableHeader className="bg-surface border-b border-border">
                <TableRow className="bg-surface hover:bg-surface border-b border-border">
                  <TableHead className="text-xs uppercase font-bold text-text-primary bg-surface">Student Name</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-text-primary bg-surface">Roll Number</TableHead>
                  <TableHead className="text-center text-xs uppercase font-bold text-text-primary bg-surface">Total Working Days</TableHead>
                  <TableHead className="text-center text-xs uppercase font-bold text-text-primary bg-surface">Present</TableHead>
                  <TableHead className="text-center text-xs uppercase font-bold text-text-primary bg-surface">Absent</TableHead>
                  <TableHead className="text-center text-xs uppercase font-bold text-text-primary bg-surface">Leave</TableHead>
                  <TableHead className="text-right text-xs uppercase font-bold text-text-primary bg-surface">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map(row => (
                  <TableRow key={row.student.id} className="hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <TableCell className="font-bold text-sm text-text-primary">{row.student.name}</TableCell>
                    <TableCell className="text-sm font-bold text-text-secondary font-mono">{row.student.roll_no || '—'}</TableCell>
                    <TableCell className="text-center font-mono text-sm font-bold text-text-primary">{totalWorkingDays}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">{row.present}</TableCell>
                    <TableCell className="text-center font-bold text-red-500 font-mono text-sm">{row.absent}</TableCell>
                    <TableCell className="text-center font-bold text-amber-500 font-mono text-sm">{row.leave}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold text-sm ${
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
      )}
        </>
      )}

      {/* Unsaved Student Attendance Changes Confirmation Dialog */}
      <Dialog
        isOpen={showUnsavedStudentModal}
        onClose={() => {
          setShowUnsavedStudentModal(false);
          setPendingStudentNav(null);
        }}
        title="Unsaved Attendance Changes"
        footer={
          <div className="flex items-center gap-2 justify-end w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={handleIgnoreUnsavedStudent}
              className="font-bold text-xs px-4 h-9"
            >
              Ignore
            </Button>
            <Button
              type="button"
              onClick={handleSaveAndNavigateStudent}
              disabled={savingAttendance}
              className="font-bold text-xs px-4 h-9 bg-primary text-white hover:bg-primary/90"
            >
              {savingAttendance ? 'Saving...' : 'Save Attendance'}
            </Button>
          </div>
        }
      >
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-bold text-sm text-amber-900 dark:text-amber-200">
              You have unsaved changes in student attendance.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              You updated student attendance for date <strong>{selectedDate}</strong> but haven't saved it yet. Would you like to save attendance before moving forward, or ignore changes?
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
