import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

/**
 * Button.
 *
 * Changes from the previous version:
 * - Sentence case, not uppercase. Uppercase costs ~15% reading speed and
 *   destroys word-shape recognition, which matters for transliterated names.
 * - Visible focus ring. `ring-primary/20` was effectively invisible.
 * - `loading` state, because the app is save-heavy and double-submits on slow
 *   school networks can create duplicate fee and attendance records.
 * - `touch` size at 44px for mobile-facing (parent/student) surfaces; the 36px
 *   default is fine for desktop admin work but too small on a phone.
 * - Dropped the `accent` variant, which was byte-identical to `default` and
 *   only invited inconsistency. Aliased so existing call sites keep working.
 */
export const Button = React.forwardRef(({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}, ref) => {
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-lg text-body-md font-semibold ' +
    'transition-all duration-150 ease-in-out ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

  const variants = {
    default: 'bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-active shadow-sm',
    accent: 'bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-active shadow-sm',
    secondary: 'bg-surface text-text-primary border border-border-strong hover:bg-secondary',
    outline: 'border border-border-strong bg-transparent text-text-primary hover:bg-secondary',
    ghost: 'text-text-secondary hover:bg-secondary hover:text-text-primary',
    link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
    destructive: 'bg-danger-600 text-white hover:bg-danger-700 shadow-sm focus-visible:ring-danger-500/50',
    'destructive-outline':
      'border border-danger-500 text-danger-700 bg-transparent hover:bg-danger-50 focus-visible:ring-danger-500/50',
  };

  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-body-sm',
    lg: 'h-11 rounded-xl px-8 text-body-lg',
    /** 44px — the minimum comfortable touch target. Use on parent/student views. */
    touch: 'min-h-touch px-5 text-body-md rounded-xl',
    icon: 'h-9 w-9 p-0 rounded-lg',
    'icon-touch': 'min-h-touch min-w-touch p-0 rounded-xl',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});

Button.displayName = 'Button';

/** Groups related actions so `gap-2` isn't respecified at every call site. */
export const ButtonGroup = ({ className, children, ...props }) => (
  <div className={twMerge('flex flex-wrap items-center gap-2', className)} {...props}>
    {children}
  </div>
);
