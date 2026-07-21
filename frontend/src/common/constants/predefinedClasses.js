export const PREDEFINED_CLASSES = [
  // Pre-Primary
  { name: 'Play Group', category: 'Pre-Primary' },
  { name: 'Nursery', category: 'Pre-Primary' },
  { name: 'Lower Kindergarten (LKG)', category: 'Pre-Primary' },
  { name: 'Upper Kindergarten (UKG)', category: 'Pre-Primary' },
  // Primary
  { name: 'Class 1', category: 'Primary' },
  { name: 'Class 2', category: 'Primary' },
  { name: 'Class 3', category: 'Primary' },
  { name: 'Class 4', category: 'Primary' },
  { name: 'Class 5', category: 'Primary' },
  // Middle
  { name: 'Class 6', category: 'Middle' },
  { name: 'Class 7', category: 'Middle' },
  { name: 'Class 8', category: 'Middle' },
  // Secondary
  { name: 'Class 9', category: 'Secondary' },
  { name: 'Class 10', category: 'Secondary' },
  // Senior Secondary
  { name: 'Class 11', category: 'Senior Secondary' },
  { name: 'Class 12', category: 'Senior Secondary' }
];

export const PREDEFINED_CLASS_NAMES = PREDEFINED_CLASSES.map(c => c.name);

export const SECTION_TYPES = {
  ALPHABET: 'Alphabet Sections',
  COLOR: 'Color Sections'
};

export const ALPHABET_SECTIONS = ['A', 'B', 'C', 'D'];
export const COLOR_SECTIONS = ['Red', 'Blue', 'Green', 'Yellow'];

export const detectSectionType = (sections = []) => {
  if (!sections || sections.length === 0) return '';
  const first = String(sections[0]).trim();
  if (COLOR_SECTIONS.some(c => c.toLowerCase() === first.toLowerCase())) {
    return SECTION_TYPES.COLOR;
  }
  return SECTION_TYPES.ALPHABET;
};

export const getClassIndex = (className) => {
  if (!className) return -1;
  const cleanName = className.trim().toLowerCase();
  
  // Exact match
  const idx = PREDEFINED_CLASSES.findIndex(c => c.name.toLowerCase() === cleanName);
  if (idx !== -1) return idx;

  // Short-name matching fallback (e.g., 'lkg' -> 'Lower Kindergarten (LKG)')
  if (cleanName === 'lkg') return PREDEFINED_CLASSES.findIndex(c => c.name.includes('LKG'));
  if (cleanName === 'ukg') return PREDEFINED_CLASSES.findIndex(c => c.name.includes('UKG'));

  // Numeric fallback
  const match = cleanName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return 3 + num;
  }
  return -1;
};

export const getShortClassName = (className) => {
  if (!className) return '';
  const clean = className.trim();
  if (clean.toLowerCase().includes('lower kindergarten') || clean.toLowerCase() === 'lkg') {
    return 'LKG';
  }
  if (clean.toLowerCase().includes('upper kindergarten') || clean.toLowerCase() === 'ukg') {
    return 'UKG';
  }
  return clean;
};
