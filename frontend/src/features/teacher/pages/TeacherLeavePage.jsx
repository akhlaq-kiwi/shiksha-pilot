import React, { useState, useEffect } from 'react';
import { 
  Calendar, FileText, CheckCircle, XCircle, Clock, Plus, X, Upload, 
  Trash2, Download, Info, AlertTriangle, FileUp 
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

export default function TeacherLeavePage() {
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
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

  const loadOwnLeaves = async () => {
    setLoading(true);
    try {
      // view_type: 'OWN' filters only the logged-in teacher's leaves in the backend
      const data = await schoolService.getLeaveRequests({ view_type: 'OWN' });
      setLeaves(data || []);
    } catch (err) {
      toast.show('error', 'Error', err.message || 'Failed to load your leave history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOwnLeaves();
  }, []);

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
      loadOwnLeaves();
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
      loadOwnLeaves();
    } catch (err) {
      toast.show('error', 'Reversal Failed', err.message || 'Failed to cancel leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20"><Clock className="h-2.5 w-2.5" /> Pending</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><CheckCircle className="h-2.5 w-2.5" /> Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle className="h-2.5 w-2.5" /> Rejected</span>;
      case 'CANCELLED':
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"><X className="h-2.5 w-2.5" /> Cancelled</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-text-primary tracking-tight font-display">Leave Requests</h2>
          <p className="text-xs text-text-muted">Apply for leave and monitor your approval history.</p>
        </div>
        <Button 
          onClick={() => setShowApplyModal(true)} 
          className="bg-primary text-white hover:bg-primary-hover flex items-center gap-1.5 text-xs py-2 px-3 shadow-xs border-none"
        >
          <Plus className="h-4 w-4" /> Apply Leave
        </Button>
      </div>

      {/* Leaves History Grid */}
      <Card className="bg-surface border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">Leave Applications History</h3>
        </div>
        <div className="overflow-x-auto min-h-[200px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-text-muted">Loading your history...</p>
            </div>
          ) : leaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-8 w-8 text-text-muted mb-2" />
              <h4 className="text-xs font-bold text-text-primary">No Leaves Registered</h4>
              <p className="text-[10px] text-text-muted mt-0.5">Click the "Apply Leave" button to submit your first leave application.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-zinc-50/30 dark:bg-zinc-900/30 text-text-muted font-bold">
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaves.map(lr => (
                  <tr key={lr.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10">
                    <td className="p-3">
                      <span className="font-bold text-text-primary">{lr.leave_type}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-text-primary">
                        {new Date(lr.from_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(lr.to_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {Math.ceil((new Date(lr.to_date) - new Date(lr.from_date)) / (1000 * 60 * 60 * 24)) + 1} Days
                      </div>
                    </td>
                    <td className="p-3 max-w-xs truncate" title={lr.reason}>
                      {lr.reason}
                    </td>
                    <td className="p-3">{getStatusBadge(lr.status)}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-2">
                        {lr.attachment_path && (
                          <a
                            href={`http://localhost:8000${lr.attachment_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg border border-border bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-text-secondary"
                            title="Download Attachment"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {lr.status === 'PENDING' && (
                          <Button
                            onClick={() => { setSelectedLeave(lr); setShowCancelModal(true); }}
                            size="xs"
                            className="bg-rose-50 border-none hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 p-1.5 h-8 w-8 justify-center"
                            title="Cancel Request"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
                {formErrors.from_date && <p className="text-[10px] font-bold text-red-500 mt-0.5">{formErrors.from_date}</p>}
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
                {formErrors.to_date && <p className="text-[10px] font-bold text-red-500 mt-0.5">{formErrors.to_date}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-text-secondary uppercase">Reason for Leave</label>
                <span className={`text-[10px] font-bold ${wordCount > 100 ? 'text-red-500' : 'text-text-muted'}`}>
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
              {formErrors.reason && <p className="text-[10px] font-bold text-red-500 mt-0.5">{formErrors.reason}</p>}
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
                <span className="text-[10px] text-text-muted mt-1">Accepts PDF, Word, JPEG, PNG (max 5MB)</span>
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
                Are you sure you want to cancel your leave request from <span className="font-bold">{selectedLeave.from_date}</span> to <span className="font-bold">{selectedLeave.to_date}</span>? This action cannot be undone.
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
