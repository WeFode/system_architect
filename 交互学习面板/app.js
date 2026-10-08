(function () {
  const KEY = "ruankao-arch-study-v1";
  const DEF = {
    tab: "sprint", mod: "all", filter: "due", view: "card", idx: 0, cHour: "",
    status: {}, srs: {}, quiz: { done: 0, right: 0 }, wrong: [], qMod: "all", qSrc: "all", qMode: "rand", qid: null,
    exam: null, examLog: [],
    lab: "decide", scn: "seckill", cache: "normal", model: "blp", subj: 1, obj: 2,
    r1: "0.9", r2: "0.9", r3: "0.9", topo: "mix", mttf: "2000", mttr: "2",
    memS: "A0000", memE: "DFFFF", chipK: "32", chipB: "8", unitB: "8",
    stages: "2,1,3", pn: "100", dn: "5", dm: "3", hn: "32",
    search: "", dark: false
  };

  // 插件格式：KD_PLUG.push(api => ({ defaults, tabs: { id: { name, render, wide } }, acts, regions, subs }))
  const plugs = (window.KD_PLUG || []).map((f) => f(api()));
  let S = Object.assign({}, DEF, ...plugs.map((p) => p.defaults || {}), JSON.parse(localStorage.getItem(KEY) || "{}"));
  let flipped = false, picked = null, openRow = null;
  const save = () => localStorage.setItem(KEY, JSON.stringify(S));
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const $ = (id) => document.getElementById(id);
  const modName = (id) => (MODS.find((m) => m.id === id) || { name: "全部" }).name;
  const today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };

  const BOOK = window.BOOK || { cards: [], seqs: [], triggers: [], points: {} };
  CARDS.push(...BOOK.cards);
  TRIGGERS.push(...BOOK.triggers);
  if (window.SEQS) SEQS.push(...BOOK.seqs);
  const ALLQ = QUIZ.concat(window.BANK || []);
  const qHour = (q) => { const m = /第 (\d+) 小时/.exec(q.src || ""); return m ? +m[1] : 0; };
  const qSrcName = (q) => q.src || "口诀题";

  const TAB_ORDER = ["sprint", "radar", "outline", "cards", "drill", "quiz", "case", "essay", "lab", "search", "tactics"];
  const TABS = {
    outline: { name: "总提纲", render: renderOutline, wide: true },
    cards: { name: "口诀背卡", render: renderCards },
    quiz: { name: "刷题模考", render: renderQuiz },
    lab: { name: "场景实验室", render: renderLab },
    search: { name: "速查", render: renderSearch }
  };
  const ACTS = {}, SUBS = { lab: "lab" };
  const REGIONS = { rel: relOut, avail: availOut, mem: memOut, pipe: pipeOut, dead: deadOut, ham: hamOut, search: searchOut };
  plugs.forEach((p) => {
    Object.assign(TABS, p.tabs || {});
    Object.assign(ACTS, p.acts || {});
    Object.assign(REGIONS, p.regions || {});
    Object.assign(SUBS, p.subs || {});
  });

  function api() {
    return {
      get S() { return S; }, save: () => save(), render: () => render(), esc: (s) => esc(s), go: (t) => go(t), today: () => today(),
      modName: (id) => modName(id), modPills: (c, a) => modPills(c, a), cardBody: (c) => cardBody(c), markCard: (id, lv) => markCard(id, lv),
      srsDue: (id) => srsDue(id), statusCounts: () => statusCounts(), allQ: () => ALLQ, qHour: (q) => qHour(q), book: () => BOOK
    };
  }

  // tab[:子页][:状态键=值]
  function go(target) {
    const [tab, ...rest] = target.split(":");
    S.tab = tab;
    rest.forEach((p) => {
      const i = p.indexOf("=");
      if (i > 0) S[p.slice(0, i)] = p.slice(i + 1);
      else if (SUBS[tab]) S[SUBS[tab]] = p;
    });
    if (tab === "cards") { S.idx = 0; flipped = false; if (!rest.some((p) => p.startsWith("cHour="))) S.cHour = ""; }
    if (tab === "quiz" && S.qMode !== "exam") nextQ();
    window.scrollTo(0, 0);
  }

  // ---------------- 场景数据 ----------------
  const SCN = [
    { id: "seckill", name: "电商秒杀", life: "春运抢票：一瞬间几百万人抢几千张票",
      story: "双 11 零点，10 万件商品，峰值 50 万 QPS，不能超卖，页面不能挂。",
      qa: [["性能", 5], ["可用性", 5], ["一致性", 4], ["安全性", 3], ["可修改性", 2]],
      cap: "整体 AP + 库存扣减点强一致", style: "分层 + 事件驱动（消息队列异步）",
      arch: ["页面静态化 + CDN，把读流量挡在外面", "网关限流、验证码、防刷，削掉无效请求", "Redis 预加载库存，Lua 脚本原子扣减，防超卖", "消息队列异步创建订单，削峰填谷", "订单服务幂等（唯一请求号），防重复下单"],
      tx: "事务消息 / 本地消息表，最终一致", cache: "热点 key 预热且逻辑不过期防击穿；布隆过滤器防穿透",
      pit: "请求直接打数据库；只靠数据库行锁；没有幂等导致重复下单", exam: "缓存三兄弟、消息队列削峰、限流熔断降级、性能策略、权衡点（缓存一致性）" },
    { id: "bank", name: "银行转账", life: "去柜台转账：宁可让你多等一会，也不能把钱记错",
      story: "跨行转账，日均 500 万笔，余额绝对准确，全程可审计，监管要求高。",
      qa: [["一致性", 5], ["安全性", 5], ["可用性", 4], ["性能", 3], ["可修改性", 2]],
      cap: "CP：分区时宁可拒绝服务也要保证一致", style: "层次架构 + 核心账务集中",
      arch: ["核心账务放在同一数据库或分布式强一致数据库", "跨系统用 XA/2PC 或 TCC 保证资金一致", "报文签名 + 加密 + 证书双向认证", "操作全量审计日志，职责分离（Clark-Wilson）", "同城双活 + 异地灾备，RPO 接近 0"],
      tx: "XA / 2PC；互联网化场景用 TCC", cache: "余额不走缓存，或只缓存只读展示数据",
      pit: "用最终一致处理核心余额；缓存余额导致脏读；没有对账机制", exam: "ACID、2PC/3PC、CAP 中的 CP、数字签名、Clark-Wilson、可用性指标" },
    { id: "iot", name: "智慧物联网平台", life: "全城的智能电表：数量极多，偶尔晚几秒上报没关系",
      story: "100 万台设备每 10 秒上报一次，要实时告警，历史数据要能分析，设备网络不稳定。",
      qa: [["可伸缩性", 5], ["可用性", 5], ["性能", 4], ["安全性", 3], ["一致性", 2]],
      cap: "AP + BASE：基本可用、最终一致", style: "物联网三层 + 事件驱动 + Kappa 流处理",
      arch: ["感知层 → 网络层 → 应用层分层设计", "边缘网关就近清洗、聚合、断网缓存", "MQTT 接入，Kafka 做数据总线", "Flink 流处理实时告警；时序数据库存历史", "设备证书认证，传输 TLS 加密"],
      tx: "不追求强一致，靠消息重试 + 幂等", cache: "设备最新状态放 Redis Hash",
      pit: "所有原始数据直接上云导致带宽和成本爆炸；用关系库存海量时序数据", exam: "边缘计算、CAP/BASE、Kappa、物联网三层、可伸缩性" },
    { id: "gov", name: "政务协同办公", life: "市政府办事大厅：几十个部门共用一个大厅，但各部门的材料不能串",
      story: "32 家委办局、2.5 万用户，公文流转要强一致，团队只有 8 人，要适配信创环境。",
      qa: [["安全性", 5], ["一致性", 4], ["可维护性", 4], ["性能", 3], ["可伸缩性", 2]],
      cap: "单库本地事务，强一致", style: "模块化单体 + DDD 限界上下文 + 分层",
      arch: ["按 DDD 划分限界上下文，模块间依赖倒置", "多租户共享库逻辑隔离，数据访问层自动注入租户条件", "公文状态、审批记录在同一本地事务内完成", "进程内缓存 + Redis 两级缓存组织机构数据", "WebSocket 推送消息，RBAC + 审计日志"],
      tx: "本地事务，无需分布式事务", cache: "读多写少的组织机构、字典数据",
      pit: "8 人团队硬拆微服务（云原生反模式），运维与分布式事务成本失控", exam: "非功能需求论文、层次架构、RBAC、等级保护、云原生反模式" },
    { id: "rec", name: "实时推荐系统", life: "短视频刷到的下一个：既要参考你的长期喜好，也要跟上你刚才的点击",
      story: "日活 1000 万，用户行为要秒级影响推荐结果，每天还要全量训练模型。",
      qa: [["性能", 5], ["可伸缩性", 5], ["可修改性", 3], ["可用性", 3], ["一致性", 2]],
      cap: "AP", style: "Lambda（批 + 流 + 服务层），或逐步演进到 Kappa",
      arch: ["批处理层：Spark 每日全量训练模型与特征", "速度层：Flink 实时计算用户近期行为特征", "服务层：合并两路结果，Redis 特征存储", "A/B 测试平台支持策略快速迭代", "降级：实时链路故障时回退到离线推荐"],
      tx: "无需事务，结果允许短暂不一致", cache: "用户特征、热门候选集",
      pit: "批和流两套代码逻辑不一致导致结果偏差", exam: "Lambda/Kappa、NoSQL、数据仓库、可伸缩性" },
    { id: "avionics", name: "机载航电嵌入式", life: "飞机的飞控：不能死机，不能卡顿，出错必须有人兜底",
      story: "多个不同安全等级的应用共用一台计算机，必须满足硬实时和适航认证。",
      qa: [["可靠性", 5], ["安全性(Safety)", 5], ["实时性", 5], ["可测试性", 4], ["可修改性", 2]],
      cap: "不适用 CAP，关注确定性与容错", style: "IMA 综合模块化航电 + 分区操作系统 + 层次",
      arch: ["ARINC 653 时间分区与空间分区，故障不跨分区传播", "三余度硬件 + 表决，N 版本软件", "RTOS 确定性调度（RMS/固定优先级）", "BIT 机内自检 + 健康监控", "按 DO-178C 等级开展需求追踪与覆盖测试"],
      tx: "不适用", cache: "不适用",
      pit: "使用无确定性调度的通用操作系统；不同安全等级应用无隔离", exam: "容错（N 版本/恢复块）、RTOS 调度、嵌入式架构、可靠性计算" }
  ];

  const CACHE = {
    normal: { name: "正常", load: 15, cause: "绝大多数请求在缓存命中，只有少量未命中回源数据库。", fix: ["Cache Aside：先更新数据库，再删除缓存", "设置合理过期时间"], life: "奶茶店前台备好常用口味，店员不用每单都跑仓库。", say: "" },
    pen: { name: "穿透", load: 55, cause: "请求的 key 在缓存和数据库里都不存在，每次都直达数据库，常见于恶意攻击。", fix: ["布隆过滤器在入口拦截不存在的 key", "缓存空值并设置短过期时间", "接口参数校验（如 ID 小于 0 直接拒绝）"], life: "总有人点菜单上没有的口味，店员每次都跑仓库翻一遍。", say: "该问题属于缓存穿透，成因是……；可采用布隆过滤器或缓存空对象，优点……缺点……（布隆过滤器有误判，空值占内存）。" },
    bd: { name: "击穿", load: 80, cause: "某个高并发访问的热点 key 恰好过期，大量请求在同一瞬间打到数据库。", fix: ["互斥锁：只让一个请求回源重建缓存", "逻辑过期 / 热点数据永不过期，后台异步刷新", "热点数据提前预热"], life: "网红款刚卖完，所有排队的人同时冲进仓库。", say: "该问题属于缓存击穿，关键词是“热点 key 过期”；互斥锁保证一致但降低吞吐，逻辑过期性能好但会短暂返回旧数据（权衡点）。" },
    av: { name: "雪崩", load: 100, cause: "大量 key 在同一时间过期，或缓存服务整体宕机，数据库瞬间被压垮。", fix: ["过期时间加随机值，打散失效时间", "Redis 哨兵 / 集群保证缓存高可用", "限流、熔断、降级保护数据库", "本地缓存 + 分布式缓存多级缓存"], life: "整个货架同一时刻全空，或者前台直接停电。", say: "该问题属于缓存雪崩；从预防（随机过期、高可用集群）和兜底（限流降级、多级缓存）两个层面作答。" }
  };

  // ---------------- 工具 ----------------
  function statusCounts() {
    const c = { 0: 0, 1: 0, 2: 0 };
    Object.values(S.status).forEach((v) => { if (c[v] != null) c[v]++; });
    return c;
  }
  function progressBar() {
    const c = statusCounts(), n = CARDS.length;
    const pct = (x) => (x / n * 100).toFixed(1) + "%";
    return `<div class="bar"><span style="width:${pct(c[2])};background:var(--ok)"></span><span style="width:${pct(c[1])};background:var(--mid)"></span><span style="width:${pct(c[0])};background:var(--bad)"></span></div>
      <p class="faint">会了 ${c[2]} · 模糊 ${c[1]} · 不会 ${c[0]} · 未学 ${n - c[0] - c[1] - c[2]}（共 ${n} 张）</p>`;
  }
  const modPills = (cur, act) => `<div class="row">${[{ id: "all", name: "全部" }].concat(MODS).map((m) => `<button class="pill ${cur === m.id ? "on" : ""}" data-act="${act}" data-v="${m.id}">${esc(m.name)}</button>`).join("")}</div>`;
  const blocks = (n) => `<span class="blocks">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
  const num = (v) => parseFloat(v);

  function renderOutline() {
    const src = window.OUTLINE_MD || "";
    if (!src) return `<div class="panel"><p>提纲还没装进页面。在项目根目录运行 <code>node scripts/prepare-site.js</code> 后再打开。</p></div>`;
    const { html, toc } = renderMarkdown(src);
    return `<div class="md-layout">
      <nav class="md-toc">${toc.map((t) => `<a class="${t.level === 3 ? "h3" : ""}" data-act="jumpmd" data-v="${t.id}" href="#${t.id}">${esc(t.text)}</a>`).join("")}</nav>
      <article class="md-body">${html}</article>
    </div>`;
  }

  // ---------------- 背卡：7 天压缩版间隔重复 ----------------
  // 盒子 0–4 对应间隔 0/1/2/3/5 天：不会当天再来，模糊明天，会了逐级拉长。
  const GAP = [0, 1, 2, 3, 5];
  function srsDue(id) {
    const r = S.srs[id];
    if (r) return r[1] <= today();
    return S.status[id] !== 2;
  }
  function markCard(id, lv) {
    S.status[id] = lv;
    const box = (S.srs[id] || [0])[0];
    const nb = lv === 0 ? 0 : lv === 1 ? 1 : Math.min(4, Math.max(2, box + 1));
    S.srs[id] = [nb, today() + GAP[nb]];
  }
  const matchFilter = (c, f) => {
    const st = S.status[c.id];
    if (f === "due") return srsDue(c.id);
    return f === "all" || (f === "todo" && st !== 2) || String(st) === f;
  };
  function cardPool() {
    const pool = CARDS.filter((c) => (S.mod === "all" || c.m === S.mod) && (!S.cHour || String(c.hour) === String(S.cHour)) && matchFilter(c, S.filter));
    if (S.filter === "due") pool.sort((a, b) => (S.status[a.id] == null) - (S.status[b.id] == null));
    return pool;
  }
  function cardBody(c) {
    return `<div class="pre">${esc(c.a)}</div>
      ${c.k ? `<div class="sec"><span class="tag">口诀</span><span class="hl">${esc(c.k)}</span></div>` : ""}
      ${c.l ? `<div class="sec pre"><span class="tag">生活类比</span>${esc(c.l)}</div>` : ""}
      ${c.t ? `<div class="sec pre"><span class="tag">考法</span>${esc(c.t)}</div>` : ""}`;
  }
  function dueStat() {
    const inMod = CARDS.filter((c) => S.mod === "all" || c.m === S.mod);
    const rev = inMod.filter((c) => S.status[c.id] != null && srsDue(c.id)).length;
    const fresh = inMod.filter((c) => S.status[c.id] == null).length;
    return { rev, fresh };
  }
  function renderCards() {
    const pool = cardPool();
    const filters = [["due", "今日任务"], ["todo", "待攻克"], ["all", "全部"], ["0", "不会"], ["1", "模糊"], ["2", "已会"]];
    const ds = dueStat();
    let body;
    if (!pool.length) {
      body = `<div class="panel"><p>这个筛选条件下没有卡片了。${S.filter === "due" ? "今天这组的复习已经清空，明天再来，或者切到别的模块。" : S.filter === "todo" ? "这一组已经全部掌握，换一组或切到“全部”复习。" : ""}</p></div>`;
    } else if (S.view === "card") {
      const i = S.idx % pool.length, c = pool[i];
      const isNew = S.status[c.id] == null;
      body = `
      <div class="flash" data-act="flip">
        <div class="row" style="justify-content:space-between"><span><span class="tag">${esc(modName(c.m))}</span>${c.hour ? `<span class="tag">第 ${c.hour} 小时</span>` : ""}${isNew ? `<span class="tag">新卡</span>` : ""}</span><span class="faint">${i + 1} / ${pool.length} · 点击卡片${flipped ? "收起" : "翻面"}</span></div>
        <div class="q">${esc(c.q)}</div>
        ${flipped ? cardBody(c) : `<p class="faint">先在心里说出答案和口诀，再翻面核对。</p>`}
      </div>
      <div class="row" style="margin-top:12px">
        <button data-act="prev">上一张</button>
        <span style="flex:1"></span>
        <button data-act="mark" data-v="0">不会（今天再来）</button>
        <button data-act="mark" data-v="1">模糊（明天）</button>
        <button class="primary" data-act="mark" data-v="2">会了</button>
      </div>`;
    } else {
      body = `<div class="panel">${pool.map((c) => `<div class="listrow" data-act="row" data-v="${c.id}">
        <span class="dot ${S.status[c.id] != null ? "s" + S.status[c.id] : ""}"></span>${esc(c.q)} <span class="faint">· ${esc(modName(c.m))}${c.hour ? " · 第 " + c.hour + " 小时" : ""}</span>
        ${openRow === c.id ? `<div class="ans">${cardBody(c)}</div>` : ""}</div>`).join("")}</div>`;
    }
    return `
      ${modPills(S.mod, "mod")}
      <div class="row" style="margin:10px 0 14px">
        ${filters.map(([v, n]) => `<button class="pill ${S.filter === v ? "on" : ""}" data-act="filter" data-v="${v}">${n}</button>`).join("")}
        ${S.cHour ? `<button class="pill on" data-act="clearhour">只看第 ${esc(S.cHour)} 小时 ×</button>` : ""}
        <span style="flex:1"></span>
        <button class="pill ${S.view === "card" ? "on" : ""}" data-act="view" data-v="card">卡片模式</button>
        <button class="pill ${S.view === "list" ? "on" : ""}" data-act="view" data-v="list">列表模式</button>
      </div>
      <p class="faint" style="margin:-4px 0 12px">今日任务：到期复习 ${ds.rev} 张 + 新卡 ${ds.fresh} 张。不会 → 当天再出现；模糊 → 明天；会了 → 2、3、5 天后再出现。</p>
      ${body}
      <div style="margin-top:16px">${progressBar()}</div>`;
  }

  // ---------------- 场景实验室 ----------------
  function renderLab() {
    const subs = [["decide", "架构决策模拟器"], ["cache", "缓存三兄弟"], ["blp", "BLP / Biba 判定"], ["rel", "可靠性计算"], ["calc", "上午计算题"]];
    const inner = { decide: labDecide, cache: labCache, blp: labBlp, rel: labRel, calc: labCalc }[S.lab]();
    return `<div class="row" style="margin-bottom:14px">${subs.map(([v, n]) => `<button class="pill ${S.lab === v ? "on" : ""}" data-act="lab" data-v="${v}">${n}</button>`).join("")}</div>${inner}`;
  }
  function labDecide() {
    const s = SCN.find((x) => x.id === S.scn);
    return `
    <p class="muted">选一个业务场景，看架构师会怎样排序质量属性、做 CAP 取舍、选风格和技术。论文和案例都可以直接套这个思路。</p>
    <div class="row" style="margin:10px 0 14px">${SCN.map((x) => `<button class="pill ${S.scn === x.id ? "on" : ""}" data-act="scn" data-v="${x.id}">${esc(x.name)}</button>`).join("")}</div>
    <div class="panel">
      <h2 style="margin-top:0">${esc(s.name)}</h2>
      <p>${esc(s.story)}</p>
      <p class="faint">生活类比：${esc(s.life)}</p>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel flat">
        <h3>质量属性优先级</h3>
        ${s.qa.map(([n, v]) => `<div class="row" style="justify-content:space-between;margin:6px 0"><span>${esc(n)}</span>${blocks(v)}</div>`).join("")}
        <h3>关键决策</h3>
        <table>
          <tr><td class="muted">CAP 取舍</td><td>${esc(s.cap)}</td></tr>
          <tr><td class="muted">架构风格</td><td>${esc(s.style)}</td></tr>
          <tr><td class="muted">事务方案</td><td>${esc(s.tx)}</td></tr>
          <tr><td class="muted">缓存策略</td><td>${esc(s.cache)}</td></tr>
        </table>
      </div>
      <div class="panel flat">
        <h3>架构方案（论文实践段可直接改写）</h3>
        <ol style="padding-left:20px;margin:6px 0">${s.arch.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
        <h3>踩坑警告</h3><p class="bad">${esc(s.pit)}</p>
        <h3>对应考点</h3><p>${esc(s.exam)}</p>
      </div>
    </div>`;
  }
  function cacheSvg(mode) {
    const bad = mode !== "normal";
    const n = { normal: 1, pen: 3, bd: 6, av: 10 }[mode];
    let lines = "";
    for (let i = 0; i < 3; i++) lines += `<line class="${mode === "pen" ? "flowbad" : "flow"}" x1="130" y1="${72 + i * 13}" x2="214" y2="${72 + i * 13}" marker-end="url(#${mode === "pen" ? "ahb" : "ah"})"/>`;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 85 : 60 + i * (50 / (n - 1));
      lines += `<line class="${bad ? "flowbad" : "flow"}" x1="340" y1="${y}" x2="424" y2="${y}" marker-end="url(#${bad ? "ahb" : "ah"})" ${n === 1 && !bad ? 'stroke-dasharray="4 3"' : ""}/>`;
    }
    const cacheLabel = { normal: "命中率高", pen: "查无此 key", bd: "热点 key 已过期", av: "大量 key 失效 / 宕机" }[mode];
    const dbLabel = { normal: "偶尔回源", pen: "也查不到，下次还来", bd: "瞬时被打满", av: "被压垮" }[mode];
    return `<svg viewBox="0 0 560 170" width="100%" style="max-width:640px">
      <defs>
        <marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--faint)"/></marker>
        <marker id="ahb" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--bad)"/></marker>
      </defs>
      <rect class="box" x="10" y="50" width="120" height="70" rx="8"/><text x="70" y="82" text-anchor="middle">用户请求</text><text x="70" y="100" text-anchor="middle" class="faint">${mode === "av" || mode === "bd" ? "高并发" : "持续访问"}</text>
      <rect class="${mode === "bd" || mode === "av" ? "boxbad" : "box"}" x="220" y="50" width="120" height="70" rx="8"/><text x="280" y="82" text-anchor="middle">Redis 缓存</text><text x="280" y="100" text-anchor="middle">${cacheLabel}</text>
      <rect class="${bad ? "boxbad" : "box"}" x="430" y="50" width="120" height="70" rx="8"/><text x="490" y="82" text-anchor="middle">数据库</text><text x="490" y="100" text-anchor="middle">${dbLabel}</text>
      ${lines}
      <text x="280" y="150" text-anchor="middle">${bad ? "红线 = 本该被缓存挡住、却打到数据库的请求" : "虚线 = 少量未命中回源"}</text>
    </svg>`;
  }
  function labCache() {
    const c = CACHE[S.cache];
    return `
    <div class="row" style="margin-bottom:10px">${Object.entries(CACHE).map(([k, v]) => `<button class="pill ${S.cache === k ? "on" : ""}" data-act="cache" data-v="${k}">${v.name}</button>`).join("")}</div>
    <div class="panel">${cacheSvg(S.cache)}
      <div style="max-width:640px;margin-top:8px"><div class="label">数据库压力</div><div class="bar" style="height:10px"><span style="width:${c.load}%;background:${c.load > 60 ? "var(--bad)" : "var(--ok)"}"></span></div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel flat"><h3>成因</h3><p>${esc(c.cause)}</p><h3>生活类比</h3><p>${esc(c.life)}</p></div>
      <div class="panel flat"><h3>解决方案</h3><ul style="padding-left:18px">${c.fix.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        ${c.say ? `<h3>案例答题话术</h3><p>${esc(c.say)}</p>` : ""}</div>
    </div>
    <p class="faint">秒记：不存在的 key → 穿透；一个热点 → 击穿；一大片同时 → 雪崩。</p>`;
  }
  function labBlp() {
    const names = S.model === "blp" ? ["公开", "秘密", "机密", "绝密"] : ["低可信", "一般", "可信", "高可信"];
    const canRead = (s, o) => S.model === "blp" ? s >= o : s <= o;
    const canWrite = (s, o) => S.model === "blp" ? s <= o : s >= o;
    const s = +S.subj, o = +S.obj;
    const r = canRead(s, o), w = canWrite(s, o);
    const opt = (sel) => names.map((n, i) => `<option value="${i}" ${+sel === i ? "selected" : ""}>${n}</option>`).join("");
    const why = S.model === "blp"
      ? "BLP 保机密性：低级别不能读高级别（不上读），高级别不能写到低级别（不下写），防止机密往下泄露。"
      : "Biba 保完整性：不能读比自己低可信的数据（不下读），不能写到比自己高可信的对象（不上写），防止脏数据往上污染。";
    return `
    <div class="row" style="margin-bottom:12px">
      <button class="pill ${S.model === "blp" ? "on" : ""}" data-act="model" data-v="blp">BLP（机密性）</button>
      <button class="pill ${S.model === "biba" ? "on" : ""}" data-act="model" data-v="biba">Biba（完整性）</button>
    </div>
    <div class="grid g2">
      <div class="panel">
        <div class="row"><span>主体级别</span><select data-bind="subj">${opt(S.subj)}</select><span>客体级别</span><select data-bind="obj">${opt(S.obj)}</select></div>
        <div class="verdict">读：<span class="${r ? "ok" : "bad"}">${r ? "允许" : "禁止"}</span>　写：<span class="${w ? "ok" : "bad"}">${w ? "允许" : "禁止"}</span></div>
        <p>${esc(why)}</p>
        <p class="faint">口诀：BLP 下读上写，Biba 上读下写（说的是“允许”的方向）。</p>
      </div>
      <div class="panel flat">
        <h3 style="margin-top:0">主体为“${names[s]}”时的完整权限表</h3>
        <table class="matrix"><tr><th>客体级别</th><th>读</th><th>写</th></tr>
          ${[3, 2, 1, 0].map((i) => `<tr><td class="${i === s ? "me" : ""}">${names[i]}${i === s ? "（同级）" : ""}</td><td class="${canRead(s, i) ? "ok" : "bad"}">${canRead(s, i) ? "允许" : "禁止"}</td><td class="${canWrite(s, i) ? "ok" : "bad"}">${canWrite(s, i) ? "允许" : "禁止"}</td></tr>`).join("")}
        </table>
        <p class="faint">${S.model === "blp" ? "生活类比：士兵看不了将军的文件；将军不能把机密贴到士兵公告栏。" : "生活类比：教科书不引用小道消息；普通人不能改教科书。"}</p>
      </div>
    </div>`;
  }
  function labRel() {
    return `
    <div class="grid g2">
      <div class="panel">
        <h3 style="margin-top:0">串并联可靠度</h3>
        <div class="row"><span>R1</span><input data-bind="r1" data-region="rel" value="${esc(S.r1)}"><span>R2</span><input data-bind="r2" data-region="rel" value="${esc(S.r2)}"><span>R3</span><input data-bind="r3" data-region="rel" value="${esc(S.r3)}"></div>
        <div class="row" style="margin-top:8px"><span>结构</span><select data-bind="topo" data-region="rel">
          <option value="ser" ${S.topo === "ser" ? "selected" : ""}>三个串联</option>
          <option value="par" ${S.topo === "par" ? "selected" : ""}>三个并联</option>
          <option value="mix" ${S.topo === "mix" ? "selected" : ""}>R1 串联（R2 并联 R3）</option></select></div>
        <div id="region-rel">${relOut()}</div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0">可用性与年停机时间</h3>
        <div class="row"><span>MTTF（小时）</span><input data-bind="mttf" data-region="avail" value="${esc(S.mttf)}"><span>MTTR（小时）</span><input data-bind="mttr" data-region="avail" value="${esc(S.mttr)}"></div>
        <div id="region-avail">${availOut()}</div>
      </div>
    </div>
    <table style="margin-top:14px"><tr><th>可用性</th><th>年停机时间</th><th>记忆</th></tr>
      <tr><td>99%</td><td>约 3.65 天</td><td>两个 9</td></tr><tr><td>99.9%</td><td>约 8.76 小时</td><td>三个 9</td></tr>
      <tr><td>99.99%</td><td>约 52.6 分钟</td><td>四个 9，常见高可用目标</td></tr><tr><td>99.999%</td><td>约 5.26 分钟</td><td>五个 9，电信级</td></tr></table>`;
  }
  function relOut() {
    const a = num(S.r1), b = num(S.r2), c = num(S.r3);
    if ([a, b, c].some((x) => isNaN(x) || x < 0 || x > 1)) return `<p class="bad">请输入 0 到 1 之间的小数。</p>`;
    let r, f;
    if (S.topo === "ser") { r = a * b * c; f = `R = R1 × R2 × R3 = ${a} × ${b} × ${c}`; }
    else if (S.topo === "par") { r = 1 - (1 - a) * (1 - b) * (1 - c); f = `R = 1 − (1−R1)(1−R2)(1−R3)`; }
    else { const p = 1 - (1 - b) * (1 - c); r = a * p; f = `R2∥R3 = 1 − (1−${b})(1−${c}) = ${p.toFixed(4)}；R = ${a} × ${p.toFixed(4)}`; }
    return `<p class="faint" style="margin-top:10px">${esc(f)}</p><div class="big">${r.toFixed(4)}</div><p class="faint">串联像灯串，坏一个全灭；并联像多个水龙头，全坏才断水。</p>`;
  }
  function availOut() {
    const f = num(S.mttf), r = num(S.mttr);
    if (!(f > 0) || !(r >= 0)) return `<p class="bad">请输入正数。</p>`;
    const A = f / (f + r), down = (1 - A) * 8760;
    return `<p class="faint" style="margin-top:10px">A = MTTF / (MTTF + MTTR)；MTBF = MTTF + MTTR = ${f + r} 小时</p>
      <div class="big">${(A * 100).toFixed(4)}%</div><p>年停机约 ${down >= 1 ? down.toFixed(2) + " 小时" : (down * 60).toFixed(1) + " 分钟"}</p>`;
  }
  function labCalc() {
    return `
    <div class="grid g2">
      <div class="panel"><h3 style="margin-top:0">内存地址区间与芯片数</h3>
        <div class="row"><span>起始</span><input data-bind="memS" data-region="mem" value="${esc(S.memS)}">H<span>结束</span><input data-bind="memE" data-region="mem" value="${esc(S.memE)}">H</div>
        <div class="row" style="margin-top:6px"><span>编址单位</span><input data-bind="unitB" data-region="mem" value="${esc(S.unitB)}">位<span>芯片</span><input data-bind="chipK" data-region="mem" value="${esc(S.chipK)}">K ×<input data-bind="chipB" data-region="mem" value="${esc(S.chipB)}">位</div>
        <div id="region-mem">${memOut()}</div></div>
      <div class="panel"><h3 style="margin-top:0">流水线</h3>
        <div class="row"><span>各段时间</span><input data-bind="stages" data-region="pipe" value="${esc(S.stages)}"><span>指令数</span><input data-bind="pn" data-region="pipe" value="${esc(S.pn)}"></div>
        <div id="region-pipe">${pipeOut()}</div></div>
      <div class="panel"><h3 style="margin-top:0">不死锁的最少资源</h3>
        <div class="row"><span>进程数 n</span><input data-bind="dn" data-region="dead" value="${esc(S.dn)}"><span>每进程需要 m</span><input data-bind="dm" data-region="dead" value="${esc(S.dm)}"></div>
        <div id="region-dead">${deadOut()}</div></div>
      <div class="panel"><h3 style="margin-top:0">海明码校验位</h3>
        <div class="row"><span>数据位 n</span><input data-bind="hn" data-region="ham" value="${esc(S.hn)}"></div>
        <div id="region-ham">${hamOut()}</div></div>
    </div>`;
  }
  function memOut() {
    const s = parseInt(S.memS, 16), e = parseInt(S.memE, 16);
    if (isNaN(s) || isNaN(e) || e < s) return `<p class="bad">请输入合法的十六进制地址，且结束 ≥ 起始。</p>`;
    const units = e - s + 1, unitB = num(S.unitB) || 8, bits = units * unitB;
    const chip = (num(S.chipK) || 0) * 1024 * (num(S.chipB) || 0);
    const k = units / 1024;
    return `<p class="faint" style="margin-top:10px">${S.memE.toUpperCase()} − ${S.memS.toUpperCase()} + 1 = ${units.toString(16).toUpperCase()}H = ${units} 个单元</p>
      <div class="big">${k >= 1 ? k + "K" : units} 个单元</div>
      ${chip > 0 ? `<p>芯片数 = ${k}K × ${unitB} 位 ÷（${S.chipK}K × ${S.chipB} 位）= <b>${(bits / chip).toFixed(2).replace(/\.00$/, "")} 片</b></p>` : ""}
      <p class="faint">秒算：末尾 4 个 0 就是 64K（16⁴ = 2¹⁶）。</p>`;
  }
  function pipeOut() {
    const t = S.stages.split(/[,，\s]+/).map(num).filter((x) => x > 0), n = parseInt(S.pn);
    if (!t.length || !(n > 0)) return `<p class="bad">各段时间用逗号分隔，指令数为正整数。</p>`;
    const sum = t.reduce((a, b) => a + b, 0), mx = Math.max(...t), T = sum + (n - 1) * mx;
    return `<p class="faint" style="margin-top:10px">T = ${sum} + (${n} − 1) × ${mx}</p><div class="big">${T} Δt</div>
      <p>吞吐率 = ${n} / ${T} = ${(n / T).toFixed(4)} 条/Δt；加速比 = ${n * sum} / ${T} = ${(n * sum / T).toFixed(2)}</p>`;
  }
  function deadOut() {
    const n = parseInt(S.dn), m = parseInt(S.dm);
    if (!(n > 0) || !(m > 0)) return `<p class="bad">请输入正整数。</p>`;
    return `<p class="faint" style="margin-top:10px">R = n(m − 1) + 1 = ${n} × ${m - 1} + 1</p><div class="big">${n * (m - 1) + 1}</div><p class="faint">思路：每个进程都差一个时仍剩 1 个，总有进程能跑完并释放资源。</p>`;
  }
  function hamOut() {
    const n = parseInt(S.hn);
    if (!(n > 0)) return `<p class="bad">请输入正整数。</p>`;
    let k = 1; while (Math.pow(2, k) < n + k + 1) k++;
    return `<p class="faint" style="margin-top:10px">找最小 k，使 2^k ≥ n + k + 1：2^${k} = ${Math.pow(2, k)} ≥ ${n + k + 1}</p><div class="big">${k} 位</div>`;
  }

  // ---------------- 刷题与限时模考 ----------------
  const SRCS = [["all", "全部来源"], ["own", "口诀题"], ["prac", "书本练习"], ["m1", "模拟卷Ⅰ"], ["m2", "模拟卷Ⅱ"]];
  function srcMatch(q) {
    const f = S.qSrc;
    if (f === "all") return true;
    if (f === "own") return !q.src;
    if (f === "prac") return /练习/.test(q.src || "");
    if (f === "m1") return q.src === "模拟卷Ⅰ";
    if (f === "m2") return q.src === "模拟卷Ⅱ";
    if (/^h\d+$/.test(f)) return qHour(q) === +f.slice(1);
    return true;
  }
  const quizBase = () => ALLQ.filter((q) => (S.qMod === "all" || q.m === S.qMod) && srcMatch(q));
  const quizPool = () => quizBase().filter((q) => S.qMode !== "wrong" || S.wrong.includes(q.id));
  const findQ = (id) => ALLQ.find((x) => x.id === id);
  function nextQ() {
    const all = quizPool();
    const pool = all.filter((q) => q.id !== S.qid);
    const src = pool.length ? pool : all;
    S.qid = src.length ? src[Math.floor(Math.random() * src.length)].id : null;
    picked = null;
  }
  const optHtml = (q, i, cls, act) => `<button class="${cls}" data-act="${act}" data-v="${i}">${"ABCD"[i]}. ${esc(q.o[i])}</button>`;
  const qStem = (q) => `<p class="q pre" style="font-size:16px;font-weight:600;margin:10px 0">${esc(q.q)}</p>`;
  function quizHead() {
    const acc = S.quiz.done ? Math.round(S.quiz.right / S.quiz.done * 100) : 0;
    const hourPill = /^h\d+$/.test(S.qSrc) ? `<button class="pill on" data-act="qsrc" data-v="all">只看第 ${S.qSrc.slice(1)} 小时练习 ×</button>` : "";
    return `${modPills(S.qMod, "qmod")}
      <div class="row" style="margin:10px 0 0">${SRCS.map(([v, n]) => `<button class="pill ${S.qSrc === v ? "on" : ""}" data-act="qsrc" data-v="${v}">${n}</button>`).join("")}${hourPill}
        <span class="faint">当前筛选 ${quizBase().length} 题</span></div>
      <div class="row" style="margin:10px 0 14px">
        <button class="pill ${S.qMode === "rand" ? "on" : ""}" data-act="qmode" data-v="rand">随机刷题</button>
        <button class="pill ${S.qMode === "wrong" ? "on" : ""}" data-act="qmode" data-v="wrong">错题重练（${S.wrong.length}）</button>
        <button class="pill ${S.qMode === "exam" ? "on" : ""}" data-act="qmode" data-v="exam">限时模考</button>
        <span style="flex:1"></span><span class="faint">已答 ${S.quiz.done} · 正确率 ${acc}%</span>
        <button class="ghost" data-act="resetq">清零统计</button>
      </div>`;
  }
  function renderQuiz() {
    if (S.qMode === "exam") return quizHead() + renderExam();
    let q = findQ(S.qid);
    if (!q || !quizPool().some((x) => x.id === q.id)) { nextQ(); q = findQ(S.qid); }
    let body;
    if (!q) body = `<div class="panel"><p>${S.qMode === "wrong" ? "错题本在这个筛选下是空的，切回“随机刷题”继续。" : "这个筛选条件下暂时没有题目。"}</p></div>`;
    else body = `<div class="panel">
        <div class="row" style="justify-content:space-between"><span><span class="tag">${esc(modName(q.m))}</span><span class="tag">${esc(qSrcName(q))}</span></span>${S.wrong.includes(q.id) ? `<span class="faint">错题本中</span>` : ""}</div>
        ${qStem(q)}
        ${q.o.map((o, i) => {
          let cls = "opt";
          if (picked != null) { if (i === q.r) cls += " right"; else if (i === picked) cls += " wrong"; }
          return `<button class="${cls}" data-act="pick" data-v="${i}" ${picked != null ? "disabled" : ""}>${"ABCD"[i]}. ${esc(o)}</button>`;
        }).join("")}
        ${picked != null ? `<p class="pre" style="margin-top:10px"><b class="${picked === q.r ? "ok" : "bad"}">${picked === q.r ? "答对了" : "答错了，正确答案是 " + "ABCD"[q.r]}</b>　${esc(q.w)}</p>
          <div class="row" style="margin-top:8px"><button class="primary" data-act="nextq">下一题</button>${S.wrong.includes(q.id) ? `<button data-act="unwrong">已掌握，移出错题本</button>` : ""}</div>` : ""}
      </div>`;
    return quizHead() + body;
  }
  const EXAM_SIZES = [[20, 40], [45, 90], [75, 150]];
  function examLeft() {
    const e = S.exam;
    return Math.max(0, Math.round(e.lim * 60 - (Date.now() - e.start) / 1000));
  }
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  function renderExam() {
    const e = S.exam;
    if (!e) {
      const n = quizBase().length;
      return `<div class="panel">
        <h2 style="margin-top:0">限时模考</h2>
        <p>从当前筛选（模块 + 来源）的 ${n} 道题里随机抽题，按真实节奏计时：上午综合知识 75 题 150 分钟，平均每题 2 分钟。交卷前不显示对错，交卷后按模块出成绩单，错题自动进错题本。</p>
        <div class="row" style="margin-top:10px">${EXAM_SIZES.map(([k, m]) => `<button class="primary" data-act="examstart" data-v="${k}">${k} 题 · ${m} 分钟</button>`).join("")}</div>
        <p class="faint">题量不够时按实际题数出卷。想专攻模拟卷就先把来源切到“模拟卷Ⅰ/Ⅱ”。</p>
      </div>${examHistory()}`;
    }
    if (e.done) return examReport();
    const q = findQ(e.ids[e.i]), mine = e.ans[q.id];
    const answered = Object.keys(e.ans).length;
    return `<div class="panel">
      <div class="row" style="justify-content:space-between"><b>第 ${e.i + 1} / ${e.ids.length} 题</b><span>剩余 <b id="examClock">${clock(examLeft())}</b> · 已答 ${answered}</span></div>
      <div class="dots">${e.ids.map((id, i) => `<button class="dotbtn ${i === e.i ? "cur" : ""} ${e.ans[id] != null ? "done" : ""}" data-act="examgo" data-v="${i}">${i + 1}</button>`).join("")}</div>
      <div class="row"><span class="tag">${esc(modName(q.m))}</span></div>
      ${qStem(q)}
      ${q.o.map((_, i) => optHtml(q, i, "opt" + (mine === i ? " chosen" : ""), "exampick")).join("")}
      <div class="row" style="margin-top:10px">
        <button data-act="examgo" data-v="${e.i - 1}" ${e.i === 0 ? "disabled" : ""}>上一题</button>
        <button data-act="examgo" data-v="${e.i + 1}" ${e.i === e.ids.length - 1 ? "disabled" : ""}>下一题</button>
        <span style="flex:1"></span>
        <button class="ghost" data-act="examquit">放弃本场</button>
        <button class="primary" data-act="examsubmit">交卷</button>
      </div>
    </div>`;
  }
  function examReport() {
    const e = S.exam, qs = e.ids.map(findQ);
    const right = qs.filter((q) => e.ans[q.id] === q.r).length;
    const by = {};
    qs.forEach((q) => { const b = by[q.m] || (by[q.m] = { n: 0, r: 0 }); b.n++; if (e.ans[q.id] === q.r) b.r++; });
    const scaled = Math.round(right / qs.length * 75);
    const wrong = qs.filter((q) => e.ans[q.id] !== q.r);
    return `<div class="panel">
      <h2 style="margin-top:0">成绩单</h2>
      <div class="grid g3">
        <div><div class="label">答对</div><div class="big">${right} / ${qs.length}</div></div>
        <div><div class="label">折算 75 分制</div><div class="big ${scaled >= 45 ? "ok" : "bad"}">${scaled}</div><p class="faint">45 分及格</p></div>
        <div><div class="label">用时</div><div class="big">${Math.round((e.end - e.start) / 60000)} 分钟</div></div>
      </div>
      <table style="margin-top:12px"><tr><th>模块</th><th>答对</th><th>正确率</th></tr>
        ${Object.entries(by).sort((a, b) => a[1].r / a[1].n - b[1].r / b[1].n).map(([m, b]) => `<tr><td>${esc(modName(m))}</td><td>${b.r} / ${b.n}</td><td class="${b.r / b.n >= 0.6 ? "ok" : "bad"}">${Math.round(b.r / b.n * 100)}%</td></tr>`).join("")}
      </table>
      <div class="row" style="margin-top:12px"><button class="primary" data-act="examnew">再来一场</button><button data-act="qmode" data-v="wrong">去错题本</button></div>
    </div>
    <h3>错题解析（${wrong.length}）</h3>
    ${wrong.map((q) => `<div class="panel" style="margin:8px 0"><div class="row"><span class="tag">${esc(modName(q.m))}</span><span class="tag">${esc(qSrcName(q))}</span></div>${qStem(q)}
      <p>你的答案：<b class="bad">${e.ans[q.id] != null ? "ABCD"[e.ans[q.id]] : "未答"}</b>　正确答案：<b class="ok">${"ABCD"[q.r]}. ${esc(q.o[q.r])}</b></p>
      <p class="faint pre">${esc(q.w)}</p></div>`).join("")}`;
  }
  function examHistory() {
    if (!S.examLog.length) return "";
    return `<h3>历史模考</h3><table><tr><th>日期</th><th>题数</th><th>答对</th><th>折算</th></tr>
      ${S.examLog.slice(-10).reverse().map((l) => `<tr><td>${esc(l.d)}</td><td>${l.n}</td><td>${l.r}</td><td class="${l.s >= 45 ? "ok" : "bad"}">${l.s}</td></tr>`).join("")}</table>`;
  }
  function examSubmit() {
    const e = S.exam;
    if (!e || e.done) return;
    e.done = true; e.end = Date.now();
    const qs = e.ids.map(findQ);
    let right = 0;
    qs.forEach((q) => {
      if (e.ans[q.id] === q.r) right++;
      else if (!S.wrong.includes(q.id)) S.wrong.push(q.id);
    });
    S.quiz.done += qs.length; S.quiz.right += right;
    S.examLog.push({ d: new Date().toLocaleDateString(), n: qs.length, r: right, s: Math.round(right / qs.length * 75) });
  }
  setInterval(() => {
    if (S.tab !== "quiz" || S.qMode !== "exam" || !S.exam || S.exam.done) return;
    const left = examLeft(), el = $("examClock");
    if (el) el.textContent = clock(left);
    if (left <= 0) { examSubmit(); render(); }
  }, 1000);

  // ---------------- 速查 ----------------
  function renderSearch() {
    return `<p class="muted">输入题干里的关键词（如“热点”“双向绑定”“不上读”），同时搜索触发词表、背卡、顺序表和题库。</p>
      <input class="wide" id="searchBox" data-bind="search" data-region="search" placeholder="输入关键词……" value="${esc(S.search)}">
      <div id="region-search" style="margin-top:14px">${searchOut()}</div>`;
  }
  function searchOut() {
    const k = S.search.trim().toLowerCase();
    const has = (...xs) => xs.join(" ").toLowerCase().includes(k);
    const trig = TRIGGERS.filter(([a, b]) => !k || has(a, b));
    const cards = k ? CARDS.filter((c) => has(c.q, c.a, c.k, c.l, c.t)) : [];
    const seqs = k && window.SEQS ? SEQS.filter((s) => has(s.name, s.k, ...s.items)) : [];
    const qs = k ? ALLQ.filter((q) => has(q.q, ...q.o, q.w)).slice(0, 30) : [];
    return `<h3>题干触发词 → 答案（${trig.length}）</h3>
      <table><tr><th style="width:50%">看到</th><th>选 / 想到</th></tr>${trig.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="hl">${esc(b)}</td></tr>`).join("")}</table>
      ${k ? `<h3>相关背卡（${cards.length}）</h3>${cards.map((c) => `<div class="panel" style="margin:8px 0"><b>${esc(c.q)}</b> <span class="faint">· ${esc(modName(c.m))}</span><div style="margin-top:6px">${cardBody(c)}</div></div>`).join("")}` : ""}
      ${seqs.length ? `<h3>顺序表（${seqs.length}）</h3>${seqs.map((s) => `<div class="panel" style="margin:8px 0"><b>${esc(s.name)}</b><p>${s.items.map(esc).join(" → ")}</p><p class="faint">口诀：${esc(s.k)}</p></div>`).join("")}` : ""}
      ${qs.length ? `<h3>相关题目（${qs.length}${qs.length === 30 ? "，只显示前 30" : ""}）</h3>${qs.map((q) => `<div class="panel" style="margin:8px 0"><span class="tag">${esc(qSrcName(q))}</span><p class="pre">${esc(q.q)}</p><p class="ok">${"ABCD"[q.r]}. ${esc(q.o[q.r])}</p></div>`).join("")}` : ""}`;
  }

  // ---------------- 渲染与事件 ----------------
  function render() {
    if (!TABS[S.tab]) S.tab = "sprint";
    const tab = TABS[S.tab];
    document.body.classList.toggle("dark", !!S.dark);
    document.body.classList.toggle("wide", !!tab.wide);
    $("tabs").innerHTML = TAB_ORDER.filter((id) => TABS[id]).map((id) => `<button class="pill ${S.tab === id ? "on" : ""}" data-act="tab" data-v="${id}">${TABS[id].name}</button>`).join("");
    $("app").innerHTML = tab.render();
    save();
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const v = el.dataset.v;
    switch (el.dataset.act) {
      case "tab": S.tab = v; window.scrollTo(0, 0); break;
      case "go": go(v); break;
      case "jumpmd": { const n = document.getElementById(v); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      case "mod": S.mod = v; S.idx = 0; flipped = false; break;
      case "filter": S.filter = v; S.idx = 0; flipped = false; break;
      case "clearhour": S.cHour = ""; S.idx = 0; break;
      case "view": S.view = v; break;
      case "flip": flipped = !flipped; break;
      case "prev": { const n = cardPool().length || 1; S.idx = (S.idx - 1 + n) % n; flipped = false; break; }
      case "mark": {
        const pool = cardPool(); if (!pool.length) return;
        const c = pool[S.idx % pool.length];
        markCard(c.id, +v);
        if (cardPool().some((x) => x.id === c.id)) S.idx++;
        flipped = false; break;
      }
      case "row": openRow = openRow === v ? null : v; break;
      case "lab": S.lab = v; break;
      case "scn": S.scn = v; break;
      case "cache": S.cache = v; break;
      case "model": S.model = v; break;
      case "qmod": S.qMod = v; nextQ(); break;
      case "qsrc": S.qSrc = v; nextQ(); break;
      case "qmode": S.qMode = v; nextQ(); break;
      case "pick": {
        if (picked != null) return;
        const q = findQ(S.qid); picked = +v;
        S.quiz.done++;
        if (picked === q.r) S.quiz.right++;
        else if (!S.wrong.includes(q.id)) S.wrong.push(q.id);
        break;
      }
      case "nextq": nextQ(); break;
      case "unwrong": S.wrong = S.wrong.filter((x) => x !== S.qid); nextQ(); break;
      case "resetq": if (confirm("清零测验统计？错题本会保留。")) S.quiz = { done: 0, right: 0 }; break;
      case "examstart": {
        const n = +v, lim = (EXAM_SIZES.find(([k]) => k === n) || [n, n * 2])[1];
        const ids = quizBase().map((q) => q.id).sort(() => Math.random() - 0.5).slice(0, n);
        if (!ids.length) return;
        S.exam = { ids, ans: {}, i: 0, start: Date.now(), lim: lim * ids.length / n, done: false };
        break;
      }
      case "exampick": S.exam.ans[S.exam.ids[S.exam.i]] = +v; if (S.exam.i < S.exam.ids.length - 1) S.exam.i++; break;
      case "examgo": S.exam.i = Math.max(0, Math.min(S.exam.ids.length - 1, +v)); break;
      case "examsubmit": {
        const left = S.exam.ids.length - Object.keys(S.exam.ans).length;
        if (left && !confirm(`还有 ${left} 题没答，确定交卷？`)) return;
        examSubmit(); break;
      }
      case "examquit": if (!confirm("放弃本场模考？不计成绩。")) return; S.exam = null; break;
      case "examnew": S.exam = null; break;
      default: {
        const fn = ACTS[el.dataset.act];
        if (!fn || fn(v, el) === false) return;
      }
    }
    render();
  });

  function setPath(path, value) {
    const keys = path.split(".");
    let o = S;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] || (o[keys[i]] = {});
    o[keys[keys.length - 1]] = value;
  }
  const onInput = (e) => {
    const el = e.target; const key = el.dataset && el.dataset.bind;
    if (!key) return;
    setPath(key, el.value);
    const region = el.dataset.region;
    if (region && REGIONS[region]) { const box = $("region-" + region); if (box) box.innerHTML = REGIONS[region](); save(); }
    else if (el.dataset.quiet != null) save();
    else render();
  };
  document.addEventListener("input", (e) => { if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") onInput(e); });
  document.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") onInput(e); });
  $("themeBtn").addEventListener("click", () => { S.dark = !S.dark; render(); });

  render();
})();
