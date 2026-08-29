import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Select } from '../../../common/ui/select';
import { Input } from '../../../common/ui/input';
import { Dialog } from '../../../common/ui/dialog';
import { Button } from '../../../common/ui/button';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { UserMinus, RefreshCw, AlertTriangle } from 'lucide-react';

const STATUS_STYLES = {
  PENDING:   'bg-amber-500/15 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  COMPLETED: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  REJECTED:  'bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  CANCELLED: 'bg-zinc-500/15 text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-400',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] uppercase font-bold ${STATUS_STYLES[status] || 'bg-zinc-100 text-zinc-500'}`}>
    {status}
  </span>
);

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

/**
 * Queue of account-deletion requests filed from the mobile app (PF-04).
 *
 * Completing a request is irreversible: it scrubs the user's name, phone,
 * email and password so they can no longer sign in. Attendance, fee and exam
 * records are deliberately left intact — they belong to the school.
 */
export default function AccountDeletionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDING');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  // The request currently being resolved, plus the operator's inputs.
  const [target, setTarget] = useState(null); // { request, action }
  const [typedPhone, setTypedPhone] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await schoolAdminService.getAccountDeletionRequests({ status });
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Could not load deletion requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const openResolve = (request, action) => {
    setTarget({ request, action });
    setTypedPhone('');
    setNote('');
    setError('');
  };

  const closeResolve = () => {
    if (busyId) return; // Don't yank the dialog out from under an in-flight request.
    setTarget(null);
    setTypedPhone('');
    setNote('');
  };

  // Erasing is irreversible, so it requires the operator to type the phone
  // number of the person they are erasing. A rejection is harmless and needs
  // no such gate.
  const isErase = target?.action === 'COMPLETED';
  const phoneMatches = (typedPhone || '').trim() === (target?.request?.contact_phone || '');
  const canSubmit = !!target && (!isErase || phoneMatches) && !busyId;

  const submitResolve = async () => {
    if (!canSubmit) return;

    const { request, action } = target;
    setBusyId(request.id);
    setError('');
    try {
      await schoolAdminService.resolveAccountDeletionRequest(request.id, action, note.trim());
      setTarget(null);
      setTypedPhone('');
      setNote('');
      await load();
    } catch (e) {
      setError(e?.message || 'Could not update the request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <UserMinus className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
            <div>
              <CardTitle className="text-sm font-bold text-text-primary">Account Deletion Requests</CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Parents and staff can request account deletion from the mobile app. Completing a
                request permanently removes their sign-in details; school records are kept.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 text-xs"
              aria-label="Filter by status"
            >
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Withdrawn</option>
              <option value="">All</option>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-rose-600 bg-rose-500/10 border-b border-border">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Requested by</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Reason</TableHead>
              <TableHead className="text-xs">Requested</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-text-secondary py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}

            {!loading && requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-text-secondary py-8">
                  {status === 'PENDING'
                    ? 'No pending requests. Nothing needs your attention.'
                    : 'No requests match this filter.'}
                </TableCell>
              </TableRow>
            )}

            {!loading && requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">
                  <div className="font-semibold text-text-primary">{r.contact_name || '—'}</div>
                  <div className="text-text-secondary tabular-nums">{r.contact_phone}</div>
                </TableCell>
                <TableCell className="text-xs text-text-secondary">{r.user_role || '—'}</TableCell>
                <TableCell className="text-xs text-text-secondary max-w-[260px]">
                  <div className="truncate" title={r.reason || ''}>{r.reason || '—'}</div>
                  {r.resolution_note && (
                    <div className="truncate text-[11px] italic mt-0.5" title={r.resolution_note}>
                      Note: {r.resolution_note}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                  {formatDate(r.created_at)}
                </TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.status === 'PENDING' ? (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={busyId === r.id}
                        onClick={() => openResolve(r, 'REJECTED')}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] bg-rose-600 hover:bg-rose-700 text-white"
                        disabled={busyId === r.id}
                        onClick={() => openResolve(r, 'COMPLETED')}
                      >
                        {busyId === r.id ? 'Working…' : 'Erase account'}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-text-secondary">
                      {r.resolved_by_name ? `by ${r.resolved_by_name}` : '—'}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        isOpen={!!target}
        onClose={closeResolve}
        closeOnBackdropClick={false}
        maxWidth="max-w-md"
        title={isErase ? 'Erase this account' : 'Reject this request'}
        description={
          isErase
            ? 'This permanently removes the person\u2019s sign-in details. It cannot be undone.'
            : 'The account stays active and the person is told the request was declined.'
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeResolve} disabled={!!busyId}>
              Cancel
            </Button>
            <Button
              onClick={submitResolve}
              disabled={!canSubmit}
              className={isErase ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50' : ''}
            >
              {busyId ? 'Working\u2026' : isErase ? 'Erase account' : 'Reject request'}
            </Button>
          </div>
        }
      >
        {target && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border bg-zinc-50 dark:bg-zinc-900/50 p-3">
              <div className="font-semibold text-text-primary">{target.request.contact_name}</div>
              <div className="text-text-secondary tabular-nums">{target.request.contact_phone}</div>
              {target.request.reason && (
                <div className="text-xs text-text-secondary mt-2 italic">
                  &ldquo;{target.request.reason}&rdquo;
                </div>
              )}
            </div>

            {isErase && (
              <>
                <div className="text-xs text-text-secondary space-y-1">
                  <p className="font-semibold text-rose-600">This removes, permanently:</p>
                  <p>their name, mobile number, email and password, and their notification devices.</p>
                  <p className="font-semibold text-text-primary pt-1">This is kept:</p>
                  <p>attendance, fee and exam records stay in the school&rsquo;s history.</p>
                </div>

                <div>
                  <label htmlFor="confirm-phone" className="block text-xs font-semibold text-text-primary mb-1">
                    Type <span className="tabular-nums">{target.request.contact_phone}</span> to confirm
                  </label>
                  <Input
                    id="confirm-phone"
                    value={typedPhone}
                    onChange={(e) => setTypedPhone(e.target.value)}
                    placeholder="Mobile number"
                    autoComplete="off"
                    className="tabular-nums"
                  />
                  {typedPhone && !phoneMatches && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      That does not match this request&rsquo;s mobile number.
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label htmlFor="resolution-note" className="block text-xs font-semibold text-text-primary mb-1">
                {isErase ? 'Note for the record (optional)' : 'Reason for rejecting (optional)'}
              </label>
              <Input
                id="resolution-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isErase ? 'e.g. verified with parent by phone' : 'e.g. please contact the office first'}
                maxLength={500}
              />
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )}
      </Dialog>
    </Card>
  );
}
