const http = require('http');
const fs = require('fs');
const path = require('path');

const COMFY_URL = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const { COMFY_PATH } = require('./sync-comfy-helper');

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
  
  const folderPrefix = subfolder ? `skynet/channels/${channel}/${subfolder}/` : `skynet/channels/${channel}/`;

  // Default fallback workflow optimized for Krea2 Turbo (UNet + CLIP + VAE loaders)
  let workflow = {
    "29": {
      "inputs": {
        "filename_prefix": folderPrefix + "comfy",
        "images": ["30:8", 0]
      },
      "class_type": "SaveImage"
    },
    "49": {
      "inputs": {
        "aspect_ratio": "16:9",
        "megapixels": 1,
        "multiple": 8
      },
      "class_type": "ResolutionSelector"
    },
    "30:6": {
      "inputs": {
        "text": `cartoon illustration, ${title}, vibrant color palette, sci-fi, futuristic, educational, digital art style, high quality`,
        "clip": ["30:11", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    "30:5": {
      "inputs": {
        "width": ["49", 0],
        "height": ["49", 1],
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage"
    },
    "30:3": {
      "inputs": {
        "seed": Math.floor(Math.random() * 100000000000),
        "steps": 8,
        "cfg": 1.5,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1,
        "model": ["30:10", 0],
        "positive": ["30:6", 0],
        "negative": ["30:13", 0],
        "latent_image": ["30:5", 0]
      },
      "class_type": "KSampler"
    },
    "30:8": {
      "inputs": {
        "samples": ["30:3", 0],
        "vae": ["30:12", 0]
      },
      "class_type": "VAEDecode"
    },
    "30:10": {
      "inputs": {
        "unet_name": "krea2_turbo_fp8_scaled.safetensors",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader"
    },
    "30:11": {
      "inputs": {
        "clip_name": "qwen3vl_4b_fp8_scaled.safetensors",
        "type": "krea2",
        "device": "default"
      },
      "class_type": "CLIPLoader"
    },
    "30:12": {
      "inputs": {
        "vae_name": "qwen_image_vae.safetensors"
      },
      "class_type": "VAELoader"
    },
    "30:13": {
      "inputs": {
        "conditioning": ["30:6", 0]
      },
      "class_type": "ConditioningZeroOut"
    }
  };

  // Try to load user's actual Krea2 workflow from the saved history JSON
  const lastPromptFile = path.join(__dirname, '..', 'scratch', 'last_comfy_prompt.json');
  let saveNodeId = "29"; // default
  
  if (fs.existsSync(lastPromptFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(lastPromptFile, 'utf8'));
      const parsedWorkflow = Array.isArray(data) ? data[2] : (data.prompt || data);
      if (parsedWorkflow && typeof parsedWorkflow === 'object') {
        workflow = parsedWorkflow;
        console.log('[comfy-generator] Loaded custom Krea2 workflow from history.');
        
        // 1. Find the User Prompt text multiline node and update its text
        if (workflow["30:19"]) {
          workflow["30:19"].inputs.value = ` cartoonish Pixar style \n\n${title}\n\n`;
        }
        
        // 2. Find KSampler seed and randomize it
        if (workflow["30:3"]) {
          workflow["30:3"].inputs.seed = Math.floor(Math.random() * 1000000000000);
        }
        
        // 3. Find SaveImage node to update output path prefix
        let foundSave = false;
        for (const [id, node] of Object.entries(workflow)) {
          if (node.class_type === 'SaveImage') {
            node.inputs.filename_prefix = folderPrefix;
            saveNodeId = id;
            foundSave = true;
            break;
          }
        }
        if (!foundSave) {
          workflow["29"] = {
            "inputs": {
              "filename_prefix": folderPrefix,
              "images": ["30:8", 0]
            },
            "class_type": "SaveImage"
          };
          saveNodeId = "29";
        }
      }
    } catch (e) {
      console.warn('[comfy-generator] Failed to load custom workflow from history, using default:', e.message);
    }
  }

  try {
    const res = await postJson(COMFY_URL, { prompt: workflow });
    const promptId = res.prompt_id;
    console.log(`[comfy-generator] Prompt queued in ComfyUI. ID: ${promptId}`);
    
    const start = Date.now();
    while (Date.now() - start < 300000) {
      await new Promise(r => setTimeout(r, 2000));
      const history = await getJson(COMFY_URL, '/history');
      if (history[promptId]) {
        const promptInfo = history[promptId];
        const outputs = promptInfo.outputs;
        console.log(`[comfy-generator] Prompt completed. saveNodeId: "${saveNodeId}". Outputs keys:`, Object.keys(outputs || {}));
        if (outputs && outputs[saveNodeId] && outputs[saveNodeId].images && outputs[saveNodeId].images[0]) {
          const imageInfo = outputs[saveNodeId].images[0];
          const filename = imageInfo.filename;
          console.log(`[comfy-generator] Generated flat file: ${filename}`);
          
          if (subfolder && COMFY_PATH) {
            try {
              const comfyDirs = fs.readdirSync(COMFY_PATH);
              const matchedDir = comfyDirs.find(d => d.toLowerCase() === channel.toLowerCase()) || channel;
              const srcPath = path.join(COMFY_PATH, matchedDir, filename);
              
              if (fs.existsSync(srcPath)) {
                const destDir = path.join(COMFY_PATH, matchedDir, subfolder);
                fs.mkdirSync(destDir, { recursive: true });
                
                // Clean the name from ComfyUI output flat prefix to simple comfy name
                const cleanFilename = filename.replace(`${subfolder}_`, 'comfy_');
                const destPath = path.join(destDir, cleanFilename);
                
                let moved = false;
                for (let retry = 1; retry <= 5; retry++) {
                  try {
                    fs.renameSync(srcPath, destPath);
                    moved = true;
                    console.log(`[comfy-generator] Moved image to: ${destPath} (attempt ${retry})`);
                    break;
                  } catch (renameErr) {
                    if (retry === 5) {
                      // Fallback: Copy and delete
                      try {
                        fs.copyFileSync(srcPath, destPath);
                        fs.unlinkSync(srcPath);
                        moved = true;
                        console.log(`[comfy-generator] Copied and deleted image to: ${destPath}`);
                        break;
                      } catch (fallbackErr) {
                        throw new Error(`Rename failed and fallback copy failed: ${fallbackErr.message}`);
                      }
                    }
                    console.warn(`[comfy-generator] Rename locked, retrying in 1s (attempt ${retry}/5)...`);
                    await new Promise(r => setTimeout(r, 1000));
                  }
                }
                
                if (moved) {
                  return `${subfolder}/${cleanFilename}`;
                }
              } else {
                console.warn(`[comfy-generator] Source image path not found: ${srcPath}`);
              }
            } catch (err) {
              console.error('[comfy-generator] Failed to move file to subfolder:', err.message);
            }
          }
          return filename;
        } else {
          console.warn(`[comfy-generator] Outputs for node "${saveNodeId}" not found or mismatch:`, JSON.stringify(outputs));
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
