import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, ArrowLeft, Calendar, Clock, BookOpen, UserCheck, 
  Settings, Award, Printer, Trash, FileText, CheckCircle, 
  XCircle, Save, AlertCircle, Edit3, Trash2, LayoutDashboard, ChevronRight, Download, X,
  Users, Check, RotateCcw
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
import ReportCardRenderer from '../../report-card-templates/ReportCardRenderer';
import { compileFinalSessionReportCardData } from '../../../common/services/reportCardEngine';

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
  const todayStr = getTodayLocalDateString();
  let baseDateStr = (exam.start_date && exam.start_date > todayStr) ? exam.start_date : todayStr;
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

const CalendarDatePicker = ({ value, onChange, min, max, required, className, onError, holidays }) => {
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
  const navigate = useNavigate();
  const { currentAcademicYear, isReadOnly } = useAcademicYear();
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'classes', 'timetable', 'marks', 'reports', 'grade_scale'
  
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

  // Local Report Cards State
  const [reportCards, setReportCards] = useState([]);
  const [selectedReportCard, setSelectedReportCard] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [isSchemeOpen, setIsSchemeOpen] = useState(false);
  const [pendingSubjects, setPendingSubjects] = useState([]);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [pendingValidationSource, setPendingValidationSource] = useState(''); // 'reports' or 'publish'

  // Final Session Report Cards State
  const [finalSessionReportCards, setFinalSessionReportCards] = useState([]);
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

  const handleResetGradesDefault = () => {
    setGradeScales([
      { min_percentage: 91, max_percentage: 100, grade: 'A+', grade_point: 10, remark: 'Outstanding' },
      { min_percentage: 81, max_percentage: 90, grade: 'A', grade_point: 9, remark: 'Excellent' },
      { min_percentage: 71, max_percentage: 80, grade: 'B+', grade_point: 8, remark: 'Very Good' },
      { min_percentage: 61, max_percentage: 70, grade: 'B', grade_point: 7, remark: 'Good' },
      { min_percentage: 51, max_percentage: 60, grade: 'C', grade_point: 6, remark: 'Average' },
      { min_percentage: 41, max_percentage: 50, grade: 'D', grade_point: 5, remark: 'Pass' },
      { min_percentage: 0, max_percentage: 40, grade: 'F', grade_point: 0, remark: 'Fail' }
    ]);
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
      setClasses(classesList || []);
      setSubjects(subjectsList || []);
      setHolidays(holidaysList || []);
      setGradeScales(gradesList || []);
      if (profile) {
        setSchoolProfile(profile);
        setReportCardRemark(profile.report_card_remark || '');
      }
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
    if (info) {
      const timer = setTimeout(() => setInfo(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [info]);

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

  // Scroll to top when view changes
  useEffect(() => {
    window.scrollTo(0, 0);
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [activeView]);

  // Quick Action counts
  const totalCount = exams.length;
  const upcomingCount = exams.filter(e => {
    const today = getTodayLocalDateString();
    return e.start_date && e.start_date > today;
  }).length;
  const ongoingCount = exams.filter(e => {
    const today = getTodayLocalDateString();
    return e.start_date && e.end_date && e.start_date <= today && e.end_date >= today;
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
      const [statuses, planDetails] = await Promise.all([
        schoolService.getExamClassStatuses(exam.id),
        schoolService.getSeatingPlan(exam.id).catch(() => null)
      ]);
      setExamClassStatuses(statuses || []);
      setHasSeatingPlan(!!(planDetails && planDetails.plan));
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

  const getExamMinStartDate = (targetExamId, examsList = []) => {
    const todayStr = getTodayLocalDateString();
    const sorted = [...examsList].sort((a, b) => getExamRank(a.name) - getExamRank(b.name) || (a.id - b.id));
    const targetIdx = targetExamId ? sorted.findIndex(e => e.id === targetExamId) : sorted.length;
    
    const preceding = sorted.filter((e, idx) => (targetIdx === -1 || idx < targetIdx) && e.id !== targetExamId && e.end_date);
    if (preceding.length === 0) return todayStr;

    const latestEndDate = preceding.reduce((max, e) => (e.end_date > max ? e.end_date : max), '');
    if (!latestEndDate) return todayStr;

    const dayAfter = addDays(latestEndDate, 1);
    return dayAfter > todayStr ? dayAfter : todayStr;
  };

  const getExamMaxEndDate = (targetExamId, examsList = []) => {
    const sorted = [...examsList].sort((a, b) => getExamRank(a.name) - getExamRank(b.name) || (a.id - b.id));
    const targetIdx = targetExamId ? sorted.findIndex(e => e.id === targetExamId) : -1;
    if (targetIdx === -1) return null;

    const succeeding = sorted.filter((e, idx) => idx > targetIdx && e.id !== targetExamId && e.start_date);
    if (succeeding.length === 0) return null;

    const earliestNextStart = succeeding.reduce((min, e) => (!min || e.start_date < min ? e.start_date : min), '');
    return earliestNextStart ? subDays(earliestNextStart, 1) : null;
  };

  // Form Handlers
  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!newExam.name || !newExam.start_date || !newExam.end_date || !newExam.publish_date) {
      setError('Please fill in all required fields.');
      return;
    }
    const minAllowedStart = getExamMinStartDate(null, exams);
    if (newExam.start_date && newExam.start_date < minAllowedStart) {
      setError(`Start Date cannot be before ${formatDateString(minAllowedStart)} because previous examinations are scheduled until then.`);
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
    setSelectedExamToEdit(exam);
    setEditExamData({
      id: exam.id,
      name: exam.name,
      start_date: exam.start_date || '',
      end_date: exam.end_date || '',
      publish_date: exam.publish_date || '',
      description: exam.description || ''
    });
    setIsEditExamOpen(true);
  };

  const handleUpdateExam = async (e) => {
    if (e) e.preventDefault();
    if (!editExamData.name) {
      setError('Please enter examination name.');
      return;
    }
    const todayStr = getTodayLocalDateString();
    if (editExamData.start_date && editExamData.start_date < todayStr) {
      setError('Start Date cannot be in the past.');
      return;
    }
    if (editExamData.end_date && editExamData.end_date < todayStr) {
      setError('End Date cannot be in the past.');
      return;
    }
    if (editExamData.publish_date && editExamData.publish_date < todayStr) {
      setError('Result Publish Date cannot be in the past.');
      return;
    }
    const minAllowedStart = getExamMinStartDate(editExamData.id, exams);
    if (editExamData.start_date && editExamData.start_date < minAllowedStart) {
      setError(`Start Date cannot be before ${formatDateString(minAllowedStart)} because previous examinations are scheduled until then.`);
      return;
    }
    const maxAllowedEnd = getExamMaxEndDate(editExamData.id, exams);
    if (editExamData.end_date && maxAllowedEnd && editExamData.end_date > maxAllowedEnd) {
      setError(`End Date cannot be after ${formatDateString(maxAllowedEnd)} because subsequent examination is scheduled to start on ${formatDateString(addDays(maxAllowedEnd, 1))}.`);
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

    // Check if dates have changed AND papers exist for this examination
    const datesChanged = selectedExamToEdit && (
      (editExamData.start_date && editExamData.start_date !== selectedExamToEdit.start_date) ||
      (editExamData.end_date && editExamData.end_date !== selectedExamToEdit.end_date)
    );
    const hasPapers = selectedExamToEdit && Number(selectedExamToEdit.papers_count || 0) > 0;

    if (datesChanged && hasPapers) {
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
    setIsEditExamOpen(false);
    setIsResetPapersConfirmOpen(false);
    try {
      await schoolService.updateExamination(editExamData.id, {
        ...editExamData,
        reset_papers: shouldResetPapers
      });
      setSuccess(
        shouldResetPapers 
          ? 'Examination dates updated successfully. Added papers and timetable scheme have been reset for new dates.' 
          : 'Examination updated successfully.'
      );
      await loadDashboard();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update examination.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExamPublishStatus = (exam) => {
    if (exam.status === 'Draft' && (!exam.start_date || !exam.end_date || !exam.publish_date)) {
      setError('Please edit the examination and configure Start Date, End Date, and Publish Date before publishing.');
      return;
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
      const nextStatus = togglePublishTarget.status === 'Draft' ? 'Published' : 'Draft';
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
    setError('');
    setInfo('');
    setSuccess('');
    if (!exam || !exam.start_date || !exam.end_date) {
      setInfo('Please edit and configure the examination period (Start Date and End Date) before scheduling paper timetables.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSelectedExam(exam);
    setSelectedClassId(classId.toString());
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
        exam_date: suggestNextExamDate(exam, list || [], holidays),
        start_time: '09:00',
        end_time: '11:00',
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

    const todayStr = getTodayLocalDateString();
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

    const isGradeType = newPaper.evaluation_type === 'grade';
    const finalMaxMarks = isGradeType ? 0 : maxMarksParsed;
    const finalPassingMarks = isGradeType ? 0 : passingMarksParsed;

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
            max_marks: finalMaxMarks,
            passing_marks: finalPassingMarks,
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
        max_marks: finalMaxMarks,
        passing_marks: finalPassingMarks,
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
        exam_date: suggestNextExamDate(selectedExam, refreshedList || [], holidays),
        start_time: newPaper.start_time || '09:00',
        end_time: newPaper.end_time || '11:00',
        evaluation_type: 'marks',
        grading_scale: 'A,B,C,D,E',
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
      const papers = await schoolService.getExamTimetable(exam.id, classId);
      
      // Step 1: Check papers exists
      if (!papers || papers.length === 0) {
        setPendingSubjects(['timetable_missing']);
        setPendingValidationSource('reports_empty_timetable');
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

  const handleOpenFinalSessionReportCards = async (classId) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      setSelectedClassId(classId.toString());
      
      // Fetch all examinations for school
      const allExamsList = (exams && exams.length > 0) ? exams : await schoolService.getExaminations();
      
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
      const sessionCards = Object.values(studentMap).map(cardsArray => 
        compileFinalSessionReportCardData(cardsArray, weightagePolicy, schoolProfile, currentAcademicYear)
      ).filter(Boolean);

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
    setSelectedReportCard(card);
    setIsReportCardOpen(true);
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
              border: 1px solid #e4e4e7 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: always !important;
              break-after: page !important;
              max-height: 275mm !important;
              overflow: hidden !important;
              margin: 0 auto !important;
            }
            .report-card-page-break {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
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

  const handleDownloadEntireClassPdf = async () => {
    if (!finalSessionReportCards || finalSessionReportCards.length === 0) return;
    setGeneratingClassPdf(true);

    const classNameClean = (classes.find(c => c.id === parseInt(selectedClassId))?.name || selectedClass?.name || 'Class').toString().replace(/\s+/g, '_');
    const sessionClean = (currentAcademicYear?.name || '2026-2027').replace(/[\s–—]+/g, '-');
    const filename = `Class_${classNameClean}_Final_Report_Cards_${sessionClean}`;

    try {
      await printNativeReportCardsContainer('printable-entire-class-container', filename);
    } catch (err) {
      console.error('Failed to generate class vector PDF:', err);
    } finally {
      setGeneratingClassPdf(false);
    }
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
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Examinations Module...</p>
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
    if (activeFilter === 'upcoming') return e.start_date && e.start_date > today;
    if (activeFilter === 'ongoing') return e.start_date && e.end_date && e.start_date <= today && e.end_date >= today;
    if (activeFilter === 'draft') return e.status === 'Draft';
    if (activeFilter === 'published') return e.status === 'Published';
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
              border: 1px solid #e4e4e7 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: always !important;
              break-after: page !important;
              max-height: 275mm !important;
              overflow: hidden !important;
              margin: 0 auto !important;
            }
          }
        `}} />

        {/* Top Sticky Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border p-4 rounded-xl shadow-xs sticky top-16 z-20 no-print">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-1.5 text-xs font-bold"
              onClick={() => { setSelectedReportCard(null); setIsReportCardOpen(false); }}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Student List
            </Button>
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
              onClick={() => window.print()}
              className="flex items-center gap-2 text-xs font-bold"
            >
              <Printer className="h-4 w-4" /> Print Report Card
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
              onClick={() => { setSelectedReportCard(null); setIsReportCardOpen(false); }}
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
      </div>
    );
  }

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
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Examinations</h2>
          <p className="text-text-secondary text-sm mt-1">Configure exams, manage timetables, enter marks, and generate student report cards.</p>
        </div>
        {activeView === 'dashboard' && !isReadOnly && (
          <div className="flex gap-2 sm:items-center">
            <Button className="flex items-center gap-2 font-bold" onClick={() => { setActiveView('grade_scale'); setGradeError(''); setGradeSuccess(''); }}>
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

      {/* VIEW 1: DASHBOARD */}
      {activeView === 'dashboard' && (
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
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
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold" onClick={() => handleOpenTimetable(selectedExam, currentClass.id)}>
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
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold" 
                        onClick={() => navigate('/school-admin/exams/seating-plan', { 
                          state: { 
                            examId: selectedExam.id, 
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
                        className="w-full flex items-center justify-center gap-2 text-xs font-bold" 
                        onClick={() => navigate('/school-admin/exams/question-paper-designer', { 
                          state: { 
                            examId: selectedExam?.id,
                            classId: currentClass?.id
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
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold" onClick={() => handleOpenMarksEntry(selectedExam, currentClass.id)}>
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
                          {selectedExam?.name ? `${selectedExam.name} Report Cards` : 'Exam Report Cards'}
                        </h4>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Generate, preview, print, or download individual exam report cards with automated class ranks, section ranks, and attendance.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold" onClick={() => handleOpenReportCards(selectedExam, currentClass.id)}>
                        <Award className="h-4 w-4" /> Open {selectedExam?.name || 'Exam'} Report Cards
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* CARD 5: Final Academic Report Cards (Annual Session Summary - Only for Annual Exam) */}
                {isAnnualExam && (
                  <Card className="hover:border-primary/20 transition-all shadow-xs flex flex-col justify-between">
                    <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-primary">
                          <Award className="h-5 w-5" />
                          <h4 className="text-base font-bold text-text-primary">Final Academic Report Card</h4>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          Generate consolidated annual session report cards combining marks from all session exams based on configurable calculation policies.
                        </p>
                      </div>
                      <div className="pt-2">
                        <Button className="w-full flex items-center justify-center gap-2 text-xs font-bold" onClick={() => handleOpenFinalSessionReportCards(currentClass.id)}>
                          <Award className="h-4 w-4" /> Open Final Session Reports
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
              <Card className="relative z-10">
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
                        <Select 
                          value={newPaper.subject_id} 
                          onChange={e => setNewPaper(p => ({ ...p, subject_id: e.target.value }))}
                          disabled={Boolean(editingPaper)}
                          required
                        >
                          <option value="">-- Choose Subject --</option>
                          {classSubjects.map(s => {
                            const isCreated = timetablePapers.some(p => p.subject_id === s.id && (!editingPaper || editingPaper.subject_id !== s.id));
                            return (
                              <option key={s.id} value={s.id}>
                                {s.name}{isCreated ? ' (Created)' : ''}
                              </option>
                            );
                          })}
                        </Select>
                      </div>

                      {/* Exam Date */}
                      <div className="space-y-1.5 font-sans">
                        <label className="text-xs font-bold text-text-secondary uppercase">Exam Date</label>
                        <CalendarDatePicker
                          min={(() => {
                            const todayStr = getTodayLocalDateString();
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
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      {/* Evaluation Type */}
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-text-secondary uppercase">Evaluation Type</label>
                        <Select 
                          value={newPaper.evaluation_type || 'marks'} 
                          onChange={e => {
                            const evalType = e.target.value;
                            setNewPaper(p => ({
                              ...p,
                              evaluation_type: evalType,
                              max_marks: evalType === 'grade' ? '0' : (p.max_marks || '100'),
                              passing_marks: evalType === 'grade' ? '0' : (p.passing_marks || '40')
                            }));
                          }}
                        >
                          <option value="marks">Marks Based (0-100)</option>
                          <option value="grade">Grade Based (A, B, C, D)</option>
                        </Select>
                      </div>

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

                      {newPaper.evaluation_type === 'grade' ? (
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">Grading Scale (Direct Grade)</label>
                          <Select 
                            value={newPaper.grading_scale || 'A,B,C,D,E'} 
                            onChange={e => setNewPaper(p => ({ ...p, grading_scale: e.target.value }))}
                          >
                            <option value="A+,A,B,C,D,E">5-Tier Scale (A+, A, B, C, D, E)</option>
                            <option value="A,B,C,D">4-Tier Scale (A, B, C, D)</option>
                          </Select>
                        </div>
                      ) : (
                        <>
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
            <Card>
              <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row justify-between items-center space-y-0">
                <CardTitle className="text-sm font-bold text-text-primary">Exam Papers</CardTitle>
                {timetablePapers.length > 0 && (() => {
                  const isSchemePublished = examClassStatuses.find(c => c.id === parseInt(selectedClassId))?.scheme_published === 1;
                  return (
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
                  );
                })()}
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Max Marks</TableHead>
                    <TableHead>Passing Marks</TableHead>
                    {!isReadOnly && (examClassStatuses.find(c => c.id === parseInt(selectedClassId))?.status || 'Draft') === 'Draft' && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timetablePapers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-text-muted">
                        No papers scheduled for this examination yet. Use the form above to add papers.
                      </TableCell>
                    </TableRow>
                  ) : timetablePapers.map((paper, idx) => {
                    const isGradePaper = paper.evaluation_type === 'grade' || parseFloat(paper.max_marks) === 0;
                    return (
                      <TableRow key={idx}>
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
                      {!isReadOnly && (examClassStatuses.find(c => c.id === parseInt(selectedClassId))?.status || 'Draft') === 'Draft' && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownItem onClick={() => {
                              setEditingPaper(paper);
                              setNewPaper({
                                subject_id: paper.subject_id.toString(),
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
                    const currentPaper = timetablePapers.find(p => p.subject_id.toString() === selectedSubjectId);
                    const isGradeSheet = marksSheet.evaluation_type === 'grade' || parseFloat(marksSheet.max_marks) === 0 || currentPaper?.evaluation_type === 'grade';

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
                          {isGradeSheet ? (
                            <Select
                              className="h-8 text-xs font-bold w-full"
                              disabled={s.is_absent === 1 || isReadOnlyField}
                              value={s.is_absent === 1 ? '' : (s.marks_obtained || '')}
                              onChange={e => handleMarkCellChange(s.student_id, 'marks_obtained', e.target.value)}
                            >
                              <option value="">-- Grade --</option>
                              <option value="A+">Grade A+</option>
                              <option value="A">Grade A</option>
                              <option value="B">Grade B</option>
                              <option value="C">Grade C</option>
                              <option value="D">Grade D</option>
                              <option value="E">Grade E</option>
                            </Select>
                          ) : (
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
      {activeView === 'grade_scale' && (
        <div className="space-y-6 animate-in fade-in duration-300 no-print">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" className="flex items-center gap-1.5 text-xs font-bold" onClick={() => { setActiveView('dashboard'); setGradeError(''); setGradeSuccess(''); }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
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
                          Remove Remark
                        </Button>
                      ) : (
                        <Button variant="outline" className="h-8 text-xs font-bold" onClick={handleOpenRemarkModal}>
                          Add Remark
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
                  <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Report Card Remark</span>
                  {reportCardRemark ? (
                    <p className="text-xs text-green-700 dark:text-green-400 font-bold italic leading-relaxed">
                      "{reportCardRemark}"
                    </p>
                  ) : (
                    <p className="text-xs text-text-muted italic leading-relaxed">
                      No report card remark has been configured.
                    </p>
                  )}
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grade Code</TableHead>
                        <TableHead>Min Percentage (%)</TableHead>
                        <TableHead>Max Percentage (%)</TableHead>
                        <TableHead>Grade Points</TableHead>
                        <TableHead>Remarks</TableHead>
                        {!isReadOnly && <TableHead className="text-right w-20">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradeScales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isReadOnly ? 5 : 6} className="text-center py-6 text-text-muted text-xs">
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
                              className="h-8 text-xs font-mono max-w-[120px]"
                              onChange={e => handleGradeFieldChange(idx, 'min_percentage', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={s.max_percentage}
                              disabled={isReadOnly}
                              className="h-8 text-xs font-mono max-w-[120px]"
                              onChange={e => handleGradeFieldChange(idx, 'max_percentage', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={s.grade_point}
                              disabled={isReadOnly}
                              className="h-8 text-xs font-mono max-w-[100px]"
                              onChange={e => handleGradeFieldChange(idx, 'grade_point', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input aria-label="e.g. Excellent"
                              value={s.remark || ''}
                              placeholder="e.g. Excellent"
                              disabled={isReadOnly}
                              className="h-8 text-xs max-w-[200px]"
                              onChange={e => handleGradeFieldChange(idx, 'remark', e.target.value)}
                            />
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleRemoveGradeRow(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
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
      {activeView === 'final_reports' && (
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
                border: 1px solid #e4e4e7 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: always !important;
                break-after: page !important;
                max-height: 275mm !important;
                overflow: hidden !important;
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
            <div id="printable-entire-class-container" className="w-[194mm]">
              {finalSessionReportCards.map((card, idx) => (
                <div key={card.student?.id || idx} className="report-card-page-break bg-white mb-6">
                  <ReportCardRenderer
                    card={card}
                    schoolProfile={schoolProfile}
                    currentYear={currentAcademicYear}
                    exam={{ name: 'FINAL ACADEMIC REPORT CARD', is_final_session_report: true }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => setActiveView('classes')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="text-xl font-bold text-text-primary">Final Academic Report Cards</h3>
                <p className="text-xs text-text-secondary">
                  Annual Session Summary — Class: {classes.find(c => c.id === parseInt(selectedClassId))?.name || ''} | Session: {currentAcademicYear?.name || '2026–2027'}
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
        title={togglePublishTarget?.status === 'Draft' ? "Publish Examination" : "Move Examination to Draft"}
        footer={<>
          <Button variant="secondary" onClick={() => setShowTogglePublishModal(false)}>Cancel</Button>
          <Button 
            className={togglePublishTarget?.status === 'Draft' ? "bg-green-600 hover:bg-green-700 text-white font-bold" : "bg-rose-600 hover:bg-rose-700 text-white font-bold"} 
            onClick={confirmToggleExamPublishStatus} 
            disabled={submitting}
          >
            {submitting ? 'Updating...' : (togglePublishTarget?.status === 'Draft' ? 'Publish' : 'Revert to Draft')}
          </Button>
        </>}>
        <div className="space-y-3 p-1">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
            togglePublishTarget?.status === 'Draft' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'
          }`}>
            {togglePublishTarget?.status === 'Draft' ? <CheckCircle className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
          </div>
          <p className="text-xs text-center text-text-secondary leading-relaxed font-semibold">
            {togglePublishTarget?.status === 'Draft' ? (
              `You are about to publish "${togglePublishTarget?.name}". Once published, this examination will start showing up in the student/parent mobile application. Do you want to continue?`
            ) : (
              `Are you sure you want to move "${togglePublishTarget?.name}" back to Draft? Once reverted to draft, this examination will disappear from the mobile application. Do you want to continue?`
            )}
          </p>
        </div>
      </Dialog>

      {/* CREATE EXAM DIALOG */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}
        title="Create Examination" description="Define details for a new school-wide examination."
        footer={<>
          <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateExam} disabled={submitting}>{submitting ? 'Creating...' : 'Create Examination'}</Button>
        </>}>
        <form onSubmit={handleCreateExam} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="examination-name" className="text-xs font-bold text-text-secondary uppercase">Examination Name</label>
            <Input id="examination-name" placeholder="e.g. Half Yearly, Pre Board, Unit Test 1" value={newExam.name} onChange={e => setNewExam(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Start Date</label>
              <Input 
                type="date" 
                min={getExamMinStartDate(null, exams)} 
                value={newExam.start_date} 
                onChange={e => setNewExam(p => ({ ...p, start_date: e.target.value }))} 
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">End Date</label>
              <Input 
                type="date" 
                min={newExam.start_date || getExamMinStartDate(null, exams)} 
                value={newExam.end_date} 
                onChange={e => setNewExam(p => ({ ...p, end_date: e.target.value }))} 
                required 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Result Publish Date</label>
            <Input 
              type="date" 
              min={newExam.end_date || newExam.start_date || getExamMinStartDate(null, exams)} 
              value={newExam.publish_date} 
              onChange={e => setNewExam(p => ({ ...p, publish_date: e.target.value }))} 
              required 
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description-optional" className="text-xs font-bold text-text-secondary uppercase">Description (Optional)</label>
            <Input id="description-optional" placeholder="Brief details about terms or exam guidelines" value={newExam.description} onChange={e => setNewExam(p => ({ ...p, description: e.target.value }))} />
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
            <label htmlFor="examination-name-2" className="text-xs font-bold text-text-secondary uppercase">Examination Name</label>
            <Input id="examination-name-2" placeholder="e.g. Half Yearly, Pre Board, Unit Test 1" value={editExamData.name} onChange={e => setEditExamData(p => ({ ...p, name: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-text-secondary uppercase">Start Date</label>
               <Input 
                 type="date" 
                 min={getExamMinStartDate(editExamData.id, exams)} 
                 value={editExamData.start_date || ''} 
                 onChange={e => setEditExamData(p => ({ ...p, start_date: e.target.value }))} 
               />
            </div>
            <div className="space-y-1.5">
               <label className="text-xs font-bold text-text-secondary uppercase">End Date</label>
               <Input 
                 type="date" 
                 min={editExamData.start_date || getExamMinStartDate(editExamData.id, exams)} 
                 max={getExamMaxEndDate(editExamData.id, exams) || undefined}
                 value={editExamData.end_date || ''} 
                 onChange={e => setEditExamData(p => ({ ...p, end_date: e.target.value }))} 
               />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Result Publish Date</label>
            <Input 
              type="date" 
              min={editExamData.end_date || editExamData.start_date || getExamMinStartDate(editExamData.id, exams)} 
              value={editExamData.publish_date || ''} 
              onChange={e => setEditExamData(p => ({ ...p, publish_date: e.target.value }))} 
            />
          </div>
        </form>
      </Dialog>

      {/* RESET PAPERS CONFIRMATION DIALOG */}
      <Dialog isOpen={isResetPapersConfirmOpen} onClose={() => setIsResetPapersConfirmOpen(false)}
        title="Modify Examination Dates & Reset Papers?"
        footer={<>
          <Button variant="secondary" onClick={() => { setIsResetPapersConfirmOpen(false); setIsEditExamOpen(true); }}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={() => executeExamUpdate(true)} disabled={submitting}>
            {submitting ? 'Updating & Resetting...' : 'Yes, Update Dates & Reset Papers'}
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
                      <h2 className="text-2xl font-bold uppercase tracking-tight font-display">
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
                            <th className={`border-r border-zinc-400 font-bold uppercase text-zinc-900 whitespace-nowrap w-[25%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Subject</th>
                            <th className={`border-r border-zinc-400 font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[25%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Date</th>
                            <th className={`border-r border-zinc-400 font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[35%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Time</th>
                            <th className={`font-bold uppercase text-center text-zinc-900 whitespace-nowrap w-[15%] ${scaling.tableFontSize} ${scaling.tablePadding}`}>Max Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timetablePapers.map((paper, idx) => (
                            <tr key={idx} className="border-b border-zinc-300 text-zinc-900">
                              <td className={`border-r border-zinc-400 font-semibold whitespace-nowrap ${scaling.tableFontSize} ${scaling.tablePadding}`}>{paper.subject_name}</td>
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
                <Button type="button" onClick={() => window.print()} className="flex items-center gap-2 font-bold py-1.5 px-3">
                  <Printer className="h-4 w-4" /> Print Report Card
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


    </div>
  );
}
