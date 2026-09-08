"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QUESTIVAL, QUESTS, getQuest, questivalWindow, type Quest } from "@/lib/questival";
import { ACTIVITIES } from "@/lib/weekend";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getAccessToken } from "@/lib/auth";
import type {
  CatchupDTO,
  CreatePlanRequest,
  CreateSubmissionRequest,
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

async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

function toQuest(q: QuestDTO): Quest {
  return { id: q.id, title: q.title, prompt: q.prompt, points: q.points, evidence: q.evidence, venue: q.venue, address: q.address, area: q.area, lat: q.lat, lng: q.lng, repeat: q.repeat, bonus: q.bonus, tip: q.tip };
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

  // ---- clock
  const [offset] = useState(() => readNowOffset());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => clearInterval(t);
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
    if (enabled) loadCatalog();
  }, [enabled, loadCatalog]);

  // ---- server state (api mode)
  const [state, setState] = useState<StateResponse | null>(null);
  const [localReason, setLocalReason] = useState<ForumStore["localReason"]>("preview");
  const loadState = useCallback(async () => {
    if (!enabled) return;
    try {
      const s = await api<StateResponse>("/api/questival/state");
      if (!s.me) {
        setLocalReason("no-rsvp");
        setState(null);
        return;
      }
      setState(s);
      setLocalReason(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setLocalReason(code === "tables-missing" ? "tables-missing" : (e as { status?: number }).status === 401 ? "preview" : "tables-missing");
      setState(null);
    }
  }, [enabled]);
  useEffect(() => {
    loadState();
    const t = setInterval(() => document.visibilityState === "visible" && loadState(), 45_000);
    return () => clearInterval(t);
  }, [loadState]);
  const mode: "api" | "local" = state ? "api" : "local";

  // ---- who's going (both modes; public route, local sample fallback)
  const [who, setWho] = useState<WhoAllResponse>({});
  useEffect(() => {
    if (!enabled) return;
    api<WhoAllResponse>("/api/weekend/plans").then(setWho).catch(() => {});
  }, [enabled, state]);

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

  const me: PersonDTO = state?.me ?? { id: checked.rsvpId ?? ME_ID, name: meProp ?? (checked.enabled ? checked.name : ME.name), photo_url: photoProp ?? checked.photoUrl };
  const organizer = state?.organizer ?? checked.organizer;
  const questivalOpen = organizer || checked.questival;

  const peopleWithMe = useMemo(() => (people.some((p) => p.id === me.id) ? people : people), [people, me.id]);

  // ---- derived, by mode
  const intents = mode === "api" ? (state!.intents as Record<string, PlanIntent | undefined>) : lIntents;
  const plans = mode === "api" ? state!.plans : lPlans;
  const submissions = mode === "api" ? state!.submissions : lSubs;
  const final = mode === "api" ? state!.final : lFinal;
  // Invitations only come from real people; nothing to show until the API answers.
  const invites = useMemo<PlanDTO[]>(() => (mode === "api" ? state!.invites : []), [mode, state]);
  const catchups = useMemo<CatchupDTO[]>(() => (mode === "api" ? state!.catchups : lCatchups.map((c) => ({ ...c, status: lCatchupReplies[c.id] ?? c.status }))), [mode, state, lCatchups, lCatchupReplies]);
  const unanswered =
    invites.filter((p) => !p.replies[me.id] && !p.replies[ME_ID]).length + catchups.filter((c) => c.to.id === me.id && c.status === "pending").length;

  const failed = (e: unknown) => setToast(e instanceof Error ? e.message : "Something went wrong");

  // ---- actions
  const setIntent = useCallback(
    (activityId: string, intent: PlanIntent) => {
      const next = intents[activityId] === intent ? null : intent;
      if (mode === "api") {
        api("/api/weekend/plans", { method: "PUT", json: { activity_id: activityId, intent: next } }).then(loadState).catch(failed);
      } else {
        setLIntents((m) => ({ ...m, [activityId]: next ?? undefined }));
      }
    },
    [mode, intents, loadState, setLIntents],
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
    [mode, peopleWithMe, me, now, loadState, setLPlans],
  );
  const removePlan = useCallback(
    (id: string) => {
      if (mode === "api") api(`/api/questival/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(loadState).catch(failed);
      else setLPlans((ps) => ps.filter((p) => p.id !== id));
    },
    [mode, loadState, setLPlans],
  );
  const replyPlan = useCallback(
    (planId: string, reply: "in" | "maybe") => {
      if (mode === "api") api("/api/questival/plans/reply", { method: "POST", json: { plan_id: planId, reply } }).then(loadState).catch(failed);
      else void planId, void reply;
    },
    [mode, loadState],
  );

  const saveProof = useCallback(
    async (input: SaveProofInput): Promise<SubmissionDTO> => {
      const quest = quests.find((q) => q.id === input.questId) ?? getQuest(input.questId);
      const members = [me, ...input.memberIds.map((id) => peopleWithMe.find((p) => p.id === id)).filter(Boolean)] as PersonDTO[];
      if (mode === "api") {
        const supabase = getSupabaseBrowser();
        if (!supabase) throw new Error("Storage isn't configured.");
        const media: { path: string; type: "image" | "video" }[] = [];
        let done = 0;
        for (const f of input.files) {
          const isVideo = f.type.startsWith("video/");
          const payload = isVideo ? f : (await shrinkImage(f)).blob;
          const contentType = isVideo ? f.type : "image/jpeg";
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
          idempotency_key: uid(),
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
        if (f.type.startsWith("video/")) media.push({ path: "", url: "", type: "video" as const });
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
    [mode, loadState, setLSubs],
  );
  const submitFinal = useCallback(() => {
    if (mode === "api") {
      api("/api/questival/final", { method: "POST" }).then(() => (setToast("Submitted"), loadState())).catch(failed);
    } else {
      setLFinal({ submitted_at: new Date(now).toISOString(), extension_used: questivalWindow(now) === "extension" });
    }
  }, [mode, now, loadState, setLFinal]);

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
    [mode, peopleWithMe, me, now, loadState, setLCatchups],
  );
  const replyCatchup = useCallback(
    (id: string, status: "accepted" | "declined") => {
      if (mode === "api") api("/api/catchups/reply", { method: "POST", json: { id, status } }).then(loadState).catch(failed);
      else setLCatchupReplies((m) => ({ ...m, [id]: status }));
    },
    [mode, loadState, setLCatchupReplies],
  );

  // Who's going: the API's answer, plus the hosts named on an activity
  // (real people, shown as going from day one). No sample faces.
  const whoMerged = useMemo<WhoAllResponse>(() => {
    const out: WhoAllResponse = {};
    for (const a of ACTIVITIES) {
      const going = [...(who[a.id]?.going ?? [])];
      for (const n of a.goingSeed ?? []) {
        const p = people.find((x) => x.name === n);
        if (p && !going.some((g) => g.id === p.id)) going.unshift(p);
      }
      if (mode === "local" && intents[a.id] === "going" && !going.some((g) => g.id === me.id)) going.push(me);
      if (a.required) {
        // Everyone's expected: the whole class is the head count.
        out[a.id] = { going: people, going_count: people.length, interested_count: 0 };
        continue;
      }
      out[a.id] = { going, going_count: Math.max(going.length, who[a.id]?.going_count ?? 0), interested_count: who[a.id]?.interested_count ?? 0 };
    }
    return out;
  }, [who, people, mode, intents, me]);

  const refreshRef = useRef(() => {});
  refreshRef.current = () => {
    loadState();
    loadCatalog();
  };

  const value: ForumStore = {
    enabled, questivalOpen, organizer, mode, localReason: mode === "api" ? null : localReason,
    now, me, people: peopleWithMe, quests, settings, who: whoMerged,
    intents, setIntent,
    plans, addPlan, removePlan,
    invites, replyPlan,
    submissions, saveProof, removeProof,
    final, submitFinal,
    catchups, requestCatchup, replyCatchup,
    unanswered, toast, setToast,
    refresh: () => refreshRef.current(),
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
