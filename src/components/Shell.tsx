"use client";

import { useEffect, useState } from "react";
import { Desktop } from "@/components/Desktop";
import { MobileShell } from "@/components/mobile/MobileShell";
import { HoverTip } from "@/components/HoverTip";
import { NARROW_QUERY } from "@/lib/useIsNarrow";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { takeForumNext } from "@/lib/auth";
import { SnackbarProvider } from "@/lib/snackbar";
import { ForumStoreProvider } from "@/components/forum/ForumStore";

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
    const supabase = getSupabaseBrowser();
    // A Google sign-in started on the mobile Forum can land here if the
    // OAuth redirect got collapsed to the site root. Finish the exchange,
    // then send them back to the page they were on.
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.get("auth") === "forum") {
      const next = takeForumNext();
      if (next && supabase) {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) window.location.replace(next);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
          if (session) window.location.replace(next);
        });
        setTimeout(() => sub.subscription.unsubscribe(), 15_000);
      }
    }
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
      {isNarrow ? (
        <MobileShell />
      ) : (
        <ForumStoreProvider>
          <Desktop />
        </ForumStoreProvider>
      )}
      <HoverTip />
    </SnackbarProvider>
  );
}
