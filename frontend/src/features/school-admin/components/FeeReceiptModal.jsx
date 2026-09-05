import React from 'react';
import { X, Download, Printer } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { apiClient } from '../../../common/services/apiClient';
import html2pdf from 'html2pdf.js';

export function FeeReceiptModal({ receipt, student, schoolName, schoolLogoUrl, allPayments = [], additionalFeePayments = [], onClose }) {
  const handlePrint = async () => {
    try {
      const isAdditional = receipt.is_additional || (receipt.fee_name && receipt.fee_name !== 'Previous Year Dues' && !receipt.fee_month) ? 1 : 0;
      const studentId = student?.id || receipt?.student_id;
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
    } catch (err) {
      console.error('Failed to print receipt PDF:', err);
    }
  };

  const handleDownload = async () => {
    try {
      const isAdditional = receipt.is_additional || (receipt.fee_name && receipt.fee_name !== 'Previous Year Dues' && !receipt.fee_month) ? 1 : 0;
      const studentId = student?.id || receipt?.student_id;
      const blob = await apiClient.get(`/api/school/students/${studentId}/fees/receipt?id=${receipt.id}&additional=${isAdditional}`);
      const cleanName = (student?.name || 'Student').split(/\s+/).join('');
      const cleanYear = (student?.academic_year_name || student?.academic_year || '2027-2028').replace(/[–—]/g, '-');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FeeReceipt_${cleanName}_${cleanYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download receipt PDF, falling back to html2pdf:', err);
      const element = document.getElementById('receipt-print-area');
      if (!element) return;
      const cleanName = (student?.name || 'Student').split(/\s+/).join('');
      const cleanYear = (student?.academic_year_name || student?.academic_year || '2027-2028').replace(/[–—]/g, '-');
      const opt = {
        margin: 10,
        filename: `FeeReceipt_${cleanName}_${cleanYear}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().from(element).set(opt).save();
    }
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

  const allAddFees = additionalFeePayments && additionalFeePayments.length 
    ? additionalFeePayments 
    : (allPayments && allPayments.length ? allPayments.filter(p => p.is_additional || p.type === 'additional') : []);

  const groupPayments = receipt.is_additional
    ? (allAddFees.length 
        ? allAddFees.filter(p => p.receipt_no && receipt.receipt_no && p.receipt_no === receipt.receipt_no)
        : [receipt])
    : (allPayments.length 
        ? allPayments.filter(p => p.receipt_no === receipt.receipt_no) 
        : [receipt]);

  const sortedGroup = groupPayments.length > 0 ? groupPayments : [receipt];

  const totalAmountPaid = sortedGroup.reduce((sum, p) => {
    const val = p.amount_paid !== undefined && p.amount_paid !== null ? parseFloat(p.amount_paid) : (parseFloat(p.amount) || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalDiscount = sortedGroup.reduce((sum, p) => {
    const val = parseFloat(p.discount_amount || 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalPayable = sortedGroup.reduce((sum, p) => {
    const paid = p.amount_paid !== undefined && p.amount_paid !== null ? parseFloat(p.amount_paid) : 0;
    const disc = parseFloat(p.discount_amount || 0);
    const gross = p.amount !== undefined && p.amount !== null && parseFloat(p.amount) > 0 ? parseFloat(p.amount) : (paid + disc);
    return sum + (isNaN(gross) ? 0 : gross);
  }, 0);
  const displaySchoolName = schoolName || 'SHIKSHA PILOT SCHOOL';

  const currentYearName = student?.academic_year_name || student?.academic_year || '2027–2028';
  let previousYearName = '';
  const match = currentYearName.match(/(\d{4})[–-](\d{4})/);
  if (match) {
    const startYear = parseInt(match[1], 10);
    const endYear = parseInt(match[2], 10);
    previousYearName = `Academic Year ${startYear - 1}–${endYear - 1}`;
  } else {
    previousYearName = 'Previous Academic Year';
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-bold text-text-primary text-base tracking-tight font-display">Fee Payment Receipt</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        {/* Printable area */}
        <div className="p-8 space-y-6" id="receipt-print-area">
          <div className="text-center space-y-1 flex flex-col items-center justify-center">
            {schoolLogoUrl && (
              <img 
                src={schoolLogoUrl} 
                alt="School Logo" 
                className="h-12 w-auto mb-2 object-contain" 
              />
            )}
            <h2 className="text-xl font-bold tracking-tight text-text-primary font-display uppercase">{displaySchoolName}</h2>
            <p className="text-[11px] uppercase font-bold tracking-widest text-primary">Fee Payment Receipt</p>
          </div>

          <div className="border-y border-dashed border-border py-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-text-muted">Mode of Payment:</span> <span className="font-bold text-text-primary">{getModeOfPayment(receipt.payment_method)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Student Name:</span> <span className="font-bold text-text-primary uppercase">{student?.name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Class & Section:</span> <span className="font-bold text-text-primary">{student?.class_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Roll Number / SR No:</span> <span className="font-bold text-text-primary">{student?.roll_no || '—'} / {student?.sr_no || '—'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Ref No:</span> <span className="font-mono font-bold text-text-primary">{receipt.receipt_no}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Academic Year:</span> <span className="font-bold text-text-primary">{student?.academic_year_name || student?.academic_year || '2027–2028'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Payment Date:</span> <span className="font-bold text-text-primary">{formatDate(receipt.payment_date)}</span></div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border flex justify-between items-center">
              <div>
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">
                  {receipt.is_additional ? 'Description' : (sortedGroup.length > 1 ? 'Billing Months' : 'Billing Month')}
                </p>
                <p className="text-sm font-bold text-text-primary mt-0.5 max-w-[200px] break-words">
                  {receipt.is_additional ? (() => {
                    const names = sortedGroup.map(p => p.fee_name || p.fee_month).filter(Boolean);
                    const uniqueNames = Array.from(new Set(names));
                    return uniqueNames.length > 0 ? uniqueNames.join(', ') : (receipt.fee_name || 'Additional Fee');
                  })() : (() => {
                    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                    const months = sortedGroup.map(p => p.fee_month).filter(Boolean);
                    if (months.length === 0 && receipt.fee_month) months.push(receipt.fee_month);
                    
                    const indices = months.map(m => academicMonths.indexOf(m)).filter(idx => idx !== -1);
                    
                    let isConsecutive = false;
                    if (indices.length > 1) {
                      isConsecutive = indices.every((val, i) => i === 0 || val === indices[i - 1] + 1);
                    }

                    if (isConsecutive) {
                      return `${months[0]} To ${months[months.length - 1]}`;
                    }
                    return months.join(', ') || 'Monthly Fee';
                  })()}
                </p>
              </div>
              <div className="text-right space-y-1">
                {totalDiscount > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[11px] text-text-muted flex justify-between gap-3">
                      <span>Payable Amount:</span>
                      <span className="font-bold">Rs {totalPayable.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-emerald-600 font-bold flex justify-between gap-3">
                      <span>Discount:</span>
                      <span>- Rs {totalDiscount.toLocaleString()}</span>
                    </div>
                    <div className="pt-1 border-t border-border/60">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                        Total Amount Paid
                      </p>
                      <p className="text-lg font-bold text-primary">
                        Rs {totalAmountPaid.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">
                      {sortedGroup.length > 1 ? 'Total Amount' : 'Amount Paid'}
                    </p>
                    <p className="text-lg font-bold text-primary mt-0.5">
                      Rs {totalAmountPaid.toLocaleString()}
                    </p>
                  </>
                )}
              </div>
            </div>
            {(receipt.status === 'Partial' || receipt.status === 'Partially Paid') && (
              <div className="border border-amber-500/20 bg-amber-500/10 p-3 rounded-xl text-xs flex justify-between items-center text-amber-700 dark:text-amber-400 font-bold">
                <span>Payment Status:</span>
                <span className="uppercase">Partially Paid</span>
              </div>
            )}
          </div>

          <div className="text-center text-[11px] text-text-muted leading-relaxed pt-2">
            This is an automated system generated receipt.<br />Thank you for your payment.
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button className="flex items-center gap-1.5 font-bold" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button className="flex items-center gap-1.5 font-bold" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
