---
name: resume-optimizer
description: Optimize a resume against a target job description (JD). Use when the user asks to optimize/rewrite/improve a resume, tailor a resume to a job posting, diagnose resume-JD match, or generate an optimized resume with STAR-format bullets and match score. Outputs Chinese or English depending on the requested language.
argument-hint: "<company> <position> --jd <jd text or file> --resume <resume text or file> [--lang zh|en]"
license: MIT
metadata:
  author: echo33550336
  version: "1.4.0"
  category: productivity
external_urls:
  - "User-configured LLM endpoint speaking the OpenAI chat-completions protocol (e.g. https://tokenhub.tencentmaas.com; OpenAI itself is optional, never implied)"
compatibility: "Requires an endpoint that speaks the OpenAI chat-completions wire protocol, plus an API key the user provides. The protocol name does not mean OpenAI models are used: the default endpoint/model is Tencent Hunyuan."
---

# Resume Optimizer

A vibecoding workflow that turns a job description + a raw resume into a match-optimized
resume, delivered as a diagnosis, a rewritten resume, change notes, and risk tips.

## When to use

- User pastes a JD and a resume and asks to "optimize", "tailor", "rewrite", or "improve" the resume.
- User asks for a resume-to-JD match score or diagnosis.
- User uploads a resume file (PDF/DOCX/image) and a JD and wants an optimized version.
- User wants STAR-format bullet rewrites with quantified results.

## Inputs

Collect these before running:

1. **Target position** — company + role (e.g. "字节跳动 AI 产品经理").
2. **Job type** — one of: tech, product, data, ops, design, marketing, general. Adjusts optimization focus.
3. **Job description (JD)** — full text. Accept pasted text or extracted from a file (PDF/DOCX/TXT/image via OCR).
4. **Resume** — full text. Accept pasted text or extracted from a file.
5. **Report language** — `zh` or `en` (default: follow the interface language). Controls both the prompt copy and the language of the report; it is independent from the UI language (the web app sends `lang` for the UI and `outputLang` for the report, `auto` = follow the UI).

If any input is missing, ask the user. Do not fabricate resume content.

## System prompt (HR director persona)

> **Source of truth:** the canonical prompt lives in [`prompt.js`](../../../prompt.js)
> (`SYSTEM_PROMPTS.zh` / `SYSTEM_PROMPTS.en`, `ROLE_FOCUS`, `buildSystemPrompt()`, `buildUserPrompt()`,
> `normalizeLang()`, `normalizeOutputLang()`). The web app imports it directly; the copy below is for skill-only/agent usage.
> If you change one, change both — but prefer keeping `prompt.js` authoritative.

Use this system prompt verbatim when calling the LLM:

> 你是一位拥有 10 年经验的互联网行业 HR 总监，擅长根据岗位 JD 优化求职者的简历。
> 你的任务：基于目标岗位的要求，对用户简历进行深度优化，提升匹配度与通过率。
>
> 输出要求（请严格按此结构输出，使用 Markdown）：
>
> ## 一、匹配度诊断
> - 给出 0-100 的匹配度评分，并简要说明理由（3-5 条）。
>
> ## 二、优化后的简历
> 按标准简历结构输出完整优化版本（教育背景、工作/实习经历、项目经历、技能、个人总结等），每条经历用 STAR 法则重写，量化成果，突出与 JD 匹配的关键词。保留真实信息，不编造数据；缺失数据用 [请补充具体数字] 占位。
> 不得改动原文中的任何专有名称：公司、学校、机构、项目、产品、技术栈、奖项、证书、人名一律照抄原写法，不缩写、不翻译、不换说法；只能改描述，不能改名称。
> 不得添加与简历内容无关的文字：不要页眉页脚、装饰标签、口号、口号式括注、免责声明，也不要在页边或段落首尾加「优化版」「匹配度」「仅供参考」这类边角文字。
>
> ## 三、关键修改说明
> 列出最重要的 5-8 处修改，说明"改了什么 + 为什么"。
>
> ## 四、待补充/风险提示
> 指出简历中缺失或需要用户确认的信息。
>
> 语气专业、直接、有建设性。不要输出与简历无关的内容。

## User prompt template

```
请帮我优化简历，我的目标岗位是 {company} 的 {position}。

## 岗位要求（JD）
{jd}

## 我的简历
{resume}
```

## Procedure

1. Gather inputs (company, position, JD, resume). If a file is provided, extract its text first:
   - TXT/MD/CSV → read directly as UTF-8.
   - PDF → extract text (pdf-parse).
   - DOCX → extract raw text (mammoth).
   - Image (PNG/JPG/...) → OCR with tesseract (chi_sim + eng).
2. Build the user prompt from the template; keep the system prompt fixed.
3. Call the LLM (POST `{LLM_API_BASE}/chat/completions`, i.e. the OpenAI wire format) with temperature ~0.7 and enough max_tokens (4096+).
4. Render the result as Markdown: diagnosis → optimized resume → change notes → risk tips.
5. Offer to copy the optimized resume or iterate on a specific section.

## Rules

- Never fabricate resume facts or metrics; use `[请补充具体数字]` placeholders for missing data.
- Preserve the user's real education, companies, and dates.
- **Never rename anything.** Companies, schools, institutions, projects, products, technology names, awards, certificates and people must keep their exact original spelling — no abbreviation, translation, title-casing or "cleaner" wording. Rewrite the description only.
- **Never add meaningless text at the edges.** No headers, footers, decorative labels, slogans, bracketed asides or disclaimers; no "optimised version", "match score", "for reference only" notes around the resume. The output contains the resume (and the four report sections) and nothing else.
- **Keep the original file name.** When saving or exporting a revised resume, reuse the name of the file that was uploaded (e.g. `张三-个人介绍-简历.pdf` stays `...-简历.pdf`); do not append `-optimized`, `-v2`, dates or other suffixes.
- Highlight JD keywords naturally; do not keyword-stuff.
- Keep the tone professional, direct, constructive.
- If the JD and resume are clearly mismatched (score < 40), say so and suggest either a different target role or which gaps to close.

## Web app (optional)

The repo ships a Node.js web app (`server.js` + `prompt.js` + `public/index.html`) that implements
this workflow with a UI: landing page, optimizer form with drag-and-drop upload, streaming Markdown
output with stop/copy/download/print, theme/font/background switcher. Run with `npm start`
(default `http://127.0.0.1:3000`). Configure the LLM via `.env` (any endpoint speaking the OpenAI
chat-completions protocol; the default is Tencent Hunyuan, not OpenAI).

The server also accepts `roleType` (tech/product/data/ops/design/marketing/general) and appends the
matching focus hints from `prompt.js`; keep that behaviour when reusing this skill outside the app.

## Output format

Return the LLM's Markdown output verbatim, then a one-line summary of the biggest improvement.
If the user wants edits, regenerate only the affected section.