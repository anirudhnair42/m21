import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Reunion · Class of 2021",
  description:
    "Minerva University Class of 2021 — Five-year reunion in San Francisco, June 12–14, 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/*
          TODO: drop in your Adobe Fonts kit <link> here to load the actual
          Chronicle Deck + Acumin Pro faces. Without it, the CSS falls back to
          system serif / sans-serif (which still picks up `sans-serif` for
          acumin-pro, just not the real face).
          Example:
            <link rel="stylesheet" href="https://use.typekit.net/XXXXXXX.css" />
        */}
      </head>
      <body>{children}</body>
    </html>
  );
}
