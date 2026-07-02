import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's client/HMR assets to load when reached through a
  // tunnel (Cloudflare quick tunnels, ngrok) or another device on the LAN.
  // Without this, Next 16 blocks the cross-origin requests and the client JS
  // never hydrates — the page gets stuck on the initial splash.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
};

export default nextConfig;
