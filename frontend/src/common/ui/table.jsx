import React, { createContext, useContext } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';

/**
 * Table.
 *
 * Additions over the previous version, all driven by the fact that ~50 admin
 * screens live in tables over hundreds of rows:
 *  - sticky header (`stickyHeader`) so column names survive scrolling
 *  - sortable headers with aria-sort
 *  - density control (comfortable | compact)
 *  - selection state + bulk-action bar
 *  - numeric alignment helper (right-aligned, tabular figures)
 *  - data reads at body-md weight 400 rather than xs/semibold; weight was doing
 *    the job that alignment and colour should do
 *
 * Hardcoded #EFEEEB / #F4F3F1 are gone — they broke dark mode and per-school
 * theming.
 */

const TableContext = createContext({ density: 'comfortable' });

export const Table = React.forwardRef(({
  className,
  containerClassName,
  density = 'comfortable',
  stickyHeader = false,
  maxHeight,
  caption,
  children,
  ...props
}, ref) => (
  <TableContext.Provider value={{ density }}>
    <div
      className={twMerge(
        'relative w-full overflow-auto rounded-xl border border-border bg-surface shadow-sm',
        stickyHeader && 'table-sticky-head',
        containerClassName
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table
        ref={ref}
        className={twMerge('w-full caption-bottom text-body-md', className)}
        {...props}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  </TableContext.Provider>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={twMerge('bg-surface-sunken border-b border-border', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={twMerge('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={twMerge('bg-surface-sunken font-semibold text-text-primary border-t border-border', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef(({ className, selected, ...props }, ref) => (
  <tr
    ref={ref}
    data-state={selected ? 'selected' : undefined}
    className={twMerge(
      'border-b border-border/50 transition-colors hover:bg-secondary/50',
      selected && 'bg-primary-subtle hover:bg-primary-subtle',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef(({ className, numeric, ...props }, ref) => {
  const { density } = useContext(TableContext);
  return (
    <th
      ref={ref}
      scope="col"
      className={twMerge(
        'text-left align-middle text-label text-text-secondary bg-surface-sunken',
        density === 'compact' ? 'h-8 px-3' : 'h-10 px-4',
        numeric && 'text-right',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});
TableHead.displayName = 'TableHead';

/**
 * Sortable column header.
 *
 *   <SortableTableHead sortKey="name" sort={sort} onSort={setSort}>Name</SortableTableHead>
 *
 * where `sort` is { key, direction: 'asc' | 'desc' }.
 */
export const SortableTableHead = ({ sortKey, sort, onSort, children, numeric, className, ...props }) => {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;

  const handleClick = () => {
    if (!onSort) return;
    onSort(
      active && sort.direction === 'asc'
        ? { key: sortKey, direction: 'desc' }
        : { key: sortKey, direction: 'asc' }
    );
  };

  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead
      numeric={numeric}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={twMerge('p-0', className)}
      {...props}
    >
      <button
        type="button"
        onClick={handleClick}
        className={twMerge(
          'flex w-full items-center gap-1.5 px-4 py-2 text-label transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50',
          numeric && 'justify-end',
          active ? 'text-text-primary' : 'text-text-secondary'
        )}
      >
        {children}
        <Icon className={clsx('h-3.5 w-3.5 flex-shrink-0', !active && 'opacity-40')} aria-hidden="true" />
      </button>
    </TableHead>
  );
};

export const TableCell = React.forwardRef(({ className, numeric, ...props }, ref) => {
  const { density } = useContext(TableContext);
  return (
    <td
      ref={ref}
      className={twMerge(
        'align-middle text-body-md text-text-secondary',
        density === 'compact' ? 'px-3 py-2' : 'px-4 py-3',
        // Money and counts must be right-aligned with tabular figures.
        numeric && 'text-right tabular-nums',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});
TableCell.displayName = 'TableCell';

/** Comfortable/compact toggle — admins scanning ledgers want compact. */
export const TableDensityToggle = ({ density, onChange, className }) => (
  <div
    className={twMerge('inline-flex items-center rounded-lg border border-border bg-surface p-0.5', className)}
    role="group"
    aria-label="Row density"
  >
    {['comfortable', 'compact'].map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(d)}
        aria-pressed={density === d}
        className={twMerge(
          'rounded-md px-2.5 py-1 text-body-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          density === d ? 'bg-primary text-primary-fg' : 'text-text-secondary hover:text-text-primary'
        )}
      >
        {d}
      </button>
    ))}
  </div>
);

/**
 * Bulk-action bar shown when rows are selected. Bulk fee reminders, bulk
 * report cards and bulk promotion are all high-frequency admin jobs that were
 * previously one row at a time.
 */
export const TableBulkActions = ({ count, onClear, children, className }) => {
  if (!count) return null;
  return (
    <div
      role="region"
      aria-label={`${count} rows selected`}
      className={twMerge(
        'flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-subtle px-4 py-2.5',
        className
      )}
    >
      <span className="text-body-md font-semibold text-text-primary">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-body-sm font-medium text-text-secondary underline underline-offset-2 hover:text-text-primary"
      >
        Clear selection
      </button>
    </div>
  );
};
