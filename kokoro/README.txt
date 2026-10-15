AI VOICES FOR DUNHOLLOW, SERVED FROM YOUR OWN WEB SPACE
========================================================

Upload this whole "kokoro" folder next to index.html, so your server has:

  index.html
  kokoro/kokoro.web.js
  kokoro/ort-wasm-simd-threaded.jsep.mjs
  kokoro/ort-wasm-simd-threaded.jsep.wasm
  kokoro/voices/*.bin                       (28 English voices)
  kokoro/models/onnx-community/Kokoro-82M-v1.0-ONNX/...   (the model, see below)

The model itself is not in this folder (it is 92 MB). Download these four files
from the official Kokoro page on Hugging Face (open each link in your browser,
it saves the file) and put them into
kokoro/models/onnx-community/Kokoro-82M-v1.0-ONNX/ exactly like this:

  config.json
      https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/config.json
  tokenizer.json
      https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer.json
  tokenizer_config.json
      https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/tokenizer_config.json
  onnx/model_quantized.onnx          (this one goes in the "onnx" subfolder)
      https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model_quantized.onnx

How the game uses it:
  - Menu > Voices on, then Voice engine: AI.
  - It looks for kokoro/ on your server first. If the folder or the model is
    missing, it quietly falls back to the public servers (jsDelivr and Hugging Face).
  - A player downloads about 115 MB the first time (model 92 MB, runtime 22 MB,
    and each voice when it is first needed, half a MB each). The browser keeps it,
    so later visits are instant. Players who never switch AI voices on download nothing.
  - Upload the .wasm and .onnx files in BINARY mode if your FTP program asks.
  - If your host serves .mjs or .wasm with the wrong type and it fails to load,
    add these lines to a file called .htaccess in the kokoro folder (Apache hosts):
        AddType application/wasm .wasm
        AddType text/javascript .mjs

Licences: Kokoro-82M and kokoro-js are Apache-2.0; transformers.js and
onnxruntime-web are Apache-2.0 / MIT. See the LICENSE files here.
