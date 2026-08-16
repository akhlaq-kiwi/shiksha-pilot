import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy, Award, GraduationCap, Medal, Search, Filter, Calendar, Users,
  Download, Printer, Eye, Lock, FileText, Sparkles, ChevronRight, ArrowLeft,
  CheckCircle2, X, School, ShieldAlert
} from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { achievementsService } from '../../../common/services/achievementsService';
import { schoolService } from '../../../common/services/schoolService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { useToast } from '../../../common/components/Toast';
import html2pdf from 'html2pdf.js';

const formatClassName = (rawClass) => {
  if (!rawClass) return '';
  const clean = String(rawClass).trim();
  if (clean.toLowerCase().startsWith('class ')) {
    return clean;
  }
  return `Class ${clean}`;
};

const formatClassScope = (rawClass) => {
  if (!rawClass) return '';
  const clean = String(rawClass).trim();
  if (clean.toLowerCase().startsWith('class ')) {
    return clean.toUpperCase();
  }
  return `CLASS ${clean}`.toUpperCase();
};

export default function AchievementsPage() {
  const toast = useToast();
  const { currentYear } = useAcademicYear();

  // Navigation / View State
  const [selectedCategory, setSelectedCategory] = useState(null); // null = Landing Page, 'attendance_champions' | 'academic_excellence'

  // Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    academic_year_id: null,
    categories_summary: {
      attendance_champions: { count: 0, label: 'Attendance Champions', description: 'Students with outstanding school attendance.' },
      academic_excellence: { count: 0, label: 'Academic Excellence', description: 'Top performers in the final examinations.' }
    },
    achievements: [],
    classes: [],
    academic_years: []
  });
  const [schoolProfile, setSchoolProfile] = useState(null);

  // Filter States
  const [selectedYearId, setSelectedYearId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedLevel, setSelectedLevel] = useState('all'); // 'all', 'school', 'class'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'rank', 'class'

  // Modals State
  const [activeCertificate, setActiveCertificate] = useState(null);
  const [activeReportCard, setActiveReportCard] = useState(null);
  const [loadingReportCard, setLoadingReportCard] = useState(false);
  const [reportCardError, setReportCardError] = useState('');

  const certPrintRef = useRef(null);

  // Load School Profile
  useEffect(() => {
    schoolService.getSchoolProfile()
      .then(res => setSchoolProfile(res))
      .catch(err => console.error("Failed to load school profile", err));
  }, []);

  // Load Achievements Data on Filter change
  useEffect(() => {
    loadAchievementsData();
  }, [selectedCategory, selectedYearId, selectedClassId, selectedLevel, sortBy]);

  const loadAchievementsData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        academic_year_id: selectedYearId || undefined,
        category: selectedCategory || undefined,
        class_id: selectedClassId !== 'ALL' ? selectedClassId : undefined,
        level: selectedLevel !== 'all' ? selectedLevel : undefined,
        search: searchQuery || undefined,
        sort: sortBy
      };

      const res = await achievementsService.getAchievements(params);
      setData(res || {});
      if (!selectedYearId && res.academic_year_id) {
        setSelectedYearId(String(res.academic_year_id));
      }
    } catch (err) {
      console.error("Failed to load achievements", err);
      setError("Failed to load achievements. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAchievementsData();
  };

  // Helper for Initials
  const getInitials = (name) => {
    if (!name) return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Open Certificate Modal
  const handleOpenCertificate = (item) => {
    setActiveCertificate(item);
  };

  // Open Report Card Modal (with security/permission error handling)
  const handleOpenReportCard = async (item) => {
    setActiveReportCard(null);
    setReportCardError('');
    setLoadingReportCard(true);
    try {
      const res = await achievementsService.getAchievementReportCard(item.id);
      setActiveReportCard(res);
    } catch (err) {
      console.error("Report card fetch error", err);
      const msg = err.response?.data?.message || err.message || "Report card access restricted.";
      toast.error(msg, "Access Restricted");
      setReportCardError(msg);
    } finally {
      setLoadingReportCard(false);
    }
  };

  // Certificate Download PDF
  const handleDownloadCertPDF = () => {
    if (!certPrintRef.current) return;
    toast.info("Generating Certificate PDF for download...", "Exporting");
    const opt = {
      margin: 5,
      filename: `Certificate_${activeCertificate?.student_name.replace(/\s+/g, '_')}_${activeCertificate?.rank}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().from(certPrintRef.current).set(opt).save();
  };

  // Certificate Print
  const handlePrintCert = () => {
    if (!certPrintRef.current) return;
    const content = certPrintRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Certificate - ${activeCertificate?.student_name || 'Achievement'}</title>
          <style>
            @page { size: landscape; margin: 8mm; }
            body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #fff; text-align: center; }
            .cert-box { border: 12px double #eab308; padding: 30px; border-radius: 24px; max-width: 900px; margin: 0 auto; background: #fff; }
            .cert-header { border-bottom: 2px solid #e5e7eb; pb-4; margin-bottom: 20px; }
            .cert-title { font-size: 28px; font-weight: 900; text-transform: uppercase; color: #111827; letter-spacing: 1px; margin: 10px 0; }
            .cert-school { font-size: 20px; font-weight: 800; color: #374151; margin: 0; }
            .cert-body { margin: 25px 0; font-size: 16px; color: #4b5563; line-height: 1.6; }
            .cert-name { font-size: 32px; font-weight: 900; color: #b45309; margin: 10px 0; font-family: Georgia, serif; }
            .cert-rank { font-size: 24px; font-weight: 800; color: #d97706; margin: 10px 0; }
            .cert-score { font-size: 22px; font-weight: 900; color: #059669; margin: 15px 0; }
            .cert-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; pt-10; border-top: 1px solid #e5e7eb; }
            .sign-line { border-top: 1px solid #9ca3af; width: 180px; text-align: center; padding-top: 6px; font-weight: bold; font-size: 12px; color: #374151; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // Filtered List for active category
  const filteredAchievements = (data.achievements || []).filter(item => {
    if (selectedCategory && item.category !== selectedCategory && item.feature_type !== selectedCategory) {
      if (selectedCategory === 'attendance_champions' && item.feature_type !== 'attendance_leaderboard') return false;
      if (selectedCategory === 'academic_excellence' && item.feature_type !== 'academic_excellence') return false;
    }
    if (selectedClassId && selectedClassId !== 'ALL' && selectedClassId !== 'all') {
      if (String(item.class_id) !== String(selectedClassId)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (item.student_name || '').toLowerCase().includes(q);
      const rollMatch = (item.roll_number || '').toLowerCase().includes(q);
      const classMatch = (item.class_name || '').toLowerCase().includes(q);
      if (!nameMatch && !rollMatch && !classMatch) return false;
    }
    return true;
  });

  // Separate School Overall vs Class Level
  const schoolOverallAchievements = filteredAchievements.filter(item => item.level === 'school' || item.class_id === null);
  const classAchievements = filteredAchievements.filter(item => item.level !== 'school' && item.class_id !== null);

  // Group class achievements by Class Name
  const classGroups = classAchievements.reduce((acc, item) => {
    const key = item.class_name || 'Other Class';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Academic Year Card selection state
  const [selectedYearCardId, setSelectedYearCardId] = useState(null);

  const availableYears = data.available_achievement_years || [];
  const currentYearObj = availableYears.find(y => String(y.id) === String(selectedYearCardId));

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            {(selectedCategory || selectedYearCardId) && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (selectedCategory) {
                    setSelectedCategory(null);
                  } else {
                    setSelectedYearCardId(null);
                  }
                }}
                className="h-9 w-9 rounded-xl border border-border hover:bg-secondary/80"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display flex items-center gap-2.5">
                <Trophy className="h-7 w-7 text-amber-500" />
                {selectedCategory === 'attendance_champions'
                  ? 'Attendance Champions'
                  : selectedCategory === 'academic_excellence'
                  ? 'Academic Excellence'
                  : selectedYearCardId && currentYearObj
                  ? `Achievements for ${currentYearObj.name}`
                  : 'Hall of Fame & Achievements'}
              </h2>
              <p className="text-text-secondary text-sm mt-1">
                {selectedCategory === 'attendance_champions'
                  ? 'Recognizing students with outstanding school attendance and commitment.'
                  : selectedCategory === 'academic_excellence'
                  ? 'Honoring top academic performers in examination results.'
                  : selectedYearCardId && currentYearObj
                  ? `Celebrating excellence in attendance and academic performance for ${currentYearObj.name}.`
                  : 'Celebrating excellence in attendance and academic performance across academic sessions.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. NO MIGRATIONS / NEW SCHOOL EMPTY STATE                                 */}
      {/* ========================================================================= */}
      {availableYears.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center p-14 text-center bg-surface rounded-3xl border border-border/80 space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-text-primary font-display">No Achievement History Available Yet</h3>
          <p className="text-text-secondary text-sm max-w-md leading-relaxed">
            Academic Year achievement cards will automatically appear here once your school completes its first Academic Year Migration.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACADEMIC YEAR CARDS LISTING (When no specific year card opened)        */}
      {/* ========================================================================= */}
      {availableYears.length > 0 && !selectedYearCardId && !selectedCategory && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-text-primary font-display flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              Academic Year Achievement History
            </h3>
            <span className="text-xs text-text-secondary font-medium">
              Select an Academic Year to view achievements
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableYears.map((year) => (
              <Card
                key={year.id}
                onClick={() => {
                  setSelectedYearCardId(year.id);
                  setSelectedYearId(String(year.id));
                }}
                className="group relative overflow-hidden border-2 border-border hover:border-amber-400/80 rounded-3xl p-6 transition-all duration-300 hover:shadow-xl cursor-pointer bg-gradient-to-br from-surface via-surface to-amber-500/5"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {year.status === 'Archived' ? 'Completed Session' : (year.migration_status === 'Completed' ? 'Migrated Session' : 'Active Session')}
                  </span>
                </div>

                <div className="mt-5 space-y-1">
                  <h4 className="text-xl font-bold text-text-primary font-display group-hover:text-amber-600 transition-colors">
                    Achievements for {year.name}
                  </h4>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    View top attendance achievers & academic toppers for session {year.name}.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>View Achievements</span>
                  <span className="flex items-center gap-1 font-bold">
                    Explore <ChevronRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LANDING CATEGORIES VIEW (When an Academic Year card is opened)          */}
      {/* ========================================================================= */}
      {availableYears.length > 0 && selectedYearCardId && !selectedCategory && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Category Cards Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Card 1: Attendance Champions */}
            <Card
              onClick={() => setSelectedCategory('attendance_champions')}
              className="group relative overflow-hidden border-2 border-border hover:border-amber-400/80 rounded-3xl p-8 transition-all duration-300 hover:shadow-xl cursor-pointer bg-gradient-to-br from-surface via-surface to-amber-500/5 dark:to-amber-500/10"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-all transform group-hover:scale-110">
                <Award className="h-40 w-40 text-amber-500" />
              </div>

              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                    <Award className="h-7 w-7" />
                  </div>
                  <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {data.categories_summary.attendance_champions.count} Achievements
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-text-primary tracking-tight font-display group-hover:text-amber-600 transition-colors flex items-center gap-2">
                    Attendance Champions
                    <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all text-amber-500" />
                  </h3>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed font-medium">
                    Students with outstanding school attendance, discipline, and daily commitment to learning throughout session {currentYearObj?.name}.
                  </p>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>Explore School & Class Champions</span>
                  <span className="flex items-center gap-1 font-bold">
                    View Gallery <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Card>

            {/* Card 2: Academic Excellence */}
            <Card
              onClick={() => setSelectedCategory('academic_excellence')}
              className="group relative overflow-hidden border-2 border-border hover:border-emerald-400/80 rounded-3xl p-8 transition-all duration-300 hover:shadow-xl cursor-pointer bg-gradient-to-br from-surface via-surface to-emerald-500/5 dark:to-emerald-500/10"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-all transform group-hover:scale-110">
                <GraduationCap className="h-40 w-40 text-emerald-500" />
              </div>

              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {data.categories_summary.academic_excellence.count} Achievements
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-text-primary tracking-tight font-display group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                    Academic Excellence
                    <ChevronRight className="h-5 w-5 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all text-emerald-500" />
                  </h3>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed font-medium">
                    Top academic performers in examination results for session {currentYearObj?.name}. Celebrates scholars with highest percentages and subject mastery.
                  </p>
                </div>

                <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Explore Class Examination Toppers</span>
                  <span className="flex items-center gap-1 font-bold">
                    View Gallery <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Card>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CATEGORY DETAIL VIEW (When category is selected)                       */}
      {/* ========================================================================= */}
      {selectedCategory && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Filters & Control Panel */}
          <Card className="p-5 shadow-2xs border border-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Search Input (Left) */}
              <div className="space-y-1">
                <label htmlFor="search" className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Search</label>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Input id="search"
                    type="text"
                    placeholder="Search by name, roll..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-10 pl-9 pr-3 text-xs font-bold rounded-xl"
                  />
                  <Search className="h-4 w-4 absolute left-3 top-3 text-text-muted" />
                </form>
              </div>

              {/* Class Filter (Right) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Class Filter</label>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-surface text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  {(data.classes || []).map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? ` - ${c.section}` : ''}</option>
                  ))}
                </select>
              </div>

            </div>
          </Card>

          {/* Loader */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-72 bg-surface border border-border rounded-3xl animate-pulse"></div>
              ))}
            </div>
          ) : filteredAchievements.length === 0 ? (
            <Card className="p-16 text-center border-dashed border-2 border-border/80 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/20">
              <Trophy className="h-12 w-12 text-text-muted/40 mx-auto mb-3" />
              <h4 className="text-base font-bold text-text-primary">
                {currentYearObj?.status !== 'Archived' && currentYearObj?.migration_status !== 'Completed'
                  ? 'Achievements & Certificates Pending Migration'
                  : 'No matching achievements found.'}
              </h4>
              <p className="text-xs text-text-secondary mt-1">
                {currentYearObj?.status !== 'Archived' && currentYearObj?.migration_status !== 'Completed'
                  ? 'Official Achievement Certificates and Attendance Champions will be calculated and generated automatically upon Academic Year Migration at the end of the session.'
                  : 'Try adjusting your class or level filters.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-10">

              {/* SECTION B: CLASS WISE CHAMPIONS */}
              {Object.keys(classGroups).length > 0 && (selectedLevel === 'all' || selectedLevel === 'class') && (
                <div className="space-y-8">
                  {Object.entries(classGroups).map(([className, items]) => {
                    const sortedItems = [...items].sort((a, b) => parseInt(a.rank || 0) - parseInt(b.rank || 0));
                    return (
                      <div key={className} className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary uppercase tracking-wider">
                            {className}
                          </span>
                          <span className="text-xs text-text-muted font-bold">Top Achievers</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {sortedItems.map(item => (
                            <AchievementCard
                              key={item.id}
                              item={item}
                              onOpenCert={handleOpenCertificate}
                              onOpenReport={handleOpenReportCard}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* FULL-SCREEN CERTIFICATE PREVIEW MODAL                                    */}
      {/* ========================================================================= */}
      {activeCertificate && (
        <Dialog
          isOpen={!!activeCertificate}
          onClose={() => setActiveCertificate(null)}
          title="Achievement Certificate Preview"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            
            {/* Modal Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <span className="text-xs font-bold text-text-muted">
                Official Achievement Certificate
              </span>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handleDownloadCertPDF} className="font-bold flex items-center gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </Button>
              </div>
            </div>

            {/* Printable Certificate Box */}
            <div className="overflow-x-auto p-1 sm:p-2">
              <div
                ref={certPrintRef}
                className="bg-white text-zinc-900 p-3 sm:p-4 rounded-3xl border-4 border-amber-500 max-w-3xl mx-auto shadow-lg text-center font-sans"
              >
                <div className="border-2 border-amber-400 p-5 sm:p-8 rounded-2xl space-y-5 bg-white">
                  
                  {/* School & Certificate Title Header */}
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-zinc-700 uppercase tracking-wide">
                      {schoolProfile?.name || 'Jamiya Sams Academy'}
                    </p>
                    <h1 className="text-lg sm:text-2xl font-bold text-zinc-900 tracking-tight uppercase font-display">
                      {activeCertificate.category === 'academic_excellence' 
                        ? 'CERTIFICATE OF ACADEMIC EXCELLENCE' 
                        : 'CERTIFICATE OF ATTENDANCE ACHIEVEMENT'}
                    </h1>
                    <p className="text-[11px] sm:text-xs text-zinc-500 font-bold">
                      Academic Session: {(currentYearObj?.name || data.academic_year_name || '2026-2027').replace(/[\u2010-\u2015\u2212–—]/g, '-')}
                    </p>
                    <div className="border-b border-zinc-200 w-full pt-2"></div>
                  </div>

                  {/* Presentation & Scope Text */}
                  <div className="space-y-1.5 py-1">
                    <p className="text-xs sm:text-sm font-medium italic text-zinc-600">
                      This certificate is honorably presented to the top {activeCertificate.category === 'academic_excellence' ? 'academic' : 'attendance'} achievers of
                    </p>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900 uppercase tracking-wider font-display">
                      {activeCertificate.level === 'school' ? 'SCHOOL OVERALL' : formatClassScope(activeCertificate.class_name)}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                      {activeCertificate.category === 'academic_excellence'
                        ? 'For demonstrating outstanding academic performance, subject mastery, and intellectual excellence.'
                        : 'For demonstrating exceptional commitment, consistency, and dedication to learning throughout the academic session.'}
                    </p>
                  </div>

                  {/* Center Student Detail Box */}
                  <div className="bg-[#FFFDF6] border-2 border-amber-400/90 rounded-2xl p-4 sm:p-5 w-60 sm:w-72 mx-auto shadow-2xs space-y-2 flex flex-col items-center justify-center">
                    
                    {/* Ribbon Medal / Rank Badge */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-2xl sm:text-3xl">
                        {activeCertificate.rank === 1 ? '🥇' : activeCertificate.rank === 2 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                        Rank #{activeCertificate.rank}
                      </span>
                    </div>

                    {/* Student Avatar (Photo or Initials) */}
                    <div className="my-1">
                      {activeCertificate.student_photo ? (
                        <img
                          src={activeCertificate.student_photo.startsWith('http') ? activeCertificate.student_photo : `${activeCertificate.student_photo.startsWith('/') ? '' : '/'}${activeCertificate.student_photo}`}
                          alt={activeCertificate.student_name}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-amber-400 shadow-sm"
                        />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-zinc-200 border-2 border-zinc-300 text-zinc-800 font-bold text-2xl sm:text-3xl flex items-center justify-center shadow-sm">
                          {activeCertificate.student_name ? activeCertificate.student_name.substring(0, 2).toUpperCase() : 'ST'}
                        </div>
                      )}
                    </div>

                    {/* Student Name */}
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight leading-tight">
                      {activeCertificate.student_name}
                    </h3>

                    {/* Roll No & Class */}
                    <p className="text-[11px] text-zinc-500 font-semibold">
                      {activeCertificate.roll_number ? `Roll No. ${activeCertificate.roll_number} · ` : ''}{formatClassName(activeCertificate.class_name)}
                    </p>

                    {/* Big Green Percentage */}
                    <p className="text-xl sm:text-2xl font-bold text-emerald-600 pt-1 font-sans">
                      {activeCertificate.achievement_score}%
                    </p>

                    {/* Sub detail (Days / Marks) */}
                    <p className="text-[11px] sm:text-[11px] font-bold text-zinc-500">
                      {activeCertificate.category === 'academic_excellence'
                        ? (activeCertificate.metadata?.total_obtained 
                            ? `Total: ${activeCertificate.metadata.total_obtained} / ${activeCertificate.metadata.total_max} Marks` 
                            : 'Final Score')
                        : (activeCertificate.metadata?.present_days 
                            ? `Present: ${activeCertificate.metadata.present_days} / ${activeCertificate.metadata.total_working_days} Days` 
                            : 'Attendance Rate')}
                    </p>

                  </div>

                  {/* Bottom Signature Section */}
                  <div className="flex justify-between items-end pt-6 text-[11px] sm:text-xs font-bold text-zinc-700">
                    <div className="text-left">
                      <span>Teacher Sign</span>
                    </div>
                    <div className="text-right">
                      <span>Principal Sign</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* READ-ONLY REPORT CARD MODAL                                               */}
      {/* ========================================================================= */}
      {loadingReportCard ? (
        <Dialog isOpen={loadingReportCard} onClose={() => setLoadingReportCard(false)} title="Loading Report Card...">
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-xs font-bold text-text-muted">Fetching Student Final Report Card...</p>
          </div>
        </Dialog>
      ) : activeReportCard && (
        <Dialog
          isOpen={!!activeReportCard}
          onClose={() => setActiveReportCard(null)}
          title="Student Final Report Card (Read-Only)"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            
            {/* Header info */}
            <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {activeReportCard.result || 'PASS'}
                </span>
                <h3 className="text-xl font-bold text-text-primary">{activeReportCard.student_name}</h3>
                <p className="text-xs text-text-secondary font-bold">
                  Class: {activeReportCard.class_name} {activeReportCard.class_section ? `(${activeReportCard.class_section})` : ''} · Roll No. {activeReportCard.roll_no || '—'}
                </p>
              </div>

              <div className="flex gap-4 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6 text-right">
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase">Overall Marks</p>
                  <p className="text-lg font-bold text-text-primary">{activeReportCard.total_obtained} / {activeReportCard.total_max}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase">Percentage</p>
                  <p className="text-lg font-bold text-emerald-600">{activeReportCard.percentage}%</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase">Grade</p>
                  <p className="text-lg font-bold text-amber-500">{activeReportCard.grade}</p>
                </div>
              </div>
            </div>

            {/* Subject Marks Table */}
            <div className="border border-border rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 border-b border-border text-text-secondary uppercase text-[11px] font-bold">
                  <tr>
                    <th className="p-3">Subject</th>
                    <th className="p-3 text-right">Max Marks</th>
                    <th className="p-3 text-right">Pass Marks</th>
                    <th className="p-3 text-right">Obtained</th>
                    <th className="p-3 text-center">Grade</th>
                    <th className="p-3 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-semibold">
                  {(activeReportCard.subjects || []).map((sub, idx) => (
                    <tr key={idx} className="hover:bg-secondary/20">
                      <td className="p-3 font-bold text-text-primary">{sub.subject_name}</td>
                      <td className="p-3 text-right">{sub.max_marks}</td>
                      <td className="p-3 text-right">{sub.passing_marks}</td>
                      <td className="p-3 text-right font-bold text-text-primary">{sub.marks_obtained}</td>
                      <td className="p-3 text-center font-bold">{sub.grade}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          sub.result === 'PASS' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                        }`}>
                          {sub.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Remark */}
            {activeReportCard.report_card_remark && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-border rounded-xl space-y-1">
                <p className="text-[11px] font-bold text-text-muted uppercase">Teacher Remark</p>
                <p className="text-xs text-text-primary font-medium italic">&quot;{activeReportCard.report_card_remark}&quot;</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setActiveReportCard(null)} variant="outline" size="sm" className="font-bold">
                Close Report Card
              </Button>
            </div>

          </div>
        </Dialog>
      )}

    </div>
  );
}

// ─── REUSABLE ACHIEVEMENT CARD COMPONENT ──────────────────────────────────────
function AchievementCard({ item, onOpenCert, onOpenReport }) {
  const isRank1 = item.rank === 1;
  const isRank2 = item.rank === 2;
  const isRank3 = item.rank === 3;

  const medalBadge = isRank1 ? '🥇' : isRank2 ? '🥈' : '🥉';
  const borderClass = isRank1
    ? 'border-amber-400/90 ring-1 ring-amber-400/20 bg-amber-500/5'
    : isRank2
    ? 'border-zinc-400/90 ring-1 ring-zinc-400/20 bg-zinc-500/5'
    : 'border-amber-700/90 ring-1 ring-amber-700/20 bg-amber-700/5';

  const isAcademic = item.category === 'academic_excellence' || item.feature_type === 'academic_excellence';

  return (
    <Card className={`group relative border-2 rounded-3xl p-6 transition-all duration-300 hover:shadow-lg flex flex-col justify-between ${borderClass}`}>
      
      {/* Top Header Badge */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{medalBadge}</span>
          <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
            Rank #{item.rank}
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-surface border border-border text-text-secondary">
          {item.level === 'school' ? 'School Overall' : item.class_name}
        </span>
      </div>

      {/* Student Info */}
      <div className="py-5 flex items-center gap-4">
        <div className="relative">
          {item.student_photo ? (
            <img
              src={item.student_photo}
              alt={item.student_name}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-border shadow-xs"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border-2 border-primary/20 text-primary font-bold text-lg flex items-center justify-center shadow-xs">
              {item.student_name ? item.student_name.substring(0, 2).toUpperCase() : 'ST'}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-base font-bold text-text-primary truncate group-hover:text-primary transition-colors font-display">
            {item.student_name}
          </h4>
          <p className="text-xs text-text-secondary font-bold truncate">
            {formatClassName(item.class_name)} {item.roll_number ? `· Roll No. ${item.roll_number}` : ''}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-bold text-emerald-600 font-sans">
              {item.achievement_score}%
            </span>
            <span className="text-[11px] text-text-muted font-bold">
              {isAcademic ? 'Exam Score' : 'Attendance Rate'}
            </span>
          </div>
        </div>
      </div>

      {/* Certificate Thumbnail Box */}
      <div
        onClick={() => onOpenCert(item)}
        className="p-3 bg-surface border border-border rounded-2xl hover:border-primary/50 transition-all cursor-pointer space-y-2 group/thumb"
      >
        <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
          <span>Certificate Preview</span>
          <Eye className="h-3.5 w-3.5 text-primary opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
        </div>
        <div className="h-16 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-400/30 p-2 flex items-center justify-between">
          <div className="space-y-0.5 text-left">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase truncate max-w-[140px]">
              {isAcademic ? 'Academic Excellence' : 'Attendance Champion'}
            </p>
            <p className="text-[8px] text-zinc-500 font-bold truncate max-w-[140px]">
              {item.student_name}
            </p>
          </div>
          <span className="text-lg">{medalBadge}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 mt-2 border-t border-border/60 flex items-center gap-2">
        <Button
          onClick={() => onOpenCert(item)}
          variant="outline"
          size="sm"
          className="w-full font-bold text-xs shadow-2xs border-border hover:bg-secondary/60"
        >
          View Certificate
        </Button>
      </div>

    </Card>
  );
}
