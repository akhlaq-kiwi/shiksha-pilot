import React, { useState, useId } from 'react';
import { twMerge } from 'tailwind-merge';

/**
 * LineChart — extracted from a 100+ line inline widget inside the school-admin
 * dashboard so every module can chart consistently instead of re-inventing SVG.
 *
 * Colours come from --chart-* tokens, so series follow dark mode and per-school
 * themes. The old inline version hardcoded #10b981 / #6366f1 and painted data
 * points #ffffff, which vanished against dark surfaces.
 *
 * Props:
 *   data      = [{ label, value }]  (also accepts { month, amount } for
 *                                    compatibility with existing callers)
 *   series    = 1..8 → --chart-N
 *   formatValue = (n) => string, used in the tooltip and the a11y summary
 */
export const LineChart = ({
  data = [],
  series = 1,
  formatValue = (v) => String(v),
  height = 200,
  onPointClick,
  className,
  ariaLabel = 'Line chart',
}) => {
  const [hovered, setHovered] = useState(null);
  const gradientId = `line-gradient-${useId().replace(/:/g, '')}`;

  // Normalise both shapes so existing callers keep working.
  const points = data.map((d, i) => ({
    label: d.label ?? d.month ?? String(i + 1),
    value: Number(d.value ?? d.amount ?? 0),
    raw: d,
    i,
  }));

  const stroke = `var(--chart-${series})`;
  const width = 1000;
  const topY = 24;
  const bottomY = height - 45;
  const paddingX = 40;
  const usableH = bottomY - topY;
  const usableW = width - paddingX * 2;
  const maxVal = Math.max(...points.map((p) => p.value), 1);

  const coords = points.map((p) => ({
    ...p,
    x: paddingX + (p.i / Math.max(points.length - 1, 1)) * usableW,
    y: bottomY - (p.value / maxVal) * usableH,
  }));

  // Smooth bezier through the points.
  let linePath = '';
  let areaPath = '';
  if (coords.length > 1) {
    linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const midX = a.x + (b.x - a.x) / 2;
      linePath += ` C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
    }
    areaPath = `${linePath} L ${coords[coords.length - 1].x} ${bottomY} L ${coords[0].x} ${bottomY} Z`;
  } else if (coords.length === 1) {
    linePath = `M ${coords[0].x} ${coords[0].y} L ${coords[0].x} ${coords[0].y}`;
  }

  if (points.length === 0) {
    return (
      <p className={twMerge('py-10 text-center text-body-md text-text-muted', className)}>
        No data for this period yet.
      </p>
    );
  }

  return (
    <div className={twMerge('w-full overflow-hidden', className)}>
      <div className="relative w-full" style={{ height }}>
        {/* Value never conveyed by the drawing alone. */}
        <table className="sr-only">
          <caption>{ariaLabel}</caption>
          <tbody>
            {coords.map((p) => (
              <tr key={p.i}>
                <th scope="row">{p.label}</th>
                <td>{formatValue(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="presentation"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={paddingX}
              x2={width - paddingX}
              y1={topY + t * usableH}
              y2={topY + t * usableH}
              stroke="var(--border-color)"
              strokeWidth="1"
              strokeDasharray={t === 1 ? undefined : '4 4'}
              opacity={t === 1 ? 0.8 : 0.4}
            />
          ))}

          {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={stroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {coords.map((p) => (
            <circle
              key={p.i}
              cx={p.x}
              cy={p.y}
              r={hovered === p.i ? 7 : 5}
              // Token, not #ffffff — the old value disappeared in dark mode.
              fill="var(--bg-surface)"
              stroke={stroke}
              strokeWidth="3"
              className="transition-all duration-150"
            />
          ))}
        </svg>

        {/* Hover targets, tooltips and x-axis labels */}
        <div className="absolute inset-0">
          {coords.map((p) => {
            const isHovered = hovered === p.i;
            return (
              <div
                key={p.i}
                className={twMerge(
                  'absolute bottom-0 top-0 flex flex-col items-center',
                  onPointClick && 'cursor-pointer'
                )}
                style={{ left: `${(p.x / width) * 100}%`, transform: 'translateX(-50%)', width: 56 }}
                onMouseEnter={() => setHovered(p.i)}
                onMouseLeave={() => setHovered(null)}
                onClick={onPointClick ? () => onPointClick(p.raw) : undefined}
              >
                <div
                  className={twMerge(
                    'pointer-events-none absolute z-20 transition-opacity duration-150',
                    isHovered ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ top: `calc(${(p.y / height) * 100}% - 34px)` }}
                >
                  <span className="whitespace-nowrap rounded-lg bg-text-primary px-2 py-1 text-[11px] font-semibold text-surface shadow-lg">
                    {formatValue(p.value)}
                  </span>
                </div>

                <span
                  className={twMerge(
                    'absolute bottom-0 text-[11px] font-medium transition-colors',
                    isHovered ? 'text-text-primary' : 'text-text-muted'
                  )}
                >
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LineChart;
