# Pixform 收款与积分系统实施方案

更新于 2026-10-24。本文基于当前 Cloudflare Workers + Next.js + D1 + R2 + Replicate 架构制定，作为支付功能的实施基线。用户提供的原始建议保存在对话附件中；本文修正其中会造成重复发放、积分透支和订阅状态错误的部分。

## 一、上线目标与首版边界

首版完成一个闭环：Google 登录 → 领取一次性免费积分 → 生成前预留积分 → 成功后确认消耗、失败后返还 → Stripe Checkout 购买订阅或积分包 → Webhook 发放积分 → Customer Portal 管理订阅 → 用户查看余额和账单状态。

首版保留两个现有工具：Image to Image AI 每次 1 credit，AI Face Swap 每次 2 credits。视频、多脸、优先队列和 Studio 套餐没有真实实现前，不在付费权益中宣传。

定价先采用：

| Offer | 价格 | Credits | 有效期与发放方式 |
| --- | ---: | ---: | --- |
| Free | $0 | 10 | Google 登录后一次性发放；不重置 |
| Pro Monthly | $9/月 | 300 | 每张已支付月度发票发放；下个周期开始时未用部分重置 |
| Pro Annual | $86/年 | 3,600 | 年度发票支付成功后一次发放；订阅年度结束时过期 |
| Credits 200 | $9 | 200 | 一次性购买；不过期 |
| Credits 700 | $25 | 700 | 一次性购买；不过期 |

订阅 credits 优先消耗，永久 credits（Free 和积分包）随后消耗。这样即将到期的额度先用，同时不清掉用户购买的永久余额。取消订阅只关闭续费；当前周期权益持续到期末。付款失败进入 Stripe 的重试流程，不在第一次失败时立即降级或清空余额。

## 二、必须修正原方案的地方

1. `checkout.session.completed` 不负责给订阅发积分。订阅首单通常还会产生 `invoice.paid`，两个事件都加积分会重复。Checkout 只用于绑定订单、Customer 和 Subscription；订阅积分只由 `invoice.paid` 发放。
2. 一次性积分包可在 `checkout.session.completed` 且 `payment_status=paid` 时履约；若以后开放延迟付款方式，还要处理 `checkout.session.async_payment_succeeded`。同一 PaymentIntent 或 Checkout Session 只能履约一次。
3. 不采用“生成成功后才扣积分”。模型请求发出后 Pixform 已经承担成本，并发请求也可能一起越过余额检查。正确方式是生成前原子预留，成功后 capture，失败或无法启动时 release。
4. 不把 `credit_balance` 当唯一真相。余额缓存用于快速检查，账本和发放记录用于审计；任何余额变化都必须有原因、引用对象和幂等键。
5. 不在代码里调用不存在的 `prices.lookup()`。Stripe Price 使用 `lookup_key`，通过 Price list 的 `lookup_keys[]` 获取，并校验唯一、active、币种、金额和周期。
6. 不在功能实现前宣称 `Priority processing`、`all future tools` 或宽泛的 `commercial-friendly terms`。未来昂贵工具可能使用更多积分或不包含在现有套餐里。
7. `/pricing`、首页和 `/face-swap` 的积分文案与登录入口在同一个发布批次切换。提前改文案会让当前页面承诺尚不存在的功能。

## 三、系统架构

### 3.1 身份系统

使用 Google OAuth，首版不开放邮箱密码注册。建议采用 Better Auth 的 Next.js handler 与 Cloudflare D1 支持，先在独立迁移中生成其标准 `user`、`session`、`account`、`verification` 表，不手写 `google_id` 或自行维护 OAuth token。

新增 Secret：

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Google OAuth 回调地址固定为 `https://pixform.ai/api/auth/callback/google`；预览域名不加入正式 OAuth redirect。登录成功后以内部 user ID 为唯一业务身份，不用 email 关联积分或订单。

### 3.2 Stripe 接入

使用 Stripe-hosted Checkout 和 Customer Portal，Worker 端使用 Stripe SDK 的 Fetch HTTP client 与异步 Web Crypto webhook 验签。必须读取原始 request body 后验签，不能先解析 JSON。

新增 Secret：

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

公开配置只允许 `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`（如果前端需要；纯跳转 Checkout 首版可以不用）。测试和正式环境使用完全分离的 key、Price、Webhook endpoint。

### 3.3 Credits 唯一费率源

建立 `lib/billing/catalog.ts`，只放服务端可用的受控配置：

```ts
export const TOOL_RATES = {
  "image-to-image": 1,
  "face-swap": 2,
} as const;

export const OFFERS = {
  pro_monthly_v1: { kind: "subscription", amount: 900, currency: "usd", credits: 300 },
  pro_yearly_v1: { kind: "subscription", amount: 8600, currency: "usd", credits: 3600 },
  credits_200_v1: { kind: "pack", amount: 900, currency: "usd", credits: 200 },
  credits_700_v1: { kind: "pack", amount: 2500, currency: "usd", credits: 700 },
} as const;
```

Stripe metadata 只做后台可读标签，不能作为发放数量的唯一真相。Webhook 必须把实际 Price 的 `lookup_key`、amount、currency、recurring interval 与本地 catalog 交叉校验。

## 四、D1 数据模型

在 Better Auth 的表之外新增以下业务表。金额统一存最小货币单位，时间统一存 Unix 毫秒，业务 ID 使用 UUID 文本。

### `billing_accounts`

- `user_id TEXT PRIMARY KEY`
- `stripe_customer_id TEXT UNIQUE`
- `stripe_subscription_id TEXT UNIQUE`
- `plan_key TEXT`
- `subscription_status TEXT`
- `subscription_credits INTEGER NOT NULL DEFAULT 0`
- `permanent_credits INTEGER NOT NULL DEFAULT 0`
- `current_period_end INTEGER`
- `cancel_at_period_end INTEGER NOT NULL DEFAULT 0`
- `frozen_at INTEGER`
- `updated_at INTEGER NOT NULL`

两个余额字段是受账本约束的快速缓存。冻结账户不能创建新任务。

### `credit_grants`

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `bucket TEXT NOT NULL`：`subscription` 或 `permanent`
- `source TEXT NOT NULL`：`signup`、`invoice`、`credit_pack`、`admin`、`refund_reversal`
- `credits INTEGER NOT NULL`
- `remaining INTEGER NOT NULL`
- `external_ref TEXT NOT NULL UNIQUE`
- `expires_at INTEGER`
- `created_at INTEGER NOT NULL`

它回答“这些积分从哪里来、什么时候过期、还剩多少”。Free 发放使用 `signup:<user_id>` 作为唯一 external_ref；订阅使用 invoice ID；积分包使用 PaymentIntent ID。

### `credit_reservations`

- `job_id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `tool TEXT NOT NULL`
- `credits INTEGER NOT NULL`
- `subscription_used INTEGER NOT NULL`
- `permanent_used INTEGER NOT NULL`
- `state TEXT NOT NULL`：`reserved`、`captured`、`released`
- `created_at INTEGER NOT NULL`
- `resolved_at INTEGER`

生成前插入 reservation。通过 D1 事务 batch 或数据库 trigger 完成“检查余额 + 分桶扣减 + 写 reservation + 写 ledger”，任一步失败则全部回滚。重复 job ID 不重复扣款。

### `credit_ledger`

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `bucket TEXT NOT NULL`
- `delta INTEGER NOT NULL`
- `reason TEXT NOT NULL`
- `ref_id TEXT NOT NULL`
- `idempotency_key TEXT NOT NULL UNIQUE`
- `balance_after INTEGER NOT NULL`
- `created_at INTEGER NOT NULL`

账本不可 UPDATE 或 DELETE；冲正写新记录。财务对账不能依赖现有 `jobs` 表，因为图片清理任务会删除 job。

### `billing_orders`

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `offer_key TEXT NOT NULL`
- `stripe_checkout_session_id TEXT UNIQUE`
- `stripe_payment_intent_id TEXT UNIQUE`
- `stripe_invoice_id TEXT UNIQUE`
- `amount INTEGER NOT NULL`
- `currency TEXT NOT NULL`
- `status TEXT NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

### `stripe_events`

- `event_id TEXT PRIMARY KEY`
- `event_type TEXT NOT NULL`
- `livemode INTEGER NOT NULL`
- `object_id TEXT`
- `received_at INTEGER NOT NULL`
- `processed_at INTEGER`
- `error_code TEXT`

收到事件先插入 event ID；重复主键直接返回 200。事件处理失败保留错误并返回非 2xx，让 Stripe 重试。不要存完整事件正文，以减少支付和个人信息留存。

现有 `jobs` 表新增 `user_id`、`tool`、`credits_reserved`。图片到期清理仍可删除 job 和 R2 对象，credit ledger 保留。

## 五、生成扣费流程

1. 客户端请求 `/api/generate` 或 `/api/face-swap`。
2. 服务端验证 session、Origin、文件类型、大小和授权勾选。
3. 创建 job ID，根据服务端 `TOOL_RATES` 计算 credits。
4. 以原子事务预留 credits：先扣 `subscription_credits`，不足部分扣 `permanent_credits`，写 reservation 和负数 ledger。
5. 保存输入并调用 Replicate。若创建模型任务失败，立即 release reservation 并写返还 ledger。
6. 模型结果成功保存到 R2 后，将 reservation 改为 captured；不再二次扣款。
7. 模型 failed、canceled、重试最终失败或保存结果失败时，release 一次。重复 poll 依靠状态条件写避免重复返还。
8. cron 对超过两小时仍为 reserved 且 job 不再可完成的记录执行对账和 release；不能只删图片。

首版取消现有每 IP 10 次/小时作为主要计费机制，但保留较宽松的安全限流，用于防止已登录用户短时间并发轰炸。限流不是余额系统，也不能向用户显示为 credits。

## 六、Stripe 产品与后台配置

正式环境创建两个 Product：`Pixform Pro`、`Pixform Credits Pack`。创建四个 Price，并设置唯一 lookup key：`pro_monthly_v1`、`pro_yearly_v1`、`credits_200_v1`、`credits_700_v1`。Studio 暂不创建正式 Price；等成本和付费数据后再决定。

后台同步完成：

- 开启 Customer Portal：更新付款方式、查看发票、期末取消；首版禁止用户在 Portal 自由切换套餐，避免未定义的 prorations。
- 开启失败付款邮件、Smart Retries，并设置订阅取消/欠款规则。
- 开启 Radar 基础风控；Checkout 只允许需要的支付方式，首版可先只开放即时确认方式，降低异步履约复杂度。
- 明确 Statement descriptor、客服邮箱、商户名称、品牌图标和退款说明。
- 税务先决定使用 Stripe Tax 还是由商户自行处理；没有结论前不能宣称价格含税。
- Checkout 开启“一个 Customer 一份有效订阅”的限制，已有订阅的用户转 Customer Portal。

## 七、Webhook 事件矩阵

| 事件 | 首版行为 |
| --- | --- |
| `checkout.session.completed` | 校验用户、offer 和金额；绑定 Customer；一次性支付仅在 paid 时履约；订阅不发 credits |
| `checkout.session.async_payment_succeeded` | 若开放延迟付款，为积分包履约；按 PaymentIntent 幂等 |
| `checkout.session.async_payment_failed` | 订单记 failed，不发 credits |
| `invoice.paid` | 订阅唯一发放入口；按 invoice ID 幂等；月付重置为 300，年付设置为 3,600 |
| `invoice.payment_failed` | 更新状态、展示付款问题；不立即清零或降级 |
| `customer.subscription.updated` | 同步 status、period end、cancel_at_period_end；不直接发 credits |
| `customer.subscription.deleted` | 清 subscription plan；到期后使 subscription bucket 失效，永久积分保留 |
| `refund.created` / `charge.refunded` | 根据退款对应订单撤销尚未使用的 credits；已使用时进入人工处理，不制造负余额 |
| `charge.dispute.created` | 冻结新生成、记录争议并人工处理；不自动删除账户或图片 |
| `charge.dispute.closed` | 根据 won/lost 和人工决定解冻或冲正 |

Stripe 不保证所有事件按业务顺序到达。每个 handler 都要能在 Customer/Subscription 尚未同步时通过 Stripe object ID 补查，并以对象 ID 而非事件到达顺序决定最终状态。

## 八、API 与页面清单

新增 API：

- `GET/POST /api/auth/[...all]`：Better Auth
- `POST /api/billing/checkout`：只接收受控 `offerKey`，服务端查 Price 并创建 Checkout Session
- `POST /api/billing/portal`：为当前登录用户创建 Customer Portal Session
- `POST /api/stripe/webhook`：原始 body 验签、事件幂等处理
- `GET /api/account/credits`：返回两个余额、总余额、套餐和到期日
- `GET /api/account/ledger`：分页返回积分记录，不返回 Stripe 敏感对象

新增页面：

- `/pricing`：Free、Pro 月/年切换、Credits Packs、工具消耗表、FAQ、Product/Offer schema
- `/account`：余额、订阅状态、credits 明细、Manage billing 按钮
- `/checkout/success`：显示“正在确认付款”；轮询自己的订单状态，绝不由 success 页面发 credits
- 登录弹窗/页：Google 登录，说明领取 10 credits

现有页面在支付闭环上线时一起改：Header/Footer 增加 Pricing；工具区显示真实余额和本次消耗；移除 No signup 和 10 attempts/hour；Free FAQ、Terms、Privacy 同步账号、Stripe、订阅、退款、账单数据与保留期限。

`/pricing` 文案不写“priority processing”和“all future tools”；改为“Credits work across eligible Pixform tools. Each tool shows its credit cost before you run it.” 年付明确“3,600 credits issued for the annual term”，月付明确“resets on each paid monthly renewal”。

## 九、安全、隐私与运营

- Stripe secret、webhook secret、OAuth secret 只放 Cloudflare Secrets；`.dev.vars` 仅本地且继续 Git ignore。
- Checkout 的 user、offer、amount、currency 全由服务端确定；客户端不能传 price ID、credits 或金额。
- Webhook 校验签名、livemode 与账户环境；测试事件绝不写入正式余额。
- 所有余额写入带唯一 idempotency key；所有生成返还使用条件状态更新。
- 账户接口使用 `Cache-Control: private, no-store`；支付和账户页面 `noindex`，Pricing 可索引。
- 日志只记录 event ID、object ID、状态和安全错误码，不打印完整 webhook、邮箱、Cookie、Secret 或图片 URL。
- 增加监控：webhook 失败数、未处理事件、余额不一致、reserved 超时、每日发放/消耗、收入与 Replicate 成本估算、争议和退款。
- 每日自动对账不是“盯日志”：定时比较余额缓存与 ledger 汇总，异常只报警，不自动改账。

退款政策、公司/商户名称、经营主体所在地、税务处理必须在正式收款前确认。附件中的退款门槛可作为产品建议，但不能在不知道适用地区和 Stripe 商户信息时直接写进 Terms。

## 十、测试与验收

自动化测试至少覆盖：

- signup credits 只能发一次；重复 OAuth callback 不加分。
- 两个并发生成请求不会让余额小于 0。
- image-to-image 预留 1、face-swap 预留 2。
- Replicate 创建失败、模型失败、保存失败各返还一次；成功不返还。
- 相同 webhook event、invoice、PaymentIntent 重放 2 次仍只发一次。
- 订阅首单同时收到 Checkout 与 invoice 只发一份 credits。
- 月度续费重置 subscription bucket，永久 bucket 不变。
- 年付发 3,600，取消后到期前可用，到期后订阅 bucket 失效。
- payment_failed 不立即删余额；subscription.deleted 不删永久 credits。
- refund/dispute 冻结与冲正符合策略。
- Checkout 拒绝未知 offer、未登录、跨 Origin 和篡改金额。
- 测试模式事件不能污染正式账本。

Stripe Test Clock 用于验证月度续费、年付到期、失败重试和取消；Stripe CLI 用于事件重放；本地 Miniflare/D1 用并发测试验证原子预留。上线前在 Stripe test mode 完成一轮“登录 → 免费生成 → 月付 → 续费 → 买积分包 → 取消 → 退款”的完整验收，并保存账本快照。

## 十一、实施顺序

### 阶段 A：规则与地基（1–2 天）

确认退款/税务/商户信息；建立 catalog、D1 迁移、余额事务和测试。此阶段不改公开文案，不创建正式收费入口。

### 阶段 B：登录与免费积分（2 天）

接 Google OAuth、session、一次性 10 credits、账户余额 UI。将两条生成 API 改为登录后预留/capture/release；完成并发和失败路径测试。

### 阶段 C：Stripe test mode（2–3 天）

创建测试 Product/Price，接 Checkout、Webhook、Customer Portal、订单和订阅同步。用 Test Clock 和事件重放完成账务验收。

### 阶段 D：Pricing 与政策（1–2 天）

上线前完成 `/pricing`、`/account`、success 页面；更新首页、face-swap、Header/Footer、Terms、Privacy。Pricing 结构化数据只描述实际可购买的 offer。

### 阶段 E：正式切换（1 天）

创建 live Price 和 webhook endpoint，配置 Secrets，执行 D1 远程迁移，部署后用真实最低金额或受控测试订单验证，再开放按钮。旧匿名限流与新积分切换在同一版本完成。

### 阶段 F：观察期（14 天）

每天检查 webhook、订单、账本对账、失败付款、退款/争议和模型成本。前 20 笔真实订单人工核对 Stripe 金额、credits 发放和订阅状态。稳定后再考虑 Studio、优惠券、地区价格和升级/降级 prorations。

## 十二、开工前输入项

开发开始前需要准备但不要在聊天中粘贴 Secret：

1. Stripe 账户的经营主体国家/地区、默认币种和公开商户名称。
2. 退款政策最终选择，以及税费是含税、另计，还是启用 Stripe Tax。
3. Google Cloud OAuth Client（正式回调域名为 pixform.ai）。
4. Cloudflare Secret 中的 Stripe test key、test webhook secret、Google client secret、Better Auth secret。
5. 确认 annual credits 采用本文推荐的“年度一次发 3,600，年度结束过期”。若改为每月发 300，需要额外的内部发放计划和月度幂等任务。

完成以上输入后，开发从阶段 A 开始；正式 live key 直到 test mode 全链路通过后才配置。
