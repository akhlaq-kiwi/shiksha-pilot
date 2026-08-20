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

export function compileReportCardData(card = {}, schoolProfile = {}, currentYear = {}, exam = {}, gradeScales = []) {
  const gradeScalesList = Array.isArray(gradeScales) && gradeScales.length > 0
    ? gradeScales
    : (schoolProfile?.grade_scales || card.grade_scales || []);

  const student = {
    id: card.student?.id || card.student_id || card.id || null,
    name: card.student?.name || card.student_name || card.name || 'Student Name',
    roll_no: card.student?.roll_no || card.roll_no || card.roll || '—',
    admission_no: card.student?.admission_no || card.admission_no || card.sr_no || '—',
    class_name: card.student?.class_name || card.class_name || '—',
    section: card.student?.section || card.class_section || card.section || '',
    father_name: card.student?.father_name || card.father_name || card.father_name_text || card.father || card.guardian_name || '—',
    mother_name: card.student?.mother_name || card.mother_name || card.mother_name_text || card.mother || '—',
    dob: formatDateOfBirth(card.student?.dob || card.date_of_birth || card.dob),
    photo_path: card.student?.photo_path || card.photo_path || card.avatar_url || null
  };

  const school = {
    id: schoolProfile?.id || card.school?.id || null,
    name: (schoolProfile?.name || card.school?.name || card.school_name || 'SHIKSHA PILOT SCHOOL').toUpperCase(),
    logo_path: schoolProfile?.logo_path || card.school?.logo_path || card.school_logo || null,
    address: formatSchoolAddress(schoolProfile?.name ? schoolProfile : (card.school || { address: card.school_address })).toUpperCase(),
    phone: schoolProfile?.phone || card.school?.phone || '',
    email: schoolProfile?.email || card.school?.email || '',
    website: schoolProfile?.website || card.school?.website || '',
    principal_signature_path: schoolProfile?.principal_signature_path || card.school?.principal_signature_path || null
  };

  const academic_year = {
    name: currentYear?.name || card.academic_year?.name || card.academic_year_name || '2026–2027'
  };

  const exam_info = {
    name: exam?.name || card.exam?.name || card.exam_name || 'Annual Examination',
    type: exam?.type || 'Summative Assessment',
    is_final_session_report: Boolean(exam?.is_final_session_report || card.is_final_session_report)
  };

  // If card is already marked as final session report
  if (card.is_final_session_report) {
    return {
      ...card,
      student,
      school,
      academic_year,
      exam: exam_info,
      summary: card.summary || {
        total_max: card.total_max ?? 0,
        total_obtained: card.total_obtained ?? 0,
        percentage: card.percentage ?? 0,
        grade: card.grade ?? 'A',
        result: card.result ?? 'PASS',
        class_rank: card.class_rank ?? '1 of 1',
        attendance: card.attendance ?? { attendance_rate: 100 }
      }
    };
  }

  const rawSubjects = Array.isArray(card.subjects) ? card.subjects : [];
  const subjects = rawSubjects.map((s) => {
    const rawVal = String(s.marks_obtained ?? s.marks ?? '').toUpperCase().trim();
    const isGradeOnly = s.evaluation_type === 'grade' || 
                        parseFloat(s.max_marks) === 0 || 
                        ['A+', 'A', 'B', 'C', 'D', 'E'].includes(rawVal);

    if (isGradeOnly) {
      const assignedGrade = rawVal && rawVal !== '—' ? rawVal : (s.grade || 'A');
      return {
        subject_id: s.subject_id || s.id || null,
        subject_name: s.subject_name || s.name || 'Subject',
        marks_obtained: assignedGrade,
        max_marks: 'GRADE',
        passing_marks: 'C',
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
      subject_id: s.subject_id || s.id || null,
      subject_name: s.subject_name || s.name || 'Subject',
      marks_obtained: obtained,
      max_marks: max,
      passing_marks: pass,
      grade: calculateGradeFromScales(max > 0 ? (obtained / max) * 100 : 0, gradeScalesList),
      result: s.result || result,
      is_grade_only: false
    };
  });

  // Sort subjects: Marks-based first, Grade-based at the bottom
  // Secondary sort: Master subject order (subject_id)
  subjects.sort((a, b) => {
    if (a.is_grade_only !== b.is_grade_only) {
      return a.is_grade_only ? 1 : -1;
    }
    if (a.subject_id && b.subject_id && a.subject_id !== b.subject_id) {
      return a.subject_id - b.subject_id;
    }
    return 0;
  });

  const numericSubjects = subjects.filter(s => !s.is_grade_only);
  const totalObtained = numericSubjects.reduce((sum, s) => sum + (parseFloat(s.marks_obtained) || 0), 0);
  const totalMax = numericSubjects.reduce((sum, s) => sum + (parseFloat(s.max_marks) || 0), 0);
  const percentage = card.percentage ? parseFloat(card.percentage) : (totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(2)) : 0);
  const overallGrade = calculateGradeFromScales(percentage, gradeScalesList);
  const gpa = (percentage / 10).toFixed(1);

  const resultStatus = card.result || (percentage >= 33 ? 'PASS' : 'FAIL');
  const promotionStatus = resultStatus === 'PASS' 
    ? `Promoted to ${getNextClassName(student.class_name)}`
    : `Retained in ${student.class_name}`;

  const teacherRemark = card.report_card_remark ?? schoolProfile?.report_card_remark ?? card.teacher_remark ?? '';

  const attData = (typeof card.attendance === 'object' && card.attendance !== null) ? card.attendance : {};
  const attRateComputed = attData.attendance_rate ?? card.attendance_pct ?? card.attendance_percentage ?? (typeof card.attendance === 'number' ? card.attendance : null);
  const attendanceObj = {
    working_days: attData.working_days || card.attendance_total || card.total_days || 0,
    present_days: attData.present_days || card.attendance_present || card.present_days || 0,
    attendance_rate: attRateComputed
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
      result: resultStatus,
      promotion_status: promotionStatus,
      teacher_remark: teacherRemark,
      class_rank: card.class_rank || '1st',
      section_rank: card.section_rank || '1st',
      attendance: attendanceObj
    },
    attendance: attendanceObj,
    class_rank: card.class_rank || '1st',
    section_rank: card.section_rank || '1st',
    teacher_remark: teacherRemark,
    is_final_session_report: false
  };
}

/**
 * Layer 1 Engine Aggregator for FINAL ACADEMIC REPORT CARDS (Annual Session Summary)
 * Combines multiple examination result cards for a student across an entire academic year
 * into a multi-exam breakdown table matching paper report card standards (Screenshot 2).
 */
export function compileFinalSessionReportCardData(examCards = [], weightagePolicy = {}, schoolProfile = {}, currentYear = {}, gradeScales = []) {
  if (!Array.isArray(examCards) || examCards.length === 0) {
    return null;
  }

  const baseCard = examCards[0] || {};
  const gradeScalesList = Array.isArray(gradeScales) && gradeScales.length > 0
    ? gradeScales
    : (schoolProfile?.grade_scales || baseCard.grade_scales || []);
  const student = {
    id: baseCard.student?.id || baseCard.student_id || baseCard.id || null,
    name: baseCard.student?.name || baseCard.student_name || baseCard.name || 'Student Name',
    roll_no: baseCard.student?.roll_no || baseCard.roll_no || baseCard.roll || '—',
    admission_no: baseCard.student?.admission_no || baseCard.admission_no || baseCard.sr_no || '—',
    class_name: baseCard.student?.class_name || baseCard.class_name || baseCard.class || 'Class 1',
    section: baseCard.student?.section || baseCard.class_section || baseCard.section || '',
    father_name: baseCard.student?.father_name || baseCard.father_name || baseCard.father_name_text || baseCard.father || baseCard.guardian_name || '—',
    mother_name: baseCard.student?.mother_name || baseCard.mother_name || baseCard.mother_name_text || baseCard.mother || '—',
    dob: formatDateOfBirth(baseCard.student?.dob || baseCard.date_of_birth || baseCard.dob)
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
    name: currentYear?.name || baseCard.academic_year_name || '2026–2027'
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
      const assignedGrade = rawVal && rawVal !== '—' ? rawVal : (sub.grade || 'A');
      subjectMap[name][examName] = {
        subject_id: sub.subject_id || sub.id || null,
        marks_obtained: isGradeOnly ? assignedGrade : (parseFloat(sub.marks_obtained) || 0),
        max_marks: isGradeOnly ? 'GRADE' : (parseFloat(sub.max_marks) || 100),
        passing_marks: isGradeOnly ? 'C' : (parseFloat(sub.passing_marks) || 33),
        grade: assignedGrade,
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
    let masterSubjectId = null;

    session_exams.forEach(exName => {
      const score = examScoresMap[exName];
      if (score) {
        if (score.subject_id && !masterSubjectId) masterSubjectId = score.subject_id;
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

    const isSubjectGradeOnly = Object.values(examScoresMap).some(s => s && s.is_grade_only) || !hasNumericScore;

    const grade = !isSubjectGradeOnly 
      ? calculateGradeFromScales(grandTotalMax > 0 ? (grandTotalObtained / grandTotalMax) * 100 : 0, gradeScalesList)
      : lastAssignedGrade;

    return {
      subject_id: masterSubjectId,
      subject_name: subjName,
      exam_scores: examScoresMap,
      grand_total_max: !isSubjectGradeOnly ? grandTotalMax : 'GRADE',
      grand_total_obtained: !isSubjectGradeOnly ? grandTotalObtained : lastAssignedGrade,
      marks_obtained: !isSubjectGradeOnly ? grandTotalObtained : lastAssignedGrade,
      max_marks: !isSubjectGradeOnly ? grandTotalMax : 'GRADE',
      passing_marks: !isSubjectGradeOnly ? 33 : 'C',
      grade,
      result: !isSubjectGradeOnly ? (grandTotalObtained >= (grandTotalMax * 0.33) ? 'PASS' : 'FAIL') : 'PASS',
      is_grade_only: isSubjectGradeOnly
    };
  });

  // Sort final session subjects: Marks-based first, Grade-based at the bottom
  // Secondary sort: Master subject order (subject_id)
  finalSubjects.sort((a, b) => {
    if (a.is_grade_only !== b.is_grade_only) {
      return a.is_grade_only ? 1 : -1;
    }
    if (a.subject_id && b.subject_id && a.subject_id !== b.subject_id) {
      return a.subject_id - b.subject_id;
    }
    return 0;
  });

  // Calculate grand session totals
  const numericSubjects = finalSubjects.filter(s => typeof s.grand_total_max === 'number' && typeof s.grand_total_obtained === 'number');
  const grandTotalObtained = numericSubjects.reduce((sum, s) => sum + s.grand_total_obtained, 0);
  const grandTotalMax = numericSubjects.reduce((sum, s) => sum + s.grand_total_max, 0);
  const percentage = grandTotalMax > 0 ? parseFloat(((grandTotalObtained / grandTotalMax) * 100).toFixed(2)) : 0;
  const overallGrade = calculateGradeFromScales(percentage, gradeScalesList);
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
    : (baseCard.attendance?.attendance_rate || 94.55);

  const teacherRemark = schoolProfile?.report_card_remark ?? baseCard.report_card_remark ?? '';

  return {
    is_final_session_report: true,
    student,
    school,
    academic_year,
    exam: {
      name: 'FINAL ACADEMIC REPORT CARD',
      type: 'Annual Session Summary',
      is_final_session_report: true
    },
    session_exams,
    subjects: finalSubjects,
    exam_totals: examTotalsMap,
    summary: {
      total_obtained: grandTotalObtained,
      total_max: grandTotalMax,
      percentage,
      grade: overallGrade,
      gpa,
      class_rank: baseCard.class_rank || '1st',
      section_rank: baseCard.section_rank || '1st',
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

export function calculateGradeFromScales(pct, gradeScales = []) {
  const numericPct = parseFloat(pct) || 0;

  if (Array.isArray(gradeScales) && gradeScales.length > 0) {
    for (const s of gradeScales) {
      const min = parseFloat(s.min_percentage ?? s.min_percent ?? 0);
      const max = parseFloat(s.max_percentage ?? s.max_percent ?? 100);
      if (numericPct >= min && numericPct <= max) {
        return s.grade || s.grade_code || 'B';
      }
    }
  }

  // Fallback matching default Grade Configuration Scale: A (75-100), B (60-74.99), C (40-59.99), D (0-39.99)
  if (numericPct >= 75) return 'A';
  if (numericPct >= 60) return 'B';
  if (numericPct >= 40) return 'C';
  return 'D';
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
