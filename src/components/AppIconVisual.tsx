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

  if (app.icon === "mail") {
    return <ImgIcon src="/assets/icon-mail.png" alt="Mail" size={size} />;
  }

  if (app.icon === "safari") {
    return <ImgIcon src="/assets/icon-safari.png" alt="Safari" size={size} />;
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
