import { gateLists, handler, json, must, requireOrganizer, sameName } from "@/lib/forum-server";
import type { PeopleResponse } from "@/lib/questival-api";

type Row = { id: string; name: string; photo_url: string | null; email: string | null; status: string };

/**
 * The people desk: every RSVP that isn't failed, with email and status, and
 * whether they count as an organizer under the current env allowlists.
 */
export const GET = handler(async (request) => {
  const { supabase } = await requireOrganizer(request);
  const rows = (must(
    await supabase
      .from("rsvps")
      .select("id, name, photo_url, email, status")
      .in("status", ["paid", "processing", "pending"])
      .order("name", { ascending: true }),
  ) ?? []) as Row[];

  const { testerEmails, testerNames, organizerEmails } = gateLists();
  const isOrganizer = (r: Row) => {
    const email = r.email?.toLowerCase() ?? "";
    return (
      (!!email && (organizerEmails.includes(email) || testerEmails.includes(email))) ||
      testerNames.some((n) => sameName(n, r.name))
    );
  };
  const body: PeopleResponse = {
    people: rows.map((r) => ({
      id: r.id,
      name: r.name,
      photo_url: r.photo_url ?? null,
      email: r.email ?? null,
      status: r.status,
      organizer: isOrganizer(r),
    })),
  };
  return json(body);
});
