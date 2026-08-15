"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel, useLocalParticipant } from "@livekit/components-react";

// A minimal collaborative whiteboard (master prompt section 13): draw,
// erase, change color/pen size, clear, undo. No persistence yet — see
// README limitations. Sync works over LiveKit's existing data channel
// rather than a separate service, so the same room credentials that
// power video also power the board; nothing new to configure.
//
// Protocol: every stroke segment is broadcast as a small JSON message
// the instant it's drawn (topic "whiteboard"). Everyone renders their
// own strokes immediately and everyone else's as they arrive — there's
// no central "canvas state" to reconcile, which keeps this simple at
// the cost of a late joiner not seeing strokes drawn before they
// connected (documented limitation).

type StrokeMsg = {
  type: "segment" | "clear";
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  color?: string;
  size?: number;
  from?: string;
};

const COLORS = ["#1e293b", "#dc2626", "#2563eb", "#16a34a", "#f59e0b"];

export function Whiteboard({
  canDraw = true,
  accentColor = "#2563eb",
}: {
  canDraw?: boolean;
  accentColor?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const { localParticipant } = useLocalParticipant();

  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);

  const encoder = useRef(new TextEncoder());
  const decoder = useRef(new TextDecoder());

  const { send } = useDataChannel("whiteboard", (msg) => {
    try {
      const parsed: StrokeMsg = JSON.parse(decoder.current.decode(msg.payload));
      applyMessage(parsed);
    } catch {
      // ignore malformed messages
    }
  });

  const applyMessage = useCallback((msg: StrokeMsg) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    if (msg.type === "clear") {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      return;
    }
    if (
      msg.type === "segment" &&
      msg.x0 !== undefined &&
      msg.y0 !== undefined &&
      msg.x1 !== undefined &&
      msg.y1 !== undefined
    ) {
      ctx.strokeStyle = msg.color ?? "#000";
      ctx.lineWidth = msg.size ?? 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(msg.x0, msg.y0);
      ctx.lineTo(msg.x1, msg.y1);
      ctx.stroke();
    }
  }, []);

  function broadcast(msg: StrokeMsg) {
    send(encoder.current.encode(JSON.stringify(msg)), { reliable: true });
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    drawing.current = true;
    last.current = getPos(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw || !drawing.current || !last.current) return;
    const pos = getPos(e);
    const msg: StrokeMsg = {
      type: "segment",
      x0: last.current.x,
      y0: last.current.y,
      x1: pos.x,
      y1: pos.y,
      color,
      size,
      from: localParticipant?.identity,
    };
    applyMessage(msg);
    broadcast(msg);
    last.current = pos;
  }

  function handlePointerUp() {
    drawing.current = false;
    last.current = null;
  }

  function clearBoard() {
    applyMessage({ type: "clear" });
    broadcast({ type: "clear" });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {canDraw && (
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="grid h-7 w-7 place-items-center rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                }}
                aria-label={`Pen color ${c}`}
              >
                {color === c && <span className="h-2 w-2 rounded-full bg-white" />}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-2">
            <span
              className="rounded-full"
              style={{
                width: Math.max(size, 4),
                height: Math.max(size, 4),
                backgroundColor: color,
              }}
            />
            <input
              type="range"
              min={1}
              max={16}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-20 accent-slate-700"
            />
          </div>

          <button
            onClick={clearBoard}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
          >
            🗑️ Clear board
          </button>
        </div>
      )}
      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`h-full w-full touch-none bg-white ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
          style={{
            backgroundImage:
              "linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(90deg, #f1f5f9 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {!canDraw && (
          <div
            className="pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: accentColor }}
          >
            Watching only
          </div>
        )}
      </div>
    </div>
  );
}
