"use client";

import "@livekit/components-styles";
import { useState } from "react";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Whiteboard } from "@/components/Whiteboard";

export function LiveClassroom({
  token,
  serverUrl,
  isTeacher,
}: {
  token: string;
  serverUrl: string;
  isTeacher: boolean;
}) {
  const [tab, setTab] = useState<"video" | "whiteboard">("video");
  const [connected, setConnected] = useState(true);

  if (!connected) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-2xl bg-slate-100">
        <p className="text-slate-500">You left the class.</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video
      onDisconnected={() => setConnected(false)}
      style={{ height: "80vh" }}
      className="overflow-hidden rounded-2xl border border-slate-200"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button
          onClick={() => setTab("video")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "video" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          📹 Class
        </button>
        <button
          onClick={() => setTab("whiteboard")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "whiteboard" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          🖊️ Whiteboard
        </button>
      </div>

      <div className="h-[calc(80vh-49px)]">
        {tab === "video" ? (
          <VideoConference />
        ) : (
          <Whiteboard canDraw={true} />
        )}
      </div>
    </LiveKitRoom>
  );
}
