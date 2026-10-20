## 当前上线状态（2026-10-21 01:19 CST）

- 正式站 https://pixform.ai 已上线，首页 HTTP 200；www 全路径 308 跳转根域。Worker 路由 `pixform.ai/*`、`www.pixform.ai/*` 已部署，现有代理 DNS 记录保留，未删除 DNS 数据。
- Worker Version：`6a7847f6-af82-404a-b200-bcbc25dd8e4e`；GENERATION_ENABLED=true。三个平台 Secret 已配置。
- 首页 canonical 为 https://pixform.ai，无 noindex；About/Privacy/Terms/robots/sitemap 均 200。robots 允许内容路径，阻止 API/result；结果页 404 + noindex；sitemap 目前仅四个已上线内容页。GSC 和分析平台仍未配置。
- Cloudflare Email Routing 已启用且 ready；规则 `43c04a48617947cc943e4844c6c7b632`：hello@pixform.ai → liukai19911010@gmail.com，enabled=true。MX、SPF、DKIM 已建立；没有发送测试邮件，尚无实际投递验收。
- 真实端到端验证：合成风景 PNG → 正式 /api/generate → Replicate SDXL → 私有 R2 → 预览/下载。任务 `1f688ed5-eb87-47cd-8f61-bc5227a285d5` succeeded，1 次模型尝试，7595 ms（单样本，不代表 SLA），输出 PNG 195493 bytes，下载与预览字节一致。
- 发现并修复 workerd 不支持 redirect:error 的兼容问题：改为 manual，保留对非成功 HTTP 状态的拒绝，阻止自动跳转。创建失败只记录安全错误分类，不保存 Token 或上游响应正文。
- 清理验收：只将上述测试任务提前设为过期，媒体和下载立即 404；每分钟 cron 删除 D1 记录；R2 输入/输出均返回 key does not exist。正常成功任务保留时间仍为完成后 3600000 ms。两条早期失败测试任务按原 TTL 自动清理。
- 11 项测试通过（新增真实 workerd Request 兼容及 302 拒绝验证）；生产构建及类型检查通过。miniflare 固定为显式测试依赖。
- 本地证据：.cache/pixform-live-home.png、.cache/live-test-input.png、.cache/live-output.png。含短期访问凭据的测试 JSON 仅在被 Git 忽略的 .cache 下。
- 本轮有 2 次成功的真实模型任务：一次隔离诊断直连 Replicate、一次网站端到端验证；具体费用以 Replicate 账单为准。生成已开放。

以下为前期执行记录；若状态冲突，以本节为准。

# Pixform 第一阶段执行台账

更新于 2026-10-21。最新用户方案原文见 `PHASE_ONE_SOURCE_CN.md`，替代先前首页和换脸页同步上线的安排。
Day 1 从正式首页可用之日计，不从编写代码之日计。

## 已确认

- 独立项目：`/Users/liukai/Documents/ChatGPT/pixform`，不再应用 Moxion 仓库规则。
- 域名 `pixform.ai`；品牌固定 `Pixform`；只做英语。
- Cloudflare 部署；Replicate 模型；密钥只放本地忽略环境文件或平台 Secret。
- 公开联系邮箱拟用 `hello@pixform.ai`，通过 Cloudflare Email Routing 转发到用户指定目的地址。目的地址不写入仓库，路由与验证尚未确认。
- 忽略原“六个站信息”记录要求。
- 第一天四个可索引页面：首页、About、Privacy、Terms。首页新版 TDK 以方案为准。
- URL 子路径统一无尾斜杠；根路径仍是 `https://pixform.ai/`。风格参数 canonical 到根路径。
- 不建独立风格页，不提前发布换脸、文生图或博客入口。

## 顺序与验收

| 时间 | 工作 | 当前状态 |
| --- | --- | --- |
| Day 1 | 首页、robots、sitemap、404、About/Privacy/Terms | workers.dev 预览已部署并通过只读冒烟；正式域名未上线 |
| Day 1 | Cloudflare 资源、域名与 HTTPS、邮箱路由 | R2/D1/Worker 已创建；Zone 已添加免费计划，等待注册商 NS 切换 |
| Day 1 | GSC 域名资源、DNS 验证、sitemap、实际网址测试、请求索引 | 待生产上线和账户访问 |
| Day 1–2 | GA4/Plausible 四事件、成功率与耗时指标 | 前端事件接口已写；D1 聚合出图指标已写；外部分析未启用 |
| Day 3–5 | Face swap 工具、正文、FAQ、双向内链、sitemap | 未开始，不提前上线 |
| Day 6 | HTML、索引、性能首检 | 待上线 |
| Day 7–10 | 筛选和提交 20–30 个真实 AI 目录 | 未开始 |
| Day 10–14 | 用户先复核 SERP，再上线 Photo generator | 等待门禁，不提前建页 |
| Day 14 | 索引检查、Product Hunt 素材 | 未开始 |
| Day 15–21 | Product Hunt 与有帮助的社区内容 | 未开始 |
| Day 21 | 曝光、索引错误、人工处置复盘 | 未开始 |
| Day 22–30 | 按实际 GSC 曝光词写 2–3 篇；竞争引用域调研 | 未开始 |
| Day 30 | 索引、查询曝光、技术错误、人工处置、出图成功率验收 | 未开始 |

## 已落地架构及尚未通过的门禁

- Next.js App Router + OpenNext Cloudflare Workers。
- Replicate SDXL 固定版本来自环境配置，异步创建与轮询，输入是带时限签名的私有媒体链接。
- R2 私有桶；D1 任务与原子滚动窗口限流；独立每分钟清理与任务收尾。
- 成功/失败任务计划处理后 1 小时失效；未能收尾的任务最多 2 小时。失效后媒体接口立即拒绝，物理删除靠定时任务，下次执行删除失败则保留记录重试。
- 不向用户虚构供应商队列位置或进度百分比。显示真实状态、已等待时间和不确定进度条。
- 仅明确的临时供应商终态故障可重试一次；内容安全、输入错误不重试；创建请求结果不明不自动重发。
- `GENERATION_ENABLED=false` 为初始配置。已创建 D1 `pixform`（`190e9000-2348-46a2-b0b3-1a21ac838582`）和私有 R2 `pixform-private-media`。必须配置 Secret 并完成真实出图和删除验证后打开。
- 10 项定向测试通过：图片签名、格式嗅探、输出域名限制、滚动窗口限流、并发重试只创建一次、安全拒绝不重试、清理顺序、持久聚合去重。D1 测试使用真实 SQLite + D1 形状适配，供应商/R2 使用 mock，不等于生产验证。
- 无公开结果页；`/result/*` 404 且 noindex；API noindex/no-store。
- 当前 Privacy/Terms 为与实现对齐的首版，运营联系邮箱和生产存储事实必须在上线前验证。不得将未验证的删除流程写成已验收。
- 正式域名、GSC 提交和真实模型出图尚未完成；没有配置定时提醒。
- 预览 URL：`https://pixform.liukai19911010.workers.dev`；Git `bf8d7b1`；Worker Version `2cdb3987-6bd9-482e-aa35-b2b950967b76`。
- 预览首页、三个基础页、robots、sitemap 均 HTTP 200，HTML 有 H1；`/result/example` HTTP 404。预览所有路径返回 `X-Robots-Tag: noindex, nofollow`，仅正式 `pixform.ai` 主机放开索引。
- D1 `0001_initial.sql`、`0002_daily_metrics.sql` 已远程应用成功；生成保持关闭。

## 本轮验证及外部依赖

- `npm test`：10/10 通过。
- `npm run typecheck`：通过。
- `npm run cf:build`：最终新增聚合指标版本通过。
- `wrangler deploy --dry-run`：通过，压缩包约 1.87 MiB。
- npm 官方 registry 审计：修复 sharp 与上游 glob 漏洞后 0 个已知漏洞。
- 本地 HTTP：首页及三个基础页 200、H1 在 HTML 中；sitemap 仅四条；风格 query canonical 指回首页；404/result/未来工具页为 404 + noindex；无配置生成 API 为 503。
- 窄窗口视觉预览与风格按钮切换已检查；LCP/CLS/INP 尚未测量。
- Cloudflare 已通过用户重新授权；已通过控制台添加 `pixform.ai` 到免费计划。Zone ID：`3245f19ae3f1b1f0fbfafc0863c31ccf`。
- 分配的 nameserver：`kate.ns.cloudflare.com`、`patryk.ns.cloudflare.com`。用户已确认注册商修改；2026-10-21 00:55 CST 已点击“我已更新名称服务器”并触发复检。Cloudflare 仍显示等待注册机构传播，Google DNS 查询仍返回旧 NS。
- 扫描导入三条旧 A 记录：`*`、根域、`www` → `185.53.179.149`；没有删除现有记录。后续绑定 Worker 正式域名时再处理根域与 www 的冲突。
- 搜索爬虫保留允许；关闭 Cloudflare Bot Preference Sync，robots 由项目自身管理。
- 用户指定 Gmail 已是 Cloudflare 已验证目的地址；没有因本项目再发送验证邮件。域名邮件规则尚未建立。
- `.dev.vars` 已创建且 `git check-ignore` 通过；用户已填写 Token，Replicate `/v1/account` 返回 200。REPLICATE_API_TOKEN、REPLICATE_SDXL_VERSION、JOB_SIGNING_SECRET 已通过标准输入安全写入 Worker，未输出密钥。
- GA4/Plausible property 未配置；真实出图未执行，尚未产生模型调用费用。

## 对原方案的必要解释

- 原文 sitemap 说“7 条”，实际列出 6 条；Day 1 只列 4 个已上线内容页，404、robots 与 sitemap 自身不列入 sitemap。
- 原文末句“2 个功能”与 Day 10–14 第三个工具冲突；按详细排期执行，第三个工具必须先经用户 SERP 复核。
- `site:` 查询用于辅助排查，正式索引证据用 GSC URL 检查；未索引原因需逐项诊断，不先断言一定是技术故障。
- 同页尝试风格属于交互事件，不自动增加 page view；不为了统计人均页数制造虚假浏览事件。
- 性能、排名、出图成功率和等待时间是待测目标，不是实现后即可宣称的事实。
- 发信、站长联系、社交发布需具体内容与目标明确后执行；本次没有对外发送。

## 实施参考

- https://replicate.com/docs/topics/predictions/create-a-prediction/
- https://replicate.com/docs/topics/predictions/data-retention
- https://replicate.com/stability-ai/sdxl/api/schema
- https://opennext.js.org/cloudflare/get-started
- https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/create/

## 2026-10-21 名称服务器切换跟进

- Cloudflare 复检已提交，域名尚未 active。启用 Email Routing 返回 `Active zone required`（2009），未建立转发规则。
- 生成仍关闭；Token 认证成功不等于真实出图通过，尚未执行收费模型调用。
- 待域名激活后继续 Worker 自定义域名绑定、邮箱转发、真实出图及清理验证和 GSC。
