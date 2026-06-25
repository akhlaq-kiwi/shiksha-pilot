import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Edit, 
  Trash2, 
  Sliders, 
  Calendar, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Check, 
  RefreshCw, 
  Lock 
} from 'lucide-react';

export default function TimetableManager({
  token,
  schoolId,
  activeYearId,
  classrooms = [],
  teachers = [],
  isConnected,
  showToast,
  isCurrentYearActive,
  username,
  schoolStartTime = '08:00 AM',
  periodDuration = 40,
  intervalDuration = 20,
  intervalAfterPeriod = 4,
  totalPeriods = 8
}) {
  const [activeTab, setActiveTab] = useState('planner');
  const [plannerClassId, setPlannerClassId] = useState(null);
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Get Monday of current week
    const monday = new Date(today.setDate(diff));
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: []
  });

  // Modal / UI States
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [actionError, setActionError] = useState('');

  // Dropdown states for periods
  const [activeDropdownKey, setActiveDropdownKey] = useState(null); // e.g. "Monday-0"
  const [teacherActionModal, setTeacherActionModal] = useState({
    show: false,
    type: '', // 'Replace' or 'Backup'
    day: '',
    periodIndex: null,
    subject: '',
    currentTeacherId: null
  });
  const [selectedModalTeacherId, setSelectedModalTeacherId] = useState('');

  // WhatsApp queue and delivery
  const [whatsappQueue, setWhatsappQueue] = useState([]);
  const [whatsappProgress, setWhatsappProgress] = useState({ sent: 0, failed: 0, pending: 0, total: 0 });
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const [showWhatsappProgressModal, setShowWhatsappProgressModal] = useState(false);
  const [showWhatsappConfirmModal, setShowWhatsappConfirmModal] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState([]);

  // Drag and drop schedule copy
  const [draggingDay, setDraggingDay] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [scheduleCopyConfirm, setScheduleCopyConfirm] = useState(null);
  const [allWeeklySchedules, setAllWeeklySchedules] = useState([]);
  const [allWeeklySchedulesLoading, setAllWeeklySchedulesLoading] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Time formatting utilities
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 480;
    const matchAmPm = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (matchAmPm) {
      let hours = parseInt(matchAmPm[1]);
      const minutes = parseInt(matchAmPm[2]);
      const ampm = matchAmPm[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    const match24 = timeStr.match(/(\d+):(\d+)/);
    if (match24) {
      const hours = parseInt(match24[1]);
      const minutes = parseInt(match24[2]);
      return hours * 60 + minutes;
    }
    return 480;
  };

  const formatMinutesToTime = (minutes) => {
    const hours24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    const padMins = String(mins).padStart(2, '0');
    const padHours = String(hours12).padStart(2, '0');
    return `${padHours}:${padMins} ${ampm}`;
  };

  const getPeriodTimingString = (periodNumber) => {
    const startMinutes = parseTimeToMinutes(schoolStartTime);
    const p = parseInt(periodNumber) || 1;
    const pDur = parseInt(periodDuration) || 40;
    const iDur = parseInt(intervalDuration) || 20;
    const iAfter = parseInt(intervalAfterPeriod) || 4;
    
    const startTimeMinutes = startMinutes + (p - 1) * pDur + (p - 1 >= iAfter ? iDur : 0);
    const endTimeMinutes = startTimeMinutes + pDur;
    
    return `${formatMinutesToTime(startTimeMinutes)} - ${formatMinutesToTime(endTimeMinutes)}`;
  };

  // --- API METHODS ---

  const fetchSubjects = async () => {
    const keySuffix = schoolId || 'default';
    if (token?.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_subjects_${keySuffix}`);
      const local = stored ? JSON.parse(stored) : [
        { id: 1, name: 'English' },
        { id: 2, name: 'Mathematics' },
        { id: 3, name: 'Science' },
        { id: 4, name: 'Hindi' },
        { id: 5, name: 'Social Studies' },
        { id: 6, name: 'Drawing' },
        { id: 7, name: 'Computer' }
      ];
      setSubjects(local);
      return;
    }
    try {
      const res = await fetch('/api/subjects', { headers: getHeaders() });
      if (res.ok) {
        setSubjects(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    }
  };

  const fetchSchedules = async (classId) => {
    if (!classId) return;
    const keySuffix = schoolId || 'default';
    if (token?.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${classId}`;
      const stored = localStorage.getItem(storedKey);
      const list = stored ? JSON.parse(stored) : [];
      const filtered = list.filter(s => s.week_start_date === weekStartDate);
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const results = [...filtered];
      const existingDays = results.map(r => r.day_of_week);
      
      days.forEach((dayName, dayIndex) => {
        if (!existingDays.includes(dayName)) {
          const refMonday = new Date(weekStartDate);
          const d = new Date(refMonday);
          d.setDate(refMonday.getDate() + dayIndex);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const targetDate = `${yyyy}-${mm}-${dd}`;
          
          let priorRecord = null;
          list.forEach(s => {
            if (s.day_of_week === dayName && s.schedule_date < targetDate) {
              if (!priorRecord || s.schedule_date > priorRecord.schedule_date) {
                priorRecord = s;
              }
            }
          });
          
          if (priorRecord) {
            const inheritedSubjects = (priorRecord.subjects || []).map(sub => ({
              ...sub,
              backup_teacher_id: null,
              backup_teacher_name: null
            }));
            
            results.push({
              id: Date.now() + Math.random(),
              school_id: keySuffix,
              academic_year_id: activeYearId,
              class_id: classId,
              day_of_week: dayName,
              schedule_date: targetDate,
              week_start_date: weekStartDate,
              subjects: inheritedSubjects,
              status: 'Draft'
            });
          }
        }
      });
      
      results.sort((a, b) => a.schedule_date.localeCompare(b.schedule_date));
      setSchedules(results);
      return;
    }
    try {
      const res = await fetch(`/api/schedules?class_id=${classId}&academic_year_id=${activeYearId}&week_start_date=${weekStartDate}`, { headers: getHeaders() });
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch schedules", err);
    }
  };

  const fetchAllWeeklySchedules = async () => {
    if (token?.includes('mock') || !isConnected) return;
    setAllWeeklySchedulesLoading(true);
    try {
      const res = await fetch(`/api/schedules/all-weekly?academic_year_id=${activeYearId}&week_start=${weekStartDate}`, { headers: getHeaders() });
      if (res.ok) {
        setAllWeeklySchedules(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch all weekly schedules", err);
    } finally {
      setAllWeeklySchedulesLoading(false);
    }
  };

  const handleSaveFullSchedule = async (statusVal = 'Draft') => {
    if (!plannerClassId) return;
    const hasPeriods = Object.values(scheduleForm).some(periods => Array.isArray(periods) && periods.length > 0);
    if (!hasPeriods) {
      showToast("No periods are assigned. Please assign at least one period before saving.", "error");
      return;
    }
    setIsSavingSchedule(true);
    setActionError('');
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const refMonday = new Date(weekStartDate);
    const scheduleDates = {};
    days.forEach((day, idx) => {
      const d = new Date(refMonday);
      d.setDate(refMonday.getDate() + idx);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      scheduleDates[day] = `${yyyy}-${mm}-${dd}`;
    });
    
    try {
      const keySuffix = schoolId || 'default';
      if (token?.includes('mock') || !isConnected) {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${plannerClassId}`;
        const stored = localStorage.getItem(storedKey);
        let list = stored ? JSON.parse(stored) : [];
        
        days.forEach(day => {
          const daySubjects = scheduleForm[day] || [];
          const schedDate = scheduleDates[day];
          const existingIdx = list.findIndex(s => s.schedule_date === schedDate);
          
          const scheduleObj = {
            id: existingIdx !== -1 ? list[existingIdx].id : (Date.now() + Math.random()),
            school_id: keySuffix,
            academic_year_id: activeYearId,
            class_id: plannerClassId,
            day_of_week: day,
            schedule_date: schedDate,
            week_start_date: weekStartDate,
            subjects: daySubjects,
            status: statusVal
          };
          if (existingIdx !== -1) {
            list[existingIdx] = scheduleObj;
          } else {
            list.push(scheduleObj);
          }
        });
        
        localStorage.setItem(storedKey, JSON.stringify(list));
        setSchedules(list.filter(s => s.week_start_date === weekStartDate));
        showToast(`Schedule saved as ${statusVal} successfully!`, 'success');
        fetchAllWeeklySchedules();
        return;
      }
      
      // Live DB Mode
      for (const day of days) {
        const daySubjects = scheduleForm[day] || [];
        const schedDate = scheduleDates[day];
        
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            class_id: plannerClassId,
            academic_year_id: activeYearId,
            day_of_week: day,
            schedule_date: schedDate,
            week_start_date: weekStartDate,
            subjects: daySubjects,
            status: statusVal
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || `Failed to save schedule for ${day}`);
        }
      }
      
      await fetchSchedules(plannerClassId);
      showToast(`Schedule saved as ${statusVal} successfully!`, 'success');
      fetchAllWeeklySchedules();
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Failed to save schedule");
      showToast(err.message || "Failed to save schedule", 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveDaySchedule = async (day, statusVal = 'Draft') => {
    if (!plannerClassId) return;
    const daySubjects = scheduleForm[day] || [];
    if (daySubjects.length === 0) {
      showToast("No periods assigned for this day.", "error");
      return;
    }
    setIsSavingSchedule(true);
    setActionError('');
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = days.indexOf(day);
    if (idx === -1) {
      setIsSavingSchedule(false);
      return;
    }
    
    const refMonday = new Date(weekStartDate);
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + idx);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const schedDate = `${yyyy}-${mm}-${dd}`;
    
    try {
      const keySuffix = schoolId || 'default';
      if (token?.includes('mock') || !isConnected) {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${plannerClassId}`;
        const stored = localStorage.getItem(storedKey);
        let list = stored ? JSON.parse(stored) : [];
        
        const existingIdx = list.findIndex(s => s.schedule_date === schedDate);
        
        const scheduleObj = {
          id: existingIdx !== -1 ? list[existingIdx].id : (Date.now() + Math.random()),
          school_id: keySuffix,
          academic_year_id: activeYearId,
          class_id: plannerClassId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal
        };
        if (existingIdx !== -1) {
          list[existingIdx] = scheduleObj;
        } else {
          list.push(scheduleObj);
        }
        
        localStorage.setItem(storedKey, JSON.stringify(list));
        setSchedules(list.filter(s => s.week_start_date === weekStartDate));
        showToast(`${day} schedule saved as ${statusVal} successfully!`, 'success');
        fetchAllWeeklySchedules();
        return;
      }
      
      // Live DB Mode
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: plannerClassId,
          academic_year_id: activeYearId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || `Failed to save schedule for ${day}`);
      }
      
      await fetchSchedules(plannerClassId);
      await fetchAllWeeklySchedules();
      showToast(`${day} schedule saved as ${statusVal} successfully!`, 'success');
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Failed to save schedule");
      showToast(err.message || "Failed to save schedule", 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const autoSaveDaySchedule = async (day, daySubjects, statusVal = 'Draft', propagate = false, propagateType = '', targetIndex = -1) => {
    if (!plannerClassId) return;
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = days.indexOf(day);
    if (idx === -1) return;
    
    const refMonday = new Date(weekStartDate);
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + idx);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const schedDate = `${yyyy}-${mm}-${dd}`;
    
    try {
      const keySuffix = schoolId || 'default';
      if (token?.includes('mock') || !isConnected) {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${plannerClassId}`;
        const stored = localStorage.getItem(storedKey);
        let list = stored ? JSON.parse(stored) : [];
        
        const existingIdx = list.findIndex(s => s.schedule_date === schedDate);
        
        const scheduleObj = {
          id: existingIdx !== -1 ? list[existingIdx].id : (Date.now() + Math.random()),
          school_id: keySuffix,
          academic_year_id: activeYearId,
          class_id: plannerClassId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal
        };
        if (existingIdx !== -1) {
          list[existingIdx] = scheduleObj;
        } else {
          list.push(scheduleObj);
        }
        
        if (propagate && propagateType) {
          list.forEach(s => {
            if (s.day_of_week === day && s.schedule_date > schedDate) {
              const futSubjects = Array.isArray(s.subjects) ? [...s.subjects] : [];
              let modified = false;
              
              if (propagateType === 'add') {
                if (daySubjects.length > 0) {
                  const newPeriod = { ...daySubjects[daySubjects.length - 1] };
                  newPeriod.backup_teacher_id = null;
                  newPeriod.backup_teacher_name = null;
                  futSubjects.push(newPeriod);
                  modified = true;
                }
              } else if (propagateType === 'remove') {
                if (targetIndex >= 0 && targetIndex < futSubjects.length) {
                  futSubjects.splice(targetIndex, 1);
                  modified = true;
                }
              } else if (propagateType === 'replace') {
                if (targetIndex >= 0 && targetIndex < daySubjects.length && targetIndex < futSubjects.length) {
                  const currentPeriod = daySubjects[targetIndex];
                  futSubjects[targetIndex] = {
                    ...futSubjects[targetIndex],
                    teacher_id: currentPeriod.teacher_id,
                    teacher_name: currentPeriod.teacher_name,
                    backup_teacher_id: null,
                    backup_teacher_name: null
                  };
                  modified = true;
                }
              }
              
              if (modified) {
                s.subjects = futSubjects;
              }
            }
          });
        }
        
        localStorage.setItem(storedKey, JSON.stringify(list));
        setSchedules(list.filter(s => s.week_start_date === weekStartDate));
        fetchAllWeeklySchedules();
        return;
      }
      
      // Live DB Mode
      await fetch('/api/schedules', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: plannerClassId,
          academic_year_id: activeYearId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal,
          propagate,
          propagate_type: propagateType,
          target_index: targetIndex
        })
      });
      await fetchSchedules(plannerClassId);
      await fetchAllWeeklySchedules();
    } catch (err) {
      console.error("Auto-save failed", err);
    }
  };

  const handleCopyDayScheduleDragDrop = (sourceDay, targetDay) => {
    const sourcePeriods = scheduleForm[sourceDay] || [];
    const targetPeriods = scheduleForm[targetDay] || [];
    
    if (sourcePeriods.length === 0) {
      showToast(`No periods in ${sourceDay} to copy.`, "warning");
      return;
    }
    
    const performCopy = () => {
      const copiedPeriods = JSON.parse(JSON.stringify(sourcePeriods));
      setScheduleForm(prev => ({
        ...prev,
        [targetDay]: copiedPeriods
      }));
      
      autoSaveDaySchedule(targetDay, copiedPeriods, 'Draft');
      showToast("Schedule copied successfully", "success");
    };
    
    if (targetPeriods.length > 0) {
      setScheduleCopyConfirm({
        targetDay,
        onConfirm: performCopy
      });
    } else {
      performCopy();
    }
  };

  const handleNavigateWeek = (weeksOffset) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + (weeksOffset * 7));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setWeekStartDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    const name = newSubjectName.trim();
    if (!name) return;
    setActionError('');
    const keySuffix = schoolId || 'default';
    if (token?.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_subjects_${keySuffix}`;
      const stored = localStorage.getItem(storedKey);
      let list = stored ? JSON.parse(stored) : [
        { id: 1, name: 'English' },
        { id: 2, name: 'Mathematics' },
        { id: 3, name: 'Science' },
        { id: 4, name: 'Hindi' },
        { id: 5, name: 'Social Studies' },
        { id: 6, name: 'Drawing' },
        { id: 7, name: 'Computer' }
      ];
      
      if (list.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        setActionError("Subject already exists");
        showToast("Subject already exists", 'error');
        return;
      }
      
      const newSub = {
        id: Date.now(),
        school_id: keySuffix,
        name: name
      };
      list.push(newSub);
      localStorage.setItem(storedKey, JSON.stringify(list));
      setSubjects(list);
      setNewSubjectName('');
      showToast("Subject added successfully!", 'success');
      return;
    }
    
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setNewSubjectName('');
        await fetchSubjects();
        showToast("Subject added successfully!", 'success');
      } else {
        const errData = await res.json();
        setActionError(errData.detail || "Failed to add subject");
        showToast(errData.detail || "Failed to add subject", 'error');
      }
    } catch (err) {
      console.error(err);
      setActionError("Failed to add subject");
      showToast("Failed to add subject", 'error');
    }
  };

  const handleDeleteSubject = async (id) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    setActionError('');
    const keySuffix = schoolId || 'default';
    if (token?.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_subjects_${keySuffix}`;
      const stored = localStorage.getItem(storedKey);
      let list = stored ? JSON.parse(stored) : [];
      list = list.filter(s => s.id !== id);
      localStorage.setItem(storedKey, JSON.stringify(list));
      setSubjects(list);
      showToast("Subject deleted successfully!", 'success');
      return;
    }
    
    try {
      const res = await fetch(`/api/subjects/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchSubjects();
        showToast("Subject deleted successfully!", 'success');
      } else {
        const errData = await res.json();
        setActionError(errData.detail || "Failed to delete subject");
        showToast(errData.detail || "Failed to delete subject", 'error');
      }
    } catch (err) {
      console.error(err);
      setActionError("Failed to delete subject");
      showToast("Failed to delete subject", 'error');
    }
  };

  const handleTriggerNotifications = async () => {
    setActionError('');
    try {
      const res = await fetch('/api/schedules/trigger-notifications', {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message, 'success');
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Failed to trigger notifications", 'error');
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to trigger parent notifications", 'error');
    }
  };

  const handleInitWhatsappReminders = async () => {
    if (!plannerClassId) {
      showToast("Please select a classroom first.", "error");
      return;
    }
    const currentClass = classrooms.find(c => c.id === plannerClassId);
    const className = currentClass ? currentClass.name : `Class ${plannerClassId}`;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tomorrowDay = days[tomorrow.getDay()];
    
    const tomorrowSchedule = schedules.find(s => s.day_of_week.toLowerCase() === tomorrowDay.toLowerCase());
    
    if (!tomorrowSchedule || tomorrowSchedule.status !== 'Published') {
      showToast(`Tomorrow's schedule (${tomorrowDay}) is not published for ${className}. Please publish it first.`, "error");
      return;
    }
    
    setShowWhatsappConfirmModal(true);
  };

  const executeSendWhatsappReminders = async () => {
    setShowWhatsappConfirmModal(false);
    setActionError('');
    setIsSendingWhatsapp(true);
    setShowWhatsappProgressModal(true);
    setWhatsappProgress({ sent: 0, failed: 0, pending: 0, total: 0 });
    
    try {
      const res = await fetch('/api/schedules/whatsapp-reminders/init', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ class_id: plannerClassId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to initialize WhatsApp reminder queue");
      }
      
      const data = await res.json();
      const queue = data.queue || [];
      const total = queue.length;
      
      setWhatsappQueue(queue);
      setWhatsappProgress({ sent: 0, failed: 0, pending: total, total });
      
      await processWhatsappQueue(queue);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to start WhatsApp reminders", "error");
      setIsSendingWhatsapp(false);
      setShowWhatsappProgressModal(false);
    }
  };

  const processWhatsappQueue = async (queue) => {
    let sentCount = 0;
    let failedCount = 0;
    const localQueue = [...queue];
    
    for (let i = 0; i < localQueue.length; i++) {
      const item = localQueue[i];
      setWhatsappProgress(prev => ({
        ...prev,
        pending: prev.total - (sentCount + failedCount) - 1
      }));
      
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const res = await fetch('/api/schedules/whatsapp-reminders/send-single', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ log_id: item.id })
        });
        
        if (res.ok) {
          const resData = await res.json();
          const updatedLog = resData.log;
          if (updatedLog) {
            localQueue[i] = updatedLog;
            setWhatsappQueue([...localQueue]);
            
            if (updatedLog.status === 'Sent') {
              sentCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(err);
        failedCount++;
      }
      
      setWhatsappProgress(prev => ({
        ...prev,
        sent: sentCount,
        failed: failedCount
      }));
    }
    
    setIsSendingWhatsapp(false);
    showToast("WhatsApp reminders sent successfully.", "success");
    fetchWhatsappHistory();
  };

  const fetchWhatsappHistory = async () => {
    try {
      const res = await fetch('/api/schedules/whatsapp-reminders/history', { headers: getHeaders() });
      if (res.ok) {
        setWhatsappLogs(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch WhatsApp history", err);
    }
  };

  // Sync state parameters from schedules
  useEffect(() => {
    if (classrooms.length > 0 && !plannerClassId) {
      setPlannerClassId(classrooms[0].id);
    }
  }, [classrooms]);

  useEffect(() => {
    if (plannerClassId) {
      fetchSchedules(plannerClassId);
    }
    fetchSubjects();
    fetchWhatsappHistory();
    fetchAllWeeklySchedules();
  }, [plannerClassId, weekStartDate, activeYearId]);

  useEffect(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const newForm = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
    
    schedules.forEach(s => {
      if (days.includes(s.day_of_week)) {
        newForm[s.day_of_week] = Array.isArray(s.subjects) ? s.subjects : [];
      }
    });
    setScheduleForm(newForm);
  }, [schedules]);

  // UI Event Handlers for Period Editing
  const handleCellAction = (day, periodIndex, action, value = null) => {
    const currentPeriods = [...(scheduleForm[day] || [])];
    
    if (action === 'add') {
      const placeholderPeriod = {
        subject: '',
        teacher_id: '',
        teacher_name: '',
        backup_teacher_id: null,
        backup_teacher_name: null
      };
      currentPeriods.push(placeholderPeriod);
      setScheduleForm(prev => ({ ...prev, [day]: currentPeriods }));
      autoSaveDaySchedule(day, currentPeriods, 'Draft', true, 'add');
    } else if (action === 'subject') {
      if (currentPeriods[periodIndex]) {
        currentPeriods[periodIndex].subject = value;
        setScheduleForm(prev => ({ ...prev, [day]: currentPeriods }));
        autoSaveDaySchedule(day, currentPeriods, 'Draft');
      }
    } else if (action === 'teacher') {
      if (currentPeriods[periodIndex]) {
        const teacherObj = teachers.find(t => t.id === parseInt(value));
        currentPeriods[periodIndex].teacher_id = value ? parseInt(value) : '';
        currentPeriods[periodIndex].teacher_name = teacherObj ? teacherObj.name : '';
        currentPeriods[periodIndex].backup_teacher_id = null;
        currentPeriods[periodIndex].backup_teacher_name = null;
        setScheduleForm(prev => ({ ...prev, [day]: currentPeriods }));
        autoSaveDaySchedule(day, currentPeriods, 'Draft', true, 'replace', periodIndex);
      }
    } else if (action === 'remove') {
      if (confirm("Are you sure you want to delete this period?")) {
        currentPeriods.splice(periodIndex, 1);
        setScheduleForm(prev => ({ ...prev, [day]: currentPeriods }));
        autoSaveDaySchedule(day, currentPeriods, 'Draft', true, 'remove', periodIndex);
      }
    }
  };

  const handleTeacherReplaceBackupExecute = () => {
    const { type, day, periodIndex, subject, currentTeacherId } = teacherActionModal;
    const currentPeriods = [...(scheduleForm[day] || [])];
    const period = currentPeriods[periodIndex];
    
    if (!period) return;
    
    const targetTeacherId = selectedModalTeacherId ? parseInt(selectedModalTeacherId) : null;
    const targetTeacher = teachers.find(t => t.id === targetTeacherId);
    const targetName = targetTeacher ? targetTeacher.name : '';
    
    if (type === 'Replace') {
      period.teacher_id = targetTeacherId || '';
      period.teacher_name = targetName;
      period.backup_teacher_id = null;
      period.backup_teacher_name = null;
    } else if (type === 'Backup') {
      period.backup_teacher_id = targetTeacherId;
      period.backup_teacher_name = targetName;
    }
    
    setScheduleForm(prev => ({ ...prev, [day]: currentPeriods }));
    autoSaveDaySchedule(day, currentPeriods, 'Draft');
    showToast(`Teacher successfully set as ${type.toLowerCase()} for the class period.`, 'success');
    setTeacherActionModal({ show: false, type: '', day: '', periodIndex: null, subject: '', currentTeacherId: null });
    setSelectedModalTeacherId('');
  };

  const isDayEditable = (dayName) => {
    if (!isCurrentYearActive()) return false;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = days.indexOf(dayName);
    if (idx === -1) return false;
    const refMonday = new Date(weekStartDate);
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + idx);
    const today = new Date();
    today.setHours(0,0,0,0);
    return d >= today;
  };

  const getWeekRangeString = () => {
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    
    const format = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const yyyy = date.getFullYear();
      return `${day}-${month}-${yyyy}`;
    };
    return `${format(start)} to ${format(end)}`;
  };

  const getDayStatus = (day) => {
    const sched = schedules.find(s => s.day_of_week === day);
    return sched ? sched.status : 'Draft';
  };

  const handleCopyDrop = (targetDay) => {
    if (!draggingDay) return;
    if (draggingDay === targetDay) return;
    handleCopyDayScheduleDragDrop(draggingDay, targetDay);
    setDraggingDay(null);
    setDragOverDay(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header Banner */}
      {!isCurrentYearActive() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px', color: '#fef08a' }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
            <AlertTriangle size={18} /> Read-only Session
          </strong>
          <span style={{ fontSize: '0.85rem' }}>This academic session is not active. Modifying timetable schedules or publishing periods is disabled.</span>
        </div>
      )}

      <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Calendar size={22} className="gradient-text" />
            Academic Planner & Timetable Management
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
            Configure day-wise subjects and teachers weekly. Drag & drop days to clone layouts.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            id="btn-manage-subjects"
            onClick={() => {
              if (!isCurrentYearActive()) return;
              fetchSubjects();
              setShowSubjectModal(true);
            }}
            disabled={!isCurrentYearActive()}
            className="btn-outline"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', opacity: isCurrentYearActive() ? 1 : 0.5, cursor: isCurrentYearActive() ? 'pointer' : 'not-allowed' }}
          >
            <Sliders size={16} /> Manage Subjects
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              id="btn-trigger-reminders"
              onClick={() => {
                if (!isCurrentYearActive()) return;
                handleInitWhatsappReminders();
              }}
              disabled={!isCurrentYearActive()}
              className="btn-outline"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', color: isCurrentYearActive() ? '#10b981' : 'var(--text-muted)', borderColor: isCurrentYearActive() ? '#10b981' : 'var(--border-color)', opacity: isCurrentYearActive() ? 1 : 0.5, cursor: isCurrentYearActive() ? 'pointer' : 'not-allowed' }}
            >
              <span>📲 Send Tomorrow's Reminders</span>
            </button>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Class:</span>
            <select
              id="planner-class-select"
              value={plannerClassId || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null;
                setPlannerClassId(val);
              }}
              className="sp-input"
              style={{ padding: '6px 12px', minWidth: '150px' }}
            >
              {classrooms.length === 0 ? (
                <option value="">No Classes Available</option>
              ) : (
                classrooms.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Week Starting:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button 
                  id="btn-prev-week"
                  type="button"
                  onClick={() => handleNavigateWeek(-1)}
                  className="btn-outline"
                  style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Previous Week"
                >
                  <ChevronLeft size={14} />
                </button>
                
                <input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      const selected = new Date(e.target.value);
                      const day = selected.getDay();
                      const diff = selected.getDate() - day + (day === 0 ? -6 : 1);
                      const monday = new Date(selected.setDate(diff));
                      const yyyy = monday.getFullYear();
                      const mm = String(monday.getMonth() + 1).padStart(2, '0');
                      const dd = String(monday.getDate()).padStart(2, '0');
                      setWeekStartDate(`${yyyy}-${mm}-${dd}`);
                    }
                  }}
                  className="sp-input"
                  style={{ padding: '6px 12px' }}
                />

                <button 
                  id="btn-next-week"
                  type="button"
                  onClick={() => handleNavigateWeek(1)}
                  className="btn-outline"
                  style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Next Week"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>({getWeekRangeString()})</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            id="btn-notify-parents"
            onClick={handleTriggerNotifications}
            className="btn-outline"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Broadcast tomorrow's schedule notifications to parent dashboards"
          >
            📢 Broadcast Schedule
          </button>
          
          {isCurrentYearActive() && (
            <button 
              id="btn-save-week-schedule"
              onClick={() => handleSaveFullSchedule('Published')}
              className="btn-primary"
              disabled={isSavingSchedule}
              style={{ padding: '8px 16px' }}
            >
              {isSavingSchedule ? 'Publishing...' : 'Publish Full Week'}
            </button>
          )}
        </div>
      </div>

      {/* Week Grid */}
      <div className="planner-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
          const periods = scheduleForm[day] || [];
          const isEditable = isDayEditable(day);
          const dayStatus = getDayStatus(day);
          
          return (
            <div 
              key={day} 
              className={`sp-card planner-day-card ${dayStatus === 'Published' ? 'border-published' : ''}`}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                border: dragOverDay === day ? '2px dashed var(--color-primary)' : '1px solid var(--border-color)',
                opacity: draggingDay === day ? 0.4 : 1,
                cursor: isCurrentYearActive() ? 'grab' : 'default',
                transform: dragOverDay === day ? 'scale(1.02)' : 'none',
                transition: 'all 0.2s ease'
              }}
              draggable={isCurrentYearActive()}
              onDragStart={(e) => {
                if (!isCurrentYearActive()) return;
                setDraggingDay(day);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isCurrentYearActive() || draggingDay === day) return;
                setDragOverDay(day);
              }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={() => handleCopyDrop(day)}
            >
              {/* Day Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{day}</h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {dayStatus === 'Published' ? '🟢 Published' : '🟡 Draft'}
                  </span>
                </div>
                
                {isEditable && (
                  <button 
                    onClick={() => handleCellAction(day, null, 'add')}
                    className="btn-outline" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> Add Period
                  </button>
                )}
              </div>

              {/* Periods List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px' }}>
                {periods.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius)', padding: '16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No periods assigned.
                  </div>
                ) : (
                  periods.map((p, idx) => {
                    const dropdownKey = `${day}-${idx}`;
                    
                    return (
                      <div key={idx} className="period-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: '8px', alignItems: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', position: 'relative' }}>
                        
                        {/* Time slot */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>P - {idx + 1}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{getPeriodTimingString(idx + 1)}</span>
                        </div>

                        {/* Subject & Teacher fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {isEditable ? (
                            <>
                              <select 
                                className="sp-input"
                                style={{ padding: '3px 6px', fontSize: '0.8rem' }}
                                value={p.subject || ''}
                                onChange={(e) => handleCellAction(day, idx, 'subject', e.target.value)}
                              >
                                <option value="">Select Subject</option>
                                {subjects.map(s => (
                                  <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                              </select>
                              
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <select 
                                  className="sp-input"
                                  style={{ padding: '3px 6px', fontSize: '0.8rem', flex: 1 }}
                                  value={p.teacher_id || ''}
                                  onChange={(e) => handleCellAction(day, idx, 'teacher', e.target.value)}
                                >
                                  <option value="">Select Faculty</option>
                                  {teachers.filter(t => t.status === 'Active').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                                
                                <button 
                                  onClick={() => setActiveDropdownKey(activeDropdownKey === dropdownKey ? null : dropdownKey)}
                                  className="btn-outline"
                                  style={{ padding: '4px' }}
                                  title="Actions"
                                >
                                  <Sliders size={12} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.subject || 'No Subject'}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                👤 {p.teacher_name || 'Unassigned'}
                                {p.backup_teacher_name && (
                                  <span style={{ color: '#f59e0b', marginLeft: '4px' }} title={`Backup: ${p.backup_teacher_name}`}>
                                    (Sub: {p.backup_teacher_name})
                                  </span>
                                )}
                              </span>
                            </>
                          )}

                          {/* Substitutions Dropdown Options */}
                          {activeDropdownKey === dropdownKey && (
                            <div className="sp-card" style={{ position: 'absolute', top: '90%', left: '10px', right: '10px', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
                              <button 
                                onClick={() => {
                                  setActiveDropdownKey(null);
                                  setTeacherActionModal({ show: true, type: 'Replace', day, periodIndex: idx, subject: p.subject, currentTeacherId: p.teacher_id });
                                }}
                                className="btn-outline" 
                                style={{ fontSize: '0.75rem', padding: '4px 8px', justifyContent: 'flex-start' }}
                              >
                                Replace Faculty
                              </button>
                              <button 
                                onClick={() => {
                                  setActiveDropdownKey(null);
                                  setTeacherActionModal({ show: true, type: 'Backup', day, periodIndex: idx, subject: p.subject, currentTeacherId: p.teacher_id });
                                }}
                                className="btn-outline" 
                                style={{ fontSize: '0.75rem', padding: '4px 8px', justifyContent: 'flex-start' }}
                              >
                                Assign Substitution
                              </button>
                              <button 
                                onClick={() => setActiveDropdownKey(null)}
                                className="btn-outline" 
                                style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: 'transparent' }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Remove Button */}
                        {isEditable && (
                          <button 
                            onClick={() => handleCellAction(day, idx, 'remove')}
                            className="btn-outline"
                            style={{ padding: '6px', color: '#ef4444', borderColor: '#fca5a5' }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Day Save Action */}
              {isEditable && periods.length > 0 && (
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => handleSaveDaySchedule(day, 'Published')}
                    className="btn-primary" 
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    Publish Day
                  </button>
                </div>
              )}
              
              {!isEditable && periods.length > 0 && (
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Lock size={12} /> Schedule locked (Past day / session)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- MODALS --- */}

      {/* Subjects management modal */}
      {showSubjectModal && (
        <div className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Subjects Management</h3>
              <button onClick={() => setShowSubjectModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input 
                type="text" 
                className="sp-input" 
                value={newSubjectName} 
                onChange={(e) => setNewSubjectName(e.target.value)} 
                required 
                placeholder="Subject Name (e.g. Physics)"
              />
              <button type="submit" className="btn-primary">Add</button>
            </form>

            {actionError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '10px' }}>{actionError}</div>
            )}

            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {subjects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>No subjects added yet.</p>
              ) : (
                subjects.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
                    <span>{s.name}</span>
                    <button 
                      onClick={() => handleDeleteSubject(s.id)} 
                      className="btn-outline" 
                      style={{ padding: '4px', color: '#ef4444', borderColor: '#fca5a5' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Substitution / Replace Modal */}
      {teacherActionModal.show && (
        <div className="modal-overlay" onClick={() => setTeacherActionModal({ show: false, type: '', day: '', periodIndex: null, subject: '', currentTeacherId: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{teacherActionModal.type} Timetable Teacher</h3>
              <button onClick={() => setTeacherActionModal({ show: false, type: '', day: '', periodIndex: null, subject: '', currentTeacherId: null })} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.85rem' }}>
                Allocate a substitute or replacement faculty for <b>{teacherActionModal.subject}</b> on <b>{teacherActionModal.day}</b> (Period {teacherActionModal.periodIndex + 1}).
              </p>
              
              <div>
                <label className="form-label">Available Teachers</label>
                <select
                  value={selectedModalTeacherId}
                  onChange={(e) => setSelectedModalTeacherId(e.target.value)}
                  className="sp-input"
                  required
                >
                  <option value="">Select Teacher</option>
                  {teachers.filter(t => t.id !== teacherActionModal.currentTeacherId && t.status === 'Active').map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button onClick={() => setTeacherActionModal({ show: false, type: '', day: '', periodIndex: null, subject: '', currentTeacherId: null })} className="btn-outline">Cancel</button>
                <button onClick={handleTeacherReplaceBackupExecute} className="btn-primary" disabled={!selectedModalTeacherId}>
                  Apply Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy day schedule overwrite confirm modal */}
      {scheduleCopyConfirm && (
        <div className="modal-overlay" onClick={() => setScheduleCopyConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Overwrite Day Schedule</h3>
              <button onClick={() => setScheduleCopyConfirm(null)} style={{ background: 'transparent', border: 'none' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              The destination day <b>{scheduleCopyConfirm.targetDay}</b> already has a timetable configured. Dragging will overwrite its current settings. Do you want to proceed?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => setScheduleCopyConfirm(null)} className="btn-outline">Cancel</button>
              <button 
                onClick={() => {
                  scheduleCopyConfirm.onConfirm();
                  setScheduleCopyConfirm(null);
                }} 
                className="btn-primary"
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' }}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Confirm Onboarding Modal */}
      {showWhatsappConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowWhatsappConfirmModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Confirm Notification Broadcast</h3>
              <button onClick={() => setShowWhatsappConfirmModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              This will queue automated reminders to all parent WhatsApp numbers linked to students in this class. Each message outlines tomorrow's scheduled subjects.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button onClick={() => setShowWhatsappConfirmModal(false)} className="btn-outline">Cancel</button>
              <button onClick={executeSendWhatsappReminders} className="btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}>
                🚀 Start Broadcast Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Progress Delivery Modal */}
      {showWhatsappProgressModal && (
        <div className="modal-overlay" onClick={() => !isSendingWhatsapp && setShowWhatsappProgressModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>WhatsApp Queue Status</h3>
              {!isSendingWhatsapp && (
                <button onClick={() => setShowWhatsappProgressModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Progress counter */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{whatsappProgress.total}</div>
                </div>
                <div style={{ background: 'rgba(16,185,129,0.05)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid rgba(16,185,129,0.1)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Sent</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{whatsappProgress.sent}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.05)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Failed</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>{whatsappProgress.failed}</div>
                </div>
                <div style={{ background: 'rgba(245,158,11,0.05)', padding: '10px', borderRadius: 'var(--radius)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Pending</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{whatsappProgress.pending}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  background: 'var(--color-primary)', 
                  width: `${whatsappProgress.total > 0 ? ((whatsappProgress.sent + whatsappProgress.failed) / whatsappProgress.total) * 100 : 0}%`,
                  transition: 'width 0.15s ease'
                }}></div>
              </div>

              {/* Queue Log List */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {whatsappQueue.map((item, idx) => (
                  <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{item.recipient_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{item.recipient_phone}</span>
                    </div>
                    <span className={`badge ${item.status === 'Sent' ? 'badge-success' : item.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              {isSendingWhatsapp && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <RefreshCw className="animate-spin" size={16} /> Deliveries in progress. Please do not close this modal.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Delivery History Logs */}
      <div className="sp-card">
        <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px' }}>WhatsApp Delivery logs (Last 50 Broadcasts)</h4>
        <div className="sp-table-container">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Recipient Name</th>
                <th>Recipient Contact</th>
                <th>Status Code</th>
                <th>Message Content</th>
                <th>Delivery Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {whatsappLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No broadcasts recorded in this session.</td>
                </tr>
              ) : (
                whatsappLogs.slice(0, 50).map((log, idx) => (
                  <tr key={log.id || idx}>
                    <td style={{ fontWeight: 600 }}>{log.recipient_name}</td>
                    <td>{log.recipient_phone}</td>
                    <td>
                      <span className={`badge ${log.status === 'Sent' ? 'badge-success' : 'badge-danger'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', maxWidth: '300px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={log.message}>
                      {log.message}
                    </td>
                    <td>{log.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
