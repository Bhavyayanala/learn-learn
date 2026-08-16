"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProgressBar } from "@/components/ui/ProgressBar";

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
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const sorted = [...questions].sort((a, b) => a.sequence_order - b.sequence_order);
  const current = sorted[index];
  const isLast = index === sorted.length - 1;
  const answeredCount = Object.keys(answers).length;

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
      <div className="rounded-3xl border-2 border-student bg-student-light p-8 text-center shadow-soft">
        <p className="text-4xl">🎉</p>
        <p className="mt-2 font-display text-xl font-bold">{title} — submitted!</p>
        <p className="mt-1 text-sm text-ink/60">
          Score: {score}/{totalMarks}
        </p>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="rounded-3xl border-2 border-ink/8 bg-white p-6 shadow-soft">
        <p className="font-display text-lg font-bold">📝 {title}</p>
        <p className="mt-1 text-sm text-ink/50">
          {questions.length} questions · {totalMarks} marks
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={start}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-student px-4 py-3 font-bold text-white shadow-soft disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start Test"}
        </button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="rounded-3xl border-2 border-ink/8 bg-white p-6 shadow-soft">
      {/* Focused header: which question, and a progress bar — no other
          clutter visible while answering, per spec section 14. */}
      <p className="font-display text-sm font-bold text-student-dark">📝 {title}</p>
      <p className="mt-0.5 text-xs text-ink/40">
        Question {index + 1} of {sorted.length}
      </p>
      <div className="mt-2">
        <ProgressBar
          label=""
          percent={Math.round(((index + 1) / sorted.length) * 100)}
          accent="student"
        />
      </div>

      <p className="mt-6 font-display text-lg font-semibold">{current.question_text}</p>

      <div className="mt-5">
        {current.options ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {current.options.map((opt, i) => {
              const selected = answers[current.question_id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [current.question_id]: opt }))
                  }
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                    selected
                      ? "border-student bg-student-light"
                      : "border-ink/10 bg-white hover:border-student/40"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      selected ? "bg-student text-white" : "bg-ink/8 text-ink/50"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={answers[current.question_id] ?? ""}
            onChange={(e) =>
              setAnswers((prev) => ({ ...prev, [current.question_id]: e.target.value }))
            }
            placeholder="Type your answer"
            className="w-full rounded-2xl border-2 border-ink/10 px-4 py-3 text-sm focus:border-student"
          />
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-xl border-2 border-ink/10 px-4 py-2.5 text-sm font-medium text-ink/60 disabled:opacity-30"
        >
          ← Previous
        </button>

        {isLast ? (
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-xl bg-student px-4 py-2.5 text-sm font-bold text-white shadow-soft disabled:opacity-50"
          >
            {busy ? "Submitting…" : `Submit Test (${answeredCount}/${sorted.length} answered)`}
          </button>
        ) : (
          <button
            onClick={() => setIndex((i) => Math.min(sorted.length - 1, i + 1))}
            className="flex-1 rounded-xl bg-student px-4 py-2.5 text-sm font-bold text-white shadow-soft"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
