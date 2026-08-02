import React, { useState, useEffect, useRef } from 'react';

export const INDIAN_STATES_AND_CITIES = {
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

export function SearchableSelect({ label, placeholder, value, onChange, options, disabled, required, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

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
        className="flex h-9 w-full rounded-lg border border-border bg-surface px-3 py-1 text-sm shadow-xs transition-all placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-[60px] max-h-40 overflow-y-auto bg-surface border border-border rounded-xl shadow-lg z-50 py-1 bg-white dark:bg-zinc-950 animate-in fade-in slide-in-from-top-1 duration-200">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No options found</div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-text-primary hover:bg-secondary border-b border-border last:border-b-0"
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
