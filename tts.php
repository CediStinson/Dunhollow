<?php
// Dunhollow voices: serves a recorded MP3 for each line, the same file to every player.
// Free mode (no API key): a line nobody has recorded yet goes on a waiting list (tts-cache/_queue.jsonl); you record
//   the list on your own computer with voicegen.js (Kokoro, free) and upload the clips. Until then the game uses the
//   browser's voices for that line.
// Paid mode (an OpenAI key in tts-config.php): a new line is spoken at once, then kept.
// The game asks:  tts.php?v=<voice>&s=<style>&t=<text>
declare(strict_types=1);

$cfg = @include __DIR__ . '/tts-config.php'; if (!is_array($cfg)) $cfg = [];
$KEYED = !empty($cfg['api_key']) && strpos($cfg['api_key'], 'PUT-YOUR') === false;
$CACHE  = rtrim($cfg['cache_dir'] ?? (__DIR__ . '/tts-cache'), '/');
$DAILY  = (int)($cfg['daily_chars'] ?? 60000);      // new characters per day, for everyone together: the budget cap
$PER_IP = (int)($cfg['ip_lines_per_hour'] ?? 120);  // new lines per visitor per hour
$API    = $cfg['api_url'] ?? 'https://api.openai.com/v1/audio/speech';
$MODEL  = $cfg['model'] ?? 'gpt-4o-mini-tts';

// only the game's own voices and styles: nobody can send their own instructions through your key
$VOICES = ['alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer','verse'];
$STYLES = [
  'villager' => 'A villager in a small medieval English valley. Warm, plain-spoken, a little rough. British accent. Natural pace.',
  'noble'    => 'A proud medieval noble. Measured, precise, a little cold. Refined British accent.',
  'rogue'    => 'A sly city rogue. Quick, playful, a hint of danger. London accent.',
  'elf'      => 'An ancient elf. Calm, light and musical, unhurried but never slow. Soft, clear English.',
  'old'      => 'An old villager. Gravelly and wry, but brisk. Rural British accent.',
  'goblin'   => 'A small, excitable goblin. Squeaky, fast, cheeky, a little scheming.',
  'dead'     => 'A restless spirit speaking from the grave. Hollow, low, whispery, slow.',
  'narrator' => 'An audiobook narrator for a dark fantasy tale. Clear, warm, steady and brisk. British accent.',
  'hero'     => 'A young traveller. Steady and sincere. British accent.',
];

$voice = $_GET['v'] ?? ''; $style = $_GET['s'] ?? 'villager'; $text = trim((string)($_GET['t'] ?? ''));
$text = preg_replace('/\s+/u', ' ', $text);
if (!in_array($voice, $VOICES, true) || !isset($STYLES[$style])) { http_response_code(400); exit('bad voice'); }
$len = mb_strlen($text);
if ($len < 1 || $len > 600 || !preg_match('/\p{L}/u', $text)) { http_response_code(400); exit('bad text'); }

$key  = sha1('dunhollow1|' . $voice . '|' . $style . '|' . $text);   // the same name whoever recorded it (voicegen.js uses this too)
$dir  = $CACHE . '/' . substr($key, 0, 2);
$file = $dir . '/' . $key . '.mp3';

function serve(string $file): void {
  header('Content-Type: audio/mpeg');
  header('Content-Length: ' . filesize($file));
  header('Cache-Control: public, max-age=31536000, immutable');   // the same line never changes: browsers keep it
  readfile($file); exit;
}
if (is_file($file)) serve($file);                                 // spoken before: free

// ── a new line: check the guards, then ask OpenAI ──
@mkdir($CACHE, 0755, true);
$guard = $CACHE . '/_guard.json';
$fh = fopen($guard, 'c+'); flock($fh, LOCK_EX);
$g = json_decode(stream_get_contents($fh) ?: '{}', true) ?: [];
$day = gmdate('Y-m-d'); $hour = gmdate('Y-m-d-H');
$ip = substr(sha1(($_SERVER['REMOTE_ADDR'] ?? '?') . $day), 0, 12);
if (($g['day'] ?? '') !== $day) $g = ['day' => $day, 'chars' => 0, 'ips' => []];
if (($g['hour'] ?? '') !== $hour) { $g['hour'] = $hour; $g['ips'] = []; }
$over = $g['chars'] + $len > $DAILY || ($g['ips'][$ip] ?? 0) >= $PER_IP;
if (!$over) { $g['chars'] += $len; $g['ips'][$ip] = ($g['ips'][$ip] ?? 0) + 1; }
ftruncate($fh, 0); rewind($fh); fwrite($fh, json_encode($g)); flock($fh, LOCK_UN); fclose($fh);
if ($over) { http_response_code(429); exit('budget'); }             // the game falls back to the browser's own voices

if (!$KEYED) {                                                     // free mode: put it on the list for voicegen.js, once
  $mark = $CACHE . '/_queued/' . $key;
  if (!is_file($mark)) { @mkdir($CACHE . '/_queued', 0755, true); @touch($mark);
    file_put_contents($CACHE . '/_queue.jsonl', json_encode(['k' => $key, 'v' => $voice, 's' => $style, 't' => $text], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX); }
  http_response_code(404); exit('not recorded yet');
}

$ch = curl_init($API);
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40,
  CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg['api_key'], 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['model' => $MODEL, 'voice' => $voice, 'input' => $text,
                                     'instructions' => $STYLES[$style], 'response_format' => 'mp3']),
]);
$audio = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
if ($code !== 200 || !$audio || strlen($audio) < 200) { http_response_code(502); exit('upstream'); }

@mkdir($dir, 0755, true);
$tmp = $file . '.' . getmypid() . '.tmp';
file_put_contents($tmp, $audio); rename($tmp, $file);              // whole files only, even if two players ask at once
serve($file);
