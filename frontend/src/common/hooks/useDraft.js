import { useEffect, useRef, useState, useCallback } from 'react';

const PREFIX = 'shiksha_pilot_draft:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

/**
 * Autosaves in-progress form/grid state to localStorage so a dropped connection,
 * an expired session, or a stray navigation doesn't destroy long data entry.
 *
 *   const { draft, saveDraft, clearDraft, hasDraft, draftSavedAt } =
 *     useDraft(`marks:${examId}:${classId}`, formState);
 *
 * `key` should identify the *scope* of the work (exam + class, student form, …)
 * so two different classes don't overwrite each other's drafts.
 */
export function useDraft(key, value, { debounceMs = 800, ttlMs = DEFAULT_TTL_MS, enabled = true } = {}) {
  const storageKey = PREFIX + key;
  const timerRef = useRef(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // Restored draft (read once per key, before any autosave overwrites it).
  const [draft, setDraft] = useState(() => readDraft(storageKey, ttlMs));

  useEffect(() => {
    setDraft(readDraft(PREFIX + key, ttlMs));
    setDraftSavedAt(null);
  }, [key, ttlMs]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch { /* storage unavailable — nothing to clear */ }
    setDraft(null);
    setDraftSavedAt(null);
  }, [key]);

  const saveDraft = useCallback((data) => {
    try {
      localStorage.setItem(
        PREFIX + key,
        JSON.stringify({ savedAt: new Date().toISOString(), data })
      );
      setDraftSavedAt(new Date());
    } catch {
      // Quota exceeded or storage disabled — autosave is best-effort by design.
    }
  }, [key]);

  // Debounced autosave of the live value.
  useEffect(() => {
    if (!enabled || value === undefined) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveDraft(value), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [value, enabled, debounceMs, saveDraft]);

  return { draft, hasDraft: !!draft, draftSavedAt, saveDraft, clearDraft };
}

function readDraft(storageKey, ttlMs) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > ttlMs) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default useDraft;
