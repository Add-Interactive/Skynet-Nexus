#!/usr/bin/env node
/**
 * bootstrap-env.js
 * Creates .env from .env.example (if present) and fills in a fresh
 * SESSION_SECRET. Called by start.bat on first run.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

if (fs.existsSync(envPath)) {
  console.log('  .env already exists; leaving it alone.');
  process.exit(0);
}

const secret = crypto.randomBytes(32).toString('hex');

let content;
if (fs.existsSync(examplePath)) {
  content = fs.readFileSync(examplePath, 'utf8');
  // Replace whatever the example line sets to a real random secret.
  if (/^SESSION_SECRET=/m.test(content)) {
    content = content.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);
  } else {
    content += `\nSESSION_SECRET=${secret}\n`;
  }
} else {
  content = [
    '# Skynet Nexus env (auto-generated)',
    'PORT=4180',
    `SESSION_SECRET=${secret}`,
    '',
  ].join('\n');
}

fs.writeFileSync(envPath, content, { encoding: 'utf8' });
console.log('  wrote', envPath);
console.log('  SESSION_SECRET set (' + secret.length + ' chars).');
