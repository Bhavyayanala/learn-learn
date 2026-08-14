"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ParentFeeCycle = {
  id: string;
  child_name: string;
  period_label: string;
  classes_planned: number;
  classes_completed: number;
  amount: number;
  status: string;
};

export function ParentFees({ cycles }: { cycles: ParentFeeCycle[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ ref: string; amount: number } | null>(
    null
  );

  async function pay(cycleId: string) {
    setBusyId(cycleId);
    setError(null);
    setReceipt(null);

    // 1. Ask the server to create a gateway order.
    const initRes = await fetch(`/api/fee-cycles/${cycleId}/pay`, {
      method: "POST",
    });

    if (!initRes.ok) {
      setBusyId(null);
      const body = await initRes.json().catch(() => null);
      setError(body?.error ?? "Could not start the payment.");
      return;
    }

    const init = await initRes.json();

    // 2. In production this is where the Razorpay checkout widget opens
    //    and the user actually pays. With the mock adapter we stand in
    //    for that step by deriving the payment id the mock gateway would
    //    have returned.
    const mockPaymentId = `mock_pay_${String(init.providerOrderId).replace("mock_order_", "")}`;

    // 3. Server verifies. This is the only path that can mark it paid.
    const verifyRes = await fetch(`/api/payments/${init.paymentId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_payment_id: mockPaymentId }),
    });

    setBusyId(null);

    if (!verifyRes.ok) {
      const body = await verifyRes.json().catch(() => null);
      setError(body?.error ?? "Payment could not be verified.");
      return;
    }

    const verified = await verifyRes.json();
    setReceipt({ ref: verified.reference, amount: verified.amount });
    router.refresh();
  }

  if (cycles.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No tuition fees are due right now.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {receipt && (
        <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">Payment successful</p>
          <p className="text-emerald-700">
            ₹{receipt.amount} · Receipt {receipt.ref}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {cycles.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">
                {c.child_name} · {c.period_label}
              </p>
              <p className="text-xs text-slate-400">
                {c.classes_completed}/{c.classes_planned} classes · ₹{c.amount}
              </p>
            </div>

            {c.status === "paid" ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                Paid
              </span>
            ) : c.status === "due" ? (
              <button
                onClick={() => pay(c.id)}
                disabled={busyId === c.id}
                className="rounded-xl bg-parent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {busyId === c.id ? "Processing…" : `Pay ₹${c.amount}`}
              </button>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                In progress
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-slate-400">
        Payments currently run through a development gateway. Real card /
        UPI payment needs Razorpay credentials to be configured.
      </p>
    </div>
  );
}
