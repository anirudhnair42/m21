"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MinervaLogo } from "@/components/MinervaLogo";
import {
  REUNION_DATES,
  REUNION_PLACE,
  RSVP_DEADLINE_LABEL,
  firstNameOf,
  type LetterInvite,
} from "@/lib/letter";
import {
  LETTER_BODY,
  LETTER_EYEBROW,
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
  faces: string[];
  /** Computed server-side per request — the route is force-dynamic. */
  closed: boolean;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);

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

        <section className="ltr-strip" aria-label="Photographs from our four years">
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
                sizes="(max-width: 700px) 78vw, 340px"
                priority={i < 2}
              />
            </button>
          ))}
        </section>

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
              <div className="ltr-faces" aria-hidden="true">
                {faces.slice(0, 10).map((src) => (
                  // Supabase storage URLs, unoptimized to avoid a remote-pattern
                  // config for one decorative row.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="ltr-face" />
                ))}
              </div>
            )}
            <p className="ltr-proof-text">
              <strong>{count}</strong> of us are already in.
            </p>
          </section>
        )}

        <section className="ltr-cta">
          {closed ? (
            <p className="ltr-closed">
              RSVP closed on {RSVP_DEADLINE_LABEL}. If you still want to come,
              write to Ani — there may be room.
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
                <p className="ltr-deadline">{RSVP_DEADLINE_LABEL}</p>
              </div>

              <div className="ltr-cta-narrow">
                <p className="ltr-cta-narrow-note">
                  RSVP needs a photo and a payment, and it only works properly
                  on a computer. Send yourself this letter and finish there.
                </p>
                <CopyLetterLink />
                <p className="ltr-deadline">{RSVP_DEADLINE_LABEL}</p>
              </div>
            </>
          )}
        </section>

        <footer className="ltr-foot">
          <Link href="/" className="ltr-foot-link">
            There&apos;s a whole desktop if you want to wander →
          </Link>
        </footer>
      </div>

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
          <figure className="ltr-lb-figure" onClick={(e) => e.stopPropagation()}>
            <Image
              src={PHOTOS[lightbox].src}
              alt={PHOTOS[lightbox].alt}
              width={PHOTOS[lightbox].w}
              height={PHOTOS[lightbox].h}
              sizes="92vw"
            />
            <figcaption className="ltr-lb-caption">{PHOTOS[lightbox].alt}</figcaption>
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
