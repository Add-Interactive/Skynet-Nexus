const { generateImageForArticle } = require('../server/comfy-generator');

async function test() {
  console.log('Running test comfy generation...');
  const res = await generateImageForArticle('ai', 'A cute robot playing chess', '2026-07-07-morning');
  console.log('Result:', res);
}

test();
