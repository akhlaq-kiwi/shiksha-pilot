import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit, User, UserCog, Upload, AlertCircle, ArrowLeft, Check, Trash2, FileText, Download, Printer, MoreVertical, Lock, CheckCircle, AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../common/ui/card';
import { Input } from '../../../common/ui/input';
import { Select } from '../../../common/ui/select';
import { Dialog } from '../../../common/ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../common/ui/table';
import { schoolService } from '../../../common/services/schoolService';
import { schoolAdminService } from '../../../common/services/schoolAdminService';
import { SearchableSelect, INDIAN_STATES_AND_CITIES } from '../../../common/ui/SearchableSelect';
import html2pdf from 'html2pdf.js';
import { useAcademicYear } from '../../../common/contexts/AcademicYearContext';
import { DropdownMenu, DropdownItem } from '../../../common/ui/DropdownMenu';

// Self-healing avatar image component to handle loading errors gracefully
const TeacherAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);
  
  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : src;
    const cleanUrl = updatedAt ? `${fileUrl}?v=${encodeURIComponent(updatedAt)}` : `${fileUrl}?v=${Date.now()}`;
    return (
      <img 
        src={cleanUrl} 
        alt={name} 
        onError={() => setError(true)} 
        className="w-full h-full object-cover animate-in fade-in duration-200" 
      />
    );
  }
  
  // Use first letters of name as fallback or a clean initials display
  const initials = name
    ? name.split(' ').filter(n => n).filter((_, i) => i < 2).map(n => n[0]).join('').toUpperCase()
    : 'T';
    
  return (
    <div className="w-full h-full bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 flex items-center justify-center text-xl font-black">
      {initials}
    </div>
  );
};

const DOCUMENT_CATEGORIES = [
  "Aadhaar Card",
  "PAN Card",
  "Qualification Certificates",
  "Degree Certificates",
  "Experience Certificates",
  "Resume / CV",
  "Appointment Letter",
  "Identity Proof",
  "Address Proof",
  "Other Documents"
];

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatDateFull = (dateStr) => {
  if (!dateStr) return '—';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const calculateExperience = (joiningDate, exitDate) => {
  if (!joiningDate || !exitDate) return '';
  const start = new Date(joiningDate);
  const end = new Date(exitDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return '';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
    months--;
  }
  if (months < 0) {
    months += 12;
    years--;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} Day${days > 1 ? 's' : ''}`);

  return parts.join(' ') || '0 Days';
};

const printStyles = `
  @media print {
    body * {
      visibility: hidden !important;
    }
    #experience-letter-print-area, #experience-letter-print-area * {
      visibility: visible !important;
    }
    #experience-letter-print-area {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 210mm !important;
      height: 297mm !important;
      margin: 0 !important;
      padding: 20mm !important;
      box-shadow: none !important;
      background: white !important;
      color: black !important;
      font-size: 11pt !important;
      line-height: 1.6 !important;
    }
    .no-print-section {
      display: none !important;
    }
  }
`;

const getLocalDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function StaffPage() {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState('list'); // 'list', 'details'
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [totalPeriodsLimit, setTotalPeriodsLimit] = useState(8);

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      const parsedId = parseInt(idParam, 10);
      if (!isNaN(parsedId)) {
        setSelectedTeacherId(parsedId);
        setView('details');
      }
    }
  }, [searchParams]);
  
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isExpLetterOpen, setIsExpLetterOpen] = useState(false);
  
  // School profile metadata
  const [schoolProfile, setSchoolProfile] = useState(null);

  // Full detailed state of selected teacher
  const [teacherDetails, setTeacherDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [academicYears, setAcademicYears] = useState([]);
  
  // Salary disbursement / revert dialog states
  const [disburseMonth, setDisburseMonth] = useState('');
  const [isDisburseDialogOpen, setIsDisburseDialogOpen] = useState(false);
  const [revertPayment, setRevertPayment] = useState(null);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [isSalarySlipOpen, setIsSalarySlipOpen] = useState(false);
  const [selectedSlipPayment, setSelectedSlipPayment] = useState(null);
  const [isPrevYearDisburseOpen, setIsPrevYearDisburseOpen] = useState(false);
  const [prevYearDisburseMonths, setPrevYearDisburseMonths] = useState([]);
  const [prevYearDisburseTotal, setPrevYearDisburseTotal] = useState(0);
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeMenuMonth, setActiveMenuMonth] = useState(null);

  const [newStaff, setNewStaff] = useState({ 
    id: null,
    name: '', 
    role: 'Teacher', 
    department: 'Mathematics', 
    email: '', 
    phone: '',
    photo_path: '',
    father_name: '',
    mother_name: '',
    emergency_phone: '',
    joining_date: '',
    exit_date: '',
    salary: '',
    current_address_line: '',
    current_city: '',
    current_state: '',
    current_country: 'India',
    current_pin_code: '',
    permanent_address_line: '',
    permanent_city: '',
    permanent_state: '',
    permanent_country: 'India',
    permanent_pin_code: '',
    same_as_current: 0,
    documents: []
  });
  
  const [docCategory, setDocCategory] = useState('Aadhaar Card');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await schoolService.getStaff({ date: getLocalDateStr() });
      setStaff(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load teachers list.');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const data = await schoolService.getStaffDetails(id, { date: getLocalDateStr() });
      setTeacherDetails(data || null);
    } catch (err) {
      console.error(err);
      setError('Failed to load teacher profile details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const { isReadOnly } = useAcademicYear();

  useEffect(() => {
    loadStaff();
    const fetchTimetableSettings = async () => {
      try {
        const settings = await schoolAdminService.getTimetableSettings();
        if (settings && settings.total_periods) {
          setTotalPeriodsLimit(parseInt(settings.total_periods, 10));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTimetableSettings();

    const fetchSchool = async () => {
      try {
        const data = await schoolService.getSchoolProfile();
        setSchoolProfile(data || null);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSchool();

    const fetchYears = async () => {
      try {
        const years = await schoolService.getAcademicYears();
        setAcademicYears(years || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchYears();

    const handleYearSwitch = () => {
      loadStaff();
      if (selectedTeacherId && view === 'details') {
        loadTeacherDetails(selectedTeacherId);
      }
    };
    window.addEventListener('academic-year-switched', handleYearSwitch);
    return () => {
      window.removeEventListener('academic-year-switched', handleYearSwitch);
    };
  }, [selectedTeacherId, view]);

  useEffect(() => {
    if (selectedTeacherId && view === 'details') {
      loadTeacherDetails(selectedTeacherId);
    }
  }, [selectedTeacherId, view]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Loading Teachers...</p>
        </div>
      </div>
    );
  }

  const teachers = staff.filter(s => s.role === 'TEACHER' || s.role === 'Teacher');
  const totalTeachers = teachers.length;
  const activeTeachersCount = teachers.filter(s => s.status === 'ACTIVE').length;

  const filteredStaff = teachers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(staffSearch.toLowerCase()));
    const matchesDept = !selectedDeptFilter || s.department === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  const sortedStaff = [...filteredStaff].sort((a, b) => a.name.localeCompare(b.name));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, photo: "Maximum photo size is 5 MB." }));
      return;
    }
    const allowed = ['jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setFormErrors(prev => ({ ...prev, photo: "Only JPG, JPEG, and PNG formats are supported." }));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await schoolService.uploadDocument(formData);
      if (res && res.url) {
        setNewStaff(prev => ({ ...prev, photo_path: res.url }));
        setFormErrors(prev => {
          const next = { ...prev };
          delete next.photo;
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      setFormErrors(prev => ({ ...prev, photo: "Failed to upload photo." }));
    }
  };

  const handleRemovePhoto = () => {
    setNewStaff(prev => ({ ...prev, photo_path: '' }));
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Maximum file size is 10 MB.");
      return;
    }
    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      alert("This file type is not supported. Supported: PDF, JPG, PNG, DOC, DOCX.");
      return;
    }

    setUploadingDoc(true);
    setUploadError('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await schoolService.uploadDocument(formData);
      if (res && res.url) {
        setNewStaff(prev => ({
          ...prev,
          documents: [
            ...prev.documents,
            {
              category: docCategory || 'Other Documents',
              file_name: file.name,
              file_path: res.url,
              file_size: file.size,
              upload_date: new Date().toISOString()
            }
          ]
        }));
      } else {
        setUploadError("Document upload failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setUploadError("Document upload failed. Please try again.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveDoc = (index) => {
    setNewStaff(prev => ({
      ...prev,
      documents: prev.documents.filter((_, idx) => idx !== index)
    }));
  };

  const handleCheckboxChange = (e) => {
    const { checked } = e.target;
    const same_as_current = checked ? 1 : 0;
    setNewStaff(prev => ({
      ...prev,
      same_as_current,
      permanent_address_line: '',
      permanent_city: '',
      permanent_state: '',
      permanent_country: 'India',
      permanent_pin_code: ''
    }));
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setNewStaff(prev => ({ ...prev, [name]: value }));
  };

  const handleStateChange = (stateType, val) => {
    setNewStaff(prev => {
      const next = { ...prev };
      if (stateType === 'current') {
        next.current_state = val;
        next.current_city = '';
      } else {
        next.permanent_state = val;
        next.permanent_city = '';
      }
      return next;
    });
  };

  const handleCityChange = (cityType, val) => {
    setNewStaff(prev => {
      const next = { ...prev };
      if (cityType === 'current') {
        next.current_city = val;
      } else {
        next.permanent_city = val;
      }
      return next;
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!newStaff.name || newStaff.name.trim().length < 3 || newStaff.name.trim().length > 100) {
      errors.name = "Name must be between 3 and 100 characters.";
    }
    if (!newStaff.father_name || newStaff.father_name.trim().length < 3) {
      errors.father_name = "Father name must be at least 3 characters.";
    }
    if (!newStaff.mother_name || newStaff.mother_name.trim().length < 3 || newStaff.mother_name.trim().length > 100) {
      errors.mother_name = "Mother name must be between 3 and 100 characters.";
    }
    if (!newStaff.phone || !/^[0-9]{10}$/.test(newStaff.phone.trim())) {
      errors.phone = "Contact number must be exactly 10 digits.";
    }
    if (!newStaff.emergency_phone || !/^[0-9]{10}$/.test(newStaff.emergency_phone.trim())) {
      errors.emergency_phone = "Emergency contact number must be exactly 10 digits.";
    }
    if (newStaff.emergency_phone.trim() === newStaff.phone.trim()) {
      errors.emergency_phone = "Emergency contact number must be different from contact number.";
    }
    if (!newStaff.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newStaff.email.trim())) {
      errors.email = "Invalid email address format.";
    }
    if (!newStaff.joining_date) {
      errors.joining_date = "Joining date is required.";
    }
    if (newStaff.exit_date) {
      const exitVal = new Date(newStaff.exit_date);
      const joinVal = new Date(newStaff.joining_date);
      if (exitVal < joinVal) {
        errors.exit_date = "Exit date cannot be earlier than joining date.";
      }
    }

    // Address
    if (!newStaff.current_address_line || newStaff.current_address_line.trim() === '') {
      errors.current_address_line = "Current address is required.";
    }
    if (!newStaff.current_state) {
      errors.current_state = "Current state is required.";
    }
    if (!newStaff.current_city) {
      errors.current_city = "Current city is required.";
    }
    if (!newStaff.current_pin_code || !/^\d{6}$/.test(newStaff.current_pin_code.trim())) {
      errors.current_pin_code = "PIN Code must be exactly 6 digits.";
    }

    if (newStaff.same_as_current === 0) {
      if (!newStaff.permanent_address_line || newStaff.permanent_address_line.trim() === '') {
        errors.permanent_address_line = "Permanent address is required.";
      }
      if (!newStaff.permanent_state) {
        errors.permanent_state = "Permanent state is required.";
      }
      if (!newStaff.permanent_city) {
        errors.permanent_city = "Permanent city is required.";
      }
      if (!newStaff.permanent_pin_code || !/^\d{6}$/.test(newStaff.permanent_pin_code.trim())) {
        errors.permanent_pin_code = "PIN Code must be exactly 6 digits.";
      }
    }

    // Salary Validation
    if (newStaff.salary === undefined || newStaff.salary === null || String(newStaff.salary).trim() === '') {
      errors.salary = "Salary is required.";
    } else {
      const salVal = parseFloat(newStaff.salary);
      if (isNaN(salVal) || salVal <= 0) {
        errors.salary = "Salary must be a positive number.";
      }
    }

    // Subject Validation (department field)
    if (!newStaff.department || newStaff.department.trim() === '') {
      errors.department = "Subject is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddStaff = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    setError('');
    
    const payload = {
      name: newStaff.name.trim(),
      role: 'Teacher',
      department: newStaff.department ? newStaff.department.trim() : '',
      email: newStaff.email.trim(),
      phone: newStaff.phone.trim(),
      photo_path: newStaff.photo_path || null,
      father_name: newStaff.father_name.trim(),
      mother_name: newStaff.mother_name.trim(),
      salary: newStaff.salary,
      emergency_phone: newStaff.emergency_phone.trim(),
      joining_date: newStaff.joining_date,
      exit_date: newStaff.exit_date || null,
      current_address_line: newStaff.current_address_line.trim(),
      current_city: newStaff.current_city,
      current_state: newStaff.current_state,
      current_country: newStaff.current_country,
      current_pin_code: newStaff.current_pin_code.trim(),
      permanent_address_line: newStaff.same_as_current === 1 ? newStaff.current_address_line.trim() : newStaff.permanent_address_line.trim(),
      permanent_city: newStaff.same_as_current === 1 ? newStaff.current_city : newStaff.permanent_city,
      permanent_state: newStaff.same_as_current === 1 ? newStaff.current_state : newStaff.permanent_state,
      permanent_country: newStaff.same_as_current === 1 ? newStaff.current_country : newStaff.permanent_country,
      permanent_pin_code: newStaff.same_as_current === 1 ? newStaff.current_pin_code.trim() : newStaff.permanent_pin_code.trim(),
      same_as_current: newStaff.same_as_current,
      documents: newStaff.documents
    };

    try {
      if (newStaff.id) {
        // Edit Mode
        const updated = await schoolService.updateStaff(newStaff.id, payload);
        setSuccess('Teacher profile updated successfully.');
        setTeacherDetails(updated);
      } else {
        // Create Mode
        const employee_id = `EMP-${Date.now().toString().slice(-4)}`;
        await schoolService.createStaff({
          ...payload,
          employee_id
        });
        setSuccess('Teacher added successfully.');
      }
      
      setIsAddStaffOpen(false);
      await loadStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      if (err.data && typeof err.data === 'object') {
        const errors = { ...err.data };
        if (errors.phone) {
          errors.phone = "Phone number already exists. Please use a different mobile number.";
        }
        setFormErrors(errors);
      } else if (err.message && (err.message.includes('contact number') || err.message.includes('phone') || err.message.includes('registered') || err.message.includes('exists'))) {
        setFormErrors({
          phone: "Phone number already exists. Please use a different mobile number."
        });
      }
      setError(err.message || 'Failed to save teacher details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (t) => {
    setNewStaff({
      id: t.id,
      name: t.name,
      role: t.role,
      department: t.department || '',
      email: t.email || '',
      phone: t.phone || '',
      photo_path: t.photo_path || '',
      father_name: t.father_name || '',
      mother_name: t.mother_name || '',
      salary: t.salary || '',
      emergency_phone: t.emergency_phone || '',
      joining_date: t.joining_date || '',
      exit_date: t.exit_date || '',
      current_address_line: t.current_address_line || '',
      current_city: t.current_city || '',
      current_state: t.current_state || '',
      current_country: t.current_country || 'India',
      current_pin_code: t.current_pin_code || '',
      permanent_address_line: t.permanent_address_line || '',
      permanent_city: t.permanent_city || '',
      permanent_state: t.permanent_state || '',
      permanent_country: t.permanent_country || 'India',
      permanent_pin_code: t.permanent_pin_code || '',
      same_as_current: t.same_as_current ? 1 : 0,
      documents: t.documents || []
    });
    setFormErrors({});
    setUploadError('');
    setIsAddStaffOpen(true);
  };

  const handleConfirmDisburse = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await schoolService.payStaffSalary({
        staff_id: teacherDetails.id,
        month: disburseMonth
      });
      setIsDisburseDialogOpen(false);
      await loadTeacherDetails(teacherDetails.id);
    } catch (err) {
      console.error(err);
      let errorMsg = 'Failed to disburse salary.';
      if (err.data && typeof err.data === 'object') {
        if (err.data.errors && typeof err.data.errors === 'object') {
          const firstErrKey = Object.keys(err.data.errors)[0];
          errorMsg = err.data.errors[firstErrKey];
        } else {
          const firstErrKey = Object.keys(err.data)[0];
          if (typeof err.data[firstErrKey] === 'string') {
            errorMsg = err.data[firstErrKey];
          } else if (err.data[firstErrKey] && typeof err.data[firstErrKey] === 'object') {
            const nestedKey = Object.keys(err.data[firstErrKey])[0];
            errorMsg = err.data[firstErrKey][nestedKey];
          }
        }
      } else {
        errorMsg = err.message || 'Failed to disburse salary.';
      }
      setActionError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPrevYearDisburse = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await schoolService.disbursePreviousYearStaffSalary({
        staff_id: teacherDetails.id,
        months: prevYearDisburseMonths
      });
      setIsPrevYearDisburseOpen(false);
      await loadTeacherDetails(teacherDetails.id);
    } catch (err) {
      console.error(err);
      let errorMsg = 'Failed to disburse previous year salary.';
      if (err.data && typeof err.data === 'object') {
        if (err.data.errors && typeof err.data.errors === 'object') {
          const firstErrKey = Object.keys(err.data.errors)[0];
          errorMsg = err.data.errors[firstErrKey];
        } else {
          const firstErrKey = Object.keys(err.data)[0];
          if (typeof err.data[firstErrKey] === 'string') {
            errorMsg = err.data[firstErrKey];
          }
        }
      } else {
        errorMsg = err.message || 'Failed to disburse previous year salary.';
      }
      setActionError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRevert = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      await schoolService.revertStaffSalary(revertPayment.id);
      setIsRevertDialogOpen(false);
      await loadTeacherDetails(teacherDetails.id);
    } catch (err) {
      console.error(err);
      let errorMsg = 'Failed to revert salary payment.';
      if (err.data && typeof err.data === 'object') {
        if (err.data.errors && typeof err.data.errors === 'object') {
          const firstErrKey = Object.keys(err.data.errors)[0];
          errorMsg = err.data.errors[firstErrKey];
        } else {
          const firstErrKey = Object.keys(err.data)[0];
          if (typeof err.data[firstErrKey] === 'string') {
            errorMsg = err.data[firstErrKey];
          } else if (err.data[firstErrKey] && typeof err.data[firstErrKey] === 'object') {
            const nestedKey = Object.keys(err.data[firstErrKey])[0];
            errorMsg = err.data[firstErrKey][nestedKey];
          }
        }
      } else {
        errorMsg = err.message || 'Failed to revert salary payment.';
      }
      setActionError(errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadSalarySlip = () => {
    const element = document.getElementById('salary-slip-print-area');
    if (!element) return;
    
    const opt = {
      margin: 15,
      filename: `SalarySlip_${teacherDetails?.name?.split(/\\s+/).join('') || 'Teacher'}_${selectedSlipPayment?.payment_month}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().from(element).set(opt).save();
  };

  const handlePrintSalarySlip = () => {
    const printContent = document.getElementById('salary-slip-print-area').innerHTML;
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
    doc.write('<html><head><title>Print Salary Slip</title>');
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
      document.body.removeChild(iframe);
    }, 500);
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('experience-letter-print-area');
    if (!element) return;
    
    const opt = {
      margin: 0,
      filename: `Experience_Letter_${teacherDetails?.name || 'Teacher'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().from(element).set(opt).save();
  };

  const handlePrintExpLetter = () => {
    const printContent = document.getElementById('experience-letter-print-area').innerHTML;
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
    doc.write('<html><head><title>Print Experience Letter</title>');
    Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach(el => {
      doc.write(el.outerHTML);
    });
    doc.write(`
      <style>
        @page {
          size: A4 portrait;
          margin: 0mm;
        }
        body {
          background-color: white !important;
          color: black !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #experience-letter-print-area {
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          padding: 20mm !important;
          box-sizing: border-box !important;
        }
      </style>
    </head>
    <body class="bg-white text-black">
      <div id="experience-letter-print-area" class="w-full h-full bg-white text-zinc-950 font-serif flex flex-col justify-between select-text">
        ${printContent}
      </div>
    </body>
    </html>
    `);
    doc.close();
    
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Redesigned Details View */}
      {view === 'details' && (() => {
        const t = teacherDetails;
        if (loadingDetails) {
          return (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <p className="text-xs font-semibold text-text-secondary uppercase">Loading details...</p>
              </div>
            </div>
          );
        }
        if (!t) {
          return (
            <div className="p-4 bg-red-500/10 text-red-600 rounded-lg text-xs font-bold text-center">
              Failed to load profile. <Button variant="secondary" className="ml-2 h-7 font-bold text-xs" onClick={() => setView('list')}>Back to List</Button>
            </div>
          );
        }
        
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="sticky top-14 z-20 flex items-center justify-between border-b border-border pb-4 gap-4 bg-surface p-4 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setView('list')} 
                  className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs"
                >
                  Back
                </button>
                <h2 className="text-2xl font-black text-text-primary tracking-tight font-display">Teacher Profile</h2>
              </div>
              <div className="flex items-center gap-3">
                {t.exit_date && (
                  <Button 
                    onClick={() => setIsExpLetterOpen(true)}
                    className="flex items-center gap-2 font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  >
                    <FileText className="h-4 w-4" /> Experience Letter
                  </Button>
                )}
                {!isReadOnly && (
                  <Button variant="outline" className="flex items-center gap-2 font-bold" onClick={() => handleEditClick(t)}>
                    <Edit className="h-4 w-4" /> Edit Profile
                  </Button>
                )}
              </div>
            </div>

            {/* Profile Info Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column Card */}
              <Card className="lg:col-span-1 p-6 bg-surface border border-border rounded-2xl shadow-xs space-y-6 overflow-hidden">
                <div className="flex flex-col items-center text-center">
                  <div className="w-28 h-28 rounded-full border-2 border-primary/20 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0 relative">
                    <TeacherAvatar src={t.photo_path} name={t.name} updatedAt={t.updated_at} />
                  </div>
                  
                  <h3 className="text-xl font-black text-text-primary tracking-tight font-display mt-4">{t.name}</h3>
                  <p className="text-xs text-text-muted mt-1.5 font-bold uppercase tracking-wider">Employee ID: <span className="font-mono text-text-primary font-extrabold">{t.employee_id || '-'}</span></p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      t.status === 'ACTIVE'
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-red-500/10 text-red-600 border-red-500/20'
                    }`}>
                      {t.status}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-text-secondary dark:bg-zinc-800 uppercase">
                      {t.department || 'General'}
                    </span>
                  </div>
                </div>

                <hr className="border-border" />

                <div className="space-y-4 text-xs">
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Father's Name</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{t.father_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Mother's Name</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{t.mother_name || '—'}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Contact Phone</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{t.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Emergency Contact</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{t.emergency_phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Email Address</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5 break-all">{t.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-wider">Joining Date</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{formatDate(t.joining_date)}</p>
                  </div>
                  {t.exit_date && (
                    <div>
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-wider">Exit Date</p>
                      <p className="text-sm font-semibold text-text-primary mt-0.5">{formatDate(t.exit_date)}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Right Column details */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Address details */}
                <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs">
                  <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider mb-4 border-b border-border pb-2">Address Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2">
                      <h4 className="font-bold text-text-secondary uppercase text-[10px] tracking-wider">Current Address</h4>
                      <p className="text-sm text-text-primary leading-relaxed">
                        {t.current_address_line || '—'}<br />
                        {t.current_city ? `${t.current_city}, ` : ''}{t.current_state || ''}<br />
                        {t.current_country || 'India'} - {t.current_pin_code || ''}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-text-secondary uppercase text-[10px] tracking-wider">Permanent Address</h4>
                      {t.same_as_current === 1 ? (
                        <p className="text-xs text-text-muted italic">Same as Current Address</p>
                      ) : (
                        <p className="text-sm text-text-primary leading-relaxed">
                          {t.permanent_address_line || '—'}<br />
                          {t.permanent_city ? `${t.permanent_city}, ` : ''}{t.permanent_state || ''}<br />
                          {t.permanent_country || 'India'} - {t.permanent_pin_code || ''}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
                   {/* Salary Card panel */}
                <Card className="p-6 bg-surface border border-border rounded-2xl shadow-xs animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                    <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">Salary Card</h3>
                    <span className="text-xs text-text-secondary font-bold">
                      Academic Year: {academicYears.find(y => y.is_current)?.name || academicYears.find(y => y.status === 'Draft')?.name || '—'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'].map(month => {
                      const payment = (t.salary_payments || []).find(p => p.payment_month === month);
                      const isPaid = !!payment;
                      const isLocked = payment ? !!payment.is_locked : false;
                      const salaryAmount = t.salary || 0.0;

                      return (
                        <div 
                          key={month} 
                          className={`p-4 rounded-xl border flex flex-col justify-between relative transition-all shadow-3xs ${
                            isPaid 
                              ? 'bg-zinc-50/50 dark:bg-zinc-900/10 border-border' 
                              : 'bg-surface border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          {/* Top row: Month name and dropdown menu (if paid and not locked) */}
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-extrabold text-text-primary">{month}</h4>
                              <p className="text-[10px] text-text-secondary font-bold uppercase mt-0.5">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-3 w-3" /> Paid
                                  </span>
                                ) : (
                                  <span className="text-amber-500">Pending</span>
                                )}
                              </p>
                            </div>
                            
                            {isPaid && (
                            <div className="flex items-center gap-1.5">
                                {isLocked && (
                                  <span title="Locked by Financial Report" className="text-zinc-400">
                                    <Lock className="h-3.5 w-3.5" />
                                  </span>
                                )}
                                {(!isReadOnly || !t.is_migrated) && !isLocked && isPaid && (
                                   <DropdownMenu>
                                     <DropdownItem
                                       destructive
                                       onClick={() => {
                                         setRevertPayment(payment);
                                         setIsRevertDialogOpen(true);
                                       }}
                                     >
                                       Revert Salary
                                     </DropdownItem>
                                   </DropdownMenu>
                                 )}
                              </div>
                            )}
                          </div>

                          {/* Middle row: salary amount */}
                          <div className="my-4">
                            <p className="text-lg font-black text-text-primary">
                              ₹{parseFloat(salaryAmount).toLocaleString('en-IN')}
                            </p>
                          </div>

                          {/* Bottom row: Disburse / Salary Slip button */}
                          <div className="mt-2">
                            {isPaid ? (
                              <Button 
                                variant="outline"
                                onClick={() => {
                                  setSelectedSlipPayment(payment);
                                  setIsSalarySlipOpen(true);
                                }}
                                className="w-full h-8 text-xs font-bold flex items-center gap-1 bg-surface border border-border hover:bg-zinc-50"
                              >
                                <FileText className="h-3.5 w-3.5" /> Salary Slip
                              </Button>
                            ) : (
                              <Button 
                                disabled={isReadOnly && t.is_migrated}
                                onClick={() => {
                                  if (isReadOnly && t.is_migrated) return;
                                  setDisburseMonth(month);
                                  setIsDisburseDialogOpen(true);
                                }}
                                className={`w-full h-8 text-xs font-bold ${(isReadOnly && t.is_migrated) ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                              >
                                Disburse
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                 {t.previous_year_pending && (
                  <Card className="p-6 bg-surface border border-amber-200 dark:border-amber-900/30 rounded-2xl shadow-xs mt-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider">Previous Year Salary Card</h3>
                      </div>
                      <span className="text-xs text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                        AY: {t.previous_year_pending.academic_year_name}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'].map(month => {
                        const isPending = t.previous_year_pending.pending_months.includes(month);
                        const payment = (t.salary_payments || []).find(p => 
                          p.payment_month === month || 
                          p.payment_month === `Previous Year - ${month}`
                        );
                        const isPaid = !isPending || !!payment;
                        const isLocked = payment ? !!payment.is_locked : false;
                        const salaryAmount = t.previous_year_pending.salary || 0.0;

                        return (
                          <div 
                            key={month} 
                            className={`p-4 rounded-xl border flex flex-col justify-between relative transition-all shadow-3xs ${
                              isPaid 
                                ? 'bg-zinc-50/50 dark:bg-zinc-900/10 border-border' 
                                : 'bg-surface border-zinc-200 dark:border-zinc-800'
                            }`}
                          >
                            {/* Top row: Month name and dropdown menu (if paid and not locked) */}
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-sm font-extrabold text-text-primary">{month}</h4>
                                <p className="text-[10px] text-text-secondary font-bold uppercase mt-0.5">
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-3 w-3" /> Paid
                                    </span>
                                  ) : (
                                    <span className="text-amber-500">Pending</span>
                                  )}
                                </p>
                              </div>
                              
                              {isPaid && payment && (
                                <div className="flex items-center gap-1.5">
                                  {isLocked && (
                                    <span title="Locked by Financial Report" className="text-zinc-400">
                                      <Lock className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                  {(!isReadOnly || !t.is_migrated) && !isLocked && (
                                    <DropdownMenu>
                                      <DropdownItem
                                        destructive
                                        onClick={() => {
                                          setRevertPayment(payment);
                                          setIsRevertDialogOpen(true);
                                        }}
                                      >
                                        Revert Salary
                                      </DropdownItem>
                                    </DropdownMenu>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Middle row: salary amount */}
                            <div className="my-4">
                              <p className="text-lg font-black text-text-primary">
                                ₹{parseFloat(salaryAmount).toLocaleString('en-IN')}
                              </p>
                            </div>

                            {/* Bottom row: Disburse / Salary Slip button */}
                            <div className="mt-2">
                              {isPaid ? (
                                payment ? (
                                  <Button 
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedSlipPayment(payment);
                                      setIsSalarySlipOpen(true);
                                    }}
                                    className="w-full h-8 text-xs font-bold flex items-center gap-1 bg-surface border border-border hover:bg-zinc-50"
                                  >
                                    <FileText className="h-3.5 w-3.5" /> Salary Slip
                                  </Button>
                                ) : (
                                  <div className="h-8 flex items-center justify-center text-xs text-text-muted font-bold">
                                    Settled in Previous Year
                                  </div>
                                )
                              ) : (
                                <Button 
                                  disabled={isReadOnly && t.is_migrated}
                                  onClick={() => {
                                    if (isReadOnly && t.is_migrated) return;
                                    setPrevYearDisburseMonths([month]);
                                    setPrevYearDisburseTotal(salaryAmount);
                                    setIsPrevYearDisburseOpen(true);
                                  }}
                                  className={`w-full h-8 text-xs font-bold ${(isReadOnly && t.is_migrated) ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                                >
                                  Disburse
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
                 </Card>

              </div>
            </div>
          </div>
        );
      })()}

      {/* Roster Listing View */}
      {view === 'list' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight font-display">Teachers</h2>
              <p className="text-text-secondary text-sm mt-1">{totalTeachers} teachers · {activeTeachersCount} active</p>
            </div>
            {!isReadOnly && (
            <Button className="flex items-center gap-2 font-bold shadow-xs hover:shadow-md transition-all duration-200" onClick={() => {
              setNewStaff({
                id: null,
                name: '',
                role: 'Teacher',
                department: '',
                email: '',
                phone: '',
                emergency_phone: '',
                photo_path: '',
                father_name: '',
                mother_name: '',
                joining_date: '',
                exit_date: '',
                salary: '',
                current_address_line: '',
                current_city: '',
                current_state: '',
                current_country: 'India',
                current_pin_code: '',
                permanent_address_line: '',
                permanent_city: '',
                permanent_state: '',
                permanent_country: 'India',
                permanent_pin_code: '',
                same_as_current: 0,
                documents: []
              });
              setFormErrors({});
              setUploadError('');
              setIsAddStaffOpen(true);
            }}>
              <Plus className="h-4 w-4" /> Add Teacher
            </Button>
          )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-600 rounded-lg text-xs font-semibold">
              {success}
            </div>
          )}

          {/* Filters */}
          <div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
              <Input placeholder="Search teachers..." className="pl-9" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
            </div>
            <Select className="w-full md:w-48" value={selectedDeptFilter} onChange={e => setSelectedDeptFilter(e.target.value)}>
              <option value="">All Subjects</option>
              {Array.from(new Set(teachers.map(t => t.department).filter(Boolean))).sort().map(subj => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </Select>
          </div>

          {/* Cards Grid */}
          {sortedStaff.length === 0 ? (
            <Card className="p-8 text-center text-text-muted text-xs shadow-xs">
              No teachers found.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedStaff.map(t => {
                return (
                  <div 
                    key={t.id}
                    onClick={() => { setSelectedTeacherId(t.id); setView('details'); }}
                    className="flex flex-col items-center justify-between p-6 bg-surface border border-border rounded-2xl hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-200 text-center select-none min-h-[220px]"
                  >
                    <div className="flex flex-col items-center w-full">
                      {/* Photo / Avatar */}
                      <div className="w-20 h-20 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden mb-4 shadow-2xs">
                        <TeacherAvatar src={t.photo_path} name={t.name} updatedAt={t.updated_at} />
                      </div>
                      
                      {/* Name */}
                      <h3 className="font-extrabold text-text-primary text-base hover:text-primary transition-colors leading-tight truncate w-full px-1">
                        {t.name}
                      </h3>
                      <p className="text-[10px] text-text-muted font-bold tracking-tight uppercase mt-1">{t.department || 'General'}</p>
                    </div>
                    
                    <div className="flex items-center justify-between w-full mt-4 text-xs">
                      {(() => {
                        const rawAssigned = parseInt(t.assigned_periods || 0, 10);
                        const max = totalPeriodsLimit;
                        let assigned = rawAssigned;
                        if (rawAssigned > max) {
                          console.error(`[Validation Error] Teacher ${t.name} has assigned periods (${rawAssigned}) exceeding max allowed (${max}).`);
                          assigned = max;
                        }
                        const isOccupied = assigned === max;
                        return (
                          <>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                              isOccupied 
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                : 'bg-green-500/10 text-green-600 border-green-500/20'
                            }`}>
                              {isOccupied ? 'Occupied' : 'Available'}
                            </span>
                            
                            <span className="text-[10px] text-text-muted font-bold font-sans">
                              Assigned {assigned}/{max}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add / Edit Teacher Dialog */}
      <Dialog isOpen={isAddStaffOpen} onClose={() => setIsAddStaffOpen(false)}
        title={newStaff.id ? "Edit Teacher Profile" : "Add Teacher Profile"} 
        description={newStaff.id ? "Update professional qualifications and profile files of selected teacher." : "Create teacher profile and associate address and certificates."}
        className="w-[95vw] md:max-w-4xl"
        footer={<>
          <Button variant="secondary" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
          <Button onClick={handleAddStaff} disabled={submitting}>{submitting ? 'Saving...' : (newStaff.id ? 'Save Changes' : 'Add Teacher')}</Button>
        </>}>
        <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6 pt-2">
          
          {/* SECTION 1 — Teacher Photo upload only (no section heading) */}
          <div className="space-y-2 border-b border-border pb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border border-border bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                <TeacherAvatar src={newStaff.photo_path} name={newStaff.name || 'Preview'} />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-secondary bg-surface hover:bg-zinc-50 cursor-pointer shadow-2xs transition-all">
                    <Upload className="h-3.5 w-3.5" /> Upload Photo
                    <input 
                      type="file" 
                      accept="image/jpeg,image/jpg,image/png" 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                    />
                  </label>
                  {newStaff.photo_path && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={handleRemovePhoto}
                      className="h-8 font-bold text-xs bg-red-600 hover:bg-red-700 text-white"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {formErrors.photo && <p className="text-[10px] text-red-500 font-semibold">{formErrors.photo}</p>}
              </div>
            </div>
          </div>

          {/* Basic Details */}
          <div className="space-y-4 border-b border-border pb-4">
            <h3 className="text-sm font-black text-text-primary tracking-tight font-display">Basic Details</h3>
            
            {/* Row 1: Full Name, Father Name, Mother Name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Full Name <span className="text-red-500">*</span></label>
                <Input name="name" value={newStaff.name} onChange={handleTextChange} placeholder="e.g. Ms. Anita Sharma" required />
                {formErrors.name && <p className="text-[10px] text-red-500 font-semibold">{formErrors.name}</p>}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Father Name <span className="text-red-500">*</span></label>
                <Input name="father_name" value={newStaff.father_name} onChange={handleTextChange} placeholder="e.g. Shri Om Prakash Sharma" required />
                {formErrors.father_name && <p className="text-[10px] text-red-500 font-semibold">{formErrors.father_name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Mother Name <span className="text-red-500">*</span></label>
                <Input name="mother_name" value={newStaff.mother_name} onChange={handleTextChange} placeholder="e.g. Shabana Begum" required />
                {formErrors.mother_name && <p className="text-[10px] text-red-500 font-semibold">{formErrors.mother_name}</p>}
              </div>
            </div>

            {/* Row 2: Contact Number, Emergency Contact Number, Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Contact Number <span className="text-red-500">*</span></label>
                <Input name="phone" value={newStaff.phone} onChange={handleTextChange} placeholder="10-digit mobile number" required />
                {formErrors.phone && <p className="text-[10px] text-red-500 font-semibold">{formErrors.phone}</p>}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Emergency Contact Number <span className="text-red-500">*</span></label>
                <Input name="emergency_phone" value={newStaff.emergency_phone} onChange={handleTextChange} placeholder="Emergency number" required />
                {formErrors.emergency_phone && <p className="text-[10px] text-red-500 font-semibold">{formErrors.emergency_phone}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Email Address <span className="text-red-500">*</span></label>
                <Input name="email" type="email" value={newStaff.email} onChange={handleTextChange} placeholder="anita@school.com" required />
                {formErrors.email && <p className="text-[10px] text-red-500 font-semibold">{formErrors.email}</p>}
              </div>
            </div>

            {/* Conditional grid depending on Edit vs Add */}
            {newStaff.id ? (
              <>
                {/* Edit Mode: Row 3 (Joining Date, Exit Date, Parent Occupation) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Joining Date <span className="text-red-500">*</span></label>
                    <Input 
                      type="date" 
                      name="joining_date"
                      value={newStaff.joining_date} 
                      onChange={handleTextChange} 
                      onKeyDown={e => e.preventDefault()}
                      className="cursor-pointer w-full" 
                      required 
                    />
                    {formErrors.joining_date && <p className="text-[10px] text-red-500 font-semibold">{formErrors.joining_date}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Exit Date</label>
                    <Input 
                      type="date" 
                      name="exit_date"
                      value={newStaff.exit_date} 
                      onChange={handleTextChange} 
                      onKeyDown={e => e.preventDefault()}
                      className="cursor-pointer w-full text-red-500 font-bold" 
                    />
                    {formErrors.exit_date && <p className="text-[10px] text-red-500 font-semibold">{formErrors.exit_date}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Salary <span className="text-red-500">*</span></label>
                    <Input 
                      type="number" 
                      name="salary" 
                      value={newStaff.salary} 
                      onChange={handleTextChange} 
                      placeholder="e.g. 25000" 
                      required 
                    />
                    {formErrors.salary && <p className="text-[10px] text-red-500 font-semibold">{formErrors.salary}</p>}
                  </div>
                </div>

                {/* Edit Mode: Row 4 (Subject, spacer, spacer) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase font-display">Subject <span className="text-red-500">*</span></label>
                    <Input 
                      placeholder="e.g. English"
                      value={newStaff.department || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewStaff(p => ({ ...p, department: val }));
                        if (formErrors.department) setFormErrors(prev => ({ ...prev, department: '' }));
                      }}
                      className={formErrors.department ? 'border-red-500 ring-1 ring-red-500' : ''}
                      required 
                    />
                    {formErrors.department && <p className="text-[10px] text-red-500 font-semibold">{formErrors.department}</p>}
                  </div>
                  <div></div>
                  <div></div>
                </div>
              </>
            ) : (
              <>
                {/* Add Mode: Row 3 (Joining Date, Parent Occupation, Department) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Joining Date <span className="text-red-500">*</span></label>
                    <Input 
                      type="date" 
                      name="joining_date"
                      value={newStaff.joining_date} 
                      onChange={handleTextChange} 
                      onKeyDown={e => e.preventDefault()}
                      className="cursor-pointer w-full" 
                      required 
                    />
                    {formErrors.joining_date && <p className="text-[10px] text-red-500 font-semibold">{formErrors.joining_date}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase">Salary <span className="text-red-500">*</span></label>
                    <Input 
                      type="number" 
                      name="salary" 
                      value={newStaff.salary} 
                      onChange={handleTextChange} 
                      placeholder="e.g. 25000" 
                      required 
                    />
                    {formErrors.salary && <p className="text-[10px] text-red-500 font-semibold">{formErrors.salary}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase font-display">Subject <span className="text-red-500">*</span></label>
                    <Input 
                      placeholder="e.g. English"
                      value={newStaff.department || ''} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewStaff(p => ({ ...p, department: val }));
                        if (formErrors.department) setFormErrors(prev => ({ ...prev, department: '' }));
                      }}
                      className={formErrors.department ? 'border-red-500 ring-1 ring-red-500' : ''}
                      required 
                    />
                    {formErrors.department && <p className="text-[10px] text-red-500 font-semibold">{formErrors.department}</p>}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Current Address */}
          <div className="space-y-4 border-b border-border pb-4">
            <h3 className="text-sm font-black text-text-primary tracking-tight font-display">Current Address</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5 w-full p-px">
                <label className="text-xs font-bold text-text-secondary uppercase">Address Line <span className="text-red-500">*</span></label>
                <Input name="current_address_line" value={newStaff.current_address_line} onChange={handleTextChange} placeholder="House no, street, locality..." required />
                {formErrors.current_address_line && <p className="text-[10px] text-red-500 font-semibold">{formErrors.current_address_line}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SearchableSelect
                  label="State"
                  placeholder="Select State..."
                  value={newStaff.current_state}
                  onChange={(val) => handleStateChange('current', val)}
                  options={Object.keys(INDIAN_STATES_AND_CITIES)}
                  required
                  error={formErrors.current_state}
                />
                <SearchableSelect
                  label="City"
                  placeholder="Select City..."
                  value={newStaff.current_city}
                  onChange={(val) => handleCityChange('current', val)}
                  options={newStaff.current_state ? (INDIAN_STATES_AND_CITIES[newStaff.current_state] || []) : []}
                  required
                  error={formErrors.current_city}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">Country</label>
                  <Input name="current_country" value={newStaff.current_country} readOnly />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary uppercase">PIN Code <span className="text-red-500">*</span></label>
                  <Input name="current_pin_code" value={newStaff.current_pin_code} onChange={handleTextChange} placeholder="PIN Code" required />
                  {formErrors.current_pin_code && <p className="text-[10px] text-red-500 font-semibold">{formErrors.current_pin_code}</p>}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4">
                <input 
                  type="checkbox" 
                  id="same_as_current" 
                  name="same_as_current" 
                  checked={newStaff.same_as_current === 1}
                  onChange={handleCheckboxChange}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <label htmlFor="same_as_current" className="text-xs font-bold text-text-primary uppercase select-none cursor-pointer">Permanent Address Same as Current Address</label>
              </div>

              {newStaff.same_as_current === 0 && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-[11px] font-extrabold text-text-secondary uppercase tracking-tight">Permanent Address</h4>
                  <div className="space-y-1.5 w-full p-px">
                    <label className="text-xs font-bold text-text-secondary uppercase">Address Line <span className="text-red-500">*</span></label>
                    <Input name="permanent_address_line" value={newStaff.permanent_address_line} onChange={handleTextChange} placeholder="House no, street, locality..." required />
                    {formErrors.permanent_address_line && <p className="text-[10px] text-red-500 font-semibold">{formErrors.permanent_address_line}</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <SearchableSelect
                      label="State"
                      placeholder="Select State..."
                      value={newStaff.permanent_state}
                      onChange={(val) => handleStateChange('permanent', val)}
                      options={Object.keys(INDIAN_STATES_AND_CITIES)}
                      required
                      error={formErrors.permanent_state}
                    />
                    <SearchableSelect
                      label="City"
                      placeholder="Select City..."
                      value={newStaff.permanent_city}
                      onChange={(val) => handleCityChange('permanent', val)}
                      options={newStaff.permanent_state ? (INDIAN_STATES_AND_CITIES[newStaff.permanent_state] || []) : []}
                      required
                      error={formErrors.permanent_city}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Country</label>
                      <Input name="permanent_country" value={newStaff.permanent_country} readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">PIN Code <span className="text-red-500">*</span></label>
                      <Input name="permanent_pin_code" value={newStaff.permanent_pin_code} onChange={handleTextChange} placeholder="PIN Code" required />
                      {formErrors.permanent_pin_code && <p className="text-[10px] text-red-500 font-semibold">{formErrors.permanent_pin_code}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload Documents */}
          <div className="space-y-4 pb-4">
            <h3 className="text-sm font-black text-text-primary tracking-tight font-display">Upload Documents</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-zinc-50 dark:bg-zinc-900/20 p-4 rounded-xl border border-border">
              <div className="space-y-1.5 col-span-1">
                <label className="text-xs font-bold text-text-secondary uppercase">Document Category</label>
                <Select value={docCategory} onChange={e => setDocCategory(e.target.value)}>
                  {DOCUMENT_CATEGORIES.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-xs font-bold text-text-secondary uppercase">Choose File (PDF, JPG, PNG, DOC, DOCX up to 10MB)</label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-text-secondary bg-surface hover:bg-zinc-50 cursor-pointer shadow-2xs transition-all">
                    <span className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Select Document</span>
                    <input 
                      type="file" 
                      disabled={uploadingDoc}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleDocUpload}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Document progress state */}
            {uploadingDoc && (
              <div className="flex items-center gap-2 text-xs text-text-muted mt-2 font-bold animate-pulse p-2 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-lg">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary"></div>
                <span>Uploading document... Please wait...</span>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-xs font-semibold">
                {uploadError}
              </div>
            )}

            {/* Document list */}
            {newStaff.documents.length > 0 && (
              <div className="overflow-x-auto border border-border rounded-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Document</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Upload Date</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary">Size</TableHead>
                      <TableHead className="text-xs uppercase font-extrabold text-text-secondary">View</TableHead>
                      <TableHead className="text-right text-xs uppercase font-extrabold text-text-secondary">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newStaff.documents.map((doc, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-semibold text-text-primary text-xs">{doc.category}</TableCell>
                        <TableCell className="text-xs text-text-muted">{formatDateTime(doc.upload_date)}</TableCell>
                        <TableCell className="text-xs text-text-muted font-mono">{formatBytes(doc.file_size)}</TableCell>
                        <TableCell>
                          <a 
                            href={doc.file_path.startsWith('http') ? doc.file_path : doc.file_path} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[10px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/10 px-2 py-1 rounded"
                          >
                            View
                          </a>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            type="button" 
                            variant="destructive"
                            onClick={() => handleRemoveDoc(idx)}
                            className="h-7 w-7 p-0 flex items-center justify-center bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded ml-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* Salary Card Modals */}
      {isDisburseDialogOpen && (
        <Dialog
          isOpen={isDisburseDialogOpen}
          onClose={() => {
            if (!actionLoading) {
              setIsDisburseDialogOpen(false);
              setActionError('');
            }
          }}
          title="Disburse Salary"
          description="Please confirm salary disbursement details below."
          className="max-w-md animate-in fade-in duration-200"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setIsDisburseDialogOpen(false);
                  setActionError('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmDisburse}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                {actionLoading ? 'Disbursing...' : 'Confirm Disbursement'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm mt-2">
            {actionError && (
              <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-red-500/25">
                <AlertCircle className="h-4 w-4" /> {actionError}
              </div>
            )}
            <p className="text-zinc-600 dark:text-zinc-400">You are about to disburse the salary for:</p>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border space-y-3 font-medium">
              <div className="flex justify-between">
                <span className="text-zinc-500">Teacher:</span>
                <span className="text-text-primary font-bold">{teacherDetails?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Month:</span>
                <span className="text-text-primary font-bold">{disburseMonth} {academicYears.find(y => y.is_current)?.name || academicYears.find(y => y.status === 'Draft')?.name || ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount:</span>
                <span className="text-green-600 font-extrabold">₹{parseFloat(teacherDetails?.salary || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-normal">This action will record the salary payment.</p>
          </div>
        </Dialog>
      )}

      {isPrevYearDisburseOpen && (
        <Dialog
          isOpen={isPrevYearDisburseOpen}
          onClose={() => {
            if (!actionLoading) {
              setIsPrevYearDisburseOpen(false);
              setActionError('');
            }
          }}
          title="Disburse Previous Year Salary"
          description="Please confirm previous year salary disbursement details below."
          className="max-w-md animate-in fade-in duration-200"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setIsPrevYearDisburseOpen(false);
                  setActionError('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmPrevYearDisburse}
                disabled={actionLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {actionLoading ? 'Disbursing...' : 'Confirm Disbursement'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm mt-2">
            {actionError && (
              <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-red-500/25">
                <AlertCircle className="h-4 w-4" /> {actionError}
              </div>
            )}
            <p className="text-zinc-600 dark:text-zinc-400">You are about to disburse outstanding salary for:</p>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border space-y-3 font-medium">
              <div className="flex justify-between">
                <span className="text-zinc-500">Teacher:</span>
                <span className="text-text-primary font-bold">{teacherDetails?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Academic Year:</span>
                <span className="text-text-primary font-bold">{teacherDetails?.previous_year_pending?.academic_year_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Months:</span>
                <span className="text-text-primary font-bold">{prevYearDisburseMonths.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Amount:</span>
                <span className="text-amber-600 font-extrabold">₹{parseFloat(prevYearDisburseTotal).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-normal">This action will record the salary payment inside the current academic year as an expense.</p>
          </div>
        </Dialog>
      )}

      {isRevertDialogOpen && (
        <Dialog
          isOpen={isRevertDialogOpen}
          onClose={() => {
            if (!actionLoading) {
              setIsRevertDialogOpen(false);
              setActionError('');
            }
          }}
          title="Revert Salary Payment"
          description="Please confirm if you want to revert this salary disbursement."
          className="max-w-md animate-in fade-in duration-200"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setIsRevertDialogOpen(false);
                  setActionError('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleConfirmRevert}
                disabled={actionLoading}
                className="font-bold"
              >
                {actionLoading ? 'Reverting...' : 'Confirm Revert'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm mt-2">
            {actionError && (
              <div className="p-3 bg-red-500/10 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-red-500/25">
                <AlertCircle className="h-4 w-4" /> {actionError}
              </div>
            )}
            <p className="text-zinc-600 dark:text-zinc-400">You are about to revert the salary payment for:</p>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-border space-y-3 font-medium">
              <div className="flex justify-between">
                <span className="text-zinc-500">Teacher:</span>
                <span className="text-text-primary font-bold">{teacherDetails?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Month:</span>
                <span className="text-text-primary font-bold">{revertPayment?.payment_month} {academicYears.find(y => y.is_current)?.name || academicYears.find(y => y.status === 'Draft')?.name || ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount:</span>
                <span className="text-red-600 font-extrabold">₹{parseFloat(revertPayment?.amount_paid || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 leading-normal">This will remove the salary payment record and return the month to Pending status.</p>
          </div>
        </Dialog>
      )}

      {isSalarySlipOpen && selectedSlipPayment && (
        <Dialog
          isOpen={isSalarySlipOpen}
          onClose={() => setIsSalarySlipOpen(false)}
          title="Salary Slip Preview"
          description="View, print, or download the official salary payment slip."
          className="w-[95vw] md:max-w-3xl animate-in fade-in duration-200"
          footer={
            <div className="flex gap-3 justify-end w-full no-print-section">
              <Button variant="secondary" onClick={() => setIsSalarySlipOpen(false)}>Close</Button>
              <Button onClick={handleDownloadSalarySlip} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-2xs">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={handlePrintSalarySlip} className="bg-primary hover:bg-primary/95 text-white font-bold flex items-center gap-1.5 shadow-2xs">
                <Printer className="h-4 w-4" /> Print Slip
              </Button>
            </div>
          }
        >
          <div className="max-h-[70vh] overflow-y-auto p-4 bg-zinc-100 dark:bg-zinc-900 border border-border rounded-xl">
            <div 
              id="salary-slip-print-area" 
              className="w-full max-w-[210mm] bg-white p-8 text-zinc-950 font-sans shadow-lg rounded-sm border border-border flex flex-col justify-between select-text mx-auto my-2"
            >
              {/* Header / School details */}
              <div className="space-y-6">
                <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-950 text-white rounded-md flex items-center justify-center font-bold text-2xl flex-shrink-0 shadow-2xs select-none">
                      {schoolProfile?.name ? schoolProfile.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-zinc-950 tracking-tight leading-none uppercase">{schoolProfile?.name || 'ABC Public School'}</h1>
                      <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-extrabold">Teacher Payout Payslip</p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-zinc-600 leading-normal">
                    <p className="font-bold text-zinc-950">{schoolProfile?.street_address || '123 Main Street'}</p>
                    <p>{schoolProfile?.city || 'City'}, {schoolProfile?.state || 'State'} - {schoolProfile?.pin_code || ''}</p>
                    <p>Phone: {schoolProfile?.contact_phone || '—'}</p>
                  </div>
                </div>

                {/* Payslip details */}
                <div className="text-center py-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900 underline decoration-double underline-offset-4 font-display tracking-wider">SALARY SLIP - {selectedSlipPayment.payment_month.toUpperCase()}</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50 border border-zinc-200 p-4 rounded-lg font-medium text-zinc-800">
                  <div>
                    <p className="text-zinc-500">Teacher Name:</p>
                    <p className="text-zinc-950 font-bold text-sm mt-0.5">{teacherDetails?.name}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Employee ID:</p>
                    <p className="text-zinc-950 font-bold font-mono text-sm mt-0.5">{teacherDetails?.employee_id || '—'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Designation / Subject:</p>
                    <p className="text-zinc-950 font-bold mt-0.5">{teacherDetails?.role || 'Teacher'} · {teacherDetails?.department || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Academic Year:</p>
                    <p className="text-zinc-950 font-bold mt-0.5">{
                      academicYears.find(y => y.id === selectedSlipPayment.academic_year_id)?.name || academicYears.find(y => y.is_current)?.name || academicYears.find(y => y.status === 'Draft')?.name || ''
                    }</p>
                  </div>
                </div>

                {/* Salary calculation / summary */}
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 font-extrabold text-zinc-700">
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-zinc-100 text-zinc-800 font-medium">
                        <td className="p-3">Basic Monthly Salary (Disbursed)</td>
                        <td className="p-3 text-right font-semibold">₹{parseFloat(selectedSlipPayment.amount_paid).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="bg-zinc-50 font-bold text-zinc-950 border-t-2 border-zinc-200 text-sm">
                        <td className="p-3">Net Disbursed Amount</td>
                        <td className="p-3 text-right text-green-700 font-extrabold">₹{parseFloat(selectedSlipPayment.amount_paid).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[10px] text-zinc-500 pt-4 border-t border-dashed border-zinc-200 font-medium">
                  <div>
                    <p>Payment Date: <span className="text-zinc-800 font-bold">{formatDate(selectedSlipPayment.payment_date)}</span></p>
                    <p>Payment Transaction ID: <span className="text-zinc-800 font-mono font-bold">TXN-SL-{String(selectedSlipPayment.id).padStart(5, '0')}</span></p>
                  </div>
                  <div className="text-right">
                    <p>Slip Generated Date: <span className="text-zinc-800 font-bold">{formatDate(new Date().toISOString().split('T')[0])}</span></p>
                    <p>Payment Status: <span className="text-green-600 font-black uppercase">PAID</span></p>
                  </div>
                </div>
              </div>

              {/* Principal Signature Signoff */}
              <div className="pt-16 flex justify-end">
                <div className="text-center w-40 text-xs text-zinc-700">
                  <div className="border-b border-zinc-400 h-10 w-full mb-2"></div>
                  <p className="font-bold text-zinc-900">Principal Signature</p>
                  <p className="text-[10px] text-zinc-500">School Administration</p>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Experience Letter Preview Dialog Modal */}
      <Dialog 
        isOpen={isExpLetterOpen} 
        onClose={() => setIsExpLetterOpen(false)}
        title="Experience Letter Preview" 
        description="Verify calculations, dynamic date formatting, and school letterhead branding layout before printing."
        className="w-[95vw] md:max-w-4xl"
        footer={<div className="flex gap-3 justify-end w-full no-print-section">
          <Button variant="secondary" onClick={() => setIsExpLetterOpen(false)}>Close</Button>
          <Button onClick={handleDownloadPDF} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-2xs">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button onClick={handlePrintExpLetter} className="bg-primary hover:bg-primary/95 text-white font-bold flex items-center gap-1.5 shadow-2xs">
            <Printer className="h-4 w-4" /> Print Letter
          </Button>
        </div>}
      >
        {/* Isolated style injector for media print margins override */}
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />
        
        <div className="max-h-[60vh] overflow-y-auto p-4 bg-zinc-100 dark:bg-zinc-900 border border-border rounded-xl flex items-center justify-center">
          
          {/* Printable Container in A4 Ratio */}
          <div 
            id="experience-letter-print-area" 
            className="w-full max-w-[210mm] h-[296mm] bg-white p-[15mm] text-zinc-950 font-serif shadow-lg rounded-sm border border-border flex flex-col justify-between select-text mx-auto"
          >
            {/* Header / School details */}
            <div className="space-y-4">
              <div className="flex items-center justify-center border-b-2 border-zinc-950 pb-4">
                <div className="flex items-center gap-4">
                  {/* Default academic crest logo */}
                  <div className="w-16 h-16 bg-zinc-950 text-white rounded-md flex items-center justify-center font-bold text-3xl font-display flex-shrink-0 shadow-2xs select-none">
                    {schoolProfile?.name ? schoolProfile.name.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <div>
                    <h1 className="text-2xl font-black font-display text-zinc-950 tracking-tight leading-none uppercase">{schoolProfile?.name || 'ABC Public School'}</h1>
                    <p className="text-[10px] font-sans font-extrabold text-zinc-500 mt-1 uppercase tracking-wider">Official Certificate of Service</p>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center py-6">
                <h2 className="text-xl font-bold uppercase tracking-widest text-zinc-900">To Whom It May Concern</h2>
              </div>

              {/* Date only */}
              <div className="flex items-center justify-end text-xs font-sans text-zinc-700 px-1">
                <p><strong>Date:</strong> <span className="text-zinc-900 font-bold">{formatDateFull(new Date())}</span></p>
              </div>

              {/* Letter Body */}
              <div className="text-sm text-zinc-800 leading-relaxed space-y-6 pt-6 text-justify">
                <p>
                  This is to certify that <strong>Mr./Ms. {teacherDetails?.name}</strong>, son/daughter of <strong>Mr. {teacherDetails?.father_name || 'Mohammad Akram'}</strong>, was employed with <strong>{schoolProfile?.name || 'ABC Public School'}</strong> as a <strong>Teacher</strong> teaching the subject of <strong>{teacherDetails?.department || 'Mathematics'}</strong> from <strong>{formatDateFull(teacherDetails?.joining_date)}</strong> to <strong>{formatDateFull(teacherDetails?.exit_date)}</strong>.
                </p>
                <p>
                  During his/her tenure of service, he/she carried out the assigned responsibilities sincerely, maintained professional conduct, demonstrated dedication toward students, and contributed positively to the academic environment of the school.
                </p>
                <p>
                  His/Her total experience with our institution is calculated as <strong>{calculateExperience(teacherDetails?.joining_date, teacherDetails?.exit_date)}</strong>.
                </p>
                <p>
                  We highly appreciate his/her valuable services and contribution during the tenure and wish him/her success in all future endeavors.
                </p>
              </div>
            </div>

            {/* Signatures & Seal */}
            <div className="pt-10">
              <div className="flex items-end justify-between px-2 text-xs font-sans text-zinc-700">
                <div className="text-center w-40">
                  <div className="border-b border-zinc-400 h-10 w-full mb-2"></div>
                  <p className="font-bold text-zinc-900">Principal Signature</p>
                  <p className="text-[10px] text-zinc-500">Authorized Official</p>
                </div>
                
                {/* Visual Seal stamp */}
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-zinc-400 flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center rotate-12 select-none pointer-events-none">
                  School Seal
                </div>

                <div className="text-center w-40">
                  <div className="border-b border-zinc-400 h-10 w-full mb-2"></div>
                  <p className="font-bold text-zinc-900">Authorized Signatory</p>
                  <p className="text-[10px] text-zinc-500">School Administration</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </Dialog>

    </div>
  );
}
