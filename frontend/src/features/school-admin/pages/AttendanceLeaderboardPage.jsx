import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Award, Calendar, Users, Trophy, Download, Printer, ShieldAlert } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Select } from '../../../common/ui/select';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { schoolService } from '../../../common/services/schoolService';
import { useToast } from '../../../common/components/Toast';
import { apiClient } from '../../../common/services/apiClient';
import html2pdf from 'html2pdf.js';

export default function AttendanceLeaderboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentYear, isReadOnly } = useAcademicYear();
  const toast = useToast();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [schoolProfile, setSchoolProfile] = useState(null);

  const printAreaRef = useRef(null);

  // Fetch classes and school profile
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [clsData, profileData] = await Promise.all([
          schoolService.getClasses(),
          schoolService.getSchoolProfile()
        ]);
        setClasses(clsData || []);
        setSchoolProfile(profileData || null);
      } catch (err) {
        console.error('Failed to load classes or profile data', err);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch leaderboard data based on class selection
  useEffect(() => {
    if (!currentYear) return;
    
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError('');
      try {
        const queryParams = new URLSearchParams({
          academic_year_id: currentYear.id
        });
        if (selectedClassId !== 'ALL' && selectedClassId !== '') {
          queryParams.append('class_id', selectedClassId);
        }

        const res = await apiClient.get(`/api/school/attendance/leaderboard?${queryParams.toString()}`);
        setLeaderboardData(res || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load attendance leaderboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [currentYear, selectedClassId]);

  const handleBack = () => {
    navigate('/school-admin/attendance');
  };

  const getStudentInitials = (name) => {
    if (!name) return 'ST';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  const handleDownloadPDF = () => {
    if (!printAreaRef.current) return;
    toast.success('Generating certificate PDF for download...', 'Exporting');

    const opt = {
      margin: 10,
      filename: `Attendance_Leaderboard_${currentYear?.name || 'Session'}_${selectedClassId === 'ALL' ? 'Overall' : 'Class'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().from(printAreaRef.current).set(opt).save();
  };

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Attendance Leaderboard Print</title>
          <style>
            @media print {
              @page {
                size: landscape;
                margin: 8mm !important;
              }
              body {
                font-family: sans-serif;
                margin: 0;
                padding: 0;
                background-color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print {
                display: none !important;
              }
            }
            body {
              font-family: sans-serif;
              padding: 20px;
            }
            /* Copy Tailwind CSS variables or standard print styling */
            .podium-container {
              display: flex;
              justify-content: center;
              align-items: flex-end;
              gap: 20px;
              margin-top: 40px;
              padding-bottom: 20px;
            }
            .card-print {
              border: 2px solid #e4e4e7;
              border-radius: 16px;
              padding: 20px;
              text-align: center;
              width: 200px;
              background-color: #fafafa;
            }
            .rank-1-print {
              border-color: #fbbf24;
              background-color: #fffbeb;
              width: 220px;
            }
            .rank-2-print {
              border-color: #9ca3af;
              background-color: #f3f4f6;
            }
            .rank-3-print {
              border-color: #d97706;
              background-color: #fff7ed;
            }
            .avatar-print {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              margin: 0 auto 12px;
              background-color: #e4e4e7;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              overflow: hidden;
            }
            .badge-print {
              font-size: 24px;
              margin-bottom: 8px;
            }
            .name-print {
              font-weight: 800;
              font-size: 14px;
              color: #18181b;
              margin: 8px 0;
            }
            .pct-print {
              font-size: 20px;
              font-weight: 900;
              color: #059669;
            }
            .meta-print {
              font-size: 11px;
              color: #71717a;
              margin-top: 6px;
            }
            .header-print {
              text-align: center;
              border-bottom: 2px solid #e4e4e7;
              padding-bottom: 20px;
              margin-bottom: 20px;
            }
            .header-title {
              font-size: 24px;
              font-weight: 900;
              margin: 4px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header-school {
              font-size: 16px;
              font-weight: 800;
              color: #4b5563;
            }
            .header-year {
              font-size: 12px;
              font-weight: 700;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  // Reorder to Podium order: [Rank 2, Rank 1, Rank 3]
  const getPodiumData = () => {
    if (leaderboardData.length === 0) return [];
    const sorted = [...leaderboardData].sort((a, b) => a.rank - b.rank);
    const result = [];
    
    // Rank 2 goes left
    const r2 = sorted.find(s => s.rank === 2);
    if (r2) result.push(r2);
    
    // Rank 1 goes center
    const r1 = sorted.find(s => s.rank === 1);
    if (r1) result.push(r1);
    
    // Rank 3 goes right
    const r3 = sorted.find(s => s.rank === 3);
    if (r3) result.push(r3);
    
    // If fewer than 3 ranks, fallback to just ordered mapping
    return result.length > 0 ? result : sorted;
  };

  const podiumWinners = getPodiumData();
  const selectedClassNameText = selectedClassId === 'ALL' ? 'School Overall' : classes.find(c => String(c.id) === String(selectedClassId))?.name || 'Class';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Action Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack} 
            type="button"
            className="rounded-full border border-border h-8 w-8 hover:bg-zinc-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">🏆 Attendance Champions</h2>
            <p className="text-text-secondary text-xs mt-0.5">Historical achievements and certificates for completed sessions.</p>
          </div>
        </div>

        {leaderboardData.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="h-9 px-4 text-xs font-bold gap-1.5 border-border hover:bg-zinc-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="h-9 px-4 text-xs font-bold gap-1.5 border-border hover:bg-zinc-50"
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        )}
      </div>

      {/* Configuration bar */}
      <Card className="p-4 border border-border bg-zinc-50/40 dark:bg-zinc-900/40 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Academic Year</span>
              <p className="text-sm font-black text-text-primary mt-0.5">{currentYear?.name} (Completed)</p>
            </div>
          </div>

          <div className="w-full sm:w-[220px] space-y-1">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Select Leaderboard Category</label>
            <Select 
              value={selectedClassId} 
              onChange={e => setSelectedClassId(e.target.value)}
              className="text-xs font-bold cursor-pointer bg-surface h-9"
            >
              <option value="ALL">School Overall</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Leaderboard content container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Computing snapshot...</p>
        </div>
      ) : error ? (
        <Card className="border-dashed border-2 border-red-200 bg-red-50/10 p-8 text-center text-red-600">
          <ShieldAlert className="h-8 w-8 mx-auto text-red-500 mb-3 animate-bounce" />
          <p className="text-sm font-bold">{error}</p>
        </Card>
      ) : leaderboardData.length === 0 ? (
        <Card className="border-dashed border-2 p-16 text-center text-text-muted max-w-lg mx-auto">
          <div className="flex flex-col items-center justify-center gap-3">
            <Trophy className="h-10 w-10 text-text-muted/60 mb-2" />
            <h3 className="text-base font-black text-text-primary">No Attendance Data Found</h3>
            <p className="text-xs text-text-secondary max-w-xs leading-relaxed">
              There are no attendance records marked for the selected Academic Year category, or no working days configured.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          
          {/* Main Visual Ceremony View */}
          <div className="relative py-12 rounded-3xl border border-border/80 shadow-3xs overflow-hidden bg-gradient-to-b from-amber-500/5 via-transparent to-transparent flex flex-col items-center">
            
            {/* Soft decorative background rays */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-200/20 via-transparent to-transparent -z-10 pointer-events-none dark:from-amber-950/20" />

            <h3 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">
              Honorary Awards
            </h3>
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display text-center mb-10 px-4">
              {selectedClassNameText} Attendance champions
            </h2>

            {/* Podium layout */}
            <div className="flex flex-col md:flex-row md:items-end justify-center gap-6 w-full max-w-4xl px-6">
              
              {podiumWinners.map((winner) => {
                const isRank1 = winner.rank === 1;
                const isRank2 = winner.rank === 2;
                const isRank3 = winner.rank === 3;

                return (
                  <div 
                    key={winner.rank}
                    className={`flex flex-col items-center w-full md:w-[240px] ${
                      isRank1 ? 'md:-order-none order-first md:mb-6 scale-105 z-10' : ''
                    } ${isRank2 ? 'md:order-first' : ''} ${isRank3 ? 'md:order-last' : ''}`}
                  >
                    
                    {/* Floating Medal/Crown Icon */}
                    <div className="relative -mb-6 z-20">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md font-black text-xl border-2 ${
                        isRank1 
                          ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 border-yellow-300' 
                          : isRank2 
                            ? 'bg-gradient-to-r from-zinc-300 to-zinc-400 text-zinc-950 border-zinc-200'
                            : 'bg-gradient-to-r from-amber-600 to-orange-700 text-amber-50 border-orange-500'
                      }`}>
                        {isRank1 ? '🥇' : isRank2 ? '🥈' : '🥉'}
                      </div>
                    </div>

                    <Card className={`w-full border-2 text-center rounded-3xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md ${
                      isRank1 
                        ? 'border-yellow-400 bg-gradient-to-b from-yellow-500/10 via-surface to-surface dark:from-yellow-950/20 dark:border-yellow-500/60' 
                        : isRank2 
                          ? 'border-zinc-300 bg-gradient-to-b from-zinc-400/10 via-surface to-surface dark:from-zinc-800/40 dark:border-zinc-700'
                          : 'border-orange-600/30 bg-gradient-to-b from-orange-600/10 via-surface to-surface dark:from-orange-950/10 dark:border-orange-900/40'
                    }`}>
                      <CardContent className="pt-10 pb-6 px-4 space-y-4">
                        
                        {/* Student Image */}
                        <div className={`relative mx-auto rounded-full p-1 border-2 ${
                          isRank1 ? 'border-yellow-400' : isRank2 ? 'border-zinc-300' : 'border-orange-600/30'
                        }`}>
                          <div className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-lg font-black uppercase ${
                            isRank1 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : isRank2 
                                ? 'bg-zinc-100 text-zinc-800'
                                : 'bg-orange-100 text-orange-800'
                          }`}>
                            {winner.student_photo ? (
                              <img 
                                src={winner.student_photo} 
                                alt={winner.student_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{getStudentInitials(winner.student_name)}</span>
                            )}
                          </div>
                        </div>

                        {/* Student Rank Title */}
                        <div className="space-y-1">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isRank1 
                              ? 'bg-yellow-400/20 text-yellow-800 dark:text-yellow-400' 
                              : isRank2 
                                ? 'bg-zinc-400/20 text-zinc-800 dark:text-zinc-300'
                                : 'bg-orange-600/20 text-orange-800 dark:text-orange-400'
                          }`}>
                            Rank #{winner.rank}
                          </span>
                          <h4 className="text-base font-black text-text-primary truncate font-display pt-1.5 leading-snug">
                            {winner.student_name}
                          </h4>
                          <p className="text-[10px] text-text-muted font-bold leading-none">
                            Class {winner.class_name} · Roll No. {winner.roll_number || '—'}
                          </p>
                        </div>

                        {/* Score Indicator */}
                        <div className="pt-2 border-t border-border/60">
                          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                            {winner.achievement_score}%
                          </p>
                          <p className="text-[9px] text-text-muted font-extrabold uppercase tracking-wide mt-1.5">
                            Present: <span className="text-text-primary">{winner.metadata?.present_days}</span> / {winner.metadata?.total_working_days} Days
                          </p>
                        </div>

                      </CardContent>
                    </Card>
                  </div>
                );
              })}

            </div>
          </div>

          {/* Hidden Print Area: Styled for Landscape Print/PDF Certificate Frame */}
          <div className="hidden">
            <div ref={printAreaRef} className="bg-white text-zinc-900 p-12 border-[16px] border-double border-yellow-500 rounded-3xl max-w-5xl mx-auto text-center space-y-8" style={{ width: '268mm', boxSizing: 'border-box' }}>
              
              {/* Header details */}
              <div className="header-print">
                <p className="header-school">{schoolProfile?.name || 'SHIKSHA PILOT ACADEMY'}</p>
                <h1 className="header-title">Certificate of Attendance Achievement</h1>
                <p className="header-year">Academic Session: {currentYear?.name}</p>
              </div>

              {/* Award category description */}
              <div className="space-y-2 py-4">
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0, fontStyle: 'italic', color: '#4b5563' }}>
                  This certificate is honorably presented to the top attendance achievers of
                </p>
                <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1f2937', margin: 0, textTransform: 'uppercase' }}>
                  {selectedClassNameText}
                </h2>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  For demonstrating exceptional commitment, consistency, and dedication to learning throughout the academic session.
                </p>
              </div>

              {/* Winners Podium Table */}
              <div className="podium-container">
                {/* Sorted by rank for landscape card presentation */}
                {[...leaderboardData].sort((a, b) => a.rank - b.rank).map((winner) => {
                  const isRank1 = winner.rank === 1;
                  const isRank2 = winner.rank === 2;
                  const isRank3 = winner.rank === 3;
                  const borderCol = isRank1 ? '#fbbf24' : isRank2 ? '#9ca3af' : '#d97706';
                  const bgCol = isRank1 ? '#fffbeb' : isRank2 ? '#f3f4f6' : '#fff7ed';

                  return (
                    <div 
                      key={winner.rank} 
                      className={`card-print ${isRank1 ? 'rank-1-print' : isRank2 ? 'rank-2-print' : 'rank-3-print'}`}
                      style={{
                        borderColor: borderCol,
                        backgroundColor: bgCol,
                        display: 'inline-block',
                        margin: '0 10px',
                        verticalAlign: 'bottom'
                      }}
                    >
                      <div className="badge-print">{isRank1 ? '🥇' : isRank2 ? '🥈' : '🥉'}</div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309' }}>Rank #{winner.rank}</div>
                      
                      <div className="name-print">{winner.student_name}</div>
                      <div style={{ fontSize: '10px', color: '#4b5563', marginBottom: '8px' }}>
                        Roll No. {winner.roll_number || '—'} · Class {winner.class_name}
                      </div>

                      <div className="pct-print">{winner.achievement_score}%</div>
                      <div className="meta-print">
                        Present: {winner.metadata?.present_days} / {winner.metadata?.total_working_days} Days
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer details */}
              <div className="flex justify-between items-end pt-8 border-t border-zinc-200 text-left text-xs text-zinc-500 font-medium">
                <div>
                  <p>Date Generated: {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p>System Record Verification Code: SP-ACH-{currentYear?.id}-{selectedClassId}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 'bold', color: '#374151' }}>Shiksha Pilot Verification Authority</p>
                  <p>Secure Academic Achievement Registry</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
