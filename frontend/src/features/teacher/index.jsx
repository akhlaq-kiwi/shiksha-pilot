import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  FileText,
  Award,
  FolderOpen,
  CheckSquare,
} from 'lucide-react';
import { teacherService } from '../../common/services/teacherService';
import DashboardPage   from './pages/DashboardPage';
import ClassesPage     from './pages/ClassesPage';
import AttendancePage  from './pages/AttendancePage';
import AssignmentsPage from './pages/AssignmentsPage';
import ExaminationPage from './pages/ExaminationPage';
import MaterialsPage   from './pages/MaterialsPage';
import TeacherLeavePage from './pages/TeacherLeavePage';

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',         icon: LayoutDashboard },
  { id: 'classes',     label: 'My Classes',         icon: BookOpen },
  { id: 'attendance',  label: 'Attendance',         icon: ClipboardCheck },
  { id: 'assignments', label: 'Assignments',        icon: FileText },
  { id: 'examination', label: 'Examination',        icon: Award },
  { id: 'materials',   label: 'Learning Materials', icon: FolderOpen },
  { id: 'leaves',      label: 'Leave Requests',     icon: CheckSquare },
];

export default function TeacherPortal() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  const [schedule, setSchedule]         = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [classes, setClasses]           = useState([]);
  const [allStudents, setAllStudents]   = useState({});
  const [assignments, setAssignments]   = useState([]);
  const [exams, setExams]               = useState([]);
  const [materials, setMaterials]       = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, cls, asn, ex, mat] = await Promise.all([
        teacherService.getDashboardData(),
        teacherService.getClasses(),
        teacherService.getAssignments(),
        teacherService.getExams(),
        teacherService.getMaterials(),
      ]);

      setSchedule(dash.schedule || []);
      setTasks(dash.tasks || []);
      setUpcomingExams(dash.upcomingExams || []);
      setClasses(cls);
      setAssignments(asn);
      setExams(ex);
      setMaterials(mat);

      const mockStudents = teacherService.getMockStudents();
      const studentMap = {};
      cls.forEach((c) => { studentMap[c.id] = mockStudents[c.id] || []; });
      setAllStudents(studentMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-6 md:p-8">

      {/* Portal identity strip */}
      <div className="flex items-center gap-3 pb-1 border-b border-border">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <CheckSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-text-primary tracking-tight font-display">Teacher Portal</h1>
          <p className="text-xs text-text-muted">Shiksha Pilot</p>
        </div>
      </div>

      {/* Horizontal nav */}
      <nav className="flex flex-wrap gap-1 bg-background rounded-xl border border-border p-1" role="navigation" aria-label="Teacher portal sections">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentPage(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all focus-visible:outline-none ${
              currentPage === id
                ? 'bg-primary text-surface dark:bg-primary dark:text-background font-extrabold shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-secondary/70'
            }`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Page content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-text-muted">Loading…</p>
          </div>
        ) : (
          <>
            {currentPage === 'dashboard'   && <DashboardPage   schedule={schedule} tasks={tasks} upcomingExams={upcomingExams} classes={classes} />}
            {currentPage === 'classes'     && <ClassesPage     classes={classes} allStudents={allStudents} />}
            {currentPage === 'attendance'  && <AttendancePage  classes={classes} allStudents={allStudents} />}
            {currentPage === 'assignments' && <AssignmentsPage classes={classes} assignments={assignments} />}
            {currentPage === 'examination' && <ExaminationPage classes={classes} exams={exams} allStudents={allStudents} />}
            {currentPage === 'materials'   && <MaterialsPage   classes={classes} materials={materials} />}
            {currentPage === 'leaves'      && <TeacherLeavePage />}
          </>
        )}
      </div>
    </div>
  );
}
