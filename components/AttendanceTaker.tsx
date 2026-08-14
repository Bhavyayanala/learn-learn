"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AttendanceRow = {
  id: string;
  student_id: string;
  full_name: string;
  status: "present" | "absent" | "late" | "excused";
};

const STATUSES: AttendanceRow["status"][] = ["present", "late", "absent", "excused"];

const STATUS_STYLE: Record<AttendanceRow["status"], string> = {
  present: "bg-emerald-500 text-white",
  late: "bg-amber-400 text-white",
  absent: "bg-red-500 text-white",
  excused: "bg-slate-400 text-white",
};

export function AttendanceTaker({
  classId,
  hasStudents,
}: {
  classId: string;
  hasStudents: boolean;
}) {
  const supabase = createClient();

  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function openSession() {
    setBusy(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/classes/${classId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_date: sessionDate }),
    });

    if (!res.ok) {
      setBusy(false);
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not open the session.");
      return;
    }

    const { sessionId } = await res.json();

    const { data, error: fetchErr } = await supabase
      .from("attendance")
      .select("id, student_id, status, students(users(full_name))")
      .eq("class_session_id", sessionId);

    setBusy(false);

    if (fetchErr || !data) {
      setError(fetchErr?.message ?? "Could not load the roster.");
      return;
    }

    setRows(
      data.map((r) => {
        const studentRel = Array.isArray(r.students) ? r.students[0] : r.students;
        const userRel = studentRel
          ? Array.isArray((studentRel as { users: unknown }).users)
            ? ((studentRel as { users: { full_name: string }[] }).users)[0]
            : ((studentRel as unknown as { users: { full_name: string } | null }).users)
          : null;
        return {
          id: r.id,
          student_id: r.student_id,
          full_name: userRel?.full_name ?? "Student",
          status: r.status as AttendanceRow["status"],
        };
      })
    );
  }

  async function setStatus(rowId: string, status: AttendanceRow["status"]) {
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === rowId ? { ...r, status } : r)) : prev
    );
    setSaved(false);

    const { error: updateErr } = await supabase
      .from("attendance")
      .update({ status })
      .eq("id", rowId);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setSaved(true);
  }

  if (!hasStudents) {
    return (
      <p className="text-sm text-slate-500">
        Enroll at least one student before taking attendance.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={openSession}
          disabled={busy}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Loading…" : rows ? "Reload roster" : "Take attendance"}
        </button>
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rows && rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <span className="text-sm font-medium">{r.full_name}</span>
              <div className="flex gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(r.id, s)}
                    className={`rounded-lg px-2.5 py-1 text-xs capitalize ${
                      r.status === s
                        ? STATUS_STYLE[s]
                        : "border border-slate-300 text-slate-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
