"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Person = { id: string; name: string; photo_url: string | null; voice_url: string | null };

/** Kahoot clip order. Numbers only on screen, so the room can't read the answer. */
const CLIPS = ["Haruna Katayama", "Hung Nguyen", "Kevin Yang", "Michelle", "Luis Gonzalez", "Nathan Torento", "Megan Cho"];

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
      const all = (p.participants as Person[]).filter((x) => x.voice_url);
      setPeople(CLIPS.map((n) => all.find((x) => x.name === n)).filter((x): x is Person => !!x));
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
          <h1 className="alf-fb-title">RU26 – Whose voice is this?</h1>
          <p className="alf-fb-sub">Kahoot clips 1–7 · play, then reveal the options</p>
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
            <h2 className="alf-card-h">{people.length} clips</h2>
            <ul className="fm-quests">
              {people.map((p, i) => (
                <li key={p.id} className="fm-quest" style={{ cursor: "default", gridTemplateColumns: "1fr", alignItems: "start" }}>
                  <span>
                    <div className="fm-quest-title">Clip {i + 1}</div>
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
