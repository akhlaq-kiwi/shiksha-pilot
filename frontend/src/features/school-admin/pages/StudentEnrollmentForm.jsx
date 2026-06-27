import React, { useState, useEffect } from 'react';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardContent } from '../../../common/ui/card';
import { schoolService } from '../../../common/services/schoolService';
import { ArrowLeft, Upload, Check, AlertCircle, Calendar } from 'lucide-react';

export default function StudentEnrollmentForm({ studentId, onCancel, onSuccess }) {
  const [academicYears, setAcademicYears] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadStates, setUploadStates] = useState({});
  
  // Selection helpers for Class and Section
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSectionName, setSelectedSectionName] = useState('');
  const [availableSections, setAvailableSections] = useState([]);

  const [formData, setFormData] = useState({
    // Student Info
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: '',
    dob: '',
    blood_group: '',
    category: '',
    religion: '',
    aadhaar_no: '',
    student_mobile: '',
    student_email: '',
    
    // Academic Info
    academic_year_id: '',
    admission_date: '',
    class_id: '',
    class_name: '',
    roll_no: '',
    sr_no: '',
    status: 'ACTIVE',
    exit_date: '',

    // Parent Info
    father_name: '',
    mother_name: '',
    parent_occupation: '',

    // Address
    current_address_line: '',
    current_city: '',
    current_state: '',
    current_country: '',
    current_pin_code: '',
    permanent_address_line: '',
    permanent_city: '',
    permanent_state: '',
    permanent_country: '',
    permanent_pin_code: '',
    same_as_current: 0,

    // Docs
    photo_path: '',
    birth_cert_path: '',
    aadhaar_path: '',
    transfer_cert_path: '',
    report_card_path: '',
    additional_docs_path: '',
  });

  useEffect(() => {
    const loadFormDependencies = async () => {
      setLoading(true);
      try {
        const [years, classes] = await Promise.all([
          schoolService.getAcademicYears(),
          schoolService.getClasses()
        ]);
        
        // Sort years by start_date to determine the first session
        const sortedYears = (years || []).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setAcademicYears(sortedYears);
        setClassesList(classes || []);

        if (studentId) {
          // Edit mode: fetch existing details
          const detail = await schoolService.getStudentById(studentId);
          if (detail && detail.student) {
            const studentData = detail.student;
            setFormData({
              ...studentData,
              exit_date: studentData.exit_date || '',
              class_name: studentData.class_name || '',
              parent_occupation: studentData.father_occupation || ''
            });

            // Resolve Class Name and Section from class_id
            const currentClass = (classes || []).find(c => c.id === studentData.class_id);
            if (currentClass) {
              setSelectedClassName(currentClass.name);
              const sections = (classes || [])
                .filter(c => c.name === currentClass.name && c.section)
                .map(c => c.section)
                .sort();
              setAvailableSections(sections);
              if (currentClass.section) {
                setSelectedSectionName(currentClass.section);
              }
            }
          }
        } else {
          // Pre-select current academic year and today's date if possible
          const currentYear = years.find(y => y.is_current);
          setFormData(prev => ({
            ...prev,
            academic_year_id: currentYear ? currentYear.id : (years[0]?.id || ''),
            admission_date: new Date().toISOString().split('T')[0]
          }));
        }
      } catch (err) {
        console.error('Error loading form configurations:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFormDependencies();
  }, [studentId]);

  // Determine if manual SR entry is allowed
  const isFirstYear = academicYears.length <= 1 || (formData.academic_year_id && 
    parseInt(formData.academic_year_id) === academicYears[0]?.id);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Enforces numeric-only digits on text change for specified fields
  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    const cleanValue = value.replace(/\D/g, ''); // strip any non-digit character
    setFormData(prev => ({
      ...prev,
      [name]: cleanValue
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handles dynamic dropdown changes for Classes and Sections
  const handleClassChange = (e) => {
    const val = e.target.value;
    setSelectedClassName(val);
    setSelectedSectionName('');
    
    if (errors.class_name) {
      setErrors(prev => ({ ...prev, class_name: null }));
    }

    // Filter available sections for the chosen class name
    const sections = classesList
      .filter(c => c.name === val && c.section)
      .map(c => c.section)
      .sort();
    
    setAvailableSections(sections);

    if (sections.length === 0) {
      // Direct mapping to ID if there are no sections
      const match = classesList.find(c => c.name === val && !c.section);
      setFormData(prev => ({
        ...prev,
        class_id: match ? match.id : '',
        class_name: match ? match.name : ''
      }));
    } else {
      // Clear class_id until section is chosen
      setFormData(prev => ({
        ...prev,
        class_id: '',
        class_name: ''
      }));
    }
  };

  const handleSectionChange = (e) => {
    const val = e.target.value;
    setSelectedSectionName(val);
    
    if (errors.section_name) {
      setErrors(prev => ({ ...prev, section_name: null }));
    }

    // Map to specific class ID matching the selected section
    const match = classesList.find(c => c.name === selectedClassName && c.section === val);
    setFormData(prev => ({
      ...prev,
      class_id: match ? match.id : '',
      class_name: match ? match.name : ''
    }));
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    const value = checked ? 1 : 0;
    
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // If Same as Current Address is checked, clone address details
      if (name === 'same_as_current' && checked) {
        updated.permanent_address_line = prev.current_address_line;
        updated.permanent_city = prev.current_city;
        updated.permanent_state = prev.current_state;
        updated.permanent_country = prev.current_country;
        updated.permanent_pin_code = prev.current_pin_code;
      }
      return updated;
    });
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStates(prev => ({ ...prev, [fieldName]: 'uploading' }));
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      
      const res = await schoolService.uploadDocument(uploadData);
      setFormData(prev => ({ ...prev, [fieldName]: res.url }));
      setUploadStates(prev => ({ ...prev, [fieldName]: 'done' }));
    } catch (err) {
      console.error(err);
      setUploadStates(prev => ({ ...prev, [fieldName]: 'error' }));
    }
  };

  const validateTab = (tabNum) => {
    const errs = {};
    if (tabNum === 1) {
      if (!formData.first_name) errs.first_name = 'First name is required';
      if (!formData.last_name) errs.last_name = 'Last name is required';
      if (!formData.gender) errs.gender = 'Gender is required';
      if (!formData.dob) errs.dob = 'Date of birth is required';
      
      // Dropdown Validations
      if (!selectedClassName) {
        errs.class_name = 'Class is required';
      }
      if (availableSections.length > 0 && !selectedSectionName) {
        errs.section_name = 'Section is required';
      }
      
      // Numeric Validations
      if (isFirstYear && !formData.sr_no) {
        errs.sr_no = 'SR Number is required for the first session';
      } else if (isFirstYear && formData.sr_no && !/^\d+$/.test(formData.sr_no)) {
        errs.sr_no = 'Only numeric digits are allowed.';
      }

      if (formData.student_mobile && !/^\d+$/.test(formData.student_mobile)) {
        errs.student_mobile = 'Only numeric digits are allowed.';
      }

      if (formData.roll_no && !/^\d+$/.test(formData.roll_no)) {
        errs.roll_no = 'Only numeric digits are allowed.';
      }

      if (formData.aadhaar_no && !/^\d+$/.test(formData.aadhaar_no)) {
        errs.aadhaar_no = 'Only numeric digits are allowed.';
      }
    }
    
    if (tabNum === 2) {
      if (!formData.father_name) errs.father_name = 'Father name is required';
      if (!formData.mother_name) errs.mother_name = 'Mother name is required';
      if (!formData.current_address_line) errs.current_address_line = 'Current address is required';
      if (!formData.current_city) errs.current_city = 'Current city is required';
      if (!formData.current_state) errs.current_state = 'Current state is required';
      if (!formData.current_pin_code) errs.current_pin_code = 'Current PIN Code is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateTab(activeTab)) {
      setActiveTab(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setActiveTab(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateTab(1) || !validateTab(2)) {
      setActiveTab(1);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      if (studentId) {
        await schoolService.updateStudent(studentId, formData);
      } else {
        await schoolService.createStudent(formData);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('{')) {
        try {
          setErrors(JSON.parse(err.message));
        } catch {
          setErrors({ form: err.message });
        }
      } else {
        setErrors({ form: err.message || 'An error occurred during submission.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Extract unique class names for select dropdown list
  const uniqueClassNames = Array.from(new Set(classesList.map(c => c.name)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button 
          type="button" 
          onClick={onCancel} 
          className="font-bold text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800 bg-surface hover:bg-zinc-50 px-4 py-2 rounded-lg text-sm transition-all shadow-2xs"
        >
          Back
        </button>
      </div>

      {errors.form && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{errors.form}</span>
        </div>
      )}

      {/* Tabs list (4 steps sequence) */}
      <div className="flex border-b border-border text-sm overflow-x-auto whitespace-nowrap scrollbar-none gap-4">
        {[
          { num: 1, label: '1. Student & Academic' },
          { num: 2, label: '2. Parents & Address' },
          { num: 3, label: '3. Document Uploads' },
          { num: 4, label: '4. Review & Submit' }
        ].map(t => (
          <button
            key={t.num}
            type="button"
            onClick={() => {
              // Ensure we check validation of prior steps before skipping tabs
              if (t.num > activeTab) {
                if (activeTab === 1 && !validateTab(1)) return;
                if (activeTab === 2 && !validateTab(2)) return;
              }
              setActiveTab(t.num);
            }}
            className={`pb-3 font-bold border-b-2 transition-all ${activeTab === t.num ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            
            {/* Tab 1: Student & Academic */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Student Information</h3>
                  
                  {/* Continuous inputs grid: Student Details and Academic Details merged directly together */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">First Name <span className="text-red-500">*</span></label>
                      <Input name="first_name" value={formData.first_name} onChange={handleTextChange} placeholder="First name" required />
                      {errors.first_name && <p className="text-[10px] text-red-500 font-semibold">{errors.first_name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Middle Name (Optional)</label>
                      <Input name="middle_name" value={formData.middle_name} onChange={handleTextChange} placeholder="Middle name" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Last Name <span className="text-red-500">*</span></label>
                      <Input name="last_name" value={formData.last_name} onChange={handleTextChange} placeholder="Last name" required />
                      {errors.last_name && <p className="text-[10px] text-red-500 font-semibold">{errors.last_name}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Gender <span className="text-red-500">*</span></label>
                      <select 
                        name="gender" 
                        value={formData.gender} 
                        onChange={handleTextChange} 
                        required 
                        className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                      >
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      {errors.gender && <p className="text-[10px] text-red-500 font-semibold">{errors.gender}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Date of Birth <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Input 
                          type="date" 
                          name="dob" 
                          value={formData.dob} 
                          onChange={handleTextChange} 
                          required 
                          className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer font-normal text-text-primary"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                      </div>
                      {errors.dob && <p className="text-[10px] text-red-500 font-semibold">{errors.dob}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Blood Group</label>
                      <select 
                        name="blood_group" 
                        value={formData.blood_group} 
                        onChange={handleTextChange}
                        className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                      >
                        <option value="">Select...</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Category</label>
                      <select 
                        name="category" 
                        value={formData.category} 
                        onChange={handleTextChange}
                        className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                      >
                        <option value="">Select...</option>
                        <option value="General">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Religion</label>
                      <Input name="religion" value={formData.religion} onChange={handleTextChange} placeholder="e.g. Hinduism" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Aadhaar Number</label>
                      <Input name="aadhaar_no" value={formData.aadhaar_no} onChange={handleNumericChange} placeholder="12 digit Aadhaar" />
                      {errors.aadhaar_no && <p className="text-[10px] text-red-500 font-semibold">{errors.aadhaar_no}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Student Mobile</label>
                      <Input name="student_mobile" value={formData.student_mobile} onChange={handleNumericChange} placeholder="Contact number" />
                      {errors.student_mobile && <p className="text-[10px] text-red-500 font-semibold">{errors.student_mobile}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Student Email</label>
                      <Input type="email" name="student_email" value={formData.student_email} onChange={handleTextChange} placeholder="student@domain.com" />
                      {errors.student_email && <p className="text-[10px] text-red-500 font-semibold">{errors.student_email}</p>}
                    </div>
                  </div>

                  {/* Dynamic Class & Section Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Class <span className="text-red-500">*</span></label>
                      <select
                        value={selectedClassName}
                        onChange={handleClassChange}
                        required
                        className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                      >
                        <option value="">Select Class...</option>
                        {uniqueClassNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      {errors.class_name && <p className="text-[10px] text-red-500 font-semibold">{errors.class_name}</p>}
                    </div>

                    {availableSections.length > 0 && (
                      <div className="space-y-1.5 animate-in slide-in-from-left-1 duration-150">
                        <label className="text-xs font-bold text-text-secondary uppercase">Section <span className="text-red-500">*</span></label>
                        <select
                          value={selectedSectionName}
                          onChange={handleSectionChange}
                          required
                          className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                        >
                          <option value="">Select Section...</option>
                          {availableSections.map(sec => (
                            <option key={sec} value={sec}>{sec}</option>
                          ))}
                        </select>
                        {errors.section_name && <p className="text-[10px] text-red-500 font-semibold">{errors.section_name}</p>}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Roll Number</label>
                      <Input name="roll_no" value={formData.roll_no} onChange={handleNumericChange} placeholder="e.g. 21" />
                      {errors.roll_no && <p className="text-[10px] text-red-500 font-semibold">{errors.roll_no}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">SR Number {isFirstYear && <span className="text-red-500">*</span>}</label>
                      <Input 
                        name="sr_no" 
                        value={isFirstYear ? formData.sr_no : ''} 
                        onChange={handleNumericChange} 
                        placeholder={isFirstYear ? "Enter SR Number" : "Auto-Generated"} 
                        disabled={!isFirstYear}
                        className={!isFirstYear ? 'bg-zinc-50 dark:bg-zinc-900 border-dashed cursor-not-allowed text-text-muted font-bold shadow-none' : 'font-bold'}
                      />
                      {errors.sr_no && <p className="text-[10px] text-red-500 font-semibold">{errors.sr_no}</p>}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Tab 2: Parents & Address */}
            {activeTab === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Parent Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Father Name <span className="text-red-500">*</span></label>
                      <Input name="father_name" value={formData.father_name} onChange={handleTextChange} placeholder="Father name" required />
                      {errors.father_name && <p className="text-[10px] text-red-500 font-semibold">{errors.father_name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Mother Name <span className="text-red-500">*</span></label>
                      <Input name="mother_name" value={formData.mother_name} onChange={handleTextChange} placeholder="Mother name" required />
                      {errors.mother_name && <p className="text-[10px] text-red-500 font-semibold">{errors.mother_name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Parent Occupation</label>
                      <Input name="parent_occupation" value={formData.parent_occupation} onChange={handleTextChange} placeholder="e.g. Government Employee" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Current Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Address Line <span className="text-red-500">*</span></label>
                      <Input name="current_address_line" value={formData.current_address_line} onChange={handleTextChange} placeholder="House no, street, locality..." required />
                      {errors.current_address_line && <p className="text-[10px] text-red-500 font-semibold">{errors.current_address_line}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">City <span className="text-red-500">*</span></label>
                      <Input name="current_city" value={formData.current_city} onChange={handleTextChange} placeholder="City" required />
                      {errors.current_city && <p className="text-[10px] text-red-500 font-semibold">{errors.current_city}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">State <span className="text-red-500">*</span></label>
                      <Input name="current_state" value={formData.current_state} onChange={handleTextChange} placeholder="State" required />
                      {errors.current_state && <p className="text-[10px] text-red-500 font-semibold">{errors.current_state}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Country</label>
                      <Input name="current_country" value={formData.current_country || 'India'} onChange={handleTextChange} placeholder="Country" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">PIN Code <span className="text-red-500">*</span></label>
                      <Input name="current_pin_code" value={formData.current_pin_code} onChange={handleNumericChange} placeholder="ZIP/PIN" required />
                      {errors.current_pin_code && <p className="text-[10px] text-red-500 font-semibold">{errors.current_pin_code}</p>}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <input 
                      type="checkbox" 
                      id="same_as_current" 
                      name="same_as_current" 
                      checked={formData.same_as_current === 1}
                      onChange={handleCheckboxChange}
                      className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="same_as_current" className="text-xs font-bold text-text-primary uppercase select-none cursor-pointer">Permanent Address Same as Current Address</label>
                  </div>

                  {formData.same_as_current === 0 && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-text-secondary uppercase">Permanent Address Line</label>
                          <Input name="permanent_address_line" value={formData.permanent_address_line} onChange={handleTextChange} placeholder="House no, street, locality..." />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-text-secondary uppercase">City</label>
                          <Input name="permanent_city" value={formData.permanent_city} onChange={handleTextChange} placeholder="City" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-text-secondary uppercase">State</label>
                          <Input name="permanent_state" value={formData.permanent_state} onChange={handleTextChange} placeholder="State" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-text-secondary uppercase">Country</label>
                          <Input name="permanent_country" value={formData.permanent_country} onChange={handleTextChange} placeholder="Country" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-text-secondary uppercase">PIN Code</label>
                          <Input name="permanent_pin_code" value={formData.permanent_pin_code} onChange={handleNumericChange} placeholder="ZIP/PIN" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Documents Upload */}
            {activeTab === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Student Records Upload</h3>
                  <p className="text-xs text-text-muted mb-4">Upload scanned copies/images of primary documentation. Accepted: PNG, JPG, PDF (Max 5MB).</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { key: 'photo_path', label: 'Student Photo' },
                      { key: 'birth_cert_path', label: 'Birth Certificate' },
                      { key: 'aadhaar_path', label: 'Aadhaar Card' },
                      { key: 'transfer_cert_path', label: 'Transfer Certificate (TC)' },
                      { key: 'report_card_path', label: 'Previous Report Card' },
                      { key: 'additional_docs_path', label: 'Additional Documents' }
                    ].map(doc => (
                      <div key={doc.key} className="flex flex-col gap-2 p-4 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/20">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-secondary uppercase">{doc.label}</span>
                          {formData[doc.key] && (
                            <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded font-black flex items-center gap-1">
                              <Check className="h-3 w-3" /> UPLOADED
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          <label className="cursor-pointer bg-surface border border-border px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-text-primary shadow-xs">
                            <Upload className="h-3.5 w-3.5" />
                            <span>{formData[doc.key] ? 'Change File' : 'Choose File'}</span>
                            <input 
                              type="file" 
                              onChange={(e) => handleFileUpload(e, doc.key)} 
                              className="hidden" 
                              accept=".png,.jpg,.jpeg,.pdf"
                            />
                          </label>
                          
                          {uploadStates[doc.key] === 'uploading' && (
                            <span className="text-[10px] text-text-muted animate-pulse font-medium">Uploading...</span>
                          )}
                          {uploadStates[doc.key] === 'error' && (
                            <span className="text-[10px] text-red-500 font-medium">Upload failed. Try again.</span>
                          )}
                          {formData[doc.key] && !uploadStates[doc.key] && (
                            <span className="text-[10px] text-text-muted truncate max-w-[200px]" title={formData[doc.key]}>
                              {formData[doc.key].split('/').pop()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Review & Submit */}
            {activeTab === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Review Enrollment Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-3">
                      <p className="border-l-2 border-primary pl-2.5 font-bold text-text-primary uppercase text-xs tracking-wider">Student Profile</p>
                      <div className="space-y-1 text-xs">
                        <p><span className="text-text-muted font-semibold inline-block w-28">Full Name:</span> <span className="font-bold text-text-primary">{formData.first_name} {formData.middle_name} {formData.last_name}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Gender / DOB:</span> <span>{formData.gender} / {formData.dob}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Aadhaar No:</span> <span className="font-mono">{formData.aadhaar_no || '-'}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Mobile:</span> <span>{formData.student_mobile || '-'}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Email:</span> <span>{formData.student_email || '-'}</span></p>
                      </div>

                      <p className="border-l-2 border-primary pl-2.5 font-bold text-text-primary uppercase text-xs tracking-wider mt-4">Academic Details</p>
                      <div className="space-y-1 text-xs">
                        <p><span className="text-text-muted font-semibold inline-block w-28">Academic Year:</span> <span>{academicYears.find(y => parseInt(formData.academic_year_id) === y.id)?.name || 'Current Session'}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Class Assigned:</span> <span>{selectedClassName} {selectedSectionName ? `- ${selectedSectionName}` : ''}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Roll No:</span> <span>{formData.roll_no || '-'}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">SR Number:</span> <span className="font-mono font-bold text-primary">{isFirstYear ? formData.sr_no : 'Auto-Generated'}</span></p>
                        {formData.exit_date && (
                          <p><span className="text-red-500 font-semibold inline-block w-28">Exit Date:</span> <span className="font-mono font-bold text-red-500">{formData.exit_date}</span></p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="border-l-2 border-indigo-500 pl-2.5 font-bold text-text-primary uppercase text-xs tracking-wider">Parent Info</p>
                      <div className="space-y-1 text-xs">
                        <p><span className="text-text-muted font-semibold inline-block w-28">Father Name:</span> <span className="font-semibold text-text-primary">{formData.father_name || '-'}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Mother Name:</span> <span className="font-semibold text-text-primary">{formData.mother_name || '-'}</span></p>
                        <p><span className="text-text-muted font-semibold inline-block w-28">Occupation:</span> <span className="font-semibold text-text-primary">{formData.parent_occupation || '-'}</span></p>
                      </div>

                      <p className="border-l-2 border-indigo-500 pl-2.5 font-bold text-text-primary uppercase text-xs tracking-wider mt-4">Address</p>
                      <p className="text-xs text-text-secondary bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg leading-relaxed border border-border">
                        {formData.current_address_line}, {formData.current_city}, {formData.current_state} - {formData.current_pin_code}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Footer buttons */}
        <div className="flex items-center justify-between mt-6">
          <div>
            {activeTab > 1 && (
              <Button type="button" variant="secondary" onClick={handlePrev}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            
            {/* Unique React keys prevent component reuse double-click submit event propagation */}
            {activeTab < 4 ? (
              <Button key="next-btn" type="button" onClick={handleNext}>
                Next Step
              </Button>
            ) : (
              <Button key="submit-btn" type="submit" disabled={submitting} className="font-bold">
                {submitting ? 'Saving...' : (studentId ? 'Save Changes' : 'Save Student')}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
