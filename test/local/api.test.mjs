// Stress/contract tests for the weekend Forum API against the ISOLATED local
// stack (see test/local/README in the PR description): `next dev` on :3300 with
// FORUM_TEST_AUTH=1, PostgREST behind the proxy on :3002, Postgres on /tmp:5433.
//
//   corepack pnpm test:api
//
// Identity is the x-test-email / x-test-name seam (src/lib/forum-server.ts
// resolveCaller). The database is reset with psql at the start. Never points
// at production: BASE and PSQL are localhost only.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const BASE = process.env.API_BASE ?? "http://localhost:3300";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) throw new Error("api.test.mjs only runs against localhost");
const PSQL = process.env.PSQL_BIN ?? "/opt/homebrew/opt/postgresql@16/bin/psql";
const PSQL_ARGS = ["-h", "/tmp", "-p", "5433", "-U", "postgres", "-d", "m21test", "-At", "-v", "ON_ERROR_STOP=1"];

const ORG = "ani@test.local";
const PENDING = "user57@test.local";
const PROCESSING = "user53@test.local";

// ------------------------------------------------------------ helpers

function sql(q) {
  return execFileSync(PSQL, [...PSQL_ARGS, "-c", q], { encoding: "utf8" }).trim();
}
function sqlJson(q) {
  const out = sql(`select coalesce(json_agg(t), '[]'::json) from (${q}) t`);
  return JSON.parse(out || "[]");
}
const RESET_SQL =
  "truncate q_submissions, q_shift3, q_plans, q_plan_replies, plans, catchups, q_quests restart identity cascade; " +
  "update q_settings set announcement=null, results_released_at=null, frozen_at=null, opens_at='2026-09-12T10:00-07:00', due_at='2026-09-12T19:00-07:00', extension_until='2026-09-12T19:07-07:00';";
function resetDb() {
  sql(RESET_SQL);
}
/** Move the event window relative to now. Each arg is a Postgres interval string relative to now(). */
function setWindow({ opens = "-2 hours", due = "+2 hours", ext = "+3 hours" }) {
  sql(
    `update q_settings set opens_at = now() + interval '${opens}', due_at = now() + interval '${due}', extension_until = now() + interval '${ext}' where id = 1`,
  );
}

/**
 * call(method, path, { as, name, body, raw, auth, headers }) → { status, body }.
 * `as` is an email for the x-test-email seam; `name` sets x-test-name.
 */
async function call(method, path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (opts.as) headers["x-test-email"] = opts.as;
  if (opts.name) headers["x-test-name"] = opts.name;
  if (opts.auth) headers.authorization = "Bearer not-a-real-token";
  let body;
  if (opts.raw !== undefined) {
    headers["content-type"] = "application/json";
    body = opts.raw;
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(BASE + path, { method, headers, body });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { _raw: text };
  }
  return { status: res.status, body: parsed, headers: res.headers };
}
const get = (path, opts) => call("GET", path, opts);
const post = (path, body, opts) => call("POST", path, { ...opts, body });
const put = (path, body, opts) => call("PUT", path, { ...opts, body });
const patch = (path, body, opts) => call("PATCH", path, { ...opts, body });
const del = (path, opts) => call("DELETE", path, opts);

/** Deep scan: no email-shaped strings and no `email` keys anywhere (DTO whitelist). */
function assertNoEmails(obj, where) {
  const seen = [];
  (function walk(v, path) {
    if (typeof v === "string") {
      if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(v)) seen.push(`${path}=${v}`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (/email/i.test(k)) seen.push(`${path}.${k}`);
        walk(x, `${path}.${k}`);
      }
    }
  })(obj, where);
  assert.deepEqual(seen, [], `${where} leaks emails`);
}

const mediaPath = (userId, quest = "851", ext = "jpg") => `q/${quest}/${userId}/${randomUUID()}.${ext}`;
async function proof(email, userId, quest = "851", extra = {}) {
  return post(
    "/api/questival/submissions",
    { quest_id: quest, media: [{ path: mediaPath(userId, quest), type: "image" }], member_ids: [], idempotency_key: randomUUID(), ...extra },
    { as: email },
  );
}

// Seeded people, by email. Filled in `before`.
const people = new Map();
const idOf = (email) => {
  const p = people.get(email);
  if (!p) throw new Error(`no seed rsvp for ${email}`);
  return p.id;
};
const paid = (n) => `user${n}@test.local`; // user1..52 paid, 53..56 processing, 57..60 pending
const joinedCount = () => Array.from(people.values()).filter((p) => p.status === "paid" || p.status === "processing").length;

before(async () => {
  resetDb();
  // The seeded opens_at (Sat Sep 12) is in the future; proofs before it score 0,
  // so the suite runs with the window open and the window tests move it around.
  setWindow({});
  for (const r of sqlJson("select id, email, name, status from rsvps")) people.set(r.email, r);
  assert.ok(people.size >= 63, "seed rsvps present (run test/local/seed.mjs)");
  const ping = await get("/api/questival/catalog");
  assert.equal(ping.status, 200, "dev server on :3300 answers");
});
after(() => {
  resetDb();
});

// ============================================================ 1. intents

describe("intents: PUT/GET /api/weekend/plans", () => {
  const ACT = "sat-dinner";
  const users = Array.from({ length: 50 }, (_, i) => paid(i + 1));

  test("50 users set going in parallel; counts and faces follow", async () => {
    const rs = await Promise.all(users.map((u) => put("/api/weekend/plans", { activity_id: ACT, intent: "going" }, { as: u })));
    for (const r of rs) assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(rs[0].body, { activity_id: ACT, intent: "going" });

    const anon = await get(`/api/weekend/plans?activity=${ACT}`);
    assert.equal(anon.status, 200);
    assert.equal(anon.body.going_count, 50);
    assert.equal(anon.body.going.length, 50);
    assert.equal(anon.body.interested_count, 0);
    assertNoEmails(anon.body, "who");
    assert.deepEqual(Object.keys(anon.body.going[0]).sort(), ["id", "name", "photo_url"]);
  });

  test("toggle half to interested; anonymous gets counts only, bearer gets names", async () => {
    const half = users.slice(0, 25);
    const rs = await Promise.all(half.map((u) => put("/api/weekend/plans", { activity_id: ACT, intent: "interested" }, { as: u })));
    for (const r of rs) assert.equal(r.status, 200);
    const anon = await get(`/api/weekend/plans?activity=${ACT}`);
    assert.equal(anon.body.going_count, 25);
    assert.equal(anon.body.interested_count, 25);
    assert.deepEqual(anon.body.interested, [], "anonymous never sees interested names");
    const mine = await get(`/api/weekend/plans?activity=${ACT}`, { as: paid(30) });
    assert.equal(mine.body.interested.length, 25);
    assertNoEmails(mine.body, "who-bearer");
    const all = await get("/api/weekend/plans");
    assert.equal(all.status, 200);
    assert.equal(all.body[ACT].going_count, 25);
    assert.equal(all.body[ACT].interested_count, 25);
    assert.equal(all.body[ACT].going.length, 25);
    assert.equal(all.body[ACT].interested, undefined, "all-activities shape has no interested faces");
    const state = await get("/api/questival/state", { as: paid(1) });
    assert.equal(state.body.intents[ACT], "interested");
  });

  test("clear for everyone in parallel", async () => {
    const rs = await Promise.all(users.map((u) => put("/api/weekend/plans", { activity_id: ACT, intent: null }, { as: u })));
    for (const r of rs) assert.equal(r.status, 200);
    const anon = await get(`/api/weekend/plans?activity=${ACT}`);
    assert.equal(anon.body.going_count, 0);
    assert.equal(anon.body.interested_count, 0);
    const state = await get("/api/questival/state", { as: paid(1) });
    assert.deepEqual(state.body.intents, {});
  });

  test("invalid activity ids, intents and query params", async () => {
    for (const bad of ["nope", "SAT-DINNER", "", "sat dinner", "x".repeat(40)]) {
      const r = await put("/api/weekend/plans", { activity_id: bad, intent: "going" }, { as: paid(1) });
      assert.equal(r.status, 400, `activity ${JSON.stringify(bad)}`);
      assert.equal(r.body.code, "bad-request");
    }
    const r = await put("/api/weekend/plans", { activity_id: ACT, intent: "yes" }, { as: paid(1) });
    assert.equal(r.status, 400);
    const r2 = await put("/api/weekend/plans", { activity_id: 5, intent: "going" }, { as: paid(1) });
    assert.equal(r2.status, 400);
    const q = await get("/api/weekend/plans?activity=bad$id");
    assert.equal(q.status, 400);
    const q2 = await get("/api/weekend/plans?activity=unknown-but-valid");
    assert.equal(q2.status, 200);
    assert.equal(q2.body.going_count, 0);
  });

  test("pending RSVP and anonymous are rejected; processing is allowed", async () => {
    const p = await put("/api/weekend/plans", { activity_id: ACT, intent: "going" }, { as: PENDING });
    assert.equal(p.status, 403);
    assert.equal(p.body.code, "forbidden");
    const a = await put("/api/weekend/plans", { activity_id: ACT, intent: "going" });
    assert.equal(a.status, 401);
    assert.equal(a.body.code, "unauthorized");
    const ok = await put("/api/weekend/plans", { activity_id: ACT, intent: "going" }, { as: PROCESSING });
    assert.equal(ok.status, 200);
    await put("/api/weekend/plans", { activity_id: ACT, intent: null }, { as: PROCESSING });
  });
});

// ============================================================ 2. plan-it

describe("plan-it: /api/questival/plans", () => {
  const A = paid(1), B = paid(2), C = paid(3), D = paid(4);
  let planId;

  test("with_ids: unknown / pending rejected; self and duplicates dropped", async () => {
    const unknown = await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [idOf(B), randomUUID()] }, { as: A });
    assert.equal(unknown.status, 400);
    const pend = await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [idOf(PENDING)] }, { as: A });
    assert.equal(pend.status, 400);
    const many = Array.from({ length: 31 }, (_, i) => idOf(paid(i + 5)));
    const tooMany = await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: many }, { as: A });
    assert.equal(tooMany.status, 400);
    const thirty = await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: many.slice(0, 30) }, { as: A });
    assert.equal(thirty.status, 201);

    const r = await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [idOf(B), idOf(C), idOf(A), idOf(B), "not-a-uuid", 7] }, { as: A });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.owner.id, idOf(A));
    assert.deepEqual(r.body.with.map((p) => p.id), [idOf(B), idOf(C)]);
    assert.deepEqual(r.body.replies, {});
    assertNoEmails(r.body, "plan");
    planId = r.body.id;
  });

  test("kind/target validation", async () => {
    assert.equal((await post("/api/questival/plans", { kind: "quest", target_id: "nope", with_ids: [] }, { as: A })).status, 400);
    assert.equal((await post("/api/questival/plans", { kind: "activity", target_id: "nope", with_ids: [] }, { as: A })).status, 400);
    assert.equal((await post("/api/questival/plans", { kind: "x", target_id: "851", with_ids: [] }, { as: A })).status, 400);
    assert.equal((await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [] }, { as: PENDING })).status, 403);
    assert.equal((await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [] })).status, 401);
    const act = await post("/api/questival/plans", { kind: "activity", target_id: "sat-dinner", with_ids: [idOf(B)] }, { as: A });
    assert.equal(act.status, 201);
  });

  test("replies: invited yes, owner and stranger no", async () => {
    const inB = await post("/api/questival/plans/reply", { plan_id: planId, reply: "in" }, { as: B });
    assert.equal(inB.status, 200, JSON.stringify(inB.body));
    assert.equal(inB.body.replies[idOf(B)], "in");
    const maybeC = await post("/api/questival/plans/reply", { plan_id: planId, reply: "maybe" }, { as: C });
    assert.equal(maybeC.status, 200);
    assert.equal((await post("/api/questival/plans/reply", { plan_id: planId, reply: "in" }, { as: D })).status, 403);
    assert.equal((await post("/api/questival/plans/reply", { plan_id: planId, reply: "in" }, { as: A })).status, 403);
    assert.equal((await post("/api/questival/plans/reply", { plan_id: planId, reply: "yes" }, { as: B })).status, 400);
    assert.equal((await post("/api/questival/plans/reply", { plan_id: "junk", reply: "in" }, { as: B })).status, 400);
    assert.equal((await post("/api/questival/plans/reply", { plan_id: randomUUID(), reply: "in" }, { as: B })).status, 404);
  });

  test("concurrent replies to the same plan converge", async () => {
    const rs = await Promise.all(
      Array.from({ length: 10 }, (_, i) => post("/api/questival/plans/reply", { plan_id: planId, reply: i % 2 ? "in" : "maybe" }, { as: i % 3 ? B : C })),
    );
    for (const r of rs) assert.equal(r.status, 200);
    const st = await get("/api/questival/state", { as: A });
    const p = st.body.plans.find((x) => x.id === planId);
    assert.ok(p);
    assert.ok(["in", "maybe"].includes(p.replies[idOf(B)]));
    assert.ok(["in", "maybe"].includes(p.replies[idOf(C)]));
  });

  test("state shows plans for the owner and invites for the invited", async () => {
    const a = await get("/api/questival/state", { as: A });
    assert.deepEqual(a.body.plans.map((p) => [p.kind, p.target_id]).sort(), [["activity", "sat-dinner"], ["quest", "851"]]);
    assert.deepEqual(a.body.invites, []);
    const b = await get("/api/questival/state", { as: B });
    assert.deepEqual(b.body.plans, []);
    assert.equal(b.body.invites.length, 2);
    assert.ok(b.body.invites.some((p) => p.id === planId && p.replies[idOf(B)]));
    const d = await get("/api/questival/state", { as: D });
    assert.deepEqual(d.body.invites, []);
    assertNoEmails(a.body, "state");
  });

  test("planning the same target again replaces the old plan (one per owner/kind/target)", async () => {
    const r = await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [idOf(D)] }, { as: A });
    assert.equal(r.status, 201);
    assert.notEqual(r.body.id, planId);
    const a = await get("/api/questival/state", { as: A });
    const mine = a.body.plans.filter((p) => p.kind === "quest" && p.target_id === "851");
    assert.equal(mine.length, 1);
    assert.deepEqual(mine[0].with.map((p) => p.id), [idOf(D)]);
    assert.deepEqual(mine[0].replies, {}, "old replies do not carry over");
    const b = await get("/api/questival/state", { as: B });
    assert.ok(!b.body.invites.some((p) => p.target_id === "851"), "B is no longer invited");
    const d = await get("/api/questival/state", { as: D });
    assert.ok(d.body.invites.some((p) => p.id === r.body.id));
    assert.equal(sql(`select count(*) from q_plans where rsvp_id='${idOf(A)}' and kind='quest' and target_id='851'`), "1");
    planId = r.body.id;
  });

  test("five parallel double-taps still leave exactly one plan", async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => post("/api/questival/plans", { kind: "quest", target_id: "grace", with_ids: [] }, { as: C })));
    for (const r of rs) assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
    assert.equal(sql(`select count(*) from q_plans where rsvp_id='${idOf(C)}' and kind='quest' and target_id='grace'`), "1");
  });

  test("DELETE: stranger 404, owner 200, replies cascade", async () => {
    assert.equal((await del(`/api/questival/plans?id=${planId}`, { as: B })).status, 404);
    assert.equal((await del(`/api/questival/plans?id=junk`, { as: A })).status, 400);
    const ok = await del(`/api/questival/plans?id=${planId}`, { as: A });
    assert.equal(ok.status, 200);
    assert.equal((await del(`/api/questival/plans?id=${planId}`, { as: A })).status, 404);
    assert.equal(sql(`select count(*) from q_plan_replies where plan_id='${planId}'`), "0");
  });
});

// ============================================================ 3. catch-ups

describe("catch-ups: /api/catchups", () => {
  const A = paid(1), B = paid(2), C = paid(3);
  let id;

  test("validation: self, pending, unknown, bad slot", async () => {
    assert.equal((await post("/api/catchups", { to_id: idOf(A), slot: "sat-1330" }, { as: A })).status, 400);
    assert.equal((await post("/api/catchups", { to_id: idOf(PENDING), slot: "sat-1330" }, { as: A })).status, 400);
    assert.equal((await post("/api/catchups", { to_id: randomUUID(), slot: "sat-1330" }, { as: A })).status, 400);
    assert.equal((await post("/api/catchups", { to_id: idOf(B), slot: "nope-9999" }, { as: A })).status, 400);
    assert.equal((await post("/api/catchups", { to_id: idOf(B), slot: "" }, { as: A })).status, 400);
    assert.equal((await post("/api/catchups", { to_id: idOf(B), slot: "sat-1330" }, { as: PENDING })).status, 403);
    assert.equal((await post("/api/catchups", { to_id: idOf(B), slot: "sat-1330" })).status, 401);
  });

  test("create, then a second open ask in either direction is a 409", async () => {
    const r = await post("/api/catchups", { to_id: idOf(B), slot: "sat-1330", note: "  coffee? " + "x".repeat(400) }, { as: A });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.status, "pending");
    assert.equal(r.body.from.id, idOf(A));
    assert.equal(r.body.to.id, idOf(B));
    assert.equal(r.body.note.length, 280);
    assertNoEmails(r.body, "catchup");
    id = r.body.id;
    assert.equal((await post("/api/catchups", { to_id: idOf(B), slot: "sat-1600" }, { as: A })).status, 409);
    assert.equal((await post("/api/catchups", { to_id: idOf(A), slot: "sat-1600" }, { as: B })).status, 409);
    assert.equal((await post("/api/catchups", { to_id: idOf(C), slot: "sat-1600" }, { as: A })).status, 201, "a different person is fine");
  });

  test("reply: only `to` may answer", async () => {
    assert.equal((await post("/api/catchups/reply", { id, status: "accepted" }, { as: A })).status, 403);
    assert.equal((await post("/api/catchups/reply", { id, status: "accepted" }, { as: C })).status, 403);
    assert.equal((await post("/api/catchups/reply", { id, status: "maybe" }, { as: B })).status, 400);
    assert.equal((await post("/api/catchups/reply", { id: "x", status: "accepted" }, { as: B })).status, 400);
    assert.equal((await post("/api/catchups/reply", { id: randomUUID(), status: "accepted" }, { as: B })).status, 404);
    const ok = await post("/api/catchups/reply", { id, status: "accepted" }, { as: B });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, "accepted");
    assert.equal((await post("/api/catchups", { to_id: idOf(B), slot: "sun-1200" }, { as: A })).status, 201, "once answered, a new ask is allowed");
  });

  test("state shows both directions", async () => {
    const a = await get("/api/questival/state", { as: A });
    assert.equal(a.body.catchups.length, 3);
    const b = await get("/api/questival/state", { as: B });
    assert.equal(b.body.catchups.length, 2);
    assert.ok(b.body.catchups.some((c) => c.id === id && c.status === "accepted"));
    const c = await get("/api/questival/state", { as: C });
    assert.equal(c.body.catchups.length, 1);
    assert.equal(c.body.catchups[0].to.id, idOf(C));
  });
});

// ============================================================ 4. submissions

describe("submissions: upload-url, POST/DELETE/PATCH", () => {
  const A = paid(1), B = paid(2), C = paid(3);
  let subId;

  test("upload-url validation", async () => {
    const ok = await post("/api/questival/upload-url", { quest_id: "851", content_type: "image/JPEG", size: 1234 }, { as: A });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.match(ok.body.path, new RegExp(`^q/851/${idOf(A)}/[0-9a-f-]{36}\\.jpg$`));
    assert.ok(ok.body.url && ok.body.token);
    const mov = await post("/api/questival/upload-url", { quest_id: "851", content_type: "video/quicktime", size: 40 * 1024 * 1024 }, { as: A });
    assert.equal(mov.status, 200);
    assert.match(mov.body.path, /\.mov$/);
    for (const [body, why] of [
      [{ quest_id: "851", content_type: "image/gif", size: 10 }, "gif"],
      [{ quest_id: "851", content_type: "image/jpeg", size: 0 }, "size 0"],
      [{ quest_id: "851", content_type: "image/jpeg", size: 50 * 1024 * 1024 + 1 }, "too big"],
      [{ quest_id: "851", content_type: "image/jpeg", size: "100" }, "size string"],
      [{ quest_id: "851", content_type: "image/jpeg" }, "no size"],
      [{ quest_id: "nope", content_type: "image/jpeg", size: 10 }, "unknown quest"],
      [{ content_type: "image/jpeg", size: 10 }, "no quest"],
    ]) {
      const r = await post("/api/questival/upload-url", body, { as: A });
      assert.equal(r.status, 400, why);
    }
    assert.equal((await post("/api/questival/upload-url", { quest_id: "851", content_type: "image/jpeg", size: 1 }, { as: PENDING })).status, 403);
    assert.equal((await post("/api/questival/upload-url", { quest_id: "851", content_type: "image/jpeg", size: 1 })).status, 401);
  });

  test("media ownership, count, tags, quest, instance", async () => {
    const me = idOf(A);
    const bad = async (extra, why, quest = "851") => {
      const r = await post(
        "/api/questival/submissions",
        { quest_id: quest, media: [{ path: mediaPath(me, quest), type: "image" }], member_ids: [], idempotency_key: randomUUID(), ...extra },
        { as: A },
      );
      assert.equal(r.status, 400, `${why}: ${JSON.stringify(r.body)}`);
    };
    await bad({ media: [{ path: mediaPath(idOf(B)), type: "image" }] }, "someone else's prefix");
    await bad({ media: [{ path: `q/851/${me}/../${idOf(B)}/x.jpg`, type: "image" }] }, "traversal");
    await bad({ media: [{ path: mediaPath(me, "grace"), type: "image" }] }, "another quest's prefix");
    await bad({ media: [{ path: `photos/${me}/x.jpg`, type: "image" }] }, "another bucket prefix");
    await bad({ media: [{ path: mediaPath(me), type: "gif" }] }, "bad media type");
    await bad({ media: [] }, "0 media");
    await bad({ media: Array.from({ length: 7 }, () => ({ path: mediaPath(me), type: "image" })) }, "7 media");
    await bad({ member_ids: [idOf(PENDING)] }, "pending tag");
    await bad({ member_ids: [randomUUID()] }, "unknown tag");
    await bad({ member_ids: Array.from({ length: 31 }, (_, i) => idOf(paid(i + 5))) }, "31 tags");
    await bad({ quest_id: "nope" }, "unknown quest");
    await bad({ instance: 2 }, "instance beyond single");
    await bad({ instance: 0 }, "instance 0");
    await bad({ instance: 6 }, "instance beyond repeat", "parks");
    await bad({ instance: 1.5 }, "fractional instance", "parks");
    await bad({ idempotency_key: "" }, "empty key");
    await bad({ idempotency_key: 5 }, "non-string key");

    const six = await post(
      "/api/questival/submissions",
      { quest_id: "851", media: Array.from({ length: 6 }, () => ({ path: mediaPath(me), type: "image" })), member_ids: [me, idOf(B), idOf(B)], caption: " hi ", idempotency_key: randomUUID() },
      { as: A },
    );
    assert.equal(six.status, 201, JSON.stringify(six.body));
    assert.equal(six.body.media.length, 6);
    assert.ok(six.body.media[0].url.includes(six.body.media[0].path));
    assert.deepEqual(six.body.members.map((p) => p.id), [me, idOf(B)], "self de-duplicated, uploader first");
    assert.equal(six.body.caption, "hi");
    assert.equal(six.body.status, "approved");
    assert.equal(six.body.points, 15);
    assertNoEmails(six.body, "submission");
    subId = six.body.id;

    const parks5 = await proof(A, me, "parks", { instance: 5 });
    assert.equal(parks5.status, 201);
    assert.equal(parks5.body.instance, 5);
    assert.equal((await proof(PENDING, idOf(PENDING))).status, 403);
    assert.equal((await post("/api/questival/submissions", {})).status, 401);
  });

  test("idempotency: same key returns the same row, scoped to the uploader", async () => {
    const key = "retry-" + randomUUID();
    const first = await proof(A, idOf(A), "851", { idempotency_key: key, caption: "one" });
    assert.equal(first.status, 201);
    const again = await proof(A, idOf(A), "851", { idempotency_key: key, caption: "one" });
    assert.equal(again.status, 200);
    assert.equal(again.body.id, first.body.id);
    const different = await proof(A, idOf(A), "grace", { idempotency_key: key, caption: "two" });
    assert.equal(different.status, 200, "same key, different body: the first row wins");
    assert.equal(different.body.id, first.body.id);
    assert.equal(different.body.quest_id, "851");
    const other = await proof(B, idOf(B), "grace", { idempotency_key: key });
    assert.equal(other.status, 201, "another uploader with the same key gets their own row");
    assert.notEqual(other.body.id, first.body.id);
    assert.equal(other.body.uploader.id, idOf(B));
  });

  test("20 parallel posts with one key yield one row", async () => {
    const key = "burst-" + randomUUID();
    const rs = await Promise.all(Array.from({ length: 20 }, () => proof(C, idOf(C), "grace", { idempotency_key: key })));
    const ids = new Set();
    for (const r of rs) {
      assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r.body));
      ids.add(r.body.id);
    }
    assert.equal(ids.size, 1);
    assert.equal(sql(`select count(*) from q_submissions where idempotency_key='${idOf(C)}:${key}'`), "1");
  });

  test("windows: after extension_until is closed; before opens_at still saves (worth 0 until then)", async () => {
    try {
      setWindow({ opens: "-3 hours", due: "-2 hours", ext: "-1 hours" });
      const closed = await proof(A, idOf(A));
      assert.equal(closed.status, 403);
      assert.equal(closed.body.code, "closed");
      const delClosed = await del(`/api/questival/submissions?id=${subId}`, { as: A });
      assert.equal(delClosed.status, 403);
      assert.equal(delClosed.body.code, "closed");
      setWindow({ opens: "+1 hours", due: "+2 hours", ext: "+3 hours" });
      const early = await proof(A, idOf(A));
      assert.equal(early.status, 201, "client copy: 'Saving works now; scoring opens Sat 10:00'");
      assert.equal(early.body.points, 0);
      assert.equal((await del(`/api/questival/submissions?id=${early.body.id}`, { as: A })).status, 200, "and can be removed before opening");
    } finally {
      setWindow({});
    }
  });

  test("DELETE: tagged member 403, stranger 403, uploader 200", async () => {
    assert.equal((await del(`/api/questival/submissions?id=${subId}`, { as: B })).status, 403);
    assert.equal((await del(`/api/questival/submissions?id=${subId}`, { as: C })).status, 403);
    assert.equal((await del(`/api/questival/submissions?id=nope`, { as: A })).status, 400);
    assert.equal((await del(`/api/questival/submissions?id=${randomUUID()}`, { as: A })).status, 404);
    const ok = await del(`/api/questival/submissions?id=${subId}`, { as: A });
    assert.equal(ok.status, 200);
    assert.equal((await del(`/api/questival/submissions?id=${subId}`, { as: A })).status, 404);
  });

  test("PATCH review: organizer only; reject and restore, no re-pricing", async () => {
    const r = await proof(A, idOf(A), "851");
    const id = r.body.id;
    assert.equal((await patch(`/api/questival/submissions/${id}`, { status: "rejected" }, { as: A })).status, 403);
    assert.equal((await patch(`/api/questival/submissions/${id}`, { status: "rejected" })).status, 401);
    assert.equal((await patch(`/api/questival/submissions/${id}`, { status: "meh" }, { as: ORG })).status, 400);
    assert.equal((await patch(`/api/questival/submissions/${id}`, {}, { as: ORG })).status, 400, "status is required now");
    assert.equal((await patch(`/api/questival/submissions/nope`, { status: "rejected" }, { as: ORG })).status, 400);
    assert.equal((await patch(`/api/questival/submissions/${randomUUID()}`, { status: "rejected" }, { as: ORG })).status, 404);

    const rej = await patch(`/api/questival/submissions/${id}`, { status: "rejected" }, { as: ORG });
    assert.equal(rej.status, 200, JSON.stringify(rej.body));
    assert.equal(rej.body.status, "rejected");
    assert.equal(rej.body.points, 0, "a rejected proof is worth nothing");
    const back = await patch(`/api/questival/submissions/${id}`, { status: "approved" }, { as: ORG });
    assert.equal(back.body.points, 15, "restored at the quest's catalog value");
    assert.equal(sql(`select reviewed_by from q_submissions where id='${id}'`), ORG);

    // points_override is retired but the column survives: a value left behind
    // there (or written by an older build) must not re-price the proof.
    sql(`update q_submissions set points_override=99, review_note='stale' where id='${id}'`);
    const st = await get("/api/questival/state", { as: A });
    const mine = st.body.submissions.find((x) => x.id === id);
    assert.equal(mine.points, 15, "a leftover points_override is ignored");
    assert.equal(mine.review_note, undefined, "review_note is no longer part of the DTO");
    assertNoEmails(st.body, "state-after-review");
  });
});

// ============================================================ 5. Shift 3

describe("shift3: POST/DELETE /api/questival/shift3", () => {
  const A = paid(30), B = paid(31), C = paid(32);

  before(() => {
    sql("truncate q_submissions restart identity cascade");
    setWindow({});
  });

  test("a heart is +1 for everyone on the proof, and giving twice is one point", async () => {
    const r = await proof(A, idOf(A), "851", { member_ids: [idOf(B)] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const id = r.body.id;

    const given = await post(`/api/questival/shift3?id=${id}`, undefined, { as: C });
    assert.equal(given.status, 200, JSON.stringify(given.body));
    assert.deepEqual([given.body.shift3, given.body.shift3_by_me], [1, true]);
    const again = await post(`/api/questival/shift3?id=${id}`, undefined, { as: C });
    assert.deepEqual([again.body.shift3, again.body.shift3_by_me], [1, true], "idempotent, not a second point");
    assert.equal(sql(`select count(*) from q_shift3 where submission_id='${id}'`), "1");

    const board = await get("/api/questival/board", { as: A });
    const row = (e) => board.body.rows.find((x) => x.person.id === idOf(e));
    assert.deepEqual([row(A).points, row(A).shift3], [16, 1], "15 for the quest, 1 for the heart");
    assert.deepEqual([row(B).points, row(B).shift3], [16, 1], "everyone tagged gets the heart too");

    const back = await del(`/api/questival/shift3?id=${id}`, { as: C });
    assert.equal(back.status, 200);
    assert.deepEqual([back.body.shift3, back.body.shift3_by_me], [0, false]);
    assert.equal(sql(`select count(*) from q_shift3 where submission_id='${id}'`), "0");
    await del(`/api/questival/submissions?id=${id}`, { as: A });
  });

  test("you can't heart a proof you're credited on, and it needs a confirmed RSVP", async () => {
    const r = await proof(A, idOf(A), "grace", { member_ids: [idOf(B)] });
    const id = r.body.id;
    assert.equal((await post(`/api/questival/shift3?id=${id}`, undefined, { as: A })).status, 403, "the uploader");
    assert.equal((await post(`/api/questival/shift3?id=${id}`, undefined, { as: B })).status, 403, "a tagged member");
    assert.equal((await post(`/api/questival/shift3?id=${id}`, undefined, { as: PENDING })).status, 403);
    assert.equal((await post(`/api/questival/shift3?id=${id}`)).status, 401);
    assert.equal((await post("/api/questival/shift3?id=nope", undefined, { as: C })).status, 400);
    assert.equal((await post(`/api/questival/shift3?id=${randomUUID()}`, undefined, { as: C })).status, 404);
    await del(`/api/questival/submissions?id=${id}`, { as: A });
  });

  test("hearts on a second proof of the same quest still count", async () => {
    sql("truncate q_submissions restart identity cascade");
    const one = await proof(A, idOf(A), "851");
    const two = await proof(A, idOf(A), "851");
    assert.equal((await post(`/api/questival/shift3?id=${one.body.id}`, undefined, { as: B })).status, 200);
    assert.equal((await post(`/api/questival/shift3?id=${two.body.id}`, undefined, { as: C })).status, 200);
    const board = await get("/api/questival/board", { as: A });
    const a = board.body.rows.find((x) => x.person.id === idOf(A));
    // The quest scores once (best per instance), but both hearts land: the
    // Shift 3 tally sits outside the best-per-quest rule.
    assert.deepEqual([a.points, a.shift3, a.completed], [17, 2, 1]);
  });

  test("parallel hearts from different people all land exactly once", async () => {
    sql("truncate q_submissions restart identity cascade");
    const r = await proof(A, idOf(A), "coolbrith");
    const givers = Array.from({ length: 8 }, (_, i) => paid(40 + i));
    const rs = await Promise.all(givers.map((g) => post(`/api/questival/shift3?id=${r.body.id}`, undefined, { as: g })));
    for (const x of rs) assert.equal(x.status, 200, JSON.stringify(x.body));
    assert.equal(sql(`select count(*) from q_shift3 where submission_id='${r.body.id}'`), "8");
    const board = await get("/api/questival/board", { as: A });
    const a = board.body.rows.find((x) => x.person.id === idOf(A));
    assert.deepEqual([a.points, a.shift3], [18, 8], "10 for the quest plus 8 hearts");
  });

  test("once the window closes, no more hearts", async () => {
    const r = await proof(A, idOf(A), "saigon");
    setWindow({ opens: "-3 hours", due: "-2 hours", ext: "-1 hours" });
    const late = await post(`/api/questival/shift3?id=${r.body.id}`, undefined, { as: C });
    assert.equal(late.status, 403);
    assert.equal(late.body.code, "closed");
    setWindow({});
  });
});

// ============================================================ 6. feed + board

describe("feed and board", () => {
  const A = paid(20), B = paid(21), C = paid(22);

  before(() => {
    sql("truncate q_submissions restart identity cascade; update q_settings set frozen_at=null, results_released_at=null");
    setWindow({});
  });

  test("derived points: best per (quest, instance), repeat caps, tags credited, ties 1-1-3", async () => {
    const a1 = await proof(A, idOf(A), "851", { member_ids: [idOf(B)] });
    const a2 = await proof(A, idOf(A), "851", { member_ids: [idOf(B)] }); // duplicate quest, counts once
    const a3 = await proof(A, idOf(A), "grace", { member_ids: [idOf(B)] });
    const c1 = await proof(C, idOf(C), "parks", { instance: 1 });
    for (const r of [a1, a2, a3, c1]) assert.equal(r.status, 201, JSON.stringify(r.body));

    const board = await get("/api/questival/board", { as: A });
    assert.equal(board.status, 200);
    assert.equal(board.body.frozen, false);
    assert.equal(board.body.rows.length, joinedCount(), "everyone confirmed is listed");
    assertNoEmails(board.body, "board");
    const row = (email) => board.body.rows.find((r) => r.person.id === idOf(email));
    assert.deepEqual([row(A).points, row(A).completed, row(A).rank], [30, 2, 1]);
    assert.deepEqual([row(B).points, row(B).completed, row(B).rank], [30, 2, 1]);
    assert.deepEqual([row(C).points, row(C).completed, row(C).rank], [5, 1, 3]);
    assert.equal(board.body.rows[0].rank, 1);
    assert.equal(board.body.rows[3].rank, 4);
    assert.equal(board.body.rows[3].points, 0);

    // repeat cap: parks instances 2..5 count, a 6th can't be created; same instance twice counts once
    for (const i of [2, 3, 4, 5]) assert.equal((await proof(C, idOf(C), "parks", { instance: i })).status, 201);
    assert.equal((await proof(C, idOf(C), "parks", { instance: 3 })).status, 201);
    let b2 = await get("/api/questival/board", { as: A });
    let c = b2.body.rows.find((r) => r.person.id === idOf(C));
    assert.deepEqual([c.points, c.completed], [25, 5]);

    // rejected = 0, and everyone in members is credited
    assert.equal((await patch(`/api/questival/submissions/${a3.body.id}`, { status: "rejected" }, { as: ORG })).status, 200);
    b2 = await get("/api/questival/board", { as: A });
    const a = b2.body.rows.find((r) => r.person.id === idOf(A));
    const bb = b2.body.rows.find((r) => r.person.id === idOf(B));
    assert.deepEqual([a.points, a.completed, a.rank], [15, 1, 2], "grace is gone; the duplicate 851 still counts once");
    assert.deepEqual([bb.points, bb.completed, bb.rank], [15, 1, 2], "a tagged member tracks the uploader");
    c = b2.body.rows.find((r) => r.person.id === idOf(C));
    assert.deepEqual([c.points, c.completed, c.rank], [25, 5, 1], "C leads on parks");
    assert.equal(a.shift3, 0, "no hearts given in this block");

    const feed = await get("/api/questival/feed", { as: B });
    assert.ok(!feed.body.items.some((s) => s.id === a3.body.id), "rejected proofs are not in the feed");
    assert.equal((await get("/api/questival/board")).status, 401);
    assert.equal((await get("/api/questival/feed")).status, 401);
    assert.equal((await get("/api/questival/board", { as: PENDING })).status, 403);
  });

  test("feed pagination: 40 parallel proofs, two pages, no gaps or duplicates, no emails", async () => {
    sql("truncate q_submissions restart identity cascade");
    const posters = Array.from({ length: 40 }, (_, i) => paid(1 + (i % 40)));
    const rs = await Promise.all(posters.map((u, i) => proof(u, idOf(u), i % 2 ? "851" : "grace", { caption: `proof ${i}` })));
    for (const r of rs) assert.equal(r.status, 201, JSON.stringify(r.body));
    const all = new Set(rs.map((r) => r.body.id));
    assert.equal(all.size, 40);

    const p1 = await get("/api/questival/feed", { as: A });
    assert.equal(p1.status, 200);
    assert.equal(p1.body.items.length, 30);
    assert.ok(p1.body.next_cursor);
    assertNoEmails(p1.body, "feed");
    const p2 = await get(`/api/questival/feed?cursor=${encodeURIComponent(p1.body.next_cursor)}`, { as: A });
    assert.equal(p2.status, 200, JSON.stringify(p2.body));
    assert.equal(p2.body.items.length, 10);
    assert.equal(p2.body.next_cursor, null);
    const seen = [...p1.body.items, ...p2.body.items].map((s) => s.id);
    assert.equal(new Set(seen).size, 40, "no duplicates across pages");
    assert.deepEqual([...new Set(seen)].sort(), [...all].sort(), "no gaps across pages");
    const ts = [...p1.body.items, ...p2.body.items].map((s) => Date.parse(s.created_at));
    for (let i = 1; i < ts.length; i++) assert.ok(ts[i - 1] >= ts[i], "newest first");

    const legacy = await get(`/api/questival/feed?cursor=${encodeURIComponent(p1.body.items[29].created_at)}`, { as: A });
    assert.equal(legacy.status, 200, "a bare timestamp cursor still works");
    assert.equal((await get("/api/questival/feed?cursor=garbage", { as: A })).status, 400);
    assert.equal((await get("/api/questival/feed?cursor=eyJ0IjoieCIsImlkIjoieSJ9", { as: A })).status, 400);
  });

  test("shift3_by_me is per-caller; reviewer columns never reach the client", async () => {
    const r = await proof(A, idOf(A), "landmark", { member_ids: [idOf(B)] });
    assert.equal(r.status, 201);
    assert.equal((await post(`/api/questival/shift3?id=${r.body.id}`, undefined, { as: C })).status, 200);
    const find = (res) => (res.body.items ?? res.body.submissions).find((s) => s.id === r.body.id);

    const giver = find(await get("/api/questival/feed", { as: C }));
    assert.deepEqual([giver.shift3, giver.shift3_by_me], [1, true], "the giver sees their own heart");
    const stranger = find(await get("/api/questival/feed", { as: paid(23) }));
    assert.deepEqual([stranger.shift3, stranger.shift3_by_me], [1, false], "someone else sees the count, not the flag");
    assert.equal(find(await get("/api/questival/state", { as: B })).shift3, 1, "a tagged member sees it on their list");
    assert.equal(find(await get("/api/questival/admin/review", { as: ORG })).shift3, 1);

    sql(`update q_submissions set review_note='stale', points_override=77 where id='${r.body.id}'`);
    for (const res of [await get("/api/questival/feed", { as: C }), await get("/api/questival/board", { as: C })]) {
      assert.ok(!JSON.stringify(res.body).includes("stale"));
      assert.ok(!JSON.stringify(res.body).includes("reviewed_by"));
      assert.ok(!JSON.stringify(res.body).includes("points_override"));
    }
    await del(`/api/questival/submissions?id=${r.body.id}`, { as: A });
  });

  test("proofs landed before opens_at are saved but score 0 and stay off the feed and board", async () => {
    const pts = async (email) => (await get("/api/questival/board", { as: email })).body.rows.find((x) => x.person.id === idOf(email)).points;
    const before = await pts(A);
    assert.ok(before > 0);
    let early;
    try {
      setWindow({ opens: "+1 hours", due: "+2 hours", ext: "+3 hours" });
      early = await proof(A, idOf(A), "corona");
      assert.equal(early.status, 201, JSON.stringify(early.body));
      assert.equal(early.body.points, 0, "worth nothing yet");
      // The rule is derived from opens_at: with it in the future, nothing scores yet.
      assert.equal(await pts(A), 0);
      const board = await get("/api/questival/board", { as: A });
      assert.ok(board.body.rows.every((r) => r.points === 0 && r.completed === 0));
      assert.equal((await get("/api/questival/feed", { as: B })).body.items.length, 0, "the live feed is empty before opens_at");
      const st = await get("/api/questival/state", { as: A });
      assert.equal(st.body.submissions.find((s) => s.id === early.body.id).points, 0, "in my list, at 0");
    } finally {
      setWindow({});
    }
    // ...and once opens_at is behind the proof again, it counts like any other.
    assert.equal(await pts(A), before + 20);
    assert.ok((await get("/api/questival/feed", { as: B })).body.items.some((s) => s.id === early.body.id));
    await del(`/api/questival/submissions?id=${early.body.id}`, { as: A });
  });

  test("frozen board: only proofs before frozen_at count", async () => {
    const before = await get("/api/questival/board", { as: A });
    const pts = (b, email) => b.body.rows.find((r) => r.person.id === idOf(email)).points;
    const rel = await post("/api/questival/admin/settings", { release_results: true }, { as: ORG });
    assert.equal(rel.status, 200, JSON.stringify(rel.body));
    assert.ok(rel.body.frozen_at && rel.body.results_released_at);
    await new Promise((r) => setTimeout(r, 20));
    const late = await proof(A, idOf(A), "corona");
    assert.equal(late.status, 201, "proofs still land after the freeze (they just don't count)");
    const after = await get("/api/questival/board", { as: A });
    assert.equal(after.body.frozen, true);
    assert.equal(pts(after, A), pts(before, A));
    const st = await get("/api/questival/state", { as: A });
    assert.ok(st.body.submissions.some((s) => s.id === late.body.id), "my state still shows it");
    sql("update q_settings set frozen_at=null, results_released_at=null");
    const thawed = await get("/api/questival/board", { as: A });
    assert.equal(thawed.body.frozen, false);
    assert.equal(pts(thawed, A), pts(before, A) + 20);
  });
});

// ============================================================ 7. admin

describe("admin", () => {
  const U = paid(30);
  before(() => setWindow({}));

  test("every admin route: 401 anonymous, 403 non-organizer", async () => {
    const routes = [
      ["GET", "/api/questival/admin/people"],
      ["GET", "/api/questival/admin/review"],
      ["POST", "/api/questival/admin/quests", { title: "x", points: 1 }],
      ["DELETE", "/api/questival/admin/quests?id=851"],
      ["POST", "/api/questival/admin/settings", {}],
      ["PATCH", `/api/questival/submissions/${randomUUID()}`, {}],
    ];
    for (const [m, p, body] of routes) {
      const anon = await call(m, p, { body });
      assert.equal(anon.status, 401, `${m} ${p} anon`);
      assert.equal(anon.body.code, "unauthorized");
      const user = await call(m, p, { body, as: U });
      assert.equal(user.status, 403, `${m} ${p} user`);
      assert.equal(user.body.code, "forbidden");
      const pend = await call(m, p, { body, as: PENDING });
      assert.equal(pend.status, 403, `${m} ${p} pending`);
    }
  });

  test("quests upsert validation", async () => {
    const bad = async (body, why) => {
      const r = await post("/api/questival/admin/quests", body, { as: ORG });
      assert.equal(r.status, 400, `${why}: ${JSON.stringify(r.body)}`);
    };
    await bad({ points: 10 }, "no title");
    await bad({ title: "   ", points: 10 }, "blank title");
    await bad({ title: "T", points: 0 }, "points 0");
    await bad({ title: "T", points: 201 }, "points 201");
    await bad({ title: "T", points: 10.5 }, "points fractional");
    await bad({ title: "T", points: "10" }, "points string");
    await bad({ title: "T" }, "points missing for new");
    await bad({ title: "T", points: 10, evidence: "gif" }, "evidence enum");
    await bad({ title: "T", points: 10, status: "gone" }, "status enum");
    await bad({ title: "T", points: 10, repeat: 13 }, "repeat 13");
    await bad({ title: "T", points: 10, repeat: 0 }, "repeat 0");
    await bad({ title: "T", points: 10, lat: 91 }, "lat");
    await bad({ title: "T", points: 10, lng: -181 }, "lng");
    await bad({ title: "T", points: 10, venue: 5 }, "venue type");
    await bad({ id: "BAD ID", title: "T", points: 10 }, "id shape");
    await bad({ id: "x".repeat(41), title: "T", points: 10 }, "id length");
  });

  test("slug generation and collisions; override of a static quest", async () => {
    const one = await post("/api/questival/admin/quests", { title: "  Café ☕ Crawl!  ", points: 10, evidence: "photo" }, { as: ORG });
    assert.equal(one.status, 201, JSON.stringify(one.body));
    assert.equal(one.body.id, "cafe-crawl");
    assert.equal(one.body.title, "Café ☕ Crawl!");
    assert.equal(one.body.custom, true);
    assert.equal(one.body.status, "live");
    const two = await post("/api/questival/admin/quests", { title: "Café Crawl", points: 10 }, { as: ORG });
    assert.equal(two.body.id, "cafe-crawl-2");
    const three = await post("/api/questival/admin/quests", { title: "cafe crawl", points: 10 }, { as: ORG });
    assert.equal(three.body.id, "cafe-crawl-3");
    const emoji = await post("/api/questival/admin/quests", { title: "☕", points: 10 }, { as: ORG });
    assert.equal(emoji.body.id, "quest");
    const collide = await post("/api/questival/admin/quests", { title: "Selfie at 851", points: 10 }, { as: ORG });
    assert.equal(collide.body.id, "selfie-at-851");
    assert.equal(collide.status, 201);

    // partial update keeps the rest
    const upd = await post("/api/questival/admin/quests", { id: "cafe-crawl", points: 20 }, { as: ORG });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.title, "Café ☕ Crawl!");
    assert.equal(upd.body.points, 20);

    const over = await post("/api/questival/admin/quests", { id: "851", points: 99 }, { as: ORG });
    assert.equal(over.status, 200);
    assert.equal(over.body.custom, true);
    assert.equal(over.body.title, "Selfie at 851");
    assert.equal(over.body.venue, "851 California");
    const cat = await get("/api/questival/catalog");
    const q = cat.body.quests.find((x) => x.id === "851");
    assert.equal(q.points, 99);
    assert.equal(cat.body.quests.filter((x) => x.id === "cafe-crawl").length, 1);
    const st = await get("/api/questival/state", { as: U });
    assert.equal(st.body.organizer, false);
    // a proof on the overridden quest is worth the new points
    const r = await proof(U, idOf(U), "851");
    assert.equal(r.body.points, 99);
    sql("delete from q_quests where id='851'");
  });

  test("archive hides a static quest from the class but not organizers; unarchive restores", async () => {
    const arch = await del("/api/questival/admin/quests?id=grace", { as: ORG });
    assert.equal(arch.status, 200, JSON.stringify(arch.body));
    assert.equal(arch.body.status, "archived");
    const pub = await get("/api/questival/catalog");
    assert.ok(!pub.body.quests.some((q) => q.id === "grace"));
    const userCat = await get("/api/questival/catalog", { as: U });
    assert.ok(!userCat.body.quests.some((q) => q.id === "grace"));
    const orgCat = await get("/api/questival/catalog", { as: ORG });
    assert.equal(orgCat.body.quests.find((q) => q.id === "grace").status, "archived");
    assert.equal((await proof(U, idOf(U), "grace")).status, 400);
    assert.equal((await post("/api/questival/upload-url", { quest_id: "grace", content_type: "image/jpeg", size: 1 }, { as: U })).status, 400);
    assert.equal((await post("/api/questival/plans", { kind: "quest", target_id: "grace", with_ids: [] }, { as: U })).status, 400);
    assert.equal((await post("/api/questival/plans", { kind: "quest", target_id: "grace", with_ids: [] }, { as: ORG })).status, 400, "organizers can't plan an archived one either");

    const draft = await post("/api/questival/admin/quests", { id: "grace", status: "draft" }, { as: ORG });
    assert.equal(draft.body.status, "draft");
    assert.ok(!(await get("/api/questival/catalog", { as: U })).body.quests.some((q) => q.id === "grace"), "drafts are organizer-only");
    assert.equal((await proof(U, idOf(U), "grace")).status, 400);

    const live = await post("/api/questival/admin/quests", { id: "grace", status: "live" }, { as: ORG });
    assert.equal(live.body.status, "live");
    assert.ok((await get("/api/questival/catalog")).body.quests.some((q) => q.id === "grace"));
    assert.equal((await del("/api/questival/admin/quests?id=does-not-exist", { as: ORG })).status, 404);
    assert.equal((await del("/api/questival/admin/quests?id=Bad", { as: ORG })).status, 400);
    sql("delete from q_quests");
  });

  test("settings validation, announcement, release, freeze", async () => {
    const cur = (await get("/api/questival/catalog")).body.settings;
    const bad = async (body, why) => {
      const r = await post("/api/questival/admin/settings", body, { as: ORG });
      assert.equal(r.status, 400, `${why}: ${JSON.stringify(r.body)}`);
    };
    await bad({ opens_at: cur.due_at }, "opens == due");
    await bad({ opens_at: "2030-01-01T00:00:00Z" }, "opens after due");
    await bad({ due_at: "2030-01-01T00:00:00Z" }, "due after extension");
    await bad({ extension_until: "2000-01-01T00:00:00Z" }, "extension before due");
    await bad({ opens_at: "yesterday" }, "bad timestamp");
    await bad({ opens_at: null }, "null timestamp");
    await bad({ announcement: 5 }, "announcement type");

    const same = await post("/api/questival/admin/settings", { due_at: cur.extension_until }, { as: ORG });
    assert.equal(same.status, 200, "due == extension is allowed");
    assert.equal(same.body.due_at, cur.extension_until);
    const ann = await post("/api/questival/admin/settings", { announcement: "  Meet at 5  " + "x".repeat(600) }, { as: ORG });
    assert.equal(ann.body.announcement.length, 500);
    assert.ok(ann.body.announcement.startsWith("Meet at 5"));
    assert.equal((await get("/api/questival/catalog")).body.settings.announcement, ann.body.announcement);
    const clear = await post("/api/questival/admin/settings", { announcement: null }, { as: ORG });
    assert.equal(clear.body.announcement, null);
    const clear2 = await post("/api/questival/admin/settings", { announcement: "   " }, { as: ORG });
    assert.equal(clear2.body.announcement, null);

    const rel = await post("/api/questival/admin/settings", { release_results: true }, { as: ORG });
    assert.ok(rel.body.results_released_at);
    assert.equal(rel.body.frozen_at, rel.body.results_released_at);
    await new Promise((r) => setTimeout(r, 10));
    const rel2 = await post("/api/questival/admin/settings", { release_results: true, freeze: true }, { as: ORG });
    assert.equal(rel2.body.results_released_at, rel.body.results_released_at, "second release keeps the first time");
    assert.equal(rel2.body.frozen_at, rel.body.frozen_at);
    assert.equal((await get("/api/questival/board", { as: U })).body.frozen, true);
    sql("update q_settings set frozen_at=null, results_released_at=null");
    const fr = await post("/api/questival/admin/settings", { freeze: true }, { as: ORG });
    assert.ok(fr.body.frozen_at);
    assert.equal(fr.body.results_released_at, null);
    sql("update q_settings set frozen_at=null, results_released_at=null");
    setWindow({});
  });

  test("concurrent settings updates all land", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => post("/api/questival/admin/settings", { announcement: `a${i}` }, { as: ORG })));
    for (const r of rs) assert.equal(r.status, 200);
    const final = (await get("/api/questival/catalog")).body.settings.announcement;
    assert.match(final, /^a\d$/);
    await post("/api/questival/admin/settings", { announcement: null }, { as: ORG });
  });

  test("review and people lists", async () => {
    const rev = await get("/api/questival/admin/review", { as: ORG });
    assert.equal(rev.status, 200);
    assert.ok(Array.isArray(rev.body.submissions) && Array.isArray(rev.body.finals));
    assert.ok(rev.body.finals.length >= 2);
    assert.ok(rev.body.finals.every((f) => typeof f.extension_used === "boolean" && f.person.id));
    assertNoEmails(rev.body, "review");
    const rejected = await proof(U, idOf(U), "corona");
    await patch(`/api/questival/submissions/${rejected.body.id}`, { status: "rejected" }, { as: ORG });
    const rev2 = await get("/api/questival/admin/review", { as: ORG });
    assert.ok(rev2.body.submissions.some((s) => s.id === rejected.body.id && s.status === "rejected"), "review sees rejected proofs");

    const ppl = await get("/api/questival/admin/people", { as: ORG });
    assert.equal(ppl.status, 200);
    assert.equal(ppl.body.people.length, people.size, "paid + processing + pending");
    const ani = ppl.body.people.find((p) => p.email === ORG);
    assert.equal(ani.organizer, true);
    assert.equal(ppl.body.people.find((p) => p.email === "nathan@test.local").organizer, true, "email in FORUM_TESTERS");
    assert.equal(ppl.body.people.find((p) => p.email === "mau@test.local").organizer, true);
    assert.equal(ppl.body.people.find((p) => p.email === U).organizer, false);
    assert.equal(ppl.body.people.find((p) => p.email === PENDING).status, "pending");
  });
});

// ============================================================ 8. gate

describe("gate: /api/forum/access", () => {
  const FIELDS = ["allowed", "email", "name", "organizer", "photoUrl", "questival", "reason", "rsvpId", "tester"];

  test("tester by email", async () => {
    const r = await get("/api/forum/access", { as: ORG });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body).sort(), FIELDS);
    assert.equal(r.body.allowed, true);
    assert.equal(r.body.tester, true);
    assert.equal(r.body.organizer, true);
    assert.equal(r.body.questival, true);
    assert.equal(r.body.rsvpId, idOf(ORG));
    assert.equal(r.body.name, "Anirudh Nair");
    assert.equal(r.headers.get("cache-control"), "no-store");
  });

  test("the Google profile name grants nothing: not tester, not organizer, no RSVP", async () => {
    for (const name of ["Ani Nair", "Anirudh Nair", "Mau Urdaneta", "Nathan Torento"]) {
      const r = await get("/api/forum/access", { as: "unknown@test.local", name });
      assert.equal(r.status, 200);
      assert.equal(r.body.allowed, false, name);
      assert.equal(r.body.tester, false, name);
      assert.equal(r.body.organizer, false, name);
      assert.equal(r.body.rsvpId, null, name);
      assert.equal(r.body.reason, "no-rsvp");
    }
    const st = await get("/api/questival/state", { as: "unknown@test.local", name: "Anirudh Nair" });
    assert.equal(st.status, 403);
    // An ordinary confirmed RSVP claiming an organizer's name is still just themselves.
    const spoof = await get("/api/forum/access", { as: paid(8), name: "Anirudh Nair" });
    assert.equal(spoof.body.allowed, true);
    assert.equal(spoof.body.organizer, false);
    assert.equal(spoof.body.tester, false);
    assert.equal(spoof.body.rsvpId, idOf(paid(8)));
    assert.equal((await get("/api/questival/admin/people", { as: paid(8), name: "Anirudh Nair" })).status, 403);
  });

  test("a trusted email (FORUM_TESTERS) on a second account is attached to its RSVP by name", async () => {
    const MAU = "mau@test.local";
    // Simulate the RSVP being under a different email than the sign-in email.
    sql(`update rsvps set email='mau-rsvp@test.local' where id='${idOf(MAU)}'`);
    try {
      const noName = await get("/api/forum/access", { as: MAU });
      assert.equal(noName.body.allowed, true, "trusted email passes regardless");
      assert.equal(noName.body.organizer, true);
      assert.equal(noName.body.rsvpId, null, "no name, no row");
      const byName = await get("/api/forum/access", { as: MAU, name: "Mau Urdaneta" });
      assert.equal(byName.body.rsvpId, idOf(MAU), "RSVP row found by name for the trusted email");
      assert.equal(byName.body.name, "Mau Urdaneta");
      const accents = await get("/api/forum/access", { as: MAU, name: "Maü Urdañeta" });
      assert.equal(accents.body.rsvpId, idOf(MAU), "accents fold");
      const prefix = await get("/api/forum/access", { as: MAU, name: "Mauricio Urdaneta" });
      assert.equal(prefix.body.rsvpId, idOf(MAU), "first-name prefix (>= 3 letters) matches");
      const other = await get("/api/forum/access", { as: MAU, name: "Max Urdaneta" });
      assert.equal(other.body.rsvpId, null, "a different first name does not");
      const st = await get("/api/questival/state", { as: MAU, name: "Mau Urdaneta" });
      assert.equal(st.body.me.id, idOf(MAU));
      assert.equal(st.body.organizer, true);
    } finally {
      sql(`update rsvps set email='${MAU}' where id='${idOf(MAU)}'`);
    }
  });

  test("a different first-name prefix is not a match", async () => {
    const r = await get("/api/forum/access", { as: "unknown2@test.local", name: "Nate Torento" });
    assert.equal(r.status, 200);
    assert.equal(r.body.allowed, false);
    assert.equal(r.body.tester, false);
    assert.equal(r.body.reason, "no-rsvp");
    assert.equal(r.body.rsvpId, null);
    const st = await get("/api/questival/state", { as: "unknown2@test.local", name: "Nate Torento" });
    assert.equal(st.status, 403);
    assert.equal(st.body.code, "forbidden");
  });

  test("FORUM_OPEN=1 admits confirmed RSVPs (paid and processing), not pending", async () => {
    const u = await get("/api/forum/access", { as: paid(7) });
    assert.equal(u.body.allowed, true);
    assert.equal(u.body.tester, false);
    assert.equal(u.body.organizer, false);
    assert.equal(u.body.rsvpId, idOf(paid(7)));
    const pr = await get("/api/forum/access", { as: PROCESSING });
    assert.equal(pr.body.allowed, true);
    const p = await get("/api/forum/access", { as: PENDING });
    assert.equal(p.status, 200);
    assert.equal(p.body.allowed, false);
    assert.equal(p.body.reason, "no-rsvp");
    assert.equal(p.body.rsvpId, null);
    const upper = await get("/api/forum/access", { as: "USER7@TEST.LOCAL" });
    assert.equal(upper.body.rsvpId, idOf(paid(7)), "email match is case-insensitive");
  });

  test("anonymous is 401 with reason anon", async () => {
    const r = await get("/api/forum/access");
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { allowed: false, reason: "anon" });
    const bad = await get("/api/forum/access", { auth: true });
    assert.equal(bad.status, 401, "a bogus Google token is anon");
  });
});

// ============================================================ 9. map / who

describe("map: /api/map", () => {
  const A = paid(1), B = paid(2);

  test("faces for activities and place quests; cap 8; consistent with /api/weekend/plans", async () => {
    sql("truncate plans, q_plans, q_plan_replies restart identity cascade");
    await put("/api/weekend/plans", { activity_id: "sat-dinner", intent: "going" }, { as: A });
    await put("/api/weekend/plans", { activity_id: "sat-dinner", intent: "going" }, { as: B });
    await put("/api/weekend/plans", { activity_id: "sat-dinner", intent: "interested" }, { as: paid(3) });
    await post("/api/questival/plans", { kind: "quest", target_id: "851", with_ids: [idOf(B)] }, { as: A });
    await post("/api/questival/plans", { kind: "quest", target_id: "parks", with_ids: [idOf(B)] }, { as: A });
    await post("/api/questival/plans", { kind: "activity", target_id: "sat-breakfast", with_ids: [idOf(B)] }, { as: A });
    const twelve = Array.from({ length: 12 }, (_, i) => paid(10 + i));
    await Promise.all(twelve.map((u) => put("/api/weekend/plans", { activity_id: "sat-breakfast", intent: "going" }, { as: u })));

    const map = await get("/api/map");
    assert.equal(map.status, 200);
    assertNoEmails(map.body, "map");
    assert.deepEqual(map.body.activities["sat-dinner"].map((p) => p.id).sort(), [idOf(A), idOf(B)].sort(), "interested is not on the map");
    assert.deepEqual(map.body.quests["851"].map((p) => p.id), [idOf(A), idOf(B)]);
    assert.equal(map.body.quests["parks"], undefined, "anywhere quests have no pin");
    assert.equal(map.body.activities["sat-breakfast"].length, 8, "cap");
    const who = await get("/api/weekend/plans?activity=sat-breakfast");
    assert.equal(who.body.going_count, 12);
    const goingIds = new Set(who.body.going.map((p) => p.id));
    for (const p of map.body.activities["sat-breakfast"]) assert.ok(goingIds.has(p.id), "map faces are a subset of who's going");
    const all = await get("/api/weekend/plans");
    assert.equal(all.body["sat-dinner"].going_count, 2);
    assert.equal(all.body["sat-dinner"].interested_count, 1);
    sql("truncate plans, q_plans, q_plan_replies restart identity cascade");
  });
});

// ============================================================ 10. robustness

describe("robustness", () => {
  const A = paid(1);

  test("malformed / non-object JSON bodies are 400, not 500", async () => {
    for (const raw of ["{", "null", "[]", '"str"', "42", ""]) {
      for (const p of ["/api/questival/plans", "/api/catchups", "/api/questival/submissions", "/api/questival/upload-url", "/api/questival/plans/reply", "/api/catchups/reply"]) {
        const r = await call("POST", p, { raw, as: A });
        assert.equal(r.status, 400, `${p} ${JSON.stringify(raw)} → ${r.status}`);
        assert.equal(r.body.code, "bad-request");
      }
      const w = await call("PUT", "/api/weekend/plans", { raw, as: A });
      assert.equal(w.status, 400);
      const s = await call("POST", "/api/questival/admin/settings", { raw, as: ORG });
      assert.equal(s.status, 400);
    }
  });

  test("huge bodies are 413", async () => {
    const raw = JSON.stringify({ kind: "quest", target_id: "851", with_ids: [], pad: "x".repeat(2 * 1024 * 1024) });
    const r = await call("POST", "/api/questival/plans", { raw, as: A });
    assert.equal(r.status, 413);
  });

  test("wrong methods are 405", async () => {
    assert.equal((await call("PUT", "/api/questival/shift3", { as: A })).status, 405);
    assert.equal((await call("GET", "/api/questival/submissions", { as: A })).status, 405);
    assert.equal((await call("POST", "/api/map", { as: A })).status, 405);
    assert.equal((await call("PUT", "/api/questival/admin/settings", { as: ORG })).status, 405);
  });

  test("SQL-ish and unicode text is stored verbatim and returned whitelisted", async () => {
    const caption = `Robert'); DROP TABLE q_submissions;-- “quotes” — émoji 🎉 \\ %s {{x}}`;
    const note = `' OR 1=1; -- \u0000tail`; // a NUL byte: Postgres text rejects it (22P05)
    const r = await proof(A, idOf(A), "851", { caption, note });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.caption, caption);
    assert.equal(r.body.note, "' OR 1=1; -- tail", "NUL stripped, not a 500");
    const nulCaption = await proof(A, idOf(A), "851", { caption: "\u0000\u0000" });
    assert.equal(nulCaption.status, 201);
    assert.equal(nulCaption.body.caption, null, "NUL-only caption is no caption");
    const nulCatchup = await post("/api/catchups", { to_id: idOf(paid(9)), slot: "sun-1300", note: "hi\u0000there" }, { as: A });
    assert.equal(nulCatchup.status, 201);
    assert.equal(nulCatchup.body.note, "hithere");
    const nulAnn = await post("/api/questival/admin/settings", { announcement: "a\u0000b" }, { as: ORG });
    assert.equal(nulAnn.body.announcement, "ab");
    const nulQuest = await post("/api/questival/admin/quests", { title: "Nul\u0000 quest", points: 5 }, { as: ORG });
    assert.equal(nulQuest.status, 201);
    assert.equal(nulQuest.body.title, "Nul quest");
    assert.equal(sql("select count(*) from q_submissions") !== "0", true);
    const ann = await post("/api/questival/admin/settings", { announcement: caption }, { as: ORG });
    assert.equal(ann.body.announcement, caption);
    await post("/api/questival/admin/settings", { announcement: null }, { as: ORG });
    const q = await post("/api/questival/admin/quests", { title: "Zoë's “rooftop” — 屋上 🍜", points: 10 }, { as: ORG });
    assert.equal(q.status, 201);
    assert.equal(q.body.id, "zoe-s-rooftop");
    sql("delete from q_quests");
  });

  test("unicode and pattern-shaped names on the gate", async () => {
    const r = await get("/api/forum/access", { as: "nobody@test.local", name: "%' or ''='" });
    assert.equal(r.status, 200);
    assert.equal(r.body.allowed, false);
    const u = await get("/api/forum/access", { as: "nobody2@test.local", name: "Anirüdh Naïr" });
    assert.equal(u.body.tester, false);
    assert.equal(u.body.rsvpId, null);
    const long = await get("/api/forum/access", { as: "nobody3@test.local", name: "x".repeat(5000) });
    assert.equal(long.status, 200);
    assert.equal(long.body.allowed, false);
  });

  test("catalog is public, no-store, and never carries emails", async () => {
    const r = await get("/api/questival/catalog");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.ok(r.body.quests.length > 20);
    assert.ok(r.body.quests.every((q) => q.status === "live" && q.custom === false));
    assertNoEmails(r.body, "catalog");
    assert.equal((await get("/api/questival/state", { as: "stranger@test.local" })).status, 403);
  });
});
