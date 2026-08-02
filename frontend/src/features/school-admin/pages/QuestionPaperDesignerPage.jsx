import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash, Trash2, Copy, Save, Printer, Download, Search, 
  Settings, CheckCircle, AlertCircle, Edit, ChevronUp, ChevronDown, 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Image, Table as TableIcon, Heading, HelpCircle, Eye, 
  Type, Scissors, FileText, FolderOpen, LayoutTemplate, RotateCw, Grid,
  Maximize2, ArrowRight, CornerRightDown, PlusCircle, Sparkles, RefreshCw, FileSpreadsheet,
  Square, Circle, MoveRight, HelpCircle as HelpIcon, Minus, Type as TextIcon,
  Palette, Info
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import html2pdf from 'html2pdf.js';

const getClassOrderIndex = (className) => {
  if (!className) return 999;
  const str = String(className).toLowerCase().trim();

  if (str.includes('playgroup') || str.includes('pg')) return 1;
  if (str.includes('nursery')) return 2;
  if (str.includes('lkg') || str.includes('lower kg')) return 3;
  if (str.includes('ukg') || str.includes('upper kg') || str.includes('kg')) return 4;

  const numMatch = str.match(/\d+/);
  if (numMatch) {
    return 10 + parseInt(numMatch[0], 10);
  }

  return 900;
};

const sortClassNames = (classList) => {
  return [...classList].sort((a, b) => {
    const orderA = getClassOrderIndex(a);
    const orderB = getClassOrderIndex(b);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  });
};

// Predefined Exam Templates
const PAPER_TEMPLATES = {
  blank: {
    name: 'Blank Paper',
    maxMarks: 100,
    duration: '3 Hours',
    instructions: '1. All questions are compulsory.\n2. Write clearly and legibly.\n3. Figures to the right indicate full marks.',
    questions: []
  },
  unit_test: {
    name: 'Unit Test',
    maxMarks: 20,
    duration: '1 Hour',
    instructions: '1. Attempt all questions.\n2. Draw diagrams where necessary.\n3. Keep your answers brief and to the point.',
    questions: [
      {
        id: 'q-ut-1',
        type: 'mcq',
        marks: 2,
        text: 'What is the value of 5 + 5?',
        options: ['5', '10', '15', '20'],
        subQuestions: []
      },
      {
        id: 'q-ut-2',
        type: 'fill_blanks',
        marks: 2,
        text: 'Water boils at _______ degrees Celsius.',
        subQuestions: []
      },
      {
        id: 'q-ut-3',
        type: 'true_false',
        marks: 2,
        text: 'The sun rises in the West.',
        subQuestions: []
      },
      {
        id: 'q-ut-4',
        type: 'short_answer',
        marks: 4,
        text: 'Define Photosynthesis and write its basic chemical equation.',
        subQuestions: []
      },
      {
        id: 'q-ut-5',
        type: 'long_answer',
        marks: 10,
        text: 'Explain the water cycle in detail with the help of a labeled diagram.',
        subQuestions: []
      }
    ]
  },
  half_yearly: {
    name: 'Half Yearly Examination',
    maxMarks: 80,
    duration: '3 Hours',
    instructions: '1. Section A contains 10 MCQs of 1 mark each.\n2. Section B contains 5 short answer questions of 4 marks each.\n3. Section C contains 5 long answer questions of 10 marks each.',
    questions: [
      {
        id: 'q-hy-1',
        type: 'mcq',
        marks: 5,
        text: 'Identify the state of matter which has a fixed volume but no fixed shape:',
        options: ['Solid', 'Liquid', 'Gas', 'Plasma'],
        subQuestions: [
          { id: 'q-hy-1-sub-1', text: 'Which has high compressibility?', marks: 1 },
          { id: 'q-hy-1-sub-2', text: 'Which has high density?', marks: 1 }
        ]
      },
      {
        id: 'q-hy-2',
        type: 'matching',
        marks: 5,
        text: 'Match the following elements with their symbols:',
        matchingColumns: {
          left: ['Oxygen', 'Gold', 'Silver', 'Iron', 'Sodium'],
          right: ['Ag', 'Na', 'Fe', 'O', 'Au']
        },
        subQuestions: []
      },
      {
        id: 'q-hy-3',
        type: 'fill_blanks',
        marks: 5,
        text: 'Light travels in a ____________ line.',
        subQuestions: []
      },
      {
        id: 'q-hy-4',
        type: 'short_answer',
        marks: 15,
        text: 'Briefly answer the following short questions:',
        subQuestions: [
          { id: 'q-hy-4-sub-1', text: 'Define acceleration.', marks: 5 },
          { id: 'q-hy-4-sub-2', text: 'State Newton\'s Second Law of Motion.', marks: 5 },
          { id: 'q-hy-4-sub-3', text: 'What is inertia?', marks: 5 }
        ]
      }
    ]
  },
  annual: {
    name: 'Annual Examination',
    maxMarks: 100,
    duration: '3 Hours',
    instructions: '1. All questions are mandatory.\n2. Read all instructions carefully before writing.\n3. Check your answers before submitting.',
    questions: [
      {
        id: 'q-an-1',
        type: 'mcq',
        marks: 5,
        text: 'Select the correct option from the following:',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        subQuestions: []
      },
      {
        id: 'q-an-2',
        type: 'short_answer',
        marks: 15,
        text: 'Write short notes on:',
        subQuestions: [
          { id: 'q-an-2-sub-1', text: 'Global Warming', marks: 5 },
          { id: 'q-an-2-sub-2', text: 'Deforestation', marks: 5 },
          { id: 'q-an-2-sub-3', text: 'Rainwater Harvesting', marks: 5 }
        ]
      }
    ]
  },
  practical: {
    name: 'Practical Examination',
    maxMarks: 50,
    duration: '2 Hours',
    instructions: '1. Perform the experiment safely.\n2. Record your readings in the table provided.\n3. Show calculations clearly.',
    questions: [
      {
        id: 'q-pr-1',
        type: 'case_study',
        marks: 10,
        text: 'A student sets up a circuit with a battery, resistor, and ammeter. Answer the following questions based on this setup:',
        subQuestions: []
      }
    ]
  },
  olympiad: {
    name: 'Olympiad Challenge',
    maxMarks: 50,
    duration: '1.5 Hours',
    instructions: '1. No negative marking.\n2. Select the most appropriate option.\n3. Scratch work can be done in the margins.',
    questions: [
      {
        id: 'q-ol-1',
        type: 'mcq',
        marks: 5,
        text: 'Solve: 125 * 5 + 25 / 5 = ?',
        options: ['630', '650', '605', '625'],
        subQuestions: []
      }
    ]
  }
};

const MATH_TEMPLATES = [
  {
    label: 'Fraction (a/b)',
    icon: 'a/b',
    html: '<span class="inline-flex flex-col items-center justify-center align-middle mx-1" style="font-size:0.9em; line-height:1;"><span class="border-b border-black pb-0.5 min-w-[15px] text-center" style="outline:none;">x</span><span class="pt-0.5 min-w-[15px] text-center" style="outline:none;">y</span></span>'
  },
  {
    label: 'Square Root (√x)',
    icon: '√x',
    html: '<span class="inline-block align-middle mx-1" style="font-family:sans-serif;">&radic;<span class="border-t border-black px-0.5">x</span></span>'
  },
  {
    label: 'Cube Root (³√x)',
    icon: '³√x',
    html: '<span class="inline-block align-middle mx-1" style="font-family:sans-serif;"><sup style="font-size:0.6em; margin-right:-4px; vertical-align:super;">3</sup>&radic;<span class="border-t border-black px-0.5">x</span></span>'
  },
  {
    label: 'Integral (∫)',
    icon: '∫',
    html: '<span class="inline-flex items-center align-middle mx-1"><span class="flex flex-col text-[0.65em] leading-none text-right pr-0.5 justify-between h-[1.8em]"><span>b</span><span>a</span></span><span class="text-xl font-serif leading-none">&int;</span><span class="pl-1">f(x)dx</span></span>'
  },
  {
    label: 'Summation (Σ)',
    icon: 'Σ',
    html: '<span class="inline-flex flex-col items-center align-middle mx-1 text-center leading-none"><span class="text-[0.6em]">n</span><span class="text-lg font-serif">&Sigma;</span><span class="text-[0.6em]">i=1</span></span><span class="pl-1 align-middle inline-block">x</span>'
  },
  {
    label: 'Limit (lim)',
    icon: 'lim',
    html: '<span class="inline-flex flex-col items-center align-middle mx-1 text-center leading-none"><span class="text-[0.85em] font-bold">lim</span><span class="text-[0.6em]">x &rarr; 0</span></span><span class="pl-1 align-middle inline-block">f(x)</span>'
  },
  {
    label: 'Matrix (2x2)',
    icon: '[ ]',
    html: '<span class="inline-flex items-center align-middle mx-1"><span class="text-xl font-light pr-1">[</span><span class="grid grid-cols-2 gap-1.5 text-center text-xs"><span>a</span><span>b</span><span>c</span><span>d</span></span><span class="text-xl font-light pl-1">]</span></span>'
  }
];

const GREEK_SYMBOLS = [
  { label: 'alpha', char: 'α', html: '<span class="inline-block font-serif mx-0.5">&alpha;</span>' },
  { label: 'beta', char: 'β', html: '<span class="inline-block font-serif mx-0.5">&beta;</span>' },
  { label: 'gamma', char: 'γ', html: '<span class="inline-block font-serif mx-0.5">&gamma;</span>' },
  { label: 'delta', char: 'δ', html: '<span class="inline-block font-serif mx-0.5">&delta;</span>' },
  { label: 'theta', char: 'θ', html: '<span class="inline-block font-serif mx-0.5">&theta;</span>' },
  { label: 'pi', char: 'π', html: '<span class="inline-block font-serif mx-0.5">&pi;</span>' },
  { label: 'sigma', char: 'σ', html: '<span class="inline-block font-serif mx-0.5">&sigma;</span>' },
  { label: 'omega', char: 'ω', html: '<span class="inline-block font-serif mx-0.5">&omega;</span>' },
  { label: 'lambda', char: 'λ', html: '<span class="inline-block font-serif mx-0.5">&lambda;</span>' },
  { label: 'mu', char: 'μ', html: '<span class="inline-block font-serif mx-0.5">&mu;</span>' }
];

const MATH_OPERATORS = [
  { char: '+', html: ' + ' },
  { char: '-', html: ' - ' },
  { char: '×', html: ' &times; ' },
  { char: '÷', html: ' &divide; ' },
  { char: '±', html: ' &plusmn; ' },
  { char: '=', html: ' = ' },
  { char: '≠', html: ' &ne; ' },
  { char: '≈', html: ' &asymp; ' },
  { char: '≤', html: ' &le; ' },
  { char: '≥', html: ' &ge; ' },
  { char: '∞', html: ' &infin; ' },
  { char: '∵', html: ' &#8757; ' },
  { char: '∴', html: ' &there4; ' },
  { char: 'Δ', html: ' &#916; ' },
  { char: '°', html: ' &deg; ' },
  { char: '^', html: '<sup>2</sup>' },
  { char: 'sub', html: '<sub>2</sub>' }
];

export default function QuestionPaperDesignerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentYear } = useAcademicYear();

  // Route State Props
  const initialExamId = location.state?.examId || '';
  const initialClassId = location.state?.classId || '';

  // Core States
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState({ name: 'School Hub International' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Zoom/scale States for identical PDF preview and zero global horizontal scrolling
  const [previewWidth, setPreviewWidth] = useState(720);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setPreviewWidth(entry.contentRect.width);
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const zoomFactor = Math.min(1, (previewWidth - 32) / 720);

  // Paper Settings State
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [paperTitle, setPaperTitle] = useState('Terminal Assessment');
  const [examName, setExamName] = useState(initialExamId);
  const [duration, setDuration] = useState('3 Hours');
  const [maxMarks, setMaxMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('33');
  const [instructions, setInstructions] = useState('1. All questions are compulsory.\n2. Write your answers neatly.\n3. Diagrams should be drawn using a pencil.');
  const [academicYearName, setAcademicYearName] = useState(currentYear?.name || new Date().getFullYear().toString());

  // Questions List
  const [questions, setQuestions] = useState([]);
  const [activeQuestionId, setActiveQuestionId] = useState(null);
  const [activeSubQuestionId, setActiveSubQuestionId] = useState(null);
  
  // Floating Images state
  const [floatingImages, setFloatingImages] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragPosStart, setDragPosStart] = useState({ x: 0, y: 0 });
  const [activeFloatingId, setActiveFloatingId] = useState(null);
  const [selectedFontSize, setSelectedFontSize] = useState('13px');
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);

  const [resizingId, setResizingId] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);

  // Live A4 Page Count & Height measurement for Live Print Preview
  const [docHeight, setDocHeight] = useState(1012);

  useEffect(() => {
    const updateDocHeight = () => {
      const el = document.getElementById('printable-question-paper-doc');
      if (el) {
        setDocHeight(el.scrollHeight);
      }
    };
    updateDocHeight();
    const timer = setTimeout(updateDocHeight, 150);
    return () => clearTimeout(timer);
  }, [questions, instructions, paperTitle, floatingImages, maxMarks, duration]);

  // Refs for synchronous upload handling (prevents React state race condition)
  const activeQuestionIdRef = useRef(null);
  const activeSubQuestionIdRef = useRef(null);
  const isFloatingUploadRef = useRef(false);

  // Modals & Popups Toggle
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const [isEquationOpen, setIsEquationOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);

  // Search & Replace State
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  // Version History State
  const [revisions, setRevisions] = useState([]);
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [savedPapersList, setSavedPapersList] = useState([]);
  const [librarySelectedClass, setLibrarySelectedClass] = useState(null);

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const triggerConfirm = (title, message, onConfirm) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Equation Editor State
  const [equationType, setEquationType] = useState('fraction');
  const [eqPartA, setEqPartA] = useState('');
  const [eqPartB, setEqPartB] = useState('');
  const [eqPartC, setEqPartC] = useState('');
  const [modalHtml, setModalHtml] = useState('');

  // Table Inserter State
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  // Image Upload State
  const fileInputRef = useRef(null);

  // Drawing Editor State
  const [shapes, setShapes] = useState([]);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [drawingTool, setDrawingTool] = useState('select'); // select, rect, circle, line, arrow, text, free, blank
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [textVal, setTextVal] = useState('Text');
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  // Live total marks
  const [totalMarks, setTotalMarks] = useState(0);

  // Undo/Redo Editor States
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load initial data
  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      try {
        const [classesList, examsList, profile] = await Promise.all([
          schoolService.getClasses().catch(() => []),
          schoolService.getExaminations().catch(() => []),
          schoolService.getSchoolProfile().catch(() => ({ name: 'School Hub International' }))
        ]);
        setClasses(classesList || []);
        setExams(examsList || []);
        if (profile) setSchoolProfile(profile);

        // Pre-fill fields based on exam ID
        if (initialExamId && examsList) {
          const selected = examsList.find(e => String(e.id) === String(initialExamId));
          if (selected) {
            setPaperTitle(selected.name);
            setExamName(selected.id);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to initialize paper settings.');
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [initialExamId]);

  // Load subjects dynamically on class change
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!selectedClassId) {
        setSubjects([]);
        return;
      }
      try {
        const list = await schoolAdminService.getSubjects({ class_id: selectedClassId });
        setSubjects(list || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSubjects();
  }, [selectedClassId]);

  // Calculate live marks
  useEffect(() => {
    let sum = 0;
    questions.forEach(q => {
      sum += parseFloat(q.marks) || 0;
    });
    setTotalMarks(sum);
  }, [questions]);

  // Auto-Save Effect (every 10 seconds)
  useEffect(() => {
    const autoSaveTimer = setInterval(() => {
      saveDraftSilently();
    }, 10000);

    return () => clearInterval(autoSaveTimer);
  }, [selectedClassId, selectedSubjectId, paperTitle, examName, duration, maxMarks, passingMarks, instructions, academicYearName, questions]);

  // Handle local state undo/redo
  const recordHistory = (newQuestions) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, JSON.parse(JSON.stringify(newQuestions))]);
    setHistoryIndex(nextHistory.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setQuestions(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setQuestions(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + S (Save draft)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDraft();
      }
      // Ctrl + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl + Y (Redo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl + B (Bold)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
      }
      // Ctrl + I (Italic)
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
      }
      // Ctrl + U (Underline)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false, null);
      }
      // Delete (Delete shape if drawing editor is active)
      if (e.key === 'Delete' && selectedShapeId && isDrawingOpen) {
        e.preventDefault();
        deleteSelectedShape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, selectedShapeId, isDrawingOpen]);

  // Auto-Save Draft in LocalStorage
  const saveDraftSilently = () => {
    if (!selectedClassId) return;
    const paperState = {
      id: currentPaperId,
      selectedClassId,
      selectedSubjectId,
      paperTitle,
      examName,
      duration,
      maxMarks,
      passingMarks,
      instructions,
      academicYearName,
      questions,
      floatingImages,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
    
    // Auto-save should also update the saved paper in library if it already has an ID!
    if (currentPaperId) {
      const savedPapers = JSON.parse(localStorage.getItem('qpd_saved_papers') || '[]');
      const existingIndex = savedPapers.findIndex(p => p.id === currentPaperId);
      if (existingIndex > -1) {
        const classObj = classes.find(c => String(c.id) === String(selectedClassId));
        const subjectObj = subjects.find(s => String(s.id) === String(selectedSubjectId));
        paperState.className = classObj ? classObj.name : 'Unknown Class';
        paperState.subjectName = subjectObj ? subjectObj.name : 'Unknown Subject';
        
        const updatedPapers = [...savedPapers];
        updatedPapers[existingIndex] = paperState;
        localStorage.setItem('qpd_saved_papers', JSON.stringify(updatedPapers));
        setSavedPapersList(updatedPapers);
      }
    }
  };

  const saveDraft = () => {
    if (!selectedClassId) {
      setError('Please select a class before saving draft.');
      return;
    }
    
    // Find class name and subject name
    const classObj = classes.find(c => String(c.id) === String(selectedClassId));
    const subjectObj = subjects.find(s => String(s.id) === String(selectedSubjectId));
    const className = classObj ? classObj.name : 'Unknown Class';
    const subjectName = subjectObj ? subjectObj.name : 'Unknown Subject';

    let paperId = currentPaperId;
    if (!paperId) {
      paperId = 'paper-' + Date.now();
      setCurrentPaperId(paperId);
    }

    const paperState = {
      id: paperId,
      selectedClassId,
      selectedSubjectId,
      className,
      subjectName,
      paperTitle,
      examName,
      duration,
      maxMarks,
      passingMarks,
      instructions,
      academicYearName,
      questions,
      floatingImages,
      lastSaved: new Date().toISOString()
    };
    
    // Save draft
    localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));

    // Save to saved papers library
    const savedPapers = JSON.parse(localStorage.getItem('qpd_saved_papers') || '[]');
    const existingIndex = savedPapers.findIndex(p => p.id === paperId);
    let updatedPapers;
    if (existingIndex > -1) {
      updatedPapers = [...savedPapers];
      updatedPapers[existingIndex] = paperState;
    } else {
      updatedPapers = [paperState, ...savedPapers];
    }
    localStorage.setItem('qpd_saved_papers', JSON.stringify(updatedPapers));
    setSavedPapersList(updatedPapers);

    // Save to paper-specific revisions list
    const revisionKey = `qpd_revisions_${paperId}`;
    const currentRevisions = JSON.parse(localStorage.getItem(revisionKey) || '[]');
    const newRevision = {
      id: 'rev-' + Date.now(),
      timestamp: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
      title: paperTitle || 'Untitled Paper',
      questionCount: questions.length,
      paperState
    };
    const updatedRevisions = [newRevision, ...currentRevisions].slice(0, 15);
    localStorage.setItem(revisionKey, JSON.stringify(updatedRevisions));
    setRevisions(updatedRevisions);

    setSuccess('Paper saved successfully to your library!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Restore Draft on mount if available
  useEffect(() => {
    const saved = localStorage.getItem('qpd_current_draft');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.id) setCurrentPaperId(state.id);
        if (state.selectedClassId) setSelectedClassId(state.selectedClassId);
        if (state.selectedSubjectId) setSelectedSubjectId(state.selectedSubjectId);
        if (state.paperTitle) setPaperTitle(state.paperTitle);
        if (state.examName) setExamName(state.examName);
        if (state.duration) setDuration(state.duration);
        if (state.maxMarks) setMaxMarks(state.maxMarks);
        if (state.passingMarks) setPassingMarks(state.passingMarks);
        if (state.instructions) setInstructions(state.instructions);
        if (state.academicYearName) setAcademicYearName(state.academicYearName);
        if (state.questions) {
          setQuestions(state.questions);
          setHistory([JSON.parse(JSON.stringify(state.questions))]);
          setHistoryIndex(0);
        }
        if (state.floatingImages) {
          setFloatingImages(state.floatingImages);
        } else {
          setFloatingImages([]);
        }
        if (state.id) {
          const revisionKey = `qpd_revisions_${state.id}`;
          const savedRevisions = JSON.parse(localStorage.getItem(revisionKey) || '[]');
          setRevisions(savedRevisions);
        }
      } catch (err) {
        console.error('Failed to parse draft state', err);
      }
    } else {
      const savedRevisions = JSON.parse(localStorage.getItem('qpd_revisions') || '[]');
      setRevisions(savedRevisions);
    }

    // Load saved papers library
    const savedList = JSON.parse(localStorage.getItem('qpd_saved_papers') || '[]');
    setSavedPapersList(savedList);
  }, []);

  const handleNewPaper = () => {
    const startNew = () => {
      setCurrentPaperId(null);
      setSelectedClassId('');
      setSelectedSubjectId('');
      setPaperTitle('Terminal Assessment');
      setExamName('');
      setDuration('3 Hours');
      setMaxMarks('100');
      setPassingMarks('33');
      setInstructions('1. All questions are compulsory.\n2. Write your answers neatly.\n3. Diagrams should be drawn using a pencil.');
      setQuestions([]);
      setFloatingImages([]);
      setHistory([]);
      setHistoryIndex(-1);
      localStorage.removeItem('qpd_current_draft');
      setSuccess('Started a new paper template.');
      setTimeout(() => setSuccess(''), 3000);
    };

    if (questions.length > 0) {
      triggerConfirm(
        'Start New Paper',
        'Starting a new paper will clear the current editor. Make sure you have saved your work. Do you want to continue?',
        startNew
      );
    } else {
      startNew();
    }
  };

  const handleLoadSavedPaper = (paper) => {
    const loadPaper = () => {
      setCurrentPaperId(paper.id);
      if (paper.selectedClassId) setSelectedClassId(paper.selectedClassId);
      if (paper.selectedSubjectId) setSelectedSubjectId(paper.selectedSubjectId);
      if (paper.paperTitle) setPaperTitle(paper.paperTitle);
      if (paper.examName) setExamName(paper.examName);
      if (paper.duration) setDuration(paper.duration);
      if (paper.maxMarks) setMaxMarks(paper.maxMarks);
      if (paper.passingMarks) setPassingMarks(paper.passingMarks);
      if (paper.instructions) setInstructions(paper.instructions);
      if (paper.academicYearName) setAcademicYearName(paper.academicYearName);
      if (paper.questions) {
        setQuestions(paper.questions);
        setHistory([JSON.parse(JSON.stringify(paper.questions))]);
        setHistoryIndex(0);
      }
      if (paper.floatingImages) {
        setFloatingImages(paper.floatingImages);
      } else {
        setFloatingImages([]);
      }
      localStorage.setItem('qpd_current_draft', JSON.stringify(paper));
      const revisionKey = `qpd_revisions_${paper.id}`;
      const savedRevisions = JSON.parse(localStorage.getItem(revisionKey) || '[]');
      setRevisions(savedRevisions);
      setIsLibraryOpen(false);
      setSuccess(`Loaded paper: ${paper.paperTitle || 'Untitled'}`);
      setTimeout(() => setSuccess(''), 3000);
    };

    if (questions.length > 0) {
      triggerConfirm(
        'Load Saved Paper',
        'Loading this paper will overwrite the current editor. Do you want to continue?',
        loadPaper
      );
    } else {
      loadPaper();
    }
  };

  const handleDeleteSavedPaper = (id) => {
    triggerConfirm(
      'Delete Saved Paper',
      'Are you sure you want to delete this paper from your library?',
      () => {
        const savedPapers = JSON.parse(localStorage.getItem('qpd_saved_papers') || '[]');
        const updated = savedPapers.filter(p => p.id !== id);
        localStorage.setItem('qpd_saved_papers', JSON.stringify(updated));
        setSavedPapersList(updated);
        localStorage.removeItem(`qpd_revisions_${id}`);
        if (currentPaperId === id) {
          setCurrentPaperId(null);
        }
        
        // Return to class list if no papers left in currently selected class
        const clsNameOfDeleted = savedPapers.find(p => p.id === id)?.className || 'Unassigned Class';
        const remainingInClass = updated.filter(p => (p.className || 'Unassigned Class') === clsNameOfDeleted);
        if (remainingInClass.length === 0) {
          setLibrarySelectedClass(null);
        }

        setSuccess('Paper deleted from library.');
        setTimeout(() => setSuccess(''), 3000);
      }
    );
  };

  // Restore previous revision
  const handleRestoreRevision = (rev) => {
    const state = rev.paperState;
    if (state.id) setCurrentPaperId(state.id);
    if (state.selectedClassId) setSelectedClassId(state.selectedClassId);
    if (state.selectedSubjectId) setSelectedSubjectId(state.selectedSubjectId);
    if (state.paperTitle) setPaperTitle(state.paperTitle);
    if (state.examName) setExamName(state.examName);
    if (state.duration) setDuration(state.duration);
    if (state.maxMarks) setMaxMarks(state.maxMarks);
    if (state.passingMarks) setPassingMarks(state.passingMarks);
    if (state.instructions) setInstructions(state.instructions);
    if (state.academicYearName) setAcademicYearName(state.academicYearName);
    if (state.questions) {
      setQuestions(state.questions);
      recordHistory(state.questions);
    }
    setIsHistoryOpen(false);
    setSuccess(`Restored revision from ${rev.timestamp}`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Word & Character count
  const getDocStats = () => {
    let text = paperTitle + ' ' + instructions;
    questions.forEach(q => {
      text += ' ' + q.text;
      if (q.options) text += ' ' + q.options.join(' ');
      if (q.subQuestions) q.subQuestions.forEach(sq => text += ' ' + sq.text);
      if (q.matchingColumns) {
        text += ' ' + q.matchingColumns.left.join(' ');
        text += ' ' + q.matchingColumns.right.join(' ');
      }
    });

    const chars = text.length;
    const words = text.trim() === '' ? 0 : text.split(/\s+/).filter(w => w.length > 0).length;
    return { chars, words };
  };

  // Search and replace in all questions & instructions
  const handleSearchReplace = () => {
    if (!searchQuery) return;
    
    // Replace in title & instructions
    setPaperTitle(prev => prev.replaceAll(searchQuery, replaceQuery));
    setInstructions(prev => prev.replaceAll(searchQuery, replaceQuery));

    // Replace inside questions
    const nextQuestions = questions.map(q => {
      let updatedQ = { ...q, text: q.text.replaceAll(searchQuery, replaceQuery) };
      if (q.options) {
        updatedQ.options = q.options.map(opt => opt.replaceAll(searchQuery, replaceQuery));
      }
      if (q.subQuestions) {
        updatedQ.subQuestions = q.subQuestions.map(sq => ({ ...sq, text: sq.text.replaceAll(searchQuery, replaceQuery) }));
      }
      if (q.matchingColumns) {
        updatedQ.matchingColumns = {
          left: q.matchingColumns.left.map(l => l.replaceAll(searchQuery, replaceQuery)),
          right: q.matchingColumns.right.map(r => r.replaceAll(searchQuery, replaceQuery))
        };
      }
      return updatedQ;
    });

    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
    setSuccess('Search and replace applied successfully.');
    setTimeout(() => setSuccess(''), 3000);
    setIsSearchOpen(false);
  };

  // Insert general Question blocks
  const insertQuestionBlock = (type) => {
    const newId = 'q-' + Date.now();
    
    let defaultText = 'Enter your question text here...';
    if (type === 'mcq') defaultText = 'Which of the following is correct?';
    else if (type === 'true_false') defaultText = 'Water is a compound of hydrogen and oxygen.';
    else if (type === 'fill_blanks') defaultText = 'The capital of France is _______.';
    else if (type === 'matching') defaultText = '';
    else if (type === 'sub_parts') {
      defaultText = '';
    }
    else if (type === 'section') {
      const existingSectionsCount = questions.filter(q => q.type === 'section').length;
      const sectionLetter = String.fromCharCode(65 + (existingSectionsCount % 26));
      defaultText = `SECTION ${sectionLetter}`;
    }
    else if (type === 'heading') {
      defaultText = 'Heading Title';
    }
    else if (type === 'instruction') {
      defaultText = 'Note: Attempt all questions. All questions carry equal marks.';
    }

    let newQ = {
      id: newId,
      type: type,
      marks: type === 'section' || type === 'heading' || type === 'instruction' 
        ? 0 
        : type === 'mcq' || type === 'true_false' || type === 'one_word' 
        ? 1 
        : 5,
      text: defaultText,
      subQuestions: type === 'sub_parts' ? [
        { id: 'sq-' + Date.now() + '-a', text: 'First sub-question text...', marks: 2 },
        { id: 'sq-' + Date.now() + '-b', text: 'Second sub-question text...', marks: 3 }
      ] : [],
      table: null,
      image: null,
      drawing: null,
      equation: null
    };

    if (type === 'section') {
      newQ.align = 'center';
      newQ.borderStyle = 'double';
    }

    if (type === 'heading') {
      newQ.align = 'center';
    }

    if (type === 'mcq') {
      newQ.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
    }

    if (type === 'matching') {
      newQ.matchingColumns = {
        left: ['Item A', 'Item B', 'Item C'],
        right: ['Matching 1', 'Matching 2', 'Matching 3']
      };
    }

    const nextQuestions = [...questions, newQ];
    setQuestions(nextQuestions);
    setActiveQuestionId(newId);
    recordHistory(nextQuestions);
  };

  const getSpawningY = (qId) => {
    if (!qId) return 230;
    const previewEl = document.getElementById(`preview-q-${qId}`);
    const paperEl = document.getElementById("printable-question-paper-doc");
    if (previewEl && paperEl) {
      const previewRect = previewEl.getBoundingClientRect();
      const paperRect = paperEl.getBoundingClientRect();
      const relativeY = (previewRect.top - paperRect.top) / (zoomFactor || 1);
      return Math.max(50, Math.round(relativeY + 15));
    }
    return 230;
  };

  // Insert Box, Circle or Underline answer indicator at selection or end
  const insertAnswerSpace = (qId, type) => {
    let width = 28;
    let height = 28;
    if (type === 'line') {
      width = 140;
      height = 2;
    } else if (type === 'rectangle') {
      width = 160;
      height = 90;
    } else if (type === 'square') {
      width = 80;
      height = 80;
    } else if (type === 'circle') {
      width = 40;
      height = 40;
    } else if (type === 'box') {
      width = 40;
      height = 40;
    }

    const spawningY = getSpawningY(qId);

    const newSpace = {
      id: 'fl-space-' + Date.now(),
      type: type,
      x: 180,
      y: spawningY,
      width: width,
      height: height,
      rotate: 0
    };
    setFloatingImages(prev => {
      const next = [...prev, newSpace];
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
  };

  // Sub-question management
  const insertSubQuestion = (qId) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        const subId = 'sq-' + Date.now();
        const subQ = { id: subId, text: 'Sub-question text...', marks: 1 };
        return {
          ...q,
          subQuestions: [...(q.subQuestions || []), subQ]
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  const removeSubQuestion = (qId, subId) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          subQuestions: q.subQuestions.filter(sq => sq.id !== subId)
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  const updateSubQuestion = (qId, subId, field, val) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          subQuestions: q.subQuestions.map(sq => {
            if (sq.id === subId) {
              return { ...sq, [field]: val };
            }
            return sq;
          })
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
  };

  // MCQ Options management
  const updateMcqOption = (qId, idx, val) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        const opts = [...q.options];
        opts[idx] = val;
        return { ...q, options: opts };
      }
      return q;
    });
    setQuestions(nextQuestions);
  };

  // Reordering, duplicating, deleting questions
  const moveQuestion = (idx, direction) => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const nextQuestions = [...questions];
    const temp = nextQuestions[idx];
    nextQuestions[idx] = nextQuestions[targetIdx];
    nextQuestions[targetIdx] = temp;

    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  const duplicateQuestion = (q) => {
    const dup = {
      ...JSON.parse(JSON.stringify(q)),
      id: 'q-dup-' + Date.now()
    };
    const idx = questions.findIndex(item => item.id === q.id);
    const nextQuestions = [...questions];
    nextQuestions.splice(idx + 1, 0, dup);

    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  const deleteQuestion = (qId) => {
    const nextQuestions = questions.filter(q => q.id !== qId);
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  const updateQuestionText = (qId, text) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, text } : q));
  };

  const updateQuestionMarks = (qId, marks) => {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, marks: parseFloat(marks) || 0 } : q));
  };

  // Image upload handler
  const triggerImageUpload = (qId, sqId = null) => {
    isFloatingUploadRef.current = false;
    activeQuestionIdRef.current = qId;
    activeSubQuestionIdRef.current = sqId;
    fileInputRef.current.click();
  };

  const triggerFloatingImageUpload = (qId) => {
    activeQuestionIdRef.current = qId;
    isFloatingUploadRef.current = true;
    fileInputRef.current.click();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      
      if (isFloatingUploadRef.current) {
        const spawningY = getSpawningY(activeQuestionIdRef.current);
        const newFloating = {
          id: 'fl-' + Date.now(),
          src: base64,
          x: 150,
          y: spawningY,
          width: 140,
          rotate: 0
        };
        setFloatingImages(prev => {
          const next = [...prev, newFloating];
          // Update draft and history with new floating images
          const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
          paperState.floatingImages = next;
          localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
          return next;
        });
      } else {
        const qId = activeQuestionIdRef.current;
        const sqId = activeSubQuestionIdRef.current;
        const nextQuestions = questions.map(q => {
          if (q.id === qId) {
            if (sqId) {
              return {
                ...q,
                subQuestions: q.subQuestions.map(sq => {
                  if (sq.id === sqId) {
                    return {
                      ...sq,
                      image: {
                        src: base64,
                        width: 50,
                        rotate: 0,
                        align: 'left'
                      }
                    };
                  }
                  return sq;
                })
              };
            } else {
              return {
                ...q,
                image: {
                  src: base64,
                  width: 50, // default percentage width
                  rotate: 0,
                  align: 'center'
                }
              };
            }
          }
          return q;
        });
        setQuestions(nextQuestions);
        recordHistory(nextQuestions);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset file input
  };

  const updateQuestionImage = (qId, field, val) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId && q.image) {
        return {
          ...q,
          image: { ...q.image, [field]: val }
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  const updateSubQuestionImage = (qId, sqId, field, val) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          subQuestions: q.subQuestions.map(sq => {
            if (sq.id === sqId) {
              if (field === 'remove') {
                return { ...sq, image: null };
              }
              return {
                ...sq,
                image: {
                  ...sq.image,
                  [field]: val
                }
              };
            }
            return sq;
          })
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  // Floating Images Drag handlers
  const handleImageMouseDown = (e, imgId, currentX, currentY) => {
    // Blur any active inputs or contenteditables to focus body and enable arrow key events
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setDraggingId(imgId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragPosStart({ x: currentX, y: currentY });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingId) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      
      let newX = dragPosStart.x + dx;
      let newY = dragPosStart.y + dy;
      
      const img = floatingImages.find(i => i.id === draggingId);
      if (img) {
        newX = Math.max(0, Math.min(720 - (img.width || 100), newX));
        newY = Math.max(0, newY);
      }

      setFloatingImages(prev => prev.map(item => item.id === draggingId ? { ...item, x: newX, y: newY } : item));
    };

    const handleMouseUp = () => {
      if (draggingId) {
        setDraggingId(null);
        // Persist position update silently
        const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
        paperState.floatingImages = floatingImages;
        localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      }
    };

    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, dragStart, dragPosStart, floatingImages]);

  // Centralized helper to prevent text selection during drag/resize
  useEffect(() => {
    if (draggingId || resizingId) {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    } else {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    }
    return () => {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    };
  }, [draggingId, resizingId]);

  const resizeFloatingImage = (id, delta) => {
    setFloatingImages(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          const newWidth = Math.max(30, Math.min(600, item.width + delta));
          return { ...item, width: newWidth };
        }
        return item;
      });
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
  };

  const rotateFloatingImage = (id) => {
    setFloatingImages(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          return { ...item, rotate: (item.rotate + 90) % 360 };
        }
        return item;
      });
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
  };

  const deleteFloatingImage = (id) => {
    // Also clear selection if the deleted element was active
    setActiveFloatingId(prev => prev === id ? null : prev);
    setFloatingImages(prev => {
      const next = prev.filter(item => item.id !== id);
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
  };

  const handleResizeMouseDown = (e, imgId, currentWidth, currentHeight) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingId(imgId);
    setResizeStartX(e.clientX);
    setResizeStartY(e.clientY);
    setResizeStartWidth(currentWidth);
    setResizeStartHeight(currentHeight || currentWidth);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingId) return;
      const targetEl = floatingImages.find(item => item.id === resizingId);
      if (!targetEl) return;

      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      const newWidth = Math.max(15, Math.min(700, resizeStartWidth + dx));
      const newHeight = Math.max(15, Math.min(800, resizeStartHeight + dy));

      // Lock aspect ratio for circle, box, and square
      const isRatioLocked = ['circle', 'box', 'square'].includes(targetEl.type);
      const isDrawing = targetEl.type === 'drawing';

      let finalHeight = newHeight;
      if (isRatioLocked) {
        finalHeight = newWidth;
      } else if (isDrawing) {
        finalHeight = Math.round(newWidth * 0.6); // Lock 5:3 ratio for drawings
      }

      setFloatingImages(prev => prev.map(item => 
        item.id === resizingId 
          ? { ...item, width: newWidth, height: finalHeight } 
          : item
      ));
    };

    const handleMouseUp = () => {
      if (resizingId) {
        setResizingId(null);
        const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
        paperState.floatingImages = floatingImages;
        localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      }
    };

    if (resizingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingId, resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight, floatingImages]);



  const handleAddTableDimension = (tableId, type) => {
    setFloatingImages(prev => {
      const next = prev.map(item => {
        if (item.id === tableId && item.type === 'table' && item.tableData) {
          if (type === 'row') {
            const colsCount = item.tableData[0]?.length || 3;
            const newRow = Array.from({ length: colsCount }, () => 'Cell');
            return { ...item, tableData: [...item.tableData, newRow] };
          } else {
            return {
              ...item,
              tableData: item.tableData.map(row => [...row, 'Cell'])
            };
          }
        }
        return item;
      });
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
  };

  const updateFloatingTableCell = (tableId, r, c, val) => {
    setFloatingImages(prev => {
      const next = prev.map(item => {
        if (item.id === tableId && item.type === 'table' && item.tableData) {
          const nextData = item.tableData.map((row, rIdx) => {
            if (rIdx === r) {
              return row.map((cell, cIdx) => cIdx === c ? val : cell);
            }
            return row;
          });
          return { ...item, tableData: nextData };
        }
        return item;
      });
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
  };

  const handleOpenDrawingDialogForFloating = (id) => {
    const el = floatingImages.find(item => item.id === id);
    if (el && el.type === 'drawing') {
      setActiveFloatingId(id);
      setShapes(el.drawingData || []);
      setIsDrawingOpen(true);
    }
  };

  const removeQuestionImage = (qId) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return { ...q, image: null };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  // Table support
  const handleOpenTableDialog = (qId) => {
    setActiveQuestionId(qId);
    setTableRows(3);
    setTableCols(3);
    setIsTableOpen(true);
  };

  const insertTable = () => {
    const rowsArr = Array.from({ length: tableRows }, () => Array.from({ length: tableCols }, () => 'Cell'));
    const spawningY = getSpawningY(activeQuestionIdRef.current);
    const newTable = {
      id: 'fl-table-' + Date.now(),
      type: 'table',
      x: 100,
      y: spawningY,
      width: 420,
      height: 120,
      rotate: 0,
      tableData: rowsArr
    };
    setFloatingImages(prev => {
      const next = [...prev, newTable];
      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
      paperState.floatingImages = next;
      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
      return next;
    });
    setIsTableOpen(false);
  };

  const updateTableCell = (qId, r, c, val) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId && q.table) {
        const nextData = q.table.data.map((row, rIdx) => {
          if (rIdx === r) {
            return row.map((cell, cIdx) => cIdx === c ? val : cell);
          }
          return row;
        });
        return {
          ...q,
          table: { ...q.table, data: nextData }
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
  };

  const removeTable = (qId) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return { ...q, table: null };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  // Math equations editor support
  const handleOpenEquationDialog = (qId) => {
    setActiveQuestionId(qId);
    const activeQ = questions.find(q => q.id === qId);
    setModalHtml(activeQ?.text || '');
    setIsEquationOpen(true);
  };

  const insertSymbolHTML = (htmlMarkup) => {
    const editor = document.getElementById('math-modal-editor');
    if (editor) {
      editor.focus();
    }
    
    // Insert HTML at current cursor position
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      
      const el = document.createElement("div");
      el.innerHTML = htmlMarkup;
      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      
      if (lastNode) {
        const nextRange = range.cloneRange();
        nextRange.setStartAfter(lastNode);
        nextRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nextRange);
      }
    } else {
      if (editor) editor.innerHTML += htmlMarkup;
    }

    // Sync state in real time so preview updates immediately
    if (editor && activeQuestionId) {
      const updatedText = editor.innerHTML;
      setQuestions(prev => prev.map(q => q.id === activeQuestionId ? { ...q, text: updatedText } : q));
    }
  };

  const handleModalEditorInput = (e) => {
    if (activeQuestionId) {
      const newText = e.target.innerHTML;
      setQuestions(prev => prev.map(q => q.id === activeQuestionId ? { ...q, text: newText } : q));
    }
  };

  const handleModalEditorBlur = (e) => {
    if (activeQuestionId) {
      const newText = e.target.innerHTML;
      setQuestions(prev => prev.map(q => q.id === activeQuestionId ? { ...q, text: newText } : q));
      recordHistory(questions);
    }
  };

  const handleEditorKeyDown = (e) => {
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let node = range.startContainer;
        
        // Traverse up to find if cursor is inside SUP or SUB
        let supOrSub = null;
        while (node && node !== e.currentTarget) {
          if (node.nodeName === 'SUP' || node.nodeName === 'SUB') {
            supOrSub = node;
            break;
          }
          node = node.parentNode;
        }

        if (supOrSub) {
          e.preventDefault();
          // Insert a regular non-breaking space after the superscript/subscript block
          const spaceNode = document.createTextNode('\u00A0');
          supOrSub.parentNode.insertBefore(spaceNode, supOrSub.nextSibling);
          
          // Position cursor in the new space node
          const newRange = document.createRange();
          newRange.setStart(spaceNode, 1);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      }
    }
  };

  // Drawing Canvas vector tools
  const handleOpenDrawingDialog = (qId) => {
    setActiveQuestionId(qId);
    const existing = questions.find(q => q.id === qId)?.drawing || [];
    setShapes(JSON.parse(JSON.stringify(existing)));
    setSelectedShapeId(null);
    setDrawingTool('select');
    setIsDrawingOpen(true);
  };

  const addShape = (type) => {
    const newShape = {
      id: 'sh-' + Date.now(),
      type: type,
      x: 100,
      y: 100,
      w: type === 'line' || type === 'arrow' || type === 'blank' ? 150 : 80,
      h: type === 'line' || type === 'arrow' || type === 'blank' ? 0 : 80,
      x2: type === 'line' || type === 'arrow' || type === 'blank' ? 250 : 0,
      y2: type === 'line' || type === 'arrow' || type === 'blank' ? 100 : 0,
      stroke: strokeColor,
      fill: fillColor,
      strokeWidth: strokeWidth,
      rotate: 0,
      text: textVal,
      fontSize: 14
    };

    setShapes([...shapes, newShape]);
    setSelectedShapeId(newShape.id);
  };

  const handleShapeDrag = (id, dx, dy) => {
    setShapes(prev => prev.map(s => {
      if (s.id === id) {
        if (s.type === 'line' || s.type === 'arrow' || s.type === 'blank') {
          return {
            ...s,
            x: s.x + dx,
            y: s.y + dy,
            x2: s.x2 + dx,
            y2: s.y2 + dy
          };
        }
        return { ...s, x: s.x + dx, y: s.y + dy };
      }
      return s;
    }));
  };

  const resizeSelectedShape = (dw, dh) => {
    if (!selectedShapeId) return;
    setShapes(prev => prev.map(s => {
      if (s.id === selectedShapeId) {
        return {
          ...s,
          w: Math.max(10, (s.w || 50) + dw),
          h: Math.max(10, (s.h || 50) + dh)
        };
      }
      return s;
    }));
  };

  const rotateSelectedShape = (amount) => {
    if (!selectedShapeId) return;
    setShapes(prev => prev.map(s => {
      if (s.id === selectedShapeId) {
        return { ...s, rotate: (s.rotate + amount) % 360 };
      }
      return s;
    }));
  };

  const duplicateSelectedShape = () => {
    if (!selectedShapeId) return;
    const target = shapes.find(s => s.id === selectedShapeId);
    if (!target) return;
    const dup = {
      ...JSON.parse(JSON.stringify(target)),
      id: 'sh-dup-' + Date.now(),
      x: target.x + 20,
      y: target.y + 20,
      x2: target.x2 ? target.x2 + 20 : undefined,
      y2: target.y2 ? target.y2 + 20 : undefined
    };
    setShapes([...shapes, dup]);
    setSelectedShapeId(dup.id);
  };

  const deleteSelectedShape = () => {
    if (!selectedShapeId) return;
    setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
    setSelectedShapeId(null);
  };

  const sendShapeBackward = () => {
    if (!selectedShapeId) return;
    const idx = shapes.findIndex(s => s.id === selectedShapeId);
    if (idx <= 0) return;
    const nextShapes = [...shapes];
    const temp = nextShapes[idx];
    nextShapes[idx] = nextShapes[idx - 1];
    nextShapes[idx - 1] = temp;
    setShapes(nextShapes);
  };

  const bringShapeForward = () => {
    if (!selectedShapeId) return;
    const idx = shapes.findIndex(s => s.id === selectedShapeId);
    if (idx === -1 || idx === shapes.length - 1) return;
    const nextShapes = [...shapes];
    const temp = nextShapes[idx];
    nextShapes[idx] = nextShapes[idx + 1];
    nextShapes[idx + 1] = temp;
    setShapes(nextShapes);
  };

  const saveDrawing = () => {
    if (activeFloatingId) {
      setFloatingImages(prev => {
        const next = prev.map(item => item.id === activeFloatingId ? { ...item, drawingData: shapes } : item);
        const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
        paperState.floatingImages = next;
        localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
        return next;
      });
    } else {
      const spawningY = getSpawningY(activeQuestionIdRef.current);
      const newDrawing = {
        id: 'fl-draw-' + Date.now(),
        type: 'drawing',
        x: 100,
        y: spawningY,
        width: 360,
        rotate: 0,
        drawingData: shapes
      };
      setFloatingImages(prev => {
        const next = [...prev, newDrawing];
        const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
        paperState.floatingImages = next;
        localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
        return next;
      });
    }
    setIsDrawingOpen(false);
  };

  const removeDrawing = (qId) => {
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return { ...q, drawing: null };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
  };

  // Load predefined templates
  const handleLoadTemplate = (key) => {
    const tpl = PAPER_TEMPLATES[key];
    if (!tpl) return;
    setPaperTitle(tpl.name);
    setMaxMarks(tpl.maxMarks.toString());
    setDuration(tpl.duration);
    setInstructions(tpl.instructions);
    
    // Copy questions
    const nextQuestions = tpl.questions.map(q => ({
      ...JSON.parse(JSON.stringify(q)),
      id: 'q-' + Date.now() + Math.random().toString(36).substr(2, 5)
    }));
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
    setIsTemplateOpen(false);
  };

  // Save current paper as custom template
  const handleSaveCustomTemplate = () => {
    const tplName = prompt('Enter a name for your custom template:');
    if (!tplName) return;

    const newTemplate = {
      name: tplName,
      maxMarks: parseFloat(maxMarks) || 100,
      duration: duration,
      instructions: instructions,
      questions: questions
    };

    const savedTemplates = JSON.parse(localStorage.getItem('qpd_custom_templates') || '[]');
    localStorage.setItem('qpd_custom_templates', JSON.stringify([...savedTemplates, newTemplate]));
    setSuccess('Saved as custom template successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Print workflow (using iframe pattern to isolate styles)
  const handlePrint = () => {
    const printableContent = document.getElementById('printable-question-paper-doc');
    if (!printableContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.write('<html><head><title>Print Question Paper</title>');
    doc.write('<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">');
    doc.write('<style>');
    doc.write('body { font-family: Arial, sans-serif; color: #000; padding: 0; margin: 0; }');
    doc.write('@media print { @page { size: A4 portrait; margin: 0; } }');
    doc.write('#printable-question-paper-doc { width: 720px !important; zoom: 1 !important; margin: 0 auto !important; box-shadow: none !important; }');
    doc.write('.q-block { page-break-inside: avoid; margin-bottom: 20px; }');
    doc.write('.q-block-section, .q-block-heading { page-break-after: avoid !important; break-after: avoid !important; }');
    doc.write('</style></head><body>');
    
    const clone = printableContent.cloneNode(true);
    clone.style.zoom = '1';
    clone.style.width = '720px';
    clone.style.margin = '0 auto';
    clone.style.boxShadow = 'none';

    doc.write(clone.outerHTML);
    doc.write('</body></html>');
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 1000);
  };

  // Download PDF using html2pdf.js
  const handleDownloadPdf = () => {
    const element = document.getElementById('printable-question-paper-doc');
    if (!element) return;

    const clone = element.cloneNode(true);
    clone.style.zoom = '1';
    clone.style.width = '720px';
    clone.style.margin = '0 auto';
    clone.style.boxShadow = 'none';

    const opt = {
      margin:       0,
      filename:     `${paperTitle.replace(/\s+/g, '_')}_Paper.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(clone).save();
  };

  // Export DOCX (Word friendly format)
  const handleExportDocx = () => {
    const printableContent = document.getElementById('printable-question-paper-doc');
    if (!printableContent) return;

    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><title>Question Paper</title>
    <style>
      body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.5; padding: 20px; }
      h1 { font-size: 18pt; text-align: center; font-weight: bold; margin-bottom: 6px; }
      h2 { font-size: 14pt; text-align: center; margin-bottom: 12px; }
      .header-info { width: 100%; border-collapse: collapse; border: none; margin-bottom: 15px; }
      .header-info td { border: none; padding: 4px; font-weight: bold; }
      .instructions { border: 1px solid #000; padding: 8px; margin-bottom: 20px; font-size: 10pt; }
      .question-list { list-style-type: none; padding-left: 0; }
      .q-block { margin-bottom: 15px; width: 100%; }
      .q-text { font-size: 12pt; display: inline-block; width: 85%; }
      .q-marks { display: inline-block; width: 15%; text-align: right; font-weight: bold; }
      .mcq-options { margin-left: 20px; margin-top: 5px; }
      .mcq-option { margin-bottom: 3px; }
      table.data-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
      table.data-table, table.data-table th, table.data-table td { border: 1px solid #000; padding: 5px; text-align: left; }
    </style>
    </head>
    <body>`;
    const footer = "</body></html>";
    const sourceHTML = header + printableContent.innerHTML + footer;
    
    const blob = new Blob(['\ufeff' + sourceHTML], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paperTitle.replace(/\s+/g, '_')}_Paper.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyTextFormat = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
  };

  const syncActiveEditorContent = () => {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
      const qId = activeEl.getAttribute('data-q-id');
      if (qId) {
        updateQuestionText(qId, activeEl.innerHTML);
      }
    }
  };

  const applyFontSizeToSelection = (size) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    if (selection.toString() === '') {
      // Insertion at cursor position
      const span = document.createElement('span');
      span.style.fontSize = size;
      span.appendChild(document.createTextNode('\u200B')); // zero-width space
      
      range.insertNode(span);
      
      // Place cursor inside the span after the zero-width space
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStart(span.firstChild, 1);
      newRange.setEnd(span.firstChild, 1);
      selection.addRange(newRange);
    } else {
      // Wrap selected text
      const span = document.createElement('span');
      span.style.fontSize = size;
      
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    }
    
    setSelectedFontSize(size);
    syncActiveEditorContent();
  };

  const adjustSelectedTextSize = (action) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    
    // Find parent element to check if it's already a font-size span
    let parentSpan = range.commonAncestorContainer;
    if (parentSpan.nodeType === Node.TEXT_NODE) {
      parentSpan = parentSpan.parentNode;
    }
    
    let currentSize = 13; // default size in pixels
    if (parentSpan && parentSpan.tagName === 'SPAN' && parentSpan.style.fontSize) {
      currentSize = parseInt(parentSpan.style.fontSize) || 13;
    }

    const newSize = action === 'increase' ? currentSize + 1 : Math.max(8, currentSize - 1);
    const sizeStr = `${newSize}px`;
    
    if (selection.toString() === '') {
      // Insertion at cursor position
      const span = document.createElement('span');
      span.style.fontSize = sizeStr;
      span.appendChild(document.createTextNode('\u200B')); // zero-width space
      
      range.insertNode(span);
      
      // Place cursor inside the span
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.setStart(span.firstChild, 1);
      newRange.setEnd(span.firstChild, 1);
      selection.addRange(newRange);
    } else {
      // Wrap selected text
      const span = document.createElement('span');
      span.style.fontSize = sizeStr;
      
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    }
    
    setSelectedFontSize(sizeStr);
    syncActiveEditorContent();
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      try {
        let node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode;
        }
        if (node && node.tagName === 'SPAN' && node.style.fontSize) {
          setSelectedFontSize(node.style.fontSize);
        }
      } catch (e) {}
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const activeClassName = (classes.find(c => String(c.id) === String(selectedClassId))?.name) || 'Class';
  const activeSubjectName = (subjects.find(s => String(s.id) === String(selectedSubjectId))?.name) || 'Subject';
  const activeExamName = (exams.find(e => String(e.id) === String(examName))?.name) || 'N/A';

  return (
    <div className="min-h-screen bg-background text-text-primary pb-10">
      
      {/* HEADER BAR */}
      <div className="border-b border-border bg-surface sticky top-14 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button 
            type="button" 
            variant="ghost" 
            className="h-9 w-9 p-0" 
            onClick={() => navigate('/school-admin/exams')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight text-text-primary">
              Question Paper Designer
            </h1>
            <p className="text-xs text-text-secondary">
              Configure parameters, write questions, build drawings/tables, and generate PDFs
            </p>
          </div>
        </div>

        <div className="flex flex-nowrap items-center gap-2 justify-end overflow-x-auto">
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 whitespace-nowrap"
            onClick={handleNewPaper}
          >
            <Plus className="h-4 w-4" /> New Paper
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 whitespace-nowrap"
            onClick={() => { setLibrarySelectedClass(null); setIsLibraryOpen(true); }}
          >
            <FolderOpen className="h-4 w-4" /> Saved Papers ({savedPapersList.length})
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs text-green-600 border-green-200 bg-green-50 hover:bg-green-100 whitespace-nowrap"
            onClick={saveDraft}
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button 
            type="button"
            variant="default" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs bg-primary text-white whitespace-nowrap"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* FEEDBACK STATUS */}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top duration-300">
          <CheckCircle className="h-4 w-4" /> {success}
        </div>
      )}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top duration-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="mx-6 mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* LEFT WORKSPACE: PARAMETERS & QUESTIONS EDITOR */}
        <div className="space-y-6 min-w-0">
          
          {/* CARD 1: EXAM METADATA DETAILS */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" /> Step 1, 2 & 3: Paper Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Select Class */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Select Class *</label>
                  <select 
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes
                      .slice()
                      .sort((a, b) => getClassOrderIndex(a.name) - getClassOrderIndex(b.name) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>

                {/* Select Subject */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Select Subject *</label>
                  <select 
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    disabled={!selectedClassId}
                    className="w-full h-10 px-3 border border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>



              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Duration */}
                <div className="space-y-1.5">
                  <label htmlFor="duration" className="text-xs font-bold text-text-secondary uppercase">Duration</label>
                  <Input id="duration" 
                    placeholder="3 Hours" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)} 
                  />
                </div>

                {/* Max Marks */}
                <div className="space-y-1.5">
                  <label htmlFor="maximum-marks" className="text-xs font-bold text-text-secondary uppercase">Maximum Marks</label>
                  <Input id="maximum-marks" 
                    type="number"
                    placeholder="100" 
                    value={maxMarks} 
                    onChange={(e) => setMaxMarks(e.target.value)} 
                  />
                </div>

                {/* Exam Name (Read-Only) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Exam Name</label>
                  <div className="h-10 px-3 border border-border bg-zinc-50 dark:bg-zinc-900 rounded-md text-sm flex items-center text-text-muted font-medium select-none">
                    {activeExamName}
                  </div>
                </div>
              </div>

              {/* Instructions Editor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">General Instructions (Separate lines)</label>
                <textarea 
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Enter general examination guidelines..."
                  className="w-full p-3 border border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>

            </CardContent>
          </Card>

          <Card className="sticky top-32 z-30 shadow-md">

            <CardContent className="p-3 flex flex-wrap gap-2 items-center bg-white dark:bg-zinc-950">
              <span className="text-[11px] font-bold text-text-muted uppercase">Quick Blocks:</span>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('mcq')}>+ MCQ</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('true_false')}>+ True/False</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('fill_blanks')}>+ Blank</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('matching')}>+ Matching</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('sub_parts')}>+ Sub-Parts</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('short_answer')}>+ Short Q</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0" onClick={() => insertQuestionBlock('long_answer')}>+ Long Q</Button>
              <div className="h-6 w-px bg-border mx-1" />
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" onClick={() => insertQuestionBlock('section')}>+ Section</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" onClick={() => insertQuestionBlock('heading')}>+ Heading</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold py-0 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" onClick={() => insertQuestionBlock('instruction')}>+ Group Instruction</Button>
            </CardContent>
          </Card>



          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-1.5">
                Questions List ({questions.length})
              </h3>
            </div>

            {questions.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-10 text-center text-text-muted space-y-3 bg-card">
                <FileText className="h-10 w-10 mx-auto text-text-muted opacity-55" />
                <div>
                  <p className="text-sm font-bold">No Questions Added Yet</p>
                  <p className="text-xs">Click on any of the Quick Block buttons above to insert your first examination question.</p>
                </div>
              </div>
            ) : (
              (() => {
                let questionCounter = 0;
                return questions.map((q, index) => {
                  const isStructural = q.type === 'section' || q.type === 'heading' || q.type === 'instruction';
                  const isSubParts = q.type === 'sub_parts';
                  if (q.type === 'section' || q.type === 'heading') {
                    questionCounter = 0;
                  } else if (!isStructural && !isSubParts) {
                    questionCounter++;
                  }
                  const qNumber = questionCounter;
                  const isActive = activeQuestionId === q.id;

                  return (
                    <Card 
                      key={q.id} 
                      className={`transition-all ${isActive ? 'border-primary shadow-md ring-1 ring-primary/20' : 'hover:border-zinc-300'}`}
                      onClick={() => setActiveQuestionId(q.id)}
                    >
                      <CardHeader className="py-2.5 px-4 border-b border-border bg-zinc-50/30 flex flex-row justify-between items-center space-y-0">
                        <div className="flex items-center gap-2">
                          {isStructural || isSubParts ? (
                            <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase">
                              {q.type === 'section' ? 'Section' : q.type === 'heading' ? 'Heading' : q.type === 'instruction' ? 'Instruction' : 'Sub-Parts'}
                            </span>
                          ) : (
                            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">
                              Q {qNumber}
                            </span>
                          )}
                          {!isStructural && (
                            <span className="text-[11px] font-bold uppercase text-text-muted">
                              {q.type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      
                      {/* Reordering & Control tools */}
                      <div className="flex items-center gap-1.5">
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move Up" onClick={(e) => { e.stopPropagation(); moveQuestion(index, 'up'); }} disabled={index === 0}><ChevronUp className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" title="Move Down" onClick={(e) => { e.stopPropagation(); moveQuestion(index, 'down'); }} disabled={index === questions.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateQuestion(q); }}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50" title="Delete" onClick={(e) => { e.stopPropagation(); deleteQuestion(q.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4 space-y-4">
                      {q.type === 'section' ? (
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary uppercase">Section Divider Title</label>
                            <Input 
                              value={q.text} 
                              onChange={(e) => updateQuestionText(q.id, e.target.value)}
                              onBlur={() => recordHistory(questions)}
                              placeholder="e.g., SECTION A: MULTIPLE CHOICE QUESTIONS"
                              className="font-bold text-sm tracking-wide"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                            <div className="space-y-1.5">
                              <span>Heading Alignment</span>
                              <select
                                value={q.align || 'center'}
                                onChange={(e) => {
                                  const nextQList = questions.map(itemQ => itemQ.id === q.id ? { ...itemQ, align: e.target.value } : itemQ);
                                  setQuestions(nextQList);
                                  recordHistory(nextQList);
                                }}
                                className="w-full h-8 px-2 border bg-background rounded"
                              >
                                <option value="left">Left Align</option>
                                <option value="center">Center Align</option>
                                <option value="right">Right Align</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <span>Separator Borders</span>
                              <select
                                value={q.borderStyle || 'double'}
                                onChange={(e) => {
                                  const nextQList = questions.map(itemQ => itemQ.id === q.id ? { ...itemQ, borderStyle: e.target.value } : itemQ);
                                  setQuestions(nextQList);
                                  recordHistory(nextQList);
                                }}
                                className="w-full h-8 px-2 border bg-background rounded"
                              >
                                <option value="double">Double Line Divider</option>
                                <option value="solid">Single Line Divider</option>
                                <option value="none">No Divider Lines</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : q.type === 'heading' ? (
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-text-secondary uppercase">Heading Title</label>
                            <Input 
                              value={q.text} 
                              onChange={(e) => updateQuestionText(q.id, e.target.value)}
                              onBlur={() => recordHistory(questions)}
                              placeholder="e.g., Short Answer Type Questions"
                              className="font-bold text-sm tracking-wide"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                            <div className="space-y-1.5">
                              <span>Heading Alignment</span>
                              <select
                                value={q.align || 'center'}
                                onChange={(e) => {
                                  const nextQList = questions.map(itemQ => itemQ.id === q.id ? { ...itemQ, align: e.target.value } : itemQ);
                                  setQuestions(nextQList);
                                  recordHistory(nextQList);
                                }}
                                className="w-full h-8 px-2 border bg-background rounded"
                              >
                                <option value="left">Left Align</option>
                                <option value="center">Center Align</option>
                                <option value="right">Right Align</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : q.type === 'instruction' ? (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-text-secondary uppercase">Group Instructions</label>
                          <textarea 
                            rows={2}
                            value={q.text} 
                            onChange={(e) => updateQuestionText(q.id, e.target.value)}
                            onBlur={() => recordHistory(questions)}
                            placeholder="e.g. Note: Attempt any 5 questions from the following."
                            className="w-full p-2.5 border border-border bg-background rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                              <label className="text-[11px] font-bold text-text-secondary uppercase">Question Text</label>
                              <div className="flex gap-1.5 items-center flex-wrap">
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold" onClick={() => triggerFloatingImageUpload(q.id)}>+ Image</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold" onClick={() => { activeQuestionIdRef.current = q.id; setActiveFloatingId(null); setIsTableOpen(true); }}>+ Table</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold" onClick={() => handleOpenEquationDialog(q.id)}>+ Math</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold" onClick={() => { activeQuestionIdRef.current = q.id; setActiveFloatingId(null); setShapes([]); setIsDrawingOpen(true); }}>+ Drawing</Button>
                                <div className="h-4 w-px bg-border mx-1" />
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold text-primary hover:bg-primary/5" title="Insert answer box for students to fill in" onClick={() => insertAnswerSpace(q.id, 'box')}>+ Answer Box [ ]</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold text-primary hover:bg-primary/5" title="Insert answer circle for students to circle" onClick={() => insertAnswerSpace(q.id, 'circle')}>+ Circle ( )</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold text-primary hover:bg-primary/5" title="Insert write-in line space" onClick={() => insertAnswerSpace(q.id, 'line')}>+ Line ___</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold text-primary hover:bg-primary/5" title="Insert square shape" onClick={() => insertAnswerSpace(q.id, 'square')}>+ Square</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[11px] font-bold text-primary hover:bg-primary/5" title="Insert rectangle shape" onClick={() => insertAnswerSpace(q.id, 'rectangle')}>+ Rectangle</Button>
                              </div>
                            </div>
                            <div 
                              contentEditable
                              data-q-id={q.id}
                              dangerouslySetInnerHTML={{ __html: q.text }}
                              onBlur={(e) => {
                                updateQuestionText(q.id, e.target.innerHTML);
                                recordHistory(questions);
                              }}
                              onKeyDown={handleEditorKeyDown}
                              className="border border-border rounded-md p-3 min-h-[70px] bg-background text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                              placeholder="Type question content..."
                            />
                          </div>

                          {/* Attached Table Editor */}
                          {q.table && (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-border rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold uppercase text-text-secondary">Question Table Grid ({q.table.rows}x{q.table.cols})</span>
                                <Button type="button" size="sm" variant="ghost" className="h-5 text-red-500 text-[11px]" onClick={() => removeTable(q.id)}>Remove Table</Button>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="border-collapse border border-zinc-300 w-full text-xs">
                                  <tbody>
                                    {q.table.data.map((row, rIdx) => (
                                      <tr key={rIdx}>
                                        {row.map((cell, cIdx) => (
                                          <td key={cIdx} className="border border-zinc-300 p-1 min-w-[60px]">
                                            <input 
                                              type="text" 
                                              value={cell} 
                                              onChange={(e) => updateTableCell(q.id, rIdx, cIdx, e.target.value)}
                                              className="w-full bg-transparent border-0 outline-none text-center font-mono" 
                                            />
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Attached Drawing Canvas Preview */}
                          {q.drawing && q.drawing.length > 0 && (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-border rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold uppercase text-text-secondary">Vector Drawing Embedded</span>
                                <div className="flex gap-2">
                                  <Button type="button" size="sm" variant="ghost" className="h-5 text-primary text-[11px]" onClick={() => handleOpenDrawingDialog(q.id)}>Edit Drawing</Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-5 text-red-500 text-[11px]" onClick={() => removeDrawing(q.id)}>Remove</Button>
                                </div>
                              </div>
                              <div className="w-full border border-border bg-white p-2 rounded flex justify-center items-center h-[140px]">
                                <svg className="w-full h-full max-h-[120px]" viewBox="0 0 500 300">
                                  {q.drawing.map((s) => (
                                    <g key={s.id} transform={`rotate(${s.rotate || 0} ${s.x + (s.w || 0)/2} ${s.y + (s.h || 0)/2})`}>
                                      {s.type === 'rect' && (
                                        <rect x={s.x} y={s.y} width={s.w} height={s.h} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                                      )}
                                      {s.type === 'circle' && (
                                        <ellipse cx={s.x + s.w/2} cy={s.y + s.h/2} rx={s.w/2} ry={s.h/2} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                                      )}
                                      {s.type === 'line' && (
                                        <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                                      )}
                                      {s.type === 'arrow' && (
                                        <g>
                                          <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                                          <polygon points={`${s.x2},${s.y2} ${s.x2-10},${s.y2-6} ${s.x2-10},${s.y2+6}`} fill={s.stroke} />
                                        </g>
                                      )}
                                      {s.type === 'blank' && (
                                        <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray="5,5" />
                                      )}
                                      {s.type === 'text' && (
                                        <text x={s.x} y={s.y + 12} fill={s.stroke} fontSize={s.fontSize || 14} fontFamily="sans-serif" fontWeight="bold">{s.text}</text>
                                      )}
                                    </g>
                                  ))}
                                </svg>
                              </div>
                            </div>
                          )}

                          {/* Attached Image Preview */}
                          {q.image && (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-border rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold uppercase text-text-secondary">Image Attachment</span>
                                <Button type="button" size="sm" variant="ghost" className="h-5 text-red-500 text-[11px]" onClick={() => removeQuestionImage(q.id)}>Remove Image</Button>
                              </div>
                              <div className="flex flex-col md:flex-row gap-4 items-center">
                                <img 
                                  src={q.image.src} 
                                  alt="Upload preview" 
                                  style={{ width: `${q.image.width}%`, transform: `rotate(${q.image.rotate}deg)` }}
                                  className="max-h-[150px] object-contain border border-border rounded"
                                />
                                <div className="space-y-3 w-full md:w-auto flex-1 text-xs">
                                  {/* Resize slider */}
                                  <div className="space-y-1">
                                    <span className="text-[11px] font-bold text-text-secondary">Size: {q.image.width}%</span>
                                    <input 
                                      type="range" 
                                      min="10" 
                                      max="100" 
                                      value={q.image.width}
                                      onChange={(e) => updateQuestionImage(q.id, 'width', parseInt(e.target.value))}
                                      className="w-full"
                                    />
                                  </div>
                                  {/* Rotation control */}
                                  <div className="flex gap-2">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-7 text-[11px] font-bold py-0"
                                      onClick={() => updateQuestionImage(q.id, 'rotate', (q.image.rotate + 90) % 360)}
                                    >
                                      <RotateCw className="h-3 w-3 mr-1" /> Rotate 90°
                                    </Button>
                                    {/* Alignment selectors */}
                                    <select
                                      value={q.image.align}
                                      onChange={(e) => updateQuestionImage(q.id, 'align', e.target.value)}
                                      className="h-7 px-2 border border-border bg-background rounded text-[11px]"
                                    >
                                      <option value="left">Left</option>
                                      <option value="center">Center</option>
                                      <option value="right">Right</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* MCQ OPTIONS EDITOR */}
                          {q.type === 'mcq' && q.options && (
                            <div className="space-y-2 border-l-2 border-primary/20 pl-4 mt-2">
                              <label className="text-[11px] font-bold text-text-secondary uppercase">Multiple Choice Options</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {q.options.map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-text-muted">{String.fromCharCode(97 + optIdx)})</span>
                                    <Input 
                                      value={opt} 
                                      onChange={(e) => updateMcqOption(q.id, optIdx, e.target.value)} 
                                      placeholder={`Option ${optIdx + 1}`}
                                      className="h-8"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* MATCHING COLUMNS EDITOR */}
                          {q.type === 'matching' && q.matchingColumns && (
                            <div className="space-y-3 border-l-2 border-primary/20 pl-4 mt-2">
                              <div className="flex justify-between items-center">
                                <label className="text-[11px] font-bold text-text-secondary uppercase">Column A & Column B Configuration</label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  className="h-6 text-[11px] font-bold"
                                  onClick={() => {
                                    const nextLeft = [...q.matchingColumns.left, ''];
                                    const nextRight = [...q.matchingColumns.right, ''];
                                    setQuestions(questions.map(itemQ => 
                                      itemQ.id === q.id 
                                        ? { ...itemQ, matchingColumns: { left: nextLeft, right: nextRight } } 
                                        : itemQ
                                    ));
                                  }}
                                >
                                  + Add Pair
                                </Button>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[11px] font-bold text-text-muted">
                                  <span>Column A (Left Item)</span>
                                  <span>Column B (Right Match)</span>
                                  <span className="w-8"></span>
                                </div>
                                
                                {q.matchingColumns.left.map((leftItem, idx) => (
                                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                    <Input 
                                      value={leftItem} 
                                      onChange={(e) => {
                                        const nextLeft = [...q.matchingColumns.left];
                                        nextLeft[idx] = e.target.value;
                                        setQuestions(questions.map(itemQ => itemQ.id === q.id ? { ...itemQ, matchingColumns: { ...itemQ.matchingColumns, left: nextLeft } } : itemQ));
                                      }}
                                      placeholder={`Item ${idx + 1}`}
                                      className="h-8"
                                    />
                                    <Input 
                                      value={q.matchingColumns.right[idx] || ''} 
                                      onChange={(e) => {
                                        const nextRight = [...q.matchingColumns.right];
                                        nextRight[idx] = e.target.value;
                                        setQuestions(questions.map(itemQ => itemQ.id === q.id ? { ...itemQ, matchingColumns: { ...itemQ.matchingColumns, right: nextRight } } : itemQ));
                                      }}
                                      placeholder={`Matching ${idx + 1}`}
                                      className="h-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                                      disabled={q.matchingColumns.left.length <= 1}
                                      onClick={() => {
                                        const nextLeft = q.matchingColumns.left.filter((_, i) => i !== idx);
                                        const nextRight = q.matchingColumns.right.filter((_, i) => i !== idx);
                                        setQuestions(questions.map(itemQ => 
                                          itemQ.id === q.id 
                                            ? { ...itemQ, matchingColumns: { left: nextLeft, right: nextRight } } 
                                            : itemQ
                                        ));
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* SUB-QUESTIONS CONTAINER */}
                          {q.type === 'sub_parts' && (
                            <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center">
                              <label className="text-[11px] font-bold text-text-secondary uppercase">Sub-Questions / Parts</label>
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 text-[11px] font-bold text-primary"
                                onClick={() => insertSubQuestion(q.id)}
                              >
                                + Add Sub-Question
                              </Button>
                            </div>
                            
                            {q.subQuestions && q.subQuestions.length > 0 && (
                              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                                {q.subQuestions.map((sq, sqIdx) => (
                                  <div key={sq.id} className="flex gap-2 items-start bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border">
                                    <span className="text-xs font-bold text-primary mt-2 flex-shrink-0">
                                      {String.fromCharCode(97 + sqIdx)})
                                    </span>
                                    <div className="flex-1 space-y-1.5 min-w-0">
                                      <textarea 
                                        rows={1}
                                        value={sq.text} 
                                        onChange={(e) => updateSubQuestion(q.id, sq.id, 'text', e.target.value)}
                                        placeholder="Sub-question text..."
                                        className="w-full p-2 border border-border bg-background rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <div className="flex justify-end items-center">
                                        <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 w-6 p-0 text-red-500" 
                                          onClick={() => removeSubQuestion(q.id, sq.id)}
                                        >
                                          <Trash className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            </div>
                          )}

                          {/* Marks fields (If no sub-questions) */}
                          {q.type !== 'sub_parts' && (!q.subQuestions || q.subQuestions.length === 0) && (
                            <div className="flex items-center gap-2 border-t border-border pt-3">
                              <label className="text-[11px] font-bold text-text-secondary uppercase">Allocated Marks for Q {qNumber}</label>
                              <Input 
                                type="number"
                                value={q.marks}
                                onChange={(e) => updateQuestionMarks(q.id, e.target.value)}
                                className="w-20 h-8 font-bold"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            })()
          )}
          </div>

        </div>

        {/* RIGHT WORKSPACE: LIVE PRINT PREVIEW */}
        <div className="sticky top-32 space-y-4 min-w-0">
          {(() => {
            const PAGE_HEIGHT = 1012;
            const totalPages = Math.max(1, Math.ceil((docHeight - 15) / PAGE_HEIGHT));
            return (
              <>
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary flex items-center gap-1.5">
                      <Eye className="h-5 w-5 text-primary" /> Live Print Preview
                    </h3>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border transition-all ${
                      totalPages === 1 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                        : 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                    }`}>
                      📄 {totalPages} {totalPages === 1 ? 'Page (Single Page)' : `Pages (Spills to Page ${totalPages})`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="text-xs font-bold" onClick={handleDownloadPdf}>
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="text-xs font-bold" onClick={handleExportDocx}>
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> DOCX
                    </Button>
                  </div>
                </div>

                {/* SIMULATED A4 PAPER WRAPPER */}
                <div ref={wrapperRef} className="border border-border shadow-xl rounded-xl bg-white text-black p-2 md:p-4 max-h-[85vh] overflow-y-auto w-full select-text leading-normal no-print-scroll font-serif text-[13px]">
                  <div 
                    id="printable-question-paper-doc" 
                    className="p-14 space-y-2 bg-white min-h-[1012px] shadow-sm relative"
                    onClick={() => setActiveFloatingId(null)}
                    style={{
                      width: '720px',
                      zoom: zoomFactor,
                      transformOrigin: 'top center',
                      margin: '0 auto',
                      boxSizing: 'border-box',
                      position: 'relative'
                    }}
                  >
              <style>{`
                .q-block {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .q-block-section, .q-block-heading {
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                }
              `}</style>
              
              {/* HEADING SECTION */}
              <div className="pt-0 pb-1 px-4 text-center space-y-1">
                <h1 className="text-xl font-bold uppercase tracking-wide m-0 p-0">{schoolProfile.name}</h1>
                <h2 className="text-sm font-bold tracking-tight uppercase m-0 p-0">
                  {paperTitle || 'Terminal Examination'}
                </h2>
                
                {/* Meta details list */}
                <div className="flex justify-between text-xs font-bold pt-1 font-sans">
                  <div>Class: {activeClassName}</div>
                  <div>Subject: {activeSubjectName}</div>
                  <div>Max Marks: {totalMarks}</div>
                  <div>Time: {duration}</div>
                </div>
              </div>

              {/* INSTRUCTIONS BOX */}
              {instructions && (
                <div className="border border-black/45 p-3 rounded-sm space-y-1.5">
                  <h4 className="text-xs font-bold uppercase pb-0.5">General Instructions:</h4>
                  <div className="text-xs space-y-1 font-sans leading-relaxed text-zinc-800">
                    {instructions.split('\n').map((line, idx) => (
                      <div key={idx} className="flex gap-1.5 items-start">
                        <span className="font-bold whitespace-nowrap">{idx + 1}.</span>
                        <span>{line.replace(/^\d+[\.\s]*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* QUESTIONS LIST RENDERING */}
              <div className="space-y-2 pt-2">
                {(() => {
                  let questionCounter = 0;
                  return questions.map((q, idx) => {
                    const isStructural = q.type === 'section' || q.type === 'heading' || q.type === 'instruction';
                    const isSubParts = q.type === 'sub_parts';
                    if (q.type === 'section' || q.type === 'heading') {
                      questionCounter = 0;
                    } else if (!isStructural && !isSubParts) {
                      questionCounter++;
                    }
                    const qNum = questionCounter;

                    // Format inline answer spaces [ ], ( ), and underscores into clean CSS shapes
                    const formatPreviewText = (text) => {
                      if (!text) return '';
                      // Replace [ ] or [   ] with a premium styled answer box
                      let formatted = text.replace(/\[\s*\]/g, '<span class="inline-block border border-black w-8 h-6 align-middle mx-1 rounded-sm bg-zinc-50/50"></span>');
                      // Replace ( ) or (   ) with a premium styled answer circle
                      formatted = formatted.replace(/\(\s*\)/g, '<span class="inline-block border-black rounded-full w-6 h-6 align-middle mx-1 bg-zinc-50/50"></span>');
                      // Replace 3 or more underscores dynamically
                      formatted = formatted.replace(/(_)+/g, (match) => {
                        const len = match.length;
                        if (len < 3) return match;
                        if (len <= 10) {
                          return '<span class="inline-block border-b border-black w-24 mx-1">&nbsp;</span>';
                        } else if (len >= 30) {
                          return '<span class="block border-b border-black w-full h-5 my-2"></span>';
                        } else {
                          const widthPercent = Math.min(100, Math.round(len * 2));
                          return `<span class="inline-block border-b border-black mx-1" style="width: ${widthPercent}%">&nbsp;</span>`;
                        }
                      });
                      // Convert newlines to HTML break tags
                      formatted = formatted.replace(/\n/g, '<br />');
                      return formatted;
                    };

                    const formattedMarks = (marks) => {
                      const num = parseFloat(marks) || 0;
                      return `${num} ${num === 1 ? 'Mark' : 'Marks'}`;
                    };

                    if (q.type === 'section') {
                      const alignClass = q.align === 'left' ? 'text-left' : q.align === 'right' ? 'text-right' : 'text-center';
                      const borderClass = q.borderStyle === 'double' ? 'border-y-4 double' : q.borderStyle === 'solid' ? 'border-y border-black' : '';
                      return (
                        <div 
                          key={q.id} 
                          id={`preview-q-${q.id}`}
                          className={`w-full py-1 my-2 font-bold text-sm uppercase tracking-wide border-black ${alignClass} ${borderClass} q-block q-block-section`}
                        >
                          {q.text}
                        </div>
                      );
                    }

                    if (q.type === 'heading') {
                      const alignClass = q.align === 'left' ? 'text-left' : q.align === 'right' ? 'text-right' : 'text-center';
                      return (
                        <div 
                          key={q.id} 
                          id={`preview-q-${q.id}`}
                          className={`w-full py-0.5 my-1 font-bold text-xs uppercase tracking-wide border-black ${alignClass} q-block q-block-heading`}
                        >
                          {q.text}
                        </div>
                      );
                    }

                    if (q.type === 'instruction') {
                      return (
                        <div 
                          key={q.id} 
                          id={`preview-q-${q.id}`}
                          className="w-full text-xs italic font-semibold font-sans my-1 pl-6 text-zinc-700 q-block leading-relaxed"
                        >
                          {q.text}
                        </div>
                      );
                    }

                    return (
                      <div key={q.id} id={`preview-q-${q.id}`} className="space-y-1.5 q-block">
                        <div className="flex justify-between items-start leading-relaxed">
                          <div className="flex-1 flex gap-2">
                            {!isSubParts && <span className="font-bold text-sm font-sans">Q {qNum}.</span>}
                            <div className="flex-1">
                              {q.text && (
                                <span 
                                  dangerouslySetInnerHTML={{ __html: formatPreviewText(q.text) }} 
                                  className="font-serif leading-relaxed text-sm block animate-fade-in"
                                />
                              )}
                            </div>
                          </div>
                          {(q.type === 'sub_parts' || !q.subQuestions || q.subQuestions.length === 0) && (
                            <span className="font-bold text-xs pl-4 whitespace-nowrap font-sans">
                              {formattedMarks(q.marks)}
                            </span>
                          )}
                        </div>

                        {/* Embedded Table */}
                        {q.table && (
                          <div className="w-full overflow-hidden my-2 pl-6">
                            <table className="border-collapse border border-black w-full text-xs font-sans">
                              <tbody>
                                {q.table.data.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="border border-black p-1.5 text-center">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Embedded Vector Drawing */}
                        {q.drawing && q.drawing.length > 0 && (
                          <div className="w-full flex justify-center my-3 pl-6">
                            <svg className="w-full max-w-[400px] h-[180px] border border-black/10 rounded-sm" viewBox="0 0 500 300">
                              {q.drawing.map((s) => (
                                <g key={s.id} transform={`rotate(${s.rotate || 0} ${s.x + (s.w || 0)/2} ${s.y + (s.h || 0)/2})`}>
                                  {s.type === 'rect' && (
                                    <rect x={s.x} y={s.y} width={s.w} height={s.h} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                                  )}
                                  {s.type === 'circle' && (
                                    <ellipse cx={s.x + s.w/2} cy={s.y + s.h/2} rx={s.w/2} ry={s.h/2} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                                  )}
                                  {s.type === 'line' && (
                                    <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                                  )}
                                  {s.type === 'arrow' && (
                                    <g>
                                      <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                                      <polygon points={`${s.x2},${s.y2} ${s.x2-10},${s.y2-6} ${s.x2-10},${s.y2+6}`} fill={s.stroke} />
                                    </g>
                                  )}
                                  {s.type === 'blank' && (
                                    <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray="5,5" />
                                  )}
                                  {s.type === 'text' && (
                                    <text x={s.x} y={s.y + 12} fill={s.stroke} fontSize={s.fontSize || 14} fontFamily="sans-serif" fontWeight="bold">{s.text}</text>
                                  )}
                                </g>
                              ))}
                            </svg>
                          </div>
                        )}

                        {/* Embedded Image */}
                        {q.image && (
                          <div className={`w-full flex justify-${q.image.align || 'center'} my-3 pl-6`}>
                            <img 
                              src={q.image.src} 
                              alt="Embedded attachment" 
                              style={{ width: `${q.image.width}%`, transform: `rotate(${q.image.rotate}deg)` }}
                              className="max-h-[160px] object-contain"
                            />
                          </div>
                        )}

                        {/* MCQ Choices */}
                        {q.type === 'mcq' && q.options && (
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 pl-8 text-xs font-sans">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex gap-1.5 items-center">
                                <span className="font-semibold">{String.fromCharCode(97 + optIdx)})</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Matching Columns */}
                        {q.type === 'matching' && q.matchingColumns && (
                          <div className="grid grid-cols-2 gap-8 pl-8 my-2 text-xs font-sans">
                            <div className="space-y-1 pr-4">
                              {q.matchingColumns.left.map((item, idx) => (
                                <div key={idx} className="flex gap-2 pt-1">
                                  <span className="font-bold">{idx + 1}.</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1">
                              {q.matchingColumns.right.map((item, idx) => (
                                <div key={idx} className="flex gap-2 pt-1">
                                  <span className="font-bold">{String.fromCharCode(97 + idx)}.</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sub-parts rendering in a 2-column grid layout */}
                        {q.type === 'sub_parts' && q.subQuestions && q.subQuestions.length > 0 && (
                          <div className="grid grid-cols-2 gap-y-1.5 gap-x-8 pl-8 my-1 text-xs font-serif leading-relaxed">
                            {q.subQuestions.map((sq, sqIdx) => (
                              <div key={sq.id} className="flex justify-between items-start leading-relaxed pr-2">
                                <div className="flex-1 flex gap-2">
                                  <span className="font-bold">{String.fromCharCode(97 + sqIdx)})</span>
                                  <span dangerouslySetInnerHTML={{ __html: formatPreviewText(sq.text) }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    );
                  });
                })()}
              </div>

              {/* Floating draggable images on the paper */}
              {floatingImages.map((img) => (
                <div 
                  key={img.id}
                  tabIndex={0}
                  className={`absolute group border border-dashed hover:border-primary/50 transition-all focus:outline-none ${
                    activeFloatingId === img.id ? 'border-primary ring-2 ring-primary/30 ring-offset-1 rounded-sm' : 'border-transparent'
                  }`}
                  style={{ 
                    left: `${img.x}px`, 
                    top: `${img.y}px`, 
                    width: `${img.width}px`,
                    height: img.height ? `${img.height}px` : (['circle', 'box', 'square'].includes(img.type) ? `${img.width}px` : img.type === 'drawing' ? `${img.width * 0.6}px` : 'auto'),
                    transform: `rotate(${img.rotate || 0}deg)`,
                    transformOrigin: 'center center',
                    zIndex: 49
                  }}
                  onDragStart={(e) => e.preventDefault()}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.focus();
                    handleImageMouseDown(e, img.id, img.x, img.y);
                    setActiveFloatingId(img.id);
                  }}
                  onKeyDown={(e) => {
                    // Ignore keydowns if typing in an input
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                      return;
                    }
                    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace'];
                    if (!keys.includes(e.key)) return;
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const nudgeAmount = e.shiftKey ? 5 : 1;
                    
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      deleteFloatingImage(img.id);
                      setActiveFloatingId(null);
                      return;
                    }
                    
                    setFloatingImages(prev => {
                      const next = prev.map(item => {
                        if (item.id === img.id) {
                          let newX = item.x;
                          let newY = item.y;
                          if (e.key === 'ArrowLeft') newX = Math.max(0, item.x - nudgeAmount);
                          if (e.key === 'ArrowRight') newX = Math.min(720 - (item.width || 100), item.x + nudgeAmount);
                          if (e.key === 'ArrowUp') newY = Math.max(0, item.y - nudgeAmount);
                          if (e.key === 'ArrowDown') newY = item.y + nudgeAmount;
                          return { ...item, x: newX, y: newY };
                        }
                        return item;
                      });
                      const paperState = JSON.parse(localStorage.getItem('qpd_current_draft') || '{}');
                      paperState.floatingImages = next;
                      localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
                      return next;
                    });
                  }}
                >
                  {img.type === 'table' ? (
                    <table className="border-collapse border border-black w-full h-full text-xs font-serif bg-white" style={{ minHeight: '100%' }}>
                      <tbody>
                        {img.tableData?.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="border border-black p-0.5 text-center font-sans">
                                <input 
                                  type="text"
                                  value={cell}
                                  onChange={(e) => updateFloatingTableCell(img.id, rIdx, cIdx, e.target.value)}
                                  className="w-full text-center border-0 outline-none bg-transparent font-sans text-xs focus:ring-0 p-1 print:p-1.5"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : img.type === 'drawing' ? (
                    <div className="w-full h-full border border-black/10 bg-white/50 rounded-sm">
                      <svg className="w-full h-full" viewBox="0 0 500 300" style={{ pointerEvents: 'none' }}>
                        {img.drawingData?.map((s) => (
                          <g key={s.id} transform={`rotate(${s.rotate || 0} ${s.x + (s.w || 0)/2} ${s.y + (s.h || 0)/2})`}>
                            {s.type === 'rect' && (
                              <rect x={s.x} y={s.y} width={s.w} height={s.h} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                            )}
                            {s.type === 'circle' && (
                              <ellipse cx={s.x + s.w/2} cy={s.y + s.h/2} rx={s.w/2} ry={s.h/2} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                            )}
                            {s.type === 'line' && (
                              <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                            )}
                            {s.type === 'arrow' && (
                              <g>
                                <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                                <polygon points={`${s.x2},${s.y2} ${s.x2-10},${s.y2-6} ${s.x2-10},${s.y2+6}`} fill={s.stroke} />
                              </g>
                            )}
                            {s.type === 'blank' && (
                              <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray="5,5" />
                            )}
                            {s.type === 'text' && (
                              <text x={s.x} y={s.y + 12} fill={s.stroke} fontSize={s.fontSize || 14} fontFamily="sans-serif" fontWeight="bold">{s.text}</text>
                            )}
                          </g>
                        ))}
                      </svg>
                    </div>
                  ) : img.type === 'box' ? (
                    <div className="w-full h-full border border-black bg-white/20 rounded-sm min-h-[24px]"></div>
                  ) : img.type === 'circle' ? (
                    <div className="w-full h-full border border-black rounded-full bg-white/20 min-h-[24px]"></div>
                  ) : img.type === 'square' ? (
                    <div className="w-full h-full border border-black bg-white/10 rounded-sm"></div>
                  ) : img.type === 'rectangle' ? (
                    <div className="w-full h-full border border-black bg-white/10 rounded-sm"></div>
                  ) : img.type === 'line' ? (
                    <div className="w-full h-0 border-b border-black"></div>
                  ) : (
                    <img 
                      src={img.src} 
                      alt="Floating attachment" 
                      className="w-full h-auto select-none cursor-move" 
                      draggable={false}
                    />
                  )}
                  {/* Drag-to-resize handle in the bottom-right corner */}
                  {img.type !== 'line' && (
                    <div 
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary border-2 border-white cursor-se-resize rounded-full translate-x-1/2 translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 print:hidden shadow-md active:scale-125"
                      onMouseDown={(e) => {
                        const currentHeight = img.height || (['circle', 'box', 'square'].includes(img.type) ? img.width : img.type === 'drawing' ? img.width * 0.6 : 100);
                        handleResizeMouseDown(e, img.id, img.width, currentHeight);
                      }}
                      title="Drag corner to resize"
                    />
                  )}
                  {/* Actions toolbar on hover */}
                  <div className="absolute -top-7 left-0 right-0 hidden group-hover:flex justify-between items-center bg-white dark:bg-zinc-900 shadow-md border border-border px-1.5 py-0.5 rounded text-[11px] gap-1.5 z-50 print:hidden font-sans">
                    <span className="font-bold text-text-muted">{img.width}px</span>
                    <div className="flex gap-1 items-center">
                      {img.type === 'table' && (
                        <>
                          <button 
                            type="button" 
                            className="px-1 py-0.5 text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded font-bold text-primary"
                            onClick={(e) => { e.stopPropagation(); handleAddTableDimension(img.id, 'row'); }}
                            title="Add Row"
                          >
                            +Row
                          </button>
                          <button 
                            type="button" 
                            className="px-1 py-0.5 text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded font-bold text-primary"
                            onClick={(e) => { e.stopPropagation(); handleAddTableDimension(img.id, 'col'); }}
                            title="Add Column"
                          >
                            +Col
                          </button>
                        </>
                      )}
                      {img.type === 'drawing' && (
                        <button 
                          type="button" 
                          className="px-1.5 py-0.5 text-[11px] bg-primary text-white hover:bg-primary/95 rounded font-bold"
                          onClick={(e) => { e.stopPropagation(); handleOpenDrawingDialogForFloating(img.id); }}
                          title="Edit Drawing"
                        >
                          Edit Shapes
                        </button>
                      )}
                      <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
                      <button 
                        type="button" 
                        className="px-1 py-0.5 text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded font-bold text-text-primary"
                        onClick={(e) => { e.stopPropagation(); resizeFloatingImage(img.id, -20); }}
                        title="Shrink"
                      >
                        A-
                      </button>
                      <button 
                        type="button" 
                        className="px-1 py-0.5 text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded font-bold text-text-primary"
                        onClick={(e) => { e.stopPropagation(); resizeFloatingImage(img.id, 20); }}
                        title="Grow"
                      >
                        A+
                      </button>
                      <button 
                        type="button" 
                        className="px-1 py-0.5 text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded font-bold text-text-primary"
                        onClick={(e) => { e.stopPropagation(); rotateFloatingImage(img.id); }}
                        title="Rotate"
                      >
                        ↻
                      </button>
                      <button 
                        type="button" 
                        className="px-1 py-0.5 text-[11px] bg-red-50 hover:bg-red-100 text-red-600 rounded font-bold"
                        onClick={(e) => { e.stopPropagation(); deleteFloatingImage(img.id); }}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              {/* VISUAL A4 PAGE BREAK GUIDES (Screen Mode Only - Hidden when printing) */}
              {Array.from({ length: Math.max(0, totalPages - 1) }).map((_, pIdx) => {
                const pageTop = (pIdx + 1) * PAGE_HEIGHT;
                return (
                  <div
                    key={pIdx}
                    className="absolute left-0 right-0 z-30 pointer-events-none print:hidden flex items-center justify-center no-print"
                    style={{ top: `${pageTop}px`, transform: 'translateY(-50%)' }}
                  >
                    <div className="w-full border-b-2 border-dashed border-red-500/80 shadow-xs" />
                    <span className="absolute px-3 py-1 bg-red-600 text-white font-sans text-[11px] font-bold rounded-full shadow-lg uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 border border-red-400">
                      <span>✂</span> Page Break — Page {pIdx + 2} Starts Here (End of Page {pIdx + 1})
                    </span>
                  </div>
                );
              })}

            </div>
          </div>
          </>
            );
          })()}
        </div>

      </div>

      {/* MODAL 1: LOAD TEMPLATE */}
      <Dialog isOpen={isTemplateOpen} onClose={() => setIsTemplateOpen(false)}>
        <div className="p-6 space-y-4 max-w-md bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-bold flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" /> Load Examination Template</h2>
          <p className="text-xs text-text-secondary">Loading a template will overwrite current settings and questions. Select a predefined paper standard below:</p>
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {Object.keys(PAPER_TEMPLATES).map((key) => (
              <Button 
                key={key}
                type="button" 
                variant="outline" 
                className="justify-start font-bold text-xs p-3.5 h-auto text-left flex flex-col items-start gap-1"
                onClick={() => handleLoadTemplate(key)}
              >
                <span className="font-bold text-text-primary">{PAPER_TEMPLATES[key].name}</span>
                <span className="text-[11px] text-text-muted">Marks: {PAPER_TEMPLATES[key].maxMarks} | {PAPER_TEMPLATES[key].duration}</span>
              </Button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsTemplateOpen(false)}>Close</Button>
            <Button type="button" variant="default" size="sm" onClick={handleSaveCustomTemplate} className="bg-primary text-white">Save Current as Custom</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 2: VERSION HISTORY */}
      <Dialog isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)}>
        <div className="p-6 space-y-4 max-w-md bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-bold flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Version History / Revisions</h2>
          <p className="text-xs text-text-secondary">Select a previous auto-saved version to restore the editor state:</p>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 pt-1">
            {revisions.length === 0 ? (
              <div className="text-center text-xs text-text-muted py-6">No saved revisions found.</div>
            ) : (
              revisions.map((rev) => (
                <div key={rev.id} className="flex justify-between items-center p-2.5 bg-zinc-50 rounded border border-border text-xs hover:bg-zinc-100 transition-all">
                  <div>
                    <div className="font-bold text-text-primary">{rev.title}</div>
                    <div className="text-[11px] text-text-muted">{rev.timestamp} • {rev.questionCount} Questions</div>
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs font-bold text-primary" onClick={() => handleRestoreRevision(rev)}>
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsHistoryOpen(false)}>Close</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: EQUATION EDITOR */}
      <Dialog isOpen={isEquationOpen} onClose={() => setIsEquationOpen(false)} containerClassName="md:justify-start md:pl-20">
        <div className="p-6 space-y-4 max-w-2xl w-full bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-bold flex items-center gap-2 text-text-primary">
            <PlusCircle className="h-5 w-5 text-primary" /> Visual Math Question Editor
          </h2>
          <p className="text-xs text-text-secondary leading-normal">
            Type your question text below. Click the math buttons to insert formulas/symbols directly at the cursor.
          </p>

          <div 
            key={activeQuestionId}
            id="math-modal-editor"
            contentEditable
            dangerouslySetInnerHTML={{ __html: modalHtml }}
            onInput={handleModalEditorInput}
            onBlur={handleModalEditorBlur}
            onKeyDown={handleEditorKeyDown}
            className="border border-border rounded-lg p-4 min-h-[140px] max-h-[220px] bg-background text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed font-sans overflow-y-auto"
            placeholder="Type question content and click math buttons to insert formulas..."
          />

          {/* CALCULATOR TOOLBAR */}
          <div className="space-y-4 pt-2 border-t border-border/50">
            {/* Templates */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Equation Templates</span>
              <div className="flex flex-wrap gap-1.5">
                {MATH_TEMPLATES.map((item) => (
                  <Button
                    key={item.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 font-bold text-xs bg-zinc-50 border-zinc-200 hover:bg-zinc-100 flex items-center gap-1 text-text-primary"
                    onClick={() => insertSymbolHTML(item.html)}
                  >
                    {item.icon}
                  </Button>
                ))}
              </div>
            </div>

            {/* Greek Letters */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Greek Symbols</span>
              <div className="flex flex-wrap gap-1.5">
                {GREEK_SYMBOLS.map((item) => (
                  <Button
                    key={item.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-10 font-bold text-sm bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-text-primary font-serif flex items-center justify-center"
                    onClick={() => insertSymbolHTML(item.html)}
                    title={item.label}
                  >
                    {item.char}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mathematical Operators */}
            <div>
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Mathematical Operators & Accents</span>
              <div className="flex flex-wrap gap-1.5">
                {MATH_OPERATORS.map((item, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-10 font-bold text-xs bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-text-primary flex items-center justify-center"
                    onClick={() => insertSymbolHTML(item.html)}
                  >
                    {item.char === '^' ? 'x²' : item.char === 'sub' ? 'x₂' : item.char}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button 
              type="button" 
              variant="default" 
              size="sm" 
              onClick={() => setIsEquationOpen(false)} 
              className="bg-primary text-white font-bold"
            >
              Done & Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 4: TABLE DIALOG */}
      <Dialog isOpen={isTableOpen} onClose={() => setIsTableOpen(false)}>
        <div className="p-6 space-y-4 max-w-sm bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-bold flex items-center gap-2"><Grid className="h-5 w-5 text-primary" /> Insert Custom Table</h2>
          <div className="grid grid-cols-2 gap-4 text-xs font-bold">
            <div className="space-y-1">
              <span>Rows</span>
              <Input type="number" min="1" max="10" value={tableRows} onChange={(e) => setTableRows(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <span>Columns</span>
              <Input type="number" min="1" max="10" value={tableCols} onChange={(e) => setTableCols(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsTableOpen(false)}>Cancel</Button>
            <Button type="button" variant="default" size="sm" onClick={insertTable} className="bg-primary text-white">Insert Grid</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 5: VECTOR DRAWING DIALOG */}
      <Dialog isOpen={isDrawingOpen} onClose={() => setIsDrawingOpen(false)}>
        <div className="p-6 space-y-4 max-w-4xl w-full bg-card rounded-xl border border-border shadow-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Interactive Vector Drawing Editor
            </h2>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'select' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => setDrawingTool('select')}>Pointer</Button>
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'rect' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => { setDrawingTool('rect'); addShape('rect'); }}>+ Rect</Button>
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'circle' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => { setDrawingTool('circle'); addShape('circle'); }}>+ Circle</Button>
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'line' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => { setDrawingTool('line'); addShape('line'); }}>+ Line</Button>
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'arrow' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => { setDrawingTool('arrow'); addShape('arrow'); }}>+ Arrow</Button>
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'blank' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => { setDrawingTool('blank'); addShape('blank'); }}>+ Blank Line</Button>
              <Button type="button" size="sm" variant="outline" className={`h-8 font-bold ${drawingTool === 'text' ? 'bg-primary/10 text-primary border-primary/20' : ''}`} onClick={() => { setDrawingTool('text'); addShape('text'); }}>+ Text Box</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Draw Properties Panel */}
            <div className="space-y-4 text-xs font-bold bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border">
              <span className="text-[11px] font-bold uppercase text-text-muted">Shape Attributes</span>
              
              <div className="space-y-2">
                <span>Stroke Color</span>
                <input 
                  type="color" 
                  value={strokeColor}
                  onChange={(e) => {
                    setStrokeColor(e.target.value);
                    if (selectedShapeId) setShapes(shapes.map(s => s.id === selectedShapeId ? { ...s, stroke: e.target.value } : s));
                  }}
                  className="w-full h-8 cursor-pointer rounded border-0 bg-transparent p-0" 
                />
              </div>

              <div className="space-y-2">
                <span>Fill Color</span>
                <select
                  value={fillColor}
                  onChange={(e) => {
                    setFillColor(e.target.value);
                    if (selectedShapeId) setShapes(shapes.map(s => s.id === selectedShapeId ? { ...s, fill: e.target.value } : s));
                  }}
                  className="w-full h-8 px-2 border bg-background rounded"
                >
                  <option value="transparent">Transparent</option>
                  <option value="#ffffff">White</option>
                  <option value="#f4f4f5">Light Grey</option>
                  <option value="#e0e0e0">Grey</option>
                  <option value="#fee2e2">Red</option>
                  <option value="#dbeafe">Blue</option>
                  <option value="#dcfce7">Green</option>
                  <option value="#fef9c3">Yellow</option>
                </select>
              </div>

              <div className="space-y-2">
                <span>Stroke Weight</span>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={strokeWidth}
                  onChange={(e) => {
                    setStrokeWidth(parseInt(e.target.value));
                    if (selectedShapeId) setShapes(shapes.map(s => s.id === selectedShapeId ? { ...s, strokeWidth: parseInt(e.target.value) } : s));
                  }}
                  className="w-full"
                />
              </div>

              {/* Text box string editor */}
              {selectedShapeId && shapes.find(s => s.id === selectedShapeId)?.type === 'text' && (
                <div className="space-y-2">
                  <span>Edit Text</span>
                  <Input 
                    value={textVal} 
                    onChange={(e) => {
                      setTextVal(e.target.value);
                      setShapes(shapes.map(s => s.id === selectedShapeId ? { ...s, text: e.target.value } : s));
                    }} 
                  />
                </div>
              )}

              {/* Grid Snap */}
              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox" 
                  id="snap-to-grid"
                  checked={snapToGrid} 
                  onChange={(e) => setSnapToGrid(e.target.checked)} 
                />
                <label htmlFor="snap-to-grid" className="select-none">Snap to Grid (10px)</label>
              </div>

              {/* Operations */}
              <div className="border-t border-border pt-4 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px]" onClick={bringShapeForward}>Bring Front</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px]" onClick={sendShapeBackward}>Send Back</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px]" onClick={() => rotateSelectedShape(15)}>Rotate 15°</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px]" onClick={duplicateSelectedShape}>Duplicate</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px]" onClick={() => resizeSelectedShape(10, 10)}>Size +</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px]" onClick={() => resizeSelectedShape(-10, -10)}>Size -</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[11px] text-red-500 bg-red-50 hover:bg-red-100 col-span-2" onClick={deleteSelectedShape}>Delete Selected</Button>
              </div>

            </div>

            {/* Drawing Area Canvas */}
            <div className="md:col-span-3 border border-border rounded-xl bg-white relative h-[360px] overflow-hidden select-none">
              
              {/* Grid backgrounds */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />

              <svg 
                className="w-full h-full"
                onClick={() => setSelectedShapeId(null)}
              >
                {shapes.map((s) => {
                  const isSel = selectedShapeId === s.id;
                  
                  return (
                    <g 
                      key={s.id}
                      onClick={(e) => { e.stopPropagation(); setSelectedShapeId(s.id); }}
                      className="cursor-move"
                      transform={`rotate(${s.rotate || 0} ${s.x + (s.w || 0)/2} ${s.y + (s.h || 0)/2})`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedShapeId(s.id);
                        setIsDrawingActive(true);
                        
                        const startX = e.clientX;
                        const startY = e.clientY;

                        const handleMouseMove = (mv) => {
                          const dx = mv.clientX - startX;
                          const dy = mv.clientY - startY;
                          
                          let newDx = snapToGrid ? Math.round(dx / 10) * 10 : dx;
                          let newDy = snapToGrid ? Math.round(dy / 10) * 10 : dy;

                          handleShapeDrag(s.id, newDx, newDy);
                        };

                        const handleMouseUp = () => {
                          setIsDrawingActive(false);
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                        };

                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      {/* Rect */}
                      {s.type === 'rect' && (
                        <rect x={s.x} y={s.y} width={s.w} height={s.h} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                      )}
                      
                      {/* Circle */}
                      {s.type === 'circle' && (
                        <ellipse cx={s.x + s.w/2} cy={s.y + s.h/2} rx={s.w/2} ry={s.h/2} stroke={s.stroke} fill={s.fill} strokeWidth={s.strokeWidth} />
                      )}

                      {/* Line */}
                      {s.type === 'line' && (
                        <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                      )}

                      {/* Arrow */}
                      {s.type === 'arrow' && (
                        <g>
                          <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
                          <polygon points={`${s.x2},${s.y2} ${s.x2-10},${s.y2-6} ${s.x2-10},${s.y2+6}`} fill={s.stroke} />
                        </g>
                      )}

                      {/* Blank dashed line */}
                      {s.type === 'blank' && (
                        <line x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray="5,5" />
                      )}

                      {/* Text Box */}
                      {s.type === 'text' && (
                        <text x={s.x} y={s.y + 12} fill={s.stroke} fontSize={s.fontSize || 14} fontFamily="sans-serif" fontWeight="bold">{s.text}</text>
                      )}

                      {/* Selection Box overlay */}
                      {isSel && (
                        <rect 
                          x={s.x - 4} 
                          y={s.y - 4} 
                          width={(s.type === 'line' || s.type === 'arrow' || s.type === 'blank' ? (s.x2 - s.x) : s.w) + 8} 
                          height={(s.type === 'line' || s.type === 'arrow' || s.type === 'blank' ? 10 : s.h) + 8} 
                          fill="none" 
                          stroke="#3b82f6" 
                          strokeWidth="1.5" 
                          strokeDasharray="3,3" 
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDrawingOpen(false)}>Cancel</Button>
            <Button type="button" variant="default" size="sm" onClick={saveDrawing} className="bg-primary text-white">Save Drawing</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 6: FIND / STATS */}
      <Dialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)}>
        <div className="p-6 space-y-4 max-w-sm bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-bold flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Document Statistics & Search</h2>
          
          <div className="p-3 bg-zinc-50 rounded border text-xs space-y-1.5 font-sans">
            <div className="flex justify-between">
              <span>Word Count:</span>
              <span className="font-bold">{getDocStats().words} words</span>
            </div>
            <div className="flex justify-between">
              <span>Character Count:</span>
              <span className="font-bold">{getDocStats().chars} characters</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="space-y-1 text-xs">
              <span className="font-bold">Find text</span>
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Word or phrase to find..." />
            </div>
            <div className="space-y-1 text-xs">
              <span className="font-bold">Replace with</span>
              <Input value={replaceQuery} onChange={(e) => setReplaceQuery(e.target.value)} placeholder="Word or phrase to replace with..." />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSearchOpen(false)}>Close</Button>
            <Button type="button" variant="default" size="sm" onClick={handleSearchReplace} className="bg-primary text-white" disabled={!searchQuery}>Replace All</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 7: SAVED PAPERS LIBRARY */}
      <Dialog isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} className="w-[95vw] md:max-w-4xl">
        <div className="p-6 space-y-4 bg-card rounded-2xl border border-border shadow-xl w-full min-h-[480px] flex flex-col">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Saved Papers Library
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              {librarySelectedClass ? `Viewing saved papers for ${librarySelectedClass}:` : 'Select a class below to view its saved question papers:'}
            </p>
          </div>
          
          <div className="flex-1 max-h-[480px] overflow-y-auto space-y-2 pr-1 pt-1">
            {savedPapersList.length === 0 ? (
              <div className="text-center text-xs text-text-muted py-16 font-medium">
                No saved papers found in your library.
              </div>
            ) : !librarySelectedClass ? (
              /* Class Cards Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                {sortClassNames([...new Set(savedPapersList.map(p => p.className || 'Unassigned Class'))]).map((clsName) => {
                  const classPapers = savedPapersList.filter(p => (p.className || 'Unassigned Class') === clsName);
                  return (
                    <Button
                      key={clsName}
                      type="button"
                      variant="outline"
                      className="justify-start font-bold text-xs p-4 h-auto text-left flex items-center gap-3 bg-zinc-50 border-zinc-200 hover:bg-zinc-100/50 rounded-xl transition-all"
                      onClick={() => setLibrarySelectedClass(clsName)}
                    >
                      <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-sm text-text-primary block truncate">{clsName}</span>
                        <span className="text-[11px] text-text-muted font-bold block">{classPapers.length} {classPapers.length === 1 ? 'Paper' : 'Papers'}</span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            ) : (
              /* Papers List View for Selected Class */
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 font-bold text-xs flex items-center gap-1 hover:bg-zinc-100"
                    onClick={() => setLibrarySelectedClass(null)}
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Classes
                  </Button>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {savedPapersList
                    .filter(p => (p.className || 'Unassigned Class') === librarySelectedClass)
                    .map((paper) => (
                      <div key={paper.id} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900 rounded border border-border text-xs hover:bg-zinc-100/50 transition-all">
                        <div className="space-y-1 pr-4">
                          <div className="font-bold text-text-primary text-sm">
                            {paper.paperTitle || 'Untitled Paper'}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-text-muted font-bold">
                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">
                              Subject: {paper.subjectName || 'N/A'}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Last Saved: {new Date(paper.lastSaved).toLocaleString()} • {paper.questions?.length || 0} Questions
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-xs font-bold text-primary hover:bg-primary/10"
                            onClick={() => handleLoadSavedPaper(paper)}
                          >
                            Load
                          </Button>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-xs font-bold text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteSavedPaper(paper.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* CUSTOM CONFIRMATION DIALOG */}
      <Dialog 
        isOpen={confirmDialog.isOpen} 
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        hideHeader={true}
        className="max-w-md"
      >
        <div className="space-y-4">
          <h2 className="text-base font-bold flex items-center gap-2 text-text-primary">
            <Info className="h-5 w-5 text-amber-500" /> {confirmDialog.title}
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            {confirmDialog.message}
          </p>
          
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="default" 
              size="sm" 
              className="bg-primary text-white font-bold" 
              onClick={confirmDialog.onConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>

      {/* HIDDEN FILE INPUT FOR IMAGE UPLOAD */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/png, image/jpeg, image/jpg, image/svg+xml"
        className="hidden" 
      />

    </div>
  );
}
