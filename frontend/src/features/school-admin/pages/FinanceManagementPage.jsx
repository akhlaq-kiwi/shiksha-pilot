import React, { useState, useEffect, useRef } from 'react';
import { Landmark, Plus, Search, Calendar, Clock, Eye, Edit, Trash2, MoreVertical, X, AlertTriangle, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatDateFull = (dateStr) => {
  if (!dateStr) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const ACADEMIC_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

export default function FinanceManagementPage() {
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'additional-fee'
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status notifications
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Expenses Tab State & Filters
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  
  // Expenses Lazy Loading
  const [visibleExpensesCount, setVisibleExpensesCount] = useState(25);
  const [isFetchingMoreExpenses, setIsFetchingMoreExpenses] = useState(false);
  const expensesContainerRef = useRef(null);

  // Additional Fee Tab State & Filters
  const [feeSearch, setFeeSearch] = useState('');
  const [selectedFeeClassId, setSelectedFeeClassId] = useState('ALL');
  const [selectedFeeStatus, setSelectedFeeStatus] = useState('ALL');

  // Additional Fee Lazy Loading
  const [visibleFeesCount, setVisibleFeesCount] = useState(25);
  const [isFetchingMoreFees, setIsFetchingMoreFees] = useState(false);
  const feesContainerRef = useRef(null);

  // Three-dot Action Dropdowns State
  const [activeExpenseDropdownId, setActiveExpenseDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  // Dialog Modals State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null); // null = add mode
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // View Expense Modal
  const [viewingExpense, setViewingExpense] = useState(null);

  // Delete Expense Confirmation
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);

  // Apply Additional Fee Form State
  const [isApplyFeeModalOpen, setIsApplyFeeModalOpen] = useState(false);
  const [applyType, setApplyType] = useState('school'); // 'school' | 'classes'
  const [feeDescription, setFeeDescription] = useState('');
  const [feeSchoolAmount, setFeeSchoolAmount] = useState('');
  const [classAmountsMap, setClassAmountsMap] = useState({}); // classId => amount string
  const [feeDueDate, setFeeDueDate] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsList, ayList, paymentsList] = await Promise.all([
        schoolService.getClasses(),
        schoolService.getAcademicYears(),
        schoolService.getAdditionalFeePayments()
      ]);
      setClasses(clsList || []);
      setAcademicYears(ayList || []);
      setFeePayments(paymentsList || []);

      // Fetch expenses
      await loadExpensesList();
    } catch (err) {
      console.error(err);
      setError('Failed to fetch finance records.');
    } finally {
      setLoading(false);
    }
  };

  const loadExpensesList = async () => {
    try {
      const expensesList = await schoolService.getSchoolExpenses({
        search: expenseSearch,
        month: selectedMonth
      });
      setExpenses(expensesList || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reload expenses list when filters trigger changes
  useEffect(() => {
    loadExpensesList();
    setVisibleExpensesCount(25);
    if (expensesContainerRef.current) {
      expensesContainerRef.current.scrollTop = 0;
    }
  }, [expenseSearch, selectedMonth]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveExpenseDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleExpenseModalOpen = (expenseToEdit = null) => {
    setError('');
    setSuccess('');
    setActiveExpenseDropdownId(null);

    if (expenseToEdit) {
      if (expenseToEdit.is_locked) {
        alert('This expense has already been included in a generated financial report and can no longer be modified.');
        return;
      }
      setEditingExpense(expenseToEdit);
      setExpenseDesc(expenseToEdit.description || '');
      setExpenseAmount(expenseToEdit.amount || '');
      setExpenseDate(expenseToEdit.expense_date || '');
    } else {
      setEditingExpense(null);
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
    }
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount || !expenseDate) {
      alert('Please fill in all mandatory fields.');
      return;
    }
    if (parseFloat(expenseAmount) <= 0) {
      alert('Amount must be positive.');
      return;
    }

    setExpenseSubmitting(true);
    setError('');
    setSuccess('');

    const payload = {
      description: expenseDesc.trim(),
      amount: parseFloat(expenseAmount),
      expense_date: expenseDate
    };

    try {
      if (editingExpense) {
        const updated = await schoolService.updateSchoolExpense(editingExpense.id, payload);
        setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? updated : exp));
        setSuccess('Expense updated successfully.');
      } else {
        const added = await schoolService.createSchoolExpense(payload);
        setExpenses(prev => [added, ...prev]);
        setSuccess('Expense recorded successfully.');
      }
      setIsExpenseModalOpen(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save expense entry.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpenseClick = (exp) => {
    setActiveExpenseDropdownId(null);
    if (exp.is_locked) {
      alert('This expense has already been included in a generated financial report and can no longer be modified.');
      return;
    }
    setDeletingExpenseId(exp.id);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    setError('');
    setSuccess('');
    try {
      await schoolService.deleteSchoolExpense(deletingExpenseId);
      setExpenses(prev => prev.filter(exp => exp.id !== deletingExpenseId));
      setSuccess('Expense deleted successfully.');
      setDeletingExpenseId(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete expense.');
      setDeletingExpenseId(null);
    }
  };

  const handleApplyFeeModalOpen = () => {
    setError('');
    setSuccess('');
    setFeeDescription('');
    setFeeSchoolAmount('');
    
    // Auto-populate all classes map to empty string amounts
    const initialMap = {};
    classes.forEach(c => {
      initialMap[c.id] = '';
    });
    setClassAmountsMap(initialMap);

    setFeeDueDate('');
    setApplyType('school');
    setIsApplyFeeModalOpen(true);
  };

  const handleApplyAdditionalFee = async (e) => {
    e.preventDefault();
    if (!feeDescription.trim() || !feeDueDate) {
      alert('Please fill in all mandatory fields.');
      return;
    }

    setFeeSubmitting(true);
    setError('');
    setSuccess('');

    const payload = {
      name: feeDescription.trim(),
      due_date: feeDueDate,
      // Default placeholder effective date to today since we removed it
      effective_date: new Date().toISOString().split('T')[0],
      apply_type: applyType
    };

    if (applyType === 'school') {
      if (!feeSchoolAmount || parseFloat(feeSchoolAmount) <= 0) {
        alert('Amount is mandatory and must be greater than 0.');
        setFeeSubmitting(false);
        return;
      }
      payload.amount = parseFloat(feeSchoolAmount);
    } else {
      // Find entered class amounts > 0
      const activeClassAmounts = {};
      let hasPositive = false;
      Object.keys(classAmountsMap).forEach(classId => {
        const val = classAmountsMap[classId];
        if (val && val.trim() !== '') {
          const amt = parseFloat(val);
          if (amt > 0) {
            activeClassAmounts[classId] = amt;
            hasPositive = true;
          } else if (amt <= 0) {
            alert('Class fee amounts must be greater than zero.');
            setFeeSubmitting(false);
            return;
          }
        }
      });

      if (!hasPositive) {
        alert('At least one class amount greater than zero is required.');
        setFeeSubmitting(false);
        return;
      }
      payload.class_amounts = activeClassAmounts;
    }

    try {
      const result = await schoolService.createAdditionalFeeType(payload);
      setSuccess(`Fee successfully applied to ${result.assigned_count} active students.`);
      setIsApplyFeeModalOpen(false);
      
      const paymentsList = await schoolService.getAdditionalFeePayments();
      setFeePayments(paymentsList || []);
      
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      if (err.message && err.message.toLowerCase().includes('already been applied')) {
        setError('This additional fee has already been applied to the selected students.');
      } else {
        setError(err.message || 'Failed to apply additional fee.');
      }
    } finally {
      setFeeSubmitting(false);
    }
  };

  const handleExpensesScroll = (e) => {
    if (isFetchingMoreExpenses) return;
    const target = e.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      if (visibleExpensesCount < expenses.length) {
        setIsFetchingMoreExpenses(true);
        setTimeout(() => {
          setVisibleExpensesCount(prev => prev + 25);
          setIsFetchingMoreExpenses(false);
        }, 450);
      }
    }
  };

  const handleFeesScroll = (e) => {
    if (isFetchingMoreFees) return;
    const target = e.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      if (visibleFeesCount < filteredFeePayments.length) {
        setIsFetchingMoreFees(true);
        setTimeout(() => {
          setVisibleFeesCount(prev => prev + 25);
          setIsFetchingMoreFees(false);
        }, 450);
      }
    }
  };

  // Filter Fee Payments List
  const filteredFeePayments = feePayments.filter(p => {
    const term = feeSearch.toLowerCase().trim();
    const matchesSearch = !term || 
      (p.student_name && p.student_name.toLowerCase().includes(term)) ||
      (p.fee_name && p.fee_name.toLowerCase().includes(term));
    const matchesClass = selectedFeeClassId === 'ALL' || String(p.class_id) === String(selectedFeeClassId);
    const matchesStatus = selectedFeeStatus === 'ALL' || p.status === selectedFeeStatus;
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  const paginatedExpenses = expenses.slice(0, visibleExpensesCount);
  const paginatedFees = filteredFeePayments.slice(0, visibleFeesCount);

  // Compute dynamic monthly totals for expenses listing
  const filteredTotalExpensesAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 max-h-[82vh] md:max-h-[85vh] animate-in fade-in duration-300">
      
      {/* Page Header (Fixed) */}
      <div className="flex-shrink-0 bg-surface border border-border p-6 rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Finance Management</h2>
              <p className="text-text-secondary text-xs mt-1">Record daily school operational expenses and manage student non-tuition fees ledger payouts.</p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border mt-6">
          <button 
            onClick={() => { setActiveTab('expenses'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'expenses' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            💸 Expenses
          </button>
          <button 
            onClick={() => { setActiveTab('additional-fee'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'additional-fee' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            🏷️ Additional Fee
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold flex-shrink-0">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold flex-shrink-0">
          {success}
        </div>
      )}

      {/* LOADING SPINNER */}
      {loading && (
        <div className="flex-1 flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Tab 1: Expenses View */}
      {!loading && activeTab === 'expenses' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          
          {/* Header row with search, month filter, and Add Expense button */}
          <div className="flex-shrink-0 bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="text-[10px] text-text-muted font-black uppercase tracking-wider">Total Expenses for Selected Month</span>
                <p className="text-xl font-black text-red-500 font-sans mt-0.5">{formatCurrency(filteredTotalExpensesAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <Input 
                  placeholder="Search by Description..." 
                  value={expenseSearch} 
                  onChange={e => setExpenseSearch(e.target.value)} 
                  className="text-xs"
                />
              </div>

              <div>
                <Select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="text-xs cursor-pointer"
                >
                  <option value="ALL">All Months</option>
                  {ACADEMIC_MONTHS.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                </Select>
              </div>

              <div className="flex justify-end">
                <Button 
                  className="w-full md:w-auto font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                  onClick={() => handleExpenseModalOpen(null)}
                >
                  <Plus className="h-4 w-4" /> Add Expense
                </Button>
              </div>
            </div>
          </div>

          {/* Table Listing Area */}
          <div 
            ref={expensesContainerRef}
            onScroll={handleExpensesScroll}
            className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs relative"
          >
            {expenses.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-xs font-bold leading-relaxed">
                No expense entries logged.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border shadow-3xs">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Description</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Expense Date</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Amount</TableHead>
                      <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary bg-surface w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs font-semibold text-text-primary py-3.5 max-w-[300px] truncate">{e.description}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-text-secondary py-3.5 whitespace-nowrap">{formatDateFull(e.expense_date)}</TableCell>
                        <TableCell className="text-xs font-extrabold font-sans text-red-500 py-3.5">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-right py-3.5 relative">
                          <button 
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setActiveExpenseDropdownId(activeExpenseDropdownId === e.id ? null : e.id);
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-all"
                          >
                            <MoreVertical className="h-4 w-4 text-text-muted" />
                          </button>

                          {/* Dropdown Menu Overlay */}
                          {activeExpenseDropdownId === e.id && (
                            <div 
                              ref={dropdownRef}
                              className="absolute right-4 top-10 w-32 bg-surface border border-border shadow-md rounded-xl py-1.5 z-20 text-left text-xs text-text-primary animate-in fade-in duration-100"
                            >
                              <button 
                                onClick={() => { setViewingExpense(e); setActiveExpenseDropdownId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 font-semibold"
                              >
                                <Eye className="h-3.5 w-3.5 text-text-muted" /> View Details
                              </button>
                              
                              {e.is_locked ? (
                                <div className="px-3 py-1.5 text-text-muted font-bold italic border-t border-border flex flex-col">
                                  <span className="text-[9px] uppercase tracking-wider text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Locked</span>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleExpenseModalOpen(e)}
                                    className="w-full px-3 py-1.5 hover:bg-zinc-50 border-t border-border flex items-center gap-1.5 font-semibold text-zinc-700"
                                  >
                                    <Edit className="h-3.5 w-3.5 text-text-muted" /> Edit
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteExpenseClick(e)}
                                    className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 font-semibold text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-400" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {isFetchingMoreExpenses && (
                  <div className="py-4 flex flex-col items-center justify-center gap-2 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Loading more expenses...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Additional Fee View */}
      {!loading && activeTab === 'additional-fee' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in duration-200">
          
          {/* Header Row consistent with Expenses */}
          <div className="flex-shrink-0 bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              <div>
                <Input 
                  placeholder="Search by Student or Fee..." 
                  value={feeSearch} 
                  onChange={e => setFeeSearch(e.target.value)} 
                  className="text-xs"
                />
              </div>

              <div>
                <Select 
                  value={selectedFeeClassId} 
                  onChange={e => setSelectedFeeClassId(e.target.value)}
                  className="text-xs cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Select 
                  value={selectedFeeStatus} 
                  onChange={e => setSelectedFeeStatus(e.target.value)}
                  className="text-xs cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button 
                  className="w-full md:w-auto font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                  onClick={handleApplyFeeModalOpen}
                >
                  <Plus className="h-4 w-4" /> Apply Additional Fee
                </Button>
              </div>
            </div>
          </div>

          {/* Student Ledger Grid */}
          <div 
            ref={feesContainerRef}
            onScroll={handleFeesScroll}
            className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs"
          >
            {filteredFeePayments.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-xs font-bold leading-relaxed">
                No ledger records found matching the filters.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border shadow-3xs">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Student Name</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Class</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Fee Description</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Amount</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Status</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Due Date</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Payment Date</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Academic Year</TableHead>
                      <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary bg-surface">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFees.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-text-primary text-xs truncate max-w-[120px] py-3.5">{p.student_name}</TableCell>
                        <TableCell className="text-xs text-text-muted font-bold uppercase py-3.5">{p.class_name}</TableCell>
                        <TableCell className="text-xs text-text-secondary font-bold py-3.5">{p.fee_name}</TableCell>
                        <TableCell className="text-xs text-text-primary font-bold font-sans py-3.5">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                            p.status === 'Paid'
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                          }`}>
                            {p.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-text-muted font-mono whitespace-nowrap py-3.5">{formatDateFull(p.due_date)}</TableCell>
                        <TableCell className="text-xs text-text-muted font-mono whitespace-nowrap py-3.5">{p.payment_date ? formatDateFull(p.payment_date) : '—'}</TableCell>
                        <TableCell className="text-xs text-text-muted font-bold font-mono py-3.5">{p.academic_year_name || '—'}</TableCell>
                        <TableCell className="text-right py-3.5">
                          {p.status === 'Pending' ? (
                            <Button 
                              size="xs"
                              onClick={() => handleCollectPayment(p.id)}
                              className="bg-green-600 hover:bg-green-700 text-white font-bold text-[9px] px-2.5 py-1 flex items-center gap-1 rounded ml-auto leading-none h-[22px]"
                            >
                              <Check className="h-3 w-3" /> Collect Payment
                            </Button>
                          ) : (
                            <span className="text-[10px] text-green-600 font-black uppercase tracking-wider flex justify-end">Paid</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {isFetchingMoreFees && (
                  <div className="py-4 flex flex-col items-center justify-center gap-2 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Loading more entries...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Record/Edit Expense Dialog */}
      <Dialog 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? "Edit Expense Entry" : "Record Expense"}
        description={editingExpense ? "Modify recorded transaction details." : "Log operational business payments."}
        footer={<>
          <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveExpense} disabled={expenseSubmitting}>{expenseSubmitting ? 'Saving...' : 'Save Entry'}</Button>
        </>}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description *</label>
            <Input 
              placeholder="e.g. Electricity bill June" 
              value={expenseDesc} 
              onChange={e => setExpenseDesc(e.target.value)} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹) *</label>
              <Input 
                type="number" 
                placeholder="Rupees" 
                value={expenseAmount} 
                onChange={e => setExpenseAmount(e.target.value)} 
                required 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Expense Date *</label>
              <Input 
                type="date" 
                value={expenseDate} 
                onChange={e => setExpenseDate(e.target.value)} 
                onKeyDown={e => e.preventDefault()}
                required 
              />
            </div>
          </div>
        </form>
      </Dialog>

      {/* View Expense Detail Modal */}
      <Dialog 
        isOpen={viewingExpense !== null} 
        onClose={() => setViewingExpense(null)}
        title="Expense Receipt Information"
        description="Detailed ledger transaction voucher for school audits."
        footer={<Button onClick={() => setViewingExpense(null)}>Dismiss</Button>}
      >
        {viewingExpense && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] text-text-muted font-black uppercase tracking-wider">Expense Amount</span>
                <p className="text-xl font-black text-red-500 font-sans mt-0.5">{formatCurrency(viewingExpense.amount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">Expense Date</p>
                <p className="font-semibold mt-0.5 text-text-primary">{formatDateFull(viewingExpense.expense_date)}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">Recorded By</p>
                <p className="font-semibold mt-0.5 text-text-primary uppercase">{viewingExpense.creator_name || 'System Admin'}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">Description</p>
              <p className="font-semibold mt-1 text-text-primary bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-lg border border-border leading-relaxed text-justify">
                {viewingExpense.description}
              </p>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Expense Confirmation */}
      <Dialog
        isOpen={deletingExpenseId !== null}
        onClose={() => setDeletingExpenseId(null)}
        title="Delete Expense Transaction"
        description="Verify transaction voucher reversal."
        footer={<>
          <Button variant="secondary" onClick={() => setDeletingExpenseId(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteExpense}>Delete</Button>
        </>}
      >
        <div className="text-xs text-text-secondary leading-relaxed py-2">
          Delete this expense? <br/>
          <strong className="text-red-500 font-extrabold">This action cannot be undone.</strong>
        </div>
      </Dialog>

      {/* Apply Additional Fee Modal */}
      <Dialog
        isOpen={isApplyFeeModalOpen}
        onClose={() => setIsApplyFeeModalOpen(false)}
        title="Apply Additional Fee"
        description="Assign custom school fees to specific classes or whole school."
        footer={<>
          <Button variant="secondary" onClick={() => setIsApplyFeeModalOpen(false)}>Cancel</Button>
          <Button onClick={handleApplyAdditionalFee} disabled={feeSubmitting}>{feeSubmitting ? 'Applying...' : 'Apply Fee'}</Button>
        </>}
        className="w-[95vw] md:max-w-xl"
      >
        <form onSubmit={handleApplyAdditionalFee} className="space-y-4 text-xs">
          
          {/* Apply Fee To Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Apply Fee To</label>
            <div className="flex items-center gap-6 mt-1">
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input 
                  type="radio" 
                  name="applyFeeType" 
                  value="school" 
                  checked={applyType === 'school'} 
                  onChange={() => setApplyType('school')}
                  className="cursor-pointer"
                />
                Entire School
              </label>
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input 
                  type="radio" 
                  name="applyFeeType" 
                  value="classes" 
                  checked={applyType === 'classes'} 
                  onChange={() => setApplyType('classes')}
                  className="cursor-pointer"
                />
                Selected Classes
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Fee Description *</label>
            <Input 
              placeholder="e.g. Annual Sports Fee" 
              value={feeDescription} 
              onChange={e => setFeeDescription(e.target.value)} 
              required 
              className="text-xs"
            />
          </div>

          {/* Case 1: Entire School Amount */}
          {applyType === 'school' && (
            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Amount (₹) *</label>
              <Input 
                type="number" 
                placeholder="e.g. 500" 
                value={feeSchoolAmount} 
                onChange={e => setFeeSchoolAmount(e.target.value)} 
                required 
                className="text-xs"
              />
            </div>
          )}

          {/* Case 2: Selected Classes Table amount mapping */}
          {applyType === 'classes' && (
            <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Class Dues Allocation</label>
              <div className="border border-border rounded-xl overflow-hidden max-h-[220px] overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50">
                <Table>
                  <TableHeader className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black py-2 bg-zinc-50 dark:bg-zinc-900">Class</TableHead>
                      <TableHead className="text-[10px] uppercase font-black py-2 bg-zinc-50 dark:bg-zinc-900 w-32">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="py-2 font-bold text-xs">{c.name}</TableCell>
                        <TableCell className="py-1">
                          <Input 
                            type="number" 
                            placeholder="Blank if none" 
                            value={classAmountsMap[c.id] || ''} 
                            onChange={e => setClassAmountsMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                            className="h-7 text-xs w-full"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Due Date (Manual Input Disabled) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Due Date *</label>
            <Input 
              type="date" 
              value={feeDueDate} 
              onChange={e => setFeeDueDate(e.target.value)} 
              onKeyDown={e => e.preventDefault()}
              required 
              className="text-xs"
            />
            <p className="text-[9px] text-text-muted mt-1 font-semibold leading-relaxed">
              The selected Due Date determines when this fee becomes payable. Students will not see this fee as due until the selected date is reached.
            </p>
          </div>

        </form>
      </Dialog>

    </div>
  );
}
