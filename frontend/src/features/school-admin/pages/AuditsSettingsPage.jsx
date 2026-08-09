import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, CheckCircle2, ChevronRight, UserCog, Users, ShieldAlert, Award, FileSpreadsheet, ArrowLeft, RefreshCw, Check, Lock, Save, Trash2, Loader2, AlertTriangle, X, Download } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { apiClient } from '../../../common/services/apiClient';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { getClassIndex } from '../../../common/constants/predefinedClasses';
import html2pdf from 'html2pdf.js';

export default function AuditsSettingsPage({ onYearsUpdated }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [academicYears, setAcademicYears] = useState([]);
  const [showLppAlert, setShowLppAlert] = useState(false);
  const [pendingDraftYear, setPendingDraftYear] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- User Role & Class Assignment States ---
  const [teachersWithPerms, setTeachersWithPerms] = useState([]);
  const [classesWithTeachers, setClassesWithTeachers] = useState([]);
  const [selectedPermTeacherId, setSelectedPermTeacherId] = useState('');
  const [selectedPermMenus, setSelectedPermMenus] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [savingClassId, setSavingClassId] = useState(null);

  const [permSuccess, setPermSuccess] = useState('');
  const [permError, setPermError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [assignError, setAssignError] = useState('');

  const [localAssignments, setLocalAssignments] = useState({});

  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [replaceClassId, setReplaceClassId] = useState(null);
  const [replacePrevTeacherName, setReplacePrevTeacherName] = useState('');
  const [replaceNewTeacherId, setReplaceNewTeacherId] = useState('');
  const [replaceNewTeacherName, setReplaceNewTeacherName] = useState('');

  // Auto-clear success message for Class Teacher assignment after 5 seconds
  useEffect(() => {
    if (assignSuccess) {
      const timer = setTimeout(() => {
        setAssignSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [assignSuccess]);

  const MENU_OPTIONS = [
    'Dashboard',
    'Classes',
    'Teachers',
    'Attendance',
    'Leave Requests',
    'Examinations',
    'Fees Portal',
    'Financial Reports',
    'Finance Management',
    'Fee Follow-up',
    'Timetable',
    'Audits & Settings',
    'Security'
  ];

  const loadPermissionsAndAssignments = async () => {
    try {
      const [permData, assignData] = await Promise.all([
        schoolService.getMenuPermissions(),
        schoolService.getClassTeacherAssignments()
      ]);
      
      const teachers = permData.teachers || [];
      setTeachersWithPerms(teachers);

      const clsList = assignData.classes || [];
      setClassesWithTeachers(clsList);
      
      const localMap = {};
      clsList.forEach(c => {
        localMap[c.id] = c.assigned_teacher_id || '';
      });
      setLocalAssignments(localMap);
    } catch (err) {
      console.error("Failed to load permissions/assignments", err);
    }
  };

  const handleTeacherSelectForPermissions = (teacherId) => {
    setSelectedPermTeacherId(teacherId);
    setPermSuccess('');
    setPermError('');
    if (!teacherId) {
      setSelectedPermMenus([]);
      return;
    }
    const matched = teachersWithPerms.find(t => String(t.id) === String(teacherId));
    setSelectedPermMenus(matched ? matched.menus : []);
  };

  const handleMenuCheckboxChange = async (menuLabel) => {
    if (!selectedPermTeacherId) return;

    setPermSuccess('');
    setPermError('');

    const currentMenus = [...selectedPermMenus];
    const updatedMenus = currentMenus.includes(menuLabel)
      ? currentMenus.filter(m => m !== menuLabel)
      : [...currentMenus, menuLabel];

    // Optimistically update UI state
    setSelectedPermMenus(updatedMenus);
    setSavingPermissions(true);

    try {
      await schoolService.saveMenuPermissions({
        teacher_id: selectedPermTeacherId,
        menus: updatedMenus
      });
      setPermSuccess('Permissions updated successfully.');
      await loadPermissionsAndAssignments();
    } catch (err) {
      console.error(err);
      setPermError('Unable to save changes. Please try again.');
      // Revert UI state on error
      setSelectedPermMenus(currentMenus);
    } finally {
      setSavingPermissions(false);
    }
  };

  const executeAutoSaveClassAssignment = async (classId, newTeacherId, previousTeacherId) => {
    setSavingClassId(classId);
    setAssignSuccess('');
    setAssignError('');
    
    // Optimistically update local assignments state
    setLocalAssignments(prev => ({ ...prev, [classId]: newTeacherId }));

    try {
      // Build assignments payload (updating all to match localAssignments, but with the new one)
      const payloadAssignments = Object.entries({
        ...localAssignments,
        [classId]: newTeacherId
      }).map(([cId, tId]) => ({
        class_id: parseInt(cId),
        teacher_id: tId ? parseInt(tId) : null
      }));

      await schoolService.saveClassTeacherAssignments({
        assignments: payloadAssignments
      });
      
      setAssignSuccess(newTeacherId ? 'Class teacher assigned successfully.' : 'Class teacher unassigned successfully.');
      await loadPermissionsAndAssignments();
    } catch (err) {
      console.error(err);
      setAssignError('Unable to save changes. Please try again.');
      // Revert local assignments state on error
      setLocalAssignments(prev => ({ ...prev, [classId]: previousTeacherId || '' }));
    } finally {
      setSavingClassId(null);
    }
  };

  const handleClassTeacherChange = (classId, newTeacherId) => {
    setAssignSuccess('');
    setAssignError('');

    const previousTeacherId = localAssignments[classId] || '';

    if (!newTeacherId) {
      executeAutoSaveClassAssignment(classId, '', previousTeacherId);
      return;
    }

    const currentClassWithThisTeacher = Object.entries(localAssignments).find(
      ([cId, tId]) => String(tId) === String(newTeacherId) && String(cId) !== String(classId)
    );

    if (currentClassWithThisTeacher) {
      const otherClassId = currentClassWithThisTeacher[0];
      const otherClass = classesWithTeachers.find(c => String(c.id) === String(otherClassId));
      const otherClassName = otherClass ? (otherClass.name + (otherClass.section ? '-' + otherClass.section : '')) : 'another class';
      
      const teacher = teachersWithPerms.find(t => String(t.id) === String(newTeacherId));
      const tName = teacher ? teacher.name : 'This teacher';

      setAssignError(`This teacher is already assigned to ${otherClassName}.`);
      return;
    }

    if (previousTeacherId && String(previousTeacherId) !== String(newTeacherId)) {
      const prevTeacher = teachersWithPerms.find(t => String(t.id) === String(previousTeacherId));
      const newTeacher = teachersWithPerms.find(t => String(t.id) === String(newTeacherId));

      setReplaceClassId(classId);
      setReplacePrevTeacherName(prevTeacher ? prevTeacher.name : 'Unknown');
      setReplaceNewTeacherId(newTeacherId);
      setReplaceNewTeacherName(newTeacher ? newTeacher.name : 'Unknown');
      setShowReplaceConfirm(true);
    } else {
      executeAutoSaveClassAssignment(classId, newTeacherId, previousTeacherId);
    }
  };

  const handleConfirmReplacement = () => {
    setShowReplaceConfirm(false);
    const previousTeacherId = localAssignments[replaceClassId] || '';
    executeAutoSaveClassAssignment(replaceClassId, replaceNewTeacherId, previousTeacherId);
  };
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
  const [showMigrationAlertModal, setShowMigrationAlertModal] = useState(false);
  const [showNoDraftModal, setShowNoDraftModal] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  // Class Fee Configuration States
  const [selectedClassId, setSelectedClassId] = useState('');
  const [showSelectClassNotice, setShowSelectClassNotice] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    setShowSelectClassNotice(true);
    const timer = setTimeout(() => {
      setShowSelectClassNotice(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
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

  useEffect(() => {
    if (!feeSuccess) return;
    const timer = setTimeout(() => {
      setFeeSuccess('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [feeSuccess]);

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
  const [showInactiveTeachers, setShowInactiveTeachers] = useState(false);
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);



  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [years] = await Promise.all([
        schoolService.getAcademicYears()
      ]);
      setAcademicYears(years || []);
      if (onYearsUpdated) {
        onYearsUpdated(years || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load settings data.');
    } finally {
      setLoading(false);
    }
  };

  const { currentYear, isReadOnly, refreshYears } = useAcademicYear();

  // Period Configuration state
  const [schoolStartTime, setSchoolStartTime] = useState('08:00');
  const [periodDuration, setPeriodDuration] = useState(40);
  const [intervalDuration, setIntervalDuration] = useState(20);
  const [intervalAfterPeriod, setIntervalAfterPeriod] = useState(4);
  const [totalPeriods, setTotalPeriods] = useState(8);

  const [periods, setPeriods] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodSuccess, setPeriodSuccess] = useState('');
  const [periodError, setPeriodError] = useState('');
  const [initialTotalPeriods, setInitialTotalPeriods] = useState(null);
  const [showConfirmConfig, setShowConfirmConfig] = useState(false);
  const [savedSettings, setSavedSettings] = useState(null);

  const isChanged = !!(
    savedSettings && (
      schoolStartTime !== savedSettings.schoolStartTime ||
      parseInt(periodDuration || 0, 10) !== parseInt(savedSettings.periodDuration || 0, 10) ||
      parseInt(intervalDuration || 0, 10) !== parseInt(savedSettings.intervalDuration || 0, 10) ||
      parseInt(intervalAfterPeriod || 0, 10) !== parseInt(savedSettings.intervalAfterPeriod || 0, 10) ||
      parseInt(totalPeriods || 0, 10) !== parseInt(savedSettings.totalPeriods || 0, 10)
    )
  );



  const getLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime12h = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hr = parseInt(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const formattedHr = hr % 12 || 12;
    const padHr = String(formattedHr).padStart(2, '0');
    return `${padHr}:${m} ${ampm}`;
  };

  const getBreakTimingStr = () => {
    const afterPeriod = periods.find(p => p.period_number === parseInt(intervalAfterPeriod));
    const nextPeriod = periods.find(p => p.period_number === parseInt(intervalAfterPeriod) + 1);
    if (!afterPeriod || !nextPeriod) return '';
    return `${formatTime12h(afterPeriod.end_time)} – ${formatTime12h(nextPeriod.start_time)}`;
  };

  const loadPeriodConfigs = async () => {
    try {
      const todayStr = getLocalDateStr();
      const settings = await schoolAdminService.getTimetableSettings();
      if (settings) {
        const parsedStart = settings.school_start_time.substring(0, 5);
        setSchoolStartTime(parsedStart);
        setPeriodDuration(settings.period_duration);
        setIntervalDuration(settings.interval_duration);
        setIntervalAfterPeriod(settings.interval_after_period);
        setTotalPeriods(settings.total_periods);
        setInitialTotalPeriods(settings.total_periods);
        setShowPreview(true);
        setSavedSettings({
          schoolStartTime: parsedStart,
          periodDuration: settings.period_duration,
          intervalDuration: settings.interval_duration,
          intervalAfterPeriod: settings.interval_after_period,
          totalPeriods: settings.total_periods
        });

        const data = await schoolAdminService.getPeriodConfigurations({ date: todayStr });
        setPeriods(data || []);
      } else {
        setShowPreview(false);
        setPeriods([]);
        setSavedSettings(null);
      }
    } catch (err) {
      console.error('Failed to load period configurations', err);
    }
  };

  const executeSavePeriods = async (clearTimetable) => {
    setShowConfirmConfig(false);
    setPeriodLoading(true);
    setPeriodError('');
    setPeriodSuccess('');
    const todayStr = getLocalDateStr();
    try {
      await schoolAdminService.saveTimetableSettings({
        school_start_time: schoolStartTime,
        period_duration: parseInt(periodDuration),
        interval_duration: parseInt(intervalDuration),
        interval_after_period: parseInt(intervalAfterPeriod),
        total_periods: parseInt(totalPeriods),
        clear_timetable: clearTimetable,
        date: todayStr
      });
      setPeriodSuccess('Timetable settings saved and periods generated successfully.');
      setShowPreview(true);
      await loadPeriodConfigs();
    } catch (err) {
      console.error(err);
      setPeriodError(err.response?.data?.message || err.message || 'Failed to save settings.');
    } finally {
      setPeriodLoading(false);
    }
  };

  const handleSavePeriods = async () => {
    setPeriodError('');
    setPeriodSuccess('');
    
    // Front-end validations
    if (!schoolStartTime) {
      setPeriodError('School start time is required.');
      return;
    }
    if (parseInt(periodDuration) <= 0) {
      setPeriodError('Period duration must be greater than 0.');
      return;
    }
    if (parseInt(intervalDuration) < 0) {
      setPeriodError('Interval duration must be 0 or greater.');
      return;
    }
    if (parseInt(totalPeriods) <= 0) {
      setPeriodError('Total periods must be greater than 0.');
      return;
    }
    if (parseInt(intervalAfterPeriod) < 1 || parseInt(intervalAfterPeriod) > parseInt(totalPeriods)) {
      setPeriodError(`Interval break must be placed between Period 1 and Period ${totalPeriods}.`);
      return;
    }

    const isCountChanged = initialTotalPeriods !== null && parseInt(totalPeriods) !== parseInt(initialTotalPeriods);
    if (isCountChanged) {
      setShowConfirmConfig(true);
    } else {
      executeSavePeriods(false);
    }
  };

  useEffect(() => {
    loadData();
    loadPeriodConfigs();
    loadPermissionsAndAssignments();
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
      loadPeriodConfigs();
      loadPermissionsAndAssignments();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  const fetchConfiguredClasses = async () => {
    const activeYear = currentYear || academicYears.find(y => y.is_current);
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

  // Group classes by unique Class Name so fee configuration applies class-wide across all sections
  const uniqueClassGroups = useMemo(() => {
    const map = new Map();
    (classes || []).forEach(c => {
      if (!c.name) return;
      if (!map.has(c.name)) {
        map.set(c.name, []);
      }
      map.get(c.name).push(c);
    });

    return Array.from(map.entries()).map(([className, items]) => {
      const hasConfiguredName = (configuredClassIds || []).some(cid => {
        const found = (classes || []).find(cl => String(cl.id) === String(cid));
        return found && found.name === className;
      });

      return {
        name: className,
        primaryId: String(items[0].id),
        allIds: items.map(item => String(item.id)),
        isConfigured: items.some(item => configuredClassIds.includes(String(item.id))) || hasConfiguredName
      };
    });
  }, [classes, configuredClassIds]);

  // Pre-select class from router state redirect if redirecting from Finance or StudentDetails
  useEffect(() => {
    if (location.state && (location.state.preselectClassId || location.state.classId || location.state.selectedClassId)) {
      const targetId = String(location.state.preselectClassId || location.state.classId || location.state.selectedClassId);
      if (uniqueClassGroups && uniqueClassGroups.length > 0) {
        const foundGroup = uniqueClassGroups.find(g => g.allIds.includes(targetId) || g.primaryId === targetId);
        if (foundGroup) {
          setSelectedClassId(foundGroup.primaryId);
        } else {
          setSelectedClassId(targetId);
        }
      } else {
        setSelectedClassId(targetId);
      }

      setTimeout(() => {
        const el = document.getElementById('class-fee-config-panel');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  }, [location.state, uniqueClassGroups]);

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

      const activeYear = currentYear || academicYears.find(y => y.is_current);
      if (!activeYear) return;

      try {
        setFeeError('');
        const selectedGroup = uniqueClassGroups.find(g => g.allIds.includes(String(selectedClassId)));
        const targetName = selectedGroup ? selectedGroup.name : (classes.find(c => String(c.id) === String(selectedClassId))?.name);

        const allConfigs = await schoolService.getClassFeeConfigurations({
          academic_year_id: activeYear.id
        });

        let config = null;
        if (allConfigs && allConfigs.length > 0) {
          config = allConfigs.find(cfg => {
            if (selectedGroup && selectedGroup.allIds.includes(String(cfg.class_id))) return true;
            const c = classes.find(cl => String(cl.id) === String(cfg.class_id));
            return c && c.name === targetName;
          });
        }

        if (config) {
          setFeeMode(config.mode || 'SAME');
          setIsConfigLocked(false); // Ignore is_locked: monthly fee must be editable whenever required
          
          if (config.mode === 'SAME') {
            setSameFeeAmount(config.monthly_fees?.April || '');
          } else {
            setMonthlyFeesMap(config.monthly_fees || {});
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
  }, [selectedClassId, academicYears, uniqueClassGroups, classes]);

  const handleDownloadFeeStructurePdf = async () => {
    try {
      setDownloadingPdf(true);
      const activeYear = currentYear || academicYears.find(y => y.is_current) || academicYears[0];
      const yearName = activeYear ? activeYear.name : '2026-2027';

      let startYr = '2026';
      let endYr = '2027';
      const yearMatch = yearName.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
      if (yearMatch) {
        startYr = yearMatch[1];
        endYr = yearMatch[2];
      }

      const headerTitle = `FEE STRUCTURE FOR ${startYr} - ${endYr}`;
      const headerSubtitle = `(Applicable from 1st April to 31st March ${endYr})`;

      // Fetch all classes & configurations dynamically
      const [allClasses, allConfigs] = await Promise.all([
        schoolService.getClasses(),
        activeYear ? schoolService.getClassFeeConfigurations({ academic_year_id: activeYear.id }) : Promise.resolve([])
      ]);

      const classList = allClasses || classes || [];
      const configList = allConfigs || [];

      // Group classes by unique class name to get one row per class
      const classMap = new Map();
      classList.forEach(c => {
        if (!c.name) return;
        if (!classMap.has(c.name)) {
          classMap.set(c.name, c);
        }
      });

      // Sort classes in logical order (Playgroup, Nursery, LKG, UKG, Class 1... Class 12)
      const sortedClasses = Array.from(classMap.values()).sort((a, b) => {
        const idxA = getClassIndex(a.name);
        const idxB = getClassIndex(b.name);
        if (idxA !== idxB) return idxA - idxB;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      // Calculate annual fee for each class
      const rowsData = sortedClasses.map((cls, index) => {
        const cfg = configList.find(c => {
          if (String(c.class_id) === String(cls.id)) return true;
          const foundCls = classList.find(l => String(l.id) === String(c.class_id));
          return foundCls && foundCls.name === cls.name;
        });

        let annualFee = 0;
        if (cfg) {
          if (cfg.mode === 'SAME') {
            const monthlyVal = parseFloat(cfg.monthly_fees?.April || cfg.same_amount || 0);
            annualFee = Math.round(monthlyVal * 12);
          } else if (cfg.monthly_fees) {
            const sum = Object.values(cfg.monthly_fees).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            annualFee = Math.round(sum);
          }
        }

        return {
          sNo: index + 1,
          className: cls.name,
          amountFormatted: `₹${annualFee.toLocaleString('en-IN')}`
        };
      });

      const totalRows = rowsData.length;

      // Dynamic sizing calculation to guarantee ONE SINGLE PAGE layout
      let fontSize = '13px';
      let padding = '10px 16px';
      let titleSize = '20px';
      let subtitleSize = '12px';

      if (totalRows > 20) {
        fontSize = '8.5px';
        padding = '4px 8px';
        titleSize = '15px';
        subtitleSize = '9.5px';
      } else if (totalRows > 15) {
        fontSize = '10px';
        padding = '6px 10px';
        titleSize = '17px';
        subtitleSize = '10.5px';
      } else if (totalRows > 10) {
        fontSize = '11.5px';
        padding = '8px 12px';
        titleSize = '18.5px';
        subtitleSize = '11.5px';
      }

      const pdfHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; width: 100%; box-sizing: border-box; padding: 24px 28px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: ${titleSize}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #0F172A; margin: 0 0 6px 0; font-family: inherit;">
              ${headerTitle}
            </h1>
            <p style="font-size: ${subtitleSize}; font-weight: 600; color: #475569; margin: 0; font-family: inherit;">
              ${headerSubtitle}
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 0 auto; background: #ffffff; border: 1px solid #CBD5E1; box-sizing: border-box;">
            <thead>
              <tr style="background-color: #0F172A; color: #FFFFFF;">
                <th style="width: 15%; padding: ${padding}; font-size: ${fontSize}; font-weight: 700; text-align: center; border: 1px solid #1E293B; text-transform: uppercase; letter-spacing: 0.5px;">S. No.</th>
                <th style="width: 55%; padding: ${padding}; font-size: ${fontSize}; font-weight: 700; text-align: left; border: 1px solid #1E293B; text-transform: uppercase; letter-spacing: 0.5px;">Class</th>
                <th style="width: 30%; padding: ${padding}; font-size: ${fontSize}; font-weight: 700; text-align: right; border: 1px solid #1E293B; text-transform: uppercase; letter-spacing: 0.5px;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsData.map((r, idx) => `
                <tr style="background-color: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
                  <td style="padding: ${padding}; font-size: ${fontSize}; font-weight: 600; text-align: center; color: #334155; border: 1px solid #E2E8F0;">${r.sNo}</td>
                  <td style="padding: ${padding}; font-size: ${fontSize}; font-weight: 700; text-align: left; color: #0F172A; border: 1px solid #E2E8F0;">${r.className}</td>
                  <td style="padding: ${padding}; font-size: ${fontSize}; font-weight: 700; text-align: right; color: #0F172A; border: 1px solid #E2E8F0; font-family: inherit;">${r.amountFormatted}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.top = '0';
      tempContainer.style.left = '0';
      tempContainer.style.width = '794px';
      tempContainer.style.zIndex = '99999';
      tempContainer.style.background = '#ffffff';
      tempContainer.innerHTML = pdfHtml;
      document.body.appendChild(tempContainer);

      const filename = `Fee_Structure_${startYr}-${endYr}.pdf`;

      const opt = {
        margin: [10, 12, 10, 12],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: [] }
      };

      await html2pdf().from(tempContainer).set(opt).save();

      if (document.body.contains(tempContainer)) {
        document.body.removeChild(tempContainer);
      }
    } catch (err) {
      console.error('Error generating Fee Structure PDF:', err);
      setFeeError('Failed to generate Fee Structure PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleConfirmSaveConfig = () => {
    setFeeError('');
    setFeeSuccess('');

    // Validation
    if (!selectedClassId) {
      setFeeError('Please select a class.');
      return;
    }

    const activeYear = currentYear || academicYears.find(y => y.is_current);
    if (!activeYear) {
      setFeeError('Academic year not found. Please create an Academic Year first.');
      return;
    }

    if (feeMode === 'SAME') {
      if (!sameFeeAmount || parseFloat(sameFeeAmount) <= 0) {
        setFeeError('Monthly fee must be greater than ₹0.');
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
          setFeeError('Monthly fee must be greater than ₹0.');
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

    const activeYear = currentYear || academicYears.find(y => y.is_current);
    if (!activeYear) return;

    const feesMap = {};
    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
    
    academicMonths.forEach(m => {
      feesMap[m] = parseFloat(sameFeeAmount);
    });

    try {
      const selectedGroup = uniqueClassGroups.find(g => g.allIds.includes(String(selectedClassId)));
      const idsToSave = selectedGroup ? selectedGroup.allIds : [String(selectedClassId)];

      await Promise.all(
        idsToSave.map(cid =>
          schoolService.saveClassFeeConfiguration({
            class_id: parseInt(cid, 10),
            academic_year_id: activeYear.id,
            mode: feeMode,
            monthly_fees: feesMap
          })
        )
      );

      setFeeSuccess('Fee configuration saved successfully.');
      setTimeout(() => setFeeSuccess(''), 5000);
      setIsConfigLocked(false);
      fetchConfiguredClasses();
      setSelectedClassId('');
    } catch (err) {
      console.error(err);
      setFeeError(err.message || 'Failed to save fee configuration.');
    }
  };

  // Open modal to create a Draft Academic Year
  const openCreateModal = () => {
    if (academicYears.some(y => y.status === 'Draft')) {
      setError('A Draft academic year already exists. Promote or delete it first.');
      return;
    }
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

  // Helper to determine next class name dynamically
  const getNextClassLabel = (className) => {
    const name = className || '';
    if (name.toLowerCase().includes('nursery')) return 'LKG';
    if (name.toLowerCase().includes('lkg')) return 'UKG';
    if (name.toLowerCase().includes('ukg')) return 'Class 1';

    const match = name.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      return name.replace(match[0], String(num + 1));
    }
    return 'Next Class';
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
      
      // Calculate highest configured class numeric level
      let highestNum = 0;
      classList.forEach(c => {
        const match = (c.name || '').match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > highestNum) highestNum = num;
        }
      });

      studentList
        .filter(s => s.status === 'ACTIVE')
        .forEach(s => {
          const sClass = classList.find(c => c.id === s.class_id);
          const matchC = sClass ? (sClass.name || '').match(/\d+/) : null;
          const cNum = matchC ? parseInt(matchC[0], 10) : 0;
          const isHighest = cNum === highestNum && highestNum > 0;
          
          studentMap[s.id] = isHighest ? 'graduate_alumni' : 'promote';
        });
      setStudentActions(studentMap);

      setIsWizardOpen(true);
    } catch (err) {
      console.error(err);
      setError('Failed to load school data for the activation wizard.');
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

      const activeYear = academicYears.find(y => y.status === 'ACTIVE' || y.is_current);
      const activeYearId = activeYear ? activeYear.id : targetYear.id;

      const res = await schoolService.migrateAcademicYear(activeYearId, payload);

      setSuccess(`Academic Year ${targetYear.name} migration executed successfully.`);
      setIsWizardOpen(false);
      setShowConfirmExecute(false);
      localStorage.setItem('shiksha_pilot_academic_year_id', String(res.id || targetYear.id));
      loadData();
      
      // Redirect to Dashboard and load fresh academic year context
      setTimeout(() => {
        window.location.replace('/school-admin');
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Migration failed. Please check validation rules.');
    } finally {
      setExecuting(false);
    }
  };

  const handleMigrateClick = async (year) => {
    const draftYear = academicYears.find(y => y.status === 'Draft');
    if (!draftYear) {
      setShowNoDraftModal(true);
      return;
    }
    try {
      const res = await schoolService.checkLatePaymentPenaltyConfig();
      if (res && res.configured) {
        startActivation(draftYear);
      } else {
        setPendingDraftYear(draftYear);
        setShowLppAlert(true);
      }
    } catch (err) {
      console.error(err);
      startActivation(draftYear);
    }
  };

  const handleAutoCreateDraft = async () => {
    setCreatingDraft(true);
    setError('');
    
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
      const currentYearVal = new Date().getFullYear();
      nextSessionName = `${currentYearVal}–${currentYearVal + 1}`;
      nextStartDate = `${currentYearVal}-04-01`;
      nextEndDate = `${currentYearVal + 1}-03-31`;
    }

    try {
      await schoolService.createAcademicYear({
        name: nextSessionName,
        start_date: nextStartDate,
        end_date: nextEndDate
      });
      setSuccess(`Draft Academic Year ${nextSessionName} created successfully.`);
      setShowNoDraftModal(false);
      if (refreshYears) {
        await refreshYears();
      }
      loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create Draft Academic Year.');
    } finally {
      setCreatingDraft(false);
    }
  };

  const handleActivateDirectClick = (year) => {
    setActivateTargetYear(year);
    // Check if the previous Active Academic Year has completed migration
    const activeYear = academicYears.find(y => y.status === 'ACTIVE' || y.is_current);
    if (activeYear && (activeYear.migration_status || 'Not Started') !== 'Completed') {
      setShowMigrationAlertModal(true);
      return;
    }

    setShowActivateConfirm(true);
  };

  const handleActivateConfirm = async () => {
    if (!activateTargetYear) return;
    try {
      await schoolService.activateAcademicYear(activateTargetYear.id, {});
      setSuccess(`Academic Year ${activateTargetYear.name} is now ACTIVE.`);
      setShowActivateConfirm(false);
      localStorage.setItem('shiksha_pilot_academic_year_id', String(activateTargetYear.id));
      loadData();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Activation failed.');
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
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Audits & Settings</h2>
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
          {!isReadOnly && !academicYears.some(y => y.status === 'Draft') && (
            <Button onClick={openCreateModal} className="h-8 text-xs font-bold bg-primary text-white">
              Create Academic Year
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-text-secondary text-xs">
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading Academic Years...
                    </span>
                  </TableCell>
                </TableRow>
              ) : academicYears.length === 0 ? (
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-green-500/10 text-green-600 border border-green-500/20">
                          Active
                        </span>
                      ) : year.status === 'Draft' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-border">
                          Archived
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isReadOnly && !!(year.status === 'ACTIVE' || year.is_current) && (
                        <Button 
                          onClick={() => handleMigrateClick(year)}
                          className="h-7 px-3 text-[11px] font-bold bg-primary hover:bg-primary/95 text-white"
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
      <Card id="class-fee-config-panel" className="shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-text-primary">Class Fee Configuration</CardTitle>
          <Button
            onClick={handleDownloadFeeStructurePdf}
            disabled={downloadingPdf}
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 font-bold border-border shadow-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {downloadingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Download className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Download Fee Structure</span>
          </Button>
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

          {!selectedClassId && showSelectClassNotice && (
            <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2.5 text-xs text-primary font-bold animate-in fade-in duration-300">
              <ShieldAlert className="h-4 w-4 text-primary flex-shrink-0" />
              <span>Please select a class to configure its fee structure.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
            <div className="w-full sm:w-[240px]">
              <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Class *</label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                disabled={classes.length === 0}
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">Select Class</option>
                {uniqueClassGroups.map(group => (
                  <option key={group.name} value={group.primaryId}>
                    {group.name}
                    {group.isConfigured ? ' (Configured)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-2 space-y-2 w-full sm:w-[240px]">
            <label className="text-xs font-bold text-text-secondary uppercase block">Fee Amount</label>
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
            <p className="text-[11px] text-text-muted">This amount will be applied to all 12 academic months automatically.</p>
          </div>

          {selectedClassId && (isConfigLocked || isReadOnly) ? (
            <div className="mt-6 p-4 bg-zinc-100 border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-zinc-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-primary font-display">Fee Configuration Locked</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{isReadOnly ? 'Fee configuration cannot be modified in an archived academic year.' : 'This configuration is permanently locked for the active year.'}</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-zinc-200 text-zinc-600 border border-zinc-300">
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
        </CardContent>
      </Card>

      {/* Period Time Configuration Panel */}
      <Card className="shadow-sm">
        <CardHeader className="py-5 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-lg font-bold text-text-primary tracking-tight">School Settings & Timetable Configuration</CardTitle>
          <p className="text-xs text-text-secondary mt-1">Define structural settings for classroom schedulers and faculty workload computation.</p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {periodError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
              {periodError}
            </div>
          )}

          {periodSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold">
              {periodSuccess}
            </div>
          )}

          {/* Configuration Inputs */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">School Start Time</label>
                <input
                  type="time"
                  value={schoolStartTime}
                  disabled={isReadOnly || periodLoading}
                  onChange={e => setSchoolStartTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
                <p className="text-[11px] text-text-muted mt-1">Selected: {formatTime12h(schoolStartTime + ':00')}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Period Duration (Minutes)</label>
                <Input
                  type="number"
                  min="1"
                  value={periodDuration}
                  disabled={isReadOnly || periodLoading}
                  onChange={e => setPeriodDuration(e.target.value)}
                  className="font-semibold text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Interval Duration (Minutes)</label>
                <Input
                  type="number"
                  min="0"
                  value={intervalDuration}
                  disabled={isReadOnly || periodLoading}
                  onChange={e => setIntervalDuration(e.target.value)}
                  className="font-semibold text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Interval After Period</label>
                <Input
                  type="number"
                  min="1"
                  max={totalPeriods}
                  value={intervalAfterPeriod}
                  disabled={isReadOnly || periodLoading}
                  onChange={e => setIntervalAfterPeriod(e.target.value)}
                  className="font-semibold text-xs h-10"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-6 pt-2">
              <div className="space-y-1.5 w-full sm:w-64">
                <label className="text-xs font-bold text-text-secondary uppercase">Total Periods Per Day</label>
                <Input
                  type="number"
                  min="1"
                  value={totalPeriods}
                  disabled={isReadOnly || periodLoading}
                  onChange={e => setTotalPeriods(e.target.value)}
                  className="font-semibold text-xs h-10"
                />
              </div>

              <Button
                onClick={handleSavePeriods}
                disabled={isReadOnly || periodLoading || !isChanged}
                className="font-bold h-10 px-6 bg-primary hover:bg-primary/95 text-white rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                {periodLoading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>

          {/* Generated Timetable Preview */}
          {showPreview && periods.length > 0 && (
            <div className="border border-border/80 p-5 rounded-2xl bg-zinc-950/5 dark:bg-black/5 space-y-4 pt-4 mt-6">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Generated Timetable Preview</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {periods.map((p) => {
                  const isAfterPeriod = p.period_number === parseInt(intervalAfterPeriod);
                  return (
                    <React.Fragment key={p.period_number}>
                      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900/30 border border-border/60 rounded-xl">
                        <span className="text-xs font-bold text-text-secondary">Period {p.period_number}</span>
                        <span className="text-xs font-bold text-text-primary font-mono ml-4 whitespace-nowrap">
                          {formatTime12h(p.start_time)} – {formatTime12h(p.end_time)}
                        </span>
                      </div>

                      {isAfterPeriod && parseInt(intervalDuration) > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Interval Break</span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono ml-4 whitespace-nowrap">
                            {getBreakTimingStr()}
                          </span>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Save Confirmation Modal */}
      {showLockConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-bold text-text-primary text-base tracking-tight text-center font-display">
              Confirm Save
            </h3>
            <p className="text-xs text-text-secondary text-center leading-relaxed">
              Are you sure you want to save the class fee configuration? <br />
              This will update future unpaid billing cycles.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setShowLockConfirm(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveAndLockConfig} 
                className="font-bold bg-primary hover:bg-primary/95 text-white"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign User Role Panel */}
      <Card className="shadow-sm">
        <CardHeader className="py-5 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-lg font-bold text-text-primary tracking-tight">Assign User Role</CardTitle>
          <p className="text-xs text-text-secondary mt-1">Configure teacher menu permissions and assign class teachers.</p>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          
          {/* Section 1: Teacher Menu Permissions */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-primary border-b border-border pb-2">Teacher Menu Permissions</h3>
            
            {permSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {permSuccess}
              </div>
            )}
            {permError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
                {permError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5 md:col-span-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-secondary uppercase">Select Teacher</label>
                  {savingPermissions && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                </div>
                <select
                  value={selectedPermTeacherId}
                  disabled={savingPermissions}
                  onChange={e => handleTeacherSelectForPermissions(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer text-text-primary"
                >
                  <option value="">-- Choose Teacher --</option>
                  {teachersWithPerms.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.department ? ` (${t.department})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted">Choose an active teacher to assign their School Admin Portal permissions.</p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Menus Access</label>
                {selectedPermTeacherId ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border border-border rounded-xl p-4 bg-zinc-50/35 dark:bg-zinc-900/35">
                    {MENU_OPTIONS.map(menu => {
                      const isChecked = selectedPermMenus.includes(menu);
                      return (
                        <button
                          key={menu}
                          type="button"
                          disabled={savingPermissions}
                          onClick={() => handleMenuCheckboxChange(menu)}
                          className={`flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-bold tracking-tight transition-all duration-150 ${
                            savingPermissions ? 'opacity-70 cursor-not-allowed' : ''
                          } ${
                            isChecked
                              ? 'bg-primary/5 border-primary text-primary font-bold shadow-3xs'
                              : 'bg-surface border-border text-text-secondary hover:border-text-secondary/35'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded-md border flex items-center justify-center transition-all ${
                            isChecked ? 'bg-primary border-primary text-surface' : 'border-zinc-300 bg-surface'
                          }`}>
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                          <span className="truncate">{menu}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border rounded-xl text-text-muted text-xs font-semibold bg-zinc-50/20">
                    Please select a teacher to configure menu permissions.
                  </div>
                )}
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Section 2: Class Teacher Assignment */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-primary border-b border-border pb-2">Class Teacher Assignment</h3>

            {assignSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {assignSuccess}
              </div>
            )}
            {assignError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
                {assignError}
              </div>
            )}

            <div className="border border-border rounded-xl overflow-hidden shadow-3xs bg-surface w-full">
              <Table>
                <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
                  <TableRow>
                    <TableHead className="w-1/2">Class</TableHead>
                    <TableHead className="w-1/2">Assigned Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classesWithTeachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-6 text-text-muted text-xs font-semibold">
                        No classes found in active academic year.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classesWithTeachers.map(c => {
                      const classLabel = c.name + (c.section ? `-${c.section}` : '');
                      const val = localAssignments[c.id] || '';
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-bold text-text-primary text-xs tracking-tight">
                            {classLabel}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <select
                                value={val}
                                disabled={isReadOnly || savingClassId === c.id}
                                onChange={e => handleClassTeacherChange(c.id, e.target.value)}
                                className="w-full max-w-md h-9 px-2 rounded-lg border border-border bg-surface text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-text-primary"
                              >
                                <option value="">-- Unassigned --</option>
                                {teachersWithPerms.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}{t.department ? ` (${t.department})` : ''}
                                  </option>
                                ))}
                              </select>
                              {savingClassId === c.id && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Replace Class Teacher Confirmation Dialog */}
      <Dialog
        isOpen={showReplaceConfirm}
        onClose={() => setShowReplaceConfirm(false)}
        title="Replace Existing Class Teacher?"
        description="Verify changes before replacing the current class teacher."
      >
        <div className="space-y-4 pt-3 text-sm">
          <p className="text-text-secondary leading-relaxed text-xs font-medium">
            Selecting this teacher will replace the currently assigned teacher for this class.
          </p>
          
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border space-y-3">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-text-secondary">Previous Teacher:</span>
              <span className="text-red-500 font-bold">{replacePrevTeacherName}</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-text-secondary">New Teacher:</span>
              <span className="text-primary font-bold">{replaceNewTeacherName}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button variant="secondary" onClick={() => setShowReplaceConfirm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmReplacement}
              className="font-bold bg-primary hover:bg-primary/95 text-white"
            >
              Replace
            </Button>
          </div>
        </div>
      </Dialog>

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
            <label htmlFor="academic-year" className="text-xs font-bold text-text-secondary uppercase">Academic Year</label>
            <Input id="academic-year" 
              placeholder="e.g. 2027–2028" 
              value={createYearName} 
              onChange={e => setCreateYearName(e.target.value)} 
              className="font-semibold text-sm"
            />
            <p className="text-[11px] text-text-muted">Enter the academic year name.</p>
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
        description={`Migrate teachers, classes, and promote students into the ${targetYear?.name || ''} academic session.`}
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
          {wizardStep === 1 && (() => {
            const inactiveTeachers = staff.filter(s => (s.role === 'TEACHER' || s.role === 'Teacher') && s.status !== 'ACTIVE');
            return (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider">Active Teachers Migration</h4>
                    <span className="text-[11px] text-text-muted font-bold mt-0.5 block">{Object.values(selectedTeachers).filter(Boolean).length} Selected</span>
                  </div>
                  {inactiveTeachers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowInactiveTeachers(true)}
                      className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-text-muted border border-border rounded-full transition-colors shadow-3xs"
                    >
                      Inactive Teachers ({inactiveTeachers.length})
                    </button>
                  )}
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
                              <p className="text-[11px] text-text-muted font-medium mt-0.5">{subjectDisplay}</p>
                            </div>
                          </label>
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-green-500/10 text-green-600 border border-green-500/20">Active</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* STEP 2: Student Promotion */}
          {wizardStep === 2 && (() => {
            const inactiveStudents = students.filter(s => s.status !== 'ACTIVE');
            
            let highestNum = 0;
            classes.forEach(cls => {
              const match = (cls.name || '').match(/\d+/);
              if (match) {
                const num = parseInt(match[0], 10);
                if (num > highestNum) highestNum = num;
              }
            });

            return (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider">Class-wise Student Promotions</h4>
                  {inactiveStudents.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowInactiveStudents(true)}
                      className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-text-muted border border-border rounded-full transition-colors shadow-3xs"
                    >
                      Inactive Students ({inactiveStudents.length})
                    </button>
                  )}
                </div>
                
                <div className="max-h-[280px] overflow-y-auto border border-border rounded-xl p-3 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/20">
                  {classes.length === 0 ? (
                    <p className="text-center py-6 text-xs text-text-muted">No classes defined to promote students.</p>
                  ) : (
                    [...classes].sort((a, b) => {
                      const idxA = getClassIndex(a.name);
                      const idxB = getClassIndex(b.name);
                      if (idxA !== idxB) {
                        if (idxA === -1) return 1;
                        if (idxB === -1) return -1;
                        return idxA - idxB;
                      }
                      return (a.section || '').localeCompare(b.section || '', undefined, { numeric: true, sensitivity: 'base' });
                    }).map(c => {
                      const classStudents = students.filter(s => s.class_id === c.id && s.status === 'ACTIVE');
                      if (classStudents.length === 0) return null;

                      const matchC = (c.name || '').match(/\d+/);
                      const cNum = matchC ? parseInt(matchC[0], 10) : 0;
                      const isHighest = cNum === highestNum && highestNum > 0;

                      return (
                        <div key={c.id} className="space-y-2 border-b border-border/40 pb-3 last:border-b-0">
                          <div className="flex items-center justify-between border-b border-border pb-1">
                            <span className="font-bold text-text-primary text-xs">{c.name} {c.section ? ` - ${c.section}` : ''}</span>
                            <span className="text-[11px] text-text-muted font-semibold">{classStudents.length} Students</span>
                          </div>
                          
                          <div className="space-y-2 pl-2">
                            {classStudents.map(student => {
                              const act = studentActions[student.id] || (isHighest ? 'graduate_alumni' : 'promote');
                              const nextClassLabel = getNextClassLabel(c.name);
                              const promoActionVal = isHighest ? 'graduate_alumni' : 'promote';
                              const promoteText = isHighest ? `Graduate` : `Promote ${nextClassLabel}`;

                              return (
                                <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs py-2 border-b border-border/20 last:border-b-0">
                                  <span className="font-semibold text-text-secondary">{student.name}</span>
                                  
                                  <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-1.5 font-bold uppercase text-[11px] tracking-wide cursor-pointer select-none">
                                      <input
                                        type="radio"
                                        name={`student-action-${student.id}`}
                                        value={promoActionVal}
                                        checked={act === promoActionVal}
                                        onChange={() => setStudentActions(p => ({ ...p, [student.id]: promoActionVal }))}
                                        className="rounded-full border-zinc-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                      />
                                      {promoteText}
                                    </label>
                                    <label className="flex items-center gap-1.5 font-bold uppercase text-[11px] tracking-wide cursor-pointer select-none">
                                      <input
                                        type="radio"
                                        name={`student-action-${student.id}`}
                                        value="repeat"
                                        checked={act === 'repeat'}
                                        onChange={() => setStudentActions(p => ({ ...p, [student.id]: 'repeat' }))}
                                        className="rounded-full border-zinc-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                      />
                                      Repeat
                                    </label>
                                  </div>
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
            );
          })()}

          {/* STEP 3: Review */}
          {wizardStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h4 className="text-xs font-bold uppercase text-text-secondary tracking-wider">Final Migration Review</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-text-secondary">
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Target Session</p>
                  <p className="text-lg font-bold text-primary mt-1 font-display">{targetYear?.name}</p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Migrated Teachers</p>
                  <p className="text-lg font-bold text-text-primary mt-1 font-display">
                    {reviewCounts.activeTeachers}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Inactive Teachers Skipped</p>
                  <p className="text-lg font-bold text-red-500 mt-1 font-display font-display">
                    {staff.filter(s => (s.role === 'TEACHER' || s.role === 'Teacher') && s.status !== 'ACTIVE').length}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Students Promoted</p>
                  <p className="text-lg font-bold text-teal-600 mt-1 font-display">
                    {reviewCounts.promoted}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Students Repeating</p>
                  <p className="text-lg font-bold text-amber-600 mt-1 font-display">
                    {reviewCounts.repeating}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Inactive Students Skipped</p>
                  <p className="text-lg font-bold text-red-500 mt-1 font-display font-display">
                    {students.filter(s => s.status !== 'ACTIVE').length}
                  </p>
                </Card>
                <Card className="p-4 shadow-2xs col-span-2">
                  <p className="text-text-muted uppercase text-[11px] font-bold tracking-wider">Graduated / Alumni</p>
                  <p className="text-lg font-bold text-indigo-600 mt-1 font-display">{reviewCounts.graduated}</p>
                </Card>
              </div>

              <div className="p-3 bg-zinc-50 border border-border rounded-xl text-[11px] text-text-muted flex items-start gap-2">
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

      {/* Inactive Teachers Modal */}
      {showInactiveTeachers && (
        <Dialog
          isOpen={showInactiveTeachers}
          onClose={() => setShowInactiveTeachers(false)}
          title="Inactive Teachers List"
          description="Registered staff members whose accounts are currently inactive."
        >
          <div className="space-y-4 pt-4 flex flex-col max-h-[70vh]">
            <div className="overflow-y-auto border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 max-h-[45vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff
                    .filter(s => (s.role === 'TEACHER' || s.role === 'Teacher') && s.status !== 'ACTIVE')
                    .map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-bold text-text-primary text-xs">{t.name}</TableCell>
                        <TableCell className="font-mono text-xs text-text-secondary">{t.employee_id || '—'}</TableCell>
                        <TableCell className="text-xs text-text-muted">{t.department || '—'}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-red-500/10 text-red-600 border border-red-500/20">
                            {t.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={() => setShowInactiveTeachers(false)} className="font-bold">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Inactive Students Modal */}
      {showInactiveStudents && (
        <Dialog
          isOpen={showInactiveStudents}
          onClose={() => setShowInactiveStudents(false)}
          title="Inactive Students List"
          description="Registered students whose enrollments are currently inactive."
        >
          <div className="space-y-4 pt-4 flex flex-col max-h-[70vh]">
            <div className="overflow-y-auto border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 max-h-[45vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>SR Number</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Current Class</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students
                    .filter(s => s.status !== 'ACTIVE')
                    .map(s => {
                      const sClass = classes.find(c => c.id === s.class_id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-bold text-text-primary text-xs">{s.name}</TableCell>
                          <TableCell className="font-mono text-xs text-text-secondary">{s.sr_no || '—'}</TableCell>
                          <TableCell className="text-xs text-text-muted">{s.roll_no || '—'}</TableCell>
                          <TableCell className="text-xs text-text-secondary">
                            {sClass ? `${sClass.name}${sClass.section ? ` - ${sClass.section}` : ''}` : '—'}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-red-500/10 text-red-600 border border-red-500/20">
                              {s.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={() => setShowInactiveStudents(false)} className="font-bold">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Confirmation Dialog overlay */}
      {showConfirmExecute && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-bold text-text-primary text-base tracking-tight text-center font-display">
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



      {/* Dialog: Confirm Save Period Configuration */}
      <Dialog
        isOpen={showConfirmConfig}
        onClose={() => setShowConfirmConfig(false)}
        title="Update Timetable Configuration?"
        description="Changing the total number of periods will reset the existing timetable for all classes. You will need to assign the timetable again after saving this configuration."
        footer={<>
          <Button variant="secondary" onClick={() => setShowConfirmConfig(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => executeSavePeriods(true)} 
            className="font-bold bg-primary hover:bg-primary/95 text-white"
          >
            Update Configuration
          </Button>
        </>}
      >
        <div className="pt-2 text-xs text-text-muted">
          Please confirm if you want to proceed with this modification.
        </div>
      </Dialog>

      {/* Activate Confirm Modal */}
      {showActivateConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-bold text-text-primary text-base tracking-tight text-center font-display">
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



      {/* Migration Alert Dialog Modal */}
      <Dialog
        isOpen={showMigrationAlertModal}
        onClose={() => setShowMigrationAlertModal(false)}
        title="Academic Year Cannot Be Activated"
      >
        <div className="space-y-4 pt-4 text-center">
          <p className="text-sm text-text-secondary leading-relaxed">
            The current Academic Year's records have not yet been migrated to the <strong>{activateTargetYear?.name} Academic Year</strong>.
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Please complete the Academic Year Migration process before activating <strong>{activateTargetYear?.name} Academic Year</strong>.
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Migration ensures that teachers, students, class promotions, and all required academic records are carried forward correctly.
          </p>
          <div className="flex justify-center pt-2">
            <Button 
              onClick={() => setShowMigrationAlertModal(false)} 
              className="px-6 font-bold bg-primary hover:bg-primary/90"
            >
              Okay
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Draft Academic Year Required Dialog Modal */}
      <Dialog
        isOpen={showNoDraftModal}
        onClose={() => setShowNoDraftModal(false)}
        title="Draft Academic Year Required"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNoDraftModal(false)}>Cancel</Button>
            <Button 
              className="bg-primary hover:bg-primary/95 text-white font-bold" 
              onClick={handleAutoCreateDraft}
              disabled={creatingDraft}
            >
              {creatingDraft ? 'Creating...' : 'Create Draft Academic Year'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-text-secondary leading-relaxed">
            No Draft Academic Year exists for the upcoming session.
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            A Draft Academic Year is required before migration can begin.
          </p>
          <p className="text-sm font-semibold text-text-primary pt-2 leading-relaxed">
            Would you like to create it now?
          </p>
        </div>
      </Dialog>

      {/* Late Payment Penalty Not Configured Alert Dialog */}
      {showLppAlert && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col p-6 space-y-4 relative">
            
            {/* Close Icon Button */}
            <button 
              onClick={() => {
                setShowLppAlert(false);
                setPendingDraftYear(null);
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary p-1.5 rounded-full hover:bg-hover transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3 pt-2">
              <div className="p-3 bg-amber-500/10 rounded-full border border-amber-500/20 text-amber-500">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-text-primary text-base tracking-tight uppercase">
                Late Payment Penalty Not Configured
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
                You have not configured a Late Payment Penalty for this Academic Year. 
                Students with outstanding dues will be migrated without any Late Payment Penalty being applied.
              </p>
              <p className="text-xs text-text-muted leading-relaxed max-w-sm">
                If you wish to charge a penalty on pending dues, configure it before proceeding with Academic Year Migration. 
                You may continue the migration without configuring a penalty if your school does not wish to charge one.
              </p>
            </div>

            <div className="flex gap-3 justify-center pt-4 border-t border-border">
              <Button 
                onClick={() => {
                  setShowLppAlert(false);
                  navigate('/school-admin/finance-management?tab=late-payment-penalty');
                }}
                className="font-bold bg-primary hover:bg-primary/95 text-white px-5 py-2 text-xs uppercase tracking-wider"
              >
                Configure Penalty
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowLppAlert(false);
                  if (pendingDraftYear) {
                    startActivation(pendingDraftYear);
                  }
                }}
                className="font-bold text-xs uppercase tracking-wider"
              >
                Continue Without Penalty
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
