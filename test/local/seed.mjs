// Seed the throwaway database with a fake class. Never points at prod:
// it refuses any SUPABASE_URL that isn't localhost.
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL;
if (!url || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("seed only runs against a local PostgREST");
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const FIRST = ["Ava","Ben","Chloe","Dan","Ella","Finn","Gia","Hugo","Iris","Jon","Kai","Lena","Milo","Nia","Omar","Pia","Quinn","Rae","Sam","Tara","Uma","Vik","Wren","Xia","Yara","Zed","Amir","Bea","Cole","Dee"];
const LAST = ["Stone","Reyes","Okafor","Lind","Park","Nair","Costa","Haas","Ito","Novak"];
const rows = [];
for (let i = 0; i < 60; i++) {
  const name = `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}${i >= 30 ? " " + (i + 1) : ""}`;
  rows.push({ name, email: `user${i + 1}@test.local`, status: i < 52 ? "paid" : i < 56 ? "processing" : "pending", photo_url: i % 3 ? `https://picsum.photos/seed/${i}/120` : null, payment_method: "card", amount_cents: 10330 });
}
// A few known people the gate lists name.
rows.push({ name: "Anirudh Nair", email: "ani@test.local", status: "paid", payment_method: "card", amount_cents: 10330 });
rows.push({ name: "Nathan Torento", email: "nathan@test.local", status: "paid", payment_method: "card", amount_cents: 10330 });
rows.push({ name: "Mau Urdaneta", email: "mau@test.local", status: "paid", payment_method: "card", amount_cents: 10330 });
const { data, error } = await supabase.from("rsvps").insert(rows).select("id, name, email, status");
if (error) throw new Error(error.message);
console.log(JSON.stringify(data));
