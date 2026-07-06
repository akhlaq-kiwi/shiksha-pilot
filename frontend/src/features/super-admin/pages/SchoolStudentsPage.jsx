import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Users, ShieldAlert, FileText, ChevronRight, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Select } from '../../../common/ui/select';
import { platformService } from '../../../common/services/platformService';

// Self-healing avatar image component to handle loading errors gracefully
const StudentAvatar = ({ src, name }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    return (
      <img 
        src={src} 
        alt={name} 
        onError={() => setError(true)} 
        className="w-full h-full object-cover animate-in fade-in duration-200" 
      />
    );
  }
  
  const initials = name
    ? name.split(' ').filter(n => n).filter((_, i) => i < 2).map(n => n[0]).join('').toUpperCase()
    : 'S';
    
  return (
    <div className="w-full h-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center text-lg font-black">
      {initials}
    </div>
  );
};

export default function SchoolStudentsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [schoolName, setSchoolName] = useState('School');
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  
  const [classFilter, setClassFilter] = useState('all');
  const [activeClass, setActiveClass] = useState(null);
  const [activeStudent, setActiveStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchoolAndYears() {
      setLoading(true);
      try {
        const schools = await platformService.getSchools();
        const sc = schools.find(s => String(s.id) === String(id));
        if (sc) setSchoolName(sc.name);

        const years = await platformService.getSchoolAcademicYears(id);
        setAcademicYears(years || []);
        
        const currentYear = years.find(y => y.status === 'Current') || years[0];
        if (currentYear) {
          setSelectedYearId(String(currentYear.id));
        }
      } catch {}
    }
    fetchSchoolAndYears();
  }, [id]);

  useEffect(() => {
    if (!selectedYearId) return;
    async function fetchClassesAndStudents() {
      setLoading(true);
      try {
        const classData = await platformService.getSchoolClasses(id);
        setClasses(classData || []);

        const studentData = await platformService.getSchoolStudents(id);
        setStudents(studentData || []);
      } catch {}
      setLoading(false);
    }
    fetchClassesAndStudents();
  }, [selectedYearId, id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const opt = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', opt);
  };

  // Get distinct classes for drop-down (e.g. Class 1, Class 2, Class 6)
  const uniqueClassNames = Array.from(new Set(
    classes
      .filter(c => String(c.academic_year_id) === String(selectedYearId))
      .map(c => {
        // e.g. "Class 6 - A" -> extract "Class 6" prefix
        const name = c.name || '';
        const dashIdx = name.indexOf('-');
        return dashIdx !== -1 ? name.substring(0, dashIdx).trim() : name.trim();
      })
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Filter classes by Academic Year
  const filteredClassesByYear = classes.filter(c => String(c.academic_year_id) === String(selectedYearId));

  // Filter classes by top Dropdown Filter (e.g. "Class 6")
  const filteredClasses = filteredClassesByYear.filter(c => {
    if (classFilter === 'all') return true;
    const name = c.name || '';
    return name.toLowerCase().startsWith(classFilter.toLowerCase());
  });

  // Filter students for the selected class card
  const filteredStudents = students.filter(s => activeClass ? String(s.class_id) === String(activeClass.id) : false);

  if (activeStudent) {
    const s = activeStudent;
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Student detail header */}
        <div className="flex items-center gap-4 border-b border-border/60 pb-6">
          <Button variant="outline" size="sm" onClick={() => setActiveStudent(null)} className="p-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Student Profile</h2>
            <p className="text-text-secondary text-sm mt-1">{s.name} · Complete details</p>
          </div>
        </div>

        {/* Profile Details Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left summary card */}
          <Card className="lg:col-span-1 p-6 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full border-2 border-primary/20 bg-zinc-50 dark:bg-zinc-900/55 overflow-hidden shadow-sm relative flex items-center justify-center">
                <StudentAvatar src={s.photo_path} name={s.name} />
              </div>
              <h3 className="text-xl font-black text-text-primary tracking-tight font-display mt-4">{s.name}</h3>
              <p className="text-xs text-text-muted mt-1.5 font-bold uppercase tracking-wider">Admission No: <span className="font-mono text-text-primary font-extrabold">{s.admission_no || '—'}</span></p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                  {s.status}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-text-secondary dark:bg-zinc-800 uppercase">
                  {s.class_name ? `${s.class_name}${s.section ? ` - ${s.section}` : ''}` : '—'}
                </span>
              </div>
            </div>

            <hr className="border-border/60" />

            <div className="space-y-4 text-xs font-semibold text-text-secondary">
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Roll Number</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{s.roll_no || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">SR Number</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{s.sr_no || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Category</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{s.category || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Academic Year</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{s.academic_year_name || '—'}</p>
              </div>
            </div>
          </Card>

          {/* Right Detailed Columns */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Personal Details */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-text-secondary">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Date of Birth</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{formatDate(s.dob)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Gender</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5 uppercase">{s.gender || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Blood Group</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.blood_group || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Religion</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.religion || '—'}</p>
                </div>
              </div>
            </Card>

            {/* Parent details */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Parent / Guardian Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-text-secondary">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Father's Name</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.father_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Father's Phone</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.father_phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Mother's Name</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.mother_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Mother's Phone</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.mother_phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Guardian Name</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.guardian_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Guardian Contact</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.guardian_phone || '—'}</p>
                </div>
              </div>
            </Card>

            {/* Address */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Address Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-2">
                  <h4 className="font-bold text-text-secondary uppercase text-[10px] tracking-wider">Current Address</h4>
                  <p className="text-sm text-text-primary leading-relaxed font-semibold">
                    {s.current_address_line || '—'}<br />
                    {s.current_city ? `${s.current_city}, ` : ''}{s.current_state || ''}<br />
                    {s.current_country || 'India'} - {s.current_pin_code || ''}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-text-secondary uppercase text-[10px] tracking-wider">Permanent Address</h4>
                  {s.same_as_current === 1 ? (
                    <p className="text-xs text-text-muted italic">Same as Current Address</p>
                  ) : (
                    <p className="text-sm text-text-primary leading-relaxed font-semibold">
                      {s.permanent_address_line || '—'}<br />
                      {s.permanent_city ? `${s.permanent_city}, ` : ''}{s.permanent_state || ''}<br />
                      {s.permanent_country || 'India'} - {s.permanent_pin_code || ''}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Documents */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Registered Documents</h3>
              <div className="space-y-2">
                {[
                  { name: 'Birth Certificate', path: s.birth_cert_path },
                  { name: 'Aadhaar Card', path: s.aadhaar_path },
                  { name: 'Transfer Certificate', path: s.transfer_cert_path },
                  { name: 'Previous Marksheets', path: s.report_card_path },
                  { name: 'Additional Documents', path: s.additional_docs_path }
                ].filter(d => d.path).length === 0 ? (
                  <p className="text-xs text-text-muted italic">No documents uploaded for this profile.</p>
                ) : (
                  [
                    { name: 'Birth Certificate', path: s.birth_cert_path },
                    { name: 'Aadhaar Card', path: s.aadhaar_path },
                    { name: 'Transfer Certificate', path: s.transfer_cert_path },
                    { name: 'Previous Marksheets', path: s.report_card_path },
                    { name: 'Additional Documents', path: s.additional_docs_path }
                  ]
                    .filter(d => d.path)
                    .map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-text-muted" />
                          <span className="text-xs font-bold text-text-primary">{d.name}</span>
                        </div>
                        <a 
                          href={d.path} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-black text-primary hover:underline bg-primary/5 px-2.5 py-1 rounded"
                        >
                          View Document
                        </a>
                      </div>
                    ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (activeClass) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Student Listing Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setActiveClass(null)} className="p-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">{schoolName} — Roster</h2>
              <p className="text-text-secondary text-sm mt-1">{activeClass.name} · Student directory</p>
            </div>
          </div>
        </div>

        {/* Student listing grid cards */}
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading class list…</div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center border border-dashed border-border rounded-2xl bg-surface/50">
            <GraduationCap className="h-8 w-8 text-text-muted animate-pulse" />
            <span>No students enrolled in this class yet.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredStudents.map(s => (
              <div
                key={s.id}
                onClick={() => setActiveStudent(s)}
                className="bg-surface border border-border rounded-2xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col items-center text-center cursor-pointer select-none border-border/80 hover:border-primary/40 group"
              >
                <div className="w-16 h-16 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden mb-4 shadow-3xs flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                  <StudentAvatar src={s.photo_path} name={s.name} />
                </div>
                <h3 className="font-bold text-text-primary text-base truncate w-full group-hover:text-primary transition-colors">{s.name}</h3>
                <div className="text-[10px] text-text-muted font-bold tracking-tight uppercase mt-1.5 space-y-0.5">
                  <p>Roll No: {s.roll_no || '—'}</p>
                  {s.section && <p>Section: {s.section}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Listing Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => nav('/super-admin/schools')} className="p-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">{schoolName} — Class Directory</h2>
            <p className="text-text-secondary text-sm mt-1">Select an academic year and browse student counts by class.</p>
          </div>
        </div>
      </div>

      {/* Filter and selector toolbar */}
      <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Academic Year:</span>
          <Select
            value={selectedYearId}
            onChange={e => {
              setSelectedYearId(e.target.value);
              setActiveClass(null);
            }}
            className="w-full sm:w-48"
          >
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>
                {y.name} {y.status === 'Current' ? '(Current)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Class Filter:</span>
          <Select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <option value="all">All Classes</option>
            {uniqueClassNames.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Classes Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-text-muted">Loading class list…</div>
      ) : filteredClasses.length === 0 ? (
        <div className="py-16 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center border border-dashed border-border rounded-2xl bg-surface/50">
          <ShieldAlert className="h-8 w-8 text-text-muted animate-pulse" />
          <span>No classes configured for this academic year yet.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredClasses.map(cls => (
            <div
              key={cls.id}
              onClick={() => setActiveClass(cls)}
              className="bg-surface border border-border rounded-2xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col justify-between h-36 cursor-pointer select-none border-border/80 hover:border-primary/45 group"
            >
              <div>
                <h3 className="font-extrabold text-text-primary text-lg group-hover:text-primary transition-colors leading-tight">
                  {cls.name}
                </h3>
                <p className="text-[10px] text-text-muted font-bold tracking-tight uppercase mt-1">
                  Year: {cls.academic_year_name}
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-text-secondary border-t border-border/40 pt-3">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-text-muted" />
                  {cls.students_count || 0} Student{cls.students_count !== 1 ? 's' : ''}
                </span>
                <ChevronRight className="h-4 w-4 text-text-muted group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
