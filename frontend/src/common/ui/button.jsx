import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 active:scale-95 duration-100';
  
  const variants = {
    default: 'bg-primary text-zinc-50 hover:bg-primary/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 shadow-sm',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800/80',
    outline: 'border border-zinc-200 bg-transparent text-zinc-900 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
    ghost: 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
    destructive: 'bg-red-500 text-zinc-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-900/90 shadow-sm',
    accent: 'bg-teal-600 text-zinc-50 hover:bg-teal-600/90 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-500/90 shadow-sm',
  };

  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-9 w-9 p-0',
  };

  return (
    <button
      ref={ref}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      {...props}
    />
  );
});

Button.displayName = 'Button';
