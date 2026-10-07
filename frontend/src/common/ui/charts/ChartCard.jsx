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
  headerClassName,
}) => {
  if (loading) return <SkeletonChart className={className} />;

  return (
    <section
      className={twMerge('rounded-2xl border border-border bg-surface overflow-hidden shadow-sm', className)}
      aria-busy={loading || undefined}
    >
      <div className={twMerge('px-6 py-2.5 min-h-[56px] border-b border-border !bg-zinc-100/80 dark:!bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3', headerClassName)}>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-display-xs font-display text-text-primary">
            {Icon && <Icon className={twMerge('h-5 w-5 flex-shrink-0', iconTone)} aria-hidden="true" />}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-text-muted">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      <div className="p-6">
        {error ? (
          <EmptyState variant="error" message={error} onRetry={onRetry} compact />
        ) : isEmpty ? (
          <EmptyState variant="empty" title="Nothing to chart yet" message={emptyMessage} compact />
        ) : (
          children
        )}
      </div>
    </section>
  );
};

export default ChartCard;
