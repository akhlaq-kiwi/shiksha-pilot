import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/**
 * GlobalSearch (⌘K / Ctrl-K).
 *
 * On a 50-screen admin product, "find Aryan Mehta" previously meant: guess the
 * portal, guess the screen, then filter a table. This is the largest single
 * navigation accelerator available, so it searches both destinations (pages the
 * user can reach) and records (students, teachers, classes) in one list.
 *
 * Props:
 *   destinations = [{ label, group, icon, onSelect, keywords? }]
 *   onSearchRecords = async (query) => [{ id, label, sublabel, group, icon, onSelect }]
 */
const GlobalSearch = ({ destinations = [], onSearchRecords, placeholder = 'Search pages, students, teachers…' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [records, setRecords] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const previouslyFocused = useRef(null);

  // ---- ⌘K / Ctrl-K to open, anywhere in the app ----
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setRecords([]);
      setActiveIndex(0);
      previouslyFocused.current?.focus?.();
    }
  }, [open]);

  // ---- Debounced record search (300ms) ----
  useEffect(() => {
    if (!onSearchRecords) return;
    const q = query.trim();
    if (q.length < 2) {
      setRecords([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await onSearchRecords(q);
        if (!cancelled) setRecords(Array.isArray(results) ? results : []);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [query, onSearchRecords]);

  const matchedDestinations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return destinations.slice(0, 8);
    return destinations
      .filter((d) =>
        [d.label, d.group, ...(d.keywords ?? [])]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [destinations, query]);

  const results = useMemo(
    () => [
      ...matchedDestinations.map((d) => ({ ...d, kind: 'destination' })),
      ...records.map((r) => ({ ...r, kind: 'record' })),
    ],
    [matchedDestinations, records]
  );

  // Keep the highlight in range as results change.
  useEffect(() => {
    setActiveIndex((i) => (i >= results.length ? 0 : i));
  }, [results.length]);

  const runSelect = useCallback((item) => {
    setOpen(false);
    item?.onSelect?.();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runSelect(results[activeIndex]);
    }
  };

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Group headers, computed once so we can render a label before each group.
  let lastGroup = null;

  return (
    <>
      {/* Trigger — visible affordance, since a hidden shortcut is undiscoverable */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-body-sm text-text-muted transition-colors hover:border-primary/40 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Search (Command K)"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">Search…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border bg-secondary px-1 py-0.5 text-[10px] font-medium lg:inline-flex">
          ⌘K
        </kbd>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh]">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search"
              className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface-overlay shadow-lg animate-zoom-in"
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="h-4 w-4 flex-shrink-0 text-text-muted" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  aria-label="Search"
                  aria-controls="global-search-results"
                  aria-activedescendant={results.length ? `global-search-option-${activeIndex}` : undefined}
                  className="h-12 flex-1 bg-transparent text-body-lg text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                {searching && <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-hidden="true" />}
              </div>

              <div
                ref={listRef}
                id="global-search-results"
                role="listbox"
                aria-label="Search results"
                className="max-h-[55vh] overflow-y-auto p-2"
              >
                {results.length === 0 ? (
                  <p className="px-3 py-8 text-center text-body-md text-text-muted">
                    {query.trim().length >= 2 && !searching
                      ? `Nothing matches “${query.trim()}”.`
                      : 'Type to search pages, students, teachers and classes.'}
                  </p>
                ) : (
                  results.map((item, i) => {
                    const Icon = item.icon;
                    const showGroup = item.group && item.group !== lastGroup;
                    lastGroup = item.group ?? lastGroup;
                    return (
                      <React.Fragment key={`${item.kind}-${item.id ?? item.label}-${i}`}>
                        {showGroup && (
                          <p className="px-3 pb-1 pt-3 text-overline text-text-muted">{item.group}</p>
                        )}
                        <button
                          type="button"
                          role="option"
                          id={`global-search-option-${i}`}
                          data-index={i}
                          aria-selected={i === activeIndex}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => runSelect(item)}
                          className={twMerge(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                            i === activeIndex ? 'bg-primary-subtle' : 'hover:bg-secondary'
                          )}
                        >
                          {Icon && (
                            <Icon className="h-4 w-4 flex-shrink-0 text-text-muted" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-md text-text-primary">
                              {item.label}
                            </span>
                            {item.sublabel && (
                              <span className="block truncate text-body-sm text-text-muted">
                                {item.sublabel}
                              </span>
                            )}
                          </span>
                          {i === activeIndex && (
                            <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" aria-hidden="true" />
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-4 border-t border-border bg-secondary/40 px-4 py-2 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="h-3 w-3" /> open
                </span>
                <span className="ml-auto">esc to close</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default GlobalSearch;
