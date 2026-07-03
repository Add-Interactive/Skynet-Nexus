// newsroom/image-scraper.js
// Extract images from source URLs for use in articles.
// Uses headless DOM inspection to find the most relevant image per source.

const https = require('https');
const http = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Fetch a URL and return body as string. Follows redirects.
function fetchUrl(urlStr, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(new Error('Invalid URL'));
    }

    const protocol = url.protocol === 'https:' ? https : http;
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Timeout'));
    }, TIMEOUT_MS);

    const req = protocol.get(
      {
        hostname: url.hostname,
        pathname: url.pathname + url.search,
        headers: { 'User-Agent': USER_AGENT },
        timeout: TIMEOUT_MS
      },
      (res) => {
        clearTimeout(timeout);
        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          return fetchUrl(res.headers.location, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
  });
}

// Parse HTML and extract image candidates.
// Looks for: og:image, twitter:image, img tags in article/main, featured images.
function extractImages(html, baseUrl) {
  const images = [];
  const seen = new Set();
  const base = new URL(baseUrl);

  // Extract og:image
  const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogMatch && ogMatch[1]) {
    images.push({ src: ogMatch[1], source: 'og:image' });
    seen.add(ogMatch[1]);
  }

  // Extract twitter:image
  const twitterMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
  if (twitterMatch && twitterMatch[1] && !seen.has(twitterMatch[1])) {
    images.push({ src: twitterMatch[1], source: 'twitter:image' });
    seen.add(twitterMatch[1]);
  }

  // Extract img tags from article/main/content areas (highest priority)
  const articleMatch = html.match(/<(article|main|div[^>]*id="?content"?)>[\s\S]*?<\/\1>/i);
  const articleHtml = articleMatch ? articleMatch[0] : html;
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let m;
  let count = 0;
  while ((m = imgRegex.exec(articleHtml)) && count < 5) {
    if (m[1] && !seen.has(m[1])) {
      images.push({ src: m[1], source: 'img:article' });
      seen.add(m[1]);
      count++;
    }
  }

  // Convert relative URLs to absolute
  const resolved = images.map((img) => {
    try {
      const src = new URL(img.src, base.href).href;
      return { ...img, src };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return resolved;
}

// Scrape images from a single source URL.
// Returns array of { src, alt, credit } objects.
async function scrapeSourceImages(sourceUrl) {
  try {
    const html = await fetchUrl(sourceUrl);
    const images = extractImages(html, sourceUrl);
    
    // Return first 3 images (most relevant likely first)
    return images.slice(0, 3).map(img => ({
      src: img.src,
      alt: `Image from source: ${new URL(sourceUrl).hostname}`,
      credit: new URL(sourceUrl).hostname
    }));
  } catch (err) {
    console.warn(`[scraper] Failed to scrape ${sourceUrl}: ${err.message}`);
    return [];
  }
}

// Scrape images from all sources in an article.
// Returns { channel, sourceImages: { [sourceUrl]: [...images] } }
async function scrapeArticleImages(article) {
  const sourceImages = {};
  
  if (!article.sources || !Array.isArray(article.sources)) {
    return sourceImages;
  }

  // Scrape each source in parallel (with timeout protection)
  const results = await Promise.all(
    article.sources.map(source =>
      scrapeSourceImages(source.url)
        .then(images => [source.url, images])
        .catch(() => [source.url, []])
    )
  );

  for (const [url, images] of results) {
    if (images.length > 0) {
      sourceImages[url] = images;
    }
  }

  return sourceImages;
}

module.exports = { scrapeSourceImages, scrapeArticleImages };
