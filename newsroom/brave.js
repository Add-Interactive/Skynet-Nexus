#!/usr/bin/env node
// Brave Search helper for the Skynet Nexus newsroom.
// Usage:
//   node brave.js "search query here"
//   node brave.js --json "search query" > results.json
//   node brave.js --news "search query"        (news search)
//   node brave.js --k 20 "search query"        (limit results)
//
// Reads BRAVE_API_KEY from environment, or from .env in workspace root.

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env if present (super minimal parser, no dep)
function loadDotEnv() {
  const candidates = [
    path.join('C:\\Users\\bekin\\.openclaw\\workspace', '.env'),
    path.join(process.cwd(), '.env')
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
}
loadDotEnv();

function braveRequest(endpoint, params) {
  return new Promise((resolve, reject) => {
    const key = process.env.BRAVE_API_KEY;
    if (!key) {
      return reject(new Error('BRAVE_API_KEY not set. Add it to C:\\Users\\bekin\\.openclaw\\workspace\\.env'));
    }
    const qs = Object.entries(params)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');
    const options = {
      hostname: 'api.search.brave.com',
      port: 443,
      path: '/res/v1/' + endpoint + '?' + qs,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': key
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      let stream = res;
      if (res.headers['content-encoding'] === 'gzip') {
        const zlib = require('zlib');
        stream = res.pipe(zlib.createGunzip());
      }
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          return reject(new Error('Brave API ' + res.statusCode + ': ' + body.slice(0, 300)));
        }
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Bad JSON from Brave: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function braveWebSearch(query, opts = {}) {
  return braveRequest('web/search', {
    q: query,
    count: opts.count || 10,
    country: opts.country || 'us',
    safesearch: opts.safesearch || 'strict',  // family-safe default
    freshness: opts.freshness || 'pw',        // past week
    text_decorations: 0
  });
}

async function braveNewsSearch(query, opts = {}) {
  return braveRequest('news/search', {
    q: query,
    count: opts.count || 10,
    country: opts.country || 'us',
    safesearch: opts.safesearch || 'strict',
    freshness: opts.freshness || 'pw'
  });
}

function slimWeb(json) {
  const out = [];
  const items = ((json.web && json.web.results) || []);
  for (const r of items) {
    out.push({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age,
      site: r.profile && r.profile.name
    });
  }
  return out;
}

function slimNews(json) {
  const out = [];
  const items = json.results || [];
  for (const r of items) {
    out.push({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age,
      source: r.meta_url && r.meta_url.hostname
    });
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  let mode = 'web';
  let jsonOut = false;
  let count = 10;
  let freshness = 'pw';
  const q = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--news') mode = 'news';
    else if (a === '--json') jsonOut = true;
    else if (a === '--k') count = parseInt(args[++i], 10) || 10;
    else if (a === '--freshness') freshness = args[++i];
    else q.push(a);
  }
  const query = q.join(' ');
  if (!query) {
    console.error('Usage: node brave.js [--news] [--json] [--k N] [--freshness pd|pw|pm|py] "search query"');
    process.exit(1);
  }
  try {
    const raw = mode === 'news'
      ? await braveNewsSearch(query, { count, freshness })
      : await braveWebSearch(query, { count, freshness });
    const slim = mode === 'news' ? slimNews(raw) : slimWeb(raw);
    if (jsonOut) {
      console.log(JSON.stringify(slim, null, 2));
    } else {
      if (slim.length === 0) {
        console.log('(no results)');
      } else {
        for (const r of slim) {
          console.log('• ' + r.title);
          console.log('  ' + r.url);
          if (r.age) console.log('  age: ' + r.age);
          if (r.description) console.log('  ' + r.description.replace(/\s+/g, ' ').slice(0, 200));
          console.log('');
        }
      }
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = { braveWebSearch, braveNewsSearch, slimWeb, slimNews };
