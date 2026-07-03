// server/publisher.js
// Shared helper to publish an article payload through newsroom/publish.js.
// Used by both the admin "publish" route and the cadence scheduler.

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { DATA_DIR } = require('./storage');

const ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(ROOT, '.tmp');
const PUBLISH_SCRIPT = path.join(ROOT, 'newsroom', 'publish.js');

// Spawn the publish pipeline for a JSON file on disk.
function publishArticleFile(absJsonPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PUBLISH_SCRIPT, '--file', absJsonPath], {
      cwd: ROOT,
      windowsHide: true,
      env: Object.assign({}, process.env, { SKYNET_DATA_DIR: DATA_DIR })
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', c => { stdout += c.toString(); });
    child.stderr.on('data', c => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

// Publish a payload object: writes a temp file, runs the pipeline, returns
// { code, articleId, stdout, stderr }. Cleans up the temp file afterward.
async function publishPayload(payload, tag = 'sched') {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const tmpFile = path.join(TMP_DIR, `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
  try {
    const result = await publishArticleFile(tmpFile);
    let articleId = null;
    const m = /article:\s+([a-z0-9-]+)/i.exec(result.stdout || '');
    if (m) articleId = m[1];
    if (!articleId && payload.id) articleId = payload.id;
    return { ...result, articleId };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

module.exports = { publishArticleFile, publishPayload };
