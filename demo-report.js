'use strict';

/**
 * Canned demo report used by `/api/optimize` when the request sets `demo: true`.
 *
 * It exists so the UI can be tried without an API key: same SSE shape, same four-part
 * structure, but the text is pre-recorded instead of generated. Nothing here calls a model.
 */

const DEMO_ZH = `## 一、匹配诊断

**综合匹配度：68 / 100 —— 可投，但需要在两处关键证据上补强。**

- **JD 关键词覆盖：72/100** —— 岗位明确要求「大模型应用」「RAG / Agent / Prompt Engineering」「数据驱动」，简历里只有一句「使用大模型做问答」，属于"沾边但不具体"，HR 很难判断你的深度。
- **成果量化：45/100** —— 通篇没有数字。「推进功能上线」「做过用户调研和数据分析」都是动作，不是结果。招聘方会默认你无法证明影响。
- **岗位层级匹配：85/100** —— 3 年产品经验 + 计算机本科，符合"3 年以上、计算机相关专业优先"。
- **风险点** —— 从 SaaS 产品跳到 AI 产品，缺少"为什么你能做 AI 产品"的过渡证据。

## 二、优化后的简历

**张三｜AI 产品经理｜3 年经验**
电话 138xxxx｜邮箱 xxx@xx.com

**求职意向**：AI 产品经理（大模型应用方向）

**教育背景**
XX 大学｜计算机科学与技术｜本科｜2016.09–2020.06

**工作经历**

**ABC 科技｜产品经理｜2020.07–2023.06**
- 主导 SaaS 产品需求到上线全流程，累计交付 12 个版本，服务 [补充客户数] 家企业客户，核心功能周活跃使用率从 [补充基线]% 提升至 [补充结果]%。
- 独立完成需求调研与 PRD 输出，将需求评审返工率从 [补充]% 降至 [补充]%，版本平均交付周期缩短 [补充] 天。
- 搭建产品数据看板（SQL + 埋点），定位到注册漏斗第 2 步流失率 41%，推动改版后转化率提升 [补充]%。
- 跨团队协作：与算法、工程、设计三方建立双周迭代机制，需求交付准时率 [补充]%。

**项目经历**

**智能客服系统｜产品负责人｜2022.03–2023.01**
- 基于大模型设计问答链路：意图识别 → 知识召回（RAG）→ 生成与兜底，覆盖 [补充] 类高频问题，人工客服转接率下降 [补充]%。
- 设计 Prompt 模板与评测集（[补充] 条标注样本），将答案准确率从 [补充]% 迭代到 [补充]%，并沉淀为可复用的 Prompt 规范。
- 与算法同学共建 Badcase 回流机制，每周复盘 Top [补充] 类问题，推动模型侧优化 [补充] 次。

**技能**
- 产品：PRD、用户调研、A/B 实验设计、数据看板搭建
- 技术理解：RAG、Agent 工作流、Prompt Engineering、SQL、Python（数据分析级）
- 工具：Figma、Axure、Jira

## 三、修改清单（为什么这么改）

1. **把"负责"换成"主导 + 结果"** —— JD 要的是能 0 到 1 推动落地的人，动词层级直接决定 HR 对你的定级。
2. **补 RAG / Prompt 细节** —— 只写"用大模型"等于没写；写出链路、评测集、Badcase 回流，才证明你懂工程落地而不只是提需求。
3. **所有空白改成「补充数字」占位符** —— 不替你编造数据；这些占位符就是你要去查的指标。
4. **加数据看板与 A/B 实验** —— 命中 JD 的"数据驱动、SQL/数据分析能力"。
5. **经历按"动作 → 方法 → 结果"重排** —— 让 HR 在 8 秒扫读时每行都能看到结果。

## 四、缺口与风险（面试官一定会问）

- **AI 产品的量化基线**：周活、转化率、准确率的改造前后数字，需要你补真实值。
- **技术深度边界**：如果被问"RAG 召回失败怎么排查"，要能讲出至少 3 种定位手段（检索命中率、分块策略、rerank）。
- **转型动机**：从 SaaS 到 AI 产品的动机与学习路径，建议准备一个 2 分钟版本。
- **项目归属**：智能客服里你负责的是链路设计还是 Prompt 撰写？面试官会追问边界，提前想清楚。

> 以上为演示内容：真实使用时，模型会基于你填写的 JD 与简历重新生成，并逐条给出分数理由。`;

const DEMO_EN = `## 1. Match Diagnosis

**Overall match: 68 / 100 — submit-worthy, but two pieces of evidence are missing.**

- **JD keyword coverage: 72/100** — the posting asks for "LLM applications", "RAG / agents / prompt engineering" and "data-driven". Your resume says only "used an LLM for Q&A", which is adjacent but not specific enough to prove depth.
- **Quantified impact: 45/100** — not a single number. "Shipped features" and "ran user research" are activities, not outcomes; recruiters assume you cannot prove impact.
- **Seniority fit: 85/100** — 3 years of product experience plus a CS degree matches "3+ years, CS preferred".
- **Main risk** — moving from SaaS to AI product without a transition story for why you can do AI product work.

## 2. Optimised Resume

**Alex Chen | AI Product Manager | 3 years**
Phone 138xxxx | Email xxx@xx.com

**Target** AI Product Manager (LLM applications)

**Education**
XX University | Computer Science | BSc | Sep 2016 – Jun 2020

**Experience**

**ABC Tech | Product Manager | Jul 2020 – Jun 2023**
- Owned the SaaS product from requirements to launch: 12 releases, [add customer count] enterprise customers, weekly active usage up from [add baseline]% to [add result]%.
- Ran discovery and wrote PRDs; cut requirements rework from [add]% to [add]% and shortened average delivery by [add] days.
- Built the product metrics dashboard (SQL + event tracking), found a 41% drop-off at step 2 of signup, and raised conversion by [add]% after the redesign.
- Coordinated algorithm, engineering and design teams in a two-week cadence; on-time delivery reached [add]%.

**Project**

**Smart Customer Support | Product owner | Mar 2022 – Jan 2023**
- Designed the LLM answer pipeline: intent detection → retrieval (RAG) → generation with fallback, covering [add] high-frequency intents and cutting human hand-off by [add]%.
- Built prompt templates and an eval set ([add] labelled samples), lifting answer accuracy from [add]% to [add]% and turning it into a reusable prompt guideline.
- Set up a badcase loop with the algorithm team, reviewing the top [add] failure classes weekly.

**Skills**
- Product: PRDs, discovery, A/B testing, dashboards
- Technical: RAG, agent workflows, prompt engineering, SQL, Python (analysis level)
- Tools: Figma, Axure, Jira

## 3. Key Changes

1. **Replaced "responsible for" with "owned + outcome"** — the JD wants someone who ships from 0 to 1; verb level drives the seniority call.
2. **Made the LLM work concrete** — pipeline, eval set and badcase loop show engineering depth instead of a buzzword.
3. **Left every unknown as "[add ...]"** — nothing is invented; the placeholders tell you exactly which metric to look up.
4. **Added dashboards and A/B testing** — maps to "data-driven, SQL/analysis".
5. **Reordered every bullet as action → method → result** — an 8-second scan now shows outcomes, not duties.

## 4. Gaps & Risks

- **Baselines are missing** — weekly active, conversion and accuracy numbers before and after need real values.
- **Technical depth** — expect "how do you debug a failing RAG retrieval?"; be ready with three diagnostics (hit rate, chunking, reranking).
- **Motivation** — prepare a two-minute story for the SaaS → AI product move.
- **Scope of ownership** — clarify what you personally owned in the support system versus what the algorithm team owned.

> Demo content: in real use the model regenerates from your JD and resume and justifies every score.`;

/**
 * Return the canned report in the requested language.
 * @param {{ lang?: string }} [options] any language string; only 'en' switches to English
 * @returns {string} markdown report
 */
function buildDemoReport(options = {}) {
  const lang = typeof options.lang === 'string' ? options.lang.trim().toLowerCase() : '';
  return lang === 'en' ? DEMO_EN : DEMO_ZH;
}

module.exports = { buildDemoReport, DEMO_ZH, DEMO_EN };
