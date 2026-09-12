import { cleanText, fail, handler, json, mergedCatalog, must, questFromRow, questMap, readJson, requireOrganizer } from "@/lib/forum-server";
import type { QuestDTO, UpsertQuestRequest } from "@/lib/questival-api";

const EVIDENCE = new Set<QuestDTO["evidence"]>(["photo", "video", "photo-pair", "text-photo", "screenshot"]);
const STATUS = new Set<QuestDTO["status"]>(["live", "draft", "archived"]);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

function slug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function text(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") fail(400, `${field} must be text.`, "bad-request");
  return cleanText(v, max);
}
function num(v: unknown, field: string): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) fail(400, `${field} must be a number.`, "bad-request");
  return v;
}

/**
 * Organizer upsert of one quest: a new id (slug from the title, made unique)
 * adds one; an existing id — static or custom — writes an override row on
 * top of the catalog. Fields not sent keep their current value.
 */
export const POST = handler(async (request) => {
  const { supabase, caller } = await requireOrganizer(request);
  const body = await readJson<UpsertQuestRequest>(request);
  const catalog = questMap(await mergedCatalog(supabase, { organizer: true }));

  let id = typeof body.id === "string" ? body.id.trim() : "";
  let current: QuestDTO | undefined;
  if (id) {
    if (!ID_RE.test(id)) fail(400, "id must be a lowercase slug.", "bad-request");
    current = catalog.get(id);
  } else {
    const title = text(body.title, "title", 80);
    if (!title) fail(400, "A new quest needs a title.", "bad-request");
    const base = slug(title) || "quest";
    id = base;
    for (let n = 2; catalog.has(id); n++) id = `${base}-${n}`;
  }

  const title = text(body.title, "title", 80) ?? current?.title ?? null;
  if (!title) fail(400, "title is required.", "bad-request");
  const prompt = text(body.prompt, "prompt", 500) ?? current?.prompt ?? "";
  const points = num(body.points, "points") ?? current?.points ?? null;
  if (points === null || !Number.isInteger(points) || points < 1 || points > 200) fail(400, "points must be 1–200.", "bad-request");
  const evidence = body.evidence ?? current?.evidence ?? "photo";
  if (!EVIDENCE.has(evidence)) fail(400, "Unknown evidence type.", "bad-request");
  const status = body.status ?? current?.status ?? "live";
  if (!STATUS.has(status)) fail(400, "status must be live, draft or archived.", "bad-request");
  const repeat = num(body.repeat, "repeat") ?? current?.repeat ?? null;
  if (repeat !== null && (!Number.isInteger(repeat) || repeat < 1 || repeat > 12)) fail(400, "repeat must be 1–12.", "bad-request");
  const lat = num(body.lat, "lat") ?? current?.lat ?? null;
  const lng = num(body.lng, "lng") ?? current?.lng ?? null;
  if (lat !== null && Math.abs(lat) > 90) fail(400, "bad lat", "bad-request");
  if (lng !== null && Math.abs(lng) > 180) fail(400, "bad lng", "bad-request");

  const row = {
    id,
    title,
    prompt,
    points,
    evidence,
    venue: text(body.venue, "venue", 120) ?? current?.venue ?? null,
    address: text(body.address, "address", 200) ?? current?.address ?? null,
    area: text(body.area, "area", 60) ?? current?.area ?? null,
    lat,
    lng,
    repeat,
    bonus: text(body.bonus, "bonus", 300) ?? current?.bonus ?? null,
    tip: text(body.tip, "tip", 300) ?? current?.tip ?? null,
    status,
    updated_at: new Date().toISOString(),
    updated_by: caller.email,
  };
  const saved = must(await supabase.from("q_quests").upsert(row, { onConflict: "id" }).select("*").single());
  return json(questFromRow(saved), { status: current ? 200 : 201 });
});

/** Archive a quest (hidden from the class; organizers can set it live again). */
export const DELETE = handler(async (request) => {
  const { supabase, caller } = await requireOrganizer(request);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) fail(400, "bad id", "bad-request");
  const current = questMap(await mergedCatalog(supabase, { organizer: true })).get(id);
  if (!current) fail(404, "Quest not found.");

  const row = { ...current, status: "archived", updated_at: new Date().toISOString(), updated_by: caller.email } as Record<string, unknown>;
  delete row.custom; // derived on read, not a column
  const saved = must(await supabase.from("q_quests").upsert(row, { onConflict: "id" }).select("*").single());
  return json(questFromRow(saved));
});
