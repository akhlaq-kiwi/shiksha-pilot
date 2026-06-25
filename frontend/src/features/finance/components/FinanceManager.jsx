import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  UserCheck,
  FileText,
  CreditCard,
  ArrowLeft,
  Printer,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  X,
  Check,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Briefcase,
  MoreVertical
} from 'lucide-react';

export default function FinanceManager({
  activeTab,
  role,
  token,
  isConnected,
  schoolId,
  activeYearId,
  username,
  showToast,
  
  // Roster / Fees data & states
  classes = [],
  visibleClasses = [],
  students = [],
  selectedFeesClassId,
  setSelectedFeesClassId,
  setSelectedStudent,
  setLedgerBackSource,
  setActiveTab,
  isFetchingMoreFeesStudents,
  fetchStudentFeesRecords,

  // Financial Reports data & states
  financialSubTab,
  setFinancialSubTab,
  financialReports = [],
  reportFromDate,
  setReportFromDate,
  reportToDate,
  setReportToDate,
  reportPreview,
  setReportPreview,
  isReportPreviewing,
  isGeneratingReport,
  exportingReportId,
  settlingReportId,
  showGenerateConfirm,
  setShowGenerateConfirm,
  exportFinancialReport,
  toggleReportSettlement,
  previewFinancialReport,
  generateFinancialReport,
  
  // School Expenses
  expenses = [],
  isFetchingExpenses,
  fetchExpenses,
  expenseDesc,
  setExpenseDesc,
  expenseAmount,
  setExpenseAmount,
  addSchoolExpense,
  
  // Extra Fees Config
  extraFeeTypes = [],
  isFetchingExtraFeeTypes,
  fetchExtraFeeTypes,
  newTypeName,
  setNewTypeName,
  newTypeAmount,
  setNewTypeAmount,
  addExtraFeeType,
  editingExtraFeeType,
  setEditingExtraFeeType,
  editExtraFeeTypeName,
  setEditExtraFeeTypeName,
  editExtraFeeTypeAmount,
  setEditExtraFeeTypeAmount,
  editExtraFeeType,
  
  // Student Extra Fees Registry
  studentExtraFees = [],
  isFetchingStudentExtraFees,
  fetchStudentExtraFees,
  extraFeeSearch,
  setExtraFeeSearch,
  extraFeeStatusFilter,
  setExtraFeeStatusFilter,
  extraFeeClassFilter,
  setExtraFeeClassFilter,
  extraFeeTypeFilter,
  setExtraFeeTypeFilter,
  visibleAdditionalFeeStudentsCount,
  setVisibleAdditionalFeeStudentsCount,
  isFetchingMoreAdditionalFeeStudents,
  payExtraStudentFee,
  revertExtraStudentFee,

  // Finance Management / Subtabs
  financeManagementSubTab,
  setFinanceManagementSubTab,
  classFees,
  monthlySalaries,
  paymentPromises = [],
  previousDues = [],
  previousYearRecoveries = [],
  fetchPreviousDues,
  fetchPreviousYearRecoveries,
  isFetchingPreviousDues,
  isFetchingCarryForwardDues,
  selectedCarryForwardDue,
  setSelectedCarryForwardDue,
  showPayRecoveryModal,
  setShowPayRecoveryModal,
  showRecoveryReceiptModal,
  setShowRecoveryReceiptModal,
  selectedRecoveryReceiptDue,
  setSelectedRecoveryReceiptDue,
  selectedRecoveryReceiptRec,
  setSelectedRecoveryReceiptRec,
  recoveryAmount,
  setRecoveryAmount,
  recoveryDate,
  setRecoveryDate,
  isRecordingRecovery,
  recoverySearchQuery,
  setRecoverySearchQuery,
  recoveryYearFilter,
  setRecoveryYearFilter,
  isSavingPromise,
  promiseSearch,
  setPromiseSearch,
  promiseClassFilter,
  setPromiseClassFilter,
  promiseModalOpen,
  setPromiseModalOpen,
  editingPromise,
  setEditingPromise,
  promiseStudentId,
  setPromiseStudentId,
  promiseDate,
  setPromiseDate,
  promiseDescription,
  setPromiseDescription,
  promiseStatus,
  setPromiseStatus,
  promiseStudentSearchQuery,
  setPromiseStudentSearchQuery,
  activePromiseMenuId,
  setActivePromiseMenuId,
  
  // Finance Functions
  fetchClassFeeStructure,
  saveClassFeeStructure,
  fetchMonthlySalaries,
  payTeacherSalary,
  fetchPaymentPromises,
  addPaymentPromise,
  editPaymentPromise,
  deletePaymentPromise,
  payCarryForwardDue,
  revertCarryForwardDueRecovery,
  years = []
}) {
  return (
    <>
      {activeTab === 'fees' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {selectedFeesClassId === null ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.15rem' }}>Select Classroom to View Rosters</h3>
                          </div>
        
                          {visibleClasses.length === 0 ? (
                            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', marginTop: '24px' }}>
                              <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🏫</div>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                {role === 'Teacher' ? 'No Class Assigned' : 'No Classes Created Yet'}
                              </h4>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '360px', marginBottom: '0', lineHeight: '1.5' }}>
                                {role === 'Teacher' 
                                  ? 'You are not assigned as a Class Teacher to any class. Please contact the administrator.'
                                  : 'Create a classroom first to start managing outstanding student fees.'}
                              </p>
                            </div>
                          ) : (
                            <div className="class-grid">
                              {visibleClasses.map(cls => (
                                <div 
                                  key={cls.id} 
                                  className="class-card"
                                  onClick={() => setSelectedFeesClassId(cls.id)}
                                >
                                  <h4 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>{cls.name}</h4>
                                  <span className="badge badge-primary">
                                    {students.filter(s => s.class_id === cls.id).length} Students
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="sp-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button 
                                onClick={() => { setSelectedFeesClassId(null); setSearchQuery(''); setFeesStatusFilter('All'); }}
                                className="btn-outline"
                                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                &larr; Back to Classes
                              </button>
                              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>
                                Outstanding Dues: {selectedFeesClassId === 'all' ? 'All Classes' : getClassName(selectedFeesClassId)} ({getActiveYearRange()})
                              </h3>
                            </div>
        
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status Filter:</span>
                                <select
                                  value={feesStatusFilter}
                                  onChange={(e) => setFeesStatusFilter(e.target.value)}
                                  className="sp-input"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: '160px', width: 'auto' }}
                                >
                                  <option value="All">All</option>
                                  <option value="NO DUES">NO DUES</option>
                                  <option value="DUES PENDING">DUES PENDING</option>
                                  <option value="CRITICAL DUES">CRITICAL DUES</option>
                                  <option value="DEFAULT ALERT">DEFAULT ALERT</option>
                                </select>
                              </div>
        
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sort By:</span>
                                <select
                                  value={feesSortField}
                                  onChange={(e) => setFeesSortField(e.target.value)}
                                  className="sp-input"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem', minWidth: '160px', width: 'auto' }}
                                >
                                  <option value="dues_desc">Dues (Highest First)</option>
                                  <option value="dues_asc">Dues (Lowest First)</option>
                                  <option value="name_asc">Student Name (A-Z)</option>
                                  <option value="name_desc">Student Name (Z-A)</option>
                                  <option value="roll_asc">Roll Number (Ascending)</option>
                                  <option value="roll_desc">Roll Number (Descending)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          
                          {/* Search Input */}
                          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
                              <input 
                                type="text"
                                placeholder="Search students..."
                                className="sp-input"
                                style={{ width: '100%', paddingLeft: '36px', paddingRight: searchQuery ? '32px' : '12px' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                              />
                              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                              {searchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchQuery('')}
                                  style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="Clear search"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </div>
        
                          {(() => {
                            const filteredStudents = students
                              .filter(s => {
                                if (selectedFeesClassId !== 'all' && s.class_id !== selectedFeesClassId) {
                                  return false;
                                }
                                
                                const statusStr = getStudentFeeStatus(s);
                                if (feesStatusFilter !== 'All') {
                                  const mappedStatus = feesStatusFilter === 'NO DUES' ? 'PAID' : feesStatusFilter;
                                  if (mappedStatus === 'DUES PENDING') {
                                    if (statusStr !== 'DUES PENDING' && statusStr !== 'PAYMENT OVERDUE') {
                                      return false;
                                    }
                                  } else {
                                    if (statusStr !== mappedStatus) {
                                      return false;
                                    }
                                  }
                                }
                                
                                if (searchQuery) {
                                  const q = searchQuery.toLowerCase();
                                  const contact = (s.emergency_contact || s.phone || '').toLowerCase();
                                  return s.name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q) || contact.includes(q);
                                }
                                return true;
                              })
                              .sort((a, b) => {
                                if (feesSortField === 'dues_desc') {
                                  return getStudentDuesAmount(b) - getStudentDuesAmount(a);
                                }
                                if (feesSortField === 'dues_asc') {
                                  return getStudentDuesAmount(a) - getStudentDuesAmount(b);
                                }
                                if (feesSortField === 'name_asc') {
                                  return a.name.localeCompare(b.name);
                                }
                                if (feesSortField === 'name_desc') {
                                  return b.name.localeCompare(a.name);
                                }
                                if (feesSortField === 'roll_asc') {
                                  return a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true });
                                }
                                if (feesSortField === 'roll_desc') {
                                  return b.roll_number.localeCompare(a.roll_number, undefined, { numeric: true });
                                }
                                return 0;
                              });
        
                            if (filteredStudents.length === 0) {
                              return (
                                <div style={{ 
                                  textAlign: 'center', 
                                  padding: '48px 24px', 
                                  color: 'var(--text-secondary)',
                                  backgroundColor: 'rgba(255,255,255,0.02)',
                                  border: '1px dashed var(--border-color)',
                                  borderRadius: 'var(--radius-md)',
                                  margin: '20px 0'
                                }}>
                                  <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                                    No students found with outstanding dues.
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Try adjusting your search query or status filter.
                                  </div>
                                </div>
                              );
                            }
        
                            return (
                              <div className="sp-table-container">
                                <table className="sp-table">
                                  <thead>
                                    <tr>
                                      <th>Roll Number</th>
                                      <th>Student Name</th>
                                      <th>Contact</th>
                                      <th>Dues Amount</th>
                                      <th>Status</th>
                                      <th>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredStudents.slice(0, visibleFeesStudentsCount).map(student => {
                                      const contactNum = student.emergency_contact || student.phone || 'N/A';
                                      const duesVal = getStudentDuesAmount(student);
                                      return (
                                        <tr key={student.id}>
                                          <td style={{ fontWeight: 'bold' }}>{student.roll_number}</td>
                                          <td>{student.name}</td>
                                          <td>{contactNum}</td>
                                          <td>{formatMoney(duesVal)}</td>
                                          <td>
                                            {(() => {
                                              const statusStr = getStudentFeeStatus(student);
                                              const badge = getFeeStatusBadgeInfo(statusStr);
                                              return (
                                                <span className={`badge ${badge.class} badge-fixed`}>
                                                  {badge.label}
                                                </span>
                                              );
                                            })()}
                                          </td>
                                          <td>
                                            <button 
                                              id={`btn-open-student-ledger-${student.id}`}
                                              onClick={() => { 
                                                setSelectedStudent(student); 
                                                fetchStudentFeesRecords(student.id, student.class_id); 
                                                setLedgerBackSource('fees');
                                                setActiveTab('students'); 
                                                
                                                // Reset scroll position to top immediately
                                                window.scrollTo(0, 0);
                                                const wrapper = document.querySelector('.main-wrapper');
                                                if (wrapper) {
                                                  wrapper.scrollTop = 0;
                                                }
                                              }}
                                              className="btn-primary" 
                                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                            >
                                              Open Ledger
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
        
                                {/* Lazy Loading Spinner */}
                                {isFetchingMoreFeesStudents && (
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', gap: '8px' }}>
                                    <span 
                                      style={{ 
                                        border: '2px solid rgba(255,255,255,0.2)', 
                                        borderTop: '2px solid white', 
                                        borderRadius: '50%', 
                                        width: '16px', 
                                        height: '16px', 
                                        animation: 'spin 0.8s linear infinite' 
                                      }}
                                    ></span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading More Data...</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
        
                  {/* --- 6. SETTINGS / AUDITS TAB --- */}

      {activeTab === 'financial' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileSpreadsheet size={22} className="gradient-text" />
                            Financial Reports & Accounts History
                          </h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                            Preview current profit/loss statement, generate official reports, and track statement settlements.
                          </p>
                        </div>
                      </div>
        
                      {/* STATEMENTS TAB PANEL */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Date Selector & Action Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                          
                          {/* Inputs Card */}
                          <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
                              New Report Parameters
                            </h4>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>From Date</label>
                                <input 
                                  type="date"
                                  value={reportFromDate}
                                  onChange={(e) => setReportFromDate(e.target.value)}
                                  className="sp-input"
                                />
                              </div>
        
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>To Date</label>
                                <input 
                                  type="date"
                                  value={reportToDate}
                                  onChange={(e) => setReportToDate(e.target.value)}
                                  className="sp-input"
                                />
                              </div>
                            </div>
        
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                              <button 
                                onClick={handlePreviewReport}
                                disabled={isReportPreviewing}
                                className="btn-outline"
                                style={{ flex: 1, padding: '10px', height: '40px', fontSize: '0.9rem' }}
                              >
                                {isReportPreviewing ? "Calculating..." : "Preview Report"}
                              </button>
        
                              {reportPreview && (
                                <button 
                                  onClick={() => setShowGenerateConfirm(true)}
                                  disabled={isGeneratingReport}
                                  className="btn-primary"
                                  style={{ flex: 1, padding: '10px', height: '40px', fontSize: '0.9rem' }}
                                >
                                  {isGeneratingReport ? "Generating..." : "Generate Report"}
                                </button>
                              )}
                            </div>
                          </div>
        
                          {/* Preview Card */}
                          <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', minHeight: '220px' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)', margin: 0 }}>
                              Financial Statement Preview
                            </h4>
                            
                            {reportPreview ? (
                              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>Tuition Fees Collected:</span>
                                  <strong style={{ color: '#10b981', fontSize: '1rem' }}>{formatMoney(reportPreview.fees_collected)}</strong>
                                </div>
        
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>Additional Fees Collected:</span>
                                  <strong style={{ color: '#10b981', fontSize: '1rem' }}>{formatMoney(reportPreview.extra_fees_collected)}</strong>
                                </div>
        
                                {parseFloat(reportPreview.previous_year_recoveries || reportPreview.previous_year_recovery || 0) > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>Previous Year Dues Recovered:</span>
                                    <strong style={{ color: '#10b981', fontSize: '1rem' }}>{formatMoney(reportPreview.previous_year_recoveries || reportPreview.previous_year_recovery)}</strong>
                                  </div>
                                )}
        
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>Total Income:</span>
                                  <strong style={{ color: '#10b981', fontSize: '1.05rem' }}>{formatMoney(reportPreview.total_income || (reportPreview.fees_collected + (reportPreview.previous_year_recoveries || reportPreview.previous_year_recovery || 0) + reportPreview.extra_fees_collected))}</strong>
                                </div>
        
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>Teacher Salaries Paid:</span>
                                  <strong style={{ color: '#ef4444', fontSize: '1rem' }}>{formatMoney(reportPreview.salaries_paid)}</strong>
                                </div>
        
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem' }}>Expenses Paid:</span>
                                  <strong style={{ color: '#ef4444', fontSize: '1rem' }}>{formatMoney(reportPreview.school_expenses)}</strong>
                                </div>
        
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>Total Expenses:</span>
                                  <strong style={{ color: '#ef4444', fontSize: '1.05rem' }}>{formatMoney(reportPreview.total_expenses || (reportPreview.salaries_paid + reportPreview.school_expenses))}</strong>
                                </div>
        
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  padding: '12px 14px', 
                                  background: reportPreview.net_profit >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', 
                                  border: reportPreview.net_profit >= 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)', 
                                  borderRadius: '8px',
                                  marginTop: '4px'
                                }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
                                    {reportPreview.net_profit >= 0 ? "Net Profit:" : "Net Loss:"}
                                  </span>
                                  <strong style={{ 
                                    color: reportPreview.net_profit >= 0 ? '#34d399' : '#f87171', 
                                    fontSize: '1.2rem',
                                    textShadow: reportPreview.net_profit >= 0 ? '0 0 10px rgba(16, 185, 129, 0.2)' : '0 0 10px rgba(239, 68, 68, 0.2)'
                                  }}>
                                    {formatMoney(Math.abs(reportPreview.net_profit))}
                                  </strong>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', flex: 1, padding: '20px 0' }}>
                                <span>📊 Select date range and click Preview Report.</span>
                                <span style={{ fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center' }}>Previews are temporary and do not record history.</span>
                              </div>
                            )}
                          </div>
                        </div>
        
                        {/* Financial History Section */}
                        <div className="sp-card">
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Financial Statements History
                            <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {financialReports.length} {financialReports.length === 1 ? 'Statement' : 'Statements'}
                            </span>
                          </h4>
        
                          {financialReports.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)', gap: '10px' }}>
                              <span style={{ fontSize: '2rem' }}>📜</span>
                              <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>No official reports generated yet.</p>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                              {financialReports.map((report) => {
                                const isProfit = parseFloat(report.net_profit) >= 0;
                                return (
                                  <div key={report.id} className="sp-card fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.01)', position: 'relative' }}>
                                    
                                    {/* Header ID & Status */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                                        {report.report_id || `REP-${String(report.id).padStart(3, '0')}`}
                                      </span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {settlingReportId === report.id ? (
                                          <span 
                                            className="badge"
                                            style={{ margin: 0, backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                          >
                                            <RefreshCw size={12} className="animate-spin" />
                                            Settling... ⏳
                                          </span>
                                        ) : (
                                          <span 
                                            className={`badge ${report.settlement_status === 'Settled' ? 'badge-success' : 'badge-warning'}`}
                                            style={{ cursor: settlingReportId ? 'not-allowed' : 'pointer', margin: 0 }}
                                            onClick={() => {
                                              if (settlingReportId) return;
                                              setReportStatusConfirm({
                                                id: report.id,
                                                currentStatus: report.settlement_status,
                                                newStatus: report.settlement_status === 'Settled' ? 'Pending' : 'Settled'
                                              });
                                            }}
                                            title="Click to change report status"
                                          >
                                            {report.settlement_status}
                                          </span>
                                        )}
                                        <button 
                                          id={`btn-export-report-${report.id}`}
                                          disabled={exportingReportId === report.id}
                                          onClick={() => handleExportReport(report)}
                                          className="btn-outline"
                                          style={{ padding: '2px 8px', fontSize: '0.75rem', height: '24px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        >
                                          {exportingReportId === report.id ? (
                                            <>
                                              <RefreshCw size={12} className="animate-spin" />
                                              Downloading report...
                                            </>
                                          ) : (
                                            <>
                                              <Download size={12} />
                                              Export
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
        
                                    {/* Period */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Report Period</span>
                                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        {new Date(report.from_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} → {new Date(report.to_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </span>
                                    </div>
        
                                    {/* Metrics summary grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tuition Fees:</span>
                                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatMoney(report.fees_collected)}</strong>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Additional Fees:</span>
                                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatMoney(report.extra_fees_collected || 0)}</strong>
                                      </div>
                                      {parseFloat(report.previous_year_recoveries || report.previous_year_recovery || 0) > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Previous Year Dues Recovered:</span>
                                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatMoney(report.previous_year_recoveries || report.previous_year_recovery)}</strong>
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salaries Paid:</span>
                                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatMoney(report.salaries_paid)}</strong>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expenses:</span>
                                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{formatMoney(report.school_expenses || 0)}</strong>
                                      </div>
                                    </div>
        
                                    {/* Net Profit / Loss */}
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      borderTop: '1px solid var(--border-color)', 
                                      paddingTop: '10px',
                                      marginTop: '2px'
                                    }}>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        {isProfit ? "Profit:" : "Loss:"}
                                      </span>
                                      <strong style={{ fontSize: '1.05rem', color: isProfit ? '#10b981' : '#ef4444' }}>
                                        {formatMoney(Math.abs(report.net_profit))}
                                      </strong>
                                    </div>
        
                                    {/* Timestamps */}
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '2px' }}>
                                      <span>Generated:</span>
                                      <span style={{ fontWeight: 500 }}>
                                        {new Date(report.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(report.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
        
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
        
                  {/* --- 6.2 FINANCE MANAGEMENT TAB --- */}

      {activeTab === 'finance_management' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Briefcase size={22} className="gradient-text" />
                            Finance Management
                          </h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                            Manage daily financial entries that later contribute to Financial Reports, including Expenses and the Additional Fee Ledger.
                          </p>
                        </div>
                      </div>
        
                      {/* Finance Management Subtabs */}
                      <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                        {role !== 'Teacher' && (
                          <>
                            <button
                              onClick={() => setFinanceManagementSubTab('fees')}
                              className={`btn-subtab ${financeManagementSubTab === 'fees' ? 'active' : ''}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: financeManagementSubTab === 'fees' ? 'var(--color-primary)' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                borderBottom: financeManagementSubTab === 'fees' ? '2px solid var(--color-primary)' : 'none',
                                paddingBottom: '8px'
                              }}
                            >
                              🏷️ Additional Fee Ledger
                            </button>
                            <button
                              onClick={() => setFinanceManagementSubTab('expenses')}
                              className={`btn-subtab ${financeManagementSubTab === 'expenses' ? 'active' : ''}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: financeManagementSubTab === 'expenses' ? 'var(--color-primary)' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                borderBottom: financeManagementSubTab === 'expenses' ? '2px solid var(--color-primary)' : 'none',
                                paddingBottom: '8px'
                              }}
                            >
                              💸 Expenses
                            </button>
                            <button
                              onClick={() => setFinanceManagementSubTab('promises')}
                              className={`btn-subtab ${financeManagementSubTab === 'promises' ? 'active' : ''}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: financeManagementSubTab === 'promises' ? 'var(--color-primary)' : 'var(--text-muted)',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                borderBottom: financeManagementSubTab === 'promises' ? '2px solid var(--color-primary)' : 'none',
                                paddingBottom: '8px'
                              }}
                            >
                              📅 Payment Promise Tracker
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setFinanceManagementSubTab('recoveries')}
                          className={`btn-subtab ${financeManagementSubTab === 'recoveries' ? 'active' : ''}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: financeManagementSubTab === 'recoveries' ? 'var(--color-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            borderBottom: financeManagementSubTab === 'recoveries' ? '2px solid var(--color-primary)' : 'none',
                            paddingBottom: '8px'
                          }}
                        >
                          ⏳ Previous Year Recovery Dues
                        </button>
                      </div>
        
                      {/* SCHOOL EXPENSES PANEL */}
                      {financeManagementSubTab === 'expenses' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                          
                          {/* Add Expense Card */}
                          <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
                              Record Operational Expense
                            </h4>
                            
                            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
                                <input 
                                  type="text"
                                  placeholder="e.g. Electricity Bill, Stationery"
                                  value={expenseDesc}
                                  onChange={(e) => setExpenseDesc(e.target.value)}
                                  className="sp-input"
                                  required
                                />
                              </div>
        
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹)</label>
                                <input 
                                  type="number"
                                  placeholder="e.g. 2500"
                                  value={expenseAmount}
                                  onChange={(e) => setExpenseAmount(e.target.value)}
                                  className="sp-input"
                                  min="1"
                                  required
                                />
                              </div>
        
                              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px', height: '40px', fontSize: '0.95rem' }}>
                                Add Expense
                              </button>
                            </form>
                          </div>
        
                          {/* Expenses History List Card */}
                          <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Operational Expenses Log
                              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                {expenses.length} {expenses.length === 1 ? 'Record' : 'Records'}
                              </span>
                            </h4>
        
                            {expenses.length === 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)', gap: '10px' }}>
                                <span style={{ fontSize: '2rem' }}>💸</span>
                                <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>No expenses recorded yet.</p>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                                {expenses.map((exp) => (
                                  <div key={exp.id} className="sp-card fade-in" style={{ padding: '14px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.01)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{exp.description}</strong>
                                      <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '1.05rem' }}>{formatMoney(exp.amount)}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      <span>Created By: <strong>{exp.created_by}</strong></span>
                                      <span>
                                        {new Date(exp.expense_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} @ {exp.expense_time ? exp.expense_time.substring(0, 5) : ''}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
        
                      {/* ADDITIONAL FEE LEDGER PANEL */}
                      {financeManagementSubTab === 'fees' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          
                          {/* Top Section: Configure Additional Fee Type */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                            
                            {/* Add Fee Type Card */}
                            <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
                                Configure Additional Fee Type
                              </h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '-10px 0 10px 0', lineHeight: '1.4' }}>
                                Creating an additional fee type automatically assigns this fee charge to all active students in the school.
                              </p>
                              
                              <form onSubmit={handleAddExtraFeeType} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>Fee Name</label>
                                  <input 
                                    type="text"
                                    placeholder="e.g. Admission Fee, Examination Fee"
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                    className="sp-input"
                                    required
                                  />
                                </div>
        
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹)</label>
                                  <input 
                                    type="number"
                                    placeholder="e.g. 500"
                                    value={newTypeAmount}
                                    onChange={(e) => setNewTypeAmount(e.target.value)}
                                    className="sp-input"
                                    min="1"
                                    required
                                  />
                                </div>
        
                                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px', height: '40px', fontSize: '0.95rem' }}>
                                  Create & Assign Fee
                                </button>
                              </form>
                            </div>
        
                            {/* Configured Fee Types List Card */}
                            <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-primary)' }}>
                                Configured Fee Types
                              </h4>
                              {extraFeeTypes.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                                  No additional fee types configured yet.
                                </p>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                                  {extraFeeTypes.map(t => (
                                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '6px 14px', fontSize: '0.85rem' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</span>
                                      <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{formatMoney(t.amount)}</span>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          setEditingExtraFeeType(t);
                                          setEditExtraFeeTypeName(t.name);
                                          setEditExtraFeeTypeAmount(t.amount);
                                        }}
                                        style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                                        title="Edit Fee Type"
                                      >
                                        <Edit size={12} style={{ marginLeft: '4px', color: 'var(--text-secondary)' }} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
        
                          </div>
        
                          {/* Student Additional Fees Ledger Card (Full Width Below) */}
                          <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Student Additional Fee Ledger
                            </h4>
                            
                            {/* Filters Row */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '180px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Search Student</label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    placeholder="Search student name..."
                                    value={extraFeeSearch}
                                    onChange={(e) => setExtraFeeSearch(e.target.value)}
                                    className="sp-input"
                                    style={{ height: '36px', fontSize: '0.85rem', paddingRight: extraFeeSearch ? '56px' : '28px' }}
                                  />
                                  <Search size={14} style={{ position: 'absolute', right: '10px', top: '11px', color: 'var(--text-muted)' }} />
                                  {extraFeeSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setExtraFeeSearch('')}
                                      style={{
                                        position: 'absolute',
                                        right: '28px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                      title="Clear search"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
        
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '140px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Class</label>
                                <select
                                  value={extraFeeClassFilter}
                                  onChange={(e) => setExtraFeeClassFilter(e.target.value)}
                                  className="sp-input"
                                  style={{ height: '36px', fontSize: '0.85rem' }}
                                >
                                  <option value="All">All Classes</option>
                                  {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
        
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '160px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fee Type</label>
                                <select
                                  value={extraFeeTypeFilter}
                                  onChange={(e) => setExtraFeeTypeFilter(e.target.value)}
                                  className="sp-input"
                                  style={{ height: '36px', fontSize: '0.85rem' }}
                                >
                                  <option value="All">All Fee Types</option>
                                  {extraFeeTypes.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                  ))}
                                </select>
                              </div>
        
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</label>
                                <select
                                  value={extraFeeStatusFilter}
                                  onChange={(e) => setExtraFeeStatusFilter(e.target.value)}
                                  className="sp-input"
                                  style={{ height: '36px', fontSize: '0.85rem' }}
                                >
                                  <option value="All">All Statuses</option>
                                  <option value="Pending">Pending</option>
                                  <option value="Paid">Paid</option>
                                </select>
                              </div>
                            </div>
        
                            <div className="sp-table-container" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                              <table className="sp-table">
                                <thead>
                                  <tr>
                                    <th>Student Name</th>
                                    <th>Roll Number</th>
                                    <th>Class</th>
                                    <th>Fee Type</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {studentExtraFees
                                    .filter(sef => {
                                      const matchesSearch = sef.student_name.toLowerCase().includes(extraFeeSearch.toLowerCase());
                                      const matchesClass = extraFeeClassFilter === 'All' || String(sef.class_id) === String(extraFeeClassFilter);
                                      const matchesType = extraFeeTypeFilter === 'All' || sef.fee_name === extraFeeTypeFilter;
                                      const matchesStatus = extraFeeStatusFilter === 'All' || sef.status === extraFeeStatusFilter;
                                      return matchesSearch && matchesClass && matchesType && matchesStatus;
                                    })
                                    .slice(0, visibleAdditionalFeeStudentsCount)
                                    .map((sef) => (
                                      <tr key={sef.id}>
                                        <td style={{ fontWeight: 'bold' }}>{sef.student_name}</td>
                                        <td>{sef.roll_number}</td>
                                        <td>
                                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {sef.class_name || 'N/A'}
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge badge-primary">{sef.fee_name}</span>
                                        </td>
                                        <td>{formatMoney(sef.amount)}</td>
                                        <td>
                                          {(() => {
                                            const isLocked = token.includes('mock') || !isConnected 
                                              ? (sef.status === 'Paid' && isSandboxTransactionLocked(sef.paid_at)) 
                                              : sef.locked;
                                            return (
                                              <span 
                                                className={`badge ${sef.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}
                                                style={{ 
                                                  display: 'inline-flex', 
                                                  justifyContent: 'center', 
                                                  alignItems: 'center', 
                                                  minWidth: '76px', 
                                                  cursor: isLocked ? 'not-allowed' : 'pointer', 
                                                  height: '24px', 
                                                  boxSizing: 'border-box',
                                                  opacity: isLocked ? 0.65 : 1
                                                }}
                                                title={isLocked ? "This fee payment is finalized and locked" : (sef.status === 'Paid' ? "Click to revert to Pending" : "Click to mark as Paid")}
                                                onClick={() => {
                                                  if (isLocked) {
                                                    showToast("This extra fee payment is part of a finalized Financial Report and cannot be reverted.", "error");
                                                    return;
                                                  }
                                                  if (sef.status === 'Paid') {
                                                    setUnpayExtraFeeConfirm({ id: sef.id, fee_name: sef.fee_name });
                                                  } else {
                                                    handleDepositExtraFee(sef.id);
                                                  }
                                                }}
                                              >
                                                {sef.status}
                                              </span>
                                            );
                                          })()}
                                        </td>
                                        <td>
                                          {sef.status === 'Pending' ? (
                                            <button
                                              onClick={() => handleDepositExtraFee(sef.id)}
                                              className="btn-outline"
                                              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '24px', borderRadius: '4px', color: '#10b981', borderColor: '#10b981' }}
                                            >
                                              Deposit Fee
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                const studentObj = {
                                                  id: sef.student_id,
                                                  name: sef.student_name,
                                                  roll_number: sef.roll_number,
                                                  sr_no: sef.sr_no || 'N/A',
                                                  class_id: sef.class_id
                                                };
                                                const recordObj = {
                                                  id: sef.id,
                                                  fee_name: sef.fee_name,
                                                  amount: sef.amount,
                                                  payment_date: sef.payment_date,
                                                  status: sef.status
                                                };
                                                handlePrintReceipt(studentObj, recordObj);
                                              }}
                                              className="btn-outline"
                                              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '24px', borderRadius: '4px', color: 'var(--color-primary)', borderColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                              <Printer size={12} /> Receipt
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  {studentExtraFees.length === 0 && (
                                    <tr>
                                      <td colSpan="7" style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>No ledger entries. Configure an additional fee type first.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
        
                            {/* Lazy Loading Spinner */}
                            {isFetchingMoreAdditionalFeeStudents && (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', gap: '8px' }}>
                                <span 
                                  style={{ 
                                    border: '2px solid rgba(255,255,255,0.2)', 
                                    borderTop: '2px solid white', 
                                    borderRadius: '50%', 
                                    width: '16px', 
                                    height: '16px', 
                                    animation: 'spin 0.8s linear infinite' 
                                  }}
                                ></span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading More Data...</span>
                              </div>
                            )}
        
                          </div>
                        </div>
                      )}
        
                      {/* PAYMENT PROMISE TRACKER PANEL */}
                      {financeManagementSubTab === 'promises' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          
                          {/* Filter & Actions Row */}
                          <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: 1, alignItems: 'flex-end' }}>
                              
                              {/* Student Name Search */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '240px', flex: 1, position: 'relative' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Search Student</label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="text"
                                    placeholder="Search student name..."
                                    value={promiseSearch}
                                    onChange={(e) => setPromiseSearch(e.target.value)}
                                    className="sp-input"
                                    style={{ width: '100%', paddingLeft: '32px', height: '38px', fontSize: '0.85rem' }}
                                  />
                                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                                  {promiseSearch && (
                                    <button
                                      type="button"
                                      onClick={() => setPromiseSearch('')}
                                      style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
        
                              {/* Class Filter */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Class Filter</label>
                                <select
                                  value={promiseClassFilter}
                                  onChange={(e) => setPromiseClassFilter(e.target.value)}
                                  className="sp-input"
                                  style={{ height: '38px', fontSize: '0.85rem' }}
                                >
                                  <option value="All">All Classes</option>
                                  {classes.map(cls => (
                                    <option key={cls.id} value={cls.name}>{cls.name}</option>
                                  ))}
                                </select>
                              </div>
        
                            </div>
        
                            <button
                              onClick={() => {
                                setEditingPromise(null);
                                setPromiseStudentId('');
                                setPromiseStudentSearchQuery('');
                                setPromiseDate('');
                                setPromiseDescription('');
                                setPromiseStatus('Pending');
                                setPromiseModalOpen(true);
                              }}
                              className="btn-primary"
                              style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}
                            >
                              <Plus size={16} /> Add Payment Promise
                            </button>
                          </div>
        
                          {/* Promises Cards Grid */}
                          {(() => {
                            const getLocalDateString = () => {
                              const d = new Date();
                              const offset = d.getTimezoneOffset();
                              const localDate = new Date(d.getTime() - (offset * 60 * 1000));
                              return localDate.toISOString().split('T')[0];
                            };
                            const todayStr = getLocalDateString();
                            const filteredPromises = paymentPromises.filter(p => {
                              const nameMatch = p.student_name ? p.student_name.toLowerCase().includes(promiseSearch.toLowerCase()) : false;
                              const matchesClass = promiseClassFilter === 'All' || p.class_name === promiseClassFilter || (p.class_id && getClassName(p.class_id) === promiseClassFilter);
                              return nameMatch && matchesClass;
                            });
                            
                            const sortedPromises = [...filteredPromises].sort((a, b) => {
                              return String(a.promise_date).localeCompare(String(b.promise_date));
                            });
        
                            if (sortedPromises.length === 0) {
                              return (
                                <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)', gap: '10px' }}>
                                  <span style={{ fontSize: '2rem' }}>📅</span>
                                  <p style={{ fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>No payment promises found.</p>
                                </div>
                              );
                            }
        
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                {sortedPromises.map(p => {
                                  const isPending = p.status === 'Pending' || p.status === undefined;
                                  const isToday = isPending && p.promise_date === todayStr;
                                  const isExpired = isPending && p.promise_date < todayStr;
                                  
                                  // Style highlights for commitments
                                  let borderStyle = '1px solid var(--border-color)';
                                  let bgStyle = 'rgba(255, 255, 255, 0.01)';
                                  if (isToday) {
                                    borderStyle = '1px solid #eab308';
                                    bgStyle = 'rgba(234, 179, 8, 0.02)';
                                  } else if (isExpired) {
                                    borderStyle = '1px solid #ef4444';
                                    bgStyle = 'rgba(239, 68, 68, 0.02)';
                                  }
        
                                  const cardStyle = {
                                    position: 'relative',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    transition: 'all 0.2s ease',
                                    border: borderStyle,
                                    background: bgStyle,
                                    height: '210px'
                                  };
        
                                  return (
                                    <div key={p.id} className="sp-card fade-in" style={cardStyle}>
                                      
                                      {/* Card Header */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{p.student_name}</strong>
                                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.class_name}</span>
                                        </div>
                                        
                                        {/* 3-Dot Action Menu */}
                                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={() => setActivePromiseMenuId(activePromiseMenuId === p.id ? null : p.id)}
                                            className="menu-dot-trigger"
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              color: 'var(--text-muted)',
                                              cursor: 'pointer',
                                              padding: '4px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              borderRadius: '4px'
                                            }}
                                          >
                                            <MoreVertical size={16} />
                                          </button>
                                          {activePromiseMenuId === p.id && (
                                            <div className="menu-dropdown" style={{ right: 0, top: '24px', zIndex: 10 }}>
                                              <button
                                                onClick={() => {
                                                  setEditingPromise(p);
                                                  setPromiseStudentId(p.student_id);
                                                  setPromiseStudentSearchQuery(p.roll_number ? `${p.student_name} (${p.roll_number})` : p.student_name);
                                                  setPromiseDate(p.promise_date);
                                                  setPromiseDescription(p.description);
                                                  setPromiseStatus(p.status || 'Pending');
                                                  setPromiseModalOpen(true);
                                                  setActivePromiseMenuId(null);
                                                }}
                                                className="menu-dropdown-item"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setSimpleConfirm({
                                                    title: 'Delete Payment Promise',
                                                    message: 'Are you sure you want to delete this payment promise? This action cannot be undone.',
                                                    confirmText: 'Delete',
                                                    onConfirm: () => handleDeletePaymentPromise(p.id)
                                                  });
                                                  setActivePromiseMenuId(null);
                                                }}
                                                className="menu-dropdown-item"
                                                style={{ color: '#ef4444' }}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
        
                                      {/* Card Body / Description */}
                                      <p style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-muted)',
                                        margin: 0,
                                        lineHeight: '1.4',
                                        wordBreak: 'break-word',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        flex: 1
                                      }}>
                                        {p.description || null}
                                      </p>
        
                                      {/* Card Footer / Date and Status */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due:</span>
                                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isExpired ? '#ef4444' : (isToday ? '#eab308' : 'var(--text-secondary)') }}>
                                            {p.promise_date}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {isExpired && (
                                            <span style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              padding: '2px 8px',
                                              borderRadius: '12px',
                                              background: 'rgba(239, 68, 68, 0.1)',
                                              color: '#ef4444',
                                              border: '1px solid rgba(239, 68, 68, 0.2)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}>
                                              ⚠️ Overdue
                                            </span>
                                          )}
                                          {isToday && (
                                            <span style={{
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              padding: '2px 8px',
                                              borderRadius: '12px',
                                              background: 'rgba(234, 179, 8, 0.1)',
                                              color: '#facc15',
                                              border: '1px solid rgba(234, 179, 8, 0.2)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px'
                                            }}>
                                              ⚠️ Due Today
                                            </span>
                                          )}
                                          <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            background: p.status === 'Fulfilled' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: p.status === 'Fulfilled' ? '#4ade80' : '#f59e0b',
                                            border: p.status === 'Fulfilled' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                                          }}>
                                            {p.status || 'Pending'}
                                          </span>
                                        </div>
                                      </div>
        
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      )}
        
                      {/* PREVIOUS YEAR RECOVERY HISTORY PANEL */}
                      {financeManagementSubTab === 'recoveries' && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {/* Summary Cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                            <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Dues Recovered</span>
                              <strong style={{ fontSize: '1.8rem', color: '#10b981' }}>
                                {formatMoney(previousYearRecoveries.reduce((sum, r) => sum + parseFloat(r.amount_recovered), 0))}
                              </strong>
                            </div>
                            <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Recovery Dues</span>
                              <strong style={{ fontSize: '1.8rem', color: '#f59e0b' }}>
                                {formatMoney(previousDues.reduce((sum, d) => sum + (d.status !== 'Paid' ? (parseFloat(d.amount) - parseFloat(d.paid_amount)) : 0), 0))}
                              </strong>
                            </div>
                          </div>
        
                          {/* Filters Row */}
                          <div className="sp-card" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '240px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Search Student</label>
                              <input 
                                type="text" 
                                placeholder="Search student name..."
                                className="sp-input"
                                onChange={(e) => setRecoverySearchQuery(e.target.value)}
                                value={recoverySearchQuery}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '180px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Original Year</label>
                              <select 
                                className="sp-input"
                                value={recoveryYearFilter}
                                onChange={(e) => setRecoveryYearFilter(e.target.value)}
                              >
                                <option value="All">All Years</option>
                                {Array.from(new Set(previousDues.map(d => d.original_academic_year))).filter(Boolean).map(y => (
                                  <option key={y} value={y}>{y}</option>
                                ))}
                              </select>
                            </div>
                          </div>
        
                          {/* Logs Table */}
                          <div className="sp-card" style={{ padding: 0 }}>
                            <div style={{ overflowX: 'auto' }}>
                              <table className="sp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Student Name</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Last Year Class</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Original Academic Year</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Due Amount</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Recovery Date</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>Status</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const filtered = previousDues.filter(due => {
                                      const nameMatch = due.student_name ? due.student_name.toLowerCase().includes(recoverySearchQuery.toLowerCase()) : false;
                                      const yearMatch = recoveryYearFilter === 'All' || due.original_academic_year === recoveryYearFilter;
                                      return nameMatch && yearMatch;
                                    });
        
                                    if (filtered.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                            No previous year dues records found.
                                          </td>
                                        </tr>
                                      );
                                    }
        
                                    return filtered.map(due => {
                                      const outstanding = parseFloat(due.amount) - parseFloat(due.paid_amount);
                                      const isPaid = due.status === 'Paid' || outstanding <= 0.01;
                                      const displayStatus = isPaid ? 'PAID' : 'PENDING';
                                      
                                      const dueRecoveries = previousYearRecoveries.filter(r => parseInt(r.carry_forward_due_id) === parseInt(due.id));
                                      const lastRecovery = dueRecoveries[0];
                                      const recoveryDateText = lastRecovery ? formatDate(lastRecovery.recovery_date) : 'N/A';
        
                                      return (
                                        <tr key={due.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                          <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{due.student_name}</td>
                                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{due.class_name}</td>
                                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{due.original_academic_year}</td>
                                          <td style={{ padding: '12px 16px', color: isPaid ? 'var(--text-muted)' : '#f59e0b', fontWeight: 700 }}>
                                            {formatMoney(outstanding)}
                                            {due.paid_amount > 0 && !isPaid && (
                                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                                Paid: {formatMoney(due.paid_amount)} of {formatMoney(due.amount)}
                                              </span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{recoveryDateText}</td>
                                          <td style={{ padding: '12px 16px' }}>
                                            <span className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                              {displayStatus}
                                            </span>
                                          </td>
                                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                                              {!isPaid && isCurrentYearActive() && (
                                                <button
                                                  onClick={() => {
                                                    setSelectedCarryForwardDue(due);
                                                    setRecoveryAmount(String(outstanding));
                                                    setRecoveryDate(new Date().toISOString().split('T')[0]);
                                                    setShowPayRecoveryModal(true);
                                                  }}
                                                  className="btn-primary"
                                                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                                                >
                                                  Collect Payment
                                                </button>
                                              )}
                                              {isPaid && dueRecoveries.length > 0 && (
                                                <>
                                                  <button
                                                    onClick={() => handlePrintRecoveryReceipt(due, lastRecovery)}
                                                    className="btn-outline"
                                                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                  >
                                                    <Printer size={12} /> Receipt
                                                  </button>
                                                  {(() => {
                                                    const isLocked = token.includes('mock') || !isConnected 
                                                      ? (lastRecovery && isSandboxTransactionLocked(lastRecovery.paid_at)) 
                                                      : (lastRecovery && lastRecovery.is_locked);
                                                    if (isLocked) {
                                                      return (
                                                        <button
                                                          onClick={() => {
                                                            showToast("This recovery payment has already been included in a generated financial report and can no longer be reverted.", "error");
                                                          }}
                                                          className="btn-outline"
                                                          style={{
                                                            padding: '4px 10px',
                                                            fontSize: '0.75rem',
                                                            borderRadius: '4px',
                                                            color: 'var(--text-muted)',
                                                            cursor: 'not-allowed',
                                                            opacity: 0.5,
                                                            background: 'rgba(255, 255, 255, 0.02)',
                                                            border: '1px solid var(--border-color)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                          }}
                                                          title="This recovery payment has already been included in a generated financial report and can no longer be reverted."
                                                        >
                                                          Revert
                                                        </button>
                                                      );
                                                    } else if (isCurrentYearActive()) {
                                                      return (
                                                        <button
                                                          onClick={() => {
                                                            setSimpleConfirm({
                                                              title: 'Revert Recovery Payment',
                                                              message: `Are you sure you want to revert recovery payment of ${formatMoney(lastRecovery.amount_recovered)} for ${due.student_name}? This will restore the student's carry forward dues balance.`,
                                                              confirmText: 'Revert Payment',
                                                              onConfirm: () => handleRevertRecovery(due.student_id, lastRecovery.id)
                                                            });
                                                          }}
                                                          className="btn-outline"
                                                          style={{
                                                            padding: '4px 10px',
                                                            fontSize: '0.75rem',
                                                            borderRadius: '4px',
                                                            color: '#ef4444',
                                                            borderColor: 'rgba(239, 68, 68, 0.3)',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                          }}
                                                          title="Revert payment"
                                                        >
                                                          Revert
                                                        </button>
                                                      );
                                                    }
                                                    return null;
                                                  })()}
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
        
                  {/* --- 7. ACADEMIC PLANNER TAB --- */}
    </>
  );
}
