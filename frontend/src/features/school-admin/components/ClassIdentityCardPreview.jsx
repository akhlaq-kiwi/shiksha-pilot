import React, { useState, useRef } from 'react';
import { ArrowLeft, Download, Printer, User } from 'lucide-react';
import { Button } from '../../../common/ui/button';
import { Card } from '../../../common/ui/card';
import html2pdf from 'html2pdf.js';

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
  const printContainerRef = useRef(null);

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

        {/* Action Buttons: Download PDF | Print */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={downloading || sortedStudents.length === 0}
            className="font-bold text-xs gap-2 border-border hover:bg-zinc-50"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </Button>

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
                    let sec = s.section && String(s.section).trim() !== '' ? String(s.section).trim() : null;
                    let rawClassName = (s.class_name || classNameProp || '').trim();

                    if (rawClassName.includes(' (')) {
                      const parts = rawClassName.split(' (');
                      rawClassName = parts[0].trim();
                      if (!sec) {
                        sec = parts[1].replace(')', '').trim();
                      }
                    } else if (rawClassName.includes(' - ')) {
                      const parts = rawClassName.split(' - ');
                      rawClassName = parts[0].trim();
                      if (!sec) {
                        sec = parts[1].trim();
                      }
                    }

                    const classSecDisplay = sec ? `${rawClassName}/${sec}` : rawClassName;

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
                  <div className="p-3.5 bg-[#f8f9fa] flex flex-col justify-between flex-1 gap-2" style={{ overflow: 'visible' }}>
                    <div className="flex items-start gap-3.5" style={{ overflow: 'visible' }}>
                      {/* Left: Student Photo */}
                      <div className="id-card-photo w-24 h-28 shrink-0 rounded-xl overflow-hidden border-2 border-[#d4d4d8] bg-white shadow-2xs" style={{ width: '96px', height: '112px', flexShrink: 0 }}>
                        <IdCardAvatar src={s.photo_path} name={s.name} updatedAt={s.updated_at} />
                      </div>

                      {/* Right: Details Grid */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between text-left gap-1" style={{ overflow: 'visible' }}>
                        {/* 1. Student Name */}
                        <div className="border-b border-[#e4e4e7] pb-1 flex flex-col" style={{ overflow: 'visible' }}>
                          <span className="text-[7.5px] font-bold text-zinc-500 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', margin: 0, padding: 0 }}>
                            Student Name
                          </span>
                          <span className="text-xs font-bold text-zinc-950 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
                            {s.name || '—'}
                          </span>
                        </div>

                        {/* 2. Father Name */}
                        <div className="border-b border-[#e4e4e7] pb-1 flex flex-col" style={{ overflow: 'visible' }}>
                          <span className="text-[7.5px] font-bold text-zinc-500 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', margin: 0, padding: 0 }}>
                            Father Name
                          </span>
                          <span className="text-xs font-bold text-zinc-950 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
                            {s.father_name || s.fatherName || s.parent_name || '—'}
                          </span>
                        </div>

                        {/* 3. Class/Sec & 4. Mobile */}
                        <div className="flex items-start justify-between gap-2" style={{ overflow: 'visible' }}>
                          <div className="min-w-0 flex-1 flex flex-col" style={{ overflow: 'visible' }}>
                            <span className="text-[7.5px] font-bold text-zinc-500 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', margin: 0, padding: 0 }}>
                              Class/Sec
                            </span>
                            <span className="text-xs font-bold text-zinc-950 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
                              {classSecDisplay}
                            </span>
                          </div>
                          <div className="shrink-0 text-left flex flex-col" style={{ overflow: 'visible' }}>
                            <span className="text-[7.5px] font-bold text-zinc-500 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', margin: 0, padding: 0 }}>
                              Mobile
                            </span>
                            <span className="text-[12.5px] font-bold text-zinc-950 font-mono block" style={{ lineHeight: '1.4', overflow: 'visible', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
                              {s.father_phone || s.parent_phone || s.student_mobile || s.guardian_phone || s.mobile || s.phone || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 5. Address (Only Address shown, city is excluded) */}
                    {(() => {
                      const rawAddr = (s.current_address_line || s.address || s.permanent_address_line || s.current_address || '').trim();
                      const formattedAddress = rawAddr || '—';

                      return (
                        <div className="pt-1.5 border-t border-[#e4e4e7] text-left flex flex-col" style={{ overflow: 'visible' }}>
                          <span className="text-[7.5px] font-bold text-zinc-500 uppercase block" style={{ lineHeight: '1.4', overflow: 'visible', margin: 0, padding: 0 }}>
                            Address
                          </span>
                          <p className="text-xs font-bold text-zinc-950 line-clamp-2 break-words" style={{ lineHeight: '1.4', overflow: 'visible', margin: 0, padding: 0 }}>
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
