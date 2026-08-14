"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({ accentColor = "teacher" }: { accentColor?: "teacher" | "student" | "parent" }) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (active && data) setNotifications(data);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  }

  const dot =
    accentColor === "student" ? "bg-student" : accentColor === "parent" ? "bg-parent" : "bg-teacher";

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full border border-slate-200 bg-white p-2 text-lg"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${dot}`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-slate-500 underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="p-4 text-sm text-slate-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Nothing yet.</p>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`border-b border-slate-50 px-4 py-3 text-sm ${
                      n.is_read ? "" : "bg-slate-50"
                    }`}
                  >
                    <Link
                      href={n.link ?? "#"}
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                      }}
                      className="block"
                    >
                      <p className="font-medium">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
