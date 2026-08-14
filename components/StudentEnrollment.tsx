"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type EnrolledStudent = {
  student_id: string;
  full_name: string;
  grade: string;
};

export function StudentEnrollment({
  classId,
  initialStudents,
}: {
  classId: string;
  initialStudents: EnrolledStudent[];
}) {
  const supabase = createClient();

  const [students, setStudents] = useState(initialStudents);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/classes/${classId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not enroll that student.");
      return;
    }

    const body = await res.json();
    setStudents((prev) => [
      ...prev,
      { student_id: body.student.id, full_name: body.student.full_name, grade: "" },
    ]);
    setEmail("");
  }

  async function handleRemove(studentId: string) {
    setBusy(true);
    setError(null);

    const { error: removeErr } = await supabase
      .from("class_students")
      .delete()
      .eq("class_id", classId)
      .eq("student_id", studentId);

    setBusy(false);

    if (removeErr) {
      setError(removeErr.message);
      return;
    }
    setStudents((prev) => prev.filter((s) => s.student_id !== studentId));
  }

  return (
    <div>
      <form onSubmit={handleEnroll} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          required
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Enroll"}
        </button>
      </form>

      <p className="mt-2 text-xs text-slate-400">
        The student needs a LearnNest account first — enroll them using the
        email they signed up with.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {students.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No students enrolled yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {students.map((s) => (
            <li
              key={s.student_id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span>{s.full_name}</span>
              <button
                onClick={() => handleRemove(s.student_id)}
                disabled={busy}
                className="text-xs text-red-600 underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
