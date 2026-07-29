import React from 'react';

/**
 * Template 3: Traditional School Format Report Card
 * Vintage certificate style layout inspired by traditional school marksheets with decorative border and result seal.
 */
export default function TraditionalReportCardTemplate({ data, config = {} }) {
  const { student, school, academic_year, exam, subjects, summary } = data;
  const signatures = config.signatures || ['Class Teacher', 'Principal'];

  return (
    <div
      className="id-card-report-wrapper w-full bg-amber-50/20 text-zinc-900 font-serif relative"
      style={{
        width: '194mm',
        minHeight: '270mm',
        padding: '12mm',
        boxSizing: 'border-box',
        border: '8px double #1e3a8a',
        borderRadius: '2px'
      }}
    >
      {/* Decorative Outer Border */}
      <div className="border border-blue-900 p-6 h-full flex flex-col justify-between" style={{ boxSizing: 'border-box' }}>
        <div>
          {/* Header */}
          <div className="text-center border-b-2 border-blue-900 pb-5 mb-6">
            <div className="flex justify-center mb-2">
              {school.logo_path ? (
                <img src={school.logo_path} alt="Logo" className="h-16 w-16 object-contain" />
              ) : (
                <div className="h-16 w-16 rounded-full border-2 border-blue-900 bg-blue-900 text-white flex items-center justify-center font-bold text-2xl">
                  {school.name.charAt(0)}
                </div>
              )}
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-blue-950 font-display">
              {school.name}
            </h1>
            <p className="text-xs text-zinc-700 italic mt-0.5">
              {school.address}
            </p>
            <div className="mt-3 text-sm font-bold uppercase tracking-widest text-blue-900 border-t border-b border-blue-900 inline-block px-6 py-1">
              {exam.is_final_session_report ? 'FINAL ACADEMIC REPORT CARD' : 'PROGRESS REPORT CARD'}
            </div>
            <p className="text-xs font-sans font-bold text-zinc-600 mt-1">
              {exam.name} — Academic Session: {academic_year.name}
            </p>
          </div>

          {/* Student Info Box */}
          <div className="border border-blue-900 bg-white p-4 mb-6 text-xs font-sans grid grid-cols-3 gap-y-3 gap-x-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Student Name</span>
              <strong className="text-blue-950 font-bold text-sm uppercase">{student.name}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Class & Section</span>
              <strong className="text-zinc-900 text-sm font-bold">{student.class_name} {student.section ? `(${student.section})` : ''}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Roll Number</span>
              <strong className="text-zinc-900 text-sm font-mono font-bold">{student.roll_no}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Father's Name</span>
              <span className="text-zinc-800">{student.father_name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Mother's Name</span>
              <span className="text-zinc-800">{student.mother_name}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Admission / SR No</span>
              <span className="text-zinc-800 font-mono">{student.admission_no}</span>
            </div>
          </div>

          {/* Traditional Marks Table */}
          <div className="mb-6 font-sans">
            {exam.is_final_session_report ? (
              <table className="w-full text-xs border border-blue-900 border-collapse text-zinc-900">
                <thead>
                  <tr className="bg-blue-950 text-white font-bold uppercase text-[9.5px] tracking-wide">
                    <th rowSpan={2} className="p-2 text-left border-r border-blue-800">Subject</th>
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <th key={exName} colSpan={2} className="p-1 text-center border-r border-blue-800">{exName}</th>
                    ))}
                    <th colSpan={2} className="p-1 text-center border-r border-blue-800">Grand Total</th>
                    <th rowSpan={2} className="p-2 text-center">Grade</th>
                  </tr>
                  <tr className="bg-blue-900 text-white font-bold uppercase text-[8.5px]">
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <React.Fragment key={exName}>
                        <th className="p-1 text-center border-r border-blue-700">M.M.</th>
                        <th className="p-1 text-center border-r border-blue-700">Obt.</th>
                      </React.Fragment>
                    ))}
                    <th className="p-1 text-center border-r border-blue-700">Max</th>
                    <th className="p-1 text-center border-r border-blue-700">Obt.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                      <td className="p-2 border-r border-blue-900 font-bold text-zinc-900">{sub.subject_name}</td>
                      {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                        <React.Fragment key={exName}>
                          <td className="p-2 text-center border-r border-blue-900 font-mono text-[11px]">{sub.exam_scores?.[exName]?.max_marks || 100}</td>
                          <td className="p-2 text-center border-r border-blue-900 font-mono font-bold text-[11px] text-blue-950">{sub.exam_scores?.[exName]?.marks_obtained ?? '—'}</td>
                        </React.Fragment>
                      ))}
                      <td className="p-2 text-center border-r border-blue-900 font-mono font-bold text-zinc-700 text-[11px]">{sub.grand_total_max || sub.max_marks}</td>
                      <td className="p-2 text-center border-r border-blue-900 font-mono font-black text-blue-950 text-[11px]">{sub.grand_total_obtained || sub.marks_obtained}</td>
                      <td className="p-2 text-center font-black text-xs">{sub.grade}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-100 font-bold border-t-2 border-blue-900 text-xs">
                    <td className="p-2.5 border-r border-blue-900">Grand Total</td>
                    {(data.session_exams || ['Quarterly Exam', 'Half Yearly Exam', 'Annual Exam']).map(exName => (
                      <React.Fragment key={exName}>
                        <td className="p-2 text-center border-r border-blue-900 font-mono">{data.exam_totals?.[exName]?.max_marks || 700}</td>
                        <td className="p-2 text-center border-r border-blue-900 font-mono font-black">{data.exam_totals?.[exName]?.marks_obtained || 500}</td>
                      </React.Fragment>
                    ))}
                    <td className="p-2 text-center border-r border-blue-900 font-mono font-bold">{summary.total_max}</td>
                    <td className="p-2 text-center border-r border-blue-900 font-mono font-black text-sm text-blue-950">{summary.total_obtained}</td>
                    <td className="p-2 text-center font-black text-sm">{summary.grade}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="w-full text-xs border border-blue-900 border-collapse text-zinc-900">
                <thead>
                  <tr className="bg-blue-950 text-white font-bold uppercase text-[10px] tracking-wide">
                    <th className="p-2.5 text-left border-r border-blue-800">Subject</th>
                    <th className="p-2.5 text-center border-r border-blue-800 w-24">Max Marks</th>
                    <th className="p-2.5 text-center border-r border-blue-800 w-24">Min Pass</th>
                    <th className="p-2.5 text-center border-r border-blue-800 w-28">Marks Obtained</th>
                    <th className="p-2.5 text-center border-r border-blue-800 w-20">Grade</th>
                    <th className="p-2.5 text-center w-24">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-200">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                      <td className="p-2.5 border-r border-blue-900 font-bold text-zinc-900">{sub.subject_name}</td>
                      <td className="p-2.5 text-center border-r border-blue-900 font-mono">{sub.max_marks}</td>
                      <td className="p-2.5 text-center border-r border-blue-900 font-mono text-zinc-600">{sub.passing_marks}</td>
                      <td className="p-2.5 text-center border-r border-blue-900 font-mono font-bold text-blue-950">{sub.marks_obtained}</td>
                      <td className="p-2.5 text-center border-r border-blue-900 font-bold">{sub.grade}</td>
                      <td className="p-2.5 text-center font-bold text-[10px] uppercase">
                        <span className={sub.result === 'PASS' ? 'text-blue-900 font-black' : 'text-red-700 font-black'}>
                          {sub.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-100 font-bold border-t-2 border-blue-900 text-xs">
                    <td className="p-3 border-r border-blue-900">Grand Total</td>
                    <td className="p-3 text-center border-r border-blue-900 font-mono">{summary.total_max}</td>
                    <td className="p-3 text-center border-r border-blue-900 font-mono text-zinc-600">—</td>
                    <td className="p-3 text-center border-r border-blue-900 font-mono font-black text-sm text-blue-950">{summary.total_obtained}</td>
                    <td className="p-3 text-center border-r border-blue-900 font-black text-sm">{summary.grade}</td>
                    <td className="p-3 text-center font-black text-xs">{summary.result}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Results Summary Box & Promotion Seal */}
          <div className="border border-blue-900 bg-white p-4 mb-6 font-sans text-xs grid grid-cols-3 gap-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Percentage</span>
              <strong className="text-sm font-mono font-bold text-blue-950">{summary.percentage}%</strong>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Class Rank</span>
              <strong className="text-sm font-bold text-blue-950">{summary.class_rank}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-zinc-500 uppercase block">Attendance Rate</span>
              <strong className="text-sm font-mono text-zinc-800">{summary.attendance.attendance_rate}%</strong>
            </div>
          </div>

          {/* Verdict Box */}
          <div className="border-2 border-dashed border-blue-900 bg-blue-50/50 p-4 rounded text-xs font-sans mb-6">
            <span className="text-[10px] font-bold uppercase text-blue-900 tracking-wider block mb-1">Final Verdict & Promotion Status</span>
            <p className="font-bold text-blue-950 text-sm uppercase">
              {summary.promotion_status}
            </p>
            <p className="text-xs text-zinc-700 italic mt-1 font-serif">
              "{summary.teacher_remark}"
            </p>
          </div>
        </div>

        {/* Traditional Signatures */}
        <div className="pt-6 font-sans border-t border-blue-900 grid grid-cols-2 gap-8 text-center text-xs font-bold text-blue-950">
          {signatures.map((sig, idx) => (
            <div key={idx} className="flex flex-col items-center justify-end min-h-[50px]">
              {sig.toLowerCase().includes('principal') && school.principal_signature_path ? (
                <img src={school.principal_signature_path} alt="Signature" className="h-8 w-auto max-w-[100px] object-contain mb-1" />
              ) : (
                <div className="w-36 border-b border-blue-900 mb-2" />
              )}
              <span className="uppercase text-[10px] tracking-wider font-bold">{sig}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
