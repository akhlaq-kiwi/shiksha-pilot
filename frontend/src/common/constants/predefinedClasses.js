export const PREDEFINED_CLASSES = [
  // Pre-Primary
  { name: 'Pre Nursery', category: 'Pre-Primary' },
  { name: 'Nursery', category: 'Pre-Primary' },
  { name: 'Lower Kindergarten (LKG)', category: 'Pre-Primary' },
  { name: 'Upper Kindergarten (UKG)', category: 'Pre-Primary' },
  { name: 'KG', category: 'Pre-Primary' },
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
  const clean = className.trim();
  const lower = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower.includes('prenursery') || lower === 'pnc' || lower === 'playgroup' || lower === 'pg') {
    return PREDEFINED_CLASSES.findIndex(c => c.name === 'Pre Nursery');
  }
  if (lower.includes('nursery') || lower === 'nc') {
    return PREDEFINED_CLASSES.findIndex(c => c.name === 'Nursery');
  }
  if (lower.includes('lowerkindergarten') || lower.includes('lowerkg') || lower.includes('lkg') || lower === 'lkg') {
    return PREDEFINED_CLASSES.findIndex(c => c.name.includes('LKG'));
  }
  if (lower.includes('upperkindergarten') || lower.includes('upperkg') || lower.includes('ukg') || lower === 'ukg') {
    return PREDEFINED_CLASSES.findIndex(c => c.name.includes('UKG'));
  }
  if (lower === 'kg' || lower === 'kindergarten') {
    return PREDEFINED_CLASSES.findIndex(c => c.name === 'KG');
  }

  // Exact match fallback
  const idx = PREDEFINED_CLASSES.findIndex(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === lower);
  if (idx !== -1) return idx;

  // Numeric fallback for Class 1..12
  const match = clean.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return 4 + num;
  }
  return -1;
};

export const getShortClassName = (className) => {
  if (!className) return '';
  const clean = className.trim();
  const lower = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower.includes('lowerkindergarten') || lower.includes('lowerkg') || lower.includes('lkg') || lower === 'lkg') {
    return 'LKG';
  }
  if (lower.includes('upperkindergarten') || lower.includes('upperkg') || lower.includes('ukg') || lower === 'ukg') {
    return 'UKG';
  }
  if (lower === 'playgroup' || lower === 'pg') {
    return 'Playgroup';
  }
  if (lower.includes('prenursery') || lower === 'pnc') {
    return 'PNC';
  }
  if (lower.includes('nursery') || lower === 'nc') {
    return 'NC';
  }
  if (lower === 'kg' || lower === 'kindergarten') {
    return 'KG';
  }
  return clean;
};
