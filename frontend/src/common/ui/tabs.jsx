import React, { createContext, useContext, useRef, useId } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tabs.
 *
 * Adds the ARIA tab pattern that was missing: role="tablist"/"tab"/"tabpanel",
 * aria-selected, aria-controls/id pairing, and arrow-key navigation with
 * Home/End — which is how keyboard and screen-reader users expect tabs to work.
 *
 * Also drops the uppercase 10px triggers in favour of sentence-case labels.
 */

const TabsContext = createContext(null);

export const Tabs = ({ value, onValueChange, children, className = '' }) => {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ activeValue: value, onValueChange, baseId }}>
      <div className={twMerge('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = '', label = 'Tabs' }) => {
  const listRef = useRef(null);

  /** Arrow keys move between tabs; Home/End jump to the ends. */
  const handleKeyDown = (e) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;

    const tabs = Array.from(listRef.current?.querySelectorAll('[role="tab"]') ?? []).filter(
      (t) => !t.disabled
    );
    if (tabs.length === 0) return;

    const currentIndex = tabs.indexOf(document.activeElement);
    let nextIndex;
    if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabs.length - 1;
    else if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;

    e.preventDefault();
    const next = tabs[nextIndex];
    next?.focus();
    next?.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={twMerge(
        'inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary/80 p-0.5 text-text-secondary',
        className
      )}
    >
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className = '', disabled }) => {
  const { activeValue, onValueChange, baseId } = useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      // Only the active tab is in the tab order; arrow keys move within the list.
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1 text-body-sm font-semibold transition-all cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset',
          'disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-surface text-text-primary shadow-sm'
            : 'hover:text-text-primary hover:bg-surface/40'
        ),
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = '' }) => {
  const { activeValue, baseId } = useContext(TabsContext);
  if (activeValue !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className={twMerge('mt-4 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  );
};
