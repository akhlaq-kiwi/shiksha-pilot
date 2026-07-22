import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Landmark, Plus, Search, Calendar, Clock, Eye, Edit, Trash2, MoreVertical, X, AlertTriangle, User, ChevronDown, RefreshCw, Percent, Clipboard, CheckCircle, HelpCircle, FileSpreadsheet, FileText, FileDown, AlertCircle, Info } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { Dialog } from '../../../common/ui/dialog';
import { schoolService } from '../../../common/services/schoolService';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';

const formatCurrency = (val) => {
  const num = parseFloat(val);
  const safeNum = isNaN(num) ? 0 : num;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(safeNum);
};

const formatDateFull = (dateStr) => {
  if (!dateStr) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ACADEMIC_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

export default function FinanceManagementPage() {
  const location = useLocation();
  const initialTab = location.state?.tab || new URLSearchParams(location.search).get('tab') || 'expenses';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = location.state?.tab || new URLSearchParams(location.search).get('tab');
    if (tab && ['expenses', 'additional-fee', 'transport-fee', 'late-payment-penalty'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  // Late Payment Penalty states
  const [lppStats, setLppStats] = useState({
    current_academic_session: 'N/A',
    total_students: 0,
    students_having_due: 0,
    total_outstanding_due: 0.00,
    last_applied_date: null,
    last_applied_by: null,
    active_processing_id: null
  });
  const [lppStatsLoading, setLppStatsLoading] = useState(false);
  const [lppPercentage, setLppPercentage] = useState('');
  const [lppDescription, setLppDescription] = useState('Late Payment Penalty after Academic Year Migration');
  const [lppStatus, setLppStatus] = useState('Active');
  const [lppApplying, setLppApplying] = useState(false);
  const [isLppConfigSaved, setIsLppConfigSaved] = useState(false);
  const [lppHistory, setLppHistory] = useState([]);
  const [lppHistoryFilters, setLppHistoryFilters] = useState({
    academic_year_id: '',
    class_name: '',
    section_name: '',
    student_name: '',
    admission_no: '',
    date: '',
    applied_by_name: ''
  });
  const [lppHistoryLoading, setLppHistoryLoading] = useState(false);
  const [lppSubView, setLppSubView] = useState('apply'); // 'apply' or 'history'
  
  // Finance Settings states
  const [financeSettingsLoading, setFinanceSettingsLoading] = useState(false);
  const [enableDueRestriction, setEnableDueRestriction] = useState(false);
  const [maxAllowedDue, setMaxAllowedDue] = useState('0');
  const [restrictAdmitCard, setRestrictAdmitCard] = useState(true);
  const [restrictExamResult, setRestrictExamResult] = useState(true);
  const [savingFinanceSettings, setSavingFinanceSettings] = useState(false);
  const [isLppRemoveConfirmOpen, setIsLppRemoveConfirmOpen] = useState(false);

  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [transportFees, setTransportFees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status notifications
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Transport Fees State & Filters
  const [transportSearch, setTransportSearch] = useState('');
  const [transportStatusFilter, setTransportStatusFilter] = useState('All');

  // Searchable student select in Transport Modal
  const [studentsList, setStudentsList] = useState([]);
  const [studentSearchVal, setStudentSearchVal] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const studentSearchRef = useRef(null);

  // Dialog Modal State for Transport Fee
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [editingTransport, setEditingTransport] = useState(null); // null = add mode
  const [transportMonthlyFee, setTransportMonthlyFee] = useState('');
  const [transportStartDate, setTransportStartDate] = useState('');
  const [transportStatus, setTransportStatus] = useState('Active');
  const [transportSubmitting, setTransportSubmitting] = useState(false);
  const [transportFormErrors, setTransportFormErrors] = useState({});
  const [viewingTransportDetails, setViewingTransportDetails] = useState(null);

  // Delete Transport Confirmation
  const [deletingTransportId, setDeletingTransportId] = useState(null);
  const [activeTransportDropdownId, setActiveTransportDropdownId] = useState(null);
  // Expenses Tab State & Filters
  const [expenseSearch, setExpenseSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  
  // Expenses Lazy Loading
  const [visibleExpensesCount, setVisibleExpensesCount] = useState(25);
  const [isFetchingMoreExpenses, setIsFetchingMoreExpenses] = useState(false);
  const expensesContainerRef = useRef(null);

  // Additional Fee Tab State & Filters
  const [feeSearch, setFeeSearch] = useState('');

  // Additional Fee Lazy Loading
  const [visibleFeesCount, setVisibleFeesCount] = useState(25);
  const [isFetchingMoreFees, setIsFetchingMoreFees] = useState(false);
  const feesContainerRef = useRef(null);

  // Three-dot Action Dropdowns State
  const [activeExpenseDropdownId, setActiveExpenseDropdownId] = useState(null);
  const [activeFeeDropdownId, setActiveFeeDropdownId] = useState(null);
  const [dropdownCoords, setDropdownCoords] = useState(null);
  const dropdownRef = useRef(null);

  // Dialog Modals State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null); // null = add mode
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Delete Expense Confirmation
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);

  // Apply / Edit Additional Fee Form State
  const [isApplyFeeModalOpen, setIsApplyFeeModalOpen] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState(null); // null = add mode
  const [applyType, setApplyType] = useState('school'); // 'school' | 'classes'
  const [feeDescription, setFeeDescription] = useState('');
  const [feeSchoolAmount, setFeeSchoolAmount] = useState('');
  const [classAmountsMap, setClassAmountsMap] = useState({}); // classId => amount string
  const [feeDueDate, setFeeDueDate] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);
  const [feeFormErrors, setFeeFormErrors] = useState({});

  // View Summary Detail Popup for Additional Fee Type
  const [viewingFeeType, setViewingFeeType] = useState(null);

  // Delete Additional Fee Confirmation
  const [deletingFeeTypeId, setDeletingFeeTypeId] = useState(null);

  // Annual Fee Form & Confirmation Dialog State
  const [isAnnualFeeModalOpen, setIsAnnualFeeModalOpen] = useState(false);
  const [annualFeeApplyType, setAnnualFeeApplyType] = useState('school'); // 'school' | 'classes'
  const [annualFeeAmount, setAnnualFeeAmount] = useState('');
  const [annualFeeClassAmountsMap, setAnnualFeeClassAmountsMap] = useState({});
  const [annualFeeSubmitting, setAnnualFeeSubmitting] = useState(false);
  const [annualFeeFormErrors, setAnnualFeeFormErrors] = useState({});
  const [isAnnualFeeConfirmOpen, setIsAnnualFeeConfirmOpen] = useState(false);

  const handleAnnualFeeModalOpen = () => {
    setAnnualFeeApplyType('school');
    setAnnualFeeAmount('');
    setAnnualFeeClassAmountsMap({});
    setAnnualFeeFormErrors({});
    setIsAnnualFeeConfirmOpen(false);
    setIsAnnualFeeModalOpen(true);
  };

  const handleAnnualFeeInitialSubmit = (e) => {
    if (e) e.preventDefault();
    const errors = {};
    if (annualFeeApplyType === 'school') {
      if (!annualFeeAmount || parseFloat(annualFeeAmount) <= 0) {
        errors.amount = 'Annual Fee amount must be greater than 0.';
      } else if (parseFloat(annualFeeAmount) > 10000000) {
        errors.amount = 'Annual Fee amount exceeds system maximum.';
      }
    } else {
      const enteredAmounts = Object.values(annualFeeClassAmountsMap).filter(v => v !== '' && parseFloat(v) > 0);
      if (enteredAmounts.length === 0) {
        errors.classes = 'At least one class fee amount must be entered.';
      }
      Object.entries(annualFeeClassAmountsMap).forEach(([cid, val]) => {
        if (val !== '' && parseFloat(val) < 0) {
          errors[`class_${cid}`] = 'Amount cannot be negative.';
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setAnnualFeeFormErrors(errors);
      return;
    }

    setAnnualFeeFormErrors({});
    setIsAnnualFeeConfirmOpen(true);
  };

  const handleSaveAnnualFee = async () => {
    setError('');
    setSuccess('');
    setAnnualFeeSubmitting(true);
    try {
      await schoolService.createAnnualFee({
        apply_type: annualFeeApplyType,
        amount: annualFeeAmount,
        class_amounts: annualFeeClassAmountsMap
      });
      setSuccess('Annual Fee created successfully.');
      setIsAnnualFeeConfirmOpen(false);
      setIsAnnualFeeModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Failed to create annual fee.');
      setIsAnnualFeeConfirmOpen(false);
    } finally {
      setAnnualFeeSubmitting(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsList, ayList, typesList, transList, studList] = await Promise.all([
        schoolService.getClasses(),
        schoolService.getAcademicYears(),
        schoolService.getAdditionalFeeTypes(),
        schoolService.getTransportFees(),
        schoolService.getStudents({ limit: 1000 })
      ]);
      setClasses(clsList || []);
      setAcademicYears(ayList || []);
      setFeeTypes(typesList || []);
      setTransportFees(transList || []);
      setStudentsList(studList || []);

      // Fetch expenses
      await loadExpensesList();
    } catch (err) {
      console.error(err);
      setError('Failed to fetch finance records.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransportFeesList = async () => {
    try {
      const transList = await schoolService.getTransportFees({ status: transportStatusFilter });
      setTransportFees(transList || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'transport-fee') {
      loadTransportFeesList();
    }
  }, [transportStatusFilter, activeTab]);

  const loadExpensesList = async () => {
    try {
      const expensesList = await schoolService.getSchoolExpenses({
        search: expenseSearch,
        month: selectedMonth
      });
      setExpenses(expensesList || []);
    } catch (err) {
      console.error(err);
    }
  };

  const lppPollInterval = useRef(null);

  const loadLppStats = async () => {
    setLppStatsLoading(true);
    try {
      const stats = await schoolService.getLatePaymentPenaltyStats();
      setLppStats(stats || {});
      return stats;
    } catch (err) {
      console.error(err);
      setError('Failed to fetch Late Payment Penalty statistics.');
      return null;
    } finally {
      setLppStatsLoading(false);
    }
  };

  const loadLppConfig = async (sessionYear) => {
    try {
      const config = await schoolService.getLatePaymentPenaltyConfig();
      const currentSess = sessionYear || lppStats.current_academic_session || currentYear?.name || '';
      const defaultDesc = currentSess ? `Late Payment Penalty ${currentSess}` : 'Late Payment Penalty';
      if (config && config.percentage) {
        setLppPercentage(config.percentage ? String(config.percentage) : '');
        setLppDescription(config.description ? config.description : defaultDesc);
        setLppStatus(config.status || 'Active');
        setIsLppConfigSaved(true);
      } else {
        setLppDescription(defaultDesc);
        setIsLppConfigSaved(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch Late Payment Penalty configuration.');
    }
  };

  const handleSaveAllFinanceConfig = async () => {
    if (!lppPercentage) {
      setError('Penalty percentage is required.');
      return;
    }
    const pct = parseFloat(lppPercentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('Penalty percentage must be between 0.01 and 100.');
      return;
    }
    const limit = parseFloat(maxAllowedDue);
    if (isNaN(limit) || limit < 0) {
      setError('Maximum allowed due amount must be a positive number.');
      return;
    }
    setError('');
    setSuccess('');
    setLppApplying(true);
    try {
      await Promise.all([
        schoolService.saveLatePaymentPenaltyConfig({
          percentage: pct,
          description: lppDescription,
          status: lppStatus
        }),
        schoolService.saveFinanceSettings({
          enable_due_restriction: enableDueRestriction ? 1 : 0,
          max_allowed_due: limit,
          restrict_admit_card: restrictAdmitCard ? 1 : 0,
          restrict_exam_result: restrictExamResult ? 1 : 0
        })
      ]);
      setSuccess('Configurations saved successfully.');
      setIsLppConfigSaved(true);
      loadLppConfig();
      loadFinanceSettings();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Failed to save configurations.');
    } finally {
      setLppApplying(false);
    }
  };

  const loadLppHistory = async () => {
    setLppHistoryLoading(true);
    try {
      const history = await schoolService.getLatePaymentPenaltyHistory(lppHistoryFilters);
      setLppHistory(history || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch penalty history.');
    } finally {
      setLppHistoryLoading(false);
    }
  };

  const handleLppReset = () => {
    setLppPercentage('');
    const currentSess = lppStats.current_academic_session || currentYear?.name || '';
    setLppDescription(currentSess ? `Late Payment Penalty ${currentSess}` : 'Late Payment Penalty');
    setLppStatus('Active');
    setError('');
    setSuccess('');
  };

  const handleRemoveLppConfig = async () => {
    setError('');
    setSuccess('');
    setLppApplying(true);
    try {
      await schoolService.deleteLatePaymentPenaltyConfig();
      setSuccess('Late Payment Penalty configuration removed successfully.');
      setIsLppConfigSaved(false);
      handleLppReset();
      setLppPercentage('');
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || 'Failed to remove configuration.');
    } finally {
      setLppApplying(false);
      setIsLppRemoveConfirmOpen(false);
    }
  };

  const loadFinanceSettings = async () => {
    setFinanceSettingsLoading(true);
    try {
      const res = await schoolService.getFinanceSettings();
      if (res) {
        setEnableDueRestriction(res.enable_due_restriction === 1);
        setMaxAllowedDue(res.max_allowed_due ? String(res.max_allowed_due) : '0');
        setRestrictAdmitCard(res.restrict_admit_card === 1);
        setRestrictExamResult(res.restrict_exam_result === 1);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch finance settings.');
    } finally {
      setFinanceSettingsLoading(false);
    }
  };

  const exportLppHistoryCSV = () => {
    const headers = ['Student', 'Admission Number', 'Class', 'Due Amount', 'Penalty Percentage', 'Penalty Amount', 'Description', 'Status', 'Created Date'];
    const rows = lppHistory.map(row => [
      row.student_name || '',
      row.admission_no || '',
      `${row.class_name || ''}${row.section_name ? ' - ' + row.section_name : ''}`,
      row.outstanding_due || 0,
      row.penalty_percentage || 0,
      row.penalty_amount || 0,
      row.description || '',
      row.status || 'Success',
      row.created_at || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Late_Payment_Penalty_Report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const exportLppHistoryExcel = () => {
    let xml = '<?xml version="1.0"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
    xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
    xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
    xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
    xml += ' <Styles>\n';
    xml += '  <Style ss:Id="Header">\n';
    xml += '   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>\n';
    xml += '   <Interior ss:Color="#365F91" ss:Pattern="Solid"/>\n';
    xml += '  </Style>\n';
    xml += ' </Styles>\n';
    xml += ' <Worksheet ss:Name="Penalty History">\n';
    xml += '  <Table>\n';
    xml += '   <Row>\n';
    const headers = ['Student', 'Admission Number', 'Class', 'Due Amount', 'Penalty Percentage', 'Penalty Amount', 'Description', 'Status', 'Created Date'];
    headers.forEach(h => {
      xml += `    <Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>\n`;
    });
    xml += '   </Row>\n';
    lppHistory.forEach(row => {
      xml += '   <Row>\n';
      xml += `    <Cell><Data ss:Type="String">${row.student_name || ''}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${row.admission_no || ''}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${row.class_name || ''}${row.section_name ? ' - ' + row.section_name : ''}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${row.outstanding_due || 0}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${row.penalty_percentage || 0}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="Number">${row.penalty_amount || 0}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${row.description || ''}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${row.status || 'Success'}</Data></Cell>\n`;
      xml += `    <Cell><Data ss:Type="String">${row.created_at || ''}</Data></Cell>\n`;
      xml += '   </Row>\n';
    });
    xml += '  </Table>\n';
    xml += ' </Worksheet>\n';
    xml += '</Workbook>\n';
    
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Late_Payment_Penalty_Report_${new Date().toISOString().slice(0,10)}.xls`;
    a.click();
  };

  const exportLppHistoryPDF = () => {
    const reportHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="margin-bottom: 5px; font-weight: bold;">Late Payment Penalty Audit History</h2>
        <p style="font-size: 12px; color: #666; margin-bottom: 20px;">Academic Session: ${lppStats.current_academic_session} &bull; Generated on: ${new Date().toLocaleString()}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;">
          <thead>
            <tr style="background-color: #365F91; color: white; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">Student</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Admission No</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Class</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Due Amount</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Penalty %</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Penalty Amount</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Description</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Applied By</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${lppHistory.map(row => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${row.student_name || ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${row.admission_no || ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${row.class_name || ''}${row.section_name ? ' - ' + row.section_name : ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">₹${(row.outstanding_due || 0).toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${row.penalty_percentage || 0}%</td>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #1e3a8a;">₹${(row.penalty_amount || 0).toFixed(2)}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${row.description || ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${row.applied_by_name || ''}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${row.created_at ? row.created_at.slice(0, 10) : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = reportHtml;
    
    const opt = {
      margin:       10,
      filename:     `Late_Payment_Penalty_Report_${new Date().toISOString().slice(0,10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    
    html2pdf().from(tempDiv).set(opt).save();
  };

  useEffect(() => {
    if (activeTab === 'late-payment-penalty') {
      loadLppStats().then(stats => {
        loadLppConfig(stats?.current_academic_session);
      });
      loadFinanceSettings();
      if (lppSubView === 'history') {
        loadLppHistory();
      }
    }
  }, [activeTab, lppSubView]);

  const { isReadOnly, currentYear } = useAcademicYear();

  useEffect(() => {
    loadData();
    const handleYearSwitch = () => {
      loadData();
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, []);

  // Reload expenses list when filters trigger changes
  useEffect(() => {
    loadExpensesList();
    setVisibleExpensesCount(25);
    if (expensesContainerRef.current) {
      expensesContainerRef.current.scrollTop = 0;
    }
  }, [expenseSearch, selectedMonth]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveExpenseDropdownId(null);
        setActiveFeeDropdownId(null);
        setActiveTransportDropdownId(null);
      }
    };
    const handleScroll = () => {
      setActiveExpenseDropdownId(null);
      setActiveFeeDropdownId(null);
      setActiveTransportDropdownId(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // Click outside searchable student picker
  useEffect(() => {
    const handleClickOutsideStudent = (e) => {
      if (studentSearchRef.current && !studentSearchRef.current.contains(e.target)) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideStudent);
    return () => document.removeEventListener('mousedown', handleClickOutsideStudent);
  }, []);

  const handleTransportModalOpen = (transportToEdit = null) => {
    if (!transportToEdit) {
      setSelectedStudent(null);
      setStudentSearchVal('');
      setTransportMonthlyFee('');
      setTransportStartDate(getLocalDateString());
      setTransportStatus('Active');
      setEditingTransport(null);
    } else {
      setEditingTransport(transportToEdit);
      setSelectedStudent({
        id: transportToEdit.student_id,
        name: transportToEdit.student_name,
        sr_no: transportToEdit.sr_no,
        class_name: transportToEdit.class_name ? `${transportToEdit.class_name}${transportToEdit.class_section ? ` - ${transportToEdit.class_section}` : ''}` : '—',
        roll_no: transportToEdit.roll_no
      });
      setStudentSearchVal(transportToEdit.student_name);
      setTransportMonthlyFee(transportToEdit.monthly_fee.toString());
      setTransportStartDate(transportToEdit.start_date);
      setTransportStatus(transportToEdit.status);
    }
    setTransportFormErrors({});
    setIsTransportModalOpen(true);
  };

  const handleSaveTransport = async (e) => {
    if (e) e.preventDefault();
    const errors = {};

    if (!selectedStudent || !selectedStudent.id) {
      errors.student = 'Student selection is required.';
    }
    if (!transportMonthlyFee) {
      errors.monthly_fee = 'Monthly transport fee is required.';
    } else if (parseFloat(transportMonthlyFee) < 0) {
      errors.monthly_fee = 'Monthly transport fee cannot be negative.';
    }
    if (!transportStartDate) {
      errors.start_date = 'Start date is required.';
    } else if (currentYear) {
      if (transportStartDate < currentYear.start_date || transportStartDate > currentYear.end_date) {
        errors.start_date = `Start date must be within active year (${formatDateFull(currentYear.start_date)} to ${formatDateFull(currentYear.end_date)}).`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setTransportFormErrors(errors);
      return;
    }

    setTransportFormErrors({});
    setTransportSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        student_id: selectedStudent.id,
        monthly_fee: parseFloat(transportMonthlyFee),
        start_date: transportStartDate,
        status: transportStatus
      };

      if (editingTransport) {
        await schoolService.updateTransportFee(editingTransport.id, payload);
        setSuccess('Transport fee assignment updated successfully.');
      } else {
        await schoolService.assignTransportFee(payload);
        setSuccess('Transport fee successfully assigned.');
      }
      setIsTransportModalOpen(false);
      setEditingTransport(null);
      setSelectedStudent(null);
      setStudentSearchVal('');
      await loadTransportFeesList();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      if (err.fields) {
        setTransportFormErrors(err.fields);
      } else {
        setError(err.message || 'Failed to save transport fee.');
      }
    } finally {
      setTransportSubmitting(false);
    }
  };

  const handleDeleteTransport = async () => {
    if (!deletingTransportId) return;
    setError('');
    setSuccess('');
    try {
      await schoolService.deleteTransportFee(deletingTransportId);
      setSuccess('Transport fee deleted successfully.');
      setDeletingTransportId(null);
      await loadTransportFeesList();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete transport fee assignment.');
      setDeletingTransportId(null);
    }
  };

  const handleToggleTransportStatus = async (item) => {
    const nextStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    setError('');
    setSuccess('');
    try {
      await schoolService.toggleTransportFeeStatus(item.id, nextStatus);
      setSuccess(`Transport fee marked as ${nextStatus}.`);
      await loadTransportFeesList();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update transport status.');
    }
  };

  const handleTransportDropdownOpen = (tf, e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownCoords({
      top: rect.bottom + window.scrollY,
      left: rect.left - 120 + window.scrollX,
    });
    setActiveTransportDropdownId(tf.id);
  };

  const handleExpenseModalOpen = (expenseToEdit = null) => {
    setError('');
    setSuccess('');
    setActiveExpenseDropdownId(null);

    if (expenseToEdit) {
      if (expenseToEdit.is_locked) {
        alert('This expense has already been included in a generated financial report and can no longer be modified.');
        return;
      }
      setEditingExpense(expenseToEdit);
      setExpenseDesc(expenseToEdit.description || '');
      setExpenseAmount(expenseToEdit.amount || '');
      setExpenseDate(expenseToEdit.expense_date || '');
    } else {
      setEditingExpense(null);
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseDate(getLocalDateString());
    }
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount || !expenseDate) {
      alert('Please fill in all mandatory fields.');
      return;
    }
    if (parseFloat(expenseAmount) <= 0) {
      alert('Amount must be positive.');
      return;
    }
    const todayStr = getLocalDateString();
    if (expenseDate > todayStr) {
      alert('Expense date cannot be in the future.');
      return;
    }

    setExpenseSubmitting(true);
    setError('');
    setSuccess('');

    const payload = {
      description: expenseDesc.trim(),
      amount: parseFloat(expenseAmount),
      expense_date: expenseDate
    };

    try {
      if (editingExpense) {
        const updated = await schoolService.updateSchoolExpense(editingExpense.id, payload);
        setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? updated : exp));
        setSuccess('Expense updated successfully.');
      } else {
        const added = await schoolService.createSchoolExpense(payload);
        setExpenses(prev => [added, ...prev]);
        setSuccess('Expense recorded successfully.');
      }
      setIsExpenseModalOpen(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save expense entry.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpenseClick = (exp) => {
    setActiveExpenseDropdownId(null);
    if (exp.is_locked) {
      alert('This expense has already been included in a generated financial report and can no longer be modified.');
      return;
    }
    setDeletingExpenseId(exp.id);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpenseId) return;
    setError('');
    setSuccess('');
    try {
      await schoolService.deleteSchoolExpense(deletingExpenseId);
      setExpenses(prev => prev.filter(exp => exp.id !== deletingExpenseId));
      setSuccess('Expense deleted successfully.');
      setDeletingExpenseId(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete expense.');
      setDeletingExpenseId(null);
    }
  };

  const handleApplyFeeModalOpen = () => {
    setError('');
    setSuccess('');
    setEditingFeeType(null);
    setFeeDescription('');
    setFeeSchoolAmount('');
    
    // Auto-populate all classes map to empty string amounts
    const initialMap = {};
    classes.forEach(c => {
      initialMap[c.id] = '';
    });
    setClassAmountsMap(initialMap);

    setFeeDueDate('');
    setApplyType('school');
    setFeeFormErrors({});
    setIsApplyFeeModalOpen(true);
  };

  const handleEditFeeTypeClick = (ft) => {
    setActiveFeeDropdownId(null);
    setError('');
    setSuccess('');
    setEditingFeeType(ft);
    setFeeDescription(ft.name);
    setFeeDueDate(ft.due_date);
    setFeeSchoolAmount(ft.amount);
    setApplyType(ft.assigned_to === 'For All' ? 'school' : 'classes');
    setFeeFormErrors({});
    setIsApplyFeeModalOpen(true);
  };

  const handleDeleteFeeTypeClick = (ft) => {
    setActiveFeeDropdownId(null);
    if (ft.collected_students > 0) {
      alert('Cannot delete this additional fee because some students have already paid.');
      return;
    }
    setDeletingFeeTypeId(ft.id);
  };

  const handleDeleteFeeType = async () => {
    if (!deletingFeeTypeId) return;
    setError('');
    setSuccess('');
    try {
      await schoolService.deleteAdditionalFeeType(deletingFeeTypeId);
      setFeeTypes(prev => prev.filter(ft => ft.id !== deletingFeeTypeId));
      setSuccess('Additional fee deleted successfully.');
      setDeletingFeeTypeId(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to delete additional fee.');
      setDeletingFeeTypeId(null);
    }
  };

  const handleApplyAdditionalFee = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    const errors = {};
    if (!feeDescription.trim()) {
      errors.description = 'Fee description is required.';
    }
    if (!feeDueDate) {
      errors.dueDate = 'Due date is required.';
    }

    const payload = {
      name: feeDescription.trim(),
      due_date: feeDueDate
    };

    // Mode specific attributes
    if (!editingFeeType) {
      payload.effective_date = getLocalDateString();
      payload.apply_type = applyType;
      if (applyType === 'school') {
        if (!feeSchoolAmount) {
          errors.amount = 'Fee amount is required.';
        } else if (parseFloat(feeSchoolAmount) <= 0) {
          errors.amount = 'Amount must be greater than zero.';
        } else {
          payload.amount = parseFloat(feeSchoolAmount);
        }
      } else {
        const activeClassAmounts = {};
        let hasPositive = false;
        let hasInvalid = false;
        Object.keys(classAmountsMap).forEach(classId => {
          const val = classAmountsMap[classId];
          if (val && val.trim() !== '') {
            const amt = parseFloat(val);
            if (amt > 0) {
              activeClassAmounts[classId] = amt;
              hasPositive = true;
            } else {
              hasInvalid = true;
            }
          }
        });

        if (hasInvalid) {
          errors.classAmounts = 'Class fee amounts must be greater than zero.';
        } else if (!hasPositive) {
          errors.classAmounts = 'At least one class amount is required.';
        } else {
          payload.class_amounts = activeClassAmounts;
        }
      }
    } else {
      // Editing Mode
      if (editingFeeType.assigned_to === 'For All') {
        if (!feeSchoolAmount) {
          errors.amount = 'Fee amount is required.';
        } else if (parseFloat(feeSchoolAmount) <= 0) {
          errors.amount = 'Amount must be greater than zero.';
        } else {
          payload.amount = parseFloat(feeSchoolAmount);
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFeeFormErrors(errors);
      return;
    }

    setFeeFormErrors({});
    setFeeSubmitting(true);
    setError('');
    setSuccess('');

    try {
      if (editingFeeType) {
        await schoolService.updateAdditionalFeeType(editingFeeType.id, payload);
        setSuccess('Additional fee updated successfully.');
      } else {
        const result = await schoolService.createAdditionalFeeType(payload);
        setSuccess(`Fee successfully applied to ${result.assigned_count} active students.`);
      }
      setIsApplyFeeModalOpen(false);
      setEditingFeeType(null);
      
      const typesList = await schoolService.getAdditionalFeeTypes();
      setFeeTypes(typesList || []);
      
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      if (err.message && err.message.toLowerCase().includes('already been applied')) {
        setError('This additional fee has already been applied to the selected students.');
      } else {
        setError(err.message || 'Failed to save additional fee.');
      }
    } finally {
      setFeeSubmitting(false);
    }
  };

  const handleExpensesScroll = (e) => {
    if (isFetchingMoreExpenses) return;
    const target = e.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      if (visibleExpensesCount < expenses.length) {
        setIsFetchingMoreExpenses(true);
        setTimeout(() => {
          setVisibleExpensesCount(prev => prev + 25);
          setIsFetchingMoreExpenses(false);
        }, 450);
      }
    }
  };

  const handleFeesScroll = (e) => {
    if (isFetchingMoreFees) return;
    const target = e.target;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 60) {
      if (visibleFeesCount < filteredFeeTypes.length) {
        setIsFetchingMoreFees(true);
        setTimeout(() => {
          setVisibleFeesCount(prev => prev + 25);
          setIsFetchingMoreFees(false);
        }, 450);
      }
    }
  };

  // Filter Fee Types List based on Description keyword match
  const filteredFeeTypes = feeTypes.filter(ft => {
    const term = feeSearch.toLowerCase().trim();
    if (!term) return true;
    
    const words = term.split(/\s+/);
    const feeName = (ft.name || '').toLowerCase();
    
    return words.every(word => feeName.includes(word));
  });

  const filteredTransportFees = transportFees.filter(tf => {
    const term = transportSearch.toLowerCase().trim();
    const matchesStatus = transportStatusFilter === 'All' || tf.status === transportStatusFilter;
    if (!term) return matchesStatus;

    const words = term.split(/\s+/);
    const stuName = (tf.student_name || '').toLowerCase();
    const admNo = (tf.admission_no || '').toLowerCase();

    const matchesSearch = words.every(word => stuName.includes(word) || admNo.includes(word));
    return matchesStatus && matchesSearch;
  });

  const paginatedExpenses = expenses.slice(0, visibleExpensesCount);
  const paginatedFees = filteredFeeTypes.slice(0, visibleFeesCount);

  // Compute dynamic monthly totals for expenses listing
  const filteredTotalExpensesAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 max-h-[82vh] md:max-h-[85vh] animate-in fade-in duration-300">
      
      {/* Page Header (Fixed) */}
      <div className="flex-shrink-0 bg-surface border border-border p-6 rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Finance Management</h2>
              <p className="text-text-secondary text-xs mt-1">Record daily school operational expenses and manage student non-tuition fees ledger payouts.</p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border mt-6">
          <button 
            onClick={() => { setActiveTab('expenses'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'expenses' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            💸 Expenses
          </button>
          <button 
            onClick={() => { setActiveTab('additional-fee'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'additional-fee' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            🏷️ Additional Fees
          </button>
          <button 
            onClick={() => { setActiveTab('transport-fee'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'transport-fee' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            🚌 Transport Fees
          </button>
          <button 
            onClick={() => { setActiveTab('late-payment-penalty'); setError(''); setSuccess(''); }}
            className={`pb-3 text-xs font-extrabold uppercase tracking-wider border-b-2 px-4 transition-all ${
              activeTab === 'late-payment-penalty' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            ⏱️ Late Payment Penalty
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold flex-shrink-0">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-semibold flex-shrink-0">
          {success}
        </div>
      )}

      {/* LOADING SPINNER */}
      {loading && (
        <div className="flex-1 flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Tab 1: Expenses View */}
      {!loading && activeTab === 'expenses' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          
          {/* Header row with search, month filter, and Add Expense button */}
          <div className="flex-shrink-0 bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="text-[10px] text-text-muted font-black uppercase tracking-wider">Total Expenses for Selected Month</span>
                <p className="text-xl font-black text-red-500 font-sans mt-0.5">{formatCurrency(filteredTotalExpensesAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <Input 
                  placeholder="Search by Description..." 
                  value={expenseSearch} 
                  onChange={e => setExpenseSearch(e.target.value)} 
                  className="text-xs"
                />
              </div>

              <div>
                <Select 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="text-xs cursor-pointer"
                >
                  <option value="ALL">All Months</option>
                  {ACADEMIC_MONTHS.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                </Select>
              </div>

              {!isReadOnly && (
                <div className="flex justify-end">
                  <Button 
                    className="w-full md:w-auto font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                    onClick={() => handleExpenseModalOpen(null)}
                  >
                    <Plus className="h-4 w-4" /> Add Expense
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Table Listing Area */}
          <div 
            ref={expensesContainerRef}
            onScroll={handleExpensesScroll}
            className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs relative"
          >
            {expenses.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-xs font-bold leading-relaxed">
                No expense entries logged.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border shadow-3xs">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Description</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Expense Date</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Amount</TableHead>
                      <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary bg-surface w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs font-semibold text-text-primary py-3.5 max-w-[300px] truncate">{e.description}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-text-secondary py-3.5 whitespace-nowrap">{formatDateFull(e.expense_date)}</TableCell>
                        <TableCell className="text-xs font-extrabold font-sans text-red-500 py-3.5">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-right py-3.5 relative">
                          <button 
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (activeExpenseDropdownId === e.id) {
                                setActiveExpenseDropdownId(null);
                                setDropdownCoords(null);
                              } else {
                                const rect = ev.currentTarget.getBoundingClientRect();
                                setDropdownCoords({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.right - 128 + window.scrollX,
                                });
                                setActiveExpenseDropdownId(e.id);
                              }
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-all"
                          >
                            <MoreVertical className="h-4 w-4 text-text-muted" />
                          </button>

                          {/* Dropdown Menu Overlay via Portal */}
                          {activeExpenseDropdownId === e.id && dropdownCoords && createPortal(
                            <div 
                              ref={dropdownRef}
                              style={{
                                position: 'absolute',
                                top: `${dropdownCoords.top}px`,
                                left: `${dropdownCoords.left}px`,
                              }}
                              className="w-32 bg-surface border border-border shadow-md rounded-xl py-1.5 z-[9999] text-left text-xs text-text-primary animate-in fade-in duration-100"
                            >
                              {isReadOnly || e.is_locked ? (
                                <div className="px-3 py-1.5 text-text-muted font-bold italic flex flex-col">
                                  <span className="text-[9px] uppercase tracking-wider text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Locked</span>
                                  {isReadOnly && <span className="text-[8px] text-text-muted mt-0.5">Archived Year</span>}
                                </div>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => handleExpenseModalOpen(e)}
                                    className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 font-semibold text-zinc-700"
                                  >
                                    <Edit className="h-3.5 w-3.5 text-text-muted" /> Edit
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteExpenseClick(e)}
                                    className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 font-semibold text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-400" /> Delete
                                  </button>
                                </>
                              )}
                            </div>,
                            document.body
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {isFetchingMoreExpenses && (
                  <div className="py-4 flex flex-col items-center justify-center gap-2 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Loading more expenses...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Additional Fee View */}
      {!loading && activeTab === 'additional-fee' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in duration-200">
          
          {/* Header Row consistent with Expenses */}
          <div className="flex-shrink-0 bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md w-full">
                <Input 
                  placeholder="Search by Fee Description..." 
                  value={feeSearch} 
                  onChange={e => setFeeSearch(e.target.value)} 
                  className="text-xs w-full"
                />
              </div>

              {!isReadOnly && (
                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 w-full sm:w-auto">
                  <Button 
                    className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                    onClick={handleApplyFeeModalOpen}
                  >
                    <Plus className="h-4 w-4" /> Additional Fee
                  </Button>
                  <Button 
                    className="w-full sm:w-auto font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                    onClick={handleAnnualFeeModalOpen}
                  >
                    <Plus className="h-4 w-4" /> Annual Fee
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Additional Fee Types definitions list Table */}
          <div 
            ref={feesContainerRef}
            onScroll={handleFeesScroll}
            className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs relative"
          >
            {filteredFeeTypes.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-xs font-bold leading-relaxed">
                No additional fees created.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border shadow-3xs">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Fee Description</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Class</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Due Date</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Amount</TableHead>
                      <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary bg-surface w-24">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFees.map((ft) => (
                      <TableRow key={ft.id}>
                        <TableCell className="font-extrabold text-text-primary text-xs uppercase tracking-wider py-3.5 max-w-[200px] truncate">{ft.name}</TableCell>
                        <TableCell className="text-xs text-text-secondary font-bold py-3.5 uppercase truncate max-w-[150px]">{ft.assigned_to}</TableCell>
                        <TableCell className="text-xs text-text-muted font-mono whitespace-nowrap py-3.5">{formatDateFull(ft.due_date)}</TableCell>
                        <TableCell className="text-xs text-text-primary font-bold font-sans py-3.5">{formatCurrency(ft.amount)}</TableCell>
                        <TableCell className="text-right py-3.5 relative whitespace-nowrap">
                          <button 
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (activeFeeDropdownId === ft.id) {
                                setActiveFeeDropdownId(null);
                                setDropdownCoords(null);
                              } else {
                                const rect = ev.currentTarget.getBoundingClientRect();
                                setDropdownCoords({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.right - 128 + window.scrollX,
                                });
                                setActiveFeeDropdownId(ft.id);
                              }
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-all"
                          >
                            <MoreVertical className="h-4 w-4 text-text-muted" />
                          </button>

                          {/* Dropdown Menu Overlay via Portal */}
                          {activeFeeDropdownId === ft.id && dropdownCoords && createPortal(
                            <div 
                              ref={dropdownRef}
                              style={{
                                position: 'absolute',
                                top: `${dropdownCoords.top}px`,
                                left: `${dropdownCoords.left}px`,
                              }}
                              className="w-32 bg-surface border border-border shadow-md rounded-xl py-1.5 z-[9999] text-left text-xs text-text-primary animate-in fade-in duration-100"
                            >
                              <button 
                                onClick={() => { setViewingFeeType(ft); setActiveFeeDropdownId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 font-semibold"
                              >
                                <Eye className="h-3.5 w-3.5 text-text-muted" /> View Details
                              </button>
                              
                              {ft.category !== 'System Generated' && !isReadOnly && (
                                <button 
                                  onClick={() => handleEditFeeTypeClick(ft)}
                                  className="w-full px-3 py-1.5 hover:bg-zinc-50 border-t border-border flex items-center gap-1.5 font-semibold text-zinc-700"
                                >
                                  <Edit className="h-3.5 w-3.5 text-text-muted" /> Edit
                                </button>
                              )}
                              
                              {ft.category !== 'System Generated' && !isReadOnly && (
                                <button 
                                  onClick={() => handleDeleteFeeTypeClick(ft)}
                                  className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 font-semibold text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" /> Delete
                                </button>
                              )}

                              {isReadOnly && (
                                <div className="px-3 py-1.5 text-text-muted font-bold italic border-t border-border flex flex-col">
                                  <span className="text-[9px] uppercase tracking-wider text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" /> Read Only</span>
                                  <span className="text-[8px] text-text-muted mt-0.5">Archived Year</span>
                                </div>
                              )}
                            </div>,
                            document.body
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {isFetchingMoreFees && (
                  <div className="py-4 flex flex-col items-center justify-center gap-2 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-wider">Loading more fees...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Transport Fees View */}
      {!loading && activeTab === 'transport-fee' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in duration-200">
          
          {/* Header Row */}
          <div className="flex-shrink-0 bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md w-full">
                <Input 
                  placeholder="Search by Student Name or Admission Number..." 
                  value={transportSearch} 
                  onChange={e => setTransportSearch(e.target.value)} 
                  className="text-xs w-full"
                />
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto">
                <Select
                  value={transportStatusFilter}
                  onChange={e => setTransportStatusFilter(e.target.value)}
                  className="text-xs w-full sm:w-40 cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active Only</option>
                  <option value="Inactive">Inactive Only</option>
                </Select>

                {!isReadOnly && (
                  <Button 
                    className="font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                    onClick={() => handleTransportModalOpen(null)}
                  >
                    <Plus className="h-4 w-4" /> Assign Transport Fee
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Transport Fees Listing Table */}
          <div 
            className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs relative"
          >
            {filteredTransportFees.length === 0 ? (
              <div className="p-12 text-center text-text-muted text-xs font-bold leading-relaxed">
                No transport fees configured.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border shadow-3xs">
                  <TableRow>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Student Name</TableHead>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">SR No</TableHead>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Class</TableHead>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Monthly Fee</TableHead>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Start Date</TableHead>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Status</TableHead>
                    <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Next Charge Amount</TableHead>
                    <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary bg-surface w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransportFees.map(tf => (
                    <TableRow key={tf.id} className="hover:bg-hover/30 transition-colors">
                      <TableCell className="text-xs font-bold text-text-primary">{tf.student_name}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{tf.sr_no || '—'}</TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {tf.class_name ? `${tf.class_name}${tf.class_section ? ` - ${tf.class_section}` : ''}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold font-sans text-text-primary">{formatCurrency(tf.monthly_fee)}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{formatDateFull(tf.start_date)}</TableCell>
                      <TableCell className="text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          tf.status === 'Active' 
                            ? 'bg-green-500/10 text-green-600' 
                            : 'bg-zinc-500/10 text-zinc-500'
                        }`}>
                          {tf.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-extrabold font-sans text-primary">
                        {tf.status === 'Active' ? formatCurrency(tf.next_charge) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <button 
                          onClick={(e) => handleTransportDropdownOpen(tf, e)}
                          className="p-1 hover:bg-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Late Payment Penalty View */}
      {!loading && activeTab === 'late-payment-penalty' && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in duration-200">
          
          {/* Sub Tab Navigation */}
          <div className="flex border-b border-border mb-2 bg-surface p-2 rounded-xl border">
            <button 
              onClick={() => setLppSubView('apply')}
              className={`pb-2 pt-2 text-[11px] font-black uppercase tracking-wider border-b-2 px-6 transition-all ${
                lppSubView === 'apply' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              ⚙️ Configure Penalty
            </button>
            <button 
              onClick={() => setLppSubView('history')}
              className={`pb-2 pt-2 text-[11px] font-black uppercase tracking-wider border-b-2 px-6 transition-all ${
                lppSubView === 'history' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              📚 Audit History Log
            </button>
          </div>

          {lppSubView === 'apply' ? (
            <div className="space-y-4 overflow-y-auto pr-1">
              
              {/* Dashboard Statistics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-surface border border-border shadow-3xs p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-secondary uppercase font-bold">Academic Session</span>
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-base font-black text-text-primary mt-2">{lppStats.current_academic_session}</div>
                </Card>
                <Card className="bg-surface border border-border shadow-3xs p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-secondary uppercase font-bold">Total Students</span>
                    <User className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="text-base font-black text-text-primary mt-2">{lppStats.total_students}</div>
                </Card>
                <Card className="bg-surface border border-border shadow-3xs p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-secondary uppercase font-bold">Students with Due</span>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-base font-black text-amber-600 mt-2">{lppStats.students_having_due}</div>
                </Card>
                <Card className="bg-surface border border-border shadow-3xs p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-secondary uppercase font-bold">Total Outstanding</span>
                    <Landmark className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-base font-black text-emerald-600 mt-2">{formatCurrency(lppStats.total_outstanding_due)}</div>
                </Card>
              </div>

              {lppStats.last_applied_date && (
                <div className="text-[10px] text-text-secondary bg-surface border p-3 rounded-xl flex items-center gap-1.5 shadow-3xs">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span>Late Payment Penalty was last successfully applied for this session on <strong>{formatDateFull(lppStats.last_applied_date)}</strong> by <strong>{lppStats.last_applied_by}</strong>.</span>
                </div>
              )}

              {/* Configuration Settings Input Form */}
              <Card className="bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
                <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">Late Payment Penalty For AY ({lppStats.current_academic_session})</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1">
                      Penalty Percentage (%) *
                      <Percent className="h-3 w-3 text-text-muted" />
                    </label>
                    <Input 
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="100"
                      placeholder="e.g. 5.50"
                      value={lppPercentage}
                      onChange={e => setLppPercentage(e.target.value)}
                      className="text-xs font-semibold"
                      required
                      disabled={lppApplying}
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Custom Description</label>
                    <Input 
                      placeholder={lppStats.current_academic_session ? `Late Payment Penalty ${lppStats.current_academic_session}` : "Late Payment Penalty 2026-2027"}
                      value={lppDescription}
                      onChange={e => setLppDescription(e.target.value)}
                      className="text-xs font-semibold"
                      disabled={lppApplying}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Target Academic Session</label>
                    <Input 
                      value={lppStats.current_academic_session}
                      className="text-xs font-semibold bg-hover/10"
                      disabled
                    />
                  </div>
                </div>
              </Card>

              {/* Warning/Info Box */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl text-xs flex gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
                <div className="space-y-1">
                  <p className="font-extrabold uppercase tracking-wider">Late Payment Penalty Information</p>
                  <p className="leading-relaxed">If you configure a Late Payment Penalty, it will be added automatically after the Academic Year Migration is completed. Only students who have pending dues will receive the penalty. Students who have no pending dues will not be affected. You can change or remove this configuration anytime before migration.</p>
                </div>
              </div>

              {/* Student Document Restriction Configuration Form */}
              <Card className="bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">Student Document Restriction</h3>
                  <p className="text-xs text-text-secondary font-medium">Control access to student documents based on outstanding fee amount.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-hover/10 rounded-xl border border-border max-w-2xl">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-primary uppercase cursor-pointer" htmlFor="enable-due-restriction-toggle">
                        Enable Due Amount Restriction
                      </label>
                      <p className="text-[10px] text-text-secondary leading-relaxed">Toggle to block access to selected student documents when dues exceed the allowed limit.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        id="enable-due-restriction-toggle"
                        type="checkbox" 
                        checked={enableDueRestriction}
                        onChange={e => setEnableDueRestriction(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-border rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {enableDueRestriction && (
                    <div className="space-y-4 max-w-2xl animate-in slide-in-from-top-2 duration-150">
                      <div className="space-y-1.5 max-w-md">
                        <label className="text-xs font-bold text-text-secondary uppercase">Maximum Allowed Due Amount (₹) *</label>
                        <Input 
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 1000"
                          value={maxAllowedDue}
                          onChange={e => setMaxAllowedDue(e.target.value)}
                          className="text-xs font-semibold"
                          required
                        />
                        <p className="text-[10px] text-text-muted">Students whose outstanding dues are greater than this amount will not be able to access the selected documents.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase block">Restriction Applies To</label>
                        <div className="flex flex-wrap gap-6 items-center">
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={restrictAdmitCard}
                              onChange={e => setRestrictAdmitCard(e.target.checked)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                            />
                            Admit Card
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={restrictExamResult}
                              onChange={e => setRestrictExamResult(e.target.checked)}
                              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                            />
                            Exam Result
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Informational Message box */}
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl text-xs flex gap-3 max-w-2xl">
                    <Info className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-extrabold uppercase tracking-wider">How this works</p>
                      <p className="leading-relaxed">If a student's outstanding fee is greater than the amount you enter above, they will not be able to view their Admit Card or Exam Result in the mobile application.</p>
                      <p className="leading-relaxed font-semibold">Once the pending amount is paid and comes within the allowed limit, access will be restored automatically.</p>
                      <p className="leading-relaxed text-amber-500 font-medium">This restriction does not apply to the Scheme section.</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Action Buttons Panel */}
              <div className="flex gap-4">
                {!isLppConfigSaved ? (
                  <Button 
                    onClick={handleSaveAllFinanceConfig} 
                    disabled={isReadOnly || lppApplying || !lppPercentage}
                    className="font-bold uppercase tracking-wider text-xs px-6 py-2.5 bg-primary hover:bg-primary/95 text-white shadow-2xs"
                  >
                    {lppApplying ? 'Saving...' : 'Save Configuration'}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setIsLppRemoveConfirmOpen(true)}
                    disabled={isReadOnly || lppApplying}
                    className="font-bold uppercase tracking-wider text-xs px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white shadow-2xs"
                  >
                    Remove Configuration
                  </Button>
                )}
                <Button 
                  onClick={handleLppReset}
                  variant="secondary"
                  className="font-bold uppercase tracking-wider text-xs px-6 py-2.5 ml-auto"
                >
                  Reset Form
                </Button>
              </div>
            </div>
          ) : (
            /* Audit History Log Sub View */
            <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in duration-200">
              
              {/* History Search Filters */}
              <div className="flex-shrink-0 bg-surface border border-border p-5 rounded-2xl shadow-2xs space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div>
                    <Input 
                      placeholder="Search by Student Name..."
                      value={lppHistoryFilters.student_name}
                      onChange={e => handleLppHistoryFilterChange('student_name', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Input 
                      placeholder="Admission Number..."
                      value={lppHistoryFilters.admission_no}
                      onChange={e => handleLppHistoryFilterChange('admission_no', e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Select
                      value={lppHistoryFilters.class_name}
                      onChange={e => handleLppHistoryFilterChange('class_name', e.target.value)}
                      className="text-xs cursor-pointer"
                    >
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={loadLppHistory} className="flex-1 font-bold uppercase tracking-wider text-xs">
                      <Search className="h-4 w-4 mr-1.5" /> Search
                    </Button>
                    <Button 
                      onClick={() => {
                        setLppHistoryFilters({
                          academic_year_id: '',
                          class_name: '',
                          section_name: '',
                          student_name: '',
                          admission_no: '',
                          date: '',
                          applied_by_name: ''
                        });
                        loadLppHistory();
                      }} 
                      variant="secondary"
                      className="font-bold uppercase tracking-wider text-xs"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>

              {/* History Log Toolbar */}
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Audit Records: {lppHistory.length} entries found</span>
                <div className="flex items-center gap-2">
                  <Button onClick={() => exportLppHistoryCSV()} variant="secondary" className="text-xs flex items-center gap-1.5 py-1">
                    <FileDown className="h-3.5 w-3.5" /> CSV
                  </Button>
                  <Button onClick={() => exportLppHistoryExcel()} variant="secondary" className="text-xs flex items-center gap-1.5 py-1">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button onClick={() => exportLppHistoryPDF()} variant="secondary" className="text-xs flex items-center gap-1.5 py-1">
                    <FileText className="h-3.5 w-3.5" /> PDF Report
                  </Button>
                </div>
              </div>

              {/* History Table */}
              <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-2xl bg-surface shadow-2xs relative">
                {lppHistoryLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : lppHistory.length === 0 ? (
                  <div className="p-12 text-center text-text-muted text-xs font-bold">
                    No history log entries found matching criteria.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-surface z-10 border-b border-border shadow-3xs">
                      <TableRow>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Student Name</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Admission No</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Class</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Outstanding Due</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Penalty %</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Penalty Amount</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Description</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Applied By</TableHead>
                        <TableHead className="text-xs uppercase font-extrabold text-text-secondary bg-surface">Applied Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lppHistory.map(row => (
                        <TableRow key={row.id} className="hover:bg-hover/30 transition-colors">
                          <TableCell className="text-xs font-bold text-text-primary">{row.student_name}</TableCell>
                          <TableCell className="text-xs text-text-secondary">{row.admission_no || '—'}</TableCell>
                          <TableCell className="text-xs text-text-secondary">
                            {row.class_name ? `${row.class_name}${row.section_name ? ` - ${row.section_name}` : ''}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs font-semibold font-sans text-text-primary">{formatCurrency(row.outstanding_due)}</TableCell>
                          <TableCell className="text-xs text-text-secondary font-sans font-bold">{row.penalty_percentage}%</TableCell>
                          <TableCell className="text-xs font-black font-sans text-primary">{formatCurrency(row.penalty_amount)}</TableCell>
                          <TableCell className="text-xs text-text-secondary">{row.description}</TableCell>
                          <TableCell className="text-xs text-text-secondary font-semibold">{row.applied_by_name}</TableCell>
                          <TableCell className="text-xs text-text-secondary">{formatDateFull(row.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* Record/Edit Expense Dialog */}
      <Dialog 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)}
        title={editingExpense ? "Edit Expense Entry" : "Record Expense"}
        description={editingExpense ? "Modify recorded transaction details." : "Log operational business payments."}
        footer={<>
          <Button variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveExpense} disabled={expenseSubmitting}>{expenseSubmitting ? 'Saving...' : 'Save Entry'}</Button>
        </>}
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase">Description *</label>
            <Input 
              placeholder="e.g. Electricity bill June" 
              value={expenseDesc} 
              onChange={e => setExpenseDesc(e.target.value)} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Amount (₹) *</label>
              <Input 
                type="number" 
                placeholder="Rupees" 
                value={expenseAmount} 
                onChange={e => setExpenseAmount(e.target.value)} 
                required 
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase">Expense Date *</label>
              <Input 
                type="date" 
                value={expenseDate} 
                onChange={e => setExpenseDate(e.target.value)} 
                max={getLocalDateString()}
                required 
              />
            </div>
          </div>
        </form>
      </Dialog>

      {/* Delete Expense Confirmation */}
      <Dialog
        isOpen={deletingExpenseId !== null}
        onClose={() => setDeletingExpenseId(null)}
        title="Delete Expense Transaction"
        description="Verify transaction voucher reversal."
        footer={<>
          <Button variant="secondary" onClick={() => setDeletingExpenseId(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteExpense}>Delete</Button>
        </>}
      >
        <div className="text-xs text-text-secondary leading-relaxed py-2">
          Delete this expense? <br/>
          <strong className="text-red-500 font-extrabold">This action cannot be undone.</strong>
        </div>
      </Dialog>

      {/* Delete Additional Fee Confirmation */}
      <Dialog
        isOpen={deletingFeeTypeId !== null}
        onClose={() => setDeletingFeeTypeId(null)}
        title="Delete Additional Fee"
        description="Verify fee definition reversal."
        footer={<>
          <Button variant="secondary" onClick={() => setDeletingFeeTypeId(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteFeeType}>Delete</Button>
        </>}
      >
        <div className="text-xs text-text-secondary leading-relaxed py-2">
          Delete this additional fee definition and all assigned student pending payments? <br/>
          <strong className="text-red-500 font-extrabold">This action cannot be undone.</strong>
        </div>
      </Dialog>

      {/* Apply / Edit Additional Fee Modal */}
      <Dialog
        isOpen={isApplyFeeModalOpen}
        onClose={() => setIsApplyFeeModalOpen(false)}
        title={editingFeeType ? "Edit Additional Fee" : "Apply Additional Fee"}
        description={editingFeeType ? "Modify additional fee definition details." : "Assign custom school fees to specific classes or whole school."}
        footer={<>
          <Button variant="secondary" onClick={() => setIsApplyFeeModalOpen(false)}>Cancel</Button>
          <Button onClick={handleApplyAdditionalFee} disabled={feeSubmitting}>{feeSubmitting ? 'Saving...' : (editingFeeType ? 'Save' : 'Apply Fee')}</Button>
        </>}
        className="w-[95vw] md:max-w-xl"
      >
        <form onSubmit={handleApplyAdditionalFee} noValidate className="space-y-4 text-xs">
          
          {/* Apply Fee To Selection (Hide when editing) */}
          {!editingFeeType && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Apply Fee To</label>
              <div className="flex items-center gap-6 mt-1">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input 
                    type="radio" 
                    name="applyFeeType" 
                    value="school" 
                    checked={applyType === 'school'} 
                    onChange={() => setApplyType('school')}
                    className="cursor-pointer"
                  />
                  Entire School
                </label>
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input 
                    type="radio" 
                    name="applyFeeType" 
                    value="classes" 
                    checked={applyType === 'classes'} 
                    onChange={() => setApplyType('classes')}
                    className="cursor-pointer"
                  />
                  Selected Classes
                </label>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Fee Description *</label>
            <Input 
              placeholder="e.g. Annual Sports Fee" 
              value={feeDescription} 
              onChange={e => setFeeDescription(e.target.value)} 
              className="text-xs"
            />
            {feeFormErrors.description && (
              <p className="text-[10px] text-red-500 font-bold mt-1">{feeFormErrors.description}</p>
            )}
          </div>

          {/* Case 1: Entire School Amount */}
          {applyType === 'school' && (
            <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Amount (₹) *</label>
              <Input 
                type="number" 
                placeholder="e.g. 500" 
                value={feeSchoolAmount} 
                onChange={e => setFeeSchoolAmount(e.target.value)} 
                disabled={editingFeeType && editingFeeType.collected_students > 0}
                className="text-xs"
              />
              {feeFormErrors.amount && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{feeFormErrors.amount}</p>
              )}
              {editingFeeType && editingFeeType.collected_students > 0 && (
                <p className="text-[9px] text-amber-600 mt-1 font-semibold leading-none">
                  Amount cannot be changed as some students have already paid.
                </p>
              )}
            </div>
          )}

          {/* Case 2: Selected Classes Table amount mapping (Hide when editing) */}
          {!editingFeeType && applyType === 'classes' && (
            <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Class Dues Allocation</label>
              <div className="border border-border rounded-xl overflow-hidden max-h-[220px] overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50">
                <Table>
                  <TableHeader className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black py-2 bg-zinc-50 dark:bg-zinc-900">Class</TableHead>
                      <TableHead className="text-[10px] uppercase font-black py-2 bg-zinc-50 dark:bg-zinc-900 w-32">Amount (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="py-2 font-bold text-xs">{c.name}</TableCell>
                        <TableCell className="py-1">
                          <Input 
                            type="number" 
                            placeholder="Blank if none" 
                            value={classAmountsMap[c.id] || ''} 
                            onChange={e => setClassAmountsMap(prev => ({ ...prev, [c.id]: e.target.value }))}
                            className="h-7 text-xs w-full"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {feeFormErrors.classAmounts && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{feeFormErrors.classAmounts}</p>
              )}
            </div>
          )}

          {/* Edit Class Amounts Message */}
          {editingFeeType && applyType === 'classes' && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-xl text-text-secondary text-[11px] font-semibold leading-relaxed">
              ℹ️ Class amounts cannot be modified during edit. Please delete and recreate the additional fee if you need to reconfigure class allocation dues.
            </div>
          )}

          {/* Due Date (Manual Input Disabled) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Due Date *</label>
            <Input 
              type="date" 
              value={feeDueDate} 
              onChange={e => setFeeDueDate(e.target.value)} 
              onKeyDown={e => e.preventDefault()}
              className="text-xs"
            />
            {feeFormErrors.dueDate && (
              <p className="text-[10px] text-red-500 font-bold mt-1">{feeFormErrors.dueDate}</p>
            )}
            <p className="text-[9px] text-text-muted mt-1 font-semibold leading-relaxed">
              The selected Due Date determines when this fee becomes payable. Students will not see this fee as due until the selected date is reached.
            </p>
          </div>

        </form>
      </Dialog>

      {/* Additional Fee Summary Dialog View Popup */}
      <Dialog
        isOpen={viewingFeeType !== null}
        onClose={() => setViewingFeeType(null)}
        title="Additional Fee Summary"
        description="Statistical overview of non-tuition operational dues collected."
        footer={<Button onClick={() => setViewingFeeType(null)}>Dismiss</Button>}
      >
        {viewingFeeType && (
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] text-text-muted font-black uppercase tracking-wider">Fee Description</span>
                <p className="text-sm font-black text-text-primary mt-0.5 uppercase">{viewingFeeType.name}</p>
              </div>
              <span className="inline-flex px-3 py-1 bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50 border border-border font-black text-[10px] uppercase rounded-full tracking-wider">
                {viewingFeeType.assigned_to}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">Due Date</p>
                <p className="font-bold mt-0.5 text-text-primary">{formatDateFull(viewingFeeType.due_date)}</p>
              </div>
              {(!viewingFeeType.class_amounts || viewingFeeType.class_amounts.length <= 1) && (
                <div>
                  <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">Fee Amount</p>
                  <p className="font-bold mt-0.5 text-primary font-sans">{formatCurrency(viewingFeeType.amount)}</p>
                </div>
              )}
            </div>

            {viewingFeeType.class_amounts && viewingFeeType.class_amounts.length > 0 && (
              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-[10px] text-text-muted font-black uppercase tracking-wider">Class-Wise Fee Configuration</p>
                <div className="space-y-1.5 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 rounded-xl border border-border">
                  {(() => {
                    const groups = {};
                    viewingFeeType.class_amounts.forEach(item => {
                      const amtKey = item.amount.toFixed(2);
                      if (!groups[amtKey]) {
                        groups[amtKey] = [];
                      }
                      groups[amtKey].push(item.class_name);
                    });
                    return Object.entries(groups).map(([amt, classes], idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0 text-text-primary">
                        <span className="font-bold pr-4 truncate">{classes.join(', ')}</span>
                        <span className="font-black text-primary font-sans shrink-0">{formatCurrency(parseFloat(amt))}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-[10px] text-text-muted font-black uppercase tracking-wider">Fee Collection Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border">
                <div>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Total Amount</p>
                  <p className="text-sm font-black text-text-primary mt-0.5 font-sans">{formatCurrency(viewingFeeType.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Collected Amount</p>
                  <p className="text-sm font-black text-green-600 mt-0.5 font-sans">{formatCurrency(viewingFeeType.collected_amount)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted font-bold uppercase tracking-wider">Pending Amount</p>
                  <p className="text-sm font-black text-red-500 mt-0.5 font-sans">{formatCurrency(viewingFeeType.pending_amount)}</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </Dialog>

      {/* Assign / Edit Transport Fee Dialog Modal */}
      {isTransportModalOpen && (
        <Dialog
          isOpen={isTransportModalOpen}
          title={editingTransport ? 'Edit Transport Fee Details' : 'Assign Transport Fee'}
          onClose={() => setIsTransportModalOpen(false)}
        >
          <form onSubmit={handleSaveTransport} className="space-y-4 text-xs font-medium text-text-secondary max-w-md">
            
            {/* Student Search Picker */}
            <div className="space-y-1.5 relative" ref={studentSearchRef}>
              <label className="text-[10px] text-text-secondary font-bold uppercase font-black tracking-wider">Student *</label>
              {!selectedStudent ? (
                <>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                    <Input
                      type="text"
                      placeholder="Search student by name, roll no, or SR no..."
                      value={studentSearchVal}
                      onChange={e => {
                        setStudentSearchVal(e.target.value);
                        setShowStudentDropdown(true);
                        setSelectedStudent(null);
                      }}
                      onFocus={() => setShowStudentDropdown(true)}
                      className="pl-8 text-xs font-semibold text-text-primary border border-border bg-surface rounded-lg w-full focus:outline-hidden"
                    />
                  </div>
                  {showStudentDropdown && studentSearchVal.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface border border-border rounded-xl shadow-lg z-50">
                      {studentsList
                        .filter(s => 
                          (s.name && s.name.toLowerCase().includes(studentSearchVal.toLowerCase())) || 
                          (s.sr_no && s.sr_no.toLowerCase().includes(studentSearchVal.toLowerCase())) ||
                          (s.roll_no && s.roll_no.toString().toLowerCase().includes(studentSearchVal.toLowerCase()))
                        )
                        .slice(0, 10)
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedStudent(s);
                              setStudentSearchVal(s.name);
                              setShowStudentDropdown(false);
                            }}
                            className="p-2.5 hover:bg-hover cursor-pointer transition-colors text-left flex items-center justify-between border-b last:border-0 border-border"
                          >
                            <div>
                              <div className="font-bold text-text-primary text-xs">{s.name}</div>
                              <div className="text-[10px] text-text-muted mt-0.5">Class: {s.class_name} | Roll No: {s.roll_no || '—'} | SR No: {s.sr_no || '—'}</div>
                            </div>
                            <ChevronDown className="h-3 w-3 text-text-muted -rotate-90" />
                          </div>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 bg-zinc-50 border border-border rounded-lg font-bold text-text-primary flex justify-between items-center">
                  <span>{selectedStudent.name} (Class: {selectedStudent.class_name} | Roll No: {selectedStudent.roll_no || '—'} | SR No: {selectedStudent.sr_no || '—'})</span>
                  {!editingTransport && (
                    <button 
                      type="button" 
                      onClick={() => { setSelectedStudent(null); setStudentSearchVal(''); }}
                      className="text-text-muted hover:text-red-500 font-extrabold text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              {transportFormErrors.student && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{transportFormErrors.student}</p>
              )}
            </div>

            {/* Monthly Transport Fee amount */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase font-black tracking-wider">Monthly Transport Fee (₹) *</label>
              <Input
                type="number"
                placeholder="e.g. 1000"
                value={transportMonthlyFee}
                onChange={e => setTransportMonthlyFee(e.target.value)}
                className="text-xs"
              />
              {transportFormErrors.monthly_fee && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{transportFormErrors.monthly_fee}</p>
              )}
            </div>

            {/* Transport Start Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase font-black tracking-wider">Transport Start Date *</label>
              <Input
                type="date"
                value={transportStartDate}
                onChange={e => setTransportStartDate(e.target.value)}
                className="text-xs"
              />
              {transportFormErrors.start_date && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{transportFormErrors.start_date}</p>
              )}
            </div>

            {/* Status selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-text-secondary font-bold uppercase font-black tracking-wider">Status *</label>
              <Select
                value={transportStatus}
                onChange={e => setTransportStatus(e.target.value)}
                className="text-xs cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {/* Form Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsTransportModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={transportSubmitting}>
                {transportSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Delete Transport Confirmation Dialog */}
      {deletingTransportId && (
        <Dialog
          isOpen={!!deletingTransportId}
          onClose={() => setDeletingTransportId(null)}
          title="Delete Transport Fee Assignment"
          description="Verify transport fee assignment removal."
          footer={<>
            <Button variant="secondary" onClick={() => setDeletingTransportId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTransport}>Delete</Button>
          </>}
        >
          <div className="text-xs text-text-secondary leading-relaxed py-2">
            Are you sure you want to delete this transport fee assignment? <br/>
            <strong className="text-red-500 font-extrabold">This action cannot be undone.</strong>
            <p className="text-[10px] text-text-muted mt-2">
              Note: Deletion will fail if a billing invoice has already been generated.
            </p>
          </div>
        </Dialog>
      )}

      {/* View Transport Details Dialog */}
      <Dialog
        isOpen={viewingTransportDetails !== null}
        onClose={() => setViewingTransportDetails(null)}
        title="Transport Fee Details"
        description="View student transport configuration and billing status."
        footer={
          <Button variant="secondary" onClick={() => setViewingTransportDetails(null)}>Close</Button>
        }
      >
        {viewingTransportDetails && (
          <div className="grid grid-cols-2 gap-4 py-3 text-xs leading-relaxed">
            <div className="flex flex-col gap-1">
              <span className="text-text-muted font-medium">Student Name</span>
              <span className="text-text-primary font-bold">{viewingTransportDetails.student_name}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-muted font-medium">SR No.</span>
              <span className="text-text-primary font-bold">{viewingTransportDetails.sr_no || '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-muted font-medium">Class</span>
              <span className="text-text-primary font-bold">
                {viewingTransportDetails.class_name ? `${viewingTransportDetails.class_name}${viewingTransportDetails.class_section ? ` - ${viewingTransportDetails.class_section}` : ''}` : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-muted font-medium">Monthly Transport Fee</span>
              <span className="text-text-primary font-bold">₹{viewingTransportDetails.monthly_fee}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-muted font-medium">Transport Start Date</span>
              <span className="text-text-primary font-bold">{formatDateFull(viewingTransportDetails.start_date)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-text-muted font-medium">Status</span>
              <span className="text-text-primary font-bold">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${viewingTransportDetails.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                  {viewingTransportDetails.status}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-1 col-span-2 border-t border-border pt-3 mt-1">
              <span className="text-text-muted font-medium">Next Charge Amount</span>
              <span className="text-primary font-extrabold text-sm">₹{viewingTransportDetails.next_charge}</span>
            </div>
          </div>
        )}
      </Dialog>

      {/* Transport Row Three-Dot Portal Menu */}
      {activeTransportDropdownId && dropdownCoords && (
        (() => {
          const tf = transportFees.find(t => t.id === activeTransportDropdownId);
          if (!tf) return null;
          return createPortal(
            <div 
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: `${dropdownCoords.top}px`,
                left: `${dropdownCoords.left}px`,
              }}
              className="w-36 bg-surface border border-border shadow-md rounded-xl py-1.5 z-[9999] text-left text-xs text-text-primary animate-in fade-in duration-100 font-semibold"
            >
              <button
                onClick={() => {
                  setActiveTransportDropdownId(null);
                  setViewingTransportDetails(tf);
                }}
                className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5"
              >
                <Eye className="h-3.5 w-3.5 text-text-muted" /> View Details
              </button>

              {!isReadOnly && (
                <>
                  <button
                    onClick={() => {
                      setEditingTransport(tf);
                      setSelectedStudent({ id: tf.student_id, name: tf.student_name });
                      setStudentSearchVal(tf.student_name);
                      setTransportMonthlyFee(tf.monthly_fee.toString());
                      setTransportStartDate(tf.start_date);
                      setTransportStatus(tf.status);
                      setIsTransportModalOpen(true);
                      setActiveTransportDropdownId(null);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-zinc-50 border-t border-border flex items-center gap-1.5"
                  >
                    <Edit className="h-3.5 w-3.5 text-text-muted" /> Edit Config
                  </button>

                  <button
                    onClick={() => {
                      handleToggleTransportStatus(tf);
                      setActiveTransportDropdownId(null);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-text-muted" /> Mark {tf.status === 'Active' ? 'Inactive' : 'Active'}
                  </button>

                  <button
                    onClick={() => {
                      setDeletingTransportId(tf.id);
                      setActiveTransportDropdownId(null);
                    }}
                    className="w-full px-3 py-1.5 hover:bg-zinc-50 flex items-center gap-1.5 text-red-600 border-t border-border"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" /> Delete
                  </button>
                </>
              )}
            </div>,
            document.body
          );
        })()
      )}

      {/* Late Payment Penalty Remove Configuration Confirmation Dialog */}
      <Dialog
        isOpen={isLppRemoveConfirmOpen}
        onClose={() => setIsLppRemoveConfirmOpen(false)}
        title="Remove Penalty Configuration?"
        description="This will remove the Late Payment Penalty configuration. No penalty will be applied during Academic Year Migration unless you configure it again."
        footer={<>
          <Button variant="secondary" onClick={() => setIsLppRemoveConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleRemoveLppConfig} className="bg-red-600 hover:bg-red-700 text-white font-bold">Remove Configuration</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl text-xs">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="font-extrabold uppercase tracking-wider">Confirm Removal</p>
              <p className="mt-1 leading-relaxed">
                Are you sure you want to completely remove this configuration? Academic Year Migration will skip generating any late payment penalty once this is done.
              </p>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Annual Fee Configuration Dialog Popup */}
      <Dialog
        isOpen={isAnnualFeeModalOpen}
        onClose={() => setIsAnnualFeeModalOpen(false)}
        title="Create Annual Fee"
        description="Configure annual fee allocation for eligible students across the school or class-wise."
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" type="button" onClick={() => setIsAnnualFeeModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handleAnnualFeeInitialSubmit}
              disabled={annualFeeSubmitting}
            >
              Create Fee
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Information Message Box */}
          <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-1 text-xs">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
              <Info className="h-4 w-4 shrink-0" />
              <span>Important</span>
            </div>
            <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed pl-6">
              Annual Fee will <strong>not</strong> be applied to students who were admitted during the current academic year.
            </p>
            <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed pl-6">
              Only students who were already enrolled before the beginning of the current academic session are eligible.
            </p>
          </div>

          {/* Apply To Radio Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Apply To</label>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                <input
                  type="radio"
                  name="annualFeeApplyType"
                  value="school"
                  checked={annualFeeApplyType === 'school'}
                  onChange={() => setAnnualFeeApplyType('school')}
                  className="accent-primary h-4 w-4"
                />
                Entire School
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer">
                <input
                  type="radio"
                  name="annualFeeApplyType"
                  value="classes"
                  checked={annualFeeApplyType === 'classes'}
                  onChange={() => setAnnualFeeApplyType('classes')}
                  className="accent-primary h-4 w-4"
                />
                Class Wise
              </label>
            </div>
          </div>

          {/* If Entire School Selected */}
          {annualFeeApplyType === 'school' ? (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Annual Fee Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-text-muted">₹</span>
                <Input
                  type="number"
                  placeholder="1000"
                  value={annualFeeAmount}
                  onChange={e => setAnnualFeeAmount(e.target.value)}
                  min="0"
                  step="any"
                  className="pl-7 text-xs"
                />
              </div>
              {annualFeeFormErrors.amount && (
                <p className="text-[10px] text-red-500 font-bold mt-1">{annualFeeFormErrors.amount}</p>
              )}
            </div>
          ) : (
            /* If Class Wise Selected */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider">Class-Wise Fee Allocation *</label>
                {annualFeeFormErrors.classes && (
                  <p className="text-[10px] text-red-500 font-bold">{annualFeeFormErrors.classes}</p>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto border border-border rounded-xl">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold text-[10px] uppercase">Class</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-right">Annual Fee (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map(cls => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">
                          {cls.name} {cls.section ? `- ${cls.section}` : ''}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            placeholder="0"
                            value={annualFeeClassAmountsMap[cls.id] || ''}
                            onChange={e => setAnnualFeeClassAmountsMap({
                              ...annualFeeClassAmountsMap,
                              [cls.id]: e.target.value
                            })}
                            min="0"
                            step="any"
                            className="h-8 w-28 ml-auto text-right text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      {/* Confirmation Dialog Before Creation */}
      <Dialog
        isOpen={isAnnualFeeConfirmOpen}
        onClose={() => setIsAnnualFeeConfirmOpen(false)}
        title="Create Annual Fee"
        description="Please confirm annual fee creation for eligible students."
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" onClick={() => setIsAnnualFeeConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveAnnualFee} 
              disabled={annualFeeSubmitting}
            >
              {annualFeeSubmitting ? 'Creating...' : 'Create Fee'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
          <p>This annual fee will be applied only to eligible students.</p>
          <p>Students admitted during the current academic session will automatically be excluded.</p>
          <p className="font-bold text-text-primary">Do you want to continue?</p>
        </div>
      </Dialog>

    </div>
  );
}
