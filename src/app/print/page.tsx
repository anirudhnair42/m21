import type { Metadata } from "next";
import { SESSIONS, getActivity } from "@/lib/weekend";
import "@/styles/print.css";

export const metadata: Metadata = {
  title: "RU26 · The run of show — Class of 2021",
  description: "The reunion weekend, printable. Sept 11–13, 2026, San Francisco.",
};

const DAY = { fri: "Friday, September 11", sat: "Saturday, September 12", sun: "Sunday, September 13" } as const;
const SITE = "https://www.m2021.co";

/** "Dahlia Dell · Dahlia Dell, Golden Gate Park…" reads twice; collapse when the address already starts with the venue. */
function where(venue?: string, address?: string): string {
  if (!venue) return address ?? "";
  if (!address) return venue;
  return address.toLowerCase().startsWith(venue.split(",")[0].toLowerCase()) ? address : `${venue} · ${address}`;
}

/**
 * The weekend on paper: the same course, sessions and run of show as the
 * Forum, laid out for a letter-size page. Print it, or save it as a PDF and
 * pass it around to anyone who can't get into the site.
 */
export default function PrintPage() {
  return (
    <main className="pr">
      <header className="pr-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/minerva-full.png" alt="Minerva" className="pr-mark" />
        <div>
          <div className="pr-eyebrow">Reunion course · Fall 2026 · San Francisco</div>
          <h1 className="pr-title">RU26 · Alumni Reunifications</h1>
          <div className="pr-sub">The run of show · September 11–13, 2026</div>
          <div className="pr-sub-2">Nair / Urdaneta / Muthukumaran / Rivera / Torento / Graves</div>
        </div>
        <div className="pr-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=0&data=${encodeURIComponent(SITE)}`} alt="QR code to m2021.co" width={80} height={80} />
          <span>m2021.co</span>
        </div>
      </header>

      {SESSIONS.map((s) => {
        const rows = s.activities.map(getActivity).filter((a): a is NonNullable<typeof a> => !!a);
        const side = s.side.map(getActivity).filter((a): a is NonNullable<typeof a> => !!a);
        return (
          <section key={s.id} className="pr-session">
            <div className="pr-session-head">
              <div className="pr-chip"><b>{DAY[s.day].split(", ")[1].split(" ")[1]}</b><span>{DAY[s.day].slice(0, 3)}</span></div>
              <div>
                <div className="pr-eyebrow">{DAY[s.day]} · Session {s.number}</div>
                <h2 className="pr-session-title">{s.title}</h2>
                <div className="pr-session-sub">{s.sub}</div>
              </div>
            </div>
            <table className="pr-table">
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className={a.required ? "pr-req" : a.kind === "anchor" ? "" : "pr-opt"}>
                    <td className="pr-time">{a.time}</td>
                    <td className="pr-what">
                      <div className="pr-name">{a.title}{a.required && <span className="pr-tag">Main event</span>}</div>
                      <div className="pr-where">{where(a.venue, a.address)}{a.host ? ` · ${a.host}` : ""}</div>
                      <div className="pr-body">{a.body}</div>
                    </td>
                  </tr>
                ))}
                {side.map((a) => (
                  <tr key={a.id} className="pr-side">
                    <td className="pr-time">{a.time}</td>
                    <td className="pr-what">
                      <div className="pr-name">{a.title}<span className="pr-tag pr-tag-side">Side quest</span></div>
                      <div className="pr-where">{where(a.venue, a.address)}{a.host ? ` · with ${a.host}` : ""}{a.cost ? ` · ${a.cost}` : ""}</div>
                      <div className="pr-body">{a.body}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

    </main>
  );
}
