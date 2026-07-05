import React, { useState, useEffect } from 'react';
import { FileText, Calendar, ArrowRight, AlertCircle, RefreshCw, BarChart2, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { Dialog } from '../../../common/ui/dialog';

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

export default function FinancialReportsPage() {
  const { isReadOnly } = useAcademicYear();
  const [reports, setReports] = useState([]);
  const [nextSuggestedStartDate, setNextSuggestedStartDate] = useState('');
  const [hasPreviousReport, setHasPreviousReport] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Date params
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Preview states
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  
  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showSettlementConfirm, setShowSettlementConfirm] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await schoolService.getFinancialReports();
      setReports(res.reports || []);
      
      const suggestedStart = res.next_suggested_start_date || '';
      setNextSuggestedStartDate(suggestedStart);
      setFromDate(suggestedStart);
      setHasPreviousReport(!!res.has_previous_report);
      
      // Default toDate to today in local client timezone
      const today = new Date().toLocaleDateString('en-CA');
      setToDate(today);
    } catch (err) {
      console.error(err);
      setError('Failed to load financial reports history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    const handleYearSwitch = () => {
      loadReports();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  const handlePreview = async () => {
    if (!fromDate || !toDate) {
      setPreviewError('Please select both From and To dates.');
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      setPreviewError('To Date cannot be earlier than From Date.');
      return;
    }
    
    setPreviewError('');
    setPreviewLoading(true);
    setPreviewData(null);
    
    try {
      const data = await schoolService.getFinancialPreview({
        from_date: fromDate,
        to_date: toDate
      });
      setPreviewData(data);
      schoolAdminService.logClientAudit({
        module: 'Financial Reports',
        action: 'Report Previewed',
        description: `Financial report previewed for period ${fromDate} to ${toDate}`
      }).catch(console.error);
    } catch (err) {
      console.error(err);
      setPreviewError(err.message || 'Failed to fetch financial preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateReport = () => {
    if (!previewData) return;
    setShowGenerateConfirm(true);
  };

  const handleConfirmGenerateReport = async () => {
    setShowGenerateConfirm(false);
    if (!previewData) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      await schoolService.createFinancialReport({
        from_date: previewData.from_date,
        to_date: previewData.to_date
      });
      
      setSuccess('Financial report generated and saved successfully.');
      setPreviewData(null);
      await loadReports();
      
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to generate financial report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendSettlementRequest = (report) => {
    setSettlementTarget(report);
    setShowSettlementConfirm(true);
  };

  const handleConfirmSettlementRequest = async () => {
    if (!settlementTarget) return;
    setShowSettlementConfirm(false);
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      await schoolService.submitSettlementRequest(settlementTarget.id);
      setSuccess('Settlement request submitted successfully.');
      setSettlementTarget(null);
      await loadReports();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit settlement request.');
    } finally {
      setSubmitting(false);
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
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Financial Reports</h2>
            <p className="text-text-secondary text-xs mt-1">Preview current profit/loss statement and generate official accounts reports for the school owner.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Panel: Report Parameters */}
        <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs space-y-4">
          <CardHeader className="p-0 pb-2 border-b border-border">
            <CardTitle className="text-sm font-black text-text-primary uppercase tracking-wider">New Report Parameters</CardTitle>
          </CardHeader>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">From Date</label>
              <div className="relative">
                <div className="w-full h-10 px-3 flex items-center rounded-lg border border-border bg-surface text-sm font-semibold text-text-primary shadow-2xs select-none">
                  {formatDateDisplay(fromDate) || 'Select Date'}
                </div>
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={e => setFromDate(e.target.value)} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Calendar className="absolute right-3 top-3 h-4 w-4 text-text-muted pointer-events-none" />
              </div>
              {nextSuggestedStartDate && (
                <p className="text-[10px] text-teal-600 font-extrabold uppercase flex items-center gap-1 mt-1">
                  <Sparkles className="h-3 w-3" /> {hasPreviousReport 
                    ? "Includes transactions since the last generated report."
                    : "Includes transactions since the academic year start."
                  }
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">To Date</label>
              <div className="relative">
                <div className="w-full h-10 px-3 flex items-center rounded-lg border border-border bg-surface text-sm font-semibold text-text-primary shadow-2xs select-none">
                  {formatDateDisplay(toDate) || 'Select Date'}
                </div>
                <input 
                  type="date" 
                  value={toDate} 
                  onChange={e => setToDate(e.target.value)} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Calendar className="absolute right-3 top-3 h-4 w-4 text-text-muted pointer-events-none" />
              </div>
            </div>

            {previewError && (
              <p className="text-xs text-red-500 font-semibold flex items-center gap-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {previewError}
              </p>
            )}

            <Button 
              onClick={handlePreview} 
              disabled={previewLoading}
              className="w-full py-2.5 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
            >
              {previewLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Calculating Preview...
                </>
              ) : (
                'Preview Report'
              )}
            </Button>
          </div>
        </Card>

        {/* Right Panel: Financial Statement Preview */}
        <Card className="bg-surface border border-border p-6 rounded-2xl shadow-2xs flex flex-col justify-between min-h-[300px]">
          <CardHeader className="p-0 pb-2 border-b border-border">
            <CardTitle className="text-sm font-black text-text-primary uppercase tracking-wider">Financial Statement Preview</CardTitle>
          </CardHeader>
          
          <div className="flex-1 flex flex-col justify-center py-6">
            {!previewData && !previewLoading && (
              <div className="flex flex-col items-center justify-center text-center text-text-muted space-y-2 py-4">
                <div className="w-12 h-12 rounded-full bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center border border-border">
                  <BarChart2 className="h-6 w-6 text-text-muted" />
                </div>
                <p className="text-xs font-bold text-text-secondary">Select date range and click Preview Report.</p>
                <p className="text-[10px] text-text-muted max-w-[280px]">Previews are temporary and do not record history. Report ID and permanent ledgers are generated upon official approval.</p>
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
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Total Fees Collected</p>
                    <p className="text-lg font-black text-text-primary mt-1 font-sans">{formatCurrency(previewData.fees_collected)}</p>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-900/30 p-3.5 border border-border rounded-xl">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Total Expenses & Salaries</p>
                    <p className="text-lg font-black text-text-primary mt-1 font-sans text-red-500">{formatCurrency(previewData.salary_paid)}</p>
                  </div>
                </div>

                <hr className="border-border" />

                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/20">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Net Financial Outcome</p>
                    <h4 className="text-2xl font-black font-sans mt-0.5">
                      {previewData.profit_loss >= 0 ? (
                        <span className="text-green-600 dark:text-green-400">Profit: {formatCurrency(previewData.profit_loss)}</span>
                      ) : (
                        <span className="text-red-500">Loss: {formatCurrency(Math.abs(previewData.profit_loss))}</span>
                      )}
                    </h4>
                  </div>
                  
                  <div className={`flex items-center justify-center rounded-full transition-all duration-200 ${previewData.profit_loss >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`} style={{ width: '42px', height: '42px' }}>
                    <span className="font-extrabold" style={{ fontSize: '22px', lineHeight: '1' }}>₹</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {previewData && (
            <Button 
              onClick={handleGenerateReport} 
              disabled={submitting}
              className="w-full py-2.5 font-black uppercase tracking-wider text-xs bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center justify-center gap-1.5"
            >
              {submitting ? 'Generating Report...' : 'Generate Report'}
            </Button>
          )}
        </Card>
      </div>

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
          <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Financial Statements History</h3>
          <span className="bg-zinc-100 text-text-secondary dark:bg-zinc-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase border border-border">
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
                  
                  {/* Card Header ID & Settle Action */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-text-primary font-mono">{r.report_id}</span>
                      {r.status === 'Request Sent' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-blue-500/10 text-blue-600 border-blue-500/20">
                          Request Sent
                        </span>
                      )}
                      {r.status === 'Settled' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-green-500/10 text-green-600 border-green-500/20 font-sans">
                          Settled
                        </span>
                      )}
                    </div>

                    {r.status !== 'Settled' && (
                      <button
                        onClick={() => handleSendSettlementRequest(r)}
                        disabled={r.status === 'Request Sent'}
                        className="text-[10px] font-extrabold uppercase tracking-tight text-primary hover:underline disabled:text-text-muted disabled:no-underline"
                      >
                        Send Settled Request
                      </button>
                    )}
                  </div>

                  {/* Period dates */}
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Report Period</p>
                    <p className="text-xs font-semibold text-text-primary">
                      {formatDateFull(r.from_date)} ➔ {formatDateFull(r.to_date)}
                    </p>
                  </div>

                  <hr className="border-border" />

                  {/* Amounts */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Total Revenue</p>
                      <p className="text-sm font-bold text-text-primary mt-0.5 font-sans">{formatCurrency(r.fees_collected)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-text-muted uppercase tracking-wider font-sans">Salaries & Expenses</p>
                      <p className="text-sm font-bold text-text-primary mt-0.5 font-sans text-red-500">{formatCurrency(r.salary_paid)}</p>
                    </div>
                  </div>

                  {/* Financial Result outcome */}
                  <div className={`p-3 rounded-xl border ${isProfit ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-wider">Outcome</p>
                    <p className={`text-base font-black font-sans mt-0.5 ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {isProfit ? `Profit: ${formatCurrency(r.profit_loss)}` : `Loss: ${formatCurrency(Math.abs(r.profit_loss))}`}
                    </p>
                  </div>

                  {/* Generation details */}
                  <div className="flex items-center justify-between text-[9px] text-text-muted border-t border-border pt-3">
                    <span className="font-bold uppercase">Generated</span>
                    <span className="font-mono">{formatDateFull(r.created_at)} at {formatTime12h(r.created_at)}</span>
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
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmGenerateReport}
                disabled={submitting}
                className="font-bold bg-teal-600 hover:bg-teal-700 text-white"
              >
                {submitting ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm mt-2">
            <p className="text-zinc-600 dark:text-zinc-400">
              This report creates an official financial snapshot of all transactions recorded since the previous report.
            </p>
            <p className="text-xs text-zinc-500 leading-normal">
              Generate it only when you're ready to finalize the current accounting period.
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
          title="Send Settlement Request?"
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
                {submitting ? 'Sending...' : 'Send Request'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm mt-2">
            <p className="text-zinc-600 dark:text-zinc-400">
              Are you sure you want to send this financial report for settlement approval?
            </p>
            <p className="text-xs text-zinc-500 leading-normal">
              Your school owner will review the report and its attached financial statement before approving or rejecting the request.
            </p>
            <p className="text-xs text-zinc-500 leading-normal font-semibold">
              Once submitted, the request will remain pending until the owner takes action.
            </p>
          </div>
        </Dialog>
      )}

    </div>
  </div>
  );
}
