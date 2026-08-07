import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Download, Printer, User, PenTool } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card } from '../../../common/ui/card';
import { schoolService } from '../../../common/services/schoolService';
import html2pdf from 'html2pdf.js';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';

// Self-healing Student Avatar with gender/initials fallback for ID Cards
const IdCardAvatar = ({ src, name, updatedAt }) => {
  const [error, setError] = useState(false);

  if (src && !error) {
    const fileUrl = src.startsWith('http') ? src : src;
    const cleanUrl = updatedAt ? `${fileUrl}?v=${encodeURIComponent(updatedAt)}` : fileUrl;
    return (
      <img
        src={cleanUrl}
        alt={name || 'Student'}
        onError={() => setError(true)}
        className="w-full h-full object-cover rounded-xl"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

  return (
    <div className="w-full h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-700 dark:text-zinc-300 flex flex-col items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 select-none">
      <User className="h-8 w-8 opacity-60 mb-0.5" />
      <span className="text-[11px] font-bold uppercase tracking-wider">{initials}</span>
    </div>
  );
};

export default function ClassIdentityCardPreview({
  className: classNameProp,
  students = [],
  schoolProfile = null,
  currentYear = null,
  onBack
}) {
  const [downloading, setDownloading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [signatureError, setSignatureError] = useState(false);
  const [activeSignature, setActiveSignature] = useState(schoolProfile?.principal_signature_path || null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const printContainerRef = useRef(null);

  useEffect(() => {
    setActiveSignature(schoolProfile?.principal_signature_path || null);
    setSignatureError(false);
  }, [schoolProfile?.principal_signature_path]);

  // Sort students ascending by Roll Number (numerically parsed)
  const sortedStudents = [...students].sort((a, b) => {
    const rollA = parseInt(a.roll_no || a.roll || '999999', 10);
    const rollB = parseInt(b.roll_no || b.roll || '999999', 10);
    if (rollA !== rollB) {
      return rollA - rollB;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  const schoolName = schoolProfile?.name || 'SHIKSHA PILOT SCHOOL';
  const schoolLogo = schoolProfile?.logo_path || null;
  const academicYearName = currentYear?.name || '2027–2028';

  // Smart Adaptive Ink Signature Extraction & Auto-Crop
  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg'].includes(ext)) {
      alert('Only PNG, JPG, and JPEG files are accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    setUploadingSig(true);
    setSignatureError(false);
    try {
      const processedFile = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            const len = data.length;

            let sumLum = 0;
            let maxLum = 0;
            const luminances = new Float32Array(len / 4);

            for (let i = 0; i < len; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const lum = r * 0.299 + g * 0.587 + b * 0.114;
              luminances[i / 4] = lum;
              sumLum += lum;
              if (lum > maxLum) maxLum = lum;
            }

            const avgLum = sumLum / (len / 4);
            const paperThreshold = Math.min(240, Math.max(avgLum * 0.88, maxLum * 0.72));

            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            let hasInk = false;

            for (let i = 0; i < len; i += 4) {
              const idx = i / 4;
              const lum = luminances[idx];
              const x = idx % canvas.width;
              const y = Math.floor(idx / canvas.width);
              const r = data[i], g = data[i + 1], b = data[i + 2];

              const isPaper = lum >= paperThreshold || (r > 120 && g > 120 && b > 120 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && lum > 140);

              if (isPaper) {
                data[i + 3] = 0; // Paper pixel -> Transparent
              } else {
                hasInk = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;

                const contrastFactor = Math.max(0, (paperThreshold - lum) / paperThreshold);
                data[i + 3] = Math.min(255, Math.round(contrastFactor * 255 * 1.8));
              }
            }

            ctx.putImageData(imgData, 0, 0);

            let finalCanvas = canvas;
            if (hasInk && maxX > minX && maxY > minY) {
              const cropW = maxX - minX + 1;
              const cropH = maxY - minY + 1;
              const cropCanvas = document.createElement('canvas');
              cropCanvas.width = cropW;
              cropCanvas.height = cropH;
              const cropCtx = cropCanvas.getContext('2d');
              cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
              finalCanvas = cropCanvas;
            }

            finalCanvas.toBlob((blob) => {
              if (blob) {
                const fileRes = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".png", { type: 'image/png' });
                resolve(fileRes);
              } else {
                resolve(file);
              }
            }, 'image/png');
          };
          img.onerror = () => resolve(file);
          img.src = event.target.result;
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
      });

      const formData = new FormData();
      formData.append('signature', processedFile);

      const updatedProfile = await schoolService.uploadPrincipalSignature(formData);
      setActiveSignature(updatedProfile.principal_signature_path);
      window.dispatchEvent(new CustomEvent('school-profile-updated', { detail: updatedProfile }));
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to extract & upload signature.');
    } finally {
      setUploadingSig(false);
    }
  };

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const studentChunks = chunkArray(sortedStudents, 6);

  // Handle High-Resolution Image Export (PNG ZIP)
  const handleDownloadZip = async (e) => {
    if (e) e.preventDefault();
    const container = printContainerRef.current;
    if (!container || sortedStudents.length === 0) return;

    setDownloading(true);
    try {
      const zip = new JSZip();
      const cardNodes = container.querySelectorAll('.id-card-wrapper');

      for (let i = 0; i < sortedStudents.length; i++) {
        const student = sortedStudents[i];
        const cardNode = cardNodes[i];

        if (!cardNode) continue;

        // Render card at 3x scale for crisp 300 DPI high-resolution output
        const canvas = await html2canvas(cardNode, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: null,
          scrollY: 0,
          scrollX: 0
        });

        // Add 24px safe margin around the card so borders and rounded corners are 100% visible and NEVER cropped
        const padding = 24;
        const paddedCanvas = document.createElement('canvas');
        paddedCanvas.width = canvas.width + (padding * 2);
        paddedCanvas.height = canvas.height + (padding * 2);
        const ctx = paddedCanvas.getContext('2d');

        // Fill solid white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);

        // Draw card canvas centered with padding
        ctx.drawImage(canvas, padding, padding);

        // Convert to PNG base64 string
        const dataUrl = paddedCanvas.toDataURL('image/png', 1.0);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

        // Naming convention: RollNo_StudentName.png
        const rawRoll = student.roll_no || student.roll || student.sr_no || student.admission_no || `SR-${student.id || i + 1}`;
        const cleanRoll = String(rawRoll).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanName = String(student.name || 'Student').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        const fileName = `${cleanRoll}_${cleanName}.png`;

        zip.file(fileName, base64Data, { base64: true });
      }

      // Generate ZIP archive and trigger download
      const zipContent = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `${classNameProp}_Student_Identity_Cards`.replace(/\s+/g, '_') + '.zip';

      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipContent);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Error generating identity cards ZIP:', err);
      alert('Failed to generate identity cards ZIP.');
    } finally {
      setDownloading(false);
    }
  };

  // Extract all active document stylesheets for isolated print iframe
  const getDocumentStylesHtml = () => {
    let stylesHtml = '';
    const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    styleNodes.forEach((node) => {
      stylesHtml += node.outerHTML + '\n';
    });
    return stylesHtml;
  };

  // Handle Printing via isolated iframe
  const handlePrint = (e) => {
    if (e) e.preventDefault();
    const printElement = printContainerRef.current;
    if (!printElement) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${classNameProp} - Identity Cards</title>
          ${getDocumentStylesHtml()}
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .id-card-page-container {
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: block !important;
              box-sizing: border-box !important;
              width: 100% !important;
            }
            .id-card-page-container:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .id-card-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 12px !important;
              width: 100% !important;
            }
            .id-card-wrapper {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              width: 340px !important;
              max-width: 340px !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .id-card-header-logo {
              height: 32px !important;
              max-height: 32px !important;
              max-width: 90px !important;
              width: auto !important;
              object-fit: contain !important;
            }
            .id-card-photo {
              width: 96px !important;
              height: 112px !important;
              object-fit: cover !important;
              border-radius: 12px !important;
            }
            .id-card-signature-img {
              height: 32px !important;
              max-height: 32px !important;
              max-width: 95px !important;
              width: auto !important;
              object-fit: contain !important;
            }
          </style>
        </head>
        <body>
          <div class="printable-id-cards">
            ${printElement.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() {
                  if (window.frameElement && window.frameElement.parentNode) {
                    window.frameElement.parentNode.removeChild(window.frameElement);
                  }
                }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Section / Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border p-5 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="font-bold text-xs gap-2 border-border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display">
              {classNameProp} — Identity Cards
            </h2>
            <p className="text-xs text-text-secondary font-medium mt-0.5">
              Academic Session: <strong className="text-text-primary">{academicYearName}</strong> | Total Students: <strong className="text-text-primary">{sortedStudents.length}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons: Download PDF | Upload Signature | Print */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <Button
            variant="outline"
            onClick={handleDownloadZip}
            disabled={downloading || sortedStudents.length === 0}
            className="font-bold text-xs gap-2 border-border hover:bg-zinc-50"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            {downloading ? 'Generating Cards...' : 'Download Identity Cards'}
          </Button>

          {/* Upload Signature button positioned directly next to Download PDF */}
          <label className="cursor-pointer inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3.5 py-2 shadow-2xs gap-1.5 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <PenTool className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>{uploadingSig ? 'Extracting...' : (activeSignature ? 'Change Signature' : 'Upload Signature')}</span>
            <input
              type="file"
              accept=".png, .jpg, .jpeg"
              onChange={handleSignatureUpload}
              className="hidden"
              disabled={uploadingSig}
            />
          </label>

          <Button
            onClick={handlePrint}
            disabled={sortedStudents.length === 0}
            className="font-bold text-xs gap-2 bg-primary text-white hover:bg-primary/95"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Guidance Note Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
        <PenTool className="h-4 w-4 text-amber-600 shrink-0" />
        <span>
          Please sign on a plain paper and upload. The paper background will be automatically removed, attaching only the extracted ink signature to all cards.
        </span>
      </div>

      {/* Main Preview Container */}
      {sortedStudents.length === 0 ? (
        <Card className="p-16 text-center text-text-muted text-xs shadow-xs border-dashed border-2">
          No active students found in {classNameProp} to generate Identity Cards.
        </Card>
      ) : (
        <div className="flex flex-col items-center space-y-8 w-full max-w-4xl mx-auto pb-12">
          {/* Printable 2-Column Element Wrapper */}
          <div
            ref={printContainerRef}
            id="printable-id-cards"
            className="flex flex-col gap-8 w-full"
          >
            {studentChunks.map((chunk, pageIdx) => (
              <div
                key={pageIdx}
                className="id-card-page-container w-full"
                style={{
                  pageBreakAfter: pageIdx < studentChunks.length - 1 ? 'always' : 'auto',
                  breakAfter: pageIdx < studentChunks.length - 1 ? 'page' : 'auto'
                }}
              >
                <div className="id-card-grid grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {chunk.map((s, idx) => {
                    const studentRoll = s.roll_no || s.roll || '-';
                    const studentAdmNo = s.sr_no || s.admission_no || `SR-${s.id}`;
                    const sec = s.section && String(s.section).trim() !== '' ? String(s.section).trim() : null;
                    const baseClassName = s.class_name || classNameProp;
                    const classSecDisplay = sec && !baseClassName.includes(' - ' + sec) && !baseClassName.includes(' (' + sec + ')')
                      ? `${baseClassName} (${sec})`
                      : baseClassName;

                    return (
                      <div
                        key={s.id || idx}
                        className="id-card-wrapper w-full max-w-[340px] mx-auto bg-white text-zinc-900 border-2 border-zinc-800 rounded-2xl overflow-hidden shadow-md relative transition-all hover:shadow-lg flex flex-col justify-between"
                        style={{
                          pageBreakInside: 'avoid',
                          breakInside: 'avoid'
                        }}
                      >
                  {/* Top Branding Bar */}
                  <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white px-3.5 py-3 flex items-center justify-between gap-3 border-b border-amber-400 min-h-[58px]">
                    {/* Left Container: Logo + School Name & Subtitle Column */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Logo Reuse logic: if logo exists & loads, show it cleanly over green header; else hide container completely */}
                      {!logoError && schoolLogo ? (
                        <img
                          src={schoolLogo}
                          alt="Logo"
                          onError={() => setLogoError(true)}
                          className="id-card-header-logo h-8 w-auto max-w-[90px] object-contain shrink-0 drop-shadow-xs"
                          style={{ maxHeight: '32px', maxWidth: '90px', width: 'auto', objectFit: 'contain' }}
                        />
                      ) : null}

                      {/* Text Column: School Name (line 1) + Subtitle (line 2) */}
                      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider font-display text-amber-300 leading-snug">
                          {schoolName}
                        </h4>
                        <p className="text-[8.5px] font-bold uppercase tracking-widest text-emerald-100 opacity-95 leading-tight">
                          Student Identity Card
                        </p>
                      </div>
                    </div>

                    {/* Right Container: Plain Yellow Bold Academic Year Text */}
                    <div className="shrink-0 flex items-center justify-end">
                      <span className="text-xs font-bold uppercase tracking-wider font-mono text-amber-300 leading-snug">
                        {academicYearName}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-3.5 bg-zinc-50/80 flex flex-col justify-between flex-1 gap-2">
                    <div className="flex items-start gap-3.5">
                      {/* Left: Student Photo */}
                      <div className="id-card-photo w-24 h-28 shrink-0 rounded-xl overflow-hidden border-2 border-zinc-300 bg-white shadow-2xs" style={{ width: '96px', height: '112px', flexShrink: 0 }}>
                        <IdCardAvatar src={s.photo_path} name={s.name} updatedAt={s.updated_at} />
                      </div>

                      {/* Right: Details Grid */}
                      <div className="flex-1 min-w-0 space-y-1.5 text-left">
                        {/* 1. Student Name */}
                        <div>
                          <span
                            className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider block"
                            style={{ lineHeight: '1.3' }}
                          >
                            Student Name
                          </span>
                          <h3
                            className="text-xs font-bold text-zinc-900 uppercase font-display leading-snug truncate"
                            style={{ lineHeight: '1.25' }}
                          >
                            {s.name || '—'}
                          </h3>
                        </div>

                        {/* 2. Father Name */}
                        <div className="pt-1 border-t border-zinc-200/80">
                          <span
                            className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider block"
                            style={{ lineHeight: '1.3' }}
                          >
                            Father Name
                          </span>
                          <span
                            className="text-xs font-bold text-zinc-900 uppercase font-display block truncate"
                            style={{ lineHeight: '1.25' }}
                          >
                            {s.father_name || s.fatherName || s.parent_name || '—'}
                          </span>
                        </div>

                        {/* 3. Class/Sec & 4. Mobile */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 border-t border-zinc-200/80">
                          <div>
                            <span
                              className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider block"
                              style={{ lineHeight: '1.3' }}
                            >
                              Class/Sec
                            </span>
                            <span
                              className="text-xs font-bold text-zinc-900 uppercase block truncate"
                              style={{ lineHeight: '1.25' }}
                            >
                              {classSecDisplay}
                            </span>
                          </div>
                          <div>
                            <span
                              className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider block"
                              style={{ lineHeight: '1.3' }}
                            >
                              Mobile
                            </span>
                            <span
                              className="text-[13.5px] font-bold text-zinc-900 font-mono block truncate"
                              style={{ lineHeight: '1.25' }}
                            >
                              {s.father_phone || s.parent_phone || s.student_mobile || s.guardian_phone || s.mobile || s.phone || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. Add (Address + City at bottom separately) */}
                    {(() => {
                      const rawAddr = (s.current_address_line || s.address || s.permanent_address_line || s.current_address || '').trim();
                      const rawCity = (s.current_city || s.city || s.permanent_city || '').trim();
                      let formattedAddress = '—';
                      if (rawAddr && rawCity) {
                        if (rawAddr.toLowerCase().endsWith(rawCity.toLowerCase())) {
                          formattedAddress = rawAddr;
                        } else {
                          formattedAddress = `${rawAddr}, ${rawCity}`;
                        }
                      } else if (rawAddr) {
                        formattedAddress = rawAddr;
                      } else if (rawCity) {
                        formattedAddress = rawCity;
                      }

                      return (
                        <div className="pt-1.5 border-t border-zinc-200/80 text-left">
                          <span
                            className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-wider block"
                            style={{ lineHeight: '1.3' }}
                          >
                            Address
                          </span>
                          <p
                            className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2 break-words"
                            style={{ lineHeight: '1.25' }}
                          >
                            {formattedAddress}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
