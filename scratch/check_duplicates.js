const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'server', 'skynet.db');
const manifestPath = path.join(ROOT, 'data', 'manifest.json');

function checkDuplicates() {
  console.log('Checking for duplicate posts...');
  
  // 1. Check manifest.json
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const articles = manifest.articles || [];
      console.log(`Loaded ${articles.length} articles from manifest.json.`);
      
      const idMap = {};
      const titleMap = {};
      const slugMap = {};
      
      articles.forEach((art, idx) => {
        // Check ID
        if (!idMap[art.id]) idMap[art.id] = [];
        idMap[art.id].push(idx);
        
        // Check Title
        const normTitle = art.title.trim().toLowerCase();
        if (!titleMap[normTitle]) titleMap[normTitle] = [];
        titleMap[normTitle].push({ idx, id: art.id });
        
        // Check Slug
        if (!slugMap[art.slug]) slugMap[art.slug] = [];
        slugMap[art.slug].push(idx);
      });
      
      console.log('\n--- Duplicate IDs in manifest.json ---');
      let dupIds = 0;
      for (const [id, indices] of Object.entries(idMap)) {
        if (indices.length > 1) {
          console.log(`ID "${id}" occurs ${indices.length} times at indices:`, indices);
          dupIds++;
        }
      }
      if (dupIds === 0) console.log('None.');
      
      console.log('\n--- Duplicate Slugs in manifest.json ---');
      let dupSlugs = 0;
      for (const [slug, indices] of Object.entries(slugMap)) {
        if (indices.length > 1) {
          console.log(`Slug "${slug}" occurs ${indices.length} times at indices:`, indices);
          dupSlugs++;
        }
      }
      if (dupSlugs === 0) console.log('None.');
      
      console.log('\n--- Duplicate Titles in manifest.json ---');
      let dupTitles = 0;
      for (const [title, entries] of Object.entries(titleMap)) {
        if (entries.length > 1) {
          console.log(`Title "${title}" occurs ${entries.length} times:`, entries);
          dupTitles++;
        }
      }
      if (dupTitles === 0) console.log('None.');
      
    } catch (e) {
      console.error('Failed to analyze manifest.json:', e.message);
    }
  }
  
  // 2. Check Database queued_stories
  if (fs.existsSync(DB_PATH)) {
    try {
      const rawDb = new DatabaseSync(DB_PATH);
      const rows = rawDb.prepare("SELECT id, payload, status FROM queued_stories").all();
      console.log(`\nLoaded ${rows.length} queued stories from database.`);
      
      const titleMapDb = {};
      const idMapDb = {};
      
      rows.forEach(row => {
        const payload = JSON.parse(row.payload);
        const title = (payload.title || '').trim().toLowerCase();
        
        if (title) {
          if (!titleMapDb[title]) titleMapDb[title] = [];
          titleMapDb[title].push({ dbId: row.id, status: row.status, storyId: payload.id });
        }
        
        const storyId = payload.id;
        if (storyId) {
          if (!idMapDb[storyId]) idMapDb[storyId] = [];
          idMapDb[storyId].push({ dbId: row.id, status: row.status });
        }
      });
      
      console.log('\n--- Duplicate Titles in queued_stories ---');
      let dupTitlesDb = 0;
      for (const [title, entries] of Object.entries(titleMapDb)) {
        if (entries.length > 1) {
          console.log(`Title "${title}" occurs ${entries.length} times:`, entries);
          dupTitlesDb++;
        }
      }
      if (dupTitlesDb === 0) console.log('None.');
      
      console.log('\n--- Duplicate Story IDs in queued_stories ---');
      let dupIdsDb = 0;
      for (const [storyId, entries] of Object.entries(idMapDb)) {
        if (entries.length > 1) {
          console.log(`Story ID "${storyId}" occurs ${entries.length} times:`, entries);
          dupIdsDb++;
        }
      }
      if (dupIdsDb === 0) console.log('None.');
      
    } catch (e) {
      console.error('Failed to analyze database:', e.message);
    }
  }
}

checkDuplicates();
