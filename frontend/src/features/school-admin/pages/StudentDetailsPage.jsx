import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../common/ui/button';
import { Card, CardContent } from '../../../common/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { schoolService } from '../../../common/services/schoolService';
import html2pdf from 'html2pdf.js';
import { 
  User, BookOpen, Users, Home, Calendar, FileText, 
  Download, Printer, AlertCircle, Eye, ChevronDown, ChevronUp, X 
} from 'lucide-react';

// Self-healing avatar image component to handle loading errors gracefully
const StudentAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : `http://localhost:8000${src}`;
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
  const fileUrl = docPath.startsWith('http') ? docPath : `http://localhost:8000${docPath}`;
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
          <h3 className="font-extrabold text-text-primary text-base tracking-tight">{docName}</h3>
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

// Receipt Modal View Component
function ReceiptModal({ receipt, student, schoolName, allPayments = [], onClose }) {
  const handlePrint = () => {
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
    doc.write('<html><head><title>Print Receipt</title>');
    // Copy stylesheets from parent to preserve styling in print
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
      doc.write(el.outerHTML);
    });
    doc.write(`
      <style>
        @page {
          size: auto;
          margin: 0mm;
        }
        body {
          background-color: white !important;
          color: black !important;
          padding: 40px !important;
        }
      </style>
    </head>
    <body class="bg-white text-black">
      <div class="space-y-6">
        ${printContent}
      </div>
    </body>
    </html>
    `);
    doc.close();
    
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  };

  const handleDownload = () => {
    const element = document.getElementById('receipt-print-area');
    const cleanName = student.name.split(/\s+/).join('');
    const cleanYear = (student.academic_year_name || student.academic_year || '2025-2026').replace(/[–]/g, '-');
    const filename = `FeeReceipt_${cleanName}_${cleanYear}.pdf`;

    const opt = {
      margin:       15,
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  };

  const groupPayments = allPayments.length 
    ? allPayments.filter(p => p.receipt_no === receipt.receipt_no) 
    : [receipt];

  const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
  
  const sortedGroup = [...groupPayments].sort((a, b) => {
    const idxA = academicMonths.indexOf(a.fee_month);
    const idxB = academicMonths.indexOf(b.fee_month);
    return idxA - idxB;
  });

  const totalAmountPaid = sortedGroup.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0);
  const displaySchoolName = schoolName || 'SHIKSHA PILOT SCHOOL';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-extrabold text-text-primary text-base tracking-tight font-display">Fee Payment Receipt</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        {/* Printable area */}
        <div className="p-8 space-y-6" id="receipt-print-area">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black tracking-tight text-text-primary font-display uppercase">{displaySchoolName}</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Fee Payment Receipt</p>
          </div>

          <div className="border-y border-dashed border-border py-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-text-muted">Student Name:</span> <span className="font-extrabold text-text-primary uppercase">{student.name}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Class & Section:</span> <span className="font-bold text-text-primary">{student.class_name} {student.section ? ` - Section ${student.section}` : ''}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Roll Number / SR No:</span> <span className="font-bold text-text-primary">{student.roll_no || '—'} / {student.sr_no || '—'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Receipt No:</span> <span className="font-mono font-bold text-text-primary">{receipt.receipt_no}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Academic Session:</span> <span className="font-bold text-text-primary">{student.academic_year_name || student.academic_year || '2025–2026'}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Payment Date:</span> <span className="font-bold text-text-primary">{formatDate(receipt.payment_date)}</span></div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border flex justify-between items-center">
              <div>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  {sortedGroup.length > 1 ? 'Billing Months' : 'Billing Month'}
                </p>
                <p className="text-sm font-black text-text-primary mt-0.5 max-w-[200px] break-words">
                  {sortedGroup.map(p => p.fee_month).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">
                  {sortedGroup.length > 1 ? 'Total Amount' : 'Amount Paid'}
                </p>
                <p className="text-lg font-black text-primary mt-0.5">
                  ₹{totalAmountPaid.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-text-muted leading-relaxed pt-2">
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

// Deposit Modal Component (Supports consecutive payments selection)
function DepositModal({ student, availableMonths, paidMonths, classFeeConfig, onSave, onClose }) {
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

  const getMonthAmount = (m) => {
    if (classFeeConfig && classFeeConfig.monthly_fees && classFeeConfig.monthly_fees[m]) {
      return parseFloat(classFeeConfig.monthly_fees[m]);
    }
    const paymentsList = student?.payments || [];
    const firstPaidAmount = paymentsList[0]?.amount_paid ? parseFloat(paymentsList[0].amount_paid) : 2000;
    return firstPaidAmount;
  };

  // Resolve the earliest unpaid month in the academic cycle
  const getEarliestUnpaid = () => {
    return academicMonths.find(m => !paidMonths.includes(m));
  };

  const handleMonthToggle = (month) => {
    const earliestUnpaid = getEarliestUnpaid();
    const idxOfToggle = academicMonths.indexOf(month);

    // If month is already checked, unchecking it should also uncheck all subsequent months
    if (selectedMonths.includes(month)) {
      setSelectedMonths(prev => {
        const next = prev.filter(m => academicMonths.indexOf(m) < idxOfToggle);
        return next;
      });
      setError('');
      return;
    }

    // Checking a month: must ensure all months between earliestUnpaid and this month are checked
    const idxOfEarliest = academicMonths.indexOf(earliestUnpaid);
    
    if (idxOfToggle > idxOfEarliest) {
      // Check if all intermediate months are selected. If not, we fill the gap automatically to enforce sequential order!
      const nextSelection = [];
      for (let i = idxOfEarliest; i <= idxOfToggle; i++) {
        nextSelection.push(academicMonths[i]);
      }
      setSelectedMonths(nextSelection);
      setError('');
    } else if (month === earliestUnpaid) {
      setSelectedMonths([month]);
      setError('');
    } else {
      // Chronological validation block
      setError('Cannot collect fees for a future month until all previous pending months have been paid.');
    }
  };

  const handleSave = async () => {
    if (selectedMonths.length === 0) {
      setError('Please select at least one month.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await schoolService.createFeePayment({
        student_id: student.id,
        months: selectedMonths
      });
      onSave();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to deposit fees.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-zinc-50 dark:bg-zinc-900/50">
          <h3 className="font-extrabold text-text-primary text-base tracking-tight">Deposit Fees</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-text-secondary">
            Select the months to deposit for <strong className="text-text-primary uppercase">{student.name}</strong>.
            Payments must follow the academic sequence chronologically.
          </p>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-[11px] font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Month Checkboxes list */}
          <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1 border border-border rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-900/10">
            {academicMonths.map(m => {
              const isPaid = paidMonths.includes(m);
              const isChecked = selectedMonths.includes(m);
              const earliestUnpaid = getEarliestUnpaid();
              
              // Allowed to toggle if it is the earliest unpaid OR if it is already checked
              const canSelect = !isPaid && (m === earliestUnpaid || selectedMonths.includes(m) || academicMonths.indexOf(m) <= academicMonths.indexOf(earliestUnpaid) + selectedMonths.length);

              return (
                <div key={m} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${isPaid ? 'bg-zinc-100 border-zinc-200 dark:bg-zinc-900/50 text-text-muted' : 'bg-surface border-border hover:bg-zinc-50/50'}`}>
                  <label className="flex items-center gap-2.5 font-bold uppercase select-none cursor-pointer w-full text-text-primary">
                    <input 
                      type="checkbox"
                      disabled={isPaid}
                      checked={isPaid || isChecked}
                      onChange={() => handleMonthToggle(m)}
                      className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4 disabled:opacity-50"
                    />
                    <span>{m} <span className="text-[10px] text-text-muted font-normal lowercase">(₹{getMonthAmount(m).toLocaleString()})</span></span>
                  </label>
                  <div>
                    {isPaid ? (
                      <span className="text-[9px] font-black bg-green-500/10 text-green-600 px-2 py-0.5 rounded uppercase">Paid</span>
                    ) : (
                      <span className="text-[9px] font-bold text-text-muted">Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 border-t border-border bg-surface flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button className="font-bold animate-pulse" disabled={saving || selectedMonths.length === 0} onClick={handleSave}>
            {saving ? 'Depositing...' : `Deposit ${selectedMonths.length > 0 ? `(₹${selectedMonths.reduce((sum, m) => sum + getMonthAmount(m), 0).toLocaleString()})` : ''}`}
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
  
  // Accordion toggle for Documents (closed by default)
  const [docsOpen, setDocsOpen] = useState(false);

  // Modal view triggers
  const [viewingDoc, setViewingDoc] = useState(null); // { name, path }
  const [viewingReceipt, setViewingReceipt] = useState(null); // payment object
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showRemovePhotoConfirm, setShowRemovePhotoConfirm] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [schoolProfile, setSchoolProfile] = useState(null);

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

  useEffect(() => {
    loadDetails();
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
      const res = await schoolService.uploadDocument(formData);
      
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

  const handleRevertPayment = async (receipt) => {
    if (!receipt || !receipt.id) return;
    if (window.confirm(`Are you sure you want to revert the payment for ${receipt.fee_month}? This will delete the payment record and receipt.`)) {
      try {
        await schoolService.revertFeePayment(receipt.id);
        await loadDetails();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to revert payment.');
      }
    }
  };

  const statusBadge = (status) => {
    const map = {
      ACTIVE: 'bg-green-500/10 text-green-600 border border-green-500/20',
      Inactive: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${map[status] || 'bg-zinc-100 text-zinc-500'}`}>
        {status}
      </span>
    );
  };

  // Calculate Month-wise Fee Statuses
  const getMonthWiseFees = () => {
    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

    const paymentsList = fee_summary.payments || [];
    const paidMonths = paymentsList.map(p => p.fee_month);

    return academicMonths.map((m) => {
      const isPaid = paidMonths.includes(m);
      const receipt = paymentsList.find(p => p.fee_month === m);
      
      const status = isPaid ? 'PAID' : 'UNPAID';
      const statusClass = isPaid 
        ? 'bg-green-500/10 text-green-600 border-green-500/20'
        : 'bg-red-500/10 text-red-600 border-red-500/20';

      let amount = 2000;
      if (isPaid && receipt) {
        amount = parseFloat(receipt.amount_paid);
      } else if (data && data.class_fee_config && data.class_fee_config.monthly_fees && data.class_fee_config.monthly_fees[m]) {
        amount = parseFloat(data.class_fee_config.monthly_fees[m]);
      } else {
        const firstPaid = paymentsList[0]?.amount_paid ? parseFloat(paymentsList[0].amount_paid) : 2000;
        amount = firstPaid;
      }

      return {
        month: m,
        status,
        statusClass,
        receipt,
        amount
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
          <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Student Profile</h2>
        </div>
        {student.status !== 'Alumni' && student.status !== 'Archived' && (
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
                    if (student.status !== 'Alumni' && student.status !== 'Archived') {
                      setShowPhotoMenu(prev => !prev);
                    }
                  }}
                  className={`w-20 h-20 rounded-full border-4 border-surface bg-zinc-50 flex items-center justify-center overflow-hidden shadow-xs transition-all focus:outline-none ${student.status !== 'Alumni' && student.status !== 'Archived' ? 'hover:ring-2 hover:ring-primary/20 cursor-pointer' : ''}`}
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
              <h3 className="font-black text-text-primary text-base text-center mt-3 leading-tight">{student.name}</h3>
              
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
              { id: 'profile', label: 'Student & Parents' },
              { id: 'academic', label: 'Academic Results' }
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
                    <p><span className="text-text-muted block font-medium">Class Assigned</span> <span className="font-semibold text-text-primary text-sm">{student.class_name || 'Not Assigned'}{student.section ? ` - ${student.section}` : ''}</span></p>
                    <p><span className="text-text-muted block font-medium">Exit Date</span> <span className="font-semibold text-text-primary text-sm">{student.exit_date || 'Not Assigned'}</span></p>
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
                      <p className="font-bold text-text-primary uppercase text-[10px] tracking-wider mb-2">Current Residence Address</p>
                      <p className="text-text-secondary leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 border border-border p-3 rounded-lg min-h-[70px]">
                        {student.current_address_line ? (
                          `${student.current_address_line}, ${student.current_city}, ${student.current_state} - ${student.current_pin_code}, ${student.current_country || 'India'}`
                        ) : (
                          student.address || '-'
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-text-primary uppercase text-[10px] tracking-wider mb-2">Permanent Address</p>
                      <p className="text-text-secondary leading-relaxed bg-zinc-50 dark:bg-zinc-900/50 border border-border p-3 rounded-lg min-h-[70px]">
                        {student.same_as_current === 1 ? (
                          <span className="text-[10px] font-bold text-teal-600 bg-teal-500/10 px-2 py-0.5 rounded">SAME AS CURRENT ADDRESS</span>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {[
                        { key: 'birth_cert_path', label: 'Birth Certificate' },
                        { key: 'aadhaar_path', label: 'Aadhaar Card' },
                        { key: 'transfer_cert_path', label: 'Transfer Certificate (TC)' },
                        { key: 'report_card_path', label: 'Previous Report Card' },
                        { key: 'additional_docs_path', label: 'Additional Documents' }
                      ].map(doc => {
                        const hasDoc = !!student[doc.key];
                        return (
                          <div key={doc.key} className="flex items-center justify-between p-3 border border-border rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10">
                            <div>
                              <p className="font-bold text-text-primary uppercase text-[10px] tracking-wider">{doc.label}</p>
                              <p className="text-[10px] text-text-muted mt-0.5">
                                {hasDoc ? 'Scanned PDF/Image copy' : 'No document uploaded'}
                              </p>
                            </div>
                            {hasDoc ? (
                              <button 
                                onClick={() => setViewingDoc({ name: doc.label, path: student[doc.key] })}
                                className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shadow-xs"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View File</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Missing</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Sub-tab 2: Academic Results */}
          {activeSubTab === 'academic' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="shadow-xs">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Attendance Summary</h4>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full border-8 border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center relative">
                        <span className="text-lg font-black text-text-primary">{attendance_summary.percentage}%</span>
                        <span className="text-[8px] text-text-muted uppercase font-bold">Rate</span>
                      </div>
                    </div>
                    <div className="text-xs space-y-1.5 flex-1 w-full">
                      <p className="flex justify-between max-w-sm"><span className="text-text-muted font-medium">Total Session Classes:</span> <span className="font-bold font-mono">{attendance_summary.total_marked} Days</span></p>
                      <p className="flex justify-between max-w-sm"><span className="text-text-muted font-medium">Attended (Present):</span> <span className="font-bold font-mono text-teal-600">{attendance_summary.present_count} Days</span></p>
                      <p className="flex justify-between max-w-sm"><span className="text-text-muted font-medium">Absences/Leaves:</span> <span className="font-bold font-mono text-red-500">{attendance_summary.total_marked - attendance_summary.present_count} Days</span></p>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden max-w-sm mt-3">
                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${attendance_summary.percentage}%` }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xs">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Examination Summary</h4>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Exam Name</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Marks Obtained</TableHead>
                        <TableHead>Max Marks</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exam_results.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-text-muted text-xs">No exam marks entered for this student.</TableCell>
                        </TableRow>
                      ) : (
                        exam_results.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-semibold text-text-primary text-xs">{r.exam_name}</TableCell>
                            <TableCell className="text-text-secondary text-xs">{r.subject_name || '-'}</TableCell>
                            <TableCell className="font-bold font-mono text-xs text-primary">{r.marks_obtained}</TableCell>
                            <TableCell className="font-mono text-xs text-text-muted">{r.max_marks}</TableCell>
                            <TableCell>
                              <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-primary border border-border">
                                {r.grade || 'A'}
                              </span>
                            </TableCell>
                            <TableCell className="text-text-secondary text-xs truncate max-w-[150px]">{r.remarks || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Sub-tab 3: Finance */}
          {activeSubTab === 'finance' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {(!data || !data.class_fee_config) ? (
                <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center text-center space-y-4 max-w-md mx-auto shadow-2xs">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h3 className="font-extrabold text-text-primary text-base">Fee Structure Not Configured</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    The monthly fee structure for <strong className="text-text-primary uppercase">{student.class_name || 'this class'}</strong> has not been configured for the current Academic Year. <br />
                    Please configure the class fee before collecting or managing student fees.
                  </p>
                  <Button 
                    onClick={() => navigate('/school-admin/audits-settings', { state: { preselectClassId: student.class_id } })}
                    className="font-bold bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-1.5 text-xs h-9 px-4 rounded-lg shadow-2xs mt-2"
                  >
                    Configure Class Fee
                  </Button>
                </div>
              ) : (
                <>
                  {/* Fee summary card */}
                  {(() => {
                    let totalSessionFee = 0;
                    const academicMonths = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
                    
                    if (data && data.class_fee_config && data.class_fee_config.monthly_fees) {
                      academicMonths.forEach(m => {
                        totalSessionFee += parseFloat(data.class_fee_config.monthly_fees[m] || 0);
                      });
                    } else {
                      const monthlyFee = fee_summary.payments?.[0]?.amount_paid ? parseFloat(fee_summary.payments[0].amount_paid) : 2000;
                      totalSessionFee = 12 * monthlyFee;
                    }
                    const totalDuesInSession = Math.max(0, totalSessionFee - parseFloat(fee_summary.total_paid));
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <Card className="shadow-xs p-5 bg-surface border-border flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total Paid in Session</p>
                            <p className="text-2xl font-black text-teal-600 mt-1 font-display">₹{parseFloat(fee_summary.total_paid).toLocaleString()}</p>
                          </div>
                        </Card>
                        
                        <Card className="shadow-xs p-5 bg-surface border-border flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Total Dues In Session</p>
                            <p className="text-2xl font-black text-amber-600 mt-1 font-display">₹{totalDuesInSession.toLocaleString()}</p>
                          </div>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* Month-wise Fee Management panel */}
                  <Card className="shadow-xs">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center gap-2 border-b border-border pb-2.5">
                        <FileText className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Month-wise Fee Record</h4>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Payment Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthWiseList.map(mw => (
                            <TableRow key={mw.month}>
                              <TableCell className="font-extrabold text-text-primary text-xs uppercase tracking-wider">
                                {mw.month}
                              </TableCell>
                              <TableCell className="text-xs text-text-primary">
                                ₹{mw.amount.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs text-text-secondary">
                                {mw.status === 'PAID' && mw.receipt?.payment_date ? formatDate(mw.receipt.payment_date) : '—'}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${mw.statusClass}`}>
                                  {mw.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {mw.status === 'PAID' ? (
                                  <div className="flex justify-end gap-2">
                                    {student.status !== 'Alumni' && student.status !== 'Archived' && (
                                      <Button 
                                        variant="secondary" 
                                        className="h-7 w-20 text-[10px] px-0 font-bold"
                                        onClick={() => handleRevertPayment(mw.receipt)}
                                      >
                                        Revert
                                      </Button>
                                    )}
                                    <Button 
                                      variant="secondary" 
                                      className="h-7 w-20 text-[10px] px-0 font-bold"
                                      onClick={() => setViewingReceipt(mw.receipt)}
                                    >
                                      Receipt
                                    </Button>
                                  </div>
                                ) : (
                                  student.status !== 'Alumni' && student.status !== 'Archived' ? (
                                    <Button 
                                      className="h-7 w-20 text-[10px] px-0 font-bold"
                                      onClick={() => setShowDepositModal(true)}
                                    >
                                      Deposit
                                    </Button>
                                  ) : (
                                    <span className="text-[10px] text-text-muted font-bold">—</span>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
        <ReceiptModal 
          receipt={viewingReceipt} 
          student={student} 
          schoolName={schoolProfile?.name}
          allPayments={fee_summary.payments}
          onClose={() => setViewingReceipt(null)} 
        />
      )}

      {/* Fee Deposit Dialog */}
      {showDepositModal && (
        <DepositModal 
          student={student} 
          paidMonths={paidMonthsList} 
          classFeeConfig={data?.class_fee_config}
          onSave={async () => {
            setShowDepositModal(false);
            await loadDetails();
          }} 
          onClose={() => setShowDepositModal(false)} 
        />
      )}

      {/* Remove Photo Confirmation Modal */}
      {showRemovePhotoConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col p-6 space-y-4">
            <h3 className="font-extrabold text-text-primary text-base tracking-tight text-center">
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

    </div>
  );
}
