import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

const STORAGE_PREFIX = 'shiksha_pilot_onboarding_dismissed:';

/**
 * OnboardingChecklist.
 *
 * A new school admin previously had to infer the correct setup order by
 * hitting errors (e.g. trying to add a class before an academic year exists).
 * This persists on the dashboard until every step is complete, showing
 * progress ("3 of 8") so setup feels like a tracked task rather than a
 * scavenger hunt, and lets the admin skip and return later.
 *
 *   <OnboardingChecklist
 *     scopeKey={schoolId}
 *     items={[
 *       { id: 'academic-year', label: 'Create an academic year', done: !!currentYear, onClick: () => nav(...) },
 *       ...
 *     ]}
 *   />
 *
 * Renders nothing once every item is done, or after the admin dismisses it
 * (per-school, via localStorage — reappears for a different school/tenant).
 */
export function OnboardingChecklist({ items = [], scopeKey = 'default', title = 'Finish setting up your school' }) {
  const storageKey = `${STORAGE_PREFIX}${scopeKey}`;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === '1'
  );
  const [collapsed, setCollapsed] = useState(false);

  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = total > 0 && doneCount === total;

  if (dismissed || allDone || total === 0) return null;

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const pct = Math.round((doneCount / total) * 100);

  return (
    <Card className="overflow-hidden border-primary/20 bg-primary-subtle/40">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-display-xs font-display text-text-primary">{title}</h3>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {doneCount} of {total}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Setup progress"
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand setup checklist' : 'Collapse setup checklist'}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss setup checklist"
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <ul className="grid grid-cols-1 gap-1.5 px-3 pb-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={item.done ? undefined : item.onClick}
                disabled={item.done || !item.onClick}
                className={twMerge(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  item.done
                    ? 'cursor-default text-text-muted'
                    : 'text-text-primary hover:bg-surface'
                )}
              >
                <span
                  className={twMerge(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2',
                    item.done ? 'border-success-500 bg-success-500 text-white' : 'border-border-strong'
                  )}
                  aria-hidden="true"
                >
                  {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={twMerge('text-body-md', item.done && 'line-through')}>
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default OnboardingChecklist;
