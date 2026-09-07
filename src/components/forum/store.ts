"use client";

import { useEffect, useState } from "react";

/**
 * Preview-only client state. The real build swaps these for the API routes
 * in the spec; the component boundaries stay the same.
 */

export type Person = { name: string; photo_url: string | null };

export type PlanIntent = "going" | "interested";

export type Media = { kind: "image" | "video"; src?: string };

export type SavedProof = {
  id: string;
  questId: string;
  instance: number;
  at: number;
  caption: string;
  /** Names of the classmates tagged (the uploader is implied). */
  members: string[];
  media: Media[];
};

export type Final = { at: number; extension: boolean } | null;

const PREFIX = "fm_preview_v1:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** useState that survives reloads. Only call from client-mounted trees. */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Quota or private mode — the preview just forgets on reload.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/** `?now=2026-09-12T14:14` lets a demo walk through Saturday. */
export function readNowOffset(): number {
  const raw = new URLSearchParams(window.location.search).get("now");
  if (!raw) return 0;
  // "2026-09-12T14:14" or "2026-09-12"; always San Francisco time.
  const iso = raw.includes("T") ? `${raw}:00-07:00` : `${raw}T12:00:00-07:00`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed - Date.now() : 0;
}

export function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic sample subset, so the preview looks alive but stable. */
export function sample<T extends { name: string }>(items: T[], salt: string, pct: number): T[] {
  return items.filter((p) => djb2(salt + p.name) % 100 < pct);
}

/** Shrink to ≤max px JPEG before anything leaves the phone. */
export function shrinkImage(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photo format couldn't be read here — try a JPEG."));
    };
    img.src = url;
  });
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}

export function timeShort(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ------------------------------------------------------------ plans & teams

import { TEAMS, type TeamId } from "@/lib/questival";

/** "I intend to do this, with these people." Not a submission. */
export type Plan = {
  id: string;
  kind: "quest" | "activity";
  targetId: string;
  with: string[];
  at: number;
};

/** What lands in someone's inbox when a classmate plans something with them. */
export type Invite = {
  id: string;
  from: Person;
  kind: "quest" | "activity";
  targetId: string;
  at: number;
};

export const ME = "You";

/** Cohosts assign teams for real; the preview seeds them by name. */
export function teamFor(name: string): TeamId {
  if (name === ME) return "berlin";
  return TEAMS[djb2("team" + name) % TEAMS.length].id;
}

export function teammates(people: Person[], name: string): Person[] {
  const t = teamFor(name);
  return people.filter((p) => p.name !== name && teamFor(p.name) === t);
}

export function sampleInvites(people: Person[], now: number): Invite[] {
  if (people.length < 3) return [];
  const picks: { kind: "quest" | "activity"; targetId: string; min: number }[] = [
    { kind: "quest", targetId: "bobs-challenge", min: 9 },
    { kind: "quest", targetId: "recreate", min: 41 },
    { kind: "activity", targetId: "sat-catchup", min: 75 },
    { kind: "quest", targetId: "of-course", min: 128 },
  ];
  return picks.map((x, i) => ({
    id: `inv-${x.targetId}`,
    from: people[djb2("inv" + x.targetId) % people.length],
    kind: x.kind,
    targetId: x.targetId,
    at: now - x.min * 60_000 - i,
  }));
}
