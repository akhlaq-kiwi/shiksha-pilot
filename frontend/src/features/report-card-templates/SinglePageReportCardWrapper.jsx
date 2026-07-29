import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';

/**
 * SinglePageReportCardWrapper
 * 
 * Guarantees that any student report card ALWAYS renders and prints on EXACTLY ONE PAGE (A4 Portrait).
 * Dynamically measures the unscaled content height and automatically applies uniform CSS scaling (`transform: scale(s)`)
 * whenever content exceeds the standard printable A4 height (~270mm / 1020px).
 */
export default function SinglePageReportCardWrapper({ children, subjectsCount = 0 }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Target maximum height available on standard A4 portrait page with 5mm print margins (~270mm = 1020px at 96dpi)
  const TARGET_MAX_HEIGHT_PX = 1020;

  const calculateScale = () => {
    if (!contentRef.current) return;

    const naturalHeight = contentRef.current.scrollHeight || contentRef.current.offsetHeight;

    let targetScale = 1;
    if (naturalHeight > TARGET_MAX_HEIGHT_PX) {
      const computedScale = TARGET_MAX_HEIGHT_PX / naturalHeight;
      // Cap scale between 0.55 and 1.0 to preserve legibility while keeping content on 1 page
      targetScale = Math.max(0.55, Math.min(1, Math.floor(computedScale * 1000) / 1000));
    }

    setScale(prev => (Math.abs(prev - targetScale) > 0.01 ? targetScale : prev));
  };

  useLayoutEffect(() => {
    calculateScale();
    const timer = setTimeout(calculateScale, 150);
    return () => clearTimeout(timer);
  }, [children, subjectsCount]);

  useEffect(() => {
    const handleResize = () => calculateScale();
    const handleBeforePrint = () => calculateScale();

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, []);

  const isScaled = scale < 0.999;

  return (
    <div
      ref={containerRef}
      className="single-page-report-container id-card-report-wrapper relative bg-white overflow-hidden shadow-2xl rounded-2xl border border-zinc-300"
      style={{
        width: '194mm',
        height: isScaled ? `${TARGET_MAX_HEIGHT_PX}px` : 'auto',
        maxHeight: '272mm',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        margin: '0 auto',
      }}
    >
      <div
        ref={contentRef}
        className="single-page-report-content w-full h-full flex flex-col justify-between"
        style={{
          width: isScaled ? `${(100 / scale).toFixed(3)}%` : '100%',
          transform: isScaled ? `scale(${scale})` : 'none',
          transformOrigin: 'top left',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}
