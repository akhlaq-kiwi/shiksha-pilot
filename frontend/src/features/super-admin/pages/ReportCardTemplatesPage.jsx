import React, { useState, useEffect } from 'react';
import { Layout, FileText, Eye, CheckCircle2, Building, Trash2, Plus, Sparkles, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Dialog } from '../../../common/ui/dialog';
import { Select } from '../../../common/ui/select';
import { schoolService } from '../../../common/services/schoolService';
import { platformService } from '../../../common/services/platformService';
import ReportCardRenderer from '../../report-card-templates/ReportCardRenderer';

// Mock sample student dataset for Super Admin live template preview
const MOCK_PREVIEW_STUDENT_CARD = {
  student_id: 101,
  student_name: 'Aarav Sharma',
  roll_no: '01',
  admission_no: 'SR-2026-104',
  class_name: 'Class 5',
  class_section: 'A',
  father_name: 'Vikram Sharma',
  mother_name: 'Meenakshi Sharma',
  date_of_birth: '2016-04-12',
  subjects: [
    { subject_name: 'English Language', marks_obtained: 94, max_marks: 100, passing_marks: 33, grade: 'A1', result: 'PASS' },
    { subject_name: 'Mathematics', marks_obtained: 91, max_marks: 100, passing_marks: 33, grade: 'A1', result: 'PASS' },
    { subject_name: 'Science & Tech', marks_obtained: 88, max_marks: 100, passing_marks: 33, grade: 'A2', result: 'PASS' },
    { subject_name: 'Social Studies', marks_obtained: 85, max_marks: 100, passing_marks: 33, grade: 'A2', result: 'PASS' },
    { subject_name: 'Hindi Literature', marks_obtained: 90, max_marks: 100, passing_marks: 33, grade: 'A1', result: 'PASS' },
    { subject_name: 'Computer Applications', marks_obtained: 96, max_marks: 100, passing_marks: 33, grade: 'A1', result: 'PASS' }
  ],
  total_obtained: 544,
  total_max: 600,
  percentage: 90.67,
  grade: 'A1',
  class_rank: '1st',
  section_rank: '1st',
  result: 'PASS',
  report_card_remark: 'Outstanding performance! Demonstrates exemplary academic dedication and leadership.',
  attendance: { present_days: 178, working_days: 185, attendance_rate: 96.2 }
};

const MOCK_FINAL_SESSION_CARD = {
  student: {
    id: 101,
    name: 'Aarav Sharma',
    roll_no: '01',
    admission_no: 'SR-2026-104',
    class_name: 'Class 5',
    section: 'A',
    father_name: 'Vikram Sharma',
    mother_name: 'Meenakshi Sharma',
    dob: '2016-04-12'
  },
  school: {
    name: 'ST. XAVIER ACADEMIC ACADEMY',
    logo_path: null,
    address: 'Civil Lines, Central Education Hub',
    phone: '+91 98765 43210'
  },
  academic_year: { name: '2026–2027' },
  exam: {
    name: 'FINAL ACADEMIC REPORT CARD',
    type: 'Annual Session Summary',
    is_final_session_report: true
  },
  is_final_session_report: true,
  session_exams: ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam'],
  subjects: [
    {
      subject_name: 'English Language',
      exam_scores: {
        'Quarterly Exam': { max_marks: 100, marks_obtained: 92 },
        'Half Yearly Exam': { max_marks: 100, marks_obtained: 94 },
        'Annual Exam': { max_marks: 100, marks_obtained: 96 }
      },
      grand_total_max: 300,
      grand_total_obtained: 282,
      grade: 'A1',
      result: 'PASS'
    },
    {
      subject_name: 'Mathematics',
      exam_scores: {
        'Quarterly Exam': { max_marks: 100, marks_obtained: 88 },
        'Half Yearly Exam': { max_marks: 100, marks_obtained: 91 },
        'Annual Exam': { max_marks: 100, marks_obtained: 94 }
      },
      grand_total_max: 300,
      grand_total_obtained: 273,
      grade: 'A1',
      result: 'PASS'
    },
    {
      subject_name: 'Science & Tech',
      exam_scores: {
        'Quarterly Exam': { max_marks: 100, marks_obtained: 85 },
        'Half Yearly Exam': { max_marks: 100, marks_obtained: 88 },
        'Annual Exam': { max_marks: 100, marks_obtained: 90 }
      },
      grand_total_max: 300,
      grand_total_obtained: 263,
      grade: 'A2',
      result: 'PASS'
    },
    {
      subject_name: 'Social Studies',
      exam_scores: {
        'Quarterly Exam': { max_marks: 100, marks_obtained: 82 },
        'Half Yearly Exam': { max_marks: 100, marks_obtained: 85 },
        'Annual Exam': { max_marks: 100, marks_obtained: 88 }
      },
      grand_total_max: 300,
      grand_total_obtained: 255,
      grade: 'A2',
      result: 'PASS'
    },
    {
      subject_name: 'Hindi Literature',
      exam_scores: {
        'Quarterly Exam': { max_marks: 100, marks_obtained: 87 },
        'Half Yearly Exam': { max_marks: 100, marks_obtained: 90 },
        'Annual Exam': { max_marks: 100, marks_obtained: 92 }
      },
      grand_total_max: 300,
      grand_total_obtained: 269,
      grade: 'A1',
      result: 'PASS'
    },
    {
      subject_name: 'Computer Applications',
      exam_scores: {
        'Quarterly Exam': { max_marks: 100, marks_obtained: 94 },
        'Half Yearly Exam': { max_marks: 100, marks_obtained: 96 },
        'Annual Exam': { max_marks: 100, marks_obtained: 98 }
      },
      grand_total_max: 300,
      grand_total_obtained: 288,
      grade: 'A1',
      result: 'PASS'
    }
  ],
  exam_totals: {
    'Quarterly Exam': { max_marks: 600, marks_obtained: 536 },
    'Half Yearly Exam': { max_marks: 600, marks_obtained: 544 },
    'Annual Exam': { max_marks: 600, marks_obtained: 558 }
  },
  summary: {
    total_obtained: 1638,
    total_max: 1800,
    percentage: 91.0,
    grade: 'A1',
    gpa: '9.1',
    class_rank: '1st',
    section_rank: '1st',
    result: 'PASS',
    attendance: { present_days: 208, working_days: 220, attendance_rate: 94.55 },
    promotion_status: 'PROMOTED TO CLASS 6',
    teacher_remark: 'Outstanding performance! Demonstrates exemplary academic dedication and leadership throughout the session.'
  }
};

const MOCK_CBSE_CLASSIC_CARD = {
  student: {
    id: 101,
    name: 'Aarav Sharma',
    roll_no: '01',
    admission_no: 'SR-2026-104',
    class_name: 'Class 5',
    section: 'A',
    father_name: 'Vikram Sharma',
    mother_name: 'Meenakshi Sharma',
    dob: '12/04/2016'
  },
  school: {
    name: 'ST. XAVIER ACADEMIC ACADEMY',
    logo_path: null,
    address: 'CIVIL LINES, CENTRAL EDUCATION HUB',
    phone: '+91 98765 43210'
  },
  academic_year: { name: '2026–2027' },
  exam: {
    name: 'ACADEMIC PERFORMANCE REPORT',
    type: 'Term Assessment',
    is_final_session_report: false
  },
  terminals: [
    {
      id: 1,
      name: 'FIRST TERM EXAMINATIONS',
      sub_tests: [
        { id: 11, name: 'UNIT TEST 1', max_marks: 30 },
        { id: 12, name: 'UNIT TEST 2 (30)', max_marks: 30 }
      ]
    },
    {
      id: 2,
      name: 'SECOND TERM EXAMINATION',
      sub_tests: [
        { id: 21, name: 'UNIT TEST 1 (30)', max_marks: 30 },
        { id: 22, name: 'UNIT TEST 2 (30)', max_marks: 30 }
      ]
    }
  ],
  subjects: [
    {
      subject_name: 'English Language',
      terminals: {
        'FIRST TERM EXAMINATIONS': {
          sub_tests: {
            'UNIT TEST 1': { marks_obtained: 25, raw_obtained: 25 },
            'UNIT TEST 2 (30)': { marks_obtained: 28, raw_obtained: 28 }
          }
        },
        'SECOND TERM EXAMINATION': {
          sub_tests: {
            'UNIT TEST 1 (30)': { marks_obtained: 27, raw_obtained: 27 },
            'UNIT TEST 2 (30)': { marks_obtained: 29, raw_obtained: 29 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Mathematics',
      terminals: {
        'FIRST TERM EXAMINATIONS': {
          sub_tests: {
            'UNIT TEST 1': { marks_obtained: 26, raw_obtained: 26 },
            'UNIT TEST 2 (30)': { marks_obtained: 29, raw_obtained: 29 }
          }
        },
        'SECOND TERM EXAMINATION': {
          sub_tests: {
            'UNIT TEST 1 (30)': { marks_obtained: 28, raw_obtained: 28 },
            'UNIT TEST 2 (30)': { marks_obtained: 30, raw_obtained: 30 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Science & Tech',
      terminals: {
        'FIRST TERM EXAMINATIONS': {
          sub_tests: {
            'UNIT TEST 1': { marks_obtained: 24, raw_obtained: 24 },
            'UNIT TEST 2 (30)': { marks_obtained: 27, raw_obtained: 27 }
          }
        },
        'SECOND TERM EXAMINATION': {
          sub_tests: {
            'UNIT TEST 1 (30)': { marks_obtained: 26, raw_obtained: 26 },
            'UNIT TEST 2 (30)': { marks_obtained: 28, raw_obtained: 28 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Social Studies',
      terminals: {
        'FIRST TERM EXAMINATIONS': {
          sub_tests: {
            'UNIT TEST 1': { marks_obtained: 22, raw_obtained: 22 },
            'UNIT TEST 2 (30)': { marks_obtained: 25, raw_obtained: 25 }
          }
        },
        'SECOND TERM EXAMINATION': {
          sub_tests: {
            'UNIT TEST 1 (30)': { marks_obtained: 25, raw_obtained: 25 },
            'UNIT TEST 2 (30)': { marks_obtained: 26, raw_obtained: 26 }
          }
        }
      },
      grade: 'B'
    },
    {
      subject_name: 'Hindi Literature',
      terminals: {
        'FIRST TERM EXAMINATIONS': {
          sub_tests: {
            'UNIT TEST 1': { marks_obtained: 25, raw_obtained: 25 },
            'UNIT TEST 2 (30)': { marks_obtained: 27, raw_obtained: 27 }
          }
        },
        'SECOND TERM EXAMINATION': {
          sub_tests: {
            'UNIT TEST 1 (30)': { marks_obtained: 26, raw_obtained: 26 },
            'UNIT TEST 2 (30)': { marks_obtained: 28, raw_obtained: 28 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Computer Applications',
      terminals: {
        'FIRST TERM EXAMINATIONS': {
          sub_tests: {
            'UNIT TEST 1': { marks_obtained: 28, raw_obtained: 28 },
            'UNIT TEST 2 (30)': { marks_obtained: 30, raw_obtained: 30 }
          }
        },
        'SECOND TERM EXAMINATION': {
          sub_tests: {
            'UNIT TEST 1 (30)': { marks_obtained: 29, raw_obtained: 29 },
            'UNIT TEST 2 (30)': { marks_obtained: 30, raw_obtained: 30 }
          }
        }
      },
      grade: 'A'
    }
  ],
  summary: {
    total_obtained: 622,
    total_max: 720,
    percentage: 86.39,
    grade: 'A',
    gpa: '8.6',
    class_rank: '1',
    section_rank: '1',
    result: 'PASS',
    attendance: { present_days: 208, working_days: 220, attendance_rate: 94.55 },
    promotion_status: 'PROMOTED TO CLASS 6',
    teacher_remark: 'Outstanding performance! Demonstrates exemplary academic dedication throughout the session.'
  }
};

const MOCK_SCHOOL_PROFILE = {
  name: 'ST. XAVIER ACADEMIC ACADEMY',
  logo_path: null,
  address: 'Civil Lines, Central Education Hub',
  phone: '+91 98765 43210',
  report_card_remark: 'Outstanding academic performance.'
};

export default function ReportCardTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modals state
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewMode, setPreviewMode] = useState('final_session'); // 'final_session' | 'single_exam'
  const [assignModalTemplate, setAssignModalTemplate] = useState(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // View Assigned Schools Modal State
  const [viewAssignedSchoolsTemplate, setViewAssignedSchoolsTemplate] = useState(null);
  const [assignedSchoolsList, setAssignedSchoolsList] = useState([]);
  const [loadingAssignedSchools, setLoadingAssignedSchools] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const tRes = await schoolService.getReportCardTemplates();
      setTemplates(tRes.data || tRes || []);
      const sData = await platformService.getSchools();
      setSchools(sData || []);
    } catch (err) {
      setError(err.message || 'Failed to load report card templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignedSchoolsModal = async (tpl) => {
    setViewAssignedSchoolsTemplate(tpl);
    setLoadingAssignedSchools(true);
    setAssignedSchoolsList([]);
    try {
      const res = await schoolService.getTemplateAssignedSchools(tpl.id);
      const list = res?.schools || (Array.isArray(res) ? res : (res?.data?.schools || []));
      setAssignedSchoolsList(list);
    } catch (err) {
      const filtered = schools.filter(s => {
        const sTplId = Number(s.report_card_template_id);
        if (sTplId) {
          return sTplId === Number(tpl.id);
        }
        return Boolean(tpl.is_system_default) && (Number(tpl.id) === 1);
      });
      setAssignedSchoolsList(filtered);
    } finally {
      setLoadingAssignedSchools(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId || !assignModalTemplate) return;
    setAssigning(true);
    setMessage('');
    try {
      await schoolService.assignReportCardTemplateToSchool(selectedSchoolId, assignModalTemplate.id);
      setMessage(`Template "${assignModalTemplate.name}" assigned successfully!`);
      setAssignModalTemplate(null);
      setSelectedSchoolId('');
      fetchInitialData();
    } catch (err) {
      setError(err.message || 'Failed to assign template.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) return;
    try {
      await schoolService.deleteReportCardTemplate(template.id);
      setMessage(`Template "${template.name}" deleted.`);
      fetchInitialData();
    } catch (err) {
      setError(err.message || 'Failed to delete template.');
    }
  };

  // Full Page Dedicated Live Preview View (No Modal)
  if (previewTemplate) {
    const isClassic = (previewTemplate.code === 'cbse_classic');

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Top Sticky Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border p-4 rounded-xl shadow-xs sticky top-16 z-20">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex items-center gap-1.5 text-xs font-bold"
              onClick={() => setPreviewTemplate(null)}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Templates
            </Button>
            <div>
              <h2 className="text-base font-bold text-text-primary font-display">
                Live Preview: {previewTemplate.name}
              </h2>
              <p className="text-[11px] text-text-muted">
                Rendering sample student report card with normalized engine schema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isClassic && (
              <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewMode('final_session')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    previewMode === 'final_session' 
                      ? 'bg-amber-500 text-white shadow-xs' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  🏆 Final Academic Session Report (Multi-Exam Breakdown)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('single_exam')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    previewMode === 'single_exam' 
                      ? 'bg-primary text-white shadow-xs' 
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  📄 Single Exam Report (Half Yearly)
                </button>
              </div>
            )}

            <Button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 text-xs font-bold"
            >
              <Printer className="h-4 w-4" /> Print Preview
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewTemplate(null)}
              className="text-xs font-bold"
            >
              Close Preview
            </Button>
          </div>
        </div>

        {/* Full Page Report Card View */}
        <div className="w-full py-8 bg-zinc-200 dark:bg-zinc-900 rounded-2xl flex justify-center items-start shadow-inner overflow-x-auto min-h-[calc(100vh-160px)]">
          <div className="shadow-2xl bg-white rounded-2xl overflow-hidden border border-zinc-300">
            <ReportCardRenderer
              card={
                isClassic
                  ? MOCK_CBSE_CLASSIC_CARD
                  : (previewMode === 'final_session' ? MOCK_FINAL_SESSION_CARD : MOCK_PREVIEW_STUDENT_CARD)
              }
              schoolProfile={MOCK_SCHOOL_PROFILE}
              currentYear={{ name: '2026–2027' }}
              exam={
                isClassic
                  ? { name: 'ACADEMIC PERFORMANCE REPORT', type: 'Term Assessment' }
                  : (previewMode === 'final_session' ? { name: 'FINAL ACADEMIC REPORT CARD', is_final_session_report: true } : { name: 'Half Yearly Examination' })
              }
              forcedTemplateCode={previewTemplate.code}
              customConfig={previewTemplate.layout_config}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight font-display">
            Report Card Templates Engine
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Super Admin Portal — Create, preview, and assign school-wise custom report card visual layouts.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {message && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-xs font-semibold">
          {message}
        </div>
      )}

      {/* Templates Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 p-12 text-center text-text-muted text-xs">
            Loading template gallery...
          </div>
        ) : templates.map((tpl) => (
          <Card key={tpl.id} className="border-border hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-text-primary">
                      {tpl.name}
                    </CardTitle>
                    <span className="text-[11px] font-mono text-text-muted uppercase">
                      Code: {tpl.code}
                    </span>
                  </div>
                </div>

                {tpl.is_system_default ? (
                  <span className="px-2 py-0.5 bg-amber-400/15 text-amber-600 border border-amber-400/30 text-[11px] font-bold rounded-md uppercase tracking-wider">
                    System Default
                  </span>
                ) : (
                  <Button variant="ghost" size="xs" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDeleteTemplate(tpl)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs text-text-secondary leading-relaxed">
                {tpl.description || 'Custom report card template with configurable layout options.'}
              </p>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-muted">Assigned Schools:</span>
                  <button
                    type="button"
                    onClick={() => handleOpenAssignedSchoolsModal(tpl)}
                    className="font-bold text-primary hover:text-primary-dark hover:underline font-mono px-2 py-0.5 rounded bg-primary/10 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Click to view assigned schools list"
                  >
                    <Building className="h-3 w-3" />
                    {tpl.assigned_schools_count || 0} Schools
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-muted">Signatures:</span>
                  <span className="font-semibold text-text-secondary">
                    {tpl.layout_config?.signatures?.join(', ') || 'Class Teacher, Principal'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <Button variant="outline" className="flex-1 h-8 text-xs font-bold flex items-center gap-1.5" onClick={() => setPreviewTemplate(tpl)}>
                  <Eye className="h-3.5 w-3.5" /> Live Preview
                </Button>
                <Button className="flex-1 h-8 text-xs font-bold flex items-center gap-1.5" onClick={() => { setAssignModalTemplate(tpl); setSelectedSchoolId(''); }}>
                  <Building className="h-3.5 w-3.5" /> Assign to School
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ASSIGN TEMPLATE TO SCHOOL DIALOG MODAL */}
      <Dialog isOpen={Boolean(assignModalTemplate)} onClose={() => setAssignModalTemplate(null)} title={`Assign "${assignModalTemplate?.name}"`}>
        {assignModalTemplate && (
          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-2">
            <p className="text-xs text-text-secondary leading-relaxed">
              Select a school to assign <strong>{assignModalTemplate.name}</strong> as its official report card template.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Select School</label>
              <Select value={selectedSchoolId} onChange={e => setSelectedSchoolId(e.target.value)} required className="w-full">
                <option value="">-- Choose School --</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code || `ID: ${s.id}`})
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={() => setAssignModalTemplate(null)} disabled={assigning}>
                Cancel
              </Button>
              <Button type="submit" disabled={assigning || !selectedSchoolId}>
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* VIEW ASSIGNED SCHOOLS LIST DIALOG MODAL */}
      <Dialog
        isOpen={Boolean(viewAssignedSchoolsTemplate)}
        onClose={() => setViewAssignedSchoolsTemplate(null)}
        title={`Assigned Schools — ${viewAssignedSchoolsTemplate?.name || ''}`}
        footer={
          <div className="flex justify-between items-center w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const t = viewAssignedSchoolsTemplate;
                setViewAssignedSchoolsTemplate(null);
                setAssignModalTemplate(t);
                setSelectedSchoolId('');
              }}
              className="text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Assign Another School
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setViewAssignedSchoolsTemplate(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {viewAssignedSchoolsTemplate && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-border">
              <div>
                <span className="text-xs font-bold text-text-primary block">
                  {viewAssignedSchoolsTemplate.name}
                </span>
                <span className="text-[11px] font-mono text-text-muted uppercase">
                  Code: {viewAssignedSchoolsTemplate.code}
                </span>
              </div>
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full font-mono">
                {assignedSchoolsList.length} Schools Assigned
              </span>
            </div>

            {loadingAssignedSchools ? (
              <div className="p-8 text-center text-xs text-text-muted">
                Loading assigned schools...
              </div>
            ) : assignedSchoolsList.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-dashed border-border space-y-2">
                <Building className="h-8 w-8 text-text-muted mx-auto opacity-50" />
                <p className="text-xs font-semibold text-text-secondary">
                  No schools are currently assigned to this report card template.
                </p>
                <p className="text-[11px] text-text-muted">
                  You can assign this template to any school using the "Assign to School" button.
                </p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                {assignedSchoolsList.map((s, i) => (
                  <div
                    key={s.id || i}
                    className="p-3 bg-surface border border-border rounded-xl flex items-center justify-between hover:border-primary/40 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                        {s.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-text-primary">
                          {s.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono mt-0.5">
                          <span>{s.code || `ID: ${s.id}`}</span>
                          {(s.city || s.state) && (
                            <span>• {[s.city, s.state].filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px] font-bold rounded-md uppercase">
                        Active
                      </span>
                      {s.email && (
                        <p className="text-[10px] text-text-muted mt-0.5">{s.email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
