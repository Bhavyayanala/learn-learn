// LearnNest — WhatsApp notification adapter (master prompt section 29)
//
// Same design principle as lib/payments/adapter.ts: the rest of the app
// never talks to Meta's API directly, only to this module. If you swap
// providers later (a BSP like 360dialog, or add SMS/email as fallback
// channels), only this file needs to change.
//
// WhatsApp Business requires every outbound message that isn't a reply
// within a 24-hour customer-service window to use a pre-approved
// message TEMPLATE — you can't just send arbitrary text. This means the
// exact wording below has to match what you submit to Meta for
// approval. See README for the exact template text to submit.

export type SendTemplateResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

function normalizePhone(phone: string): string {
  // Meta wants digits only, with country code, no leading '+' or spaces.
  return phone.replace(/[^\d]/g, "");
}

export async function sendWhatsAppTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams: string[];
}): Promise<SendTemplateResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    // Not configured — treat as a soft no-op rather than an error, the
    // same way the payment adapter falls back to "mock" without keys.
    // Callers should not let this block anything else from succeeding.
    return { sent: false, reason: "WhatsApp is not configured on this server." };
  }

  const to = normalizePhone(params.to);
  if (to.length < 8) {
    return { sent: false, reason: "Invalid phone number." };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.languageCode ?? "en_US" },
            components: [
              {
                type: "body",
                parameters: params.bodyParams.map((text) => ({
                  type: "text",
                  text,
                })),
              },
            ],
          },
        }),
      }
    );

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const reason =
        body?.error?.message ?? `WhatsApp API returned ${res.status}`;
      return { sent: false, reason };
    }

    const messageId = body?.messages?.[0]?.id ?? "unknown";
    return { sent: true, messageId };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Network error contacting WhatsApp.",
    };
  }
}

/** Fee-due reminder — see README for the exact template wording to
 * submit to Meta for approval. Two placeholders: student name, amount. */
export async function sendFeeReminderWhatsApp(params: {
  parentPhone: string;
  studentName: string;
  amount: number;
  periodLabel: string;
}): Promise<SendTemplateResult> {
  const templateName = process.env.WHATSAPP_FEE_TEMPLATE_NAME ?? "fee_reminder";
  return sendWhatsAppTemplate({
    to: params.parentPhone,
    templateName,
    bodyParams: [
      params.studentName,
      `₹${params.amount}`,
      params.periodLabel,
    ],
  });
}
