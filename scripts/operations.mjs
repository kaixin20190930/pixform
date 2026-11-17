import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const config = read('operations/config.json');
const materials = read('operations/materials.json');
const queue = read('operations/social-queue.json');
const output = path.join(root, '.cache/operations');
const eventsFile = path.join(output, 'social-events.jsonl');
const events = () => fs.existsSync(eventsFile)
  ? fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const escape = (value) => String(value ?? '未核实').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone,
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function backlinks() {
  const dbFile = path.join(config.sharedBacklinksRoot, 'data/backlinks.sqlite');
  let db;
  try {
    db = new DatabaseSync(dbFile, { readOnly: true });
    const site = db.prepare('SELECT id FROM sites WHERE domain = ?').get('pixform.ai');
    if (!site) throw new Error('原账本没有 pixform.ai，不能按零处理');
    const attempts = ['submission_attempts', 'experimental_submission_attempts'].flatMap((table) =>
      db.prepare(`SELECT x.id, x.status, x.submitted_at, x.checked_at,
        p.domain AS platform, lp.url AS target
        FROM ${table} x JOIN opportunities o ON o.id=x.opportunity_id
        JOIN platforms p ON p.id=o.platform_id
        LEFT JOIN landing_pages lp ON lp.id=o.landing_page_id
        WHERE o.site_id=? ORDER BY x.id DESC`).all(site.id)
        .map((row) => ({ ...row, ledger: table })));
    const route = db.prepare('SELECT lane FROM workflow_routes WHERE site_id=?').get(site.id);
    const groups = Object.groupBy(attempts, (row) => `${row.ledger}:${row.status}`);
    return { available: true, source: dbFile, lane: route?.lane ?? 'shared (默认路由)',
      counts: Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, rows.length])),
      todayRecordedAttempts: attempts.filter((a) => a.submitted_at &&
        new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone,
          year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(a.submitted_at)) === day).length,
      note: '原始状态不折算成引用域或公开上线数；active 仍需独立公开证据。不同轨道分列，不将两表简单合计为独立域名。', attempts };
  } catch (error) {
    return { available: false, source: dbFile, error: error.message };
  } finally { db?.close(); }
}

function record(file) {
  if (!file) throw new Error('用法：npm run ops:record -- /absolute/path/event.json');
  const event = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const key of ['id', 'at', 'status', 'platform', 'account', 'evidence', 'note']) {
    if (typeof event[key] !== 'string' || !event[key].trim()) throw new Error(`缺少 ${key}`);
  }
  if (!/^[\w.-]+$/.test(event.id)) throw new Error('事件 ID 只允许字母数字、下划线、点或连字符');
  if (!['draft', 'blocked', 'pending', 'unknown', 'published', 'removed'].includes(event.status)) throw new Error('未知状态');
  if (!Number.isFinite(Date.parse(event.at)) || Date.parse(event.at) > Date.now() + 60000) throw new Error('实际时间无效或在未来');
  if (events().some((x) => x.id === event.id)) throw new Error('重复事件 ID，不重复追加');
  if (!fs.existsSync(path.resolve(root, event.evidence)) && !/^https:\/\//.test(event.evidence)) throw new Error('证据必须是已有文件或 HTTPS 来源');
  if (event.status === 'published' && (event.publicVerified !== true || !/^https:\/\//.test(event.url ?? ''))) throw new Error('published 需要公开直链及独立核验；否则使用 pending/unknown');
  fs.mkdirSync(output, { recursive: true });
  fs.appendFileSync(eventsFile, `${JSON.stringify(event)}\n`, { mode: 0o600 });
  console.log(`已记录 ${event.id}：${event.status}；这是本地索引，不替代统一协调回执。`);
}

function refresh() {
  fs.mkdirSync(path.join(output, 'runs'), { recursive: true });
  const snapshot = { capturedAt: new Date().toISOString(), day, backlinks: backlinks(), socialEvents: events() };
  fs.writeFileSync(path.join(output, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  const rows = (items) => items.map((cells) => `<tr>${cells.map((c) => `<td>${escape(c)}</td>`).join('')}</tr>`).join('');
  const list = (items) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`;
  const b = snapshot.backlinks;
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixform 运营看板</title><style>body{font:16px/1.65 system-ui;max-width:1100px;margin:32px auto;padding:0 24px;color:#172033;background:#f8fafc}section{background:white;border:1px solid #dce3ed;border-radius:12px;padding:24px;margin:20px 0}h1,h2{line-height:1.3}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;padding:9px;border-bottom:1px solid #e5e7eb;vertical-align:top}code{background:#eef2ff;padding:3px 5px}small{color:#526076}li{margin:8px 0}.warning{color:#9f3610}a{color:#244acf}</style>
  <h1>Pixform 运营看板</h1><p>外链沿用共享账本 · 社媒以有效帮助和公开证据验收</p><small>快照 ${escape(snapshot.capturedAt)} · 本地文件，不对外部署</small>
  <section><h2>执行节奏</h2><p>08:55 原外链总控（最多 2 次，实际资格与滚动配额以原系统为准）<br>09:15 原 SEO 健康任务<br>11:30 Pixform 运营检查与社媒；周五在同一次运行复盘</p><p>授权：${escape(config.authorization)}</p><p>前两周截至 11/30 不主动附产品链接；12/01 起仍须版规允许和关系披露。当前个人主页投稿存在已知阻塞，不重复尝试。</p></section>
  <section><h2>原外链账本</h2>${b.available ? `<p>路由：${escape(b.lane)}。今日原账本记录 ${b.todayRecordedAttempts} 条尝试（不是公开上线数）。</p><table><tr><th>轨道与原状态</th><th>条数</th></tr>${rows(Object.entries(b.counts))}</table><p>${escape(b.note)}</p><table><tr><th>平台</th><th>轨道 / ID</th><th>状态</th><th>提交时间</th></tr>${rows(b.attempts.map((a) => [a.platform, `${a.ledger} #${a.id}`, a.status, a.submitted_at]))}</table>` : `<p class="warning">数据不可读：${escape(b.error)}。不能显示为 0。</p>`}</section>
  <section><h2>准确产品材料</h2><p>${escape(materials.shortDescription)}</p><table><tr><th>工具</th><th>积分</th><th>能力边界</th></tr>${rows(materials.tools.map((t) => [t.name, t.credits ?? `${t.creditsPerFace}/脸`, t.limit]))}</table><p>10 credits 一次性，需 Google 登录；Pro $9/月 300 credits。换脸模型商用授权仍待确认。</p></section>
  <section><h2>社媒选题队列</h2><p>${escape(queue.note)}</p><table><tr><th>选题</th><th>所需素材</th><th>状态</th></tr>${rows(queue.topics.map((t) => [t.angle, t.asset, t.status]))}</table><p>研究入口均待当天版规核实：${queue.researchEntrypoints.map((x) => escape(x.url)).join(' · ')}</p></section>
  <section><h2>本地社媒事件</h2><p>以下只索引本地已记录事件；空表表示本地尚未建档，不代表外部历史为零。</p><table><tr><th>时间</th><th>平台 / ID</th><th>状态</th><th>结果</th></tr>${rows(snapshot.socialEvents.map((x) => [x.at, `${x.platform} / ${x.id}`, x.status, x.note]))}</table></section>
  <section><h2>操作手册与验收</h2>${list(config.runbook)}<h3>社媒边界</h3>${list(config.social.rules)}<h3>材料禁止口径</h3>${list(materials.avoid)}<p>更新看板：<code>npm run ops:refresh</code><br>材料与政策：operations/config.json、materials.json、social-queue.json<br>执行日志：.cache/operations/runs/；事件索引：.cache/operations/social-events.jsonl</p></section></html>`;
  fs.writeFileSync(path.join(output, 'index.html'), html);
  console.log(JSON.stringify({ day, backlinks: b.available ? b.counts : b.error,
    dashboard: path.join(output, 'index.html'), socialEventsRecordedLocally: snapshot.socialEvents.length }, null, 2));
  if (!b.available) process.exitCode = 1;
}

try {
  const command = process.argv[2] ?? 'refresh';
  if (command === 'refresh') refresh();
  else if (command === 'record') record(process.argv[3]);
  else throw new Error('只支持 refresh 或 record；此脚本不会联网发布，也不写共享外链库。');
} catch (error) { console.error(error.message); process.exitCode = 1; }
