import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { platformService } from '../../../common/services/platformService';

export default function SchoolTeachersPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [teachers, setTeachers] = useState([]);
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

        const data = await platformService.getSchoolTeachers(id);
        setTeachers(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const activeCount = teachers.filter(t => t.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
        <Button variant="outline" size="sm" onClick={() => nav('/super-admin/schools')} className="p-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">{schoolName} — Staff Directory</h2>
          <p className="text-text-secondary text-sm mt-1">Platform-wide overview of registered teachers and academic administrators.</p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm border border-border bg-surface rounded-2xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3.5 bg-primary/10 text-primary rounded-2xl">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-text-muted text-[10px] font-black uppercase tracking-wider">Active Teachers</p>
              <p className="text-3xl font-black text-text-primary mt-1 font-display">{activeCount} Teacher{activeCount !== 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teachers Table Card */}
      <Card className="shadow-sm border border-border bg-surface rounded-2xl overflow-hidden">
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">All Registered Staff</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="py-12 text-center text-xs text-text-muted">Loading teachers directory…</div>
        ) : teachers.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm flex flex-col items-center gap-2 justify-center">
            <ShieldAlert className="h-8 w-8 text-text-muted" />
            <span>No staff members registered for this school yet.</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation / Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Contact Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map(t => (
                <TableRow key={t.id} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/40">
                  <TableCell className="font-mono text-xs font-bold text-text-primary py-3.5">{t.employee_id || '—'}</TableCell>
                  <TableCell className="font-bold text-text-primary">{t.name}</TableCell>
                  <TableCell className="text-xs text-text-secondary">{t.role || 'Teacher'}</TableCell>
                  <TableCell className="text-xs text-text-muted">{t.department || '—'}</TableCell>
                  <TableCell className="text-xs text-text-secondary font-mono">{t.email || '—'}</TableCell>
                  <TableCell className="text-xs text-text-muted font-mono">{t.phone || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${t.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {t.status}
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
