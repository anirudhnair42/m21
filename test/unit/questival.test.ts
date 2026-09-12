import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ANYWHERE_QUESTS,
  EVIDENCE_LABEL,
  PLACE_QUESTS,
  QUESTIVAL,
  QUESTS,
  getQuest,
  proofPoints,
  questivalWindow,
  questivalWindowAt,
  timeLeft,
  totalPoints,
  type Evidence,
  type Proof,
} from "../../src/lib/questival";

const H = 3600_000;
const M = 60_000;

describe("QUESTIVAL switches", () => {
  test("are Saturday Sep 12 2026, San Francisco time (PDT, UTC-7)", () => {
    assert.equal(new Date(QUESTIVAL.opensAt).toISOString(), "2026-09-12T17:00:00.000Z");
    assert.equal(new Date(QUESTIVAL.dueAt).toISOString(), "2026-09-13T00:00:00.000Z");
    assert.equal(new Date(QUESTIVAL.extensionUntil).toISOString(), "2026-09-13T00:07:00.000Z");
    assert.equal(new Date(QUESTIVAL.resultsAt).toISOString(), "2026-09-13T03:30:00.000Z");
    assert.equal(QUESTIVAL.extensionUntil - QUESTIVAL.dueAt, 7 * M, "the 7th minute");
  });
});

describe("questivalWindow boundaries (half-open, like the server's windowAt)", () => {
  test("exactly at each switch", () => {
    assert.equal(questivalWindow(QUESTIVAL.opensAt - 1), "before");
    assert.equal(questivalWindow(QUESTIVAL.opensAt), "open");
    assert.equal(questivalWindow(QUESTIVAL.dueAt - 1), "open");
    assert.equal(questivalWindow(QUESTIVAL.dueAt), "extension");
    assert.equal(questivalWindow(QUESTIVAL.extensionUntil - 1), "extension");
    assert.equal(questivalWindow(QUESTIVAL.extensionUntil), "closed");
  });

  test("questivalWindowAt follows organizer-moved switches given as ISO strings", () => {
    const moved = { opensAt: "2026-09-12T09:00:00-07:00", dueAt: "2026-09-12T18:00:00-07:00", extensionUntil: "2026-09-12T18:07:00-07:00" };
    // 17:30 PT: closed by the static clock, still open by the moved one.
    const t = Date.parse("2026-09-12T17:30:00-07:00");
    assert.equal(questivalWindow(t), "closed");
    assert.equal(questivalWindowAt(moved, t), "open");
    assert.equal(questivalWindowAt(moved, Date.parse("2026-09-12T18:03:00-07:00")), "extension");
    assert.equal(questivalWindowAt(moved, Date.parse("2026-09-12T08:59:59-07:00")), "before");
  });

  test("an unparsable switch falls back to the static one instead of closing the event", () => {
    const bad = { opensAt: "not a date", dueAt: "", extensionUntil: "??" };
    assert.equal(questivalWindowAt(bad, QUESTIVAL.opensAt + H), "open");
    assert.equal(questivalWindowAt(bad, QUESTIVAL.dueAt + M), "extension");
    assert.equal(questivalWindowAt(bad, QUESTIVAL.opensAt - 1), "before");
  });
});

describe("timeLeft", () => {
  test("formats hours/minutes, days, and the last minute", () => {
    assert.equal(timeLeft(QUESTIVAL.dueAt - (2 * H + 14 * M)), "2h 14m left");
    assert.equal(timeLeft(QUESTIVAL.dueAt - 90 * M), "1h 30m left");
    assert.equal(timeLeft(QUESTIVAL.dueAt - 5 * M), "5m left");
    assert.equal(timeLeft(QUESTIVAL.dueAt - 1), "0m left");
    assert.equal(timeLeft(QUESTIVAL.dueAt - 25 * H), "1d 1h left");
    assert.equal(timeLeft(QUESTIVAL.dueAt - 48 * H), "2d 0h left");
  });
  test("at and after the due time", () => {
    assert.equal(timeLeft(QUESTIVAL.dueAt), "Due now");
    assert.equal(timeLeft(QUESTIVAL.dueAt + 3 * M), "Due now");
  });
  test("honors a moved due time", () => {
    assert.equal(timeLeft(QUESTIVAL.dueAt, "2026-09-12T18:00:00-07:00"), "1h 0m left");
  });
});

describe("points", () => {
  const approved = (questId: string, instance = 1, pointsOverride?: number | null): Proof => ({ questId, instance, status: "approved", pointsOverride });

  test("proofPoints: rejected and draft are worth nothing, override wins when approved", () => {
    assert.equal(proofPoints({ questId: "851", instance: 1, status: "rejected", pointsOverride: 99 }), 0);
    assert.equal(proofPoints({ questId: "851", instance: 1, status: "draft" }), 0);
    assert.equal(proofPoints(approved("851")), 15);
    assert.equal(proofPoints(approved("851", 1, 40)), 40);
    assert.equal(proofPoints(approved("851", 1, 0)), 0, "an explicit 0 override is 0, not the quest's points");
    assert.equal(proofPoints(approved("851", 1, null)), 15);
    assert.equal(proofPoints(approved("nope")), 0);
  });

  test("totalPoints: best proof per (quest, instance)", () => {
    assert.equal(totalPoints([approved("851"), approved("851"), approved("851", 1, 5)]), 15);
    assert.equal(totalPoints([approved("851", 1, 5), approved("851", 1, 30)]), 30);
  });

  test("totalPoints: instances capped by repeat, out-of-range instances ignored", () => {
    const parks = getQuest("parks")!;
    assert.equal(parks.repeat, 5);
    const five = [1, 2, 3, 4, 5].map((i) => approved("parks", i));
    assert.equal(totalPoints(five), 25);
    assert.equal(totalPoints([...five, approved("parks", 6), approved("parks", 7)]), 25);
    assert.equal(totalPoints([approved("parks", 0)]), 0);
    assert.equal(totalPoints([approved("851", 2)]), 0, "a single-instance quest has no instance 2");
  });

  test("totalPoints: rejected and unknown quests contribute nothing, but don't break the sum", () => {
    assert.equal(totalPoints([{ questId: "851", instance: 1, status: "rejected" }, approved("grace"), approved("ghost-quest")]), 15);
  });

  test("totalPoints of nothing is 0", () => {
    assert.equal(totalPoints([]), 0);
  });
});

describe("catalog integrity", () => {
  test("ids are unique, url-safe, and short enough for the upload path", () => {
    const ids = QUESTS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[a-z0-9-]{1,32}$/, id);
  });

  test("points and repeat respect the q_quests check constraints", () => {
    for (const q of QUESTS) {
      assert.ok(Number.isInteger(q.points) && q.points >= 1 && q.points <= 200, `${q.id} points`);
      if (q.repeat !== undefined) assert.ok(Number.isInteger(q.repeat) && q.repeat >= 1 && q.repeat <= 12, `${q.id} repeat`);
    }
  });

  test("lat and lng come in pairs, and only on venue quests", () => {
    for (const q of QUESTS) {
      assert.equal(q.lat === undefined, q.lng === undefined, `${q.id} lat/lng pair`);
      if (q.lat !== undefined) {
        assert.ok(q.venue, `${q.id} has a pin but no venue`);
        assert.ok(q.lat > 37.7 && q.lat < 37.85 && q.lng! > -122.52 && q.lng! < -122.35, `${q.id} pin is in San Francisco`);
      }
    }
  });

  test("PLACE/ANYWHERE partition the catalog", () => {
    assert.equal(PLACE_QUESTS.length + ANYWHERE_QUESTS.length, QUESTS.length);
    assert.ok(PLACE_QUESTS.every((q) => q.venue));
    assert.ok(ANYWHERE_QUESTS.every((q) => !q.venue));
  });

  test("EVIDENCE_LABEL covers every evidence kind in use and in the type", () => {
    const kinds: Evidence[] = ["photo", "video", "photo-pair", "text-photo", "screenshot"];
    assert.deepEqual(Object.keys(EVIDENCE_LABEL).sort(), [...kinds].sort());
    for (const q of QUESTS) assert.ok(EVIDENCE_LABEL[q.evidence], `${q.id} evidence ${q.evidence}`);
    for (const k of kinds) assert.ok(EVIDENCE_LABEL[k].length > 0);
  });

  test("getQuest finds by id and misses cleanly", () => {
    assert.equal(getQuest("recreate")?.evidence, "photo-pair");
    assert.equal(getQuest("nope"), undefined);
  });
});
