import { Resend } from "resend";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function buildAutoReplyHtml(firstName: string, intakeUrl: string): string {
  const waLink = process.env.WHATSAPP_LINK || "https://wa.me/972543000000";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>תודה על פנייתך — Agent Hub Guru</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <tr>
            <td style="padding:36px 40px 28px;text-align:center;border-bottom:1px solid #eef2f7;">
              <div style="display:inline-flex;align-items:center;gap:14px;">
                <div style="background:#4285f4;border-radius:12px;width:54px;height:54px;text-align:center;line-height:54px;font-size:28px;">🤖</div>
                <div style="text-align:right;">
                  <div style="font-size:22px;font-weight:700;color:#1a1a2e;">Agent Hub Guru</div>
                  <div style="font-size:11px;color:#8892a4;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">AI ENGINEERING</div>
                </div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 44px 36px;">
              <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1a1a2e;">שלום ${firstName},</p>

              <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">
                תודה שפניתם אלינו! קיבלנו את פנייתכם ושמחים על ההתעניינות.
              </p>

              <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151;">
                כדי שנוכל להכין עבורכם הצעה מותאמת אישית, נשמח אם תמלאו שאלון קצר — זה לוקח כ-3 דקות בלבד:
              </p>

              <table cellpadding="0" cellspacing="0" style="margin:0 auto 36px;">
                <tr>
                  <td style="text-align:center;">
                    <a href="${intakeUrl}"
                       style="display:inline-block;background:#4285f4;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 44px;border-radius:10px;">
                      📋 למילוי שאלון האפיון
                    </a>
                    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;text-align:center;direction:ltr;">
                      <a href="${intakeUrl}" style="color:#4285f4;text-decoration:none;">${intakeUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin:0 auto 36px;width:100%;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 24px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">יש שאלות? דברו איתנו ישירות:</p>
                    <a href="${waLink}"
                       style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:10px 28px;border-radius:8px;">
                      💬 וואטסאפ
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:15px;line-height:1.8;color:#6b7280;text-align:right;">
                נתראה בקרוב,<br>
                עופר שחר ואור מושה<br>
                <span style="color:#4285f4;font-weight:500;">Agent Hub Guru AI Engineering</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 44px;background:#f8fafc;border-top:1px solid #eef2f7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                קיבלת מייל זה כי שלחת אלינו פנייה. אם לא אתם — אנא התעלמו ממייל זה.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAutoReplyEmail(
  toEmail: string,
  toName: string,
  intakeUrl: string,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  const resend = getClient();
  if (!resend) {
    console.warn("[email-sender] RESEND_API_KEY not set — skipping auto-reply");
    return;
  }

  const from = process.env.RESEND_FROM || "noreply@agenthub.guru";
  const firstName = toName.split(/[\s@]/)[0];
  // Fall back to the generic intake URL only when no per-lead URL was supplied
  const linkUrl = intakeUrl || process.env.INTAKE_FORM_URL || "https://review-metrics-roadmap.replit.app/client-intake/";

  try {
    const { error } = await resend.emails.send({
      from: `Agent Hub Guru <${from}>`,
      to: toEmail,
      subject: "תודה על פנייתך — Agent Hub Guru",
      html: buildAutoReplyHtml(firstName, linkUrl),
    });

    if (error) {
      console.error("[email-sender] Resend error:", error.message);
    } else {
      console.log(`[email-sender] auto-reply sent via Resend to ${toEmail}`);
    }
  } catch (err) {
    console.error(
      "[email-sender] failed to send auto-reply:",
      err instanceof Error ? err.message : err,
    );
  }
}

export function isEmailSendingConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
