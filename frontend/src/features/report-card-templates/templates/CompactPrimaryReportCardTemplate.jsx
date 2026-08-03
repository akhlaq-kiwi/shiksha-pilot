import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE } from '../reportCardLayout';

/**
 * Template 4: Compact Primary School Format Report Card
 * Single-page compact grid format designed for primary classes with key metric pill badges and dual signature layout.
 */
export default function CompactPrimaryReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const isFinalReport = exam.is_final_session_report;
  const signatures = config.signatures || ['Teacher Signature', 'Parent Signature'];

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
      className="w-full bg-white text-zinc-900 font-sans relative flex flex-col"
      style={{
        padding: containerPadding,
        gap: sectionGapPx,
        boxSizing: 'border-box',
        border: '2px solid #f59e0b',
        borderRadius: '12px',
        minHeight: '100%'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-400 pb-4">
        <div className="flex items-center gap-3">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xl">
              {school.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold uppercase text-amber-600 tracking-tight font-display">
              {school.name}
            </h1>
            <p className="text-[11px] font-bold text-zinc-500 uppercase">
              {exam.is_final_session_report ? 'Final Academic Session Report' : `Primary Progress Card — ${exam.name}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-full uppercase">
            Session: {academic_year.name}
          </span>
        </div>
      </div>

      {/* Student Details Card */}
      <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3 text-xs grid grid-cols-4 gap-3">
        <div>
          <span className="text-[10px] text-amber-800 uppercase font-bold block">Student Name</span>
          <strong className="text-zinc-900 text-xs uppercase">{student.name}</strong>
        </div>
        <div>
          <span className="text-[10px] text-amber-800 uppercase font-bold block">Class & Sec</span>
          <strong className="text-zinc-900 text-xs">{student.class_name} {student.section ? `(${student.section})` : ''}</strong>
        </div>
        <div>
          <span className="text-[10px] text-amber-800 uppercase font-bold block">Roll / SR. No</span>
          <strong className="text-zinc-900 text-xs font-mono">{student.roll_no} | {student.admission_no}</strong>
        </div>
        <div>
          <span className="text-[10px] text-amber-800 uppercase font-bold block">Date of Birth</span>
          <strong className="text-zinc-900 text-xs font-mono">{student.dob}</strong>
        </div>
      </div>

      {/* Marks Table */}
      <div className="border border-amber-200 rounded-xl overflow-hidden shadow-2xs">
        {isFinalReport ? (
          <table className="w-full text-left border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-amber-500 text-white font-bold uppercase text-[9.5px]">
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-left font-bold border-r border-amber-400 whitespace-nowrap min-w-[140px]">Subject</th>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <th key={exName} colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-amber-400">{exName}</th>
                ))}
                <th colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-amber-400">Grand Total</th>
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-center">Grade</th>
              </tr>
              <tr className="bg-amber-600 text-white font-bold uppercase text-[8.5px]">
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-amber-500">M.M.</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-amber-500">Obt.</th>
                  </React.Fragment>
                ))}
                <th style={{ padding: headerPadding }} className="text-center border-r border-amber-500">Max</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-amber-500">Obt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}>
                  <td style={{ padding: cellPadding }} className="text-left font-bold text-zinc-900 border-r border-amber-100 whitespace-nowrap">{sub.subject_name}</td>
                  {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                    <React.Fragment key={exName}>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-amber-100 font-mono text-zinc-600">{sub.exam_scores?.[exName]?.max_marks || 100}</td>
                      <td style={{ padding: cellPadding }} className="text-center border-r border-amber-100 font-mono font-bold text-amber-800">{sub.exam_scores?.[exName]?.marks_obtained ?? '—'}</td>
                    </React.Fragment>
                  ))}
                  <td style={{ padding: cellPadding }} className="text-center border-r border-amber-100 font-mono font-bold text-zinc-700">{sub.grand_total_max || sub.max_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-amber-100 font-mono font-bold text-amber-900">{sub.grand_total_obtained || sub.marks_obtained}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-amber-900">{sub.grade}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-amber-100 border-t-2 border-amber-500 font-bold text-amber-950">
                <td style={{ padding: cellPadding }} className="text-left border-r border-amber-200 whitespace-nowrap font-bold">Total Marks</td>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-amber-200 font-mono">{data.exam_totals?.[exName]?.max_marks || 700}</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-amber-200 font-mono font-bold text-amber-950">{data.exam_totals?.[exName]?.marks_obtained || 500}</td>
                  </React.Fragment>
                ))}
                <td style={{ padding: cellPadding }} className="text-center border-r border-amber-200 font-mono font-bold">{summary.total_max}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-amber-200 font-mono font-bold text-amber-950">{summary.total_obtained}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold">{summary.grade}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-left border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-amber-500 text-white font-bold uppercase text-[11px]">
                <th style={{ padding: headerPadding }}>Subject</th>
                <th style={{ padding: headerPadding }} className="text-center w-24">Marks Obtained</th>
                <th style={{ padding: headerPadding }} className="text-center w-20">Max Marks</th>
                <th style={{ padding: headerPadding }} className="text-center w-20">Grade</th>
                <th style={{ padding: headerPadding }} className="text-center w-24">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'}>
                  <td style={{ padding: cellPadding }} className="font-bold text-zinc-900">{sub.subject_name}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-mono font-bold text-amber-700">{sub.marks_obtained}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-mono text-zinc-500">{sub.max_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-amber-900">{sub.grade}</td>
                  <td style={{ padding: cellPadding }} className="text-center">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                      sub.result === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {sub.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-amber-100 border-t-2 border-amber-500 font-bold text-amber-950">
                <td style={{ padding: cellPadding }} className="font-bold">Total Marks</td>
                <td style={{ padding: cellPadding }} className="text-center font-mono font-bold text-amber-900">{summary.total_obtained}</td>
                <td style={{ padding: cellPadding }} className="text-center font-mono text-zinc-600">{summary.total_max}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold text-amber-900">{summary.grade}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold uppercase">{summary.result}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Teacher Remarks */}
      {Boolean(summary.teacher_remark && summary.teacher_remark.toString().trim() !== '') && (
        <div className="font-sans text-xs text-zinc-800 leading-normal border border-amber-100 rounded-lg p-3 bg-amber-50/30">
          <strong className="font-bold text-amber-900">Teacher Remarks:</strong>{' '}
          <span className="font-normal text-zinc-800">{summary.teacher_remark}</span>
        </div>
      )}

      {/* Performance Summary Cards (5 columns) - Locked at a CONSTANT 10px gap below table */}
      <div className="grid grid-cols-5 gap-2 font-sans" style={{ marginTop: '10px' }}>
        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold text-emerald-800 uppercase block">Total Marks</span>
          <span className="text-xs font-bold font-mono text-emerald-950 mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold text-amber-800 uppercase block">Percentage</span>
          <span className="text-xs font-bold font-mono text-amber-950 mt-0.5">{summary.percentage}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold text-emerald-800 uppercase block">Overall Grade</span>
          <span className="text-xs font-bold text-emerald-950 mt-0.5">Grade {summary.grade}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold text-amber-800 uppercase block">Attendance</span>
          <span className="text-xs font-bold font-mono text-amber-950 mt-0.5">{summary.attendance?.attendance_rate ?? 90.3}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold text-emerald-800 uppercase block">Class Rank</span>
          <span className="text-xs font-bold font-mono text-emerald-950 mt-0.5">{summary.class_rank || '1st'}</span>
        </div>
      </div>

      {/* Dual Signatures pinned to the bottom of the page */}
      <div
        className="pb-1 font-sans flex justify-between items-end text-xs font-bold text-zinc-700 px-6"
        style={{ marginTop: 'auto' }}
      >
        <div className="flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className="w-40 border-b border-zinc-400 mb-2" />
          <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-800">Class Teacher Signature</span>
        </div>
        <div className="flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className="w-40 border-b border-zinc-400 mb-2" />
          <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-800">Principal Signature & Stamp</span>
        </div>
      </div>
    </div>
  );
}
