"use client";

import { useEffect, useState } from "react";
import type { CatchupDTO, PersonDTO, PlanDTO, SubmissionDTO } from "@/lib/questival-api";
import { QUESTS, getQuest } from "@/lib/questival";

/**
 * Client-side helpers for the Forum: device persistence for the preview
 * ("local") mode, sample data so an empty database still looks alive,
 * image shrinking, and small formatters. The DTO types come from the API
 * contract so local and API modes render through the same components.
 */

export type { PersonDTO as Person };
export type PlanIntent = "going" | "interested";
export type Final = { submitted_at: string; extension_used: boolean } | null;

export const ME_ID = "me";
export const ME_NAME = "You";
export const ME: PersonDTO = { id: ME_ID, name: ME_NAME, photo_url: null };

const PREFIX = "fm_preview_v2:";

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
export function shrinkImage(file: File, max = 1600): Promise<{ blob: Blob; dataUrl: string }> {
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
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      canvas.toBlob((blob) => (blob ? resolve({ blob, dataUrl }) : reject(new Error("encode failed"))), "image/jpeg", 0.82);
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

export function timeShort(ms: number | string): string {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ------------------------------------------------------------- sample data

export function sampleInvites(people: PersonDTO[], now: number): PlanDTO[] {
  if (people.length < 3) return [];
  const picks: { kind: "quest" | "activity"; targetId: string; min: number }[] = [
    { kind: "quest", targetId: "bobs-challenge", min: 9 },
    { kind: "quest", targetId: "recreate", min: 41 },
    { kind: "activity", targetId: "sat-catchup", min: 75 },
    { kind: "quest", targetId: "of-course", min: 128 },
  ];
  return picks.map((x) => {
    const owner = people[djb2("inv" + x.targetId) % people.length];
    const others = sample(people, "co" + x.targetId, 10).filter((p) => p.id !== owner.id).slice(0, 2);
    return {
      id: `inv-${x.targetId}`,
      kind: x.kind,
      target_id: x.targetId,
      owner,
      with: [ME, ...others],
      replies: {},
      created_at: new Date(now - x.min * 60_000).toISOString(),
    };
  });
}

export function sampleCatchups(people: PersonDTO[], now: number): CatchupDTO[] {
  if (people.length < 5) return [];
  const from = people[djb2("catchup") % people.length];
  return [
    {
      id: "cu-sample",
      from,
      to: ME,
      slot: "sat-1330",
      note: "Five years is too long. Alamo Square?",
      status: "pending",
      created_at: new Date(now - 52 * 60_000).toISOString(),
    },
  ];
}

export function sampleFeed(people: PersonDTO[], now: number, dueAt: number): SubmissionDTO[] {
  if (people.length === 0) return [];
  const base = Math.min(now, dueAt);
  return QUESTS.filter((q) => djb2("feed" + q.id) % 100 < 45).map((q, i) => {
    const who = people[djb2("who" + q.id) % people.length];
    const withPeople = sample(people, "with" + q.id, 12).filter((p) => p.id !== who.id).slice(0, 3);
    return {
      id: `s-${q.id}`,
      quest_id: q.id,
      instance: 1,
      uploader: who,
      members: [who, ...withPeople],
      media: [],
      caption: null,
      note: null,
      status: "approved" as const,
      points: q.points,
      review_note: null,
      created_at: new Date(base - (i + 1) * 17 * 60_000).toISOString(),
    };
  });
}

export function samplePoints(name: string): number {
  return (djb2("pts" + name) % 19) * 10;
}

export function questTitle(id: string): string {
  return getQuest(id)?.title ?? id;
}
