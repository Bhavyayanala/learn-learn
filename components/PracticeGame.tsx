"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PracticeQuestion = {
  id: string;
  question_type: string;
  question_text: string;
  options: string[] | null;
  marks: number;
};

type PracticeResult = {
  correct: boolean;
  correct_answer: string;
  xp_earned: number;
};

export function PracticeGame({ questions }: { questions: PracticeQuestion[] }) {
  const supabase = createClient();

  const [queue] = useState(() => [...questions].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = queue[index];

  async function submit() {
    if (!answer.trim() || !current) return;
    setBusy(true);
    setError(null);

    const { data, error: rpcErr } = await supabase.rpc("practice_check_answer", {
      p_question_id: current.id,
      p_given: answer,
    });

    setBusy(false);

    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not check that answer.");
      return;
    }

    setResult(data as PracticeResult);
    setTotalXp((prev) => prev + ((data as PracticeResult).xp_earned ?? 0));
  }

  function next() {
    setResult(null);
    setAnswer("");
    setIndex((i) => i + 1);
  }

  if (questions.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-center text-sm text-slate-500">
        No practice questions available yet — ask your teacher to add some!
      </p>
    );
  }

  if (!current) {
    return (
      <div className="rounded-2xl border-2 border-student bg-student-light p-6 text-center">
        <p className="text-3xl">🏆</p>
        <p className="mt-2 font-bold">All done!</p>
        <p className="mt-1 text-sm text-slate-600">You earned {totalXp} XP this round.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-student-light bg-white p-5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Question {index + 1} of {queue.length}</span>
        <span>⭐ {totalXp} XP this round</span>
      </div>

      <p className="mt-3 text-lg font-bold">{current.question_text}</p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!result ? (
        <>
          {current.options ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {current.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAnswer(opt)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-medium ${
                    answer === opt
                      ? "border-student bg-student-light"
                      : "border-slate-200"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer"
              className="mt-4 w-full rounded-xl border-2 border-slate-300 px-3 py-2 text-sm"
            />
          )}
          <button
            onClick={submit}
            disabled={busy || !answer}
            className="mt-4 w-full rounded-xl bg-student px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Checking…" : "Submit Answer"}
          </button>
        </>
      ) : (
        <div className="mt-4">
          <div
            className={`rounded-xl p-4 text-center font-bold ${
              result.correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
            }`}
          >
            {result.correct ? `🎉 Correct! +${result.xp_earned} XP` : "Not quite!"}
          </div>
          {!result.correct && (
            <p className="mt-2 text-center text-sm text-slate-500">
              The answer was: <strong>{result.correct_answer}</strong>
            </p>
          )}
          <button
            onClick={next}
            className="mt-4 w-full rounded-xl bg-student px-4 py-3 font-bold text-white"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
