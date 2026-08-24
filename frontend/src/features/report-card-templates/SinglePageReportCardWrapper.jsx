import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';

/**
 * SinglePageReportCardWrapper
 *
 * Guarantees that any student report card ALWAYS renders and prints on EXACTLY ONE PAGE (A4 Portrait).
 * Dynamically measures the unscaled content height and automatically applies uniform CSS scaling (`transform: scale(s)`)
 * whenever content exceeds the standard printable A4 height (~270mm / 1020px).
 *
 * The page box is always exactly TARGET_MAX_HEIGHT_PX tall. Templates size
 * themselves with `minHeight: 100%`, which only resolves against a parent with a
 * definite height — with `height: auto` it collapsed to zero, and the footer
 * (summary row + signatures, pinned with `mt-auto`) rode up under the marks
 * table instead of sitting at the bottom of the page.
 */
export default function SinglePageReportCardWrapper({ children, subjectsCount = 0 }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Target maximum height available on standard A4 portrait page with equal top and bottom print margins (~280mm = 1056px at 96dpi)
  const TARGET_MAX_HEIGHT_PX = 1056;

  const calculateScale = useCallback(() => {
    if (!contentRef.current) return;

    // Measure the template itself, not this wrapper: the wrapper is pinned to
    // the page height, so its own height can never report an overflow.
    const target = contentRef.current.firstElementChild || contentRef.current;
    const naturalHeight = target.scrollHeight || target.offsetHeight;
    if (!naturalHeight) return;

    let targetScale = 1;
    if (naturalHeight > TARGET_MAX_HEIGHT_PX) {
      const computedScale = TARGET_MAX_HEIGHT_PX / naturalHeight;
      // Cap scale between 0.55 and 1.0 to preserve legibility while keeping content on 1 page
      targetScale = Math.max(0.55, Math.min(1, Math.floor(computedScale * 1000) / 1000));
    }

    setScale(prev => (Math.abs(prev - targetScale) > 0.01 ? targetScale : prev));
  }, []);

  // `scale` is a dependency on purpose. Scaling widens the content box to
  // 100/scale%, which changes text wrapping and therefore the natural height,
  // so the first result is only an estimate. Re-running lets it settle on a
  // consistent value; the 0.01 threshold above stops the loop.
  useLayoutEffect(() => {
    calculateScale();
  }, [children, subjectsCount, scale, calculateScale]);

  useEffect(() => {
    // A single measurement at first paint is unreliable: web fonts and images
    // land afterwards and change the height. Without this a long report card
    // silently kept scale = 1 and printed with its signatures cut off the page.
    const observed = contentRef.current?.firstElementChild;
    let observer;
    if (observed && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => calculateScale());
      observer.observe(observed);
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(calculateScale).catch(() => {});
    }

    const handleResize = () => calculateScale();
    const handleBeforePrint = () => calculateScale();

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [calculateScale]);

  const isScaled = scale < 0.999;

  return (
    <div
      ref={containerRef}
      className="single-page-report-container id-card-report-wrapper relative bg-white overflow-hidden shadow-2xl rounded-2xl border border-zinc-300"
      style={{
        width: '194mm',
        height: `${TARGET_MAX_HEIGHT_PX}px`,
        maxHeight: '280mm',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        pageBreakAfter: 'always',
        breakAfter: 'page',
        margin: '0 auto',
      }}
    >
      {/* The content box is deliberately a block, not a flex column. As a flex
          parent with a definite height it made the template a shrinkable flex
          item, so an over-long card was squeezed until its marks table
          overflowed its own overflow-hidden container and silently lost rows.
          As a block the template simply grows past the page, which is the
          signal the scaler needs. */}
      <div
        ref={contentRef}
        className="single-page-report-content w-full h-full flex flex-col"
        style={{
          // Both dimensions are divided by the scale so that, once the transform
          // is applied, the template still covers the full printable page.
          width: isScaled ? `${(100 / scale).toFixed(3)}%` : '100%',
          height: isScaled ? `${(TARGET_MAX_HEIGHT_PX / scale).toFixed(1)}px` : '100%',
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
