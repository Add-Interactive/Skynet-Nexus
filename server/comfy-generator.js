const http = require('http');
const fs = require('fs');
const path = require('path');

const COMFY_URL = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const COMFY_CKPT = process.env.COMFY_CHECKPOINT || 'Krea2.safetensors';

function postJson(urlStr, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: '/prompt',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`ComfyUI prompt error: ${res.statusCode} - ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(urlStr, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    http.get({
      hostname: url.hostname,
      port: url.port,
      path: path
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`ComfyUI GET error: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function isComfyOnline() {
  try {
    const stats = await getJson(COMFY_URL, '/system_stats');
    return !!stats;
  } catch (e) {
    return false;
  }
}

async function generateImageForArticle(channel, title, subfolder = '') {
  const online = await isComfyOnline();
  if (!online) {
    return null;
  }

  console.log(`[comfy-generator] Triggering ComfyUI for [${channel}] post: "${title}" (subfolder: ${subfolder || 'root'})`);
  
  const positivePrompt = `cartoon illustration, ${title}, vibrant color palette, sci-fi, futuristic, educational, digital art style, high quality`;
  const negativePrompt = `bad quality, blurry, low resolution, deformed, text, watermark, signature`;

  const folderPrefix = subfolder ? `skynet/channels/${channel}/${subfolder}/` : `skynet/channels/${channel}/`;

  const workflow = {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "cfg": 8,
        "denoise": 1,
        "latent_image": ["5", 0],
        "model": ["4", 0],
        "sampler_name": "euler",
        "scheduler": "normal",
        "seed": Math.floor(Math.random() * 10000000),
        "steps": 20,
        "positive": ["6", 0],
        "negative": ["7", 0]
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": COMFY_CKPT
      }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "batch_size": 1,
        "height": 512,
        "width": 896
      }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["4", 1],
        "text": positivePrompt
      }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["4", 1],
        "text": negativePrompt
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": folderPrefix,
        "images": ["8", 0]
      }
    }
  };

  try {
    const res = await postJson(COMFY_URL, { prompt: workflow });
    const promptId = res.prompt_id;
    
    const start = Date.now();
    while (Date.now() - start < 90000) {
      await new Promise(r => setTimeout(r, 2000));
      const history = await getJson(COMFY_URL, '/history');
      if (history[promptId]) {
        const promptInfo = history[promptId];
        const outputs = promptInfo.outputs;
        if (outputs && outputs["9"] && outputs["9"].images && outputs["9"].images[0]) {
          const imageInfo = outputs["9"].images[0];
          const filename = imageInfo.filename;
          return subfolder ? `${subfolder}/${filename}` : filename;
        }
        break;
      }
    }
    return null;
  } catch (e) {
    console.error('[comfy-generator] ComfyUI generation failed:', e.message);
    return null;
  }
}

module.exports = { isComfyOnline, generateImageForArticle };
