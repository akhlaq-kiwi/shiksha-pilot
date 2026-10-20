import React from 'react';
import { SIGNATURE_GAP, STAMP_SPACE, PAGE_CONTENT_MIN_HEIGHT } from '../reportCardLayout';
import { sortSubjectsWithGradeAtBottom, isSubjectGradeBased } from '../../../common/services/reportCardEngine';
import { resolveReportCardTheme } from '../reportCardThemes';

/**
 * Template: Classic CBSE Style Report Card
 * Features formal double border, term-wise breakdown, scholastic areas, grade point scale, and 2-signature layout.
 * Supports 6 distinct premium, light color themes (Classic Slate Default + 5 attractive color variants).
 */
export default function ClassicCBSEReportCardTemplate({ data, config = {}, colorTheme, templateCode }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const subjectsList = sortSubjectsWithGradeAtBottom(subjects);
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  // Resolve the active color theme (default to classic)
  const theme = resolveReportCardTheme(
    colorTheme || config.color_theme || data.color_theme,
    templateCode || config.template_code,
    config.template_id
  );

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
      className="w-full text-zinc-900 font-serif relative flex flex-col justify-between h-full"
      style={{
        padding: containerPadding,
        gap: sectionGapPx,
        boxSizing: 'border-box',
        border: theme.styles.outerBorder,
        borderRadius: '4px',
        minHeight: PAGE_CONTENT_MIN_HEIGHT,
        height: '100%',
        backgroundColor: theme.styles.cardBg || '#ffffff'
      }}
    >
      {/* Header Block */}
      <div className={`text-center pb-4 mb-2 ${theme.styles.headerBorder}`}>
        <div className="flex justify-center mb-2">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain" />
          ) : (
            <div className={`h-14 w-14 rounded-full flex items-center justify-center font-bold text-xl ${theme.styles.schoolLogoBorder}`}>
              {school.name.charAt(0)}
            </div>
          )}
        </div>
        <h1 className={`text-2xl font-bold uppercase tracking-tight font-display leading-tight ${theme.styles.schoolNameText}`}>
          {school.name}
        </h1>
        <p className={`text-xs font-sans font-semibold mt-0.5 uppercase tracking-wide ${theme.styles.schoolAddressText}`}>
          {school.address}
        </p>
        <div 
          className={`exam-banner-box inline-block py-2 px-6 mt-2 font-sans font-bold text-xs uppercase tracking-widest text-center leading-normal ${theme.styles.examBanner}`}
        >
          <span>
            {exam.is_final_session_report ? 'FINAL ACADEMIC REPORT CARD' : (exam.name ? `${exam.name.toUpperCase()} REPORT CARD` : 'ACADEMIC PERFORMANCE REPORT')} ({academic_year.name})
          </span>
        </div>
      </div>

      {/* Student Details Grid */}
      <div className={`w-full shrink-0 overflow-hidden ${theme.styles.studentTableBorder}`}>
        <table className="w-full text-xs font-sans border-collapse [&_td]:align-middle [&_th]:align-middle">
          <tbody>
            <tr className={`border-b ${theme.styles.studentCellBorder}`}>
              <td style={{ padding: metaPadding }} className={`border-r font-bold whitespace-nowrap w-[18%] ${theme.styles.studentLabelBg} ${theme.styles.studentCellBorder}`}>Student Name</td>
              <td style={{ padding: metaPadding }} className={`border-r font-bold uppercase w-[32%] ${theme.styles.studentValueText} ${theme.styles.studentCellBorder}`}>{student.name}</td>
              <td style={{ padding: metaPadding }} className={`border-r font-bold whitespace-nowrap w-[18%] ${theme.styles.studentLabelBg} ${theme.styles.studentCellBorder}`}>Class & Sec</td>
              <td style={{ padding: metaPadding }} className={`font-bold w-[32%] ${theme.styles.studentValueText}`}>{student.class_name} {student.section ? `(${student.section})` : ''}</td>
            </tr>
            <tr className={`border-b ${theme.styles.studentCellBorder}`}>
              <td style={{ padding: metaPadding }} className={`border-r font-bold whitespace-nowrap w-[18%] ${theme.styles.studentLabelBg} ${theme.styles.studentCellBorder}`}>Father's Name</td>
              <td style={{ padding: metaPadding }} className={`border-r font-bold w-[32%] ${theme.styles.studentValueText} ${theme.styles.studentCellBorder}`}>{student.father_name || '—'}</td>
              <td style={{ padding: metaPadding }} className={`border-r font-bold whitespace-nowrap w-[18%] ${theme.styles.studentLabelBg} ${theme.styles.studentCellBorder}`}>Mother's Name</td>
              <td style={{ padding: metaPadding }} className={`font-bold w-[32%] ${theme.styles.studentValueText}`}>{student.mother_name || '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: metaPadding }} className={`border-r font-bold whitespace-nowrap w-[18%] ${theme.styles.studentLabelBg} ${theme.styles.studentCellBorder}`}>Date of Birth</td>
              <td style={{ padding: metaPadding }} className={`border-r font-bold font-sans w-[32%] ${theme.styles.studentValueText} ${theme.styles.studentCellBorder}`}>{student.dob}</td>
              <td style={{ padding: metaPadding }} className={`border-r font-bold whitespace-nowrap w-[18%] ${theme.styles.studentLabelBg} ${theme.styles.studentCellBorder}`}>Roll / SR No</td>
              <td style={{ padding: metaPadding }} className={`font-sans font-bold w-[32%] ${theme.styles.studentValueText}`}>{student.roll_no} | {student.admission_no}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Scholastic Achievements Table Container - Expands dynamically for small subject counts */}
      <div className="font-sans flex-1 flex flex-col justify-between mt-3">
        {validTerminals.length > 0 ? (
          <table className={`w-full h-full border-collapse [&_td]:align-middle [&_th]:align-middle ${theme.styles.marksTableBorder}`} style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className={`font-bold uppercase text-[11px] ${theme.styles.marksHeaderBg1}`}>
                <th rowSpan={2} style={{ padding: headerPadding }} className={`text-left border-r ${theme.styles.marksHeaderDivider}`}>Subject</th>
                {validTerminals.map((t, idx) => {
                  const termMax = t.sub_tests?.reduce((sum, st) => sum + (parseFloat(st.max_marks) || 0), 0);
                  return (
                    <th key={idx} colSpan={t.sub_tests.length} style={{ padding: headerPadding }} className={`text-center border-r ${theme.styles.marksHeaderDivider}`}>
                      {t.name} {termMax > 0 ? `(${termMax})` : ''}
                    </th>
                  );
                })}
                <th rowSpan={2} style={{ padding: headerPadding }} className="text-center">Grade</th>
              </tr>
              <tr className={`font-bold uppercase text-[8px] ${theme.styles.marksHeaderBg2}`}>
                {validTerminals.map((t) => (
                  <React.Fragment key={t.id || t.name}>
                    {t.sub_tests.map((st) => (
                      <th key={st.id || st.name} style={{ padding: headerPadding }} className={`text-center border-r font-bold ${theme.styles.marksSubHeaderDivider}`} title={`${st.name} (Max Marks: ${st.max_marks})`}>
                        <div>{st.name}</div>
                        {st.max_marks ? <div className="text-[7.5px] font-normal opacity-85">({st.max_marks})</div> : null}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.styles.marksCellBorder}`}>
              {subjectsList.map((s, idx) => (
                <tr key={idx} className={`border-b ${theme.styles.marksCellBorder}`}>
                  <td style={{ padding: cellPadding }} className={`border-r font-bold ${theme.styles.marksCellBorder} ${theme.styles.marksCellText}`}>{s.subject_name}</td>
                  {validTerminals.map((t) => {
                    const tScore = s.terminals?.[t.name];
                    return (
                      <React.Fragment key={t.id || t.name}>
                        {t.sub_tests.map((st) => {
                          const stScore = tScore?.sub_tests?.[st.name];
                          return (
                            <td key={st.id || st.name} style={{ padding: cellPadding }} className={`text-center border-r font-mono font-bold text-[10px] ${theme.styles.marksCellBorder}`}>
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
              <tr className={`font-bold ${theme.styles.marksTotalRowBg} ${theme.styles.marksTotalRowBorder}`}>
                <td style={{ padding: cellPadding }} className={`border-r ${theme.styles.marksCellBorder}`}>Grand Total</td>
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
                        <td key={st.id || st.name} style={{ padding: cellPadding }} className={`text-center border-r font-mono font-bold text-[10px] ${theme.styles.marksCellBorder}`}>
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
          <table className={`w-full h-full border-collapse [&_td]:align-middle [&_th]:align-middle ${theme.styles.marksTableBorder}`} style={{ fontSize: fontSizePx }}>
            <thead>
              <tr className={`font-bold uppercase text-[11px] ${theme.styles.marksHeaderBg1}`}>
                <th style={{ padding: headerPadding }} className={`text-left border-r ${theme.styles.marksHeaderDivider}`}>Subject</th>
                <th style={{ padding: headerPadding }} className={`text-center border-r w-24 ${theme.styles.marksHeaderDivider}`}>Max Marks</th>
                <th style={{ padding: headerPadding }} className={`text-center border-r w-24 ${theme.styles.marksHeaderDivider}`}>Pass Marks</th>
                <th style={{ padding: headerPadding }} className={`text-center border-r w-28 ${theme.styles.marksHeaderDivider}`}>Marks Obtained</th>
                <th style={{ padding: headerPadding }} className={`text-center border-r w-20 ${theme.styles.marksHeaderDivider}`}>Grade</th>
                <th style={{ padding: headerPadding }} className="text-center w-24">Result</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme.styles.marksCellBorder}`}>
              {subjectsList.map((s, idx) => (
                <tr key={idx} className={`border-b ${theme.styles.marksCellBorder}`}>
                  <td style={{ padding: cellPadding }} className={`border-r font-bold ${theme.styles.marksCellBorder} ${theme.styles.marksCellText}`}>{s.subject_name}</td>
                  <td style={{ padding: cellPadding }} className={`text-center border-r font-mono ${theme.styles.marksCellBorder}`}>{s.max_marks}</td>
                  <td style={{ padding: cellPadding }} className={`text-center border-r font-mono text-zinc-600 ${theme.styles.marksCellBorder}`}>{s.passing_marks}</td>
                  <td style={{ padding: cellPadding }} className={`text-center border-r font-mono font-bold ${theme.styles.marksCellBorder} ${theme.styles.marksCellText}`}>{s.marks_obtained}</td>
                  <td style={{ padding: cellPadding }} className={`text-center border-r font-bold ${theme.styles.marksCellBorder}`}>{s.grade}</td>
                  <td style={{ padding: cellPadding }} className="text-center font-bold text-[11px] uppercase">{s.result}</td>
                </tr>
              ))}
              {/* Total Marks Row (Inside tbody so height expands equally with subject rows) */}
              <tr className={`font-bold ${theme.styles.marksTotalRowBg} ${theme.styles.marksTotalRowBorder}`}>
                <td style={{ padding: cellPadding }} className={`border-r ${theme.styles.marksCellBorder}`}>Grand Total</td>
                <td style={{ padding: cellPadding }} className={`text-center border-r font-mono ${theme.styles.marksCellBorder}`}>{summary.total_max}</td>
                <td style={{ padding: cellPadding }} className={`text-center border-r ${theme.styles.marksCellBorder}`}>—</td>
                <td style={{ padding: cellPadding }} className={`text-center border-r font-mono font-bold text-sm ${theme.styles.marksCellBorder}`}>{summary.total_obtained}</td>
                <td style={{ padding: cellPadding }} className={`text-center border-r font-bold text-sm ${theme.styles.marksCellBorder}`}>{summary.grade}</td>
                <td style={{ padding: cellPadding }} className="text-center font-bold text-xs">{summary.result}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Performance Summary Cards (5 columns) - Locked at EXACT constant 5px gap below Total Marks row */}
      <div className="grid grid-cols-5 gap-2 font-sans" style={{ marginTop: '5px' }}>
        <div className={`${theme.styles.statCardTotal} p-2 rounded text-center flex flex-col justify-center`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">Total Marks</span>
          <span className="text-xs font-bold font-mono mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
        </div>

        <div className={`${theme.styles.statCardPercentage} p-2 rounded text-center flex flex-col justify-center`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">Percentage</span>
          <span className="text-xs font-bold font-mono mt-0.5">{summary.percentage}%</span>
        </div>

        <div className={`${theme.styles.statCardGrade} p-2 rounded text-center flex flex-col justify-center`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">Overall Grade</span>
          <span className="text-xs font-bold font-mono mt-0.5">Grade {summary.grade}</span>
        </div>

        <div className={`${theme.styles.statCardAttendance} p-2 rounded text-center flex flex-col justify-center`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">Attendance</span>
          <span className="text-xs font-bold font-mono mt-0.5">
            {(() => {
              const rate = summary?.attendance?.attendance_rate ?? data?.attendance?.attendance_rate ?? summary?.attendance_rate ?? data?.attendance_rate;
              return (rate !== null && rate !== undefined && !isNaN(rate)) ? `${Math.round(rate)}%` : '—';
            })()}
          </span>
        </div>

        <div className={`${theme.styles.statCardRank} p-2 rounded text-center flex flex-col justify-center`}>
          <span className="text-[11px] font-bold uppercase tracking-wider block opacity-90">Class Rank</span>
          <span className="text-xs font-bold font-mono mt-0.5">
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
            <strong className={`font-bold ${theme.styles.remarksLabel}`}>Teacher Remarks:</strong>{' '}
            <span className={`font-bold italic ${theme.styles.remarksText}`}>{cleanRemark}</span>
          </div>
        );
      })()}

      {/* Dual Signatures locked below 5 summary boxes & remarks */}
      <div className={`pb-1 font-sans flex justify-between items-end text-xs font-bold px-6 ${theme.styles.signatureText}`} style={{ marginTop: '75px' }}>
        <div className="inline-flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className={`w-full border-b mb-1.5 ${theme.styles.signatureBorder}`} />
          <span className="uppercase text-[11px] font-bold tracking-wider whitespace-nowrap">Class Teacher Signature</span>
        </div>
        <div className="inline-flex flex-col items-center">
          <div style={{ height: STAMP_SPACE }} aria-hidden="true" />
          <div className={`w-full border-b mb-1.5 ${theme.styles.signatureBorder}`} />
          <span className="uppercase text-[11px] font-bold tracking-wider whitespace-nowrap">Principal Signature & Stamp</span>
        </div>
      </div>
    </div>
  );
}
