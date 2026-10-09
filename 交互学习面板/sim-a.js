// 动画剧场 A 组：项目沙盘（开学周故障复盘）、熔断器状态机、秒杀漏斗
// 每个动画 = 纯计算的“模型”（可脱离浏览器测试，挂在 sim.model 上）+ 渲染/交互（mount）。
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const pc = (x) => Math.round(x * 100) + "%";
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  if (typeof document !== "undefined" && !document.getElementById("kd-sim-a-style")) {
    const st = document.createElement("style");
    st.id = "kd-sim-a-style";
    st.textContent = `
      .sim-sandbox-svg, .sim-breaker-svg, .sim-flash-svg { width: 100%; height: auto; display: block; }
      .sim-sandbox-box { fill: var(--panel); stroke: var(--line); stroke-width: 1.3; transition: stroke .3s; }
      .sim-sandbox-box.slow { stroke: var(--bad); stroke-width: 2; }
      .sim-sandbox-cell { fill: var(--line); transition: fill .15s; }
      .sim-sandbox-lg { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 4px 0 12px; vertical-align: -1px; }
      @keyframes sim-sandbox-spin { to { transform: rotate(360deg); } }
      .sim-sandbox-hand { transform-origin: 690px 150px; animation: sim-sandbox-spin 6s linear infinite; }
      .sim-sandbox-hand.slow { animation-duration: 1.2s; }
      .sim-breaker-node { fill: var(--panel); stroke: var(--line); stroke-width: 1.5; }
      .sim-breaker-node.on.closed { fill: color-mix(in srgb, var(--ok) 22%, var(--panel)); stroke: var(--ok); stroke-width: 3; }
      .sim-breaker-node.on.open { fill: color-mix(in srgb, var(--bad) 22%, var(--panel)); stroke: var(--bad); stroke-width: 3; }
      .sim-breaker-node.on.half { fill: color-mix(in srgb, var(--mid) 24%, var(--panel)); stroke: var(--mid); stroke-width: 3; }
      .sim-breaker-node.bad { stroke: var(--bad); stroke-width: 2; }
      .sim-breaker-arrow { stroke: var(--faint); stroke-width: 1.5; fill: none; }
      .sim-breaker-arrow.hot { stroke: var(--accent); stroke-width: 3.5; }
      .sim-breaker-tl { display: flex; gap: 3px; margin: 6px 0 2px; }
      .sim-breaker-sq { width: 22px; height: 22px; border-radius: 4px; background: var(--fill); border: 1px dashed var(--line); }
      .sim-breaker-sq.ok { background: var(--ok); border: 0; } .sim-breaker-sq.fail { background: var(--bad); border: 0; }
      .sim-breaker-sq.fast { background: var(--faint); border: 0; } .sim-breaker-sq.fb { background: var(--mid); border: 0; }
      .sim-breaker-log { font: 12px/1.55 ui-monospace, Consolas, monospace; background: var(--fill); border-radius: 6px; padding: 6px 10px; height: 118px; overflow: hidden; white-space: pre; color: var(--muted); }
      .sim-flash-lay { fill: var(--fill); stroke: var(--line); stroke-dasharray: 4 3; cursor: pointer; transition: fill .3s, stroke .3s; }
      .sim-flash-lay.on { fill: var(--accent-soft); stroke: var(--accent); stroke-dasharray: none; }
      .sim-flash-needle { transform-origin: 660px 150px; transition: transform .25s; }
      .sim-flash-lg { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin: 0 4px 0 12px; vertical-align: -1px; }
    `;
    document.head.appendChild(st);
  }

  // ───────── 粒子：沿折线流动的小圆点（最多 max 个，超出直接丢弃以节流）─────────
  const mkPath = (pts) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, tot: cum[cum.length - 1] || 1 }; };
  function pathAt(P, t) {
    const d = t * P.tot; let i = 1;
    while (i < P.cum.length - 1 && P.cum[i] < d) i++;
    const a = P.pts[i - 1], b = P.pts[i], u = clamp((d - P.cum[i - 1]) / (P.cum[i] - P.cum[i - 1] || 1), 0, 1);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  function mkDots(g, max) {
    let live = [];
    return {
      add(pts, o) { // o: {c 颜色, ms 飞行时长, stop 停在路径的比例, fx/fy 停下后“弹开”的位移, r 半径}
        if (live.length >= max) return;
        const el = document.createElementNS(NS, "circle");
        el.setAttribute("r", o.r || 3); el.style.fill = o.c; g.appendChild(el);
        live.push({ el, P: mkPath(pts), t: 0, ms: o.ms || 700, stop: o.stop == null ? 1 : o.stop, f: 0, fx: o.fx || 0, fy: o.fy || 0, fade: o.fx || o.fy ? 420 : 140 });
      },
      step(dt) {
        live = live.filter((d) => {
          let op = 1;
          if (d.t < d.stop) d.t = Math.min(d.stop, d.t + dt / d.ms); else { d.f += dt / d.fade; op = 1 - d.f; }
          if (d.f >= 1) { d.el.remove(); return false; }
          const [x, y] = pathAt(d.P, d.t);
          d.el.setAttribute("cx", (x + d.fx * d.f).toFixed(1)); d.el.setAttribute("cy", (y + d.fy * d.f).toFixed(1)); d.el.style.opacity = op;
          return true;
        });
      },
      clear() { live.forEach((d) => d.el.remove()); live = []; }
    };
  }

  // ───────── 熔断器（项目沙盘模式 C 与“熔断器状态机”共用）─────────
  // c: {win 窗口大小, minN 最少样本, thr 失败率阈值, strict 是否严格大于, openMs, probes 半开试探数}
  const mkBreaker = (c) => ({ c, st: "closed", hist: [], until: 0, pr: 0, pok: 0, gen: 0 });
  const trip = (b, now, from) => { b.st = "open"; b.until = now + b.c.openMs; b.gen++; return from + ">open"; };
  function brTick(b, now) { // Open 时间到 → Half-Open
    if (b.st === "open" && now >= b.until) { b.st = "half"; b.pr = 0; b.pok = 0; b.gen++; return "open>half"; }
    return "";
  }
  function brAllow(b) { // 能否放行一次真实调用
    if (b.st === "closed") return true;
    if (b.st === "half" && b.pr < b.c.probes) { b.pr++; return true; }
    return false;
  }
  function brRec(b, ok, now) { // 记录一次真实调用结果，返回状态迁移（如 "closed>open"）
    if (b.st === "half") {
      if (!ok) return trip(b, now, "half");
      if (++b.pok >= b.c.probes) { b.st = "closed"; b.hist = []; b.gen++; return "half>closed"; }
      return "";
    }
    if (b.st !== "closed") return "";
    b.hist.push(ok); if (b.hist.length > b.c.win) b.hist.shift();
    const r = b.hist.filter((x) => !x).length / b.hist.length;
    return b.hist.length >= b.c.minN && (b.c.strict ? r > b.c.thr : r >= b.c.thr) ? trip(b, now, "closed") : "";
  }

  // ───────── 1) 项目沙盘：模型（100ms 一个 tick）─────────
  const SB = { POOL: 60, QMAX: 200, QTO: 3000, WK: 8 };
  function sbNew() {
    return {
      t: 0, acc: 0, sacc: 0, tok: 35, q: [], pend: 0, inflight: 0, issued: 0, ok: 0, to: 0, rej: 0, lim: 0, win: [], busy: 0, wait: 0, tr: "", trT: -999,
      th: Array.from({ length: SB.POOL }, () => ({ free: 0, job: null, busy: 0, e: 0 })),
      wk: Array.from({ length: SB.WK }, () => ({ free: 0, job: null })),
      br: mkBreaker({ win: 20, minN: 10, thr: 0.5, strict: true, openMs: 10000, probes: 1 })
    };
  }
  // p: {lambda 次/秒, slow 省库变慢, mode "A"|"B"|"C"}
  function sbStep(s, p) {
    const now = s.t * 100, end = now + 100, dbMs = p.slow ? 12000 : 300, br = s.br;
    const ev = { arr: 0, lim: 0, bad: 0, sub: 0, call: 0 };
    let tOk = 0, tBad = 0;
    // 1. 请求到达：网关令牌桶（仅 C）→ 等待队列（上限 200）
    s.acc += p.lambda / 10; const n = Math.floor(s.acc); s.acc -= n;
    if (p.mode === "C") s.tok = Math.min(70, s.tok + 35); // 350 次/秒
    for (let k = 0; k < n; k++) {
      if (p.mode === "C") { if (s.tok < 1) { s.lim++; ev.lim++; continue; } s.tok--; }
      ev.arr++;
      if (s.q.length >= SB.QMAX) { s.rej++; ev.bad++; tBad++; continue; }
      s.sacc += 0.3; const sub = s.sacc >= 1; if (sub) s.sacc -= 1; // 30% 提交受理
      s.q.push({ at: now + ((k + 0.5) / n) * 100, sub });
    }
    while (s.q.length && now - s.q[0].at > SB.QTO) { s.q.shift(); s.to++; ev.bad++; tBad++; } // 排队超 3 秒 → 超时
    // 2. 线程池：每个线程按“绝对时间”接活；A 模式的受理请求要占到省库返回
    let busy = 0, wait = 0;
    for (const th of s.th) {
      let b = 0;
      if (th.job && th.free > now) b += Math.min(th.free, end) - now;
      for (;;) {
        if (th.job && th.free <= end) { s.ok++; tOk++; if (th.job.sub) { if (th.job.sync) s.issued++; else s.pend++; } th.job = null; }
        if (th.job || !s.q.length) break;
        const r = s.q[0], st = Math.max(th.free, r.at, now);
        if (st >= end) break;
        s.q.shift();
        if (st - r.at > SB.QTO) { s.to++; ev.bad++; tBad++; continue; }
        const sync = r.sub && p.mode === "A";
        th.free = st + 50 + (sync ? dbMs : 0); th.job = { sub: r.sub, sync };
        if (sync) ev.sub++;
        b += Math.min(th.free, end) - st;
      }
      th.busy = b; busy += b;
      if (th.job && th.job.sync && th.free > end) wait++;
    }
    s.busy = busy / 100; s.wait = wait;
    // 3. 后台 worker（B/C）：并发 8 路消化“待出证记录”；C 有 2s 超时 + 熔断
    if (p.mode !== "C") { if (br.st !== "closed" || br.hist.length) { br.st = "closed"; br.hist = []; br.gen++; } }
    else { const t = brTick(br, now); if (t) { s.tr = t; s.trT = s.t; } }
    for (const w of s.wk) {
      if (w.job && w.free <= end) {
        s.inflight--;
        if (!w.job.fail) { s.pend--; s.issued++; }
        if (p.mode === "C" && w.job.gen === br.gen) { const t = brRec(br, !w.job.fail, end); if (t) { s.tr = t; s.trT = s.t; } }
        w.job = null;
      }
      if (!w.job && p.mode !== "A" && s.pend - s.inflight > 0 && (p.mode !== "C" || brAllow(br))) {
        const fail = p.mode === "C" && dbMs > 2000;
        w.free = Math.max(w.free, now) + (p.mode === "C" ? Math.min(dbMs, 2000) : dbMs);
        w.job = { fail, gen: br.gen }; s.inflight++; ev.call++;
      }
    }
    s.win.push([tOk, tBad]); if (s.win.length > 100) s.win.shift();
    s.t++;
    return ev;
  }
  // 发布新版本（A → B/C）：旧实例重启，卡在等省库的线程被释放，这些办件补写成“待出证记录”
  function sbRedeploy(s) {
    for (const th of s.th) if (th.job && th.job.sync) { s.pend++; th.job = null; th.free = s.t * 100; }
  }
  const sbRate = (s) => { let a = 0, b = 0; for (const w of s.win) { a += w[0]; b += w[1]; } return a + b ? a / (a + b) : null; };

  const SB_MODE = { A: "模式 A · 同步等待（第一版）", B: "模式 B · 本地消息表 + 异步重试", C: "模式 C · B + 超时 / 熔断 / 网关限流" };
  const SB_TR = { "closed>open": "熔断器跳闸：Closed → Open", "open>half": "Open → Half-Open（放 1 个试探）", "half>closed": "试探成功：Half-Open → Closed", "half>open": "试探失败：Half-Open → Open" };
  const BR_NM = { closed: "Closed", open: "Open", half: "Half-Open" };

  (window.KD_SIMS = window.KD_SIMS || []).push({
    id: "sandbox", name: "项目沙盘·开学周故障复盘", tag: "论文 K01 K02 K10", kit: "K01",
    intro: "把论文里的真实故事跑一遍：开学周省电子证照接口变慢，第一版“同步等待”把申报办件服务的线程池占满；改成本地消息表 + 异步重试，再加超时/熔断/限流。",
    model: { sbNew, sbStep, sbRate, sbRedeploy, mkBreaker },
    render() {
      const cells = Array.from({ length: SB.POOL }, (_, i) => `<rect class="sim-sandbox-cell" id="sim-sandbox-c${i}" x="${258 + (i % 12) * 17}" y="${76 + Math.floor(i / 12) * 17}" width="14" height="14" rx="3"/>`).join("");
      const kpi = (id, label) => `<div><div class="label">${label}</div><div class="v" id="sim-sandbox-${id}">—</div></div>`;
      return `
      <p class="faint" style="margin:0 0 6px">背景：某地级市「一网通办统一申办平台」· 互联网侧 · 注册用户 40 万 · 平日日均办件约 3000，开学季/医保集中缴费期瞬时流量约 8 倍 · 14 人团队（2 名专职运维）· 5 个服务 + API 网关 + Nacos。</p>
      <div class="sim-ctl"><span class="faint">场景</span>
        <button class="pill" id="sim-sandbox-p1">平日</button><button class="pill" id="sim-sandbox-p2">开学周·证照正常</button><button class="pill" id="sim-sandbox-p3">开学周·证照变慢（复现 40 分钟故障）</button></div>
      <div class="sim-ctl"><span class="faint">架构</span>
        <button class="pill on" id="sim-sandbox-mA">A 同步等待（第一版）</button><button class="pill" id="sim-sandbox-mB">B 本地消息表 + 异步重试</button><button class="pill" id="sim-sandbox-mC">C 再加超时 + 熔断 + 限流</button>
        <button class="primary" id="sim-sandbox-fix">一键改造</button></div>
      <div class="sim-ctl">
        <label>请求速率 λ <input type="range" id="sim-sandbox-lam" min="20" max="400" step="10" value="40"><b id="sim-sandbox-lamv">40</b> 次/秒</label>
        <label><input type="checkbox" id="sim-sandbox-slow" style="width:auto"> 省电子证照库变慢（12 秒）</label>
        <span class="faint">速度</span><button class="pill on" id="sim-sandbox-sp1">1×</button><button class="pill" id="sim-sandbox-sp4">4×</button>
        <button class="ghost" id="sim-sandbox-rst">复位</button></div>
      <svg class="sim-sandbox-svg" viewBox="0 0 760 300" role="img" aria-label="项目沙盘">
        <line class="flow" x1="86" y1="140" x2="118" y2="140"/><line class="flow" x1="208" y1="140" x2="250" y2="140"/>
        <line class="flow" x1="470" y1="150" x2="505" y2="150"/><line class="flow" x1="585" y1="150" x2="630" y2="150"/>
        <rect class="sim-sandbox-box" x="6" y="110" width="80" height="60" rx="8"/>
        <text x="46" y="136" text-anchor="middle">群众请求</text><text id="sim-sandbox-lamt" x="46" y="154" text-anchor="middle" style="fill:var(--faint);font-size:11px">40 次/秒</text>
        <rect class="sim-sandbox-box" x="118" y="110" width="90" height="60" rx="8"/>
        <text x="163" y="136" text-anchor="middle">API 网关</text><text id="sim-sandbox-gw" x="163" y="154" text-anchor="middle" style="fill:var(--faint);font-size:11px">路由 · 无限流</text>
        <text x="163" y="192" text-anchor="middle" style="fill:var(--faint);font-size:11px">Nacos 注册中心</text>
        <rect class="sim-sandbox-box" x="250" y="30" width="220" height="210" rx="10"/>
        <text x="360" y="49" text-anchor="middle" style="font-weight:600">申报办件服务（核心）</text>
        <text id="sim-sandbox-mode" x="360" y="65" text-anchor="middle" style="fill:var(--accent);font-size:11px"></text>
        ${cells}
        <text id="sim-sandbox-qt" x="258" y="184" style="fill:var(--muted);font-size:11px">等待队列 0/200</text>
        <rect x="258" y="190" width="204" height="8" rx="4" style="fill:var(--fill)"/><rect id="sim-sandbox-qb" x="258" y="190" width="0" height="8" rx="4" style="fill:var(--accent)"/>
        <g id="sim-sandbox-pg"><text x="258" y="216" style="fill:var(--muted);font-size:11px">待出证记录表（本地消息表）</text><text id="sim-sandbox-pt" x="462" y="216" text-anchor="end" style="font-size:11px;font-weight:600">0 条</text>
        <rect x="258" y="222" width="204" height="10" rx="5" style="fill:var(--fill)"/><rect id="sim-sandbox-pb" x="258" y="222" width="0" height="10" rx="5" style="fill:var(--mid)"/></g>
        <text id="sim-sandbox-bk" x="545" y="108" text-anchor="middle" style="fill:var(--muted);font-size:11px"></text>
        <rect class="sim-sandbox-box" x="505" y="118" width="80" height="64" rx="8"/>
        <text x="545" y="146" text-anchor="middle">电子证照服务</text><text x="545" y="164" text-anchor="middle" style="fill:var(--faint);font-size:11px">办件号幂等</text>
        <rect class="sim-sandbox-box" id="sim-sandbox-db" x="630" y="100" width="120" height="100" rx="10"/>
        <text x="690" y="120" text-anchor="middle">省电子证照库</text>
        <circle cx="690" cy="150" r="16" style="fill:none;stroke:var(--faint);stroke-width:1.5"/>
        <line x1="690" y1="150" x2="698" y2="150" style="stroke:var(--text);stroke-width:2"/><line class="sim-sandbox-hand" id="sim-sandbox-hand" x1="690" y1="150" x2="690" y2="138" style="stroke:var(--text);stroke-width:2"/>
        <text id="sim-sandbox-dbt" x="690" y="188" text-anchor="middle" style="font-weight:600;font-size:13px">0.3 s</text>
        <text x="690" y="218" text-anchor="middle" style="fill:var(--faint);font-size:11px">外部依赖 · 经常慢/故障</text>
        <text x="6" y="278" style="fill:var(--faint);font-size:11px">其余 3 个服务：统一认证 · 部门办理 · 消息通知（本沙盘不受影响）</text>
        <g id="sim-sandbox-dots"></g>
      </svg>
      <div class="faint" style="margin:2px 0 6px">线程池（60）：<span class="sim-sandbox-lg" style="background:var(--line);margin-left:2px"></span>空闲<span class="sim-sandbox-lg" style="background:var(--accent)"></span>忙碌（越深越忙）<span class="sim-sandbox-lg" style="background:var(--mid)"></span>卡在等外部（省库）<span class="sim-sandbox-lg" style="background:var(--bad);border-radius:50%"></span>超时/拒绝<span class="sim-sandbox-lg" style="background:var(--faint);border-radius:50%"></span>被限流</div>
      <div class="sim-kpi">${kpi("k1", "申报成功率（近 10 秒）")}${kpi("k2", "线程占用")}${kpi("k3", "排队数")}${kpi("k4", "待出证堆积")}${kpi("k5", "已出证")}${kpi("k6", "拒绝（含限流）/ 超时")}</div>
      <div class="sim-note" id="sim-sandbox-note"></div>`;
    },
    mount(root, ctx) {
      const $ = (id) => root.querySelector("#sim-sandbox-" + id);
      const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
      const dots = mkDots($("dots"), 60), cells = Array.from({ length: SB.POOL }, (_, i) => $("c" + i));
      const P0 = { lambda: 40, slow: false, mode: "A" };
      let s = sbNew(), p = { ...P0 }, speed = 1, simMs = 0, notice = "", nLeft = 0, bEma = 0;
      const txt = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
      const sync = () => {
        ["A", "B", "C"].forEach((m) => $("m" + m).classList.toggle("on", p.mode === m));
        $("sp1").classList.toggle("on", speed === 1); $("sp4").classList.toggle("on", speed === 4);
        $("lam").value = p.lambda; txt("lamv", p.lambda); $("slow").checked = p.slow;
      };
      const preset = (lam, slow, mode) => () => { p.lambda = lam; p.slow = slow; if (mode) p.mode = mode; notice = ""; sync(); };
      on("p1", "click", preset(40, false)); on("p2", "click", preset(300, false)); on("p3", "click", preset(300, true, "A"));
      const to = (m) => { if (p.mode === "A" && m !== "A") sbRedeploy(s); p.mode = m; };
      ["A", "B", "C"].forEach((m) => on("m" + m, "click", () => { to(m); notice = ""; sync(); }));
      on("fix", "click", () => {
        if (p.mode === "A") { to("B"); notice = "改造完成：同步调用已切断，新版本发布后卡住的线程被释放——受理事务里只写一条“待出证”本地消息，后台 worker 异步重试，证照服务按办件号幂等。"; }
        else notice = "已经是改造后的版本（模式 " + p.mode + "）。想看对比，点上面的模式 A 回到第一版。";
        nLeft = 140; sync();
      });
      on("lam", "input", (e) => { p.lambda = +e.target.value; txt("lamv", p.lambda); });
      on("slow", "change", (e) => { p.slow = e.target.checked; });
      on("sp1", "click", () => { speed = 1; sync(); }); on("sp4", "click", () => { speed = 4; sync(); });
      on("rst", "click", () => { s = sbNew(); p = { ...P0 }; speed = 1; simMs = 0; notice = ""; bEma = 0; dots.clear(); sync(); });

      const jy = () => 128 + Math.random() * 24;
      const spawn = (e) => {
        for (let i = 0, k = Math.ceil(e.arr / 6); i < k; i++) { const y = jy(); dots.add([[86, y], [250, y]], { c: "var(--accent)", ms: 650 }); }
        for (let i = 0, k = Math.ceil(e.lim / 4); i < k; i++) { const y = jy(); dots.add([[86, y], [200, y]], { c: "var(--faint)", ms: 450, stop: 1, fx: -8, fy: (Math.random() - 0.5) * 50 }); }
        for (let i = 0, k = Math.ceil(e.bad / 4); i < k; i++) { const y = jy(); dots.add([[86, y], [246, y]], { c: "var(--bad)", ms: 650, fx: -22, fy: (Math.random() - 0.5) * 60 }); }
        const nc = p.mode === "A" ? e.sub : e.call, c = p.slow ? "var(--mid)" : "var(--ok)";
        for (let i = 0, k = Math.ceil(nc / 3); i < k; i++) dots.add([[470, 150], [630, 150]], { c, ms: p.slow ? 1500 : 600 });
      };
      const paint = () => {
        const end = s.t * 100, rate = sbRate(s);
        s.th.forEach((th, i) => {
          th.e = th.e * 0.6 + th.busy * 0.4;
          const wait = th.job && th.job.sync && th.free > end, c = cells[i].style;
          c.fill = wait ? "var(--mid)" : th.e > 3 ? "var(--accent)" : "var(--line)";
          c.opacity = wait ? 1 : th.e > 3 ? clamp(0.3 + th.e / 100, 0.3, 1) : 1;
        });
        bEma = bEma * 0.6 + s.busy * 0.4;
        const sat = s.wait >= 45 || s.q.length >= 150, thr = Math.round(bEma);
        txt("k1", rate == null ? "—" : pc(rate)); $("k1").className = "v " + (rate == null ? "" : rate > 0.95 ? "ok" : rate > 0.6 ? "mid" : "bad");
        txt("k2", Math.min(SB.POOL, Math.max(thr, s.wait)) + " / " + SB.POOL); $("k2").className = "v " + (sat ? "bad" : "");
        txt("k3", s.q.length + " / " + SB.QMAX); $("k3").className = "v " + (s.q.length >= 100 ? "bad" : "");
        txt("k4", fmt(s.pend)); txt("k5", fmt(s.issued)); txt("k6", fmt(s.rej + s.lim) + " / " + fmt(s.to));
        txt("lamt", p.lambda + " 次/秒"); txt("gw", p.mode === "C" ? "路由 · 限流 350/s" : "路由 · 无限流"); txt("mode", SB_MODE[p.mode]);
        txt("qt", "等待队列 " + s.q.length + "/" + SB.QMAX); $("qb").setAttribute("width", (204 * s.q.length) / SB.QMAX); $("qb").style.fill = s.q.length >= 100 ? "var(--bad)" : "var(--accent)";
        $("pg").style.opacity = p.mode === "A" && !s.pend ? 0.3 : 1; txt("pt", fmt(s.pend) + " 条");
        $("pb").setAttribute("width", 204 * Math.min(1, s.pend / 1000)); $("pb").style.fill = s.pend > 600 ? "var(--bad)" : "var(--mid)";
        txt("dbt", p.slow ? "12 s" : "0.3 s"); $("dbt").style.fill = p.slow ? "var(--bad)" : "var(--ok)";
        $("db").classList.toggle("slow", p.slow); $("hand").classList.toggle("slow", p.slow);
        const b = s.br.st;
        txt("bk", p.mode === "A" ? "同步阻塞等待" : p.mode === "B" ? "异步重试 · 8 路 worker" : "熔断 " + BR_NM[b] + (b === "open" ? " 暂停调用" : b === "half" ? " 试探" : " 放行"));
        $("bk").style.fill = p.mode === "A" ? "var(--bad)" : p.mode === "C" && b !== "closed" ? (b === "open" ? "var(--bad)" : "var(--mid)") : "var(--muted)";
        // 解说
        let msg, cls = "";
        if (nLeft > 0) { nLeft--; msg = notice; cls = "ok"; }
        else if (p.mode === "A") {
          if (sat && s.wait >= 45) { msg = "线程池已被占满，新请求在排队，超过 3 秒就超时——这就是论文第四段说的“线程池迅速被占满”。受理线程一直卡在等省库（橙色），连只占 50ms 的浏览类请求也被拖死。"; cls = "bad"; }
          else if (p.slow && s.wait > 0) { msg = "省库响应飙到 12 秒：同步等待的受理请求把线程一根根“钉”在橙色上，空闲线程越来越少……"; cls = "bad"; }
          else msg = "第一版：受理事务提交后同步等待省库返回。省库 0.3 秒时一切正常，但它是单点依赖——点“开学周·证照变慢”复现 40 分钟故障。";
        } else if (p.mode === "B") {
          msg = "受理接口恢复：线程只占 50ms，证照在后台慢慢出，群众先拿办件号。" + (s.pend > 100 ? "待出证记录已堆积 " + fmt(s.pend) + " 条，8 路 worker 按省库速度消化（堆积 ≠ 故障，是最终一致）。" : "");
          cls = "ok";
        } else {
          const recent = s.t - s.trT < 40 ? "【" + SB_TR[s.tr] + "】" : "";
          msg = recent + (b === "open" ? "熔断器 Open：后台 10 秒内不再调用省库，待出证记录继续堆积在本地消息表，受理接口完全不受影响。" : b === "half" ? "Half-Open：放 1 个试探请求，成功就恢复，失败再熔断 10 秒。" : "模式 C：worker 调省库有 2 秒超时，近 20 次失败率 > 50% 就熔断；网关令牌桶限流 350 次/秒，超出直接返回“系统繁忙”。");
          cls = b === "closed" ? "ok" : "";
        }
        const nt = $("note"); if (nt.textContent !== msg) nt.textContent = msg; nt.className = "sim-note " + cls;
      };
      sync(); paint();
      ctx.every(() => {
        simMs += 50 * speed;
        const e = { arr: 0, lim: 0, bad: 0, sub: 0, call: 0 };
        while (simMs >= 100) { simMs -= 100; const r = sbStep(s, p); for (const k in e) e[k] += r[k]; }
        if (e.arr || e.lim || e.bad || e.sub || e.call) spawn(e);
        dots.step(50); paint();
      }, 50);
    },
    say: [
      "同步调用外部慢接口会占满线程池，引发级联故障；解法是切断同步依赖，改为“本地消息表 + 异步重试”，并给外部调用加超时、熔断、限流（舱壁隔离）。",
      "受理事务里同时写业务数据和一条状态为“待发送”的本地消息，后台任务异步重试；证照服务以办件号做幂等，防止重试造成重复出证；群众先拿办件号，证照几分钟后生成。",
      "我拒绝在受理链路上使用分布式事务：14 人团队承担不起跨服务对账与运维成本，只在出证、通知这类允许最终一致的链路上走异步。",
      "效果可量化：同样的开学周流量，第一版网上申报大面积超时约 40 分钟，改造后受理接口成功率保持在 99% 以上，待出证记录在高峰后几分钟内清零。"
    ],
    cards: ["a10", "a12", "a32", "a33"]
  });

  // ───────── 2) 熔断器状态机：模型 ─────────
  function brNew(thr) { return { now: 0, b: mkBreaker({ win: 10, minN: 5, thr, strict: false, openMs: 5000, probes: 3 }), ok: 0, fail: 0, fast: 0, fb: 0, tl: [] }; }
  // p: {rate 0..1 下游故障率, fb 是否降级兜底, thr}；每次调用间隔 300ms。返回 {out, trans[]}
  function brStep(s, p, rnd) {
    s.now += 300; s.b.c.thr = p.thr;
    const trans = [], t0 = brTick(s.b, s.now); if (t0) trans.push(t0);
    let out;
    if (brAllow(s.b)) {
      const ok = rnd() >= p.rate; out = ok ? "ok" : "fail"; if (ok) s.ok++; else s.fail++;
      const t1 = brRec(s.b, ok, s.now); if (t1) trans.push(t1);
    } else { s.fast++; if (p.fb) { s.fb++; out = "fb"; } else out = "fast"; }
    s.tl.push(out); if (s.tl.length > 20) s.tl.shift();
    return { out, trans };
  }

  const BR_ARROW = { "closed>open": "co", "open>half": "oh", "half>closed": "hc", "half>open": "ho" };
  const BR_WHY = { co: (s) => `最近 ${s.b.hist.length} 次失败 ${s.b.hist.filter((x) => !x).length} 次，达到阈值`, oh: () => "Open 满 5 秒，下一个请求变成试探", hc: () => "3 个试探全部成功", ho: () => "试探里出现失败，重新熔断" };
  const BR_OUT = { ok: "成功", fail: "失败（下游出错）", fast: "被熔断，快速失败", fb: "被熔断 → 降级兜底「办理结果稍后通知」" };
  const BR_XY = { co: [[270, 138], [490, 138]], oh: [[580, 161], [580, 245], [440, 245]], hc: [[320, 245], [210, 245], [210, 161]], ho: [[440, 228], [520, 228], [520, 161]] };

  (window.KD_SIMS = window.KD_SIMS || []).push({
    id: "breaker", name: "熔断器状态机", tag: "K10 K06", kit: "K10",
    intro: "调用方 → 熔断器 → 下游：注入故障后看 Closed → Open → Half-Open 如何迁移，Open 时调用方不再傻等下游，而是快速失败并返回兜底。",
    model: { brNew, brStep },
    render() {
      const node = (id, cls, x, y, t, sub) => `<rect class="sim-breaker-node ${cls}" id="sim-breaker-n-${id}" x="${x}" y="${y}" width="120" height="46" rx="10"/><text x="${x + 60}" y="${y + 19}" text-anchor="middle" style="font-weight:600;font-size:13px">${t}</text><text id="sim-breaker-s-${id}" x="${x + 60}" y="${y + 36}" text-anchor="middle" style="fill:var(--faint);font-size:11px">${sub}</text>`;
      const arrow = (id) => `<path class="sim-breaker-arrow" id="sim-breaker-a-${id}" d="M${BR_XY[id].map((q) => q.join(" ")).join(" L")}" marker-end="url(#sim-breaker-mk)"/>`;
      const kpi = (id, label) => `<div><div class="label">${label}</div><div class="v" id="sim-breaker-${id}">0</div></div>`;
      return `
      <div class="sim-ctl">
        <label>下游故障率 <input type="range" id="sim-breaker-rate" min="0" max="100" step="5" value="0"><b id="sim-breaker-ratev">0%</b></label>
        <button class="primary" id="sim-breaker-inj">注入故障（100%）</button>
        <label>失败率阈值 <input type="range" id="sim-breaker-thr" min="20" max="90" step="10" value="50"><b id="sim-breaker-thrv">50%</b></label>
        <label><input type="checkbox" id="sim-breaker-fb" checked style="width:auto"> 降级兜底</label>
        <button class="pill" id="sim-breaker-pause">暂停</button><button class="ghost" id="sim-breaker-rst">复位</button></div>
      <svg class="sim-breaker-svg" viewBox="0 0 760 290" role="img" aria-label="熔断器状态机">
        <defs><marker id="sim-breaker-mk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--faint)"/></marker></defs>
        <line class="flow" x1="110" y1="42" x2="330" y2="42"/><line class="flow" x1="430" y1="42" x2="650" y2="42"/>
        <rect class="sim-breaker-node" x="10" y="20" width="100" height="44" rx="8"/><text x="60" y="38" text-anchor="middle">调用方</text><text x="60" y="54" text-anchor="middle" style="fill:var(--faint);font-size:11px">约每 300ms 一次</text>
        <text id="sim-breaker-ret" x="10" y="84" style="fill:var(--muted);font-size:11px">调用方收到：—</text>
        <rect class="sim-breaker-node closed on" id="sim-breaker-gate" x="330" y="15" width="100" height="54" rx="10"/><text x="380" y="36" text-anchor="middle" style="font-weight:600">熔断器</text><text id="sim-breaker-gt" x="380" y="55" text-anchor="middle" style="font-size:11px">Closed · 放行</text>
        <rect class="sim-breaker-node" id="sim-breaker-down" x="650" y="20" width="100" height="44" rx="8"/><text x="700" y="38" text-anchor="middle">下游服务</text><text id="sim-breaker-dt" x="700" y="54" text-anchor="middle" style="fill:var(--faint);font-size:11px">正常</text>
        ${arrow("co")}${arrow("oh")}${arrow("hc")}${arrow("ho")}
        ${node("closed", "closed", 150, 115, "Closed", "放行 · 统计失败率")}${node("open", "open", 490, 115, "Open", "快速失败 · 返回兜底")}${node("half", "half", 320, 222, "Half-Open", "放 3 个试探请求")}
        <text id="sim-breaker-lb-co" x="380" y="130" text-anchor="middle" style="fill:var(--muted);font-size:11px">失败率 ≥ 50%（最近 10 次）</text>
        <text x="592" y="205" style="fill:var(--muted);font-size:11px">Open 满 5 秒</text>
        <text x="200" y="205" text-anchor="end" style="fill:var(--muted);font-size:11px">3 个试探全成功</text>
        <text x="510" y="203" text-anchor="end" style="fill:var(--muted);font-size:11px">任一试探失败</text>
        <text id="sim-breaker-win" x="380" y="183" text-anchor="middle" style="font-size:12px">统计窗口：—</text>
        <g id="sim-breaker-dots"></g>
      </svg>
      <div class="faint" style="margin-top:6px">最近 20 次调用（旧 → 新）：<span class="sim-breaker-sq ok" style="display:inline-block;width:10px;height:10px;vertical-align:-1px"></span> 成功
        <span class="sim-breaker-sq fail" style="display:inline-block;width:10px;height:10px;margin-left:8px;vertical-align:-1px"></span> 失败
        <span class="sim-breaker-sq fast" style="display:inline-block;width:10px;height:10px;margin-left:8px;vertical-align:-1px"></span> 被熔断（快速失败）
        <span class="sim-breaker-sq fb" style="display:inline-block;width:10px;height:10px;margin-left:8px;vertical-align:-1px"></span> 降级兜底</div>
      <div class="sim-breaker-tl">${Array.from({ length: 20 }, (_, i) => `<span class="sim-breaker-sq" id="sim-breaker-tl${i}"></span>`).join("")}</div>
      <div class="sim-kpi">${kpi("k1", "成功")}${kpi("k2", "失败（拖住调用方）")}${kpi("k3", "快速失败（被熔断）")}${kpi("k4", "降级返回")}${kpi("k5", "窗口失败率")}</div>
      <div class="sim-breaker-log" id="sim-breaker-log"></div>
      <div class="sim-note" id="sim-breaker-note"></div>`;
    },
    mount(root, ctx) {
      const $ = (id) => root.querySelector("#sim-breaker-" + id);
      const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
      const dots = mkDots($("dots"), 40), sq = Array.from({ length: 20 }, (_, i) => $("tl" + i));
      let p = { rate: 0, fb: true, thr: 0.5, paused: false }, s = brNew(p.thr), hot = {}, log = [], lastTr = "", lastTrAt = -99, ret = "—";
      let disp = "closed", dispAt = 0, fr = 0, stq = []; // 显示用的状态：每个状态至少停留 700ms，让极快的 Open→Half-Open→Open 也看得见
      const txt = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
      const sync = () => {
        $("rate").value = Math.round(p.rate * 100); txt("ratev", Math.round(p.rate * 100) + "%");
        txt("inj", p.rate > 0 ? "恢复下游" : "注入故障（100%）"); $("inj").className = p.rate > 0 ? "" : "primary";
        txt("thrv", Math.round(p.thr * 100) + "%"); txt("lb-co", `失败率 ≥ ${Math.round(p.thr * 100)}%（最近 10 次）`);
        txt("pause", p.paused ? "继续" : "暂停"); $("pause").classList.toggle("on", p.paused);
      };
      on("rate", "input", (e) => { p.rate = +e.target.value / 100; sync(); });
      on("inj", "click", () => { p.rate = p.rate > 0 ? 0 : 1; sync(); });
      on("thr", "input", (e) => { p.thr = +e.target.value / 100; sync(); });
      on("fb", "change", (e) => { p.fb = e.target.checked; });
      on("pause", "click", () => { p.paused = !p.paused; sync(); });
      on("rst", "click", () => { p = { rate: 0, fb: true, thr: 0.5, paused: false }; $("fb").checked = true; $("thr").value = 50; s = brNew(p.thr); log = []; $("log").textContent = ""; hot = {}; lastTr = ""; ret = "—"; disp = "closed"; stq = []; dots.clear(); sync(); });

      const addLog = (t) => { log.push(t); if (log.length > 7) log.shift(); $("log").textContent = log.join("\n"); };
      const step = () => {
        if (p.paused) return;
        const r = brStep(s, p, Math.random), y = 36 + Math.random() * 12, ts = "[" + (s.now / 1000).toFixed(1).padStart(5) + "s] ";
        const c = { ok: "var(--ok)", fail: "var(--bad)", fast: "var(--faint)", fb: "var(--mid)" }[r.out];
        if (r.out === "ok" || r.out === "fail") dots.add([[110, y], [650, y]], { c, ms: 850, fx: r.out === "fail" ? 10 : 0, fy: r.out === "fail" ? 18 : 0 });
        else if (r.out === "fb") dots.add([[110, y], [326, y], [110, y]], { c, ms: 1000 });
        else dots.add([[110, y], [326, y]], { c, ms: 500, fx: -6, fy: 16 });
        ret = r.out === "ok" ? "成功（正常数据）" : r.out === "fail" ? "失败（等了下游，被拖住）" : r.out === "fb" ? "兜底：办理结果稍后通知" : "快速失败（直接报错）";
        addLog(ts + "#" + (s.ok + s.fail + s.fast) + " " + BR_OUT[r.out]);
        for (const t of r.trans) {
          const id = BR_ARROW[t], [a, b] = t.split(">"), why = BR_WHY[id](s);
          hot[id] = 16; lastTr = BR_NM[a] + " → " + BR_NM[b]; lastTrAt = s.now; stq.push(b);
          addLog("      ⚡ " + lastTr + "（" + why + "）");
          const q = BR_XY[id]; dots.add(q, { c: "var(--accent)", ms: 700, r: 5 });
        }
      };
      const paint = () => {
        fr++; if (stq.length && fr - dispAt >= 14) { disp = stq.shift(); dispAt = fr; }
        const b = s.b, st = disp, f = b.hist.filter((x) => !x).length;
        ["closed", "open", "half"].forEach((k) => $("n-" + k).classList.toggle("on", st === k));
        const g = $("gate"); g.setAttribute("class", "sim-breaker-node on " + st);
        txt("gt", st === "closed" ? "Closed · 放行" : st === "open" ? "Open · 快速失败" : "Half-Open · 试探");
        txt("s-open", st === "open" ? "剩余 " + Math.max(0, (b.until - s.now) / 1000).toFixed(1) + " s · 返回兜底" : "快速失败 · 返回兜底");
        txt("s-half", st === "half" ? "试探 " + b.pok + "/" + b.c.probes + " 个成功" : "放 3 个试探请求");
        for (const id in BR_XY) { if (hot[id] > 0) hot[id]--; $("a-" + id).classList.toggle("hot", hot[id] > 0); }
        $("down").classList.toggle("bad", p.rate > 0); txt("dt", p.rate > 0 ? "故障率 " + Math.round(p.rate * 100) + "%" : "正常"); $("dt").style.fill = p.rate > 0 ? "var(--bad)" : "var(--faint)";
        txt("win", st === "closed" ? `统计窗口：最近 ${b.hist.length}/10 次中失败 ${f} 次` : st === "open" ? "Open：不统计，不调用下游" : "Half-Open：只放试探请求");
        txt("ret", "调用方收到：" + ret);
        s.tl.forEach((o, i) => { sq[20 - s.tl.length + i].className = "sim-breaker-sq " + o; });
        for (let i = 0; i < 20 - s.tl.length; i++) sq[i].className = "sim-breaker-sq";
        txt("k1", s.ok); txt("k2", s.fail); txt("k3", s.fast); txt("k4", s.fb);
        const rate = b.hist.length ? f / b.hist.length : 0; txt("k5", st === "closed" ? pc(rate) : "—");
        $("k2").className = "v " + (s.fail ? "bad" : ""); $("k4").className = "v " + (s.fb ? "mid" : "");
        const fresh = s.now - lastTrAt < 3500 && lastTr ? "【刚刚：" + lastTr + "】" : "";
        let msg = fresh, cls = "";
        if (st === "open") { msg += "Open：调用方不再等下游，" + (p.fb ? "直接返回降级兜底「办理结果稍后通知」" : "直接快速失败（没开降级就只能报错）") + "——保护了调用方线程不被拖死。剩余 " + Math.max(0, (b.until - s.now) / 1000).toFixed(1) + " 秒后进入 Half-Open。"; cls = "bad"; }
        else if (st === "half") msg += "Half-Open：只放 3 个试探请求，全部成功 → Closed，任何一个失败 → 立刻回 Open。";
        else if (p.rate > 0) msg += "下游在出错，窗口里已失败 " + f + " 次；失败率达到 " + Math.round(p.thr * 100) + "% 且样本不少于 5 次就跳闸。每个失败调用都会拖住调用方线程一会儿。";
        else { msg += "Closed：请求全部放行，窗口里失败率 " + pc(rate) + "。下游健康时熔断器“透明”——点“注入故障”看它怎么保护调用方。"; cls = "ok"; }
        const nt = $("note"); if (nt.textContent !== msg) nt.textContent = msg; nt.className = "sim-note " + cls;
      };
      sync(); paint();
      ctx.every(step, 300);
      ctx.every(() => { dots.step(50); paint(); }, 50);
    },
    say: [
      "熔断三态：Closed 放行并统计失败率；失败率超过阈值（如最近 10 次≥50%）→ Open，期间快速失败；Open 持续一段时间（如 5 秒）→ Half-Open，放少量试探请求；试探全成功 → Closed，有失败 → 回 Open。",
      "熔断 vs 降级 vs 限流：熔断=下游已经不健康，主动断开不再调用；降级=给调用方一个兜底结果（缓存、默认值、“稍后通知”）；限流=在入口控制流量上限，保护系统自己不被打爆。",
      "熔断是保护调用方（线程、连接不被慢下游拖死，防止级联故障），降级是保证有兜底返回——两者通常配合使用：熔断打开后走降级逻辑。工程上可用 Sentinel / Resilience4j / Hystrix 实现。"
    ],
    cards: ["a10", "a12"]
  });

  // ───────── 3) 秒杀漏斗：模型（100ms 一个 tick，约 8 秒涌入 10 万请求）─────────
  const FL = { TOTAL: 100000, STOCK: 1000, TICKS: 80, DBCAP: 200, CONS: 50, MQMAX: 5000 }; // DB 容量 2000 QPS = 200/tick；消费 500 单/秒 = 50/tick
  const FL_W = (() => { // 每个 tick 涌入多少请求：开抢瞬间陡升（约 0.5 秒）再指数衰减，总和精确等于 TOTAL
    const w = Array.from({ length: FL.TICKS }, (_, i) => (1 - Math.exp(-(i + 1) / 3)) * Math.exp(-i / 16)), sum = w.reduce((a, b) => a + b, 0);
    let c = 0, prev = 0; return w.map((v) => { c += v / sum; const cum = Math.round(c * FL.TOTAL), n = cum - prev; prev = cum; return n; });
  })();
  const flNew = () => ({ t: 0, arrived: 0, tok: 0, rstock: FL.STOCK, stock: FL.STOCK, sh: [], mq: 0, orders: 0, qps: 0, peak: 0, drop: 0, L: Array.from({ length: 6 }, () => ({ i: 0, o: 0 })) });
  const flDone = (s) => s.t >= FL.TICKS && s.mq === 0;
  // p: {on:[6 个布尔], limit: 网关限流 次/秒, deg: 是否已降级}；返回本 tick 各层进出量，供动画抽样
  function flStep(s, p) {
    const e = { in: [0, 0, 0, 0, 0], out: [0, 0, 0, 0, 0], dbIn: 0, dbDrop: 0 };
    let n = s.t < FL.TICKS ? FL_W[s.t] : 0; s.arrived += n;
    const lay = (i, pass) => { pass = clamp(Math.round(pass), 0, n); s.L[i].i += n; s.L[i].o += pass; e.in[i] = n; e.out[i] = pass; n = pass; };
    lay(0, p.on[0] ? n * 0.4 : n);                                  // ① 动静分离 + CDN：挡掉 60%
    lay(1, p.on[1] ? n * 0.6 : n);                                  // ② 验证码：滤掉 40% 机器请求
    const per = p.limit / 10; s.tok = Math.min(per, s.tok + per);     // ③ 令牌桶（桶容量 = 100ms 的额度）
    let pass = p.on[2] ? Math.min(n, Math.floor(s.tok)) : n; if (p.on[2]) s.tok -= pass; lay(2, pass);
    pass = p.on[3] ? Math.min(n, s.rstock) : n; if (p.on[3]) s.rstock -= pass; lay(3, pass); // ④ Redis 预扣：抢完后直接“已抢完”
    let a;                                                           // ⑤ MQ 削峰：入队，按 DB 能承受的速度消费
    if (p.on[4]) { const acc = Math.min(n, FL.MQMAX - s.mq); s.mq += acc; lay(4, acc); a = Math.min(s.mq, FL.CONS); s.mq -= a; } else { lay(4, n); a = n; }
    // 数据库：超过容量的请求直接超时丢弃（被打爆）；降级后非核心查询少 20%
    const f = p.deg ? 0.8 : 1, proc = Math.min(a, Math.floor(FL.DBCAP / f)), drop = a - proc;
    s.sh.push(s.stock);
    const stale = s.t >= 2 ? s.sh[s.t - 2] : FL.STOCK; // “先查后改”读到的是 2 个 tick（200ms）前的库存
    const ords = p.on[5] ? Math.min(proc, Math.max(0, s.stock)) : stale > 0 ? proc : 0;
    s.stock -= ords; s.orders += ords; s.drop += drop;
    s.L[5].i += proc; s.L[5].o += ords; e.dbIn = a; e.dbDrop = drop;
    s.qps = Math.round(a * f * 10); s.peak = Math.max(s.peak, s.qps);
    s.t++;
    return e;
  }
  const flOver = (s) => Math.max(0, s.orders - FL.STOCK);

  const FL_TXT = ["① 动静分离 + CDN（挡静态页 60%）", "② 前端防刷 / 验证码（滤机器 40%）", "③ 网关限流（令牌桶）", "④ Redis 预扣库存（Lua 原子）", "⑤ MQ 异步削峰（消费 500 单/秒）", "⑥ 扣减方式"];
  const FL_PILL = ["① CDN 动静分离", "② 验证码", "③ 网关限流", "④ Redis 预扣", "⑤ MQ 削峰", "⑥ 原子扣减"];
  const FL_COL = ["var(--ok)", "var(--faint)", "var(--muted)", "var(--mid)", "var(--bad)"]; // 各层拦截点的颜色：CDN 命中绿 / 验证码浅灰 / 限流灰 / 已抢完黄 / MQ 满红

  (window.KD_SIMS = window.KD_SIMS || []).push({
    id: "flash", name: "秒杀漏斗·分流提速减压兜底", tag: "K02 秒杀/高并发", kit: "K02",
    intro: "2025 下半年真题“论秒杀场景及其技术解决方案”和 2026 上半年“论高并发系统的设计与实践”的核心：10 万请求 8 秒涌向 1000 件库存。默认全部关闭（直接怼数据库），逐层打开看 DB 压力和超卖怎么变。",
    model: { flNew, flStep, flDone, flOver, FL_W },
    render() {
      const arc = (a0, a1, col) => { const pt = (a) => [660 + 80 * Math.cos((a * Math.PI) / 180), 150 + 80 * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(1)); return `<path d="M${pt(a0)} A80 80 0 0 1 ${pt(a1)}" style="fill:none;stroke:${col};stroke-width:12;opacity:.85"/>`; };
      const layers = FL_TXT.map((t, i) => {
        const w = 520 - i * 30, x = 270 - w / 2, y = 44 + i * 48;
        return `<g><rect class="sim-flash-lay" id="sim-flash-lay${i}" x="${x}" y="${y}" width="${w}" height="40" rx="8"/>
          <text id="sim-flash-tt${i}" x="${x + 10}" y="${y + 16}" style="font-size:12px;font-weight:600;pointer-events:none">${t}</text>
          <text id="sim-flash-st${i}" x="${x + 10}" y="${y + 32}" style="fill:var(--muted);font-size:10.5px;pointer-events:none">进 0 · 放 0 · 拦 0</text>
          <text id="sim-flash-sw${i}" x="${x + w - 10}" y="${y + 16}" text-anchor="end" style="font-size:11px;fill:var(--faint);pointer-events:none">关</text></g>`;
      }).join("");
      const kpi = (id, label) => `<div><div class="label">${label}</div><div class="v" id="sim-flash-${id}">0</div></div>`;
      return `
      <div class="sim-ctl"><span class="faint">逐层打开</span>${FL_PILL.map((t, i) => `<button class="pill" id="sim-flash-t${i}">${t}</button>`).join("")}</div>
      <div class="sim-ctl">
        <label>网关限流上限 <input type="range" id="sim-flash-lim" min="2000" max="20000" step="1000" value="8000"><b id="sim-flash-limv">8,000</b> 次/秒</label>
        <button id="sim-flash-deg">降级：关评论/推荐</button><button class="ghost" id="sim-flash-all">全开</button><button class="ghost" id="sim-flash-none">全关</button><button class="primary" id="sim-flash-rpl">重放</button></div>
      <svg class="sim-flash-svg" viewBox="0 0 760 420" role="img" aria-label="秒杀漏斗">
        <text id="sim-flash-srct" x="10" y="18" style="font-size:12px">10 万个请求约 8 秒涌入（开抢瞬间最猛）· 库存 1,000 件 · 已涌入 0</text>
        <rect x="10" y="24" width="520" height="6" rx="3" style="fill:var(--fill)"/><rect id="sim-flash-srcb" x="10" y="24" width="0" height="6" rx="3" style="fill:var(--accent)"/>
        ${layers}
        <rect x="170" y="352" width="200" height="58" rx="10" id="sim-flash-dbbox" style="fill:var(--panel);stroke:var(--line);stroke-width:1.5"/>
        <text x="270" y="371" text-anchor="middle" style="font-weight:600">数据库（库存 1,000 件）</text>
        <text id="sim-flash-dbt" x="270" y="388" text-anchor="middle" style="fill:var(--muted);font-size:11px">订单 0 · 库存 1,000</text>
        <text id="sim-flash-dbd" x="270" y="403" text-anchor="middle" style="fill:var(--faint);font-size:11px">超载丢弃 0</text>
        <text x="660" y="36" text-anchor="middle" style="font-weight:600">DB 压力表</text>
        ${arc(180, 243, "var(--ok)")}${arc(243, 270, "var(--mid)")}${arc(270, 360, "var(--bad)")}
        <line class="sim-flash-needle" id="sim-flash-needle" x1="660" y1="150" x2="592" y2="150" style="stroke:var(--text);stroke-width:3;stroke-linecap:round"/><circle cx="660" cy="150" r="6" style="fill:var(--text)"/>
        <text id="sim-flash-qps" x="660" y="182" text-anchor="middle" style="font-size:18px;font-weight:700">0 QPS</text>
        <text x="660" y="199" text-anchor="middle" style="fill:var(--faint);font-size:11px">容量 2,000 QPS（刻度 0–4,000）</text>
        <text id="sim-flash-dbs" x="660" y="222" text-anchor="middle" style="font-size:12px;font-weight:600">数据库平稳</text>
        <text id="sim-flash-over" x="660" y="262" text-anchor="middle" style="font-size:20px;font-weight:700">不超卖</text>
        <text id="sim-flash-ord" x="660" y="284" text-anchor="middle" style="fill:var(--muted);font-size:12px">下单 0 / 库存 1,000</text>
        <text id="sim-flash-dgt" x="660" y="306" text-anchor="middle" style="fill:var(--faint);font-size:11px"></text>
        <g id="sim-flash-dots"></g>
      </svg>
      <div class="faint" style="margin:2px 0 6px">请求点：<span class="sim-flash-lg" style="background:var(--accent);margin-left:2px"></span>正常流动<span class="sim-flash-lg" style="background:var(--ok)"></span>CDN 命中<span class="sim-flash-lg" style="background:var(--faint)"></span>验证码拦截<span class="sim-flash-lg" style="background:var(--muted)"></span>限流“排队中”<span class="sim-flash-lg" style="background:var(--mid)"></span>已抢完<span class="sim-flash-lg" style="background:var(--bad)"></span>MQ 满 / DB 超载丢弃</div>
      <div class="sim-kpi">${kpi("k1", "已涌入")}${kpi("k2", "DB 当前 QPS")}${kpi("k3", "DB 峰值 QPS")}${kpi("k4", "已下单")}${kpi("k5", "超卖（件）")}${kpi("k6", "MQ 积压")}</div>
      <div class="sim-note" id="sim-flash-sum"></div>`;
    },
    mount(root, ctx) {
      const $ = (id) => root.querySelector("#sim-flash-" + id);
      const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
      const dots = mkDots($("dots"), 60), X = 270, Y0 = 34, Y1 = 350;
      let sw = [false, false, false, false, false, false], limit = 8000, deg = false, s = flNew(), acc = 0;
      const txt = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
      const sync = () => {
        sw.forEach((v, i) => { $("t" + i).classList.toggle("on", v); $("lay" + i).classList.toggle("on", v); txt("sw" + i, v ? "开" : "关"); });
        txt("limv", fmt(limit)); txt("tt2", "③ 网关限流（令牌桶 " + fmt(limit) + "/秒）");
        txt("tt5", sw[5] ? "⑥ 扣减：原子 / where stock>0（不超卖）" : "⑥ 扣减：先查后改（会超卖）"); $("deg").classList.toggle("primary", deg);
        txt("deg", deg ? "已降级（DB 负载 -20%）" : "降级：关评论/推荐");
      };
      const restart = () => { s = flNew(); acc = 0; dots.clear(); sync(); };
      sw.forEach((_, i) => { const t = () => { sw[i] = !sw[i]; restart(); }; on("t" + i, "click", t); on("lay" + i, "click", t); });
      on("lim", "input", (e) => { limit = +e.target.value; txt("limv", fmt(limit)); txt("tt2", "③ 网关限流（令牌桶 " + fmt(limit) + "/秒）"); });
      on("lim", "change", restart);
      on("deg", "click", () => { deg = !deg; sync(); }); // 降级是过载时的现场操作：不重放
      on("all", "click", () => { sw = sw.map(() => true); restart(); }); on("none", "click", () => { sw = sw.map(() => false); restart(); });
      on("rpl", "click", restart);

      const spawn = (e) => {
        const k = Math.min(5, Math.ceil(e.in[0] / 600));
        for (let d = 0; d < k; d++) {
          let hit = -1;
          for (let i = 0; i < 5 && hit < 0; i++) if (e.in[i] > 0 && Math.random() * e.in[i] >= e.out[i]) hit = i;
          if (hit < 0 && e.dbIn > 0 && Math.random() * e.dbIn < e.dbDrop) hit = 5;
          const x = X + (Math.random() - 0.5) * 300, ly = (i) => 44 + i * 48 + 20;
          const stopY = hit < 0 ? Y1 + 12 : hit === 5 ? Y1 : ly(hit), side = Math.random() < 0.5 ? -1 : 1;
          dots.add([[x, Y0], [x, stopY]], { c: hit < 0 ? "var(--accent)" : hit === 5 ? "var(--bad)" : FL_COL[hit], ms: 300 + (stopY - Y0) * 3.4, r: 3, fx: hit < 0 ? 0 : side * (28 + Math.random() * 30), fy: hit < 0 ? 0 : -10 - Math.random() * 12 });
        }
      };
      const paint = () => {
        const done = flDone(s), over = flOver(s), on6 = sw.filter(Boolean).length, over100 = s.peak > 2000, showQ = done ? s.peak : s.qps;
        s.L.forEach((l, i) => {
          txt("st" + i, i === 5 ? `DB 处理 ${fmt(l.i)} · 成单 ${fmt(l.o)} · 库存不足 ${fmt(l.i - l.o)}` : `进 ${fmt(l.i)} · 放 ${fmt(l.o)} · 拦 ${fmt(l.i - l.o)}`);
        });
        txt("srct", `10 万个请求约 8 秒涌入（开抢瞬间最猛）· 库存 1,000 件 · 已涌入 ${fmt(s.arrived)}${done ? "（已结束）" : ""}`);
        $("srcb").setAttribute("width", (520 * s.arrived) / FL.TOTAL);
        $("needle").style.transform = "rotate(" + (180 * clamp(showQ / 4000, 0, 1)).toFixed(1) + "deg)";
        txt("qps", fmt(showQ) + " QPS" + (done ? "（峰值）" : "")); $("qps").style.fill = showQ > 2000 ? "var(--bad)" : showQ > 1400 ? "var(--mid)" : "var(--ok)";
        const boom = s.qps > 2000 && !done;
        txt("dbs", boom ? "数据库被打爆 / 服务雪崩" : over100 ? "曾被打爆 · 现已恢复" : "数据库平稳"); $("dbs").style.fill = boom || over100 ? "var(--bad)" : "var(--ok)";
        $("dbbox").style.stroke = boom ? "var(--bad)" : "var(--line)"; $("dbbox").style.strokeWidth = boom ? 3 : 1.5;
        txt("over", over > 0 ? "超卖 " + fmt(over) + " 件" : done || s.orders >= FL.STOCK ? "不超卖" : "暂未超卖"); $("over").style.fill = over > 0 ? "var(--bad)" : "var(--ok)";
        txt("ord", `下单 ${fmt(s.orders)} / 库存 ${fmt(FL.STOCK)}`);
        txt("dbt", `订单 ${fmt(s.orders)} · 库存 ${fmt(s.stock)}`); txt("dbd", `超载丢弃 ${fmt(s.drop)}`); $("dbd").style.fill = s.drop ? "var(--bad)" : "var(--faint)";
        txt("dgt", deg ? "降级中：评论/推荐已关闭" : "");
        txt("k1", fmt(s.arrived)); txt("k2", fmt(s.qps)); txt("k3", fmt(s.peak)); txt("k4", fmt(s.orders)); txt("k5", fmt(over)); txt("k6", fmt(s.mq));
        $("k2").className = "v " + (s.qps > 2000 ? "bad" : ""); $("k3").className = "v " + (over100 ? "bad" : "ok"); $("k5").className = "v " + (over > 0 ? "bad" : "ok");
        const okOrders = s.orders <= FL.STOCK;
        let tip;
        if (over > 0) tip = "出现超卖：先查后改在高并发下读到的是过期库存。打开 ④ Redis 预扣，或把 ⑥ 切成原子扣减。";
        else if (over100) tip = "DB 被打爆" + (done && s.orders < FL.STOCK ? "，超载丢单导致只成交 " + fmt(s.orders) + " 件（少卖）" : "") + "：缺少削峰——前面几层把量挡掉，再用 ⑤ MQ 把瞬时压力压到 500/s 以内；过载时可点“降级”先关评论/推荐。";
        else if (on6 === 0) tip = "全部关闭：10 万请求直接打 DB——点上面的开关，逐层打开看变化。";
        else tip = "DB 平稳、没有超卖：分流（CDN/验证码/限流）→ 提速（Redis 预扣）→ 减压（MQ 削峰）→ 兜底（降级/已抢完）。";
        const sm = $("sum"), msg = `开关组合小结：已打开 ${on6}/6 层 · DB 峰值 ${fmt(s.peak)} QPS（容量 2,000，${over100 ? "已爆表" : "未超载"}）· ${over > 0 ? "超卖 " + fmt(over) + " 件" : "不超卖"} · 下单成功 ${fmt(s.orders)} 件 ${okOrders ? "≤" : ">"} 库存 1,000 ${okOrders ? "✓" : "✗"}${done ? "" : "（进行中…）"}。${tip}`;
        if (sm.textContent !== msg) sm.textContent = msg; sm.className = "sim-note " + (over > 0 || over100 ? "bad" : on6 ? "ok" : "");
      };
      sync(); paint();
      ctx.every(() => {
        acc += 50;
        if (acc >= 100) { acc -= 100; if (!flDone(s)) spawn(flStep(s, { on: sw, limit, deg })); }
        dots.step(50); paint();
      }, 50);
    },
    say: [
      "秒杀四字诀“分流—提速—减压—兜底”：分流=CDN/动静分离、验证码、网关限流；提速=多级缓存、Redis 预热 + 预扣库存；减压=MQ 削峰、异步下单、分库分表与读写分离；兜底=服务降级、熔断、排队页/“已抢完”页。",
      "超卖靠 Redis Lua 原子扣减或数据库条件更新（update stock set n=n-1 where stock>0）保证，不靠“先查后改”；漏斗越往下量越小，数据库只承受它扛得住的那一点（如 500 单/秒）。",
      "缓存三兄弟：穿透→布隆过滤器/缓存空值；击穿→互斥锁/逻辑过期；雪崩→过期时间加随机值、多级缓存、限流降级。",
      "论文写法：先用一组数字交代场景（10 万请求/1000 库存/DB 容量 2000 QPS），再按“请求从上往下流”的顺序逐层写，并点明各层如何协同——扩容只是兜底，真正的主力是动静分离、缓存、限流与降级。"
    ],
    cards: ["a33", "a11", "a34", "a12"]
  });
})();
