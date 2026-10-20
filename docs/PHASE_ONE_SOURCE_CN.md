第一阶段我按 **Day 0–30「地基期」** 来定，目标不是流量，是**让谷歌第一次就把这个站看对**——收录正常、主题清晰、有初始曝光。下面是完整执行方案。

---

# pixform.ai 第一阶段实施方案（Day 0–30）

## 〇、阶段目标（一句话）

**30 天内上线 3 个页面，全部被收录；首页在 `image to image` 上有初始曝光；零技术错误、零人工处置。**

不管流量指标，因为 30 天内你排不到前 30，看流量只会自我怀疑。

### 30 天验收清单（全部打勾才算过）

| 验收项 | 标准 | 怎么看 |
|---|---|---|
| 首页收录 | 已编入索引 | `site:pixform.ai` |
| /face-swap/ 收录 | 已编入索引 | GSC 索引页 |
| 首页有曝光 | `image to image` 至少 1 次曝光（排名 50+ 也算） | GSC → 查询 |
| /face-swap/ 有曝光 | 任一词有曝光 | GSC → 查询 |
| 技术错误 | 0 个 | GSC → 网页编入索引 |
| 人工处置 | 0 | GSC → 人工处置 |
| 出图成功率 | > 95% | 自己埋点 |

---

## 一、页面上线排期（严格按天）

| 时间 | 上线页面 | 为什么这个顺序 |
|---|---|---|
| **Day 1（今天）** | `/`、`/robots.txt`、`/sitemap.xml`、`/404`、`/privacy/`、`/terms/`、`/about/` | 首页是主角，法务页是 GSC 信任基础（以后接 Stripe/AdSense 也要） |
| **Day 1** | GSC 建资源 + 提交 sitemap + 手动请求收录 | 别等第二天 |
| **Day 3–5** | `/face-swap/` | 和首页一起形成「图片转换站」主题，不是孤页 |
| **Day 10–14** | `/photo-generator/` | KD 38.1，等前两页收录稳定后再上 |
| **Day 20–30** | `/blog/` + 2~3 篇 | 只按 GSC 已经出现的曝光词写，不拍脑袋选题 |

**第一阶段明确不上**：`/background-remover/`（KD 68.4）、`/image-upscaler/`（KD 75.4）、`/image-extender/`、`/style-transfer/`。前两个已经被数据判死，后两个要先精评。

> 哥飞公众号写过一篇《【哥飞SEO教程】新站批量化上页面，必死》（2025-03-20）——新站一上线铺几十个页面，结果是没有一个页面拿到权重。第一阶段 3 个页面，就是这条的反面。

---

## 二、首页完整规格

### 2.1 技术层

| 项 | 要求 | 理由 |
|---|---|---|
| 渲染方式 | **SSR / SSG**，禁止 CSR 空壳 | 首屏 HTML 里必须能读到 H1 和正文，否则等于空页 |
| 框架 | Next.js（App Router）/ Astro / Nuxt 任一 | 你现在就有代码基础 |
| URL | `https://pixform.ai/`（统一不带尾斜杠） | 一致性 |
| canonical | 自指 | |
| hreflang | 只 `en-US`，**第一阶段不做多语言** | 多语言会摊薄权重 |
| LCP | < 2.5s | 首屏那个上传框就要是 LCP 元素 |
| CLS | < 0.1 | 图片必须写死宽高 |
| INP | < 200ms | |

### 2.2 TDK

```
Title (50 字符)
Image to Image AI — Free Image to Image Generator

Meta Description (154 字符)
Turn any photo into a new image with Pixform's free AI image to image
generator. Upload, pick a style, download in seconds. No signup, no watermark.

H1
Image to Image AI
```

**Title 里 `image to image` 出现两次**（`Image to Image AI` + `Image to Image Generator`），这是精准匹配 + 变体覆盖，不是堆砌——因为这两个是用户真实会搜的两种说法。品牌 `Pixform` 不进 Title，靠 logo、H1 下方小字、`og:site_name`、结构化数据里的 `name` 输出品牌信号。你现阶段不靠品牌词搜索，把 12 个字符让给关键词。

### 2.3 页面结构（逐段，含文案）

```
【Section 1 · Hero + 工具】← 必须在第一屏完整可见
```

- H1：`Image to Image AI`
- 副标题（一行）：`Upload a photo, pick a style, get a new image in seconds.`
- **工具表单**（就是上一轮定的那个，一屏内）：

```
┌──────────────────────────────────────────┐
│  📁  Click or drag image here            │
│      (JPG / PNG / WEBP, up to 10MB)      │
├──────────────────────────────────────────┤
│  Style:                                  │
│  [Watercolor] [Cyberpunk] [Anime]        │
│  [Oil Paint]  [Sketch]    [Pixel]        │
│  [More styles →]                         │
├──────────────────────────────────────────┤
│  [ Generate Image ]  ← 主按钮，只有一个    │
├──────────────────────────────────────────┤
│  结果区（同屏，不跳页）                     │
│  [ Before ]  [ After ]                   │
│  [Download] [Try another style] [Start over]│
└──────────────────────────────────────────┘
```

**三个关键决定：**
1. **没有下拉框选功能**——这是 briefvu 的死因
2. **结果留在同页**，不跳转到 `/result/xxx`——跳转会打断停留时间
3. **`Try another style` 按钮**——直接拉高人均页数，对标榜首的 2.9 页

```
【Section 2 · How It Works】3 步图标卡
1. Upload your photo
2. Choose a style
3. Download your image
```

```
【Section 3 · What Is Image to Image AI?】200–300 词正文
```
这一段决定首页能不能被认成这词的主题。要点（自然覆盖，不硬塞）：
- 第一句直接定义：`Image to image AI takes an existing photo and generates a new version of it...`
- 提 `image to image generator`、`AI image transformer`、`img2img` 各一次（自然句子里）
- 提它跟纯文生图的区别（`unlike text to image, you start from your own photo`）
- 提支持的场景：风格迁移、换脸、扩图、修复 —— **用文字提，不在这里做功能路由**

```
【Section 4 · Popular Styles】6~8 个风格卡片
```
覆盖 `image to image` 的场景长尾：watercolor / anime / oil painting / cyberpunk / sketch / pixel art。每个卡片链到 `/?style=anime`（同页，但可被索引为变体探索）。

⚠️ 别为每个风格建独立页面——那是批量化上页面，第一阶段禁止。

```
【Section 5 · FAQ】6 条，带 FAQPage 结构化数据
```
1. What is image to image AI?
2. Is this image to image generator free?
3. Do I need to sign up to use it?
4. What image formats are supported?
5. Can I use the generated images commercially?
6. Is there a watermark on the output?

```
【Section 6 · More AI Image Tools】卡片区
```
**只链已经上线的页面**。Day 1 只有首页时，这一块整个不渲染（别留空卡片和死链）。

```
【Footer】
```
含 About / Privacy / Terms / 联系邮箱 / `© 2026 Pixform`。

### 2.4 结构化数据（JSON-LD，三块）

```json
1. WebApplication
   name: Pixform
   url: https://pixform.ai/
   applicationCategory: MultimediaApplication
   offers: { price: "0", priceCurrency: "USD" }
   operatingSystem: Web

2. FAQPage（对应上面 6 条）

3. Organization
   name: Pixform
   url: https://pixform.ai/
```

---

## 三、`/face-swap/` 完整规格

### TDK

```
Title (40 字符)
AI Face Swap — Free Online Face Swapper

Meta Description (155 字符)
Swap faces in any photo with Pixform's free AI face swapper. Upload two
photos, swap faces online in seconds. No signup, no watermark, any device.

H1
AI Face Swap
```

### 页面结构

```
【首屏 · 双图工具】
┌──────────────┬──────────────┐
│ 源图上传       │ 目标脸上传     │
│ [📁]          │ [📁]          │
├──────────────┴──────────────┤
│      [ Swap Faces ]         │
│      [ 结果区 · 同屏 ]        │
└─────────────────────────────┘
```

```
【Section 2】What Is AI Face Swap?（200 词，覆盖 ai face swap / face swapper / swap faces）
【Section 3】Face Swap Ideas（吃掉长尾三层）
  · Swap faces in GIFs                → 覆盖 face swap gif（KD 10.9）
  · Gender face swap                  → 覆盖 gender face swap（KD 8.7）
  · Multiple face swap                → 覆盖 ai multiple face swap（KD 9.8）
  · Video face swap                   → 覆盖 video face swap（KD 8.1）
【Section 4】How to Do a Face Swap（4 步）→ 覆盖 how to do face swap（KD 10.9）
【Section 5】FAQ 5 条（带 FAQPage）
  1. Is AI face swap free?
  2. How long does a face swap take?
  3. Can I swap multiple faces in one photo?
  4. Does it work with group photos?
  5. Is my uploaded photo stored?
【Section 6】Related tools → 首页
```

**注意**：Section 3 的四个「Ideas」是**文字小节 + 内链到首页对应风格**，不是四个独立页面。等第 60 天看哪个词的曝光起来了，再考虑单独建页。

**红线**：`face swap porn`、`nsfw face swap`、`porn video face swap` 这类词 KD 只有 7.5~18，看起来最好做，但绝对不碰——会污染整站信号，正常工具词的排名一起崩。

---

## 四、`/photo-generator/` 规格（Day 10–14 上线）

```
Title (43)
AI Photo Generator — Create Photos from Text

H1: AI Photo Generator

结构：单文本框 + 生成按钮（首屏）→ 示例提示词 → What is AI photo
generator → FAQ 5 条 → Related tools
```

数据已确认 KD 38.1，盘面里 dream.ai 那个位次体验分只有 17/100，是能挤的位置。**但上线前我再跑一遍 SERP 复核**，确认这一个月盘面没变。

---

## 五、技术实现细节

### 5.1 API

| 功能 | 模型来源 | 备注 |
|---|---|---|
| 首页 img2img | Replicate · SDXL img2img 或 FLUX img2img | 一个接口，风格 = 提示词参数 |
| /face-swap/ | Replicate · face swap 系列模型 | 同一账号 |
| /photo-generator/ | Replicate · 文生图模型 | 同一账号 |

**实现要求：**
- **异步队列**（webhook 或轮询），不要同步阻塞——模型冷启动 2~10 秒，同步请求会超时
- 前端显示进度条 + 队列位置，等待期间不放广告、不跳转
- 失败重试 1 次，仍失败给明确错误文案 + 保留用户上传的图
- 单 IP 限流：10 次/小时（防滥用，不影响正常用户）
- 图片存对象存储 + CDN，输出 URL 用随机 hash，**结果页 `noindex`**
- 用户上传图：处理完 1 小时后自动删除（Privacy 页要写清楚这条）

### 5.2 成本估算

单次调用约 $0.002~0.01。日 500 次 ≈ **$1~5/天，$30~150/月**。第一阶段不用自建 GPU（自建 $300~500/月起）。

### 5.3 robots.txt / sitemap

```
# robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /result/

Sitemap: https://pixform.ai/sitemap.xml
```

```
# sitemap.xml（第一阶段只有 7 条）
/
/face-swap/
/photo-generator/     ← 上线后加
/about/
/privacy/
/terms/
```

sitemap **只放你想被收录的页面**。把 `/result/xxx` 这种动态结果页塞进去，会把抓取预算全烧光。

---

## 六、收录与 GSC 动作（逐周）

### Day 1 当天必须做完

1. GSC 建 **网域资源** `sc-domain:pixform.ai`（不是网址前缀资源）
2. 提交 `sitemap.xml`
3. 对 `/` 用 **URL 检查 → 测试实际网址 → 请求编入索引**
4. GA4 或 Plausible 装好，事件埋点：`upload`、`generate`、`download`、`try_again`

### Day 3–5

- `/face-swap/` 上线后同样走「测试实际网址 → 请求编入索引」
- 首页的 Section 6 加上 `/face-swap/` 卡片；`/face-swap/` 底部加回首页链接（内链双向）

### Day 7

- 查 `site:pixform.ai`，看首页收录了没有
- GSC → 网页编入索引，看「已发现-尚未编入索引」数量

### Day 14

- 查 `/face-swap/` 收录状态
- 如果首页还没收录 → 查三件事：robots 有没有拦、页面 HTML 里有没有 H1（是不是 CSR 空壳）、内容是否太薄

### Day 21 / Day 30

- 拉 GSC → 效果 → 查询，看 `image to image` 有没有出现曝光
- 有曝光的词记下来，这就是第二阶段 blog 的选题来源

> 社群里的经验（2026-05-18 每日群聊总结）：手动请求收录前先点「测试实际网址」再点「请求编入索引」，收录会快；但哥飞也提醒过——**内容不行的，手动提交也没用**，且手动只能一个个提交，量大的还是要靠内容质量和外链。

---

## 七、外链第一波（Day 7–30）

**第一阶段只求 20~30 个引用域**，不追 40~80（那是 90 天目标）。

| 渠道 | 数量目标 | 时间 | 说明 |
|---|---|---|---|
| AI 工具导航站提交 | 20~30 个 | Day 7–10 一次性做完 | 免费、当天能提交完、收录快。选有真实流量的目录，别提交到纯 spam 目录 |
| Product Hunt | 1 次发布 | Day 14–21 | 产品能稳定出图后再发，别带着 bug 上 |
| Reddit | 2~3 帖 | Day 15–30 | r/InternetIsBeautiful、r/StableDiffusion 等，**发有用内容不发广告**，大概率沉底，是概率游戏 |
| Twitter/X 建号 | 持续 | Day 1 起 | 不是外链，是品牌锚点（以后别人提到你能链到） |

11 群的讨论里给新站的节奏是「**上站要快、外链要快，初期先从导航站、博客评论这类能快速拿到的外链开始**」（2026-03-04）。这跟第一阶段的安排一致——先拿快的、免费的、真实的，Guest Post 和付费外链放到第 60 天后。

**第一阶段绝对不做**：$5 一千条的批量外链、PBN、论坛签名、脚本批量发评论。哥飞在 8 群说过「你一天发的没有几百个，就不用控制」（2025-04-22）——意思是正常节奏发没问题，但用脚本刷就是另一回事。

**竞品外链挖掘：从 image-to-image.ai、aiimagetoimage.io、ezmaker.ai 三个站的引用域里挖。用 Ahrefs 的 Site Explorer → Backlinks，按「Best links」排序，挑三类：DR<30 但流量>1000 的真实站点、做 Guest Post 的博客、还有近半年内新出现的引用域（新站能拿到的外链，你多半也能拿到）。每个站筛出 10 条去联系，三个站就是 30 个潜在目标，回复率按 10% 算能拿到 3 条——第一阶段够用了。**不要挖 canva、adobe 那些的引用域**，DR 90 的站给你的链接对你没有参考价值，你也拿不到。

---

## 八、页面之外的三件小事（漏了一件事全盘白做）

### 8.1 品牌一致性

`Pixform` 这个名字在四个地方必须一字不差：logo 文字、`og:site_name`、结构化数据里的 `name`、Footer 的 `© 2026 Pixform`。别出现 `PixForm`、`pixform`、`Pixform AI` 三种写法混用——谷歌靠这些信号判断品牌实体，写法乱就认不出来。

### 8.2 OG 图 + favicon

`og:image` 做一张 1200×630，白底黑字 `Image to Image AI · Pixform`，别放花哨设计——分享到 Reddit、Twitter 时它就是你的门面。favicon 准备 32×32 和 180×180 两套。

### 8.3 404 页

上线时就要有。用户点了死链看到 nginx 默认页，跳出率 100%；有一个带「Back to Pixform」按钮的 404 页，至少能捞回一部分。顺手把 `/result/` 的 404 也处理掉，别让它进索引。

---

## 九、第一阶段的三条红线

**红线一：不要在第 10 天就想改首页词。**
首页上线两周，GSC 里 `image to image` 一条曝光都没有——这是**正常的**，不是错了。新站前两周没有曝光，是因为排名还没建立。这时候改 H1、改 Title，等于每次都在重置，永远起不来。改词的判断点在第 90 天，不是第 10 天。

**红线二：不要为了「看起来有内容」铺页面。**
第一阶段 3 个功能页 + 3 个法务页 = 6 个页面。有人会忍不住加 `/blog/watercolor-style-guide`、`/blog/how-ai-works`——这些页面没有搜索量支撑，上线就是消耗抓取预算。blog 只写 GSC 里已经出现曝光的词。

**红线三：不要在骂产品力之前先怪 SEO。**
`/face-swap/` 这个盘面用户停留 4 分 16 秒、跳出 40%，easyfaceswap.com 体验分 81/100。你能排进去，但产品不好用就站不住。第一阶段就要盯两个自建指标：**出图成功率 > 95%、平均等待时间 < 15 秒**。这两个指标不到线，先修产品，别加外链。

---

## 十、每日执行清单（贴墙上照着做）

| 天 | 要做的事 | 时长 |
|---|---|---|
| Day 1 | 首页 + robots + sitemap + 3 个法务页上线；GSC 建资源、提交 sitemap、请求收录 | 半天 |
| Day 2 | 埋点验证（upload/generate/download 四个事件能上报）；404 页；OG 图 | 2h |
| Day 3–5 | `/face-swap/` 上线 + 请求收录；两页内链互通 | 1 天 |
| Day 6 | 首次自查：`site:pixform.ai`、页面 HTML 里有没有 H1、LCP 测一遍 | 1h |
| Day 7–10 | 提交 20~30 个 AI 导航站（列个表逐个打勾） | 每天 1h |
| Day 10–14 | `/photo-generator/` 上线（上线前叫我复核 SERP） | 1 天 |
| Day 14 | 查收录；Product Hunt 准备素材 | 2h |
| Day 15–21 | Product Hunt 发布；Reddit 第一帖 | 3h |
| Day 21 | 中期复盘：GSC 有无曝光、错误页、人工处置 | 1h |
| Day 22–30 | 按 GSC 已出现的曝光词写 2~3 篇 blog；挖竞品外链联系 10 个 | 每天 1h |
| Day 30 | 走验收清单（本文第〇节那 7 条），全绿进第二阶段 | 1h |

---

## 十一、30 天到了怎么做判断

| 情况 | 判断 | 动作 |
|---|---|---|
| 7 条验收全绿 | 正常 | 进第二阶段：深挖 face swap 词群、加第 4 个功能页、外链冲到 40 个 |
| 有收录、零曝光 | 正常偏慢 | 不加页面，加外链；再等 30 天 |
| 收录了但排名 100+ | 主题不够聚焦 | 检查首页正文有没有真正围绕 image to image 展开，有没有被其他功能稀释 |
| 首页不进索引 | 技术问题 | 逐项查 robots / noindex / CSR 空壳 / 内容过薄 |
| 有曝光但点击率为 0 | 标题没吸引力 | 改 Title 加 `Free`、`No Signup`，这是唯一允许在 30 天内改 Title 的情况 |

**注意最后一行**——这是唯一一个「30 天内允许改 Title」的例外：**有曝光、有点击机会、但没人点**。这不是改词，是改钩子。没曝光就改 Title 是瞎改。

---

第一阶段就这些。核心就一句：**6 个页面、2 个功能、20~30 个导航站外链，30 天内不折腾。**

要不要我现在把这份方案存成一份文档（以后随时能翻），再把「Day 0–30 执行清单」单独存成一张表，你每天照着打勾？另外 `/photo-generator/` 上线前记得叫我，我跑一遍 SERP 复核盘面有没有变。