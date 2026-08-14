"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type QuestionRow = {
  id: string;
  question_type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  marks: number;
};

const TYPES = [
  { value: "mcq", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "numerical", label: "Numerical" },
];

export function QuestionBank({
  classId,
  initialQuestions,
}: {
  classId: string;
  initialQuestions: QuestionRow[];
}) {
  const supabase = createClient();

  const [questions, setQuestions] = useState(initialQuestions);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState("mcq");
  const [text, setText] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [correct, setCorrect] = useState("");
  const [marks, setMarks] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const options =
      type === "mcq"
        ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean)
        : type === "true_false"
          ? ["True", "False"]
          : null;

    const { data, error: insertErr } = await supabase
      .from("questions")
      .insert({
        class_id: classId,
        question_type: type,
        question_text: text,
        options,
        correct_answer: correct,
        marks,
      })
      .select("id, question_type, question_text, options, correct_answer, marks")
      .single();

    setBusy(false);

    if (insertErr || !data) {
      setError(insertErr?.message ?? "Could not add the question.");
      return;
    }

    setQuestions((prev) => [data, ...prev]);
    setText("");
    setOptionsText("");
    setCorrect("");
    setMarks(1);
    setCreating(false);
  }

  async function remove(id: string) {
    setBusy(true);
    const { error: delErr } = await supabase.from("questions").delete().eq("id", id);
    setBusy(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  return (
    <div>
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New Question
        </button>
      ) : (
        <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <textarea
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Question text"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {type === "mcq" && (
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={"One option per line, e.g.:\n12\n14\n16\n18"}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          <input
            required
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
            placeholder={
              type === "true_false" ? "Correct answer: True or False" : "Correct answer"
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div>
            <label className="text-xs text-slate-500">Marks</label>
            <input
              type="number"
              min={1}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="block w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teacher px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add Question"}
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

      {questions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No questions yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{q.question_text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {q.question_type} · answer: {q.correct_answer} · {q.marks} marks
                  </p>
                </div>
                <button
                  onClick={() => remove(q.id)}
                  className="shrink-0 text-xs text-red-600 underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
