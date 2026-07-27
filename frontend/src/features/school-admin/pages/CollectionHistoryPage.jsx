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
import { FeeReceiptModal } from '../components/FeeReceiptModal';
import html2pdf from 'html2pdf.js';
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
  
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [schoolProfile, setSchoolProfile] = useState(null);
  
  const [viewingReceipt, setViewingReceipt] = useState(null);

  const observerTarget = useRef(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadHistory = async (forcePage1 = false) => {
    const isInitial = page === 1 || forcePage1;
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const response = await schoolService.getCollectionHistory({
        month: selectedMonth,
        search: debouncedSearch,
        page: isInitial ? 1 : page,
        limit: 10
      });
      
      const newTx = response.transactions || [];
      if (isInitial) {
        setTransactions(newTx);
      } else {
        setTransactions(prev => {
          // Avoid duplicate rows sharing the same Ref No if triggered multiple times
          const existingIds = new Set(prev.map(item => `${item.type}-${item.id}`));
          const filteredNewTx = newTx.filter(item => !existingIds.has(`${item.type}-${item.id}`));
          return [...prev, ...filteredNewTx];
        });
      }
      
      setStats(response.stats || {
        total_collected: 0,
        today_collection: 0,
        this_month_collection: 0,
        total_transactions: 0
      });
      
      const p = response.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        pages: 1
      };
      setPagination(p);
      
      if (response.available_months && response.available_months.length > 0) {
        setAvailableMonths(response.available_months);
      }
      
      setHasMore(isInitial ? (newTx.length < p.total) : (page < p.pages));
    } catch (err) {
      console.error("Failed to load collection history:", err);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Load school profile for receipt branding
  useEffect(() => {
    schoolService.getSchoolProfile()
      .then(profile => setSchoolProfile(profile))
      .catch(err => console.error("Failed to load school profile", err));
  }, []);

  // Filter or search changes: reset to page 1
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    } else {
      loadHistory(true);
    }
  }, [selectedMonth, debouncedSearch]);

  // Page index changes: fetch more records
  useEffect(() => {
    if (page > 1) {
      loadHistory(false);
    }
  }, [page]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  // Date formatter e.g., "15 July 2027"
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  };

  // Clean student name by removing fallback dots
  const cleanStudentName = (name) => {
    if (!name) return '';
    const trimmed = name.trim();
    return trimmed.endsWith('.') ? trimmed.replace(/\s*\.$/, '') : name;
  };

  // Time formatter e.g., "10:35 AM"
  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
      // Fallback if it's already a time string or a relative date format
      const match = timeStr.match(/\d{2}:\d{2}:\d{2}/);
      if (match) {
        const parts = match[0].split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        return `${hours}:${minutes} ${ampm}`;
      }
      return timeStr;
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getMethodIcon = (method) => {
    const m = (method || '').toUpperCase();
    if (m === 'UPI') return Smartphone;
    if (m === 'CARD') return CreditCard;
    if (m === 'BANK TRANSFER') return Landmark;
    return Banknote;
  };

  const handleDownloadSingleReceipt = (receipt) => {
    setViewingReceipt(receipt);
  };

  const getDynamicMonthCardTitle = () => {
    if (selectedMonth === 'All Months') {
      return 'ALL MONTHS';
    }
    const parts = selectedMonth.split(' ');
    if (parts.length > 0) {
      return `${parts[0].toUpperCase()} MONTH`;
    }
    return 'THIS MONTH';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Navigation and Title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <button 
            onClick={() => navigate('/school-admin')} 
            className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors mb-2 uppercase tracking-wider"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>
          <h1 className="text-2xl font-black text-text-primary tracking-tight font-display">Collection History</h1>
          <p className="text-xs text-text-secondary">
            View every fee collection transaction with complete payment history.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Fee Collected', value: `₹${parseFloat(stats.total_collected).toLocaleString('en-IN')}`, icon: Banknote, color: 'text-primary bg-primary/5 border-primary/10' },
          { label: "Today's Collection", value: `₹${parseFloat(stats.today_collection).toLocaleString('en-IN')}`, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-500/20' },
          { label: getDynamicMonthCardTitle(), value: `₹${parseFloat(stats.this_month_collection).toLocaleString('en-IN')}`, icon: Calendar, color: 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-500/20' },
          { label: 'Total Transactions', value: stats.total_transactions.toString(), icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-500/20' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i} className="shadow-xs border border-border bg-surface">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">{c.label}</p>
                  <p className="text-xl font-black text-text-primary tracking-tight font-display">{c.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${c.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters and Search Control Box */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, receipt, class..."
            className="pl-10 text-xs font-semibold py-2.5 h-10"
          />
        </div>

        {/* Month Selector dropdown */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-bold text-text-secondary shrink-0 flex items-center gap-1.5 uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5 text-text-muted" /> Filter Month:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-56 rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold focus:border-primary focus:ring-primary outline-none h-10 cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction History Log table */}
      <Card className="shadow-xs border border-border bg-surface overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-7 w-7 text-primary animate-spin" />
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading history...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto space-y-4">
            <div className="p-4 rounded-full bg-zinc-50 border border-zinc-100 dark:bg-zinc-900/50 dark:border-zinc-800 text-text-muted">
              <FileText className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-text-primary text-base tracking-tight font-display">No Collection History Found</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-medium">
                No fee collection transactions were recorded during the selected month.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/20">
                    <TableHead className="font-bold text-xs whitespace-nowrap">Ref No.</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Date & Time</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Name & Class</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap">Fee Description</TableHead>
                    <TableHead className="font-bold text-xs text-left whitespace-nowrap">Amount (₹)</TableHead>
                    <TableHead className="font-bold text-xs text-center whitespace-nowrap">(Prev → Credit → New)</TableHead>
                    <TableHead className="font-bold text-xs text-right whitespace-nowrap">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => {
                    return (
                      <TableRow key={`${t.type}-${t.id}`}>
                        {/* Ref No. */}
                        <TableCell className="font-mono text-xs font-bold text-text-primary py-4 whitespace-nowrap">
                          {t.receipt_no}
                        </TableCell>
                        
                        {/* Date and Time */}
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-bold text-text-primary">{formatDate(t.payment_date)}</div>
                          <div className="text-[10px] text-text-muted font-mono">{formatTime(t.created_at)}</div>
                        </TableCell>

                        {/* Name & Class */}
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-extrabold text-text-primary uppercase tracking-wider">{cleanStudentName(t.student_name)}</div>
                          <div className="text-[10px] text-text-secondary mt-0.5">{t.class_name}</div>
                        </TableCell>

                        {/* Fee Name */}
                        <TableCell className="text-xs font-bold text-text-secondary whitespace-nowrap">
                          {t.fee_name}
                        </TableCell>

                        {/* Amount */}
                        <TableCell className="text-left font-mono font-black text-emerald-600 text-sm whitespace-nowrap">
                          + ₹{t.amount.toLocaleString('en-IN')}
                        </TableCell>

                        {/* Balance flow (Bank Statements Style) */}
                        <TableCell className="text-center text-xs py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-text-secondary bg-zinc-50 dark:bg-zinc-900/50 py-1.5 px-3 rounded-lg border border-border max-w-[340px] mx-auto">
                            <span className="text-text-muted font-mono">₹{parseFloat(t.previous_total).toLocaleString('en-IN')}</span>
                            <span className="text-text-muted">→</span>
                            <span className="text-emerald-600 font-black font-mono">+₹{t.amount.toLocaleString('en-IN')}</span>
                            <span className="text-text-muted">→</span>
                            <span className="font-black text-text-primary font-mono">₹{parseFloat(t.updated_total).toLocaleString('en-IN')}</span>
                          </div>
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right whitespace-nowrap">
                          <Button 
                            variant="secondary" 
                            size="xs" 
                            className="h-7 w-20 text-[10px] px-0 font-bold"
                            onClick={() => handleDownloadSingleReceipt(t)}
                          >
                            Receipt
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border">
              {transactions.map((t) => {
                return (
                  <div key={`${t.type}-${t.id}`} className="p-4 space-y-3.5 bg-surface">
                    
                    {/* Top Row - Ref No & Amount */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-text-primary block">{t.receipt_no}</span>
                        <span className="text-[10px] text-text-muted font-mono">{formatDate(t.payment_date)} • {formatTime(t.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-emerald-600 text-sm block">+ ₹{t.amount.toLocaleString('en-IN')}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 mt-1">
                          Completed
                        </span>
                      </div>
                    </div>

                    {/* Middle Block - Student & Fee Info */}
                    <div className="text-xs space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 rounded-xl border border-border/80">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Name & Class:</span>
                        <span className="font-extrabold text-text-primary uppercase">{cleanStudentName(t.student_name)} ({t.class_name})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Fee Description:</span>
                        <span className="font-bold text-text-secondary">{t.fee_name}</span>
                      </div>
                    </div>

                    {/* Bottom Row - Running balance and actions */}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-between sm:items-center pt-1">
                      {/* Flow */}
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                        <span className="text-text-muted font-mono">₹{parseFloat(t.previous_total).toLocaleString('en-IN')}</span>
                        <span>→</span>
                        <span className="text-emerald-600 font-black font-mono">+₹{t.amount.toLocaleString('en-IN')}</span>
                        <span>→</span>
                        <span className="font-black text-text-primary font-mono">₹{parseFloat(t.updated_total).toLocaleString('en-IN')}</span>
                      </div>
                      
                      {/* Button */}
                      <Button 
                        variant="secondary" 
                        size="xs" 
                        className="h-7 w-full sm:w-24 text-[10px] font-bold"
                        onClick={() => handleDownloadSingleReceipt(t)}
                      >
                        Download Receipt
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

      {/* Fee Payment Receipt Popup */}
      {viewingReceipt && (
        <FeeReceiptModal 
          receipt={{
            ...viewingReceipt,
            is_additional: viewingReceipt.type === 'additional',
            amount_paid: viewingReceipt.amount
          }} 
          student={{
            id: viewingReceipt.student_id,
            name: viewingReceipt.student_name,
            class_name: viewingReceipt.class_name,
            roll_no: viewingReceipt.student_roll_no || '—',
            sr_no: viewingReceipt.student_sr_no || '—',
            academic_year_name: viewingReceipt.academic_year_name
          }} 
          schoolName={schoolProfile?.name}
          schoolLogoUrl={schoolProfile?.logo_url}
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
