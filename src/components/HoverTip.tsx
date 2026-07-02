"use client";

import { useEffect, useState } from "react";

type Tip = { text: string; x: number; y: number; below: boolean };

/**
 * One global tooltip, rendered at the top layer with fixed positioning, for
 * every element carrying `data-locked` or `data-tip`. CSS ::after tooltips
 * kept getting clipped by scroll containers and card boundaries; this floats
 * above everything. Flips below the target when there's no room above, and
 * clamps to the viewport edges.
 */
export function HoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(
        "[data-locked], [data-tip]",
      );
      if (!el) {
        setTip(null);
        return;
      }
      const text =
        el.getAttribute("data-locked") ?? el.getAttribute("data-tip") ?? "";
      if (!text) {
        setTip(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const below = r.top < 44;
      setTip({
        text,
        x: Math.min(Math.max(r.left + r.width / 2, 12), window.innerWidth - 12),
        y: below ? r.bottom + 8 : r.top - 8,
        below,
      });
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) setTip(null);
    };
    const onHide = () => setTip(null);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("scroll", onHide, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("scroll", onHide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      className={`hovertip ${tip.below ? "hovertip-below" : ""}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>
  );
}
