// 知识图谱：力导向布局的可交互概念关系图（原生 SVG，无外部库）
(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  "use strict";

  // ======================= 样式（只注入一次） =======================
  const CSS = `
.kg-root { position: relative; }
.kg-intro { margin: 0 0 10px; color: var(--muted); line-height: 1.7; }
.kg-intro b { color: var(--text); font-weight: 600; }
.kg-bar { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; }
.kg-row { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; margin: 4px 0; }
.kg-lab { color: var(--muted); font-size: 12px; min-width: 30px; }
.kg-sp { flex: 1; }
.kg-tg { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; padding: 2px 9px 2px 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); user-select: none; }
.kg-tg input { width: auto; margin: 0; }
.kg-tg svg { display: block; }
.kg-bar select { max-width: 150px; }
.kg-bar input.kg-q { width: 220px; }
.kg-sum { margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--line); font-size: 13px; line-height: 1.7; }
.kg-sum .bar { margin: 4px 0 2px; max-width: 420px; }
.kg-main { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; align-items: start; }
@media (max-width: 1000px) { .kg-main { grid-template-columns: minmax(0, 1fr); } }
.kg-stage { position: relative; height: 560px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.kg-stage.kg-tall { height: 820px; }
.kg-svg { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; }
.kg-svg.kg-panning { cursor: grabbing; }
.kg-zoom { position: absolute; right: 8px; top: 8px; display: flex; flex-direction: column; gap: 4px; }
.kg-zoom button { width: 30px; height: 30px; padding: 0; font-size: 16px; line-height: 1; background: var(--panel); }
.kg-legend { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 60px); background: color-mix(in srgb, var(--panel) 92%, transparent); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; font-size: 12px; line-height: 1.5; }
.kg-li { display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; white-space: nowrap; }
.kg-li svg { display: block; }
.kg-sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 1px; }
.kg-ld summary { cursor: pointer; color: var(--muted); }
.kg-ld .kg-li { margin-top: 2px; }
.kg-ls { display: inline-block; vertical-align: middle; }

.kg-e { fill: none; stroke: var(--faint); stroke-width: 1.3; vector-effect: non-scaling-stroke; opacity: .6; pointer-events: none; }
.kg-e.r-ensure { stroke: var(--ok); }
.kg-e.r-solve { stroke: var(--accent); }
.kg-e.r-trade { stroke: var(--bad); stroke-width: 2.2; opacity: .9; }
.kg-e.r-cmp { stroke: var(--mid); stroke-dasharray: 6 4; }
.kg-e.r-has { stroke: var(--muted); }
.kg-e.r-dep { stroke: var(--muted); stroke-dasharray: 2 3; }
.kg-e.r-exam { stroke: var(--faint); stroke-width: .9; opacity: .3; }
.kg-e.kg-fade { opacity: .1; }
.kg-e.kg-dim { opacity: .05; }
.kg-e.kg-off { opacity: .03; }
.kg-e.kg-hot { opacity: 1; stroke-width: 2.3; }
.kg-blind .kg-e { opacity: .03; }
.kg-el { fill: var(--text); paint-order: stroke; stroke: var(--panel); stroke-linejoin: round; text-anchor: middle; pointer-events: none; font-weight: 600; }
.kg-n { cursor: pointer; }
.kg-sh { stroke: var(--panel); stroke-width: 1.6; }
.kg-fold { fill: none; stroke: var(--panel); stroke-width: 1.4; pointer-events: none; }
.kg-ring { fill: none; stroke: var(--text); stroke-width: 2.4; display: none; pointer-events: none; }
.kg-n:hover .kg-sh { stroke: var(--text); }
.kg-n.kg-sel .kg-sh { stroke: var(--text); stroke-width: 2.6; }
.kg-n.kg-sel .kg-ring { display: block; }
.kg-n.kg-hit .kg-ring { display: block; stroke: var(--accent); stroke-dasharray: 5 3; }
.kg-n.kg-cur .kg-ring { stroke: var(--accent); stroke-dasharray: none; stroke-width: 3; }
.kg-n.kg-qc .kg-ring { display: block; stroke: var(--accent); stroke-width: 3; stroke-dasharray: none; }
.kg-n.kg-lv-none .kg-sh { stroke: var(--faint); stroke-dasharray: 3 2; stroke-width: 1.4; }
.kg-n.kg-fade { opacity: .28; }
.kg-n.kg-dim { opacity: .13; }
.kg-n.kg-off { opacity: .06; pointer-events: none; }
.kg-blind .kg-n:not(.kg-qc) { opacity: .06; pointer-events: none; }
.kg-l { fill: var(--text); paint-order: stroke; stroke: var(--panel); stroke-linejoin: round; text-anchor: middle; pointer-events: none; display: none; }
.kg-l.kg-fade { opacity: .45; }
.kg-l.kg-off { opacity: .15; }
.kg-b { fill: var(--text); paint-order: stroke; stroke: var(--panel); stroke-width: 2.5px; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; display: none; }
.kg-b.kg-star { fill: var(--mid); font-size: 17px; }

.kg-side { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; min-width: 0; }
.kg-side h3 { margin: 0; font-size: 17px; }
.kg-side h4 { margin: 14px 0 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
.kg-dh { display: flex; align-items: center; gap: 8px; }
.kg-ico { flex: none; }
.kg-tags { margin: 6px 0 4px; }
.kg-desc { margin: 6px 0; line-height: 1.7; }
.kg-proj { display: flex; gap: 8px; margin: 10px 0 4px; padding: 8px 10px; background: var(--accent-soft); border-left: 3px solid var(--mid); border-radius: 0 6px 6px 0; }
.kg-proj p { margin: 2px 0 0; }
.kg-star { color: var(--mid); font-size: 17px; line-height: 1.3; }
.kg-card { border: 1px solid var(--line); border-radius: 6px; margin: 6px 0; padding: 4px 8px; }
.kg-card summary { cursor: pointer; line-height: 1.6; padding: 2px 0; }
.kg-ans { margin: 6px 0 8px; padding-top: 6px; border-top: 1px dashed var(--line); font-size: 13px; }
.kg-ans .sec { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--line); }
.kg-mk { margin-bottom: 4px; }
.kg-mk button { font-size: 12px; padding: 2px 10px; }
.kg-mk button.on { background: var(--text); color: var(--bg); border-color: var(--text); }
.kg-grp { margin: 6px 0; }
.kg-gl { font-size: 12px; color: var(--muted); margin-bottom: 3px; }
.kg-chip { display: inline-flex; align-items: center; gap: 4px; margin: 0 4px 4px 0; padding: 2px 8px 2px 6px; border-radius: 999px; font-size: 12px; background: var(--fill); }
.kg-chip svg { display: block; flex: none; }
.kg-chip:hover { border-color: var(--accent); background: var(--accent-soft); }
.kg-m { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-left: 1px; background: var(--line); flex: none; }
.kg-m.m-ok { background: var(--ok); }
.kg-m.m-mid { background: var(--mid); }
.kg-m.m-bad { background: var(--bad); }
.kg-m.m-new { background: var(--faint); }
.kg-hubs { margin-top: 6px; }

.kg-qhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.kg-qq { margin: 8px 0; line-height: 1.8; }
.kg-qname { font-weight: 700; color: var(--accent); font-size: 16px; }
.kg-hint { margin: 4px 0 8px; font-size: 13px; color: var(--muted); }
.kg-hint summary { cursor: pointer; }
.kg-opts { display: grid; gap: 6px; }
.kg-opt { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; text-align: left; padding: 6px 10px; }
.kg-opt svg { display: block; flex: none; }
.kg-opt small { flex-basis: 100%; color: var(--muted); font-size: 12px; padding-left: 20px; }
.kg-opt.on { border-color: var(--accent); background: var(--accent-soft); }
.kg-opt.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 14%, transparent); }
.kg-opt.miss { border-color: var(--mid); background: color-mix(in srgb, var(--mid) 16%, transparent); }
.kg-opt.bad { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 14%, transparent); }
.kg-res { margin: 10px 0 6px; padding: 8px 10px; border-radius: 6px; background: var(--fill); }
.kg-res ul { margin: 4px 0 0; padding-left: 18px; }
.kg-res li { margin: 2px 0; font-size: 13px; }
`;
  if (!document.getElementById("kg-graph-style")) {
    const st = document.createElement("style");
    st.id = "kg-graph-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ======================= 数据与邻接表 =======================
  const G = window.KD_GRAPH || {};
  const TYPES = G.types || {};
  const RELS = G.rels || {};
  const NODES = (G.nodes || []).filter((n) => n && n.id);
  const NIDX = Object.create(null);
  NODES.forEach((n, i) => { NIDX[n.id] = i; });
  const E = [];
  (G.edges || []).forEach((e) => {
    const s = NIDX[e.s], t = NIDX[e.t];
    if (s != null && t != null && s !== t) E.push({ s, t, rel: e.rel });
  });
  const SYMREL = { "取舍": 1, "对比": 1 };
  const ADJ = NODES.map(() => []);
  E.forEach((e, ei) => {
    const sym = SYMREL[e.rel] ? "sym" : null;
    ADJ[e.s].push({ o: e.t, e: ei, dir: sym || "out" });
    ADJ[e.t].push({ o: e.s, e: ei, dir: sym || "in" });
  });
  const DEG = ADJ.map((a) => a.length);
  const TYPE_KEYS = Object.keys(TYPES).length ? Object.keys(TYPES) : ["scene", "qa", "tactic", "style", "theory", "paper"];
  const MODLIST = (typeof MODS !== "undefined" ? MODS : []).map((m) => ({ id: m.id, name: m.name }));
  const modLabel = (id) => (id === "paper" ? "论文套题" : (MODLIST.find((m) => m.id === id) || { name: id }).name);
  const KITN = {
    K01: "微服务架构及其应用", K02: "高并发系统与秒杀", K03: "负载均衡设计与数据分片", K04: "分布式事务及其解决方案", K05: "事件驱动架构",
    K06: "云原生架构", K07: "安全架构设计", K08: "数据架构类", K09: "AI 应用类", K10: "高可用与可靠性设计", K11: "企业集成/SOA/ESB",
    K12: "六边形架构/DDD/面向对象设计", K13: "软件维护、演化与 DevOps", K14: "软件测试", K15: "架构评估、非功能需求与架构风格"
  };

  // 形状（类型）+ 颜色（可切换），保证色盲也能靠形状区分
  const SHAPE = {
    scene: "M0,-15 L15,0 L0,15 L-15,0Z",
    qa: "M-13,0 A13,13 0 1,0 13,0 A13,13 0 1,0 -13,0Z",
    tactic: "M-7,-10.5 H7 Q10.5,-10.5 10.5,-7 V7 Q10.5,10.5 7,10.5 H-7 Q-10.5,10.5 -10.5,7 V-7 Q-10.5,-10.5 -7,-10.5Z",
    style: "M-14,0 L-7,-12.1 L7,-12.1 L14,0 L7,12.1 L-7,12.1Z",
    theory: "M-9,-8 H9 A8,8 0 0 1 9,8 H-9 A8,8 0 0 1 -9,-8Z",
    paper: "M-9,-12 H3 L10,-5 V12 H-9Z"
  };
  const FOLD = "M3,-12 V-5 H10";
  const HW = { scene: 15, qa: 13, tactic: 11.5, style: 14, theory: 17, paper: 11 }; // 半宽，用来让箭头停在节点边缘
  const HH = { scene: 15, qa: 13, tactic: 10.5, style: 12.5, theory: 8, paper: 12 }; // 半高，用来放标签
  const PURPLE = "color-mix(in srgb, var(--accent) 55%, var(--bad))";
  const TEAL = "color-mix(in srgb, var(--ok) 55%, var(--accent))";
  const TCOLOR = { scene: "var(--bad)", qa: "var(--accent)", tactic: "var(--ok)", style: "var(--mid)", theory: PURPLE, paper: "var(--text)" };
  const MCOLOR = { arch: "var(--accent)", base: "var(--ok)", se: "var(--mid)", sys: PURPLE, sec: "var(--bad)", misc: "var(--faint)", emb: TEAL, paper: "var(--text)" };
  const LCOLOR = { ok: "var(--ok)", mid: "var(--mid)", bad: "var(--bad)", new: "var(--faint)", none: "var(--fill)" };
  const LNAME = { ok: "已掌握", mid: "需巩固", bad: "不会", new: "未学", none: "无背卡" };
  const LGLYPH = { ok: "✓", mid: "△", bad: "✗", new: "", none: "" };
  const RELKEY = { "保障": "ensure", "解决": "solve", "取舍": "trade", "对比": "cmp", "包含": "has", "依赖": "dep", "考": "exam" };
  const rk = (rel) => RELKEY[rel] || "other";
  const MARKER_RELS = ["ensure", "solve", "trade", "has", "dep", "exam"];
  const MARKER_COLOR = { ensure: "var(--ok)", solve: "var(--accent)", trade: "var(--bad)", has: "var(--muted)", dep: "var(--muted)", exam: "var(--faint)" };
  const NOARROW = { cmp: 1, other: 1 };
  const RELDIR = { "保障": "保障 →", "解决": "解决 →", "取舍": "取舍 ↔", "对比": "对比 ┄", "包含": "包含 →", "依赖": "依赖 ⇢", "考": "考 →" };
  const OUTTXT = { "保障": "它保障", "解决": "它能解决", "包含": "它包含", "依赖": "它依赖", "考": "它考查" };
  const INTXT = { "保障": "保障它的", "解决": "能解决它的", "包含": "包含它的", "依赖": "依赖它的", "考": "考到它的套题" };
  const SYMTXT = { "取舍": "与它取舍", "对比": "与它对比" };

  // ======================= 闭包状态 =======================
  const KMIN = 0.22, KMAX = 3.5, LBL = 11.5;
  let POS = null;                 // 每个节点的世界坐标 [{x,y}]
  let relayoutN = 0;
  let view = { x: 0, y: 0, k: 1, init: false };
  let viewSel = "";               // 视图上次聚焦时的选中节点，用来识别 #graph:graphSel=xx 直达
  let W = 780, H = 560;
  let quizOn = false, quiz = null;
  let query = "", hits = [], hitI = 0;
  let ctx = null;                 // 当前这次渲染的 DOM 引用
  let cleanup = null;
  let anim = 0, raf = 0;
  let cardMap = null, cardMapN = -1;
  const LW = NODES.map((n) => 0);  // 标签宽度（以字号为 1 的单位）

  // ======================= 小工具 =======================
  const $ = (id) => document.getElementById(id);
  const esc = (s) => api.esc(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cw = (ch) => (ch.charCodeAt(0) > 255 ? 1 : 0.56);
  const textUnits = (s) => { let w = 0; for (const ch of String(s)) w += cw(ch); return w; };
  const trunc = (s, max) => { let w = 0, out = ""; for (const ch of String(s)) { const c = cw(ch); if (w + c > max) return out + "…"; w += c; out += ch; } return out; };
  const LABELS = NODES.map((n) => trunc(n.name, 9.6));
  NODES.forEach((n, i) => { LW[i] = textUnits(LABELS[i]); });
  const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  const getCard = (id) => {
    const arr = api.cards();
    if (!cardMap || cardMapN !== arr.length) { cardMap = new Map(arr.map((c) => [c.id, c])); cardMapN = arr.length; }
    return cardMap.get(id);
  };
  const icon = (type, color, px) => `<svg class="kg-ico" viewBox="-17 -17 34 34" width="${px || 14}" height="${px || 14}" aria-hidden="true"><path d="${SHAPE[type] || SHAPE.qa}" style="fill:${color || TCOLOR[type] || "var(--muted)"}"/>${type === "paper" ? `<path d="${FOLD}" style="fill:none;stroke:var(--panel);stroke-width:1.6"/>` : ""}</svg>`;

  // ======================= 状态规整 =======================
  function norm() {
    const s = api.S;
    if (!["type", "module", "mastery", "project"].includes(s.graphColor)) s.graphColor = "type";
    if (!Array.isArray(s.graphHide)) s.graphHide = [];
    s.graphHide = s.graphHide.filter((t) => TYPE_KEYS.includes(t));
    if (s.graphMod !== "all" && !MODLIST.some((m) => m.id === s.graphMod)) s.graphMod = "all";
    if (s.graphSel && NIDX[s.graphSel] == null) s.graphSel = "";
    if (!s.graphStat || typeof s.graphStat !== "object") s.graphStat = { n: 0, r: 0 };
    s.graphStat.n = +s.graphStat.n || 0; s.graphStat.r = +s.graphStat.r || 0;
    s.graphExam = !(s.graphExam === false || s.graphExam === "0" || s.graphExam === "false");
    s.graphTall = s.graphTall === true || s.graphTall === "1" || s.graphTall === "true";
  }
  const selIdx = () => { const id = api.S.graphSel; return id && NIDX[id] != null ? NIDX[id] : -1; };

  // ======================= 掌握度 =======================
  function masteryLevel(n) {
    const st = api.S.status || {};
    const cs = (n.cards || []).filter((id) => getCard(id));
    if (!cs.length) return "none";
    const v = cs.map((id) => st[id]);
    if (v.every((x) => x == null)) return "new";
    if (v.every((x) => x === 2)) return "ok";
    if (v.some((x) => x === 0)) return "bad";
    return "mid";
  }
  function masteryReport() {
    const lv = NODES.map(masteryLevel);
    const cnt = { ok: 0, mid: 0, bad: 0, new: 0, none: 0 };
    const byMod = {};
    NODES.forEach((n, i) => {
      if (n.type === "paper") return;
      cnt[lv[i]]++;
      if (lv[i] === "none") return;
      const m = byMod[n.mod] || (byMod[n.mod] = { ok: 0, mid: 0, bad: 0, new: 0, n: 0 });
      m[lv[i]]++; m.n++;
    });
    const weak = Object.keys(byMod).filter((m) => byMod[m].n >= 2)
      .map((m) => ({ m, ok: byMod[m].ok, n: byMod[m].n, bad: byMod[m].bad, score: (byMod[m].ok + 0.5 * byMod[m].mid) / byMod[m].n }))
      .sort((a, b) => a.score - b.score || b.bad - a.bad).slice(0, 3);
    return { lv, cnt, weak, total: cnt.ok + cnt.mid + cnt.bad + cnt.new, studied: cnt.ok + cnt.mid + cnt.bad };
  }

  // ======================= 力导向布局 =======================
  // 参数集中在 LP：类型锚点（决定“场景在左、风格在上、策略在下”的大分区）、斥力、弹簧、椭圆重力（让整体比画布更扁）
  const LP = {
    AN: { qa: [0, 0], scene: [-470, -10], style: [-20, -290], theory: [470, -120], tactic: [30, 250] },
    SPR: { qa: [110, 80], scene: [110, 190], style: [230, 80], theory: [110, 170], tactic: [340, 150] },
    KC: { qa: 0.014, scene: 0.016, style: 0.014, theory: 0.016, tactic: 0.006 },
    REP: 600, CUT: 200, REST: 80, HUB: 10, KS: 0.12, XREST: 240, XKS: 0.004,
    GX: 0.0012, GY: 0.005, RX: 620, RY: 420, ITER: 380, MIND: 64
  };
  function layout(seed, over) {
    const P = Object.assign({}, LP, over || {});
    const n = NODES.length, rnd = rng(seed), CUT2 = P.CUT * P.CUT;
    const X = new Float64Array(n), Y = new Float64Array(n), VX = new Float64Array(n), VY = new Float64Array(n), FX = new Float64Array(n), FY = new Float64Array(n);
    NODES.forEach((nd, i) => {
      const a = rnd() * 6.2832;
      if (nd.type === "paper") { X[i] = Math.cos(a) * P.RX; Y[i] = Math.sin(a) * P.RY; return; }
      const an = P.AN[nd.type] || [0, 0], sp = P.SPR[nd.type] || [150, 150], r = Math.sqrt(rnd());
      X[i] = an[0] + Math.cos(a) * sp[0] * r; Y[i] = an[1] + Math.sin(a) * sp[1] * r;
    });
    for (let it = 0; it < P.ITER; it++) {
      const al = 0.035 + 0.965 * Math.pow(1 - it / P.ITER, 1.6);
      FX.fill(0); FY.fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy;
          if (d2 > CUT2) continue;
          if (d2 < 4) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 4; }
          const f = P.REP / d2;
          FX[i] += dx * f; FY[i] += dy * f; FX[j] -= dx * f; FY[j] -= dy * f;
        }
      }
      for (let ei = 0; ei < E.length; ei++) {
        const e = E[ei], i = e.s, j = e.t, dx = X[j] - X[i], dy = Y[j] - Y[i], d = Math.sqrt(dx * dx + dy * dy) || 1;
        const exam = e.rel === "考";
        const rest = exam ? P.XREST : P.REST + P.HUB * (Math.sqrt(Math.max(DEG[i], DEG[j])) - 2), ks = exam ? P.XKS : P.KS;
        const f = ((d - rest) * ks) / d;
        FX[i] += dx * f; FY[i] += dy * f; FX[j] -= dx * f; FY[j] -= dy * f;
      }
      for (let i = 0; i < n; i++) {
        const nd = NODES[i];
        if (nd.type === "paper") {
          // 论文套题：沿着“它考的概念的重心”方向，贴到外圈椭圆上
          let cx = 0, cy = 0, c = 0;
          ADJ[i].forEach((a) => { cx += X[a.o]; cy += Y[a.o]; c++; });
          if (c) {
            const ux = cx / c / P.RX, uy = cy / c / P.RY, L = Math.sqrt(ux * ux + uy * uy) || 1;
            FX[i] += ((ux / L) * P.RX - X[i]) * 0.045; FY[i] += ((uy / L) * P.RY - Y[i]) * 0.045;
          }
        } else {
          const an = P.AN[nd.type] || [0, 0], kc = P.KC[nd.type] || 0.01;
          FX[i] += (an[0] - X[i]) * kc; FY[i] += (an[1] - Y[i]) * kc;
          FX[i] -= X[i] * P.GX; FY[i] -= Y[i] * P.GY;
        }
      }
      for (let i = 0; i < n; i++) {
        VX[i] = clamp((VX[i] + FX[i] * al) * 0.6, -36, 36); VY[i] = clamp((VY[i] + FY[i] * al) * 0.6, -36, 36);
        X[i] += VX[i]; Y[i] += VY[i];
      }
    }
    // 收尾：把靠得太近的节点推开，保证节点之间至少有 MIND 的间距
    const MIND = P.MIND;
    for (let pass = 0; pass < 80; pass++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = X[i] - X[j], dy = Y[i] - Y[j], d2 = dx * dx + dy * dy;
          if (d2 >= MIND * MIND) continue;
          const d = Math.sqrt(d2) || 0.01, push = (MIND - d) / 2 + 0.2;
          const ux = d < 0.02 ? 1 : dx / d, uy = d < 0.02 ? 0 : dy / d;
          X[i] += ux * push; Y[i] += uy * push; X[j] -= ux * push; Y[j] -= uy * push; moved = true;
        }
      }
      if (!moved) break;
    }
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (let i = 0; i < n; i++) { minx = Math.min(minx, X[i]); maxx = Math.max(maxx, X[i]); miny = Math.min(miny, Y[i]); maxy = Math.max(maxy, Y[i]); }
    const ox = (minx + maxx) / 2, oy = (miny + maxy) / 2;
    return NODES.map((_, i) => ({ x: X[i] - ox, y: Y[i] - oy }));
  }
  function ensureLayout() { if (!POS) POS = layout(20260 + relayoutN * 7919); }

  // ======================= HTML：工具条、画布骨架 =======================
  const MODES = [["type", "按类型"], ["module", "按模块"], ["mastery", "按掌握度"], ["project", "项目用到"]];
  function toolbarHtml() {
    const s = api.S;
    return `<div class="kg-bar">
      <div class="kg-row"><span class="kg-lab">配色</span>
        ${MODES.map(([v, n]) => `<button class="pill ${s.graphColor === v ? "on" : ""}" data-kg="color" data-v="${v}">${n}</button>`).join("")}
        <span class="kg-sp"></span>
        <button data-kg="quiz" class="${quizOn ? "primary" : ""}" title="随机抽一个概念，选出和它直接相关的概念">${quizOn ? "退出关联挑战" : "关联挑战"}</button>
        <button data-kg="relayout" title="换一个随机种子，重新计算力导向布局">重新布局</button>
      </div>
      <div class="kg-row"><span class="kg-lab">筛选</span>
        ${TYPE_KEYS.map((t) => `<label class="kg-tg" title="显示/隐藏：${esc(TYPES[t] || t)}"><input type="checkbox" data-kg="type" value="${t}" ${s.graphHide.includes(t) ? "" : "checked"}>${icon(t, "var(--muted)", 13)}${esc(TYPES[t] || t)}</label>`).join("")}
        <select data-kg="mod" title="只看某个模块的概念，其余淡出">
          <option value="all">全部模块</option>${MODLIST.map((m) => `<option value="${m.id}" ${s.graphMod === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}
        </select>
        <label class="kg-tg" title="论文套题到概念的连线较多，可以关掉"><input type="checkbox" data-kg="exam" ${s.graphExam ? "checked" : ""}>套题连线</label>
        <span class="kg-sp"></span>
        <input id="kgQ" class="kg-q" type="search" placeholder="搜索概念，回车跳到下一个" value="${esc(query)}" autocomplete="off">
        <span id="kgQc" class="faint"></span>
      </div>
      <div class="kg-sum" id="kgSum"></div>
    </div>`;
  }
  function svgInner() {
    const defs = MARKER_RELS.map((r) => `<marker id="kg-m-${r}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 Z" style="fill:${MARKER_COLOR[r]}"/></marker>`).join("");
    const edges = E.map((e, ei) => {
      const k = rk(e.rel), mk = NOARROW[k] ? "" : ` marker-end="url(#kg-m-${k})"` + (k === "trade" ? ` marker-start="url(#kg-m-${k})"` : "");
      return `<line class="kg-e r-${k}" data-e="${ei}"${mk}/>`;
    }).join("");
    const nodes = NODES.map((n, i) => `<g class="kg-n" data-i="${i}"><title>${esc(n.name)}（${esc(TYPES[n.type] || n.type)} · ${esc(modLabel(n.mod))}）${esc(n.desc)}</title><path class="kg-ring" d="${SHAPE[n.type] || SHAPE.qa}" transform="scale(1.42)"/><path class="kg-sh" d="${SHAPE[n.type] || SHAPE.qa}"/>${n.type === "paper" ? `<path class="kg-fold" d="${FOLD}"/>` : ""}<text class="kg-b" x="11" y="-10"></text></g>`).join("");
    // 标签单独放在节点层之上，保证不会被后画的节点图形盖住
    const lbls = NODES.map((n, i) => `<text class="kg-l" data-i="${i}">${esc(LABELS[i])}</text>`).join("");
    const elabels = E.map((e, ei) => `<text class="kg-el" data-e="${ei}" style="display:none">${esc(e.rel)}</text>`).join("");
    return `<defs>${defs}</defs><g class="kg-world"><g class="kg-edges">${edges}</g><g class="kg-nodes">${nodes}</g><g class="kg-lbls">${lbls}</g><g class="kg-elabels">${elabels}</g></g>`;
  }
  function render() {
    norm();
    if (!NODES.length) return `<div class="panel"><p>知识图谱的数据还没有装载（graph-data.js 为空）。</p></div>`;
    ensureLayout();
    if (api.S.graphMode === "quiz") { api.S.graphMode = ""; if (!quizOn) { resetFilters(); quizOn = true; quiz = newQuiz(null); } }
    return `<div class="kg-root" id="kgRoot">
      <p class="kg-intro"><b>怎么看这张图：</b>每个节点是一个概念，连线是它们的关系。<b>点节点</b>看解释、背卡和相关论文套题，再点“邻居”<b>顺藤摸瓜</b>；切到<b>“按掌握度”</b>配色，红、琥珀、灰色的地方就是还没连起来的知识；最后用<b>“关联挑战”</b>巩固：看到一个概念，能想到它和谁挂钩。滚轮缩放，拖动空白处平移，也可以拖动单个节点。</p>
      ${toolbarHtml()}
      <div class="kg-main">
        <div class="kg-stage ${api.S.graphTall ? "kg-tall" : ""}" id="kgStage">
          <svg class="kg-svg" id="kgSvg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="知识图谱">${svgInner()}</svg>
          <div class="kg-zoom"><button data-kg="zin" title="放大">+</button><button data-kg="zout" title="缩小">−</button><button data-kg="fit" title="适应窗口">⌂</button><button data-kg="tall" title="拉高/还原画布">⇕</button></div>
          <div class="kg-legend" id="kgLegend"></div>
        </div>
        <aside class="kg-side" id="kgSide"></aside>
      </div>
    </div>`;
  }

  // ======================= 几何与视图 =======================
  const nodeScale = () => clamp(Math.pow(view.k, -0.42), 0.6, 1.7);
  function setNodeTransform(i) {
    const p = POS[i];
    ctx.gN[i].setAttribute("transform", "translate(" + p.x.toFixed(1) + " " + p.y.toFixed(1) + ") scale(" + ctx.ns.toFixed(3) + ")");
  }
  function setEdge(ei) {
    const e = E[ei], a = POS[e.s], b = POS[e.t], el = ctx.gE[ei];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d, ns = ctx.ns;
    const ra = (HW[NODES[e.s].type] || 13) * ns + 1, rb = (HW[NODES[e.t].type] || 13) * ns + 1.5;
    // 椭圆/多边形近似：横向用半宽，纵向取半高与半宽的折中，避免竖向连线埋进节点
    const ka = Math.abs(ux) * ra + Math.abs(uy) * Math.max(ra * 0.82, (HH[NODES[e.s].type] || 12) * ns + 1);
    const kb = Math.abs(ux) * rb + Math.abs(uy) * Math.max(rb * 0.82, (HH[NODES[e.t].type] || 12) * ns + 1.5);
    const ra2 = Math.min(ka, d * 0.45), rb2 = Math.min(kb, d * 0.45);
    el.setAttribute("x1", (a.x + ux * ra2).toFixed(1)); el.setAttribute("y1", (a.y + uy * ra2).toFixed(1));
    el.setAttribute("x2", (b.x - ux * rb2).toFixed(1)); el.setAttribute("y2", (b.y - uy * rb2).toFixed(1));
  }
  function setEdgeLabel(ei) {
    const t = ctx.gT[ei];
    if (!t || t.style.display === "none") return;
    const a = POS[E[ei].s], b = POS[E[ei].t];
    t.setAttribute("x", ((a.x + b.x) / 2).toFixed(1)); t.setAttribute("y", ((a.y + b.y) / 2).toFixed(1));
    t.style.fontSize = (10.5 / view.k).toFixed(2) + "px"; t.style.strokeWidth = (3 / view.k).toFixed(2) + "px";
  }
  function applyView(full) {
    if (!ctx) return;
    ctx.world.setAttribute("transform", "translate(" + view.x.toFixed(2) + " " + view.y.toFixed(2) + ") scale(" + view.k.toFixed(4) + ")");
    if (!full) return;
    ctx.ns = nodeScale();
    const ms = (11 / view.k).toFixed(2);
    ctx.markers.forEach((m) => { m.setAttribute("markerWidth", ms); m.setAttribute("markerHeight", ms); });
    for (let i = 0; i < NODES.length; i++) setNodeTransform(i);
    for (let ei = 0; ei < E.length; ei++) { setEdge(ei); setEdgeLabel(ei); }
    updateLabels();
  }
  function scheduleView() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; applyView(true); }); }
  function zoomAt(cx, cy, nk) {
    nk = clamp(nk, KMIN, KMAX);
    view.x = cx - (cx - view.x) * (nk / view.k); view.y = cy - (cy - view.y) * (nk / view.k); view.k = nk;
    scheduleView();
  }
  const visibleIdx = () => { const out = []; for (let i = 0; i < NODES.length; i++) if (ctx && ctx.vis[i]) out.push(i); return out; };
  function boxView(ids, minK, maxK, pad, bot) {
    if (!ids.length) return null;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    ids.forEach((i) => { x0 = Math.min(x0, POS[i].x); x1 = Math.max(x1, POS[i].x); y0 = Math.min(y0, POS[i].y); y1 = Math.max(y1, POS[i].y); });
    const bw = Math.max(x1 - x0, 80), bh = Math.max(y1 - y0, 80), He = H - (bot || 0);   // bot：给底部图例让出的高度
    const k = clamp(Math.min((W - pad * 2) / bw, (He - pad * 2) / bh), minK, maxK);
    return { k, x: W / 2 - ((x0 + x1) / 2) * k, y: He / 2 - ((y0 + y1) / 2) * k };
  }
  function goView(t, animate) {
    if (!t) return;
    cancelAnimationFrame(anim);
    if (!animate) { view.x = t.x; view.y = t.y; view.k = t.k; applyView(true); return; }
    const f = { x: view.x, y: view.y, k: view.k }, t0 = performance.now(), dur = 360;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      view.x = f.x + (t.x - f.x) * e; view.y = f.y + (t.y - f.y) * e; view.k = f.k + (t.k - f.k) * e;
      applyView(true);
      if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  const fitView = (animate) => goView(boxView(visibleIdx().length ? visibleIdx() : NODES.map((_, i) => i), KMIN, 1.25, 40, ctx && ctx.legend ? Math.min(ctx.legend.offsetHeight + 8, H * 0.3) : 0), animate);
  function focusView(i, animate) {
    const ids = [i].concat(ADJ[i].map((a) => a.o)).filter((j) => ctx.vis[j]);
    const t = boxView(ids, 0.8, 1.6, 70);
    goView(t, animate);
  }
  function centerOn(i) {
    const k = Math.max(view.k, 0.95);
    goView({ k, x: W / 2 - POS[i].x * k, y: H / 2 - POS[i].y * k }, true);
  }

  // ======================= 样式刷新（颜色/聚焦/筛选） =======================
  function focusIdx() {
    if (quizOn && quiz) return quiz.done ? quiz.c : -1;
    return selIdx();
  }
  function nearSet(fi) { const s = new Set([fi]); ADJ[fi].forEach((a) => s.add(a.o)); return s; }
  function nodeColor(i, mode, lv) {
    const n = NODES[i];
    if (mode === "module") return MCOLOR[n.mod] || "var(--faint)";
    if (mode === "mastery") return LCOLOR[lv[i]];
    if (mode === "project") return n.proj ? "var(--accent)" : "var(--faint)";
    return TCOLOR[n.type] || "var(--faint)";
  }
  function applyStyles() {
    if (!ctx) return;
    const s = api.S, mode = s.graphColor, hide = new Set(s.graphHide), fi = focusIdx(), near = fi >= 0 ? nearSet(fi) : null;
    const lv = mode === "mastery" ? NODES.map(masteryLevel) : null;
    const blind = quizOn && quiz && !quiz.done;
    const hitSet = new Set(hits), cur = hits.length ? hits[hitI % hits.length] : -1;
    ctx.svg.classList.toggle("kg-blind", !!blind);
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i], g = ctx.gN[i];
      const hidden = hide.has(n.type), off = !hidden && s.graphMod !== "all" && n.mod !== s.graphMod;
      ctx.vis[i] = !hidden && !off;
      g.style.display = hidden ? "none" : "";
      g.classList.toggle("kg-off", off);
      g.classList.toggle("kg-dim", !!near && !near.has(i) && !hitSet.has(i));   // 搜索命中的节点不淡出
      g.classList.toggle("kg-sel", i === fi);
      g.classList.toggle("kg-hit", hitSet.has(i));
      g.classList.toggle("kg-cur", i === cur);
      g.classList.toggle("kg-qc", !!(quizOn && quiz && quiz.c === i));
      g.classList.toggle("kg-fade", mode === "project" && !n.proj && !(near && near.has(i)));
      g.classList.toggle("kg-lv-none", mode === "mastery" && lv[i] === "none");
      const lb = ctx.gL[i];
      lb.classList.toggle("kg-off", off);
      lb.classList.toggle("kg-fade", mode === "project" && !n.proj && !(near && near.has(i)));
      ctx.gS[i].style.fill = nodeColor(i, mode, lv);
      const b = ctx.gB[i];
      if (mode === "mastery") { b.textContent = LGLYPH[lv[i]]; b.style.display = LGLYPH[lv[i]] ? "block" : "none"; b.classList.remove("kg-star"); }
      else if (mode === "project" && n.proj) { b.textContent = "★"; b.style.display = "block"; b.classList.add("kg-star"); }
      else { b.textContent = ""; b.style.display = "none"; b.classList.remove("kg-star"); }
    }
    for (let ei = 0; ei < E.length; ei++) {
      const e = E[ei], el = ctx.gE[ei], hot = fi >= 0 && (e.s === fi || e.t === fi);
      const hid = hide.has(NODES[e.s].type) || hide.has(NODES[e.t].type) || (e.rel === "考" && !s.graphExam);
      el.style.display = hid ? "none" : "";
      el.classList.toggle("kg-hot", hot && !hid);
      el.classList.toggle("kg-dim", fi >= 0 && !hot);
      el.classList.toggle("kg-off", !ctx.vis[e.s] || !ctx.vis[e.t]);
      el.classList.toggle("kg-fade", mode === "project" && !(NODES[e.s].proj && NODES[e.t].proj) && !hot);
      const t = ctx.gT[ei];
      t.style.display = hot && !hid && !blind ? "" : "none";
      if (hot && !hid) setEdgeLabel(ei);
    }
    updateLabels();
  }

  // 标签：按屏幕空间做避让，高优先级先放，放不下的隐藏；选中节点及其邻居、搜索命中强制显示
  function updateLabels() {
    if (!ctx || !POS) return;
    const k = view.k, ns = ctx.ns || nodeScale(), unit = ns * k, F = LBL, fl = F / unit;
    const fi = focusIdx(), blind = quizOn && quiz && !quiz.done;
    const near = fi >= 0 ? nearSet(fi) : null;
    const forced = new Set();
    if (blind) forced.add(quiz.c);
    else {
      if (near) near.forEach((i) => forced.add(i));
      hits.slice(0, 12).forEach((i) => forced.add(i));
    }
    const only = blind || !!near; // 聚焦时只给聚焦集合写标签
    const cand = [], rects = [];
    for (let i = 0; i < NODES.length; i++) {
      const g = ctx.gN[i];
      if (!ctx.vis[i] || (only && !forced.has(i))) { ctx.gL[i].style.display = "none"; continue; }
      const sx = POS[i].x * k + view.x, sy = POS[i].y * k + view.y;
      if (sx < -60 || sx > W + 60 || sy < -30 || sy > H + 40) { ctx.gL[i].style.display = "none"; continue; }
      const hw = (HW[NODES[i].type] || 13) * unit, hh = (HH[NODES[i].type] || 12) * unit;
      cand.push({ i, sx, sy, hw, hh });
      rects.push([sx - hw, sy - hh, sx + hw, sy + hh, i]);
    }
    cand.sort((a, b) => (forced.has(b.i) ? 1e6 : 0) + prio(b.i) - ((forced.has(a.i) ? 1e6 : 0) + prio(a.i)));
    const placed = [];
    const ov = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    // 普通概念的标签不能压到别的节点上；核心概念（质量属性、套题、枢纽）允许压到节点，只要不压别的标签
    const blocked = (r, own, strict) => {
      for (let p = 0; p < placed.length; p++) if (ov(r, placed[p])) return true;
      if (strict) for (let p = 0; p < rects.length; p++) if (rects[p][4] !== own && ov(r, rects[p])) return true;
      return false;
    };
    cand.forEach((c) => {
      const lb = ctx.gL[c.i], w = LW[c.i] * F + 6, h = F + 3, strict = !(forced.has(c.i) || NODES[c.i].type === "qa" || DEG[c.i] >= 9);
      const below = [c.sx - w / 2, c.sy + c.hh + 1, c.sx + w / 2, c.sy + c.hh + 1 + h];
      const above = [c.sx - w / 2, c.sy - c.hh - 1 - h, c.sx + w / 2, c.sy - c.hh - 1];
      let r = null, pos = "b";
      if (!blocked(below, c.i, strict)) r = below;
      else if (!blocked(above, c.i, strict)) { r = above; pos = "a"; }
      else if (forced.has(c.i)) r = below;
      if (!r) { lb.style.display = "none"; return; }
      placed.push(r);
      lb.style.display = "block";
      lb.style.fontSize = (F / k).toFixed(2) + "px";
      lb.style.strokeWidth = (3.2 / k).toFixed(2) + "px";
      ctx.lpos[c.i] = pos;
      placeLabel(c.i);
    });
  }
  // 标签在世界坐标里的位置：屏幕上离节点边缘 1px，字号恒为 LBL 像素
  function placeLabel(i) {
    const pos = ctx.lpos[i], lb = ctx.gL[i];
    if (!pos || !lb) return;
    const k = view.k, hhp = (HH[NODES[i].type] || 12) * (ctx.ns || 1) * k;
    lb.setAttribute("x", POS[i].x.toFixed(1));
    lb.setAttribute("y", (POS[i].y + (pos === "b" ? hhp + 1 + LBL * 0.85 : -(hhp + 1 + LBL * 0.2)) / k).toFixed(1));
  }
  const prio = (i) => DEG[i] + (NODES[i].type === "paper" ? 8 : NODES[i].type === "qa" ? 5 : 0) + (NODES[i].proj ? 1 : 0);

  // ======================= 选中、搜索、筛选 =======================
  function selectNode(i, focus, fromCanvas) {
    const s = api.S;
    s.graphSel = i >= 0 ? NODES[i].id : "";
    viewSel = s.graphSel;
    api.save();
    applyStyles();
    renderSide();
    if (i >= 0 && focus) focusView(i, true);
    if (i >= 0 && fromCanvas && window.matchMedia && window.matchMedia("(max-width: 1000px)").matches && ctx.side.scrollIntoView) ctx.side.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function ensureVisible(i) {
    const s = api.S, n = NODES[i];
    let changed = false;
    if (s.graphHide.includes(n.type)) { s.graphHide = s.graphHide.filter((t) => t !== n.type); changed = true; }
    if (s.graphMod !== "all" && n.mod !== s.graphMod) { s.graphMod = "all"; changed = true; }
    if (changed) { api.save(); syncToolbar(); }
  }
  function resetFilters() { api.S.graphHide = []; api.S.graphMod = "all"; }
  function runSearch(q) {
    query = q.trim().toLowerCase();
    hits = []; hitI = 0;
    if (query) NODES.forEach((n, i) => { if (!api.S.graphHide.includes(n.type) && (n.name.toLowerCase().includes(query) || n.id.toLowerCase() === query)) hits.push(i); });
    applyStyles();
    syncSearchInfo();
    if (hits.length) centerOn(hits[0]);
  }
  function nextHit() {
    if (!hits.length) return;
    hitI = (hitI + 1) % hits.length;
    applyStyles(); syncSearchInfo(); centerOn(hits[hitI]);
  }
  function syncSearchInfo() {
    const el = $("kgQc");
    if (el) el.textContent = hits.length ? (hitI % hits.length) + 1 + " / " + hits.length : (query ? "无匹配" : "");
  }
  function syncToolbar() {
    if (!ctx) return;
    const s = api.S, r = ctx.root;
    r.querySelectorAll('[data-kg="color"]').forEach((b) => b.classList.toggle("on", b.dataset.v === s.graphColor));
    const q = r.querySelector('[data-kg="quiz"]');
    if (q) { q.textContent = quizOn ? "退出关联挑战" : "关联挑战"; q.classList.toggle("primary", quizOn); }
    r.querySelectorAll('input[data-kg="type"]').forEach((c) => { c.checked = !s.graphHide.includes(c.value); });
    const m = r.querySelector('select[data-kg="mod"]'); if (m) m.value = s.graphMod;
    const x = r.querySelector('input[data-kg="exam"]'); if (x) x.checked = s.graphExam;
    ctx.stage.classList.toggle("kg-tall", s.graphTall);
  }

  // ======================= 摘要与图例 =======================
  function renderSummary() {
    if (!ctx) return;
    const s = api.S, el = $("kgSum");
    if (!el) return;
    if (s.graphColor === "mastery") {
      const r = masteryReport(), pct = (x) => (r.total ? (x / r.total) * 100 : 0).toFixed(1) + "%";
      const weak = r.studied ? r.weak.map((w) => `${esc(modLabel(w.m))} ${w.ok}/${w.n}`).join("、") : "";
      el.innerHTML = `<b>已掌握 ${r.cnt.ok} / 共 ${r.total} 个概念</b><span class="faint">（有背卡的概念；另有 ${r.cnt.none} 个暂无背卡）</span>
        <div class="bar"><span style="width:${pct(r.cnt.ok)};background:var(--ok)"></span><span style="width:${pct(r.cnt.mid)};background:var(--mid)"></span><span style="width:${pct(r.cnt.bad)};background:var(--bad)"></span></div>
        ${r.studied ? `最薄弱的 3 个模块：<b>${weak}</b> <span class="faint">（已掌握数 / 概念数）</span>` : `<span class="muted">还没有学习记录：去“口诀背卡”标记卡片，掌握度会实时染到图上。红色先补，灰色是没学的，琥珀色要巩固。</span>`}`;
    } else if (s.graphColor === "project") {
      const n = NODES.filter((x) => x.proj).length;
      el.innerHTML = `<b>★ 项目里实际用到 ${n} 个概念</b>，其余变淡。点开带星的节点，可以看到“在我的项目里怎么用”，直接拿去写论文的实践段。`;
    } else if (s.graphColor === "module") {
      el.innerHTML = `按所属模块（背卡来源）着色，形状仍表示节点类型。同色成片说明这块知识在同一模块里，跨色的连线就是模块之间的“桥”。`;
    } else {
      el.innerHTML = `共 ${NODES.length} 个节点、${E.length} 条关系。形状 + 颜色表示类型；点节点后，它的邻居会被保留，其余淡出，邻边上显示关系名。`;
    }
  }
  function ruleSample(k, txt) {
    const dash = k === "cmp" ? ' stroke-dasharray="6 4"' : k === "dep" ? ' stroke-dasharray="2 3"' : "";
    const col = { ensure: "var(--ok)", solve: "var(--accent)", trade: "var(--bad)", cmp: "var(--mid)", has: "var(--muted)", dep: "var(--muted)", exam: "var(--faint)" }[k];
    return `<span class="kg-li"><svg class="kg-ls" width="30" height="10"><line x1="1" y1="5" x2="29" y2="5" stroke="${col}" stroke-width="${k === "trade" ? 2.4 : 1.6}"${dash}/></svg>${txt}</span>`;
  }
  function renderLegend() {
    if (!ctx) return;
    const s = api.S, mode = s.graphColor;
    const shapes = `<div>${TYPE_KEYS.map((t) => `<span class="kg-li">${icon(t, mode === "type" ? TCOLOR[t] : "var(--muted)", 14)}${esc(TYPES[t] || t)}</span>`).join("")}</div>`;
    let extra = "";
    if (mode === "module") {
      const used = {}; NODES.forEach((n) => { used[n.mod] = 1; });
      extra = `<div>${MODLIST.concat([{ id: "paper", name: "论文套题" }]).filter((m) => used[m.id]).map((m) => `<span class="kg-li"><i class="kg-sw" style="background:${MCOLOR[m.id] || "var(--faint)"}"></i>${esc(m.name)}</span>`).join("")}</div>`;
    } else if (mode === "mastery") {
      const r = masteryReport();
      extra = `<div>${["ok", "mid", "bad", "new", "none"].map((l) => `<span class="kg-li"><i class="kg-sw" style="background:${LCOLOR[l]};${l === "none" ? "border:1px dashed var(--faint);" : ""}"></i>${LGLYPH[l] ? LGLYPH[l] + " " : ""}${LNAME[l]} ${r.cnt[l]}</span>`).join("")}</div>`;
    } else if (mode === "project") {
      extra = `<div><span class="kg-li"><span style="color:var(--mid);font-size:15px">★</span>项目用到</span><span class="kg-li"><i class="kg-sw" style="background:var(--faint);opacity:.5"></i>其余（淡出）</span></div>`;
    }
    const rels = Object.keys(RELS).length ? Object.keys(RELS) : Object.keys(RELKEY);
    ctx.legend.innerHTML = `${mode === "type" ? shapes : extra + shapes}
      <details class="kg-ld"><summary>线型说明</summary>${rels.map((r) => ruleSample(rk(r), `${esc(RELDIR[r] || r)} <span class="faint">${esc(RELS[r] || "")}</span>`)).join("<br>")}</details>`;
  }

  // ======================= 详情面板 =======================
  function relatedKits(i) {
    const n = NODES[i], set = new Set(n.kit || []);
    if (n.type === "paper") set.add(n.id);
    ADJ[i].forEach((a) => { if (NODES[a.o].type === "paper") set.add(NODES[a.o].id); });
    return [...set].sort();
  }
  function nbGroups(i) {
    const groups = {}, order = [];
    ADJ[i].forEach((a) => {
      const rel = E[a.e].rel, key = a.dir + "|" + rel;
      if (!groups[key]) { groups[key] = { dir: a.dir, rel, list: [] }; order.push(key); }
      groups[key].list.push(a.o);
    });
    const rels = Object.keys(RELS), rank = (g) => ({ out: 0, sym: 1, in: 2 }[g.dir] * 100 + (rels.indexOf(g.rel) + 1));
    return order.map((k) => groups[k]).sort((a, b) => rank(a) - rank(b));
  }
  function groupLabel(g) {
    if (g.dir === "out") return (OUTTXT[g.rel] || "它 " + g.rel) + " →";
    if (g.dir === "in") return "← " + (INTXT[g.rel] || g.rel + " 它的");
    return "↔ " + (SYMTXT[g.rel] || g.rel);
  }
  function chip(o) {
    const n = NODES[o], lv = masteryLevel(n);
    return `<button class="kg-chip" data-kg="focus" data-id="${esc(n.id)}" title="${esc(n.desc)}">${icon(n.type, TCOLOR[n.type], 13)}<span>${esc(n.name)}</span><i class="kg-m m-${lv}" title="${LNAME[lv]}"></i></button>`;
  }
  function cardHtml(c) {
    const st = api.S.status[c.id];
    return `<details class="kg-card" data-cid="${esc(c.id)}">
      <summary><span class="dot ${st != null ? "s" + st : ""}"></span>${esc(c.q)} <span class="faint">· ${esc(api.modName(c.m))}</span></summary>
      <div class="kg-ans">${api.cardBody(c)}</div>
      <div class="row kg-mk"><span class="faint">标记：</span>${[["0", "不会"], ["1", "模糊"], ["2", "会了"]].map(([lv, t]) => `<button class="${st === +lv ? "on" : ""}" data-kg="mark" data-id="${esc(c.id)}" data-lv="${lv}">${t}</button>`).join("")}</div>
    </details>`;
  }
  function detailHtml(i) {
    const n = NODES[i], cards = (n.cards || []).map(getCard).filter(Boolean), kits = relatedKits(i), groups = nbGroups(i), lv = masteryLevel(n);
    return `<div class="kg-dh">${icon(n.type, TCOLOR[n.type], 28)}<h3>${esc(n.name)}</h3></div>
      <div class="kg-tags"><span class="tag">${esc(TYPES[n.type] || n.type)}</span><span class="tag">${esc(modLabel(n.mod))}</span>${n.type !== "paper" ? `<span class="tag"><i class="kg-m m-${lv}"></i> ${LNAME[lv]}</span>` : ""}</div>
      <p class="kg-desc">${esc(n.desc)}</p>
      ${n.proj ? `<div class="kg-proj"><span class="kg-star">★</span><div><b>在我的项目里</b><p>${esc(n.proj)}</p></div></div>` : ""}
      <h4>关联背卡${cards.length ? "（" + cards.length + "）" : ""}</h4>
      ${cards.length ? cards.map(cardHtml).join("") : `<p class="faint">${n.type === "paper" ? "套题没有背卡，点下面的按钮去论文工坊；也可以从它的邻居顺藤摸瓜，复习相关概念。" : "这个概念暂时没有对应背卡，先靠上面的说明理解，再看它的邻居。"}</p>`}
      ${kits.length ? `<h4>相关论文套题</h4><div class="row">${kits.map((k) => `<button data-act="go" data-v="essay:recall:kitId=${esc(k)}" title="去论文工坊复述这套题">${esc(k)} ${esc(KITN[k] || "")}</button>`).join("")}</div>` : ""}
      <h4>邻居（${ADJ[i].length}）：点一个继续顺藤摸瓜</h4>
      ${groups.length ? groups.map((g) => `<div class="kg-grp"><div class="kg-gl" title="${esc(RELS[g.rel] || "")}">${esc(groupLabel(g))}</div>${g.list.map(chip).join("")}</div>`).join("") : `<p class="faint">没有连线。</p>`}`;
  }
  function placeholderHtml() {
    const hubs = NODES.map((n, i) => i).filter((i) => NODES[i].type !== "paper").sort((a, b) => DEG[b] - DEG[a]).slice(0, 10);
    const proj = NODES.filter((n) => n.proj).length;
    return `<h3>点一个节点开始</h3>
      <p class="muted" style="margin-top:6px">点画布里的任意节点，这里会显示它的解释、背卡、相关论文套题，以及按关系分组的邻居。点空白处取消选中。</p>
      <h4>从这些枢纽概念开始</h4><div class="kg-hubs">${hubs.map(chip).join("")}</div>
      <h4>小提示</h4>
      <ul style="margin:0;padding-left:18px" class="muted"><li>“按掌握度”配色：红 / 琥珀 / 灰就是知识缺口。</li><li>“项目用到”配色会点亮 ${proj} 个带 ★ 的概念。</li><li>在搜索框输入名称，回车依次跳到匹配的节点。</li></ul>`;
  }
  function renderSide() {
    if (!ctx) return;
    if (quizOn && quiz) { ctx.side.innerHTML = quizHtml(); return; }
    const i = selIdx();
    ctx.side.innerHTML = i >= 0 ? detailHtml(i) : placeholderHtml();
  }
  function markCard(id, lv, btn) {
    api.markCard(id, lv); api.save();
    const det = btn.closest(".kg-card");
    if (det) {
      const dot = det.querySelector(".dot"); if (dot) dot.className = "dot s" + lv;
      det.querySelectorAll(".kg-mk button").forEach((b) => b.classList.toggle("on", +b.dataset.lv === lv));
    }
    applyStyles(); renderSummary(); renderLegend();
    ctx.side.querySelectorAll(".kg-chip[data-id]").forEach((c) => { const m = c.querySelector(".kg-m"); if (m) { const lvl = masteryLevel(NODES[NIDX[c.dataset.id]]); m.className = "kg-m m-" + lvl; m.title = LNAME[lvl]; } });
    const tag = ctx.side.querySelector(".kg-tags .kg-m");
    if (tag && selIdx() >= 0) { const lvl = masteryLevel(NODES[selIdx()]); tag.className = "kg-m m-" + lvl; if (tag.parentNode) tag.parentNode.lastChild.textContent = " " + LNAME[lvl]; }
  }

  // ======================= 关联挑战 =======================
  const realNb = (i) => [...new Set(ADJ[i].map((a) => a.o))].filter((o) => NODES[o].type !== "paper");
  function newQuiz(prev) {
    const cands = [];
    NODES.forEach((n, i) => { if (n.type !== "paper" && realNb(i).length >= 3) cands.push(i); });
    let c = cands[Math.floor(Math.random() * cands.length)];
    for (let t = 0; t < 8 && prev && c === prev.c && cands.length > 1; t++) c = cands[Math.floor(Math.random() * cands.length)];
    const nb = realNb(c);
    const k = Math.min(nb.length, nb.length >= 4 && Math.random() < 0.55 ? 4 : 3);
    const truth = shuffle(nb.slice()).slice(0, k);
    const adjAll = new Set(ADJ[c].map((a) => a.o)); adjAll.add(c);
    const wantT = new Set(truth.map((i) => NODES[i].type));
    const d2 = new Set(); nb.forEach((o) => ADJ[o].forEach((a) => { if (!adjAll.has(a.o)) d2.add(a.o); }));
    // 干扰项：同类型（和真邻居同类，看不出类型线索）且不相邻；优先“邻居的邻居”，更容易混
    const pool = NODES.map((_, i) => i).filter((i) => NODES[i].type !== "paper" && !adjAll.has(i))
      .map((i) => ({ i, sc: (wantT.has(NODES[i].type) ? 2 : 0) + (d2.has(i) ? 1.2 : 0) + (NODES[i].mod === NODES[c].mod ? 0.4 : 0) + Math.random() }))
      .sort((a, b) => b.sc - a.sc).slice(0, 8 - truth.length).map((x) => x.i);
    return { c, truth: new Set(truth), opts: shuffle(truth.concat(pool)), pick: new Set(), done: false, perfect: false };
  }
  function relText(a, b) {
    const hit = ADJ[a].find((x) => x.o === b);
    if (!hit) return "";
    const rel = E[hit.e].rel;
    if (hit.dir === "sym") return NODES[a].name + " ↔ " + NODES[b].name + "（" + rel + "）";
    return hit.dir === "out" ? NODES[a].name + " —" + rel + "→ " + NODES[b].name : NODES[b].name + " —" + rel + "→ " + NODES[a].name;
  }
  function quizHtml() {
    const q = quiz, st = api.S.graphStat, c = NODES[q.c], acc = st.n ? Math.round((st.r / st.n) * 100) : 0;
    const opts = q.opts.map((i) => {
      const n = NODES[i], on = q.pick.has(i), isT = q.truth.has(i);
      let cls = "kg-opt" + (on ? " on" : ""), note = "";
      if (q.done) {
        if (isT && on) { cls = "kg-opt ok"; note = "✓ " + relText(q.c, i); }
        else if (isT) { cls = "kg-opt miss"; note = "漏选 · " + relText(q.c, i); }
        else if (on) { cls = "kg-opt bad"; note = "✗ 图里与它没有直接连线"; }
      }
      return `<button class="${cls}" data-kg="qpick" data-id="${esc(n.id)}" ${q.done ? "disabled" : ""}>${icon(n.type, TCOLOR[n.type], 15)}<span>${esc(n.name)}</span>${note ? `<small>${esc(note)}</small>` : ""}</button>`;
    }).join("");
    let res = "";
    if (q.done) {
      const all = ADJ[q.c].map((a) => a.o).filter((o, idx, arr) => arr.indexOf(o) === idx);
      res = `<div class="kg-res"><b class="${q.perfect ? "ok" : "bad"}">${q.perfect ? "全对！" : "有出入，对照下面看一遍。"}</b>
        <div class="faint" style="margin-top:2px">${esc(c.name)} 的全部直接邻居（${all.length} 个${all.some((o) => NODES[o].type === "paper") ? "，含考到它的论文套题" : ""}），画布上已为你点亮：</div>
        <ul>${all.map((o) => `<li>${esc(relText(q.c, o))}</li>`).join("")}</ul></div>`;
    }
    return `<div class="kg-qhead"><h3>关联挑战</h3><span class="faint">累计 ${st.n} 题 · 全对 ${st.r} 题${st.n ? " · " + acc + "%" : ""}</span></div>
      <p class="kg-qq">哪些概念与 <span class="kg-qname">${esc(c.name)}</span> <span class="tag">${esc(TYPES[c.type] || c.type)}</span> <b>直接相关</b>（图上有直接连线）？<br><span class="faint">多选，下面 8 个里正确的共 ${q.truth.size} 个；干扰项是同类型但不相邻的概念。</span></p>
      <details class="kg-hint"><summary>看提示（概念说明）</summary><p>${esc(c.desc)}</p></details>
      <div class="kg-opts">${opts}</div>
      ${res}
      <div class="row" style="margin-top:10px">
        ${q.done ? `<button class="primary" data-kg="qnext">下一题</button>` : `<button class="primary" data-kg="qsubmit" ${q.pick.size ? "" : "disabled"}>提交</button><button data-kg="qnext" title="不计成绩，换一题">换一题</button>`}
        <button class="ghost" data-kg="quiz">退出挑战</button>
      </div>`;
  }
  function enterQuiz() {
    resetFilters(); quizOn = true; quiz = newQuiz(null);
    api.save(); syncToolbar(); applyStyles(); renderSide(); focusView(quiz.c, true);
  }
  function exitQuiz() {
    quizOn = false; quiz = null;
    syncToolbar(); applyStyles(); renderSide();
    if (selIdx() >= 0) focusView(selIdx(), true); else fitView(true);
  }
  function quizSubmit() {
    const q = quiz; if (!q || q.done || !q.pick.size) return;
    q.done = true;
    q.perfect = q.pick.size === q.truth.size && [...q.pick].every((i) => q.truth.has(i));
    const st = api.S.graphStat; st.n++; if (q.perfect) st.r++;
    api.S.graphSel = NODES[q.c].id; viewSel = api.S.graphSel;
    api.save(); applyStyles(); renderSide(); focusView(q.c, true);
  }
  function quizNext() { quiz = newQuiz(quiz); applyStyles(); renderSide(); focusView(quiz.c, true); }

  // ======================= 重新布局 =======================
  function relayout() {
    relayoutN++;
    POS = layout(20260 + relayoutN * 7919);
    applyView(true); fitView(false);
  }

  // ======================= after：绑定交互 =======================
  function after() {
    if (cleanup) { cleanup(); cleanup = null; }
    const root = $("kgRoot");
    if (!root) { ctx = null; return; }
    const svg = root.querySelector("#kgSvg");
    ctx = {
      root, svg, stage: root.querySelector("#kgStage"), side: root.querySelector("#kgSide"), legend: root.querySelector("#kgLegend"),
      world: svg.querySelector(".kg-world"), ns: 1, vis: NODES.map(() => true),
      gN: [...svg.querySelectorAll(".kg-n")], gE: [...svg.querySelectorAll(".kg-e")], gT: [...svg.querySelectorAll(".kg-el")],
      markers: [...svg.querySelectorAll("marker")]
    };
    ctx.gS = ctx.gN.map((g) => g.querySelector(".kg-sh"));
    ctx.gL = [...svg.querySelectorAll(".kg-l")];
    ctx.lpos = NODES.map(() => "");                  // 每个标签当前放在节点下方(b)还是上方(a)
    ctx.gB = ctx.gN.map((g) => g.querySelector(".kg-b"));
    W = svg.clientWidth || 780; H = svg.clientHeight || 560;
    ctx.ns = nodeScale();
    const s = api.S;
    // 首次或 #graph:graphSel=xx 直达时，把视图调到合适的位置（不做动画，方便截图）
    ctx.vis = NODES.map((n) => !s.graphHide.includes(n.type) && (s.graphMod === "all" || n.mod === s.graphMod));
    renderLegend();                                  // 先画图例，适应窗口时才能给它让出底部空间
    if (!view.init) {
      view.init = true;
      const si = selIdx();
      if (quizOn && quiz) focusView(quiz.c, false);
      else if (si >= 0) { viewSel = s.graphSel; focusView(si, false); }
      else fitView(false);
    } else if (s.graphSel && s.graphSel !== viewSel && selIdx() >= 0) { viewSel = s.graphSel; focusView(selIdx(), false); }
    applyView(true);
    applyStyles();
    renderSide(); renderSummary(); syncToolbar(); syncSearchInfo();

    // ---- 画布：平移、拖动节点、滚轮缩放 ----
    let drag = null;
    const pt = (e) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    svg.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const g = e.target.closest ? e.target.closest(".kg-n") : null, i = g ? +g.dataset.i : -1;
      drag = { i, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, ox: i >= 0 ? POS[i].x : 0, oy: i >= 0 ? POS[i].y : 0, moved: false };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) { drag.moved = true; if (drag.i < 0) svg.classList.add("kg-panning"); cancelAnimationFrame(anim); }
      if (drag.i >= 0) {
        POS[drag.i].x = drag.ox + dx / view.k; POS[drag.i].y = drag.oy + dy / view.k;
        setNodeTransform(drag.i); placeLabel(drag.i);
        ADJ[drag.i].forEach((a) => { setEdge(a.e); setEdgeLabel(a.e); });
      } else { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(false); }
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      svg.classList.remove("kg-panning");
      try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      if (!d.moved) {
        if (quizOn && quiz) return;                     // 挑战期间不让点节点，避免偷看邻居
        selectNode(d.i, false, true);
      } else updateLabels();
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = pt(e);
      zoomAt(p.x, p.y, view.k * Math.exp(-clamp(e.deltaY, -240, 240) * 0.0016));
    }, { passive: false });

    // ---- 工具条与侧栏：事件委托 ----
    root.addEventListener("click", (e) => {
      const el = e.target.closest("[data-kg]");
      if (!el || !root.contains(el)) return;
      const a = el.dataset.kg, id = el.dataset.id;
      switch (a) {
        case "color": api.S.graphColor = el.dataset.v; api.save(); syncToolbar(); applyStyles(); renderSummary(); renderLegend(); break;
        case "quiz": if (quizOn) exitQuiz(); else enterQuiz(); break;
        case "relayout": relayout(); break;
        case "zin": zoomAt(W / 2, H / 2, view.k * 1.3); break;
        case "zout": zoomAt(W / 2, H / 2, view.k / 1.3); break;
        case "fit": fitView(true); break;
        case "tall": api.S.graphTall = !api.S.graphTall; api.save(); ctx.stage.classList.toggle("kg-tall", api.S.graphTall); W = svg.clientWidth || W; H = svg.clientHeight || H; fitView(false); break;
        case "focus": { const i = NIDX[id]; if (i != null) { ensureVisible(i); selectNode(i, true, false); } break; }
        case "mark": markCard(id, +el.dataset.lv, el); break;
        case "qpick": {
          const i = NIDX[id]; if (!quiz || quiz.done || i == null) break;
          if (quiz.pick.has(i)) quiz.pick.delete(i); else quiz.pick.add(i);
          el.classList.toggle("on", quiz.pick.has(i));
          const sub = ctx.side.querySelector('[data-kg="qsubmit"]'); if (sub) sub.disabled = !quiz.pick.size;
          break;
        }
        case "qsubmit": quizSubmit(); break;
        case "qnext": quizNext(); break;
        default: break;
      }
    });
    root.addEventListener("change", (e) => {
      const el = e.target, a = el.dataset && el.dataset.kg, st = api.S;
      if (a === "type") {
        const set = new Set(st.graphHide);
        if (el.checked) set.delete(el.value); else set.add(el.value);
        st.graphHide = [...set]; api.save(); applyStyles();
        if (query) runSearch(query);
      } else if (a === "mod") { st.graphMod = el.value; api.save(); applyStyles(); }
      else if (a === "exam") { st.graphExam = el.checked; api.save(); applyStyles(); }
    });
    const q = root.querySelector("#kgQ");
    q.addEventListener("input", () => runSearch(q.value));
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (q.value.trim().toLowerCase() === query && hits.length) nextHit(); else runSearch(q.value); } });

    // ---- 画布尺寸变化时更新（不销毁视图）；离开页面后自动清理 ----
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        if (!root.isConnected) { if (cleanup) { cleanup(); cleanup = null; } return; }
        const w = svg.clientWidth, h = svg.clientHeight;
        if (w && h && (w !== W || h !== H)) { W = w; H = h; updateLabels(); }
      });
      ro.observe(svg);
    }
    cleanup = () => { if (ro) ro.disconnect(); cancelAnimationFrame(anim); if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  }

  return {
    defaults: { graphSel: "", graphColor: "type", graphMode: "", graphStat: { n: 0, r: 0 }, graphHide: [], graphMod: "all", graphExam: true, graphTall: false },
    tabs: { graph: { name: "知识图谱", render, after, wide: true } }
  };
});
