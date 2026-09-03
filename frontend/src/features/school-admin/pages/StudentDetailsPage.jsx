import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../common/ui/button';
import { Dialog } from '../../../common/ui/dialog';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { schoolService } from '../../../common/services/schoolService';
import { apiClient } from '../../../common/services/apiClient';
import html2pdf from 'html2pdf.js';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { FeeReceiptModal } from '../components/FeeReceiptModal';
import { formatCurrency } from '../../../common/utils/format';
import { resolveFileUrl } from '../../../common/utils/fileUrl';
import {
  User, BookOpen, Users, Home, Calendar, FileText,
  Download, Printer, AlertCircle, Eye, ChevronDown, ChevronUp, X, ShieldAlert, Phone
} from 'lucide-react';

// Self-healing avatar image component to handle loading errors gracefully
const StudentAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : src;
    const cleanUrl = updatedAt ? `${fileUrl}?v=${encodeURIComponent(updatedAt)}` : fileUrl;
    return (
      <img 
        src={cleanUrl} 
        alt={name} 
        onError={() => setError(true)} 
        className="w-full h-full object-cover" 
      />
    );
  }
  
  return <User className="h-10 w-10 text-zinc-400" />;
};

// Inline Document Viewer Modal Component
function DocumentViewerModal({ docName, docPath, onClose }) {
  const fileUrl = docPath.startsWith('http') ? docPath : docPath;
  const isPdf = docPath.toLowerCase().endsWith('.pdf');

  const handleDownload = async () => {
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(fileUrl, '_blank');
    }
  };

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = fileUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-bold text-text-primary text-base tracking-tight">{docName}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 p-6 bg-zinc-100 dark:bg-zinc-950 overflow-auto flex items-center justify-center min-h-[350px]">
          {isPdf ? (
            <iframe 
              src={fileUrl} 
              className="w-full h-[500px] border border-border rounded-lg shadow-sm bg-white" 
              title={docName} 
            />
          ) : (
            <img 
              src={fileUrl} 
              alt={docName} 
              className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm border border-border" 
            />
          )}
        </div>

        {/* Footer toolbar */}
        <div className="px-6 py-4 border-t border-border bg-surface flex flex-wrap items-center justify-end gap-3">
          <Button variant="secondary" className="flex items-center gap-1.5" onClick={() => window.open(fileUrl, '_blank')}>
            <Eye className="h-4 w-4" /> View Document
          </Button>
          <Button variant="secondary" className="flex items-center gap-1.5" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button className="flex items-center gap-1.5 font-bold" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}

// Deposit Modal Component (Supports partial payment & consecutive sequence)
function DepositModal({ student, payments = [], classFeeConfig, onSave, onClose }) {
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [depositAmounts, setDepositAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

  // Total configured fee for month m
  const getMonthlyFee = (m) => {
    if (classFeeConfig && classFeeConfig.monthly_fees && classFeeConfig.monthly_fees[m]) {
      return parseFloat(classFeeConfig.monthly_fees[m]);
    }
    const firstPaidAmount = payments[0]?.amount_paid ? parseFloat(payments[0].amount_paid) : 0;
    return firstPaidAmount;
  };

  // Amount already paid for month m (including discount)
  const getPaidSoFar = (m) => {
    return payments
      .filter(p => p.fee_month === m)
      .reduce((sum, p) => sum + parseFloat(p.amount_paid || 0) + parseFloat(p.discount_amount || 0), 0);
  };

  // Remaining fee for month m
  const getRemainingFee = (m) => {
    return Math.max(0, getMonthlyFee(m) - getPaidSoFar(m));
  };

  // Is month fully paid
  const isMonthFullyPaid = (m) => {
    const totalFee = getMonthlyFee(m);
    if (totalFee === 0) return false;
    return getRemainingFee(m) <= 0.01;
  };

  // Earliest unpaid month in sequence
  const getEarliestUnpaid = () => {
    return academicMonths.find(m => !isMonthFullyPaid(m));
  };

  // Check if there is any partially paid month in academicMonths (where paid > 0 && remaining > 0.01)
  const partialMonth = academicMonths.find(m => !isMonthFullyPaid(m) && getPaidSoFar(m) > 0 && getRemainingFee(m) > 0.01);

  const handleMonthToggle = (month) => {
    if (isMonthFullyPaid(month)) return;

    // If a partially paid month exists, it MUST be deposited separately!
    if (partialMonth) {
      if (month !== partialMonth) {
        setError(`Month ${partialMonth} has a remaining balance of ₹${getRemainingFee(partialMonth).toLocaleString()} and must be deposited separately first.`);
        return;
      }
      if (selectedMonths.includes(partialMonth)) {
        setSelectedMonths([]);
        setDepositAmounts({});
      } else {
        setSelectedMonths([partialMonth]);
        setDepositAmounts({ [partialMonth]: getRemainingFee(partialMonth) });
      }
      setError('');
      return;
    }

    const earliestUnpaid = getEarliestUnpaid();
    const idxOfToggle = academicMonths.indexOf(month);
    const idxOfEarliest = academicMonths.indexOf(earliestUnpaid);

    if (selectedMonths.includes(month)) {
      // Unchecking month: also uncheck subsequent months
      const nextSelection = selectedMonths.filter(m => academicMonths.indexOf(m) < idxOfToggle);
      setSelectedMonths(nextSelection);

      const newAmounts = { ...depositAmounts };
      academicMonths.forEach((m, idx) => {
        if (idx >= idxOfToggle) {
          delete newAmounts[m];
        }
      });
      // If multiple months remain, reset all to full remaining fees
      if (nextSelection.length > 1) {
        nextSelection.forEach(mName => {
          newAmounts[mName] = getRemainingFee(mName);
        });
      }
      setDepositAmounts(newAmounts);
      setError('');
    } else {
      // Checking month: ensure all months from earliestUnpaid to month are checked
      if (idxOfToggle < idxOfEarliest) {
        setError('Invalid month selection.');
        return;
      }

      const nextSelection = [];
      const newAmounts = { ...depositAmounts };

      for (let i = idxOfEarliest; i <= idxOfToggle; i++) {
        const mName = academicMonths[i];
        if (!isMonthFullyPaid(mName)) {
          nextSelection.push(mName);
          newAmounts[mName] = getRemainingFee(mName);
        }
      }
      setSelectedMonths(nextSelection);
      setDepositAmounts(newAmounts);
      setError('');
    }
  };

  const handleAmountChange = (m, value) => {
    // Only positive whole numbers allowed (no decimals, no negative numbers)
    const sanitized = value.replace(/[^0-9]/g, '');
    const num = sanitized === '' ? '' : parseInt(sanitized, 10);
    setDepositAmounts(prev => ({
      ...prev,
      [m]: num
    }));
    setError('');
  };

  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');

  const handleToggleApplyDiscount = (checked) => {
    setApplyDiscount(checked);
    if (!checked) {
      setDiscountAmount('');
    }
    setError('');
    const newAmounts = {};
    selectedMonths.forEach(m => {
      newAmounts[m] = getRemainingFee(m);
    });
    setDepositAmounts(newAmounts);
  };

  const getDiscAmount = () => {
    return applyDiscount && discountAmount !== '' && discountAmount !== null ? (parseFloat(discountAmount) || 0) : 0;
  };

  const calculateGrossTotal = () => {
    return selectedMonths.reduce((sum, m) => {
      const amt = selectedMonths.length === 1 ? (parseFloat(depositAmounts[m]) || getRemainingFee(m)) : getRemainingFee(m);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  };

  const calculateTotalDeposit = () => {
    const gross = calculateGrossTotal();
    const disc = getDiscAmount();
    return Math.max(0, gross - disc);
  };

  // Live validation
  const validateForm = () => {
    if (selectedMonths.length === 0) {
      return 'Please select at least one month.';
    }
    const gross = calculateGrossTotal();
    const disc = getDiscAmount();

    if (applyDiscount && discountAmount !== '' && discountAmount !== null) {
      if (isNaN(disc) || disc < 0 || !Number.isInteger(disc)) {
        return 'Please enter a valid positive whole number for discount amount.';
      }
      if (disc >= gross) {
        return `Discount amount (₹${disc}) must be less than payable fee (₹${gross.toLocaleString()}).`;
      }
    }
    if (selectedMonths.length === 1) {
      const m = selectedMonths[0];
      const remaining = getRemainingFee(m);
      const val = depositAmounts[m];
      const amt = parseFloat(val);
      if (val === '' || val === null || isNaN(amt) || amt <= 0 || !Number.isInteger(amt)) {
        return `Please enter a valid positive whole number for ${m}.`;
      }
      if (amt > remaining + 0.01) {
        return `Amount cannot exceed the remaining fee of ₹${remaining.toLocaleString()} for ${m}.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const valErr = validateForm();
    if (valErr) {
      setError(valErr);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const monthAmountsPayload = {};
      const isSingleMonth = selectedMonths.length === 1;
      const discApplied = getDiscAmount();

      selectedMonths.forEach(m => {
        const val = depositAmounts[m];
        const userTypedAmt = isSingleMonth ? (parseFloat(val) || getRemainingFee(m)) : getRemainingFee(m);
        const netCashPaid = Math.max(0, userTypedAmt - discApplied);
        monthAmountsPayload[m] = netCashPaid;
      });

      await schoolService.createFeePayment({
        student_id: student.id,
        months: selectedMonths,
        month_amounts: monthAmountsPayload,
        discount_amount: discApplied,
        payment_method: paymentMethod
      });
      window.dispatchEvent(new Event('fee-payment-updated'));
      onSave();
    } catch (err) {
      console.error(err);
      const errRes = err.data || err.response?.data;
      const msg = errRes?.errors?.months || errRes?.errors?.fee_structure || errRes?.errors?.class_id || errRes?.message || err.message || 'Failed to deposit fees.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const isSingleMonth = selectedMonths.length === 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-bold text-text-primary text-base tracking-tight">Deposit Fees</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Apply Discount Toggle Row */}
          <div className="flex items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-border">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={applyDiscount}
                onChange={(e) => handleToggleApplyDiscount(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-primary relative"></div>
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Apply Discount</span>
            </label>

            {applyDiscount && (
              <div className="relative flex-1 max-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                <input 
                  type="number"
                  min="0"
                  placeholder="Discount Amount"
                  value={discountAmount}
                  onKeyDown={(e) => {
                    if (['.', '-', 'e', '+', ','].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9]/g, '');
                    setDiscountAmount(sanitized === '' ? '' : parseInt(sanitized, 10));
                    setError('');
                  }}
                  className="w-full rounded-lg border border-border bg-surface text-text-primary pl-7 pr-3 py-1.5 text-xs font-bold outline-none focus:border-primary focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold focus:border-primary focus:ring-primary outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-[11px] font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Month Checkboxes list */}
          <div className="space-y-2.5 border border-border rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-900/10">
            {academicMonths.map(m => {
              const totalFee = getMonthlyFee(m);
              const paidSoFar = getPaidSoFar(m);
              const remaining = getRemainingFee(m);
              const isPaid = isMonthFullyPaid(m);
              const isPartial = paidSoFar > 0 && remaining > 0;
              const isChecked = selectedMonths.includes(m);
              const shouldExpand = isSingleMonth && isChecked && !isPaid && !applyDiscount;

              const currentAmt = depositAmounts[m] !== undefined ? depositAmounts[m] : remaining;
              const numAmt = parseFloat(currentAmt) || 0;
              const disc = getDiscAmount();
              const remAfter = Math.max(0, remaining - (numAmt + disc));
              const isOver = numAmt > remaining + 0.01;

              return (
                <div 
                  key={m} 
                  className={`border transition-colors ${
                    isPaid 
                      ? 'bg-zinc-100 border-zinc-200 dark:bg-zinc-900/50 text-text-muted p-2.5 rounded-lg flex items-center justify-between text-xs' 
                      : shouldExpand 
                        ? 'bg-surface border-primary/50 shadow-2xs p-3 space-y-3 rounded-xl' 
                        : 'bg-surface border-border hover:bg-zinc-50/50 p-2.5 rounded-lg flex items-center justify-between text-xs'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <label className="flex items-center gap-2.5 font-bold uppercase select-none cursor-pointer text-text-primary text-xs w-full">
                      <input 
                        type="checkbox"
                        disabled={isPaid || (partialMonth !== undefined && m !== partialMonth)}
                        checked={isPaid || isChecked}
                        onChange={() => handleMonthToggle(m)}
                        className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                      />
                      <span>
                        {m} <span className="text-[11px] text-text-muted font-normal lowercase">(₹{totalFee.toLocaleString()}{isPartial ? ` | Remaining ₹${remaining.toLocaleString()}` : ''})</span>
                      </span>
                    </label>
                    <div className="flex-shrink-0">
                      {isPaid ? (
                        <span className="text-[11px] font-bold bg-green-500/10 text-green-600 px-2 py-0.5 rounded uppercase">Paid</span>
                      ) : isPartial ? (
                        <span className="text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded uppercase">Partially Paid</span>
                      ) : (
                        <span className="text-[11px] font-bold text-text-muted">Pending</span>
                      )}
                    </div>
                  </div>

                  {/* Input field shown ONLY when exactly 1 month is checked */}
                  {shouldExpand && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                          Amount to Deposit
                        </label>
                        <div className="relative flex-1 max-w-[160px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                          <input 
                            type="number"
                            min="1"
                            step="1"
                            max={remaining}
                            value={currentAmt}
                            onKeyDown={(e) => {
                              if (['.', '-', 'e', '+', ','].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => handleAmountChange(m, e.target.value)}
                            className={`w-full rounded-lg border bg-surface text-text-primary pl-7 pr-3 py-1.5 text-xs font-bold outline-none ${isOver ? 'border-red-500 focus:ring-red-500' : 'border-border focus:border-primary focus:ring-primary'}`}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-text-muted">
                        <span>Remaining after payment:</span>
                        <span className={`font-bold ${remAfter > 0 ? 'text-amber-600' : 'text-green-600'}`}>₹{remAfter.toLocaleString()}</span>
                      </div>
                      {isOver && (
                        <p className="text-[11px] font-bold text-red-600">Amount cannot exceed remaining fee of ₹{remaining.toLocaleString()}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button 
            className="font-bold" 
            disabled={saving || selectedMonths.length === 0 || validateForm() !== null} 
            onClick={handleSave}
          >
            {saving ? 'Depositing...' : `Deposit ${selectedMonths.length > 0 ? `(₹${calculateTotalDeposit().toLocaleString()})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Additional Fees Deposit Modal (Matches design guidelines of tuition DepositModal)
function AdditionalDepositModal({ student, unpaidFees, initialSelectedIds = [], onSave, onClose }) {
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [depositAmounts, setDepositAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const getFeeTotal = (fee) => parseFloat(fee.amount || 0);
  const getFeePaid = (fee) => parseFloat(fee.amount_paid || 0) + parseFloat(fee.discount_amount || 0);
  const getFeeRemaining = (fee) => Math.max(0, getFeeTotal(fee) - getFeePaid(fee));

  const isFeePartial = (fee) => {
    const paid = getFeePaid(fee);
    const rem = getFeeRemaining(fee);
    return paid > 0 && rem > 0.01;
  };

  const selectedPartialId = selectedIds.find(id => {
    const f = unpaidFees.find(x => x.id === id);
    return f && isFeePartial(f);
  });

  const isSingleFee = selectedIds.length === 1;

  const handleToggle = (id) => {
    const targetFee = unpaidFees.find(x => x.id === id);
    if (!targetFee) return;

    if (isFeePartial(targetFee)) {
      // Partial fee MUST be deposited separately!
      if (selectedIds.includes(id)) {
        setSelectedIds([]);
        setDepositAmounts({});
      } else {
        setSelectedIds([id]);
        setDepositAmounts({ [id]: getFeeRemaining(targetFee) });
      }
      setError('');
      return;
    }

    // Target fee is a fresh unpaid fee
    setSelectedIds(prev => {
      let baseSelection = prev;
      if (selectedPartialId) {
        baseSelection = [];
      }
      const next = baseSelection.includes(id) ? baseSelection.filter(x => x !== id) : [...baseSelection, id];
      const newAmounts = { ...depositAmounts };
      if (next.length > 1) {
        next.forEach(fId => {
          const f = unpaidFees.find(item => item.id === fId);
          if (f) newAmounts[fId] = getFeeRemaining(f);
        });
      } else if (next.length === 1) {
        const fId = next[0];
        const f = unpaidFees.find(item => item.id === fId);
        if (f && newAmounts[fId] === undefined) {
          newAmounts[fId] = getFeeRemaining(f);
        }
      }
      setDepositAmounts(newAmounts);
      return next;
    });
    setError('');
  };

  const handleAmountChange = (id, value) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    const num = sanitized === '' ? '' : parseInt(sanitized, 10);
    setDepositAmounts(prev => ({
      ...prev,
      [id]: num
    }));
    setError('');
  };

  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');

  const handleToggleApplyDiscount = (checked) => {
    setApplyDiscount(checked);
    if (!checked) {
      setDiscountAmount('');
    }
    setError('');
    const newAmounts = {};
    selectedIds.forEach(id => {
      const fee = unpaidFees.find(f => f.id === id);
      if (fee) newAmounts[id] = getFeeRemaining(fee);
    });
    setDepositAmounts(newAmounts);
  };

  const getDiscAmount = () => {
    return applyDiscount && discountAmount !== '' && discountAmount !== null ? (parseFloat(discountAmount) || 0) : 0;
  };

  const calculateGrossTotal = () => {
    return selectedIds.reduce((sum, id) => {
      const fee = unpaidFees.find(f => f.id === id);
      if (!fee) return sum;
      const remaining = getFeeRemaining(fee);
      const amt = isSingleFee ? (depositAmounts[id] !== undefined ? depositAmounts[id] : remaining) : remaining;
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  };

  const calculateTotalDeposit = () => {
    const gross = calculateGrossTotal();
    const disc = getDiscAmount();
    return Math.max(0, gross - disc);
  };

  const validateForm = () => {
    if (selectedIds.length === 0) {
      return 'Please select at least one fee.';
    }
    const gross = calculateGrossTotal();
    const disc = getDiscAmount();

    if (applyDiscount && discountAmount !== '' && discountAmount !== null) {
      if (isNaN(disc) || disc < 0 || !Number.isInteger(disc)) {
        return 'Please enter a valid positive whole number for discount amount.';
      }
      if (disc >= gross) {
        return `Discount amount (₹${disc}) must be less than payable fee (₹${gross.toLocaleString()}).`;
      }
    }
    if (isSingleFee) {
      const id = selectedIds[0];
      const fee = unpaidFees.find(f => f.id === id);
      if (fee) {
        const remaining = getFeeRemaining(fee);
        const val = depositAmounts[id];
        const amt = parseFloat(val);
        if (val === '' || val === null || isNaN(amt) || amt <= 0 || !Number.isInteger(amt)) {
          return `Please enter a valid positive whole number for ${fee.fee_name}.`;
        }
        if (amt > remaining + 0.01) {
          return `Amount cannot exceed the remaining fee of ₹${remaining.toLocaleString()} for ${fee.fee_name}.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    const valErr = validateForm();
    if (valErr) {
      setError(valErr);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const totalDiscount = getDiscAmount();
      let remainingDiscount = totalDiscount;

      const now = new Date();
      const timestamp = 'REC' + now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0') +
        String(Math.floor(100 + Math.random() * 900));
      const sharedReceiptNo = timestamp;

      for (let i = 0; i < selectedIds.length; i++) {
        const id = selectedIds[i];
        const fee = unpaidFees.find(f => f.id === id);
        const remaining = getFeeRemaining(fee);
        const userTypedAmt = isSingleFee ? (parseFloat(depositAmounts[id]) || remaining) : remaining;

        let feeDisc = 0;
        if (isSingleFee) {
          feeDisc = Math.min(totalDiscount, userTypedAmt);
        } else {
          feeDisc = Math.min(remainingDiscount, userTypedAmt);
          remainingDiscount -= feeDisc;
        }

        const netCashPaid = Math.max(0, userTypedAmt - feeDisc);

        await schoolService.collectAdditionalFeePayment(id, { 
          payment_method: paymentMethod,
          amount_paid: netCashPaid,
          discount_amount: feeDisc,
          receipt_no: sharedReceiptNo
        });
      }
      window.dispatchEvent(new Event('fee-payment-updated'));
      onSave();
    } catch (err) {
      console.error(err);
      const msg = err.data?.message || err.response?.data?.message || err.message || 'Failed to deposit fees.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-bold text-text-primary text-base tracking-tight font-display">Deposit Fees</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Apply Discount Toggle Row */}
          <div className="flex items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-border">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={applyDiscount}
                onChange={(e) => handleToggleApplyDiscount(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-primary relative"></div>
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Apply Discount</span>
            </label>

            {applyDiscount && (
              <div className="relative flex-1 max-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                <input 
                  type="number"
                  min="0"
                  placeholder="Discount Amount"
                  value={discountAmount}
                  onKeyDown={(e) => {
                    if (['.', '-', 'e', '+', ','].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const sanitized = e.target.value.replace(/[^0-9]/g, '');
                    setDiscountAmount(sanitized === '' ? '' : parseInt(sanitized, 10));
                    setError('');
                  }}
                  className="w-full rounded-lg border border-border bg-surface text-text-primary pl-7 pr-3 py-1.5 text-xs font-bold outline-none focus:border-primary focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface text-text-primary px-3 py-2 text-xs font-bold focus:border-primary focus:ring-primary outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-[11px] font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2.5 border border-border rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-900/10">
            {unpaidFees.map(fee => {
              const isSelected = selectedIds.includes(fee.id);
              const totalFee = getFeeTotal(fee);
              const paidSoFar = getFeePaid(fee);
              const remaining = getFeeRemaining(fee);
              const isPartial = isFeePartial(fee);
              const isOtherFeeDisabled = (selectedPartialId && fee.id !== selectedPartialId) || (selectedIds.length > 0 && !selectedIds.includes(fee.id) && isPartial);
              const shouldExpand = isSingleFee && isSelected && !applyDiscount;

              const currentAmt = depositAmounts[fee.id] !== undefined ? depositAmounts[fee.id] : remaining;
              const numAmt = parseFloat(currentAmt) || 0;
              const disc = getDiscAmount();
              const remAfter = Math.max(0, remaining - (numAmt + disc));
              const isOver = numAmt > remaining + 0.01;

              return (
                <div 
                  key={fee.id}
                  className={`border transition-colors ${
                    shouldExpand
                      ? 'bg-surface border-primary/50 shadow-2xs p-3 space-y-3 rounded-xl'
                      : isSelected
                        ? 'border-primary bg-primary/5 text-text-primary font-bold p-2.5 rounded-lg flex items-center justify-between text-xs'
                        : 'border-border bg-surface text-text-secondary hover:border-zinc-300 p-2.5 rounded-lg flex items-center justify-between text-xs'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <label className="flex items-center gap-2.5 font-bold uppercase select-none cursor-pointer text-text-primary text-xs w-full">
                      <input 
                        type="checkbox" 
                        disabled={isOtherFeeDisabled}
                        checked={isSelected}
                        onChange={() => handleToggle(fee.id)}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer h-4 w-4 disabled:opacity-50"
                      />
                      <span>
                        {fee.fee_name} <span className="text-[11px] text-text-muted font-normal lowercase">(₹{totalFee.toLocaleString()}{isPartial ? ` | Remaining ₹${remaining.toLocaleString()}` : ''})</span>
                      </span>
                    </label>
                    <div className="flex-shrink-0 font-bold font-sans">
                      {isPartial ? (
                        <span className="text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded uppercase">Partially Paid</span>
                      ) : (
                        `₹${remaining.toLocaleString()}`
                      )}
                    </div>
                  </div>

                  {/* Input field shown ONLY when exactly 1 additional fee is checked */}
                  {shouldExpand && (
                    <div className="pt-2 border-t border-border space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                          Amount to Deposit
                        </label>
                        <div className="relative flex-1 max-w-[160px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">₹</span>
                          <input 
                            type="number"
                            min="1"
                            step="1"
                            max={remaining}
                            value={currentAmt}
                            onKeyDown={(e) => {
                              if (['.', '-', 'e', '+', ','].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => handleAmountChange(fee.id, e.target.value)}
                            className={`w-full rounded-lg border bg-surface text-text-primary pl-7 pr-3 py-1.5 text-xs font-bold outline-none ${isOver ? 'border-red-500 focus:ring-red-500' : 'border-border focus:border-primary focus:ring-primary'}`}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-text-muted">
                        <span>Remaining after payment:</span>
                        <span className={`font-bold ${remAfter > 0 ? 'text-amber-600' : 'text-green-600'}`}>₹{remAfter.toLocaleString()}</span>
                      </div>
                      {isOver && (
                        <p className="text-[11px] font-bold text-red-600">Amount cannot exceed remaining fee of ₹{remaining.toLocaleString()}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button 
            className="flex items-center gap-1.5 font-bold" 
            onClick={handleSave} 
            disabled={saving || selectedIds.length === 0 || validateForm() !== null}
          >
            {saving ? 'Depositing...' : `Deposit ${selectedIds.length > 0 ? `(₹${calculateTotalDeposit().toLocaleString()})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StudentDetailsPage({ studentId, onBack, onEdit }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('finance'); // 'finance', 'profile', 'academic'
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [activeLedgerTab, setActiveLedgerTab] = useState('monthly'); // 'monthly' | 'additional'
  
  // Accordion toggle for Documents (open by default)
  const [docsOpen, setDocsOpen] = useState(true);

  // Modal view triggers
  const [viewingDoc, setViewingDoc] = useState(null); // { name, path }
  const [viewingReceipt, setViewingReceipt] = useState(null); // payment object
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showAdditionalDepositModal, setShowAdditionalDepositModal] = useState(false);
  const [unpaidAdditionalFeesList, setUnpaidAdditionalFeesList] = useState([]);
  const [preselectedAdditionalIds, setPreselectedAdditionalIds] = useState([]);
  const [showRemovePhotoConfirm, setShowRemovePhotoConfirm] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState(null); // { id, type: 'monthly' | 'additional', label }
  const [revertError, setRevertError] = useState('');
  const [revertSubmitting, setRevertSubmitting] = useState(false);

  const getMonthYearString = (month, academicYearName) => {
    const parts = (academicYearName || '2025–2026').split(/[–-]/);
    const startYear = parts[0] ? parts[0].trim() : '2025';
    const endYear = parts[1] ? parts[1].trim() : '2026';
    
    const secondYearMonths = ['January', 'February', 'March'];
    const year = secondYearMonths.includes(month) ? endYear : startYear;
    return `${month} ${year}`;
  };

  const getRevertedMonthsList = () => {
    if (!revertTarget || revertTarget.type !== 'monthly' || !data || !data.fee_summary) return [];
    
    const payments = data.fee_summary.payments || [];
    const targetPayment = payments.find(p => p.id === revertTarget.id);
    if (!targetPayment) return [revertTarget.label];
    
    if (targetPayment.receipt_no) {
      const related = payments.filter(p => p.receipt_no === targetPayment.receipt_no);
      const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
      related.sort((a, b) => academicMonths.indexOf(a.fee_month) - academicMonths.indexOf(b.fee_month));
      return related.map(p => p.fee_month);
    }
    
    return [targetPayment.fee_month];
  };

  useEffect(() => {
    if (activeSubTab === 'followup' && studentId) {
      setFollowUpLoading(true);
      schoolService.getStudentFollowUps(studentId)
        .then(res => {
          setFollowUpHistory(res || []);
        })
        .catch(err => {
          console.error(err);
        })
        .finally(() => {
          setFollowUpLoading(false);
        });
    }
  }, [activeSubTab, studentId]);

  const loadDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const [details, profile] = await Promise.all([
        schoolService.getStudentById(studentId),
        schoolService.getSchoolProfile()
      ]);
      setData(details);
      setSchoolProfile(profile);
    } catch (err) {
      console.error(err);
      setError('Failed to load student profile details.');
    } finally {
      setLoading(false);
    }
  };

  const { isReadOnly } = useAcademicYear();

  useEffect(() => {
    window.scrollTo(0, 0);
    loadDetails();
    const handleYearSwitch = () => {
      loadDetails();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="p-4 bg-red-500/10 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2 max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <span>{error || 'Student not found.'}</span>
        </div>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  const { student, fee_summary, attendance_summary, exam_results } = data;

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const extension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      alert('Only JPG, JPEG, PNG, and WEBP formats are allowed.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await schoolService.uploadDocument(formData, 'student-photos');
      
      if (res && res.url) {
        const updatePayload = {
          ...student,
          class_name: student.class_name || '',
          parent_occupation: student.father_occupation || '',
          exit_date: student.exit_date || '',
          photo_path: res.url
        };
        await schoolService.updateStudent(student.id, updatePayload);
        await loadDetails();
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to upload photo.');
    }
  };

  const handleRemovePhoto = async () => {
    try {
      const updatePayload = {
        ...student,
        class_name: student.class_name || '',
        parent_occupation: student.father_occupation || '',
        exit_date: student.exit_date || '',
        photo_path: ''
      };
      await schoolService.updateStudent(student.id, updatePayload);
      setShowRemovePhotoConfirm(false);
      await loadDetails();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to remove photo.');
    }
  };


  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  };

  const handleRevertPayment = (receipt) => {
    if (!receipt || !receipt.id) return;
    setRevertError('');
    setRevertTarget({
      id: receipt.id,
      type: 'monthly',
      label: receipt.fee_month
    });
    setRevertConfirmOpen(true);
  };

  const handleCollectAdditionalPayment = (item) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const unpaidDueFees = (data?.additional_fee_payments || [])
      .filter(p => {
        const tot = parseFloat(p.amount || 0);
        const pd = parseFloat(p.amount_paid || 0);
        const disc = parseFloat(p.discount_amount || 0);
        const rem = Math.max(0, tot - (pd + disc));
        return rem > 0.01 && (p.due_date <= todayStr || !p.due_date || p.fee_name === 'Previous Year Dues');
      });

    if (unpaidDueFees.length === 0) return;

    setUnpaidAdditionalFeesList(unpaidDueFees);
    setPreselectedAdditionalIds([]);
    setShowAdditionalDepositModal(true);
  };

  const handleRevertAdditionalPayment = (item) => {
    if (!item || !item.id) return;
    setRevertError('');
    setRevertTarget({
      id: item.id,
      type: 'additional',
      label: item.fee_name
    });
    setRevertConfirmOpen(true);
  };

  const confirmRevert = async () => {
    if (!revertTarget) return;
    setRevertSubmitting(true);
    setRevertError('');
    try {
      if (revertTarget.type === 'monthly') {
        await schoolService.revertFeePayment(revertTarget.id);
      } else {
        await schoolService.revertAdditionalFeePayment(revertTarget.id);
      }
      window.dispatchEvent(new Event('fee-payment-updated'));
      setRevertConfirmOpen(false);
      setRevertTarget(null);
      await loadDetails();
    } catch (err) {
      console.error(err);
      let errorMsg = 'Failed to revert payment.';
      if (err.data) {
        if (typeof err.data === 'string') {
          errorMsg = err.data;
        } else if (err.data.errors) {
          const keys = Object.keys(err.data.errors);
          if (keys.length > 0) {
            errorMsg = err.data.errors[keys[0]];
          }
        } else {
          const keys = Object.keys(err.data);
          if (keys.length > 0) {
            errorMsg = err.data[keys[0]];
          }
        }
      } else {
        errorMsg = err.message || 'Failed to revert payment.';
      }
      setRevertError(errorMsg);
    } finally {
      setRevertSubmitting(false);
    }
  };

  const handleViewAdditionalReceipt = (item) => {
    const paidAmt = item.amount_paid !== undefined && item.amount_paid !== null ? parseFloat(item.amount_paid) : (item.status === 'Paid' ? parseFloat(item.amount) : 0);
    const discAmt = parseFloat(item.discount_amount || 0);

    setViewingReceipt({
      id: item.id,
      receipt_no: item.receipt_no || `AFP-${String(item.id).padStart(5, '0')}`,
      payment_date: item.payment_date,
      fee_month: item.fee_name || 'Additional Fee',
      amount_paid: paidAmt,
      discount_amount: discAmt,
      amount: item.amount,
      is_additional: true,
      fee_name: item.fee_name
    });
  };

  const statusBadge = (status) => {
    const map = {
      ACTIVE: 'bg-green-500/10 text-green-600 border border-green-500/20',
      Inactive: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
        {status}
      </span>
    );
  };

  // Calculate Month-wise Fee Statuses
  const getMonthWiseFees = () => {
    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

    const paymentsList = fee_summary.payments || [];
    const paidByMonth = {};
    const latestReceiptByMonth = {};

    paymentsList.forEach(p => {
      const m = p.fee_month;
      if (m) {
        paidByMonth[m] = (paidByMonth[m] || 0) + parseFloat(p.amount_paid || 0) + parseFloat(p.discount_amount || 0);
        latestReceiptByMonth[m] = p;
      }
    });

    return academicMonths.map((m) => {
      let totalFee = 0;
      if (data && data.class_fee_config && data.class_fee_config.monthly_fees && data.class_fee_config.monthly_fees[m]) {
        totalFee = parseFloat(data.class_fee_config.monthly_fees[m]);
      } else {
        const firstPaid = paymentsList[0]?.amount_paid ? parseFloat(paymentsList[0].amount_paid) : 0;
        totalFee = firstPaid;
      }

      const totalPaid = paidByMonth[m] || 0;
      const remaining = Math.max(0, totalFee - totalPaid);
      const receipt = latestReceiptByMonth[m];

      let status = 'UNPAID';
      let statusText = 'Pending';
      let statusClass = 'bg-red-500/10 text-red-600 border-red-500/20';

      if (totalPaid >= totalFee - 0.01 && totalFee > 0) {
        status = 'PAID';
        statusText = 'Paid';
        statusClass = 'bg-green-500/10 text-green-600 border-green-500/20';
      } else if (totalPaid > 0) {
        status = 'PARTIAL';
        statusText = 'Partially';
        statusClass = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      } else {
        status = 'UNPAID';
        statusText = 'Pending';
        statusClass = 'bg-red-500/10 text-red-600 border-red-500/20';
      }

      return {
        month: m,
        status,
        statusText,
        statusClass,
        receipt,
        amount: totalFee,
        totalPaid,
        remaining
      };
    });
  };

  const monthWiseList = getMonthWiseFees();
  const paidMonthsList = (fee_summary.payments || []).map(p => p.fee_month);

  return (
    <div className="space-y-6">
      
      {/* Header Layout */}
      <div className="flex items-center justify-between border-b border-border pb-4 gap-4 bg-surface p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs"
          >
            Back
          </button>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display">Student Profile</h2>
        </div>
        {!isReadOnly && student.status !== 'Alumni' && student.status !== 'Archived' && (
          <Button onClick={() => onEdit(student.id)} className="font-bold">
            Edit Profile
          </Button>
        )}
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Summary Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm overflow-hidden border-border bg-surface">
            <div className="h-20 bg-gradient-to-r from-teal-500 to-indigo-600"></div>
            <CardContent className="p-5 pt-0 relative flex flex-col items-center">
              {/* Profile Image (Self-healing avatar) with Click Popover Menu */}
              <div className="relative -mt-10 z-20">
                <button 
                  onClick={() => {
                    if (!isReadOnly && student.status !== 'Alumni' && student.status !== 'Archived') {
                      setShowPhotoMenu(prev => !prev);
                    }
                  }}
                  className={`w-20 h-20 rounded-full border-4 border-surface bg-zinc-50 flex items-center justify-center overflow-hidden shadow-xs transition-all focus:outline-none ${!isReadOnly && student.status !== 'Alumni' && student.status !== 'Archived' ? 'hover:ring-2 hover:ring-primary/20 cursor-pointer' : ''}`}
                >
                  <StudentAvatar src={student.photo_path} name={student.name} updatedAt={student.updated_at} />
                </button>

                {showPhotoMenu && (
                  <>
                    {/* Transparent backdrop overlay to click-outside-to-close */}
                    <div className="fixed inset-0 z-30" onClick={() => setShowPhotoMenu(false)}></div>
                    
                    {/* Absolute positioned dropdown container */}
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 mt-2 w-auto min-w-[100px] bg-surface border border-border rounded-xl shadow-lg py-1 z-40 animate-in fade-in slide-in-from-top-1 duration-150 text-xs">
                      {student.photo_path ? (
                        <>
                          <label className="block text-center px-3 py-1.5 font-semibold text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors whitespace-nowrap">
                            Replace Photo
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={(e) => { handlePhotoUpload(e); setShowPhotoMenu(false); }} 
                            />
                          </label>
                          <button 
                            onClick={() => { setShowRemovePhotoConfirm(true); setShowPhotoMenu(false); }}
                            className="block w-full text-center px-3 py-1.5 font-semibold text-red-600 hover:bg-red-500/10 dark:hover:bg-red-950/20 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Remove Photo
                          </button>
                        </>
                      ) : (
                        <label className="block text-center px-3 py-1.5 font-semibold text-text-primary hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors whitespace-nowrap">
                          Upload Photo
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => { handlePhotoUpload(e); setShowPhotoMenu(false); }} 
                          />
                        </label>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {/* Name directly below */}
              <h3 className="font-bold text-text-primary text-base text-center mt-3 leading-tight">{student.name}</h3>
              
              {/* Status Badge directly below */}
              <div className="mt-3">
                {statusBadge(student.status)}
              </div>

              {/* Demographic Details Grid */}
              <div className="w-full border-t border-border mt-5 pt-4 space-y-2.5 text-xs">
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">Roll Number:</span> 
                  <span className="font-bold font-mono text-text-primary">{student.roll_no || '-'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">SR Number:</span> 
                  <span className="font-bold font-mono text-text-primary">{student.sr_no || student.id}</span>
                </p>

                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">Blood Group:</span> 
                  <span className="font-bold text-text-primary">{student.blood_group || '-'}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-text-muted font-medium">Gender / Age:</span> 
                  <span className="font-bold text-text-primary">{student.gender || '-'}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tab Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Sub tabs nav (Finance tab renamed to "Finance") */}
          <div className="flex border-b border-border text-sm overflow-x-auto whitespace-nowrap scrollbar-none gap-6">
            {[
              { id: 'finance', label: 'Finance' },
              { id: 'profile', label: 'Student & Parents' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`pb-3 font-bold border-b-2 transition-all ${activeSubTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-tab 1: Student & Parents */}
          {activeSubTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="shadow-xs">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Demographic & Session Details</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2 text-xs">
                    <p><span className="text-text-muted block font-medium">Academic Session</span> <span className="font-semibold text-text-primary text-sm">{student.academic_year_name || '2025–2026'}</span></p>
                    <p><span className="text-text-muted block font-medium">Admission Date</span> <span className="font-semibold text-text-primary text-sm">{student.admission_date || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Date of Birth</span> <span className="font-semibold text-text-primary text-sm">{student.dob || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Aadhaar Number</span> <span className="font-semibold font-mono text-text-primary text-sm">{student.aadhaar_no || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Category</span> <span className="font-semibold text-text-primary text-sm">{student.category || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Religion</span> <span className="font-semibold text-text-primary text-sm">{student.religion || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Student Mobile</span> <span className="font-semibold font-mono text-text-primary text-sm">{student.student_mobile || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Student Email</span> <span className="font-semibold text-text-primary text-sm">{student.student_email || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Class Assigned</span> <span className="font-semibold text-text-primary text-sm">{student.class_name || 'Not Assigned'}</span></p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <Users className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Parent Information</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <p><span className="text-text-muted block font-medium">Father Name</span> <span className="font-semibold text-text-primary text-sm">{student.father_name || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Mother Name</span> <span className="font-semibold text-text-primary text-sm">{student.mother_name || '-'}</span></p>
                    <p><span className="text-text-muted block font-medium">Parent Occupation</span> <span className="font-semibold text-text-primary text-sm">{student.father_occupation || '-'}</span></p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <Home className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Addresses</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-text-primary uppercase text-[11px] tracking-wider mb-2">Current Residence Address</p>
                      <p className="text-text-secondary leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 border border-border p-3 rounded-lg min-h-[70px]">
                        {student.current_address_line ? (
                          `${student.current_address_line}, ${student.current_city}, ${student.current_state} - ${student.current_pin_code}, ${student.current_country || 'India'}`
                        ) : (
                          student.address || '-'
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-text-primary uppercase text-[11px] tracking-wider mb-2">Permanent Address</p>
                      <p className="text-text-secondary leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 border border-border p-3 rounded-lg min-h-[70px]">
                        {student.same_as_current === 1 ? (
                          <span className="text-[11px] font-bold text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded">SAME AS CURRENT ADDRESS</span>
                        ) : student.permanent_address_line ? (
                          `${student.permanent_address_line}, ${student.permanent_city}, ${student.permanent_state} - ${student.permanent_pin_code}, ${student.permanent_country || 'India'}`
                        ) : (
                          '-'
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Collapsible Documents Card relocation */}
              <Card className="shadow-xs overflow-hidden border border-border">
                <button 
                  onClick={() => setDocsOpen(prev => !prev)}
                  className="w-full flex items-center justify-between px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Documents</h4>
                  </div>
                  {docsOpen ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
                </button>

                {docsOpen && (
                  <div className="p-6 border-t border-border animate-in slide-in-from-top-2 duration-300">
                    {(!student.documents || student.documents.length === 0) &&
                     !student.birth_cert_path && !student.aadhaar_path && !student.transfer_cert_path && !student.report_card_path && !student.additional_docs_path ? (
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-border rounded-xl text-center">
                        <p className="text-xs text-text-muted font-medium">No documents uploaded for this student.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* 1. Array-based uploaded documents (student.documents) */}
                        {Array.isArray(student.documents) && student.documents.map((doc, idx) => {
                          const rawPath = doc.file_path || doc.path || '';
                          const fileUrl = resolveFileUrl(rawPath) || '#';

                          return (
                            <div key={doc.id || idx} className="flex items-center justify-between p-3 border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-text-primary uppercase text-[11px] tracking-wider truncate">{doc.category || doc.file_name || 'Document'}</p>
                                <p className="text-[11px] text-text-muted truncate mt-0.5">{doc.file_name || 'File attachment'}</p>
                              </div>
                              {rawPath ? (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button 
                                    onClick={() => setViewingDoc({ name: doc.category || doc.file_name, path: fileUrl })}
                                    className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shadow-2xs"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>View</span>
                                  </button>
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-text-primary rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shadow-2xs"
                                    title="Download Document"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    <span>Download</span>
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider flex-shrink-0">Missing</span>
                              )}
                            </div>
                          );
                        })}

                        {/* 2. Legacy individual document paths fallback */}
                        {[
                          { key: 'birth_cert_path', label: 'Birth Certificate' },
                          { key: 'aadhaar_path', label: 'Aadhaar Card' },
                          { key: 'transfer_cert_path', label: 'Transfer Certificate (TC)' },
                          { key: 'report_card_path', label: 'Previous Report Card' },
                          { key: 'additional_docs_path', label: 'Additional Documents' }
                        ].filter(doc => !!student[doc.key]).map(doc => {
                          const rawPath = student[doc.key];
                          const fileUrl = resolveFileUrl(rawPath) || '#';

                          return (
                            <div key={doc.key} className="flex items-center justify-between p-3 border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-text-primary uppercase text-[11px] tracking-wider truncate">{doc.label}</p>
                                <p className="text-[11px] text-text-muted truncate mt-0.5">Scanned PDF/Image copy</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button 
                                  onClick={() => setViewingDoc({ name: doc.label, path: fileUrl })}
                                  className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View</span>
                                </button>
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-text-primary rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shadow-2xs"
                                  title="Download Document"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>Download</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}



          {/* Sub-tab 3: Finance */}
          {activeSubTab === 'finance' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {data?.is_ledger_locked && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                  <span>{data.ledger_locked_message}</span>
                </div>
              )}
              {(!data || !data.class_fee_config) ? (
                <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center text-center space-y-4 max-w-md mx-auto shadow-2xs">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-text-primary text-base">Fee Structure Not Configured</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    The monthly fee structure for <strong className="text-text-primary uppercase">{student.class_name || 'this class'}</strong> has not been configured for the current Academic Year. <br />
                    Please configure the class fee before collecting or managing student fees.
                  </p>
                  <Button 
                    variant="accent"
                    onClick={() => navigate('/school-admin/audits-settings', { state: { preselectClassId: student.class_id } })}
                    className="font-bold flex items-center gap-1.5 text-xs h-9 px-4 rounded-lg shadow-2xs mt-2"
                  >
                    Configure Class Fee
                  </Button>
                </div>
              ) : (
                <>
                  {/* Fee summary card */}
                  {(() => {
                    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                    const now = new Date();
                    const calendarMonth = now.getMonth();
                    const monthMapping = {
                      3: 0,  // April
                      4: 1,  // May
                      5: 2,  // June
                      6: 3,  // July
                      7: 4,  // August
                      8: 5,  // September
                      9: 6,  // October
                      10: 7, // November
                      11: 8, // December
                      0: 9,  // January
                      1: 10, // February
                      2: 11  // March
                    };
                    const currentAcademicIdx = monthMapping[calendarMonth] !== undefined ? monthMapping[calendarMonth] : 2;
                    const pastAndCurrentMonths = academicMonths.slice(0, currentAcademicIdx + 1);

                    let monthlyFeeDue = 0;
                    pastAndCurrentMonths.forEach(m => {
                      const mw = monthWiseList.find(x => x.month === m);
                      if (mw) {
                        monthlyFeeDue += mw.remaining;
                      }
                    });

                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    const todayStr = `${yyyy}-${mm}-${dd}`;
                    const additionalFeeDue = (data.additional_fee_payments || [])
                      .filter(p => (p.status === 'Pending' || p.status === 'Partial') && (p.due_date <= todayStr || p.fee_name === 'Previous Year Dues' || !p.due_date))
                      .reduce((sum, p) => {
                        const tot = parseFloat(p.amount || 0);
                        const pd = parseFloat(p.amount_paid || 0);
                        const disc = parseFloat(p.discount_amount || 0);
                        return sum + Math.max(0, tot - (pd + disc));
                      }, 0);

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <Card 
                          onClick={() => setActiveLedgerTab('monthly')}
                          className={`shadow-xs p-5 bg-surface border flex flex-col justify-between cursor-pointer select-none transition-all duration-200 rounded-2xl ${
                            activeLedgerTab === 'monthly'
                              ? 'border-primary border-2 bg-primary/5 ring-2 ring-primary/10'
                              : 'border-border opacity-70 hover:opacity-100 hover:border-zinc-400'
                          }`}
                        >
                          <div>
                            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">
                              {activeLedgerTab === 'monthly' ? '✓ ' : ''}Monthly Fee Due
                            </p>
                            <p className="text-2xl font-bold text-amber-600 mt-1 font-display">₹{monthlyFeeDue.toLocaleString()}</p>
                          </div>
                        </Card>
                        
                        <Card 
                          onClick={() => setActiveLedgerTab('additional')}
                          className={`shadow-xs p-5 bg-surface border flex flex-col justify-between cursor-pointer select-none transition-all duration-200 rounded-2xl ${
                            activeLedgerTab === 'additional'
                              ? 'border-primary border-2 bg-primary/5 ring-2 ring-primary/10'
                              : 'border-border opacity-70 hover:opacity-100 hover:border-zinc-400'
                          }`}
                        >
                          <div>
                            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">
                              {activeLedgerTab === 'additional' ? '✓ ' : ''}Additional Fee Due
                            </p>
                            <p className="text-2xl font-bold text-amber-600 mt-1 font-display">₹{additionalFeeDue.toLocaleString()}</p>
                          </div>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* Switchable Fee Management panel */}
                  <Card className="shadow-xs">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center gap-2 border-b border-border pb-2.5">
                        <FileText className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                          {activeLedgerTab === 'monthly' ? 'Month-wise Fee Card' : 'Additional Fee Card'}
                        </h4>
                      </div>

                      {activeLedgerTab === 'monthly' ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Month</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthWiseList.map(mw => (
                              <TableRow key={mw.month}>
                                <TableCell className="font-bold text-text-primary text-xs uppercase tracking-wider">
                                  <div>{mw.month}</div>
                                  {mw.status === 'PARTIAL' && (
                                    <span className="block text-[10px] text-amber-600 font-bold lowercase">
                                      (₹{mw.remaining.toLocaleString()} remaining)
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-text-primary font-bold">
                                  ₹{mw.amount.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                                  {mw.receipt?.payment_date ? formatDate(mw.receipt.payment_date) : '—'}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${mw.statusClass}`}>
                                    {mw.statusText}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  {mw.status === 'PAID' ? (
                                    <div className="flex justify-end gap-2">
                                       {!data?.is_ledger_locked && !isReadOnly && (
                                         <Button 
                                           variant="secondary" 
                                           className="h-7 w-20 text-[11px] px-0 font-bold"
                                           onClick={() => handleRevertPayment(mw.receipt)}
                                         >
                                           Revert
                                         </Button>
                                       )}
                                       <Button 
                                         variant="secondary" 
                                         className="h-7 w-20 text-[11px] px-0 font-bold"
                                         onClick={() => setViewingReceipt(mw.receipt)}
                                       >
                                         Receipt
                                       </Button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-2">
                                      {mw.receipt && (
                                        <>
                                          {!data?.is_ledger_locked && !isReadOnly && (
                                            <Button 
                                              variant="secondary" 
                                              className="h-7 w-20 text-[11px] px-0 font-bold"
                                              onClick={() => handleRevertPayment(mw.receipt)}
                                            >
                                              Revert
                                            </Button>
                                          )}
                                          <Button 
                                            variant="secondary" 
                                            className="h-7 w-20 text-[11px] px-0 font-bold"
                                            onClick={() => setViewingReceipt(mw.receipt)}
                                          >
                                            Receipt
                                          </Button>
                                        </>
                                      )}
                                      {!data?.is_ledger_locked && (
                                        <Button 
                                          className="h-7 w-20 text-[11px] px-0 font-bold"
                                          onClick={() => setShowDepositModal(true)}
                                        >
                                          Deposit
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        (!data.additional_fee_payments || data.additional_fee_payments.length === 0) ? (
                          <div className="p-8 text-center text-text-muted text-xs font-bold leading-relaxed bg-zinc-50/50 dark:bg-zinc-900/10 border border-border rounded-xl">
                            No additional fee records found for this student.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.additional_fee_payments.map(af => {
                                const totalAmt = parseFloat(af.amount || 0);
                                const paidAmt = parseFloat(af.amount_paid !== undefined ? af.amount_paid : (af.status === 'Paid' ? totalAmt : 0));
                                const discountAmt = parseFloat(af.discount_amount || 0);
                                const clearedAmt = paidAmt + discountAmt;
                                const remAmt = Math.max(0, totalAmt - clearedAmt);
                                const isPaid = af.status === 'Paid' || remAmt <= 0.01;
                                const isPartial = clearedAmt > 0 && remAmt > 0.01;

                                return (
                                  <TableRow key={af.id}>
                                    <TableCell className="font-bold text-text-primary text-xs uppercase tracking-wider">
                                      <div>{af.fee_name}</div>
                                      {af.description && <div className="text-[11px] text-text-muted normal-case mt-0.5 font-semibold">{af.description}</div>}
                                      {isPartial && (
                                        <span className="block text-[10px] text-amber-600 font-bold lowercase mt-0.5">
                                          (₹{remAmt.toLocaleString()} remaining)
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-xs text-text-primary font-bold">
                                      ₹{totalAmt.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                                      {af.payment_date ? formatDate(af.payment_date) : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                                        isPaid
                                          ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                          : isPartial
                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                            : 'bg-red-500/10 text-red-600 border-red-500/20'
                                      }`}>
                                        {isPaid ? 'Paid' : isPartial ? 'Partially' : 'Pending'}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {isPaid ? (
                                        <div className="flex justify-end gap-2">
                                          {!data?.is_ledger_locked && !isReadOnly && (
                                            <Button 
                                              variant="secondary" 
                                              className="h-7 w-20 text-[11px] px-0 font-bold"
                                              onClick={() => handleRevertAdditionalPayment(af)}
                                            >
                                              Revert
                                            </Button>
                                          )}
                                          <Button 
                                            variant="secondary" 
                                            className="h-7 w-20 text-[11px] px-0 font-bold"
                                            onClick={() => handleViewAdditionalReceipt(af)}
                                          >
                                            Receipt
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex justify-end gap-2">
                                          {(paidAmt > 0 || clearedAmt > 0) && (
                                            <>
                                              {!data?.is_ledger_locked && !isReadOnly && (
                                                <Button 
                                                  variant="secondary" 
                                                  className="h-7 w-20 text-[11px] px-0 font-bold"
                                                  onClick={() => handleRevertAdditionalPayment(af)}
                                                >
                                                  Revert
                                                </Button>
                                              )}
                                              <Button 
                                                variant="secondary" 
                                                className="h-7 w-20 text-[11px] px-0 font-bold"
                                                onClick={() => handleViewAdditionalReceipt(af)}
                                              >
                                                Receipt
                                              </Button>
                                            </>
                                          )}
                                          {((() => {
                                            const today = new Date();
                                            const yyyy = today.getFullYear();
                                            const mm = String(today.getMonth() + 1).padStart(2, '0');
                                            const dd = String(today.getDate()).padStart(2, '0');
                                            const todayStr = `${yyyy}-${mm}-${dd}`;
                                            return !af.due_date || af.due_date <= todayStr || af.fee_name === 'Previous Year Dues';
                                          })() && !data?.is_ledger_locked) && (
                                            <Button 
                                              className="h-7 w-20 text-[11px] px-0 font-bold"
                                              onClick={() => handleCollectAdditionalPayment(af)}
                                            >
                                              Deposit
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}



        </div>

      </div>

      {/* Inline Document Viewer Overlay Modal */}
      {viewingDoc && (
        <DocumentViewerModal 
          docName={viewingDoc.name} 
          docPath={viewingDoc.path} 
          onClose={() => setViewingDoc(null)} 
        />
      )}

      {/* Fee Payment Receipt Popup */}
      {viewingReceipt && (
        <FeeReceiptModal 
          receipt={viewingReceipt} 
          student={student} 
          schoolName={schoolProfile?.name}
          schoolLogoUrl={schoolProfile?.logo_path}
          allPayments={fee_summary.payments}
          additionalFeePayments={data?.additional_fee_payments || fee_summary.additional_fees}
          onClose={() => setViewingReceipt(null)} 
        />
      )}

      {/* Fee Deposit Dialog */}
      {showDepositModal && (
        <DepositModal 
          student={student} 
          payments={fee_summary.payments || []} 
          classFeeConfig={data?.class_fee_config}
          onSave={async () => {
            setShowDepositModal(false);
            await loadDetails();
          }} 
          onClose={() => setShowDepositModal(false)} 
        />
      )}

      {/* Additional Fee Deposit Dialog */}
      {showAdditionalDepositModal && (
        <AdditionalDepositModal 
          student={student} 
          unpaidFees={unpaidAdditionalFeesList} 
          initialSelectedIds={preselectedAdditionalIds}
          onSave={async () => {
            setShowAdditionalDepositModal(false);
            setPreselectedAdditionalIds([]);
            await loadDetails();
          }} 
          onClose={() => {
            setShowAdditionalDepositModal(false);
            setPreselectedAdditionalIds([]);
          }} 
        />
      )}

      {/* Remove Photo Confirmation Modal */}
      {showRemovePhotoConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-bold text-text-primary text-base tracking-tight text-center">
              Remove student profile picture?
            </h3>
            <div className="flex gap-3 justify-center pt-2">
              <Button variant="secondary" onClick={() => setShowRemovePhotoConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="font-bold" onClick={handleRemovePhoto}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
      {revertConfirmOpen && (
        <Dialog
          isOpen={revertConfirmOpen}
          onClose={() => {
            setRevertConfirmOpen(false);
            setRevertTarget(null);
          }}
          title="Revert Payment?"
          description=""
          className="max-w-md animate-in fade-in duration-200"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setRevertConfirmOpen(false);
                  setRevertTarget(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={confirmRevert}
                disabled={revertSubmitting}
                className="font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {revertSubmitting ? 'Reverting...' : 'Confirm Revert'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm mt-2">
            {revertError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold leading-normal flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{revertError}</span>
              </div>
            )}
            
            {revertTarget && revertTarget.type === 'monthly' ? (
              <div className="space-y-4">
                <p className="text-text-secondary leading-relaxed font-semibold">
                  You are about to revert fee payment for:
                </p>
                <div className="space-y-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider font-bold block">Student:</span>
                  <span className="font-bold text-text-primary text-base block">{student?.name}</span>
                </div>
                
                <div className="space-y-2">
                  <span className="text-text-muted text-xs uppercase tracking-wider font-bold block">Months:</span>
                  <div className="space-y-1 text-sm font-bold text-text-primary">
                    {getRevertedMonthsList().map(m => (
                      <div key={m} className="flex items-center gap-2">
                        <span className="text-text-muted text-lg leading-none">•</span>
                        <span>{getMonthYearString(m, student?.academic_year_name)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider font-bold block">Total Months:</span>
                  <span className="font-bold text-text-primary text-base block">{getRevertedMonthsList().length}</span>
                </div>

                <p className="text-xs text-text-muted leading-relaxed font-medium pt-2 border-t border-border">
                  This action will mark these months as unpaid and update all related financial records.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-text-secondary leading-relaxed font-semibold">
                  You are about to revert the payment for:
                </p>
                <div className="space-y-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider font-bold block">Student:</span>
                  <span className="font-bold text-text-primary text-base block">{student?.name}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider font-bold block">Fee Item:</span>
                  <span className="font-bold text-text-primary text-sm block">{revertTarget?.label}</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed font-medium pt-2 border-t border-border">
                  This action will mark this item as unpaid and update all related financial records.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}

    </div>
  );
}
