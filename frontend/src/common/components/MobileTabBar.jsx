import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/**
 * MobileTabBar — bottom navigation for the student and parent portals.
 *
 * Those users are mobile-first, infrequent, and low-tolerance: every extra step
 * costs completion. A bottom bar puts the 4 primary destinations in thumb reach
 * instead of behind a horizontally scrolling strip with no scroll affordance.
 *
 * Anything past `primaryCount` collapses into a "More" sheet, so the bar never
 * gets crowded regardless of how many sections a role has.
 */
const MobileTabBar = ({ items = [], currentPage, onNavigate, primaryCount = 4, className }) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = items.slice(0, primaryCount);
  const overflow = items.slice(primaryCount);
  const overflowActive = overflow.some((i) => (i.id ?? i.path) === currentPage);

  const select = (item) => {
    onNavigate?.(item.id ?? item.path, item);
    setMoreOpen(false);
  };

  return (
    <>
      {/* Spacer so page content is never hidden behind the fixed bar. */}
      <div className="h-[4.5rem] md:hidden" aria-hidden="true" />

      <nav
        aria-label="Primary"
        className={twMerge(
          'fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden',
          className
        )}
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const active = (item.id ?? item.path) === currentPage;
          return (
            <button
              key={item.id ?? item.path}
              type="button"
              onClick={() => select(item)}
              aria-current={active ? 'page' : undefined}
              className={twMerge(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-touch',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50',
                active ? 'text-primary' : 'text-text-muted'
              )}
            >
              {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
              {item.badge != null && item.badge !== 0 && (
                <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-danger-500" />
              )}
            </button>
          );
        })}

        {overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={twMerge(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-touch',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50',
              overflowActive ? 'text-primary' : 'text-text-muted'
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">More</span>
          </button>
        )}
      </nav>

      {moreOpen &&
        createPortal(
          <div className="fixed inset-0 z-[70] md:hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/50"
              onClick={() => setMoreOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More sections"
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border bg-surface-overlay p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-display-xs text-text-primary">More</p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                  className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-text-muted hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {overflow.map((item) => {
                  const Icon = item.icon;
                  const active = (item.id ?? item.path) === currentPage;
                  return (
                    <button
                      key={item.id ?? item.path}
                      type="button"
                      onClick={() => select(item)}
                      aria-current={active ? 'page' : undefined}
                      className={twMerge(
                        'flex flex-col items-center gap-2 rounded-xl border p-3 text-center',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        active
                          ? 'border-primary bg-primary-subtle text-primary'
                          : 'border-border text-text-secondary hover:bg-secondary'
                      )}
                    >
                      {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                      <span className="text-body-sm font-medium leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default MobileTabBar;
