import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';

const statusBadge = (status) => {
  const map = {
    Success: 'bg-green-500/10 text-green-600',
    Failed: 'bg-red-500/10 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function SecurityPage({ auditLogs, loginHistory }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Security</h2>
        <p className="text-text-secondary text-sm mt-1">Audit logs, login history, and access control.</p>
      </div>

      {/* Audit Logs */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Audit Logs</CardTitle>
          <CardDescription className="text-xs text-text-secondary mt-0.5">Immutable record of all administrative actions.</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Date & Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-text-muted">No audit log records.</TableCell></TableRow>
            ) : auditLogs.map(log => (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                    <span className="font-semibold text-text-primary text-xs">{log.action}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-text-secondary max-w-xs truncate">{log.detail}</TableCell>
                <TableCell className="text-xs font-mono text-text-muted">{log.user}</TableCell>
                <TableCell className="text-xs font-mono text-text-muted">{log.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Login History */}
      <Card>
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-sm font-bold text-text-primary">Login History</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loginHistory.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-text-muted">No login records.</TableCell></TableRow>
            ) : loginHistory.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs text-text-primary">{l.user}</TableCell>
                <TableCell className="text-xs text-text-secondary">{l.role}</TableCell>
                <TableCell className="font-mono text-xs text-text-muted">{l.ip}</TableCell>
                <TableCell className="font-mono text-xs text-text-muted">{l.date}</TableCell>
                <TableCell>{statusBadge(l.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
