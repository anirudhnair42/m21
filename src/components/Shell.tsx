"use client";

import { useEffect, useState } from "react";
import { Desktop } from "@/components/Desktop";
import { MobileShell } from "@/components/mobile/MobileShell";
import { HoverTip } from "@/components/HoverTip";
import { NARROW_QUERY } from "@/lib/useIsNarrow";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { SnackbarProvider } from "@/lib/snackbar";

/**
 * Picks the experience by viewport: phones (≤820px) get the iOS 11 mobile
 * shell, everything wider keeps the macOS desktop. Deferred until mounted so
 * SSR and first client render agree (the desktop already relies on the same
 * deferral to read window dimensions).
 */
export function Shell() {
  const [mounted, setMounted] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    // Warm the auth client FIRST, while the OAuth return params are still in
    // the URL — the shells clean the URL a beat later.
    getSupabaseBrowser();
    const mql = window.matchMedia(NARROW_QUERY);
    setIsNarrow(mql.matches);
    setMounted(true);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (!mounted) {
    // Neutral splash until we know the viewport — avoids a desktop→mobile flash.
    return (
      <div className="stage">
        <div className="wallpaper" />
      </div>
    );
  }

  return (
    <SnackbarProvider>
      {isNarrow ? <MobileShell /> : <Desktop />}
      <HoverTip />
    </SnackbarProvider>
  );
}
