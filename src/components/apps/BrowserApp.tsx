"use client";

import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";

const DECISION_URL = "secure.minerva.kgi.edu/decisions/welcome-back";

/** The original 2017 admit-reveal video (golden ensō → seal). This is the
 * centerpiece of the decision page; the COBE globe tour below is kept and
 * can be swapped back in by flipping this to true. */
const USE_GLOBE_TOUR = false;
const ADMIT_VIDEO_SRC = "/assets/admit-video.mp4";

type City = { name: string; lat: number; lng: number };

/** Three-stop tour: Seoul → Hyderabad → Berlin. The white arc connects them
 * in this order. */
const CITIES: City[] = [
  { name: "Seoul", lat: 37.5665, lng: 126.978 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Berlin", lat: 52.52, lng: 13.405 },
];

// --- timings ---------------------------------------------------------------
const PRE_HOLD_MS = 700;        // hold on Seoul before first hop
const HOP_MS = 1900;            // each Seoul→Hyd and Hyd→Berlin rotation
const POST_HOP_HOLD = 1100;     // hold at Berlin before headline
const HEADLINE_IN_DELAY = 200;
const SUBTITLE_GAP = 700;
const HEADLINE_HOLD = 2800;     // time headline stays before fading
const FADE_OUT_MS = 750;
const LETTER_IN_DELAY = 250;

// --- math helpers ----------------------------------------------------------

type Vec3 = { x: number; y: number; z: number };

function latLngToVec(lat: number, lng: number): Vec3 {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  return {
    x: Math.cos(latRad) * Math.sin(lngRad),
    y: Math.sin(latRad),
    z: Math.cos(latRad) * Math.cos(lngRad),
  };
}

/** Apply cobe's (phi, theta) rotation to a sphere point. phi rotates around
 * Y; theta rotates around X. Convention verified: (phi = -lng_rad, theta =
 * lat_rad) brings (lat,lng) to the camera. */
function rotate({ x, y, z }: Vec3, phi: number, theta: number): Vec3 {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const x1 = x * cp + z * sp;
  const z1 = -x * sp + z * cp;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  return {
    x: x1,
    y: y * ct - z1 * st,
    z: y * st + z1 * ct,
  };
}

/** Spherical linear interpolation between two unit vectors — used to sample
 * the great-circle arc between consecutive cities. */
function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-6) return a;
  const sinOm = Math.sin(omega);
  const w1 = Math.sin((1 - t) * omega) / sinOm;
  const w2 = Math.sin(t * omega) / sinOm;
  return {
    x: a.x * w1 + b.x * w2,
    y: a.y * w1 + b.y * w2,
    z: a.z * w1 + b.z * w2,
  };
}

function shortestDelta(from: number, to: number): number {
  let d = to - from;
  d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return d;
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

type Keyframe = { phi: number; theta: number };

const KEYFRAMES: Keyframe[] = (() => {
  const frames: Keyframe[] = [];
  let runningPhi = (-CITIES[0].lng * Math.PI) / 180;
  frames.push({ phi: runningPhi, theta: (CITIES[0].lat * Math.PI) / 180 });
  for (let i = 1; i < CITIES.length; i++) {
    const rawPhi = (-CITIES[i].lng * Math.PI) / 180;
    runningPhi += shortestDelta(runningPhi, rawPhi);
    frames.push({ phi: runningPhi, theta: (CITIES[i].lat * Math.PI) / 180 });
  }
  return frames;
})();

const CITY_VECS = CITIES.map((c) => latLngToVec(c.lat, c.lng));

// --- toolbar ---------------------------------------------------------------

function BrowserToolbar({
  url = DECISION_URL,
  loading = true,
}: {
  url?: string;
  loading?: boolean;
}) {
  return (
    <div className="sb-toolbar">
      <div className="sb-toolbar-group">
        <button className="sb-tb-btn sb-tb-btn--disabled" aria-label="Back">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button className="sb-tb-btn sb-tb-btn--disabled" aria-label="Forward">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="sb-url-wrap">
        <div className="sb-url">
          <span className="sb-url-lock" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
              <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
            </svg>
          </span>
          <span className="sb-url-text">{url}</span>
          {loading && <span className="sb-url-loader" aria-hidden="true" />}
        </div>
      </div>

      <div className="sb-toolbar-group sb-toolbar-group--right">
        <button className="sb-tb-btn" aria-label="Share">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
        </button>
        <button className="sb-tb-btn" aria-label="Tabs">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="8" height="12" rx="1.5" />
            <rect x="13" y="6" width="8" height="12" rx="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- globe stage -----------------------------------------------------------

type GlobeStageProps = {
  onGlobeReady: () => void;
  showHeadline: boolean;
  showSubtitle: boolean;
  fading: boolean;
};

function GlobeStage({ onGlobeReady, showHeadline, showSubtitle, fading }: GlobeStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<{ phi: number; theta: number }>({
    phi: KEYFRAMES[0].phi,
    theta: KEYFRAMES[0].theta,
  });
  const segIdxRef = useRef(0);
  const segProgRef = useRef(0);
  const arrivedRef = useRef(false);
  const [, forceTick] = useState(0);

  const onReadyRef = useRef(onGlobeReady);
  onReadyRef.current = onGlobeReady;

  useEffect(() => {
    let cancelled = false;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let raf = 0;

    const init = async () => {
      try {
        if (cancelled || !canvasRef.current) return;
        await new Promise((r) => setTimeout(r, 30));
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        // Cap render size so a 240%-of-body wrap doesn't push WebGL to 3000+ px.
        const raw = Math.min(rect.width, rect.height) || 800;
        const size = Math.min(1400, Math.max(360, raw));
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

        globe = createGlobe(canvas, {
          devicePixelRatio: dpr,
          width: size * dpr,
          height: size * dpr,
          phi: camRef.current.phi,
          theta: camRef.current.theta,
          dark: 1,
          diffuse: 1.45,
          mapSamples: 16000,
          mapBrightness: 5.8,
          baseColor: [0.22, 0.26, 0.38],
          markerColor: [1.0, 1.0, 1.0],
          glowColor: [0.18, 0.24, 0.44],
          markers: CITIES.map((c) => ({
            location: [c.lat, c.lng],
            size: 0.06,
          })),
        });

        const tourStartedAt = performance.now() + PRE_HOLD_MS;
        const TOUR_TOTAL = HOP_MS * (KEYFRAMES.length - 1);

        const tick = (now: number) => {
          if (cancelled) return;
          const elapsed = now - tourStartedAt;

          if (elapsed < 0) {
            // pre-hold on Seoul
            segIdxRef.current = 0;
            segProgRef.current = 0;
          } else if (elapsed < TOUR_TOTAL) {
            const segIdx = Math.min(
              Math.floor(elapsed / HOP_MS),
              KEYFRAMES.length - 2,
            );
            const tt = (elapsed - segIdx * HOP_MS) / HOP_MS;
            const e = easeInOut(tt);
            const a = KEYFRAMES[segIdx];
            const b = KEYFRAMES[segIdx + 1];
            camRef.current.phi = a.phi + (b.phi - a.phi) * e;
            camRef.current.theta = a.theta + (b.theta - a.theta) * e;
            segIdxRef.current = segIdx;
            segProgRef.current = e;
          } else {
            const last = KEYFRAMES[KEYFRAMES.length - 1];
            // ambient slow spin once we've arrived
            camRef.current.phi = last.phi + (elapsed - TOUR_TOTAL) * 0.00015;
            camRef.current.theta = last.theta;
            segIdxRef.current = KEYFRAMES.length - 2;
            segProgRef.current = 1;

            if (!arrivedRef.current && elapsed >= TOUR_TOTAL + POST_HOP_HOLD) {
              arrivedRef.current = true;
              setTimeout(() => onReadyRef.current(), 0);
            }
          }

          globe?.update({ phi: camRef.current.phi, theta: camRef.current.theta });
          forceTick((n) => (n + 1) & 0xffff);
          raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
      } catch (err) {
        console.error("COBE init failed:", err);
        if (!arrivedRef.current) {
          arrivedRef.current = true;
          setTimeout(() => onReadyRef.current(), 1500);
        }
      }
    };
    init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      try {
        globe?.destroy();
      } catch {
        // ignore
      }
    };
  }, []);

  // --- per-frame projection for the SVG arc overlay ------------------------
  const wrap = wrapRef.current;
  const W = wrap?.clientWidth ?? 800;
  const H = wrap?.clientHeight ?? 800;
  const R = Math.min(W, H) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const cam = camRef.current;

  const project = (v: Vec3) => {
    const r = rotate(v, cam.phi, cam.theta);
    return { x: cx + r.x * R, y: cy - r.y * R, z: r.z };
  };

  const SAMPLES = 48;
  const buildArc = (i: number, t: number) => {
    const A = CITY_VECS[i];
    const B = CITY_VECS[i + 1];
    let d = "";
    let drawing = false;
    for (let k = 0; k <= SAMPLES; k++) {
      const tt = (k / SAMPLES) * t;
      const p = project(slerp(A, B, tt));
      if (p.z > -0.04) {
        d += `${drawing ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        drawing = true;
      } else {
        drawing = false;
      }
      if (tt >= t) break;
    }
    return d.trim();
  };

  const arcs: { d: string; active: boolean; key: string }[] = [];
  for (let i = 0; i < segIdxRef.current; i++) {
    arcs.push({ d: buildArc(i, 1), active: false, key: `done-${i}` });
  }
  if (segIdxRef.current < CITIES.length - 1) {
    arcs.push({
      d: buildArc(segIdxRef.current, segProgRef.current),
      active: true,
      key: `active-${segIdxRef.current}`,
    });
  }

  const cityDots = CITIES.map((_, i) => {
    const p = project(CITY_VECS[i]);
    return { x: p.x, y: p.y, visible: p.z > 0, i };
  });

  return (
    <div className={`sb-stage ${fading ? "sb-stage-fade" : ""}`}>
      <div className="sb-globe-canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="sb-globe-canvas" />
        <svg
          className="sb-globe-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
        >
          {arcs.map(({ d, active, key }) => (
            <path
              key={key}
              d={d}
              className={`sb-arc ${active ? "sb-arc-active" : "sb-arc-done"}`}
            />
          ))}
          {cityDots.map((c) =>
            c.visible ? (
              <g key={c.i} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
                <circle r="3" className="sb-city-halo" />
                <circle r="1.2" className="sb-city-dot" />
              </g>
            ) : null,
          )}
        </svg>
      </div>

      <div className={`sb-headline-wrap ${showHeadline ? "in" : ""}`}>
        <div className="sb-headline">achieve&nbsp;extraordinary</div>
        <div className={`sb-subtitle ${showSubtitle ? "in" : ""}`}>
          You are invited to join 150 other exceptional individuals
          <br />
          for a two- or four-year program.
        </div>
      </div>
    </div>
  );
}

// --- admit video stage -------------------------------------------------------

function VideoStage({
  onLoaded,
  onDone,
}: {
  onLoaded: () => void;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [fading, setFading] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, 700);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Try with sound first — the user just clicked into the decision, so many
    // browsers allow it. If autoplay-with-audio is blocked, fall back to a
    // muted start and surface an unmute chip.
    video.play().catch(() => {
      video.muted = true;
      video
        .play()
        .then(() => setNeedsUnmute(true))
        .catch(() => {
          // Autoplay fully blocked — skip straight to the letter.
          finish();
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setNeedsUnmute(false);
  };

  return (
    <div className={`sb-stage sb-video-stage ${fading ? "sb-stage-fade" : ""}`}>
      <video
        ref={videoRef}
        className="sb-video"
        src={ADMIT_VIDEO_SRC}
        playsInline
        preload="auto"
        onCanPlay={onLoaded}
        onEnded={finish}
      />
      {needsUnmute && (
        <button className="sb-video-chip sb-video-unmute" onClick={unmute}>
          Turn sound on
        </button>
      )}
      <button className="sb-video-chip sb-video-skip" onClick={finish}>
        Skip →
      </button>
    </div>
  );
}

// --- letter stage ----------------------------------------------------------

function LetterStage({ onProceed }: { onProceed: () => void }) {
  return (
    <div className="sb-letter">
      <div className="sb-letter-inner">
        <div className="sb-marker-line sb-marker-line-1">
          <span className="sb-marker-fill">
            Nine years ago, you opened an email like this.
          </span>
        </div>
        <div className="sb-marker-line sb-marker-line-2">
          <span className="sb-marker-fill">
            Five years since we scattered across the world.
          </span>
        </div>
        <div className="sb-marker-line sb-marker-line-3">
          <span className="sb-marker-fill">It&apos;s time to come back.</span>
        </div>
        <div className="sb-letter-cta-wrap">
          <button className="sb-letter-cta" onClick={onProceed}>
            Open the Reunion →
          </button>
        </div>
      </div>
    </div>
  );
}

// --- root ------------------------------------------------------------------

type Phase = "video" | "tour" | "letter";

type BrowserAppProps = {
  onArrive?: () => void;
  onProceed?: () => void;
};

export function BrowserApp({ onArrive, onProceed }: BrowserAppProps) {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>(USE_GLOBE_TOUR ? "tour" : "video");
  const [showHeadline, setShowHeadline] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [fading, setFading] = useState(false);

  const handleGlobeReady = () => {
    setLoading(false);
    onArrive?.();
    setTimeout(() => setShowHeadline(true), HEADLINE_IN_DELAY);
    setTimeout(() => setShowSubtitle(true), HEADLINE_IN_DELAY + SUBTITLE_GAP);
    setTimeout(
      () => setFading(true),
      HEADLINE_IN_DELAY + SUBTITLE_GAP + HEADLINE_HOLD,
    );
    setTimeout(
      () => setPhase("letter"),
      HEADLINE_IN_DELAY + SUBTITLE_GAP + HEADLINE_HOLD + FADE_OUT_MS + LETTER_IN_DELAY,
    );
  };

  const handleVideoLoaded = () => {
    setLoading(false);
    onArrive?.();
  };

  return (
    <div className="sb-app">
      <BrowserToolbar url={DECISION_URL} loading={loading} />
      <div className="sb-body">
        {phase === "video" && (
          <VideoStage
            onLoaded={handleVideoLoaded}
            onDone={() => setPhase("letter")}
          />
        )}
        {phase === "tour" && (
          <GlobeStage
            onGlobeReady={handleGlobeReady}
            showHeadline={showHeadline}
            showSubtitle={showSubtitle}
            fading={fading}
          />
        )}
        {phase === "letter" && (
          <LetterStage onProceed={onProceed ?? (() => {})} />
        )}
      </div>
    </div>
  );
}
