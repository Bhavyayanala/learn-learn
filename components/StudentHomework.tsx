"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Assignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  max_marks: number;
};

type Submission = {
  id: string;
  assignment_id: string;
  response_text: string | null;
  status: string;
  marks_awarded: number | null;
  teacher_comment: string | null;
};

export function StudentHomework({
  studentId,
  assignments,
  initialSubmissions,
}: {
  studentId: string;
  assignments: Assignment[];
  initialSubmissions: Submission[];
}) {
  const supabase = createClient();

  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(assignmentId: string) {
    if (!draft.trim()) {
      setError("Write your answer first!");
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: insertErr } = await supabase
      .from("assignment_submissions")
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        response_text: draft,
        status: "submitted",
      })
      .select("id, assignment_id, response_text, status, marks_awarded, teacher_comment")
      .single();

    setBusy(false);

    if (insertErr || !data) {
      setError(insertErr?.message ?? "Could not send your homework.");
      return;
    }

    setSubmissions((prev) => [...prev, data]);
    setOpenId(null);
    setDraft("");
  }

  if (assignments.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500">
        No homework right now — enjoy! 🎉
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {assignments.map((a) => {
        const mine = submissions.find((s) => s.assignment_id === a.id);
        return (
          <div
            key={a.id}
            className="rounded-2xl border-2 border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{a.title}</p>
                {a.due_date && (
                  <p className="text-xs text-slate-400">Due {a.due_date}</p>
                )}
              </div>
              {mine ? (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    mine.status === "graded"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {mine.status === "graded" ? "✓ Graded" : "✓ Sent"}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                  To do
                </span>
              )}
            </div>

            {a.instructions && (
              <p className="mt-2 text-sm text-slate-600">{a.instructions}</p>
            )}

            {mine ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Your answer</p>
                <p className="mt-1 text-sm">{mine.response_text}</p>
                {mine.marks_awarded !== null && (
                  <p className="mt-2 text-sm font-bold text-emerald-700">
                    ⭐ {mine.marks_awarded}/{a.max_marks}
                  </p>
                )}
                {mine.teacher_comment && (
                  <p className="mt-1 text-sm italic text-slate-600">
                    Teacher says: {mine.teacher_comment}
                  </p>
                )}
              </div>
            ) : openId === a.id ? (
              <div className="mt-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type your answer here…"
                  rows={4}
                  className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => submit(a.id)}
                    disabled={busy}
                    className="rounded-xl bg-student px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send to Teacher"}
                  </button>
                  <button
                    onClick={() => {
                      setOpenId(null);
                      setDraft("");
                    }}
                    className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setOpenId(a.id)}
                className="mt-3 rounded-xl bg-student px-4 py-2 text-sm font-bold text-white"
              >
                Do it now
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
