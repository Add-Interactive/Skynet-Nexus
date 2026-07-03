'use strict';

/**
 * server/rss.js — dependency-free RSS 2.0 + Atom aggregator.
 *
 * - Only fetches URLs present in the curated registry (SSRF-safe).
 * - Kid-safe term filtering mirrors the newsroom publish pipeline.
 * - In-memory cache with TTL; per-feed fetch timeout; graceful failure.
 */

const fs = require('fs');
const path = require('path');

const FEEDS_PATH = path.join(__dirname, '..', 'public', 'assets', 'data', 'rss-feeds.json');

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const FETCH_TIMEOUT_MS = 6000;
const MAX_ITEMS_PER_FEED = 12;
const MAX_ITEMS_DEFAULT = 40;

// Kid-safe guardrails (mirrors newsroom/publish.js).
const FLAGGED = ['killed', 'murder', 'suicide', 'terrorist', 'assault', 'rape', 'overdose', 'nazi', 'slavery', 'gun ', 'shooting', 'weapon', 'combat'];

let REGISTRY = { feeds: [] };
function loadRegistry() {
  try {
    REGISTRY = JSON.parse(fs.readFileSync(FEEDS_PATH, 'utf8'));
    if (!Array.isArray(REGISTRY.feeds)) REGISTRY.feeds = [];
  } catch (e) {
    REGISTRY = { feeds: [] };
  }
}
loadRegistry();

function feedById(id) {
  return REGISTRY.feeds.find(f => f.id === id) || null;
}
function feedsForChannel(channel) {
  if (channel === 'all' || channel === 'network') return REGISTRY.feeds.slice();
  return REGISTRY.feeds.filter(f => f.channel === channel);
}

// ---- tiny XML helpers --------------------------------------------------

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(+d); } catch { return m; } })
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return m; } })
    .replace(/&amp;/g, '&');
}
function stripCdata(s) {
  return String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}
function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function firstTag(block, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i');
  const m = re.exec(block);
  return m ? m[1] : '';
}
function text(block, name) {
  return decodeEntities(stripTags(stripCdata(firstTag(block, name)))).trim();
}

function extractLink(block) {
  // RSS <link>url</link>
  const rss = firstTag(block, 'link');
  if (rss && !/[<]/.test(rss)) {
    const v = decodeEntities(stripCdata(rss)).trim();
    if (/^https?:\/\//i.test(v)) return v;
  }
  // Atom <link href="..." rel="alternate"/> (prefer alternate/no-rel)
  const links = block.match(/<link\b[^>]*>/gi) || [];
  let alt = '';
  for (const l of links) {
    const href = /href=["']([^"']+)["']/i.exec(l);
    if (!href) continue;
    const rel = /rel=["']([^"']+)["']/i.exec(l);
    if (!rel || /alternate/i.test(rel[1])) return decodeEntities(href[1]);
    if (!alt) alt = decodeEntities(href[1]);
  }
  return alt;
}

function extractImage(block) {
  let m = /<media:content\b[^>]*url=["']([^"']+)["']/i.exec(block)
       || /<media:thumbnail\b[^>]*url=["']([^"']+)["']/i.exec(block)
       || /<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image/i.exec(block)
       || /<enclosure\b[^>]*type=["']image[^>]*url=["']([^"']+)["']/i.exec(block);
  if (m) return decodeEntities(m[1]);
  // first <img> inside description/content
  const body = firstTag(block, 'content:encoded') || firstTag(block, 'description') || firstTag(block, 'summary') || firstTag(block, 'content');
  const img = /<img\b[^>]*src=["']([^"']+)["']/i.exec(stripCdata(body));
  if (img && /^https?:\/\//i.test(img[1])) return decodeEntities(img[1]);
  return null;
}

function isKidSafe(title, summary) {
  const hay = (title + ' ' + summary).toLowerCase();
  return !FLAGGED.some(w => hay.includes(w));
}

function parseFeed(xml, feed) {
  const items = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const block of blocks) {
    const title = text(block, 'title');
    const link = extractLink(block);
    if (!title || !link) continue;

    let summary = text(block, 'description') || text(block, 'summary') || text(block, 'content:encoded') || text(block, 'content');
    if (summary.length > 260) summary = summary.slice(0, 257).trim() + '…';

    if (!isKidSafe(title, summary)) continue;

    const rawDate = firstTag(block, 'pubDate') || firstTag(block, 'updated') || firstTag(block, 'published') || firstTag(block, 'dc:date');
    let publishedAt = null;
    if (rawDate) {
      const d = new Date(decodeEntities(stripCdata(rawDate)).trim());
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    items.push({
      title,
      link,
      summary,
      image: extractImage(block),
      publishedAt,
      feedId: feed.id,
      source: feed.name,
      site: feed.site,
      channel: feed.channel
    });
    if (items.length >= MAX_ITEMS_PER_FEED) break;
  }
  return items;
}

// ---- fetching + cache --------------------------------------------------

const cache = new Map(); // url -> { items, at }

async function fetchFeed(feed) {
  const cached = cache.get(feed.url);
  if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) return cached.items;

  // Resolve site-relative feeds (e.g. our own "/rss.xml") against the origin.
  let target = feed.url;
  if (!/^https?:\/\//i.test(target)) {
    const origin = process.env.SITE_ORIGIN
      || (process.env.NODE_ENV === 'production'
        ? 'https://skynet-nexus-production.up.railway.app'
        : 'http://localhost:' + (Number(process.env.PORT) || 4180));
    target = origin.replace(/\/$/, '') + (target.startsWith('/') ? target : '/' + target);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'SkynetNexusNews/1.0 (+https://skynet-nexus.news; feed aggregator)',
        'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const xml = await res.text();
    const items = parseFeed(xml, feed);
    cache.set(feed.url, { items, at: Date.now() });
    return items;
  } catch (e) {
    // Serve stale on failure if we have it.
    if (cached) return cached.items;
    cache.set(feed.url, { items: [], at: Date.now() });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function mergeSortDedupe(lists, limit) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const it of list) {
      const key = (it.link || '').split('#')[0].split('?')[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(it);
    }
  }
  merged.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });
  return merged.slice(0, limit || MAX_ITEMS_DEFAULT);
}

/** Aggregate all feeds (or only default feeds) for a channel. */
async function aggregateChannel(channel, { onlyDefault = false, limit } = {}) {
  let feeds = feedsForChannel(channel);
  if (onlyDefault && feeds.some(f => f.default)) feeds = feeds.filter(f => f.default);
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const lists = results.map(r => (r.status === 'fulfilled' ? r.value : []));
  return {
    channel,
    sources: feeds.map(f => ({ id: f.id, name: f.name, site: f.site })),
    items: mergeSortDedupe(lists, limit)
  };
}

/** Aggregate an explicit set of feed ids (validated against the registry). */
async function aggregateFeeds(ids, { limit } = {}) {
  const feeds = ids.map(feedById).filter(Boolean);
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const lists = results.map(r => (r.status === 'fulfilled' ? r.value : []));
  return {
    sources: feeds.map(f => ({ id: f.id, name: f.name, site: f.site })),
    items: mergeSortDedupe(lists, limit)
  };
}

function getRegistry(channel) {
  const feeds = channel ? feedsForChannel(channel) : REGISTRY.feeds;
  return {
    updated: REGISTRY.updated || null,
    feeds: feeds.map(f => ({
      id: f.id, channel: f.channel, name: f.name, site: f.site,
      default: !!f.default, description: f.description || ''
    }))
  };
}

module.exports = { loadRegistry, aggregateChannel, aggregateFeeds, getRegistry, feedById };
