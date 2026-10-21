# `/face-swap/` 子页面完整实施方案

---

## 一、页面目标

| 指标 | 目标 | 验收时间 |
|---|---|---|
| 页面收录 | 已编入索引 | Day 7 |
| `ai face swap` 曝光 | ≥ 1 次 | Day 30 |
| 长尾词曝光 | 至少 3 个词有曝光 | Day 60 |
| 停留时间 | > 3 分钟 | Day 30 |
| 出图成功率 | > 95% | Day 1（上线当天） |

---

## 二、TDK

```
Title (45 字符):
AI Face Swap — Free Online Face Swapper

Meta Description (153 字符):
Swap faces in any photo with Pixform's free AI face swapper.
Upload two photos, swap faces online in seconds. No signup,
no watermark, works on any device.

H1:
AI Face Swap
```

**URL：** `https://pixform.ai/face-swap/`（不带尾斜杠，统一跳转）

**Title 设计理由：** `AI Face Swap` 锚定核心词（KD 44.8，月搜 13.5 万），`Free Online Face Swapper` 同时覆盖变体词 "face swapper" 和 "online face swap"。品牌 `Pixform` 不进 Title——字符合让给关键词。

---

## 三、词群覆盖计划（一个页面吃掉一整族）

| 层级 | 覆盖位置 | 词 | KD | 月搜索量 |
|---|---|---|---|---|
| **核心** | Title + H1 | ai face swap | 44.8 | 13.5 万 ↑ |
| **变体** | Title + 正文 | face swapper、swap faces | 预筛 45~50 | 24.6 万 |
| **免费** | Description + 正文 | free face swap、face swap free、face swap online free | 预筛 45~46 | 4.1 万 |
| **视频** | Section 4 卡片 + "Coming soon" | video face swap、swap faces video、realtime face swap | **8.1~16.9** | 小 |
| **长尾** | Section 4 卡片 + FAQ | face swap gif、gender face swap、ai multiple face swap、how to do face swap | **8.7~14.9** | 小 |

**红线：** `face swap porn`（KD 7.5）、`nsfw face swap`（KD 18）这些 KD 极低的成人词绝对不碰——会污染整站信号。

---

## 四、页面结构（逐段，含可复用的文案）

### Section 1 · Hero + 工具（第一屏完整可见）

```
┌──────────────────────────────────────────────┐
│                                              │
│  AI Face Swap                                │
│  Swap faces in any photo — free, instant,    │
│  no signup.                                  │
│                                              │
│  ┌────────────────┐  ┌────────────────┐      │
│  │  Source photo   │  │  Target face    │      │
│  │                 │  │                 │      │
│  │  [📁 Click or   │  │  [📁 Click or   │      │
│  │   drag here]    │  │   drag here]    │      │
│  │  JPG/PNG/WEBP   │  │  JPG/PNG/WEBP   │      │
│  │  up to 10 MB    │  │  up to 10 MB    │      │
│  └────────────────┘  └────────────────┘      │
│                                              │
│  [ Swap Faces ]  ← 主按钮，只有一个            │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  [ Source ]  [ Target ]  [ Result ]   │    │
│  │         ✳  预览区                     │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [ Download ]  [ Try another photo ]         │
│                                              │
│  Free to try · No signup · 10 attempts/hour  │
│                                              │
└──────────────────────────────────────────────┘
```

**三个关键决定：**
1. **双图上传区**——换脸本质是两张图，不是一张。比首页的单图上传多一个坑位
2. **结果同屏展示**，不跳转 `/result/xxx`——跳转会打断停留
3. **`Try another photo` 按钮**——对标 easyfaceswap.com 的 4 分 16 秒停留

---

### Section 2 · How It Works（4 步图标卡）

```
1. Upload your source photo
   → The photo with the body or scene you want to keep.

2. Upload the face you want to swap in
   → A clear front-facing photo works best.

3. Click "Swap Faces"
   → Our AI detects both faces, aligns them, and blends naturally
     in seconds.

4. Download your swapped photo
   → Save it, share it, or try another swap. No watermark, no limits.
```

---

### Section 3 · What Is AI Face Swap?（200~300 词正文）

以下文案已自然覆盖全部核心词和变体词，可直接用：

```
AI face swap uses artificial intelligence to detect faces
in two photos and swap one face onto the other — while
keeping lighting, skin tone, and facial expressions natural.

Unlike basic photo editing tools that require hours of
manual work, Pixform's AI face swapper does it in seconds.
Just upload your source photo and the face you want to
swap in. The AI handles everything: face detection,
alignment, blending, and color matching.

This free online face swapper works on any device —
desktop, tablet, or phone. No app download, no signup
required. You can swap faces in portraits, group photos,
and even creative projects like face swap GIFs and video
face swaps. Try it now and see how easy swapping faces
online can be.
```

**这段覆盖的词：** ai face swap · face swapper · swap faces online · free face swapper · face swap GIFs · video face swaps

---

### Section 4 · More Ways to Swap Faces（4 张卡片，不是独立页面）

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Face Swap    │  │ Multiple     │  │ Gender       │  │ Video        │
│ GIF          │  │ Face Swap    │  │ Face Swap    │  │ Face Swap    │
│              │  │              │  │              │  │              │
│ Turn your    │  │ Swap faces   │  │ See yourself │  │ Coming soon  │
│ face swap    │  │ in group     │  │ as another   │  │ — video face │
│ into an      │  │ photos with  │  │ gender with  │  │ swap support │
│ animated     │  │ multiple     │  │ AI. Fun,     │  │ on the way.  │
│ GIF.         │  │ people.      │  │ instant.     │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**这是整个页面最精妙的设计：** 四张卡片不是四个独立页面，是功能描述区 + 未来路线图。它们同时锁死了四个长尾词群：

| 卡片 | 覆盖的词 | KD |
|---|---|---|
| Face Swap GIF | face swap gif、face swap gif ai | 10.9~14.3 |
| Multiple Face Swap | ai multiple face swap、face swap multiple | 9.8~14.9 |
| Gender Face Swap | gender face swap | 8.7 |
| Video Face Swap | video face swap、swap faces video、realtime face swap | 8.1~16.9 |

**拆页时机：** 第 60 天之后，哪个词的 GSC 曝光稳定了，再考虑给它建独立页面。第 60 天之前一个都不拆——这是批量化上页面的反面。

---

### Section 5 · FAQ（6 条，带 FAQPage 结构化数据）

| # | 问题 | 覆盖的词 |
|---|---|---|
| 1 | Is this AI face swap free to use? | free face swap |
| 2 | How long does a face swap take? | how to do face swap（变体） |
| 3 | Can I swap multiple faces in one photo? | ai multiple face swap |
| 4 | Do you store my uploaded photos? | 信任信号（隐私） |
| 5 | What image formats work for face swap? | 功能说明 |
| 6 | Can I do a face swap on my phone? | face swap online（设备覆盖） |

每条一问一答，100 字以内。不用为了塞关键词写废话——谷歌现在读得懂语义，覆盖到位就行。

---

### Section 6 · Related Tools

只链已上线的页面。当前状态：

```
→ Image to Image AI
   Transform your photos with different styles

→ More AI image tools coming soon
```

等 `/photo-generator/` 上线后加第二张卡片。

---

## 五、面包屑与导航

**面包屑（页面顶部）：**
```
🏠 Home  ›  Face Swap
```

**首页加卡片**（首页 Section 某个位置，建议放在 FAQ 区和 Footer 之间）：

```
┌─────────────────────────────────────────────┐
│  More AI Image Tools                        │
│                                             │
│  ┌──────────────┐                           │
│  │ AI Face Swap │  ← 新卡片                  │
│  │              │                            │
│  │ Swap faces   │                            │
│  │ in any photo │                            │
│  │ instantly    │                            │
│  │ [ Try now → ]│                            │
│  └──────────────┘                           │
│                                             │
│  More tools coming soon...                  │
└─────────────────────────────────────────────┘
```

**导航 Header** 里加 `Face Swap` 入口（排在 `Image to Image` 下面或旁边）。

---

## 六、技术实现

| 项 | 要求 | 说明 |
|---|---|---|
| **API** | Replicate · face swap 模型 | 搜 "face swap" 挑评分最高的（insightface / roop 系列），与首页同一账号 |
| **渲染** | SSR，首屏 HTML 含 H1 和正文 | 跟首页一样——Next.js App Router，不改架构 |
| **异步** | 队列 + 轮询 + 前端进度条 | 模型冷启动 2~10 秒，别同步阻塞 |
| **限流** | 单 IP 10 次/小时 | 与首页共用限流逻辑 |
| **存储** | 处理后 1 小时内自动删除 | 与首页同一个对象存储 bucket |
| **结果页** | `noindex` | robots meta 或 x-robots-tag |
| **canonical** | 自指 `https://pixform.ai/face-swap/` | |
| **结构化数据** | WebApplication + FAQPage + BreadcrumbList | FAQPage 对应 Section 5 的 6 条 |

---

## 七、结构化数据（JSON-LD 三块，贴在 `<head>` 里）

### WebApplication

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Pixform AI Face Swap",
  "url": "https://pixform.ai/face-swap/",
  "applicationCategory": "MultimediaApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
```

### FAQPage

Section 5 的 6 条 Q&A，格式：

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is this AI face swap free to use?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, Pixform's face swapper is completely free. No signup, no credit card, no watermark on your output."
      }
    }
    // ... 其余 5 条
  ]
}
```

### BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://pixform.ai/" },
    { "@type": "ListItem", "position": 2, "name": "Face Swap", "item": "https://pixform.ai/face-swap/" }
  ]
}
```

---

## 八、页面 SEO 自检清单（上线前逐项打勾）

| # | 检查项 | 标准 |
|---|---|---|
| 1 | Title 长度 | ≤ 60 字符 ✅（45） |
| 2 | Meta Description | ≤ 160 字符，含 free / no signup ✅ |
| 3 | H1 只有一个 | ✅ `AI Face Swap` |
| 4 | canonical 自指 | `https://pixform.ai/face-swap/` |
| 5 | hreflang | `en-US` |
| 6 | robots meta | `index, follow` |
| 7 | `<html lang>` | `en-US` |
| 8 | SSR 直出 | 关掉 JS 页面空白 = 废了 |
| 9 | 图片有 alt | 上传区图标、示例图都要有 |
| 10 | 按钮是 `<button>` | 不是 `<div onclick>` |
| 11 | 结果区 noindex | 动态结果页不能被收录 |
| 12 | OG 标签完整 | title / description / image |
| 13 | 结构化数据语法正确 | 用 Google Rich Results Test 跑一遍 |
| 14 | LCP < 2.5s | 首屏双图上传区就是 LCP |
| 15 | 页面有至少 300 词正文 | Section 3 + Section 5 FAQ 够了 |

---

## 九、上线步骤（逐项执行，不要跳）

| 步骤 | 时机 | 说明 |
|---|---|---|
| 1. 调通 face swap API | 开发期 | 本地先跑通，确认模型选对、出图质量过关 |
| 2. 按结构搭建页面 | 开发期 | 照上面 Section 1~6 逐段搭，别加新东西 |
| 3. 部署上线 | 完成即部署 | 别等完美——先上线再迭代 |
| 4. 加到 sitemap | 上线当天 | `<url><loc>https://pixform.ai/face-swap/</loc></url>` |
| 5. GSC 请求收录 | 上线后立即 | URL 检查 → 测试实际网址 → 请求编入索引 |
| 6. 首页加卡片 | 上线当天 | 在 FAQ 下方加 "More AI Image Tools" 区 |
| 7. Header 导航加入口 | 上线当天 | "Face Swap" 链接 |
| 8. 结构化数据验证 | 上线当天 | Google Rich Results Test 跑 FAQPage |

---

## 十、上线后第一周动作

| 天 | 动作 |
|---|---|
| Day 0 | 上线 + sitemap + GSC 请求收录 + 首页加卡片 + Header 导航入口 |
| Day 1 | 自测上传两张图换脸，确认出图成功、结果页 noindex、结构化数据语法正确 |
| Day 3 | GSC → 网页编入索引 → 看有没有「已发现-尚未编入索引」 |
| Day 5 | 如果还没收录，手动再请求一次 |
| Day 7 | 验收：`site:pixform.ai/face-swap` 出现在搜索结果 = ✅ |

---

## 十一、与首页的内链关系

```
首页 (/)
├── Header 导航 → Face Swap
├── "More AI Image Tools" 区 → Face Swap 卡片
└── Footer

/face-swap/
├── 面包屑 → Home
├── Section 6 "Related Tools" → 首页
└── Footer（同一套全局导航）
```

**双向互链、权重闭环。** 首页给 `/face-swap/` 分权，`/face-swap/` 通过面包屑和底部链接回流首页。这是第一阶段两页结构的基础内链模型——以后每加一个新工具页，复用同一套模式。

---

方案已经完整交付（记忆卡片已生成，你点一下「记住」就能存下来以后随时翻）。

现在要你做的事：**调通 Replicate 的 face swap 模型，按上面的 Section 1~6 搭页面，部署上线。** 上线后叫我——我帮你跑页面体检、确认收录。