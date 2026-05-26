"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";

const CAL_TARGET = new Date(2017, 4, 17, 20, 6, 0);
const CAL_TODAY = new Date(2026, 4, 22, 9, 41, 0);

const CAL_TIMINGS = {
  hold: 1600,
  spin: 3800,
  settle: 2200,
};

/** Number of discrete "snap" updates during the spin. Each one lands cleanly
 * with enough wall-clock time for the .cal-flip keyframe to play. */
const CAL_SPIN_TICKS = 28;

const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmtTime12(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12: String(h12), m, ampm };
}

const MiniMonthGrid = memo(function MiniMonthGrid({
  year,
  month,
  day,
}: {
  year: number;
  month: number;
  day: number;
}) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="cal-grid">
      <div className="cal-grid-headers">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={i} className="cal-grid-h">
            {w}
          </div>
        ))}
      </div>
      <div className="cal-grid-cells">
        {cells.map((d, i) => (
          <div
            key={i}
            className={`cal-grid-c ${d === day ? "today" : ""} ${
              d == null ? "empty" : ""
            }`}
          >
            {d ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
});

function FlipUnit({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  return (
    <span className={`cal-flip ${className ?? ""}`} key={String(value)}>
      {value}
    </span>
  );
}

type Phase = "hold" | "spin" | "settled";

/** Returns a target angle expressed as the largest value ≤ `prev` that is
 * congruent to `target` mod 360. In other words: snap to `target`, but only by
 * rotating backwards from `prev`. This is what makes the hands rewind cleanly
 * across the 12 → 11 (or 60 → 59) wraparound instead of taking the visually
 * jarring "shortest path" forwards through zero. */
function rewindTo(prev: number, target: number) {
  const TWO_PI = 360;
  let delta = ((target - prev) % TWO_PI + TWO_PI) % TWO_PI; // [0, 360)
  if (delta > 0) delta -= TWO_PI; // (-360, 0]
  return prev + delta;
}

function hmsAngles(d: Date) {
  const h = d.getHours() % 12;
  const m = d.getMinutes();
  const s = d.getSeconds();
  return {
    hour: (h + m / 60) * 30,
    minute: (m + s / 60) * 6,
    second: s * 6,
  };
}

/** macOS-style analog clock. The three hands always rotate counter-clockwise
 * to follow the calendar's rewind: each tick we accumulate a *non-positive*
 * delta into the running rotation, so the CSS transition interpolates through
 * the negative direction every time. Visuals are kept deliberately flat —
 * single bezel ring, single face fill — so the motion reads at small size. */
const AnalogClock = memo(function AnalogClock({
  date,
  phase,
}: {
  date: Date;
  phase: Phase;
}) {
  const target = hmsAngles(date);

  // Cumulative angles that only ever decrease. Seeded from the first date.
  const [cum, setCum] = useState(() => ({ ...target }));
  const cumRef = useRef(cum);
  cumRef.current = cum;

  useEffect(() => {
    setCum({
      hour: rewindTo(cumRef.current.hour, target.hour),
      minute: rewindTo(cumRef.current.minute, target.minute),
      second: rewindTo(cumRef.current.second, target.second),
    });
  }, [target.hour, target.minute, target.second]);

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    ticks.push(
      <line
        key={i}
        className={isHour ? "cal-clock-tick cal-clock-tick-h" : "cal-clock-tick"}
        x1="50"
        y1={isHour ? "6.5" : "7.5"}
        x2="50"
        y2={isHour ? "11" : "9"}
        transform={`rotate(${i * 6} 50 50)`}
      />,
    );
  }

  const h = date.getHours() % 12;
  const m = date.getMinutes();

  return (
    <div
      className={`cal-clock cal-clock-${phase}`}
      aria-label={`Clock showing ${h || 12}:${String(m).padStart(2, "0")}`}
    >
      <svg viewBox="0 0 100 100" className="cal-clock-svg">
        <circle cx="50" cy="50" r="48.5" className="cal-clock-bezel" />
        <circle cx="50" cy="50" r="46" className="cal-clock-face" />

        <g className="cal-clock-ticks">{ticks}</g>

        <g
          className="cal-clock-hand cal-clock-hour"
          style={{ transform: `rotate(${cum.hour}deg)` }}
        >
          <line x1="50" y1="56" x2="50" y2="28" />
        </g>
        <g
          className="cal-clock-hand cal-clock-minute"
          style={{ transform: `rotate(${cum.minute}deg)` }}
        >
          <line x1="50" y1="58" x2="50" y2="16" />
        </g>
        <g
          className="cal-clock-hand cal-clock-second"
          style={{ transform: `rotate(${cum.second}deg)` }}
        >
          <line x1="50" y1="62" x2="50" y2="14" />
        </g>

        <circle cx="50" cy="50" r="2.2" className="cal-clock-pin" />
      </svg>
    </div>
  );
});

/** Uniform schedules: tick gaps are constant in wall-clock time, and the
 * date interpolates linearly from CAL_TODAY → CAL_TARGET. Trading the prior
 * eased deceleration for a steadier read. */
const linear = (t: number) => t;

export function CalendarApp({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("hold");
  const [now, setNow] = useState<Date>(CAL_TODAY);
  const completedRef = useRef(false);

  // Pre-compute the spin schedule once.
  const schedule = useMemo(() => {
    const todayMs = CAL_TODAY.getTime();
    const targetMs = CAL_TARGET.getTime();
    const span = todayMs - targetMs;
    const out: { at: number; date: Date; isLast: boolean }[] = [];
    for (let i = 1; i <= CAL_SPIN_TICKS; i++) {
      const t = i / CAL_SPIN_TICKS;
      const at = linear(t) * CAL_TIMINGS.spin;
      const isLast = i === CAL_SPIN_TICKS;
      const date = isLast
        ? CAL_TARGET
        : new Date(todayMs - linear(t) * span);
      out.push({ at, date, isLast });
    }
    return out;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    setNow(CAL_TODAY);
    setPhase("hold");

    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        setPhase("spin");

        for (const tick of schedule) {
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setNow(tick.date);
              if (tick.isLast) {
                setPhase("settled");
                timers.push(
                  setTimeout(() => {
                    if (cancelled || completedRef.current) return;
                    completedRef.current = true;
                    onComplete();
                  }, CAL_TIMINGS.settle),
                );
              }
            }, tick.at),
          );
        }
      }, CAL_TIMINGS.hold),
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [onComplete, schedule]);

  const month = MONTH_FULL[now.getMonth()];
  const monthAbbr = month.slice(0, 3).toUpperCase();
  const day = now.getDate();
  const year = now.getFullYear();
  const weekday = WEEKDAYS_FULL[now.getDay()];
  const { h12, m, ampm } = fmtTime12(now);

  const settled = phase === "settled";

  return (
    <div className="cal-app">
      <div className="cal-toolbar">
        <div className="cal-toolbar-segment">
          <button className="cal-tb-seg cal-tb-seg-on">Day</button>
          <button className="cal-tb-seg">Week</button>
          <button className="cal-tb-seg">Month</button>
          <button className="cal-tb-seg">Year</button>
        </div>
        <div className="cal-toolbar-title">
          {month} {year}
        </div>
        <div className="cal-toolbar-right">
          <button className="cal-tb-btn" aria-label="Previous">
            ‹
          </button>
          <button className="cal-tb-btn cal-tb-today">Today</button>
          <button className="cal-tb-btn" aria-label="Next">
            ›
          </button>
        </div>
      </div>

      <div className="cal-body">
        <div className="cal-hero">
          <div className="cal-hero-eyebrow">
            <FlipUnit value={weekday} />
          </div>

          <div className={`cal-hero-date ${settled ? "settled" : ""}`}>
            <FlipUnit value={monthAbbr} className="cal-hero-month" />
            <FlipUnit value={day} className="cal-hero-day" />
            <FlipUnit value={year} className="cal-hero-year" />
          </div>

          <div className="cal-hero-time">
            <FlipUnit value={h12} className="cal-hero-h" />
            <span className="cal-hero-colon">:</span>
            <FlipUnit value={m} className="cal-hero-m" />
            <span className="cal-hero-ampm">{ampm}</span>
          </div>

          <div className={`cal-hero-caption ${settled ? "settled" : ""}`}>
            {phase === "hold" ? "Today" : " "}
          </div>
        </div>

        <div className="cal-side">
          <AnalogClock date={now} phase={phase} />
          <MiniMonthGrid
            year={now.getFullYear()}
            month={now.getMonth()}
            day={now.getDate()}
          />
        </div>
      </div>
    </div>
  );
}
