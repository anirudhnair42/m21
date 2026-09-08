// Build-time guard: this file holds gate logic and the service-role client;
// importing it from a client component fails the build.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { QUESTS, QUESTIVAL } from "@/lib/questival";
import type { ApiError, PersonDTO, QuestDTO, SettingsDTO } from "@/lib/questival-api";

/**
 * Shared server side of the weekend Forum: who is calling, may they in,
 * are they an organizer; plus the small joins every route needs (names and
 * photos by rsvp id, the merged quest catalog, the event settings).
 *
 * One implementation of the gate. /api/forum/access and every bearer route
 * under /api/questival, /api/weekend, /api/catchups go through resolveCaller.
 */

// ------------------------------------------------------------ responses

export const UUID_RE = /^[0-9a-f-]{36}$/i;

/** JSON with no-store: everything here is per-person or live. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

/** Thrown inside a handler to short-circuit with an ApiError body. */
export class ApiFailure extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: ApiError["code"],
  ) {
    super(message);
  }
  toResponse(): Response {
    const body: ApiError = { error: this.message };
    if (this.code) body.code = this.code;
    return json(body, { status: this.status });
  }
}

export function fail(status: number, error: string, code?: ApiError["code"]): never {
  throw new ApiFailure(status, error, code);
}

/**
 * Postgres "relation does not exist" (42P01), PostgREST's schema-cache
 * variant (PGRST205), or a missing storage bucket: sql/questival.sql has not
 * been run yet. Surfaced as a 503 the client can explain, not a crash.
 */
export function tablesMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return /relation .* does not exist/i.test(msg) || /could not find the table/i.test(msg) || /bucket not found/i.test(msg);
}

export const TABLES_MISSING: ApiError = { error: "Run sql/questival.sql in Supabase first.", code: "tables-missing" };

/**
 * Wraps a route handler: ApiFailure → its JSON; missing tables → 503;
 * anything else → 500 with a log line.
 */
export function handler<C = unknown>(fn: (request: NextRequest, ctx: C) => Promise<Response>) {
  return async (request: NextRequest, ctx: C): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      if (err instanceof ApiFailure) return err.toResponse();
      if (tablesMissing(err)) return json(TABLES_MISSING, { status: 503 });
      console.error(`${request.method} ${new URL(request.url).pathname} failed:`, err);
      const body: ApiError = { error: "Something went wrong on our side." };
      return json(body, { status: 500 });
    }
  };
}

/** Unwrap a supabase-js result, throwing the error so `handler` can map it. */
export function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return fail(400, "Expected a JSON body.", "bad-request");
  }
}

// ------------------------------------------------------------- the gate

/** Whitespace/accent/case-insensitive name key. */
function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
function firstLast(s: string): string {
  const parts = norm(s).split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] ?? "";
}
/** "Ani Nair" matches "Anirudh Nair": same last name, one first name a prefix of the other. */
export function sameName(a: string, b: string): boolean {
  const [af, al] = firstLast(a).split(" ");
  const [bf, bl] = firstLast(b).split(" ");
  if (!af || !bf || !al || !bl || al !== bl) return false;
  const short = af.length <= bf.length ? af : bf;
  const long = af.length <= bf.length ? bf : af;
  return short.length >= 3 && long.startsWith(short);
}
function inNames(names: string[], candidate: string): boolean {
  return !!candidate && names.some((n) => sameName(n, candidate));
}

const split = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** The env allowlists, read per request so a redeploy-free `vercel env` change is honored. */
export function gateLists() {
  return {
    testerEmails: split(process.env.FORUM_TESTERS).map((s) => s.toLowerCase()),
    testerNames: split(process.env.FORUM_TESTER_NAMES),
    organizerEmails: split(process.env.ORGANIZER_EMAILS).map((s) => s.toLowerCase()),
    open: process.env.FORUM_OPEN === "1",
  };
}

/** Local development only: FORUM_GATE=off skips Google. Ignored in production builds. */
export function gateOff(): boolean {
  return process.env.FORUM_GATE === "off" && process.env.NODE_ENV !== "production";
}

export type CallerRsvp = { id: string; name: string; photo_url: string | null; status: string };

export type Caller = {
  email: string;
  /** Google profile name, "" when absent. */
  googleName: string;
  /** Display name: RSVP name, else Google name, else the email's local part. */
  name: string;
  photoUrl: string | null;
  /** By verified email, or by name for a cohost on their other Google account. */
  rsvp: CallerRsvp | null;
  /** Found by email (the strict /api/me notion), as opposed to by name. */
  rsvpByEmail: boolean;
  allowed: boolean;
  organizer: boolean;
  tester: boolean;
  reason: "not-yet" | "no-rsvp" | null;
};

export type Resolved =
  | { ok: true; supabase: SupabaseClient; caller: Caller }
  | { ok: false; status: 401 | 503; reason: "unconfigured" | "anon" };

/**
 * Verify the Google bearer token and decide who this is.
 *
 * A cohost passes before launch if their email is in FORUM_TESTERS, or the
 * email on an RSVP whose name is in FORUM_TESTER_NAMES, or their Google
 * profile name matches a name in FORUM_TESTER_NAMES (classmates sign in with
 * a Gmail or a Minerva account interchangeably). FORUM_OPEN=1 admits every
 * confirmed RSVP. Organizers: testers, plus ORGANIZER_EMAILS.
 */
export async function resolveCaller(request: Request): Promise<Resolved> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, status: 503, reason: "unconfigured" };

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, reason: "anon" };

  const { data: userData, error } = await supabase.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase();
  if (error || !email) return { ok: false, status: 401, reason: "anon" };

  const { testerEmails, testerNames, organizerEmails, open } = gateLists();

  const { data: byEmail } = await supabase
    .from("rsvps")
    .select("id, name, photo_url, status")
    .eq("email", email)
    .in("status", ["paid", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let rsvp: CallerRsvp | null = (byEmail as CallerRsvp | null) ?? null;

  const meta = userData.user?.user_metadata ?? {};
  const googleName =
    (typeof meta.full_name === "string" && meta.full_name) || (typeof meta.name === "string" && meta.name) || "";

  const tester =
    testerEmails.includes(email) || inNames(testerNames, rsvp?.name ?? "") || inNames(testerNames, googleName);
  const allowed = tester || (open && rsvp !== null) || gateOff();
  const organizer = tester || organizerEmails.includes(email);
  // One line per check in the Vercel logs, so "why can't X get in" is answerable.
  console.log(
    `forum/access ${allowed ? "ALLOW" : "DENY"} email=${email} google="${googleName}" rsvp="${rsvp?.name ?? "-"}" testers=${testerEmails.length}/${testerNames.length} open=${open}`,
  );

  // A tester signing in with their non-RSVP account still gets their RSVP
  // row: look it up by name.
  const rsvpByEmail = rsvp !== null;
  if (allowed && !rsvp && googleName) {
    const { data: byName } = await supabase
      .from("rsvps")
      .select("id, name, photo_url, status")
      .in("status", ["paid", "processing"])
      .ilike("name", `${googleName.split(" ")[0]}%`)
      .limit(5);
    const hit = ((byName ?? []) as CallerRsvp[]).find((r) => sameName(r.name, googleName));
    if (hit) rsvp = hit;
  }

  let photoUrl: string | null = rsvp?.photo_url ?? null;
  if (!photoUrl && typeof meta.avatar_url === "string") photoUrl = meta.avatar_url;
  const name: string = rsvp?.name ?? googleName ?? email.split("@")[0];

  return {
    ok: true,
    supabase,
    caller: {
      email,
      googleName,
      name,
      photoUrl,
      rsvp,
      rsvpByEmail,
      allowed,
      organizer,
      tester,
      reason: allowed ? null : rsvpByEmail ? "not-yet" : "no-rsvp",
    },
  };
}

export type Authed = { supabase: SupabaseClient; caller: Caller; me: CallerRsvp };
export type MaybeAuthed = { supabase: SupabaseClient; caller: Caller; me: CallerRsvp | null };

/** Bearer routes: signed in and through the gate. `joined` also demands an RSVP row. */
export async function requireCaller(request: Request, opts: { joined: true }): Promise<Authed>;
export async function requireCaller(request: Request, opts?: { joined?: false }): Promise<MaybeAuthed>;
export async function requireCaller(request: Request, opts: { joined?: boolean } = {}): Promise<MaybeAuthed> {
  const r = await resolveCaller(request);
  if (!r.ok) {
    if (r.status === 503) fail(503, "Backend not configured.", "unconfigured");
    fail(401, "Sign in with Google first.", "unauthorized");
  }
  if (!r.caller.allowed) fail(403, "The Forum isn't open to you yet.", "forbidden");
  if (opts.joined && !r.caller.rsvp) fail(403, "You need a confirmed RSVP to do this.", "forbidden");
  return { supabase: r.supabase, caller: r.caller, me: r.caller.rsvp };
}

export async function requireOrganizer(request: Request): Promise<MaybeAuthed> {
  const a = await requireCaller(request);
  if (!a.caller.organizer) fail(403, "Organizers only.", "forbidden");
  return a;
}

/** Public routes that get richer with a bearer: null when anonymous or not allowed. */
export async function optionalCaller(request: Request): Promise<MaybeAuthed | null> {
  if (!request.headers.get("authorization")) return null;
  const r = await resolveCaller(request);
  if (!r.ok || !r.caller.allowed) return null;
  return { supabase: r.supabase, caller: r.caller, me: r.caller.rsvp };
}

// ------------------------------------------------------------- people

export const JOINED = ["paid", "processing"];

export function toPerson(row: { id: string; name: string; photo_url: string | null }): PersonDTO {
  return { id: row.id, name: row.name, photo_url: row.photo_url ?? null };
}

/** Names and photos for a set of rsvp ids, in one query. */
export async function personMap(supabase: SupabaseClient, ids: Iterable<string>): Promise<Map<string, PersonDTO>> {
  const unique = Array.from(new Set(ids)).filter((id) => UUID_RE.test(id));
  const map = new Map<string, PersonDTO>();
  if (unique.length === 0) return map;
  const rows = must(await supabase.from("rsvps").select("id, name, photo_url").in("id", unique)) as PersonDTO[];
  for (const r of rows ?? []) map.set(r.id, toPerson(r));
  return map;
}

/** A person from the map, or a placeholder so a deleted RSVP never 500s a feed. */
export function personOf(map: Map<string, PersonDTO>, id: string): PersonDTO {
  return map.get(id) ?? { id, name: "Someone", photo_url: null };
}

/** Which of these ids are confirmed RSVPs (paid or processing). */
export async function joinedIds(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(ids)).filter((id) => UUID_RE.test(id));
  if (unique.length === 0) return new Set();
  const rows = must(await supabase.from("rsvps").select("id").in("id", unique).in("status", JOINED)) as { id: string }[];
  return new Set((rows ?? []).map((r) => r.id));
}

// ------------------------------------------------------------- catalog

type QuestRow = {
  id: string;
  title: string;
  prompt: string;
  points: number;
  evidence: QuestDTO["evidence"];
  venue: string | null;
  address: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  repeat: number | null;
  bonus: string | null;
  tip: string | null;
  status: QuestDTO["status"];
};

/** Nullable columns become absent optionals, matching the static Quest shape. */
export function questFromRow(row: QuestRow): QuestDTO {
  const { id, title, prompt, points, evidence, status, ...rest } = row;
  const q: QuestDTO = { id, title, prompt, points, evidence, status, custom: true };
  for (const [k, v] of Object.entries(rest)) if (v !== null && v !== undefined) (q as Record<string, unknown>)[k] = v;
  return q;
}

/**
 * The static catalog with organizer rows layered on top. Non-organizers see
 * only live quests; organizers also get drafts and archived ones (to unarchive).
 */
export async function mergedCatalog(supabase: SupabaseClient, opts: { organizer?: boolean } = {}): Promise<QuestDTO[]> {
  const rows = must(await supabase.from("q_quests").select("*")) as QuestRow[];
  const overrides = new Map((rows ?? []).map((r) => [r.id, questFromRow(r)]));
  const out: QuestDTO[] = [];
  for (const q of QUESTS) {
    const o = overrides.get(q.id);
    if (o) overrides.delete(q.id);
    out.push(o ?? { ...q, status: "live", custom: false });
  }
  // Organizer-added quests, in creation order (id order is arbitrary but stable).
  for (const o of Array.from(overrides.values()).sort((a, b) => a.id.localeCompare(b.id))) out.push(o);
  return opts.organizer ? out : out.filter((q) => q.status === "live");
}

export function questMap(quests: QuestDTO[]): Map<string, QuestDTO> {
  return new Map(quests.map((q) => [q.id, q]));
}

// ------------------------------------------------------------ settings

type SettingsRow = {
  opens_at: string;
  due_at: string;
  extension_until: string;
  announcement: string | null;
  results_released_at: string | null;
  frozen_at: string | null;
};

/** The single q_settings row; falls back to the static constants if someone deleted it. */
export async function getSettings(supabase: SupabaseClient): Promise<SettingsDTO> {
  const row = must(
    await supabase
      .from("q_settings")
      .select("opens_at, due_at, extension_until, announcement, results_released_at, frozen_at")
      .eq("id", 1)
      .maybeSingle(),
  ) as SettingsRow | null;
  if (!row) {
    return {
      opens_at: new Date(QUESTIVAL.opensAt).toISOString(),
      due_at: new Date(QUESTIVAL.dueAt).toISOString(),
      extension_until: new Date(QUESTIVAL.extensionUntil).toISOString(),
      announcement: null,
      results_released_at: null,
      frozen_at: null,
    };
  }
  return {
    opens_at: new Date(row.opens_at).toISOString(),
    due_at: new Date(row.due_at).toISOString(),
    extension_until: new Date(row.extension_until).toISOString(),
    announcement: row.announcement ?? null,
    results_released_at: row.results_released_at ? new Date(row.results_released_at).toISOString() : null,
    frozen_at: row.frozen_at ? new Date(row.frozen_at).toISOString() : null,
  };
}

/** Where `now` falls relative to the event switches. */
export function windowAt(settings: SettingsDTO, now: number): "before" | "open" | "extension" | "closed" {
  if (now < Date.parse(settings.opens_at)) return "before";
  if (now < Date.parse(settings.due_at)) return "open";
  if (now < Date.parse(settings.extension_until)) return "extension";
  return "closed";
}

export const CLOSED_MESSAGE = "Closed — head to The Loft, go enjoy it.";

// --------------------------------------------------------------- media

export const MEDIA_BUCKET = "questival";

/** Public URL for a path in the `questival` bucket (public, unguessable paths). */
export function publicMediaUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
