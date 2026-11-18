# 发布文案草稿（可直接复制 / 微调）

发布前请先完成：仓库 **About 描述 + Topics**、**社交预览图**、**README 首屏 GIF**（见 [recording-guide.md](./recording-guide.md)）。

原则：一次只发一个渠道，观察 24 小时数据再发下一个；所有文案都要**说清楚你是作者**，不要伪装成用户推荐。

## 0. 现状（2026-11-18 核对）

已就绪，可直接用：

| 项目                          | 状态                          | 链接 / 命令                                                                                             |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Pages 在线演示（免 Key 回放） | ✅ 200                        | <https://echo33550336.github.io/Resume-optimization/>                                                   |
| 社交预览图 1280×640           | ✅ 已上传（哈希与本地图一致） | 仓库页 `og:image`                                                                                       |
| README 首屏 GIF + 4 张截图    | ✅ 已提交                     | `docs/assets/demo.gif`                                                                                  |
| GHCR 镜像                     | ✅ `1.5.0` / `1.5` / `latest` | `docker run --rm -p 127.0.0.1:3000:3000 --env-file .env ghcr.io/echo33550336/resume-optimization:1.5.0` |
| 中文 README                   | ✅                            | `README.zh-CN.md`                                                                                       |

还需本人网页操作（AI 无 token 无法代做）：

- [ ] About → Homepage 填 `https://echo33550336.github.io/Resume-optimization/`
- [ ] About → Topics 填 `resume, resume-builder, llm, streaming, sse, nodejs, self-hosted, bilingual, ats, docker`
- [ ] 建 Release `v1.5.0`（tag 已推送，正文见下）

**所有渠道文案都建议带上 demo 链接**——不用装、不用 key，点开就能看到流式生成，这是转化率最高的一行。

---

## 1. Show HN（英文，首选）

**发布时间**：周二至周四，美东 8:00–10:00（= 北京 20:00–22:00 前后）。

**标题**

> Show HN: Open-source resume optimizer that streams from any LLM endpoint

**正文**

```text
Hi HN — I built a small, self-hosted tool that rewrites a resume against one specific job
description and shows its reasoning first.

It asks for a JD + resume, then a model acting as a senior HR director returns a four-part
report: a match score with justification, the rewritten resume in STAR form, a change log,
and the gaps a recruiter will probe. Output streams over SSE so you can stop at any point.

Why self-host it: a resume is one of the most personal documents people have. This runs as a
single Node process with no framework, no database, and no telemetry. Your resume goes only to
the model endpoint you configure in .env (Tencent Hunyuan by default; anything speaking the
chat-completions protocol works).

The backend is one ~700-line file. No Express, no build step. I added type checking (JSDoc +
tsc), ESLint/Prettier, 23 tests (including integration tests that spawn the real server), a CI
matrix (Node 18/20/22 + Docker), and a non-root container.

Known limitations: no auth (bind to localhost), the report quality depends on your model, and
uploads need optional extractors (pdf-parse / mammoth / tesseract.js).

Try it without installing anything: https://echo33550336.github.io/Resume-optimization/ (demo
mode replays a canned report over the same SSE stream, no API key needed).

Repo: https://github.com/echo33550336/Resume-optimization
Happy to answer anything about the prompt design or the SSE plumbing.
```

**要点**：标题不吹、"why self-host" 讲清动机、主动说局限（HN 讨厌自吹）。

---

## 2. Reddit（英文）

先读版规。`r/selfhosted`、`r/SideProject`、`r/opensource` 各发一次，**间隔至少 2–3 天**。

**标题**

> Self-hosted resume optimizer – one Node file, streams from your own LLM endpoint

**正文**

```text
A resume is private, so I didn't want to paste it into yet another web service that will
eventually paywall the export button. This runs locally as one Node process.

Flow: paste JD + resume → a model acts as a hiring-manager-style reviewer → four-part report
(score with reasons, rewritten resume, change log, gaps) streamed token by token, stoppable
mid-way, export as text/Markdown/PDF.

Deployment: `docker run -p 127.0.0.1:3000:3000 --env-file .env ghcr.io/echo33550336/resume-optimization:latest`
Config: LLM_API_BASE + LLM_MODEL (defaults to Tencent Hunyuan; any chat-completions endpoint works).
No auth by design — it binds to 127.0.0.1 and expects a reverse proxy if you expose it.

Try it without deploying: https://echo33550336.github.io/Resume-optimization/ (demo mode, no key).

Code: https://github.com/echo33550336/Resume-optimization (MIT)
Feedback welcome, especially on the prompt structure and what to add next.
```

---

## 3. V2EX「分享创造」（中文，首选中文渠道）

**标题**

> [分享创造] 自托管的简历优化器：一份 JD + 一份简历，边生成边看，可随时停

**正文**

```text
最近在帮朋友改简历，发现两个痛点：网上的简历工具要把简历传上去、导出还要付费；直接丢给
ChatGPT 又总是"帮我润色一下"，没有评分、没有改动理由，还容易给你编一段不存在的经历。

所以写了个小工具，单文件 Node 服务、零框架、可自托管：
- 输入 JD + 简历，模型扮演资深 HR 总监，先给 0-100 匹配分和理由，再重写简历（STAR、量化、
  对齐 JD 关键词，缺数字就写占位符而不是编），然后给 5-8 条修改清单和"面试官会追问的缺口"
- 输出是 SSE 流式的，边生成边读，随时能停；支持复制 Markdown、下载 .md、打印成 PDF
- 支持拖 PDF / DOCX / 图片（OCR）进来
- 中英双语界面，报告语言可以独立选（界面中文、报告英文都行）
- 模型用你自己的 key，默认腾讯混元，改两行 .env 就能换别的兼容端点

一行命令起：
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env \
  ghcr.io/echo33550336/resume-optimization:latest

没装环境也能先看：https://echo33550336.github.io/Resume-optimization/ （免 Key 的 demo 回放，
同一套 SSE 流式输出，点开就能看到效果）

仓库（MIT）：https://github.com/echo33550336/Resume-optimization
只有 1 star，欢迎试用和拍砖；如果对 prompt 设计或 SSE 实现感兴趣，可以看 prompt.js 和
server.js，都是单文件。
```

**注意**：V2EX 不喜欢营销味，正文要像"做东西的过程分享"。

---

## 4. 掘金 / 知乎（技术文，长期 SEO）

**标题候选**

1. 《零框架 Node 做流式 AI 应用：SSE、断线重连与错误分类》
2. 《一个 700 行的 Node 服务，如何接任何大模型：chat-completions 协议的边界在哪》
3. 《自研 i18n：没有 React，也要做中英双语界面》

**文章大纲**

1. 起因：为什么不直接用 ChatGPT 改简历
2. 架构：单文件 backend + 静态 UI，为什么零框架反而更好维护
3. SSE 转发：为什么服务端要自己解析上游流、心跳、客户端断开检测、`emitted` 之后不再重试
4. 错误分类：502/504/429/499 各自对应用户看到的什么话
5. prompt 单一来源：`prompt.js` + Agent Skill 不漂移
6. 工程化：JSDoc + tsc、ESLint、23 个测试（含真实 spawn 服务的集成测试）、CI 矩阵
7. 踩坑：`node --test test/` 在 Node 22 上把目录当模块
8. 数据：用混元跑一次大概多少 token、多少钱

**投放**：掘金 + 知乎同发；知乎问题下回答要带具体实现细节，不带"快来看我的项目"。
文末统一放：demo <https://echo33550336.github.io/Resume-optimization/> + repo <https://github.com/echo33550336/Resume-optimization>。

---

## 5. 小红书（中文，流量最大但最"软"）

**标题**

> 投了 200 份简历没回音？我做了个工具，先给简历打分再改

**正文**

```text
秋招/春招被简历卡住的同学看这里 👇
我把"HR 视角看简历"这件事做成了工具：贴 JD + 简历 → 先给 0-100 匹配分和理由，再逐条重写，
改成 STAR 结构、量化成果、对齐 JD 关键词，缺数据的地方会写"[补充数字]"而不是瞎编。

重点：它会告诉你面试官会追问什么（缺口与风险那一栏），比单纯"润色一下"有用得多。

可以自己部署（数据不上传第三方），也可以用 Docker 一行起。
先看效果（免 Key demo）：https://echo33550336.github.io/Resume-optimization/
前后对比截图我放在评论区 👀
```

配图：**改前 / 改后 / 诊断分数** 三联图（比任何文字都有效）。标签：#简历 #秋招 #春招 #求职 #AI工具 #简历优化

---

## 6. X / Twitter（英文短线程）

```text
1/ I built a self-hosted resume optimizer because pasting my resume into another web app
   that will paywall "export" one day felt wrong.

2/ Input: a JD + a resume. Output: a 4-part report — match score with reasons, STAR rewrite,
   change log, gaps — streamed token by token over SSE, stoppable any time.

3/ One Node file. No Express, no build step, no DB, no telemetry. Your resume only reaches the
   model endpoint you configure (.env, Hunyuan by default).

4/ Docker: ghcr.io/echo33550336/resume-optimization:latest
   Live demo (no key): https://echo33550336.github.io/Resume-optimization/
   Code (MIT): https://github.com/echo33550336/Resume-optimization
```

---

## 7. 发布节奏建议

| 天       | 动作                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| D-1      | ✅ 已完成：About 描述、社交预览、GIF/截图、Pages demo、GHCR；⏳ 待做：About 的 Topics/Homepage、Release v1.5.0 |
| D1       | V2EX 分享创造（中文首站，选题最贴）                                                                            |
| D2       | 掘金 + 知乎技术文（吃 SEO，长期流量）                                                                          |
| D4       | Show HN（美东 8:00–10:00，当天回所有评论）                                                                     |
| D6       | r/selfhosted                                                                                                   |
| D8       | X 线程 + 小红书（配前后对比图）                                                                                |
| 之后每周 | 回 issue、收集反馈、打 release、PR 进 awesome-selfhosted                                                       |

---

## 8. GitHub Release `v1.5.0` 正文（复制粘贴）

仓库 → **Releases** → **Draft a new release** → 选 tag `v1.5.0` → 标题

> v1.5.0 — demo mode, media, Docker

正文：

````markdown
Demo mode (no API key), recorded GIF and screenshots, a static GitHub Pages demo,
and container publishing on tags.

### Added

- `demo: true` on `/api/optimize` replays a canned report over the same SSE stream
- "Try a demo (no key)" button and `?demo=1` deep link in the UI
- Recorded demo GIF, four screenshots and a 1280x640 social preview image
- Static demo page for GitHub Pages (`docs/`, no build step)
- GHCR publishing on tags; Docker Hub workflow runs once `DOCKERHUB_TOKEN` is set

### Quality

- 23 tests (prompt, i18n, demo report, integration against a spawned server)
- `tsc --noEmit` on JSDoc-typed JS, ESLint + Prettier, CI on Node 18/20/22 + Docker image build

### Install

```bash
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env \
  ghcr.io/echo33550336/resume-optimization:1.5.0
```
````

**Full changelog:** https://github.com/echo33550336/Resume-optimization/compare/v1.4.0...v1.5.0

```

```
