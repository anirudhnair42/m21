// Insert or delete a marked test RSVP row. Usage: node testrow.mjs insert|delete
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(
  ".env.local",
  "utf8",
).split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);

const mode = process.argv[2];
if (mode === "insert") {
  const { data, error } = await supabase
    .from("rsvps")
    .insert({
      name: "ZZ Claude Test",
      from_city: "Testville",
      payment_method: "card",
      amount_cents: 10330,
      status: "paid",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  console.log(data.id);
} else if (mode === "delete") {
  const { error, count } = await supabase
    .from("rsvps")
    .delete({ count: "exact" })
    .eq("name", "ZZ Claude Test");
  if (error) throw new Error(error.message);
  console.log(`deleted ${count} test row(s)`);
} else {
  throw new Error("usage: node testrow.mjs insert|delete");
}
