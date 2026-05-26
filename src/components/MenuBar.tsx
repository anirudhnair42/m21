type Props = {
  appName?: string;
  rsvpCount: number;
  currentTime: Date;
};

const MENU_ITEMS = ["File", "Edit", "View", "Go", "Window", "Help"] as const;

export function MenuBar({ appName = "Finder", rsvpCount, currentTime }: Props) {
  const day = currentTime.toLocaleDateString("en-US", { weekday: "short" });
  const date = currentTime.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const hours = currentTime.getHours();
  const mins = currentTime.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;

  return (
    <div className="menubar">
      <div className="menubar-left">
        <span className="menubar-apple" />
        <span className="menubar-app menubar-item">{appName}</span>
        {MENU_ITEMS.map((it) => (
          <span key={it} className="menubar-item">
            {it}
          </span>
        ))}
      </div>
      <div className="menubar-right">
        <span className="menubar-counter" title="Live RSVP counter">
          <span className="menubar-counter-dot" />
          <span>{rsvpCount} RSVP&apos;d</span>
        </span>
        <span
          className="menubar-item"
          style={{ fontSize: 12, opacity: 0.85 }}
        >
          🔍
        </span>
        <span
          className="menubar-item"
          style={{ fontVariantNumeric: "tabular-nums", fontSize: 12 }}
        >
          {day} {date}  {h12}:{mins} {ampm}
        </span>
      </div>
    </div>
  );
}
