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

export function Whiteboard({ canDraw = true }: { canDraw?: boolean }) {
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
    <div className="flex h-full flex-col">
      {canDraw && (
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-slate-900" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={`Pen color ${c}`}
            />
          ))}
          <input
            type="range"
            min={1}
            max={12}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24"
          />
          <button
            onClick={clearBoard}
            className="ml-auto rounded-lg border border-slate-300 px-3 py-1 text-xs"
          >
            Clear
          </button>
        </div>
      )}
      <div className="relative flex-1 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`h-full w-full touch-none ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
        />
      </div>
    </div>
  );
}
