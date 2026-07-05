import React, { useState, useEffect } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Dialog } from '../../../common/ui/dialog';
import { Button } from '../../../common/ui/button';
import { studentService } from '../../../common/services/studentService';

const subjectColors = {
  'Mathematics': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  'Physics': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  'Chemistry': 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'English': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'History': 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'Geography': 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'Computer Sc.': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Computer Science': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  'Physical Ed.': 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  'Art & Craft': 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  'Class Activity': 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
};

const getSubjectColor = (subject) =>
  subjectColors[subject] || 'bg-zinc-100 text-zinc-700 dark:text-zinc-400';

const ScoreBar = ({ score, max = 100 }) => {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums text-text-primary w-8 text-right">{score}</span>
    </div>
  );
};

export default function AcademicsPage({ timetable, subjects, results }) {
  const [reportCards, setReportCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const loadReportCards = async () => {
      try {
        const list = await studentService.getPublishedReportCards();
        setReportCards(list || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadReportCards();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Academics</h2>
        <p className="text-text-secondary text-sm mt-1">Timetable, subject results, and performance overview.</p>
      </div>

      {/* Timetable */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Weekly Timetable</h3>
        <div className="overflow-x-auto rounded-xl border border-border shadow-xs">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th className="p-3 text-left font-black text-text-muted uppercase tracking-wider border-b border-border w-28">Time Slot</th>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
                  <th key={d} className="p-3 text-center font-black text-text-primary uppercase tracking-wider border-b border-border">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timetable.Mon.map((slot, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50/50 dark:bg-zinc-900/30'}>
                  <td className="p-3 font-bold text-text-muted border-r border-border whitespace-nowrap">{slot.time}</td>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                    const cell = timetable[day][idx];
                    return (
                      <td key={day} className="p-2 text-center border-r border-border last:border-r-0">
                        {cell ? (
                          <div className={`rounded-lg px-2 py-1.5 ${getSubjectColor(cell.subject)}`}>
                            <p className="font-bold text-[11px] leading-tight">{cell.subject}</p>
                            <p className="text-[9px] opacity-70 mt-0.5">{cell.room}</p>
                          </div>
                        ) : (
                          <span className="text-text-muted text-[10px]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subjects & Results */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Subject Results</h3>
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map(sub => (
                <TableRow key={sub.code}>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${getSubjectColor(sub.name)}`}>
                        {sub.code.split('-')[0]}
                      </span>
                      <span className="font-bold text-text-primary">{sub.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-text-secondary">{sub.teacher}</TableCell>
                  <TableCell className="font-mono font-bold text-text-primary tabular-nums">{sub.score}/{sub.maxScore}</TableCell>
                  <TableCell className="w-40">
                    <ScoreBar score={sub.score} max={sub.maxScore} />
                  </TableCell>
                  <TableCell>
                    <span className={`font-black text-sm ${sub.score >= 90 ? 'text-emerald-600' : sub.score >= 75 ? 'text-blue-600' : sub.score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {sub.grade}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Performance Chart */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Performance Overview</h3>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-3">
              {subjects.map(sub => {
                const pct = Math.round((sub.score / sub.maxScore) * 100);
                const barColor = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-blue-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={sub.code} className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-text-secondary w-32 flex-shrink-0 truncate">{sub.name}</span>
                    <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${barColor} rounded flex items-center justify-end pr-2 transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      >
                        <span className="text-[10px] font-black text-white tabular-nums">{pct}%</span>
                      </div>
                    </div>
                    <span className={`w-10 text-right text-xs font-black tabular-nums ${pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-blue-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {sub.grade}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-5 border-t border-border flex items-center justify-between text-xs">
              <span className="text-text-muted font-semibold">Overall Average</span>
              <span className="font-black text-lg text-text-primary tabular-nums">
                {Math.round(subjects.reduce((a, s) => a + s.score, 0) / subjects.length)}
                <span className="text-text-muted text-sm font-semibold">/100</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <div>
        <h3 className="text-base font-bold text-text-primary mb-4">Report Cards</h3>
        {loading ? (
          <div className="text-xs text-text-muted font-bold">Loading report cards...</div>
        ) : reportCards.length === 0 ? (
          <div className="text-xs text-text-muted py-4">No published report cards available for this student.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {reportCards.map(card => (
              <div key={card.exam_id} className="flex items-center justify-between p-4 border border-border rounded-xl bg-surface shadow-xs hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-text-muted flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-text-primary">{card.exam_name}</p>
                    <p className="text-[10px] text-text-muted">{card.academic_year_name} · Grade: {card.grade}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedCard(card); setIsOpen(true); }}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-text-secondary hover:text-text-primary"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETAILED REPORT CARD DIALOG MODAL (A4 PRINTABLE) */}
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg">
        {selectedCard && (
          <div id="printable-report-card-container" className="space-y-6">
            {/* Action Bar (Not printed) */}
            <div className="flex justify-between items-center bg-zinc-50 border-b border-border p-4 -m-6 mb-6 no-print">
              <span className="text-xs font-bold text-text-secondary">Progress Report Card Preview</span>
              <Button onClick={() => window.print()} className="flex items-center gap-2 font-bold py-1 px-3">
                <Printer className="h-4 w-4" /> Print / Download PDF
              </Button>
            </div>

            {/* A4 Report Card document */}
            <div id="printable-report-card" className="border-4 border-double border-zinc-400 p-8 bg-white text-zinc-900 rounded-sm font-sans relative" style={{ minHeight: '297mm' }}>
              
              {/* Report Card Header */}
              <div className="text-center border-b-2 border-zinc-800 pb-5">
                <div className="flex justify-center mb-3">
                  {selectedCard.school_logo ? (
                    <img src={selectedCard.school_logo} alt="Logo" className="h-16 w-16 object-contain" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-zinc-100 border border-zinc-300 flex items-center justify-center font-bold text-zinc-600 text-lg uppercase">
                      {selectedCard.school_name.charAt(0)}
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 font-display">{selectedCard.school_name}</h2>
                <h4 className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mt-1">ACADEMIC PERFORMANCE REPORT CARD</h4>
                <p className="text-xs font-mono text-zinc-600 mt-2">Academic Year: {selectedCard.academic_year_name}</p>
              </div>

              {/* Student Metadata grid */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 py-6 text-xs border-b border-zinc-300 font-semibold">
                <div>Student Name: <span className="font-bold text-zinc-900">{selectedCard.student_name}</span></div>
                <div>Admission No: <span className="font-mono text-zinc-700">{selectedCard.admission_no || 'N/A'}</span></div>
                <div>Class Name: <span className="font-bold text-zinc-900">{selectedCard.class_name} {selectedCard.class_section ? `(${selectedCard.class_section})` : ''}</span></div>
                <div>Roll Number: <span className="font-mono text-zinc-700">{selectedCard.roll_no}</span></div>
                <div>Father Name: <span className="text-zinc-700">{selectedCard.father_name || 'N/A'}</span></div>
                <div>Mother Name: <span className="text-zinc-700">{selectedCard.mother_name || 'N/A'}</span></div>
              </div>

              {/* Marks Table */}
              <div className="py-6">
                <table className="w-full text-left text-xs border border-zinc-400 border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-400">
                      <th className="p-2 border-r border-zinc-400 font-bold uppercase">Subject</th>
                      <th className="p-2 border-r border-zinc-400 font-bold uppercase text-center w-24">Paper Type</th>
                      <th className="p-2 border-r border-zinc-400 font-bold uppercase text-center w-24">Max Marks</th>
                      <th className="p-2 border-r border-zinc-400 font-bold uppercase text-center w-24">Passing</th>
                      <th className="p-2 border-r border-zinc-400 font-bold uppercase text-center w-28">Obtained Marks</th>
                      <th className="p-2 border-r border-zinc-400 font-bold uppercase text-center w-16">Grade</th>
                      <th className="p-2 font-bold uppercase text-center w-20">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCard.subjects.map((s, idx) => (
                      <tr key={idx} className="border-b border-zinc-300">
                        <td className="p-2 border-r border-zinc-400 font-semibold">{s.subject_name}</td>
                        <td className="p-2 border-r border-zinc-400 text-center font-semibold">{s.paper_type || 'Written'}</td>
                        <td className="p-2 border-r border-zinc-400 text-center font-mono">{s.max_marks}</td>
                        <td className="p-2 border-r border-zinc-400 text-center font-mono">{s.passing_marks}</td>
                        <td className="p-2 border-r border-zinc-400 text-center font-mono font-bold">{s.marks_obtained}</td>
                        <td className="p-2 border-r border-zinc-400 text-center font-bold">{s.grade}</td>
                        <td className="p-2 text-center">
                          <span className={`font-bold uppercase ${s.result === 'PASS' ? 'text-green-700' : 'text-red-700'}`}>
                            {s.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Results Summary grid */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-zinc-50 border border-zinc-300 rounded-sm text-xs font-semibold">
                <div className="space-y-2">
                  <div>Grand Total: <span className="font-mono font-bold text-zinc-900">{selectedCard.total_obtained} / {selectedCard.total_max}</span></div>
                  <div>Percentage: <span className="font-mono font-bold text-primary">{selectedCard.percentage}%</span></div>
                  <div>Overall Grade: <span className="font-bold text-primary">{selectedCard.grade}</span></div>
                </div>
                <div className="space-y-2">
                  <div>Class Rank: <span className="font-bold text-zinc-900">{selectedCard.class_rank}</span></div>
                  <div>Section Rank: <span className="font-bold text-zinc-900">{selectedCard.section_rank}</span></div>
                  <div>Attendance rate: <span className="font-mono text-zinc-700">{selectedCard.attendance.attendance_rate}% ({selectedCard.attendance.present_days}/{selectedCard.attendance.working_days} Days)</span></div>
                </div>
              </div>

              {/* Remarks/Status display */}
              <div className="py-6 space-y-2">
                <h4 className="text-xs font-bold uppercase text-zinc-800">Final Verdict & Remarks</h4>
                <div className="border border-zinc-300 p-4 min-h-[60px] text-xs leading-relaxed text-zinc-700 italic">
                  {selectedCard.result === 'PASS' 
                    ? (selectedCard.report_card_remark || 'Congratulations! Passed all subjects and promoted successfully.') 
                    : 'Requires additional support and performance improvement in core subjects.'
                  }
                </div>
              </div>

              {/* Signatures block */}
              <div className="absolute bottom-10 left-8 right-8 flex justify-between text-xs font-bold pt-8 border-t border-dashed border-zinc-400 font-sans">
                <div className="text-center w-36">
                  <div className="h-8"></div>
                  <div className="border-t border-zinc-800 pt-1 text-zinc-700">Class Teacher</div>
                </div>
                <div className="text-center w-36">
                  <div className="h-8"></div>
                  <div className="border-t border-zinc-800 pt-1 text-zinc-700">Principal Signature</div>
                </div>
              </div>

            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
