import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, FileText, CheckCircle, XCircle, Clock, Plus, X, Upload, 
  Trash2, Download, Info, AlertTriangle, FileUp, RefreshCw, Eye
} from 'lucide-react';
import { schoolService } from '../../../common/services/schoolService';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { useToast } from '../../../common/components/Toast';

const LEAVE_TYPES = [
  'Sick Leave',
  'Personal Leave',
  'Casual Leave',
  'Emergency Leave',
  'Maternity/Paternity Leave',
  'Other'
];

const getHolidayIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes('independ')) return '🏵️';
  if (n.includes('republic')) return '🇮🇳';
  if (n.includes('gandhi')) return '👓';
  if (n.includes('christmas')) return '🎄';
  if (n.includes('diwali') || n.includes('deepawali')) return '🪔';
  if (n.includes('holi')) return '🎨';
  if (n.includes('eid')) return '🌙';
  if (n.includes('new year')) return '🎉';
  if (n.includes('dussehra')) return '🏹';
  return '📅';
};

const getHolidayType = (name) => {
  const n = name.toLowerCase();
  if (n.includes('independ') || n.includes('republic') || n.includes('gandhi')) {
    return 'National Holiday';
  }
  return 'School Holiday';
};

const getHolidayDay = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return '';
  }
};

const formatDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function TeacherLeavePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('holidays'); // 'holidays' | 'requests'
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  // Form State
  const [form, setForm] = useState({
    leave_type: 'Sick Leave',
    from_date: '',
    to_date: '',
    reason: ''
  });
  const [attachment, setAttachment] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Word counter
  const [wordCount, setWordCount] = useState(0);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const [leavesData, holidaysData] = await Promise.all([
        schoolService.getLeaveRequests({ view_type: 'OWN' }),
        schoolService.getHolidays()
      ]);
      setLeaves(leavesData || []);
      setHolidays(holidaysData || []);
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to load leaves center data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReasonChange = (e) => {
    const text = e.target.value;
    const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    setWordCount(count);
    setForm(prev => ({ ...prev, reason: text }));
    if (formErrors.reason) setFormErrors(prev => ({ ...prev, reason: '' }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    // Validations
    const errors = {};
    if (!form.from_date) errors.from_date = 'Start date is required.';
    if (!form.to_date) errors.to_date = 'End date is required.';
    if (form.from_date && form.to_date && new Date(form.to_date) < new Date(form.from_date)) {
      errors.to_date = 'End date cannot be earlier than start date.';
    }
    if (!form.reason.trim()) {
      errors.reason = 'Reason for leave is required.';
    } else if (wordCount > 100) {
      errors.reason = `Reason cannot exceed 100 words. Current count: ${wordCount}`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      let attachmentPath = null;
      if (attachment) {
        const formData = new FormData();
        formData.append('file', attachment);
        const uploadRes = await schoolService.uploadLeaveAttachment(formData);
        attachmentPath = uploadRes.url;
      }

      await schoolService.applyLeaveRequest({
        ...form,
        attachment_path: attachmentPath
      });

      toast.show('success', 'Submitted', 'Leave request submitted successfully.');
      setShowApplyModal(false);
      // Reset form
      setForm({
        leave_type: 'Sick Leave',
        from_date: '',
        to_date: '',
        reason: ''
      });
      setAttachment(null);
      setWordCount(0);
      loadData(true);
    } catch (err) {
      toast.show('error', 'Submission Failed', err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeaveConfirm = async () => {
    if (!selectedLeave) return;
    setSubmitting(true);
    try {
      await schoolService.cancelLeaveRequest(selectedLeave.id);
      toast.show('success', 'Cancelled', 'Leave request cancelled successfully.');
      setShowCancelModal(false);
      setSelectedLeave(null);
      loadData(true);
    } catch (err) {
      toast.show('error', 'Reversal Failed', err.message || 'Failed to cancel leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'CANCELLED':
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const getStatusVerticalStripe = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-500';
      case 'APPROVED':
        return 'bg-emerald-500';
      case 'REJECTED':
        return 'bg-rose-500';
      case 'CANCELLED':
      default:
        return 'bg-zinc-400';
    }
  };

  // Group and sort holidays in local Kolkata timezone offset
  const todayStr = (() => {
    const d = new Date();
    const offset = 5.5 * 60; // Kolkata timezone offset in minutes (+5:30)
    const localTime = new Date(d.getTime() + (offset + d.getTimezoneOffset()) * 60000);
    return `${localTime.getFullYear()}-${String(localTime.getMonth() + 1).padStart(2, '0')}-${String(localTime.getDate()).padStart(2, '0')}`;
  })();

  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-6 relative min-h-[500px] animate-in fade-in duration-300">
      
      {/* Floating Action Button for requests tab */}
      {activeTab === 'requests' && (
        <button
          onClick={() => setShowApplyModal(true)}
          className="fixed bottom-6 right-6 z-40 bg-primary text-white hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-xl rounded-full p-4 flex items-center justify-center transition-all duration-200 focus:outline-hidden"
          title="Request Leave"
          aria-label="Request Leave"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight font-display">Leaves</h2>
          <p className="text-xs text-text-muted">Apply for leave, monitor applications, and view official school holidays.</p>
        </div>
        <Button 
          variant="outline"
          size="icon"
          onClick={() => loadData(true)}
          className={`h-8 w-8 text-text-secondary ${refreshing ? 'animate-spin' : ''}`}
          disabled={loading || refreshing}
          title="Refresh Data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Segmented Control / Tab Switcher */}
      <div className="flex bg-background border border-border rounded-xl p-1 w-full sm:max-w-md">
        <button
          onClick={() => setActiveTab('holidays')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'holidays'
              ? 'bg-primary text-primary-fg font-bold shadow-2xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-secondary/40'
          }`}
        >
          Official Holidays
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
            activeTab === 'requests'
              ? 'bg-primary text-primary-fg font-bold shadow-2xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-secondary/40'
          }`}
        >
          Leave Requests
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Loading Leaves Center...</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Tab 1: Official Holidays */}
          {activeTab === 'holidays' && (
            <div className="space-y-3">
              {sortedHolidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
                  <Calendar className="h-10 w-10 text-text-muted" />
                  <h4 className="text-sm font-bold text-text-primary">No holidays available</h4>
                  <p className="text-xs text-text-muted max-w-xs">There are currently no official school holidays declared by the administration.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedHolidays.map(h => {
                    const isToday = h.date === todayStr;
                    const isUpcoming = h.date > todayStr;
                    
                    let cardBorderClass = 'border-border';
                    let cardBgClass = 'bg-surface';
                    let badgeLabel = null;
                    let badgeStyles = '';

                    if (isToday) {
                      cardBorderClass = 'border-emerald-500 ring-1 ring-emerald-500/20';
                      cardBgClass = 'bg-emerald-500/5 dark:bg-emerald-950/10';
                      badgeLabel = 'Today';
                      badgeStyles = 'bg-emerald-500 text-white font-bold';
                    } else if (isUpcoming) {
                      cardBorderClass = 'border-blue-500/30';
                      cardBgClass = 'bg-blue-500/5 dark:bg-blue-950/5';
                      badgeLabel = 'Upcoming';
                      badgeStyles = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
                    } else {
                      cardBgClass = 'bg-zinc-50/50 dark:bg-zinc-900/10 opacity-70';
                    }

                    return (
                      <Card key={h.id} className={`${cardBgClass} ${cardBorderClass} transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md`}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl shadow-2xs border border-border/50 bg-background`}>
                            {getHolidayIcon(h.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-bold text-text-primary truncate">{h.name}</h4>
                              {badgeLabel && (
                                <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeStyles}`}>
                                  {badgeLabel}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-text-secondary font-semibold">{formatDate(h.date)}</span>
                              <span className="h-1 w-1 bg-border rounded-full"></span>
                              <span className="text-[11px] text-text-muted font-medium">{getHolidayDay(h.date)}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {getHolidayType(h.name)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Leave Requests */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {leaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
                  <FileText className="h-10 w-10 text-text-muted animate-pulse" />
                  <h4 className="text-sm font-bold text-text-primary">No Leave Applications</h4>
                  <p className="text-xs text-text-muted max-w-xs">You haven't submitted any leave requests yet. Click the floating button below to apply.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {leaves.map(lr => (
                    <Card key={lr.id} className="bg-surface border-border shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden relative pl-2.5">
                      
                      {/* Visual Status Stripe */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusVerticalStripe(lr.status)}`} />
                      
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-text-primary">{lr.leave_type}</span>
                            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary mt-0.5 font-bold">
                              <span>{formatDate(lr.from_date)}</span>
                              <span>to</span>
                              <span>{formatDate(lr.to_date)}</span>
                              <span className="text-[11px] font-semibold text-text-muted">
                                ({Math.ceil((new Date(lr.to_date) - new Date(lr.from_date)) / (1000 * 60 * 60 * 24)) + 1} Days)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${getStatusBadgeStyles(lr.status)}`}>
                              {lr.status === 'PENDING' && <Clock className="h-2 w-2" />}
                              {lr.status === 'APPROVED' && <CheckCircle className="h-2 w-2" />}
                              {lr.status === 'REJECTED' && <XCircle className="h-2 w-2" />}
                              {lr.status === 'CANCELLED' && <X className="h-2 w-2" />}
                              {lr.status}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-text-secondary bg-zinc-50/50 dark:bg-zinc-900/40 p-2.5 rounded-lg border border-border/50 leading-relaxed truncate font-medium">
                          {lr.reason}
                        </p>

                        <div className="flex justify-between items-center pt-1.5 border-t border-border/50">
                          <span className="text-[11px] text-text-muted font-bold font-mono">
                            Applied: {new Date(lr.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {lr.attachment_path && (
                              <a
                                href={`http://localhost:8000${lr.attachment_path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg border border-border bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-text-secondary shrink-0 transition-colors flex items-center justify-center"
                                title="Download Attachment"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <Button
                              onClick={() => { setSelectedLeave(lr); setShowDetailsModal(true); }}
                              size="xs"
                              variant="outline"
                              className="text-[11px] font-bold h-7 gap-1 px-2 flex items-center"
                            >
                              <Eye className="h-3 w-3" /> Details
                            </Button>
                            {lr.status === 'PENDING' && (
                              <Button
                                onClick={() => { setSelectedLeave(lr); setShowCancelModal(true); }}
                                size="xs"
                                className="bg-rose-50 border-none hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 p-1.5 h-7 w-7 justify-center flex items-center"
                                title="Cancel Request"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Details Dialog */}
      {showDetailsModal && selectedLeave && (
        <Dialog
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          title="Leave Application Details"
          className="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Leave Type</span>
              <span className="col-span-2 text-text-primary font-bold">{selectedLeave.leave_type}</span>
            </div>
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Duration</span>
              <span className="col-span-2 text-text-primary font-semibold">
                {formatDate(selectedLeave.from_date)} to {formatDate(selectedLeave.to_date)}
              </span>
            </div>
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Applied On</span>
              <span className="col-span-2 text-text-primary font-medium">
                {new Date(selectedLeave.created_at).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
              </span>
            </div>
            <div className="grid grid-cols-3 border-b border-border/50 py-2">
              <span className="font-bold text-text-muted uppercase">Status</span>
              <span className="col-span-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${getStatusBadgeStyles(selectedLeave.status)}`}>
                  {selectedLeave.status}
                </span>
              </span>
            </div>
            <div className="space-y-1 py-2">
              <span className="font-bold text-text-muted uppercase block">Reason for Leave</span>
              <p className="text-text-secondary bg-zinc-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-border leading-relaxed break-words font-medium">
                {selectedLeave.reason}
              </p>
            </div>
            {selectedLeave.reject_reason && (
              <div className="space-y-1 py-2 text-rose-600">
                <span className="font-bold text-rose-500 uppercase block">Admin Remarks</span>
                <p className="bg-rose-500/5 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-500/20 leading-relaxed break-words font-bold flex gap-1.5">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{selectedLeave.reject_reason}</span>
                </p>
              </div>
            )}
            <div className="flex justify-end pt-3 border-t border-border mt-4">
              <Button onClick={() => setShowDetailsModal(false)} variant="outline">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Apply Leave Dialog */}
      {showApplyModal && (
        <Dialog
          open={showApplyModal}
          onClose={() => { if (!submitting) setShowApplyModal(false); }}
          title="Apply for Leave"
          className="max-w-md"
        >
          <form onSubmit={handleApplyLeaveSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Leave Type</label>
              <Select
                value={form.leave_type}
                onChange={e => setForm(prev => ({ ...prev, leave_type: e.target.value }))}
                className="text-xs"
              >
                {LEAVE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Start Date</label>
                <Input
                  type="date"
                  className={`text-xs ${formErrors.from_date ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  value={form.from_date}
                  onChange={e => {
                    setForm(prev => ({ ...prev, from_date: e.target.value }));
                    if (formErrors.from_date) setFormErrors(prev => ({ ...prev, from_date: '' }));
                  }}
                />
                {formErrors.from_date && <p className="text-[11px] font-bold text-red-500 mt-0.5">{formErrors.from_date}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">End Date</label>
                <Input
                  type="date"
                  className={`text-xs ${formErrors.to_date ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                  value={form.to_date}
                  onChange={e => {
                    setForm(prev => ({ ...prev, to_date: e.target.value }));
                    if (formErrors.to_date) setFormErrors(prev => ({ ...prev, to_date: '' }));
                  }}
                />
                {formErrors.to_date && <p className="text-[11px] font-bold text-red-500 mt-0.5">{formErrors.to_date}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-text-secondary uppercase">Reason for Leave</label>
                <span className={`text-[11px] font-bold ${wordCount > 100 ? 'text-red-500' : 'text-text-muted'}`}>
                  {wordCount}/100 Words
                </span>
              </div>
              <textarea
                placeholder="Type the reason for your leave request here (max 100 words)..."
                rows={4}
                value={form.reason}
                onChange={handleReasonChange}
                className={`w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary focus:outline-none ${
                  formErrors.reason ? 'border-red-500 focus:ring-red-500' : 'border-border'
                }`}
              />
              {formErrors.reason && <p className="text-[11px] font-bold text-red-500 mt-0.5">{formErrors.reason}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Supporting Document (Optional)</label>
              <div className="border border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-900/10 cursor-pointer relative hover:bg-zinc-50">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                />
                <FileUp className="h-6 w-6 text-text-muted mb-2" />
                <span className="text-xs font-bold text-text-primary">
                  {attachment ? attachment.name : 'Click to Upload Document'}
                </span>
                <span className="text-[11px] text-text-muted mt-1">Accepts PDF, Word, JPEG, PNG (max 5MB)</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                onClick={() => setShowApplyModal(false)}
                variant="outline"
                className="text-xs"
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary text-white border-none hover:bg-primary-hover text-xs"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelModal && selectedLeave && (
        <Dialog
          open={showCancelModal}
          onClose={() => { if (!submitting) setShowCancelModal(false); }}
          title="Cancel Leave Request"
          className="max-w-sm"
        >
          <div className="space-y-4">
            <div className="flex gap-3 text-text-secondary items-start">
              <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Are you sure you want to cancel your leave request from <span className="font-bold">{formatDate(selectedLeave.from_date)}</span> to <span className="font-bold">{formatDate(selectedLeave.to_date)}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                onClick={() => setShowCancelModal(false)} 
                variant="outline" 
                className="text-xs"
                disabled={submitting}
              >
                Go Back
              </Button>
              <Button 
                onClick={handleCancelLeaveConfirm}
                className="bg-rose-600 hover:bg-rose-700 text-white border-none text-xs"
                disabled={submitting}
              >
                {submitting ? 'Cancelling...' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
