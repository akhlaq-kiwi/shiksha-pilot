import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Guards work in progress against accidental loss.
 *
 * Covers both ways a user can walk away:
 *  1. Leaving the tab/app entirely  → native `beforeunload` prompt.
 *  2. Navigating within the SPA     → intercepts in-app link/back navigation.
 *
 * React Router v6 has no `useBlocker` on the data-router-less <BrowserRouter>,
 * so in-app navigation is guarded by intercepting clicks on anchors and the
 * browser back button. This is deliberately conservative: it warns rather than
 * hard-blocks, so a user can never get trapped on a page.
 *
 *   const { confirmNavigation } = useUnsavedChanges(isDirty);
 *   // before a programmatic route change:
 *   if (confirmNavigation()) navigate('/somewhere');
 */
export function useUnsavedChanges(
  isDirty,
  message = 'You have unsaved changes. Leave this page and lose them?'
) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  const location = useLocation();
  const navigate = useNavigate();

  // 1. Tab close / reload / external navigation
  useEffect(() => {
    const handler = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Modern browsers show their own generic copy; returnValue is still required.
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [message]);

  // 2. In-app anchor navigation (sidebar links, breadcrumbs, cards)
  useEffect(() => {
    const handleClick = (e) => {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;

      const anchor = e.target.closest?.('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.target === '_blank') return;
      if (href === location.pathname) return;

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // Capture phase so we run before React Router's own click handler.
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [message, location.pathname]);

  // 3. Browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      if (!dirtyRef.current) return;
      if (!window.confirm(message)) {
        // Re-push the current entry to cancel the navigation.
        navigate(location.pathname + location.search, { replace: false });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [message, navigate, location.pathname, location.search]);

  /** Call before any programmatic navigation. Returns true if it's safe to proceed. */
  const confirmNavigation = useCallback(
    () => !dirtyRef.current || window.confirm(message),
    [message]
  );

  return { confirmNavigation };
}

export default useUnsavedChanges;
