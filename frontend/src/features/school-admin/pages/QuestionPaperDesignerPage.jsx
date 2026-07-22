import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash, Trash2, Copy, Save, Printer, Download, Search, 
  Settings, CheckCircle, AlertCircle, Edit, ChevronUp, ChevronDown, 
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Image, Table as TableIcon, Heading, HelpCircle, Eye, 
  Type, Scissors, FileText, LayoutTemplate, RotateCw, Grid,
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

  // Equation Editor State
  const [equationType, setEquationType] = useState('fraction');
  const [eqPartA, setEqPartA] = useState('');
  const [eqPartB, setEqPartB] = useState('');
  const [eqPartC, setEqPartC] = useState('');

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
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));
  };

  const saveDraft = () => {
    if (!selectedClassId) {
      setError('Please select a class before saving draft.');
      return;
    }
    const paperState = {
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
      lastSaved: new Date().toISOString()
    };
    
    // Save draft
    localStorage.setItem('qpd_current_draft', JSON.stringify(paperState));

    // Save to revisions list
    const currentRevisions = JSON.parse(localStorage.getItem('qpd_revisions') || '[]');
    const newRevision = {
      id: 'rev-' + Date.now(),
      timestamp: new Date().toLocaleTimeString() + ' ' + new Date().toLocaleDateString(),
      title: paperTitle || 'Untitled Paper',
      questionCount: questions.length,
      paperState
    };
    const updatedRevisions = [newRevision, ...currentRevisions].slice(0, 15); // keep max 15 revisions
    localStorage.setItem('qpd_revisions', JSON.stringify(updatedRevisions));
    setRevisions(updatedRevisions);

    setSuccess('Draft and version history updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Restore Draft on mount if available
  useEffect(() => {
    const saved = localStorage.getItem('qpd_current_draft');
    if (saved) {
      try {
        const state = JSON.parse(saved);
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
      } catch (err) {
        console.error('Failed to parse draft state', err);
      }
    }

    // Load revisions list
    const savedRevisions = JSON.parse(localStorage.getItem('qpd_revisions') || '[]');
    setRevisions(savedRevisions);
  }, []);

  // Restore previous revision
  const handleRestoreRevision = (rev) => {
    const state = rev.paperState;
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
      defaultText = 'Answer the following sub-questions:';
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

  // Insert Box, Circle or Underline answer indicator at selection or end
  const insertAnswerSpace = (qId, type) => {
    let space = '';
    if (type === 'box') space = ' [ ] ';
    else if (type === 'circle') space = ' ( ) ';
    else if (type === 'line') space = ' _______ ';

    // Try to insert at contentEditable cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let container = range.commonAncestorContainer;
      while (container && container.nodeType !== Node.ELEMENT_NODE) {
        container = container.parentNode;
      }
      if (container && container.hasAttribute('contenteditable')) {
        range.deleteContents();
        const textNode = document.createTextNode(space);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        
        const content = container.innerHTML;
        const nextQuestions = questions.map(q => q.id === qId ? { ...q, text: content } : q);
        setQuestions(nextQuestions);
        recordHistory(nextQuestions);
        return;
      }
    }

    // Fallback: append
    const nextQuestions = questions.map(q => {
      if (q.id === qId) {
        return {
          ...q,
          text: q.text + space
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
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
  const triggerImageUpload = (qId) => {
    setActiveQuestionId(qId);
    fileInputRef.current.click();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const nextQuestions = questions.map(q => {
        if (q.id === activeQuestionId) {
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
        return q;
      });
      setQuestions(nextQuestions);
      recordHistory(nextQuestions);
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
    const nextQuestions = questions.map(q => {
      if (q.id === activeQuestionId) {
        return {
          ...q,
          table: {
            rows: tableRows,
            cols: tableCols,
            data: rowsArr,
            borderStyle: 'solid',
            cellBg: '#ffffff',
            align: 'left'
          }
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
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
    setEquationType('fraction');
    setEqPartA('');
    setEqPartB('');
    setEqPartC('');
    setIsEquationOpen(true);
  };

  const insertEquation = () => {
    let htmlMarkup = '';
    if (equationType === 'fraction') {
      htmlMarkup = `<span class="inline-flex flex-col items-center justify-center align-middle mx-1" style="font-size:0.9em; line-height:1;"><span class="border-b border-black pb-0.5">${eqPartA}</span><span class="pt-0.5">${eqPartB}</span></span>`;
    } else if (equationType === 'sqrt') {
      htmlMarkup = `<span class="inline-block align-middle mx-1" style="font-family:sans-serif;">&radic;<span class="border-t border-black px-0.5" style="margin-top:-2px;">${eqPartA}</span></span>`;
    } else if (equationType === 'cube_root') {
      htmlMarkup = `<span class="inline-block align-middle mx-1" style="font-family:sans-serif;"><sup style="font-size:0.6em; margin-right:-4px; vertical-align:super;">3</sup>&radic;<span class="border-t border-black px-0.5" style="margin-top:-2px;">${eqPartA}</span></span>`;
    } else if (equationType === 'integral') {
      htmlMarkup = `<span class="inline-flex items-center align-middle mx-1"><span class="flex flex-col text-[0.65em] leading-none text-right pr-0.5 justify-between h-[1.8em]"><span>${eqPartA}</span><span>${eqPartB}</span></span><span class="text-xl font-serif leading-none">&int;</span><span class="pl-1">${eqPartC}</span></span>`;
    } else if (equationType === 'limit') {
      htmlMarkup = `<span class="inline-flex flex-col items-center align-middle mx-1 text-center leading-none"><span class="text-[0.85em] font-bold">lim</span><span class="text-[0.6em]">${eqPartA} &rarr; ${eqPartB}</span></span><span class="pl-1 align-middle inline-block">${eqPartC}</span>`;
    } else if (equationType === 'matrix') {
      htmlMarkup = `<span class="inline-flex items-center align-middle mx-1"><span class="text-xl font-light pr-1">[</span><span class="grid grid-cols-2 gap-1.5 text-center text-xs"><span>${eqPartA || '0'}</span><span>${eqPartB || '0'}</span><span>${eqPartC || '0'}</span><span>0</span></span><span class="text-xl font-light pl-1">]</span></span>`;
    } else if (equationType === 'sigma') {
      htmlMarkup = `<span class="inline-flex flex-col items-center align-middle mx-1 text-center leading-none"><span class="text-[0.6em]">${eqPartA}</span><span class="text-lg font-serif">&Sigma;</span><span class="text-[0.6em]">${eqPartB}</span></span><span class="pl-1 align-middle inline-block">${eqPartC}</span>`;
    } else if (equationType === 'greek') {
      htmlMarkup = `<span class="inline-block font-serif mx-0.5">${eqPartA}</span>`;
    }

    const nextQuestions = questions.map(q => {
      if (q.id === activeQuestionId) {
        return {
          ...q,
          text: q.text + ' ' + htmlMarkup
        };
      }
      return q;
    });

    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
    setIsEquationOpen(false);
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
    const nextQuestions = questions.map(q => {
      if (q.id === activeQuestionId) {
        return {
          ...q,
          drawing: shapes
        };
      }
      return q;
    });
    setQuestions(nextQuestions);
    recordHistory(nextQuestions);
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

  // Word formatting helper triggers
  const applyTextFormat = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
  };

  const activeClassName = (classes.find(c => String(c.id) === String(selectedClassId))?.name) || 'Class';
  const activeSubjectName = (subjects.find(s => String(s.id) === String(selectedSubjectId))?.name) || 'Subject';

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
            <h1 className="text-xl font-black font-display tracking-tight text-text-primary">
              Question Paper Designer
            </h1>
            <p className="text-xs text-text-secondary">
              Configure parameters, write questions, build drawings/tables, and generate PDFs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs"
            onClick={() => setIsTemplateOpen(true)}
          >
            <LayoutTemplate className="h-4 w-4" /> Load Template
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
            onClick={saveDraft}
          >
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button 
            type="button"
            variant="default" 
            size="sm"
            className="flex items-center gap-1.5 font-bold text-xs bg-primary text-white"
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
                    {classes.map(c => (
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
                {/* Paper Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Paper Title</label>
                  <Input 
                    placeholder="Half Yearly Examination" 
                    value={paperTitle} 
                    onChange={(e) => setPaperTitle(e.target.value)} 
                  />
                </div>

                {/* Exam Name Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Exam Name</label>
                  <select 
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    className="w-full h-10 px-3 border border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">-- Select Exam --</option>
                    {exams.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Academic Year (auto-selected) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Academic Year</label>
                  <Input 
                    value={academicYearName} 
                    onChange={(e) => setAcademicYearName(e.target.value)}
                    placeholder="2026-2027" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Duration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Duration</label>
                  <Input 
                    placeholder="3 Hours" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)} 
                  />
                </div>

                {/* Max Marks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Maximum Marks</label>
                  <Input 
                    type="number"
                    placeholder="100" 
                    value={maxMarks} 
                    onChange={(e) => setMaxMarks(e.target.value)} 
                  />
                </div>

                {/* Passing Marks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Passing Marks</label>
                  <Input 
                    type="number"
                    placeholder="33" 
                    value={passingMarks} 
                    onChange={(e) => setPassingMarks(e.target.value)} 
                  />
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

          {/* CARD 2: EDITOR FORMATTING TOOLBAR */}
          <Card className="sticky top-32 z-30 shadow-md">
            <CardContent className="p-3 flex flex-wrap items-center gap-1 bg-zinc-50 dark:bg-zinc-900 border-b border-border rounded-t-lg">
              {/* Text formatting tags */}
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bold (Ctrl+B)" onClick={() => applyTextFormat('bold')}><Bold className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Italic (Ctrl+I)" onClick={() => applyTextFormat('italic')}><Italic className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Underline (Ctrl+U)" onClick={() => applyTextFormat('underline')}><Underline className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Strikethrough" onClick={() => applyTextFormat('strikeThrough')}><Strikethrough className="h-4 w-4" /></Button>
              
              <div className="h-6 w-px bg-border mx-1" />

              {/* Alignments */}
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Align Left" onClick={() => applyTextFormat('justifyLeft')}><AlignLeft className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Align Center" onClick={() => applyTextFormat('justifyCenter')}><AlignCenter className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Align Right" onClick={() => applyTextFormat('justifyRight')}><AlignRight className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Justify" onClick={() => applyTextFormat('justifyFull')}><AlignJustify className="h-4 w-4" /></Button>

              <div className="h-6 w-px bg-border mx-1" />

              {/* Lists */}
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Bullet List" onClick={() => applyTextFormat('insertUnorderedList')}><List className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Numbered List" onClick={() => applyTextFormat('insertOrderedList')}><ListOrdered className="h-4 w-4" /></Button>
              
              <div className="h-6 w-px bg-border mx-1" />

              {/* Superscript/Subscript */}
              <Button type="button" variant="ghost" size="sm" className="h-8 px-1 text-xs font-bold" title="Superscript" onClick={() => applyTextFormat('superscript')}>x²</Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-1 text-xs font-bold" title="Subscript" onClick={() => applyTextFormat('subscript')}>x₂</Button>

              <div className="h-6 w-px bg-border mx-1" />

              {/* Font Color */}
              <input 
                type="color" 
                title="Text Color" 
                className="w-6 h-6 p-0 border-0 cursor-pointer rounded-sm"
                onChange={(e) => applyTextFormat('foreColor', e.target.value)} 
              />
              {/* Highlight Background Color */}
              <input 
                type="color" 
                title="Highlight Color" 
                defaultValue="#ffff00"
                className="w-6 h-6 p-0 border-0 cursor-pointer rounded-sm"
                onChange={(e) => applyTextFormat('hiliteColor', e.target.value)} 
              />

              <div className="h-6 w-px bg-border mx-1" />

              {/* Clear format */}
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold text-red-500" title="Clear Formatting" onClick={() => applyTextFormat('removeFormat')}>Clear</Button>

              {/* Undo/Redo */}
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Undo (Ctrl+Z)" onClick={handleUndo}><Undo className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Redo (Ctrl+Y)" onClick={handleRedo}><Redo className="h-4 w-4" /></Button>
            </CardContent>

            <CardContent className="p-3 flex flex-wrap gap-2 items-center bg-white dark:bg-zinc-950">
              <span className="text-[10px] font-black text-text-muted uppercase">Quick Blocks:</span>
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

          {/* QUESTIONS LIST WRAPPER */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-1.5">
                Questions List ({questions.length})
              </h3>
              
              {/* Dynamic Marks Counter & Live Validation */}
              <div className="flex items-center gap-2 text-xs">
                {parseFloat(maxMarks) > 0 && (
                  <>
                    {totalMarks === parseFloat(maxMarks) ? (
                      <span className="px-2.5 py-1 bg-green-100 text-green-800 border border-green-200 font-bold rounded-full">
                        Perfect: {totalMarks} / {maxMarks} Marks
                      </span>
                    ) : totalMarks > parseFloat(maxMarks) ? (
                      <span className="px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 font-bold rounded-full animate-pulse">
                        Exceeded: {totalMarks} / {maxMarks} Marks (Reduce {totalMarks - parseFloat(maxMarks)})
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-full">
                        Pending: {totalMarks} / {maxMarks} Marks (Remaining: {parseFloat(maxMarks) - totalMarks})
                      </span>
                    )}
                  </>
                )}
              </div>
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
                  if (q.type === 'section' || q.type === 'heading') {
                    questionCounter = 0;
                  } else if (!isStructural) {
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
                          {isStructural ? (
                            <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
                              {q.type === 'section' ? 'Section' : q.type === 'heading' ? 'Heading' : 'Instruction'}
                            </span>
                          ) : (
                            <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-black">
                              Q {qNumber}
                            </span>
                          )}
                          {!isStructural && (
                            <span className="text-[10px] font-black uppercase text-text-muted">
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
                            <label className="text-[10px] font-black text-text-secondary uppercase">Section Divider Title</label>
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
                            <label className="text-[10px] font-black text-text-secondary uppercase">Heading Title</label>
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
                          <label className="text-[10px] font-black text-text-secondary uppercase">Group Instructions</label>
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
                          {/* Question Text Editor (ContentEditable) */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                              <label className="text-[10px] font-black text-text-secondary uppercase">Question Text</label>
                              <div className="flex gap-1.5 items-center flex-wrap">
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold" onClick={() => triggerImageUpload(q.id)}>+ Image</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold" onClick={() => handleOpenTableDialog(q.id)}>+ Table</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold" onClick={() => handleOpenEquationDialog(q.id)}>+ Math</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold" onClick={() => handleOpenDrawingDialog(q.id)}>+ Drawing</Button>
                                <div className="h-4 w-px bg-border mx-1" />
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/5" title="Insert answer box for students to fill in" onClick={() => insertAnswerSpace(q.id, 'box')}>+ Answer Box [ ]</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/5" title="Insert answer circle for students to circle" onClick={() => insertAnswerSpace(q.id, 'circle')}>+ Circle ( )</Button>
                                <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/5" title="Insert write-in line space" onClick={() => insertAnswerSpace(q.id, 'line')}>+ Line ___</Button>
                              </div>
                            </div>
                            <div 
                              contentEditable
                              dangerouslySetInnerHTML={{ __html: q.text }}
                              onBlur={(e) => {
                                updateQuestionText(q.id, e.target.innerHTML);
                                recordHistory(questions);
                              }}
                              className="border border-border rounded-md p-3 min-h-[70px] bg-background text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                              placeholder="Type question content..."
                            />
                          </div>

                          {/* Attached Table Editor */}
                          {q.table && (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-border rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-text-secondary">Question Table Grid ({q.table.rows}x{q.table.cols})</span>
                                <Button type="button" size="sm" variant="ghost" className="h-5 text-red-500 text-[10px]" onClick={() => removeTable(q.id)}>Remove Table</Button>
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
                                <span className="text-[10px] font-black uppercase text-text-secondary">Vector Drawing Embedded</span>
                                <div className="flex gap-2">
                                  <Button type="button" size="sm" variant="ghost" className="h-5 text-primary text-[10px]" onClick={() => handleOpenDrawingDialog(q.id)}>Edit Drawing</Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-5 text-red-500 text-[10px]" onClick={() => removeDrawing(q.id)}>Remove</Button>
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
                                <span className="text-[10px] font-black uppercase text-text-secondary">Image Attachment</span>
                                <Button type="button" size="sm" variant="ghost" className="h-5 text-red-500 text-[10px]" onClick={() => removeQuestionImage(q.id)}>Remove Image</Button>
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
                                    <span className="text-[10px] font-bold text-text-secondary">Size: {q.image.width}%</span>
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
                                      className="h-7 text-[10px] font-bold py-0"
                                      onClick={() => updateQuestionImage(q.id, 'rotate', (q.image.rotate + 90) % 360)}
                                    >
                                      <RotateCw className="h-3 w-3 mr-1" /> Rotate 90°
                                    </Button>
                                    {/* Alignment selectors */}
                                    <select
                                      value={q.image.align}
                                      onChange={(e) => updateQuestionImage(q.id, 'align', e.target.value)}
                                      className="h-7 px-2 border border-border bg-background rounded text-[10px]"
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
                              <label className="text-[10px] font-black text-text-secondary uppercase">Multiple Choice Options</label>
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
                                <label className="text-[10px] font-black text-text-secondary uppercase">Column A & Column B Configuration</label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  className="h-6 text-[10px] font-bold"
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
                                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[10px] font-bold text-text-muted">
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
                              <label className="text-[10px] font-black text-text-secondary uppercase">Sub-Questions / Parts</label>
                              <Button 
                                type="button" 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 text-[10px] font-bold text-primary"
                                onClick={() => insertSubQuestion(q.id)}
                              >
                                + Add Sub-Question
                              </Button>
                            </div>
                            
                            {q.subQuestions && q.subQuestions.length > 0 && (
                              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                                {q.subQuestions.map((sq, sqIdx) => (
                                  <div key={sq.id} className="flex gap-2 items-start bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-border">
                                    <span className="text-xs font-bold text-primary mt-2">
                                      {String.fromCharCode(97 + sqIdx)})
                                    </span>
                                    <div className="flex-1 space-y-1.5">
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
                              <label className="text-[10px] font-black text-text-secondary uppercase">Allocated Marks for Q {qNumber}</label>
                              <Input 
                                type="number"
                                value={q.marks}
                                onChange={(e) => updateQuestionMarks(q.id, e.target.value)}
                                className="w-20 h-8 font-black"
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
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-text-primary flex items-center gap-1.5">
              <Eye className="h-5 w-5 text-primary" /> Live Print Preview (A4 Dimensions)
            </h3>
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
              className="p-14 space-y-2 bg-white min-h-[1012px] shadow-sm"
              style={{
                width: '720px',
                zoom: zoomFactor,
                transformOrigin: 'top center',
                margin: '0 auto',
                boxSizing: 'border-box'
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
                <h1 className="text-xl font-extrabold uppercase tracking-wide m-0 p-0">{schoolProfile.name}</h1>
                <h2 className="text-sm font-bold tracking-tight uppercase m-0 p-0">
                  {paperTitle || 'Terminal Examination'}
                </h2>
                
                {/* Meta details list */}
                <div className="flex justify-between text-xs font-bold pt-1 font-sans">
                  <div>Class: {activeClassName}</div>
                  <div>Subject: {activeSubjectName}</div>
                  <div>Time: {duration}</div>
                </div>
              </div>

              {/* INSTRUCTIONS BOX */}
              {instructions && (
                <div className="border border-black/45 p-3 rounded-sm space-y-1.5">
                  <h4 className="text-xs font-extrabold uppercase pb-0.5">General Instructions:</h4>
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
                    if (q.type === 'section' || q.type === 'heading') {
                      questionCounter = 0;
                    } else if (!isStructural) {
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
                          className={`w-full py-1 my-2 font-extrabold text-sm uppercase tracking-wide border-black ${alignClass} ${borderClass} q-block q-block-section`}
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
                          className="w-full text-xs italic font-semibold font-sans my-1 pl-6 text-zinc-700 q-block leading-relaxed"
                        >
                          {q.text}
                        </div>
                      );
                    }

                    return (
                      <div key={q.id} className="space-y-1.5 q-block">
                        <div className="flex justify-between items-start leading-relaxed">
                          <div className="flex-1 flex gap-2">
                            <span className="font-extrabold text-sm font-sans">Q {qNum}.</span>
                            <div className="flex-1">
                              <span 
                                dangerouslySetInnerHTML={{ __html: formatPreviewText(q.text) }} 
                                className="font-serif leading-relaxed text-sm block animate-fade-in"
                              />
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

              {/* FOOTER SECTION: PAGE NUMBER / PRINT DETAILS */}
              <div className="pt-4 mt-6 flex justify-end items-center text-[10px] font-sans text-text-secondary font-bold">
                <span>Page 1 of 1</span>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* MODAL 1: LOAD TEMPLATE */}
      <Dialog open={isTemplateOpen} onClose={() => setIsTemplateOpen(false)}>
        <div className="p-6 space-y-4 max-w-md bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-black flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" /> Load Examination Template</h2>
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
                <span className="font-black text-text-primary">{PAPER_TEMPLATES[key].name}</span>
                <span className="text-[10px] text-text-muted">Marks: {PAPER_TEMPLATES[key].maxMarks} | {PAPER_TEMPLATES[key].duration}</span>
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
      <Dialog open={isHistoryOpen} onClose={() => setIsHistoryOpen(false)}>
        <div className="p-6 space-y-4 max-w-md bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-black flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Version History / Revisions</h2>
          <p className="text-xs text-text-secondary">Select a previous auto-saved version to restore the editor state:</p>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 pt-1">
            {revisions.length === 0 ? (
              <div className="text-center text-xs text-text-muted py-6">No saved revisions found.</div>
            ) : (
              revisions.map((rev) => (
                <div key={rev.id} className="flex justify-between items-center p-2.5 bg-zinc-50 rounded border border-border text-xs hover:bg-zinc-100 transition-all">
                  <div>
                    <div className="font-bold text-text-primary">{rev.title}</div>
                    <div className="text-[10px] text-text-muted">{rev.timestamp} • {rev.questionCount} Questions</div>
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
      <Dialog open={isEquationOpen} onClose={() => setIsEquationOpen(false)}>
        <div className="p-6 space-y-4 max-w-md bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-black flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary" /> Mathematical Equation Editor</h2>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-text-secondary uppercase">Equation Type</label>
              <select 
                value={equationType}
                onChange={(e) => { setEquationType(e.target.value); setEqPartA(''); setEqPartB(''); setEqPartC(''); }}
                className="w-full h-9 px-2 border border-border bg-background rounded text-xs focus:outline-none"
              >
                <option value="fraction">Fraction (a/b)</option>
                <option value="sqrt">Square Root (√x)</option>
                <option value="cube_root">Cube Root (³√x)</option>
                <option value="integral">Integral (∫)</option>
                <option value="limit">Limits (lim)</option>
                <option value="sigma">Summation (Σ)</option>
                <option value="matrix">Matrix (2x2)</option>
                <option value="greek">Greek Symbol (α, β, θ)</option>
              </select>
            </div>

            {/* Fraction input */}
            {equationType === 'fraction' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold">Numerator</span>
                  <Input value={eqPartA} onChange={(e) => setEqPartA(e.target.value)} placeholder="e.g. x" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Denominator</span>
                  <Input value={eqPartB} onChange={(e) => setEqPartB(e.target.value)} placeholder="e.g. y" className="h-8" />
                </div>
              </div>
            )}

            {/* Root input */}
            {(equationType === 'sqrt' || equationType === 'cube_root') && (
              <div className="space-y-1 text-xs">
                <span className="font-bold">Radicand Expression</span>
                <Input value={eqPartA} onChange={(e) => setEqPartA(e.target.value)} placeholder="e.g. x + 5" className="h-8" />
              </div>
            )}

            {/* Integral input */}
            {equationType === 'integral' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <span className="font-bold">Upper Limit</span>
                  <Input value={eqPartA} onChange={(e) => setEqPartA(e.target.value)} placeholder="b" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Lower Limit</span>
                  <Input value={eqPartB} onChange={(e) => setEqPartB(e.target.value)} placeholder="a" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Expression</span>
                  <Input value={eqPartC} onChange={(e) => setEqPartC(e.target.value)} placeholder="f(x)dx" className="h-8" />
                </div>
              </div>
            )}

            {/* Limit Input */}
            {equationType === 'limit' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <span className="font-bold">Variable</span>
                  <Input value={eqPartA} onChange={(e) => setEqPartA(e.target.value)} placeholder="x" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Approaches</span>
                  <Input value={eqPartB} onChange={(e) => setEqPartB(e.target.value)} placeholder="0" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Expression</span>
                  <Input value={eqPartC} onChange={(e) => setEqPartC(e.target.value)} placeholder="sin(x)/x" className="h-8" />
                </div>
              </div>
            )}

            {/* Matrix Input */}
            {equationType === 'matrix' && (
              <div className="grid grid-cols-4 gap-1.5 text-xs text-center font-mono">
                <Input value={eqPartA} onChange={(e) => setEqPartA(e.target.value)} placeholder="a1" className="h-8 text-center" />
                <Input value={eqPartB} onChange={(e) => setEqPartB(e.target.value)} placeholder="a2" className="h-8 text-center" />
                <Input value={eqPartC} onChange={(e) => setEqPartC(e.target.value)} placeholder="b1" className="h-8 text-center" />
                <Input placeholder="b2" className="h-8 text-center" disabled />
              </div>
            )}

            {/* Summation input */}
            {equationType === 'sigma' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="space-y-1">
                  <span className="font-bold">Upper Limit</span>
                  <Input value={eqPartA} onChange={(e) => setEqPartA(e.target.value)} placeholder="n" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Lower Limit</span>
                  <Input value={eqPartB} onChange={(e) => setEqPartB(e.target.value)} placeholder="i=1" className="h-8" />
                </div>
                <div className="space-y-1">
                  <span className="font-bold">Expression</span>
                  <Input value={eqPartC} onChange={(e) => setEqPartC(e.target.value)} placeholder="i²" className="h-8" />
                </div>
              </div>
            )}

            {/* Greek select */}
            {equationType === 'greek' && (
              <div className="space-y-1 text-xs">
                <span className="font-bold">Select Symbol</span>
                <select 
                  value={eqPartA} 
                  onChange={(e) => setEqPartA(e.target.value)}
                  className="w-full h-8 px-2 border border-border bg-background rounded"
                >
                  <option value="">-- Choose --</option>
                  <option value="&alpha;">&alpha; (Alpha)</option>
                  <option value="&beta;">&beta; (Beta)</option>
                  <option value="&gamma;">&gamma; (Gamma)</option>
                  <option value="&delta;">&delta; (Delta)</option>
                  <option value="&theta;">&theta; (Theta)</option>
                  <option value="&pi;">&pi; (Pi)</option>
                  <option value="&sigma;">&sigma; (Sigma)</option>
                  <option value="&omega;">&omega; (Omega)</option>
                  <option value="&mu;">&mu; (Mu)</option>
                  <option value="&lambda;">&lambda; (Lambda)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEquationOpen(false)}>Cancel</Button>
            <Button type="button" variant="default" size="sm" onClick={insertEquation} className="bg-primary text-white">Insert Formula</Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 4: TABLE DIALOG */}
      <Dialog open={isTableOpen} onClose={() => setIsTableOpen(false)}>
        <div className="p-6 space-y-4 max-w-sm bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-black flex items-center gap-2"><Grid className="h-5 w-5 text-primary" /> Insert Custom Table</h2>
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
      <Dialog open={isDrawingOpen} onClose={() => setIsDrawingOpen(false)}>
        <div className="p-6 space-y-4 max-w-4xl w-full bg-card rounded-xl border border-border shadow-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h2 className="text-base font-black flex items-center gap-2">
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
              <span className="text-[10px] font-black uppercase text-text-muted">Shape Attributes</span>
              
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
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px]" onClick={bringShapeForward}>Bring Front</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px]" onClick={sendShapeBackward}>Send Back</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px]" onClick={() => rotateSelectedShape(15)}>Rotate 15°</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px]" onClick={duplicateSelectedShape}>Duplicate</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px]" onClick={() => resizeSelectedShape(10, 10)}>Size +</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px]" onClick={() => resizeSelectedShape(-10, -10)}>Size -</Button>
                <Button type="button" variant="outline" size="sm" className="h-8 font-bold text-[10px] text-red-500 bg-red-50 hover:bg-red-100 col-span-2" onClick={deleteSelectedShape}>Delete Selected</Button>
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
      <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)}>
        <div className="p-6 space-y-4 max-w-sm bg-card rounded-lg border border-border shadow-xl">
          <h2 className="text-base font-black flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Document Statistics & Search</h2>
          
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
