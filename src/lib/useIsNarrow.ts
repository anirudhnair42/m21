"use client";

import { useEffect, useState } from "react";

/** Phone breakpoint — at/below this we present the mobile invitation card. */
export const NARROW_QUERY = "(max-width: 700px)";

/**
 * Returns whether the viewport currently matches a media query (defaults to
 * the phone breakpoint). SSR-safe: returns `false` until mounted, then syncs
 * to the real value and subscribes to changes.
 */
export function useIsNarrow(query: string = NARROW_QUERY): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
