import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, User, X, MoreVertical } from 'lucide-react';
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

const CLASS_ORDER = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

const getClassIndex = (className) => {
  if (!className) return -1;
  const cleanName = className.trim();
  const index = CLASS_ORDER.findIndex(name => name.toLowerCase() === cleanName.toLowerCase());
  if (index !== -1) return index;

  // Fallback: extract numeric value
  const match = cleanName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return 2 + num;
  }
  return -1;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
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
  const [sectionsInput, setSectionsInput] = useState('');
  const [savingClass, setSavingClass] = useState(false);
  const [classFormError, setClassFormError] = useState('');
  const [sectionsFieldError, setSectionsFieldError] = useState('');
  
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
    setSectionsInput(gc.sections.join(', '));
    setClassFormError('');
    setSectionsFieldError('');
    setShowCreateForm(true);
  };

  const handleCloseClassForm = () => {
    setShowCreateForm(false);
    setIsEditing(false);
    setEditOldClassName('');
    setClassNameInput('');
    setSectionsInput('');
    setClassFormError('');
    setSectionsFieldError('');
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!classNameInput.trim()) {
      setClassFormError('Class name is required');
      return;
    }

    setSavingClass(true);
    setClassFormError('');
    setSectionsFieldError('');
    try {
      if (isEditing) {
        await schoolService.updateClass({
          oldName: editOldClassName,
          name: classNameInput.trim(),
          sections: sectionsInput.trim()
        });
      } else {
        await schoolService.createClass({
          name: classNameInput.trim(),
          sections: sectionsInput.trim()
        });
      }
      setClassNameInput('');
      setSectionsInput('');
      setIsEditing(false);
      setEditOldClassName('');
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      console.error(err);
      if (err.data?.errors?.sections) {
        setSectionsFieldError(err.data.errors.sections);
      } else {
        setClassFormError(err.message || 'Failed to save class.');
      }
    } finally {
      setSavingClass(false);
    }
  };

  // Group classes by name for the card grid view
  const getGroupedClasses = () => {
    const groups = {};
    classes.forEach(c => {
      if (!groups[c.name]) {
        groups[c.name] = {
          name: c.name,
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
      groups[name].studentCount = students.filter(s => s.class_name === name).length;
    });

    return Object.values(groups).sort((a, b) => a.minId - b.minId);
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

  if (view === 'roster') {
    const rosterStudents = students.filter(s => s.class_name === selectedClassName);
    
    // Resolve unique sections for the class filters dynamically
    const rosterClassRows = classes.filter(c => c.name === selectedClassName);
    const rosterSections = Array.from(new Set(rosterClassRows.filter(c => c.section).map(c => c.section))).sort();

    // Roster filters combination (Search + Section + Status)
    const filteredRoster = rosterStudents.filter(s => {
      const term = rosterSearch.toLowerCase();
      const matchesSearch = !rosterSearch || 
                            (s.first_name || '').toLowerCase().includes(term) || 
                            (s.last_name || '').toLowerCase().includes(term) || 
                            (s.name || '').toLowerCase().includes(term) || 
                            (s.roll_no || '').toLowerCase().includes(term);
      
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
              <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">{selectedClassName} ({rosterStudents.length})</h2>
            </div>
            {!isReadOnly && (
              <Button className="flex items-center gap-2 font-bold" onClick={() => { setView('enroll'); setSelectedStudentId(null); }}>
                <Plus className="h-4 w-4" /> Enroll Student
              </Button>
            )}
          </div>

          {/* Combined Filter Toolbar */}
          <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
              <Input 
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
                  <h3 className="font-extrabold text-text-primary text-base hover:text-primary transition-colors leading-tight truncate w-full px-1">
                    {s.name}
                  </h3>
                  
                  {/* Roll Number */}
                  <p className="text-xs text-text-muted mt-2 font-bold uppercase tracking-wider">
                    Roll No: <span className="font-mono text-text-primary font-extrabold">{s.roll_no || s.roll || '-'}</span>
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
                <h3 className="font-extrabold text-text-primary text-base tracking-tight font-display">
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
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block">
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
      </>
    );
  }

  const groupedClasses = getGroupedClasses();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header (No subtitle text) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Classes</h2>
        </div>
        {!isReadOnly && (
          <Button className="flex items-center gap-2 font-bold" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4" /> Create Class
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
          No classes registered. Click "Create Class" above to get started.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {groupedClasses.map(gc => (
            <div 
              key={gc.name}
              onClick={() => { setSelectedClassName(gc.name); setRosterSearch(''); setView('roster'); }}
              className="relative flex flex-col items-center justify-center p-7 bg-surface border border-border hover:border-primary/50 hover:shadow-md rounded-2xl cursor-pointer transition-all duration-200 min-h-[140px] text-center"
            >
              {/* 3-dot dropdown menu */}
              {!isReadOnly && (
                <div className="absolute top-3 right-3 z-10">
                  <DropdownMenu>
                    <DropdownItem onClick={() => handleOpenEditClass(gc)}>
                      Edit Class
                    </DropdownItem>
                  </DropdownMenu>
                </div>
              )}

              <h3 className="font-extrabold text-text-primary text-xl tracking-tight font-display">{gc.name}</h3>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Class Modal Overlay Popup */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-extrabold text-text-primary text-base tracking-tight">
                {isEditing ? 'Edit Class' : 'Create Class'}
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
            <form onSubmit={handleCreateClass} className="p-6 space-y-4">
              {classFormError && (
                <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs font-semibold">
                  {classFormError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Class Name <span className="text-red-500">*</span></label>
                <Input 
                  value={classNameInput} 
                  onChange={e => setClassNameInput(e.target.value)} 
                  placeholder="e.g. Class 1, Nursery, UKG" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Sections (Optional, Comma-Separated)</label>
                <Input 
                  value={sectionsInput} 
                  onChange={e => { setSectionsInput(e.target.value); setSectionsFieldError(''); }} 
                  placeholder="e.g. A, B, C" 
                  className={sectionsFieldError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {sectionsFieldError ? (
                  <p className="text-[11px] text-red-500 font-semibold mt-1">
                    {sectionsFieldError}
                  </p>
                ) : (
                  <p className="text-[10px] text-text-muted mt-1 leading-normal">
                    Specify optional sections separating them with commas (e.g. "A, B"). Leave blank if this class doesn't have sections.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={handleCloseClassForm}>Cancel</Button>
                <Button type="submit" disabled={savingClass}>
                  {savingClass ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>

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
              <h3 className="font-extrabold text-text-primary text-base tracking-tight font-display">
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
                <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block">
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

    </div>
  );
}
