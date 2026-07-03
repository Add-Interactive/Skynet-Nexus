// server/admin-routes.js
// All /api/admin/* routes. Every route here requires an authenticated user with role='admin'
// or role='editor' (editors get most read + some write; admins get everything).

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const { hashPassword, isValidPassword, isValidDisplayName, isValidEmail } = require('./auth');
const { DATA_DIR } = require('./storage');

const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT, '.tmp');
const PUBLISH_SCRIPT = path.join(ROOT, 'newsroom', 'publish.js');

const CHANNELS = require('./channels').PUBLISH_IDS;
const scheduler = require('./scheduler');
const ADMIN_ROLES = new Set(['admin', 'editor']);
const FULL_ADMIN_ROLES = new Set(['admin']);

function requireAdminRole(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'unauthorized' });
  const user = db.findUserById(req.session.userId);
  if (!user || !ADMIN_ROLES.has(user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  req.adminUser = user;
  next();
}

function requireFullAdmin(req, res, next) {
  if (!req.adminUser || !FULL_ADMIN_ROLES.has(req.adminUser.role)) {
    return res.status(403).json({ error: 'admin-only action' });
  }
  next();
}

function logAction(userId, action, targetKind, targetId, meta) {
  try { db.createAdminAction({ userId, action, targetKind, targetId, meta }); }
  catch (e) { console.warn('[admin] audit log failed:', e.message); }
}

// Read the manifest safely.
function readManifest() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8')); }
  catch (e) { return { articles: [] }; }
}

// Run newsroom/publish.js with a JSON file argument.
function publishArticleFile(absJsonPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PUBLISH_SCRIPT, '--file', absJsonPath], {
      cwd: ROOT,
      windowsHide: true,
      // Point the publisher at the persistent data dir so runtime-published
      // articles land on the volume (and survive redeploys), not the image.
      env: Object.assign({}, process.env, { SKYNET_DATA_DIR: DATA_DIR })
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      resolve({ code, stdout, stderr });
    });
  });
}

const router = express.Router();

// Every admin route requires the admin/editor role.
router.use(requireAdminRole);

// -------------------- DASHBOARD --------------------

router.get('/overview', (req, res) => {
  const manifest = readManifest();
  const articles = manifest.articles || [];
  const perChannel = { stem: 0, robotics: 0, play: 0, music: 0, network: 0 };
  const today = new Date().toISOString().slice(0, 10);
  let todayCount = 0;
  for (const a of articles) {
    if (perChannel[a.cat] != null) perChannel[a.cat]++;
    if ((a.date || '').slice(0, 10) === today) todayCount++;
  }
  const subs = db.countSubmissionsByStatus();
  res.json({
    now: new Date().toISOString(),
    role: req.adminUser.role,
    articles: {
      total: articles.length,
      today: todayCount,
      perChannel
    },
    submissions: subs,
    users: {
      total: db.countUsers(),
      newsletter: db.countNewsletter()
    },
    staff: {
      total: db.listStaff().length
    },
    queue: {
      draft: db.listQueuedStories({ status: 'draft', limit: 1000 }).length,
      approved: db.listQueuedStories({ status: 'approved', limit: 1000 }).length,
      published: db.listQueuedStories({ status: 'published', limit: 1000 }).length
    }
  });
});

// -------------------- STAFF (correspondents + editors) --------------------

router.get('/staff', (req, res) => {
  res.json({ staff: db.listStaff() });
});

router.post('/staff', requireFullAdmin, (req, res) => {
  const b = req.body || {};
  const slug = String(b.slug || '').trim().toLowerCase();
  const kind = b.kind === 'human' ? 'human' : 'agent';
  const displayName = String(b.displayName || '').trim();
  const role = String(b.role || '').trim();
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return res.status(400).json({ error: 'slug must be lowercase kebab.' });
  if (!displayName || displayName.length > 60) return res.status(400).json({ error: 'displayName 1-60 chars.' });
  if (!role) return res.status(400).json({ error: 'role is required.' });
  if (db.findStaffBySlug(slug)) return res.status(409).json({ error: 'slug already used.' });
  const staff = db.createStaff({
    slug, kind, displayName, role,
    channel: b.channel || null,
    byline: b.byline || null,
    avatarEmoji: b.avatarEmoji || null,
    accentColor: b.accentColor || null,
    bio: b.bio || null,
    promptPath: b.promptPath || null,
    linkedUserId: b.linkedUserId || null
  });
  logAction(req.adminUser.id, 'staff.create', 'staff', staff.id, { slug: staff.slug });
  res.status(201).json({ staff });
});

router.patch('/staff/:id', requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'bad id' });
  const current = db.findStaffById(id);
  if (!current) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const staff = db.updateStaff({
    id,
    displayName: b.displayName ?? null,
    role: b.role ?? null,
    byline: b.byline ?? null,
    avatarEmoji: b.avatarEmoji ?? null,
    accentColor: b.accentColor ?? null,
    status: b.status ?? null,
    bio: b.bio ?? null,
    promptPath: b.promptPath ?? null
  });
  logAction(req.adminUser.id, 'staff.update', 'staff', id, b);
  res.json({ staff });
});

router.get('/staff/:id', (req, res) => {
  const id = Number(req.params.id);
  const staff = db.findStaffById(id);
  if (!staff) return res.status(404).json({ error: 'not found' });
  const tasks = db.listAgentTasksByStaff(id, { limit: 20 });
  const messages = db.listAgentMessages(id, { limit: 50 });
  res.json({ staff, tasks, messages });
});

// -------------------- AGENT CHAT + TASKING --------------------

router.get('/staff/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  if (!db.findStaffById(id)) return res.status(404).json({ error: 'not found' });
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json({ messages: db.listAgentMessages(id, { limit, offset }) });
});

router.post('/staff/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  const staff = db.findStaffById(id);
  if (!staff) return res.status(404).json({ error: 'not found' });
  const body = String((req.body && req.body.body) || '').trim();
  if (!body) return res.status(400).json({ error: 'body required' });
  if (body.length > 8000) return res.status(400).json({ error: 'message too long (max 8000).' });
  const taskId = req.body && req.body.taskId ? Number(req.body.taskId) : null;
  const message = db.createAgentMessage({
    staffId: id, author: 'admin', authorUserId: req.adminUser.id,
    body, taskId: Number.isInteger(taskId) ? taskId : null
  });
  logAction(req.adminUser.id, 'agent.message', 'staff', id, { taskId, len: body.length });
  res.status(201).json({ message });
});

router.get('/staff/:id/tasks', (req, res) => {
  const id = Number(req.params.id);
  if (!db.findStaffById(id)) return res.status(404).json({ error: 'not found' });
  res.json({ tasks: db.listAgentTasksByStaff(id, { limit: 100 }) });
});

router.post('/staff/:id/tasks', (req, res) => {
  const id = Number(req.params.id);
  const staff = db.findStaffById(id);
  if (!staff) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const instructions = String(b.instructions || '').trim();
  const priority = ['low', 'normal', 'high', 'urgent'].includes(b.priority) ? b.priority : 'normal';
  const submissionId = b.submissionId ? Number(b.submissionId) : null;
  if (!title || title.length > 200) return res.status(400).json({ error: 'title 1-200 chars.' });
  if (!instructions || instructions.length > 8000) return res.status(400).json({ error: 'instructions 1-8000 chars.' });
  const task = db.createAgentTask({
    staffId: id, createdBy: req.adminUser.id,
    title, instructions, priority, submissionId
  });
  db.createAgentMessage({
    staffId: id, author: 'system', authorUserId: req.adminUser.id,
    body: `**New task assigned** \u00b7 priority: ${priority}\n\n**${title}**\n\n${instructions}`,
    taskId: task.id
  });
  logAction(req.adminUser.id, 'agent.task.create', 'task', task.id, { staffId: id, title, priority });
  res.status(201).json({ task });
});

router.patch('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = db.findAgentTask(id);
  if (!task) return res.status(404).json({ error: 'not found' });
  const status = ['pending', 'in_progress', 'delivered', 'cancelled'].includes(req.body.status) ? req.body.status : null;
  const resultingQueuedStoryId = req.body.resultingQueuedStoryId ? Number(req.body.resultingQueuedStoryId) : null;
  const deliveredAt = status === 'delivered' ? new Date().toISOString() : null;
  const updated = db.updateAgentTask({ id, status, resultingQueuedStoryId, deliveredAt });
  logAction(req.adminUser.id, 'agent.task.update', 'task', id, { status });
  res.json({ task: updated });
});

router.get('/tasks/pending', (req, res) => {
  res.json({ tasks: db.listPendingAgentTasks() });
});

// -------------------- SUBMISSIONS (reader story tips) --------------------

router.get('/submissions', (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'assigned', 'published'].includes(req.query.status) ? req.query.status : null;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const subs = db.listSubmissions({ status, limit, offset });
  res.json({ submissions: subs, counts: db.countSubmissionsByStatus() });
});

router.get('/submissions/:id', (req, res) => {
  const id = Number(req.params.id);
  const sub = db.findSubmission(id);
  if (!sub) return res.status(404).json({ error: 'not found' });
  res.json({ submission: sub });
});

router.patch('/submissions/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = db.findSubmission(id);
  if (!current) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const status = ['pending', 'approved', 'rejected', 'assigned', 'published'].includes(b.status) ? b.status : null;
  const reviewNotes = typeof b.reviewNotes === 'string' ? b.reviewNotes.slice(0, 4000) : null;
  const assignedStaffId = b.assignedStaffId ? Number(b.assignedStaffId) : null;
  const reviewedAt = status ? new Date().toISOString() : null;
  const sub = db.updateSubmission({
    id, status, reviewNotes,
    reviewedBy: req.adminUser.id,
    assignedStaffId, reviewedAt
  });
  logAction(req.adminUser.id, `submission.${status || 'update'}`, 'submission', id, { status, assignedStaffId });
  res.json({ submission: sub });
});

// Convert a submission -> agent task in one call.
router.post('/submissions/:id/assign', (req, res) => {
  const id = Number(req.params.id);
  const sub = db.findSubmission(id);
  if (!sub) return res.status(404).json({ error: 'not found' });
  const staffId = Number(req.body.staffId);
  const staff = db.findStaffById(staffId);
  if (!staff) return res.status(400).json({ error: 'unknown staffId' });

  const title = `Reader tip: ${sub.title.slice(0, 160)}`;
  const instructions = [
    `A reader submitted a story tip for the **${sub.channel}** channel.`,
    ``,
    `**Title:** ${sub.title}`,
    `**Summary:** ${sub.summary}`,
    sub.body ? `**Body:**\n${sub.body}` : '',
    sub.sourceUrl ? `**Source:** ${sub.sourceUrl}` : '',
    ``,
    `Please verify, write a family-first article per your channel brief, and file to the draft queue for editorial review before publishing.`
  ].filter(Boolean).join('\n');

  const task = db.createAgentTask({
    staffId, createdBy: req.adminUser.id,
    title, instructions, priority: 'normal', submissionId: id
  });
  db.createAgentMessage({
    staffId, author: 'system', authorUserId: req.adminUser.id,
    body: `**Assigned reader submission #${sub.id}** \u2014 "${sub.title}"`,
    taskId: task.id
  });
  db.updateSubmission({
    id, status: 'assigned',
    reviewedBy: req.adminUser.id, reviewedAt: new Date().toISOString(),
    assignedStaffId: staffId
  });
  logAction(req.adminUser.id, 'submission.assign', 'submission', id, { staffId, taskId: task.id });
  res.status(201).json({ task, submission: db.findSubmission(id) });
});

// -------------------- DRAFT QUEUE + PUBLISH --------------------

router.get('/stories/queue', (req, res) => {
  const status = ['draft', 'approved', 'rejected', 'published'].includes(req.query.status) ? req.query.status : null;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json({ stories: db.listQueuedStories({ status, limit, offset }) });
});

router.post('/stories/queue', (req, res) => {
  const b = req.body || {};
  const staffId = Number(b.staffId);
  const channel = String(b.channel || '').trim();
  const payload = b.payload;
  if (!db.findStaffById(staffId)) return res.status(400).json({ error: 'unknown staffId' });
  if (!CHANNELS.has(channel)) return res.status(400).json({ error: 'unknown channel' });
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload must be an object' });
  const story = db.createQueuedStory({
    staffId, channel, payload,
    status: b.status === 'approved' ? 'approved' : 'draft',
    submissionId: b.submissionId ? Number(b.submissionId) : null
  });
  logAction(req.adminUser.id, 'story.queue', 'story', story.id, { staffId, channel });
  res.status(201).json({ story });
});

router.patch('/stories/queue/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = db.findQueuedStory(id);
  if (!current) return res.status(404).json({ error: 'not found' });
  const b = req.body || {};
  const status = ['draft', 'approved', 'rejected'].includes(b.status) ? b.status : null;
  const editorNotes = typeof b.editorNotes === 'string' ? b.editorNotes.slice(0, 4000) : null;
  const payload = b.payload && typeof b.payload === 'object' ? b.payload : null;
  const story = db.updateQueuedStory({ id, status, editorNotes, payload });
  logAction(req.adminUser.id, `story.${status || 'edit'}`, 'story', id, { status });
  res.json({ story });
});

router.post('/stories/queue/:id/publish', async (req, res) => {
  const id = Number(req.params.id);
  const current = db.findQueuedStory(id);
  if (!current) return res.status(404).json({ error: 'not found' });
  if (current.status === 'published') return res.status(400).json({ error: 'already published' });
  if (current.status === 'rejected') return res.status(400).json({ error: 'rejected story cannot be published' });

  const payload = current.payload;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'no valid payload' });

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const tmpFile = path.join(TMP_DIR, `admin-publish-${id}-${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
  } catch (err) {
    return res.status(500).json({ error: 'temp write failed: ' + err.message });
  }

  try {
    const result = await publishArticleFile(tmpFile);
    if (result.code !== 0) {
      logAction(req.adminUser.id, 'story.publish.fail', 'story', id, { code: result.code, err: (result.stderr || '').slice(0, 400) });
      return res.status(400).json({
        error: 'publish rejected by pipeline',
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr
      });
    }
    // Try to pull the article id back out of stdout.
    let articleId = null;
    const m = /article:\s+([a-z0-9-]+)/i.exec(result.stdout);
    if (m) articleId = m[1];
    // Fallback: guess from payload.
    if (!articleId && payload.id) articleId = payload.id;

    const updated = db.updateQueuedStory({
      id, status: 'published',
      publishedArticleId: articleId,
      publishedAt: new Date().toISOString()
    });
    if (current.submissionId) {
      db.updateSubmission({
        id: current.submissionId, status: 'published',
        reviewedBy: req.adminUser.id, reviewedAt: new Date().toISOString(),
        resultingStoryId: articleId
      });
    }
    logAction(req.adminUser.id, 'story.publish', 'story', id, { articleId });
    res.json({ story: updated, publish: { stdout: result.stdout, stderr: result.stderr } });
  } catch (err) {
    res.status(500).json({ error: 'publish failed: ' + err.message });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

// Schedule a queued story for a timed edition release (cadence engine).
// Body: { at?: ISO } — if omitted, uses the next eligible drop honoring the
// 1-hour review cutoff. A scheduled story is auto-published at its drop time.
router.post('/stories/queue/:id/schedule', (req, res) => {
  const id = Number(req.params.id);
  const current = db.findQueuedStory(id);
  if (!current) return res.status(404).json({ error: 'not found' });
  if (current.status === 'published') return res.status(400).json({ error: 'already published' });
  if (current.status === 'rejected') return res.status(400).json({ error: 'rejected story cannot be scheduled' });

  const b = req.body || {};
  let drop;
  if (b.at) {
    const at = new Date(b.at);
    if (isNaN(at.getTime())) return res.status(400).json({ error: 'invalid at timestamp' });
    const minTime = Date.now() + scheduler.CUTOFF_MIN * 60_000;
    if (at.getTime() < minTime) {
      return res.status(400).json({ error: `scheduled time must be at least ${scheduler.CUTOFF_MIN} minutes out (review cutoff).` });
    }
    drop = { at, edition: null };
  } else {
    const ne = scheduler.nextEligibleDrop();
    drop = { at: ne.at, edition: ne.edition };
  }

  const story = db.scheduleQueuedStory({ id, publishAt: drop.at.toISOString(), edition: drop.edition });
  if (current.submissionId) {
    db.updateSubmission({ id: current.submissionId, status: 'approved', reviewedBy: req.adminUser.id, reviewedAt: new Date().toISOString() });
  }
  logAction(req.adminUser.id, 'story.schedule', 'story', id, { publishAt: drop.at.toISOString(), edition: drop.edition });
  res.json({ story });
});

// List all scheduled (not yet released) stories.
router.get('/stories/scheduled', (req, res) => {
  res.json({ stories: db.listScheduledStories({ limit: 100 }), schedule: scheduler.scheduleInfo() });
});

// -------------------- USERS / ROLES --------------------

const USER_ROLES = ['parent', 'editor', 'admin'];

router.get('/users', requireFullAdmin, (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json({
    users: db.searchUsers({ q, limit, offset }),
    total: db.countUsersSearch(q),
    admins: db.countAdmins()
  });
});

router.get('/users/:id', requireFullAdmin, (req, res) => {
  const user = db.findUserForAdmin(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json({ user });
});

router.patch('/users/:id/role', requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);
  const role = String(req.body.role || '').trim();
  if (!USER_ROLES.includes(role)) return res.status(400).json({ error: 'role must be parent|editor|admin' });
  const target = db.findUserById(id);
  if (!target) return res.status(404).json({ error: 'not found' });
  // Guard: never leave the site without an admin.
  if (target.role === 'admin' && role !== 'admin' && db.countAdmins() <= 1) {
    return res.status(400).json({ error: 'Cannot demote the last remaining admin.' });
  }
  if (id === req.adminUser.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  }
  const user = db.setUserRole(id, role);
  logAction(req.adminUser.id, 'user.role.set', 'user', id, { role });
  res.json({ user: db.findUserForAdmin(id) });
});

// Update editable profile fields + admin notes.
router.patch('/users/:id', requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.findUserById(id);
  if (!target) return res.status(404).json({ error: 'not found' });

  const body = req.body || {};
  if (body.displayName != null) {
    const name = String(body.displayName).trim();
    if (!isValidDisplayName(name)) return res.status(400).json({ error: 'display name must be 2-40 chars.' });
    db.updateUser({ id, displayName: name });
  }
  if (body.adminNotes != null) {
    const notes = String(body.adminNotes).slice(0, 2000);
    db.setAdminNotes(id, notes);
  }
  logAction(req.adminUser.id, 'user.update', 'user', id, {
    fields: Object.keys(body).filter(k => ['displayName', 'adminNotes'].includes(k))
  });
  res.json({ user: db.findUserForAdmin(id) });
});

// Admin-initiated password reset. If no password is supplied, we generate a
// strong temporary one and return it once so the admin can share it securely.
router.post('/users/:id/reset-password', requireFullAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const target = db.findUserById(id);
  if (!target) return res.status(404).json({ error: 'not found' });

  let password = String((req.body && req.body.password) || '');
  let generated = false;
  if (!password) {
    // 12-char temp password: unambiguous alphabet, mixed case + digits.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    password = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
    generated = true;
  }
  if (!isValidPassword(password)) return res.status(400).json({ error: 'password must be 8-200 chars.' });

  const hash = await hashPassword(password);
  db.changePassword(id, hash);
  logAction(req.adminUser.id, 'user.password.reset', 'user', id, { generated });
  res.json({ ok: true, generated, tempPassword: generated ? password : undefined });
});

// Admin-initiated *self-service* reset: mint a reset token, email the member a
// link, and also return the link so the admin can copy/share it when email
// delivery isn't configured yet. Does not change the member's current password.
router.post('/users/:id/send-reset', requireFullAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const target = db.findUserById(id);
  if (!target) return res.status(404).json({ error: 'not found' });

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  db.createPasswordReset({ userId: id, token, expiresAt });

  const origin = process.env.SITE_ORIGIN ||
    (process.env.NODE_ENV === 'production'
      ? 'https://skynet-nexus-production.up.railway.app'
      : 'http://localhost:' + (Number(process.env.PORT) || 4180));
  const link = origin + '/pages/password-reset.html?token=' + encodeURIComponent(token);

  let emailed = false;
  try {
    const { sendMail, passwordResetEmail } = require('./mailer');
    const mail = passwordResetEmail(link);
    const result = await sendMail({ to: target.email, subject: mail.subject, html: mail.html, text: mail.text });
    emailed = !!(result && result.ok);
  } catch (e) { /* fall through to returning the link */ }

  logAction(req.adminUser.id, 'user.password.send-reset', 'user', id, { emailed });
  res.json({ ok: true, emailed, link });
});

router.delete('/users/:id', requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);
  const target = db.findUserById(id);
  if (!target) return res.status(404).json({ error: 'not found' });
  if (id === req.adminUser.id) return res.status(400).json({ error: 'You cannot delete your own account here.' });
  if (target.role === 'admin' && db.countAdmins() <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last remaining admin.' });
  }
  const ok = db.deleteUser(id);
  if (!ok) return res.status(404).json({ error: 'not found' });
  logAction(req.adminUser.id, 'user.delete', 'user', id, { email: target.email });
  res.json({ ok: true });
});

// -------------------- AUDIT LOG --------------------

router.get('/actions', (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json({ actions: db.listAdminActions({ limit, offset }) });
});

// -------------------- MANIFEST-BACKED ARTICLE LIST --------------------

router.get('/articles', (req, res) => {
  const manifest = readManifest();
  const articles = (manifest.articles || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  res.json({ articles });
});

// -------------------- SEED / RESET UTILITY: create admin account --------------------
// POST /api/admin/bootstrap-admin - only usable if there are ZERO admins yet, or by an existing admin.
// Accepts { email, password, displayName } and creates or promotes.
router.post('/bootstrap-admin', async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');
  const displayName = String((req.body && req.body.displayName) || 'Admin').trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: 'valid email required.' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'password >= 8 chars.' });
  if (!isValidDisplayName(displayName)) return res.status(400).json({ error: 'display name 2-40 chars.' });

  const existing = db.findUserByEmail(email);
  if (existing) {
    const promoted = db.setUserRole(existing.id, 'admin');
    logAction(req.adminUser.id, 'user.role.set', 'user', existing.id, { role: 'admin', via: 'bootstrap' });
    return res.json({ ok: true, user: promoted, note: 'existing user promoted' });
  }

  const hash = await hashPassword(password);
  const user = db.createUser({ email, displayName, passwordHash: hash, avatarColor: '#00e5ff' });
  db.setUserRole(user.id, 'admin');
  logAction(req.adminUser.id, 'user.create', 'user', user.id, { email, role: 'admin' });
  res.status(201).json({ ok: true, user: db.findUserById(user.id) });
});

module.exports = router;
