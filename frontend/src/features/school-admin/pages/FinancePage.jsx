import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';

const statusBadge = (status) => {
  const map = {
    PAID: 'bg-green-500/10 text-green-600',
    PENDING: 'bg-amber-500/10 text-amber-600',
    Pending: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function FinancePage() {
  const [feeStructures, setFeeStructures] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feeSearch, setFeeSearch] = useState('');
  const [isAddFeeStructureOpen, setIsAddFeeStructureOpen] = useState(false);
  const [isCollectFeeOpen, setIsCollectFeeOpen] = useState(false);
  const [newFeeStructure, setNewFeeStructure] = useState({ name: '', class_id: '', amount: '', frequency: 'Monthly', due_day: 10 });
  const [newCollection, setNewCollection] = useState({ student_id: '', fee_structure_id: '', amount: '', method: 'Online' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [fsData, fpData, stuData, clsData] = await Promise.all([
        schoolService.getFeeStructures(),
        schoolService.getFeePayments(),
        schoolService.getStudents(),
        schoolService.getClasses()
      ]);
      setFeeStructures(fsData || []);
      setFeePayments(fpData || []);
      setStudents(stuData || []);
      setClasses(clsData || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load financial records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Finance...</p>
        </div>
      </div>
    );
  }

  const totalFeeCollected = feePayments.filter(f => f.status === 'PAID').reduce((s, f) => s + parseFloat(f.amount_paid || 0), 0);
  const pendingFeesCount = feePayments.filter(f => f.status === 'Pending' || f.status === 'PENDING').length;

  const filteredFeePayments = feePayments.filter(f =>
    (f.student_name && f.student_name.toLowerCase().includes(feeSearch.toLowerCase())) ||
    (f.fee_structure_name && f.fee_structure_name.toLowerCase().includes(feeSearch.toLowerCase()))
  );

  const handleAddFeeStructure = async (e) => {
    e.preventDefault();
    if (!newFeeStructure.name || !newFeeStructure.amount) return;
    setSubmitting(true);
    setError('');
    try {
      await schoolService.createFeeStructure({
        name: newFeeStructure.name,
        amount: parseFloat(newFeeStructure.amount),
        frequency: newFeeStructure.frequency,
        class_id: newFeeStructure.class_id ? parseInt(newFeeStructure.class_id) : null
      });
      setIsAddFeeStructureOpen(false);
      setNewFeeStructure({ name: '', class_id: '', amount: '', frequency: 'Monthly', due_day: 10 });
      loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save fee structure.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollectFee = async (e) => {
    e.preventDefault();
    if (!newCollection.student_id || !newCollection.amount) return;
    setSubmitting(true);
    setError('');
    try {
      await schoolService.createFeePayment({
        student_id: parseInt(newCollection.student_id),
        fee_structure_id: newCollection.fee_structure_id ? parseInt(newCollection.fee_structure_id) : null,
        amount_paid: parseFloat(newCollection.amount),
        payment_date: new Date().toISOString().split('T')[0],
        status: 'PAID'
      });
      setIsCollectFeeOpen(false);
      setNewCollection({ student_id: '', fee_structure_id: '', amount: '', method: 'Online' });
      loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to record fee payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Finance</h2>
          <p className="text-text-secondary text-sm mt-1">Fee structures, collections, expenses, scholarships, and payroll.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2 text-xs" onClick={() => setIsAddFeeStructureOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Fee Structure
          </Button>
          <Button className="flex items-center gap-2 text-xs" onClick={() => setIsCollectFeeOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Collect Fee
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Finance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected', value: `₹${(totalFeeCollected / 1000).toFixed(1)}K`, sub: 'This term', color: 'text-green-600' },
          { label: 'Pending Fees', value: pendingFeesCount, sub: 'Students', color: 'text-amber-600' },
          { label: 'Expenses', value: '₹0K', sub: 'This month', color: 'text-red-500' },
          { label: 'Payroll Due', value: '₹0K', sub: 'June 2026', color: 'text-primary' },
        ].map(c => (
          <Card key={c.label} className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{c.label}</p>
              <p className={`text-2xl font-black mt-1 font-display ${c.color}`}>{c.value}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fee Structures */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Fee Structures</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Fee Name</TableHead><TableHead>Applicable Class</TableHead><TableHead>Amount</TableHead><TableHead>Frequency</TableHead></TableRow></TableHeader>
          <TableBody>
            {feeStructures.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-text-muted">No fee structures defined.</TableCell></TableRow>
            ) : feeStructures.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold text-text-primary">{f.name}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.class_name || 'All Classes'}</TableCell>
                <TableCell className="font-mono text-xs font-bold text-text-primary">₹{parseFloat(f.amount).toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.frequency}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Fee Collections */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-text-primary">Fee Collections</CardTitle>
          <div className="relative w-60">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <Input placeholder="Search..." className="pl-8 h-8 text-xs" value={feeSearch} onChange={e => setFeeSearch(e.target.value)} />
          </div>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Fee Type</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Receipt No.</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredFeePayments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-text-muted">No fee records.</TableCell></TableRow>
            ) : filteredFeePayments.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold text-text-primary">{f.student_name || '-'}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.fee_structure_name || 'Tuition Fee'}</TableCell>
                <TableCell className="font-mono text-xs font-bold">₹{parseFloat(f.amount_paid).toLocaleString('en-IN')}</TableCell>
                <TableCell className="font-mono text-xs text-text-muted">{f.payment_date || '-'}</TableCell>
                <TableCell className="text-xs text-text-secondary font-mono">{f.receipt_no || '-'}</TableCell>
                <TableCell>{statusBadge(f.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Expenses & Scholarships */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-text-primary">Expenses</CardTitle>
            <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={3} className="text-center py-3 text-xs text-text-muted">No expenses recorded.</TableCell></TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-text-primary">Scholarships & Discounts</CardTitle>
            <Button variant="outline" className="text-xs h-8 px-3 flex items-center gap-1"><Plus className="h-3 w-3" /> Add</Button>
          </CardHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Type</TableHead><TableHead>Discount</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell colSpan={3} className="text-center py-3 text-xs text-text-muted">No active scholarships.</TableCell></TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Add Fee Structure Dialog */}
      <Dialog isOpen={isAddFeeStructureOpen} onClose={() => setIsAddFeeStructureOpen(false)}
        title="Add Fee Structure" description="Define a new fee category and amount."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddFeeStructureOpen(false)}>Cancel</Button>
          <Button onClick={handleAddFeeStructure} disabled={submitting}>{submitting ? 'Saving...' : 'Save Structure'}</Button>
        </>}>
        <form onSubmit={handleAddFeeStructure} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Fee Name</label>
            <Input placeholder="e.g. Class 8 Tuition Fee" value={newFeeStructure.name} onChange={e => setNewFeeStructure(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Applicable Class</label>
              {classes.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                  No classes defined.
                </div>
              ) : (
                <Select value={newFeeStructure.class_id} onChange={e => setNewFeeStructure(p => ({ ...p, class_id: e.target.value }))}>
                  <option value="">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ''}</option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input type="number" placeholder="e.g. 20000" value={newFeeStructure.amount} onChange={e => setNewFeeStructure(p => ({ ...p, amount: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Frequency</label>
              <Select value={newFeeStructure.frequency} onChange={e => setNewFeeStructure(p => ({ ...p, frequency: e.target.value }))}>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="One-Time">One-Time</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Due Day of Month</label>
              <Input type="number" min={1} max={28} value={newFeeStructure.due_day} onChange={e => setNewFeeStructure(p => ({ ...p, due_day: parseInt(e.target.value) || 10 }))} />
            </div>
          </div>
        </form>
      </Dialog>

      {/* Collect Fee Dialog */}
      <Dialog isOpen={isCollectFeeOpen} onClose={() => setIsCollectFeeOpen(false)}
        title="Collect Fee" description="Record a fee payment from a student."
        footer={<>
          <Button variant="secondary" onClick={() => setIsCollectFeeOpen(false)}>Cancel</Button>
          <Button onClick={handleCollectFee} disabled={submitting}>{submitting ? 'Recording...' : 'Record Payment'}</Button>
        </>}>
        <form onSubmit={handleCollectFee} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Student</label>
            {students.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                No students enrolled yet. Enroll students first.
              </div>
            ) : (
              <Select value={newCollection.student_id} onChange={e => setNewCollection(p => ({ ...p, student_id: e.target.value }))} required>
                <option value="">Select student...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.class_name ? `(${s.class_name})` : ''}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Fee Structure Type</label>
              {feeStructures.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                  No fee structures defined. Define structures first.
                </div>
              ) : (
                <Select value={newCollection.fee_structure_id} onChange={e => {
                  const fs = feeStructures.find(f => String(f.id) === String(e.target.value));
                  setNewCollection(p => ({
                    ...p,
                    fee_structure_id: e.target.value,
                    amount: fs ? String(fs.amount) : p.amount
                  }));
                }} required>
                  <option value="">Select structure...</option>
                  {feeStructures.map(f => (
                    <option key={f.id} value={f.id}>{f.name} (₹{parseFloat(f.amount).toLocaleString('en-IN')})</option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount Paid (₹)</label>
              <Input type="number" placeholder="e.g. 25000" value={newCollection.amount} onChange={e => setNewCollection(p => ({ ...p, amount: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Payment Method</label>
              <Select value={newCollection.method} onChange={e => setNewCollection(p => ({ ...p, method: e.target.value }))}>
                <option value="Online">Online</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="DD">DD</option>
              </Select>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
