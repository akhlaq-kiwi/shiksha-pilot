import React, { useEffect, useRef, useId, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog.
 *
 * Adds the modal behaviour that was missing:
 *  - role="dialog" / aria-modal with title and description linked
 *  - focus moves into the dialog on open and RETURNS to the trigger on close
 *  - Tab is trapped inside the dialog, so keyboard users can't wander into the
 *    inert page behind it
 *  - the backdrop is hidden from screen readers
 *
 * Escape-to-close and scroll lock were already correct and are preserved.
 */
export const Dialog = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className = '',
  containerClassName = '',
  maxWidth = 'max-w-lg',
  /** Set false for flows where a stray backdrop click must not discard work. */
  closeOnBackdropClick = true,
  hideHeader = false,
  showClose = true,
}) => {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = description ? `${baseId}-description` : undefined;

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;

    // Focus trap.
    const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    );
    if (nodes.length === 0) {
      e.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog: first control, else the panel itself.
    const raf = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector(FOCUSABLE) ?? panelRef.current;
      target?.focus?.();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = '';
      // Return focus to whatever opened the dialog.
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${containerClassName}`}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop — presentational only. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`relative z-10 flex w-full ${maxWidth} max-h-[90vh] flex-col rounded-2xl border border-border bg-white dark:bg-zinc-900 bg-surface text-text-primary shadow-2xl animate-zoom-in focus:outline-none ${className}`}
      >
        {!hideHeader && (
          <div className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
            <div className="min-w-0">
              {title && <h3 id={titleId} className="text-display-xs font-display">{title}</h3>}
              {description && (
                <p id={descriptionId} className="mt-1 text-body-sm text-text-muted leading-normal">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 rounded-full"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 text-body-md">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-border/60 bg-zinc-50 dark:bg-zinc-900/90 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialog;
