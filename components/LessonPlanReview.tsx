"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PlanItem = {
  id: string;
  day_number: number;
  scheduled_date: string | null;
  title: string;
  learning_objective: string | null;
  suggested_activities: string | null;
  estimated_minutes: number;
  is_revision: boolean;
  is_assessment: boolean;
};

export function LessonPlanReview({
  planId,
  status,
  items,
}: {
  planId: string;
  status: "draft" | "accepted";
  items: PlanItem[];
}) {
  const supabase = createClient();

  const [rows, setRows] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRow(row: PlanItem) {
    setSaving(true);
    setError(null);

    const { error: updateErr } = await supabase
      .from("lesson_plan_items")
      .update({
        custom_title: row.title,
        learning_objective: row.learning_objective,
        suggested_activities: row.suggested_activities,
        estimated_minutes: row.estimated_minutes,
      })
      .eq("id", row.id);

    setSaving(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    setEditingId(null);
  }

  function updateRow(id: string, patch: Partial<PlanItem>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function acceptPlan() {
    setSaving(true);
    setError(null);

    const { error: acceptErr } = await supabase
      .from("lesson_plans")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", planId);

    setSaving(false);

    if (acceptErr) {
      setError(acceptErr.message);
      return;
    }
    setPlanStatus("accepted");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            planStatus === "accepted"
              ? "bg-parent-light text-parent"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {planStatus === "accepted" ? "Accepted" : "Draft — awaiting review"}
        </span>

        {planStatus === "draft" && (
          <button
            onClick={acceptPlan}
            disabled={saving}
            className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Accept Plan
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <ul className="mt-5 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-400">
                  Day {row.day_number}
                  {row.scheduled_date ? ` · ${row.scheduled_date}` : ""}
                  {row.is_revision && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                      Revision
                    </span>
                  )}
                  {row.is_assessment && (
                    <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                      Assessment
                    </span>
                  )}
                </p>

                {editingId === row.id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={row.title}
                      onChange={(e) => updateRow(row.id, { title: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold"
                    />
                    <textarea
                      value={row.learning_objective ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, { learning_objective: e.target.value })
                      }
                      placeholder="Learning objective"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                    />
                    <textarea
                      value={row.suggested_activities ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, { suggested_activities: e.target.value })
                      }
                      placeholder="Suggested activities"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Minutes</label>
                      <input
                        type="number"
                        value={row.estimated_minutes}
                        onChange={(e) =>
                          updateRow(row.id, {
                            estimated_minutes: Number(e.target.value),
                          })
                        }
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRow(row)}
                        disabled={saving}
                        className="rounded-lg bg-teacher px-3 py-1 text-xs font-medium text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-0.5 font-semibold">{row.title}</p>
                    {row.learning_objective && (
                      <p className="mt-1 text-sm text-slate-600">
                        Goal: {row.learning_objective}
                      </p>
                    )}
                    {row.suggested_activities && (
                      <p className="mt-1 text-xs text-slate-400">
                        {row.suggested_activities}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      {row.estimated_minutes} min
                    </p>
                  </>
                )}
              </div>

              {editingId !== row.id && (
                <button
                  onClick={() => setEditingId(row.id)}
                  className="shrink-0 text-xs text-teacher underline"
                >
                  Edit
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
