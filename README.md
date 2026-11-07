# Resume Optimizer · Vibecoding

> An AI-powered resume optimization system that tailors your resume to a target job
> description (JD). Built as a Vibecoding project.

[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Overview

**Resume Optimizer** is a full-stack web application that takes a target job posting and
your raw resume, then uses a large language model (acting as a 10-year-experience HR
director) to produce:

1. A **match score** (0–100) between your resume and the JD, with concrete reasons.
2. A **fully rewritten resume** in standard structure, with every experience rewritten
   using the STAR method and quantified results, highlighting JD-matched keywords.
3. **Key change notes** — the top 5–8 edits and why each was made.
4. **Risk tips / gaps** — missing information and things to confirm.

The goal is not just to rephrase wording, but to systematically align your resume with
the target role so it passes both ATS filters and human reviewers.

## Features

- **JD-driven optimization** — paste the full job description and your resume; the AI
  diagnoses the match and rewrites accordingly.
- **Multi-format input** — paste text or upload files: TXT, Markdown, CSV, PDF, DOCX, and
  images (PNG/JPG/WEBP/BMP/TIFF). Text is extracted automatically (OCR for images).
- **Match score & diagnosis** — quantitative 0–100 score with 3–5 supporting reasons.
- **STAR-format rewrites** — every bullet rewritten with Situation-Task-Action-Result and
  quantified outcomes; missing data is marked with `[请补充具体数字]` placeholders.
- **Multi-theme UI** — Gold / Amber Gold / Dark Gold themes, with selectable fonts and
  background patterns (none, dots, grid, image).
- **Personal brand logo** — custom SVG logo ("职优简历").
- **Privacy-first** — resumes are transmitted only between your browser and the LLM;
  nothing is stored server-side.
- **Zero-framework frontend** — vanilla HTML/CSS/JS, no build step.
- **Agent Skill included** — ships a `resume-optimizer` skill (`.commandcode/skills/`) so
  any Agent-Skills-compatible agent can run the workflow.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Backend | Native `http` module (zero framework), REST endpoints |
| Frontend | Vanilla HTML / CSS / JavaScript (no build step) |
| LLM | OpenAI-compatible chat/completions (default: Tencent Hunyuan 2.0 Instruct) |
| PDF parsing | `pdf-parse` |
| DOCX parsing | `mammoth` |
| Image OCR | `tesseract.js` (chi_sim + eng) |
| Markdown rendering | Custom client-side renderer |
| Theming | CSS custom properties + `localStorage` |
| Config | `.env` (dotenv-style, parsed manually) |

## Project Structure

```
resume-optimization/
├── server.js                 # Node.js backend (static + /api/optimize + /api/extract)
├── package.json
├── .env                      # LLM config (gitignored)
├── .env.example              # Config template
├── .gitignore
├── README.md
├── public/
│   ├── index.html            # Single-page app (landing + optimizer + settings)
│   ├── logo.svg              # Brand logo
│   └── bg.svg                # Background image
└── .commandcode/
    └── skills/
        └── resume-optimizer/
            └── SKILL.md      # Agent skill definition
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- An OpenAI-compatible LLM endpoint and API key

### Installation

```bash
git clone https://github.com/echo33550336/Resume-optimization.git
cd Resume-optimization
npm install
```

### Configuration

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

```env
LLM_API_KEY=your_api_key_here
LLM_API_BASE=https://tokenhub.tencentmaas.com/v1
LLM_MODEL=hunyuan-2.0-instruct-20251111
LLM_MAX_TOKENS=4096
PORT=3000
```

Any OpenAI-compatible endpoint works (Hunyuan, DeepSeek, OpenAI, etc.) — just adjust
`LLM_API_BASE`, `LLM_API_KEY`, and `LLM_MODEL`.

### Run

```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Usage

1. **Landing page** — overview of capabilities, tech stack, and highlights.
2. **Optimizer page** — fill in company, position, JD, and resume (paste text or upload
   a file via the 📎 button).
3. Click **开始优化简历** — the AI returns a structured optimization.
4. **Copy** the result or iterate on a section.
5. Open **⚙ settings** to switch theme (Gold / Amber Gold / Dark Gold), font, and
   background pattern.

### Supported file types for upload

| Type | Extension | Extractor |
|------|-----------|-----------|
| Plain text | `.txt`, `.md`, `.csv` | Direct UTF-8 read |
| PDF | `.pdf` | `pdf-parse` |
| Word | `.docx` | `mammoth` |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`, `.tiff` | `tesseract.js` OCR (chi_sim + eng) |

## API

### `POST /api/optimize`

```json
{
  "company": "字节跳动",
  "position": "AI 产品经理",
  "jd": "...",
  "resume": "...",
  "model": "hunyuan-2.0-instruct-20251111"
}
```

Returns `{ "content": "...", "model": "...", "usage": {...} }`.

### `POST /api/extract`

```json
{ "filename": "resume.pdf", "data": "<base64>" }
```

Returns `{ "text": "..." }`.

### `GET /api/health`

Returns `{ "ok": true, "model": "...", "hasKey": true, "extractors": {...} }`.

## Agent Skill

The workflow is also packaged as an Agent Skill at
`.commandcode/skills/resume-optimizer/SKILL.md`. Any agent implementing the Agent Skills
standard can load it via `/resume-optimizer`. It contains the full system prompt, user
prompt template, extraction rules, and output contract.

## License

MIT