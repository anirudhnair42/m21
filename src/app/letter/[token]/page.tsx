import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { firstNameOf, isRsvpClosed, type LetterInvite } from "@/lib/letter";
import { FinalLetter, type Attendee } from "@/components/letter/FinalLetter";

/**
 * One person's final-call letter, addressed by name, reachable only through an
 * unguessable token. No sign-in to READ — the greeting has to land before
 * anything is asked. Signing in is still required to RSVP, which is enforced
 * server-side in /api/rsvp, so a forwarded link can't produce a false RSVP.
 */

// The token is looked up per request and `opened_at` is stamped; never cache.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/** Tokens are 24 chars of url-safe base64 from crypto.randomBytes. */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

async function getInvite(token: string): Promise<LetterInvite | null> {
  if (!TOKEN_RE.test(token)) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("letter_invites")
    .select("token, name, email, variant")
    .eq("token", token)
    .maybeSingle();
  return (data as LetterInvite) ?? null;
}

/**
 * Attendee count + a handful of faces — the most persuasive thing on the page.
 * Names ride along so each face can name itself on hover. They're already
 * public via /api/participants and the ALF participant rail, so nothing new is
 * exposed here; emails never leave the server.
 */
async function getProof(): Promise<{ count: number; faces: Attendee[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { count: 0, faces: [] };

  const [total, faces] = await Promise.all([
    supabase
      .from("rsvps")
      .select("id", { count: "exact", head: true })
      .in("status", ["paid", "processing"]),
    supabase
      .from("rsvps")
      .select("name, photo_url, status")
      .in("status", ["paid", "processing"])
      .not("photo_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    count: total.count ?? 0,
    faces: (faces.data ?? [])
      .filter((r) => r.photo_url)
      .map((r) => ({
        name: (r.name as string) ?? "",
        photoUrl: r.photo_url as string,
        status: r.status as Attendee["status"],
      })),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const invite = await getInvite(token);
  if (!invite) return { title: "The Reunion · Class of 2021" };

  const first = firstNameOf(invite.name);
  return {
    title: `${first}, one last thing · The Reunion`,
    description:
      "Minerva University Class of 2021 — five-year reunion in San Francisco, September 11–13, 2026.",
    // A private letter should never be indexed or previewed by a crawler.
    robots: { index: false, follow: false },
  };
}

export default async function LetterPage({ params }: Params) {
  const { token } = await params;
  const invite = await getInvite(token);
  if (!invite) notFound();

  // Record the first open. Awaited rather than fired-and-forgotten: an
  // unawaited promise can be killed when the function returns.
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase
      .from("letter_invites")
      .update({ opened_at: new Date().toISOString() })
      .eq("token", token)
      .is("opened_at", null);
  }

  const proof = await getProof();
  return (
    <FinalLetter
      invite={invite}
      count={proof.count}
      faces={proof.faces}
      closed={isRsvpClosed()}
    />
  );
}
