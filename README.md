# 简历智能优化系统 · Vibecoding

基于岗位 JD 的简历深度优化 Web 应用。输入目标岗位与 JD，粘贴简历，AI（扮演 10 年经验 HR 总监）输出匹配度诊断、优化后的简历、关键修改说明与待补充项。

## 运行

```bash
npm start
```

浏览器打开 http://localhost:3000

## 配置

复制 `.env.example` 为 `.env`，填入 `LLM_API_KEY`（OpenAI 兼容接口）。

## 技术栈

- 后端：Node.js 原生 http（无依赖）
- 前端：原生 HTML/CSS/JS
- LLM：OpenAI 兼容 chat/completions 接口