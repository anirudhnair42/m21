"use client";

import { useEffect, useState } from "react";
import type { PersonDTO } from "@/lib/questival-api";
import { getQuest } from "@/lib/questival";

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

/**
 * The `?now=` demo value as epoch ms. "2026-09-12" is noon in San Francisco,
 * "2026-09-12T14:14" (seconds optional) is that San Francisco wall time, and
 * an explicit offset or Z is honored as written. NaN when unparsable.
 */
export function parseNowParam(raw: string): number {
  const s = raw.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return NaN;
  if (!s.includes("T")) return Date.parse(`${s}T12:00:00-07:00`);
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return Date.parse(s);
  const time = s.slice(11);
  return Date.parse(`${s.slice(0, 10)}T${/^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time}-07:00`);
}

/** `?now=2026-09-12T14:14` lets a demo walk through Saturday. Zero on the server or without the param. */
export function readNowOffset(search?: string): number {
  const qs = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const raw = qs ? new URLSearchParams(qs).get("now") : null;
  if (!raw) return 0;
  const parsed = parseNowParam(raw);
  return Number.isFinite(parsed) ? parsed - Date.now() : 0;
}

export function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

const UNREADABLE = "This photo format couldn't be read here — try a JPEG.";

/**
 * Shrink to ≤max px JPEG before anything leaves the phone. Every failure
 * (HEIC the browser can't decode, an image too big to decode, a canvas that
 * won't encode) rejects with a sentence the save button can show.
 */
export function shrinkImage(file: File, max = 1600): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const done = <T,>(fn: () => T) => {
      URL.revokeObjectURL(url);
      return fn();
    };
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      // Safari "loads" an undecodable image as 0×0; a 0×0 canvas encodes to nothing.
      if (!iw || !ih) return done(() => reject(new Error(UNREADABLE)));
      const scale = Math.min(1, max / Math.max(iw, ih));
      const w = Math.max(1, Math.round(iw * scale));
      const h = Math.max(1, Math.round(ih * scale));
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no canvas");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        canvas.toBlob(
          (blob) => done(() => (blob ? resolve({ blob, dataUrl }) : reject(new Error("Couldn't encode that photo — try a smaller JPEG.")))),
          "image/jpeg",
          0.82,
        );
      } catch (e) {
        done(() => reject(new Error(`Couldn't process that photo (${e instanceof Error ? e.message : "canvas error"}) — try a smaller JPEG.`)));
      }
    };
    img.onerror = () => done(() => reject(new Error(UNREADABLE)));
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
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Idempotency key for one proof: the same person, quest, instance and files
 * always give the same key, so a retry after a dropped connection lands on
 * the row the first attempt created instead of a duplicate. Caption and
 * tags are deliberately left out — a retry with an edited caption is still
 * the same proof. Under the API's 80-character cap.
 */
export function proofKey(
  meId: string,
  questId: string,
  instance: number,
  files: { name: string; size: number; lastModified: number; type: string }[],
): string {
  const sig = files.map((f) => `${f.name}|${f.size}|${f.lastModified}|${f.type}`).join("\n");
  const q = questId.replace(/[^a-z0-9-]/gi, "").slice(0, 24);
  return `p_${djb2(meId).toString(36)}_${q}_${instance}_${djb2(sig).toString(36)}_${djb2(`${meId}:${questId}:${sig}`).toString(36)}`;
}

export function questTitle(id: string): string {
  return getQuest(id)?.title ?? id;
}
