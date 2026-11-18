// Finds every line of dialogue that can be known in advance and adds the missing ones to voicelines.jsonl.
//   node tools/voicelist.js            (needs acorn, acorn-walk and playwright; prints what was added)
//   node tools/voicelist.js --dry      (only counts)
// The game itself decides who speaks with which voice (VOICE._requests), so the keys match what players ask for.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const req = m => { try { return require(m); } catch (e) { return require('/opt/node-tools/node_modules/' + m); } };
const acorn = req('acorn'), walk = req('acorn-walk'), { chromium } = req('playwright');
const ROOT = path.join(__dirname, '..'), HTML = path.join(ROOT, 'index.html'), LIST = path.join(ROOT, 'voicelines.jsonl');
const html = fs.readFileSync(HTML, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

const lit = n => !n ? null : n.type === 'Literal' && typeof n.value === 'string' ? n.value
  : n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : null;
// a name given as a constant: look for `const X='...'` in the enclosing blocks, nearest first
function nameOf(n, anc) {
  const s = lit(n); if (s != null) return s;
  if (n.type !== 'Identifier') return null;
  for (let k = anc.length - 1; k >= 0; k--) {
    const b = anc[k], body = b.type === 'Program' || b.type === 'BlockStatement' ? b.body : null; if (!body) continue;
    for (const st of body) if (st.type === 'VariableDeclaration')
      for (const d of st.declarations) if (d.id.type === 'Identifier' && d.id.name === n.name) { const v = lit(d.init); if (v != null) return v; }
  }
  return null;
}
// every fixed piece of text in the text argument (conditionals give both sides, arrays each element)
function texts(n, out, inArr) {
  if (!n) return out; const s = lit(n);
  if (s != null) { out.push({ t: s, solo: !inArr }); return out; }
  if (n.type === 'ArrayExpression') { const one = n.elements.length === 1 && n.elements[0] && n.elements[0].type !== 'SpreadElement';
    n.elements.forEach(e => texts(e && e.type === 'SpreadElement' ? e.argument : e, out, !one)); }
  else if (n.type === 'ConditionalExpression') { texts(n.consequent, out, inArr); texts(n.alternate, out, inArr); }
  else if (n.type === 'LogicalExpression') texts(n.right, out, inArr);
  return out;
}
const found = [];
for (const src of scripts) {
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { console.error('parse:', e.message); continue; }
  walk.ancestor(ast, { CallExpression(n, _s, anc) {
    if (n.callee.type !== 'Identifier' || !/^(say|showDialog)$/.test(n.callee.name) || n.arguments.length < 2) return;
    const name = nameOf(n.arguments[0], anc); if (name == null) return;
    texts(n.arguments[1], []).forEach(x => found.push({ name, ...x }));
  } });
}
console.log(found.length + ' fixed pieces of dialogue found');
// speech bubbles in cutscenes: csSay(who, text). The speaker is a variable; find the object it was made from (its name and
// looks, which decide the voice), or failing that a name or id in quotes where it was looked up. A rename earlier in the scene wins.
const bubbles = [];
for (const src of scripts) {
  let ast; try { ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { continue; }
  const objInfo = o => { if (!o || o.type !== 'ObjectExpression') return null; const r = {};
    o.properties.forEach(p => { if (p.type !== 'Property' || !p.key) return; const k = p.key.name || p.key.value;
      if (k === 'name') r.name = lit(p.value) ?? (p.value.type === 'ConditionalExpression' ? lit(p.value.alternate) : null);
      if (k === 'id') r.id = lit(p.value); if (k === 'opts') r.opts = src.slice(p.value.start, p.value.end); }); return r.name || r.id ? r : null; };
  const findDecl = (id, anc) => { for (let k = anc.length - 1; k >= 0; k--) { let hit = null;
      walk.simple(anc[k], { VariableDeclarator(d) { if (hit || !d.init) return;
        if (d.id.type === 'Identifier' && d.id.name === id) hit = { info: objInfo(d.init), src: src.slice(d.init.start, d.init.end) }; } });
      if (hit) return hit; } return null; };
  const fnOf = anc => { for (let k = anc.length - 1; k >= 0; k--) if (/Function/.test(anc[k].type)) return anc[k]; return anc[0]; };
  // a speaker built in another function (const V={...} inside riteCast) and handed over by destructuring: look it up by its variable name anywhere
  const anyObj = id => { let hit = null; walk.simple(ast, { VariableDeclarator(d) { if (!hit && d.id.type === 'Identifier' && d.id.name === id && d.init && d.init.type === 'ObjectExpression') hit = objInfo(d.init); } }); return hit; };
  walk.ancestor(ast, { CallExpression(n, _s, anc) {
    if (n.callee.type !== 'Identifier' || n.callee.name !== 'csSay' || n.arguments.length < 2) return;
    const a0 = n.arguments[0]; if (a0.type === 'Identifier' && a0.name === 'player') return;
    let info = null, cands = [];
    if (a0.type === 'Identifier') { const d = findDecl(a0.name, anc); if (d) { info = d.info; cands = [...d.src.matchAll(/['"]([^'"]{2,40})['"]/g)].map(m => m[1]); } if (!info && !cands.length) info = anyObj(a0.name); }
    else cands = [...src.slice(a0.start, a0.end).matchAll(/['"]([^'"]{2,40})['"]/g)].map(m => m[1]);
    if (a0.type === 'Identifier') { const F = fnOf(anc), body = src.slice(F.start, n.start), re = new RegExp('\\b' + a0.name + "\\.name\\s*=\\s*'([^']+)'", 'g'); let m, last = null; while ((m = re.exec(body))) last = m[1]; if (last) info = { ...(info || {}), name: last }; }
    texts(n.arguments[1], []).forEach(x => bubbles.push({ info, cands, t: x.t }));
  } });
}
console.log(bubbles.length + ' cutscene bubbles found');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + HTML); await p.waitForFunction(() => typeof VOICE !== 'undefined' && typeof NPCS !== 'undefined');
  const reqs = await p.evaluate(([F, B]) => { const out = [];
    NPCS.length = 0; Object.values(AREAS).forEach(A => { try { if (A.npcs) NPCS.push(...A.npcs()); } catch (e) {} });   // everyone, wherever they stand, so each speaks in their own voice
    F.forEach(f => { const P = VOICE._parts(f.t); let r = VOICE._requests(f.name, f.t); if (!f.solo) r = r.slice(0, P.length); out.push(...r); });
    // bubbles are spoken whole, quotes stripped, in the speaker's own voice
    const bub = t => String(t).replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().replace(/[“”"]/g,'').trim();
    const all = [...NPCS]; try { if (typeof ROUTINES !== 'undefined') Object.values(ROUTINES).forEach(R => all.push({ id: R.sleepId, name: R.name, opts: R.opts })); } catch (e) {}
    Object.values(AREAS).forEach(A => { try { if (A.mobs) all.push(...A.mobs()); } catch (e) {} });
    B.forEach(b => { let name = null, opts = null;
      if (b.info && b.info.opts) { try { opts = new Function('return (' + b.info.opts + ')')(); } catch (e) {} }
      const ent = [b.info && b.info.id, b.info && b.info.name, ...b.cands].filter(Boolean).map(c => all.find(q => q.id === c || q.name === c)).find(Boolean);
      name = (b.info && b.info.name) || (ent && ent.name); opts = opts || (ent && ent.opts); if (!name || !opts) return;
      const v = VOICE._who(name, opts); const t = bub(b.t); if (t) out.push([v.oa || 'bm_fable', v.st || 'villager', t]); });
    // the dead at their graves: one low voice for all of them
    try { Object.values(LISTEN_GRAVES).forEach(G => G.lines.forEach(l => out.push(['am_onyx', 'dead', bub(l)]))); } catch (e) {}
    return out; }, [found, bubbles]);
  await b.close();
  const norm = t => t.trim().replace(/\s+/g, ' ');
  const have = new Set(fs.readFileSync(LIST, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).k)), add = [];
  for (const [v, s, t0] of reqs) { const t = norm(t0); if (!t) continue;
    const k = crypto.createHash('sha1').update('dunhollow1|' + v + '|' + s + '|' + t).digest('hex');
    if (have.has(k)) continue; have.add(k); add.push({ k, v, s, t }); }
  console.log(reqs.length + ' clips asked for, ' + add.length + ' new');
  if (process.argv.includes('--dry')) { add.slice(0, 15).forEach(a => console.log('  ' + a.v + ' ' + a.s + ': ' + a.t.slice(0, 80))); return; }
  if (add.length) fs.appendFileSync(LIST, add.map(a => JSON.stringify(a).replace(/","/g, '", "').replace(/":"/g, '": "')).join('\n') + '\n');
  add.forEach(a => console.log('  ' + a.v + ' ' + a.s + ': ' + a.t.slice(0, 90)));
})();
