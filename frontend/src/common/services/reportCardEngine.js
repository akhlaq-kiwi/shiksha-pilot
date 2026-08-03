/**
 * Report Card Engine (Layer 1)
 * Presentation-agnostic calculation & data compilation engine.
 * Receives raw examination result data and returns a standardized JSON structure.
 */

function formatSchoolAddress(schoolProfile = {}) {
  if (schoolProfile?.street_address && schoolProfile.street_address.trim() !== '') {
    return schoolProfile.street_address.trim();
  }
  if (schoolProfile?.address && schoolProfile.address.trim() !== '') {
    return schoolProfile.address.trim();
  }
  return 'Civil Lines, Central Education Hub';
}

export function formatDateOfBirth(dobStr) {
  if (!dobStr || dobStr === '—') return '—';
  const str = dobStr.toString().trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD/MM/YYYY
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return str;
}

export function compileReportCardData(card = {}, schoolProfile = {}, currentYear = {}, exam = {}) {
  // If card is already marked as final session report
  if (card.is_final_session_report) {
    return card;
  }

  const student = {
    id: card.student_id || card.id || null,
    name: card.student_name || card.name || 'Student Name',
    roll_no: card.roll_no || card.roll || '—',
    admission_no: card.admission_no || card.sr_no || '—',
    class_name: card.class_name || '—',
    section: card.class_section || card.section || '',
    father_name: card.father_name || '—',
    mother_name: card.mother_name || '—',
    dob: formatDateOfBirth(card.date_of_birth || card.dob),
    photo_path: card.photo_path || card.avatar_url || null
  };

  const school = {
    id: schoolProfile?.id || null,
    name: (schoolProfile?.name || 'SHIKSHA PILOT SCHOOL').toUpperCase(),
    logo_path: schoolProfile?.logo_path || null,
    address: formatSchoolAddress(schoolProfile),
    phone: schoolProfile?.phone || schoolProfile?.contact_no || '',
    email: schoolProfile?.email || '',
    website: schoolProfile?.website || '',
    principal_signature_path: schoolProfile?.principal_signature_path || null
  };

  const academic_year = {
    name: currentYear?.name || card.academic_year_name || '2026–2027'
  };

  const exam_info = {
    name: exam?.name || card.exam_name || 'Annual Examination',
    type: exam?.type || 'Summative Assessment',
    is_final_session_report: Boolean(exam?.is_final_session_report || card.is_final_session_report)
  };

  const rawSubjects = Array.isArray(card.subjects) ? card.subjects : [];
  const subjects = rawSubjects.map((s) => {
    const rawVal = String(s.marks_obtained ?? s.marks ?? '').toUpperCase().trim();
    const isGradeOnly = s.evaluation_type === 'grade' || 
                        parseFloat(s.max_marks) === 0 || 
                        ['A+', 'A', 'B', 'C', 'D', 'E'].includes(rawVal);

    if (isGradeOnly) {
      const assignedGrade = rawVal && rawVal !== '—' ? rawVal : (s.grade || 'A');
      return {
        subject_name: s.subject_name || s.name || 'Subject',
        marks_obtained: '—',
        max_marks: '—',
        passing_marks: '—',
        grade: assignedGrade,
        result: 'PASS',
        is_grade_only: true
      };
    }

    const obtained = parseFloat(s.marks_obtained) || 0;
    const max = parseFloat(s.max_marks) || 100;
    const pass = parseFloat(s.passing_marks) || 33;
    const result = obtained >= pass ? 'PASS' : 'FAIL';

    return {
      subject_name: s.subject_name || s.name || 'Subject',
      marks_obtained: obtained,
      max_marks: max,
      passing_marks: pass,
      grade: s.grade || calculateDefaultGrade(obtained, max),
      result: s.result || result,
      is_grade_only: false
    };
  });

  const numericSubjects = subjects.filter(s => !s.is_grade_only);
  const totalObtained = parseFloat(card.total_obtained) || numericSubjects.reduce((sum, s) => sum + (parseFloat(s.marks_obtained) || 0), 0);
  const totalMax = parseFloat(card.total_max) || numericSubjects.reduce((sum, s) => sum + (parseFloat(s.max_marks) || 0), 0);
  const percentage = card.percentage ? parseFloat(card.percentage) : (totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0);
  const overallGrade = card.grade || calculateDefaultGrade(totalObtained, totalMax);
  const gpa = (percentage / 10).toFixed(1);

  const resultStatus = card.result || (percentage >= 33 ? 'PASS' : 'FAIL');
  const promotionStatus = resultStatus === 'PASS' 
    ? `Promoted to ${getNextClassName(student.class_name)}`
    : `Retained in ${student.class_name}`;

  const teacherRemark = card.report_card_remark || schoolProfile?.report_card_remark || '';

  const attendance = {
    present_days: card.attendance?.present_days ?? card.present_days ?? 0,
    working_days: card.attendance?.working_days ?? card.working_days ?? 0,
    attendance_rate: card.attendance?.attendance_rate ?? (
      (card.attendance?.working_days || 0) > 0 
        ? parseFloat(((card.attendance.present_days / card.attendance.working_days) * 100).toFixed(1))
        : 0
    )
  };

  return {
    student,
    school,
    academic_year,
    exam: exam_info,
    subjects,
    summary: {
      total_obtained: totalObtained,
      total_max: totalMax,
      percentage,
      grade: overallGrade,
      gpa,
      class_rank: card.class_rank || '1st',
      section_rank: card.section_rank || '1st',
      result: resultStatus,
      attendance,
      promotion_status: promotionStatus,
      teacher_remark: teacherRemark
    }
  };
}

/**
 * Layer 1 Engine Aggregator for FINAL ACADEMIC REPORT CARDS (Annual Session Summary)
 * Combines multiple examination result cards for a student across an entire academic year
 * into a multi-exam breakdown table matching paper report card standards (Screenshot 2).
 */
export function compileFinalSessionReportCardData(
  examCards = [],
  weightagePolicy = { strategy: 'weighted_percentage', weights: { 'Quarterly': 20, 'Half Yearly': 30, 'Annual': 50 } },
  schoolProfile = {},
  currentYear = {}
) {
  if (!examCards || examCards.length === 0) {
    return null;
  }

  // Base student info from first available card
  const firstCard = examCards[0];
  const student = {
    id: firstCard.student_id || firstCard.id || null,
    name: firstCard.student_name || firstCard.name || 'Student Name',
    roll_no: firstCard.roll_no || firstCard.roll || '—',
    admission_no: firstCard.admission_no || firstCard.sr_no || '—',
    class_name: firstCard.class_name || '—',
    section: firstCard.class_section || firstCard.section || '',
    father_name: firstCard.father_name || '—',
    mother_name: firstCard.mother_name || '—',
    dob: formatDateOfBirth(firstCard.date_of_birth || firstCard.dob),
    photo_path: firstCard.photo_path || firstCard.avatar_url || null
  };

  const school = {
    id: schoolProfile?.id || null,
    name: (schoolProfile?.name || 'SHIKSHA PILOT SCHOOL').toUpperCase(),
    logo_path: schoolProfile?.logo_path || null,
    address: formatSchoolAddress(schoolProfile),
    phone: schoolProfile?.phone || schoolProfile?.contact_no || '',
    email: schoolProfile?.email || '',
    website: schoolProfile?.website || '',
    principal_signature_path: schoolProfile?.principal_signature_path || null
  };

  const academic_year = {
    name: currentYear?.name || firstCard.academic_year_name || '2026–2027'
  };

  const exam_info = {
    name: 'FINAL ACADEMIC REPORT CARD',
    type: 'Annual Session Summary',
    is_final_session_report: true
  };

  // Collect unique exam names in chronological order
  const sessionExamNamesSet = new Set();
  examCards.forEach(c => {
    if (c.exam_name) sessionExamNamesSet.add(c.exam_name);
  });
  const session_exams = Array.from(sessionExamNamesSet);
  if (session_exams.length === 0) {
    session_exams.push('Quarterly Exam', 'Half Yearly Exam', 'Annual Exam');
  }

  // Collect all unique subjects across all conducted session exams
  const subjectMap = {};
  examCards.forEach((c) => {
    const examName = c.exam_name || 'Exam';
    (c.subjects || []).forEach((sub) => {
      const name = sub.subject_name || sub.name;
      if (!name) return;
      if (!subjectMap[name]) {
        subjectMap[name] = {};
      }
      const rawVal = String(sub.marks_obtained ?? sub.marks ?? '').toUpperCase().trim();
      const isGradeOnly = sub.is_grade_only || 
                          sub.evaluation_type === 'grade' || 
                          parseFloat(sub.max_marks) === 0 || 
                          ['A+', 'A', 'B', 'C', 'D', 'E'].includes(rawVal);
      subjectMap[name][examName] = {
        marks_obtained: isGradeOnly ? '—' : (parseFloat(sub.marks_obtained) || 0),
        max_marks: isGradeOnly ? '—' : (parseFloat(sub.max_marks) || 100),
        passing_marks: isGradeOnly ? '—' : (parseFloat(sub.passing_marks) || 33),
        grade: sub.grade || (rawVal && rawVal !== '—' ? rawVal : 'A'),
        is_grade_only: isGradeOnly
      };
    });
  });

  // Calculate exam-wise totals
  const examTotalsMap = {};
  session_exams.forEach(exName => {
    examTotalsMap[exName] = { max_marks: 0, marks_obtained: 0 };
  });

  const finalSubjects = Object.keys(subjectMap).map((subjName) => {
    const examScoresMap = subjectMap[subjName];
    let grandTotalObtained = 0;
    let grandTotalMax = 0;
    let hasNumericScore = false;
    let lastAssignedGrade = 'A';

    session_exams.forEach(exName => {
      const score = examScoresMap[exName];
      if (score) {
        if (score.is_grade_only) {
          lastAssignedGrade = score.grade || 'A';
        } else {
          const numObt = typeof score.marks_obtained === 'number' ? score.marks_obtained : 0;
          const numMax = typeof score.max_marks === 'number' ? score.max_marks : 0;
          grandTotalObtained += numObt;
          grandTotalMax += numMax;
          hasNumericScore = true;

          examTotalsMap[exName].max_marks += numMax;
          examTotalsMap[exName].marks_obtained += numObt;
        }
      }
    });

    const grade = hasNumericScore 
      ? calculateDefaultGrade(grandTotalObtained, grandTotalMax)
      : lastAssignedGrade;

    return {
      subject_name: subjName,
      exam_scores: examScoresMap,
      grand_total_max: hasNumericScore ? grandTotalMax : '—',
      grand_total_obtained: hasNumericScore ? grandTotalObtained : '—',
      marks_obtained: hasNumericScore ? grandTotalObtained : '—',
      max_marks: hasNumericScore ? grandTotalMax : '—',
      passing_marks: 33,
      grade,
      result: hasNumericScore ? (grandTotalObtained >= (grandTotalMax * 0.33) ? 'PASS' : 'FAIL') : 'PASS'
    };
  });

  // Calculate grand session totals
  const numericSubjects = finalSubjects.filter(s => typeof s.grand_total_max === 'number' && typeof s.grand_total_obtained === 'number');
  const grandTotalObtained = numericSubjects.reduce((sum, s) => sum + s.grand_total_obtained, 0);
  const grandTotalMax = numericSubjects.reduce((sum, s) => sum + s.grand_total_max, 0);
  const percentage = grandTotalMax > 0 ? parseFloat(((grandTotalObtained / grandTotalMax) * 100).toFixed(2)) : 0;
  const overallGrade = calculateDefaultGrade(grandTotalObtained, grandTotalMax);
  const gpa = (percentage / 10).toFixed(1);

  const allPassed = finalSubjects.every(s => s.result === 'PASS');
  const resultStatus = allPassed ? 'PASS' : 'FAIL';
  const promotionStatus = resultStatus === 'PASS' 
    ? `Promoted to ${getNextClassName(student.class_name)}`
    : `Retained in ${student.class_name}`;

  // Cumulative annual attendance
  let totalPresentDays = 0;
  let totalWorkingDays = 0;
  examCards.forEach(c => {
    if (c.attendance) {
      totalPresentDays += parseInt(c.attendance.present_days || 0, 10);
      totalWorkingDays += parseInt(c.attendance.working_days || 0, 10);
    }
  });

  const attendanceRate = totalWorkingDays > 0 
    ? parseFloat(((totalPresentDays / totalWorkingDays) * 100).toFixed(1))
    : (firstCard.attendance?.attendance_rate || 94.55);

  const teacherRemark = schoolProfile?.report_card_remark || '';

  return {
    is_final_session_report: true,
    student,
    school,
    academic_year,
    exam: exam_info,
    session_exams,
    subjects: finalSubjects,
    exam_totals: examTotalsMap,
    summary: {
      total_obtained: grandTotalObtained,
      total_max: grandTotalMax,
      percentage,
      grade: overallGrade,
      gpa,
      class_rank: firstCard.class_rank || '1st',
      section_rank: firstCard.section_rank || '1st',
      result: resultStatus,
      attendance: {
        present_days: totalPresentDays || 208,
        working_days: totalWorkingDays || 220,
        attendance_rate: attendanceRate
      },
      promotion_status: promotionStatus,
      teacher_remark: teacherRemark
    }
  };
}

function calculateDefaultGrade(obtained, max) {
  if (!max || max <= 0) return 'D';
  const pct = (obtained / max) * 100;
  if (pct >= 91) return 'A1';
  if (pct >= 81) return 'A2';
  if (pct >= 71) return 'B1';
  if (pct >= 61) return 'B2';
  if (pct >= 51) return 'C1';
  if (pct >= 41) return 'C2';
  if (pct >= 33) return 'D';
  return 'E';
}

function getNextClassName(currentClass) {
  if (!currentClass) return 'Next Class';
  const match = currentClass.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return currentClass.replace(String(num), String(num + 1));
  }
  return `${currentClass} (Promoted)`;
}
