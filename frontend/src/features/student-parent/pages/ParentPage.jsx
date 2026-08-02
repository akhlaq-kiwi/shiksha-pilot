import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';

export default function ParentPage({ children, isParent, selectedChild, onSelectChild, data }) {
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ childId: children[0]?.id, fromDate: '', toDate: '', reason: '' });
  const [leaveSent, setLeaveSent] = useState(false);

  const handleLeaveSubmit = (e) => {
    e.preventDefault();
    setTimeout(() => setLeaveSent(true), 800);
  };

  if (!isParent) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">My Children</h2>
          <p className="text-text-secondary text-sm mt-1">Monitor attendance, progress, and fees for each child.</p>
        </div>
        <Button onClick={() => { setLeaveSent(false); setLeaveDialogOpen(true); }} variant="outline" className="flex items-center gap-2 text-xs font-bold">
          <Send className="h-3.5 w-3.5" /> Request Leave
        </Button>
      </div>

      {/* Child selector tabs */}
      <div className="flex gap-3">
        {children.map(child => (
          <button
            key={child.id}
            onClick={() => onSelectChild(child)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
              selectedChild.id === child.id
                ? 'bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 border-zinc-900 dark:border-zinc-50 shadow-md'
                : 'bg-surface border-border text-text-secondary hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400'
            }`}
          >
            <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${selectedChild.id === child.id ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              {child.avatar}
            </div>
            <div>
              <p className="text-sm font-bold">{child.name}</p>
              <p className={`text-[11px] font-semibold ${selectedChild.id === child.id ? 'opacity-70' : 'text-text-muted'}`}>{child.grade}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Child Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Attendance</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">88%</p>
            <p className="text-[11px] text-text-muted mt-0.5">132/150 days</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Avg Score</p>
            <p className="text-2xl font-bold text-primary mt-1">84</p>
            <p className="text-[11px] text-text-muted mt-0.5">out of 100</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Due Fee</p>
            <p className="text-2xl font-bold text-amber-600 tabular-nums mt-1">₹14.5K</p>
            <p className="text-[11px] text-text-muted mt-0.5">due Jul 15</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Pending HW</p>
            <p className="text-2xl font-bold text-text-primary mt-1">2</p>
            <p className="text-[11px] text-text-muted mt-0.5">assignments</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance + Academic side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="py-4 border-b border-border">
            <CardTitle className="text-sm font-bold text-text-primary">Attendance — June 2026</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-600">88%</p>
                <p className="text-[11px] text-text-muted font-semibold mt-0.5">attendance rate</p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-xl font-bold text-text-primary">19</p>
                  <p className="text-[11px] text-text-muted font-semibold">Present</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">3</p>
                  <p className="text-[11px] text-text-muted font-semibold">Absent</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-500">1</p>
                  <p className="text-[11px] text-text-muted font-semibold">Leave</p>
                </div>
              </div>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="py-4 border-b border-border">
            <CardTitle className="text-sm font-bold text-text-primary">Academic Progress</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-2.5">
            {data.subjects.slice(0, 5).map(sub => (
              <div key={sub.code} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-secondary w-24 flex-shrink-0 truncate">{sub.name}</span>
                <div className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
                  <div
                    className={`h-full rounded flex items-center justify-end pr-2 ${sub.score >= 90 ? 'bg-emerald-500' : sub.score >= 75 ? 'bg-primary' : 'bg-amber-500'}`}
                    style={{ width: `${sub.score}%` }}
                  >
                    <span className="text-[11px] font-bold text-white">{sub.score}</span>
                  </div>
                </div>
                <span className="w-6 text-right text-[11px] font-bold text-text-primary">{sub.grade}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Fee tracking */}
      <Card className="shadow-sm">
        <CardHeader className="py-4 border-b border-border">
          <CardTitle className="text-sm font-bold text-text-primary">Fee Tracking — {selectedChild.name}</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fee Head</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.feeStatus.breakdown.map(f => (
              <TableRow key={f.label}>
                <TableCell className="font-semibold text-text-primary py-3.5">{f.label}</TableCell>
                <TableCell className="font-mono font-bold tabular-nums">₹{f.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Due</span>
                </TableCell>
                <TableCell className="text-xs text-text-muted">{data.feeStatus.dueDate}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold text-text-primary py-3.5">May Term Payment</TableCell>
              <TableCell className="font-mono font-bold tabular-nums">₹22,000</TableCell>
              <TableCell>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Paid</span>
              </TableCell>
              <TableCell className="text-xs text-text-muted">2026-06-01</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Leave history */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text-primary">Leaves</h3>
          <Button onClick={() => { setLeaveSent(false); setLeaveDialogOpen(true); }} variant="outline" className="text-xs font-bold flex items-center gap-1.5">
            <Send className="h-3 w-3" /> New Request
          </Button>
        </div>
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dates</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold text-text-primary py-3.5">Jun 11, 2026</TableCell>
                <TableCell className="text-xs text-text-secondary">Medical appointment</TableCell>
                <TableCell className="text-xs text-text-muted">Jun 9, 2026</TableCell>
                <TableCell><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Approved</span></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold text-text-primary py-3.5">May 22–23, 2026</TableCell>
                <TableCell className="text-xs text-text-secondary">Family function</TableCell>
                <TableCell className="text-xs text-text-muted">May 19, 2026</TableCell>
                <TableCell><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Approved</span></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>



      {/* Leave Request Dialog */}
      <Dialog
        isOpen={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        title="Request Leave"
        description="Submit a leave application for your child."
        footer={
          leaveSent ? (
            <Button onClick={() => setLeaveDialogOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleLeaveSubmit}>Submit Request</Button>
            </>
          )
        }
      >
        {leaveSent ? (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">Leave Request Sent</h3>
            <p className="text-sm text-text-secondary">The class teacher has been notified. You'll receive confirmation shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleLeaveSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Child</label>
              <Select
                value={leaveForm.childId}
                onChange={e => setLeaveForm(p => ({ ...p, childId: e.target.value }))}
              >
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.grade})</option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">From Date</label>
                <Input
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={e => setLeaveForm(p => ({ ...p, fromDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">To Date</label>
                <Input
                  type="date"
                  value={leaveForm.toDate}
                  onChange={e => setLeaveForm(p => ({ ...p, toDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Reason</label>
              <textarea
                value={leaveForm.reason}
                onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                rows={3}
                placeholder="Brief reason for leave..."
                required
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg resize-none text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function ParentVocabReport({ studentId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const numericId = typeof studentId === 'string' && studentId.startsWith('c') ? studentId.substring(1) : studentId;
        const res = await studentService.getParentVocabularyReport(numericId);
        if (res?.success) {
          setReport(res.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (studentId) {
      fetchReport();
    }
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs font-bold text-text-muted uppercase tracking-wider">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        Loading Child Vocabulary report...
      </div>
    );
  }

  if (!report) {
    return <div className="text-xs text-text-muted py-4 font-bold">No vocabulary metrics found for this student.</div>;
  }

  const { stats, category_performance } = report;

  return (
    <div className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-background dark:bg-zinc-900 border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">XP Score</p>
          <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{stats.score}</p>
        </div>
        <div className="bg-background dark:bg-zinc-900 border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Words Learned</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{stats.total_words_learned}</p>
        </div>
        <div className="bg-background dark:bg-zinc-900 border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Words Mastered</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">{stats.total_words_mastered}</p>
        </div>
        <div className="bg-background dark:bg-zinc-900 border border-border p-4 rounded-xl text-center shadow-2xs">
          <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Avg Accuracy</p>
          <p className="text-2xl font-bold text-purple-600 mt-1 tabular-nums">{stats.accuracy_percent}%</p>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Category Strength & Weakness Analysis</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {category_performance.map(cat => {
            const total = parseInt(cat.correct) + parseInt(cat.wrong);
            const rate = total > 0 ? Math.round((parseInt(cat.correct) / total) * 100) : 0;
            return (
              <div key={cat.category} className="p-4 bg-background dark:bg-zinc-900 border border-border rounded-xl shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-text-primary">{cat.category}</span>
                  <span className={`font-bold uppercase text-[11px] ${rate >= 75 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{rate}% Accuracy</span>
                </div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                </div>
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">
                  {cat.correct} Correct · {cat.wrong} Incorrect
                </p>
              </div>
            );
          })}
          {category_performance.length === 0 && (
            <div className="col-span-2 bg-background border border-dashed border-border rounded-xl p-6 text-center text-xs text-text-muted font-bold">
              Your child has not started playing Word Builder yet. Start gameplay to see statistics!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
