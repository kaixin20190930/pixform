# 多人换脸：模型授权核查与实施入口

核查日期：2026-11-12。

## 结论

`mertguvencli/face-swap-with-indexes` 的商用授权尚未得到确认。这里的结论是“证据不足”，不是“已经证实禁止商用”。用户随后明确要求在等待回复期间继续最小功能实施。继续开发不代表商用授权已经确认，仍需等待提供方书面答复。

## 已核对的事实

- 使用现有凭据只读查询 Replicate 实际模型 API，`license_url`、`github_url`、`weights_url` 均为空。
- 拟锁定版本：`518f2116425c40acb5c234031c55daf843c1357eff784370fe9489e57b65c150`。
- API 支持 `source_face_index`、`destination_face_index`，但检测输出只有编号缩略图 URL，没有框坐标或稳定人脸 ID。
- 官方文档说明各模型许可不同，不能把平台可调用或付费调用视为某个模型的商用授权。
- 先前试验已证实：换脸后再次检测会改变编号，沿用初始编号串行处理会选错人。
- 关联现用 codeplugtech 模型的公开源码使用 InsightFace 权重；上游将代码许可与预训练模型许可分开。不能据此推断候选模型使用了相同权重，也不能推断托管提供方已经或尚未取得授权。
- Replicate 集合页提及的 `easel/advanced-face-swap`，本次实际模型 API 查询返回 404，暂不作为已经可用的替代方案。

## 用户确认继续的最小实现

1. 同一张参考脸，最多选 5 张目标脸；费用为每脸 2 credits。
2. 上传后归一化图片方向和尺寸，保存固定原图。
3. 浏览器本地检测并显示编号；编号只用于选择固定原图中的框，不用于猜测提供方的整图索引。
4. 使用 MediaPipe BlazeFace 检测框，从固定原图裁剪隔离每张脸，统一使用索引 0。不能默认所有相邻/重叠人脸都能隔离；检测框/裁剪重叠时在预留积分前提示换图。检测存在漏检可能，当前版本不提供手动框选。
5. 每张选中脸独立处理原图或原图裁剪，不输入前一次换脸的结果。
6. 服务端只合成选中区域；优先 PNG 输出以避免 JPEG 重编码影响未选中区域。原型人工区域合成成功不等于自动框/遮罩已经验证。
7. 整单预留 `2 × 选中数`，全部结果合成并保存后结算一次；失败释放全部预留。复用 D1/R2、当前任务与清理机制，不先增加独立队列或工作流平台。
8. 功能可用后再发布 `/multiple-face-swap`，同步首页、单脸页、Pricing 的口径和入口。

## 授权询问信（已发送，等待回复）

2026-11-12，经用户明确授权，从 Replicate 账单关联邮箱 `liukai19911010@gmail.com` 发出。Gmail 已返回 `SENT` 状态。

- Gmail message/thread ID：`1a1d024d608d0925`
- [查看已发送邮件](https://mail.google.com/mail/u/?authuser=liukai19911010%40gmail.com#all/1a1d024d608d0925)

收件人：support@replicate.com

Subject: Commercial hosted API license clarification for face-swap-with-indexes

Hello Replicate Support,

We are evaluating the following model for Pixform (https://pixform.ai), operated by Moxion Labs LLC, a US company:

- Model: mertguvencli/face-swap-with-indexes
- Version: 518f2116425c40acb5c234031c55daf843c1357eff784370fe9489e57b65c150

Its model API currently returns null for license_url and github_url. Before using it in production, could you or the model publisher confirm in writing:

1. Whether this exact version may be called through Replicate's hosted API in a paid, credit-based SaaS offered to end users.
2. Which license or provider terms grant that use, and whether all underlying model weights permit that hosted commercial use or are covered by the provider's licenses. Is a separate license required from us?
3. Whether our users may download and commercially use the generated images, subject to their input rights and permissions.
4. Whether a supported API can return face bounding boxes together with their corresponding source/destination indexes for the same immutable input image. The current face_index mode returns only a labeled thumbnail report.

The planned feature uses one reference face, up to five user-selected target faces, independent processing of the original input, and local compositing of the selected regions. We do not intend to download or self-host the model weights.

If this model is not covered, please point us to a currently available model with explicit commercial hosted-API terms and selective face replacement support. Please advise whether codeplugtech/face-swap (version 278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34) has documented commercial hosted-API terms as well, since Pixform currently uses that model for single-face swaps.

Thank you.

## 来源

- https://replicate.com/mertguvencli/face-swap-with-indexes
- https://replicate.com/docs/reference/how-does-replicate-work/
- https://replicate.com/terms
- https://github.com/deepinsight/insightface#license
- https://github.com/tzktz/face-swap/blob/main/predict.py

本轮仅做只读授权核查，没有新增模型出图调用。前轮 20 次调用的授权额度已用完。

## 最小实现与验证记录（2026-11-12）

- 新增 `/multiple-face-swap`；单一参考脸、最多 5 张已检测目标脸、每脸 2 credits。
- MediaPipe 在浏览器中检测，左右排序编号仅用于选择框。每个目标区域从归一化原图独立裁剪，提供方只处理该区域内索引 0；从不把上一次换脸结果作为下一次输入。
- 过近或重叠的选中区域在预留积分前拒绝。未检测到的人脸不能手动指定。输出为 PNG，最长边不超过 1600 像素，选中区域之外的归一化原图像素保持不变。
- 复用现有私有 R2、任务签名、分钟清理及积分预留/结算；全部成功才捕获积分，任一失败释放整单预留。刷新页面可恢复原任务。
- 浏览器完成五人拼接样例的 5 框检测、编号勾选、单参考脸上传和 10 credits 总价验证；这不是自然五人合影的全面质量验收。
- 27 项测试通过，包含五区域合成、并发只启动一次、整单退回只发生一次，以及 Cloudflare workerd 内 PNG 解码/合成/导出；提供方调用使用模拟响应。
- 类型检查、Cloudflare 构建及本地 SEO smoke 通过。Pricing 文本维持 500–700 词，FAQ 与 JSON-LD 一致。
- 修复现有 `reserveCredits` SQL 多传一个参数的问题，确保调用实际预留函数的测试通过。
- 本轮没有新增付费推理、没有 Stripe 付款。此前获准的 20 次真实模型调用已经用完，当前裁剪流程没有追加真实推理验收。
- 用户重新登录后，已应用生产迁移 `0005_multiple_face_swap.sql` 并部署正式 Worker。

发布顺序：

```sh
npx wrangler d1 migrations apply pixform --remote
npm run cf:build
npm run deploy
npm run seo:production-smoke
```

新增迁移仅创建 `multiple_face_jobs` 表，不删除现有业务数据。商用许可继续等待工单 02429944 正式回复；自动建单回执不是授权证明。

## 生产部署结果（2026-11-12）

- 正式页面：https://pixform.ai/multiple-face-swap
- Worker 版本：`be1c11af-b2ba-4d26-8191-6dba1b7ea6cb`。
- 新页 HTTP 200，自指 canonical、唯一 H1、8 条 FAQ 与结构化数据一致；首页和单脸页入口、Pricing 内链及 sitemap 检查通过。
- 检测模型与两个 WASM 路由均返回 200；WASM 类型为 `application/wasm`。
- 无有效任务 token 的状态请求返回 404；未登录 POST 返回 401 / `AUTH_REQUIRED`，不启动模型或预留积分。
- `npm run seo:production-smoke` 通过，现已把新页纳入同一脚本的定期检查；Pricing 可读词数为 691。
- 发布没有创建真实模型预测，也没有发起 Stripe 付款。
