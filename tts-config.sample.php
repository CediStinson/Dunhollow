<?php
// OPTIONAL. Without this file the voices are free: lines go on a waiting list (tts-cache/_queue.jsonl) that you
// record on your own computer with voicegen.js and upload (see voicegen.js for the steps).
//
// With an OpenAI key here, new lines are spoken at once instead (paid, a few dollars for the whole game, once).
// Copy this file to tts-config.php next to tts.php. Keep it private; players never see it.
return [
  'api_key'           => 'sk-PUT-YOUR-KEY-HERE',   // leave as is for the free way
  'daily_chars'       => 60000,   // most new text per day, all players together (caps the bill, and the waiting list)
  'ip_lines_per_hour' => 120,     // most new lines one visitor can cause per hour
];
