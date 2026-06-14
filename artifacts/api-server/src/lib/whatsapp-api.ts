/**
 * Low-level Meta Cloud API (WhatsApp Business) helpers.
 * All failures are swallowed — callers never crash due to WhatsApp issues.
 * Never hits the real API under the test runner.
 *
 * Required env vars:
 *   WHATSAPP_TOKEN          — permanent access token from Meta Developers Console
 *   WHATSAPP_PHONE_NUMBER_ID — sender phone-number-id (e.g. "123456789012345")
 */

const META_API_BASE = "https://graph.facebook.com/v20.0";

export function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test";
}

function getToken(): string | null {
  return process.env.WHATSAPP_TOKEN || null;
}

function getPhoneNumberId(): string | null {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || null;
}

/** Normalise a phone number to E.164 (digits only, with country code). */
export function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Send a plain-text WhatsApp message to `toPhone` (E.164, no '+').
 * Returns true on success, false on failure.
 */
export async function sendWhatsAppText(
  toPhone: string,
  text: string,
): Promise<boolean> {
  if (isTestEnv()) return true;
  const token = getToken();
  const phoneNumberId = getPhoneNumberId();
  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — skipping");
    return false;
  }
  const to = normalisePhone(toPhone);
  try {
    const res = await fetch(
      `${META_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[whatsapp] sendText HTTP ${res.status}:`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] sendText error:", err);
    return false;
  }
}

/**
 * Check whether Meta credentials are configured.
 * Used by the settings endpoint to show status in the UI.
 */
export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
