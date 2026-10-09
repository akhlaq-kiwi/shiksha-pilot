import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Calendar, Download, RefreshCw, X, 
  FileText, CheckCircle2, CreditCard, Banknote, User, Clock,
  Smartphone, BookOpen, UserCheck, Receipt, Landmark, ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../common/ui/table';
import { schoolService } from '../../../common/services/schoolService';
import { FeeReceiptModal } from '../components/FeeReceiptModal';
import html2pdf from 'html2pdf.js';

function CustomSelect({ options, value, onChange, placeholder = "Select...", disabled = false, className = "", buttonClassName = "", dropdownClassName = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${isOpen ? 'z-50' : 'z-10'} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex h-10 items-center justify-between gap-2.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold text-text-primary shadow-2xs outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-border focus-visible:border-border active:outline-none select-none transition-colors min-w-[120px] ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-border-strong'
        } ${buttonClassName}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform duration-200 flex-shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className={`absolute right-0 top-full mt-1.5 min-w-full w-max max-w-xs rounded-2xl border border-border bg-surface shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150 ${dropdownClassName}`}>
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap outline-none focus:outline-none select-none transition-colors hover:bg-primary/10 ${isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-text-primary'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
  const defaultPeriods = ['ALL TIME', 'SINCE LAST REPORT'];
  const [availablePeriods, setAvailablePeriods] = useState(defaultPeriods);
  const [availableCollectors, setAvailableCollectors] = useState([]);
  
  const [selectedPeriod, setSelectedPeriod] = useState('ALL TIME');
  const [selectedCollector, setSelectedCollector] = useState('All Users');
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
        period: selectedPeriod,
        month: selectedPeriod,
        deposit_by: selectedCollector,
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
          const existingIds = new Set(prev.map(item => `${item.type}-${item.history_id || item.id}`));
          const filteredNewTx = newTx.filter(item => !existingIds.has(`${item.type}-${item.history_id || item.id}`));
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
      
      const periodsList = response.available_periods || response.available_months || [];
      if (periodsList.length > 0) {
        setAvailablePeriods(periodsList);
      } else {
        setAvailablePeriods(defaultPeriods);
      }

      if (response.available_collectors && response.available_collectors.length > 0) {
        setAvailableCollectors(response.available_collectors);
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
  }, [selectedPeriod, selectedCollector, debouncedSearch]);

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
      const match = timeStr.match(/\d{2}:\d{2}:\d{2}/);
      if (match) {
        const parts = match[0].split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
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

  const getDynamicPeriodCardTitle = () => {
    if (!selectedPeriod || selectedPeriod === 'All Periods' || selectedPeriod === 'All Months') {
      return 'ALL PERIODS';
    }
    return selectedPeriod.toUpperCase();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header Container */}
      <div className="p-5 rounded-2xl border border-border bg-zinc-50/50 dark:bg-zinc-900/50 shadow-2xs flex flex-col justify-between gap-1">
        <h1 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight font-display uppercase leading-none">
          COLLECTION HISTORY
        </h1>
        <p className="text-xs text-text-secondary mt-1 font-medium">
          View every fee collection transaction with complete payment history.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Fee Collected', value: `₹${parseFloat(stats.total_collected).toLocaleString('en-IN')}`, icon: Banknote, color: 'text-primary bg-primary/5 border-primary/10' },
          { label: "Today's Collection", value: `₹${parseFloat(stats.today_collection).toLocaleString('en-IN')}`, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-500/20' },
          { label: getDynamicPeriodCardTitle(), value: `₹${parseFloat(stats.this_month_collection).toLocaleString('en-IN')}`, icon: Calendar, color: 'text-primary bg-primary/10 border-primary/20' },
          { label: 'Total Transactions', value: stats.total_transactions.toString(), icon: FileText, color: 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-950/20 dark:border-purple-500/20' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i} className="shadow-xs border border-border bg-surface">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{c.label}</p>
                  <p className="text-xl font-bold text-text-primary tracking-tight font-display">{c.value}</p>
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
      <div className="relative z-30 bg-zinc-50/50 dark:bg-zinc-900/50 border border-border rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row gap-4 justify-between items-center">
        
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, receipt, class..."
            className="pl-10 text-xs font-semibold py-2.5 h-10 rounded-full outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-border focus-visible:border-border"
          />
        </div>

        {/* Filter Dropdowns (Deposit By & Filter Month) */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 sm:gap-5 w-full md:w-auto ml-auto">
          {/* Deposit By Selector dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-text-secondary shrink-0 flex items-center gap-1.5 uppercase tracking-wider">
              <User className="h-3.5 w-3.5 text-text-muted" /> Deposit By:
            </label>
            <CustomSelect
              value={selectedCollector}
              onChange={(val) => {
                setSelectedCollector(val);
                setPage(1);
              }}
              buttonClassName="w-36"
              options={(availableCollectors.length > 0 ? availableCollectors : [{ name: 'All Users', label: 'All Users' }]).map((c) => ({
                value: c.name,
                label: c.phone || c.label || c.name
              }))}
            />
          </div>

          {/* Period Selector dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-text-secondary shrink-0 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5 text-text-muted" /> Filter Period:
            </label>
            <CustomSelect
              value={selectedPeriod}
              onChange={(val) => {
                setSelectedPeriod(val);
                setPage(1);
              }}
              buttonClassName="w-44"
              options={(availablePeriods.length > 0 ? availablePeriods : defaultPeriods).map((p) => ({
                value: p,
                label: p
              }))}
            />
          </div>
        </div>
      </div>

      {/* Transaction History Log table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-2xs">
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
              <h3 className="font-bold text-text-primary text-base tracking-tight font-display">No Collection History Found</h3>
              <p className="text-xs text-text-secondary leading-relaxed font-medium">
                No fee collection transactions were recorded during the selected month.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table containerClassName="border-0 rounded-none shadow-none bg-transparent">
                <TableHeader className="bg-[#FAF6EC] dark:bg-zinc-900/50 border-b border-border">
                  <TableRow className="bg-[#FAF6EC] dark:bg-zinc-900/50 hover:bg-[#FAF6EC] dark:hover:bg-zinc-900/50">
                    <TableHead className="font-bold text-xs whitespace-nowrap text-text-secondary bg-[#FAF6EC] dark:bg-zinc-900/50">Deposit By</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap text-text-secondary bg-[#FAF6EC] dark:bg-zinc-900/50">Ref No.</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap text-text-secondary bg-[#FAF6EC] dark:bg-zinc-900/50">Date & Time</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap text-text-secondary bg-[#FAF6EC] dark:bg-zinc-900/50">Name & Class</TableHead>
                    <TableHead className="font-bold text-xs whitespace-nowrap text-text-secondary bg-[#FAF6EC] dark:bg-zinc-900/50">Fee Description</TableHead>
                    <TableHead className="font-bold text-xs text-center whitespace-nowrap text-text-secondary bg-[#FAF6EC] dark:bg-zinc-900/50">(Prev → Credit → New)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t, idx) => {
                    const rowKey = `${t.type}-${t.history_id || t.id || idx}`;
                    return (
                      <TableRow 
                        key={rowKey}
                        onClick={() => {
                          if (t.student_id) {
                            navigate(`/school-admin/classes?studentId=${t.student_id}`, {
                              state: { from: location.pathname + location.search }
                            });
                          }
                        }}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                      >
                        {/* Deposit By (User Name & Phone) */}
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-bold text-text-primary uppercase tracking-wider">
                            {t.is_admin_collector ? 'ADMIN' : (t.display_collector_name || t.collected_by || 'ADMIN')}
                          </div>
                          <div className="text-[11px] text-text-muted font-mono">{t.collector_phone || '—'}</div>
                        </TableCell>

                        {/* Ref No. */}
                        <TableCell className="font-mono text-xs font-bold text-text-primary py-4 whitespace-nowrap">
                          {t.receipt_no}
                        </TableCell>
                        
                        {/* Date and Time */}
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-bold text-text-primary">{formatDate(t.payment_date)}</div>
                          <div className="text-[11px] text-text-muted font-mono">{formatTime(t.created_at)}</div>
                        </TableCell>

                        {/* Name & Class */}
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-bold text-text-primary uppercase tracking-wider">{cleanStudentName(t.student_name)}</div>
                          <div className="text-[11px] text-text-secondary mt-0.5">{t.class_name}</div>
                        </TableCell>

                        {/* Fee Name */}
                        <TableCell className="text-xs font-bold text-text-secondary whitespace-nowrap">
                          {t.fee_name}
                        </TableCell>

                        {/* Balance flow (Bank Statements Style) */}
                        <TableCell className="text-center text-xs py-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 py-1.5 px-4 rounded-full max-w-[340px] mx-auto">
                            <span className="text-amber-800/80 dark:text-amber-300/80 font-mono">₹{parseFloat(t.previous_total).toLocaleString('en-IN')}</span>
                            <span className="text-amber-600/70 dark:text-amber-400/70">→</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">+₹{t.amount.toLocaleString('en-IN')}</span>
                            <span className="text-amber-600/70 dark:text-amber-400/70">→</span>
                            <span className="font-bold text-amber-950 dark:text-amber-100 font-mono">₹{parseFloat(t.updated_total).toLocaleString('en-IN')}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border">
              {transactions.map((t, idx) => {
                const cardKey = `${t.type}-${t.history_id || t.id || idx}`;
                return (
                  <div 
                    key={cardKey} 
                    onClick={() => {
                      if (t.student_id) {
                        navigate(`/school-admin/classes?studentId=${t.student_id}`, {
                          state: { from: location.pathname + location.search }
                        });
                      }
                    }}
                    className="p-4 space-y-3.5 bg-surface hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                  >
                    
                    {/* Top Row - Ref No & Amount */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-text-primary block">{t.receipt_no}</span>
                        <span className="text-[11px] text-text-muted font-mono">{formatDate(t.payment_date)} • {formatTime(t.created_at)}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-600 text-sm block">+ ₹{t.amount.toLocaleString('en-IN')}</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/10 mt-1">
                          Completed
                        </span>
                      </div>
                    </div>

                    {/* Middle Block - Student & Fee Info */}
                    <div className="text-xs space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 rounded-xl border border-border/80">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Deposit By:</span>
                        <span className="font-bold text-text-primary uppercase">
                          {t.is_admin_collector ? 'ADMIN' : (t.display_collector_name || t.collected_by || 'ADMIN')} {t.collector_phone ? `(${t.collector_phone})` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Name & Class:</span>
                        <span className="font-bold text-text-primary uppercase">{cleanStudentName(t.student_name)} ({t.class_name})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Fee Description:</span>
                        <span className="font-bold text-text-secondary">{t.fee_name}</span>
                      </div>
                    </div>

                    {/* Bottom Row - Running balance */}
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 py-1.5 px-3 rounded-full">
                      <span className="text-amber-800/80 dark:text-amber-300/80 font-mono">₹{parseFloat(t.previous_total).toLocaleString('en-IN')}</span>
                      <span className="text-amber-600/70 dark:text-amber-400/70">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">+₹{t.amount.toLocaleString('en-IN')}</span>
                      <span className="text-amber-600/70 dark:text-amber-400/70">→</span>
                      <span className="font-bold text-amber-950 dark:text-amber-100 font-mono">₹{parseFloat(t.updated_total).toLocaleString('en-IN')}</span>
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
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Scroll to load more
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Fee Payment Receipt Popup */}
      {viewingReceipt && (
        <FeeReceiptModal 
          receipt={{
            ...viewingReceipt,
            is_additional: viewingReceipt.type === 'additional',
            amount_paid: viewingReceipt.amount_paid !== undefined ? viewingReceipt.amount_paid : viewingReceipt.amount,
            discount_amount: viewingReceipt.discount_amount || 0
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
            amount_paid: t.amount_paid !== undefined ? t.amount_paid : t.amount,
            discount_amount: t.discount_amount || 0
          }))}
          additionalFeePayments={transactions.map(t => ({
            ...t,
            is_additional: t.type === 'additional',
            amount_paid: t.amount_paid !== undefined ? t.amount_paid : t.amount,
            discount_amount: t.discount_amount || 0
          }))}
          onClose={() => setViewingReceipt(null)} 
        />
      )}

    </div>
  );
}
