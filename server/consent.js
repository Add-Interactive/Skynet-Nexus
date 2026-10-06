// server/consent.js
// COPPA email-loop parental consent + kid data deletion.
//
// NOTE: This implements an email-verification consent flow as a practical
// step toward COPPA compliance. It is guidance based on the FTC's COPPA rule,
// NOT legal advice. Jeff should have an attorney review before relying on it
// for compliance.
//
// Flow:
//   1. Parent registers → users.consent_verified = 0, verification email sent.
//   2. Parent clicks link → GET /api/consent/verify?token=… → consent_verified = 1.
//   3. POST /api/kids is gated: 403 { consent_required: true } until verified.
//   4. Existing users are grandfathered (migration sets consent_verified = 1).
//
// If Resend isn't configured, the verification link is logged server-side and
// returned in the API response so it can be verified manually during testing.
//
// MOUNTING: This module is mounted from connect.js's registerConnect(), which
// runs BEFORE index.js defines POST /kids and POST /auth/register. That lets
// us use api.use() middleware to gate kid creation and hook registration
// without editing index.js (which is over the GitHub write size limit).

const crypto = require('crypto');

const TOKEN_BYTES = 24;
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

// Reconstruct SITE_ORIGIN (same logic as server/index.js).
function siteOrigin() {
  const isProd = process.env.NODE_ENV === 'production';
  return process.env.SITE_ORIGIN || (isProd
    ? 'https://skynet-nexus-production.up.railway.app'
    : `http://localhost:${Number(process.env.PORT) || 4180}`);
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS consent_tokens (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  try { db.exec(`ALTER TABLE users ADD COLUMN consent_verified INTEGER NOT NULL DEFAULT 0`); }
  catch (e) { /* already exists */ }
  try { db.exec(`UPDATE users SET consent_verified = 1 WHERE consent_verified = 0`); }
  catch (e) { /* ignore */ }
  try { db.exec(`DELETE FROM consent_tokens WHERE used = 0 AND expires_at < ${Date.now()}`); }
  catch (e) { /* ignore */ }
}

function isConsentVerified(db, userId) {
  try {
    const row = db.prepare('SELECT consent_verified FROM users WHERE id = ?').get(userId);
    return !!(row && row.consent_verified);
  } catch (e) {
    return false;
  }
}

function issueToken(db, userId) {
  try { db.prepare('UPDATE consent_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(userId); }
  catch (e) { /* ignore */ }
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  db.prepare('INSERT INTO consent_tokens (token, user_id, expires_at) VALUES (?,?,?)')
    .run(token, userId, expiresAt);
  return { token, expiresAt };
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function verificationEmail(link, displayName) {
  const name = displayName || 'there';
  const text =
    `Verify your Skynet Nexus email\n\nHi ${name},\n\n` +
    `One more step: click the link below to verify your email address. ` +
    `Once verified, you can add kid profiles to your account.\n\n${link}\n\n` +
    `This link expires in 48 hours. If you didn't create a Skynet Nexus account, ` +
    `you can safely ignore this email.\n\n` +
    `Why we ask: Skynet Nexus is built for families with kids. Verifying your ` +
    `email helps us confirm that a parent or guardian — not a child — created this account.`;
  const html = `<!doctype html><html><body style="margin:0;background:#0a0e14;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#e8eef7">
      <div style="font-size:20px;font-weight:800;letter-spacing:.5px;color:#00e5ff;margin-bottom:16px">🛰️ Skynet Nexus</div>
      <h1 style="font-size:22px;margin:0 0 12px">Verify your email</h1>
      <p style="color:#9fb0c3;line-height:1.6;margin:0 0 20px">Hi ${escapeHtml(name)}, one more step: click below to verify your email address. Once verified, you can add kid profiles to your account.</p>
      <a href="${link}" style="display:inline-block;background:#00e5ff;color:#04121a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Verify my email</a>
      <p style="color:#6b7d92;font-size:13px;line-height:1.6;margin:24px 0 0">If the button doesn't work, paste this into your browser:<br><span style="color:#9fb0c3;word-break:break-all">${link}</span></p>
      <p style="color:#6b7d92;font-size:13px;line-height:1.6;margin:16px 0 0">This link expires in 48 hours. If you didn't create a Skynet Nexus account, you can safely ignore this email.</p>
      <p style="color:#6b7d92;font-size:13px;line-height:1.6;margin:16px 0 0">Why we ask: Skynet Nexus is built for families with kids. Verifying your email helps us confirm that a parent or guardian — not a child — created this account.</p>
    </div>
  </body></html>`;
  return { subject: 'Verify your Skynet Nexus email', html, text };
}

function confirmPage(ok, message) {
  const title = ok ? 'Email verified!' : 'Verification link issue';
  const body = ok
    ? `<p style="color:#9fb0c3;line-height:1.6">Your email is verified. You can now add kid profiles to your account.</p>
       <a href="/pages/profile.html" style="display:inline-block;background:#00e5ff;color:#04121a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;margin-top:12px">Go to my profile</a>`
    : `<p style="color:#9fb0c3;line-height:1.6">${escapeHtml(message)}</p>
       <a href="/pages/profile.html" style="display:inline-block;background:#00e5ff;color:#04121a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;margin-top:12px">Go to my profile</a>
       <p style="color:#6b7d92;font-size:13px;margin-top:16px">Need a new link? Sign in and use "Resend verification email" on your profile page.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)} — Skynet Nexus</title></head>
    <body style="margin:0;background:#0a0e14;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:64px 24px;color:#e8eef7;text-align:center">
      <div style="font-size:20px;font-weight:800;color:#00e5ff;margin-bottom:24px">🛰️ Skynet Nexus</div>
      <h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(title)}</h1>
      ${body}
    </div></body></html>`;
}

async function sendVerificationEmail(db, user) {
  const { sendMail } = require('./mailer');
  const { token } = issueToken(db, user.id);
  const link = `${siteOrigin()}/api/consent/verify?token=${encodeURIComponent(token)}`;
  const mail = verificationEmail(link, user.display_name || user.displayName);
  const result = await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
  if (!result.ok) {
    console.log(`[consent] verification link for ${user.email}: ${link}`);
  }
  return { emailed: result.ok, link: result.ok ? null : link };
}

function registerConsent(api, opts) {
  const { db, requireAuth } = opts;
  ensureSchema(db);

  // ---- COPPA gate: POST /api/kids requires verified parent email ----
  // Mounted via api.use() BEFORE index.js defines the route, so this runs first.
  api.use('/kids', (req, res, next) => {
    if (req.method !== 'POST') return next();
    // requireAuth runs in the route itself; we check the session here.
    const userId = req.session && req.session.userId;
    if (!userId) return next(); // let requireAuth produce the 401
    if (!isConsentVerified(db, userId)) {
      return res.status(403).json({
        error: 'Please verify your email before adding kid profiles.',
        consent_required: true
      });
    }
    next();
  });

  // ---- COPPA hook: send verification email after successful registration ----
  // Wraps res.json for POST /auth/register; fires after the 201 response is built.
  api.use('/auth/register', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const origJson = res.json.bind(res);
    res.json = function (data) {
      if (res.statusCode === 201 && data && data.user && data.user.id) {
        // Fire-and-forget: don't block the response.
        sendVerificationEmail(db, {
          id: data.user.id,
          email: data.user.email,
          display_name: data.user.displayName || data.user.display_name
        }).then(vres => {
          // Attach verification status for the frontend (best-effort; response already sent).
          console.log(`[consent] verification email for ${data.user.email}: emailed=${vres.emailed}`);
        }).catch(e => console.warn('[consent] post-register email failed:', e.message));
      }
      return origJson(data);
    };
    next();
  });

  // POST /api/consent/send-verification — authed; (re)sends the verification email.
  api.post('/consent/send-verification', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const user = db.prepare('SELECT id, email, display_name, consent_verified FROM users WHERE id = ?').get(userId);
      if (!user) return res.status(401).json({ error: 'unauthorized' });
      if (user.consent_verified) return res.json({ ok: true, already_verified: true });

      const vres = await sendVerificationEmail(db, user);
      if (!vres.emailed) {
        return res.json({ ok: true, emailed: false, note: 'Email not configured; link logged server-side.', debug_link: vres.link });
      }
      res.json({ ok: true, emailed: true });
    } catch (e) {
      console.warn('[consent] send-verification failed:', e.message);
      res.status(500).json({ error: 'Could not send verification email.' });
    }
  });

  // GET /api/consent/verify?token=… — public; marks consent verified, shows confirmation page.
  api.get('/consent/verify', async (req, res) => {
    try {
      const token = String(req.query.token || '').trim();
      if (!token) return res.status(400).send(confirmPage(false, 'This verification link is missing its token.'));
      const row = db.prepare('SELECT token, user_id, expires_at, used FROM consent_tokens WHERE token = ?').get(token);
      if (!row || row.used) {
        return res.status(400).send(confirmPage(false, 'This verification link is invalid or has already been used.'));
      }
      if (row.expires_at < Date.now()) {
        return res.status(400).send(confirmPage(false, 'This verification link has expired (links last 48 hours).'));
      }
      db.prepare('UPDATE consent_tokens SET used = 1 WHERE token = ?').run(token);
      db.prepare('UPDATE users SET consent_verified = 1 WHERE id = ?').run(row.user_id);
      try {
        db.prepare(`INSERT INTO parental_consents (user_id, method, verified, verified_at) VALUES (?, 'email_verify', 1, datetime('now'))`)
          .run(row.user_id);
      } catch (e) { /* ledger optional */ }
      res.send(confirmPage(true));
    } catch (e) {
      console.warn('[consent] verify failed:', e.message);
      res.status(500).send(confirmPage(false, 'Something went wrong verifying your email. Please try again.'));
    }
  });

  // GET /api/consent/status — authed; { verified: bool }.
  api.get('/consent/status', requireAuth, (req, res) => {
    res.json({ verified: isConsentVerified(db, req.session.userId) });
  });

  // DELETE /api/kids/:id/data — parent-authed, own kid only. Wipes kid data.
  api.delete('/kids/:id/data', requireAuth, (req, res) => {
    try {
      const kidId = Number(req.params.id);
      if (!Number.isInteger(kidId)) return res.status(400).json({ error: 'Invalid kid id.' });
      const { findKid } = require('./db');
      const kid = findKid(kidId, req.session.userId);
      if (!kid) return res.status(404).json({ error: 'Not found.' });

      const summary = {};
      const wipes = [
        ['quiz_attempts', 'quiz_attempts', 'kid_id'],
        ['xp_events', 'kid_xp_events', 'kid_id'],
        ['badges', 'kid_badges', 'kid_id'],
        ['reactions', 'article_reactions', 'kid_id'],
        ['comments', 'article_comments', 'author_kid_id'],
        ['questions', 'correspondent_questions', 'kid_id'],
        ['chat_messages', 'chat_messages', 'kid_id'],
        ['creations', 'creations', 'kid_id'],
      ];
      for (const [key, table, col] of wipes) {
        try {
          const r = db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(kidId);
          summary[key] = r.changes || 0;
        } catch (e) {
          summary[key] = 0;
        }
      }
      res.json({ ok: true, kid_id: kidId, deleted: summary });
    } catch (e) {
      console.warn('[consent] kid data delete failed:', e.message);
      res.status(500).json({ error: 'Could not delete kid data.' });
    }
  });

  return { isConsentVerified: (uid) => isConsentVerified(db, uid) };
}

module.exports = { registerConsent, isConsentVerified, sendVerificationEmail, ensureSchema };
