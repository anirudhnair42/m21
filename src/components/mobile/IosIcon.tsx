"use client";

import { forwardRef, type ReactNode } from "react";

type Props = {
  label: string;
  icon: string;
  tint: string;
  /** Vector artwork rendered inside the tile (used where no PNG exists). */
  glyph?: ReactNode;
  onClick?: (rect: DOMRect) => void;
  /** Hide the label (used in the dock). */
  hideLabel?: boolean;
};

/**
 * A Springboard app tile. Art is either a `glyph` (inline CSS/SVG drawing)
 * or a background-image PNG; a missing PNG degrades to the `tint` color
 * instead of a broken-image glyph. On tap it reports its on-screen rect so
 * the launch animation can zoom from here.
 */
export const IosIcon = forwardRef<HTMLButtonElement, Props>(function IosIcon(
  { label, icon, tint, glyph, onClick, hideLabel },
  ref,
) {
  return (
    <button
      ref={ref}
      className="ios-icon"
      onClick={(e) => onClick?.(e.currentTarget.getBoundingClientRect())}
      disabled={!onClick}
    >
      <span
        className="ios-icon-tile"
        style={{
          backgroundColor: tint,
          backgroundImage: glyph ? undefined : `url("${icon}")`,
        }}
      >
        {glyph}
      </span>
      {!hideLabel && <span className="ios-icon-label">{label}</span>}
    </button>
  );
});
