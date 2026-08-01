import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE } from '../reportCardLayout';

/**
 * Template 2: Classic CBSE Style Report Card
 * Features formal double border, term-wise breakdown, scholastic areas, grade point scale, and 2-signature layout.
 */
export default function ClassicCBSEReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  const subCount = subjects?.length || 0;
  const isCompact = subCount > 8;
  const isExtraCompact = subCount > 11;

  const containerPadding = isExtraCompact ? '5mm' : isCompact ? '6.5mm' : '8mm';
  const sectionGap = isExtraCompact ? 'space-y-2' : isCompact ? 'space-y-3' : 'space-y-4';

  return (
    <div
      className={`w-full bg-white text-zinc-900 font-serif relative flex flex-col ${sectionGap}`}
      style={{
        padding: containerPadding,
        boxSizing: 'border-box',
        border: '6px double #18181b',
        borderRadius: '4px',
        minHeight: '100%'
      }}
    >
      {/* Header Block */}
      <div className="text-center border-b-2 border-zinc-900 pb-4 mb-6">
        <div className="flex justify-center mb-2">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-full border-2 border-zinc-900 flex items-center justify-center font-bold text-xl">
              {school.name.charAt(0)}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight font-display text-zinc-900 leading-tight">
          {school.name}
        </h1>
        <p className="text-xs font-sans text-zinc-600 mt-0.5">
          {school.address}
        </p>
        <div className="inline-block border-y border-zinc-800 py-1 px-4 mt-2 font-sans font-bold text-xs uppercase tracking-widest text-zinc-900">
          {exam.is_final_session_report ? 'FINAL ACADEMIC REPORT CARD' : 'ACADEMIC PERFORMANCE REPORT'} ({academic_year.name})
        </div>
      </div>

      {/* Student Details Grid */}
      <table className="w-full text-xs font-sans border border-zinc-400 border-collapse mb-6">
        <tbody>
          <tr className="border-b border-zinc-300">
            <td className="p-2 border-r border-zinc-300 font-bold bg-zinc-100 w-1/6">Student Name</td>
            <td className="p-2 border-r border-zinc-300 font-bold uppercase text-zinc-900 w-2/6">{student.name}</td>
            <td className="p-2 border-r border-zinc-300 font-bold bg-zinc-100 w-1/6">Roll No</td>
            <td className="p-2 font-mono font-bold w-2/6">{student.roll_no}</td>
          </tr>
          <tr className="border-b border-zinc-300">
            <td className="p-2 border-r border-zinc-300 font-bold bg-zinc-100">Admission No</td>
            <td className="p-2 border-r border-zinc-300 font-mono">{student.admission_no}</td>
            <td className="p-2 border-r border-zinc-300 font-bold bg-zinc-100">Class & Sec</td>
            <td className="p-2 font-bold">{student.class_name} {student.section ? `(${student.section})` : ''}</td>
          </tr>
          <tr>
            <td className="p-2 border-r border-zinc-300 font-bold bg-zinc-100">Father's Name</td>
            <td className="p-2 border-r border-zinc-300">{student.father_name}</td>
            <td className="p-2 border-r border-zinc-300 font-bold bg-zinc-100">Date of Birth</td>
            <td className="p-2 font-mono">{student.dob}</td>
          </tr>
        </tbody>
      </table>

      {/* Scholastic Achievements Table */}
      <div className="mb-6 font-sans">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-400 pb-1 mb-2">
          Part 1: Scholastic Performance ({exam.name})
        </h3>
        
        {exam.is_final_session_report ? (
          <table className="w-full text-xs border border-zinc-800 border-collapse">
            <thead>
              <tr className="bg-zinc-800 text-white font-bold uppercase text-[9px]">
                <th rowSpan={2} className="p-2 text-left border-r border-zinc-700">Subject</th>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <th key={exName} colSpan={2} className="p-1 text-center border-r border-zinc-700">{exName}</th>
                ))}
                <th colSpan={2} className="p-1 text-center border-r border-zinc-700">Grand Total</th>
                <th rowSpan={2} className="p-2 text-center">Grade</th>
              </tr>
              <tr className="bg-zinc-700 text-white font-bold uppercase text-[8px]">
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <th className="p-1 text-center border-r border-zinc-600">M.M.</th>
                    <th className="p-1 text-center border-r border-zinc-600">Obt.</th>
                  </React.Fragment>
                ))}
                <th className="p-1 text-center border-r border-zinc-600">Max</th>
                <th className="p-1 text-center border-r border-zinc-600">Obt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {subjects.map((s, idx) => (
                <tr key={idx} className="border-b border-zinc-300">
                  <td className="p-1.5 border-r border-zinc-300 font-bold text-zinc-900">{s.subject_name}</td>
                  {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                    <React.Fragment key={exName}>
                      <td className="p-1.5 text-center border-r border-zinc-300 font-mono text-[11px]">{s.exam_scores?.[exName]?.max_marks || 100}</td>
                      <td className="p-1.5 text-center border-r border-zinc-300 font-mono font-bold text-[11px]">{s.exam_scores?.[exName]?.marks_obtained ?? '—'}</td>
                    </React.Fragment>
                  ))}
                  <td className="p-1.5 text-center border-r border-zinc-300 font-mono font-bold text-zinc-700 text-[11px]">{s.grand_total_max || s.max_marks}</td>
                  <td className="p-1.5 text-center border-r border-zinc-300 font-mono font-black text-zinc-900 text-[11px]">{s.grand_total_obtained || s.marks_obtained}</td>
                  <td className="p-1.5 text-center font-black text-xs">{s.grade}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-800 text-xs">
                <td className="p-2 border-r border-zinc-300">Grand Total</td>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <td className="p-2 text-center border-r border-zinc-300 font-mono">{data.exam_totals?.[exName]?.max_marks || 700}</td>
                    <td className="p-2 text-center border-r border-zinc-300 font-mono font-black">{data.exam_totals?.[exName]?.marks_obtained || 500}</td>
                  </React.Fragment>
                ))}
                <td className="p-2 text-center border-r border-zinc-300 font-mono font-bold">{summary.total_max}</td>
                <td className="p-2 text-center border-r border-zinc-300 font-mono font-black text-sm">{summary.total_obtained}</td>
                <td className="p-2 text-center font-black text-sm">{summary.grade}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-xs border border-zinc-800 border-collapse">
            <thead>
              <tr className="bg-zinc-800 text-white font-bold uppercase text-[10px]">
                <th className="p-2 text-left border-r border-zinc-700">Subject</th>
                <th className="p-2 text-center border-r border-zinc-700 w-24">Max Marks</th>
                <th className="p-2 text-center border-r border-zinc-700 w-24">Pass Marks</th>
                <th className="p-2 text-center border-r border-zinc-700 w-28">Marks Obtained</th>
                <th className="p-2 text-center border-r border-zinc-700 w-20">Grade</th>
                <th className="p-2 text-center w-24">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {subjects.map((s, idx) => (
                <tr key={idx} className="border-b border-zinc-300">
                  <td className="p-2 border-r border-zinc-300 font-bold text-zinc-900">{s.subject_name}</td>
                  <td className="p-2 text-center border-r border-zinc-300 font-mono">{s.max_marks}</td>
                  <td className="p-2 text-center border-r border-zinc-300 font-mono text-zinc-600">{s.passing_marks}</td>
                  <td className="p-2 text-center border-r border-zinc-300 font-mono font-bold text-zinc-900">{s.marks_obtained}</td>
                  <td className="p-2 text-center border-r border-zinc-300 font-bold">{s.grade}</td>
                  <td className="p-2 text-center font-bold text-[10px] uppercase">{s.result}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-800 text-xs">
                <td className="p-2.5 border-r border-zinc-300">Grand Total</td>
                <td className="p-2.5 text-center border-r border-zinc-300 font-mono">{summary.total_max}</td>
                <td className="p-2.5 text-center border-r border-zinc-300">—</td>
                <td className="p-2.5 text-center border-r border-zinc-300 font-mono font-black text-sm">{summary.total_obtained}</td>
                <td className="p-2.5 text-center border-r border-zinc-300 font-black text-sm">{summary.grade}</td>
                <td className="p-2.5 text-center font-black text-xs">{summary.result}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Teacher Remarks (Rendered ONLY if non-empty remark exists) */}
      {Boolean(summary.teacher_remark && summary.teacher_remark.toString().trim() !== '') && (
        <div className="px-1 font-sans text-xs text-zinc-800 leading-normal">
          <strong className="font-bold text-zinc-900">Teacher Remarks:</strong>{' '}
          <span className="font-normal text-zinc-800">{summary.teacher_remark}</span>
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
          <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">Total Marks</span>
            <span className="text-xs font-black text-emerald-950 font-mono mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">Percentage</span>
            <span className="text-xs font-black text-amber-950 font-mono mt-0.5">{summary.percentage}%</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">Overall Grade</span>
            <span className="text-xs font-black text-emerald-950 font-mono mt-0.5">Grade {summary.grade}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 block">Attendance</span>
            <span className="text-xs font-black text-amber-950 font-mono mt-0.5">{summary.attendance?.attendance_rate ?? 90.3}%</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 block">Class Rank</span>
            <span className="text-xs font-black text-emerald-950 font-mono mt-0.5">{summary.class_rank}</span>
          </div>
        </div>

        {/* Signatures. Gaps are in mm so the clear area survives print scaling. */}
        <div
          className="pb-1 font-sans flex justify-between items-end text-xs font-bold text-zinc-800 px-6"
          style={{ marginTop: SIGNATURE_GAP }}
        >
          <div className="flex flex-col items-center">
            <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
            <div className="w-40 border-b border-zinc-800 mb-2" />
            <span className="uppercase text-[10px] font-black tracking-wider text-zinc-800">Class Teacher Signature</span>
          </div>
          <div className="flex flex-col items-center">
            <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
            <div className="w-40 border-b border-zinc-800 mb-2" />
            <span className="uppercase text-[10px] font-black tracking-wider text-zinc-800">Principal Signature & Stamp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
