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
    dob: card.date_of_birth || card.dob || '—',
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
      result: s.result || result
    };
  });

  const totalObtained = parseFloat(card.total_obtained) || subjects.reduce((sum, s) => sum + s.marks_obtained, 0);
  const totalMax = parseFloat(card.total_max) || subjects.reduce((sum, s) => sum + s.max_marks, 0);
  const percentage = card.percentage ? parseFloat(card.percentage) : (totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0);
  const overallGrade = card.grade || calculateDefaultGrade(totalObtained, totalMax);
  const gpa = (percentage / 10).toFixed(1);

  const resultStatus = card.result || (percentage >= 33 ? 'PASS' : 'FAIL');
  const promotionStatus = resultStatus === 'PASS' 
    ? `Promoted to ${getNextClassName(student.class_name)}`
    : `Retained in ${student.class_name}`;

  const teacherRemark = card.report_card_remark || schoolProfile?.report_card_remark || (
    resultStatus === 'PASS'
      ? 'Excellent academic performance throughout the evaluation period.'
      : 'The student requires additional academic assistance to meet standards.'
  );

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
    dob: firstCard.date_of_birth || firstCard.dob || '—',
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
      subjectMap[name][examName] = {
        marks_obtained: parseFloat(sub.marks_obtained) || 0,
        max_marks: parseFloat(sub.max_marks) || 100,
        passing_marks: parseFloat(sub.passing_marks) || 33
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
    let passingMarks = 33;

    session_exams.forEach(exName => {
      const score = examScoresMap[exName];
      if (score) {
        grandTotalObtained += score.marks_obtained;
        grandTotalMax += score.max_marks;
        passingMarks = score.passing_marks;

        examTotalsMap[exName].max_marks += score.max_marks;
        examTotalsMap[exName].marks_obtained += score.marks_obtained;
      }
    });

    const grade = calculateDefaultGrade(grandTotalObtained, grandTotalMax);
    const result = grandTotalObtained >= (passingMarks * session_exams.length) ? 'PASS' : 'FAIL';

    return {
      subject_name: subjName,
      exam_scores: examScoresMap,
      grand_total_max: grandTotalMax || 100,
      grand_total_obtained: grandTotalObtained,
      marks_obtained: grandTotalObtained, // fallback for single-table renderers
      max_marks: grandTotalMax || 100,
      passing_marks: passingMarks,
      grade,
      result
    };
  });

  // Calculate grand session totals
  const grandTotalObtained = finalSubjects.reduce((sum, s) => sum + s.grand_total_obtained, 0);
  const grandTotalMax = finalSubjects.reduce((sum, s) => sum + s.grand_total_max, 0);
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

  const teacherRemark = schoolProfile?.report_card_remark || (
    resultStatus === 'PASS'
      ? 'Outstanding performance! Demonstrates exemplary academic dedication and leadership throughout the session.'
      : 'The student requires additional academic assistance to meet promotion standards.'
  );

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
