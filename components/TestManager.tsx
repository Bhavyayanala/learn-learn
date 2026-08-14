"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuestionRow } from "@/components/QuestionBank";

export type TestRow = {
  id: string;
  title: string;
  time_limit_minutes: number | null;
  question_count: number;
  attempt_count: number;
  avg_score: number | null;
};

export function TestManager({
  classId,
  initialTests,
  availableQuestions,
}: {
  classId: string;
  initialTests: TestRow[];
  availableQuestions: QuestionRow[];
}) {
  const supabase = createClient();

  const [tests, setTests] = useState(initialTests);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      setError("Pick at least one question.");
      return;
    }
    setBusy(true);
    setError(null);

    const { data: test, error: insertErr } = await supabase
      .from("tests")
      .insert({
        class_id: classId,
        title,
        time_limit_minutes: timeLimit ? Number(timeLimit) : null,
      })
      .select("id, title, time_limit_minutes")
      .single();

    if (insertErr || !test) {
      setBusy(false);
      setError(insertErr?.message ?? "Could not create the test.");
      return;
    }

    const rows = Array.from(selected).map((question_id, i) => ({
      test_id: test.id,
      question_id,
      sequence_order: i + 1,
    }));

    const { error: linkErr } = await supabase.from("test_questions").insert(rows);

    setBusy(false);

    if (linkErr) {
      setError(linkErr.message);
      return;
    }

    setTests((prev) => [
      { ...test, question_count: rows.length, attempt_count: 0, avg_score: null },
      ...prev,
    ]);
    setTitle("");
    setTimeLimit("");
    setSelected(new Set());
    setCreating(false);
  }

  async function remove(id: string) {
    setBusy(true);
    const { error: delErr } = await supabase.from("tests").delete().eq("id", id);
    setBusy(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setTests((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          disabled={availableQuestions.length === 0}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          + New Test
        </button>
      ) : (
        <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Test title"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            placeholder="Time limit in minutes (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <p className="text-xs font-medium text-slate-500">Pick questions</p>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
              {availableQuestions.map((q) => (
                <label key={q.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                  />
                  {q.question_text}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teacher px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create Test"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {tests.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No tests yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tests.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div>
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-slate-400">
                  {t.question_count} questions
                  {t.time_limit_minutes ? ` · ${t.time_limit_minutes} min` : ""}
                  {" · "}{t.attempt_count} attempt{t.attempt_count === 1 ? "" : "s"}
                  {t.avg_score !== null ? ` · avg ${t.avg_score}` : ""}
                </p>
              </div>
              <button onClick={() => remove(t.id)} className="text-xs text-red-600 underline">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
