import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ShieldAlert, FileText, ChevronRight, User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { platformService } from '../../../common/services/platformService';

// Self-healing avatar image component to handle loading errors gracefully
const TeacherAvatar = ({ src, name }) => {
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
    : 'T';
    
  return (
    <div className="w-full h-full bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 flex items-center justify-center text-lg font-black">
      {initials}
    </div>
  );
};

export default function SchoolTeachersPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [schoolName, setSchoolName] = useState('School');
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const schools = await platformService.getSchools();
        const sc = schools.find(s => String(s.id) === String(id));
        if (sc) {
          setSchoolName(sc.name);
        }

        const data = await platformService.getSchoolTeachers(id);
        setTeachers(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const activeCount = teachers.filter(t => t.status === 'ACTIVE').length;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const opt = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-IN', opt);
  };

  if (selectedTeacher) {
    const t = selectedTeacher;
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Detail Header */}
        <div className="flex items-center gap-4 border-b border-border/60 pb-6">
          <Button variant="outline" size="sm" onClick={() => setSelectedTeacher(null)} className="p-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Teacher Profile</h2>
            <p className="text-text-secondary text-sm mt-1">{t.name} · Complete details</p>
          </div>
        </div>

        {/* Profile Details Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Summary Card */}
          <Card className="lg:col-span-1 p-6 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full border-2 border-primary/20 bg-zinc-50 dark:bg-zinc-900/55 overflow-hidden shadow-sm relative">
                <TeacherAvatar src={t.photo_path} name={t.name} />
              </div>
              <h3 className="text-xl font-black text-text-primary tracking-tight font-display mt-4">{t.name}</h3>
              <p className="text-xs text-text-muted mt-1.5 font-bold uppercase tracking-wider">Employee ID: <span className="font-mono text-text-primary font-extrabold">{t.employee_id || '—'}</span></p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${t.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                  {t.status}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-text-secondary dark:bg-zinc-800 uppercase">
                  {t.department || 'General'}
                </span>
              </div>
            </div>

            <hr className="border-border/60" />

            <div className="space-y-4 text-xs font-semibold text-text-secondary">
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Father's Name</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{t.father_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Mother's Name</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{t.mother_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Phone</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{t.phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Emergency Contact</p>
                <p className="text-sm font-bold text-text-primary mt-0.5">{t.emergency_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Email Address</p>
                <p className="text-sm font-bold text-text-primary mt-0.5 break-all">{t.email || '—'}</p>
              </div>
            </div>
          </Card>

          {/* Right Detailed Columns */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Professional Info */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Employment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-text-secondary">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Role / Designation</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{t.role || 'Teacher'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Monthly Salary</p>
                  <p className="text-sm font-extrabold text-primary mt-0.5">₹{t.salary ? Number(t.salary).toLocaleString('en-IN') : '0'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Joining Date</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{formatDate(t.joining_date)}</p>
                </div>
                {t.exit_date && (
                  <div>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Exit Date</p>
                    <p className="text-sm font-bold text-text-primary mt-0.5">{formatDate(t.exit_date)}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Address */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Address Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-2">
                  <h4 className="font-bold text-text-secondary uppercase text-[10px] tracking-wider">Current Address</h4>
                  <p className="text-sm text-text-primary leading-relaxed font-semibold">
                    {t.current_address_line || '—'}<br />
                    {t.current_city ? `${t.current_city}, ` : ''}{t.current_state || ''}<br />
                    {t.current_country || 'India'} - {t.current_pin_code || ''}
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-text-secondary uppercase text-[10px] tracking-wider">Permanent Address</h4>
                  {t.same_as_current === 1 ? (
                    <p className="text-xs text-text-muted italic">Same as Current Address</p>
                  ) : (
                    <p className="text-sm text-text-primary leading-relaxed font-semibold">
                      {t.permanent_address_line || '—'}<br />
                      {t.permanent_city ? `${t.permanent_city}, ` : ''}{t.permanent_state || ''}<br />
                      {t.permanent_country || 'India'} - {t.permanent_pin_code || ''}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Documents - read-only list */}
            <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
              <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border/60 pb-2">Registered Documents</h3>
              {(!t.documents || t.documents.length === 0) ? (
                <p className="text-xs text-text-muted italic">No documents uploaded for this profile.</p>
              ) : (
                <div className="space-y-2">
                  {t.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-text-muted" />
                        <span className="text-xs font-bold text-text-primary">{doc.category_name || doc.category}</span>
                      </div>
                      {doc.file_path && (
                        <a 
                          href={doc.file_path} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-black text-primary hover:underline bg-primary/5 px-2.5 py-1 rounded"
                        >
                          View Document
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* List Header */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
        <Button variant="outline" size="sm" onClick={() => nav('/super-admin/schools')} className="p-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">{schoolName} — Staff Directory</h2>
          <p className="text-text-secondary text-sm mt-1">Platform-wide overview of registered teachers and academic administrators.</p>
        </div>
      </div>

      {/* Summary count */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border border-border bg-surface rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3.5 bg-primary/10 text-primary rounded-2xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-text-muted text-[10px] font-black uppercase tracking-wider">Active Teachers</p>
              <p className="text-3xl font-black text-text-primary mt-1 font-display">{activeCount} Active Teacher{activeCount !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roster Listing Grid of Cards - simplified to ONLY display Photo, Name, and Subject */}
      {loading ? (
        <div className="py-12 text-center text-xs text-text-muted">Loading teachers directory…</div>
      ) : teachers.length === 0 ? (
        <div className="py-16 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center border border-dashed border-border rounded-2xl bg-surface/50">
          <ShieldAlert className="h-8 w-8 text-text-muted animate-pulse" />
          <span>No staff members registered for this school yet.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teachers.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTeacher(t)}
              className="bg-surface border border-border rounded-2xl p-6 transition-all shadow-sm hover:shadow-md flex flex-col items-center text-center cursor-pointer select-none border-border/80 hover:border-primary/40 group"
            >
              <div className="w-16 h-16 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden mb-4 shadow-3xs flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <TeacherAvatar src={t.photo_path} name={t.name} />
              </div>
              <h3 className="font-bold text-text-primary text-base truncate w-full group-hover:text-primary transition-colors">{t.name}</h3>
              <p className="text-[10px] text-text-muted font-bold tracking-tight uppercase mt-1.5">{t.department || 'General'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
