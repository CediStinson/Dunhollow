// Makes a save in an older version of the game and loads it in the current one.
//   node tools/oldsave.js [git revision, default: the first commit]
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const { open, quiet, sleep, ROOT } = require('./play');
(async () => {
  const rev = process.argv[2] || execSync('git rev-list --max-parents=0 HEAD', { cwd: ROOT }).toString().trim().split('\n')[0];
  const tmp = path.join(require('os').tmpdir(), 'dh-old-' + process.pid + '.html');
  fs.writeFileSync(tmp, execSync('git show ' + rev + ':index.html', { cwd: ROOT, maxBuffer: 1 << 28 }));
  const old = await open({ html: tmp, name: 'Oldtimer' });
  const storage = await old.page.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (const a of ['village', 'sylvhaven', 'heartwood']) if (AREAS[a]) { try { switchArea(a); try { csSkip(); } catch (e) {} closeDialog(); } catch (e) {} await sleep(200); }
    player.purse = (player.purse || 0) + 123; saveGame(false); await sleep(200);
    const o = {}; for (let k = 0; k < localStorage.length; k++) { const key = localStorage.key(k); o[key] = localStorage.getItem(key); } return o; });
  const oldErr = old.errors.slice(); await old.close(); fs.unlinkSync(tmp);
  const cur = await open({ name: false, storage });
  const r = await cur.page.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
    const list = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'), sv = list.find(s => !s.auto) || list[0]; if (!sv) return { err: 'no save found' };
    loadGame(sv.id); await sleep(1500);
    return { area: areaId, at: [Math.round(player.x), Math.round(player.y)], purse: player.purse, name: player.name, hp: player.hp }; });
  await quiet(cur.page); await sleep(500);
  console.log('old version ' + rev.slice(0, 7) + (oldErr.length ? ' (its own errors: ' + oldErr.length + ')' : ''));
  console.log('loaded:', JSON.stringify(r));
  console.log(cur.errors.length ? 'PAGE ERRORS:\n  ' + [...new Set(cur.errors)].join('\n  ') : 'no page errors');
  await cur.close(); process.exit(r.err || cur.errors.length ? 1 : 0);
})();
