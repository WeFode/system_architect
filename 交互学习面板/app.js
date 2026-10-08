(function () {
  const KEY = "ruankao-arch-study-v1";
  const DEF = {
    tab: "outline", mod: "all", filter: "todo", view: "card", idx: 0,
    status: {}, quiz: { done: 0, right: 0 }, wrong: [], qMod: "all", qMode: "rand", qid: null,
    lab: "decide", scn: "seckill", cache: "normal", model: "blp", subj: 1, obj: 2,
    r1: "0.9", r2: "0.9", r3: "0.9", topo: "mix", mttf: "2000", mttr: "2",
    memS: "A0000", memE: "DFFFF", chipK: "32", chipB: "8", unitB: "8",
    stages: "2,1,3", pn: "100", dn: "5", dm: "3", hn: "32",
    search: "", plan: {}, dark: false,
    caseMode: "read", caseCat: "all", caseQ: "", caseOpen: {}, caseDraft: {}, caseMark: {}, caseAll: false
  };
  let S = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || "{}"));
  let flipped = false, picked = null, openRow = null;
  const save = () => localStorage.setItem(KEY, JSON.stringify(S));
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const $ = (id) => document.getElementById(id);
  const modName = (id) => (MODS.find((m) => m.id === id) || { name: "全部" }).name;

  const TABS = [["outline", "总提纲"], ["map", "考试地图"], ["cards", "口诀背卡"], ["lab", "场景实验室"], ["quiz", "闯关测验"], ["search", "触发词速查"], ["case", "案例对比"], ["tpl", "案例·论文·计划"]];

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

  const PLAN = [
    ["第 1 周 · 架构核心", ["背完“软件架构”前 20 张卡（风格、质量属性、评估）", "做 3 道案例第 1 题：质量属性归类 + 敏感/权衡点", "看懂效用树，能自己画一棵"]],
    ["第 2 周 · 分布式与新架构", ["背完缓存、Redis、CAP、分布式事务、微服务、云原生卡", "场景实验室 6 个场景逐个过一遍", "做 2 道数据库/缓存案例题"]],
    ["第 3 周 · 计算机基础", ["背完“计算机基础”全部卡片", "计算器页把内存、流水线、死锁、可靠性各做 5 题", "测验“计算机基础”正确率到 80%"]],
    ["第 4 周 · 软工·系统·安全·知产", ["背完软件工程、系统工程、信息安全、知产卡片", "设计模式生活类比默写一遍", "测验全模块一轮，错题进错题本"]],
    ["第 5 周 · 真题与论文", ["限时做 2 套上午真题", "限时做 2 套案例", "按模板写 2 篇论文（质量属性类 + 架构风格类）"]],
    ["第 6 周 · 冲刺", ["每天清错题本", "只看考试地图的一页纸骨架 + 模板页", "考前 3 天限时写 1 篇论文，控制在 110 分钟内"]]
  ];

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

  // ---------------- 考试地图 ----------------
  function renderMap() {
    const max = 18;
    const acc = S.quiz.done ? Math.round(S.quiz.right / S.quiz.done * 100) + "%" : "—";
    return `
    <div class="grid g3">
      <div class="panel"><div class="label">三科满分 / 及格线</div><div class="big">75 / 45</div><p class="faint">综合知识、案例分析、论文，一次全过才拿证</p></div>
      <div class="panel"><div class="label">背卡进度</div><div class="big">${statusCounts()[2]} / ${CARDS.length}</div>${progressBar()}</div>
      <div class="panel"><div class="label">测验正确率</div><div class="big">${acc}</div><p class="faint">已答 ${S.quiz.done} 题 · 错题本 ${S.wrong.length} 题</p></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel flat">
        <h2 style="margin-top:0">综合知识分值分布（估算）</h2>
        ${WEIGHTS.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="track"><div class="fillbar" style="width:${v / max * 100}%"></div></div><span>${v} 分</span></div>`).join("")}
        <p class="faint">来源：历年真题经验估算，满分 75 分 · 以当年考试大纲为准</p>
      </div>
      <div class="panel flat">
        <h2 style="margin-top:0">考试结构与策略</h2>
        <table>
          <tr><th>科目</th><th>形式</th><th>策略</th></tr>
          <tr><td>综合知识</td><td>75 道单选</td><td>架构 + 基础 + 软工约占 2/3，先稳这三块</td></tr>
          <tr><td>案例分析</td><td>第 1 题必答，后 4 选 2</td><td>第 1 题拿质量属性；对比选型去「案例对比」背表默写</td></tr>
          <tr><td>论文</td><td>4 选 1，120 分钟</td><td>一个真实项目 + 质量属性策略素材库打天下</td></tr>
        </table>
        <p class="faint">机考，上午综合知识 + 案例，下午论文；具体时长以当年报名公告为准</p>
      </div>
    </div>
    <h2>一页纸骨架：先背口诀，再点进去背卡</h2>
    <div class="grid g3">
      ${MODS.map((m) => {
        const cards = CARDS.filter((c) => c.m === m.id);
        const done = cards.filter((c) => S.status[c.id] === 2).length;
        return `<div class="panel">
          <div class="row" style="justify-content:space-between"><b>${esc(m.name)}</b><span class="faint">约 ${m.score} 分</span></div>
          <ul style="padding-left:18px;margin:8px 0">${m.hook.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
          <div class="row" style="justify-content:space-between"><span class="faint">已掌握 ${done}/${cards.length}</span><button data-act="jump" data-v="${m.id}">背这组卡</button></div>
        </div>`;
      }).join("")}
    </div>`;
  }

  // ---------------- 背卡 ----------------
  const matchFilter = (st, f) => f === "all" || (f === "todo" && st !== 2) || String(st) === f;
  function cardPool() { return CARDS.filter((c) => (S.mod === "all" || c.m === S.mod) && matchFilter(S.status[c.id], S.filter)); }
  function cardBody(c) {
    return `<div class="pre">${esc(c.a)}</div>
      ${c.k ? `<div class="sec"><span class="tag">口诀</span><span class="hl">${esc(c.k)}</span></div>` : ""}
      ${c.l ? `<div class="sec pre"><span class="tag">生活类比</span>${esc(c.l)}</div>` : ""}
      ${c.t ? `<div class="sec pre"><span class="tag">考法</span>${esc(c.t)}</div>` : ""}`;
  }
  function renderCards() {
    const pool = cardPool();
    const filters = [["todo", "待攻克"], ["all", "全部"], ["0", "不会"], ["1", "模糊"], ["2", "已会"]];
    let body;
    if (!pool.length) {
      body = `<div class="panel"><p>这个筛选条件下没有卡片了。${S.filter === "todo" ? "这一组已经全部掌握，换一组或切到“全部”复习。" : ""}</p></div>`;
    } else if (S.view === "card") {
      const i = S.idx % pool.length, c = pool[i];
      body = `
      <div class="flash" data-act="flip">
        <div class="row" style="justify-content:space-between"><span class="tag">${esc(modName(c.m))}</span><span class="faint">${i + 1} / ${pool.length} · 点击卡片${flipped ? "收起" : "翻面"}</span></div>
        <div class="q">${esc(c.q)}</div>
        ${flipped ? cardBody(c) : `<p class="faint">先在心里说出答案和口诀，再翻面核对。</p>`}
      </div>
      <div class="row" style="margin-top:12px">
        <button data-act="prev">上一张</button>
        <span style="flex:1"></span>
        <button data-act="mark" data-v="0">不会</button>
        <button data-act="mark" data-v="1">模糊</button>
        <button class="primary" data-act="mark" data-v="2">会了</button>
      </div>`;
    } else {
      body = `<div class="panel">${pool.map((c) => `<div class="listrow" data-act="row" data-v="${c.id}">
        <span class="dot ${S.status[c.id] != null ? "s" + S.status[c.id] : ""}"></span>${esc(c.q)} <span class="faint">· ${esc(modName(c.m))}</span>
        ${openRow === c.id ? `<div class="ans">${cardBody(c)}</div>` : ""}</div>`).join("")}</div>`;
    }
    return `
      ${modPills(S.mod, "mod")}
      <div class="row" style="margin:10px 0 14px">
        ${filters.map(([v, n]) => `<button class="pill ${S.filter === v ? "on" : ""}" data-act="filter" data-v="${v}">${n}</button>`).join("")}
        <span style="flex:1"></span>
        <button class="pill ${S.view === "card" ? "on" : ""}" data-act="view" data-v="card">卡片模式</button>
        <button class="pill ${S.view === "list" ? "on" : ""}" data-act="view" data-v="list">列表模式</button>
      </div>
      ${body}
      <div style="margin-top:16px">${progressBar()}</div>
      <p class="faint">复习节奏：1 天 → 2 天 → 4 天 → 7 天 → 15 天，只复习“待攻克”。</p>`;
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

  // ---------------- 测验 ----------------
  function quizPool() {
    return QUIZ.filter((q) => (S.qMod === "all" || q.m === S.qMod) && (S.qMode === "rand" || S.wrong.includes(q.id)));
  }
  function nextQ() {
    const pool = quizPool().filter((q) => q.id !== S.qid);
    const all = quizPool();
    const src = pool.length ? pool : all;
    S.qid = src.length ? src[Math.floor(Math.random() * src.length)].id : null;
    picked = null;
  }
  function renderQuiz() {
    let q = QUIZ.find((x) => x.id === S.qid);
    if (!q || !quizPool().some((x) => x.id === q.id)) { nextQ(); q = QUIZ.find((x) => x.id === S.qid); }
    const acc = S.quiz.done ? Math.round(S.quiz.right / S.quiz.done * 100) : 0;
    let body;
    if (!q) body = `<div class="panel"><p>${S.qMode === "wrong" ? "错题本是空的，切回“随机刷题”继续。" : "这个模块暂时没有题目。"}</p></div>`;
    else body = `<div class="panel">
        <div class="row" style="justify-content:space-between"><span class="tag">${esc(modName(q.m))}</span>${S.wrong.includes(q.id) ? `<span class="faint">错题本中</span>` : ""}</div>
        <p class="q" style="font-size:17px;font-weight:600;margin:10px 0">${esc(q.q)}</p>
        ${q.o.map((o, i) => {
          let cls = "opt";
          if (picked != null) { if (i === q.r) cls += " right"; else if (i === picked) cls += " wrong"; }
          return `<button class="${cls}" data-act="pick" data-v="${i}" ${picked != null ? "disabled" : ""}>${"ABCD"[i]}. ${esc(o)}</button>`;
        }).join("")}
        ${picked != null ? `<p style="margin-top:10px"><b class="${picked === q.r ? "ok" : "bad"}">${picked === q.r ? "答对了" : "答错了，正确答案是 " + "ABCD"[q.r]}</b>　${esc(q.w)}</p>
          <div class="row" style="margin-top:8px"><button class="primary" data-act="nextq">下一题</button>${S.wrong.includes(q.id) ? `<button data-act="unwrong">已掌握，移出错题本</button>` : ""}</div>` : ""}
      </div>`;
    return `
      ${modPills(S.qMod, "qmod")}
      <div class="row" style="margin:10px 0 14px">
        <button class="pill ${S.qMode === "rand" ? "on" : ""}" data-act="qmode" data-v="rand">随机刷题</button>
        <button class="pill ${S.qMode === "wrong" ? "on" : ""}" data-act="qmode" data-v="wrong">错题重练（${S.wrong.length}）</button>
        <span style="flex:1"></span><span class="faint">已答 ${S.quiz.done} · 正确率 ${acc}%</span>
        <button class="ghost" data-act="resetq">清零统计</button>
      </div>${body}`;
  }

  // ---------------- 速查 ----------------
  function renderSearch() {
    return `<p class="muted">输入题干里的关键词（如“热点”“双向绑定”“不上读”），同时搜索触发词表和全部背卡。</p>
      <input class="wide" id="searchBox" data-bind="search" data-region="search" placeholder="输入关键词……" value="${esc(S.search)}">
      <div id="region-search" style="margin-top:14px">${searchOut()}</div>`;
  }
  function searchOut() {
    const k = S.search.trim().toLowerCase();
    const trig = TRIGGERS.filter(([a, b]) => !k || (a + b).toLowerCase().includes(k));
    const cards = k ? CARDS.filter((c) => [c.q, c.a, c.k, c.l, c.t].join(" ").toLowerCase().includes(k)) : [];
    return `<h3>题干触发词 → 答案（${trig.length}）</h3>
      <table><tr><th style="width:50%">看到</th><th>选 / 想到</th></tr>${trig.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="hl">${esc(b)}</td></tr>`).join("")}</table>
      ${k ? `<h3>相关背卡（${cards.length}）</h3>${cards.map((c) => `<div class="panel" style="margin:8px 0"><b>${esc(c.q)}</b> <span class="faint">· ${esc(modName(c.m))}</span><div style="margin-top:6px">${cardBody(c)}</div></div>`).join("")}` : ""}`;
  }

  // ---------------- 案例对比（背题 / 默写） ----------------
  function caseShown(item, ri, ci) {
    if (S.caseMode !== "write" || ci === 0 || S.caseAll) return true;
    return !!S.caseOpen[item.id + "-" + ri + "-" + ci];
  }
  function caseKeys(item) {
    const keys = [];
    item.rows.forEach((row, ri) => row.forEach((_, ci) => { if (ci) keys.push(item.id + "-" + ri + "-" + ci); }));
    return keys;
  }
  function materializeCase() {
    if (!S.caseAll) return;
    S.caseAll = false;
    CASE_COMPARE.forEach((item) => caseKeys(item).forEach((k) => { S.caseOpen[k] = 1; }));
  }
  function caseList() {
    const k = S.caseQ.trim().toLowerCase();
    const items = CASE_COMPARE.filter((item) => {
      if (S.caseCat !== "all" && item.category !== S.caseCat) return false;
      if (!k) return true;
      return [item.title, item.tip, item.category, ...item.headers, ...item.rows.flat()].join(" ").toLowerCase().includes(k);
    });
    if (!items.length) return `<div class="panel"><p>没有对上的对比题。换个分类，或把搜索词缩短。</p></div>`;
    return items.map((item) => {
      const head = item.headers.map((h) => `<th>${esc(h)}</th>`).join("");
      const body = item.rows.map((row, ri) => `<tr>${row.map((cell, ci) => {
        const shown = caseShown(item, ri, ci);
        const act = S.caseMode === "write" && ci > 0 ? ` data-act="casecell" data-v="${item.id}-${ri}-${ci}"` : "";
        const inner = shown ? esc(cell) : `<span class="mask">点击显示</span>`;
        return `<td${act}>${ci === 0 ? `<b>${inner}</b>` : inner}</td>`;
      }).join("")}</tr>`).join("");
      const mark = S.caseMark[item.id];
      const marks = [["0", "不会"], ["1", "模糊"], ["2", "会了"]].map(([v, n]) =>
        `<button class="pill ${String(mark) === v ? "on" : ""}" data-act="casemark" data-v="${item.id}:${v}">${n}</button>`).join("");
      const write = S.caseMode === "write";
      return `<div class="panel" style="margin-bottom:14px">
        <div class="row" style="justify-content:space-between"><b>${item.id}. ${esc(item.title)}</b><span class="tag">${esc(item.category)}</span></div>
        <div class="case-scroll"><table><tr>${head}</tr>${body}</table></div>
        <p class="sec pre" style="margin-top:10px"><span class="tag">踩分</span>${esc(item.tip)}</p>
        ${write ? `<textarea class="note" data-draft="${item.id}" placeholder="先写结论一句，再按维度列差异，最后扣题干原词。">${esc(S.caseDraft[item.id] || "")}</textarea>
          <div class="row" style="margin-top:8px"><button data-act="casecard" data-v="${item.id}">显隐本题答案</button>${marks}</div>` : `<div class="row" style="margin-top:8px">${marks}</div>`}
      </div>`;
    }).join("");
  }
  function renderCase() {
    const cats = ["all"].concat([...new Set(CASE_COMPARE.map((c) => c.category))]);
    const known = CASE_COMPARE.filter((c) => S.caseMark[c.id] === 2).length;
    const names = { all: "全部" };
    return `
      <p class="muted">案例分析里的对比选型题：背题直接看表，默写先遮住方案列，自己写完再点开核对。勾过的掌握程度保存在本机。</p>
      <div class="grid g3" style="margin:12px 0">
        ${CASE_RULES.map(([t, d]) => `<div class="panel"><b>${esc(t)}</b><p class="faint" style="margin-top:6px">${esc(d)}</p></div>`).join("")}
      </div>
      <p class="faint">${esc(CASE_FRAME)} 已掌握 ${known} / ${CASE_COMPARE.length} 题。</p>
      <div class="row" style="margin:12px 0">
        ${cats.map((c) => `<button class="pill ${S.caseCat === c ? "on" : ""}" data-act="casecat" data-v="${esc(c)}">${esc(names[c] || c)}</button>`).join("")}
      </div>
      <div class="row" style="margin-bottom:14px">
        <button class="pill ${S.caseMode === "read" ? "on" : ""}" data-act="casemode" data-v="read">背题</button>
        <button class="pill ${S.caseMode === "write" ? "on" : ""}" data-act="casemode" data-v="write">默写</button>
        <input class="wide" data-bind="caseQ" data-region="case" placeholder="搜索对比题，如 gRPC、权衡点" value="${esc(S.caseQ)}">
        ${S.caseMode === "write" ? `<button data-act="caseall">${S.caseAll ? "隐藏全部答案" : "显示全部答案"}</button>` : ""}
      </div>
      <div id="region-case">${caseList()}</div>`;
  }

  // ---------------- 模板与计划 ----------------
  function renderTpl() {
    const segs = [["选题", 5], ["列提纲", 10], ["摘要", 15], ["正文", 80], ["检查", 10]];
    const colors = ["var(--faint)", "var(--mid)", "var(--accent)", "var(--ok)", "var(--bad)"];
    return `
    <p class="muted">对比选型（单体和微服务、REST 和 gRPC、CP 和 AP、缓存策略）在「案例对比」里背表和默写。质量属性第 1 题用下面的骨架。</p>
    <h2>案例分析第 1 题（必答）答题模板</h2>
    <table>
      <tr><th>题型</th><th>答题骨架</th></tr>
      <tr><td>质量属性归类</td><td>“属于 <b>XX</b> 质量属性，原因是该描述关注 <b>……（引用题干原词）</b>。”先按判定树：时间/并发 → 性能；故障/恢复 → 可用性；攻击/授权 → 安全性；改动/人天 → 可修改性。</td></tr>
      <tr><td>敏感点 / 权衡点 / 风险点</td><td>看这个决策影响几个质量属性：一个 → 敏感点；多个且此消彼长 → 权衡点；可能出问题 → 风险点。</td></tr>
      <tr><td>架构风格对比选择</td><td>风格特点 → 与本系统需求的匹配 → 结论；每一点都带上题干原词。</td></tr>
      <tr><td>效用树填空</td><td>第二层填质量属性名，叶子填场景编号；注意“场景六要素”的词。</td></tr>
    </table>
    <p class="faint">得分三件套：术语 + 题干原词 + 因果。每小问按分值写要点，一般 1 个要点 1–2 分。</p>

    <h2>其他案例题型</h2>
    <table>
      <tr><th>题型</th><th>答题骨架</th></tr>
      <tr><td>数据库 / 缓存</td><td>问题成因 → 方案（布隆过滤器、互斥锁、随机过期、Cache Aside）→ 优缺点</td></tr>
      <tr><td>Redis 选型</td><td>数据类型匹配（ZSet 排行、Hash 对象、List 队列、Set 去重）+ 持久化选择（RDB/AOF）</td></tr>
      <tr><td>反规范化</td><td>手段 → 性能收益 → 一致性保障（触发器 / 应用同步 / 批处理）</td></tr>
      <tr><td>Web / 微服务</td><td>网关、注册中心、负载均衡、熔断限流降级、消息队列削峰解耦</td></tr>
      <tr><td>嵌入式</td><td>分层架构、实时调度、余度与容错、ARINC 653 时空分区</td></tr>
      <tr><td>系统建模</td><td>DFD 补全（找黑洞、奇迹）、E-R 补全、用例/类/顺序/状态图</td></tr>
    </table>

    <h2>论文：120 分钟时间分配</h2>
    <div class="bar" style="height:14px">${segs.map(([n, v], i) => `<span title="${n}" style="width:${v / 120 * 100}%;background:${colors[i]}"></span>`).join("")}</div>
    <div class="row" style="margin-top:6px">${segs.map(([n, v], i) => `<span class="faint"><span class="dot" style="background:${colors[i]}"></span>${n} ${v} 分钟</span>`).join("")}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="panel flat"><h3 style="margin-top:0">结构与字数</h3>
        <table>
          <tr><td>摘要</td><td>300–330 字</td><td>项目 + 规模 + 我的角色 + 方法 + 效果</td></tr>
          <tr><td>项目背景</td><td>400–500 字</td><td>时间、单位、规模、周期、团队、我的职责</td></tr>
          <tr><td>理论论述</td><td>300–500 字</td><td>回答题目第 2 问：概念 + 分类/步骤</td></tr>
          <tr><td>实践展开</td><td>1200–1500 字</td><td>3–4 个点，每点“问题 → 方案 → 效果（带数字）”</td></tr>
          <tr><td>总结</td><td>200–300 字</td><td>成果 + 不足 + 改进方向</td></tr>
        </table></div>
      <div class="panel flat"><h3 style="margin-top:0">质量属性 → 策略素材库</h3>
        <p><b>性能</b>：多级缓存、异步削峰、读写分离、分库分表、CDN、连接池、索引优化</p>
        <p><b>可用性</b>：集群 + 负载均衡、主备切换、限流熔断降级、异地多活、健康检查</p>
        <p><b>安全性</b>：统一认证（OAuth2/JWT）、RBAC、HTTPS、加密脱敏、审计日志、WAF</p>
        <p><b>可修改性</b>：分层、模块化、DDD 限界上下文、接口隔离、配置中心、插件化</p>
        <p><b>可伸缩性</b>：无状态服务、容器弹性伸缩、数据分片</p>
        <p class="bad">雷区：没有真实项目细节；摘要与正文对不上；把微服务、3PC 写成银弹；跑题到项目管理；字数不足。</p></div>
    </div>

    <h2>6 周冲刺计划（按 11 月上旬考试倒排，勾选自动保存）</h2>
    <div class="grid g3">${PLAN.map(([w, items], wi) => `<div class="panel"><b>${esc(w)}</b>${items.map((it, ii) => {
      const id = wi + "-" + ii;
      return `<label class="check"><input type="checkbox" data-act="plan" data-v="${id}" ${S.plan[id] ? "checked" : ""}><span class="${S.plan[id] ? "faint" : ""}">${esc(it)}</span></label>`;
    }).join("")}</div>`).join("")}</div>`;
  }

  // ---------------- 渲染与事件 ----------------
  function render() {
    document.body.classList.toggle("dark", !!S.dark);
    document.body.classList.toggle("wide", S.tab === "outline" || S.tab === "case");
    $("tabs").innerHTML = TABS.map(([v, n]) => `<button class="pill ${S.tab === v ? "on" : ""}" data-act="tab" data-v="${v}">${n}</button>`).join("");
    $("app").innerHTML = { outline: renderOutline, map: renderMap, cards: renderCards, lab: renderLab, quiz: renderQuiz, search: renderSearch, case: renderCase, tpl: renderTpl }[S.tab]();
    save();
  }
  const REGIONS = { rel: relOut, avail: availOut, mem: memOut, pipe: pipeOut, dead: deadOut, ham: hamOut, search: searchOut, case: caseList };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const v = el.dataset.v;
    switch (el.dataset.act) {
      case "tab": S.tab = v; break;
      case "jumpmd": { const n = document.getElementById(v); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      case "jump": S.mod = v; S.filter = "todo"; S.idx = 0; S.tab = "cards"; flipped = false; break;
      case "mod": S.mod = v; S.idx = 0; flipped = false; break;
      case "filter": S.filter = v; S.idx = 0; flipped = false; break;
      case "view": S.view = v; break;
      case "flip": flipped = !flipped; break;
      case "prev": { const n = cardPool().length || 1; S.idx = (S.idx - 1 + n) % n; flipped = false; break; }
      case "mark": {
        const pool = cardPool(); if (!pool.length) return;
        const c = pool[S.idx % pool.length], lv = +v;
        S.status[c.id] = lv;
        if (matchFilter(lv, S.filter)) S.idx++;
        flipped = false; break;
      }
      case "row": openRow = openRow === v ? null : v; break;
      case "lab": S.lab = v; break;
      case "scn": S.scn = v; break;
      case "cache": S.cache = v; break;
      case "model": S.model = v; break;
      case "qmod": S.qMod = v; nextQ(); break;
      case "qmode": S.qMode = v; nextQ(); break;
      case "pick": {
        if (picked != null) return;
        const q = QUIZ.find((x) => x.id === S.qid); picked = +v;
        S.quiz.done++;
        if (picked === q.r) S.quiz.right++;
        else if (!S.wrong.includes(q.id)) S.wrong.push(q.id);
        break;
      }
      case "nextq": nextQ(); break;
      case "unwrong": S.wrong = S.wrong.filter((x) => x !== S.qid); nextQ(); break;
      case "resetq": if (confirm("清零测验统计？错题本会保留。")) S.quiz = { done: 0, right: 0 }; break;
      case "plan": S.plan[v] = el.checked; break;
      case "casemode": S.caseMode = v; break;
      case "casecat": S.caseCat = v; break;
      case "caseall":
        if (S.caseAll) { S.caseAll = false; S.caseOpen = {}; }
        else S.caseAll = true;
        break;
      case "casecell":
        if (S.caseMode !== "write") return;
        materializeCase();
        if (S.caseOpen[v]) delete S.caseOpen[v];
        else S.caseOpen[v] = 1;
        break;
      case "casecard": {
        const item = CASE_COMPARE.find((x) => String(x.id) === v);
        if (!item) return;
        materializeCase();
        const keys = caseKeys(item);
        const allOn = keys.every((k) => S.caseOpen[k]);
        keys.forEach((k) => { if (allOn) delete S.caseOpen[k]; else S.caseOpen[k] = 1; });
        break;
      }
      case "casemark": {
        const parts = v.split(":");
        S.caseMark[parts[0]] = +parts[1];
        break;
      }
      default: return;
    }
    render();
  });

  const onInput = (e) => {
    const el = e.target; const key = el.dataset && el.dataset.bind;
    if (!key) return;
    S[key] = el.value;
    const region = el.dataset.region;
    if (region && REGIONS[region]) { $("region-" + region).innerHTML = REGIONS[region](); save(); }
    else render();
  };
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.draft != null) {
      S.caseDraft[el.dataset.draft] = el.value;
      save();
      return;
    }
    if (el.tagName === "INPUT") onInput(e);
  });
  document.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") onInput(e); });
  $("themeBtn").addEventListener("click", () => { S.dark = !S.dark; render(); });

  render();
})();
