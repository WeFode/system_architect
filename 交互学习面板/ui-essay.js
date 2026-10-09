// 论文工坊：终版模板 + 15 套题（槽位）+ 题材雷达 + 组装 / 默写核对 + 限时写作。
// 数据来自 essay-data.js（由《论文终版模板.md》《论文套题库.md》解析）和 essay-matrix.js（真题映射、关键词、排期）。
(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  const SUBS = [["radar", "题材雷达"], ["template", "终版模板"], ["recall", "套题背诵"], ["assemble", "组装与默写"], ["profile", "事实表"], ["write", "限时写作"], ["rules", "结构与雷区"]];
  const SLOT_INFO = {
    A: ["扣题句", "第一段末尾，接在“业务并发高峰又集中在申报端，”之后"],
    S: ["摘要句", "摘要里，“8 倍左右。”之后"],
    B: ["理论", "第二段开头，回答第 2 问"],
    B2: ["取舍句", "第二段末尾，三条标准之后"],
    C: ["落地段", "第三段末尾，回答第 3 问，与 B 一一对位"],
    E: ["桥接句", "第四段开头，把上线初期的故障与本题挂钩"],
    D: ["升华句", "全文最后一句"]
  };
  const SLOT_ORDER = ["B", "C", "A", "S", "B2", "E", "D"];
  const WEIGHT = { B: 2, C: 2 };
  const GAP = [0, 1, 2, 3, 5];
  const PARTS = [["abstract", "摘要"], ["p1", "第一段 项目背景与我的工作"], ["p2", "第二段 理论论述"], ["p3", "第三段 落地实践"], ["p4", "第四段 故障、改造与总结"]];
  const SECT = [["abstract", "摘要"], ["p1", "第一段"], ["p2", "第二段"], ["p3full", "第三段（完整版）"], ["p3short", "第三段（简版）"], ["p4", "第四段"]];
  const SEGS = [["选题", 5], ["列提纲", 3], ["摘要", 12], ["第一段", 12], ["第二段", 20], ["第三段", 28], ["第四段", 15], ["检查", 10], ["余量", 15]];
  const COLORS = ["var(--faint)", "var(--mid)", "var(--accent)", "var(--ok)", "var(--bad)", "var(--accent)", "var(--ok)", "var(--mid)", "var(--faint)"];
  const TARGET_CPM = 33;

  if (!document.getElementById("kd-essay-style")) {
    const st = document.createElement("style");
    st.id = "kd-essay-style";
    st.textContent = `
      .ess-text { line-height: 1.85; font-size: 14px; }
      .ess-text p { margin: 0 0 8px; }
      .ess-text.hint { color: var(--muted); letter-spacing: .02em; }
      .ess-mask { padding: 14px; border: 1px dashed var(--line); border-radius: 8px; color: var(--faint); text-align: center; margin: 6px 0; }
      .slotchip { display: inline-block; font-size: 12px; padding: 0 7px; margin: 0 2px; border-radius: 4px; background: var(--accent-soft); border: 1px solid var(--accent); color: var(--accent); font-weight: 600; white-space: nowrap; }
      .slotseg { background: var(--accent-soft); border-bottom: 2px solid var(--accent); padding: 0 1px; }
      button.chip { display: inline-block; padding: 1px 8px; margin: 2px 3px 2px 0; border-radius: 6px; font-size: 12px; background: var(--fill); }
      button.chip.s { border-color: var(--accent); background: var(--accent-soft); }
      button.chip.a { border-color: var(--mid); }
      button.chip.done { border-color: var(--ok); }
      span.chip.z { display: inline-block; padding: 1px 8px; margin: 2px 3px 2px 0; border-radius: 6px; font-size: 12px; border: 1px dashed var(--line); color: var(--faint); }
      .meter { display: inline-block; width: 64px; height: 6px; border-radius: 3px; background: var(--fill); vertical-align: middle; overflow: hidden; }
      .meter i { display: block; height: 100%; background: var(--ok); }
      .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 10px 0; }
      .tiles > div { background: var(--fill); border-radius: 8px; padding: 10px 12px; }
      .tiles .big { font-size: 24px; }
      .slotcard { margin: 10px 0; }
      .slotcard .hd { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
      .cl.ok { color: var(--ok); } .cl.mid { color: var(--mid); background: color-mix(in srgb, var(--mid) 12%, transparent); } .cl.bad { color: var(--bad); background: color-mix(in srgb, var(--bad) 12%, transparent); text-decoration: underline wavy; }
      tr.today td { background: var(--accent-soft); }
      .factrow td:nth-child(2) { cursor: default; }
      .factmask { color: var(--faint); background: var(--fill); border-radius: 4px; padding: 0 8px; cursor: pointer; }
    `;
    document.head.appendChild(st);
  }

  // ---------- 数据 ----------
  const DATA = () => window.ESSAY_FINAL || { template: null, kits: [], facts: [], stats: { template: {}, kits: {} }, md: {} };
  const MX = () => window.ESSAY_MATRIX || { exams: [], quads: [], keys: {}, fallback: [], plan: [] };
  const kits = () => DATA().kits;
  const kitOf = (id) => kits().find((k) => k.id === id);
  const curKit = () => kitOf(api.S.kitId) || kits()[0];
  const kstat = (k) => (DATA().stats.kits || {})[k.id] || { abstract: 0, body: 0, total: 0, parts: {}, slots: {} };
  const lenOf = (s) => String(s || "").replace(/[\s【】]/g, "").length;
  const shortName = (n, id) => ((window.ESSAY_MATRIX || {}).short || {})[id] || n.split(/[：（]/)[0].slice(0, 12);
  const missing = () => `<div class="panel"><p class="bad">论文数据没有载入。请先运行 <code>node scripts/prepare-site.js</code> 生成 essay-data.js。</p></div>`;

  // ---------- 背诵标记（槽位级间隔重复） ----------
  const marks = () => api.S.kitMark || (api.S.kitMark = {});
  const mkey = (kid, s) => kid + "." + s;
  const slotScore = (kid, s) => { const r = marks()[mkey(kid, s)]; return r ? [0, 0.34, 0.67, 1, 1][r[0]] : 0; };
  const slotsOf = (k) => Object.keys(k.slots).filter((s) => SLOT_INFO[s]);
  function mastery(k) {
    let sum = 0, tot = 0;
    slotsOf(k).forEach((s) => { const w = WEIGHT[s] || 1; tot += w; sum += w * slotScore(k.id, s); });
    return tot ? sum / tot : 0;
  }
  const isDone = (k) => mastery(k) >= 0.85;
  const pct = (x) => Math.round(x * 100) + "%";
  const meter = (x) => `<span class="meter"><i style="width:${Math.round(x * 100)}%"></i></span>`;
  const dueCount = (k) => slotsOf(k).filter((s) => { const r = marks()[mkey(k.id, s)]; return r && r[1] <= api.today(); }).length;
  const learnedSlots = () => kits().reduce((a, k) => a + slotsOf(k).filter((s) => marks()[mkey(k.id, s)]).length, 0);
  const totalSlots = () => kits().reduce((a, k) => a + slotsOf(k).length, 0);

  // ---------- 组装 ----------
  function fillSlots(text, k, hl) {
    return text.replace(/【([A-Z]\d?)】/g, (m, s) => { const v = k.slots[s] || ""; return hl ? "\u0001" + s + "\u0003" + v + "\u0002" : v; });
  }
  function parts(k, hl) {
    const t = DATA().template, f = (x) => fillSlots(x, k, hl);
    return { abstract: t.abstract.map(f), p1: t.p1.map(f), p2: t.p2.map(f), p3: (k.p3 === "简版" ? t.p3short : t.p3full).map(f), p4: t.p4.map(f) };
  }
  const titleOf = (k) => "论" + k.name;
  function plainEssay(k) {
    const p = parts(k, false);
    return `${titleOf(k)}\n\n摘要\n${p.abstract.join("\n")}\n\n正文\n${[].concat(p.p1, p.p2, p.p3, p.p4).join("\n")}`;
  }
  const slotHtml = (text) => esc(text).replace(/【([A-Z]\d?)】/g, (m, s) => `<span class="slotchip" title="${esc((SLOT_INFO[s] || [""])[0])}">${s} ${esc((SLOT_INFO[s] || ["槽"])[0])}</span>`);
  const segHtml = (text) => esc(text)
    .replace(/\u0001([A-Z]\d?)\u0003/g, (m, s) => `<span class="slotseg" title="${esc((SLOT_INFO[s] || [""])[0])}">`)
    .replace(/\u0002/g, "</span>");
  const clauseHint = (t) => t.replace(/[^，。；：、？！\n]+/g, (m) => { const s = m.trim(); if (!s) return m; const tok = /^[A-Za-z0-9]+|^[（(][一二三四五六七八九十0-9]+[）)]./.exec(s); return (tok ? tok[0] : s[0]) + "…"; });
  const hintHtml = (text) => text.split(/(【[A-Z]\d?】)/).map((x) => (/^【/.test(x) ? slotHtml(x) : esc(clauseHint(x)))).join("");

  // ---------- 遮住 / 首字提示（模板与套题共用） ----------
  const mode = () => api.S.essayMode || "full";
  const shown = (key) => !!(api.S.essayShow || {})[key];
  function modeBar() {
    const m = mode();
    return `<div class="row" style="margin:6px 0 12px"><span class="faint">看法</span>${[["full", "全文"], ["hint", "首字提示"], ["mask", "遮住默写"]].map(([v, n]) => `<button class="pill ${m === v ? "on" : ""}" data-act="emode" data-v="${v}">${n}</button>`).join("")}
      <span class="faint">先选“遮住默写”自己说一遍，再点“露出”核对。</span></div>`;
  }
  function cover(key, nChars, fullHtml, hint) {
    const m = mode();
    if (m === "full") return `<div class="ess-text">${fullHtml}</div>`;
    if (shown(key)) return `<div class="ess-text">${fullHtml}</div><div><button class="ghost" data-act="ehide" data-v="${key}">盖上</button></div>`;
    const inner = m === "hint" ? `<div class="ess-text hint">${hint}</div>` : `<div class="ess-mask">${nChars} 字 · 先在心里默一遍，再点“露出”核对</div>`;
    return `${inner}<div><button data-act="eshow" data-v="${key}">露出</button></div>`;
  }
  const paras = (arr, f) => arr.map((x) => `<p>${f(x)}</p>`).join("");

  // ---------- 雷达 ----------
  const dateStr = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  const rank = () => {
    const order = ["K02", "K03", "K08", "K09", "K01", "K05", "K06", "K04", "K12", "K07", "K14", "K13", "K10", "K11", "K15"];
    const ks = kits().slice().sort((a, b) => (order.indexOf(a.id) < 0 ? 99 : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? 99 : order.indexOf(b.id)));
    return ks;
  };
  const goBtn = (target, text, cls) => `<button class="${cls || ""}" data-act="go" data-v="${target}">${text}</button>`;
  const recallGo = (k) => `essay:recall:kitId=${k.id}`;

  function pickOut() {
    const q = (api.S.essayQ || "").trim();
    if (!q) return `<p class="faint">没输入时这里是空的。输入题目里的关键词，会推荐最对口的套题。</p>`;
    const lower = q.toLowerCase();
    const hits = kits().map((k) => {
      const ks = ((MX().keys || {})[k.id] || []).filter((w) => lower.includes(w.toLowerCase()));
      return { k, ks, score: ks.reduce((a, w) => a + w.length, 0) };
    }).filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    const fb = (MX().fallback || []).filter((f) => f.k.some((w) => lower.includes(w.toLowerCase())));
    let html = "";
    if (hits.length) {
      html += hits.map((h, i) => `<div class="row" style="margin:6px 0;justify-content:space-between"><span>${i === 0 ? "<b class=\"ok\">首选</b>" : "<span class=\"faint\">备选</span>"} <b>${esc(h.k.id)} ${esc(h.k.name)}</b> <span class="faint">命中：${h.ks.map(esc).join("、")} · ${esc(h.k.tier)} · 背熟度 ${pct(mastery(h.k))}</span></span>
        <span>${goBtn(recallGo(h.k), "去背")} ${goBtn("essay:assemble:kitId=" + h.k.id, "看整篇", "ghost")}</span></div>`).join("");
      html += `<p class="faint">多个套题同时命中时，以考卷里第 2 问问的是什么为准，就用哪一套的 B 理论和 C 落地段。</p>`;
    }
    if (fb.length) {
      html += `<div class="sim-note" style="margin-top:8px"><b>没有专门套题，走兜底三步法</b>${fb.map((f) => `<p style="margin:4px 0">${esc(f.k.join(" / "))}：${esc(f.hook)}</p>`).join("")}</div>`;
    }
    if (!hits.length && !fb.length) {
      html = `<p class="bad">没有命中任何关键词。先判断它属于数据、服务与云、性能与质量、工程与 AI 四类中的哪一类，再用下面的“兜底三步法”写。</p>`;
    }
    return html;
  }

  function renderRadar() {
    const S = api.S, mx = MX(), d = DATA();
    if (!d.template) return missing();
    const all = mx.exams.flatMap((e) => e.items);
    const direct = all.filter(([, id]) => id && kitOf(id));
    const tierS = direct.filter(([, id]) => kitOf(id).tier === "必背");
    const done = direct.filter(([, id]) => isDone(kitOf(id)));
    const left = S.examDate ? Math.round((Date.parse(S.examDate) - Date.parse(dateStr())) / 864e5) : null;
    const next = rank().find((k) => !isDone(k));
    const today = dateStr();
    const examRows = mx.exams.map((e) => `<tr><td style="white-space:nowrap">${esc(e.y)}</td><td>${e.items.map(([n, id]) => {
      const k = id && kitOf(id);
      if (!k) return `<span class="chip z" title="没有专门套题，走兜底三步法">${esc(n)} · 兜底</span>`;
      return `<button class="chip ${k.tier === "必背" ? "s" : "a"} ${isDone(k) ? "done" : ""}" data-act="go" data-v="${recallGo(k)}" title="${esc(k.name)}">${esc(n)} <b>${esc(id)}</b></button>`;
    }).join("")}</td></tr>`).join("");
    const quads = mx.quads.map((q) => {
      const ks = q.kits.map(kitOf).filter(Boolean);
      const ok = ks.filter(isDone).length;
      return `<div class="panel flat"><div class="row" style="justify-content:space-between"><b>${esc(q.id)} ${esc(q.name)}</b><span class="${ok >= 2 ? "ok" : "bad"}">背熟 ${ok} / 至少 2 套</span></div>
        <p class="faint">近年：${esc(q.eg)}<br>项目契合：${esc(q.fit)}</p>
        ${ks.map((k) => `<div class="row" style="margin:4px 0;justify-content:space-between"><span><b>${esc(k.id)}</b> ${esc(shortName(k.name, k.id))} <span class="tag">${esc(k.tier)}</span></span><span>${meter(mastery(k))} <span class="faint">${pct(mastery(k))}</span> ${goBtn(recallGo(k), "背")}</span></div>`).join("")}</div>`;
    }).join("");
    const rankRows = rank().map((k, i) => `<tr><td>${i + 1}</td><td><b>${esc(k.id)}</b> ${esc(shortName(k.name, k.id))}</td><td style="white-space:nowrap">${esc(k.tier)}</td><td>${esc(k.heat)}</td><td class="faint">${esc(k.exams)}</td>
      <td>${meter(mastery(k))} <span class="faint">${pct(mastery(k))}</span></td><td>${dueCount(k) ? `<b class="mid">${dueCount(k)}</b>` : "0"}</td><td>${goBtn(recallGo(k), "背")}</td></tr>`).join("");
    const planRows = mx.plan.map((p) => `<tr class="${p.from <= today && today <= p.to ? "today" : ""}"><td style="white-space:nowrap">${esc(p.from.slice(5).replace("-", "/"))}${p.to !== p.from ? "–" + esc(p.to.slice(5).replace("-", "/")) : ""}</td><td>${esc(p.task)}</td><td>${goBtn(p.go, "去", "ghost")}</td></tr>`).join("");
    const fb = d.md && d.md.fallback && window.renderMarkdown ? window.renderMarkdown(d.md.fallback).html : "";
    return `
      <p class="muted">目标是论文不踏空：不管考卷怎么出，四道题里至少有一道落在你背熟的套题上，剩下的用兜底法也能写。
        ${left != null ? `距考试日 <b>${left >= 0 ? left + " 天" : "已过"}</b>（日期以准考证为准）。` : ""}</p>
      <div class="panel"><h3 style="margin-top:0">考场选题器</h3>
        <div class="row"><input class="wide" data-bind="essayQ" data-region="essayPick" placeholder="把考卷上的题目抄在这里，例如：论分布式事务及其应用" value="${esc(S.essayQ || "")}"></div>
        <div id="region-essayPick" style="margin-top:8px">${pickOut()}</div></div>
      <div class="tiles">
        <div><div class="label">已背套题槽位</div><div class="big">${learnedSlots()} / ${totalSlots()}</div><p class="faint">今天到期复习的槽位 ${kits().reduce((a, k) => a + dueCount(k), 0)} 个</p></div>
        <div><div class="label">近 10 次真题有专门套题</div><div class="big">${direct.length} / ${all.length}</div><p class="faint">必背的 9 套就覆盖 ${tierS.length} 道</p></div>
        <div><div class="label">按你现在背熟的算</div><div class="big">${done.length} / ${all.length}</div><p class="faint">背熟度 85% 以上才算</p></div>
        <div><div class="label">下一套该背</div><div class="big" style="font-size:18px">${next ? esc(next.id + " " + shortName(next.name, next.id)) : "全部背熟"}</div>${next ? `<p>${goBtn(recallGo(next), "现在去背", "primary")}</p>` : ""}</div>
      </div>
      <p class="faint">套题是照这些真题和近年热点编的，所以“有专门套题”的比例天然偏高，它说明题材铺得够广，不等于对下一次考试的预测。真正防踏空靠两条：每个象限至少背熟两套；遇到没背的题走兜底法。</p>

      <h3>近 10 次真题落在哪套</h3>
      <div class="panel"><table><tbody>${examRows}</tbody></table><p class="faint">2019–2025 为各培训站与希赛网整理的真题；2026 上为考生回忆版，措辞可能有出入。实线框是必背，黄框是选背，虚线是兜底，绿框是你已背熟的。</p></div>

      <h3>四象限：每个象限至少背熟两套</h3>
      <div class="grid g2">${quads}</div>

      <h3>押题顺位与背诵进度</h3>
      <div class="panel"><div class="case-scroll"><table><thead><tr><th>#</th><th>套题</th><th>梯队</th><th>热度</th><th>真题</th><th>背熟度</th><th>到期</th><th></th></tr></thead><tbody>${rankRows}</tbody></table></div>
        <p class="faint">顺位是我的判断，依据是近四考同类出现频次、距上次出现隔了多久、你的项目好不好写，不是保证。</p></div>

      <h3>15 天排期</h3>
      <div class="panel"><table><tbody>${planRows}</tbody></table></div>

      <details class="panel" style="margin-top:14px"><summary style="cursor:pointer;font-weight:600">兜底法：碰到完全没准备的题怎么办</summary><div class="md-body" style="border:0;padding:0 4px">${fb}</div></details>`;
  }

  // ---------- 终版模板 ----------
  function renderTemplate() {
    const S = api.S, d = DATA();
    if (!d.template) return missing();
    const view = S.tplView || "slots";
    const head = `<div class="row" style="margin-bottom:12px">
      <button class="pill ${view === "slots" ? "on" : ""}" data-act="tplview" data-v="slots">母版与槽位</button>
      <button class="pill ${view === "full" ? "on" : ""}" data-act="tplview" data-v="full">完整说明（评估、事实表、排期）</button></div>`;
    if (view === "full") {
      const r = window.renderMarkdown ? window.renderMarkdown(d.md.template) : { html: "", toc: [] };
      return `${head}<div class="md-body">${r.html}</div>`;
    }
    const t = d.template, st = d.stats.template;
    const sec = SECT.map(([k, name]) => `<div class="panel" style="margin:10px 0"><div class="row" style="justify-content:space-between"><b>${name}</b><span class="faint">不含槽位约 ${st[k] || 0} 字</span></div>
      ${cover("T." + k, st[k] || 0, paras(t[k], slotHtml), paras(t[k], (x) => hintHtml(x)))}</div>`).join("");
    const slotTable = `<table><thead><tr><th>槽位</th><th>放在哪里</th></tr></thead><tbody>${Object.entries(SLOT_INFO).map(([s, [n, w]]) => `<tr><td><span class="slotchip">${s} ${n}</span></td><td>${esc(w)}</td></tr>`).join("")}</tbody></table>`;
    return `${head}
      <p class="muted">母版是每个题材都不变的部分，先把它背熟；抽到什么题，就把【】处换成对应套题里的槽位。这份终版是对《论文模板最新版本》评估后的修订：补了摘要、扩了理论与落地、让第二段和第三段不再只适用于微服务，细节见“完整说明”。</p>
      <div class="panel flat" style="margin-bottom:10px">${slotTable}</div>
      ${modeBar()}
      <p class="faint">标题：照抄考卷上的题目。</p>
      ${sec}
      <div class="row">${goBtn("essay:recall:kitId=K01", "去背第一套 K01", "primary")} ${goBtn("essay:profile", "先过一遍事实表", "ghost")}</div>`;
  }

  // ---------- 套题背诵 ----------
  function renderRecall() {
    const S = api.S, d = DATA();
    if (!d.template) return missing();
    const k = curKit();
    const ks = kits();
    const idx = ks.indexOf(k);
    const pills = ["必背", "选背"].map((tier) => `<div class="row" style="margin:4px 0"><span class="faint" style="width:34px">${tier}</span>${ks.filter((x) => x.tier === tier).map((x) => `<button class="pill ${x.id === k.id ? "on" : ""}" data-act="kitpick" data-v="${x.id}" title="${esc(x.name)}">${esc(x.id)} ${esc(shortName(x.name, x.id))}${isDone(x) ? " ✓" : ""}</button>`).join("")}</div>`).join("");
    const cards = SLOT_ORDER.filter((s) => k.slots[s]).map((s) => {
      const [name, where] = SLOT_INFO[s], text = k.slots[s];
      const r = marks()[mkey(k.id, s)];
      const state = r ? (r[1] <= api.today() ? `<b class="mid">今天该复习</b>` : `<span class="faint">下次 ${r[1] - api.today()} 天后</span>`) : `<span class="faint">还没背过</span>`;
      return `<div class="panel slotcard"><div class="hd"><span><span class="slotchip">${s}</span> <b>${name}</b> <span class="faint">${lenOf(text)} 字 · ${esc(where)}</span></span>
        <span class="row">${state}
          <button data-act="kmark" data-v="${k.id}.${s}:0">没背下来</button><button data-act="kmark" data-v="${k.id}.${s}:1">模糊</button><button class="primary" data-act="kmark" data-v="${k.id}.${s}:2">背下来了</button></span></div>
        ${cover(k.id + "." + s, lenOf(text), paras(text.split("\n"), esc), paras(text.split("\n"), (x) => esc(clauseHint(x))))}</div>`;
    }).join("");
    const stt = kstat(k);
    // 动画剧场里挂着这套题的动画：背之前先看一遍，印象更牢
    const sims = (window.KD_SIMS || []).filter((s) => s.kit === k.id || new RegExp("\\b" + k.id + "\\b").test(s.tag || ""));
    const inGraph = window.KD_GRAPH && (window.KD_GRAPH.nodes || []).some((n) => n.id === k.id);
    const simBtns = sims.map((s) => goBtn("anim:simId=" + s.id, "看动画：" + esc(s.name.split(/[·：]/)[0]), "ghost")).join(" ")
      + (inGraph ? " " + goBtn("graph:graphSel=" + k.id, "在图谱里看关联", "ghost") : "");
    return `
      <div style="margin-bottom:6px">${pills}</div>
      <div class="panel" style="margin:12px 0">
        <div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(k.id)} ${esc(k.name)}</h3><span>${meter(mastery(k))} <b>${pct(mastery(k))}</b></span></div>
        <p class="faint" style="margin-top:6px"><span class="tag">${esc(k.tier)}</span><span class="tag">热度 ${esc(k.heat)}</span><span class="tag">象限 ${esc(k.quad)}</span><span class="tag">第三段用${esc(k.p3)}</span> 真题：${esc(k.exams)}</p>
        <p class="faint">拼成整篇：摘要 ${stt.abstract} 字，正文 ${stt.body} 字，合计 ${stt.total} 字。背的顺序：B 理论 → C 落地段 → A 扣题句 → S 摘要句 → B2 取舍句 → E → D。</p>
        ${k.note ? `<p class="muted pre">${esc(k.note)}</p>` : ""}
        <div class="row">${goBtn("essay:assemble:kitId=" + k.id, "看拼成整篇的样子", "primary")} ${goBtn("essay:template", "回母版", "ghost")} ${simBtns}
          <button class="ghost" data-act="kitstep" data-v="-1" ${idx <= 0 ? "disabled" : ""}>上一套</button><button class="ghost" data-act="kitstep" data-v="1" ${idx >= ks.length - 1 ? "disabled" : ""}>下一套</button></div></div>
      ${modeBar()}
      ${cards}`;
  }

  // ---------- 组装与默写 ----------
  function norm(s) { return String(s || "").replace(/[\s，。；：、？！“”‘’（）()【】,.;:?!"'—\-…·]/g, ""); }
  function lcs(a, b) {
    if (!a.length || !b.length) return 0;
    let prev = new Uint16Array(b.length + 1), cur = new Uint16Array(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= b.length; j++) cur[j] = ca === b.charCodeAt(j - 1) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
      const t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  function check(ref, typed) {
    const a = norm(ref), b = norm(typed);
    const bigrams = new Set();
    for (let i = 0; i < b.length - 1; i++) bigrams.add(b.slice(i, i + 2));
    const clauses = [];
    ref.split("\n").forEach((line, li, arr) => {
      (line.match(/[^，。；：？！]+[，。；：？！]?/g) || []).forEach((c) => {
        const n = norm(c);
        let r = 1;
        if (n.length >= 3) { let hit = 0; for (let i = 0; i < n.length - 1; i++) if (bigrams.has(n.slice(i, i + 2))) hit++; r = hit / (n.length - 1); }
        clauses.push([c, r]);
      });
      if (li < arr.length - 1) clauses.push(["\n", 1]);
    });
    return { score: a.length ? lcs(a, b) / a.length : 0, clauses, refLen: a.length, typedLen: b.length };
  }
  function resultHtml(res, label) {
    if (!res) return "";
    const real = res.clauses.filter(([c]) => c !== "\n");
    const bad = real.filter(([, r]) => r < 0.4).length, mid = real.filter(([, r]) => r >= 0.4 && r < 0.8).length;
    const cls = res.score >= 0.85 ? "ok" : res.score >= 0.6 ? "mid" : "bad";
    const verdict = res.score >= 0.85 ? "基本背牢了" : res.score >= 0.6 ? "骨架在，漏了关键句" : "还没背下来，回去再过一遍";
    return `<div class="panel" style="margin-top:12px"><b>${esc(label)}</b>：和标准稿的字面重合度 <b class="${cls}">${pct(res.score)}</b>，${verdict}。漏写的句子 ${bad} 句，只写了一部分的 ${mid} 句。
      <div class="ess-text" style="margin-top:8px">${res.clauses.map(([c, r]) => (c === "\n" ? "<br>" : `<span class="cl ${r >= 0.8 ? "ok" : r >= 0.4 ? "mid" : "bad"}">${esc(c)}</span>`)).join("")}</div>
      <p class="faint">绿色写到了，黄色只写了一部分，红色基本没写。字面重合度只反映背得牢不牢，阅卷看的是意思对不对、数字对不对。</p></div>`;
  }
  const SEGOPT = [["all", "全文"], ["abstract", "摘要"], ["p1", "第一段"], ["p2", "第二段"], ["p3", "第三段"], ["p4", "第四段"]];
  const refOf = (k, seg) => {
    const p = parts(k, false);
    return seg === "all" ? [].concat(p.abstract, p.p1, p.p2, p.p3, p.p4).join("\n") : (p[seg] || []).join("\n");
  };

  function renderAssemble() {
    const S = api.S, d = DATA();
    if (!d.template) return missing();
    const k = curKit(), st = kstat(k), p = parts(k, true), pp = parts(k, false);
    const section = ([key, label]) => {
      const nChars = lenOf(pp[key].join(""));
      return `<div class="panel" style="margin:10px 0"><div class="row" style="justify-content:space-between"><b>${label}</b><span class="faint">${nChars} 字</span></div>
        ${cover("AS." + k.id + "." + key, nChars, paras(p[key], segHtml), paras(pp[key], (x) => esc(clauseHint(x))))}</div>`;
    };
    const absWarn = st.abstract > 400 ? `<b class="bad">摘要 ${st.abstract} 字，超过 400 字上限</b>` : `摘要 <b>${st.abstract}</b> 字（≤400）`;
    const mins = Math.ceil(st.total / TARGET_CPM);
    const seg = S.dSeg || "all";
    return `
      <div class="row" style="margin-bottom:10px"><span class="faint">选一套</span>
        <select data-bind="kitId">${kits().map((x) => `<option value="${x.id}" ${x.id === k.id ? "selected" : ""}>${esc(x.id)} ${esc(x.name)}</option>`).join("")}</select>
        <button class="ghost" data-act="kitstep" data-v="-1">上一套</button><button class="ghost" data-act="kitstep" data-v="1">下一套</button>
        <button data-act="ecopy" data-v="assemble">复制整篇</button>
        <button class="primary" data-act="go" data-v="essay:write:writeKit=${k.id}">用这套去限时写作</button></div>
      <p class="muted">${absWarn} · 正文 <b>${st.body}</b> 字 · 合计 <b>${st.total}</b> 字，按每分钟 ${TARGET_CPM} 字约需 ${mins} 分钟纯打字。第三段用<b>${esc(k.p3)}</b>。蓝色下划线是这一套换进去的槽位。</p>
      ${modeBar()}
      <div class="panel"><b>标题</b> <span class="ess-text">${esc(titleOf(k))}</span></div>
      ${PARTS.map(section).join("")}
      <h3>默写核对</h3>
      <p class="muted">不看上面，把一段（或全文）默在下面，系统会逐句标出你漏了哪些。建议先默第二、三段，那是得分最集中的地方。</p>
      <div class="row" style="margin-bottom:6px"><span class="faint">默哪一段</span><select data-bind="dSeg">${SEGOPT.map(([v, n]) => `<option value="${v}" ${v === seg ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button class="primary" data-act="dcheck">核对</button><button class="ghost" data-act="dclear">清空</button></div>
      <textarea class="note" data-bind="dText" data-quiet placeholder="在这里默写……">${esc(S.dText || "")}</textarea>
      ${S.dRes && S.dRes.kit === k.id ? resultHtml(S.dRes.res, (SEGOPT.find(([v]) => v === S.dRes.seg) || [0, "全文"])[1] + "核对") : ""}`;
  }

  // ---------- 事实表 ----------
  function renderProfile() {
    const S = api.S, d = DATA();
    if (!d.template) return missing();
    const hide = !!S.factHide, open = S.factOpen || {};
    const rows = d.facts.map(([name, val, src], i) => `<tr class="factrow"><td style="white-space:nowrap"><b>${esc(name)}</b></td>
      <td>${hide && !open[i] ? `<span class="factmask" data-act="factopen" data-v="${i}">点开核对</span>` : esc(val)}</td>
      <td><span class="tag" style="${/补充/.test(src) ? "background:var(--accent-soft);color:var(--accent)" : ""}">${esc(src)}</span></td></tr>`).join("");
    return `
      <p class="muted">所有套题共用同一个项目。考场上的每一个数字只取这张表，不要现场发明。标“补充”的是为了扩大题材覆盖新增的事实，原稿里没有，必须和原稿的事实一起背熟，七个槽位才不会前后矛盾。</p>
      <div class="row" style="margin:8px 0">
        <button class="pill ${hide ? "on" : ""}" data-act="facthide">${hide ? "已遮住：点各行核对" : "遮住内容自测"}</button>
        ${hide ? `<button class="ghost" data-act="factreset">全部重新盖上</button>` : ""}</div>
      <div class="panel"><div class="case-scroll"><table><thead><tr><th>项目</th><th>内容</th><th>来源</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <p class="faint">项目写近几年、已经上线的；数字只写你能讲清来源的。表里“二期智能导办”只在 K09 里用，别带进别的题。</p>`;
  }

  // ---------- 限时写作 ----------
  function writeStat() {
    const S = api.S, k = kitOf(S.writeKit) || kits()[0];
    const len = (S.essayText || "").replace(/\s/g, "").length;
    const target = k ? kstat(k).total : 3000;
    const run = S.essayStart ? Math.max(1, (Date.now() - S.essayStart) / 60000) : 0;
    const speed = run ? Math.round(len / run) : 0;
    const leftMin = S.essayStart ? Math.max(0, 120 - Math.floor(run)) : 120;
    return `已写 <b>${len}</b> / 标准稿约 ${target} 字 · ${S.essayStart ? `用时 ${Math.floor(run)} 分钟 · 速度 <b class="${speed >= 30 ? "ok" : "bad"}">${speed}</b> 字/分钟 · 剩余 ${leftMin} 分钟` : "未开始计时"} · 目标每分钟 ${TARGET_CPM} 字`;
  }
  function renderWrite() {
    const S = api.S, d = DATA();
    if (!d.template) return missing();
    const k = kitOf(S.writeKit) || kits()[0];
    const ta = `<textarea class="note essay" data-bind="essayText" data-region="essayStat" placeholder="先打摘要和四个段落的占位，再填正文。">${esc(S.essayText || "")}</textarea>`;
    return `
      <p class="muted">机考论文要打字。按真实时长计时默一篇：选一套，不看标准稿默写，写完点“核对全文”。120 分钟里纯打字约 85 分钟，按每分钟 ${TARGET_CPM} 字写完整版约 3000 字。</p>
      <div class="bar" style="height:14px">${SEGS.map(([n, v], i) => `<span title="${n}" style="width:${v / 120 * 100}%;background:${COLORS[i]}"></span>`).join("")}</div>
      <div class="row" style="margin:6px 0 12px">${SEGS.map(([n, v], i) => `<span class="faint"><span class="dot" style="background:${COLORS[i]}"></span>${n} ${v} 分钟</span>`).join("")}</div>
      <div class="row" style="margin-bottom:8px"><span class="faint">默哪一套</span>
        <select data-bind="writeKit">${kits().map((x) => `<option value="${x.id}" ${x.id === k.id ? "selected" : ""}>${esc(x.id)} ${esc(x.name)}</option>`).join("")}</select>
        ${S.essayStart ? `<button data-act="essaystop">停止计时</button>` : `<button class="primary" data-act="essaystart">开始 120 分钟计时</button>`}
        <button data-act="wcheck">核对全文</button>
        <button class="ghost" data-act="writeref">${S.writeRef ? "收起标准稿" : "对照标准稿"}</button>
        <button class="ghost" data-act="essayclear">清空</button></div>
      <p id="region-essayStat">${writeStat()}</p>
      ${S.writeRef ? `<div class="grid g2"><div>${ta}</div><pre class="skeleton" style="margin-top:10px;max-height:480px">${esc(plainEssay(k))}</pre></div>` : ta}
      ${S.wRes && S.wRes.kit === k.id ? resultHtml(S.wRes.res, "全文核对") : ""}`;
  }

  // ---------- 结构与雷区 ----------
  function renderRules() {
    const d = DATA(), ks = kits();
    const range = (f, sub) => { const list = (sub ? ks.filter(sub) : ks).map((k) => f(kstat(k))).filter((x) => x != null); return list.length ? Math.min(...list) + "–" + Math.max(...list) : "—"; };
    const full = (k) => k.p3 !== "简版", short = (k) => k.p3 === "简版";
    return `
      <div class="grid g2">
        <div class="panel flat"><h3 style="margin-top:0">结构与字数（按终版实际拼出来的范围）</h3>
          <table>
            <tr><td>摘要</td><td>${range((s) => s.abstract)} 字，上限 400</td><td>项目、规模、我的角色、做法、效果</td></tr>
            <tr><td>第一段</td><td>${range((s) => s.parts.p1)} 字</td><td>时间、规模、团队、我的职责，末尾用 A 扣题</td></tr>
            <tr><td>第二段</td><td>${range((s) => s.parts.p2)} 字</td><td>B 理论 + 三条标准 + B2 取舍，答第 2 问</td></tr>
            <tr><td>第三段</td><td>完整 ${range((s) => s.parts.p3, full)} / 简版 ${range((s) => s.parts.p3, short)} 字</td><td>五个服务 + C 落地段，答第 3 问</td></tr>
            <tr><td>第四段</td><td>${range((s) => s.parts.p4)} 字</td><td>E 桥接 + 故障 + 改造 + 不足 + D 升华</td></tr>
            <tr><td>全文</td><td>${range((s) => s.total)} 字</td><td>正文 ${range((s) => s.body)} 字</td></tr>
          </table>
          <p class="faint">正文段落按题目三问的顺序写，阅卷是对着三问找答案的。</p></div>
        <div class="panel flat"><h3 style="margin-top:0">质量属性 → 策略素材库</h3>
          <p><b>性能</b>：多级缓存、异步削峰、读写分离、分库分表、CDN、连接池、索引优化</p>
          <p><b>可用性</b>：集群 + 负载均衡、主备切换、限流熔断降级、异地多活、健康检查</p>
          <p><b>安全性</b>：统一认证（OAuth2/JWT）、RBAC、HTTPS、加密脱敏、审计日志、WAF</p>
          <p><b>可修改性</b>：分层、模块化、DDD 限界上下文、接口隔离、配置中心、插件化</p>
          <p><b>可伸缩性</b>：无状态服务、容器弹性伸缩、数据分片</p></div>
      </div>
      <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">雷区</h3>
        <ul style="padding-left:18px">
          <li>摘要超过 400 字，或摘要和正文对不上（数字、服务名、时间要和事实表一致）。</li>
          <li>现场发明新数字。事实表之外的数字，宁可不写。</li>
          <li>B 理论有几点，C 落地段就要按同样顺序落几点，不对位等于没答第 3 问。</li>
          <li>通篇理论定义，没有项目细节和数字。</li>
          <li>把微服务、云原生、分布式事务写成银弹，不讲代价。</li>
          <li>抽到冷门题时空着不写。按兜底三步法：写 B、找挂钩、写 C。</li>
          <li>没有结尾的不足与改进；字数不够，正文少于 2000 字风险很大。</li>
        </ul></div>`;
  }

  function renderEssay() {
    const S = api.S;
    const map = { radar: renderRadar, template: renderTemplate, recall: renderRecall, assemble: renderAssemble, profile: renderProfile, write: renderWrite, rules: renderRules };
    const fn = map[S.essaySub] || renderRadar;
    return `<div class="row" style="margin-bottom:14px">${SUBS.map(([v, n]) => `<button class="pill ${(map[S.essaySub] ? S.essaySub : "radar") === v ? "on" : ""}" data-act="essaysub" data-v="${v}">${n}</button>`).join("")}</div>${fn()}`;
  }

  setInterval(() => {
    const S = api.S;
    if (S.tab !== "essay" || S.essaySub !== "write" || !S.essayStart) return;
    const el = document.getElementById("region-essayStat");
    if (el) el.innerHTML = writeStat();
  }, 15000);

  function copy(text, el, label) {
    const done = () => { if (el) { el.textContent = "已复制"; setTimeout(() => { el.textContent = label; }, 1500); } };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  }

  return {
    defaults: { essaySub: "radar", kitId: "K01", writeKit: "K01", essayQ: "", essayMode: "full", essayShow: {}, tplView: "slots", kitMark: {}, dSeg: "all", dText: "", dRes: null, wRes: null, writeRef: false, factHide: false, factOpen: {}, essayText: "", essayStart: 0 },
    tabs: { essay: { name: "论文工坊", render: renderEssay } },
    subs: { essay: "essaySub" },
    regions: { essayStat: writeStat, essayPick: pickOut },
    acts: {
      essaysub: (v) => { api.S.essaySub = v; },
      emode: (v) => { api.S.essayMode = v; api.S.essayShow = {}; },
      eshow: (v) => { (api.S.essayShow || (api.S.essayShow = {}))[v] = true; },
      ehide: (v) => { if (api.S.essayShow) delete api.S.essayShow[v]; },
      tplview: (v) => { api.S.tplView = v; },
      kitpick: (v) => { api.S.kitId = v; api.S.essayShow = {}; },
      kitstep: (v) => {
        const ks = kits(), i = Math.max(0, Math.min(ks.length - 1, ks.indexOf(curKit()) + (+v)));
        api.S.kitId = ks[i].id; api.S.essayShow = {};
      },
      kmark: (v) => {
        const [key, lv] = v.split(":"), prev = marks()[key], box = prev ? prev[0] : 0, l = +lv;
        const nb = l === 0 ? 0 : l === 1 ? 1 : Math.min(4, Math.max(2, box + 1));
        marks()[key] = [nb, api.today() + GAP[nb]];
      },
      ecopy: (v, el) => { const k = curKit(); if (k) copy(plainEssay(k), el, "复制整篇"); return false; },
      dcheck: () => {
        const k = curKit(), S = api.S, seg = S.dSeg || "all";
        if (!(S.dText || "").trim()) { alert("先在文本框里默写一些内容。"); return false; }
        S.dRes = { kit: k.id, seg, res: check(refOf(k, seg), S.dText) };
      },
      dclear: () => { api.S.dText = ""; api.S.dRes = null; },
      factopen: (v) => { (api.S.factOpen || (api.S.factOpen = {}))[v] = true; },
      facthide: () => { api.S.factHide = !api.S.factHide; api.S.factOpen = {}; },
      factreset: () => { api.S.factOpen = {}; },
      essaystart: () => { api.S.essayStart = Date.now(); },
      essaystop: () => { api.S.essayStart = 0; },
      writeref: () => { api.S.writeRef = !api.S.writeRef; },
      wcheck: () => {
        const S = api.S, k = kitOf(S.writeKit) || kits()[0];
        if (!(S.essayText || "").trim()) { alert("文本框是空的，先默写一些内容。"); return false; }
        S.wRes = { kit: k.id, res: check(refOf(k, "all"), S.essayText) };
      },
      essayclear: () => { if (!confirm("清空草稿？")) return false; api.S.essayText = ""; api.S.essayStart = 0; api.S.wRes = null; }
    }
  };
});
