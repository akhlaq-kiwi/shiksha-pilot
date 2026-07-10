import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Eye, Edit2, PhoneCall, CheckCircle, Trash2, Plus, Search, 
  Filter, X, Calendar, DollarSign, User, AlertCircle, FileText, ChevronDown, Check
} from 'lucide-react';
import { schoolService } from '../../../common/services/schoolService';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { useToast } from '../../../common/components/Toast';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';

export default function FeeFollowUpPage() {
  const toast = useToast();
  const { currentYear, academicYears } = useAcademicYear();

  // Listing / Filter States
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    due_today: 0,
    upcoming: 0,
    overdue: 0,
    completed: 0
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total_items: 0,
    page: 1,
    limit: 10,
    total_pages: 1
  });

  // Filters state
  const [filters, setFilters] = useState({
    status: 'ALL',
    class_id: '',
    academic_year_id: currentYear?.id || '',
    start_date: '',
    end_date: '',
    student_search: '',
    parent_mobile: ''
  });

  // Student suggestion lookup
  const [studentsList, setStudentsList] = useState([]);
  const [studentSearchVal, setStudentSearchVal] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentSearchRef = useRef(null);

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add/Edit Form State
  const [form, setForm] = useState({
    student_id: '',
    student_name: '',
    pending_amount: '',
    promised_date: '',
    reason: '',
    reminder_notes: ''
  });

  const [formErrors, setFormErrors] = useState({});

  // 1. Fetch listing and filters on mount / change
  const fetchFollowUps = async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await schoolService.getFeeFollowUps({
        ...filters,
        page: pageNumber,
        limit: pagination.limit
      });
      setItems(res.items || []);
      setStats(res.stats || { pending: 0, due_today: 0, upcoming: 0, overdue: 0, completed: 0 });
      setPagination(res.pagination || { total_items: 0, page: 1, limit: 10, total_pages: 1 });
    } catch (err) {
      console.error(err);
      toast.error('Failed to load fee follow-ups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps(1);
  }, [filters]);

  // Load classes & students for lookups
  useEffect(() => {
    schoolService.getClasses()
      .then(res => setClasses(res || []))
      .catch(console.error);

    schoolService.getStudents({ limit: 1000 })
      .then(res => setStudentsList(res || []))
      .catch(console.error);
  }, []);

  // Update current Academic Year in filters when context loads
  useEffect(() => {
    if (currentYear?.id && !filters.academic_year_id) {
      setFilters(prev => ({ ...prev, academic_year_id: currentYear.id }));
    }
  }, [currentYear]);

  // Handle filter clearing
  const handleClearFilters = () => {
    setFilters({
      status: 'ALL',
      class_id: '',
      academic_year_id: currentYear?.id || '',
      start_date: '',
      end_date: '',
      student_search: '',
      parent_mobile: ''
    });
  };

  // Student Search Suggestions Click outside handler
  useEffect(() => {
    const handleClickOutsideStudent = (e) => {
      if (studentSearchRef.current && !studentSearchRef.current.contains(e.target)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideStudent);
    return () => document.removeEventListener('mousedown', handleClickOutsideStudent);
  }, []);

  // Fetch outstanding fee automatically for chosen student
  const handleStudentSelect = async (student) => {
    setForm(prev => ({
      ...prev,
      student_id: student.id,
      student_name: student.name
    }));
    setStudentSearchVal(student.name);
    setShowStudentDropdown(false);

    try {
      const res = await schoolService.getStudentOutstandingFee(student.id);
      setForm(prev => ({
        ...prev,
        pending_amount: res.outstanding_balance
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Save Add/Edit Followup
  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    setFormErrors({});

    // Validations
    const errors = {};
    if (!form.student_id) errors.student_id = 'Student is required';
    if (!form.promised_date) errors.promised_date = 'Promised date is required';
    if (!form.reason) errors.reason = 'Commitment reason is required';
    if (form.pending_amount === '' || parseFloat(form.pending_amount) < 0) {
      errors.pending_amount = 'Pending Amount cannot be negative';
    }

    const today = new Date().toISOString().split('T')[0];
    if (form.promised_date && form.promised_date <= today) {
      errors.promised_date = 'Date must be in the future';
    }

    if (form.reason && form.reason.length > 500) {
      errors.reason = 'Reason cannot exceed 500 characters';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'add') {
        await schoolService.createFeeFollowUp({
          student_id: form.student_id,
          promised_date: form.promised_date,
          reason: form.reason,
          pending_amount: form.pending_amount,
          reminder_notes: form.reminder_notes
        });
        toast.success('Follow-up saved successfully');
      } else {
        await schoolService.updateFeeFollowUp(selectedItem.id, {
          promised_date: form.promised_date,
          reason: form.reason,
          pending_amount: form.pending_amount,
          reminder_notes: form.reminder_notes
        });
        toast.success('Follow-up updated successfully');
      }
      setShowAddEditModal(false);
      fetchFollowUps(pagination.page);
    } catch (err) {
      console.error(err);
      if (err.fields) {
        setFormErrors(err.fields);
      } else {
        toast.error('Failed to save follow-up');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete follow-up
  const handleDeleteFollowUp = async () => {
    setSubmitting(true);
    try {
      await schoolService.deleteFeeFollowUp(selectedItem.id);
      toast.success('Follow-up deleted successfully');
      setShowDeleteModal(false);
      fetchFollowUps(pagination.page);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Action: Mark as Contacted
  const handleMarkContacted = async (item) => {
    try {
      await schoolService.markFollowUpContacted(item.id, { comment: 'Contacted parent.' });
      toast.success('Marked parent as contacted.');
      fetchFollowUps(pagination.page);
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark contacted');
    }
  };

  // Submit Note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      await schoolService.addFollowUpNote(selectedItem.id, { comment: newNote });
      setNewNote('');
      // Reload details to show updated logs
      const updated = await schoolService.getFeeFollowUpDetails(selectedItem.id);
      setSelectedItem(updated);
      toast.success('Note added successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add note');
    }
  };

  // Export CSV Reports
  const handleExportReport = () => {
    const headers = ["Student Name", "Admission Number", "Class", "Parent Name", "Mobile Number", "Pending Amount", "Promised Payment Date", "Status", "Created By", "Created On"];
    const rows = items.map(item => [
      item.student_name,
      item.admission_no,
      item.class_name || '-',
      item.parent_name || '-',
      item.mobile_number || '-',
      item.pending_amount,
      item.promised_date,
      item.status,
      item.creator_name || '-',
      new Date(item.created_at).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Fee_FollowUps_Report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export PDF Report
  const handleExportPDF = () => {
    const element = document.getElementById('followup-report-area');
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `Fee_Followups_Report_${new Date().toISOString().slice(0,10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    
    // Set loading indicator
    toast.info('Generating PDF report...');
    window.html2pdf().from(element).set(opt).save()
      .then(() => toast.success('PDF exported successfully'))
      .catch(() => toast.error('Failed to generate PDF'));
  };

  // Badge Status Mappings
  const getStatusBadge = (status) => {
    let classes = "";
    switch(status) {
      case 'PENDING':
        classes = "bg-blue-500/10 text-blue-600";
        break;
      case 'DUE_TODAY':
        classes = "bg-orange-500/10 text-orange-600";
        break;
      case 'OVERDUE':
        classes = "bg-red-500/10 text-red-600";
        break;
      case 'COMPLETED':
        classes = "bg-emerald-500/10 text-emerald-600";
        break;
      default:
        classes = "bg-gray-500/10 text-gray-600";
    }
    return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${classes}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-black text-text-primary tracking-tight font-display">Fee Follow-ups</h2>
          <p className="text-xs text-text-secondary mt-1 font-medium">Track and manage future payment commitments from parents.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              setModalMode('add');
              setForm({
                student_id: '',
                student_name: '',
                pending_amount: '',
                promised_date: '',
                reason: '',
                reminder_notes: ''
              });
              setStudentSearchVal('');
              setFormErrors({});
              setShowAddEditModal(true);
            }} 
            className="flex items-center gap-1.5 font-bold text-xs shadow-xs"
          >
            <Plus className="h-4 w-4" /> Add Follow-up
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportReport}
            className="flex items-center gap-1.5 font-bold text-xs text-text-primary border-border bg-surface hover:bg-hover"
          >
            Export Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 font-bold text-xs text-text-primary border-border bg-surface hover:bg-hover"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Pending Follow-ups', count: stats.pending, color: 'text-blue-600 bg-blue-500/10' },
          { label: 'Due Today', count: stats.due_today, color: 'text-orange-600 bg-orange-500/10' },
          { label: 'Upcoming', count: stats.upcoming, color: 'text-purple-600 bg-purple-500/10' },
          { label: 'Overdue', count: stats.overdue, color: 'text-red-600 bg-red-500/10 animate-pulse' },
          { label: 'Completed', count: stats.completed, color: 'text-emerald-600 bg-emerald-500/10' }
        ].map((c, i) => (
          <Card key={i} className="shadow-2xs border border-border bg-surface">
            <CardContent className="p-4 flex flex-col justify-between h-24">
              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">{c.label}</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-text-primary font-display">{c.count}</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${c.color}`}>{c.count}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Section */}
      <Card className="shadow-2xs border border-border bg-surface p-4">
        <CardContent className="p-0 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Filters
            </span>
            <button 
              onClick={handleClearFilters}
              className="text-[10px] text-primary hover:underline font-bold"
            >
              Clear Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Status</label>
              <select
                value={filters.status}
                onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg p-2 text-xs font-semibold focus:outline-hidden text-text-primary"
              >
                <option value="ALL">All Commitments</option>
                <option value="PENDING">Pending</option>
                <option value="DUE_TODAY">Due Today</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="OVERDUE">Overdue</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* Class Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Class</label>
              <select
                value={filters.class_id}
                onChange={e => setFilters(prev => ({ ...prev, class_id: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg p-2 text-xs font-semibold focus:outline-hidden text-text-primary"
              >
                <option value="">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.section ? `- ${c.section}` : ''}</option>
                ))}
              </select>
            </div>

            {/* Academic Year Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Academic Year</label>
              <select
                value={filters.academic_year_id}
                onChange={e => setFilters(prev => ({ ...prev, academic_year_id: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg p-2 text-xs font-semibold focus:outline-hidden text-text-primary"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.name} {y.status === 'ACTIVE' ? '(Current)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Date Range Start */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Promised From Date</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={e => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full text-xs font-semibold text-text-primary p-2 border border-border rounded-lg bg-surface focus:outline-hidden"
              />
            </div>

            {/* Date Range End */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Promised To Date</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={e => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full text-xs font-semibold text-text-primary p-2 border border-border rounded-lg bg-surface focus:outline-hidden"
              />
            </div>

            {/* Student Search */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Student Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  type="text"
                  placeholder="Search student or admission no..."
                  value={filters.student_search}
                  onChange={e => setFilters(prev => ({ ...prev, student_search: e.target.value }))}
                  className="pl-8 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
                />
              </div>
            </div>

            {/* Parent Mobile Search */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Parent Mobile</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  type="text"
                  placeholder="Mobile number..."
                  value={filters.parent_mobile}
                  onChange={e => setFilters(prev => ({ ...prev, parent_mobile: e.target.value }))}
                  className="pl-8 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
                />
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Main Listing Grid */}
      <Card className="shadow-2xs border border-border bg-surface overflow-hidden">
        <CardContent className="p-0">
          
          <div id="followup-report-area" className="overflow-x-auto w-full bg-surface p-4">
            <div className="hidden pdf-only flex justify-between items-center border-b border-border pb-4 mb-4">
              <div>
                <h1 className="text-lg font-black text-black">Fee Follow-ups Report</h1>
                <p className="text-xs text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
              </div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Shiksha Pilot</span>
            </div>
            
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Adm. No</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Parent Name</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4 text-right">Pending Amount</th>
                  <th className="py-3 px-4">Promise Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4 text-center select-none no-pdf">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-text-muted font-medium">
                      No follow-up records found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-hover transition-colors font-medium text-text-secondary">
                      <td className="py-3.5 px-4 font-bold text-text-primary">{item.student_name}</td>
                      <td className="py-3.5 px-4 font-mono">{item.admission_no}</td>
                      <td className="py-3.5 px-4 text-text-primary uppercase font-bold">{item.class_name || '-'}</td>
                      <td className="py-3.5 px-4">{item.parent_name || '-'}</td>
                      <td className="py-3.5 px-4 font-mono">{item.mobile_number || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                        ₹{number_format(item.pending_amount, 2)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-text-primary">
                        {new Date(item.promised_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3.5 px-4 text-[11px]">{item.creator_name || '-'}</td>
                      <td className="py-3.5 px-4 flex items-center justify-center gap-1.5 select-none no-pdf">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="View Details"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDetailsModal(true);
                          }}
                          className="h-7 w-7 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {item.status !== 'COMPLETED' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Edit Followup"
                              onClick={() => {
                                setSelectedItem(item);
                                setModalMode('edit');
                                setForm({
                                  student_id: item.student_id,
                                  student_name: item.student_name,
                                  pending_amount: item.pending_amount,
                                  promised_date: item.promised_date,
                                  reason: item.reason,
                                  reminder_notes: item.reminder_notes || ''
                                });
                                setStudentSearchVal(item.student_name);
                                setFormErrors({});
                                setShowAddEditModal(true);
                              }}
                              className="h-7 w-7 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Mark Contacted"
                              onClick={() => handleMarkContacted(item)}
                              className="h-7 w-7 text-text-secondary hover:text-orange-600 hover:bg-orange-500/10 rounded-lg"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Delete Record"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDeleteModal(true);
                          }}
                          className="h-7 w-7 text-text-secondary hover:text-red-600 hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination.total_pages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between text-xs font-semibold text-text-secondary bg-surface select-none">
              <span>Showing Page <strong className="text-text-primary">{pagination.page}</strong> of <strong className="text-text-primary">{pagination.total_pages}</strong></span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => fetchFollowUps(pagination.page - 1)}
                  className="px-3 py-1 font-bold text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.total_pages || loading}
                  onClick={() => fetchFollowUps(pagination.page + 1)}
                  className="px-3 py-1 font-bold text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ADD / EDIT FOLLOW-UP MODAL */}
      {showAddEditModal && (
        <Dialog
          isOpen={showAddEditModal}
          title={modalMode === 'add' ? 'Create Payment Commitment' : 'Edit Commitment Details'}
          onClose={() => setShowAddEditModal(false)}
        >
          <form onSubmit={handleSaveFollowUp} className="space-y-4 text-xs font-medium text-text-secondary max-w-md">
            
            {/* Student Searchable Picker */}
            <div className="space-y-1.5 relative" ref={studentSearchRef}>
              <label className="text-[10px] text-text-secondary font-bold uppercase">Select Student *</label>
              {modalMode === 'add' ? (
                <>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                    <Input
                      type="text"
                      placeholder="Type student name to search..."
                      value={studentSearchVal}
                      onChange={e => {
                        setStudentSearchVal(e.target.value);
                        setShowStudentDropdown(true);
                        setForm(prev => ({ ...prev, student_id: '' }));
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      className="pl-8 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
                    />
                  </div>
                  {showStudentDropdown && studentSearchVal.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded-xl shadow-lg z-50">
                      {studentsList
                        .filter(s => 
                          (s.name && s.name.toLowerCase().includes(studentSearchVal.toLowerCase())) || 
                          (s.admission_no && s.admission_no.toLowerCase().includes(studentSearchVal.toLowerCase()))
                        )
                        .slice(0, 10)
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => handleStudentSelect(s)}
                            className="p-2.5 hover:bg-hover cursor-pointer transition-colors text-left flex items-center justify-between border-b last:border-0 border-border"
                          >
                            <div>
                              <div className="font-bold text-text-primary text-xs">{s.name}</div>
                              <div className="text-[10px] text-text-muted mt-0.5">Adm. No: {s.admission_no} | Class: {s.class_name}</div>
                            </div>
                            <ChevronDown className="h-3 w-3 text-text-muted -rotate-90" />
                          </div>
                        ))}
                      {studentsList.filter(s => s.name.toLowerCase().includes(studentSearchVal.toLowerCase())).length === 0 && (
                        <div className="p-4 text-center text-text-muted text-xs">No matching students found</div>
                      )}
                    </div>
                  )}
                  {formErrors.student_id && <p className="text-red-600 text-[10px] font-bold">{formErrors.student_id}</p>}
                </>
              ) : (
                <div className="p-2 bg-hover rounded-lg border border-border text-xs text-text-primary font-bold">
                  {form.student_name}
                </div>
              )}
            </div>

            {/* Pending Amount */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Pending Amount (₹) *</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.pending_amount}
                  onChange={e => setForm(prev => ({ ...prev, pending_amount: e.target.value }))}
                  className="pl-8 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
                />
              </div>
              <p className="text-[9px] text-text-muted leading-relaxed">Auto-fetched from student outstanding dues; editable if required.</p>
              {formErrors.pending_amount && <p className="text-red-600 text-[10px] font-bold">{formErrors.pending_amount}</p>}
            </div>

            {/* Promised Payment Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Promised Payment Date *</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  type="date"
                  value={form.promised_date}
                  onChange={e => setForm(prev => ({ ...prev, promised_date: e.target.value }))}
                  className="pl-8 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
                />
              </div>
              {formErrors.promised_date && <p className="text-red-600 text-[10px] font-bold">{formErrors.promised_date}</p>}
            </div>

            {/* Commitment Reason */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Reason / Commitment Notes *</label>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Examples: Salary delayed, cheque clearing, family emergency..."
                value={form.reason}
                onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full border border-border bg-surface rounded-lg p-2.5 text-xs text-text-primary font-semibold focus:outline-hidden focus:border-primary resize-y"
              />
              <div className="flex items-center justify-between text-[9px] text-text-muted">
                <span>Maximum 500 characters</span>
                <span>{form.reason.length}/500</span>
              </div>
              {formErrors.reason && <p className="text-red-600 text-[10px] font-bold">{formErrors.reason}</p>}
            </div>

            {/* Reminder Notes */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase">Internal Reminder Notes (Optional)</label>
              <Input
                type="text"
                placeholder="Call next Monday morning..."
                value={form.reminder_notes}
                onChange={e => setForm(prev => ({ ...prev, reminder_notes: e.target.value }))}
                className="text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-2 select-none">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddEditModal(false)}
                className="font-bold text-xs hover:bg-hover px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="font-bold text-xs px-4 py-2 shadow-xs"
              >
                {submitting ? 'Saving...' : 'Save Follow-up'}
              </Button>
            </div>

          </form>
        </Dialog>
      )}

      {/* VIEW DETAILS & NOTES HISTORY TIMELINE MODAL */}
      {showDetailsModal && selectedItem && (
        <Dialog
          isOpen={showDetailsModal}
          title="Payment Commitment Details"
          onClose={() => setShowDetailsModal(false)}
        >
          <div className="space-y-6 text-xs text-text-secondary max-w-lg">
            
            {/* Top Cards grid */}
            <div className="grid grid-cols-2 gap-4 bg-hover/50 p-3.5 rounded-xl border border-border">
              <div>
                <span className="text-[9px] text-text-muted uppercase font-bold block">Student</span>
                <span className="font-extrabold text-text-primary text-sm mt-0.5 block">{selectedItem.student_name}</span>
                <span className="text-[10px] text-text-muted mt-0.5 block">Adm: {selectedItem.admission_no} | Class {selectedItem.class_name}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-text-muted uppercase font-bold block">Status</span>
                <span className="inline-block mt-1">{getStatusBadge(selectedItem.status)}</span>
              </div>
              <div>
                <span className="text-[9px] text-text-muted uppercase font-bold block">Pending Amount</span>
                <span className="font-black text-text-primary font-mono text-sm mt-0.5 block">₹{number_format(selectedItem.pending_amount, 2)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-text-muted uppercase font-bold block">Promise Date</span>
                <span className="font-bold text-text-primary text-xs mt-1 block">
                  {new Date(selectedItem.promised_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Commitment Details */}
            <div className="space-y-2 border-b border-border pb-4">
              <div>
                <span className="text-[9px] text-text-muted uppercase font-bold block">Parent / Mobile</span>
                <span className="font-bold text-text-primary text-xs block">{selectedItem.parent_name || '-'} (Mobile: {selectedItem.mobile_number || '-'})</span>
              </div>
              <div>
                <span className="text-[9px] text-text-muted uppercase font-bold block">Commitment Reason</span>
                <p className="text-text-primary text-xs italic leading-relaxed pt-0.5 whitespace-pre-line">{selectedItem.reason}</p>
              </div>
              {selectedItem.reminder_notes && (
                <div>
                  <span className="text-[9px] text-text-muted uppercase font-bold block">Reminder Notes</span>
                  <p className="text-text-primary text-xs leading-relaxed pt-0.5">{selectedItem.reminder_notes}</p>
                </div>
              )}
            </div>

            {/* Notes history timeline */}
            <div className="space-y-4">
              <span className="text-[10px] text-text-primary font-extrabold uppercase tracking-wider block">Follow-up Activity Logs</span>
              
              <div className="max-h-48 overflow-y-auto space-y-3.5 pl-3 border-l border-border ml-1.5 mt-2">
                {selectedItem.notes && selectedItem.notes.length === 0 ? (
                  <p className="text-text-muted text-[11px] italic pl-2">No custom activity logs yet.</p>
                ) : (
                  selectedItem.notes?.map((note, idx) => (
                    <div key={idx} className="relative space-y-0.5">
                      <span className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-primary border-2 border-surface" />
                      <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
                        <span>{note.user_name}</span>
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-text-primary text-[11px] whitespace-pre-line font-medium leading-relaxed">
                        {note.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Form */}
              {selectedItem.status !== 'COMPLETED' && (
                <form onSubmit={handleAddNote} className="flex gap-2 pt-2 border-t border-border select-none">
                  <Input
                    type="text"
                    placeholder="Add activity note e.g. parent called, promised 2 more days..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    className="flex-1 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg focus:outline-hidden"
                  />
                  <Button
                    type="submit"
                    className="font-bold text-xs px-3 shadow-xs"
                  >
                    Add Note
                  </Button>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-border pt-4 mt-2 select-none">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
                className="font-bold text-xs border-border bg-surface px-4 py-2 hover:bg-hover"
              >
                Close
              </Button>
            </div>

          </div>
        </Dialog>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && selectedItem && (
        <Dialog
          isOpen={showDeleteModal}
          title="Delete Follow-up commitment"
          onClose={() => setShowDeleteModal(false)}
        >
          <div className="space-y-4 max-w-sm text-xs font-medium text-text-secondary">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-text-primary text-sm">Delete this follow-up?</h4>
                <p className="leading-relaxed text-text-muted">
                  Are you sure you want to delete payment follow-up for <strong className="text-text-primary">{selectedItem.student_name}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4 mt-2 select-none">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
                className="font-bold text-xs hover:bg-hover px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleDeleteFollowUp}
                className="font-bold text-xs bg-red-600 hover:bg-red-700 text-white border-transparent px-4 shadow-xs"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

    </div>
  );
}

// Helpers
function number_format(number, decimals) {
  const n = !isFinite(+number) ? 0 : +number;
  const prec = !isFinite(+decimals) ? 0 : Math.abs(decimals);
  const toFixedFix = function(n, prec) {
    const k = Math.pow(10, prec);
    return '' + Math.round(n * k) / k;
  };
  const s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
  if (s[0].length > 3) {
    s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, ',');
  }
  if ((s[1] || '').length < prec) {
    s[1] = s[1] || '';
    s[1] += new Array(prec - s[1].length + 1).join('0');
  }
  return s.join('.');
}
