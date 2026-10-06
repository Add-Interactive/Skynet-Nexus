// server/tts-routes.js
// On-demand TTS endpoints (wires up server/tts.js Kokoro narration).
// Mounted as require('./tts-routes')(api, { requireAuth }) in server/index.js.

const path = require('path');
const fs = require('fs');
const tts = require('./tts');

function checkKokoro() {
  try {
    require.resolve('kokoro-js');
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = function ttsRoutes(api, { requireAuth }) {
  // GET /api/tts/voices — list available narration voices (public).
  api.get('/tts/voices', (req, res) => {
    res.json({
      voices: tts.listVoices(),
      default: tts.DEFAULT_VOICE,
      engine: 'kokoro',
      available: checkKokoro(),
    });
  });

  // POST /api/tts/speak { articleId?, text?, title?, voice? }
  // Generates (or serves cached) WAV narration. Auth required to avoid abuse.
  api.post('/tts/speak', requireAuth, async (req, res) => {
    try {
      if (!checkKokoro()) {
        return res.status(503).json({
          error: 'TTS engine not installed on this server.',
          detail: 'kokoro-js is not available. Pre-generated MP3s and browser speech remain available.',
        });
      }
      const body = req.body || {};
      const voice = tts.VOICE_IDS.has(body.voice) ? body.voice : tts.DEFAULT_VOICE;

      // Build a minimal article object from the request.
      // Prefer articleId (server looks up the article); fall back to raw text.
      let article = null;
      if (body.articleId) {
        try {
          const { DATA_DIR } = require('./storage');
          const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
          const entry = (manifest.articles || []).find(a => String(a.id) === String(body.articleId));
          if (entry && entry.path) {
            const rel = String(entry.path).replace(/^data\//, '');
            article = JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8'));
            article.id = article.id || entry.id;
          }
        } catch (e) { /* fall through to text */ }
      }
      if (!article) {
        const text = String(body.text || '').slice(0, 8000).trim();
        if (!text && !body.title) {
          return res.status(400).json({ error: 'articleId or text required' });
        }
        article = {
          id: 'adhoc-' + Buffer.from(text.slice(0, 64)).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 24),
          title: body.title || '',
          body: text,
        };
      }

      let wavPath;
      try {
        wavPath = await tts.getArticleAudio(article, voice);
      } catch (e) {
        // Model download failure, OOM, etc. — don't 500, explain.
        return res.status(503).json({
          error: 'TTS generation failed.',
          detail: String(e && e.message || e).slice(0, 200),
        });
      }
      // Serve the WAV with caching headers. Frontend can <audio src> this URL
      // via the redirect below, or use the JSON for metadata.
      const fname = path.basename(wavPath);
      if (req.query.redirect === '1') {
        return res.redirect(302, '/assets/audio/' + encodeURIComponent(fname));
      }
      res.json({
        ok: true,
        voice,
        url: '/assets/audio/' + encodeURIComponent(fname),
        format: 'wav',
      });
    } catch (e) {
      res.status(500).json({ error: 'tts failed' });
    }
  });

  // GET /api/tts/audio/:articleId/:voice — convenience: generate + stream.
  api.get('/tts/audio/:articleId/:voice', requireAuth, async (req, res) => {
    try {
      if (!checkKokoro()) {
        return res.status(503).json({ error: 'TTS engine not installed on this server.' });
      }
      const voice = tts.VOICE_IDS.has(req.params.voice) ? req.params.voice : tts.DEFAULT_VOICE;
      const { DATA_DIR } = require('./storage');
      let article = null;
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
        const entry = (manifest.articles || []).find(a => String(a.id) === String(req.params.articleId));
        if (entry && entry.path) {
          const rel = String(entry.path).replace(/^data\//, '');
          article = JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8'));
          article.id = article.id || entry.id;
        }
      } catch (e) { /* fall through */ }
      if (!article) return res.status(404).json({ error: 'article not found' });
      let wavPath;
      try {
        wavPath = await tts.getArticleAudio(article, voice);
      } catch (e) {
        return res.status(503).json({ error: 'TTS generation failed.', detail: String(e && e.message || e).slice(0, 200) });
      }
      res.sendFile(wavPath);
    } catch (e) {
      res.status(500).json({ error: 'tts failed' });
    }
  });
};
