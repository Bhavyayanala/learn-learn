"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Doubt = {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  created_at: string;
};

export function AskTeacher({
  studentId,
  classId,
  initialDoubts,
}: {
  studentId: string;
  classId: string;
  initialDoubts: Doubt[];
}) {
  const supabase = createClient();

  const [doubts, setDoubts] = useState(initialDoubts);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setBusy(true);
    setError(null);

    const { data, error: insertErr } = await supabase
      .from("doubts")
      .insert({
        class_id: classId,
        student_id: studentId,
        question,
        status: "open",
      })
      .select("id, question, answer, status, created_at")
      .single();

    setBusy(false);

    if (insertErr || !data) {
      setError(insertErr?.message ?? "Could not send your question.");
      return;
    }

    setDoubts((prev) => [data, ...prev]);
    setQuestion("");
  }

  return (
    <div>
      <form onSubmit={ask} className="rounded-2xl border-2 border-slate-200 bg-white p-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would you like to ask? 🤔"
          rows={3}
          className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="mt-2 rounded-xl bg-student px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Ask Teacher"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {doubts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {doubts.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border-2 border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{d.question}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    d.status === "answered"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {d.status === "answered" ? "Answered" : "Waiting"}
                </span>
              </div>
              {d.answer && (
                <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm">
                  💡 {d.answer}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
