// server/tts.js
// Kokoro TTS service for Skynet Nexus article narration.
// Generates natural-voice audio for articles on demand, cached on disk.
//
// Voices are curated for a family audience: warm, clear, friendly.
// Uses kokoro-js (ONNX, CPU) — no GPU, no API keys, no usage caps.

const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('./storage');

// Curated voice list for the voice picker.
// Kokoro voice IDs: af_* = American feminine, am_* = American masculine,
// bf_*/bm_* = British. These four cover a warm range for kids' news.
const VOICES = [
  { id: 'af_heart', label: 'Heart', desc: 'Warm feminine', gender: 'feminine' },
  { id: 'af_bella', label: 'Bella', desc: 'Friendly feminine', gender: 'feminine' },
  { id: 'am_michael', label: 'Michael', desc: 'Friendly masculine', gender: 'masculine' },
  { id: 'am_fenrir', label: 'Fenrir', desc: 'Deep masculine', gender: 'masculine' },
];
const DEFAULT_VOICE = 'af_heart';
const VOICE_IDS = new Set(VOICES.map(v => v.id));

const AUDIO_DIR = path.join(DATA_DIR, 'audio');

let ttsInstance = null;
let loadPromise = null;

function ensureAudioDir() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Lazy-load the Kokoro model on first use. ~92MB quantized download
// on first run, then cached.
async function getTTS() {
  if (ttsInstance) return ttsInstance;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { KokoroTTS } = require('kokoro-js');
      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'cpu',
      });
      ttsInstance = tts;
      return tts;
    })();
  }
  return loadPromise;
}

// Strip HTML tags and normalize whitespace for speech.
function textForSpeech(article) {
  const parts = [];
  if (article.title) parts.push(article.title);
  const body = String(article.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (body) parts.push(body);
  if (article.kidTake) parts.push('Kid take: ' + String(article.kidTake).replace(/\s+/g, ' ').trim());
  return parts.join('. ').slice(0, 8000); // Kokoro handles ~8k chars comfortably
}

function audioPath(articleId, voice) {
  ensureAudioDir();
  const safeId = String(articleId).replace(/[^a-z0-9-]/gi, '');
  const safeVoice = VOICE_IDS.has(voice) ? voice : DEFAULT_VOICE;
  return path.join(AUDIO_DIR, `${safeId}-${safeVoice}.wav`);
}

// Generate (or fetch from cache) the narration audio for an article.
// Returns the absolute path to the WAV file.
async function getArticleAudio(article, voice) {
  const vid = VOICE_IDS.has(voice) ? voice : DEFAULT_VOICE;
  const outPath = audioPath(article.id || article.slug, vid);
  if (fs.existsSync(outPath)) return outPath;

  const text = textForSpeech(article);
  if (!text) throw new Error('article has no readable text');

  const tts = await getTTS();
  const audio = await tts.generate(text, { voice: vid });
  // audio.save writes a WAV file
  await audio.save(outPath);
  return outPath;
}

function listVoices() {
  return VOICES.map(v => ({ id: v.id, label: v.label, desc: v.desc, gender: v.gender }));
}

module.exports = { getArticleAudio, listVoices, DEFAULT_VOICE, VOICE_IDS, audioPath };
