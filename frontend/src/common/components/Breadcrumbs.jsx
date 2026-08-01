import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/**
 * Breadcrumbs.
 *
 * Nested routes (/school-admin/profile/subscription, student detail pages,
 * per-school drill-downs) previously gave no indication of where the user was
 * or how to get back one level — only the browser back button.
 *
 *   <Breadcrumbs
 *     items={[
 *       { label: 'Fee Collection', onClick: () => nav('/school-admin/finance') },
 *       { label: 'Aryan Mehta' },   // last item = current page, not a link
 *     ]}
 *   />
 */
const Breadcrumbs = ({ items = [], onHome, homeLabel = 'Dashboard', className }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={twMerge('mb-4', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-body-sm">
        {onHome && (
          <>
            <li>
              <button
                type="button"
                onClick={onHome}
                className="flex items-center gap-1 rounded px-1 py-0.5 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Home className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{homeLabel}</span>
              </button>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            </li>
          </>
        )}

        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <React.Fragment key={`${item.label}-${i}`}>
              <li>
                {isLast || !item.onClick ? (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={
                      isLast ? 'font-semibold text-text-primary' : 'text-text-muted'
                    }
                  >
                    {item.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="rounded px-1 py-0.5 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    {item.label}
                  </button>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
