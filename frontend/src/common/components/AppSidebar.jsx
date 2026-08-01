import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/**
 * AppSidebar — the single navigation shell for every portal.
 *
 * Replaces four separate hand-rolled <aside> blocks (school-admin, super-admin,
 * student-parent, plus a horizontal wrapping nav in teacher) and the unused stub
 * that previously lived in this file. Inconsistent navigation was a stated
 * problem: the same product looked like four products.
 *
 * Two things it does that none of the old implementations did:
 *
 * 1. GROUPS. A flat list of 15 destinations exceeds comfortable scanning, and
 *    School Admin had exactly that. Pass `groups` to get labelled sections.
 *
 * 2. A REAL MOBILE PATTERN. The old sidebars collapsed into a horizontally
 *    scrolling strip with `scrollbar-none`, so on a phone there was no
 *    affordance that more items existed off-screen. Below `md` this now renders
 *    a proper drawer behind a trigger labelled with the current page.
 *
 * Accepts either:
 *   items  = [{ id|path, label, icon, badge, isSubmenu }]
 *   groups = [{ label, items: [...] }]
 */

const NavButton = ({ item, isActive, onSelect }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-current={isActive ? 'page' : undefined}
      className={twMerge(
        'flex w-full items-center gap-3 rounded-lg text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        item.isSubmenu ? 'py-2 pl-9 pr-3 text-body-sm' : 'px-3 py-2.5 text-body-md',
        isActive
          ? 'bg-primary text-primary-fg font-semibold shadow-sm'
          : 'font-medium text-text-secondary hover:bg-secondary hover:text-text-primary'
      )}
    >
      {Icon && (
        <Icon
          className={twMerge('flex-shrink-0', item.isSubmenu ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{item.label}</span>
      {item.badge != null && item.badge !== 0 && (
        <span
          className={twMerge(
            'ml-auto flex-shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
            isActive ? 'bg-white/20 text-primary-fg' : 'bg-danger-50 text-danger-700'
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
};

const NavContents = ({ groups, items, isItemActive, onSelect, footer }) => (
  <>
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
      {groups ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-overline text-text-muted">{group.label}</p>
              <nav className="flex flex-col gap-0.5" aria-label={group.label}>
                {group.items.map((item) => (
                  <NavButton
                    key={item.id ?? item.path}
                    item={item}
                    isActive={isItemActive(item)}
                    onSelect={onSelect}
                  />
                ))}
              </nav>
            </div>
          ))}
        </div>
      ) : (
        <nav className="flex flex-col gap-0.5" aria-label="Sections">
          {(items ?? []).map((item) => (
            <NavButton
              key={item.id ?? item.path}
              item={item}
              isActive={isItemActive(item)}
              onSelect={onSelect}
            />
          ))}
        </nav>
      )}
    </div>
    {footer && <div className="mt-4 flex-shrink-0">{footer}</div>}
  </>
);

const AppSidebar = ({
  items,
  navItems, // legacy prop name
  groups,
  /** Current page id (id-based portals) — compared against item.id. */
  currentPage,
  /** Active test for path-based portals. Takes precedence over currentPage. */
  isActive,
  onNavigate,
  footer,
  header,
  title = 'Menu',
  className,
}) => {
  const resolvedItems = items ?? navItems;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const triggerRef = useRef(null);

  const isItemActive = (item) =>
    isActive ? isActive(item) : currentPage === (item.id ?? item.path);

  const handleSelect = (item) => {
    onNavigate?.(item.id ?? item.path, item);
    setDrawerOpen(false);
  };

  // Close the drawer on Escape, lock scroll, and move focus inside.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => {
      drawerRef.current?.querySelector('button')?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  const flatItems = groups ? groups.flatMap((g) => g.items) : resolvedItems ?? [];
  const activeLabel = flatItems.find(isItemActive)?.label ?? title;

  return (
    <>
      {/* ---- Mobile: trigger labelled with where you currently are ---- */}
      <div className="sticky top-14 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-2 md:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          className="flex min-h-touch items-center gap-2 rounded-lg px-2 text-body-md font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="truncate">{activeLabel}</span>
        </button>
      </div>

      {drawerOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60] md:hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-sidebar p-4 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-display-xs text-text-primary">{title}</p>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="flex min-h-touch min-w-touch items-center justify-center rounded-lg text-text-muted hover:bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {header}
              <NavContents
                groups={groups}
                items={resolvedItems}
                isItemActive={isItemActive}
                onSelect={handleSelect}
                footer={footer}
              />
            </div>
          </div>,
          document.body
        )}

      {/* ---- Desktop ---- */}
      <aside
        className={twMerge(
          'hidden w-[240px] flex-shrink-0 flex-col border-r border-border bg-sidebar px-3 py-6',
          'md:sticky md:top-14 md:flex md:h-[calc(100vh-56px)]',
          className
        )}
      >
        {header}
        <NavContents
          groups={groups}
          items={resolvedItems}
          isItemActive={isItemActive}
          onSelect={handleSelect}
          footer={footer}
        />
      </aside>
    </>
  );
};

export default AppSidebar;
