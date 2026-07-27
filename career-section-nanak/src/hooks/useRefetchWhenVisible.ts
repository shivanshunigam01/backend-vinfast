import { useEffect, useRef } from "react";

/**
 * Re-runs when the user returns to the tab so CMS changes from admin show up without a full reload.
 */
export function useRefetchWhenVisible(fn: () => void | Promise<void>, enabled: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") void ref.current();
    };
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [enabled]);
}
