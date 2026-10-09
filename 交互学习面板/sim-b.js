// 动画剧场 B 组：分布式事务、负载均衡 + 一致性哈希、CAP 分区实验、Lambda vs Kappa、六边形架构
// 结构：① 纯逻辑 L（事务状态机 / 负载均衡选择 / 一致性哈希，node 里 require 本文件即可测）
//       ② 公共小工具（Flyer：沿路径飞行的小圆点）③ 五个动画（render + mount）
(function () {
  "use strict";
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (r, s) => r.querySelector(s);
  const $$ = (r, s) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const M32 = 4294967296;
  const L = {};

  // =====================================================================
  // ① 纯逻辑
  // =====================================================================
  L.fnv = function (s) { // FNV-1a + 终混淆，输出 32 位无符号整数
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  };
  // 一致性哈希环：每个节点 1 个点，或开启虚拟节点后 20 个点；按位置排序
  // RING_SALT / 演示 key 的盐是固定值，只用来让「24 个演示 key」的分布有代表性（无虚拟节点倾斜、有虚拟节点均匀）
  const RING_SALT = "6";
  L.buildRing = function (nodes, vn) {
    const r = [];
    nodes.forEach((n) => { for (let i = 0; i < (vn ? 20 : 1); i++) r.push({ pos: L.fnv(RING_SALT + (vn ? n + "#" + i : n)), node: n }); });
    return r.sort((a, b) => a.pos - b.pos);
  };
  L.demoKey = (i) => L.fnv("fkey-" + i); // i = 1..24
  L.ringOwner = function (ring, h) { // 顺时针第一个 pos >= h 的点，走到头回绕
    let lo = 0, hi = ring.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (ring[m].pos < h) lo = m + 1; else hi = m; }
    return ring[lo % ring.length].node;
  };
  L.modOwner = (nodes, h) => nodes[h % nodes.length];
  L.arcShare = function (ring) { // 每个节点拥有的环上弧长占比
    const o = {};
    ring.forEach((e, i) => {
      const prev = ring[(i + ring.length - 1) % ring.length].pos;
      const len = ring.length === 1 ? M32 : (e.pos - prev + M32) % M32;
      o[e.node] = (o[e.node] || 0) + len / M32;
    });
    return o;
  };
  // 节点集合从 A 变成 B 后，hs 里有多少个 key 的归属节点变了（一致性哈希 vs 取模）
  L.migrate = function (hs, A, B) {
    const ra = L.buildRing(A.nodes, A.vn), rb = L.buildRing(B.nodes, B.vn);
    let ch = 0, mod = 0;
    hs.forEach((h) => {
      if (L.ringOwner(ra, h) !== L.ringOwner(rb, h)) ch++;
      if (L.modOwner(A.nodes, h) !== L.modOwner(B.nodes, h)) mod++;
    });
    return { n: hs.length, ch, mod };
  };

  // 负载均衡选择。S: [{w, up, act:[], cap}]；st: 算法的内部状态（轮询指针、平滑加权累计值、环、随机数）
  L.lbState = (names, rnd) => ({ rr: 0, cw: names.map(() => 0), names, ring: L.buildRing(names, true), rnd: rnd || Math.random });
  L.lbPick = function (alg, st, S, ip) {
    const n = S.length;
    if (alg === "rr") return st.rr++ % n;
    if (alg === "wrr") { // 平滑加权轮询：每轮 cw += w，选最大的，再减去总权重
      let tot = 0, b = 0;
      S.forEach((s, i) => { st.cw[i] += s.w; tot += s.w; if (st.cw[i] > st.cw[b]) b = i; });
      st.cw[b] -= tot;
      return b;
    }
    if (alg === "rand") return Math.floor(st.rnd() * n);
    if (alg === "hash") return L.fnv(ip) % n;
    if (alg === "ch") return st.names.indexOf(L.ringOwner(st.ring, L.fnv(ip)));
    // least：动态算法，只看存活节点，选「连接数 / 权重」最小的
    let best = -1, bv = Infinity;
    S.forEach((s, i) => { if (!s.up) return; const v = s.act.length / s.w; if (v < bv) { bv = v; best = i; } });
    return best;
  };

  // ---- 分布式事务状态机：每个方案返回「步骤数组」，步骤 = {note, tone, msgs:[[from,to,label,tone,delay]], st:{角色:[状态,色调,是否持锁]}} ----
  const PART = ["O", "I", "P"], PN = { O: "订单服务", I: "库存服务", P: "支付服务" };
  const nm = (ks) => ks.map((k) => PN[k]).join("、");
  const failedOf = (o) => PART.filter((k) => o["fail" + k]);
  const allSt = (ks, f) => Object.assign({}, ...ks.map((k) => ({ [k]: f(k) })));

  L.plan2pc = function (o) {
    const bad = failedOf(o), ys = PART.filter((k) => !bad.includes(k)), S = [];
    S.push({ note: "【阶段一·准备】协调者向所有参与者发 Prepare：各自执行本地事务但先不提交，锁住资源、写 undo/redo 日志。", msgs: PART.map((k) => ["C", k, "Prepare"]), st: Object.assign({ C: ["等待投票", "mid"] }, allSt(PART, () => ["执行并锁资源", "mid", 1])) });
    S.push({
      note: bad.length ? `${nm(bad)}回复 No（执行失败），其余回复 Yes 并停在 Prepared。只要有一个 No，全局事务就必须回滚。` : "全部回复 Yes，都停在 Prepared：日志已落盘、锁仍持有，既能提交也能回滚。",
      tone: bad.length ? "bad" : "", msgs: PART.map((k) => [k, "C", bad.includes(k) ? "No" : "Yes", bad.includes(k) ? "bad" : ""]),
      st: Object.assign({ C: ["收齐投票", "mid"] }, allSt(PART, (k) => bad.includes(k) ? ["No·本地回滚", "bad", 0] : ["Prepared", "mid", 1]))
    });
    if (o.crash) {
      S.push({ note: "【阶段二】协调者在发出决定前宕机！已 Prepared 的参与者既不敢自己提交（别人可能失败），也不敢回滚（别人可能已被通知提交），只能持锁死等 → 同步阻塞 + 协调者单点。", tone: "bad", msgs: [], st: { C: ["宕机 ✕", "bad"] } });
      S.push({ note: "3PC 为缓解阻塞：在 2PC 前增加 CanCommit 询问阶段，并给协调者和参与者引入超时机制（超时后不再无限等待）。但仍不能完全避免不一致（如网络分区时），且多一轮交互、网络开销更大；所以互联网场景更多用 TCC、Saga、可靠消息。", tone: "bad", msgs: [], st: {} });
    } else if (bad.length) {
      S.push({ note: "【阶段二·回滚】协调者通知已 Prepared 的参与者 Rollback，利用 undo 日志撤销并释放锁。", tone: "bad", msgs: ys.map((k) => ["C", k, "Rollback", "bad"]), st: Object.assign({ C: ["决定 Rollback", "bad"] }, allSt(ys, () => ["已回滚", "bad", 0])) });
      S.push({ note: "全部回滚完成，订单、库存、支付都回到下单前的状态（原子性）。", msgs: ys.map((k) => [k, "C", "Ack"]), st: { C: ["全局回滚结束", "bad"] } });
    } else {
      S.push({ note: "【阶段二·提交】全部 Yes，协调者统一发 Commit，参与者提交并释放锁。", tone: "ok", msgs: PART.map((k) => ["C", k, "Commit", "ok"]), st: Object.assign({ C: ["决定 Commit", "ok"] }, allSt(PART, () => ["已提交", "ok", 0])) });
      S.push({ note: "参与者回复 Ack，全局事务结束。强一致，但从 Prepare 到 Commit 全程持锁、吞吐低，只适合短事务。", tone: "ok", msgs: PART.map((k) => [k, "C", "Ack"]), st: { C: ["事务结束", "ok"] } });
    }
    return S;
  };

  L.planTcc = function (o) {
    const bad = failedOf(o), S = [];
    S.push({ note: "【Try】各服务在业务层预留资源（冻结库存、冻结额度、订单置为待确认），并不长期占用数据库锁。", msgs: PART.map((k) => ["C", k, "Try"]), st: Object.assign({ C: ["Try 阶段", "mid"] }, allSt(PART, (k) => bad.includes(k) ? ["Try 失败", "bad"] : ["已冻结 Try", "mid"])) });
    S.push({ note: bad.length ? `${nm(bad)} Try 失败（如库存不足）。只要有一个 Try 失败，就不能 Confirm，必须对所有参与者 Cancel。` : "三个 Try 都成功，资源都已预留好。", tone: bad.length ? "bad" : "", msgs: PART.map((k) => [k, "C", bad.includes(k) ? "失败" : "成功", bad.includes(k) ? "bad" : ""]), st: { C: [bad.length ? "有 Try 失败" : "Try 全部成功", bad.length ? "bad" : "ok"] } });
    if (bad.length) {
      S.push({ note: "【Cancel】协调者通知所有参与者 Cancel：已冻结的释放资源；Try 失败的那个服务收到 Cancel 要做「空回滚」（没预留过也要安全返回）。", tone: "bad", msgs: PART.map((k) => ["C", k, "Cancel", "bad"]), st: Object.assign({ C: ["决定 Cancel", "bad"] }, allSt(PART, (k) => bad.includes(k) ? ["Cancel·空回滚", "bad"] : ["已取消 Cancel", "bad"])) });
      S.push({ note: "TCC 要处理三类异常：空回滚（Try 没成功却收到 Cancel）、悬挂（Cancel 先于 Try 到达，之后 Try 又到了，必须拒绝）、幂等（Confirm / Cancel 可能被重复调用）。每个服务都要自写 Try/Confirm/Cancel 三个接口，侵入性强。", tone: "bad", msgs: [], st: {} });
    } else {
      S.push({ note: "【Confirm】协调者通知各服务 Confirm：用冻结的资源完成真正的业务操作（扣库存、扣款、订单生效）。", tone: "ok", msgs: PART.map((k) => ["C", k, "Confirm", "ok"]), st: Object.assign({ C: ["决定 Confirm", "ok"] }, allSt(PART, () => ["已确认 Confirm", "ok"])) });
      S.push({ note: "最终一致：Confirm / Cancel 必须幂等、可重试；没有长时间的数据库锁，但每个服务都要自写 Try/Confirm/Cancel 三个接口，侵入性强。", tone: "ok", msgs: [], st: { C: ["事务结束", "ok"] } });
    }
    return S;
  };

  L.planSaga = function (o) {
    const TN = { O: ["T1 创建订单", "C1 取消订单"], I: ["T2 扣减库存", "C2 恢复库存"], P: ["T3 支付扣款", "C3 退款"] };
    const S = [], done = [];
    let ff = null;
    PART.forEach((k, i) => {
      if (ff) return;
      const lab = "T" + (i + 1);
      if (o["fail" + k]) {
        ff = k;
        S.push({ note: `${TN[k][0]}失败：本地事务自行回滚，Saga 不再向前，开始反向补偿已完成的步骤。`, tone: "bad", msgs: [["C", k, lab], [k, "C", "失败", "bad", 650]], st: { [k]: ["失败·本地回滚", "bad"] } });
      } else {
        done.push(k);
        S.push({ note: `${TN[k][0]}：本地事务直接提交（不持有跨服务的锁）。${i === 0 ? "此时订单已对外可见，但整个流程还没结束 → Saga 不隔离，别人能读到中间状态。" : ""}`, msgs: [["C", k, lab], [k, "C", "成功", "ok", 650]], st: { [k]: ["已提交 " + lab, "ok"] } });
      }
    });
    if (ff) {
      done.slice().reverse().forEach((k) => {
        const i = PART.indexOf(k) + 1;
        S.push({ note: `补偿：执行 ${TN[k][1]}，按与正向相反的顺序，抵消 T${i} 的效果。`, tone: "bad", msgs: [["C", k, "C" + i, "bad"], [k, "C", "完成", "", 650]], st: { [k]: ["已补偿 C" + i, "bad"] } });
      });
      S.push({ note: "补偿完毕，业务回到下单前（最终一致）。补偿事务要自己写，且必须幂等、可重试；补偿前别人可能读到过中间状态。", tone: "bad", msgs: [], st: { C: ["已全部补偿", "bad"] } });
    } else {
      S.push({ note: "三步全部成功，Saga 结束。适合长流程、跨系统的长事务；代价是补偿逻辑要自己写、不隔离。", tone: "ok", msgs: [], st: { C: ["事务完成", "ok"] } });
    }
    return S;
  };

  L.planMsg = function (o) {
    const S = [];
    S.push({ note: "① 订单服务开一个本地事务：同一事务里既写订单（业务表），又写一条「待发送」消息到消息表。本地事务保证两者要么同时成功，要么同时失败。", msgs: [["O", "T", "同事务写入"]], st: { O: ["订单已创建", "ok"], T: ["待发送", "mid"] } });
    S.push({ note: "② 投递任务（定时扫描，或监听事务提交）读取消息表里待发送的消息。", msgs: [["T", "R", "读取待发送"]], st: { R: ["取到消息", "mid"] } });
    S.push({ note: "③ 把消息投递到 MQ。若这一步失败，消息还躺在消息表里，下次扫描会再投 → 不丢消息。", msgs: [["R", "Q", "msg#1001"]], st: { Q: ["消息已入队", "mid"], R: ["已投递", "ok"] } });
    S.push({
      note: o.failI ? "④ 库存服务故障：消费失败。订单的本地事务早已提交，不回滚；消息没有被确认，会被重新投递。" : "④ 下游消费：库存、支付各自消费消息，先用消息 ID（幂等键）判断是否处理过，再执行业务。",
      tone: o.failI ? "bad" : "", msgs: [["Q", "I", "投递"], ["Q", "P", "投递"]],
      st: { I: o.failI ? ["消费失败", "bad"] : ["已扣减库存", "ok"], P: ["已发起支付", "ok"], T: o.failI ? ["重试中", "mid"] : ["待发送", "mid"] }
    });
    if (o.failI) S.push({ note: "⑤ 库存服务恢复，重试投递成功 → 最终一致。「失败重试 + 消费端幂等」是可靠消息的核心。", tone: "ok", msgs: [["Q", "I", "重试投递", "mid"]], st: { I: ["重试成功·已扣减", "ok"] } });
    if (o.dup) S.push({ note: "MQ 通常「至少投递一次」，可能重复：消费者用幂等键（消息 ID / 业务单号，唯一索引）发现已处理，直接丢弃，库存只扣一次。", tone: "ok", msgs: [["Q", "I", "重复投递", "bad"]], st: { I: ["已扣减·丢弃重复", "ok"] } });
    S.push({ note: "消费者处理完成后向 MQ 回 Ack。", msgs: [["I", "Q", "Ack"], ["P", "Q", "Ack"]], st: { Q: ["已全部确认", "ok"] } });
    S.push({ note: "最后把消息表里这条消息更新为「已完成」。最终一致：订单、库存、支付都成功；关键是三点——本地事务写消息、失败可重试、消费端幂等。", tone: "ok", msgs: [["Q", "R", "确认"], ["R", "T", "更新为已完成", "", 700]], st: { R: ["任务结束", "ok"], T: ["已完成", "ok"] } });
    return S;
  };
  L.finalStates = (steps) => steps.reduce((m, s) => Object.assign(m, s.st), {});

  if (typeof module !== "undefined" && module.exports) module.exports = L;
  if (typeof window === "undefined" || typeof document === "undefined") return; // 在 node 里只导出 L

  // =====================================================================
  // ② 公共：样式 + 飞行小圆点
  // =====================================================================
  const PRE = ["txn", "lb", "cap", "lam", "hex"];
  const tagCss = (p) => `.sim-${p}-tg rect{fill:var(--fill);stroke:var(--line)}.sim-${p}-tg text{font-size:12px;text-anchor:middle;fill:var(--muted)}` +
    ["ok", "mid", "bad"].map((t) => `.sim-${p}-tg.${t} rect{fill:color-mix(in srgb,var(--${t}) 15%,transparent);stroke:var(--${t})}.sim-${p}-tg.${t} text{fill:var(--${t})}`).join("");
  if (!document.getElementById("kd-sim-b-style")) {
    const st = document.createElement("style");
    st.id = "kd-sim-b-style";
    st.textContent = PRE.map((p) => `.sim-${p}-fly{fill:var(--accent);stroke:var(--panel);stroke-width:1.2}.sim-${p}-fly.ok{fill:var(--ok)}.sim-${p}-fly.bad{fill:var(--bad)}.sim-${p}-fly.mid{fill:var(--mid)}` +
      `.sim-${p}-flyt{font-size:11px;fill:var(--muted);text-anchor:middle;paint-order:stroke;stroke:var(--panel);stroke-width:3px}`).join("") +
      tagCss("txn") + tagCss("cap") + tagCss("lam") + `
      .sim-ctl input[type=checkbox],.sim-ctl input[type=radio]{width:auto}
      .sim-ctl select{max-width:200px}
      .sim-txn-cmp{font-size:12.5px;min-width:700px}.sim-txn-cmp tr.hi td{background:var(--accent-soft)}
      .sim-txn-cmp tr.pick td{background:color-mix(in srgb,var(--ok) 14%,transparent);font-weight:600}
      .sim-lb-sv.down rect.box{stroke:var(--bad);stroke-dasharray:4 3}.sim-lb-sv.slow rect.box{stroke:var(--mid)}.sim-lb-sv{cursor:pointer}
      .sim-lb-mig{animation:sim-lb-pulse 1s ease-in-out infinite}@keyframes sim-lb-pulse{50%{opacity:.35}}
      .sim-lb-tbl td,.sim-lb-tbl th{font-size:12.5px}
      .sim-cap-chips{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
      .sim-cap-chip{padding:2px 12px;border-radius:999px;font-size:13px;border:1px solid var(--line);background:var(--fill);color:var(--muted)}
      .sim-cap-chip.ok{border-color:var(--ok);color:var(--ok)}.sim-cap-chip.bad{border-color:var(--bad);color:var(--bad)}.sim-cap-chip.mid{border-color:var(--mid);color:var(--mid)}
      .sim-cap-q{display:grid;grid-template-columns:150px auto 1fr;gap:6px 12px;align-items:start;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13px}
      .sim-cap-q button.on-ok{border-color:var(--ok);background:color-mix(in srgb,var(--ok) 15%,transparent)}
      .sim-cap-q button.on-bad{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 15%,transparent)}
      .sim-cap-q button.on-mid{border-color:var(--mid);background:color-mix(in srgb,var(--mid) 15%,transparent)}
      @media(max-width:760px){.sim-cap-q{grid-template-columns:1fr}}
      .sim-lam-sq{fill:var(--accent);opacity:.85}
      .sim-lam-duty{background:var(--fill);border-radius:8px;padding:8px 10px;font-size:13px}.sim-lam-duty b{display:block;margin-bottom:2px}
      .sim-hex-ad{cursor:pointer}.sim-hex-ad:hover rect.box{stroke:var(--accent)}
      .sim-hex-ad.chg rect.box{stroke:var(--accent);stroke-width:2}.sim-hex-ad.mock rect.box{stroke:var(--mid);stroke-width:2}
      .sim-hex-ad.pulse rect.box{animation:sim-hex-pulse .6s ease-in-out 3}@keyframes sim-hex-pulse{50%{opacity:.4}}
      .sim-hex-core{fill:var(--accent-soft);stroke:var(--accent);stroke-width:2}.sim-hex-core.bad{fill:color-mix(in srgb,var(--bad) 14%,transparent);stroke:var(--bad)}
      .sim-hex-port{fill:var(--panel);stroke:var(--accent);stroke-width:1.5}.sim-hex-anti .sim-hex-port{stroke:var(--faint)}
      .sim-hex-t{display:inline-block;padding:2px 10px;margin:3px 6px 3px 0;border-radius:6px;border:1px solid var(--line);background:var(--fill);font-size:12.5px;color:var(--muted)}
      .sim-hex-t.ok{border-color:var(--ok);color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent)}
      .sim-hex-t.bad{border-color:var(--bad);color:var(--bad);background:color-mix(in srgb,var(--bad) 12%,transparent)}`;
    document.head.appendChild(st);
  }

  // 沿折线飞行的小圆点（或小方块）。tick(dt) 里推进；done 返回 true 且设了 hold 时在终点停留 hold 毫秒。
  function Flyer(svg, pre, max) {
    const list = [];
    max = max || 50;
    function put(f) {
      let d = f.len * clamp(f.t / f.dur, 0, 1), i = 0;
      while (i < f.seg.length - 1 && d > f.seg[i]) { d -= f.seg[i]; i++; }
      const a = f.pts[i], b = f.pts[i + 1] || a, u = f.seg[i] ? d / f.seg[i] : 1;
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
      if (f.rect) { f.el.setAttribute("x", x - 4.5); f.el.setAttribute("y", y - 4.5); } else { f.el.setAttribute("cx", x); f.el.setAttribute("cy", y); }
      if (f.tx) { f.tx.setAttribute("x", x); f.tx.setAttribute("y", y - 9); }
    }
    const drop = (f) => { f.el.remove(); if (f.tx) f.tx.remove(); const i = list.indexOf(f); if (i >= 0) list.splice(i, 1); };
    return {
      get n() { return list.length; },
      fly(pts, o) {
        o = o || {};
        if (list.length >= max) { if (o.done) o.done(null); return false; }
        const seg = []; let len = 0;
        for (let i = 0; i < pts.length - 1; i++) { const s = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(s); len += s; }
        const el = document.createElementNS(SVGNS, o.rect ? "rect" : "circle");
        if (o.rect) { el.setAttribute("width", 9); el.setAttribute("height", 9); el.setAttribute("rx", 2); } else el.setAttribute("r", o.r || 5);
        el.setAttribute("class", `sim-${pre}-fly ${o.cls || ""}`);
        svg.appendChild(el);
        let tx = null;
        if (o.label) { tx = document.createElementNS(SVGNS, "text"); tx.setAttribute("class", `sim-${pre}-flyt`); tx.textContent = o.label; svg.appendChild(tx); }
        const f = { el, tx, pts, seg, len: len || 1, dur: o.dur || 700, t: -(o.delay || 0), done: o.done, hold: o.hold || 0, h: 0, arr: false, rect: !!o.rect };
        if (f.t < 0) { el.style.visibility = "hidden"; if (tx) tx.style.visibility = "hidden"; }
        put(f); list.push(f);
        return true;
      },
      tick(dt) {
        list.slice().forEach((f) => {
          if (f.arr) { f.h += dt; if (f.h >= f.hold) drop(f); return; }
          const was = f.t < 0;
          f.t += dt;
          if (f.t < 0) return;
          if (was) { f.el.style.visibility = ""; if (f.tx) f.tx.style.visibility = ""; }
          put(f);
          if (f.t >= f.dur) {
            f.arr = true;
            const keep = f.done ? f.done(f.el) : false;
            if (!(keep && f.hold)) drop(f);
          }
        });
      },
      finishAll() { list.slice().forEach((f) => { if (!f.arr) { f.arr = true; if (f.done) f.done(f.el); } drop(f); }); },
      clear() { list.slice().forEach(drop); }
    };
  }
  const reg = (s) => (window.KD_SIMS = window.KD_SIMS || []).push(s);
  const join = (n, fn) => { let c = n; return () => { if (--c <= 0) fn(); }; }; // n 件事都完成后调用 fn
  const setTxt = (root, sel, t) => { const e = $(root, sel); if (e) e.textContent = t; };

  // =====================================================================
  // ③-1 分布式事务·四种方案
  // =====================================================================
  const TXN = {
    "2pc": { n: "2PC 两阶段提交", plan: L.plan2pc, cn: "协调者", lay: "co", desc: "两阶段提交：准备（锁资源、写 undo/redo、回复 Yes/No）→ 提交（协调者统一 Commit / Rollback）。强一致，但同步阻塞、协调者单点。" },
    tcc: { n: "TCC", plan: L.planTcc, cn: "TCC 事务管理器", lay: "co", desc: "TCC：Try（预留/冻结资源）→ 全部成功则 Confirm，任一失败则 Cancel。无长事务锁，但业务要自己写 Try / Confirm / Cancel 三个接口，侵入性强。" },
    saga: { n: "Saga", plan: L.planSaga, cn: "Saga 编排器", lay: "co", desc: "Saga：按序执行本地事务，每一步配一个补偿事务，失败时反向依次补偿。适合长事务，最终一致，但不隔离（能读到中间状态）。" },
    msg: { n: "本地消息表 + MQ", plan: L.planMsg, lay: "msg", desc: "本地消息表 + MQ（可靠消息最终一致）：本地事务内同时写业务表和消息表 → 投递到 MQ → 下游幂等消费 → 更新消息状态；失败重试。" }
  };
  const TXN_LAY = {
    co: { act: { C: { x: 380, y: 45, w: 180, h: 60 }, O: { x: 130, y: 190, w: 150, h: 60, n: "订单服务" }, I: { x: 380, y: 190, w: 150, h: 60, n: "库存服务" }, P: { x: 630, y: 190, w: 150, h: 60, n: "支付服务" } }, edges: [["C", "O"], ["C", "I"], ["C", "P"]] },
    msg: { act: { O: { x: 95, y: 65, w: 150, h: 60, n: "订单服务·业务表" }, T: { x: 95, y: 195, w: 150, h: 60, n: "消息表" }, R: { x: 295, y: 130, w: 130, h: 60, n: "投递任务" }, Q: { x: 470, y: 130, w: 110, h: 60, n: "MQ" }, I: { x: 665, y: 65, w: 150, h: 60, n: "库存消费者" }, P: { x: 665, y: 195, w: 150, h: 60, n: "支付消费者" } }, edges: [["O", "T"], ["T", "R"], ["R", "Q"], ["Q", "I"], ["Q", "P"]] }
  };
  const TXN_ROWS = [
    ["2pc", "2PC / XA", "强一致", "同步阻塞：Prepare 起持锁到 Commit；协调者单点", "低（数据库 / 中间件层面，业务基本无感）", "Seata XA、数据库 XA", "短事务、并发不高、必须强一致（如核心账务）"],
    ["tcc", "TCC", "最终一致", "无长事务锁；资源在业务层预留（冻结）", "高（每个服务自写 Try/Confirm/Cancel，处理空回滚、悬挂、幂等）", "Seata TCC", "需要预留资源的交易类场景（冻结库存 / 额度）"],
    ["saga", "Saga", "最终一致", "无全局锁，适合长流程；不隔离，会读到中间状态", "中高（每步的补偿事务要自己写）", "Seata Saga", "步骤多、周期长的长流程业务"],
    ["msg", "本地消息表 / 事务消息", "最终一致", "异步解耦、吞吐高，无跨服务锁；有延迟", "低（加一张消息表，或用 MQ 事务消息）", "RocketMQ 事务消息、自建本地消息表", "允许延迟、下游只要「最终成功」的通知 / 出证类链路"]
  ];

  reg({
    id: "txn", name: "分布式事务·四种方案", tag: "K04 K05", kit: "K04",
    intro: "2024 下半年真题「论分布式事务及其解决方案」：同一个「下单」场景（订单 / 库存 / 支付），分步看 2PC、TCC、Saga、本地消息表怎么保证一致，再注入故障看各自的代价。",
    render() {
      const tabs = Object.keys(TXN).map((k, i) => `<button class="pill sim-txn-tab${i ? "" : " on"}" data-t="${k}">${TXN[k].n}</button>`).join("");
      const rows = TXN_ROWS.map((r) => `<tr data-r="${r[0]}">${r.slice(1).map((c, i) => `<td${i ? "" : " style=\"font-weight:600\""}>${c}</td>`).join("")}</tr>`).join("");
      return `<div class="row" style="margin-bottom:6px">${tabs}</div>
        <p class="muted" id="sim-txn-desc" style="min-height:44px"></p>
        <div class="sim-ctl">
          <button class="primary" id="sim-txn-next">下一步</button><button id="sim-txn-auto">自动播放</button><button id="sim-txn-reset">重置</button>
          <label><input type="checkbox" id="sim-txn-fi">库存服务失败</label>
          <label id="sim-txn-lp"><input type="checkbox" id="sim-txn-fp">支付服务失败</label>
          <label id="sim-txn-lc"><input type="checkbox" id="sim-txn-cr">协调者在第二阶段宕机</label>
          <label id="sim-txn-ld" style="display:none"><input type="checkbox" id="sim-txn-du">MQ 消息重复投递</label>
          <span class="faint" id="sim-txn-pos"></span>
        </div>
        <svg id="sim-txn-svg" viewBox="0 0 760 250" width="100%" role="img" aria-label="分布式事务动画"></svg>
        <div class="sim-note" id="sim-txn-note"></div>
        <div style="overflow-x:auto;margin-top:12px"><table class="sim-txn-cmp"><thead><tr><th>方案</th><th>一致性强度</th><th>性能 / 锁</th><th>业务侵入</th><th>典型框架或做法</th><th>适用场景</th></tr></thead><tbody>${rows}
          <tr class="pick"><td colspan="6">本项目选择：同一服务内一律用本地事务（强一致）；跨服务只有出证 / 通知这类允许最终一致的链路，采用本地消息表 + 幂等，不做 2PC / TCC。</td></tr></tbody></table></div>`;
    },
    mount(root, ctx) {
      const g = (s) => $(root, "#sim-txn-" + s);
      const svg = g("svg"), note = g("note"), nextB = g("next"), autoB = g("auto");
      const fl = Flyer(svg, "txn");
      const chk = { fi: g("fi"), fp: g("fp"), cr: g("cr"), du: g("du") };
      let tab = "2pc", steps = [], idx = -1, busy = false, auto = false, cool = 0, act = {};

      function setSt(k, s) {
        const t = $(svg, "#sim-txn-t-" + k);
        if (!t) return;
        t.setAttribute("class", "sim-txn-tg " + (s[1] || ""));
        $(t, "text").textContent = s[0];
        const lk = $(svg, "#sim-txn-k-" + k);
        if (lk) lk.style.display = s[2] ? "" : "none";
      }
      function scene() {
        fl.clear();
        const T = TXN[tab], lay = TXN_LAY[T.lay];
        act = lay.act;
        svg.innerHTML = lay.edges.map(([a, b]) => `<line class="flow" x1="${act[a].x}" y1="${act[a].y}" x2="${act[b].x}" y2="${act[b].y}"/>`).join("") +
          Object.keys(act).map((k) => {
            const a = act[k], x = a.x - a.w / 2, y = a.y - a.h / 2;
            return `<g><rect class="box" x="${x}" y="${y}" width="${a.w}" height="${a.h}" rx="8"/><text x="${a.x}" y="${y + 19}" text-anchor="middle" style="font-weight:600">${k === "C" ? T.cn : a.n}</text>` +
              `<g class="sim-txn-tg" id="sim-txn-t-${k}"><rect x="${x + 8}" y="${y + 29}" width="${a.w - 16}" height="22" rx="11"/><text x="${a.x}" y="${y + 44}">待命</text></g>` +
              `<g id="sim-txn-k-${k}" style="display:none"><rect x="${x + a.w - 36}" y="${y - 9}" width="40" height="17" rx="4" style="fill:var(--bad)"/><text x="${x + a.w - 16}" y="${y + 3}" text-anchor="middle" style="fill:#fff;font-size:11px">持锁</text></g></g>`;
          }).join("");
      }
      function ui() {
        nextB.disabled = idx >= steps.length - 1 && !busy;
        autoB.textContent = auto ? "暂停" : "自动播放";
        setTxt(root, "#sim-txn-pos", `第 ${Math.max(idx + 1, 0)} / ${steps.length} 步`);
      }
      function sync() { // 切页签 / 改故障开关 / 重置：重新生成步骤
        $$(root, ".sim-txn-tab").forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
        $$(root, ".sim-txn-cmp tr[data-r]").forEach((r) => r.classList.toggle("hi", r.dataset.r === tab));
        g("lp").style.display = tab === "msg" ? "none" : "";
        g("lc").style.display = tab === "2pc" ? "" : "none";
        g("ld").style.display = tab === "msg" ? "" : "none";
        g("desc").textContent = TXN[tab].desc;
        steps = TXN[tab].plan({ failI: chk.fi.checked, failP: tab !== "msg" && chk.fp.checked, crash: tab === "2pc" && chk.cr.checked, dup: tab === "msg" && chk.du.checked });
        idx = -1; busy = false; auto = false;
        scene();
        note.className = "sim-note";
        note.textContent = "点「下一步」逐步观察；也可以先勾选故障注入，再看同一场景会发生什么。";
        ui();
      }
      function flyMsg(m, done) { // 箭头：从发送方框边飞到接收方框边，往返两条线错开 7px
        const [from, to, label, tone, delay] = m, A = act[from], B = act[to];
        const bd = (X, Y) => { const dx = Y.x - X.x, dy = Y.y - X.y, t = Math.min(dx ? X.w / 2 / Math.abs(dx) : 9e9, dy ? X.h / 2 / Math.abs(dy) : 9e9); return [X.x + dx * t, X.y + dy * t]; };
        const dx = B.x - A.x, dy = B.y - A.y, n = Math.hypot(dx, dy) || 1, sx = -dy / n * 7, sy = dx / n * 7, a = bd(A, B), b = bd(B, A);
        fl.fly([[a[0] + sx, a[1] + sy], [b[0] + sx, b[1] + sy]], { dur: 700, cls: tone || "", label, delay: delay || 0, done });
      }
      function next() {
        if (busy) fl.finishAll();
        if (idx >= steps.length - 1) return;
        const s = steps[++idx];
        note.className = "sim-note " + (s.tone || "");
        note.textContent = s.note;
        busy = true;
        const fin = () => { Object.keys(s.st || {}).forEach((k) => act[k] && setSt(k, s.st[k])); busy = false; cool = 900; if (idx >= steps.length - 1) auto = false; ui(); };
        if (!s.msgs.length) fin(); else { const j = join(s.msgs.length, fin); s.msgs.forEach((m) => flyMsg(m, j)); }
        ui();
      }
      nextB.addEventListener("click", next);
      autoB.addEventListener("click", () => { if (!auto && idx >= steps.length - 1 && !busy) sync(); auto = !auto; cool = 0; ui(); });
      g("reset").addEventListener("click", sync);
      Object.values(chk).forEach((c) => c.addEventListener("change", sync));
      $$(root, ".sim-txn-tab").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.t; sync(); }));
      ctx.every(() => {
        fl.tick(40);
        if (auto && !busy) { cool -= 40; if (cool <= 0) { if (idx < steps.length - 1) next(); else auto = false; ui(); } }
      }, 40);
      sync();
    },
    say: [
      "2PC / XA：准备阶段锁资源、写 undo/redo，提交阶段统一 Commit，强一致；代价是同步阻塞、协调者单点（3PC 增加 CanCommit 与超时能缓解，但不能根治，网络开销还更大）。",
      "TCC：Try 预留 → Confirm 确认 / Cancel 取消，无长锁、最终一致；代价是每个服务自写三个接口，侵入性强，还要处理空回滚、悬挂、幂等。",
      "Saga：按序执行本地事务，失败后反向补偿，适合长流程、最终一致；代价是补偿事务要自己写，且不隔离（会读到中间状态）。",
      "本地消息表 + MQ：本地事务里同时写业务表和消息表，异步投递、失败重试、消费端幂等，最终一致、侵入低；代价是有延迟，要做好重试与对账。",
      "能不用分布式事务就不用：先通过边界划分，把强一致收进同一个本地事务。",
      "幂等是所有最终一致方案的底线（唯一键 / 去重表 / 状态机）。"
    ],
    cards: ["a32", "a31"]
  });

  // =====================================================================
  // ③-2 负载均衡 + 一致性哈希环
  // =====================================================================
  const LB_SV = [{ n: "S1", w: 5 }, { n: "S2", w: 3 }, { n: "S3", w: 1 }, { n: "S4", w: 1 }];
  const LB_IPS = ["10.1.0.11", "10.1.0.27", "10.1.0.35", "10.1.0.48", "10.1.0.52", "10.1.0.66", "10.1.0.79", "10.1.0.93"];
  const LB_ALG = {
    rr: ["轮询", false, "轮流分配，完全不看服务器状态。适合服务器配置相同、请求耗时相近的场景。"],
    wrr: ["加权轮询", false, "按权重 5:3:1:1 分配（平滑加权轮询）。适合服务器性能不均（异构）的场景；仍然不看实时负载。"],
    rand: ["随机", false, "随机挑一台，请求量大时趋近均匀，实现最简单；同样不看实时负载。"],
    least: ["最少连接", true, "选「当前连接数 ÷ 权重」最小的存活服务器，依赖实时监控；适合请求耗时差异大、长连接场景，能自动绕开变慢或宕机的节点。"],
    hash: ["IP / 源地址哈希", false, "同一客户端 IP 总落在同一台，实现会话保持（不用共享 Session）；缺点：分布可能倾斜，节点增减会让会话漂移，也不会绕开故障节点。"],
    ch: ["一致性哈希", false, "按 IP 落到哈希环，节点增删只影响相邻区间，适合缓存、有状态节点（切到「一致性哈希环」页签看迁移）；同样不看实时负载。"]
  };
  const RING_PAL = ["#2e6fd8", "#1f8a65", "#c68a12", "#c0463c", "#8a4fd0", "#d0509a", "#2aa2b8", "#7a8a1f"];
  const ringColor = (n) => RING_PAL[(parseInt(String(n).replace(/\D/g, ""), 10) - 1) % RING_PAL.length];
  const sharding = [
    ["Hash 分片", "按 hash(key) % N 分配：数据分布均匀、实现简单", "扩缩容时几乎全部数据要重新迁移；范围查询要跨分片"],
    ["一致性 Hash 分片", "节点增删只影响相邻区间，迁移量约 1/N；配虚拟节点后分布均匀", "节点少时易数据倾斜（靠虚拟节点缓解）；范围查询仍不方便"],
    ["按范围分片", "按区间（如时间、ID 段）切分：范围查询高效，扩容只需拆区间", "易出现热点（递增 ID / 时间戳集中写最后一段），数据分布可能不均"]
  ];

  reg({
    id: "lb", name: "负载均衡 + 一致性哈希环", tag: "K03 数据分片", kit: "K03",
    intro: "对应 2025 上半年「系统负载均衡设计方法」与 2020「数据分片技术」：先在「负载均衡」页签比较静态 / 动态算法遇到变慢、宕机、突发流量时的表现，再到「一致性哈希环」看分片扩容时谁要迁移。",
    render() {
      const opt = Object.keys(LB_ALG).map((k) => `<option value="${k}">${LB_ALG[k][0]}（${LB_ALG[k][1] ? "动态" : "静态"}）</option>`).join("");
      const tg = LB_SV.map((s, i) => `<option value="${i}">${s.n}（权重 ${s.w}）</option>`).join("");
      const sh = sharding.map((r) => `<tr><td style="font-weight:600">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
      return `<div class="row" style="margin-bottom:6px"><button class="pill sim-lb-tab on" data-t="p1">负载均衡</button><button class="pill sim-lb-tab" data-t="p2">一致性哈希环</button></div>
      <div id="sim-lb-p1">
        <div class="sim-ctl">
          <label>算法 <select id="sim-lb-alg">${opt}</select></label>
          <label>请求速率 <input type="range" id="sim-lb-rate" min="1" max="12" value="5"><b id="sim-lb-ratev">5/s</b></label>
          <label>处理时长 <input type="range" id="sim-lb-dur" min="3" max="30" value="12"><b id="sim-lb-durv">1.2s</b></label>
        </div>
        <div class="sim-ctl">
          <label>故障目标 <select id="sim-lb-tg">${tg}</select></label>
          <button id="sim-lb-slow">变慢</button><button id="sim-lb-down">宕机</button><button id="sim-lb-burst">突发流量</button><button id="sim-lb-clear">清零 / 全部恢复</button>
        </div>
        <div class="sim-kpi"><div><div class="label">已发请求</div><div class="v" id="sim-lb-k1">0</div></div><div><div class="label">成功处理</div><div class="v ok" id="sim-lb-k2">0</div></div><div><div class="label">失败（红点）</div><div class="v bad" id="sim-lb-k3">0</div></div><div><div class="label">当前算法类别</div><div class="v" id="sim-lb-k4" style="font-size:16px">静态</div></div></div>
        <svg id="sim-lb-svg" viewBox="0 0 760 320" width="100%" role="img" aria-label="负载均衡动画"></svg>
        <div class="sim-note" id="sim-lb-note"></div>
        <div class="grid g3" style="margin-top:10px">
          <div class="sim-lam-duty"><b>灰度发布</b>按权重（如 5% 流量到新版本）或按 Header / Cookie 路由到新版本。</div>
          <div class="sim-lam-duty"><b>按地域就近</b>DNS / GSLB 把用户引到最近的机房，跨机房再做容灾切换。</div>
          <div class="sim-lam-duty"><b>四层 LVS + 七层 Nginx</b>LVS 在传输层转发、性能高；Nginx 能按 URL / Header 路由，常分层配合。</div>
        </div>
      </div>
      <div id="sim-lb-p2" hidden>
        <div class="sim-ctl">
          <button class="primary" id="sim-lb-add">添加节点</button>
          <label><select id="sim-lb-del"></select></label><button id="sim-lb-delb">删除所选节点</button>
          <label><input type="checkbox" id="sim-lb-vn">虚拟节点（每节点 20 个）</label><button id="sim-lb-rreset">复位</button>
        </div>
        <div class="grid g2" style="align-items:start">
          <svg id="sim-lb-rsvg" viewBox="0 0 380 380" width="100%" role="img" aria-label="一致性哈希环"></svg>
          <div id="sim-lb-rstat"></div>
        </div>
        <div class="sim-note" id="sim-lb-rnote"></div>
        <div style="overflow-x:auto;margin-top:12px"><table class="sim-lb-tbl"><thead><tr><th>数据分片方式</th><th>优点</th><th>缺点</th></tr></thead><tbody>${sh}</tbody></table></div>
      </div>`;
    },
    mount(root, ctx) {
      const g = (s) => $(root, "#sim-lb-" + s);
      const t1 = mountLb(root, g), t2 = mountRing(root, g);
      let cur = "p1";
      $$(root, ".sim-lb-tab").forEach((b) => b.addEventListener("click", () => {
        cur = b.dataset.t;
        $$(root, ".sim-lb-tab").forEach((x) => x.classList.toggle("on", x === b));
        g("p1").hidden = cur !== "p1"; g("p2").hidden = cur !== "p2";
      }));
      ctx.every(() => { (cur === "p1" ? t1 : t2)(50); }, 50);
    },
    say: [
      "静态策略（轮询 / 加权轮询 / 随机 / 哈希）不看实时状态，实现简单；动态策略（最少连接 / 响应时间 / 动态权重）依赖监控反馈，能绕开慢节点和故障节点。",
      "场景化选择：会话保持用源地址哈希；服务器异构用加权；长连接 / 耗时差异大用最少连接；灰度发布按权重或 Header 路由；四层 LVS 与七层 Nginx 分工配合。",
      "负载均衡器自己也不能是单点：Keepalived 主备（VRRP 虚拟 IP）或集群部署。",
      "数据分片三种方式：Hash 分片均匀但扩容迁移大；一致性 Hash 迁移小，要用虚拟节点防倾斜；范围分片范围查询好、扩容易，但易产生热点。"
    ],
    cards: ["a26", "a35", "a33"]
  });

  function mountLb(root, g) { // 页签一：负载均衡（返回每 50ms 调用一次的 tick）
    const svg = g("svg"), note = g("note"), fl = Flyer(svg, "lb");
    const S = LB_SV.map((s) => ({ n: s.n, w: s.w, cap: s.w * 4, up: true, slow: false, act: [], done: 0, fail: 0, hit: 0 }));
    const SY = [22, 98, 174, 250], CY = SY.map((y) => y + 28);
    const st = L.lbState(S.map((s) => s.n));
    let alg = "rr", rate = 5, dur = 1200, acc = 0, burst = 0, total = 0, lbFail = 0;

    svg.innerHTML = `<text x="600" y="14" style="font-weight:600;fill:var(--muted)">累计请求分布</text>
      <rect class="box" x="10" y="130" width="90" height="60" rx="8"/><text x="55" y="156" text-anchor="middle" style="font-weight:600">客户端</text><text x="55" y="174" text-anchor="middle" style="fill:var(--muted);font-size:11px">8 个源 IP</text>
      <line class="flow" x1="100" y1="160" x2="160" y2="160"/>
      ${CY.map((y) => `<line class="flow" x1="270" y1="160" x2="380" y2="${y}"/>`).join("")}
      <rect class="box" x="160" y="130" width="110" height="60" rx="8"/><text x="215" y="153" text-anchor="middle" style="font-weight:600">负载均衡器</text><text id="sim-lb-algn" x="215" y="173" text-anchor="middle" style="fill:var(--accent);font-size:11px">轮询</text>` +
      S.map((s, i) => `<g class="sim-lb-sv" id="sim-lb-s${i}"><rect class="box" x="380" y="${SY[i]}" width="200" height="56" rx="8"/>
        <text x="390" y="${SY[i] + 17}" style="font-weight:600">${s.n} · 权重 ${s.w}</text><text id="sim-lb-st${i}" x="570" y="${SY[i] + 17}" text-anchor="end" style="fill:var(--ok)">正常</text>
        <rect x="390" y="${SY[i] + 26}" width="180" height="8" rx="4" style="fill:var(--fill)"/><rect id="sim-lb-cb${i}" x="390" y="${SY[i] + 26}" width="0" height="8" rx="4" style="fill:var(--ok)"/>
        <text id="sim-lb-ct${i}" x="390" y="${SY[i] + 50}" style="fill:var(--muted);font-size:11px"></text></g>
        <rect id="sim-lb-ba${i}" x="600" y="${CY[i] - 9}" width="0" height="18" rx="3" style="fill:var(--accent)"/><rect id="sim-lb-bf${i}" x="600" y="${CY[i] - 9}" width="0" height="18" rx="3" style="fill:var(--bad)"/>
        <text id="sim-lb-bt${i}" x="604" y="${CY[i] + 4}" style="font-size:11px"></text>`).join("");

    const info = () => {
      const a = LB_ALG[alg], dead = S.filter((s) => !s.up), slow = S.filter((s) => s.slow);
      let t = `【${a[0]}·${a[1] ? "动态" : "静态"}】${a[2]}`;
      if (dead.length) t += a[1] ? ` ${dead.map((s) => s.n).join("、")} 宕机：动态算法看得到存活状态，已把流量绕开，几乎没有红点。` : ` ${dead.map((s) => s.n).join("、")} 宕机：${a[0]}是静态策略，看不到故障，仍把请求打过去 → 出现红点失败。`;
      if (slow.length) t += a[1] ? ` ${slow.map((s) => s.n).join("、")} 变慢：连接堆积，最少连接会自动少给它。` : ` ${slow.map((s) => s.n).join("、")} 变慢：静态算法继续按原比例派发，连接堆满后会超载失败。`;
      note.className = "sim-note" + ((dead.length || slow.length) && !a[1] ? " bad" : "");
      note.textContent = t;
      setTxt(root, "#sim-lb-k4", a[1] ? "动态（看实时状态）" : "静态（不看实时状态）");
      setTxt(root, "#sim-lb-algn", a[0]);
    };
    const paint = () => {
      const mx = Math.max(1, ...S.map((s) => s.hit));
      S.forEach((s, i) => {
        const r = s.act.length / s.cap, cb = g("cb" + i);
        cb.setAttribute("width", Math.min(1, r) * 180);
        cb.style.fill = r < 0.6 ? "var(--ok)" : r < 0.9 ? "var(--mid)" : "var(--bad)";
        g("ct" + i).textContent = `连接 ${s.act.length}/${s.cap} · 已处理 ${s.done}` + (s.fail ? ` · 失败 ${s.fail}` : "");
        const el = g("st" + i);
        el.textContent = !s.up ? "宕机" : s.slow ? "变慢 ×4" : "正常";
        el.style.fill = !s.up ? "var(--bad)" : s.slow ? "var(--mid)" : "var(--ok)";
        g("s" + i).setAttribute("class", "sim-lb-sv" + (!s.up ? " down" : s.slow ? " slow" : ""));
        const w = s.hit / mx * 100;
        g("ba" + i).setAttribute("width", w * (1 - (s.hit ? s.fail / s.hit : 0)));
        g("bf" + i).setAttribute("x", 600 + w * (1 - (s.hit ? s.fail / s.hit : 0)));
        g("bf" + i).setAttribute("width", w * (s.hit ? s.fail / s.hit : 0));
        const sum = S.reduce((a, b) => a + b.hit, 0);
        g("bt" + i).setAttribute("x", 600 + w + 4);
        g("bt" + i).textContent = `${s.hit}（${sum ? Math.round(s.hit / sum * 100) : 0}%）`;
      });
      setTxt(root, "#sim-lb-k1", total);
      setTxt(root, "#sim-lb-k2", S.reduce((a, s) => a + s.done, 0));
      setTxt(root, "#sim-lb-k3", S.reduce((a, s) => a + s.fail, 0) + lbFail);
      const t = +g("tg").value;
      g("slow").textContent = S[t].slow ? `${S[t].n} 恢复速度` : `${S[t].n} 变慢`;
      g("down").textContent = S[t].up ? `${S[t].n} 宕机` : `${S[t].n} 恢复`;
    };
    const arrive = (i, el) => { // 请求到达服务器
      const s = S[i];
      s.hit++;
      if (!s.up || s.act.length >= s.cap) { s.fail++; if (el) el.setAttribute("class", "sim-lb-fly bad"); return true; }
      s.act.push(dur * (s.slow ? 4 : 1) * (0.7 + Math.random() * 0.6));
      return false;
    };
    const spawn = () => {
      total++;
      const ip = LB_IPS[Math.floor(Math.random() * LB_IPS.length)], i = L.lbPick(alg, st, S, ip);
      if (i < 0) { lbFail++; fl.fly([[100, 160], [215, 160]], { dur: 300, hold: 500, done: (el) => { if (el) el.setAttribute("class", "sim-lb-fly bad"); return true; } }); return; }
      fl.fly([[100, 160], [215, 160], [380, CY[i]]], { dur: 750, hold: 450, done: (el) => arrive(i, el) }); // 点数到上限时 fly 会直接回调，逻辑照常
    };
    const clear = () => { fl.clear(); S.forEach((s) => { s.up = true; s.slow = false; s.act = []; s.done = s.fail = s.hit = 0; }); total = lbFail = 0; acc = burst = 0; info(); paint(); };

    g("alg").addEventListener("change", () => { alg = g("alg").value; info(); });
    g("rate").addEventListener("input", () => { rate = +g("rate").value; setTxt(root, "#sim-lb-ratev", rate + "/s"); });
    g("dur").addEventListener("input", () => { dur = g("dur").value * 100; setTxt(root, "#sim-lb-durv", (dur / 1000).toFixed(1) + "s"); });
    g("tg").addEventListener("change", paint);
    g("slow").addEventListener("click", () => { const s = S[+g("tg").value]; s.slow = !s.slow; info(); paint(); });
    g("down").addEventListener("click", () => { const s = S[+g("tg").value]; s.up = !s.up; info(); paint(); });
    g("burst").addEventListener("click", () => { burst += 30; });
    g("clear").addEventListener("click", clear);
    S.forEach((s, i) => g("s" + i).addEventListener("click", () => { g("tg").value = i; paint(); }));
    info(); paint();

    return (dt) => {
      fl.tick(dt);
      const ex = Math.min(burst, 20 * dt / 1000);
      burst -= ex; acc += rate * dt / 1000 + ex;
      for (let k = 0; acc >= 1 && k < 4; k++) { acc -= 1; spawn(); }
      if (acc > 3) acc = 0;
      S.forEach((s) => { for (let i = s.act.length - 1; i >= 0; i--) { s.act[i] -= dt; if (s.act[i] <= 0) { s.act.splice(i, 1); s.done++; } } });
      paint();
    };
  }

  function mountRing(root, g) { // 页签二：一致性哈希环（返回 tick）
    const svg = g("rsvg"), fl = Flyer(svg, "lb"), note = g("rnote");
    const C = { x: 190, y: 190, R: 150 };
    const KH = Array.from({ length: 24 }, (_, i) => L.demoKey(i + 1));
    const BIG = Array.from({ length: 2000 }, (_, i) => L.fnv("user:" + i));
    let nodes = [], seq = 4, vn = false, own = [], migKeys = [], last = null, chips = {};
    const ang = (h) => h / M32 * 2 * Math.PI - Math.PI / 2;
    const pt = (h, r) => [C.x + r * Math.cos(ang(h)), C.y + r * Math.sin(ang(h))];
    const owners = (ns, v) => { const r = L.buildRing(ns, v); return KH.map((h) => L.ringOwner(r, h)); };

    function draw() {
      const ring = L.buildRing(nodes, vn), share = L.arcShare(ring), n = nodes.length;
      let h = `<circle cx="${C.x}" cy="${C.y}" r="${C.R}" style="fill:none;stroke:var(--line)"/>`;
      ring.forEach((e, i) => { // 弧段 = 上一个点到本点，归属本点的节点（顺时针找最近节点）
        const p = ring[(i + ring.length - 1) % ring.length].pos, span = (e.pos - p + M32) % M32;
        if (!span && ring.length > 1) return;
        const a = pt(p, C.R), b = pt(e.pos, C.R);
        h += ring.length === 1 ? `<circle cx="${C.x}" cy="${C.y}" r="${C.R}" style="fill:none;stroke:${ringColor(e.node)};stroke-width:9"/>` :
          `<path d="M${a[0]} ${a[1]}A${C.R} ${C.R} 0 ${span > M32 / 2 ? 1 : 0} 1 ${b[0]} ${b[1]}" style="fill:none;stroke:${ringColor(e.node)};stroke-width:9;opacity:.8"/>`;
      });
      ring.forEach((e) => {
        const p = pt(e.pos, C.R);
        h += vn ? `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:${ringColor(e.node)};stroke:var(--panel)"/>` :
          `<circle cx="${p[0]}" cy="${p[1]}" r="11" style="fill:${ringColor(e.node)};stroke:var(--panel);stroke-width:2"/><text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" style="fill:#fff;font-weight:600;font-size:11px">${e.node}</text>`;
      });
      KH.forEach((kh, i) => {
        const p = pt(kh, C.R - 22), m = migKeys.includes(i);
        h += `<circle ${m ? 'class="sim-lb-mig"' : ""} cx="${p[0]}" cy="${p[1]}" r="${m ? 7 : 5}" style="fill:${ringColor(own[i])};stroke:${m ? "var(--bad)" : "var(--panel)"};stroke-width:${m ? 3 : 1.5}"/>`;
      });
      chips = {};
      nodes.forEach((nd, i) => { // 圆心里的「服务器」小图标
        const a = i / n * 2 * Math.PI - Math.PI / 2, x = C.x + (n > 1 ? 46 : 0) * Math.cos(a), y = C.y + (n > 1 ? 46 : 0) * Math.sin(a);
        chips[nd] = [x, y];
        h += `<circle cx="${x}" cy="${y}" r="17" style="fill:${ringColor(nd)}"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="fill:#fff;font-weight:600">${nd}</text>`;
      });
      svg.innerHTML = h;
      // 右侧统计
      const cnt = {}; own.forEach((o) => { cnt[o] = (cnt[o] || 0) + 1; });
      const mxs = Math.max(...nodes.map((x) => share[x] || 0)), skew = mxs * n;
      let s = `<table class="sim-lb-tbl"><thead><tr><th>节点</th><th style="width:46%">负责的环上区间</th><th>key 数</th></tr></thead><tbody>` +
        nodes.map((x) => `<tr><td><b style="color:${ringColor(x)}">${x}</b></td><td><div class="bar"><span style="width:${(share[x] || 0) * 100}%;background:${ringColor(x)}"></span></div><span class="faint">${Math.round((share[x] || 0) * 100)}%（均分应为 ${Math.round(100 / n)}%）</span></td><td>${cnt[x] || 0}</td></tr>`).join("") +
        `</tbody></table><p style="margin:8px 0 4px">数据倾斜度：最忙节点的区间 = 平均的 <b class="${skew > 1.5 ? "bad" : "ok"}">${skew.toFixed(2)}×</b>${vn ? "（已开虚拟节点）" : "（未开虚拟节点）"}</p>`;
      if (last) {
        const p = (a, b) => `${a}/${b}（${Math.round(a / b * 100)}%）`;
        s += `<p style="margin:8px 0 4px"><b>${last.what}</b> 的迁移比例</p>
          <div class="hbar" style="grid-template-columns:96px 1fr 120px"><span>一致性 Hash</span><div class="track"><div class="fillbar" style="width:${last.ch / last.n * 100}%;background:var(--ok)"></div></div><span>${p(last.ch, last.n)}</span></div>
          <div class="hbar" style="grid-template-columns:96px 1fr 120px"><span>取模 hash%N</span><div class="track"><div class="fillbar" style="width:${last.mod / last.n * 100}%;background:var(--bad)"></div></div><span>${p(last.mod, last.n)}</span></div>
          <p class="faint">上面是图中 24 个 key；若抽样 2000 个 key：一致性 Hash ${Math.round(last.big.ch / last.big.n * 100)}%，取模 ${Math.round(last.big.mod / last.big.n * 100)}%。</p>`;
      } else s += `<p class="faint">点「添加节点」或「删除所选节点」，看哪些 key（红圈）要迁移。</p>`;
      s += `<p class="faint">图例：弧线颜色 = 该区间归属的节点；小圆点 = key（红圈 = 刚迁移）；圆心的彩色圆 = 服务器节点。</p>`;
      g("rstat").innerHTML = s;
      const sel = g("del"); sel.innerHTML = nodes.map((x) => `<option>${x}</option>`).join("");
      g("add").disabled = nodes.length >= 8; g("delb").disabled = nodes.length <= 2;
    }
    function change(nn, what, msg) {
      const A = { nodes: nodes.slice(), vn }, B = { nodes: nn, vn }, oldChips = chips, oldOwn = own;
      own = owners(nn, vn);
      migKeys = KH.map((_, i) => i).filter((i) => oldOwn[i] !== own[i]);
      const m = L.migrate(KH, A, B);
      last = { what, n: m.n, ch: m.ch, mod: m.mod, big: L.migrate(BIG, A, B) };
      nodes = nn;
      fl.clear(); draw();
      migKeys.forEach((i, j) => { const a = oldChips[oldOwn[i]], b = chips[own[i]]; if (a && b) fl.fly([a, b], { dur: 900, rect: true, cls: "bad", delay: j * 40 }); });
      note.className = "sim-note ok";
      note.textContent = `${msg} 一致性 Hash 只迁移 ${m.ch}/${m.n} 个 key（只涉及相邻区间），取模 Hash 要迁移 ${m.mod}/${m.n}${m.mod / m.n >= 0.6 ? "（几乎全部）" : ""}。${vn ? "" : "没开虚拟节点时区间大小不均，迁移量也跟着不均。"}`;
    }
    function reset() {
      nodes = ["N1", "N2", "N3"]; seq = 4; last = null; migKeys = []; vn = g("vn").checked = false;
      own = owners(nodes, vn); fl.clear(); draw();
      note.className = "sim-note";
      note.textContent = "3 个节点、24 个 key：每个 key 沿环顺时针找到的第一个节点就是它的归属。未开虚拟节点时节点在环上分布不均，容易数据倾斜；增删节点时一致性 Hash 只影响相邻区间，试试「添加节点」。";
    }
    g("add").addEventListener("click", () => { const nd = "N" + seq++; change(nodes.concat(nd), "添加 " + nd, `添加 ${nd}：只有落在它与逆时针相邻节点之间的 key 迁移给它（红圈），其余 key 不动。`); });
    g("delb").addEventListener("click", () => { const x = g("del").value; change(nodes.filter((n) => n !== x), "删除 " + x, `删除 ${x}：只有它负责的 key 顺时针迁移给下一个节点（红圈），其余 key 不动。`); });
    g("vn").addEventListener("change", () => {
      vn = g("vn").checked; own = owners(nodes, vn); migKeys = []; last = null; fl.clear(); draw();
      note.className = "sim-note ok";
      note.textContent = vn ? "开启虚拟节点：每个节点在环上撒 20 个点，区间被打散，各节点占比趋于均匀，倾斜度明显下降；代价是元数据变多。" : "关闭虚拟节点：每个节点只有 1 个点，区间大小取决于哈希运气，容易倾斜。";
    });
    g("rreset").addEventListener("click", reset);
    reset();
    return (dt) => fl.tick(dt);
  }

  // =====================================================================
  // ③-3 CAP 分区实验
  // =====================================================================
  const CAP_Q = [
    ["银行转账", "cp", "余额错一分都不行：分区时宁可拒绝 / 超时（牺牲可用性），也不能两边余额不一致 → CP。核心账务用强一致（同库本地事务，或 2PC / TCC），并做好对账。"],
    ["朋友圈点赞", "ap", "点赞数晚几秒、各地略有差异无伤大雅，体验和可用性优先 → AP + BASE（最终一致）。"],
    ["秒杀库存扣减", "mix", "整体按 AP 设计（页面静态化、缓存、排队、异步下单，保可用与性能）；但「库存扣减」这个点必须局部 CP（如 Redis Lua 原子扣减 / 数据库条件更新），否则会超卖。所以是「整体 AP + 扣减点局部 CP」。"],
    ["本项目：申报办件", "cp", "表单、办件状态、审批记录放在同一个库的本地事务内 → 强一致（CP 取向），不能让办件状态错乱。"],
    ["本项目：电子证照出证", "ap", "出证是跨服务链路：允许短暂延迟，走本地消息表 + 幂等的最终一致（AP 取向），不为此引入 2PC / TCC。"]
  ];

  reg({
    id: "cap", name: "CAP 分区实验", tag: "K04 K08", kit: "K04",
    intro: "两个机房各一个副本：先制造网络分区，再分别在 CP / AP 模式下写入和读取，亲眼看到「分区时只能二选一」，最后用 5 个场景练选型。",
    render() {
      const qs = CAP_Q.map((q, i) => `<div class="sim-cap-q" id="sim-cap-q${i}"><b>${q[0]}</b><span><button data-q="${i}" data-a="cp">CP</button> <button data-q="${i}" data-a="ap">AP</button></span><span class="muted" id="sim-cap-r${i}">请选择 CP 还是 AP</span></div>`).join("");
      return `<div class="sim-ctl">
          <label><input type="radio" name="sim-cap-m" id="sim-cap-mcp" checked>CP（强一致，分区时拒绝 / 超时）</label>
          <label><input type="radio" name="sim-cap-m" id="sim-cap-map">AP（高可用，分区时各写各的）</label>
        </div>
        <div class="sim-ctl"><button id="sim-cap-part" class="primary">制造网络分区（断开）</button><button id="sim-cap-w">A 写入 v=2</button><button id="sim-cap-r">B 读取</button><button id="sim-cap-reset">复位</button></div>
        <div class="sim-cap-chips" id="sim-cap-chips"></div>
        <svg id="sim-cap-svg" viewBox="0 55 760 150" width="100%" role="img" aria-label="CAP 分区实验"></svg>
        <div class="sim-note" id="sim-cap-note"></div>
        <h3>选型练习：这个场景该 CP 还是 AP？</h3>${qs}
        <p class="faint" id="sim-cap-sum" style="margin-top:6px"></p>`;
    },
    mount(root, ctx) {
      const g = (s) => $(root, "#sim-cap-" + s);
      const svg = g("svg"), note = g("note"), fl = Flyer(svg, "cap");
      let mode = "cp", part = false, A = 1, B = 1, pend = false, busy = false, served = true, tagA, tagB;
      const POS = { c1: [100, 130], A: [150, 130], Ar: [320, 130], Bl: [440, 130], Br: [610, 130], c2: [660, 130], mid: [380, 130] };
      svg.innerHTML = `<rect class="box" x="10" y="95" width="90" height="70" rx="8"/><text x="55" y="125" text-anchor="middle" style="font-weight:600">客户端 1</text><text x="55" y="143" text-anchor="middle" style="fill:var(--muted);font-size:11px">在 A 写入</text>
        <rect class="box" x="660" y="95" width="90" height="70" rx="8"/><text x="705" y="125" text-anchor="middle" style="font-weight:600">客户端 2</text><text x="705" y="143" text-anchor="middle" style="fill:var(--muted);font-size:11px">在 B 读取</text>
        <line class="flow" x1="100" y1="130" x2="150" y2="130"/><line class="flow" x1="610" y1="130" x2="660" y2="130"/>
        <line id="sim-cap-link" class="flow" x1="320" y1="130" x2="440" y2="130" style="stroke-width:3"/>
        <text id="sim-cap-lt" x="380" y="100" text-anchor="middle" style="fill:var(--muted)">网络链路</text><text id="sim-cap-cut" x="380" y="138" text-anchor="middle" style="fill:var(--bad);font-size:24px;font-weight:700;display:none">✕</text>` +
        ["A", "B"].map((k, i) => { const x = i ? 440 : 150; return `<g><rect class="box" x="${x}" y="70" width="170" height="120" rx="10"/><text x="${x + 85}" y="92" text-anchor="middle" style="font-weight:600">机房 ${k} · 副本</text>
          <text id="sim-cap-v${k}" x="${x + 85}" y="140" text-anchor="middle" style="font-size:34px;font-weight:700">v=1</text>
          <g class="sim-cap-tg" id="sim-cap-t${k}"><rect x="${x + 15}" y="154" width="140" height="24" rx="12"/><text x="${x + 85}" y="171">一致</text></g></g>`; }).join("");
      const setTag = (k, t, tone) => { const e = g("t" + k); e.setAttribute("class", "sim-cap-tg " + (tone || "")); $(e, "text").textContent = t; };
      const say = (t, tone) => { note.className = "sim-note " + (tone || ""); note.textContent = t; };
      function paint() {
        setTxt(root, "#sim-cap-vA", "v=" + A); setTxt(root, "#sim-cap-vB", "v=" + B);
        const same = A === B;
        g("chips").innerHTML = `<span class="sim-cap-chip ${same ? "ok" : "bad"}">C 一致性：${same ? "一致" : `不一致（A=v${A}，B=v${B}）`}</span><span class="sim-cap-chip ${served ? "ok" : "bad"}">A 可用性：${served ? "请求都有响应" : "请求被拒绝 / 超时"}</span><span class="sim-cap-chip ${part ? "mid" : ""}">P 网络分区：${part ? "已发生" : "无"}</span>`;
        g("part").textContent = part ? "恢复网络" : "制造网络分区（断开）";
        g("w").textContent = "A 写入 v=" + (A + 1);
        g("w").disabled = g("r").disabled = busy;
        const lk = g("link"); lk.style.stroke = part ? "var(--bad)" : ""; lk.style.strokeDasharray = part ? "6 5" : "";
        g("cut").style.display = part ? "" : "none"; setTxt(root, "#sim-cap-lt", part ? "网络分区" : "网络链路");
      }
      const fin = (tone) => (m) => { busy = false; if (m) say(m, tone); paint(); };
      const blocked = (label, done) => fl.fly([POS.Ar, [372, 130]], { dur: 500, label, hold: 500, done: (el) => { if (el) el.setAttribute("class", "sim-cap-fly bad"); if (done) done(); return true; } }); // 飞到断点处被挡住
      function write() {
        if (busy) return;
        busy = true; served = true; const nv = A + 1; paint();
        fl.fly([POS.c1, POS.A], { dur: 500, label: "写 v=" + nv, done: () => {
          if (mode === "cp") {
            if (!part) {
              say("CP·网络正常：A 先把 v=" + nv + " 同步给 B，B 确认后才向客户端返回成功 → 两个副本一起变成 v=" + nv + "（强一致）。");
              fl.fly([POS.Ar, POS.Bl], { dur: 600, label: "同步", done: () => { B = nv; setTag("B", "已同步", "ok"); paint(); fl.fly([POS.Bl, POS.Ar], { dur: 600, label: "确认", done: () => { A = nv; setTag("A", "已提交", "ok"); fl.fly([POS.A, POS.c1], { dur: 500, cls: "ok", label: "成功", done: () => fin("ok")() }); } }); } });
            } else {
              say("CP·分区中：A 无法确认 B 是否收到，为了不出现两份不同的数据，直接拒绝写入（客户端看到「不可用 / 超时」）。放弃可用性 A，保住一致性 C。", "bad");
              blocked("同步", () => { served = false; setTag("A", "拒绝写入", "bad"); paint(); fl.fly([POS.A, POS.c1], { dur: 500, cls: "bad", label: "不可用", done: () => fin()() }); });
            }
          } else {
            A = nv; setTag("A", part ? "领先·待同步" : "已写入", part ? "mid" : "ok"); paint();
            const j = join(2, fin());
            fl.fly([POS.A, POS.c1], { dur: 500, cls: "ok", label: "成功", done: j });
            if (!part) { say("AP·网络正常：A 立即写入成功，再异步复制给 B；短暂不一致后很快一致。", "ok"); fl.fly([POS.Ar, POS.Bl], { dur: 700, label: "异步复制", done: () => { B = nv; setTag("A", "一致", "ok"); setTag("B", "已同步", "ok"); paint(); j(); } }); }
            else { pend = true; say("AP·分区中：A 写入成功（保住可用性 A），但同步不过去 → A=v" + nv + "、B=v" + B + "，两边不一致（放弃 C）。这就是「软状态」。", "bad"); blocked("复制", j); }
          }
        } });
      }
      function read() {
        if (busy) return;
        busy = true; paint();
        fl.fly([POS.c2, POS.Br], { dur: 500, label: "读", done: () => {
          const stale = A !== B;
          setTag("B", stale ? "旧值" : (part && mode === "cp" ? "一致（拒写）" : "一致"), stale ? "bad" : "ok");
          fl.fly([POS.Br, POS.c2], { dur: 500, cls: stale ? "bad" : "ok", label: "v=" + B, done: () => {
            if (stale) fin("bad")(`B 读到旧值 v=${B}：服务可用，但 A 已经是 v=${A} → 可用但不一致（AP 的代价）。`);
            else if (part && mode === "cp") fin("ok")(`B 读到 v=${B}：A 的写入已被拒绝，两边都是 v=${B}，数据一致（代价是 A 写不进去）。`);
            else fin("ok")(`B 读到 v=${B}，与 A 一致。`);
          } });
        } });
      }
      function merge() { // 分区恢复后：按版本号合并，B 追上 A（最终一致）
        busy = true; setTag("A", "合并中…", "mid"); setTag("B", "合并中…", "mid"); paint();
        say("网络恢复：A 把 v=" + A + " 同步给 B，按版本号合并（较新的覆盖较旧的），B 追上 → 最终一致。BASE：基本可用、软状态、最终一致。", "ok");
        const j = join(3, () => { B = A; pend = false; setTag("A", "最终一致 ✓", "ok"); setTag("B", "最终一致 ✓", "ok"); fin()(); });
        [0, 1, 2].forEach((i) => fl.fly([POS.Ar, POS.Bl], { dur: 800, delay: i * 250, cls: "mid", label: i ? "" : "版本合并 v=" + A, done: j }));
      }
      function reset(m) {
        fl.clear(); A = B = 1; part = false; pend = false; busy = false; served = true;
        setTag("A", "一致"); setTag("B", "一致"); paint();
        say(m || "初始：A、B 两个副本都是 v=1。先试试「A 写入」，再「制造网络分区」后重来一次，对比 CP 与 AP。");
      }
      g("w").addEventListener("click", write);
      g("r").addEventListener("click", read);
      g("part").addEventListener("click", () => {
        part = !part; paint();
        if (part) say("网络分区发生：A、B 之间断开，各自仍在运行。P 一旦发生，就必须在 C 和 A 之间取舍——现在试试写入和读取。", "bad");
        else if (pend && mode === "ap") merge();
        else say("网络恢复，两个副本一致（v=" + A + "）。");
      });
      g("reset").addEventListener("click", () => reset());
      g("mcp").addEventListener("change", () => { mode = "cp"; reset("已切到 CP 并复位：分区时为保一致，会拒绝写入。先「制造网络分区」，再点「A 写入」。"); });
      g("map").addEventListener("change", () => { mode = "ap"; reset("已切到 AP 并复位：分区时各写各的、读到旧值，恢复后合并。先「制造网络分区」，再点「A 写入」和「B 读取」。"); });
      let right = 0, done = 0;
      $$(root, ".sim-cap-q button").forEach((b) => b.addEventListener("click", () => {
        const i = +b.dataset.q, q = CAP_Q[i], a = b.dataset.a, ok = q[1] === "mix" ? "mid" : (a === q[1] ? "ok" : "bad");
        if (!$(root, "#sim-cap-q" + i).dataset.d) { done++; if (ok === "ok") right++; $(root, "#sim-cap-q" + i).dataset.d = "1"; }
        $$(root, `#sim-cap-q${i} button`).forEach((x) => { x.className = ""; });
        b.className = "on-" + ok;
        g("r" + i).innerHTML = `<b class="${ok}">${ok === "ok" ? "答对了" : ok === "mid" ? "只对一半" : "再想想（应选 " + q[1].toUpperCase() + "）"}</b> ${q[2]}`;
        setTxt(root, "#sim-cap-sum", `已答 ${done}/${CAP_Q.length}，答对 ${right}（秒杀题不计入对错，看理由）`);
      }));
      ctx.every(() => fl.tick(40), 40);
      reset();
    },
    say: [
      "CAP 只有在发生网络分区（P）时才需要在 C 和 A 之间取舍；没有分区时，可以同时拥有 C 和 A。",
      "CP 宁可不可用也不错账（银行转账）；AP 宁可读旧值也不拒绝服务（点赞、物联网上报）。",
      "BASE：Basically Available 基本可用、Soft state 软状态、Eventually consistent 最终一致，是对 AP 的实践总结。",
      "落地原则：同一本地事务内保强一致，跨服务链路按最终一致设计，并用幂等 + 对账兜底。"
    ],
    cards: ["a31", "a35"]
  });

  // =====================================================================
  // ③-4 Lambda vs Kappa
  // =====================================================================
  const LAM_ROWS = [["层次", "批处理层 + 速度层 + 服务层", "不可变日志 + 流处理层 + 服务层（没有批处理层）"], ["延迟", "速度层低延迟；批视图延迟高（按小时 / 天）", "统一走流处理，延迟低"], ["准确性", "批处理全量重算，结果准确，覆盖速度层的近似结果", "依赖流处理自身的准确性；要修正就重放日志重算"], ["复杂度", "两套代码、逻辑要保持一致，维护成本高", "只有一套代码，架构简洁；依赖日志可回放"], ["适用场景", "既要实时又要对历史全量准确重算（离线报表 + 实时看板）", "以实时处理为主、逻辑能统一、日志可长期保留（IoT 数据流）"]];
  const LAM_DUTY = {
    lambda: [["批处理层（Hadoop / Spark）", "存主数据集 + 预计算批视图"], ["速度层（Flink / Storm，教材也叫加速层）", "只处理最近数据的增量视图"], ["服务层", "合并批视图与实时视图，响应查询"]],
    kappa: [["不可变日志（Kafka）", "只追加、可回放的事实来源"], ["流处理层（Flink）", "唯一一套计算逻辑；改逻辑就发 v2 重放"], ["服务层", "提供视图查询；v2 追平后切换，v1 下线"]]
  };

  reg({
    id: "lam", name: "Lambda vs Kappa 数据流", tag: "K08", kit: "K08",
    intro: "对应 2024 上半年「论大数据 Lambda 架构」：事件持续流入，看 Lambda 如何批 + 流两条路再合并，Kappa 如何只留一条流处理链路、靠「重放日志」代替批处理。",
    render() {
      const rows = LAM_ROWS.map((r) => `<tr><td style="font-weight:600">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
      return `<div class="sim-ctl">
          <button class="pill sim-lam-m on" data-m="lambda">Lambda</button><button class="pill sim-lam-m" data-m="kappa">Kappa</button>
          <label>事件速率 <input type="range" id="sim-lam-rate" min="1" max="6" value="2"><b id="sim-lam-ratev">2/s</b></label>
          <button id="sim-lam-act">立即触发批处理</button><button id="sim-lam-q">发起查询</button><button id="sim-lam-reset">重置</button>
        </div>
        <svg id="sim-lam-svg" viewBox="0 0 760 340" width="100%" role="img" aria-label="Lambda 与 Kappa 数据流"></svg>
        <div class="sim-note" id="sim-lam-note"></div>
        <div class="grid g3" id="sim-lam-duty" style="margin-top:10px"></div>
        <div style="overflow-x:auto;margin-top:12px"><table><thead><tr><th style="width:90px">对比</th><th>Lambda</th><th>Kappa</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    },
    mount(root, ctx) {
      const g = (s) => $(root, "#sim-lam-" + s);
      const svg = g("svg"), note = g("note"), fl = Flyer(svg, "lam");
      const BATCH = 8000, NSLOT = 18;
      let mode = "lambda", st = {}, rate = 2, qbusy = false;
      const slot = (i) => [232 + (i % 9) * 14 + 5, 72 + Math.floor(i / 9) * 14 + 5];
      const box = (x, y, w, h, t, sub, id) => `<g${id ? ` id="${id}"` : ""}><rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" style="font-weight:600">${t}</text>` + (sub ? `<text x="${x + w / 2}" y="${y + 38}" text-anchor="middle" style="fill:var(--muted);font-size:11px">${sub}</text>` : "") + "</g>";
      const lines = (a) => a.map((l) => `<line class="flow" x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}"${l[4] ? ' style="stroke-dasharray:5 4"' : ""}/>`).join("");
      const say = (t, tone) => { note.className = "sim-note " + (tone || ""); note.textContent = t; };
      const cnt = (id, x, y, sz) => `<text id="sim-lam-${id}" x="${x}" y="${y}" text-anchor="middle" style="font-size:${sz || 22}px;font-weight:700">0</text>`;

      function scene() {
        fl.clear(); qbusy = false;
        $$(root, ".sim-lam-m").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
        g("act").style.display = g("q").style.display = mode === "lambda" ? "" : "none";
        g("act").textContent = mode === "lambda" ? "立即触发批处理" : "重放";
        g("duty").innerHTML = LAM_DUTY[mode].map((d) => `<div class="sim-lam-duty"><b>${d[0]}</b>${d[1]}</div>`).join("");
        if (mode === "lambda") {
          st = { seq: 0, acc: 0, pile: [], bv: 0, bseq: 0, rt: [], bt: 0, batching: false };
          svg.innerHTML = lines([[70, 170, 100, 170], [170, 160, 215, 72], [170, 180, 215, 268], [440, 70, 470, 70], [440, 266, 470, 266], [560, 70, 600, 150], [560, 266, 600, 190]]) +
            box(10, 150, 60, 40, "数据源", "") + box(100, 140, 70, 60, "数据总线", "Kafka") +
            box(215, 12, 225, 120, "批处理层 · Hadoop / Spark", "存主数据集 + 预计算批视图（慢但准）") +
            Array.from({ length: NSLOT }, (_, i) => { const p = slot(i); return `<rect class="sim-lam-sq" id="sim-lam-sq${i}" x="${p[0] - 4.5}" y="${p[1] - 4.5}" width="9" height="9" rx="2" style="display:none"/>`; }).join("") +
            `<text id="sim-lam-pc" x="372" y="82" style="fill:var(--muted);font-size:11px">待处理 0 条</text><rect x="232" y="104" width="190" height="6" rx="3" style="fill:var(--fill)"/><rect id="sim-lam-cd" x="232" y="104" width="0" height="6" rx="3" style="fill:var(--accent)"/><text id="sim-lam-ct" x="232" y="124" style="fill:var(--muted);font-size:11px"></text>` +
            box(470, 40, 90, 60, "批视图", "") + cnt("bv", 515, 90) +
            box(215, 208, 225, 120, "速度层 · Flink / Storm", "只处理最近数据的增量视图（快但近似）") +
            `<line x1="232" y1="285" x2="425" y2="285" style="stroke:var(--line);stroke-width:2;stroke-dasharray:3 4"/><text x="327" y="305" text-anchor="middle" style="fill:var(--muted);font-size:11px">逐条处理</text>` +
            box(470, 236, 90, 60, "实时视图", "") + cnt("rt", 515, 286) +
            box(600, 115, 150, 110, "服务层", "合并两路视图响应查询") +
            `<text id="sim-lam-m1" x="675" y="170" text-anchor="middle" style="font-size:12px;fill:var(--muted)">批 0 + 实时 0</text><text id="sim-lam-m2" x="675" y="200" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--ok)">= 0</text>`;
          say("Lambda：事件流入数据总线后分两路——批处理层攒一批再整块重算（慢但准），速度层逐条处理（快但近似），服务层把两路视图合并。注意：两套代码，逻辑要保持一致，维护成本高。");
        } else {
          st = { acc: 0, n: 60, v1: 60, v2: 0, rp: null, rpa: 0, cur: "v1" };
          svg.innerHTML = lines([[70, 170, 110, 170], [450, 160, 500, 70], [610, 70, 640, 70], [330, 190, 500, 280, 1], [610, 280, 640, 280, 1]]) +
            box(10, 150, 60, 40, "数据源", "") +
            `<text x="280" y="124" text-anchor="middle" style="font-weight:600">不可变日志（Kafka）· 只追加、可回放</text><rect class="box" x="110" y="150" width="340" height="40" rx="6"/><rect id="sim-lam-lg" x="110" y="150" width="340" height="40" rx="6" style="fill:var(--accent-soft);stroke:var(--accent)"/>` +
            [1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${110 + i * 42.5}" y1="150" x2="${110 + i * 42.5}" y2="190" style="stroke:var(--line)"/>`).join("") +
            `<text x="110" y="144" style="fill:var(--muted);font-size:11px">offset 0</text><text id="sim-lam-hd" x="450" y="144" text-anchor="end" style="fill:var(--muted);font-size:11px"></text>` +
            `<path id="sim-lam-c1" d="M0 0l-6 9h12z" style="fill:var(--ok)"/><text x="440" y="232" text-anchor="end" style="fill:var(--ok);font-size:11px">▲ v1 消费位点（紧跟末尾）</text>` +
            `<path id="sim-lam-c2" d="M0 0l-6 9h12z" style="fill:var(--mid);display:none"/><text id="sim-lam-c2t" x="110" y="250" style="fill:var(--mid);font-size:11px"></text>` +
            box(500, 40, 110, 60, "流处理作业 v1", "Flink（一套代码）", "sim-lam-j1") + box(640, 40, 110, 60, "视图 v1", "", "sim-lam-w1") + cnt("v1", 695, 90) +
            box(500, 250, 110, 60, "流处理作业 v2", "新逻辑，从头重放", "sim-lam-j2") + box(640, 250, 110, 60, "视图 v2", "", "sim-lam-w2") + cnt("v2", 695, 300) +
            `<g class="sim-lam-tg ok" id="sim-lam-sv"><rect x="640" y="150" width="110" height="26" rx="13" style="stroke:var(--ok)"/><text x="695" y="168" style="fill:var(--ok)">查询 → 视图 v1</text></g>`;
          say("Kappa：事件写入不可变日志，只有一条流处理链路，结果写入服务层。需要改逻辑时，点「重放」：用新版本作业 v2 从日志起点重新消费，追平后切换。只有一套代码；依赖日志可回放与流处理吞吐，历史数据重算成本高。");
        }
        paint();
      }
      function paint() {
        if (mode === "lambda") {
          for (let i = 0; i < NSLOT; i++) g("sq" + i).style.display = i < st.pile.length ? "" : "none";
          setTxt(root, "#sim-lam-pc", `待处理 ${st.pile.length} 条`);
          g("cd").setAttribute("width", Math.min(1, st.bt / BATCH) * 190);
          setTxt(root, "#sim-lam-ct", st.batching ? "批处理计算中…" : `下次整批计算 ${Math.max(0, Math.ceil((BATCH - st.bt) / 1000))}s 后`);
          setTxt(root, "#sim-lam-bv", st.bv); setTxt(root, "#sim-lam-rt", st.rt.length);
          setTxt(root, "#sim-lam-m1", `批 ${st.bv} + 实时 ${st.rt.length}`); setTxt(root, "#sim-lam-m2", `= ${st.bv + st.rt.length}`);
        } else {
          setTxt(root, "#sim-lam-hd", `head = ${st.n}`);
          g("c1").setAttribute("transform", "translate(450 194)");
          const c2 = g("c2"), off = st.rp ? st.rp.off : 0;
          c2.style.display = st.rp ? "" : "none";
          if (st.rp) { c2.setAttribute("transform", `translate(${110 + 340 * Math.min(1, off / st.n)} 194)`); setTxt(root, "#sim-lam-c2t", `▲ v2 重放位点 offset ${Math.floor(off)}`); $(root, "#sim-lam-c2t").setAttribute("x", 110 + 340 * Math.min(1, off / st.n)); $(root, "#sim-lam-c2t").setAttribute("text-anchor", off / st.n > 0.45 ? "end" : "start"); } else setTxt(root, "#sim-lam-c2t", "");
          setTxt(root, "#sim-lam-v1", st.v1); setTxt(root, "#sim-lam-v2", st.v2);
          [g("j1"), g("w1"), g("v1")].forEach((e) => { e.style.opacity = st.cur === "v1" ? 1 : 0.4; }); // v2 上线后 v1 变灰（下线）
          $(g("w1"), "rect").style.stroke = st.cur === "v1" ? "var(--ok)" : "";
          $(g("j2"), "rect").style.stroke = st.cur === "v2" ? "var(--ok)" : st.rp ? "var(--mid)" : "";
          $(g("w2"), "rect").style.stroke = st.cur === "v2" ? "var(--ok)" : "";
          $(g("sv"), "text").textContent = "查询 → 视图 " + st.cur;
        }
      }
      function emit() {
        if (mode === "lambda") {
          const s = ++st.seq;
          fl.fly([[70, 170], [135, 170], [215, 72], slot(Math.min(st.pile.length, NSLOT - 1))], { dur: 1000, done: () => { st.pile.push(s); } });
          fl.fly([[70, 170], [135, 170], [215, 268], [330, 285], [470, 266]], { dur: 1700, cls: "mid", done: () => { if (s > st.bseq) st.rt.push(s); } });
        } else {
          fl.fly([[70, 170], [110, 170]], { dur: 350, done: () => {
            st.n++;
            const live = st.cur === "v1";
            fl.fly([[450, 170], [500, live ? 72 : 282], [640, live ? 72 : 282]], { dur: 1100, cls: live ? "" : "ok", done: () => { if (live) st.v1++; else st.v2++; } });
          } });
        }
      }
      function runBatch() { // 批处理层：整块处理（方块一起移动），完成后批视图覆盖速度层已计入的部分
        if (st.batching) return;
        st.bt = 0;
        const snap = st.pile.splice(0);
        if (!snap.length) { say("批处理层：这一轮还没有攒到数据，等下一轮。"); return; }
        st.batching = true;
        const mx = Math.max(...snap), k = Math.min(snap.length, NSLOT);
        say(`批处理层：把攒下的 ${snap.length} 条整块重算（慢但准），产出批视图；完成后，速度层里已被批视图覆盖的那部分增量就可以丢弃了。`, "ok");
        const j = join(k, () => { st.bv += snap.length; st.bseq = mx; st.rt = st.rt.filter((x) => x > mx); st.batching = false; say(`批视图更新：累计 ${st.bv} 条（准确）。实时视图只保留批处理之后的 ${st.rt.length} 条增量 → 服务层查询 = 批视图 + 实时视图。`, "ok"); });
        for (let i = 0; i < k; i++) fl.fly([slot(i), [515, 70]], { dur: 1100, rect: true, cls: "ok", done: j });
      }
      function query() {
        if (qbusy || mode !== "lambda") return;
        qbusy = true;
        const back = join(2, () => { qbusy = false; say(`查询结果 = 批视图 ${st.bv} + 实时视图 ${st.rt.length} = ${st.bv + st.rt.length}：服务层合并两路视图，既准确又实时。`, "ok"); });
        const out = join(2, () => { fl.fly([[560, 70], [600, 150]], { dur: 500, cls: "ok", label: st.bv, done: back }); fl.fly([[560, 266], [600, 190]], { dur: 500, cls: "mid", label: st.rt.length, done: back }); });
        fl.fly([[600, 150], [560, 70]], { dur: 500, cls: "ok", label: "查批视图", done: out });
        fl.fly([[600, 190], [560, 266]], { dur: 500, cls: "mid", label: "查实时视图", done: out });
      }
      function replay() {
        if (mode !== "kappa" || st.rp) return;
        if (st.cur === "v2") { say("已经切换到视图 v2；点「重置」可以再演示一次重放。"); return; }
        st.rp = { off: 0 }; st.v2 = 0;
        say("重放：新版本作业 v2 从日志起点（offset 0）重新消费全部历史，同时旧的 v1 仍在对外服务；v2 追上末尾后切换，v1 下线。", "ok");
        paint();
      }
      g("act").addEventListener("click", () => { if (mode === "lambda") runBatch(); else replay(); });
      g("q").addEventListener("click", query);
      g("reset").addEventListener("click", scene);
      g("rate").addEventListener("input", () => { rate = +g("rate").value; setTxt(root, "#sim-lam-ratev", rate + "/s"); });
      $$(root, ".sim-lam-m").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.m; qbusy = false; scene(); }));
      ctx.every(() => {
        const dt = 50;
        fl.tick(dt);
        st.acc += rate * dt / 1000;
        while (st.acc >= 1) { st.acc -= 1; emit(); }
        if (mode === "lambda") { if (!st.batching) { st.bt += dt; if (st.bt >= BATCH) runBatch(); } }
        else if (st.rp) {
          st.rp.off += 16 * dt / 1000; st.v2 = Math.floor(st.rp.off); st.rpa += dt;
          if (st.rpa >= 250) { st.rpa = 0; fl.fly([[110 + 340 * Math.min(1, st.rp.off / st.n), 194], [500, 282], [640, 282]], { dur: 800, cls: "mid" }); }
          if (st.rp.off >= st.n) { st.v2 = st.n; st.rp = null; st.cur = "v2"; say(`v2 已追平日志末尾（${st.n} 条），服务层切换到视图 v2，v1 下线。用「重放」代替了批处理：同一套新代码，历史与实时都由它算。`, "ok"); }
        }
        paint();
      }, 50);
      scene();
    },
    say: [
      "Lambda 三层职责：批处理层存主数据集并预计算批视图（慢但准）；速度层只处理最近数据的增量视图（快但近似）；服务层合并两路视图响应查询。缺点：批、流两套代码要保持逻辑一致，维护成本高。",
      "Kappa 的核心是「日志可重放」：只保留流处理一条链路；需要修正逻辑时，用新版本作业从日志起点重放，产出新视图后切换，用重放代替批处理。",
      "选择依据：既要低延迟又要对历史全量精确重算、已有批处理资产 → Lambda；以实时为主、逻辑能统一、日志能长期保留且流处理吞吐足够 → Kappa。"
    ],
    cards: ["a36"]
  });

  // =====================================================================
  // ③-5 六边形架构·端口与适配器
  // =====================================================================
  const HEX_AD = [
    { n: "省统一身份认证适配器", port: "身份认证端口", impl: ["真实：省统一认证", "新版本：认证接口 v2", "Mock：固定测试用户"] },
    { n: "委办局审批接口适配器", port: "审批端口", impl: ["真实：XML 接口", "新版本：JSON 接口", "Mock：自动通过"] },
    { n: "电子证照库适配器", port: "证照端口", impl: ["真实：证照库 API", "新版本：证照库 v2", "Mock：内存证照"] },
    { n: "数据库 Repository 适配器", port: "仓储端口", impl: ["真实：关系数据库", "新版本：换数据库实现", "Mock：内存仓储"] },
    { n: "消息队列适配器", port: "消息端口", impl: ["真实：MQ", "新版本：MQ 新版客户端", "Mock：内存事件总线"] }
  ];
  const HEX_IN = ["Web 页面 / 移动端 API", "批量导入"];
  const HEX_TESTS = ["申报表单校验", "办件状态流转", "超时催办规则", "材料齐全性规则", "重复申报校验", "出证条件判断"];
  const HEX_PY = [135, 172, 210, 248, 285], HEX_AY = [55, 135, 215, 295, 375];

  reg({
    id: "hex", name: "六边形架构·端口与适配器", tag: "K12", kit: "K12",
    intro: "对应 2026 上半年「论六边形架构的设计与应用」：点击右侧任一出站适配器切换实现，看变化只落在适配器上、领域核心 0 行改动；再打开「反模式」对比，并一键用 Mock 跑核心单元测试。",
    render() {
      const ad = HEX_AD.map((a, i) => `<g class="sim-hex-ad" id="sim-hex-ad${i}" data-i="${i}"><rect class="box" x="600" y="${HEX_AY[i] - 27}" width="150" height="54" rx="8"/>
        <text x="675" y="${HEX_AY[i] - 6}" text-anchor="middle" style="font-weight:600;font-size:11.5px">${a.n}</text><text id="sim-hex-im${i}" x="675" y="${HEX_AY[i] + 14}" text-anchor="middle" style="font-size:11px;fill:var(--muted)">${a.impl[0]}</text></g>
        <line class="flow" x1="552" y1="${HEX_PY[i]}" x2="600" y2="${HEX_AY[i]}"/>
        <text x="524" y="${HEX_PY[i] + 4}" text-anchor="end" style="font-size:11px;fill:var(--muted)">${a.port}</text><rect class="sim-hex-port" x="529" y="${HEX_PY[i] - 11}" width="22" height="22" rx="4"/>`).join("");
      const inn = HEX_IN.map((t, i) => `<rect class="box" x="10" y="${123 + i * 120}" width="150" height="54" rx="8"/><text x="85" y="${155 + i * 120}" text-anchor="middle" style="font-weight:600;font-size:12px">${t}</text><line class="flow" x1="160" y1="${150 + i * 120}" x2="209" y2="210"/>`).join("");
      const anti = HEX_AD.map((_, i) => `<line x1="440" y1="${190 + i * 10}" x2="600" y2="${HEX_AY[i]}" style="stroke:var(--bad);stroke-width:1.8;stroke-dasharray:5 4"/>`).join("");
      const tests = HEX_TESTS.map((t, i) => `<span class="sim-hex-t" id="sim-hex-t${i}">${t}</span>`).join("");
      return `<div class="sim-ctl">
          <button class="primary" id="sim-hex-mock">全部换成 Mock，一键跑核心单元测试</button><button id="sim-hex-real">复位（全部恢复真实）</button><button id="sim-hex-flow">模拟一次申报</button>
          <label><input type="checkbox" id="sim-hex-anti">反模式：核心直接依赖外部接口</label>
        </div>
        <svg id="sim-hex-svg" viewBox="0 0 760 420" width="100%" role="img" aria-label="六边形架构">
          <text x="10" y="16" style="font-weight:600;fill:var(--muted)">驱动端（入站）适配器</text><text x="750" y="16" text-anchor="end" style="font-weight:600;fill:var(--muted)">被驱动端（出站）适配器 · 点击切换实现</text>
          ${inn}
          <polygon id="sim-hex-core" class="sim-hex-core" points="380,25 540.2,117.5 540.2,302.5 380,395 219.8,302.5 219.8,117.5"/>
          <g id="sim-hex-anti-g" style="display:none">${anti}</g>
          <text x="380" y="190" text-anchor="middle" style="font-weight:700;font-size:16px">领域核心</text><text x="380" y="212" text-anchor="middle" style="font-size:13px">申报办件</text>
          <text x="380" y="231" text-anchor="middle" style="font-size:12px;fill:var(--muted)">表单 · 办件状态</text><text x="380" y="248" text-anchor="middle" style="font-size:12px;fill:var(--muted)">业务规则</text>
          <text id="sim-hex-cs" x="380" y="290" text-anchor="middle" style="font-size:12px;fill:var(--ok);font-weight:600">核心：0 行改动</text>
          <rect class="sim-hex-port" x="209" y="199" width="22" height="22" rx="4"/><text x="238" y="214" style="font-size:11px;fill:var(--muted)">申报用例端口</text>
          ${ad}
        </svg>
        <div style="margin-top:8px"><b>核心单元测试</b>（全部出站适配器换成 Mock 才能脱离外部系统运行）：<div id="sim-hex-tests">${tests}</div></div>
        <div class="sim-note" id="sim-hex-note"></div>
        <div class="sim-kpi"><div><div class="label">已替换的适配器</div><div class="v" id="sim-hex-k1">0 / 5</div></div><div><div class="label">领域核心改动</div><div class="v ok" id="sim-hex-k2">0 行</div></div><div><div class="label">核心单元测试</div><div class="v" id="sim-hex-k3">未运行</div></div></div>
        <div class="panel flat" style="margin-top:10px;font-size:13px"><b>与分层架构 / 微服务的关系：</b>传统分层是「上层依赖下层」，业务层会依赖数据访问层、外部接口的具体实现；六边形是<b>依赖倒置</b>——核心自己定义端口（接口），适配器去实现端口，所有依赖都指向核心。每个微服务内部都可以是一个六边形；本项目「部门办理服务」里的适配层，就是一个六边形的出站适配器集合，起到防腐层（ACL）的作用，挡住各委办局接口的差异。</div>`;
    },
    mount(root, ctx) {
      const g = (s) => $(root, "#sim-hex-" + s);
      const svg = g("svg"), note = g("note"), fl = Flyer(svg, "hex");
      let impl = [0, 0, 0, 0, 0], anti = false, forced = 0, test = null, tt = 0;
      const say = (t, tone) => { note.className = "sim-note " + (tone || ""); note.textContent = t; };
      function paint() {
        HEX_AD.forEach((a, i) => {
          const e = g("ad" + i);
          e.setAttribute("class", "sim-hex-ad" + (impl[i] === 1 ? " chg" : impl[i] === 2 ? " mock" : ""));
          setTxt(root, "#sim-hex-im" + i, a.impl[impl[i]]);
          $(e, "#sim-hex-im" + i).style.fill = impl[i] === 1 ? "var(--accent)" : impl[i] === 2 ? "var(--mid)" : "var(--muted)";
        });
        g("core").setAttribute("class", "sim-hex-core" + (forced ? " bad" : ""));
        g("anti-g").style.display = anti ? "" : "none";
        svg.setAttribute("class", anti ? "sim-hex-anti" : "");
        const cs = g("cs");
        cs.textContent = forced ? `核心被迫改动 ×${forced}` : anti ? "核心直连外部接口" : "核心：0 行改动";
        cs.style.fill = forced || anti ? "var(--bad)" : "var(--ok)";
        setTxt(root, "#sim-hex-k1", impl.filter((x) => x).length + " / 5");
        const k2 = g("k2"); k2.textContent = forced ? `被迫改动 ×${forced}` : "0 行"; k2.className = "v " + (forced ? "bad" : "ok");
        const ks = test === null ? "未运行" : test.i < HEX_TESTS.length ? "运行中…" : test.fail ? "失败" : "6/6 通过";
        const k3 = g("k3"); k3.textContent = ks; k3.className = "v " + (test && test.i >= HEX_TESTS.length ? (test.fail ? "bad" : "ok") : "");
        HEX_TESTS.forEach((_, i) => { const t = g("t" + i); t.className = "sim-hex-t" + (test && i < test.i ? (test.fail ? " bad" : " ok") : ""); });
      }
      function flow() { // 一次申报：入站适配器 → 入站端口 → 核心 → 各出站端口 → 适配器
        if (fl.n) return;
        fl.fly([[160, 150], [209, 210], [330, 210]], { dur: 900, label: "申报", done: () => {
          HEX_AD.forEach((_, i) => fl.fly(anti ? [[440, 200], [600, HEX_AY[i]]] : [[440, 215], [540, HEX_PY[i]], [600, HEX_AY[i]]], { dur: 900, delay: i * 120, cls: anti ? "bad" : impl[i] === 2 ? "mid" : "ok" }));
        } });
      }
      function sw(i) { // 切换出站适配器的实现
        const old = HEX_AD[i].impl[impl[i]];
        impl[i] = (impl[i] + 1) % 3; test = null;
        const cur = HEX_AD[i].impl[impl[i]], e = g("ad" + i);
        e.classList.remove("pulse"); void e.getBoundingClientRect(); e.classList.add("pulse");
        if (anti) { forced++; say(`「${HEX_AD[i].n}」${old} → ${cur}：核心里直接调用了外部接口，必须同步修改核心代码（变红）→ 外部一变，核心被迫改动。`, "bad"); }
        else say(`「${HEX_AD[i].n}」${old} → ${cur}：只有这 1 个适配器改动，端口接口不变，领域核心 0 行改动。${impl[i] === 2 ? "Mock 是测试替身，核心完全不知道对面是真是假。" : ""}`, "ok");
        paint(); flow();
      }
      $$(root, ".sim-hex-ad").forEach((e) => e.addEventListener("click", () => sw(+e.dataset.i)));
      g("anti").addEventListener("change", () => {
        anti = g("anti").checked; forced = 0; test = null;
        say(anti ? "反模式：核心直接依赖外部接口（红色虚线直连，绕过了端口）。现在点右侧适配器切换实现，看核心会不会被迫改动。" : "已回到正确做法：核心只依赖自己定义的端口，外部变化被适配器挡住。", anti ? "bad" : "");
        paint();
      });
      g("mock").addEventListener("click", () => {
        impl = [2, 2, 2, 2, 2]; test = { i: 0, fail: anti };
        say(anti ? "核心直接依赖外部接口，无法换成 Mock：单测要么连真实的外部系统（慢、不稳、有副作用），要么根本跑不起来 → 测试变红。" : "出站适配器全部换成内存 Mock，核心单元测试脱离外部系统运行：快、稳定、可重复。", anti ? "bad" : "ok");
        paint();
      });
      g("real").addEventListener("click", () => { impl = [0, 0, 0, 0, 0]; test = null; forced = 0; anti = g("anti").checked = false; fl.clear(); say("已复位：所有出站适配器恢复真实实现，反模式关闭。"); paint(); });
      g("flow").addEventListener("click", flow);
      ctx.every(() => {
        fl.tick(40);
        if (test && test.i < HEX_TESTS.length) { tt += 40; if (tt >= 280) { tt = 0; test.i++; paint(); if (test.i >= HEX_TESTS.length) say(test.fail ? "6 个核心用例全部失败：依赖外部接口的核心无法独立测试。" : "6/6 通过：不依赖任何外部系统，核心业务规则可以快速、稳定地验证。", test.fail ? "bad" : "ok"); } }
      }, 40);
      let auto = 0;
      ctx.every(() => { if (++auto % 4 === 2) flow(); }, 1000); // 每 4 秒自动演示一次申报流转
      say("中间是领域核心（申报办件），六边形边界是「端口」（接口），外圈是「适配器」。点右侧任一出站适配器切换实现（真实 → 新版本 → Mock），观察谁在变。");
      paint();
    },
    say: [
      "六边形架构 = 端口与适配器 = 依赖倒置：核心业务与外部技术解耦，便于测试与替换；与 DDD、整洁架构同源。",
      "核心定义端口（入站端口给驱动方调用，出站端口由适配器实现）；外部系统（认证、审批、证照库、数据库、MQ）的变化只落在适配器上，核心 0 行改动。",
      "分析 - 设计 - 开发流程：识别领域与用例 → 定义入站 / 出站端口 → 实现适配器 → 用 Mock 适配器做核心测试 → 集成联调。",
      "与分层架构的区别：分层是上层依赖下层，六边形是所有依赖指向核心；与微服务的关系：每个微服务内部可以是一个六边形，适配层兼作防腐层。"
    ],
    cards: ["a9", "a29"]
  });
})();
