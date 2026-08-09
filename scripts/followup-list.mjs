/**
 * Who still needs to RSVP — the audience for the final-call letter.
 *
 * Run `node scripts/followup-list.mjs` to print the list, or
 * `node scripts/followup-list.mjs --json` to pipe it somewhere.
 *
 * Re-runnable on purpose: run it again right before sending so anyone who
 * RSVP'd in the meantime drops out. Nobody who just paid $100 should receive
 * an email telling them they haven't.
 *
 * Read-only. Writes nothing.
 *
 * Pruning `considering` by email alone is NOT enough: three people signed in
 * with one Google account and RSVP'd with another, so their email never
 * matched and they looked like no-shows. Matching on a normalized name catches
 * them.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (matches scripts/check-setup.mjs).
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
} catch {
  console.error("✗ .env.local not found");
  process.exit(1);
}

/** Money received or in flight. A `pending` row is an abandoned checkout — */
/** that person still needs the nudge, so they are NOT counted as attending. */
const ATTENDING = ["paid", "processing"];

/** Ani's own accounts. He RSVP'd as "Anirudh Nair"; `considering` has "Ani Nair". */
const SELF = ["ani@base10.vc", "anirudhnair42@gmail.com"];

/**
 * Minerva STAFF, not Class of 2021. `@minerva.edu` is the employee domain;
 * students and alumni are on `@uni.minerva.edu`. Confirmed by Ani, Aug 2026:
 * Branden Balenzuela, Jamina Cole King, Veselina Nedelcheva, Camila Loureiro.
 */
const isStaffDomain = (email) => /@minerva\.edu$/i.test(email);

/**
 * Same person under two names, which normalization can't catch.
 * Confirmed by Ani: "John Song" is "Byungchul (Peter) Song", who has RSVP'd.
 * (By contrast "Trang Nguyen" and "Hung Nguyen" ARE different people.)
 */
const ALIASES_OF_ATTENDEES = ["hrsong99@gmail.com"];

/** Strip accents, punctuation and case so "José Alvarez" == "jose alvarez". */
export function normalize(s) {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

const firstLast = (name) => {
  const p = normalize(name).split(" ");
  return p.length >= 2 ? `${p[0]} ${p[p.length - 1]}` : null;
};

/** When one person has two Google accounts, keep the Minerva address — it's */
/** the one they're most likely to still check. */
const prefersMinerva = (a, b) => {
  const score = (e) => (/@uni\.minerva\.edu$/i.test(e) ? 0 : 1);
  return score(a.email) - score(b.email);
};

export async function buildFollowupList() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase not configured — need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [considering, rsvps] = await Promise.all([
    supabase.from("considering").select("name, email, created_at").limit(1000),
    supabase.from("rsvps").select("name, email, status").limit(1000),
  ]);
  if (considering.error) throw new Error(considering.error.message);
  if (rsvps.error) throw new Error(rsvps.error.message);

  const attending = (rsvps.data ?? []).filter((r) =>
    ATTENDING.includes(r.status),
  );
  const attendingEmails = new Set(
    attending.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean),
  );
  const attendingNames = new Set(attending.map((r) => normalize(r.name)));
  const attendingFirstLast = new Set(
    attending.map((r) => firstLast(r.name)).filter(Boolean),
  );

  const dropped = { rsvpedEmail: [], rsvpedName: [], self: [], staff: [], alias: [], duplicate: [] };
  const kept = [];

  for (const c of considering.data ?? []) {
    const email = (c.email ?? "").toLowerCase();
    if (attendingEmails.has(email)) {
      dropped.rsvpedEmail.push(c);
    } else if (
      attendingNames.has(normalize(c.name)) ||
      attendingFirstLast.has(firstLast(c.name))
    ) {
      dropped.rsvpedName.push(c);
    } else if (SELF.includes(email)) {
      dropped.self.push(c);
    } else if (isStaffDomain(email)) {
      dropped.staff.push(c);
    } else if (ALIASES_OF_ATTENDEES.includes(email)) {
      dropped.alias.push(c);
    } else {
      kept.push(c);
    }
  }

  // Collapse one person holding two Google accounts.
  const byPerson = new Map();
  for (const c of kept) {
    const k = firstLast(c.name) ?? normalize(c.name);
    const existing = byPerson.get(k);
    if (!existing) {
      byPerson.set(k, c);
    } else if (prefersMinerva(c, existing) < 0) {
      dropped.duplicate.push(existing);
      byPerson.set(k, c);
    } else {
      dropped.duplicate.push(c);
    }
  }

  const list = [...byPerson.values()]
    .map((c) => ({
      name: c.name,
      email: c.email.toLowerCase(),
      // Started checkout and never paid — the ask is "finish", not "RSVP".
      variant: "default",
    }))
    .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));

  // Anyone with an abandoned checkout gets the "you're one click away" letter.
  const unfinished = new Set(
    (rsvps.data ?? [])
      .filter((r) => r.status === "pending")
      .map((r) => (r.email ?? "").toLowerCase()),
  );
  for (const p of list) if (unfinished.has(p.email)) p.variant = "unfinished";

  return {
    list,
    dropped,
    counts: {
      considering: (considering.data ?? []).length,
      attending: attending.length,
      followup: list.length,
    },
  };
}

// ---- CLI ------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { list, dropped, counts } = await buildFollowupList();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(list, null, 2));
  } else {
    console.log(
      `considering ${counts.considering} · attending ${counts.attending} · follow-up ${counts.followup}\n`,
    );
    const show = (label, rows) =>
      rows.length &&
      console.log(
        `  removed ${String(rows.length).padStart(3)}  ${label}` +
          (rows.length <= 5
            ? `  (${rows.map((r) => r.name).join(", ")})`
            : ""),
      );
    show("already RSVP'd, email matched", dropped.rsvpedEmail);
    show("already RSVP'd, NAME matched (different email)", dropped.rsvpedName);
    show("Ani himself", dropped.self);
    show("Minerva staff, not Class of 2021", dropped.staff);
    show("alias of someone who RSVP'd", dropped.alias);
    show("duplicate Google account", dropped.duplicate);

    console.log(`\n${counts.followup} people:\n`);
    list.forEach((p, i) => {
      const tag = p.variant === "unfinished" ? "  ← abandoned checkout" : "";
      console.log(`${String(i + 1).padStart(3)}. ${p.name.padEnd(34)} ${p.email}${tag}`);
    });
  }
}
