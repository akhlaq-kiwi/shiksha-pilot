import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  UserCheck,
  FileText,
  CreditCard,
  Plus,
  X,
  Check,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Briefcase,
  Users,
  Award,
  BookOpen,
  Clock
} from 'lucide-react';

export default function PortalDashboard({
  role,
  token,
  isConnected,
  schoolId,
  activeYearId,
  username,
  teachers = [],
  classes = [],
  students = [],
  allWeeklySchedules = [],
  formatMoney = (val) => `₹${val}`,
  showToast = () => {}
}) {
  // Shared Loader state
  const [loading, setLoading] = useState(false);

  // --- TEACHER PORTAL STATE ---
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [assignedClass, setAssignedClass] = useState(null);
  const [todayTimetable, setTodayTimetable] = useState([]);
  const [upcomingTimetable, setUpcomingTimetable] = useState([]);
  const [financeSummary, setFinanceSummary] = useState({ total_fees_collected: 0, total_fees_outstanding: 0 });
  const [assignedClassStudents, setAssignedClassStudents] = useState([]);
  const [teacherTodayAttendance, setTeacherTodayAttendance] = useState([]);
  const [teacherClassFeeStructure, setTeacherClassFeeStructure] = useState(null);

  // --- PARENT PORTAL STATE ---
  const [parentStudents, setParentStudents] = useState([]);
  const [selectedParentStudentId, setSelectedParentStudentId] = useState(null);
  const [parentDashboardData, setParentDashboardData] = useState(null);

  // --- LOAD TEACHER PORTAL DATA ---
  useEffect(() => {
    if (role !== 'Teacher') return;

    const loadTeacherData = async () => {
      setLoading(true);
      const keySuffix = schoolId || 'default';
      const todayDate = new Date().toISOString().slice(0, 10);

      if (token.includes('mock') || !isConnected) {
        // Fallback Mock Logic
        const currentTeacher = teachers.find(t => t.phone === username || t.email === username) || {
          id: 12,
          name: username || 'Teacher User',
          phone: username || '9876543211',
          email: 'teacher@school.edu',
          salary_amount: 45000,
          gender: 'Female',
          status: 'Active'
        };
        setTeacherProfile(currentTeacher);

        const assClass = classes.find(c => Number(c.class_teacher_id) === Number(currentTeacher.id)) || classes[0] || null;
        setAssignedClass(assClass);

        if (assClass) {
          const classStudents = students.filter(s => s.class_id === assClass.id);
          setAssignedClassStudents(classStudents);

          // Stored today attendance
          const storedAtt = JSON.parse(localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${activeYearId}`) || '[]');
          const studentIds = classStudents.map(s => s.id);
          const filteredTodayAtt = storedAtt.filter(r => r.attendance_date === todayDate && studentIds.includes(Number(r.student_id)));
          setTeacherTodayAttendance(filteredTodayAtt);

          // Stored class fee config
          const storedCfg = localStorage.getItem(`bn_sandbox_class_fees_${keySuffix}_${assClass.id}_${activeYearId}`);
          if (storedCfg) {
            setTeacherClassFeeStructure(JSON.parse(storedCfg));
          } else {
            setTeacherClassFeeStructure({
              April: 1500, May: 1500, June: 1500, July: 1500, August: 1500,
              September: 1500, October: 1500, November: 1500, December: 1500,
              January: 1500, February: 1500, March: 1500
            });
          }
        }

        // Mock Timetable Today & Upcoming
        setTodayTimetable([
          { period: 1, status: 'Busy', subject: 'Mathematics', class_name: assClass ? assClass.name : 'Class 10-A', class_id: assClass ? assClass.id : 1, backup: false },
          { period: 2, status: 'Free', subject: '', class_name: '' },
          { period: 3, status: 'Busy', subject: 'Physics', class_name: 'Class 10-B', class_id: 2, backup: false },
          { period: 4, status: 'Free', subject: '', class_name: '' }
        ]);

        setUpcomingTimetable([
          {
            date: dateOffset(1),
            day: getDayName(1),
            periods: [
              { period: 1, subject: 'Mathematics', class_name: assClass ? assClass.name : 'Class 10-A', backup: false }
            ]
          }
        ]);

        setFinanceSummary({
          total_fees_collected: 180000.00,
          total_fees_outstanding: 45000.00
        });

        setLoading(false);
        return;
      }

      // Live Fetch
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const dashRes = await fetch('/api/teacher/dashboard', { headers });
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setTeacherProfile(dashData.teacher_profile);
          setAssignedClass(dashData.assigned_class);
          setTodayTimetable(dashData.today_timetable || []);
          setUpcomingTimetable(dashData.upcoming_timetable || []);
          setFinanceSummary(dashData.finance_summary || { total_fees_collected: 0, total_fees_outstanding: 0 });

          if (dashData.assigned_class) {
            // Fetch assigned class students
            const studRes = await fetch(`/api/students?class_id=${dashData.assigned_class.id}&academic_year_id=${activeYearId}`, { headers });
            if (studRes.ok) {
              const studsList = await studRes.json();
              setAssignedClassStudents(studsList);
            }

            // Fetch today attendance
            const attRes = await fetch(`/api/attendance?class_id=${dashData.assigned_class.id}&academic_year_id=${activeYearId}&date=${todayDate}`, { headers });
            if (attRes.ok) {
              const attData = await attRes.json();
              const mapped = attData.filter(s => s.status).map(s => ({ student_id: s.id, status: s.status }));
              setTeacherTodayAttendance(mapped);
            }

            // Fetch class fee config
            const feeConfigRes = await fetch(`/api/class-fees?class_id=${dashData.assigned_class.id}&academic_year_id=${activeYearId}`, { headers });
            if (feeConfigRes.ok) {
              setTeacherClassFeeStructure(await feeConfigRes.json());
            }
          }
        }
      } catch (err) {
        console.error("Error fetching teacher dashboard:", err);
        showToast("Error loading teacher portal data", "error");
      } finally {
        setLoading(false);
      }
    };

    loadTeacherData();
  }, [role, token, isConnected, schoolId, activeYearId, username, teachers, classes, students]);


  // --- LOAD PARENT PORTAL CHILDREN LIST ---
  useEffect(() => {
    if (role !== 'Parent') return;

    const loadParentChildren = async () => {
      setLoading(true);
      if (token.includes('mock') || !isConnected) {
        // Fallback Mock Logic
        let studs = students.filter(s => s.phone === username || s.emergency_contact === username);
        if (studs.length === 0) {
          studs = students.slice(0, 2);
        }
        const mapped = studs.map(s => ({
          id: s.id,
          first_name: s.first_name || s.name.split(' ')[0],
          last_name: s.last_name || s.name.split(' ')[1] || 'Student',
          roll_number: s.roll_number || '1',
          class_name: s.class_name || (classes.find(c => Number(c.id) === Number(s.class_id))?.name || 'Class 10-A')
        }));
        setParentStudents(mapped);
        if (mapped.length > 0) {
          setSelectedParentStudentId(mapped[0].id);
        }
        setLoading(false);
        return;
      }

      // Live Fetch
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const res = await fetch('/api/parent/dashboard', { headers });
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.students || []).map(s => ({
            id: s.id,
            first_name: s.first_name || s.name.split(' ')[0],
            last_name: s.last_name || s.name.split(' ')[1] || 'Student',
            roll_number: s.roll_number,
            class_name: s.class_name
          }));
          setParentStudents(mapped);
          if (mapped.length > 0) {
            setSelectedParentStudentId(mapped[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading parent children list:", err);
      } finally {
        setLoading(false);
      }
    };

    loadParentChildren();
  }, [role, token, isConnected, username, students, classes]);


  // --- LOAD INDIVIDUAL CHILD DASHBOARD DETAILS ---
  useEffect(() => {
    if (role !== 'Parent' || !selectedParentStudentId) return;

    const loadChildDashboard = async () => {
      setLoading(true);
      const keySuffix = schoolId || 'default';

      if (token.includes('mock') || !isConnected) {
        // Fallback Mock Logic
        const childObj = parentStudents.find(s => s.id === selectedParentStudentId) || {
          id: selectedParentStudentId,
          first_name: 'Yusuf',
          last_name: 'Ali',
          class_name: 'Class 10-A',
          gr_no: 'GR1004',
          status: 'Active'
        };

        const attKey = `bn_sandbox_attendance_${keySuffix}_${activeYearId}`;
        const attList = JSON.parse(localStorage.getItem(attKey) || '[]');
        const studentAtt = attList.filter(a => Number(a.student_id) === Number(selectedParentStudentId));
        const present = studentAtt.filter(a => a.status === 'Present').length;
        const absent = studentAtt.filter(a => a.status === 'Absent').length;
        const leave = studentAtt.filter(a => a.status === 'Leave').length;
        const total = present + absent + leave;

        const feesKey = `bn_sandbox_fees_${keySuffix}`;
        const feesList = JSON.parse(localStorage.getItem(feesKey) || '[]');
        const studentFees = feesList.filter(f => Number(f.student_id) === Number(selectedParentStudentId));

        const savedCarry = JSON.parse(localStorage.getItem(`bn_sandbox_carry_forward_${keySuffix}`) || '[]');
        const matchedCarry = savedCarry.find(c => Number(c.student_id) === Number(selectedParentStudentId));

        setParentDashboardData({
          student: {
            ...childObj,
            gr_no: childObj.gr_no || 'GR' + (1000 + selectedParentStudentId),
            status: childObj.status || 'Active'
          },
          attendance_stats: {
            present_days: total > 0 ? present : 18,
            absent_days: total > 0 ? absent : 2,
            leave_days: total > 0 ? leave : 1,
            total_days: total > 0 ? total : 21
          },
          recent_attendance: total > 0 
            ? studentAtt.map(a => ({ attendance_date: a.attendance_date, status: a.status }))
            : [
                { attendance_date: dateOffset(0), status: 'Present' },
                { attendance_date: dateOffset(-1), status: 'Present' },
                { attendance_date: dateOffset(-2), status: 'Absent' },
                { attendance_date: dateOffset(-3), status: 'Present' },
                { attendance_date: dateOffset(-4), status: 'Present' }
              ],
          fees: studentFees.length > 0
            ? studentFees.map(f => ({ due_date: f.due_date, title: `${f.month} Tuition Fee`, amount: Number(f.amount), status: f.status, paid_at: f.payment_date, payment_mode: f.payment_mode || 'Cash' }))
            : [
                { due_date: dateOffset(5), title: 'Tuition Fee - Next Month', amount: 1500, status: 'Pending', paid_at: null, payment_mode: null },
                { due_date: dateOffset(-10), title: 'Tuition Fee - Current Month', amount: 1500, status: 'Paid', paid_at: dateOffset(-12), payment_mode: 'UPI' }
              ],
          extra_fees: [
            { id: 1, title: 'Annual Sports Fee', amount: 1000, status: 'Paid', paid_at: dateOffset(-30) },
            { id: 2, title: 'Library Book Deposit', amount: 500, status: 'Pending', paid_at: null }
          ],
          class_fee_structure: {
            April: 1500, May: 1500, June: 1500, July: 1500, August: 1500,
            September: 1500, October: 1500, November: 1500, December: 1500,
            January: 1500, February: 1500, March: 1500
          },
          carry_forward: matchedCarry ? [matchedCarry] : [],
          exam_marks: [
            { exam_name: 'Midterm Exams', subject_name: 'Mathematics', marks_obtained: 88, max_marks: 100 },
            { exam_name: 'Midterm Exams', subject_name: 'Science', marks_obtained: 92, max_marks: 100 },
            { exam_name: 'Midterm Exams', subject_name: 'English', marks_obtained: 85, max_marks: 100 }
          ]
        });
        setLoading(false);
        return;
      }

      // Live Fetch
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const res = await fetch(`/api/parent/student/${selectedParentStudentId}/dashboard`, { headers });
        if (res.ok) {
          const data = await res.json();
          setParentDashboardData({
            student: data.student || {},
            attendance_stats: data.attendance_stats || { present_days: 0, absent_days: 0, leave_days: 0, total_days: 0 },
            recent_attendance: data.recent_attendance || [],
            fees: data.fees || [],
            extra_fees: data.extra_fees || [],
            class_fee_structure: data.class_fee_structure || null,
            carry_forward: data.carry_forward || [],
            exam_marks: data.exam_marks || []
          });
        }
      } catch (err) {
        console.error("Error fetching student dashboard info:", err);
      } finally {
        setLoading(false);
      }
    };

    loadChildDashboard();
  }, [role, selectedParentStudentId, token, isConnected, schoolId, activeYearId, parentStudents]);

  // Helper date generators for mocks
  function dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function getDayName(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // --- RENDER CONTENT ---
  return (
    <>
      {/* LOADING OVERLAY */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <div className="loading-spinner"></div>
        </div>
      )}

      {/* --- CLASS TEACHER VIEW --- */}
      {!loading && role === 'Teacher' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* PROFILE GREETING */}
          <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Class Teacher Portal
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                Welcome back, {teacherProfile ? teacherProfile.name : 'Teacher'}. Managing {assignedClass ? assignedClass.name : 'Unassigned class'}.
              </p>
            </div>
            {assignedClass && (
              <span className="badge badge-primary" style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
                Classroom Teacher
              </span>
            )}
          </div>

          {/* STATS TILES */}
          <div className="stats-grid">
            <div className="sp-card">
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} /> Enrolled Students
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{assignedClassStudents.length}</div>
              <span className="badge badge-outline" style={{ marginTop: '8px' }}>Active Session</span>
            </div>

            {(() => {
              const totalStudents = assignedClassStudents.length;
              const presentToday = teacherTodayAttendance.filter(r => r.status === 'Present').length;
              const absentToday = teacherTodayAttendance.filter(r => r.status === 'Absent').length;
              const markedToday = teacherTodayAttendance.length;
              const attendanceRate = totalStudents > 0 && markedToday > 0
                ? Math.round((presentToday / markedToday) * 100)
                : 100;

              return (
                <>
                  <div className="sp-card">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Present Today</span>
                    <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
                      {markedToday > 0 ? presentToday : '-'}
                    </div>
                    <span className={`badge ${markedToday > 0 ? 'badge-success' : 'badge-outline'}`} style={{ marginTop: '8px' }}>
                      {markedToday > 0 ? 'Marked' : 'Pending Checkin'}
                    </span>
                  </div>

                  <div className="sp-card">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Absent Today</span>
                    <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#ef4444' }}>
                      {markedToday > 0 ? absentToday : '-'}
                    </div>
                    <span className="badge badge-outline" style={{ marginTop: '8px' }}>Daily Absentees</span>
                  </div>

                  <div className="sp-card">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Attendance Rate</span>
                    <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: 'var(--color-primary)' }}>
                      {markedToday > 0 ? `${attendanceRate}%` : '-'}
                    </div>
                    <span className="badge badge-success" style={{ marginTop: '8px' }}>Checkin Rate</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* TIMETABLE & SCHEME GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
            
            {/* SCHEDULE TODAY */}
            <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={18} className="gradient-text" /> Today's Period Schedule
              </h3>
              {todayTimetable.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {todayTimetable.map((sched, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>Period {sched.period}</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>
                          {sched.status === 'Free' ? 'Free Period' : sched.subject}
                        </div>
                      </div>
                      {sched.status !== 'Free' && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sched.class_name}</div>
                          {sched.backup && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Backup</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  No periods scheduled for today.
                </div>
              )}
            </div>

            {/* TUITION FEE SCHEME */}
            <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={18} className="gradient-text" /> Classroom Tuition Scheme
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Assigned tuition values by month for {assignedClass ? assignedClass.name : 'class'}:
              </p>
              {teacherClassFeeStructure ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {Object.entries(teacherClassFeeStructure)
                    .filter(([key]) => key !== 'is_locked' && key !== 'is_configured')
                    .map(([month, amount]) => (
                      <div key={month} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{month}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '4px', color: 'var(--color-primary)' }}>
                          {formatMoney(amount)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: '6px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  No fee structure configured for your classroom yet.
                </div>
              )}
            </div>
          </div>

          {/* STUDENT BALANCES SHEET */}
          <div className="sp-card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={18} className="gradient-text" /> Student Fee Balance Registry
            </h3>
            <div className="table-responsive">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Roll Number</th>
                    <th>Status</th>
                    <th>Dues Pending</th>
                    <th>Carry Forward Dues</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedClassStudents.map(student => {
                    const keySuffix = schoolId || 'default';
                    let studFees = [];
                    if (token.includes('mock') || !isConnected) {
                      studFees = JSON.parse(localStorage.getItem(`bn_sandbox_fees_${keySuffix}_${student.id}_${activeYearId}`) || '[]');
                    }
                    const pending = studFees.filter(f => f.status !== 'Paid').reduce((acc, f) => acc + Number(f.amount || 0), 0);
                    
                    let prevDues = 0;
                    if (token.includes('mock') || !isConnected) {
                      const savedCarry = JSON.parse(localStorage.getItem(`bn_sandbox_carry_forward_${keySuffix}`) || '[]');
                      const matchedCarry = savedCarry.find(c => Number(c.student_id) === Number(student.id));
                      prevDues = matchedCarry ? Number(matchedCarry.due_amount || matchedCarry.amount || 0) : 0;
                    }

                    return (
                      <tr key={student.id}>
                        <td style={{ fontWeight: 600 }}>{student.name}</td>
                        <td>{student.roll_number}</td>
                        <td>
                          <span className={`badge ${student.status === 'Inactive' ? 'badge-danger' : 'badge-success'}`}>
                            {student.status || 'Active'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: pending > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                          {formatMoney(pending)}
                        </td>
                        <td style={{ fontWeight: 600, color: prevDues > 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {formatMoney(prevDues)}
                        </td>
                      </tr>
                    );
                  })}
                  {assignedClassStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No students enrolled.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- PARENT VIEW --- */}
      {!loading && role === 'Parent' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* HEADER DROPDOWN */}
          <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Parent Portal</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select child to view registries, schedules, and grades.</p>
            </div>
            <div>
              <select
                className="sp-input"
                style={{ minWidth: '220px' }}
                value={selectedParentStudentId || ''}
                onChange={(e) => setSelectedParentStudentId(Number(e.target.value))}
              >
                {parentStudents.map(child => (
                  <option key={child.id} value={child.id}>
                    {child.first_name} {child.last_name} ({child.class_name || 'N/A'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {parentDashboardData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* CHILD SUMMARY GRID */}
              <div className="sp-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Student Name</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                    {parentDashboardData.student.first_name} {parentDashboardData.student.last_name || parentDashboardData.student.name}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Class Section</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                    {parentDashboardData.student.class_name}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Admission No (GR)</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '4px' }}>
                    {parentDashboardData.student.gr_no || `GR-${parentDashboardData.student.id}`}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Status</span>
                  <div style={{ marginTop: '4px' }}>
                    <span className="badge badge-success">{parentDashboardData.student.status || 'Active'}</span>
                  </div>
                </div>
              </div>

              {/* OUTSTANDING METRICS */}
              {(() => {
                const fees = parentDashboardData.fees || [];
                const extras = parentDashboardData.extra_fees || [];
                const carry = parentDashboardData.carry_forward || [];
                const totalPaid = fees.filter(f => f.status === 'Paid').reduce((acc, f) => acc + Number(f.amount || 0), 0);
                const totalPending = fees.filter(f => f.status !== 'Paid').reduce((acc, f) => acc + Number(f.amount || 0), 0);
                const totalExtraPending = extras.filter(f => f.status !== 'Paid').reduce((acc, f) => acc + Number(f.amount || 0), 0);
                const totalPrevious = carry.reduce((acc, f) => acc + Number(f.due_amount || f.amount || 0), 0);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div className="sp-card" style={{ borderLeft: '4px solid #10b981' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Tuition Fees Paid</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#10b981' }}>
                        {formatMoney(totalPaid)}
                      </div>
                    </div>
                    <div className="sp-card" style={{ borderLeft: '4px solid #ef4444' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Tuition Dues Pending</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#ef4444' }}>
                        {formatMoney(totalPending)}
                      </div>
                    </div>
                    <div className="sp-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Assigned Extra Fees</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#3b82f6' }}>
                        {formatMoney(totalExtraPending)}
                      </div>
                    </div>
                    <div className="sp-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Carry Forward Balance</span>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#f59e0b' }}>
                        {formatMoney(totalPrevious)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ATTENDANCE SECTION */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                <div className="sp-card">
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Attendance Log Stats</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 800 }}>
                        {parentDashboardData.attendance_stats.present_days}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Present</span>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 800 }}>
                        {parentDashboardData.attendance_stats.absent_days}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Absent</span>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 800 }}>
                        {parentDashboardData.attendance_stats.leave_days}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leave</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span>Overall Rate</span>
                      <strong>
                        {parentDashboardData.attendance_stats.total_days > 0 
                          ? Math.round((parentDashboardData.attendance_stats.present_days / parentDashboardData.attendance_stats.total_days) * 100)
                          : 100}%
                      </strong>
                    </div>
                    <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        background: 'var(--color-primary)',
                        width: `${parentDashboardData.attendance_stats.total_days > 0 
                          ? (parentDashboardData.attendance_stats.present_days / parentDashboardData.attendance_stats.total_days) * 100
                          : 100}%`
                      }}></div>
                    </div>
                  </div>
                </div>

                <div className="sp-card">
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Recent Log History</h3>
                  <div className="table-responsive" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="sp-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status Checkin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parentDashboardData.recent_attendance.map((att, idx) => (
                          <tr key={idx}>
                            <td>{att.attendance_date}</td>
                            <td>
                              <span className={`badge ${att.status === 'Present' ? 'badge-success' : att.status === 'Absent' ? 'badge-danger' : 'badge-warning'}`}>
                                {att.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* FEES TABLES */}
              <div className="sp-card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Tuition Billing Schedule</h3>
                <div className="table-responsive">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Due Date</th>
                        <th>Month Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Payment Date</th>
                        <th>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parentDashboardData.fees.map((fee, idx) => (
                        <tr key={idx}>
                          <td>{fee.due_date}</td>
                          <td>{fee.title || `${fee.month} Tuition Fee`}</td>
                          <td>{formatMoney(fee.amount)}</td>
                          <td>
                            <span className={`badge ${fee.status === 'Paid' ? 'badge-success' : 'badge-danger'}`}>
                              {fee.status}
                            </span>
                          </td>
                          <td>{fee.paid_at || '-'}</td>
                          <td>{fee.payment_mode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* REPORT CARD */}
              <div className="sp-card">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={18} className="gradient-text" /> Published Exam Performance
                </h3>
                <div className="table-responsive">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Exam Term</th>
                        <th>Subject Name</th>
                        <th>Marks Obtained</th>
                        <th>Maximum Marks</th>
                        <th>Grade / Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parentDashboardData.exam_marks.map((mark, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{mark.exam_name}</td>
                          <td>{mark.subject_name}</td>
                          <td>{mark.marks_obtained}</td>
                          <td>{mark.max_marks}</td>
                          <td style={{ fontWeight: 700 }}>
                            {Math.round((mark.marks_obtained / mark.max_marks) * 100)}%
                          </td>
                        </tr>
                      ))}
                      {parentDashboardData.exam_marks.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No exam marks published yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </>
  );
}
