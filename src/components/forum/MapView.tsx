"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LMap, LayerGroup } from "leaflet";
import { ACTIVITIES, DAYS } from "@/lib/weekend";
import { useForumStore } from "@/components/forum/ForumStore";
import { getAccessToken } from "@/lib/auth";
import type { MapWhoResponse, PersonDTO } from "@/lib/questival-api";

type Layer = "anchors" | "quests" | "side";

/**
 * Tile source, by which key is present. Public keys ship in the bundle, so
 * restrict them to m2021.co in the provider's dashboard.
 *   NEXT_PUBLIC_MAPBOX_TOKEN  (+ optional NEXT_PUBLIC_MAPBOX_STYLE, default mapbox/light-v11)
 *   NEXT_PUBLIC_STADIA_KEY    (Stamen Toner Lite: ink on paper)
 *   neither                   plain OSM, muted by CSS
 */
function tileSource() {
  const mapbox = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const style = process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox/light-v11";
  if (mapbox) {
    return {
      url: `https://api.mapbox.com/styles/v1/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${mapbox}`,
      attribution: "&copy; Mapbox &copy; OpenStreetMap",
      tileSize: 512,
      zoomOffset: -1,
      className: "",
    };
  }
  const stadia = process.env.NEXT_PUBLIC_STADIA_KEY;
  if (stadia) {
    return {
      url: `https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}@2x.png?api_key=${stadia}`,
      attribution: "&copy; Stadia Maps &copy; Stamen Design &copy; OpenStreetMap",
      tileSize: 256,
      zoomOffset: 0,
      className: "",
    };
  }
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    tileSize: 256,
    zoomOffset: 0,
    className: "fm-tiles",
  };
}
const tiles = tileSource();

/**
 * The live map: anchors (where everyone is), quests (where the points are),
 * side sessions (peer-led), and who's planning to be at each. Paper-toned
 * tiles so it sits inside the Forum instead of looking like a different app.
 */
export function MapView({ onOpenActivity, onOpenQuest }: { onOpenActivity: (id: string) => void; onOpenQuest: (id: string) => void }) {
  const { me, plans, who, quests: allQuests, questivalOpen, enabled } = useForumStore();
  const liveQuests = questivalOpen ? allQuests : [];
  const [mapWho, setMapWho] = useState<MapWhoResponse | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      const r = await fetch("/api/map", { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
      if (!cancelled && r?.ok) setMapWho(await r.json().catch(() => null));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const layersRef = useRef<Record<Layer, LayerGroup> | null>(null);
  const [on, setOn] = useState<Record<Layer, boolean>>({ anchors: true, quests: true, side: true });
  const [located, setLocated] = useState(false);

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !host.current || mapRef.current) return;
      const map = L.map(host.current, { zoomControl: false, attributionControl: true }).setView([37.7835, -122.437], 12.6);
      L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19, tileSize: tiles.tileSize, zoomOffset: tiles.zoomOffset, className: tiles.className }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      const layers = { anchors: L.layerGroup().addTo(map), quests: L.layerGroup().addTo(map), side: L.layerGroup().addTo(map) };
      layersRef.current = layers;
      mapRef.current = map;

      const faces = (ps: PersonDTO[]) =>
        ps.slice(0, 6).map((p) => (p.photo_url ? `<img class="fm-face" src="${p.photo_url}" alt="">` : `<span class="fm-face"></span>`)).join("") +
        (ps.length > 6 ? `<span class="fm-face-more">+${ps.length - 6}</span>` : "");

      const pin = (cls: string, label: string) => L.divIcon({ className: "", html: `<div class="fm-pin ${cls}">${label}</div>`, iconSize: [0, 0], iconAnchor: [0, 0] });

      for (const a of ACTIVITIES) {
        if (a.lat == null || a.lng == null) continue;
        const going = who[a.id]?.going ?? [];
        const mine = plans.some((p) => p.kind === "activity" && p.target_id === a.id);
        const d = DAYS.find((x) => x.id === a.day)!;
        const m = L.marker([a.lat, a.lng], { icon: pin(a.kind === "peer" ? "fm-pin-peer" : a.kind === "anchor" ? "fm-pin-anchor" : "fm-pin-opt", `${d.label} ${a.time.split(" ")[0]}`) });
        m.bindPopup(popupHtml(a.title, `${d.label} ${a.time}${a.venue ? ` · ${a.venue}` : ""}`, faces(going), `${going.length} going${mine ? " · you're in" : ""}`, `activity:${a.id}`));
        m.addTo(a.kind === "peer" ? layers.side : layers.anchors);
      }
      for (const q of liveQuests.filter((x) => x.venue)) {
        if (q.lat == null || q.lng == null) continue;
        const mine = plans.some((p) => p.kind === "quest" && p.target_id === q.id);
        const planning = [...(mapWho?.quests[q.id] ?? [])];
        if (mine && !planning.some((p) => p.id === me.id)) planning.unshift(me);
        const m = L.marker([q.lat, q.lng], { icon: pin(`fm-pin-quest${mine ? " fm-pin-mine" : ""}`, `${q.points}`) });
        m.bindPopup(popupHtml(q.title, `${q.points} pts${q.venue ? ` · ${q.venue}` : ""}`, faces(planning), `${planning.length} planning to go${mine ? " · you too" : ""}`, `quest:${q.id}`));
        m.addTo(layers.quests);
      }

      map.on("popupopen", (e) => {
        const btn = e.popup.getElement()?.querySelector<HTMLButtonElement>("button[data-open]");
        btn?.addEventListener("click", () => {
          const [kind, id] = (btn.dataset.open ?? "").split(":");
          if (kind === "activity") onOpenActivity(id);
          else onOpenQuest(id);
        });
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // Rebuilding on every plan/people change is fine at this size.
  }, [me, plans, who, mapWho, liveQuests, onOpenActivity, onOpenQuest]);

  // Toggle layers.
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    (Object.keys(layers) as Layer[]).forEach((k) => {
      if (on[k]) layers[k].addTo(map);
      else layers[k].remove();
    });
  }, [on]);

  const locate = async () => {
    const map = mapRef.current;
    if (!map) return;
    const L = (await import("leaflet")).default;
    map.locate({ setView: true, maxZoom: 15 }).once("locationfound", (e) => {
      L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#1f7ad6", fillOpacity: 1 }).addTo(map);
      setLocated(true);
    });
  };

  return (
    <div className="fm-mapwrap">
      <div ref={host} className="fm-map" />
      <div className="fm-map-chips">
        <button className={`fm-filter${on.anchors ? " fm-filter-on" : ""}`} onClick={() => setOn({ ...on, anchors: !on.anchors })}>Where we meet</button>
        {questivalOpen && <button className={`fm-filter${on.quests ? " fm-filter-on" : ""}`} onClick={() => setOn({ ...on, quests: !on.quests })}>Points</button>}
        <button className={`fm-filter${on.side ? " fm-filter-on" : ""}`} onClick={() => setOn({ ...on, side: !on.side })}>Side sessions</button>
        <button className="fm-filter" onClick={locate}>{located ? "◉ You" : "◎ Find me"}</button>
      </div>
      <div className="fm-map-legend">
        <span><i className="fm-pin fm-pin-anchor fm-pin-mini" /> everyone</span>
        {questivalOpen && <span><i className="fm-pin fm-pin-quest fm-pin-mini" /> quest · pts</span>}
        <span><i className="fm-pin fm-pin-peer fm-pin-mini" /> peer-led</span>
      </div>
    </div>
  );
}

function popupHtml(title: string, sub: string, faces: string, who: string, open: string): string {
  return `<div class="fm-popup">
    <div class="fm-popup-title">${escapeHtml(title)}</div>
    <div class="fm-popup-sub">${escapeHtml(sub)}</div>
    <div class="fm-popup-who"><span class="fm-faces">${faces}</span><span>${escapeHtml(who)}</span></div>
    <button class="fm-btn fm-btn-blue fm-popup-btn" data-open="${open}">Open</button>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

