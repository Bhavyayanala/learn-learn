"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TestQuestion = {
  question_id: string;
  sequence_order: number;
  question_type: string;
  question_text: string;
  options: string[] | null;
  marks: number;
};

export function TakeTest({
  testId,
  title,
  questions,
}: {
  testId: string;
  title: string;
  questions: TestQuestion[];
}) {
  const supabase = createClient();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const sorted = [...questions].sort((a, b) => a.sequence_order - b.sequence_order);

  async function start() {
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user?.id)
      .single();

    const { data: attempt, error: attemptErr } = await supabase
      .from("test_attempts")
      .insert({ test_id: testId, student_id: student?.id })
      .select("id")
      .single();

    setBusy(false);

    if (attemptErr || !attempt) {
      setError(attemptErr?.message ?? "Could not start the test.");
      return;
    }
    setAttemptId(attempt.id);
  }

  async function submit() {
    if (!attemptId) return;
    setBusy(true);
    setError(null);

    const rows = sorted.map((q) => ({
      attempt_id: attemptId,
      question_id: q.question_id,
      student_answer: answers[q.question_id] ?? "",
    }));

    const { error: insertErr } = await supabase.from("test_attempt_answers").insert(rows);

    if (insertErr) {
      setBusy(false);
      setError(insertErr.message);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("submit_test_attempt", {
      p_attempt_id: attemptId,
    });

    setBusy(false);

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setScore(data as number);
  }

  if (score !== null) {
    return (
      <div className="rounded-2xl border-2 border-student bg-student-light p-6 text-center">
        <p className="text-3xl">📝</p>
        <p className="mt-2 font-bold">{title} — submitted!</p>
        <p className="mt-1 text-sm text-slate-600">
          Score: {score}/{totalMarks}
        </p>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-slate-500">
          {questions.length} questions · {totalMarks} marks
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={start}
          disabled={busy}
          className="mt-4 rounded-xl bg-student px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start Test"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-5">
      <p className="font-bold">{title}</p>
      {sorted.map((q, i) => (
        <div key={q.question_id} className="rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-medium">
            {i + 1}. {q.question_text}
          </p>
          {q.options ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.question_id]: opt }))
                  }
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-medium ${
                    answers[q.question_id] === opt
                      ? "border-student bg-student-light"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              value={answers[q.question_id] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [q.question_id]: e.target.value }))
              }
              placeholder="Your answer"
              className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-student px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit Test"}
      </button>
    </div>
  );
}
