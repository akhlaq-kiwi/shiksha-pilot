import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg text-xs font-semibold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] duration-150 ease-in-out';
  
  const variants = {
    default: 'bg-primary text-white hover:bg-primary/90 dark:bg-primary dark:text-background dark:hover:bg-primary/90 shadow-xs hover:-translate-y-[1px]',
    secondary: 'bg-surface text-text-primary border border-border hover:bg-secondary/80 dark:bg-surface dark:text-text-primary dark:hover:bg-secondary/90 shadow-2xs',
    outline: 'border border-border bg-surface text-text-primary hover:bg-secondary hover:text-text-primary',
    ghost: 'text-text-secondary hover:bg-secondary hover:text-text-primary',
    destructive: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:text-white dark:hover:bg-red-800 shadow-xs hover:-translate-y-[1px]',
    accent: 'bg-primary text-white hover:bg-primary/90 shadow-xs hover:-translate-y-[1px]',
  };

  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-[10px]',
    lg: 'h-10 rounded-xl px-8',
    icon: 'h-9 w-9 p-0 rounded-lg',
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

