(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  const SUBS = [["flash", "触发词闪电战"], ["seq", "顺序默写"], ["qa", "质量属性判官"], ["pt", "四点判官"], ["mn", "口诀解码"]];
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const pct = (r, n) => n ? Math.round(r / n * 100) + "%" : "—";

  // 本轮的临时状态不写入 localStorage
  const T = { fi: null, fShow: false, seqOrder: null, seqGot: 0, seqErr: 0, seqBad: null, jq: { qa: null, pt: null }, jPick: { qa: null, pt: null }, mi: null, mShow: false };

  // ---------- 触发词闪电战 ----------
  function flashPick() {
    const S = api.S, weak = Object.keys(S.flashWeak).map(Number).filter((i) => i < TRIGGERS.length);
    if (S.flashOnlyWeak && weak.length) { T.fi = weak[rnd(weak.length)]; return; }
    T.fi = weak.length && Math.random() < 0.4 ? weak[rnd(weak.length)] : rnd(TRIGGERS.length);
  }
  function renderFlash() {
    const S = api.S;
    if (T.fi == null || T.fi >= TRIGGERS.length) flashPick();
    const [see, think] = TRIGGERS[T.fi];
    const st = S.flashStat, weakN = Object.keys(S.flashWeak).length;
    return `
      <p class="muted">看到题干关键词，3 秒内在心里说出答案。说不出来就算卡住，卡住的词会更频繁出现，直到你连续秒出。快捷键：空格翻面，1 秒出，2 卡住。</p>
      <div class="row" style="margin:10px 0"><span class="faint">本机累计 ${st.n} 次 · 秒出率 ${pct(st.fast, st.n)} · 卡住清单 ${weakN} 个</span><span style="flex:1"></span>
        <button class="pill ${S.flashOnlyWeak ? "on" : ""}" data-act="flashweak">只练卡住的</button></div>
      <div class="flash big-flash">
        <div class="label">看到</div>
        <div class="q">${esc(see)}</div>
        ${T.fShow ? `<div class="label" style="margin-top:14px">想到</div><div class="q hl">${esc(think)}</div>` : `<div class="countdown"><span></span></div>`}
      </div>
      <div class="row" style="margin-top:12px">
        ${T.fShow ? `<button class="primary" data-act="flashgrade" data-v="1">秒出（1）</button><button data-act="flashgrade" data-v="0">卡住（2）</button>` : `<button class="primary" data-act="flashshow">显示答案（空格）</button>`}
      </div>`;
  }

  // ---------- 顺序默写 ----------
  function seqCur() { const S = api.S; return SEQS.find((s) => s.id === S.seqId) || SEQS[0]; }
  function seqReset() { const s = seqCur(); T.seqOrder = shuffle(s.items.map((_, i) => i)); T.seqGot = 0; T.seqErr = 0; T.seqBad = null; }
  function renderSeq() {
    const S = api.S, s = seqCur();
    if (!T.seqOrder || T.seqOrder.length !== s.items.length) seqReset();
    const done = T.seqGot === s.items.length;
    const best = S.seqBest;
    const mods = [...new Set(SEQS.map((x) => x.m))], mod = S.seqMod || s.m;
    const okIn = (m) => SEQS.filter((x) => x.m === m && best[x.id] === 0).length;
    return `
      <p class="muted">顺序题是选择题的高频陷阱。按正确顺序依次点击下面打乱的选项，点错会标红并计数。零失误通关会记一个 ✓。</p>
      <div class="row" style="margin:6px 0">${mods.map((m) => `<button class="pill ${m === mod ? "on" : ""}" data-act="seqmod" data-v="${m}">${esc(api.modName(m))} ${okIn(m)}/${SEQS.filter((x) => x.m === m).length}</button>`).join("")}</div>
      <div class="row" style="margin:6px 0">${SEQS.filter((x) => x.m === mod).map((x) => `<button class="pill ${x.id === s.id ? "on" : ""}" data-act="seqpick" data-v="${x.id}">${esc(x.name)}${best[x.id] === 0 ? " ✓" : ""}</button>`).join("")}</div>
      <div class="panel" style="margin-top:12px">
        <div class="row" style="justify-content:space-between"><b>${esc(s.name)}</b><span class="faint">已排 ${T.seqGot} / ${s.items.length} · 失误 ${T.seqErr}</span></div>
        <ol class="seq-done">${s.items.slice(0, T.seqGot).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
        ${done ? `<p class="${T.seqErr ? "" : "ok"}"><b>${T.seqErr ? `完成，失误 ${T.seqErr} 次。再来一遍争取零失误。` : "零失误通关！"}</b></p><p>口诀：<span class="hl">${esc(s.k)}</span></p>`
          : `<div class="row" style="margin-top:8px">${T.seqOrder.filter((i) => i >= T.seqGot).map((i) => `<button class="opt seq-opt ${T.seqBad === i ? "wrong" : ""}" data-act="seqclick" data-v="${i}">${esc(s.items[i])}</button>`).join("")}</div>`}
        <div class="row" style="margin-top:10px"><button data-act="seqagain">重来</button><button data-act="seqnext">换一组</button>${done ? "" : `<button class="ghost" data-act="seqhint">看口诀</button>`}</div>
        ${T.seqHint && !done ? `<p class="faint">口诀：${esc(s.k)}</p>` : ""}
      </div>`;
  }

  // ---------- 判官 ----------
  const JUDGE = {
    qa: { list: () => QA_JUDGE, opts: () => QA_ATTRS, hint: () => QA_HINT, title: "这条需求属于哪个质量属性？", intro: "案例第 1 题的效用树、质量属性归类，本质都是分类题。刷到看一眼就能判。" },
    pt: { list: () => PT_JUDGE, opts: () => PT_KINDS, hint: () => PT_HINT, title: "这条架构决策是什么点？", intro: "ATAM 评估题必考：一个属性 → 敏感点；多个此消彼长 → 权衡点；隐患 → 风险点；论证可行 → 非风险点。" }
  };
  function judgePick(k) {
    const S = api.S, J = JUDGE[k], n = J.list().length, wrong = S.judgeWrong[k] || [];
    let i = wrong.length && Math.random() < 0.5 ? wrong[rnd(wrong.length)] : rnd(n);
    if (n > 1 && i === T.jq[k]) i = (i + 1) % n;
    T.jq[k] = i; T.jPick[k] = null;
  }
  function renderJudge(k) {
    const S = api.S, J = JUDGE[k];
    if (T.jq[k] == null) judgePick(k);
    const [text, ans] = J.list()[T.jq[k]], pick = T.jPick[k];
    const st = S.judgeStat[k] || { n: 0, r: 0, streak: 0 };
    return `
      <p class="muted">${esc(J.intro)}</p>
      <p class="faint">累计 ${st.n} 题 · 正确率 ${pct(st.r, st.n)} · 当前连对 ${st.streak} · 待复习 ${(S.judgeWrong[k] || []).length} 条</p>
      <div class="panel">
        <div class="label">${esc(J.title)}</div>
        <p class="q" style="font-size:17px;font-weight:600">${esc(text)}</p>
        <div class="row">${J.opts().map((o) => {
          let cls = "opt judge-opt";
          if (pick != null) { if (o === ans) cls += " right"; else if (o === pick) cls += " wrong"; }
          return `<button class="${cls}" data-act="judge" data-v="${k}:${esc(o)}" ${pick != null ? "disabled" : ""}>${esc(o)}</button>`;
        }).join("")}</div>
        ${pick != null ? `<p style="margin-top:10px"><b class="${pick === ans ? "ok" : "bad"}">${pick === ans ? "判对了" : "应该是：" + esc(ans)}</b>　${esc(J.hint()[ans])}</p>
          <button class="primary" data-act="judgenext" data-v="${k}">下一条</button>` : ""}
      </div>
      <table style="margin-top:14px"><tr><th>选项</th><th>判定口诀</th></tr>${J.opts().map((o) => `<tr><td>${esc(o)}</td><td>${esc(J.hint()[o])}</td></tr>`).join("")}</table>`;
  }

  // ---------- 口诀解码 ----------
  const mnPool = () => CARDS.filter((c) => c.k && (api.S.mnMod === "all" || c.m === api.S.mnMod));
  function renderMn() {
    const S = api.S, pool = mnPool();
    if (!pool.length) return api.modPills(S.mnMod, "mnmod") + `<div class="panel"><p>这个模块没有带口诀的卡片。</p></div>`;
    if (T.mi == null || !pool[T.mi]) { T.mi = rnd(pool.length); T.mShow = false; }
    const c = pool[T.mi];
    return `
      <p class="muted">反过来背：只给口诀，你还原出完整内容。还原得出来说明口诀真的挂上了钩子。结果会同步到背卡的复习计划。</p>
      ${api.modPills(S.mnMod, "mnmod")}
      <div class="flash big-flash" style="margin-top:12px">
        <div class="label">口诀</div><div class="q hl">${esc(c.k)}</div>
        <p class="faint">提示：${esc(c.q)}</p>
        ${T.mShow ? `<div style="margin-top:12px">${api.cardBody(Object.assign({}, c, { k: "" }))}</div>` : ""}
      </div>
      <div class="row" style="margin-top:12px">
        ${T.mShow ? `<button class="primary" data-act="mngrade" data-v="2">还原出来了</button><button data-act="mngrade" data-v="1">只想起一半</button><button data-act="mngrade" data-v="0">完全想不起</button>`
          : `<button class="primary" data-act="mnshow">显示内容</button><button data-act="mnskip">换一个</button>`}
        <span style="flex:1"></span><span class="faint">共 ${pool.length} 条口诀</span>
      </div>`;
  }

  function renderDrill() {
    const S = api.S;
    const inner = { flash: renderFlash, seq: renderSeq, qa: () => renderJudge("qa"), pt: () => renderJudge("pt"), mn: renderMn }[S.drillSub]();
    return `<div class="row" style="margin-bottom:14px">${SUBS.map(([v, n]) => `<button class="pill ${S.drillSub === v ? "on" : ""}" data-act="drillsub" data-v="${v}">${n}</button>`).join("")}</div>${inner}`;
  }

  function flashGrade(fast) {
    const S = api.S;
    S.flashStat.n++;
    if (fast) {
      S.flashStat.fast++;
      if (S.flashWeak[T.fi] != null) { S.flashWeak[T.fi]--; if (S.flashWeak[T.fi] <= 0) delete S.flashWeak[T.fi]; }
    } else S.flashWeak[T.fi] = 2;
    T.fShow = false; flashPick();
  }
  document.addEventListener("keydown", (e) => {
    const S = api.S;
    if (S.tab !== "drill" || S.drillSub !== "flash" || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === " ") { e.preventDefault(); if (!T.fShow) { T.fShow = true; api.render(); } }
    else if (T.fShow && (e.key === "1" || e.key === "2")) { flashGrade(e.key === "1"); api.render(); }
  });

  return {
    defaults: { drillSub: "flash", flashStat: { n: 0, fast: 0 }, flashWeak: {}, flashOnlyWeak: false, seqId: "q1", seqMod: "", seqBest: {}, judgeStat: {}, judgeWrong: {}, mnMod: "all" },
    tabs: { drill: { name: "反射训练", render: renderDrill } },
    subs: { drill: "drillSub" },
    acts: {
      drillsub: (v) => { api.S.drillSub = v; },
      flashshow: () => { T.fShow = true; },
      flashgrade: (v) => flashGrade(v === "1"),
      flashweak: () => { api.S.flashOnlyWeak = !api.S.flashOnlyWeak; flashPick(); T.fShow = false; },
      seqmod: (v) => { api.S.seqMod = v; },
      seqpick: (v) => { api.S.seqId = v; seqReset(); T.seqHint = false; },
      seqagain: () => { seqReset(); T.seqHint = false; },
      seqnext: () => {
        const S = api.S, mod = S.seqMod || seqCur().m;
        const rest = SEQS.filter((x) => x.id !== S.seqId && S.seqBest[x.id] !== 0);
        const same = rest.filter((x) => x.m === mod);
        const list = same.length ? same : rest.length ? rest : SEQS.filter((x) => x.id !== S.seqId);
        const pick = list[rnd(list.length)];
        S.seqId = pick.id; S.seqMod = pick.m; seqReset(); T.seqHint = false;
      },
      seqhint: () => { T.seqHint = true; },
      seqclick: (v) => {
        const S = api.S, i = +v, s = seqCur();
        if (i === T.seqGot) {
          T.seqGot++; T.seqBad = null;
          if (T.seqGot === s.items.length) {
            const prev = S.seqBest[s.id];
            S.seqBest[s.id] = prev == null ? T.seqErr : Math.min(prev, T.seqErr);
          }
        } else { T.seqErr++; T.seqBad = i; }
      },
      judge: (v) => {
        const S = api.S, i = v.indexOf(":"), k = v.slice(0, i), pick = v.slice(i + 1);
        if (T.jPick[k] != null) return false;
        T.jPick[k] = pick;
        const qi = T.jq[k], ans = JUDGE[k].list()[qi][1];
        const st = S.judgeStat[k] || (S.judgeStat[k] = { n: 0, r: 0, streak: 0 });
        const wrong = S.judgeWrong[k] || (S.judgeWrong[k] = []);
        st.n++;
        if (pick === ans) { st.r++; st.streak++; const w = wrong.indexOf(qi); if (w >= 0) wrong.splice(w, 1); }
        else { st.streak = 0; if (!wrong.includes(qi)) wrong.push(qi); }
      },
      judgenext: (v) => judgePick(v),
      mnmod: (v) => { api.S.mnMod = v; T.mi = null; },
      mnshow: () => { T.mShow = true; },
      mnskip: () => { T.mi = null; },
      mngrade: (v) => { const c = mnPool()[T.mi]; if (c) api.markCard(c.id, +v); T.mi = null; }
    }
  };
});
