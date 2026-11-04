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

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + HTML); await p.waitForFunction(() => typeof VOICE !== 'undefined' && typeof NPCS !== 'undefined');
  const reqs = await p.evaluate(F => { const out = [];
    NPCS.length = 0; Object.values(AREAS).forEach(A => { try { if (A.npcs) NPCS.push(...A.npcs()); } catch (e) {} });   // everyone, wherever they stand, so each speaks in their own voice
    F.forEach(f => { const P = VOICE._parts(f.t); let r = VOICE._requests(f.name, f.t); if (!f.solo) r = r.slice(0, P.length); out.push(...r); });
    return out; }, found);
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
