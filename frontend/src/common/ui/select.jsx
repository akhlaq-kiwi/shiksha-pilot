import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={twMerge(
        'flex h-9 w-full rounded-md border border-zinc-200 bg-surface px-3 py-1.5 text-sm text-text-primary shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer dark:border-zinc-800 dark:focus-visible:ring-zinc-300',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = 'Select';
