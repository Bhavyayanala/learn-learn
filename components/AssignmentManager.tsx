"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Submission = {
  id: string;
  student_id: string;
  student_name: string;
  response_text: string | null;
  marks_awarded: number | null;
  teacher_comment: string | null;
  status: string;
};

type Assignment = {
  id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  max_marks: number;
  submissions: Submission[];
};

export function AssignmentManager({
  classId,
  initialAssignments,
}: {
  classId: string;
  initialAssignments: Assignment[];
}) {
  const supabase = createClient();

  const [assignments, setAssignments] = useState(initialAssignments);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft] = useState({ marks: "", comment: "" });

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { data, error: insertErr } = await supabase
      .from("assignments")
      .insert({
        class_id: classId,
        title,
        instructions: instructions || null,
        due_date: dueDate || null,
        max_marks: maxMarks,
      })
      .select("id, title, instructions, due_date, max_marks")
      .single();

    setBusy(false);

    if (insertErr || !data) {
      setError(insertErr?.message ?? "Could not create the assignment.");
      return;
    }

    setAssignments((prev) => [{ ...data, submissions: [] }, ...prev]);
    setTitle("");
    setInstructions("");
    setDueDate("");
    setMaxMarks(10);
    setCreating(false);
  }

  async function saveGrade(assignmentId: string, submissionId: string) {
    setBusy(true);
    setError(null);

    const marks = gradeDraft.marks === "" ? null : Number(gradeDraft.marks);

    const { error: updateErr } = await supabase
      .from("assignment_submissions")
      .update({
        marks_awarded: marks,
        teacher_comment: gradeDraft.comment || null,
        status: "graded",
      })
      .eq("id", submissionId);

    setBusy(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setAssignments((prev) =>
      prev.map((a) =>
        a.id !== assignmentId
          ? a
          : {
              ...a,
              submissions: a.submissions.map((s) =>
                s.id === submissionId
                  ? {
                      ...s,
                      marks_awarded: marks,
                      teacher_comment: gradeDraft.comment || null,
                      status: "graded",
                    }
                  : s
              ),
            }
      )
    );
    setGradingId(null);
    setGradeDraft({ marks: "", comment: "" });
  }

  async function deleteAssignment(assignmentId: string) {
    setBusy(true);
    const { error: delErr } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignmentId);
    setBusy(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  }

  return (
    <div>
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New Assignment
        </button>
      ) : (
        <form
          onSubmit={createAssignment}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Assignment title"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions (optional)"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-3">
            <div>
              <label className="text-xs text-slate-500">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="block rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Max marks</label>
              <input
                type="number"
                min={1}
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="block w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teacher px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create"}
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

      {assignments.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No assignments yet for this class.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-slate-400">
                    {a.due_date ? `Due ${a.due_date} · ` : ""}
                    {a.max_marks} marks · {a.submissions.length} submitted
                  </p>
                </div>
                <button
                  onClick={() => deleteAssignment(a.id)}
                  className="shrink-0 text-xs text-red-600 underline"
                >
                  Delete
                </button>
              </div>

              {a.submissions.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {a.submissions.map((s) => (
                    <li key={s.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{s.student_name}</p>
                        {s.marks_awarded !== null ? (
                          <span className="text-xs font-medium text-emerald-700">
                            {s.marks_awarded}/{a.max_marks}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setGradingId(s.id);
                              setGradeDraft({ marks: "", comment: "" });
                            }}
                            className="text-xs text-teacher underline"
                          >
                            Grade
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {s.response_text}
                      </p>
                      {s.teacher_comment && (
                        <p className="mt-1 text-xs italic text-slate-500">
                          Your comment: {s.teacher_comment}
                        </p>
                      )}

                      {gradingId === s.id && (
                        <div className="mt-2 space-y-2">
                          <input
                            type="number"
                            min={0}
                            max={a.max_marks}
                            value={gradeDraft.marks}
                            onChange={(e) =>
                              setGradeDraft((d) => ({ ...d, marks: e.target.value }))
                            }
                            placeholder={`Marks out of ${a.max_marks}`}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                          <textarea
                            value={gradeDraft.comment}
                            onChange={(e) =>
                              setGradeDraft((d) => ({ ...d, comment: e.target.value }))
                            }
                            placeholder="Comment (optional)"
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveGrade(a.id, s.id)}
                              disabled={busy}
                              className="rounded-lg bg-teacher px-3 py-1 text-xs font-medium text-white"
                            >
                              Save grade
                            </button>
                            <button
                              onClick={() => setGradingId(null)}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
