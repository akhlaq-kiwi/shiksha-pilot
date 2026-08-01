import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Inbox, SearchX, AlertTriangle, RotateCcw } from 'lucide-react';
import { TableRow, TableCell } from '../ui/table';
import { Button } from '../ui/button';

/**
 * EmptyState.
 *
 * The previous version rendered only "No records found." inside a table cell —
 * a dead end that gave the user nothing to do and, worse, looked identical in
 * three very different situations. They are now distinguished:
 *
 *   variant="empty"  — nothing created yet    → offer the creating action
 *   variant="filter" — a filter excluded all  → offer "Clear filters"
 *   variant="error"  — the request failed     → offer "Try again"
 *
 * (Its import path was also broken — `../../ui/table` resolves outside src/ —
 * so the component would have thrown the moment anything imported it.)
 */

const VARIANTS = {
  empty: {
    icon: Inbox,
    tone: 'text-text-muted',
    ring: 'bg-secondary',
    defaultTitle: 'Nothing here yet',
  },
  filter: {
    icon: SearchX,
    tone: 'text-info-700',
    ring: 'bg-info-50',
    defaultTitle: 'No matches',
  },
  error: {
    icon: AlertTriangle,
    tone: 'text-danger-700',
    ring: 'bg-danger-50',
    defaultTitle: "Couldn't load this",
  },
};

export const EmptyState = ({
  variant = 'empty',
  icon,
  title,
  message,
  action,           // { label, onClick, icon }
  secondaryAction,  // { label, onClick }
  onRetry,
  onClearFilters,
  className,
  compact = false,
}) => {
  const cfg = VARIANTS[variant] ?? VARIANTS.empty;
  const Icon = icon ?? cfg.icon;

  // Convenience: the two most common actions can be passed as bare callbacks.
  const resolvedAction =
    action ??
    (variant === 'error' && onRetry
      ? { label: 'Try again', onClick: onRetry, icon: RotateCcw }
      : variant === 'filter' && onClearFilters
      ? { label: 'Clear filters', onClick: onClearFilters }
      : null);

  const ActionIcon = resolvedAction?.icon;

  return (
    <div
      className={twMerge(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-14 px-6',
        className
      )}
    >
      <div className={twMerge('flex h-11 w-11 items-center justify-center rounded-full', cfg.ring)}>
        <Icon className={twMerge('h-5 w-5', cfg.tone)} aria-hidden="true" />
      </div>

      <p className="mt-3 text-display-xs text-text-primary">{title ?? cfg.defaultTitle}</p>

      {message && (
        <p className="mt-1.5 max-w-sm text-body-md text-text-muted leading-relaxed">{message}</p>
      )}

      {(resolvedAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {resolvedAction && (
            <Button size="sm" onClick={resolvedAction.onClick}>
              {ActionIcon && <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              {resolvedAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/** Table-scoped wrapper: spans every column so the state is centred. */
export const TableEmptyState = ({ colSpan = 6, ...props }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell colSpan={colSpan} className="p-0">
      <EmptyState {...props} />
    </TableCell>
  </TableRow>
);

/**
 * Backwards-compatible default export: existing call sites pass
 * `{ message, colSpan }` and expect a table row.
 */
const EmptyStateCompat = ({ message, colSpan, ...rest }) => (
  <TableEmptyState colSpan={colSpan ?? 6} message={message} {...rest} />
);

export default EmptyStateCompat;
