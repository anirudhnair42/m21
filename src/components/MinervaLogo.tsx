import type { CSSProperties } from "react";

type Props = {
  size?: number;
  invert?: boolean;
  style?: CSSProperties;
};

/** The brush ensō mark. Use `invert` on dark backgrounds (the source PNG is black ink). */
export function MinervaLogo({ size = 40, invert = false, style }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/minerva-mark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{
        display: "block",
        filter: invert ? "invert(1) brightness(2)" : "none",
        ...style,
      }}
    />
  );
}

/** The full mark: ring + MINERVA® wordmark beneath. */
export function MinervaWordmark({
  width = 220,
  invert = false,
  style,
}: {
  width?: number;
  invert?: boolean;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/minerva-full.png"
      width={width}
      alt="Minerva"
      style={{
        display: "block",
        filter: invert ? "invert(1) brightness(2)" : "none",
        ...style,
      }}
    />
  );
}
