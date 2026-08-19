"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MinervaLogo } from "@/components/MinervaLogo";
import { HoverTip } from "@/components/HoverTip";
import {
  REUNION_DATES,
  REUNION_PLACE,
  RSVP_DEADLINE_LABEL,
  RSVP_DEADLINE_NOTE,
  firstNameOf,
  type LetterInvite,
} from "@/lib/letter";
import {
  LETTER_BODY,
  LETTER_EYEBROW,
  LETTER_PHOTO_NOTE,
  LETTER_SIGNATURE,
  LETTER_SIGNOFF,
  UNFINISHED_NOTE,
} from "@/lib/letter-copy";

/**
 * The letter itself: a standalone, responsive page — deliberately NOT the macOS
 * desktop and NOT the fake Safari chrome. Most of these will be opened on a
 * phone, and more to the point, chrome reads as irony. A last sincere ask can't
 * afford any.
 */

/**
 * Copies THIS letter's URL, not the site root — so when they open it on a
 * laptop they land back on their own named letter with the RSVP button, rather
 * than at the top of the desktop with the thread lost.
 */
function CopyLetterLink() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older mobile browsers: the hidden-textarea trick, same as MobileShell.
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <button type="button" className="ltr-cta-btn" onClick={copy} aria-live="polite">
      {copied ? "Link copied ✓" : "Copy my letter link"}
    </button>
  );
}

export type Attendee = {
  name: string;
  photoUrl: string | null;
  status: "paid" | "processing";
};

/**
 * Everyone who's coming, fetched fresh when the roster is opened rather than
 * baked into the page — the count is the thing Ani watches, so it should be
 * true at the moment someone clicks it, not at the moment the page rendered.
 */
function Roster({ onClose }: { onClose: () => void }) {
  const [people, setPeople] = useState<Attendee[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/participants", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (cancelled) return;
        // /api/participants already drops failed payments, but `pending`
        // (abandoned checkout) is not actually attending. It returns snake_case.
        type Row = { name: string; photo_url: string | null; status: string };
        setPeople(
          (body.participants ?? [])
            .filter(
              (p: Row) => p.status === "paid" || p.status === "processing",
            )
            .map((p: Row) => ({
              name: p.name,
              photoUrl: p.photo_url,
              status: p.status as Attendee["status"],
            })),
        );
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ltr-roster-backdrop" onClick={onClose} role="presentation">
      <div
        className="ltr-roster"
        role="dialog"
        aria-modal="true"
        aria-label="Everyone who has RSVP'd"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ltr-roster-head">
          <h2 className="ltr-roster-title">
            Coming to San Francisco
            {people && <span className="ltr-roster-count">{people.length}</span>}
          </h2>
          <button
            type="button"
            className="ltr-roster-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="ltr-roster-list">
          {failed && <p className="ltr-roster-empty">Couldn&apos;t load the list.</p>}
          {!failed && !people && <p className="ltr-roster-empty">Loading…</p>}
          {people?.map((p, i) => (
            <div className="ltr-roster-row" key={`${p.name}-${i}`}>
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="ltr-roster-face" />
              ) : (
                <span className="ltr-roster-face ltr-roster-face-blank" aria-hidden="true" />
              )}
              <span className="ltr-roster-name">{p.name}</span>
              <span
                className={`ltr-roster-dot ltr-roster-dot-${p.status}`}
                title={
                  p.status === "paid" ? "Confirmed attending" : "Payment clearing"
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Photo = { src: string; alt: string; w: number; h: number };

/** Daylight to dark, Foundation Week to Friendsgiving, strangers to friends. */
const PHOTOS: Photo[] = [
  {
    src: "/assets/letter/01-foundation-week.jpg",
    alt: "Foundation Week in San Francisco — the class packed around tables in a bright room, most of us still strangers.",
    w: 1600,
    h: 1200,
  },
  {
    src: "/assets/letter/02-orientation-circles.jpg",
    alt: "Sitting on the floor in small circles, notebooks out, a Minerva water bottle in the middle of it.",
    w: 1600,
    h: 1200,
  },
  {
    src: "/assets/letter/03-friendsgiving-table.jpg",
    alt: "Friendsgiving — the long table mid-laugh, bread going hand to hand.",
    w: 1600,
    h: 1068,
  },
  {
    src: "/assets/letter/04-friendsgiving-plates.jpg",
    alt: "Five of us standing with paper plates against the brick wall, laughing at something off-camera.",
    w: 1600,
    h: 1068,
  },
  {
    src: "/assets/letter/05-friendsgiving-mic.jpg",
    alt: "Someone at the microphone under the Happy Friendsgiving banner, the room listening.",
    w: 1600,
    h: 1068,
  },
  {
    src: "/assets/letter/06-friendsgiving-group.jpg",
    alt: "The whole table turned toward the camera, plates cleared, lanterns overhead.",
    w: 1600,
    h: 1068,
  },
];

export function FinalLetter({
  invite,
  count,
  faces,
  closed,
}: {
  invite: LetterInvite;
  count: number;
  faces: Attendee[];
  /** Computed server-side per request — the route is force-dynamic. */
  closed: boolean;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);

  const first = firstNameOf(invite.name);

  const close = useCallback(() => setLightbox(null), []);
  const step = useCallback(
    (delta: number) =>
      setLightbox((i) => (i === null ? i : (i + delta + PHOTOS.length) % PHOTOS.length)),
    [],
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, close, step]);

  return (
    <main className="ltr-page">
      <div className="ltr-sheet">
        <header className="ltr-head">
          <MinervaLogo size={38} style={{ margin: "0 auto" }} />
          <p className="ltr-eyebrow">{LETTER_EYEBROW}</p>
        </header>

        <h1 className="ltr-greeting">Dear {first},</h1>

        <article className="ltr-body">
          {LETTER_BODY.map((block, i) => (
            <p
              key={i}
              className={block.style === "emphasis" ? "ltr-p ltr-p-emphasis" : "ltr-p"}
            >
              {block.text}
            </p>
          ))}

          {invite.variant === "unfinished" && (
            <p className="ltr-p ltr-p-emphasis">{UNFINISHED_NOTE}</p>
          )}

          <p className="ltr-signoff">{LETTER_SIGNOFF}</p>
          <p className="ltr-signature">{LETTER_SIGNATURE}</p>
        </article>

        {/* Below the letter, and deliberately small — a postscript rather than
            an argument. Click any one to see it full size. */}
        <p className="ltr-photo-note">{LETTER_PHOTO_NOTE}</p>
        <section className="ltr-strip" aria-label="Photographs from our freshman year">
          {PHOTOS.map((p, i) => (
            <button
              key={p.src}
              type="button"
              className="ltr-strip-item"
              onClick={() => setLightbox(i)}
              aria-label={`Open photograph ${i + 1} of ${PHOTOS.length}`}
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.h}
                sizes="(max-width: 700px) 40vw, 190px"
              />
            </button>
          ))}
        </section>

        <section className="ltr-event">
          <div className="ltr-event-when">
            <span className="ltr-event-label">When</span>
            <span className="ltr-event-value">{REUNION_DATES}</span>
          </div>
          <div className="ltr-event-divider" aria-hidden="true" />
          <div className="ltr-event-where">
            <span className="ltr-event-label">Where</span>
            <span className="ltr-event-value">{REUNION_PLACE}</span>
          </div>
        </section>

        {count > 0 && (
          <section className="ltr-proof">
            {faces.length > 0 && (
              <div className="ltr-faces">
                {faces
                  .filter((f) => f.photoUrl)
                  .slice(0, 10)
                  .map((f) => (
                    // Supabase storage URLs, unoptimized to avoid a remote-pattern
                    // config for one decorative row. `data-tip` is picked up by
                    // the site's global HoverTip, rendered at the end of this file.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f.photoUrl as string}
                      src={f.photoUrl as string}
                      alt={f.name}
                      data-tip={f.name}
                      className="ltr-face"
                    />
                  ))}
              </div>
            )}
            <p className="ltr-proof-text">
              <button
                type="button"
                className="ltr-proof-count"
                onClick={() => setRosterOpen(true)}
              >
                {count}
              </button>{" "}
              of us are already in.
            </p>
          </section>
        )}

        <section className="ltr-cta">
          {closed ? (
            <p className="ltr-closed">
              The RSVP deadline ended on {RSVP_DEADLINE_LABEL}. Registration
              and payments are now closed.
            </p>
          ) : (
            <>
              {/*
                Both CTAs render; CSS shows exactly one at the SAME 700px
                breakpoint the site uses to swap the desktop for the mobile
                card (NARROW_QUERY in lib/useIsNarrow). Doing this in CSS
                rather than JS avoids a hydration flash where a phone briefly
                sees an RSVP button that would dead-end on "use a computer".
              */}
              <div className="ltr-cta-wide">
                <Link className="ltr-cta-btn" href="/?open=rsvp">
                  {invite.variant === "unfinished"
                    ? "Finish your RSVP →"
                    : "RSVP →"}
                </Link>
                <p className="ltr-deadline">
                  {RSVP_DEADLINE_LABEL}
                  <span className="ltr-deadline-note">{RSVP_DEADLINE_NOTE}</span>
                </p>
              </div>

              <div className="ltr-cta-narrow">
                <p className="ltr-cta-narrow-note">
                  RSVP needs a photo and a payment, and it only works properly
                  on a computer. Send yourself this letter and finish there.
                </p>
                <CopyLetterLink />
                <p className="ltr-deadline">
                  {RSVP_DEADLINE_LABEL}
                  <span className="ltr-deadline-note">{RSVP_DEADLINE_NOTE}</span>
                </p>
              </div>
            </>
          )}
        </section>

        <footer className="ltr-foot">
          {/* `?open=alf` is the deep link added in Desktop.tsx — it skips the
              scripted intro and opens ALF directly. */}
          <Link href="/?open=alf" className="ltr-foot-link">
            Back to ALF →
          </Link>
        </footer>
      </div>

      {rosterOpen && <Roster onClose={() => setRosterOpen(false)} />}

      {/* The site's global tooltip — powers the names on face hover. */}
      <HoverTip />

      {lightbox !== null && (
        <div
          className="ltr-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photograph"
          onClick={close}
        >
          <button type="button" className="ltr-lb-close" onClick={close} aria-label="Close">
            ×
          </button>
          <button
            type="button"
            className="ltr-lb-nav ltr-lb-prev"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous photograph"
          >
            ‹
          </button>
          {/* No visible caption — the photographs speak for themselves, and a
              description under each one reads like a museum placard. `alt` is
              kept for screen readers. */}
          <figure className="ltr-lb-figure" onClick={(e) => e.stopPropagation()}>
            <Image
              src={PHOTOS[lightbox].src}
              alt={PHOTOS[lightbox].alt}
              width={PHOTOS[lightbox].w}
              height={PHOTOS[lightbox].h}
              sizes="92vw"
            />
          </figure>
          <button
            type="button"
            className="ltr-lb-nav ltr-lb-next"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next photograph"
          >
            ›
          </button>
        </div>
      )}
    </main>
  );
}
