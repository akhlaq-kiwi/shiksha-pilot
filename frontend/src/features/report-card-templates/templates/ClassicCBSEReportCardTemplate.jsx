import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE, PAGE_CONTENT_MIN_HEIGHT } from '../reportCardLayout';
import { sortSubjectsWithGradeAtBottom, isSubjectGradeBased } from '../../../common/services/reportCardEngine';

/**
 * Template 2: Classic CBSE Style Report Card
 * Features formal double border, term-wise breakdown, scholastic areas, grade point scale, and 2-signature layout.
 */
export default function ClassicCBSEReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const subjectsList = sortSubjectsWithGradeAtBottom(subjects);
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  // Dynamic layout density scaling based on subject count (inline styles for guaranteed rendering)
  const subCount = subjectsList?.length || 0;

  let cellPadding = '10px 14px';
  let headerPadding = '10px 14px';
  let fontSizePx = '12px';
  let containerPadding = '8mm';
  let sectionGapPx = '16px';
  let metaPadding = '8px 12px';

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

  const validTerminals = (data.terminals || []).filter(t => Array.isArray(t.sub_tests) && t.sub_tests.length > 0);

  return (
    <div
      className="w-full bg-white text-zinc-900 font-serif relative flex flex-col justify-between h-full"
      style={{
        padding: containerPadding,
        gap: sectionGapPx,
        boxSizing: 'border-box',
        border: '6px double #18181b',
        borderRadius: '4px',
        minHeight: PAGE_CONTENT_MIN_HEIGHT,
        height: '100%'
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
        <p className="text-xs font-sans text-zinc-600 font-semibold mt-0.5 uppercase tracking-wide">
          {school.address}
        </p>
        <div className="inline-block border-y border-zinc-800 py-1 px-4 mt-2 font-sans font-bold text-xs uppercase tracking-widest text-zinc-900">
          {exam.is_final_session_report ? 'FINAL ACADEMIC REPORT CARD' : (exam.name ? `${exam.name.toUpperCase()} REPORT CARD` : 'ACADEMIC PERFORMANCE REPORT')} ({academic_year.name})
        </div>
      </div>

      {/* Student Details Grid */}
      <table className="w-full text-xs font-sans border border-zinc-400 border-collapse">
        <tbody>
          <tr className="border-b border-zinc-300">
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 whitespace-nowrap w-[18%]">Student Name</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold uppercase text-zinc-900 w-[32%]">{student.name}</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 whitespace-nowrap w-[18%]">Class & Sec</td>
            <td style={{ padding: metaPadding }} className="font-bold w-[32%]">{student.class_name} {student.section ? `(${student.section})` : ''}</td>
          </tr>
          <tr className="border-b border-zinc-300">
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 whitespace-nowrap w-[18%]">Father's Name</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold text-zinc-900 w-[32%]">{student.father_name || '—'}</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 whitespace-nowrap w-[18%]">Mother's Name</td>
            <td style={{ padding: metaPadding }} className="font-bold text-zinc-900 w-[32%]">{student.mother_name || '—'}</td>
          </tr>
          <tr>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 whitespace-nowrap w-[18%]">Date of Birth</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-mono w-[32%]">{student.dob}</td>
            <td style={{ padding: metaPadding }} className="border-r border-zinc-300 font-bold bg-zinc-100 whitespace-nowrap w-[18%]">Roll / SR No</td>
            <td style={{ padding: metaPadding }} className="font-mono font-bold w-[32%]">{student.roll_no} | {student.admission_no}</td>
          </tr>
        </tbody>
      </table>

      {/* Scholastic Achievements Table Container - Expands dynamically for small subject counts */}
      <div className="font-sans flex-1 flex flex-col justify-between mt-3">
        
        {validTerminals.length > 0 ? (
          <table className="w-full h-full border border-zinc-800 border-collapse" style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className="bg-zinc-800 text-white font-bold uppercase text-[11px]">
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-left border-r border-zinc-700">Subject</th>
                {validTerminals.map((t, idx) => (
                  <th key={idx} colSpan={t.sub_tests.length} style={{ padding: headerPadding }} className="text-center border-r border-zinc-700">
                    {t.name}
                  </th>
                ))}
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-center">Grade</th>
              </tr>
              <tr className="bg-zinc-700 text-white font-bold uppercase text-[8px]">
                {validTerminals.map((t) => (
                  <React.Fragment key={t.id || t.name}>
                    {t.sub_tests.map((st) => (
                      <th key={st.id || st.name} style={{ padding: headerPadding }} className="text-center border-r border-zinc-600 font-bold" title={`${st.name} (Max Marks: ${st.max_marks})`}>
                        {st.name}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-300">
              {subjectsList.map((s, idx) => (
                <tr key={idx} className="border-b border-zinc-300">
                  <td style={{ padding: cellPadding }} className="border-r border-zinc-300 font-bold text-zinc-900">{s.subject_name}</td>
                  {validTerminals.map((t) => {
                    const tScore = s.terminals?.[t.name];
                    return (
                      <React.Fragment key={t.id || t.name}>
                        {t.sub_tests.map((st) => {
                          const stScore = tScore?.sub_tests?.[st.name];
                          return (
                            <td key={st.id || st.name} style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-[10px]">
                              {stScore && stScore.marks_obtained !== null && stScore.marks_obtained !== undefined ? stScore.marks_obtained : '—'}
                            </td>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{s.grade || '—'}</td>
                </tr>
              ))}
              {/* Grand Total Row */}
              <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-800">
                <td style={{ padding: cellPadding }} className="border-r border-zinc-300">Grand Total</td>
                {validTerminals.map((t) => {
                  const subTestTotals = t.sub_tests.map((st) => {
                    let stObt = 0;
                    subjectsList.forEach((s) => {
                      if (isSubjectGradeBased(s)) return;
                      const sc = s.terminals?.[t.name]?.sub_tests?.[st.name];
                      if (sc) {
                        if (sc.raw_obtained !== undefined) stObt += parseFloat(sc.raw_obtained) || 0;
                        else if (typeof sc.marks_obtained === 'number') stObt += sc.marks_obtained;
                      }
                    });
                    return { obt: stObt };
                  });

                  return (
                    <React.Fragment key={t.id || t.name}>
                      {t.sub_tests.map((st, i) => (
                        <td key={st.id || st.name} style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-[10px]">
                          {subTestTotals[i]?.obt || 0}
                        </td>
                      ))}
                    </React.Fragment>
                  );
                })}
                <td style={{ padding: cellPadding }} className="text-center font-bold text-sm">{summary.grade || '—'}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full h-full border border-zinc-800 border-collapse" style={{ fontSize: fontSizePx }}>
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
              {subjectsList.map((s, idx) => (
                <tr key={idx} className="border-b border-zinc-300">
                  <td style={{ padding: cellPadding }} className="border-r border-zinc-300 font-bold text-zinc-900">{s.subject_name}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono">{s.max_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono text-zinc-600">{s.passing_marks}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-zinc-900">{s.marks_obtained}</td>
                  <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-bold">{s.grade}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-[11px] uppercase">{s.result}</td>
                </tr>
              ))}
              {/* Total Marks Row (Inside tbody so height expands equally with subject rows) */}
              <tr className="bg-zinc-100 font-bold border-t-2 border-zinc-800">
                <td style={{ padding: cellPadding }} className="border-r border-zinc-300">Grand Total</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono">{summary.total_max}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300">—</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-mono font-bold text-sm">{summary.total_obtained}</td>
                <td style={{ padding: cellPadding }} className="text-center border-r border-zinc-300 font-bold text-sm">{summary.grade}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{summary.result}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Performance Summary Cards (5 columns) - Locked at EXACT constant 5px gap below Total Marks row */}
      <div className="grid grid-cols-5 gap-2 font-sans" style={{ marginTop: '5px' }}>
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
          <span className="text-xs font-bold text-amber-950 font-mono mt-0.5">
            {(() => {
              const rate = summary?.attendance?.attendance_rate ?? data?.attendance?.attendance_rate ?? summary?.attendance_rate ?? data?.attendance_rate;
              return (rate !== null && rate !== undefined && !isNaN(rate)) ? `${Math.round(rate)}%` : '—';
            })()}
          </span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-center flex flex-col justify-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">Class Rank</span>
          <span className="text-xs font-bold text-emerald-950 font-mono mt-0.5">
            {(() => {
              const rawRank = (summary?.class_rank || data?.class_rank || '1').toString().trim();
              const match = rawRank.match(/^(\d+)/);
              return match ? match[1] : rawRank;
            })()}
          </span>
        </div>
      </div>

      {/* Teacher Remarks (Rendered ONLY if non-empty remark exists, placed JUST BELOW 5 Summary Cards) */}
      {(() => {
        const remarkText = summary?.teacher_remark || data?.teacher_remark || data?.report_card_remark || school?.report_card_remark;
        if (!remarkText || remarkText.toString().trim() === '') return null;
        const cleanRemark = remarkText.toString().replace(/^["']|["']$/g, '').trim();
        return (
          <div className="mt-2.5 px-1 font-sans text-xs leading-normal">
            <strong className="font-bold text-zinc-900">Teacher Remarks:</strong>{' '}
            <span className="font-bold italic text-emerald-700">{cleanRemark}</span>
          </div>
        );
      })()}

      {/* Dual Signatures locked below 5 summary boxes & remarks */}
      <div className="pb-1 font-sans flex justify-between items-end text-xs font-bold text-zinc-800 px-6" style={{ marginTop: '75px' }}>
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
