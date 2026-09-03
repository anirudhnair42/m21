"use client";

import { useRef, useState } from "react";
import { MinervaWordmark } from "@/components/MinervaLogo";
import { MobileHotel } from "@/components/mobile/MobileHotel";
import { AidApp } from "@/components/apps/AidApp";
import { RSVPApp } from "@/components/apps/RSVPApp";
import { getInviteToken } from "@/lib/lateInvite";

/**
 * Mobile is intentionally minimal: the scripted iOS experience only shines on a
 * desktop, so phones get a single tasteful invitation card that points people
 * there rather than a degraded version of the full flow. The one exception is
 * the housing deeplink (/?open=stay) from Branden's email: someone on a phone
 * who just wants a room shouldn't need a computer to book one. The unlisted
 * financial-aid link (/?open=aid) is the same idea: someone asking for help is
 * likely doing it from a phone, so the form works here too.
 */
export function MobileShell() {
  const [openParam] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("open");
  });
  // A late-RSVP invite works on a phone too — someone who missed the deadline
  // shouldn't be told to find a computer just to register.
  const [invited] = useState(() => getInviteToken() !== null);

  if (openParam === "stay") return <MobileHotel />;
  if (openParam === "aid") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--minerva-paper)" }}>
        <AidApp />
      </div>
    );
  }
  if (invited) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--minerva-paper)" }}>
        <RSVPApp />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: "48px 28px",
        textAlign: "center",
        background: "#f6f3ec",
        color: "#1a1a1a",
      }}
    >
      <MinervaWordmark width={200} />

      <p
        style={{
          fontFamily: "var(--serif-font-family)",
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          maxWidth: 420,
          margin: 0,
          textWrap: "balance",
        }}
      >
        We are organizing a special homecoming for M21s on{" "}
        <strong style={{ fontWeight: 600 }}>September 11&ndash;13</strong>{" "}
        in San Francisco.

    <br/><br/>

    We created a special invitation for you, but the experience is much better on wider screens. Please visit this website on a computer


    <br/><br/>
    <em style={{ fontStyle: "italic", fontWeight: 300 }}>
          Trust us, it&rsquo;ll be worth it&nbsp;;)
        </em>

  </p>

      <CopyLinkButton />

  <p
        style={{
          fontFamily: "var(--serif-font-family)",
          fontWeight: 400,
          fontSize: 12,
          lineHeight: 1.5,
          width: "100%",
          maxWidth: 420,
          margin: 0,
        }}
      >
    &ndash; Ani, Amal, Anna, Dulce, Mau, Nathan
  </p>


    </div>
  );
}

/** Copies the site URL so people can send it to their computer. */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older mobile browsers: fall back to the hidden-textarea trick.
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
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2200);
  };

  return (
    <button
      className={`invite-copy ${copied ? "invite-copy-done" : ""}`}
      onClick={copy}
      aria-live="polite"
    >
      {copied ? "Link copied ✓" : "Copy the link"}
    </button>
  );
}
