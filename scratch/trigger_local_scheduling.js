const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { generateEmergencyDrops } = require('../server/antigravity-service');
const { generateImageForArticle } = require('../server/comfy-generator');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'server', 'skynet.db');

async function run() {
  console.log('Starting local scheduling trigger...');
  const rawDb = new DatabaseSync(DB_PATH);
  
  // 1. Clear queue
  rawDb.prepare("DELETE FROM queued_stories WHERE status != 'published'").run();
  console.log('Cleared non-published queue.');
  
  // 2. Generate drafts
  generateEmergencyDrops();
  console.log('Generated fresh drafts.');
  
  // 3. Resolve target date (tomorrow, morning)
  const target = new Date();
  target.setDate(target.getDate() + 1); // tomorrow
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  const targetDate = `${year}-${month}-${day}`;
  const edition = 'morning';
  
  const timeET = `${targetDate}T10:15:00-04:00`;
  const timeUTC = `${targetDate}T14:15:00.000Z`;
  
  const approvedRows = rawDb.prepare("SELECT id, payload FROM queued_stories WHERE status = 'approved'").all();
  console.log(`Found ${approvedRows.length} drafts to schedule. Triggering ComfyUI for each...`);
  
  for (let i = 0; i < approvedRows.length; i++) {
    const row = approvedRows[i];
    const payload = JSON.parse(row.payload);
    payload.date = targetDate;
    payload.publishedAt = timeET;
    payload.id = `${targetDate}-${payload.cat}-${edition}`;
    payload.edition = edition;
    
    const channel = payload.cat;
    console.log(`[${i+1}/${approvedRows.length}] Processing [${channel}] - "${payload.title}"...`);
    
    let customImg = null;
    if (channel !== 'skynet' && channel !== 'network') {
      try {
        const subDirName = `${targetDate}-${edition}`;
        customImg = await generateImageForArticle(channel, payload.title, subDirName);
        if (customImg) {
          console.log(`  -> Generated: ${customImg}`);
        } else {
          console.log(`  -> ComfyUI returned no image, using fallback.`);
        }
      } catch (e) {
        console.warn(`  -> ComfyUI generation failed:`, e.message);
      }
    }
    
    if (customImg) {
      payload.heroImage = `/assets/img/channels/${channel}/${customImg}`;
    } else {
      const dayNum = parseInt(day, 10) || 1;
      const imgIndex = (((dayNum * 3) + 0) % 30) + 1; // 0 offset for morning
      payload.heroImage = `/assets/img/channels/${channel}/${imgIndex}.jpg`;
    }
    
    rawDb.prepare(`
      UPDATE queued_stories 
         SET status = 'scheduled',
             publish_at = ?,
             edition = ?,
             payload = ?,
             updated_at = datetime('now')
       WHERE id = ?
    `).run(timeUTC, edition, JSON.stringify(payload), row.id);
  }
  
  console.log('Local scheduling completed successfully!');
}

run().catch(console.error);
