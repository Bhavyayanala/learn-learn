"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Doubt = {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  student_name: string;
  created_at: string;
};

export function DoubtsPanel({ initialDoubts }: { initialDoubts: Doubt[] }) {
  const supabase = createClient();

  const [doubts, setDoubts] = useState(initialDoubts);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(doubtId: string) {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);

    const { error: updateErr } = await supabase
      .from("doubts")
      .update({
        answer: draft,
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", doubtId);

    setBusy(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setDoubts((prev) =>
      prev.map((d) =>
        d.id === doubtId ? { ...d, answer: draft, status: "answered" } : d
      )
    );
    setAnsweringId(null);
    setDraft("");
  }

  const open = doubts.filter((d) => d.status !== "answered");
  const answered = doubts.filter((d) => d.status === "answered");

  if (doubts.length === 0) {
    return <p className="text-sm text-slate-500">No questions from students yet.</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {open.length > 0 && (
        <ul className="space-y-2">
          {open.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-amber-700">
                    {d.student_name}
                  </p>
                  <p className="mt-1 text-sm">{d.question}</p>
                </div>
                {answeringId !== d.id && (
                  <button
                    onClick={() => {
                      setAnsweringId(d.id);
                      setDraft("");
                    }}
                    className="shrink-0 text-xs text-teacher underline"
                  >
                    Answer
                  </button>
                )}
              </div>

              {answeringId === d.id && (
                <div className="mt-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type your answer…"
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => answer(d.id)}
                      disabled={busy}
                      className="rounded-lg bg-teacher px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {busy ? "Sending…" : "Send answer"}
                    </button>
                    <button
                      onClick={() => setAnsweringId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {answered.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500">
            {answered.length} answered
          </summary>
          <ul className="mt-2 space-y-2">
            {answered.map((d) => (
              <li key={d.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-xs text-slate-400">{d.student_name}</p>
                <p className="mt-0.5">{d.question}</p>
                <p className="mt-1 text-slate-600">💡 {d.answer}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
