import React, { useState } from 'react';
import { Plus, Search, Edit } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';

const statusBadge = (status) => {
  const map = {
    ACTIVE: 'bg-green-500/10 text-green-600',
    ON_LEAVE: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function StaffPage({ staff, setStaff }) {
  const [staffSearch, setStaffSearch] = useState('');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: 'TEACHER', department: 'Mathematics', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  const totalStaff = staff.length;

  const filteredStaff = staff.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.department.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaff.name) return;
    setSubmitting(true);
    try {
      const id = staff.length + 1;
      setStaff(prev => [...prev, { ...newStaff, id, status: 'ACTIVE', joining: new Date().toISOString().split('T')[0] }]);
      setIsAddStaffOpen(false);
      setNewStaff({ name: '', role: 'TEACHER', department: 'Mathematics', email: '', phone: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Staff Management</h2>
          <p className="text-text-secondary text-sm mt-1">{totalStaff} staff members · {staff.filter(s => s.status === 'ACTIVE').length} on duty</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setIsAddStaffOpen(true)}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
          <Input placeholder="Search staff..." className="pl-9" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
        </div>
        <Select className="w-full md:w-48">
          <option value="">All Departments</option>
          <option>Mathematics</option><option>Science</option><option>English</option><option>Administration</option>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joining Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-text-muted">No staff found.</TableCell></TableRow>
            ) : filteredStaff.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                      {s.name.split(' ').filter((_, i) => i < 2).map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-text-primary text-sm">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-text-secondary text-xs">{s.role}</TableCell>
                <TableCell className="text-text-secondary text-xs">{s.department}</TableCell>
                <TableCell className="text-text-muted text-xs font-mono">{s.email}</TableCell>
                <TableCell className="text-text-muted text-xs">{s.joining}</TableCell>
                <TableCell>{statusBadge(s.status)}</TableCell>
                <TableCell>
                  <button className="text-text-muted hover:text-primary transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Leave Requests */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Pending Leave Requests</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Staff Member</TableHead><TableHead>Leave Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold text-text-primary">Mr. Akhil Singh</TableCell>
              <TableCell className="text-xs text-text-secondary">Sick Leave</TableCell>
              <TableCell className="text-xs text-text-muted">2026-06-28</TableCell>
              <TableCell className="text-xs text-text-muted">2026-06-30</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-7 px-3 text-xs text-green-600 border-green-200 hover:bg-green-50">Approve</Button>
                  <Button variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:bg-red-50">Reject</Button>
                </div>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={5} className="text-center py-4 text-text-muted text-xs">No other pending requests.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog isOpen={isAddStaffOpen} onClose={() => setIsAddStaffOpen(false)}
        title="Add Staff Member" description="Add a new staff member to the school."
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStaff} disabled={submitting}>{submitting ? 'Adding...' : 'Add Staff'}</Button>
        </>}>
        <form onSubmit={handleAddStaff} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Full Name</label>
            <Input placeholder="e.g. Ms. Anita Sharma" value={newStaff.name} onChange={e => setNewStaff(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Role</label>
              <Select value={newStaff.role} onChange={e => setNewStaff(p => ({ ...p, role: e.target.value }))}>
                <option>Teacher</option><option>Admin</option><option>Accountant</option><option>Librarian</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Department</label>
              <Select value={newStaff.department} onChange={e => setNewStaff(p => ({ ...p, department: e.target.value }))}>
                <option>Mathematics</option><option>Science</option><option>English</option><option>Social Studies</option><option>Administration</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Email</label>
            <Input type="email" placeholder="e.g. anita.sharma@school.edu" value={newStaff.email} onChange={e => setNewStaff(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Phone</label>
            <Input placeholder="Mobile number" value={newStaff.phone} onChange={e => setNewStaff(p => ({ ...p, phone: e.target.value }))} />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
