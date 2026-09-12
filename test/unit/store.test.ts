import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { djb2, firstName, parseNowParam, proofKey, questTitle, readNowOffset, timeShort, uid } from "../../src/components/forum/store";

describe("parseNowParam / readNowOffset (?now= demo clock, San Francisco wall time)", () => {
  test("date+time is PT", () => {
    assert.equal(new Date(parseNowParam("2026-09-12T14:14")).toISOString(), "2026-09-12T21:14:00.000Z");
    assert.equal(new Date(parseNowParam("2026-09-12T14:14:30")).toISOString(), "2026-09-12T21:14:30.000Z");
    assert.equal(new Date(parseNowParam("2026-09-12 14:14")).toISOString(), "2026-09-12T21:14:00.000Z", "a space for the T");
  });
  test("date only is noon PT", () => {
    assert.equal(new Date(parseNowParam("2026-09-12")).toISOString(), "2026-09-12T19:00:00.000Z");
  });
  test("an explicit zone is honored as written", () => {
    assert.equal(new Date(parseNowParam("2026-09-12T21:14:00Z")).toISOString(), "2026-09-12T21:14:00.000Z");
    assert.equal(new Date(parseNowParam("2026-09-12T14:14-07:00")).toISOString(), "2026-09-12T21:14:00.000Z");
  });
  test("garbage is NaN, and readNowOffset turns it into no offset", () => {
    assert.ok(Number.isNaN(parseNowParam("tomorrow")));
    assert.ok(Number.isNaN(parseNowParam("2026-09-12T14")));
    assert.equal(readNowOffset("?now=tomorrow"), 0);
    assert.equal(readNowOffset("?tab=inbox"), 0);
    assert.equal(readNowOffset(""), 0);
  });
  test("readNowOffset is safe without a window (SSR) and computes the offset from now", () => {
    assert.equal(typeof window, "undefined");
    assert.equal(readNowOffset(), 0);
    const before = Date.now();
    const off = readNowOffset("?now=2026-09-12T14:14");
    const target = Date.parse("2026-09-12T21:14:00Z");
    assert.ok(Math.abs(off - (target - before)) < 1000);
  });
});

describe("timeShort always shows San Francisco time", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });
  for (const tz of ["Asia/Kolkata", "UTC", "Pacific/Auckland"]) {
    test(`in ${tz}`, () => {
      process.env.TZ = tz;
      assert.match(timeShort("2026-09-12T21:14:00Z"), /^2:14\sPM$/);
      assert.match(timeShort(Date.parse("2026-09-13T00:07:00Z")), /^5:07\sPM$/);
      assert.match(timeShort("2026-09-12T17:00:00Z"), /^10:00\sAM$/);
    });
  }
});

describe("proofKey (idempotency across retries)", () => {
  const file = (name: string, size = 1000, lastModified = 1_700_000_000_000, type = "image/jpeg") => ({ name, size, lastModified, type });
  const me = "0b6a5f2e-1111-4c1d-9a2b-3c4d5e6f7a8b";

  test("is deterministic for the same person, quest, instance and files", () => {
    const a = proofKey(me, "parks", 2, [file("a.jpg"), file("b.jpg")]);
    const b = proofKey(me, "parks", 2, [file("a.jpg"), file("b.jpg")]);
    assert.equal(a, b);
  });
  test("changes with any of the inputs", () => {
    const base = proofKey(me, "parks", 2, [file("a.jpg")]);
    assert.notEqual(base, proofKey(me, "parks", 3, [file("a.jpg")]), "instance");
    assert.notEqual(base, proofKey(me, "landmark", 2, [file("a.jpg")]), "quest");
    assert.notEqual(base, proofKey("another-id", "parks", 2, [file("a.jpg")]), "person");
    assert.notEqual(base, proofKey(me, "parks", 2, [file("a.jpg", 1001)]), "file size");
    assert.notEqual(base, proofKey(me, "parks", 2, [file("a.jpg", 1000, 1)]), "file mtime");
    assert.notEqual(base, proofKey(me, "parks", 2, [file("a.jpg"), file("b.jpg")]), "file count");
    assert.notEqual(base, proofKey(me, "parks", 2, [file("b.jpg")]), "file name");
  });
  test("fits the API's 80-char cap and stays url/ascii-safe, even for long custom quest ids", () => {
    const key = proofKey(me, "an-organizer-added-quest-with-a-very-long-slug-indeed", 12, [file("IMG_0001 (edited).HEIC", 48_000_000), file("x.mov", 5, 0, "video/quicktime")]);
    assert.ok(key.length <= 80, `${key.length} chars`);
    assert.match(key, /^p_[a-z0-9]+_[a-z0-9-]{1,24}_\d+_[a-z0-9]+_[a-z0-9]+$/);
  });
});

describe("small helpers", () => {
  test("djb2 is stable", () => {
    assert.equal(djb2(""), 5381);
    assert.equal(djb2("a"), djb2("a"));
    assert.notEqual(djb2("a"), djb2("b"));
    assert.ok(djb2("anything") >= 0, "unsigned");
  });
  test("uid is unique and short", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5000; i++) ids.add(uid());
    assert.equal(ids.size, 5000);
    for (const id of ids) {
      assert.match(id, /^[a-z0-9]+$/);
      assert.ok(id.length <= 40);
      break;
    }
  });
  test("firstName and questTitle", () => {
    assert.equal(firstName("Nathan Torento"), "Nathan");
    assert.equal(firstName("Cher"), "Cher");
    assert.equal(firstName(""), "");
    assert.equal(questTitle("851"), "Selfie at 851");
    assert.equal(questTitle("custom-1"), "custom-1");
  });
});
