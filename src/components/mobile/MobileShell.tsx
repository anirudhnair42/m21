"use client";

import { MinervaWordmark } from "@/components/MinervaLogo";

/**
 * Mobile is intentionally minimal: the scripted iOS experience only shines on a
 * desktop, so phones get a single tasteful invitation card that points people
 * there rather than a degraded version of the full flow.
 */
export function MobileShell() {
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
