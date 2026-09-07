"use client";

import { useState } from "react";
import { ClassView } from "@/components/forum/ForumMobile";
import { LiveView } from "@/components/forum/Questival";
import { useForumStore } from "@/components/forum/ForumStore";
import { getTeam } from "@/lib/questival";
import { teamFor, ME } from "@/components/forum/store";

/** Photos — every proof as it lands, the boards, and the class, in a Photos window. */
export function PhotosApp() {
  const { proofs, people, now } = useForumStore();
  const [section, setSection] = useState<"live" | "class">("live");
  const team = getTeam(teamFor(ME));
  return (
    <div className="ph-app">
      <aside className="ph-side">
        <div className="ph-side-h">Library</div>
        <div className={`ph-item${section === "live" ? " on" : ""}`} onClick={() => setSection("live")}>📷 Questival, live</div>
        <div className={`ph-item${section === "class" ? " on" : ""}`} onClick={() => setSection("class")}>👥 The Class of 2021</div>
        <div className="ph-side-h" style={{ marginTop: 12 }}>Albums</div>
        <div className="ph-item locked locked-below" data-locked="Will be unlocked later">🟩 Team {team.name}</div>
        <div className="ph-item locked locked-below" data-locked="Will be unlocked later">⭐ Best recreations</div>
        <div className="ph-item locked locked-below" data-locked="Unlocks after the reunion">🗂 Memory archive</div>
      </aside>
      <div className="ph-main">
        <div className="fm fm-embed">
          <main className="fm-main">
            {section === "live" ? <LiveView proofs={proofs} people={people} now={now} /> : <ClassView people={people} />}
          </main>
        </div>
      </div>
    </div>
  );
}
