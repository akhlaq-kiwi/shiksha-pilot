import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, CheckCircle, XCircle, Clock, Calendar, Download, Eye, 
  Search, Filter, ChevronDown, Check, X, AlertCircle, Info, MoreVertical, Plus, Lock
} from 'lucide-react';
import { schoolService } from '../../../common/services/schoolService';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';
import { useToast } from '../../../common/components/Toast';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import PageTitle from '../../../common/components/PageTitle';

export default function LeaveRequestsPage() {
  const toast = useToast();
  const { isReadOnly, currentYear } = useAcademicYear();

  // Common data
  const [activeTab, setActiveTab] = useState('holidays'); // 'holidays' or 'requests'
  const [classes, setClasses] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // ─── Holidays State ───────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [newLeaveTitle, setNewLeaveTitle] = useState('');
  const [newLeaveDate, setNewLeaveDate] = useState('');
  const [holidayFormError, setHolidayFormError] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Holiday edit states
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState('');

  // Holiday delete states
  const [holidayToDelete, setHolidayToDelete] = useState(null);
  const [deletingHoliday, setDeletingHoliday] = useState(false);

  // ─── Student Leaves State ──────────────────────────────────────────────────────
  const [studentLeaves, setStudentLeaves] = useState([]);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [studentFilters, setStudentFilters] = useState({
    status: 'ALL',
    class_id: 'ALL',
    search: ''
  });

  // ─── Teacher Leaves State ──────────────────────────────────────────────────────
  const [teacherLeaves, setTeacherLeaves] = useState([]);
  const [loadingTeacher, setLoadingTeacher] = useState(true);
  const [teacherFilters, setTeacherFilters] = useState({
    status: 'ALL',
    search: ''
  });

  // ─── Shared Leave Modal States ───────────────────────────────────────────────
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Dropdown menus
  const [openMenuHolidayId, setOpenMenuHolidayId] = useState(null);

  // ─── Fetching Logic ───────────────────────────────────────────────────────────

  // Load classes initially
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const cls = await schoolService.getClasses();
        setClasses(cls || []);
      } catch (err) {
        console.error('Failed to fetch classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Fetch holidays
  const loadHolidays = useCallback(() => {
    setLoadingHolidays(true);
    schoolService.getHolidays()
      .then(data => {
        setHolidays(data || []);
      })
      .catch(() => {
        toast.show('error', 'Error', 'Failed to load holidays.');
      })
      .finally(() => {
        setLoadingHolidays(false);
      });
  }, [toast]);

  // Always load holidays initially and whenever academic year changes
  useEffect(() => {
    loadHolidays();
  }, [loadHolidays, currentYear]);

  // Fetch student leave requests
  const loadStudentLeaves = async () => {
    setLoadingStudent(true);
    try {
      const params = {
        academic_year_id: currentYear?.id || '',
        status: studentFilters.status,
        applicant_role: 'STUDENT'
      };
      if (studentFilters.class_id !== 'ALL') {
        params.class_id = studentFilters.class_id;
      }
      const data = await schoolService.getLeaveRequests(params);
      setStudentLeaves(data || []);
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to load student leave requests.');
    } finally {
      setLoadingStudent(false);
    }
  };

  // Fetch teacher leave requests
  const loadTeacherLeaves = async () => {
    setLoadingTeacher(true);
    try {
      const params = {
        academic_year_id: currentYear?.id || '',
        status: teacherFilters.status,
        applicant_role: 'TEACHER'
      };
      const data = await schoolService.getLeaveRequests(params);
      setTeacherLeaves(data || []);
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to load teacher leave requests.');
    } finally {
      setLoadingTeacher(false);
    }
  };

  useEffect(() => {
    if (currentYear?.id) {
      loadStudentLeaves();
    }
  }, [currentYear?.id, studentFilters.status, studentFilters.class_id]);

  useEffect(() => {
    if (currentYear?.id) {
      loadTeacherLeaves();
    }
  }, [currentYear?.id, teacherFilters.status]);

  // ─── Holiday Handlers ──────────────────────────────────────────────────────────

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    setHolidayFormError('');
    if (!newLeaveTitle.trim()) {
      setHolidayFormError('Holiday title is required.');
      return;
    }
    if (!newLeaveDate) {
      setHolidayFormError('Holiday date is required.');
      return;
    }

    if (currentYear) {
      if (newLeaveDate < currentYear.start_date || newLeaveDate > currentYear.end_date) {
        setHolidayFormError(`Holiday date must be within the active Academic Year (${currentYear.start_date} to ${currentYear.end_date}).`);
        return;
      }
    }

    setSavingHoliday(true);
    try {
      await schoolService.createHoliday({
        name: newLeaveTitle.trim(),
        date: newLeaveDate
      });
      toast.success('Holiday created successfully.', 'Success');
      setNewLeaveTitle('');
      setNewLeaveDate('');
      loadHolidays();
    } catch (err) {
      console.error(err);
      const errMsg = err.message || 'Failed to create holiday.';
      setHolidayFormError(errMsg);
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleUpdateHoliday = async (id) => {
    setEditError('');
    if (!editName.trim()) {
      setEditError('Holiday name is required.');
      return;
    }
    if (!editDate) {
      setEditError('Holiday date is required.');
      return;
    }

    if (currentYear) {
      if (editDate < currentYear.start_date || editDate > currentYear.end_date) {
        setEditError(`Holiday date must be within the active Academic Year (${currentYear.start_date} to ${currentYear.end_date}).`);
        return;
      }
    }

    try {
      await schoolService.updateHoliday(id, {
        name: editName.trim(),
        date: editDate
      });
      toast.success('Holiday updated successfully.', 'Success');
      setEditingHolidayId(null);
      loadHolidays();
    } catch (err) {
      console.error(err);
      const errMsg = err.message || 'Failed to update holiday.';
      setEditError(errMsg);
    }
  };

  const handleDeleteHoliday = (h) => {
    setHolidayToDelete(h);
  };

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    setDeletingHoliday(true);
    try {
      await schoolService.deleteHoliday(holidayToDelete.id);
      toast.success('Holiday deleted successfully.', 'Success');
      setHolidayToDelete(null);
      loadHolidays();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to delete holiday.', 'Error');
    } finally {
      setDeletingHoliday(false);
    }
  };

  const startEditHoliday = (h) => {
    setEditingHolidayId(h.id);
    setEditName(h.name);
    setEditDate(h.date);
    setEditError('');
  };

  // ─── Leave Request Handlers ────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!selectedLeave) return;
    setSubmitting(true);
    try {
      await schoolService.updateLeaveRequestStatus(selectedLeave.id, { status: 'APPROVED' });
      toast.show('success', 'Approved', 'Leave approved successfully.');
      setShowApproveModal(false);
      const role = selectedLeave.applicant_role;
      setSelectedLeave(null);
      if (role === 'TEACHER') {
        loadTeacherLeaves();
      } else {
        loadStudentLeaves();
      }
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to approve leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedLeave) return;
    if (!rejectReason.trim()) {
      setRejectError('Please enter a reason for rejection.');
      return;
    }
    setRejectError('');
    setSubmitting(true);
    try {
      await schoolService.updateLeaveRequestStatus(selectedLeave.id, { 
        status: 'REJECTED', 
        reject_reason: rejectReason 
      });
      toast.show('success', 'Rejected', 'Leave request rejected successfully.');
      setShowRejectModal(false);
      setRejectReason('');
      const role = selectedLeave.applicant_role;
      setSelectedLeave(null);
      if (role === 'TEACHER') {
        loadTeacherLeaves();
      } else {
        loadStudentLeaves();
      }
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to reject leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="h-3 w-3" /> Pending</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="h-3 w-3" /> Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle className="h-3 w-3" /> Rejected</span>;
      case 'CANCELLED':
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"><X className="h-3 w-3" /> Cancelled</span>;
    }
  };

  // Local filtering logic
  const filteredStudentLeaves = studentLeaves.filter(lr => {
    const term = studentFilters.search.toLowerCase();
    if (!term) return true;
    const name = lr.student_name?.toLowerCase() || '';
    const clName = lr.class_name?.toLowerCase() || '';
    return name.includes(term) || clName.includes(term);
  });

  const filteredTeacherLeaves = teacherLeaves.filter(lr => {
    const term = teacherFilters.search.toLowerCase();
    if (!term) return true;
    const name = lr.teacher_name?.toLowerCase() || '';
    const dept = lr.teacher_department?.toLowerCase() || '';
    return name.includes(term) || dept.includes(term);
  });

  // Calculate status statistics
  const studentStats = {
    pending: studentLeaves.filter(l => l.status === 'PENDING').length,
    approved: studentLeaves.filter(l => l.status === 'APPROVED').length,
    rejected: studentLeaves.filter(l => l.status === 'REJECTED').length
  };

  const teacherStats = {
    pending: teacherLeaves.filter(l => l.status === 'PENDING').length,
    approved: teacherLeaves.filter(l => l.status === 'APPROVED').length,
    rejected: teacherLeaves.filter(l => l.status === 'REJECTED').length
  };

  // Holidays dates sort
  const todayStr = new Date().toISOString().split('T')[0];
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <PageTitle title="Manage Leaves" subtitle="Manage school holidays, student leaves, and teacher leaves." />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('holidays')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'holidays'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Official Holidays
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Leave Requests
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 1: Official Holidays
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight">Official Holidays</h2>
          </div>

        {/* Add Holiday Form */}
        {!isReadOnly && (
          <Card className="border border-border shadow-sm bg-surface">
            <CardHeader className="pb-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
              <CardTitle className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Add Holiday / Leave Day
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleCreateHoliday} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <label htmlFor="leave-title" className="text-xs font-bold text-text-secondary uppercase">Leave Title</label>
                  <Input id="leave-title"
                    type="text"
                    placeholder="e.g. Republic Day"
                    value={newLeaveTitle}
                    onChange={e => setNewLeaveTitle(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Leave Date</label>
                  <Input
                    type="date"
                    value={newLeaveDate}
                    onChange={e => setNewLeaveDate(e.target.value)}
                    min={currentYear?.start_date || ''}
                    max={currentYear?.end_date || ''}
                    className="h-9"
                  />
                </div>
                <div>
                  <Button type="submit" className="w-full h-9 font-semibold" disabled={savingHoliday}>
                    {savingHoliday ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                {holidayFormError && (
                  <div className="col-span-1 md:col-span-3">
                    <p className="text-xs font-bold text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {holidayFormError}
                    </p>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* Holidays List */}
        <Card className="border border-border shadow-sm bg-surface">
          <CardHeader className="pb-3 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
            <CardTitle className="text-sm font-bold text-text-primary">School Holidays List</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingHolidays ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs text-text-muted">Loading holidays...</p>
              </div>
            ) : sortedHolidays.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm border-dashed border-2 rounded-xl">
                No holidays created for this academic year.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {sortedHolidays.map(h => {
                  const isEditingThis = editingHolidayId === h.id;
                  const isPast = h.date < todayStr;
                  const dateFormatted = new Date(h.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  });

                  return (
                    <Card key={h.id} className="border border-border hover:border-zinc-300 dark:hover:border-zinc-800 transition-all shadow-sm rounded-xl relative bg-surface">
                      <CardContent className="p-4">
                        {isEditingThis ? (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold uppercase text-text-secondary">Holiday Name</label>
                                <Input 
                                  value={editName} 
                                  onChange={e => setEditName(e.target.value)} 
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-bold uppercase text-text-secondary">Date</label>
                                <Input 
                                  type="date"
                                  value={editDate} 
                                  onChange={e => setEditDate(e.target.value)} 
                                  min={currentYear?.start_date || ''}
                                  max={currentYear?.end_date || ''}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            {editError && (
                              <p className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {editError}</p>
                            )}
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => setEditingHolidayId(null)}>
                                Cancel
                              </Button>
                              <Button size="sm" className="h-8 text-xs font-bold" onClick={() => handleUpdateHoliday(h.id)}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <h4 className="font-bold text-text-primary text-sm tracking-tight">{h.name}</h4>
                              <p className="text-[11px] font-bold text-text-secondary mt-0.5 flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {dateFormatted}
                                {isPast && <Lock className="h-3 w-3 ml-1 text-text-muted" />}
                              </p>
                            </div>
                            
                            {!isReadOnly && !isPast && (
                              <DropdownMenu>
                                <DropdownItem onClick={() => startEditHoliday(h)}>
                                  Edit
                                </DropdownItem>
                                <DropdownItem destructive onClick={() => handleDeleteHoliday(h)}>
                                  Delete
                                </DropdownItem>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 2: Student Leave Requests
          ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <>
          <div className="space-y-4 mt-4">
            <div className="border-b border-border pb-2">
              <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight">Student Leave Requests</h2>
            </div>

        {/* Student Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-surface border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Pending Leaves</p>
                <h3 className="text-2xl font-bold text-text-primary mt-1">{studentStats.pending}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Approved Leaves</p>
                <h3 className="text-2xl font-bold text-text-primary mt-1">{studentStats.approved}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Rejected Leaves</p>
                <h3 className="text-2xl font-bold text-text-primary mt-1">{studentStats.rejected}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-surface border border-border p-4 rounded-xl w-full">
          <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <Input aria-label="Search student name, class..."
                type="text"
                placeholder="Search student name, class..."
                className="pl-9 text-xs w-full"
                value={studentFilters.search}
                onChange={e => setStudentFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <Select
              value={studentFilters.status}
              onChange={e => setStudentFilters(prev => ({ ...prev, status: e.target.value }))}
              className="text-xs sm:w-44"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>

            <Select
              value={studentFilters.class_id}
              onChange={e => setStudentFilters(prev => ({ ...prev, class_id: e.target.value }))}
              className="text-xs sm:w-44"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}-{c.section}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Student Listing Table */}
        <Card className="bg-surface border-border overflow-hidden">
          <div className="overflow-x-auto min-h-[250px]">
            {loadingStudent ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs text-text-muted">Loading student leaves...</p>
              </div>
            ) : filteredStudentLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <FileText className="h-10 w-10 text-text-muted mb-3" />
                <h3 className="text-sm font-bold text-text-primary">No Student Leaves Found</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm">No student leave request matching the current filters has been registered.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Student</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Class</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Leave Type</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Date Range</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredStudentLeaves.map(lr => (
                    <tr key={lr.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                      <td className="p-4">
                        <div className="font-bold text-text-primary">{lr.student_name}</div>
                        <div className="text-[11px] text-text-muted font-medium mt-0.5">Applied by {lr.creator_name}</div>
                      </td>
                      <td className="p-4 font-semibold text-text-secondary">
                        {lr.class_name || ''}-{lr.class_section || ''}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-text-secondary">
                          {lr.leave_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold text-text-primary">
                          <Calendar className="h-3 w-3 text-text-muted" />
                          <span>{new Date(lr.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(lr.to_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="text-[11px] text-text-muted font-medium mt-0.5">
                          {Math.ceil((new Date(lr.to_date) - new Date(lr.from_date)) / (1000 * 60 * 60 * 24)) + 1} Days
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(lr.status)}</td>
                      <td className="p-4 text-right relative">
                        <div className="inline-flex gap-2">
                          <Button 
                            onClick={() => { setSelectedLeave(lr); setShowDetailsModal(true); }}
                            variant="ghost" 
                            size="xs"
                            className="h-8 w-8 p-0 justify-center"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-text-secondary" />
                          </Button>

                          {lr.status === 'PENDING' && (
                            <>
                              <button 
                                onClick={() => { setSelectedLeave(lr); setShowApproveModal(true); }}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-600 transition-all duration-150 cursor-pointer h-auto"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => { setSelectedLeave(lr); setShowRejectModal(true); }}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-600 transition-all duration-150 cursor-pointer h-auto"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 3: Teacher Leave Requests
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4 mt-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-tight">Teacher Leave Requests</h2>
        </div>

        {/* Teacher Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-surface border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Pending Leaves</p>
                <h3 className="text-2xl font-bold text-text-primary mt-1">{teacherStats.pending}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Approved Leaves</p>
                <h3 className="text-2xl font-bold text-text-primary mt-1">{teacherStats.approved}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Rejected Leaves</p>
                <h3 className="text-2xl font-bold text-text-primary mt-1">{teacherStats.rejected}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teacher Filters */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-surface border border-border p-4 rounded-xl w-full">
          <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <Input aria-label="Search teacher, department..."
                type="text"
                placeholder="Search teacher, department..."
                className="pl-9 text-xs w-full"
                value={teacherFilters.search}
                onChange={e => setTeacherFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <Select
              value={teacherFilters.status}
              onChange={e => setTeacherFilters(prev => ({ ...prev, status: e.target.value }))}
              className="text-xs sm:w-44"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
        </div>

        {/* Teacher Listing Table */}
        <Card className="bg-surface border-border overflow-hidden">
          <div className="overflow-x-auto min-h-[250px]">
            {loadingTeacher ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs text-text-muted">Loading teacher leaves...</p>
              </div>
            ) : filteredTeacherLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <FileText className="h-10 w-10 text-text-muted mb-3" />
                <h3 className="text-sm font-bold text-text-primary">No Teacher Leaves Found</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm">No teacher leave request matching the current filters has been registered.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Teacher</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Department</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Leave Type</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Date Range</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTeacherLeaves.map(lr => (
                    <tr key={lr.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                      <td className="p-4">
                        <div className="font-bold text-text-primary">{lr.teacher_name}</div>
                        <div className="text-[11px] text-text-muted font-medium mt-0.5">Applied by {lr.creator_name}</div>
                      </td>
                      <td className="p-4 font-semibold text-text-secondary">
                        {lr.teacher_department || '—'}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold text-text-secondary">
                          {lr.leave_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold text-text-primary">
                          <Calendar className="h-3 w-3 text-text-muted" />
                          <span>{new Date(lr.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(lr.to_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="text-[11px] text-text-muted font-medium mt-0.5">
                          {Math.ceil((new Date(lr.to_date) - new Date(lr.from_date)) / (1000 * 60 * 60 * 24)) + 1} Days
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(lr.status)}</td>
                      <td className="p-4 text-right relative">
                        <div className="inline-flex gap-2">
                          <Button 
                            onClick={() => { setSelectedLeave(lr); setShowDetailsModal(true); }}
                            variant="ghost" 
                            size="xs"
                            className="h-8 w-8 p-0 justify-center"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-text-secondary" />
                          </Button>

                          {lr.status === 'PENDING' && (
                            <>
                              <button 
                                onClick={() => { setSelectedLeave(lr); setShowApproveModal(true); }}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-600 transition-all duration-150 cursor-pointer h-auto"
                              >
                                Approve
                              </button>
                              <button 
                                onClick={() => { setSelectedLeave(lr); setShowRejectModal(true); }}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-600 transition-all duration-150 cursor-pointer h-auto"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
        </>
      )}

      {/* ─── Delete Holiday Confirmation Modal ─── */}
      <Dialog
        isOpen={holidayToDelete !== null}
        onClose={() => setHolidayToDelete(null)}
        title="Delete Holiday"
        description="This action cannot be undone."
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHolidayToDelete(null)}
              disabled={deletingHoliday}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDeleteHoliday}
              disabled={deletingHoliday}
            >
              {deletingHoliday ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <p className="text-sm text-text-secondary">
            Are you sure you want to delete the holiday <strong className="text-text-primary">"{holidayToDelete?.name}"</strong> scheduled for <strong className="text-text-primary">{holidayToDelete && new Date(holidayToDelete.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>?
          </p>
          <p className="text-xs text-red-500 font-medium">
            This will remove the holiday from the academic calendar and restore this date as a working day for attendance tracking.
          </p>
        </div>
      </Dialog>

      {/* ─── Details Dialog ─── */}
      {showDetailsModal && selectedLeave && (
        <Dialog 
          isOpen={showDetailsModal} 
          onClose={() => { setShowDetailsModal(false); setSelectedLeave(null); }}
          title="Leave Request Details"
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-border">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">
                    {selectedLeave.applicant_role === 'STUDENT' ? selectedLeave.student_name : selectedLeave.teacher_name}
                  </h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {selectedLeave.applicant_role === 'STUDENT' ? `Student · Class ${selectedLeave.class_name}-${selectedLeave.class_section}` : `Teacher · Dept: ${selectedLeave.teacher_department || 'N/A'}`}
                  </p>
                </div>
                {getStatusBadge(selectedLeave.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border">
                <div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Leave Type</span>
                  <span className="text-xs font-bold text-text-primary mt-0.5 block">{selectedLeave.leave_type}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Duration</span>
                  <span className="text-xs font-bold text-text-primary mt-0.5 block">
                    {selectedLeave.from_date} to {selectedLeave.to_date}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">Reason for Leave</span>
              <p className="text-xs text-text-secondary leading-relaxed bg-zinc-50 dark:bg-zinc-900 border border-border rounded-xl p-3 whitespace-pre-wrap">
                {selectedLeave.reason}
              </p>
            </div>

            {selectedLeave.attachment_path && (
              <div>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">Attachment</span>
                <a 
                  href={`http://localhost:8000${selectedLeave.attachment_path}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-text-primary border border-border"
                >
                  <Download className="h-4 w-4" /> Download Attachment
                </a>
              </div>
            )}

            {selectedLeave.status === 'REJECTED' && (
              <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-3">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 block mb-1">Rejection Reason</span>
                <p className="text-xs text-text-secondary">{selectedLeave.reject_reason}</p>
                <span className="text-[11px] text-text-muted block mt-1.5">Rejected by {selectedLeave.rejecter_name}</span>
              </div>
            )}

            {selectedLeave.status === 'APPROVED' && (
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-bold">Approved Request</span>
                <span className="text-[11px] text-text-muted block mt-1">Approved by {selectedLeave.approver_name}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button 
                onClick={() => { setShowDetailsModal(false); setSelectedLeave(null); }}
                variant="outline" 
                className="text-xs"
              >
                Close
              </Button>
              {selectedLeave.status === 'PENDING' && (
                <>
                  <Button 
                    onClick={() => { setShowDetailsModal(false); setShowRejectModal(true); }}
                    className="bg-rose-600 hover:bg-rose-700 text-white border-none text-xs"
                  >
                    Reject
                  </Button>
                  <Button 
                    onClick={() => { setShowDetailsModal(false); setShowApproveModal(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-none text-xs"
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── Approve Confirmation Dialog ─── */}
      {showApproveModal && (
        <Dialog
          isOpen={showApproveModal}
          onClose={() => { setShowApproveModal(false); }}
          title="Approve Leave Request"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="flex gap-3 text-text-secondary items-start">
              <Info className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Are you sure you want to approve this leave request? This will mark the student/teacher status as Approved and dynamically update student attendance to <span className="font-bold text-emerald-600">Leave</span> for these dates.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                onClick={() => setShowApproveModal(false)} 
                variant="outline" 
                className="text-xs"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-none text-xs"
                disabled={submitting}
              >
                {submitting ? 'Approving...' : 'Confirm Approve'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── Reject Reason Dialog ─── */}
      {showRejectModal && (
        <Dialog
          isOpen={showRejectModal}
          onClose={() => { setShowRejectModal(false); setRejectReason(''); setRejectError(''); }}
          title="Reject Leave Request"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reason-for-rejection" className="text-xs font-bold text-text-secondary uppercase">Reason for Rejection</label>
              <textarea id="reason-for-rejection"
                placeholder="Type the reason for rejection here..."
                rows={3}
                value={rejectReason}
                onChange={e => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError('');
                }}
                className={`w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary focus:outline-none ${
                  rejectError ? 'border-red-500 focus:ring-red-500' : 'border-border'
                }`}
                maxLength={300}
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-[11px] text-text-muted">
                  {rejectReason.length}/300 characters (Maximum 300 characters allowed.)
                </span>
                {rejectReason.length >= 300 && (
                  <span className="text-[11px] font-bold text-red-500">
                    Limit reached
                  </span>
                )}
              </div>
              {rejectError && <p className="text-[11px] font-bold text-red-500 mt-0.5">{rejectError}</p>}
            </div>
            <div className="flex justify-end gap-3">
              <Button 
                onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectError(''); }} 
                variant="outline" 
                className="text-xs"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleReject}
                className="bg-rose-600 hover:bg-rose-700 text-white border-none text-xs"
                disabled={submitting}
              >
                {submitting ? 'Rejecting...' : 'Reject Request'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
