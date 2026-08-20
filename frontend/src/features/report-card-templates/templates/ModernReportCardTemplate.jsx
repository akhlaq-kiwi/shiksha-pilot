import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE, PAGE_CONTENT_MIN_HEIGHT } from '../reportCardLayout';

/**
 * Template 1: Modern School Report
 * Features sleek gradient header, stat summary cards, pill tags, and 3-signature layout.
 */
export default function ModernReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const isFinalReport = Boolean(exam?.is_final_session_report || data?.is_final_session_report);

  // Dynamic layout density scaling based on subject count (inline styles for guaranteed rendering)
  const subCount = subjects?.length || 0;

  let cellPadding = '10px 16px';
  let headerPadding = '10px 16px';
  let fontSizePx = '12px';
  let containerPadding = '8mm';
  let sectionGapPx = '16px';
  let metaPadding = '12px 14px';

  if (subCount <= 4) {
    // 1–4 subjects
    cellPadding = '12px 14px';
    headerPadding = '10px 12px';
    fontSizePx = '13px';
    containerPadding = '8mm';
    sectionGapPx = '12px';
    metaPadding = '12px 14px';
  } else if (subCount <= 6) {
    // 5–6 subjects
    cellPadding = '8px 12px';
    headerPadding = '8px 12px';
    fontSizePx = '12px';
    containerPadding = '7.5mm';
    sectionGapPx = '10px';
    metaPadding = '10px 12px';
  } else if (subCount <= 8) {
    // 7–8 subjects
    cellPadding = '6px 10px';
    headerPadding = '6px 10px';
    fontSizePx = '11.5px';
    containerPadding = '7mm';
    sectionGapPx = '8px';
    metaPadding = '8px 10px';
  } else if (subCount <= 10) {
    // 9–10 subjects
    cellPadding = '4px 8px';
    headerPadding = '5px 8px';
    fontSizePx = '11px';
    containerPadding = '6mm';
    sectionGapPx = '8px';
    metaPadding = '7px 8px';
  } else if (subCount <= 12) {
    // 11–12 subjects
    cellPadding = '3px 6px';
    headerPadding = '4px 6px';
    fontSizePx = '10.5px';
    containerPadding = '5mm';
    sectionGapPx = '6px';
    metaPadding = '6px 6px';
  } else {
    // 13+ subjects
    cellPadding = '2px 5px';
    headerPadding = '3px 5px';
    fontSizePx = '10px';
    containerPadding = '4mm';
    sectionGapPx = '5px';
    metaPadding = '4px 5px';
  }

  // Clean rank display (e.g. "13" instead of "13 of 34")
  const cleanRank = (summary?.class_rank || '1st').toString().split(' ')[0];

  return (
    <div
      className="w-full bg-white text-zinc-900 font-sans relative flex flex-col justify-between h-full border border-zinc-300 rounded-xl"
      style={{ padding: containerPadding, gap: sectionGapPx, boxSizing: 'border-box', minHeight: PAGE_CONTENT_MIN_HEIGHT, height: '100%' }}
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white p-6 rounded-xl relative overflow-hidden flex items-center justify-between border border-emerald-700/30">
        {/* Subtle Inner Accent Line at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-amber-400" />

        <div className="flex items-center gap-4 min-w-0 z-10">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain shrink-0 bg-white/10 p-1.5 rounded-xl border border-white/20" />
          ) : (
            <div className="h-16 w-16 bg-amber-400 text-emerald-950 font-bold text-2xl rounded-xl flex items-center justify-center border border-amber-300 shadow-xs shrink-0 font-display">
              {school.name ? school.name.charAt(0) : 'S'}
            </div>
          )}

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white drop-shadow-xs font-display">
              {school.name}
            </h1>
            <p className="text-xs font-medium text-emerald-100 mt-1 truncate tracking-wide uppercase">
              {school.address} {school.phone ? `• Ph: ${school.phone}` : ''}
            </p>
            <div className="inline-flex items-center gap-2 mt-2 bg-emerald-950/60 backdrop-blur-xs px-3 py-1 rounded-lg border border-emerald-600/40">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                {exam.name}
              </span>
              <span className="text-[10px] text-emerald-300 font-semibold">•</span>
              <span className="text-[11px] font-semibold text-emerald-200">
                Session: {academic_year.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Student Meta Card (3 columns x 2 rows, center aligned) */}
      <div
        className="bg-zinc-50 border border-zinc-200 rounded-xl text-xs grid grid-cols-3 gap-y-3 gap-x-4 font-medium text-center"
        style={{ padding: metaPadding }}
      >
        {/* Row 1 */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-zinc-400 uppercase block">Student Name</span>
          <strong className="text-zinc-900 text-sm font-bold uppercase tracking-tight">{student.name}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-zinc-400 uppercase block">Father Name</span>
          <strong className="text-zinc-900 text-sm font-bold uppercase tracking-tight">{student.father_name || '—'}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-zinc-400 uppercase block">Mother Name</span>
          <strong className="text-zinc-900 text-sm font-bold uppercase tracking-tight">{student.mother_name || '—'}</strong>
        </div>

        {/* Row 2 */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-zinc-400 uppercase block">Class & Section</span>
          <strong className="text-zinc-900 text-sm font-bold">{student.class_name} {student.section ? `(${student.section})` : ''}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-zinc-400 uppercase block">Roll / SR. No</span>
          <strong className="text-zinc-900 text-sm font-mono font-bold">{student.roll_no} | {student.admission_no}</strong>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-bold text-zinc-400 uppercase block">Date of Birth</span>
          <strong className="text-zinc-900 text-sm font-mono font-bold">{student.dob}</strong>
        </div>
      </div>

      {/* Scholastic Achievements Table Container - Expands dynamically for small subject counts */}
      <div className="w-full border border-zinc-200 rounded-xl shadow-2xs overflow-hidden flex-1 flex flex-col justify-between">
        {isFinalReport ? (
          <table className="w-full h-full text-left border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-emerald-950 text-white font-bold uppercase text-[9.5px] tracking-wider">
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-left font-bold border-r border-emerald-800 whitespace-nowrap min-w-[140px]">Subject</th>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <th key={exName} colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-emerald-800">{exName}</th>
                ))}
                <th colSpan={2} style={{ padding: headerPadding }} className="text-center border-r border-emerald-800">Grand Total</th>
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-center">Grade</th>
              </tr>
              <tr className="bg-emerald-900 text-white font-bold uppercase text-[8.5px]">
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800">M.M.</th>
                    <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800">Obt.</th>
                  </React.Fragment>
                ))}
                <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800">Max</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800">Obt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                  <td style={{ padding: cellPadding }} className="text-left font-bold text-zinc-900 border-r border-zinc-200 whitespace-nowrap">{sub.subject_name}</td>
                  {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => {
                    const score = sub.exam_scores?.[exName];
                    return (
                      <React.Fragment key={exName}>
                        <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono text-zinc-600">
                          {score ? score.max_marks : '—'}
                        </td>
                        <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono font-bold text-emerald-700">
                          {score ? score.marks_obtained : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono font-bold text-zinc-700">{sub.grand_total_max ?? sub.max_marks ?? '—'}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono font-bold text-emerald-800">{sub.grand_total_obtained ?? sub.marks_obtained ?? '—'}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-emerald-800">{sub.grade || '—'}</td>
                </tr>
              ))}
              {/* Total Marks Row (Inside tbody so height expands equally with subject rows) */}
              <tr className="bg-emerald-50 border-t-2 border-emerald-950 font-bold text-emerald-950">
                <td style={{ padding: cellPadding }} className="text-left border-r border-emerald-200 whitespace-nowrap font-bold">Total Marks</td>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono">{data.exam_totals?.[exName]?.max_marks ?? 0}</td>
                    <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono font-bold text-emerald-900">{data.exam_totals?.[exName]?.marks_obtained ?? 0}</td>
                  </React.Fragment>
                ))}
                <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono font-bold">{summary.total_max ?? '—'}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono font-bold text-emerald-900">{summary.total_obtained ?? '—'}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold">{summary.grade || '—'}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full h-full text-left border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-emerald-950 text-white font-bold uppercase text-[10.5px] tracking-wider">
                <th style={{ padding: headerPadding }} className="text-left font-bold border-r border-emerald-800 whitespace-nowrap min-w-[140px]">Subject</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800 w-28">Obtained</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800 w-24">Max</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800 w-24">Pass</th>
                <th style={{ padding: headerPadding }} className="text-center border-r border-emerald-800 w-20">Grade</th>
                <th style={{ padding: headerPadding }} className="text-center w-24">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/60'}>
                  <td style={{ padding: cellPadding }} className="text-left font-bold text-zinc-900 border-r border-zinc-200 whitespace-nowrap">{sub.subject_name}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono font-bold text-emerald-700">{sub.marks_obtained}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono text-zinc-600">{sub.max_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-mono text-zinc-500">{sub.passing_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-200 font-bold text-emerald-800">{sub.grade}</td>
                  <td style={{ padding: cellPadding }} className="text-center">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                      sub.result === 'PASS' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                    }`}>
                      {sub.result}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Total Marks Row (Inside tbody so height expands equally with subject rows) */}
              <tr className="bg-emerald-50 border-t-2 border-emerald-950 font-bold text-emerald-950">
                <td style={{ padding: cellPadding }} className="text-left font-bold border-r border-emerald-200 whitespace-nowrap">Total Marks</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono font-bold text-emerald-900">{summary.total_obtained}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono text-zinc-600">{summary.total_max}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-mono text-zinc-500">—</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-emerald-200 font-bold text-emerald-900">{summary.grade}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold uppercase">{summary.result}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Performance Summary Cards (5 columns) - Locked at EXACT constant 5px gap below Total Marks row */}
      <div className="grid grid-cols-5 gap-2 font-sans" style={{ marginTop: '5px' }}>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">Total Marks</span>
          <span className="text-sm font-bold text-emerald-950 font-mono mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 block">Percentage</span>
          <span className="text-sm font-bold text-amber-950 font-mono mt-0.5">{summary.percentage}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">Overall Grade</span>
          <span className="text-sm font-bold text-emerald-950 font-mono mt-0.5">Grade {summary.grade}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800 block">Attendance</span>
          <span className="text-sm font-bold text-amber-950 font-mono mt-0.5">
            {(() => {
              const rate = summary?.attendance?.attendance_rate ?? data?.attendance?.attendance_rate ?? summary?.attendance_rate ?? data?.attendance_rate;
              return (rate !== null && rate !== undefined && !isNaN(rate)) ? `${Math.round(rate)}%` : '—';
            })()}
          </span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center flex flex-col justify-center">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-800 block">Class Rank</span>
          <span className="text-sm font-bold text-emerald-950 font-mono mt-0.5">{cleanRank}</span>
        </div>
      </div>

      {/* Teacher Remarks (Rendered ONLY if non-empty remark exists, placed JUST BELOW 5 Summary Cards) */}
      {(() => {
        const remarkText = summary?.teacher_remark || data?.teacher_remark || data?.report_card_remark || school?.report_card_remark;
        if (!remarkText || remarkText.toString().trim() === '') return null;
        return (
          <div className="mt-2.5 px-1 font-sans text-xs leading-normal">
            <strong className="font-bold text-zinc-900">Teacher Remarks:</strong>{' '}
            <span className="font-bold italic text-emerald-700">"{remarkText}"</span>
          </div>
        );
      })()}

      {/* Dual Signatures locked below 5 summary boxes & remarks */}
      <div className="pb-1 flex justify-between items-end text-xs font-bold text-zinc-700 px-6 font-sans" style={{ marginTop: '75px' }}>
        <div className="inline-flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className="w-full border-b border-zinc-800 mb-1.5" />
          <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-800 whitespace-nowrap">Class Teacher Signature</span>
        </div>
        <div className="inline-flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className="w-full border-b border-zinc-800 mb-1.5" />
          <span className="uppercase text-[11px] font-bold tracking-wider text-zinc-800 whitespace-nowrap">Principal Signature & Stamp</span>
        </div>
      </div>
    </div>
  );
}
