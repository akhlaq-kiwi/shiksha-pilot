import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, CheckCircle, AlertCircle, Plus, 
  Trash2, Printer, ChevronRight, Check, Building, RefreshCw, Download, RotateCcw
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { Dialog } from '../../../common/ui/dialog';
import html2pdf from 'html2pdf.js';

export default function SeatingPlanPage() {
  const { currentYear } = useAcademicYear();
  const location = useLocation();
  const navigate = useNavigate();

  // State lists
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('config'); // 'config' or 'slips'

  // Selection states (State A: Generation Form)
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [studentsPerBench, setStudentsPerBench] = useState('2');
  const [roomCount, setRoomCount] = useState('1');
  const [roomConfigs, setRoomConfigs] = useState([{ room_name: 'Room 1', bench_count: '' }]);
  const [confirmed, setConfirmed] = useState(false);

  // Preview / Summary State
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // State B: Generated Report State
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('all');

  // Regenerate Confirmation Modal States
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  // Publish Admit Cards States
  const [showPublishAdmitModal, setShowPublishAdmitModal] = useState(false);
  const [submittingPublishAdmit, setSubmittingPublishAdmit] = useState(false);
  const [showUnpublishAdmitModal, setShowUnpublishAdmitModal] = useState(false);
  const [submittingUnpublishAdmit, setSubmittingUnpublishAdmit] = useState(false);
  const [examClassStatuses, setExamClassStatuses] = useState([]);

  // Alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Unified initial data & seating plan loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 1. Fetch initial configuration lists
        const [examsList, classesList, studentsList] = await Promise.all([
          schoolService.getExaminations(),
          schoolAdminService.getClasses(),
          schoolAdminService.getStudents({ status: 'ACTIVE' })
        ]);
        setExams(examsList || []);
        setClasses(classesList || []);
        setStudents(studentsList || []);

        // 2. Pre-select exam and load its seating plan if passed via router state
        const passedExamId = location.state?.examId;
        if (passedExamId) {
          const examIdStr = String(passedExamId);
          setSelectedExamId(examIdStr);

          const [planDetails, statuses] = await Promise.all([
            schoolService.getSeatingPlan(examIdStr),
            schoolService.getExamClassStatuses(examIdStr)
          ]);
          setExamClassStatuses(statuses || []);

          if (planDetails && planDetails.plan) {
            setGeneratedPlan(planDetails);
            // Pre-populate configs by extracting class IDs from actual seating allocations
            const classIdsFromAllocations = planDetails.allocations 
              ? Array.from(new Set(planDetails.allocations.map(a => Number(a.class_id)).filter(Boolean)))
              : [];
            setSelectedClassIds(classIdsFromAllocations);
            setStudentsPerBench(String(planDetails.plan.students_per_bench));
            setRoomConfigs(planDetails.plan.room_configs || []);
            setRoomCount(String(planDetails.plan.room_configs ? planDetails.plan.room_configs.length : 1));
            setSelectedRoomFilter('all');

            // Respect passed view state from navigation
            if (location.state?.view) {
              setCurrentView(location.state.view);
            } else {
              setCurrentView('slips');
            }
          } else {
            setGeneratedPlan(null);
            setPreviewData(null);
            setCurrentView('config');
          }
        } else {
          setCurrentView('config');
        }
      } catch (err) {
        console.error('Failed to load initial configuration data:', err);
        setError('Failed to load initial configuration data.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [location.state]);

  // Handle class selection checkbox toggle
  const handleClassToggle = (classId) => {
    setSelectedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId) 
        : [...prev, classId]
    );
    setPreviewData(null); // Clear preview since classes changed
  };

  // Handle room count change
  const handleRoomCountChange = (val) => {
    setRoomCount(val);
    const count = parseInt(val) || 0;
    setRoomConfigs(prev => {
      const next = [...prev];
      if (count > next.length) {
        // Add more rooms
        for (let i = next.length; i < count; i++) {
          next.push({ room_name: `Room ${i + 1}`, bench_count: '' });
        }
      } else if (count < next.length) {
        // Trim rooms
        return next.slice(0, count);
      }
      return next;
    });
    setPreviewData(null);
  };

  const handleRoomConfigChange = (index, field, value) => {
    setRoomConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setPreviewData(null);
  };

  // Calculate active students in currently selected classes
  const getStudentCountForClass = (classId) => {
    return students.filter(s => s.class_id === classId && s.status === 'ACTIVE').length;
  };

  const totalSelectedStudents = selectedClassIds.reduce(
    (sum, classId) => sum + getStudentCountForClass(classId), 0
  );

  // Ceiling required benches
  const requiredBenches = Math.ceil(totalSelectedStudents / parseInt(studentsPerBench)) || 0;

  const totalEnteredBenches = roomConfigs.reduce(
    (sum, rc) => sum + (parseInt(rc.bench_count) || 0), 0
  );

  const remainingBenches = requiredBenches - totalEnteredBenches;

  // Unique rooms list
  const uniqueRooms = generatedPlan
    ? Array.from(new Set(generatedPlan.allocations.map(a => a.room_name))).sort()
    : [];

  // Filtered allocations based on room filter
  const filteredAllocations = generatedPlan
    ? (selectedRoomFilter === 'all'
        ? generatedPlan.allocations
        : generatedPlan.allocations.filter(a => a.room_name === selectedRoomFilter))
    : [];

  // Helper to chunk cards array for page-wise distribution
  const chunkAllocations = (array, size) => {
    const chunks = [];
    if (!array) return chunks;
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // Trigger Preview Seating Plan
  const handlePreview = async () => {
    setError('');
    setSuccess('');
    if (!selectedExamId) {
      setError('Please select an examination.');
      return;
    }
    if (selectedClassIds.length === 0) {
      setError('Please select at least one class.');
      return;
    }
    const activeRoomConfigs = roomConfigs.filter(rc => rc.bench_count && parseInt(rc.bench_count) > 0);
    if (activeRoomConfigs.length === 0) {
      setError('Please enter a valid bench count for at least one room.');
      return;
    }

    try {
      setPreviewLoading(true);
      const res = await schoolService.previewSeatingPlan(selectedExamId, {
        classes: selectedClassIds,
        students_per_bench: parseInt(studentsPerBench),
        room_configs: activeRoomConfigs.map(rc => ({
          room_name: rc.room_name,
          bench_count: parseInt(rc.bench_count)
        }))
      });
      setPreviewData(res);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to preview seating plan.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Trigger Permanently Generate Seating Plan
  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!confirmed) {
      setError('Please check the confirmation box.');
      return;
    }
    if (!previewData || !previewData.enough_benches) {
      setError('Please verify that you have sufficient benches before generating.');
      return;
    }

    const activeRoomConfigs = roomConfigs.filter(rc => rc.bench_count && parseInt(rc.bench_count) > 0);

    try {
      setPreviewLoading(true);
      await schoolService.generateSeatingPlan(selectedExamId, {
        classes: selectedClassIds,
        students_per_bench: parseInt(studentsPerBench),
        room_configs: activeRoomConfigs.map(rc => ({
          room_name: rc.room_name,
          bench_count: parseInt(rc.bench_count)
        }))
      });
      
      // Update success message & auto hide after 3 seconds
      setSuccess('Seating plan generated successfully.');
      setTimeout(() => {
        setSuccess('');
      }, 3000);
      
      // Refresh plan state
      const planDetails = await schoolService.getSeatingPlan(selectedExamId);
      setGeneratedPlan(planDetails);
      setSelectedRoomFilter('all');
      setCurrentView('slips');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to generate seating plan.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRegenerateConfirm = async () => {
    try {
      setError('');
      setSuccess('');
      setRegenerateLoading(true);
      await schoolService.deleteSeatingPlan(selectedExamId);
      
      setGeneratedPlan(null);
      setPreviewData(null);
      setCurrentView('config');
      setIsRegenerateOpen(false);
      setSuccess('Existing seating plan cleared. You can now configure a new one.');
      
      // Auto clear alert
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to clear the existing seating plan.');
    } finally {
      setRegenerateLoading(false);
    }
  };

  // Print function
  const handlePrint = (printableId, title) => {
    const printStyle = document.createElement('style');
    printStyle.id = 'dynamic-print-style';
    printStyle.innerHTML = `
      @media print {
        body { background: white !important; color: black !important; padding: 0.5cm !important; }
        body * {
          visibility: hidden !important;
        }
        #${printableId}, #${printableId} * {
          visibility: visible !important;
        }
        #${printableId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
        }
        .no-print {
          display: none !important;
        }
        
        .pdf-page {
          page-break-after: always !important;
          break-after: page !important;
          margin-bottom: 40px !important;
        }
        .pdf-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
          margin-bottom: 0px !important;
        }

        /* Seating slips printing grid rules */
        .seating-slip-grid {
          display: grid !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .print-grid-2cols {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 15px !important;
        }
        .print-grid-2cols .slip-wrapper {
          page-break-inside: avoid !important;
        }
        
        .print-grid-3cols {
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 10px !important;
        }
        .print-grid-3cols .slip-wrapper {
          page-break-inside: avoid !important;
        }

        .seating-slip {
          border: 3px solid #000000 !important;
          padding: 14px !important;
          border-radius: 12px !important;
          width: 90mm !important;
          height: 58mm !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          background: white !important;
          color: black !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          overflow: hidden !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }
        .seating-slip * {
          font-family: Arial, Helvetica, sans-serif !important;
        }
      }
    `;
    
    document.head.appendChild(printStyle);
    window.print();
    
    const styleNode = document.getElementById('dynamic-print-style');
    if (styleNode) {
      document.head.removeChild(styleNode);
    }
  };

  const handlePublishAdmitClick = () => {
    setError('');
    setSuccess('');
    if (!generatedPlan || !selectedClassIds || selectedClassIds.length === 0) {
      setError('Generate the seating plan before publishing admit cards.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setShowPublishAdmitModal(true);
  };

  const confirmPublishAdmitCards = async () => {
    setSubmittingPublishAdmit(true);
    setError('');
    setSuccess('');
    try {
      await Promise.all(selectedClassIds.map(classId => 
        schoolService.publishExamAdmitCards(selectedExamId, classId)
      ));
      setSuccess('Admit Cards Published Successfully.');
      setShowPublishAdmitModal(false);

      // Reload class statuses
      const statuses = await schoolService.getExamClassStatuses(selectedExamId);
      setExamClassStatuses(statuses || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish admit cards.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmittingPublishAdmit(false);
    }
  };

  const handleUnpublishAdmitClick = () => {
    setError('');
    setSuccess('');
    setShowUnpublishAdmitModal(true);
  };

  const confirmUnpublishAdmitCards = async () => {
    setSubmittingUnpublishAdmit(true);
    setError('');
    setSuccess('');
    try {
      await Promise.all(selectedClassIds.map(classId => 
        schoolService.unpublishExamAdmitCards(selectedExamId, classId)
      ));
      setSuccess('Admit Cards Reverted to Draft Successfully.');
      setShowUnpublishAdmitModal(false);

      // Reload class statuses
      const statuses = await schoolService.getExamClassStatuses(selectedExamId);
      setExamClassStatuses(statuses || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revert admit cards to draft.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmittingUnpublishAdmit(false);
    }
  };

  // Download PDF function
  const handleDownloadPDF = (elementId, filename) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Ensure scroll position is reset to prevent canvas alignment cuts
    window.scrollTo(0, 0);

    // Wait for all document fonts to load completely before generating the canvas capture
    document.fonts.ready.then(() => {
      const opt = {
        margin:       10,
        filename:     `${filename}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css'] }
      };
      html2pdf().from(element).set(opt).save();
    });
  };

  const getFullPositionName = (pos) => {
    if (pos === 'L') return 'LEFT';
    if (pos === 'M') return 'CENTER';
    if (pos === 'R') return 'RIGHT';
    return pos;
  };

  const getSlipGridClass = () => {
    if (studentsPerBench === '2') {
      return 'grid-cols-2 print-grid-2cols';
    } else if (studentsPerBench === '3') {
      return 'grid-cols-3 print-grid-3cols';
    }
    return 'grid-cols-2 print-grid-2cols';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Configuration...</p>
      </div>
    );
  }

  if (!selectedExamId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 no-print">
          <Button variant="outline" size="sm" onClick={() => navigate('/school-admin/exams')} className="flex items-center gap-1.5 font-bold text-xs">
            <ArrowLeft className="h-4 w-4" /> Go to Examinations
          </Button>
        </div>
        <Card className="border border-dashed border-border py-12 text-center text-text-muted text-sm font-semibold flex flex-col items-center justify-center gap-2 no-print animate-in fade-in duration-300">
          <AlertCircle className="h-10 w-10 text-amber-500 opacity-80" />
          <span>Please select an examination from the Examinations Dashboard first to manage its seating plan.</span>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Examination Seating Plan</h2>
          <p className="text-text-secondary text-sm mt-1">Automatically assign student seating layouts and generate invigilator sheets or cut-out seating slips.</p>
        </div>
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

      {/* STATE A: GENERATION FORM */}
      {currentView === 'config' ? (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 no-print">
          {/* Back Button Panel */}
          <div className="flex justify-between items-center no-print">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/school-admin/exams')}
              className="flex items-center gap-1.5 font-bold text-xs"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Examinations
            </Button>
          </div>

          {/* Step 1 Card: Classes Selection */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Step 1: Classes Selection</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold uppercase text-text-secondary tracking-wider mb-2 block">Classes to Include</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-border">
                  {classes.map(c => {
                    const isSelected = selectedClassIds.includes(c.id);
                    const stuCount = getStudentCountForClass(c.id);
                    return (
                      <label 
                        key={c.id} 
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all duration-200 ${
                          isSelected 
                            ? 'bg-primary/5 border-primary font-bold text-text-primary' 
                            : 'bg-surface border-border text-text-secondary hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleClassToggle(c.id)}
                          className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="flex flex-col">
                          <span>{c.name} {c.section ? `- ${c.section}` : ''}</span>
                          <span className="text-[10px] text-text-muted font-medium">{stuCount} students</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {selectedClassIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-6 text-xs font-black text-text-primary bg-zinc-100/60 dark:bg-zinc-800/40 p-3 rounded-lg border border-border/50">
                    <div>Total Calculated Students: {totalSelectedStudents}</div>
                    <div>Required Benches: {requiredBenches}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Step 2 & 3 Card: Seating & Rooms Setup */}
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Step 2 & 3: Seating & Rooms Setup</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold uppercase text-text-secondary tracking-wider">Students Per Bench</label>
                  <Select
                    value={studentsPerBench}
                    disabled={selectedClassIds.length === 0}
                    onChange={(e) => {
                      setStudentsPerBench(e.target.value);
                      setPreviewData(null);
                    }}
                    className="mt-1"
                  >
                    <option value="1">1 Student</option>
                    <option value="2">2 Students</option>
                    <option value="3">3 Students</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-extrabold uppercase text-text-secondary tracking-wider">Number of Rooms</label>
                  <Input 
                    type="number"
                    min="1"
                    max="20"
                    value={roomCount}
                    disabled={selectedClassIds.length === 0}
                    onChange={(e) => handleRoomCountChange(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {selectedClassIds.length > 0 && (
                <div className="space-y-4 pt-2">
                  {/* Dynamic Instructional Message */}
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 text-xs text-text-primary">
                    <p className="leading-relaxed font-semibold">
                      You need a total of <strong className="text-primary font-black">{requiredBenches} benches</strong> for the selected students.
                      Please distribute these <strong className="text-primary font-black">{requiredBenches} benches</strong> across the <strong className="text-primary font-black">{roomConfigs.length} examination rooms</strong> below based on the actual benches available in each room. 
                      The total benches entered must be at least <strong className="text-primary font-black">{requiredBenches}</strong>.
                    </p>
                  </div>

                  {/* Room Configurations Input List */}
                  <div className="space-y-3">
                    <label className="text-xs font-extrabold uppercase text-text-secondary tracking-wider block">Configure Rooms Available Benches</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roomConfigs.map((rc, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-border">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-text-muted">Room Name</label>
                            <Input 
                              value={rc.room_name}
                              onChange={(e) => handleRoomConfigChange(idx, 'room_name', e.target.value)}
                              className="h-8 text-xs mt-0.5"
                            />
                          </div>
                          <div className="w-28">
                            <label className="text-[10px] font-bold text-text-muted">Bench Count</label>
                            <Input 
                              type="number"
                              min="1"
                              placeholder="Count"
                              value={rc.bench_count}
                              onChange={(e) => handleRoomConfigChange(idx, 'bench_count', e.target.value)}
                              className="h-8 text-xs mt-0.5"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live Bench Distribution Status Counter */}
                  <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-lg border border-border mt-3 text-xs">
                    <div className="font-extrabold">
                      Distributed: <span className="text-primary font-black">{totalEnteredBenches} / {requiredBenches}</span>
                    </div>
                    <div className="font-extrabold">
                      {remainingBenches > 0 ? (
                        <span className="text-amber-600">Remaining: {remainingBenches} Benches</span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1 font-bold">
                          <Check className="h-4 w-4" /> All Benches Distributed ({Math.abs(remainingBenches)} surplus)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Validation Warning Message */}
                  {totalEnteredBenches < requiredBenches && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>You still need to distribute {remainingBenches} more benches before continuing.</span>
                    </div>
                  )}

                  {/* Preview Button */}
                  <div className="pt-2">
                    <Button 
                      type="button" 
                      className="w-full flex items-center justify-center gap-2 font-bold py-2.5"
                      onClick={handlePreview}
                      disabled={previewLoading || !selectedExamId || selectedClassIds.length === 0 || totalEnteredBenches < requiredBenches}
                    >
                      {previewLoading ? 'Calculating...' : 'Preview Seating Plan'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* INSTANT SEATING PREVIEW AREA - Displayed directly below form inside State A */}
      {!generatedPlan && previewData && (
        <div className="max-w-5xl mx-auto mt-6 space-y-6 animate-in fade-in duration-300 no-print">
          <Card>
            <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary">Seating Allocation Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border text-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Total Students</p>
                  <p className="text-lg font-black text-text-primary mt-0.5">{previewData.total_students}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border text-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Bench Capacity</p>
                  <p className="text-lg font-black text-text-primary mt-0.5">{previewData.students_per_bench} / Bench</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border text-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Required Benches</p>
                  <p className="text-lg font-black text-text-primary mt-0.5">{previewData.required_benches}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border text-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Available Benches</p>
                  <p className="text-lg font-black text-text-primary mt-0.5">{previewData.available_benches}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-extrabold uppercase text-text-secondary tracking-wider">Room Allocation Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {previewData.room_details.map((room, rIdx) => (
                    <div key={rIdx} className="bg-surface p-3.5 rounded-lg border text-xs flex justify-between items-center">
                      <div>
                        <p className="font-extrabold text-text-primary">{room.room_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-primary">Allocated Students: {room.allocated}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            
            {previewData.enough_benches && (
              <div className="p-6 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <label className="flex items-start gap-2.5 text-xs font-semibold text-text-secondary cursor-pointer leading-normal select-none">
                  <input 
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4 mt-0.5"
                  />
                  <span>I confirm that the entered bench counts match the actual benches available in all selected examination rooms.</span>
                </label>
                <Button 
                  onClick={handleGenerate}
                  disabled={!confirmed || previewLoading}
                  className="font-black py-3 px-8 shadow-md"
                >
                  {previewLoading ? 'Generating Plan...' : 'Generate Seating Plan'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* STATE B: GENERATED SLIPS VIEW */}
      {currentView === 'slips' && generatedPlan ? (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
          {/* Back Button Panel */}
          <div className="flex justify-between items-center no-print">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/school-admin/exams')}
              className="flex items-center gap-1.5 font-bold text-xs"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Examinations
            </Button>
          </div>

          {/* Action Header Card */}
          <Card className="no-print">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary font-display font-black">Student Slips Generated</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex items-center gap-1.5 font-bold"
                  onClick={() => setIsRegenerateOpen(true)}
                >
                  <RefreshCw className="h-4 w-4" /> Regenerate Plan
                </Button>
                {(() => {
                  const allAdmitCardsPublished = selectedClassIds.length > 0 && selectedClassIds.every(classId => 
                    examClassStatuses.find(c => c.id === classId)?.admit_card_published === 1
                  );
                  if (allAdmitCardsPublished) {
                    return (
                      <Button 
                        variant="secondary"
                        className="flex items-center gap-1.5 font-bold border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        onClick={handleUnpublishAdmitClick}
                      >
                        <RotateCcw className="h-4 w-4" /> Revert to Draft
                      </Button>
                    );
                  }
                  return (
                    <Button 
                      variant="default"
                      className="flex items-center gap-1.5 font-bold cursor-pointer"
                      onClick={handlePublishAdmitClick}
                    >
                      <Check className="h-4 w-4" /> Publish Admit Cards
                    </Button>
                  );
                })()}
                <Button 
                  variant="outline"
                  className="flex items-center gap-1.5 font-bold"
                  onClick={() => handleDownloadPDF('print-slips', `Examination_Slips_${selectedRoomFilter}`)}
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button 
                  className="flex items-center gap-1.5 font-bold"
                  onClick={() => handlePrint('print-slips', `Examination Slips ${selectedRoomFilter}`)}
                >
                  <Printer className="h-4 w-4" /> Print Slips
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Room Filter Tool */}
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-xl border border-border no-print">
            <label className="text-xs font-black uppercase text-text-primary tracking-wider flex-shrink-0">Room Filter:</label>
            <Select 
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="w-48 bg-white dark:bg-surface border-border"
            >
              <option value="all">All Rooms</option>
              {uniqueRooms.map(roomName => (
                <option key={roomName} value={roomName}>{roomName}</option>
              ))}
            </Select>
            <span className="text-xs font-bold text-text-secondary ml-auto bg-primary/10 text-primary px-3 py-1.5 rounded-lg">
              Slips Shown: {filteredAllocations.length}
            </span>
          </div>

          {/* RENDERED CARDS - 100% width cells in grid, scaling dynamically */}
          <div id="print-slips" className="w-full">
            {/* Dynamic typography overrides for html2canvas rendering without line clips */}
            <style dangerouslySetInnerHTML={{__html: `
              .seating-slip, .seating-slip * {
                box-sizing: border-box !important;
                line-height: 1.45 !important;
                font-family: Arial, Helvetica, sans-serif !important;
              }
              /* Shift all elements (h4, p, span) slightly upward using bottom padding buffer to resolve clipping */
              .seating-slip h4, .seating-slip p, .seating-slip span {
                padding-bottom: 3px !important;
                padding-top: 0px !important;
              }
              /* Enforce page breaks after every 8-card page block in PDF and printing */
              .pdf-page {
                page-break-after: always !important;
                break-after: page !important;
                margin-bottom: 40px !important;
              }
              .pdf-page:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
                margin-bottom: 0px !important;
              }
            `}} />
            
            {/* Group cards into blocks of max 8 elements per PDF page */}
            {chunkAllocations(filteredAllocations, 8).map((chunk, pageIdx) => (
              <div key={pageIdx} className="pdf-page w-full pb-8">
                <div className={`seating-slip-grid grid ${getSlipGridClass()} gap-4 w-full pt-2`}>
                  {chunk.map((alloc, idx) => (
                    <div key={idx} className="slip-wrapper w-full flex justify-center">
                      <div 
                        className="seating-slip border-[3px] border-zinc-950 p-3.5 rounded-xl flex flex-col justify-between bg-white text-zinc-900 shadow-sm hover:shadow transition-all duration-200"
                        style={{ 
                          width: '90mm', 
                          height: '58mm', 
                          minWidth: '90mm', 
                          minHeight: '58mm', 
                          maxWidth: '90mm', 
                          maxHeight: '58mm', 
                          pageBreakInside: 'avoid', 
                          breakInside: 'avoid', 
                          overflow: 'hidden',
                          fontFamily: 'Arial, Helvetica, sans-serif'
                        }}
                      >
                        {/* Top Header Section (Swapped flexbox for block & table alignment) */}
                        <div className="border-b-2 border-zinc-800 pb-1.5 text-center">
                          <h4 
                            className="text-[12px] font-black uppercase text-zinc-900 truncate tracking-tight animate-none" 
                            style={{ lineHeight: '18px', marginBottom: '3px', fontFamily: 'Arial, Helvetica, sans-serif' }}
                          >
                            {generatedPlan.school_name}
                          </h4>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', margin: 0, padding: 0 }}>
                            <tbody>
                              <tr>
                                <td 
                                  className="text-[8px] font-black text-zinc-600 uppercase text-left" 
                                  style={{ lineHeight: '12px', fontFamily: 'Arial, Helvetica, sans-serif', padding: 0 }}
                                >
                                  {generatedPlan.exam_name}
                                </td>
                                <td 
                                  className="text-[8px] font-black text-zinc-600 uppercase text-right" 
                                  style={{ lineHeight: '12px', fontFamily: 'Arial, Helvetica, sans-serif', padding: 0 }}
                                >
                                  AY {currentYear?.name || '—'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Middle Student Info Section (Using borderless tables to resolve column baselines) */}
                        <div className="flex flex-col justify-center py-1 flex-1 min-h-0">
                          {/* Candidate Name block */}
                          <div className="w-full" style={{ marginBottom: '6px' }}>
                            <p className="text-[7px] font-black text-zinc-400 uppercase tracking-wider" style={{ lineHeight: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>Candidate Name</p>
                            <p className="text-[12px] font-black text-zinc-955 truncate uppercase" style={{ lineHeight: '16px', marginTop: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                              {alloc.student_name}
                            </p>
                          </div>

                          {/* Class & Roll number row (Table layout) */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #f4f4f5', marginTop: '4px', paddingTop: '4px' }}>
                            <tbody>
                              <tr>
                                <td style={{ width: '50%', padding: 0, verticalAlign: 'top' }}>
                                  <p className="text-[7px] font-black text-zinc-400 uppercase tracking-wider" style={{ lineHeight: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>Class</p>
                                  <p className="text-[10px] font-black text-zinc-855 uppercase truncate" style={{ lineHeight: '14px', marginTop: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                    {alloc.class_name}
                                  </p>
                                </td>
                                <td style={{ width: '50%', padding: 0, verticalAlign: 'top' }}>
                                  <p className="text-[7px] font-black text-zinc-400 uppercase tracking-wider" style={{ lineHeight: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>Roll Number</p>
                                  <p className="text-[10px] font-black text-zinc-855 font-mono truncate" style={{ lineHeight: '14px', marginTop: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                    {alloc.roll_no || '—'}
                                  </p>
                                </td>
                              </tr>
                            </tbody>
                          </table>

                          {/* Seating Location Details (Table layout) */}
                          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #e4e4e7', marginTop: '6px', paddingTop: '6px' }}>
                            <tbody>
                              <tr>
                                <td style={{ width: '35%', padding: 0, verticalAlign: 'top' }}>
                                  <p className="text-[6px] font-black text-zinc-400 uppercase tracking-widest" style={{ lineHeight: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>Exam Room</p>
                                  <p className="text-[10px] font-black text-zinc-955 uppercase truncate" style={{ lineHeight: '14px', marginTop: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                    {alloc.room_name}
                                  </p>
                                </td>
                                <td style={{ width: '35%', padding: 0, verticalAlign: 'top' }}>
                                  <p className="text-[6px] font-black text-zinc-400 uppercase tracking-widest" style={{ lineHeight: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>Bench</p>
                                  <p className="text-[10px] font-black text-zinc-955 uppercase truncate" style={{ lineHeight: '14px', marginTop: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                    Bench {alloc.bench_number}
                                  </p>
                                </td>
                                <td style={{ width: '30%', padding: 0, verticalAlign: 'top', textAlign: 'right' }}>
                                  <p className="text-[6px] font-black text-zinc-400 uppercase tracking-widest" style={{ lineHeight: '10px', fontFamily: 'Arial, Helvetica, sans-serif' }}>Position</p>
                                  <p className="text-[10px] font-black text-primary uppercase truncate" style={{ lineHeight: '14px', marginTop: '2px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                    {getFullPositionName(alloc.seat_position)}
                                  </p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Bottom Section */}
                        <div className="border-t border-zinc-200 pt-1 text-center mt-auto">
                          <span className="text-[7px] font-black text-zinc-500 uppercase tracking-wider block" style={{ lineHeight: '1.45', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            Official Admit Card
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog
        isOpen={isRegenerateOpen}
        onClose={() => !regenerateLoading && setIsRegenerateOpen(false)}
        title="Regenerate Seating Plan?"
        className="max-w-md animate-in fade-in zoom-in-95 duration-200"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button 
              variant="outline" 
              onClick={() => setIsRegenerateOpen(false)}
              disabled={regenerateLoading}
              className="font-bold"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRegenerateConfirm}
              disabled={regenerateLoading}
              className="font-black bg-red-600 hover:bg-red-700 text-white"
            >
              {regenerateLoading ? 'Regenerating...' : 'Yes, Regenerate'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            You are about to regenerate the seating plan for this examination.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            Regenerating the seating plan will permanently remove the currently generated seating arrangement and student seating slips.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            You will be redirected to the Seating Plan Configuration page to create a new seating arrangement.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-semibold text-text-primary mt-1">
            Are you sure you want to continue?
          </p>
        </div>
      </Dialog>

      {/* PUBLISH ADMIT CARDS DIALOG */}
      <Dialog
        isOpen={showPublishAdmitModal}
        onClose={() => !submittingPublishAdmit && setShowPublishAdmitModal(false)}
        title="Publish Admit Cards"
        className="max-w-md animate-in fade-in zoom-in-95 duration-200"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button 
              variant="outline" 
              onClick={() => setShowPublishAdmitModal(false)}
              disabled={submittingPublishAdmit}
              className="font-bold"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmPublishAdmitCards}
              disabled={submittingPublishAdmit}
              className="font-black bg-green-600 hover:bg-green-700 text-white"
            >
              {submittingPublishAdmit ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            You are about to publish the admit cards. Once published, students will be able to access the admit cards in the mobile application. Do you want to continue?
          </p>
        </div>
      </Dialog>

      {/* UNPUBLISH ADMIT CARDS DIALOG */}
      <Dialog
        isOpen={showUnpublishAdmitModal}
        onClose={() => !submittingUnpublishAdmit && setShowUnpublishAdmitModal(false)}
        title="Revert Admit Cards to Draft"
        className="max-w-md animate-in fade-in zoom-in-95 duration-200"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button 
              variant="outline" 
              onClick={() => setShowUnpublishAdmitModal(false)}
              disabled={submittingUnpublishAdmit}
              className="font-bold"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmUnpublishAdmitCards}
              disabled={submittingUnpublishAdmit}
              className="font-black bg-rose-600 hover:bg-rose-700 text-white"
            >
              {submittingUnpublishAdmit ? 'Reverting...' : 'Confirm Revert'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
            Are you sure you want to revert the admit cards to Draft? Once reverted, they will disappear from the mobile application, and students/parents will receive a notification alert.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
