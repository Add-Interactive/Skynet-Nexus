const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Logging in to production admin panel...');
  try {
    // Log in to get session cookie
    const loginRes = await fetch('https://skynet-nexus-production.up.railway.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ageofai2024@gmail.com',
        password: 'weed4200'
      })
    });
    
    if (!loginRes.ok) {
      const txt = await loginRes.text();
      console.error('Login failed:', loginRes.status, txt);
      return;
    }
    
    // Extract cookie
    const cookie = loginRes.headers.get('set-cookie');
    console.log('Login successful! Cookie received.');
    
    // Query queue list
    const queueRes = await fetch('https://skynet-nexus-production.up.railway.app/api/admin/queue/list', {
      headers: {
        'Cookie': cookie
      }
    });
    
    if (!queueRes.ok) {
      const txt = await queueRes.text();
      console.error('Queue query failed:', queueRes.status, txt);
      return;
    }
    
    const queue = await queueRes.json();
    console.log(`Production queue count: ${queue.length} stories.`);
    console.log(queue.map(q => {
      try {
        const payload = JSON.parse(q.payload);
        return {
          id: q.id,
          channel: q.channel,
          status: q.status,
          publish_at: q.publish_at,
          edition: q.edition,
          title: payload.title
        };
      } catch (e) {
        return { id: q.id, status: q.status, error: e.message };
      }
    }));
    
  } catch (e) {
    console.error('Network error:', e.message);
  }
}

run();
