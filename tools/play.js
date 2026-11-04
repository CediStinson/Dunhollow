// Shared harness for the test tools: opens the game in headless Chromium past the gate and the opening scene.
//   const { open } = require('./play');  const { page, errors, close } = await open({ name:'Test', html:'index.html' });
'use strict';
const fs = require('fs'), path = require('path');
const req = m => { try { return require(m); } catch (e) { return require('/opt/node-tools/node_modules/' + m); } };
const { chromium } = req('playwright');
const ROOT = path.join(__dirname, '..');
async function open(o = {}) {
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: o.viewport || { width: 1280, height: 800 } }), errors = [];
  const storage = o.storage || null;
  await page.addInitScript(s => { sessionStorage.setItem('dunhollow.auth', 'benni');
    if (!sessionStorage.getItem('dh.test.init')) { sessionStorage.setItem('dh.test.init', '1'); localStorage.clear(); if (s) for (const k in s) localStorage.setItem(k, s[k]); } }, storage);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(ROOT, o.html || 'index.html')); await page.waitForTimeout(800);
  if (o.name !== false) { await page.fill('#char-name-input', o.name || 'Tester'); await page.click('#start-btn'); await page.waitForTimeout(1500); await quiet(page); }
  return { browser, page, errors, close: () => browser.close() };
}
// skips a running cutscene and closes dialogs and tip cards (tip cards slow time down)
async function quiet(page) {
  await page.evaluate(() => { for (let k = 0; k < 20; k++) { try { if (typeof CS !== 'undefined' && CS.on) csSkip(); } catch (e) {} }
    try { closeDialog(); } catch (e) {}
    document.querySelectorAll('button').forEach(b => { if (/^Got it/.test(b.textContent) && b.offsetParent) b.click(); }); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = { open, quiet, sleep, ROOT };
