import React from 'react';

const STATUS_COLORS = {
  ACTIVE:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  Active:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  Success:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',

  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Inactive:  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Failed:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',

  PENDING:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Partial:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',

  ON_LEAVE:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const DEFAULT_COLOR = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';

const StatusBadge = ({ status }) => {
  const colorClass = STATUS_COLORS[status] ?? DEFAULT_COLOR;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${colorClass}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
