// 刷题模考（秒杀版）：做完一题，不只看对错，而是拿到一张“秒杀卡”：
// 题眼 → 一句结论；四个选项各自考什么；如果答案换成别的选项题干会怎么出；这题串起了哪几个概念。
// 笔记数据来自 quiz-notes.js（window.QUIZ_NOTES，按题目 id 索引）；限时模考仍用 app.js 里的原实现。
(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  const L = "ABCD";
  const NOTES = () => window.QUIZ_NOTES || {};
  const SRCS = [["all", "全部来源"], ["own", "口诀题"], ["prac", "书本练习"], ["m1", "模拟卷Ⅰ"], ["m2", "模拟卷Ⅱ"]];

  if (!document.getElementById("kd-quiz-style")) {
    const st = document.createElement("style");
    st.id = "kd-quiz-style";
    st.textContent = `
      .qk-stem { font-size: 16px; font-weight: 600; margin: 10px 0; line-height: 1.7; white-space: pre-wrap; }
      mark.qkw { background: var(--accent-soft); color: inherit; border-bottom: 2px solid var(--accent); border-radius: 3px; padding: 0 1px; }
      .qk-kill { margin: 12px 0 8px; padding: 10px 12px; border-radius: 8px; background: var(--accent-soft); border-left: 4px solid var(--accent); font-size: 15px; font-weight: 600; line-height: 1.6; }
      .qk-row { margin: 6px 0; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--fill); }
      .qk-row.right { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, var(--fill)); }
      .qk-row.wrong { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 8%, var(--fill)); }
      .qk-h { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
      .qk-n { margin-top: 3px; color: var(--text); font-size: 14px; line-height: 1.6; }
      .qk-v { margin-top: 3px; color: var(--muted); font-size: 13px; line-height: 1.6; }
      .qk-v b { color: var(--accent); font-weight: 600; }
      .qk-tag { font-size: 12px; padding: 0 7px; border-radius: 4px; border: 1px solid currentColor; }
      .qk-tag.ok { color: var(--ok); } .qk-tag.bad { color: var(--bad); } .qk-tag.mid { color: var(--mid); }
      .qk-chain { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 8px 0; }
      .qk-chip { display: inline-block; padding: 1px 9px; border-radius: 6px; font-size: 13px; background: var(--accent-soft); border: 1px solid var(--accent); }
      .qk-nav { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 8px 0 12px; }
      .qk-ng { font-size: 12px; margin: 0 2px 0 10px; }
      .qk-ng:first-child { margin-left: 0; }
      button.qk-nb { min-width: 30px; height: 26px; padding: 0 5px; font-size: 12px; border-radius: 6px; background: var(--fill); border: 1px solid transparent; }
      button.qk-nb.on { background: var(--accent); color: #fff; border-color: var(--accent); }
      button.qk-nb.g1 { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 22%, var(--fill)); }
      button.qk-nb.g0 { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 16%, var(--fill)); }
      button.qk-nb.g2 { border-color: var(--mid); background: color-mix(in srgb, var(--mid) 18%, var(--fill)); }
      .qk-jump { width: 64px; text-align: center; }
    `;
    document.head.appendChild(st);
  }

  // ---------- 题池 ----------
  function srcMatch(q) {
    const f = api.S.qSrc;
    if (f === "all") return true;
    if (f === "own") return !q.src;
    if (f === "prac") return /练习/.test(q.src || "");
    if (f === "m1") return q.src === "模拟卷Ⅰ";
    if (f === "m2") return q.src === "模拟卷Ⅱ";
    if (/^h\d+$/.test(f)) return api.qHour(q) === +f.slice(1);
    return true;
  }
  const baseList = () => api.allQ().filter((q) => (api.S.qMod === "all" || q.m === api.S.qMod) && srcMatch(q));
  const poolList = () => baseList().filter((q) => api.S.qMode !== "wrong" || api.S.wrong.includes(q.id));
  let shownId = null, shownAt = 0;
  function cur() {
    const S = api.S, P = poolList();
    if (!P.length) return null;
    let q = P.find((x) => x.id === S.qcur);
    if (!q) { q = S.qMode === "rand" ? P[Math.floor(Math.random() * P.length)] : P[0]; S.qcur = q.id; }
    return { q, i: P.indexOf(q), P };
  }
  function move(dir) {
    const S = api.S, c = cur();
    if (!c) return;
    const hist = S.qHist || (S.qHist = []);
    if (S.qMode === "rand") {
      if (dir < 0) { const p = hist.pop(); if (p != null) S.qcur = p; return; }
      const fresh = c.P.filter((x) => x.id !== c.q.id && S.qdone[x.id] == null);
      const src = fresh.length ? fresh : c.P.filter((x) => x.id !== c.q.id);
      hist.push(c.q.id); if (hist.length > 40) hist.shift();
      S.qcur = (src.length ? src[Math.floor(Math.random() * src.length)] : c.q).id;
    } else S.qcur = c.P[(c.i + dir + c.P.length) % c.P.length].id;
  }

  // ---------- 展示 ----------
  function stemHtml(q, n, on) {
    if (!on || !n || !n.k) return esc(q.q);
    const spans = [];
    n.k.forEach((k) => { const i = q.q.indexOf(k); if (i >= 0) spans.push([i, i + k.length]); });
    spans.sort((a, b) => a[0] - b[0]);
    let html = "", at = 0;
    spans.forEach(([a, b]) => { if (a < at) return; html += esc(q.q.slice(at, a)) + `<mark class="qkw">${esc(q.q.slice(a, b))}</mark>`; at = b; });
    return html + esc(q.q.slice(at));
  }
  const chain = (c) => `<div class="qk-chain"><span class="faint">串联</span>${c.map((x) => `<span class="qk-chip">${esc(x)}</span>`).join('<span class="faint">→</span>')}</div>`;
  function brief(q) {
    const n = NOTES()[q.id];
    if (!n) return "";
    return `<div class="qk-kill" style="font-size:14px">⚡ ${esc(n.s)}</div>${chain(n.c)}`;
  }

  function navHtml(c) {
    const S = api.S;
    let html = "", g = null;
    c.P.forEach((q, i) => {
      const grp = q.src ? q.src.replace(/练习$/, "") : "口诀题";
      if (grp !== g) { html += `<span class="faint qk-ng">${esc(grp)}</span>`; g = grp; }
      const d = S.qdone[q.id];
      const cls = q.id === c.q.id ? "on" : d === 1 ? "g1" : d === 0 ? "g0" : d === 2 ? "g2" : "";
      html += `<button class="qk-nb ${cls}" data-act="qgo" data-v="${esc(String(q.id))}" title="${esc(q.q.slice(0, 26))}…">${i + 1}</button>`;
    });
    return `<div class="qk-nav">${html}</div><p class="faint" style="margin:-4px 0 10px;font-size:12px">题号颜色：灰=没做　绿=对　红=错　黄=蒙对的　蓝=当前。点一下直接跳过去。</p>`;
  }

  function head(c) {
    const S = api.S, acc = S.quiz.done ? Math.round(S.quiz.right / S.quiz.done * 100) : 0;
    const hourPill = /^h\d+$/.test(S.qSrc) ? `<button class="pill on" data-act="qsrc" data-v="all">只看第 ${S.qSrc.slice(1)} 小时练习 ×</button>` : "";
    const modes = [["seq", "顺序刷题"], ["rand", "随机刷题"], ["wrong", `错题重练（${S.wrong.length}）`], ["exam", "限时模考"]];
    const total = baseList().length, notes = baseList().filter((q) => NOTES()[q.id]).length;
    return `${api.modPills(S.qMod, "qmod")}
      <div class="row" style="margin:10px 0 0">${SRCS.map(([v, n]) => `<button class="pill ${S.qSrc === v ? "on" : ""}" data-act="qsrc" data-v="${v}">${n}</button>`).join("")}${hourPill}
        <span class="faint">当前筛选 ${total} 题${notes < total ? `，其中 ${notes} 题有秒杀笔记` : ""}</span></div>
      <div class="row" style="margin:10px 0 10px">${modes.map(([v, n]) => `<button class="pill ${S.qMode === v ? "on" : ""}" data-act="qmode" data-v="${v}">${n}</button>`).join("")}
        <span style="flex:1"></span><span class="faint">已答 ${S.quiz.done} · 正确率 ${acc}%</span><button class="ghost" data-act="qreset">清零统计</button></div>
      ${c ? `<div class="row" style="margin:0 0 4px">
        <button class="ghost" data-act="qmove" data-v="-1">◀ 上一题</button><b>第 ${c.i + 1} / ${c.P.length} 题</b><button class="ghost" data-act="qmove" data-v="1">下一题 ▶</button>
        <span class="faint">跳到第</span><input class="qk-jump" data-bind="qJump" data-quiet inputmode="numeric" placeholder="题号" value="${esc(S.qJump || "")}"><button data-act="qjump">去</button>
        <button class="pill ${S.qNav ? "on" : ""}" data-act="qnav">题号表</button>
        <span style="flex:1"></span>
        <button class="pill ${S.qMore ? "on" : ""}" data-act="qmore" title="每个选项下面显示：如果答案换成它，题干会怎么出">换成它怎么考 · ${S.qMore ? "开" : "关"}</button></div>
        ${S.qNav ? navHtml(c) : ""}` : ""}`;
  }

  function resultHtml(q, n, picked) {
    const S = api.S, ok = picked === q.r, more = S.qMore !== false;
    const sec = (S.qSec || {})[q.id];
    const opts = q.o.map((o, i) => {
      const cls = i === q.r ? "right" : i === picked ? "wrong" : "";
      const tag = i === q.r ? `<span class="qk-tag ok">正确答案</span>` : i === picked ? `<span class="qk-tag bad">你选的 · 错</span>` : `<span class="qk-tag mid">干扰项</span>`;
      return `<div class="qk-row ${cls}"><div class="qk-h"><b>${L[i]}</b><span>${esc(o)}</span>${tag}</div>
        <div class="qk-n">${esc(n.o[i])}</div>
        ${more ? `<div class="qk-v">${i === q.r ? "" : "<b>换成它：</b>"}${esc(n.v[i])}</div>` : ""}</div>`;
    }).join("");
    const cards = (n.card || []).map((id) => api.card(id)).filter(Boolean);
    const open = S.qCardOpen;
    return `
      <p style="margin:12px 0 0"><b class="${ok ? "ok" : "bad"}">${ok ? "答对了" : "答错了，正确答案是 " + L[q.r]}</b>${sec ? `<span class="faint">　用时 ${sec} 秒${sec <= 45 && ok ? "，够快" : ""}</span>` : ""}</p>
      <div class="qk-kill">⚡ ${esc(n.s)}</div>
      ${opts}
      ${chain(n.c)}
      ${cards.length ? `<div class="row" style="margin:6px 0"><span class="faint">相关背卡</span>${cards.map((c) => `<button class="pill ${open === c.id ? "on" : ""}" data-act="qcard" data-v="${esc(c.id)}">${esc(c.q.slice(0, 22))}${c.q.length > 22 ? "…" : ""}</button>`).join("")}</div>
        ${cards.filter((c) => open === c.id).map((c) => `<div class="panel flat" style="margin:6px 0"><b>${esc(c.q)}</b><div style="margin-top:6px">${api.cardBody(c)}</div></div>`).join("")}` : ""}`;
  }

  function render() {
    const S = api.S;
    if (S.qMode === "exam") return head(null) + api.renderExam();
    const c = cur();
    if (!c) return head(null) + `<div class="panel"><p>${S.qMode === "wrong" ? "错题本在这个筛选下是空的，切回“顺序刷题”继续。" : "这个筛选条件下暂时没有题目。"}</p></div>`;
    const q = c.q, n = NOTES()[q.id], picked = S.qans[q.id];
    if (shownId !== q.id) { shownId = q.id; shownAt = Date.now(); }
    const answered = picked != null;
    const hinted = !!S.qHint[q.id];
    const keys = n && n.k ? n.k : [];
    const body = `<div class="panel">
      <div class="row" style="justify-content:space-between"><span><span class="tag">${esc(api.modName(q.m))}</span><span class="tag">${esc(q.src || "口诀题")}</span></span>${S.wrong.includes(q.id) ? `<span class="faint">错题本中</span>` : ""}</div>
      <div class="qk-stem">${stemHtml(q, n, answered || hinted)}</div>
      ${!answered && n ? `<div class="row" style="margin-bottom:6px">${hinted ? `<span class="faint">题眼：</span>${keys.map((k) => `<span class="qk-chip">${esc(k)}</span>`).join(" ")}<span class="faint">先想：看到它，你该联想到哪个概念？</span>` : `<button class="ghost" data-act="qhint">看题眼</button><span class="faint">卡住了再点，只给题眼，不给答案</span>`}</div>` : ""}
      ${answered && n ? "" : q.o.map((o, i) => {
        let cls = "opt";
        if (answered) { if (i === q.r) cls += " right"; else if (i === picked) cls += " wrong"; }
        return `<button class="${cls}" data-act="qpick" data-v="${i}" ${answered ? "disabled" : ""}>${L[i]}. ${esc(o)}</button>`;
      }).join("")}
      ${answered ? (n ? resultHtml(q, n, picked) : `<p class="pre" style="margin-top:10px"><b class="${picked === q.r ? "ok" : "bad"}">${picked === q.r ? "答对了" : "答错了，正确答案是 " + L[q.r]}</b>　${esc(q.w)}</p>`) : ""}
      ${answered ? `${n ? `<details style="margin-top:10px"><summary class="faint" style="cursor:pointer">原解析</summary><p class="pre faint">${esc(q.w)}</p></details>` : ""}
        <div class="row" style="margin-top:10px"><button class="primary" data-act="qmove" data-v="1">下一题</button><button class="ghost" data-act="qredo">重做这题</button>
          ${picked === q.r && S.qdone[q.id] !== 2 ? `<button data-act="qguess" title="选对但不是真会，记进错题本，之后还会出现">蒙对的，记入错题本</button>` : ""}
          ${S.wrong.includes(q.id) ? `<button data-act="qunwrong">已掌握，移出错题本</button>` : ""}</div>` : ""}
    </div>`;
    return head(c) + body;
  }

  // 键盘：A–D / 1–4 选择，←/→ 或 N 换题
  document.addEventListener("keydown", (e) => {
    const S = api.S;
    if (S.tab !== "quiz" || S.qMode === "exam") return;
    const t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
    const click = (sel) => { const b = document.querySelector(sel); if (b && !b.disabled) { e.preventDefault(); b.click(); } };
    const k = e.key.toLowerCase(), i = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
    if (i >= 0 && k.length === 1) click(`[data-act="qpick"][data-v="${i}"]`);
    else if (k === "arrowright" || k === "n") click('[data-act="qmove"][data-v="1"]');
    else if (k === "arrowleft") click('[data-act="qmove"][data-v="-1"]');
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target && e.target.classList && e.target.classList.contains("qk-jump")) { e.preventDefault(); const b = document.querySelector('[data-act="qjump"]'); if (b) b.click(); }
  });

  window.KD_QUIZ = { brief };

  return {
    defaults: { qcur: null, qans: {}, qdone: {}, qSec: {}, qHint: {}, qHist: [], qMore: true, qNav: false, qJump: "", qCardOpen: "" },
    tabs: { quiz: { name: "刷题模考", render } },
    acts: {
      qpick: (v) => {
        const S = api.S, c = cur();
        if (!c || S.qans[c.q.id] != null) return false;
        const q = c.q, i = +v;
        S.qans[q.id] = i;
        S.qSec[q.id] = Math.max(1, Math.round((Date.now() - shownAt) / 1000));
        S.qdone[q.id] = i === q.r ? 1 : 0;
        S.quiz.done++;
        if (i === q.r) S.quiz.right++; else if (!S.wrong.includes(q.id)) S.wrong.push(q.id);
        S.qCardOpen = "";
      },
      qmove: (v) => { move(+v); api.S.qCardOpen = ""; },
      qgo: (v) => { const q = poolList().find((x) => String(x.id) === v); if (q) { api.S.qcur = q.id; api.S.qCardOpen = ""; } },
      qjump: () => {
        const S = api.S, P = poolList(), n = parseInt(S.qJump, 10);
        if (!(n >= 1 && n <= P.length)) { alert("题号要在 1 到 " + P.length + " 之间。"); return false; }
        S.qcur = P[n - 1].id; S.qJump = ""; S.qCardOpen = "";
      },
      qnav: () => { api.S.qNav = !api.S.qNav; },
      qmore: () => { api.S.qMore = !api.S.qMore; },
      qhint: () => { const c = cur(); if (c) api.S.qHint[c.q.id] = true; },
      qcard: (v) => { api.S.qCardOpen = api.S.qCardOpen === v ? "" : v; },
      qredo: () => { const c = cur(); if (!c) return false; const S = api.S; delete S.qans[c.q.id]; delete S.qHint[c.q.id]; shownAt = Date.now(); S.qCardOpen = ""; },
      qguess: () => { const c = cur(), S = api.S; if (!c) return false; if (!S.wrong.includes(c.q.id)) S.wrong.push(c.q.id); S.qdone[c.q.id] = 2; },
      qunwrong: () => { const c = cur(), S = api.S; if (!c) return false; S.wrong = S.wrong.filter((x) => x !== c.q.id); if (S.qMode === "wrong") move(1); },
      qreset: () => { const S = api.S; if (!confirm("清零答题统计和题号颜色？错题本会保留。")) return false; S.quiz = { done: 0, right: 0 }; S.qans = {}; S.qdone = {}; S.qSec = {}; S.qHint = {}; S.qHist = []; }
    }
  };
});
