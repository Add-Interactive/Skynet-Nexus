const fs = require('fs');
const path = require('path');

async function checkLive() {
  console.log('Fetching live manifest from production...');
  try {
    const res = await fetch('https://skynet-nexus-production.up.railway.app/data/manifest.json');
    const manifest = await res.json();
    const articles = manifest.articles || [];
    console.log(`Loaded ${articles.length} articles from production manifest.`);
    
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
      titleMap[normTitle].push({ idx, id: art.id, date: art.date });
      
      // Check Slug
      if (!slugMap[art.slug]) slugMap[art.slug] = [];
      slugMap[art.slug].push({ idx, id: art.id });
    });
    
    console.log('\n--- Duplicate IDs in Production Manifest ---');
    let dupIds = 0;
    for (const [id, indices] of Object.entries(idMap)) {
      if (indices.length > 1) {
        console.log(`ID "${id}" occurs ${indices.length} times at indices:`, indices);
        dupIds++;
      }
    }
    if (dupIds === 0) console.log('None.');
    
    console.log('\n--- Duplicate Titles in Production Manifest ---');
    let dupTitles = 0;
    for (const [title, entries] of Object.entries(titleMap)) {
      if (entries.length > 1) {
        console.log(`Title "${title}" occurs ${entries.length} times:`, entries);
        dupTitles++;
      }
    }
    if (dupTitles === 0) console.log('None.');
    
  } catch (e) {
    console.error('Failed to query live site:', e.message);
  }
}

checkLive();
