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

export function questTitle(id: string): string {
  return getQuest(id)?.title ?? id;
}
