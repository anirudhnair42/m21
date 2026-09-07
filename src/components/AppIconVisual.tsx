import type { AppDef } from "@/lib/apps";
import { MinervaLogo } from "@/components/MinervaLogo";

type Props = { app: AppDef; size?: number };

function ImgIcon({ src, alt, size }: { src: string; alt: string; size: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      style={{
        width: size,
        height: size,
        display: "block",
        objectFit: "contain",
        userSelect: "none",
        filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.35))",
      }}
    />
  );
}

export function AppIconVisual({ app, size = 56 }: Props) {
  const radius = size <= 48 ? 11 : 13;
  const glyphSize = size <= 48 ? 26 : 30;

  if (app.icon === "alf") {
    return (
      <div
        className="icon-app icon-alf"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <MinervaLogo size={Math.round(size * 0.62)} invert />
      </div>
    );
  }

  if (app.icon === "calendar") {
    return (
      <div
        className="icon-app icon-cal-app"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        <div className="icon-cal-strip">JUL</div>
        <div className="icon-cal-num">17</div>
      </div>
    );
  }

  if (app.icon === "calendar-sep") {
    return (
      <div className="icon-app icon-cal-app" style={{ width: size, height: size, borderRadius: radius }}>
        <div className="icon-cal-strip">SEP</div>
        <div className="icon-cal-num">12</div>
      </div>
    );
  }

  if (app.icon === "maps") {
    return (
      <div className="icon-app icon-maps" style={{ width: size, height: size, borderRadius: radius }} aria-label="Maps">
        <svg viewBox="0 0 56 56" width={size} height={size} style={{ display: "block", borderRadius: radius }}>
          <rect width="56" height="56" fill="#eef3e6" />
          <path d="M0 22 Q18 18 28 30 T56 34 L56 40 Q38 42 28 36 T0 28 Z" fill="#c9e3f5" />
          <path d="M-2 14 L58 6" stroke="#fff" strokeWidth="5" />
          <path d="M-2 14 L58 6" stroke="#f6d98a" strokeWidth="3" />
          <path d="M18 -2 L26 58" stroke="#fff" strokeWidth="4" />
          <path d="M-2 42 L58 46" stroke="#fff" strokeWidth="3" />
          <path d="M36 -2 L44 58" stroke="#fff" strokeWidth="3" />
          <path d="M8 48 Q16 20 40 12" stroke="#4f8fdd" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <circle cx="30" cy="27" r="7.5" fill="#e0443e" stroke="#fff" strokeWidth="2" />
          <circle cx="30" cy="27" r="2.6" fill="#fff" />
        </svg>
      </div>
    );
  }

  if (app.icon === "photos") {
    const petals = ["#f3b13a", "#7cc242", "#3ab8e0", "#4a7fe0", "#9a63d6", "#e0439a", "#ef5b3a", "#f38f2a"];
    return (
      <div className="icon-app icon-photos" style={{ width: size, height: size, borderRadius: radius }} aria-label="Photos">
        <svg viewBox="0 0 56 56" width={size} height={size} style={{ display: "block" }}>
          {petals.map((c, i) => (
            <ellipse key={c} cx="28" cy="16.5" rx="6.2" ry="11.5" fill={c} opacity="0.88" transform={`rotate(${i * 45} 28 28)`} />
          ))}
        </svg>
      </div>
    );
  }

  if (app.icon === "mail") {
    return <ImgIcon src="/assets/icon-mail.png" alt="Mail" size={size} />;
  }

  if (app.icon === "safari") {
    return <ImgIcon src="/assets/icon-safari.png" alt="Safari" size={size} />;
  }

  if (app.icon === "google-hotels") {
    const logo = Math.round(size * 0.66);
    return (
      <div
        className="icon-app icon-google-travel"
        style={{ width: size, height: size, borderRadius: radius }}
        aria-label="Google Hotels"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/icon-google-travel.png"
          alt=""
          width={logo}
          height={logo}
          draggable={false}
          style={{ width: logo, height: logo, display: "block", objectFit: "contain", userSelect: "none" }}
        />
      </div>
    );
  }

  return (
    <div
      className="icon-app"
      style={{
        background: app.color,
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: glyphSize,
      }}
    >
      <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }}>
        {app.icon}
      </span>
    </div>
  );
}

export function FinderIconGlyph() {
  return <ImgIcon src="/assets/icon-finder.png" alt="Finder" size={48} />;
}

export function TrashIconGlyph() {
  return <ImgIcon src="/assets/icon-trash.png" alt="Trash" size={48} />;
}
