<?php
// Copy this file to tts-config.php (same folder as tts.php) and put your OpenAI API key in it.
// Get a key at https://platform.openai.com/api-keys (and add a few dollars of credit under Billing).
// Keep tts-config.php private: never post it anywhere. tts.php reads it on the server; players never see it.
return [
  'api_key'           => 'sk-PUT-YOUR-KEY-HERE',
  'daily_chars'       => 60000,   // most new text spoken per day, all players together (~$1 at most); spoken lines are free forever after
  'ip_lines_per_hour' => 120,     // most new lines one visitor can cause per hour
  // 'cache_dir'      => __DIR__ . '/tts-cache',   // where the MP3s are kept (made automatically)
];
