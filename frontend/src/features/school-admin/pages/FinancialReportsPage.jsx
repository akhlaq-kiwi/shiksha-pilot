import React, { useState, useEffect } from 'react';
import { FileText, Calendar, ArrowRight, AlertCircle, RefreshCw, BarChart2, Sparkles, Download, MoreHorizontal, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { Dialog } from '../../../common/ui/dialog';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatDateFull = (dateStr) => {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[month]} ${year}`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${day} ${months[month]} ${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
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

const formatServerTimestamp = (dateStr) => {
  if (!dateStr) return '—';
  const normalized = dateStr.replace('T', ' ').split('.')[0].replace('Z', '');
  const parts = normalized.split(' ');
  if (parts.length >= 2) {
    const datePart = parts[0];
    const timePart = parts[1];
    
    // Parse date
    const dParts = datePart.split('-');
    let dateStrFormatted = datePart;
    if (dParts.length === 3) {
      const year = parseInt(dParts[0], 10);
      const month = parseInt(dParts[1], 10) - 1;
      const day = parseInt(dParts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dateStrFormatted = `${day} ${months[month]} ${year}`;
    }
    
    // Parse time
    const tParts = timePart.split(':');
    let timeStrFormatted = timePart;
    if (tParts.length >= 2) {
      let hours = parseInt(tParts[0], 10);
      const minutes = String(parseInt(tParts[1], 10)).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, '0');
      timeStrFormatted = `${hoursStr}:${minutes} ${ampm}`;
    }
    
    return `${dateStrFormatted} at ${timeStrFormatted}`;
  }
  return dateStr;
};

export default function FinancialReportsPage() {
  const { isReadOnly, currentYear } = useAcademicYear();
  const [reports, setReports] = useState([]);
  const [nextSuggestedStartDate, setNextSuggestedStartDate] = useState('');
  const [hasPreviousReport, setHasPreviousReport] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Helper functions for ISO YYYY-MM-DD
  const getISOFirstDayOfMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const getISOToday = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date params pre-filled by default
  const [fromDate, setFromDate] = useState(getISOFirstDayOfMonth());
  const [toDate, setToDate] = useState(getISOToday());
  
  // Preview states
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  
  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState(null);

  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedReport, setBlockedReport] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [deletingReport, setDeletingReport] = useState(false);
  const [handingOverId, setHandingOverId] = useState(null);

  const handleStartGenerate = () => {
    if (reports.length > 0 && reports[0].status !== 'Settled') {
      setBlockedReport(reports[0]);
      setShowBlockedModal(true);
      return;
    }
    setShowGenerateConfirm(true);
  };

  const handleDeleteReportClick = (report) => {
    if (isReadOnly || currentYear?.status === 'Archived') {
      setError('Financial reports in an Archived academic year cannot be deleted.');
      return;
    }
    if (report.status === 'Settled') {
      setError('Settled reports cannot be deleted.');
      return;
    }
    setReportToDelete(report);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDeleteReport = async () => {
    if (!reportToDelete) return;
    setDeletingReport(true);
    setError('');
    setSuccess('');

    try {
      await schoolService.deleteFinancialReport(reportToDelete.id);
      setSuccess(`Financial report ${reportToDelete.report_id} deleted successfully.`);
      setShowDeleteConfirm(false);
      setReportToDelete(null);
      await loadReports();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete financial report.');
    } finally {
      setDeletingReport(false);
    }
  };

  const fetchPreview = async (fDate = fromDate, tDate = toDate) => {
    const start = fDate || getISOFirstDayOfMonth();
    const end = tDate || getISOToday();
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const data = await schoolService.getFinancialPreview({
        from_date: start,
        to_date: end
      });
      setPreviewData(data);
    } catch (err) {
      console.error(err);
      setPreviewError(err.message || 'Failed to fetch financial preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadReports = async (selectedYear = currentYear) => {
    setLoading(true);
    const initialFrom = getISOFirstDayOfMonth();
    const initialTo = getISOToday();
    setFromDate(initialFrom);
    setToDate(initialTo);

    try {
      const res = await schoolService.getFinancialReports();
      setReports(res.reports || []);
      
      const suggestedStart = res.next_suggested_start_date || '';
      setNextSuggestedStartDate(suggestedStart);
      setHasPreviousReport(!!res.has_previous_report);

      // Auto load preview for current ongoing month
      fetchPreview(initialFrom, initialTo);
    } catch (err) {
      console.error(err);
      setError('Failed to load financial reports history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(currentYear);
    const handleYearSwitch = (e) => {
      loadReports(e.detail);
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, [currentYear]);

  const handlePreview = async () => {
    const fDate = fromDate || getISOFirstDayOfMonth();
    const tDate = toDate || getISOToday();
    
    if (tDate < fDate) {
      setPreviewError('To Date cannot be earlier than From Date.');
      return;
    }
    fetchPreview(fDate, tDate);
  };

  const handleConfirmGenerateReport = async () => {
    setShowGenerateConfirm(false);
    setGeneratingReport(true);
    setError('');
    setSuccess('');
    
    try {
      const fDate = fromDate || getISOFirstDayOfMonth();
      const tDate = toDate || getISOToday();
      await schoolService.createFinancialReport({
        from_date: fDate,
        to_date: tDate
      });
      setSuccess('Financial report generated successfully.');
      await loadReports();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to generate financial report.');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleSendSettlementRequest = (report) => {
    setSettlementTarget(report);
    setShowSettlementConfirm(true);
  };

  const handleExportReport = async (report) => {
    try {
      const blob = await schoolService.exportFinancialReport(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const formatDateStr = (dateStr) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
        }
        return dateStr;
      };
      
      const filename = `Financial Report - ${formatDateStr(report.from_date)} to ${formatDateStr(report.to_date)}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to export report.');
    }
  };

  const handleExportPreviewReport = async () => {
    if (!previewData) return;
    try {
      const blob = await schoolService.exportFinancialPreviewReport(previewData.from_date, previewData.to_date);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const formatDateStr = (dateStr) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
        }
        return dateStr;
      };
      
      const filename = `Financial Statement Preview - ${formatDateStr(previewData.from_date)} to ${formatDateStr(previewData.to_date)}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert('Failed to export preview report.');
    }
  };

  const handleConfirmSettlementRequest = async () => {
    if (!settlementTarget) return;
    const targetId = settlementTarget.id;
    setShowSettlementConfirm(false);
    setHandingOverId(targetId);
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      await schoolService.submitSettlementRequest(targetId);
      setSuccess('Hand over request submitted successfully. Email notification sent to School Admin.');
      setSettlementTarget(null);
      await loadReports();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit hand over request.');
    } finally {
      setSubmitting(false);
      setHandingOverId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Title Header Card */}
      <div className="sticky top-14 z-20 bg-surface border border-border p-6 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display">Financial Reports</h2>
            <p className="text-text-secondary text-xs mt-1">On-demand financial accounting reports for school owners and live profit/loss preview for ongoing period.</p>
          </div>
        </div>
      </div>

      {isReadOnly ? (
        <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs text-center text-text-muted text-xs">
          This academic year is archived and financially closed. No new financial previews or reports can be generated.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Panel: Ongoing Month Inspection */}
          <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs space-y-4">
            <CardHeader className="p-0 pb-2 border-b border-border">
              <CardTitle className="text-sm font-bold text-text-primary uppercase tracking-wider">Ongoing Month Inspection</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="text-xs text-text-secondary leading-relaxed bg-zinc-50/50 dark:bg-zinc-900/10 p-3.5 rounded-xl border border-border border-dashed">
                Inspect live transaction ledgers and generate on-demand financial accounting reports for any period. Click <strong>Generate Financial Report</strong> below to freeze transactions and log a report into history.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="from_date" className="text-xs font-bold text-text-secondary uppercase">From Date</label>
                  <Input 
                    id="from_date" 
                    type="date" 
                    value={fromDate} 
                    onChange={(e) => setFromDate(e.target.value)} 
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="to_date" className="text-xs font-bold text-text-secondary uppercase">To Date</label>
                  <Input 
                    id="to_date" 
                    type="date" 
                    value={toDate} 
                    onChange={(e) => setToDate(e.target.value)} 
                  />
                </div>
              </div>

              {previewError && (
                <p className="text-xs text-red-500 font-semibold flex items-center gap-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {previewError}
                </p>
              )}

              <div className="space-y-3 pt-1">
                <Button 
                  onClick={handlePreview} 
                  disabled={previewLoading || generatingReport}
                  variant="secondary"
                  className="w-full py-2.5 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                >
                  {previewLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Calculating...
                    </>
                  ) : (
                    'Preview Report'
                  )}
                </Button>

                <Button 
                  onClick={handleStartGenerate} 
                  disabled={previewLoading || generatingReport}
                  className="w-full py-2.5 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 bg-primary text-white"
                >
                  {generatingReport ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" /> Generate Financial Report
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Right Panel: Financial Statement Preview */}
          <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs flex flex-col justify-between min-h-[300px]">
            <CardHeader className="p-0 pb-2 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-text-primary uppercase tracking-wider">Financial Statement Preview</CardTitle>
              {previewData && (
                <DropdownMenu
                  trigger={<MoreHorizontal className="h-4 w-4" />}
                >
                  <DropdownItem onClick={handleExportPreviewReport}>
                    <Download className="h-3.5 w-3.5 mr-2 inline" /> Export Report
                  </DropdownItem>
                </DropdownMenu>
              )}
            </CardHeader>
            
            <div className="flex-1 flex flex-col justify-center py-6">
              {!previewData && !previewLoading && (
                <div className="flex flex-col items-center justify-center text-center text-text-muted space-y-2 py-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center border border-border">
                    <BarChart2 className="h-6 w-6 text-text-muted" />
                  </div>
                  <p className="text-xs font-bold text-text-secondary">Click Preview Report to view pending statements.</p>
                  <p className="text-[11px] text-text-muted max-w-[280px]">Previews are live calculations of pending transactions and do not create permanent database entries.</p>
                </div>
              )}

              {previewLoading && (
                <div className="flex flex-col items-center justify-center text-center text-text-secondary space-y-3 py-4">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
                  <p className="text-xs font-bold uppercase tracking-wider">Computing transactions ledgers...</p>
                </div>
              )}

              {previewData && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="font-bold text-text-secondary uppercase">Report Period</span>
                    <span className="font-semibold text-text-primary flex items-center gap-1">
                      {formatDateFull(previewData.from_date)} <ArrowRight className="h-3 w-3 text-text-muted" /> {formatDateFull(previewData.to_date)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3.5 border border-border rounded-xl">
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Fees Collected</p>
                      <p className="text-lg font-bold text-text-primary mt-1 font-sans">{formatCurrency(previewData.fees_collected)}</p>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3.5 border border-border rounded-xl">
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Expenses & Salaries</p>
                      <p className="text-lg font-bold text-text-primary mt-1 font-sans text-red-500">{formatCurrency(previewData.salary_paid)}</p>
                    </div>
                  </div>

                  <hr className="border-border" />

                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/20">
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Net Financial Outcome</p>
                      <h4 className="text-2xl font-bold font-sans mt-0.5">
                        {previewData.profit_loss >= 0 ? (
                          <span className="text-green-600 dark:text-green-400">Profit: {formatCurrency(previewData.profit_loss)}</span>
                        ) : (
                          <span className="text-red-500">Loss: {formatCurrency(Math.abs(previewData.profit_loss))}</span>
                        )}
                      </h4>
                    </div>
                    
                    <div className={`flex items-center justify-center rounded-full transition-all duration-200 ${previewData.profit_loss >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`} style={{ width: '42px', height: '42px' }}>
                      <span className="font-bold" style={{ fontSize: '22px', lineHeight: '1' }}>₹</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Success / Error notification */}
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

      {/* Bottom Panel: Financial Statements History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Financial Statements History</h3>
          <span className="bg-zinc-100 text-text-secondary dark:bg-zinc-800 text-[11px] font-bold px-2 py-0.5 rounded-md uppercase border border-border">
            {reports.length} Reports
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center text-text-muted text-xs shadow-xs border border-border">
            No financial statement history recorded. Create your first report above.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((r) => {
              const isProfit = r.profit_loss >= 0;
              return (
                <Card key={r.id} className="bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4 relative hover:shadow-xs transition-shadow">
                  
                  {/* Card Header ID & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text-primary font-mono">{r.report_id}</span>
                      
                      {handingOverId === r.id ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border bg-amber-500/10 text-amber-700 border-amber-500/30 font-sans animate-pulse">
                          <RefreshCw className="h-3 w-3 animate-spin text-amber-600" /> Handing Over...
                        </span>
                      ) : r.status === 'Hand Over' ? (
                        <button
                          onClick={() => handleSendSettlementRequest(r)}
                          title="Click to hand over report"
                          className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border bg-amber-500/10 text-amber-700 border-amber-500/30 font-sans hover:bg-amber-500/20 hover:scale-105 transition-all cursor-pointer shadow-2xs"
                        >
                          Hand Over
                        </button>
                      ) : (r.status === 'Pending' || r.status === 'Request Sent') ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border bg-amber-500/15 text-amber-800 border-amber-500/30 font-sans">
                          Pending
                        </span>
                      ) : (r.status === 'Handed Over' || r.status === 'Settled') ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-sans">
                          Settled
                        </span>
                      ) : r.status === 'Rejected' ? (
                        <button
                          onClick={() => handleSendSettlementRequest(r)}
                          title="Click to re-submit handover request"
                          className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border bg-red-500/10 text-red-600 border-red-500/30 font-sans hover:bg-red-500/20 hover:scale-105 transition-all cursor-pointer shadow-2xs"
                        >
                          Rejected
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportReport(r)}
                        className="text-[11px] font-bold uppercase tracking-tight text-emerald-600 hover:text-emerald-700 hover:underline whitespace-nowrap flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" /> Export Report
                      </button>

                      {r.status !== 'Settled' && !isReadOnly && currentYear?.status !== 'Archived' && (
                        <button
                          onClick={() => handleDeleteReportClick(r)}
                          title="Delete Unsettled Report"
                          className="p-1 text-zinc-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Period dates */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Report Period</p>
                    <p className="text-xs font-semibold text-text-primary">
                      {formatDateFull(r.from_date)} ➔ {formatDateFull(r.to_date)}
                    </p>
                  </div>

                  <hr className="border-border" />

                  {/* Amounts */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Revenue</p>
                      <p className="text-sm font-bold text-text-primary mt-0.5 font-sans">{formatCurrency(r.fees_collected)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider font-sans">Salaries & Expenses</p>
                      <p className="text-sm font-bold text-text-primary mt-0.5 font-sans text-red-500">{formatCurrency(r.salary_paid)}</p>
                    </div>
                  </div>

                  {/* Financial Result outcome */}
                  <div className={`p-3 rounded-xl border ${isProfit ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Outcome</p>
                    <p className={`text-base font-bold font-sans mt-0.5 ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {isProfit ? `Profit: ${formatCurrency(r.profit_loss)}` : `Loss: ${formatCurrency(Math.abs(r.profit_loss))}`}
                    </p>
                  </div>

                  {/* Generation details */}
                  <div className="flex items-center justify-between text-[11px] text-text-muted border-t border-border pt-3">
                    <span className="font-bold">Generated</span>
                    <span className="font-mono">{formatServerTimestamp(r.created_at)}</span>
                  </div>

                </Card>
              );
            })}
          </div>
        )}

      {showGenerateConfirm && (
        <Dialog
          isOpen={showGenerateConfirm}
          onClose={() => setShowGenerateConfirm(false)}
          title="Generate Financial Report?"
          description=""
          className="max-w-md animate-in fade-in duration-200"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => setShowGenerateConfirm(false)}
                disabled={generatingReport}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmGenerateReport}
                disabled={generatingReport}
                className="font-bold bg-primary text-white"
              >
                {generatingReport ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm mt-2">
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to generate a financial report for the period <strong className="text-text-primary">{formatDateDisplay(fromDate)}</strong> to <strong className="text-text-primary">{formatDateDisplay(toDate)}</strong>?
            </p>
            <p className="text-xs text-zinc-500 leading-normal">
              This will freeze transactions for this period into your history with status <span className="font-bold text-amber-600">Hand Over</span>.
            </p>
          </div>
        </Dialog>
      )}

      {showSettlementConfirm && (
        <Dialog
          isOpen={showSettlementConfirm}
          onClose={() => {
            setShowSettlementConfirm(false);
            setSettlementTarget(null);
          }}
          title="Hand Over Financial Report?"
          description=""
          className="max-w-md animate-in fade-in duration-200"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowSettlementConfirm(false);
                  setSettlementTarget(null);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmSettlementRequest}
                disabled={submitting}
                className="font-bold bg-teal-600 hover:bg-teal-700 text-white"
              >
                {submitting ? 'Sending...' : 'Hand Over'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm mt-2">
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to hand over report <strong className="text-text-primary font-mono">{settlementTarget?.report_id}</strong> to the School Admin / Owner?
            </p>
            <p className="text-xs text-zinc-500 leading-normal">
              An email containing the financial statement summary and Excel file attachment will be sent to the School Admin email address.
            </p>
            <p className="text-xs text-zinc-500 leading-normal font-semibold">
              The status will update to <span className="text-amber-600 font-bold">Pending</span> until approved or rejected via email.
            </p>
          </div>
        </Dialog>
      )}

      {/* Blocked Report Generation Warning Modal */}
      {showBlockedModal && (
        <Dialog
          isOpen={showBlockedModal}
          onClose={() => {
            setShowBlockedModal(false);
            setBlockedReport(null);
          }}
          title="Previous Report Settlement Required"
          description=""
          showClose={false}
          className="max-w-md animate-in fade-in duration-200 border-amber-500/30"
          footer={
            <div className="flex justify-center w-full">
              <Button 
                onClick={() => {
                  setShowBlockedModal(false);
                  setBlockedReport(null);
                }}
                className="font-bold bg-amber-600 hover:bg-amber-700 text-white px-6"
              >
                Understand & Close
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm mt-2">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <p className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /> Cannot Generate New Report
              </p>
              <p className="leading-relaxed">
                You cannot generate a new financial report because the last generated report (<strong className="font-mono text-amber-950 dark:text-white font-bold">{blockedReport?.report_id}</strong>) is currently in <strong className="uppercase font-bold text-amber-800 dark:text-amber-300">{blockedReport?.status}</strong> status.
              </p>
              <p className="leading-relaxed pt-1.5 border-t border-amber-500/20 text-amber-900 dark:text-amber-200">
                Please make sure the previous report is settled or deleted before generating a new financial report.
              </p>
            </div>
          </div>
        </Dialog>
      )}

      {/* Delete Report Confirmation Modal */}
      {showDeleteConfirm && (
        <Dialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setReportToDelete(null);
          }}
          title="Delete Unsettled Report?"
          description=""
          className="max-w-md animate-in fade-in duration-200 border-red-500/30"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setReportToDelete(null);
                }}
                disabled={deletingReport}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDeleteReport}
                disabled={deletingReport}
                className="font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {deletingReport ? 'Deleting...' : 'Delete Report'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm mt-2">
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to delete report <strong className="text-text-primary font-mono">{reportToDelete?.report_id}</strong>?
            </p>
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-800 dark:text-red-300 text-xs space-y-1">
              <p className="font-bold">Transaction Safety Guaranteed:</p>
              <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                All fee payments, salary disbursements, and expenses from this period will remain safe in the database and will automatically be included in your next generated report.
              </p>
            </div>
          </div>
        </Dialog>
      )}

    </div>
  </div>
  );
}

