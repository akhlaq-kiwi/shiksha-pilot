import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card = ({ className, ...props }) => (
  <div
    className={twMerge(
      'glass-card rounded-lg border border-border text-text-primary shadow-xs transition-all duration-300',
      className
    )}
    {...props}
  />
);

export const CardHeader = ({ className, ...props }) => (
  <div
    className={twMerge('flex flex-col space-y-1.5 p-6 border-b border-border/20', className)}
    {...props}
  />
);

export const CardTitle = ({ className, ...props }) => (
  <h3
    className={twMerge(
      'text-lg font-bold leading-none tracking-tight text-text-primary font-display',
      className
    )}
    {...props}
  />
);

export const CardDescription = ({ className, ...props }) => (
  <p
    className={twMerge('text-sm text-text-muted', className)}
    {...props}
  />
);

export const CardContent = ({ className, ...props }) => (
  <div className={twMerge('p-6 pt-4', className)} {...props} />
);

export const CardFooter = ({ className, ...props }) => (
  <div
    className={twMerge('flex items-center p-6 pt-0 border-t border-border/20 mt-4', className)}
    {...props}
  />
);
