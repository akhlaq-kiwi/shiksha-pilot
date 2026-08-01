import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE } from '../reportCardLayout';

/**
 * Template 1: Modern School Report
 * Features sleek gradient header, stat summary cards, pill tags, and 3-signature layout.
 */
export default function ModernReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const isFinalReport = Boolean(exam?.is_final_session_report || data?.is_final_session_report);

  // Dynamic layout density scaling based on subject count
  const subCount = subjects?.length || 0;
  const isCompact = subCount > 8;
  const isExtraCompact = subCount > 11;

  const containerPadding = isExtraCompact ? '5mm' : isCompact ? '7mm' : '9mm';
  const sectionGap = isExtraCompact ? 'space-y-2.5' : isCompact ? 'space-y-3.5' : 'space-y-5';
  const cellPy = isExtraCompact ? 'py-1' : isCompact ? 'py-1.5' : 'py-2.5';

  // Clean rank display (e.g. "13" instead of "13 of 34")
  const cleanRank = (summary?.class_rank || '1st').toString().split(' ')[0];

  return (
    <div
      className={`w-full bg-white text-zinc-900 font-sans relative flex flex-col ${sectionGap}`}
      style={{ padding: containerPadding, boxSizing: 'border-box', minHeight: '100%' }}
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-6 rounded-xl relative overflow-hidden flex items-center justify-between border border-emerald-700/30">
        {/* Subtle Inner Accent Line at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-amber-400" />

        <div className="flex items-center gap-4 min-w-0 z-10">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain shrink-0 bg-white/10 p-1.5 rounded-xl border border-white/20" />
          ) : (
            <div className="h-16 w-16 bg-amber-400 text-emerald-950 font-black text-2xl rounded-xl flex items-center justify-center border border-amber-300 shadow-xs shrink-0 font-display">
              {school.name ? school.name.charAt(0) : 'S'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-black uppercase tracking-tight font-display text-amber-300 leading-normal block">
              {school.name}
            </h1>
            <p className="text-xs font-medium text-emerald-100 opacity-90 leading-normal mt-0.5 block">
              {school.address || 'Civil Lines, Central Education Hub'} {school.phone ? `| Tel: ${school.phone}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 bg-amber-400 text-emerald-950 text-[10px] font-black rounded-md uppercase tracking-wider">
                {isFinalReport ? 'FINAL ACADEMIC REPORT CARD' : exam.name}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-200">
                Session: {academic_year.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Student Meta Card (3 columns x 2 rows, center aligned) */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs grid grid-cols-3 gap-y-3 gap-x-4 font-medium text-center">
        {/* Row 1 */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Student Name</span>
          <strong className="text-zinc-900 text-sm font-black uppercase tracking-tight">{student.name}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Father Name</span>
          <strong className="text-zinc-900 text-sm font-black uppercase tracking-tight">{student.father_name || '—'}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Mother Name</span>
          <strong className="text-zinc-900 text-sm font-black uppercase tracking-tight">{student.mother_name || '—'}</strong>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Class & Section</span>
          <strong className="text-zinc-900 text-sm font-mono font-black tracking-tight">{student.class_name} {student.section ? `(${student.section})` : ''}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Roll / SR. No</span>
          <strong className="text-zinc-900 text-sm font-mono font-black tracking-tight">{student.roll_no || '—'} | {student.admission_no || '—'}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase block">Date of Birth</span>
          <strong className="text-zinc-900 text-sm font-mono font-black tracking-tight">{student.dob || '—'}</strong>
        </div>
      </div>

      {/* Subjects Marks Table */}
      <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
        {isFinalReport ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-950 text-white font-bold uppercase text-[9.5px] tracking-wider">
                <th rowSpan={2} className="py-2.5 px-4 text-left font-bold border-r border-emerald-800 whitespace-nowrap min-w-[140px]">Subject</th>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <th key={exName} colSpan={2} className="p-1 text-center border-r border-emerald-800">{exName}</th>
                ))}
                <th colSpan={2} className="p-1 text-center border-r border-emerald-800">Grand Total</th>
                <th rowSpan={2} className="p-2 text-center">Grade</th>
              </tr>
              <tr className="bg-emerald-900 text-white font-bold uppercase text-[8.5px]">
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <th className="p-1 text-center border-r border-emerald-800">M.M.</th>
                    <th className="p-1 text-center border-r border-emerald-800">Obt.</th>
                  </React.Fragment>
                ))}
                <th className="p-1 text-center border-r border-emerald-800">Max</th>
                <th className="p-1 text-center border-r border-emerald-800">Obt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                  <td className={`${cellPy} px-3 text-left font-bold text-zinc-900 border-r border-zinc-200 whitespace-nowrap`}>{sub.subject_name}</td>
                  {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                    <React.Fragment key={exName}>
                      <td className="p-2 text-center border-r border-zinc-200 font-mono text-zinc-600">{sub.exam_scores?.[exName]?.max_marks || 100}</td>
                      <td className="p-2 text-center border-r border-zinc-200 font-mono font-bold text-emerald-700">{sub.exam_scores?.[exName]?.marks_obtained ?? '—'}</td>
                    </React.Fragment>
                  ))}
                  <td className="p-2 text-center border-r border-zinc-200 font-mono font-bold text-zinc-700">{sub.grand_total_max || sub.max_marks}</td>
                  <td className="p-2 text-center border-r border-zinc-200 font-mono font-black text-emerald-800">{sub.grand_total_obtained || sub.marks_obtained}</td>
                  <td className="p-2 text-center font-black text-emerald-800">{sub.grade}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-950 font-bold text-xs text-emerald-950">
                <td className="py-2.5 px-4 text-left border-r border-emerald-200 whitespace-nowrap">Total Marks</td>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <td className="p-2 text-center border-r border-emerald-200 font-mono">{data.exam_totals?.[exName]?.max_marks || 700}</td>
                    <td className="p-2 text-center border-r border-emerald-200 font-mono font-black text-emerald-900">{data.exam_totals?.[exName]?.marks_obtained || 500}</td>
                  </React.Fragment>
                ))}
                <td className="p-2 text-center border-r border-emerald-200 font-mono font-bold">{summary.total_max}</td>
                <td className="p-2 text-center border-r border-emerald-200 font-mono font-black text-sm text-emerald-900">{summary.total_obtained}</td>
                <td className="p-2 text-center font-black text-sm">{summary.grade}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-950 text-white font-bold uppercase text-[10.5px] tracking-wider">
                <th className="py-2.5 px-4 text-left font-bold whitespace-nowrap min-w-[140px]">Subject</th>
                <th className="p-3 text-center w-28">Obtained</th>
                <th className="p-3 text-center w-24">Max</th>
                <th className="p-3 text-center w-24">Pass</th>
                <th className="p-3 text-center w-20">Grade</th>
                <th className="p-3 text-center w-24">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                  <td className="py-2.5 px-4 text-left font-bold text-zinc-900 whitespace-nowrap">{sub.subject_name}</td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-700">{sub.marks_obtained}</td>
                  <td className="p-3 text-center font-mono text-zinc-600">{sub.max_marks}</td>
                  <td className="p-3 text-center font-mono text-zinc-500">{sub.passing_marks}</td>
                  <td className="p-3 text-center font-black text-emerald-800">{sub.grade}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      sub.result === 'PASS' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                    }`}>
                      {sub.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Teacher Remarks (Rendered ONLY if non-empty remark exists) */}
      {Boolean(summary.teacher_remark && summary.teacher_remark.toString().trim() !== '') && (
        <div className="px-1 font-sans text-xs text-zinc-700 leading-normal">
          <strong className="font-bold text-zinc-900">Teacher Remarks:</strong>{' '}
          <span className="font-normal text-zinc-700">{summary.teacher_remark}</span>
        </div>
      )}

      {/* Footer block: performance summary sits directly above the signatures,
          both pinned to the bottom of the page. */}
      {/* marginTop is inline, not the mt-auto utility: Tailwind's space-y-*
          rule (.space-y-N > * ~ *) is more specific than .mt-auto and was
          overriding it, which left the footer with no auto margin. */}
      <div style={{ marginTop: 'auto' }}>
        {/* Performance Summary Cards (5 columns) */}
        <div className="grid grid-cols-5 gap-2 font-sans">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">Total Marks</span>
            <span className="text-sm font-black text-emerald-950 font-mono mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 block">Percentage</span>
            <span className="text-sm font-black text-amber-950 font-mono mt-0.5">{summary.percentage}%</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">Overall Grade</span>
            <span className="text-sm font-black text-emerald-950 font-mono mt-0.5">Grade {summary.grade}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 block">Attendance</span>
            <span className="text-sm font-black text-amber-950 font-mono mt-0.5">{summary.attendance?.attendance_rate ?? 90.3}%</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">Class Rank</span>
            <span className="text-sm font-black text-emerald-950 font-mono mt-0.5">{cleanRank}</span>
          </div>
        </div>

        {/* Signatures. Gaps are in mm so the clear area survives print scaling:
            SIGNATURE_GAP below the summary cards, then STAMP_SPACE of blank room
            above each signature line for a stamp and a handwritten signature. */}
        <div
          className="pb-1 flex justify-between items-end text-xs font-bold text-zinc-700 px-6 font-sans"
          style={{ marginTop: SIGNATURE_GAP }}
        >
          <div className="flex flex-col items-center">
            <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
            <div className="w-40 border-b border-dashed border-zinc-400 mb-2" />
            <span className="uppercase text-[10px] font-black tracking-wider text-zinc-800">Class Teacher Signature</span>
          </div>
          <div className="flex flex-col items-center">
            <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
            <div className="w-40 border-b border-dashed border-zinc-400 mb-2" />
            <span className="uppercase text-[10px] font-black tracking-wider text-zinc-800">Principal Signature & Stamp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
