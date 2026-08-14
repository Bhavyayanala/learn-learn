// LearnNest — payment adapter (master prompt sections 28, 67)
//
// The gateway is behind an interface so the rest of the app never talks
// to a provider SDK directly. Today only the mock adapter is wired up,
// because Razorpay needs live credentials. Adding Razorpay later means
// implementing this same interface — no changes to routes or UI.
//
// Section 28 is explicit that a payment must never be reported successful
// without server-side verification. Both adapters therefore split
// "create an order" from "verify it", and only `verifyPayment` may
// conclude success.

export type CreateOrderInput = {
  feeCycleId: string;
  amountInRupees: number;
  reference: string;
};

export type CreateOrderResult = {
  providerOrderId: string;
  provider: string;
};

export type VerifyPaymentInput = {
  providerOrderId: string;
  providerPaymentId: string;
  signature?: string;
};

export type VerifyPaymentResult = {
  verified: boolean;
  reason?: string;
};

export interface PaymentAdapter {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

/**
 * Development/demo adapter. Simulates a gateway without contacting one.
 *
 * It is deliberately NOT a rubber stamp: it verifies that the payment id
 * corresponds to the order id it issued, so the verification code path
 * exercised in development is structurally the same one a real gateway
 * would drive. A mock that always returned `verified: true` would hide
 * bugs in the calling code.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock";

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const providerOrderId = `mock_order_${input.feeCycleId.slice(0, 8)}_${Date.now()}`;
    return { providerOrderId, provider: this.name };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!input.providerOrderId || !input.providerPaymentId) {
      return { verified: false, reason: "Missing order or payment id." };
    }
    // The mock "gateway" issues payment ids derived from the order id;
    // anything else is treated as a mismatch.
    if (!input.providerPaymentId.startsWith("mock_pay_")) {
      return { verified: false, reason: "Unrecognised payment id." };
    }
    const orderSuffix = input.providerOrderId.replace("mock_order_", "");
    if (!input.providerPaymentId.includes(orderSuffix)) {
      return { verified: false, reason: "Payment does not match the order." };
    }
    return { verified: true };
  }

  /** Only the mock has this — it stands in for the user completing checkout. */
  simulateCheckout(providerOrderId: string): string {
    return `mock_pay_${providerOrderId.replace("mock_order_", "")}`;
  }
}

// A Razorpay adapter would go here, implementing the same interface and
// reading RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from the environment.
// `verifyPayment` would recompute the HMAC-SHA256 signature over
// `${order_id}|${payment_id}` and compare it against the signature
// Razorpay sends back. See .env.example for the variable names.

export function getPaymentAdapter(): PaymentAdapter {
  // When Razorpay credentials exist, select it here.
  return new MockPaymentAdapter();
}
