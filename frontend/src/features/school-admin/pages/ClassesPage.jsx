import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, User, X } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import StudentEnrollmentForm from './StudentEnrollmentForm';
import StudentDetailsPage from './StudentDetailsPage';

// Self-healing avatar image component to handle loading errors gracefully
const StudentAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : `http://localhost:8000${src}`;
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
  
  return <User className="h-10 w-10 text-zinc-400" />;
};

export default function ClassesPage() {
  const [view, setView] = useState('list'); // 'list', 'roster', 'enroll', 'edit', 'details'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection states
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // New Class Form State (Modal)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [classNameInput, setClassNameInput] = useState('');
  const [sectionsInput, setSectionsInput] = useState('');
  const [savingClass, setSavingClass] = useState(false);
  const [classFormError, setClassFormError] = useState('');

  // Roster Search and Filters
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterSectionFilter, setRosterSectionFilter] = useState('All');
  const [rosterStatusFilter, setRosterStatusFilter] = useState('All');

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

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!classNameInput.trim()) {
      setClassFormError('Class name is required');
      return;
    }

    setSavingClass(true);
    setClassFormError('');
    try {
      await schoolService.createClass({
        name: classNameInput.trim(),
        sections: sectionsInput.trim()
      });
      setClassNameInput('');
      setSectionsInput('');
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      console.error(err);
      setClassFormError(err.message || 'Failed to create class.');
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
          studentCount: 0
        };
      }
      if (c.section) {
        groups[c.name].sections.push(c.section);
      }
    });

    // Populate student counts by grouping matching class names
    Object.keys(groups).forEach(name => {
      groups[name].sections.sort();
      groups[name].studentCount = students.filter(s => s.class_name === name).length;
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
    return (
      <StudentEnrollmentForm 
        onCancel={() => setView('roster')} 
        onSuccess={async () => {
          setView('roster');
          await loadData();
        }} 
      />
    );
  }

  if (view === 'edit') {
    return (
      <StudentEnrollmentForm 
        studentId={selectedStudentId} 
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
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">{selectedClassName} ({rosterStudents.length} Students)</h2>
          </div>
          <Button className="flex items-center gap-2 font-bold" onClick={() => { setView('enroll'); setSelectedStudentId(null); }}>
            <Plus className="h-4 w-4" /> Enroll Student
          </Button>
        </div>

        {/* Combined Filter Toolbar */}
        <div className="bg-surface border border-border rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
            <Input 
              placeholder="Search roster by name or roll number..." 
              className="pl-9" 
              value={rosterSearch} 
              onChange={e => setRosterSearch(e.target.value)} 
            />
          </div>

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
                className="flex flex-col items-center justify-center p-6 bg-surface border border-border rounded-2xl hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-200 text-center select-none"
              >
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
        <Button className="flex items-center gap-2 font-bold" onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4" /> Create Class
        </Button>
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
              className="flex flex-col items-center justify-center p-7 bg-surface border border-border hover:border-primary/50 hover:shadow-md rounded-2xl cursor-pointer transition-all duration-200 min-h-[140px] text-center"
            >
              <h3 className="font-extrabold text-text-primary text-xl tracking-tight font-display">{gc.name}</h3>
            </div>
          ))}
        </div>
      )}

      {/* Create Class Modal Overlay Popup */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-extrabold text-text-primary text-base tracking-tight">Create Class</h3>
              <button onClick={() => setShowCreateForm(false)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
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
                  onChange={e => setSectionsInput(e.target.value)} 
                  placeholder="e.g. A, B, C" 
                />
                <p className="text-[10px] text-text-muted mt-1 leading-normal">
                  Specify optional sections separating them with commas (e.g. "A, B"). Leave blank if this class doesn't have sections.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                <Button type="submit" disabled={savingClass}>
                  {savingClass ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
