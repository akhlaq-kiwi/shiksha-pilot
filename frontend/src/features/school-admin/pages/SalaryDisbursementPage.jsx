import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Landmark, DollarSign, Clock, Search } from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';

// Self-healing avatar image component
const TeacherAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : src;
    const cleanUrl = updatedAt ? `${fileUrl}?v=${encodeURIComponent(updatedAt)}` : `${fileUrl}?v=${Date.now()}`;
    return (
      <img 
        src={cleanUrl} 
        alt={name} 
        className="w-10 h-10 rounded-full object-cover border border-border"
        onError={() => setError(true)} 
      />
    );
  }
  
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '??';
    
  return (
    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-sm flex items-center justify-center border border-border">
      {initials}
    </div>
  );
};

const ACADEMIC_MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'
];

export default function SalaryDisbursementPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentYear } = useAcademicYear();

  // Get month from query param or fallback to current month name
  const getInitialMonth = () => {
    const monthParam = searchParams.get('month');
    if (monthParam && ACADEMIC_MONTHS.includes(monthParam)) {
      return monthParam;
    }
    const currentMonthIndex = new Date().getMonth(); // 0-11 (Jan=0, Dec=11)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const systemMonthName = monthNames[currentMonthIndex];
    return ACADEMIC_MONTHS.includes(systemMonthName) ? systemMonthName : 'April';
  };

  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [teachersList, setTeachersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPayments = async (monthName) => {
    setLoading(true);
    try {
      const list = await schoolService.getStaffPayments({ month: monthName });
      setTeachersList(list || []);
    } catch (err) {
      console.error('Failed to fetch salary payments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments(selectedMonth);
  }, [selectedMonth, currentYear]);

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    setSearchParams({ month: newMonth });
  };

  // Calculations based on fetched teacher listing
  const totalSalary = teachersList.reduce((sum, t) => sum + parseFloat(t.payable_salary || 0), 0);
  const disbursedSalary = teachersList
    .filter(t => t.status === 'Paid')
    .reduce((sum, t) => sum + parseFloat(t.payable_salary || 0), 0);
  const pendingSalary = totalSalary - disbursedSalary;

  // Filtered teachers list
  const filteredTeachers = teachersList.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.designation && t.designation.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate('/school-admin')}
            className="rounded-full flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Salary Disbursement</h2>
            <p className="text-xs text-text-secondary font-semibold uppercase mt-0.5 tracking-wider">
              Month: {selectedMonth} 2026 · Academic Year: {currentYear?.name || '—'}
            </p>
          </div>
        </div>

        {/* Month Selector dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Month:</label>
          <select 
            value={selectedMonth}
            onChange={handleMonthChange}
            className="h-10 px-3 border border-border rounded-xl bg-surface text-text-primary text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {ACADEMIC_MONTHS.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-surface border border-border rounded-2xl shadow-xs">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Salary</p>
              <h3 className="text-2xl font-bold text-text-primary mt-1 font-display">
                ₹{totalSalary.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-text-secondary">
              <Landmark className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-border rounded-2xl shadow-xs">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Salary Disbursed</p>
              <h3 className="text-2xl font-bold text-green-600 mt-1 font-display">
                ₹{disbursedSalary.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border border-border rounded-2xl shadow-xs">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Salary Pending</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1 font-display">
                ₹{pendingSalary.toLocaleString('en-IN')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teacher Listing Card container */}
      <Card className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden">
        {/* Search Header */}
        <div className="p-5 border-b border-border flex flex-col sm:flex-row items-center gap-4 justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Staff Payroll Status</h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input aria-label="Search teacher name or role..." 
              type="text" 
              placeholder="Search teacher name or role..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 rounded-xl"
            />
          </div>
        </div>

        {/* Listing Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Payroll Status...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center py-16 text-text-secondary text-sm">
            No active teachers found matching the criteria.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTeachers.map(teacher => (
              <div 
                key={teacher.id}
                onClick={() => navigate(`/school-admin/staff?id=${teacher.id}`)}
                className="flex items-center justify-between p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <TeacherAvatar src={teacher.photo_path} name={teacher.name} updatedAt={teacher.updated_at} />
                  <div>
                    <h4 className="text-sm font-bold text-text-primary group-hover:text-primary">{teacher.name}</h4>
                    <p className="text-xs text-text-muted font-bold uppercase mt-0.5">{teacher.designation}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 text-right">
                  <div>
                    <p className="text-xs font-bold text-text-muted uppercase">Salary Amount</p>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      {teacher.proration_details && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Prorated
                        </span>
                      )}
                      <p className="text-sm font-bold text-text-primary">
                        ₹{parseFloat(teacher.payable_salary || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-text-muted uppercase">Payment Date</p>
                    <p className="text-sm font-bold text-text-primary mt-0.5">{teacher.date}</p>
                  </div>

                  <div className="w-24 flex justify-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                      teacher.status === 'Paid'
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      {teacher.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
