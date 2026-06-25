import React, { useState, useEffect, useRef } from 'react';
import LoginForm from './features/auth/components/LoginForm';
import PortalDashboard from './features/portals/components/PortalDashboard';
import PlatformDashboard from './features/platform/components/PlatformDashboard';
import TimetableManager from './features/timetable/components/TimetableManager';
import AttendanceTracker from './features/attendance/components/AttendanceTracker';
import GradingPanel from './features/grading/components/GradingPanel';
import FinanceManager from './features/finance/components/FinanceManager';
import { 
  BookOpen, 
  Users, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Server, 
  RefreshCw, 
  GraduationCap, 
  Clock, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  DollarSign, 
  Calendar, 
  X,
  FileText,
  Lock,
  Moon,
  Sun,
  Bell,
  Trash2,
  Edit,
  MoreVertical,
  Globe,
  Check,
  Shield,
  FileSpreadsheet,
  Printer,
  Eye,
  EyeOff,
  Building,
  Key,
  ChevronRight,
  ChevronLeft,
  Copy,
  Download,
  GripVertical,
  Sparkles,
  Info,
  Sliders,
  SortAsc,
  LogOut,
  Briefcase,
  CreditCard,
  WifiOff
} from 'lucide-react';

const LOCATION_DATA = {
  "India": {
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Rajahmundry", "Kakinada", "Kadapa", "Anantapur"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Arrah", "Begusarai", "Katihar"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Jagdalpur", "Ambikapur"],
    "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh", "Anand"],
    "Haryana": ["Faridabad", "Gurugram", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Hamirpur"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro Steel City", "Deoghar", "Hazaribagh", "Giridih"],
    "Karnataka": ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum", "Davangere", "Bellary", "Gulbarga"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur", "Alappuzha", "Palakkad", "Malappuram", "Kannur"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Ratlam", "Rewa"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Pimpri-Chinchwad", "Nashik", "Kalyan-Dombivli", "Vasai-Virar", "Aurangabad", "Navi Mumbai", "Solapur", "Kolhapur"],
    "Manipur": ["Imphal", "Thoubal", "Bishnupur"],
    "Meghalaya": ["Shillong", "Tura", "Jowai"],
    "Mizoram": ["Aizawl", "Lunglei", "Champhai"],
    "Nagaland": ["Dimapur", "Kohima", "Mokokchung"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Sikar"],
    "Sikkim": ["Gangtok", "Namchi", "Geyzing"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam", "Khammam"],
    "Tripura": ["Agartala", "Dharmanagar", "Udaipur"],
    "Uttar Pradesh": ["Kanpur", "Lucknow", "Ghaziabad", "Agra", "Meerut", "Varanasi", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Saharanpur", "Gorakhpur", "Noida", "Firozabad", "Jhansi", "Muzaffarnagar", "Mathura-Vrindavan", "Budaun", "Rampur", "Shahjahanpur", "Farrukhabad-Fatehgarh", "Ayodhya", "Maunath Bhanjan", "Hapur", "Etawah", "Mirzapur-Vindhyachal", "Bulandshahr", "Sambhal", "Amroha", "Hardoi", "Fatehpur", "Raebareli", "Orai", "Sitapur", "Bahraich", "Modinagar", "Unnao", "Jaunpur", "Lakhimpur", "Hathras", "Banda", "Pilibhit", "Barabanki", "Khurja", "Gonda", "Mainpuri", "Lalitpur", "Etah", "Deoria", "Ghazipur", "Sultanpur", "Azamgarh", "Bijnor", "Sahaswan", "Basti", "Chandausi", "Akbarpur", "Ballia", "Tanda", "Greater Noida", "Shikohabad", "Shamli", "Awagarh", "Kasganj"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Haldwani", "Rudrapur", "Roorkee", "Rishikesh"],
    "West Bengal": ["Kolkata", "Howrah", "Kharagpur", "Durgapur", "Asansol", "Siliguri", "Bardhaman", "Malda"],
    "Delhi": ["New Delhi", "Dwarka", "Rohini", "South Delhi", "North Delhi", "East Delhi", "West Delhi"],
    "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla"],
    "Ladakh": ["Leh", "Kargil"],
    "Chandigarh": ["Chandigarh"],
    "Puducherry": ["Puducherry", "Karaikal", "Mahe"],
    "Andaman and Nicobar Islands": ["Port Blair"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Silvassa", "Daman", "Diu"],
    "Lakshadweep": ["Kavaratti"]
  },
  "United States": {
    "California": ["Los Angeles", "San Francisco", "San Diego", "San Jose", "Sacramento"],
    "New York": ["New York City", "Buffalo", "Rochester", "Albany"],
    "Texas": ["Houston", "Austin", "Dallas", "San Antonio"]
  },
  "Canada": {
    "Ontario": ["Toronto", "Ottawa", "Mississauga", "Hamilton"],
    "Quebec": ["Montreal", "Quebec City", "Laval"],
    "British Columbia": ["Vancouver", "Victoria", "Surrey"]
  },
  "United Kingdom": {
    "England": ["London", "Birmingham", "Manchester", "Leeds"],
    "Scotland": ["Edinburgh", "Glasgow", "Aberdeen"]
  },
  "Australia": {
    "New South Wales": ["Sydney", "Newcastle"],
    "Victoria": ["Melbourne", "Geelong"]
  },
  "United Arab Emirates": {
    "Dubai": ["Dubai"],
    "Abu Dhabi": ["Abu Dhabi", "Al Ain"],
    "Sharjah": ["Sharjah"]
  },
  "Saudi Arabia": {
    "Riyadh": ["Riyadh"],
    "Makkah": ["Jeddah", "Mecca", "Taif"],
    "Eastern": ["Dammam", "Khobar"]
  },
  "Nepal": {
    "Bagmati": ["Kathmandu", "Lalitpur"],
    "Gandaki": ["Pokhara"]
  },
  "Bangladesh": {
    "Dhaka": ["Dhaka", "Narayanganj"],
    "Chittagong": ["Chittagong"]
  },
  "Pakistan": {
    "Punjab": ["Lahore", "Faisalabad"],
    "Sindh": ["Karachi", "Hyderabad"]
  },
  "Singapore": {
    "Central": ["Singapore"]
  },
  "Germany": {
    "Bavaria": ["Munich", "Nuremberg"],
    "Berlin": ["Berlin"],
    "Hamburg": ["Hamburg"]
  },
  "France": {
    "Ile-de-France": ["Paris"],
    "Provence-Alpes-Cote d'Azur": ["Marseille", "Nice"]
  }
};

const sha256Sync = (ascii) => {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const words = [];
  const asciiLength = ascii.length;
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  
  const totalBitLength = asciiLength * 8;
  const wordCount = ((totalBitLength + 64) >> 9) * 16 + 16;
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  words[wordCount - 1] = totalBitLength;
  
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
      
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let j = 0; j < words.length; j += 16) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = words[j + i] || 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const hash = [h0, h1, h2, h3, h4, h5, h6, h7].map(val => {
    const hex = (val >>> 0).toString(16);
    return '00000000'.substring(hex.length) + hex;
  }).join('');

  return hash;
};

const verifyLocalPassword = (inputPass, storedPass) => {
  if (!storedPass) return false;
  if (storedPass.length === 64 && /^[0-9a-f]{64}$/i.test(storedPass)) {
    return sha256Sync(inputPass) === storedPass;
  }
  return storedPass === inputPass;
};

const getStudentAvatar = (student) => {
  if (student.profile_image && student.profile_image.trim() !== '') {
    return student.profile_image;
  }
  const gender = (student.gender || 'Male').toLowerCase();
  if (gender === 'female') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="50" fill="%23fce7f3"/><circle cx="50" cy="40" r="20" fill="%23db2777"/><path d="M20 80c0-15 12-25 30-25s30 10 30 25H20z" fill="%23db2777"/></svg>`;
  } else if (gender === 'other') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="50" fill="%23ccfbf1"/><circle cx="50" cy="40" r="20" fill="%230d9488"/><path d="M20 80c0-15 12-25 30-25s30 10 30 25H20z" fill="%230d9488"/></svg>`;
  } else {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="50" fill="%23dbeafe"/><circle cx="50" cy="40" r="20" fill="%232563eb"/><path d="M20 80c0-15 12-25 30-25s30 10 30 25H20z" fill="%232563eb"/></svg>`;
  }
};

const isValidPhone = (phone) => {
  return /^\d{10}$/.test(phone);
};

const isValidEmail = (email) => {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const formatReportDateStr = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parts[2].padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[monthIndex];
    if (month) {
      return `${day}-${month}-${year}`;
    }
  }
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};


const decodeJwt = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT decoding failed:", e);
    return null;
  }
};

const extractSignature = (imageSrc, cropSettings = { left: 0, right: 0, top: 0, bottom: 0, threshold: 220 }) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      let minX = canvas.width;
      let maxX = 0;
      let minY = canvas.height;
      let maxY = 0;
      
      const threshold = cropSettings.threshold;
      
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Calculate brightness/luminance
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // Detect white/off-white backgrounds and shadowed paper borders
          const isNeutralGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20 && brightness > 165;
          const isWhiteBackground = brightness >= threshold || (r > 185 && g > 185 && b > 185) || isNeutralGray;
          
          if (isWhiteBackground) {
            // Make background pixel fully transparent
            data[idx + 3] = 0; 
          } else {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      
      // Put modified transparent data back
      ctx.putImageData(imgData, 0, 0);
      
      // Fallback
      if (maxX < minX || maxY < minY) {
        minX = 0;
        maxX = canvas.width;
        minY = 0;
        maxY = canvas.height;
      }
      
      // Apply manual crop sliders offsets
      const manualLeft = Math.floor((cropSettings.left / 100) * canvas.width);
      const manualRight = Math.floor((cropSettings.right / 100) * canvas.width);
      const manualTop = Math.floor((cropSettings.top / 100) * canvas.height);
      const manualBottom = Math.floor((cropSettings.bottom / 100) * canvas.height);
      
      // Crop bounds
      const startX = Math.max(minX, manualLeft);
      const endX = Math.min(maxX, canvas.width - manualRight);
      const startY = Math.max(minY, manualTop);
      const endY = Math.min(maxY, canvas.height - manualBottom);
      
      const cropW = Math.max(10, endX - startX);
      const cropH = Math.max(10, endY - startY);
      
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
      
      resolve(cropCanvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      resolve(imageSrc);
    };
    img.src = imageSrc;
  });
};

const formatPublishedDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'AM' : 'PM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  } catch (e) {
    return '-';
  }
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSystemHolidays = (startDate, endDate, ayId) => {
  if (!startDate || !endDate) return [];
  const startDt = new Date(startDate);
  const endDt = new Date(endDate);
  const startYear = startDt.getFullYear();
  const endYear = endDt.getFullYear();
  
  const candidates = [
    { title: "New Year's Day", month: 1, day: 1 },
    { title: 'Republic Day', month: 1, day: 26 },
    { title: 'Labour Day', month: 5, day: 1 },
    { title: 'Independence Day', month: 8, day: 15 },
    { title: 'Gandhi Jayanti', month: 10, day: 2 },
    { title: 'Christmas Day', month: 12, day: 25 },
  ];
  
  const systemHolidays = [];
  candidates.forEach(c => {
    for (let yr = startYear; yr <= endYear; yr++) {
      const dateStr = `${yr}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
      const dt = new Date(yr, c.month - 1, c.day);
      if (dt >= startDt && dt <= endDt) {
        systemHolidays.push({
          id: `system-${c.month}-${c.day}-${yr}`,
          school_id: 1,
          academic_year_id: ayId,
          title: c.title,
          leave_date: dateStr,
          description: 'System generated national/public holiday',
          category: 'System Holiday'
        });
      }
    }
  });
  return systemHolidays;
};

export default function App() {
  // Theme & Navigation
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // Super Admin: schools, stats, invites. School Admin: dashboard, faculty, students, fees, reports, settings
  const [activeYearId, setActiveYearId] = useState(() => {
    const stored = localStorage.getItem('bn_active_year_id');
    return stored ? parseInt(stored) : 2;
  });

  // Core database states
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Class Teacher management states
  const [assignTeacherModalOpen, setAssignTeacherModalOpen] = useState(false);
  const [assignTeacherClassId, setAssignTeacherClassId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [editingAssignmentClassId, setEditingAssignmentClassId] = useState(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  
  // Credentials modal states
  const [credsModalOpen, setCredsModalOpen] = useState(false);
  const [credsTargetType, setCredsTargetType] = useState('Teacher'); // 'Teacher' or 'Parent'
  const [credsTargetId, setCredsTargetId] = useState(null); // teacher_id or student_id
  const [credsPhone, setCredsPhone] = useState('');
  const [credsPassword, setCredsPassword] = useState('');
  const [credsExists, setCredsExists] = useState(false);
  const [credsLoading, setCredsLoading] = useState(false);
  const [credsSaving, setCredsSaving] = useState(false);

  // Portal active dashboard states
  const [teacherDashboardData, setTeacherDashboardData] = useState(null);
  const [teacherDashboardLoading, setTeacherDashboardLoading] = useState(false);
  const [parentDashboardData, setParentDashboardData] = useState(null);
  const [isParentDashboardLoading, setIsParentDashboardLoading] = useState(false);
  const [parentStudents, setParentStudents] = useState([]);
  const [selectedParentStudentId, setSelectedParentStudentId] = useState(null);
  const [parentStudentSummary, setParentStudentSummary] = useState(null);
  const [parentSummaryLoading, setParentSummaryLoading] = useState(false);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [isApiUnavailable, setIsApiUnavailable] = useState(false);
  const [apiConnectionError, setApiConnectionError] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Academic Years Management States
  const [showCreateYearModal, setShowCreateYearModal] = useState(false);
  const [newYearForm, setNewYearForm] = useState({
    year_range: '',
    start_date: '',
    end_date: '',
    description: ''
  });
  const [unpayConfirm, setUnpayConfirm] = useState(null);
  const [unpayExtraFeeConfirm, setUnpayExtraFeeConfirm] = useState(null);
  const [selectedFeeClassId, setSelectedFeeClassId] = useState('');
  const [selectedFeesClassId, setSelectedFeesClassId] = useState(null);
  const [feesSortField, setFeesSortField] = useState('dues_desc');
  const [classFeeStructure, setClassFeeStructure] = useState(null);
  const [feeStructureMode, setFeeStructureMode] = useState('same'); // 'same' or 'custom'
  const [sameMonthlyFee, setSameMonthlyFee] = useState(0);
  const [showConfirmLockModal, setShowConfirmLockModal] = useState(false);
  const [yearError, setYearError] = useState('');
  const [isSavingYear, setIsSavingYear] = useState(false);
  const [showTransitionWizard, setShowTransitionWizard] = useState(false);
  const [wizardTargetYear, setWizardTargetYear] = useState(null);
  const [transitionWizardStep, setTransitionWizardStep] = useState(1);
  const [wizardClassMappings, setWizardClassMappings] = useState({});
  const [wizardStudentStatus, setWizardStudentStatus] = useState({});
  const [wizardConfirmText, setWizardConfirmText] = useState('');
  const [isActivatingYear, setIsActivatingYear] = useState(false);
  const [crossYearReports, setCrossYearReports] = useState([]);
  const [isFetchingCrossYear, setIsFetchingCrossYear] = useState(false);
  const [reportSubTab, setReportSubTab] = useState('session'); // 'session' or 'cross-year'
  const [schoolCurrency, setSchoolCurrency] = useState('INR');
  const [feesStatusFilter, setFeesStatusFilter] = useState('All');
  const [ledgerBackSource, setLedgerBackSource] = useState('students');
  const [showExperienceLetter, setShowExperienceLetter] = useState(false);
  const [studentDetailTab, setStudentDetailTab] = useState('fees'); // 'fees', 'documents', or 'performance'
  const [studentPerformanceSummary, setStudentPerformanceSummary] = useState(null);
  const [profileStudentExamId, setProfileStudentExamId] = useState('overall');

  // Student Performance States
  const [performanceSubTab, setPerformanceSubTab] = useState('attendance'); // 'attendance', 'exams', 'report_cards'
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [attendanceGroupName, setAttendanceGroupName] = useState('all');
  const [attendanceDate, setAttendanceDate] = useState(getLocalDateString());
  const [isAttendanceEditing, setIsAttendanceEditing] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState('Not Marked');
  const [isFetchingAttendanceReport, setIsFetchingAttendanceReport] = useState(false);
  const attendanceDateInputRef = useRef(null);
  const leaveDateInputRef = useRef(null);
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [attendanceReportMonth, setAttendanceReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceReportData, setAttendanceReportData] = useState([]);
  const [isFetchingAttendance, setIsFetchingAttendance] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attendanceAnalytics, setAttendanceAnalytics] = useState({});
  const [attendanceMode, setAttendanceMode] = useState('mark'); // 'mark' or 'report'
  const [markedAttendance, setMarkedAttendance] = useState({}); // student_id -> status
  const [leavesList, setLeavesList] = useState([]);
  const [isFetchingLeaves, setIsFetchingLeaves] = useState(false);
  const [isSavingLeave, setIsSavingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ date: '', title: '', description: '' });
  const [leaveErrors, setLeaveErrors] = useState({});
  const [editingLeave, setEditingLeave] = useState(null);
  const [attendanceReportStudyDays, setAttendanceReportStudyDays] = useState(0);
  const [attendanceReportSundays, setAttendanceReportSundays] = useState(0);
  const [attendanceReportHolidays, setAttendanceReportHolidays] = useState(0);

  const [examsList, setExamsList] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [isFetchingExams, setIsFetchingExams] = useState(false);
  const [isSavingExam, setIsSavingExam] = useState(false);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [newExamForm, setNewExamForm] = useState({
    name: '',
    class_id: '',
    group_name: '',
    start_date: '',
    end_date: '',
    subjects: [{ subject_name: '', max_marks: 100 }]
  });
  const [examMarks, setExamMarks] = useState([]);
  const [examMarksMode, setExamMarksMode] = useState('list'); // 'list', 'entry', 'remarks'
  const [marksSubjectFilter, setMarksSubjectFilter] = useState('');
  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [marksSaveStatus, setMarksSaveStatus] = useState(''); // 'saving', 'saved', ''
  
  // Redesigned Exam Module States
  const [showCreateSchemeModal, setShowCreateSchemeModal] = useState(false);
  const [schemeForm, setSchemeForm] = useState({
    name: '',
    description: '',
    applicable_classes: [],
    status: 'Draft',
    class_subjects: {} // class_id -> Array of subject objects
  });
  const [activeSchemeActionMenuName, setActiveSchemeActionMenuName] = useState(null);
  const [showViewSchemeModal, setShowViewSchemeModal] = useState(false);
  const [schemeToView, setSchemeToView] = useState(null);
  const [editingSchemeName, setEditingSchemeName] = useState('');

  // Simplified Exam Module States
  const [examsSubSubTab, setExamsSubSubTab] = useState('management'); // 'management', 'marks'
  const [showExamFormModal, setShowExamFormModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState(null);
  const [examForm, setExamForm] = useState({
    name: '',
    class_id: '',
    description: '',
    status: 'Draft',
    subjects: [{ subject_name: '', max_marks: 100 }]
  });
  const [activeExamActionMenuId, setActiveExamActionMenuId] = useState(null);

  // Enter Marks States
  const [marksSelectedSchemeName, setMarksSelectedSchemeName] = useState('');
  const [marksSelectedClassId, setMarksSelectedClassId] = useState('');
  const [marksSelectedExamId, setMarksSelectedExamId] = useState('');
  const [marksEntryStudent, setMarksEntryStudent] = useState(null); // student being graded in modal
  const [showStudentMarksModal, setShowStudentMarksModal] = useState(false);
  const [examActionMenuCoords, setExamActionMenuCoords] = useState(null);
  const [isMarksReadOnly, setIsMarksReadOnly] = useState(false);
  const [activeMarksStudentMenuId, setActiveMarksStudentMenuId] = useState(null);
  const [selectedReportStudent, setSelectedReportStudent] = useState(null);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  const [isFetchingExamMarks, setIsFetchingExamMarks] = useState(false);
  
  // Exam Management filters & confirmations
  const [examPublishConfirm, setExamPublishConfirm] = useState(null);
  const [examStatusFilter, setExamStatusFilter] = useState('All');
  const [statusSortDirection, setStatusSortDirection] = useState(null);
  
  const [sigToCrop, setSigToCrop] = useState(null);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropThreshold, setCropThreshold] = useState(220);
  const [cropPreviewUrl, setCropPreviewUrl] = useState('');
  
  const [reportCardSchemeName, setReportCardSchemeName] = useState('');
  const [reportCardClassId, setReportCardClassId] = useState('');
  const [reportCardGroupName, setReportCardGroupName] = useState('all');
  const [reportCardStudentId, setReportCardStudentId] = useState('');
  const [reportCardExamId, setReportCardExamId] = useState('overall');
  const [reportCardRemarks, setReportCardRemarks] = useState({}); // student_id -> remark text
  const [remarksInput, setRemarksInput] = useState('');
  const [schoolSignatures, setSchoolSignatures] = useState({
    teacher_signature: null,
    class_teacher_signature: null,
    principal_signature: null
  });
  const [showSignatureSettings, setShowSignatureSettings] = useState(false);
  const [gradingScales, setGradingScales] = useState([
    { grade_name: 'A+', min_percentage: 90.00, max_percentage: 100.00 },
    { grade_name: 'A',  min_percentage: 80.00, max_percentage: 89.99 },
    { grade_name: 'B',  min_percentage: 70.00, max_percentage: 79.99 },
    { grade_name: 'C',  min_percentage: 60.00, max_percentage: 69.99 },
    { grade_name: 'D',  min_percentage: 40.00, max_percentage: 59.99 },
    { grade_name: 'F',  min_percentage: 0.00,  max_percentage: 39.99 }
  ]);

  // Financial Reports States
  const [financialReports, setFinancialReports] = useState([]);
  const [reportFromDate, setReportFromDate] = useState('');
  const [reportToDate, setReportToDate] = useState('');
  const [reportPreview, setReportPreview] = useState(null);
  const [isReportPreviewing, setIsReportPreviewing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [exportingReportId, setExportingReportId] = useState(null);
  const [reportStatusConfirm, setReportStatusConfirm] = useState(null);
  const [settlingReportId, setSettlingReportId] = useState(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [financialSubTab, setFinancialSubTab] = useState('statements'); // 'statements', 'expenses', 'fees'
  const [financeManagementSubTab, setFinanceManagementSubTab] = useState('fees'); // 'fees', 'expenses', 'promises'
  const [paymentPromises, setPaymentPromises] = useState([]);
  const [studentCarryForwardDues, setStudentCarryForwardDues] = useState([]);
  const [previousDues, setPreviousDues] = useState([]);
  const [isFetchingPreviousDues, setIsFetchingPreviousDues] = useState(false);
  const [previousYearRecoveries, setPreviousYearRecoveries] = useState([]);
  const [isFetchingCarryForwardDues, setIsFetchingCarryForwardDues] = useState(false);
  const [selectedCarryForwardDue, setSelectedCarryForwardDue] = useState(null);
  const [showPayRecoveryModal, setShowPayRecoveryModal] = useState(false);
  const [showRecoveryReceiptModal, setShowRecoveryReceiptModal] = useState(false);
  const [selectedRecoveryReceiptDue, setSelectedRecoveryReceiptDue] = useState(null);
  const [selectedRecoveryReceiptRec, setSelectedRecoveryReceiptRec] = useState(null);
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryDate, setRecoveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecordingRecovery, setIsRecordingRecovery] = useState(false);
  const [recoverySearchQuery, setRecoverySearchQuery] = useState('');
  const [recoveryYearFilter, setRecoveryYearFilter] = useState('All');
  const [isSavingPromise, setIsSavingPromise] = useState(false);
  const [promiseSearch, setPromiseSearch] = useState('');
  const [promiseClassFilter, setPromiseClassFilter] = useState('All');
  const [promiseModalOpen, setPromiseModalOpen] = useState(false);
  const [editingPromise, setEditingPromise] = useState(null);
  const [promiseStudentId, setPromiseStudentId] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseDescription, setPromiseDescription] = useState('');
  const [promiseStatus, setPromiseStatus] = useState('Pending');
  const [promiseStudentSearchQuery, setPromiseStudentSearchQuery] = useState('');
  const [activePromiseMenuId, setActivePromiseMenuId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [extraFeeTypes, setExtraFeeTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeAmount, setNewTypeAmount] = useState('');
  const [studentExtraFees, setStudentExtraFees] = useState([]);
  const [extraFeeSearch, setExtraFeeSearch] = useState('');
  const [extraFeeStatusFilter, setExtraFeeStatusFilter] = useState('All');
  const [extraFeeClassFilter, setExtraFeeClassFilter] = useState('All');
  const [extraFeeTypeFilter, setExtraFeeTypeFilter] = useState('All');
  const [visibleAdditionalFeeStudentsCount, setVisibleAdditionalFeeStudentsCount] = useState(10);
  const [isFetchingMoreAdditionalFeeStudents, setIsFetchingMoreAdditionalFeeStudents] = useState(false);
  const [editingExtraFeeType, setEditingExtraFeeType] = useState(null);
  const [editExtraFeeTypeName, setEditExtraFeeTypeName] = useState('');
  const [editExtraFeeTypeAmount, setEditExtraFeeTypeAmount] = useState('');

  // Modal state for Replace/Backup Teacher actions
  const [teacherActionModal, setTeacherActionModal] = useState({
    show: false,
    type: '', // 'Replace' or 'Backup'
    day: '',
    periodIndex: null,
    subject: '',
    currentTeacherId: null
  });

  // Keep track of which period's dropdown menu is currently open
  const [activeDropdownKey, setActiveDropdownKey] = useState(null); // e.g. "Monday-0"

  const [selectedModalTeacherId, setSelectedModalTeacherId] = useState('');

  // Admin Profile States
  const [adminProfile, setAdminProfile] = useState(null);
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    timezone: 'Asia/Kolkata',
    profile_image: ''
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState('details'); // 'details' | 'edit' | 'password'
  
  // Password Change States
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Currency definitions mapping code to symbol and name
  const currencyMap = {
    'INR': { symbol: '₹', code: 'INR', label: '₹ INR (Indian Rupee)' },
    'USD': { symbol: '$', code: 'USD', label: '$ USD (US Dollar)' },
    'EUR': { symbol: '€', code: 'EUR', label: '€ EUR (Euro)' },
    'GBP': { symbol: '£', code: 'GBP', label: '£ GBP (British Pound)' },
    'AED': { symbol: 'AED ', code: 'AED', label: 'AED (UAE Dirham)' },
    'SAR': { symbol: 'SR ', code: 'SAR', label: 'SAR (Saudi Riyal)' },
    'CAD': { symbol: 'C$', code: 'CAD', label: 'CAD (Canadian Dollar)' },
    'AUD': { symbol: 'A$', code: 'AUD', label: 'AUD (Australian Dollar)' }
  };

  const formatMoney = (amount) => {
    const numericAmount = Math.round(parseFloat(amount)) || 0;
    const currencyInfo = currencyMap[schoolCurrency] || currencyMap['INR'];
    return `${currencyInfo.symbol}${numericAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };
  
  // Synchronize dark-theme class with document.body to ensure correct CSS variables resolution globally
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }, [isDarkMode]);
  
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [username, setUsername] = useState(localStorage.getItem('admin_email') || '');
  const [role, setRole] = useState(localStorage.getItem('admin_role') || ''); // 'Super Admin' or 'School Admin'
  const [schoolId, setSchoolId] = useState(localStorage.getItem('admin_school_id') || '');
  const [setupCompleted, setSetupCompleted] = useState(parseInt(localStorage.getItem('admin_setup_completed') || '1'));
  const [permissions, setPermissions] = useState(() => {
    const saved = localStorage.getItem('admin_permissions');
    return saved ? JSON.parse(saved) : [];
  });
  const [linkedStudentIds, setLinkedStudentIds] = useState(() => {
    const saved = localStorage.getItem('admin_linked_student_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [expiredModalInfo, setExpiredModalInfo] = useState(null);
  


  // User Management & Roles States
  const [dbRoles, setDbRoles] = useState([]);
  const [dbUsers, setDbUsers] = useState([]);
  const [isRolesLoading, setIsRolesLoading] = useState(false);

  // Form states for Roles & Users management
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormPerms, setRoleFormPerms] = useState([]);
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPass, setUserFormPass] = useState('');
  const [userFormRole, setUserFormRole] = useState('Teacher');
  const [userFormClassId, setUserFormClassId] = useState('');
  const [userFormChildIds, setUserFormChildIds] = useState([]);
  const [rolesSubTab, setRolesSubTab] = useState('roles'); // 'roles' or 'users'
  const [editingUser, setEditingUser] = useState(null);

  // Load Parent Dashboard Details
  useEffect(() => {
    const loadParentDashboard = async () => {
      if (role !== 'Parent' || !selectedParentStudentId) return;
      setIsParentDashboardLoading(true);
      try {
        if (!token) {
          // Mock mode fallback
          const childObj = parentStudents.find(s => s.id === selectedParentStudentId) || {
            id: selectedParentStudentId,
            first_name: 'Yusuf',
            last_name: 'Ali',
            class_name: 'Class 11',
            gr_no: 'GR1004',
            status: 'Active',
            group_name: 'Science'
          };
          setParentDashboardData({
            student: childObj,
            attendance_stats: { present_days: 18, absent_days: 2, leave_days: 1, total_days: 21 },
            recent_attendance: [
              { attendance_date: '2026-06-20', status: 'Present' },
              { attendance_date: '2026-06-19', status: 'Present' },
              { attendance_date: '2026-06-18', status: 'Absent' },
              { attendance_date: '2026-06-17', status: 'Present' },
              { attendance_date: '2026-06-16', status: 'Present' }
            ],
            fees: [
              { due_date: '2026-07-01', title: 'July 2026 Tuition Fee', amount: 2000, status: 'Unpaid' },
              { due_date: '2026-06-01', title: 'June 2026 Tuition Fee', amount: 2000, status: 'Paid', paid_at: '2026-06-05', payment_mode: 'Cash' }
            ],
            carry_forward: [],
            exam_marks: [
              { exam_name: 'First Term Exams', subject_name: 'Physics', marks_obtained: 85, max_marks: 100 },
              { exam_name: 'First Term Exams', subject_name: 'Chemistry', marks_obtained: 90, max_marks: 100 },
              { exam_name: 'First Term Exams', subject_name: 'Mathematics', marks_obtained: 78, max_marks: 100 }
            ]
          });
          setIsParentDashboardLoading(false);
          return;
        }

        const headers = getHeaders(token);
        const res = await fetch(`/api/parent/student/${selectedParentStudentId}/dashboard`, { headers });
        if (res.ok) {
          const data = await res.json();
          setParentDashboardData(data);
        }
      } catch (err) {
        console.error("Error loading parent dashboard", err);
      } finally {
        setIsParentDashboardLoading(false);
      }
    };
    loadParentDashboard();
  }, [selectedParentStudentId, role, token, parentStudents]);

  // Load Teacher Today's Attendance & Scheme
  useEffect(() => {
    const loadTeacherTodayAttendance = async () => {
      if (role !== 'Teacher') return;
      const currentTeacher = teachers.find(t => t.phone === username || t.email === username);
      const assignedClass = classes.find(c => Number(c.class_teacher_id) === Number(currentTeacher?.id));
      if (!assignedClass) return;
      
      const keySuffix = schoolId || 'default';
      const todayDate = new Date().toISOString().slice(0, 10);
      try {
        if (token.includes('mock') || !isConnected) {
          // Attendance
          const storedAtt = JSON.parse(localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${activeYearId}`) || '[]');
          const classStudents = students.filter(s => s.class_id === assignedClass.id);
          const studentIds = classStudents.map(s => s.id);
          const filtered = storedAtt.filter(r => r.attendance_date === todayDate && studentIds.includes(Number(r.student_id)));
          setTeacherTodayAttendance(filtered);

          // Scheme / Class Fee structure
          const storedCfg = localStorage.getItem(`bn_sandbox_class_fees_${keySuffix}_${assignedClass.id}_${activeYearId}`);
          if (storedCfg) {
            setTeacherClassFeeStructure(JSON.parse(storedCfg));
          } else {
            setTeacherClassFeeStructure(null);
          }
        } else {
          // Attendance
          const res = await fetch(`/api/attendance?class_id=${assignedClass.id}&academic_year_id=${activeYearId}&date=${todayDate}`, { headers: getHeaders() });
          if (res.ok) {
            const data = await res.json();
            const mapped = data.filter(s => s.status).map(s => ({ student_id: s.id, status: s.status }));
            setTeacherTodayAttendance(mapped);
          }

          // Scheme / Class Fee structure
          const resCfg = await fetch(`/api/class-fees?class_id=${assignedClass.id}&academic_year_id=${activeYearId}`, { headers: getHeaders() });
          if (resCfg.ok) {
            setTeacherClassFeeStructure(await resCfg.json());
          }
        }
      } catch (err) {
        console.error("Error loading today teacher data", err);
      }
    };
    
    loadTeacherTodayAttendance();
  }, [role, token, classes, teachers, username, activeYearId, isConnected, students]);

  // Form credentials
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginTab, setLoginTab] = useState('admin'); // 'admin', 'teacher', 'parent'
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState(0); // 0 = enter phone, 1 = enter OTP
  const [teacherTodayAttendance, setTeacherTodayAttendance] = useState([]);
  const [teacherClassFeeStructure, setTeacherClassFeeStructure] = useState(null);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(0); // 0 = off, 1 = enter email, 2 = verify OTP, 3 = reset password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' }
  const [isInitializing, setIsInitializing] = useState(!!localStorage.getItem('admin_token'));

  const hasPermission = (perm) => {
    if (role === 'Super Admin' || role === 'School Admin') return true;
    return permissions.includes(perm);
  };

  // Multi-Tenant URL Detection (on mount / history changes)
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  


  // Super Admin Specific States
  const [schools, setSchools] = useState([]);
  const [superStats, setSuperStats] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', contact_person: '', phone: '', plan_id: '' });
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [simpleConfirm, setSimpleConfirm] = useState(null);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(null); // holds school object to extend
  const [extendMonths, setExtendMonths] = useState(12);
  
  // Super Admin Subscription Management States
  const [superPlans, setSuperPlans] = useState([]);
  const [superSubscriptions, setSuperSubscriptions] = useState([]);
  const [superAuditLogs, setSuperAuditLogs] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const activePlans = availablePlans.filter(p => Number(p.is_active) !== 0);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [showEditPlanModal, setShowEditPlanModal] = useState(null); // holds plan object
  const [showManualSubModal, setShowManualSubModal] = useState(null); // holds subscription/school object
  const [planForm, setPlanForm] = useState({ name: '', duration_days: '', price: '', is_active: 1, description: '' });
  const [manualSubForm, setManualSubForm] = useState({ plan_id: '', action_type: 'Activate', start_date: '', expiry_date: '' });
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingSub, setIsSavingSub] = useState(false);

  // School Admin Setup Wizard States
  const [wizardStep, setWizardStep] = useState(1); // 1 to 5
  const [wizardForm, setWizardForm] = useState({
    name: '',
    logo_path: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234f46e5"/><path d="M50 25 L80 40 L50 55 L20 40 Z" fill="%23ffffff"/><path d="M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5" fill="%23ffffff" opacity="0.9"/><path d="M72 43 L72 65 L75 65 L75 43 Z" fill="%23f59e0b"/><circle cx="73.5" cy="67" r="3" fill="%23f59e0b"/></svg>',
    address: '',
    contact_person: '',
    contact_number: ''
  });

  // School Admin Database States (Isolated)
  const [years, setYears] = useState([
    { id: 1, year_range: "2024-2025", start_date: "2024-04-01", end_date: "2025-03-31", description: "Past session", status: "Archived", is_active: false, created_at: "2024-04-01 00:00:00" },
    { id: 2, year_range: "2025-2026", start_date: "2025-04-01", end_date: "2026-03-31", description: "Active session", status: "Active", is_active: true, created_at: "2025-04-01 00:00:00" }
  ]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [schoolName, setSchoolName] = useState(() => localStorage.getItem('admin_school_name') || 'BN School');

  // Selected sub-view states
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [teacherSalaries, setTeacherSalaries] = useState([]);
  const [studentFees, setStudentFees] = useState([]);
  const [selectedMonthsForPayment, setSelectedMonthsForPayment] = useState([]);
  const [isFeeStructureConfigured, setIsFeeStructureConfigured] = useState(true);
  const [showFeeConfigRequiredModal, setShowFeeConfigRequiredModal] = useState(false);

  const [selectedMemberClass, setSelectedMemberClass] = useState(null);
  const [selectedMemberStudent, setSelectedMemberStudent] = useState(null);
  const [selectedMemberTeacher, setSelectedMemberTeacher] = useState(null);
  const [memberStudentFees, setMemberStudentFees] = useState([]);
  const [memberTeacherSalaries, setMemberTeacherSalaries] = useState([]);
  const [memberDetailTab, setMemberDetailTab] = useState('fees');
  const [isLoadingMemberDetails, setIsLoadingMemberDetails] = useState(false);

  // Groups and Custom Classroom states
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [newClassForm, setNewClassForm] = useState({ name: '', room: '', groups: [] });
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [editClassForm, setEditClassForm] = useState({ name: '' });
  const [groupFilter, setGroupFilter] = useState('all');
  
  // Receipt Modal state
  const [receiptRecord, setReceiptRecord] = useState(null);
  const [receiptStudent, setReceiptStudent] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState('All');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [visibleTeachersCount, setVisibleTeachersCount] = useState(9);
  const [isFetchingMoreTeachers, setIsFetchingMoreTeachers] = useState(false);
  
  // Modals state
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showAllNotificationsModal, setShowAllNotificationsModal] = useState(false);
  const [showSalaryDrilldown, setShowSalaryDrilldown] = useState(null);
  const [salaryDrilldownData, setSalaryDrilldownData] = useState([]);
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);
  const [teacherProfileBackTab, setTeacherProfileBackTab] = useState(null);
  const skipSPFetchRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const [activeTeacherMenuId, setActiveTeacherMenuId] = useState(null);
  const [activeClassMenuId, setActiveClassMenuId] = useState(null);
  const [activeStudentMenuId, setActiveStudentMenuId] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [sErrors, setSErrors] = useState({});
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isFetchingMoreStudents, setIsFetchingMoreStudents] = useState(false);
  const [visibleFeesStudentsCount, setVisibleFeesStudentsCount] = useState(10);
  const [isFetchingMoreFeesStudents, setIsFetchingMoreFeesStudents] = useState(false);
  const [selectedViewSchool, setSelectedViewSchool] = useState(null);
  const [activeSchoolMenuId, setActiveSchoolMenuId] = useState(null);
  const [showEditSchoolModal, setShowEditSchoolModal] = useState(null);
  const [editSchoolForm, setEditSchoolForm] = useState({ name: '', status: '', subscription_end: '', contact_person: '', contact_number: '' });
  const [isSavingSchool, setIsSavingSchool] = useState(false);
  const [schoolDetailsData, setSchoolDetailsData] = useState(null);
  const [isLoadingSchoolDetails, setIsLoadingSchoolDetails] = useState(false);
  const [schoolDetailsTab, setSchoolDetailsTab] = useState('overview');

  // Academic Planner & Subject/Schedules States
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [plannerClassId, setPlannerClassId] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: []
  });

  const [weekStartDate, setWeekStartDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [selectedDaySubject, setSelectedDaySubject] = useState({});
  const [selectedDayTeacher, setSelectedDayTeacher] = useState({});


  // Faculty enhancements states
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [allWeeklySchedules, setAllWeeklySchedules] = useState([]);
  const [facultySelectedDate, setFacultySelectedDate] = useState(() => {
    const stored = localStorage.getItem('bn_faculty_selected_date');
    if (stored) return stored;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const handleFacultyDateChange = (val) => {
    setFacultySelectedDate(val);
    localStorage.setItem('bn_faculty_selected_date', val);
  };

  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 480;
    const matchAmPm = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (matchAmPm) {
      let hours = parseInt(matchAmPm[1]);
      const minutes = parseInt(matchAmPm[2]);
      const ampm = matchAmPm[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    const match24 = timeStr.match(/(\d+):(\d+)/);
    if (match24) {
      const hours = parseInt(match24[1]);
      const minutes = parseInt(match24[2]);
      return hours * 60 + minutes;
    }
    return 480;
  };

  const formatMinutesToTime = (minutes) => {
    const hours24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    const padMins = String(mins).padStart(2, '0');
    const padHours = String(hours12).padStart(2, '0');
    return `${padHours}:${padMins} ${ampm}`;
  };

  const [schoolStartTime, setSchoolStartTime] = useState(() => {
    return localStorage.getItem('bn_settings_school_start_time') || '08:00 AM';
  });
  const [periodDuration, setPeriodDuration] = useState(() => {
    const stored = localStorage.getItem('bn_settings_period_duration');
    return stored ? parseInt(stored) : 40;
  });
  const [intervalDuration, setIntervalDuration] = useState(() => {
    const stored = localStorage.getItem('bn_settings_interval_duration');
    return stored ? parseInt(stored) : 20;
  });
  const [intervalAfterPeriod, setIntervalAfterPeriod] = useState(() => {
    const stored = localStorage.getItem('bn_settings_interval_after_period');
    return stored ? parseInt(stored) : 4;
  });
  const [totalPeriodsPerDay, setTotalPeriodsPerDay] = useState(() => {
    const stored = localStorage.getItem('bn_settings_total_periods');
    return stored ? parseInt(stored) : 8;
  });

  const [draftSchoolStartTime, setDraftSchoolStartTime] = useState(() => {
    return localStorage.getItem('bn_settings_school_start_time') || '08:00 AM';
  });
  const [draftPeriodDuration, setDraftPeriodDuration] = useState(() => {
    const stored = localStorage.getItem('bn_settings_period_duration');
    return stored ? parseInt(stored) : 40;
  });
  const [draftIntervalDuration, setDraftIntervalDuration] = useState(() => {
    const stored = localStorage.getItem('bn_settings_interval_duration');
    return stored ? parseInt(stored) : 20;
  });
  const [draftIntervalAfterPeriod, setDraftIntervalAfterPeriod] = useState(() => {
    const stored = localStorage.getItem('bn_settings_interval_after_period');
    return stored ? parseInt(stored) : 4;
  });
  const [draftTotalPeriods, setDraftTotalPeriods] = useState(() => {
    const stored = localStorage.getItem('bn_settings_total_periods');
    return stored ? parseInt(stored) : 8;
  });

  const [previousTab, setPreviousTab] = useState('dashboard');
  const [pendingTabChange, setPendingTabChange] = useState(null);
  const [showUnsavedConfirmModal, setShowUnsavedConfirmModal] = useState(false);

  const getPeriodTimingString = (periodNumber) => {
    const startMinutes = parseTimeToMinutes(schoolStartTime);
    const p = parseInt(periodNumber) || 1;
    const pDur = parseInt(periodDuration) || 40;
    const iDur = parseInt(intervalDuration) || 20;
    const iAfter = parseInt(intervalAfterPeriod) || 4;
    
    const startTimeMinutes = startMinutes + (p - 1) * pDur + (p - 1 >= iAfter ? iDur : 0);
    const endTimeMinutes = startTimeMinutes + pDur;
    
    return `${formatMinutesToTime(startTimeMinutes)} - ${formatMinutesToTime(endTimeMinutes)}`;
  };

  const getDraftPeriodTimingString = (periodNumber) => {
    const startMinutes = parseTimeToMinutes(draftSchoolStartTime);
    const p = parseInt(periodNumber) || 1;
    const pDur = parseInt(draftPeriodDuration) || 40;
    const iDur = parseInt(draftIntervalDuration) || 20;
    const iAfter = parseInt(draftIntervalAfterPeriod) || 4;
    
    const startTimeMinutes = startMinutes + (p - 1) * pDur + (p - 1 >= iAfter ? iDur : 0);
    const endTimeMinutes = startTimeMinutes + pDur;
    
    return `${formatMinutesToTime(startTimeMinutes)} - ${formatMinutesToTime(endTimeMinutes)}`;
  };

  const convertTimeTo24h = (timeStr) => {
    if (!timeStr) return "08:00";
    const minutes = parseTimeToMinutes(timeStr);
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const periodDurationError = draftPeriodDuration <= 0 ? 'Period duration must be greater than 0.' : null;
  const totalPeriodsError = draftTotalPeriods <= 0 ? 'Total periods must be greater than 0.' : null;
  const intervalDurationError = draftIntervalDuration < 0 ? 'Interval duration cannot be negative.' : null;
  const intervalAfterPeriodError = (draftIntervalAfterPeriod < 0 || draftIntervalAfterPeriod > draftTotalPeriods) ? 'Interval after period cannot exceed total periods.' : null;

  const hasValidationErrors = !!(periodDurationError || totalPeriodsError || intervalDurationError || intervalAfterPeriodError);

  const hasUnsavedChanges = 
    draftSchoolStartTime !== schoolStartTime ||
    draftPeriodDuration !== periodDuration ||
    draftIntervalDuration !== intervalDuration ||
    draftIntervalAfterPeriod !== intervalAfterPeriod ||
    draftTotalPeriods !== totalPeriodsPerDay;

  // WhatsApp Reminders States
  const [whatsappQueue, setWhatsappQueue] = useState([]);
  const [whatsappProgress, setWhatsappProgress] = useState({ sent: 0, failed: 0, pending: 0, total: 0 });
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);
  const [showWhatsappProgressModal, setShowWhatsappProgressModal] = useState(false);
  const [showWhatsappConfirmModal, setShowWhatsappConfirmModal] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState([]);

  // Dashboard Widget States
  const [dashboardPlannerClassId, setDashboardPlannerClassId] = useState(null);
  const [dashboardTodaySchedule, setDashboardTodaySchedule] = useState(null);
  const [isFetchingDashboardSchedule, setIsFetchingDashboardSchedule] = useState(false);

  // Form Fields
  const [tForm, setTForm] = useState({ 
    name: '', 
    subject: '', 
    phone: '', 
    email: '', 
    qualification: '', 
    experience: '', 
    address: '', 
    joining_date: '', 
    exit_date: '',
    salary_amount: 3000.0, 
    assigned_classes: '',
    gender: 'Male',
    aadhaar_number: '',
    pan_number: '',
    profile_image: '',
    documents: []
  });
  const [sForm, setSForm] = useState({
    name: '',
    roll_number: '',
    sr_no: '',
    class_id: 1,
    group_name: '',
    gender: 'Male',
    phone: '',
    email: '',
    country: '',
    state: '',
    city: '',
    father_name: '',
    mother_name: '',
    address: '',
    date_of_birth: '',
    admission_date: '',
    emergency_contact: '',
    blood_group: '',
    aadhaar_number: '',
    nationality: 'Indian',
    caste: '',
    profile_image: '',
    exit_date: '',
    documents: []
  });

  // Predefined logo choices for the Setup Wizard
  const logoChoices = [
    { name: 'Classic Graduation Cap', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234f46e5"/><path d="M50 25 L80 40 L50 55 L20 40 Z" fill="%23ffffff"/><path d="M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5" fill="%23ffffff" opacity="0.9"/><path d="M72 43 L72 65 L75 65 L75 43 Z" fill="%23f59e0b"/><circle cx="73.5" cy="67" r="3" fill="%23f59e0b"/></svg>' },
    { name: 'Traditional Academy Shield', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230f172a"/><path d="M30 25 C30 25, 50 20, 50 20 C50 20, 70 25, 70 25 C70 45, 70 65, 50 80 C30 65, 30 45, 30 25 Z" fill="%231e3a8a" stroke="%233b82f6" stroke-width="4"/><path d="M50 20 L50 80" stroke="%233b82f6" stroke-width="2"/><path d="M30 45 L70 45" stroke="%233b82f6" stroke-width="2"/><circle cx="40" cy="35" r="4" fill="%23f59e0b"/><circle cx="60" cy="35" r="4" fill="%23f59e0b"/><path d="M50 52 L57 58 L54 66 L50 60 L46 66 L43 58 Z" fill="%23f59e0b"/></svg>' },
    { name: 'Library & Quill', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%230d9488"/><path d="M25 65 C35 60, 50 62, 50 65 C50 62, 65 60, 75 65 L75 35 C65 30, 50 32, 50 35 C50 32, 35 30, 25 35 Z" fill="%23ffffff"/><path d="M50 35 L50 65" stroke="%230d9488" stroke-width="2"/><path d="M68 22 C64 26, 52 42, 48 48 L46 54 L52 52 C58 48, 74 36, 78 32 C82 28, 80 20, 78 20 C76 20, 72 18, 68 22 Z" fill="%23f59e0b"/><path d="M48 48 L52 52" stroke="%23000000" stroke-width="1"/></svg>' },
    { name: 'Modern Campus Crest', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23ea580c"/><path d="M25 70 L75 70 L75 75 L25 75 Z" fill="%23ffffff"/><path d="M30 45 L35 45 L35 70 L30 70 Z" fill="%23ffffff"/><path d="M42 45 L47 45 L47 70 L42 70 Z" fill="%23ffffff"/><path d="M53 45 L58 45 L58 70 L53 70 Z" fill="%23ffffff"/><path d="M65 45 L70 45 L70 70 L65 70 Z" fill="%23ffffff"/><path d="M22 45 L78 45 L50 25 Z" fill="%23ffffff"/></svg>' }
  ];

  // API Config Helper
  const getHeaders = (customToken) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${customToken || token}`
  });

  // Toast Timer Refs
  const toastTimeoutRef = useRef(null);
  const toastRemainingRef = useRef(4000);
  const toastStartTimeRef = useRef(0);

  const startToastTimer = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastStartTimeRef.current = Date.now();
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, toastRemainingRef.current);
  };

  const pauseToastTimer = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
      const elapsed = Date.now() - toastStartTimeRef.current;
      toastRemainingRef.current = Math.max(500, toastRemainingRef.current - elapsed);
    }
  };

  const resumeToastTimer = () => {
    if (toast && !toastTimeoutRef.current) {
      startToastTimer();
    }
  };

  // Toast Helper
  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ message, type });
    toastRemainingRef.current = 4000;
  };

  // Toast Timer Hook
  useEffect(() => {
    if (toast) {
      startToastTimer();
    }
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, [toast]);

  // Document Click Listener to Close Planner Card Dropdowns
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (activeDropdownKey) {
        const isTrigger = e.target.closest('.period-menu-trigger');
        const isDropdown = e.target.closest('.period-menu-dropdown');
        if (!isTrigger && !isDropdown) {
          setActiveDropdownKey(null);
        }
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [activeDropdownKey]);

  // Reset Student Form Validation Errors on Modal open/close
  useEffect(() => {
    setSErrors({});
  }, [showAddStudentModal]);

  // Reset student & teacher lazy loading/search state when view context changes
  useEffect(() => {
    setVisibleCount(6);
    setVisibleTeachersCount(9);
    setTeacherSearchQuery('');
  }, [selectedClassId, searchQuery, groupFilter, activeTab]);

  // If container does not have a scrollbar but we have more records, load more to enable scrollbar
  useEffect(() => {
    if (!selectedClassId) return;
    const container = document.querySelector('.sp-table-container');
    if (!container) return;
    
    const classStudents = students.filter(s => s.class_id === selectedClassId);
    const filteredLength = classStudents.filter(s => {
      const matchesGroup = groupFilter === 'all' || s.group_name === groupFilter;
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesGroup && matchesSearch;
    }).length;

    const hasMore = visibleCount < filteredLength;
    const noScrollbar = container.scrollHeight <= container.clientHeight;
    
    if (hasMore && noScrollbar) {
      setVisibleCount(prev => prev + 6);
    }
  }, [visibleCount, students, selectedClassId, searchQuery, groupFilter]);

  // Reset teacher lazy loading visible count when filters change
  useEffect(() => {
    setVisibleTeachersCount(9);
  }, [teacherSearchQuery, subjectFilter, statusFilter, facultySelectedDate]);

  // Handle infinite scroll / lazy loading for Teachers
  useEffect(() => {
    if (activeTab !== 'faculty') return;

    const handleScroll = (e) => {
      const container = e.target;
      if (!container) return;

      // Check if user has scrolled close to the bottom of the container
      const threshold = 100; // px from bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

      const filteredLength = teachers.filter(t => {
        const matchesSubject = subjectFilter === 'all' || t.subject.toLowerCase() === subjectFilter.toLowerCase();
        const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();
        const matchesSearch = t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) || 
                              t.subject.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                              (t.phone && t.phone.includes(teacherSearchQuery));
        return matchesSubject && matchesStatus && matchesSearch;
      }).length;

      if (isNearBottom && visibleTeachersCount < filteredLength && !isFetchingMoreTeachers) {
        setIsFetchingMoreTeachers(true);
        setTimeout(() => {
          setVisibleTeachersCount(prev => prev + 6);
          setIsFetchingMoreTeachers(false);
        }, 300);
      }
    };

    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (mainWrapper) {
        mainWrapper.removeEventListener('scroll', handleScroll);
      }
    };
  }, [activeTab, visibleTeachersCount, teachers, subjectFilter, statusFilter, teacherSearchQuery, isFetchingMoreTeachers]);

  // If main-wrapper does not have a scrollbar but we have more teacher records, load more to enable scrollbar
  useEffect(() => {
    if (activeTab !== 'faculty') return;
    const container = document.querySelector('.main-wrapper');
    if (!container) return;

    const filteredLength = teachers.filter(t => {
      const matchesSubject = subjectFilter === 'all' || t.subject.toLowerCase() === subjectFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch = t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) || 
                            t.subject.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                            (t.phone && t.phone.includes(teacherSearchQuery));
      return matchesSubject && matchesStatus && matchesSearch;
    }).length;

    const hasMore = visibleTeachersCount < filteredLength;
    const noScrollbar = container.scrollHeight <= container.clientHeight;

    if (hasMore && noScrollbar) {
      setVisibleTeachersCount(prev => prev + 6);
    }
  }, [visibleTeachersCount, teachers, subjectFilter, statusFilter, teacherSearchQuery, activeTab]);


  // Synchronize dashboard student count automatically
  useEffect(() => {
    const count = students.filter(s => s.academic_year_id === activeYearId).length;
    setDashboardStats(prev => {
      if (!prev) return null;
      if (prev.total_students === count) return prev;
      return { ...prev, total_students: count };
    });
  }, [students, activeYearId]);

  // Auto-expand address textarea when address state changes
  useEffect(() => {
    if (showAddStudentModal) {
      const timer = setTimeout(() => {
        const textarea = document.getElementById('s-address');
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [sForm.address, showAddStudentModal]);

  // Synchronize dashboard faculty count automatically
  useEffect(() => {
    const count = teachers.length;
    setDashboardStats(prev => {
      if (!prev) return null;
      if (prev.total_teachers === count) return prev;
      return { ...prev, total_teachers: count };
    });
  }, [teachers]);

  // Synchronize dashboard classroom count automatically
  useEffect(() => {
    const count = classes.length;
    setDashboardStats(prev => {
      if (!prev) return null;
      if (prev.active_classes === count) return prev;
      return { ...prev, active_classes: count };
    });
  }, [classes]);

  // Synchronize history paths
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Reset fees student lazy loading visible count when filters change
  useEffect(() => {
    setVisibleFeesStudentsCount(10);
  }, [selectedFeesClassId, feesStatusFilter, searchQuery, feesSortField, activeTab, activeYearId]);

  // If main-wrapper does not have a scrollbar but we have more fees records, load more to enable scrollbar
  useEffect(() => {
    if (activeTab !== 'fees' || selectedStudent) return;
    const container = document.querySelector('.main-wrapper');
    if (!container) return;

    const filteredLength = students
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
      }).length;

    const hasMore = visibleFeesStudentsCount < filteredLength;
    const noScrollbar = container.scrollHeight <= container.clientHeight;

    if (hasMore && noScrollbar) {
      setVisibleFeesStudentsCount(prev => prev + 10);
    }
  }, [visibleFeesStudentsCount, students, selectedFeesClassId, feesStatusFilter, searchQuery, activeTab, selectedStudent]);

  // Handle infinite scroll / lazy loading for Fees Student List
  useEffect(() => {
    if (activeTab !== 'fees' || selectedStudent) return;

    const handleScroll = (e) => {
      const container = e.target;
      if (!container) return;

      const threshold = 100;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

      const filteredLength = students
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
        }).length;

      if (isNearBottom && visibleFeesStudentsCount < filteredLength && !isFetchingMoreFeesStudents) {
        setIsFetchingMoreFeesStudents(true);
        setTimeout(() => {
          setVisibleFeesStudentsCount(prev => prev + 10);
          setIsFetchingMoreFeesStudents(false);
        }, 500);
      }
    };

    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (mainWrapper) {
        mainWrapper.removeEventListener('scroll', handleScroll);
      }
    };
  }, [
    activeTab,
    selectedStudent,
    visibleFeesStudentsCount,
    students,
    selectedFeesClassId,
    feesStatusFilter,
    searchQuery,
    isFetchingMoreFeesStudents
  ]);

  // Automatically reset scroll position when navigating to student ledger
  useEffect(() => {
    if (selectedStudent) {
      window.scrollTo(0, 0);
      const wrapper = document.querySelector('.main-wrapper');
      if (wrapper) {
        wrapper.scrollTop = 0;
      }
      fetchStudentExtraFees();
    }
  }, [selectedStudent]);

  // Reset scroll count when Additional Fee filters change
  useEffect(() => {
    setVisibleAdditionalFeeStudentsCount(10);
  }, [extraFeeSearch, extraFeeClassFilter, extraFeeTypeFilter, extraFeeStatusFilter]);

  // Lazy Loading for Additional Fee Ledger
  useEffect(() => {
    if (activeTab !== 'finance_management' || financeManagementSubTab !== 'fees') return;

    const handleScroll = () => {
      const container = document.querySelector('.main-wrapper');
      if (!container) return;

      const threshold = 100;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

      const filteredLength = studentExtraFees
        .filter(sef => {
          const matchesSearch = sef.student_name.toLowerCase().includes(extraFeeSearch.toLowerCase());
          const matchesClass = extraFeeClassFilter === 'All' || String(sef.class_id) === String(extraFeeClassFilter);
          const matchesType = extraFeeTypeFilter === 'All' || sef.fee_name === extraFeeTypeFilter;
          const matchesStatus = extraFeeStatusFilter === 'All' || sef.status === extraFeeStatusFilter;
          return matchesSearch && matchesClass && matchesType && matchesStatus;
        }).length;

      if (isNearBottom && visibleAdditionalFeeStudentsCount < filteredLength && !isFetchingMoreAdditionalFeeStudents) {
        setIsFetchingMoreAdditionalFeeStudents(true);
        setTimeout(() => {
          setVisibleAdditionalFeeStudentsCount(prev => prev + 10);
          setIsFetchingMoreAdditionalFeeStudents(false);
        }, 500);
      }
    };

    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (mainWrapper) {
        mainWrapper.removeEventListener('scroll', handleScroll);
      }
    };
  }, [
    activeTab,
    financeManagementSubTab,
    visibleAdditionalFeeStudentsCount,
    studentExtraFees,
    extraFeeClassFilter,
    extraFeeTypeFilter,
    extraFeeStatusFilter,
    extraFeeSearch,
    isFetchingMoreAdditionalFeeStudents
  ]);

  // --- ACADEMIC PLANNER METHODS ---
  const fetchSubjects = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_subjects_${keySuffix}`);
      const local = stored ? JSON.parse(stored) : [
        { id: 1, name: 'English' },
        { id: 2, name: 'Mathematics' },
        { id: 3, name: 'Science' },
        { id: 4, name: 'Hindi' },
        { id: 5, name: 'Social Studies' },
        { id: 6, name: 'Drawing' },
        { id: 7, name: 'Computer' }
      ];
      setSubjects(local);
      return;
    }
    try {
      const res = await fetch('/api/subjects', { headers: getHeaders() });
      if (res.ok) {
        setSubjects(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    }
  };

  const fetchSchedules = async (classId) => {
    if (!classId) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${classId}`;
      const stored = localStorage.getItem(storedKey);
      const list = stored ? JSON.parse(stored) : [];
      const filtered = list.filter(s => s.week_start_date === weekStartDate);
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const results = [...filtered];
      const existingDays = results.map(r => r.day_of_week);
      
      days.forEach((dayName, dayIndex) => {
        if (!existingDays.includes(dayName)) {
          const refMonday = new Date(weekStartDate);
          const d = new Date(refMonday);
          d.setDate(refMonday.getDate() + dayIndex);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const targetDate = `${yyyy}-${mm}-${dd}`;
          
          let priorRecord = null;
          list.forEach(s => {
            if (s.day_of_week === dayName && s.schedule_date < targetDate) {
              if (!priorRecord || s.schedule_date > priorRecord.schedule_date) {
                priorRecord = s;
              }
            }
          });
          
          if (priorRecord) {
            const inheritedSubjects = (priorRecord.subjects || []).map(sub => ({
              ...sub,
              backup_teacher_id: null,
              backup_teacher_name: null
            }));
            
            results.push({
              id: Date.now() + Math.random(),
              school_id: keySuffix,
              academic_year_id: activeYearId,
              class_id: classId,
              day_of_week: dayName,
              schedule_date: targetDate,
              week_start_date: weekStartDate,
              subjects: inheritedSubjects,
              status: 'Draft'
            });
          }
        }
      });
      
      results.sort((a, b) => a.schedule_date.localeCompare(b.schedule_date));
      setSchedules(results);
      return;
    }
    try {
      const res = await fetch(`/api/schedules?class_id=${classId}&academic_year_id=${activeYearId}&week_start_date=${weekStartDate}`, { headers: getHeaders() });
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch schedules", err);
    }
  };


  const handleSaveFullSchedule = async (statusVal = 'Draft') => {
    if (!plannerClassId) return;
    const hasPeriods = Object.values(scheduleForm).some(periods => Array.isArray(periods) && periods.length > 0);
    if (!hasPeriods) {
      showToast("No periods are assigned. Please assign at least one period before saving.", "error");
      return;
    }
    setIsSavingSchedule(true);
    setActionError('');
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const refMonday = new Date(weekStartDate);
    const scheduleDates = {};
    days.forEach((day, idx) => {
      const d = new Date(refMonday);
      d.setDate(refMonday.getDate() + idx);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      scheduleDates[day] = `${yyyy}-${mm}-${dd}`;
    });
    
    try {
      const keySuffix = schoolId || 'default';
      if (token.includes('mock') || !isConnected) {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${plannerClassId}`;
        const stored = localStorage.getItem(storedKey);
        let list = stored ? JSON.parse(stored) : [];
        
        days.forEach(day => {
          const daySubjects = scheduleForm[day] || [];
          const schedDate = scheduleDates[day];
          const existingIdx = list.findIndex(s => s.schedule_date === schedDate);
          
          const scheduleObj = {
            id: existingIdx !== -1 ? list[existingIdx].id : (Date.now() + Math.random()),
            school_id: keySuffix,
            academic_year_id: activeYearId,
            class_id: plannerClassId,
            day_of_week: day,
            schedule_date: schedDate,
            week_start_date: weekStartDate,
            subjects: daySubjects,
            status: statusVal
          };
          if (existingIdx !== -1) {
            list[existingIdx] = scheduleObj;
          } else {
            list.push(scheduleObj);
          }
        });
        
        localStorage.setItem(storedKey, JSON.stringify(list));
        setSchedules(list.filter(s => s.week_start_date === weekStartDate));
        
        const newLog = {
          id: Date.now(),
          operator: username || 'Admin',
          action: `Schedule ${statusVal}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          details: `Saved weekly schedule as ${statusVal} for class ID ${plannerClassId} on week of ${weekStartDate}.`
        };
        setAuditLogs(prev => [newLog, ...prev]);
        showToast(`Schedule saved as ${statusVal} successfully!`, 'success');
        fetchAllWeeklySchedules();
        return;
      }
      
      // Live DB Mode
      for (const day of days) {
        const daySubjects = scheduleForm[day] || [];
        const schedDate = scheduleDates[day];
        
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            class_id: plannerClassId,
            academic_year_id: activeYearId,
            day_of_week: day,
            schedule_date: schedDate,
            week_start_date: weekStartDate,
            subjects: daySubjects,
            status: statusVal
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || `Failed to save schedule for ${day}`);
        }
      }
      
      await fetchSchedules(plannerClassId);
      
      const resAudit = await fetch('/api/audit-logs', { headers: getHeaders() });
      if (resAudit.ok) setAuditLogs(await resAudit.json());
      
      showToast(`Schedule saved as ${statusVal} successfully!`, 'success');
      fetchAllWeeklySchedules();
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Failed to save schedule");
      showToast(err.message || "Failed to save schedule", 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveDaySchedule = async (day, statusVal = 'Draft') => {
    if (!plannerClassId) return;
    const daySubjects = scheduleForm[day] || [];
    if (daySubjects.length === 0) {
      showToast("No periods assigned for this day.", "error");
      return;
    }
    setIsSavingSchedule(true);
    setActionError('');
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = days.indexOf(day);
    if (idx === -1) {
      setIsSavingSchedule(false);
      return;
    }
    
    const refMonday = new Date(weekStartDate);
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + idx);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const schedDate = `${yyyy}-${mm}-${dd}`;
    
    try {
      const keySuffix = schoolId || 'default';
      if (token.includes('mock') || !isConnected) {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${plannerClassId}`;
        const stored = localStorage.getItem(storedKey);
        let list = stored ? JSON.parse(stored) : [];
        
        const existingIdx = list.findIndex(s => s.schedule_date === schedDate);
        
        const scheduleObj = {
          id: existingIdx !== -1 ? list[existingIdx].id : (Date.now() + Math.random()),
          school_id: keySuffix,
          academic_year_id: activeYearId,
          class_id: plannerClassId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal
        };
        if (existingIdx !== -1) {
          list[existingIdx] = scheduleObj;
        } else {
          list.push(scheduleObj);
        }
        
        localStorage.setItem(storedKey, JSON.stringify(list));
        setSchedules(list.filter(s => s.week_start_date === weekStartDate));
        
        const newLog = {
          id: Date.now(),
          operator: username || 'Admin',
          action: `${day} saved as ${statusVal}`,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          details: `Saved ${day} schedule as ${statusVal} for class ID ${plannerClassId} on week of ${weekStartDate}.`
        };
        setAuditLogs(prev => [newLog, ...prev]);
        showToast(`${day} schedule saved as ${statusVal} successfully!`, 'success');
        fetchAllWeeklySchedules();
        return;
      }
      
      // Live DB Mode
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: plannerClassId,
          academic_year_id: activeYearId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || `Failed to save schedule for ${day}`);
      }
      
      await fetchSchedules(plannerClassId);
      await fetchAllWeeklySchedules();
      
      const resAudit = await fetch('/api/audit-logs', { headers: getHeaders() });
      if (resAudit.ok) setAuditLogs(await resAudit.json());
      
      showToast(`${day} schedule saved as ${statusVal} successfully!`, 'success');
    } catch (err) {
      console.error(err);
      setActionError(err.message || "Failed to save schedule");
      showToast(err.message || "Failed to save schedule", 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const autoSaveDaySchedule = async (day, daySubjects, statusVal = 'Draft', propagate = false, propagateType = '', targetIndex = -1) => {
    if (!plannerClassId) return;
    
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = days.indexOf(day);
    if (idx === -1) return;
    
    const refMonday = new Date(weekStartDate);
    const d = new Date(refMonday);
    d.setDate(refMonday.getDate() + idx);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const schedDate = `${yyyy}-${mm}-${dd}`;
    
    try {
      const keySuffix = schoolId || 'default';
      if (token.includes('mock') || !isConnected) {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${plannerClassId}`;
        const stored = localStorage.getItem(storedKey);
        let list = stored ? JSON.parse(stored) : [];
        
        const existingIdx = list.findIndex(s => s.schedule_date === schedDate);
        
        const scheduleObj = {
          id: existingIdx !== -1 ? list[existingIdx].id : (Date.now() + Math.random()),
          school_id: keySuffix,
          academic_year_id: activeYearId,
          class_id: plannerClassId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal
        };
        if (existingIdx !== -1) {
          list[existingIdx] = scheduleObj;
        } else {
          list.push(scheduleObj);
        }
        
        // Sandbox future weeks propagation
        if (propagate && propagateType) {
          list.forEach(s => {
            if (s.day_of_week === day && s.schedule_date > schedDate) {
              const futSubjects = Array.isArray(s.subjects) ? [...s.subjects] : [];
              let modified = false;
              
              if (propagateType === 'add') {
                if (daySubjects.length > 0) {
                  const newPeriod = { ...daySubjects[daySubjects.length - 1] };
                  newPeriod.backup_teacher_id = null;
                  newPeriod.backup_teacher_name = null;
                  futSubjects.push(newPeriod);
                  modified = true;
                }
              } else if (propagateType === 'remove') {
                if (targetIndex >= 0 && targetIndex < futSubjects.length) {
                  futSubjects.splice(targetIndex, 1);
                  modified = true;
                }
              } else if (propagateType === 'replace') {
                if (targetIndex >= 0 && targetIndex < daySubjects.length && targetIndex < futSubjects.length) {
                  const currentPeriod = daySubjects[targetIndex];
                  futSubjects[targetIndex] = {
                    ...futSubjects[targetIndex],
                    teacher_id: currentPeriod.teacher_id,
                    teacher_name: currentPeriod.teacher_name,
                    backup_teacher_id: null,
                    backup_teacher_name: null
                  };
                  modified = true;
                }
              }
              
              if (modified) {
                s.subjects = futSubjects;
              }
            }
          });
        }
        
        localStorage.setItem(storedKey, JSON.stringify(list));
        setSchedules(list.filter(s => s.week_start_date === weekStartDate));
        fetchAllWeeklySchedules();
        return;
      }
      
      // Live DB Mode
      await fetch('/api/schedules', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: plannerClassId,
          academic_year_id: activeYearId,
          day_of_week: day,
          schedule_date: schedDate,
          week_start_date: weekStartDate,
          subjects: daySubjects,
          status: statusVal,
          propagate,
          propagate_type: propagateType,
          target_index: targetIndex
        })
      });
      await fetchSchedules(plannerClassId);
      await fetchAllWeeklySchedules();
    } catch (err) {
      console.error("Auto-save failed", err);
    }
  };

  const [draggingDay, setDraggingDay] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [scheduleCopyConfirm, setScheduleCopyConfirm] = useState(null);

  const handleCopyDayScheduleDragDrop = (sourceDay, targetDay) => {
    const sourcePeriods = scheduleForm[sourceDay] || [];
    const targetPeriods = scheduleForm[targetDay] || [];
    
    if (sourcePeriods.length === 0) {
      showToast(`No periods in ${sourceDay} to copy.`, "warning");
      return;
    }
    
    const performCopy = () => {
      // Deep copy source periods to target
      const copiedPeriods = JSON.parse(JSON.stringify(sourcePeriods));
      setScheduleForm(prev => ({
        ...prev,
        [targetDay]: copiedPeriods
      }));
      
      // Trigger background auto-save as Draft
      autoSaveDaySchedule(targetDay, copiedPeriods, 'Draft');
      showToast("Schedule copied successfully", "success");
    };
    
    if (targetPeriods.length > 0) {
      setScheduleCopyConfirm({
        targetDay,
        onConfirm: performCopy
      });
    } else {
      performCopy();
    }
  };

  const handleNavigateWeek = (weeksOffset) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + (weeksOffset * 7));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setWeekStartDate(`${yyyy}-${mm}-${dd}`);
  };


  const handleAddSubject = async (e) => {
    e.preventDefault();
    const name = newSubjectName.trim();
    if (!name) return;
    setActionError('');
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_subjects_${keySuffix}`;
      const stored = localStorage.getItem(storedKey);
      let list = stored ? JSON.parse(stored) : [
        { id: 1, name: 'English' },
        { id: 2, name: 'Mathematics' },
        { id: 3, name: 'Science' },
        { id: 4, name: 'Hindi' },
        { id: 5, name: 'Social Studies' },
        { id: 6, name: 'Drawing' },
        { id: 7, name: 'Computer' }
      ];
      
      if (list.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        setActionError("Subject already exists");
        showToast("Subject already exists", 'error');
        return;
      }
      
      const newSub = {
        id: Date.now(),
        school_id: keySuffix,
        name: name
      };
      list.push(newSub);
      localStorage.setItem(storedKey, JSON.stringify(list));
      setSubjects(list);
      setNewSubjectName('');
      showToast("Subject added successfully!", 'success');
      return;
    }
    
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setNewSubjectName('');
        await fetchSubjects();
        showToast("Subject added successfully!", 'success');
      } else {
        const errData = await res.json();
        setActionError(errData.detail || "Failed to add subject");
        showToast(errData.detail || "Failed to add subject", 'error');
      }
    } catch (err) {
      console.error(err);
      setActionError("Failed to add subject");
      showToast("Failed to add subject", 'error');
    }
  };

  const handleEditSubject = async (e) => {
    e.preventDefault();
    const name = editingSubjectName.trim();
    if (!name || !editingSubjectId) return;
    setActionError('');
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_subjects_${keySuffix}`;
      const stored = localStorage.getItem(storedKey);
      let list = stored ? JSON.parse(stored) : [];
      
      if (list.some(s => s.id !== editingSubjectId && s.name.toLowerCase() === name.toLowerCase())) {
        setActionError("Another subject with this name already exists");
        showToast("Another subject with this name already exists", 'error');
        return;
      }
      
      const updated = list.map(s => s.id === editingSubjectId ? { ...s, name } : s);
      localStorage.setItem(storedKey, JSON.stringify(updated));
      setSubjects(updated);
      setEditingSubjectId(null);
      setEditingSubjectName('');
      showToast("Subject updated successfully!", 'success');
      return;
    }
    
    try {
      const res = await fetch(`/api/subjects/${editingSubjectId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        setEditingSubjectId(null);
        setEditingSubjectName('');
        await fetchSubjects();
        showToast("Subject updated successfully!", 'success');
      } else {
        const errData = await res.json();
        setActionError(errData.detail || "Failed to update subject");
        showToast(errData.detail || "Failed to update subject", 'error');
      }
    } catch (err) {
      console.error(err);
      setActionError("Failed to update subject");
      showToast("Failed to update subject", 'error');
    }
  };

  const handleDeleteSubject = async (id) => {
    const keySuffix = schoolId || 'default';
    setActionError('');
    if (token.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_subjects_${keySuffix}`;
      const stored = localStorage.getItem(storedKey);
      let list = stored ? JSON.parse(stored) : [];
      
      const updated = list.filter(s => s.id !== id);
      localStorage.setItem(storedKey, JSON.stringify(updated));
      setSubjects(updated);
      showToast("Subject deleted successfully!", 'success');
      return;
    }
    
    try {
      const res = await fetch(`/api/subjects/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchSubjects();
        showToast("Subject deleted successfully!", 'success');
      } else {
        const errData = await res.json();
        setActionError(errData.detail || "Failed to delete subject");
        showToast(errData.detail || "Failed to delete subject", 'error');
      }
    } catch (err) {
      console.error(err);
      setActionError("Failed to delete subject");
      showToast("Failed to delete subject", 'error');
    }
  };

  const handleTriggerNotifications = async () => {
    setActionError('');
    const keySuffix = schoolId || 'default';
    try {
      const res = await fetch('/api/schedules/trigger-notifications', {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message, 'success');
        if (token.includes('mock') || !isConnected) {
          const storedNotifs = localStorage.getItem(`bn_sandbox_notifications_${keySuffix}`);
          if (storedNotifs) setNotifications(JSON.parse(storedNotifs));
        } else {
          const resNotif = await fetch('/api/notifications', { headers: getHeaders() });
          if (resNotif.ok) setNotifications(await resNotif.json());
        }
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Failed to trigger notifications", 'error');
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to trigger parent notifications", 'error');
    }
  };

  const fetchWhatsappHistory = async () => {
    try {
      const res = await fetch('/api/schedules/whatsapp-reminders/history', { headers: getHeaders() });
      if (res.ok) {
        setWhatsappLogs(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch WhatsApp history", err);
    }
  };

  const handleInitWhatsappReminders = async () => {
    if (!plannerClassId) {
      showToast("Please select a classroom first.", "error");
      return;
    }
    const currentClass = classes.find(c => c.id === plannerClassId);
    const className = currentClass ? currentClass.name : `Class ${plannerClassId}`;
    
    // Check if tomorrow's schedule is published
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tomorrowDay = days[tomorrow.getDay()];
    
    const tomorrowSchedule = schedules.find(s => s.day_of_week.toLowerCase() === tomorrowDay.toLowerCase());
    
    if (!tomorrowSchedule || tomorrowSchedule.status !== 'Published') {
      showToast(`Tomorrow's schedule (${tomorrowDay}) is not published for ${className}. Please publish it first.`, "error");
      return;
    }
    
    setShowWhatsappConfirmModal(true);
  };

  const executeSendWhatsappReminders = async () => {
    setShowWhatsappConfirmModal(false);
    setActionError('');
    setIsSendingWhatsapp(true);
    setShowWhatsappProgressModal(true);
    setWhatsappProgress({ sent: 0, failed: 0, pending: 0, total: 0 });
    
    try {
      const res = await fetch('/api/schedules/whatsapp-reminders/init', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ class_id: plannerClassId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to initialize WhatsApp reminder queue");
      }
      
      const data = await res.json();
      const queue = data.queue || [];
      const total = queue.length;
      
      setWhatsappQueue(queue);
      setWhatsappProgress({ sent: 0, failed: 0, pending: total, total });
      
      await processWhatsappQueue(queue);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to start WhatsApp reminders", "error");
      setIsSendingWhatsapp(false);
      setShowWhatsappProgressModal(false);
    }
  };

  const processWhatsappQueue = async (queue) => {
    let sentCount = 0;
    let failedCount = 0;
    const localQueue = [...queue];
    
    for (let i = 0; i < localQueue.length; i++) {
      const item = localQueue[i];
      setWhatsappProgress(prev => ({
        ...prev,
        pending: prev.total - (sentCount + failedCount) - 1
      }));
      
      try {
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const res = await fetch('/api/schedules/whatsapp-reminders/send-single', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ log_id: item.id })
        });
        
        if (res.ok) {
          const resData = await res.json();
          const updatedLog = resData.log;
          if (updatedLog) {
            localQueue[i] = updatedLog;
            setWhatsappQueue([...localQueue]);
            
            if (updatedLog.status === 'Sent') {
              sentCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error(err);
        failedCount++;
      }
      
      setWhatsappProgress(prev => ({
        ...prev,
        sent: sentCount,
        failed: failedCount
      }));
    }
    
    setIsSendingWhatsapp(false);
    showToast("WhatsApp reminders sent successfully.", "success");
    fetchWhatsappHistory();
  };

  const fetchDashboardTodaySchedule = async (classId) => {
    if (!classId) return;
    setIsFetchingDashboardSchedule(true);
    const keySuffix = schoolId || 'default';
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const todayDate = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (token.includes('mock') || !isConnected) {
      const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${classId}`;
      const stored = localStorage.getItem(storedKey);
      const list = stored ? JSON.parse(stored) : [];
      const todaySched = list.find(s => s.schedule_date === todayDate && s.status === 'Published');
      
      setDashboardTodaySchedule({
        day_of_week: dayOfWeek,
        schedule_date: todayDate,
        subjects: todaySched ? todaySched.subjects : [],
        status: todaySched ? todaySched.status : 'Published'
      });
      setIsFetchingDashboardSchedule(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/schedules/today?class_id=${classId}&date=${todayDate}`, { headers: getHeaders() });
      if (res.ok) {
        setDashboardTodaySchedule(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingDashboardSchedule(false);
    }
  };

  const fetchAllWeeklySchedules = async () => {
    const keySuffix = schoolId || 'default';
    
    // Calculate week start date (Monday) for the selected faculty date in local time
    const localDate = new Date(facultySelectedDate);
    const day = localDate.getDay();
    const diff = localDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(localDate.setDate(diff));
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    const currentWeekStart = `${yyyy}-${mm}-${dd}`;

    if (token.includes('mock') || !isConnected) {
      let combined = [];
      classes.forEach(c => {
        const storedKey = `bn_sandbox_schedules_${keySuffix}_${activeYearId}_${c.id}`;
        const stored = localStorage.getItem(storedKey);
        if (stored) {
          const list = JSON.parse(stored);
          const filtered = list.filter(s => s.week_start_date === currentWeekStart && (s.status === 'Published' || s.status === 'Draft'));
          combined = combined.concat(filtered);
        }
      });
      setAllWeeklySchedules(combined);
      return;
    }
    try {
      const res = await fetch(`/api/schedules/all-weekly?academic_year_id=${activeYearId}&week_start_date=${currentWeekStart}`, { headers: getHeaders() });
      if (res.ok) {
        setAllWeeklySchedules(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch all weekly schedules", err);
    }
  };

  useEffect(() => {
    if (activeTab === 'faculty' && classes.length > 0) {
      fetchAllWeeklySchedules();
    }
  }, [activeTab, classes, activeYearId, facultySelectedDate]);

  useEffect(() => {
    if (skipSPFetchRef.current) {
      skipSPFetchRef.current = false;
      return;
    }
    if (activeTab === 'students') {
      fetchSPData();
    } else if (activeTab === 'dashboard') {
      if (role === 'Super Admin') {
        fetchSuperAdminData(null, false);
      } else {
        fetchSPData();
      }
    } else if (activeTab === 'settings') {
      fetchRolesAndUsers();
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchExams(activeYearId);
      fetchSchoolSignatures();
      fetchGradingScales();

      // Enforce active academic year date restriction
      const activeYear = years.find(y => y.id === activeYearId);
      const todayStr = getLocalDateString();
      let defaultDate = todayStr;
      if (activeYear) {
        if (todayStr < activeYear.start_date) {
          defaultDate = activeYear.start_date;
        } else if (todayStr > activeYear.end_date) {
          defaultDate = activeYear.end_date;
        }
      }
      setAttendanceDate(defaultDate);

      let targetClassId = attendanceClassId;
      if (classes.length > 0) {
        if (!attendanceClassId) {
          targetClassId = String(classes[0].id);
          setAttendanceClassId(targetClassId);
        }
        if (!reportCardClassId) setReportCardClassId(String(classes[0].id));
      }

      if (performanceSubTab === 'attendance' && attendanceMode === 'mark' && targetClassId) {
        setAttendanceStudents([]); // Prevent stale data
        fetchAttendance(targetClassId, defaultDate, activeYearId, attendanceGroupName);
      }
    }
  }, [activeTab, activeYearId, classes, performanceSubTab]);

  useEffect(() => {
    if (selectedStudent && studentDetailTab === 'performance') {
      fetchStudentAttendanceAnalytics(selectedStudent.id, activeYearId);
      fetchStudentPerformanceSummary(selectedStudent.id, activeYearId);
      fetchExams(activeYearId);
    }
  }, [selectedStudent, studentDetailTab, activeYearId]);

  useEffect(() => {
    if (reportCardStudentId) {
      fetchStudentPerformanceSummary(reportCardStudentId, activeYearId);
    }
  }, [reportCardStudentId, activeYearId]);

  // Automatically reset scroll position when navigating to dashboard
  useEffect(() => {
    if (activeTab === 'dashboard') {
      window.scrollTo(0, 0);
      const wrapper = document.querySelector('.main-wrapper');
      if (wrapper) {
        wrapper.scrollTop = 0;
      }
    }
  }, [activeTab]);

  // Reset search queries, filters, and report preview on tab navigation
  useEffect(() => {
    setSearchQuery('');
    setTeacherSearchQuery('');
    setFeesStatusFilter('All');
    setGroupFilter('all');
    setStatusFilter('all');
    setStudentStatusFilter('All');
    setExtraFeeSearch('');
    setExtraFeeClassFilter('All');
    setExtraFeeTypeFilter('All');
    setExtraFeeStatusFilter('All');
    setPromiseSearch('');
    setPromiseClassFilter('All');
    setPromiseStudentSearchQuery('');
    if (activeTab !== 'financial') {
      setReportPreview(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'financial') {
      fetchFinancialReports();
    }
    if (activeTab === 'finance_management') {
      fetchExpenses();
      fetchExtraFeeTypes();
      fetchStudentExtraFees();
      fetchPaymentPromises();
      fetchPreviousYearRecoveries();
      fetchPreviousDues();
    }
  }, [activeTab, activeYearId]);

  // --- ACADEMIC PLANNER SYNC EFFECTS ---
  useEffect(() => {
    if (activeTab === 'planner') {
      fetchSubjects();
      if (classes.length > 0) {
        if (!plannerClassId) {
          setPlannerClassId(classes[0].id);
        } else {
          fetchSchedules(plannerClassId);
        }
      }
    }
  }, [activeTab, plannerClassId, classes, activeYearId, weekStartDate]);

  useEffect(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const initial = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
    schedules.forEach(s => {
      const dayName = days.find(d => d.toLowerCase() === s.day_of_week.toLowerCase());
      if (dayName) {
        initial[dayName] = Array.isArray(s.subjects) ? s.subjects : [];
      }
    });
    setScheduleForm(initial);
  }, [schedules]);

  useEffect(() => {
    if (classes.length > 0 && !dashboardPlannerClassId) {
      setDashboardPlannerClassId(classes[0].id);
    }
  }, [classes, dashboardPlannerClassId]);

  useEffect(() => {
    if (activeTab === 'dashboard' && dashboardPlannerClassId) {
      fetchDashboardTodaySchedule(dashboardPlannerClassId);
    }
  }, [dashboardPlannerClassId, activeTab, activeYearId]);


  // Click outside handler for notification drawer
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const triggers = document.querySelectorAll('#notification-trigger');
      const drawers = document.querySelectorAll('.notification-drawer-content');
      
      let clickedInside = false;
      triggers.forEach(t => {
        if (t && t.contains(e.target)) clickedInside = true;
      });
      drawers.forEach(d => {
        if (d && d.contains(e.target)) clickedInside = true;
      });
      
      if (!clickedInside && showNotificationDrawer) {
        setShowNotificationDrawer(false);
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showNotificationDrawer]);

  const formatNotificationTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      // Handle SQL space separator if present
      const cleanStr = dateStr.replace(' ', 'T');
      const d = new Date(cleanStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const optionsDate = { month: 'short', day: 'numeric', year: 'numeric' };
      const formattedDate = d.toLocaleDateString('en-US', optionsDate);
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedTime = `${hours}:${minutes} ${ampm}`;
      
      return `${formattedDate} • ${formattedTime}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Fetch Super Admin Data
  const fetchSuperAdminData = async (customToken, showLoader = false) => {
    const activeToken = customToken || token;
    if (!activeToken) return;
    if (showLoader) setLoading(true);
    try {
      const statsRes = await fetch('/api/super-admin/stats', { headers: getHeaders(activeToken) });
      if (!statsRes.ok) throw new Error("Failed to fetch super admin stats");
      setSuperStats(await statsRes.json());
      
      const schoolRes = await fetch('/api/super-admin/schools', { headers: getHeaders(activeToken) });
      if (!schoolRes.ok) throw new Error("Failed to fetch schools");
      setSchools(await schoolRes.json());
      
      // Fetch subscription plans
      const plansRes = await fetch('/api/super-admin/plans', { headers: getHeaders(activeToken) });
      if (plansRes.ok) setSuperPlans(await plansRes.json());
      
      // Fetch school subscriptions
      const subsRes = await fetch('/api/super-admin/subscriptions', { headers: getHeaders(activeToken) });
      if (subsRes.ok) setSuperSubscriptions(await subsRes.json());
      
      // Fetch subscription audit logs
      const logsRes = await fetch('/api/super-admin/subscription/audit-logs', { headers: getHeaders(activeToken) });
      if (logsRes.ok) setSuperAuditLogs(await logsRes.json());
      
      setIsConnected(true);
      setIsApiUnavailable(false);
      setApiConnectionError('');
    } catch (err) {
      console.warn("Backend offline. Seeding Super Admin mock sandbox.");
      setIsConnected(false);
      const isMock = activeToken && activeToken.includes('mock');
      if (isMock) {
        loadMockSuperAdminData();
      } else {
        setIsApiUnavailable(true);
        setApiConnectionError(err.message || 'API connection failed');
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const loadMockSuperAdminData = () => {
    const savedSchools = JSON.parse(localStorage.getItem('bn_mock_schools') || '[]');
    const combinedSchools = [...savedSchools, ...MOCK_SCHOOLS];
    
    const updatedSchools = combinedSchools.map(s => {
      const end = new Date(s.subscription_end);
      const today = new Date();
      const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
      const daysLeft = diff > 0 ? diff : 0;
      
      const nextStatus = daysLeft <= 0 ? 'Inactive' : s.status;
      return {
        ...s,
        days_remaining: daysLeft,
        status: nextStatus
      };
    });
    
    setSchools(updatedSchools);
    
    const activeCount = updatedSchools.filter(s => s.status === 'Active').length;
    const inactiveCount = updatedSchools.filter(s => s.status === 'Inactive').length;
    
    setSuperStats({
      ...MOCK_SUPER_STATS,
      total_schools: updatedSchools.length,
      active_schools: activeCount,
      inactive_schools: inactiveCount,
      recent_schools: updatedSchools.map(s => ({
        name: s.name,
        email: s.email,
        status: s.status,
        created_at: s.subscription_start ? (s.subscription_start + " 10:00:00") : "2026-06-01 10:00:00"
      })).slice(0, 5)
    });

    setSuperPlans([
      { id: 1, name: 'Free Trial', duration_days: 30, price: 0.00, is_active: 1, description: '30 Days Free Trial access to all features.' },
      { id: 2, name: '1 Year Plan', duration_days: 365, price: 12000.00, is_active: 1, description: '1 Year full platform access.' },
      { id: 3, name: '2 Year Plan', duration_days: 730, price: 22000.00, is_active: 1, description: '2 Years full platform access.' },
      { id: 4, name: '3 Year Plan', duration_days: 1095, price: 30000.00, is_active: 1, description: '3 Years full platform access. Best value.' }
    ]);

    const mockSubs = updatedSchools.map(s => {
      const isTrial = s.days_remaining <= 30;
      return {
        school_id: s.id,
        school_name: s.name,
        school_email: s.email,
        subscription_id: s.id,
        plan_id: isTrial ? 1 : 2,
        start_date: s.subscription_start || '2026-04-01',
        expiry_date: s.subscription_end || '2027-03-31',
        remaining_days: s.days_remaining,
        status: s.days_remaining <= 0 ? (isTrial ? 'Trial Expired' : 'Expired') : (s.days_remaining < 15 ? 'Expiring Soon' : (isTrial ? 'Trial Active' : 'Active')),
        plan_name: isTrial ? 'Free Trial' : '1 Year Plan',
        price: isTrial ? 0.00 : 12000.00,
        duration_days: isTrial ? 30 : 365
      };
    });
    setSuperSubscriptions(mockSubs);
    setSuperAuditLogs([
      { id: 1, action: 'Trial Activated', performed_by: 'System', school_name: "St. Xavier's International School", plan_name: 'Free Trial', created_at: '2026-04-01 10:00:00' }
    ]);
  };

  const isSandboxTransactionLocked = (timestamp) => {
    if (!timestamp) return false;
    const txTime = new Date(timestamp);
    const keySuffix = schoolId || 'default';
    const reportsKey = `bn_sandbox_financial_reports_${keySuffix}_${activeYearId}`;
    const stored = localStorage.getItem(reportsKey);
    const reports = stored ? JSON.parse(stored) : [];
    return reports.some(r => {
      const start = new Date(r.from_timestamp || (r.from_date + 'T00:00:00'));
      const end = new Date(r.to_timestamp || (r.to_date + 'T23:59:59'));
      return txTime >= start && txTime <= end;
    });
  };

  const isSandboxExtraFeeTypeLocked = (typeId) => {
    const keySuffix = schoolId || 'default';
    const ledgerKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
    const storedLedger = localStorage.getItem(ledgerKey);
    const ledger = storedLedger ? JSON.parse(storedLedger) : [];
    
    const reportsKey = `bn_sandbox_financial_reports_${keySuffix}_${activeYearId}`;
    const storedReports = localStorage.getItem(reportsKey);
    const reports = storedReports ? JSON.parse(storedReports) : [];
    
    return ledger.some(item => {
      if (item.extra_fee_type_id === typeId && item.status === 'Paid' && item.paid_at) {
        const txTime = new Date(item.paid_at);
        return reports.some(r => {
          const start = new Date(r.from_timestamp || (r.from_date + 'T00:00:00'));
          const end = new Date(r.to_timestamp || (r.to_date + 'T23:59:59'));
          return txTime >= start && txTime <= end;
        });
      }
      return false;
    });
  };

  const fetchRolesAndUsers = async () => {
    if (!token) {
      const mockRoles = JSON.parse(localStorage.getItem('bn_mock_roles') || '[]');
      if (mockRoles.length === 0) {
        const initialRoles = [
          { id: 1, name: 'School Admin', permissions: ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration', 'parent_portal'] },
          { id: 2, name: 'Teacher', permissions: ['attendance', 'performance'] },
          { id: 3, name: 'Parent', permissions: [] }
        ];
        localStorage.setItem('bn_mock_roles', JSON.stringify(initialRoles));
        setDbRoles(initialRoles);
      } else {
        setDbRoles(mockRoles);
      }

      const mockUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      if (mockUsers.length === 0) {
        const initialUsers = [
          { id: 1, email: 'Admin@yopmail.com', role: 'School Admin', permissions: ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration', 'parent_portal'], school_id: '1', setup_completed: 1, school_name: "St. Xavier's International School" },
          { id: 2, email: 'dd@yopmail.com', role: 'School Admin', permissions: ['attendance', 'performance', 'planner', 'finance', 'reports', 'administration', 'parent_portal'], school_id: '1', setup_completed: 1, school_name: "St. Xavier's International School" },
          { id: 3, email: 'parent@yopmail.com', role: 'Parent', permissions: [], school_id: '1', setup_completed: 1, school_name: "St. Xavier's International School", linked_student_ids: [4, 5] },
          { id: 4, email: 'kk@yopmail.com', role: 'Teacher', permissions: ['attendance', 'performance'], school_id: '1', setup_completed: 1, school_name: "St. Xavier's International School", classroom_id: 1 }
        ];
        localStorage.setItem('bn_mock_users', JSON.stringify(initialUsers));
        setDbUsers(initialUsers);
      } else {
        setDbUsers(mockUsers);
      }
      return;
    }

    setIsRolesLoading(true);
    try {
      const headers = getHeaders(token);
      const resRoles = await fetch('/api/roles', { headers });
      if (resRoles.ok) setDbRoles(await resRoles.json());
      const resUsers = await fetch('/api/users', { headers });
      if (resUsers.ok) setDbUsers(await resUsers.json());
    } catch (err) {
      console.error("Error fetching roles and users", err);
    } finally {
      setIsRolesLoading(false);
    }
  };

  const handleAddRole = async (name, perms) => {
    if (!token) {
      const current = JSON.parse(localStorage.getItem('bn_mock_roles') || '[]');
      const newRole = { id: Date.now(), name, permissions: perms };
      const updated = [...current, newRole];
      localStorage.setItem('bn_mock_roles', JSON.stringify(updated));
      setDbRoles(updated);
      showToast('Role created successfully', 'success');
      return;
    }

    try {
      const headers = getHeaders(token);
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, permissions: perms })
      });
      if (res.ok) {
        showToast('Role created successfully', 'success');
        fetchRolesAndUsers();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to create role', 'error');
      }
    } catch (err) {
      showToast('Error creating role', 'error');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!token) {
      const current = JSON.parse(localStorage.getItem('bn_mock_roles') || '[]');
      const updated = current.filter(r => r.id !== roleId);
      localStorage.setItem('bn_mock_roles', JSON.stringify(updated));
      setDbRoles(updated);
      showToast('Role deleted successfully', 'success');
      return;
    }

    try {
      const headers = getHeaders(token);
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        showToast('Role deleted successfully', 'success');
        fetchRolesAndUsers();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to delete role', 'error');
      }
    } catch (err) {
      showToast('Error deleting role', 'error');
    }
  };

  const handleSaveClassTeacher = async (classId, teacherId) => {
    setIsSavingAssignment(true);
    const keySuffix = customSchoolId || schoolId || 'default';
    if (activeToken.includes('mock') || !isConnected) {
      const updated = classes.map(c => {
        if (Number(c.id) === Number(classId)) {
          const t = teachers.find(x => Number(x.id) === Number(teacherId));
          return {
            ...c,
            class_teacher_id: teacherId ? Number(teacherId) : null,
            class_teacher_name: t ? t.name : null,
            class_teacher_contact: t ? t.phone : null,
            class_teacher_assigned_at: new Date().toISOString().slice(0, 10)
          };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Class Teacher assigned successfully! (Sandbox)', 'success');
      setIsSavingAssignment(false);
      setAssignTeacherModalOpen(false);
      setEditingAssignmentClassId(null);
      setAssignTeacherClassId('');
      setAssignTeacherId('');
      return;
    }

    try {
      const res = await fetch('/api/class-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ class_id: classId, teacher_id: teacherId })
      });
      if (res.ok) {
        const resCls = await fetch(`/api/classes?academic_year_id=${activeYearId}`, {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        if (resCls.ok) setClasses(await resCls.json());
        showToast('Class Teacher assigned successfully!', 'success');
        setAssignTeacherModalOpen(false);
        setEditingAssignmentClassId(null);
        setAssignTeacherClassId('');
        setAssignTeacherId('');
      } else {
        const errData = await res.json();
        showToast(errData.detail || 'Failed to assign class teacher', 'error');
      }
    } catch (e) {
      showToast('Network error during assignment', 'error');
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleRemoveClassTeacher = async (classId) => {
    const keySuffix = customSchoolId || schoolId || 'default';
    if (activeToken.includes('mock') || !isConnected) {
      const updated = classes.map(c => {
        if (Number(c.id) === Number(classId)) {
          return {
            ...c,
            class_teacher_id: null,
            class_teacher_name: null,
            class_teacher_contact: null,
            class_teacher_assigned_at: null
          };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Class Teacher assignment removed. (Sandbox)', 'success');
      return;
    }

    try {
      const res = await fetch('/api/class-teacher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ class_id: classId, teacher_id: null })
      });
      if (res.ok) {
        const resCls = await fetch(`/api/classes?academic_year_id=${activeYearId}`, {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        if (resCls.ok) setClasses(await resCls.json());
        showToast('Class Teacher assignment removed.', 'success');
      } else {
        showToast('Failed to remove assignment', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
  };

  const loadCredentials = async (type, phone) => {
    setCredsLoading(true);
    setCredsPhone(phone);
    setCredsPassword('');
    setCredsExists(false);
    
    if (activeToken.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_creds_${type}_${phone}`);
      if (stored) {
        setCredsPassword(stored);
        setCredsExists(true);
      } else {
        setCredsPassword('');
        setCredsExists(false);
      }
      setCredsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/creds?type=${encodeURIComponent(type)}&phone=${encodeURIComponent(phone)}`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setCredsPassword(data.password);
          setCredsExists(true);
        } else {
          setCredsPassword('');
          setCredsExists(false);
        }
      } else {
        showToast('Failed to load credentials', 'error');
      }
    } catch (e) {
      showToast('Network error loading credentials', 'error');
    } finally {
      setCredsLoading(false);
    }
  };

  const saveCredentials = async (type, phone, password) => {
    setCredsSaving(true);
    if (activeToken.includes('mock') || !isConnected) {
      localStorage.setItem(`bn_sandbox_creds_${type}_${phone}`, password);
      
      // Update mock users list in local storage so they can log in
      const mockUsers = JSON.parse(localStorage.getItem('bn_sandbox_mock_logins') || '[]');
      const existingIdx = mockUsers.findIndex(u => u.phone === phone && u.role === type);
      const newUser = { phone, password, role: type, school_id: 1, setup_completed: 1 };
      if (existingIdx >= 0) {
        mockUsers[existingIdx] = newUser;
      } else {
        mockUsers.push(newUser);
      }
      localStorage.setItem('bn_sandbox_mock_logins', JSON.stringify(mockUsers));
      
      setCredsExists(true);
      showToast('Credentials saved successfully! (Sandbox)', 'success');
      setCredsSaving(false);
      setCredsModalOpen(false);
      return;
    }

    try {
      const res = await fetch('/api/creds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({ type, phone, password })
      });
      if (res.ok) {
        showToast('Credentials saved successfully!', 'success');
        setCredsExists(true);
        setCredsModalOpen(false);
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to save credentials', 'error');
      }
    } catch (e) {
      showToast('Network error saving credentials', 'error');
    } finally {
      setCredsSaving(false);
    }
  };

  const fetchTeacherDashboard = async (teacherPhone) => {
    setTeacherDashboardLoading(true);
    const keySuffix = customSchoolId || schoolId || 'default';
    
    if (activeToken.includes('mock') || !isConnected) {
      const activeTeach = teachers.find(t => t.phone === teacherPhone) || { id: 2, name: 'Rahul Sharma', phone: teacherPhone, subject: 'Mathematics' };
      const assignedCls = classes.find(c => Number(c.class_teacher_id) === Number(activeTeach.id)) || null;
      
      const todayTimetable = [];
      const totalPeriods = 8;
      for (let i = 0; i < totalPeriods; i++) {
        todayTimetable.push({ period: i + 1, status: 'Free', subject: '', class_name: '' });
      }
      
      if (assignedCls) {
        todayTimetable[0] = { period: 1, status: 'Busy', subject: 'Mathematics', class_name: assignedCls.class_name, class_id: assignedCls.id, backup: false };
        todayTimetable[3] = { period: 4, status: 'Busy', subject: 'Mathematics', class_name: assignedCls.class_name, class_id: assignedCls.id, backup: false };
      }
      
      const upcoming = [
        {
          date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          day: new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'long' }),
          periods: [
            { period: 1, subject: 'Mathematics', class_name: assignedCls ? assignedCls.class_name : 'Class 1', backup: false },
            { period: 4, subject: 'Mathematics', class_name: assignedCls ? assignedCls.class_name : 'Class 1', backup: false }
          ]
        }
      ];

      const storedFees = localStorage.getItem(`bn_sandbox_fees_${keySuffix}`) || '[]';
      const fees = JSON.parse(storedFees);
      const paid = fees.filter(f => f.status === 'Paid').reduce((sum, f) => sum + Number(f.amount || 0), 0);
      const pending = fees.filter(f => f.status === 'Pending').reduce((sum, f) => sum + Number(f.amount || 0), 0);
      
      setTeacherDashboardData({
        teacher_profile: activeTeach,
        assigned_class: assignedCls,
        today_timetable: todayTimetable,
        upcoming_timetable: upcoming,
        finance_summary: {
          total_fees_collected: paid,
          total_fees_outstanding: pending
        }
      });
      setTeacherDashboardLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/teacher/dashboard', {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        setTeacherDashboardData(await res.json());
      } else {
        showToast('Failed to load teacher dashboard', 'error');
      }
    } catch (e) {
      showToast('Network error loading teacher dashboard', 'error');
    } finally {
      setTeacherDashboardLoading(false);
    }
  };

  const fetchParentDashboard = async (parentPhone) => {
    setIsParentDashboardLoading(true);
    const keySuffix = customSchoolId || schoolId || 'default';
    if (activeToken.includes('mock') || !isConnected) {
      let studs = students.filter(s => s.phone === parentPhone || s.emergency_contact === parentPhone);
      if (studs.length === 0) {
        studs = students.slice(0, 2);
      }
      
      const mapped = studs.map(s => ({
        id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        class_name: s.class_name || (classes.find(c => Number(c.id) === Number(s.class_id))?.class_name || 'Class 1')
      }));
      
      setParentStudents(mapped);
      if (mapped.length > 0) {
        setSelectedParentStudentId(mapped[0].id);
        fetchParentStudentSummary(mapped[0].id);
      }
      setIsParentDashboardLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/parent/dashboard', {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setParentStudents(data.students);
        if (data.students && data.students.length > 0) {
          setSelectedParentStudentId(data.students[0].id);
          fetchParentStudentSummary(data.students[0].id);
        }
      } else {
        showToast('Failed to load parent dashboard', 'error');
      }
    } catch (e) {
      showToast('Network error loading parent dashboard', 'error');
    } finally {
      setIsParentDashboardLoading(false);
    }
  };

  const fetchParentStudentSummary = async (studentId) => {
    setParentSummaryLoading(true);
    const keySuffix = customSchoolId || schoolId || 'default';
    
    if (activeToken.includes('mock') || !isConnected) {
      const s = students.find(x => Number(x.id) === Number(studentId)) || { id: studentId, name: 'Child Name', roll_number: '1' };
      
      const attKey = `bn_sandbox_attendance_${keySuffix}_${activeYearId}`;
      const attList = JSON.parse(localStorage.getItem(attKey) || '[]');
      const studentAtt = attList.filter(a => Number(a.student_id) === Number(studentId));
      const present = studentAtt.filter(a => a.status === 'Present').length;
      const absent = studentAtt.filter(a => a.status === 'Absent').length;
      const leave = studentAtt.filter(a => a.status === 'Leave').length;
      const total = present + absent + leave;
      const pct = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100.0;
      
      const feesKey = `bn_sandbox_fees_${keySuffix}`;
      const feesList = JSON.parse(localStorage.getItem(feesKey) || '[]');
      const studentFees = feesList.filter(f => Number(f.student_id) === Number(studentId));
      const paid = studentFees.filter(f => f.status === 'Paid').reduce((sum, f) => sum + Number(f.amount || 0), 0);
      const pending = studentFees.filter(f => f.status === 'Pending').reduce((sum, f) => sum + Number(f.amount || 0), 0);
      
      setParentStudentSummary({
        student: s,
        attendance_summary: {
          present,
          absent,
          leave,
          percentage: pct,
          history: studentAtt.map(a => ({ attendance_date: a.attendance_date, status: a.status, remarks: a.remarks || '' }))
        },
        fee_summary: {
          fees_paid: paid,
          fees_pending: pending,
          outstanding_balance: pending,
          payment_history: studentFees.filter(f => f.status === 'Paid').map(f => ({ item_name: `Tuition Fee - ${f.month}`, amount: Number(f.amount), paid_at: f.payment_date + ' 12:00:00' }))
        }
      });
      setParentSummaryLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/parent/student/${studentId}/summary`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        setParentStudentSummary(await res.json());
      } else {
        showToast('Failed to load student summary', 'error');
      }
    } catch (e) {
      showToast('Network error loading child summary', 'error');
    } finally {
      setParentSummaryLoading(false);
    }
  };

  const handleSaveUser = async (userId, emailOrPhone, password, roleName, classroomId, parentStudentsArray) => {
    const isEmail = emailOrPhone.includes('@');
    const emailVal = isEmail ? emailOrPhone.trim() : '';
    const phoneVal = !isEmail ? emailOrPhone.trim() : '';
    
    const matchedRoleObj = dbRoles.find(r => r.name === roleName);
    const roleIdVal = matchedRoleObj ? matchedRoleObj.id : null;
    const permissionsArray = matchedRoleObj ? (matchedRoleObj.permissions || []) : [];

    if (!token) {
      const current = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      if (userId) {
        const updated = current.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              email: isEmail ? emailVal : u.email,
              phone: !isEmail ? phoneVal : u.phone,
              password: password ? sha256Sync(password) : u.password,
              role: roleName,
              role_id: roleIdVal,
              permissions: permissionsArray,
              classroom_id: classroomId ? Number(classroomId) : null,
              linked_student_ids: parentStudentsArray || []
            };
          }
          return u;
        });
        localStorage.setItem('bn_mock_users', JSON.stringify(updated));
        setDbUsers(updated);
        showToast('User updated successfully', 'success');
      } else {
        const newUser = {
          id: Date.now(),
          email: emailVal,
          phone: phoneVal,
          password: sha256Sync(password || 'Test@123'),
          role: roleName,
          role_id: roleIdVal,
          permissions: permissionsArray,
          classroom_id: classroomId ? Number(classroomId) : null,
          linked_student_ids: parentStudentsArray || [],
          school_id: '1',
          setup_completed: 1,
          school_name: "St. Xavier's International School"
        };
        const updated = [...current, newUser];
        localStorage.setItem('bn_mock_users', JSON.stringify(updated));
        setDbUsers(updated);
        showToast('User created successfully', 'success');
      }
      setEditingUser(null);
      return;
    }

    try {
      const headers = getHeaders(token);
      const payload = {
        email: emailVal,
        phone: phoneVal,
        role: roleName,
        role_id: roleIdVal,
        linked_student_ids: parentStudentsArray || []
      };
      if (userId) {
        payload.id = userId;
      }
      if (password) {
        payload.password = password;
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(userId ? 'User updated successfully' : 'User created successfully', 'success');
        setEditingUser(null);
        fetchRolesAndUsers();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to save user', 'error');
      }
    } catch (err) {
      showToast('Error saving user', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!token) {
      const current = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const updated = current.filter(u => u.id !== userId);
      localStorage.setItem('bn_mock_users', JSON.stringify(updated));
      setDbUsers(updated);
      showToast('User deleted successfully', 'success');
      return;
    }

    try {
      const headers = getHeaders(token);
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        showToast('User deleted successfully', 'success');
        fetchRolesAndUsers();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to delete user', 'error');
      }
    } catch (err) {
      showToast('Error deleting user', 'error');
    }
  };

  // Fetch School Admin Data
  const fetchSPData = async (customToken, customSchoolId) => {
    const activeToken = customToken || token;
    if (!activeToken) return;
    setLoading(true);
    try {
      const headers = getHeaders(activeToken);
      
      const userRole = role || localStorage.getItem('admin_role');
      if (userRole === 'Parent') {
        const parentRes = await fetch('/api/parent/students', { headers });
        if (parentRes.ok) {
          const studs = await parentRes.json();
          setParentStudents(studs);
          if (studs.length > 0) {
            setSelectedParentStudentId(studs[0].id);
          }
        }
        setLoading(false);
        return;
      }
      
      const resYears = await fetch('/api/academic-years', { headers });
      if (!resYears.ok) throw new Error("Failed to fetch academic years");
      const fetchedYears = await resYears.json();
      setYears(fetchedYears);
      const activeYear = fetchedYears.find(y => y.is_active === 1 || y.is_active === true || y.is_active === '1');
      let targetYearId = activeYearId;
      if (!targetYearId || !fetchedYears.some(y => y.id === targetYearId)) {
        if (activeYear) {
          targetYearId = activeYear.id;
          setActiveYearId(activeYear.id);
          localStorage.setItem('bn_active_year_id', activeYear.id);
        } else if (fetchedYears.length > 0) {
          targetYearId = fetchedYears[0].id;
          setActiveYearId(fetchedYears[0].id);
          localStorage.setItem('bn_active_year_id', fetchedYears[0].id);
        }
      }

      const resCls = await fetch('/api/classes', { headers });
      if (!resCls.ok) throw new Error("Failed to fetch classes");
      setClasses(await resCls.json());

      const resTeach = await fetch('/api/teachers', { headers });
      if (!resTeach.ok) throw new Error("Failed to fetch teachers");
      setTeachers(await resTeach.json());

      const resStud = await fetch(`/api/students?academic_year_id=${targetYearId}`, { headers });
      if (!resStud.ok) throw new Error("Failed to fetch students");
      setStudents(await resStud.json());

      // Fetch Leaves
      if (activeToken.includes('mock') || !isConnected) {
        const keySuffix = customSchoolId || schoolId || 'default';
        const storedLeaves = localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${targetYearId}`) || '[]';
        const parsed = JSON.parse(storedLeaves);
        parsed.forEach(l => {
          if (!l.category) l.category = 'School Holiday';
        });
        const activeYear = years.find(y => y.id === targetYearId);
        const systemHols = activeYear ? getSystemHolidays(activeYear.start_date, activeYear.end_date, targetYearId) : [];
        setLeavesList([...parsed, ...systemHols]);
      } else {
        try {
          const resLeaves = await fetch(`/api/leaves?academic_year_id=${targetYearId}`, { headers });
          if (resLeaves.ok) setLeavesList(await resLeaves.json());
        } catch (e) {
          console.error("Failed to load leaves", e);
        }
      }

      const resNotif = await fetch('/api/notifications', { headers });
      if (resNotif.ok) setNotifications(await resNotif.json());

      const resAudit = await fetch('/api/audit-logs', { headers });
      if (resAudit.ok) setAuditLogs(await resAudit.json());

      const resStats = await fetch(`/api/dashboard/stats?academic_year_id=${targetYearId}`, { headers });
      if (resStats.ok) setDashboardStats(await resStats.json());

      const resSchool = await fetch('/api/school', { headers });
      if (resSchool.ok) {
        const schInfo = await resSchool.json();
        if (schInfo.currency) setSchoolCurrency(schInfo.currency);
        if (schInfo.school_start_time) {
          setSchoolStartTime(schInfo.school_start_time);
          setDraftSchoolStartTime(schInfo.school_start_time);
          localStorage.setItem('bn_settings_school_start_time', schInfo.school_start_time);
        }
        if (schInfo.period_duration !== undefined && schInfo.period_duration !== null) {
          setPeriodDuration(parseInt(schInfo.period_duration));
          setDraftPeriodDuration(parseInt(schInfo.period_duration));
          localStorage.setItem('bn_settings_period_duration', schInfo.period_duration);
        }
        if (schInfo.interval_duration !== undefined && schInfo.interval_duration !== null) {
          setIntervalDuration(parseInt(schInfo.interval_duration));
          setDraftIntervalDuration(parseInt(schInfo.interval_duration));
          localStorage.setItem('bn_settings_interval_duration', schInfo.interval_duration);
        }
        if (schInfo.interval_after_period !== undefined && schInfo.interval_after_period !== null) {
          setIntervalAfterPeriod(parseInt(schInfo.interval_after_period));
          setDraftIntervalAfterPeriod(parseInt(schInfo.interval_after_period));
          localStorage.setItem('bn_settings_interval_after_period', schInfo.interval_after_period);
        }
        if (schInfo.total_periods !== undefined && schInfo.total_periods !== null) {
          setTotalPeriodsPerDay(parseInt(schInfo.total_periods));
          setDraftTotalPeriods(parseInt(schInfo.total_periods));
          localStorage.setItem('bn_settings_total_periods', schInfo.total_periods);
        }
      }

      setIsConnected(true);
      setIsApiUnavailable(false);
      setApiConnectionError('');
    } catch (err) {
      console.warn("School Admin API offline:", err.message);
      setIsConnected(false);
      const isMock = activeToken && activeToken.includes('mock');
      if (isMock) {
        loadMockSeeds(customSchoolId || schoolId);
      } else {
        setIsApiUnavailable(true);
        setApiConnectionError(err.message || 'API connection failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreateYearModal = () => {
    let nextRange = "2026-2027";
    let startYear = 2026;
    if (years.length > 0) {
      let maxStart = 0;
      years.forEach(y => {
        const parts = y.year_range.split('-');
        const start = parseInt(parts[0]);
        if (start && start > maxStart) maxStart = start;
      });
      if (maxStart > 0) {
        startYear = maxStart + 1;
        nextRange = `${startYear}-${startYear + 1}`;
      }
    }
    setNewYearForm({
      year_range: nextRange,
      start_date: `${startYear}-04-01`,
      end_date: `${startYear + 1}-03-31`,
      description: '',
      fee_structure: {
        April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
        October: 0, November: 0, December: 0, January: 0, February: 0, March: 0
      }
    });
    setYearError('');
    setShowCreateYearModal(true);
  };

  const handleCreateAcademicYear = async (e) => {
    e.preventDefault();
    setIsSavingYear(true);
    setYearError('');

    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const keySuffix = schoolId || 'default';
        const newY = {
          id: years.length + 1,
          school_id: parseInt(keySuffix) || 1,
          year_range: newYearForm.year_range,
          start_date: newYearForm.start_date,
          end_date: newYearForm.end_date,
          description: newYearForm.description,
          status: 'Draft',
          fee_structure: newYearForm.fee_structure,
          is_active: false,
          created_at: new Date().toISOString()
        };
        if (years.some(y => y.year_range === newYearForm.year_range)) {
          setYearError('Academic year range already exists');
          setIsSavingYear(false);
          return;
        }
        const updated = [...years, newY];
        setYears(updated);
        localStorage.setItem(`bn_sandbox_years_${keySuffix}`, JSON.stringify(updated));
        
        showToast('Academic year registered successfully as Draft!', 'success');
        setShowCreateYearModal(false);
        setIsSavingYear(false);
      }, 800);
      return;
    }

    try {
      const res = await fetch('/api/academic-years', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newYearForm)
      });
      if (res.ok) {
        showToast('Academic year registered successfully as Draft!', 'success');
        setShowCreateYearModal(false);
        // Refresh years
        const resYears = await fetch('/api/academic-years', { headers: getHeaders() });
        if (resYears.ok) setYears(await resYears.json());
      } else {
        const err = await res.json();
        setYearError(err.detail || 'Failed to create academic year.');
        showToast(err.detail || 'Failed to create academic year.', 'danger');
      }
    } catch (err) {
      setYearError('Error connecting to backend.');
      showToast('Error connecting to backend.', 'danger');
    } finally {
      setIsSavingYear(false);
    }
  };

  const handleArchiveAcademicYear = async (yearId) => {
    if (!window.confirm("Are you sure you want to archive this academic session?")) return;
    
    if (token.includes('mock') || !isConnected) {
      const keySuffix = schoolId || 'default';
      const updated = years.map(y => y.id === yearId ? { ...y, status: 'Archived', is_active: false } : y);
      setYears(updated);
      localStorage.setItem(`bn_sandbox_years_${keySuffix}`, JSON.stringify(updated));
      showToast('Academic year archived successfully!', 'success');
      return;
    }

    try {
      const res = await fetch(`/api/academic-years/${yearId}/archive`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast('Academic year archived successfully!', 'success');
        const resYears = await fetch('/api/academic-years', { headers: getHeaders() });
        if (resYears.ok) setYears(await resYears.json());
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to archive academic year.', 'danger');
      }
    } catch (err) {
      showToast('Error connecting to backend.', 'danger');
    }
  };

  const fetchCrossYearReportsData = async () => {
    setIsFetchingCrossYear(true);
    
    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const mockReports = years.map(y => {
          const yearStudents = students.filter(s => s.academic_year_id === y.id && s.status === 'Active');
          let calculatedRevenue = 0;
          const kSuffix = schoolId || 'default';
          students.forEach(s => {
            if (s.status === 'Active') {
              const storageKey = `bn_sandbox_fees_${kSuffix}_${s.id}_${y.id}`;
              const stored = localStorage.getItem(storageKey);
              if (stored) {
                const records = JSON.parse(stored);
                records.forEach(r => {
                  if (r.status === 'Paid') {
                    calculatedRevenue += parseFloat(r.amount) || 0;
                  }
                });
              }
            }
          });
          return {
            year_range: y.year_range,
            student_count: yearStudents.length,
            status: y.status,
            revenue: calculatedRevenue,
            salary_expense: teachers.length * 1200.00,
            performance_index: y.status === 'Archived' ? '84.2%' : '86.5%'
          };
        });
        setCrossYearReports(mockReports);
        setIsFetchingCrossYear(false);
      }, 500);
      return;
    }

    try {
      const res = await fetch('/api/reports/cross-year', { headers: getHeaders() });
      if (res.ok) {
        setCrossYearReports(await res.json());
      } else {
        showToast('Failed to fetch cross-year reports.', 'danger');
      }
    } catch (err) {
      showToast('Error connecting to backend.', 'danger');
    } finally {
      setIsFetchingCrossYear(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports' && reportSubTab === 'cross-year') {
      fetchCrossYearReportsData();
    }
  }, [activeTab, reportSubTab]);

  const getInitialClassMappings = () => {
    const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const mappings = {};
    for (let i = 0; i < sorted.length; i++) {
      if (i < sorted.length - 1) {
        mappings[sorted[i].id] = sorted[i+1].id;
      } else {
        mappings[sorted[i].id] = 'Alumni';
      }
    }
    return mappings;
  };

  const handleExecuteTransition = async () => {
    if (wizardConfirmText !== 'CONFIRM') {
      showToast('Please type "CONFIRM" to proceed.', 'warning');
      return;
    }
    setIsActivatingYear(true);

    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const keySuffix = schoolId || 'default';
        
        // 1. Archive other years, activate target year
        const updatedYears = years.map(y => {
          if (y.id === wizardTargetYear.id) {
            return { ...y, status: 'Active', is_active: true };
          } else if (y.status === 'Active') {
            return { ...y, status: 'Archived', is_active: false };
          }
          return y;
        });
        
        const currentActiveYear = years.find(y => y.status === 'Active' || y.is_active);
        const oldAyId = currentActiveYear ? currentActiveYear.id : null;

        // 2. Process students and carry forward dues
        const updatedStudents = [...students];
        const allCFDuesKey = `bn_sandbox_carry_forward_dues_${keySuffix}`;
        const allCFDues = JSON.parse(localStorage.getItem(allCFDuesKey) || '[]');
        
        let maxStudId = Math.max(...students.map(s => parseInt(s.id)), 0);
        if (isNaN(maxStudId) || maxStudId < 0) maxStudId = 0;
        
        let maxCFId = Math.max(...allCFDues.map(c => parseInt(c.id)), 0);
        if (isNaN(maxCFId) || maxCFId < 0) maxCFId = 0;
        
        students.forEach(student => {
          if (student.academic_year_id === oldAyId) {
            const promotionChoice = wizardStudentStatus[student.id] || null;
            let statusChoice = promotionChoice;
            if (!statusChoice) {
              const mappedClass = wizardClassMappings[student.class_id];
              if (mappedClass === 'Alumni' || mappedClass === 'Alumni / Passed Out') {
                statusChoice = 'graduate';
              } else {
                statusChoice = 'promote';
              }
            }
            
            let newClassId = student.class_id;
            let newStatus = 'Active';
            
            if (statusChoice === 'graduate') {
              newStatus = 'Alumni';
            } else if (statusChoice === 'repeat') {
              newClassId = student.class_id;
              newStatus = 'Active';
            } else {
              const mappedClass = wizardClassMappings[student.class_id];
              if (mappedClass === 'Alumni' || mappedClass === 'Alumni / Passed Out' || !mappedClass) {
                newStatus = 'Alumni';
              } else {
                newClassId = parseInt(mappedClass);
                newStatus = 'Active';
              }
            }
            
            if (student.status === 'Inactive') {
              newStatus = 'Inactive';
            }
            
            if (newStatus === 'Alumni' || newStatus === 'Inactive') {
              // 1. Update status in the old year record
              const idx = updatedStudents.findIndex(s => s.id === student.id);
              if (idx !== -1) {
                updatedStudents[idx] = { ...updatedStudents[idx], status: newStatus };
              }
              
              // 2. Calculate outstanding dues
              let unpaidTuition = 0;
              const studentFeesKey = `bn_sandbox_fees_${keySuffix}_${student.id}_${oldAyId}`;
              const studentFees = JSON.parse(localStorage.getItem(studentFeesKey) || '[]');
              studentFees.forEach(f => {
                if (f.status === 'Pending') {
                  unpaidTuition += parseFloat(f.amount) || 0;
                }
              });
              
              let unpaidExtra = 0;
              const extraFeesKey = `bn_sandbox_student_extra_fees_${keySuffix}_${oldAyId}`;
              const extraFees = JSON.parse(localStorage.getItem(extraFeesKey) || '[]');
              const studentExtra = extraFees.filter(ef => parseInt(ef.student_id) === parseInt(student.id) && ef.status === 'Pending');
              studentExtra.forEach(ef => {
                unpaidExtra += parseFloat(ef.amount) || 0;
              });
              
              const totalPrevDues = unpaidTuition + unpaidExtra;
              if (totalPrevDues > 0) {
                maxCFId++;
                allCFDues.push({
                  id: maxCFId,
                  school_id: schoolId || 1,
                  student_id: student.id,
                  original_academic_year_id: oldAyId,
                  amount: totalPrevDues,
                  paid_amount: 0,
                  status: 'Pending'
                });
              }
              return;
            }
            
            // For Promoted or Repeating students:
            // 1. Keep old record as is (Active, oldAyId).
            // 2. Create new student record copy for target year.
            maxStudId++;
            const newStudentId = maxStudId;
            const newStudent = {
              ...student,
              id: newStudentId,
              academic_year_id: wizardTargetYear.id,
              class_id: newClassId,
              status: 'Active'
            };
            updatedStudents.push(newStudent);
            
            // 3. Calculate and insert new carry forward due entry pointing to newStudentId
            let unpaidTuition = 0;
            const studentFeesKey = `bn_sandbox_fees_${keySuffix}_${student.id}_${oldAyId}`;
            const studentFees = JSON.parse(localStorage.getItem(studentFeesKey) || '[]');
            studentFees.forEach(f => {
              if (f.status === 'Pending') {
                unpaidTuition += parseFloat(f.amount) || 0;
              }
            });
            
            let unpaidExtra = 0;
            const extraFeesKey = `bn_sandbox_student_extra_fees_${keySuffix}_${oldAyId}`;
            const extraFees = JSON.parse(localStorage.getItem(extraFeesKey) || '[]');
            const studentExtra = extraFees.filter(ef => parseInt(ef.student_id) === parseInt(student.id) && ef.status === 'Pending');
            studentExtra.forEach(ef => {
              unpaidExtra += parseFloat(ef.amount) || 0;
            });
            
            const totalPrevDues = unpaidTuition + unpaidExtra;
            if (totalPrevDues > 0) {
              maxCFId++;
              allCFDues.push({
                id: maxCFId,
                school_id: schoolId || 1,
                student_id: newStudentId,
                original_academic_year_id: oldAyId,
                amount: totalPrevDues,
                paid_amount: 0,
                status: 'Pending'
              });
            }
            
            // 4. Retrieve and copy over existing older carry forward dues to the new student copy
            const oldCFs = allCFDues.filter(c => parseInt(c.student_id) === parseInt(student.id) && c.status === 'Pending');
            oldCFs.forEach(cf => {
              maxCFId++;
              allCFDues.push({
                id: maxCFId,
                school_id: schoolId || 1,
                student_id: newStudentId,
                original_academic_year_id: cf.original_academic_year_id,
                amount: cf.amount,
                paid_amount: cf.paid_amount,
                status: 'Pending'
              });
            });
            
            // 5. Seed fee records for the target year in mock mode
            const defaultStructure = {
              April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
              October: 0, November: 0, December: 0, January: 0, February: 0, March: 0
            };
            const structureStorageKey = `bn_sandbox_class_fees_${keySuffix}_${newClassId}_${wizardTargetYear.id}`;
            const feeStructure = JSON.parse(localStorage.getItem(structureStorageKey) || JSON.stringify(defaultStructure));
            
            const newFeesKey = `bn_sandbox_fees_${keySuffix}_${newStudentId}_${wizardTargetYear.id}`;
            const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
            const newFees = months.map((m, idx) => {
              const mNum = (idx + 4 > 12) ? (idx - 8) : (idx + 4);
              const rangeParts = wizardTargetYear.year_range.split('-');
              let startYear = parseInt(rangeParts[0]) || new Date().getFullYear();
              const mYear = (idx <= 8) ? startYear : (startYear + 1);
              const dueDate = `${mYear}-${String(mNum).padStart(2, '0')}-15`;
              return {
                month: m,
                amount: parseFloat(feeStructure[m]) || 0,
                status: 'Pending',
                due_date: dueDate
              };
            });
            localStorage.setItem(newFeesKey, JSON.stringify(newFees));
          }
        });
        
        setYears(updatedYears);
        setStudents(updatedStudents);
        localStorage.setItem(`bn_sandbox_years_${keySuffix}`, JSON.stringify(updatedYears));
        localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updatedStudents));
        localStorage.setItem(allCFDuesKey, JSON.stringify(allCFDues));
        
        setActiveYearId(wizardTargetYear.id);
        
        showToast('Academic year activated successfully!', 'success');
        setShowTransitionWizard(false);
        setIsActivatingYear(false);
      }, 1000);
      return;
    }

    try {
      const payload = {
        class_mappings: wizardClassMappings,
        student_status: wizardStudentStatus
      };
      const res = await fetch(`/api/academic-years/${wizardTargetYear.id}/activate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Academic year activated successfully!', 'success');
        setShowTransitionWizard(false);
        // Set new active year
        setActiveYearId(wizardTargetYear.id);
        // Refresh all data
        await fetchSPData(token, schoolId);
      } else {
        const err = await res.json();
        showToast(err.detail || 'Activation failed.', 'danger');
      }
    } catch (err) {
      showToast('Error connecting to backend.', 'danger');
    } finally {
      setIsActivatingYear(false);
    }
  };

  const loadMockSeeds = (customSchoolId) => {
    const keySuffix = customSchoolId || schoolId || 'default';
    const isNewTenant = keySuffix !== '1' && keySuffix !== 'default';

    const storedClasses = localStorage.getItem(`bn_sandbox_classes_${keySuffix}`);
    const storedTeachers = localStorage.getItem(`bn_sandbox_teachers_${keySuffix}`);
    const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}`);
    const storedSubjects = localStorage.getItem(`bn_sandbox_subjects_${keySuffix}`);
    const storedYears = localStorage.getItem(`bn_sandbox_years_${keySuffix}`);

    const localClasses = storedClasses ? JSON.parse(storedClasses) : (isNewTenant ? [] : MOCK_CLASSES);
    const localTeachers = storedTeachers ? JSON.parse(storedTeachers) : (isNewTenant ? [] : MOCK_TEACHERS);
    const localStudents = storedStudents ? JSON.parse(storedStudents) : (isNewTenant ? [] : MOCK_STUDENTS);
    const localSubjects = storedSubjects ? JSON.parse(storedSubjects) : (isNewTenant ? [] : [
      { id: 1, name: 'English' },
      { id: 2, name: 'Mathematics' },
      { id: 3, name: 'Science' },
      { id: 4, name: 'Hindi' },
      { id: 5, name: 'Social Studies' },
      { id: 6, name: 'Drawing' },
      { id: 7, name: 'Computer' }
    ]);
    const defaultFeesStructure = {
      April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
      October: 0, November: 0, December: 0, January: 0, February: 0, March: 0
    };
    const localYears = storedYears ? JSON.parse(storedYears) : (isNewTenant ? [] : [
      { id: 1, year_range: "2024-2025", start_date: "2024-04-01", end_date: "2025-03-31", description: "Past session", status: "Archived", is_active: false, fee_structure: defaultFeesStructure, created_at: "2024-04-01 00:00:00" },
      { id: 2, year_range: "2025-2026", start_date: "2025-04-01", end_date: "2026-03-31", description: "Active session", status: "Active", is_active: true, fee_structure: defaultFeesStructure, created_at: "2025-04-01 00:00:00" }
    ]);

    setClasses(localClasses);
    setTeachers(localTeachers);
    setStudents(localStudents);
    setSubjects(localSubjects);
    setYears(localYears);
    const storedCurr = localStorage.getItem(`bn_sandbox_school_currency_${keySuffix}`);
    setSchoolCurrency(storedCurr || 'INR');
    const storedStartTime = localStorage.getItem(`bn_sandbox_school_start_time_${keySuffix}`);
    const storedDuration = localStorage.getItem(`bn_sandbox_period_duration_${keySuffix}`);
    const storedInterval = localStorage.getItem(`bn_sandbox_interval_duration_${keySuffix}`);
    const storedIntervalAfter = localStorage.getItem(`bn_sandbox_interval_after_period_${keySuffix}`);
    const storedTotalPeriods = localStorage.getItem(`bn_sandbox_total_periods_${keySuffix}`);

    setSchoolStartTime(storedStartTime || '08:00 AM');
    setPeriodDuration(storedDuration ? parseInt(storedDuration) : 40);
    setIntervalDuration(storedInterval ? parseInt(storedInterval) : 20);
    setIntervalAfterPeriod(storedIntervalAfter ? parseInt(storedIntervalAfter) : 4);
    setTotalPeriodsPerDay(storedTotalPeriods ? parseInt(storedTotalPeriods) : 8);

    setDraftSchoolStartTime(storedStartTime || '08:00 AM');
    setDraftPeriodDuration(storedDuration ? parseInt(storedDuration) : 40);
    setDraftIntervalDuration(storedInterval ? parseInt(storedInterval) : 20);
    setDraftIntervalAfterPeriod(storedIntervalAfter ? parseInt(storedIntervalAfter) : 4);
    setDraftTotalPeriods(storedTotalPeriods ? parseInt(storedTotalPeriods) : 8);
    setNotifications(isNewTenant ? [] : MOCK_NOTIFS);
    setAuditLogs([
      { id: 1, operator: "System", action: "Tenant Sandbox Warning", timestamp: "2026-05-30 19:10:00", details: "Running in Offline Tenant Cache Mode." }
    ]);

    const act = localYears.find(y => y.status === 'Active' || y.is_active);
    let targetYearId = activeYearId;
    if (!targetYearId || !localYears.some(y => y.id === targetYearId)) {
      if (act) {
        targetYearId = act.id;
        setActiveYearId(act.id);
        localStorage.setItem('bn_active_year_id', act.id);
      } else if (localYears.length > 0) {
        targetYearId = localYears[0].id;
        setActiveYearId(localYears[0].id);
        localStorage.setItem('bn_active_year_id', localYears[0].id);
      }
    }

    // Pre-initialize sandbox fee records for mock students if not already present
    localStudents.forEach(s => {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${s.id}_${targetYearId}`;
      if (!localStorage.getItem(storageKey)) {
        const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        
        // Find active year range
        const activeYear = localYears.find(y => y.id === targetYearId);
        const range = activeYear ? activeYear.year_range : '2025-2026';
        const [startYearStr, endYearStr] = range.split('-');
        const startYear = parseInt(startYearStr) || 2025;
        const endYear = parseInt(endYearStr) || 2026;
        
        // Find class-wise fee structure
        const sandboxClassFeesKey = `bn_sandbox_class_fees_${keySuffix}_${s.class_id}_${targetYearId}`;
        const storedClassFees = localStorage.getItem(sandboxClassFeesKey);
        if (!storedClassFees) {
          // If no fee structure is configured, do not generate monthly ledger entries
          return;
        }
        const feeStructure = JSON.parse(storedClassFees);

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const defaultFees = months.map((m, i) => {
          const year = i < 9 ? startYear : endYear;
          const monthNum = i < 9 ? i + 4 : i - 8;
          
          let status = "Pending";
          let payDate = null;
          if (s.id % 2 === 0 && (year < currentYear || (year === currentYear && monthNum < currentMonth))) {
            status = "Paid";
            payDate = `${year}-${String(monthNum).padStart(2, '0')}-05`;
          }

          return {
            id: i + 1,
            student_id: s.id,
            month: m,
            amount: parseFloat(feeStructure[m]) || 0.00,
            status: status,
            due_date: `${year}-${String(monthNum).padStart(2, '0')}-15`,
            payment_date: payDate
          };
        });
        localStorage.setItem(storageKey, JSON.stringify(defaultFees));
      }
    });

    // Pre-initialize sandbox salary records for mock teachers if not already present
    localTeachers.forEach(t => {
      const storageKey = `bn_sandbox_salaries_${keySuffix}_${t.id}_${targetYearId}`;
      if (!localStorage.getItem(storageKey)) {
        const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        const base = parseFloat(t.salary_amount) || 3000.0;
        const defaultSalaries = months.map((m, i) => ({
          id: i + 1,
          teacher_id: t.id,
          month: m,
          amount: base,
          status: i < 5 ? "Paid" : "Pending",
          payment_date: i < 5 ? `2025-${String(i+4).padStart(2, '0')}-05` : null
        }));
        localStorage.setItem(storageKey, JSON.stringify(defaultSalaries));
      }
    });

    let calculatedRevenue = 0;
    localStudents.forEach(s => {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${s.id}_${targetYearId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const records = JSON.parse(stored);
        records.forEach(r => {
          if (r.status === 'Paid') {
            calculatedRevenue += parseFloat(r.amount) || 0;
          }
        });
      }
    });

    let cfPendingAmount = 0;
    let cfPendingStudentsCount = 0;
    let pyRecoveryAmount = 0;

    const storedCFDues = localStorage.getItem(`bn_sandbox_carry_forward_dues_${keySuffix}`) || '[]';
    const allCFDues = JSON.parse(storedCFDues);
    const storedPYRecs = localStorage.getItem(`bn_sandbox_previous_year_recoveries_${keySuffix}`) || '[]';
    const allPYRecs = JSON.parse(storedPYRecs);

    localStudents.forEach(s => {
      const studentCFDues = allCFDues.filter(d => parseInt(d.student_id) === parseInt(s.id));
      let hasPending = false;
      studentCFDues.forEach(d => {
        if (d.status === 'Pending') {
          cfPendingAmount += parseFloat(d.amount) - parseFloat(d.paid_amount);
          hasPending = true;
        }
      });
      if (hasPending) {
        cfPendingStudentsCount++;
      }

      const studentPYRecs = allPYRecs.filter(r => parseInt(r.student_id) === parseInt(s.id));
      studentPYRecs.forEach(r => {
        pyRecoveryAmount += parseFloat(r.amount_recovered) || 0;
      });
    });

    calculatedRevenue += pyRecoveryAmount;
    
    setDashboardStats({
      total_students: localStudents.length,
      total_teachers: localTeachers.length,
      pending_fees_count: isNewTenant ? 0 : 5,
      pending_salaries_count: isNewTenant ? 0 : 8,
      monthly_revenue: isNewTenant ? 0.00 : calculatedRevenue,
      active_classes: localClasses.length,
      attendance_overview: isNewTenant ? "0.0% Avg" : "96.4% Avg",
      carry_forward_pending_amount: isNewTenant ? 0.00 : cfPendingAmount,
      carry_forward_pending_students: isNewTenant ? 0 : cfPendingStudentsCount,
      previous_year_recovery_amount: isNewTenant ? 0.00 : pyRecoveryAmount,
      charts: {
        fee_collection: isNewTenant ? [
          { month: "April", amount: 0 }, { month: "May", amount: 0 }, { month: "June", amount: 0 },
          { month: "July", amount: 0 }, { month: "August", amount: 0 }, { month: "September", amount: 0 }
        ] : [
          { month: "April", amount: 450.00 }, { month: "May", amount: 300.00 }, { month: "June", amount: 300.00 },
          { month: "July", amount: 200.00 }, { month: "August", amount: 200.00 }, { month: "September", amount: 0 }
        ],
        salary_expense: isNewTenant ? [
          { month: "April", amount: 0 }, { month: "May", amount: 0 }, { month: "June", amount: 0 },
          { month: "July", amount: 0 }, { month: "August", amount: 0 }, { month: "September", amount: 0 }
        ] : [
          { month: "April", amount: 7500.00 }, { month: "May", amount: 7500.00 }, { month: "June", amount: 7500.00 },
          { month: "July", amount: 0 }, { month: "August", amount: 0 }, { month: "September", amount: 0 }
        ]
      }
    });
  };

  // Reset delete password and error when modal opens
  useEffect(() => {
    if (deleteConfirm) {
      setDeletePassword('');
      setDeleteError('');
    }
  }, [deleteConfirm]);

  // Verify session on mount / retry
  // Verify session on mount / retry
  const verifySession = async () => {
    // Safety fallback: ensure "Verifying session..." screen is removed after 8 seconds under any circumstances
    const safetyTimeout = setTimeout(() => {
      console.warn("Session verification safety timeout fired.");
      setIsInitializing(false);
    }, 8000);

    const storedToken = localStorage.getItem('admin_token');
    const storedRole = localStorage.getItem('admin_role');
    
    let storedSetup = 1;
    let storedSetupStr = localStorage.getItem('admin_setup_completed');
    if (storedSetupStr !== null && storedSetupStr !== 'undefined') {
      const parsed = parseInt(storedSetupStr);
      if (!isNaN(parsed)) {
        storedSetup = parsed;
      }
    }
    
    if (storedToken && storedRole === 'School Admin') {
      const decoded = decodeJwt(storedToken);
      if (decoded && decoded.setup_completed !== undefined) {
        storedSetup = parseInt(decoded.setup_completed);
        localStorage.setItem('admin_setup_completed', String(storedSetup));
      }
    }

    const storedSchoolName = localStorage.getItem('admin_school_name') || 'BN School';
    const storedSchoolId = localStorage.getItem('admin_school_id') || '1';
    
    try {
      if (storedToken) {
        try {
          if (storedRole === 'Super Admin') {
            const res = await fetch('/api/super-admin/stats', {
              headers: { 'Authorization': `Bearer ${storedToken}` }
            });
            if (res.ok) {
              setToken(storedToken);
              setRole('Super Admin');
              setUsername(localStorage.getItem('admin_email') || 'Bilal@yopmail.com');
              await fetchSuperAdminData(storedToken, true);
              window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
              setCurrentPath('/super-admin');
            } else {
              if (storedToken.includes('mock')) {
                throw new Error('Mock token check failed on server. Restoring mock session.');
              }
              if (res.status === 401 || res.status === 403) {
                clearSession();
              } else {
                setToken(storedToken);
                setRole('Super Admin');
                setUsername(localStorage.getItem('admin_email') || 'Bilal@yopmail.com');
                setIsApiUnavailable(true);
                setApiConnectionError(`Server responded with status ${res.status}`);
                window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
                setCurrentPath('/super-admin');
              }
            }
          } else if (storedRole === 'Teacher') {
            setToken(storedToken);
            setRole('Teacher');
            setUsername(localStorage.getItem('admin_email') || '');
            setSchoolId(localStorage.getItem('admin_school_id') || '1');
            setSchoolName(storedSchoolName);
            setActiveTab('teacher_portal');
            await fetchTeacherDashboard(localStorage.getItem('admin_email'));
            window.history.replaceState({ loggedIn: true, role: 'Teacher' }, '', '/dashboard');
            setCurrentPath('/dashboard');
          } else if (storedRole === 'Parent') {
            setToken(storedToken);
            setRole('Parent');
            setUsername(localStorage.getItem('admin_email') || '');
            setSchoolId(localStorage.getItem('admin_school_id') || '1');
            setSchoolName(storedSchoolName);
            setLinkedStudentIds(JSON.parse(localStorage.getItem('admin_linked_student_ids') || '[]'));
            setActiveTab('parent_portal');
            await fetchParentDashboard(localStorage.getItem('admin_email'));
            window.history.replaceState({ loggedIn: true, role: 'Parent' }, '', '/dashboard');
            setCurrentPath('/dashboard');
          } else {
            // School Admin
            const res = await fetch('/api/academic-years', {
              headers: { 'Authorization': `Bearer ${storedToken}` }
            });
            if (res.ok) {
              setToken(storedToken);
              setRole('School Admin');
              setUsername(localStorage.getItem('admin_email') || 'Admin@yopmail.com');
              setSchoolId(localStorage.getItem('admin_school_id') || '1');
              setSetupCompleted(storedSetup);
              setSchoolName(storedSchoolName);
              
              if (storedSetup === 0) {
                window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
                setCurrentPath('/setup');
              } else {
                await fetchSPData(storedToken, storedSchoolId);
                window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
                setCurrentPath('/dashboard');
              }
            } else {
              if (storedToken.includes('mock')) {
                throw new Error('Mock token check failed on server. Restoring mock session.');
              }
              if (res.status === 401 || res.status === 403) {
                clearSession();
              } else {
                setToken(storedToken);
                setRole('School Admin');
                setUsername(localStorage.getItem('admin_email') || 'Admin@yopmail.com');
                setSchoolId(localStorage.getItem('admin_school_id') || '1');
                setSetupCompleted(storedSetup);
                setSchoolName(storedSchoolName);
                setIsApiUnavailable(true);
                setApiConnectionError(`Server responded with status ${res.status}`);
                window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
                setCurrentPath('/dashboard');
                await fetchSPData(storedToken, storedSchoolId);
              }
            }
          }
        } catch (err) {
          // If offline/mock token
          if (storedToken && storedToken.includes('mock')) {
            setToken(storedToken);
            setRole(storedRole);
            setUsername(localStorage.getItem('admin_email') || 'Admin@yopmail.com');
            setSchoolId(localStorage.getItem('admin_school_id') || '1');
            setSetupCompleted(storedSetup);
            setSchoolName(storedSchoolName);
            if (storedRole === 'Super Admin') {
              loadMockSuperAdminData();
              window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
              setCurrentPath('/super-admin');
            } else if (storedRole === 'Teacher') {
              loadMockSeeds(storedSchoolId);
              setActiveTab('teacher_portal');
              await fetchTeacherDashboard(localStorage.getItem('admin_email'));
              window.history.replaceState({ loggedIn: true, role: 'Teacher' }, '', '/dashboard');
              setCurrentPath('/dashboard');
            } else if (storedRole === 'Parent') {
              loadMockSeeds(storedSchoolId);
              setActiveTab('parent_portal');
              await fetchParentDashboard(localStorage.getItem('admin_email'));
              window.history.replaceState({ loggedIn: true, role: 'Parent' }, '', '/dashboard');
              setCurrentPath('/dashboard');
            } else {
              loadMockSeeds(storedSchoolId);
              if (storedSetup === 0) {
                window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
                setCurrentPath('/setup');
              } else {
                window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
                setCurrentPath('/dashboard');
              }
            }
          } else {
            // Real token, network exception
            setToken(storedToken);
            setRole(storedRole || 'School Admin');
            setUsername(localStorage.getItem('admin_email') || 'Admin@yopmail.com');
            setSchoolId(localStorage.getItem('admin_school_id') || '1');
            setSetupCompleted(storedSetup);
            setSchoolName(storedSchoolName);
            setIsApiUnavailable(true);
            setApiConnectionError(err.message || 'API connection failed');
            
            if (storedRole === 'Super Admin') {
              window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
              setCurrentPath('/super-admin');
            } else {
              window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
              setCurrentPath('/dashboard');
              await fetchSPData(storedToken, storedSchoolId);
            }
          }
        }
      } else {
        const path = window.location.pathname;
        if (path === '/super-admin') {
          window.history.replaceState({ loggedIn: false }, '', '/super-admin');
          setCurrentPath('/super-admin');
        } else {
          window.history.replaceState({ loggedIn: false }, '', '/login');
          setCurrentPath('/login');
        }
      }
    } finally {
      clearTimeout(safetyTimeout);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    verifySession();
  }, []);

  // Update signature extraction preview in real-time
  useEffect(() => {
    if (sigToCrop) {
      extractSignature(sigToCrop.originalDataUrl, {
        left: cropLeft,
        right: cropRight,
        top: cropTop,
        bottom: cropBottom,
        threshold: cropThreshold
      }).then(url => {
        setCropPreviewUrl(url);
      });
    } else {
      setCropPreviewUrl('');
    }
  }, [sigToCrop, cropLeft, cropRight, cropTop, cropBottom, cropThreshold]);

  const handleTryReconnect = async () => {
    setIsRetrying(true);
    try {
      setIsApiUnavailable(false);
      setApiConnectionError('');
      await verifySession();
    } catch (err) {
      setIsApiUnavailable(true);
      setApiConnectionError(err.message || 'API connection failed');
    } finally {
      setIsRetrying(false);
    }
  };

  // Central Route Guard
  useEffect(() => {
    if (isInitializing) return;

    if (token) {
      if (role === 'Super Admin') {
        if (currentPath !== '/super-admin') {
          window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
          setCurrentPath('/super-admin');
        }
      } else if (role === 'School Admin') {
        if (Number(setupCompleted) === 0) {
          if (currentPath !== '/setup') {
            window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
            setCurrentPath('/setup');
          }
        } else {
          if (currentPath !== '/dashboard') {
            window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
            setCurrentPath('/dashboard');
          }
        }
      }
    } else {
      if (currentPath !== '/login' && currentPath !== '/super-admin') {
        window.history.replaceState({ loggedIn: false }, '', '/login');
        setCurrentPath('/login');
      }
    }
  }, [currentPath, token, role, setupCompleted, isInitializing]);

  useEffect(() => {
    if (token && role === 'School Admin' && setupCompleted === 1 && !isInitializing) {
      fetchSPData(token, schoolId);
    }
  }, [token, activeYearId, isInitializing, setupCompleted, role, schoolId]);

  const clearSession = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('admin_school_id');
    localStorage.removeItem('admin_setup_completed');
    localStorage.removeItem('bn_active_year_id');
    localStorage.removeItem('admin_permissions');
    localStorage.removeItem('admin_linked_student_ids');
    setToken('');
    setRole('');
    setSchoolId('');
    setSetupCompleted(1);
    setPermissions([]);
    setLinkedStudentIds([]);

    // Reset active view tab & selected states
    setActiveTab('dashboard');
    setSelectedClassId(null);
    setSelectedTeacher(null);
    setSelectedStudent(null);
    setSelectedGroupId(null);
    setEditingStudent(null);
    setReceiptRecord(null);
    setReceiptStudent(null);

    // Reset filter & search states
    setSearchQuery('');
    setGroupFilter('all');
    setSubjectFilter('all');
    setStatusFilter('all');

    // Reset data states to prevent leakage between logins
    setClasses([]);
    setTeachers([]);
    setStudents([]);
    setNotifications([]);
    setAuditLogs([]);
    setDashboardStats(null);
    setSchools([]);
    setSuperStats(null);
    setGeneratedCredentials(null);
    setTeacherSalaries([]);
    setStudentFees([]);
    setSchoolName('BN School');

    const path = window.location.pathname;
    if (path === '/super-admin') {
      window.history.replaceState({ loggedIn: false }, '', '/super-admin');
      setCurrentPath('/super-admin');
    } else {
      window.history.replaceState({ loggedIn: false }, '', '/login');
      setCurrentPath('/login');
    }
  };

  // Intercept global window.alert to suppress auth-related alert popups
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg) => {
      if (msg) {
        const str = msg.toString().toLowerCase();
        if (str.includes('unauthorized') || str.includes('session expired') || str.includes('not authenticated')) {
          console.warn("Blocked auth-related alert popup:", msg);
          return;
        }
      }
      originalAlert(msg);
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  // Intercept global fetch to handle 402/401/403 responses
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      
      if (res.status === 402) {
        try {
          const clone = res.clone();
          const data = await clone.json();
          if (data.subscription_expired) {
            clearSession();
            setExpiredModalInfo({
              message: data.detail || 'Your current plan is expired. Please upgrade your plan or contact to Admin.'
            });
          }
        } catch (e) {
          clearSession();
          setExpiredModalInfo({
            message: 'Your current plan is expired. Please upgrade your plan or contact to Admin.'
          });
        }
      } else if (res.status === 401) {
        const urlStr = args[0] || '';
        if (token && !urlStr.includes('/api/auth/login')) {
          clearSession();
          showToast('Session expired. Please log in again.', 'error');
        }
      } else if (res.status === 403) {
        try {
          const clone = res.clone();
          const data = await clone.json();
          if (data && data.detail === 'Unauthorized Access.') {
            if (token) {
              clearSession();
              showToast('Session expired. Please log in again.', 'error');
            }
          }
        } catch (e) {}
      }
      
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  // Verify subscription status whenever the tab changes
  useEffect(() => {
    if (token && role !== 'Super Admin' && activeTab !== 'profile') {
      fetch('/api/school', { headers: getHeaders() }).catch(e => {});
    }
  }, [activeTab, token, role]);

  // Throttled real-time subscription check on document clicks (max once every 3 seconds)
  useEffect(() => {
    if (!token || role === 'Super Admin') return;
    
    let lastCheckedTime = 0;
    const handleDocumentClick = () => {
      const now = Date.now();
      if (now - lastCheckedTime > 3000) {
        lastCheckedTime = now;
        fetch('/api/school', { headers: getHeaders() }).catch(e => {});
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [token, role]);

  // Close active dropdown menus on outside clicks
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveClassMenuId(null);
      setActiveTeacherMenuId(null);
      setActiveStudentMenuId(null);
      setActiveSchoolMenuId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  const renderExpiredPopupModal = () => {
    if (!expiredModalInfo) return null;
    return (
      <div className="modal-overlay" style={{ zIndex: 200000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setExpiredModalInfo(null)}>
        <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%', textAlign: 'center', padding: '32px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            margin: '0 auto 20px auto'
          }}>
            <Lock size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Subscription Expired</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            Your current plan is expired. Please upgrade your plan or contact to Admin.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => setExpiredModalInfo(null)} 
              className="btn-primary" 
              style={{ justifyContent: 'center', padding: '12px 24px', width: '100%', fontWeight: 700 }}
            >
              Close
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Support contact: bilalnashi6@gmail.com
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Forgot Password: Request OTP
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setForgotOtp(''); // Clear previous OTP so it is not pre-filled
    if (!forgotEmail) {
      setForgotError('Email address is required.');
      return;
    }
    if (!isValidEmail(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.otp) {
          showToast(`Sandbox Password Reset OTP is: ${data.otp}`, 'success');
        } else {
          showToast('OTP sent successfully to your email.', 'success');
        }
        setForgotPasswordStep(2);
      } else {
        const err = await res.json();
        setForgotError(err.detail || 'Email address not registered.');
      }
    } catch (err) {
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const matched = savedUsers.find(u => u.email.trim().toLowerCase() === forgotEmail.trim().toLowerCase());
      const isDefaultMock = forgotEmail.trim().toLowerCase() === 'admin@yopmail.com' || forgotEmail.trim().toLowerCase() === 'bilal@yopmail.com';
      
      if (matched || isDefaultMock) {
        const dummyOtp = '1234';
        localStorage.setItem(`bn_reset_otp_${forgotEmail.trim().toLowerCase()}`, dummyOtp);
        showToast(`Offline Mode Reset OTP is: ${dummyOtp}`, 'success');
        setForgotPasswordStep(2);
      } else {
        setForgotError('Email address is not registered.');
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Forgot Password: Verify OTP
  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotOtp || forgotOtp.length !== 4) {
      setForgotError('Please enter the 4-digit OTP.');
      return;
    }
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp })
      });
      if (res.ok) {
        setForgotPasswordStep(3);
      } else {
        const err = await res.json();
        setForgotError(err.detail || 'Invalid or expired OTP.');
      }
    } catch (err) {
      const storedOtp = localStorage.getItem(`bn_reset_otp_${forgotEmail.trim().toLowerCase()}`);
      if (storedOtp && storedOtp === forgotOtp) {
        setForgotPasswordStep(3);
      } else {
        setForgotError('Invalid or expired OTP.');
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Forgot Password: Reset Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    
    if (!newPassword || newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[!@#$%^&*()_+]/.test(newPassword)) {
      setForgotError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    
    setIsForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, password: sha256Sync(newPassword) })
      });
      if (res.ok) {
        const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
        const updatedUsers = savedUsers.map(u => 
          u.email.trim().toLowerCase() === forgotEmail.trim().toLowerCase() 
            ? { ...u, password: sha256Sync(newPassword) } 
            : u
        );
        localStorage.setItem('bn_mock_users', JSON.stringify(updatedUsers));
        
        showToast('Password reset successfully. Please log in with your new password.', 'success');
        setForgotEmail('');
        setForgotOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setForgotPasswordStep(0);
      } else {
        const err = await res.json();
        setForgotError(err.detail || 'Password reset failed.');
      }
    } catch (err) {
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const updatedUsers = savedUsers.map(u => 
        u.email.trim().toLowerCase() === forgotEmail.trim().toLowerCase() 
          ? { ...u, password: sha256Sync(newPassword) } 
          : u
      );
      localStorage.setItem('bn_mock_users', JSON.stringify(updatedUsers));
      localStorage.removeItem(`bn_reset_otp_${forgotEmail.trim().toLowerCase()}`);
      
      showToast('Password reset successfully (Offline Mode).', 'success');
      setForgotEmail('');
      setForgotOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      setForgotPasswordStep(0);
    } finally {
      setIsForgotLoading(false);
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setRegisterSuccess('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginUser, password: sha256Sync(loginPass) })
      });
      if (res.ok) {
        const data = await res.json();
        
        let setupVal = data.setup_completed;
        if (setupVal === undefined || setupVal === null) {
          const decoded = decodeJwt(data.access_token);
          if (decoded && decoded.setup_completed !== undefined) {
            setupVal = decoded.setup_completed;
          } else {
            setupVal = 1; // Default fallback
          }
        }
        setupVal = parseInt(setupVal);
        if (isNaN(setupVal)) setupVal = 1;

        const schoolNameVal = data.school_name || (data.access_token ? (decodeJwt(data.access_token)?.school_name) : null) || 'BN School';

        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('admin_email', data.email);
        localStorage.setItem('admin_role', data.role);
        localStorage.setItem('admin_school_id', data.school_id || '');
        localStorage.setItem('admin_setup_completed', String(setupVal));
        localStorage.setItem('admin_school_name', schoolNameVal);
        localStorage.setItem('admin_permissions', JSON.stringify(data.permissions || []));
        localStorage.setItem('admin_linked_student_ids', JSON.stringify(data.linked_student_ids || []));

        setToken(data.access_token);
        setUsername(data.email);
        setRole(data.role);
        setSchoolId(data.school_id);
        setSetupCompleted(setupVal);
        setPermissions(data.permissions || []);
        setLinkedStudentIds(data.linked_student_ids || []);
        setSchoolName(schoolNameVal);
        
        setLoginUser(''); setLoginPass('');
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');

        if (data.role === 'Super Admin') {
          window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
          setCurrentPath('/super-admin');
          await fetchSuperAdminData(data.access_token, true);
        } else if (data.role === 'Teacher') {
          window.history.replaceState({ loggedIn: true, role: 'Teacher' }, '', '/dashboard');
          setCurrentPath('/dashboard');
          setActiveTab('teacher_portal');
          await fetchTeacherDashboard(data.email || data.phone);
        } else if (data.role === 'Parent') {
          window.history.replaceState({ loggedIn: true, role: 'Parent' }, '', '/dashboard');
          setCurrentPath('/dashboard');
          setActiveTab('parent_portal');
          await fetchParentDashboard(data.email || data.phone);
        } else {
          if (setupVal === 0) {
            window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
            setCurrentPath('/setup');
          } else {
            window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
            setCurrentPath('/dashboard');
            await fetchSPData(data.access_token, data.school_id);
          }
        }
      } else {
        if (res.status === 500) {
          throw new Error('Database offline. Triggering mock fallback.');
        }

        const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
        const matched = savedUsers.find(u => u.email.trim().toLowerCase() === loginUser.trim().toLowerCase() && verifyLocalPassword(loginPass, u.password));
        if (matched) {
          throw new Error('Dynamic mock user fallback.');
        }

        const err = await res.json();
        setLoginError(err.detail || 'Invalid email or password. Please verify your credentials.');
        setIsLoggingIn(false);
      }
    } catch (err) {
      // Offline fallback login credentials
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const matched = savedUsers.find(u => u.email.trim().toLowerCase() === loginUser.trim().toLowerCase() && verifyLocalPassword(loginPass, u.password));

      if (matched) {
        const mockTokenVal = 'mock-token-' + matched.school_id + '-' + btoa(loginUser.trim()).replace(/\//g, '_').replace(/=/g, '');
        localStorage.setItem('admin_token', mockTokenVal);
        localStorage.setItem('admin_email', loginUser);
        localStorage.setItem('admin_role', matched.role);
        localStorage.setItem('admin_school_id', matched.school_id);
        localStorage.setItem('admin_setup_completed', String(matched.setup_completed));
        localStorage.setItem('admin_school_name', matched.school_name || 'BN School');

        setToken(mockTokenVal);
        setUsername(loginUser);
        setRole(matched.role);
        setSchoolId(matched.school_id);
        setSetupCompleted(matched.setup_completed);
        setSchoolName(matched.school_name || 'BN School');
        setLoginUser(''); setLoginPass('');
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');
        
        if (matched.setup_completed === 0) {
          window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
          setCurrentPath('/setup');
        } else {
          setLoading(true);
          loadMockSeeds(matched.school_id);
          window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
          setCurrentPath('/dashboard');
          setTimeout(() => setLoading(false), 300);
        }
      } else if (loginUser === 'Bilal@yopmail.com' && loginPass === 'Bilal@123') {
        localStorage.setItem('admin_token', 'mock-super-token');
        localStorage.setItem('admin_email', loginUser);
        localStorage.setItem('admin_role', 'Super Admin');
        localStorage.setItem('admin_school_id', '');
        localStorage.setItem('admin_setup_completed', '1');

        setToken('mock-super-token');
        setUsername(loginUser);
        setRole('Super Admin');
        setSchoolId('');
        setSetupCompleted(1);
        setLoginUser(''); setLoginPass('');
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');
        window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
        setCurrentPath('/super-admin');
        loadMockSuperAdminData();
      } else if ((loginUser === 'Admin@yopmail.com' && loginPass === 'Admin@123') || (loginUser === 'dd@yopmail.com' && loginPass === 'Test@123')) {
        setLoading(true);
        loadMockSeeds('1');
        localStorage.setItem('admin_token', 'mock-token');
        localStorage.setItem('admin_email', loginUser);
        localStorage.setItem('admin_role', 'School Admin');
        localStorage.setItem('admin_school_id', '1');
        localStorage.setItem('admin_setup_completed', '1');
        localStorage.setItem('admin_school_name', "St. Xavier's International School");

        setToken('mock-token');
        setUsername(loginUser);
        setRole('School Admin');
        setSchoolId('1');
        setSetupCompleted(1);
        setSchoolName("St. Xavier's International School");
        setLoginUser(''); setLoginPass('');
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');
        window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
        setCurrentPath('/dashboard');
        setTimeout(() => setLoading(false), 300);
      } else if (loginUser.includes('new') && loginPass === 'School@123') {
        // Invite Mock Login
        localStorage.setItem('admin_token', 'mock-token');
        localStorage.setItem('admin_email', loginUser);
        localStorage.setItem('admin_role', 'School Admin');
        localStorage.setItem('admin_school_id', '2');
        localStorage.setItem('admin_setup_completed', '0');
        localStorage.setItem('admin_school_name', "New College Campus");

        setToken('mock-token');
        setUsername(loginUser);
        setRole('School Admin');
        setSchoolId('2');
        setSetupCompleted(0);
        setSchoolName("New College Campus");
        setLoginUser(''); setLoginPass('');
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');
        window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
        setCurrentPath('/setup');
      } else if (loginUser === '9876543210' && loginPass === 'Test@123') {
        localStorage.setItem('admin_token', 'mock-parent-token');
        localStorage.setItem('admin_email', loginUser);
        localStorage.setItem('admin_role', 'Parent');
        localStorage.setItem('admin_school_id', '1');
        localStorage.setItem('admin_setup_completed', '1');
        localStorage.setItem('admin_school_name', "St. Xavier's International School");
        localStorage.setItem('admin_permissions', JSON.stringify([]));
        localStorage.setItem('admin_linked_student_ids', JSON.stringify([4, 5]));

        setToken('mock-parent-token');
        setUsername(loginUser);
        setRole('Parent');
        setSchoolId('1');
        setSetupCompleted(1);
        setPermissions([]);
        setLinkedStudentIds([4, 5]);
        setSchoolName("St. Xavier's International School");
        
        const mockParentStuds = [
          { id: 4, first_name: 'Yusuf', last_name: 'Ali', gr_no: 'GR1004', class_name: 'Class 11' },
          { id: 5, first_name: 'Ananya', last_name: 'Yadav', gr_no: 'GR1005', class_name: 'Class 11' }
        ];
        setParentStudents(mockParentStuds);
        setSelectedParentStudentId(4);

        setLoginUser(''); setLoginPass('');
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully as Parent', 'success');
        window.history.replaceState({ loggedIn: true, role: 'Parent' }, '', '/dashboard');
        setCurrentPath('/dashboard');
      } else {
        setLoginError('Invalid email or password. Please verify your credentials.');
        setIsLoggingIn(false);
      }
    }
  };

  const handleRequestOtp = (e) => {
    e.preventDefault();
    if (!otpPhone.trim()) {
      setLoginError('Please enter a mobile number.');
      return;
    }
    setLoginError('');
    setOtpStep(1);
    showToast('OTP sent (Use 1234)', 'success');
  };

  const handleOtpLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    
    if (otpCode !== '1234') {
      setLoginError('Invalid OTP. Please enter 1234.');
      setIsLoggingIn(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/otp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone.trim(), otp: otpCode })
      });
      if (res.ok) {
        const data = await res.json();
        
        let setupVal = data.setup_completed;
        setupVal = parseInt(setupVal);
        if (isNaN(setupVal)) setupVal = 1;

        const schoolNameVal = data.school_name || 'BN School';

        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('admin_email', data.email || '');
        localStorage.setItem('admin_phone', data.phone || '');
        localStorage.setItem('admin_role', data.role);
        localStorage.setItem('admin_school_id', data.school_id || '');
        localStorage.setItem('admin_setup_completed', String(setupVal));
        localStorage.setItem('admin_school_name', schoolNameVal);
        localStorage.setItem('admin_permissions', JSON.stringify(data.permissions || []));
        localStorage.setItem('admin_linked_student_ids', JSON.stringify(data.linked_student_ids || []));

        setToken(data.access_token);
        setUsername(data.email || '');
        setRole(data.role);
        setSchoolId(data.school_id);
        setSetupCompleted(setupVal);
        setPermissions(data.permissions || []);
        setLinkedStudentIds(data.linked_student_ids || []);
        setSchoolName(schoolNameVal);
        
        setOtpPhone(''); setOtpCode(''); setOtpStep(0);
        setLoginError('');
        setIsLoggingIn(false);
        showToast('Logged In Successfully', 'success');
        
        window.history.replaceState({ loggedIn: true, role: data.role }, '', '/dashboard');
        setCurrentPath('/dashboard');
        await fetchSPData(data.access_token, data.school_id);
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Failed to login via OTP.');
        setIsLoggingIn(false);
      }
    } catch (err) {
      // Offline fallback: simulate successful logins for recognized mock phones
      let data = null;
      if (loginTab === 'parent' && otpPhone.trim() === '9876543210') {
        data = {
          access_token: 'mock-parent-token',
          phone: otpPhone.trim(),
          role: 'Parent',
          permissions: ['parent_portal'],
          linked_student_ids: [4, 5],
          school_id: 1,
          setup_completed: 1,
          school_name: "St. Xavier's International School"
        };
      } else if (loginTab === 'teacher') {
        data = {
          access_token: 'mock-teacher-token',
          phone: otpPhone.trim(),
          role: 'Teacher',
          permissions: ['attendance', 'performance'],
          school_id: 1,
          setup_completed: 1,
          school_name: "St. Xavier's International School"
        };
      } else {
        setLoginError('Mobile number not found in records.');
        setIsLoggingIn(false);
        return;
      }
      
      localStorage.setItem('admin_token', data.access_token);
      localStorage.setItem('admin_phone', data.phone);
      localStorage.setItem('admin_role', data.role);
      localStorage.setItem('admin_school_id', String(data.school_id));
      localStorage.setItem('admin_setup_completed', String(data.setup_completed));
      localStorage.setItem('admin_school_name', data.school_name);
      localStorage.setItem('admin_permissions', JSON.stringify(data.permissions));
      localStorage.setItem('admin_linked_student_ids', JSON.stringify(data.linked_student_ids || []));

      setToken(data.access_token);
      setRole(data.role);
      setSchoolId(data.school_id);
      setSetupCompleted(data.setup_completed);
      setPermissions(data.permissions);
      setLinkedStudentIds(data.linked_student_ids || []);
      setSchoolName(data.school_name);
      
      setOtpPhone(''); setOtpCode(''); setOtpStep(0);
      setLoginError('');
      setIsLoggingIn(false);
      showToast('Logged In Successfully (Offline Mode)', 'success');
      
      setLoading(true);
      loadMockSeeds(data.school_id);
      window.history.replaceState({ loggedIn: true, role: data.role }, '', '/dashboard');
      setCurrentPath('/dashboard');
      setTimeout(() => setLoading(false), 300);
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setTimeout(() => {
      clearSession();
      setIsLoggingOut(false);
      showToast('Logged Out Successfully', 'success');
    }, 2200);
  };

  // Helper to generate secure password satisfying constraints:
  // - At least 8 characters
  // - At least one uppercase letter
  // - At least one lowercase letter
  // - At least one numeric digit
  // - At least one special character
  const generateSecurePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*()_+";
    
    const uChar = uppercase[Math.floor(Math.random() * uppercase.length)];
    const lChar = lowercase[Math.floor(Math.random() * lowercase.length)];
    const nChar = numbers[Math.floor(Math.random() * numbers.length)];
    const sChar = special[Math.floor(Math.random() * special.length)];
    
    const all = uppercase + lowercase + numbers + special;
    let rest = "";
    for (let i = 0; i < 6; i++) {
      rest += all[Math.floor(Math.random() * all.length)];
    }
    
    const array = (uChar + lChar + nChar + sChar + rest).split("");
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array.join("");
  };

  const handleViewSchoolDetails = async (schoolId) => {
    const schoolObj = schools.find(s => s.id === schoolId) || superStats?.recent_schools?.find(s => s.id === schoolId);
    if (!schoolObj) return;
    
    setSelectedViewSchool(schoolObj);
    setIsLoadingSchoolDetails(true);
    setSchoolDetailsData(null);
    setSelectedMemberClass(null);
    setSelectedMemberStudent(null);
    setSelectedMemberTeacher(null);
    setMemberStudentFees([]);
    setMemberTeacherSalaries([]);
    setMemberDetailTab('fees');
    
    try {
      const res = await fetch(`/api/super-admin/schools/${schoolId}/details`, {
        headers: getHeaders(token)
      });
      if (res.ok) {
        const data = await res.json();
        setSchoolDetailsData(data);
      } else {
        throw new Error("Failed to fetch backend details");
      }
    } catch (err) {
      console.warn("Details fetch failed, using sandbox fallback:", err);
      
      const keySuffix = schoolId;
      const localStudents = JSON.parse(localStorage.getItem(`bn_sandbox_students_${keySuffix}`) || '[]');
      const localClasses = JSON.parse(localStorage.getItem(`bn_sandbox_classes_${keySuffix}`) || '[]');
      const localTeachers = JSON.parse(localStorage.getItem(`bn_sandbox_teachers_${keySuffix}`) || '[]');
      
      const mockHistory = [
        {
          id: 1,
          action: 'Plan Activated',
          performed_by: 'System',
          school_name: schoolObj.name,
          plan_name: schoolObj.plan_name || 'Free Trial',
          created_at: (schoolObj.subscription_start || '2026-04-01') + ' 10:00:00'
        }
      ];
      
      const mockBilling = [
        {
          id: 1,
          type: 'Subscription',
          amount: schoolObj.plan_name === 'Free Trial' ? 0 : 12000,
          status: 'Paid',
          description: `Subscription: ${schoolObj.plan_name || 'Free Trial'}`,
          date: schoolObj.subscription_start || '2026-04-01'
        }
      ];
      
      const mockAuditLogs = [
        {
          id: 1,
          operator: 'System',
          action: 'School Provisioned',
          timestamp: (schoolObj.subscription_start || '2026-04-01') + ' 10:00:00',
          details: 'School database schema created successfully.'
        }
      ];
      
      setSchoolDetailsData({
        school: schoolObj,
        subscription_history: mockHistory,
        billing_history: mockBilling,
        audit_logs: mockAuditLogs,
        students_count: localStudents.length || 120,
        classes_count: localClasses.length || 6,
        teachers_count: localTeachers.length || 12,
        students: localStudents.length > 0 ? localStudents : [
          { id: 1, name: 'Mock Student A', roll_number: '101', status: 'Active', gender: 'Male', phone: '9876543210', email: 'mock_a@example.com', father_name: 'Father A', mother_name: 'Mother A', emergency_contact: '9876543211', blood_group: 'O+', aadhaar_number: '1234-5678-9012', nationality: 'Indian', class_id: 1 },
          { id: 2, name: 'Mock Student B', roll_number: '102', status: 'Active', gender: 'Female', phone: '9876543215', email: 'mock_b@example.com', father_name: 'Father B', mother_name: 'Mother B', emergency_contact: '9876543216', blood_group: 'B+', aadhaar_number: '1234-5678-9013', nationality: 'Indian', class_id: 2 }
        ],
        classes: localClasses.length > 0 ? localClasses : [
          { id: 1, name: 'Grade 1', room: '101' },
          { id: 2, name: 'Grade 2', room: '102' }
        ],
        teachers: localTeachers.length > 0 ? localTeachers : [
          { id: 1, name: 'Mock Teacher A', subject: 'Mathematics', status: 'Active', gender: 'Male', phone: '9876543220', email: 'teacher_a@example.com', qualification: 'M.Sc. Mathematics', experience: '5 Years', joining_date: '2022-04-01', salary_amount: 3500.0, assigned_classes: 'Grade 1' },
          { id: 2, name: 'Mock Teacher B', subject: 'Science', status: 'Active', gender: 'Female', phone: '9876543225', email: 'teacher_b@example.com', qualification: 'B.Sc. B.Ed.', experience: '3 Years', joining_date: '2023-08-01', salary_amount: 3000.0, assigned_classes: 'Grade 2' }
        ]
      });
    } finally {
      setIsLoadingSchoolDetails(false);
    }
  };

  const fetchMemberStudentFees = async (schoolId, studentId) => {
    try {
      const res = await fetch(`/api/super-admin/schools/${schoolId}/students/${studentId}/fees`, {
        headers: getHeaders(token)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setMemberStudentFees(data);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch member student fees from backend:", err);
    }

    // Sandbox fallback
    const localYears = JSON.parse(localStorage.getItem(`bn_sandbox_years_${schoolId}`) || '[]');
    const activeYear = localYears.find(y => y.is_active || y.status === 'Active') || localYears[0] || { id: 2 };
    const storageKey = `bn_sandbox_fees_${schoolId}_${studentId}_${activeYear.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setMemberStudentFees(JSON.parse(stored));
    } else {
      const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      const baseFee = 2500;
      const synthFees = months.map((m, i) => ({
        id: i + 1,
        student_id: studentId,
        month: m,
        amount: baseFee,
        status: i < 8 ? "Paid" : "Pending",
        due_date: `2025-${String(i < 9 ? i + 4 : i - 8).padStart(2, '0')}-15`,
        payment_date: i < 8 ? `2025-${String(i < 9 ? i + 4 : i - 8).padStart(2, '0')}-05` : null
      }));
      setMemberStudentFees(synthFees);
    }
  };

  const fetchMemberTeacherSalaries = async (schoolId, teacherId) => {
    try {
      const res = await fetch(`/api/super-admin/schools/${schoolId}/teachers/${teacherId}/salary`, {
        headers: getHeaders(token)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setMemberTeacherSalaries(data);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch member teacher salaries from backend:", err);
    }

    // Sandbox fallback
    const localYears = JSON.parse(localStorage.getItem(`bn_sandbox_years_${schoolId}`) || '[]');
    const activeYear = localYears.find(y => y.is_active || y.status === 'Active') || localYears[0] || { id: 2 };
    const storageKey = `bn_sandbox_salaries_${schoolId}_${teacherId}_${activeYear.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setMemberTeacherSalaries(JSON.parse(stored));
    } else {
      const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      const baseSalary = 3500;
      const synthSalaries = months.map((m, i) => ({
        id: i + 1,
        teacher_id: teacherId,
        month: m,
        amount: baseSalary,
        status: i < 9 ? "Paid" : "Pending",
        payment_date: i < 9 ? `2025-${String(i < 9 ? i + 4 : i - 8).padStart(2, '0')}-05` : null
      }));
      setMemberTeacherSalaries(synthSalaries);
    }
  };

  const handleEditSchoolSubmit = async (e) => {
    e.preventDefault();
    if (!editSchoolForm.name || !editSchoolForm.contact_person || !editSchoolForm.contact_number || !editSchoolForm.subscription_end) {
      alert("Please fill in all required fields.");
      return;
    }
    
    setIsSavingSchool(true);
    const schoolId = showEditSchoolModal.id;
    
    try {
      const res = await fetch(`/api/super-admin/schools/${schoolId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editSchoolForm.name,
          contact_person: editSchoolForm.contact_person,
          contact_number: editSchoolForm.contact_number,
          subscription_end: editSchoolForm.subscription_end,
          status: editSchoolForm.status
        })
      });
      if (res.ok) {
        setShowEditSchoolModal(null);
        // Refresh school details modal if it's currently looking at this school
        if (selectedViewSchool && selectedViewSchool.id === schoolId) {
          handleViewSchoolDetails(schoolId);
        }
        await fetchSuperAdminData();
        showToast('School profile updated successfully', 'success');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update school profile.');
      }
    } catch (err) {
      console.warn("Edit school API failed, updating in mock storage:", err);
      const savedSchools = JSON.parse(localStorage.getItem('bn_mock_schools') || '[]');
      const updated = savedSchools.map(s => {
        if (s.id === schoolId) {
          const today = new Date();
          const end = new Date(editSchoolForm.subscription_end);
          const diffTime = end - today;
          const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          
          const updatedObj = {
            ...s,
            name: editSchoolForm.name,
            contact_person: editSchoolForm.contact_person,
            contact_number: editSchoolForm.contact_number,
            subscription_end: editSchoolForm.subscription_end,
            status: editSchoolForm.status,
            days_remaining: diffDays
          };
          
          if (selectedViewSchool && selectedViewSchool.id === schoolId) {
            setSelectedViewSchool(updatedObj);
          }
          return updatedObj;
        }
        return s;
      });
      
      localStorage.setItem('bn_mock_schools', JSON.stringify(updated));
      loadMockSuperAdminData();
      setShowEditSchoolModal(null);
      showToast('School updated successfully (Sandbox Mode)', 'success');
    } finally {
      setIsSavingSchool(false);
    }
  };

  // Super Admin: Onboard/Invite School
  const handleInviteSchoolSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email || !isValidEmail(inviteForm.email)) {
      alert("Please enter a valid email address.");
      return;
    }
    setIsSendingInvite(true);
    try {
      const res = await fetch('/api/super-admin/invitations', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email: inviteForm.email, plan_id: inviteForm.plan_id })
      });
      if (res.ok) {
        setShowInviteModal(false);
        setInviteForm({ name: '', email: '', contact_person: '', phone: '', plan_id: '' });
        await fetchSuperAdminData();
        showToast('Invitation sent successfully', 'success');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to generate invitation.');
      }
    } catch (err) {
      // Offline fallback onboarding
      const securePassword = generateSecurePassword();
      
      try {
        await fetch('/api/sandbox/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteForm.email,
            name: '-',
            password: securePassword
          })
        });
      } catch (mailErr) {
        console.error("Sandbox SMTP email failed:", mailErr);
      }
      
      let subStart = new Date().toISOString().split('T')[0];
      let subEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      let schStatus = 'Active';
      let remDays = 30;
      
      if (inviteForm.plan_id === 'without_plan') {
        subEnd = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        schStatus = 'Inactive';
        remDays = 0;
      } else if (inviteForm.plan_id) {
        const plan = superPlans.find(p => String(p.id) === String(inviteForm.plan_id));
        const duration = plan ? Number(plan.duration_days) : 30;
        subEnd = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        schStatus = 'Active';
        remDays = duration;
      }
      
      const newSchoolId = schools.length + 1;
      const newSchool = {
        id: newSchoolId,
        name: '-',
        code: 'SCH-' + Math.floor(100000 + Math.random() * 900000),
        contact_person: '-',
        contact_number: '-',
        email: inviteForm.email,
        status: schStatus,
        logo_path: null,
        subscription_start: subStart,
        subscription_end: subEnd,
        setup_completed: 0,
        days_remaining: remDays
      };

      const savedSchools = JSON.parse(localStorage.getItem('bn_mock_schools') || '[]');
      savedSchools.push(newSchool);
      localStorage.setItem('bn_mock_schools', JSON.stringify(savedSchools));

      loadMockSuperAdminData();
      
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      savedUsers.push({
        email: inviteForm.email,
        password: sha256Sync(securePassword),
        role: 'School Admin',
        school_id: String(newSchoolId),
        setup_completed: 0,
        school_name: '-'
      });
      localStorage.setItem('bn_mock_users', JSON.stringify(savedUsers));
      
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', contact_person: '', phone: '', plan_id: '' });
      showToast('Invitation sent successfully', 'success');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Super Admin: Extend Subscription
  const handleExtendSubscription = async (e) => {
    e.preventDefault();
    if (!showExtendModal) return;
    try {
      const res = await fetch(`/api/super-admin/schools/${showExtendModal.id}/extend`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ months: extendMonths })
      });
      if (res.ok) {
        setShowExtendModal(null);
        await fetchSuperAdminData();
        showToast('Subscription Extended Successfully', 'success');
      }
    } catch (err) {
      // Sandbox extend
      setSchools(schools.map(s => {
        if (s.id === showExtendModal.id) {
          const currentEnd = new Date(s.subscription_end);
          currentEnd.setMonth(currentEnd.getMonth() + parseInt(extendMonths));
          const newEnd = currentEnd.toISOString().split('T')[0];
          const diff = Math.ceil((currentEnd - new Date()) / (1000 * 60 * 60 * 24));
          
          const notifKey = `bn_sandbox_notifications_${showExtendModal.id}`;
          const storedNotifs = localStorage.getItem(notifKey);
          if (storedNotifs) {
            let list = JSON.parse(storedNotifs);
            list = list.filter(n => n.type !== 'Subscription');
            localStorage.setItem(notifKey, JSON.stringify(list));
          }
          
          return { ...s, subscription_end: newEnd, days_remaining: diff };
        }
        return s;
      }));
      setShowExtendModal(null);
      showToast('Subscription Extended (Sandbox Mode)', 'success');
    }
  };

  // Super Admin: Save / Edit Subscription Plan
  const handleSavePlan = async (e) => {
    e.preventDefault();
    setIsSavingPlan(true);
    try {
      const method = showEditPlanModal ? 'PUT' : 'POST';
      const url = showEditPlanModal ? `/api/super-admin/plans/${showEditPlanModal.id}` : '/api/super-admin/plans';
      
      if (!isConnected) {
        if (showEditPlanModal) {
          setSuperPlans(superPlans.map(p => p.id === showEditPlanModal.id ? { ...p, ...planForm } : p));
          showToast('Plan updated successfully (Sandbox Mode)', 'success');
        } else {
          const nextId = superPlans.length > 0 ? Math.max(...superPlans.map(p => p.id)) + 1 : 1;
          setSuperPlans([...superPlans, { id: nextId, ...planForm }]);
          showToast('Plan created successfully (Sandbox Mode)', 'success');
        }
        setShowAddPlanModal(false);
        setShowEditPlanModal(null);
        setIsSavingPlan(false);
        return;
      }
      
      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(planForm)
      });
      
      if (res.ok) {
        showToast(showEditPlanModal ? 'Plan updated successfully.' : 'Plan created successfully.', 'success');
        setShowAddPlanModal(false);
        setShowEditPlanModal(null);
        await fetchSuperAdminData();
      } else {
        const errData = await res.json();
        showToast(errData.detail || 'Failed to save plan.', 'error');
      }
    } catch (err) {
      showToast('Network error saving plan.', 'error');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Super Admin: Delete Plan
  const handleDeletePlan = async (id) => {
    if (!window.confirm("Are you sure you want to delete/deactivate this plan?")) return;
    try {
      if (!isConnected) {
        setSuperPlans(superPlans.filter(p => p.id !== id));
        showToast('Plan deleted (Sandbox Mode)', 'success');
        return;
      }
      
      const res = await fetch(`/api/super-admin/plans/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Plan deleted successfully.', 'success');
        await fetchSuperAdminData();
      } else {
        const errData = await res.json();
        showToast(errData.detail || 'Failed to delete plan.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting plan.', 'error');
    }
  };

  // Super Admin: Save Manual Subscription (Activate, Extend, Upgrade, Downgrade, Cancel)
  const handleSaveManualSubscription = async (e) => {
    e.preventDefault();
    setIsSavingSub(true);
    try {
      if (!isConnected) {
        const plan = superPlans.find(p => p.id === parseInt(manualSubForm.plan_id));
        const planName = plan ? plan.name : 'Unknown Plan';
        const duration = plan ? plan.duration_days : 365;
        
        const existingSub = superSubscriptions.find(s => s.school_id === showManualSubModal.school_id);
        let start = manualSubForm.start_date || new Date().toISOString().substring(0, 10);
        let end = manualSubForm.expiry_date;
        if (!end) {
          if (manualSubForm.action_type === 'Cancel') {
            end = new Date().toISOString().substring(0, 10);
          } else if (existingSub && new Date(existingSub.expiry_date) >= new Date()) {
            start = existingSub.start_date;
            end = new Date(new Date(existingSub.expiry_date).getTime() + duration * 24 * 3600 * 1000).toISOString().substring(0, 10);
          } else {
            start = new Date().toISOString().substring(0, 10);
            end = new Date(new Date().getTime() + duration * 24 * 3600 * 1000).toISOString().substring(0, 10);
          }
        }
        
        const remDays = Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24));
        const status = remDays <= 0 ? 'Expired' : (remDays < 15 ? 'Expiring Soon' : 'Active');

        // Clear mock notification flags for this school if we are renewing/extending
        const notifKey = `bn_sandbox_notifications_${showManualSubModal.school_id}`;
        const storedNotifs = localStorage.getItem(notifKey);
        if (storedNotifs) {
          let list = JSON.parse(storedNotifs);
          list = list.filter(n => n.type !== 'Subscription');
          localStorage.setItem(notifKey, JSON.stringify(list));
        }
        
        setSuperSubscriptions(superSubscriptions.map(s => s.school_id === showManualSubModal.school_id ? {
          ...s,
          plan_id: plan ? plan.id : s.plan_id,
          plan_name: planName,
          start_date: start,
          expiry_date: end,
          remaining_days: remDays,
          status: status
        } : s));
        
        // Also update schools
        setSchools(schools.map(s => s.id === showManualSubModal.school_id ? {
          ...s,
          subscription_start: start,
          subscription_end: end,
          days_remaining: remDays,
          status: status === 'Expired' ? 'Inactive' : 'Active'
        } : s));
        
        setSuperAuditLogs([
          {
            id: Date.now(),
            action: manualSubForm.action_type + (manualSubForm.action_type === 'Activate' ? 'd' : 'ed'),
            performed_by: 'Super Admin',
            school_name: showManualSubModal.school_name,
            plan_name: planName,
            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
          },
          ...superAuditLogs
        ]);
        
        showToast('Subscription manual update processed (Sandbox Mode)', 'success');
        setShowManualSubModal(null);
        setIsSavingSub(false);
        return;
      }
      
      const payload = {
        school_id: showManualSubModal.school_id,
        plan_id: manualSubForm.plan_id ? parseInt(manualSubForm.plan_id) : null,
        action_type: manualSubForm.action_type,
        start_date: manualSubForm.start_date || null,
        expiry_date: manualSubForm.expiry_date || null
      };
      
      const res = await fetch('/api/super-admin/subscriptions/activate', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        showToast('Subscription manually updated successfully.', 'success');
        setShowManualSubModal(null);
        await fetchSuperAdminData();
      } else {
        const errData = await res.json();
        showToast(errData.detail || 'Failed to update subscription.', 'error');
      }
    } catch (err) {
      showToast('Network error updating subscription.', 'error');
    } finally {
      setIsSavingSub(false);
    }
  };

  // Super Admin: Deactivate School
  const handleToggleSchoolStatus = async (school) => {
    const nextStatus = school.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`/api/super-admin/schools/${school.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        await fetchSuperAdminData();
        showToast(`School marked ${nextStatus}`, 'success');
      }
    } catch (err) {
      setSchools(schools.map(s => s.id === school.id ? { ...s, status: nextStatus } : s));
      setSuperStats({
        ...superStats,
        active_schools: nextStatus === 'Active' ? superStats.active_schools + 1 : superStats.active_schools - 1,
        inactive_schools: nextStatus === 'Inactive' ? superStats.inactive_schools + 1 : superStats.inactive_schools - 1
      });
      showToast(`School marked ${nextStatus} (Sandbox Mode)`, 'success');
    }
  };

  // Super Admin: Delete School
  const handleDeleteSchool = (schoolId) => {
    setDeleteConfirm({
      message: 'Are you sure you want to delete permanently? All associated accounts, students, and ledgers will be permanently deleted.',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/super-admin/schools/${schoolId}`, {
            method: 'DELETE',
            headers: getHeaders()
          });
          if (res.ok) {
            await fetchSuperAdminData();
            showToast('School Deleted Successfully', 'success');
          } else {
            const err = await res.json();
            alert(err.detail || 'Failed to delete school.');
          }
        } catch (err) {
          // Sandbox delete
          const savedSchools = JSON.parse(localStorage.getItem('bn_mock_schools') || '[]');
          const updatedSchools = savedSchools.filter(s => s.id !== schoolId);
          localStorage.setItem('bn_mock_schools', JSON.stringify(updatedSchools));
          loadMockSuperAdminData();
          showToast('School Deleted (Sandbox Mode)', 'success');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword) {
      setDeleteError("Password is required.");
      return;
    }
    
    setLoading(true);
    let verified = false;
    
    try {
      // Call backend API to verify password
      const verifyRes = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ password: sha256Sync(deletePassword) })
      });
      if (verifyRes.ok) {
        verified = true;
      } else {
        const err = await verifyRes.json();
        setDeleteError(err.detail || "Invalid password.");
      }
    } catch (err) {
      // Fallback local sandbox validation
      const email = username.toLowerCase();
      if (email === 'bilal@yopmail.com' && deletePassword === 'Bilal@123') {
        verified = true;
      } else if (email === 'admin@yopmail.com' && deletePassword === 'Admin@123') {
        verified = true;
      } else {
        const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
        const matched = savedUsers.find(u => u.email.toLowerCase() === email);
        verified = matched && verifyLocalPassword(deletePassword, matched.password);
      }
      
      if (!verified) {
        setDeleteError("Invalid password.");
      }
    } finally {
      setLoading(false);
    }
    
    if (verified) {
      // Proceed with delete
      deleteConfirm.onConfirm();
      setDeleteConfirm(null);
      setDeletePassword('');
      setDeleteError('');
    }
  };

  // School Admin Setup Wizard Submit
  const handleWizardSubmit = async (e) => {
    e.preventDefault();
    if (wizardForm.contact_number && !isValidPhone(wizardForm.contact_number)) {
      alert("Phone Number must contain exactly 10 digits.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/school/setup', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(wizardForm)
      });
      if (res.ok) {
        const data = await res.json();
        
        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('admin_setup_completed', '1');
        localStorage.setItem('admin_school_name', wizardForm.name);
        
        setToken(data.access_token);
        setSetupCompleted(1);
        setSchoolName(wizardForm.name);
        
        showToast('School Setup Completed!', 'success');
        window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
        setCurrentPath('/dashboard');
        await fetchSPData(data.access_token, data.school_id);
      } else {
        if (res.status === 500) {
          throw new Error('Database offline. Triggering mock fallback.');
        }
        const err = await res.json();
        alert(err.detail || 'Configuration update failed.');
      }
    } catch (err) {
      // Sandbox setup completed
      localStorage.setItem('admin_setup_completed', '1');
      localStorage.setItem('admin_school_name', wizardForm.name);
      setSetupCompleted(1);
      setSchoolName(wizardForm.name);
      
      const savedUsers = JSON.parse(localStorage.getItem('bn_mock_users') || '[]');
      const updatedUsers = savedUsers.map(u => u.email.toLowerCase() === username.toLowerCase() ? { ...u, setup_completed: 1, school_name: wizardForm.name } : u);
      localStorage.setItem('bn_mock_users', JSON.stringify(updatedUsers));

      const currentUser = savedUsers.find(u => u.email.toLowerCase() === username.toLowerCase());
      if (currentUser) {
        const savedSchools = JSON.parse(localStorage.getItem('bn_mock_schools') || '[]');
        const updatedSchools = savedSchools.map(s => {
          if (String(s.id) === String(currentUser.school_id)) {
            return {
              ...s,
              name: wizardForm.name,
              contact_person: wizardForm.contact_person,
              contact_number: wizardForm.contact_number,
              status: 'Active',
              setup_completed: 1
            };
          }
          return s;
        });
        localStorage.setItem('bn_mock_schools', JSON.stringify(updatedSchools));
      }

      try {
        await fetch('/api/sandbox/setup-completed', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username })
        });
      } catch (setupErr) {
        console.error("Sandbox SMTP setup status update failed:", setupErr);
      }

      showToast('School Setup Completed! (Sandbox Mode)', 'success');
      window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
      setCurrentPath('/dashboard');
      loadMockSeeds();
    } finally {
      setLoading(false);
    }
  };

  // Tenant operations: salary/fees handlers, class, teachers, students etc.
  const handleAddClass = async (name, room, groups = []) => {
    if (!name) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const newClassId = classes.length + 1;
      const localGroups = groups.map((g, idx) => ({
        id: idx + 1 + Math.floor(Math.random() * 1000),
        school_id: schoolId,
        class_id: newClassId,
        name: g
      }));
      const updated = [...classes, { id: newClassId, name, room, groups: localGroups }];
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Classroom created (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, room, groups })
      });
      if (res.ok) {
        await fetchSPData();
        showToast('Classroom created successfully', 'success');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create classroom');
      }
    } catch (err) {
      const newClassId = classes.length + 1;
      const localGroups = groups.map((g, idx) => ({
        id: idx + 1 + Math.floor(Math.random() * 1000),
        school_id: schoolId,
        class_id: newClassId,
        name: g
      }));
      const updated = [...classes, { id: newClassId, name, room, groups: localGroups }];
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Classroom created (Sandbox Mode)', 'success');
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!classId) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updatedClasses = classes.filter(c => c.id !== classId);
      setClasses(updatedClasses);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updatedClasses));
      
      const studentList = JSON.parse(localStorage.getItem(`bn_sandbox_students_${keySuffix}`) || '[]');
      const remainingStudents = studentList.filter(s => s.class_id !== classId);
      localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(remainingStudents));
      
      const studentsToDelete = studentList.filter(s => s.class_id === classId);
      studentsToDelete.forEach(st => {
        const studentFeesKey = `bn_sandbox_fees_${keySuffix}_${st.id}_${activeYearId}`;
        localStorage.removeItem(studentFeesKey);
      });
      
      const structureStorageKey = `bn_sandbox_class_fees_${keySuffix}_${classId}_${activeYearId}`;
      localStorage.removeItem(structureStorageKey);

      if (selectedClassId === classId) setSelectedClassId(null);
      if (selectedFeesClassId === classId) setSelectedFeesClassId(null);
      if (selectedFeeClassId === classId) {
        setSelectedFeeClassId('');
        setClassFeeStructure(null);
      }

      await fetchSPData();
      showToast('Classroom and associated data deleted successfully (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        if (selectedClassId === classId) setSelectedClassId(null);
        if (selectedFeesClassId === classId) setSelectedFeesClassId(null);
        if (selectedFeeClassId === classId) {
          setSelectedFeeClassId('');
          setClassFeeStructure(null);
        }
        await fetchSPData();
        showToast('Classroom and associated data deleted successfully', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || 'Failed to delete classroom', 'danger');
      }
    } catch (err) {
      showToast('Failed to delete classroom', 'danger');
    }
  };

  const handleUpdateClass = async (classId, name) => {
    if (!name) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = classes.map(c => {
        if (c.id === classId) {
          return { ...c, name };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Classroom updated (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        await fetchSPData();
        showToast('Classroom updated successfully', 'success');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Failed to update classroom', 'danger');
      }
    } catch (err) {
      const updated = classes.map(c => {
        if (c.id === classId) {
          return { ...c, name };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Classroom updated (Sandbox Mode)', 'success');
    }
  };

  const handleAddGroup = async (classId, name) => {
    if (!name) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const newGroupId = Math.floor(Math.random() * 10000);
      const updated = classes.map(c => {
        if (c.id === classId) {
          const existingGrps = c.groups || [];
          return { ...c, groups: [...existingGrps, { id: newGroupId, school_id: schoolId, class_id: classId, name }] };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Group added (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/classes/${classId}/groups`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        await fetchSPData();
        showToast('Group added successfully', 'success');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to add group');
      }
    } catch (err) {
      const newGroupId = Math.floor(Math.random() * 10000);
      const updated = classes.map(c => {
        if (c.id === classId) {
          const existingGrps = c.groups || [];
          return { ...c, groups: [...existingGrps, { id: newGroupId, school_id: schoolId, class_id: classId, name }] };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Group added (Sandbox Mode)', 'success');
    }
  };

  const handleEditGroup = async (groupId, name) => {
    if (!name) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = classes.map(c => {
        if (c.groups) {
          return {
            ...c,
            groups: c.groups.map(g => g.id === groupId ? { ...g, name } : g)
          };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Group updated (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        await fetchSPData();
        showToast('Group updated successfully', 'success');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update group name');
      }
    } catch (err) {
      const updated = classes.map(c => {
        if (c.groups) {
          return {
            ...c,
            groups: c.groups.map(g => g.id === groupId ? { ...g, name } : g)
          };
        }
        return c;
      });
      setClasses(updated);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updated));
      showToast('Group updated (Sandbox Mode)', 'success');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updatedClasses = classes.map(c => {
        if (c.groups) {
          return {
            ...c,
            groups: c.groups.filter(g => g.id !== groupId)
          };
        }
        return c;
      });
      const updatedStudents = students.map(s => s.group_id === groupId ? { ...s, group_id: null } : s);
      setClasses(updatedClasses);
      setStudents(updatedStudents);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updatedClasses));
      localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updatedStudents));
      showToast('Group deleted (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchSPData();
        showToast('Group deleted successfully', 'success');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete group');
      }
    } catch (err) {
      const updatedClasses = classes.map(c => {
        if (c.groups) {
          return {
            ...c,
            groups: c.groups.filter(g => g.id !== groupId)
          };
        }
        return c;
      });
      const updatedStudents = students.map(s => s.group_id === groupId ? { ...s, group_id: null } : s);
      setClasses(updatedClasses);
      setStudents(updatedStudents);
      localStorage.setItem(`bn_sandbox_classes_${keySuffix}`, JSON.stringify(updatedClasses));
      localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updatedStudents));
      showToast('Group deleted (Sandbox Mode)', 'success');
    }
  };

  const handleEditTeacherClick = (teacher) => {
    setEditingTeacher(teacher);
    setTForm({
      name: teacher.name || '',
      subject: teacher.subject || '',
      phone: teacher.phone || '',
      email: teacher.email || '',
      qualification: teacher.qualification || '',
      experience: teacher.experience || '',
      address: teacher.address || '',
      joining_date: teacher.joining_date || '',
      exit_date: teacher.exit_date || '',
      salary_amount: parseFloat(teacher.salary_amount) || 3000.0,
      assigned_classes: teacher.assigned_classes || '',
      gender: teacher.gender || 'Male',
      aadhaar_number: teacher.aadhaar_number || '',
      pan_number: teacher.pan_number || '',
      profile_image: teacher.profile_image || '',
      documents: typeof teacher.documents === 'string' ? JSON.parse(teacher.documents) : (teacher.documents || [])
    });
    setShowAddTeacherModal(true);
  };

  const handleAddTeacherSubmit = async (e) => {
    e.preventDefault();
    if (!tForm.name || !tForm.subject) {
      alert("Name and Subject are required.");
      return;
    }
    if (tForm.phone && !isValidPhone(tForm.phone)) {
      alert("Phone Number must contain exactly 10 digits.");
      return;
    }
    if (tForm.email && !isValidEmail(tForm.email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!tForm.joining_date) {
      alert("Joining Date is mandatory.");
      return;
    }
    if (tForm.aadhaar_number && !/^\d{12}$/.test(tForm.aadhaar_number)) {
      alert("Aadhaar Number must be exactly 12 digits.");
      return;
    }
    if (tForm.pan_number && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(tForm.pan_number.toUpperCase())) {
      return;
    }

    const finalForm = {
      ...tForm,
      pan_number: tForm.pan_number ? tForm.pan_number.toUpperCase() : ''
    };

    const keySuffix = schoolId || 'default';

    if (editingTeacher) {
      if (token.includes('mock') || !isConnected) {
        const updated = teachers.map(t => t.id === editingTeacher.id ? { ...t, ...finalForm } : t);
        setTeachers(updated);
        localStorage.setItem(`bn_sandbox_teachers_${keySuffix}`, JSON.stringify(updated));
        if (selectedTeacher && selectedTeacher.id === editingTeacher.id) {
          setSelectedTeacher({ ...selectedTeacher, ...finalForm });
        }
        setShowAddTeacherModal(false);
        setEditingTeacher(null);
        setTForm({ name: '', subject: '', phone: '', email: '', qualification: '', experience: '', address: '', joining_date: '', exit_date: '', salary_amount: 3000.0, assigned_classes: '', gender: 'Male', aadhaar_number: '', pan_number: '', profile_image: '', documents: [] });
        showToast('Teacher profile updated (Sandbox Mode)', 'success');
        return;
      }
      try {
        const res = await fetch(`/api/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(finalForm)
        });
        if (res.ok) {
          setShowAddTeacherModal(false);
          setEditingTeacher(null);
          await fetchSPData();
          if (selectedTeacher && selectedTeacher.id === editingTeacher.id) {
            setSelectedTeacher({ ...selectedTeacher, ...finalForm });
          }
          setTForm({ name: '', subject: '', phone: '', email: '', qualification: '', experience: '', address: '', joining_date: '', exit_date: '', salary_amount: 3000.0, assigned_classes: '', gender: 'Male', aadhaar_number: '', pan_number: '', profile_image: '', documents: [] });
          showToast('Teacher profile updated', 'success');
        } else {
          const errData = await res.json();
          alert(errData.detail || 'Failed to update teacher');
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to update teacher profile', 'error');
      }
      return;
    }

    if (token.includes('mock') || !isConnected) {
      const newT = { id: teachers.length + 1, ...finalForm, status: "Active", profile_image: finalForm.profile_image || '' };
      const updated = [...teachers, newT];
      setTeachers(updated);
      localStorage.setItem(`bn_sandbox_teachers_${keySuffix}`, JSON.stringify(updated));
      setShowAddTeacherModal(false);
      setTForm({ name: '', subject: '', phone: '', email: '', qualification: '', experience: '', address: '', joining_date: '', exit_date: '', salary_amount: 3000.0, assigned_classes: '', gender: 'Male', aadhaar_number: '', pan_number: '', profile_image: '', documents: [] });
      showToast('Teacher profile added (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(finalForm)
      });
      if (res.ok) {
        setShowAddTeacherModal(false);
        await fetchSPData();
        setTForm({ name: '', subject: '', phone: '', email: '', qualification: '', experience: '', address: '', joining_date: '', exit_date: '', salary_amount: 3000.0, assigned_classes: '', gender: 'Male', aadhaar_number: '', pan_number: '', profile_image: '', documents: [] });
        showToast('Teacher profile added', 'success');
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to add teacher');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to add teacher profile', 'error');
    }
  };

  const handleModifyTeacherStatus = async (teacherId, nextStatus) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = teachers.map(t => t.id === teacherId ? { ...t, status: nextStatus } : t);
      setTeachers(updated);
      localStorage.setItem(`bn_sandbox_teachers_${keySuffix}`, JSON.stringify(updated));
      if (selectedTeacher && selectedTeacher.id === teacherId) {
        setSelectedTeacher({ ...selectedTeacher, status: nextStatus });
      }
      showToast(`Teacher status changed to ${nextStatus} (Sandbox Mode)`, 'success');
      return;
    }
    try {
      const res = await fetch(`/api/teachers/${teacherId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        await fetchSPData();
        if (selectedTeacher && selectedTeacher.id === teacherId) {
          setSelectedTeacher({ ...selectedTeacher, status: nextStatus });
        }
        showToast(`Teacher status changed to ${nextStatus}`, 'success');
      }
    } catch (err) {
      const updated = teachers.map(t => t.id === teacherId ? { ...t, status: nextStatus } : t);
      setTeachers(updated);
      localStorage.setItem(`bn_sandbox_teachers_${keySuffix}`, JSON.stringify(updated));
      if (selectedTeacher && selectedTeacher.id === teacherId) {
        setSelectedTeacher({ ...selectedTeacher, status: nextStatus });
      }
      showToast(`Teacher status changed to ${nextStatus} (Sandbox Mode)`, 'success');
    }
  };

  const handleDeleteTeacher = async (teacherId) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = teachers.filter(t => t.id !== teacherId);
      setTeachers(updated);
      localStorage.setItem(`bn_sandbox_teachers_${keySuffix}`, JSON.stringify(updated));
      setSelectedTeacher(null);
      showToast('Teacher profile deleted (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/teachers/${teacherId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setSelectedTeacher(null);
        await fetchSPData();
        showToast('Teacher profile deleted', 'success');
      }
    } catch (err) {
      const updated = teachers.filter(t => t.id !== teacherId);
      setTeachers(updated);
      localStorage.setItem(`bn_sandbox_teachers_${keySuffix}`, JSON.stringify(updated));
      setSelectedTeacher(null);
      showToast('Teacher profile deleted (Sandbox Mode)', 'success');
    }
  };

  const handleAddStudentSubmit = async (e) => {
    e.preventDefault();
    const activeYear = years.find(y => y.id === activeYearId);
    if (!editingStudent && activeYear && !activeYear.is_active) {
      setActionError("Students can only be admitted to active academic sessions.");
      setTimeout(() => setActionError(''), 4000);
      return;
    }

    // Validation
    const newErrors = {};
    if (!sForm.name) {
      newErrors.name = "Student Name is required.";
    }
    if (!sForm.roll_number) {
      newErrors.roll_number = "Roll Number is required.";
    } else if (!/^\d+$/.test(sForm.roll_number)) {
      newErrors.roll_number = "Roll Number must contain digits only.";
    }
    if (!sForm.sr_no) {
      newErrors.sr_no = "SR No. is required.";
    }
    if (!sForm.father_name) {
      newErrors.father_name = "Father's Name is required.";
    }
    if (!sForm.mother_name) {
      newErrors.mother_name = "Mother's Name is required.";
    }
    if (!sForm.admission_date) {
      newErrors.admission_date = "Admission Date is required.";
    }
    if (!sForm.date_of_birth) {
      newErrors.date_of_birth = "Date of Birth is required.";
    }
    if (!sForm.phone) {
      newErrors.phone = "Phone Number is required.";
    } else if (!isValidPhone(sForm.phone)) {
      newErrors.phone = "Phone Number must contain exactly 10 digits.";
    }
    if (!sForm.emergency_contact) {
      newErrors.emergency_contact = "Emergency Phone is required.";
    } else if (!isValidPhone(sForm.emergency_contact)) {
      newErrors.emergency_contact = "Emergency Phone must contain exactly 10 digits.";
    }
    if (sForm.email && !isValidEmail(sForm.email)) {
      newErrors.email = "Please enter a valid email address.";
    }
    if (!sForm.aadhaar_number) {
      newErrors.aadhaar_number = "Aadhaar Number is required.";
    }
    if (!sForm.country) {
      newErrors.country = "Country is required.";
    }
    if (!sForm.state) {
      newErrors.state = "State is required.";
    }
    if (!sForm.city) {
      newErrors.city = "City is required.";
    }
    if (!sForm.address) {
      newErrors.address = "Home Address is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setSErrors(newErrors);
      return;
    }
    setSErrors({});

    const finalExitDate = sForm.exit_date && sForm.exit_date.trim() !== '' ? sForm.exit_date.trim() : null;
    const finalStatus = finalExitDate ? 'Inactive' : 'Active';
    const payload = { ...sForm, exit_date: finalExitDate, status: finalStatus, academic_year_id: activeYearId };
    const keySuffix = schoolId || 'default';

    setIsSavingStudent(true);
    if (token.includes('mock') || !isConnected) {
      if (!editingStudent && students.some(s => s.roll_number === sForm.roll_number && s.academic_year_id === activeYearId)) {
        setSErrors({ roll_number: "Roll Number already exists." });
        setIsSavingStudent(false);
        return;
      }
      setTimeout(() => {
        if (editingStudent) {
          const updatedStud = { ...editingStudent, ...sForm, exit_date: finalExitDate, status: finalStatus };
          const updated = students.map(s => s.id === editingStudent.id ? updatedStud : s);
          setStudents(updated);
          localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
          setSelectedStudent(updatedStud);
          setIsSavingStudent(false);
          setShowAddStudentModal(false);
          setEditingStudent(null);
          showToast('Student Updated Successfully', 'success');
        } else {
          const newS = { 
            id: students.length + 1, 
            ...sForm, 
            exit_date: finalExitDate,
            status: finalStatus,
            academic_year_id: activeYearId
          };
          const updated = [...students, newS];
          setStudents(updated);
          localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
          setIsSavingStudent(false);
          setShowAddStudentModal(false);
          showToast('Student Added Successfully', 'success');
        }
      }, 800);
      return;
    }

    try {
      let res;
      if (editingStudent) {
        res = await fetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/students', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
      }

      setIsSavingStudent(false);
      if (res.ok) {
        setShowAddStudentModal(false);
        if (editingStudent) {
          const updatedStud = { ...editingStudent, ...payload };
          setSelectedStudent(updatedStud);
        }
        setEditingStudent(null);
        await fetchSPData();
        setSForm({
          name: '',
          roll_number: '',
          class_id: 1,
          group_name: '',
          gender: 'Male',
          phone: '',
          email: '',
          country: '',
          state: '',
          city: '',
          father_name: '',
          mother_name: '',
          address: '',
          date_of_birth: '',
          admission_date: '',
          emergency_contact: '',
          blood_group: '',
          aadhaar_number: '',
          nationality: 'Indian',
          caste: '',
          profile_image: '',
          exit_date: '',
          documents: []
        });
        showToast(editingStudent ? 'Student Updated Successfully' : 'Student Added Successfully', 'success');
      } else {
        const err = await res.json();
        const msg = err.detail || 'Failed to process student request.';
        if (msg.toLowerCase().includes('roll')) {
          setSErrors({ roll_number: "Roll Number already exists." });
        } else {
          setActionError(msg);
        }
      }
    } catch (err) {
      if (!editingStudent && students.some(s => s.roll_number === sForm.roll_number && s.academic_year_id === activeYearId)) {
        setSErrors({ roll_number: "Roll Number already exists." });
        setIsSavingStudent(false);
        return;
      }
      setTimeout(() => {
        if (editingStudent) {
          const updatedStud = { ...editingStudent, ...sForm, exit_date: finalExitDate, status: finalStatus };
          const updated = students.map(s => s.id === editingStudent.id ? updatedStud : s);
          setStudents(updated);
          localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
          setSelectedStudent(updatedStud);
          setIsSavingStudent(false);
          setShowAddStudentModal(false);
          setEditingStudent(null);
          showToast('Student Updated Successfully', 'success');
        } else {
          const newS = { 
            id: students.length + 1, 
            ...sForm, 
            exit_date: finalExitDate,
            status: finalStatus,
            academic_year_id: activeYearId
          };
          const updated = [...students, newS];
          setStudents(updated);
          localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
          setIsSavingStudent(false);
          setShowAddStudentModal(false);
          showToast('Student Added Successfully', 'success');
        }
      }, 800);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = students.filter(s => s.id !== studentId);
      setStudents(updated);
      localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
      setSelectedStudent(null);
      showToast('Student deleted (Sandbox Mode)', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setSelectedStudent(null);
        await fetchSPData();
        showToast('Student deleted successfully', 'success');
      }
    } catch (err) {
      const updated = students.filter(s => s.id !== studentId);
      setStudents(updated);
      localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
      setSelectedStudent(null);
      showToast('Student deleted (Sandbox Mode)', 'success');
    }
  };

  const fetchTeacherSalaryRecords = async (teacherId) => {
    if (token.includes('mock') || !isConnected) {
      const keySuffix = schoolId || 'default';
      const storageKey = `bn_sandbox_salaries_${keySuffix}_${teacherId}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setTeacherSalaries(JSON.parse(stored));
        return;
      }

      const base = teachers.find(t => t.id === teacherId)?.salary_amount || 3000.0;
      const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      const defaultSalaries = months.map((m, i) => ({
        id: i + 1,
        teacher_id: teacherId,
        month: m,
        amount: base,
        status: i < 5 ? "Paid" : "Pending",
        payment_date: i < 5 ? `2025-${String(i+4).padStart(2, '0')}-05` : null
      }));
      setTeacherSalaries(defaultSalaries);
      localStorage.setItem(storageKey, JSON.stringify(defaultSalaries));
      return;
    }

    try {
      const res = await fetch(`/api/teachers/${teacherId}/salary?academic_year_id=${activeYearId}`, { headers: getHeaders() });
      if (res.ok) {
        setTeacherSalaries(await res.json());
      } else {
        throw new Error("Failed to fetch salary records");
      }
    } catch (err) {
      const base = teachers.find(t => t.id === teacherId)?.salary_amount || 3000.0;
      const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      setTeacherSalaries(months.map((m, i) => ({
        id: i + 1,
        teacher_id: teacherId,
        month: m,
        amount: base,
        status: i < 5 ? "Paid" : "Pending",
        payment_date: i < 5 ? `2025-${String(i+4).padStart(2, '0')}-05` : null
      })));
    }
  };

  const fetchStudentFeesRecords = async (studentId, studentClassId = null) => {
    setSelectedMonthsForPayment([]);
    fetchCarryForwardDues(studentId);
    const keySuffix = schoolId || 'default';
    const activeYear = years.find(y => y.id === activeYearId);
    const range = activeYear ? activeYear.year_range : '2025-2026';
    const [startYearStr, endYearStr] = range.split('-');
    const startYear = parseInt(startYearStr) || 2025;
    const endYear = parseInt(endYearStr) || 2026;

    const stud = students.find(s => parseInt(s.id) === parseInt(studentId)) || selectedStudent;
    const classId = studentClassId || stud?.class_id || selectedStudent?.class_id || '';

    if (token.includes('mock') || !isConnected) {
      if (!classId) {
        setIsFeeStructureConfigured(true);
        setStudentFees([]);
        return;
      }
      const sandboxClassFeesKey = `bn_sandbox_class_fees_${keySuffix}_${classId}_${activeYearId}`;
      const storedClassFees = localStorage.getItem(sandboxClassFeesKey);
      
      const isConfig = !!storedClassFees;
      setIsFeeStructureConfigured(isConfig);

      const storageKey = `bn_sandbox_fees_${keySuffix}_${studentId}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      
      const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!isConfig) {
          setStudentFees(parsed.map(fee => ({ ...fee, amount: 0.00 })));
        } else {
          setStudentFees(parsed);
        }
        return;
      }

      const feeStructure = isConfig ? JSON.parse(storedClassFees) : {};
      const defaultFees = months.map((m, i) => {
        const year = i < 9 ? startYear : endYear;
        const monthNum = i < 9 ? i + 4 : i - 8;
        return {
          id: i + 1,
          student_id: studentId,
          month: m,
          amount: isConfig ? (parseFloat(feeStructure[m]) || 0.00) : 0.00,
          status: "Pending",
          due_date: `${year}-${String(monthNum).padStart(2, '0')}-15`,
          payment_date: null
        };
      });
      setStudentFees(defaultFees);
      localStorage.setItem(storageKey, JSON.stringify(defaultFees));
      return;
    }

    try {
      let isConfig = true;
      if (classId) {
        const cfRes = await fetch(`/api/class-fees?class_id=${classId}&academic_year_id=${activeYearId}`, { headers: getHeaders() });
        if (cfRes.ok) {
          const cfData = await cfRes.json();
          if (cfData.is_configured === false) {
            isConfig = false;
          }
        }
      }

      setIsFeeStructureConfigured(isConfig);
      const res = await fetch(`/api/students/${studentId}/fees?academic_year_id=${activeYearId}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (!isConfig) {
          setStudentFees(data.map(fee => ({ ...fee, amount: 0.00 })));
        } else {
          setStudentFees(data);
        }
      } else {
        throw new Error("Failed to fetch fee records");
      }
    } catch (err) {
      let isConfig = true;
      if (classId) {
        const sandboxClassFeesKey = `bn_sandbox_class_fees_${keySuffix}_${classId}_${activeYearId}`;
        const storedClassFees = localStorage.getItem(sandboxClassFeesKey);
        if (!storedClassFees) {
          isConfig = false;
        }
      }
      setIsFeeStructureConfigured(isConfig);
      
      const storageKey = `bn_sandbox_fees_${keySuffix}_${studentId}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      
      const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!isConfig) {
          setStudentFees(parsed.map(fee => ({ ...fee, amount: 0.00 })));
        } else {
          setStudentFees(parsed);
        }
        return;
      }
      
      const sandboxClassFeesKey = classId ? `bn_sandbox_class_fees_${keySuffix}_${classId}_${activeYearId}` : '';
      const storedClassFees = sandboxClassFeesKey ? localStorage.getItem(sandboxClassFeesKey) : null;
      const feeStructure = (isConfig && storedClassFees) ? JSON.parse(storedClassFees) : {};
      const defaultFees = months.map((m, i) => {
        const year = i < 9 ? startYear : endYear;
        const monthNum = i < 9 ? i + 4 : i - 8;
        return {
          id: i + 1,
          student_id: studentId,
          month: m,
          amount: isConfig ? (parseFloat(feeStructure[m]) || 0.00) : 0.00,
          status: "Pending",
          due_date: `${year}-${String(monthNum).padStart(2, '0')}-15`,
          payment_date: null
        };
      });
      setStudentFees(defaultFees);
      localStorage.setItem(storageKey, JSON.stringify(defaultFees));
    }
  };

  const fetchCarryForwardDues = async (studentId) => {
    setIsFetchingCarryForwardDues(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_carry_forward_dues_${keySuffix}`) || '[]';
      const allDues = JSON.parse(stored);
      const studentDues = allDues.filter(d => parseInt(d.student_id) === parseInt(studentId));
      setStudentCarryForwardDues(studentDues);
      setIsFetchingCarryForwardDues(false);
      return;
    }
    try {
      const res = await fetch(`/api/students/${studentId}/carry-forward-dues`, { headers: getHeaders() });
      if (res.ok) {
        setStudentCarryForwardDues(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingCarryForwardDues(false);
    }
  };

  const fetchPreviousYearRecoveries = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_previous_year_recoveries_${keySuffix}`) || '[]';
      const allRecs = JSON.parse(stored);
      const activeYear = years.find(y => y.id === activeYearId);
      
      const storedDuesKey = `bn_sandbox_carry_forward_dues_${keySuffix}`;
      const allDues = JSON.parse(localStorage.getItem(storedDuesKey) || '[]');
      
      const filtered = allRecs.filter(r => {
        return parseInt(r.academic_year_id) === parseInt(activeYearId);
      });
      
      const mapped = filtered.map(r => {
        const stud = students.find(s => parseInt(s.id) === parseInt(r.student_id));
        const due = allDues.find(d => parseInt(d.id) === parseInt(r.carry_forward_due_id));
        
        let origClassId = stud ? stud.class_id : null;
        if (stud && due && parseInt(stud.academic_year_id) !== parseInt(due.original_academic_year_id)) {
          const origStud = students.find(s => 
            s.name === stud.name && 
            s.roll_number === stud.roll_number && 
            parseInt(s.academic_year_id) === parseInt(due.original_academic_year_id)
          );
          if (origStud) {
            origClassId = origStud.class_id;
          }
        }
        
        return {
          ...r,
          class_name: origClassId ? getClassName(origClassId) : r.class_name
        };
      });
      setPreviousYearRecoveries(mapped);
      return;
    }
    try {
      const res = await fetch(`/api/finance/previous-dues-recoveries?academic_year_id=${activeYearId}`, { headers: getHeaders() });
      if (res.ok) {
        setPreviousYearRecoveries(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Student Performance API / Mock Fetchers ---
  
  const fetchAttendance = async (classId, date, ayId, groupName) => {
    if (!classId || !ayId) return;
    setIsFetchingAttendance(true);
    setAttendanceStudents([]); // Immediately clear previous student data to prevent stale cards
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}_${ayId}`) || '[]';
      const allStuds = JSON.parse(storedStudents);
      const filteredStuds = allStuds.filter(s => 
        parseInt(s.class_id) === parseInt(classId) && 
        s.status === 'Active' &&
        (groupName === 'all' || !groupName || s.group_name === groupName)
      );
      
      const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
      const attList = JSON.parse(storedAtt);
      const attMap = {};
      attList.forEach(a => {
        if (a.attendance_date === date) {
          attMap[parseInt(a.student_id)] = a.status;
        }
      });
      
      const result = filteredStuds.map(s => ({
        id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        group_name: s.group_name,
        status: attMap[parseInt(s.id)] ?? null
      })).sort((a, b) => {
        const rA = parseInt(a.roll_number) || 0;
        const rB = parseInt(b.roll_number) || 0;
        return rA - rB || a.name.localeCompare(b.name);
      });
      
      const initialEdits = {};
      const allNull = result.every(s => s.status === null || s.status === undefined);
      result.forEach(s => {
        initialEdits[s.id] = s.status || 'Present';
      });
      setMarkedAttendance(initialEdits);
      if (allNull) {
        setAttendanceStatus('Not Marked');
        setIsAttendanceEditing(true);
      } else {
        setAttendanceStatus('Submitted');
        setIsAttendanceEditing(false);
      }
      
      setAttendanceStudents(result);
      setIsFetchingAttendance(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance?class_id=${classId}&date=${date}&academic_year_id=${ayId}&group_name=${groupName}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const sorted = data.sort((a, b) => {
          const rA = parseInt(a.roll_number) || 0;
          const rB = parseInt(b.roll_number) || 0;
          return rA - rB || a.name.localeCompare(b.name);
        });

        const initialEdits = {};
        const allNull = sorted.every(s => s.status === null || s.status === undefined);
        sorted.forEach(s => {
          initialEdits[s.id] = s.status || 'Present';
        });
        setMarkedAttendance(initialEdits);
        if (allNull) {
          setAttendanceStatus('Not Marked');
          setIsAttendanceEditing(true);
        } else {
          setAttendanceStatus('Submitted');
          setIsAttendanceEditing(false);
        }

        setAttendanceStudents(sorted);
      }
    } catch (err) {
      console.error(err);
      showToast("Error fetching attendance list.", "error");
    } finally {
      setIsFetchingAttendance(false);
    }
  };

  const saveAttendanceBulk = async (classId, date, ayId, studentsList) => {
    setIsSavingAttendance(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
      const attList = JSON.parse(storedAtt);
      
      studentsList.forEach(item => {
        const idx = attList.findIndex(a => parseInt(a.student_id) === parseInt(item.student_id) && a.attendance_date === date);
        if (idx !== -1) {
          attList[idx].status = item.status;
        } else {
          attList.push({
            id: attList.length + 1,
            school_id: schoolId || 1,
            academic_year_id: ayId,
            class_id: classId,
            student_id: item.student_id,
            attendance_date: date,
            status: item.status
          });
        }
      });
      
      localStorage.setItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`, JSON.stringify(attList));
      setIsSavingAttendance(false);
      showToast("Attendance saved successfully (Sandbox Mode)", "success");
      setAttendanceStatus('Submitted');
      setIsAttendanceEditing(false);
      fetchAttendance(classId, date, ayId, attendanceGroupName);
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: classId,
          academic_year_id: ayId,
          date,
          students: studentsList
        })
      });
      if (res.ok) {
        showToast("Attendance saved successfully.", "success");
        setAttendanceStatus('Submitted');
        setIsAttendanceEditing(false);
        fetchAttendance(classId, date, ayId, attendanceGroupName);
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to save attendance.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error saving attendance.", "error");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const fetchAttendanceReport = async (classId, month, ayId, groupName) => {
    if (!classId || !ayId) return;
    setIsFetchingAttendanceReport(true);
    setAttendanceReportData([]); // Immediately clear previous report data to prevent stale cards
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}_${ayId}`) || '[]';
        const allStuds = JSON.parse(storedStudents);
        const filteredStuds = allStuds.filter(s => 
          parseInt(s.class_id) === parseInt(classId) && 
          s.status === 'Active' &&
          (groupName === 'all' || !groupName || s.group_name === groupName)
        );
        
        const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
        const attList = JSON.parse(storedAtt);
        
        // Calculate study days for sandbox month
        const [mYear, mMonth] = month.split('-');
        const lastDay = new Date(parseInt(mYear), parseInt(mMonth), 0).getDate();
        
        const sandboxLeaves = JSON.parse(localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`) || '[]');
        const activeYear = years.find(y => y.id === ayId);
        const systemHols = activeYear ? getSystemHolidays(activeYear.start_date, activeYear.end_date, ayId) : [];
        const combined = [...sandboxLeaves, ...systemHols];
        const leaveDates = combined.map(l => l.leave_date);
        
        let sDays = 0;
        let suns = 0;
        let holis = 0;
        const workingDates = {};
        for (let d = 1; d <= lastDay; d++) {
          const dateStr = `${month}-${String(d).padStart(2, '0')}`;
          // Get local day of week to prevent timezone offsets shifting sundays
          const dObj = new Date(parseInt(mYear), parseInt(mMonth) - 1, d);
          const isSun = dObj.getDay() === 0;
          const isLeave = leaveDates.includes(dateStr);
          if (isSun) {
            suns++;
          } else if (isLeave) {
            holis++;
          } else {
            sDays++;
            workingDates[dateStr] = true;
          }
        }
        setAttendanceReportStudyDays(sDays);
        setAttendanceReportSundays(suns);
        setAttendanceReportHolidays(holis);
        
        const result = filteredStuds.map(s => {
          const studentAtt = attList.filter(a => 
            parseInt(a.student_id) === parseInt(s.id) && 
            a.attendance_date.startsWith(month) &&
            workingDates[a.attendance_date] === true
          );
          const present = studentAtt.filter(a => a.status === 'Present').length;
          const absent = studentAtt.filter(a => a.status === 'Absent').length;
          const leave = studentAtt.filter(a => a.status === 'Leave').length;
          const percentage = sDays > 0 ? roundDecimal((present / sDays) * 100, 2) : 0;
          
          return {
            id: s.id,
            name: s.name,
            roll_number: s.roll_number,
            group_name: s.group_name,
            present,
            absent,
            leave,
            percentage
          };
        }).sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0) || a.name.localeCompare(b.name));
        
        setAttendanceReportData(result);
        setIsFetchingAttendanceReport(false);
      }, 300);
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance/report/monthly?class_id=${classId}&month=${month}&academic_year_id=${ayId}&group_name=${groupName}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        const reportList = Array.isArray(data) ? data : (data.report || []);
        const sDays = data.study_days !== undefined ? data.study_days : 0;
        const sunsCount = data.sundays_count !== undefined ? data.sundays_count : 0;
        const holisCount = data.holidays_count !== undefined ? data.holidays_count : 0;
        setAttendanceReportStudyDays(sDays);
        setAttendanceReportSundays(sunsCount);
        setAttendanceReportHolidays(holisCount);
        const sorted = reportList.sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0) || a.name.localeCompare(b.name));
        setAttendanceReportData(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingAttendanceReport(false);
    }
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const fetchLeaves = async (ayId) => {
    if (!ayId) return;
    setIsFetchingLeaves(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const storedLeaves = localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`) || '[]';
        const parsed = JSON.parse(storedLeaves);
        parsed.forEach(l => {
          if (!l.category) l.category = 'School Holiday';
        });
        const activeYear = years.find(y => y.id === ayId);
        const systemHols = activeYear ? getSystemHolidays(activeYear.start_date, activeYear.end_date, ayId) : [];
        setLeavesList([...parsed, ...systemHols]);
        setIsFetchingLeaves(false);
      }, 200);
      return;
    }
    
    try {
      const res = await fetch(`/api/leaves?academic_year_id=${ayId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setLeavesList(await res.json());
      }
    } catch (err) {
      console.error(err);
      showToast("Error fetching leaves", "error");
    } finally {
      setIsFetchingLeaves(false);
    }
  };

  const saveLeave = async (ayId, title, leaveDate, description) => {
    if (!ayId || !title || !leaveDate) return;
    
    const activeYear = years.find(y => y.id === ayId);
    if (!activeYear) {
      showToast("Invalid academic year selection.", "error");
      return;
    }
    if (leaveDate < activeYear.start_date || leaveDate > activeYear.end_date) {
      showToast("Leave date must belong to the active academic session.", "error");
      return;
    }
    
    const isDuplicate = leavesList.some(l => l.leave_date === leaveDate);
    if (isDuplicate) {
      showToast("A leave has already been declared for this date.", "error");
      return;
    }
    
    setIsSavingLeave(true);
    const keySuffix = schoolId || 'default';
    const formattedDate = formatDateString(leaveDate);
    
    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const storedLeaves = localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`) || '[]';
        const list = JSON.parse(storedLeaves);
        const newLeave = {
          id: Date.now(),
          school_id: 1,
          academic_year_id: ayId,
          title: title,
          leave_date: leaveDate,
          description: description,
          created_at: new Date().toISOString()
        };
        list.push(newLeave);
        localStorage.setItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`, JSON.stringify(list));
        setLeavesList(list);
        
        const notifKey = `bn_sandbox_notifications_${keySuffix}`;
        const storedNotifs = localStorage.getItem(notifKey) || '[]';
        const notifs = JSON.parse(storedNotifs);
        
        const newTeacherNotif = {
          id: Date.now() + 1,
          school_id: 1,
          title: "New Holiday Declared",
          content: `School holiday added for ${formattedDate} – ${title}.` + (description ? ` Description: ${description}` : ''),
          type: "Holiday",
          is_read: 0,
          timestamp: new Date().toISOString()
        };
        
        const newParentNotif = {
          id: Date.now() + 2,
          school_id: 1,
          title: "School Holiday Notice",
          content: `School Holiday Notice: ${title} has been declared for ${formattedDate}.` + (description ? ` Description: ${description}` : ''),
          type: "Holiday",
          is_read: 0,
          timestamp: new Date().toISOString()
        };
        
        notifs.unshift(newTeacherNotif, newParentNotif);
        localStorage.setItem(notifKey, JSON.stringify(notifs));
        setNotifications(notifs);
        
        showToast("Holiday declared successfully!", "success");
        setLeaveForm({ date: '', title: '', description: '' });
        setIsSavingLeave(false);
      }, 300);
      return;
    }
    
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          academic_year_id: ayId,
          title: title,
          leave_date: leaveDate,
          description: description
        })
      });
      if (res.ok) {
        showToast("Holiday declared successfully!", "success");
        setLeaveForm({ date: '', title: '', description: '' });
        fetchLeaves(ayId);
        fetchNotifications();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to declare holiday.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error declaring holiday.", "error");
    } finally {
      setIsSavingLeave(false);
    }
  };

  const editLeave = async (leaveId, ayId, title, leaveDate, description) => {
    if (!leaveId || !ayId || !title || !leaveDate) return;
    
    const activeYear = years.find(y => y.id === ayId);
    if (!activeYear) {
      showToast("Invalid academic year selection.", "error");
      return;
    }
    if (leaveDate < activeYear.start_date || leaveDate > activeYear.end_date) {
      showToast("Leave date must belong to the active academic session.", "error");
      return;
    }
    
    const isDuplicate = leavesList.some(l => l.leave_date === leaveDate && l.id !== leaveId);
    if (isDuplicate) {
      showToast("A leave has already been declared for this date.", "error");
      return;
    }
    
    setIsSavingLeave(true);
    const keySuffix = schoolId || 'default';
    
    if (token.includes('mock') || !isConnected) {
      setTimeout(() => {
        const storedLeaves = localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`) || '[]';
        const list = JSON.parse(storedLeaves);
        const idx = list.findIndex(l => l.id === leaveId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            title: title,
            leave_date: leaveDate,
            description: description
          };
          localStorage.setItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`, JSON.stringify(list));
          setLeavesList(list);
          showToast("Holiday updated successfully!", "success");
        }
        setIsSavingLeave(false);
        setEditingLeave(null);
        setLeaveForm({ date: '', title: '', description: '' });
      }, 300);
      return;
    }
    
    try {
      const res = await fetch(`/api/leaves/${leaveId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          academic_year_id: ayId,
          title: title,
          leave_date: leaveDate,
          description: description
        })
      });
      if (res.ok) {
        showToast("Holiday updated successfully!", "success");
        setLeaveForm({ date: '', title: '', description: '' });
        setEditingLeave(null);
        fetchLeaves(ayId);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to update holiday.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating holiday.", "error");
    } finally {
      setIsSavingLeave(false);
    }
  };

  const deleteLeave = async (leaveId, ayId) => {
    if (!leaveId || !ayId) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedLeaves = localStorage.getItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`) || '[]';
      const list = JSON.parse(storedLeaves);
      const filtered = list.filter(l => l.id !== leaveId);
      localStorage.setItem(`bn_sandbox_leaves_${keySuffix}_${ayId}`, JSON.stringify(filtered));
      setLeavesList(filtered);
      showToast("Holiday removed successfully.", "success");
      return;
    }
    
    try {
      const res = await fetch(`/api/leaves/${leaveId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast("Holiday removed successfully.", "success");
        fetchLeaves(ayId);
      } else {
        showToast("Failed to remove holiday.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error removing holiday.", "error");
    }
  };

  const saveReportCardRemark = async (studentId, examId, remarksText, ayId) => {
    if (!studentId || !examId || !ayId) return;
    const keySuffix = schoolId || 'default';
    
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${ayId}`) || '[]';
      const list = JSON.parse(stored);
      const existingIdx = list.findIndex(r => parseInt(r.exam_id) === parseInt(examId) && parseInt(r.student_id) === parseInt(studentId));
      if (existingIdx !== -1) {
        list[existingIdx].remarks = remarksText;
      } else {
        list.push({ student_id: studentId, exam_id: examId, remarks: remarksText });
      }
      localStorage.setItem(`bn_sandbox_remarks_${keySuffix}_${ayId}`, JSON.stringify(list));
      
      // Update in-memory summary immediately
      if (studentPerformanceSummary && parseInt(studentPerformanceSummary.student_id) === parseInt(studentId)) {
        const updatedExams = studentPerformanceSummary.exams.map(e => {
          if (parseInt(e.id) === parseInt(examId)) {
            return { ...e, remarks: remarksText };
          }
          return e;
        });
        setStudentPerformanceSummary({ ...studentPerformanceSummary, exams: updatedExams });
      }
      showToast("Remarks saved successfully (Sandbox Mode)", "success");
      return;
    }
    
    try {
      const res = await fetch(`/api/exams/${examId}/remarks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          remarks: [
            { student_id: studentId, remarks: remarksText }
          ]
        })
      });
      if (res.ok) {
        showToast("Remarks saved successfully", "success");
        fetchStudentPerformanceSummary(studentId, ayId);
      } else {
        const d = await res.json();
        showToast(d.detail || "Failed to save remarks", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error saving remarks", "error");
    }
  };

  useEffect(() => {
    if (studentPerformanceSummary && reportCardExamId && reportCardExamId !== 'overall') {
      const activeExam = studentPerformanceSummary.exams.find(e => parseInt(e.id) === parseInt(reportCardExamId));
      setRemarksInput(activeExam?.remarks || '');
    } else {
      setRemarksInput('');
    }
  }, [studentPerformanceSummary, reportCardExamId]);

  const fetchStudentAttendanceAnalytics = async (studentId, ayId) => {
    if (!studentId || !ayId) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
      const attList = JSON.parse(storedAtt);
      const studentAtt = attList.filter(a => parseInt(a.student_id) === parseInt(studentId));
      const present = studentAtt.filter(a => a.status === 'Present').length;
      const absent = studentAtt.filter(a => a.status === 'Absent').length;
      const leave = studentAtt.filter(a => a.status === 'Leave').length;
      const total = present + absent + leave;
      const percentage = total > 0 ? roundDecimal((present / total) * 100, 1) : 0;
      setAttendanceAnalytics({ present, absent, leave, total, percentage });
      return;
    }
    
    try {
      const res = await fetch(`/api/attendance/analytics/student/${studentId}?academic_year_id=${ayId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setAttendanceAnalytics(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExams = async (ayId, classId = 0) => {
    if (!ayId) return;
    setIsFetchingExams(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      let list = JSON.parse(storedExams);
      if (classId > 0) {
        list = list.filter(e => parseInt(e.class_id) === parseInt(classId));
      }
      setExamsList(list);
      setIsFetchingExams(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/exams?academic_year_id=${ayId}&class_id=${classId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setExamsList(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingExams(false);
    }
  };

  const saveScheme = async (formData, oldSchemeName = '') => {
    setIsSavingExam(true);
    const keySuffix = schoolId || 'default';
    const ayId = activeYearId;

    // Compile classes to delete (if editing and class is unselected)
    const isEdit = oldSchemeName !== '';
    let examsToDelete = [];
    let existingExams = [];

    if (isEdit) {
      // Find all exams that matched the old scheme name
      if (token.includes('mock') || !isConnected) {
        const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
        const list = JSON.parse(storedExams);
        existingExams = list.filter(e => e.name === oldSchemeName);
      } else {
        try {
          const res = await fetch(`/api/exams?academic_year_id=${ayId}`, { headers: getHeaders() });
          if (res.ok) {
            const list = await res.json();
            existingExams = list.filter(e => e.name === oldSchemeName);
          }
        } catch (err) {
          console.error("Error fetching matching exams during edit", err);
        }
      }

      // Identify which existing class exams are no longer in the updated applicable_classes
      examsToDelete = existingExams.filter(e => !formData.applicable_classes.includes(String(e.class_id)) && !formData.applicable_classes.includes(Number(e.class_id)));
    }

    // Perform deletions
    for (const exam of examsToDelete) {
      if (token.includes('mock') || !isConnected) {
        const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
        let list = JSON.parse(storedExams);
        list = list.filter(e => parseInt(e.id) !== parseInt(exam.id));
        localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
      } else {
        try {
          await fetch(`/api/exams/${exam.id}`, { method: 'DELETE', headers: getHeaders() });
        } catch (err) {
          console.error(`Error deleting class ${exam.class_id} exam`, err);
        }
      }
    }

    // Now, save or update exams for each selected class
    for (const classIdStr of formData.applicable_classes) {
      const classId = parseInt(classIdStr);
      const subjects = formData.class_subjects[classId] || [];
      
      // Calculate min and max date
      let startDate = null;
      let endDate = null;
      if (subjects.length > 0) {
        const dates = subjects.map(s => s.exam_date).filter(Boolean);
        if (dates.length > 0) {
          dates.sort();
          startDate = dates[0];
          endDate = dates[dates.length - 1];
        }
      }

      const examPayload = {
        name: formData.name,
        description: formData.description || '',
        status: formData.status || 'Draft',
        class_id: classId,
        group_name: '',
        start_date: startDate || new Date().toISOString().slice(0, 10),
        end_date: endDate || new Date().toISOString().slice(0, 10),
        subjects: subjects
      };

      const matchedExisting = existingExams.find(e => parseInt(e.class_id) === classId);

      if (matchedExisting) {
        // Update existing record
        if (token.includes('mock') || !isConnected) {
          const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
          let list = JSON.parse(storedExams);
          const idx = list.findIndex(e => parseInt(e.id) === parseInt(matchedExisting.id));
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              name: examPayload.name,
              description: examPayload.description,
              status: examPayload.status,
              start_date: examPayload.start_date,
              end_date: examPayload.end_date,
              subjects: examPayload.subjects
            };
            localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
          }
        } else {
          try {
            await fetch(`/api/exams/${matchedExisting.id}`, {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify(examPayload)
            });
          } catch (err) {
            console.error(`Error updating class ${classId} exam`, err);
          }
        }
      } else {
        // Create new record
        if (token.includes('mock') || !isConnected) {
          const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
          const list = JSON.parse(storedExams);
          const newExam = {
            id: list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1,
            school_id: schoolId || 1,
            academic_year_id: ayId,
            ...examPayload
          };
          list.push(newExam);
          localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
        } else {
          try {
            await fetch(`/api/exams`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({
                ...examPayload,
                academic_year_id: ayId
              })
            });
          } catch (err) {
            console.error(`Error creating class ${classId} exam`, err);
          }
        }
      }
    }

    setIsSavingExam(false);
    showToast(isEdit ? "Scheme updated successfully." : "Scheme created successfully.", "success");
    setShowCreateSchemeModal(false);
    fetchExams(ayId);
  };

  const saveExam = async (formData, examId = null) => {
    setIsSavingExam(true);
    const keySuffix = schoolId || 'default';
    const ayId = activeYearId;
    const isEdit = examId !== null;

    const examPayload = {
      name: formData.name,
      description: formData.description || '',
      status: formData.status || 'Draft',
      class_id: parseInt(formData.class_id),
      group_name: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      subjects: formData.subjects.map(s => ({
        subject_name: s.subject_name.trim(),
        max_marks: parseInt(s.max_marks) || 100
      })).filter(s => s.subject_name !== '')
    };

    if (token.includes('mock') || !isConnected) {
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      let list = JSON.parse(storedExams);

      if (isEdit) {
        const idx = list.findIndex(e => parseInt(e.id) === parseInt(examId));
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            ...examPayload
          };
        }
      } else {
        const newExam = {
          id: list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1,
          school_id: schoolId || 1,
          academic_year_id: ayId,
          ...examPayload
        };
        list.push(newExam);
      }
      localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
      showToast(isEdit ? "Exam updated (Sandbox)" : "Exam created (Sandbox)", "success");
      fetchExams(ayId);
      setShowExamFormModal(false);
      setIsSavingExam(false);
      return;
    }

    try {
      let res;
      if (isEdit) {
        res = await fetch(`/api/exams/${examId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(examPayload)
        });
      } else {
        res = await fetch(`/api/exams`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            ...examPayload,
            academic_year_id: ayId
          })
        });
      }

      if (res.ok) {
        showToast(isEdit ? "Exam updated successfully." : "Exam created successfully.", "success");
        setShowExamFormModal(false);
        fetchExams(ayId);
      } else {
        const errorData = await res.json();
        showToast(errorData.detail || "Error saving exam.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error saving exam.", "error");
    } finally {
      setIsSavingExam(false);
    }
  };

  const deleteExam = async (examId) => {
    const keySuffix = schoolId || 'default';
    const ayId = activeYearId;

    if (token.includes('mock') || !isConnected) {
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      let list = JSON.parse(storedExams);
      list = list.filter(e => parseInt(e.id) !== parseInt(examId));
      localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
      showToast("Exam deleted (Sandbox)", "success");
      fetchExams(ayId);
    } else {
      try {
        const res = await fetch(`/api/exams/${examId}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        if (res.ok) {
          showToast("Exam deleted successfully.", "success");
          fetchExams(ayId);
        } else {
          showToast("Error deleting exam.", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Error deleting exam.", "error");
      }
    }
  };

  const toggleExamPublish = async (exam, currentStatus, bypassConfirmation = false) => {
    const keySuffix = schoolId || 'default';
    const ayId = activeYearId;
    const nextStatus = currentStatus === 'Published' ? 'Draft' : 'Published';

    if (!bypassConfirmation) {
      if (nextStatus === 'Published') {
        setExamPublishConfirm({
          title: "Publish Examination Results",
          message: "You are about to publish this examination.\n\nOnce published, student report cards, subject marks, grades and teacher remarks will become visible to parents through the Parent Mobile Application.\n\nPlease ensure that all student marks have been reviewed and verified before publishing.\n\nIf any corrections are required later, you may move the examination back to Draft status, make changes, and publish again.\n\nDo you want to continue?",
          confirmText: "Publish Results",
          onConfirm: () => toggleExamPublish(exam, currentStatus, true)
        });
      } else {
        setExamPublishConfirm({
          title: "Move Examination Back To Draft",
          message: "This action will immediately hide report cards, marks, grades and remarks from the Parent Mobile Application until the examination is published again.\n\nDo you want to continue?",
          confirmText: "Move To Draft",
          onConfirm: () => toggleExamPublish(exam, currentStatus, true)
        });
      }
      return;
    }

    if (token.includes('mock') || !isConnected) {
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      let list = JSON.parse(storedExams);
      list = list.map(e => {
        if (parseInt(e.id) === parseInt(exam.id)) {
          return { 
            ...e, 
            status: nextStatus,
            published_at: nextStatus === 'Published' ? (e.published_at || new Date().toISOString()) : e.published_at
          };
        }
        return e;
      });
      localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
      if (nextStatus === 'Published') {
        showToast("Examination results have been published successfully. Parents can now view report cards in the mobile application.", "success");
      } else {
        showToast("Exam status updated to Draft.", "success");
      }
      fetchExams(ayId);
    } else {
      try {
        const examPayload = {
          name: exam.name,
          description: exam.description || '',
          status: nextStatus,
          class_id: exam.class_id,
          group_name: exam.group_name || '',
          start_date: exam.start_date,
          end_date: exam.end_date,
          subjects: exam.subjects
        };
        const res = await fetch(`/api/exams/${exam.id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(examPayload)
        });
        if (res.ok) {
          if (nextStatus === 'Published') {
            showToast("Examination results have been published successfully. Parents can now view report cards in the mobile application.", "success");
          } else {
            showToast("Exam status updated to Draft.", "success");
          }
          fetchExams(ayId);
        } else {
          showToast("Error updating exam status.", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Error updating exam status.", "error");
      }
    }
  };

  const deleteScheme = async (schemeName) => {
    const keySuffix = schoolId || 'default';
    const ayId = activeYearId;

    if (token.includes('mock') || !isConnected) {
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      let list = JSON.parse(storedExams);
      list = list.filter(e => e.name !== schemeName);
      localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
      showToast("Scheme deleted (Sandbox)", "success");
      fetchExams(ayId);
    } else {
      try {
        const res = await fetch(`/api/exams?academic_year_id=${ayId}`, { headers: getHeaders() });
        if (res.ok) {
          const list = await res.json();
          const matching = list.filter(e => e.name === schemeName);
          for (const exam of matching) {
            await fetch(`/api/exams/${exam.id}`, { method: 'DELETE', headers: getHeaders() });
          }
          showToast("Scheme deleted successfully.", "success");
          fetchExams(ayId);
        }
      } catch (err) {
        console.error(err);
        showToast("Error deleting scheme.", "error");
      }
    }
  };

  const toggleSchemePublish = async (schemeName, currentStatus) => {
    const keySuffix = schoolId || 'default';
    const ayId = activeYearId;
    const nextStatus = currentStatus === 'Published' ? 'Draft' : 'Published';

    if (token.includes('mock') || !isConnected) {
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      let list = JSON.parse(storedExams);
      list = list.map(e => {
        if (e.name === schemeName) {
          return { ...e, status: nextStatus };
        }
        return e;
      });
      localStorage.setItem(`bn_sandbox_exams_${keySuffix}_${ayId}`, JSON.stringify(list));
      showToast(`Scheme status updated to ${nextStatus}`, "success");
      fetchExams(ayId);
    } else {
      try {
        const res = await fetch(`/api/exams?academic_year_id=${ayId}`, { headers: getHeaders() });
        if (res.ok) {
          const list = await res.json();
          const matching = list.filter(e => e.name === schemeName);
          for (const exam of matching) {
            const updated = {
              name: exam.name,
              description: exam.description || '',
              status: nextStatus,
              class_id: exam.class_id,
              group_name: exam.group_name || '',
              start_date: exam.start_date,
              end_date: exam.end_date,
              subjects: exam.subjects
            };
            await fetch(`/api/exams/${exam.id}`, {
              method: 'PUT',
              headers: getHeaders(),
              body: JSON.stringify(updated)
            });
          }
          showToast(`Scheme status updated to ${nextStatus}.`, "success");
          fetchExams(ayId);
        }
      } catch (err) {
        console.error(err);
        showToast("Error updating scheme status.", "error");
      }
    }
  };

  const fetchExamMarks = async (exam) => {
    if (!exam) return;
    setIsFetchingExamMarks(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}_${activeYearId}`) || '[]';
      const allStuds = JSON.parse(storedStudents);
      const studentsInClass = allStuds.filter(s => 
        parseInt(s.class_id) === parseInt(exam.class_id) && 
        s.status === 'Active' &&
        (!exam.group_name || s.group_name === exam.group_name)
      );
      
      const storedMarks = localStorage.getItem(`bn_sandbox_exam_marks_${keySuffix}_${activeYearId}`) || '[]';
      const marksList = JSON.parse(storedMarks);
      const marksMap = {};
      marksList.forEach(m => {
        if (parseInt(m.exam_id) === parseInt(exam.id)) {
          const sid = parseInt(m.student_id);
          if (!marksMap[sid]) marksMap[sid] = {};
          marksMap[sid][m.subject_name] = parseFloat(m.marks_obtained);
        }
      });
      
      const result = studentsInClass.map(s => ({
        student_id: s.id,
        name: s.name,
        roll_number: s.roll_number,
        group_name: s.group_name,
        marks: marksMap[parseInt(s.id)] ?? {}
      })).sort((a, b) => (parseInt(a.roll_number) || 0) - (parseInt(b.roll_number) || 0) || a.name.localeCompare(b.name));
      
      setExamMarks(result);
      setIsFetchingExamMarks(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/exams/${exam.id}/marks`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setExamMarks(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingExamMarks(false);
    }
  };

  const saveExamMarksBulk = async (examId, marksPayload) => {
    setMarksSaveStatus('saving');
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedMarks = localStorage.getItem(`bn_sandbox_exam_marks_${keySuffix}_${activeYearId}`) || '[]';
      const list = JSON.parse(storedMarks);
      
      marksPayload.forEach(item => {
        const idx = list.findIndex(m => 
          parseInt(m.exam_id) === parseInt(examId) && 
          parseInt(m.student_id) === parseInt(item.student_id) && 
          m.subject_name === item.subject_name
        );
        if (idx !== -1) {
          list[idx].marks_obtained = parseFloat(item.marks_obtained);
        } else {
          list.push({
            id: list.length + 1,
            exam_id: examId,
            student_id: item.student_id,
            subject_name: item.subject_name,
            marks_obtained: parseFloat(item.marks_obtained)
          });
        }
      });
      
      localStorage.setItem(`bn_sandbox_exam_marks_${keySuffix}_${activeYearId}`, JSON.stringify(list));
      setMarksSaveStatus('saved');
      setTimeout(() => setMarksSaveStatus(''), 2000);
      return;
    }
    
    try {
      const res = await fetch(`/api/exams/${examId}/marks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ marks: marksPayload })
      });
      if (res.ok) {
        setMarksSaveStatus('saved');
        setTimeout(() => setMarksSaveStatus(''), 2000);
      } else {
        setMarksSaveStatus('');
        showToast("Failed to auto-save marks.", "error");
      }
    } catch (err) {
      console.error(err);
      setMarksSaveStatus('');
    }
  };

  const fetchSchoolSignatures = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_signatures_${keySuffix}`);
      if (stored) {
        setSchoolSignatures(JSON.parse(stored));
      } else {
        setSchoolSignatures({ teacher_signature: null, class_teacher_signature: null, principal_signature: null });
      }
      return;
    }
    
    try {
      const res = await fetch(`/api/school/signatures`, { headers: getHeaders() });
      if (res.ok) {
        setSchoolSignatures(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveSchoolSignatures = async (sigs) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      localStorage.setItem(`bn_sandbox_signatures_${keySuffix}`, JSON.stringify(sigs));
      setSchoolSignatures(sigs);
      showToast("Signatures saved successfully (Sandbox)", "success");
      return;
    }
    
    try {
      const res = await fetch(`/api/school/signatures`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(sigs)
      });
      if (res.ok) {
        showToast("Signatures saved successfully.", "success");
        setSchoolSignatures(sigs);
      } else {
        showToast("Failed to save signatures.", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGradingScales = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_grading_scales_${keySuffix}`);
      if (stored) {
        setGradingScales(JSON.parse(stored));
      }
      return;
    }
    
    try {
      const res = await fetch(`/api/school/grading-scales`, { headers: getHeaders() });
      if (res.ok) {
        setGradingScales(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveGradingScales = async (scales) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      localStorage.setItem(`bn_sandbox_grading_scales_${keySuffix}`, JSON.stringify(scales));
      setGradingScales(scales);
      showToast("Grading scales updated (Sandbox)", "success");
      return;
    }
    
    try {
      const res = await fetch(`/api/school/grading-scales`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ scales })
      });
      if (res.ok) {
        showToast("Grading scales updated successfully.", "success");
        setGradingScales(scales);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReportCardRemarks = async (examId) => {
    if (!examId) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`) || '[]';
      const list = JSON.parse(stored);
      const remarksMap = {};
      list.forEach(r => {
        if (parseInt(r.exam_id) === parseInt(examId)) {
          remarksMap[parseInt(r.student_id)] = r.remarks;
        }
      });
      setReportCardRemarks(remarksMap);
      return;
    }
    
    try {
      const res = await fetch(`/api/exams/${examId}/remarks`, { headers: getHeaders() });
      if (res.ok) {
        const rows = await res.json();
        const remarksMap = {};
        rows.forEach(r => {
          remarksMap[parseInt(r.student_id)] = r.remarks;
        });
        setReportCardRemarks(remarksMap);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveStudentRemarks = async (examId, remarksPayload) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const stored = localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`) || '[]';
      const list = JSON.parse(stored);
      
      remarksPayload.forEach(item => {
        const idx = list.findIndex(r => parseInt(r.exam_id) === parseInt(examId) && parseInt(r.student_id) === parseInt(item.student_id));
        if (idx !== -1) {
          list[idx].remarks = item.remarks;
        } else {
          list.push({
            id: list.length + 1,
            school_id: schoolId || 1,
            academic_year_id: activeYearId,
            exam_id: examId,
            student_id: item.student_id,
            remarks: item.remarks
          });
        }
      });
      
      localStorage.setItem(`bn_sandbox_remarks_${keySuffix}_${activeYearId}`, JSON.stringify(list));
      showToast("Remarks saved (Sandbox)", "success");
      fetchReportCardRemarks(examId);
      return;
    }
    
    try {
      const res = await fetch(`/api/exams/${examId}/remarks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ remarks: remarksPayload })
      });
      if (res.ok) {
        showToast("Remarks saved successfully.", "success");
        fetchReportCardRemarks(examId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const roundDecimal = (num, decimals) => {
    const t = Math.pow(10, decimals);
    return Math.round((num + Number.EPSILON) * t) / t;
  };

  const fetchStudentPerformanceSummary = async (studentId, ayId) => {
    if (!studentId || !ayId) return;
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedStudents = localStorage.getItem(`bn_sandbox_students_${keySuffix}_${ayId}`) || '[]';
      const allStuds = JSON.parse(storedStudents);
      const stud = allStuds.find(s => parseInt(s.id) === parseInt(studentId));
      if (!stud) return;
      
      const storedAtt = localStorage.getItem(`bn_sandbox_attendance_${keySuffix}_${ayId}`) || '[]';
      const attList = JSON.parse(storedAtt);
      const studentAtt = attList.filter(a => parseInt(a.student_id) === parseInt(studentId));
      const present = studentAtt.filter(a => a.status === 'Present').length;
      const absent = studentAtt.filter(a => a.status === 'Absent').length;
      const leave = studentAtt.filter(a => a.status === 'Leave').length;
      const total = present + absent + leave;
      const percentage = total > 0 ? roundDecimal((present / total) * 100, 1) : 0;
      
      const storedExams = localStorage.getItem(`bn_sandbox_exams_${keySuffix}_${ayId}`) || '[]';
      const examsListLocal = JSON.parse(storedExams);
      const studentExams = examsListLocal.filter(e => parseInt(e.class_id) === parseInt(stud.class_id));
      
      const storedMarks = localStorage.getItem(`bn_sandbox_exam_marks_${keySuffix}_${ayId}`) || '[]';
      const marksList = JSON.parse(storedMarks);
      
      const examsData = studentExams.map(exam => {
        const marksMap = {};
        marksList.forEach(m => {
          if (parseInt(m.exam_id) === parseInt(exam.id) && parseInt(m.student_id) === parseInt(studentId)) {
            marksMap[m.subject_name] = parseFloat(m.marks_obtained);
          }
        });
        
        const storedRemarks = localStorage.getItem(`bn_sandbox_remarks_${keySuffix}_${ayId}`) || '[]';
        const remarksList = JSON.parse(storedRemarks);
        const remRecord = remarksList.find(r => parseInt(r.exam_id) === parseInt(exam.id) && parseInt(r.student_id) === parseInt(studentId));
        
        const examMarksForClass = allStuds.filter(s => parseInt(s.class_id) === parseInt(exam.class_id)).map(s => {
          const sMarks = marksList.filter(m => parseInt(m.exam_id) === parseInt(exam.id) && parseInt(m.student_id) === parseInt(s.id));
          const tot = sMarks.reduce((sum, m) => sum + parseFloat(m.marks_obtained), 0);
          return { student_id: s.id, tot };
        }).sort((a, b) => b.tot - a.tot);
        const rankIdx = examMarksForClass.findIndex(x => parseInt(x.student_id) === parseInt(studentId));
        const rank = rankIdx !== -1 ? rankIdx + 1 : '-';
        
        return {
          id: exam.id,
          name: exam.name,
          start_date: exam.start_date,
          end_date: exam.end_date,
          subjects: exam.subjects,
          marks: marksMap,
          rank,
          remarks: remRecord ? remRecord.remarks : ''
        };
      });
      
      const storedSigs = localStorage.getItem(`bn_sandbox_signatures_${keySuffix}`);
      const signatures = storedSigs ? JSON.parse(storedSigs) : { teacher_signature: null, class_teacher_signature: null, principal_signature: null };
      
      const storedScales = localStorage.getItem(`bn_sandbox_grading_scales_${keySuffix}`);
      const scales = storedScales ? JSON.parse(storedScales) : gradingScales;
      
      setStudentPerformanceSummary({
        student_id: studentId,
        name: stud.name,
        roll_number: stud.roll_number,
        class_id: stud.class_id,
        group_name: stud.group_name,
        attendance: { present, absent, leave, total, percentage },
        exams: examsData,
        signatures,
        grading_scales: scales
      });
      return;
    }
    
    try {
      const res = await fetch(`/api/students/${studentId}/performance-summary?academic_year_id=${ayId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setStudentPerformanceSummary(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPreviousDues = async () => {
    setIsFetchingPreviousDues(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedCFDues = localStorage.getItem(`bn_sandbox_carry_forward_dues_${keySuffix}`) || '[]';
      const allDues = JSON.parse(storedCFDues);
      const filtered = allDues.filter(d => parseInt(d.original_academic_year_id) < parseInt(activeYearId));
      const mapped = filtered.map(d => {
        const stud = students.find(s => parseInt(s.id) === parseInt(d.student_id));
        const activeYear = years.find(y => y.id === d.original_academic_year_id);
        
        let origClassId = stud ? stud.class_id : null;
        if (stud && parseInt(stud.academic_year_id) !== parseInt(d.original_academic_year_id)) {
          const origStud = students.find(s => 
            s.name === stud.name && 
            s.roll_number === stud.roll_number && 
            parseInt(s.academic_year_id) === parseInt(d.original_academic_year_id)
          );
          if (origStud) {
            origClassId = origStud.class_id;
          }
        }
        
        return {
          ...d,
          student_name: stud ? stud.name : 'Unknown Student',
          class_name: origClassId ? getClassName(origClassId) : 'Unknown Class',
          original_academic_year: activeYear ? activeYear.year_range : '2025-2026'
        };
      });
      setPreviousDues(mapped);
      setIsFetchingPreviousDues(false);
      return;
    }
    try {
      const res = await fetch(`/api/finance/previous-dues?academic_year_id=${activeYearId}`, { headers: getHeaders() });
      if (res.ok) {
        setPreviousDues(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingPreviousDues(false);
    }
  };

  const handlePayCarryForwardDue = async (studentId, dueId, amount, date) => {
    setIsRecordingRecovery(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      try {
        const storedDuesKey = `bn_sandbox_carry_forward_dues_${keySuffix}`;
        const allDues = JSON.parse(localStorage.getItem(storedDuesKey) || '[]');
        const dueIndex = allDues.findIndex(d => parseInt(d.id) === parseInt(dueId));
        if (dueIndex === -1) {
          showToast("Due record not found.", "error");
          return;
        }
        const due = allDues[dueIndex];
        const pending = parseFloat(due.amount) - parseFloat(due.paid_amount);
        if (amount > pending + 0.01) {
          showToast("Payment amount exceeds outstanding due.", "error");
          return;
        }

        const newPaidAmount = parseFloat(due.paid_amount) + amount;
        allDues[dueIndex] = {
          ...due,
          paid_amount: newPaidAmount,
          status: newPaidAmount >= parseFloat(due.amount) ? 'Paid' : 'Pending'
        };
        localStorage.setItem(storedDuesKey, JSON.stringify(allDues));

        const storedRecsKey = `bn_sandbox_previous_year_recoveries_${keySuffix}`;
        const allRecs = JSON.parse(localStorage.getItem(storedRecsKey) || '[]');
        const newRec = {
          id: allRecs.length + 1,
          school_id: schoolId || 1,
          student_id: studentId,
          academic_year_id: activeYearId,
          carry_forward_due_id: dueId,
          amount_recovered: amount,
          recovery_date: date,
          paid_at: new Date().toISOString(),
          collected_by: username || 'admin@sandbox.edu',
          student_name: due.student_name || 'Ahmed',
          class_name: due.class_name || 'Class 6',
          original_academic_year: years.find(y => y.id === due.original_academic_year_id)?.year_range || '2025-2026',
          is_locked: false
        };
        allRecs.unshift(newRec);
        localStorage.setItem(storedRecsKey, JSON.stringify(allRecs));

        await fetchCarryForwardDues(studentId);
        await fetchPreviousYearRecoveries();
        await fetchPreviousDues();
        await fetchSPData();
        showToast("Past year due payment recorded (Sandbox Mode)", "success");
        setShowPayRecoveryModal(false);
      } catch (err) {
        console.error(err);
      } finally {
        setIsRecordingRecovery(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}/carry-forward-dues/${dueId}/pay`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount, date })
      });
      if (res.ok) {
        await fetchCarryForwardDues(studentId);
        await fetchPreviousYearRecoveries();
        await fetchPreviousDues();
        await fetchSPData();
        showToast("Past year due payment recorded successfully.", "success");
        setShowPayRecoveryModal(false);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to record payment.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error recording payment.", "error");
    } finally {
      setIsRecordingRecovery(false);
    }
  };

  const handleRevertRecovery = async (studentId, recoveryId) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storedRecsKey = `bn_sandbox_previous_year_recoveries_${keySuffix}`;
      const allRecs = JSON.parse(localStorage.getItem(storedRecsKey) || '[]');
      const recIndex = allRecs.findIndex(r => parseInt(r.id) === parseInt(recoveryId));
      if (recIndex === -1) {
        showToast("Recovery record not found.", "error");
        return;
      }
      const rec = allRecs[recIndex];
      if (isSandboxTransactionLocked(rec.paid_at)) {
        showToast("This recovery is part of a finalized Financial Report and cannot be reverted.", "error");
        return;
      }

      const storedDuesKey = `bn_sandbox_carry_forward_dues_${keySuffix}`;
      const allDues = JSON.parse(localStorage.getItem(storedDuesKey) || '[]');
      const dueIndex = allDues.findIndex(d => parseInt(d.id) === parseInt(rec.carry_forward_due_id));
      if (dueIndex !== -1) {
        const due = allDues[dueIndex];
        const newPaidAmount = Math.max(0, parseFloat(due.paid_amount) - parseFloat(rec.amount_recovered));
        allDues[dueIndex] = {
          ...due,
          paid_amount: newPaidAmount,
          status: newPaidAmount >= parseFloat(due.amount) ? 'Paid' : 'Pending'
        };
        localStorage.setItem(storedDuesKey, JSON.stringify(allDues));
      }

      allRecs.splice(recIndex, 1);
      localStorage.setItem(storedRecsKey, JSON.stringify(allRecs));

      if (studentId) {
        await fetchCarryForwardDues(studentId);
      }
      await fetchPreviousYearRecoveries();
      await fetchPreviousDues();
      await fetchSPData();
      showToast("Recovery reverted successfully (Sandbox Mode)", "success");
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId || 0}/carry-forward-dues/recoveries/${recoveryId}/unpay`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        if (studentId) {
          await fetchCarryForwardDues(studentId);
        }
        await fetchPreviousYearRecoveries();
        await fetchPreviousDues();
        await fetchSPData();
        showToast("Recovery reverted successfully.", "success");
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to revert recovery.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error reverting recovery.", "error");
    }
  };

  const processSalary = async (teacherId, month) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_salaries_${keySuffix}_${teacherId}_${activeYearId}`;
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const existing = current.find(s => s.month === month);
      if (existing && existing.status === 'Paid' && isSandboxTransactionLocked(existing.paid_at)) {
        showToast("This salary payment is part of a finalized Financial Report and cannot be modified.", "error");
        return;
      }
      const updated = current.map(s => s.month === month ? { ...s, status: "Paid", payment_date: new Date().toISOString().split('T')[0], paid_at: new Date().toISOString() } : s);
      setTeacherSalaries(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      await fetchSPData();
      showToast('Salary disbursed (Sandbox Mode)', 'success');
      return;
    }

    try {
      const res = await fetch(`/api/teachers/${teacherId}/salary/${month}/pay?academic_year_id=${activeYearId}`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchTeacherSalaryRecords(teacherId);
        await fetchSPData();
        showToast('Salary disbursed successfully', 'success');
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to disburse salary", "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Network error disbursing salary.', 'error');
    }
  };

  const handleMonthCheckboxChange = (month, checked) => {
    const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const unpaidMonths = studentFees
      .filter(f => f.status !== 'Paid')
      .map(f => f.month)
      .sort((a, b) => monthsOrder.indexOf(a) - monthsOrder.indexOf(b));

    const targetIndex = unpaidMonths.indexOf(month);
    if (targetIndex === -1) return;

    if (checked) {
      const newSelection = unpaidMonths.slice(0, targetIndex + 1);
      setSelectedMonthsForPayment(newSelection);
    } else {
      const newSelection = unpaidMonths.slice(0, targetIndex);
      setSelectedMonthsForPayment(newSelection);
    }
  };

  const processMultiMonthFeePayment = async (studentId, months) => {
    if (!months || months.length === 0) return;
    if (!isFeeStructureConfigured) {
      setShowFeeConfigRequiredModal(true);
      return;
    }
    
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${studentId}_${activeYearId}`;
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      for (const month of months) {
        const existing = current.find(f => f.month === month);
        if (existing && existing.status === 'Paid' && isSandboxTransactionLocked(existing.paid_at)) {
          showToast(`Fee payment for ${month} is part of a finalized Financial Report and cannot be modified.`, "error");
          return;
        }
      }
      
      const paymentDate = new Date().toISOString().split('T')[0];
      const paidAt = new Date().toISOString();
      const updated = current.map(f => {
        if (months.includes(f.month)) {
          return {
            ...f,
            status: "Paid",
            payment_date: paymentDate,
            paid_at: paidAt
          };
        }
        return f;
      });
      setStudentFees(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      await fetchSPData();
      showToast('Tuition fee payments recorded (Sandbox Mode)', 'success');
      
      const paidRecords = updated.filter(f => months.includes(f.month));
      const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
      paidRecords.sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));

      const multiMonthRecord = {
        isMultiMonth: true,
        months: months,
        amount: paidRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
        payment_date: paymentDate,
        paid_at: paidAt,
        records: paidRecords,
        id: paidRecords[paidRecords.length - 1]?.id || 999
      };
      
      setSelectedMonthsForPayment([]);
      handlePrintReceipt(activeStudent, multiMonthRecord);
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}/fees/pay-multiple`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          months: months,
          academic_year_id: activeYearId
        })
      });
      if (res.ok) {
        const resData = await res.json();
        
        await fetchStudentFeesRecords(studentId, selectedStudent?.class_id);
        await fetchSPData();
        showToast('Tuition fee payments recorded', 'success');

        const paidRecords = resData.records || [];
        const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        paidRecords.sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));

        const multiMonthRecord = {
          isMultiMonth: true,
          months: months,
          amount: paidRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
          payment_date: paidRecords[0]?.payment_date || new Date().toISOString().split('T')[0],
          paid_at: paidRecords[0]?.paid_at || new Date().toISOString(),
          records: paidRecords,
          id: paidRecords[paidRecords.length - 1]?.id || 999
        };
        setSelectedMonthsForPayment([]);
        handlePrintReceipt(activeStudent, multiMonthRecord);
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to record fee payments", "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Network error recording fee payments.', 'error');
    }
  };

  const processFeePayment = async (studentId, month) => {
    if (!isFeeStructureConfigured) {
      setShowFeeConfigRequiredModal(true);
      return;
    }
    
    // Validate chronological sequence of payments (April to March)
    const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const targetIdx = monthsOrder.indexOf(month);
    if (targetIdx > 0) {
      const priorPending = monthsOrder.slice(0, targetIdx).some(prevMonth => {
        const prevFee = studentFees.find(f => f.month === prevMonth);
        return !prevFee || prevFee.status !== 'Paid';
      });
      if (priorPending) {
        showToast("Please clear previous pending dues first.", "error");
        return;
      }
    }

    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${studentId}_${activeYearId}`;
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const existing = current.find(f => f.month === month);
      if (existing && existing.status === 'Paid' && isSandboxTransactionLocked(existing.paid_at)) {
        showToast("This fee payment is part of a finalized Financial Report and cannot be modified.", "error");
        return;
      }
      const updated = current.map(f => f.month === month ? { ...f, status: "Paid", payment_date: new Date().toISOString().split('T')[0], paid_at: new Date().toISOString() } : f);
      setStudentFees(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      await fetchSPData();
      showToast('Tuition fee payment recorded (Sandbox Mode)', 'success');
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}/fees/${month}/pay?academic_year_id=${activeYearId}`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchStudentFeesRecords(studentId, selectedStudent?.class_id);
        await fetchSPData();
        showToast('Tuition fee payment recorded', 'success');
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to record fee payment", "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Network error recording fee payment.', 'error');
    }
  };

  const handleRevertFeePayment = (studentId, month) => {
    setUnpayConfirm({ studentId, month });
  };

  const executeRevertFeePayment = async (studentId, month) => {
    const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const targetIdx = monthsOrder.indexOf(month);
    const keySuffix = schoolId || 'default';

    let feesToCheck = studentFees || [];
    if (feesToCheck.length === 0) {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${studentId}_${activeYearId}`;
      feesToCheck = JSON.parse(localStorage.getItem(storageKey) || '[]');
    }

    const hasSubsequentPaid = feesToCheck.some(f => {
      const idx = monthsOrder.indexOf(f.month);
      return idx !== -1 && idx > targetIdx && f.status === 'Paid';
    });

    if (hasSubsequentPaid) {
      showToast("Cannot mark this month as unpaid because subsequent months have already been paid.", "error");
      return;
    }

    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${studentId}_${activeYearId}`;
      const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const fee = current.find(f => f.month === month);
      if (fee && fee.status === 'Paid' && isSandboxTransactionLocked(fee.paid_at)) {
        showToast("This fee payment is part of a finalized Financial Report and cannot be reverted.", "error");
        return;
      }
      const updated = current.map(f => f.month === month ? { ...f, status: "Pending", payment_date: null, paid_at: null } : f);
      setStudentFees(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      await fetchSPData();
      showToast('Fee status reverted to Unpaid (Sandbox Mode)', 'success');
      return;
    }

    try {
      const res = await fetch(`/api/students/${studentId}/fees/${month}/unpay?academic_year_id=${activeYearId}`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        await fetchStudentFeesRecords(studentId, selectedStudent?.class_id);
        await fetchSPData();
        showToast('Fee status reverted to Unpaid', 'success');
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to revert payment", "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Network error reverting payment.', 'error');
    }
  };

  // --- FINANCIAL REPORTS HANDLERS ---
  const suggestDates = (reportsList) => {
    let suggestedStart = '';
    
    if (reportsList && reportsList.length > 0) {
      const sorted = [...reportsList].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestReport = sorted[0];
      if (latestReport && latestReport.created_at) {
        suggestedStart = latestReport.created_at.split('T')[0].split(' ')[0];
      } else {
        suggestedStart = latestReport.to_date;
      }
    } else {
      const activeYear = years.find(y => y.id === activeYearId);
      if (activeYear && activeYear.created_at) {
        suggestedStart = activeYear.created_at.split('T')[0].split(' ')[0];
      } else if (activeYear && activeYear.start_date) {
        suggestedStart = activeYear.start_date;
      } else {
        suggestedStart = `${new Date().getFullYear()}-04-01`;
      }
    }
    
    setReportFromDate(suggestedStart);
    setReportToDate(new Date().toISOString().split('T')[0]);
  };

  const fetchFinancialReports = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_financial_reports_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      const list = stored ? JSON.parse(stored) : [];
      setFinancialReports(list);
      suggestDates(list);
      return;
    }

    try {
      const res = await fetch(`/api/financial-reports?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setFinancialReports(data);
        suggestDates(data);
      }
    } catch (err) {
      console.error("Failed to fetch financial reports", err);
    }
  };

  const handlePreviewReport = async () => {
    if (!reportFromDate || !reportToDate) {
      showToast("Please select both From and To dates.", "error");
      return;
    }
    if (new Date(reportFromDate) > new Date(reportToDate)) {
      showToast("From Date cannot be after To Date.", "error");
      return;
    }

    setIsReportPreviewing(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_financial_reports_${keySuffix}_${activeYearId}`;
      const storedReports = localStorage.getItem(storageKey);
      const reportsList = storedReports ? JSON.parse(storedReports) : [];
      let last_report_end = null;
      if (reportsList && reportsList.length > 0) {
        const sorted = [...reportsList].sort((a, b) => new Date(b.to_timestamp || b.created_at) - new Date(a.to_timestamp || a.created_at));
        last_report_end = sorted[0].to_timestamp || sorted[0].created_at;
      }
      
      const selected_from_timestamp = new Date(reportFromDate + 'T00:00:00');
      const selected_to_timestamp = new Date(reportToDate + 'T23:59:59');
      const now = new Date();
      const end_timestamp = selected_to_timestamp < now ? selected_to_timestamp : now;
      
      let start_timestamp = selected_from_timestamp;
      let use_strict_greater = false;
      if (last_report_end) {
        const lastEnd = new Date(last_report_end);
        if (lastEnd > selected_from_timestamp) {
          start_timestamp = lastEnd;
          use_strict_greater = true;
        }
      }

      const isTxInWindow = (txDate, txPaidAt) => {
        if (txPaidAt) {
          const t = new Date(txPaidAt);
          if (use_strict_greater) {
            return t > start_timestamp && t <= end_timestamp;
          } else {
            return t >= start_timestamp && t <= end_timestamp;
          }
        }
        const t = new Date(txDate + 'T12:00:00');
        if (use_strict_greater) {
          return t > start_timestamp && t <= end_timestamp;
        } else {
          return t >= start_timestamp && t <= end_timestamp;
        }
      };

      let totalFees = 0;
      let totalExtraFees = 0;
      let totalSalaries = 0;
      let totalExpenses = 0;

      students.forEach(st => {
        const studentFeesKey = `bn_sandbox_fees_${keySuffix}_${st.id}_${activeYearId}`;
        const storedFees = localStorage.getItem(studentFeesKey);
        if (storedFees) {
          const feesList = JSON.parse(storedFees);
          feesList.forEach(fee => {
            if (fee.status === 'Paid' && fee.payment_date) {
              if (isTxInWindow(fee.payment_date, fee.paid_at)) {
                totalFees += parseFloat(fee.amount) || 0;
              }
            }
          });
        }
      });

      const extraFeesKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
      const storedExtraFees = localStorage.getItem(extraFeesKey);
      if (storedExtraFees) {
        const extraList = JSON.parse(storedExtraFees);
        const extraTypesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
        const storedTypes = localStorage.getItem(extraTypesKey);
        const typesList = storedTypes ? JSON.parse(storedTypes) : [];
        
        extraList.forEach(sef => {
          if (sef.status === 'Paid' && sef.payment_date) {
            if (isTxInWindow(sef.payment_date, sef.paid_at)) {
              const type = typesList.find(t => t.id === sef.extra_fee_type_id);
              if (type) {
                totalExtraFees += parseFloat(type.amount) || 0;
              }
            }
          }
        });
      }

      teachers.forEach(t => {
        const salariesKey = `bn_sandbox_salaries_${keySuffix}_${t.id}_${activeYearId}`;
        const storedSalaries = localStorage.getItem(salariesKey);
        if (storedSalaries) {
          const salariesList = JSON.parse(storedSalaries);
          salariesList.forEach(sal => {
            if (sal.status === 'Paid' && sal.payment_date) {
              if (isTxInWindow(sal.payment_date, sal.paid_at)) {
                totalSalaries += parseFloat(sal.amount) || 0;
              }
            }
          });
        }
      });

      const expensesKey = `bn_sandbox_expenses_${keySuffix}_${activeYearId}`;
      const storedExpenses = localStorage.getItem(expensesKey);
      if (storedExpenses) {
        const expensesList = JSON.parse(storedExpenses);
        expensesList.forEach(exp => {
          if (exp.expense_date) {
            const txDate = exp.expense_date;
            const txTime = exp.expense_time || '12:00:00';
            const txTimestamp = new Date(txDate + 'T' + txTime);
            let inWin = false;
            if (use_strict_greater) {
              inWin = txTimestamp > start_timestamp && txTimestamp <= end_timestamp;
            } else {
              inWin = txTimestamp >= start_timestamp && txTimestamp <= end_timestamp;
            }
            if (inWin) {
              totalExpenses += parseFloat(exp.amount) || 0;
            }
          }
        });
      }

      let totalRecoveries = 0;
      const storedRecoveries = localStorage.getItem(`bn_sandbox_previous_year_recoveries_${keySuffix}`) || '[]';
      const recoveriesList = JSON.parse(storedRecoveries);
      recoveriesList.forEach(rec => {
        if (rec.recovery_date) {
          if (isTxInWindow(rec.recovery_date, rec.paid_at)) {
            totalRecoveries += parseFloat(rec.amount_recovered) || 0;
          }
        }
      });

      setReportPreview({
        fees_collected: totalFees,
        previous_year_recoveries: totalRecoveries,
        extra_fees_collected: totalExtraFees,
        total_income: totalFees + totalRecoveries + totalExtraFees,
        salaries_paid: totalSalaries,
        school_expenses: totalExpenses,
        total_expenses: totalSalaries + totalExpenses,
        net_profit: (totalFees + totalRecoveries + totalExtraFees) - (totalSalaries + totalExpenses),
        from_timestamp: start_timestamp.toISOString(),
        to_timestamp: end_timestamp.toISOString()
      });
      setIsReportPreviewing(false);
      showToast("Preview loaded (Sandbox Mode)", "success");
      return;
    }

    try {
      const res = await fetch(`/api/financial-reports/preview?from_date=${reportFromDate}&to_date=${reportToDate}&academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setReportPreview(data);
        showToast("Preview loaded", "success");
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to load preview", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to load preview", "error");
    } finally {
      setIsReportPreviewing(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportFromDate || !reportToDate) {
      showToast("Please select both From and To dates.", "error");
      return;
    }
    if (!reportPreview) {
      showToast("Please preview the report first.", "error");
      return;
    }

    setIsGeneratingReport(true);
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_financial_reports_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      const list = stored ? JSON.parse(stored) : [];

      const nextId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
      const formattedReportId = `REP-${String(nextId).padStart(3, '0')}`;

      const newReport = {
        id: nextId,
        report_id: formattedReportId,
        school_id: keySuffix,
        academic_year_id: activeYearId,
        from_date: reportFromDate,
        to_date: reportToDate,
        from_timestamp: reportPreview.from_timestamp,
        to_timestamp: reportPreview.to_timestamp,
        fees_collected: reportPreview.fees_collected,
        previous_year_recoveries: reportPreview.previous_year_recoveries || 0,
        extra_fees_collected: reportPreview.extra_fees_collected,
        total_income: reportPreview.total_income,
        salaries_paid: reportPreview.salaries_paid,
        school_expenses: reportPreview.school_expenses,
        total_expenses: reportPreview.total_expenses,
        net_profit: reportPreview.net_profit,
        settlement_status: 'Pending',
        created_at: new Date().toISOString()
      };

      const updated = [newReport, ...list];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setFinancialReports(updated);
      setReportPreview(null);
      suggestDates(updated);
      setIsGeneratingReport(false);
      showToast("Report generated (Sandbox Mode)", "success");
      return;
    }

    try {
      const res = await fetch(`/api/financial-reports`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          from_date: reportFromDate,
          to_date: reportToDate,
          academic_year_id: activeYearId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setFinancialReports(prev => [data, ...prev]);
        setReportPreview(null);
        suggestDates([data, ...financialReports]);
        if (data.email_sent === false) {
          showToast("Report generated successfully, but email delivery failed.", "warning");
        } else {
          showToast("Report generated successfully", "success");
        }
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to generate report", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to generate report", "error");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleToggleSettlement = async (reportId) => {
    const keySuffix = schoolId || 'default';
    setSettlingReportId(reportId);
    try {
      if (token.includes('mock') || !isConnected) {
        // Simulate minor lag for visual confirmation of the loader in Sandbox
        await new Promise(resolve => setTimeout(resolve, 800));
        const storageKey = `bn_sandbox_financial_reports_${keySuffix}_${activeYearId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const list = JSON.parse(stored);
          let targetStatus = '';
          const updated = list.map(r => {
            if (r.id === reportId) {
              const nextStatus = r.settlement_status === 'Settled' ? 'Pending' : 'Settled';
              targetStatus = nextStatus;
              return { ...r, settlement_status: nextStatus };
            }
            return r;
          });
          localStorage.setItem(storageKey, JSON.stringify(updated));
          setFinancialReports(updated);
          if (targetStatus === 'Settled') {
            showToast("Financial statement settled successfully", "success");
          } else {
            showToast("Settlement status updated (Sandbox Mode)", "success");
          }
        }
        return;
      }

      const res = await fetch(`/api/financial-reports/${reportId}/settle`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setFinancialReports(prev => prev.map(r => r.id === reportId ? { ...r, settlement_status: data.settlement_status } : r));
        if (data.settlement_status === 'Settled') {
          showToast("Financial statement settled successfully", "success");
        } else {
          showToast("Settlement status updated", "success");
        }
      } else {
        showToast("Failed to update settlement status", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update settlement status", "error");
    } finally {
      setSettlingReportId(null);
    }
  };

  const handleExportReport = async (report) => {
    const reportId = report.id;
    const fileName = `Financial_Report_${report.report_id || 'REP-' + String(reportId).padStart(3, '0')}.xlsx`;
    
    setExportingReportId(reportId);

    if (token.includes('mock') || !isConnected) {
      try {
        // Simulate network delay for the download spinner
        await new Promise(resolve => setTimeout(resolve, 1500));

        const dummyContent = "Sandbox Mode Mock Excel File Content";
        const blob = new Blob([dummyContent], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast("Report downloaded successfully.", "success");
      } catch (err) {
        console.error(err);
        showToast("Failed to download report. Please try again.", "error");
      } finally {
        setExportingReportId(null);
      }
      return;
    }
    
    try {
      const res = await fetch(`/api/financial-reports/${reportId}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast("Report downloaded successfully.", "success");
      } else {
        showToast("Failed to download report. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to download report. Please try again.", "error");
    } finally {
      setExportingReportId(null);
    }
  };

  const fetchExpenses = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_expenses_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      setExpenses(stored ? JSON.parse(stored) : []);
      return;
    }
    try {
      const res = await fetch(`/api/school-expenses?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setExpenses(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch expenses", err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) {
      showToast("Please fill in both Description and Amount.", "error");
      return;
    }
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_expenses_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      const list = stored ? JSON.parse(stored) : [];
      
      const nextId = list.length > 0 ? Math.max(...list.map(ex => ex.id)) + 1 : 1;
      const now = new Date();
      const newExp = {
        id: nextId,
        school_id: keySuffix,
        academic_year_id: activeYearId,
        description: expenseDesc.trim(),
        amount: parseFloat(expenseAmount),
        expense_date: now.toISOString().split('T')[0],
        expense_time: now.toTimeString().split(' ')[0],
        created_by: username || 'admin@sandbox.edu'
      };
      
      const updated = [newExp, ...list];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setExpenses(updated);
      setExpenseDesc('');
      setExpenseAmount('');
      showToast("Expense added (Sandbox Mode)", "success");
      return;
    }
    try {
      const res = await fetch('/api/school-expenses', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          description: expenseDesc.trim(),
          amount: parseFloat(expenseAmount),
          academic_year_id: activeYearId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(prev => [data, ...prev]);
        setExpenseDesc('');
        setExpenseAmount('');
        showToast("Expense added successfully", "success");
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to add expense", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to add expense", "error");
    }
  };

  const fetchExtraFeeTypes = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      setExtraFeeTypes(stored ? JSON.parse(stored) : []);
      return;
    }
    try {
      const res = await fetch(`/api/extra-fee-types?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setExtraFeeTypes(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch extra fee types", err);
    }
  };

  const handleAddExtraFeeType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim() || !newTypeAmount) {
      showToast("Please fill in both Fee Name and Amount.", "error");
      return;
    }
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const typesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
      const storedTypes = localStorage.getItem(typesKey);
      const typesList = storedTypes ? JSON.parse(storedTypes) : [];
      
      const nextId = typesList.length > 0 ? Math.max(...typesList.map(t => t.id)) + 1 : 1;
      const newType = {
        id: nextId,
        school_id: keySuffix,
        academic_year_id: activeYearId,
        name: newTypeName.trim(),
        amount: parseFloat(newTypeAmount)
      };
      
      const updatedTypes = [newType, ...typesList];
      localStorage.setItem(typesKey, JSON.stringify(updatedTypes));
      setExtraFeeTypes(updatedTypes);
      
      // Automatically assign to all active sandbox students
      const studentsKey = `bn_sandbox_students_${keySuffix}`;
      const storedStudents = localStorage.getItem(studentsKey);
      const studentList = storedStudents ? JSON.parse(storedStudents) : [];
      
      const ledgerKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
      const storedLedger = localStorage.getItem(ledgerKey);
      const ledgerList = storedLedger ? JSON.parse(storedLedger) : [];
      
      let lastLedgerId = ledgerList.length > 0 ? Math.max(...ledgerList.map(l => l.id)) : 0;
      
      const newLedgerEntries = [];
      studentList.forEach(st => {
        if (st.status === 'Active') {
          lastLedgerId++;
          newLedgerEntries.push({
            id: lastLedgerId,
            school_id: keySuffix,
            academic_year_id: activeYearId,
            student_id: st.id,
            extra_fee_type_id: nextId,
            status: 'Pending',
            payment_date: null,
            collected_by: null
          });
        }
      });
      
      const updatedLedger = [...newLedgerEntries, ...ledgerList];
      localStorage.setItem(ledgerKey, JSON.stringify(updatedLedger));
      
      setNewTypeName('');
      setNewTypeAmount('');
      showToast("Additional fee type added and assigned (Sandbox)", "success");
      fetchStudentExtraFees();
      return;
    }
    try {
      const res = await fetch('/api/extra-fee-types', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: newTypeName.trim(),
          amount: parseFloat(newTypeAmount),
          academic_year_id: activeYearId
        })
      });
      if (res.ok) {
        setNewTypeName('');
        setNewTypeAmount('');
        showToast("Additional fee type added and assigned", "success");
        fetchExtraFeeTypes();
        fetchStudentExtraFees();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to add additional fee type", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to add additional fee type", "error");
    }
  };

  const handleUpdateExtraFeeType = async (e) => {
    e.preventDefault();
    if (!editingExtraFeeType) return;
    if (!editExtraFeeTypeName.trim() || !editExtraFeeTypeAmount) {
      showToast("Please fill in both Fee Name and Amount.", "error");
      return;
    }
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      if (isSandboxExtraFeeTypeLocked(editingExtraFeeType.id)) {
        showToast("This fee type is used in a finalized Financial Report and cannot be modified.", "error");
        return;
      }
      const typesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
      const storedTypes = localStorage.getItem(typesKey);
      if (storedTypes) {
        const list = JSON.parse(storedTypes);
        const updated = list.map(t => {
          if (t.id === editingExtraFeeType.id) {
            return {
              ...t,
              name: editExtraFeeTypeName.trim(),
              amount: parseFloat(editExtraFeeTypeAmount)
            };
          }
          return t;
        });
        localStorage.setItem(typesKey, JSON.stringify(updated));
        setExtraFeeTypes(updated);
        showToast("Additional fee type updated (Sandbox Mode)", "success");
        setEditingExtraFeeType(null);
        fetchStudentExtraFees();
      }
      return;
    }
    try {
      const res = await fetch(`/api/extra-fee-types/${editingExtraFeeType.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editExtraFeeTypeName.trim(),
          amount: parseFloat(editExtraFeeTypeAmount)
        })
      });
      if (res.ok) {
        showToast("Additional fee type updated successfully", "success");
        setEditingExtraFeeType(null);
        fetchExtraFeeTypes();
        fetchStudentExtraFees();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to update additional fee type", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update additional fee type", "error");
    }
  };

  const fetchStudentExtraFees = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const ledgerKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
      const storedLedger = localStorage.getItem(ledgerKey);
      const ledgerList = storedLedger ? JSON.parse(storedLedger) : [];
      
      const studentsKey = `bn_sandbox_students_${keySuffix}`;
      const storedStudents = localStorage.getItem(studentsKey);
      const studentList = storedStudents ? JSON.parse(storedStudents) : [];
      
      const typesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
      const storedTypes = localStorage.getItem(typesKey);
      const typesList = storedTypes ? JSON.parse(storedTypes) : [];
      
      const formatted = ledgerList.map(item => {
        const student = studentList.find(s => s.id === item.student_id);
        const type = typesList.find(t => t.id === item.extra_fee_type_id);
        const cls = classes.find(c => c.id === (student ? student.class_id : null));
        return {
          ...item,
          student_name: student ? student.name : 'Unknown Student',
          roll_number: student ? student.roll_number : 'N/A',
          class_id: student ? student.class_id : null,
          class_name: cls ? cls.name : 'N/A',
          fee_name: type ? type.name : 'Unknown Fee',
          amount: type ? parseFloat(type.amount) : 0.00
        };
      });
      
      setStudentExtraFees(formatted);
      return;
    }
    try {
      const res = await fetch(`/api/student-extra-fees?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setStudentExtraFees(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch student extra fees ledger", err);
    }
  };

  const handleDepositExtraFee = async (feeId) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const ledgerKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
      const storedLedger = localStorage.getItem(ledgerKey);
      if (storedLedger) {
        const list = JSON.parse(storedLedger);
        const updated = list.map(item => {
          if (item.id === feeId) {
            return {
              ...item,
              status: 'Paid',
              payment_date: new Date().toISOString().split('T')[0],
              paid_at: new Date().toISOString(),
              collected_by: username || 'admin@sandbox.edu'
            };
          }
          return item;
        });
        localStorage.setItem(ledgerKey, JSON.stringify(updated));
        showToast("Fee payment recorded (Sandbox Mode)", "success");
        fetchStudentExtraFees();
      }
      return;
    }
    try {
      const res = await fetch(`/api/student-extra-fees/${feeId}/pay`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast("Fee payment recorded successfully", "success");
        fetchStudentExtraFees();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to record payment", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to record payment", "error");
    }
  };

  const executeRevertExtraFee = async (feeId) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const ledgerKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
      const storedLedger = localStorage.getItem(ledgerKey);
      if (storedLedger) {
        const list = JSON.parse(storedLedger);
        const record = list.find(item => item.id === feeId);
        if (record && record.status === 'Paid' && isSandboxTransactionLocked(record.paid_at)) {
          showToast("This extra fee payment is part of a finalized Financial Report and cannot be reverted.", "error");
          return;
        }
        const updated = list.map(item => {
          if (item.id === feeId) {
            return {
              ...item,
              status: 'Pending',
              payment_date: null,
              paid_at: null,
              collected_by: null
            };
          }
          return item;
        });
        localStorage.setItem(ledgerKey, JSON.stringify(updated));
        showToast("Fee payment reverted to Pending (Sandbox Mode)", "success");
        fetchStudentExtraFees();
      }
      return;
    }
    try {
      const res = await fetch(`/api/student-extra-fees/${feeId}/unpay`, {
        method: 'POST',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast("Fee payment reverted successfully", "success");
        fetchStudentExtraFees();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to revert payment", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to revert payment", "error");
    }
  };

  const fetchNotifications = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_notifications_${keySuffix}`;
      const stored = localStorage.getItem(storageKey);
      let list = stored ? JSON.parse(stored) : [];
      
      if (username === 'dd@yopmail.com') {
        const hasRenewed = list.some(n => n.title === "Subscription Renewed");
        if (!hasRenewed) {
          list = [
            {
              id: 101,
              school_id: 1,
              title: "Subscription Expiry Reminder",
              content: "Your subscription will expire in 30 days.",
              type: "Subscription",
              is_read: 0,
              timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
              created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
            },
            {
              id: 102,
              school_id: 1,
              title: "Subscription Expiry Reminder",
              content: "Your subscription will expire in 7 days.",
              type: "Subscription",
              is_read: 0,
              timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
              created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
            },
            {
              id: 103,
              school_id: 1,
              title: "Subscription Expiry Reminder",
              content: "Your subscription will expire in 3 days.",
              type: "Subscription",
              is_read: 0,
              timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
              created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
            },
            {
              id: 104,
              school_id: 1,
              title: "Subscription Expiry Reminder",
              content: "Your subscription will expire tomorrow.",
              type: "Subscription",
              is_read: 0,
              timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
              created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
            },
            {
              id: 105,
              school_id: 1,
              title: "Subscription Renewed",
              content: "Subscription renewed successfully.",
              type: "Subscription",
              is_read: 0,
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString()
            }
          ];
          localStorage.setItem(storageKey, JSON.stringify(list));
        }
      } else if (list.length === 0) {
        list = [{
          id: 1,
          school_id: parseInt(schoolId) || 1,
          title: 'Welcome to SP Portal',
          content: 'Complete school setup configuration to access rosters and ledgers.',
          type: 'System',
          is_read: 0,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        }];
        localStorage.setItem(storageKey, JSON.stringify(list));
      }
      
      const mockSchool = schools.find(s => String(s.id) === String(schoolId));
      if (mockSchool && mockSchool.days_remaining !== undefined && username !== 'dd@yopmail.com') {
        const remaining = parseInt(mockSchool.days_remaining);
        const daysToAlert = [30, 7, 3, 1];
        if (daysToAlert.includes(remaining)) {
          let content = "";
          if (remaining === 30) content = "Your subscription will expire in 30 days.";
          else if (remaining === 7) content = "Your subscription will expire in 7 days.";
          else if (remaining === 3) content = "Your subscription will expire in 3 days.";
          else if (remaining === 1) content = "Your subscription will expire tomorrow.";
          
          const title = "Subscription Expiry Reminder";
          const exists = list.some(n => n.title === title && n.content === content);
          if (!exists) {
            const newId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
            const newNotif = {
              id: newId,
              school_id: parseInt(schoolId) || 1,
              title,
              content,
              type: 'Subscription',
              is_read: 0,
              timestamp: new Date().toISOString(),
              created_at: new Date().toISOString()
            };
            list = [newNotif, ...list];
            localStorage.setItem(storageKey, JSON.stringify(list));
          }
        }
      }
      
      setNotifications(list);
      return;
    }

    try {
      const res = await fetch('/api/notifications', { headers: getHeaders() });
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  const markNotificationsAsRead = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_notifications_${keySuffix}`;
      const stored = localStorage.getItem(storageKey);
      const list = stored ? JSON.parse(stored) : [];
      const updated = list.map(n => ({ ...n, is_read: 1 }));
      setNotifications(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return;
    }
    try {
      setNotifications(notifications.map(n => ({ ...n, is_read: 1 })));
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: getHeaders()
      });
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    }
  };

  const handleSalaryBarClick = async (month) => {
    setShowSalaryDrilldown(month);
    setIsDrilldownLoading(true);
    
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const activeTeachers = teachers.filter(t => t.status === 'Active');
      const mockBreakdown = activeTeachers.map(t => {
        const storageKey = `bn_sandbox_salaries_${keySuffix}_${t.id}_${activeYearId}`;
        const stored = localStorage.getItem(storageKey);
        let status = 'Pending';
        let amount = parseFloat(t.salary_amount) || 3000.0;
        
        if (stored) {
          const records = JSON.parse(stored);
          const found = records.find(r => r.month === month);
          if (found) {
            status = found.status === 'Paid' ? 'Paid' : 'Pending';
            amount = parseFloat(found.amount) || amount;
          }
        }
        
        return {
          teacher_id: t.id,
          name: t.name,
          gender: t.gender || 'Male',
          phone: t.phone || '9876543210',
          profile_image: t.profile_image || null,
          amount: amount,
          status: status
        };
      });
      
      setSalaryDrilldownData(mockBreakdown);
      setIsDrilldownLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/salaries/month/${month}?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSalaryDrilldownData(data);
      } else {
        showToast('Failed to fetch salary details.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error fetching salary details.', 'error');
    } finally {
      setIsDrilldownLoading(false);
    }
  };

  const fetchPaymentPromises = async () => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_payment_promises_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      const studentList = JSON.parse(localStorage.getItem(`bn_sandbox_students_${keySuffix}`) || '[]');
      const parsedPromises = stored ? JSON.parse(stored) : [];
      const populatedPromises = parsedPromises.map(p => {
        const st = studentList.find(s => s.id === p.student_id);
        return {
          ...p,
          student_name: st ? st.name : 'Unknown Student',
          roll_number: st ? st.roll_number : '',
          class_name: st ? getClassName(st.class_id) : 'Unassigned',
          class_id: st ? st.class_id : null
        };
      });
      setPaymentPromises(populatedPromises);
      return;
    }
    try {
      const res = await fetch(`/api/payment-promises?academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setPaymentPromises(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch payment promises", err);
    }
  };

  const handleSavePaymentPromise = async (e) => {
    e.preventDefault();
    if (!promiseStudentId || !promiseDate) {
      showToast("Please fill in all required fields.", "error");
      return;
    }
    setIsSavingPromise(true);
    const keySuffix = schoolId || 'default';

    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_payment_promises_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      const list = stored ? JSON.parse(stored) : [];

      if (editingPromise) {
        // Edit mode
        const updated = list.map(p => p.id === editingPromise.id ? {
          ...p,
          student_id: parseInt(promiseStudentId),
          promise_date: promiseDate,
          description: promiseDescription.trim(),
          status: promiseStatus
        } : p);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        showToast("Payment promise updated (Sandbox Mode)", "success");
      } else {
        // Add mode
        const nextId = list.length > 0 ? Math.max(...list.map(p => p.id)) + 1 : 1;
        const newPromise = {
          id: nextId,
          school_id: parseInt(keySuffix) || 1,
          academic_year_id: activeYearId,
          student_id: parseInt(promiseStudentId),
          promise_date: promiseDate,
          description: promiseDescription.trim(),
          status: promiseStatus
        };
        const updated = [...list, newPromise];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        showToast("Payment promise added (Sandbox Mode)", "success");
      }

      setPromiseModalOpen(false);
      setEditingPromise(null);
      setPromiseStudentId('');
      setPromiseStudentSearchQuery('');
      setPromiseDate('');
      setPromiseDescription('');
      setPromiseStatus('Pending');
      setIsSavingPromise(false);
      fetchPaymentPromises();
      return;
    }

    try {
      const url = editingPromise ? `/api/payment-promises/${editingPromise.id}` : '/api/payment-promises';
      const method = editingPromise ? 'PUT' : 'POST';
      const body = {
        student_id: parseInt(promiseStudentId),
        promise_date: promiseDate,
        description: promiseDescription.trim(),
        status: promiseStatus,
        academic_year_id: activeYearId
      };

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showToast(editingPromise ? "Payment promise updated successfully" : "Payment promise added successfully", "success");
        setPromiseModalOpen(false);
        setEditingPromise(null);
        setPromiseStudentId('');
        setPromiseStudentSearchQuery('');
        setPromiseDate('');
        setPromiseDescription('');
        setPromiseStatus('Pending');
        fetchPaymentPromises();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to save payment promise", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to save payment promise", "error");
    } finally {
      setIsSavingPromise(false);
    }
  };

  const handleDeletePaymentPromise = async (promiseId) => {
    const keySuffix = schoolId || 'default';

    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_payment_promises_${keySuffix}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      const list = stored ? JSON.parse(stored) : [];
      const updated = list.filter(p => p.id !== promiseId);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      showToast("Payment promise deleted successfully.", "success");
      fetchPaymentPromises();
      return;
    }

    try {
      const res = await fetch(`/api/payment-promises/${promiseId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        showToast("Payment promise deleted successfully.", "success");
        fetchPaymentPromises();
      } else {
        const data = await res.json();
        showToast(data.detail || "Failed to delete payment promise", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to delete payment promise", "error");
    }
  };

  const fetchClassFeeStructure = async (classId) => {
    if (!classId) return;
    const keySuffix = schoolId || 'default';
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    
    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_class_fees_${keySuffix}_${classId}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        setClassFeeStructure(data);
        if (data.structure_mode) {
          setFeeStructureMode(data.structure_mode);
        } else {
          const firstVal = data[months[0]] ?? 0;
          const allSame = months.every(m => (data[m] ?? 0) === firstVal);
          setFeeStructureMode(allSame ? 'same' : 'custom');
        }
        setSameMonthlyFee(data.April ?? 0);
      } else {
        setClassFeeStructure({
          April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
          October: 0, November: 0, December: 0, January: 0, February: 0, March: 0,
          structure_mode: 'same',
          is_locked: 0
        });
        setFeeStructureMode('same');
        setSameMonthlyFee(0);
      }
      return;
    }

    try {
      const res = await fetch(`/api/class-fees?class_id=${classId}&academic_year_id=${activeYearId}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setClassFeeStructure(data);
        if (data.structure_mode) {
          setFeeStructureMode(data.structure_mode);
        } else {
          const firstVal = data[months[0]] ?? 0;
          const allSame = months.every(m => (data[m] ?? 0) === firstVal);
          setFeeStructureMode(allSame ? 'same' : 'custom');
        }
        setSameMonthlyFee(data.April ?? 0);
      } else {
        setClassFeeStructure({
          April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
          October: 0, November: 0, December: 0, January: 0, February: 0, March: 0,
          structure_mode: 'same',
          is_locked: 0
        });
        setFeeStructureMode('same');
        setSameMonthlyFee(0);
      }
    } catch (err) {
      setClassFeeStructure({
        April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
        October: 0, November: 0, December: 0, January: 0, February: 0, March: 0,
        structure_mode: 'same',
        is_locked: 0
      });
      setFeeStructureMode('same');
      setSameMonthlyFee(0);
    }
  };

  const saveClassFeeStructure = async () => {
    if (!selectedFeeClassId) return;
    const keySuffix = schoolId || 'default';
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    
    // Construct fee structure based on mode
    let structureToSave = { ...classFeeStructure };
    if (feeStructureMode === 'same') {
      months.forEach(m => {
        structureToSave[m] = sameMonthlyFee;
      });
      structureToSave.structure_mode = 'same';
    } else {
      structureToSave.structure_mode = 'custom';
    }
    
    // Always lock the record on save
    structureToSave.is_locked = 1;

    if (token.includes('mock') || !isConnected) {
      const storageKey = `bn_sandbox_class_fees_${keySuffix}_${selectedFeeClassId}_${activeYearId}`;
      localStorage.setItem(storageKey, JSON.stringify(structureToSave));
      setClassFeeStructure(structureToSave);
      
      // Update all Pending student fee records for this class in sandbox mode
      const studentsKey = `bn_sandbox_students_${keySuffix}`;
      const storedStudents = localStorage.getItem(studentsKey);
      if (storedStudents) {
        const studentList = JSON.parse(storedStudents);
        const classStudents = studentList.filter(s => parseInt(s.class_id) === parseInt(selectedFeeClassId));
        classStudents.forEach(st => {
          const studentFeesKey = `bn_sandbox_fees_${keySuffix}_${st.id}_${activeYearId}`;
          const storedStudentFees = localStorage.getItem(studentFeesKey);
          if (storedStudentFees) {
            const feesList = JSON.parse(storedStudentFees);
            const updatedFees = feesList.map(fee => {
              if (fee.status === 'Pending') {
                const mAmount = structureToSave[fee.month];
                if (mAmount !== undefined) {
                  fee.amount = mAmount;
                }
              }
              return fee;
            });
            localStorage.setItem(studentFeesKey, JSON.stringify(updatedFees));
          }
        });
      }
      
      await fetchSPData();
      showToast('Fee Structure has been successfully locked and can no longer be modified.', 'success');
      return;
    }

    try {
      const res = await fetch('/api/class-fees', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          class_id: selectedFeeClassId,
          academic_year_id: activeYearId,
          fee_structure: structureToSave,
          is_locked: 1
        })
      });
      if (res.ok) {
        setClassFeeStructure(structureToSave);
        await fetchSPData();
        showToast('Fee Structure has been successfully locked and can no longer be modified.', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || 'Failed to save fee structure', 'danger');
      }
    } catch (err) {
      showToast('Failed to save fee structure', 'danger');
    }
  };

  const handleSaveTimetableConfig = async () => {
    if (draftPeriodDuration <= 0 || draftTotalPeriods <= 0 || draftIntervalDuration < 0 || draftIntervalAfterPeriod < 0 || draftIntervalAfterPeriod > draftTotalPeriods) {
      showToast('Please correct validation errors before saving.', 'error');
      return;
    }

    const payload = {
      school_start_time: draftSchoolStartTime,
      period_duration: draftPeriodDuration,
      interval_duration: draftIntervalDuration,
      interval_after_period: draftIntervalAfterPeriod,
      total_periods: draftTotalPeriods
    };

    const keySuffix = schoolId || 'default';

    localStorage.setItem('bn_settings_school_start_time', draftSchoolStartTime);
    localStorage.setItem('bn_settings_period_duration', draftPeriodDuration.toString());
    localStorage.setItem('bn_settings_interval_duration', draftIntervalDuration.toString());
    localStorage.setItem('bn_settings_interval_after_period', draftIntervalAfterPeriod.toString());
    localStorage.setItem('bn_settings_total_periods', draftTotalPeriods.toString());

    localStorage.setItem(`bn_sandbox_school_start_time_${keySuffix}`, draftSchoolStartTime);
    localStorage.setItem(`bn_sandbox_period_duration_${keySuffix}`, draftPeriodDuration.toString());
    localStorage.setItem(`bn_sandbox_interval_duration_${keySuffix}`, draftIntervalDuration.toString());
    localStorage.setItem(`bn_sandbox_interval_after_period_${keySuffix}`, draftIntervalAfterPeriod.toString());
    localStorage.setItem(`bn_sandbox_total_periods_${keySuffix}`, draftTotalPeriods.toString());

    if (token.includes('mock') || !isConnected) {
      setSchoolStartTime(draftSchoolStartTime);
      setPeriodDuration(draftPeriodDuration);
      setIntervalDuration(draftIntervalDuration);
      setIntervalAfterPeriod(draftIntervalAfterPeriod);
      setTotalPeriodsPerDay(draftTotalPeriods);
      showToast('Timetable configuration saved locally (Sandbox Mode)!', 'success');
      return;
    }

    try {
      const headers = getHeaders();
      const res = await fetch('/api/school/timetable-config', {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to save timetable configuration.');
      }

      setSchoolStartTime(draftSchoolStartTime);
      setPeriodDuration(draftPeriodDuration);
      setIntervalDuration(draftIntervalDuration);
      setIntervalAfterPeriod(draftIntervalAfterPeriod);
      setTotalPeriodsPerDay(draftTotalPeriods);

      showToast('Timetable configuration saved successfully to database!', 'success');
      
      const resAudit = await fetch('/api/audit-logs', { headers });
      if (resAudit.ok) setAuditLogs(await resAudit.json());

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  const resetDraftTimetableSettings = () => {
    setDraftSchoolStartTime(schoolStartTime);
    setDraftPeriodDuration(periodDuration);
    setDraftIntervalDuration(intervalDuration);
    setDraftIntervalAfterPeriod(intervalAfterPeriod);
    setDraftTotalPeriods(totalPeriodsPerDay);
  };

  useEffect(() => {
    if (activeTab !== 'settings' && hasUnsavedChanges && previousTab === 'settings') {
      setPendingTabChange(activeTab);
      setShowUnsavedConfirmModal(true);
      setActiveTab('settings');
    } else {
      setPreviousTab(activeTab);
    }
  }, [activeTab, hasUnsavedChanges, previousTab]);

  useEffect(() => {
    if (selectedFeeClassId) {
      fetchClassFeeStructure(selectedFeeClassId);
    }
    if (activeYearId) {
      fetchLeaves(activeYearId);
    }
  }, [activeYearId]);

  // Helper getters
  const getActiveYearRange = () => {
    return years.find(y => y.id === activeYearId)?.year_range || 'Unknown';
  };
  
  const isCurrentYearActive = () => {
    return years.find(y => y.id === activeYearId)?.is_active || false;
  };

  const getClassName = (classId) => {
    return classes.find(c => c.id === parseInt(classId))?.name || 'Unassigned';
  };

  const getClassMonthlyFee = (classId) => {
    if (isConnected) {
      const matchStud = students.find(s => s.class_id === parseInt(classId));
      if (matchStud && matchStud.monthly_fee !== undefined) {
        return parseFloat(matchStud.monthly_fee) || 0.00;
      }
    }
    const keySuffix = schoolId || 'default';
    const sandboxClassFeesKey = `bn_sandbox_class_fees_${keySuffix}_${classId}_${activeYearId}`;
    const storedClassFees = localStorage.getItem(sandboxClassFeesKey);
    if (!storedClassFees) return 0.00;
    const feeStructure = JSON.parse(storedClassFees);
    return parseFloat(feeStructure.April) || 0.00;
  };

  const getStudentDuesAmount = (student) => {
    if (!student) return 0;
    let unpaidDues = 0;
    if (isConnected) {
      unpaidDues = parseFloat(student.total_dues) || 0.00;
    } else {
      const keySuffix = schoolId || 'default';
      const storageKey = `bn_sandbox_fees_${keySuffix}_${student.id}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      if (stored) {
        const records = JSON.parse(stored);
        records.forEach(r => {
          if (r.status !== 'Paid') {
            const [dueY, dueM] = r.due_date.split('-').map(Number);
            if (dueY < currentYear || (dueY === currentYear && dueM <= currentMonth)) {
              unpaidDues += parseFloat(r.amount) || 0;
            }
          }
        });
      } else {
        const activeYear = years.find(y => y.id === activeYearId);
        const range = activeYear ? activeYear.year_range : '2025-2026';
        const [startYearStr, endYearStr] = range.split('-');
        const startYear = parseInt(startYearStr) || 2025;
        const endYear = parseInt(endYearStr) || 2026;
        
        const sandboxClassFeesKey = `bn_sandbox_class_fees_${keySuffix}_${student.class_id}_${activeYearId}`;
        const storedClassFees = localStorage.getItem(sandboxClassFeesKey);
        const feeStructure = storedClassFees ? JSON.parse(storedClassFees) : {
          April: 0, May: 0, June: 0, July: 0, August: 0, September: 0,
          October: 0, November: 0, December: 0, January: 0, February: 0, March: 0
        };
        
        const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        
        months.forEach((m, idx) => {
          const mNum = idx < 9 ? idx + 4 : idx - 8;
          const mYear = idx < 9 ? startYear : endYear;
          if (mYear < currentYear || (mYear === currentYear && mNum <= currentMonth)) {
            unpaidDues += parseFloat(feeStructure[m]) || 0.00;
          }
        });
      }
      
      // Add pending extra fees in sandbox mode
      const extraKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
      const storedExtra = localStorage.getItem(extraKey);
      if (storedExtra) {
        const extraRecords = JSON.parse(storedExtra);
        const typesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
        const storedTypes = localStorage.getItem(typesKey);
        const types = storedTypes ? JSON.parse(storedTypes) : [];
        
        extraRecords.forEach(r => {
          if (r.student_id === student.id && r.status !== 'Paid') {
            const type = types.find(t => t.id === r.extra_fee_type_id);
            if (type) {
              unpaidDues += parseFloat(type.amount) || 0;
            }
          }
        });
      }
    }
    return Math.round(unpaidDues);
  };

  const getStudentFeeStatus = (student) => {
    if (!student) return 'PAID';
    if (student.fee_status) {
      return student.fee_status;
    }
    
    const keySuffix = schoolId || 'default';
    const storageKey = `bn_sandbox_fees_${keySuffix}_${student.id}_${activeYearId}`;
    const stored = localStorage.getItem(storageKey);
    
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    let records = [];
    if (stored) {
      records = JSON.parse(stored);
    } else {
      const activeYear = years.find(y => y.id === activeYearId);
      const range = activeYear ? activeYear.year_range : '2025-2026';
      const [startYearStr, endYearStr] = range.split('-');
      const startYear = parseInt(startYearStr) || 2025;
      const endYear = parseInt(endYearStr) || 2026;
      
      const sandboxClassFeesKey = `bn_sandbox_class_fees_${keySuffix}_${student.class_id}_${activeYearId}`;
      const storedClassFees = localStorage.getItem(sandboxClassFeesKey);
      if (!storedClassFees) {
        return 'FEE NOT SET';
      }
      const feeStructure = JSON.parse(storedClassFees);
      records = months.map((m, i) => {
        const year = i < 9 ? startYear : endYear;
        const monthNum = i < 9 ? i + 4 : i - 8;
        return {
          month: m,
          status: "Pending",
          due_date: `${year}-${String(monthNum).padStart(2, '0')}-15`
        };
      });
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    let totalUnpaidUpToCurrent = 0;
    let pastUnpaidCount = 0;
    let isCurrentUnpaid = false;
    
    records.forEach(f => {
      if (f.status !== 'Paid') {
        const [dueY, dueM] = f.due_date.split('-').map(Number);
        if (dueY < currentYear || (dueY === currentYear && dueM <= currentMonth)) {
          totalUnpaidUpToCurrent++;
          if (dueY < currentYear || (dueY === currentYear && dueM < currentMonth)) {
            pastUnpaidCount++;
          } else if (dueY === currentYear && dueM === currentMonth) {
            isCurrentUnpaid = true;
          }
        }
      }
    });
    
    if (totalUnpaidUpToCurrent === 0) return 'PAID';
    if (totalUnpaidUpToCurrent === 1) {
      return isCurrentUnpaid ? 'DUES PENDING' : 'PAYMENT OVERDUE';
    }
    if (totalUnpaidUpToCurrent === 2) return 'CRITICAL DUES';
    return 'DEFAULT ALERT';
  };

  const getFeeStatusBadgeInfo = (statusStr) => {
    switch (statusStr) {
      case 'FEE NOT SET':
        return { class: 'badge-warning', label: 'FEE NOT SET' };
      case 'PAID':
        return { class: 'badge-success', label: 'PAID' };
      case 'DUES PENDING':
        return { class: 'badge-pending', label: 'DUES PENDING' };
      case 'PAYMENT OVERDUE':
        return { class: 'badge-overdue', label: 'PAYMENT OVERDUE' };
      case 'CRITICAL DUES':
        return { class: 'badge-critical', label: 'CRITICAL DUES' };
      case 'DEFAULT ALERT':
        return { class: 'badge-default-alert', label: 'DEFAULT ALERT' };
      default:
        return { class: 'badge-secondary', label: statusStr || 'UNKNOWN' };
    }
  };

  const getTeacherAssignedCountOnDate = (teacherId, dateStr) => {
    let count = 0;
    allWeeklySchedules.forEach(sched => {
      if (sched.schedule_date === dateStr && Array.isArray(sched.subjects)) {
        sched.subjects.forEach(period => {
          if (period && typeof period === 'object') {
            const hasBackup = period.backup_teacher_id && period.backup_teacher_id !== 'null' && period.backup_teacher_id !== '';
            const actualTeacherId = hasBackup ? period.backup_teacher_id : period.teacher_id;
            if (parseInt(actualTeacherId) === parseInt(teacherId)) {
              count++;
            }
          }
        });
      }
    });
    return count;
  };

  const getPlanDateFromDayName = (dayName) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const idx = days.indexOf(dayName);
    if (idx === -1) return '';
    const refMonday = new Date(weekStartDate);
    const cardDate = new Date(refMonday);
    cardDate.setDate(refMonday.getDate() + idx);
    const y = cardDate.getFullYear();
    const m = String(cardDate.getMonth() + 1).padStart(2, '0');
    const r = String(cardDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${r}`;
  };

  const filteredTeachers = teachers.filter(t => {
    const matchesSubject = subjectFilter === 'all' || t.subject.toLowerCase() === subjectFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch = t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) || 
                          t.subject.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
                          (t.phone && t.phone.includes(teacherSearchQuery));
    return matchesSubject && matchesStatus && matchesSearch;
  }).sort((a, b) => {
    const countA = getTeacherAssignedCountOnDate(a.id, facultySelectedDate);
    const countB = getTeacherAssignedCountOnDate(b.id, facultySelectedDate);
    if (countB !== countA) {
      return countB - countA;
    }
    return String(a.name).localeCompare(String(b.name));
  });

  const getDuesReport = () => {
    return students.map(s => {
      return {
        name: s.name,
        roll: s.roll_number,
        class: getClassName(s.class_id),
        dues: getStudentDuesAmount(s)
      };
    }).filter(r => r.dues > 0);
  };

  const getTotalPendingDuesAmount = () => {
    return getDuesReport().reduce((sum, r) => sum + r.dues, 0);
  };

  const getTotalPaidRevenueAmount = () => {
    const keySuffix = schoolId || 'default';
    let totalPaid = 0;
    students.forEach(s => {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${s.id}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const records = JSON.parse(stored);
        records.forEach(r => {
          if (r.status === 'Paid') {
            totalPaid += parseFloat(r.amount) || 0;
          }
        });
      }
    });

    const extraKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
    const storedExtra = localStorage.getItem(extraKey);
    if (storedExtra) {
      const extraRecords = JSON.parse(storedExtra);
      const typesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
      const storedTypes = localStorage.getItem(typesKey);
      const types = storedTypes ? JSON.parse(storedTypes) : [];
      extraRecords.forEach(r => {
        if (r.status === 'Paid') {
          const type = types.find(t => t.id === r.extra_fee_type_id);
          if (type) {
            totalPaid += parseFloat(type.amount) || 0;
          }
        }
      });
    }
    return totalPaid;
  };

  const getDynamicFeeCollectionChartData = () => {
    const keySuffix = schoolId || 'default';
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const chartData = months.map(m => ({ month: m, amount: 0 }));
    
    students.forEach(s => {
      const storageKey = `bn_sandbox_fees_${keySuffix}_${s.id}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const records = JSON.parse(stored);
        records.forEach(r => {
          if (r.status === 'Paid') {
            const chartMonth = chartData.find(c => c.month === r.month);
            if (chartMonth) {
              chartMonth.amount += parseFloat(r.amount) || 0;
            }
          }
        });
      }
    });

    const extraKey = `bn_sandbox_student_extra_fees_${keySuffix}_${activeYearId}`;
    const storedExtra = localStorage.getItem(extraKey);
    if (storedExtra) {
      const extraRecords = JSON.parse(storedExtra);
      const typesKey = `bn_sandbox_extra_fee_types_${keySuffix}_${activeYearId}`;
      const storedTypes = localStorage.getItem(typesKey);
      const types = storedTypes ? JSON.parse(storedTypes) : [];
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      extraRecords.forEach(r => {
        if (r.status === 'Paid' && r.payment_date) {
          const date = new Date(r.payment_date);
          const monthName = monthNames[date.getMonth()];
          const chartMonth = chartData.find(c => c.month === monthName);
          if (chartMonth) {
            const type = types.find(t => t.id === r.extra_fee_type_id);
            if (type) {
              chartMonth.amount += parseFloat(type.amount) || 0;
            }
          }
        }
      });
    }
    return chartData;
  };

  const getDynamicSalaryChartData = () => {
    const keySuffix = schoolId || 'default';
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    const chartData = months.map(m => ({ month: m, amount: 0 }));
    
    teachers.forEach(t => {
      const storageKey = `bn_sandbox_salaries_${keySuffix}_${t.id}_${activeYearId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const records = JSON.parse(stored);
        records.forEach(r => {
          if (r.status === 'Paid') {
            const chartMonth = chartData.find(c => c.month === r.month);
            if (chartMonth) {
              chartMonth.amount += parseFloat(r.amount) || 0;
            }
          }
        });
      }
    });
    return chartData;
  };

  const downloadExperienceLetterDoc = (teacher) => {
    if (!teacher) return;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const refNum = `BN/EXP/${new Date().getFullYear()}/${String(teacher.id).padStart(3, '0')}`;
    const subject = teacher.subject || 'Teaching';
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>Experience Certificate</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; padding: 40px; color: #000000; }
        .header { text-align: center; margin-bottom: 40px; }
        .title { text-align: center; font-size: 18pt; font-weight: bold; text-decoration: underline; margin-bottom: 30px; }
        .content { font-size: 12pt; text-align: justify; margin-bottom: 40px; }
        .signature { margin-top: 50px; }
      </style>
      </head>
      <body>
        <div class="header">
          <h1>BN SCHOOL</h1>
          <p>Official School Administration</p>
        </div>
        <p><strong>Date:</strong> ${dateStr}</p>
        <p><strong>Reference:</strong> ${refNum}</p>
        <br/>
        <div class="title">EXPERIENCE CERTIFICATE</div>
        <br/>
        <div class="content">
          <p><strong>TO WHOM IT MAY CONCERN</strong></p>
          <br/>
          <p>This is to certify that <strong>${teacher.name}</strong> was employed with BN School as a Teacher from <strong>${teacher.joining_date || 'N/A'}</strong> to <strong>${teacher.exit_date || 'N/A'}</strong>.</p>
          <p>During their tenure, they taught the subject of <strong>"${subject}"</strong> and demonstrated outstanding pedagogical skills, dedication, and professional ethics. Their conduct and behavior were exemplary.</p>
          <p>We appreciate their valuable contributions to our institution and wish them all the success in their future endeavors.</p>
        </div>
        <div class="signature">
          <p>Sincerely,</p>
          <br/><br/>
          <p>_______________________</p>
          <p><strong>Authorized Signatory</strong></p>
          <p>BN School Administration</p>
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Experience_Letter_${teacher.name.replace(/\\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpdateStudentDocuments = async (studentId, updatedDocs) => {
    if (token.includes('mock') || !isConnected) {
      const keySuffix = schoolId || 'default';
      const updated = students.map(s => {
        if (s.id === studentId) {
          const updatedStud = { ...s, documents: updatedDocs };
          setSelectedStudent(updatedStud);
          return updatedStud;
        }
        return s;
      });
      setStudents(updated);
      localStorage.setItem(`bn_sandbox_students_${keySuffix}`, JSON.stringify(updated));
      showToast('Documents updated (Sandbox Mode)', 'success');
      return;
    }

    try {
      const targetStudent = students.find(s => s.id === studentId);
      if (!targetStudent) return;
      const payload = {
        ...targetStudent,
        documents: updatedDocs
      };
      
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSelectedStudent(prev => ({ ...prev, documents: updatedDocs }));
        await fetchSPData();
        showToast('Documents updated successfully', 'success');
      } else {
        showToast('Failed to update student documents', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating student documents', 'error');
    }
  };

  const getDefaultersCount = () => {
    let pending = 0;
    let overdue = 0;
    let critical = 0;
    let alert = 0;
    students.forEach(s => {
      const status = getStudentFeeStatus(s);
      if (status === 'DUES PENDING') pending++;
      else if (status === 'PAYMENT OVERDUE') overdue++;
      else if (status === 'CRITICAL DUES') critical++;
      else if (status === 'DEFAULT ALERT') alert++;
    });
    return { pending, overdue, critical, alert };
  };

  const handlePrintReceipt = (student, record) => {
    if (record && record.status === 'Paid' && record.paid_at) {
      const sameTimeRecords = studentFees.filter(f => f.status === 'Paid' && f.paid_at === record.paid_at);
      if (sameTimeRecords.length > 1) {
        const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
        sameTimeRecords.sort((a, b) => monthsOrder.indexOf(a.month) - monthsOrder.indexOf(b.month));
        
        const multiMonthRecord = {
          isMultiMonth: true,
          months: sameTimeRecords.map(r => r.month),
          amount: sameTimeRecords.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
          payment_date: record.payment_date,
          paid_at: record.paid_at,
          records: sameTimeRecords,
          id: sameTimeRecords[sameTimeRecords.length - 1].id
        };
        setReceiptStudent(student);
        setReceiptRecord(multiMonthRecord);
        return;
      }
    }
    setReceiptStudent(student);
    setReceiptRecord(record);
  };

  const handleDownloadPDF = () => {
    if (!receiptStudent || !receiptRecord) return;
    const element = document.getElementById('receipt-print-area');
    if (!element) return;
    
    const opt = {
      margin:       10,
      filename:     `receipt-${receiptStudent.name.replace(/\s+/g, '_')}-${receiptRecord.isMultiMonth ? 'multi-month' : receiptRecord.month}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    if (window.html2pdf) {
      window.html2pdf().from(element).set(opt).save();
    } else {
      showToast('PDF download library loading, please try again in a moment', 'warning');
    }
  };

  const handlePrintRecoveryReceipt = (due, rec) => {
    setSelectedRecoveryReceiptDue(due);
    setSelectedRecoveryReceiptRec(rec);
    setShowRecoveryReceiptModal(true);
  };

  const handleDownloadRecoveryPDF = () => {
    if (!selectedRecoveryReceiptDue || !selectedRecoveryReceiptRec) return;
    const element = document.getElementById('recovery-receipt-print-area');
    if (!element) return;
    
    const opt = {
      margin:       10,
      filename:     `recovery-receipt-${selectedRecoveryReceiptDue.student_name.replace(/\s+/g, '_')}-${selectedRecoveryReceiptDue.original_academic_year}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    if (window.html2pdf) {
      window.html2pdf().from(element).set(opt).save();
    } else {
      showToast('PDF download library loading, please try again in a moment', 'warning');
    }
  };

  const fetchProfileData = async () => {
    if (!token) return;
    
    const keySuffix = schoolId || 'default';
    
    // If it's a mock token, load mock profile from localStorage/defaults
    if (token.includes('mock')) {
      const stored = localStorage.getItem(`bn_sandbox_profile_${keySuffix}`);
      if (stored && stored !== 'null') {
        try {
          const prof = JSON.parse(stored);
          if (prof && typeof prof === 'object') {
            setAdminProfile(prof);
            if (prof.school_name) {
              setSchoolName(prof.school_name);
              localStorage.setItem('admin_school_name', prof.school_name);
            }
            setAdminProfileForm(prof);
            return;
          }
        } catch (e) {
          console.error("Failed to parse stored sandbox profile", e);
        }
      }
      
      const schoolNameVal = role === 'Super Admin' ? 'Platform Administration' : (schoolName || 'St. Xavier\'s International School');
      const emailVal = role === 'Super Admin' ? 'Bilal@yopmail.com' : 'Admin@yopmail.com';
      const nameVal = role === 'Super Admin' ? 'Bilal Ahmed' : 'School Admin';
      const defaultProf = {
        id: 0,
        name: nameVal,
        email: emailVal,
        phone: '8650302499',
        address: '123 Main Street',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        country: 'India',
        timezone: 'Asia/Kolkata',
        profile_image: null,
        role: role,
        created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19),
        last_login_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        school_name: schoolNameVal,
        school_email: role === 'Super Admin' ? 'support@bncollegeportal.com' : 'xavier.admin@xavier.edu',
        school_phone: role === 'Super Admin' ? '9876543210' : '+1 (555) 019-8833',
        school_address: role === 'Super Admin' ? '123 Main St' : '123 School Lane',
        school_city: role === 'Super Admin' ? 'Lucknow' : 'Lucknow',
        school_state: role === 'Super Admin' ? 'Uttar Pradesh' : 'Uttar Pradesh',
        school_country: role === 'Super Admin' ? 'India' : 'India',
        school_contact_person: role === 'Super Admin' ? 'Bilal Ahmed' : 'Principal John Doe',
        school_logo_path: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234f46e5"/><path d="M50 25 L80 40 L50 55 L20 40 Z" fill="%23ffffff"/><path d="M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5" fill="%23ffffff" opacity="0.9"/><path d="M72 43 L72 65 L75 65 L75 43 Z" fill="%23f59e0b"/><circle cx="73.5" cy="67" r="3" fill="%23f59e0b"/></svg>'
      };
      setAdminProfile(defaultProf);
      setAdminProfileForm(defaultProf);
      localStorage.setItem(`bn_sandbox_profile_${keySuffix}`, JSON.stringify(defaultProf));
      return;
    }
    
    // For real tokens, attempt to fetch from backend API first
    try {
      const res = await fetch('/api/profile', { headers: getHeaders() });
      if (res.ok) {
        const prof = await res.json();
        if (prof && typeof prof === 'object') {
          setAdminProfile(prof);
          if (prof.school_name) {
            setSchoolName(prof.school_name);
            localStorage.setItem('admin_school_name', prof.school_name);
          }
          setAdminProfileForm({
            name: prof.name || '',
            email: prof.email || '',
            phone: prof.phone || '',
            address: prof.address || '',
            city: prof.city || '',
            state: prof.state || '',
            country: prof.country || '',
            timezone: prof.timezone || 'Asia/Kolkata',
            profile_image: prof.profile_image || ''
          });
          // Cache the latest profile in local storage for offline use
          localStorage.setItem(`bn_sandbox_profile_${keySuffix}`, JSON.stringify(prof));
          return;
        }
      }
    } catch (err) {
      console.error("Failed to fetch profile online, checking local cache:", err);
    }

    // Fallback to local storage if offline/API fails
    const stored = localStorage.getItem(`bn_sandbox_profile_${keySuffix}`);
    if (stored && stored !== 'null') {
      try {
        const prof = JSON.parse(stored);
        if (prof && typeof prof === 'object') {
          setAdminProfile(prof);
          if (prof.school_name) {
            setSchoolName(prof.school_name);
            localStorage.setItem('admin_school_name', prof.school_name);
          }
          setAdminProfileForm(prof);
        }
      } catch (e) {
        console.error("Failed to parse cached profile", e);
      }
    }
  };

  // Fetch available plans for expired subscription screen
  const fetchAvailablePlans = async () => {
    try {
      const res = await fetch('/api/subscription/plans');
      if (res.ok) {
        setAvailablePlans(await res.json());
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (err) {
      setAvailablePlans([
        { id: 2, name: '1 Year Plan', duration_days: 365, price: 12000.00, description: '1 Year full platform access.' },
        { id: 3, name: '2 Year Plan', duration_days: 730, price: 22000.00, description: '2 Years full platform access.' },
        { id: 4, name: '3 Year Plan', duration_days: 1095, price: 30000.00, description: '3 Years full platform access. Best value.' }
      ]);
    }
  };

  // Sync profile data on token verified
  useEffect(() => {
    if (token && !isInitializing) {
      fetchProfileData();
      fetchAvailablePlans();
    }
  }, [token, isInitializing]);

  // --- RENDERING LAYER ---

  // 1. Initial verification loading state
  if (isInitializing) {
    return (
      <div className={`app-layout ${isDarkMode ? 'dark-theme' : ''}`} style={{ background: 'var(--bg-app)', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', display: 'flex' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Verifying session...</span>
        </div>
      </div>
    );
  }

  // 2.5. Reconnecting / Offline View (when API is unavailable but user is logged in)
  if (token && isApiUnavailable) {
    return (
      <div className={`app-layout ${isDarkMode ? 'dark-theme' : ''}`} style={{ background: 'var(--bg-app)', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', display: 'flex', padding: '24px' }}>
        
        {toast && (
          <div className="toast-in-out" 
            onMouseEnter={pauseToastTimer}
            onMouseLeave={resumeToastTimer}
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 100005,
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
              color: '#ffffff',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="sp-card fade-in" style={{ 
          width: '100%', 
          maxWidth: '500px', 
          padding: '40px 32px', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background decorative gradient glow */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '200px',
            height: '100px',
            background: 'radial-gradient(ellipse, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0) 70%)',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Animated offline icon container */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '20px',
              borderRadius: '24px',
              marginBottom: '28px',
              boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)'
            }}>
              <WifiOff size={44} style={{ color: '#ef4444' }} />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Connection to Server Lost
            </h2>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              The system cannot establish a secure link with the school database server. 
              Your session is saved locally, but live actions are temporarily suspended until the server is back online.
            </p>

            {/* Error Detail Display */}
            {apiConnectionError && (
              <div style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                textAlign: 'left',
                marginBottom: '28px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                maxHeight: '120px',
                overflowY: 'auto',
                borderLeft: '4px solid #ef4444'
              }}>
                <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  Diagnostics Error Info
                </div>
                {apiConnectionError}
              </div>
            )}

            {/* Live Connection Status Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: isRetrying ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.08)',
              border: isRetrying ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(239, 68, 68, 0.15)',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isRetrying ? '#f59e0b' : '#ef4444',
              marginBottom: '32px'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isRetrying ? '#f59e0b' : '#ef4444',
                animation: isRetrying ? 'spin 1s linear infinite' : 'pulse 1.5s infinite'
              }} />
              <span>{isRetrying ? 'Attempting Connection...' : 'Offline'}</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={handleTryReconnect}
                disabled={isRetrying}
                className="erp-button-primary"
                style={{
                  width: '100%',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: isRetrying ? 'not-allowed' : 'pointer',
                  opacity: isRetrying ? 0.8 : 1,
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.25)'
                }}
              >
                <RefreshCw size={18} className={isRetrying ? 'animate-spin' : ''} />
                {isRetrying ? 'Verifying Link...' : 'Try Reconnecting'}
              </button>

              <button
                type="button"
                onClick={clearSession}
                className="erp-button-secondary"
                style={{
                  width: '100%',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
              >
                <LogOut size={16} />
                Switch Account / Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Login Views
  if (!token) {
    const isSuperAdminLoginPage = currentPath === '/super-admin';
    return (
      <div className={`app-layout ${isDarkMode ? 'dark-theme' : ''}`} style={{ background: 'var(--bg-app)', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', display: 'flex' }}>
        
        {toast && (
          <div className="toast-in-out" 
            onMouseEnter={pauseToastTimer}
            onMouseLeave={resumeToastTimer}
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 100005,
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
              color: '#ffffff',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="sp-card fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          <LoginForm
            onLoginSuccess={(authData) => {
              setToken(authData.access_token);
              setUsername(authData.email);
              setRole(authData.role);
              setSchoolId(authData.school_id);
              setSetupCompleted(authData.setup_completed);
              setPermissions(authData.permissions);
              setLinkedStudentIds(authData.linked_student_ids);
              setSchoolName(authData.school_name);

              if (authData.role === 'Super Admin') {
                window.history.replaceState({ loggedIn: true, role: 'Super Admin' }, '', '/super-admin');
                setCurrentPath('/super-admin');
                fetchSuperAdminData(authData.access_token, true);
              } else if (authData.role === 'Teacher') {
                window.history.replaceState({ loggedIn: true, role: 'Teacher' }, '', '/dashboard');
                setCurrentPath('/dashboard');
                setActiveTab('teacher_portal');
                fetchTeacherDashboard(authData.email || authData.phone);
              } else if (authData.role === 'Parent') {
                window.history.replaceState({ loggedIn: true, role: 'Parent' }, '', '/dashboard');
                setCurrentPath('/dashboard');
                setActiveTab('parent_portal');
                fetchParentDashboard(authData.email || authData.phone);
              } else {
                if (authData.setup_completed === 0) {
                  window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/setup');
                  setCurrentPath('/setup');
                } else {
                  window.history.replaceState({ loggedIn: true, role: 'School Admin' }, '', '/dashboard');
                  setCurrentPath('/dashboard');
                  fetchSPData(authData.access_token, authData.school_id);
                }
              }
            }}
            isSuperAdminLoginPage={isSuperAdminLoginPage}
            showToast={showToast}
          />
          {isSuperAdminLoginPage && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button
                onClick={() => {
                  window.history.replaceState({}, '', '/login');
                  setCurrentPath('/login');
                  setLoginError('');
                }}
                className="btn-outline"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                Go to School Portal
              </button>
            </div>
          )}
        </div>
        {expiredModalInfo && renderExpiredPopupModal()}
      </div>
    );
  }

  // 3. School Admin First-Login Setup Wizard
  if (role === 'School Admin' && Number(setupCompleted) === 0) {
    return (
      <div className={`app-layout ${isDarkMode ? 'dark-theme' : ''}`} style={{ background: 'var(--bg-app)', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', display: 'flex' }}>
        <div className="sp-card fade-in" style={{ width: '100%', maxWidth: '550px', padding: '40px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Sparkles className="animate-pulse" size={24} style={{ color: 'var(--color-primary)' }} />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>First-Login Setup Wizard</h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>Step {wizardStep} of 5</span>
          </div>

          <form onSubmit={handleWizardSubmit}>
            
            {/* Step 1: School Identity */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Step 1: School Identity</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Enter the official name of the school or college campus to update platform headings.</p>
                <div>
                  <label htmlFor="wizard-name" className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Official School Name</label>
                  <input 
                    id="wizard-name"
                    type="text" 
                    placeholder="e.g. Lincoln High School" 
                    value={wizardForm.name} 
                    onChange={(e) => setWizardForm({ ...wizardForm, name: e.target.value })} 
                    className="sp-input"
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 2: Brand Identity */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Step 2: Brand Identity</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Choose a brand crest or logo representing the academic institution.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {logoChoices.map((choice, i) => (
                    <div 
                      key={i} 
                      onClick={() => setWizardForm({ ...wizardForm, logo_path: choice.url })}
                      style={{
                        padding: '12px',
                        border: '2px solid ' + (wizardForm.logo_path === choice.url ? 'var(--color-primary)' : 'var(--border-color)'),
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: wizardForm.logo_path === choice.url ? 'rgba(59,130,246,0.05)' : 'transparent'
                      }}
                    >
                      <img src={choice.url} alt={choice.name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%', marginBottom: '8px' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>{choice.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Location */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Step 3: Location</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Provide the physical address of the school or college campus.</p>
                <div>
                  <label htmlFor="wizard-address" className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Physical Address</label>
                  <textarea 
                    id="wizard-address"
                    rows="3"
                    placeholder="e.g. 101 Education Way, New York, NY 10001" 
                    value={wizardForm.address} 
                    onChange={(e) => setWizardForm({ ...wizardForm, address: e.target.value })} 
                    className="sp-input"
                    style={{ resize: 'none' }}
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 4: Contact Point */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Step 4: Contact Information</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Provide contact points for administrative settings.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label htmlFor="wizard-person" className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Contact Person Name</label>
                    <input 
                      id="wizard-person"
                      type="text" 
                      placeholder="e.g. Principal John Doe" 
                      value={wizardForm.contact_person} 
                      onChange={(e) => setWizardForm({ ...wizardForm, contact_person: e.target.value })} 
                      className="sp-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="wizard-phone" className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Contact Phone Number</label>
                    <input 
                      id="wizard-phone"
                      type="text" 
                      placeholder="e.g. +1 (555) 019-9988" 
                      value={wizardForm.contact_number} 
                      onChange={(e) => setWizardForm({ ...wizardForm, contact_number: e.target.value })} 
                      className="sp-input"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Review & Initialize */}
            {wizardStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Step 5: Review & Save</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Confirm that the settings are correct before launching the SP portal.</p>
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(2, 6, 23, 0.4)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div><strong>School Name:</strong> {wizardForm.name || 'N/A'}</div>
                  <div><strong>Contact Person:</strong> {wizardForm.contact_person || 'N/A'} ({wizardForm.contact_number})</div>
                  <div><strong>Address:</strong> {wizardForm.address || 'N/A'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <strong>Logo Selected:</strong>
                    <img src={wizardForm.logo_path} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              {wizardStep > 1 ? (
                <button 
                  type="button" 
                  onClick={() => setWizardStep(wizardStep - 1)} 
                  className="btn-outline" 
                  style={{ padding: '8px 16px' }}
                >
                  Back
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={clearSession} 
                  className="btn-outline" 
                  style={{ padding: '8px 16px', color: '#ef4444', borderColor: '#ef4444' }}
                >
                  Cancel
                </button>
              )}

              {wizardStep < 5 ? (
                <button 
                  type="button" 
                  onClick={() => {
                    if (wizardStep === 1 && !wizardForm.name) return alert("School name is required");
                    if (wizardStep === 3 && !wizardForm.address) return alert("Address is required");
                    if (wizardStep === 4) {
                      if (!wizardForm.contact_person || !wizardForm.contact_number) {
                        return alert("Contact information is required");
                      }
                      if (!isValidPhone(wizardForm.contact_number)) {
                        return alert("Phone Number must contain exactly 10 digits.");
                      }
                    }
                    setWizardStep(wizardStep + 1);
                  }}
                  className="btn-primary" 
                  style={{ padding: '8px 20px' }}
                >
                  Continue
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ padding: '8px 20px' }}
                  disabled={loading}
                >
                  {loading ? 'Initializing SP...' : 'Finish Setup & Launch'}
                </button>
              )}
            </div>
          </form>

        </div>
      </div>
    );
  }

  // --- ADMIN PROFILE ACTIONS ---

  const saveProfilePhoto = async (photoBase64) => {
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = {
        ...adminProfile,
        profile_image: photoBase64
      };
      setAdminProfile(updated);
      localStorage.setItem(`bn_sandbox_profile_${keySuffix}`, JSON.stringify(updated));
      showToast('Profile photo updated (Sandbox)', 'success');
      return;
    }
    
    try {
      const formPayload = {
        name: adminProfile?.name || 'Administrator',
        email: adminProfile?.email || username,
        phone: adminProfile?.phone || '',
        address: adminProfile?.address || '',
        city: adminProfile?.city || '',
        state: adminProfile?.state || '',
        country: adminProfile?.country || '',
        timezone: adminProfile?.timezone || 'Asia/Kolkata',
        profile_image: photoBase64
      };
      
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(formPayload)
      });
      if (res.ok) {
        setAdminProfile(prev => ({ ...prev, profile_image: photoBase64 }));
        showToast('Profile photo updated', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating profile photo', 'error');
    }
  };

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds 2MB limit.");
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAdminProfileForm(prev => ({ ...prev, profile_image: reader.result }));
      saveProfilePhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProfilePhoto = () => {
    saveProfilePhoto(null);
    setAdminProfileForm(prev => ({ ...prev, profile_image: null }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!adminProfileForm.name) errors.name = "Full Name is required.";
    if (!adminProfileForm.email) {
      errors.email = "Email Address is required.";
    } else if (!isValidEmail(adminProfileForm.email)) {
      errors.email = "Please enter a valid email address.";
    }
    if (adminProfileForm.phone) {
      if (!/^\d{10}$/.test(adminProfileForm.phone)) {
        errors.phone = "Phone Number must contain exactly 10 digits.";
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }
    
    setProfileErrors({});
    setIsSavingProfile(true);
    
    const keySuffix = schoolId || 'default';
    if (token.includes('mock') || !isConnected) {
      const updated = {
        ...adminProfile,
        ...adminProfileForm
      };
      setAdminProfile(updated);
      localStorage.setItem(`bn_sandbox_profile_${keySuffix}`, JSON.stringify(updated));
      setIsSavingProfile(false);
      showToast('Profile updated (Sandbox Mode)', 'success');
      setProfileSubTab('details');
      return;
    }
    
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(adminProfileForm)
      });
      if (res.ok) {
        const resProf = await fetch('/api/profile', { headers: getHeaders() });
        if (resProf.ok) {
          const prof = await resProf.json();
          setAdminProfile(prof);
          if (username === prof.email) {
            setUsername(prof.email);
          }
        }
        showToast('Profile updated successfully', 'success');
        setProfileSubTab('details');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    
    const errors = {};
    if (!passwordForm.current_password) errors.current_password = "Current Password is required.";
    
    const np = passwordForm.new_password;
    if (!np) {
      errors.new_password = "New Password is required.";
    } else {
      if (np.length < 8) {
        errors.new_password = "Must be at least 8 characters long.";
      } else if (!/[A-Z]/.test(np)) {
        errors.new_password = "Must contain at least one uppercase letter.";
      } else if (!/[a-z]/.test(np)) {
        errors.new_password = "Must contain at least one lowercase letter.";
      } else if (!/[0-9]/.test(np)) {
        errors.new_password = "Must contain at least one number.";
      } else if (!/[!@#$%^&*()_+={}\[\]|\\\\:;\"\'<>,.?\/~`\-]/.test(np)) {
        errors.new_password = "Must contain at least one special character.";
      }
    }
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      errors.confirm_password = "Passwords do not match.";
    }
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    setPasswordErrors({});
    setIsSavingPassword(true);
    
    if (token.includes('mock') || !isConnected) {
      setIsSavingPassword(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      showToast('Password updated (Sandbox Mode)', 'success');
      setProfileSubTab('details');
      return;
    }
    
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          current_password: sha256Sync(passwordForm.current_password),
          new_password: sha256Sync(passwordForm.new_password),
          confirm_password: sha256Sync(passwordForm.confirm_password)
        })
      });
      if (res.ok) {
        showToast('Password changed successfully!', 'success');
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
        setProfileSubTab('details');
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update password.');
      }
    } catch (err) {
      console.error(err);
      showToast('Error changing password', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // --- Student Performance Sub-modules Rendering ---

  const renderStudentPerformanceTab = () => {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={22} className="gradient-text" /> Student Performance & Academics
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
              Manage student attendance, examine class grades, entry marks, and generate report cards.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setPerformanceSubTab('attendance')}
              className={performanceSubTab === 'attendance' ? 'btn-primary' : 'btn-outline'}
              style={{ border: 'none', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              Attendance
            </button>
            <button
              type="button"
              onClick={() => {
                setPerformanceSubTab('exams');
                fetchExams(activeYearId);
              }}
              className={performanceSubTab === 'exams' ? 'btn-primary' : 'btn-outline'}
              style={{ border: 'none', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              Examinations
            </button>
            <button
              type="button"
              onClick={() => {
                setPerformanceSubTab('report_cards');
              }}
              className={performanceSubTab === 'report_cards' ? 'btn-primary' : 'btn-outline'}
              style={{ border: 'none', padding: '6px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
            >
              Examination Reports
            </button>
          </div>
        </div>

        {performanceSubTab === 'attendance' && (
          <AttendanceTracker
            token={token}
            schoolId={schoolId}
            activeYearId={activeYearId}
            classes={classes}
            students={students}
            isConnected={isConnected}
            showToast={showToast}
            years={years}
            leavesList={leavesList}
            isFetchingLeaves={isFetchingLeaves}
            isSavingLeave={isSavingLeave}
            fetchLeaves={fetchLeaves}
            saveLeave={saveLeave}
            deleteLeave={deleteLeave}
            editLeave={editLeave}
            role={role}
          />
        )}
        {performanceSubTab === 'exams' && (
          <GradingPanel
            token={token}
            schoolId={schoolId}
            activeYearId={activeYearId}
            classes={classes}
            students={students}
            isConnected={isConnected}
            showToast={showToast}
            isCurrentYearActive={isCurrentYearActive}
            role={role}
            examsList={examsList}
            isFetchingExams={isFetchingExams}
            saveExam={(ayId, payload) => saveExam(payload)}
            deleteExam={deleteExam}
            updateExam={(examId, ayId, payload) => saveExam(payload, examId)}
            fetchExams={fetchExams}
            gradingScales={gradingScales}
            saveGradingScales={saveGradingScales}
            fetchGradingScales={fetchGradingScales}
            schoolSignatures={schoolSignatures}
            saveSchoolSignatures={saveSchoolSignatures}
            fetchSchoolSignatures={fetchSchoolSignatures}
            initialSubSubTab="management"
          />
        )}
        {performanceSubTab === 'report_cards' && (
          <GradingPanel
            token={token}
            schoolId={schoolId}
            activeYearId={activeYearId}
            classes={classes}
            students={students}
            isConnected={isConnected}
            showToast={showToast}
            isCurrentYearActive={isCurrentYearActive}
            role={role}
            examsList={examsList}
            isFetchingExams={isFetchingExams}
            saveExam={(ayId, payload) => saveExam(payload)}
            deleteExam={deleteExam}
            updateExam={(examId, ayId, payload) => saveExam(payload, examId)}
            fetchExams={fetchExams}
            gradingScales={gradingScales}
            saveGradingScales={saveGradingScales}
            fetchGradingScales={fetchGradingScales}
            schoolSignatures={schoolSignatures}
            saveSchoolSignatures={saveSchoolSignatures}
            fetchSchoolSignatures={fetchSchoolSignatures}
            initialSubSubTab="report_cards"
          />
        )}
      </div>
    );
  };

  const renderAdminProfileTab = () => {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={22} className="gradient-text" /> Admin Profile Management
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', alignItems: 'flex-start' }}>
          {/* Left Card: Avatar & Brief Info */}
          <div className="sp-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              {adminProfile?.role === 'School Admin' && adminProfile?.school_logo_path ? (
                <div style={{ width: '120px', height: '120px', borderRadius: '16px', overflow: 'hidden', border: '3px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', padding: '8px' }}>
                  <img 
                    src={adminProfile.school_logo_path} 
                    alt="School Logo" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                  />
                </div>
              ) : adminProfileForm.profile_image ? (
                <img 
                  src={adminProfileForm.profile_image} 
                  alt="Profile Avatar" 
                  style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-primary)' }} 
                />
              ) : (
                <div style={{ 
                  width: '120px', 
                  height: '120px', 
                  borderRadius: '50%', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '3px solid var(--border-color)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <User size={64} />
                </div>
              )}
            </div>
            
            {/* Photo Actions */}
            {adminProfile?.role !== 'School Admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    className="btn-outline" 
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={() => document.getElementById('admin-avatar-upload').click()}
                  >
                    Upload Photo
                  </button>
                  <input 
                    id="admin-avatar-upload" 
                    type="file" 
                    accept="image/png, image/jpeg, image/jpg" 
                    style={{ display: 'none' }} 
                    onChange={handleProfilePhotoChange} 
                  />
                  {adminProfileForm.profile_image && (
                    <button 
                      type="button" 
                      className="btn-outline" 
                      style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#ef4444', color: '#ef4444' }}
                      onClick={handleRemoveProfilePhoto}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max file size: 2MB (PNG/JPG)</span>
              </div>
            )}

            <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '1.1rem', margin: 0 }}>
                {adminProfile?.role === 'School Admin' ? (adminProfile?.school_name || 'School Admin') : (adminProfile?.name || 'Administrator')}
              </h4>
              <span className="badge badge-success" style={{ marginTop: '8px' }}>
                {adminProfile?.role === 'Super Admin' ? 'Super Admin' : 'School Admin'}
              </span>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Clock size={12} /> {adminProfile?.timezone || 'Asia/Kolkata'}
              </p>
            </div>
          </div>

          {/* Right Card: Tab views */}
          <div className="sp-card" style={{ padding: '0', overflow: 'hidden' }}>
            {/* Sub-tabs header */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', padding: '0 16px' }}>
              <button 
                type="button"
                className={`profile-tab ${profileSubTab === 'details' ? 'active' : ''}`}
                onClick={() => setProfileSubTab('details')}
              >
                Profile Details
              </button>
              {adminProfile?.role !== 'School Admin' && (
                <button 
                  type="button"
                  className={`profile-tab ${profileSubTab === 'edit' ? 'active' : ''}`}
                  onClick={() => {
                    setProfileSubTab('edit');
                    setAdminProfileForm({
                      name: adminProfile?.name || '',
                      email: adminProfile?.email || '',
                      phone: adminProfile?.phone || '',
                      address: adminProfile?.address || '',
                      city: adminProfile?.city || '',
                      state: adminProfile?.state || '',
                      country: adminProfile?.country || '',
                      timezone: adminProfile?.timezone || 'Asia/Kolkata',
                      profile_image: adminProfile?.profile_image || ''
                    });
                    setProfileErrors({});
                  }}
                >
                  Edit Profile
                </button>
              )}
              <button 
                type="button"
                className={`profile-tab ${profileSubTab === 'password' ? 'active' : ''}`}
                onClick={() => {
                  setProfileSubTab('password');
                  setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                  setPasswordErrors({});
                }}
              >
                Change Password
              </button>
              {adminProfile?.role === 'School Admin' && (
                <button 
                  type="button"
                  className={`profile-tab ${profileSubTab === 'subscription' ? 'active' : ''}`}
                  onClick={() => setProfileSubTab('subscription')}
                >
                  Subscription Details
                </button>
              )}
            </div>

            {/* Sub-tab content body */}
            <div style={{ padding: '24px' }}>
              {profileSubTab === 'details' && (
                adminProfile?.role === 'School Admin' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Warning Alert Note */}
                    <div style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start'
                    }}>
                      <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 600, color: '#ef4444' }}>Profile Edit Restricted</h5>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          These profile settings are managed by the platform administration. Please reach out to support at <strong>{adminProfile?.school_email || 'xavier.admin@xavier.edu'}</strong> or contact system administration to request any updates.
                        </p>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Profile Details</h4>
                    <div className="profile-detail-grid">
                      {adminProfile?.school_name && (
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Official School Name</span>
                          <span className="profile-detail-value">{adminProfile.school_name}</span>
                        </div>
                      )}
                      {adminProfile?.school_contact_person && (
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Contact Person</span>
                          <span className="profile-detail-value">{adminProfile.school_contact_person}</span>
                        </div>
                      )}
                      {adminProfile?.school_phone && (
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Contact Number</span>
                          <span className="profile-detail-value">{adminProfile.school_phone}</span>
                        </div>
                      )}
                      {adminProfile?.school_email && (
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Email Address</span>
                          <span className="profile-detail-value">{adminProfile.school_email}</span>
                        </div>
                      )}
                      {([adminProfile?.school_address, adminProfile?.school_city, adminProfile?.school_state, adminProfile?.school_country].filter(Boolean).join(', ') || adminProfile?.school_address) && (
                        <div className="profile-detail-item" style={{ gridColumn: 'span 2' }}>
                          <span className="profile-detail-label">Physical Address</span>
                          <span className="profile-detail-value">
                            {[adminProfile?.school_address, adminProfile?.school_city, adminProfile?.school_state, adminProfile?.school_country].filter(Boolean).join(', ') || adminProfile?.school_address}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Personal Information</h4>
                    <div className="profile-detail-grid">
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Full Name</span>
                        <span className="profile-detail-value">{adminProfile?.name || 'N/A'}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Email Address</span>
                        <span className="profile-detail-value">{adminProfile?.email || 'N/A'}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Phone Number</span>
                        <span className="profile-detail-value">{adminProfile?.phone || 'N/A'}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Designation</span>
                        <span className="profile-detail-value">{adminProfile?.role === 'Super Admin' ? 'Super Admin' : 'Administrator'}</span>
                      </div>
                      <div className="profile-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="profile-detail-label">Address</span>
                        <span className="profile-detail-value">
                          {[adminProfile?.address, adminProfile?.city, adminProfile?.state, adminProfile?.country].filter(Boolean).join(', ') || 'N/A'}
                        </span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Time Zone</span>
                        <span className="profile-detail-value">{adminProfile?.timezone || 'Asia/Kolkata'}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Account Created</span>
                        <span className="profile-detail-value">{adminProfile?.created_at || 'N/A'}</span>
                      </div>
                      <div className="profile-detail-item">
                        <span className="profile-detail-label">Last Login Date</span>
                        <span className="profile-detail-value">{adminProfile?.last_login_at || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {profileSubTab === 'edit' && adminProfile?.role !== 'School Admin' && (
                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="form-label">Full Name *</label>
                      <input 
                        type="text" 
                        className="sp-input" 
                        value={adminProfileForm.name} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, name: e.target.value })}
                      />
                      {profileErrors.name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{profileErrors.name}</div>}
                    </div>
                    <div>
                      <label className="form-label">Email Address *</label>
                      <input 
                        type="email" 
                        className="sp-input" 
                        value={adminProfileForm.email} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, email: e.target.value })}
                      />
                      {profileErrors.email && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{profileErrors.email}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label className="form-label">Phone Number</label>
                      <input 
                        type="text" 
                        className="sp-input" 
                        placeholder="e.g. 9876543210" 
                        value={adminProfileForm.phone || ''} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, phone: e.target.value })}
                      />
                      {profileErrors.phone && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{profileErrors.phone}</div>}
                    </div>
                    <div>
                      <label className="form-label">Time Zone</label>
                      <select 
                        className="sp-input" 
                        value={adminProfileForm.timezone} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, timezone: e.target.value })}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="UTC">UTC (GMT)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="Europe/London">Europe/London (BST/GMT)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Home Address</label>
                    <textarea 
                      className="sp-input" 
                      rows={2} 
                      style={{ resize: 'vertical' }}
                      value={adminProfileForm.address || ''} 
                      onChange={(e) => setAdminProfileForm({ ...adminProfileForm, address: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label">City</label>
                      <input 
                        type="text" 
                        className="sp-input" 
                        value={adminProfileForm.city || ''} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, city: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">State</label>
                      <input 
                        type="text" 
                        className="sp-input" 
                        value={adminProfileForm.state || ''} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, state: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label">Country</label>
                      <input 
                        type="text" 
                        className="sp-input" 
                        value={adminProfileForm.country || ''} 
                        onChange={(e) => setAdminProfileForm({ ...adminProfileForm, country: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button 
                      type="button" 
                      className="btn-outline" 
                      onClick={() => setProfileSubTab('details')}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Profile Details'}
                    </button>
                  </div>
                </form>
              )}

              {profileSubTab === 'password' && (
                <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="form-label">Current Password *</label>
                    <input 
                      type="password" 
                      className="sp-input" 
                      value={passwordForm.current_password} 
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    />
                    {passwordErrors.current_password && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{passwordErrors.current_password}</div>}
                  </div>

                  <div>
                    <label className="form-label">New Password *</label>
                    <input 
                      type="password" 
                      className="sp-input" 
                      value={passwordForm.new_password} 
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    />
                    {passwordErrors.new_password && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{passwordErrors.new_password}</div>}
                    
                    {/* Visual Password Strength Checklist */}
                    <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password complexity requirements:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: passwordForm.new_password.length >= 8 ? '#10b981' : 'var(--text-muted)' }}>
                          <Check size={10} /> Min. 8 characters
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: /[A-Z]/.test(passwordForm.new_password) ? '#10b981' : 'var(--text-muted)' }}>
                          <Check size={10} /> 1 uppercase letter
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: /[a-z]/.test(passwordForm.new_password) ? '#10b981' : 'var(--text-muted)' }}>
                          <Check size={10} /> 1 lowercase letter
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: /[0-9]/.test(passwordForm.new_password) ? '#10b981' : 'var(--text-muted)' }}>
                          <Check size={10} /> 1 number digit
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: /[!@#$%^&*()_+={}\[\]|\\\\:;\"\'<>,.?\/~`\-]/.test(passwordForm.new_password) ? '#10b981' : 'var(--text-muted)' }}>
                          <Check size={10} /> 1 special character
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Confirm New Password *</label>
                    <input 
                      type="password" 
                      className="sp-input" 
                      value={passwordForm.confirm_password} 
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    />
                    {passwordErrors.confirm_password && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{passwordErrors.confirm_password}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button 
                      type="button" 
                      className="btn-outline" 
                      onClick={() => setProfileSubTab('details')}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={isSavingPassword}
                    >
                      {isSavingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}

              {profileSubTab === 'subscription' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Current Subscription Status</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Details and validity of your platform license plan.</p>
                    </div>
                    <span className="badge" style={{
                      backgroundColor: adminProfile.subscription?.status === 'Active' || adminProfile.subscription?.status === 'Trial Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: adminProfile.subscription?.status === 'Active' || adminProfile.subscription?.status === 'Trial Active' ? '#10b981' : '#ef4444',
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}>
                      {adminProfile.subscription?.status || 'No Active License'}
                    </span>
                  </div>

                  {/* Subscription card details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="profile-detail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Active License Plan</span>
                          <span className="profile-detail-value" style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{adminProfile.subscription?.plan_name || 'None'}</span>
                        </div>
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Days Remaining</span>
                          <span className="profile-detail-value" style={{ fontWeight: 800, color: adminProfile.subscription?.remaining_days < 15 ? '#ef4444' : '#10b981' }}>
                            {adminProfile.subscription?.remaining_days !== undefined && adminProfile.subscription?.remaining_days !== null ? `${adminProfile.subscription.remaining_days} Days` : '-'}
                          </span>
                        </div>
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">Activation Date</span>
                          <span className="profile-detail-value">{adminProfile.subscription?.start_date || '-'}</span>
                        </div>
                        <div className="profile-detail-item">
                          <span className="profile-detail-label">License Expiration</span>
                          <span className="profile-detail-value">{adminProfile.subscription?.expiry_date || '-'}</span>
                        </div>
                      </div>
                      
                      {/* Inquiry Contact Section */}
                      <div style={{ 
                        marginTop: '20px', 
                        padding: '20px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '12px', 
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.15)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        {/* Decorative glowing background accent */}
                        <div style={{
                          position: 'absolute',
                          top: '-20px',
                          right: '-20px',
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
                          opacity: 0.15,
                          pointerEvents: 'none'
                        }} />

                        <h5 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                          <span style={{ fontSize: '1.1rem' }}>💬</span> Need Assistance?
                        </h5>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                          For subscription upgrades, renewals, account-related queries, or platform support, please contact:
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px', 
                            padding: '10px 14px', 
                            borderRadius: '8px', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            transition: 'all 0.2s ease'
                          }}
                          className="hover-scale-subtle"
                          >
                            <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>📧</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</span>
                              <a 
                                href="mailto:bilalnashi6@gmail.com" 
                                style={{ 
                                  fontSize: '0.85rem', 
                                  color: 'var(--color-primary)', 
                                  textDecoration: 'none', 
                                  fontWeight: 700,
                                  transition: 'color 0.2s ease'
                                }}
                              >
                                bilalnashi6@gmail.com
                              </a>
                            </div>
                          </div>

                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px', 
                            padding: '10px 14px', 
                            borderRadius: '8px', 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            transition: 'all 0.2s ease'
                          }}
                          className="hover-scale-subtle"
                          >
                            <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>📞</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Number</span>
                              <a 
                                href="tel:8650302499" 
                                style={{ 
                                  fontSize: '0.85rem', 
                                  color: 'var(--color-primary)', 
                                  textDecoration: 'none', 
                                  fontWeight: 700,
                                  transition: 'color 0.2s ease'
                                }}
                              >
                                8650302499
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                      <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Platform Subscription Pricing</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {activePlans.length === 0 ? (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading plan options...</p>
                        ) : (
                          activePlans.map(plan => (
                            <div key={plan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{plan.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration: {plan.duration_days} Days</div>
                              </div>
                              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                                {parseFloat(plan.price) === 0 ? 'Free' : `₹${parseFloat(plan.price).toLocaleString()}`}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 4. Platform Portal Views
  if (role === 'Super Admin') {
    return (
      <>
        <PlatformDashboard
          token={token}
          adminProfile={adminProfile}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          onLogout={() => setShowLogoutConfirm(true)}
        />
        {showLogoutConfirm && (
          <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  marginBottom: '8px'
                }}>
                  <LogOut size={32} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Confirm Sign Out</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                  Are you sure you want to signout?
                </p>
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                  <button 
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      handleLogout();
                    }}
                    className="btn-primary"
                    style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
                  >
                    Yes
                  </button>
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="btn-outline"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // 5. School Admin Portal (Standard SP View)
  const isSubscriptionExpired = adminProfile && adminProfile.subscription &&
    (adminProfile.subscription.status === 'Expired' || 
     adminProfile.subscription.status === 'Trial Expired' || 
     (adminProfile.subscription.remaining_days !== null && adminProfile.subscription.remaining_days <= 0)) &&
    role !== 'Super Admin';

  if (isSubscriptionExpired) {
    return (
      <div className={`app-layout ${isDarkMode ? 'dark-theme' : ''}`} style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDarkMode ? 'radial-gradient(circle at top, #1e1b4b 0%, #090d16 100%)' : 'radial-gradient(circle at top, #f3f4f6 0%, #e5e7eb 100%)',
        padding: '40px 20px'
      }}>
        <div style={{
          maxWidth: '800px',
          width: '100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '28px',
          textAlign: 'center'
        }}>
          {/* Logo or Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <Lock size={40} />
          </div>

          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Access Suspended</h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.6' }}>
              The subscription license for <strong>{adminProfile.school_name || 'your school'}</strong> has expired. To restore access for all administrators, teachers, and students, please renew the license subscription.
            </p>
          </div>

          {/* Pricing cards */}
          <div style={{ width: '100%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)' }}>Available Subscription Plans</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: activePlans.length === 0 ? '1fr' : `repeat(${Math.min(activePlans.length, 3)}, 1fr)`,
              gap: '20px',
              width: '100%'
            }}>
              {activePlans.length === 0 ? (
                <div style={{ padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                  No plans are currently available for online renewal. Please contact the platform administration.
                </div>
              ) : (
                activePlans.map(plan => (
                  <div key={plan.id} style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    transition: 'transform 0.2s',
                    cursor: 'default'
                  }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>{plan.name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', minHeight: '36px' }}>{plan.description || 'Access all premium platform modules.'}</p>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {parseFloat(plan.price) === 0 ? 'Free' : `₹${parseFloat(plan.price).toLocaleString()}`}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Duration: {plan.duration_days} Days</span>
                    </div>

                    <a 
                      href={`mailto:bilalnashi6@gmail.com?subject=Subscription%20Renewal%20Inquiry%20-%20${encodeURIComponent(adminProfile.school_name || '')}&body=Hello%20Super%20Admin,%0A%0AOur%20subscription%20has%20expired%20and%20we%20wish%20to%20purchase/activate%20the%20following%20plan:%0A%0APlan%20Name:%20${encodeURIComponent(plan.name)}%0APrice:%20%E2%82%B9${parseFloat(plan.price).toLocaleString()}%0ADuration:%20${plan.duration_days}%20Days%0A%0APlease%20let%20us%20know%20the%20payment%20steps.%0A%0AThanks!`}
                      className="btn-primary"
                      style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '0.85rem', width: '100%', padding: '10px 0' }}
                    >
                      Inquire Plan
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Support Inquiry</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>bilalnashi6@gmail.com</div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={async () => {
                  try {
                    await fetchProfileData();
                    showToast('Subscription status updated successfully.', 'success');
                  } catch (e) {
                    showToast('Failed to fetch subscription status.', 'error');
                  }
                }} 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              >
                <RefreshCw size={16} /> Check Subscription Status
              </button>
              <button 
                onClick={() => handleLogout()} 
                className="btn-outline" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentTeacherProfile = teachers.find(t => t.phone === username || t.email === username);
  const visibleClasses = role === 'Teacher' 
    ? classes.filter(c => Number(c.class_teacher_id) === Number(currentTeacherProfile?.id)) 
    : classes;

  const activeStudent = selectedStudent ? (students.find(s => s.id === selectedStudent.id) || selectedStudent) : null;
  const hasPlannerPeriods = Object.values(scheduleForm).some(periods => Array.isArray(periods) && periods.length > 0);
  const hasPlannerPendingSelection = Object.keys(scheduleForm).some(day => 
    (selectedDaySubject[day] && selectedDaySubject[day] !== '') || 
    (selectedDayTeacher[day] && selectedDayTeacher[day] !== '')
  );
  const isPlannerButtonsDisabled = isSavingSchedule || !plannerClassId || !isCurrentYearActive() || !hasPlannerPeriods || hasPlannerPendingSelection;

  return (
    <div className={`app-layout ${isDarkMode ? 'dark-theme' : ''}`}>
      
      {(isLoggingOut || loading) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: isDarkMode ? 'rgba(9, 13, 22, 0.85)' : 'rgba(248, 250, 252, 0.85)',
          backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-primary)', pointerEvents: 'all'
        }} onClick={(e) => e.stopPropagation()}>
          <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {isLoggingOut ? 'Logging Out' : 'Please wait...'}
          </span>
        </div>
      )}
      
      {toast && (
        <div className="toast-in-out" 
          onMouseEnter={pauseToastTimer}
          onMouseLeave={resumeToastTimer}
          style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 100005, padding: '16px 20px', borderRadius: 'var(--radius-md)',
            backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', fontWeight: 600
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', padding: '0 8px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
            padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <GraduationCap size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
              {schoolName || 'BN School'}
            </h1>
          </div>
        </div>

        <div className="sidebar-nav">
          <button 
            id="nav-btn-dashboard" 
            onClick={() => { 
              setActiveTab('dashboard'); 
              setSelectedClassId(null); 
              setSelectedTeacher(null); 
              setSelectedStudent(null); 
              window.scrollTo(0, 0);
              const wrapper = document.querySelector('.main-wrapper');
              if (wrapper) {
                wrapper.scrollTop = 0;
              }
            }} 
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <Activity size={18} /> Dashboard
          </button>
          
          {hasPermission('administration') && (
            <button id="nav-btn-faculty" onClick={() => { setActiveTab('faculty'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'faculty' ? 'active' : ''}`}>
              <Users size={18} /> Teachers
            </button>
          )}
          {(hasPermission('attendance') || hasPermission('performance') || hasPermission('planner')) && (
            <button id="nav-btn-students" onClick={() => { setActiveTab('students'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'students' ? 'active' : ''}`}>
              <GraduationCap size={18} /> Classes
            </button>
          )}
          {hasPermission('planner') && (
            <button id="nav-btn-planner" onClick={() => { setActiveTab('planner'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'planner' ? 'active' : ''}`}>
              <Calendar size={18} /> Academic Planner
            </button>
          )}
          {(hasPermission('finance') || role === 'Teacher') && (
            <button id="nav-btn-fees" onClick={() => { setActiveTab('fees'); setSelectedFeesClassId(null); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'fees' ? 'active' : ''}`}>
              <DollarSign size={18} /> Fees Portal
            </button>
          )}

          {hasPermission('reports') && (
            <button id="nav-btn-financial" onClick={() => { setActiveTab('financial'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'financial' ? 'active' : ''}`}>
              <FileSpreadsheet size={18} /> Financial Reports
            </button>
          )}
          {(hasPermission('finance') || role === 'Teacher') && (
            <button id="nav-btn-finance-management" onClick={() => { setActiveTab('finance_management'); setFinanceManagementSubTab(role === 'Teacher' ? 'recoveries' : 'fees'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'finance_management' ? 'active' : ''}`}>
              <Briefcase size={18} /> Finance Management
            </button>
          )}
          {(hasPermission('attendance') || hasPermission('performance')) && (
            <button id="nav-btn-performance" onClick={() => { setActiveTab('performance'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'performance' ? 'active' : ''}`}>
              <BookOpen size={18} /> Student Performance
            </button>
          )}
          {hasPermission('administration') && (
            <button id="nav-btn-settings" onClick={() => { setActiveTab('settings'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}>
              <Shield size={18} /> Audits & Settings
            </button>
          )}
        </div>

        <div 
          onClick={() => { setActiveTab('profile'); setSelectedClassId(null); setSelectedTeacher(null); setSelectedStudent(null); }} 
          className={`sidebar-profile ${activeTab === 'profile' ? 'active' : ''}`}
        >
          {adminProfile?.profile_image ? (
            <img 
              src={adminProfile?.profile_image} 
              alt="Admin Avatar" 
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} 
            />
          ) : (
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              background: 'rgba(255, 255, 255, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              <User size={18} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {adminProfile?.name || 'School Admin'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Administrator
            </span>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        
        {adminProfile && adminProfile.role === 'School Admin' && adminProfile.subscription && adminProfile.subscription.remaining_days !== null && adminProfile.subscription.remaining_days < 15 && adminProfile.subscription.remaining_days >= 0 && (
          <div style={{
            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            padding: '10px 24px',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: 10,
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} />
              <span>
                Your school subscription is expiring in <strong>{adminProfile.subscription.remaining_days} days</strong> ({adminProfile.subscription.expiry_date}). Please contact the Super Admin or renew to avoid access interruption.
              </span>
            </div>
            <button 
              onClick={() => setActiveTab('profile')} 
              style={{
                background: 'white',
                color: '#d97706',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Renew Subscription
            </button>
          </div>
        )}

        {activeTab === 'faculty' && !selectedTeacher ? (
          <header className="faculty-sticky-header" style={{
            position: 'sticky',
            top: 0,
            zIndex: 120,
            backgroundColor: 'var(--bg-surface)',
            opacity: 1,
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 32px',
            gap: '16px',
            flexShrink: 0,
            height: 'auto',
            minHeight: '140px',
            justifyContent: 'flex-start',
            alignItems: 'stretch'
          }}>
            {/* Row 1: Academic Year & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* Academic Year Selector */}
                {years.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Academic Year:</span>
                    <select 
                      id="academic-year-select"
                      value={activeYearId} 
                      onChange={(e) => {
                        const newId = parseInt(e.target.value);
                        setActiveYearId(newId);
                        localStorage.setItem('bn_active_year_id', newId);
                        setSelectedClassId(null);
                        setSelectedStudent(null);
                      }} 
                      className="sp-input" 
                      style={{ width: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      {years.map(y => (
                        <option key={y.id} value={y.id}>{y.year_range} ({y.status || (y.is_active ? 'Active' : 'Archived')})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Theme Toggle */}
                <button 
                  id="theme-toggle"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '50%' }}
                  className="menu-dot-trigger"
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                {/* Notification trigger */}
                <div style={{ position: 'relative' }}>
                  <button 
                    id="notification-trigger"
                    onClick={async () => {
                      const next = !showNotificationDrawer;
                      setShowNotificationDrawer(next);
                      if (next) {
                        await fetchNotifications();
                        await markNotificationsAsRead();
                      }
                    }}
                    className="menu-dot-trigger"
                    style={{ padding: '8px', position: 'relative' }}
                  >
                    <Bell size={18} />
                    {notifications.filter(n => !n.is_read).length > 0 && (
                      <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                    )}
                  </button>
                  
                  {showNotificationDrawer && (
                    <div className="menu-dropdown notification-drawer-content" style={{ width: '300px', right: 0, padding: '12px' }}>
                      <h4 style={{ fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>Notifications</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No new notifications</div>
                        ) : (
                          [...notifications]
                            .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
                            .slice(0, 5)
                            .map(n => (
                              <div key={n.id} style={{ fontSize: '0.75rem', padding: '8px', borderRadius: '4px', backgroundColor: n.is_read ? 'transparent' : 'rgba(59,130,246,0.05)', borderLeft: '3px solid var(--color-primary)' }}>
                                <strong style={{ display: 'block' }}>{n.title}</strong>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '2px', marginBottom: '4px' }}>{n.content}</p>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                  {formatNotificationTime(n.created_at || n.timestamp)}
                                </span>
                              </div>
                            ))
                        )}
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px', textAlign: 'center' }}>
                        <button 
                          onClick={() => {
                            setShowNotificationDrawer(false);
                            setShowAllNotificationsModal(true);
                          }}
                          className="btn-link"
                          style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                        >
                          View All
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)' }} />
                
                <button id="btn-logout" onClick={() => setShowLogoutConfirm(true)} className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={isLoggingOut}>
                  Sign Out
                </button>
              </div>
            </div>

            {/* Row 2: Search, Filters, Add Teacher button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              width: '100%',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    id="search-teacher-name"
                    type="text"
                    placeholder="Search teachers by name..."
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    className="sp-input"
                    style={{ width: '220px', paddingLeft: '36px', paddingRight: teacherSearchQuery ? '32px' : '12px', height: '38px', fontSize: '0.85rem' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  {teacherSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTeacherSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
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
                <select 
                  id="filter-teacher-subject"
                  value={subjectFilter} 
                  onChange={(e) => setSubjectFilter(e.target.value)} 
                  className="sp-input" 
                  style={{ width: '160px' }}
                >
                  <option value="all">All Subjects</option>
                  {Array.from(new Set(teachers.map(t => t.subject).filter(Boolean)))
                    .sort((a, b) => a.localeCompare(b))
                    .map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))
                  }
                </select>

                <select 
                  id="filter-teacher-status"
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="sp-input" 
                  style={{ width: '140px' }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Check Availability Date:</span>
                  <input 
                    id="filter-teacher-availability-date"
                    type="date"
                    value={facultySelectedDate}
                    onChange={(e) => handleFacultyDateChange(e.target.value)}
                    className="sp-input"
                    style={{ width: '150px', padding: '6px 12px' }}
                  />
                  {facultySelectedDate !== getTodayDateStr() && (
                    <button
                      id="btn-reset-faculty-date"
                      type="button"
                      onClick={() => handleFacultyDateChange(getTodayDateStr())}
                      className="btn-outline"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      Reset to Today
                    </button>
                  )}
                </div>
              </div>

              {isCurrentYearActive() && (
                <button 
                  id="btn-add-teacher" 
                  onClick={() => {
                    setEditingTeacher(null);
                    setTForm({ name: '', subject: '', phone: '', email: '', qualification: '', experience: '', address: '', joining_date: new Date().toISOString().split('T')[0], exit_date: '', salary_amount: 3000.0, assigned_classes: '', gender: 'Male', aadhaar_number: '', pan_number: '', profile_image: '', documents: [] });
                    setShowAddTeacherModal(true);
                  }} 
                  className="btn-primary"
                >
                  <Plus size={16} /> Add Teacher
                </button>
              )}
            </div>
          </header>
        ) : (
          <header className="header" style={{ position: 'sticky', top: 0, zIndex: 120, backgroundColor: 'var(--bg-surface)', opacity: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* Academic Year Selector */}
              {years.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Academic Year:</span>
                  <select 
                    id="academic-year-select"
                    value={activeYearId} 
                    onChange={(e) => {
                      const newId = parseInt(e.target.value);
                      setActiveYearId(newId);
                      localStorage.setItem('bn_active_year_id', newId);
                      setSelectedClassId(null);
                      setSelectedStudent(null);
                    }} 
                    className="sp-input" 
                    style={{ width: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    {years.map(y => (
                      <option key={y.id} value={y.id}>{y.year_range} ({y.status || (y.is_active ? 'Active' : 'Archived')})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Theme Toggle */}
              <button 
                id="theme-toggle"
                onClick={() => setIsDarkMode(!isDarkMode)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '50%' }}
                className="menu-dot-trigger"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {/* Notification trigger */}
              <div style={{ position: 'relative' }}>
                 <button 
                   id="notification-trigger"
                   onClick={async () => {
                     const next = !showNotificationDrawer;
                     setShowNotificationDrawer(next);
                     if (next) {
                       await fetchNotifications();
                       await markNotificationsAsRead();
                     }
                   }}
                   className="menu-dot-trigger"
                   style={{ padding: '8px', position: 'relative' }}
                 >
                   <Bell size={18} />
                   {notifications.filter(n => !n.is_read).length > 0 && (
                     <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                   )}
                 </button>
                 
                 {showNotificationDrawer && (
                   <div className="menu-dropdown notification-drawer-content" style={{ width: '300px', right: 0, padding: '12px' }}>
                     <h4 style={{ fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>Notifications</h4>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                       {notifications.length === 0 ? (
                         <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>No new notifications</div>
                       ) : (
                         [...notifications]
                           .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
                           .slice(0, 5)
                           .map(n => (
                             <div key={n.id} style={{ fontSize: '0.75rem', padding: '8px', borderRadius: '4px', backgroundColor: n.is_read ? 'transparent' : 'rgba(59,130,246,0.05)', borderLeft: '3px solid var(--color-primary)' }}>
                               <strong style={{ display: 'block' }}>{n.title}</strong>
                               <p style={{ color: 'var(--text-secondary)', marginTop: '2px', marginBottom: '4px' }}>{n.content}</p>
                               <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                 {formatNotificationTime(n.created_at || n.timestamp)}
                                </span>
                             </div>
                           ))
                       )}
                     </div>
                     <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px', textAlign: 'center' }}>
                       <button 
                         onClick={() => {
                           setShowNotificationDrawer(false);
                           setShowAllNotificationsModal(true);
                         }}
                         className="btn-link"
                         style={{ fontSize: '0.8rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                       >
                         View All
                       </button>
                     </div>
                   </div>
                 )}
              </div>

              <div style={{ height: '24px', width: '1px', backgroundColor: 'var(--border-color)' }} />
              
              <button id="btn-logout" onClick={() => setShowLogoutConfirm(true)} className="btn-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }} disabled={isLoggingOut}>
                Sign Out
              </button>
            </div>
          </header>
        )}

        {/* Content body */}
        <div className="content-body">
          {years.length === 0 && activeTab !== 'settings' ? (
            <div className="sp-card fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '64px 32px', gap: '24px', maxWidth: '600px', margin: '40px auto' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b'
              }}>
                <Calendar size={40} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Register Your First Academic Year</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '12px', lineHeight: '1.6' }}>
                  Welcome to BN Shiksha Pilot (SP)! To begin managing classrooms, enrolling students, planning timetables, or tracking fee balances, you must first register and activate an Academic Year session.
                </p>
              </div>
              <button 
                onClick={openCreateYearModal}
                className="btn-primary"
                style={{ padding: '12px 24px', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={18} /> Register First Academic Year
              </button>
            </div>
          ) : (
            <>
              {/* --- 1. DASHBOARD TAB --- */}
              {activeTab === 'dashboard' && role === 'Parent' && (
                <PortalDashboard
                  role={role}
                  token={activeToken}
                  isConnected={isConnected}
                  schoolId={schoolId}
                  activeYearId={activeYearId}
                  username={username}
                  teachers={teachers}
                  classes={classes}
                  students={students}
                  allWeeklySchedules={allWeeklySchedules}
                  formatMoney={formatMoney}
                  showToast={showToast}
                />
              )}

              {activeTab === 'dashboard' && role !== 'Parent' && dashboardStats && (
                role === 'Teacher' ? (
                  <PortalDashboard
                    role={role}
                    token={activeToken}
                    isConnected={isConnected}
                    schoolId={schoolId}
                    activeYearId={activeYearId}
                    username={username}
                    teachers={teachers}
                    classes={classes}
                    students={students}
                    allWeeklySchedules={allWeeklySchedules}
                    formatMoney={formatMoney}
                    showToast={showToast}
                  />
                ) : (
                  /* --- STANDARD ADMIN DASHBOARD --- */
                  <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Metric stats grid */}
                    <div className="stats-grid">
                <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Students</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{dashboardStats.total_students}</div>
                  <span className="badge badge-success" style={{ marginTop: '8px' }}>Active Year: {getActiveYearRange()}</span>
                </div>
                <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Faculty Members</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>{dashboardStats.total_teachers}</div>
                  <span className="badge badge-primary" style={{ marginTop: '8px' }}>Full-time</span>
                </div>
                 <div 
                    className="sp-card hoverable-card" 
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
                    title="View students with overdue fee balances"
                    onClick={() => {
                      setActiveTab('fees');
                      setSelectedFeesClassId('all');
                      setFeesStatusFilter('All');
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Dues Balance Sheets</span>
                    {(() => {
                      const totalDuesAmount = getTotalPendingDuesAmount();
                      return (
                        <div style={{ fontSize: '2.0rem', fontWeight: 800, marginTop: '8px', color: '#ef4444' }}>
                          {formatMoney(totalDuesAmount)}
                        </div>
                      );
                    })()}
                  </div>
                 <div className="sp-card">
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Revenue</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
                    {formatMoney(dashboardStats.monthly_revenue)}
                  </div>
                  <span className="badge badge-success" style={{ marginTop: '8px' }}>Tuition Collected</span>
                </div>
              </div>


              {/* Chart panels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* SVG Tuition Collection Chart */}
                <div className="sp-card">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Tuition Collection History</h3>
                  <div style={{ height: '320px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '2px solid var(--border-color)' }}>
                    {(() => {
                      const feeData = isConnected ? dashboardStats.charts.fee_collection : getDynamicFeeCollectionChartData();
                      const maxAmount = Math.max(...feeData.map(f => f.amount)) || 1;
                      const symbol = currencyMap[schoolCurrency]?.symbol || '$';
                      return feeData.map(f => (
                        <div key={f.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                          <div style={{
                            height: `${Math.max((f.amount / maxAmount) * 240, 10)}px`, width: '45%', maxWidth: '48px', minWidth: '16px',
                            background: 'linear-gradient(to top, var(--color-primary) 0%, var(--color-accent) 100%)',
                            borderRadius: '4px 4px 0 0', position: 'relative'
                          }} title={`${symbol}${f.amount}`}>
                            <span style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: 'bold' }}>{symbol}{f.amount}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{f.month.slice(0, 3)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* SVG Salary Expense Chart */}
                <div className="sp-card">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '20px' }}>Salary Disbursements</h3>
                  <div style={{ height: '320px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '2px solid var(--border-color)' }}>
                    {(() => {
                      const salData = isConnected ? dashboardStats.charts.salary_expense : getDynamicSalaryChartData();
                      const maxAmount = Math.max(...salData.map(s => s.amount)) || 1;
                      const symbol = currencyMap[schoolCurrency]?.symbol || '$';
                      return salData.map(s => (
                        <div key={s.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                          <div 
                            onClick={() => handleSalaryBarClick(s.month)}
                            style={{
                              height: `${Math.max((s.amount / maxAmount) * 240, 10)}px`, width: '45%', maxWidth: '48px', minWidth: '16px',
                              background: 'linear-gradient(to top, var(--color-secondary) 0%, #ec4899 100%)',
                              borderRadius: '4px 4px 0 0', position: 'relative',
                              cursor: 'pointer',
                              transition: 'transform 0.2s, filter 0.2s'
                            }} 
                            className="salary-bar-interactive"
                            title={`${symbol}${s.amount} - Click to view detailed breakdown`}
                          >
                            <span style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: 'bold' }}>{symbol}{s.amount}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.month.slice(0, 3)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Today's Timetable Subjects Widget */}
              <div className="sp-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} className="gradient-text" />
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Today's Timetable Subjects</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Class:</span>
                    <select
                      id="dashboard-class-select"
                      value={dashboardPlannerClassId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        setDashboardPlannerClassId(val);
                      }}
                      className="sp-input"
                      style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: '130px' }}
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isFetchingDashboardSchedule ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="spin" style={{ marginRight: '8px' }} /> Loading today's schedule...
                  </div>
                ) : !dashboardTodaySchedule || !dashboardTodaySchedule.subjects || dashboardTodaySchedule.subjects.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                    <Calendar size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
                    <p style={{ fontSize: '0.9rem' }}>No published schedule for today ({dashboardTodaySchedule?.day_of_week || 'Today'}).</p>
                    <button 
                      onClick={() => setActiveTab('planner')}
                      className="btn-outline" 
                      style={{ marginTop: '14px', fontSize: '0.8rem', padding: '4px 12px' }}
                    >
                      Configure Planner
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                      <span>Day: <strong>{dashboardTodaySchedule.day_of_week}</strong></span>
                      <span className="badge badge-success">Published</span>
                    </div>
                    <div className="dashboard-timetable-grid" style={{ gap: '16px', marginTop: '8px' }}>
                      {dashboardTodaySchedule.subjects.map((sub, index) => {
                        const subjectName = typeof sub === 'object' ? sub.subject : sub;
                        const isBackupActive = typeof sub === 'object' && sub.backup_teacher_id && sub.backup_teacher_name;
                        const teacherName = isBackupActive ? sub.backup_teacher_name : (typeof sub === 'object' ? sub.teacher_name : '');
                        return (
                          <div 
                            key={index} 
                            className="glass-panel" 
                            style={{ 
                              padding: '12px 16px', 
                              borderRadius: 'var(--radius-sm)', 
                              border: '1px solid var(--border-color)',
                              background: 'rgba(255, 255, 255, 0.02)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                          >
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Period {index + 1}</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{subjectName}</span>
                            {teacherName && (
                              <span style={{ fontSize: '0.75rem', color: isBackupActive ? 'var(--color-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                {isBackupActive && <span>🛡️</span>}
                                {teacherName} {isBackupActive && <strong style={{ color: '#f59e0b', fontSize: '0.7rem' }}>(Backup)</strong>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )
          )}

          {/* --- 2. FACULTY TAB --- */}
          {activeTab === 'faculty' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {selectedTeacher ? (
                /* Teacher detail sub-view */
                <div className="sp-card">
                  <button 
                    id="btn-teacher-back"
                    onClick={() => { 
                      setSelectedTeacher(null); 
                      setTeacherSalaries([]); 
                      if (teacherProfileBackTab === 'dashboard') {
                        skipSPFetchRef.current = true;
                        setActiveTab('dashboard');
                      }
                      setTeacherProfileBackTab(null);
                    }}
                    className="btn-outline" 
                    style={{ marginBottom: '24px', padding: '6px 12px' }}
                  >
                    {teacherProfileBackTab === 'dashboard' ? 'Back' : 'Back to Faculty'}
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px', alignItems: 'start' }}>
                    
                    {/* Left Column Profile Card */}
                    <div className="sp-card" style={{ textAlign: 'center', background: 'rgba(2, 6, 23, 0.2)' }}>
                      {selectedTeacher.profile_image ? (
                        <img 
                          src={selectedTeacher.profile_image} 
                          alt={selectedTeacher.name} 
                          style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', border: '3px solid var(--color-secondary)' }}
                        />
                      ) : (
                        <div 
                          style={{ 
                            width: '120px', 
                            height: '120px', 
                            borderRadius: '50%', 
                            background: 'rgba(255,255,255,0.05)', 
                            border: '3px solid var(--border-color)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            margin: '0 auto 16px auto',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <User size={64} />
                        </div>
                      )}
                      <h3 style={{ fontSize: '1.25rem' }}>{selectedTeacher.name}</h3>
                      <span className="badge badge-secondary" style={{ marginTop: '8px' }}>{selectedTeacher.subject}</span>
                      
                      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <div><strong>Gender:</strong> {selectedTeacher.gender || 'Male'}</div>
                        <div><strong>Email:</strong> {selectedTeacher.email || 'N/A'}</div>
                        <div><strong>Phone:</strong> {selectedTeacher.phone || 'N/A'}</div>
                        <div><strong>Address:</strong> {selectedTeacher.address || 'N/A'}</div>
                      </div>
                      
                      {isCurrentYearActive() && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                          <button 
                            id="btn-edit-teacher-profile"
                            onClick={() => handleEditTeacherClick(selectedTeacher)}
                            className="btn-primary" 
                            style={{ width: '100%', justifyContent: 'center' }}
                          >
                            <Edit size={14} style={{ marginRight: '6px' }} /> Edit Profile
                          </button>

                          <button 
                            id="btn-delete-teacher"
                            onClick={() => {
                              setDeleteConfirm({
                                message: 'Are you sure you want to delete permanently?',
                                onConfirm: () => {
                                  handleDeleteTeacher(selectedTeacher.id);
                                  setDeleteConfirm(null);
                                }
                              });
                            }}
                            className="btn-outline" 
                            style={{ borderColor: '#ef4444', color: '#ef4444', width: '100%', justifyContent: 'center' }}
                          >
                            <Trash2 size={14} /> Remove Teacher
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Column Details & LEDGER */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {/* Detailed Grid */}
                      <div className="sp-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--text-primary)' }}>Employment Information</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <div><strong>Joining Date:</strong> {selectedTeacher.joining_date || 'N/A'}</div>
                            <div><strong>Exit Date:</strong> {selectedTeacher.exit_date || 'Active / None'}</div>
                            <div>
                              <strong>Employment Status:</strong>{' '}
                              {(() => {
                                const isTeacherInactive = !!(selectedTeacher.exit_date && selectedTeacher.exit_date !== 'Active / None' && selectedTeacher.exit_date.trim() !== '');
                                const teacherDisplayStatus = isTeacherInactive ? 'Inactive' : (selectedTeacher.status || 'Active');
                                return (
                                  <span className={`badge ${teacherDisplayStatus === 'Active' ? 'badge-success' : 'badge-danger'}`}>
                                    {teacherDisplayStatus.toUpperCase()}
                                  </span>
                                );
                              })()}
                            </div>
                            <div><strong>Assigned Classes:</strong> {selectedTeacher.assigned_classes || 'None'}</div>
                            {selectedTeacher.exit_date && selectedTeacher.exit_date !== 'Active / None' && selectedTeacher.exit_date.trim() !== '' && (
                              <div style={{ marginTop: '8px' }}>
                                <button
                                  onClick={() => setShowExperienceLetter(true)}
                                  className="btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <FileText size={14} /> Experience Letter
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--text-primary)' }}>Qualifications & Identity</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <div><strong>Education:</strong> {selectedTeacher.qualification || 'N/A'}</div>
                            <div><strong>Experience:</strong> {selectedTeacher.experience || 'N/A'}</div>
                            <div><strong>Aadhaar Number:</strong> {selectedTeacher.aadhaar_number || 'N/A'}</div>
                            <div><strong>PAN Number:</strong> {selectedTeacher.pan_number ? selectedTeacher.pan_number.toUpperCase() : 'N/A'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Attached Documents Table */}
                      <div className="sp-card">
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--text-primary)' }}>Attached Documents</h4>
                        {(() => {
                          const docsList = typeof selectedTeacher.documents === 'string' ? JSON.parse(selectedTeacher.documents) : (selectedTeacher.documents || []);
                          if (docsList.length === 0) {
                            return (
                              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '0.85rem' }}>
                                No documents attached to this faculty profile.
                              </div>
                            );
                          }
                          return (
                            <div className="table-responsive">
                              <table className="sp-table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                  <tr>
                                    <th>Document Type</th>
                                    <th>File Name</th>
                                    <th>Upload Date</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {docsList.map((doc) => (
                                    <tr key={doc.id}>
                                      <td style={{ fontWeight: 600 }}>{doc.type}</td>
                                      <td>{doc.name}</td>
                                      <td style={{ color: 'var(--text-muted)' }}>{doc.uploaded_at}</td>
                                      <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', border: 'none' }}>
                                        <button
                                          onClick={() => {
                                            const win = window.open();
                                            if (win) {
                                              win.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                            } else {
                                              alert("Pop-up blocked. Please allow pop-ups to view document.");
                                            }
                                          }}
                                          className="btn-outline"
                                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                        >
                                          View
                                        </button>
                                        <a
                                          href={doc.url}
                                          download={doc.name}
                                          className="btn-outline"
                                          style={{ padding: '4px 10px', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                        >
                                          Download
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Salaries monthly checklist */}
                      <div className="sp-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                          <h4 style={{ fontSize: '1.1rem' }}>Salary Registry ({getActiveYearRange()})</h4>
                          <span className="badge badge-warning">April to March</span>
                        </div>

                        <div className="salary-month-grid">
                          {teacherSalaries.map(sal => (
                            <div key={sal.month} className={`salary-month-card ${sal.status === 'Pending' ? 'pending' : ''}`}>
                              <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>{sal.month}</strong>
                              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>{formatMoney(sal.amount)}</span>
                              
                              {sal.status === 'Paid' ? (
                                <div style={{ fontSize: '0.7rem', color: '#10b981' }}>
                                  <Check size={10} style={{ display: 'inline', marginRight: '2px' }} />
                                  Paid ({sal.payment_date})
                                </div>
                              ) : (
                                <div>
                                  <span className="badge badge-danger" style={{ display: 'block', fontSize: '0.65rem', marginBottom: '6px' }}>Pending</span>
                                  {isCurrentYearActive() && (
                                    <button 
                                      onClick={() => processSalary(selectedTeacher.id, sal.month)}
                                      className="btn-primary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', width: '100%', justifyContent: 'center', borderRadius: '4px' }}
                                    >
                                      Disburse
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                /* Faculty Directory View */
                <div>


                  {/* Teacher card grid */}
                  <div className="teacher-grid">
                    {filteredTeachers.slice(0, visibleTeachersCount).map(t => {
                      // WorkloadAvailability Logic (calculated for facultySelectedDate)
                      let assignedCount = getTeacherAssignedCountOnDate(t.id, facultySelectedDate);
                      const maxPeriods = totalPeriodsPerDay;
                      const isOccupied = assignedCount >= maxPeriods;
                      const statusText = isOccupied ? 'Occupied' : 'Available';
                      const badgeColor = isOccupied ? 'badge-warning' : 'badge-success';

                      return (
                        <div 
                          key={t.id} 
                          className="teacher-card"
                          onClick={() => { setSelectedTeacher(t); fetchTeacherSalaryRecords(t.id); }}
                        >
                          <div style={{ position: 'absolute', top: '16px', right: '16px' }} onClick={(e) => e.stopPropagation()}>
                            <button 
                              id={`teacher-menu-btn-${t.id}`}
                              onClick={() => setActiveTeacherMenuId(activeTeacherMenuId === t.id ? null : t.id)}
                              className="menu-dot-trigger"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {activeTeacherMenuId === t.id && (
                              <div className="menu-dropdown" style={{ right: 0, top: '24px' }}>
                                <button 
                                  id={`teacher-edit-btn-${t.id}`}
                                  onClick={() => { handleEditTeacherClick(t); setActiveTeacherMenuId(null); }}
                                  className="menu-dropdown-item"
                                >
                                  Edit
                                </button>
                                <button 
                                  id={`teacher-deactivate-btn-${t.id}`}
                                  onClick={() => { handleModifyTeacherStatus(t.id, t.status === 'Active' ? 'Inactive' : 'Active'); setActiveTeacherMenuId(null); }}
                                  className="menu-dropdown-item"
                                >
                                  {t.status === 'Active' ? 'Deactivate' : 'Activate'}
                                </button>
                                <button 
                                  id={`teacher-creds-btn-${t.id}`}
                                  onClick={() => {
                                    setCredsTargetType('Teacher');
                                    setCredsTargetId(t.id);
                                    loadCredentials('Teacher', t.phone);
                                    setCredsModalOpen(true);
                                    setActiveTeacherMenuId(null);
                                  }}
                                  className="menu-dropdown-item"
                                >
                                  Credentials
                                </button>
                                {isCurrentYearActive() && (
                                  <button 
                                    id={`teacher-remove-btn-${t.id}`}
                                    onClick={() => {
                                      setDeleteConfirm({
                                        message: 'Are you sure you want to delete permanently?',
                                        onConfirm: () => {
                                          handleDeleteTeacher(t.id);
                                          setDeleteConfirm(null);
                                        }
                                      });
                                      setActiveTeacherMenuId(null);
                                    }}
                                    className="menu-dropdown-item" 
                                    style={{ color: '#ef4444' }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                            {t.profile_image ? (
                              <img 
                                src={t.profile_image} 
                                alt={t.name} 
                                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div 
                                style={{ 
                                  width: '60px', 
                                  height: '60px', 
                                  borderRadius: '50%', 
                                  background: 'rgba(255,255,255,0.05)', 
                                  border: '1px solid var(--border-color)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                <User size={28} />
                              </div>
                            )}
                            <div>
                              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{t.name}</h4>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.subject}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <div><strong>Phone:</strong> {t.phone || 'N/A'}</div>
                            <div><strong>Joined:</strong> {t.joining_date || 'N/A'}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                              <span className={`badge ${badgeColor}`}>{statusText}</span>
                              <span style={{ fontWeight: 'bold', marginLeft: 'auto', color: isOccupied ? '#f59e0b' : '#10b981' }}>
                                Assigned: {assignedCount} / {maxPeriods} Periods
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {visibleTeachersCount < filteredTeachers.length && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', width: '100%', gap: '8px' }}>
                      <RefreshCw className="animate-spin" size={18} style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading More Teachers</span>
                    </div>
                  )}

                  {filteredTeachers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                      No faculty members found matching the filters.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- 3. STUDENTS TAB --- */}
          {activeTab === 'students' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {selectedStudent ? (
                /* Student detail view */
                <div className="sp-card">
                  <button 
                    id="btn-student-back"
                    onClick={() => { 
                      setSelectedStudent(null); 
                      setStudentFees([]); 
                      if (ledgerBackSource === 'fees') {
                        setActiveTab('fees');
                      }
                    }}
                    className="btn-outline" 
                    style={{ marginBottom: '24px', padding: '6px 12px' }}
                  >
                    Back to Student List
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '32px', alignItems: 'start' }}>
                    
                    {/* Left Column Profile Card */}
                    <div className="sp-card" style={{ textAlign: 'center', background: 'rgba(2, 6, 23, 0.2)' }}>
                      <img 
                        src={getStudentAvatar(activeStudent)} 
                        alt={activeStudent.name} 
                        style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', border: '3px solid var(--color-primary)' }}
                      />
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{activeStudent.name}</h3>
                      {/* Pending Additional Fee Badges */}
                      {(() => {
                        const pendingExtra = studentExtraFees.filter(
                          item => parseInt(item.student_id) === parseInt(activeStudent.id) && item.status !== 'Paid'
                        );
                        if (pendingExtra.length > 0) {
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '6px', marginBottom: '6px' }}>
                              {pendingExtra.map(fee => (
                                <span 
                                  key={fee.id} 
                                  className="badge badge-warning" 
                                  style={{ 
                                    fontSize: '0.8rem', 
                                    padding: '4px 10px', 
                                    backgroundColor: '#f59e0b', 
                                    color: '#ffffff', 
                                    fontWeight: 'bold',
                                    borderRadius: '4px'
                                  }}
                                >
                                  {fee.fee_name || 'Additional Fee'} Due
                                </span>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {(() => {
                        const totalLastYearDues = studentCarryForwardDues.reduce((acc, d) => {
                          if (d.status !== 'Paid') {
                            const remaining = parseFloat(d.amount) - parseFloat(d.paid_amount || 0);
                            return acc + (remaining > 0 ? remaining : 0);
                          }
                          return acc;
                        }, 0);

                        if (totalLastYearDues > 0) {
                          return (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                              <span className="badge badge-danger" style={{ fontSize: '0.8rem', padding: '6px 16px', display: 'inline-flex', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 'bold' }}>
                                Last Year Dues - {formatMoney(totalLastYearDues)}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <div><strong>Roll No.:</strong> {activeStudent.roll_number}</div>
                        <div><strong>SR No.:</strong> {activeStudent.sr_no || 'N/A'}</div>
                        <div><strong>Class:</strong> {getClassName(activeStudent.class_id)}</div>
                        <div><strong>Section:</strong> {activeStudent.group_name || 'NA'}</div>
                        <div><strong>Gender:</strong> {activeStudent.gender || 'Male'}</div>
                        <div><strong>Contact:</strong> {activeStudent.phone || 'N/A'}</div>
                        <div><strong>Email:</strong> {activeStudent.email || 'N/A'}</div>
                        <div><strong>Country:</strong> {activeStudent.country || 'N/A'}</div>
                        <div><strong>State:</strong> {activeStudent.state || 'N/A'}</div>
                        <div><strong>City:</strong> {activeStudent.city || 'N/A'}</div>
                        <div><strong>Address:</strong> {activeStudent.address || 'N/A'}</div>
                        <div><strong>Nationality:</strong> {activeStudent.nationality || 'Indian'}</div>
                        <div><strong>Caste:</strong> {activeStudent.caste || 'N/A'}</div>
                        <div><strong>Status:</strong> <span className={`badge ${activeStudent.status === 'Inactive' ? 'badge-danger' : 'badge-success'}`} style={{ display: 'inline-block', padding: '2px 8px', fontSize: '0.75rem' }}>{activeStudent.status || 'Active'}</span></div>
                        {activeStudent.exit_date && (
                          <div><strong>Exit Date:</strong> {formatDate(activeStudent.exit_date)}</div>
                        )}
                        <div><strong>Date of Birth:</strong> {formatDate(activeStudent.date_of_birth)}</div>
                        <div><strong>Admission Date:</strong> {formatDate(activeStudent.admission_date)}</div>
                      </div>
                      
                      {isCurrentYearActive() && role !== 'Teacher' && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingStudent(activeStudent);
                              setSForm({
                                ...activeStudent,
                                sr_no: activeStudent.sr_no || '',
                                group_name: activeStudent.group_name || '',
                                gender: activeStudent.gender || 'Male',
                                country: activeStudent.country || '',
                                state: activeStudent.state || '',
                                city: activeStudent.city || '',
                                profile_image: activeStudent.profile_image || '',
                                exit_date: activeStudent.exit_date || '',
                                blood_group: activeStudent.blood_group || '',
                                nationality: activeStudent.nationality || 'Indian',
                                caste: activeStudent.caste || '',
                                documents: typeof activeStudent.documents === 'string' ? JSON.parse(activeStudent.documents) : (activeStudent.documents || [])
                              });
                              setShowAddStudentModal(true);
                            }}
                            className="btn-outline" 
                            style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                          >
                            <Edit size={14} /> Edit Student
                          </button>
                          <button 
                            id="btn-delete-student"
                            onClick={() => {
                              setDeleteConfirm({
                                message: 'Are you sure you want to delete permanently?',
                                onConfirm: () => {
                                  handleDeleteStudent(activeStudent.id);
                                  setDeleteConfirm(null);
                                }
                              });
                            }}
                            className="btn-outline" 
                            style={{ borderColor: '#ef4444', color: '#ef4444', marginTop: '10px', width: '100%', justifyContent: 'center' }}
                          >
                            <Trash2 size={14} /> Remove Student
                          </button>
                        </>
                      )}
                    </div>

                    {/* Right Column details and Month-wise Tuition Ledger */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <div className="sp-card">
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Family & Identification</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
                          <div><strong>Father's Name:</strong> {activeStudent.father_name || 'N/A'}</div>
                          <div><strong>Mother's Name:</strong> {activeStudent.mother_name || 'N/A'}</div>
                          <div><strong>Emergency Contact:</strong> {activeStudent.emergency_contact || 'N/A'}</div>
                          <div><strong>Blood Group:</strong> {activeStudent.blood_group || 'N/A'}</div>
                          <div><strong>Aadhaar Number:</strong> {activeStudent.aadhaar_number || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Sub-tab Navigation */}
                      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                        <button
                          onClick={() => setStudentDetailTab('fees')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: studentDetailTab === 'fees' ? 'var(--color-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            borderBottom: studentDetailTab === 'fees' ? '2px solid var(--color-primary)' : 'none',
                            paddingBottom: '12px'
                          }}
                        >
                          Fee Collection Ledger
                        </button>
                        <button
                          onClick={() => setStudentDetailTab('documents')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: studentDetailTab === 'documents' ? 'var(--color-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            borderBottom: studentDetailTab === 'documents' ? '2px solid var(--color-primary)' : 'none',
                            paddingBottom: '12px'
                          }}
                        >
                          Attached Documents ({typeof activeStudent.documents === 'string' ? JSON.parse(activeStudent.documents).length : (activeStudent.documents || []).length})
                        </button>
                        <button
                          onClick={() => setStudentDetailTab('performance')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: studentDetailTab === 'performance' ? 'var(--color-primary)' : 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            borderBottom: studentDetailTab === 'performance' ? '2px solid var(--color-primary)' : 'none',
                            paddingBottom: '12px'
                          }}
                        >
                          Academic & Performance
                        </button>
                      </div>

                      {studentDetailTab === 'fees' && (
                        /* Fee ledger section split into Current Session and Past Years Dues */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {/* Current Session Dues */}
                          <div className="sp-card">
                            <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>Current Session Fees ({getActiveYearRange()})</span>
                              {isCurrentYearActive() && role !== 'Teacher' && (
                                <button 
                                  disabled={selectedMonthsForPayment.length === 0}
                                  onClick={() => processMultiMonthFeePayment(activeStudent.id, selectedMonthsForPayment)}
                                  className="btn-primary"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '0.8rem', 
                                    opacity: selectedMonthsForPayment.length === 0 ? 0.5 : 1,
                                    cursor: selectedMonthsForPayment.length === 0 ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  Pay Selected {selectedMonthsForPayment.length > 0 ? `(${formatMoney(selectedMonthsForPayment.reduce((sum, m) => {
                                    const fee = studentFees.find(f => f.month === m);
                                    return sum + (fee ? parseFloat(fee.amount) || 0 : 0);
                                  }, 0))})` : ''}
                                </button>
                              )}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {studentFees.map(fee => {
                                return (
                                  <div key={fee.month} className="fees-month-item" style={{ borderLeft: `4px solid ${fee.status === 'Paid' ? '#10b981' : '#ef4444'}`, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px', marginBottom: '2px' }}>
                                    <div>
                                      <strong style={{ fontSize: '0.9rem' }}>{fee.month}</strong>
                                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {fee.status === 'Paid' ? `Paid on: ${fee.payment_date ? formatDate(fee.payment_date) : 'N/A'}` : `Due Date: ${formatDate(fee.due_date)}`}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                      <strong style={{ fontSize: '1rem' }}>{formatMoney(fee.amount)}</strong>
                                      {fee.status === 'Paid' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                           <span 
                                              className="badge badge-success"
                                              style={{ cursor: role === 'Teacher' ? 'default' : 'pointer' }}
                                              title={role === 'Teacher' ? 'Paid' : 'Click to revert to Unpaid'}
                                              onClick={role === 'Teacher' ? undefined : () => handleRevertFeePayment(activeStudent.id, fee.month)}
                                            >
                                              Paid
                                            </span>
                                          <button 
                                            onClick={() => handlePrintReceipt(activeStudent, fee)}
                                            className="btn-outline" 
                                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                          >
                                            <Printer size={12} /> Receipt
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <span className="badge badge-danger">Unpaid</span>
                                          {isCurrentYearActive() && role !== 'Teacher' && (
                                            <input 
                                              type="checkbox"
                                              checked={selectedMonthsForPayment.includes(fee.month)}
                                              onChange={(e) => handleMonthCheckboxChange(fee.month, e.target.checked)}
                                              style={{ 
                                                width: '18px', 
                                                height: '18px', 
                                                cursor: 'pointer',
                                                accentColor: 'var(--color-primary)'
                                              }}
                                            />
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>


                        </div>
                      )}

                      {studentDetailTab === 'documents' && (
                        /* Documents section */
                        <div className="sp-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Attached Documents</h4>
                            
                            {/* File Upload Trigger */}
                            {isCurrentYearActive() && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                  id="detail-upload-doc-type"
                                  className="sp-input"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', width: '160px', height: '30px' }}
                                  defaultValue=""
                                >
                                  <option value="">-- Select Type --</option>
                                  <option value="Birth Certificate">Birth Certificate</option>
                                  <option value="Aadhaar Card">Aadhaar Card</option>
                                  <option value="Transfer Certificate (TC)">Transfer Certificate (TC)</option>
                                  <option value="Caste Certificate">Caste Certificate</option>
                                  <option value="Income Certificate">Income Certificate</option>
                                  <option value="Residence Certificate">Residence Certificate</option>
                                  <option value="Previous School Marksheet">Previous School Marksheet</option>
                                  <option value="Passport Size Photograph">Passport Size Photograph</option>
                                  <option value="Migration Certificate">Migration Certificate</option>
                                  <option value="Character Certificate">Character Certificate</option>
                                  <option value="Medical Certificate">Medical Certificate</option>
                                  <option value="Other Supporting Documents">Other Supporting Documents</option>
                                </select>
                                <button
                                  onClick={() => {
                                    const docType = document.getElementById('detail-upload-doc-type').value;
                                    if (!docType) {
                                      alert("Please select a Document Type first.");
                                      return;
                                    }
                                    document.getElementById('detail-upload-doc-file').click();
                                  }}
                                  className="btn-primary"
                                  style={{ padding: '4px 10px', fontSize: '0.75rem', height: '30px' }}
                                >
                                  <Plus size={12} /> Upload
                                </button>
                                <input
                                  id="detail-upload-doc-file"
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    const docType = document.getElementById('detail-upload-doc-type').value;
                                    if (!file) return;
                                    
                                    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                                    if (!allowedTypes.includes(file.type)) {
                                      alert("Only PDF, JPG, JPEG, and PNG formats are allowed.");
                                      e.target.value = "";
                                      return;
                                    }
                                    
                                    const maxSize = 5 * 1024 * 1024;
                                    if (file.size > maxSize) {
                                      alert("File size exceeds 5MB limit.");
                                      e.target.value = "";
                                      return;
                                    }
                                    
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      const base64data = reader.result;
                                      const currentDocs = typeof activeStudent.documents === 'string' ? JSON.parse(activeStudent.documents) : (activeStudent.documents || []);
                                      const newDoc = {
                                        id: Date.now() + Math.random(),
                                        type: docType,
                                        name: file.name,
                                        url: base64data,
                                        size_str: (file.size / 1024).toFixed(1) + " KB",
                                        uploaded_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                                      };
                                      const filtered = currentDocs.filter(d => d.type !== docType);
                                      const updatedDocs = [...filtered, newDoc];
                                      
                                      await handleUpdateStudentDocuments(activeStudent.id, updatedDocs);
                                      document.getElementById('detail-upload-doc-type').value = "";
                                      e.target.value = "";
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {(() => {
                            const docsList = typeof activeStudent.documents === 'string' ? JSON.parse(activeStudent.documents) : (activeStudent.documents || []);
                            if (docsList.length === 0) {
                              return (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 24px', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                  No documents uploaded yet.
                                </div>
                              );
                            }
                            return (
                              <div className="sp-table-container" style={{ width: '100%', overflowX: 'auto' }}>
                                <table className="sp-table" style={{ fontSize: '0.85rem', tableLayout: 'auto', width: '100%' }}>
                                  <thead>
                                    <tr>
                                      <th>Document Type</th>
                                      <th>File Name</th>
                                      <th>Upload Date</th>
                                      <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {docsList.map((doc) => (
                                      <tr key={doc.id}>
                                        <td style={{ fontWeight: 600 }}>{doc.type}</td>
                                        <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>{doc.name}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{doc.uploaded_at.split(' ')[0]}</td>
                                        <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', border: 'none' }}>
                                          <button
                                            onClick={() => {
                                              const win = window.open();
                                              if (win) {
                                                win.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                              } else {
                                                alert("Pop-up blocked. Please allow pop-ups to view document.");
                                              }
                                            }}
                                            className="btn-outline"
                                            style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                          >
                                            View
                                          </button>
                                          <a
                                            href={doc.url}
                                            download={doc.name}
                                            className="btn-outline"
                                            style={{ padding: '2px 8px', fontSize: '0.7rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                          >
                                            Download
                                          </a>
                                          {isCurrentYearActive() && (
                                            <button
                                              onClick={() => {
                                                setSimpleConfirm({
                                                  message: 'Are you sure you want to delete this?',
                                                  onConfirm: async () => {
                                                    const updatedDocs = docsList.filter(d => d.id !== doc.id);
                                                    await handleUpdateStudentDocuments(activeStudent.id, updatedDocs);
                                                  }
                                                });
                                              }}
                                              className="btn-outline"
                                              style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                            >
                                              Delete
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {studentDetailTab === 'performance' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          <div className="sp-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', gap: '16px', flexWrap: 'wrap' }}>
                            <div>
                              <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Academic Progress Analytics</h4>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                                View performance records and print/save report cards.
                              </p>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>Report Scheme:</label>
                              <select
                                value={profileStudentExamId}
                                onChange={(e) => setProfileStudentExamId(e.target.value)}
                                className="form-control"
                                style={{ minWidth: '220px' }}
                              >
                                <option value="overall">Overall (Annual Report Card)</option>
                                {examsList.filter(e => parseInt(e.class_id) === parseInt(activeStudent.class_id)).map(e => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                              </select>
                              
                              <button
                                onClick={() => window.print()}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '8px 16px' }}
                              >
                                <Printer size={14} /> Print A4 PDF
                              </button>
                            </div>
                          </div>
                          
                          {renderActualReportCard(activeStudent, profileStudentExamId)}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ) : selectedClassId ? (
                /* Student class list sub-view */
                (() => {
                  const currentClass = classes.find(c => c.id === selectedClassId);
                  if (!currentClass) return null;
                  
                  // Extract unique non-empty section names for students in this class
                  const classStudents = students.filter(s => s.class_id === selectedClassId);
                  const uniqueGroups = [...new Set(classStudents.map(s => s.group_name).filter(Boolean))];
                  
                  // Filter students by section, search query (name, roll, contact/phone, email)
                  const filteredStudents = classStudents.filter(s => {
                    const matchesGroup = groupFilter === 'all' || s.group_name === groupFilter;
                    const matchesSearch = 
                      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (s.phone && s.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
                      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));
                    const sStatus = s.status || 'Active';
                    const matchesStatus = studentStatusFilter === 'All' || sStatus === studentStatusFilter;
                    return matchesGroup && matchesSearch && matchesStatus;
                  });

                  const visibleStudents = filteredStudents.slice(0, visibleCount);
                  
                  return (
                    <div className="sp-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <button 
                          id="btn-class-back"
                          onClick={() => { setSelectedClassId(null); setSelectedGroupId(null); setGroupFilter('all'); }}
                          className="btn-outline" 
                          style={{ padding: '6px 12px' }}
                        >
                          Back to Classes
                        </button>
                        
                        <h3 style={{ fontSize: '1.25rem' }}>
                          Students in {currentClass.name}
                        </h3>
                        
                        <div>
                          {isCurrentYearActive() && role !== 'Teacher' && (
                            <button 
                              id="btn-add-student" 
                              onClick={() => {
                                setEditingStudent(null);
                                setSForm({
                                  name: '',
                                  roll_number: '',
                                  sr_no: '',
                                  class_id: selectedClassId,
                                  group_name: '',
                                  gender: 'Male',
                                  phone: '',
                                  email: '',
                                  country: '',
                                  state: '',
                                  city: '',
                                  father_name: '',
                                  mother_name: '',
                                  address: '',
                                  date_of_birth: '',
                                  admission_date: '',
                                  emergency_contact: '',
                                  blood_group: '',
                                  aadhaar_number: '',
                                  nationality: 'Indian',
                                  caste: '',
                                  profile_image: '',
                                  documents: []
                                });
                                setShowAddStudentModal(true);
                              }} 
                              className="btn-primary"
                            >
                              <Plus size={16} /> Add Student
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Search box & filter bar */}
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                        {/* Search Input */}
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

                        {/* Status Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <label htmlFor="student-status-filter" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Status:
                          </label>
                          <select 
                            id="student-status-filter"
                            className="sp-input"
                            style={{ width: '150px', padding: '6px 12px' }}
                            value={studentStatusFilter}
                            onChange={(e) => setStudentStatusFilter(e.target.value)}
                          >
                            <option value="All">All</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>

                        {/* Section Filter */}
                        {uniqueGroups.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <label htmlFor="group-filter" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Filter by Section:
                            </label>
                            <select 
                              id="group-filter"
                              className="sp-input"
                              style={{ width: '200px', padding: '6px 12px' }}
                              value={groupFilter}
                              onChange={(e) => setGroupFilter(e.target.value)}
                            >
                              <option value="all">All Sections</option>
                              {uniqueGroups.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Scrollable Table Container */}
                      <div 
                        className="sp-table-container" 
                        style={{ maxHeight: 'calc(100vh - 290px)', overflowY: 'auto' }}
                        onScroll={(e) => {
                          const target = e.target;
                          if (target.scrollHeight - target.scrollTop - target.clientHeight < 20) {
                            if (visibleCount < filteredStudents.length && !isFetchingMoreStudents) {
                              setIsFetchingMoreStudents(true);
                              setTimeout(() => {
                                setVisibleCount(prev => prev + 6);
                                setIsFetchingMoreStudents(false);
                              }, 500);
                            }
                          }
                        }}
                      >
                        <table className="sp-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th style={{ whiteSpace: 'nowrap' }}>Roll No</th>
                              <th>Section</th>
                              <th>Gender</th>
                              <th>Contact</th>
                              <th>Email Address</th>
                              <th>City</th>
                              {role !== 'Teacher' && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {visibleStudents.map(student => (
                              <tr key={student.id} onClick={() => { setSelectedStudent(student); fetchStudentFeesRecords(student.id, student.class_id); setLedgerBackSource('students'); }} style={{ cursor: 'pointer' }}>
                                <td style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={student.name}>
                                  {student.name}
                                </td>
                                <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{student.roll_number}</td>
                                <td>
                                  <span className="badge badge-outline" style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    {student.group_name || 'NA'}
                                  </span>
                                </td>
                                <td>{student.gender || 'Male'}</td>
                                <td>{student.phone || 'N/A'}</td>
                                <td>{student.email || 'N/A'}</td>
                                <td>{student.city || 'N/A'}</td>
                                {role !== 'Teacher' && (
                                  <td onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                                    <button 
                                      id={`student-menu-btn-${student.id}`}
                                      onClick={() => setActiveStudentMenuId(activeStudentMenuId === student.id ? null : student.id)}
                                      className="menu-dot-trigger"
                                    >
                                      <MoreVertical size={16} />
                                    </button>
                                    {activeStudentMenuId === student.id && (
                                      <div className="menu-dropdown" style={{ right: '8px', top: '34px', zIndex: 100 }}>
                                        <button 
                                          id={`student-edit-btn-${student.id}`}
                                          onClick={() => {
                                            setEditingStudent(student);
                                            setSForm({
                                              ...student,
                                              sr_no: student.sr_no || '',
                                              group_name: student.group_name || '',
                                              gender: student.gender || 'Male',
                                              country: student.country || '',
                                              state: student.state || '',
                                              city: student.city || '',
                                              profile_image: student.profile_image || '',
                                              exit_date: student.exit_date || '',
                                              blood_group: student.blood_group || '',
                                              nationality: student.nationality || 'Indian',
                                              caste: student.caste || '',
                                              documents: typeof student.documents === 'string' ? JSON.parse(student.documents) : (student.documents || [])
                                            });
                                            setShowAddStudentModal(true);
                                            setActiveStudentMenuId(null);
                                          }}
                                          className="menu-dropdown-item"
                                        >
                                          Edit
                                        </button>
                                        <button 
                                          id={`student-parent-creds-btn-${student.id}`}
                                          onClick={() => {
                                            const contactPhone = student.phone || student.emergency_contact || '';
                                            if (!contactPhone) {
                                              showToast('Student phone or emergency contact number is required to configure parent credentials.', 'error');
                                              setActiveStudentMenuId(null);
                                              return;
                                            }
                                            setCredsTargetType('Parent');
                                            setCredsTargetId(student.id);
                                            loadCredentials('Parent', contactPhone);
                                            setCredsModalOpen(true);
                                            setActiveStudentMenuId(null);
                                          }}
                                          className="menu-dropdown-item"
                                        >
                                          Parent Credentials
                                        </button>
                                        <button 
                                          id={`student-remove-btn-${student.id}`}
                                          onClick={() => {
                                            setDeleteConfirm({
                                              message: 'Are you sure you want to delete permanently?',
                                              onConfirm: () => {
                                                handleDeleteStudent(student.id);
                                                setDeleteConfirm(null);
                                              }
                                            });
                                            setActiveStudentMenuId(null);
                                          }}
                                          className="menu-dropdown-item"
                                          style={{ color: '#ef4444' }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Lazy Loading Spinner */}
                        {isFetchingMoreStudents && (
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
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading more students...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Class cards list view */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.15rem' }}>Select Classroom to View Rosters</h3>
                    {isCurrentYearActive() && role !== 'Teacher' && (
                      <button 
                        id="btn-create-class"
                        onClick={() => {
                          setNewClassForm({ name: '', room: '', groups: [] });
                          setShowCreateClassModal(true);
                        }} 
                        className="btn-primary"
                      >
                        <Plus size={16} /> Create Class
                      </button>
                    )}
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
                          : 'Create your first classroom to start organizing your students, setting up rosters, and configuring fee schedules.'}
                      </p>
                    </div>
                  ) : (
                    <div className="class-grid">
                      {visibleClasses.map(cls => (
                        <div 
                          key={cls.id} 
                          className="class-card"
                          style={{ overflow: 'visible' }}
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            const hasGrps = cls.groups && cls.groups.length > 0;
                            setSelectedGroupId(hasGrps ? null : 'all');
                            setGroupFilter(hasGrps ? 'all' : 'all');
                          }}
                        >
                          {isCurrentYearActive() && role !== 'Teacher' && (
                            <div style={{ position: 'absolute', top: '16px', right: '16px' }} onClick={(e) => e.stopPropagation()}>
                              <button 
                                id={`class-menu-btn-${cls.id}`}
                                onClick={() => setActiveClassMenuId(activeClassMenuId === cls.id ? null : cls.id)}
                                className="menu-dot-trigger"
                              >
                                <MoreVertical size={16} />
                              </button>
                              {activeClassMenuId === cls.id && (
                                <div className="menu-dropdown" style={{ right: 0, top: '24px' }}>
                                  <button 
                                    id={`class-edit-btn-${cls.id}`}
                                    onClick={() => {
                                      setEditingClass(cls);
                                      setEditClassForm({ name: cls.name });
                                      setShowEditClassModal(true);
                                      setActiveClassMenuId(null);
                                    }}
                                    className="menu-dropdown-item"
                                  >
                                    Edit Class
                                  </button>
                                  <button 
                                    id={`class-assign-teacher-menu-btn-${cls.id}`}
                                    onClick={() => {
                                      setAssignTeacherClassId(cls.id);
                                      setAssignTeacherId(cls.class_teacher_id || '');
                                      setEditingAssignmentClassId(cls.id);
                                      setAssignTeacherModalOpen(true);
                                      setActiveClassMenuId(null);
                                    }}
                                    className="menu-dropdown-item"
                                  >
                                    Assign Teacher
                                  </button>
                                  <button 
                                    id={`class-delete-btn-${cls.id}`}
                                    onClick={() => {
                                      setSimpleConfirm({
                                        title: 'Delete Class',
                                        message: `Are you sure you want to delete "${cls.name}"? This action is permanent and will delete all student profiles, fee records, and schedules associated with this class.`,
                                        onConfirm: () => handleDeleteClass(cls.id)
                                      });
                                      setActiveClassMenuId(null);
                                    }}
                                    className="menu-dropdown-item"
                                    style={{ color: '#ef4444' }}
                                  >
                                    Delete Class
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <h4 style={{ fontSize: '1.25rem', marginBottom: '16px', paddingRight: '20px' }}>{cls.name}</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>👤 Teacher:</span>
                              {cls.class_teacher_id ? (
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {teachers.find(t => Number(t.id) === Number(cls.class_teacher_id))?.name || 'Assigned'}
                                </strong>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Assigned</span>
                              )}
                            </div>
                            {role !== 'Teacher' && (
                              <button
                                id={`class-assign-teacher-btn-${cls.id}`}
                                onClick={() => {
                                  setAssignTeacherClassId(cls.id);
                                  setAssignTeacherId(cls.class_teacher_id || '');
                                  setEditingAssignmentClassId(cls.id);
                                  setAssignTeacherModalOpen(true);
                                }}
                                className="btn-outline"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'fit-content', cursor: 'pointer' }}
                              >
                                {cls.class_teacher_id ? 'Replace Teacher' : 'Assign Teacher'}
                              </button>
                            )}
                          </div>
                          <span className="badge badge-primary">
                            {students.filter(s => s.class_id === cls.id).length} Students
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- 4. FEES TAB --- */}
          {activeTab === 'fees' && (
            <FinanceManager
              activeTab="fees"
              role={role}
              token={token}
              isConnected={isConnected}
              schoolId={schoolId}
              activeYearId={activeYearId}
              username={username}
              showToast={showToast}
              classes={classes}
              visibleClasses={visibleClasses}
              students={students}
              selectedFeesClassId={selectedFeesClassId}
              setSelectedFeesClassId={setSelectedFeesClassId}
              setSelectedStudent={setSelectedStudent}
              setLedgerBackSource={setLedgerBackSource}
              setActiveTab={setActiveTab}
              isFetchingMoreFeesStudents={isFetchingMoreFeesStudents}
              fetchStudentFeesRecords={fetchStudentFeesRecords}
              years={years}
            />
          )}

          {activeTab === 'settings' && (
            <div className="sp-card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem' }}>System Audit Logs & Settings</h3>
                <span className="badge badge-secondary">Security Operator: {username}</span>
              </div>

              {/* Academic Sessions Master Management */}
              <div className="sp-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>Academic Sessions Manager</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                      Configure, activate, and archive school academic sessions.
                    </p>
                  </div>
                  <button 
                    onClick={openCreateYearModal}
                    className="btn-primary"
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> Create Academic Year
                  </button>
                </div>
                
                <div className="sp-table-container">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Session Range</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {years.map((y, idx) => (
                        <tr key={y.id || idx}>
                          <td style={{ fontWeight: 'bold' }}>{y.year_range}</td>
                          <td>{y.start_date || 'N/A'}</td>
                          <td>{y.end_date || 'N/A'}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{y.description || 'No description'}</td>
                          <td>
                            {y.status === 'Active' ? (
                              <span className="badge badge-success">Active</span>
                            ) : y.status === 'Archived' ? (
                              <span className="badge badge-secondary">Archived</span>
                            ) : (
                              <span className="badge badge-warning">Draft</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {y.status === 'Draft' && (
                              <button 
                                onClick={() => {
                                  setWizardTargetYear(y);
                                  setTransitionWizardStep(1);
                                  setWizardClassMappings(getInitialClassMappings());
                                  // Initialize student status map
                                  const initStatuses = {};
                                  students.forEach(s => {
                                    if (s.status === 'Active') {
                                      initStatuses[s.id] = 'promote';
                                    }
                                  });
                                  setWizardStudentStatus(initStatuses);
                                  setWizardConfirmText('');
                                  setShowTransitionWizard(true);
                                }}
                                className="btn-primary"
                                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                              >
                                Activate Session
                              </button>
                            )}
                            {y.status === 'Active' && (
                              <button 
                                onClick={() => handleArchiveAcademicYear(y.id)}
                                className="btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#ef4444' }}
                              >
                                Archive Session
                              </button>
                            )}
                            {y.status === 'Archived' && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Historical</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tuition Fee settings configuration */}
              {(() => {
                const isLocked = classFeeStructure && (classFeeStructure.is_locked === 1 || classFeeStructure.is_locked === true || classFeeStructure.is_locked === '1');
                return (
                  <div className="sp-card">
                    <h4 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Class-wise Tuition Fee Configuration
                      {isLocked && (
                        <span style={{ fontSize: '0.8rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          🔒 Fee Structure Locked
                        </span>
                      )}
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px', marginBottom: '16px' }}>
                      Define class-wise monthly tuition fee amounts for the currently active academic session.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Select Class</label>
                          <select
                            value={selectedFeeClassId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedFeeClassId(val);
                              fetchClassFeeStructure(val);
                            }}
                            className="sp-input"
                            disabled={isLocked}
                          >
                            <option value="">-- Choose Class --</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        {isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFeeClassId('');
                              setClassFeeStructure(null);
                            }}
                            className="btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', height: '38px', alignSelf: 'flex-end' }}
                          >
                            Switch Class
                          </button>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                          <label className="form-label" style={{ fontWeight: 600 }}>Default Currency</label>
                          <select
                            value={schoolCurrency}
                            onChange={async (e) => {
                              const val = e.target.value;
                              setSchoolCurrency(val);
                              
                              if (isConnected) {
                                try {
                                  const res = await fetch('/api/school/currency', {
                                    method: 'PUT',
                                    headers: getHeaders(),
                                    body: JSON.stringify({ currency: val })
                                  });
                                  if (res.ok) {
                                    showToast(`Default currency updated to ${val} successfully.`, "success");
                                  } else {
                                    showToast("Failed to save currency configuration on server.", "error");
                                  }
                                } catch (err) {
                                  showToast("Error updating currency.", "error");
                                }
                              } else {
                                const keySuffix = schoolId || 'default';
                                localStorage.setItem(`bn_sandbox_school_currency_${keySuffix}`, val);
                                showToast(`Default currency updated to ${val} (Offline Mode) successfully.`, "success");
                              }
                            }}
                            className="sp-input"
                          >
                            {Object.values(currencyMap).map(c => (
                              <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {selectedFeeClassId && classFeeStructure && (
                        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          
                          {/* Fee Structure Mode Selector */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fee Structure Mode</label>
                            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px', alignSelf: 'flex-start' }}>
                              <button
                                type="button"
                                onClick={() => !isLocked && setFeeStructureMode('same')}
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  background: feeStructureMode === 'same' ? 'var(--color-primary)' : 'transparent',
                                  color: feeStructureMode === 'same' ? '#ffffff' : 'var(--text-secondary)',
                                  padding: '6px 16px',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  opacity: isLocked && feeStructureMode !== 'same' ? 0.5 : 1,
                                  transition: 'all 0.2s ease-in-out'
                                }}
                                disabled={isLocked}
                              >
                                Same Fee For All Months
                              </button>
                              <button
                                type="button"
                                onClick={() => !isLocked && setFeeStructureMode('custom')}
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  background: feeStructureMode === 'custom' ? 'var(--color-primary)' : 'transparent',
                                  color: feeStructureMode === 'custom' ? '#ffffff' : 'var(--text-secondary)',
                                  padding: '6px 16px',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  opacity: isLocked && feeStructureMode !== 'custom' ? 0.5 : 1,
                                  transition: 'all 0.2s ease-in-out'
                                }}
                                disabled={isLocked}
                              >
                                Custom Fee Per Month
                              </button>
                            </div>
                          </div>

                          {feeStructureMode === 'same' ? (
                            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Monthly Tuition Fee</label>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <span style={{ position: 'absolute', left: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                  {currencyMap[schoolCurrency]?.symbol || '₹'}
                                </span>
                                <input 
                                  type="number"
                                  value={sameMonthlyFee === 0 ? '' : sameMonthlyFee}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSameMonthlyFee(val === '' ? 0 : (parseFloat(val) || 0));
                                  }}
                                  className="sp-input"
                                  style={{ padding: '8px 12px 8px 28px', fontSize: '0.9rem', width: '100%' }}
                                  required
                                  min="0"
                                  placeholder="e.g. 150"
                                  disabled={isLocked}
                                />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                                The entered amount will automatically be applied to all months of the academic session.
                              </span>
                            </div>
                          ) : (
                            <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                              {["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"].map(m => (
                                <div key={m} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{m}</label>
                                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <span style={{ position: 'absolute', left: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                      {currencyMap[schoolCurrency]?.symbol || '₹'}
                                    </span>
                                    <input 
                                      type="number"
                                      value={classFeeStructure[m] === 0 ? '' : (classFeeStructure[m] ?? 0)}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setClassFeeStructure(prev => ({
                                          ...prev,
                                          [m]: val === '' ? 0 : (parseFloat(val) || 0)
                                        }));
                                      }}
                                      className="sp-input"
                                      style={{ padding: '8px 12px 8px 28px', fontSize: '0.9rem', width: '100%' }}
                                      required
                                      min="0"
                                      disabled={isLocked}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            {isLocked ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 600, fontSize: '0.9rem' }}>
                                🔒 Fee Structure Locked
                              </div>
                            ) : (
                              <button onClick={() => setShowConfirmLockModal(true)} className="btn-primary">
                                Save Fee Structure
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* School settings configuration */}
              <div className="sp-card">
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  School Settings & Timetable Configuration
                  {hasUnsavedChanges && (
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Unsaved Changes
                    </span>
                  )}
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Define structural settings for classroom schedulers and faculty workload computation.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'start' }}>
                    
                    {/* School Start Time */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="settings-start-time" className="form-label" style={{ fontWeight: 600 }}>School Start Time</label>
                      <input
                        id="settings-start-time"
                        type="time"
                        value={convertTimeTo24h(draftSchoolStartTime)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const mins = parseTimeToMinutes(val);
                            setDraftSchoolStartTime(formatMinutesToTime(mins));
                          }
                        }}
                        className="sp-input"
                        style={{ padding: '6px 12px' }}
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Selected: {draftSchoolStartTime}</span>
                    </div>

                    {/* Period Duration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="settings-period-duration" className="form-label" style={{ fontWeight: 600 }}>Period Duration (Minutes)</label>
                      <input
                        id="settings-period-duration"
                        type="number"
                        min="1"
                        value={draftPeriodDuration || ''}
                        onChange={(e) => setDraftPeriodDuration(parseInt(e.target.value) !== undefined ? (parseInt(e.target.value) || 0) : 40)}
                        className={`sp-input ${periodDurationError ? 'input-error' : ''}`}
                        style={{ padding: '6px 12px' }}
                      />
                      {periodDurationError && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>{periodDurationError}</span>}
                    </div>

                    {/* Interval Duration */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="settings-interval-duration" className="form-label" style={{ fontWeight: 600 }}>Interval Duration (Minutes)</label>
                      <input
                        id="settings-interval-duration"
                        type="number"
                        min="0"
                        value={draftIntervalDuration !== undefined ? draftIntervalDuration : ''}
                        onChange={(e) => setDraftIntervalDuration(parseInt(e.target.value) !== undefined ? (parseInt(e.target.value) || 0) : 0)}
                        className={`sp-input ${intervalDurationError ? 'input-error' : ''}`}
                        style={{ padding: '6px 12px' }}
                      />
                      {intervalDurationError && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>{intervalDurationError}</span>}
                    </div>

                    {/* Interval After Period */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="settings-interval-after" className="form-label" style={{ fontWeight: 600 }}>Interval After Period</label>
                      <input
                        id="settings-interval-after"
                        type="number"
                        min="0"
                        value={draftIntervalAfterPeriod !== undefined ? draftIntervalAfterPeriod : ''}
                        onChange={(e) => setDraftIntervalAfterPeriod(parseInt(e.target.value) !== undefined ? (parseInt(e.target.value) || 0) : 0)}
                        className={`sp-input ${intervalAfterPeriodError ? 'input-error' : ''}`}
                        style={{ padding: '6px 12px' }}
                      />
                      {intervalAfterPeriodError && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>{intervalAfterPeriodError}</span>}
                    </div>

                    {/* Total Periods */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="settings-total-periods" className="form-label" style={{ fontWeight: 600 }}>Total Periods Per Day</label>
                      <input
                        id="settings-total-periods"
                        type="number"
                        min="1"
                        max="15"
                        value={draftTotalPeriods || ''}
                        onChange={(e) => setDraftTotalPeriods(parseInt(e.target.value) !== undefined ? (parseInt(e.target.value) || 0) : 8)}
                        className={`sp-input ${totalPeriodsError ? 'input-error' : ''}`}
                        style={{ padding: '6px 12px' }}
                      />
                      {totalPeriodsError && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 500 }}>{totalPeriodsError}</span>}
                    </div>

                    {/* Save Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end', height: '100%' }}>
                      <button
                        onClick={handleSaveTimetableConfig}
                        disabled={hasValidationErrors}
                        className="btn-primary"
                        style={{ padding: '8px 16px', height: '38px', opacity: hasValidationErrors ? 0.5 : 1, cursor: hasValidationErrors ? 'not-allowed' : 'pointer', width: '100%' }}
                      >
                        Save Configuration
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Timetable Preview Section */}
                  {!hasValidationErrors && draftTotalPeriods > 0 && (
                    <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <h5 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px', color: hasUnsavedChanges ? 'var(--text-secondary)' : '#10b981' }}>
                        {hasUnsavedChanges ? 'Preview (Not Yet Saved)' : 'Active Timetable Schedule'}
                      </h5>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '12px' }}>
                        {hasUnsavedChanges 
                          ? 'These timings will be applied only after clicking Save Configuration.' 
                          : 'These timings are currently active across the platform.'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {Array.from({ length: draftTotalPeriods }).map((_, i) => {
                          const pNum = i + 1;
                          const timeStr = getDraftPeriodTimingString(pNum);
                          const isIntervalAfter = pNum === draftIntervalAfterPeriod;
                          
                          let intervalTimeStr = '';
                          if (isIntervalAfter && draftIntervalDuration > 0) {
                            const startMins = parseTimeToMinutes(draftSchoolStartTime);
                            const pDur = parseInt(draftPeriodDuration) || 40;
                            const iDur = parseInt(draftIntervalDuration) || 20;
                            const intervalStartMins = startMins + pNum * pDur;
                            const intervalEndMins = intervalStartMins + iDur;
                            intervalTimeStr = `${formatMinutesToTime(intervalStartMins)} - ${formatMinutesToTime(intervalEndMins)}`;
                          }

                          return (
                            <React.Fragment key={pNum}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Period {pNum}</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{timeStr}</span>
                              </div>
                              {isIntervalAfter && draftIntervalDuration > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed rgba(245, 158, 11, 0.25)', borderRadius: '4px', fontSize: '0.8rem' }}>
                                  <span style={{ fontWeight: 600, color: '#fbbf24' }}>Interval</span>
                                  <span style={{ color: '#fbbf24', fontWeight: 500 }}>{intervalTimeStr}</span>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="sp-card">
                <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Operations Audit Ledger</h4>
                <div className="sp-table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Operator</th>
                        <th>Action</th>
                        <th>Timestamp</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 'bold' }}>{log.operator}</td>
                          <td>
                            <span className="badge badge-primary">{log.action}</span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{log.timestamp}</td>
                          <td>{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic User Roles & Permissions Configuration */}
              <div className="sp-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>🛡️ Access Control & Dynamic Roles Manager</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                      Configure customized access policies, permissions, and operator accounts.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className={`btn-tab ${rolesSubTab === 'roles' ? 'active' : ''}`}
                      onClick={() => setRolesSubTab('roles')}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      Roles & Permissions
                    </button>
                    <button
                      className={`btn-tab ${rolesSubTab === 'users' ? 'active' : ''}`}
                      onClick={() => setRolesSubTab('users')}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      Operator User Accounts
                    </button>
                  </div>
                </div>

                {isRolesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                    <div className="loading-spinner"></div>
                  </div>
                ) : rolesSubTab === 'roles' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Add Role Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!roleFormName.trim()) {
                          showToast('Please enter a role name', 'error');
                          return;
                        }
                        handleAddRole(roleFormName.trim(), roleFormPerms);
                        setRoleFormName('');
                        setRoleFormPerms([]);
                      }}
                      className="sp-card"
                      style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px' }}
                    >
                      <h5 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>Create New Access Role</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                        <div>
                          <label className="erp-label">Role Name</label>
                          <input
                            type="text"
                            className="sp-input"
                            placeholder="e.g. Accountant, Coordinator"
                            value={roleFormName}
                            onChange={(e) => setRoleFormName(e.target.value)}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label className="erp-label">Granted Permissions</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                            {[
                              { key: 'attendance', label: 'Attendance Entry' },
                              { key: 'performance', label: 'Student Performance' },
                              { key: 'planner', label: 'Academic Planner' },
                              { key: 'finance', label: 'Fees & Finance' },
                              { key: 'reports', label: 'Financial Reports' },
                              { key: 'administration', label: 'System Settings' },
                              { key: 'parent_portal', label: 'Parent Portal' }
                            ].map(p => (
                              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={roleFormPerms.includes(p.key)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRoleFormPerms([...roleFormPerms, p.key]);
                                    } else {
                                      setRoleFormPerms(roleFormPerms.filter(x => x !== p.key));
                                    }
                                  }}
                                />
                                {p.label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px' }}>
                            Create Role
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* Roles Table */}
                    <div className="sp-table-container">
                      <table className="sp-table">
                        <thead>
                          <tr>
                            <th>Role Name</th>
                            <th>Permissions Allowed</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dbRoles.map((r, idx) => (
                            <tr key={r.id || idx}>
                              <td style={{ fontWeight: 'bold' }}>{r.name}</td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {r.permissions && r.permissions.length > 0 ? (
                                    r.permissions.map(p => (
                                      <span key={p} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                                        {p}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None (Read-Only)</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {['School Admin', 'Teacher', 'Parent'].includes(r.name) ? (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>System Protected</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete the role "${r.name}"?`)) {
                                        handleDeleteRole(r.id);
                                      }
                                    }}
                                    className="btn-danger"
                                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Add/Edit User Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!userFormEmail.trim()) {
                          showToast('Please fill Email or Phone', 'error');
                          return;
                        }
                        if (!editingUser && !userFormPass.trim()) {
                          showToast('Password is required for new accounts', 'error');
                          return;
                        }
                        
                        handleSaveUser(
                          editingUser ? editingUser.id : null,
                          userFormEmail.trim(),
                          userFormPass,
                          userFormRole,
                          userFormClassId || null,
                          userFormChildIds
                        );
                        
                        setUserFormEmail('');
                        setUserFormPass('');
                        setUserFormClassId('');
                        setUserFormChildIds([]);
                      }}
                      className="sp-card"
                      style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '16px' }}
                    >
                      <h5 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>
                        {editingUser ? 'Edit Operator Account' : 'Create New Operator Account'}
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                        <div>
                          <label className="erp-label">Email or Mobile Number</label>
                          <input
                            type="text"
                            className="sp-input"
                            placeholder="e.g. user@school.com or 9876543210"
                            value={userFormEmail}
                            onChange={(e) => setUserFormEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="erp-label">Password {editingUser && '(Leave blank to keep current)'}</label>
                          <input
                            type="password"
                            className="sp-input"
                            placeholder={editingUser ? '••••••••' : 'Min 8 characters'}
                            value={userFormPass}
                            onChange={(e) => setUserFormPass(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="erp-label">Assigned Role</label>
                          <select
                            className="sp-input"
                            value={userFormRole}
                            onChange={(e) => setUserFormRole(e.target.value)}
                          >
                            {dbRoles.map(r => (
                              <option key={r.name} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        {userFormRole === 'Teacher' && (
                          <div>
                            <label className="erp-label">Assigned Classroom (Optional)</label>
                            <select
                              className="sp-input"
                              value={userFormClassId}
                              onChange={(e) => setUserFormClassId(e.target.value)}
                            >
                              <option value="">Select Classroom...</option>
                              {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.class_name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {userFormRole === 'Parent' && (
                          <div>
                            <label className="erp-label">Linked Student IDs (Comma Separated)</label>
                            <input
                              type="text"
                              className="sp-input"
                              placeholder="e.g. 4, 5"
                              value={userFormChildIds.join(', ')}
                              onChange={(e) => {
                                const vals = e.target.value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
                                setUserFormChildIds(vals);
                              }}
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" className="btn-primary" style={{ flex: 1, padding: '10px' }}>
                            {editingUser ? 'Save Changes' : 'Add Account'}
                          </button>
                          {editingUser && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '10px' }}
                              onClick={() => {
                                setEditingUser(null);
                                setUserFormEmail('');
                                setUserFormPass('');
                                setUserFormClassId('');
                                setUserFormChildIds([]);
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </form>

                    {/* Users Table */}
                    <div className="sp-table-container">
                      <table className="sp-table">
                        <thead>
                          <tr>
                            <th>User Email / Mobile</th>
                            <th>Role</th>
                            <th>Class/Student Context</th>
                            <th>Effective Permissions</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dbUsers.map((u, idx) => (
                            <tr key={u.id || idx}>
                              <td style={{ fontWeight: 'bold' }}>{u.email || u.phone || 'N/A'}</td>
                              <td>
                                <span className="badge badge-secondary">{u.role}</span>
                              </td>
                              <td>
                                {u.role === 'Teacher' ? (
                                  <span>Classroom ID: {u.classroom_id || 'None'}</span>
                                ) : u.role === 'Parent' ? (
                                  <span>Student IDs: {u.linked_student_ids ? u.linked_student_ids.join(', ') : 'None'}</span>
                                ) : (
                                  <span>All Classrooms</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {u.permissions && u.permissions.length > 0 ? (
                                    u.permissions.map(p => (
                                      <span key={p} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                                        {p}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {['Admin@yopmail.com', username].includes(u.email) ? (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Active Operator</span>
                                ) : (
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingUser(u);
                                        setUserFormEmail(u.email || u.phone || '');
                                        setUserFormPass('');
                                        setUserFormRole(u.role);
                                        setUserFormClassId(u.classroom_id || '');
                                        setUserFormChildIds(u.linked_student_ids || []);
                                      }}
                                      className="btn-primary"
                                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete account "${u.email || u.phone}"?`)) {
                                          handleDeleteUser(u.id);
                                        }
                                      }}
                                      className="btn-danger"
                                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- 6.1 FINANCIAL REPORTS TAB --- */}
          {activeTab === 'financial' && (
            <FinanceManager
              activeTab="financial"
              role={role}
              token={token}
              isConnected={isConnected}
              schoolId={schoolId}
              activeYearId={activeYearId}
              username={username}
              showToast={showToast}
              financialSubTab={financialSubTab}
              setFinancialSubTab={setFinancialSubTab}
              financialReports={financialReports}
              reportFromDate={reportFromDate}
              setReportFromDate={setReportFromDate}
              reportToDate={reportToDate}
              setReportToDate={setReportToDate}
              reportPreview={reportPreview}
              setReportPreview={setReportPreview}
              isReportPreviewing={isReportPreviewing}
              isGeneratingReport={isGeneratingReport}
              exportingReportId={exportingReportId}
              settlingReportId={settlingReportId}
              showGenerateConfirm={showGenerateConfirm}
              setShowGenerateConfirm={setShowGenerateConfirm}
              exportFinancialReport={exportFinancialReport}
              toggleReportSettlement={toggleReportSettlement}
              previewFinancialReport={previewFinancialReport}
              generateFinancialReport={generateFinancialReport}
              expenses={expenses}
              isFetchingExpenses={isFetchingExpenses}
              fetchExpenses={fetchExpenses}
              expenseDesc={expenseDesc}
              setExpenseDesc={setExpenseDesc}
              expenseAmount={expenseAmount}
              setExpenseAmount={setExpenseAmount}
              addSchoolExpense={addSchoolExpense}
              extraFeeTypes={extraFeeTypes}
              isFetchingExtraFeeTypes={isFetchingExtraFeeTypes}
              fetchExtraFeeTypes={fetchExtraFeeTypes}
              newTypeName={newTypeName}
              setNewTypeName={setNewTypeName}
              newTypeAmount={newTypeAmount}
              setNewTypeAmount={setNewTypeAmount}
              addExtraFeeType={addExtraFeeType}
              editingExtraFeeType={editingExtraFeeType}
              setEditingExtraFeeType={setEditingExtraFeeType}
              editExtraFeeTypeName={editExtraFeeTypeName}
              setEditExtraFeeTypeName={setEditExtraFeeTypeName}
              editExtraFeeTypeAmount={editExtraFeeTypeAmount}
              setEditExtraFeeTypeAmount={setEditExtraFeeTypeAmount}
              editExtraFeeType={editExtraFeeType}
              studentExtraFees={studentExtraFees}
              isFetchingStudentExtraFees={isFetchingStudentExtraFees}
              fetchStudentExtraFees={fetchStudentExtraFees}
              extraFeeSearch={extraFeeSearch}
              setExtraFeeSearch={setExtraFeeSearch}
              extraFeeStatusFilter={extraFeeStatusFilter}
              setExtraFeeStatusFilter={setExtraFeeStatusFilter}
              extraFeeClassFilter={extraFeeClassFilter}
              setExtraFeeClassFilter={setExtraFeeClassFilter}
              extraFeeTypeFilter={extraFeeTypeFilter}
              setExtraFeeTypeFilter={setExtraFeeTypeFilter}
              visibleAdditionalFeeStudentsCount={visibleAdditionalFeeStudentsCount}
              setVisibleAdditionalFeeStudentsCount={setVisibleAdditionalFeeStudentsCount}
              isFetchingMoreAdditionalFeeStudents={isFetchingMoreAdditionalFeeStudents}
              payExtraStudentFee={payExtraStudentFee}
              revertExtraStudentFee={revertExtraStudentFee}
              years={years}
            />
          )}

          {activeTab === 'finance_management' && (
            <FinanceManager
              activeTab="finance_management"
              role={role}
              token={token}
              isConnected={isConnected}
              schoolId={schoolId}
              activeYearId={activeYearId}
              username={username}
              showToast={showToast}
              classes={classes}
              students={students}
              financeManagementSubTab={financeManagementSubTab}
              setFinanceManagementSubTab={setFinanceManagementSubTab}
              classFees={classFees}
              monthlySalaries={monthlySalaries}
              paymentPromises={paymentPromises}
              previousDues={previousDues}
              previousYearRecoveries={previousYearRecoveries}
              fetchPreviousDues={fetchPreviousDues}
              fetchPreviousYearRecoveries={fetchPreviousYearRecoveries}
              isFetchingPreviousDues={isFetchingPreviousDues}
              isFetchingCarryForwardDues={isFetchingCarryForwardDues}
              selectedCarryForwardDue={selectedCarryForwardDue}
              setSelectedCarryForwardDue={setSelectedCarryForwardDue}
              showPayRecoveryModal={showPayRecoveryModal}
              setShowPayRecoveryModal={setShowPayRecoveryModal}
              showRecoveryReceiptModal={showRecoveryReceiptModal}
              setShowRecoveryReceiptModal={setShowRecoveryReceiptModal}
              selectedRecoveryReceiptDue={selectedRecoveryReceiptDue}
              setSelectedRecoveryReceiptDue={setSelectedRecoveryReceiptDue}
              selectedRecoveryReceiptRec={selectedRecoveryReceiptRec}
              setSelectedRecoveryReceiptRec={setSelectedRecoveryReceiptRec}
              recoveryAmount={recoveryAmount}
              setRecoveryAmount={setRecoveryAmount}
              recoveryDate={recoveryDate}
              setRecoveryDate={setRecoveryDate}
              isRecordingRecovery={isRecordingRecovery}
              recoverySearchQuery={recoverySearchQuery}
              setRecoverySearchQuery={setRecoverySearchQuery}
              recoveryYearFilter={recoveryYearFilter}
              setRecoveryYearFilter={setRecoveryYearFilter}
              isSavingPromise={isSavingPromise}
              promiseSearch={promiseSearch}
              setPromiseSearch={setPromiseSearch}
              promiseClassFilter={promiseClassFilter}
              setPromiseClassFilter={setPromiseClassFilter}
              promiseModalOpen={promiseModalOpen}
              setPromiseModalOpen={setPromiseModalOpen}
              editingPromise={editingPromise}
              setEditingPromise={setEditingPromise}
              promiseStudentId={promiseStudentId}
              setPromiseStudentId={setPromiseStudentId}
              promiseDate={promiseDate}
              setPromiseDate={setPromiseDate}
              promiseDescription={promiseDescription}
              setPromiseDescription={setPromiseDescription}
              promiseStatus={promiseStatus}
              setPromiseStatus={setPromiseStatus}
              promiseStudentSearchQuery={promiseStudentSearchQuery}
              setPromiseStudentSearchQuery={setPromiseStudentSearchQuery}
              activePromiseMenuId={activePromiseMenuId}
              setActivePromiseMenuId={setActivePromiseMenuId}
              fetchClassFeeStructure={fetchClassFeeStructure}
              saveClassFeeStructure={saveClassFeeStructure}
              fetchMonthlySalaries={fetchMonthlySalaries}
              payTeacherSalary={payTeacherSalary}
              fetchPaymentPromises={fetchPaymentPromises}
              addPaymentPromise={addPaymentPromise}
              editPaymentPromise={editPaymentPromise}
              deletePaymentPromise={deletePaymentPromise}
              payCarryForwardDue={payCarryForwardDue}
              revertCarryForwardDueRecovery={revertCarryForwardDueRecovery}
              years={years}
            />
          )}

          {activeTab === 'planner' && (
            <div className="fade-in">
              <TimetableManager
                token={token}
                schoolId={adminProfile?.school_id || '1'}
                activeYearId={activeYearId}
                classrooms={classes}
                teachers={teachers}
                isConnected={isConnected}
                showToast={showToast}
                isCurrentYearActive={isCurrentYearActive}
                username={username}
                schoolStartTime={schoolStartTime}
                periodDuration={periodDuration}
                intervalDuration={intervalDuration}
                intervalAfterPeriod={intervalAfterPeriod}
                totalPeriods={totalPeriodsPerDay}
              />
            </div>
          )}

          {/* TAB 8: Admin Profile */}
          {activeTab === 'profile' && renderAdminProfileTab()}

          {/* TAB 9: Student Performance */}
          {activeTab === 'performance' && renderStudentPerformanceTab()}
            </>
          )}
        </div>
      </div>

      {/* --- ADD FACULTY MODAL --- */}
      {showAddTeacherModal && (
        <div className="modal-overlay" onClick={() => { setShowAddTeacherModal(false); setEditingTeacher(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>{editingTeacher ? 'Edit Faculty Profile' : 'Add New Faculty Member'}</h3>
              <button onClick={() => { setShowAddTeacherModal(false); setEditingTeacher(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddTeacherSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Photo Upload Area */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)' }}>
                {tForm.profile_image ? (
                  <img 
                    src={tForm.profile_image} 
                    alt="Preview" 
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                  />
                ) : (
                  <div 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.05)', 
                      border: '2px dashed var(--border-color)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <User size={24} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Profile Photo</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn-outline" 
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => document.getElementById('teacher-photo-upload').click()}
                    >
                      Upload Photo
                    </button>
                    {tForm.profile_image && (
                      <button 
                        type="button" 
                        className="btn-outline" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        onClick={() => setTForm({...tForm, profile_image: ''})}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input 
                    id="teacher-photo-upload" 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setTForm({...tForm, profile_image: reader.result});
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t-name" className="form-label">Full Name</label>
                  <input id="t-name" type="text" className="sp-input" value={tForm.name} onChange={(e) => setTForm({...tForm, name: e.target.value})} required />
                </div>
                <div>
                  <label htmlFor="t-gender" className="form-label">Gender</label>
                  <select
                    id="t-gender"
                    value={tForm.gender}
                    onChange={(e) => setTForm({...tForm, gender: e.target.value})}
                    className="sp-input"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t-subject" className="form-label">Subject Dept</label>
                  <input id="t-subject" type="text" className="sp-input" placeholder="e.g. Mathematics" value={tForm.subject} onChange={(e) => setTForm({...tForm, subject: e.target.value})} required />
                </div>
                <div>
                  <label htmlFor="t-phone" className="form-label">Phone Number</label>
                  <input id="t-phone" type="text" className="sp-input" value={tForm.phone} onChange={(e) => setTForm({...tForm, phone: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t-email" className="form-label">Email Address</label>
                  <input id="t-email" type="email" className="sp-input" value={tForm.email} onChange={(e) => setTForm({...tForm, email: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="t-qual" className="form-label">Qualification</label>
                  <input id="t-qual" type="text" className="sp-input" value={tForm.qualification} onChange={(e) => setTForm({...tForm, qualification: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t-experience" className="form-label">Experience</label>
                  <input id="t-experience" type="text" className="sp-input" placeholder="e.g. 5 Years" value={tForm.experience || ''} onChange={(e) => setTForm({...tForm, experience: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="t-salary" className="form-label">Base Salary ($)</label>
                  <input id="t-salary" type="number" className="sp-input" value={tForm.salary_amount} onChange={(e) => setTForm({...tForm, salary_amount: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t-aadhaar" className="form-label">Aadhaar Number (12 digits)</label>
                  <input id="t-aadhaar" type="text" placeholder="123456789012" className="sp-input" value={tForm.aadhaar_number} onChange={(e) => setTForm({...tForm, aadhaar_number: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="t-pan" className="form-label">PAN Number (e.g. ABCDE1234F)</label>
                  <input id="t-pan" type="text" placeholder="ABCDE1234F" className="sp-input" value={tForm.pan_number} onChange={(e) => setTForm({...tForm, pan_number: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="t-join" className="form-label">Joining Date *</label>
                  <input id="t-join" type="date" className="sp-input" value={tForm.joining_date} onChange={(e) => setTForm({...tForm, joining_date: e.target.value})} required />
                </div>
                <div>
                  <label htmlFor="t-exit" className="form-label">Exit Date (Optional)</label>
                  <input id="t-exit" type="date" className="sp-input" value={tForm.exit_date} onChange={(e) => setTForm({...tForm, exit_date: e.target.value})} />
                </div>
              </div>

              <div>
                <label htmlFor="t-address" className="form-label">Home Address</label>
                <input id="t-address" type="text" className="sp-input" value={tForm.address} onChange={(e) => setTForm({...tForm, address: e.target.value})} />
              </div>

              {/* Document Management Section */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Document Attachments</h4>
                
                {/* Upload Controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Document Type</label>
                    <select
                      id="upload-doc-type"
                      className="sp-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      defaultValue=""
                    >
                      <option value="">-- Choose Type --</option>
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="PAN Card">PAN Card</option>
                      <option value="Resume / CV">Resume / CV</option>
                      <option value="Educational Certificates">Educational Certificates</option>
                      <option value="Experience Certificates">Experience Certificates</option>
                      <option value="Offer Letter">Offer Letter</option>
                      <option value="Joining Letter">Joining Letter</option>
                      <option value="Relieving Letter">Relieving Letter</option>
                      <option value="Other Documents">Other Documents</option>
                    </select>
                  </div>
                  
                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Choose File</label>
                    <input
                      id="upload-doc-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sp-input"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        const docType = document.getElementById('upload-doc-type').value;
                        if (!file) return;
                        if (!docType) {
                          alert("Please select a Document Type first.");
                          e.target.value = "";
                          return;
                        }
                        
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64data = reader.result;
                          const newDoc = {
                            id: Date.now() + Math.random(),
                            type: docType,
                            name: file.name,
                            url: base64data,
                            uploaded_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                          };
                          
                          setTForm(prev => {
                            const filtered = prev.documents.filter(d => d.type !== docType);
                            return {
                              ...prev,
                              documents: [...filtered, newDoc]
                            };
                          });
                          
                          document.getElementById('upload-doc-type').value = "";
                          e.target.value = "";
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>

                {/* Uploaded Documents List */}
                {tForm.documents && tForm.documents.length > 0 ? (
                  <div className="sp-table-container" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="sp-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Document Type</th>
                          <th>File Name</th>
                          <th>Uploaded</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tForm.documents.map((doc) => (
                          <tr key={doc.id}>
                            <td style={{ fontWeight: 600 }}>{doc.type}</td>
                            <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{doc.uploaded_at.split(' ')[0]}</td>
                            <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', border: 'none' }}>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                onClick={() => {
                                  const win = window.open();
                                  if (win) {
                                    win.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                  } else {
                                    alert("Pop-up blocked. Please allow pop-ups to view document.");
                                  }
                                }}
                              >
                                View
                              </button>
                              <a
                                href={doc.url}
                                download={doc.name}
                                className="btn-outline"
                                style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                              >
                                Download
                              </a>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ padding: '2px 6px', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                onClick={() => {
                                  setTForm(prev => ({
                                    ...prev,
                                    documents: prev.documents.filter(d => d.id !== doc.id)
                                  }));
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    No documents attached yet.
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px', justifyContent: 'center' }}>Save Faculty Profile</button>
            </form>
          </div>
        </div>
      )}

      {/* --- EXAM CREATOR FORM MODAL --- */}
      {showExamFormModal && (
        <div className="modal-overlay" onClick={() => setShowExamFormModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingExamId ? 'Edit Examination' : 'Create New Examination'}
              </h3>
              <button onClick={() => setShowExamFormModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!examForm.class_id) {
                  showToast("Please select a class.", "error");
                  return;
                }
                const validSubjects = examForm.subjects.filter(s => s.subject_name.trim() !== '');
                if (validSubjects.length === 0) {
                  showToast("Please add at least one subject.", "error");
                  return;
                }
                saveExam({
                  ...examForm,
                  subjects: validSubjects
                }, editingExamId);
              }} 
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Exam Name *</label>
                  <input
                    type="text"
                    className="sp-input"
                    placeholder="e.g. Unit Test 1, Annual Exam"
                    value={examForm.name}
                    onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Applicable Class *</label>
                  <select
                    className="sp-input"
                    value={examForm.class_id}
                    onChange={(e) => setExamForm({ ...examForm, class_id: e.target.value })}
                    required
                    disabled={editingExamId !== null}
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Description / Remarks (Optional)</label>
                  <input
                    type="text"
                    className="sp-input"
                    placeholder="e.g. Surprise test or mid-term"
                    value={examForm.description}
                    onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Publish Status</label>
                  <select
                    className="sp-input"
                    value={examForm.status}
                    onChange={(e) => setExamForm({ ...examForm, status: e.target.value })}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
              </div>

              {/* Subject list setup */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>Configure Subjects & Max Marks *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setExamForm({
                        ...examForm,
                        subjects: [...examForm.subjects, { subject_name: '', max_marks: 100 }]
                      });
                    }}
                    className="btn-outline"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add Subject
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {examForm.subjects.map((sub, sIdx) => (
                    <div key={sIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="sp-input"
                        placeholder="Subject Name (e.g. Mathematics)"
                        value={sub.subject_name}
                        onChange={(e) => {
                          const updated = [...examForm.subjects];
                          updated[sIdx].subject_name = e.target.value;
                          setExamForm({ ...examForm, subjects: updated });
                        }}
                        required
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          className="sp-input"
                          placeholder="Max Marks"
                          min="1"
                          value={sub.max_marks}
                          onChange={(e) => {
                            const updated = [...examForm.subjects];
                            updated[sIdx].max_marks = parseInt(e.target.value) || 100;
                            setExamForm({ ...examForm, subjects: updated });
                          }}
                          required
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>marks</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (examForm.subjects.length > 1) {
                            const updated = examForm.subjects.filter((_, idx) => idx !== sIdx);
                            setExamForm({ ...examForm, subjects: updated });
                          } else {
                            showToast("You must configure at least one subject.", "error");
                          }
                        }}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowExamFormModal(false)}
                  className="btn-outline"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ padding: '8px 24px', borderRadius: '6px' }} 
                  disabled={isSavingExam}
                >
                  {isSavingExam ? 'Saving Exam...' : 'Save Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ENTER MARKS POPUP MODAL --- */}
      {showStudentMarksModal && marksEntryStudent && (() => {
        const classExam = examsList.find(e => parseInt(e.id) === parseInt(marksSelectedExamId));
        const subjects = classExam?.subjects || [];
        const studentMarksRow = examMarks.find(m => m.student_id === marksEntryStudent.id) || { marks: {} };

        // Real-time calculations
        let totalObtained = 0;
        let grandMax = 0;
        subjects.forEach(sub => {
          const val = studentMarksRow.marks[sub.subject_name];
          if (val !== undefined && val !== '') {
            totalObtained += parseFloat(val) || 0;
          }
          grandMax += sub.max_marks;
        });

        const overallPercentage = grandMax > 0 ? roundDecimal((totalObtained / grandMax) * 100, 1) : 0;

        const getGrade = (percentage) => {
          let grade = 'F';
          for (const scale of gradingScales) {
            if (percentage >= scale.min_percentage && percentage <= scale.max_percentage) {
              grade = scale.grade_name;
              break;
            }
          }
          return grade;
        };

        const overallGrade = getGrade(overallPercentage);

        // Validation
        let hasValidationError = false;
        let validationErrorMessage = '';
        subjects.forEach(sub => {
          const val = studentMarksRow.marks[sub.subject_name];
          if (val !== undefined && val !== '') {
            const num = parseFloat(val);
            if (isNaN(num)) {
              hasValidationError = true;
              validationErrorMessage = 'Please enter a valid number.';
            } else if (num < 0) {
              hasValidationError = true;
              validationErrorMessage = 'Marks cannot be negative.';
            } else if (num > sub.max_marks) {
              hasValidationError = true;
              validationErrorMessage = `Marks for ${sub.subject_name} cannot exceed maximum marks (${sub.max_marks}).`;
            }
          }
        });

        const remarkVal = (reportCardRemarks[marksEntryStudent.id] || '').trim();
        const remarkWordsCount = remarkVal.split(/\s+/).filter(Boolean).length;
        const isRemarksTooLong = remarkWordsCount > 12;

        return (
          <div className="modal-overlay" onClick={() => setShowStudentMarksModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '95%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  {isMarksReadOnly ? 'View Exam Grades' : 'Record Exam Grades'}
                </h3>
                <button onClick={() => setShowStudentMarksModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>{marksEntryStudent.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Roll Number: <strong>{marksEntryStudent.roll_number}</strong> | Exam: <strong>{classExam?.name}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {subjects.map(sub => {
                  const currentMark = studentMarksRow.marks[sub.subject_name] !== undefined ? studentMarksRow.marks[sub.subject_name] : '';
                  return (
                    <div key={sub.subject_name} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr auto', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sub.subject_name}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={currentMark}
                        disabled={isMarksReadOnly}
                        onChange={(e) => {
                          if (isMarksReadOnly) return;
                          const val = e.target.value;
                          const updated = examMarks.map(m => {
                            if (m.student_id === marksEntryStudent.id) {
                              return {
                                ...m,
                                marks: {
                                  ...m.marks,
                                  [sub.subject_name]: val
                                }
                              };
                            }
                            return m;
                          });
                          setExamMarks(updated);
                        }}
                        className="sp-input"
                        placeholder="0.00"
                        style={{ padding: '6px' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '60px' }}>/ {sub.max_marks}</span>
                    </div>
                  );
                })}
                {subjects.length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    No subjects scheduled for this classroom.
                  </span>
                )}
              </div>

              {/* Real-time summary display */}
              {subjects.length > 0 && (
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Total Obtained</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '2px' }}>{totalObtained} / {grandMax}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Percentage</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>{overallPercentage}%</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Auto Grade</span>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: overallGrade === 'F' ? '#ef4444' : '#10b981', marginTop: '2px' }}>{overallGrade}</div>
                  </div>
                </div>
              )}

              {/* Teacher Remarks field */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Teacher Remark {isMarksReadOnly ? '' : '(Optional, max 12 words)'}
                </label>
                <input
                  type="text"
                  value={reportCardRemarks[marksEntryStudent.id] || ''}
                  disabled={isMarksReadOnly}
                  onChange={(e) => {
                    if (isMarksReadOnly) return;
                    const val = e.target.value;
                    setReportCardRemarks(prev => ({
                      ...prev,
                      [marksEntryStudent.id]: val
                    }));
                  }}
                  className="sp-input"
                  placeholder={isMarksReadOnly ? 'No remarks recorded.' : 'e.g. Excellent performance'}
                  style={{ width: '100%', padding: '8px' }}
                />
                {isRemarksTooLong && !isMarksReadOnly && (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                    ⚠️ Remarks exceed the limit of 12 words ({remarkWordsCount}/12 words).
                  </div>
                )}
              </div>

              {hasValidationError && !isMarksReadOnly && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  ⚠️ {validationErrorMessage}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                {isMarksReadOnly ? (
                  <button
                    onClick={() => setShowStudentMarksModal(false)}
                    className="btn-primary"
                    style={{ padding: '8px 24px', fontSize: '0.85rem', borderRadius: '6px' }}
                  >
                    Close
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowStudentMarksModal(false)}
                      className="btn-outline"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const payload = subjects.map(s => ({
                          student_id: marksEntryStudent.id,
                          subject_name: s.subject_name,
                          marks_obtained: studentMarksRow.marks[s.subject_name] !== '' ? (parseFloat(studentMarksRow.marks[s.subject_name]) || 0) : 0
                        }));
                        await saveExamMarksBulk(classExam.id, payload);
                        await saveStudentRemarks(classExam.id, [{ student_id: marksEntryStudent.id, remarks: remarkVal }]);
                        fetchExamMarks(classExam);
                        setShowStudentMarksModal(false);
                      }}
                      className="btn-outline"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '6px', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                      disabled={hasValidationError || isRemarksTooLong || subjects.length === 0}
                    >
                      Save Draft
                    </button>
                    <button
                      onClick={async () => {
                        const payload = subjects.map(s => ({
                          student_id: marksEntryStudent.id,
                          subject_name: s.subject_name,
                          marks_obtained: studentMarksRow.marks[s.subject_name] !== '' ? (parseFloat(studentMarksRow.marks[s.subject_name]) || 0) : 0
                        }));
                        await saveExamMarksBulk(classExam.id, payload);
                        await saveStudentRemarks(classExam.id, [{ student_id: marksEntryStudent.id, remarks: remarkVal }]);
                        await toggleExamPublish(classExam, 'Draft');
                        fetchExamMarks(classExam);
                        setShowStudentMarksModal(false);
                      }}
                      className="btn-primary"
                      style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '6px' }}
                      disabled={hasValidationError || isRemarksTooLong || subjects.length === 0}
                    >
                      Publish Result
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}


      {/* --- SIGNATURES & GRADING SCALE SETTINGS MODAL --- */}
      {showSignatureSettings && (
        <div className="modal-overlay" onClick={() => setShowSignatureSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>School Report Settings Panel</h3>
              <button onClick={() => setShowSignatureSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Signatures uploads */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>A4 Official Signatures</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {['teacher_signature', 'class_teacher_signature', 'principal_signature'].map((type) => {
                    const label = type === 'teacher_signature' ? 'Class Teacher' : type === 'class_teacher_signature' ? 'Academic Head' : 'Principal';
                    const signatureImg = schoolSignatures[type];
                    
                    return (
                      <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', textAlign: 'center', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
                        <div style={{ width: '100%', height: '50px', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--border-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {signatureImg ? (
                            <img src={signatureImg} alt={label} style={{ maxHeight: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>None uploaded</span>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          id={`upload-${type}`}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const originalData = reader.result;
                              const autoExtracted = await extractSignature(originalData, { left: 0, right: 0, top: 0, bottom: 0, threshold: 220 });
                              const updatedSigs = { 
                                ...schoolSignatures, 
                                [type]: autoExtracted,
                                [`${type}_original`]: originalData 
                              };
                              setSchoolSignatures(updatedSigs);
                              saveSchoolSignatures(updatedSigs);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => document.getElementById(`upload-${type}`).click()}
                            className="btn-outline"
                            style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px' }}
                          >
                            Upload
                          </button>
                          {signatureImg && (
                            <button
                              type="button"
                              onClick={() => {
                                const orig = schoolSignatures[`${type}_original`] || signatureImg;
                                setCropLeft(0);
                                setCropRight(0);
                                setCropTop(0);
                                setCropBottom(0);
                                setCropThreshold(220);
                                setSigToCrop({
                                  type,
                                  label,
                                  originalDataUrl: orig
                                });
                              }}
                              className="btn-outline"
                              style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                            >
                              Adjust
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grading Scales */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Grading Metrics Matrix</h4>
                  <button
                    onClick={() => {
                      const defaults = [
                        { grade_name: 'A+', min_percentage: 90.00, max_percentage: 100.00 },
                        { grade_name: 'A',  min_percentage: 80.00, max_percentage: 89.99 },
                        { grade_name: 'B',  min_percentage: 70.00, max_percentage: 79.99 },
                        { grade_name: 'C',  min_percentage: 60.00, max_percentage: 69.99 },
                        { grade_name: 'D',  min_percentage: 40.00, max_percentage: 59.99 },
                        { grade_name: 'F',  min_percentage: 0.00,  max_percentage: 39.99 }
                      ];
                      setGradingScales(defaults);
                      saveGradingScales(defaults);
                    }}
                    className="btn-outline"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                  >
                    Reset Defaults
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {gradingScales.map((scale, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 2fr auto', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="sp-input"
                        value={scale.grade_name}
                        onChange={(e) => {
                          const updated = [...gradingScales];
                          updated[idx].grade_name = e.target.value;
                          setGradingScales(updated);
                        }}
                        style={{ padding: '6px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Min%:</span>
                        <input
                          type="number"
                          step="0.01"
                          className="sp-input"
                          value={scale.min_percentage}
                          onChange={(e) => {
                            const updated = [...gradingScales];
                            updated[idx].min_percentage = parseFloat(e.target.value) || 0;
                            setGradingScales(updated);
                          }}
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Max%:</span>
                        <input
                          type="number"
                          step="0.01"
                          className="sp-input"
                          value={scale.max_percentage}
                          onChange={(e) => {
                            const updated = [...gradingScales];
                            updated[idx].max_percentage = parseFloat(e.target.value) || 0;
                            setGradingScales(updated);
                          }}
                          style={{ padding: '6px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = gradingScales.filter((_, sIdx) => sIdx !== idx);
                          setGradingScales(updated);
                        }}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                        disabled={gradingScales.length <= 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => {
                      setGradingScales([...gradingScales, { grade_name: 'New Grade', min_percentage: 0.00, max_percentage: 0.00 }]);
                    }}
                    className="btn-outline"
                    style={{ padding: '6px', fontSize: '0.8rem', width: '100%', borderStyle: 'dashed' }}
                  >
                    + Add Grade Bracket
                  </button>
                </div>

                <button
                  onClick={() => {
                    saveGradingScales(gradingScales);
                    setShowSignatureSettings(false);
                  }}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '20px', justifyContent: 'center' }}
                >
                  Save settings and scales
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- REPORT CARD PREVIEW MODAL --- */}
      {showReportPreviewModal && selectedReportStudent && (() => {
        const student = selectedReportStudent;
        const examId = marksSelectedExamId;
        const keySuffix = schoolId || 'default';
        const activeYearName = years.find(y => y.id === activeYearId)?.name || '';

        // If performance summary is loading or not available
        if (!studentPerformanceSummary) {
          return (
            <div className="modal-overlay" onClick={() => setShowReportPreviewModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', padding: '40px', textAlign: 'center' }}>
                <RefreshCw className="spin" size={24} style={{ marginBottom: '12px', color: 'var(--color-primary)' }} />
                <div>Loading report card data...</div>
              </div>
            </div>
          );
        }

        const { attendance, exams, signatures, grading_scales } = studentPerformanceSummary;

        const getGrade = (percentage) => {
          let grade = 'F';
          for (const scale of grading_scales || gradingScales) {
            if (percentage >= scale.min_percentage && percentage <= scale.max_percentage) {
              grade = scale.grade_name;
              break;
            }
          }
          return grade;
        };

        let reportTitle = '';
        let marksRowsData = [];
        let grandMax = 0;
        let grandObtained = 0;
        let examRank = '-';

        const activeExam = exams.find(e => parseInt(e.id) === parseInt(examId));
        if (!activeExam) {
          return (
            <div className="modal-overlay" onClick={() => setShowReportPreviewModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', padding: '40px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Exam data not found for this student.</div>
                <button onClick={() => setShowReportPreviewModal(false)} className="btn-primary">Close</button>
              </div>
            </div>
          );
        }

        reportTitle = activeExam.name.toUpperCase();
        examRank = activeExam.rank || '-';

        const subjects = activeExam.subjects || [];
        subjects.forEach(sub => {
          const subName = sub.subject_name;
          const maxMarks = parseFloat(sub.max_marks) || 100;
          const obtained = parseFloat(activeExam.marks[subName]) || 0;

          grandMax += maxMarks;
          grandObtained += obtained;
          const pct = maxMarks > 0 ? roundDecimal((obtained / maxMarks) * 100, 1) : 0;

          marksRowsData.push({
            subject_name: subName,
            max_marks: maxMarks,
            obtained_marks: obtained,
            percentage: pct,
            grade: getGrade(pct)
          });
        });

        const overallPercentage = grandMax > 0 ? roundDecimal((grandObtained / grandMax) * 100, 1) : 0;
        const overallGrade = getGrade(overallPercentage);
        const resultStatus = overallPercentage >= 40 ? 'PASSED' : 'FAILED';
        const remarksText = reportCardRemarks[student.id] || '';

        // PDF download handler
        const handleDownloadPDF = () => {
          const element = document.getElementById('report-card-capture-area');
          if (!element) return;

          const runPDF = () => {
            const opt = {
              margin:       0.3,
              filename:     `Report_Card_${student.name.replace(/\s+/g, '_')}_${activeExam.name.replace(/\s+/g, '_')}.pdf`,
              image:        { type: 'jpeg', quality: 0.98 },
              html2canvas:  { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#111827'
              },
              jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            window.html2pdf().set(opt).from(element).save();
          };

          if (window.html2pdf) {
            runPDF();
          } else {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = runPDF;
            document.body.appendChild(script);
          }
        };

        return (
          <div className="modal-overlay" onClick={() => setShowReportPreviewModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', maxHeight: '95vh', overflowY: 'auto', padding: '24px' }}>
              
              {/* Modal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Student Report Card Preview</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Review grades, print or export PDF</span>
                </div>
                <button onClick={() => setShowReportPreviewModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
              </div>


              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 'bold' }}
                >
                  <Printer size={16} /> Print Report
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 'bold' }}
                >
                  <Download size={16} /> Download PDF
                </button>
              </div>

              {/* Actual printable report card */}
              <div 
                id="report-card-capture-area"
                className="report-card-container report-card-print-area" 
                style={{
                  backgroundColor: '#111827',
                  color: '#f3f4f6',
                  border: '2px solid #374151',
                  borderRadius: '12px',
                  padding: '24px',
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                  width: '100%',
                  maxWidth: '850px',
                  margin: '0 auto',
                  position: 'relative',
                  boxSizing: 'border-box'
                }}
              >
                <style dangerouslySetInnerHTML={{__html: `
                  @media print {
                    @page {
                      size: A4 portrait;
                      margin: 0.3in !important;
                    }
                    html, body {
                      height: 100% !important;
                      margin: 0 !important;
                      padding: 0 !important;
                      overflow: hidden !important;
                      background-color: #111827 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                    }
                    body * {
                      visibility: hidden;
                    }
                    .report-card-print-area, .report-card-print-area * {
                      visibility: visible;
                    }
                    .report-card-print-area {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      max-width: 100% !important;
                      height: auto !important;
                      border: none !important;
                      box-shadow: none !important;
                      padding: 10px !important;
                      margin: 0 !important;
                      background-color: #111827 !important;
                      color: #f3f4f6 !important;
                      -webkit-print-color-adjust: exact !important;
                      print-color-adjust: exact !important;
                      box-sizing: border-box !important;
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                    }
                    .report-card-print-area table {
                      border-color: #374151 !important;
                    }
                    .report-card-print-area th, .report-card-print-area td {
                      border-color: #374151 !important;
                      color: #e5e7eb !important;
                      padding: 6px 10px !important;
                      font-size: 0.75rem !important;
                    }
                    .report-card-print-area strong, .report-card-print-area h2, .report-card-print-area h3, .report-card-print-area h4 {
                      color: #ffffff !important;
                    }
                  }
                `}} />
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderBottom: '3px double #4b5563', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fill: 'currentColor', letterSpacing: '1px', textTransform: 'uppercase', color: '#6366f1', margin: 0 }}>
                    {adminProfile?.school_name || 'B.N. Public School'}
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', marginTop: '2px', fontWeight: 600 }}>
                    Academic Session: {activeYearName}
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '1.5px', marginTop: '8px', color: '#10b981', textTransform: 'uppercase', border: '1px solid #374151', padding: '3px 12px', borderRadius: '4px', marginBlock: '6px 0' }}>
                    {reportTitle}
                  </h3>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid #374151', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block' }}>Student Name:</span>
                    <strong style={{ color: '#ffffff' }}>{student.name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block' }}>Father Name:</span>
                    <strong style={{ color: '#ffffff' }}>{student.father_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block' }}>Mother Name:</span>
                    <strong style={{ color: '#ffffff' }}>{student.mother_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block' }}>Class & Section:</span>
                    <strong style={{ color: '#ffffff' }}>{getClassName(student.class_id)}{student.group_name ? ` (${student.group_name})` : ''}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block' }}>Roll Number:</span>
                    <strong style={{ color: '#ffffff' }}>{student.roll_number}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block' }}>SR Number:</span>
                    <strong style={{ color: '#ffffff' }}>{student.sr_no || 'N/A'}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f3f4f6', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject Performance Analysis</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #374151' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderBottom: '2px solid #374151', fontSize: '0.75rem' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid #374151' }}>Subject</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #374151' }}>Max Marks</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #374151' }}>Obtained Marks</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #374151' }}>Percentage</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marksRowsData.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #374151', fontSize: '0.75rem' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid #374151', fontWeight: 600 }}>{row.subject_name}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #374151' }}>{row.max_marks}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #374151', fontWeight: 700, color: '#f3f4f6' }}>{row.obtained_marks}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #374151', color: '#6366f1', fontWeight: 700 }}>{row.percentage}%</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>
                            <span style={{ color: row.grade === 'F' ? '#ef4444' : '#10b981' }}>{row.grade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ border: '1px solid #374151', borderRadius: '8px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f3f4f6', marginBottom: '6px', textTransform: 'uppercase', margin: 0 }}>Academic Summary</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Grand Total:</span>
                        <strong style={{ color: '#ffffff' }}>{grandObtained} / {grandMax}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Percentage:</span>
                        <strong style={{ color: '#6366f1' }}>{overallPercentage}%</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Overall Grade:</span>
                        <strong style={{ color: overallGrade === 'F' ? '#ef4444' : '#10b981' }}>{overallGrade}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Class Rank:</span>
                        <strong style={{ color: '#ffffff' }}>{examRank}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #374151', paddingTop: '4px', marginTop: '2px' }}>
                        <span style={{ color: '#9ca3af' }}>Result Status:</span>
                        <strong style={{ color: resultStatus === 'PASSED' ? '#10b981' : '#ef4444' }}>{resultStatus}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #374151', borderRadius: '8px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f3f4f6', marginBottom: '6px', textTransform: 'uppercase', margin: 0 }}>Attendance Record</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', marginTop: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Total Working Days:</span>
                        <strong style={{ color: '#ffffff' }}>{attendance?.total || 0} Days</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Days Present:</span>
                        <strong style={{ color: '#10b981' }}>{attendance?.present || 0} Days</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Days Absent:</span>
                        <strong style={{ color: '#ef4444' }}>{attendance?.absent || 0} Days</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Days Leave:</span>
                        <strong style={{ color: '#f59e0b' }}>{attendance?.leave || 0} Days</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #374151', paddingTop: '4px', marginTop: '2px' }}>
                        <span style={{ color: '#9ca3af' }}>Attendance Rate:</span>
                        <strong style={{ color: (attendance?.percentage || 0) >= 75 ? '#10b981' : '#ef4444' }}>{attendance?.percentage || 0}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px', border: '1px solid #374151', borderRadius: '8px', padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.01)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Evaluative Remarks</span>
                  <p style={{ fontSize: '0.85rem', color: '#e5e7eb', fontStyle: 'italic', margin: 0 }}>
                    "{remarksText || 'No remarks recorded.'}"
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', borderTop: '1px dashed #4b5563', paddingTop: '20px', marginTop: '20px', textAlign: 'center' }}>
                  <div>
                    {signatures?.teacher_signature ? (
                      <img src={signatures.teacher_signature} alt="Class Teacher Signature" style={{ height: '35px', objectFit: 'contain', display: 'block', margin: '0 auto 6px auto' }} />
                    ) : (
                      <div style={{ height: '35px', borderBottom: '1px solid #4b5563', width: '80%', margin: '0 auto 6px auto' }}></div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Class Teacher</span>
                  </div>
                  <div>
                    {signatures?.class_teacher_signature ? (
                      <img src={signatures.class_teacher_signature} alt="Co-Teacher Signature" style={{ height: '35px', objectFit: 'contain', display: 'block', margin: '0 auto 6px auto' }} />
                    ) : (
                      <div style={{ height: '35px', borderBottom: '1px solid #4b5563', width: '80%', margin: '0 auto 6px auto' }}></div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Academic Head</span>
                  </div>
                  <div>
                    {signatures?.principal_signature ? (
                      <img src={signatures.principal_signature} alt="Principal Signature" style={{ height: '35px', objectFit: 'contain', display: 'block', margin: '0 auto 6px auto' }} />
                    ) : (
                      <div style={{ height: '35px', borderBottom: '1px solid #4b5563', width: '80%', margin: '0 auto 6px auto' }}></div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block' }}>Principal</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* --- SIGNATURE ADJUSTMENT MODAL --- */}
      {sigToCrop && (
        <div className="modal-overlay" onClick={() => setSigToCrop(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} style={{ color: 'var(--color-primary)' }} />
                Crop &amp; Extract: {sigToCrop.label}
              </h3>
              <button onClick={() => setSigToCrop(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              {/* Left Column: Original and sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Adjust controls below to isolate the signature lines. The white background is automatically extracted to transparent.
                </div>
                
                {/* Sliders */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>
                      <span>Binarization Threshold: {cropThreshold}</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="255" 
                      value={cropThreshold} 
                      onChange={(e) => setCropThreshold(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>
                      <span>Crop Left: {cropLeft}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="80" 
                      value={cropLeft} 
                      onChange={(e) => setCropLeft(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>
                      <span>Crop Right: {cropRight}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="80" 
                      value={cropRight} 
                      onChange={(e) => setCropRight(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>
                      <span>Crop Top: {cropTop}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="80" 
                      value={cropTop} 
                      onChange={(e) => setCropTop(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px' }}>
                      <span>Crop Bottom: {cropBottom}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="80" 
                      value={cropBottom} 
                      onChange={(e) => setCropBottom(parseInt(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Right Column: Preview of the crop */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '16px', minHeight: '220px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>Extracted Preview:</span>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '120px', background: '#ffffff', borderRadius: '4px', padding: '10px', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.1)' }}>
                  {cropPreviewUrl ? (
                    <img src={cropPreviewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Processing...</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  White background is removed automatically. Gray grid/lines represent transparency.
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn-outline" 
                onClick={() => setSigToCrop(null)}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => {
                  if (cropPreviewUrl) {
                    const updatedSigs = { 
                      ...schoolSignatures, 
                      [sigToCrop.type]: cropPreviewUrl,
                      [`${sigToCrop.type}_original`]: sigToCrop.originalDataUrl 
                    };
                    setSchoolSignatures(updatedSigs);
                    saveSchoolSignatures(updatedSigs);
                    setSigToCrop(null);
                  }
                }}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Apply Adjustments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT STUDENT MODAL --- */}
      {showAddStudentModal && (
        <div className="modal-overlay" onClick={() => { setShowAddStudentModal(false); setEditingStudent(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>
                {editingStudent ? 'Edit Student Profile' : `Admit Student - ${getClassName(selectedClassId)}`}
              </h3>
              <button onClick={() => { setShowAddStudentModal(false); setEditingStudent(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Photo Upload/Remove Area */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.01)' }}>
                <img 
                  src={getStudentAvatar(sForm)} 
                  alt="Preview" 
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Profile Photo</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn-outline" 
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => document.getElementById('student-photo-upload').click()}
                    >
                      Upload Photo
                    </button>
                    {sForm.profile_image && (
                      <button 
                        type="button" 
                        className="btn-outline" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444' }}
                        onClick={() => setSForm({...sForm, profile_image: ''})}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input 
                    id="student-photo-upload" 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setSForm(prev => ({ ...prev, profile_image: reader.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              {/* 1. Student Name & Roll Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-name" className="form-label">Student Name</label>
                  <input 
                    id="s-name" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.name} 
                    onChange={(e) => {
                      setSForm({...sForm, name: e.target.value, class_id: selectedClassId});
                      if (sErrors.name) setSErrors({...sErrors, name: null});
                    }} 
                    required 
                  />
                  {sErrors.name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.name}</div>}
                </div>
                <div>
                  <label htmlFor="s-roll" className="form-label">Roll Number</label>
                  <input 
                    id="s-roll" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.roll_number || ''}
                    onChange={(e) => {
                      setSForm({...sForm, roll_number: e.target.value.replace(/\D/g, '')});
                      if (sErrors.roll_number) setSErrors({...sErrors, roll_number: null});
                    }} 
                    required 
                  />
                  {sErrors.roll_number && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.roll_number}</div>}
                </div>
              </div>

              {/* 2. Father's Name & Mother's Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-father" className="form-label">Father's Name</label>
                  <input 
                    id="s-father" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.father_name || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, father_name: e.target.value});
                      if (sErrors.father_name) setSErrors({...sErrors, father_name: null});
                    }} 
                    required 
                  />
                  {sErrors.father_name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.father_name}</div>}
                </div>
                <div>
                  <label htmlFor="s-mother" className="form-label">Mother's Name</label>
                  <input 
                    id="s-mother" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.mother_name || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, mother_name: e.target.value});
                      if (sErrors.mother_name) setSErrors({...sErrors, mother_name: null});
                    }} 
                    required 
                  />
                  {sErrors.mother_name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.mother_name}</div>}
                </div>
              </div>

              {/* 3. Admission Date, Date of Birth & Exit Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-admission-date" className="form-label">Admission Date</label>
                  <input 
                    id="s-admission-date" 
                    type="date" 
                    className="sp-input" 
                    value={sForm.admission_date || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, admission_date: e.target.value});
                      if (sErrors.admission_date) setSErrors({...sErrors, admission_date: null});
                    }} 
                    required 
                  />
                  {sErrors.admission_date && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.admission_date}</div>}
                </div>
                <div>
                  <label htmlFor="s-dob" className="form-label">Date of Birth</label>
                  <input 
                    id="s-dob" 
                    type="date" 
                    className="sp-input" 
                    value={sForm.date_of_birth || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, date_of_birth: e.target.value});
                      if (sErrors.date_of_birth) setSErrors({...sErrors, date_of_birth: null});
                    }} 
                    required 
                  />
                  {sErrors.date_of_birth && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.date_of_birth}</div>}
                </div>
                <div>
                  <label htmlFor="s-exit-date" className="form-label">Exit Date (Optional)</label>
                  <input 
                    id="s-exit-date" 
                    type="date" 
                    className="sp-input" 
                    value={sForm.exit_date || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, exit_date: e.target.value});
                    }} 
                  />
                </div>
              </div>

              {/* 4. Gender & Blood Group */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-gender" className="form-label">Gender</label>
                  <select 
                    id="s-gender" 
                    className="sp-input" 
                    value={sForm.gender || 'Male'} 
                    onChange={(e) => setSForm({...sForm, gender: e.target.value})}
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="s-blood" className="form-label">Blood Group</label>
                  <select 
                    id="s-blood" 
                    className="sp-input" 
                    value={sForm.blood_group || ''} 
                    onChange={(e) => setSForm({...sForm, blood_group: e.target.value})}
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              {/* 5. Phone Number & Email Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-phone" className="form-label">Contact</label>
                  <input 
                    id="s-phone" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.phone || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, phone: e.target.value});
                      if (sErrors.phone) setSErrors({...sErrors, phone: null});
                    }} 
                  />
                  {sErrors.phone && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.phone}</div>}
                </div>
                <div>
                  <label htmlFor="s-email" className="form-label">Email Address</label>
                  <input 
                    id="s-email" 
                    type="email" 
                    className="sp-input" 
                    value={sForm.email || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, email: e.target.value});
                      if (sErrors.email) setSErrors({...sErrors, email: null});
                    }} 
                  />
                  {sErrors.email && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.email}</div>}
                </div>
              </div>

              {/* 6. Emergency Contact Phone & Aadhaar Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-contact" className="form-label">Emergency Phone</label>
                  <input 
                    id="s-contact" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.emergency_contact || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, emergency_contact: e.target.value});
                      if (sErrors.emergency_contact) setSErrors({...sErrors, emergency_contact: null});
                    }} 
                  />
                  {sErrors.emergency_contact && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.emergency_contact}</div>}
                </div>
                <div>
                  <label htmlFor="s-aadhaar" className="form-label">Aadhaar Number</label>
                  <input 
                    id="s-aadhaar" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.aadhaar_number || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, aadhaar_number: e.target.value});
                      if (sErrors.aadhaar_number) setSErrors({...sErrors, aadhaar_number: null});
                    }} 
                    required 
                  />
                  {sErrors.aadhaar_number && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.aadhaar_number}</div>}
                </div>
              </div>

              {/* 7. Home Address & SR No. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-address" className="form-label">Home Address</label>
                  <textarea 
                    id="s-address" 
                    className="sp-input" 
                    value={sForm.address || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, address: e.target.value});
                      if (sErrors.address) setSErrors({...sErrors, address: null});
                    }} 
                    required 
                    rows={1}
                    style={{ 
                      width: '100%', 
                      minHeight: '38px', 
                      resize: 'none',
                      overflowY: 'hidden',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Enter home address"
                  />
                  {sErrors.address && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.address}</div>}
                </div>
                <div>
                  <label htmlFor="s-sr-no" className="form-label">SR No.</label>
                  <input 
                    id="s-sr-no" 
                    type="text" 
                    className="sp-input" 
                    value={sForm.sr_no || ''} 
                    onChange={(e) => {
                      setSForm({...sForm, sr_no: e.target.value});
                      if (sErrors.sr_no) setSErrors({...sErrors, sr_no: null});
                    }} 
                    required 
                    style={{ height: '38px', width: '100%' }}
                  />
                  {sErrors.sr_no && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.sr_no}</div>}
                </div>
              </div>

              {/* 7.5. Nationality & Caste */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-nationality" className="form-label">Nationality</label>
                  <select
                    id="s-nationality"
                    className="sp-input"
                    value={sForm.nationality || 'Indian'}
                    onChange={(e) => {
                      setSForm({...sForm, nationality: e.target.value});
                      if (sErrors.nationality) setSErrors({...sErrors, nationality: null});
                    }}
                    required
                    style={{ height: '38px', width: '100%' }}
                  >
                    <option value="Indian">Indian</option>
                    <option value="Afghan">Afghan</option>
                    <option value="American">American</option>
                    <option value="Australian">Australian</option>
                    <option value="Bangladeshi">Bangladeshi</option>
                    <option value="British">British</option>
                    <option value="Canadian">Canadian</option>
                    <option value="Chinese">Chinese</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Indonesian">Indonesian</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Kuwaiti">Kuwaiti</option>
                    <option value="Malaysian">Malaysian</option>
                    <option value="Nepalese">Nepalese</option>
                    <option value="New Zealander">New Zealander</option>
                    <option value="Omani">Omani</option>
                    <option value="Pakistani">Pakistani</option>
                    <option value="Qatari">Qatari</option>
                    <option value="Saudi">Saudi</option>
                    <option value="Singaporean">Singaporean</option>
                    <option value="South African">South African</option>
                    <option value="Sri Lankan">Sri Lankan</option>
                    <option value="UAE National">UAE National</option>
                    <option value="Other">Other</option>
                  </select>
                  {sErrors.nationality && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.nationality}</div>}
                </div>
                <div>
                  <label htmlFor="s-caste" className="form-label">Caste (Optional)</label>
                  <input
                    id="s-caste"
                    type="text"
                    placeholder="Enter caste"
                    className="sp-input"
                    value={sForm.caste || ''}
                    onChange={(e) => {
                      setSForm({...sForm, caste: e.target.value});
                      if (sErrors.caste) setSErrors({...sErrors, caste: null});
                    }}
                    style={{ height: '38px', width: '100%' }}
                  />
                  {sErrors.caste && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.caste}</div>}
                </div>
              </div>

              {/* 8. Country, State & City */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="s-country" className="form-label">Country</label>
                  <select
                    id="s-country"
                    className="sp-input"
                    value={sForm.country || ''}
                    onChange={(e) => {
                      const country = e.target.value;
                      setSForm({ ...sForm, country, state: '', city: '' });
                      if (sErrors.country) setSErrors({...sErrors, country: null});
                    }}
                    required
                  >
                    <option value="">-- Country --</option>
                    {Object.keys(LOCATION_DATA).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {sErrors.country && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.country}</div>}
                </div>
                
                <div>
                  <label htmlFor="s-state" className="form-label">State</label>
                  <select
                    id="s-state"
                    className="sp-input"
                    value={sForm.state || ''}
                    disabled={!sForm.country}
                    onChange={(e) => {
                      const state = e.target.value;
                      setSForm({ ...sForm, state, city: '' });
                      if (sErrors.state) setSErrors({...sErrors, state: null});
                    }}
                    required
                  >
                    <option value="">-- State --</option>
                    {sForm.country && Object.keys(LOCATION_DATA[sForm.country] || {}).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {sErrors.state && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.state}</div>}
                </div>

                <div>
                  <label htmlFor="s-city" className="form-label">City</label>
                  <select
                    id="s-city"
                    className="sp-input"
                    value={sForm.city || ''}
                    disabled={!sForm.state}
                    onChange={(e) => {
                      setSForm({ ...sForm, city: e.target.value });
                      if (sErrors.city) setSErrors({...sErrors, city: null});
                    }}
                    required
                  >
                    <option value="">-- City --</option>
                    {sForm.country && sForm.state && (LOCATION_DATA[sForm.country][sForm.state] || []).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {sErrors.city && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>{sErrors.city}</div>}
                </div>
              </div>

              {/* 9. Section */}
              <div>
                <label htmlFor="s-group-name" className="form-label">Section (Optional)</label>
                <input 
                  id="s-group-name" 
                  type="text" 
                  placeholder="e.g. Section A, Section B" 
                  className="sp-input" 
                  value={sForm.group_name || ''} 
                  onChange={(e) => setSForm({...sForm, group_name: e.target.value})} 
                />
              </div>

              {/* Document Management Section */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>Student Documents</h4>
                
                {/* Upload Controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Document Type</label>
                    <select
                      id="upload-student-doc-type"
                      className="sp-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      defaultValue=""
                    >
                      <option value="">-- Choose Type --</option>
                      <option value="Birth Certificate">Birth Certificate</option>
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="Transfer Certificate (TC)">Transfer Certificate (TC)</option>
                      <option value="Caste Certificate">Caste Certificate</option>
                      <option value="Income Certificate">Income Certificate</option>
                      <option value="Residence Certificate">Residence Certificate</option>
                      <option value="Previous School Marksheet">Previous School Marksheet</option>
                      <option value="Passport Size Photograph">Passport Size Photograph</option>
                      <option value="Migration Certificate">Migration Certificate</option>
                      <option value="Character Certificate">Character Certificate</option>
                      <option value="Medical Certificate">Medical Certificate</option>
                      <option value="Other Supporting Documents">Other Supporting Documents</option>
                    </select>
                  </div>
                  
                  <div style={{ flex: '1', minWidth: '150px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Choose File (PDF, JPG, PNG)</label>
                    <input
                      id="upload-student-doc-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sp-input"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        const docType = document.getElementById('upload-student-doc-type').value;
                        if (!file) return;
                        if (!docType) {
                          alert("Please select a Document Type first.");
                          e.target.value = "";
                          return;
                        }
                        
                        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
                        if (!allowedTypes.includes(file.type)) {
                          alert("Only PDF, JPG, JPEG, and PNG formats are allowed.");
                          e.target.value = "";
                          return;
                        }
                        
                        const maxSize = 5 * 1024 * 1024;
                        if (file.size > maxSize) {
                          alert("File size exceeds 5MB limit.");
                          e.target.value = "";
                          return;
                        }
                        
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64data = reader.result;
                          const newDoc = {
                            id: Date.now() + Math.random(),
                            type: docType,
                            name: file.name,
                            url: base64data,
                            size_str: (file.size / 1024).toFixed(1) + " KB",
                            uploaded_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                          };
                          
                          setSForm(prev => {
                            const currentDocs = prev.documents || [];
                            const filtered = currentDocs.filter(d => d.type !== docType);
                            return {
                              ...prev,
                              documents: [...filtered, newDoc]
                            };
                          });
                          
                          document.getElementById('upload-student-doc-type').value = "";
                          e.target.value = "";
                          showToast(`${docType} attached successfully!`, 'success');
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                </div>

                {/* Uploaded Documents List */}
                {sForm.documents && sForm.documents.length > 0 ? (
                  <div className="sp-table-container" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="sp-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Document Type</th>
                          <th>File Name</th>
                          <th>Uploaded</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sForm.documents.map((doc) => (
                          <tr key={doc.id}>
                            <td style={{ fontWeight: 600 }}>{doc.type}</td>
                            <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>{doc.name}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{doc.uploaded_at.split(' ')[0]}</td>
                            <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', border: 'none' }}>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                onClick={() => {
                                  const win = window.open();
                                  if (win) {
                                    win.document.write(`<iframe src="${doc.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                  } else {
                                    alert("Pop-up blocked. Please allow pop-ups to view document.");
                                  }
                                }}
                              >
                                View
                              </button>
                              <a
                                href={doc.url}
                                download={doc.name}
                                className="btn-outline"
                                style={{ padding: '2px 6px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                              >
                                Download
                              </a>
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ padding: '2px 6px', fontSize: '0.7rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                onClick={() => {
                                  setSForm(prev => ({
                                    ...prev,
                                    documents: prev.documents.filter(d => d.id !== doc.id)
                                  }));
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    No documents attached yet.
                  </div>
                )}
              </div>

              {actionError && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{actionError}</div>}
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ marginTop: '10px', justifyContent: 'center' }} 
                disabled={isSavingStudent}
              >
                {isSavingStudent ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      style={{ 
                        border: '2px solid rgba(255,255,255,0.2)', 
                        borderTop: '2px solid white', 
                        borderRadius: '50%', 
                        width: '14px', 
                        height: '14px', 
                        animation: 'spin 0.8s linear infinite' 
                      }}
                    ></span>
                    Saving...
                  </span>
                ) : 'Save details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- FEE CONFIG REQUIRED MODAL --- */}
      {showFeeConfigRequiredModal && (
        <div className="modal-overlay" onClick={() => setShowFeeConfigRequiredModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button 
                id="btn-close-fee-config-modal"
                onClick={() => setShowFeeConfigRequiredModal(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>
              Fee Structure Not Configured
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Tuition fee structure has not been configured for this class in the current academic year. Please set up the fees first by going to the Audits & settings page.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                id="btn-modal-cancel-fee-config"
                className="btn-outline"
                onClick={() => setShowFeeConfigRequiredModal(false)}
                style={{ padding: '10px 20px', borderRadius: '6px' }}
              >
                Cancel
              </button>
              <button
                id="btn-modal-goto-fee-config"
                className="btn-primary"
                onClick={() => {
                  setShowFeeConfigRequiredModal(false);
                  if (selectedStudent && selectedStudent.class_id) {
                    setSelectedFeeClassId(String(selectedStudent.class_id));
                    fetchClassFeeStructure(selectedStudent.class_id);
                  }
                  setActiveTab('settings');
                }}
                style={{ padding: '10px 20px', borderRadius: '6px' }}
              >
                Go to Audits & settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CARRY FORWARD DUE PAYMENT / RECOVERY MODAL --- */}
      {showPayRecoveryModal && selectedCarryForwardDue && (
        <div className="modal-overlay" onClick={() => setShowPayRecoveryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Deposit Previous Year Dues</h3>
              <button onClick={() => setShowPayRecoveryModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Student Name:</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                {selectedCarryForwardDue.student_name} ({selectedCarryForwardDue.class_name})
              </strong>
              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Outstanding for Academic Year {selectedCarryForwardDue.original_academic_year || selectedCarryForwardDue.year_range}:</span>
              <strong style={{ fontSize: '1.2rem', color: '#f59e0b' }}>
                {formatMoney(parseFloat(selectedCarryForwardDue.amount) - parseFloat(selectedCarryForwardDue.paid_amount))}
              </strong>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const amt = parseFloat(recoveryAmount);
              const outstanding = parseFloat(selectedCarryForwardDue.amount) - parseFloat(selectedCarryForwardDue.paid_amount);
              if (isNaN(amt) || amt <= 0) {
                showToast("Please enter a valid amount greater than zero.", "error");
                return;
              }
              if (amt > outstanding + 0.01) {
                showToast("Payment amount exceeds outstanding dues.", "error");
                return;
              }
              handlePayCarryForwardDue(selectedCarryForwardDue.student_id, selectedCarryForwardDue.id, amt, recoveryDate);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Payment Amount</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="Enter amount to pay"
                  className="sp-input" 
                  value={recoveryAmount}
                  onChange={(e) => setRecoveryAmount(e.target.value)}
                />
              </div>
              
              <div>
                <label className="form-label">Payment Date</label>
                <input 
                  type="date" 
                  required
                  className="sp-input" 
                  value={recoveryDate}
                  onChange={(e) => setRecoveryDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowPayRecoveryModal(false)}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isRecordingRecovery}
                  className="btn-primary"
                >
                  {isRecordingRecovery ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE CLASS MODAL --- */}
      {showCreateClassModal && (
        <div className="modal-overlay" onClick={() => setShowCreateClassModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Create New Classroom</h3>
              <button onClick={() => setShowCreateClassModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleAddClass(newClassForm.name, '', newClassForm.groups);
              setShowCreateClassModal(false);
              setNewClassForm({ name: '', room: '', groups: [] });
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="c-name" className="form-label">Class Name</label>
                <input 
                  id="c-name" 
                  type="text" 
                  placeholder="e.g. Class 1 or BCA 1st Year"
                  className="sp-input" 
                  value={newClassForm.name} 
                  onChange={(e) => setNewClassForm({...newClassForm, name: e.target.value})} 
                  required 
                />
              </div>

              {/* Section Management Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Optional Sections</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Add sections (e.g. Section A, Section B) if this class is divided into sections. Press Enter or click Add.
                </p>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    id="new-group-name"
                    type="text" 
                    placeholder="Type section name..." 
                    className="sp-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.target.value.trim();
                        if (!val) return;
                        if (newClassForm.groups.some(g => g.toLowerCase() === val.toLowerCase())) {
                          alert("Duplicate section name in class!");
                          return;
                        }
                        setNewClassForm({ ...newClassForm, groups: [...newClassForm.groups, val] });
                        e.target.value = '';
                      }
                    }}
                  />
                  <button 
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      const input = document.getElementById('new-group-name');
                      const val = input.value.trim();
                      if (!val) return;
                      if (newClassForm.groups.some(g => g.toLowerCase() === val.toLowerCase())) {
                        alert("Duplicate section name in class!");
                        return;
                      }
                      setNewClassForm({ ...newClassForm, groups: [...newClassForm.groups, val] });
                      input.value = '';
                    }}
                  >
                    Add
                  </button>
                </div>

                {newClassForm.groups.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    {newClassForm.groups.map((g, idx) => (
                      <span key={idx} className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        {g}
                        <button 
                          type="button" 
                          onClick={() => setNewClassForm({ ...newClassForm, groups: newClassForm.groups.filter((_, i) => i !== idx) })}
                          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px', justifyContent: 'center' }}>Create Classroom</button>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT CLASS MODAL --- */}
      {showEditClassModal && editingClass && (
        <div className="modal-overlay" onClick={() => { setShowEditClassModal(false); setEditingClass(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Edit Classroom</h3>
              <button onClick={() => { setShowEditClassModal(false); setEditingClass(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateClass(editingClass.id, editClassForm.name);
              setShowEditClassModal(false);
              setEditingClass(null);
            }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="edit-c-name" className="form-label">Class Name</label>
                <input 
                  id="edit-c-name" 
                  type="text" 
                  placeholder="e.g. Class 1 or BCA 1st Year"
                  className="sp-input" 
                  value={editClassForm.name} 
                  onChange={(e) => setEditClassForm({...editClassForm, name: e.target.value})} 
                  required 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px', justifyContent: 'center' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* --- RECEIPT MODAL --- */}
      {receiptRecord && receiptStudent && (
        <div className="modal-overlay" onClick={() => { setReceiptRecord(null); setReceiptStudent(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div id="receipt-print-area" className="receipt-box">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {schoolName || "SCHOOL HUB"}
                </h3>
                <p style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {receiptRecord.fee_name ? `${receiptRecord.fee_name.toUpperCase()} RECEIPT` : "TUITION FEE RECEIPT"}
                </p>
                <p>---------------------------------</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div><strong>STUDENT NAME:</strong> {receiptStudent.name}</div>
                <div><strong>CLASSROOM SECTION:</strong> {getClassName(receiptStudent.class_id)}</div>
                <div><strong>SR NO:</strong> {receiptStudent.sr_no || 'N/A'}</div>
                <div><strong>INVOICE TRANSACTION ID:</strong> {(() => {
                  const schoolPart = String(schoolId || 1).padStart(2, '0').slice(-2);
                  const studentPart = String(receiptStudent.id || 1).padStart(4, '0').slice(-4);
                  const recordPart = String(receiptRecord.id || 1).padStart(6, '0').slice(-6);
                  return `${schoolPart}${studentPart}${recordPart}`;
                })()}</div>
                <div><strong>ACADEMIC SESSION:</strong> {getActiveYearRange()}</div>
                
                {receiptRecord.isMultiMonth ? (
                  <>
                    <div><strong>MONTHS PAID:</strong>
                      <ul style={{ paddingLeft: '20px', marginTop: '4px', marginBottom: '4px', listStyleType: 'disc' }}>
                        {receiptRecord.records.map(r => {
                          const range = getActiveYearRange();
                          const [startYearStr, endYearStr] = range.split('-');
                          const startYear = parseInt(startYearStr) || 2026;
                          const endYear = parseInt(endYearStr) || 2027;
                          const monthsOrder = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
                          const idx = monthsOrder.indexOf(r.month);
                          const year = idx <= 8 ? startYear : endYear;
                          return (
                            <li key={r.month}>{r.month} {year} ({formatMoney(r.amount)})</li>
                          );
                        })}
                      </ul>
                    </div>
                    <div><strong>FEE AMOUNT:</strong> {receiptRecord.records.map(r => formatMoney(r.amount)).join(' + ')}</div>
                  </>
                ) : (
                  <>
                    {receiptRecord.fee_name ? (
                      <div><strong>FEE TYPE:</strong> {receiptRecord.fee_name}</div>
                    ) : (
                      <div><strong>BILLING MONTH:</strong> {receiptRecord.month}</div>
                    )}
                    {!receiptRecord.fee_name && receiptRecord.due_date && (
                      <div><strong>DUE DEADLINE DATE:</strong> {formatDate(receiptRecord.due_date)}</div>
                    )}
                  </>
                )}
                
                <div><strong>RECEIPT PAYMENT DATE:</strong> {formatDate(receiptRecord.payment_date)}</div>
                <p>---------------------------------</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem' }}>
                  <span>{receiptRecord.isMultiMonth ? 'TOTAL PAID:' : (receiptRecord.fee_name ? `${receiptRecord.fee_name.toUpperCase()}:` : 'TUITION AMOUNT:')}</span>
                  <span>{formatMoney(receiptRecord.amount)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>TRANSACTION STATUS:</span>
                  <span style={{ color: '#10b981' }}>PAID / RECEIVED</span>
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem' }}>
                <p>This is a computer generated receipt.</p>
                <p>Thank you for your payment!</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '12px' }}>
              <button onClick={handleDownloadPDF} className="btn-primary" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }}>
                <Download size={14} /> Download PDF
              </button>
              <button onClick={() => window.print()} className="btn-primary">
                <Printer size={14} /> Print Receipt
              </button>
              <button onClick={() => { setReceiptRecord(null); setReceiptStudent(null); }} className="btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PREVIOUS YEAR RECOVERY RECEIPT MODAL --- */}
      {showRecoveryReceiptModal && selectedRecoveryReceiptDue && selectedRecoveryReceiptRec && (
        <div className="modal-overlay" onClick={() => { setShowRecoveryReceiptModal(false); setSelectedRecoveryReceiptDue(null); setSelectedRecoveryReceiptRec(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div id="recovery-receipt-print-area" className="receipt-box">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  PREVIOUS YEAR DUES RECOVERY RECEIPT
                </h3>
                <p style={{ textTransform: 'uppercase' }}>{schoolName}</p>
                <p>---------------------------------</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div><strong>STUDENT NAME:</strong> {selectedRecoveryReceiptDue.student_name}</div>
                <div><strong>LAST YEAR CLASS:</strong> {selectedRecoveryReceiptDue.class_name}</div>
                <div><strong>ORIGINAL ACADEMIC YEAR:</strong> {selectedRecoveryReceiptDue.original_academic_year || selectedRecoveryReceiptDue.year_range}</div>
                <div><strong>RECOVERY TRANSACTION ID:</strong> {(() => {
                  const schoolPart = String(schoolId || 1).padStart(2, '0').slice(-2);
                  const studentPart = String(selectedRecoveryReceiptDue.student_id || 1).padStart(4, '0').slice(-4);
                  const recordPart = String(selectedRecoveryReceiptRec.id || 1).padStart(6, '0').slice(-6);
                  return `${schoolPart}${studentPart}${recordPart}`;
                })()}</div>
                <div><strong>RECEIPT PAYMENT DATE:</strong> {formatDate(selectedRecoveryReceiptRec.recovery_date)}</div>
                <p>---------------------------------</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem' }}>
                  <span>RECOVERED AMOUNT:</span>
                  <span>{formatMoney(selectedRecoveryReceiptRec.amount_recovered)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>TRANSACTION STATUS:</span>
                  <span style={{ color: '#10b981' }}>PAID / RECEIVED</span>
                </div>
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem' }}>
                <p>This is a computer generated receipt.</p>
                <p>Thank you for your payment!</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', gap: '12px' }}>
              <button onClick={handleDownloadRecoveryPDF} className="btn-primary" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-secondary)' }}>
                <Download size={14} /> Download PDF
              </button>
              <button onClick={() => window.print()} className="btn-primary">
                <Printer size={14} /> Print Receipt
              </button>
              <button onClick={() => { setShowRecoveryReceiptModal(false); setSelectedRecoveryReceiptDue(null); setSelectedRecoveryReceiptRec(null); }} className="btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT ADDITIONAL FEE TYPE MODAL --- */}
      {editingExtraFeeType && (
        <div className="modal-overlay" onClick={() => setEditingExtraFeeType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              Edit Additional Fee Type
            </h3>
            
            <form onSubmit={handleUpdateExtraFeeType} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Fee Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Admission Fee, Examination Fee"
                  value={editExtraFeeTypeName}
                  onChange={(e) => setEditExtraFeeTypeName(e.target.value)}
                  className="sp-input"
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Amount (₹)</label>
                <input 
                  type="number"
                  placeholder="e.g. 500"
                  value={editExtraFeeTypeAmount}
                  onChange={(e) => setEditExtraFeeTypeAmount(e.target.value)}
                  className="sp-input"
                  min="1"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditingExtraFeeType(null)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT PAYMENT PROMISE MODAL --- */}
      {promiseModalOpen && (
        <div className="modal-overlay" onClick={() => setPromiseModalOpen(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              {editingPromise ? 'Edit Payment Promise' : 'Add Payment Promise'}
            </h3>
            
            <form onSubmit={handleSavePaymentPromise} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Searchable Student Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Student Selection</label>
                <input 
                  type="text"
                  placeholder="Type to search student..."
                  value={promiseStudentSearchQuery}
                  onChange={(e) => {
                    setPromiseStudentSearchQuery(e.target.value);
                    if (promiseStudentId) {
                      setPromiseStudentId('');
                    }
                  }}
                  className="sp-input"
                  required
                />
                
                {/* Autopopulated classroom display */}
                {promiseStudentId ? (
                  <div style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: '2px', fontWeight: 500 }}>
                    ✓ Selected Student Class: {(() => {
                      const match = students.find(st => st.id === parseInt(promiseStudentId));
                      return match ? getClassName(match.class_id) : 'Unassigned';
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Please select a student from the dropdown results.
                  </div>
                )}

                {/* Dropdown Options */}
                {!promiseStudentId && promiseStudentSearchQuery.trim().length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    background: '#111827',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    marginTop: '4px'
                  }}>
                    {(() => {
                      const list = students.filter(st => 
                        st.name.toLowerCase().includes(promiseStudentSearchQuery.toLowerCase())
                      );
                      if (list.length === 0) {
                        return (
                          <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No matching students found
                          </div>
                        );
                      }
                      return list.map(st => (
                        <div
                          key={st.id}
                          onClick={() => {
                            setPromiseStudentId(st.id);
                            setPromiseStudentSearchQuery(`${st.name} (${st.roll_number})`);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          <strong>{st.name} ({st.roll_number})</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getClassName(st.class_id)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Promise Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Promise Date</label>
                <input 
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="sp-input"
                  required
                />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
                <textarea 
                  placeholder="Parent promised to deposit pending fee after..."
                  value={promiseDescription}
                  onChange={(e) => setPromiseDescription(e.target.value)}
                  className="sp-input"
                  style={{ minHeight: '100px', resize: 'vertical', padding: '10px', fontSize: '0.9rem', lineHeight: '1.4' }}
                />
              </div>

              {/* Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Promise Status</label>
                <select
                  value={promiseStatus}
                  onChange={(e) => setPromiseStatus(e.target.value)}
                  className="sp-input"
                >
                  <option value="Pending">Pending</option>
                  <option value="Fulfilled">Fulfilled</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setPromiseModalOpen(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSavingPromise || !promiseStudentId}>
                  {isSavingPromise ? 'Saving...' : editingPromise ? 'Save Changes' : 'Add Promise'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

              {/* Schedule Copy Confirmation Modal */}
              {scheduleCopyConfirm && (
                <div className="modal-overlay" onClick={() => setScheduleCopyConfirm(null)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f59e0b',
                        marginBottom: '8px'
                      }}>
                        <Copy size={32} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Replace Schedule</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                        Replace existing schedule for {scheduleCopyConfirm.targetDay}?
                      </p>
                      
                      <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                        <button 
                          onClick={() => {
                            scheduleCopyConfirm.onConfirm();
                            setScheduleCopyConfirm(null);
                          }}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Replace
                        </button>
                        <button 
                          onClick={() => setScheduleCopyConfirm(null)}
                          className="btn-outline"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Confirm Modal */}
              {showWhatsappConfirmModal && (() => {
                const currentClass = classes.find(c => c.id === plannerClassId);
                const className = currentClass ? currentClass.name : `Class ${plannerClassId}`;
                return (
                  <div className="modal-overlay" onClick={() => setShowWhatsappConfirmModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'rgba(16, 185, 129, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#10b981',
                          marginBottom: '8px'
                        }}>
                          <Bell size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Send WhatsApp Reminders</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                          Send tomorrow's schedule reminder to all parents of {className}?
                        </p>
                        
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          fontSize: '0.8rem',
                          color: '#fbbf24',
                          textAlign: 'left',
                          width: '100%',
                          marginTop: '8px'
                        }}>
                          ⚠️ <strong>WhatsApp Integration Pending</strong>: The reminder engine is running in sandbox/simulation mode. No real WhatsApp messages will be delivered.
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                          <button 
                            onClick={executeSendWhatsappReminders}
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center', backgroundColor: '#10b981', borderColor: '#10b981' }}
                          >
                            Send Reminders
                          </button>
                          <button 
                            onClick={() => setShowWhatsappConfirmModal(false)}
                            className="btn-outline"
                            style={{ flex: 1, justifyContent: 'center' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* WhatsApp Progress Modal */}
              {showWhatsappProgressModal && (
                <div className="modal-overlay">
                  <div className="modal-content" style={{ maxWidth: '600px', padding: '32px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📲 WhatsApp Schedule Reminders
                    </h3>
                    
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      fontSize: '0.8rem',
                      color: '#fbbf24',
                      marginBottom: '20px'
                    }}>
                      ⚠️ <strong>Sandbox Mode Active</strong>: Real-time sending is simulated. Configure a provider (Meta Cloud API, Twilio, etc.) to enable production delivery.
                    </div>
                    
                    {/* Status Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{whatsappProgress.total}</div>
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', textAlign: 'center', color: '#10b981' }}>
                        <span style={{ fontSize: '0.75rem', color: '#10b981', opacity: 0.8 }}>Sent</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{whatsappProgress.sent}</div>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'center', color: '#ef4444' }}>
                        <span style={{ fontSize: '0.75rem', color: '#ef4444', opacity: 0.8 }}>Failed</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{whatsappProgress.failed}</div>
                      </div>
                      <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', textAlign: 'center', color: '#f59e0b' }}>
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', opacity: 0.8 }}>Pending</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{whatsappProgress.pending}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <span>Progress</span>
                        <span>{Math.round(((whatsappProgress.sent + whatsappProgress.failed) / (whatsappProgress.total || 1)) * 100)}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${((whatsappProgress.sent + whatsappProgress.failed) / (whatsappProgress.total || 1)) * 100}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #10b981, #3b82f6)',
                          transition: 'width 0.15s ease'
                        }} />
                      </div>
                    </div>

                    {/* Live Processing Queue list */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', maxHeight: '250px', overflowY: 'auto' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>Auditing logs / Real-time queue</h4>
                      {whatsappQueue.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px' }}>
                          Initializing delivery channel...
                        </div>
                      ) : (
                        <table className="sp-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Number</th>
                              <th>Status</th>
                              <th>Log</th>
                            </tr>
                          </thead>
                          <tbody>
                            {whatsappQueue.map((item, idx) => {
                              const isCompleted = idx < (whatsappProgress.sent + whatsappProgress.failed);
                              let itemStatus = item.status || 'Pending';
                              let itemErr = item.error_message || '';
                              return (
                                <tr key={item.id}>
                                  <td style={{ fontWeight: 600 }}>{item.student_name}</td>
                                  <td>{item.recipient_number}</td>
                                  <td>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      background: itemStatus === 'Sent' ? 'rgba(16,185,129,0.15)' : (itemStatus === 'Failed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'),
                                      color: itemStatus === 'Sent' ? '#34d399' : (itemStatus === 'Failed' ? '#f87171' : '#fbbf24')
                                    }}>
                                      {itemStatus}
                                    </span>
                                  </td>
                                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={itemErr}>
                                    {itemErr || 'Delivery success'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                      <button 
                        disabled={isSendingWhatsapp}
                        onClick={() => setShowWhatsappProgressModal(false)}
                        className="btn-primary"
                        style={{ padding: '8px 16px' }}
                      >
                        {isSendingWhatsapp ? 'Processing...' : 'Close Logs'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {deleteConfirm && (
                <div className="modal-overlay" onClick={() => { setDeleteConfirm(null); setDeletePassword(''); setDeleteError(''); }}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        marginBottom: '8px'
                      }}>
                        <AlertTriangle size={32} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Confirm Delete</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                        {deleteConfirm.message || 'Are you sure you want to delete permanently?'}
                      </p>
                      
                      <div style={{ width: '100%', textAlign: 'left', marginTop: '12px' }}>
                        <label htmlFor="delete-pwd" className="form-label" style={{ fontWeight: 600 }}>Enter your password to confirm:</label>
                        <input 
                          id="delete-pwd"
                          type="password"
                          autoComplete="new-password"
                          className="sp-input"
                          value={deletePassword}
                          onChange={(e) => {
                            setDeletePassword(e.target.value);
                            setDeleteError('');
                          }}
                          placeholder="Enter your account password"
                          style={{ width: '100%', marginTop: '6px' }}
                        />
                        {deleteError && (
                          <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>
                            {deleteError}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                        <button 
                          onClick={handleConfirmDelete}
                          className="btn-primary"
                          style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
                        >
                          Yes, Delete
                        </button>
                        <button 
                          onClick={() => { setDeleteConfirm(null); setDeletePassword(''); setDeleteError(''); }}
                          className="btn-outline"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Simple Confirmation Modal (No Password) */}
              {simpleConfirm && (
                <div className="modal-overlay" onClick={() => setSimpleConfirm(null)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        marginBottom: '8px'
                      }}>
                        <AlertTriangle size={32} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{simpleConfirm.title || 'Confirm Delete'}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                        {simpleConfirm.message || 'Are you sure you want to delete this?'}
                      </p>
                      
                      <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                        <button 
                          onClick={() => {
                            simpleConfirm.onConfirm();
                            setSimpleConfirm(null);
                          }}
                          className="btn-primary"
                          style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
                        >
                          {simpleConfirm.confirmText || 'Yes, Delete'}
                        </button>
                        <button 
                          onClick={() => setSimpleConfirm(null)}
                          className="btn-outline"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Exam Publish/Draft Confirmation Modal */}
              {examPublishConfirm && (
                <div className="modal-overlay" onClick={() => setExamPublishConfirm(null)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', padding: '28px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                        <h3 style={{ fontSize: '1.20rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          {examPublishConfirm.title}
                        </h3>
                        <button onClick={() => setExamPublishConfirm(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <X size={20} />
                        </button>
                      </div>
                      
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-line', textAlign: 'left' }}>
                        {examPublishConfirm.message}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button 
                          onClick={() => setExamPublishConfirm(null)}
                          className="btn-outline"
                          style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            examPublishConfirm.onConfirm();
                            setExamPublishConfirm(null);
                          }}
                          className="btn-primary"
                          style={{ padding: '8px 20px', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          {examPublishConfirm.confirmText}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- MANAGE SUBJECTS MODAL --- */}
              {showSubjectModal && (
                <div className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <BookOpen size={20} className="gradient-text" />
                        Manage Global Subjects Catalog
                      </h3>
                      <button onClick={() => setShowSubjectModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={18} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Add Subject Form */}
                      <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text"
                          placeholder="Subject Name (e.g. Chemistry)"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          className="sp-input"
                          style={{ flex: 1 }}
                          required
                        />
                        <button type="submit" className="btn-primary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', justifyContent: 'center' }}>
                          <Plus size={16} style={{ marginRight: '4px' }} /> Add
                        </button>
                      </form>

                      {/* Subjects List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Available Subjects ({subjects.length})</span>
                        {subjects.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '0.9rem' }}>
                            No subjects in the catalog. Add one above.
                          </div>
                        ) : (
                          subjects.map(s => (
                            <div 
                              key={s.id}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '10px 14px', 
                                background: 'rgba(255,255,255,0.02)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: 'var(--radius-sm)' 
                              }}
                            >
                              {editingSubjectId === s.id ? (
                                <form onSubmit={handleEditSubject} style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                  <input 
                                    type="text"
                                    value={editingSubjectName}
                                    onChange={(e) => setEditingSubjectName(e.target.value)}
                                    className="sp-input"
                                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }}
                                    required
                                    autoFocus
                                  />
                                  <button type="submit" className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Save</button>
                                  <button type="button" className="btn-outline" onClick={() => setEditingSubjectId(null)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Cancel</button>
                                </form>
                              ) : (
                                <>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{s.name}</span>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => {
                                        setEditingSubjectId(s.id);
                                        setEditingSubjectName(s.name);
                                      }}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                      title="Edit Subject"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete "${s.name}"?`)) {
                                          handleDeleteSubject(s.id);
                                        }
                                      }}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                      title="Delete Subject"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

        {unpayConfirm && (
          <div className="modal-overlay" onClick={() => setUnpayConfirm(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                margin: '0 auto 16px auto'
              }}>
                <AlertTriangle size={30} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0' }}>Revert Payment</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                Are you sure you want to mark <strong>{unpayConfirm.month}</strong>'s tuition fees as <strong>UNPAID</strong>?
              </p>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={async () => {
                    const target = unpayConfirm;
                    setUnpayConfirm(null);
                    await executeRevertFeePayment(target.studentId, target.month);
                  }}
                  className="btn-primary"
                  style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
                >
                  Yes, Revert
                </button>
                <button 
                  onClick={() => setUnpayConfirm(null)}
                  className="btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showGenerateConfirm && (
          <div className="modal-overlay" onClick={() => setShowGenerateConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
                margin: '0 auto 16px auto'
              }}>
                <FileText size={30} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0' }}>Generate Report</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Are you sure you want to generate this report?
              </p>
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                textAlign: 'center',
                marginBottom: '24px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Report Period:</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {formatReportDateStr(reportFromDate)} → {formatReportDateStr(reportToDate)}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={() => setShowGenerateConfirm(false)}
                  className="btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    setShowGenerateConfirm(false);
                    await handleGenerateReport();
                  }}
                  className="btn-primary"
                  style={{ flex: 1, backgroundColor: '#3b82f6', border: '1px solid #3b82f6', color: 'white', justifyContent: 'center' }}
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        )}

        {reportStatusConfirm && (
          <div className="modal-overlay" onClick={() => setReportStatusConfirm(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
                margin: '0 auto 16px auto'
              }}>
                <Info size={30} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0' }}>Change Report Status</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                Are you sure you want to change the status of this report?
              </p>
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                textAlign: 'left',
                marginBottom: '24px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div>Current Status: <span style={{ fontWeight: 700, color: reportStatusConfirm.currentStatus === 'Settled' ? '#10b981' : '#f59e0b' }}>{reportStatusConfirm.currentStatus}</span></div>
                <div>New Status: <span style={{ fontWeight: 700, color: reportStatusConfirm.newStatus === 'Settled' ? '#10b981' : '#f59e0b' }}>{reportStatusConfirm.newStatus}</span></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={() => setReportStatusConfirm(null)}
                  className="btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    const targetId = reportStatusConfirm.id;
                    setReportStatusConfirm(null);
                    await handleToggleSettlement(targetId);
                  }}
                  className="btn-primary"
                  style={{ flex: 1, backgroundColor: '#3b82f6', border: '1px solid #3b82f6', color: 'white', justifyContent: 'center' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {unpayExtraFeeConfirm && (
          <div className="modal-overlay" onClick={() => setUnpayExtraFeeConfirm(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                margin: '0 auto 16px auto'
              }}>
                <AlertTriangle size={30} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0' }}>Revert Payment</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                Are you sure you want to mark <strong>this fee</strong> as <strong>UNPAID</strong>?
              </p>
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                <button 
                  onClick={async () => {
                    const targetId = unpayExtraFeeConfirm.id;
                    setUnpayExtraFeeConfirm(null);
                    await executeRevertExtraFee(targetId);
                  }}
                  className="btn-primary"
                  style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
                >
                  Yes, Revert
                </button>
                <button 
                  onClick={() => setUnpayExtraFeeConfirm(null)}
                  className="btn-outline"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Academic Year Modal */}
        {showCreateYearModal && (
          <div className="modal-overlay" onClick={() => setShowCreateYearModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Register New Academic Year</h3>
                <button onClick={() => setShowCreateYearModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateAcademicYear} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {yearError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                    <span>{yearError}</span>
                  </div>
                )}
                <div>
                  <label className="form-label" htmlFor="new-year-range" style={{ fontWeight: 600 }}>Academic Year Range</label>
                  <input 
                    id="new-year-range"
                    type="text" 
                    value={newYearForm.year_range}
                    onChange={(e) => setNewYearForm({ ...newYearForm, year_range: e.target.value })}
                    placeholder="e.g. 2026-2027" 
                    className="sp-input" 
                    required 
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Auto-generated based on the latest year range, but can be customized.</small>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label" htmlFor="new-year-start" style={{ fontWeight: 600 }}>Start Date</label>
                    <input 
                      id="new-year-start"
                      type="date" 
                      value={newYearForm.start_date}
                      onChange={(e) => setNewYearForm({ ...newYearForm, start_date: e.target.value })}
                      className="sp-input" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="new-year-end" style={{ fontWeight: 600 }}>End Date</label>
                    <input 
                      id="new-year-end"
                      type="date" 
                      value={newYearForm.end_date}
                      onChange={(e) => setNewYearForm({ ...newYearForm, end_date: e.target.value })}
                      className="sp-input" 
                      required 
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" htmlFor="new-year-desc" style={{ fontWeight: 600 }}>Description (Optional)</label>
                  <textarea 
                    id="new-year-desc"
                    value={newYearForm.description}
                    onChange={(e) => setNewYearForm({ ...newYearForm, description: e.target.value })}
                    placeholder="Enter short details about this session..." 
                    className="sp-input" 
                    rows="3"
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" onClick={() => setShowCreateYearModal(false)} className="btn-outline">Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isSavingYear}>
                    {isSavingYear ? 'Saving...' : 'Register Year'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Class Teacher Modal */}
        {assignTeacherModalOpen && (
          <div className="modal-overlay" onClick={() => { setAssignTeacherModalOpen(false); setEditingAssignmentClassId(null); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {editingAssignmentClassId ? 'Replace Class Teacher' : 'Assign Class Teacher'}
                </h3>
                <button onClick={() => { setAssignTeacherModalOpen(false); setEditingAssignmentClassId(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Classroom</label>
                  {editingAssignmentClassId ? (
                    <div className="sp-input" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', height: '42px', padding: '0 12px' }}>
                      {classes.find(c => Number(c.id) === Number(editingAssignmentClassId))?.class_name || 'Selected Class'}
                    </div>
                  ) : (
                    <select 
                      value={assignTeacherClassId} 
                      onChange={(e) => setAssignTeacherClassId(e.target.value)} 
                      className="sp-input"
                    >
                      <option value="">Select Classroom</option>
                      {classes.filter(c => c.class_teacher_id === null).map(c => (
                        <option key={c.id} value={c.id}>{c.class_name}</option>
                      ))}
                    </select>
                  )}
                </div>
                
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Class Teacher</label>
                  <select 
                    value={assignTeacherId} 
                    onChange={(e) => setAssignTeacherId(e.target.value)} 
                    className="sp-input"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.filter(t => {
                      const isAssignedElsewhere = classes.some(c => Number(c.class_teacher_id) === Number(t.id) && Number(c.id) !== Number(editingAssignmentClassId));
                      return !isAssignedElsewhere;
                    }).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button onClick={() => { setAssignTeacherModalOpen(false); setEditingAssignmentClassId(null); }} className="btn-outline">Cancel</button>
                  <button 
                    onClick={() => handleSaveClassTeacher(editingAssignmentClassId || assignTeacherClassId, assignTeacherId)} 
                    className="btn-primary" 
                    disabled={isSavingAssignment || !(editingAssignmentClassId || assignTeacherClassId) || !assignTeacherId}
                  >
                    {isSavingAssignment ? 'Saving...' : 'Save Assignment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Configuration Modal */}
        {credsModalOpen && (
          <div className="modal-overlay" onClick={() => setCredsModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Configure {credsTargetType} Credentials
                </h3>
                <button onClick={() => setCredsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              
              {credsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>Loading credentials details...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {credsExists && (
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', color: '#6ee7b7' }}>
                      🔑 Credentials already configured for this user.
                    </div>
                  )}
                  
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Login ID (Mobile Number)</label>
                    <input 
                      type="text" 
                      value={credsPhone} 
                      disabled 
                      className="sp-input"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
                    />
                  </div>
                  
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Login Password (Visible on screen)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        value={credsPassword} 
                        onChange={(e) => setCredsPassword(e.target.value)}
                        placeholder="Enter or generate password" 
                        className="sp-input"
                      />
                      <button 
                        onClick={() => setCredsPassword(Math.random().toString(36).slice(-8))} 
                        className="btn-outline"
                        style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button onClick={() => setCredsModalOpen(false)} className="btn-outline">Cancel</button>
                    <button 
                      onClick={() => saveCredentials(credsTargetType, credsPhone, credsPassword)} 
                      className="btn-primary" 
                      disabled={credsSaving || !credsPassword}
                    >
                      {credsSaving ? 'Saving...' : 'Save Credentials'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Year Transition / Promotion Wizard Modal */}
        {showTransitionWizard && wizardTargetYear && (
          <div className="modal-overlay">
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Promote to Next Academic Year</h3>
                  <span className="badge badge-warning" style={{ marginTop: '6px' }}>Target Session: {wizardTargetYear.year_range}</span>
                </div>
                <button onClick={() => setShowTransitionWizard(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
              </div>

              {/* Wizard Steps indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', padding: '0 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', background: transitionWizardStep >= 1 ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 'bold' }}>1</div>
                  <span style={{ fontSize: '0.75rem', fontWeight: transitionWizardStep === 1 ? 'bold' : 'normal', color: transitionWizardStep === 1 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Classroom Map</span>
                </div>
                <div style={{ flex: 1, height: '2px', background: transitionWizardStep >= 2 ? 'var(--color-primary)' : 'var(--border-color)', margin: '0 12px', transform: 'translateY(-10px)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', background: transitionWizardStep >= 2 ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 'bold' }}>2</div>
                  <span style={{ fontSize: '0.75rem', fontWeight: transitionWizardStep === 2 ? 'bold' : 'normal', color: transitionWizardStep === 2 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Students List</span>
                </div>
                <div style={{ flex: 1, height: '2px', background: transitionWizardStep >= 3 ? 'var(--color-primary)' : 'var(--border-color)', margin: '0 12px', transform: 'translateY(-10px)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', background: transitionWizardStep >= 3 ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 'bold' }}>3</div>
                  <span style={{ fontSize: '0.75rem', fontWeight: transitionWizardStep === 3 ? 'bold' : 'normal', color: transitionWizardStep === 3 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Safety Confirm</span>
                </div>
              </div>

              {/* Step 1 Content: Class mappings */}
              {transitionWizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="alert alert-info" style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px', color: '#93c5fd' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                      <Shield size={18} /> Step 1: Map Current Classes to Next Classrooms
                    </strong>
                    <span style={{ fontSize: '0.85rem' }}>Select which class gets promoted into which next class. Graduating classes should be mapped to "Alumni / Graduated".</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {classes.map(cls => (
                      <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                        <span style={{ fontWeight: 600 }}>{cls.name} ({students.filter(s => s.class_id === cls.id && s.status === 'Active').length} Active Students)</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Promote to:</span>
                          <select
                            value={wizardClassMappings[cls.id] || ''}
                            onChange={(e) => setWizardClassMappings({ ...wizardClassMappings, [cls.id]: e.target.value })}
                            className="sp-input"
                            style={{ width: '200px', padding: '6px 10px', fontSize: '0.85rem' }}
                          >
                            <option value="Alumni">Alumni / Graduated</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <button type="button" onClick={() => setShowTransitionWizard(false)} className="btn-outline">Cancel</button>
                    <button type="button" onClick={() => setTransitionWizardStep(2)} className="btn-primary">Next: Review Students</button>
                  </div>
                </div>
              )}

              {/* Step 2 Content: Student Checklist */}
              {transitionWizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="alert alert-info" style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px', color: '#93c5fd' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                      <Shield size={18} /> Step 2: Student-Level Promotion Selection
                    </strong>
                    <span style={{ fontSize: '0.85rem' }}>Select which students should be promoted or repeat their class. Unchecking a student keeps them in their current class range for the new academic year.</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                    {classes.map(cls => {
                      const classStudents = students.filter(s => s.class_id === cls.id && s.status === 'Active');
                      if (classStudents.length === 0) return null;
                      return (
                        <div key={cls.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--color-primary)' }}>
                            {cls.name} ({classStudents.length} students)
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {classStudents.map(student => {
                              const isGraduating = wizardClassMappings[cls.id] === 'Alumni';
                              const statusValue = wizardStudentStatus[student.id] || 'promote';
                              return (
                                <div key={student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                  <span style={{ fontSize: '0.85rem' }}><strong>{student.roll_number}</strong> - {student.name}</span>
                                  <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                      <input
                                        type="radio"
                                        name={`status-${student.id}`}
                                        value="promote"
                                        checked={statusValue === 'promote'}
                                        onChange={() => setWizardStudentStatus({ ...wizardStudentStatus, [student.id]: 'promote' })}
                                      />
                                      {isGraduating ? 'Graduate to Alumni' : 'Promote'}
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#f59e0b' }}>
                                      <input
                                        type="radio"
                                        name={`status-${student.id}`}
                                        value="repeat"
                                        checked={statusValue === 'repeat'}
                                        onChange={() => setWizardStudentStatus({ ...wizardStudentStatus, [student.id]: 'repeat' })}
                                      />
                                      Repeat/Repeat Case
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '16px' }}>
                    <button type="button" onClick={() => setTransitionWizardStep(1)} className="btn-outline">Back: Mappings</button>
                    <button type="button" onClick={() => setTransitionWizardStep(3)} className="btn-primary">Next: Final Review</button>
                  </div>
                </div>
              )}

              {/* Step 3 Content: Confirmation & Shield */}
              {transitionWizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="alert alert-warning" style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px', color: '#fef08a' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '1rem' }}>
                      <AlertTriangle size={20} /> Critical Operation Warning
                    </strong>
                    <span style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                      Activating a new session is a final, critical database operation. The current active academic session will be marked as **Archived (Read-only)**. All selected students will be cloned and advanced into the new session.
                    </span>
                  </div>

                  <div className="sp-card" style={{ background: 'rgba(2, 6, 23, 0.4)' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Transition Impact Summary</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                      <div>Total Students in active session: <strong>{students.filter(s => s.status === 'Active').length}</strong></div>
                      <div>Students mapped to Promote: <strong>{Object.values(wizardStudentStatus).filter(v => v === 'promote').length}</strong></div>
                      <div>Students mapped to Repeat: <strong>{Object.values(wizardStudentStatus).filter(v => v === 'repeat').length}</strong></div>
                      <div>Target Session: <strong style={{ color: 'var(--color-primary)' }}>{wizardTargetYear.year_range}</strong></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <label className="form-label" htmlFor="transition-confirm-input" style={{ fontWeight: 'bold' }}>To execute this transition, type <span style={{ color: '#ef4444' }}>"CONFIRM"</span> below:</label>
                    <input 
                      id="transition-confirm-input"
                      type="text" 
                      placeholder="CONFIRM" 
                      value={wizardConfirmText} 
                      onChange={(e) => setWizardConfirmText(e.target.value)} 
                      className="sp-input"
                      style={{ border: wizardConfirmText === 'CONFIRM' ? '1px solid #10b981' : '1px solid var(--border-color)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '16px' }}>
                    <button type="button" onClick={() => setTransitionWizardStep(2)} className="btn-outline">Back: Students Checklist</button>
                    <button 
                      type="button" 
                      onClick={handleExecuteTransition} 
                      className="btn-primary" 
                      disabled={wizardConfirmText !== 'CONFIRM' || isActivatingYear}
                      style={{ backgroundColor: wizardConfirmText === 'CONFIRM' ? '#10b981' : 'rgba(255,255,255,0.05)', borderColor: wizardConfirmText === 'CONFIRM' ? '#10b981' : 'var(--border-color)', color: wizardConfirmText === 'CONFIRM' ? 'white' : 'var(--text-muted)' }}
                    >
                      {isActivatingYear ? 'Processing Transition...' : 'Execute Year Transition'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  marginBottom: '8px'
                }}>
                  <LogOut size={32} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Confirm Sign Out</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                  Are you sure you want to signout?
                </p>
                <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                  <button 
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      handleLogout();
                    }}
                    className="btn-primary"
                    style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
                  >
                    Yes
                  </button>
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="btn-outline"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Notifications Modal */}
        {showAllNotificationsModal && (
          <div className="modal-overlay" onClick={() => setShowAllNotificationsModal(false)}>
            <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                Notifications
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No notifications found.
                  </div>
                ) : (
                  [...notifications]
                    .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp))
                    .map(n => (
                      <div 
                        key={n.id} 
                        style={{ 
                          padding: '12px 16px', 
                          borderRadius: '6px', 
                          backgroundColor: n.is_read ? 'rgba(255,255,255,0.01)' : 'rgba(59,130,246,0.03)', 
                          border: '1px solid var(--border-color)',
                          borderLeft: '4px solid var(--color-primary)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{n.title}</strong>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, lineHeight: '1.4' }}>{n.content}</p>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'flex-end', marginTop: '2px' }}>
                          {formatNotificationTime(n.created_at || n.timestamp)}
                        </span>
                      </div>
                    ))
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button onClick={() => setShowAllNotificationsModal(false)} className="btn-outline">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Salary Disbursements Drill Down Modal */}
        {showSalaryDrilldown && !selectedTeacher && (
          <div className="modal-overlay" onClick={() => setShowSalaryDrilldown(null)}>
            <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Salary Breakdown - {showSalaryDrilldown} {(() => {
                    const yearRange = years.find(y => y.id === activeYearId)?.year_range || '';
                    if (!yearRange) return '';
                    const parts = yearRange.split('-');
                    if (parts.length < 2) return '';
                    const startYear = parts[0];
                    const endYear = parts[1];
                    const isNextYear = ["January", "February", "March"].includes(showSalaryDrilldown);
                    return isNextYear ? endYear : startYear;
                  })()}
                </h3>
                <button onClick={() => setShowSalaryDrilldown(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '50%' }} className="menu-dot-trigger">
                  <X size={20} />
                </button>
              </div>

              {isDrilldownLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading salary records...</span>
                </div>
              ) : salaryDrilldownData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>No salary records found for this month.</p>
                </div>
              ) : (
                <>
                  <div className="sp-table-container" style={{ maxHeight: '380px', overflowY: 'auto', marginBottom: '20px' }}>
                    <table className="sp-table">
                      <thead>
                        <tr>
                          <th>Teacher</th>
                          <th>Gender</th>
                          <th>Contact Number</th>
                          <th>Salary Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaryDrilldownData.map(r => {
                          const symbol = currencyMap[schoolCurrency]?.symbol || '$';
                          const displayAmount = `${symbol}${parseFloat(r.amount).toLocaleString()}`;
                          const isDisbursed = r.status === 'Paid';
                          
                          return (
                            <tr 
                              key={r.teacher_id}
                              onClick={() => {
                                const fullTeacher = teachers.find(t => t.id === r.teacher_id);
                                if (fullTeacher) {
                                  setTeacherProfileBackTab('dashboard');
                                  setSelectedTeacher(fullTeacher);
                                  fetchTeacherSalaryRecords(r.teacher_id);
                                  setActiveTab('faculty');
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                              className="teacher-row-clickable"
                            >
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {r.profile_image ? (
                                    <img 
                                      src={r.profile_image} 
                                      alt={r.name} 
                                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                      <User size={16} />
                                    </div>
                                  )}
                                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                                </div>
                              </td>
                              <td>{r.gender || 'Male'}</td>
                              <td>{r.phone || '9876543210'}</td>
                              <td style={{ fontWeight: 'bold' }}>{displayAmount}</td>
                              <td>
                                <span 
                                  className={`badge ${isDisbursed ? 'badge-success' : 'badge-pending'}`}
                                  style={{
                                    display: 'inline-flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '28px',
                                    minWidth: '110px',
                                    padding: '0 12px',
                                    textAlign: 'center',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  {isDisbursed ? 'Disbursed' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Section */}
                  {(() => {
                    const symbol = currencyMap[schoolCurrency]?.symbol || '$';
                    const disbursedSum = salaryDrilldownData
                      .filter(r => r.status === 'Paid')
                      .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                    const pendingSum = salaryDrilldownData
                      .filter(r => r.status !== 'Paid')
                      .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                    const totalSum = disbursedSum + pendingSum;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', background: 'rgba(255,255,255,0.01)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Disbursed Amount:</span>
                          <strong style={{ color: '#10b981' }}>{symbol}{disbursedSum.toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Pending Amount:</span>
                          <strong style={{ color: '#f97316' }}>{symbol}{pendingSum.toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Total Salary Amount:</strong>
                          <strong style={{ color: 'var(--color-primary)', fontSize: '1.1rem' }}>{symbol}{totalSum.toLocaleString()}</strong>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}

      {/* --- EXPERIENCE LETTER MODAL --- */}
      {showExperienceLetter && selectedTeacher && (
        <div className="modal-overlay" onClick={() => setShowExperienceLetter(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Experience Certificate</h3>
              <button onClick={() => setShowExperienceLetter(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div className="receipt-box" style={{ fontFamily: 'Georgia, serif', padding: '40px', color: '#000000', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#000000', margin: '0 0 4px 0', fontFamily: 'Outfit, sans-serif' }}>BN SCHOOL</h2>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>Official Administration</p>
                <div style={{ borderBottom: '2px double #cbd5e1', marginTop: '16px' }}></div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '24px', color: '#334155' }}>
                <div><strong>Ref:</strong> BN/EXP/{new Date().getFullYear()}/{String(selectedTeacher.id).padStart(3, '0')}</div>
                <div><strong>Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              
              <div style={{ textAlign: 'center', margin: '30px 0', fontSize: '1.25rem', fontWeight: 'bold', textDecoration: 'underline', color: '#000000', letterSpacing: '1px' }}>
                EXPERIENCE CERTIFICATE
              </div>
              
              <div style={{ fontSize: '1.05rem', lineHeight: '1.8', color: '#1e293b', textAlign: 'justify', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p><strong>TO WHOM IT MAY CONCERN</strong></p>
                <p>
                  This is to certify that <strong>{selectedTeacher.name}</strong> was employed as a Teacher at <strong>BN School</strong>.
                  Their service tenure was from <strong>{selectedTeacher.joining_date || 'N/A'}</strong> to <strong>{selectedTeacher.exit_date || 'N/A'}</strong>.
                </p>
                <p>
                  During this period, they were responsible for teaching the subject of <strong>"{selectedTeacher.subject || 'Teaching'}"</strong>. 
                  They proved to be a highly dedicated, competent, and professional educator. Their conduct and behavior were exemplary.
                </p>
                <p>
                  We highly appreciate their valuable contributions to our school community and wish them the absolute best in all their future endeavors.
                </p>
              </div>
              
              <div style={{ marginTop: '50px', fontSize: '1rem', color: '#1e293b' }}>
                <p>Sincerely,</p>
                <div style={{ height: '40px' }}></div>
                <p>_______________________</p>
                <p><strong>Authorized Signatory</strong></p>
                <p>BN School Administration</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => window.print()} 
                className="btn-primary" 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Printer size={16} /> Print Letter
              </button>
              <button 
                onClick={() => downloadExperienceLetterDoc(selectedTeacher)} 
                className="btn-outline" 
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Download size={16} /> Download Letter (.doc)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedConfirmModal && (
        <div className="modal-overlay" onClick={() => {
          setPendingTabChange(null);
          setShowUnsavedConfirmModal(false);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', padding: '24px' }}>
            <div style={{ 
              margin: '0 auto 16px auto', 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              background: 'rgba(245, 158, 11, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#fbbf24' 
            }}>
              <AlertTriangle size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>Unsaved Changes</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              You have unsaved timetable changes. Do you want to leave without saving?
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                onClick={() => {
                  resetDraftTimetableSettings();
                  const target = pendingTabChange || 'dashboard';
                  setPendingTabChange(null);
                  setShowUnsavedConfirmModal(false);
                  setActiveTab(target);
                }}
                className="btn-primary"
                style={{ flex: 1, backgroundColor: '#ef4444', border: '1px solid #ef4444', color: 'white', justifyContent: 'center' }}
              >
                Leave
              </button>
              <button 
                onClick={() => {
                  setPendingTabChange(null);
                  setShowUnsavedConfirmModal(false);
                }}
                className="btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Action (Replace / Backup Assignment) Modal */}
      {teacherActionModal.show && (
        <div className="modal-overlay" onClick={() => setTeacherActionModal(prev => ({ ...prev, show: false }))}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontWeight: 800 }}>
                {teacherActionModal.type === 'Replace' ? '🔄 Replace Teacher Forever' : '🛡️ Assign Backup Teacher (One Day)'}
              </h3>
              <button 
                onClick={() => setTeacherActionModal(prev => ({ ...prev, show: false }))} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.5' }}>
                {teacherActionModal.type === 'Replace' 
                  ? `Select a teacher to replace the main teacher for ${teacherActionModal.day}'s Period ${teacherActionModal.periodIndex + 1} (${teacherActionModal.subject}). This change will propagate to all upcoming weeks.`
                  : `Select a backup teacher for ${teacherActionModal.day}'s Period ${teacherActionModal.periodIndex + 1} (${teacherActionModal.subject}). This override applies to this specific day only.`}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Faculty Member</label>
                <select
                  className="sp-input"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem' }}
                  value={selectedModalTeacherId}
                  onChange={(e) => setSelectedModalTeacherId(e.target.value)}
                >
                  <option value="">-- Choose Teacher --</option>
                  {(() => {
                    const targetDateStr = getPlanDateFromDayName(teacherActionModal.day);
                    return teachers.filter(t => {
                      const assignedCount = getTeacherAssignedCountOnDate(t.id, targetDateStr);
                      return assignedCount < totalPeriodsPerDay;
                    }).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setTeacherActionModal(prev => ({ ...prev, show: false }))}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const teachId = selectedModalTeacherId;
                  if (!teachId) {
                    showToast("Please select a teacher", "error");
                    return;
                  }
                  
                  const teacherObj = teachers.find(t => t.id === parseInt(teachId));
                  if (!teacherObj) return;
                  
                  const targetDay = teacherActionModal.day;
                  const targetIndex = teacherActionModal.periodIndex;
                  const currentPeriods = [...(scheduleForm[targetDay] || [])];
                  
                  if (targetIndex >= 0 && targetIndex < currentPeriods.length) {
                    if (teacherActionModal.type === 'Replace') {
                      currentPeriods[targetIndex] = {
                        ...currentPeriods[targetIndex],
                        teacher_id: teacherObj.id,
                        teacher_name: teacherObj.name,
                        backup_teacher_id: null,
                        backup_teacher_name: null
                      };
                      
                      setScheduleForm(prev => ({
                        ...prev,
                        [targetDay]: currentPeriods
                      }));
                      
                      await autoSaveDaySchedule(targetDay, currentPeriods, 'Draft', true, 'replace', targetIndex);
                      showToast(`Teacher replaced successfully and propagated to future weeks!`, 'success');
                    } else {
                      currentPeriods[targetIndex] = {
                        ...currentPeriods[targetIndex],
                        backup_teacher_id: teacherObj.id,
                        backup_teacher_name: teacherObj.name
                      };
                      
                      setScheduleForm(prev => ({
                        ...prev,
                        [targetDay]: currentPeriods
                      }));
                      
                      await autoSaveDaySchedule(targetDay, currentPeriods, 'Draft', false, 'none');
                      showToast(`Backup teacher assigned successfully for today only!`, 'success');
                    }
                  }
                  
                  setTeacherActionModal(prev => ({ ...prev, show: false }));
                }}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Fee Structure Lock Confirmation Modal */}
      {showConfirmLockModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmLockModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', padding: '24px', textAlign: 'center' }}>
            <div style={{ 
              margin: '0 auto 16px auto', 
              width: '56px', 
              height: '56px', 
              borderRadius: '50%', 
              background: 'rgba(239, 68, 68, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#ef4444',
              fontSize: '24px'
            }}>
              🔒
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Confirm Fee Structure
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              You are about to finalize the tuition fee structure for this class.
              <br /><br />
              <strong>Once saved, this fee structure will be permanently locked and cannot be modified later.</strong>
              <br /><br />
              Please review all monthly fee amounts carefully before proceeding.
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowConfirmLockModal(false)}
                className="btn-outline"
                style={{ flex: 1, justifyContent: 'center', padding: '10px 16px' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setShowConfirmLockModal(false);
                  await saveClassFeeStructure();
                }}
                className="btn-primary"
                style={{ flex: 1, backgroundColor: 'var(--color-primary)', border: '1px solid var(--color-primary)', color: 'white', justifyContent: 'center', padding: '10px 16px' }}
              >
                Confirm & Lock Fee Structure
              </button>
            </div>
          </div>
        </div>
      )}
      

      

    </div>
  );
}

// Pre-seeded Mock Platform Data
const MOCK_SCHOOLS = [
  { id: 1, name: "St. Xavier's International School", code: "SCH-981763", contact_person: "Fr. Thomas Matthews", contact_number: "+1 (555) 019-8833", email: "xavier.admin@xavier.edu", status: "Active", subscription_start: "2026-04-01", subscription_end: "2027-03-31", setup_completed: 1, days_remaining: 305, address: "123 School Lane, Lucknow, Uttar Pradesh, India", logo_path: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%234f46e5'/><path d='M50 25 L80 40 L50 55 L20 40 Z' fill='%23ffffff'/><path d='M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5' fill='%23ffffff' opacity='0.9'/><path d='M72 43 L72 65 L75 65 L75 43 Z' fill='%23f59e0b'/><circle cx='73.5' cy='67' r='3' fill='%23f59e0b'/></svg>" },
  { id: 2, name: "Lincoln Technical College", code: "SCH-098716", contact_person: "Dr. Elizabeth Vance", contact_number: "+1 (555) 021-3311", email: "lincoln.tech@lincoln.edu", status: "Active", subscription_start: "2026-05-01", subscription_end: "2026-06-30", setup_completed: 1, days_remaining: 31, address: "456 Tech Parkway, City College, India", logo_path: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%238b5cf6'/><path d='M50 25 L80 40 L50 55 L20 40 Z' fill='%23ffffff'/><path d='M35 47.5 L35 70 C35 75, 65 75, 65 70 L65 47.5' fill='%23ffffff' opacity='0.9'/><path d='M72 43 L72 65 L75 65 L75 43 Z' fill='%23f59e0b'/><circle cx='73.5' cy='67' r='3' fill='%23f59e0b'/></svg>" }
];

const MOCK_SUPER_STATS = {
  total_schools: 2,
  active_schools: 2,
  inactive_schools: 0,
  total_students: 450,
  total_teachers: 35,
  total_revenue: 12450.00,
  recent_schools: [
    { name: "Lincoln Technical College", email: "lincoln.tech@lincoln.edu", status: "Active", created_at: "2026-05-01 10:00:00" },
    { name: "St. Xavier's International School", email: "xavier.admin@xavier.edu", status: "Active", created_at: "2026-04-01 09:00:00" }
  ]
};

// Pre-seeded Mock Fallback data sets
const MOCK_CLASSES = [];
const MOCK_TEACHERS = [];
const MOCK_STUDENTS = [];
const MOCK_NOTIFS = [];
