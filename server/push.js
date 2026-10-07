// server/push.js
// Web Push: edition drop alerts ("Evening Edition is live") and
// NEXUS SHIELD critical security alerts (opt-in, admins/editors only).
// Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT in env.
// If keys are missing, push is disabled and all senders no-op.

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
    console.warn('[push] VAPID keys not set — push alerts disabled (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT)');
  }
} catch (e) {
  console.warn('[push] web-push module not available:', e.message);
}

function isEnabled() { return enabled; }
function publicKey() { return process.env.VAPID_PUBLIC_KEY || null; }

// Generic sender. subs: [{endpoint, p256dh, auth}]. Prunes dead (404/410)
// subscriptions so we don't retry them forever.
async function sendToSubscriptions(subs, payload) {
  if (!enabled) return { sent: 0, failed: 0, skipped: 'disabled' };
  if (!subs || !subs.length) return { sent: 0, failed: 0, skipped: 'no-subscribers' };
  const db = require('./db');
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let sent = 0, failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body, { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      failed++;
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        try { db.removePushSubscriptionByEndpoint(s.endpoint); } catch (err) {}
      }
    }
  }
  return { sent, failed };
}

async function sendEditionAlert({ edition, count, date }) {
  const db = require('./db');
  const subs = db.listPushSubscriptions();
  const label = edition.charAt(0).toUpperCase() + edition.slice(1);
  const result = await sendToSubscriptions(subs, {
    title: `🛰️ ${label} Edition is live`,
    body: count === 1
      ? `1 new story in the ${label} Edition — tap to read.`
      : `${count} new stories in the ${label} Edition — tap to read.`,
    url: '/',
    tag: `edition-${date}-${edition}`,
  });
  console.log(`[push] edition alert (${edition}): sent=${result.sent} failed=${result.failed}`);
  return result;
}

module.exports = { isEnabled, publicKey, sendToSubscriptions, sendEditionAlert };
