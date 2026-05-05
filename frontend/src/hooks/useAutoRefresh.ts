import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
  intervalMs?: number;
  enabled?: boolean;
  refreshOnFocus?: boolean;
  paused?: boolean;
}

/**
 * Real-time refresh: polls while tab visible, pauses when hidden,
 * refreshes immediately when tab regains focus or visibility.
 * Pass `paused: true` while a modal/edit is open to avoid clobbering user input.
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  {
    intervalMs = 15000,
    enabled = true,
    refreshOnFocus = true,
    paused = false,
  }: UseAutoRefreshOptions = {},
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || paused) return;

    const tick = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };

    const id = window.setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') cbRef.current();
    };
    const onFocus = () => cbRef.current();

    document.addEventListener('visibilitychange', onVisibility);
    if (refreshOnFocus) window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      if (refreshOnFocus) window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs, enabled, refreshOnFocus, paused]);
}
