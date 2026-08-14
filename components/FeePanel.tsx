"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FeeCycleRow = {
  id: string;
  student_name: string;
  period_label: string;
  classes_planned: number;
  classes_completed: number;
  amount: number;
  status: string;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-slate-100 text-slate-600",
  due: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-700",
  waived: "bg-slate-100 text-slate-500",
};

export function FeePanel({
  classId,
  monthlyFee,
  initialCycles,
}: {
  classId: string;
  monthlyFee: number | null;
  initialCycles: FeeCycleRow[];
}) {
  const router = useRouter();
  const [cycles] = useState(initialCycles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setInfo(null);

    const res = await fetch(`/api/classes/${classId}/fee-cycles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not generate fee cycles.");
      return;
    }

    const body = await res.json();
    setInfo(
      `${body.cyclesCreated} fee cycle(s) for ${body.period} · ${body.classesCompleted} classes completed · status: ${body.status}`
    );
    router.refresh();
  }

  if (monthlyFee === null) {
    return (
      <p className="text-sm text-slate-500">
        No monthly fee set for this class, so fee cycles can&apos;t be
        generated. Add one when creating the class.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-xl bg-teacher px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate this month's fees"}
        </button>
        <span className="text-xs text-slate-500">₹{monthlyFee}/month</span>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {info && <p className="mt-2 text-sm text-emerald-700">{info}</p>}

      {cycles.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No fee cycles yet. Generate one once the month&apos;s classes are
          under way.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {cycles.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{c.student_name}</p>
                <p className="text-xs text-slate-400">
                  {c.period_label} · {c.classes_completed}/{c.classes_planned}{" "}
                  classes · ₹{c.amount}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  STATUS_STYLE[c.status] ?? "bg-slate-100"
                }`}
              >
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
