"use client";

import "@livekit/components-styles";
import { useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Whiteboard } from "@/components/Whiteboard";

const THEME = {
  teacher: {
    accent: "#2563eb",
    accentBg: "#dbeafe",
    tint: "bg-teacher-light",
    text: "text-teacher",
    solid: "bg-teacher",
    border: "border-teacher",
  },
  student: {
    accent: "#f59e0b",
    accentBg: "#fef3c7",
    tint: "bg-student-light",
    text: "text-student",
    solid: "bg-student",
    border: "border-student",
  },
};

export function LiveClassroom({
  token,
  serverUrl,
  isTeacher,
  className,
}: {
  token: string;
  serverUrl: string;
  isTeacher: boolean;
  className: string;
}) {
  const [tab, setTab] = useState<"video" | "whiteboard">("video");
  const [status, setStatus] = useState<"connecting" | "connected" | "left">("connecting");
  const role = isTeacher ? "teacher" : "student";
  const theme = THEME[role];

  if (status === "left") {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50">
        <p className="text-3xl">👋</p>
        <p className="font-medium text-slate-600">You left the class.</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
      style={
        {
          "--lk-accent": theme.accent,
          "--lk-accent-bg": theme.accentBg,
          "--lk-border-radius": "1rem",
          "--lk-control-bg": "#ffffff",
          "--lk-control-fg": "#1e293b",
          "--lk-control-hover-bg": "#f1f5f9",
          "--lk-bg": "#0f172a",
        } as React.CSSProperties
      }
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${theme.tint}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <p className={`text-sm font-semibold ${theme.text}`}>{className}</p>
        </div>
        <span className={`text-xs font-medium ${theme.text}`}>
          {isTeacher ? "You're hosting" : "Live class"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 bg-white px-3 py-2">
        <button
          onClick={() => setTab("video")}
          className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "video" ? `${theme.solid} text-white` : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          📹 Class
        </button>
        <button
          onClick={() => setTab("whiteboard")}
          className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "whiteboard" ? `${theme.solid} text-white` : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          🖊️ Whiteboard
        </button>
      </div>

      <div className="relative h-[70vh] bg-slate-950">
        {status === "connecting" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950">
            <div
              className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700"
              style={{ borderTopColor: theme.accent }}
            />
            <p className="text-sm text-slate-400">Connecting to class…</p>
          </div>
        )}

        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect
          audio
          video
          onConnected={() => setStatus("connected")}
          onDisconnected={() => setStatus("left")}
          style={{ height: "100%" }}
        >
          <div className={tab === "video" ? "h-full" : "hidden"}>
            <VideoConference />
          </div>
          <div className={tab === "whiteboard" ? "h-full" : "hidden"}>
            <Whiteboard canDraw accentColor={theme.accent} />
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}
