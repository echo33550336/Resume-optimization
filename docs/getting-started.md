# Getting Started: from clone to first report (5 minutes)

> For anyone cloning this repo for the first time. The README says *what* it is;
> this guide says *how to use it*. Prefer watching? Open the
> [5-second demo](https://echo33550336.github.io/Resume-optimization/) first.

## 0. Requirements

| Need | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 18 | The only runtime dependency (uses built-in `fetch`); the `scripts/capture.js` media pipeline needs ≥ 22 |
| npm dependencies | optional | Only for PDF / DOCX / image OCR parsing (mammoth / pdf-parse / tesseract.js) |
| Docker | optional | Only if you prefer running in a container |

## 1. Three steps to run it

```bash
git clone https://github.com/echo33550336/Resume-optimization.git
cd Resume-optimization

npm install              # optional — only needed for PDF / DOCX / image parsing
cp .env.example .env     # open .env and set LLM_API_KEY

npm start                # http://127.0.0.1:3000
```

Open <http://127.0.0.1:3000> — the header pill shows the runtime status
(model mode / offline mode).

> It also runs without `npm install`: pasting text always works, uploads answer
> with a clear "extractor not installed" message, and `GET /api/health` lists
> which extractors are available.

## 2. Configure a key (or skip it)

The default endpoint is Tencent Hunyuan, so most people only need **one key**:

```dotenv
LLM_API_KEY=your-key
LLM_API_BASE=https://tokenhub.tencentmaas.com/v1        # default: Tencent Hunyuan
LLM_MODEL=hunyuan-2.0-instruct-20251111                 # default model
```

Want another vendor? Any endpoint that speaks the OpenAI chat-completions
protocol works (that names the protocol, not a vendor):

```dotenv
# for example, OpenAI:
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

**No key yet? Still usable:**

- **Offline mode** — leave `LLM_API_KEY` empty and the server produces the
  four-part report from a local rules engine (lexical / structural analysis, no
  network); it is also the automatic fallback whenever the model call fails.
- **Demo mode** — open <http://127.0.0.1:3000/?demo=1> or click
  **Try a demo (no key)**; it replays a canned report through the same SSE
  streaming pipeline.

## 3. Generate your first report

1. **Paste the JD** — the job description goes into the left card (try the
   example chips at the top).
2. **Paste your resume** — the full resume into the right card; or drag a
   `pdf / docx / image` into the upload zone (≤ 20 MB, images go through OCR,
   Chinese + English supported).
3. **Pick parameters** — job family (General / Tech / Product / Data / Ops /
   Design / Marketing), model, and the report language (it may differ from the
   interface language).
4. **Run** — click **Optimize resume** or press `Ctrl/Cmd + Enter`.
5. **Watch it stream** — the result page renders live: the four-stage pipeline
   (diagnosis → rewrite → notes → risks), a match-score ring, and live
   character/second stats.
6. **Export** — copy text / copy Markdown / download `.md` / print PDF (the
   print stylesheet emits only the report).

**Stop** interrupts the stream at any time; running again replaces the result.

## 4. Install as a desktop / phone app (PWA)

- **Desktop Chrome / Edge**: click the install icon in the address bar, or the
  install button that appears in the app header.
- **Android**: browser menu → *Install app / Add to home screen*.
- **iOS**: Safari share menu → *Add to Home Screen*.
- Once installed it runs in a standalone window and the app shell opens
  offline; generating reports still requires access to your LLM endpoint.
- Phones cannot install a PWA from a plain `http://` LAN address — use an
  HTTPS domain (or a tunneling tool).

## 5. Make it yours

Open the gear icon in the header:

- 3 themes (warm paper / amber / dark gold) × 4 fonts × 4 background textures;
- one-click Chinese ↔ English interface;
- every preference is remembered in `localStorage`.

## 6. Docker

```bash
# prebuilt image (fastest)
cp .env.example .env                                   # set LLM_API_KEY
docker pull ghcr.io/echo33550336/resume-optimization:latest
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env \
  ghcr.io/echo33550336/resume-optimization:latest

# or build locally / compose
docker compose up --build
```

## 7. Update to the latest version

```bash
git pull && npm install && npm start     # source install
docker pull ghcr.io/echo33550336/resume-optimization:latest   # image install
```

## 8. FAQ

| Issue | Fix |
| --- | --- |
| Port already in use | set `PORT=3001` in `.env` |
| Reach it from other devices on the LAN | set `HOST=0.0.0.0` in `.env` and open the port in your firewall |
| Upload says "extractor not installed" | run `npm install` and restart |
| Privacy concerns | the key lives only in your local `.env`; the only outbound request goes to the `LLM_API_BASE` you configured — everything else stays local |
| Want the report always in English | pick *English* as the report language in the form (independent of the UI language) |
| Text is truncated | JD / resume each cap at `MAX_TEXT_CHARS=60000` (tunable in `.env`) |
| Run the test suite | `npm run ci` (syntax / types / lint / format + 45 tests) |

## 9. Where to next

- Product overview and architecture: [README.md](../README.md)
- Online demo and screenshots: [docs/index.html](./index.html) (GitHub Pages)
- Contributing: make `npm run ci` green before opening a PR; the frontend has
  no build step — edit `public/index.html` and refresh.
