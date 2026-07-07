const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateEmergencyDrops } = require('../server/antigravity-service');
const { generateImageForArticle } = require('../server/comfy-generator');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'server', 'skynet.db');

async function run() {
  console.log('Starting scheduling trigger for today (July 7th, Midday drop)...');
  const rawDb = new DatabaseSync(DB_PATH);
  
  // 1. Clear queue of non-published items
  rawDb.prepare("DELETE FROM queued_stories WHERE status != 'published'").run();
  console.log('Cleared non-published drafts/scheduled stories.');
  
  // 2. Generate fresh drafts
  generateEmergencyDrops();
  console.log('Generated fresh editorial drafts.');
  
  // 3. Setup dates and times for July 7th Midday drop
  const targetDate = '2026-07-07';
  const edition = 'midday';
  const timeET = `${targetDate}T14:15:00-04:00`; // 2:15 PM ET
  const timeUTC = `${targetDate}T18:15:00.000Z`;
  
  const approvedRows = rawDb.prepare("SELECT id, payload FROM queued_stories WHERE status = 'approved'").all();
  console.log(`Found ${approvedRows.length} drafts to schedule. Triggering ComfyUI sequentially...`);
  
  for (let i = 0; i < approvedRows.length; i++) {
    const row = approvedRows[i];
    const payload = JSON.parse(row.payload);
    payload.date = targetDate;
    payload.publishedAt = timeET;
    payload.id = `${targetDate}-${payload.cat}-${edition}`;
    payload.edition = edition;
    
    const channel = payload.cat;
    console.log(`[${i+1}/${approvedRows.length}] Processing channel [${channel}] - "${payload.title}"...`);
    
    let customImg = null;
    if (channel !== 'skynet' && channel !== 'network') {
      try {
        const subDirName = `${targetDate}-${edition}`;
        customImg = await generateImageForArticle(channel, payload.title, subDirName);
        if (customImg) {
          console.log(`  -> Custom image generated: ${customImg}`);
        } else {
          console.log(`  -> ComfyUI returned no image, falling back.`);
        }
      } catch (e) {
        console.warn(`  -> ComfyUI generation failed:`, e.message);
      }
    }
    
    if (customImg) {
      payload.heroImage = `/assets/img/channels/${channel}/${targetDate}-${edition}/${customImg}`;
    } else {
      const dayNum = 7; // July 7
      const imgIndex = (((dayNum * 3) + 1) % 30) + 1; // 1 offset for midday
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
  
  console.log('Stories scheduled in database. Running image sync...');
  try {
    execSync('npm run sync-images', { cwd: ROOT, stdio: 'inherit' });
    console.log('Images synchronized successfully to repo channels.');
  } catch (syncErr) {
    console.error('Image synchronization failed:', syncErr.message);
  }
  
  console.log('Committing and pushing scheduled drops & assets to GitHub...');
  try {
    execSync('git add .', { cwd: ROOT, stdio: 'inherit' });
    execSync('git commit -m "schedule: July 7 Midday drop stories & ComfyUI generated illustrations"', { cwd: ROOT, stdio: 'inherit' });
    execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
    console.log('Successfully pushed changes to GitHub! Railway will redeploy and schedule them.');
  } catch (gitErr) {
    console.error('Git push failed:', gitErr.message);
  }
  
  console.log('Today\'s Midday drop setup completed successfully!');
}

run().catch(console.error);
