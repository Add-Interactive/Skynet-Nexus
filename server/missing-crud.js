// server/missing-crud.js — CRUD endpoints added 2026-10-06 to close review gaps.
// Registered from index.js via require('./missing-crud')(api, { requireAuth, requireTeacher, requireAdmin, rateLimit }).
module.exports = function registerMissingCrud(api, { requireAuth, requireTeacher, requireAdmin, rateLimit }) {

api.patch('/assignments/:id', requireAuth, requireTeacher, (req, res) => {
  const { updateAssignment } = require('./db');
  const out = updateAssignment({
    teacherUserId: req.session.userId,
    id: req.params.id,
    patch: req.body || {},
  });
  if (out.error) return res.status(404).json({ error: out.error });
  res.json(out);
});

// DELETE /api/newsletter — unsubscribe
api.delete('/newsletter', rateLimit({ windowMs: 60_000, max: 10, key: 'newsletter-del' }), (req, res) => {
  const email = String((req.body && req.body.email) || req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const { removeNewsletter } = require('./db');
  const removed = removeNewsletter(email);
  res.json({ ok: true, wasSubscribed: removed });
});

// ---- Public contact form ----
api.post('/contact', rateLimit({ windowMs: 60 * 60_000, max: 5, key: 'contact' }), (req, res) => {
  const { submitContact } = require('./db');
  const out = submitContact({
    name: req.body && req.body.name,
    email: req.body && req.body.email,
    message: req.body && req.body.message,
  });
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json(out);
});
api.get('/contact/messages', requireAdmin, (req, res) => {
  const { listContactMessages } = require('./db');
  res.json(listContactMessages({ limit: req.query.limit }));
});

// GET /api/leaderboard — public, COPPA-safe (no kid names)
api.get('/leaderboard', (req, res) => {
  const { getPublicLeaderboard } = require('./db');
  res.json(getPublicLeaderboard({ limit: req.query.limit }));
});

api.get('/push/subscriptions', requireAuth, (req, res) => {
  const { listPushSubscriptions } = require('./db');
  res.json({ subscriptions: listPushSubscriptions(req.session.userId) });
});

api.delete('/cheers/:id', requireAuth, (req, res) => {
  const { deleteCheer } = require('./db');
  const out = deleteCheer({ userId: req.session.userId, id: req.params.id });
  if (out.error) return res.status(404).json({ error: out.error });
  res.json(out);
});

api.delete('/newsroom/tasks/:id', requireAdmin, (req, res) => {
  const { deleteNewsroomTask } = require('./db');
  const out = deleteNewsroomTask({ id: req.params.id });
  if (out.error) return res.status(404).json({ error: out.error });
  res.json(out);
});

// Admin: reopen a closed poll.
api.post('/newsroom/polls/:id/reopen', requireAdmin, (req, res) => {
  const { reopenPoll } = require('./db');
  const out = reopenPoll({ id: req.params.id });
  if (out.error) return res.status(404).json({ error: out.error });
  res.json(out);
});

// POST /api/admin/social/queue — manually create a social draft (admin)
api.post('/admin/social/queue', requireAdmin, (req, res) => {
  const { createSocialDraft } = require('./db');
  const b = req.body || {};
  const platform = String(b.platform || '');
  if (!['youtube_shorts', 'tiktok', 'instagram_reels'].includes(platform)) {
    return res.status(400).json({ error: 'Valid platform is required (youtube_shorts, tiktok, instagram_reels).' });
  }
  if (!b.hook || !String(b.hook).trim()) return res.status(400).json({ error: 'Hook is required.' });
  if (!b.script || !String(b.script).trim()) return res.status(400).json({ error: 'Script is required.' });
  try {
    const draft = createSocialDraft({
      platform,
      storyId: b.story_id || b.storyId || null,
      storyTitle: b.story_title || b.storyTitle || null,
      hook: String(b.hook).trim(),
      script: String(b.script).trim(),
      caption: b.caption ? String(b.caption) : null,
      hashtags: Array.isArray(b.hashtags) ? b.hashtags : [],
      artPick: b.art_pick || b.artPick || null,
      cta: b.cta ? String(b.cta) : null,
      status: 'draft',
      dropKey: b.drop_key || b.dropKey || null,
      edition: b.edition || null,
    });
    res.status(201).json({ draft });
  } catch (e) {
    res.status(500).json({ error: 'Could not create social draft.' });
  }
});

// GET /api/admin/stories/by-article-id/:articleId — find the published queued story for an article
api.get('/admin/stories/by-article-id/:articleId', requireAdmin, (req, res) => {
  const { findPublishedStoryByArticleId } = require('./db');
  const out = findPublishedStoryByArticleId(req.params.articleId);
  if (!out) return res.status(404).json({ error: 'No published story found for this article.' });
  res.json(out);
});

};
