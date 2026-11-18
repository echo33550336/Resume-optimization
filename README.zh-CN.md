# Resume Optimizer · 简历优化器

> 把一份 JD 和一份简历，变成一次**针对该岗位的重写**：模型扮演资深 HR 总监，先诊断、再改稿，结果边生成边显示。单文件 Node 服务、零框架、可自托管，数据不经过任何第三方服务器。

**中文** | [English](README.md)

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![CI](https://github.com/echo33550336/Resume-optimization/actions/workflows/ci.yml/badge.svg)](https://github.com/echo33550336/Resume-optimization/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](./Dockerfile)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Backend](https://img.shields.io/badge/backend-zero--framework-black)](server.js)
[![Model](https://img.shields.io/badge/model-bring--your--own-informational)](#模型是哪来的)
[![Streaming](https://img.shields.io/badge/output-SSE-purple)](#主要特性)

---

## 这是什么

粘贴（或上传）岗位描述和你的简历，选岗位类别，点一次「开始优化」，模型会返回一份四段式报告：

1. **匹配诊断** —— 0–100 的匹配分，以及每一分的理由。
2. **重写后的简历** —— 用 STAR 结构重写，量化成果、对齐 JD 关键词、保持真实（缺数字的地方写成 `[补充数字]` 占位符，而不是编造）。
3. **修改清单** —— 最重要的 5–8 处改动，以及每处改动为什么重要。
4. **缺口与风险** —— 面试官一定会追问、但简历里还没回答的信息。

核心不是"帮我润色几条 bullet"，而是 **先诊断、后重写**：模型必须先解释分数，再展示哪些文字抬高了分数，最后指出还缺什么。整段文本以 SSE 流式吐到页面上，三千 token 的重写可以边生成边读，随时可停。

## 和常见方案的区别

| 方案                       | 数据在哪                                                 | 输出结构                 | 缺点                                 |
| -------------------------- | -------------------------------------------------------- | ------------------------ | ------------------------------------ |
| 在线简历优化网站           | 上传到对方服务器，通常要付费                             | 无固定结构               | 简历属于高度隐私数据                 |
| 直接问 ChatGPT"帮我改简历" | 在对话里                                                 | 全靠 prompt 自由发挥     | 没有评分、没有改动理由、容易编造经历 |
| **本项目**                 | **只发给你自己配置的模型端点**，服务本身无数据库、无遥测 | 固定四段 + 流式 + 可停止 | 需要自备一个模型 API key             |

## 模型是哪来的

**由你配置的模型端点决定，默认是腾讯混元（Tencent Hunyuan）。本仓库不附带任何模型权重，不内置 OpenAI SDK，也不需要 OpenAI 账号；只有你自己把 `LLM_API_BASE` 指向 OpenAI，才会调用 OpenAI。**

README 里出现 "OpenAI-compatible"，指的是**报文格式**，不是厂商：

- `POST {LLM_API_BASE}/chat/completions`，带 `Authorization: Bearer <key>`
- 请求体 `{ model, messages, temperature, max_tokens, stream }`
- 非流式响应取 `choices[0].message.content`；流式响应是 SSE 的 `data: {...}` 帧

这个格式被几乎所有模型厂商兼容，所以同一份代码可以接混元、DeepSeek、通义、OpenAI、Claude 网关……具体用哪个模型，只由 `.env` 里的 `LLM_API_BASE` + `LLM_MODEL` 决定，源码里没有任何厂商绑定。

## 主要特性

- **JD 对齐重写** —— 每条 bullet 都对着目标岗位重写，STAR 化、量化。
- **流式输出（SSE）** —— 边生成边渲染；随时能停，停下后已生成的部分保留。
- **停止与导出** —— 停止生成、复制纯文本、复制 Markdown、下载 `.md`、打印或另存 PDF。
- **多格式输入** —— 粘贴文本，或把 PDF / DOCX / TXT / MD / CSV / 图片（OCR）拖进 JD 或简历框。
- **岗位类别聚焦** —— 技术 / 产品 / 数据 / 运营 / 设计 / 市场 / 通用，每类有不同的优化侧重。
- **中英双语界面** —— 一个按钮切换全部文案，选择记在 `localStorage`。
- **报告语言独立** —— 界面是中文也能让模型用英文写报告，反之亦然（跟随界面 / 中文 / English）。
- **零框架后端** —— 只有一个 `server.js`，没有 Express、没有构建步骤、没有数据库。
- **工程化齐备** —— TypeScript(JSDoc) 类型检查、ESLint + Prettier、19 个单元/集成测试、GitHub Actions 矩阵（Node 18/20/22 + Docker 构建）、非 root 容器镜像。

## 工作流程

```text
浏览器（单页 UI，中英双语）
   │  粘贴 / 拖拽文件
   ├──► POST /api/extract   ──► 解析 PDF / DOCX / 图片 OCR，返回纯文本
   └──► POST /api/optimize  ──► 拼装 prompt（prompt.js，唯一来源）
                                   │
                                   ▼
                        POST {LLM_API_BASE}/chat/completions
                                   │  SSE delta 逐段回传
                                   ▼
                        页面边收边渲染（可随时停止）
```

## 技术栈

| 层       | 选择                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| 后端     | Node.js ≥ 18，原生 `http` + 全局 `fetch`，零框架                                 |
| 前端     | 单个静态 HTML + 原生 JS，无构建、无框架                                          |
| 流式     | 服务端转发 SSE，前端手工解析帧                                                   |
| 模型     | 任意兼容 chat-completions 的端点，默认腾讯混元                                   |
| 文件解析 | `pdf-parse`、`mammoth`、`tesseract.js`（可选安装）                               |
| 工程化   | JSDoc + `tsc --noEmit`、ESLint 10、Prettier、`node:test`、GitHub Actions、Docker |
| 国际化   | `public/i18n.js` 自研字典 + `data-i18n` 属性，零依赖                             |

## 目录结构

```text
Resume-optimization/
├── server.js              # 唯一后端：路由、限流、LLM 调用、SSE 转发
├── prompt.js              # 提示词唯一来源（中英双语 + 岗位类别 + 输出语言）
├── public/
│   ├── index.html         # 单页 UI（结构 + 样式 + 交互）
│   ├── i18n.js            # 中英字典与运行时切换
│   ├── logo.svg
│   └── bg.svg
├── test/                  # node:test 单元与集成测试
├── docs/                  # 录制与发布素材指南
├── .github/workflows/     # CI 与容器镜像发布
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

## 快速开始

### 方式一：用现成镜像（最快）

```bash
# 1. 准备配置
cp .env.example .env      # 填入 LLM_API_KEY（默认端点就是腾讯混元）

# 2. 拉镜像并启动
docker pull ghcr.io/echo33550336/resume-optimization:latest
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env \
  ghcr.io/echo33550336/resume-optimization:latest
```

打开 <http://127.0.0.1:3000> 即可。

### 方式二：本地跑源码

```bash
git clone https://github.com/echo33550336/Resume-optimization.git
cd Resume-optimization

npm install              # 可选：只有需要解析 PDF / DOCX / 图片时才要
cp .env.example .env     # 然后填 LLM_API_KEY（不是混元的话再改 LLM_API_BASE / LLM_MODEL）

npm start                # http://127.0.0.1:3000
```

不装 `npm install` 也能用：粘贴文本正常，上传文件会明确提示"解析器未安装"，`GET /api/health` 会列出哪些解析器可用。

### 最小 `.env`

默认就指向腾讯混元，所以多数情况下**只需要一个 key**：

```dotenv
LLM_API_KEY=your-key
LLM_API_BASE=https://tokenhub.tencentmaas.com/v1        # 默认：腾讯混元
LLM_MODEL=hunyuan-2.0-instruct-20251111                 # 默认模型
# 想换 OpenAI 再取消下面两行注释（可选，不是默认）：
# LLM_API_BASE=https://api.openai.com/v1
# LLM_MODEL=gpt-4o-mini
```

## 配置

所有配置都可以来自 `.env` 或真实环境变量（真实环境变量优先）：

| 变量                | 默认值                                | 说明                                                       |
| ------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `LLM_API_KEY`       | —                                     | 端点 Bearer Token（**必填**）                              |
| `LLM_API_BASE`      | `https://tokenhub.tencentmaas.com/v1` | 兼容 chat-completions 协议的 Base URL（是格式，不是厂商）  |
| `LLM_MODEL`         | `hunyuan-2.0-instruct-20251111`       | 默认模型                                                   |
| `LLM_MAX_TOKENS`    | `4096`                                | 最大输出 token                                             |
| `LLM_TIMEOUT_MS`    | `120000`                              | 单次请求超时（最小 5000）                                  |
| `LLM_RETRIES`       | `2`                                   | 429 / 5xx / 网络错误的自动重试次数（仅在还没向前端吐字前） |
| `PORT`              | `3000`                                | 监听端口                                                   |
| `HOST`              | `127.0.0.1`                           | 监听地址，默认只允许本机                                   |
| `MAX_BODY_BYTES`    | `20971520`（20 MB）                   | JSON 请求体上限                                            |
| `MAX_EXTRACT_BYTES` | `20971520`（20 MB）                   | 上传文件上限                                               |
| `MAX_TEXT_CHARS`    | `60000`                               | JD / 简历 / 提取文本的字符上限                             |
| `ALLOWED_ORIGINS`   | —                                     | 额外允许的 CORS 来源，逗号分隔（localhost 始终允许）       |

完整说明见 [.env.example](./.env.example)。

## 使用

1. 打开 <http://127.0.0.1:3000>，点「优化简历」。
2. 填公司、岗位，粘贴 JD 和简历——或者直接把文件拖进两个输入框。
3. 选岗位类别（会改变模型的侧重）、模型，以及**报告语言**（跟随界面 / 中文 / English）。
4. 点「开始优化」，结果流式出现；「停止」可中断，工具栏支持复制文本、复制 Markdown、下载 `.md`、打印。
5. 「设置」里可换主题、字体、背景，选择保存在本地。

快捷键：`Ctrl / Cmd + Enter` 提交，`Esc` 关闭设置面板。

### 界面与多语言

页面右上角的 **ZH / EN** 切换会翻译整个界面（落地页、表单、结果工具栏、设置、提示、错误信息）。**报告语言**下拉独立于界面语言：选「跟随界面」时与界面同步，也可以固定成中文或英文——服务端据此决定给模型的中文 / 英文提示词与四段式标题。

## API 速查

所有 JSON 接口成功返回 `{ "ok": true, ... }`，失败返回 `{ "ok": false, "code": "...", "error": "..." }`。

| 接口                 | 作用                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`    | 服务状态、当前模型、是否有 key、可用解析器、限制值、支持的语言                                                                   |
| `POST /api/extract`  | `{ filename, data(base64) }` → `{ text, meta }`，支持 txt/md/csv/pdf/docx/图片                                                   |
| `POST /api/optimize` | `{ company, position, jd, resume, roleType, model, lang, outputLang }`；`stream: true` 或 `Accept: text/event-stream` 时返回 SSE |

SSE 事件依次为 `meta`（模型 / 报告语言）→ 多个 `delta`（增量文本）→ `done`（用量与耗时）；出错时发 `error`。完整字段、错误码（16 个）与流式细节见英文版 [API 章节](README.md#api)。

## 安全模型

- **CORS**：只允许同源、`localhost`、`127.0.0.1`、`[::1]` 以及你显式配置的 `ALLOWED_ORIGINS`——随便一个网页无法借用你的 key 驱动本地服务。
- **静态文件**：只从 `public/` 提供，带 `path.relative` 包含性校验，并拦截点开头的文件。
- **Key 处理**：API key 只留在服务端；日志统一经过 `sanitize()`，token 一律显示为 `***`。
- **限额**：请求体、上传体积、文本长度都有上限；413 会主动断开连接，避免超大请求拖垮进程。
- **暴露面**：默认只绑定 `127.0.0.1`。**如果要放到公网，请自己在反向代理上加鉴权——本项目没有任何登录机制。**

## 部署

- 服务无状态，一个进程配一个端口即可。
- 容器或内网服务器上，设 `HOST=0.0.0.0`、收紧 `ALLOWED_ORIGINS`，并在代理层做 TLS。
- 可选解析器依赖较重（`tesseract.js` 首次 OCR 会下载语言数据），不需要文件上传就别装。

```bash
cp .env.example .env      # 填入 LLM_API_KEY / LLM_API_BASE / LLM_MODEL
docker compose up -d --build
```

镜像只安装生产依赖、以非 root 的 `node` 用户运行，并带 `HEALTHCHECK` 轮询 `/api/health`。

## 开发与质量门禁

```bash
npm run ci        # check → typecheck → lint → format:check → test
npm run test      # 19 个测试：提示词 7 + i18n 4 + 服务集成 8
npm run typecheck # tsc --noEmit（JSDoc 类型）
```

集成测试会真实启动服务（端口 3400–3459 依次尝试）并配一个本地 mock LLM，不消耗任何 API 额度。

## 常见问题

<details>
<summary>没有 API key 能不能先看看效果？</summary>

界面能打开，但生成需要 key。最省事的做法是拿一个腾讯混元的 key（`LLM_API_BASE` 默认就是它），或者任何兼容 chat-completions 的端点。

</details>

<details>
<summary>会上传我的简历吗？</summary>

服务本身没有数据库、没有遥测；简历只作为 prompt 的一部分，发给你自己配置的那个模型端点。

</details>

<details>
<summary>能换成 GPT / DeepSeek / 通义 / Claude 吗？</summary>

改 `.env` 两行即可（`LLM_API_BASE` + `LLM_MODEL`）。只要对方兼容 chat-completions 的报文格式就行。

</details>

<details>
<summary>支持哪些文件格式？</summary>

TXT / MD / CSV 直接读；PDF 用 `pdf-parse`；DOCX 用 `mammoth`；图片走 `tesseract.js` OCR（中文 + 英文）——这三种需要先 `npm install`。

</details>

<details>
<summary>能部署到服务器给同事用吗？</summary>

可以，但请自己在反向代理上加认证，并把 `ALLOWED_ORIGINS` 收紧到实际域名。默认只监听本机就是出于这个考虑。

</details>

## 路线图

- [ ] 一键部署模板（Railway / Fly.io / Sealos）
- [ ] 简历版本历史与对比
- [ ] 更多输出模板（不同行业 / 校招 / 社招）
- [ ] 可选的真实 token 计费统计

## 许可

[MIT](./LICENSE)
