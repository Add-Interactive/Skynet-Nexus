#!/usr/bin/env node
// newsroom/sync.js
// Commits any new/changed files in data/ and newsroom/log.md and pushes to origin.
// Used at the end of the daily 10 AM cron so today's edition reaches production.
//
// Usage:
//   node sync.js                  # normal: commits + pushes
//   node sync.js --dry-run        # shows what would happen
//   node sync.js --message "..."  # custom commit message
//
// Exit codes:
//   0 = success (either nothing to commit, OR commit+push worked)
//   1 = git command failed
//   2 = not a git repo

const { execSync } = require('child_process');
const path = require('path');

const SKYNET_ROOT = 'C:\\Users\\bekin\\OneDrive\\Desktop\\Skynet';
const DRY = process.argv.includes('--dry-run');
let commitMsg = 'chore(newsroom): daily edition ' + new Date().toISOString().slice(0, 10);
const mIdx = process.argv.indexOf('--message');
if (mIdx !== -1 && process.argv[mIdx + 1]) commitMsg = process.argv[mIdx + 1];

function git(args, opts) {
  const cmd = 'git ' + args;
  try {
    return execSync(cmd, Object.assign({ cwd: SKYNET_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }, opts || {}));
  } catch (err) {
    err.stdout = err.stdout && err.stdout.toString();
    err.stderr = err.stderr && err.stderr.toString();
    throw err;
  }
}

function isGitRepo() {
  try { git('rev-parse --is-inside-work-tree'); return true; }
  catch (e) { return false; }
}

function currentBranch() {
  try { return git('rev-parse --abbrev-ref HEAD').trim(); }
  catch (e) { return null; }
}

function hasRemote(name) {
  try { git('remote get-url ' + name); return true; }
  catch (e) { return false; }
}

function hasStagedOrUnstagedChanges() {
  try {
    const out = git('status --porcelain data/ newsroom/log.md').trim();
    return out.length > 0;
  } catch (e) { return false; }
}

(function main() {
  console.log('[newsroom/sync] starting ' + (DRY ? '(dry-run) ' : '') + 'in ' + SKYNET_ROOT);

  if (!isGitRepo()) {
    console.error('  Not a git repository. Skipping push. Set up git remote first.');
    process.exit(2);
  }

  const branch = currentBranch();
  console.log('  branch: ' + branch);

  if (!hasRemote('origin')) {
    console.error('  No git remote "origin" configured. Skipping push.');
    process.exit(0); // treat as skipped, not fatal
  }

  if (!hasStagedOrUnstagedChanges()) {
    console.log('  No newsroom changes to commit. Nothing to push.');
    process.exit(0);
  }

  if (DRY) {
    console.log('  Would run:');
    console.log('    git add data/ newsroom/log.md');
    console.log('    git commit -m "' + commitMsg + '"');
    console.log('    git push origin ' + branch);
    process.exit(0);
  }

  try {
    console.log('  git add data/ newsroom/log.md');
    git('add data/ newsroom/log.md');
    console.log('  git commit -m "' + commitMsg + '"');
    git('commit -m "' + commitMsg.replace(/"/g, '\\"') + '"');
    console.log('  git push origin ' + branch);
    git('push origin ' + branch);
    console.log('[newsroom/sync] SUCCESS. Live site will redeploy automatically.');
    process.exit(0);
  } catch (err) {
    console.error('[newsroom/sync] FAILED:');
    if (err.stderr) console.error(err.stderr);
    if (err.stdout) console.error(err.stdout);
    process.exit(1);
  }
})();
