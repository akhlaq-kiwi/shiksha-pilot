import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE } from '../reportCardLayout';

/**
 * Template 3: Traditional School Format Report Card
 * Vintage certificate style layout inspired by traditional school marksheets with decorative border and result seal.
 */
export default function TraditionalReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  const subCount = subjects?.length || 0;

  let cellPy = 'p-2.5';
  let headerPy = 'p-2.5';
  let tableFontSize = 'text-xs';
  let containerPadding = '8mm';
  let innerPadding = 'p-5';

  if (subCount <= 4) {
    // 4 or fewer subjects: Generously expanded rows & vertical spacing
    cellPy = 'p-5';
    headerPy = 'p-4';
    tableFontSize = 'text-sm';
    containerPadding = '9.5mm';
    innerPadding = 'p-6';
  } else if (subCount === 5) {
    // 5 subjects: Expanded rows & padding to fill vertical space
    cellPy = 'p-4.5';
    headerPy = 'p-3.5';
    tableFontSize = 'text-xs font-semibold';
    containerPadding = '9mm';
    innerPadding = 'p-5.5';
  } else if (subCount === 6) {
    // 6 subjects: Taller rows & padding to eliminate large blank gap
    cellPy = 'p-4';
    headerPy = 'p-3.5';
    tableFontSize = 'text-xs font-semibold';
    containerPadding = '8.5mm';
    innerPadding = 'p-5';
  } else if (subCount === 7) {
    // 7 subjects: Comfortably padded rows
    cellPy = 'p-3';
    headerPy = 'p-3';
    containerPadding = '8mm';
    innerPadding = 'p-4.5';
  } else if (subCount <= 9) {
    // 8–9 subjects (Default 8): Standard table padding
    cellPy = 'p-2.5';
    headerPy = 'p-2.5';
    containerPadding = '7.5mm';
    innerPadding = 'p-4.5';
  } else if (subCount <= 11) {
    // 10–11 subjects: Compact table padding
    cellPy = 'p-1.5';
    headerPy = 'p-1.5';
    containerPadding = '6mm';
    innerPadding = 'p-4';
  } else {
    // 12+ subjects: Extra compact table padding
    cellPy = 'p-1';
    headerPy = 'p-1';
    tableFontSize = 'text-[11px]';
    containerPadding = '4.5mm';
    innerPadding = 'p-3';
  }

  return (
    <div
      className="w-full bg-amber-50/20 text-zinc-900 font-serif relative h-full flex flex-col"
      style={{
        padding: containerPadding,
        boxSizing: 'border-box',
        border: '8px double #1e3a8a',
        borderRadius: '2px',
        minHeight: '100%'
      }}
    >
      {/* Decorative Outer Border. flex-1 (not h-full) so it fills the card's
          min-height — h-full resolves to auto against a parent that only has a
          min-height, which would leave the footer riding up under the table. */}
      <div className={`border border-zinc-900 ${innerPadding} flex-1 flex flex-col`} style={{ boxSizing: 'border-box' }}>
        <div>
          {/* Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-5 mb-6">
            <div className="flex justify-center mb-2">
              {school.logo_path ? (
                <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain" />
              ) : (
                <div className="h-16 w-16 rounded-full border-2 border-zinc-900 bg-zinc-900 text-white flex items-center justify-center font-bold text-2xl">
                  {school.name.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-zinc-950 font-display">
              {school.name}
            </h1>
            <p className="text-xs text-zinc-700 italic mt-0.5">
              {school.address}
            </p>
            <div className="mt-3 text-sm font-bold uppercase tracking-widest text-zinc-900 border-t border-b border-zinc-900 inline-block px-6 py-1">
              {exam.is_final_session_report ? 'FINAL ACADEMIC REPORT CARD' : 'PROGRESS REPORT CARD'}
            </div>
            <p className="text-xs font-sans font-bold text-zinc-600 mt-1">
              {exam.name} — Academic Session: {academic_year.name}
            </p>
          </div>

          {/* Student Info Box */}
          <div className="border border-zinc-900 bg-white p-4 mb-6 text-xs font-sans grid grid-cols-3 gap-y-3 gap-x-4">
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase block">Student Name</span>
              <strong className="text-zinc-950 font-bold text-sm uppercase">{student.name}</strong>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase block">Class & Section</span>
              <strong className="text-zinc-900 text-sm font-bold">{student.class_name} {student.section ? `(${student.section})` : ''}</strong>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase block">Roll Number</span>
              <strong className="text-zinc-900 text-sm font-mono font-bold">{student.roll_no}</strong>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase block">Father's Name</span>
              <span className="text-zinc-800">{student.father_name}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase block">Mother's Name</span>
              <span className="text-zinc-800">{student.mother_name}</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase block">Admission / SR No</span>
              <span className="text-zinc-800 font-mono">{student.admission_no}</span>
            </div>
          </div>

          {/* Traditional Marks Table */}
          <div className="mb-6 font-sans">
            {exam.is_final_session_report ? (
              <table className="w-full text-xs border border-zinc-900 border-collapse text-zinc-900">
                <thead>
                  <tr className="bg-zinc-950 text-white font-bold uppercase text-[9.5px] tracking-wide">
                    <th rowSpan={2} className="p-2 text-left border-r border-zinc-800">Subject</th>
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <th key={exName} colSpan={2} className="p-1 text-center border-r border-zinc-800">{exName}</th>
                    ))}
                    <th colSpan={2} className="p-1 text-center border-r border-zinc-800">Grand Total</th>
                    <th rowSpan={2} className="p-2 text-center">Grade</th>
                  </tr>
                  <tr className="bg-zinc-900 text-white font-bold uppercase text-[8.5px]">
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <React.Fragment key={exName}>
                        <th className="p-1 text-center border-r border-zinc-700">M.M.</th>
                        <th className="p-1 text-center border-r border-zinc-700">Obt.</th>
                      </React.Fragment>
                    ))}
                    <th className="p-1 text-center border-r border-zinc-700">Max</th>
                    <th className="p-1 text-center border-r border-zinc-700">Obt.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                      <td className="p-2 border-r border-zinc-900 font-bold text-zinc-900">{sub.subject_name}</td>
                      {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                        <React.Fragment key={exName}>
                          <td className="p-2 text-center border-r border-zinc-900 font-mono text-[11px]">{sub.exam_scores?.[exName]?.max_marks || 100}</td>
                          <td className="p-2 text-center border-r border-zinc-900 font-mono font-bold text-[11px] text-zinc-950">{sub.exam_scores?.[exName]?.marks_obtained ?? '—'}</td>
                        </React.Fragment>
                      ))}
                      <td className="p-2 text-center border-r border-zinc-900 font-mono font-bold text-zinc-700 text-[11px]">{sub.grand_total_max || sub.max_marks}</td>
                      <td className="p-2 text-center border-r border-zinc-900 font-mono font-bold text-zinc-950 text-[11px]">{sub.grand_total_obtained || sub.marks_obtained}</td>
                      <td className="p-2 text-center font-bold text-xs">{sub.grade}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-900 text-xs">
                    <td className="p-2.5 border-r border-zinc-900">Grand Total</td>
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <React.Fragment key={exName}>
                        <td className="p-2 text-center border-r border-zinc-900 font-mono">{data.exam_totals?.[exName]?.max_marks || 700}</td>
                        <td className="p-2 text-center border-r border-zinc-900 font-mono font-bold">{data.exam_totals?.[exName]?.marks_obtained || 500}</td>
                      </React.Fragment>
                    ))}
                    <td className="p-2 text-center border-r border-zinc-900 font-mono font-bold">{summary.total_max}</td>
                    <td className="p-2 text-center border-r border-zinc-900 font-mono font-bold text-sm text-zinc-950">{summary.total_obtained}</td>
                    <td className="p-2 text-center font-bold text-sm">{summary.grade}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className={`w-full ${tableFontSize} border border-zinc-900 border-collapse text-zinc-900`}>
                <thead>
                  <tr className="bg-zinc-950 text-white font-bold uppercase text-[11px] tracking-wide">
                    <th className={`${headerPy} text-left border-r border-zinc-800`}>Subject</th>
                    <th className={`${headerPy} text-center border-r border-zinc-800 w-24`}>Max Marks</th>
                    <th className={`${headerPy} text-center border-r border-zinc-800 w-24`}>Min Pass</th>
                    <th className={`${headerPy} text-center border-r border-zinc-800 w-28`}>Marks Obtained</th>
                    <th className={`${headerPy} text-center border-r border-zinc-800 w-20`}>Grade</th>
                    <th className={`${headerPy} text-center w-24`}>Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                      <td className={`${cellPy} border-r border-zinc-900 font-bold text-zinc-900`}>{sub.subject_name}</td>
                      <td className={`${cellPy} text-center border-r border-zinc-900 font-mono`}>{sub.max_marks}</td>
                      <td className={`${cellPy} text-center border-r border-zinc-900 font-mono text-zinc-600`}>{sub.passing_marks}</td>
                      <td className={`${cellPy} text-center border-r border-zinc-900 font-mono font-bold text-zinc-950`}>{sub.marks_obtained}</td>
                      <td className={`${cellPy} text-center border-r border-zinc-900 font-bold`}>{sub.grade}</td>
                      <td className={`${cellPy} text-center font-bold text-[11px] uppercase`}>
                        <span className={sub.result === 'PASS' ? 'text-zinc-900 font-bold' : 'text-red-700 font-bold'}>
                          {sub.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-900 text-xs">
                    <td className={`${cellPy} border-r border-zinc-900`}>Grand Total</td>
                    <td className={`${cellPy} text-center border-r border-zinc-900 font-mono`}>{summary.total_max}</td>
                    <td className={`${cellPy} text-center border-r border-zinc-900 font-mono text-zinc-600`}>—</td>
                    <td className={`${cellPy} text-center border-r border-zinc-900 font-mono font-bold text-sm text-zinc-950`}>{summary.total_obtained}</td>
                    <td className={`${cellPy} text-center border-r border-zinc-900 font-bold text-sm`}>{summary.grade}</td>
                    <td className={`${cellPy} text-center font-bold text-xs`}>{summary.result}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Teacher Remarks (Rendered ONLY if non-empty remark exists) */}
          {Boolean(summary.teacher_remark && summary.teacher_remark.toString().trim() !== '') && (
            <div className="px-1 font-sans text-xs text-zinc-900 leading-normal mb-2">
              <strong className="font-bold text-zinc-950">Teacher Remarks:</strong>{' '}
              <span className="font-normal text-zinc-800">{summary.teacher_remark}</span>
            </div>
          )}
        </div>

        {/* Footer block: performance summary sits directly above the signatures,
            both pinned to the bottom of the page. */}
        {/* marginTop is inline rather than the mt-auto utility, so it cannot be
            outweighed by a more specific spacing rule on the parent. */}
        <div style={{ marginTop: 'auto' }}>
          {/* Performance Summary Cards (5 columns) */}
          <div className="grid grid-cols-5 gap-2 font-sans">
            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Total Marks</span>
              <span className="text-xs font-bold font-mono text-emerald-950 mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">Percentage</span>
              <span className="text-xs font-bold font-mono text-amber-950 mt-0.5">{summary.percentage}%</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Overall Grade</span>
              <span className="text-xs font-bold text-emerald-950 mt-0.5">Grade {summary.grade}</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">Attendance</span>
              <span className="text-xs font-bold font-mono text-amber-950 mt-0.5">{summary.attendance?.attendance_rate ?? 90.3}%</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Class Rank</span>
              <span className="text-xs font-bold font-mono text-emerald-950 mt-0.5">{summary.class_rank || '1st'}</span>
            </div>
          </div>

          {/* Traditional Signatures. Gaps are in mm so the clear area survives print scaling. */}
          <div
            className="pt-4 pb-1 font-sans border-t border-zinc-900 flex justify-between items-end text-xs font-bold text-zinc-950 px-6"
            style={{ marginTop: SIGNATURE_GAP }}
          >
            <div className="flex flex-col items-center">
              <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
              <div className="w-40 border-b border-zinc-900 mb-2" />
              <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-950">Class Teacher Signature</span>
            </div>
            <div className="flex flex-col items-center">
              <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
              <div className="w-40 border-b border-zinc-900 mb-2" />
              <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-950">Principal Signature & Stamp</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
