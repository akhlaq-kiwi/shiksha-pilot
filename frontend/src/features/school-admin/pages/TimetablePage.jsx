import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Edit, Trash2, ShieldAlert, CheckCircle2, Lock, MoreVertical, RefreshCw, UserPlus, Users, FileText, Download, Printer } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { useToast } from '../../../common/components/Toast';
import html2pdf from 'html2pdf.js';

const getLocalDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TimetablePage() {
  const { currentYear, isReadOnly } = useAcademicYear();
  const toast = useToast();

  // Navigation states
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [currentDate, setCurrentDate] = useState(getLocalDateStr);

  // Timetable resolved structure
  const [timetableData, setTimetableData] = useState({});
  const [periodConfigs, setPeriodConfigs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allTimetableEntries, setAllTimetableEntries] = useState([]);

  // Load state
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Dialog states
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isPeriodActionsOpen, setIsPeriodActionsOpen] = useState(false);

  // Active items for actions
  const [activeTimetableItem, setActiveTimetableItem] = useState(null);
  const [activeDate, setActiveDate] = useState('');
  const [subjectToDelete, setSubjectToDelete] = useState(null);

  // Form states
  const [newSubject, setNewSubject] = useState({ id: '', name: '' });
  const [subjectError, setSubjectError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [modalClassId, setModalClassId] = useState('');
  const [modalSubjects, setModalSubjects] = useState([]);
  const [backupTeacherId, setBackupTeacherId] = useState('');
  const [replaceTeacherId, setReplaceTeacherId] = useState('');
  const [periodToDelete, setPeriodToDelete] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [timetableSettings, setTimetableSettings] = useState(null);
  const [copiedSchedule, setCopiedSchedule] = useState(null);
  const [isPasteConfirmOpen, setIsPasteConfirmOpen] = useState(false);
  const [pasteDestinationDay, setPasteDestinationDay] = useState('');

  // Inline forms for adding period per day
  const [addPeriodForm, setAddPeriodForm] = useState({
    Monday: { subject_id: '', teacher_id: '' },
    Tuesday: { subject_id: '', teacher_id: '' },
    Wednesday: { subject_id: '', teacher_id: '' },
    Thursday: { subject_id: '', teacher_id: '' },
    Friday: { subject_id: '', teacher_id: '' },
    Saturday: { subject_id: '', teacher_id: '' }
  });

  // Load initial options
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const list = await schoolService.getClasses();
        setClasses(list || []);
        if (list && list.length > 0) {
          setSelectedClassId(String(list[0].id));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchClasses();
    loadStaff();
    loadTimetableSettings();
  }, []);

  // Fetch timetable when class or date changes
  useEffect(() => {
    if (selectedClassId) {
      loadTimetable();
      loadPeriodConfigs();
      loadSubjects();
      loadStaff();
    }
  }, [selectedClassId, currentDate]);

  const loadTimetableSettings = async () => {
    try {
      const settings = await schoolAdminService.getTimetableSettings();
      setTimetableSettings(settings || null);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStaff = async () => {
    if (!currentDate) return;
    try {
      const list = await schoolService.getStaff({ date: currentDate });
      setStaff(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubjects = async () => {
    if (!selectedClassId) return;
    try {
      const list = await schoolAdminService.getSubjects({ class_id: selectedClassId });
      setSubjects(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadPeriodConfigs = async () => {
    try {
      const list = await schoolAdminService.getPeriodConfigurations({ date: currentDate });
      setPeriodConfigs(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadTimetable = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await schoolAdminService.getTimetable({
        class_id: selectedClassId,
        date: currentDate
      });
      setTimetableData(data || {});

      // Query school-wide timetable to check occupancy
      const allEntries = await schoolAdminService.getTimetable({
        date: currentDate
      });
      setAllTimetableEntries(allEntries || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  };

  // Helper: format local date strings safely
  const formatLocalDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Navigation handlers
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d.toISOString().substring(0, 10));
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d.toISOString().substring(0, 10));
  };

  // Check if a resolved Sunday is in the past
  const checkIsPastWeek = () => {
    if (!timetableData || !timetableData.Sunday) return false;
    const sundayDate = timetableData.Sunday.date;
    const todayStr = new Date().toISOString().substring(0, 10);
    return sundayDate < todayStr;
  };

  const isWeekLocked = checkIsPastWeek() || isReadOnly;

  // Add Period to a day card
  const handleAddPeriod = async (dayName) => {
    const form = addPeriodForm[dayName];
    if (!form.subject_id || !form.teacher_id) {
      setFormErrors(prev => ({
        ...prev,
        [dayName]: 'Please select both a Subject and a Teacher.'
      }));
      return;
    }

    const currentPeriods = timetableData[dayName]?.periods || [];
    const scheduledNums = currentPeriods.map(p => p.period_number);
    const availableConfig = periodConfigs.find(c => !scheduledNums.includes(c.period_number));

    if (!availableConfig) {
      setError("Cannot add more periods. All configured slots for this day are already scheduled.");
      return;
    }
    const nextPeriodNum = availableConfig.period_number;

    setActionLoading('add-' + dayName);
    setError('');
    try {
      await schoolAdminService.createTimetableEntry({
        class_id: parseInt(selectedClassId),
        subject_id: parseInt(form.subject_id),
        teacher_id: parseInt(form.teacher_id),
        day_of_week: dayName,
        period_number: nextPeriodNum,
        start_date: timetableData[dayName].date
      });
      setFormErrors(prev => ({
        ...prev,
        [dayName]: ''
      }));
      setAddPeriodForm(prev => ({
        ...prev,
        [dayName]: { subject_id: '', teacher_id: '' }
      }));
      await loadTimetable();
      await loadStaff(); // Reload workloads
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to add timetable period.');
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Period
  const handleDeletePeriod = async (id, dayDate) => {
    setActionLoading('modal');
    setError('');
    try {
      await schoolAdminService.deleteTimetableEntry(id, { date: dayDate });
      await loadTimetable();
      await loadStaff(); // Reload workloads
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to delete period.');
    } finally {
      setActionLoading(null);
    }
  };

  // Backup Teacher action
  const handleAssignBackup = async () => {
    if (!backupTeacherId) {
      setError('Please select a backup teacher.');
      return;
    }

    setActionLoading('modal');
    setError('');
    try {
      await schoolAdminService.assignBackupTeacher({
        timetable_id: activeTimetableItem.id,
        date: activeDate,
        backup_teacher_id: parseInt(backupTeacherId)
      });
      setIsBackupModalOpen(false);
      setBackupTeacherId('');
      await loadTimetable();
      await loadStaff();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to assign backup teacher.');
    } finally {
      setActionLoading(null);
    }
  };

  // Replace Teacher permanently
  const handleReplaceTeacher = async () => {
    if (!replaceTeacherId) {
      setError('Please select a replacement teacher.');
      return;
    }

    setActionLoading('modal');
    setError('');
    try {
      await schoolAdminService.replaceTeacher({
        timetable_id: activeTimetableItem.id,
        date: activeDate,
        new_teacher_id: parseInt(replaceTeacherId)
      });
      setIsReplaceModalOpen(false);
      setReplaceTeacherId('');
      await loadTimetable();
      await loadStaff();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to replace teacher.');
    } finally {
      setActionLoading(null);
    }
  };

  // Publish week's schedule
  const handlePublishWeek = async () => {
    setActionLoading('publish-week');
    setError('');
    try {
      await schoolAdminService.publishTimetable({
        class_id: parseInt(selectedClassId),
        date: currentDate
      });
      await loadTimetable();
      await loadStaff();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to publish week.');
    } finally {
      setActionLoading(null);
    }
  };

  // Publish day's schedule
  const handlePublishDay = async (dayName, dateStr) => {
    setActionLoading('publish-' + dayName);
    setError('');
    try {
      await schoolAdminService.publishTimetable({
        class_id: parseInt(selectedClassId),
        date: dateStr,
        day_of_week: dayName
      });
      await loadTimetable();
      await loadStaff();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || `Failed to publish schedule for ${dayName}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedDays([]);
    } else {
      setIsSelectionMode(true);
      setSelectedDays([]);
    }
  };

  const handleToggleDaySelection = (dayName) => {
    setSelectedDays(prev => 
      prev.includes(dayName) 
        ? prev.filter(d => d !== dayName) 
        : [...prev, dayName]
    );
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('timetable-print-area');
    if (!element) return;

    const opt = {
      margin: 15,
      filename: `Timetable_Schedule_${classes.find(c => String(c.id) === String(selectedClassId))?.name || 'Class'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setIsSelectionMode(false);
      setSelectedDays([]);
    });
  };

  const handlePrintSchedule = () => {
    const printContent = document.getElementById('timetable-print-area').innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write('<html><head><title>Print Timetable Schedule</title>');
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
      doc.write(el.outerHTML);
    });
    doc.write(`
      <style>
        @page {
          size: auto;
          margin: 0mm;
        }
        body {
          background-color: white !important;
          color: black !important;
          padding: 40px !important;
        }
        .page-break-inside-avoid {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      </style>
    </head>
    <body class="bg-white text-black">
      <div class="space-y-6">
        ${printContent}
      </div>
    </body>
    </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
      setIsSelectionMode(false);
      setSelectedDays([]);
    }, 500);
  };

  const handleCopySchedule = (dayName) => {
    setError('');
    const periods = timetableData[dayName]?.periods || [];
    if (periods.length === 0) {
      setError('Cannot copy an empty schedule.');
      return;
    }
    setCopiedSchedule({
      classId: selectedClassId,
      dayName: dayName,
      periods: periods
    });
    toast.success('Schedule copied successfully.');
  };

  const handleOpenPasteConfirm = (dayName) => {
    setError('');
    if (!copiedSchedule) {
      setError('No copied schedule found.');
      return;
    }
    if (String(copiedSchedule.classId) !== String(selectedClassId)) {
      setError('This schedule belongs to another class and cannot be pasted here.');
      return;
    }
    setPasteDestinationDay(dayName);
    setIsPasteConfirmOpen(true);
  };

  const handlePasteSchedule = async () => {
    if (!copiedSchedule || !pasteDestinationDay) return;

    setActionLoading('paste');
    setError('');
    setIsPasteConfirmOpen(false);

    try {
      const destDate = timetableData[pasteDestinationDay]?.date;
      if (!destDate) {
        throw new Error('Destination date not found.');
      }

      await schoolAdminService.pasteTimetableSchedule({
        class_id: parseInt(selectedClassId),
        source_day: copiedSchedule.dayName,
        destination_day: pasteDestinationDay,
        destination_date: destDate
      });

      setPasteDestinationDay('');
      await loadTimetable();
      await loadStaff(); // Reload workloads instantly
      toast.success('Schedule pasted successfully.');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to paste schedule.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenSubjectModal = async () => {
    const defaultClass = selectedClassId || (classes.length > 0 ? String(classes[0].id) : '');
    setModalClassId(defaultClass);
    setNewSubject({ id: '', name: '' });
    setSubjectError('');
    if (defaultClass) {
      try {
        const list = await schoolAdminService.getSubjects({ class_id: defaultClass });
        setModalSubjects(list || []);
      } catch (err) {
        console.error(err);
      }
    } else {
      setModalSubjects([]);
    }
    setIsSubjectModalOpen(true);
  };

  const loadModalSubjects = async (classId) => {
    if (!classId) {
      setModalSubjects([]);
      return;
    }
    try {
      const list = await schoolAdminService.getSubjects({ class_id: classId });
      setModalSubjects(list || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Subject Management Dialog Action
  const handleSaveSubject = async () => {
    const trimmedName = newSubject.name.trim();
    if (!trimmedName) {
      setSubjectError('Subject name is required.');
      return;
    }
    
    // Front-end case-insensitive check within current modal class subjects
    const exists = modalSubjects.some(s => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== newSubject.id);
    if (exists) {
      setSubjectError('This subject already exists for this class.');
      return;
    }

    setActionLoading('modal');
    setSubjectError('');
    try {
      if (newSubject.id) {
        await schoolAdminService.updateSubject(newSubject.id, {
          name: trimmedName,
          class_id: parseInt(modalClassId)
        });
      } else {
        await schoolAdminService.createSubject({
          name: trimmedName,
          class_id: parseInt(modalClassId)
        });
      }
      setNewSubject({ id: '', name: '' });
      await loadModalSubjects(modalClassId);
      await loadSubjects();
    } catch (err) {
      console.error(err);
      setSubjectError(err.response?.data?.message || err.message || 'Failed to save subject.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setActionLoading('modal');
    setDeleteError('');
    try {
      await schoolAdminService.deleteSubject(subjectToDelete.id);
      setIsDeleteConfirmOpen(false);
      setSubjectToDelete(null);
      await loadModalSubjects(modalClassId);
      await loadSubjects();
    } catch (err) {
      console.error(err);
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete subject.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePeriodCardClick = (p, dateStr) => {
    setActiveTimetableItem(p);
    setActiveDate(dateStr);
    setIsPeriodActionsOpen(true);
  };

  // Helper: Get formatted timing for a period number from period configs
  const getPeriodTimingStr = (num) => {
    const conf = periodConfigs.find(c => c.period_number === num);
    if (!conf) return '';
    
    // Parse time to AM/PM format
    const formatTime = (timeStr) => {
      const [h, m] = timeStr.split(':');
      const hr = parseInt(h);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const formattedHr = hr % 12 || 12;
      return `${formattedHr}:${m} ${ampm}`;
    };

    return `${formatTime(conf.start_time)} – ${formatTime(conf.end_time)}`;
  };

  // Helper: Get formatted timing for the interval break
  const getIntervalTimingStr = () => {
    if (!timetableSettings || !periodConfigs || periodConfigs.length === 0) return '';
    const afterNum = parseInt(timetableSettings.interval_after_period, 10);
    const duration = parseInt(timetableSettings.interval_duration, 10);
    if (!afterNum || !duration) return '';

    const afterConf = periodConfigs.find(c => c.period_number === afterNum);
    const beforeConf = periodConfigs.find(c => c.period_number === afterNum + 1);

    const formatTime = (timeStr) => {
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

  // Render Date range headers
  const getWeekRangeStr = () => {
    if (!timetableData || !timetableData.Monday || !timetableData.Saturday) return 'Loading range...';
    return `${formatLocalDate(timetableData.Monday.date)} – ${formatLocalDate(timetableData.Saturday.date)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Academic Timetable</h2>
          <p className="text-text-secondary text-sm mt-1">Manage weekly recurring schedules and track workloads.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outline"
            onClick={handleOpenSubjectModal}
            className="font-extrabold flex items-center gap-2 border border-border shadow-2xs hover:bg-zinc-50"
          >
            <Users className="h-4 w-4" /> Manage Subjects
          </Button>

          <Button 
            variant="outline"
            onClick={handleToggleSelectionMode}
            className={`font-extrabold flex items-center gap-2 border border-border shadow-2xs transition-all ${
              isSelectionMode 
                ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800' 
                : 'hover:bg-zinc-50'
            }`}
          >
            <Download className="h-4 w-4" /> {isSelectionMode ? 'Exit Download Mode' : 'Download Schedule'}
          </Button>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Control Panel Filter bar */}
      <Card className="p-4 shadow-2xs border border-border flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-text-secondary uppercase">Class Selection</span>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="h-10 px-3 pr-8 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.section ? ` - ${c.section}` : ''}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-text-secondary uppercase">Weekly Calendar Navigation</span>
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handlePrevWeek} 
                className="h-10 w-10 border border-border hover:bg-zinc-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="relative">
                <input
                  type="date"
                  value={currentDate}
                  onChange={e => setCurrentDate(e.target.value)}
                  className="h-10 px-3 pr-8 rounded-lg border border-border bg-surface text-xs font-bold text-text-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                />
              </div>

              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleNextWeek} 
                className="h-10 w-10 border border-border hover:bg-zinc-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Date range descriptor badge */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black text-text-secondary uppercase">Active Range</span>
          <span className="text-sm font-black text-text-primary font-sans">{getWeekRangeStr()}</span>
        </div>
      </Card>

      {/* Week Locked Banner */}
      {isWeekLocked && (
        <div className="p-4 bg-zinc-100 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
              <Lock className="h-4 w-4 text-zinc-600" />
            </div>
            <div>
              <p className="text-xs font-black text-text-primary font-display">Schedule Locked (Past Week)</p>
              <p className="text-[10px] text-text-muted mt-0.5">{isReadOnly ? 'Timetable operations are read-only in archived years.' : 'Past dates are locked to preserve history. You cannot add, modify, or delete entries.'}</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-zinc-200 text-zinc-600 border border-zinc-300">
            LOCKED
          </span>
        </div>
      )}

      {/* Six working day cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(dayName => {
          const dayData = timetableData[dayName] || { date: '', periods: [] };
          const dateStr = dayData.date;
          const periodsList = dayData.periods || [];
          const isPublished = periodsList.length > 0 && periodsList.every(p => p.is_published === 1);
          const scheduledNums = periodsList.map(p => p.period_number);
          const availableConfig = periodConfigs.find(c => !scheduledNums.includes(c.period_number));
          const nextPeriodNum = availableConfig ? availableConfig.period_number : null;
          const isDayLocked = isReadOnly || isWeekLocked || (dateStr && dateStr < getLocalDateStr());
          const isToday = dateStr === getLocalDateStr();

          return (
            <Card 
              key={dayName} 
              onClick={() => {
                if (isSelectionMode) {
                  handleToggleDaySelection(dayName);
                }
              }}
              className={`flex flex-col justify-between border-2 rounded-3xl p-6 transition-all duration-300 min-h-[460px] bg-zinc-50 dark:bg-zinc-950/40 ${
                isSelectionMode ? 'cursor-pointer select-none' : ''
              } ${
                isToday 
                  ? 'border-blue-500/80 dark:border-blue-600/80 ring-2 ring-blue-500/10 shadow-md shadow-blue-500/5' 
                  : 'border-border'
              } ${
                isSelectionMode && selectedDays.includes(dayName)
                  ? 'ring-2 ring-blue-500 border-blue-500 dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                  : ''
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/80">
                  <div className="flex items-center gap-3">
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleDaySelection(dayName);
                        }}
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                          selectedDays.includes(dayName)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-700 bg-surface text-transparent'
                        }`}
                      >
                        <div className="w-1.5 h-1.5 bg-current rounded-full" />
                      </button>
                    )}
                    <div>
                      <h3 className="text-xl font-black text-blue-500 dark:text-blue-400 tracking-tight font-display">{dayName}</h3>
                      <p className="text-[10px] text-text-muted font-bold mt-0.5">
                        {dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {periodsList.length > 0 && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        isPublished 
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20'
                      }`}>
                        {isPublished ? 'Published' : 'Draft'}
                      </span>
                    )}
                    {!isDayLocked && !isSelectionMode && (
                      <div className="flex-shrink-0">
                        <DropdownMenu>
                          <DropdownItem 
                            disabled={periodsList.length === 0}
                            onClick={() => handleCopySchedule(dayName)}
                          >
                            Copy Schedule
                          </DropdownItem>
                          <DropdownItem 
                            disabled={!copiedSchedule || String(copiedSchedule.classId) !== String(selectedClassId)}
                            onClick={() => handleOpenPasteConfirm(dayName)}
                          >
                            Paste Schedule
                          </DropdownItem>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 pb-1">
                  {periodsList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-text-muted font-semibold">
                      No periods scheduled.
                    </div>
                  ) : (
                    periodsList.map((p) => {
                      const timingStr = getPeriodTimingStr(p.period_number);
                      const teacherText = p.is_backup ? (
                        <span className="text-text-primary font-bold">{p.backup_teacher_name}</span>
                      ) : (
                        <span className="text-text-primary font-bold">{p.teacher_name}</span>
                      );

                      return (
                        <div 
                          key={p.id} 
                          className="flex items-center justify-between py-2 px-3 bg-zinc-100/60 dark:bg-zinc-900/40 border border-border/80 rounded-xl relative transition-all group"
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <h4 className="text-xs font-black text-text-primary truncate">
                              Period {p.period_number}: {p.subject_name}
                              {p.is_backup && (
                                <span className="text-amber-500 font-bold ml-1">(Backup)</span>
                              )}
                            </h4>
                            {timingStr ? (
                              <p className="text-[10px] text-text-secondary font-bold font-sans mt-0.5 truncate">
                                {teacherText} | {timingStr}
                              </p>
                            ) : (
                              <p className="text-[10px] text-text-secondary font-bold mt-0.5 truncate">
                                Taught by: {teacherText}
                              </p>
                            )}
                          </div>
                          
                          {!isDayLocked && (
                            <div className="ml-2 flex-shrink-0">
                              <DropdownMenu>
                                <DropdownItem onClick={() => {
                                  setActiveTimetableItem(p);
                                  setActiveDate(dateStr);
                                  setIsReplaceModalOpen(true);
                                }}>
                                  Replace Teacher
                                </DropdownItem>
                                <DropdownItem onClick={() => {
                                  setActiveTimetableItem(p);
                                  setActiveDate(dateStr);
                                  setIsBackupModalOpen(true);
                                }}>
                                  Assign Backup
                                </DropdownItem>
                                <DropdownItem onClick={() => handleCopySchedule(dayName)}>
                                  Copy Schedule
                                </DropdownItem>
                                <DropdownItem 
                                  disabled={!copiedSchedule || String(copiedSchedule.classId) !== String(selectedClassId)}
                                  onClick={() => handleOpenPasteConfirm(dayName)}
                                >
                                  Paste Schedule
                                </DropdownItem>
                                <DropdownItem destructive onClick={() => setPeriodToDelete({ id: p.id, date: dateStr })}>
                                  Remove
                                </DropdownItem>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {isDayLocked ? (
                <div className="flex items-center justify-center gap-1.5 py-3 mt-4 border-t border-border bg-zinc-500/5 text-zinc-500 text-xs font-bold font-sans rounded-b-2xl">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Schedule locked (Past day)</span>
                </div>
              ) : (
                <div className="mt-4 pt-3 border-t border-border/80 space-y-2.5">
                  {periodsList.length < periodConfigs.length && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={addPeriodForm[dayName].subject_id}
                          onChange={e => {
                            const val = e.target.value;
                            setAddPeriodForm(p => ({
                              ...p,
                              [dayName]: { ...p[dayName], subject_id: val }
                            }));
                            setFormErrors(prev => ({
                              ...prev,
                              [dayName]: ''
                            }));
                          }}
                          className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                        >
                          <option value="">Select Subject</option>
                          {subjects.filter(s => !periodsList.some(p => p.subject_id === s.id)).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>

                        <select
                          value={addPeriodForm[dayName].teacher_id}
                          onChange={e => {
                            const val = e.target.value;
                            setAddPeriodForm(p => ({
                              ...p,
                              [dayName]: { ...p[dayName], teacher_id: val }
                            }));
                            setFormErrors(prev => ({
                              ...prev,
                              [dayName]: ''
                            }));
                          }}
                          className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                        >
                          <option value="">Select Teacher</option>
                          {staff.filter(t => {
                            if (t.status !== 'ACTIVE' || t.role !== 'Teacher') return false;
                            const isOccupiedInPeriod = allTimetableEntries.some(entry => {
                              return entry.day_of_week === dayName &&
                                     entry.period_number === nextPeriodNum &&
                                     entry.active_teacher_id === t.id &&
                                     String(entry.class_id) !== String(selectedClassId);
                            });
                            if (isOccupiedInPeriod) return false;

                            const dailyAssigned = t.day_workloads?.[dayName] ?? 0;
                            const max = periodConfigs.length;
                            return dailyAssigned < max;
                          }).map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {formErrors[dayName] && (
                        <p className="text-[10px] text-red-500 font-bold leading-normal font-sans">
                          {formErrors[dayName]}
                        </p>
                      )}

                      <Button
                        onClick={() => handleAddPeriod(dayName)}
                        disabled={actionLoading === 'add-' + dayName}
                        className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" /> Add Period
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={() => handlePublishDay(dayName, dateStr)}
                    disabled={actionLoading === 'publish-' + dayName || isPublished || periodsList.length === 0}
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg shadow-md transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Publish
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal: Subject Management */}
      <Dialog
        isOpen={isSubjectModalOpen}
        onClose={() => {
          setIsSubjectModalOpen(false);
          setNewSubject({ id: '', name: '' });
          setSubjectError('');
        }}
        title="Subject Management"
        description="Create and delete subjects in the school catalog."
        className="w-[95vw] md:max-w-xl"
        footer={<Button variant="secondary" onClick={() => setIsSubjectModalOpen(false)}>Close</Button>}
      >
        <div className="space-y-6 pt-4">
          {/* Select Class Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Select Class</label>
            <select
              value={modalClassId}
              onChange={e => {
                setModalClassId(e.target.value);
                loadModalSubjects(e.target.value);
              }}
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none shadow-2xs cursor-pointer"
            >
              <option value="">Select Class</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject Add form */}
          <div className="p-4 border border-border bg-zinc-50/50 dark:bg-zinc-950/20 rounded-xl space-y-4">
            <h4 className="text-xs font-black text-text-primary uppercase tracking-wide">
              Add Subject
            </h4>
            {subjectError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
                {subjectError}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase">Subject Name *</label>
                <Input
                  placeholder="e.g. English Literature"
                  value={newSubject.name}
                  onChange={e => {
                    setNewSubject(p => ({ ...p, name: e.target.value }));
                    setSubjectError('');
                  }}
                  className="h-10"
                />
              </div>
              <div className="sm:self-end">
                <Button onClick={handleSaveSubject} disabled={actionLoading} className="h-10 w-full font-bold">
                  {actionLoading ? 'Adding...' : 'Add Subject'}
                </Button>
              </div>
            </div>
          </div>

          {/* Subjects List */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-text-primary uppercase tracking-wide">Active Subjects</h4>
            <div className="flex flex-wrap gap-2 pt-2 max-h-[30vh] overflow-y-auto pr-1">
              {modalSubjects.length === 0 ? (
                <p className="text-center text-text-muted text-xs py-4 w-full">No subjects found.</p>
              ) : (
                modalSubjects.map(s => (
                  <div 
                    key={s.id} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-border rounded-lg text-xs font-bold text-text-primary hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors animate-in zoom-in duration-200"
                  >
                    <span>{s.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubjectToDelete(s);
                        setDeleteError('');
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="text-red-500 hover:text-red-700 transition-colors font-bold ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Dialog>

      {/* Modal: Paste Schedule Confirmation */}
      <Dialog
        isOpen={isPasteConfirmOpen}
        onClose={() => {
          setIsPasteConfirmOpen(false);
          setPasteDestinationDay('');
        }}
        title="Paste Schedule"
        description=""
        className="w-[95vw] md:max-w-md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button 
              variant="secondary" 
              onClick={() => {
                setIsPasteConfirmOpen(false);
                setPasteDestinationDay('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePasteSchedule} 
              disabled={actionLoading === 'paste'}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {actionLoading === 'paste' ? 'Pasting...' : 'Paste Schedule'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          {(timetableData[pasteDestinationDay]?.periods || []).length > 0 ? (
            <p className="text-xs text-text-secondary leading-relaxed">
              This action will replace all existing periods for <strong className="text-text-primary">{pasteDestinationDay}</strong> with the copied schedule from <strong className="text-text-primary">{copiedSchedule?.dayName}</strong>.
            </p>
          ) : (
            <p className="text-xs text-text-secondary leading-relaxed">
              This will replace the existing timetable for <strong className="text-text-primary">{pasteDestinationDay}</strong> with the copied schedule from <strong className="text-text-primary">{copiedSchedule?.dayName}</strong>.
            </p>
          )}
          <p className="text-xs text-text-secondary leading-relaxed">
            Do you want to continue?
          </p>
        </div>
      </Dialog>

      {/* Modal: Subject Delete Confirmation */}
      <Dialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setSubjectToDelete(null);
          setDeleteError('');
        }}
        title="Remove Subject?"
        description=""
        className="w-[95vw] md:max-w-md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button 
              variant="secondary" 
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                setSubjectToDelete(null);
                setDeleteError('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteSubject} 
              disabled={actionLoading === 'modal'}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {actionLoading === 'modal' ? 'Removing...' : 'Remove Subject'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-4">
          {deleteError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold leading-relaxed">
              {deleteError}
            </div>
          )}
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to remove <strong className="text-text-primary">"{subjectToDelete?.name}"</strong>? <br />
            This action cannot be undone and any future timetable assignments using this subject may be affected.
          </p>
        </div>
      </Dialog>

      {/* Modal: Assign Backup Teacher */}
      <Dialog
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        title="Assign Backup Teacher"
        description={`Temporarily assign a backup teacher for Period ${activeTimetableItem?.period_number} on ${formatLocalDate(activeDate)} only.`}
        footer={<>
          <Button variant="secondary" onClick={() => setIsBackupModalOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignBackup} disabled={actionLoading === 'modal'}>Assign Backup</Button>
        </>}
      >
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Select Backup Teacher</label>
            <select
              value={backupTeacherId}
              onChange={e => setBackupTeacherId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none shadow-2xs"
            >
              <option value="">Select Backup Teacher</option>
              {staff.filter(t => {
                if (t.status !== 'ACTIVE' || t.role !== 'Teacher' || t.id === activeTimetableItem?.teacher_id) return false;
                const dayName = activeTimetableItem?.day_of_week;
                const periodNum = activeTimetableItem?.period_number;
                const isOccupiedInPeriod = allTimetableEntries.some(entry => {
                  return entry.day_of_week === dayName &&
                         entry.period_number === periodNum &&
                         entry.active_teacher_id === t.id &&
                         String(entry.class_id) !== String(selectedClassId);
                });
                if (isOccupiedInPeriod) return false;

                const dailyAssigned = t.day_workloads?.[dayName] ?? 0;
                const max = periodConfigs.length;
                return dailyAssigned < max;
              }).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-1">Note: This assignment will automatically expire. The main teacher returns on the next recurring date.</p>
          </div>
        </div>
      </Dialog>

      {/* Modal: Replace Teacher */}
      <Dialog
        isOpen={isReplaceModalOpen}
        onClose={() => setIsReplaceModalOpen(false)}
        title="Replace Teacher Permanently"
        description={`Permanently replace the teacher for Period ${activeTimetableItem?.period_number} on all future recurring ${activeTimetableItem?.day_of_week}s.`}
        footer={<>
          <Button variant="secondary" onClick={() => setIsReplaceModalOpen(false)}>Cancel</Button>
          <Button onClick={handleReplaceTeacher} disabled={actionLoading === 'modal'}>Replace permanently</Button>
        </>}
      >
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Select Replacement Teacher</label>
            <select
              value={replaceTeacherId}
              onChange={e => setReplaceTeacherId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none shadow-2xs"
            >
              <option value="">Select Replacement Teacher</option>
              {staff.filter(t => {
                if (t.status !== 'ACTIVE' || t.role !== 'Teacher' || t.id === activeTimetableItem?.teacher_id) return false;
                const dayName = activeTimetableItem?.day_of_week;
                const periodNum = activeTimetableItem?.period_number;
                const isOccupiedInPeriod = allTimetableEntries.some(entry => {
                  return entry.day_of_week === dayName &&
                         entry.period_number === periodNum &&
                         entry.active_teacher_id === t.id &&
                         String(entry.class_id) !== String(selectedClassId);
                });
                if (isOccupiedInPeriod) return false;

                const dailyAssigned = t.day_workloads?.[dayName] ?? 0;
                const max = periodConfigs.length;
                return dailyAssigned < max;
              }).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-1">Warning: This update applies to all future weeks. History remains locked and unchanged.</p>
          </div>
        </div>
      </Dialog>

      {/* Modal: Confirm Delete Period */}
      <Dialog
        isOpen={!!periodToDelete}
        onClose={() => setPeriodToDelete(null)}
        title="Remove Period Assignment"
        description="Are you sure you want to remove this period assignment?"
        footer={<>
          <Button variant="secondary" onClick={() => setPeriodToDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={async () => {
            if (periodToDelete) {
              await handleDeletePeriod(periodToDelete.id, periodToDelete.date);
              setPeriodToDelete(null);
            }
          }} disabled={actionLoading === 'modal'}>
            Remove Period
          </Button>
        </>}
      >
        <div className="space-y-4 pt-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            This action will permanently delete this period from the master recurring weekly schedule.
          </p>
        </div>
      </Dialog>

      {/* Floating Action Bar in Selection Mode */}
      {isSelectionMode && selectedDays.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-surface border border-border rounded-full px-6 py-3 shadow-xl flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom duration-300">
          <span className="text-xs font-bold text-text-secondary">{selectedDays.length} day(s) selected</span>
          <div className="h-4 w-px bg-border" />
          <Button 
            onClick={handleDownloadPDF}
            className="font-extrabold flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md"
          >
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
          <Button 
            onClick={handlePrintSchedule}
            className="font-bold flex items-center gap-1.5 px-4 h-9 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full shadow-md"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      )}

      {/* Off-screen Printable Template */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div id="timetable-print-area" className="p-8 bg-white text-black font-sans space-y-8" style={{ width: '175mm' }}>
          <div className="border-b-2 border-black pb-4 text-center">
            <h1 className="text-2xl font-black uppercase tracking-wider">Academic Timetable Schedule</h1>
            {selectedClassId && classes.find(c => String(c.id) === String(selectedClassId)) && (
              <p className="text-sm font-bold mt-1">Class: {classes.find(c => String(c.id) === String(selectedClassId)).name}</p>
            )}
          </div>
          {(() => {
            const selectedDaysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              .filter(dayName => selectedDays.includes(dayName));

            if (selectedDaysList.length === 0) return null;

            const getDayComparisonKey = (dayName) => {
              const periods = timetableData[dayName]?.periods || [];
              return periods.map(p => 
                `${p.period_number}-${p.subject_id}-${p.teacher_id}-${p.is_backup || 0}-${p.backup_teacher_id || 0}`
              ).join('|');
            };

            const areIdentical = selectedDaysList.length <= 1 || 
              selectedDaysList.every(day => getDayComparisonKey(day) === getDayComparisonKey(selectedDaysList[0]));

            const renderDayContent = (dayName, showHeading) => {
              const dayData = timetableData[dayName] || { date: '', periods: [] };
              const periodsList = dayData.periods || [];

              return (
                <div key={dayName} className="border border-zinc-300 rounded-lg p-6 space-y-4 page-break-inside-avoid" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  {showHeading && (
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                      <h2 className="text-lg font-bold text-zinc-900">{dayName}</h2>
                    </div>
                  )}

                  {periodsList.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">No periods assigned for this day.</p>
                  ) : (() => {
                    const renderList = [];
                    let breakRendered = false;
                    const afterNum = timetableSettings ? parseInt(timetableSettings.interval_after_period, 10) : 0;
                    const hasInterval = afterNum > 0 && timetableSettings && parseInt(timetableSettings.interval_duration, 10) > 0;

                    periodsList.forEach((p) => {
                      renderList.push({ type: 'period', data: p });
                      if (hasInterval && p.period_number === afterNum) {
                        renderList.push({ type: 'interval' });
                        breakRendered = true;
                      }
                    });

                    if (hasInterval && !breakRendered) {
                      const insertIdx = renderList.findIndex(item => item.type === 'period' && item.data.period_number > afterNum);
                      if (insertIdx !== -1) {
                        renderList.splice(insertIdx, 0, { type: 'interval' });
                      }
                    }

                    return (
                      <div className="space-y-3">
                        {renderList.map((item, idx) => {
                          if (item.type === 'interval') {
                            return (
                              <div key={`interval-${idx}`} className="text-center py-3 border-y border-dashed border-zinc-300 my-3 font-sans" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                <p className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest">INTERVAL BREAK</p>
                                {getIntervalTimingStr() && (
                                  <p className="text-xs font-bold text-zinc-600 mt-1">{getIntervalTimingStr()}</p>
                                )}
                              </div>
                            );
                          }

                          const p = item.data;
                          const timingStr = getPeriodTimingStr(p.period_number);
                          const teacherText = p.is_backup ? (
                            <span>
                              {p.backup_teacher_name} <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded ml-1">Backup</span>
                            </span>
                          ) : (
                            p.teacher_name
                          );

                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs py-2.5 border-b border-zinc-100 last:border-0" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              <div className="space-y-0.5">
                                <p className="font-bold text-zinc-900">Period {p.period_number}: {p.subject_name}</p>
                                <p className="text-zinc-600">Teacher: {teacherText}</p>
                              </div>
                              {timingStr && (
                                <div className="text-right flex flex-col items-end flex-shrink-0 ml-4 w-36">
                                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
                                    Time
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-900 mt-1 font-sans whitespace-nowrap">
                                    {timingStr}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            };

            if (areIdentical) {
              return renderDayContent(selectedDaysList[0], false);
            } else {
              return (
                <div className="space-y-6">
                  {selectedDaysList.map(dayName => renderDayContent(dayName, true))}
                </div>
              );
            }
          })()}
        </div>
      </div>

    </div>
  );
}
