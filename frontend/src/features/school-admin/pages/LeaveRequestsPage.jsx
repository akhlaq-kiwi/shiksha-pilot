import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, CheckCircle, XCircle, Clock, Calendar, Download, Eye, 
  Search, Filter, ChevronDown, Check, X, AlertCircle, Info, MoreVertical 
} from 'lucide-react';
import { schoolService } from '../../../common/services/schoolService';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { useToast } from '../../../common/components/Toast';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import PageTitle from '../../../common/components/PageTitle';

export default function LeaveRequestsPage() {
  const toast = useToast();
  const { currentYear } = useAcademicYear();

  // Tab State
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'teacher'

  // Listing State
  const [leaves, setLeaves] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [filters, setFilters] = useState({
    status: 'ALL',
    class_id: 'ALL',
    academic_year_id: currentYear?.id || '',
    search: ''
  });

  // Action / Modal States
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Dropdown States
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  // Load classes and leave requests
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

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const params = {
        academic_year_id: filters.academic_year_id,
        status: filters.status,
        applicant_role: activeTab === 'student' ? 'STUDENT' : 'TEACHER'
      };
      if (activeTab === 'student' && filters.class_id !== 'ALL') {
        params.class_id = filters.class_id;
      }
      
      const data = await schoolService.getLeaveRequests(params);
      setLeaves(data || []);
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (filters.academic_year_id) {
      loadLeaves();
    }
  }, [filters.academic_year_id, filters.status, filters.class_id, activeTab]);

  // Click outside to close actions dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Filter leaves locally for text search
  const filteredLeaves = leaves.filter(lr => {
    const term = filters.search.toLowerCase();
    if (!term) return true;
    
    if (lr.applicant_role === 'STUDENT') {
      const name = lr.student_name?.toLowerCase() || '';
      const clName = lr.class_name?.toLowerCase() || '';
      return name.includes(term) || clName.includes(term);
    } else {
      const name = lr.teacher_name?.toLowerCase() || '';
      const dept = lr.teacher_department?.toLowerCase() || '';
      return name.includes(term) || dept.includes(term);
    }
  });

  // Calculate status statistics
  const stats = {
    pending: leaves.filter(l => l.status === 'PENDING').length,
    approved: leaves.filter(l => l.status === 'APPROVED').length,
    rejected: leaves.filter(l => l.status === 'REJECTED').length
  };

  // Actions
  const handleApprove = async () => {
    if (!selectedLeave) return;
    setSubmitting(true);
    try {
      await schoolService.updateLeaveRequestStatus(selectedLeave.id, { status: 'APPROVED' });
      toast.show('success', 'Approved', 'Leave approved successfully.');
      setShowApproveModal(false);
      setSelectedLeave(null);
      loadLeaves();
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
      setSelectedLeave(null);
      loadLeaves();
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

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <PageTitle title="Leave Requests" subtitle="Manage student and teacher leave requests." />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-surface border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Pending Leaves</p>
              <h3 className="text-2xl font-black text-text-primary mt-1">{stats.pending}</h3>
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
              <h3 className="text-2xl font-black text-text-primary mt-1">{stats.approved}</h3>
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
              <h3 className="text-2xl font-black text-text-primary mt-1">{stats.rejected}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border bg-surface p-1 rounded-xl border">
        <button
          onClick={() => { setActiveTab('student'); setLeaves([]); }}
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition-all ${
            activeTab === 'student'
              ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          Student Leaves
        </button>
        <button
          onClick={() => { setActiveTab('teacher'); setLeaves([]); }}
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition-all ${
            activeTab === 'teacher'
              ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-sm'
              : 'text-text-secondary hover:text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          Teacher Leaves
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-surface border border-border p-4 rounded-xl w-full">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3 w-full">
          {/* Text search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <Input
              type="text"
              placeholder={activeTab === 'student' ? "Search student name, class..." : "Search teacher, department..."}
              className="pl-9 text-xs w-full"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          {/* Status filter */}
          <Select
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="text-xs sm:w-44"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>

          {/* Class Filter (only for students) */}
          {activeTab === 'student' && (
            <Select
              value={filters.class_id}
              onChange={e => setFilters(prev => ({ ...prev, class_id: e.target.value }))}
              className="text-xs sm:w-44"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}-{c.section}</option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {/* Main Table */}
      <Card className="bg-surface border-border overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-text-muted">Loading leave requests...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <FileText className="h-10 w-10 text-text-muted mb-3" />
              <h3 className="text-sm font-bold text-text-primary">No Leave Requests Found</h3>
              <p className="text-xs text-text-muted mt-1 max-w-sm">No leave request matching the current filters has been registered.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
                  <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Applicant</th>
                  <th className="p-4 font-bold text-text-muted uppercase tracking-wider">{activeTab === 'student' ? 'Class' : 'Department'}</th>
                  <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Leave Type</th>
                  <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Date Range</th>
                  <th className="p-4 font-bold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="p-4 font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeaves.map(lr => (
                  <tr key={lr.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                    <td className="p-4">
                      <div className="font-bold text-text-primary">
                        {lr.applicant_role === 'STUDENT' ? lr.student_name : lr.teacher_name}
                      </div>
                      <div className="text-[10px] text-text-muted font-medium mt-0.5">Applied by {lr.creator_name}</div>
                    </td>
                    <td className="p-4 font-semibold text-text-secondary">
                      {lr.applicant_role === 'STUDENT' 
                        ? `${lr.class_name || ''}-${lr.class_section || ''}` 
                        : (lr.teacher_department || '—')}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-text-secondary">
                        {lr.leave_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 font-bold text-text-primary">
                        <Calendar className="h-3 w-3 text-text-muted" />
                        <span>{new Date(lr.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(lr.to_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className="text-[10px] text-text-muted font-medium mt-0.5">
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

      {/* Details Dialog */}
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
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {selectedLeave.applicant_role === 'STUDENT' ? `Student · Class ${selectedLeave.class_name}-${selectedLeave.class_section}` : `Teacher · Dept: ${selectedLeave.teacher_department || 'N/A'}`}
                  </p>
                </div>
                {getStatusBadge(selectedLeave.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Leave Type</span>
                  <span className="text-xs font-bold text-text-primary mt-0.5 block">{selectedLeave.leave_type}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Duration</span>
                  <span className="text-xs font-bold text-text-primary mt-0.5 block">
                    {selectedLeave.from_date} to {selectedLeave.to_date}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Reason for Leave</span>
              <p className="text-xs text-text-secondary leading-relaxed bg-zinc-50 dark:bg-zinc-900 border border-border rounded-xl p-3 whitespace-pre-wrap">
                {selectedLeave.reason}
              </p>
            </div>

            {selectedLeave.attachment_path && (
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">Attachment</span>
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
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block mb-1">Rejection Reason</span>
                <p className="text-xs text-text-secondary">{selectedLeave.reject_reason}</p>
                <span className="text-[10px] text-text-muted block mt-1.5">Rejected by {selectedLeave.rejecter_name}</span>
              </div>
            )}

            {selectedLeave.status === 'APPROVED' && (
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold">Approved Request</span>
                <span className="text-[10px] text-text-muted block mt-1">Approved by {selectedLeave.approver_name}</span>
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

      {/* Approve Confirmation Dialog */}
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

      {/* Reject Reason Dialog */}
      {showRejectModal && (
        <Dialog
          isOpen={showRejectModal}
          onClose={() => { setShowRejectModal(false); setRejectReason(''); setRejectError(''); }}
          title="Reject Leave Request"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Reason for Rejection</label>
              <textarea
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
                maxLength={200}
              />
              {rejectError && <p className="text-[10px] font-bold text-red-500 mt-0.5">{rejectError}</p>}
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
