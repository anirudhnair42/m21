"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/**
 * Google sign-in. Open to ANY Google account (per Ani, July 2026) — flip
 * OPEN_TO_ALL to false to re-enable the Minerva-domain guest list below.
 */
const OPEN_TO_ALL = true;
const ALLOWED_DOMAINS = ["uni.minerva.edu", "minerva.kgi.edu"];
const ALLOWED_EMAILS = ["ani@base10.vc", "anirudhnair42@gmail.com"];

export function isAllowedEmail(email: string): boolean {
  if (OPEN_TO_ALL) return true;
  const lower = email.toLowerCase();
  return (
    ALLOWED_EMAILS.includes(lower) ||
    ALLOWED_DOMAINS.some((d) => lower.endsWith(`@${d}`))
  );
}

export type AuthUser = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

function toAuthUser(u: User): AuthUser | null {
  if (!u.email) return null;
  const meta = u.user_metadata ?? {};
  return {
    email: u.email,
    name:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      u.email.split("@")[0],
    avatarUrl:
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null,
  };
}

export function useAuth() {
  const supabase = getSupabaseBrowser();
  const configured = supabase !== null;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const apply = (u: User | null | undefined) => {
      if (!u?.email) {
        setUser(null);
        return;
      }
      if (!isAllowedEmail(u.email)) {
        // Wrong Google account — sign it straight back out.
        setBlockedEmail(u.email);
        setUser(null);
        supabase.auth.signOut();
        return;
      }
      setBlockedEmail(null);
      setUser(toAuthUser(u));
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      apply(session?.user),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Land back on the desktop with ALF reopened, no intro replay.
        redirectTo: `${window.location.origin}/?auth=alf`,
        queryParams: OPEN_TO_ALL
          ? { prompt: "select_account" }
          : { hd: ALLOWED_DOMAINS[0], prompt: "select_account" },
      },
    });
    if (err) {
      setError(
        "Google sign-in isn't switched on yet — enable the Google provider in Supabase.",
      );
    }
  }, [supabase]);

  const signOut = useCallback(() => {
    supabase?.auth.signOut();
  }, [supabase]);

  return { configured, user, blockedEmail, error, signIn, signOut };
}

/** Current access token, for Authorization headers on API calls. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
