import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getPaymentAdapter } from "@/lib/payments/adapter";

// The ONLY place a payment may be marked successful (master prompt
// section 28: "Do not claim a payment is successful without server-side
// verification"). Database triggers in migration 0009 reject any attempt
// to set status='success' through the normal client, so even a
// compromised browser can't fake a paid fee cycle — it has to come
// through here, after the adapter confirms the payment with the provider.
export async function POST(
  req: Request,
  { params }: { params: { paymentId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const providerPaymentId = body?.provider_payment_id;
  const signature = body?.signature;

  if (typeof providerPaymentId !== "string" || !providerPaymentId) {
    return NextResponse.json(
      { error: "provider_payment_id is required." },
      { status: 400 }
    );
  }

  // Read through RLS first, so we only proceed for a payment this user
  // is actually entitled to see.
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("id, fee_cycle_id, provider_order_id, status, amount, reference")
    .eq("id", params.paymentId)
    .single();

  if (payErr || !payment) {
    return NextResponse.json(
      { error: "Payment not found, or you don't have access to it." },
      { status: 404 }
    );
  }

  if (payment.status === "success") {
    return NextResponse.json({
      status: "success",
      reference: payment.reference,
      alreadyVerified: true,
    });
  }

  const adapter = getPaymentAdapter();
  const result = await adapter.verifyPayment({
    providerOrderId: payment.provider_order_id ?? "",
    providerPaymentId,
    signature,
  });

  // Writes go through the admin client because the RLS triggers
  // deliberately block status='success' from any normal client session.
  const admin = createAdminClient();

  if (!result.verified) {
    await admin
      .from("payments")
      .update({ status: "failed", provider_payment_id: providerPaymentId })
      .eq("id", payment.id);

    return NextResponse.json(
      { status: "failed", error: result.reason ?? "Verification failed." },
      { status: 402 }
    );
  }

  const { error: updateErr } = await admin
    .from("payments")
    .update({
      status: "success",
      provider_payment_id: providerPaymentId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { error: cycleErr } = await admin
    .from("fee_cycles")
    .update({ status: "paid" })
    .eq("id", payment.fee_cycle_id);

  if (cycleErr) {
    return NextResponse.json({ error: cycleErr.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "success",
    reference: payment.reference,
    amount: Number(payment.amount),
  });
}
