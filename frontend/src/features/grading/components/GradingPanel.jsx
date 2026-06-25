import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X, 
  Edit, 
  Trash2, 
  Sliders, 
  Calendar, 
  AlertTriangle, 
  Check, 
  RefreshCw, 
  SlidersHorizontal,
  Printer,
  ChevronDown,
  ChevronUp,
  Sliders as SlidersIcon,
  CheckCircle2,
  FileText
} from 'lucide-react';

export default function GradingPanel({
  token,
  schoolId,
  activeYearId,
  classes = [],
  students = [],
  isConnected,
  showToast,
  isCurrentYearActive,
  role,
  examsList = [],
  isFetchingExams = false,
  saveExam,
  deleteExam,
  updateExam,
  fetchExams,
  gradingScales = [],
  saveGradingScales,
  fetchGradingScales,
  schoolSignatures = { teacher_signature: null, class_teacher_signature: null, principal_signature: null },
  saveSchoolSignatures,
  fetchSchoolSignatures,
  initialSubSubTab
}) {
  const [examsSubSubTab, setExamsSubSubTab] = useState(initialSubSubTab || 'management'); // 'management' | 'marks' | 'report_cards'
  
  useEffect(() => {
    if (initialSubSubTab) {
      setExamsSubSubTab(initialSubSubTab);
    }
  }, [initialSubSubTab]);
  
  // Marks entry state
  const [marksSelectedClassId, setMarksSelectedClassId] = useState('');
  const [marksSelectedExamId, setMarksSelectedExamId] = useState('');
  const [marksSelectedSubject, setMarksSelectedSubject] = useState('');
  const [examMarks, setExamMarks] = useState([]); // Array of { student_id, marks_obtained, is_absent }
  const [examRemarks, setExamRemarks] = useState([]); // Array of { student_id, remarks }
  const [isFetchingMarks, setIsFetchingMarks] = useState(false);
  const [isSavingMarks, setIsSavingMarks] = useState(false);

  // Modal / Add Exam state
  const [showExamFormModal, setShowExamFormModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [examForm, setExamForm] = useState({
    name: '',
    class_id: '',
    description: '',
    status: 'Draft',
    start_date: '',
    end_date: '',
    subjects: [{ subject_name: '', max_marks: 100, exam_date: '', start_time: '', end_time: '', instructions: '' }]
  });

  // Settings state
  const [showSignatureSettings, setShowSignatureSettings] = useState(false);
  const [localSignatures, setLocalSignatures] = useState({ teacher_signature: null, class_teacher_signature: null, principal_signature: null });
  const [localScales, setLocalScales] = useState([]);

  // Report card states
  const [reportCardClassId, setReportCardClassId] = useState('');
  const [reportCardGroupName, setReportCardGroupName] = useState('all');
  const [selectedStudentSummary, setSelectedStudentSummary] = useState(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);
  const [showReportCardModal, setShowReportCardModal] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  const getClassName = (cid) => {
    const match = classes.find(c => parseInt(c.id) === parseInt(cid));
    return match ? match.name : `Class ${cid}`;
  };

  useEffect(() => {
    if (classes.length > 0 && !marksSelectedClassId) {
      setMarksSelectedClassId(classes[0].id.toString());
    }
    if (classes.length > 0 && !reportCardClassId) {
      setReportCardClassId(classes[0].id.toString());
    }
  }, [classes]);

  useEffect(() => {
    if (activeYearId) {
      fetchExams(activeYearId);
    }
  }, [activeYearId]);

  // Load marks and remarks when filters change
  useEffect(() => {
    if (marksSelectedExamId && marksSelectedSubject && marksSelectedClassId) {
      fetchMarksAndRemarks();
    }
  }, [marksSelectedExamId, marksSelectedSubject, marksSelectedClassId]);

  const fetchMarksAndRemarks = async () => {
    setIsFetchingMarks(true);
    const keySuffix = schoolId || 'default';
    
    // Find active exam subjects for max marks reference
    const exam = examsList.find(e => e.id.toString() === marksSelectedExamId.toString());
    const subjectConfig = exam?.subjects?.find(s => s.subject_name === marksSelectedSubject);
    const maxMarks = subjectConfig ? parseInt(subjectConfig.max_marks) : 100;

    const classStudents = students.filter(s => parseInt(s.class_id) === parseInt(marksSelectedClassId) && s.status === 'Active');

    if (token.includes('mock') || !isConnected) {
      // Sandbox mode
      const storedMarks = JSON.parse(localStorage.getItem(`bn_sandbox_marks_${keySuffix}_${activeYearId}`) || '[]');
      const storedRemarks = JSON.parse(localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`) || '[]');

      const loadedMarks = classStudents.map(student => {
        const match = storedMarks.find(m => m.exam_id.toString() === marksSelectedExamId.toString() && m.student_id.toString() === student.id.toString() && m.subject_name === marksSelectedSubject);
        return {
          student_id: student.id,
          student_name: student.name,
          roll_number: student.roll_number,
          marks_obtained: match ? match.marks_obtained : '',
          is_absent: match ? !!match.is_absent : false,
          max_marks: maxMarks
        };
      });

      const loadedRemarks = classStudents.map(student => {
        const match = storedRemarks.find(r => r.exam_id.toString() === marksSelectedExamId.toString() && r.student_id.toString() === student.id.toString());
        return {
          student_id: student.id,
          remarks: match ? match.remarks : ''
        };
      });

      setExamMarks(loadedMarks);
      setExamRemarks(loadedRemarks);
      setIsFetchingMarks(false);
      return;
    }

    try {
      // Fetch live database marks
      const marksRes = await fetch(`/api/exams/${marksSelectedExamId}/marks`, { headers: getHeaders() });
      const remarksRes = await fetch(`/api/exams/${marksSelectedExamId}/remarks`, { headers: getHeaders() });

      if (marksRes.ok && remarksRes.ok) {
        const marksData = await marksRes.json();
        const remarksData = await remarksRes.json();

        const loadedMarks = classStudents.map(student => {
          const match = marksData.find(m => m.student_id === student.id && m.subject_name === marksSelectedSubject);
          return {
            student_id: student.id,
            student_name: student.name,
            roll_number: student.roll_number,
            marks_obtained: match ? match.marks_obtained : '',
            is_absent: match ? !!match.is_absent : false,
            max_marks: maxMarks
          };
        });

        const loadedRemarks = classStudents.map(student => {
          const match = remarksData.find(r => r.student_id === student.id);
          return {
            student_id: student.id,
            remarks: match ? match.remarks : ''
          };
        });

        setExamMarks(loadedMarks);
        setExamRemarks(loadedRemarks);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch marks configuration.", "error");
    } finally {
      setIsFetchingMarks(false);
    }
  };

  const handleSaveMarks = async () => {
    setIsSavingMarks(true);
    const keySuffix = schoolId || 'default';

    // Validate marks
    for (let m of examMarks) {
      if (!m.is_absent && m.marks_obtained !== '') {
        const val = parseFloat(m.marks_obtained);
        if (isNaN(val) || val < 0 || val > m.max_marks) {
          showToast(`Marks obtained must be between 0 and max marks (${m.max_marks})`, "error");
          setIsSavingMarks(false);
          return;
        }
      }
    }

    const payloadMarks = examMarks.map(m => ({
      student_id: m.student_id,
      subject_name: marksSelectedSubject,
      marks_obtained: m.is_absent ? 0 : (m.marks_obtained === '' ? 0 : parseFloat(m.marks_obtained)),
      is_absent: m.is_absent ? 1 : 0
    }));

    const payloadRemarks = examRemarks.filter(r => r.remarks.trim() !== '').map(r => ({
      student_id: r.student_id,
      remarks: r.remarks.trim()
    }));

    if (token.includes('mock') || !isConnected) {
      // Sandbox Save
      const storedMarks = JSON.parse(localStorage.getItem(`bn_sandbox_marks_${keySuffix}_${activeYearId}`) || '[]');
      const filteredMarks = storedMarks.filter(m => !(m.exam_id.toString() === marksSelectedExamId.toString() && m.subject_name === marksSelectedSubject));
      
      payloadMarks.forEach(pm => {
        filteredMarks.push({
          exam_id: parseInt(marksSelectedExamId),
          student_id: pm.student_id,
          subject_name: pm.subject_name,
          marks_obtained: pm.marks_obtained,
          is_absent: pm.is_absent
        });
      });
      localStorage.setItem(`bn_sandbox_marks_${keySuffix}_${activeYearId}`, JSON.stringify(filteredMarks));

      const storedRemarks = JSON.parse(localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`) || '[]');
      const filteredRemarks = storedRemarks.filter(r => r.exam_id.toString() !== marksSelectedExamId.toString());
      payloadRemarks.forEach(pr => {
        filteredRemarks.push({
          exam_id: parseInt(marksSelectedExamId),
          student_id: pr.student_id,
          remarks: pr.remarks
        });
      });
      localStorage.setItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`, JSON.stringify(filteredRemarks));

      showToast("Marks and remarks saved successfully in Sandbox Mode.", "success");
      setIsSavingMarks(false);
      fetchMarksAndRemarks();
      return;
    }

    try {
      const marksRes = await fetch(`/api/exams/${marksSelectedExamId}/marks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ marks: payloadMarks })
      });

      const remarksRes = await fetch(`/api/exams/${marksSelectedExamId}/remarks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remarks: payloadRemarks })
      });

      if (marksRes.ok && remarksRes.ok) {
        showToast("Marks and remarks saved successfully.", "success");
        fetchMarksAndRemarks();
      } else {
        showToast("Failed to save student marks.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error saving marks.", "error");
    } finally {
      setIsSavingMarks(false);
    }
  };

  const handleFetchReportCard = async (studentId) => {
    setIsFetchingSummary(true);
    setSelectedStudentSummary(null);
    const keySuffix = schoolId || 'default';

    if (token.includes('mock') || !isConnected) {
      // Mock performance summary calculations
      setTimeout(() => {
        const student = students.find(s => s.id === studentId);
        if (!student) {
          showToast("Student not found", "error");
          setIsFetchingSummary(false);
          return;
        }

        const storedMarks = JSON.parse(localStorage.getItem(`bn_sandbox_marks_${keySuffix}_${activeYearId}`) || '[]');
        const storedRemarks = JSON.parse(localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`) || '[]');
        
        const exams = examsList.filter(e => e.class_id.toString() === student.class_id.toString());
        const examsData = exams.map(e => {
          const marksMap = {};
          storedMarks.filter(m => m.exam_id === e.id && m.student_id === studentId).forEach(m => {
            marksMap[m.subject_name] = m.marks_obtained;
          });

          const remarkMatch = storedRemarks.find(r => r.exam_id === e.id && r.student_id === studentId);
          
          return {
            id: e.id,
            name: e.name,
            start_date: e.start_date,
            end_date: e.end_date,
            subjects: e.subjects || [],
            marks: marksMap,
            rank: '1',
            remarks: remarkMatch ? remarkMatch.remarks : 'Excellent progress.'
          };
        });

        setSelectedStudentSummary({
          student_id: studentId,
          name: student.name,
          roll_number: student.roll_number,
          class_name: getClassName(student.class_id),
          group_name: student.group_name,
          attendance: {
            present: 21,
            absent: 1,
            leave: 0,
            total: 22,
            percentage: 95.5
          },
          exams: examsData,
          signatures: schoolSignatures,
          grading_scales: gradingScales.length > 0 ? gradingScales : [
            { grade_name: 'A+', min_percentage: 90, max_percentage: 100 },
            { grade_name: 'A', min_percentage: 80, max_percentage: 89.99 },
            { grade_name: 'B', min_percentage: 70, max_percentage: 79.99 },
            { grade_name: 'C', min_percentage: 60, max_percentage: 69.99 },
            { grade_name: 'D', min_percentage: 40, max_percentage: 59.99 },
            { grade_name: 'F', min_percentage: 0, max_percentage: 39.99 }
          ]
        });
        setShowReportCardModal(true);
        setIsFetchingSummary(false);
      }, 300);
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}/performance-summary?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedStudentSummary({
          ...data,
          class_name: getClassName(data.class_id)
        });
        setShowReportCardModal(true);
      } else {
        showToast("Failed to compile performance statistics.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading student report card data.", "error");
    } finally {
      setIsFetchingSummary(false);
    }
  };

  const openSettings = () => {
    setLocalSignatures(schoolSignatures);
    setLocalScales(gradingScales.length > 0 ? gradingScales : [
      { grade_name: 'A+', min_percentage: 90, max_percentage: 100 },
      { grade_name: 'A', min_percentage: 80, max_percentage: 89.99 },
      { grade_name: 'B', min_percentage: 70, max_percentage: 79.99 },
      { grade_name: 'C', min_percentage: 60, max_percentage: 69.99 },
      { grade_name: 'D', min_percentage: 40, max_percentage: 59.99 },
      { grade_name: 'F', min_percentage: 0, max_percentage: 39.99 }
    ]);
    setShowSignatureSettings(true);
  };

  const handleSaveSettings = async () => {
    try {
      await saveSchoolSignatures(localSignatures);
      await saveGradingScales(localScales);
      setShowSignatureSettings(false);
      showToast("Grading system and signatures updated.", "success");
      if (fetchSchoolSignatures) fetchSchoolSignatures();
      if (fetchGradingScales) fetchGradingScales();
    } catch (e) {
      showToast("Error updating settings.", "error");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const calculateGrade = (percentage) => {
    const scales = gradingScales.length > 0 ? gradingScales : [
      { grade_name: 'A+', min_percentage: 90, max_percentage: 100 },
      { grade_name: 'A', min_percentage: 80, max_percentage: 89.99 },
      { grade_name: 'B', min_percentage: 70, max_percentage: 79.99 },
      { grade_name: 'C', min_percentage: 60, max_percentage: 69.99 },
      { grade_name: 'D', min_percentage: 40, max_percentage: 59.99 },
      { grade_name: 'F', min_percentage: 0, max_percentage: 39.99 }
    ];
    
    const pct = parseFloat(percentage);
    if (isNaN(pct)) return 'F';
    const match = scales.find(s => pct >= parseFloat(s.min_percentage) && pct <= parseFloat(s.max_percentage));
    return match ? match.grade_name : 'F';
  };

  // Filter exams by selected class
  const classExams = examsList.filter(e => e.class_id.toString() === marksSelectedClassId.toString());
  
  // Find subjects for selected exam
  const selectedExamObj = classExams.find(e => e.id.toString() === marksSelectedExamId.toString());
  const examSubjects = selectedExamObj?.subjects || [];

  const classStudentsForReports = students.filter(s => s.class_id.toString() === reportCardClassId.toString() && s.status === 'Active');
  const filteredStudentsForReports = classStudentsForReports.filter(s => reportCardGroupName === 'all' || s.group_name === reportCardGroupName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub-tabs header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setExamsSubSubTab('management')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: examsSubSubTab === 'management' ? '2px solid var(--color-primary)' : 'none',
              color: examsSubSubTab === 'management' ? 'var(--color-primary)' : 'var(--text-secondary)',
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Exam Management
          </button>
          <button
            type="button"
            onClick={() => {
              setExamsSubSubTab('marks');
              setMarksSelectedExamId('');
              setMarksSelectedSubject('');
              setExamMarks([]);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: examsSubSubTab === 'marks' ? '2px solid var(--color-primary)' : 'none',
              color: examsSubSubTab === 'marks' ? 'var(--color-primary)' : 'var(--text-secondary)',
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Enter Marks
          </button>
          <button
            type="button"
            onClick={() => setExamsSubSubTab('report_cards')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: examsSubSubTab === 'report_cards' ? '2px solid var(--color-primary)' : 'none',
              color: examsSubSubTab === 'report_cards' ? 'var(--color-primary)' : 'var(--text-secondary)',
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Report Cards
          </button>
        </div>

        {role === 'School Admin' && (
          <button
            type="button"
            onClick={openSettings}
            className="btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
          >
            <SlidersIcon size={14} /> Signature & Grading Settings
          </button>
        )}
      </div>

      {/* 1. Exam Configuration / Management view */}
      {examsSubSubTab === 'management' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Examinations Listing</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure exam subjects, max marks, and dates.</p>
            </div>
            {isCurrentYearActive() && (
              <button
                type="button"
                onClick={() => {
                  setEditingExamId(null);
                  setExamForm({
                    name: '',
                    class_id: classes[0]?.id?.toString() || '',
                    description: '',
                    status: 'Draft',
                    start_date: '',
                    end_date: '',
                    subjects: [{ subject_name: '', max_marks: 100, exam_date: '', start_time: '', end_time: '', instructions: '' }]
                  });
                  setShowExamFormModal(true);
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Create Exam
              </button>
            )}
          </div>

          {isFetchingExams ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={24} style={{ marginRight: '8px' }} /> Loading examinations...
            </div>
          ) : examsList.length === 0 ? (
            <div className="sp-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No examinations configured yet.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {examsList.map(exam => (
                <div key={exam.id} className="sp-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', marginBottom: '4px', display: 'inline-block' }}>
                        {getClassName(exam.class_id)}
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{exam.name}</h4>
                    </div>
                    <span className={`badge ${exam.status === 'Published' ? 'badge-success' : 'badge-warning'}`}>
                      {exam.status}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {exam.description || 'No description provided.'}
                  </p>

                  <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <strong>Subjects Configured:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {exam.subjects?.map((s, idx) => (
                        <span key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {s.subject_name} ({s.max_marks}m)
                        </span>
                      ))}
                    </div>
                  </div>

                  {isCurrentYearActive() && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingExamId(exam.id);
                          setExamForm({
                            name: exam.name,
                            class_id: exam.class_id.toString(),
                            description: exam.description || '',
                            status: exam.status,
                            start_date: exam.start_date || '',
                            end_date: exam.end_date || '',
                            subjects: exam.subjects && exam.subjects.length > 0 ? exam.subjects : [{ subject_name: '', max_marks: 100, exam_date: '', start_time: '', end_time: '', instructions: '' }]
                          });
                          setShowExamFormModal(true);
                        }}
                        className="btn-outline"
                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete the exam "${exam.name}"? This will delete all student marks entered for this exam.`)) {
                            deleteExam(exam.id, activeYearId);
                          }
                        }}
                        className="btn-outline"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Enter Marks view */}
      {examsSubSubTab === 'marks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="sp-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '16px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Class</label>
              <select
                value={marksSelectedClassId}
                onChange={(e) => {
                  setMarksSelectedClassId(e.target.value);
                  setMarksSelectedExamId('');
                  setMarksSelectedSubject('');
                  setExamMarks([]);
                }}
                className="sp-input"
                style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
              >
                <option value="">Select Class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Examination</label>
              <select
                value={marksSelectedExamId}
                onChange={(e) => {
                  setMarksSelectedExamId(e.target.value);
                  setMarksSelectedSubject('');
                  setExamMarks([]);
                }}
                className="sp-input"
                style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
                disabled={!marksSelectedClassId}
              >
                <option value="">Select Exam...</option>
                {classExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Subject</label>
              <select
                value={marksSelectedSubject}
                onChange={(e) => setMarksSelectedSubject(e.target.value)}
                className="sp-input"
                style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
                disabled={!marksSelectedExamId}
              >
                <option value="">Select Subject...</option>
                {examSubjects.map(s => <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>)}
              </select>
            </div>
          </div>

          {!marksSelectedSubject ? (
            <div className="sp-card" style={{ padding: '32px', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
              Please select class, examination, and subject to entry marks.
            </div>
          ) : isFetchingMarks ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={24} style={{ marginRight: '8px' }} /> Loading student marks list...
            </div>
          ) : examMarks.length === 0 ? (
            <div className="sp-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No active students enrolled in this class.
            </div>
          ) : (
            <div className="sp-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Roll No</th>
                      <th>Student Name</th>
                      <th style={{ width: '150px' }}>Marks Obtained</th>
                      <th style={{ width: '120px' }}>Absent</th>
                      <th>Remarks / Remarks for Report Card</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examMarks.map((m, index) => {
                      const remarkObj = examRemarks.find(r => r.student_id === m.student_id);
                      const currentRemark = remarkObj ? remarkObj.remarks : '';
                      
                      return (
                        <tr key={m.student_id}>
                          <td>{m.roll_number || '-'}</td>
                          <td style={{ fontWeight: 600 }}>{m.student_name}</td>
                          <td>
                            <input
                              type="number"
                              disabled={m.is_absent || !isCurrentYearActive()}
                              placeholder={`Max: ${m.max_marks}`}
                              value={m.marks_obtained}
                              onChange={(e) => {
                                const updated = [...examMarks];
                                updated[index].marks_obtained = e.target.value;
                                setExamMarks(updated);
                              }}
                              className="sp-input"
                              style={{ width: '100%', padding: '6px 12px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              disabled={!isCurrentYearActive()}
                              checked={m.is_absent}
                              onChange={(e) => {
                                const updated = [...examMarks];
                                updated[index].is_absent = e.target.checked;
                                if (e.target.checked) {
                                  updated[index].marks_obtained = '0';
                                }
                                setExamMarks(updated);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              disabled={!isCurrentYearActive()}
                              placeholder="e.g. Excellent progress, Needs improvement"
                              value={currentRemark}
                              onChange={(e) => {
                                const val = e.target.value;
                                setExamRemarks(prev => {
                                  const idx = prev.findIndex(r => r.student_id === m.student_id);
                                  if (idx !== -1) {
                                    const c = [...prev];
                                    c[idx].remarks = val;
                                    return c;
                                  } else {
                                    return [...prev, { student_id: m.student_id, remarks: val }];
                                  }
                                });
                              }}
                              className="sp-input"
                              style={{ width: '100%', padding: '6px 12px' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {isCurrentYearActive() && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    onClick={handleSaveMarks}
                    className="btn-primary"
                    disabled={isSavingMarks}
                    style={{ padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {isSavingMarks ? <RefreshCw className="spin" size={16} /> : null}
                    Save Marks & Remarks
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Report Cards List view */}
      {examsSubSubTab === 'report_cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="sp-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '16px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Class</label>
              <select
                value={reportCardClassId}
                onChange={(e) => {
                  setReportCardClassId(e.target.value);
                  setSelectedStudentSummary(null);
                }}
                className="sp-input"
                style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
              >
                <option value="">Select Class...</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Section</label>
              <select
                value={reportCardGroupName}
                onChange={(e) => setReportCardGroupName(e.target.value)}
                className="sp-input"
                style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
              >
                <option value="all">All Sections</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {!reportCardClassId ? (
            <div className="sp-card" style={{ padding: '32px', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
              Please select a class to load report cards.
            </div>
          ) : filteredStudentsForReports.length === 0 ? (
            <div className="sp-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No active students enrolled in this section.
            </div>
          ) : (
            <div className="sp-card" style={{ padding: '16px' }}>
              <div className="sp-table-container">
                <table className="sp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Roll No</th>
                      <th>Student Name</th>
                      <th>Section</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudentsForReports.map(student => (
                      <tr key={student.id}>
                        <td>{student.roll_number || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{student.name}</td>
                        <td>{student.group_name || 'all'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleFetchReportCard(student.id)}
                            className="btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            disabled={isFetchingSummary}
                          >
                            <FileText size={14} /> Compile Report Card
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SIGNATURE & GRADING SYSTEM SETTINGS MODAL */}
      {showSignatureSettings && (
        <div className="modal-overlay" onClick={() => setShowSignatureSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Report Card & Grading System Configuration</h3>
              <button onClick={() => setShowSignatureSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Signatures Section */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700 }}>1. Report Card Authority Signatures</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['teacher_signature', 'class_teacher_signature', 'principal_signature'].map((type) => {
                    const label = type === 'teacher_signature' ? 'Class Teacher' : type === 'class_teacher_signature' ? 'Academic Head' : 'Principal';
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label} Signature</label>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id={`file-${type}`}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setLocalSignatures(prev => ({ ...prev, [type]: reader.result }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => document.getElementById(`file-${type}`).click()}
                              className="btn-outline"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              Upload Image
                            </button>
                            {localSignatures[type] && (
                              <button
                                type="button"
                                onClick={() => setLocalSignatures(prev => ({ ...prev, [type]: null }))}
                                className="btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {localSignatures[type] ? (
                          <img
                            src={localSignatures[type]}
                            alt="Signature Preview"
                            style={{ height: '45px', maxWidth: '120px', objectFit: 'contain', background: '#ffffff', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          />
                        ) : (
                          <div style={{ height: '45px', width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            No Signature
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grading Scales Section */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700 }}>2. Grading Boundaries & Scale Configuration</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {localScales.map((scale, sIdx) => (
                    <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', width: '30px' }}>{scale.grade_name}</span>
                        <input
                          type="text"
                          value={scale.grade_name}
                          onChange={(e) => {
                            const updated = [...localScales];
                            updated[sIdx].grade_name = e.target.value;
                            setLocalScales(updated);
                          }}
                          className="sp-input"
                          style={{ padding: '6px 12px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min %"
                          value={scale.min_percentage}
                          onChange={(e) => {
                            const updated = [...localScales];
                            updated[sIdx].min_percentage = e.target.value;
                            setLocalScales(updated);
                          }}
                          className="sp-input"
                          style={{ padding: '6px 12px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Max %"
                          value={scale.max_percentage}
                          onChange={(e) => {
                            const updated = [...localScales];
                            updated[sIdx].max_percentage = e.target.value;
                            setLocalScales(updated);
                          }}
                          className="sp-input"
                          style={{ padding: '6px 12px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowSignatureSettings(false)}
                  className="btn-outline"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="btn-primary"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                >
                  Save Changes
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EXAM MODAL */}
      {showExamFormModal && (
        <div className="modal-overlay" onClick={() => setShowExamFormModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingExamId ? 'Edit Examination' : 'Create New Examination'}
              </h3>
              <button onClick={() => setShowExamFormModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const validSubjects = examForm.subjects.filter(s => s.subject_name.trim() !== '');
                if (validSubjects.length === 0) {
                  showToast("Please add at least one subject.", "error");
                  return;
                }
                const payload = {
                  ...examForm,
                  subjects: validSubjects
                };
                if (editingExamId) {
                  updateExam(editingExamId, activeYearId, payload);
                } else {
                  saveExam(activeYearId, payload);
                }
                setShowExamFormModal(false);
              }} 
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Exam Name *</label>
                  <input
                    type="text"
                    className="sp-input"
                    placeholder="e.g. Unit Test 1, Annual Exam"
                    value={examForm.name}
                    onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Applicable Class *</label>
                  <select
                    className="sp-input"
                    value={examForm.class_id}
                    onChange={(e) => setExamForm({ ...examForm, class_id: e.target.value })}
                    required
                    disabled={editingExamId !== null}
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Description (Optional)</label>
                  <input
                    type="text"
                    className="sp-input"
                    placeholder="e.g. Surprise test or mid-term"
                    value={examForm.description}
                    onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Publish Status</label>
                  <select
                    className="sp-input"
                    value={examForm.status}
                    onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
              </div>

              {/* Subject list setup */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>Configure Subjects & Max Marks *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setExamForm({
                        ...examForm,
                        subjects: [...examForm.subjects, { subject_name: '', max_marks: 100, exam_date: '', start_time: '', end_time: '', instructions: '' }]
                      });
                    }}
                    className="btn-outline"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add Subject
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {examForm.subjects.map((sub, sIdx) => (
                    <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="sp-input"
                        placeholder="Subject Name"
                        value={sub.subject_name}
                        onChange={(e) => {
                          const updated = [...examForm.subjects];
                          updated[sIdx].subject_name = e.target.value;
                          setExamForm({ ...examForm, subjects: updated });
                        }}
                        required
                      />
                      <input
                        type="number"
                        className="sp-input"
                        placeholder="Max Marks"
                        min="1"
                        value={sub.max_marks}
                        onChange={(e) => {
                          const updated = [...examForm.subjects];
                          updated[sIdx].max_marks = parseInt(e.target.value) || 100;
                          setExamForm({ ...examForm, subjects: updated });
                        }}
                        required
                      />
                      {examForm.subjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = examForm.subjects.filter((_, idx) => idx !== sIdx);
                            setExamForm({ ...examForm, subjects: updated });
                          }}
                          className="btn-outline"
                          style={{ padding: '8px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px', justifyContent: 'center' }}>Save Examination</button>
            </form>
          </div>
        </div>
      )}

      {/* RENDER ACTUAL REPORT CARD VIEW MODAL */}
      {showReportCardModal && selectedStudentSummary && (
        <div className="modal-overlay" onClick={() => setShowReportCardModal(false)} style={{ zIndex: 100 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', maxHeight: '95vh', overflowY: 'auto', padding: '0', background: 'var(--bg-surface)' }}>
            
            {/* Header bar controls */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Report Card Compiler Preview</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn-primary"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} /> Print / Save PDF
                </button>
                <button 
                  onClick={() => setShowReportCardModal(false)} 
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center' }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Print Sheet Document */}
            <div id="report-card-print-area" style={{ padding: '40px', color: '#1e293b', background: '#ffffff', minHeight: '842px', fontFamily: '"Outfit", sans-serif' }}>
              
              {/* Premium Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px double #0284c7', paddingBottom: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '8px', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '2rem', fontWeight: 'bold' }}>
                    SP
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shiksha Pilot Academy</h2>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'block', marginTop: '2px' }}>Empowering Future Generations | Affiliated to Central Board</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginTop: '2px' }}>New Delhi, India | Contact: support@shikshapilot.com</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '4px 10px', borderRadius: '4px', alignSelf: 'flex-end' }}>Official Progress Report</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginTop: '6px' }}>Academic Term: {activeYearId === 2 ? '2026-2027' : '2025-2026'}</span>
                </div>
              </div>

              {/* Student Metadata Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', fontSize: '0.85rem' }}><span style={{ fontWeight: 600, color: '#475569', width: '120px' }}>Student Name:</span><strong style={{ color: '#0f172a' }}>{selectedStudentSummary.name}</strong></div>
                  <div style={{ display: 'flex', fontSize: '0.85rem' }}><span style={{ fontWeight: 600, color: '#475569', width: '120px' }}>Enrollment Class:</span><span style={{ color: '#334155', fontWeight: 500 }}>{selectedStudentSummary.class_name} {selectedStudentSummary.group_name ? `(${selectedStudentSummary.group_name})` : ''}</span></div>
                  <div style={{ display: 'flex', fontSize: '0.85rem' }}><span style={{ fontWeight: 600, color: '#475569', width: '120px' }}>Roll Number:</span><span style={{ color: '#334155', fontWeight: 500 }}>{selectedStudentSummary.roll_number}</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', fontSize: '0.85rem' }}><span style={{ fontWeight: 600, color: '#475569', width: '150px' }}>Attendance Log:</span><span style={{ color: '#334155', fontWeight: 600 }}>{selectedStudentSummary.attendance?.present} / {selectedStudentSummary.attendance?.total} ({selectedStudentSummary.attendance?.percentage}%)</span></div>
                  <div style={{ display: 'flex', fontSize: '0.85rem' }}><span style={{ fontWeight: 600, color: '#475569', width: '150px' }}>Report Date:</span><span style={{ color: '#334155', fontWeight: 500 }}>{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                  <div style={{ display: 'flex', fontSize: '0.85rem' }}><span style={{ fontWeight: 600, color: '#475569', width: '150px' }}>System Status:</span><span style={{ color: '#16a34a', fontWeight: 700 }}>Pass / Satisfactory</span></div>
                </div>
              </div>

              {/* Term-wise Examinations Results */}
              {selectedStudentSummary.exams?.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', border: '1px dashed #cbd5e1', borderRadius: '8px', marginBottom: '24px' }}>
                  No examination marks entered for this academic session yet.
                </div>
              ) : (
                selectedStudentSummary.exams.map((exam) => {
                  // Calculate totals
                  let totalMax = 0;
                  let totalObtained = 0;
                  
                  exam.subjects?.forEach(sub => {
                    totalMax += parseFloat(sub.max_marks) || 0;
                    totalObtained += parseFloat(exam.marks[sub.subject_name]) || 0;
                  });

                  const pct = totalMax > 0 ? ((totalObtained / totalMax) * 100) : 0;
                  
                  return (
                    <div key={exam.id} style={{ marginBottom: '32px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>{exam.name} Results</h4>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Date Conducted: {exam.start_date} to {exam.end_date}</span>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9' }}>
                            <th style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Subject Name</th>
                            <th style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#475569', width: '100px' }}>Max Marks</th>
                            <th style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#475569', width: '120px' }}>Marks Obtained</th>
                            <th style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#475569', width: '80px' }}>Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exam.subjects?.map((sub, idx) => {
                            const obtained = exam.marks[sub.subject_name];
                            const subPct = sub.max_marks > 0 ? ((obtained / sub.max_marks) * 100) : 0;
                            const grade = obtained !== undefined ? calculateGrade(subPct) : '-';
                            
                            return (
                              <tr key={idx}>
                                <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>{sub.subject_name}</td>
                                <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#475569', textAlign: 'center' }}>{sub.max_marks}</td>
                                <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', fontWeight: 700, textAlign: 'center' }}>{obtained !== undefined ? obtained : '-'}</td>
                                <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0284c7', fontWeight: 800, textAlign: 'center' }}>{grade}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                            <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a' }}>Aggregate Total</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', textAlign: 'center' }}>{totalMax}</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0f172a', textAlign: 'center' }}>{totalObtained}</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#0284c7', textAlign: 'center' }}>{calculateGrade(pct)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Rank, Remarks, Percentage summaries */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr', gap: '16px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                          <span>Overall Percentage: </span><strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{pct.toFixed(2)}%</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                          <span>Remarks: </span><span style={{ color: '#0f172a', fontStyle: 'italic', fontWeight: 500 }}>{exam.remarks || 'Keep up the good effort.'}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#475569', textAlign: 'right' }}>
                          <span>Class Rank: </span><strong style={{ color: '#0284c7', fontSize: '0.85rem' }}>#{exam.rank || '1'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Grading Boundaries Chart */}
              <div style={{ marginTop: '24px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', display: 'block', marginBottom: '8px' }}>Grading Boundaries Reference</span>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {(gradingScales.length > 0 ? gradingScales : [
                    { grade_name: 'A+', min_percentage: 90, max_percentage: 100 },
                    { grade_name: 'A', min_percentage: 80, max_percentage: 89.99 },
                    { grade_name: 'B', min_percentage: 70, max_percentage: 79.99 },
                    { grade_name: 'C', min_percentage: 60, max_percentage: 69.99 },
                    { grade_name: 'D', min_percentage: 40, max_percentage: 59.99 },
                    { grade_name: 'F', min_percentage: 0, max_percentage: 39.99 }
                  ]).map((scale, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', color: '#334155' }}>
                      <strong style={{ color: '#0284c7' }}>{scale.grade_name}</strong>: {scale.min_percentage}% – {scale.max_percentage}%
                    </div>
                  ))}
                </div>
              </div>

              {/* Authority Signatures Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', marginTop: '60px', borderTop: '1px solid #cbd5e1', paddingTop: '32px', textAlign: 'center' }}>
                <div>
                  {selectedStudentSummary.signatures?.teacher_signature ? (
                    <img src={selectedStudentSummary.signatures.teacher_signature} alt="Class Teacher Signature" style={{ height: '35px', objectFit: 'contain', display: 'block', margin: '0 auto 6px auto' }} />
                  ) : (
                    <div style={{ height: '35px' }} />
                  )}
                  <span style={{ borderTop: '1px solid #94a3b8', display: 'block', width: '160px', margin: '0 auto', paddingTop: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Class Teacher</span>
                </div>
                <div>
                  {selectedStudentSummary.signatures?.class_teacher_signature ? (
                    <img src={selectedStudentSummary.signatures.class_teacher_signature} alt="Academic Head Signature" style={{ height: '35px', objectFit: 'contain', display: 'block', margin: '0 auto 6px auto' }} />
                  ) : (
                    <div style={{ height: '35px' }} />
                  )}
                  <span style={{ borderTop: '1px solid #94a3b8', display: 'block', width: '160px', margin: '0 auto', paddingTop: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Academic Head</span>
                </div>
                <div>
                  {selectedStudentSummary.signatures?.principal_signature ? (
                    <img src={selectedStudentSummary.signatures.principal_signature} alt="Principal Signature" style={{ height: '35px', objectFit: 'contain', display: 'block', margin: '0 auto 6px auto' }} />
                  ) : (
                    <div style={{ height: '35px' }} />
                  )}
                  <span style={{ borderTop: '1px solid #94a3b8', display: 'block', width: '160px', margin: '0 auto', paddingTop: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Principal Authority</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
