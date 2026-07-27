import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Calendar, Download, RefreshCw, X, 
  FileText, CheckCircle2, CreditCard, Banknote, User, Clock,
  Smartphone, BookOpen, UserCheck, Receipt, Landmark
} from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../common/ui/table';
import { schoolService } from '../../../common/services/schoolService';
import { apiClient } from '../../../common/services/apiClient';
import html2pdf from 'html2pdf.js';

// Receipt Modal View Component (Official Branded Fee Receipt Layout)
function ReceiptModal({ receipt, student, schoolName, schoolLogoUrl, allPayments = [], onClose }) {
  const handlePrint = async () => {
    try {
      const studentId = student.student_id || student.id;
      const isAdditional = receipt.is_additional || (receipt.fee_name && receipt.fee_name !== 'Previous Year Dues' && !receipt.fee_month) ? 1 : 0;
      if (studentId) {
        const blob = await apiClient.get(`/api/school/students/${studentId}/fees/receipt?id=${receipt.id}&additional=${isAdditional}`);
        const url = window.URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        iframe.src = url;
        iframe.onload = () => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 2000);
        };
        return;
      }
    } catch (err) {
      console.error('Failed to print official receipt PDF, using DOM fallback:', err);
    }

    const printContent = document.getElementById('receipt-print-area').innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fee Payment Receipt</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #000; padding: 20px; }
          </style>
          <link rel="stylesheet" href="${window.location.origin}/assets/index.css" />
        </head>
        <body>
          <div>${printContent}</div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => { document.body.removeChild(iframe); }, 1000);
    }, 500);
  };

  const handleDownload = async () => {
    try {
      const studentId = student.student_id || student.id;
      const isAdditional = receipt.is_additional || (receipt.fee_name && receipt.fee_name !== 'Previous Year Dues' && !receipt.fee_month) ? 1 : 0;
      if (studentId) {
        const blob = await apiClient.get(`/api/school/students/${studentId}/fees/receipt?id=${receipt.id}&additional=${isAdditional}`);
        const cleanName = (student.name || 'Student').split(/\s+/).join('');
        const cleanYear = (student.academic_year_name || student.academic_year || '2027-2028').replace(/[–—]/g, '-');
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FeeReceipt_${cleanName}_${cleanYear}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.error('Failed to download official receipt PDF, using html2pdf fallback:', err);
    }

    const element = document.getElementById('receipt-print-area');
    const cleanName = (student.name || 'Student').split(/\s+/).join('');
    const cleanYear = (student.academic_year_name || student.academic_year || '2027-2028').replace(/[–—]/g, '-');
    const filename = `FeeReceipt_${cleanName}_${cleanYear}.pdf`;

    const opt = {
      margin:       10,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const getModeOfPayment = (method) => {
    if (!method) return 'Cash';
    const m = method.toLowerCase();
    if (m === 'cash') return 'Cash';
    if (m === 'cheque') return 'Cheque';
    return 'Online';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  };

  const groupPayments = receipt.is_additional
    ? [receipt]
    : (allPayments.length 
        ? allPayments.filter(p => p.receipt_no === receipt.receipt_no) 
        : [receipt]);

  const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
  
  const sortedGroup = [...groupPayments].sort((a, b) => {
    const idxA = academicMonths.indexOf(a.fee_month);
    const idxB = academicMonths.indexOf(b.fee_month);
    return idxA - idxB;
  });

  const totalAmountPaid = sortedGroup.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const displaySchoolName = schoolName || 'SHIKSHA PILOT SCHOOL';

  const currentYearName = student.academic_year_name || student.academic_year || '2026–2027';

  let feeMonthDisplay = '';
  if (receipt.is_additional) {
    feeMonthDisplay = receipt.fee_name;
  } else {
    const months = sortedGroup.map(p => p.fee_month);
    const indices = months.map(m => academicMonths.indexOf(m)).filter(idx => idx !== -1);
    let isConsecutive = false;
    if (indices.length > 1) {
      isConsecutive = indices.every((val, i) => i === 0 || val === indices[i - 1] + 1);
    }
    if (isConsecutive) {
      feeMonthDisplay = `${months[0]} To ${months[months.length - 1]}`;
    } else {
      feeMonthDisplay = months.join(', ');
    }
  }

  const monthLabel = receipt.is_additional ? 'Description:' : (sortedGroup.length > 1 ? 'Months:' : 'Month:');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-extrabold text-text-primary text-base tracking-tight font-display">Fee Payment Receipt</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        {/* Printable Official Receipt Body (Matching Screenshot 1) */}
        <div className="p-8 space-y-6 overflow-y-auto bg-white text-zinc-900" id="receipt-print-area">
          {/* Header Branding */}
          <div className="text-center space-y-1.5 flex flex-col items-center justify-center pb-2">
            {schoolLogoUrl ? (
              <img 
                src={schoolLogoUrl} 
                alt="School Logo" 
                className="h-14 w-auto mb-1 object-contain" 
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-amber-400 text-emerald-950 flex items-center justify-center font-black text-xl mb-1 shadow-xs border border-amber-500">
                {(displaySchoolName || 'S')[0]}
              </div>
            )}
            <h2 className="text-xl font-black tracking-tight text-slate-900 font-display uppercase">{displaySchoolName}</h2>
            <p className="text-xs uppercase font-extrabold tracking-widest text-slate-700">FEE PAYMENT RECEIPT</p>
            <div className="w-full border-t border-slate-300 pt-2 mt-2">
              <p className="text-xs font-semibold text-slate-600">Academic Year: {currentYearName}</p>
            </div>
          </div>

          {/* STUDENT INFORMATION SECTION BOX */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">STUDENT INFORMATION</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Student Name:</span>
                <span className="font-extrabold text-slate-900 uppercase">{student.name}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Class & Section:</span>
                <span className="font-extrabold text-slate-900">{student.class_name || 'Class 1'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Roll Number:</span>
                <span className="font-bold text-slate-800">{student.roll_no || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Admission No:</span>
                <span className="font-bold text-slate-800">{student.sr_no || student.admission_no || '—'}</span>
              </div>
            </div>
          </div>

          {/* PAYMENT DETAILS SECTION BOX */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">PAYMENT DETAILS</h4>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Mode of Payment:</span>
                <span className="font-extrabold text-slate-900">{getModeOfPayment(receipt.payment_method)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Reference Number:</span>
                <span className="font-mono font-bold text-slate-900">{receipt.receipt_no}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Payment Date:</span>
                <span className="font-bold text-slate-800">{formatDate(receipt.payment_date)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">{monthLabel}</span>
                <span className="font-extrabold text-slate-900">{feeMonthDisplay}</span>
              </div>
            </div>
          </div>

          {/* CENTERED TOTAL AMOUNT PAID BOX */}
          <div className="flex justify-center py-2">
            <div className="border-2 border-blue-200 bg-blue-50/50 rounded-xl p-5 text-center min-w-[240px]">
              <span className="text-xs font-black text-blue-900 uppercase tracking-wider block mb-1">TOTAL AMOUNT PAID</span>
              <span className="text-2xl font-black text-blue-950 font-display">Rs {totalAmountPaid.toLocaleString()}</span>
            </div>
          </div>

          {/* FOOTER NOTICE */}
          <div className="text-center text-[11px] text-slate-500 space-y-1 pt-2">
            <p>This is a computer-generated fee receipt. No signature is required.</p>
            <p className="font-semibold">Thank you for your payment.</p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="outline" className="font-bold text-xs" onClick={handlePrint}>Print</Button>
          <Button className="font-bold text-xs" onClick={handleDownload}>Download PDF</Button>
        </div>
      </div>
    </div>
  );
}

export default function CollectionHistoryPage() {
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    total_collected: 0,
    today_collection: 0,
    this_month_collection: 0,
    total_transactions: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL'); // ALL, monthly, additional
  const [selectedMethod, setSelectedMethod] = useState('ALL'); // ALL, Cash, Cheque, Online
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);

  const observerTarget = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [historyRes, profileRes] = await Promise.all([
        schoolService.getCollectionHistory({ page: 1, limit: 10 }),
        schoolService.getSchoolProfile().catch(() => null)
      ]);

      if (profileRes) {
        setSchoolProfile(profileRes);
      }

      setTransactions(historyRes.data || []);
      setStats({
        total_collected: historyRes.total_collected || 0,
        today_collection: historyRes.today_collection || 0,
        this_month_collection: historyRes.this_month_collection || 0,
        total_transactions: historyRes.total_transactions || 0
      });
      setAvailableMonths(historyRes.available_months || []);
      setPagination(historyRes.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      setHasMore((historyRes.pagination?.page || 1) < (historyRes.pagination?.pages || 1));
    } catch (err) {
      console.error('Failed to fetch collection history:', err);
      setError(err.message || 'Failed to load transaction history.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredData = async (page = 1, isAppend = false) => {
    if (isAppend) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const params = {
        page,
        limit: 10,
        month: selectedMonth !== 'ALL' ? selectedMonth : undefined,
        type: selectedType !== 'ALL' ? selectedType : undefined,
        payment_method: selectedMethod !== 'ALL' ? selectedMethod : undefined,
        search: searchQuery.trim() || undefined
      };

      const historyRes = await schoolService.getCollectionHistory(params);

      if (isAppend) {
        setTransactions(prev => [...prev, ...(historyRes.data || [])]);
      } else {
        setTransactions(historyRes.data || []);
      }

      setPagination(historyRes.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
      setHasMore((historyRes.pagination?.page || 1) < (historyRes.pagination?.pages || 1));
    } catch (err) {
      console.error('Failed to filter transactions:', err);
      setError(err.message || 'Failed to apply filters.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Trigger filter fetch when filter selections change
  useEffect(() => {
    fetchFilteredData(1, false);
  }, [selectedMonth, selectedType, selectedMethod]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFilteredData(1, false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFilteredData(pagination.page + 1, true);
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget.current, hasMore, loadingMore, loading, pagination.page]);

  const handleDownloadSingleReceipt = async (t) => {
    try {
      const isAdditional = t.type === 'additional' ? 1 : 0;
      const blob = await apiClient.get(`/api/school/students/${t.student_id}/fees/receipt?id=${t.id}&additional=${isAdditional}`);
      const cleanName = (t.student_name || 'Student').split(/\s+/).join('');
      const cleanYear = (t.academic_year_name || '2027-2028').replace(/[–—]/g, '-');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FeeReceipt_${cleanName}_${cleanYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setViewingReceipt(t);
    }
  };

  const formatCurrency = (val) => {
    return `₹${parseFloat(val || 0).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getPaymentMethodBadge = (method) => {
    const m = (method || 'cash').toLowerCase();
    if (m === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Banknote className="h-3 w-3" /> Cash
        </span>
      );
    }
    if (m === 'cheque') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <Landmark className="h-3 w-3" /> Cheque
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
        <Smartphone className="h-3 w-3" /> Online
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border p-5 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/school-admin/dashboard')}
            className="font-bold text-xs gap-2 border-border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">
              Collection History
            </h2>
            <p className="text-xs text-text-secondary font-medium mt-0.5">
              Comprehensive audit trail of all fee collections across current and previous sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchFilteredData(1, false)}
            disabled={loading}
            className="font-bold text-xs gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-surface border-border shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Total Collection</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-text-primary font-display">{formatCurrency(stats.total_collected)}</h3>
            <p className="text-[10px] font-bold text-text-muted mt-1">Lifetime total across history</p>
          </div>
        </Card>

        <Card className="p-5 bg-surface border-border shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Today's Collection</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-text-primary font-display">{formatCurrency(stats.today_collection)}</h3>
            <p className="text-[10px] font-bold text-text-muted mt-1">Collected today</p>
          </div>
        </Card>

        <Card className="p-5 bg-surface border-border shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">This Month</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-text-primary font-display">{formatCurrency(stats.this_month_collection)}</h3>
            <p className="text-[10px] font-bold text-text-muted mt-1">Current month total</p>
          </div>
        </Card>

        <Card className="p-5 bg-surface border-border shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Total Transactions</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-text-primary font-display">{stats.total_transactions.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] font-bold text-text-muted mt-1">Processed transactions</p>
          </div>
        </Card>
      </div>

      {/* Filter Control Bar */}
      <Card className="p-5 bg-surface border-border shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              placeholder="Search by student name, roll no, ref no..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 text-xs font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Month Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-text-muted uppercase">Month:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="h-9 text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-text-muted uppercase">Type:</span>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="h-9 text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Types</option>
                <option value="monthly">Monthly Fee</option>
                <option value="additional">Additional Fee</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-text-muted uppercase">Method:</span>
              <select
                value={selectedMethod}
                onChange={e => setSelectedMethod(e.target.value)}
                className="h-9 text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-border rounded-lg px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Methods</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Online">Online / UPI</option>
              </select>
            </div>

          </div>
        </div>
      </Card>

      {/* Main Transactions List / Cards */}
      <Card className="bg-surface border-border shadow-2xs overflow-hidden">
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
            {error}
          </div>
        )}

        {loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Collection History...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center space-y-2">
            <Receipt className="h-10 w-10 text-text-muted opacity-40 mb-1" />
            <h4 className="text-base font-extrabold text-text-primary font-display">No Transactions Found</h4>
            <p className="text-xs text-text-secondary max-w-sm">
              No collection records match your selected search query or filters.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/80 dark:bg-zinc-900/50">
                    <TableHead className="font-extrabold text-xs">Date & Time</TableHead>
                    <TableHead className="font-extrabold text-xs">Ref No.</TableHead>
                    <TableHead className="font-extrabold text-xs">Student Details</TableHead>
                    <TableHead className="font-extrabold text-xs">Fee Item / Month</TableHead>
                    <TableHead className="font-extrabold text-xs">Method</TableHead>
                    <TableHead className="font-extrabold text-xs text-right">Amount Paid</TableHead>
                    <TableHead className="font-extrabold text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    return (
                      <TableRow 
                        key={t.id}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                      >
                        <TableCell className="text-xs font-medium">
                          <div className="flex flex-col">
                            <span className="font-bold text-text-primary">{formatDate(t.payment_date)}</span>
                            <span className="text-[10px] text-text-muted">{t.academic_year_name || 'Current Session'}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs font-mono font-bold text-text-primary">
                          {t.receipt_no || `REC-${t.id}`}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-text-primary uppercase">{t.student_name}</span>
                            <span className="text-[10px] text-text-secondary font-medium">
                              {t.class_name} | Roll: {t.student_roll_no || '—'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="flex flex-col">
                            <span className="font-bold text-text-primary">
                              {t.type === 'additional' ? (t.fee_name || 'Additional Fee') : (t.fee_month || 'Monthly Fee')}
                            </span>
                            <span className="text-[10px] text-text-muted capitalize">
                              {t.type === 'additional' ? 'Additional Fee' : 'Tuition Fee'}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {getPaymentMethodBadge(t.payment_method)}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-emerald-600 font-mono">
                              +{formatCurrency(t.amount)}
                            </span>
                            {t.previous_total !== undefined && t.updated_total !== undefined && (
                              <span className="text-[9.5px] text-text-muted font-mono">
                                ₹{parseFloat(t.previous_total).toLocaleString('en-IN')} → ₹{parseFloat(t.updated_total).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="xs"
                            className="font-bold text-xs gap-1 hover:bg-primary hover:text-white transition-colors"
                            onClick={() => setViewingReceipt(t)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards List View */}
            <div className="md:hidden divide-y divide-border">
              {transactions.map((t) => {
                return (
                  <div key={t.id} className="p-4 space-y-3 bg-surface hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold font-mono text-text-muted uppercase tracking-wider block">
                          {t.receipt_no || `REC-${t.id}`}
                        </span>
                        <h4 className="text-sm font-black text-text-primary uppercase font-display mt-0.5">
                          {t.student_name}
                        </h4>
                        <p className="text-xs text-text-secondary font-medium">
                          {t.class_name} | Roll: {t.student_roll_no || '—'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-emerald-600 font-mono block">
                          +{formatCurrency(t.amount)}
                        </span>
                        {getPaymentMethodBadge(t.payment_method)}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-dashed border-border/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-text-primary block">
                          {t.type === 'additional' ? (t.fee_name || 'Additional Fee') : (t.fee_month || 'Monthly Fee')}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {formatDate(t.payment_date)}
                        </span>
                      </div>

                      <Button 
                        variant="secondary" 
                        size="xs" 
                        className="h-8 text-xs font-bold gap-1.5"
                        onClick={() => setViewingReceipt(t)}
                      >
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        View Receipt
                      </Button>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Scroll Sentinel / Loader */}
            {(loadingMore || hasMore) && (
              <div 
                ref={observerTarget} 
                className="flex flex-col items-center justify-center py-6 gap-2 bg-zinc-50/50 dark:bg-zinc-900/10 border-t border-border"
              >
                {loadingMore ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider animate-pulse">
                      Loading More Transactions
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                    Scroll to load more
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Fee Payment Receipt Popup Modal */}
      {viewingReceipt && (
        <ReceiptModal 
          receipt={{
            ...viewingReceipt,
            id: viewingReceipt.id,
            is_additional: viewingReceipt.type === 'additional',
            amount_paid: viewingReceipt.amount
          }} 
          student={{
            id: viewingReceipt.student_id,
            student_id: viewingReceipt.student_id,
            name: viewingReceipt.student_name,
            class_name: viewingReceipt.class_name,
            roll_no: viewingReceipt.student_roll_no || '—',
            sr_no: viewingReceipt.student_sr_no || '—',
            academic_year_name: viewingReceipt.academic_year_name
          }} 
          schoolName={schoolProfile?.name}
          schoolLogoUrl={schoolProfile?.logo_path}
          allPayments={transactions.map(t => ({
            ...t,
            is_additional: t.type === 'additional',
            amount_paid: t.amount
          }))}
          onClose={() => setViewingReceipt(null)} 
        />
      )}

    </div>
  );
}
