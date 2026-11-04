// Runs the autoplay bot headless for a while and prints its log.
//   node tools/autoplay-run.js [class] [real seconds] [setup]
// setup 'tree': a level-8 character with the moon lantern, standing in Sylvhaven, to try the descent into the great tree.
'use strict';
const fs = require('fs'), path = require('path');
const { open, quiet, sleep, ROOT } = require('./play');
const cls = process.argv[2] || 'melee', secs = +(process.argv[3] || 120), setup = process.argv[4] || '';
(async () => {
  const { page, errors, close } = await open({ name: 'Bot' });
  const src = fs.readFileSync(path.join(ROOT, 'autoplay.html'), 'utf8').match(/<script type="text\/x-bot" id="bot-src">([\s\S]*?)<\/script>/)[1];
  await page.evaluate(([cls, setup]) => {
    if (setup === 'tree') { CHOICE.xp = XP_AT[8]; Object.assign(player.opts.equip, { weapon: 'sword', armor: 'studded', head: 'hood', hands: 'gloves', feet: 'boots' });
      try { updateHud(); refreshPlayerHp(false); } catch (e) {} player.hp = player.maxHp; CHOICE.hwQ = 'lantern';
      player.inv[player.inv.indexOf(null)] = 'moon_lantern'; for (let k = 0; k < 4; k++) player.inv[player.inv.indexOf(null)] = 'potion';
      switchArea('sylvhaven', 'fromTree'); }
    window.BOT_CFG = { cls, speed: 8, fast: true, seed: 7 }; }, [cls, setup]);
  await quiet(page);
  await page.evaluate(src => { const s = document.createElement('script'); s.textContent = src; document.body.appendChild(s); }, src);
  const t0 = Date.now(); let shown = 0;
  while (Date.now() - t0 < secs * 1000) { await sleep(5000);
    const r = await page.evaluate(n => ({ log: BOT.log.slice(n).map(e => e.area + ': ' + e.msg), n: BOT.log.length, err: BOT.errors.slice(0, 3) }), shown);
    r.log.forEach(l => console.log(l)); shown = r.n; }
  const rep = await page.evaluate(() => ({ ...BOT.report(), errors: BOT.errors, hw: CHOICE.hwSpirit, hhs: typeof HHS !== 'undefined' ? HHS.join('') : '' }));
  console.log(JSON.stringify({ lvl: rep.lvl, area: rep.area, hp: rep.hp, fights: rep.fights, deaths: rep.deaths, spirit: rep.hw, errors: rep.errors }));
  console.log(errors.length ? 'PAGE ERRORS:\n  ' + [...new Set(errors)].join('\n  ') : 'no page errors');
  await close();
})();
