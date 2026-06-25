import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  RefreshCw, 
  Info, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  GraduationCap
} from 'lucide-react';

export default function AttendanceTracker({
  token,
  schoolId,
  activeYearId,
  classes = [],
  students = [],
  isConnected,
  showToast,
  years = [],
  leavesList = [],
  isFetchingLeaves = false,
  isSavingLeave = false,
  fetchLeaves,
  saveLeave,
  deleteLeave,
  editLeave,
  role
}) {
  const [attendanceMode, setAttendanceMode] = useState('mark'); // 'mark' | 'report' | 'leaves'
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [attendanceGroupName, setAttendanceGroupName] = useState('all');
  
  // Get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [attendanceDate, setAttendanceDate] = useState(getLocalDateString());
  const [isAttendanceEditing, setIsAttendanceEditing] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState('Not Marked');
  const [isFetchingAttendance, setIsFetchingAttendance] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [markedAttendance, setMarkedAttendance] = useState({}); // student_id -> status
  
  // Monthly report states
  const [attendanceReportMonth, setAttendanceReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceReportData, setAttendanceReportData] = useState([]);
  const [isFetchingAttendanceReport, setIsFetchingAttendanceReport] = useState(false);
  const [attendanceReportStudyDays, setAttendanceReportStudyDays] = useState(0);
  const [attendanceReportSundays, setAttendanceReportSundays] = useState(0);
  const [attendanceReportHolidays, setAttendanceReportHolidays] = useState(0);

  // Leave Form states
  const [leaveForm, setLeaveForm] = useState({ date: '', title: '', description: '' });
  const [editingLeave, setEditingLeave] = useState(null);

  const attendanceDateInputRef = useRef(null);
  const leaveDateInputRef = useRef(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const getClassName = (cid) => {
    const match = classes.find(c => parseInt(c.id) === parseInt(cid));
    return match ? match.name : `Class ${cid}`;
  };

  // Sync / Load Effect
  useEffect(() => {
    if (classes.length > 0 && !attendanceClassId) {
      setAttendanceClassId(classes[0].id.toString());
    }
  }, [classes]);

  useEffect(() => {
    if (attendanceClassId && activeYearId) {
      if (attendanceMode === 'mark') {
        fetchAttendance(attendanceClassId, attendanceDate, activeYearId, attendanceGroupName);
      } else if (attendanceMode === 'report') {
        fetchAttendanceReport(attendanceClassId, attendanceReportMonth, activeYearId, attendanceGroupName);
      }
    }
  }, [attendanceClassId, attendanceDate, activeYearId, attendanceGroupName, attendanceMode]);

  // Load leaves when leaves tab is selected
  useEffect(() => {
    if (attendanceMode === 'leaves' && activeYearId) {
      fetchLeaves(activeYearId);
    }
  }, [attendanceMode, activeYearId]);

  const fetchAttendance = async (classId, date, ayId, groupName) => {
    if (!classId || !ayId) return;
    setIsFetchingAttendance(true);
    setAttendanceStudents([]);
    const keySuffix = schoolId || 'default';

    if (token.includes('mock') || !isConnected) {
      // Sandbox mode mock operations
      const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}_${ayId}`) || '[]';
      const allStuds = JSON.parse(storedStudents);
      const filteredStuds = allStuds.filter(s => 
        parseInt(s.class_id) === parseInt(classId) && 
        s.status === 'Active' &&
        (groupName === 'all' || !groupName || s.group_name === groupName)
      );
      
      const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
      const attList = JSON.parse(storedAtt);
      const attMap = {};
      attList.forEach(a => {
        if (a.attendance_date === date) {
          attMap[parseInt(a.student_id)] = a.status;
        }
      });
      
      const result = filteredStuds.map(s => ({
        id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        group_name: s.group_name,
        status: attMap[parseInt(s.id)] ?? null
      })).sort((a, b) => {
        const rA = parseInt(a.roll_number) || 0;
        const rB = parseInt(b.roll_number) || 0;
        return rA - rB || a.name.localeCompare(b.name);
      });
      
      const initialEdits = {};
      const allNull = result.every(s => s.status === null || s.status === undefined);
      result.forEach(s => {
        initialEdits[s.id] = s.status || 'Present';
      });
      setMarkedAttendance(initialEdits);
      if (allNull) {
        setAttendanceStatus('Not Marked');
        setIsAttendanceEditing(true);
      } else {
        setAttendanceStatus('Submitted');
        setIsAttendanceEditing(false);
      }
      
      setAttendanceStudents(result);
      setIsFetchingAttendance(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance?class_id=${classId}&date=${date}&academic_year_id=${ayId}&group_name=${groupName}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const sorted = data.sort((a, b) => {
          const rA = parseInt(a.roll_number) || 0;
          const rB = parseInt(b.roll_number) || 0;
          return rA - rB || a.name.localeCompare(b.name);
        });

        const initialEdits = {};
        const allNull = sorted.every(s => s.status === null || s.status === undefined);
        sorted.forEach(s => {
          initialEdits[s.id] = s.status || 'Present';
        });
        setMarkedAttendance(initialEdits);
        if (allNull) {
          setAttendanceStatus('Not Marked');
          setIsAttendanceEditing(true);
        } else {
          setAttendanceStatus('Submitted');
          setIsAttendanceEditing(false);
        }

        setAttendanceStudents(sorted);
      }
    } catch (err) {
      console.error(err);
      showToast("Error fetching attendance list.", "error");
    } finally {
      setIsFetchingAttendance(false);
    }
  };

  const saveAttendanceBulk = async (classId, date, ayId, studentsList) => {
    setIsSavingAttendance(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
      const attList = JSON.parse(storedAtt);
      
      studentsList.forEach(item => {
        const idx = attList.findIndex(a => parseInt(a.student_id) === parseInt(item.student_id) && a.attendance_date === date);
        if (idx !== -1) {
          attList[idx].status = item.status;
        } else {
          attList.push({
            id: attList.length + 1,
            school_id: schoolId || 1,
            academic_year_id: ayId,
            class_id: parseInt(classId),
            student_id: item.student_id,
            attendance_date: date,
            status: item.status
          });
        }
      });
      
      localStorage.setItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`, JSON.stringify(attList));
      setIsSavingAttendance(false);
      showToast("Attendance saved successfully (Sandbox Mode)", "success");
      setAttendanceStatus('Submitted');
      setIsAttendanceEditing(false);
      fetchAttendance(classId, date, ayId, attendanceGroupName);
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: parseInt(classId),
          academic_year_id: ayId,
          date,
          students: studentsList
        })
      });
      if (res.ok) {
        showToast("Attendance saved successfully.", "success");
        setAttendanceStatus('Submitted');
        setIsAttendanceEditing(false);
        fetchAttendance(classId, date, ayId, attendanceGroupName);
      } else {
        const d = await res.json();
        showToast(d.detail || d.error || "Failed to save attendance.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error saving attendance.", "error");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const fetchAttendanceReport = async (classId, month, ayId, groupName) => {
    if (!classId || !ayId) return;
    setIsFetchingAttendanceReport(true);
    setAttendanceReportData([]);
    const keySuffix = schoolId || 'default';

    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}_${ayId}`) || '[]';
        const allStuds = JSON.parse(storedStudents);
        const filteredStuds = allStuds.filter(s => 
          parseInt(s.class_id) === parseInt(classId) && 
          s.status === 'Active' &&
          (groupName === 'all' || !groupName || s.group_name === groupName)
        );
        
        const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
        const attList = JSON.parse(storedAtt);
        
        const [mYear, mMonth] = month.split('-');
        const lastDay = new Date(parseInt(mYear), parseInt(mMonth), 0).getDate();
        
        const sandboxLeaves = JSON.parse(localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`) || '[]');
        const activeYear = years.find(y => y.id === ayId);
        const systemHols = activeYear ? getSystemHolidays(activeYear.start_date, activeYear.end_date, ayId) : [];
        const combined = [...sandboxLeaves, ...systemHols];
        const leaveDates = combined.map(l => l.leave_date);
        
        let sDays = 0;
        let suns = 0;
        let holis = 0;
        const workingDates = {};
        for (let d = 1; d <= lastDay; d++) {
          const dateStr = `${month}-${String(d).padStart(2, '0')}`;
          const dObj = new Date(parseInt(mYear), parseInt(mMonth) - 1, d);
          const isSun = dObj.getDay() === 0;
          const isLeave = leaveDates.includes(dateStr);
          if (isSun) {
            suns++;
          } else if (isLeave) {
            holis++;
          } else {
            sDays++;
            workingDates[dateStr] = true;
          }
        }
        setAttendanceReportStudyDays(sDays);
        setAttendanceReportSundays(suns);
        setAttendanceReportHolidays(holis);
        
        const result = filteredStuds.map(s => {
          const studentAtt = attList.filter(a => 
            parseInt(a.student_id) === parseInt(s.id) && 
            a.attendance_date.startsWith(month) &&
            workingDates[a.attendance_date] === true
          );
          const present = studentAtt.filter(a => a.status === 'Present').length;
          const absent = studentAtt.filter(a => a.status === 'Absent').length;
          const leave = studentAtt.filter(a => a.status === 'Leave').length;
          const percentage = sDays > 0 ? parseFloat(((present / sDays) * 100).toFixed(2)) : 0;
          
          return {
            id: s.id,
            name: s.name,
            roll_number: s.roll_number,
            group_name: s.group_name,
            present,
            absent,
            leave,
            percentage
          };
        }).sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0) || a.name.localeCompare(b.name));
        
        setAttendanceReportData(result);
        setIsFetchingAttendanceReport(false);
      }, 300);
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance/report/monthly?class_id=${classId}&month=${month}&academic_year_id=${ayId}&group_name=${groupName}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const reportList = Array.isArray(data) ? data : (data.report || []);
        const sDays = data.study_days !== undefined ? data.study_days : 0;
        const sunsCount = data.sundays_count !== undefined ? data.sundays_count : 0;
        const holisCount = data.holidays_count !== undefined ? data.holidays_count : 0;
        
        setAttendanceReportStudyDays(sDays);
        setAttendanceReportSundays(sunsCount);
        setAttendanceReportHolidays(holisCount);
        
        const sorted = reportList.sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0) || a.name.localeCompare(b.name));
        setAttendanceReportData(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingAttendanceReport(false);
    }
  };

  const getSystemHolidays = (start, end, ayId) => {
    const holidays = [];
    const startDateTs = new Date(start).getTime();
    const endDateTs = new Date(end).getTime();
    const startYear = new Date(start).getFullYear();
    const endYear = new Date(end).getFullYear();
    
    const yearsSet = Array.from(new Set([startYear, endYear]));
    yearsSet.forEach(yr => {
      holidays.push({ id: `sys-1-${yr}`, title: 'Republic Day', leave_date: `${yr}-01-26`, category: 'System Holiday' });
      holidays.push({ id: `sys-2-${yr}`, title: 'Independence Day', leave_date: `${yr}-08-15`, category: 'System Holiday' });
      holidays.push({ id: `sys-3-${yr}`, title: 'Gandhi Jayanti', leave_date: `${yr}-10-02`, category: 'System Holiday' });
      holidays.push({ id: `sys-4-${yr}`, title: 'Christmas', leave_date: `${yr}-12-25`, category: 'System Holiday' });
    });
    return holidays;
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const isSelectedDateSunday = () => {
    if (!attendanceDate) return false;
    const parts = attendanceDate.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);
    return dateObj.getDay() === 0;
  };

  const getSelectedDateHoliday = () => {
    if (!attendanceDate) return null;
    return leavesList.find(l => l.leave_date === attendanceDate);
  };

  const selectedClassStudents = students.filter(s => parseInt(s.class_id) === parseInt(attendanceClassId));
  const sections = Array.from(new Set(selectedClassStudents.map(s => s.group_name).filter(Boolean)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Selectors */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Calendar size={22} className="gradient-text" />
            Student Attendance Tracking
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
            Record daily student attendance, track monthly metrics, and configure school holiday dates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => setAttendanceMode('mark')}
            className={attendanceMode === 'mark' ? 'btn-primary' : 'btn-outline'}
            style={{ border: 'none', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            Mark Attendance
          </button>
          <button
            type="button"
            onClick={() => setAttendanceMode('report')}
            className={attendanceMode === 'report' ? 'btn-primary' : 'btn-outline'}
            style={{ border: 'none', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            Monthly Report
          </button>
          <button
            type="button"
            onClick={() => setAttendanceMode('leaves')}
            className={attendanceMode === 'leaves' ? 'btn-primary' : 'btn-outline'}
            style={{ border: 'none', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
          >
            Leaves & Holidays
          </button>
        </div>
      </div>

      {/* Select Filters Panel */}
      {attendanceMode !== 'leaves' && (
        <div className="sp-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', padding: '16px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Class</label>
            <select
              value={attendanceClassId}
              onChange={(e) => setAttendanceClassId(e.target.value)}
              className="sp-input"
              style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
            >
              <option value="">Select Class...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Section</label>
            <select
              value={attendanceGroupName}
              onChange={(e) => setAttendanceGroupName(e.target.value)}
              className="sp-input"
              style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
            >
              <option value="all">All Sections</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {attendanceMode === 'mark' ? (
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                <input
                  ref={attendanceDateInputRef}
                  type="date"
                  value={attendanceDate}
                  min={years.find(y => y.id === activeYearId)?.start_date || ''}
                  max={getLocalDateString()}
                  onChange={(e) => {
                    const dateVal = e.target.value;
                    if (!dateVal) return;
                    
                    const activeYear = years.find(y => y.id === activeYearId);
                    const minDate = activeYear ? activeYear.start_date : '';
                    const maxDate = getLocalDateString();
                    
                    if (minDate && dateVal < minDate) {
                      showToast(`Date cannot be before start of academic year (${minDate})`, "error");
                      return;
                    }
                    if (dateVal > maxDate) {
                      showToast(`Future attendance is not allowed.`, "error");
                      return;
                    }
                    
                    setAttendanceDate(dateVal);
                  }}
                  className="sp-input"
                  style={{ width: '100%', padding: '8px 12px', paddingRight: '36px' }}
                />
                <Calendar 
                  size={16} 
                  style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    color: 'var(--text-muted)', 
                    cursor: 'pointer'
                  }} 
                  onClick={() => {
                    if (attendanceDateInputRef.current) {
                      try {
                        attendanceDateInputRef.current.showPicker();
                      } catch (err) {
                        attendanceDateInputRef.current.click();
                      }
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Month</label>
              <input
                type="month"
                value={attendanceReportMonth}
                onChange={(e) => setAttendanceReportMonth(e.target.value)}
                className="sp-input"
                style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Main View Area */}
      {attendanceMode === 'mark' ? (
        isSelectedDateSunday() ? (
          <div className="sp-card" style={{ padding: '48px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Info size={28} />
            </div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
              Attendance is not required on Sundays.
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '480px', margin: 0, lineHeight: 1.5 }}>
              Sundays are automatically excluded from study days and attendance calculations.
            </p>
          </div>
        ) : getSelectedDateHoliday() ? (
          <div className="sp-card" style={{ 
            padding: '48px 24px', 
            textAlign: 'center', 
            background: 'rgba(16, 185, 129, 0.05)', 
            border: '1px dashed #10b981', 
            borderRadius: '12px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '12px' 
          }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              background: 'rgba(16, 185, 129, 0.15)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#10b981' 
            }}>
              <Info size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', color: '#10b981', fontWeight: 700, margin: 0 }}>
              School Holiday: {getSelectedDateHoliday().title}
            </h3>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
              This date has been declared as an official school holiday.
            </p>
            {getSelectedDateHoliday().description && (
              <div style={{ marginTop: '8px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {getSelectedDateHoliday().description}
                </p>
              </div>
            )}
          </div>
        ) : !attendanceClassId ? (
          <div className="sp-card" style={{ padding: '32px', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
            Please select a class to load student attendance.
          </div>
        ) : isFetchingAttendance ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ marginRight: '8px' }} /> Loading students...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', gap: '16px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.015)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {attendanceStatus === 'Not Marked' ? (
                  <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                    Attendance Not Marked
                  </span>
                ) : (
                  <>
                    <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      Attendance Submitted
                    </span>
                    {!isAttendanceEditing && (
                      <button
                        onClick={() => setIsAttendanceEditing(true)}
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', padding: '6px 16px', borderRadius: '6px' }}
                      >
                        Update Attendance
                      </button>
                    )}
                  </>
                )}
              </div>

              {attendanceStatus === 'Submitted' && !isAttendanceEditing && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', marginLeft: 'auto' }}>
                  <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Present: {attendanceStudents.filter(s => (markedAttendance[s.id] ?? s.status) === 'Present').length}
                  </span>
                  <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Absent: {attendanceStudents.filter(s => (markedAttendance[s.id] ?? s.status) === 'Absent').length}
                  </span>
                  <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Leave: {attendanceStudents.filter(s => (markedAttendance[s.id] ?? s.status) === 'Leave').length}
                  </span>
                </div>
              )}
            </div>

            {attendanceStudents.length === 0 ? (
              <div className="sp-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active students enrolled in this class/section.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {attendanceStudents.map(student => {
                    const currentStatus = markedAttendance[student.id] !== undefined ? markedAttendance[student.id] : student.status;
                    
                    return (
                      <div 
                        key={student.id} 
                        className="sp-card" 
                        style={{ 
                          padding: '16px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px',
                          border: currentStatus === 'Absent' ? '1px solid rgba(239, 68, 68, 0.3)' : (currentStatus === 'Leave' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)')
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Roll #{student.roll_number || '-'}</span>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{student.name}</strong>
                          </div>
                          {student.group_name && (
                            <span className="badge" style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                              Sec: {student.group_name}
                            </span>
                          )}
                        </div>

                        {isAttendanceEditing ? (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            {['Present', 'Absent', 'Leave'].map(st => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setMarkedAttendance(prev => ({ ...prev, [student.id]: st }))}
                                className={currentStatus === st ? "btn-primary" : "btn-outline"}
                                style={{
                                  flex: 1,
                                  padding: '6px 8px',
                                  fontSize: '0.8rem',
                                  borderRadius: '6px',
                                  backgroundColor: currentStatus === st 
                                    ? (st === 'Present' ? '#10b981' : (st === 'Absent' ? '#ef4444' : '#f59e0b'))
                                    : 'transparent',
                                  borderColor: currentStatus === st 
                                    ? (st === 'Present' ? '#10b981' : (st === 'Absent' ? '#ef4444' : '#f59e0b'))
                                    : 'var(--border-color)',
                                  color: currentStatus === st ? 'white' : 'var(--text-primary)'
                                }}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status:</span>
                            <div style={{ 
                              fontSize: '0.8rem', 
                              fontWeight: 'bold', 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              backgroundColor: currentStatus === 'Present' ? 'rgba(16, 185, 129, 0.15)' : (currentStatus === 'Absent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                              color: currentStatus === 'Present' ? '#34d399' : (currentStatus === 'Absent' ? '#f87171' : '#fbbf24')
                            }}>
                              {currentStatus || 'Not Marked'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(attendanceStatus === 'Not Marked' || isAttendanceEditing) && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', position: 'sticky', bottom: '16px', zIndex: 10 }}>
                    <button
                      onClick={() => {
                        const payload = attendanceStudents.map(student => ({
                          student_id: student.id,
                          status: markedAttendance[student.id] !== undefined ? markedAttendance[student.id] : (student.status || 'Present')
                        }));
                        saveAttendanceBulk(attendanceClassId, attendanceDate, activeYearId, payload);
                      }}
                      className="btn-primary"
                      disabled={isSavingAttendance}
                      style={{ padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                    >
                      {isSavingAttendance ? <RefreshCw className="spin" size={16} /> : null}
                      Save Attendance
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )
      ) : attendanceMode === 'leaves' ? (
        <div style={{ display: 'flex', gap: '24px', flexDirection: 'row', flexWrap: 'wrap', marginTop: '10px' }}>
          {/* Add/Edit Leave Form */}
          <div style={{ flex: '1 1 350px', maxWidth: '450px' }}>
            <div className="sp-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingLeave ? (
                  <>
                    <Edit size={18} style={{ color: 'var(--color-primary)' }} />
                    Edit Leave Day
                  </>
                ) : (
                  <>
                    <Plus size={18} style={{ color: 'var(--color-primary)' }} />
                    Declare Holiday
                  </>
                )}
              </h3>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (editingLeave) {
                  editLeave(editingLeave.id, activeYearId, leaveForm.title, leaveForm.date, leaveForm.description);
                  setEditingLeave(null);
                  setLeaveForm({ date: '', title: '', description: '' });
                } else {
                  saveLeave(activeYearId, leaveForm.title, leaveForm.date, leaveForm.description);
                }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Leave Date *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      ref={leaveDateInputRef}
                      type="date"
                      required
                      value={leaveForm.date}
                      min={years.find(y => y.id === activeYearId)?.start_date || ''}
                      max={years.find(y => y.id === activeYearId)?.end_date || ''}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, date: e.target.value }))}
                      className="sp-input"
                      style={{ width: '100%', padding: '8px 12px', paddingRight: '36px' }}
                    />
                    <Calendar 
                      size={16} 
                      style={{ 
                        position: 'absolute', 
                        right: '12px', 
                        color: 'var(--text-muted)', 
                        cursor: 'pointer'
                      }} 
                      onClick={() => {
                        if (leaveDateInputRef.current) {
                          try {
                            leaveDateInputRef.current.showPicker();
                          } catch (err) {
                            leaveDateInputRef.current.click();
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Leave Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Independence Day, Winter Vacation"
                    value={leaveForm.title}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, title: e.target.value }))}
                    className="sp-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Description (Optional)
                  </label>
                  <textarea
                    placeholder="Description of holiday..."
                    value={leaveForm.description}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, description: e.target.value }))}
                    className="sp-input"
                    style={{ width: '100%', padding: '8px 12px', height: '80px', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  {editingLeave && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLeave(null);
                        setLeaveForm({ date: '', title: '', description: '' });
                      }}
                      className="btn-outline"
                      style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingLeave}
                    className="btn-primary"
                    style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isSavingLeave ? <RefreshCw className="spin" size={14} /> : null}
                    {editingLeave ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Holiday List */}
          <div style={{ flex: '2 2 500px' }}>
            <div className="sp-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                School Holidays List
              </h3>
              
              {leavesList.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  No school holidays declared for this academic session.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '450px', paddingRight: '4px' }}>
                  {[...leavesList]
                    .sort((a, b) => b.leave_date.localeCompare(a.leave_date))
                    .map(leave => (
                      <div 
                        key={leave.id} 
                        className="sp-card" 
                        style={{ 
                          padding: '12px 16px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          gap: '16px', 
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: editingLeave && editingLeave.id === leave.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{leave.title}</strong>
                            <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              {formatDateString(leave.leave_date)}
                            </span>
                            {leave.category === 'System Holiday' ? (
                              <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                System Holiday
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                School Holiday
                              </span>
                            )}
                          </div>
                          {leave.description && (
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              {leave.description}
                            </p>
                          )}
                        </div>
                        
                        {leave.category !== 'System Holiday' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLeave(leave);
                                setLeaveForm({
                                  date: leave.leave_date,
                                  title: leave.title,
                                  description: leave.description || ''
                                });
                              }}
                              className="btn-outline"
                              style={{ padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '30px', height: '30px' }}
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the holiday "${leave.title}"?`)) {
                                  deleteLeave(leave.id, activeYearId);
                                }
                              }}
                              className="btn-outline"
                              style={{ padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', minWidth: '30px', height: '30px' }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        !attendanceClassId ? (
          <div className="sp-card" style={{ padding: '32px', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
            Please select a class to generate report.
          </div>
        ) : isFetchingAttendanceReport ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ marginRight: '8px' }} /> Loading attendance report...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Attendance Summary for <strong>{getClassName(attendanceClassId)}</strong> ({attendanceReportMonth})
              </span>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span>Study Days: {attendanceReportStudyDays}</span>
                <span>Sundays: {attendanceReportSundays}</span>
                <span>Holidays: {attendanceReportHolidays}</span>
              </div>
            </div>

            <div className="sp-table-container">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Leave</th>
                    <th>Avg Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceReportData.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                        No records found for this month/section.
                      </td>
                    </tr>
                  ) : (
                    attendanceReportData.map(student => (
                      <tr key={student.id}>
                        <td>{student.roll_number || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{student.name}</td>
                        <td>
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>{student.present}</span>
                        </td>
                        <td>
                          <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{student.absent}</span>
                        </td>
                        <td>
                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{student.leave}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${Math.min(student.percentage, 100)}%`, 
                                background: student.percentage >= 75 ? '#10b981' : (student.percentage >= 50 ? '#f59e0b' : '#ef4444')
                              }} />
                            </div>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: student.percentage >= 75 ? '#34d399' : (student.percentage >= 50 ? '#fbbf24' : '#f87171'),
                              fontSize: '0.8rem'
                            }}>
                              {student.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
