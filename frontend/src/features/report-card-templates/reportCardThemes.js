/**
 * Report Card Color Themes Configuration
 * 6 Premium, very light, soft pastel color themes for CBSE Classic Report Cards.
 * Template 1 is Classic CBSE Slate (Default, unchanged), plus 5 elegant, soft pastel color variants.
 */

export const REPORT_CARD_THEMES = {
  classic: {
    key: 'classic',
    templateCode: 'cbse_classic',
    templateId: 2,
    name: 'Classic Slate (Default)',
    displayName: 'Classic CBSE Slate',
    subtitle: 'Original formal CBSE format with classic monochrome slate styling and dual accent summary cards.',
    tag: 'Formal Monochrome',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    swatches: {
      primary: '#18181b', // Zinc 900
      secondary: '#3f3f46', // Zinc 700
      accent: '#059669', // Emerald
      lightBg: '#f4f4f5', // Zinc 100
      border: '#d4d4d8', // Zinc 300
    },
    styles: {
      outerBorder: '6px double #18181b',
      headerBorder: 'border-b-2 border-zinc-900',
      schoolLogoBorder: 'border-2 border-zinc-900 text-zinc-900',
      schoolNameText: 'text-zinc-900',
      schoolAddressText: 'text-zinc-600',
      examBanner: 'border-y border-zinc-800 text-zinc-900',
      studentTableBorder: 'border border-zinc-400',
      studentCellBorder: 'border-zinc-300',
      studentLabelBg: 'bg-zinc-100',
      studentValueText: 'text-zinc-900',
      marksTableBorder: 'border border-zinc-800',
      marksHeaderBg1: 'bg-zinc-800 text-white',
      marksHeaderBg2: 'bg-zinc-700 text-white',
      marksHeaderDivider: 'border-r border-zinc-700',
      marksSubHeaderDivider: 'border-r border-zinc-600',
      marksCellBorder: 'border-zinc-300',
      marksCellText: 'text-zinc-900',
      marksTotalRowBg: 'bg-zinc-100',
      marksTotalRowBorder: 'border-t-2 border-zinc-800',
      statCardTotal: 'bg-emerald-50 border border-emerald-200 text-emerald-800 text-emerald-950',
      statCardPercentage: 'bg-amber-50 border border-amber-200 text-amber-800 text-amber-950',
      statCardGrade: 'bg-emerald-50 border border-emerald-200 text-emerald-800 text-emerald-950',
      statCardAttendance: 'bg-amber-50 border border-amber-200 text-amber-800 text-amber-950',
      statCardRank: 'bg-emerald-50 border border-emerald-200 text-emerald-800 text-emerald-950',
      remarksLabel: 'text-zinc-900',
      remarksText: 'text-emerald-700',
      signatureBorder: 'border-zinc-800',
      signatureText: 'text-zinc-800'
    }
  },

  royal_blue: {
    key: 'royal_blue',
    templateCode: 'cbse_royal_blue',
    templateId: 5,
    name: 'Soft Sky Sapphire',
    displayName: 'Soft Sky Sapphire',
    subtitle: 'Light pastel sky blue double border with gentle ice-blue tables and crystal accents.',
    tag: 'Sky & Azure Pastel',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    swatches: {
      primary: '#38bdf8', // Sky 400 (very soft light pastel blue)
      secondary: '#7dd3fc', // Sky 300
      accent: '#bae6fd', // Sky 200
      lightBg: '#f0f9ff', // Sky 50
      border: '#bae6fd', // Sky 200
    },
    styles: {
      outerBorder: '6px double #38bdf8',
      headerBorder: 'border-b-2 border-sky-300',
      schoolLogoBorder: 'border-2 border-sky-400 text-sky-800',
      schoolNameText: 'text-sky-950',
      schoolAddressText: 'text-slate-500',
      examBanner: 'border-y border-sky-200 text-sky-900 bg-sky-50/50',
      studentTableBorder: 'border border-sky-200',
      studentCellBorder: 'border-sky-100',
      studentLabelBg: 'bg-sky-50/80',
      studentValueText: 'text-slate-800',
      marksTableBorder: 'border border-sky-300',
      marksHeaderBg1: 'bg-sky-100 text-sky-950 font-bold',
      marksHeaderBg2: 'bg-sky-50 text-sky-900 font-bold',
      marksHeaderDivider: 'border-r border-sky-200',
      marksSubHeaderDivider: 'border-r border-sky-200',
      marksCellBorder: 'border-sky-100',
      marksCellText: 'text-slate-800',
      marksTotalRowBg: 'bg-sky-50/80',
      marksTotalRowBorder: 'border-t-2 border-sky-300',
      statCardTotal: 'bg-sky-50/90 border border-sky-200 text-sky-900 text-sky-950',
      statCardPercentage: 'bg-blue-50/90 border border-blue-200 text-blue-900 text-blue-950',
      statCardGrade: 'bg-sky-50/90 border border-sky-200 text-sky-900 text-sky-950',
      statCardAttendance: 'bg-blue-50/90 border border-blue-200 text-blue-900 text-blue-950',
      statCardRank: 'bg-sky-50/90 border border-sky-200 text-sky-900 text-sky-950',
      remarksLabel: 'text-sky-950',
      remarksText: 'text-sky-700',
      signatureBorder: 'border-sky-300',
      signatureText: 'text-sky-900'
    }
  },

  emerald_green: {
    key: 'emerald_green',
    templateCode: 'cbse_emerald_green',
    templateId: 6,
    name: 'Soft Sage Mint',
    displayName: 'Soft Sage Mint',
    subtitle: 'Light botanical pastel mint double border with delicate sage headers and fresh highlights.',
    tag: 'Sage & Mint Pastel',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    swatches: {
      primary: '#34d399', // Emerald 400 (very soft light mint)
      secondary: '#6ee7b7', // Emerald 300
      accent: '#a7f3d0', // Emerald 200
      lightBg: '#ecfdf5', // Emerald 50
      border: '#a7f3d0', // Emerald 200
    },
    styles: {
      outerBorder: '6px double #34d399',
      headerBorder: 'border-b-2 border-emerald-300',
      schoolLogoBorder: 'border-2 border-emerald-400 text-emerald-800',
      schoolNameText: 'text-emerald-950',
      schoolAddressText: 'text-slate-500',
      examBanner: 'border-y border-emerald-200 text-emerald-900 bg-emerald-50/50',
      studentTableBorder: 'border border-emerald-200',
      studentCellBorder: 'border-emerald-100',
      studentLabelBg: 'bg-emerald-50/80',
      studentValueText: 'text-slate-800',
      marksTableBorder: 'border border-emerald-300',
      marksHeaderBg1: 'bg-emerald-100 text-emerald-950 font-bold',
      marksHeaderBg2: 'bg-emerald-50 text-emerald-900 font-bold',
      marksHeaderDivider: 'border-r border-emerald-200',
      marksSubHeaderDivider: 'border-r border-emerald-200',
      marksCellBorder: 'border-emerald-100',
      marksCellText: 'text-slate-800',
      marksTotalRowBg: 'bg-emerald-50/80',
      marksTotalRowBorder: 'border-t-2 border-emerald-300',
      statCardTotal: 'bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-emerald-950',
      statCardPercentage: 'bg-teal-50/90 border border-teal-200 text-teal-900 text-teal-950',
      statCardGrade: 'bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-emerald-950',
      statCardAttendance: 'bg-teal-50/90 border border-teal-200 text-teal-900 text-teal-950',
      statCardRank: 'bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-emerald-950',
      remarksLabel: 'text-emerald-950',
      remarksText: 'text-emerald-700',
      signatureBorder: 'border-emerald-300',
      signatureText: 'text-emerald-900'
    }
  },

  warm_amber: {
    key: 'warm_amber',
    templateCode: 'cbse_warm_amber',
    templateId: 7,
    name: 'Soft Peach Amber',
    displayName: 'Soft Peach Amber',
    subtitle: 'Light peach and apricot double border with warm biscuit tinting and honey accents.',
    tag: 'Peach & Honey Pastel',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    swatches: {
      primary: '#fb923c', // Orange 400 (very soft light peach amber)
      secondary: '#fdba74', // Orange 300
      accent: '#fed7aa', // Orange 200
      lightBg: '#fff7ed', // Orange 50
      border: '#fed7aa', // Orange 200
    },
    styles: {
      outerBorder: '6px double #fb923c',
      headerBorder: 'border-b-2 border-amber-300',
      schoolLogoBorder: 'border-2 border-amber-400 text-amber-800',
      schoolNameText: 'text-amber-950',
      schoolAddressText: 'text-slate-500',
      examBanner: 'border-y border-amber-200 text-amber-900 bg-amber-50/50',
      studentTableBorder: 'border border-amber-200',
      studentCellBorder: 'border-amber-100',
      studentLabelBg: 'bg-amber-50/80',
      studentValueText: 'text-slate-800',
      marksTableBorder: 'border border-amber-300',
      marksHeaderBg1: 'bg-amber-100 text-amber-950 font-bold',
      marksHeaderBg2: 'bg-amber-50 text-amber-900 font-bold',
      marksHeaderDivider: 'border-r border-amber-200',
      marksSubHeaderDivider: 'border-r border-amber-200',
      marksCellBorder: 'border-amber-100',
      marksCellText: 'text-slate-800',
      marksTotalRowBg: 'bg-amber-50/80',
      marksTotalRowBorder: 'border-t-2 border-amber-300',
      statCardTotal: 'bg-amber-50/90 border border-amber-200 text-amber-900 text-amber-950',
      statCardPercentage: 'bg-orange-50/90 border border-orange-200 text-orange-900 text-orange-950',
      statCardGrade: 'bg-amber-50/90 border border-amber-200 text-amber-900 text-amber-950',
      statCardAttendance: 'bg-orange-50/90 border border-orange-200 text-orange-900 text-orange-950',
      statCardRank: 'bg-amber-50/90 border border-amber-200 text-amber-900 text-amber-950',
      remarksLabel: 'text-amber-950',
      remarksText: 'text-amber-700',
      signatureBorder: 'border-amber-300',
      signatureText: 'text-amber-900'
    }
  },

  burgundy_plum: {
    key: 'burgundy_plum',
    templateCode: 'cbse_burgundy_plum',
    templateId: 8,
    name: 'Soft Rose Plum',
    displayName: 'Soft Rose Plum',
    subtitle: 'Light blush rose double border with delicate mauve styling and soft lavender highlights.',
    tag: 'Blush & Rose Pastel',
    badgeClass: 'bg-pink-50 text-pink-800 border-pink-200',
    swatches: {
      primary: '#f472b6', // Pink 400 (very soft light blush rose)
      secondary: '#f9a8d4', // Pink 300
      accent: '#fbcfe8', // Pink 200
      lightBg: '#fdf2f8', // Pink 50
      border: '#fbcfe8', // Pink 200
    },
    styles: {
      outerBorder: '6px double #f472b6',
      headerBorder: 'border-b-2 border-pink-300',
      schoolLogoBorder: 'border-2 border-pink-400 text-pink-800',
      schoolNameText: 'text-pink-950',
      schoolAddressText: 'text-slate-500',
      examBanner: 'border-y border-pink-200 text-pink-900 bg-pink-50/50',
      studentTableBorder: 'border border-pink-200',
      studentCellBorder: 'border-pink-100',
      studentLabelBg: 'bg-pink-50/80',
      studentValueText: 'text-slate-800',
      marksTableBorder: 'border border-pink-300',
      marksHeaderBg1: 'bg-pink-100 text-pink-950 font-bold',
      marksHeaderBg2: 'bg-pink-50 text-pink-900 font-bold',
      marksHeaderDivider: 'border-r border-pink-200',
      marksSubHeaderDivider: 'border-r border-pink-200',
      marksCellBorder: 'border-pink-100',
      marksCellText: 'text-slate-800',
      marksTotalRowBg: 'bg-pink-50/80',
      marksTotalRowBorder: 'border-t-2 border-pink-300',
      statCardTotal: 'bg-pink-50/90 border border-pink-200 text-pink-900 text-pink-950',
      statCardPercentage: 'bg-purple-50/90 border border-purple-200 text-purple-900 text-purple-950',
      statCardGrade: 'bg-pink-50/90 border border-pink-200 text-pink-900 text-pink-950',
      statCardAttendance: 'bg-purple-50/90 border border-purple-200 text-purple-900 text-purple-950',
      statCardRank: 'bg-pink-50/90 border border-pink-200 text-pink-900 text-pink-950',
      remarksLabel: 'text-pink-950',
      remarksText: 'text-pink-700',
      signatureBorder: 'border-pink-300',
      signatureText: 'text-pink-900'
    }
  },

  ocean_teal: {
    key: 'ocean_teal',
    templateCode: 'cbse_ocean_teal',
    templateId: 9,
    name: 'Manage Finance & Dark Black',
    displayName: 'Manage Finance & Dark Black',
    subtitle: 'Report card in exact Manage Finance container color (#FAFAFA) with crisp dark black borders on all tables.',
    tag: 'Finance & Dark Black',
    badgeClass: 'bg-[#fafafa] text-black border-black/40',
    swatches: {
      primary: '#000000', // Crisp dark black borders
      secondary: '#fafafa', // Exact Manage Finance container zinc-50 hex
      accent: '#27272a', // Dark zinc accent
      lightBg: '#fafafa', // Exact Manage Finance container hex code (#fafafa)
      border: '#000000', // Dark black border
      borderLeft: '#000000', // Dark black line
      labelColor: '#000000', // Dark black text
      textColor: '#ffffff', // White 'A' on Dark Black chip
      canvasColor: '#fafafa', // Report Card Canvas Color (#fafafa)
    },
    styles: {
      cardBg: '#fafafa', // Exact Manage Finance container color (#fafafa / zinc-50) - pristine 0% yellow
      outerBorder: '6px double #000000', // Solid dark black double border
      headerBorder: 'border-b-2 border-black',
      schoolLogoBorder: 'border-2 border-black text-black',
      schoolNameText: 'text-black font-bold',
      schoolAddressText: 'text-zinc-800 font-semibold',
      examBanner: 'border-y-2 border-black text-black bg-zinc-100 font-bold',
      studentTableBorder: 'border-2 border-black',
      studentCellBorder: 'border-black',
      studentLabelBg: 'bg-zinc-100 font-bold',
      studentValueText: 'text-black font-bold',
      marksTableBorder: 'border-2 border-black',
      marksHeaderBg1: 'bg-zinc-200 text-black font-bold border-b border-black',
      marksHeaderBg2: 'bg-zinc-100 text-black font-bold border-b border-black',
      marksHeaderDivider: 'border-r border-black',
      marksSubHeaderDivider: 'border-r border-black',
      marksCellBorder: 'border-black',
      marksCellText: 'text-black font-bold',
      marksTotalRowBg: 'bg-zinc-200 font-bold',
      marksTotalRowBorder: 'border-t-2 border-black',
      statCardTotal: 'bg-zinc-100 border-2 border-black text-black font-bold',
      statCardPercentage: 'bg-zinc-100 border-2 border-black text-black font-bold',
      statCardGrade: 'bg-zinc-100 border-2 border-black text-black font-bold',
      statCardAttendance: 'bg-zinc-100 border-2 border-black text-black font-bold',
      statCardRank: 'bg-zinc-100 border-2 border-black text-black font-bold',
      remarksLabel: 'text-black font-bold',
      remarksText: 'text-black font-semibold',
      signatureBorder: 'border-black border-b-2',
      signatureText: 'text-black font-bold'
    }
  }
};

export const TEMPLATE_CODE_TO_THEME_KEY = {
  cbse_classic: 'classic',
  cbse_royal_blue: 'royal_blue',
  cbse_emerald_green: 'emerald_green',
  cbse_warm_amber: 'warm_amber',
  cbse_burgundy_plum: 'burgundy_plum',
  cbse_ocean_teal: 'ocean_teal'
};

export const TEMPLATE_ID_TO_THEME_KEY = {
  2: 'classic',
  5: 'royal_blue',
  6: 'emerald_green',
  7: 'warm_amber',
  8: 'burgundy_plum',
  9: 'ocean_teal'
};

export function resolveReportCardTheme(colorTheme, templateCode, templateId) {
  if (colorTheme && REPORT_CARD_THEMES[colorTheme]) {
    return REPORT_CARD_THEMES[colorTheme];
  }
  if (templateCode && TEMPLATE_CODE_TO_THEME_KEY[templateCode]) {
    return REPORT_CARD_THEMES[TEMPLATE_CODE_TO_THEME_KEY[templateCode]];
  }
  if (templateId && TEMPLATE_ID_TO_THEME_KEY[templateId]) {
    return REPORT_CARD_THEMES[TEMPLATE_ID_TO_THEME_KEY[templateId]];
  }
  return REPORT_CARD_THEMES.ocean_teal;
}

/**
 * Static Rich Preview Data for Live Report Card Theme Preview
 * Contains exactly 10 subjects across all 6 tests:
 * First Term Examinations (100 marks: 30, 30, 40)
 * Second Term Examinations (100 marks: 30, 30, 40)
 */
export const STATIC_FINAL_REPORT_PREVIEW_DATA = {
  is_final_session_report: true,
  student: {
    id: 101,
    name: 'AARAV SHARMA',
    student_name: 'AARAV SHARMA',
    roll_no: '01',
    admission_no: 'SR-2026-104',
    class_name: 'Class 5',
    section: 'A',
    class_section: 'A',
    father_name: 'Vikram Sharma',
    mother_name: 'Meenakshi Sharma',
    dob: '12/04/2016'
  },
  school: {
    name: 'SPLENDID PUBLIC SCHOOL',
    address: 'MAIN CAMPUS, CIVIL LINES',
    logo_path: null
  },
  academic_year: {
    name: '2026–2027'
  },
  exam: {
    name: 'FINAL ACADEMIC REPORT CARD',
    is_final_session_report: true,
    type: 'Annual Session Summary'
  },
  terminals: [
    {
      id: 'term_1',
      name: 'First Term Examinations',
      sub_tests: [
        { id: 't1_ut1', name: 'Unit Test 1', max_marks: 30 },
        { id: 't1_ut2', name: 'Unit Test 2', max_marks: 30 },
        { id: 't1_ut3', name: 'Unit Test 3', max_marks: 40 }
      ]
    },
    {
      id: 'term_2',
      name: 'Second Term Examinations',
      sub_tests: [
        { id: 't2_ut1', name: 'Unit Test 1', max_marks: 30 },
        { id: 't2_ut2', name: 'Unit Test 2', max_marks: 30 },
        { id: 't2_ut3', name: 'Unit Test 3', max_marks: 40 }
      ]
    }
  ],
  subjects: [
    {
      subject_name: 'English Language',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 35, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 37, max_marks: 40 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Hindi Literature',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 25, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 34, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 36, max_marks: 40 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Mathematics',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 38, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 30, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 39, max_marks: 40 }
          }
        }
      },
      grade: 'A+'
    },
    {
      subject_name: 'Science & Technology',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 36, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 37, max_marks: 40 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Social Studies',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 24, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 25, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 33, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 25, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 35, max_marks: 40 }
          }
        }
      },
      grade: 'B+'
    },
    {
      subject_name: 'Sanskrit',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 36, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 36, max_marks: 40 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'Computer Applications',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 39, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 30, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 39, max_marks: 40 }
          }
        }
      },
      grade: 'A+'
    },
    {
      subject_name: 'Environmental Studies',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 25, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 35, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 26, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 36, max_marks: 40 }
          }
        }
      },
      grade: 'A'
    },
    {
      subject_name: 'General Knowledge',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 27, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 37, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 38, max_marks: 40 }
          }
        }
      },
      grade: 'A+'
    },
    {
      subject_name: 'Moral Science & Ethics',
      terminals: {
        'First Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 28, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 38, max_marks: 40 }
          }
        },
        'Second Term Examinations': {
          sub_tests: {
            'Unit Test 1': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 2': { marks_obtained: 29, max_marks: 30 },
            'Unit Test 3': { marks_obtained: 38, max_marks: 40 }
          }
        }
      },
      grade: 'A+'
    }
  ],
  summary: {
    total_obtained: 1822,
    total_max: 2000,
    percentage: 91.1,
    grade: 'A+',
    class_rank: '1',
    attendance: {
      attendance_rate: 96
    },
    result: 'PASS',
    teacher_remark: 'Outstanding academic performance throughout the session! Demonstrates exemplary dedication, discipline, and leadership.'
  }
};
