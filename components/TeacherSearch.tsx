"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResultGroup = { label: string; items: string[] };

export function TeacherSearch() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    setBusy(true);

    // RLS already scopes every one of these to the logged-in teacher's
    // own classes/students, so a simple fetch-then-filter is safe and
    // fast at tuition scale — no need for cross-table ilike SQL.
    const [{ data: students }, { data: materials }, { data: assignments }, { data: tests }, { data: doubts }] =
      await Promise.all([
        supabase.from("students").select("id, grade, users(full_name)"),
        supabase.from("materials").select("id, file_name"),
        supabase.from("assignments").select("id, title"),
        supabase.from("tests").select("id, title"),
        supabase.from("doubts").select("id, question"),
      ]);

    function name(rel: unknown): string {
      const s = Array.isArray(rel) ? rel[0] : rel;
      const u = s ? (s as { users: unknown }).users : null;
      const uu = Array.isArray(u) ? u[0] : u;
      return (uu as { full_name?: string } | null)?.full_name ?? "Student";
    }

    const studentMatches = (students ?? [])
      .map((s) => name(s.users))
      .filter((n) => n.toLowerCase().includes(q));

    const materialMatches = (materials ?? [])
      .map((m) => m.file_name)
      .filter((n) => n.toLowerCase().includes(q));

    const assignmentMatches = (assignments ?? [])
      .map((a) => a.title)
      .filter((n) => n.toLowerCase().includes(q));

    const testMatches = (tests ?? [])
      .map((t) => t.title)
      .filter((n) => n.toLowerCase().includes(q));

    const doubtMatches = (doubts ?? [])
      .map((d) => d.question)
      .filter((n) => n.toLowerCase().includes(q));

    setBusy(false);
    setGroups([
      { label: "Students", items: studentMatches },
      { label: "Materials", items: materialMatches },
      { label: "Assignments", items: assignmentMatches },
      { label: "Tests", items: testMatches },
      { label: "Doubts", items: doubtMatches },
    ]);
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students, materials, assignments, tests, doubts…"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Search"}
        </button>
      </form>

      {groups && (
        <div className="mt-4 space-y-4">
          {groups.every((g) => g.items.length === 0) ? (
            <p className="text-sm text-slate-500">No matches.</p>
          ) : (
            groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.label}>
                  <p className="text-xs font-semibold text-slate-400">{g.label}</p>
                  <ul className="mt-1 space-y-1">
                    {g.items.map((item, i) => (
                      <li
                        key={i}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
