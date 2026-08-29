import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Button } from '../../../common/ui/button';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import AccountDeletionRequests from '../components/AccountDeletionRequests';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

const statusBadge = (status) => {
  const map = {
    Success: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold',
    Failed: 'bg-rose-500/15 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-bold',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

export default function SecurityPage() {
  // Audit Logs State
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [modules, setModules] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pageLogs, setPageLogs] = useState(1);
  
  // Audit Logs Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Login History State
  const [loginHistory, setLoginHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [totalHistory, setTotalHistory] = useState(0);
  const [pageHistory, setPageHistory] = useState(1);

  // Fetch Audit Logs
  const fetchAuditLogs = async (targetPage = pageLogs) => {
    setLoadingLogs(true);
    try {
      const params = {
        page: targetPage,
        limit: 25,
        search,
        module: selectedModule,
        user: selectedUser,
        date_filter: dateFilter,
      };
      if (dateFilter === 'custom') {
        params.from_date = fromDate;
        params.to_date = toDate;
      }
      const data = await schoolAdminService.getAuditLogs(params);
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      setModules(data.modules || []);
      setUsersList(data.users || []);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Fetch Login History
  const fetchLoginHistory = async (targetPage = pageHistory) => {
    setLoadingHistory(true);
    try {
      const data = await schoolAdminService.getLoginHistory({
        page: targetPage,
        limit: 10,
      });
      setLoginHistory(data.history || []);
      setTotalHistory(data.total || 0);
    } catch (err) {
      console.error('Error fetching login history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Trigger fetches on filter/page change
  useEffect(() => {
    fetchAuditLogs(1);
    setPageLogs(1);
  }, [search, selectedModule, selectedUser, dateFilter, fromDate, toDate]);

  useEffect(() => {
    fetchAuditLogs(pageLogs);
  }, [pageLogs]);

  useEffect(() => {
    fetchLoginHistory(pageHistory);
  }, [pageHistory]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedModule('');
    setSelectedUser('');
    setDateFilter('');
    setFromDate('');
    setToDate('');
    setPageLogs(1);
  };

  const totalLogsPages = Math.ceil(totalLogs / 25) || 1;
  const totalHistoryPages = Math.ceil(totalHistory / 10) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-text-primary tracking-tight font-display">Security</h2>
          <p className="text-text-secondary text-sm mt-1">Audit logs, login history, deletion requests, and access control.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchAuditLogs(); fetchLoginHistory(); }} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Deletion requests first — this is a worklist, the rest is history. */}
      <AccountDeletionRequests />

      {/* Audit Logs Card */}
      <Card className="overflow-hidden">
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold text-text-primary">Audit Logs</CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Immutable, secure record of all administrative actions.
              </CardDescription>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-md dark:bg-zinc-800 dark:text-zinc-400">
              Total logs: <span className="font-bold text-text-primary">{totalLogs}</span>
            </div>
          </div>
        </CardHeader>

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-border bg-zinc-50/10 dark:bg-zinc-900/10 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <Input aria-label="Search action, description, or performer..."
                type="text"
                placeholder="Search action, description, or performer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Module Filter */}
            <Select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">All Modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            {/* Performed By Filter */}
            <Select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">All Performers</option>
              {usersList.map((u) => (
                <option key={u.user} value={u.user}>
                  {u.performed_by || u.user}
                </option>
              ))}
            </Select>

            {/* Date Range Option Dropdown */}
            <Select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </Select>
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">From:</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 text-xs max-w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">To:</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 text-xs max-w-[150px]"
                />
              </div>
            </div>
          )}

          {/* Clear Filters Helper */}
          {(search || selectedModule || selectedUser || dateFilter) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs h-7 text-primary hover:text-primary/95"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </div>

        {/* Audit Logs Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Module</TableHead>
                <TableHead className="w-[200px]">Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[220px]">Performed By</TableHead>
                <TableHead className="w-[180px]">Role</TableHead>
                <TableHead className="w-[200px]">Date & Time</TableHead>
                <TableHead className="w-[160px]">IP Address</TableHead>
                <TableHead className="w-[180px]">Device / Browser</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLogs ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                      <span className="text-xs text-text-secondary">Loading audit logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-text-muted">
                    No matching audit log records found.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                    <TableCell className="text-xs font-semibold text-text-primary">
                      {log.module || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                        <span className="font-semibold text-text-primary text-xs">{log.action}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary max-w-sm whitespace-pre-wrap">
                      {log.description || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-text-primary">
                          {log.performed_by || '—'}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono truncate max-w-[200px]">
                          {log.user || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">
                      {log.user_role || '—'}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-text-muted whitespace-nowrap">
                      {log.formatted_date}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-text-muted">
                      {log.ip_address || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted truncate max-w-[150px]">
                      {log.device || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Audit Logs Pagination */}
        {totalLogsPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/30">
            <span className="text-xs text-text-secondary">
              Page <span className="font-semibold text-text-primary">{pageLogs}</span> of{' '}
              <span className="font-semibold text-text-primary">{totalLogsPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageLogs((p) => Math.max(1, p - 1))}
                disabled={pageLogs === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageLogs((p) => Math.min(totalLogsPages, p + 1))}
                disabled={pageLogs === totalLogsPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Login History Card */}
      <Card className="overflow-hidden">
        <CardHeader className="py-4 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-bold text-text-primary">Login History</CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Session history and login attempt validations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Email</TableHead>
                <TableHead>User Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Device</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                      <span className="text-xs text-text-secondary">Loading history...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : loginHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-text-muted">
                    No login records.
                  </TableCell>
                </TableRow>
              ) : (
                loginHistory.map((l) => (
                  <TableRow key={l.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                    <TableCell className="font-mono text-xs text-text-primary">
                      {l.user || '—'}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-text-primary">
                      {l.performed_by || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-text-secondary">
                      {l.user_role || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {l.ip_address || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {l.formatted_date}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {l.device || '—'}
                    </TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Login History Pagination */}
        {totalHistoryPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/30">
            <span className="text-xs text-text-secondary">
              Page <span className="font-semibold text-text-primary">{pageHistory}</span> of{' '}
              <span className="font-semibold text-text-primary">{totalHistoryPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageHistory((p) => Math.max(1, p - 1))}
                disabled={pageHistory === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageHistory((p) => Math.min(totalHistoryPages, p + 1))}
                disabled={pageHistory === totalHistoryPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
