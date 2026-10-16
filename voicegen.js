// Records Dunhollow's voice lines on your own computer, for free, with Kokoro (an open voice model).
//
//   1. Install Node.js (https://nodejs.org), then in this folder, once:   npm install kokoro-js lamejs
//   2. The whole game at once (do this first; it takes a while, leave it running):   node voicegen.js voicelines.jsonl
//      voicelines.jsonl comes with the game: every line that can be known in advance (about 2,500), each with its own voice from Kokoro's 28.
//   3. Upload the folders inside ./tts-cache to tts-cache/ on your web space.
//   Later, for the few lines that change during play (names, numbers, cutscene bubbles): download
//   tts-cache/_queue.jsonl from your web space, run   node voicegen.js _queue.jsonl , upload again,
//   and delete _queue.jsonl there.
//
// The first run downloads the voice model once (about 90 MB, to your computer only). Lines already recorded
// in ./tts-cache are skipped, so keep the folder and run it again whenever the list has grown.
'use strict';
const fs = require('fs'), path = require('path');

// the game's voices and manners, mapped onto Kokoro's British and American voices
const VOICE = { coral:'bf_emma', nova:'bf_isabella', shimmer:'af_bella', sage:'bf_lily', alloy:'af_heart',
                ash:'bm_george', echo:'bm_lewis', onyx:'am_onyx', verse:'bm_daniel', ballad:'am_michael', fable:'bm_fable' };
const STYLE = { villager:{speed:1.0}, noble:{speed:0.95}, rogue:{speed:1.08}, elf:{speed:0.95}, old:{speed:0.97},
                goblin:{voice:'am_puck', speed:1.15}, dead:{voice:'am_onyx', speed:0.85}, narrator:{voice:'bm_fable', speed:1.0}, hero:{speed:1.0} };

async function readQueue(src) {
  const txt = /^https?:\/\//.test(src) ? await (await fetch(src)).text() : fs.readFileSync(src, 'utf8');
  const seen = new Set();
  return txt.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(q => q && /^[0-9a-f]{40}$/.test(q.k) && !seen.has(q.k) && seen.add(q.k));
}

function toMp3(f32, rate) {
  if (!global.MPEGMode) {                       // lamejs needs these as globals under Node (a known bug in the package)
    global.MPEGMode = require('lamejs/src/js/MPEGMode.js'); global.Lame = require('lamejs/src/js/Lame.js'); global.BitStream = require('lamejs/src/js/BitStream.js'); }
  const lamejs = require('lamejs'), enc = new lamejs.Mp3Encoder(1, rate, 48), out = [];
  const pcm = new Int16Array(f32.length); for (let i = 0; i < f32.length; i++) pcm[i] = Math.max(-1, Math.min(1, f32[i])) * 32767;
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(Buffer.from(b)); }
  const e = enc.flush(); if (e.length) out.push(Buffer.from(e));
  return Buffer.concat(out);
}

(async () => {
  const src = process.argv[2], outDir = process.argv[3] || path.join(__dirname, 'tts-cache');
  if (!src) { console.log('Usage: node voicegen.js <_queue.jsonl or its URL> [output folder]'); process.exit(1); }
  const queue = await readQueue(src);
  const todo = queue.filter(q => !fs.existsSync(path.join(outDir, q.k.slice(0, 2), q.k + '.mp3')));
  console.log(queue.length + ' lines on the list, ' + todo.length + ' still to record.');
  if (!todo.length) return;
  const { KokoroTTS } = process.env.VOICEGEN_MOCK ? require(process.env.VOICEGEN_MOCK) : await import('kokoro-js');
  console.log('Loading the voice model (the first time it is downloaded, about 90 MB)…');
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  let n = 0;
  for (const q of todo) {
    const st = STYLE[q.s] || STYLE.villager, voice = st.voice || (/^[ab][fm]_/.test(q.v) ? q.v : VOICE[q.v]) || 'bm_george';   // the game names Kokoro's voices itself now
    try {
      const a = await tts.generate(q.t, { voice, speed: st.speed || 1 });
      const dir = path.join(outDir, q.k.slice(0, 2)); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, q.k + '.mp3'), toMp3(a.audio, a.sampling_rate));
      n++; console.log(`[${n}/${todo.length}] ${voice}: ${q.t.slice(0, 70)}`);
    } catch (e) { console.log('  skipped (' + e.message + '): ' + q.t.slice(0, 60)); }
  }
  console.log('Done. Upload the folders inside ' + outDir + ' to tts-cache/ on your web space.');
})();
