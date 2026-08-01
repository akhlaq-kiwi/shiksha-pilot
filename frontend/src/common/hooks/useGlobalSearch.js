import { useCallback, useMemo, useRef } from 'react';
import { LayoutDashboard, Users, UserCog, Clock, ClipboardCheck, FileText, DollarSign, PhoneCall, Landmark, Megaphone, Settings, Shield, Trophy, GraduationCap, School } from 'lucide-react';
import { schoolService } from '../services/schoolService';

/**
 * Sources for the ⌘K palette.
 *
 * There is no server-side search endpoint, so records are searched client-side
 * over the existing list endpoints, fetched once and cached for the session.
 * That is fine at school scale (hundreds to low thousands of records) and can be
 * swapped for a `/api/search` call later without touching the UI.
 */

const ADMIN_DESTINATIONS = [
  { label: 'Dashboard',           group: 'Go to', icon: LayoutDashboard, path: '/school-admin' },
  { label: 'Classes',             group: 'Go to', icon: Users,           path: '/school-admin/classes' },
  { label: 'Timetable',           group: 'Go to', icon: Clock,           path: '/school-admin/timetable' },
  { label: 'Attendance',          group: 'Go to', icon: ClipboardCheck,  path: '/school-admin/attendance' },
  { label: 'Examinations',        group: 'Go to', icon: FileText,        path: '/school-admin/exams', keywords: ['marks', 'results', 'exam'] },
  { label: 'Teachers',            group: 'Go to', icon: UserCog,         path: '/school-admin/staff', keywords: ['staff'] },
  { label: 'Leave requests',      group: 'Go to', icon: FileText,        path: '/school-admin/leave-requests' },
  { label: 'Achievements',        group: 'Go to', icon: Trophy,          path: '/school-admin/achievements' },
  { label: 'Fee collection',      group: 'Go to', icon: DollarSign,      path: '/school-admin/finance', keywords: ['fees', 'payment', 'receipt'] },
  { label: 'Fee follow-up',       group: 'Go to', icon: PhoneCall,       path: '/school-admin/fee-follow-ups', keywords: ['reminder', 'defaulter'] },
  { label: 'Financial reports',   group: 'Go to', icon: FileText,        path: '/school-admin/financial-reports' },
  { label: 'Accounts & payroll',  group: 'Go to', icon: Landmark,        path: '/school-admin/finance-management', keywords: ['salary', 'expense'] },
  { label: 'Announcements',       group: 'Go to', icon: Megaphone,       path: '/school-admin/announcements', keywords: ['notice'] },
  { label: 'Settings',            group: 'Go to', icon: Settings,        path: '/school-admin/audits-settings', keywords: ['academic year', 'audit'] },
  { label: 'Security',            group: 'Go to', icon: Shield,          path: '/school-admin/security' },
];

const SUPER_ADMIN_DESTINATIONS = [
  { label: 'Platform dashboard',    group: 'Go to', icon: LayoutDashboard, path: '/super-admin' },
  { label: 'Schools',               group: 'Go to', icon: School,          path: '/super-admin/schools' },
  { label: 'Plans',                 group: 'Go to', icon: FileText,        path: '/super-admin/plans', keywords: ['subscription', 'billing'] },
  { label: 'Report card templates', group: 'Go to', icon: FileText,        path: '/super-admin/report-card-templates' },
  { label: 'Settings',              group: 'Go to', icon: Settings,        path: '/super-admin/settings' },
];

export function useGlobalSearch(role, navigate) {
  const cache = useRef(null);

  const destinations = useMemo(() => {
    const list =
      role === 'SUPER_ADMIN' ? SUPER_ADMIN_DESTINATIONS
      : role === 'SCHOOL_ADMIN' || role === 'TEACHER' ? ADMIN_DESTINATIONS
      : [];
    return list.map((d) => ({ ...d, onSelect: () => navigate(d.path) }));
  }, [role, navigate]);

  /** Students / teachers / classes, matched by name, roll number or code. */
  const searchRecords = useCallback(async (query) => {
    if (role !== 'SCHOOL_ADMIN' && role !== 'TEACHER') return [];

    if (!cache.current) {
      cache.current = Promise.all([
        schoolService.getStudents().catch(() => []),
        schoolService.getStaff().catch(() => []),
        schoolService.getClasses().catch(() => []),
      ]).catch(() => [[], [], []]);
    }

    const [students, staff, classes] = await cache.current;
    const q = query.toLowerCase();
    const hit = (...fields) =>
      fields.filter(Boolean).some((f) => String(f).toLowerCase().includes(q));

    const studentHits = (students || [])
      .filter((s) => hit(s.student_name, s.name, s.roll_no, s.sr_no, s.admission_no))
      .slice(0, 6)
      .map((s) => ({
        id: `student-${s.id}`,
        label: s.student_name || s.name,
        sublabel: [s.class_name, s.section_name && `Section ${s.section_name}`, s.roll_no && `Roll ${s.roll_no}`]
          .filter(Boolean).join(' · '),
        group: 'Students',
        icon: GraduationCap,
        onSelect: () => navigate(`/school-admin/finance?studentId=${s.id}`),
      }));

    const staffHits = (staff || [])
      .filter((t) => hit(t.name, t.full_name, t.email, t.employee_id))
      .slice(0, 4)
      .map((t) => ({
        id: `staff-${t.id}`,
        label: t.name || t.full_name,
        sublabel: [t.designation, t.subject].filter(Boolean).join(' · ') || 'Staff',
        group: 'Teachers',
        icon: UserCog,
        onSelect: () => navigate('/school-admin/staff'),
      }));

    const classHits = (classes || [])
      .filter((c) => hit(c.name, c.class_name, c.section_name))
      .slice(0, 4)
      .map((c) => ({
        id: `class-${c.id}`,
        label: c.name || `${c.class_name} ${c.section_name ?? ''}`.trim(),
        sublabel: 'Class',
        group: 'Classes',
        icon: Users,
        onSelect: () => navigate('/school-admin/classes'),
      }));

    return [...studentHits, ...staffHits, ...classHits];
  }, [role, navigate]);

  return { destinations, searchRecords, enabled: destinations.length > 0 };
}

export default useGlobalSearch;
