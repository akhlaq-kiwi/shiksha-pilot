import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, User, X, MoreVertical, Check } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import StudentEnrollmentForm from './StudentEnrollmentForm';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';
import StudentDetailsPage from './StudentDetailsPage';
import { Dialog } from '../../../common/ui/dialog';
import CredentialsDialog from '../../../common/components/CredentialsDialog';
import ClassIdentityCardPreview from '../components/ClassIdentityCardPreview';
import { 
  PREDEFINED_CLASSES, 
  PREDEFINED_CLASS_NAMES, 
  getClassIndex,
  SECTION_TYPES,
  ALPHABET_SECTIONS,
  COLOR_SECTIONS,
  detectSectionType,
  getShortClassName
} from '../../../common/constants/predefinedClasses';

// Self-healing avatar image component to handle loading errors gracefully
const StudentAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : src;
    const cleanUrl = updatedAt ? `${fileUrl}?v=${encodeURIComponent(updatedAt)}` : fileUrl;
    return (
      <img 
        src={cleanUrl} 
        alt={name} 
        onError={() => setError(true)} 
        className="w-full h-full object-cover" 
      />
    );
  }
  
  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST';
  return (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 text-text-secondary flex items-center justify-center font-bold text-lg uppercase select-none">
      {initials}
    </div>
  );
};

const getEligibleClasses = (studentClassName, schoolClasses) => {
  const studentIdx = getClassIndex(studentClassName);
  if (studentIdx === -1) return [];
  return schoolClasses.filter(c => getClassIndex(c.name) > studentIdx);
};

export default function ClassesPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list', 'roster', 'enroll', 'edit', 'details'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { currentYear } = useAcademicYear();

  useEffect(() => {
    schoolService.getSchoolProfile().then(data => {
      setSchoolProfile(data || null);
    }).catch(console.error);
  }, []);
  
  const [showLimitReached, setShowLimitReached] = useState(null);
  const [checkingLimit, setCheckingLimit] = useState(false);

  const handleEnrollStudentClick = async () => {
    setCheckingLimit(true);
    try {
      const stats = await schoolService.getStats();
      const activeCount = stats.students_count || 0;
      const limit = stats.subscription_student_limit;

      if (limit !== null && limit !== undefined && limit > 0 && activeCount >= limit) {
        setShowLimitReached({ limit, plan: stats.subscription_plan });
      } else {
        setView('enroll');
        setSelectedStudentId(null);
      }
    } catch (err) {
      console.error(err);
      setView('enroll');
      setSelectedStudentId(null);
    } finally {
      setCheckingLimit(false);
    }
  };
  
  // Selection states
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  useEffect(() => {
    const studentIdParam = searchParams.get('studentId');
    if (studentIdParam) {
      setSelectedStudentId(parseInt(studentIdParam, 10));
      setView('details');
    }
  }, [searchParams]);

  // New Class Form State (Modal)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [classNameInput, setClassNameInput] = useState('');
  const [selectedClassNames, setSelectedClassNames] = useState([]); // Array for multi-class creation (unselected by default)
  const [sectionTypeInput, setSectionTypeInput] = useState(''); // 'Alphabet Sections' | 'Color Sections' | ''
  const [selectedSections, setSelectedSections] = useState([]); // ['A', 'B'] or ['Red', 'Blue']
  const [savingClass, setSavingClass] = useState(false);
  
  // Field-level error states
  const [classFormError, setClassFormError] = useState('');
  const [sectionTypeError, setSectionTypeError] = useState('');
  const [sectionsFieldError, setSectionsFieldError] = useState('');

  // Confirmation dialog state for Section Type Change
  const [showSectionTypeConfirm, setShowSectionTypeConfirm] = useState(false);
  const [pendingSectionType, setPendingSectionType] = useState('');
  const [editingStudentCount, setEditingStudentCount] = useState(0);
  
  // Class Editing & Dropdown menu states
  const [openMenuClass, setOpenMenuClass] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editOldClassName, setEditOldClassName] = useState('');

  // Roster Search and Filters
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterSectionFilter, setRosterSectionFilter] = useState('All');
  const [rosterStatusFilter, setRosterStatusFilter] = useState('All');

  // Credentials dialog state
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [credentialsTarget, setCredentialsTarget] = useState(null);

  // Advance Student states
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [advanceTargetStudent, setAdvanceTargetStudent] = useState(null);
  const [selectedAdvanceClassId, setSelectedAdvanceClassId] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  // Class Section Enhancement States
  const [originalSections, setOriginalSections] = useState([]);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [sectionCreationMessage, setSectionCreationMessage] = useState('');

  // Transfer Students States
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceSec, setTransferSourceSec] = useState('');
  const [transferDestSec, setTransferDestSec] = useState('');
  const [selectedTransferStudents, setSelectedTransferStudents] = useState([]);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [clsData, stuData] = await Promise.all([
        schoolService.getClasses(),
        schoolService.getStudents()
      ]);
      setClasses(clsData || []);
      setStudents(stuData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch class and student data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStudent = async () => {
    if (!selectedAdvanceClassId || !advanceTargetStudent) return;
    setAdvancing(true);
    setAdvanceError('');
    try {
      await schoolService.advanceStudent(advanceTargetStudent.id, selectedAdvanceClassId);
      setIsAdvanceDialogOpen(false);
      setAdvanceTargetStudent(null);
      setSelectedAdvanceClassId('');
      await loadData();
    } catch (err) {
      console.error(err);
      setAdvanceError(err.message || 'Failed to advance student.');
    } finally {
      setAdvancing(false);
    }
  };

  const { isReadOnly } = useAcademicYear();

  useEffect(() => {
    loadData();
    const handleYearSwitch = () => {
      loadData();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  const handleOpenEditClass = (gc) => {
    setIsEditing(true);
    setEditOldClassName(gc.name);
    setClassNameInput(gc.name);
    
    const sType = detectSectionType(gc.sections);
    setSectionTypeInput(sType);
    setSelectedSections(gc.sections || []);
    setOriginalSections(gc.sections || []);
    setEditingStudentCount(gc.studentCount || 0);

    setClassFormError('');
    setSectionTypeError('');
    setSectionsFieldError('');
    setShowCreateForm(true);
  };

  const handleCloseClassForm = () => {
    setShowCreateForm(false);
    setIsEditing(false);
    setEditOldClassName('');
    setClassNameInput('');
    setSelectedClassNames([]); // Reset to unselected by default
    setSectionTypeInput('');
    setSelectedSections([]);
    setOriginalSections([]);
    setEditingStudentCount(0);
    setClassFormError('');
    setSectionTypeError('');
    setSectionsFieldError('');
  };

  const handleSectionTypeChange = (newType) => {
    if (selectedSections.length > 0 && sectionTypeInput && newType !== sectionTypeInput) {
      setPendingSectionType(newType);
      setShowSectionTypeConfirm(true);
      return;
    }

    setSectionTypeInput(newType);
    setSelectedSections([]);
    setSectionTypeError('');
    setSectionsFieldError('');
  };

  const handleConfirmSectionTypeChange = () => {
    setSectionTypeInput(pendingSectionType);
    setSelectedSections([]);
    setPendingSectionType('');
    setShowSectionTypeConfirm(false);
    setSectionTypeError('');
    setSectionsFieldError('');
  };

  const handleToggleSection = (secName) => {
    setSectionsFieldError('');
    if (selectedSections.includes(secName)) {
      setSelectedSections(prev => prev.filter(s => s !== secName));
    } else {
      if (selectedSections.length >= 4) {
        setSectionsFieldError('Maximum 4 sections allowed.');
        return;
      }
      setSelectedSections(prev => [...prev, secName]);
    }
  };

  const executeSaveMultipleClasses = async (classNamesList) => {
    setSavingClass(true);
    setClassFormError('');
    try {
      for (const name of classNamesList) {
        await schoolService.createClass({
          name: name.trim(),
          sections: []
        });
      }
      handleCloseClassForm();
      await loadData();
    } catch (err) {
      console.error(err);
      setClassFormError(err.message || 'Failed to create one or more classes.');
    } finally {
      setSavingClass(false);
    }
  };

  const executeSaveClass = async (sectionsPayload, targetClassName = null) => {
    setSavingClass(true);
    const clsName = targetClassName || classNameInput;
    try {
      const isTransition = isEditing && originalSections.length === 0 && sectionsPayload.length > 0 && editingStudentCount > 0;

      if (isEditing) {
        await schoolService.updateClass({
          oldName: editOldClassName,
          name: clsName.trim(),
          sections: sectionsPayload
        });
      } else {
        await schoolService.createClass({
          name: clsName.trim(),
          sections: sectionsPayload
        });
      }

      handleCloseClassForm();
      await loadData();

      if (isTransition) {
        const firstSec = sectionsPayload[0];
        setSectionCreationMessage(
          `Sections have been created successfully. All existing students have been assigned to Section ${firstSec}. You can redistribute students anytime using Student Transfer.`
        );
      }
    } catch (err) {
      console.error(err);
      const errRes = err.data || err.response?.data;
      if (errRes?.errors?.name) {
        setClassFormError(errRes.errors.name);
      } else if (errRes?.errors?.sections) {
        setSectionsFieldError(errRes.errors.sections);
      } else if (errRes?.errors?.section_type) {
        setSectionTypeError(errRes.errors.section_type);
      } else {
        setClassFormError(err.message || 'Failed to save class.');
      }
    } finally {
      setSavingClass(false);
      setShowMergeConfirm(false);
    }
  };

  const handleCreateClass = async (e) => {
    if (e) e.preventDefault();
    let hasError = false;

    if (isEditing) {
      if (!classNameInput.trim()) {
        setClassFormError('Please select a class.');
        hasError = true;
      }
    } else {
      if (selectedClassNames.length === 0) {
        setClassFormError('Please select at least one class.');
        hasError = true;
      }
    }

    setSectionTypeError('');
    setSectionsFieldError('');

    if (isEditing || selectedClassNames.length === 1) {
      if (selectedSections.length > 4) {
        setSectionsFieldError('Maximum 4 sections allowed.');
        hasError = true;
      }
    }

    if (hasError) return;

    if (isEditing) {
      if (originalSections.length > 0 && selectedSections.length === 0) {
        setShowMergeConfirm(true);
        return;
      }
      await executeSaveClass(selectedSections);
    } else {
      if (selectedClassNames.length === 1) {
        await executeSaveClass(selectedSections, selectedClassNames[0]);
      } else {
        await executeSaveMultipleClasses(selectedClassNames);
      }
    }
  };

  // Delete Class & Warning Modal States
  const [deleteClassTarget, setDeleteClassTarget] = useState(null); // { name, studentCount }
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [deleteClassError, setDeleteClassError] = useState('');
  const [deleteWarningMessage, setDeleteWarningMessage] = useState('');

  const handleDeleteClassClick = (gc) => {
    if (gc.studentCount > 0) {
      setDeleteWarningMessage(
        'This action can not be done because students are currently enrolled in this class.\n\nPlease transfer or remove all students before deleting this class.'
      );
      return;
    }
    setDeleteClassTarget(gc);
    setDeleteClassError('');
  };

  const handleConfirmDeleteClass = async () => {
    if (!deleteClassTarget) return;
    setIsDeletingClass(true);
    setDeleteClassError('');
    try {
      await schoolService.deleteClass(deleteClassTarget.name);
      setDeleteClassTarget(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setDeleteClassError(err?.response?.data?.message || err?.message || 'Failed to delete class.');
    } finally {
      setIsDeletingClass(false);
    }
  };

  // Group classes by name for the card grid view
  const getGroupedClasses = () => {
    const groups = {};
    classes.forEach(c => {
      if (!groups[c.name]) {
        const preObj = PREDEFINED_CLASSES.find(p => p.name.trim().toLowerCase() === c.name.trim().toLowerCase());
        groups[c.name] = {
          name: c.name,
          category: preObj ? preObj.category : 'Academic Class',
          sections: [],
          studentCount: 0,
          minId: c.id
        };
      }
      if (c.section) {
        groups[c.name].sections.push(c.section);
      }
      if (c.id < groups[c.name].minId) {
        groups[c.name].minId = c.id;
      }
    });

    // Populate student counts by grouping matching class names
    Object.keys(groups).forEach(name => {
      groups[name].sections.sort();
      const matchingClassIds = classes.filter(c => c.name && c.name.trim().toLowerCase() === name.trim().toLowerCase()).map(c => c.id);
      
      groups[name].studentCount = students.filter(s => {
        const matchesName = s.class_name && s.class_name.trim().toLowerCase() === name.trim().toLowerCase();
        const matchesId = s.class_id && matchingClassIds.includes(s.class_id);
        return matchesName || matchesId;
      }).length;
    });

    return Object.values(groups).sort((a, b) => {
      const idxA = getClassIndex(a.name);
      const idxB = getClassIndex(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.minId - b.minId;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Classes...</p>
        </div>
      </div>
    );
  }

  // Nested Navigation Handling
  if (view === 'enroll') {
    const rosterClassRows = classes.filter(c => c.name === selectedClassName);
    let defaultClassId = '';
    if (rosterClassRows.length > 0) {
      if (rosterSectionFilter !== 'All') {
        const match = rosterClassRows.find(c => c.section === rosterSectionFilter);
        if (match) defaultClassId = match.id;
      } else {
        defaultClassId = rosterClassRows[0].id;
      }
    }

    return (
      <StudentEnrollmentForm 
        currentClassName={selectedClassName}
        currentClassId={defaultClassId}
        onCancel={() => setView('roster')} 
        onSuccess={async () => {
          setView('roster');
          await loadData();
        }} 
      />
    );
  }

  if (view === 'edit') {
    const rosterClassRows = classes.filter(c => c.name === selectedClassName);
    let defaultClassId = '';
    if (rosterClassRows.length > 0) {
      if (rosterSectionFilter !== 'All') {
        const match = rosterClassRows.find(c => c.section === rosterSectionFilter);
        if (match) defaultClassId = match.id;
      } else {
        defaultClassId = rosterClassRows[0].id;
      }
    }

    return (
      <StudentEnrollmentForm 
        studentId={selectedStudentId} 
        currentClassName={selectedClassName}
        currentClassId={defaultClassId}
        onCancel={() => setView('roster')} 
        onSuccess={async () => {
          setView('roster');
          await loadData();
        }} 
      />
    );
  }

  if (view === 'details') {
    return (
      <StudentDetailsPage 
        studentId={selectedStudentId} 
        onBack={async () => {
          if (location.state && location.state.from) {
            navigate(location.state.from);
            return;
          }
          if (searchParams.get('studentId')) {
            navigate('/school-admin/classes');
            return;
          }
          await loadData();
          setView('roster');
        }} 
        onEdit={(id) => {
          setView('edit');
          setSelectedStudentId(id);
        }} 
      />
    );
  }

  if (view === 'identity-cards') {
    const classStudents = students.filter(s => s.class_name === selectedClassName && s.status === 'ACTIVE');
    return (
      <ClassIdentityCardPreview
        className={selectedClassName}
        students={classStudents}
        schoolProfile={schoolProfile}
        currentYear={currentYear}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'roster') {
    const rosterStudents = students.filter(s => s.class_name === selectedClassName);
    
    // Resolve unique sections for the class filters dynamically
    const rosterClassRows = classes.filter(c => c.name === selectedClassName);
    const rosterSections = Array.from(new Set(rosterClassRows.filter(c => c.section).map(c => c.section))).sort();

    // Roster filters combination (Search + Section + Status)
    const filteredRoster = rosterStudents.filter(s => {
      const term = rosterSearch.trim().toLowerCase();
      const fullName = `${s.first_name || ''} ${s.middle_name || ''} ${s.last_name || ''} ${s.name || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
      const matchesSearch = !term || 
                            fullName.includes(term) ||
                            (s.first_name || '').toLowerCase().includes(term) || 
                            (s.last_name || '').toLowerCase().includes(term) || 
                            (s.name || '').toLowerCase().includes(term) || 
                            (s.roll_no || '').toLowerCase().includes(term) ||
                            (s.admission_no || s.sr_no || '').toLowerCase().includes(term);
      
      const matchesSection = rosterSectionFilter === 'All' || s.section === rosterSectionFilter;
      
      const matchesStatus = rosterStatusFilter === 'All' || 
                            (rosterStatusFilter === 'Active' && s.status === 'ACTIVE') ||
                            (rosterStatusFilter === 'Inactive' && s.status === 'Inactive');

      return matchesSearch && matchesSection && matchesStatus;
    });

    // Ascending Roll Number sorting (parsed numerically)
    const sortedRoster = [...filteredRoster].sort((a, b) => {
      const rollA = parseInt(a.roll_no || a.roll || '999999', 10);
      const rollB = parseInt(b.roll_no || b.roll || '999999', 10);
      if (rollA !== rollB) {
        return rollA - rollB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    const handleBackToClasses = () => {
      setView('list');
      setRosterSearch('');
      setRosterSectionFilter('All');
      setRosterStatusFilter('All');
    };

    return (
      <>
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Roster Header (Left Back Button minimal design, Right Class Name) */}
          <div className="flex items-center justify-between border-b border-border pb-4 gap-4 bg-surface p-4 rounded-2xl shadow-2xs">
            <div className="flex items-center gap-6">
              <button 
                onClick={handleBackToClasses} 
                className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs"
              >
                Back
              </button>
              <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display">{selectedClassName} ({rosterStudents.length})</h2>
            </div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                {rosterSections.length > 0 && (
                  <Button 
                    variant="secondary" 
                    className="flex items-center gap-2 font-bold" 
                    onClick={() => {
                      setTransferSourceSec('');
                      setTransferDestSec('');
                      setSelectedTransferStudents([]);
                      setTransferError('');
                      setIsTransferModalOpen(true);
                    }}
                  >
                    Transfer Students
                  </Button>
                )}
                 <Button 
                  className="flex items-center gap-2 font-bold" 
                  onClick={handleEnrollStudentClick} 
                  disabled={checkingLimit}
                >
                  <Plus className="h-4 w-4" /> {checkingLimit ? 'Checking Limit...' : 'Enroll Student'}
                </Button>
              </div>
            )}
          </div>

          {/* Combined Filter Toolbar */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
              <Input aria-label="Search roster by name or roll number..." 
                placeholder="Search roster by name or roll number..." 
                className="pl-9" 
                value={rosterSearch} 
                onChange={e => setRosterSearch(e.target.value)} 
              />
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto justify-end">
              {/* Section Filter (Only if sections exist for class) */}
              {rosterSections.length > 0 && (
                <div className="w-full md:w-40">
                  <select
                    value={rosterSectionFilter}
                    onChange={e => setRosterSectionFilter(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800"
                  >
                    <option value="All">All Sections</option>
                    {rosterSections.map(sec => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Student Status Filter */}
              <div className="w-full md:w-40">
                <select
                  value={rosterStatusFilter}
                  onChange={e => setRosterStatusFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Vertical centered cards grid (Finalized Student card design) */}
          {filteredRoster.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-xs shadow-xs">
              No students found in this class roster.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedRoster.map(s => (
                <div 
                  key={s.id}
                  onClick={() => { setSelectedStudentId(s.id); setView('details'); }}
                  className="relative flex flex-col items-center justify-center p-6 bg-surface border border-border rounded-2xl hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-200 text-center select-none"
                >
                  <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownItem onClick={() => { setSelectedStudentId(s.id); setView('details'); }}>
                        View Details
                      </DropdownItem>
                      <DropdownItem onClick={() => {
                        setCredentialsTarget(s);
                        setIsCredentialsOpen(true);
                      }}>
                        Credentials
                      </DropdownItem>
                      {!isReadOnly && getEligibleClasses(s.class_name, classes).length > 0 && (
                        s.status !== 'ACTIVE' ? (
                          <DropdownItem disabled className="opacity-50 cursor-not-allowed hover:bg-transparent text-text-muted flex flex-col items-start gap-0.5">
                            <span className="block text-left text-text-muted">Advance Student</span>
                            <span className="block text-[8px] text-red-500 font-bold whitespace-normal text-left">Only active students can be advanced.</span>
                          </DropdownItem>
                        ) : (
                          <DropdownItem onClick={() => {
                            setAdvanceTargetStudent(s);
                            setSelectedAdvanceClassId('');
                            setAdvanceError('');
                            setIsAdvanceDialogOpen(true);
                          }}>
                            Advance Student
                          </DropdownItem>
                        )
                      )}
                    </DropdownMenu>
                  </div>

                  {/* Photo / Avatar */}
                  <div className="w-20 h-20 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden mb-4 shadow-2xs">
                    <StudentAvatar src={s.photo_path} name={s.name} updatedAt={s.updated_at} />
                  </div>
                  
                  {/* Name */}
                  <h3 className="font-bold text-text-primary text-base hover:text-primary transition-colors leading-tight truncate w-full px-1">
                    {s.name}
                  </h3>
                  
                  {/* Roll Number */}
                  <p className="text-xs text-text-muted mt-2 font-bold uppercase tracking-wider">
                    Roll No: <span className="font-mono text-text-primary font-bold">{s.roll_no || s.roll || '-'}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdvanceDialogOpen && advanceTargetStudent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => {
            setIsAdvanceDialogOpen(false);
            setAdvanceTargetStudent(null);
            setSelectedAdvanceClassId('');
            setAdvanceError('');
          }}>
            <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-bold text-text-primary text-base tracking-tight font-display">
                  Advance Student
                </h3>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAdvanceDialogOpen(false);
                    setAdvanceTargetStudent(null);
                    setSelectedAdvanceClassId('');
                    setAdvanceError('');
                  }} 
                  className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4 text-text-secondary" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {advanceError && (
                  <div className="p-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl text-xs font-semibold">
                    {advanceError}
                  </div>
                )}

                {/* Student info box */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-xl p-4 text-xs space-y-2">
                  <p className="flex justify-between">
                    <span className="text-text-muted font-medium">Student Name:</span>
                    <strong className="text-text-primary uppercase">{advanceTargetStudent.name}</strong>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-text-muted font-medium">SR Number:</span>
                    <span className="font-bold font-mono text-text-primary">{advanceTargetStudent.sr_no || advanceTargetStudent.id}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-text-muted font-medium">Current Class:</span>
                    <span className="font-bold text-text-primary">
                      {advanceTargetStudent.class_name} {advanceTargetStudent.section ? `- ${advanceTargetStudent.section}` : ''}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-text-muted font-medium">Academic Year:</span>
                    <span className="font-bold text-text-primary">{advanceTargetStudent.academic_year_name || '2025–2026'}</span>
                  </p>
                </div>

                {/* Selection dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                    Advance To <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedAdvanceClassId}
                    onChange={(e) => setSelectedAdvanceClassId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold focus:border-primary focus:ring-primary outline-none"
                    required
                  >
                    <option value="">Select Class</option>
                    {getEligibleClasses(advanceTargetStudent.class_name, classes).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `- ${c.section}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warning box */}
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs leading-relaxed space-y-1.5">
                  <p className="font-bold">Important Notice:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>This action will move the student to the selected class immediately.</li>
                    <li>All academic records and history will be preserved.</li>
                    <li>Please verify carefully before continuing.</li>
                  </ul>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3">
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setIsAdvanceDialogOpen(false);
                    setAdvanceTargetStudent(null);
                    setSelectedAdvanceClassId('');
                    setAdvanceError('');
                  }}
                  disabled={advancing}
                >
                  Cancel
                </Button>
                <Button 
                  className="font-bold" 
                  onClick={handleAdvanceStudent} 
                  disabled={advancing || !selectedAdvanceClassId}
                >
                  {advancing ? 'Advancing...' : 'Advance Student'}
                </Button>
              </div>

            </div>
          </div>
        )}

        <CredentialsDialog
          isOpen={isCredentialsOpen}
          onClose={() => {
            setIsCredentialsOpen(false);
            setCredentialsTarget(null);
          }}
          role="PARENT"
          target={credentialsTarget}
        />

        {/* Transfer Students Modal */}
        {isTransferModalOpen && (
          <Dialog
            isOpen={isTransferModalOpen}
            title={`Transfer Students — ${selectedClassName}`}
            onClose={() => setIsTransferModalOpen(false)}
          >
            <div className="space-y-4 text-xs font-semibold text-text-secondary max-w-md">
              {transferError && (
                <div className="p-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl text-xs font-semibold">
                  {transferError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Source Section *</label>
                  <select
                    value={transferSourceSec}
                    onChange={(e) => {
                      setTransferSourceSec(e.target.value);
                      setSelectedTransferStudents([]);
                    }}
                    className="w-full rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="">Select Source...</option>
                    {(classes.filter(c => c.name === selectedClassName && c.section).map(c => c.section).sort()).map(sec => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Destination Section *</label>
                  <select
                    value={transferDestSec}
                    onChange={(e) => setTransferDestSec(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="">Select Destination...</option>
                    {(classes.filter(c => c.name === selectedClassName && c.section).map(c => c.section).sort()).filter(sec => sec !== transferSourceSec).map(sec => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {transferSourceSec && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5">
                    {(() => {
                      const srcStus = students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE');
                      const totalCount = srcStus.length;
                      const selectedCount = selectedTransferStudents.length;
                      return (
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                          Select Students
                          {totalCount > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                              {selectedCount}/{totalCount}
                            </span>
                          )}
                        </span>
                      );
                    })()}
                    {students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE').length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedTransferStudents.length === students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE').length}
                          onChange={() => {
                            const srcStus = students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE');
                            if (selectedTransferStudents.length === srcStus.length) {
                              setSelectedTransferStudents([]);
                            } else {
                              setSelectedTransferStudents(srcStus.map(s => s.id));
                            }
                          }}
                          className="rounded border-zinc-300 text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span className="text-[11px] text-text-muted">Select All</span>
                      </label>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-border rounded-xl p-2.5 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/10">
                    {students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE').length === 0 ? (
                      <p className="text-center text-text-muted py-4">No active students in Section {transferSourceSec}</p>
                    ) : (
                      students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE').map(s => {
                        const isChecked = selectedTransferStudents.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer select-none transition-all ${isChecked ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs' : 'border-transparent hover:bg-hover'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedTransferStudents(prev => prev.filter(id => id !== s.id));
                                } else {
                                  setSelectedTransferStudents(prev => [...prev, s.id]);
                                }
                              }}
                              className="rounded border-zinc-300 text-primary focus:ring-primary h-3.5 w-3.5"
                            />
                            <span>{s.name} (Roll: {s.roll_no || s.roll || '-'})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={transferSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const srcStus = students.filter(s => s.class_name === selectedClassName && s.section === transferSourceSec && s.status === 'ACTIVE');
                    if (!transferSourceSec || !transferDestSec || selectedTransferStudents.length === 0) return;
                    setTransferSubmitting(true);
                    setTransferError('');
                    try {
                      await schoolService.transferStudents({
                        class_name: selectedClassName,
                        destination_section: transferDestSec,
                        student_ids: selectedTransferStudents
                      });
                      setIsTransferModalOpen(false);
                      await loadData();
                    } catch (err) {
                      console.error(err);
                      setTransferError(err.message || 'Failed to transfer students.');
                    } finally {
                      setTransferSubmitting(false);
                    }
                  }}
                  disabled={transferSubmitting || !transferSourceSec || !transferDestSec || selectedTransferStudents.length === 0}
                >
                  {transferSubmitting ? 'Transferring...' : 'Transfer'}
                </Button>
              </div>
            </div>
          </Dialog>
        )}

        {showLimitReached && (
          <Dialog
            isOpen={!!showLimitReached}
            title="Student Limit Reached"
            onClose={() => setShowLimitReached(null)}
          >
            <div className="space-y-4 max-w-sm text-xs font-semibold text-text-secondary leading-relaxed">
              <p>
                Your current subscription plan allows a maximum of <strong>{showLimitReached.limit} students</strong>.
              </p>
              <p>You have already reached this limit.</p>
              <p className="text-text-muted font-medium">Please upgrade your subscription plan to continue enrolling new students.</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowLimitReached(null)}>Cancel</Button>
                <Button onClick={() => { setShowLimitReached(null); navigate('/school-admin/profile/subscription'); }}>View Plans</Button>
              </div>
            </div>
          </Dialog>
        )}
      </>
    );
  }

  const groupedClasses = getGroupedClasses();
  const addedClassNamesLower = classes.map(c => c.name.trim().toLowerCase());
  const availablePredefinedClasses = PREDEFINED_CLASSES.filter(p => !addedClassNamesLower.includes(p.name.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Classes</h2>
        </div>
        {!isReadOnly && (
          <Button className="flex items-center gap-2 font-bold" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4" /> Add Class
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid of Class Cards */}
      {groupedClasses.length === 0 ? (
        <Card className="p-12 text-center text-text-muted text-xs shadow-xs">
          No classes registered. Click "Add Class" above to get started.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groupedClasses.map(gc => (
            <div 
              key={gc.name}
              onClick={() => { setSelectedClassName(gc.name); setRosterSearch(''); setView('roster'); }}
              className="relative flex items-center justify-center p-6 bg-surface border border-border hover:border-primary/50 hover:shadow-md rounded-2xl cursor-pointer transition-all duration-200 select-none h-28 md:h-32 text-center"
            >
              <h3 className="font-bold text-text-primary text-xl tracking-tight font-display px-6 text-center truncate">
                {getShortClassName(gc.name)}
              </h3>

              {!isReadOnly && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownItem onClick={() => { setSelectedClassName(gc.name); setRosterSearch(''); setView('roster'); }}>
                      View Students
                    </DropdownItem>
                    <DropdownItem onClick={() => handleOpenEditClass(gc)}>
                      Manage Sections
                    </DropdownItem>
                    <DropdownItem onClick={() => { setSelectedClassName(gc.name); setView('identity-cards'); }}>
                      Identity Cards
                    </DropdownItem>
                    <DropdownItem 
                      onClick={() => handleDeleteClassClick(gc)}
                      className="text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Delete Class
                    </DropdownItem>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Manage Class Modal Overlay Popup */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-text-primary text-base tracking-tight font-display">
                {isEditing ? 'Manage Class Sections' : 'Add Class'}
              </h3>
              <button 
                type="button" 
                onClick={handleCloseClassForm} 
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateClass} className="p-6 space-y-5">
              
              {/* Field 1: Select Class / Classes */}
              {isEditing ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Select Class <span className="text-red-500">*</span></label>
                  <Input 
                    value={classNameInput} 
                    disabled 
                    className="bg-zinc-100 dark:bg-zinc-800 font-bold cursor-not-allowed" 
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-secondary uppercase">
                      Select Class(es) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {selectedClassNames.length > 0 && (
                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {selectedClassNames.length} Selected
                        </span>
                      )}
                      {availablePredefinedClasses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedClassNames.length === availablePredefinedClasses.length) {
                              setSelectedClassNames([]);
                            } else {
                              setSelectedClassNames(availablePredefinedClasses.map(c => c.name));
                            }
                            setClassFormError('');
                          }}
                          className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          {selectedClassNames.length === availablePredefinedClasses.length ? 'Deselect All' : 'Select All'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-xl space-y-1 divide-y divide-border/30">
                    {availablePredefinedClasses.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-4 italic">All standard classes have been added.</p>
                    ) : (
                      availablePredefinedClasses.map(c => {
                        const isSelected = selectedClassNames.includes(c.name);
                        return (
                          <div
                            key={c.name}
                            onClick={() => {
                              setClassFormError('');
                              if (isSelected) {
                                setSelectedClassNames(prev => prev.filter(name => name !== c.name));
                              } else {
                                setSelectedClassNames(prev => [...prev, c.name]);
                              }
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer select-none transition-all ${
                              isSelected
                                ? 'bg-primary/10 border border-primary/30 text-primary font-bold shadow-2xs'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-text-primary'
                            }`}
                          >
                            <span className="text-xs font-semibold">{c.name}</span>

                            {/* Circular Checkbox */}
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-primary border-primary text-white shadow-2xs'
                                : 'border-zinc-300 dark:border-zinc-700 bg-surface'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {classFormError && (
                    <p className="text-[11px] text-red-500 font-semibold">{classFormError}</p>
                  )}
                </div>
              )}

              {/* Section Type & Section Checkboxes - Visible ONLY if 1 Class is Selected OR Editing Mode */}
              {(isEditing || selectedClassNames.length === 1) ? (
                <>
                  {/* Field 2: Section Type (Optional) */}
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <label className="text-xs font-bold text-text-secondary uppercase">Section Type (Optional)</label>
                    <select
                      value={sectionTypeInput}
                      onChange={e => handleSectionTypeChange(e.target.value)}
                      className="flex h-9 w-full rounded-md border bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800"
                    >
                      <option value="">No Sections (Optional)</option>
                      <option value={SECTION_TYPES.ALPHABET}>Alphabet Sections (A, B, C, D)</option>
                      <option value={SECTION_TYPES.COLOR}>Color Sections (Red, Blue, Green, Yellow)</option>
                    </select>
                    {sectionTypeError && (
                      <p className="text-[11px] text-red-500 font-semibold">{sectionTypeError}</p>
                    )}
                  </div>

                  {/* Field 3: Multi-Select Checkboxes for Sections */}
                  {sectionTypeInput && (
                    <div className="space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-text-secondary uppercase">
                          Select Sections (Optional)
                        </label>
                        <span className="text-[11px] font-bold text-text-muted">Max 4</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-xl">
                        {(sectionTypeInput === SECTION_TYPES.ALPHABET ? ALPHABET_SECTIONS : COLOR_SECTIONS).map(sec => {
                          const isChecked = selectedSections.includes(sec);
                          return (
                            <div 
                              key={sec}
                              onClick={() => handleToggleSection(sec)}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                                isChecked 
                                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs' 
                                  : 'border-border bg-surface text-text-primary hover:border-zinc-300 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40'
                              }`}
                            >
                              <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                isChecked
                                  ? 'bg-primary border-primary text-white shadow-2xs'
                                  : 'border-zinc-300 dark:border-zinc-700 bg-surface'
                              }`}>
                                {isChecked && (
                                  <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                )}
                              </div>
                              <span className="text-sm font-semibold">{sec}</span>
                            </div>
                          );
                        })}
                      </div>
                      {sectionsFieldError && (
                        <p className="text-[11px] text-red-500 font-semibold">{sectionsFieldError}</p>
                      )}
                    </div>
                  )}
                </>
              ) : null}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={handleCloseClassForm}>Cancel</Button>
                <Button type="submit" disabled={savingClass || (!isEditing && availablePredefinedClasses.length === 0)}>
                  {savingClass ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Section Type Change Confirmation Modal */}
      {showSectionTypeConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-amber-500/10">
              <h3 className="font-bold text-amber-600 text-base tracking-tight font-display">
                Confirm Section Type Change
              </h3>
              <button 
                type="button" 
                onClick={() => setShowSectionTypeConfirm(false)} 
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                Changing the section type will clear the selected sections.
              </p>
              <p className="text-xs text-text-muted font-medium">
                Do you want to continue?
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" onClick={() => setShowSectionTypeConfirm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmSectionTypeChange} className="font-bold">
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Warning Modal (when studentCount > 0) */}
      {deleteWarningMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-red-500/10">
              <h3 className="font-bold text-red-600 text-base tracking-tight font-display">
                This action can not be done
              </h3>
              <button 
                type="button" 
                onClick={() => setDeleteWarningMessage('')} 
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl text-xs leading-relaxed space-y-2">
                <p className="font-bold text-sm">This action can not be done</p>
                <p>Students are currently enrolled in this class.</p>
                <p>Please transfer or remove all students before deleting this class.</p>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setDeleteWarningMessage('')}>Understood</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (when studentCount === 0) */}
      {deleteClassTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-red-500/10">
              <h3 className="font-bold text-red-600 text-base tracking-tight font-display">
                Delete Class
              </h3>
              <button 
                type="button" 
                onClick={() => setDeleteClassTarget(null)} 
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {deleteClassError && (
                <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs font-semibold">
                  {deleteClassError}
                </div>
              )}
              <p className="text-xs text-text-secondary leading-relaxed">
                Are you sure you want to delete <strong className="text-text-primary">{deleteClassTarget.name}</strong>?
              </p>
              <p className="text-xs font-medium text-text-muted">This class will be permanently removed.</p>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" onClick={() => setDeleteClassTarget(null)} disabled={isDeletingClass}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmDeleteClass} 
                  disabled={isDeletingClass}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {isDeletingClass ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdvanceDialogOpen && advanceTargetStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => {
          setIsAdvanceDialogOpen(false);
          setAdvanceTargetStudent(null);
          setSelectedAdvanceClassId('');
          setAdvanceError('');
        }}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-text-primary text-base tracking-tight font-display">
                Advance Student
              </h3>
              <button 
                type="button" 
                onClick={() => {
                  setIsAdvanceDialogOpen(false);
                  setAdvanceTargetStudent(null);
                  setSelectedAdvanceClassId('');
                  setAdvanceError('');
                }} 
                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {advanceError && (
                <div className="p-3 bg-red-500/10 text-red-600 border border-red-500/20 rounded-xl text-xs font-semibold">
                  {advanceError}
                </div>
              )}

              {/* Student info box */}
              <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-border rounded-xl p-4 text-xs space-y-2">
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">Student Name:</span>
                  <strong className="text-text-primary uppercase">{advanceTargetStudent.name}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">SR Number:</span>
                  <span className="font-bold font-mono text-text-primary">{advanceTargetStudent.sr_no || advanceTargetStudent.id}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">Current Class:</span>
                  <span className="font-bold text-text-primary">
                    {advanceTargetStudent.class_name} {advanceTargetStudent.section ? `- ${advanceTargetStudent.section}` : ''}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">Academic Year:</span>
                  <span className="font-bold text-text-primary">{advanceTargetStudent.academic_year_name || '2025–2026'}</span>
                </p>
              </div>

              {/* Selection dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                  Advance To <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedAdvanceClassId}
                  onChange={(e) => setSelectedAdvanceClassId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold focus:border-primary focus:ring-primary outline-none"
                  required
                >
                  <option value="">Select Class</option>
                  {getEligibleClasses(advanceTargetStudent.class_name, classes).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `- ${c.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warning box */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs leading-relaxed space-y-1.5">
                <p className="font-bold">Important Notice:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>This action will move the student to the selected class immediately.</li>
                  <li>All academic records and history will be preserved.</li>
                  <li>Please verify carefully before continuing.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setIsAdvanceDialogOpen(false);
                  setAdvanceTargetStudent(null);
                  setSelectedAdvanceClassId('');
                  setAdvanceError('');
                }}
                disabled={advancing}
              >
                Cancel
              </Button>
              <Button 
                className="font-bold" 
                onClick={handleAdvanceStudent} 
                disabled={advancing || !selectedAdvanceClassId}
              >
                {advancing ? 'Advancing...' : 'Advance Student'}
              </Button>
            </div>

          </div>
        </div>
      )}

      <CredentialsDialog
        isOpen={isCredentialsOpen}
        onClose={() => {
          setIsCredentialsOpen(false);
          setCredentialsTarget(null);
        }}
        role="PARENT"
        target={credentialsTarget}
      />

      {/* Merge Sections Confirmation Modal */}
      {showMergeConfirm && (
        <Dialog
          isOpen={showMergeConfirm}
          title="Remove All Sections"
          onClose={() => setShowMergeConfirm(false)}
        >
          <div className="space-y-4 max-w-sm text-xs font-semibold text-text-secondary">
            <p className="leading-relaxed">
              All students will be merged into one class without sections.
            </p>
            <p className="text-text-muted font-medium">
              Do you want to continue?
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowMergeConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={() => executeSaveClass(selectedSections)} className="font-bold">
                Continue
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Section Creation Success Modal */}
      {sectionCreationMessage && (
        <Dialog
          isOpen={!!sectionCreationMessage}
          title="Sections Created Successfully"
          onClose={() => setSectionCreationMessage('')}
        >
          <div className="space-y-4 max-w-sm text-xs font-semibold text-text-secondary leading-relaxed">
            <p>Sections have been created successfully.</p>
            <p>All existing students have been assigned to Section {selectedSections[0] || 'A'}.</p>
            <p className="text-text-muted font-medium">You can redistribute students anytime using Student Transfer.</p>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setSectionCreationMessage('')}>Understood</Button>
            </div>
          </div>
        </Dialog>
      )}
      {/* Student Limit Reached Dialog */}
      {showLimitReached && (
        <Dialog
          isOpen={!!showLimitReached}
          title="Student Limit Reached"
          onClose={() => setShowLimitReached(null)}
        >
          <div className="space-y-4 max-w-sm text-xs font-semibold text-text-secondary leading-relaxed">
            <p>
              Your current subscription plan allows a maximum of <strong>{showLimitReached.limit} students</strong>.
            </p>
            <p>You have already reached this limit.</p>
            <p className="text-text-muted font-medium">Please upgrade your subscription plan to continue enrolling new students.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowLimitReached(null)}>Cancel</Button>
              <Button onClick={() => { setShowLimitReached(null); navigate('/school-admin/profile/subscription'); }}>View Plans</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Transfer Students Modal moved to roster view block */}
    </div>
  );
}
