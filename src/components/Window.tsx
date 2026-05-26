"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type TrafficLightsProps = {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
};

function TrafficLights({
  onClose,
  onMinimize,
  onMaximize,
}: TrafficLightsProps) {
  return (
    <div className="traffic-lights">
      <span className="traffic-light close" onClick={onClose}>
        ×
      </span>
      <span className="traffic-light minimize" onClick={onMinimize}>
        −
      </span>
      <span className="traffic-light maximize" onClick={onMaximize}>
        +
      </span>
    </div>
  );
}

type DragState =
  | {
      type: "drag";
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      type: "resize";
      dir: string;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
      originW: number;
      originH: number;
    }
  | null;

type WindowProps = {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  zIndex: number;
  isActive: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
  children: ReactNode;
};

export function Window({
  title,
  x: initX,
  y: initY,
  width: initW,
  height: initH,
  minWidth = 320,
  minHeight = 220,
  zIndex,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  children,
}: WindowProps) {
  const [pos, setPos] = useState({ x: initX, y: initY });
  const [size, setSize] = useState({ width: initW, height: initH });
  const [maximized, setMaximized] = useState(false);
  const preMaxRect = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [enterStart, setEnterStart] = useState(true);
  const dragState = useRef<DragState>(null);

  // Trigger entrance transition on the next frame
  useEffect(() => {
    const r = requestAnimationFrame(() => setEnterStart(false));
    return () => cancelAnimationFrame(r);
  }, []);

  const onTitleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (maximized) return;
    if ((e.target as HTMLElement).classList.contains("traffic-light")) return;
    onFocus?.();
    dragState.current = {
      type: "drag",
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    e.preventDefault();
  };

  const onResizeMouseDown =
    (dir: string) => (e: React.MouseEvent<HTMLDivElement>) => {
      if (maximized) return;
      onFocus?.();
      dragState.current = {
        type: "resize",
        dir,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
        originW: size.width,
        originH: size.height,
      };
      e.preventDefault();
      e.stopPropagation();
    };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = dragState.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (s.type === "drag") {
        setPos({
          x: Math.max(0, s.originX + dx),
          y: Math.max(24, s.originY + dy), // don't slide under menu bar
        });
      } else {
        let nx = s.originX;
        let ny = s.originY;
        let nw = s.originW;
        let nh = s.originH;
        const d = s.dir;
        if (d.includes("e")) nw = Math.max(minWidth, s.originW + dx);
        if (d.includes("s")) nh = Math.max(minHeight, s.originH + dy);
        if (d.includes("w")) {
          const w = Math.max(minWidth, s.originW - dx);
          nx = s.originX + (s.originW - w);
          nw = w;
        }
        if (d.includes("n")) {
          const h = Math.max(minHeight, s.originH - dy);
          ny = Math.max(24, s.originY + (s.originH - h));
          nh = h;
        }
        setPos({ x: nx, y: ny });
        setSize({ width: nw, height: nh });
      }
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minWidth, minHeight]);

  const handleMaximize = () => {
    if (maximized) {
      const r = preMaxRect.current;
      if (r) {
        setPos({ x: r.x, y: r.y });
        setSize({ width: r.width, height: r.height });
      }
      setMaximized(false);
    } else {
      preMaxRect.current = {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      };
      setPos({ x: 0, y: 24 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 24 - 72 });
      setMaximized(true);
    }
  };

  return (
    <div
      className={`window ${isActive ? "active" : "inactive"} ${
        enterStart ? "opening-start" : ""
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onMouseDown={onFocus}
    >
      <div
        className="window-titlebar"
        onMouseDown={onTitleMouseDown}
        onDoubleClick={handleMaximize}
      >
        <TrafficLights
          onClose={onClose}
          onMinimize={onMinimize}
          onMaximize={handleMaximize}
        />
        <div className="window-title">{title}</div>
      </div>
      <div className="window-body">{children}</div>

      <div className="resize-handle r-n" onMouseDown={onResizeMouseDown("n")} />
      <div className="resize-handle r-s" onMouseDown={onResizeMouseDown("s")} />
      <div className="resize-handle r-e" onMouseDown={onResizeMouseDown("e")} />
      <div className="resize-handle r-w" onMouseDown={onResizeMouseDown("w")} />
      <div
        className="resize-handle r-ne"
        onMouseDown={onResizeMouseDown("ne")}
      />
      <div
        className="resize-handle r-nw"
        onMouseDown={onResizeMouseDown("nw")}
      />
      <div
        className="resize-handle r-se"
        onMouseDown={onResizeMouseDown("se")}
      />
      <div
        className="resize-handle r-sw"
        onMouseDown={onResizeMouseDown("sw")}
      />
    </div>
  );
}
