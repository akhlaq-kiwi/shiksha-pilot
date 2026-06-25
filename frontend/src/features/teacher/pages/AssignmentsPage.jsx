import React, { useState } from 'react';
import { Plus, Search, Eye, Edit3 } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { teacherService } from '../../../common/services/teacherService';
import { SectionHeader, StatusBadge, Modal, Label, FormSelect, Textarea, formatDate } from '../shared';

export default function AssignmentsPage({ classes, assignments: initAssignments }) {
  const [assignments, setAssignments] = useState(initAssignments);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', class: '', dueDate: '', totalMarks: '', instructions: '' });

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.class.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    const newA = {
      id: 'a-' + Date.now(),
      ...form,
      totalMarks: Number(form.totalMarks) || 20,
      submissions: 0,
      total: classes.find((c) => c.name === form.class)?.students || 30,
      status: 'active',
    };
    teacherService.createAssignment(newA);
    setAssignments((prev) => [newA, ...prev]);
    setShowCreate(false);
    setForm({ title: '', class: '', dueDate: '', totalMarks: '', instructions: '' });
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Assignments"
        description="Create homework, track submissions, and grade work"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Assignment
          </Button>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assignments…"
          className="pl-9 h-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Marks</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-semibold text-text-primary max-w-[220px]">
                    <p className="truncate">{a.title}</p>
                  </TableCell>
                  <TableCell className="text-xs">{a.class}</TableCell>
                  <TableCell className="text-xs tabular-nums">{formatDate(a.dueDate)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{a.totalMarks}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-text-primary">{a.submissions}</span>
                      <span className="text-text-muted text-xs">/ {a.total}</span>
                      <div className="h-1.5 w-16 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(a.submissions / a.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-background text-text-muted hover:text-text-primary transition-colors" title="View">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-background text-text-muted hover:text-text-primary transition-colors" title="Grade">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Assignment">
        <div className="space-y-4">
          <div>
            <Label>Assignment Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 5 Practice Problems" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Class</Label>
              <FormSelect value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                <option value="">Select class…</option>
                {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </FormSelect>
            </div>
            <div>
              <Label>Total Marks</Label>
              <Input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} placeholder="20" className="h-9" />
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Describe what students should submit…" rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!form.title || !form.class}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Assignment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
