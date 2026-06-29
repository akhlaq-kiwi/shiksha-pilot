import React, { useState, useEffect } from 'react';
import { DollarSign, Landmark, Plus, User, Calendar, Clock, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
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

const formatTime12h = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

const STANDARD_FEE_TYPES = [
  "Admission Fee",
  "Exam Fee",
  "Annual Fee",
  "Sports Fee",
  "Library Fee",
  "Activity Fee",
  "Transport Fee",
  "Other Special Fee"
];

export default function FinanceManagementPage() {
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'ledger'
  const [expenses, setExpenses] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Expense form
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // New Fee Type form
  const [selectedFeeType, setSelectedFeeType] = useState('Admission Fee');
  const [customFeeName, setCustomFeeName] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // Status logs
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const expensesList = await schoolService.getSchoolExpenses();
      setExpenses(expensesList || []);

      const typesList = await schoolService.getAdditionalFeeTypes();
      setFeeTypes(typesList || []);

      const paymentsList = await schoolService.getAdditionalFeePayments();
      setFeePayments(paymentsList || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch finance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) {
      alert('Please fill in all expense details.');
      return;
    }
    setExpenseSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const added = await schoolService.createSchoolExpense({
        description: expenseDesc.trim(),
        amount: parseFloat(expenseAmount)
      });
      setExpenses(prev => [added, ...prev]);
      setExpenseDesc('');
      setExpenseAmount('');
      setSuccess('Expense added successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to add school expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleCreateFeeType = async (e) => {
    e.preventDefault();
    const finalName = selectedFeeType === 'Other Special Fee' ? customFeeName.trim() : selectedFeeType;
    if (!finalName || !feeAmount) {
      alert('Please specify the fee name and amount.');
      return;
    }
    setFeeSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const result = await schoolService.createAdditionalFeeType({
        name: finalName,
        amount: parseFloat(feeAmount)
      });
      
      setSuccess(`Fee type created and successfully applied to ${result.assigned_count} active students.`);
      setCustomFeeName('');
      setFeeAmount('');
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create fee type.');
    } finally {
      setFeeSubmitting(false);
    }
  };

  const handleCollectPayment = async (paymentId) => {
    try {
      const updated = await schoolService.collectAdditionalFeePayment(paymentId);
      setFeePayments(prev => prev.map(p => {
        if (p.id === paymentId) {
          return updated;
        }
        return p;
      }));
    } catch (err) {
      console.error(err);
      alert('Failed to collect fee payment.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Finance Management</h2>
            <p className="text-text-secondary text-xs mt-1">Record daily school operational expenses and manage student non-tuition fees ledger payouts.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mt-6">
          <button 
            onClick={() => { setActiveTab('expenses'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'expenses' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            💸 School Expenses
          </button>
          <button 
            onClick={() => { setActiveTab('ledger'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'ledger' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            🏷️ Additional Fee Ledger
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold">
          {success}
        </div>
      )}

      {/* LOADING SPINNER */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!loading && activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Add Expense Form Card */}
          <div className="lg:col-span-1">
            <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider border-b border-border pb-2">Record Expense</h3>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Description</label>
                  <Input 
                    placeholder="e.g. Electricity Bill, Stationery items" 
                    value={expenseDesc} 
                    onChange={e => setExpenseDesc(e.target.value)} 
                    required 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="Amount in Rupees" 
                    value={expenseAmount} 
                    onChange={e => setExpenseAmount(e.target.value)} 
                    required 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={expenseSubmitting}
                  className="w-full font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="h-4 w-4" /> Record Entry
                </Button>
              </form>
            </Card>
          </div>

          {/* Expense History Ledger */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Expense History Ledger</h3>
            
            {expenses.length === 0 ? (
              <Card className="p-8 text-center text-text-muted text-xs shadow-xs border border-border">
                No expense entries logged.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {expenses.map((e) => (
                  <Card key={e.id} className="bg-surface border border-border p-4 rounded-2xl shadow-2xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-extrabold text-sm text-text-primary leading-tight">{e.description}</p>
                      <span className="font-black text-base text-red-500 font-sans">{formatCurrency(e.amount)}</span>
                    </div>

                    <hr className="border-border" />

                    <div className="flex flex-col gap-1.5 text-[10px] text-text-muted font-bold">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-text-muted" />
                        <span>Logged By: <span className="text-text-secondary uppercase font-extrabold">{e.creator_name || 'System Admin'}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-text-muted" />
                        <span>Date: {formatDateFull(e.expense_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-text-muted" />
                        <span>Time: {formatTime12h(e.created_at)}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === 'ledger' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create & Assign Fee Card */}
          <div className="lg:col-span-1">
            <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs space-y-4">
              <h3 className="text-sm font-black text-text-primary uppercase tracking-wider border-b border-border pb-2">Apply New Fee Type</h3>
              <form onSubmit={handleCreateFeeType} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Fee Category</label>
                  <Select value={selectedFeeType} onChange={e => setSelectedFeeType(e.target.value)}>
                    {STANDARD_FEE_TYPES.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </Select>
                </div>

                {selectedFeeType === 'Other Special Fee' && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-xs font-bold text-text-secondary uppercase">Custom Fee Name</label>
                    <Input 
                      placeholder="e.g. Picnic Fee, Laboratory Fee" 
                      value={customFeeName} 
                      onChange={e => setCustomFeeName(e.target.value)} 
                      required 
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Standard Amount (₹)</label>
                  <Input 
                    type="number" 
                    placeholder="Amount in Rupees" 
                    value={feeAmount} 
                    onChange={e => setFeeAmount(e.target.value)} 
                    required 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={feeSubmitting}
                  className="w-full font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="h-4 w-4" /> Apply To All Students
                </Button>
              </form>
            </Card>

            {/* Created fee structures list summary */}
            <div className="mt-6 space-y-3">
              <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">Configured Fees</h4>
              {feeTypes.length === 0 ? (
                <p className="text-[10px] text-text-muted italic">No non-tuition fee structures configured.</p>
              ) : (
                <div className="space-y-2">
                  {feeTypes.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-surface border border-border rounded-xl text-xs">
                      <span className="font-bold text-text-primary">{t.name}</span>
                      <span className="font-extrabold text-text-secondary font-sans">{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Student Fee Records */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Student Ledger Entries</h3>
            
            {feePayments.length === 0 ? (
              <Card className="p-8 text-center text-text-muted text-xs shadow-xs border border-border">
                No students currently assigned to additional fee structures.
              </Card>
            ) : (
              <Card className="border border-border rounded-2xl overflow-hidden shadow-2xs bg-surface">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Student Name</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Class</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Fee Type</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Amount</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Status</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Payment Date</TableHead>
                        <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feePayments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold text-text-primary text-xs truncate max-w-[120px]">{p.student_name}</TableCell>
                          <TableCell className="text-xs text-text-muted font-bold uppercase">{p.class_name}</TableCell>
                          <TableCell className="text-xs text-text-secondary font-bold">{p.fee_name}</TableCell>
                          <TableCell className="text-xs text-text-primary font-bold font-sans">{formatCurrency(p.amount)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                              p.status === 'Paid'
                                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                : 'bg-red-500/10 text-red-600 border-red-500/20'
                            }`}>
                              {p.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-text-muted">{p.payment_date ? formatDateFull(p.payment_date) : '—'}</TableCell>
                          <TableCell className="text-right">
                            {p.status === 'Pending' ? (
                              <Button 
                                size="xs"
                                onClick={() => handleCollectPayment(p.id)}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-[9px] px-2 py-1 flex items-center gap-1 rounded"
                              >
                                <Check className="h-3 w-3" /> Collect Payment
                              </Button>
                            ) : (
                              <span className="text-[10px] text-green-600 font-black uppercase tracking-wider flex items-center gap-1 justify-end">
                                <ShieldCheck className="h-3.5 w-3.5" /> Collected
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
