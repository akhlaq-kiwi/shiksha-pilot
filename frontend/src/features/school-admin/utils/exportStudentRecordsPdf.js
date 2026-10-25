import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { inlineContainerImages } from '../../../common/utils/inlineImages';
import { resolveFileUrl } from '../../../common/utils/fileUrl';

/**
 * Escapes special characters for safe inclusion in raw HTML strings.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats ISO date (YYYY-MM-DD) to formal 'DD Mon YYYY' (e.g. 23 Feb 2011).
 */
function formatDate(dateStr) {
  if (!dateStr || String(dateStr).trim() === '' || dateStr === '0000-00-00') return 'N/A';
  try {
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (!isNaN(year) && !isNaN(monthIdx) && monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${String(day).padStart(2, '0')} ${months[monthIdx]} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch (_) {}
  return String(dateStr);
}

/**
 * Builds formatted address string from constituent fields.
 */
function formatAddress({ line, city, state, pin, country }) {
  const parts = [];
  if (line && line.trim()) parts.push(line.trim());
  if (city && city.trim()) parts.push(city.trim());
  if (state && state.trim()) parts.push(state.trim());
  if (pin && pin.trim()) parts.push(`PIN: ${pin.trim()}`);
  if (country && country.trim() && country.trim().toLowerCase() !== 'india') {
    parts.push(country.trim());
  }
  return parts.length > 0 ? parts.join(', ') : 'N/A';
}

/**
 * Generates an initials avatar placeholder SVG data URL.
 */
function createInitialsAvatar(name) {
  const cleanName = (name || 'Student').trim();
  const initials = cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0] ? p[0].toUpperCase() : '')
    .join('') || 'S';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="105" height="130" viewBox="0 0 105 130">
    <rect width="105" height="130" fill="#f1f5f9"/>
    <rect x="2" y="2" width="101" height="126" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="3,3"/>
    <text x="52.5" y="68" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="30" font-weight="bold" fill="#64748b" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Renders a stylized field card with label and value.
 */
function renderFieldCard(label, value, { span = 1 } = {}) {
  const cleanVal = (value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '-')
    ? String(value).trim()
    : 'N/A';

  const spanStyle = span > 1 ? `grid-column: span ${span};` : '';

  return `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; box-sizing: border-box; ${spanStyle}">
      <div style="font-size: 8.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
        ${escapeHtml(label)}
      </div>
      <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; white-space: normal; word-break: break-word; line-height: 1.25;">
        ${escapeHtml(cleanVal)}
      </div>
    </div>
  `;
}

/**
 * Generates single-student HTML page string for rendering into A4 canvas.
 */
function buildStudentPageHtml({
  student,
  index,
  totalStudents,
  className,
  schoolName,
  schoolAddressLine,
  schoolLogoUrl,
  academicSession,
  generationDate,
}) {
  const studentName = student.name || [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') || 'Student';
  const studentClass = student.class_name || className || 'Class';
  const studentSection = student.section && String(student.section).trim() !== '' ? String(student.section).trim() : null;
  const studentClassSection = studentSection ? `${studentClass} - Sec ${studentSection}` : studentClass;

  // Photo
  const photoUrl = student.photo_path ? resolveFileUrl(student.photo_path) : null;
  const fallbackAvatar = createInitialsAvatar(studentName);
  const photoHtml = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='${fallbackAvatar}';" />`
    : `<img src="${fallbackAvatar}" alt="Photo" style="width: 100%; height: 100%; object-fit: contain;" />`;

  // Addresses
  const currentAddress = student.current_address_line
    ? formatAddress({
        line: student.current_address_line,
        city: student.current_city,
        state: student.current_state,
        pin: student.current_pin_code,
        country: student.current_country,
      })
    : (student.address && student.address.trim() ? student.address.trim() : 'N/A');

  let permanentAddress = 'N/A';
  if (student.same_as_current === 1 || student.same_as_current === true || student.same_as_current === '1') {
    permanentAddress = 'Same as Current Residence Address';
  } else if (student.permanent_address_line) {
    permanentAddress = formatAddress({
      line: student.permanent_address_line,
      city: student.permanent_city,
      state: student.permanent_state,
      pin: student.permanent_pin_code,
      country: student.permanent_country,
    });
  } else if (student.address && student.address.trim()) {
    permanentAddress = student.address.trim();
  }

  // Parent details
  const parentOccupation = student.father_occupation || student.mother_occupation || student.parent_occupation || 'N/A';
  const contactNumber = student.parent_phone || student.father_phone || student.student_mobile || student.mother_phone || student.guardian_phone || 'N/A';

  // Status styling
  const studentStatus = (student.status || 'ACTIVE').toUpperCase();
  const statusBg = studentStatus === 'ACTIVE' ? '#dcfce7' : '#fee2e2';
  const statusColor = studentStatus === 'ACTIVE' ? '#166534' : '#991b1b';
  const statusBorder = studentStatus === 'ACTIVE' ? '#86efac' : '#fca5a5';
  const statusStyle = `background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder};`;

  // School Logo element
  const logoHtml = schoolLogoUrl
    ? `<img src="${escapeHtml(schoolLogoUrl)}" alt="Logo" style="height: 48px; width: auto; max-width: 90px; object-fit: contain; flex-shrink: 0;" />`
    : `<div style="width: 46px; height: 46px; border-radius: 6px; background: #0f172a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 19px; flex-shrink: 0;">${escapeHtml(schoolName.charAt(0))}</div>`;

  return `
    <div 
      style="
        width: 794px; 
        height: 1123px; 
        box-sizing: border-box; 
        background-color: #ffffff; 
        color: #0f172a; 
        margin: 0; 
        padding: 26px 30px; 
        display: flex; 
        flex-direction: column; 
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      "
    >
      <div 
        style="
          width: 100%; 
          height: 100%; 
          box-sizing: border-box; 
          border: 2px solid #1e293b; 
          padding: 24px 26px; 
          display: flex; 
          flex-direction: column; 
          justify-content: space-between;
        "
      >
        <!-- TOP: Header & Details -->
        <div>
          <!-- Header Section (Tel and Email removed as requested) -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                ${logoHtml}
                <div style="min-width: 0;">
                  <h1 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin: 0; line-height: 1.2;">
                    ${escapeHtml(schoolName)}
                  </h1>
                  ${schoolAddressLine ? `
                    <div style="font-size: 10.5px; color: #475569; margin-top: 3px; line-height: 1.35;">
                      ${escapeHtml(schoolAddressLine)}
                    </div>
                  ` : ''}
                </div>
              </div>

              <div style="text-align: right; flex-shrink: 0;">
                <div style="display: inline-block; background: #0f172a; color: #ffffff; font-size: 12px; font-weight: 800; letter-spacing: 1px; padding: 4px 12px; border-radius: 4px; text-transform: uppercase;">
                  STUDENT RECORD
                </div>
                <div style="font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 4px;">
                  SESSION: <span style="font-weight: 600; color: #334155;">${escapeHtml(academicSession)}</span>
                </div>
                <div style="font-size: 10px; font-weight: 700; color: #0f172a;">
                  CLASS: <span style="font-weight: 600; color: #334155;">${escapeHtml(studentClassSection)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 1: STUDENT IDENTIFICATION & DEMOGRAPHICS -->
          <div style="margin-bottom: 16px;">
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 10px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #0f172a; margin-bottom: 10px;">
              STUDENT IDENTIFICATION &amp; DEMOGRAPHICS
            </div>

            <!-- Unified Top Container: Student Name + Status Badge + Photograph -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 18px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
              <!-- Left: Student Name & Active Status -->
              <div style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;">
                  <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px;">
                    STUDENT NAME:
                  </span>
                  <span style="font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px;">
                    ${escapeHtml(studentName)}
                  </span>
                  <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2.5px 11px; border-radius: 5px; ${statusStyle}; vertical-align: middle; margin-left: 6px;">
                    ${escapeHtml(studentStatus)}
                  </span>
                </div>
              </div>

              <!-- Right: Photograph Frame -->
              <div style="display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
                <div style="width: 70px; height: 84px; border: 1.5px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                  ${photoHtml}
                </div>
                <div style="font-size: 7.5px; color: #64748b; margin-top: 3px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">
                  PHOTOGRAPH
                </div>
              </div>
            </div>

            <!-- Full-Width Grid of the Remaining 15 Cards (5 Rows x 3 Columns) -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px; width: 100%;">
              ${renderFieldCard('CLASS & SECTION', studentClassSection)}
              ${renderFieldCard('SR No', student.sr_no || student.admission_no || student.id)}
              ${renderFieldCard('ROLL NUMBER', student.roll_no || '-')}

              ${renderFieldCard("FATHER'S NAME", student.father_name)}
              ${renderFieldCard("MOTHER'S NAME", student.mother_name)}
              ${renderFieldCard('Parent Occupation', parentOccupation)}

              ${renderFieldCard('DATE OF BIRTH', formatDate(student.dob))}
              ${renderFieldCard('GENDER', student.gender)}
              ${renderFieldCard('BLOOD GROUP', student.blood_group)}

              ${renderFieldCard('ADMISSION DATE', formatDate(student.admission_date))}
              ${renderFieldCard('CATEGORY / CASTE', student.category || student.student_category)}
              ${renderFieldCard('RELIGION', student.religion)}

              ${renderFieldCard('AADHAAR NUMBER', student.aadhaar_no)}
              ${renderFieldCard('Contact Number', contactNumber)}
              ${renderFieldCard('STUDENT EMAIL', student.student_email || student.email)}
            </div>
          </div>

          <!-- Section 2: RESIDENTIAL & CORRESPONDENCE ADDRESS -->
          <div style="margin-bottom: 12px;">
            <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 5px 10px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #0f172a; margin-bottom: 10px;">
              RESIDENTIAL &amp; CORRESPONDENCE ADDRESS
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <!-- Current Residence Address -->
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 14px;">
                <div style="font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px;">
                  CURRENT RESIDENCE ADDRESS:
                </div>
                <div style="font-size: 11.5px; font-weight: 600; color: #0f172a; line-height: 1.45; min-height: 40px; word-break: break-word;">
                  ${escapeHtml(currentAddress)}
                </div>
              </div>
              <!-- Permanent Address -->
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 14px;">
                <div style="font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px;">
                  PERMANENT ADDRESS:
                </div>
                <div style="font-size: 11.5px; font-weight: 600; color: #0f172a; line-height: 1.45; min-height: 40px; word-break: break-word;">
                  ${escapeHtml(permanentAddress)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BOTTOM: Attestation Signatures & Page Footer -->
        <div>
          <!-- Attestation Signatures -->
          <div style="border-top: 1.5px dashed #cbd5e1; padding-top: 20px; margin-top: 14px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 25px; font-size: 10.5px;">
              <div style="text-align: center; min-width: 140px;">
                <div style="border-top: 1px solid #475569; padding-top: 5px; font-weight: 700; color: #1e293b;">
                  Class Teacher's Signature
                </div>
              </div>
              <div style="text-align: center; min-width: 140px;">
                <div style="border-top: 1px solid #475569; padding-top: 5px; font-weight: 700; color: #1e293b;">
                  Administrative Officer
                </div>
              </div>
              <div style="text-align: center; min-width: 140px;">
                <div style="border-top: 1px solid #475569; padding-top: 5px; font-weight: 700; color: #1e293b;">
                  Principal / Authorized Seal
                </div>
              </div>
            </div>
          </div>

          <!-- Page Footer -->
          <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>CONFIDENTIAL OFFICIAL SCHOOL RECORD</strong> • Shiksha Pilot ERP
            </div>
            <div>
              Generated: ${escapeHtml(generationDate)}
            </div>
            <div style="font-weight: 700; color: #0f172a;">
              Page ${index + 1} of ${totalStudents}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates and downloads a multi-page PDF containing exactly one student record per page.
 * Uses jsPDF and html2canvas per student page to ensure 100% reliable rendering, zero blank pages,
 * and exact 1:1 page-to-student correspondence.
 *
 * @param {Object} options
 * @param {string} options.className - The short name or display name of the class (e.g. "Class 1")
 * @param {Array<Object>} options.students - List of student objects belonging to this class
 * @param {Object} [options.schoolProfile] - School metadata (name, logo, address, phone, email)
 * @param {Object} [options.currentYear] - Academic year metadata
 * @param {Function} [options.onProgress] - Optional callback({ current, total, studentName })
 */
export async function exportStudentRecordsPdf({
  className,
  students = [],
  schoolProfile = null,
  currentYear = null,
  onProgress = null,
}) {
  if (!students || students.length === 0) {
    throw new Error('No students found to export.');
  }

  const schoolName = schoolProfile?.name || 'SHIKSHA PILOT SCHOOL';
  const schoolAddressParts = [
    schoolProfile?.street_address,
    schoolProfile?.city,
    schoolProfile?.state,
    schoolProfile?.pin_code ? `PIN: ${schoolProfile.pin_code}` : null,
  ].filter(Boolean);

  // Tel and Email removed from Header section as requested
  const schoolAddressLine = schoolAddressParts.length > 0 
    ? schoolAddressParts.join(', ')
    : '';

  const rawLogo = schoolProfile?.logo_path || schoolProfile?.logo_url || schoolProfile?.logo || null;
  const schoolLogoUrl = rawLogo ? resolveFileUrl(rawLogo) : null;
  const academicSession = currentYear?.name || students[0]?.academic_year_name || '2025–2026';

  const generationDate = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const totalStudents = students.length;

  // Initialize jsPDF document (A4 portrait)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Create an on-screen host container positioned at top: 0, left: 0 so html2canvas renders perfectly
  const renderHost = document.createElement('div');
  renderHost.id = 'export-student-records-render-host';
  renderHost.style.position = 'fixed';
  renderHost.style.top = '0';
  renderHost.style.left = '0';
  renderHost.style.width = '794px';
  renderHost.style.height = '1123px';
  renderHost.style.zIndex = '999990';
  renderHost.style.backgroundColor = '#ffffff';
  renderHost.style.pointerEvents = 'none';
  renderHost.style.overflow = 'hidden';
  document.body.appendChild(renderHost);

  try {
    for (let i = 0; i < totalStudents; i++) {
      const student = students[i];
      const studentName = student.name || [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ') || `Student ${i + 1}`;

      if (typeof onProgress === 'function') {
        onProgress({ current: i + 1, total: totalStudents, studentName });
      }

      // Build single student page HTML
      const pageHtml = buildStudentPageHtml({
        student,
        index: i,
        totalStudents,
        className,
        schoolName,
        schoolAddressLine,
        schoolLogoUrl,
        academicSession,
        generationDate,
      });

      renderHost.innerHTML = pageHtml;

      // Allow DOM to settle and inline images to Base64 data URLs
      await new Promise((r) => setTimeout(r, 60));
      let restoreFn = null;
      try {
        restoreFn = await inlineContainerImages(renderHost);
      } catch (imgErr) {
        console.warn('Image inlining warning for student', studentName, imgErr);
      }

      // Capture single page via html2canvas
      const canvas = await html2canvas(renderHost, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123,
      });

      if (restoreFn) {
        try {
          restoreFn();
        } catch (_) {}
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Add to PDF page covering full A4 portrait (210mm x 297mm)
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    // Dynamic filename: Class_1_Student_Records.pdf (collapse non-alphanumeric chars to single underscore)
    const sanitizedClassName = (className || 'Class').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const filename = `${sanitizedClassName}_Student_Records.pdf`;

    pdf.save(filename);
    return filename;
  } finally {
    if (document.body.contains(renderHost)) {
      document.body.removeChild(renderHost);
    }
  }
}

export default exportStudentRecordsPdf;
