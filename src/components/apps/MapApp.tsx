"use client";

import { MapView } from "@/components/forum/MapView";

/** Maps — the live map in a High Sierra Maps window. */
export function MapApp({ onOpenActivity, onOpenQuest }: { onOpenActivity: (id: string) => void; onOpenQuest: (id: string) => void }) {
  return (
    <div className="mp-app">
      <div className="mp-toolbar">
        <div className="mp-seg"><span className="on">Map</span><span>Transit</span><span>Satellite</span></div>
        <input className="mp-search" readOnly value="San Francisco, CA — RU26" />
        <span style={{ marginLeft: "auto", color: "#777" }}>Sat, Sep 12 · Questival 10:00 → 19:00</span>
      </div>
      <div className="mp-body">
        <div className="fm-main fm-main-map" style={{ position: "absolute", inset: 0 }}>
          <MapView onOpenActivity={onOpenActivity} onOpenQuest={onOpenQuest} />
        </div>
      </div>
    </div>
  );
}
