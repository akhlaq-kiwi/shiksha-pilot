import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';

const MOCK_FEE_COLLECTIONS = [
  { id: 1, student: 'Aryan Mehta', class: 'Class 10', amount: 25000, type: 'Tuition Fee', date: '2026-06-01', status: 'PAID', method: 'Online' },
  { id: 2, student: 'Priya Sharma', class: 'Class 10', amount: 25000, type: 'Tuition Fee', date: '2026-06-02', status: 'PAID', method: 'Cash' },
  { id: 3, student: 'Rohan Das', class: 'Class 9', amount: 22000, type: 'Tuition Fee', date: '2026-06-03', status: 'PAID', method: 'Online' },
  { id: 4, student: 'Sneha Gupta', class: 'Class 9', amount: 22000, type: 'Tuition Fee', date: '2026-06-05', status: 'PENDING', method: '-' },
  { id: 5, student: 'Aditya Patel', class: 'Class 11', amount: 28000, type: 'Tuition Fee', date: '2026-06-06', status: 'PAID', method: 'Cheque' },
];

const MOCK_FEE_STRUCTURES = [
  { id: 1, name: 'Class 1–5 Tuition', class: 'Class 1–5', amount: 18000, frequency: 'Annual', due_day: 10 },
  { id: 2, name: 'Class 6–8 Tuition', class: 'Class 6–8', amount: 22000, frequency: 'Annual', due_day: 10 },
  { id: 3, name: 'Class 9–10 Tuition', class: 'Class 9–10', amount: 25000, frequency: 'Annual', due_day: 10 },
  { id: 4, name: 'Class 11–12 Tuition', class: 'Class 11–12', amount: 28000, frequency: 'Annual', due_day: 10 },
  { id: 5, name: 'Lab Fee', class: 'All Classes', amount: 5000, frequency: 'Annual', due_day: 15 },
  { id: 6, name: 'Transport Fee', class: 'All Classes', amount: 12000, frequency: 'Annual', due_day: 5 },
];

const statusBadge = (status) => {
  const map = {
    PAID: 'bg-green-500/10 text-green-600',
    PENDING: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function FinancePage({ students }) {
  const [feeCollections, setFeeCollections] = useState(MOCK_FEE_COLLECTIONS);
  const [feeStructures, setFeeStructures] = useState(MOCK_FEE_STRUCTURES);
  const [feeSearch, setFeeSearch] = useState('');
  const [isAddFeeStructureOpen, setIsAddFeeStructureOpen] = useState(false);
  const [isCollectFeeOpen, setIsCollectFeeOpen] = useState(false);
  const [newFeeStructure, setNewFeeStructure] = useState({ name: '', class: '', amount: '', frequency: 'Annual', due_day: 10 });
  const [newCollection, setNewCollection] = useState({ student: '', class: '', amount: '', type: 'Tuition Fee', method: 'Online' });
  const [submitting, setSubmitting] = useState(false);

  const totalFeeCollected = feeCollections.filter(f => f.status === 'PAID').reduce((s, f) => s + f.amount, 0);
  const pendingFees = feeCollections.filter(f => f.status === 'PENDING').length;

  const filteredFeeCollections = feeCollections.filter(f =>
    f.student.toLowerCase().includes(feeSearch.toLowerCase()) ||
    f.type.toLowerCase().includes(feeSearch.toLowerCase())
  );

  const handleAddFeeStructure = (e) => {
    e.preventDefault();
    if (!newFeeStructure.name || !newFeeStructure.amount) return;
    setSubmitting(true);
    try {
      const id = feeStructures.length + 1;
      setFeeStructures(prev => [...prev, { ...newFeeStructure, id, amount: parseInt(newFeeStructure.amount) }]);
      setIsAddFeeStructureOpen(false);
      setNewFeeStructure({ name: '', class: '', amount: '', frequency: 'Annual', due_day: 10 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollectFee = (e) => {
    e.preventDefault();
    if (!newCollection.student || !newCollection.amount) return;
    setSubmitting(true);
    try {
      const id = feeCollections.length + 1;
      setFeeCollections(prev => [...prev, {
        ...newCollection,
        id,
        amount: parseInt(newCollection.amount),
        date: new Date().toISOString().split('T')[0],
        status: 'PAID'
      }]);
      setIsCollectFeeOpen(false);
      setNewCollection({ student: '', class: '', amount: '', type: 'Tuition Fee', method: 'Online' });
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

      {/* Finance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected', value: `₹${(totalFeeCollected / 1000).toFixed(0)}K`, sub: 'This term', color: 'text-green-600' },
          { label: 'Pending Fees', value: pendingFees, sub: 'Students', color: 'text-amber-600' },
          { label: 'Expenses', value: '₹28K', sub: 'This month', color: 'text-red-500' },
          { label: 'Payroll Due', value: '₹3.2L', sub: 'June 2026', color: 'text-primary' },
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
          <TableHeader><TableRow><TableHead>Fee Name</TableHead><TableHead>Applicable Class</TableHead><TableHead>Amount</TableHead><TableHead>Frequency</TableHead><TableHead>Due Day</TableHead></TableRow></TableHeader>
          <TableBody>
            {feeStructures.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-text-muted">No fee structures defined.</TableCell></TableRow>
            ) : feeStructures.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold text-text-primary">{f.name}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.class}</TableCell>
                <TableCell className="font-mono text-xs font-bold text-text-primary">₹{f.amount.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.frequency}</TableCell>
                <TableCell className="text-xs text-text-muted">Day {f.due_day}</TableCell>
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
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Class</TableHead><TableHead>Fee Type</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredFeeCollections.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-text-muted">No fee records.</TableCell></TableRow>
            ) : filteredFeeCollections.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-semibold text-text-primary">{f.student}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.class}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.type}</TableCell>
                <TableCell className="font-mono text-xs font-bold">₹{f.amount.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs text-text-muted">{f.date}</TableCell>
                <TableCell className="text-xs text-text-secondary">{f.method}</TableCell>
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
              {[
                { c: 'Stationery', a: 8500, d: '2026-06-10' },
                { c: 'Maintenance', a: 12000, d: '2026-06-15' },
                { c: 'Utilities', a: 7200, d: '2026-06-20' },
              ].map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold text-text-primary text-sm">{e.c}</TableCell>
                  <TableCell className="font-mono text-xs font-bold">₹{e.a.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{e.d}</TableCell>
                </TableRow>
              ))}
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
              {[
                { s: 'Priya Sharma', t: 'Merit Scholarship', d: '20%' },
                { s: 'Rohan Das', t: 'Need-Based', d: '15%' },
              ].map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold text-text-primary text-sm">{r.s}</TableCell>
                  <TableCell className="text-xs text-text-secondary">{r.t}</TableCell>
                  <TableCell><span className="text-xs font-bold text-green-600">{r.d}</span></TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell colSpan={3} className="text-center py-3 text-xs text-text-muted">2 scholarships active.</TableCell></TableRow>
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
              <Input placeholder="e.g. Class 8" value={newFeeStructure.class} onChange={e => setNewFeeStructure(p => ({ ...p, class: e.target.value }))} />
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
                <option>Annual</option><option>Term-wise</option><option>Monthly</option>
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
            <label className="text-xs font-bold text-text-secondary uppercase">Student Name</label>
            <Input placeholder="e.g. Aryan Mehta" value={newCollection.student} onChange={e => setNewCollection(p => ({ ...p, student: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Class</label>
              <Select value={newCollection.class} onChange={e => setNewCollection(p => ({ ...p, class: e.target.value }))}>
                <option>Class 9</option><option>Class 10</option><option>Class 11</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹)</label>
              <Input type="number" placeholder="e.g. 25000" value={newCollection.amount} onChange={e => setNewCollection(p => ({ ...p, amount: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Fee Type</label>
              <Select value={newCollection.type} onChange={e => setNewCollection(p => ({ ...p, type: e.target.value }))}>
                <option>Tuition Fee</option><option>Lab Fee</option><option>Transport Fee</option><option>Exam Fee</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Payment Method</label>
              <Select value={newCollection.method} onChange={e => setNewCollection(p => ({ ...p, method: e.target.value }))}>
                <option>Online</option><option>Cash</option><option>Cheque</option><option>DD</option>
              </Select>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
