import React from 'react';
import { twMerge } from 'tailwind-merge';
import { SkeletonChart } from '../skeleton';
import { EmptyState } from '../../components/EmptyState';

/**
 * ChartCard — consistent chrome for every chart: title, subtitle, optional
 * period control, and the three states a chart actually has (loading, empty,
 * error). Previously each dashboard chart re-implemented its own header and
 * showed nothing at all while loading.
 */
export const ChartCard = ({
  title,
  subtitle,
  icon: Icon,
  iconTone = 'text-primary',
  action,
  loading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyMessage = 'No data for this period yet.',
  children,
  className,
}) => {
  if (loading) return <SkeletonChart className={className} />;

  return (
    <section
      className={twMerge('rounded-2xl border border-border bg-surface p-6 shadow-sm', className)}
      aria-busy={loading || undefined}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-display-xs font-display text-text-primary">
            {Icon && <Icon className={twMerge('h-5 w-5 flex-shrink-0', iconTone)} aria-hidden="true" />}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {error ? (
        <EmptyState variant="error" message={error} onRetry={onRetry} compact />
      ) : isEmpty ? (
        <EmptyState variant="empty" title="Nothing to chart yet" message={emptyMessage} compact />
      ) : (
        children
      )}
    </section>
  );
};

export default ChartCard;
