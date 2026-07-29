import React from 'react';

/**
 * Template 4: Compact Primary School Format Report Card
 * Single-page compact grid format designed for primary classes with key metric pill badges and dual signature layout.
 */
export default function CompactPrimaryReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects = [], summary } = data;
  const signatures = config.signatures || ['Teacher Signature', 'Parent Signature'];

  const subCount = subjects?.length || 0;
  const isCompact = subCount > 8;
  const isExtraCompact = subCount > 11;

  const containerPadding = isExtraCompact ? '5mm' : isCompact ? '6.5mm' : '8mm';
  const sectionGap = isExtraCompact ? 'space-y-2' : isCompact ? 'space-y-3' : 'space-y-4';

  return (
    <div
      className={`w-full bg-white text-zinc-900 font-sans relative flex flex-col justify-between ${sectionGap}`}
      style={{
        padding: containerPadding,
        boxSizing: 'border-box',
        border: '2px solid #f59e0b',
        borderRadius: '12px',
        minHeight: '100%'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-amber-400 pb-4 mb-4">
        <div className="flex items-center gap-3">
          {school.logo_path ? (
            <img src={school.logo_path} alt="Logo" className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xl">
              {school.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-black uppercase text-amber-600 tracking-tight font-display">
              {school.name}
            </h1>
            <p className="text-[11px] font-bold text-zinc-500 uppercase">
              {exam.is_final_session_report ? 'Final Academic Session Report' : `Primary Progress Card — ${exam.name}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs rounded-full uppercase">
            Session: {academic_year.name}
          </span>
        </div>
      </div>

      {/* Student Profile Info */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 mb-4 grid grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[9px] font-bold text-amber-800 uppercase block">Student Name</span>
          <strong className="text-zinc-900 font-bold uppercase">{student.name}</strong>
        </div>
        <div>
          <span className="text-[9px] font-bold text-amber-800 uppercase block">Class & Sec</span>
          <strong className="text-zinc-900">{student.class_name} {student.section ? `(${student.section})` : ''}</strong>
        </div>
        <div>
          <span className="text-[9px] font-bold text-amber-800 uppercase block">Roll No</span>
          <strong className="text-zinc-900 font-mono">{student.roll_no}</strong>
        </div>
        <div>
          <span className="text-[9px] font-bold text-amber-800 uppercase block">Adm No</span>
          <strong className="text-zinc-900 font-mono">{student.admission_no}</strong>
        </div>
      </div>

      {/* Primary Subjects Grid */}
      <div className="border border-zinc-200 rounded-lg overflow-hidden mb-4">
        {exam.is_final_session_report ? (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-amber-500 text-white font-bold uppercase text-[9.5px]">
                <th rowSpan={2} className="p-2 border-r border-amber-600">Subject</th>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <th key={exName} colSpan={2} className="p-1 text-center border-r border-amber-600">{exName}</th>
                ))}
                <th colSpan={2} className="p-1 text-center border-r border-amber-600">Grand Total</th>
                <th rowSpan={2} className="p-2 text-center">Grade</th>
              </tr>
              <tr className="bg-amber-600 text-white font-bold uppercase text-[8.5px]">
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <th className="p-1 text-center border-r border-amber-700">M.M.</th>
                    <th className="p-1 text-center border-r border-amber-700">Obt.</th>
                  </React.Fragment>
                ))}
                <th className="p-1 text-center border-r border-amber-700">Max</th>
                <th className="p-1 text-center border-r border-amber-700">Obt.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'}>
                  <td className="p-2 font-bold text-zinc-900 border-r border-zinc-200">{sub.subject_name}</td>
                  {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                    <React.Fragment key={exName}>
                      <td className="p-2 text-center border-r border-zinc-200 font-mono text-zinc-500">{sub.exam_scores?.[exName]?.max_marks || 100}</td>
                      <td className="p-2 text-center border-r border-zinc-200 font-mono font-bold text-amber-700">{sub.exam_scores?.[exName]?.marks_obtained ?? '—'}</td>
                    </React.Fragment>
                  ))}
                  <td className="p-2 text-center border-r border-zinc-200 font-mono font-bold text-zinc-700">{sub.grand_total_max || sub.max_marks}</td>
                  <td className="p-2 text-center border-r border-zinc-200 font-mono font-black text-amber-900">{sub.grand_total_obtained || sub.marks_obtained}</td>
                  <td className="p-2 text-center font-black text-amber-900">{sub.grade}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-amber-100 border-t-2 border-amber-500 font-bold text-xs text-amber-950">
                <td className="p-2 border-r border-amber-200">Total Marks</td>
                {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                  <React.Fragment key={exName}>
                    <td className="p-2 text-center border-r border-amber-200 font-mono">{data.exam_totals?.[exName]?.max_marks || 700}</td>
                    <td className="p-2 text-center border-r border-amber-200 font-mono font-black text-amber-900">{data.exam_totals?.[exName]?.marks_obtained || 500}</td>
                  </React.Fragment>
                ))}
                <td className="p-2 text-center border-r border-amber-200 font-mono font-bold">{summary.total_max}</td>
                <td className="p-2 text-center border-r border-amber-200 font-mono font-black text-sm text-amber-950">{summary.total_obtained}</td>
                <td className="p-2 text-center font-black text-sm">{summary.grade}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-amber-500 text-white font-bold uppercase text-[10px]">
                <th className="p-2.5">Subject</th>
                <th className="p-2.5 text-center w-24">Marks Obtained</th>
                <th className="p-2.5 text-center w-20">Max Marks</th>
                <th className="p-2.5 text-center w-20">Grade</th>
                <th className="p-2.5 text-center w-24">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-medium">
              {subjects.map((sub, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'}>
                  <td className="p-2.5 font-bold text-zinc-900">{sub.subject_name}</td>
                  <td className="p-2.5 text-center font-mono font-bold text-amber-700">{sub.marks_obtained}</td>
                  <td className="p-2.5 text-center font-mono text-zinc-500">{sub.max_marks}</td>
                  <td className="p-2.5 text-center font-black text-amber-900">{sub.grade}</td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      sub.result === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

      {/* Performance Summary Cards (5 columns) */}
      <div className="grid grid-cols-5 gap-2 font-sans">
        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[9px] font-bold text-emerald-800 uppercase block">Total Marks</span>
          <span className="text-xs font-black font-mono text-emerald-950 mt-0.5">{summary.total_obtained} / {summary.total_max}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[9px] font-bold text-amber-800 uppercase block">Percentage</span>
          <span className="text-xs font-black font-mono text-amber-950 mt-0.5">{summary.percentage}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[9px] font-bold text-emerald-800 uppercase block">Overall Grade</span>
          <span className="text-xs font-black text-emerald-950 mt-0.5">Grade {summary.grade}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[9px] font-bold text-amber-800 uppercase block">Attendance</span>
          <span className="text-xs font-black font-mono text-amber-950 mt-0.5">{summary.attendance?.attendance_rate ?? 90.3}%</span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center flex flex-col justify-center">
          <span className="text-[9px] font-bold text-emerald-800 uppercase block">Class Rank</span>
          <span className="text-xs font-black font-mono text-emerald-950 mt-0.5">{summary.class_rank || '1st'}</span>
        </div>
      </div>

      {/* Teacher Remarks (Rendered ONLY if non-empty remark exists) */}
      {Boolean(summary.teacher_remark && summary.teacher_remark.toString().trim() !== '') && (
        <div className="px-1 font-sans text-xs text-zinc-800 leading-normal">
          <strong className="font-bold text-amber-900">Teacher Remarks:</strong>{' '}
          <span className="font-normal text-zinc-800">{summary.teacher_remark}</span>
        </div>
      )}

      {/* Dual Signatures */}
      <div className="mt-auto pt-16 pb-1 font-sans flex justify-between items-end text-xs font-bold text-zinc-700 px-6">
        <div className="flex flex-col items-center justify-end min-h-[120px]">
          <div className="w-40 border-b border-zinc-400 mb-2" />
          <span className="uppercase text-[10px] font-black tracking-wider text-zinc-800">Class Teacher Signature</span>
        </div>
        <div className="flex flex-col items-center justify-end min-h-[120px]">
          <div className="w-40 border-b border-zinc-400 mb-2" />
          <span className="uppercase text-[10px] font-black tracking-wider text-zinc-800">Principal Signature & Stamp</span>
        </div>
      </div>
    </div>
  );
}
