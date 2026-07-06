import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { platformService } from '../../../common/services/platformService';

export default function SchoolStudentsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [students, setStudents] = useState([]);
  const [schoolName, setSchoolName] = useState('School');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const schools = await platformService.getSchools();
        const sc = schools.find(s => String(s.id) === String(id));
        if (sc) {
          setSchoolName(sc.name);
        }

        const data = await platformService.getSchoolStudents(id);
        setStudents(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const activeCount = students.filter(s => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
        <Button variant="outline" size="sm" onClick={() => nav('/super-admin/schools')} className="p-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">{schoolName} — Student Roster</h2>
          <p className="text-text-secondary text-sm mt-1">Platform-wide overview of active and exited student enrollments.</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border border-border bg-surface rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3.5 bg-primary/10 text-primary rounded-2xl">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-text-muted text-[10px] font-black uppercase tracking-wider">Active Students</p>
              <p className="text-3xl font-black text-text-primary mt-1 font-display">{activeCount} Student{activeCount !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students Table Card */}
      <Card className="shadow-sm border border-border bg-surface rounded-2xl overflow-hidden">
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">All Registered Students</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading student directory…</div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center">
            <ShieldAlert className="h-8 w-8 text-text-muted" />
            <span>No students registered for this school yet.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission No.</TableHead>
                <TableHead>SR No.</TableHead>
                <TableHead>Roll No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class & Section</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(s => (
                <TableRow key={s.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/40">
                  <TableCell className="font-mono text-xs font-bold text-text-primary py-3.5">{s.admission_no || '—'}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-text-secondary">{s.sr_no || '—'}</TableCell>
                  <TableCell className="text-xs text-text-muted">{s.roll_no || '—'}</TableCell>
                  <TableCell className="font-bold text-text-primary">{s.name}</TableCell>
                  <TableCell className="text-xs text-text-secondary">
                    {s.class_name ? `${s.class_name}${s.section ? ` - ${s.section}` : ''}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-text-muted font-semibold">{s.academic_year_name || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${s.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {s.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
