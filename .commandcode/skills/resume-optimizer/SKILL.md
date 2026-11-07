---
name: resume-optimizer
description: Optimize a resume against a target job description (JD). Use when the user asks to optimize/rewrite/improve a resume, tailor a resume to a job posting, diagnose resume-JD match, or generate an optimized resume with STAR-format bullets and match score.
argument-hint: "<company> <position> --jd <jd text or file> --resume <resume text or file>"
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
2. **Job description (JD)** — full text. Accept pasted text or extracted from a file (PDF/DOCX/TXT/image via OCR).
3. **Resume** — full text. Accept pasted text or extracted from a file.

If any input is missing, ask the user. Do not fabricate resume content.

## System prompt (HR director persona)

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
3. Call the LLM (OpenAI-compatible chat/completions) with temperature ~0.7 and enough max_tokens (4096+).
4. Render the result as Markdown: diagnosis → optimized resume → change notes → risk tips.
5. Offer to copy the optimized resume or iterate on a specific section.

## Rules

- Never fabricate resume facts or metrics; use `[请补充具体数字]` placeholders for missing data.
- Preserve the user's real education, companies, and dates.
- Highlight JD keywords naturally; do not keyword-stuff.
- Keep the tone professional, direct, constructive.
- If the JD and resume are clearly mismatched (score < 40), say so and suggest either a different target role or which gaps to close.

## Web app (optional)

The repo ships a zero-dependency Node.js web app (`server.js` + `public/index.html`) that implements
this workflow with a UI: landing page, optimizer form with file upload, theme/font/background
switcher, and Markdown result rendering. Run with `npm start` (default port 3000). Configure the
LLM via `.env` (OpenAI-compatible endpoint).

## Output format

Return the LLM's Markdown output verbatim, then a one-line summary of the biggest improvement.
If the user wants edits, regenerate only the affected section.