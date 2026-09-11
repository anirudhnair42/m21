"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Person = { id: string; name: string; photo_url: string | null; voice_url: string | null };

/**
 * Organizers only: every voice note recorded at RSVP, with a player, so the
 * Kahoot "whose voice is this" clips can be picked. Data is the public
 * participants list; the page just gates the listening room.
 */
export default function VoicesPage() {
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    getSupabaseBrowser();
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/forum/access", { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
      const b = r?.ok ? await r.json().catch(() => ({})) : {};
      if (cancelled) return;
      if (!b.organizer) {
        setState("denied");
        return;
      }
      const p = await fetch("/api/participants").then((x) => (x.ok ? x.json() : { participants: [] })).catch(() => ({ participants: [] }));
      if (cancelled) return;
      setPeople((p.participants as Person[]).filter((x) => x.voice_url));
      setState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fm fm-embed" style={{ position: "fixed" }}>
      <header className="alf-fb">
        <div className="alf-fb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/minerva-wordmark.png" alt="Minerva University" className="alf-fb-brand-img" />
        </div>
        <div className="alf-fb-inner">
          <h1 className="alf-fb-title">RU26 – The voice notes</h1>
          <p className="alf-fb-sub">Organizers only · recorded at RSVP</p>
        </div>
        <div className="alf-fb-user" />
      </header>
      <main className="fm-main">
        {state === "loading" && <p className="fm-empty">Checking…</p>}
        {state === "denied" && (
          <section className="alf-card"><p className="fm-empty">Organizers only. Sign in at m2021.co first, then come back here.</p></section>
        )}
        {state === "ok" && (
          <section className="alf-card">
            <h2 className="alf-card-h">{people.length} voice notes</h2>
            <ul className="fm-quests">
              {people.map((p, i) => (
                <li key={p.id} className="fm-quest" style={{ cursor: "default", gridTemplateColumns: "28px 1fr", alignItems: "start" }}>
                  <span className="fm-muted" style={{ fontFamily: "var(--font-mono)" }}>{i + 1}</span>
                  <span>
                    <div className="fm-quest-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photo_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <span className="fm-face" style={{ margin: 0, width: 26, height: 26 }} />
                      )}
                      {p.name}
                    </div>
                    <audio controls preload="none" src={p.voice_url ?? undefined} style={{ width: "100%", marginTop: 6 }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
