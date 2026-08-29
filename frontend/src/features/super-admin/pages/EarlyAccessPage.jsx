import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Trash2, Check, Undo2, Ban, Copy } from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Button } from '../../../common/ui/button';
import { Select } from '../../../common/ui/select';
import { platformService } from '../../../common/services/platformService';
import { useToast } from '../../../common/components/Toast';
import { useConfirm } from '../../../common/components/ConfirmDialog';
import { formatDateTime } from '../../../common/utils/format';

const STATUS_STYLES = {
  PENDING:  'bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  INVITED:  'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  DECLINED: 'bg-zinc-500/15 text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-400',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] uppercase font-bold ${STATUS_STYLES[status] || 'bg-zinc-100 text-zinc-500'}`}>
    {status}
  </span>
);

/**
 * Queue of people who asked for early access to the Android app from the
 * marketing site.
 *
 * Nothing here talks to Google Play. Adding someone to the tester list is a
 * manual step in the Play Console, so this page's job is to hand over the
 * addresses to paste there and remember who has already been done.
 */
export default function EarlyAccessPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({ PENDING: 0, INVITED: 0, DECLINED: 0, TOTAL: 0 });
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformService.getEarlyAccessRequests({ status });
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      if (data?.summary) setSummary(data.summary);
    } catch (err) {
      toast.error(err.message || 'Failed to load early access requests.');
      setRequests([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const setStatusFor = async (row, next) => {
    setBusyId(row.id);
    try {
      await platformService.updateEarlyAccessRequest(row.id, next, row.notes || '');
      toast.success(next === 'INVITED' ? `${row.email} marked as invited.` : 'Request updated.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to update the request.');
    }
    setBusyId(null);
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete this request?',
      message: `Remove the early access request from "${row.email}"? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await platformService.deleteEarlyAccessRequest(row.id);
      toast.success('Request deleted.');
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to delete the request.');
    }
  };

  // The Play Console takes a comma-separated list, so hand over exactly that
  // rather than making someone copy addresses one row at a time.
  const copyEmails = async () => {
    const emails = requests.map((r) => r.email).join(', ');
    if (!emails) {
      toast.error('No addresses in the current view to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(emails);
      toast.success(`${requests.length} address${requests.length === 1 ? '' : 'es'} copied.`);
    } catch (_) {
      toast.error('Could not access the clipboard.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Early Access</h2>
          <p className="text-text-secondary text-sm mt-1">
            People who asked to test the Android app. Add their Google account to the tester list in
            the Play Console, then mark them invited here.
          </p>
        </div>
        <Button variant="outline" onClick={copyEmails} disabled={loading || requests.length === 0} className="gap-2">
          <Copy className="h-4 w-4" />
          Copy addresses
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Waiting', value: summary.PENDING, tone: 'text-amber-600' },
          { label: 'Invited', value: summary.INVITED, tone: 'text-emerald-600' },
          { label: 'Declined', value: summary.DECLINED, tone: 'text-zinc-500' },
          { label: 'Total', value: summary.TOTAL, tone: 'text-text-primary' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className={`text-3xl font-bold tabular-nums ${s.tone}`}>{s.value}</div>
              <div className="text-xs uppercase tracking-wide text-text-secondary mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Smartphone className="h-4 w-4" />
            Requests
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 text-xs w-40" aria-label="Filter by status">
            <option value="PENDING">Waiting</option>
            <option value="INVITED">Invited</option>
            <option value="DECLINED">Declined</option>
            <option value="">All</option>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">School</TableHead>
                <TableHead className="text-xs">Requested</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-text-secondary py-8">Loading…</TableCell>
                </TableRow>
              )}

              {!loading && requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-xs text-text-secondary py-8">
                    {status === 'PENDING'
                      ? 'Nobody is waiting. Everyone who signed up has been dealt with.'
                      : 'No requests match this filter.'}
                  </TableCell>
                </TableRow>
              )}

              {!loading && requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-semibold text-text-primary break-all">{r.email}</TableCell>
                  <TableCell className="text-xs text-text-secondary">{r.name || '—'}</TableCell>
                  <TableCell className="text-xs text-text-secondary">{r.school || '—'}</TableCell>
                  <TableCell className="text-xs text-text-secondary whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1.5">
                      {r.status !== 'INVITED' && (
                        <Button size="sm" className="h-7 text-[11px] gap-1" disabled={busyId === r.id}
                                onClick={() => setStatusFor(r, 'INVITED')}>
                          <Check className="h-3 w-3" /> Mark invited
                        </Button>
                      )}
                      {r.status === 'INVITED' && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busyId === r.id}
                                onClick={() => setStatusFor(r, 'PENDING')}>
                          <Undo2 className="h-3 w-3" /> Undo
                        </Button>
                      )}
                      {r.status === 'PENDING' && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busyId === r.id}
                                onClick={() => setStatusFor(r, 'DECLINED')}>
                          <Ban className="h-3 w-3" /> Decline
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
