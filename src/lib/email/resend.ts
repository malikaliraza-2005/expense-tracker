/**
 * Thin Resend transactional-email wrapper (Phase 1).
 *
 * The only email the app sends today is the invite. This keeps the HTTP call in
 * one place and — crucially — DEGRADES GRACEFULLY: with no `RESEND_API_KEY` set
 * (local dev, previews, self-hosting) it logs the link and reports "not sent"
 * instead of throwing, so the invite flow still works via the copyable
 * `/invite/<token>` link the action returns. Server-only: never import into a
 * Client Component (it reads a secret key).
 *
 * Uses `fetch` directly against the Resend REST API, so no new dependency is
 * required. Set `RESEND_API_KEY` and (optionally) `RESEND_FROM` to enable real
 * delivery; `RESEND_FROM` defaults to Resend's shared onboarding sender, which
 * works for testing before a domain is verified.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Expense Tracker <onboarding@resend.dev>';

export interface SendResult {
  /** True only when Resend accepted the message for delivery. */
  sent: boolean;
  /** Present when sending was skipped or failed (for logs, not the end user). */
  reason?: string;
}

export interface InviteEmailInput {
  to: string;
  inviterName: string;
  /** Display name of the member being claimed (who the invite is "for"). */
  memberName: string;
  /** Absolute URL to the accept page. */
  acceptUrl: string;
}

/** Escape a string for safe interpolation into the HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inviteHtml({ inviterName, acceptUrl }: InviteEmailInput): string {
  const who = escapeHtml(inviterName);
  const url = escapeHtml(acceptUrl);
  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 12px">${who} invited you to Expense Tracker</h1>
      <p style="font-size:15px;line-height:1.5;color:#334155;margin:0 0 20px">
        They want to split and track shared expenses with you. Create your account
        to see the details and settle up.
      </p>
      <p style="margin:0 0 24px">
        <a href="${url}"
           style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">
          Accept invite
        </a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#64748b;margin:0">
        Or paste this link into your browser:<br>
        <a href="${url}" style="color:#047857;word-break:break-all">${url}</a>
      </p>
    </div>
  `;
}

function inviteText({ inviterName, acceptUrl }: InviteEmailInput): string {
  return (
    `${inviterName} invited you to Expense Tracker to split and track shared ` +
    `expenses with you.\n\nAccept your invite:\n${acceptUrl}\n`
  );
}

/**
 * Send an invite email. Never throws: on a missing key or a Resend error it
 * returns `{ sent: false, reason }` so the caller can still surface the copyable
 * link. The subject names the inviter for recognisable inbox context.
 */
export async function sendInviteEmail(input: InviteEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      `[resend] RESEND_API_KEY unset — invite email not sent. Link: ${input.acceptUrl}`,
    );
    return { sent: false, reason: 'no_api_key' };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? DEFAULT_FROM,
        to: [input.to],
        subject: `${input.inviterName} invited you to Expense Tracker`,
        html: inviteHtml(input),
        text: inviteText(input),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[resend] send failed (${response.status}): ${detail}`);
      return { sent: false, reason: `http_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error('[resend] send threw:', error);
    return { sent: false, reason: 'exception' };
  }
}
