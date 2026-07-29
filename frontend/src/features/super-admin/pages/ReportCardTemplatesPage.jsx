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
              card={previewMode === 'final_session' ? MOCK_FINAL_SESSION_CARD : MOCK_PREVIEW_STUDENT_CARD}
              schoolProfile={MOCK_SCHOOL_PROFILE}
              currentYear={{ name: '2026–2027' }}
              exam={previewMode === 'final_session' ? { name: 'FINAL ACADEMIC REPORT CARD', is_final_session_report: true } : { name: 'Half Yearly Examination' }}
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
                    <span className="text-[10px] font-mono text-text-muted uppercase">
                      Code: {tpl.code}
                    </span>
                  </div>
                </div>

                {tpl.is_system_default ? (
                  <span className="px-2 py-0.5 bg-amber-400/15 text-amber-600 border border-amber-400/30 text-[9px] font-black rounded-md uppercase tracking-wider">
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
                  <span className="font-bold text-text-primary font-mono">{tpl.assigned_schools_count || 0} Schools</span>
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
    </div>
  );
}
