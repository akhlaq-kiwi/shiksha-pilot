import React from 'react';
import { twMerge } from 'tailwind-merge';
import { TableRow, TableCell } from './table';

/**
 * Skeletons.
 *
 * A `.skeleton-loader` shimmer already existed in index.css but was referenced
 * in a single file, so most screens showed either a spinner or nothing. A
 * skeleton shaped like the content it replaces feels faster than a spinner at
 * identical latency, and prevents layout shift on arrival.
 *
 * All of these are aria-hidden and are meant to sit inside a container marked
 * `aria-busy="true"`.
 */

export const Skeleton = ({ className, ...props }) => (
  <div
    aria-hidden="true"
    className={twMerge('skeleton-loader rounded-md', className)}
    {...props}
  />
);

export const SkeletonText = ({ lines = 3, className }) => (
  <div className={twMerge('space-y-2', className)} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="h-3.5"
        // Last line short, like real prose.
        style={{ width: i === lines - 1 ? '60%' : '100%' }}
      />
    ))}
  </div>
);

/** Matches the shape of <StatCard>. */
export const SkeletonStatCard = ({ className }) => (
  <div
    className={twMerge('rounded-xl border border-border bg-surface p-5', className)}
    aria-hidden="true"
  >
    <div className="flex items-start gap-4">
      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-2.5 w-24" />
      </div>
    </div>
  </div>
);

export const SkeletonStatGrid = ({ count = 4, className }) => (
  <div className={twMerge('grid grid-cols-2 lg:grid-cols-4 gap-5', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonStatCard key={i} />
    ))}
  </div>
);

/** One skeleton table row with `columns` cells. */
export const SkeletonTableRow = ({ columns = 5, widths }) => (
  <TableRow className="hover:bg-transparent">
    {Array.from({ length: columns }).map((_, i) => (
      <TableCell key={i}>
        <Skeleton className="h-3.5" style={{ width: widths?.[i] ?? '80%' }} />
      </TableCell>
    ))}
  </TableRow>
);

export const SkeletonTableBody = ({ rows = 6, columns = 5, widths }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonTableRow key={i} columns={columns} widths={widths} />
    ))}
  </>
);

/** Matches the shape of a chart card. */
export const SkeletonChart = ({ className }) => (
  <div
    className={twMerge('rounded-2xl border border-border bg-surface p-6', className)}
    aria-hidden="true"
  >
    <Skeleton className="h-4 w-40" />
    <Skeleton className="mt-2 h-2.5 w-56" />
    <div className="mt-6 flex h-40 items-end gap-3">
      {[45, 70, 35, 85, 55, 95, 40, 75, 60, 50, 80, 65].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

/** List/roll skeleton — attendance rolls, student lists. */
export const SkeletonList = ({ rows = 6, className }) => (
  <div className={twMerge('divide-y divide-border/50', className)} aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-6 py-3">
        <Skeleton className="h-3.5 w-6" />
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="h-3.5 flex-1" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    ))}
  </div>
);

export default Skeleton;
