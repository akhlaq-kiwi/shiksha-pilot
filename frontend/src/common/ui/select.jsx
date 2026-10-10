import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Select = React.forwardRef(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={twMerge(
        'flex h-9 w-full cursor-pointer rounded-full border border-border-strong bg-surface px-4 py-1.5 text-body-md text-text-primary shadow-sm transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-border-strong focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = 'Select';

