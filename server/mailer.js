// server/mailer.js
// Dependency-free transactional email via the Resend HTTP API (global fetch).
// If RESEND_API_KEY is not set, email "sends" degrade to a console log so local
// dev and unconfigured deploys keep working (the caller still succeeds).
//
// Required env for real delivery:
//   RESEND_API_KEY   — from https://resend.com (free tier available)
//   MAIL_FROM        — verified sender, e.g. "Skynet Nexus <noreply@yourdomain>"
//                      (defaults to Resend's onboarding sender for quick testing)

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

// Send an email. Returns { ok, id?, skipped?, error? }. Never throws.
async function sendMail({ to, subject, html, text }) {
  const from = process.env.MAIL_FROM || 'Skynet Nexus <onboarding@resend.dev>';
  if (!isConfigured()) {
    console.log(`[mailer] RESEND_API_KEY not set — email to ${to} not sent. Subject: ${subject}`);
    return { ok: false, skipped: true };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.warn(`[mailer] Resend responded ${resp.status}: ${detail.slice(0, 300)}`);
      return { ok: false, error: `resend_${resp.status}` };
    }
    const data = await resp.json().catch(() => ({}));
    return { ok: true, id: data && data.id };
  } catch (err) {
    console.warn('[mailer] send failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// Branded password-reset email.
function passwordResetEmail(link) {
  const text = `Reset your Skynet Nexus password\n\nWe received a request to reset your password. ` +
    `Open this link to choose a new one (it expires in 1 hour):\n\n${link}\n\n` +
    `If you didn't request this, you can safely ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#0a0e14;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#e8eef7">
      <div style="font-size:20px;font-weight:800;letter-spacing:.5px;color:#00e5ff;margin-bottom:16px">🛰️ Skynet Nexus</div>
      <h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1>
      <p style="color:#9fb0c3;line-height:1.6;margin:0 0 20px">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <a href="${link}" style="display:inline-block;background:#00e5ff;color:#04121a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Reset password</a>
      <p style="color:#6b7d92;font-size:13px;line-height:1.6;margin:24px 0 0">If the button doesn't work, paste this into your browser:<br><span style="color:#9fb0c3;word-break:break-all">${link}</span></p>
      <p style="color:#6b7d92;font-size:13px;line-height:1.6;margin:16px 0 0">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </body></html>`;
  return { subject: 'Reset your Skynet Nexus password', html, text };
}

module.exports = { sendMail, passwordResetEmail, isConfigured };
