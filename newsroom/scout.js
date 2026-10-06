#!/usr/bin/env node
// newsroom/scout.js
//
// Source-registry health check. The registry (newsroom/sources/registry.json)
// promises a scout run ~90 min before each filing: this is that scout.
//
// What it does:
//   - Loads every channel's sources from the registry.
//   - For sources with a URL (type rss/site), issues an HTTP HEAD (falling
//     back to GET) and records reachability + status code.
//   - For search-type sources (query only, no URL), validates the entry has
//     a query string and counts it as "query-only".
//   - Prints a per-channel summary: reachable / unreachable / query-only.
//
// It NEVER fails the run: unreachable sources are logged and skipped, and the
// process always exits 0 so a flaky source can't block the filing pipeline.
//
// Usage:
//   node newsroom/scout.js                  # check all channels
//   node newsroom/scout.js --channel ai      # check one channel
//   node newsroom/scout.js --json           # machine-readable summary

const path = require('path');
const http = require('http');
const https = require('https');

const REGISTRY_PATH = path.join(__dirname, 'sources', 'registry.json');
const TIMEOUT_MS = 10000;
const USER_AGENT = 'SkynetNexus-Scout/1.0 (+https://skynetnexus.com)';

function loadRegistry() {
  const raw = require('fs').readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw);
}

// HEAD first (cheap); fall back to a ranged GET when HEAD is disallowed.
function checkUrl(urlStr) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(urlStr); }
    catch { return resolve({ ok: false, status: 'invalid-url' }); }
    if (!['http:', 'https:'].includes(url.protocol)) {
      return resolve({ ok: false, status: 'non-http' });
    }
    const lib = url.protocol === 'https:' ? https : http;
    const finish = (result) => resolve(result);
    const attempt = (method) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || undefined,
          path: url.pathname + url.search,
          method,
          headers: { 'User-Agent': USER_AGENT, ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}) },
          timeout: TIMEOUT_MS,
        },
        (res) => {
          const code = res.statusCode || 0;
          res.resume(); // discard body
          if (method === 'HEAD' && (code === 405 || code === 501)) {
            return attempt('GET'); // HEAD not allowed — try GET
          }
          finish({ ok: code >= 200 && code < 400, status: code });
        }
      );
      req.on('timeout', () => { req.destroy(); finish({ ok: false, status: 'timeout' }); });
      req.on('error', (e) => finish({ ok: false, status: e.code || e.message }));
      req.end();
    };
    attempt('HEAD');
  });
}

async function scoutChannel(channelKey, channel, opts) {
  const sources = channel.sources || [];
  const results = [];
  for (const s of sources) {
    const label = s.label || s.url || s.query || '(unnamed)';
    if (!s.url) {
      // Search-type entries have no URL to probe — validate the query instead.
      results.push({
        label,
        type: s.type || 'search',
        ok: !!(s.query && s.query.trim()),
        status: s.query && s.query.trim() ? 'query-only' : 'missing-query',
      });
      continue;
    }
    const r = await checkUrl(s.url);
    results.push({ label, type: s.type || 'site', url: s.url, ok: r.ok, status: r.status });
  }
  return { channel: channelKey, results };
}

function summarize(scanned) {
  let reachable = 0, unreachable = 0, queryOnly = 0;
  const problems = [];
  for (const { channel, results } of scanned) {
    for (const r of results) {
      if (r.status === 'query-only') queryOnly++;
      else if (r.ok) reachable++;
      else {
        unreachable++;
        problems.push(`${channel}/${r.label}: ${r.status}`);
      }
    }
  }
  return { reachable, unreachable, queryOnly, problems };
}

(async function main() {
  const args = process.argv.slice(2);
  const onlyChannel = (() => {
    const i = args.indexOf('--channel');
    return i !== -1 ? args[i + 1] : null;
  })();
  const asJson = args.includes('--json');

  let registry;
  try {
    registry = loadRegistry();
  } catch (e) {
    console.error(`[scout] cannot read registry: ${e.message}`);
    process.exit(0); // never fail the pipeline
  }

  const channels = registry.channels || {};
  const keys = Object.keys(channels).filter((k) => !onlyChannel || k === onlyChannel);
  if (onlyChannel && !keys.length) {
    console.error(`[scout] unknown channel: ${onlyChannel}`);
    process.exit(0);
  }

  const scanned = [];
  for (const k of keys) {
    scanned.push(await scoutChannel(k, channels[k]));
  }
  const summary = summarize(scanned);

  if (asJson) {
    console.log(JSON.stringify({ at: new Date().toISOString(), channels: scanned, summary }, null, 2));
  } else {
    console.log(`[scout] ${new Date().toISOString()} — ${keys.length} channel(s)`);
    for (const { channel, results } of scanned) {
      const ok = results.filter((r) => r.ok || r.status === 'query-only').length;
      console.log(`  ${channel}: ${ok}/${results.length} usable`);
      for (const r of results.filter((r) => !r.ok && r.status !== 'query-only')) {
        console.log(`    ✗ ${r.label} (${r.status})`);
      }
    }
    console.log(`[scout] summary: ${summary.reachable} reachable, ${summary.unreachable} unreachable, ${summary.queryOnly} query-only`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(`[scout] unexpected error (non-fatal): ${e.message}`);
  process.exit(0);
});
