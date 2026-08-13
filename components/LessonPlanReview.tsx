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
  completion_status: "not_started" | "in_progress" | "completed";
  completion_percentage: number;
  teacher_notes: string | null;
};

export type Proposal = {
  id: string;
  reason: string;
  proposed_items: {
    day_number: number;
    scheduled_date: string | null;
    topic_id: string | null;
    custom_title: string | null;
    learning_objective: string | null;
    suggested_activities: string | null;
    estimated_minutes: number;
    is_revision: boolean;
    is_assessment: boolean;
  }[];
} | null;

const COMPLETION_OPTIONS = [0, 25, 50, 75, 100];

function statusColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-400";
  if (pct > 0) return "bg-orange-400";
  return "bg-slate-200";
}

export function LessonPlanReview({
  planId,
  status,
  items,
  initialProposal,
}: {
  planId: string;
  status: "draft" | "accepted";
  items: PlanItem[];
  initialProposal: Proposal;
}) {
  const supabase = createClient();

  const [rows, setRows] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal>(initialProposal);
  const [proposalItems, setProposalItems] = useState(initialProposal?.proposed_items ?? []);
  const [notesDraft, setNotesDraft] = useState("");

  const overallPct =
    rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.completion_percentage, 0) / rows.length)
      : 0;

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
        scheduled_date: row.scheduled_date,
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

  async function submitCompletion(row: PlanItem, percentage: number) {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/lesson-plan-items/${row.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percentage, notes: notesDraft || null }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not save completion.");
      return;
    }

    const body = await res.json();
    updateRow(row.id, {
      completion_percentage: percentage,
      completion_status: percentage >= 100 ? "completed" : percentage <= 0 ? "not_started" : "in_progress",
      teacher_notes: notesDraft || null,
    });
    setCompletingId(null);
    setNotesDraft("");

    if (body.proposal) {
      setProposal(body.proposal);
      setProposalItems(body.proposal.proposed_items);
    }
  }

  async function resolveProposal(action: "accept" | "reject") {
    if (!proposal) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/schedule-proposals/${proposal.id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, items: action === "accept" ? proposalItems : undefined }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not resolve the proposal.");
      return;
    }

    if (action === "accept") {
      // Simplest reliable way to reflect the new day numbering/rows.
      window.location.reload();
      return;
    }

    setProposal(null);
    setProposalItems([]);
  }

  function updateProposalItem(index: number, title: string) {
    setProposalItems((prev) =>
      prev.map((p, i) => (i === index ? { ...p, custom_title: title } : p))
    );
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

      {planStatus === "accepted" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall progress</span>
            <span className="text-slate-500">{overallPct}%</span>
          </div>
          <div className="mt-2 flex gap-1">
            {rows.map((r) => (
              <div
                key={r.id}
                title={`Day ${r.day_number}: ${r.completion_percentage}%`}
                className={`h-2 flex-1 rounded-full ${statusColor(r.completion_percentage)}`}
              />
            ))}
          </div>
        </div>
      )}

      {proposal && (
        <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">
            Recommended Schedule Adjustment
          </p>
          <p className="mt-1 text-sm text-amber-800">{proposal.reason}</p>

          <ul className="mt-3 space-y-2">
            {proposalItems.map((p, i) => (
              <li
                key={i}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-xs text-amber-600">Day {p.day_number}</span>
                <input
                  value={p.custom_title ?? ""}
                  onChange={(e) => updateProposalItem(i, e.target.value)}
                  className="mt-0.5 w-full border-none bg-transparent p-0 font-medium focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => resolveProposal("accept")}
              disabled={saving}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Accept Changes
            </button>
            <button
              onClick={() => resolveProposal("reject")}
              disabled={saving}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800"
            >
              Keep Original
            </button>
          </div>
        </div>
      )}

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
                  {planStatus === "accepted" && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-white ${statusColor(row.completion_percentage)}`}
                    >
                      {row.completion_percentage}%
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
                    <div className="flex items-center gap-3">
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
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">Date</label>
                        <input
                          type="date"
                          value={row.scheduled_date ?? ""}
                          onChange={(e) =>
                            updateRow(row.id, { scheduled_date: e.target.value || null })
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        />
                      </div>
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
                    {row.teacher_notes && (
                      <p className="mt-1 text-xs italic text-slate-500">
                        Note: {row.teacher_notes}
                      </p>
                    )}
                  </>
                )}

                {completingId === row.id && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-600">
                      How much of this class was completed?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {COMPLETION_OPTIONS.map((pct) => (
                        <button
                          key={pct}
                          onClick={() => submitCompletion(row, pct)}
                          disabled={saving}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:border-teacher hover:text-teacher"
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Optional note (e.g. 'students need more practice with carrying')"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {editingId !== row.id && (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    onClick={() => setEditingId(row.id)}
                    className="text-xs text-teacher underline"
                  >
                    Edit
                  </button>
                  {planStatus === "accepted" && (
                    <button
                      onClick={() =>
                        setCompletingId(completingId === row.id ? null : row.id)
                      }
                      className="text-xs text-teacher underline"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
