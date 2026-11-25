# 上手指南：从 clone 到出报告（5 分钟）

> 面向第一次 clone 本仓库的人。README 讲「是什么」，这篇讲「怎么用起来」。
> 不想看文字？打开 <https://echo33550336.github.io/Resume-optimization/> 先看 5 秒演示。

## 0. 环境要求

| 需要 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18 | 唯一运行时依赖（用到内置 `fetch`）；跑 `scripts/capture.js` 截图管线需要 ≥ 22 |
| npm 依赖 | 可选 | 只为解析 PDF / DOCX / 图片 OCR（mammoth / pdf-parse / tesseract.js） |
| Docker | 可选 | 想用容器方式跑才需要 |

## 1. 三步跑起来

```bash
git clone https://github.com/echo33550336/Resume-optimization.git
cd Resume-optimization

npm install              # 可选：只有需要解析 PDF / DOCX / 图片时才要
cp .env.example .env     # 打开 .env 填入 LLM_API_KEY

npm start                # http://127.0.0.1:3000
```

浏览器打开 <http://127.0.0.1:3000>，右上角会显示运行状态（有 key / 离线模式）。

> 不装 `npm install` 也能用：粘贴文本完全正常，上传文件会提示「解析器未安装」，
> `GET /api/health` 会列出哪些解析器可用。

## 2. 配置 key（也可以先不配）

默认端点就是腾讯混元，多数情况下**只需要一个 key**：

```dotenv
LLM_API_KEY=your-key
LLM_API_BASE=https://tokenhub.tencentmaas.com/v1        # 默认：腾讯混元
LLM_MODEL=hunyuan-2.0-instruct-20251111                 # 默认模型
```

想换厂商？任何讲 OpenAI chat-completions 协议的端点都行（这是协议格式，不是厂商绑定）：

```dotenv
# 例如换成 OpenAI：
LLM_API_BASE=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

**没有 key 也能玩：**

- **离线模式** —— 留空 `LLM_API_KEY`，服务端用本地规则引擎出四段报告（词法/结构分析，不联网）；模型调用失败时也会自动回退到它。
- **演示模式** —— 打开 <http://127.0.0.1:3000/?demo=1> 或点「试试演示（无需 Key）」，回放一份预置报告，走同一条 SSE 流式管线。

## 3. 生成你的第一份报告

1. **贴 JD** —— 把目标岗位的职位描述粘进左卡（试试顶部的示例按钮）。
2. **贴简历** —— 完整简历粘进右卡；或直接把 `pdf / docx / 图片` 拖进上传区（≤ 20MB，图片走 OCR，支持中英）。
3. **选参数** —— 岗位类别（General / Tech / Product / Data / Ops / Design / Marketing）、模型、报告语言（可以和界面语言不同）。
4. **开始** —— 点「开始优化」或按 `Ctrl/Cmd + Enter`。
5. **看流式输出** —— 结果页实时滚动：四段流水线（诊断 → 重写 → 说明 → 风险）、匹配分环形图、字数/耗时统计。
6. **导出** —— 复制文本 / 复制 Markdown / 下载 `.md` / 打印 PDF（打印样式只输出报告本身）。

随时可以「停止」中断流；重新点开始会覆盖上一次结果。

## 4. 安装为桌面 / 手机 App（PWA）

- **桌面 Chrome / Edge**：地址栏右侧出现安装图标，点它；或用应用页头出现的「安装应用」按钮。
- **Android**：浏览器菜单 → 「安装应用 / 添加到主屏幕」。
- **iOS**：Safari 分享菜单 → 「添加到主屏幕」。
- 安装后以独立窗口运行，应用外壳离线也能打开；生成报告当然仍需要能访问你的 LLM 端点。
- 手机经局域网 IP（http://）无法安装 PWA，需要 HTTPS 域名（或用端口转发工具）。

## 5. 界面个性化

右上角齿轮打开设置：

- 3 套主题（暖纸白 / 琥珀金 / 暗金）× 4 种字体 × 4 种背景纹理；
- 中英界面一键切换；
- 所有偏好记忆在浏览器 `localStorage`，刷新不丢。

## 6. Docker 方式

```bash
# 用现成镜像（最快）
cp .env.example .env                                   # 填 LLM_API_KEY
docker pull ghcr.io/echo33550336/resume-optimization:latest
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env \
  ghcr.io/echo33550336/resume-optimization:latest

# 或本地构建 / compose
docker compose up --build
```

## 7. 更新到最新版

```bash
git pull && npm install && npm start     # 源码方式
docker pull ghcr.io/echo33550336/resume-optimization:latest   # 镜像方式
```

## 8. 常见问题

| 问题 | 处理 |
| --- | --- |
| 端口被占用 | `.env` 里改 `PORT=3001` |
| 想让局域网其他设备访问 | `.env` 里改 `HOST=0.0.0.0`，开放防火墙对应端口 |
| 上传提示「解析器未安装」 | 跑 `npm install` 后重启 |
| 担心隐私 | 密钥只存在本机 `.env`；唯一外发请求是到你配置的 `LLM_API_BASE`；除此之外一切都在本地 |
| 报告语言想固定英文 | 表单里把「报告语言」选成 English（与界面语言无关） |
| 文字被截断 | JD / 简历各有 `MAX_TEXT_CHARS=60000` 上限（`.env` 可调） |
| 跑测试 | `npm run ci`（语法/类型/lint/格式 + 45 个测试） |

## 9. 下一步

- 看产品全貌与架构：[README.zh-CN.md](../README.zh-CN.md)
- 在线演示与截图：[docs/index.html](./index.html)（GitHub Pages）
- 想参与开发：`npm run ci` 全绿再提 PR；前端没有构建步骤，改 `public/index.html` 刷新即生效。
