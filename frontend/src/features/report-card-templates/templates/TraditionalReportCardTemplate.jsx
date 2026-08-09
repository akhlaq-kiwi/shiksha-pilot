import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE } from '../reportCardLayout';

/**
 * Template 3: Traditional School Format Report Card
 * Vintage certificate style layout inspired by traditional school marksheets with decorative border and result seal.
 */
export default function TraditionalReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  // Dynamic layout density scaling based on subject count (inline styles for guaranteed rendering)
  const subCount = subjects?.length || 0;

  let cellPadding = '10px 14px';
  let headerPadding = '10px 14px';
  let fontSizePx = '12px';
  let containerPadding = '8mm';
  let innerPaddingPx = '20px';
  let sectionGapPx = '16px';
  let metaPadding = '8px 12px';

  if (subCount <= 4) {
    // 4 or fewer subjects: Generously expanded rows, text & vertical spacing
    cellPadding = '26px 14px';
    headerPadding = '18px 14px';
    fontSizePx = '14px';
    containerPadding = '9.5mm';
    innerPaddingPx = '24px';
    sectionGapPx = '28px';
    metaPadding = '14px 14px';
  } else if (subCount === 5) {
    // 5 subjects: Expanded rows & padding to fill vertical space
    cellPadding = '22px 14px';
    headerPadding = '16px 14px';
    fontSizePx = '13.5px';
    containerPadding = '9mm';
    innerPaddingPx = '22px';
    sectionGapPx = '24px';
    metaPadding = '12px 14px';
  } else if (subCount === 6) {
    // 6 subjects: Taller rows & padding to eliminate large white space gap
    cellPadding = '18px 14px';
    headerPadding = '14px 14px';
    fontSizePx = '13px';
    containerPadding = '8.5mm';
    innerPaddingPx = '20px';
    sectionGapPx = '22px';
    metaPadding = '10px 12px';
  } else if (subCount === 7) {
    // 7 subjects: Comfortably padded rows
    cellPadding = '14px 14px';
    headerPadding = '12px 14px';
    fontSizePx = '12.5px';
    containerPadding = '8mm';
    innerPaddingPx = '18px';
    sectionGapPx = '18px';
    metaPadding = '10px 12px';
  } else if (subCount <= 9) {
    // 8–9 subjects (Default 8): Standard table padding
    cellPadding = '10px 14px';
    headerPadding = '10px 14px';
    fontSizePx = '12px';
    containerPadding = '7.5mm';
    innerPaddingPx = '16px';
    sectionGapPx = '16px';
    metaPadding = '8px 12px';
  } else if (subCount <= 11) {
    // 10–11 subjects: Compact table padding
    cellPadding = '6px 10px';
    headerPadding = '6px 10px';
    fontSizePx = '11.5px';
    containerPadding = '6mm';
    innerPaddingPx = '14px';
    sectionGapPx = '12px';
    metaPadding = '6px 10px';
  } else {
    // 12+ subjects: Extra compact table padding
    cellPadding = '4px 8px';
    headerPadding = '4px 8px';
    fontSizePx = '11px';
    containerPadding = '4.5mm';
    innerPaddingPx = '12px';
    sectionGapPx = '8px';
    metaPadding = '5px 8px';
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
      {/* Decorative Outer Border */}
      <div className="border border-zinc-900 flex-1 flex flex-col" style={{ padding: innerPaddingPx, gap: sectionGapPx, boxSizing: 'border-box' }}>
        <div>
          {/* Header */}
          <div className="text-center border-b-2 border-zinc-900 pb-4 mb-4">
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
            <div className="mt-2 text-sm font-bold uppercase tracking-widest text-zinc-900 border-t border-b border-zinc-900 inline-block px-6 py-1">
              {exam.is_final_session_report ? 'FINAL ACADEMIC REPORT CARD' : 'PROGRESS REPORT CARD'}
            </div>
            <p className="text-xs font-sans font-bold text-zinc-600 mt-1">
              {exam.name} — Academic Session: {academic_year.name}
            </p>
          </div>

          {/* Student Info Box */}
          <div className="border border-zinc-900 bg-white text-xs font-sans grid grid-cols-3 gap-y-3 gap-x-4 mb-4" style={{ padding: metaPadding }}>
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
          <div className="font-sans">
            {exam.is_final_session_report ? (
              <table className="w-full border border-zinc-900 border-collapse text-zinc-900" style={{ fontSize: fontSizePx }}>
                <thead>
                  <tr className="bg-zinc-950 text-white font-bold uppercase text-[9.5px] tracking-wide">
                    <th rowSpan={2} style={{ padding: headerPadding }} className="text-left border-r border-zinc-800">Subject</th>
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <th key={exName} colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-zinc-800">{exName}</th>
                    ))}
                    <th colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-zinc-800">Grand Total</th>
                    <th rowSpan={2} style={{ padding: headerPadding }} className="text-center">Grade</th>
                  </tr>
                  <tr className="bg-zinc-900 text-white font-bold uppercase text-[8.5px]">
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <React.Fragment key={exName}>
                        <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800">M.M.</th>
                        <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800">Obt.</th>
                      </React.Fragment>
                    ))}
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800">Max</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800">Obt.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-300">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                      <td style={{ padding: cellPadding }} className="border-r border-zinc-900 font-bold text-zinc-900">{sub.subject_name}</td>
                      {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => {
                        const score = sub.exam_scores?.[exName];
                        return (
                          <React.Fragment key={exName}>
                            <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono text-[11px]">
                              {score ? score.max_marks : '—'}
                            </td>
                            <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold text-[11px]">
                              {score ? score.marks_obtained : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold text-zinc-700 text-[11px]">{sub.grand_total_max ?? sub.max_marks ?? '—'}</td>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold text-zinc-900 text-[11px]">{sub.grand_total_obtained ?? sub.marks_obtained ?? '—'}</td>
                      <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{sub.grade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-900">
                    <td style={{ padding: cellPadding }} className="border-r border-zinc-900">Grand Total</td>
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <React.Fragment key={exName}>
                        <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono">{data.exam_totals?.[exName]?.max_marks ?? 0}</td>
                        <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold">{data.exam_totals?.[exName]?.marks_obtained ?? 0}</td>
                      </React.Fragment>
                    ))}
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold">{summary.total_max ?? '—'}</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold text-sm text-zinc-950">{summary.total_obtained ?? '—'}</td>
                    <td style={{ padding: cellPadding }} className="text-center font-bold text-sm">{summary.grade || '—'}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="w-full border border-zinc-900 border-collapse text-zinc-900" style={{ fontSize: fontSizePx }}>
                <thead>
                  <tr className="bg-zinc-950 text-white font-bold uppercase text-[11px] tracking-wide">
                    <th style={{ padding: headerPadding }} className="text-left border-r border-zinc-800">Subject</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800 w-24">Max Marks</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800 w-24">Min Pass</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800 w-28">Marks Obtained</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-800 w-20">Grade</th>
                    <th style={{ padding: headerPadding }} className="text-center w-24">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                      <td style={{ padding: cellPadding }} className="border-r border-zinc-900 font-bold text-zinc-900">{sub.subject_name}</td>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono">{sub.max_marks}</td>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono text-zinc-600">{sub.passing_marks}</td>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold text-zinc-950">{sub.marks_obtained}</td>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-bold">{sub.grade}</td>
                      <td style={{ padding: cellPadding }} className="text-center font-bold text-[11px] uppercase">
                        <span className={sub.result === 'PASS' ? 'text-zinc-900 font-bold' : 'text-red-700 font-bold'}>
                          {sub.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-900">
                    <td style={{ padding: cellPadding }} className="border-r border-zinc-900">Grand Total</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono">{summary.total_max}</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono text-zinc-600">—</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-mono font-bold text-sm text-zinc-950">{summary.total_obtained}</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-900 font-bold text-sm">{summary.grade}</td>
                    <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{summary.result}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Performance Summary Cards (5 columns) - Locked at a CONSTANT 10px gap below table */}
        <div className="grid grid-cols-5 gap-2 font-sans" style={{ marginTop: '10px' }}>
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

        {/* Dual Signatures pinned to the bottom of the page */}
        <div
          className="pb-1 font-sans flex justify-between items-end text-xs font-bold text-zinc-900 px-6"
          style={{ marginTop: 'auto' }}
        >
          <div className="inline-flex flex-col items-center">
            <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
            <div className="w-full border-b border-zinc-900 mb-1.5" />
            <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-950 whitespace-nowrap">Class Teacher Signature</span>
          </div>
          <div className="inline-flex flex-col items-center">
            <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
            <div className="w-full border-b border-zinc-900 mb-1.5" />
            <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-950 whitespace-nowrap">Principal Signature & Stamp</span>
          </div>
        </div>
      </div>
    </div>
  );
}
