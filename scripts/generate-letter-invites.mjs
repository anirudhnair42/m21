/**
 * Mint one unguessable letter link per person who still hasn't RSVP'd.
 *
 *   node scripts/generate-letter-invites.mjs            # dry run, prints only
 *   node scripts/generate-letter-invites.mjs --write    # upsert into Supabase
 *   node scripts/generate-letter-invites.mjs --write --csv merge.csv
 *
 * Idempotent: someone who already has a token keeps it, so re-running before
 * the send never invalidates a link that has already gone out. Run it again
 * right before sending — `buildFollowupList()` re-derives the audience, so
 * anyone who RSVP'd in the meantime is simply absent from the CSV.
 *
 * Requires sql/letter-invites.sql to have been run in the Supabase SQL editor.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildFollowupList } from "./followup-list.mjs";

/** Where the letters live. Override with --base-url for a preview deploy. */
const baseIndex = process.argv.indexOf("--base-url");
const BASE_URL =
  baseIndex > -1 ? process.argv[baseIndex + 1] : "https://www.m2021.co";

/**
 * The prose has to be signed off before any address list can be exported.
 * Read straight from the source of truth rather than duplicating the flag, so
 * there is exactly one place to change your mind.
 */
function letterIsApproved() {
  const src = readFileSync("src/lib/letter-copy.ts", "utf8");
  return /LETTER_APPROVED\s*=\s*true/.test(src);
}

/** 24 url-safe chars ≈ 144 bits. Not enumerable, not derived from the email. */
const mintToken = () => randomBytes(18).toString("base64url");

const write = process.argv.includes("--write");
const csvIndex = process.argv.indexOf("--csv");
const csvPath = csvIndex > -1 ? process.argv[csvIndex + 1] : null;

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

const { list, counts } = await buildFollowupList();
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Keep tokens that already exist — a link that has been emailed must not change.
const { data: existingRows, error: readError } = await supabase
  .from("letter_invites")
  .select("token, email, name, variant");
if (readError) {
  console.error(
    `✗ couldn't read letter_invites: ${readError.message}\n` +
      "  Has sql/letter-invites.sql been run in the Supabase SQL editor?",
  );
  process.exit(1);
}
const existing = new Map(
  (existingRows ?? []).map((r) => [r.email.toLowerCase(), r]),
);

const rows = list.map((p) => {
  const prior = existing.get(p.email);
  return {
    token: prior?.token ?? mintToken(),
    email: p.email,
    name: p.name,
    variant: p.variant,
    isNew: !prior,
  };
});

const fresh = rows.filter((r) => r.isNew).length;
console.log(
  `${counts.followup} people · ${fresh} new token${fresh === 1 ? "" : "s"} · ` +
    `${rows.length - fresh} reused`,
);

if (write) {
  const { error } = await supabase.from("letter_invites").upsert(
    rows.map(({ isNew, ...r }) => r), // eslint-disable-line no-unused-vars
    { onConflict: "token" },
  );
  if (error) {
    console.error(`✗ upsert failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ wrote ${rows.length} rows to letter_invites`);
} else {
  console.log("(dry run — pass --write to save)");
}

if (csvPath) {
  if (!letterIsApproved()) {
    console.error(
      "✗ Refusing to write the merge list: LETTER_APPROVED is false in\n" +
        "  src/lib/letter-copy.ts. The letter has not been signed off.",
    );
    process.exit(1);
  }
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = [
    "name,first_name,email,variant,letter_url",
    ...rows.map((r) =>
      [
        esc(r.name),
        esc(r.name.trim().split(/\s+/)[0]),
        esc(r.email),
        esc(r.variant),
        esc(`${BASE_URL}/letter/${r.token}`),
      ].join(","),
    ),
  ].join("\n");
  writeFileSync(csvPath, csv + "\n");
  console.log(`✓ wrote ${csvPath} — import this into the mail-merge Sheet`);
}

// Show a couple so the URL shape is eyeballable without dumping 63 secrets.
for (const r of rows.slice(0, 2)) {
  console.log(`  ${r.name} → ${BASE_URL}/letter/${r.token}`);
}
