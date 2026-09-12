import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITIES,
  CATCHUP_SLOTS,
  DAYS,
  SESSIONS,
  activitiesFor,
  dayOf,
  getActivity,
  getSession,
  nextSession,
  nowNext,
  ptDate,
  sessionEndsAt,
  sessionOf,
  sessionsFor,
  type Day,
} from "../../src/lib/weekend";

const H = 3600_000;
/** San Francisco wall time on the weekend, as an instant. */
const pt = (day: 11 | 12 | 13, hhmm: string) => new Date(`2026-09-${day}T${hhmm}:00-07:00`);
const DAY_OF_DATE: Record<string, Day> = { "11": "fri", "12": "sat", "13": "sun" };

describe("data integrity", () => {
  test("activity ids are unique and url-safe (the server's ID_RE is ^[a-z0-9-]{1,32}$)", () => {
    const ids = ACTIVITIES.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]{1,32}$/, id);
  });

  test("session ids and numbers are unique; sessions are in start order", () => {
    assert.equal(new Set(SESSIONS.map((s) => s.id)).size, SESSIONS.length);
    assert.equal(new Set(SESSIONS.map((s) => s.number)).size, SESSIONS.length);
    for (let i = 1; i < SESSIONS.length; i++) {
      assert.ok(Date.parse(SESSIONS[i - 1].start) < Date.parse(SESSIONS[i].start), `${SESSIONS[i].id} after ${SESSIONS[i - 1].id}`);
    }
  });

  test("every session activity and side quest exists, on the session's day", () => {
    for (const s of SESSIONS) {
      for (const id of [...s.activities, ...s.side]) {
        const a = getActivity(id);
        assert.ok(a, `${s.id} references missing activity ${id}`);
        assert.equal(a.day, s.day, `${id} is on ${a.day}, session ${s.id} is ${s.day}`);
      }
      assert.ok(s.activities.length > 0, `${s.id} has a run of show`);
    }
  });

  test("every activity belongs to exactly one session (none orphaned, none shared)", () => {
    const seen = new Map<string, string[]>();
    for (const s of SESSIONS) for (const id of [...s.activities, ...s.side]) seen.set(id, [...(seen.get(id) ?? []), s.id]);
    for (const a of ACTIVITIES) {
      const owners = seen.get(a.id) ?? [];
      assert.equal(owners.length, 1, `${a.id} is in sessions [${owners.join(", ")}]`);
      assert.equal(sessionOf(a.id)?.id, owners[0]);
    }
    assert.equal(sessionOf("nope"), undefined);
  });

  test("start times are non-decreasing within a session's run of show, and the class starts with its first activity", () => {
    for (const s of SESSIONS) {
      let last = -Infinity;
      for (const id of s.activities) {
        const a = getActivity(id)!;
        if (!a.start) continue;
        const t = Date.parse(a.start);
        assert.ok(Number.isFinite(t), `${id} start parses`);
        assert.ok(t >= last, `${id} starts before the activity before it`);
        last = t;
      }
      const first = getActivity(s.activities[0])!;
      assert.equal(first.start, s.start, `${s.id} starts with ${first.id}`);
    }
  });

  test("every timed activity starts on its own day, with the -07:00 offset written out", () => {
    for (const a of ACTIVITIES) {
      if (!a.start) {
        assert.ok(/TBD|Late/i.test(a.time), `${a.id} has no start but a concrete time label "${a.time}"`);
        continue;
      }
      assert.match(a.start, /^2026-09-1[123]T\d{2}:\d{2}:00-07:00$/, a.start);
      assert.equal(DAY_OF_DATE[a.start.slice(8, 10)], a.day, `${a.id} start date vs day`);
    }
  });

  test("required activities are anchors, and every anchor is in a run of show (not a side quest)", () => {
    for (const a of ACTIVITIES) {
      if (a.required) assert.equal(a.kind, "anchor", `${a.id} is required but ${a.kind}`);
      if (a.kind === "anchor") assert.ok(SESSIONS.some((s) => s.activities.includes(a.id)), `${a.id} anchor is a side quest`);
      if (a.kind === "peer") assert.ok(SESSIONS.some((s) => s.side.includes(a.id)), `${a.id} peer-led but in a run of show`);
    }
  });

  test("lat/lng come in pairs and sit in San Francisco", () => {
    for (const a of ACTIVITIES) {
      assert.equal(a.lat === undefined, a.lng === undefined, `${a.id} lat/lng pair`);
      if (a.lat !== undefined) assert.ok(a.lat > 37.7 && a.lat < 37.85 && a.lng! > -122.52 && a.lng! < -122.35, `${a.id} pin`);
    }
  });

  test("goingSeed names are plausible full names", () => {
    for (const a of ACTIVITIES) for (const n of a.goingSeed ?? []) assert.match(n, /^\S+ \S+/, `${a.id} seed "${n}"`);
  });

  test("DAYS cover fri/sat/sun and name the day's first class as SESSIONS numbers it", () => {
    assert.deepEqual(DAYS.map((d) => d.id), ["fri", "sat", "sun"]);
    for (const d of DAYS) {
      assert.equal(d.session, sessionsFor(d.id)[0].number, `${d.id} session label`);
      assert.ok(activitiesFor(d.id).length > 0);
    }
    assert.equal(getSession("s21")?.day, "sat");
  });

  test("CATCHUP_SLOTS ids are unique, ≤32 url-safe chars (what /api/catchups accepts), ascending, on their day", () => {
    const ids = CATCHUP_SLOTS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    let last = -Infinity;
    for (const s of CATCHUP_SLOTS) {
      assert.match(s.id, /^[a-z0-9-]{1,32}$/, s.id);
      const t = Date.parse(s.start);
      assert.ok(t > last, `${s.id} out of order`);
      last = t;
      assert.equal(DAY_OF_DATE[s.start.slice(8, 10)], s.day, `${s.id} day`);
      assert.ok(s.id.startsWith(`${s.day}-`), `${s.id} is prefixed with its day`);
    }
  });
});

describe("dayOf / ptDate (San Francisco calendar date, any browser zone)", () => {
  test("day boundaries are midnight PDT (07:00Z)", () => {
    assert.equal(dayOf(new Date("2026-09-11T06:59:59Z")), null, "Thu 23:59:59 PT");
    assert.equal(dayOf(new Date("2026-09-11T07:00:00Z")), "fri");
    assert.equal(dayOf(new Date("2026-09-12T06:59:59Z")), "fri");
    assert.equal(dayOf(new Date("2026-09-12T07:00:00Z")), "sat");
    assert.equal(dayOf(new Date("2026-09-13T06:59:59Z")), "sat");
    assert.equal(dayOf(new Date("2026-09-14T06:59:59Z")), "sun", "Sun 23:59:59 PT");
    assert.equal(dayOf(new Date("2026-09-14T07:00:00Z")), null, "Monday");
  });
  test("outside the weekend and on garbage", () => {
    assert.equal(dayOf(new Date("2026-09-08T12:00:00Z")), null);
    assert.equal(dayOf(new Date("2025-09-12T19:00:00Z")), null, "right day, wrong year");
    assert.equal(dayOf(new Date(NaN)), null);
    assert.equal(ptDate(new Date(NaN)), null);
    assert.deepEqual(ptDate(new Date("2026-09-13T06:59:59Z")), { year: 2026, month: 9, day: 12 });
  });
});

describe("nowNext (3h 'now' window)", () => {
  test("before the weekend: nothing now, dinner next", () => {
    const r = nowNext(new Date("2026-09-08T12:00:00Z"));
    assert.equal(r.now, null);
    assert.equal(r.next?.id, "fri-dinner");
  });
  test("Friday evening", () => {
    assert.equal(nowNext(pt(11, "17:59")).now, null);
    let r = nowNext(pt(11, "18:00"));
    assert.equal(r.now?.id, "fri-dinner");
    assert.equal(r.next?.id, "fri-bars");
    r = nowNext(pt(11, "20:59"));
    assert.equal(r.now?.id, "fri-dinner", "still 'now' at 2h59");
    r = nowNext(pt(11, "21:01"));
    assert.equal(r.now, null, "dinner is over 3h old");
    assert.equal(r.next?.id, "fri-bars");
  });
  test("day boundary: Friday night into Saturday morning", () => {
    let r = nowNext(pt(11, "23:30"));
    assert.equal(r.now?.id, "fri-bars");
    assert.equal(r.next?.id, "sat-breakfast");
    r = nowNext(pt(12, "01:30"));
    assert.equal(r.now, null);
    assert.equal(r.next?.id, "sat-breakfast");
  });
  test("Saturday", () => {
    let r = nowNext(pt(12, "10:00"));
    assert.ok(r.now && ["sat-breakfast", "sat-questival"].includes(r.now.id), "one of the two 10:00 starts");
    assert.equal(r.next?.id, "sat-sports");
    r = nowNext(pt(12, "14:30"));
    assert.equal(r.now?.id, "sat-sports");
    assert.equal(r.next?.id, "sat-lunch");
    r = nowNext(pt(12, "19:30"));
    assert.equal(r.now?.id, "sat-dinner");
    assert.equal(r.next?.id, "sat-after");
  });
  test("after the last activity there is nothing", () => {
    const r = nowNext(pt(13, "17:01"));
    assert.equal(r.now, null);
    assert.equal(r.next, null);
  });
});

describe("nextSession", () => {
  test("upcoming and in-progress classes across the weekend", () => {
    assert.equal(nextSession(new Date("2026-09-08T12:00:00Z"))?.id, "s11", "days before");
    assert.equal(nextSession(pt(11, "21:59"))?.id, "s11");
    assert.equal(nextSession(pt(11, "22:30"))?.id, "s11", "the bar hop is still Session 1.1");
    assert.equal(nextSession(pt(11, "23:01"))?.id, "s21");
    assert.equal(nextSession(pt(12, "13:59"))?.id, "s21");
    assert.equal(nextSession(pt(12, "15:10"))?.id, "s21", "lunch at the Res Hall is still Questival day");
    assert.equal(nextSession(pt(12, "16:59"))?.id, "s21");
    assert.equal(nextSession(pt(12, "17:01"))?.id, "s22");
    assert.equal(nextSession(pt(12, "22:30"))?.id, "s22", "Chug Pub is still Session 2.2");
    assert.equal(nextSession(pt(12, "23:01"))?.id, "s31");
    assert.equal(nextSession(pt(13, "14:59"))?.id, "s31");
    assert.equal(nextSession(pt(13, "15:00")), null, "after the weekend");
  });
  test("sessionEndsAt is never earlier than 4h after the start", () => {
    for (const s of SESSIONS) assert.ok(sessionEndsAt(s) >= Date.parse(s.start) + 4 * H, s.id);
  });
});

describe("timezone independence (nothing uses the browser's local clock)", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  for (const tz of ["Asia/Kolkata", "Pacific/Auckland", "UTC", "America/New_York"]) {
    test(`same instants, same answers in ${tz}`, () => {
      process.env.TZ = tz;
      assert.equal(dayOf(new Date("2026-09-12T06:59:59Z")), "fri");
      assert.equal(dayOf(new Date("2026-09-12T07:00:00Z")), "sat");
      assert.equal(nowNext(pt(12, "14:30")).now?.id, "sat-sports");
      assert.equal(nextSession(pt(12, "15:10"))?.id, "s21");
      // The T() helper writes the offset, so an overseas browser never moves a meetup.
      assert.equal(new Date(getActivity("sat-breakfast")!.start!).toISOString(), "2026-09-12T17:00:00.000Z");
    });
  }
});
