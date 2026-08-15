import { Resend } from "resend";

// LearnNest — email notification adapter (master prompt section 30)
//
// Same gateway-agnostic shape as lib/payments/adapter.ts and
// lib/notifications/whatsapp.ts. Built as a second channel because
// WhatsApp's Cloud API requires a billing method attached to the Meta
// Business Account before it will send anything at all — a real
// barrier that isn't worth pushing through right now. Email has no such
// requirement: Resend's free tier (3,000 emails/month, 100/day) needs
// only an API key, no business verification.
//
// Coverage is the mirror image of WhatsApp's, worth knowing: a parent
// who signed up via phone/OTP has no email on file (that signup path
// never asks for one), so only email-signup parents receive this
// channel — the exact inverse of WhatsApp only reaching phone-OTP
// parents. Sending to whichever channel a parent actually has on file
// is the right behavior until every parent profile collects both.

export type SendEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: string };

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export async function sendFeeReminderEmail(params: {
  parentEmail: string;
  studentName: string;
  amount: number;
  periodLabel: string;
}): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    return { sent: false, reason: "Email is not configured on this server." };
  }

  // Resend's own onboarding sender works without a verified domain,
  // useful for testing — swap to your own verified domain address for
  // production so mail doesn't land in spam and shows LearnNest as the
  // sender, not Resend.
  const from = process.env.EMAIL_FROM_ADDRESS ?? "LearnNest <onboarding@resend.dev>";

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.parentEmail,
      subject: `Tuition fee due for ${params.studentName} — ${params.periodLabel}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #3730A3;">Tuition Fee Reminder</h2>
          <p>Hi,</p>
          <p>
            This is a reminder that <strong>${params.studentName}</strong>'s
            tuition fee of <strong>₹${params.amount}</strong> for
            <strong>${params.periodLabel}</strong> is now due.
          </p>
          <p>Please log in to LearnNest to complete the payment.</p>
          <p style="color: #888; font-size: 12px; margin-top: 32px;">
            LearnNest — a tuition management platform.
          </p>
        </div>
      `,
      text: `Hi! This is a reminder that ${params.studentName}'s tuition fee of ₹${params.amount} for ${params.periodLabel} is now due. Please log in to LearnNest to complete the payment.`,
    });

    if (error) {
      return { sent: false, reason: error.message };
    }
    return { sent: true, messageId: data?.id ?? "unknown" };
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "Network error contacting the email provider.",
    };
  }
}
