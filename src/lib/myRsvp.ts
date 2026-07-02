"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";

/**
 * Device-memory identity (v1): the browser remembers which rsvps row is
 * yours, and the UI adapts to its payment status. Google login (Minerva
 * Workspace) layers on before launch and will claim these rows by email.
 */

const STORAGE_KEY = "reunion_rsvp_id_v1";

export type MyRsvpStatus = "pending" | "processing" | "paid";

export type MyRsvp = {
  /** The rsvps row this device (or account) owns, if any. */
  id: string | null;
  status: MyRsvpStatus | null;
  name: string | null;
  /** The live photo taken at RSVP — worn as the ALF avatar. */
  photoUrl: string | null;
  /** Money received or in flight — unlocks the class. */
  joined: boolean;
  /** Re-check the status now (e.g. right after returning from Stripe). */
  refresh: () => void;
  /** Called by the RSVP form after creating a row. */
  remember: (id: string) => void;
};

export function getStoredRsvpId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeRsvpId(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private-mode storage failures just mean the device won't remember.
  }
}

/**
 * Read this device's RSVP + payment status. Polls faster for a short window
 * when `eager` (just back from checkout — the webhook can lag the redirect
 * by a few seconds), then settles into a slow refresh.
 */
export function useMyRsvp(opts?: { eager?: boolean }): MyRsvp {
  const [id, setId] = useState<string | null>(() => getStoredRsvpId());
  const [status, setStatus] = useState<MyRsvpStatus | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const fetchStatus = useCallback(async (rsvpId: string) => {
    try {
      const res = await fetch(`/api/rsvp/status?id=${encodeURIComponent(rsvpId)}`);
      if (!res.ok) return null;
      const body = await res.json();
      if (body.status) {
        setStatus(body.status);
        setName(body.name ?? null);
        setPhotoUrl(body.photo_url ?? null);
        return body.status as MyRsvpStatus;
      }
    } catch {
      // Offline — keep whatever we knew.
    }
    return null;
  }, []);

  // Logged in? The account lookup wins — the RSVP follows the person across
  // devices, and this device adopts the row.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      try {
        // If this device made a guest RSVP, claim it for the account first —
        // that's what welds "signed up and paid" to "always connected".
        const deviceId = getStoredRsvpId();
        if (deviceId) {
          await fetch("/api/me", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rsvp_id: deviceId }),
          }).catch(() => {});
        }
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled || !body.rsvp?.id) return;
        storeRsvpId(body.rsvp.id);
        setId(body.rsvp.id);
        setStatus(body.rsvp.status ?? null);
        setName(body.rsvp.name ?? null);
        setPhotoUrl(body.rsvp.photo_url ?? null);
      } catch {
        // Offline — device memory still applies.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let tries = 0;

    const tick = async () => {
      if (cancelled) return;
      const s = await fetchStatus(id);
      tries += 1;
      // Eager mode: poll every 3s (up to 10x) until the webhook lands.
      if (opts?.eager && s !== "paid" && tries < 10) {
        timer = setTimeout(tick, 3_000);
      } else {
        timer = setTimeout(tick, 30_000);
      }
    };
    let timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, opts?.eager, fetchStatus]);

  const remember = useCallback((newId: string) => {
    storeRsvpId(newId);
    setId(newId);
  }, []);

  const refresh = useCallback(() => {
    if (id) fetchStatus(id);
  }, [id, fetchStatus]);

  return {
    id,
    status,
    name,
    photoUrl,
    joined: status === "paid" || status === "processing",
    refresh,
    remember,
  };
}
