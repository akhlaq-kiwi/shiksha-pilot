import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, CheckCircle2, ChevronRight, UserCog, Users, ShieldAlert, Award, FileSpreadsheet, ArrowLeft, RefreshCw, Check, Lock } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { apiClient } from '../../../common/services/apiClient';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';

export default function AuditsSettingsPage({ onYearsUpdated }) {
  const location = useLocation();
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1: Teachers, 2: Students, 3: Review
  const [targetYear, setTargetYear] = useState(null); // The year selected for activation
  const [formError, setFormError] = useState('');

  // Create Year Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createYearName, setCreateYearName] = useState('');
  const [createYearStartDate, setCreateYearStartDate] = useState('');
  const [createYearEndDate, setCreateYearEndDate] = useState('');

  // Warning & Direct Activation Modal States
  const [showNoDraftWarning, setShowNoDraftWarning] = useState(false);
  const [activateTargetYear, setActivateTargetYear] = useState(null);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);

  // Class Fee Configuration States
  const [selectedClassId, setSelectedClassId] = useState('');
  const [configuredClassIds, setConfiguredClassIds] = useState([]);
  const [feeMode, setFeeMode] = useState('SAME'); // 'SAME' or 'DIFFERENT'
  const [sameFeeAmount, setSameFeeAmount] = useState('');
  const [monthlyFeesMap, setMonthlyFeesMap] = useState({
    April: '', May: '', June: '', July: '', August: '', September: '',
    October: '', November: '', December: '', January: '', February: '', March: ''
  });
  const [isConfigLocked, setIsConfigLocked] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [feeError, setFeeError] = useState('');
  const [feeSuccess, setFeeSuccess] = useState('');
  const [isSwitchingClass, setIsSwitchingClass] = useState(false);

  // Source Data for Wizard
  const [staff, setStaff] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Wizard selections
  const [selectedTeachers, setSelectedTeachers] = useState({}); // { staffId: boolean }
  const [studentActions, setStudentActions] = useState({}); // { studentId: 'promote' | 'repeat' | 'graduate_alumni' | 'graduate_archive' }

  // Confirmation dialog
  const [showConfirmExecute, setShowConfirmExecute] = useState(false);
  const [executing, setExecuting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const years = await schoolService.getAcademicYears();
      setAcademicYears(years || []);
      if (onYearsUpdated) {
        onYearsUpdated(years || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load academic years.');
    } finally {
      setLoading(false);
    }
  };

  const { currentYear, isReadOnly, refreshYears } = useAcademicYear();

  useEffect(() => {
    loadData();
    const fetchClasses = async () => {
      try {
        const list = await schoolService.getClasses();
        setClasses(list || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchClasses();

    const handleYearSwitch = () => {
      loadData();
      fetchClasses();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  const fetchConfiguredClasses = async () => {
    const activeYear = currentYear || academicYears.find(y => y.is_current) || academicYears.find(y => y.status === 'Draft');
    if (!activeYear) return;
    try {
      const res = await schoolService.getClassFeeConfigurations({
        academic_year_id: activeYear.id
      });
      setConfiguredClassIds((res || []).map(c => String(c.class_id)));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConfiguredClasses();
  }, [currentYear, academicYears]);

  // Pre-select class from router state redirect if redirecting from Finance
  useEffect(() => {
    if (location.state && location.state.preselectClassId) {
      setSelectedClassId(String(location.state.preselectClassId));
    }
  }, [location.state]);

  // Load configuration for the selected class and active academic year
  useEffect(() => {
    const fetchConfig = async () => {
      if (!selectedClassId) {
        setIsConfigLocked(false);
        setFeeMode('SAME');
        setSameFeeAmount('');
        setMonthlyFeesMap({
          April: '', May: '', June: '', July: '', August: '', September: '',
          October: '', November: '', December: '', January: '', February: '', March: ''
        });
        return;
      }

      const activeYear = currentYear || academicYears.find(y => y.is_current) || academicYears.find(y => y.status === 'Draft');
      if (!activeYear) return;

      try {
        setFeeError('');
        const res = await schoolService.getClassFeeConfigurations({
          class_id: selectedClassId,
          academic_year_id: activeYear.id
        });
        
        if (res && res.length > 0) {
          const config = res[0];
          setFeeMode(config.mode);
          setIsConfigLocked(!!config.is_locked);
          
          if (config.mode === 'SAME') {
            setSameFeeAmount(config.monthly_fees.April || '');
          } else {
            setMonthlyFeesMap(config.monthly_fees);
          }
        } else {
          setIsConfigLocked(false);
          setFeeMode('SAME');
          setSameFeeAmount('');
          setMonthlyFeesMap({
            April: '', May: '', June: '', July: '', August: '', September: '',
            October: '', November: '', December: '', January: '', February: '', March: ''
          });
        }
      } catch (err) {
        console.error(err);
        setFeeError('Failed to load class fee configuration.');
      }
    };

    fetchConfig();
  }, [selectedClassId, academicYears]);

  const handleConfirmSaveConfig = () => {
    setFeeError('');
    setFeeSuccess('');

    // Validation
    if (!selectedClassId) {
      setFeeError('Please select a class.');
      return;
    }

    const activeYear = currentYear || academicYears.find(y => y.is_current) || academicYears.find(y => y.status === 'Draft');
    if (!activeYear) {
      setFeeError('Academic year not found. Please create an Academic Year first.');
      return;
    }

    if (feeMode === 'SAME') {
      if (!sameFeeAmount || parseFloat(sameFeeAmount) <= 0) {
        setFeeError('Fee amount must be greater than zero.');
        return;
      }
    } else {
      const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
      for (const m of academicMonths) {
        const val = monthlyFeesMap[m];
        if (val === undefined || val === null || val === '') {
          setFeeError('Please enter fee for every month.');
          return;
        }
        if (parseFloat(val) <= 0) {
          setFeeError('Fee amount must be greater than zero.');
          return;
        }
      }
    }

    setShowLockConfirm(true);
  };

  const handleSaveAndLockConfig = async () => {
    setShowLockConfirm(false);
    setFeeError('');
    setFeeSuccess('');

    const activeYear = currentYear || academicYears.find(y => y.is_current) || academicYears.find(y => y.status === 'Draft');
    if (!activeYear) return;

    const feesMap = {};
    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    
    if (feeMode === 'SAME') {
      academicMonths.forEach(m => {
        feesMap[m] = parseFloat(sameFeeAmount);
      });
    } else {
      academicMonths.forEach(m => {
        feesMap[m] = parseFloat(monthlyFeesMap[m]);
      });
    }

    try {
      await schoolService.saveClassFeeConfiguration({
        class_id: parseInt(selectedClassId, 10),
        academic_year_id: activeYear.id,
        mode: feeMode,
        monthly_fees: feesMap
      });

      await schoolService.lockClassFeeConfiguration({
        class_id: parseInt(selectedClassId, 10),
        academic_year_id: activeYear.id
      });

      setFeeSuccess('Fee configuration saved and locked successfully.');
      setIsConfigLocked(true);
      fetchConfiguredClasses();
      setSelectedClassId('');
    } catch (err) {
      console.error(err);
      setFeeError(err.message || 'Failed to save fee configuration.');
    }
  };

  // Open modal to create a Draft Academic Year
  const openCreateModal = () => {
    setFormError('');
    // Calculate prefilled next session
    let nextSessionName = '';
    let nextStartDate = '';
    let nextEndDate = '';

    const sorted = [...academicYears].sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
    if (sorted.length > 0) {
      const parts = sorted[0].name.trim().split(/[-–—]/);
      if (parts.length === 2) {
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        nextSessionName = `${start + 1}–${end + 1}`;
        nextStartDate = `${start + 1}-04-01`;
        nextEndDate = `${end + 1}-03-31`;
      }
    } else {
      const currentYear = new Date().getFullYear();
      nextSessionName = `${currentYear}–${currentYear + 1}`;
      nextStartDate = `${currentYear}-04-01`;
      nextEndDate = `${currentYear + 1}-03-31`;
    }

    setCreateYearName(nextSessionName);
    setCreateYearStartDate(nextStartDate);
    setCreateYearEndDate(nextEndDate);
    setIsCreateModalOpen(true);
  };

  const handleCreateAcademicYear = async () => {
    setFormError('');
    if (!createYearName.trim()) {
      setFormError('Academic Year name is required.');
      return;
    }
    if (!/^\d{4}[-–—]\d{4}$/.test(createYearName.trim())) {
      setFormError('Name must be in YYYY–YYYY format (e.g. 2027–2028).');
      return;
    }
    const parts = createYearName.trim().split(/[-–—]/);
    const start = parseInt(parts[0], 10);
    const end = parseInt(parts[1], 10);
    if (end !== start + 1) {
      setFormError('Session must span exactly one year (e.g. 2027–2028).');
      return;
    }

    // Check if it already exists
    const exists = academicYears.some(y => y.name.trim() === createYearName.trim());
    if (exists) {
      setFormError('This academic year already exists.');
      return;
    }

    if (!createYearStartDate) {
      setFormError('Start date is required.');
      return;
    }
    if (!createYearEndDate) {
      setFormError('End date is required.');
      return;
    }
    if (new Date(createYearEndDate) <= new Date(createYearStartDate)) {
      setFormError('End date must be after the start date.');
      return;
    }

    try {
      await schoolService.createAcademicYear({
        name: createYearName.trim(),
        start_date: createYearStartDate,
        end_date: createYearEndDate
      });
      setSuccess(`Academic Year ${createYearName} created in Draft state successfully.`);
      setIsCreateModalOpen(false);
      if (refreshYears) {
        await refreshYears();
      }
      loadData();
    } catch (err) {
      console.error(err);
      if (err.data && typeof err.data === 'object') {
        const firstErrKey = Object.keys(err.data)[0];
        setFormError(err.data[firstErrKey] || 'Failed to create academic year.');
      } else {
        setFormError(err.message || 'Failed to create academic year.');
      }
    }
  };

  // Open activation wizard for a Draft Academic Year
  const startActivation = async (year) => {
    setFormError('');
    setTargetYear(year);
    setWizardStep(1); // 1: Teachers, 2: Students, 3: Review

    try {
      const [staffList, studentList, classList, subjectList] = await Promise.all([
        schoolService.getStaff(),
        schoolService.getStudents(),
        schoolService.getClasses(),
        schoolService.getSubjects(),
      ]);

      setStaff(staffList || []);
      setStudents(studentList || []);
      setClasses(classList || []);
      setSubjects(subjectList || []);

      // Default selections
      // 1. Teachers: All active teachers selected by default
      const teacherMap = {};
      staffList
        .filter(s => (s.role === 'TEACHER' || s.role === 'Teacher') && s.status === 'ACTIVE')
        .forEach(t => {
          teacherMap[t.id] = true;
        });
      setSelectedTeachers(teacherMap);

      // 2. Students: Determine default actions for active students
      const studentMap = {};
      studentList
        .filter(s => s.status === 'ACTIVE')
        .forEach(s => {
          const isClass12 = s.class_name && s.class_name.toLowerCase().includes('12');
          studentMap[s.id] = isClass12 ? 'graduate_alumni' : 'promote';
        });
      setStudentActions(studentMap);

      setIsWizardOpen(true);
    } catch (err) {
      console.error(err);
      alert('Failed to load school data for the activation wizard.');
    }
  };

  const handleNextStep = () => {
    setFormError('');
    if (wizardStep === 1) {
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setWizardStep(3);
    }
  };

  const handlePrevStep = () => {
    setFormError('');
    if (wizardStep === 3) {
      setWizardStep(2);
    } else if (wizardStep === 2) {
      setWizardStep(1);
    }
  };

  const executeActivation = async () => {
    setExecuting(true);
    try {
      // Build teacher migrations list
      const teacherMigrations = Object.keys(selectedTeachers)
        .filter(id => selectedTeachers[id])
        .map(id => parseInt(id, 10));

      // Build student migrations array
      const studentMigrations = Object.keys(studentActions).map(id => ({
        student_id: parseInt(id, 10),
        action: studentActions[id],
      }));

      const payload = {
        teacher_migrations: teacherMigrations,
        student_migrations: studentMigrations,
      };

      await schoolService.migrateAcademicYear(targetYear.id, payload);

      setSuccess(`Academic Year ${targetYear.name} migration executed successfully.`);
      setIsWizardOpen(false);
      setShowConfirmExecute(false);
      loadData();
      
      // Auto reload after a brief moment to update app-wide contexts
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Migration failed. Please check validation rules.');
    } finally {
      setExecuting(false);
    }
  };

  const handleMigrateClick = (year) => {
    const draftYear = academicYears.find(y => y.status === 'Draft');
    if (!draftYear) {
      setShowNoDraftWarning(true);
    } else {
      startActivation(draftYear);
    }
  };

  const handleActivateDirectClick = (year) => {
    setActivateTargetYear(year);
    setShowActivateConfirm(true);
  };

  const handleActivateConfirm = async () => {
    if (!activateTargetYear) return;
    try {
      await schoolService.activateAcademicYear(activateTargetYear.id, {});
      setSuccess(`Academic Year ${activateTargetYear.name} is now ACTIVE.`);
      setShowActivateConfirm(false);
      loadData();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Activation failed.');
    }
  };

  // Helper to count results for review step
  const getReviewCounts = () => {
    let promoted = 0;
    let repeating = 0;
    let graduated = 0;

    Object.values(studentActions).forEach(act => {
      if (act === 'promote') promoted++;
      if (act === 'repeat') repeating++;
      if (act.startsWith('graduate_')) graduated++;
    });

    const activeTeachers = Object.values(selectedTeachers).filter(Boolean).length;

    return { promoted, repeating, graduated, activeTeachers };
  };

  const reviewCounts = getReviewCounts();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Audits & Settings</h2>
          <p className="text-text-secondary text-sm mt-1">Manage school academic sessions, audit logs, and promotions.</p>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Academic Years list */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-text-primary">Academic Years</CardTitle>
          {!isReadOnly && (
            <Button onClick={openCreateModal} className="h-8 font-bold flex items-center gap-1.5 shadow-sm text-xs">
              <Plus className="h-3.5 w-3.5" /> Create Academic Year
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Academic Year</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {academicYears.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-text-muted text-xs">
                    No academic years defined. Please create one to start.
                  </TableCell>
                </TableRow>
              ) : (
                academicYears.map(year => (
                  <TableRow key={year.id} className={year.is_current ? "bg-primary/5" : ""}>
                    <TableCell className="font-semibold text-text-primary">{year.name}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{year.start_date}</TableCell>
                    <TableCell className="text-text-secondary text-xs">{year.end_date}</TableCell>
                    <TableCell>
                      {year.status === 'ACTIVE' || year.is_current ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-500/10 text-green-600 border border-green-500/20">
                          Active
                        </span>
                      ) : year.status === 'Draft' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-border">
                          Archived
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isReadOnly && year.status === 'Draft' && (
                        <Button 
                          onClick={() => handleActivateDirectClick(year)}
                          className="h-7 px-3 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white"
                        >
                          Activate
                        </Button>
                      )}
                      {!isReadOnly && !!(year.status === 'ACTIVE' || year.is_current) && (
                        <Button 
                          onClick={() => handleMigrateClick(year)}
                          className="h-7 px-3 text-[10px] font-bold bg-primary hover:bg-primary/95 text-white"
                        >
                          Migrate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Class Fee Configuration Panel */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Class Fee Configuration</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {feeError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
              {feeError}
            </div>
          )}

          {feeSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold">
              {feeSuccess}
            </div>
          )}

          {!selectedClassId && (
            <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2.5 text-xs text-primary font-bold">
              <ShieldAlert className="h-4 w-4 text-primary flex-shrink-0" />
              <span>Please select a class to configure its fee structure.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="w-full sm:w-[240px]">
              <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Class *</label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                disabled={classes.length === 0}
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select Class</option>
                {classes.filter(c => !configuredClassIds.includes(String(c.id))).map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? ` - ${c.section}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 flex flex-col justify-end min-w-[280px]">
              <label className="text-xs font-bold text-text-secondary uppercase mb-2">Fee Mode</label>
              <div className="flex items-center gap-6 h-10">
                <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none">
                  <input
                    type="radio"
                    name="feeMode"
                    value="SAME"
                    checked={feeMode === 'SAME'}
                    disabled={!selectedClassId || isConfigLocked}
                    onChange={() => setFeeMode('SAME')}
                    className="rounded-full border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  Same fee for all months
                </label>
                <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer select-none">
                  <input
                    type="radio"
                    name="feeMode"
                    value="DIFFERENT"
                    checked={feeMode === 'DIFFERENT'}
                    disabled={!selectedClassId || isConfigLocked}
                    onChange={() => setFeeMode('DIFFERENT')}
                    className="rounded-full border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  Different fee every month
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-2">
            {feeMode === 'SAME' ? (
              <div className="space-y-2 w-full sm:w-[240px]">
                <label className="text-xs font-bold text-text-secondary uppercase">Fee Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-text-muted">₹</span>
                  <Input
                    type="number"
                    placeholder="e.g. 1500"
                    value={sameFeeAmount}
                    onChange={e => setSameFeeAmount(e.target.value)}
                    disabled={!selectedClassId || isConfigLocked}
                    className="pl-7 text-xs font-semibold w-full"
                  />
                </div>
                <p className="text-[10px] text-text-muted">This amount will be applied to all 12 academic months automatically.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] text-text-muted font-bold uppercase">Monthly Fees Grid</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'].map(m => (
                    <div key={m} className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-secondary uppercase">{m}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-text-muted">₹</span>
                        <Input
                          type="number"
                          placeholder="0"
                          value={monthlyFeesMap[m] || ''}
                          onChange={e => setMonthlyFeesMap(p => ({ ...p, [m]: e.target.value }))}
                          disabled={!selectedClassId || isConfigLocked}
                          className="pl-7 text-xs font-semibold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedClassId && (isConfigLocked || isReadOnly) ? (
              <div className="mt-6 p-4 bg-zinc-100 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                    <Lock className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary font-display">Fee Configuration Locked</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{isReadOnly ? 'Fee configuration cannot be modified in an archived academic year.' : 'This configuration is permanently locked for the active year.'}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-zinc-200 text-zinc-600 border border-zinc-300">
                  LOCKED
                </span>
              </div>
            ) : (
              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={handleConfirmSaveConfig}
                  disabled={!selectedClassId}
                  className="font-bold flex items-center gap-1.5 shadow-sm bg-primary"
                >
                  Save Fee Configuration
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save & Lock Confirmation Modal */}
      {showLockConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-extrabold text-text-primary text-base tracking-tight text-center font-display">
              Confirm Fee Lock
            </h3>
            <p className="text-xs text-text-secondary text-center leading-relaxed">
              Class fee configuration cannot be changed after saving. <br />
              Please verify all monthly fee amounts carefully. <br />
              Are you sure?
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setShowLockConfirm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveAndLockConfig} 
                className="font-bold"
              >
                Save & Lock
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Academic Year Dialog */}
      <Dialog 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Academic Year"
        description="Calculate operational dates and initialize a new academic session in Draft state."
      >
        <div className="space-y-6 pt-4">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
              {formError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase">Academic Year</label>
            <Input 
              placeholder="e.g. 2027–2028" 
              value={createYearName} 
              onChange={e => setCreateYearName(e.target.value)} 
              className="font-semibold text-sm"
            />
            <p className="text-[10px] text-text-muted">Enter the academic year name.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase">Start Date</label>
              <Input 
                type="date"
                value={createYearStartDate}
                onChange={e => setCreateYearStartDate(e.target.value)}
                onKeyDown={e => e.preventDefault()}
                className="font-semibold text-sm cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase">End Date</label>
              <Input 
                type="date"
                value={createYearEndDate}
                onChange={e => setCreateYearEndDate(e.target.value)}
                onKeyDown={e => e.preventDefault()}
                className="font-semibold text-sm cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAcademicYear} className="font-bold bg-primary">
              Save Academic Year
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Activation Wizard Dialog Modal */}
      <Dialog 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)}
        title="Academic Year Rollover Migration"
        description={`Migrate teachers, classes, and promote students into the ${targetYear?.name || ''} Draft session.`}
      >
        <div className="space-y-6 pt-4">
          
          {/* Step indicators */}
          <div className="flex items-center justify-between border-b border-border pb-4 select-none">
            {[
              { s: 1, label: 'Teachers' },
              { s: 2, label: 'Students' },
              { s: 3, label: 'Review' }
            ].map(step => (
              <div key={step.s} className="flex items-center gap-1.5 text-xs">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold border transition-colors ${wizardStep === step.s ? 'bg-primary border-primary text-zinc-50 dark:text-zinc-900' : wizardStep > step.s ? 'bg-green-500/15 border-green-500 text-green-600' : 'border-border text-text-muted'}`}>
                  {wizardStep > step.s ? <Check className="h-3 w-3" /> : step.s}
                </div>
                <span className={`font-semibold ${wizardStep === step.s ? 'text-primary' : 'text-text-muted'}`}>{step.label}</span>
                {step.s < 3 && <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}
              </div>
            ))}
          </div>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
              {formError}
            </div>
          )}

          {/* STEP 1: Teacher Migration */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider">Active Teachers Migration</h4>
                <span className="text-[10px] text-text-muted font-bold">{Object.values(selectedTeachers).filter(Boolean).length} Selected</span>
              </div>

              <div className="max-h-[240px] overflow-y-auto border border-border rounded-xl divide-y divide-border bg-zinc-50/50 dark:bg-zinc-950/20">
                {staff.filter(s => (s.role === 'TEACHER' || s.role === 'Teacher') && s.status === 'ACTIVE').length === 0 ? (
                  <p className="text-center py-8 text-xs text-text-muted">No active teachers found to migrate.</p>
                ) : (
                  staff.filter(s => (s.role === 'TEACHER' || s.role === 'Teacher') && s.status === 'ACTIVE').map(t => {
                    const tSubjects = subjects
                      .filter(sub => sub.teacher_name === t.name)
                      .map(sub => sub.name);
                    const subjectDisplay = tSubjects.length > 0 ? tSubjects.join(', ') : 'No subject assigned';

                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 text-xs hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50">
                        <label className="flex items-center gap-2.5 font-bold text-text-primary cursor-pointer w-full">
                          <input 
                            type="checkbox"
                            checked={!!selectedTeachers[t.id]}
                            onChange={() => setSelectedTeachers(p => ({ ...p, [t.id]: !p[t.id] }))}
                            className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <p className="font-bold text-text-primary text-xs">{t.name}</p>
                            <p className="text-[10px] text-text-muted font-medium mt-0.5">{subjectDisplay}</p>
                          </div>
                        </label>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20">Active</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Student Promotion */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider">Class-wise Student Promotions</h4>
              
              <div className="max-h-[280px] overflow-y-auto border border-border rounded-xl p-3 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/20">
                {classes.length === 0 ? (
                  <p className="text-center py-6 text-xs text-text-muted">No classes defined to promote students.</p>
                ) : (
                  classes.map(c => {
                    const classStudents = students.filter(s => s.class_id === c.id && s.status === 'ACTIVE');
                    if (classStudents.length === 0) return null;

                    const isClass12 = c.name.toLowerCase().includes('12');

                    return (
                      <div key={c.id} className="space-y-2">
                        <div className="flex items-center justify-between border-b border-border pb-1">
                          <span className="font-bold text-text-primary text-xs">{c.name} {c.section ? ` - ${c.section}` : ''}</span>
                          <span className="text-[10px] text-text-muted font-semibold">{classStudents.length} Students</span>
                        </div>
                        
                        <div className="space-y-2 pl-2">
                          {classStudents.map(student => {
                            const act = studentActions[student.id] || 'promote';
                            return (
                              <div key={student.id} className="flex items-center justify-between gap-3 text-xs py-1">
                                <span className="font-semibold text-text-secondary">{student.name}</span>
                                
                                <select 
                                  value={act}
                                  onChange={e => setStudentActions(p => ({ ...p, [student.id]: e.target.value }))}
                                  className="text-[11px] font-bold border border-border rounded-md px-2.5 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                                >
                                  {isClass12 ? (
                                    <>
                                      <option value="graduate_alumni">Mark Alumni</option>
                                      <option value="graduate_archive">Archive Student Record</option>
                                      <option value="repeat">Repeat Class 12</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="promote">Promote (Next Class)</option>
                                      <option value="repeat">Repeat (Failed/Repeat)</option>
                                    </>
                                  )}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {wizardStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h4 className="text-xs font-black uppercase text-text-secondary tracking-wider">Final Migration Review</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[9px] font-bold tracking-wider">Target Session</p>
                  <p className="text-lg font-black text-primary mt-1 font-display">{targetYear?.name}</p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[9px] font-bold tracking-wider">Migrated Teachers</p>
                  <p className="text-lg font-black text-text-primary mt-1 font-display">
                    {reviewCounts.activeTeachers}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[9px] font-bold tracking-wider">Students Promoted</p>
                  <p className="text-lg font-black text-teal-600 mt-1 font-display">
                    {reviewCounts.promoted}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[9px] font-bold tracking-wider">Students Repeating</p>
                  <p className="text-lg font-black text-amber-600 mt-1 font-display">
                    {reviewCounts.repeating}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs col-span-2">
                  <p className="text-text-muted uppercase text-[9px] font-bold tracking-wider">Graduated / Alumni</p>
                  <p className="text-lg font-black text-indigo-600 mt-1 font-display">{reviewCounts.graduated}</p>
                </Card>
              </div>

              <div className="p-3 bg-zinc-50 border border-border rounded-xl text-[10px] text-text-muted flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>
                  All existing academic data (fee payments, grades, attendance, logs) for the previous sessions will remain permanently preserved and locked.
                </span>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="flex justify-between items-center border-t border-border pt-4 bg-surface">
            {wizardStep > 1 ? (
              <Button variant="secondary" onClick={handlePrevStep} className="font-bold flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div></div>
            )}

            {wizardStep < 3 ? (
              <Button onClick={handleNextStep} className="font-bold flex items-center gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => setShowConfirmExecute(true)} className="font-bold bg-green-600 hover:bg-green-700 text-white shadow-md animate-pulse">
                Activate Academic Year
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog overlay */}
      {showConfirmExecute && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-extrabold text-text-primary text-base tracking-tight text-center font-display">
              Confirm Migration
            </h3>
            <p className="text-xs text-text-secondary text-center leading-relaxed">
              Migrating to this Academic Year will copy classes, subjects, timetables, and execute student promotions into the Draft session. The target session will remain in Draft status. Do you want to continue?
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setShowConfirmExecute(false)} disabled={executing}>
                Cancel
              </Button>
              <Button 
                onClick={executeActivation} 
                disabled={executing}
                className="font-bold bg-primary hover:bg-primary/95 text-white flex items-center gap-1.5"
              >
                {executing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Processing...
                  </>
                ) : (
                  'Migrate'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No Draft Warning Modal */}
      {showNoDraftWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-extrabold text-text-primary text-base tracking-tight text-center font-display">
              No Draft Academic Year Found
            </h3>
            <p className="text-xs text-text-secondary text-center leading-relaxed">
              Please create the next Academic Year before migrating students and teachers.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setShowNoDraftWarning(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  setShowNoDraftWarning(false);
                  openCreateModal();
                }}
                className="font-bold"
              >
                Create Academic Year
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Confirm Modal */}
      {showActivateConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-extrabold text-text-primary text-base tracking-tight text-center font-display">
              Confirm Activation
            </h3>
            <p className="text-xs text-text-secondary text-center leading-relaxed">
              Are you sure you want to activate the academic year <strong>{activateTargetYear?.name}</strong>? <br />
              This will set it as the official Active session and Archive the previous Active academic year.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setShowActivateConfirm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleActivateConfirm}
                className="font-bold bg-green-600 hover:bg-green-700 text-white"
              >
                Activate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
