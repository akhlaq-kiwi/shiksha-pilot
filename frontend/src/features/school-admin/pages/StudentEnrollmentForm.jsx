import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../../../common/ui/dialog';
import { Button } from '../../../common/ui/button';
import { Input } from '../../../common/ui/input';
import { Card, CardContent } from '../../../common/ui/card';
import { FormErrorSummary } from '../../../common/ui/field';
import { schoolService } from '../../../common/services/schoolService';
import { ArrowLeft, Upload, Check, Calendar } from 'lucide-react';
import { getClassIndex } from '../../../common/constants/predefinedClasses';

const INDIAN_STATES_AND_CITIES = {
  "Andhra Pradesh": [
    "Anantapur", "Chittoor", "Eluru", "Guntur", "Kadapa", "Kakinada", "Kurnool", 
    "Machilipatnam", "Nellore", "Ongole", "Rajahmundry", "Srikakulam", "Tirupati", 
    "Vijayawada", "Visakhapatnam", "Vizianagaram"
  ],
  "Arunachal Pradesh": [
    "Along", "Bomdila", "Itanagar", "Naharlagun", "Pasighat", "Tawang", "Ziro"
  ],
  "Assam": [
    "Barpeta", "Bongaigaon", "Dibrugarh", "Guwahati", "Jorhat", "Karimganj", 
    "Nagaon", "Sibsagar", "Silchar", "Tezpur", "Tinsukia"
  ],
  "Bihar": [
    "Arrah", "Begusarai", "Bettiah", "Bhagalpur", "Bihar Sharif", "Chhapra", 
    "Darbhanga", "Gaya", "Hajipur", "Katihar", "Munger", "Muzaffarpur", "Patna", 
    "Purnia", "Saharsa", "Sasaram"
  ],
  "Chhattisgarh": [
    "Ambikapur", "Bhilai", "Bilaspur", "Dhamtari", "Jagdalpur", "Korba", 
    "Raigarh", "Raipur", "Rajnandgaon"
  ],
  "Goa": [
    "Margao", "Marmagao", "Panaji", "Mapusa", "Ponda"
  ],
  "Gujarat": [
    "Ahmedabad", "Amreli", "Anand", "Bharuch", "Bhavnagar", "Bhuj", "Dahod", 
    "Gandhidham", "Gandhinagar", "Godhra", "Jamnagar", "Junagadh", "Morbi", 
    "Nadiad", "Navsari", "Patan", "Porbandar", "Rajkot", "Surat", "Surendranagar", 
    "Vadodara", "Valsad", "Vapi"
  ],
  "Haryana": [
    "Ambala", "Bahadurgarh", "Bhiwani", "Faridabad", "Gurugram", "Hisar", 
    "Jind", "Kaithal", "Karnal", "Panchkula", "Panipat", "Rewari", "Rohtak", 
    "Sirsa", "Sonipat", "Yamunanagar"
  ],
  "Himachal Pradesh": [
    "Bilaspur", "Chamba", "Dharamshala", "Hamirpur", "Kullu", "Mandi", "Nahan", 
    "Shimla", "Solan", "Una"
  ],
  "Jharkhand": [
    "Bokaro Steel City", "Chaibasa", "Deoghar", "Dhanbad", "Dumka", "Giridih", 
    "Hazaribagh", "Jamshedpur", "Medininagar", "Phusro", "Ramgarh", "Ranchi"
  ],
  "Karnataka": [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru", "Bhadravati", "Bidar", 
    "Chikkamagaluru", "Chitradurga", "Davangere", "Dharwad", "Gadag", "Hassan", 
    "Hosapete", "Hubballi", "Kalaburagi", "Kolar", "Mandya", "Mangaluru", "Mysuru", 
    "Raichur", "Shivamogga", "Tumakuru", "Udupi", "Vijayapura"
  ],
  "Kerala": [
    "Alappuzha", "Kochi", "Kollam", "Kottayam", "Kozhikode", "Palakkad", 
    "Thalassery", "Thiruvananthapuram", "Thrissur"
  ],
  "Madhya Pradesh": [
    "Betul", "Bhind", "Bhopal", "Chhindwara", "Dewas", "Guna", "Gwalior", 
    "Indore", "Jabalpur", "Khandwa", "Khargone", "Mandsaur", "Morena", "Murwara", 
    "Ratlam", "Rewa", "Sagar", "Satna", "Sehore", "Shivpuri", "Singrauli", "Ujjain", 
    "Vidisha"
  ],
  "Maharashtra": [
    "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Baramati", "Bhandara", 
    "Bhiwandi", "Bhusawal", "Chandrapur", "Dhule", "Gondia", "Ichalkaranji", 
    "Jalgaon", "Jalna", "Kalyan-Dombivli", "Kolhapur", "Latur", "Mumbai", "Nagpur", 
    "Nanded", "Nandurbar", "Nashik", "Navi Mumbai", "Osmanabad", "Parbhani", "Pune", 
    "Sangli", "Satara", "Solapur", "Thane", "Ulhasnagar", "Vasai-Virar", "Wardha", 
    "Yavatmal"
  ],
  "Manipur": [
    "Bishnupur", "Churachandpur", "Imphal", "Senapati", "Thoubal"
  ],
  "Meghalaya": [
    "Jowai", "Nongstoin", "Shillong", "Tura"
  ],
  "Mizoram": [
    "Aizawl", "Champhai", "Kolasib", "Lunglei", "Saiha"
  ],
  "Nagaland": [
    "Dimapur", "Kohima", "Mokokchung", "Tuensang", "Wokha"
  ],
  "Odisha": [
    "Balangir", "Baleshwar", "Baripada", "Bhadrak", "Bhawanipatna", "Bhubaneswar", 
    "Cuttack", "Dhenkanal", "Jeypore", "Jharsuguda", "Puri", "Raurkela", "Sambalpur"
  ],
  "Punjab": [
    "Abohar", "Amritsar", "Barnala", "Bathinda", "Firozpur", "Hoshiarpur", 
    "Jalandhar", "Khanna", "Ludhiana", "Malerkotla", "Moga", "Mohali", "Muktsar", 
    "Pathankot", "Patiala", "Phagwara", "Sri Muktsar Sahib"
  ],
  "Rajasthan": [
    "Ajmer", "Alwar", "Bharatpur", "Bhilwara", "Bikaner", "Chittorgarh", 
    "Hanumangarh", "Jaipur", "Jaisalmer", "Jhalawar", "Jhunjhunu", "Jodhpur", 
    "Kishangarh", "Kota", "Pali", "Sikar", "Sri Ganganagar", "Tonk", "Udaipur"
  ],
  "Sikkim": [
    "Gangtok", "Gyalshing", "Mangan", "Namchi"
  ],
  "Tamil Nadu": [
    "Ambattur", "Avadi", "Chennai", "Coimbatore", "Dindigul", "Erode", 
    "Kancheepuram", "Karur", "Madurai", "Nagercoil", "Salem", "Thanjavur", 
    "Tiruchirappalli", "Tirunelveli", "Tiruppur", "Thoothukudi", "Vellore"
  ],
  "Telangana": [
    "Adilabad", "Hyderabad", "Karimnagar", "Khammam", "Mahbubnagar", "Miryalaguda", 
    "Nalgonda", "Nizamabad", "Ramagundam", "Secunderabad", "Suryapet", "Warangal"
  ],
  "Tripura": [
    "Agartala", "Belonia", "Dharmanagar", "Kailasahar", "Khowai", "Udaipur"
  ],
  "Uttar Pradesh": [
    "Agra", "Aligarh", "Allahabad (Prayagraj)", "Amroha", "Auraiya", "Azamgarh", 
    "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", 
    "Basti", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Deoria", "Etah", 
    "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", 
    "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", 
    "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur", "Kasganj", 
    "Kaushambi", "Kushinagar", "Lakhimpur Kheri", "Lalitpur", "Lucknow", "Maharajganj", 
    "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", 
    "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Rae Bareli", "Rampur", "Saharanpur", 
    "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", 
    "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"
  ],
  "Uttarakhand": [
    "Dehradun", "Haldwani", "Haridwar", "Kashipur", "Mussoorie", "Nainital", 
    "Pithoragarh", "Rishikesh", "Roorkee", "Rudrapur"
  ],
  "West Bengal": [
    "Asansol", "Baharampur", "Bally", "Baranagar", "Bardhaman", "Bhatpara", 
    "Gopalpur", "Habra", "Howrah", "Kamarhati", "Kharagpur", "Kolkata", 
    "Kulti", "Madhyamgram", "Maheshtala", "Malda", "Midnapore", "Naihati", 
    "Panihati", "Rajpur Sonarpur", "Siliguri", "South Dumdum", "Uluberia"
  ],
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  "Delhi": [
    "Delhi", "New Delhi", "Noida", "Gurugram", "Faridabad", "Ghaziabad", 
    "Dwarka", "Rohini", "Narela", "Saket"
  ],
  "Jammu and Kashmir": [
    "Anantnag", "Baramulla", "Jammu", "Kathua", "Srinagar", "Udhampur"
  ],
  "Ladakh": ["Kargil", "Leh"],
  "Lakshadweep": ["Kavaratti"],
  "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"]
};

function SearchableSelect({ label, placeholder, value, onChange, options, disabled, required, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch(value || '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="space-y-1.5 relative w-full">
      <label className="text-xs font-bold text-text-secondary uppercase">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        disabled={disabled}
        className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
      />
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-[60px] max-h-40 overflow-y-auto bg-surface border border-border rounded-md shadow-lg z-50 py-1 bg-white dark:bg-zinc-950 animate-in fade-in slide-in-from-top-1 duration-200">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No options found</div>
          ) : (
            filteredOptions.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setSearch(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-primary/10 transition-colors ${opt === value ? 'bg-primary/5 text-primary' : 'text-text-primary'}`}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-red-500 font-semibold">{error}</p>}
    </div>
  );
}

export default function StudentEnrollmentForm({ studentId, currentClassName, currentClassId, onCancel, onSuccess }) {
  const navigate = useNavigate();
  const [showLimitReached, setShowLimitReached] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadStates, setUploadStates] = useState({});
  const [backupPermanentAddress, setBackupPermanentAddress] = useState({
    permanent_address_line_1: '',
    permanent_address_line_2: '',
    permanent_city: '',
    permanent_state: '',
    permanent_country: 'India',
    permanent_pin_code: ''
  });
  
  // Selection helpers for Class and Section
  const [selectedClassName, setSelectedClassName] = useState(currentClassName || '');
  const [selectedSectionName, setSelectedSectionName] = useState('');
  const [availableSections, setAvailableSections] = useState([]);

  const [formData, setFormData] = useState({
    // Student Info
    student_name: '',
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
    admission_fee: '',
    student_category: '',
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
    current_address_line_1: '',
    current_address_line_2: '',
    current_address_line: '',
    current_city: '',
    current_state: '',
    current_country: '',
    current_pin_code: '',
    permanent_address_line_1: '',
    permanent_address_line_2: '',
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
            const cleanLastName = (studentData.last_name || '') === '.' ? '' : (studentData.last_name || '');
            const combinedName = [
              studentData.first_name || '',
              studentData.middle_name || '',
              cleanLastName
            ].filter(Boolean).join(' ');

            setFormData({
              ...studentData,
              student_name: combinedName,
              current_address_line_1: studentData.current_address_line || '',
              current_address_line_2: '',
              permanent_address_line_1: studentData.permanent_address_line || '',
              permanent_address_line_2: '',
              exit_date: studentData.exit_date || '',
              admission_fee: studentData.admission_fee !== null && studentData.admission_fee !== undefined ? String(studentData.admission_fee) : '',
              student_category: studentData.student_category || '',
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
          const currentYear = years.find(y => y.is_current) || years.find(y => y.status === 'Draft');
          setFormData(prev => ({
            ...prev,
            academic_year_id: currentYear ? currentYear.id : (years[0]?.id || ''),
            admission_date: (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })()
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

  // Helper to extract primitive roll_no from response
  const extractRollNoNumber = (data) => {
    if (data === null || data === undefined) return '';
    if (typeof data === 'number' || typeof data === 'string') return String(data);
    if (typeof data === 'object') {
      if (data.next_roll_no !== undefined && data.next_roll_no !== null) {
        return extractRollNoNumber(data.next_roll_no);
      }
      if (data.data !== undefined && data.data !== null) {
        return extractRollNoNumber(data.data);
      }
    }
    return '';
  };

  // Pre-fetch next available roll number for the class / section
  useEffect(() => {
    const fetchNextRollNo = async () => {
      if (formData.class_id && !studentId) {
        try {
          const res = await schoolService.getNextRollNo(formData.class_id);
          const nextVal = extractRollNoNumber(res);
          if (nextVal) {
            setFormData(prev => ({
              ...prev,
              roll_no: nextVal
            }));
          }
        } catch (err) {
          console.error('Failed to fetch next roll number:', err);
        }
      }
    };
    fetchNextRollNo();
  }, [formData.class_id, studentId]);


  // Set default class fields from props for new student
  useEffect(() => {
    if (!studentId && currentClassName && classesList.length > 0) {
      setSelectedClassName(currentClassName);

      // Filter available sections for the chosen class name
      const sections = classesList
        .filter(c => c.name === currentClassName && c.section)
        .map(c => c.section)
        .sort();
      setAvailableSections(sections);

      // Try to find the exact class row matching currentClassId
      const matchedClass = classesList.find(c => c.id === currentClassId);
      if (matchedClass) {
        if (matchedClass.section) {
          setSelectedSectionName(matchedClass.section);
          setFormData(prev => ({
            ...prev,
            class_name: currentClassName,
            class_id: currentClassId
          }));
        } else {
          // No section configured
          setSelectedSectionName('');
          setFormData(prev => ({
            ...prev,
            class_name: currentClassName,
            class_id: currentClassId
          }));
        }
      } else {
        // Fallback
        if (sections.length === 0) {
          const match = classesList.find(c => c.name === currentClassName && !c.section);
          setSelectedSectionName('');
          setFormData(prev => ({
            ...prev,
            class_name: currentClassName,
            class_id: match ? match.id : ''
          }));
        } else {
          // Has sections, clear class_id until section is chosen
          setSelectedSectionName('');
          setFormData(prev => ({
            ...prev,
            class_name: currentClassName,
            class_id: ''
          }));
        }
      }
    }
  }, [studentId, currentClassName, currentClassId, classesList]);

  // Determine if manual SR entry is allowed
  const isFirstYear = academicYears.length <= 1 || (formData.academic_year_id && 
    parseInt(formData.academic_year_id) === academicYears[0]?.id);

  const handleSrNoBlur = async () => {
    if (!isFirstYear || !formData.sr_no) return;
    
    if (!/^\d+$/.test(formData.sr_no)) {
      setErrors(prev => ({ ...prev, sr_no: 'Only numeric digits are allowed.' }));
      return;
    }
    if (parseInt(formData.sr_no, 10) <= 0) {
      setErrors(prev => ({ ...prev, sr_no: 'SR Number must be a positive integer.' }));
      return;
    }
    
    try {
      const isEdit = !!studentId;
      const res = await schoolService.checkSrNoExists({
        sr_no: formData.sr_no,
        exclude_id: isEdit ? studentId : undefined
      });
      if (res && res.exists) {
        setErrors(prev => ({
          ...prev,
          sr_no: 'SR Number already exists. Please enter a unique SR Number.'
        }));
      } else {
        setErrors(prev => ({ ...prev, sr_no: null }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'student_email') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!value || emailRegex.test(value.trim())) {
        setErrors(prev => ({ ...prev, student_email: null }));
      }
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Enforces numeric-only digits on text change for specified fields
  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    let cleanValue = value.replace(/\D/g, ''); // strip any non-digit character
    if (name === 'aadhaar_no') {
      cleanValue = cleanValue.slice(0, 12);
    }
    setFormData(prev => ({
      ...prev,
      [name]: cleanValue
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCurrentStateChange = (stateName) => {
    setFormData(prev => ({
      ...prev,
      current_state: stateName,
      current_city: ''
    }));
    if (errors.current_state) {
      setErrors(prev => ({ ...prev, current_state: null }));
    }
  };

  const handleCurrentCityChange = (cityName) => {
    setFormData(prev => ({
      ...prev,
      current_city: cityName
    }));
    if (errors.current_city) {
      setErrors(prev => ({ ...prev, current_city: null }));
    }
  };

  const handlePermanentStateChange = (stateName) => {
    setFormData(prev => ({
      ...prev,
      permanent_state: stateName,
      permanent_city: ''
    }));
  };

  const handlePermanentCityChange = (cityName) => {
    setFormData(prev => ({
      ...prev,
      permanent_city: cityName
    }));
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
      
      // If Same as Current Address is checked, clone address details after backing up existing values
      if (name === 'same_as_current') {
        if (checked) {
          setBackupPermanentAddress({
            permanent_address_line_1: prev.permanent_address_line_1 || '',
            permanent_address_line_2: prev.permanent_address_line_2 || '',
            permanent_city: prev.permanent_city || '',
            permanent_state: prev.permanent_state || '',
            permanent_country: prev.permanent_country || 'India',
            permanent_pin_code: prev.permanent_pin_code || ''
          });

          updated.permanent_address_line_1 = prev.current_address_line_1;
          updated.permanent_address_line_2 = prev.current_address_line_2;
          updated.permanent_city = prev.current_city;
          updated.permanent_state = prev.current_state;
          updated.permanent_country = prev.current_country;
          updated.permanent_pin_code = prev.current_pin_code;
        } else {
          updated.permanent_address_line_1 = backupPermanentAddress.permanent_address_line_1;
          updated.permanent_address_line_2 = backupPermanentAddress.permanent_address_line_2;
          updated.permanent_city = backupPermanentAddress.permanent_city;
          updated.permanent_state = backupPermanentAddress.permanent_state;
          updated.permanent_country = backupPermanentAddress.permanent_country;
          updated.permanent_pin_code = backupPermanentAddress.permanent_pin_code;
        }
      }
      return updated;
    });
  };

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset previous upload state for this field
    setUploadStates(prev => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });

    if (fieldName === 'photo_path') {
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      const fileExt = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(fileExt) || !file.type.startsWith('image/')) {
        setUploadStates(prev => ({ ...prev, photo_path: 'validation_error' }));
        return;
      }
    }

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
      if (!formData.student_name) errs.student_name = 'Student Name is required';
      if (!formData.father_name) errs.father_name = 'Father name is required';
      if (!formData.mother_name) errs.mother_name = 'Mother name is required';
      if (!formData.gender) errs.gender = 'Gender is required';
      if (!formData.dob) errs.dob = 'Date of birth is required';
      
      // Dropdown Validations
      if (!formData.academic_year_id) {
        errs.academic_year_id = 'Academic Session is required';
      }
      if (!formData.admission_date) {
        errs.admission_date = 'Admission Date is required';
      }
      if (formData.admission_fee !== '' && formData.admission_fee !== null && parseFloat(formData.admission_fee) < 0) {
        errs.admission_fee = 'Admission Fee cannot be negative.';
      }
      const isFirstYearSession = (academicYears || []).length <= 1 || (formData.academic_year_id && String(formData.academic_year_id) === String(academicYears[0]?.id));
      if (isFirstYearSession && !studentId && !formData.student_category) {
        errs.student_category = 'Student Category is required.';
      }
      if (!selectedClassName) {
        errs.class_name = 'Class is required';
      }
      if (availableSections.length > 0 && !selectedSectionName) {
        errs.section_name = 'Please select a section.';
      }
      
      if (isFirstYear) {
        if (!formData.sr_no) {
          errs.sr_no = 'SR Number is required';
        } else if (!/^\d+$/.test(formData.sr_no)) {
          errs.sr_no = 'Only numeric digits are allowed.';
        } else if (parseInt(formData.sr_no, 10) <= 0) {
          errs.sr_no = 'SR Number must be a positive integer.';
        }
      }

      if (!formData.student_mobile) {
        errs.student_mobile = 'Contact Number is required.';
      } else if (!/^\d+$/.test(formData.student_mobile)) {
        errs.student_mobile = 'Only numeric digits are allowed.';
      }

      if (formData.aadhaar_no && (!/^\d+$/.test(formData.aadhaar_no) || formData.aadhaar_no.length !== 12)) {
        errs.aadhaar_no = 'Aadhaar number must contain exactly 12 numeric digits.';
      }

      if (formData.student_email && formData.student_email.trim() !== '') {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(formData.student_email.trim())) {
          errs.student_email = 'Please enter a valid email address.';
        }
      }
    }
    
    if (tabNum === 2) {
      if (!formData.current_address_line_1) errs.current_address_line_1 = 'Current address is required';
      if (!formData.current_city) errs.current_city = 'Current city is required';
      if (!formData.current_state) errs.current_state = 'Current state is required';
      if (!formData.current_pin_code) errs.current_pin_code = 'Current PIN Code is required';

      if (formData.same_as_current === 0) {
        if (!formData.permanent_address_line_1) errs.permanent_address_line_1 = 'Permanent address is required.';
        if (!formData.permanent_city) errs.permanent_city = 'Permanent city is required.';
        if (!formData.permanent_state) errs.permanent_state = 'Permanent state is required.';
        if (!formData.permanent_pin_code) errs.permanent_pin_code = 'Permanent PIN Code is required.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTabChange = async (targetTabNum) => {
    if (targetTabNum === activeTab) return;

    if (targetTabNum > activeTab) {
      if (activeTab === 1 || (activeTab < 1 && targetTabNum > 1)) {
        const ok = validateTab(1);
        if (!ok) return;

        if (isFirstYear && formData.sr_no) {
          try {
            const isEdit = !!studentId;
            const res = await schoolService.checkSrNoExists({
              sr_no: formData.sr_no,
              exclude_id: isEdit ? studentId : undefined
            });
            if (res && res.exists) {
              setErrors(prev => ({
                ...prev,
                sr_no: 'SR Number already exists. Please enter a unique SR Number.'
              }));
              return;
            }
          } catch (err) {
            console.error(err);
          }
        }
      }

      if (activeTab === 2 || (activeTab < 2 && targetTabNum > 2)) {
        const ok = validateTab(2);
        if (!ok) return;
      }
    }

    setActiveTab(targetTabNum);
  };

  const handleNext = async () => {
    await handleTabChange(activeTab + 1);
  };

  const handlePrev = () => {
    setActiveTab(prev => prev - 1);
  };

  const splitName = (fullName) => {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { first_name: '', middle_name: '', last_name: '' };
    }
    if (parts.length === 1) {
      return {
        first_name: parts[0],
        middle_name: '',
        last_name: '.' // fallback to satisfy backend validation
      };
    }
    if (parts.length === 2) {
      return {
        first_name: parts[0],
        middle_name: '',
        last_name: parts[1]
      };
    }
    return {
      first_name: parts[0],
      middle_name: parts.slice(1, parts.length - 1).join(' '),
      last_name: parts[parts.length - 1]
    };
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
      const nameParts = splitName(formData.student_name);
      const isSame = formData.same_as_current === 1;
      const currentAddress = (formData.current_address_line_1 || '').trim() + 
        (formData.current_address_line_2 ? ', ' + formData.current_address_line_2.trim() : '');
      const permanentAddress = isSame 
        ? currentAddress 
        : ((formData.permanent_address_line_1 || '').trim() + 
           (formData.permanent_address_line_2 ? ', ' + formData.permanent_address_line_2.trim() : ''));

      const submitPayload = {
        ...formData,
        first_name: nameParts.first_name,
        middle_name: nameParts.middle_name,
        last_name: nameParts.last_name,
        current_address_line: currentAddress,
        permanent_address_line: permanentAddress,
        permanent_city: isSame ? formData.current_city : formData.permanent_city,
        permanent_state: isSame ? formData.current_state : formData.permanent_state,
        permanent_country: isSame ? (formData.current_country || 'India') : (formData.permanent_country || 'India'),
        permanent_pin_code: isSame ? formData.current_pin_code : formData.permanent_pin_code,
        class_id: formData.class_id,
        class_name: selectedClassName
      };

      if (studentId) {
        await schoolService.updateStudent(studentId, submitPayload);
      } else {
        await schoolService.createStudent(submitPayload);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      let fieldErrors = {};

      if (err.data && typeof err.data === 'object') {
        if (err.data.errors && typeof err.data.errors === 'object') {
          fieldErrors = { ...err.data.errors };
        } else {
          fieldErrors = { ...err.data };
        }
      }

      const msgLower = (err.message || '').toLowerCase();
      const isEmailErr = msgLower.includes('email');
      const isPhoneErr = msgLower.includes('phone') || msgLower.includes('contact') || msgLower.includes('mobile') || msgLower.includes('number') || msgLower.includes('admin');

      if (isPhoneErr && !isEmailErr) {
        fieldErrors.student_mobile = fieldErrors.student_mobile || fieldErrors.phone || fieldErrors.parent_phone || fieldErrors.father_phone || err.message;
      }

      if (isEmailErr) {
        fieldErrors.student_email = fieldErrors.student_email || fieldErrors.email || err.message;
      }

      if (fieldErrors.phone || fieldErrors.parent_phone || fieldErrors.father_phone) {
        fieldErrors.student_mobile = fieldErrors.student_mobile || fieldErrors.phone || fieldErrors.parent_phone || fieldErrors.father_phone;
      }

      if (err.data && err.data.subscription_limit_reached) {
        setShowLimitReached({ limit: err.data.limit });
      } else if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        setActiveTab(1); // Jump back to Basic Details tab so user sees the inline field error!
      } else if (err.message && err.message.includes('{')) {
        try {
          setErrors(JSON.parse(err.message));
          setActiveTab(1);
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

  // Extract unique class names sorted in standard academic order
  const uniqueClassNames = [];
  classesList.forEach(c => {
    if (!uniqueClassNames.includes(c.name)) {
      uniqueClassNames.push(c.name);
    }
  });
  uniqueClassNames.sort((a, b) => {
    const idxA = getClassIndex(a);
    const idxB = getClassIndex(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

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
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
          {errors.form}
        </div>
      )}

      {/* Tabs list (4 steps sequence) */}
      <div className="flex border-b border-border text-sm overflow-x-auto whitespace-nowrap scrollbar-none gap-4">
        {[
          { num: 1, label: '1. Basic Details' },
          { num: 2, label: '2. Address' },
          { num: 3, label: '3. Document Uploads' },
          { num: 4, label: '4. Review & Submit' }
        ].map(t => (
          <button
            key={t.num}
            type="button"
            onClick={() => handleTabChange(t.num)}
            className={`pb-3 font-bold border-b-2 transition-all ${activeTab === t.num ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            
            {/* Tab 1: Basic Details */}
            {activeTab === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Basic Details</h3>
                  
                  {/* Unified 4-Column Grid for Basic Details */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="student_name" className="text-xs font-bold text-text-secondary uppercase">Student Name <span className="text-red-500">*</span></label>
                      <Input id="student_name" name="student_name" value={formData.student_name} onChange={handleTextChange} placeholder="Student Name" required />
                      {errors.student_name && <p className="text-[11px] text-red-500 font-semibold">{errors.student_name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="father_name" className="text-xs font-bold text-text-secondary uppercase">Father Name <span className="text-red-500">*</span></label>
                      <Input id="father_name" name="father_name" value={formData.father_name} onChange={handleTextChange} placeholder="Father Name" required />
                      {errors.father_name && <p className="text-[11px] text-red-500 font-semibold">{errors.father_name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="mother_name" className="text-xs font-bold text-text-secondary uppercase">Mother Name <span className="text-red-500">*</span></label>
                      <Input id="mother_name" name="mother_name" value={formData.mother_name} onChange={handleTextChange} placeholder="Mother Name" required />
                      {errors.mother_name && <p className="text-[11px] text-red-500 font-semibold">{errors.mother_name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="parent_occupation" className="text-xs font-bold text-text-secondary uppercase">Parent Occupation</label>
                      <Input id="parent_occupation" name="parent_occupation" value={formData.parent_occupation} onChange={handleTextChange} placeholder="e.g. Government Employee" />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="gender" className="text-xs font-bold text-text-secondary uppercase">Gender <span className="text-red-500">*</span></label>
                      <select id="gender" 
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
                      {errors.gender && <p className="text-[11px] text-red-500 font-semibold">{errors.gender}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Date of Birth <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Input id="dob" 
                          type="date" 
                          name="dob" 
                          value={formData.dob} 
                          onChange={handleTextChange} 
                          required 
                          className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer text-text-primary"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                      </div>
                      {errors.dob && <p className="text-[11px] text-red-500 font-semibold">{errors.dob}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">Admission Date <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Input id="admission_date"
                          type="date"
                          name="admission_date"
                          value={formData.admission_date}
                          onChange={handleTextChange}
                          required
                          className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer text-text-primary"
                        />
                        <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                      </div>
                      {errors.admission_date && <p className="text-[11px] text-red-500 font-semibold">{errors.admission_date}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="admission_fee" className="text-xs font-bold text-text-secondary uppercase">Admission Fee</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-text-muted">₹</span>
                        <Input id="admission_fee"
                          type="number"
                          name="admission_fee"
                          placeholder="0.00"
                          value={formData.admission_fee}
                          onChange={handleTextChange}
                          min="0"
                          step="any"
                          className="pl-7 text-text-primary text-sm"
                        />
                      </div>
                      {errors.admission_fee && <p className="text-[11px] text-red-500 font-semibold">{errors.admission_fee}</p>}
                    </div>

                    {(((academicYears || []).length <= 1 || (formData.academic_year_id && String(formData.academic_year_id) === String(academicYears[0]?.id))) || formData.student_category) && (
                      <div className="space-y-1.5">
                        <label htmlFor="student_category" className="text-xs font-bold text-text-secondary uppercase">
                          Student Category <span className="text-red-500">*</span>
                        </label>
                        <select id="student_category"
                          name="student_category"
                          value={formData.student_category}
                          onChange={handleTextChange}
                          required
                          className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                        >
                          <option value="">Select...</option>
                          <option value="Existing Student">Existing Student</option>
                          <option value="New Admission">New Admission</option>
                        </select>
                        {errors.student_category && <p className="text-[11px] text-red-500 font-semibold">{errors.student_category}</p>}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label htmlFor="blood_group" className="text-xs font-bold text-text-secondary uppercase">Blood Group</label>
                      <select id="blood_group" 
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
                      <label htmlFor="category" className="text-xs font-bold text-text-secondary uppercase">Category</label>
                      <select id="category" 
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
                    <div className="space-y-1.5">
                      <label htmlFor="religion" className="text-xs font-bold text-text-secondary uppercase">Religion</label>
                      <Input id="religion" name="religion" value={formData.religion} onChange={handleTextChange} placeholder="e.g. Hinduism" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="aadhaar_no" className="text-xs font-bold text-text-secondary uppercase">Aadhaar Number</label>
                      <Input id="aadhaar_no" name="aadhaar_no" value={formData.aadhaar_no} onChange={handleNumericChange} placeholder="12 digit Aadhaar" />
                      {errors.aadhaar_no && <p className="text-[11px] text-red-500 font-semibold">{errors.aadhaar_no}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="student_mobile" className="text-xs font-bold text-text-secondary uppercase">Contact Number <span className="text-red-500">*</span></label>
                      <Input id="student_mobile" name="student_mobile" value={formData.student_mobile} onChange={handleNumericChange} placeholder="Contact number" required />
                      {errors.student_mobile && <p className="text-[11px] text-red-500 font-semibold">{errors.student_mobile}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="student_email" className="text-xs font-bold text-text-secondary uppercase">Student Email</label>
                      <Input id="student_email" type="email" name="student_email" value={formData.student_email} onChange={handleTextChange} placeholder="student@domain.com" />
                      {errors.student_email && <p className="text-[11px] text-red-500 font-semibold">{errors.student_email}</p>}
                    </div>
                    {isFirstYear && (
                      <div className="space-y-1.5">
                        <label htmlFor="sr_no" className="text-xs font-bold text-text-secondary uppercase">SR Number <span className="text-red-500">*</span></label>
                        <Input id="sr_no" 
                          name="sr_no" 
                          value={formData.sr_no || ''} 
                          onChange={handleNumericChange} 
                          onBlur={handleSrNoBlur}
                          placeholder="Enter SR Number" 
                          className="font-bold"
                        />
                        {errors.sr_no && <p className="text-[11px] text-red-500 font-semibold">{errors.sr_no}</p>}
                      </div>
                    )}

                    {availableSections.length > 0 && (
                      <div className="space-y-1.5 animate-in fade-in duration-200">
                        <label htmlFor="section_name" className="text-xs font-bold text-text-secondary uppercase">Select Section <span className="text-red-500">*</span></label>
                        <select id="section_name"
                          name="section_name"
                          value={selectedSectionName}
                          onChange={handleSectionChange}
                          required
                          className="flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:border-zinc-800 dark:focus:ring-zinc-300"
                        >
                          <option value="">Select Section...</option>
                          {availableSections.map(sec => (
                            <option key={sec} value={sec}>
                              {sec.length === 1 ? `Section ${sec}` : sec}
                            </option>
                          ))}
                        </select>
                        {errors.section_name && <p className="text-[11px] text-red-500 font-semibold">{errors.section_name}</p>}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="roll_no" className="text-xs font-bold text-text-secondary uppercase">Roll Number</label>
                      <Input id="roll_no"
                        name="roll_no"
                        value={formData.roll_no || ''}
                        onChange={handleNumericChange}
                        placeholder="e.g. 15"
                      />
                      {errors.roll_no && <p className="text-[11px] text-red-500 font-semibold">{errors.roll_no}</p>}
                    </div>
                  </div>

                  {studentId && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                      <div className="space-y-1.5 animate-in slide-in-from-left-1 duration-150">
                        <label htmlFor="exit_date" className="text-xs font-bold text-text-secondary uppercase">Exit Date</label>
                        <div className="relative">
                          <Input id="exit_date" 
                            type="date" 
                            name="exit_date" 
                            value={formData.exit_date} 
                            onChange={(e) => {
                              const { value } = e.target;
                              setFormData(prev => ({
                                ...prev,
                                exit_date: value,
                                status: value ? 'Inactive' : 'ACTIVE'
                              }));
                            }} 
                            className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer text-text-primary"
                          />
                          <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Tab 2: Address */}
            {activeTab === 2 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border pb-2 mb-4">Current Address</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="current_address_line_1" className="text-xs font-bold text-text-secondary uppercase">Address <span className="text-red-500">*</span></label>
                      <Input id="current_address_line_1" name="current_address_line_1" value={formData.current_address_line_1} onChange={handleTextChange} placeholder="House no, street, locality..." required />
                      {errors.current_address_line_1 && <p className="text-[11px] text-red-500 font-semibold">{errors.current_address_line_1}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <SearchableSelect
                      label="State"
                      placeholder="Select or Search State..."
                      value={formData.current_state}
                      onChange={handleCurrentStateChange}
                      options={Object.keys(INDIAN_STATES_AND_CITIES)}
                      required
                      error={errors.current_state}
                    />
                    <SearchableSelect
                      label="City"
                      placeholder="Select or Search City..."
                      value={formData.current_city}
                      onChange={handleCurrentCityChange}
                      options={formData.current_state ? (INDIAN_STATES_AND_CITIES[formData.current_state] || []) : []}
                      required
                      error={errors.current_city}
                    />
                    <div className="space-y-1.5">
                      <label htmlFor="current_country" className="text-xs font-bold text-text-secondary uppercase">Country</label>
                      <Input id="current_country" name="current_country" value={formData.current_country || 'India'} onChange={handleTextChange} placeholder="Country" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="current_pin_code" className="text-xs font-bold text-text-secondary uppercase">PIN Code <span className="text-red-500">*</span></label>
                      <Input id="current_pin_code" name="current_pin_code" value={formData.current_pin_code} onChange={handleNumericChange} placeholder="ZIP/PIN Code" required />
                      {errors.current_pin_code && <p className="text-[11px] text-red-500 font-semibold">{errors.current_pin_code}</p>}
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
                          <label htmlFor="permanent_address_line_1" className="text-xs font-bold text-text-secondary uppercase">Permanent Address <span className="text-red-500">*</span></label>
                          <Input id="permanent_address_line_1" name="permanent_address_line_1" value={formData.permanent_address_line_1} onChange={handleTextChange} placeholder="House no, street, locality..." required />
                          {errors.permanent_address_line_1 && <p className="text-[11px] text-red-500 font-semibold">{errors.permanent_address_line_1}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <SearchableSelect
                          label="State"
                          placeholder="Select or Search State..."
                          value={formData.permanent_state}
                          onChange={handlePermanentStateChange}
                          options={Object.keys(INDIAN_STATES_AND_CITIES)}
                          required
                          error={errors.permanent_state}
                        />
                        <SearchableSelect
                          label="City"
                          placeholder="Select or Search City..."
                          value={formData.permanent_city}
                          onChange={handlePermanentCityChange}
                          options={formData.permanent_state ? (INDIAN_STATES_AND_CITIES[formData.permanent_state] || []) : []}
                          required
                          error={errors.permanent_city}
                        />
                        <div className="space-y-1.5">
                          <label htmlFor="permanent_country" className="text-xs font-bold text-text-secondary uppercase">Country</label>
                          <Input id="permanent_country" name="permanent_country" value={formData.permanent_country || 'India'} onChange={handleTextChange} placeholder="Country" />
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor="permanent_pin_code" className="text-xs font-bold text-text-secondary uppercase">PIN Code <span className="text-red-500">*</span></label>
                          <Input id="permanent_pin_code" name="permanent_pin_code" value={formData.permanent_pin_code} onChange={handleNumericChange} placeholder="ZIP/PIN Code" required />
                          {errors.permanent_pin_code && <p className="text-[11px] text-red-500 font-semibold">{errors.permanent_pin_code}</p>}
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
                            <span className="text-[11px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                              <Check className="h-3 w-3" /> UPLOADED
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1 mt-2">
                          <div className="flex items-center gap-3">
                            <label className="cursor-pointer bg-surface border border-border px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-text-primary shadow-xs">
                              <Upload className="h-3.5 w-3.5" />
                              <span>{formData[doc.key] ? 'Change File' : 'Choose File'}</span>
                              <input 
                                type="file" 
                                onChange={(e) => handleFileUpload(e, doc.key)} 
                                className="hidden" 
                                accept={doc.key === 'photo_path' ? ".jpg,.jpeg,.png,.webp" : ".png,.jpg,.jpeg,.pdf"}
                              />
                            </label>
                            
                            {uploadStates[doc.key] === 'uploading' && (
                              <span className="text-[11px] text-text-muted animate-pulse font-medium">Uploading...</span>
                            )}
                            {uploadStates[doc.key] === 'error' && (
                              <span className="text-[11px] text-red-500 font-medium">Upload failed. Try again.</span>
                            )}
                            {formData[doc.key] && !uploadStates[doc.key] && (
                              <span className="text-[11px] text-text-muted truncate max-w-[200px]" title={formData[doc.key]}>
                                {formData[doc.key].split('/').pop()}
                              </span>
                            )}
                          </div>
                          {uploadStates[doc.key] === 'validation_error' && doc.key === 'photo_path' && (
                            <p className="text-[11px] font-bold text-red-500 mt-1">⚠️ Only JPG, JPEG, PNG and WEBP image files are allowed.</p>
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
                        <p><span className="text-text-muted font-semibold inline-block w-28">Full Name:</span> <span className="font-bold text-text-primary">{formData.student_name || `${formData.first_name || ''} ${formData.middle_name || ''} ${formData.last_name || ''}`.trim()}</span></p>
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

                      <p className="border-l-2 border-indigo-500 pl-2.5 font-bold text-text-primary uppercase text-xs tracking-wider mt-4">Current Address</p>
                      <p className="text-xs text-text-secondary bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg leading-relaxed border border-border">
                        {((formData.current_address_line_1 || '') + (formData.current_address_line_2 ? ', ' + formData.current_address_line_2 : '')).trim() || formData.current_address_line}, {formData.current_city}, {formData.current_state} - {formData.current_pin_code}
                      </p>

                      {formData.same_as_current === 0 && (formData.permanent_address_line_1 || '').trim() !== '' && (
                        <>
                          <p className="border-l-2 border-indigo-500 pl-2.5 font-bold text-text-primary uppercase text-xs tracking-wider mt-3">Permanent Address</p>
                          <p className="text-xs text-text-secondary bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg leading-relaxed border border-border">
                            {((formData.permanent_address_line_1 || '') + (formData.permanent_address_line_2 ? ', ' + formData.permanent_address_line_2 : '')).trim() || formData.permanent_address_line}, {formData.permanent_city}, {formData.permanent_state} - {formData.permanent_pin_code}
                          </p>
                        </>
                      )}
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
                {submitting ? 'Saving...' : (studentId ? 'Save Changes' : 'Submit')}
              </Button>
            )}
          </div>
        </div>
      {showLimitReached && (
        <Dialog
          isOpen={!!showLimitReached}
          title="Student Limit Reached"
          onClose={() => setShowLimitReached(null)}
        >
          <div className="space-y-4 max-w-sm text-xs font-semibold text-text-secondary leading-relaxed">
            <p>
              Your current subscription plan allows a maximum of <strong>{showLimitReached.limit} students</strong>.
            </p>
            <p>You have already reached this limit.</p>
            <p className="text-text-muted font-medium">Please upgrade your subscription plan to continue enrolling new students.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowLimitReached(null)}>Cancel</Button>
              <Button onClick={() => { setShowLimitReached(null); navigate('/school-admin/profile/subscription'); }}>View Plans</Button>
            </div>
          </div>
        </Dialog>
      )}
      </form>
    </div>
  );
}
