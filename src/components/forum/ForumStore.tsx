"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { questivalWindow } from "@/lib/questival";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getAccessToken } from "@/lib/auth";
import {
  ME,
  firstName,
  readNowOffset,
  sampleInvites,
  uid,
  usePersisted,
  type Final,
  type Invite,
  type Person,
  type Plan,
  type PlanIntent,
  type SavedProof,
} from "@/components/forum/store";

/**
 * One store for the phone Forum and every desktop window (Calendar, Maps,
 * Photos, Mail, ALF), so a plan made in one place shows up in all of them.
 * Preview build: device state + sample data. The real build swaps the
 * persisted hooks for the API routes and keeps this surface.
 */
export type ForumStore = {
  /** The feature flag: cohost preview list now, every RSVP at launch. */
  enabled: boolean;
  now: number;
  me: string;
  photoUrl: string | null;
  people: Person[];
  intents: Record<string, PlanIntent | undefined>;
  setIntent: (activityId: string, intent: PlanIntent) => void;
  plans: Plan[];
  addPlan: (kind: Plan["kind"], targetId: string, withNames: string[]) => void;
  removePlan: (id: string) => void;
  replies: Record<string, "in" | "maybe">;
  reply: (inviteId: string, r: "in" | "maybe") => void;
  proofs: SavedProof[];
  saveProof: (p: SavedProof) => void;
  removeProof: (id: string) => void;
  final: Final;
  submitFinal: () => void;
  invites: Invite[];
  unanswered: number;
  toast: string | null;
  setToast: (t: string | null) => void;
};

const Ctx = createContext<ForumStore | null>(null);

export function ForumStoreProvider({
  me: meProp,
  photoUrl: photoProp = null,
  enabled: enabledProp,
  children,
}: {
  me?: string;
  photoUrl?: string | null;
  /** Force the flag (the phone gate already checked). Otherwise it's checked here. */
  enabled?: boolean;
  children: ReactNode;
}) {
  const [checked, setChecked] = useState<{ enabled: boolean; name: string; photoUrl: string | null }>({ enabled: false, name: ME, photoUrl: null });
  useEffect(() => {
    if (enabledProp !== undefined) return;
    let cancelled = false;
    const check = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/forum/access", { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
      if (cancelled || !res) return;
      const b = res.ok ? await res.json().catch(() => ({})) : {};
      setChecked({ enabled: !!b.allowed, name: b.name ?? ME, photoUrl: b.photoUrl ?? null });
    };
    check();
    const supabase = getSupabaseBrowser();
    const sub = supabase?.auth.onAuthStateChange(() => {
      check();
    });
    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, [enabledProp]);
  const enabled = enabledProp ?? checked.enabled;
  const me = meProp ?? (checked.enabled ? checked.name : ME);
  const photoUrl = photoProp ?? checked.photoUrl;

  // Clock (with the ?now= demo offset), ticking every 30s.
  const [offset] = useState(() => readNowOffset());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => clearInterval(t);
  }, [offset]);

  // The class — real RSVP faces from the live API.
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/participants")
      .then((r) => (r.ok ? r.json() : { participants: [] }))
      .then((d) => {
        if (!cancelled && Array.isArray(d.participants)) setPeople(d.participants);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [intents, setIntents] = usePersisted<Record<string, PlanIntent | undefined>>("plans", {});
  const [plans, setPlans] = usePersisted<Plan[]>("qplans", []);
  const [replies, setReplies] = usePersisted<Record<string, "in" | "maybe">>("replies", {});
  const [proofs, setProofs] = usePersisted<SavedProof[]>("proofs", []);
  const [final, setFinal] = usePersisted<Final>("final", null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const invites = useMemo(() => (enabled ? sampleInvites(people, now) : []), [enabled, people, now]);
  const unanswered = invites.filter((i) => !replies[i.id]).length;

  const setIntent = useCallback(
    (id: string, i: PlanIntent) => setIntents((m) => ({ ...m, [id]: m[id] === i ? undefined : i })),
    [setIntents],
  );
  const addPlan = useCallback(
    (kind: Plan["kind"], targetId: string, withNames: string[]) => {
      setPlans((ps) => [{ id: uid(), kind, targetId, with: withNames, at: now }, ...ps.filter((p) => !(p.kind === kind && p.targetId === targetId))]);
      setToast(withNames.length ? `Planned · ${withNames.map(firstName).join(", ")} got an invite` : "Planned");
    },
    [now, setPlans],
  );
  const removePlan = useCallback((id: string) => setPlans((ps) => ps.filter((p) => p.id !== id)), [setPlans]);
  const reply = useCallback((id: string, r: "in" | "maybe") => setReplies((m) => ({ ...m, [id]: r })), [setReplies]);
  const saveProof = useCallback(
    (p: SavedProof) => {
      setProofs((ps) => [p, ...ps]);
      setToast("Saved to your list");
    },
    [setProofs],
  );
  const removeProof = useCallback((id: string) => setProofs((ps) => ps.filter((p) => p.id !== id)), [setProofs]);
  const submitFinal = useCallback(() => setFinal({ at: now, extension: questivalWindow(now) === "extension" }), [now, setFinal]);

  const value: ForumStore = {
    enabled,
    now, me, photoUrl, people,
    intents, setIntent,
    plans, addPlan, removePlan,
    replies, reply,
    proofs, saveProof, removeProof,
    final, submitFinal,
    invites, unanswered,
    toast, setToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useForumStore(): ForumStore {
  const s = useContext(Ctx);
  if (!s) throw new Error("useForumStore outside ForumStoreProvider");
  return s;
}

/** Small toast, rendered by whichever shell is on screen. */
export function ForumToast() {
  const { toast } = useForumStore();
  return toast ? <div className="fm-toast">{toast}</div> : null;
}
