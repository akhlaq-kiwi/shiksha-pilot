import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE } from '../reportCardLayout';

/**
 * Template 2: Classic CBSE Style Report Card
 * Features formal double border, term-wise breakdown, scholastic areas, grade point scale, and 2-signature layout.
 */
export default function ClassicCBSEReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  // Dynamic layout density scaling based on subject count (inline styles for guaranteed rendering)
  const subCount = subjects?.length || 0;

  let cellPadding = '10px 14px';
  let headerPadding = '10px 14px';
  let fontSizePx = '12px';
  let containerPadding = '8mm';
  let sectionGapPx = '16px';
  let metaPadding = '8px 12px';

  if (subCount <= 4) {
    // 4 or fewer subjects: Generously expanded rows, text & vertical spacing
    cellPadding = '26px 14px';
    headerPadding = '18px 14px';
    fontSizePx = '14px';
    containerPadding = '9.5mm';
    sectionGapPx = '28px';
    metaPadding = '14px 14px';
  } else if (subCount === 5) {
    // 5 subjects: Expanded rows & padding to fill vertical space
    cellPadding = '22px 14px';
    headerPadding = '16px 14px';
    fontSizePx = '13.5px';
    containerPadding = '9mm';
    sectionGapPx = '24px';
    metaPadding = '12px 14px';
  } else if (subCount === 6) {
    // 6 subjects: Taller rows & padding to eliminate large white space gap
    cellPadding = '18px 14px';
    headerPadding = '14px 14px';
    fontSizePx = '13px';
    containerPadding = '8.5mm';
    sectionGapPx = '22px';
    metaPadding = '10px 12px';
  } else if (subCount === 7) {
    // 7 subjects: Comfortably padded rows
    cellPadding = '14px 14px';
    headerPadding = '12px 14px';
    fontSizePx = '12.5px';
    containerPadding = '8mm';
    sectionGapPx = '18px';
    metaPadding = '10px 12px';
  } else if (subCount <= 9) {
    // 8–9 subjects (Default 8): Standard table padding
    cellPadding = '10px 14px';
    headerPadding = '10px 14px';
    fontSizePx = '12px';
    containerPadding = '7.5mm';
    sectionGapPx = '16px';
    metaPadding = '8px 12px';
  } else if (subCount <= 11) {
    // 10–11 subjects: Compact table padding
    cellPadding = '6px 10px';
    headerPadding = '6px 10px';
    fontSizePx = '11.5px';
    containerPadding = '6mm';
    sectionGapPx = '12px';
    metaPadding = '6px 10px';
  } else {
    // 12+ subjects: Extra compact table padding
    cellPadding = '4px 8px';
    headerPadding = '4px 8px';
    fontSizePx = '11px';
    containerPadding = '4.5mm';
    sectionGapPx = '8px';
    metaPadding = '5px 8px';
  }

  return (
    <div
      className="w-full bg-white text-zinc-900 font-serif relative flex flex-col"
      style={{
        padding: containerPadding,
        gap: sectionGapPx,
        boxSizing: 'border-box',
        border: '6px double #18181b',
        borderRadius: '4px',
        minHeight: '100%'
      }}
    >
      {/* Header Block */}
      <div className="text-center border-b-2 border-zinc-900 pb-4 mb-2">
        <div className="flex justify-center mb-2">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-full border-2 border-zinc-900 flex items-center justify-center font-bold text-xl">
              {school.name.charAt(0)}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-tight font-display text-zinc-900 leading-tight">
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
      <table className="w-full text-xs font-sans border border-zinc-400 border-collapse">
        <tbody>
          <tr className="border-b border-zinc-300">
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 w-1/6">Student Name</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold uppercase text-zinc-900 w-2/6">{student.name}</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 w-1/6">Roll No</td>
            <td style={{ padding: metaPadding }} className="font-mono font-bold w-2/6">{student.roll_no}</td>
          </tr>
          <tr className="border-b border-zinc-300">
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100">Admission No</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-mono">{student.admission_no}</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100">Class & Sec</td>
            <td style={{ padding: metaPadding }} className="font-bold">{student.class_name} {student.section ? `(${student.section})` : ''}</td>
          </tr>
          <tr>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100">Father's Name</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300">{student.father_name}</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100">Date of Birth</td>
            <td style={{ padding: metaPadding }} className="font-mono">{student.dob}</td>
          </tr>
        </tbody>
      </table>

      {/* Scholastic Achievements Table */}
      <div className="font-sans">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 border-b border-zinc-400 pb-1 mb-2">
          Part 1: Scholastic Performance ({exam.name})
        </h3>
        
        {exam.is_final_session_report ? (
          <table className="w-full border border-zinc-800 border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-zinc-800 text-white font-bold uppercase text-[11px]">
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-left border-r border-zinc-700">Subject</th>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <th key={exName} colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-zinc-700">{exName}</th>
                ))}
                <th colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-zinc-700">Grand Total</th>
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-center">Grade</th>
              </tr>
              <tr className="bg-zinc-700 text-white font-bold uppercase text-[8px]">
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-600">M.M.</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-600">Obt.</th>
                  </React.Fragment>
                ))}
                <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-600">Max</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-600">Obt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {subjects.map((s, idx) => (
                <tr key={idx} className="border-b border-zinc-300">
                  <td style={{ padding: cellPadding }} className="border-r border-zinc-300 font-bold text-zinc-900">{s.subject_name}</td>
                  {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => {
                    const score = s.exam_scores?.[exName];
                    return (
                      <React.Fragment key={exName}>
                        <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono text-[11px]">
                          {score ? score.max_marks : '—'}
                        </td>
                        <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-[11px]">
                          {score ? score.marks_obtained : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-zinc-700 text-[11px]">{s.grand_total_max ?? s.max_marks ?? '—'}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-zinc-900 text-[11px]">{s.grand_total_obtained ?? s.marks_obtained ?? '—'}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{s.grade || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-800">
                <td style={{ padding: cellPadding }} className="border-r border-zinc-300">Grand Total</td>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono">{data.exam_totals?.[exName]?.max_marks ?? 0}</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold">{data.exam_totals?.[exName]?.marks_obtained ?? 0}</td>
                  </React.Fragment>
                ))}
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold">{summary.total_max ?? '—'}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-sm">{summary.total_obtained ?? '—'}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold text-sm">{summary.grade || '—'}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full border border-zinc-800 border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-zinc-800 text-white font-bold uppercase text-[11px]">
                <th style={{ padding: headerPadding }} className="text-left border-r border-zinc-700">Subject</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-700 w-24">Max Marks</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-700 w-24">Pass Marks</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-700 w-28">Marks Obtained</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-zinc-700 w-20">Grade</th>
                <th style={{ padding: headerPadding }} className="text-center w-24">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {subjects.map((s, idx) => (
                <tr key={idx} className="border-b border-zinc-300">
                  <td style={{ padding: cellPadding }} className="border-r border-zinc-300 font-bold text-zinc-900">{s.subject_name}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono">{s.max_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono text-zinc-600">{s.passing_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-zinc-900">{s.marks_obtained}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-bold">{s.grade}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-[11px] uppercase">{s.result}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-800">
                <td style={{ padding: cellPadding }} className="border-r border-zinc-300">Grand Total</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono">{summary.total_max}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300">—</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-sm">{summary.total_obtained}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-bold text-sm">{summary.grade}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{summary.result}</td>
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

      {/* Performance Summary Cards (5 columns) - Locked at a CONSTANT 10px gap below table */}
      <div className="grid grid-cols-5 gap-2 font-sans" style={{ marginTop: '10px' }}>
        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Total Marks</span>
          <span className="text-xs font-bold text-emerald-950 font-mono mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">Percentage</span>
          <span className="text-xs font-bold text-amber-950 font-mono mt-0.5">{summary.percentage}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Overall Grade</span>
          <span className="text-xs font-bold text-emerald-950 font-mono mt-0.5">Grade {summary.grade}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">Attendance</span>
          <span className="text-xs font-bold text-amber-950 font-mono mt-0.5">{summary.attendance?.attendance_rate ?? 90.3}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Class Rank</span>
          <span className="text-xs font-bold text-emerald-950 font-mono mt-0.5">{summary.class_rank}</span>
        </div>
      </div>

      {/* Signatures pinned to the bottom of the page */}
      <div
        className="pb-1 font-sans flex justify-between items-end text-xs font-bold text-zinc-800 px-6"
        style={{ marginTop: 'auto' }}
      >
        <div className="flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className="w-40 border-b border-zinc-800 mb-2" />
          <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-800">Class Teacher Signature</span>
        </div>
        <div className="flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className="w-40 border-b border-zinc-800 mb-2" />
          <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-800">Principal Signature & Stamp</span>
        </div>
      </div>
    </div>
  );
}
