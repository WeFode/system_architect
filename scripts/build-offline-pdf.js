const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const panel = path.join(root, "交互学习面板");
const htmlPath = path.join(root, "dist", "offline-study.html");
const pdfPath = path.join(root, "系统架构设计师-离线学习手册.pdf");

function loadWindow(file) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(panel, file), "utf8"), ctx);
  return ctx.window;
}
function extractConst(src, name) {
  const key = `const ${name} = `;
  const i = src.indexOf(key);
  if (i < 0) throw new Error("missing " + name);
  let j = i + key.length, depth = 0, started = false;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "{" || c === "[") { depth++; started = true; }
    else if (c === "}" || c === "]") depth--;
    if (started && depth === 0) { j++; break; }
  }
  return vm.runInNewContext("(" + src.slice(i + key.length, j) + ")");
}

const data = loadWindow("data.js");
const { renderMarkdown } = loadWindow("md.js");
const appSrc = fs.readFileSync(path.join(panel, "app.js"), "utf8");
const SCN = extractConst(appSrc, "SCN");
const CACHE = extractConst(appSrc, "CACHE");
const PLAN = extractConst(appSrc, "PLAN");
const outline = fs.readFileSync(path.join(root, "背诵总提纲.md"), "utf8");
const { html: outlineHtml } = renderMarkdown(outline);

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const modName = (id) => (data.MODS.find((m) => m.id === id) || { name: id }).name;
const stars = (n) => "★★★★★".slice(0, n);

function cardHtml(c) {
  return `<article class="card">
    <p class="meta">${esc(modName(c.m))}</p>
    <h3>${esc(c.q)}</h3>
    <p class="pre">${esc(c.a)}</p>
    ${c.k ? `<p><span class="tag">口诀</span> ${esc(c.k)}</p>` : ""}
    ${c.l ? `<p><span class="tag">生活类比</span> ${esc(c.l)}</p>` : ""}
    ${c.t ? `<p><span class="tag">考法</span> ${esc(c.t)}</p>` : ""}
  </article>`;
}

const cardsHtml = data.MODS.map((m) => {
  const list = data.CARDS.filter((c) => c.m === m.id);
  return `<h2>${esc(m.name)}（${list.length} 张）</h2>` + list.map(cardHtml).join("");
}).join("");

const mapHtml = `
<h2>考试结构</h2>
<p>三科满分都是 75，及格线 45。综合知识、案例分析、论文一次全过才拿证。机考上午是综合知识加案例，下午是论文，具体时长以当年报名公告为准。</p>
<table>
  <tr><th>科目</th><th>形式</th><th>策略</th></tr>
  <tr><td>综合知识</td><td>75 道单选</td><td>架构、基础、软工约占三分之二，先稳这三块</td></tr>
  <tr><td>案例分析</td><td>第 1 题必答，后 4 选 2</td><td>第 1 题几乎固定考质量属性与评估，必须拿满</td></tr>
  <tr><td>论文</td><td>4 选 1，120 分钟</td><td>一个真实项目加上质量属性策略素材库</td></tr>
</table>
<h2>综合知识分值分布（估算，满分 75）</h2>
<table>
  <tr><th>模块</th><th>约计</th></tr>
  ${data.WEIGHTS.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v} 分</td></tr>`).join("")}
</table>
<p class="note">来源：历年真题经验估算，以当年考试大纲为准。</p>
<h2>一页纸骨架</h2>
${data.MODS.map((m) => `<article class="card"><h3>${esc(m.name)} · 约 ${m.score} 分 · ${data.CARDS.filter((c) => c.m === m.id).length} 张卡</h3><ul>${m.hook.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></article>`).join("")}
`;

const scnHtml = SCN.map((s) => `<article class="card">
  <h2>${esc(s.name)}</h2>
  <p>${esc(s.story)}</p>
  <p class="note">生活类比：${esc(s.life)}</p>
  <p><b>质量属性优先级</b></p>
  <ul>${s.qa.map(([n, v]) => `<li>${esc(n)} ${stars(v)}</li>`).join("")}</ul>
  <p><b>CAP</b>　${esc(s.cap)}</p>
  <p><b>风格</b>　${esc(s.style)}</p>
  <p><b>事务</b>　${esc(s.tx)}</p>
  <p><b>缓存</b>　${esc(s.cache)}</p>
  <p><b>方案</b></p>
  <ol>${s.arch.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
  <p><b>踩坑</b>　${esc(s.pit)}</p>
  <p><b>考点</b>　${esc(s.exam)}</p>
</article>`).join("");

const cacheHtml = Object.values(CACHE).map((c) => `<article class="card">
  <h3>${esc(c.name)} · 数据库压力 ${c.load}%</h3>
  <p>${esc(c.cause)}</p>
  <p class="note">生活类比：${esc(c.life)}</p>
  <ul>${c.fix.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
  ${c.say ? `<p><b>答题话术</b>　${esc(c.say)}</p>` : ""}
</article>`).join("") + `<p class="note">秒记：不存在的 key 是穿透；一个热点是击穿；一大片同时是雪崩。</p>`;

function permTable(model, subj) {
  const names = model === "blp" ? ["公开", "秘密", "机密", "绝密"] : ["低可信", "一般", "可信", "高可信"];
  const canRead = (s, o) => model === "blp" ? s >= o : s <= o;
  const canWrite = (s, o) => model === "blp" ? s <= o : s >= o;
  const rows = [3, 2, 1, 0].map((i) => `<tr><td>${names[i]}${i === subj ? "（同级）" : ""}</td><td>${canRead(subj, i) ? "允许" : "禁止"}</td><td>${canWrite(subj, i) ? "允许" : "禁止"}</td></tr>`).join("");
  return `<h3>主体为「${names[subj]}」</h3><table><tr><th>客体</th><th>读</th><th>写</th></tr>${rows}</table>`;
}

const blpHtml = `
<p>口诀：BLP 下读上写，Biba 上读下写。说的是允许的方向。</p>
<h2>BLP（机密性）</h2>
<p>低级别不能读高级别（不上读），高级别不能写到低级别（不下写），防止机密往下泄露。生活类比：士兵看不了将军的文件；将军不能把机密贴到士兵公告栏。</p>
<p>面板默认：主体「秘密」、客体「机密」→ 读禁止，写允许。</p>
${permTable("blp", 1)}
<h2>Biba（完整性）</h2>
<p>不能读比自己低可信的数据（不下读），不能写到比自己高可信的对象（不上写），防止脏数据往上污染。生活类比：教科书不引用小道消息；普通人不能改教科书。</p>
<p>同一档位对照：主体「一般」、客体「可信」→ 读允许，写禁止。</p>
${permTable("biba", 1)}
`;

const a = 0.9, b = 0.9, c = 0.9;
const mixP = 1 - (1 - b) * (1 - c);
const relHtml = `
<h2>串并联可靠度（面板默认 R1=R2=R3=0.9）</h2>
<ul>
  <li>三个串联：R = 0.9 × 0.9 × 0.9 = ${(a * b * c).toFixed(4)}</li>
  <li>三个并联：R = 1 − (1−0.9)³ = ${(1 - (1 - a) * (1 - b) * (1 - c)).toFixed(4)}</li>
  <li>R1 串联（R2 并联 R3）：R2∥R3 = ${mixP.toFixed(4)}，R = ${(a * mixP).toFixed(4)}</li>
</ul>
<p class="note">串联像灯串，坏一个全灭；并联像多个水龙头，全坏才断水。</p>
<h2>可用性（面板默认 MTTF 2000 小时，MTTR 2 小时）</h2>
<p>A = MTTF / (MTTF + MTTR) = ${(2000 / 2002 * 100).toFixed(4)}%。MTBF = 2002 小时。年停机约 ${((1 - 2000 / 2002) * 8760).toFixed(2)} 小时。</p>
<table>
  <tr><th>可用性</th><th>年停机</th><th>记忆</th></tr>
  <tr><td>99%</td><td>约 3.65 天</td><td>两个 9</td></tr>
  <tr><td>99.9%</td><td>约 8.76 小时</td><td>三个 9</td></tr>
  <tr><td>99.99%</td><td>约 52.6 分钟</td><td>四个 9，常见目标</td></tr>
  <tr><td>99.999%</td><td>约 5.26 分钟</td><td>五个 9，电信级</td></tr>
</table>
<h2>上午计算题（面板默认例题）</h2>
<article class="card">
  <h3>内存 A0000H～DFFFFH，按 8 位编址，芯片 32K×8 位</h3>
  <p>DFFFF − A0000 + 1 = 40000H = 262144 个单元 = 256K。芯片数 = 256K × 8 ÷（32K × 8）= 8 片。</p>
  <p class="note">秒算：末尾 4 个 0 就是 64K（16⁴ = 2¹⁶）。</p>
</article>
<article class="card">
  <h3>流水线各段 2、1、3，指令 100 条</h3>
  <p>T = 6 + (100 − 1) × 3 = 303 Δt。吞吐率 = 100 / 303 ≈ 0.3300 条/Δt。加速比 = 600 / 303 ≈ 1.98。</p>
</article>
<article class="card">
  <h3>不死锁最少资源：5 个进程，每个最多要 3 个</h3>
  <p>R = n(m − 1) + 1 = 5 × 2 + 1 = 11。每个进程都差一个时仍剩 1 个，总有进程能跑完并释放资源。</p>
</article>
<article class="card">
  <h3>海明码：数据位 32</h3>
  <p>找最小 k，使 2^k ≥ n + k + 1。2⁶ = 64 ≥ 32 + 6 + 1 = 39，所以 6 位校验。</p>
</article>
`;

const quizHtml = data.QUIZ.map((q, i) => `<article class="card">
  <p class="meta">${i + 1}. ${esc(modName(q.m))}</p>
  <h3>${esc(q.q)}</h3>
  <ol class="opts">${q.o.map((o, j) => `<li class="${j === q.r ? "right" : ""}">${esc(o)}</li>`).join("")}</ol>
  <p><b>答案 ${"ABCD"[q.r]}</b>　${esc(q.w)}</p>
</article>`).join("");

const trigHtml = data.TRIGGERS.map(([a, b]) => `<p class="pair"><b>${esc(a)}</b><br>${esc(b)}</p>`).join("");

const tplHtml = `
<h2>案例分析第 1 题（必答）</h2>
<article class="card"><h3>质量属性归类</h3><p>属于 XX 质量属性，原因是该描述关注……（引用题干原词）。判定树：时间或并发看性能；故障或恢复看可用性；攻击或授权看安全性；改动或人天看可修改性。</p></article>
<article class="card"><h3>敏感点 / 权衡点 / 风险点</h3><p>影响一个质量属性是敏感点；影响多个且此消彼长是权衡点；可能出问题是风险点。</p></article>
<article class="card"><h3>架构风格对比选择</h3><p>风格特点，再写与本系统需求的匹配，最后给结论。每一点都带题干原词。</p></article>
<article class="card"><h3>效用树填空</h3><p>第二层填质量属性名，叶子填场景编号。注意场景六要素。</p></article>
<p class="note">得分三件套：术语、题干原词、因果。一般 1 个要点 1 到 2 分。</p>
<h2>其他案例题型</h2>
<table>
  <tr><th>题型</th><th>答题骨架</th></tr>
  <tr><td>数据库 / 缓存</td><td>成因，方案（布隆过滤器、互斥锁、随机过期、Cache Aside），优缺点</td></tr>
  <tr><td>Redis 选型</td><td>ZSet 排行、Hash 对象、List 队列、Set 去重，再选 RDB 或 AOF</td></tr>
  <tr><td>反规范化</td><td>手段，性能收益，一致性保障（触发器、应用同步、批处理）</td></tr>
  <tr><td>Web / 微服务</td><td>网关、注册中心、负载均衡、熔断限流降级、消息队列削峰解耦</td></tr>
  <tr><td>嵌入式</td><td>分层、实时调度、余度与容错、ARINC 653 时空分区</td></tr>
  <tr><td>系统建模</td><td>DFD 补全（黑洞、奇迹）、E-R 补全、用例 / 类 / 顺序 / 状态图</td></tr>
</table>
<h2>论文 120 分钟</h2>
<p>选题 5 分钟，列提纲 10 分钟，摘要 15 分钟，正文 80 分钟，检查 10 分钟。</p>
<table>
  <tr><th>部分</th><th>字数</th><th>写什么</th></tr>
  <tr><td>摘要</td><td>300–330</td><td>项目、规模、角色、方法、效果</td></tr>
  <tr><td>项目背景</td><td>400–500</td><td>时间、单位、规模、周期、团队、职责</td></tr>
  <tr><td>理论论述</td><td>300–500</td><td>回答第 2 问：概念和分类或步骤</td></tr>
  <tr><td>实践展开</td><td>1200–1500</td><td>3 到 4 点，每点是问题、方案、带数字的效果</td></tr>
  <tr><td>总结</td><td>200–300</td><td>成果、不足、改进方向</td></tr>
</table>
<h2>质量属性与策略素材</h2>
<ul>
  <li><b>性能</b>：多级缓存、异步削峰、读写分离、分库分表、CDN、连接池、索引优化</li>
  <li><b>可用性</b>：集群加负载均衡、主备切换、限流熔断降级、异地多活、健康检查</li>
  <li><b>安全性</b>：统一认证（OAuth2 / JWT）、RBAC、HTTPS、加密脱敏、审计日志、WAF</li>
  <li><b>可修改性</b>：分层、模块化、DDD 限界上下文、接口隔离、配置中心、插件化</li>
  <li><b>可伸缩性</b>：无状态服务、容器弹性伸缩、数据分片</li>
</ul>
<p class="note">雷区：没有真实项目细节；摘要和正文对不上；把微服务、3PC 写成银弹；跑题到项目管理；字数不足。</p>
<h2>6 周冲刺</h2>
${PLAN.map(([w, items]) => `<article class="card"><h3>${esc(w)}</h3><ul>${items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></article>`).join("")}
`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>系统架构设计师 · 离线学习手册</title>
<style>
  @page { size: 120mm 190mm; margin: 9mm 7mm 11mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1d1d1f; font: 10.5pt/1.55 "Microsoft YaHei", "PingFang SC", sans-serif; }
  h1 { font-size: 16pt; line-height: 1.3; margin: 0 0 8px; page-break-before: always; }
  h1.cover-title { page-break-before: auto; font-size: 20pt; }
  h2 { font-size: 13pt; margin: 14px 0 6px; page-break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 10px 0 4px; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { margin: 4px 0 8px; padding-left: 1.2em; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d5d5d0; padding: 3px 4px; vertical-align: top; word-break: break-word; }
  th { background: #f3f3f0; font-weight: 600; }
  .card { border: 1px solid #e4e4e0; border-radius: 6px; padding: 8px 9px; margin: 0 0 8px; page-break-inside: avoid; }
  .meta, .note { color: #6b6b70; font-size: 9pt; }
  .tag { display: inline-block; font-size: 8.5pt; color: #2e6fd8; border: 1px solid #c5d6f5; border-radius: 99px; padding: 0 6px; margin-right: 4px; }
  .pre { white-space: pre-line; }
  .pair { margin: 0; padding: 6px 0; border-bottom: 1px solid #eee; page-break-inside: avoid; }
  .opts { list-style: upper-alpha; }
  .opts .right { font-weight: 700; }
  blockquote { margin: 8px 0; padding: 6px 8px; border-left: 3px solid #2e6fd8; background: #f4f7fd; }
  code, .math { font-family: Consolas, monospace; font-size: 0.92em; background: #f3f3f0; padding: 0 3px; }
  hr { border: 0; border-top: 1px solid #e4e4e0; margin: 10px 0; }
  .md-table { overflow: visible; }
  .cover { min-height: 150mm; }
  .cover p { font-size: 11pt; }
  nav.toc a { color: inherit; text-decoration: none; }
  nav.toc p { margin: 3px 0; }
</style>
</head>
<body>
<section class="cover">
  <p class="meta">软考高级 · 系统架构设计师</p>
  <h1 class="cover-title">离线学习手册</h1>
  <p>内容和记忆作战台一致：总提纲、考试地图、口诀背卡、场景实验室、闯关测验、触发词速查、案例与论文计划。</p>
  <p class="note">背卡 ${data.CARDS.length} 张 · 测验 ${data.QUIZ.length} 题 · 触发词 ${data.TRIGGERS.length} 条。进度和错题本仍在网页版里，这份手册只带知识本身。</p>
</section>
<nav class="toc">
  <h1>目录</h1>
  <p>1. 总提纲</p>
  <p>2. 考试地图</p>
  <p>3. 口诀背卡</p>
  <p>4. 场景实验室</p>
  <p>5. 闯关测验（含答案）</p>
  <p>6. 触发词速查</p>
  <p>7. 案例、论文与 6 周计划</p>
</nav>
<h1>1. 总提纲</h1>
<article class="md">${outlineHtml}</article>
<h1>2. 考试地图</h1>
${mapHtml}
<h1>3. 口诀背卡</h1>
<p class="note">每张卡先看问题，再看答案、口诀和生活类比。顺序与网页背卡相同。</p>
${cardsHtml}
<h1>4. 场景实验室</h1>
<h2>架构决策</h2>
${scnHtml}
<h2>缓存三兄弟</h2>
${cacheHtml}
<h2>BLP / Biba</h2>
${blpHtml}
${relHtml}
<h1>5. 闯关测验</h1>
<p class="note">正确选项已加粗，后面是解析。想先自测可以把答案行折起来。</p>
${quizHtml}
<h1>6. 触发词速查</h1>
<p class="note">看到题干里的这些词，就选下一行。</p>
${trigHtml}
<h1>7. 案例、论文与计划</h1>
${tplHtml}
</body>
</html>`;

fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
fs.writeFileSync(htmlPath, html, "utf8");

const chrome = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error("no chrome or edge");
const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
const run = spawnSync(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-pdf-header-footer",
  "--print-to-pdf=" + pdfPath,
  fileUrl
], { stdio: "inherit", timeout: 120000 });
if (run.status !== 0) process.exit(run.status || 1);
const stat = fs.statSync(pdfPath);
console.log("PDF", pdfPath, Math.round(stat.size / 1024) + " KB");
