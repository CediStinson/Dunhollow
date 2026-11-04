// Visits every area of the game once and reports anything that throws.   node tools/crawl.js
'use strict';
const { open } = require('./play');
(async () => {
  const { page, errors, close } = await open({ name: 'Crawler' });
  const r = await page.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)), out = [];
    for (const a of Object.keys(AREAS)) { try { switchArea(a); try { csSkip(); } catch (e) {} closeDialog(); await sleep(120); } catch (e) { out.push(a + ': ' + e.message); } }
    try { saveGame(true); } catch (e) { out.push('save: ' + e.message); }
    return { bad: out, n: Object.keys(AREAS).length }; });
  console.log(r.n + ' areas visited'); r.bad.forEach(l => console.log('  ' + l));
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + [...new Set(errors)].join('\n  ') : 'no page errors');
  await close(); process.exit(r.bad.length || errors.length ? 1 : 0);
})();
