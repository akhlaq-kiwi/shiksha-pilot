import React from 'react';
import { twMerge } from 'tailwind-merge';
import { CheckCircle2, XCircle, Clock, AlertTriangle, MinusCircle, Circle } from 'lucide-react';

/**
 * StatusBadge.
 *
 * Three changes:
 *  1. Colours come from semantic tokens rather than raw Tailwind palette
 *     classes, so badges follow dark mode and per-school theming.
 *  2. Each tone carries an ICON as well as a colour. Status was previously
 *     encoded by hue alone, which is invisible to colour-blind users (~8% of
 *     men — a large share of the parents reading a fee status).
 *  3. Labels are normalised: 'ACTIVE', 'Active' and 'active' now render
 *     identically instead of the unlisted casings falling through to grey.
 */

const TONES = {
  success: { icon: CheckCircle2,  cls: 'bg-success-50 text-success-700 border-success-200' },
  danger:  { icon: XCircle,       cls: 'bg-danger-50 text-danger-700 border-danger-200' },
  warning: { icon: Clock,         cls: 'bg-warning-50 text-warning-700 border-warning-200' },
  info:    { icon: AlertTriangle, cls: 'bg-info-50 text-info-700 border-info-200' },
  neutral: { icon: MinusCircle,   cls: 'bg-secondary text-text-secondary border-border' },
};

/** status (case-insensitive) → tone */
const STATUS_TONES = {
  active: 'success',
  success: 'success',
  paid: 'success',
  approved: 'success',
  present: 'success',
  completed: 'success',
  graded: 'success',
  verified: 'success',

  suspended: 'danger',
  inactive: 'danger',
  failed: 'danger',
  rejected: 'danger',
  absent: 'danger',
  overdue: 'danger',
  critical: 'danger',
  default: 'danger',

  pending: 'warning',
  partial: 'warning',
  on_leave: 'warning',
  'on leave': 'warning',
  late: 'warning',
  processing: 'warning',
  upcoming: 'warning',

  draft: 'neutral',
  archived: 'neutral',
  cancelled: 'neutral',
  break: 'neutral',

  excused: 'info',
  submitted: 'info',
  scheduled: 'info',
};

/** ACTIVE / on_leave → "Active" / "On leave" */
const humanise = (status) =>
  String(status)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

export const StatusBadge = ({ status, tone: toneOverride, showIcon = true, className }) => {
  if (status == null || status === '' || status === '—') {
    return <span className="text-text-muted">—</span>;
  }

  const key = String(status).trim().toLowerCase();
  const tone = TONES[toneOverride] ?? TONES[STATUS_TONES[key]] ?? TONES.neutral;
  const Icon = tone.icon ?? Circle;

  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-body-sm font-semibold whitespace-nowrap',
        tone.cls,
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
      {humanise(status)}
    </span>
  );
};

export default StatusBadge;
