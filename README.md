# Resume Optimizer

> Tailor a resume to a specific job description with an LLM that behaves like a hiring manager — streamed live, fully local, zero frameworks.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Backend](https://img.shields.io/badge/backend-zero--framework-black)](server.js)
[![Streaming](https://img.shields.io/badge/output-SSE-purple)](#features)

---

## Introduction

**Resume Optimizer** turns one job description plus one resume into a match-oriented rewrite.
You paste (or upload) the JD and your resume, pick the job family, and an LLM acting as a
senior HR director returns a four-part report:

1. **Match diagnosis** — a 0–100 score with the reasons behind it.
2. **Rewritten resume** — the full resume rebuilt in STAR form, quantified, keyword-aligned with the JD, and honest (missing figures become `[add the number]` placeholders instead of invented ones).
3. **Change log** — the most important 5–8 edits and why each one matters.
4. **Gaps and risks** — information the recruiter will ask for that the resume does not answer yet.

The point is not "rewrite my bullets" — it is *diagnosis first, rewrite second*: the model must
justify the score, then show exactly which text moved the score, then flag what is still missing.
Text streams into the page as it is produced, so a 3,000-token rewrite becomes readable in seconds
instead of a spinner and a wait.

It is a single small Node.js service with a static single-page UI: no build step, no database, no
telemetry, no third-party proxy. The browser never sees the API key; the server is the only
component that talks to the LLM you configure.

## Features

- **JD-aware rewriting** — every bullet is rewritten against the target role, STAR-style, with quantified results.
- **Streaming output (SSE)** — the result renders token by token; stop at any moment and keep what was generated.
- **Cancel and export** — stop generation, copy plain text, copy Markdown, download `.md`, or print / save as PDF.
- **Multi-format input** — paste text or drop PDF / DOCX / TXT / MD / CSV / images (OCR) onto the JD or resume box.
- **Job-family focus** — tech, product, data, ops, design, marketing, general: each carries its own optimization bias.
- **Bilingual UI (Chinese / English)** — one click switches every label and the language the model writes in; the choice is remembered in `localStorage`.
- **Theme system** — brand gold / amber / dark, four fonts, four background patterns, persisted in `localStorage`.
- **Local-first and private** — nothing leaves your machine except the request to the LLM endpoint you configured.
- **Hardened server** — LLM timeout with bounded retries, typed error codes, body/upload/text limits, localhost-only CORS, static path containment, security headers, graceful shutdown.

## How it works

```
┌──────────────┐   paste / drop JD + resume    ┌──────────────────┐
│ Browser UI   │ ────────────────────────────► │ Node http server │
│ index.html   │                               │   server.js      │
└──────────────┘ ◄──── SSE: delta, delta, … ── └────────┬─────────┘
                                                        │ buildMessages()
                                                        ▼
                                               ┌──────────────────┐
                                               │   prompt.js      │
                                               │ system + user    │
                                               └────────┬─────────┘
                                                        │ POST /chat/completions
                                                        ▼
                                               ┌──────────────────┐
                                               │ OpenAI-compatible│
                                               │ LLM endpoint     │
                                               └──────────────────┘
```

1. The UI posts `{ company, position, jd, resume, roleType, lang }`.
2. `prompt.js` assembles the system prompt (HR-director persona plus family-specific focus) and the user prompt, in the requested language.
3. `server.js` calls any OpenAI-compatible `/chat/completions` endpoint, retrying only before the first delta reaches the browser.
4. Tokens are relayed as SSE frames; the UI renders Markdown incrementally and keeps the raw text for export.

## Tech stack

| Layer | Choice |
| --- | --- |
| Server | Node.js native `http` — no framework, no router dependency |
| Frontend | Hand-written HTML / CSS / JS — no bundler, no build step |
| LLM | Any OpenAI-compatible `/chat/completions` endpoint (Tencent Hunyuan by default) |
| Extractors | `pdf-parse`, `mammoth`, `tesseract.js` — optional and lazily required |
| Prompts | `prompt.js` — single source of truth, shared with the Agent Skill |

## Project structure

```
resume-optimizer/
├── server.js                  # HTTP server: routes, SSE streaming, static files, limits
├── prompt.js                  # system / user prompt builders (single source of truth)
├── public/
│   ├── index.html             # single-page UI: landing, optimizer, settings, export toolbar
│   ├── i18n.js                # zh / en dictionary and DOM translation runtime
│   ├── logo.svg
│   └── bg.svg
├── .commandcode/
│   ├── skills/resume-optimizer/SKILL.md   # Agent Skill definition
│   └── taste/taste.md
├── .env.example
├── LICENSE
└── README.md
```

## Quick start

Prerequisites: **Node.js 18+** (needs the global `fetch`).

```bash
git clone https://github.com/echo33550336/Resume-optimization.git
cd Resume-optimization

npm install              # optional — only needed for PDF / DOCX / image extraction
cp .env.example .env     # then set LLM_API_KEY (and LLM_API_BASE if not Tencent Hunyuan)

npm start                # http://127.0.0.1:3000
npm run check            # syntax check for server.js, prompt.js and public/i18n.js
```

Without `npm install` the app still runs: text pasting works, uploads answer with a clear
"extractor not installed" message, and `GET /api/health` reports which extractors are available.

### Minimal `.env`

```dotenv
LLM_API_KEY=sk-your-key
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## Configuration

Every setting can come from `.env` or from real environment variables (real environment wins):

| Variable | Default | Meaning |
| --- | --- | --- |
| `LLM_API_KEY` | — | Bearer token for the endpoint (**required**) |
| `LLM_API_BASE` | `https://tokenhub.tencentmaas.com/v1` | OpenAI-compatible base URL |
| `LLM_MODEL` | `hunyuan-2.0-instruct-20251111` | Default model |
| `LLM_MAX_TOKENS` | `4096` | Max output tokens |
| `LLM_TIMEOUT_MS` | `120000` | Per-attempt timeout (minimum 5000) |
| `LLM_RETRIES` | `2` | Retries on 429 / 5xx / network failure, before any token is streamed |
| `PORT` | `3000` | Listen port |
| `HOST` | `127.0.0.1` | Listen host — keep loopback unless you know why |
| `MAX_BODY_BYTES` | `20971520` (20 MB) | Max JSON request body |
| `MAX_EXTRACT_BYTES` | `20971520` (20 MB) | Max uploaded file size |
| `MAX_TEXT_CHARS` | `60000` | Max characters for JD / resume / extracted text |
| `ALLOWED_ORIGINS` | — | Extra CORS origins, comma separated (localhost is always allowed) |

## Usage

1. Open `http://127.0.0.1:3000` and click **Optimize resume**.
2. Fill in company and position, paste the JD and your resume — or drag a file onto either box.
3. Pick a job family (it changes what the model emphasises) and a model.
4. Press **Optimize**. The report streams in; **Stop** cancels, the toolbar offers copy as text, copy as Markdown, download `.md`, and print.
5. Prefer a different light? **Settings** switches theme, font, and background; choices persist locally.

Keyboard: `Ctrl/Cmd + Enter` submits, `Esc` closes the settings dialog.

### Internationalization

The `ZH / EN` switch in the header translates the whole interface (landing page, forms, result
toolbar, settings, toasts, error messages) and sends `lang` with the request so the model writes its
answer in the same language. English was the original UI language and Chinese came second, so the
Chinese strings live in dictionaries while the English ones are the shipped markup.

- Dictionaries: `public/i18n.js` (`EN`, `ZH`, one key per string, `{name}` interpolation).
- Markup carries `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`, `data-i18n-alt`.
- Runtime API: `window.RI18N.t(key, vars)`, `.setLang('zh' | 'en')`, `.apply(lang)`, `.lang`; emits a `ri18n:change` event.
- The choice is persisted under `resume-optimizer-lang`; first visit falls back to `navigator.language`.

## API

All JSON endpoints answer `{ "ok": true, ... }` on success and `{ "ok": false, "code": "...", "error": "..." }` on failure.

### `GET /api/health`

```json
{
  "ok": true,
  "model": "hunyuan-2.0-instruct-20251111",
  "hasKey": true,
  "streaming": true,
  "roleTypes": ["general", "tech", "product", "data", "ops", "design", "marketing"],
  "langs": ["zh", "en"],
  "extractors": { "pdf": true, "docx": true, "ocr": true },
  "limits": { "maxBodyBytes": 20971520, "maxExtractBytes": 20971520, "maxTextChars": 60000, "llmTimeoutMs": 120000 }
}
```

### `POST /api/extract`

```json
{ "filename": "resume.pdf", "data": "<base64 or data URL>" }
```

Response: `{ "ok": true, "text": "...", "meta": { "filename": "resume.pdf", "ext": "pdf", "bytes": 81234, "chars": 4210, "elapsedMs": 640 } }`

### `POST /api/optimize`

```json
{
  "company": "Acme Corp",
  "position": "Senior Backend Engineer",
  "jd": "We are looking for ...",
  "resume": "Experience: ...",
  "roleType": "tech",
  "lang": "en",
  "model": "hunyuan-2.0-instruct-20251111",
  "stream": true
}
```

- `lang` (optional) — `zh` or `en`; controls the language of the prompt and of the model's answer.
  Defaults to `zh`, so existing clients keep the previous behaviour.

- `stream: false` (default) — returns `{ "ok": true, "content": "...", "model": "...", "usage": { ... }, "elapsedMs": 8421 }`.
- `stream: true` or `Accept: text/event-stream` — returns `text/event-stream`:

```
event: meta
data: {"model":"hunyuan-2.0-instruct-20251111","roleType":"tech","lang":"en","startedAt":"2026-01-01T00:00:00.000Z"}

event: delta
data: {"content":"## 1. Match diagnosis\n"}

event: delta
data: {"content":"- Score: 78/100 ..."}

event: done
data: {"model":"hunyuan-2.0-instruct-20251111","usage":{"total_tokens":3120},"chars":4210,"elapsedMs":8421}
```

A comment frame `: ping` is sent every 15 seconds to keep idle connections alive. Failures after the
stream has started arrive as `event: error` frames; failures before it arrive as plain JSON.

### Error codes

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Body is not valid JSON |
| 400 | `INVALID_REQUEST` | Missing / empty required field |
| 400 | `TEXT_TOO_LONG` | Text exceeds `MAX_TEXT_CHARS` |
| 400 | `INVALID_BASE64` | Upload payload is not valid base64 |
| 404 | `NOT_FOUND` | Unknown API route |
| 405 | `METHOD_NOT_ALLOWED` | Wrong HTTP verb for the route |
| 413 | `BODY_TOO_LARGE` | Request body over `MAX_BODY_BYTES` |
| 413 | `FILE_TOO_LARGE` | Upload over `MAX_EXTRACT_BYTES` |
| 415 | `UNSUPPORTED_TYPE` | File extension not supported |
| 422 | `EXTRACT_EMPTY` | Extraction produced no text |
| 429 | `UPSTREAM_RATE_LIMITED` | LLM endpoint rate-limited the request |
| 502 | `UPSTREAM_NETWORK` / `UPSTREAM_ERROR` / `UPSTREAM_EMPTY` / `UPSTREAM_INVALID` / `UPSTREAM_STREAM_ERROR` | Upstream transport, status, empty or malformed answer |
| 503 | `NO_API_KEY` | Server has no `LLM_API_KEY` |
| 503 | `EXTRACTOR_UNAVAILABLE` | PDF / DOCX / OCR dependency not installed |
| 504 | `UPSTREAM_TIMEOUT` | No answer within `LLM_TIMEOUT_MS` |
| 499 | `CLIENT_CLOSED` | Browser disconnected (server-side only, not sent to the client) |

## Security model

- **CORS**: only same-origin, `localhost`, `127.0.0.1`, `[::1]`, and `ALLOWED_ORIGINS` are allowed — a random page cannot drive your local server with your API key.
- **Static files**: served only from `public/`, with a `path.relative` containment check and dot-file blocking.
- **Key handling**: the API key stays on the server; logs run through `sanitize()` before printing, so tokens are masked as `***`.
- **Limits**: request bodies, uploads, and prompt text are all bounded; 413 responses close the connection so oversized clients fail fast.
- **Exposure**: bind to `127.0.0.1` (the default). If you deploy it behind a reverse proxy, add authentication yourself — this project has none.

## Deployment notes

- The service is stateless; one process per port is enough.
- For a container or an internal server, set `HOST=0.0.0.0`, keep `ALLOWED_ORIGINS` tight, and terminate TLS at a proxy.
- Optional extractors pull native/heavy dependencies (`tesseract.js` downloads language data on first OCR). Install them only if you need file uploads.

## Agent Skill

`.commandcode/skills/resume-optimizer/SKILL.md` lets an Agent CLI run the same workflow without the
web UI: it documents the input contract, the system prompt, and the expected output shape. The
canonical prompt lives in `prompt.js`; when you change one, update the other so they do not drift.

## Development

```bash
npm run check    # node --check server.js && node --check prompt.js
npm start        # run locally
```

The frontend has no build step: edit `public/index.html`, refresh the page. The server sends
`Cache-Control: no-store` for HTML, so changes appear immediately.

## Roadmap

- [ ] Session history with saved comparisons
- [ ] Multi-turn refinement of a single section
- [ ] DOCX export with real formatting
- [ ] Streaming token / latency metrics in the UI
- [ ] Pluggable prompt profiles for different industries

## License

[MIT](./LICENSE) © echo33550336
