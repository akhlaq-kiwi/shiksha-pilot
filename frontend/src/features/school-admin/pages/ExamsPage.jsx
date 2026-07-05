import React, { useState, useEffect } from 'react';
import { 
  Plus, ArrowLeft, Calendar, Clock, BookOpen, UserCheck, 
  Settings, Award, Printer, Trash, FileText, CheckCircle, 
  XCircle, Save, AlertCircle, Edit3, Trash2, LayoutDashboard, ChevronRight, Download, X
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';
import html2pdf from 'html2pdf.js';

const formatDateString = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1]) - 1;
    const day = String(parseInt(parts[2])).padStart(2, '0');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${months[monthIndex]} ${year}`;
    }
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const formatTimeString = (timeStr) => {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0]);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

const getDynamicScalingStyles = (numSubjects, numInstructions) => {
  let tableFontSize = 'text-xs';
  let tablePadding = 'p-2.5';
  let headerPadding = 'pb-4';
  let instructionsFontSize = 'text-xs';
  let instructionsSpacing = 'space-y-1';
  let instructionsMargin = 'mt-6 pt-6';
  let tableMargin = 'py-4';

  if (numSubjects <= 5) {
    tableFontSize = 'text-sm';
    tablePadding = 'p-4';
    headerPadding = 'pb-6';
    tableMargin = 'py-6';
    instructionsFontSize = 'text-sm';
    instructionsSpacing = 'space-y-2';
    instructionsMargin = 'mt-8 pt-8';
  } else if (numSubjects >= 6 && numSubjects <= 9) {
    tableFontSize = 'text-xs';
    tablePadding = 'p-2.5';
    headerPadding = 'pb-4';
    tableMargin = 'py-4';
    instructionsFontSize = 'text-xs';
    instructionsSpacing = 'space-y-1';
    instructionsMargin = 'mt-6 pt-6';
  } else if (numSubjects >= 10 && numSubjects <= 13) {
    tableFontSize = 'text-[10px]';
    tablePadding = 'p-1.5';
    headerPadding = 'pb-2';
    tableMargin = 'py-2';
    instructionsFontSize = 'text-[10px]';
    instructionsSpacing = 'space-y-0.5';
    instructionsMargin = 'mt-3 pt-3';
  } else {
    // 14 or more subjects (instructions are hidden)
    tableFontSize = 'text-[9px]';
    tablePadding = 'p-1';
    headerPadding = 'pb-2';
    tableMargin = 'py-2';
  }

  return {
    tableFontSize,
    tablePadding,
    headerPadding,
    tableMargin,
    instructionsFontSize,
    instructionsSpacing,
    instructionsMargin
  };
};

const getReportCardScalingStyles = (numSubjects) => {
  let tableFontSize = 'text-xs';
  let tablePadding = 'p-2';
  
  let headerLogoHeight = 'h-16 w-16';
  let headerTitleSize = 'text-2xl';
  let headerSubtitleSize = 'text-[10px]';
  let headerPadding = 'pb-5';
  
  let metadataPadding = 'py-6';
  let metadataGapY = 'gap-y-3';
  
  let tableMargin = 'py-6';
  
  let summaryPadding = 'p-4';
  let summaryGap = 'gap-6';
  let summarySpaceY = 'space-y-2';
  
  let verdictPadding = 'py-6';
  let verdictBoxPadding = 'p-4';
  let verdictMinHeight = 'min-h-[60px]';
  
  let signaturePadding = 'pt-8';
  let signatureSpacer = 'h-8';

  if (numSubjects <= 5) {
    tableFontSize = 'text-sm';
    tablePadding = 'p-3.5';
    
    headerLogoHeight = 'h-16 w-16';
    headerTitleSize = 'text-2xl';
    headerSubtitleSize = 'text-xs';
    headerPadding = 'pb-6';
    
    metadataPadding = 'py-8';
    metadataGapY = 'gap-y-4';
    
    tableMargin = 'py-8';
    
    summaryPadding = 'p-5';
    summaryGap = 'gap-8';
    summarySpaceY = 'space-y-3';
    
    verdictPadding = 'py-8';
    verdictBoxPadding = 'p-5';
    verdictMinHeight = 'min-h-[75px]';
    
    signaturePadding = 'pt-10';
    signatureSpacer = 'h-10';
  } else if (numSubjects >= 6 && numSubjects <= 9) {
    tableFontSize = 'text-xs';
    tablePadding = 'p-2';
    
    headerLogoHeight = 'h-14 w-14';
    headerTitleSize = 'text-xl';
    headerSubtitleSize = 'text-[10px]';
    headerPadding = 'pb-4';
    
    metadataPadding = 'py-4';
    metadataGapY = 'gap-y-2';
    
    tableMargin = 'py-4';
    
    summaryPadding = 'p-3.5';
    summaryGap = 'gap-6';
    summarySpaceY = 'space-y-1.5';
    
    verdictPadding = 'py-4';
    verdictBoxPadding = 'p-3.5';
    verdictMinHeight = 'min-h-[50px]';
    
    signaturePadding = 'pt-6';
    signatureSpacer = 'h-8';
  } else if (numSubjects >= 10 && numSubjects <= 12) {
    tableFontSize = 'text-[11px]';
    tablePadding = 'p-1.5';
    
    headerLogoHeight = 'h-12 w-12';
    headerTitleSize = 'text-lg';
    headerSubtitleSize = 'text-[9px]';
    headerPadding = 'pb-2';
    
    metadataPadding = 'py-2';
    metadataGapY = 'gap-y-1.5';
    
    tableMargin = 'py-2';
    
    summaryPadding = 'p-2.5';
    summaryGap = 'gap-4';
    summarySpaceY = 'space-y-1';
    
    verdictPadding = 'py-2';
    verdictBoxPadding = 'p-2.5';
    verdictMinHeight = 'min-h-[40px]';
    
    signaturePadding = 'pt-4';
    signatureSpacer = 'h-6';
  } else {
    tableFontSize = 'text-[10px]';
    tablePadding = 'p-1';
    
    headerLogoHeight = 'h-10 w-10';
    headerTitleSize = 'text-base';
    headerSubtitleSize = 'text-[8px]';
    headerPadding = 'pb-1';
    
    metadataPadding = 'py-1.5';
    metadataGapY = 'gap-y-1';
    
    tableMargin = 'py-1.5';
    
    summaryPadding = 'p-2';
    summaryGap = 'gap-3';
    summarySpaceY = 'space-y-0.5';
    
    verdictPadding = 'py-1.5';
    verdictBoxPadding = 'p-2';
    verdictMinHeight = 'min-h-[30px]';
    
    signaturePadding = 'pt-3';
    signatureSpacer = 'h-4';
  }

  return {
    tableFontSize,
    tablePadding,
    headerLogoHeight,
    headerTitleSize,
    headerSubtitleSize,
    headerPadding,
    metadataPadding,
    metadataGapY,
    tableMargin,
    summaryPadding,
    summaryGap,
    summarySpaceY,
    verdictPadding,
    verdictBoxPadding,
    verdictMinHeight,
    signaturePadding,
    signatureSpacer,
  };
};

const suggestNextExamDate = (exam, papers, holidays) => {
  if (!exam) return '';
  const todayStr = new Date().toISOString().split('T')[0];
  let baseDateStr = exam.start_date > todayStr ? exam.start_date : todayStr;
  const parts = baseDateStr.split('-');
  if (parts.length !== 3) return baseDateStr;
  
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const d = parseInt(parts[2]);
  let current = new Date(y, m, d);

  const endParts = exam.end_date.split('-');
  const endYear = parseInt(endParts[0]);
  const endMonth = parseInt(endParts[1]) - 1;
  const endDay = parseInt(endParts[2]);
  const endDate = new Date(endYear, endMonth, endDay);

  const holidaysSet = new Set((holidays || []).map(h => h.date));
  const usedDates = new Set((papers || []).map(p => p.exam_date));

  while (current <= endDate) {
    const yStr = current.getFullYear();
    const mStr = String(current.getMonth() + 1).padStart(2, '0');
    const dStr = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    const isSunday = current.getDay() === 0;
    const isHoliday = holidaysSet.has(dateStr);
    const isUsed = usedDates.has(dateStr);

    if (!isSunday && !isHoliday && !isUsed) {
      return dateStr;
    }
    current.setDate(current.getDate() + 1);
  }
  return baseDateStr;
};

const CalendarDatePicker = ({ value, onChange, min, max, required, className, onError, holidays }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(dateStr);
  };

  const initialDateStr = value || min || todayStr;
  const [currentMonth, setCurrentMonth] = useState(parseLocalDate(initialDateStr));
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (isOpen || isFocused) {
      setInputValue(value || '');
    } else {
      setInputValue(value ? formatDateString(value) : '');
    }
  }, [value, isOpen, isFocused]);

  useEffect(() => {
    if (value) {
      setCurrentMonth(parseLocalDate(value));
    }
  }, [value]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const parseTypedDate = (str) => {
    if (!str) return null;
    const trimmed = str.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const match = trimmed.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
    if (match) {
      const day = String(parseInt(match[1])).padStart(2, '0');
      const monthName = match[2].toLowerCase();
      const year = match[3];
      const mIdx = months.indexOf(monthName);
      if (mIdx !== -1) {
        const month = String(mIdx + 1).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    
    const parsed = parseTypedDate(val);
    if (parsed) {
      const dObj = parseLocalDate(parsed);
      if (dObj.getDay() === 0) {
        if (onError) onError('Examinations cannot be scheduled on Sundays.');
        onChange({ target: { value: '' } });
        setInputValue('');
        return;
      }
      if ((holidays || []).some(h => h.date === parsed)) {
        if (onError) onError('Examinations cannot be scheduled on holidays.');
        onChange({ target: { value: '' } });
        setInputValue('');
        return;
      }
      if (parsed < todayStr) {
        if (onError) onError('Exam date cannot be in the past.');
        onChange({ target: { value: '' } });
        setInputValue('');
        return;
      }
      if (min && parsed < min) {
        if (onError) onError(`Exam date cannot be before ${formatDateString(min)}.`);
        onChange({ target: { value: '' } });
        setInputValue('');
        return;
      }
      if (max && parsed > max) {
        if (onError) onError(`Exam date cannot be after ${formatDateString(max)}.`);
        onChange({ target: { value: '' } });
        setInputValue('');
        return;
      }
      onChange({ target: { value: parsed } });
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    if (!inputValue) {
      onChange({ target: { value: '' } });
      return;
    }
    
    const parsed = parseTypedDate(inputValue);
    if (!parsed) {
      setInputValue(value ? formatDateString(value) : '');
      return;
    }

    const dObj = parseLocalDate(parsed);
    if (dObj.getDay() === 0) {
      if (onError) onError('Examinations cannot be scheduled on Sundays.');
      setInputValue(value ? formatDateString(value) : '');
      onChange({ target: { value: '' } });
      return;
    }
    if ((holidays || []).some(h => h.date === parsed)) {
      if (onError) onError('Examinations cannot be scheduled on holidays.');
      setInputValue(value ? formatDateString(value) : '');
      onChange({ target: { value: '' } });
      return;
    }
    if (parsed < todayStr) {
      if (onError) onError('Exam date cannot be in the past.');
      setInputValue(value ? formatDateString(value) : '');
      onChange({ target: { value: '' } });
      return;
    }
    if (min && parsed < min) {
      if (onError) onError(`Exam date cannot be before ${formatDateString(min)}.`);
      setInputValue(value ? formatDateString(value) : '');
      onChange({ target: { value: '' } });
      return;
    }
    if (max && parsed > max) {
      if (onError) onError(`Exam date cannot be after ${formatDateString(max)}.`);
      setInputValue(value ? formatDateString(value) : '');
      onChange({ target: { value: '' } });
      return;
    }

    onChange({ target: { value: parsed } });
  };

  const selectDate = (dateStr) => {
    onChange({ target: { value: dateStr } });
    setIsOpen(false);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  const daysArray = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    daysArray.push(new Date(year, month, d));
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="relative w-full font-sans" ref={containerRef}>
      <div className="relative flex items-center">
        <Input
          placeholder="e.g. 10 July 2026"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          required={required}
          className={`pr-10 ${className || ''}`}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
          className="absolute right-3 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
      {isOpen && (
        <div className="absolute left-0 mt-1 z-50 w-64 bg-white dark:bg-zinc-950 border border-border rounded-lg shadow-lg p-3 select-none no-print">
          <div className="flex justify-between items-center mb-2">
            <button type="button" onClick={prevMonth} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded font-bold text-xs text-text-primary">
              &lt;
            </button>
            <span className="text-xs font-bold text-text-primary">
              {monthNames[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded font-bold text-xs text-text-primary">
              &gt;
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-text-muted mb-1">
            <span className="text-red-500">Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {daysArray.map((dayDate, idx) => {
              if (!dayDate) {
                return <span key={`empty-${idx}`} />;
              }
              
              const dayNum = dayDate.getDate();
              const yStr = dayDate.getFullYear();
              const mStr = String(dayDate.getMonth() + 1).padStart(2, '0');
              const dStr = String(dayDate.getDate()).padStart(2, '0');
              const dateStr = `${yStr}-${mStr}-${dStr}`;
              const dayOfWeek = dayDate.getDay();
              
              const isPast = dateStr < todayStr;
              const isSunday = dayOfWeek === 0;
              const isHoliday = (holidays || []).some(h => h.date === dateStr);
              const outOfMin = min && dateStr < min;
              const outOfMax = max && dateStr > max;
              const isDisabled = isPast || isSunday || isHoliday || outOfMin || outOfMax;
              const isSelected = value === dateStr;
              
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => selectDate(dateStr)}
                  className={`h-7 w-7 rounded-md flex items-center justify-center font-semibold transition-all ${
                    isDisabled 
                      ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed bg-transparent'
                      : isSelected
                      ? 'bg-primary text-white font-bold'
                      : 'hover:bg-primary/10 text-text-primary cursor-pointer'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ExamsPage() {
  const { isReadOnly } = useAcademicYear();
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'classes', 'timetable', 'marks', 'reports'
  
  // Data States
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Contexts
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [examClassStatuses, setExamClassStatuses] = useState([]);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState(null); // { exam, classId }
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false);
  const [unpublishTarget, setUnpublishTarget] = useState(null); // { exam, classId }
  const [isDeletePaperConfirmOpen, setIsDeletePaperConfirmOpen] = useState(false);
  const [deletePaperTarget, setDeletePaperTarget] = useState(null);
  const [editingPaper, setEditingPaper] = useState(null);

  // Instructions States
  const [instructions, setInstructions] = useState([]);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [editingInstructionIndex, setEditingInstructionIndex] = useState(null);
  
  // Dashboard Filtering & Editing States
  const [activeFilter, setActiveFilter] = useState('total');
  const [isDeleteExamConfirmOpen, setIsDeleteExamConfirmOpen] = useState(false);
  const [deleteExamTarget, setDeleteExamTarget] = useState(null);
  const [isEditExamOpen, setIsEditExamOpen] = useState(false);
  const [editExamData, setEditExamData] = useState({
    id: '',
    name: '',
    start_date: '',
    end_date: '',
    publish_date: '',
    description: ''
  });

  // Form / Action States
  const [newExam, setNewExam] = useState({
    name: '',
    start_date: '',
    end_date: '',
    publish_date: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Local Timetable State
  const [timetablePapers, setTimetablePapers] = useState([]);
  const [newPaper, setNewPaper] = useState({
    subject_id: '',
    paper_type: 'Written',
    exam_date: '',
    start_time: '',
    end_time: '',
    max_marks: '100',
    passing_marks: '40',
    room: ''
  });

  // Local Marks Spreadsheet State
  const [marksSheet, setMarksSheet] = useState(null);
  const [savingMarkStudentId, setSavingMarkStudentId] = useState(null);

  // Local Report Cards State
  const [reportCards, setReportCards] = useState([]);
  const [selectedReportCard, setSelectedReportCard] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [isSchemeOpen, setIsSchemeOpen] = useState(false);
  const [pendingSubjects, setPendingSubjects] = useState([]);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [pendingValidationSource, setPendingValidationSource] = useState(''); // 'reports' or 'publish'

  // Load Initial Dashboard Data
  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [examsList, classesList, subjectsList, holidaysList, profile] = await Promise.all([
        schoolService.getExaminations(),
        schoolService.getClasses(),
        schoolService.getSubjects(),
        schoolService.getHolidays().catch(() => []),
        schoolService.getSchoolProfile().catch(() => null)
      ]);
      setExams(examsList || []);
      setClasses(classesList || []);
      setSubjects(subjectsList || []);
      setHolidays(holidaysList || []);
      if (profile) setSchoolProfile(profile);
    } catch (err) {
      console.error(err);
      setError('Failed to load examinations dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    loadDashboard();
    const handleYearSwitch = () => {
      loadDashboard();
      setActiveView('dashboard');
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  // Quick Action counts
  const totalCount = exams.length;
  const upcomingCount = exams.filter(e => {
    const today = new Date().toISOString().split('T')[0];
    return e.start_date > today;
  }).length;
  const ongoingCount = exams.filter(e => {
    const today = new Date().toISOString().split('T')[0];
    return e.start_date <= today && e.end_date >= today;
  }).length;
  const publishedCount = exams.filter(e => e.status === 'Published').length;
  const draftCount = exams.filter(e => e.status === 'Draft').length;

  // Level 2 Class Workspace Loader
  const handleOpenClassWorkspace = async (exam) => {
    setSelectedExam(exam);
    setSelectedClassId('');
    setError('');
    setSuccess('');
    setPendingSubjects([]);
    setShowPendingAlert(false);
    setPendingValidationSource('');
    setLoading(true);
    try {
      const statuses = await schoolService.getExamClassStatuses(exam.id);
      setExamClassStatuses(statuses || []);
      if (statuses && statuses.length > 0) {
        setSelectedClassId(statuses[0].id.toString());
      }
      setActiveView('classes');
    } catch (err) {
      console.error(err);
      setError('Failed to load classes for this examination.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishExamOverall = (exam) => {
    setPublishTarget({ exam, classId: 0 });
    setIsPublishConfirmOpen(true);
  };

  // Form Handlers
  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!newExam.name || !newExam.start_date || !newExam.end_date || !newExam.publish_date) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await schoolService.createExamination(newExam);
      setIsCreateOpen(false);
      setNewExam({ name: '', start_date: '', end_date: '', publish_date: '', description: '' });
      setSuccess('Examination created successfully.');
      loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create examination.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditExamClick = (exam) => {
    setEditExamData({
      id: exam.id,
      name: exam.name,
      start_date: exam.start_date,
      end_date: exam.end_date,
      publish_date: exam.publish_date,
      description: exam.description || ''
    });
    setIsEditExamOpen(true);
  };

  const handleUpdateExam = async (e) => {
    if (e) e.preventDefault();
    if (!editExamData.name || !editExamData.start_date || !editExamData.end_date || !editExamData.publish_date) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    setIsEditExamOpen(false);
    try {
      await schoolService.updateExamination(editExamData.id, editExamData);
      setSuccess('Examination updated successfully.');
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update examination.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExamPublishStatus = async (exam) => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const nextStatus = exam.status === 'Draft' ? 'Published' : 'Draft';
      await schoolService.updateExamination(exam.id, {
        ...exam,
        status: nextStatus
      });
      setSuccess(nextStatus === 'Published' ? 'Examination published successfully.' : 'Examination moved to Draft successfully.');
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update examination status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExamClick = (exam) => {
    setDeleteExamTarget(exam);
    setIsDeleteExamConfirmOpen(true);
  };

  const handleConfirmDeleteExam = async () => {
    if (!deleteExamTarget) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    setIsDeleteExamConfirmOpen(false);
    try {
      await schoolService.deleteExamination(deleteExamTarget.id);
      setSuccess('Examination deleted successfully.');
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete examination.');
    } finally {
      setSubmitting(false);
      setDeleteExamTarget(null);
    }
  };

  // Timetable Handlers
  const handleOpenTimetable = async (exam, classId) => {
    setSelectedExam(exam);
    setSelectedClassId(classId.toString());
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      setEditingPaper(null);
      const [list, insts] = await Promise.all([
        schoolService.getExamTimetable(exam.id, classId),
        schoolService.getExamInstructions(exam.id, classId).catch(() => [])
      ]);
      setTimetablePapers(list || []);
      setInstructions((insts || []).map(i => i.instruction) || []);
      setNewPaper({
        subject_id: '',
        paper_type: 'Written',
        exam_date: suggestNextExamDate(exam, list || [], holidays),
        start_time: '',
        end_time: '',
        max_marks: '100',
        passing_marks: '40',
        room: ''
      });
      setActiveView('timetable');
    } catch (err) {
      console.error(err);
      setError('Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaperLocal = async (e) => {
    e.preventDefault();
    if (!newPaper.subject_id || !newPaper.exam_date || !newPaper.start_time || !newPaper.end_time || !newPaper.max_marks || !newPaper.passing_marks) {
      setError('Please fill in all timetable fields.');
      return;
    }

    const t_start = newPaper.start_time.slice(0, 5);
    const t_end = newPaper.end_time.slice(0, 5);
    if (t_end <= t_start) {
      setError('End Time must be after Start Time.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (newPaper.exam_date < todayStr) {
      setError('Exam date cannot be in the past.');
      return;
    }

    if (selectedExam) {
      if (newPaper.exam_date < selectedExam.start_date) {
        setError(`Exam date cannot be before ${formatDateString(selectedExam.start_date)}.`);
        return;
      }
      if (newPaper.exam_date > selectedExam.end_date) {
        setError(`Exam date cannot be after ${formatDateString(selectedExam.end_date)}.`);
        return;
      }
    }

    const parts = newPaper.exam_date.split('-');
    if (parts.length === 3) {
      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (dObj.getDay() === 0) {
        setError('Examinations cannot be scheduled on Sundays.');
        return;
      }
    }

    const isHoliday = holidays.some(h => h.date === newPaper.exam_date);
    if (isHoliday) {
      setError('Examinations cannot be scheduled on holidays.');
      return;
    }

    const maxMarksParsed = parseFloat(newPaper.max_marks);
    const passingMarksParsed = parseFloat(newPaper.passing_marks);
    if (isNaN(maxMarksParsed) || maxMarksParsed <= 0) {
      setError('Maximum Marks must be a positive number.');
      return;
    }
    if (isNaN(passingMarksParsed) || passingMarksParsed < 0) {
      setError('Passing Marks must be a non-negative number.');
      return;
    }
    if (passingMarksParsed > maxMarksParsed) {
      setError('Passing Marks cannot exceed Maximum Marks.');
      return;
    }

    // Overlap checks locally using pure string comparison
    const overlaps = timetablePapers.some(p => {
      if (editingPaper && parseInt(p.subject_id) === parseInt(editingPaper.subject_id)) {
        return false;
      }
      if (p.exam_date === newPaper.exam_date) {
        const p1_start = p.start_time.slice(0, 5);
        const p1_end = p.end_time.slice(0, 5);
        return (t_start < p1_end) && (t_end > p1_start);
      }
      return false;
    });

    if (overlaps) {
      setError('Time conflict detected. Another paper is scheduled at this time.');
      return;
    }

    let updatedPapers = [];
    if (editingPaper) {
      updatedPapers = timetablePapers.map(p => {
        if (parseInt(p.subject_id) === parseInt(editingPaper.subject_id)) {
          const matchedSubject = subjects.find(s => s.id === parseInt(newPaper.subject_id));
          return {
            ...p,
            ...newPaper,
            max_marks: maxMarksParsed,
            passing_marks: passingMarksParsed,
            subject_name: matchedSubject ? matchedSubject.name : 'Unknown Subject'
          };
        }
        return p;
      });
    } else {
      const matchedSubject = subjects.find(s => s.id === parseInt(newPaper.subject_id));
      const paperObj = {
        ...newPaper,
        max_marks: maxMarksParsed,
        passing_marks: passingMarksParsed,
        subject_name: matchedSubject ? matchedSubject.name : 'Unknown Subject'
      };
      updatedPapers = [...timetablePapers, paperObj];
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await schoolService.saveExamTimetable(selectedExam.id, parseInt(selectedClassId), { papers: updatedPapers });
      
      // Reload updated list
      const refreshedList = await schoolService.getExamTimetable(selectedExam.id, parseInt(selectedClassId));
      setTimetablePapers(refreshedList || []);
      
      // Clear state
      setEditingPaper(null);
      setNewPaper({
        subject_id: '',
        paper_type: 'Written',
        exam_date: suggestNextExamDate(selectedExam, refreshedList || [], holidays),
        start_time: newPaper.start_time,
        end_time: newPaper.end_time,
        max_marks: '100',
        passing_marks: '40',
        room: ''
      });
      setSuccess(editingPaper ? 'Exam paper updated successfully.' : 'Exam paper saved successfully.');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save timetable changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenInstructionsPopup = () => {
    setNewInstruction('');
    setEditingInstructionIndex(null);
    setIsInstructionsOpen(true);
  };

  const handleAddOrUpdateInstruction = async (e) => {
    if (e) e.preventDefault();
    if (!newInstruction.trim()) return;

    // Word count validation: max 25 words
    const words = newInstruction.trim().split(/\s+/).filter(Boolean);
    if (words.length > 25) {
      setError('Each instruction can contain a maximum of 25 words.');
      setTimeout(() => setError(''), 4000);
      return;
    }

    let updated = [...instructions];
    if (editingInstructionIndex !== null) {
      updated[editingInstructionIndex] = newInstruction.trim();
    } else {
      if (instructions.length >= 3) {
        setError('You can add a maximum of 3 instructions.');
        setTimeout(() => setError(''), 4000);
        return;
      }
      updated.push(newInstruction.trim());
    }

    setSubmitting(true);
    try {
      await schoolService.saveExamInstructions(selectedExam.id, parseInt(selectedClassId), { instructions: updated });
      setInstructions(updated);
      setNewInstruction('');
      setEditingInstructionIndex(null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save instructions.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInstruction = async (index) => {
    const updated = instructions.filter((_, i) => i !== index);
    setSubmitting(true);
    try {
      await schoolService.saveExamInstructions(selectedExam.id, parseInt(selectedClassId), { instructions: updated });
      setInstructions(updated);
      if (editingInstructionIndex === index) {
        setNewInstruction('');
        setEditingInstructionIndex(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete instruction.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSchemeClick = () => {
    setIsSchemeOpen(true);
  };

  const triggerDownloadPdf = (e) => {
    if (e) e.preventDefault();
    const element = document.getElementById('printable-scheme');
    if (!element) return;

    setSubmitting(true);
    const classNameStr = classes.find(c => c.id === parseInt(selectedClassId))?.name || 'Scheme';
    schoolAdminService.logClientAudit({
      module: 'Examinations',
      action: 'Scheme Downloaded',
      description: `Exam scheme downloaded as PDF for ${selectedExam?.name} (${classNameStr})`
    }).catch(console.error);

    const opt = {
      margin: 10,
      filename: `${selectedExam.name}_Class_${classNameStr}_Exam_Scheme`.replace(/\s+/g, '_') + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'avoid-all'] }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setSubmitting(false);
    }).catch(err => {
      console.error(err);
      setSubmitting(false);
    });
  };

  const triggerPrintScheme = (e) => {
    if (e) e.preventDefault();
    const printElement = document.getElementById('printable-scheme');
    if (!printElement) return;

    const classNameStr = classes.find(c => c.id === parseInt(selectedClassId))?.name || 'Scheme';
    schoolAdminService.logClientAudit({
      module: 'Examinations',
      action: 'Scheme Printed',
      description: `Exam scheme printed for ${selectedExam?.name} (${classNameStr})`
    }).catch(console.error);

    // Create an isolated iframe for clean printing
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
    doc.write('<html><head><title>Print Examination Scheme</title>');
    
    // Copy stylesheets
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
      doc.write(el.outerHTML);
    });

    const documentTitle = `${selectedExam.name}_Class_${classNameStr}_Exam_Scheme`.replace(/\s+/g, '_');

    doc.write(`
      <style>
        @page {
          size: landscape !important;
          margin: 8mm !important;
        }
        body {
          background-color: white !important;
          color: black !important;
          padding: 0 !important;
          margin: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #printable-scheme {
          width: 268mm !important;
          max-width: 268mm !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
          box-shadow: none !important;
        }
      </style>
    </head>
    <body class="bg-white text-black">
      <div id="printable-scheme-container" style="width: 100%;">
        ${printElement.outerHTML}
      </div>
    </body>
    </html>
    `);
    doc.close();

    // Trigger printing from the iframe context
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.document.title = documentTitle;
      iframe.contentWindow.print();
      // Clean up the iframe after printing
      document.body.removeChild(iframe);
    }, 500);
  };

  const handleDeletePaperClick = (paper) => {
    setDeletePaperTarget(paper);
    setIsDeletePaperConfirmOpen(true);
  };

  const handleConfirmDeletePaper = async () => {
    if (!deletePaperTarget) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    setIsDeletePaperConfirmOpen(false);
    try {
      const updatedPapers = timetablePapers.filter(p => parseInt(p.subject_id) !== parseInt(deletePaperTarget.subject_id));
      await schoolService.saveExamTimetable(selectedExam.id, parseInt(selectedClassId), { papers: updatedPapers });
      
      // Reload updated list
      const refreshedList = await schoolService.getExamTimetable(selectedExam.id, parseInt(selectedClassId));
      setTimetablePapers(refreshedList || []);
      setSuccess('Exam paper deleted successfully.');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete exam paper.');
    } finally {
      setSubmitting(false);
      setDeletePaperTarget(null);
    }
  };

  const handleSaveTimetable = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await schoolService.saveExamTimetable(selectedExam.id, parseInt(selectedClassId), { papers: timetablePapers });
      setSuccess('Timetable saved successfully.');
      await handleOpenClassWorkspace(selectedExam);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save timetable.');
    } finally {
      setSubmitting(false);
    }
  };

  // Marks Entry Handlers
  const handleOpenMarksEntry = async (exam, classId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const papers = await schoolService.getExamTimetable(exam.id, classId);
      
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('marks_entry_empty_timetable');
        setShowPendingAlert(true);
        setLoading(false);
        return;
      }

      setTimetablePapers(papers || []);
      setSelectedExam(exam);
      setSelectedClassId(classId.toString());
      setPendingSubjects([]);
      setShowPendingAlert(false);
      setPendingValidationSource('');

      setSelectedSubjectId(papers[0].subject_id.toString());
      await loadMarksSheet(exam.id, classId, papers[0].subject_id);
      setActiveView('marks');
    } catch (err) {
      console.error(err);
      setError('Failed to load marks entry context.');
    } finally {
      setLoading(false);
    }
  };

  const loadMarksSheet = async (examId, classId, subjectId) => {
    setError('');
    try {
      const sheet = await schoolService.getExamMarksSheet(examId, classId, subjectId);
      setMarksSheet(sheet);
    } catch (err) {
      console.error(err);
      setError('Failed to load student marks sheet.');
    }
  };

  const handleSubjectChange = async (e) => {
    const subId = e.target.value;
    setSelectedSubjectId(subId);
    if (subId) {
      setLoading(true);
      await loadMarksSheet(selectedExam.id, parseInt(selectedClassId), parseInt(subId));
      setLoading(false);
    } else {
      setMarksSheet(null);
    }
  };

  const handleMarkCellChange = async (studentId, field, value) => {
    if (!marksSheet) return;

    let isInvalid = false;
    // Update locally immediately
    const updatedStudents = marksSheet.students.map(s => {
      if (s.student_id === studentId) {
        let val = value;
        if (field === 'is_absent') {
          val = value ? 1 : 0;
          if (val === 1) {
            return { ...s, is_absent: 1, marks_obtained: '' };
          }
        }
        if (field === 'marks_obtained') {
          if (value === '') {
            val = '';
          } else {
            const sanitized = value.replace(/\D/g, '');
            if (sanitized === '') {
              isInvalid = true;
              return s;
            }
            const parsed = parseInt(sanitized, 10);
            if (parsed > marksSheet.max_marks) {
              isInvalid = true;
              return s;
            }
            val = parsed.toString();
          }
        }
        if (s[field] === val) {
          isInvalid = true;
        }
        return { ...s, [field]: val };
      }
      return s;
    });

    if (isInvalid) return;

    setMarksSheet({ ...marksSheet, students: updatedStudents });
    setSavingMarkStudentId(studentId);

    // Calculate if the current subject marks are complete locally
    const isCurrentSubjectComplete = updatedStudents.every(s => 
      (s.marks_obtained !== null && s.marks_obtained !== undefined && s.marks_obtained !== '') || 
      s.is_absent === 1
    );

    // Update the local timetable papers status instantly!
    const updatedPapers = timetablePapers.map(p => {
      if (parseInt(p.subject_id) === parseInt(selectedSubjectId)) {
        return { ...p, marks_completed: isCurrentSubjectComplete };
      }
      return p;
    });
    setTimetablePapers(updatedPapers);

    // Prepare payload
    const studentRow = updatedStudents.find(s => s.student_id === studentId);
    
    // Auto-save call
    try {
      await schoolService.saveExamMark(selectedExam.id, {
        subject_id: parseInt(selectedSubjectId),
        student_id: studentId,
        marks_obtained: studentRow.is_absent ? '' : studentRow.marks_obtained,
        is_absent: studentRow.is_absent,
        remarks: studentRow.remarks
      });
      const refreshedList = await schoolService.getExamTimetable(selectedExam.id, parseInt(selectedClassId));
      setTimetablePapers(refreshedList || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Auto-save failed.');
    } finally {
      setSavingMarkStudentId(null);
    }
  };

  // Report Cards Handlers
  const handleOpenReportCards = async (exam, classId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const papers = await schoolService.getExamTimetable(exam.id, classId);
      
      // Step 1: Check papers exists
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('reports_empty_timetable');
        setShowPendingAlert(true);
        setLoading(false);
        return;
      }

      // Step 2: Check pending marks
      const pending = papers.filter(p => !p.marks_completed);
      if (pending.length > 0) {
        setPendingSubjects(pending.map(p => p.subject_name));
        setPendingValidationSource('reports_pending_marks');
        setShowPendingAlert(true);
        setLoading(false);
        return;
      }

      setSelectedExam(exam);
      setSelectedClassId(classId.toString());
      setPendingSubjects([]);
      setShowPendingAlert(false);
      setPendingValidationSource('');

      const reports = await schoolService.getReportCards(exam.id, classId);
      setReportCards(reports || []);
      setActiveView('reports');
    } catch (err) {
      console.error(err);
      setError('Failed to load report cards.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSingleReportCard = (card) => {
    setSelectedReportCard(card);
    setIsReportCardOpen(true);
  };

  const handlePublishClassResults = async (exam, classId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const papers = await schoolService.getExamTimetable(exam.id, classId);
      
      // Step 1: Check papers exists
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('publish_empty_timetable');
        setShowPendingAlert(true);
        setLoading(false);
        return;
      }

      // Step 2: Check pending marks
      const pending = papers.filter(p => !p.marks_completed);
      if (pending.length > 0) {
        setPendingSubjects(pending.map(p => p.subject_name));
        setPendingValidationSource('publish_pending_marks');
        setShowPendingAlert(true);
        setLoading(false);
        return;
      }

      setPendingSubjects([]);
      setShowPendingAlert(false);
      setPendingValidationSource('');
      setPublishTarget({ exam, classId });
      setIsPublishConfirmOpen(true);
    } catch (err) {
      console.error(err);
      setError('Failed to perform pre-publish validation.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishResults = async () => {
    if (!publishTarget) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await schoolService.publishExamResults(publishTarget.exam.id, publishTarget.classId);
      setIsPublishConfirmOpen(false);
      setSuccess('Examination results published to students and parents successfully.');
      if (activeView === 'classes') {
        await handleOpenClassWorkspace(publishTarget.exam);
      } else {
        loadDashboard();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to publish results.');
    } finally {
      setSubmitting(false);
      setPublishTarget(null);
    }
  };

  const handleUnpublishClassResults = (exam, classId) => {
    setUnpublishTarget({ exam, classId });
    setIsUnpublishConfirmOpen(true);
  };

  const handleUnpublishResults = async () => {
    if (!unpublishTarget) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await schoolService.publishExamResults(unpublishTarget.exam.id, unpublishTarget.classId, 'Draft');
      setIsUnpublishConfirmOpen(false);
      setSuccess('Examination results successfully marked as Draft.');
      if (activeView === 'classes') {
        await handleOpenClassWorkspace(unpublishTarget.exam);
      } else {
        loadDashboard();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update results status.');
    } finally {
      setSubmitting(false);
      setUnpublishTarget(null);
    }
  };

  const triggerDownloadReportCardPdf = (cardData) => {
    const reportCardData = cardData || selectedReportCard;
    if (!reportCardData) return;

    setSelectedReportCard(reportCardData);
    setIsReportCardOpen(true);

    setTimeout(() => {
      const element = document.getElementById('printable-report-card');
      if (!element) return;

      const opt = {
        margin: 8,
        filename: `Report_Card_${reportCardData.student_name.replace(/\s+/g, '_')}_${reportCardData.class_name.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'avoid-all'] }
      };

      html2pdf().from(element).set(opt).save().then(() => {
        schoolAdminService.logClientAudit({
          module: 'Examinations',
          action: 'Report Card Downloaded',
          description: `Report card PDF downloaded for ${reportCardData.student_name} (${reportCardData.class_name})`
        }).catch(console.error);
      });
    }, 450);
  };

  const triggerPrintReportCard = (cardData) => {
    const reportCardData = cardData || selectedReportCard;
    if (!reportCardData) return;

    // Log the print action
    schoolAdminService.logClientAudit({
      module: 'Examinations',
      action: 'Report Card Printed',
      description: `Report card printed for ${reportCardData.student_name} (${reportCardData.class_name})`
    }).catch(console.error);

    const printElement = document.getElementById('printable-report-card');
    if (!printElement) return;

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
    doc.write('<html><head><title>Print Report Card</title>');
    
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
      doc.write(el.outerHTML);
    });

    doc.write(`
      <style>
        @page {
          size: portrait !important;
          margin: 8mm !important;
        }
        html, body {
          background-color: white !important;
          color: black !important;
          padding: 0 !important;
          margin: 0 !important;
          height: auto !important;
          min-height: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #printable-report-card-container {
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          height: auto !important;
        }
        #printable-report-card {
          width: 194mm !important;
          max-width: 194mm !important;
          height: 265mm !important;
          max-height: 265mm !important;
          box-sizing: border-box !important;
          padding: 8mm !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          margin-left: auto !important;
          margin-right: auto !important;
          overflow: hidden !important;
          position: relative !important;
          box-shadow: none !important;
          border: 4px double #000 !important;
        }
      </style>
    </head>
    <body class="bg-white text-black">
      <div id="printable-report-card-container">
        ${printElement.outerHTML}
      </div>
    </body>
    </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.document.title = `Report_Card_${reportCardData.student_name.replace(/\s+/g, '_')}`;
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  if (loading && activeView === 'dashboard') {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Examinations Module...</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const filteredExams = exams.filter(e => {
    if (activeFilter === 'total') return true;
    if (activeFilter === 'upcoming') return e.start_date > today;
    if (activeFilter === 'ongoing') return e.start_date <= today && e.end_date >= today;
    if (activeFilter === 'draft') return e.status === 'Draft';
    if (activeFilter === 'published') return e.status === 'Published';
    return true;
  });

  const filteredClassSubjects = subjects.filter(s => {
    if (s.class_id !== parseInt(selectedClassId)) return false;
    const alreadyScheduled = timetablePapers.some(p => parseInt(p.subject_id) === s.id);
    if (editingPaper && parseInt(editingPaper.subject_id) === s.id) {
      return true;
    }
    return !alreadyScheduled;
  });

  const classSubjects = subjects.filter(s => s.class_id === parseInt(selectedClassId));
  const totalSubjectsCount = classSubjects.length;
  const scheduledCount = timetablePapers.length;
  const pendingSubjectsCount = Math.max(0, totalSubjectsCount - scheduledCount);
  const allSubjectsScheduled = totalSubjectsCount > 0 && scheduledCount === totalSubjectsCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Dynamic Style block for clean A4 printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          nav, aside, header, footer, button, .no-print, [role="dialog"] > :not(#printable-report-card-container):not(#printable-scheme-container) {
            display: none !important;
          }
          [role="dialog"] {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #printable-report-card-container, #printable-scheme-container {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          div[data-state], div[class*="fixed"], div[class*="inset"] {
            position: relative !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
          }
        }
      `}} />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Examinations</h2>
          <p className="text-text-secondary text-sm mt-1">Configure exams, manage timetables, enter marks, and generate student report cards.</p>
        </div>
        {activeView === 'dashboard' && !isReadOnly && (
          <Button className="flex items-center gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Examination
          </Button>
        )}
      </div>

      {/* Global alert bar */}
      {(error || success) && (
        <div className="no-print">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
          {success && (
            <div className="p-3.5 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-xs font-semibold flex items-center gap-2 mt-2">
              <CheckCircle className="h-4 w-4" /> {success}
            </div>
          )}
        </div>
      )}

      {/* VIEW 1: DASHBOARD */}
      {activeView === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { id: 'total', label: 'Total Exams', value: totalCount, color: 'text-zinc-800 dark:text-zinc-200' },
              { id: 'upcoming', label: 'Upcoming', value: upcomingCount, color: 'text-blue-600' },
              { id: 'ongoing', label: 'Ongoing', value: ongoingCount, color: 'text-amber-600' },
              { id: 'draft', label: 'Draft Mode', value: draftCount, color: 'text-zinc-500' },
              { id: 'published', label: 'Published Results', value: publishedCount, color: 'text-green-600' },
            ].map(c => {
              const isActive = activeFilter === c.id;
              return (
                <Card 
                  key={c.id} 
                  onClick={() => setActiveFilter(c.id)}
                  className={`cursor-pointer transition-all hover:shadow-md border duration-200 ${
                    isActive 
                      ? 'border-primary bg-primary/5 dark:bg-primary/5 shadow-md scale-[1.02]' 
                      : 'border-border hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
                  }`}
                >
                  <CardContent className="p-5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{c.label}</p>
                    <p className={`text-3xl font-black mt-1 font-display ${c.color}`}>{c.value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Exams List Card */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Scheduled Examinations</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Publish Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-text-muted">
                      No examinations found matching the active filter.
                    </TableCell>
                  </TableRow>
                ) : filteredExams.map(e => (
                  <TableRow 
                    key={e.id} 
                    className="group cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    onClick={() => handleOpenClassWorkspace(e)}
                  >
                    <TableCell className="font-semibold text-text-primary">
                      <div className="flex items-center gap-1">
                        {e.name} <ChevronRight className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-text-muted">{formatDateString(e.start_date)}</TableCell>
                    <TableCell className="text-xs font-mono text-text-muted">{formatDateString(e.end_date)}</TableCell>
                    <TableCell className="text-xs font-mono text-text-muted">{formatDateString(e.publish_date)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        e.status === 'Published' ? 'bg-green-500/10 text-green-600' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                      }`}>
                        {e.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div onClick={(evt) => evt.stopPropagation()}>
                        {!isReadOnly && (
                          <DropdownMenu>
                            <DropdownItem onClick={() => handleEditExamClick(e)}>
                              Edit Examination
                            </DropdownItem>
                            <DropdownItem onClick={() => handleToggleExamPublishStatus(e)}>
                              {e.status === 'Draft' ? 'Publish Examination' : 'Move to Draft'}
                            </DropdownItem>
                            <DropdownItem destructive onClick={() => handleDeleteExamClick(e)}>
                              Delete Examination
                            </DropdownItem>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* VIEW 1.5: CLASS WISE EXAMINATION WORKSPACE */}
      {activeView === 'classes' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => setActiveView('dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Class-wise Exam Management</h3>
              <p className="text-xs text-text-secondary">{selectedExam.name} ({formatDateString(selectedExam.start_date)} to {formatDateString(selectedExam.end_date)})</p>
            </div>
          </div>

          {/* Class Filter Dropdown */}
          <Card className="p-4 shadow-sm bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-full sm:w-80 space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Select Class</label>
                <Select value={selectedClassId} onChange={e => {
                  setSelectedClassId(e.target.value);
                  setPendingSubjects([]);
                  setShowPendingAlert(false);
                  setPendingValidationSource('');
                }}>
                  <option value="">Select class...</option>
                  {examClassStatuses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          {/* Empty state placeholder */}
          {!selectedClassId && (
            <Card className="border border-dashed border-border py-12 text-center text-text-muted text-sm font-semibold flex flex-col items-center justify-center gap-2">
              <LayoutDashboard className="h-10 w-10 text-text-muted opacity-40" />
              <span>Select a class from the dropdown filter above to manage its workspace.</span>
            </Card>
          )}

          {/* Scoped Class Workspace Grid */}
          {selectedClassId && (() => {
            const currentClass = examClassStatuses.find(c => c.id === parseInt(selectedClassId));
            if (!currentClass) return null;

            return (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Pending Subjects Alert Panel */}
                {showPendingAlert && pendingSubjects.length > 0 && (
                  <Card className="border-l-4 border-l-amber-500 bg-card p-5 shadow-sm relative animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      type="button" 
                      onClick={() => setShowPendingAlert(false)}
                      className="absolute top-4 right-4 p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-500 flex-shrink-0">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div className="space-y-3 flex-1 pr-6">
                        <h4 className="text-sm font-black font-display text-text-primary tracking-wider uppercase">
                          {pendingValidationSource === 'reports_empty_timetable'
                            ? 'REPORT CARDS ARE NOT AVAILABLE YET'
                            : pendingValidationSource === 'publish_empty_timetable'
                            ? 'RESULTS CANNOT BE PUBLISHED YET'
                            : pendingValidationSource === 'marks_entry_empty_timetable'
                            ? 'MARKS ENTRY IS NOT AVAILABLE YET'
                            : pendingValidationSource === 'publish_pending_marks'
                            ? 'RESULTS CANNOT BE PUBLISHED YET'
                            : 'REPORT CARDS CANNOT BE GENERATED YET'}
                        </h4>
                        <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
                          <p>
                            {pendingValidationSource === 'reports_empty_timetable'
                              ? 'Report cards cannot be opened because no examination timetable has been created for this class.'
                              : pendingValidationSource === 'publish_empty_timetable'
                              ? 'Results cannot be published because no examination timetable has been created for this class.'
                              : pendingValidationSource === 'marks_entry_empty_timetable'
                              ? 'Marks entry cannot be opened because no examination papers have been scheduled for this class.'
                              : pendingValidationSource === 'publish_pending_marks'
                              ? 'Results cannot be published because marks have not yet been completed for all scheduled subjects in this class.'
                              : 'Report cards cannot be generated because marks have not yet been completed for all scheduled subjects in this class.'
                            }
                          </p>
                          <p>
                            {pendingValidationSource === 'reports_empty_timetable'
                              ? 'Please create the examination timetable and schedule at least one examination paper before opening Student Report Cards.'
                              : pendingValidationSource === 'publish_empty_timetable'
                              ? 'Please create the examination timetable, schedule examination papers, and complete marks entry before publishing examination results.'
                              : pendingValidationSource === 'marks_entry_empty_timetable'
                              ? 'Please create the examination timetable and add at least one paper before entering student marks.'
                              : pendingValidationSource === 'publish_pending_marks'
                              ? 'Please complete marks entry for the following subject(s) before publishing examination results.'
                              : 'Please complete marks entry for the following subject(s) before opening Student Report Cards.'
                            }
                          </p>
                        </div>
                        <div className="border-t border-border pt-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                            {['reports_empty_timetable', 'publish_empty_timetable', 'marks_entry_empty_timetable'].includes(pendingValidationSource)
                              ? 'Required Action'
                              : (pendingSubjects.length === 1 ? 'Pending Subject' : 'Pending Subjects')
                            }
                          </span>
                          <ul className="mt-1.5 space-y-1.5">
                            {pendingValidationSource === 'reports_empty_timetable' ? (
                              <>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Create the examination timetable.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Add examination papers for this class.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Complete marks entry after examinations.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Return and open Student Report Cards.
                                </li>
                              </>
                            ) : pendingValidationSource === 'publish_empty_timetable' ? (
                              <>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Create the examination timetable.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Add examination papers.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Complete marks entry for all scheduled subjects.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Publish examination results.
                                </li>
                              </>
                            ) : pendingValidationSource === 'marks_entry_empty_timetable' ? (
                              <>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Create the examination timetable.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Add examination papers for this class.
                                </li>
                                <li className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  Return and open Marks Entry again.
                                </li>
                              </>
                            ) : (
                              pendingSubjects.map(subName => (
                                <li key={subName} className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                  {subName}
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CARD 1: Exam Timetable */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Calendar className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">Exam Timetable</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Configure exam papers, schedule dates/times, max marks, and room assignments for {currentClass.name}.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold" onClick={() => handleOpenTimetable(selectedExam, currentClass.id)}>
                        <Calendar className="h-4 w-4" /> Open Timetable
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 2: Enter Marks */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Edit3 className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">Enter Marks</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Enter and manage subject-wise marks, absent records, and teacher remarks in a real-time auto-saving spreadsheet.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold" onClick={() => handleOpenMarksEntry(selectedExam, currentClass.id)}>
                        <Edit3 className="h-4 w-4" /> Open Marks Entry
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 3: Report Cards */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Award className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">Report Cards</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Generate, preview, print, or download academic report cards with automated class ranks, section ranks, and attendance.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" onClick={() => handleOpenReportCards(selectedExam, currentClass.id)}>
                        <Award className="h-4 w-4" /> Open Report Cards
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 4: Result Status / Publish */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Settings className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">Result Status</h4>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between py-1 border-b border-border">
                          <span className="text-text-secondary">Publish Status:</span>
                          <span 
                            className={`font-black uppercase px-2 py-0.5 rounded-full text-[10px] select-none transition-all ${
                              currentClass.status === 'Published' 
                                ? 'bg-green-500/10 text-green-600 cursor-pointer hover:bg-green-500/20 active:scale-95' 
                                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                            }`}
                            onClick={() => {
                              if (currentClass.status === 'Published' && !isReadOnly) {
                                handleUnpublishClassResults(selectedExam, currentClass.id);
                              }
                            }}
                          >
                            {currentClass.status}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border">
                          <span className="text-text-secondary">Publish Date:</span>
                          <span className="font-mono text-text-primary">{currentClass.publish_date || '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2">
                      {currentClass.status === 'Draft' && !isReadOnly ? (
                        <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold bg-green-600 hover:bg-green-700 text-white" onClick={() => handlePublishClassResults(selectedExam, currentClass.id)}>
                          <CheckCircle className="h-4 w-4" /> Publish Result
                        </Button>
                      ) : (
                        <Button 
                          type="button"
                          className="w-full text-xs font-bold bg-amber-600/10 hover:bg-amber-600/20 text-amber-600 border border-amber-600/20 cursor-pointer flex items-center justify-center gap-2" 
                          onClick={() => { if (!isReadOnly) handleUnpublishClassResults(selectedExam, currentClass.id); }}
                          disabled={isReadOnly}
                        >
                          <AlertCircle className="h-4 w-4" /> Move to Draft
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* VIEW 2: EXAM TIMETABLE SCHEDULER */}
      {activeView === 'timetable' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => setActiveView('classes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Manage Exam Timetable</h3>
              <p className="text-xs text-text-secondary">{selectedExam.name} — Class: {classes.find(c => c.id === parseInt(selectedClassId))?.name || ''}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* 1. Add Paper block */}
            {(examClassStatuses.find(c => c.id === parseInt(selectedClassId))?.status || 'Draft') === 'Draft' && !isReadOnly ? (
              <Card>
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row justify-between items-center space-y-0">
                  <CardTitle className="text-sm font-bold text-text-primary">
                    {editingPaper ? 'Edit Paper' : 'Add Paper'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {editingPaper && (
                      <Button 
                        type="button" 
                        variant="secondary" 
                        className="h-7 px-3 text-xs font-bold"
                        onClick={() => {
                          setEditingPaper(null);
                          setNewPaper({
                            subject_id: '',
                            paper_type: 'Written',
                            exam_date: suggestNextExamDate(selectedExam, timetablePapers, holidays),
                            start_time: '',
                            end_time: '',
                            max_marks: 100,
                            passing_marks: 40,
                            room: ''
                          });
                          setError('');
                          setSuccess('');
                        }}
                      >
                        Cancel Edit
                      </Button>
                    )}
                    <div className="mr-3 flex flex-col items-end select-none border-r border-border pr-3">
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Subjects Completed</span>
                      <span className="text-xl font-black font-display text-primary leading-tight">
                        {scheduledCount} <span className="text-xs font-medium text-text-muted">/ {totalSubjectsCount}</span>
                      </span>
                    </div>
                    <Button 
                      type="submit" 
                      form="add-paper-form"
                      className="flex items-center gap-2 text-xs font-bold" 
                      disabled={(allSubjectsScheduled && !editingPaper) || (filteredClassSubjects.length === 0 && !editingPaper)}
                    >
                      <Plus className="h-4 w-4" /> {editingPaper ? 'Save Changes' : 'Add Paper'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <form id="add-paper-form" onSubmit={handleAddPaperLocal} className="space-y-4">
                    {/* Row 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Subject */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Subject</label>
                        <Select 
                          value={newPaper.subject_id} 
                          onChange={e => setNewPaper(p => ({ ...p, subject_id: e.target.value }))} 
                          required 
                          disabled={filteredClassSubjects.length === 0}
                        >
                          <option value="">Select subject...</option>
                          {filteredClassSubjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </Select>
                      </div>

                      {/* Paper Type */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Paper Type</label>
                        <Select 
                          value={newPaper.paper_type} 
                          onChange={e => setNewPaper(p => ({ ...p, paper_type: e.target.value }))} 
                          required
                        >
                          <option value="Written">Written</option>
                          <option value="Oral">Oral</option>
                        </Select>
                      </div>

                      {/* Exam Date */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-text-secondary uppercase">Exam Date</label>
                        <CalendarDatePicker
                          min={(() => {
                            const todayStr = new Date().toISOString().split('T')[0];
                            return selectedExam.start_date > todayStr ? selectedExam.start_date : todayStr;
                          })()}
                          max={selectedExam.end_date}
                          value={newPaper.exam_date}
                          onChange={e => setNewPaper(p => ({ ...p, exam_date: e.target.value }))}
                          onError={err => {
                            setError(err);
                            setTimeout(() => setError(''), 4000);
                          }}
                          holidays={holidays}
                          required
                        />
                      </div>

                      {/* Room */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Room / Classroom (Optional)</label>
                        <Input placeholder="e.g. Room 102" value={newPaper.room} onChange={e => setNewPaper(p => ({ ...p, room: e.target.value }))} />
                      </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Start Time */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Start Time</label>
                        <Input type="time" value={newPaper.start_time} onChange={e => setNewPaper(p => ({ ...p, start_time: e.target.value }))} required />
                      </div>

                      {/* End Time */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">End Time</label>
                        <Input type="time" value={newPaper.end_time} onChange={e => setNewPaper(p => ({ ...p, end_time: e.target.value }))} required />
                      </div>

                      {/* Max Marks */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Maximum Marks</label>
                        <Input type="number" value={newPaper.max_marks} onChange={e => setNewPaper(p => ({ ...p, max_marks: e.target.value }))} required />
                      </div>

                      {/* Passing Marks */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Passing Marks</label>
                        <Input type="number" value={newPaper.passing_marks} onChange={e => setNewPaper(p => ({ ...p, passing_marks: e.target.value }))} required />
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-fit shadow-sm bg-zinc-50 border border-zinc-200">
                <CardContent className="p-5 text-center text-text-muted text-xs font-semibold">
                  Timetable configurations are read-only for Published examinations.
                </CardContent>
              </Card>
            )}

            {/* 2. Paper Schedule list */}
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row justify-between items-center space-y-0">
                <CardTitle className="text-sm font-bold text-text-primary">Exam Papers</CardTitle>
                {allSubjectsScheduled && (
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex items-center gap-2 text-xs font-bold py-1.5 px-3 border-border hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                      onClick={handleOpenInstructionsPopup}
                    >
                      <BookOpen className="h-4 w-4" /> Instructions
                    </Button>
                    <Button 
                      type="button"
                      className="flex items-center gap-2 text-xs font-bold py-1.5 px-3 cursor-pointer"
                      onClick={handleDownloadSchemeClick}
                    >
                      <Download className="h-4 w-4" /> Download Scheme
                    </Button>
                  </div>
                )}
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Paper Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Max Marks</TableHead>
                    <TableHead>Passing Marks</TableHead>
                    <TableHead>Room</TableHead>
                    {!isReadOnly && (examClassStatuses.find(c => c.id === parseInt(selectedClassId))?.status || 'Draft') === 'Draft' && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timetablePapers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-text-muted">
                        No papers scheduled for this examination yet. Use the form above to add papers.
                      </TableCell>
                    </TableRow>
                  ) : timetablePapers.map((paper, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-semibold text-text-primary">{paper.subject_name}</TableCell>
                      <TableCell className="text-xs font-semibold">{paper.paper_type || 'Written'}</TableCell>
                      <TableCell className="text-xs font-mono">{formatDateString(paper.exam_date)}</TableCell>
                      <TableCell className="text-xs font-mono">{formatTimeString(paper.start_time)} – {formatTimeString(paper.end_time)}</TableCell>
                      <TableCell className="text-xs font-mono">{paper.max_marks}</TableCell>
                      <TableCell className="text-xs font-mono">{paper.passing_marks}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{paper.room || '—'}</TableCell>
                      {!isReadOnly && (examClassStatuses.find(c => c.id === parseInt(selectedClassId))?.status || 'Draft') === 'Draft' && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownItem onClick={() => {
                              setEditingPaper(paper);
                              setNewPaper({
                                subject_id: paper.subject_id.toString(),
                                paper_type: paper.paper_type || 'Written',
                                exam_date: paper.exam_date,
                                start_time: paper.start_time.slice(0, 5),
                                end_time: paper.end_time.slice(0, 5),
                                max_marks: parseFloat(paper.max_marks) || 100,
                                passing_marks: parseFloat(paper.passing_marks) || 40,
                                room: paper.room || ''
                              });
                            }}>
                              Edit Paper
                            </DropdownItem>
                            <DropdownItem destructive onClick={() => handleDeletePaperClick(paper)}>
                              Delete Paper
                            </DropdownItem>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      )}

      {/* VIEW 3: MARKS SPREADSHEET ENTRY */}
      {activeView === 'marks' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => setActiveView('classes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Subject Marks Sheet</h3>
              <p className="text-xs text-text-secondary">{selectedExam.name} — Class: {classes.find(c => c.id === parseInt(selectedClassId))?.name || ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Select Subject */}
            <Card className="flex flex-col justify-center p-4 h-24">
              <div className="space-y-1.5 w-full">
                <label className="text-xs font-bold text-text-secondary uppercase">Select Scheduled Subject</label>
                <Select value={selectedSubjectId} onChange={handleSubjectChange}>
                  {timetablePapers.map(p => (
                    <option key={p.subject_id} value={p.subject_id}>{p.subject_name}</option>
                  ))}
                </Select>
              </div>
            </Card>

            {/* Card 2: Completed Subject */}
            {marksSheet && (
              <Card className="flex flex-col justify-center p-4 h-24 bg-zinc-50/50 dark:bg-zinc-900/50 select-none">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-sm font-black font-display text-text-primary tracking-wider uppercase">
                    COMPLETED SUBJECT:
                  </span>
                  <span className="text-2xl font-black font-display text-primary leading-none align-baseline">
                    {timetablePapers.filter(p => p.marks_completed).length}
                    <span className="text-sm font-bold text-text-muted ml-1">/{timetablePapers.length}</span>
                  </span>
                </div>
              </Card>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-text-muted text-xs font-bold">Loading marks spreadsheet...</div>
          ) : marksSheet ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="w-32">Absent</TableHead>
                    <TableHead className="w-48">Marks Obtained</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead className="w-24 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marksSheet.students.map(s => {
                    const isReadOnlyField = isReadOnly || selectedExam.status === 'Published';
                    return (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-mono font-semibold text-text-secondary">{s.roll_no || '-'}</TableCell>
                        <TableCell className="font-semibold text-text-primary">{s.student_name}</TableCell>
                        <TableCell>
                          <input 
                            type="checkbox" 
                            className="rounded border-zinc-300 h-4 w-4 accent-primary" 
                            disabled={isReadOnlyField}
                            checked={s.is_absent === 1}
                            onChange={e => handleMarkCellChange(s.student_id, 'is_absent', e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder={s.is_absent === 1 ? 'ABSENT' : `Max: ${marksSheet.max_marks}`}
                            className="h-8 text-xs font-mono w-full"
                            disabled={s.is_absent === 1 || isReadOnlyField}
                            value={s.is_absent === 1 ? '' : (s.marks_obtained !== null && s.marks_obtained !== undefined ? s.marks_obtained : '')}
                            onChange={e => handleMarkCellChange(s.student_id, 'marks_obtained', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            placeholder="Add remarks..." 
                            className="h-8 text-xs w-full"
                            disabled={isReadOnlyField}
                            value={s.remarks || ''}
                            onChange={e => handleMarkCellChange(s.student_id, 'remarks', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right text-[10px] font-semibold text-text-muted">
                          {savingMarkStudentId === s.student_id ? (
                            <span className="text-primary font-bold">Saving...</span>
                          ) : (
                            <span className="text-green-600">Saved</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="p-8 text-center text-text-muted text-xs">
              No marks entry spreadsheet available. Make sure subjects are scheduled in the timetable first.
            </Card>
          )}
        </div>
      )}

      {/* VIEW 4: REPORT CARDS LIST */}
      {activeView === 'reports' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => setActiveView('classes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Student Report Cards</h3>
              <p className="text-xs text-text-secondary">{selectedExam.name} — Class: {classes.find(c => c.id === parseInt(selectedClassId))?.name || ''}</p>
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 whitespace-nowrap select-none">Rank</TableHead>
                  <TableHead className="w-20 whitespace-nowrap select-none">Roll No</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Student Name</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Total Marks</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Percentage</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Grade</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Attendance</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Result</TableHead>
                  <TableHead className="text-right whitespace-nowrap select-none">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-text-muted">
                      No report card records found. Make sure marks are entered and saved first.
                    </TableCell>
                  </TableRow>
                ) : reportCards.map((card, idx) => (
                  <TableRow key={card.student_id}>
                    <TableCell className="font-bold text-text-primary">{card.class_rank.split(' ')[0]}</TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">{card.roll_no}</TableCell>
                    <TableCell className="font-semibold text-text-primary">{card.student_name}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{card.total_obtained} / {card.total_max}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-primary">{card.percentage}%</TableCell>
                    <TableCell className="font-black text-xs text-primary">{card.grade}</TableCell>
                    <TableCell className="text-xs text-text-secondary">{card.attendance.attendance_rate}%</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        card.result === 'PASS' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        {card.result}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu trigger={
                        <Button variant="outline" className="h-7 px-2 text-xs flex items-center gap-1 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 ml-auto">
                          <FileText className="h-3.5 w-3.5" /> View
                        </Button>
                      }>
                        <DropdownItem onClick={() => handleOpenSingleReportCard(card)}>
                          Print Report Card
                        </DropdownItem>
                        <DropdownItem onClick={() => triggerDownloadReportCardPdf(card)}>
                          Download PDF
                        </DropdownItem>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* CREATE EXAM DIALOG */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}
        title="Create Examination" description="Define details for a new school-wide examination."
        footer={<>
          <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateExam} disabled={submitting}>{submitting ? 'Creating...' : 'Create Examination'}</Button>
        </>}>
        <form onSubmit={handleCreateExam} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Examination Name</label>
            <Input placeholder="e.g. Half Yearly, Pre Board, Unit Test 1" value={newExam.name} onChange={e => setNewExam(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Start Date</label>
              <Input type="date" value={newExam.start_date} onChange={e => setNewExam(p => ({ ...p, start_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">End Date</label>
              <Input type="date" value={newExam.end_date} onChange={e => setNewExam(p => ({ ...p, end_date: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Result Publish Date</label>
            <Input type="date" value={newExam.publish_date} onChange={e => setNewExam(p => ({ ...p, publish_date: e.target.value }))} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description (Optional)</label>
            <Input placeholder="Brief details about terms or exam guidelines" value={newExam.description} onChange={e => setNewExam(p => ({ ...p, description: e.target.value }))} />
          </div>
        </form>
      </Dialog>

      {/* CONFIRM PUBLISH DIALOG */}
      <Dialog isOpen={isPublishConfirmOpen} onClose={() => setIsPublishConfirmOpen(false)}
        title="Publish Examination Results"
        footer={<>
          <Button variant="secondary" onClick={() => setIsPublishConfirmOpen(false)}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handlePublishResults} disabled={submitting}>
            {submitting ? 'Publishing...' : 'Yes, Publish Results'}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h4 className="text-center font-bold text-text-primary text-sm mt-2">Are you sure you want to publish results?</h4>
          <p className="text-xs text-text-secondary leading-relaxed text-center">
            Publishing results will lock marks and allow students and parents to view their report cards on their portal. 
            Once published, you will not be able to edit timetable or student marks sheet entries. 
            <strong className="block mt-2 text-primary font-bold">Note: You can mark the exam back to Draft later by clicking on the "Published" badge inside the Result Status card.</strong>
          </p>
        </div>
      </Dialog>

      {/* CONFIRM UNPUBLISH DIALOG */}
      <Dialog isOpen={isUnpublishConfirmOpen} onClose={() => setIsUnpublishConfirmOpen(false)}
        title="Move Examination to Draft"
        footer={<>
          <Button variant="secondary" onClick={() => setIsUnpublishConfirmOpen(false)}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleUnpublishResults} disabled={submitting}>
            {submitting ? 'Updating...' : 'Yes, Move to Draft'}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="text-center font-bold text-text-primary text-sm mt-2">Are you sure you want to mark it as Draft?</h4>
          <p className="text-xs text-text-secondary leading-relaxed text-center">
            Once it is marked as Draft, report cards will no longer be available for students/parents in the application, and you will be able to edit scheduled papers or marks sheet entries.
          </p>
        </div>
      </Dialog>

      {/* EDIT EXAM DIALOG */}
      <Dialog isOpen={isEditExamOpen} onClose={() => setIsEditExamOpen(false)}
        title="Edit Examination" description="Update details for this school-wide examination."
        footer={<>
          <Button variant="secondary" onClick={() => setIsEditExamOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateExam} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
        </>}>
        <form onSubmit={handleUpdateExam} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Examination Name</label>
            <Input placeholder="e.g. Half Yearly, Pre Board, Unit Test 1" value={editExamData.name} onChange={e => setEditExamData(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-text-secondary uppercase">Start Date</label>
               <Input type="date" value={editExamData.start_date} onChange={e => setEditExamData(p => ({ ...p, start_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-text-secondary uppercase">End Date</label>
               <Input type="date" value={editExamData.end_date} onChange={e => setEditExamData(p => ({ ...p, end_date: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Result Publish Date</label>
            <Input type="date" value={editExamData.publish_date} onChange={e => setEditExamData(p => ({ ...p, publish_date: e.target.value }))} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description (Optional)</label>
            <Input placeholder="Brief details about terms or exam guidelines" value={editExamData.description || ''} onChange={e => setEditExamData(p => ({ ...p, description: e.target.value }))} />
          </div>
        </form>
      </Dialog>

      {/* DELETE EXAM CONFIRM DIALOG */}
      <Dialog isOpen={isDeleteExamConfirmOpen} onClose={() => setIsDeleteExamConfirmOpen(false)}
        title="Delete Examination"
        footer={<>
          <Button variant="secondary" onClick={() => setIsDeleteExamConfirmOpen(false)}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmDeleteExam} disabled={submitting}>
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to delete this examination? This action cannot be undone.
          </p>
        </div>
      </Dialog>

      {/* DELETE PAPER CONFIRM DIALOG */}
      <Dialog isOpen={isDeletePaperConfirmOpen} onClose={() => setIsDeletePaperConfirmOpen(false)}
        title="Delete Exam Paper"
        footer={<>
          <Button variant="secondary" onClick={() => setIsDeletePaperConfirmOpen(false)}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmDeletePaper} disabled={submitting}>
            {submitting ? 'Deleting...' : 'Delete'}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <p className="text-xs text-text-secondary leading-relaxed">
            Are you sure you want to delete this exam paper? This action cannot be undone.
          </p>
        </div>
      </Dialog>

      {/* EXAMINATION INSTRUCTIONS DIALOG */}
      <Dialog isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)}
        title="Examination Instructions"
        footer={<>
          <Button type="button" variant="secondary" onClick={() => setIsInstructionsOpen(false)}>Close</Button>
        </>}>
        <div className="space-y-4 p-1">
          <form onSubmit={handleAddOrUpdateInstruction} className="space-y-3">
            <label className="text-xs font-bold text-text-secondary uppercase">
              {editingInstructionIndex !== null ? 'Edit Instruction' : 'Add New Instruction'}
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Carry your School ID Card."
                value={newInstruction}
                onChange={e => setNewInstruction(e.target.value)}
                maxLength={150}
                className="flex-1"
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !newInstruction.trim()}>
                {editingInstructionIndex !== null ? 'Save' : 'Add'}
              </Button>
            </div>
            <p className="text-[10px] text-text-muted">Maximum 3 instructions allowed. Each instruction can contain a maximum of 25 words.</p>
          </form>

          <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-1">
            {instructions.map((inst, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg shadow-2xs">
                <div className="flex gap-2 items-start text-xs font-semibold text-text-primary leading-relaxed">
                  <span className="text-primary font-bold">{idx + 1}.</span>
                  <span>{inst}</span>
                </div>
                <div className="ml-4">
                  <DropdownMenu>
                    <DropdownItem onClick={() => {
                      setEditingInstructionIndex(idx);
                      setNewInstruction(inst);
                    }}>
                      Edit Instruction
                    </DropdownItem>
                    <DropdownItem destructive onClick={() => handleDeleteInstruction(idx)}>
                      Delete Instruction
                    </DropdownItem>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Dialog>

      {/* DETAILED EXAMINATION SCHEME DIALOG MODAL (A4 PRINTABLE) */}
      <Dialog isOpen={isSchemeOpen} onClose={() => setIsSchemeOpen(false)} size="lg">
        {selectedExam && (
          <div id="printable-scheme-container" className="space-y-6">
            {isSchemeOpen && (
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  @page {
                    size: landscape !important;
                    margin: 8mm !important;
                  }
                  body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  .no-print-scroll {
                    overflow: visible !important;
                    padding: 0 !important;
                    background: transparent !important;
                    display: block !important;
                  }
                  #printable-scheme {
                    width: 268mm !important;
                    max-width: 268mm !important;
                    box-sizing: border-box !important;
                    padding: 8mm !important;
                    margin: 0 auto !important;
                    overflow: hidden !important;
                  }
                }
              `}} />
            )}
            {/* Action Bar (Not printed) */}
            <div className="flex justify-between items-center bg-zinc-50 border-b border-border p-4 -m-6 mb-6 no-print">
              <span className="text-xs font-bold text-text-secondary">Examination Scheme Preview</span>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={triggerDownloadPdf} className="flex items-center gap-2 font-bold py-1.5 px-3">
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button type="button" variant="outline" onClick={triggerPrintScheme} className="flex items-center gap-2 font-bold py-1.5 px-3 border-border hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <Printer className="h-4 w-4" /> Print Scheme
                </Button>
              </div>
            </div>

            {/* A4 Scheme document (Landscape style with horizontal scroll for screen layout) */}
            {(() => {
              const scaling = getDynamicScalingStyles(timetablePapers.length, instructions.length);
              const showInstructions = timetablePapers.length < 14 && instructions.length > 0;

              return (
                <div className="w-full overflow-x-auto py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex justify-start lg:justify-center p-2 no-print-scroll">
                  <div id="printable-scheme" className="border-4 border-double border-zinc-400 p-8 bg-white text-zinc-900 rounded-sm font-sans relative space-y-6 w-full max-w-[268mm]" style={{ width: '268mm', boxSizing: 'border-box' }}>
                    
                    {/* Header */}
                    <div className={`text-center border-b-2 border-zinc-800 text-zinc-900 ${scaling.headerPadding}`}>
                      <h2 className="text-2xl font-black uppercase tracking-tight font-display">
                        {schoolProfile?.name || 'SCHOOL TIMETABLE'}
                      </h2>
                      <h3 className="text-xl font-bold uppercase tracking-wide mt-1">
                        {selectedExam.name} Examination Scheme
                      </h3>
                      <h4 className="text-sm font-semibold text-zinc-600 mt-1">
                        Class: {classes.find(c => c.id === parseInt(selectedClassId))?.name || ''}
                      </h4>
                    </div>

                    {/* Timetable Scheme Table */}
                    <div className={scaling.tableMargin}>
                      <table className="w-full text-left border border-zinc-400 border-collapse text-zinc-900">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-400 text-zinc-900">
                            <th className={`border-r border-zinc-400 font-bold uppercase text-zinc-900 whitespace-nowrap w-[20%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Subject</th>
                            <th className={`border-r border-zinc-400 font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[15%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Paper Type</th>
                            <th className={`border-r border-zinc-400 font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[20%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Date</th>
                            <th className={`border-r border-zinc-400 font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[30%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Time</th>
                            <th className={`font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[15%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Max Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timetablePapers.map((paper, idx) => (
                            <tr key={idx} className="border-b border-zinc-300 text-zinc-900">
                              <td className={`border-r border-zinc-400 font-semibold whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>{paper.subject_name}</td>
                              <td className={`border-r border-zinc-400 text-center whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>{paper.paper_type || 'Written'}</td>
                              <td className={`border-r border-zinc-400 text-center font-mono whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>{formatDateString(paper.exam_date)}</td>
                              <td className={`border-r border-zinc-400 text-center font-mono whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>
                                {formatTimeString(paper.start_time)} – {formatTimeString(paper.end_time)}
                              </td>
                              <td className={`text-center font-mono whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>{paper.max_marks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer Guidelines */}
                    {showInstructions && (
                      <div className={`border-t border-zinc-200 text-zinc-800 text-left ${scaling.instructionsMargin} ${scaling.instructionsFontSize}`}>
                        <p className="font-bold uppercase text-zinc-900">Important Instructions:</p>
                        <ol className={`list-decimal list-inside ${scaling.instructionsSpacing}`}>
                          {instructions.map((inst, idx) => (
                            <li key={idx} className="font-medium text-zinc-800">{inst}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Dialog>

      {/* DETAILED REPORT CARD DIALOG MODAL (A4 PRINTABLE) */}
      <Dialog isOpen={isReportCardOpen} onClose={() => setIsReportCardOpen(false)} size="lg">
        {selectedReportCard && (
          (() => {
            const scaling = getReportCardScalingStyles(selectedReportCard.subjects.length);
            
            return (
              <div id="printable-report-card-container" className="space-y-6">
                {isReportCardOpen && (
                  <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                      @page {
                        size: portrait !important;
                        margin: 8mm !important;
                      }
                      body {
                        background-color: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .no-print-scroll {
                        overflow: visible !important;
                        padding: 0 !important;
                        background: transparent !important;
                        display: block !important;
                      }
                      #printable-report-card {
                        width: 194mm !important;
                        max-width: 194mm !important;
                        height: 265mm !important;
                        max-height: 265mm !important;
                        box-sizing: border-box !important;
                        padding: 8mm !important;
                        margin: 0 auto !important;
                        overflow: hidden !important;
                        position: relative !important;
                        border: 4px double #000 !important;
                      }
                    }
                  `}} />
                )}
                {/* Action Bar (Not printed) */}
                <div className="flex justify-between items-center bg-zinc-50 border-b border-border p-4 -m-6 mb-6 no-print">
                  <span className="text-xs font-bold text-text-secondary">Progress Report Card Preview</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => triggerDownloadReportCardPdf(selectedReportCard)} className="flex items-center gap-2 font-bold py-1.5 px-3">
                      <Download className="h-4 w-4" /> Download PDF
                    </Button>
                    <Button type="button" variant="outline" onClick={() => triggerPrintReportCard(selectedReportCard)} className="flex items-center gap-2 font-bold py-1.5 px-3 border-border hover:bg-zinc-100 dark:hover:bg-zinc-900">
                      <Printer className="h-4 w-4" /> Print Report Card
                    </Button>
                  </div>
                </div>

                {/* A4 Report Card document */}
                <div className="w-full overflow-x-auto py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex justify-start lg:justify-center p-2 no-print-scroll">
                  <div id="printable-report-card" className="border-4 border-double border-zinc-400 p-6 bg-white text-zinc-900 rounded-sm font-sans relative w-full max-w-[194mm]" style={{ width: '194mm', boxSizing: 'border-box', height: '272mm' }}>
                    
                    {/* Report Card Header */}
                    <div className={`text-center border-b-2 border-zinc-800 ${scaling.headerPadding}`}>
                      <div className="flex justify-center mb-2">
                        {selectedReportCard.school_logo ? (
                          <img src={selectedReportCard.school_logo} alt="Logo" className={`${scaling.headerLogoHeight} object-contain`} />
                        ) : (
                          <div className={`rounded-full bg-zinc-100 border border-zinc-300 flex items-center justify-center font-bold text-zinc-600 uppercase ${scaling.headerLogoHeight} text-lg`}>
                            {selectedReportCard.school_name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <h2 className={`${scaling.headerTitleSize} font-black uppercase tracking-tight text-zinc-900 font-display`}>{selectedReportCard.school_name}</h2>
                      <h4 className={`${scaling.headerSubtitleSize} font-bold tracking-widest text-zinc-500 uppercase mt-1`}>
                        {selectedReportCard.exam_name} ACADEMIC PERFORMANCE
                      </h4>
                      <p className="text-xs font-mono text-zinc-600 mt-1">Academic Year: {selectedReportCard.academic_year_name}</p>
                    </div>

                    {/* Student Metadata grid */}
                    <div className={`grid grid-cols-3 ${scaling.metadataGapY} gap-x-4 ${scaling.metadataPadding} text-xs border-b border-zinc-300 font-semibold leading-relaxed px-2`}>
                      <div className="whitespace-nowrap overflow-visible">Student Name: <span className="font-bold text-zinc-900">{selectedReportCard.student_name}</span></div>
                      <div className="whitespace-nowrap overflow-visible text-center">Class: <span className="font-bold text-zinc-900">{selectedReportCard.class_name} {selectedReportCard.class_section ? `(${selectedReportCard.class_section})` : ''}</span></div>
                      <div className="whitespace-nowrap overflow-visible text-right">SR No: <span className="font-mono text-zinc-700">{selectedReportCard.admission_no || 'N/A'}</span></div>
                      
                      <div className="whitespace-nowrap overflow-visible">Father Name: <span className="text-zinc-700">{selectedReportCard.father_name || 'N/A'}</span></div>
                      <div className="whitespace-nowrap overflow-visible text-center">Mother Name: <span className="text-zinc-700">{selectedReportCard.mother_name || 'N/A'}</span></div>
                      <div className="whitespace-nowrap overflow-visible text-right">Roll No: <span className="font-mono text-zinc-700">{selectedReportCard.roll_no}</span></div>
                    </div>

                    {/* Marks Table */}
                    <div className={scaling.tableMargin}>
                      <table className="w-full text-left text-xs border border-zinc-400 border-collapse table-layout-fixed">
                        <thead>
                          <tr className="bg-zinc-100 border-b border-zinc-400">
                            <th className={`p-2 border-r border-zinc-400 font-bold uppercase whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>Subject</th>
                            <th className={`p-2 border-r border-zinc-400 font-bold uppercase text-center w-32 whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>Obtained Marks</th>
                            <th className={`p-2 border-r border-zinc-400 font-bold uppercase text-center w-28 whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>Max Marks</th>
                            <th className={`p-2 border-r border-zinc-400 font-bold uppercase text-center w-28 whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>Passing Marks</th>
                            <th className={`p-2 border-r border-zinc-400 font-bold uppercase text-center w-20 whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>Grade</th>
                            <th className={`p-2 font-bold uppercase text-center w-24 whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedReportCard.subjects.map((s, idx) => (
                            <tr key={idx} className="border-b border-zinc-300">
                              <td className={`p-2 border-r border-zinc-400 font-semibold ${scaling.tableFontSize} ${scaling.tablePadding}`}>{s.subject_name}</td>
                              <td className={`p-2 border-r border-zinc-400 text-center font-mono font-bold ${scaling.tableFontSize} ${scaling.tablePadding}`}>{s.marks_obtained}</td>
                              <td className={`p-2 border-r border-zinc-400 text-center font-mono ${scaling.tableFontSize} ${scaling.tablePadding}`}>{s.max_marks}</td>
                              <td className={`p-2 border-r border-zinc-400 text-center font-mono ${scaling.tableFontSize} ${scaling.tablePadding}`}>{s.passing_marks}</td>
                              <td className={`p-2 border-r border-zinc-400 text-center font-bold ${scaling.tableFontSize} ${scaling.tablePadding}`}>{s.grade}</td>
                              <td className={`p-2 text-center whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>
                                <span className={`font-bold uppercase ${s.result === 'PASS' ? 'text-green-700' : 'text-red-700'}`}>
                                  {s.result}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Results Summary grid */}
                    <div className={`grid grid-cols-3 ${scaling.summaryGap} ${scaling.summaryPadding} bg-zinc-50 border border-zinc-300 rounded-sm text-xs font-semibold mx-2`}>
                      <div>Class Rank: <span className="font-bold text-zinc-900">{selectedReportCard.class_rank.split(' ')[0]}</span></div>
                      <div className="text-center">Percentage: <span className="font-mono font-bold text-primary">{selectedReportCard.percentage}%</span></div>
                      <div className="text-right">Grand Total: <span className="font-mono font-bold text-zinc-900">{selectedReportCard.total_obtained} / {selectedReportCard.total_max}</span></div>
                      
                      <div>Overall Grade: <span className="font-bold text-primary">{selectedReportCard.grade}</span></div>
                      <div className="text-center">Attendance Rate: <span className="font-mono text-zinc-700">{selectedReportCard.attendance.attendance_rate}%</span></div>
                      <div></div>
                    </div>

                    {/* Remarks/Status display */}
                    <div className={`${scaling.verdictPadding} px-2`}>
                      <div className="flex flex-col">
                        <h4 className="text-xs font-bold uppercase text-zinc-800 mb-2">Final Verdict & Teacher Remarks</h4>
                        <div className={`border border-zinc-300 ${scaling.verdictBoxPadding} ${scaling.verdictMinHeight} text-xs leading-relaxed font-bold text-green-700`}>
                          {selectedReportCard.result === 'PASS' 
                            ? (selectedReportCard.report_card_remark || schoolProfile?.report_card_remark || 'No report card remark has been configured.') 
                            : 'The student requires additional academic assistance in one or more subjects to meet the passing standards.'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Signatures block */}
                    <div className="absolute bottom-6 left-8 right-8 flex justify-between text-xs font-bold">
                      <div className="text-center w-36">
                        <div className="h-6"></div>
                        <div className="border-t border-zinc-800 pt-1 text-zinc-700">Class Teacher</div>
                      </div>
                      <div className="text-center w-36">
                        <div className="h-6"></div>
                        <div className="border-t border-zinc-800 pt-1 text-zinc-700">Principal Signature</div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })()
        )}
      </Dialog>

    </div>
  );
}
