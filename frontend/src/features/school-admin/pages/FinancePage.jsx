import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, AlertCircle, Landmark } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Button } from '../../../common/ui/button';
import { schoolService } from '../../../common/services/schoolService';
import StudentDetailsPage from './StudentDetailsPage';
import StudentEnrollmentForm from './StudentEnrollmentForm';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const getStatusBadgeStyles = (status) => {
  const map = {
    PAID: 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-900/30',
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/30',
    PARTIAL: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/30',
    '—': 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    OVERDUE: 'bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 dark:border-orange-900/30',
    CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900/30',
    DEFAULT: 'bg-rose-900/10 text-rose-900 dark:bg-rose-950/30 dark:text-rose-400 border-rose-300 dark:border-rose-900/30',
  };
  return map[status] || 'bg-zinc-100 text-zinc-800 border-zinc-200';
};

const ACADEMIC_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

const SkeletonRow = () => (
  <TableRow className="animate-pulse">
    <TableCell className="py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-28"></div></TableCell>
    <TableCell className="py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div></TableCell>
    <TableCell className="py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-10"></div></TableCell>
    <TableCell className="py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div></TableCell>
    <TableCell className="py-4"><div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-full w-20"></div></TableCell>
    <TableCell className="py-4 text-right"><div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-full w-24 ml-auto"></div></TableCell>
  </TableRow>
);

export default function FinancePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [additionalFeePayments, setAdditionalFeePayments] = useState([]);
  const [classFeeConfigs, setClassFeeConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortByOutstanding, setSortByOutstanding] = useState('NONE');
  
  // Inline Detail View State
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'details', 'edit'

  // Lazy Loading / Infinite Scroll States
  const [visibleCount, setVisibleCount] = useState(25);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const scrollContainerRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [stuData, clsData, fpData, cfgData, addData] = await Promise.all([
        schoolService.getStudents(),
        schoolService.getClasses(),
        schoolService.getFeePayments(),
        schoolService.getClassFeeConfigurations(),
        schoolService.getAdditionalFeePayments()
      ]);
      setStudents(stuData || []);
      setClasses(clsData || []);
      setFeePayments(fpData || []);
      setClassFeeConfigs(cfgData || []);
      setAdditionalFeePayments(addData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load fees records and student list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset pagination when filter selections change
  useEffect(() => {
    setVisibleCount(25);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchTerm, selectedClassId, selectedStatus]);

  if (view === 'details' && selectedStudentId) {
    return (
      <StudentDetailsPage 
        studentId={selectedStudentId} 
        onBack={() => {
          setSelectedStudentId(null);
          setView('list');
          loadData(); // reload in case payments were collected
        }} 
        onEdit={(id) => {
          setSelectedStudentId(id);
          setView('edit');
        }}
      />
    );
  }

  if (view === 'edit' && selectedStudentId) {
    return (
      <StudentEnrollmentForm 
        studentId={selectedStudentId} 
        onCancel={() => setView('details')} 
        onSuccess={async () => {
          setView('details');
          await loadData();
        }} 
      />
    );
  }

  // Determine current evaluation months based on academic index
  const now = new Date();
  const calendarMonth = now.getMonth(); // 0 = Jan, 1 = Feb, ..., 11 = Dec
  const monthMapping = {
    3: 0,  // April
    4: 1,  // May
    5: 2,  // June
    6: 3,  // July
    7: 4,  // August
    8: 5,  // September
    9: 6,  // October
    10: 7, // November
    11: 8, // December
    0: 9,  // January
    1: 10, // February
    2: 11  // March
  };
  const currentAcademicIdx = monthMapping[calendarMonth] !== undefined ? monthMapping[calendarMonth] : 2; // default to June/index 2 if outside mapping
  const monthsToEvaluate = ACADEMIC_MONTHS.slice(0, currentAcademicIdx + 1);

  // Group payments by student ID
  const paymentsByStudent = {};
  feePayments.forEach(p => {
    if (p.status === 'PAID') {
      if (!paymentsByStudent[p.student_id]) {
        paymentsByStudent[p.student_id] = [];
      }
      paymentsByStudent[p.student_id].push({
        fee_month: p.fee_month,
        academic_year_id: p.academic_year_id
      });
    }
  });

  // Group class fee configs by class ID
  const feeConfigMap = {};
  classFeeConfigs.forEach(cfg => {
    try {
      const monthlyFees = typeof cfg.monthly_fees === 'string' ? JSON.parse(cfg.monthly_fees) : cfg.monthly_fees;
      feeConfigMap[cfg.class_id] = monthlyFees;
    } catch (e) {
      console.error('Failed parsing monthly fees JSON config', e);
    }
  });

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  // Group additional fee payments by student
  const additionalUnpaidByStudent = {};
  const unpaidAddCountByStudent = {};
  const hasPreviousYearDuesByStudent = {};

  additionalFeePayments.forEach(p => {
    if (p.status === 'Pending' && (!p.due_date || p.due_date <= todayStr || p.fee_name === 'Previous Year Dues')) {
      const studentId = parseInt(p.student_id, 10);
      if (!additionalUnpaidByStudent[studentId]) {
        additionalUnpaidByStudent[studentId] = 0;
      }
      additionalUnpaidByStudent[studentId] += parseFloat(p.amount || 0);

      if (!unpaidAddCountByStudent[studentId]) {
        unpaidAddCountByStudent[studentId] = 0;
      }
      unpaidAddCountByStudent[studentId]++;

      if (p.fee_name === 'Previous Year Dues') {
        hasPreviousYearDuesByStudent[studentId] = true;
      }
    }
  });

  // Process students status & outstanding dues
  const processedStudents = students.map(student => {
    const paidMonthsList = paymentsByStudent[student.id] || [];
    const paidMonths = paidMonthsList
      .filter(p => parseInt(p.academic_year_id, 10) === parseInt(student.academic_year_id, 10))
      .map(p => p.fee_month);
    const monthlyFees = feeConfigMap[student.class_id] || {};
    
    // Check if monthly fees are configured at all
    const hasConfiguredFees = Object.keys(monthlyFees).length > 0 && Object.values(monthlyFees).some(v => parseFloat(v) > 0);

    let unpaidCount = 0;
    let outstandingDues = 0;

    monthsToEvaluate.forEach(m => {
      if (!paidMonths.includes(m)) {
        const amt = monthlyFees[m] !== undefined ? parseFloat(monthlyFees[m]) : 0;
        if (amt > 0) {
          unpaidCount++;
          outstandingDues += amt;
        }
      }
    });

    const unpaidAddAmt = additionalUnpaidByStudent[student.id] || 0;
    outstandingDues += unpaidAddAmt;

    const paidAddCount = additionalFeePayments.filter(p => parseInt(p.student_id, 10) === student.id && p.status === 'Paid').length;
    const hasPayments = paidMonths.length > 0 || paidAddCount > 0;

    let status = 'PAID';
    if (outstandingDues > 0) {
      status = 'PENDING';
    }

    return {
      ...student,
      outstanding_dues: outstandingDues,
      calculated_status: status
    };
  });

  // Sort processedStudents by class creation order (determined by index in the classes array)
  // Within each class, keep the existing relative order of students
  const classIdOrderMap = {};
  classes.forEach((cls, idx) => {
    classIdOrderMap[cls.id] = idx;
  });

  const sortedProcessedStudents = [...processedStudents].sort((a, b) => {
    if (sortByOutstanding === 'DESC') {
      if (b.outstanding_dues !== a.outstanding_dues) {
        return b.outstanding_dues - a.outstanding_dues;
      }
    } else if (sortByOutstanding === 'ASC') {
      if (a.outstanding_dues !== b.outstanding_dues) {
        return a.outstanding_dues - b.outstanding_dues;
      }
    }

    const orderA = classIdOrderMap[a.class_id] !== undefined ? classIdOrderMap[a.class_id] : 999999;
    const orderB = classIdOrderMap[b.class_id] !== undefined ? classIdOrderMap[b.class_id] : 999999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const idxA = students.findIndex(s => s.id === a.id);
    const idxB = students.findIndex(s => s.id === b.id);
    return idxA - idxB;
  });

  // Filter students based on UI selections (Search strictly by Student Name only)
  const filteredStudents = sortedProcessedStudents.filter(student => {
    const term = searchTerm.toLowerCase().trim().replace(/\s+/g, ' ');
    let matchesSearch = true;
    if (term) {
      const studentName = (student.name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const firstName = (student.first_name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const lastName = (student.last_name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      
      const queryWords = term.split(' ');
      matchesSearch = queryWords.every(word => 
        studentName.includes(word) || firstName.includes(word) || lastName.includes(word)
      );
    }
    const matchesClass = selectedClassId === 'ALL' || String(student.class_id) === String(selectedClassId);
    const matchesStatus = selectedStatus === 'ALL' || student.calculated_status === selectedStatus;

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Infinite Scroll Trigger
  const handleScroll = (e) => {
    if (isFetchingMore) return;
    const target = e.target;
    // Trigger when scrolled to within 60px of the bottom
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      if (visibleCount < filteredStudents.length) {
        setIsFetchingMore(true);
        setTimeout(() => {
          setVisibleCount(prev => prev + 25);
          setIsFetchingMore(false);
        }, 400); // 400ms delay to simulate loading smoothly
      }
    }
  };

  const paginatedStudents = filteredStudents.slice(0, visibleCount);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 max-h-[82vh] md:max-h-[85vh] animate-in fade-in duration-300">
      
      {/* Sticky Header Panel */}
      <div className="flex-shrink-0 bg-surface border border-border p-6 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Fees Portal</h2>
            <p className="text-text-secondary text-xs mt-1">Monitor fee statuses, calculate dynamic outstanding monthly balances, and collect dues.</p>
          </div>
        </div>

        {/* Dynamic Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted animate-pulse" />
            <Input 
              placeholder="Search by Student Name..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="pl-9 text-xs py-2"
            />
          </div>

          <div>
            <Select 
              value={selectedClassId} 
              onChange={e => setSelectedClassId(e.target.value)}
              className="text-xs cursor-pointer font-bold text-text-primary"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
              ))}
            </Select>
          </div>

          <div>
            <Select 
              value={selectedStatus} 
              onChange={e => setSelectedStatus(e.target.value)}
              className="text-xs cursor-pointer font-bold text-text-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
            </Select>
          </div>

          <div>
            <Select 
              value={sortByOutstanding} 
              onChange={e => setSortByOutstanding(e.target.value)}
              className="text-xs cursor-pointer font-bold text-text-primary"
            >
              <option value="NONE">Sort Outstanding</option>
              <option value="DESC">Highest to Lowest</option>
              <option value="ASC">Lowest to Highest</option>
            </Select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold flex-shrink-0">
          {error}
        </div>
      )}

      {/* Scrollable Table Area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs"
      >
        {loading ? (
          <Table>
            <TableHeader className="sticky top-0 bg-surface z-10">
              <TableRow>
                <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Student Name</TableHead>
                <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Class</TableHead>
                <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Roll No.</TableHead>
                <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Outstanding</TableHead>
                <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Status</TableHead>
                <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
            </TableBody>
          </Table>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-xs font-bold leading-relaxed space-y-1">
            <p>No students found.</p>
            <p className="text-[10px] text-text-muted font-normal">Try another student name.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="sticky top-0 bg-surface z-10 shadow-3xs border-b border-border">
                <TableRow>
                  <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Student Name</TableHead>
                  <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Class</TableHead>
                  <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Roll No.</TableHead>
                  <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Outstanding</TableHead>
                  <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Status</TableHead>
                  <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary bg-surface">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-semibold text-text-primary text-xs py-3.5">
                      {s.name}
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary font-bold uppercase py-3.5">
                      {s.class_name || '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-bold text-text-muted py-3.5">
                      {s.roll_no || '—'}
                    </TableCell>
                    <TableCell className={`text-xs font-bold font-sans py-3.5 ${s.outstanding_dues > 0 ? 'text-red-500 font-extrabold' : 'text-text-muted'}`}>
                      {formatCurrency(s.outstanding_dues)}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <span className={`inline-flex items-center justify-center w-[74px] py-0.5 rounded-full text-[9px] font-black uppercase border ${getStatusBadgeStyles(s.calculated_status)}`}>
                        {s.calculated_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-3.5">
                      <button 
                        onClick={() => {
                          navigate(`/school-admin/classes?studentId=${s.id}`, { state: { from: location.pathname + location.search } });
                        }}
                        className="px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-text-primary border border-border transition-all inline-flex items-center gap-1 leading-none h-[22px]"
                      >
                        Open Ledger <ChevronRight className="h-3 w-3 text-text-muted" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Infinite Scroll Fetching Indicator */}
            {isFetchingMore && (
              <div className="py-5 flex flex-col items-center justify-center gap-2 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/10">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Loading more students...</span>
              </div>
            )}
          </>
        )}
      </div>
      
    </div>
  );
}
