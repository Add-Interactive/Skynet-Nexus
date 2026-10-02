// server/push.js
// Web Push for edition drop alerts ("Evening Edition is live").
// Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT in env.
// If keys are missing, push is disabled and sendEditionAlert() no-ops.

let webpush = null;
let enabled = false;

try {
  webpush = require('web-push');
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT || 'mailto:hello@skynetnexus.com';
  if (pub && priv) {
    webpush.setVapidDetails(contact, pub, priv);
    enabled = true;
    console.log('[push] web push enabled');
  } else {
    console.warn('[push] VAPID keys not set — edition drop alerts disabled (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT)');
  }
} catch (e) {
  console.warn('[push] web-push module not available:', e.message);
}

function isEnabled() { return enabled; }
function publicKey() { return process.env.VAPID_PUBLIC_KEY || null; }

async function sendEditionAlert({ edition, count, date }) {
  if (!enabled) return { sent: 0, skipped: 'disabled' };
  const db = require('./db');
  const subs = db.listPushSubscriptions();
  if (!subs.length) return { sent: 0, skipped: 'no-subscribers' };
  const label = edition.charAt(0).toUpperCase() + edition.slice(1);
  const payload = JSON.stringify({
    title: `🛰️ ${label} Edition is live`,
    body: count === 1
      ? `1 new story in the ${label} Edition — tap to read.`
      : `${count} new stories in the ${label} Edition — tap to read.`,
    url: '/',
    tag: `edition-${date}-${edition}`,
  });
  let sent = 0, failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload, { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      failed++;
      // 404/410 = subscription gone; prune it so we don't retry forever.
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        try { db.removePushSubscriptionByEndpoint(s.endpoint); } catch {}
      }
    }
  }
  console.log(`[push] edition alert (${edition}): sent=${sent} failed=${failed}`);
  return { sent, failed };
}

module.exports = { isEnabled, publicKey, sendEditionAlert };
