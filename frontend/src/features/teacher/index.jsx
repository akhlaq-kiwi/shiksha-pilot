import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  FileText,
  Award,
  FolderOpen,
  CheckSquare,
  Trophy
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { teacherService } from '../../common/services/teacherService';
import AppSidebar from '../../common/components/AppSidebar';
import DashboardPage   from './pages/DashboardPage';
import ClassesPage     from './pages/ClassesPage';
import AttendancePage  from './pages/AttendancePage';
import AssignmentsPage from './pages/AssignmentsPage';
import ExaminationPage from './pages/ExaminationPage';
import MaterialsPage   from './pages/MaterialsPage';
import TeacherLeavePage from './pages/TeacherLeavePage';
import SettingsPage from './pages/SettingsPage';
import AchievementsPage from '../achievements/pages/AchievementsPage';

/**
 * Teacher navigation, grouped to match every other portal.
 *
 * This portal previously used a horizontal wrapping nav while School Admin,
 * Super Admin and Student/Parent all used sidebars — the same product looked
 * like two different products depending on who logged in.
 */
const NAV_GROUPS = [
  {
    label: 'Teaching',
    items: [
      { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
      { id: 'classes',     label: 'My classes',  icon: BookOpen },
      { id: 'attendance',  label: 'Attendance',  icon: ClipboardCheck },
    ],
  },
  {
    label: 'Assessment',
    items: [
      { id: 'assignments', label: 'Assignments',  icon: FileText },
      { id: 'examination', label: 'Marks & exams', icon: Award },
      { id: 'achievements', label: 'Achievements', icon: Trophy },
    ],
  },
  {
    label: 'Resources',
    items: [
      { id: 'materials', label: 'Learning materials', icon: FolderOpen },
      { id: 'leaves',    label: 'My leave',           icon: CheckSquare },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function TeacherPortal() {
  const location = useLocation();
  const navigate = useNavigate();

  const getPageFromPath = useCallback(() => {
    const path = location.pathname;
    if (path.endsWith('/achievements')) return 'achievements';
    if (path.endsWith('/leaves')) return 'leaves';
    if (path.endsWith('/classes')) return 'classes';
    if (path.endsWith('/attendance')) return 'attendance';
    if (path.endsWith('/assignments')) return 'assignments';
    if (path.endsWith('/examination')) return 'examination';
    if (path.endsWith('/materials')) return 'materials';
    if (path.endsWith('/settings')) return 'settings';
    return 'dashboard';
  }, [location.pathname]);

  const [currentPage, setCurrentPage] = useState(getPageFromPath);

  useEffect(() => {
    setCurrentPage(getPageFromPath());
  }, [location.pathname, getPageFromPath]);

  const handleNavigate = (id) => {
    navigate(id === 'dashboard' ? '/teacher' : `/teacher/${id}`);
  };

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
    <div className="flex w-full min-h-[calc(100vh-56px)] flex-col bg-background md:flex-row">
      <AppSidebar
        groups={NAV_GROUPS}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        title="Teacher menu"
      />

      <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-6 md:p-8">
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
            {currentPage === 'achievements' && <AchievementsPage />}
            {currentPage === 'assignments' && <AssignmentsPage classes={classes} assignments={assignments} />}
            {currentPage === 'examination' && <ExaminationPage classes={classes} exams={exams} allStudents={allStudents} />}
            {currentPage === 'materials'   && <MaterialsPage   classes={classes} materials={materials} />}
            {currentPage === 'leaves'      && <TeacherLeavePage />}
            {currentPage === 'settings'    && <SettingsPage />}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
