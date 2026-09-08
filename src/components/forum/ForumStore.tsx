"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QUESTIVAL, QUESTS, getQuest, questivalWindowAt, type Quest, type Window } from "@/lib/questival";
import { ACTIVITIES } from "@/lib/weekend";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getAccessToken } from "@/lib/auth";
import type {
  CatchupDTO,
  CreatePlanRequest,
  CreateSubmissionRequest,
  IntentRequest,
  PersonDTO,
  PlanDTO,
  QuestDTO,
  SettingsDTO,
  StateResponse,
  SubmissionDTO,
  UploadUrlResponse,
  WhoAllResponse,
} from "@/lib/questival-api";
import {
  ME,
  ME_ID,
  proofKey,
  readNowOffset,
  shrinkImage,
  uid,
  usePersisted,
  type Final,
  type PlanIntent,
} from "@/components/forum/store";

/**
 * One store for the phone Forum and every desktop window (Calendar, Maps,
 * Photos, Mail, ALF). Two modes:
 *   api   — signed in with an RSVP and the tables exist: everything goes
 *           through /api/questival, /api/weekend, /api/catchups.
 *   local — preview: device state + sample data (no RSVP, or tables not
 *           created yet). Same DTO shapes, same components.
 */
export type SaveProofInput = {
  questId: string;
  instance: number;
  files: File[];
  memberIds: string[];
  caption?: string;
  note?: string;
  onProgress?: (done: number, total: number) => void;
};

export type ForumStore = {
  enabled: boolean;
  /** Assignment 3 is visible to non-organizers (QUESTIVAL_OPEN=1). */
  questivalOpen: boolean;
  organizer: boolean;
  mode: "api" | "local";
  /** Why we're in local mode, for the preview strip. */
  localReason: "preview" | "no-rsvp" | "tables-missing" | null;
  now: number;
  /** Where `now` falls against the switches in effect (q_settings when live, the static ones otherwise). */
  phase: Window;
  me: PersonDTO;
  people: PersonDTO[];
  quests: Quest[];
  settings: SettingsDTO;
  who: WhoAllResponse;
  intents: Record<string, PlanIntent | undefined>;
  setIntent: (activityId: string, intent: PlanIntent) => void;
  plans: PlanDTO[];
  addPlan: (kind: "quest" | "activity", targetId: string, withIds: string[]) => void;
  removePlan: (id: string) => void;
  invites: PlanDTO[];
  replyPlan: (planId: string, reply: "in" | "maybe") => void;
  submissions: SubmissionDTO[];
  saveProof: (input: SaveProofInput) => Promise<SubmissionDTO>;
  removeProof: (id: string) => void;
  final: Final;
  submitFinal: () => void;
  catchups: CatchupDTO[];
  requestCatchup: (toId: string, slot: string, note: string) => void;
  replyCatchup: (id: string, status: "accepted" | "declined") => void;
  unanswered: number;
  toast: string | null;
  setToast: (t: string | null) => void;
  refresh: () => void;
};

const Ctx = createContext<ForumStore | null>(null);

const DEFAULT_SETTINGS: SettingsDTO = {
  opens_at: new Date(QUESTIVAL.opensAt).toISOString(),
  due_at: new Date(QUESTIVAL.dueAt).toISOString(),
  extension_until: new Date(QUESTIVAL.extensionUntil).toISOString(),
  announcement: null,
  results_released_at: null,
  frozen_at: null,
};

type ApiErr = Error & { code?: string; status?: number };

async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
  } catch {
    const err = new Error("You're offline — check the connection and try again.") as ApiErr;
    err.status = 0;
    throw err;
  }
  const body: unknown = await res.json().catch(() => null);
  // A `null` or non-object body must not turn into a TypeError on `.error`.
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (!res.ok) {
    const err = new Error(typeof obj.error === "string" ? obj.error : `Request failed (${res.status})`) as ApiErr;
    err.code = typeof obj.code === "string" ? obj.code : undefined;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

function toQuest(q: QuestDTO): Quest {
  return { id: q.id, title: q.title, prompt: q.prompt, points: q.points, evidence: q.evidence, venue: q.venue, address: q.address, area: q.area, lat: q.lat, lng: q.lng, repeat: q.repeat, bonus: q.bonus, tip: q.tip };
}

/** Case/whitespace-insensitive name key, for matching goingSeed hosts to RSVP rows. */
const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A file the picker handed over without a MIME type: go by the extension. */
function guessType(f: File): string {
  if (f.type) return f.type;
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  return ({ mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", heic: "image/heic", heif: "image/heic", png: "image/png", webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg" } as Record<string, string>)[ext] ?? "";
}

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
  // ---- the flag + identity
  const [checked, setChecked] = useState<{ enabled: boolean; name: string; photoUrl: string | null; organizer: boolean; rsvpId: string | null; questival: boolean }>({
    enabled: false, name: ME.name, photoUrl: null, organizer: false, rsvpId: null, questival: false,
  });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/forum/access", { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
      if (cancelled || !res) return;
      const b = res.ok ? await res.json().catch(() => ({})) : {};
      if (cancelled) return;
      setChecked({ enabled: !!b.allowed, name: b.name ?? ME.name, photoUrl: b.photoUrl ?? null, organizer: !!b.organizer, rsvpId: b.rsvpId ?? null, questival: !!b.questival });
    };
    check();
    const supabase = getSupabaseBrowser();
    // supabase-js holds its auth lock while this callback runs, and
    // getSession() inside it deadlocks — so defer the re-check a tick.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sub = supabase?.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 50);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub?.data.subscription.unsubscribe();
    };
  }, []);
  const enabled = enabledProp ?? checked.enabled;

  // ---- clock (America/Los_Angeles is applied at display time; `now` is an instant)
  const [offset] = useState(() => readNowOffset());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    const t = setInterval(tick, 30_000);
    // Background tabs throttle timers; catch the clock up the moment we're visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [offset]);

  // ---- the class
  const [people, setPeople] = useState<PersonDTO[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/participants")
      .then((r) => (r.ok ? r.json() : { participants: [] }))
      .then((d) => {
        if (cancelled || !Array.isArray(d.participants)) return;
        setPeople(d.participants.map((p: { id?: string; name: string; photo_url: string | null }) => ({ id: p.id ?? p.name, name: p.name, photo_url: p.photo_url })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- catalog (static + organizer overrides)
  const [quests, setQuests] = useState<Quest[]>(QUESTS);
  const [settings, setSettings] = useState<SettingsDTO>(DEFAULT_SETTINGS);
  const loadCatalog = useCallback(async () => {
    try {
      const c = await api<{ quests: QuestDTO[]; settings: SettingsDTO }>("/api/questival/catalog");
      setQuests(c.quests.filter((q) => q.status === "live").map(toQuest));
      setSettings(c.settings);
    } catch {
      /* static catalog stands */
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    // Deferred a tick: the effect body itself never touches state.
    const kick = setTimeout(() => loadCatalog(), 0);
    return () => clearTimeout(kick);
  }, [enabled, loadCatalog]);

  // ---- server state (api mode) + who's going, fetched as one snapshot
  const [state, setState] = useState<StateResponse | null>(null);
  const [who, setWho] = useState<WhoAllResponse>({});
  const [localReason, setLocalReason] = useState<ForumStore["localReason"]>("preview");
  /** Last good snapshot, readable inside loadState without a stale closure. */
  const lastGood = useRef<StateResponse | null>(null);
  /** Monotonic load counter: an older response never overwrites a newer one. */
  const seq = useRef(0);
  const loadState = useCallback(async () => {
    const mine = ++seq.current;
    if (!enabled) {
      // Signed out (or the gate closed): forget the previous person's data.
      lastGood.current = null;
      setState(null);
      setWho({});
      setLocalReason("preview");
      return;
    }
    const [s, w] = await Promise.allSettled([api<StateResponse>("/api/questival/state"), api<WhoAllResponse>("/api/weekend/plans")]);
    if (mine !== seq.current) return; // a later load (a write's refetch, the next poll) already answered
    if (w.status === "fulfilled" && w.value && typeof w.value === "object") setWho(w.value);
    if (s.status === "fulfilled") {
      if (!s.value.me) {
        lastGood.current = null;
        setLocalReason("no-rsvp");
        setState(null);
      } else {
        lastGood.current = s.value;
        setState(s.value);
        setLocalReason(null);
      }
      return;
    }
    const e = s.reason as ApiErr;
    if (e.code === "tables-missing") {
      lastGood.current = null;
      setLocalReason("tables-missing");
      setState(null);
    } else if (e.status === 401 || e.status === 403 || e.code === "unconfigured") {
      lastGood.current = null;
      setLocalReason("preview");
      setState(null);
    } else if (!lastGood.current) {
      // Never had a snapshot: a 500 or a dead network reads as "not connected".
      setLocalReason("preview");
    }
    // Otherwise a blip mid-session (offline, 500): keep the last good
    // snapshot. Dropping it would flip the UI into preview mode and hide the
    // person's own proofs until the next poll succeeded.
  }, [enabled]);
  useEffect(() => {
    const kick = setTimeout(() => loadState(), 0);
    const poll = () => {
      if (document.visibilityState === "visible") loadState();
    };
    const t = setInterval(poll, 45_000);
    // Coming back to the tab refreshes right away instead of up to 45s later.
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
      document.removeEventListener("visibilitychange", poll);
      seq.current += 1; // anything still in flight for this closure is stale
    };
  }, [loadState]);
  const mode: "api" | "local" = state ? "api" : "local";

  // ---- local preview state
  const [lIntents, setLIntents] = usePersisted<Record<string, PlanIntent | undefined>>("intents", {});
  const [lPlans, setLPlans] = usePersisted<PlanDTO[]>("plans", []);
  const [lSubs, setLSubs] = usePersisted<SubmissionDTO[]>("subs", []);
  const [lFinal, setLFinal] = usePersisted<Final>("final", null);
  const [lCatchups, setLCatchups] = usePersisted<CatchupDTO[]>("catchups", []);
  const [lCatchupReplies, setLCatchupReplies] = usePersisted<Record<string, "accepted" | "declined">>("cureplies", {});

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const stateMe = state?.me ?? null;
  const me = useMemo<PersonDTO>(
    () => stateMe ?? { id: checked.rsvpId ?? ME_ID, name: meProp ?? (checked.enabled ? checked.name : ME.name), photo_url: photoProp ?? checked.photoUrl },
    [stateMe, checked, meProp, photoProp],
  );
  const organizer = state?.organizer ?? checked.organizer;
  const questivalOpen = organizer || checked.questival;
  const phase = useMemo<Window>(
    () => questivalWindowAt({ opensAt: settings.opens_at, dueAt: settings.due_at, extensionUntil: settings.extension_until }, now),
    [settings, now],
  );

  // The class list with me in it when I have a real RSVP id that
  // /api/participants didn't return (it caps at 200). Never the preview "You".
  const peopleWithMe = useMemo(
    () => (me.id === ME_ID || people.some((p) => p.id === me.id) ? people : [...people, me]),
    [people, me],
  );

  // ---- derived, by mode
  const intents: Record<string, PlanIntent | undefined> = mode === "api" ? state!.intents : lIntents;
  const plans = mode === "api" ? state!.plans : lPlans;
  const submissions = mode === "api" ? state!.submissions : lSubs;
  const final = mode === "api" ? state!.final : lFinal;
  // Invitations only come from real people; nothing to show until the API answers.
  const invites = useMemo<PlanDTO[]>(() => (mode === "api" ? state!.invites : []), [mode, state]);
  const catchups = useMemo<CatchupDTO[]>(() => (mode === "api" ? state!.catchups : lCatchups.map((c) => ({ ...c, status: lCatchupReplies[c.id] ?? c.status }))), [mode, state, lCatchups, lCatchupReplies]);
  // Things waiting on me: invitations I haven't answered (never my own
  // plans), and catch-ups sent to me that are still pending.
  const unanswered = useMemo(
    () =>
      invites.filter((p) => p.owner.id !== me.id && !p.replies[me.id] && !p.replies[ME_ID]).length +
      catchups.filter((c) => c.to.id === me.id && c.from.id !== me.id && c.status === "pending").length,
    [invites, catchups, me.id],
  );

  const failed = useCallback((e: unknown) => setToast(e instanceof Error ? e.message : "Something went wrong"), []);

  // ---- actions
  const setIntent = useCallback(
    (activityId: string, intent: PlanIntent) => {
      const next = intents[activityId] === intent ? null : intent;
      if (mode === "api") {
        // Optimistic: the button flips now; the refetch after the PUT
        // reconciles, and on failure puts the server's answer back.
        setState((s) => {
          if (!s) return s;
          const i = { ...s.intents };
          if (next) i[activityId] = next;
          else delete i[activityId];
          return { ...s, intents: i };
        });
        api("/api/weekend/plans", { method: "PUT", json: { activity_id: activityId, intent: next } satisfies IntentRequest })
          .then(loadState)
          .catch((e) => {
            failed(e);
            loadState();
          });
      } else {
        setLIntents((m) => ({ ...m, [activityId]: next ?? undefined }));
      }
    },
    [mode, intents, loadState, failed, setLIntents],
  );

  const addPlan = useCallback(
    (kind: "quest" | "activity", targetId: string, withIds: string[]) => {
      const names = withIds.map((id) => peopleWithMe.find((p) => p.id === id)?.name.split(" ")[0] ?? "").filter(Boolean);
      const msg = names.length ? `Planned · ${names.join(", ")} got an invite` : "Planned";
      if (mode === "api") {
        api("/api/questival/plans", { method: "POST", json: { kind, target_id: targetId, with_ids: withIds } satisfies CreatePlanRequest })
          .then(() => (setToast(msg), loadState()))
          .catch(failed);
      } else {
        const withPeople = withIds.map((id) => peopleWithMe.find((p) => p.id === id)).filter(Boolean) as PersonDTO[];
        setLPlans((ps) => [
          { id: uid(), kind, target_id: targetId, owner: me, with: withPeople, replies: {}, created_at: new Date(now).toISOString() },
          ...ps.filter((p) => !(p.kind === kind && p.target_id === targetId)),
        ]);
        setToast(msg);
      }
    },
    [mode, peopleWithMe, me, now, loadState, failed, setLPlans],
  );
  const removePlan = useCallback(
    (id: string) => {
      if (mode === "api") api(`/api/questival/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(loadState).catch(failed);
      else setLPlans((ps) => ps.filter((p) => p.id !== id));
    },
    [mode, loadState, failed, setLPlans],
  );
  const replyPlan = useCallback(
    (planId: string, reply: "in" | "maybe") => {
      // Local mode has no invitations, so there is nothing to answer.
      if (mode === "api") api("/api/questival/plans/reply", { method: "POST", json: { plan_id: planId, reply } }).then(loadState).catch(failed);
    },
    [mode, loadState, failed],
  );

  const saveProof = useCallback(
    async (input: SaveProofInput): Promise<SubmissionDTO> => {
      if (input.files.length === 0) throw new Error("Attach at least one photo or video.");
      const quest = quests.find((q) => q.id === input.questId) ?? getQuest(input.questId);
      const members = [me, ...input.memberIds.map((id) => peopleWithMe.find((p) => p.id === id)).filter(Boolean)] as PersonDTO[];
      if (mode === "api") {
        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Storage isn't configured.");
        const media: { path: string; type: "image" | "video" }[] = [];
        let done = 0;
        for (const f of input.files) {
          const type = guessType(f);
          const isVideo = type.startsWith("video/");
          const payload = isVideo ? f : (await shrinkImage(f)).blob;
          const contentType = isVideo ? type : "image/jpeg";
          const slot = await api<UploadUrlResponse>("/api/questival/upload-url", {
            method: "POST",
            json: { quest_id: input.questId, content_type: contentType, size: payload.size },
          });
          const { error } = await supabase.storage.from("questival").uploadToSignedUrl(slot.path, slot.token, payload, { contentType });
          if (error) throw new Error(`Upload failed: ${error.message}`);
          media.push({ path: slot.path, type: isVideo ? "video" : "image" });
          done += 1;
          input.onProgress?.(done, input.files.length);
        }
        const req: CreateSubmissionRequest = {
          quest_id: input.questId,
          instance: input.instance,
          media,
          member_ids: input.memberIds,
          caption: input.caption,
          note: input.note,
          // Stable across retries of the same files, so "Save" after a dropped
          // connection returns the row the first try created.
          idempotency_key: proofKey(me.id, input.questId, input.instance, input.files),
        };
        const created = await api<SubmissionDTO>("/api/questival/submissions", { method: "POST", json: req });
        setToast("Saved to your list");
        loadState();
        return created;
      }
      // local: keep data URLs on the device
      const media = [];
      let done = 0;
      for (const f of input.files) {
        if (guessType(f).startsWith("video/")) media.push({ path: "", url: "", type: "video" as const });
        else media.push({ path: "", url: (await shrinkImage(f, 1200)).dataUrl, type: "image" as const });
        done += 1;
        input.onProgress?.(done, input.files.length);
      }
      const sub: SubmissionDTO = {
        id: uid(),
        quest_id: input.questId,
        instance: input.instance,
        uploader: me,
        members,
        media,
        caption: input.caption ?? null,
        note: input.note ?? null,
        status: "approved",
        points: quest?.points ?? 0,
        review_note: null,
        created_at: new Date(now).toISOString(),
      };
      setLSubs((ss) => [sub, ...ss]);
      setToast("Saved to your list");
      return sub;
    },
    [mode, quests, me, peopleWithMe, now, loadState, setLSubs],
  );
  const removeProof = useCallback(
    (id: string) => {
      if (mode === "api") api(`/api/questival/submissions?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(loadState).catch(failed);
      else setLSubs((ss) => ss.filter((s) => s.id !== id));
    },
    [mode, loadState, failed, setLSubs],
  );
  const submitFinal = useCallback(() => {
    if (mode === "api") {
      api("/api/questival/final", { method: "POST" }).then(() => (setToast("Submitted"), loadState())).catch(failed);
    } else {
      setLFinal((f) => f ?? { submitted_at: new Date(now).toISOString(), extension_used: phase === "extension" });
    }
  }, [mode, now, phase, loadState, failed, setLFinal]);

  const requestCatchup = useCallback(
    (toId: string, slot: string, note: string) => {
      const to = peopleWithMe.find((p) => p.id === toId);
      if (mode === "api") {
        api("/api/catchups", { method: "POST", json: { to_id: toId, slot, note } }).then(() => (setToast(`Sent to ${to?.name.split(" ")[0] ?? "them"}`), loadState())).catch(failed);
      } else if (to) {
        setLCatchups((cs) => [{ id: uid(), from: me, to, slot, note: note || null, status: "pending", created_at: new Date(now).toISOString() }, ...cs]);
        setToast(`Sent to ${to.name.split(" ")[0]}`);
      }
    },
    [mode, peopleWithMe, me, now, loadState, failed, setLCatchups],
  );
  const replyCatchup = useCallback(
    (id: string, status: "accepted" | "declined") => {
      if (mode === "api") api("/api/catchups/reply", { method: "POST", json: { id, status } }).then(loadState).catch(failed);
      else setLCatchupReplies((m) => ({ ...m, [id]: status }));
    },
    [mode, loadState, failed, setLCatchupReplies],
  );

  // Who's going: the API's answer, plus the hosts named on an activity
  // (real people, shown as going from day one). No sample faces.
  const whoMerged = useMemo<WhoAllResponse>(() => {
    const out: WhoAllResponse = {};
    for (const a of ACTIVITIES) {
      const w = who[a.id];
      const going = Array.isArray(w?.going) ? [...w.going] : [];
      for (const n of a.goingSeed ?? []) {
        const p = people.find((x) => nameKey(x.name) === nameKey(n));
        if (p && !going.some((g) => g.id === p.id)) going.unshift(p);
      }
      if (mode === "local" && intents[a.id] === "going" && !going.some((g) => g.id === me.id)) going.push(me);
      if (a.required) {
        // Everyone's expected: the whole class is the head count.
        out[a.id] = { going: people, going_count: people.length, interested_count: 0 };
        continue;
      }
      out[a.id] = { going, going_count: Math.max(going.length, w?.going_count ?? 0), interested_count: w?.interested_count ?? 0 };
    }
    return out;
  }, [who, people, mode, intents, me]);

  const refresh = useCallback(() => {
    loadState();
    loadCatalog();
  }, [loadState, loadCatalog]);

  const value: ForumStore = {
    enabled, questivalOpen, organizer, mode, localReason: mode === "api" ? null : localReason,
    now, phase, me, people: peopleWithMe, quests, settings, who: whoMerged,
    intents, setIntent,
    plans, addPlan, removePlan,
    invites, replyPlan,
    submissions, saveProof, removeProof,
    final, submitFinal,
    catchups, requestCatchup, replyCatchup,
    unanswered, toast, setToast,
    refresh,
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
