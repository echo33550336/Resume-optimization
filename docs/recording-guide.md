# 素材录制指南（截图与 GIF）

README 首屏的转化率几乎全部取决于这里的素材。目标：**1 张主截图 + 1 段 ≤ 10 秒的 GIF**，放在仓库 `README.md` 标题下方。

当前 README 只有徽章、没有任何产品截图，这是目前最大的门面缺口。

## 一、准备（2 分钟）

1. 起服务：`npm start`，打开 <http://127.0.0.1:3000>。
2. 浏览器窗口固定为 **1280 × 800**，缩放 100%，隐藏书签栏（`Ctrl + Shift + B`），关闭其它标签页。
3. 用内置示例填充：在「优化简历」页点 **产品 / 数据** 示例 chip，避免录制时手打。
4. 确认 `.env`、终端、API key **不在画面里**。
5. 提前发一次请求，确认模型能在 5 秒内开始吐字（太慢就换示例内容）。

## 二、录制工具

| 工具                                        | 平台      | 说明                   |
| ------------------------------------------- | --------- | ---------------------- |
| [ScreenToGif](https://www.screentogif.com/) | Windows   | 免费、可逐帧删改，首选 |
| [LICEcap](https://www.cockos.com/licecap/)  | Win/macOS | 轻量，直接出 GIF       |
| ShareX                                      | Windows   | 录屏 + GIF 一条龙      |

参数：帧率 **12–15 fps**，宽度 **1280**，保存为 `docs/assets/demo.gif`，控制在 **8 MB 以内**（GitHub README 会直接内联显示）。

## 三、GIF 分镜（共 10 秒）

| 时间  | 操作                                               |
| ----- | -------------------------------------------------- |
| 0–1s  | 停在落地页首屏，鼠标轻微移动                       |
| 1–2s  | 点「优化简历」                                     |
| 2–4s  | 点示例 chip，表单瞬间填满（这是最有效的"一键感"）  |
| 4–5s  | 点「开始优化」                                     |
| 5–9s  | 结果区流式滚动（保持鼠标远离，让文字动起来）       |
| 9–10s | 停在完成态，让工具栏（复制 / 下载 / 打印）清晰可见 |

录制小技巧：先空跑一遍，把鼠标轨迹记住；正式录时动作放慢一半；结尾不要剪太急，留 0.5 秒定格。

## 四、截图清单

| 文件                                   | 画面                                     |
| -------------------------------------- | ---------------------------------------- |
| `docs/assets/screenshot-landing.png`   | 落地页首屏（深色模式也可各来一张）       |
| `docs/assets/screenshot-optimizer.png` | 优化界面，左右两栏都填满，右侧结果流式中 |
| `docs/assets/screenshot-result.png`    | 结果完成态，能看清四段结构与工具栏       |
| `docs/assets/screenshot-settings.png`  | 设置面板（主题 / 字体 / 背景）           |

建议用系统自带截图工具裁到窗口内边缘，不留桌面背景。

## 五、写进 README

录好后把文件放进 `docs/assets/`，然后在 `README.md` 标题下加：

```markdown
![Demo](docs/assets/demo.gif)
```

并在「Usage」之前插入截图对比区（落地页 + 结果页并排）：

```markdown
| Landing                                                    | Result                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| <img src="docs/assets/screenshot-landing.png" width="49%"> | <img src="docs/assets/screenshot-result.png" width="49%"> |
```

`README.zh-CN.md` 同步加一份。

## 六、社交预览图

GitHub 仓库页右上角 **Settings → Social preview** 上传一张 **1280 × 640** 的图（可以把截图 + 标题「Resume Optimizer · BYO model」拼在一起）。没有这张图，别人在 Twitter / 微信分享时看到的是一张灰卡。
