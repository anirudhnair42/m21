"use client";

import { useState } from "react";
import { ClassView } from "@/components/forum/ForumMobile";
import { LiveView } from "@/components/forum/Questival";

/** Photos — every proof as it lands, the board, and the class, in a Photos window. */
export function PhotosApp() {
  const [section, setSection] = useState<"feed" | "board" | "class">("feed");
  return (
    <div className="ph-app">
      <aside className="ph-side">
        <div className="ph-side-h">Library</div>
        <div className={`ph-item${section === "feed" ? " on" : ""}`} onClick={() => setSection("feed")}>📷 The feed</div>
        <div className={`ph-item${section === "board" ? " on" : ""}`} onClick={() => setSection("board")}>🏅 Leaderboard</div>
        <div className={`ph-item${section === "class" ? " on" : ""}`} onClick={() => setSection("class")}>👥 The Class of 2021</div>
        <div className="ph-side-h" style={{ marginTop: 12 }}>Albums</div>
        <div className="ph-item locked locked-below" data-locked="Will be unlocked later">⭐ Best recreations</div>
        <div className="ph-item locked locked-below" data-locked="Unlocks after the reunion">🗂 Memory archive</div>
      </aside>
      <div className="ph-main">
        <div className="fm fm-embed">
          <main className="fm-main">
            {section === "class" ? <ClassView /> : <LiveView key={section} initial={section} />}
          </main>
        </div>
      </div>
    </div>
  );
}
