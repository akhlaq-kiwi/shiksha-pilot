import React from 'react';
import { twMerge } from 'tailwind-merge';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

/**
 * StatCard.
 *
 * "1,240 students" is trivia; "1,240 students · +38 this term" is information.
 * This version adds the three things the old card lacked:
 *
 *  - `delta` + `deltaLabel`: change and the period it covers, so a number has
 *    context instead of floating free
 *  - `sparkline`: an inline trend from an array of numbers
 *  - `onClick`: every stat should be a doorway to its filtered list view;
 *    previously users had to find the matching screen by hand
 *
 * `invertDelta` exists because "up" is not always good — rising outstanding
 * fees or rising absences should read as negative.
 *
 * (Its import path was also broken — `../../ui/card` resolves outside src/.)
 */
export const StatCard = ({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delta,            // number, e.g. 38 or -4.2
  deltaLabel,       // e.g. "this term"
  deltaSuffix = '', // e.g. "%"
  invertDelta = false,
  sparkline,        // number[]
  onClick,
  className,
}) => {
  const iconColor = color ?? 'bg-primary-subtle text-primary';

  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const isUp = hasDelta && delta > 0;
  const isFlat = hasDelta && delta === 0;
  // "Good" depends on the metric, not the direction.
  const isGood = invertDelta ? !isUp : isUp;

  const DeltaIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const deltaTone = isFlat
    ? 'text-text-muted'
    : isGood
    ? 'text-success-700'
    : 'text-danger-700';

  const interactive = typeof onClick === 'function';
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Card className={twMerge(interactive && 'hover:border-primary/40', className)}>
      <Wrapper
        {...(interactive
          ? { type: 'button', onClick, 'aria-label': `${label}: ${value}. View details.` }
          : {})}
        className={twMerge(
          'block w-full text-left',
          interactive &&
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl'
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {Icon && (
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${iconColor}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-overline text-text-muted">{label}</span>

              <span className="text-display-md text-text-primary font-display leading-tight tabular-nums">
                {value}
              </span>

              {hasDelta && (
                <span className={`flex items-center gap-1 text-body-sm font-semibold ${deltaTone}`}>
                  <DeltaIcon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {delta > 0 ? '+' : ''}
                  {delta.toLocaleString()}
                  {deltaSuffix}
                  {deltaLabel && (
                    <span className="font-normal text-text-muted">{deltaLabel}</span>
                  )}
                </span>
              )}

              {sub && <span className="text-body-sm text-text-muted leading-snug">{sub}</span>}
            </div>

            {interactive && (
              <ArrowRight
                className="h-4 w-4 flex-shrink-0 text-text-muted"
                aria-hidden="true"
              />
            )}
          </div>

          {sparkline?.length > 1 && <Sparkline values={sparkline} good={isGood} />}
        </CardContent>
      </Wrapper>
    </Card>
  );
};

/** Minimal inline trend. Decorative — the numbers above carry the meaning. */
const Sparkline = ({ values, good }) => {
  const w = 100;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-3 h-6 w-full"
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke={good ? 'var(--success-500)' : 'var(--danger-500)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default StatCard;
