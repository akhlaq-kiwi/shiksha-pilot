import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, ArrowLeft, Calendar, Clock, BookOpen, UserCheck, 
  Settings, Award, Printer, Trash, FileText, CheckCircle, 
  XCircle, Save, AlertCircle, Edit3, Trash2, LayoutDashboard, ChevronRight, ChevronDown, Download, X,
  Users, Check, RotateCcw, Phone, Loader2, MoreVertical, Eye
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import CustomSelect from '../../../common/ui/CustomSelect';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';
import html2pdf from 'html2pdf.js';
import ReportCardRenderer from '../../report-card-templates/ReportCardRenderer';
import { compileReportCardData, compileFinalSessionReportCardData } from '../../../common/services/reportCardEngine';
import { ContactSuperAdminDialog } from '../index';
import { getClassIndex, getShortClassName } from '../../../common/constants/predefinedClasses';

const formatGridHeaderDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = String(parseInt(parts[2], 10)).padStart(2, '0');
    const shortMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${shortMonths[monthIndex]}`;
    }
  }
  return dateStr;
};

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

const OtpInput4Digit = ({ value, onChange, error, autoFocus }) => {
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const digits = (value || '').padEnd(4, '').slice(0, 4).split('');

  useEffect(() => {
    if (autoFocus && inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
  }, [autoFocus]);

  const handleChange = (index, e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      const newDigits = [...digits];
      newDigits[index] = '';
      onChange(newDigits.join(''));
      return;
    }
    const lastChar = val[val.length - 1];
    const newDigits = [...digits];
    newDigits[index] = lastChar;
    const combined = newDigits.join('');
    onChange(combined);

    if (index < 3 && lastChar) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pastedData) {
      onChange(pastedData);
      const targetIndex = Math.min(pastedData.length, 3);
      inputRefs[targetIndex].current?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 my-4 select-none">
      {[0, 1, 2, 3].map((idx) => (
        <input
          key={idx}
          ref={inputRefs[idx]}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(idx, e)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          className={`w-12 h-14 text-center text-xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
            error
              ? 'border-rose-500 bg-rose-50 text-rose-700'
              : digits[idx]
              ? 'border-rose-500 bg-rose-50/50 text-text-primary'
              : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-text-primary focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
          }`}
        />
      ))}
    </div>
  );
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
    tableFontSize = 'text-[11px]';
    tablePadding = 'p-1.5';
    headerPadding = 'pb-2';
    tableMargin = 'py-2';
    instructionsFontSize = 'text-[11px]';
    instructionsSpacing = 'space-y-0.5';
    instructionsMargin = 'mt-3 pt-3';
  } else {
    // 14 or more subjects (instructions are hidden)
    tableFontSize = 'text-[11px]';
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

const getTodayLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const suggestNextExamDate = (exam, papers, holidays) => {
  if (!exam || !exam.start_date || !exam.end_date) return '';
  let baseDateStr = exam.start_date;
  const parts = baseDateStr.split('-');
  if (parts.length !== 3) return baseDateStr;
  
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const d = parseInt(parts[2]);
  let current = new Date(y, m, d);

  const endParts = exam.end_date.split('-');
  if (endParts.length !== 3) return baseDateStr;
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

const CalendarDatePicker = ({ value, onChange, min, max, required, className, onError, holidays, allowPast = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  const todayStr = getTodayLocalDateString();
  
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
      if (!allowPast && parsed < todayStr) {
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
    if (!allowPast && parsed < todayStr) {
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
        <Input aria-label="e.g. 10 July 2026"
          placeholder="e.g. 10 July 2026"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          required={required}
          className={`focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong pr-10 ${className || ''}`}
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
          
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-text-muted mb-1">
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
              
              const isPast = allowPast ? false : (dateStr < todayStr);
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

const sortAndDeduplicateClasses = (rawClasses) => {
  const uniqueMap = new Map();
  (rawClasses || []).forEach(c => {
    const shortName = getShortClassName(c.name);
    const key = `${shortName}_${c.section || ''}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, c);
    }
  });
  return Array.from(uniqueMap.values()).sort((a, b) => getClassIndex(a.name) - getClassIndex(b.name));
};

const CustomClassSelect = ({ value, onChange, options = [], placeholder = "Select class..." }) => {
  const sortedOptions = sortAndDeduplicateClasses(options);
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      options={sortedOptions.map(c => ({
        value: String(c.id),
        label: `${getShortClassName(c.name)}${c.section ? ` (${c.section})` : ''}`
      }))}
      buttonClassName="h-9 focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border"
    />
  );
};

export default function ExamsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAcademicYear, isReadOnly } = useAcademicYear();
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'classes', 'timetable', 'marks', 'reports', 'grade_scale'
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  
  // Data States
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [success, setSuccess] = useState('');

  // Selected Contexts
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [examClassStatuses, setExamClassStatuses] = useState([]);
  const [hasSeatingPlan, setHasSeatingPlan] = useState(false);
  const hasRestoredStateRef = useRef(false);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState(null); // { exam, classId }
  const [isUnpublishConfirmOpen, setIsUnpublishConfirmOpen] = useState(false);
  const [unpublishTarget, setUnpublishTarget] = useState(null); // { exam, classId }
  const [showTogglePublishModal, setShowTogglePublishModal] = useState(false);
  const [togglePublishTarget, setTogglePublishTarget] = useState(null);
  const [isDeletePaperConfirmOpen, setIsDeletePaperConfirmOpen] = useState(false);
  const [deletePaperTarget, setDeletePaperTarget] = useState(null);
  const [editingPaper, setEditingPaper] = useState(null);

  // Publish Scheme States
  const [showPublishSchemeModal, setShowPublishSchemeModal] = useState(false);
  const [submittingPublishScheme, setSubmittingPublishScheme] = useState(false);
  const [showUnpublishSchemeModal, setShowUnpublishSchemeModal] = useState(false);
  const [submittingUnpublishScheme, setSubmittingUnpublishScheme] = useState(false);

  // Instructions States
  const [instructions, setInstructions] = useState([]);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [editingInstructionIndex, setEditingInstructionIndex] = useState(null);
  
  // Dashboard Filtering & Editing States
  const [activeFilter, setActiveFilter] = useState('total');
  const [isDeleteExamConfirmOpen, setIsDeleteExamConfirmOpen] = useState(false);
  const [deleteExamTarget, setDeleteExamTarget] = useState(null);
  const [deleteStep, setDeleteStep] = useState('confirm'); // 'confirm' | 'otp'
  const [deleteOtp, setDeleteOtp] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [otpTimer, setOtpTimer] = useState(30);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [deleteOtpError, setDeleteOtpError] = useState('');
  const [isEditExamOpen, setIsEditExamOpen] = useState(false);
  const [selectedExamToEdit, setSelectedExamToEdit] = useState(null);
  const [isResetPapersConfirmOpen, setIsResetPapersConfirmOpen] = useState(false);
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
    exam_date: '',
    start_time: '09:00',
    end_time: '11:00',
    evaluation_type: 'marks',
    grading_scale: 'A,B,C,D,E',
    max_marks: '100',
    passing_marks: '40',
    room: ''
  });

  // Local Marks Spreadsheet State
  const [marksSheet, setMarksSheet] = useState(null);
  const [savingMarkStudentId, setSavingMarkStudentId] = useState(null);
  const markInputRefs = useRef({});
  const autoAdvanceTimerRef = useRef(null);

  // Local Report Cards State
  const [reportCards, setReportCards] = useState([]);
  const [selectedReportCard, setSelectedReportCard] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [isSchemeOpen, setIsSchemeOpen] = useState(false);
  const [allSchemesData, setAllSchemesData] = useState(null);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [pendingSubjects, setPendingSubjects] = useState([]);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [pendingValidationSource, setPendingValidationSource] = useState(''); // 'reports' or 'publish'

  // Final Session Report Cards State
  const [finalSessionReportCards, setFinalSessionReportCards] = useState([]);
  const [isSelectClassForFinalReportOpen, setIsSelectClassForFinalReportOpen] = useState(false);
  const [allClassSortedCards, setAllClassSortedCards] = useState([]);
  const [generatingClassPdf, setGeneratingClassPdf] = useState(false);
  const [weightagePolicy] = useState({
    strategy: 'weighted_percentage',
    weights: { 'Quarterly': 20, 'Half Yearly': 30, 'Annual': 50 }
  });

  // Grade Configuration Scale States
  const [gradeScales, setGradeScales] = useState([]);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeError, setGradeError] = useState('');
  const [gradeSuccess, setGradeSuccess] = useState('');
  const [editingGradeRow, setEditingGradeRow] = useState(null);
  const [editingGradeIndex, setEditingGradeIndex] = useState(null);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [reportCardRemark, setReportCardRemark] = useState('');
  const [tempRemark, setTempRemark] = useState('');
  const [remarkError, setRemarkError] = useState('');
  const [remarkLoading, setRemarkLoading] = useState(false);

  const getWordCount = (text) => {
    if (!text) return 0;
    const words = text.trim().split(/\s+/);
    return words.filter(word => word.length > 0).length;
  };

  useEffect(() => {
    const handlePopState = () => {
      if (selectedReportCard) {
        setSelectedReportCard(null);
        setIsReportCardOpen(false);
      } else if (['classes', 'timetable', 'marks', 'reports'].includes(activeView) && !selectedExam) {
        setActiveView('dashboard');
        setSelectedClassId('');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedReportCard, activeView, selectedExam]);

  const handleOpenRemarkModal = () => {
    setTempRemark(reportCardRemark);
    setRemarkError('');
    setRemarkLoading(false);
    setIsRemarkModalOpen(true);
  };

  const handleSaveRemark = async () => {
    setRemarkError('');
    
    const wordCount = getWordCount(tempRemark);
    if (wordCount > 12) {
      setRemarkError('Maximum 12 words are allowed.');
      return;
    }

    setRemarkLoading(true);
    try {
      const updatedProfile = await schoolService.updateSchoolProfile({
        report_card_remark: tempRemark.trim()
      });
      const newRemark = updatedProfile?.report_card_remark || '';
      setReportCardRemark(newRemark);
      setSchoolProfile(prev => ({ ...(prev || {}), report_card_remark: newRemark }));
      setIsRemarkModalOpen(false);
    } catch (err) {
      console.error(err);
      setRemarkError(err.message || 'Failed to save remark.');
    } finally {
      setRemarkLoading(false);
    }
  };

  const handleRemoveRemark = async () => {
    setRemarkError('');
    setRemarkLoading(true);
    try {
      await schoolService.updateSchoolProfile({
        report_card_remark: ''
      });
      setReportCardRemark('');
      setSchoolProfile(prev => ({ ...(prev || {}), report_card_remark: '' }));
      setGradeSuccess('Report card remark removed successfully.');
    } catch (err) {
      console.error(err);
      setGradeError(err.message || 'Failed to remove remark.');
    } finally {
      setRemarkLoading(false);
    }
  };

  const handleSaveGradeScale = async () => {
    setGradeLoading(true);
    setGradeError('');
    setGradeSuccess('');
    
    // Quick validate client-side
    for (let i = 0; i < gradeScales.length; i++) {
      const s1 = gradeScales[i];
      const min1 = parseFloat(s1.min_percentage);
      const max1 = parseFloat(s1.max_percentage);
      if (max1 < min1) {
        setGradeError(`Grade ${s1.grade}: Max percentage cannot be less than Min percentage.`);
        setGradeLoading(false);
        return;
      }
      for (let j = i + 1; j < gradeScales.length; j++) {
        const s2 = gradeScales[j];
        const min2 = parseFloat(s2.min_percentage);
        const max2 = parseFloat(s2.max_percentage);
        if (min1 <= max2 && min2 <= max1) {
          setGradeError(`Overlapping ranges detected between Grade ${s1.grade} and Grade ${s2.grade}.`);
          setGradeLoading(false);
          return;
        }
      }
    }

    try {
      await schoolService.saveGradeConfigurations({ scales: gradeScales });
      const freshGrades = await schoolService.getGradeConfigurations().catch(() => null);
      if (freshGrades) {
        setGradeScales(freshGrades);
      }
      setGradeSuccess('Grading configurations saved successfully.');
    } catch (err) {
      console.error(err);
      setGradeError(err.message || 'Failed to save grading configurations.');
    } finally {
      setGradeLoading(false);
    }
  };

  const handleAddGradeRow = () => {
    setGradeScales([
      ...gradeScales,
      { min_percentage: 0, max_percentage: 0, grade: '', grade_point: 0, remark: '' }
    ]);
  };

  const handleRemoveGradeRow = (idx) => {
    setGradeScales(gradeScales.filter((_, i) => i !== idx));
  };

  const handleGradeFieldChange = (idx, field, value) => {
    const updated = gradeScales.map((s, i) => {
      if (i === idx) {
        let val = value;
        if (field === 'min_percentage' || field === 'max_percentage') {
          val = parseFloat(value) || 0;
        } else if (field === 'grade_point') {
          val = parseInt(value) || 0;
        }
        return { ...s, [field]: val };
      }
      return s;
    });
    setGradeScales(updated);
  };

  const handleResetGradesDefault = async () => {
    setGradeScales([
      { min_percentage: 75, max_percentage: 100, grade: 'A', grade_point: 10, remark: 'It was excellent performance by you really appreciable work you have done.' },
      { min_percentage: 60, max_percentage: 74, grade: 'B', grade_point: 8, remark: 'Good performance in examinations, keep working hard to excel further.' },
      { min_percentage: 40, max_percentage: 59, grade: 'C', grade_point: 6, remark: 'Average performance, needs to pay more attention and practice in studies.' },
      { min_percentage: 0, max_percentage: 39, grade: 'D', grade_point: 0, remark: 'Poor performance, requires immediate attention and improvement.' }
    ]);
    setGradeSuccess('Reset to default grading scales successfully.');
  };

  // Load Initial Dashboard Data
  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [examsList, classesList, subjectsList, holidaysList, profile, gradesList] = await Promise.all([
        schoolService.getExaminations(),
        schoolService.getClasses(),
        schoolService.getSubjects(),
        schoolService.getHolidays().catch(() => []),
        schoolService.getSchoolProfile().catch(() => null),
        schoolService.getGradeConfigurations().catch(() => [])
      ]);
      setExams(examsList || []);
      const rawClasses = classesList || [];
      const uniqueClassesMap = new Map();
      rawClasses.forEach(c => {
        const shortName = getShortClassName(c.name);
        const key = `${shortName}_${c.section || ''}`;
        if (!uniqueClassesMap.has(key)) {
          uniqueClassesMap.set(key, c);
        }
      });
      const sortedClassesList = Array.from(uniqueClassesMap.values()).sort((a, b) => getClassIndex(a.name) - getClassIndex(b.name));
      setClasses(sortedClassesList);
      setSubjects(subjectsList || []);
      setHolidays(holidaysList || []);
      setGradeScales(gradesList || []);
      if (profile) {
        setSchoolProfile(profile);
        setReportCardRemark(profile.report_card_remark ?? '');
      }
    } catch (err) {
      console.error(err);
      try {
        const profile = await schoolService.getSchoolProfile();
        if (profile) {
          setSchoolProfile(profile);
          setReportCardRemark(profile.report_card_remark ?? '');
        }
      } catch (pErr) {
        console.error('Failed to fetch fallback school profile:', pErr);
      }
      setError('Failed to load examinations dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval = null;
    if (isDeleteExamConfirmOpen && deleteStep === 'otp' && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDeleteExamConfirmOpen, deleteStep, otpTimer]);

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
    if (info) {
      const timer = setTimeout(() => setInfo(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [info]);

  useEffect(() => {
    if (gradeSuccess) {
      const timer = setTimeout(() => setGradeSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [gradeSuccess]);

  useEffect(() => {
    if (gradeError) {
      const timer = setTimeout(() => setGradeError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [gradeError]);

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

  const findExamById = (examsList = [], targetId) => {
    if (!examsList || !targetId) return null;
    const strId = String(targetId);
    for (const e of examsList) {
      if (String(e.id) === strId) return e;
      if (e.sub_tests && Array.isArray(e.sub_tests)) {
        const sub = e.sub_tests.find(st => String(st.id) === strId);
        if (sub) return sub;
      }
    }
    return null;
  };

  // Restore view state when navigating back from seating plan or sub-views (ONCE)
  useEffect(() => {
    if (!loading && location.state && !hasRestoredStateRef.current) {
      hasRestoredStateRef.current = true;
      if (location.state.activeView) {
        setActiveView(location.state.activeView);
      }
      if (location.state.examId && exams.length > 0) {
        const foundExam = findExamById(exams, location.state.examId);
        if (foundExam) {
          setSelectedExam(foundExam);
          if (location.state.classId) {
            setSelectedClassId(String(location.state.classId));
          }
          if (['classes', 'timetable', 'marks', 'reports'].includes(location.state.activeView || 'classes')) {
            schoolService.getExamClassStatuses(foundExam.id).then(statuses => {
              setExamClassStatuses(statuses || []);
            }).catch(console.error);
          }
        }
      }
      try {
        navigate(location.pathname, { replace: true, state: null });
      } catch {}
    }
  }, [loading, location.state, exams, navigate, location.pathname]);

  // Scroll to top when view changes
  useEffect(() => {
    window.scrollTo(0, 0);
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [activeView]);

  const hasReportCardTemplate = Boolean(schoolProfile?.report_card_template_id || schoolProfile?.report_card_template);
  const isCBSEClassic = (schoolProfile?.report_card_template?.code === 'cbse_classic');
  const isModernReport = (schoolProfile?.report_card_template?.code === 'modern');
  const isStandardTemplate = isCBSEClassic || isModernReport;

  // Quick Action counts
  const countableExams = isCBSEClassic ? exams.flatMap(e => e.sub_tests || []) : exams;
  const totalCount = countableExams.length;
  const upcomingCount = countableExams.filter(e => {
    const today = getTodayLocalDateString();
    return e.start_date && e.start_date > today;
  }).length;
  const ongoingCount = countableExams.filter(e => {
    const today = getTodayLocalDateString();
    return e.start_date && e.end_date && e.start_date <= today && e.end_date >= today;
  }).length;
  const publishedCount = countableExams.filter(e => String(e.status || '').toLowerCase() === 'published').length;
  const draftCount = countableExams.filter(e => String(e.status || '').toLowerCase() === 'draft').length;

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
      const [statuses, planDetails] = await Promise.all([
        schoolService.getExamClassStatuses(exam.id),
        schoolService.getSeatingPlan(exam.id).catch(() => null)
      ]);
      const sortedStatuses = sortAndDeduplicateClasses(statuses || []);
      setExamClassStatuses(sortedStatuses);
      setHasSeatingPlan(!!(planDetails && planDetails.plan));
      if (sortedStatuses && sortedStatuses.length > 0) {
        setSelectedClassId(sortedStatuses[0].id.toString());
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

  // Date Helper Utilities
  const addDays = (dateStr, days) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const subDays = (dateStr, days) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const getSubTestRank = (name = '') => {
    const lower = (name || '').toLowerCase();
    const match = lower.match(/(?:unit\s*test|ut|test|term)\s*(\d+)/i);
    if (match) {
      return parseInt(match[1]);
    }
    if (lower.includes('quarterly')) return 1;
    if (lower.includes('half')) return 2;
    if (lower.includes('annual')) return 3;
    return 99;
  };

  const getSubTestsForParent = (parentId, examsList = []) => {
    if (!parentId) return [];
    const parentExam = (examsList || []).find(e => Number(e.id) === Number(parentId));
    if (parentExam && Array.isArray(parentExam.sub_tests)) {
      return parentExam.sub_tests;
    }
    return (examsList || []).filter(e => Number(e.parent_id) === Number(parentId));
  };

  const getExamMinStartDate = (targetExamId, examsList = [], explicitParentId = null) => {
    let siblings = [];

    let parentId = explicitParentId;
    if (!parentId && targetExamId) {
      for (const ex of (examsList || [])) {
        if (Number(ex.id) === Number(targetExamId)) {
          parentId = ex.parent_id || null;
          break;
        }
        if (ex.sub_tests) {
          const foundSub = ex.sub_tests.find(s => Number(s.id) === Number(targetExamId));
          if (foundSub) {
            parentId = foundSub.parent_id || ex.id;
            break;
          }
        }
      }
    }

    if (parentId) {
      siblings = getSubTestsForParent(parentId, examsList);
    } else {
      siblings = (examsList || []).filter(e => !e.parent_id);
    }

    const sorted = [...siblings].sort((a, b) => {
      const rA = getSubTestRank(a.name);
      const rB = getSubTestRank(b.name);
      if (rA !== rB) return rA - rB;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    const targetIdx = targetExamId ? sorted.findIndex(e => Number(e.id) === Number(targetExamId)) : sorted.length;
    
    const preceding = sorted.filter((e, idx) => (targetIdx === -1 || idx < targetIdx) && Number(e.id) !== Number(targetExamId) && e.end_date);
    if (preceding.length === 0) return null;

    const latestEndDate = preceding.reduce((max, e) => (e.end_date > max ? e.end_date : max), '');
    if (!latestEndDate) return null;

    const dayAfter = addDays(latestEndDate, 1);
    return dayAfter;
  };

  const getExamMaxEndDate = (targetExamId, examsList = [], explicitParentId = null) => {
    let siblings = [];

    let parentId = explicitParentId;
    if (!parentId && targetExamId) {
      for (const ex of (examsList || [])) {
        if (Number(ex.id) === Number(targetExamId)) {
          parentId = ex.parent_id || null;
          break;
        }
        if (ex.sub_tests) {
          const foundSub = ex.sub_tests.find(s => Number(s.id) === Number(targetExamId));
          if (foundSub) {
            parentId = foundSub.parent_id || ex.id;
            break;
          }
        }
      }
    }

    if (parentId) {
      siblings = getSubTestsForParent(parentId, examsList);
    } else {
      siblings = (examsList || []).filter(e => !e.parent_id);
    }

    const sorted = [...siblings].sort((a, b) => {
      const rA = getSubTestRank(a.name);
      const rB = getSubTestRank(b.name);
      if (rA !== rB) return rA - rB;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    const targetIdx = targetExamId ? sorted.findIndex(e => Number(e.id) === Number(targetExamId)) : -1;
    if (targetIdx === -1) return null;

    const succeeding = sorted.filter((e, idx) => idx > targetIdx && Number(e.id) !== Number(targetExamId) && e.start_date);
    if (succeeding.length === 0) return null;

    const earliestNextStart = succeeding.reduce((min, e) => (!min || e.start_date < min ? e.start_date : min), '');
    return earliestNextStart ? subDays(earliestNextStart, 1) : null;
  };

  // Form Handlers
  const handleCreateExam = async (e) => {
    if (e) e.preventDefault();
    if (!newExam.name?.trim()) {
      setError('Please enter test/examination name.');
      return;
    }
    if (newExam.max_marks !== '' && newExam.max_marks !== null && newExam.max_marks !== undefined) {
      const maxMarksStr = String(newExam.max_marks).trim();
      if (maxMarksStr.includes('.') || !Number.isInteger(Number(maxMarksStr))) {
        setError('Max Marks must be a whole number. Decimal marks are not allowed.');
        return;
      }
      if (Number(maxMarksStr) <= 0) {
        setError('Max Marks must be greater than 0.');
        return;
      }
    }
    if (!newExam.start_date || !newExam.end_date) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    const minAllowedStart = getExamMinStartDate(null, exams, newExam.parent_id);
    if (newExam.start_date && newExam.start_date < minAllowedStart) {
      setError(`Start Date cannot be before ${formatDateString(minAllowedStart)} because previous test/examination is scheduled until ${formatDateString(subDays(minAllowedStart, 1))}.`);
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await schoolService.createExamination(newExam);
      setIsCreateOpen(false);
      setNewExam({ name: '', parent_id: null, max_marks: '', start_date: '', end_date: '', publish_date: '', description: '' });
      setSuccess(newExam.parent_id ? 'Test/Component added successfully.' : 'Terminal examination created successfully.');
      loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create examination.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditExamClick = (exam) => {
    setError('');
    setSelectedExamToEdit(exam);

    let cleanMaxMarks = '';
    if (exam.max_marks !== null && exam.max_marks !== undefined && String(exam.max_marks).trim() !== '') {
      cleanMaxMarks = String(Math.round(parseFloat(exam.max_marks)));
    }

    setEditExamData({
      id: exam.id,
      name: exam.name,
      parent_id: exam.parent_id !== undefined ? exam.parent_id : null,
      max_marks: cleanMaxMarks,
      start_date: exam.start_date || '',
      end_date: exam.end_date || '',
      publish_date: exam.publish_date || '',
      description: exam.description || '',
      status: exam.status || 'Draft'
    });
    setIsEditExamOpen(true);
  };

  const handlePublishMasterExam = async (exam, targetStatus) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await schoolService.updateExamination(exam.id, { status: targetStatus });
      setSuccess(targetStatus === 'Published' 
        ? `Examination '${exam.name}' published successfully! It is now visible in the Mobile Application for Teachers & Students.` 
        : `Examination '${exam.name}' reverted to Draft. It is now hidden from the Mobile Application.`
      );
      loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Failed to update examination status.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExam = async (e) => {
    if (e) e.preventDefault();
    if (!editExamData.name?.trim()) {
      setError('Please enter test/examination name.');
      return;
    }
    if (editExamData.max_marks !== '' && editExamData.max_marks !== null && editExamData.max_marks !== undefined) {
      const maxMarksStr = String(editExamData.max_marks).trim();
      if (maxMarksStr.includes('.') || !Number.isInteger(Number(maxMarksStr))) {
        setError('Max Marks must be a whole number. Decimal marks are not allowed.');
        return;
      }
      if (Number(maxMarksStr) <= 0) {
        setError('Max Marks must be greater than 0.');
        return;
      }
    }
    if (!editExamData.start_date || !editExamData.end_date) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    const minAllowedStart = getExamMinStartDate(editExamData.id, exams, editExamData.parent_id);
    if (editExamData.start_date && editExamData.start_date < minAllowedStart) {
      setError(`Start Date cannot be before ${formatDateString(minAllowedStart)} because previous test/examination is scheduled until ${formatDateString(subDays(minAllowedStart, 1))}.`);
      return;
    }
    const maxAllowedEnd = getExamMaxEndDate(editExamData.id, exams, editExamData.parent_id);
    if (editExamData.end_date && maxAllowedEnd && editExamData.end_date > maxAllowedEnd) {
      setError(`End Date cannot be after ${formatDateString(maxAllowedEnd)} because subsequent test/examination is scheduled to start on ${formatDateString(addDays(maxAllowedEnd, 1))}.`);
      return;
    }
    if (editExamData.start_date && editExamData.end_date && editExamData.end_date < editExamData.start_date) {
      setError('End Date cannot be before Start Date.');
      return;
    }
    if (editExamData.end_date && editExamData.publish_date && editExamData.publish_date < editExamData.end_date) {
      setError('Result Publish Date cannot be before End Date.');
      return;
    }

    // Check if dates have changed for this examination
    const datesChanged = selectedExamToEdit && (
      (editExamData.start_date && editExamData.start_date !== selectedExamToEdit.start_date) ||
      (editExamData.end_date && editExamData.end_date !== selectedExamToEdit.end_date)
    );

    if (datesChanged) {
      setIsEditExamOpen(false);
      setIsResetPapersConfirmOpen(true);
      return;
    }

    await executeExamUpdate(false);
  };

  const executeExamUpdate = async (shouldResetPapers = false) => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await schoolService.updateExamination(editExamData.id, {
        ...editExamData,
        reset_papers: shouldResetPapers
      });
      await loadDashboard();
      setIsEditExamOpen(false);
      setIsResetPapersConfirmOpen(false);
      setSuccess(
        shouldResetPapers 
          ? 'Examination dates updated successfully. Added papers and timetable scheme have been reset for new dates.' 
          : 'Examination updated successfully.'
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update examination.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExamPublishStatus = (exam) => {
    const isCurrentlyPublished = String(exam?.status || '').toLowerCase() === 'published';
    if (!isCurrentlyPublished) {
      const s = String(exam?.start_date || '').trim();
      const e = String(exam?.end_date || '').trim();
      if (!s || s === '-' || !e || e === '-') {
        setError('Start Date and End Date are required to publish an examination or test. Please edit and set dates first.');
        return;
      }
    }
    setTogglePublishTarget(exam);
    setShowTogglePublishModal(true);
  };

  const confirmToggleExamPublishStatus = async () => {
    if (!togglePublishTarget) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const isCurrentlyPublished = String(togglePublishTarget.status || '').toLowerCase() === 'published';
      const nextStatus = isCurrentlyPublished ? 'Draft' : 'Published';
      await schoolService.updateExamination(togglePublishTarget.id, {
        ...togglePublishTarget,
        status: nextStatus
      });
      setSuccess(nextStatus === 'Published' ? 'Examination published successfully.' : 'Examination moved to Draft successfully.');
      setShowTogglePublishModal(false);
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update examination status.');
    } finally {
      setSubmitting(false);
      setTogglePublishTarget(null);
    }
  };

  const handleDeleteExamClick = (exam) => {
    setDeleteExamTarget(exam);
    setDeleteStep('confirm');
    setDeleteOtp('');
    setDeleteOtpError('');
    setOtpMaskedEmail('');
    setIsDeleteExamConfirmOpen(true);
  };

  const handleRequestDeleteOtp = async () => {
    if (!deleteExamTarget) return;
    setRequestingOtp(true);
    setDeleteOtpError('');
    try {
      const res = await schoolService.requestExamDeleteOtp(deleteExamTarget.id);
      setOtpMaskedEmail(res.masked_email || res.data?.masked_email || 'registered email');
      setDeleteStep('otp');
      setDeleteOtp('');
      setOtpTimer(30);
    } catch (err) {
      console.error(err);
      setDeleteOtpError(err.response?.data?.message || err.message || 'Failed to send OTP to registered email.');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleResendDeleteOtp = async () => {
    if (otpTimer > 0 || requestingOtp || !deleteExamTarget) return;
    await handleRequestDeleteOtp();
  };

  const handleConfirmDeleteExamWithOtp = async (e) => {
    if (e) e.preventDefault();
    if (!deleteExamTarget || deleteOtp.trim().length !== 4) return;
    setSubmitting(true);
    setDeleteOtpError('');
    try {
      await schoolService.deleteExamination(deleteExamTarget.id, deleteOtp.trim());
      setSuccess(`${deleteExamTarget.parent_id === null ? 'Terminal Examination' : 'Test'} deleted successfully.`);
      setIsDeleteExamConfirmOpen(false);
      setDeleteExamTarget(null);
      setDeleteStep('confirm');
      setDeleteOtp('');
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setDeleteOtpError(err.response?.data?.message || err.message || 'Failed to verify OTP or delete examination.');
    } finally {
      setSubmitting(false);
    }
  };

  // Timetable Handlers
  const handleOpenTimetable = async (exam, classId) => {
    setError('');
    setInfo('');
    setSuccess('');
    const targetExam = exam || selectedExam;
    const targetClassId = classId || selectedClassId;
    if (!targetExam || !targetClassId) return;

    if (!targetExam.start_date || !targetExam.end_date) {
      setInfo('Please edit and configure the examination period (Start Date and End Date) before scheduling paper timetables.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSelectedExam(targetExam);
    setSelectedClassId(targetClassId.toString());
    setLoading(true);
    try {
      setEditingPaper(null);
      const [resList, insts] = await Promise.all([
        schoolService.getExamTimetable(targetExam.id, targetClassId),
        schoolService.getExamInstructions(targetExam.id, targetClassId).catch(() => [])
      ]);
      const list = Array.isArray(resList) ? resList : (resList?.papers || resList?.data || []);
      setTimetablePapers(list);
      setInstructions((insts || []).map(i => i.instruction) || []);
      const examMaxMarks = parseFloat(targetExam.max_marks) || 30;
      const examPassMarks = Math.ceil(examMaxMarks * 0.33);

      setNewPaper({
        subject_id: '',
        exam_date: suggestNextExamDate(targetExam, list, holidays),
        start_time: '09:00',
        end_time: '11:00',
        max_marks: String(examMaxMarks),
        passing_marks: String(examPassMarks),
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

    const isGradeType = newPaper.evaluation_type === 'grade';
    const maxMarksParsed = isGradeType ? 0 : parseFloat(newPaper.max_marks);
    const passingMarksParsed = isGradeType ? 0 : parseFloat(newPaper.passing_marks);

    if (!isGradeType) {
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
    }

    // Duplicate subject check
    const isDuplicateSubject = timetablePapers.some(p => {
      // If editing, allow the same subject id as the one being edited
      if (editingPaper && parseInt(p.subject_id) === parseInt(editingPaper.subject_id)) {
        return false;
      }
      return parseInt(p.subject_id) === parseInt(newPaper.subject_id);
    });

    if (isDuplicateSubject) {
      setError('This subject is already scheduled for this exam.');
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
            evaluation_type: newPaper.evaluation_type || 'marks',
            grading_scale: newPaper.grading_scale || 'A,B,C,D,E',
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
        evaluation_type: newPaper.evaluation_type || 'marks',
        grading_scale: newPaper.grading_scale || 'A,B,C,D,E',
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
      const examMaxMarks = parseFloat(selectedExam?.max_marks) || 30;
      const examPassMarks = Math.ceil(examMaxMarks * 0.33);

      setNewPaper({
        subject_id: '',
        exam_date: suggestNextExamDate(selectedExam, refreshedList || [], holidays),
        start_time: newPaper.start_time || '09:00',
        end_time: newPaper.end_time || '11:00',
        evaluation_type: 'marks',
        grading_scale: 'A,B,C,D,E',
        max_marks: String(examMaxMarks),
        passing_marks: String(examPassMarks),
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

  const handleDownloadSchemeClick = async () => {
    if (!selectedExam) return;
    setIsSchemeOpen(true);
    setLoadingSchemes(true);
    try {
      const res = await schoolService.getAllExamSchemes(selectedExam.id);
      setAllSchemesData(res.data || res);
    } catch (err) {
      console.error('Failed to load all class schemes:', err);
      setError(err.message || 'Failed to load examination schemes.');
    } finally {
      setLoadingSchemes(false);
    }
  };

  const triggerDownloadPdf = (e) => {
    if (e) e.preventDefault();
    const element = document.getElementById('printable-scheme');
    if (!element) return;

    setSubmitting(true);
    const examName = selectedExam?.name || 'Examination';
    const ayName = allSchemesData?.exam?.academic_year_name || '';
    const filenameStr = `${examName}_Examination_Scheme_${ayName}`.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') + '.pdf';

    schoolAdminService.logClientAudit({
      module: 'Examinations',
      action: 'Scheme Downloaded',
      description: `Exam scheme downloaded as PDF for ${examName} (All Classes)`
    }).catch(console.error);

    const opt = {
      margin: 8,
      filename: filenameStr,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0, scrollX: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'avoid-all'], avoid: '.class-scheme-section' }
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

    schoolAdminService.logClientAudit({
      module: 'Examinations',
      action: 'Scheme Printed',
      description: `Exam scheme printed for ${selectedExam?.name} (All Classes)`
    }).catch(console.error);

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
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${selectedExam?.name || 'Examination'} Scheme</title>
          <link rel="stylesheet" href="${window.location.origin}/src/index.css" />
          <style>
            @media print {
              @page {
                size: landscape !important;
                margin: 8mm !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .class-scheme-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 15px; }
            .class-scheme-section { page-break-inside: avoid; break-inside: avoid; }
          </style>
        </head>
        <body>
          ${printElement.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
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
      const targetExam = exam || selectedExam;
      const targetClassId = classId || selectedClassId;
      if (!targetExam || !targetClassId) {
        setError('Please select an examination and a class first.');
        setLoading(false);
        return;
      }

      const res = await schoolService.getExamTimetable(targetExam.id, targetClassId);
      const papers = Array.isArray(res) ? res : (res?.papers || res?.data || []);
      
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('marks_entry_empty_timetable');
        setShowPendingAlert(true);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setTimetablePapers(papers);
      setSelectedExam(targetExam);
      setSelectedClassId(targetClassId.toString());
      setPendingSubjects([]);
      setShowPendingAlert(false);
      setPendingValidationSource('');

      const firstSubId = String(papers[0]?.subject_id ?? papers[0]?.id ?? '');
      setSelectedSubjectId(firstSubId);
      if (firstSubId) {
        await loadMarksSheet(targetExam.id, targetClassId, firstSubId);
      }
      setActiveView('marks');
    } catch (err) {
      console.error('Error opening marks entry:', err);
      setError(err?.message || 'Failed to load marks entry context.');
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
    const subId = (typeof e === 'object' && e?.target) ? e.target.value : String(e || '');
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
          const currentPaper = timetablePapers.find(p => p.subject_id.toString() === selectedSubjectId);
          const isGradeSheet = marksSheet.evaluation_type === 'grade' || parseFloat(marksSheet.max_marks) === 0 || currentPaper?.evaluation_type === 'grade';

          if (isGradeSheet) {
            const rawVal = value ? value.toString().trim().toUpperCase() : '';
            const validGrades = ['A+', 'A', 'B', 'C', 'D', 'E', 'ABSENT', ''];
            if (!validGrades.includes(rawVal)) {
              setError(`Invalid Grade entry. Please select a valid grade option (A+, A, B, C, D, E).`);
              setTimeout(() => setError(''), 4000);
              isInvalid = true;
              return s;
            }
            val = rawVal;
          } else {
            if (value === '') {
              val = '';
            } else {
              const sanitized = value.replace(/\D/g, '');
              if (sanitized === '') {
                setError('Invalid entry. Only numerical marks are allowed for this subject.');
                setTimeout(() => setError(''), 4000);
                isInvalid = true;
                return s;
              }
              const parsed = parseInt(sanitized, 10);
              if (parsed > marksSheet.max_marks) {
                setError(`Marks obtained cannot exceed maximum marks (${marksSheet.max_marks}).`);
                setTimeout(() => setError(''), 4000);
                isInvalid = true;
                return s;
              }
              val = parsed.toString();
            }
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
      const targetExam = exam || selectedExam;
      const targetClassId = classId || selectedClassId;
      if (!targetExam || !targetClassId) {
        setError('Please select an examination and a class first.');
        setLoading(false);
        return;
      }

      const resTimetable = await schoolService.getExamTimetable(targetExam.id, targetClassId);
      const papers = Array.isArray(resTimetable) ? resTimetable : (resTimetable?.papers || resTimetable?.data || []);
      
      // Step 1: Check papers exists
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('reports_empty_timetable');
        setShowPendingAlert(true);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setSelectedExam(targetExam);
      setSelectedClassId(targetClassId.toString());
      setPendingSubjects([]);
      setShowPendingAlert(false);
      setPendingValidationSource('');

      const resReports = await schoolService.getReportCards(targetExam.id, targetClassId);
      const reports = Array.isArray(resReports) ? resReports : (resReports?.report_cards || resReports?.reports || resReports?.data || []);
      setReportCards(reports);
      setActiveView('reports');
    } catch (err) {
      console.error('Error opening report cards:', err);
      setError('Failed to load report cards.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFinalSessionReportCards = async (classId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      setSelectedClassId(classId.toString());
      
      // Fetch all examinations for school
      const allExamsList = (exams && exams.length > 0) ? exams : await schoolService.getExaminations();
      
      let sessionCards = [];
      if (isCBSEClassic) {
        const topExam = allExamsList.find(e => !e.parent_id && e.template_code === 'cbse_classic')
                     || allExamsList.find(e => !e.parent_id && (e.name?.toLowerCase().includes('term') || e.name?.toLowerCase().includes('terminal')))
                     || allExamsList.find(e => !e.parent_id) 
                     || allExamsList[0];
        if (topExam) {
          const rawCards = await schoolService.getReportCards(topExam.id, classId);
          const cardsArray = Array.isArray(rawCards) ? rawCards : (rawCards ? [rawCards] : []);
          sessionCards = cardsArray.map(c => compileReportCardData(c, schoolProfile, currentAcademicYear, topExam, gradeScales));
        }
      }

      if (!sessionCards || sessionCards.length === 0) {
        // Fetch report cards from all exams for this class
        const allStudentCards = [];
        for (const ex of allExamsList) {
          try {
            const reports = await schoolService.getReportCards(ex.id, classId);
            if (Array.isArray(reports)) {
              reports.forEach(r => allStudentCards.push({ ...r, exam_name: ex.name }));
            }
          } catch {}
        }

        if (allStudentCards.length === 0) {
          setError('No exam report cards found for this class. Make sure marks are entered for session exams first.');
          setLoading(false);
          return;
        }

        // Group cards by student_id
        const studentMap = {};
        allStudentCards.forEach(card => {
          const sId = card.student_id;
          if (!studentMap[sId]) studentMap[sId] = [];
          studentMap[sId].push(card);
        });

        // Compile Final Session Report Cards for each student
        sessionCards = Object.values(studentMap).map(cardsArray => 
          compileFinalSessionReportCardData(cardsArray, weightagePolicy, schoolProfile, currentAcademicYear)
        ).filter(Boolean);
      }

      // Sort session cards by Percentage DESC (highest cumulative percentage first)
      sessionCards.sort((a, b) => {
        const pctA = parseFloat(a.summary?.percentage || 0);
        const pctB = parseFloat(b.summary?.percentage || 0);
        if (Math.abs(pctB - pctA) > 0.001) {
          return pctB - pctA;
        }
        const attA = parseFloat(a.summary?.attendance?.attendance_rate || 0);
        const attB = parseFloat(b.summary?.attendance?.attendance_rate || 0);
        if (Math.abs(attB - attA) > 0.001) {
          return attB - attA;
        }
        return (a.student?.name || '').localeCompare(b.student?.name || '');
      });

      // Reassign sequential ranks 1, 2, 3... matching cumulative performance
      const totalClassStudents = sessionCards.length;
      let currentRank = 1;
      let prevPct = null;
      let prevAtt = null;

      sessionCards.forEach((card, idx) => {
        const curPct = parseFloat(card.summary?.percentage || 0);
        const curAtt = parseFloat(card.summary?.attendance?.attendance_rate || 0);

        if (prevPct !== null) {
          const isTie = Math.abs(curPct - prevPct) < 0.001 && Math.abs(curAtt - prevAtt) < 0.001;
          if (!isTie) {
            currentRank = idx + 1;
          }
        }
        card.summary.class_rank = `${currentRank} of ${totalClassStudents}`;
        card.summary.section_rank = `${currentRank} of ${totalClassStudents}`;
        prevPct = curPct;
        prevAtt = curAtt;
      });

      setFinalSessionReportCards(sessionCards);
      setActiveView('final_reports');
    } catch (err) {
      console.error(err);
      setError('Failed to aggregate Final Session Report Cards.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishSchemeClick = () => {
    setError('');
    setSuccess('');
    if (!timetablePapers || timetablePapers.length === 0) {
      setError('Please add at least one exam paper before publishing.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setShowPublishSchemeModal(true);
  };

  const confirmPublishScheme = async () => {
    setSubmittingPublishScheme(true);
    setError('');
    setSuccess('');
    try {
      await schoolService.publishExamScheme(selectedExam.id, parseInt(selectedClassId));
      setSuccess('Examination Scheme Published Successfully.');
      setShowPublishSchemeModal(false);
      
      // Reload class statuses
      const statuses = await schoolService.getExamClassStatuses(selectedExam.id);
      setExamClassStatuses(statuses || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish examination scheme.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmittingPublishScheme(false);
    }
  };

  const handleUnpublishSchemeClick = () => {
    setError('');
    setSuccess('');
    setShowUnpublishSchemeModal(true);
  };

  const confirmUnpublishScheme = async () => {
    setSubmittingUnpublishScheme(true);
    setError('');
    setSuccess('');
    try {
      await schoolService.unpublishExamScheme(selectedExam.id, parseInt(selectedClassId));
      setSuccess('Examination Scheme Reverted to Draft Successfully.');
      setShowUnpublishSchemeModal(false);
      
      // Reload class statuses
      const statuses = await schoolService.getExamClassStatuses(selectedExam.id);
      setExamClassStatuses(statuses || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revert examination scheme.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmittingUnpublishScheme(false);
    }
  };

  const handleOpenSingleReportCard = (card) => {
    try {
      window.history.pushState({ view: 'report_card' }, '');
    } catch {}
    setSelectedReportCard(card);
    setIsReportCardOpen(true);
  };

  const handleCloseReportCardView = () => {
    setSelectedReportCard(null);
    setIsReportCardOpen(false);
    if (window.history.state?.view === 'report_card') {
      window.history.back();
    }
  };

  const printNativeReportCardsContainer = async (elementId, documentTitle = 'Report Card') => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const targetElement = document.getElementById(elementId);
    if (!targetElement) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();

    const styleTags = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentTitle}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 5mm;
            }
            html, body {
              background-color: white !important;
              color: #18181b !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            }
            .no-print {
              display: none !important;
            }
            .id-card-report-wrapper, .single-page-report-container {
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: always !important;
              break-after: page !important;
              max-height: 280mm !important;
              overflow: visible !important;
              margin: 0 auto !important;
            }
            .report-card-page-break {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              max-height: 280mm !important;
              overflow: visible !important;
              margin: 0 auto !important;
            }
            .report-card-page-break:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
          </style>
        </head>
        <body>
          ${targetElement.innerHTML}
        </body>
      </html>
    `;

    doc.write(printContent);
    doc.close();

    if (iframe.contentWindow.document.fonts && iframe.contentWindow.document.fonts.ready) {
      await iframe.contentWindow.document.fonts.ready;
    }

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  };

  const handleDownloadSingleReportCardPdf = async (card) => {
    if (!card) return;
    const classNameClean = (card.student?.class_name || card.class_name || selectedClass?.name || 'Class').toString().replace(/\s+/g, '_');
    const studentNameClean = (card.student?.name || card.student_name || card.name || 'Student').toString().replace(/\s+/g, '_');
    const sessionClean = (currentAcademicYear?.name || '2026-2027').replace(/[\s–—]+/g, '-');
    const filename = `Final_Report_Card_${classNameClean}_${studentNameClean}_${sessionClean}`;

    await printNativeReportCardsContainer('printable-single-report-card', filename);
  };

  const sortCardsByRollNo = (cardsList = []) => {
    return [...cardsList].sort((a, b) => {
      const getRollNo = (c) => {
        if (!c) return Infinity;
        const raw = c.student?.roll_no ?? 
                    c.student?.roll_number ?? 
                    c.roll_no ?? 
                    c.roll_number ?? 
                    c.student_roll_no ?? 
                    c.student_roll_number ?? '';
        if (raw === null || raw === undefined || raw === '') return Infinity;
        const parsed = parseInt(String(raw).trim(), 10);
        return isNaN(parsed) ? String(raw).trim() : parsed;
      };

      const valA = getRollNo(a);
      const valB = getRollNo(b);

      if (typeof valA === 'number' && typeof valB === 'number') {
        if (valA !== valB) return valA - valB;
      } else if (typeof valA === 'number') {
        return -1;
      } else if (typeof valB === 'number') {
        return 1;
      } else {
        const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }

      const nameA = (a.student?.name || a.student_name || a.name || '').toLowerCase();
      const nameB = (b.student?.name || b.student_name || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  const handleDownloadAllClassReportCards = async () => {
    try {
      setGeneratingClassPdf(true);
      setError('');

      // Step 1: Resolve Target Class ID & Exam ID
      const targetClassId = selectedClassId || 
                            selectedReportCard?.class_id || 
                            selectedReportCard?.student?.class_id || 
                            selectedReportCard?.student?.class?.id;
      
      const targetExamId = selectedExam?.id || 
                           selectedReportCard?.exam_id || 
                           selectedReportCard?.exam?.id;

      const isFinalSession = selectedReportCard?.is_final_session_report || activeView === 'final_reports';

      let cardsToPrint = [];

      // Step 2: Fetch report cards if empty in React state
      if (isFinalSession) {
        if (finalSessionReportCards && finalSessionReportCards.length > 0) {
          cardsToPrint = finalSessionReportCards;
        } else if (targetClassId) {
          const allExamsList = (exams && exams.length > 0) ? exams : await schoolService.getExaminations();
          const allStudentCards = [];
          for (const ex of allExamsList) {
            try {
              const reports = await schoolService.getReportCards(ex.id, targetClassId);
              if (Array.isArray(reports)) {
                reports.forEach(r => allStudentCards.push({ ...r, exam_name: ex.name }));
              }
            } catch {}
          }
          if (allStudentCards.length > 0) {
            const studentMap = {};
            allStudentCards.forEach(card => {
              const sId = card.student_id;
              if (!studentMap[sId]) studentMap[sId] = [];
              studentMap[sId].push(card);
            });
            cardsToPrint = Object.values(studentMap).map(cardsArray => 
              compileFinalSessionReportCardData(cardsArray, weightagePolicy, schoolProfile, currentAcademicYear)
            ).filter(Boolean);
            setFinalSessionReportCards(cardsToPrint);
          }
        }
      } else {
        if (reportCards && reportCards.length > 0) {
          cardsToPrint = reportCards;
        } else if (targetExamId && targetClassId) {
          const fetched = await schoolService.getReportCards(targetExamId, parseInt(targetClassId));
          cardsToPrint = fetched || [];
          setReportCards(cardsToPrint);
        }
      }

      // Fallback: If still empty, use [selectedReportCard]
      if ((!cardsToPrint || cardsToPrint.length === 0) && selectedReportCard) {
        cardsToPrint = [selectedReportCard];
      }

      if (!cardsToPrint || cardsToPrint.length === 0) {
        setError('No report cards available for this class.');
        setGeneratingClassPdf(false);
        return;
      }

      // Step 3: Sort by Roll Number Ascending
      const sortedCards = sortCardsByRollNo(cardsToPrint);
      setAllClassSortedCards(sortedCards);

      // Step 4: Allow React state to flush and mount #printable-all-class-report-cards into DOM
      await new Promise(resolve => setTimeout(resolve, 350));

      const targetClass = classes.find(c => c.id?.toString() === targetClassId?.toString());
      const classNameClean = (targetClass?.name || selectedClass?.name || 'Class').toString().replace(/\s+/g, '_');
      const sessionClean = (currentAcademicYear?.name || '2026-2027').replace(/[\s–—]+/g, '-');
      const filename = `Class_${classNameClean}_All_Report_Cards_${sessionClean}`;

      const printElement = document.getElementById('printable-all-class-report-cards');
      if (!printElement) {
        throw new Error('Printable element #printable-all-class-report-cards not found in DOM.');
      }

      // Step 5: Render vector printable PDF container
      await printNativeReportCardsContainer('printable-all-class-report-cards', filename);
    } catch (err) {
      console.error('Failed to generate all report cards PDF:', err);
      setError('Failed to generate all report cards PDF.');
    } finally {
      setGeneratingClassPdf(false);
    }
  };

  const handleDownloadEntireClassPdf = handleDownloadAllClassReportCards;

  const handlePublishClassResults = async (exam, classId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const targetExam = exam || selectedExam;
      const targetClassId = classId || selectedClassId;
      if (!targetExam || !targetClassId) return;

      const res = await schoolService.getExamTimetable(targetExam.id, targetClassId);
      const papers = Array.isArray(res) ? res : (res?.papers || res?.data || []);
      
      // Step 1: Check papers exists
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('publish_empty_timetable');
        setShowPendingAlert(true);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Step 2: Check pending marks
      const pending = papers.filter(p => !p.marks_completed);
      if (pending.length > 0) {
        setPendingSubjects(pending.map(p => p.subject_name));
        setPendingValidationSource('publish_pending_marks');
        setShowPendingAlert(true);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setPendingSubjects([]);
      setShowPendingAlert(false);
      setPendingValidationSource('');
      setPublishTarget({ exam: targetExam, classId: targetClassId });
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
      
      const updatedExams = await schoolService.getExaminations();
      if (updatedExams) setExams(updatedExams);
      const freshExam = updatedExams?.find(e => e.id === publishTarget.exam.id);
      if (freshExam) setSelectedExam(freshExam);

      if (activeView === 'classes') {
        await handleOpenClassWorkspace(freshExam || publishTarget.exam);
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
    const targetExam = exam || selectedExam;
    const targetClassId = classId || selectedClassId;
    setUnpublishTarget({ exam: targetExam, classId: targetClassId });
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

      const updatedExams = await schoolService.getExaminations();
      if (updatedExams) setExams(updatedExams);
      const freshExam = updatedExams?.find(e => e.id === unpublishTarget.exam.id);
      if (freshExam) setSelectedExam(freshExam);

      if (activeView === 'classes') {
        await handleOpenClassWorkspace(freshExam || unpublishTarget.exam);
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

  if (loading && activeView === 'dashboard') {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-primary uppercase tracking-wider">LOADING EXAMINATIONS...</p>
        </div>
      </div>
    );
  }

  const today = getTodayLocalDateString();
  const getExamRank = (name = '') => {
    const lower = name.toLowerCase();
    if (lower.includes('quarterly')) return 1;
    if (lower.includes('half')) return 2;
    if (lower.includes('annual')) return 3;
    return 4;
  };

  const filteredExams = exams.filter(e => {
    if (activeFilter === 'total') return true;
    if (isCBSEClassic) {
      const sub = e.sub_tests || [];
      if (activeFilter === 'upcoming') return sub.some(st => st.start_date && st.start_date > today);
      if (activeFilter === 'ongoing') return sub.some(st => st.start_date && st.end_date && st.start_date <= today && st.end_date >= today);
      if (activeFilter === 'draft') return sub.some(st => String(st.status || '').toLowerCase() === 'draft');
      if (activeFilter === 'published') return sub.some(st => String(st.status || '').toLowerCase() === 'published');
      return true;
    }
    if (activeFilter === 'upcoming') return e.start_date && e.start_date > today;
    if (activeFilter === 'ongoing') return e.start_date && e.end_date && e.start_date <= today && e.end_date >= today;
    if (activeFilter === 'draft') return String(e.status || '').toLowerCase() === 'draft';
    if (activeFilter === 'published') return String(e.status || '').toLowerCase() === 'published';
    return true;
  }).sort((a, b) => getExamRank(a.name) - getExamRank(b.name) || (a.id - b.id));

  const filteredClassSubjects = subjects;

  const classSubjects = subjects;
  const totalSubjectsCount = classSubjects.length;
  const scheduledCount = timetablePapers.length;
  const pendingSubjectsCount = Math.max(0, totalSubjectsCount - scheduledCount);
  const allSubjectsScheduled = totalSubjectsCount > 0 && scheduledCount === totalSubjectsCount;

  // Full Page Dedicated View for Individual Student Report Card
  if (selectedReportCard) {
    const selectedClass = classes.find(c => c.id.toString() === selectedClassId?.toString());
    const studentName = selectedReportCard.student_name || selectedReportCard.student?.name || 'Student';
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Print Styles Overrides */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              size: portrait !important;
              margin: 5mm !important;
            }
            body {
              background-color: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print, header, sidebar, nav, button, .sticky {
              display: none !important;
            }
            .id-card-report-wrapper, .single-page-report-container {
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: always !important;
              break-after: page !important;
              max-height: 280mm !important;
              overflow: visible !important;
              margin: 0 auto !important;
            }
          }
        `}} />

        {/* Top Sticky Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border p-4 rounded-xl shadow-xs sticky top-16 z-20 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCloseReportCardView}
              className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
            >
              Back
            </button>
            <div>
              <h2 className="text-base font-bold text-text-primary font-display">
                Report Card: {studentName}
              </h2>
              <p className="text-[11px] text-text-muted">
                {selectedExam?.name || 'Final Academic Session Report Card'} {selectedClass ? `— Class ${selectedClass.name} (${selectedClass.section || ''})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleDownloadAllClassReportCards}
              disabled={generatingClassPdf}
              className="flex items-center gap-2 text-xs font-bold"
            >
              {generatingClassPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download all report cards
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownloadSingleReportCardPdf(selectedReportCard)}
              className="flex items-center gap-2 text-xs font-bold border-border bg-background hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseReportCardView}
              className="text-xs font-bold"
            >
              Close Full View
            </Button>
          </div>
        </div>

        {/* Full Page Report Document Render Container */}
        <div className="w-full py-8 bg-zinc-200 dark:bg-zinc-900 rounded-2xl flex justify-center items-start shadow-inner overflow-x-auto min-h-[calc(100vh-160px)]">
          <div id="printable-single-report-card" className="shadow-2xl bg-white rounded-2xl overflow-hidden border border-zinc-300">
            <ReportCardRenderer
              card={selectedReportCard}
              schoolProfile={schoolProfile}
              currentYear={currentAcademicYear}
              exam={selectedExam || { name: 'FINAL ACADEMIC REPORT CARD', is_final_session_report: true }}
            />
          </div>
        </div>

        {/* Hidden Multi-Page Printable Container for All Class Report Cards */}
        <div className="sr-only opacity-0 pointer-events-none fixed -left-[9999px] -top-[9999px]">
          <div id="printable-all-class-report-cards" className="w-[194mm]">
            {(allClassSortedCards.length > 0
              ? allClassSortedCards
              : sortCardsByRollNo(finalSessionReportCards.length > 0 ? finalSessionReportCards : (reportCards.length > 0 ? reportCards : [selectedReportCard]))
            ).map((card, idx) => (
              <div
                key={card.student_id || card.student?.id || idx}
                className="report-card-page-break bg-white mb-4"
                style={{
                  pageBreakAfter: 'always',
                  breakAfter: 'page',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  maxHeight: '280mm',
                  overflow: 'hidden'
                }}
              >
                <ReportCardRenderer
                  card={card}
                  schoolProfile={schoolProfile}
                  currentYear={currentAcademicYear}
                  exam={card.is_final_session_report ? { name: 'FINAL ACADEMIC REPORT CARD', is_final_session_report: true } : (selectedExam || { name: card.exam_name || 'EXAMINATION REPORT CARD' })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isExamRequiredView = ['classes', 'timetable', 'marks', 'reports'].includes(activeView);
  const effectiveActiveView = (isExamRequiredView && !selectedExam) ? 'dashboard' : activeView;

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
      <div className="p-5 rounded-2xl border border-border bg-zinc-50/50 dark:bg-zinc-900/50 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight font-display uppercase">Examinations</h2>
          <p className="text-text-secondary text-xs mt-1 font-medium">Configure exams, manage timetables, enter marks, and generate student report cards.</p>
        </div>
        {effectiveActiveView === 'dashboard' && hasReportCardTemplate && (
          <div className="flex flex-wrap gap-2 items-center">
            {!isReadOnly && !isStandardTemplate && (
              <Button 
                className="flex items-center gap-2 font-bold bg-primary text-white text-xs h-10 px-4" 
                onClick={() => {
                  setNewExam({ name: '', parent_id: null, max_marks: '', start_date: '', end_date: '', publish_date: '', description: '' });
                  setIsCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Terminal Examination
              </Button>
            )}
            <Button 
              className="flex items-center gap-2 font-bold text-xs h-10 px-4" 
              onClick={() => setIsSelectClassForFinalReportOpen(true)}
            >
              <Award className="h-4 w-4" /> Final Academic Report Card
            </Button>
            <Button className="flex items-center gap-2 font-bold text-xs h-10 px-4" onClick={() => { setActiveView('grade_scale'); setGradeError(''); setGradeSuccess(''); }}>
              Grade Configuration Scale
            </Button>
          </div>
        )}
      </div>

      {/* Global alert bar */}
      {(error || info || success) && (
        <div className="no-print space-y-2">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          {info && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" /> {info}
            </div>
          )}
          {success && (
            <div className="p-3.5 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" /> {success}
            </div>
          )}
        </div>
      )}

      {/* NO REPORT CARD TEMPLATE ASSIGNED NOTICE */}
      {!loading && !hasReportCardTemplate && (
        <Card className="p-8 sm:p-12 text-center flex flex-col items-center justify-center border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl space-y-4 no-print my-6">
          <div className="h-16 w-16 bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1.5 max-w-lg">
            <h3 className="text-xl font-bold text-text-primary font-display">
              No report card template assigned. Please contact ShikshaPilot Teams
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              A report card template must be assigned by Super Admin before you can schedule examinations, manage timetables, enter marks, or generate student report cards.
            </p>
          </div>
          <Button 
            onClick={() => setIsContactModalOpen(true)}
            className="font-bold flex items-center gap-2 px-6 mt-2"
          >
            <Phone className="h-4 w-4" />
            Contact
          </Button>
        </Card>
      )}

      {/* VIEW 1: DASHBOARD */}
      {hasReportCardTemplate && effectiveActiveView === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { id: 'total', label: 'Total Exams', value: totalCount, color: 'text-zinc-800 dark:text-zinc-200' },
              { id: 'upcoming', label: 'Upcoming', value: upcomingCount, color: 'text-primary' },
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
                    <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{c.label}</p>
                    <p className={`text-3xl font-bold mt-1 font-display ${c.color}`}>{c.value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Exams List Card */}
          {isCBSEClassic ? (
            <div className="space-y-6">
              {filteredExams.length === 0 ? (
                <Card className="p-10 text-center text-text-muted border-dashed">
                  <p className="font-semibold text-sm">No terminal examinations created yet.</p>
                  <p className="text-xs mt-1">Click <strong>"+ Add Terminal Examination"</strong> to create your first terminal (e.g. First Terminal Examination Progress).</p>
                </Card>
              ) : (
                filteredExams.map(term => (
                  <Card key={term.id} className="border border-border shadow-sm overflow-hidden">
                    <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-text-primary uppercase tracking-wide flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          {term.name}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isReadOnly && !isCBSEClassic && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            className="text-xs font-bold flex items-center gap-1.5"
                            onClick={() => {
                              setNewExam({
                                name: '',
                                parent_id: term.id,
                                max_marks: '',
                                start_date: '',
                                end_date: '',
                                publish_date: '',
                                description: ''
                              });
                              setIsCreateOpen(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Test
                          </Button>
                        )}
                        {!isReadOnly && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownItem onClick={() => handleEditExamClick(term)}>
                                Edit Terminal
                              </DropdownItem>
                              {!isCBSEClassic && (
                                <DropdownItem 
                                  className="text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  onClick={() => handleDeleteExamClick(term)}
                                >
                                  Delete Terminal
                                </DropdownItem>
                              )}
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {(!term.sub_tests || term.sub_tests.length === 0) ? (
                        <div className="p-6 text-center text-xs text-text-muted">
                          No sub-tests/components added under this terminal yet. Click <strong>"+ Add Test"</strong> to add tests (e.g. Unit Test 1, Sub-Enrichment, Term Exam).
                        </div>
                      ) : (
                        <Table containerClassName="border-0 rounded-none shadow-none bg-transparent">
                          <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border">
                            <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                              <TableHead className="w-1/3 whitespace-nowrap text-xs uppercase font-bold text-text-secondary">Test Name</TableHead>
                              <TableHead className="whitespace-nowrap text-xs uppercase font-bold text-text-secondary">Max Marks</TableHead>
                              <TableHead className="whitespace-nowrap text-xs uppercase font-bold text-text-secondary">Start Date</TableHead>
                              <TableHead className="whitespace-nowrap text-xs uppercase font-bold text-text-secondary">End Date</TableHead>
                              <TableHead className="whitespace-nowrap text-xs uppercase font-bold text-text-secondary">Status</TableHead>
                              <TableHead className="text-right whitespace-nowrap text-xs uppercase font-bold text-text-secondary">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {term.sub_tests.map(st => (
                              <TableRow 
                                key={st.id} 
                                className="group cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors"
                                onClick={() => handleOpenClassWorkspace(st)}
                              >
                                <TableCell className="font-bold text-text-primary whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 pl-2 border-l-2 border-primary">
                                    {st.name}
                                    <ChevronRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                  {st.max_marks ? `${Math.round(parseFloat(st.max_marks))} Marks` : '—'}
                                </TableCell>
                                <TableCell className="text-xs font-mono text-text-muted whitespace-nowrap">{formatDateString(st.start_date)}</TableCell>
                                <TableCell className="text-xs font-mono text-text-muted whitespace-nowrap">{formatDateString(st.end_date)}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <span 
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase cursor-pointer hover:opacity-80 transition-opacity ${
                                      String(st?.status || '').toLowerCase() === 'published' ? 'bg-green-500/10 text-green-600' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleExamPublishStatus(st);
                                    }}
                                  >
                                    {st.status || 'Draft'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  <div onClick={(evt) => evt.stopPropagation()} className="flex items-center justify-end gap-2">
                                    {!isReadOnly && (
                                      <DropdownMenu>
                                        <DropdownItem onClick={() => handleEditExamClick(st)}>
                                          Edit Test
                                        </DropdownItem>
                                        {String(st?.status || '').toLowerCase() === 'published' ? (
                                          <DropdownItem onClick={() => handleToggleExamPublishStatus(st)} className="text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                            Move to Draft
                                          </DropdownItem>
                                        ) : (
                                          (st?.start_date && st?.end_date && String(st.start_date).trim() !== '' && String(st.start_date).trim() !== '-' && String(st.end_date).trim() !== '' && String(st.end_date).trim() !== '-') && (
                                            <DropdownItem onClick={() => handleToggleExamPublishStatus(st)} className="text-emerald-600 font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                                              Publish Test
                                            </DropdownItem>
                                          )
                                        )}
                                        {!isCBSEClassic && (
                                          <DropdownItem 
                                            className="text-rose-600 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                            onClick={() => handleDeleteExamClick(st)}
                                          >
                                            Delete Test
                                          </DropdownItem>
                                        )}
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
                <CardTitle className="text-sm font-bold text-text-primary">Scheduled Examinations</CardTitle>
              </CardHeader>
              <Table containerClassName="border-0 rounded-none shadow-none bg-transparent">
                <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border">
                  <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-text-muted">
                        No examinations found matching the active filter.
                      </TableCell>
                    </TableRow>
                  ) : filteredExams.map(e => (
                    <TableRow 
                      key={e.id} 
                      className="group cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors"
                      onClick={() => handleOpenClassWorkspace(e)}
                    >
                      <TableCell className="font-semibold text-text-primary">
                        <div className="flex items-center gap-1">
                          {e.name} <ChevronRight className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-text-muted">{formatDateString(e.start_date)}</TableCell>
                      <TableCell className="text-xs font-mono text-text-muted">{formatDateString(e.end_date)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          String(e.status || '').toLowerCase() === 'published' ? 'bg-green-500/10 text-green-600' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                        }`}>
                          {e.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div onClick={(evt) => evt.stopPropagation()}>
                          <DropdownMenu>
                            {!isReadOnly && (
                              <DropdownItem onClick={() => handleEditExamClick(e)}>
                                Edit Examination
                              </DropdownItem>
                            )}
                            {String(e.status || '').toLowerCase() === 'published' ? (
                              <DropdownItem onClick={() => handlePublishMasterExam(e, 'Draft')} className="text-rose-600 font-semibold hover:bg-rose-50">
                                Revert to Draft
                              </DropdownItem>
                            ) : (
                              (e.start_date && e.end_date && String(e.start_date).trim() !== '' && String(e.start_date).trim() !== '-' && String(e.end_date).trim() !== '' && String(e.end_date).trim() !== '-') && (
                                <DropdownItem onClick={() => handlePublishMasterExam(e, 'Published')} className="text-emerald-600 font-semibold hover:bg-emerald-50">
                                  Publish Examination
                                </DropdownItem>
                              )
                            )}
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* VIEW 1.5: CLASS WISE EXAMINATION WORKSPACE */}
      {effectiveActiveView === 'classes' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
            >
              Back
            </button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Class-wise Exam Management</h3>
              <p className="text-xs text-text-secondary">{selectedExam.name} ({formatDateString(selectedExam.start_date)} to {formatDateString(selectedExam.end_date)})</p>
            </div>
          </div>

          {/* Class Filter Dropdown */}
          <Card className="p-4 shadow-sm bg-zinc-50/50 dark:bg-zinc-900/50 relative z-30">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-full sm:w-80 space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Select Class</label>
                <CustomClassSelect 
                  value={selectedClassId} 
                  options={examClassStatuses}
                  onChange={(newVal) => {
                    setSelectedClassId(newVal);
                    setPendingSubjects([]);
                    setShowPendingAlert(false);
                    setPendingValidationSource('');
                  }} 
                />
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
            const currentClass = examClassStatuses.find(c => String(c.id || c.class_id) === String(selectedClassId))
              || classes.find(c => String(c.id || c.class_id) === String(selectedClassId))
              || { id: selectedClassId, class_id: selectedClassId, name: 'Class', status: 'Draft' };
            
            const targetClassId = String(currentClass?.id || currentClass?.class_id || selectedClassId);

            const isAnnualExam = !!(selectedExam?.name && (
              selectedExam.name.toLowerCase().includes('annual') ||
              selectedExam.name.toLowerCase().includes('final') ||
              selectedExam.type === 'ANNUAL' ||
              selectedExam.exam_type === 'ANNUAL'
            ));

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
                        <h4 className="text-sm font-bold font-display text-text-primary tracking-wider uppercase">
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
                          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
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
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold cursor-pointer" onClick={() => handleOpenTimetable(selectedExam, targetClassId)}>
                        <Calendar className="h-4 w-4" /> Open Timetable
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 5: Seating Plan */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Users className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">Seating Plan</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Generate examination seating arrangements, room allocation, student seating slips, and printable seating plans.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button 
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold cursor-pointer" 
                        onClick={() => navigate('/school-admin/exams/seating-plan', { 
                          state: { 
                            examId: selectedExam.id, 
                            classId: targetClassId,
                            activeView: effectiveActiveView || 'classes',
                            view: hasSeatingPlan ? 'slips' : 'config' 
                          } 
                        })}
                      >
                        <Users className="h-4 w-4" /> {hasSeatingPlan ? 'Open Seating Plan' : 'Create Seating Plan'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 6: Question Paper Designer */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <FileText className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">Question Paper Designer</h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Create professional examination question papers with formatting tools, diagrams, tables, images, equations, and automatic PDF generation.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button 
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold cursor-pointer" 
                        onClick={() => navigate('/school-admin/exams/question-paper-designer', { 
                          state: { 
                            examId: selectedExam?.id,
                            classId: targetClassId,
                            activeView: effectiveActiveView || 'classes',
                            examName: selectedExam?.name
                          } 
                        })}
                      >
                        <FileText className="h-4 w-4" /> OPEN QUESTION PAPER DESIGNER
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
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold cursor-pointer" onClick={() => handleOpenMarksEntry(selectedExam, targetClassId)}>
                        <Edit3 className="h-4 w-4" /> Open Marks Entry
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 3: Single Exam Report Cards */}
                <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                  <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Award className="h-5 w-5" />
                        <h4 className="text-base font-bold text-text-primary">
                          {selectedExam?.name ? `${selectedExam.name} Report Cards` : 'Test Report Cards'}
                        </h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Generate, preview, print, or download individual exam report cards with automated class ranks, section ranks, and attendance.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold cursor-pointer" onClick={() => handleOpenReportCards(selectedExam, targetClassId)}>
                        <Award className="h-4 w-4" /> Open {selectedExam?.name || 'Test'} Report Cards
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
                            className={`font-bold uppercase px-2 py-0.5 rounded-full text-[11px] select-none transition-all ${
                              currentClass.status === 'Published' 
                                ? 'bg-green-500/10 text-green-600 cursor-pointer hover:bg-green-500/20 active:scale-95' 
                                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'
                            }`}
                            onClick={() => {
                              if (currentClass.status === 'Published') {
                                handleUnpublishClassResults(selectedExam, targetClassId);
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
                      {currentClass.status === 'Draft' ? (
                        <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold font-sans cursor-pointer" onClick={() => handlePublishClassResults(selectedExam, targetClassId)}>
                          <CheckCircle className="h-4 w-4" /> Publish Result
                        </Button>
                      ) : (
                        <Button 
                          type="button"
                          className="w-full text-xs font-bold bg-amber-600/10 hover:bg-amber-600/20 text-amber-600 border border-amber-600/20 cursor-pointer flex items-center justify-center gap-2" 
                          onClick={() => handleUnpublishClassResults(selectedExam, targetClassId)}
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
      {effectiveActiveView === 'timetable' && selectedExam && (() => {
        const currentClassStatusObj = examClassStatuses.find(c => c.id === parseInt(selectedClassId));
        const isSchemePublished = currentClassStatusObj?.scheme_published === 1;
        const isTimetableEditable = !isReadOnly && !isSchemePublished;

        return (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('classes')}
              className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
            >
              Back
            </button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Manage Exam Timetable</h3>
              <p className="text-xs text-text-secondary">
                {selectedExam.name} — Class: {(() => {
                  const cls = classes.find(c => c.id === parseInt(selectedClassId)) || examClassStatuses.find(c => c.id === parseInt(selectedClassId));
                  if (!cls) return '';
                  return `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`;
                })()}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* 1. Add Paper block */}
            {isTimetableEditable ? (
              <Card className="shadow-sm rounded-2xl overflow-visible relative z-30">
                <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 rounded-t-2xl flex flex-row justify-between items-center space-y-0">
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
                          const testMaxMarks = parseFloat(selectedExam?.max_marks) || 30;
                          const testPassMarks = Math.ceil(testMaxMarks * 0.33);
                          setNewPaper({
                            subject_id: '',
                            exam_date: suggestNextExamDate(selectedExam, timetablePapers, holidays),
                            start_time: '',
                            end_time: '',
                            max_marks: String(testMaxMarks),
                            passing_marks: String(testPassMarks),
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
                      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Subjects Completed</span>
                      <span className="text-xl font-bold font-display text-primary leading-tight">
                        {scheduledCount}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Subject Select */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary uppercase">Select Subject</label>
                        <CustomSelect 
                          value={newPaper.subject_id} 
                          onChange={val => setNewPaper(p => ({ ...p, subject_id: val }))}
                          disabled={Boolean(editingPaper)}
                          placeholder="-- Choose Subject --"
                          options={classSubjects.map(s => {
                            const isCreated = timetablePapers.some(p => p.subject_id === s.id && (!editingPaper || editingPaper.subject_id !== s.id));
                            return {
                              value: String(s.id),
                              label: `${s.name}${isCreated ? ' (Created)' : ''}`
                            };
                          })}
                          buttonClassName="h-9"
                        />
                      </div>

                      {/* Exam Date */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-text-secondary uppercase">Exam Date</label>
                        <CalendarDatePicker
                          min={selectedExam.start_date}
                          max={selectedExam.end_date}
                          allowPast={true}
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
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {/* Evaluation Type */}
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-text-secondary uppercase">Evaluation Type</label>
                        <CustomSelect 
                          value={newPaper.evaluation_type || 'marks'} 
                          onChange={val => {
                            const defaultMax = parseFloat(selectedExam?.max_marks) || 30;
                            const defaultPass = Math.ceil(defaultMax * 0.33);
                            setNewPaper(p => ({
                              ...p,
                              evaluation_type: val,
                              max_marks: val === 'grade' ? '0' : (p.max_marks || String(defaultMax)),
                              passing_marks: val === 'grade' ? '0' : (p.passing_marks || String(defaultPass))
                            }));
                          }}
                          options={[
                            { value: 'marks', label: 'Marks Based (0-100)' },
                            { value: 'grade', label: 'Grade Based (A, B, C, D)' }
                          ]}
                          buttonClassName="h-9"
                        />
                      </div>

                      {/* Start Time */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-text-secondary uppercase">Start Time</label>
                        <Input type="time" value={newPaper.start_time} onChange={e => setNewPaper(p => ({ ...p, start_time: e.target.value }))} required className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong" />
                      </div>

                      {/* End Time */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-text-secondary uppercase">End Time</label>
                        <Input type="time" value={newPaper.end_time} onChange={e => setNewPaper(p => ({ ...p, end_time: e.target.value }))} required className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong" />
                      </div>

                      {newPaper.evaluation_type === 'grade' ? (
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Grading Scale (Direct Grade)</label>
                          <CustomSelect 
                            value={newPaper.grading_scale || 'A,B,C,D,E'} 
                            onChange={val => setNewPaper(p => ({ ...p, grading_scale: val }))}
                            options={[
                              { value: 'A+,A,B,C,D,E', label: '5-Tier Scale (A+, A, B, C, D, E)' },
                              { value: 'A,B,C,D', label: '4-Tier Scale (A, B, C, D)' }
                            ]}
                            buttonClassName="h-9"
                          />
                        </div>
                      ) : (
                        <>
                          {/* Max Marks */}
                          <div className="space-y-1.5 font-sans">
                            <label className="text-xs font-bold text-text-secondary uppercase">Maximum Marks</label>
                            <Input 
                              type="number" 
                              step="1"
                              min="1"
                              value={newPaper.max_marks} 
                              onChange={e => {
                                const val = e.target.value;
                                const numMax = parseFloat(val) || 0;
                                const calcPass = Math.ceil(numMax * 0.33);
                                setNewPaper(p => ({
                                  ...p,
                                  max_marks: val,
                                  passing_marks: numMax > 0 ? String(calcPass) : p.passing_marks
                                }));
                              }} 
                              required 
                              className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
                            />
                          </div>

                          {/* Passing Marks */}
                          <div className="space-y-1.5 font-sans">
                            <label className="text-xs font-bold text-text-secondary uppercase">Passing Marks</label>
                            <Input 
                              type="number" 
                              step="1"
                              min="1"
                              value={newPaper.passing_marks} 
                              onChange={e => {
                                const val = e.target.value;
                                const numPass = parseFloat(val);
                                const ceiled = (numPass && !isNaN(numPass) && numPass > 0) ? String(Math.ceil(numPass)) : val;
                                setNewPaper(p => ({
                                  ...p,
                                  passing_marks: ceiled
                                }));
                              }} 
                              required 
                              className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
                            />
                          </div>
                        </>
                      )}
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
            <Card className="shadow-sm rounded-2xl overflow-hidden relative z-10">
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 rounded-t-2xl flex flex-row justify-between items-center space-y-0">
                <CardTitle className="text-sm font-bold text-text-primary">Exam Papers</CardTitle>
                {timetablePapers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex items-center gap-2 text-xs font-bold py-1.5 px-3 border-border hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
                        onClick={handleOpenInstructionsPopup}
                      >
                        <BookOpen className="h-4 w-4" /> Instructions
                      </Button>
                      {isSchemePublished ? (
                        <Button 
                          type="button" 
                          variant="secondary"
                          className="flex items-center gap-2 text-xs font-bold py-1.5 px-3 cursor-pointer border-rose-200 text-rose-600 hover:bg-rose-50"
                          onClick={handleUnpublishSchemeClick}
                          disabled={isReadOnly}
                        >
                          <RotateCcw className="h-4 w-4" /> Revert to Draft
                        </Button>
                      ) : (
                        <Button 
                          type="button" 
                          variant="default"
                          className="flex items-center gap-2 text-xs font-bold py-1.5 px-3 cursor-pointer"
                          onClick={handlePublishSchemeClick}
                          disabled={isReadOnly}
                        >
                          <Check className="h-4 w-4" /> Publish Scheme
                        </Button>
                      )}
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
              <Table containerClassName="border-0 rounded-none shadow-none bg-transparent">
                <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border">
                  <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50 border-0 rounded-none">
                    <TableHead className="text-xs font-semibold text-text-primary rounded-none border-0">Subject</TableHead>
                    <TableHead className="text-xs font-semibold text-text-primary">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-text-primary">Time</TableHead>
                    <TableHead className="text-xs font-semibold text-text-primary">Max Marks</TableHead>
                    <TableHead className="text-xs font-semibold text-text-primary">Passing Marks</TableHead>
                    {isTimetableEditable && <TableHead className="text-xs font-semibold text-text-primary text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timetablePapers.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="text-center py-8 text-text-muted">
                        No papers scheduled for this examination yet. Use the form above to add papers.
                      </TableCell>
                    </TableRow>
                  ) : timetablePapers.map((paper, idx) => {
                    const isGradePaper = paper.evaluation_type === 'grade' || parseFloat(paper.max_marks) === 0;
                    return (
                      <TableRow key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <TableCell className="font-semibold text-text-primary flex items-center gap-2">
                          <span>{paper.subject_name}</span>
                          {isGradePaper && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 uppercase">
                              Grade Based
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{formatDateString(paper.exam_date)}</TableCell>
                        <TableCell className="text-xs font-mono">{formatTimeString(paper.start_time)} – {formatTimeString(paper.end_time)}</TableCell>
                        <TableCell className="text-xs font-mono">{isGradePaper ? '—' : paper.max_marks}</TableCell>
                        <TableCell className="text-xs font-mono">{isGradePaper ? '—' : paper.passing_marks}</TableCell>
                        {isTimetableEditable && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownItem onClick={() => {
                                setEditingPaper(paper);
                                setNewPaper({
                                  subject_id: paper.subject_id.toString(),
                                  exam_date: paper.exam_date,
                                  start_time: paper.start_time.slice(0, 5),
                                  end_time: paper.end_time.slice(0, 5),
                                  evaluation_type: paper.evaluation_type || (parseFloat(paper.max_marks) === 0 ? 'grade' : 'marks'),
                                  grading_scale: paper.grading_scale || 'A,B,C,D,E',
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
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
        );
      })()}

      {/* VIEW 3: MARKS SPREADSHEET ENTRY */}
      {effectiveActiveView === 'marks' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('classes')}
              className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
            >
              Back
            </button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Subject Marks Sheet</h3>
              <p className="text-xs text-text-secondary">
                {selectedExam.name} — Class: {(() => {
                  const cls = classes.find(c => c.id === parseInt(selectedClassId)) || examClassStatuses.find(c => c.id === parseInt(selectedClassId));
                  if (!cls) return '';
                  return `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`;
                })()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Select Subject */}
            <Card className="flex flex-col justify-center p-4 h-24">
              <div className="space-y-1.5 w-full">
                <label className="text-xs font-bold text-text-secondary uppercase">Select Scheduled Subject</label>
                <CustomSelect 
                  value={selectedSubjectId} 
                  onChange={handleSubjectChange}
                  options={timetablePapers.map(p => ({
                    value: String(p?.subject_id ?? p?.id ?? ''),
                    label: p?.subject_name || p?.name || 'Subject'
                  }))}
                  buttonClassName="h-9 font-semibold"
                />
              </div>
            </Card>

            {/* Card 2: Completed Subject */}
            {marksSheet && (
              <Card className="flex flex-col justify-center p-4 h-24 bg-zinc-50/50 dark:bg-zinc-900/50 select-none">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-sm font-bold font-display text-text-primary tracking-wider uppercase">
                    COMPLETED SUBJECT:
                  </span>
                  <span className="text-2xl font-bold font-display text-primary leading-none align-baseline">
                    {timetablePapers.filter(p => p.marks_completed).length}
                    <span className="text-sm font-bold text-text-muted ml-1">/{timetablePapers.length}</span>
                  </span>
                </div>
              </Card>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-text-muted text-xs font-bold">Loading marks spreadsheet...</div>
          ) : marksSheet && Array.isArray(marksSheet.students) ? (
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
                  {marksSheet.students.map((s, idx) => {
                    const isReadOnlyField = false;
                    const currentPaper = timetablePapers.find(p => String(p?.subject_id ?? p?.id ?? '') === String(selectedSubjectId));
                    const isGradeSheet = marksSheet.evaluation_type === 'grade' || parseFloat(marksSheet.max_marks) === 0 || currentPaper?.evaluation_type === 'grade';

                    return (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-mono font-semibold text-text-secondary">{s.roll_no || '-'}</TableCell>
                        <TableCell className="font-semibold text-text-primary">{s.student_name}</TableCell>
                        <TableCell>
                          <input 
                            type="checkbox" 
                            className="rounded border-zinc-300 h-4 w-4 accent-primary cursor-pointer" 
                            disabled={isReadOnlyField}
                            checked={s.is_absent === 1}
                            onChange={e => handleMarkCellChange(s.student_id, 'is_absent', e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {isGradeSheet ? (
                            (() => {
                              const dynamicGrades = (gradeScales && gradeScales.length > 0)
                                ? Array.from(new Set(gradeScales.map(g => g.grade).filter(Boolean)))
                                : ['A', 'B', 'C', 'D'];

                              return (
                                <Select
                                  className="h-8 text-xs font-bold w-full cursor-pointer"
                                  disabled={s.is_absent === 1}
                                  value={s.is_absent === 1 ? '' : (s.marks_obtained || '')}
                                  onChange={e => handleMarkCellChange(s.student_id, 'marks_obtained', e.target.value)}
                                >
                                  <option value="">-- Grade --</option>
                                  {dynamicGrades.map(g => (
                                    <option key={g} value={g}>Grade {g}</option>
                                  ))}
                                </Select>
                              );
                            })()
                          ) : (
                            <Input 
                              ref={el => { markInputRefs.current[s.student_id] = el; }}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder={s.is_absent === 1 ? 'ABSENT' : `Max: ${marksSheet.max_marks}`}
                              className="h-8 text-xs font-mono w-full"
                              disabled={s.is_absent === 1 || isReadOnlyField}
                              value={s.is_absent === 1 ? '' : (s.marks_obtained !== null && s.marks_obtained !== undefined ? s.marks_obtained : '')}
                              onChange={e => {
                                const val = e.target.value;
                                handleMarkCellChange(s.student_id, 'marks_obtained', val);

                                const cleanVal = val.replace(/\D/g, '');
                                const maxM = parseFloat(marksSheet?.max_marks || 100);
                                const nextStudent = marksSheet?.students?.[idx + 1];

                                if (nextStudent) {
                                  const focusNext = () => {
                                    const nextEl = markInputRefs.current[nextStudent.student_id];
                                    if (nextEl) {
                                      nextEl.focus();
                                      if (nextEl.select) nextEl.select();
                                    }
                                  };

                                  if (cleanVal.length >= 3) {
                                    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                                    focusNext();
                                  } else if (cleanVal.length === 2) {
                                    if (cleanVal === '10' && maxM >= 100) {
                                      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                                      autoAdvanceTimerRef.current = setTimeout(() => {
                                        focusNext();
                                      }, 300);
                                    } else {
                                      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                                      focusNext();
                                    }
                                  }
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  const nextStudent = marksSheet?.students?.[idx + 1];
                                  if (nextStudent) {
                                    const nextEl = markInputRefs.current[nextStudent.student_id];
                                    if (nextEl) {
                                      nextEl.focus();
                                      if (nextEl.select) nextEl.select();
                                    }
                                  }
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  const prevStudent = marksSheet?.students?.[idx - 1];
                                  if (prevStudent) {
                                    const prevEl = markInputRefs.current[prevStudent.student_id];
                                    if (prevEl) {
                                      prevEl.focus();
                                      if (prevEl.select) prevEl.select();
                                    }
                                  }
                                }
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Input aria-label="Add remarks..." 
                            placeholder="Add remarks..." 
                            className="h-8 text-xs w-full"
                            disabled={isReadOnlyField}
                            value={s.remarks || ''}
                            onChange={e => handleMarkCellChange(s.student_id, 'remarks', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right text-[11px] font-semibold text-text-muted">
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
      {effectiveActiveView === 'reports' && selectedExam && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('classes')}
              className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
            >
              Back
            </button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Student Report Cards</h3>
              <p className="text-xs text-text-secondary">
                {selectedExam.name} — Class: {(() => {
                  const cls = classes.find(c => c.id === parseInt(selectedClassId)) || examClassStatuses.find(c => c.id === parseInt(selectedClassId));
                  if (!cls) return '';
                  return `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`;
                })()}
              </p>
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
                    <TableCell className="font-bold text-xs text-primary">{card.grade}</TableCell>
                    <TableCell className="text-xs text-text-secondary">{card.attendance.attendance_rate}%</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        card.result === 'PASS' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        {card.result}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" className="h-7 px-2 text-xs flex items-center gap-1 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 ml-auto font-bold" onClick={() => handleOpenSingleReportCard(card)}>
                        <FileText className="h-3.5 w-3.5" /> View Card
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* VIEW 5: GRADE CONFIGURATION SCALE PAGE */}
      {effectiveActiveView === 'grade_scale' && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setActiveView('dashboard'); setGradeError(''); setGradeSuccess(''); }}
              className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
            >
              Back
            </button>
            <div>
              <h3 className="text-xl font-bold text-text-primary">Grade Configuration Scale</h3>
              <p className="text-xs text-text-secondary">Configure grade scale ranges to automatically calculate marks grades.</p>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary font-display tracking-tight">Grade Configuration Scale</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {gradeError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
                  {gradeError}
                </div>
              )}

              {gradeSuccess && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold">
                  {gradeSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-text-secondary">
                    Configure grade scale ranges to automatically calculate marks grades.
                  </p>
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      {Boolean(reportCardRemark && reportCardRemark.trim() !== '') ? (
                        <Button
                          variant="outline"
                          className="h-8 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/20"
                          onClick={handleRemoveRemark}
                          disabled={remarkLoading}
                        >
                          Disable Remarks
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="h-8 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400"
                          onClick={async () => {
                            setRemarkLoading(true);
                            try {
                              await schoolService.updateSchoolProfile({ report_card_remark: 'DYNAMIC' });
                              setReportCardRemark('DYNAMIC');
                              setSchoolProfile(prev => ({ ...(prev || {}), report_card_remark: 'DYNAMIC' }));
                              setGradeSuccess('Teacher remarks enabled successfully.');
                            } catch (err) {
                              setGradeError('Failed to enable remarks.');
                            } finally {
                              setRemarkLoading(false);
                            }
                          }}
                          disabled={remarkLoading}
                        >
                          Enable Remarks
                        </Button>
                      )}
                      <Button variant="outline" className="h-8 text-xs font-bold" onClick={handleResetGradesDefault}>
                        Reset to Defaults
                      </Button>
                      <Button className="h-8 text-xs font-bold flex items-center gap-1" onClick={handleAddGradeRow}>
                        <Plus className="h-3.5 w-3.5" /> Add Grade Row
                      </Button>
                    </div>
                  )}
                </div>

                {/* Report Card Remark Block */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/20 border border-border rounded-xl flex flex-col gap-1.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Teacher Remarks Setting</span>
                  {reportCardRemark ? (
                    <p className="text-xs text-green-700 dark:text-green-400 font-bold leading-relaxed">
                      ✓ Teacher remarks are ENABLED. Report cards will automatically reflect dynamic remarks based on each student's obtained percentage range configured in the table below.
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic leading-relaxed">
                      Teacher remarks are DISABLED by default. Click "Enable Remarks" above if you want dynamic remarks to appear on report cards based on student scores.
                    </p>
                  )}
                </div>

                 <div className="border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28 whitespace-nowrap">Grade Code</TableHead>
                        <TableHead className="w-28 whitespace-nowrap">Min %</TableHead>
                        <TableHead className="w-28 whitespace-nowrap">Max %</TableHead>
                        <TableHead className="min-w-[240px] whitespace-nowrap">Teacher Remark</TableHead>
                        {!isReadOnly && <TableHead className="text-right w-16 whitespace-nowrap">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradeScales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isReadOnly ? 4 : 5} className="text-center py-6 text-text-muted text-xs">
                            No grading configurations found. Click "Reset to Defaults" to populate standard ranges.
                          </TableCell>
                        </TableRow>
                      ) : gradeScales.map((s, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input aria-label="e.g. A+"
                              value={s.grade}
                              placeholder="e.g. A+"
                              disabled={isReadOnly}
                              className="h-8 text-xs font-bold text-primary max-w-[80px]"
                              onChange={e => handleGradeFieldChange(idx, 'grade', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={s.min_percentage}
                              disabled={isReadOnly}
                              className="h-8 text-xs font-mono max-w-[100px]"
                              onChange={e => handleGradeFieldChange(idx, 'min_percentage', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={s.max_percentage}
                              disabled={isReadOnly}
                              className="h-8 text-xs font-mono max-w-[100px]"
                              onChange={e => handleGradeFieldChange(idx, 'max_percentage', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={s.remark || ''}
                              placeholder="e.g. Excellent performance..."
                              disabled={isReadOnly}
                              className="h-8 text-xs w-full"
                              onChange={e => handleGradeFieldChange(idx, 'remark', e.target.value)}
                            />
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => handleRemoveGradeRow(idx)}
                                title="Delete row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {!isReadOnly && gradeScales.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <Button className="font-bold flex items-center gap-1.5" onClick={handleSaveGradeScale} disabled={gradeLoading}>
                      <Save className="h-4 w-4" /> {gradeLoading ? 'Saving...' : 'Save Grading Scale'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 6: FINAL ACADEMIC REPORT CARDS LIST (SESSION SUMMARY) */}
      {effectiveActiveView === 'final_reports' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Print Styles Overrides for Class Export */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: portrait !important;
                margin: 5mm !important;
              }
              body {
                background-color: white !important;
                color: black !important;
                padding: 0 !important;
                margin: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print, header, sidebar, nav, button, .sticky {
                display: none !important;
              }
              .id-card-report-wrapper, .single-page-report-container {
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: always !important;
                break-after: page !important;
                max-height: 280mm !important;
                overflow: visible !important;
                margin: 0 auto !important;
              }
              .report-card-page-break {
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `}} />

          {/* Hidden Multi-Page Printable Container for Class PDF Export */}
          <div className="sr-only opacity-0 pointer-events-none fixed -left-[9999px] -top-[9999px]">
            <div id="printable-all-class-report-cards" className="w-[194mm]">
              {(allClassSortedCards.length > 0
                ? allClassSortedCards
                : sortCardsByRollNo(finalSessionReportCards.length > 0 ? finalSessionReportCards : reportCards)
              ).map((card, idx) => (
                <div
                  key={card.student_id || card.student?.id || idx}
                  className="report-card-page-break bg-white"
                  style={{
                    pageBreakAfter: 'always',
                    breakAfter: 'page',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    maxHeight: '280mm',
                    overflow: 'hidden'
                  }}
                >
                  <ReportCardRenderer
                    card={card}
                    schoolProfile={schoolProfile}
                    currentYear={currentAcademicYear}
                    exam={card.is_final_session_report ? { name: 'FINAL ACADEMIC REPORT CARD', is_final_session_report: true } : (selectedExam || { name: card.exam_name || 'EXAMINATION REPORT CARD' })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('classes')}
                className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs cursor-pointer"
              >
                Back
              </button>
              <div>
                <h3 className="text-xl font-bold text-text-primary">Final Academic Report Cards</h3>
                <p className="text-xs text-text-secondary">
                  Annual Session Summary — Class: {(() => {
                    const cls = classes.find(c => c.id === parseInt(selectedClassId)) || examClassStatuses.find(c => c.id === parseInt(selectedClassId));
                    if (!cls) return '';
                    return `${cls.name}${cls.section ? ` - ${cls.section}` : ''}`;
                  })()} | Session: {currentAcademicYear?.name || '2026–2027'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs font-bold flex items-center gap-2 border-emerald-600/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100"
                onClick={handleDownloadEntireClassPdf}
                disabled={generatingClassPdf || finalSessionReportCards.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                {generatingClassPdf ? 'Generating Class PDF...' : 'Download Entire Class (PDF)'}
              </Button>
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 whitespace-nowrap select-none">Rank</TableHead>
                  <TableHead className="w-20 whitespace-nowrap select-none">Roll No</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Student Name</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Final Marks</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Percentage</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Overall Grade</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Attendance</TableHead>
                  <TableHead className="whitespace-nowrap select-none">Final Verdict</TableHead>
                  <TableHead className="text-right whitespace-nowrap select-none">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalSessionReportCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-text-muted">
                      No final session report cards calculated. Ensure marks are entered for conducted session exams.
                    </TableCell>
                  </TableRow>
                ) : finalSessionReportCards.map((card, idx) => (
                  <TableRow key={card.student.id || idx}>
                    <TableCell className="font-bold text-text-primary">{card.summary.class_rank.split(' ')[0]}</TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">{card.student.roll_no}</TableCell>
                    <TableCell className="font-semibold text-text-primary">{card.student.name}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{card.summary.total_obtained} / {card.summary.total_max}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-600">{card.summary.percentage}%</TableCell>
                    <TableCell className="font-bold text-xs text-amber-700">{card.summary.grade}</TableCell>
                    <TableCell className="text-xs text-text-secondary">{card.summary.attendance.attendance_rate}%</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        card.summary.result === 'PASS' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                      }`}>
                        {card.summary.result}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="outline" className="h-8 px-3 text-xs inline-flex items-center gap-1.5 text-amber-700 border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 font-bold whitespace-nowrap shrink-0 ml-auto" onClick={() => handleOpenSingleReportCard(card)}>
                        <FileText className="h-3.5 w-3.5" /> View Final Card
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* PUBLISH SCHEME DIALOG */}
      <Dialog isOpen={showPublishSchemeModal} onClose={() => setShowPublishSchemeModal(false)}
        title="Publish Examination Scheme"
        footer={<>
          <Button variant="secondary" onClick={() => setShowPublishSchemeModal(false)}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={confirmPublishScheme} disabled={submittingPublishScheme}>
            {submittingPublishScheme ? 'Publishing...' : 'Publish'}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
            <CheckCircle className="h-6 w-6" />
          </div>
          <p className="text-xs text-center text-text-secondary leading-relaxed">
            You are about to publish the examination scheme. Once published, students and class teachers will be able to access the examination scheme in the mobile application. Do you want to continue?
          </p>
        </div>
      </Dialog>

      {/* UNPUBLISH SCHEME DIALOG */}
      <Dialog isOpen={showUnpublishSchemeModal} onClose={() => setShowUnpublishSchemeModal(false)}
        title="Revert Scheme to Draft"
        footer={<>
          <Button variant="secondary" onClick={() => setShowUnpublishSchemeModal(false)}>Cancel</Button>
          <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmUnpublishScheme} disabled={submittingUnpublishScheme}>
            {submittingUnpublishScheme ? 'Reverting...' : 'Confirm Revert'}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-xs text-center text-text-secondary leading-relaxed">
            Are you sure you want to revert the examination scheme to Draft? Once reverted, it will disappear from the mobile application, and students/parents will receive a notification alert.
          </p>
        </div>
      </Dialog>

      {/* CONFIRM TOGGLE PUBLISH EXAM DIALOG */}
      <Dialog 
        isOpen={showTogglePublishModal} 
        onClose={() => setShowTogglePublishModal(false)}
        title={togglePublishTarget?.status === 'Published' ? "Move Examination to Draft" : "Publish Examination"}
        footer={<>
          <Button variant="secondary" onClick={() => setShowTogglePublishModal(false)}>Cancel</Button>
          <Button 
            className={togglePublishTarget?.status === 'Published' ? "bg-amber-600 hover:bg-amber-700 text-white font-bold" : "bg-green-600 hover:bg-green-700 text-white font-bold"} 
            onClick={confirmToggleExamPublishStatus} 
            disabled={submitting}
          >
            {submitting ? 'Updating...' : (togglePublishTarget?.status === 'Published' ? 'Yes, Move to Draft' : 'Yes, Publish')}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
            togglePublishTarget?.status === 'Published' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
          }`}>
            {togglePublishTarget?.status === 'Published' ? <AlertCircle className="h-6 w-6" /> : <CheckCircle className="h-6 w-6" />}
          </div>
          <p className="text-xs text-center text-text-secondary leading-relaxed font-semibold">
            {togglePublishTarget?.status === 'Published' ? (
              `Are you sure you want to move "${togglePublishTarget?.name}" back to Draft? Once moved to draft, it will no longer be accessible in the mobile application for teachers and students.`
            ) : (
              `Are you sure you want to publish "${togglePublishTarget?.name}"? Once published, it will become visible in the mobile application for teachers and students.`
            )}
          </p>
        </div>
      </Dialog>

      {/* CREATE EXAM DIALOG */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}
        title={newExam?.parent_id ? "Add Test" : (isCBSEClassic ? "Add Terminal Examination" : "Create Examination")}
        description={newExam?.parent_id ? "Add a test under this terminal examination (e.g. Unit Test 1, Sub-Enrichment, Term-I)." : (isCBSEClassic ? "Enter the name for this terminal examination." : "Define details for an examination.")}
        footer={<>
          <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateExam} disabled={submitting}>{submitting ? 'Creating...' : (newExam?.parent_id ? 'Add Test' : 'Create Terminal Examination')}</Button>
        </>}>
        <form onSubmit={handleCreateExam} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="examination-name" className="text-xs font-bold text-text-secondary uppercase">
              {newExam?.parent_id ? "Test Name *" : (isCBSEClassic ? "Terminal Examination Name *" : "Examination Name *")}
            </label>
            <Input 
              id="examination-name" 
              placeholder={newExam?.parent_id ? "e.g. Unit Test 1, Sub-Enrichment, Term-I" : (isCBSEClassic ? "e.g. FIRST TERMINAL EXAMINATION PROGRESS" : "e.g. Half Yearly, Pre Board, Annual")} 
              value={newExam.name} 
              onChange={e => setNewExam(p => ({ ...p, name: e.target.value }))} 
              required 
              className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
            />
          </div>

          {Boolean(newExam?.parent_id) && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Max Marks (Optional, e.g. 100, 50, 20)</label>
              <Input 
                type="number"
                step="1"
                min="1"
                placeholder="e.g. 100"
                value={newExam.max_marks || ''} 
                onChange={e => setNewExam(p => ({ ...p, max_marks: e.target.value }))} 
                className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Start Date *</label>
              <Input 
                type="date" 
                min={getExamMinStartDate(null, exams, newExam?.parent_id)} 
                value={newExam.start_date || ''} 
                onChange={e => setNewExam(p => ({ ...p, start_date: e.target.value }))} 
                required 
                className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">End Date *</label>
              <Input 
                type="date" 
                min={newExam.start_date || getExamMinStartDate(null, exams, newExam?.parent_id)} 
                max={getExamMaxEndDate(null, exams, newExam?.parent_id) || undefined}
                value={newExam.end_date || ''} 
                onChange={e => setNewExam(p => ({ ...p, end_date: e.target.value }))} 
                required 
                className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
              />
            </div>
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
        title={editExamData?.parent_id ? "Edit Test" : (isCBSEClassic ? "Edit Terminal Examination" : "Edit Examination")}
        description={editExamData?.parent_id ? "Update details for this test or component." : (isCBSEClassic ? "Update details for this terminal examination." : "Update details for this school-wide examination.")}
        footer={<>
          <Button variant="secondary" onClick={() => setIsEditExamOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleUpdateExam} disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </Button>
        </>}>
        <form onSubmit={handleUpdateExam} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="examination-name-2" className="text-xs font-bold text-text-secondary uppercase">
              {editExamData?.parent_id ? "Test Name *" : (isCBSEClassic ? "Terminal Examination Name *" : "Examination Name *")}
            </label>
            <Input 
              id="examination-name-2" 
              placeholder={editExamData?.parent_id ? "e.g. Unit Test 1, Sub-Enrichment, Term-I" : (isCBSEClassic ? "e.g. FIRST TERMINAL EXAMINATION PROGRESS" : "e.g. Half Yearly, Pre Board, Unit Test 1")} 
              value={editExamData.name} 
              onChange={e => setEditExamData(p => ({ ...p, name: e.target.value }))} 
              required 
              className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
            />
          </div>

          {Boolean(editExamData?.parent_id) && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Max Marks (Optional, e.g. 100, 50, 20)</label>
              <Input 
                type="number"
                step="1"
                min="1"
                placeholder="e.g. 100"
                value={editExamData.max_marks || ''} 
                onChange={e => setEditExamData(p => ({ ...p, max_marks: e.target.value }))} 
                className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Start Date *</label>
              <Input 
                type="date" 
                min={getExamMinStartDate(editExamData.id, exams, editExamData.parent_id)} 
                max={getExamMaxEndDate(editExamData.id, exams, editExamData.parent_id) || undefined}
                value={editExamData.start_date || ''} 
                onChange={e => setEditExamData(p => ({ ...p, start_date: e.target.value }))} 
                required
                className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">End Date *</label>
              <Input 
                type="date" 
                min={editExamData.start_date || getExamMinStartDate(editExamData.id, exams, editExamData.parent_id)} 
                max={getExamMaxEndDate(editExamData.id, exams, editExamData.parent_id) || undefined}
                value={editExamData.end_date || ''} 
                onChange={e => setEditExamData(p => ({ ...p, end_date: e.target.value }))} 
                required
                className="focus:ring-0 focus-visible:ring-0 focus:outline-none focus:border-border-strong"
              />
            </div>
          </div>

        </form>
      </Dialog>

      {/* RESET PAPERS CONFIRMATION DIALOG */}
      <Dialog isOpen={isResetPapersConfirmOpen} onClose={() => setIsResetPapersConfirmOpen(false)}
        title="Modify Examination Dates & Reset Papers?"
        footer={<>
          <Button variant="secondary" onClick={() => { setIsResetPapersConfirmOpen(false); setIsEditExamOpen(true); }} disabled={submitting}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={() => executeExamUpdate(true)} disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Updating & Resetting...
              </span>
            ) : (
              'Yes, Update Dates & Reset Papers'
            )}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h4 className="text-center font-bold text-text-primary text-sm mt-2">Previously added exam papers & scheme will be reset!</h4>
          <p className="text-xs text-text-secondary leading-relaxed text-center">
            You modified the Start Date / End Date for <strong>{selectedExamToEdit?.name}</strong>. 
            Since papers and timetable entries have already been configured for this examination, changing the dates will <strong>reset (delete) all previously added papers and marks schemes</strong>. You will need to schedule a fresh paper scheme according to the new examination dates.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              Do you want to proceed and reset added papers for the new dates?
            </p>
          </div>
        </div>
      </Dialog>

      {/* DELETE EXAM CONFIRM DIALOG WITH OTP VERIFICATION */}
      <Dialog 
        isOpen={isDeleteExamConfirmOpen} 
        onClose={() => {
          if (!submitting && !requestingOtp) {
            setIsDeleteExamConfirmOpen(false);
            setDeleteStep('confirm');
            setDeleteExamTarget(null);
          }
        }}
        title={deleteExamTarget?.parent_id === null ? "Delete Terminal Examination" : "Delete Test / Component"}
        footer={
          deleteStep === 'confirm' ? (
            <>
              <Button variant="secondary" onClick={() => setIsDeleteExamConfirmOpen(false)} disabled={requestingOtp}>
                Cancel
              </Button>
              <Button 
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold" 
                onClick={handleRequestDeleteOtp} 
                disabled={requestingOtp}
              >
                {requestingOtp ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending OTP...
                  </span>
                ) : (
                  deleteExamTarget?.parent_id === null ? 'Yes, Delete Terminal' : 'Yes, Delete Test'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setDeleteStep('confirm');
                  setDeleteOtp('');
                  setDeleteOtpError('');
                }} 
                disabled={submitting}
              >
                Back
              </Button>
              <Button 
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold" 
                onClick={handleConfirmDeleteExamWithOtp} 
                disabled={submitting || deleteOtp.trim().length !== 4}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                  </span>
                ) : (
                  'Verify & Delete'
                )}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4 p-1">
          {deleteStep === 'confirm' ? (
            <div>
              <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                {deleteExamTarget?.parent_id === null ? (
                  `Are you sure you want to delete terminal examination "${deleteExamTarget?.name}"? Deleting this terminal will permanently delete all associated tests, component exams, student marks, and timetable data for this term. This action cannot be undone.`
                ) : (
                  `Are you sure you want to delete test "${deleteExamTarget?.name}"? Deleting this test will permanently remove all entered marks and paper timetable schedules associated with it. This action cannot be undone.`
                )}
              </p>
              {deleteOtpError && (
                <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {deleteOtpError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-text-primary text-sm">Email Verification Required</h4>
                <p className="text-xs text-text-secondary mt-1">
                  A 4-digit OTP has been sent to your registered email address <strong className="text-text-primary">{otpMaskedEmail}</strong>. Enter the OTP below to confirm deletion of <strong>{deleteExamTarget?.name}</strong>.
                </p>
              </div>

              {deleteOtpError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-left">
                  {deleteOtpError}
                </div>
              )}

              <OtpInput4Digit
                value={deleteOtp}
                onChange={(val) => {
                  setDeleteOtp(val);
                  if (deleteOtpError) setDeleteOtpError('');
                }}
                error={Boolean(deleteOtpError)}
                autoFocus
              />

              <div className="flex items-center justify-between text-xs px-2 pt-1 border-t border-border">
                <span className="text-text-secondary">Didn't receive code?</span>
                <button
                  type="button"
                  onClick={handleResendDeleteOtp}
                  disabled={otpTimer > 0 || requestingOtp}
                  className={`font-semibold transition-colors ${
                    otpTimer > 0 || requestingOtp
                      ? 'text-text-muted cursor-not-allowed'
                      : 'text-rose-600 hover:text-rose-700 cursor-pointer underline'
                  }`}
                >
                  {requestingOtp ? 'Sending...' : otpTimer > 0 ? `Resend OTP in ${otpTimer}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}
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
              <Input aria-label="e.g. Carry your School ID Card."
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
            <p className="text-[11px] text-text-muted">Maximum 3 instructions allowed. Each instruction can contain a maximum of 25 words.</p>
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

      {/* DETAILED EXAMINATION SCHEME DIALOG MODAL (ALL CLASSES COMBINED A4 PRINTABLE) */}
      <Dialog isOpen={isSchemeOpen} onClose={() => setIsSchemeOpen(false)} maxWidth="max-w-[95vw] lg:max-w-[1250px]">
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
                .class-scheme-section {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              `}} />
            )}
            {/* Action Bar (Not printed) */}
            <div className="flex justify-end items-center bg-zinc-50 border-b border-border p-4 -m-6 mb-6 no-print">
              <div className="flex items-center gap-2">
                <Button type="button" onClick={triggerDownloadPdf} disabled={loadingSchemes || !allSchemesData || !allSchemesData.classes?.length} className="flex items-center gap-2 font-bold py-1.5 px-3">
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button type="button" variant="outline" onClick={triggerPrintScheme} disabled={loadingSchemes || !allSchemesData || !allSchemesData.classes?.length} className="flex items-center gap-2 font-bold py-1.5 px-3 border-border hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <Printer className="h-4 w-4" /> Print Scheme
                </Button>
              </div>
            </div>

            {loadingSchemes ? (
              <div className="p-12 text-center text-zinc-500 font-medium">
                Loading examination scheme data...
              </div>
            ) : !allSchemesData || !allSchemesData.classes || allSchemesData.classes.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 font-medium">
                No examination papers have been added or configured for any class in this examination.
              </div>
            ) : (
              (() => {
                const numClasses = allSchemesData.classes.length;
                const numDates = allSchemesData.dates?.length || 0;
                const maxDim = Math.max(numClasses, numDates);

                let fontSize = 'text-xs';
                let padding = 'py-3 px-2.5';
                let headerPadding = 'pb-3';
                let containerPadding = 'p-6';
                let spaceY = 'space-y-4';
                let schoolTitleSize = 'text-2xl';
                let examTitleSize = 'text-xl';

                if (maxDim > 14 || numClasses > 12) {
                  fontSize = 'text-[9px] leading-tight';
                  padding = 'py-1.5 px-1';
                  headerPadding = 'pb-1.5';
                  containerPadding = 'p-4';
                  spaceY = 'space-y-2';
                  schoolTitleSize = 'text-lg';
                  examTitleSize = 'text-sm';
                } else if (maxDim > 9 || numClasses > 8) {
                  fontSize = 'text-[10px] leading-snug';
                  padding = 'py-2 px-1.5';
                  headerPadding = 'pb-2';
                  containerPadding = 'p-5';
                  spaceY = 'space-y-3';
                  schoolTitleSize = 'text-xl';
                  examTitleSize = 'text-base';
                } else if (maxDim > 6 || numClasses > 5) {
                  fontSize = 'text-[11px]';
                  padding = 'py-2.5 px-2';
                  headerPadding = 'pb-2.5';
                  containerPadding = 'p-6';
                  spaceY = 'space-y-4';
                  schoolTitleSize = 'text-2xl';
                  examTitleSize = 'text-lg';
                }

                // Format Short Class Name helper (e.g. "Lower Kindergarten (LKG)" -> "LKG")
                const formatShortClassName = (rawName) => {
                  if (!rawName) return '';
                  let str = rawName.trim();
                  let section = '';
                  if (str.includes(' - ')) {
                    const parts = str.split(' - ');
                    str = parts[0].trim();
                    section = ' - ' + parts.slice(1).join(' - ').trim();
                  }

                  const parenMatch = str.match(/\(([^)]+)\)/);
                  if (parenMatch && parenMatch[1]) {
                    const inside = parenMatch[1].trim();
                    if (inside.length <= 8) {
                      str = inside;
                    }
                  } else {
                    const lower = str.toLowerCase();
                    if (lower.includes('lower kindergarten') || lower.includes('lower kg')) {
                      str = 'LKG';
                    } else if (lower.includes('upper kindergarten') || lower.includes('upper kg')) {
                      str = 'UKG';
                    } else if (lower.includes('pre-nursery') || lower.includes('pre nursery')) {
                      str = 'Pre-NUR';
                    } else if (lower.includes('kindergarten')) {
                      str = 'KG';
                    } else if (lower.includes('play group') || lower.includes('playgroup')) {
                      str = 'PG';
                    }
                  }

                  return str + section;
                };

                // Format Exam Title string cleanly without duplicate "EXAMINATION"
                const rawName = selectedExam?.name || '';
                const examTitleStr = (() => {
                  if (/scheme$/i.test(rawName)) return rawName;
                  if (/examination$/i.test(rawName)) return `${rawName} SCHEME`;
                  return `${rawName} EXAMINATION SCHEME`;
                })();

                return (
                  <div className="w-full overflow-x-auto py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex justify-start lg:justify-center p-2 no-print-scroll">
                    <div id="printable-scheme" className={`border-4 border-double border-zinc-400 ${containerPadding} bg-white text-zinc-900 rounded-sm font-sans relative ${spaceY} w-full max-w-[268mm]`} style={{ width: '268mm', boxSizing: 'border-box' }}>
                      <style dangerouslySetInnerHTML={{__html: `
                        #printable-scheme table {
                          border-collapse: collapse !important;
                          width: 100% !important;
                          text-align: center !important;
                        }
                        #printable-scheme th,
                        #printable-scheme td {
                          vertical-align: middle !important;
                          text-align: center !important;
                          line-height: 1.35 !important;
                        }
                        #printable-scheme th span,
                        #printable-scheme td span {
                          vertical-align: middle !important;
                          display: inline-block !important;
                        }
                      `}} />
                      
                      {/* Main Header */}
                      <div className={`text-center border-b-2 border-zinc-800 text-zinc-900 ${headerPadding}`}>
                        <h2 className={`${schoolTitleSize} font-bold uppercase tracking-tight font-display`}>
                          {allSchemesData.school_profile?.name || schoolProfile?.name || 'SCHOOL TIMETABLE'}
                        </h2>
                        <h3 className={`${examTitleSize} font-bold uppercase tracking-wide mt-1`}>
                          {examTitleStr}
                        </h3>
                        {allSchemesData.exam?.academic_year_name && (
                          <h4 className="text-xs font-semibold text-zinc-600 mt-0.5">
                            Academic Year: {allSchemesData.exam.academic_year_name}
                          </h4>
                        )}
                      </div>

                      {/* CONSOLIDATED CLASS x DATE GRID (Uniform Borders & Dynamic Sizing) */}
                      {allSchemesData.dates && allSchemesData.dates.length > 0 && (
                        <div className="w-full overflow-x-auto">
                          <table className={`w-full text-center border-collapse border border-zinc-400 text-zinc-900 ${fontSize}`}>
                            <thead>
                              <tr className="bg-zinc-200 text-zinc-900">
                                <th className={`border border-zinc-400 ${padding} font-bold uppercase text-center align-middle text-zinc-900 whitespace-nowrap bg-zinc-300 w-[12%]`} style={{ verticalAlign: 'middle' }}>
                                  <span>CLASS</span>
                                </th>
                                {allSchemesData.dates.map((dStr, idx) => (
                                  <th key={idx} className={`border border-zinc-400 ${padding} font-bold uppercase text-center align-middle text-zinc-900 whitespace-nowrap`} style={{ verticalAlign: 'middle' }}>
                                    <span>{formatGridHeaderDate(dStr)}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {allSchemesData.classes.map((clsItem, cIdx) => (
                                <tr key={cIdx} className="hover:bg-zinc-50">
                                  <td className={`border border-zinc-400 ${padding} font-bold text-center align-middle bg-zinc-100 whitespace-nowrap text-zinc-900`} style={{ verticalAlign: 'middle' }}>
                                    <span>{formatShortClassName(clsItem.display_name)}</span>
                                  </td>
                                  {allSchemesData.dates.map((dStr, dIdx) => {
                                    const pData = clsItem.date_paper_map?.[dStr];
                                    return (
                                      <td key={dIdx} className={`border border-zinc-400 ${padding} text-center align-middle font-medium whitespace-nowrap text-zinc-900`} style={{ verticalAlign: 'middle' }}>
                                        {pData ? (
                                          <span className="font-bold text-zinc-900">{pData.subject_name}</span>
                                        ) : (
                                          <span className="text-zinc-400">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </Dialog>

      {/* DETAILED REPORT CARD DIALOG MODAL (A4 PRINTABLE) */}
      <Dialog isOpen={Boolean(isReportCardOpen && !selectedReportCard)} onClose={() => { setSelectedReportCard(null); setIsReportCardOpen(false); }} className="max-w-5xl w-full">
        {selectedReportCard && (
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
                  }
                }
              `}} />
            )}
            {/* Action Bar (Not printed) */}
            <div className="flex justify-between items-center bg-zinc-50 border-b border-border p-4 -m-6 mb-6 no-print">
              <span className="text-xs font-bold text-text-secondary">Progress Report Card Preview</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleDownloadAllClassReportCards}
                  disabled={generatingClassPdf}
                  className="flex items-center gap-2 font-bold py-1.5 px-3 text-xs"
                >
                  {generatingClassPdf ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download all report cards
                </Button>
              </div>
            </div>

            {/* A4 Report Card document rendered dynamically by assigned school template */}
            <div className="w-full overflow-x-auto py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex justify-start lg:justify-center p-2">
              <ReportCardRenderer
                card={selectedReportCard}
                schoolProfile={schoolProfile}
                currentYear={currentAcademicYear}
                exam={selectedExam}
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Add Report Card Remark Dialog */}
      <Dialog
        isOpen={isRemarkModalOpen}
        onClose={() => setIsRemarkModalOpen(false)}
        title="Add Report Card Remark"
        description="Configure a reusable final remark that will appear on student report cards."
      >
        <div className="space-y-4 pt-4">
          {remarkError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
              {remarkError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wide">Remark</label>
            <textarea
              rows={3}
              value={tempRemark}
              onChange={e => setTempRemark(e.target.value)}
              placeholder="e.g. Excellent performance throughout the examination. Keep improving."
              className="w-full p-3.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs resize-none text-text-primary font-medium"
            />
            <div className="flex justify-between items-center text-[11px] text-text-muted mt-1 px-1">
              <span>Maximum 12 words</span>
              <span className={`font-semibold ${getWordCount(tempRemark) > 12 ? 'text-red-500 font-bold' : ''}`}>
                {getWordCount(tempRemark)} / 12 words
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setIsRemarkModalOpen(false)} disabled={remarkLoading}>
              Cancel
            </Button>
            <Button onClick={handleSaveRemark} disabled={remarkLoading}>
              {remarkLoading ? 'Saving...' : 'Save Remark'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Select Class for Final Academic Report Card Modal */}
      <Dialog
        isOpen={isSelectClassForFinalReportOpen}
        onClose={() => setIsSelectClassForFinalReportOpen(false)}
        title="Final Academic Report Card"
        description="Select a class to generate and view consolidated session report cards combining all conducted tests."
      >
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wide">Select Class</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {(classes || []).map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => {
                    setIsSelectClassForFinalReportOpen(false);
                    handleOpenFinalSessionReportCards(cls.id);
                  }}
                  className="flex items-center justify-between p-3 border border-border rounded-xl hover:border-emerald-500 hover:bg-emerald-500/5 transition-all text-left font-bold text-xs text-text-primary group"
                >
                  <span className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    {cls.name} {cls.section ? `(${cls.section})` : ''}
                  </span>
                  <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-emerald-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setIsSelectClassForFinalReportOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Contact Super Admin Modal */}
      <ContactSuperAdminDialog 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)}
        message="Please get in touch with the ShikshaPilot Support Team using any of the contact methods below for assistance with report card template assignment, account setup, or queries."
        description=""
      />

    </div>
  );
}
