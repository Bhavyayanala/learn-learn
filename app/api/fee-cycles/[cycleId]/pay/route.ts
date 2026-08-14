import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaymentAdapter } from "@/lib/payments/adapter";

// Creates a gateway order and records an 'initiated' payment.
// Deliberately cannot mark anything successful — see ./verify.
export async function POST(
  req: Request,
  { params }: { params: { cycleId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // RLS: a parent can select their own child's cycle; a teacher their
  // own class's. Either is allowed to start a payment.
  const { data: cycle, error: cycleErr } = await supabase
    .from("fee_cycles")
    .select("id, amount, status, period_label")
    .eq("id", params.cycleId)
    .single();

  if (cycleErr || !cycle) {
    return NextResponse.json(
      { error: "Fee cycle not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  if (cycle.status === "paid") {
    return NextResponse.json(
      { error: "This fee cycle is already paid." },
      { status: 409 }
    );
  }

  const adapter = getPaymentAdapter();
  const reference = `LN-${cycle.period_label}-${cycle.id.slice(0, 8)}`;

  const order = await adapter.createOrder({
    feeCycleId: cycle.id,
    amountInRupees: Number(cycle.amount),
    reference,
  });

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      fee_cycle_id: cycle.id,
      amount: cycle.amount,
      provider: order.provider,
      provider_order_id: order.providerOrderId,
      status: "initiated",
      reference,
    })
    .select("id, provider_order_id, reference")
    .single();

  if (payErr || !payment) {
    return NextResponse.json(
      { error: payErr?.message ?? "Could not start the payment." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    paymentId: payment.id,
    providerOrderId: payment.provider_order_id,
    provider: order.provider,
    reference: payment.reference,
    amount: Number(cycle.amount),
  });
}
