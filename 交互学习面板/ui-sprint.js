(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  const dayNum = (str) => { const t = Date.parse(str + "T00:00:00Z"); return isNaN(t) ? null : Math.floor(t / 86400000); };
  const isoToday = () => new Date(api.today() * 86400000).toISOString().slice(0, 10);
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const goBtn = (target, label, cls) => `<button class="${cls || ""}" data-act="go" data-v="${esc(target)}">${esc(label)}</button>`;

  // 论文套题背熟数：与论文工坊同一口径（B、C 权重 2，背熟度 85% 以上算背熟）
  function kitProgress() {
    const D = window.ESSAY_FINAL, m = api.S.kitMark || {}, sc = [0, 0.34, 0.67, 1, 1];
    if (!D) return [0, 0];
    let done = 0;
    D.kits.forEach((k) => {
      let s = 0, tot = 0;
      Object.keys(k.slots).forEach((sl) => {
        if (!/^(A|S|B|B2|C|E|D)$/.test(sl)) return;
        const w = sl === "B" || sl === "C" ? 2 : 1, r = m[k.id + "." + sl];
        tot += w; if (r) s += w * sc[r[0]];
      });
      if (tot && s / tot >= 0.85) done++;
    });
    return [done, D.kits.length];
  }

  function stats() {
    const S = api.S, sc = api.statusCounts();
    const due = CARDS.filter((c) => S.status[c.id] != null && api.srsDue(c.id)).length;
    const js = S.judgeStat || {};
    const jn = (js.qa ? js.qa.n : 0) + (js.pt ? js.pt.n : 0), jr = (js.qa ? js.qa.r : 0) + (js.pt ? js.pt.r : 0);
    const seqOk = Object.values(S.seqBest || {}).filter((v) => v === 0).length;
    const realOk = Object.values(S.realMark || {}).filter((v) => v === 2).length;
    const realN = CASE_REAL.reduce((a, c) => a + c.qs.length, 0);
    const essayLen = (S.essayText || "").replace(/\s/g, "").length;
    const [kitDone, kitN] = kitProgress();
    return { sc, due, jn, jr, seqOk, realOk, realN, essayLen, kitDone, kitN };
  }
  function weakMods() {
    const S = api.S, by = {};
    const all = api.allQ();
    S.wrong.forEach((id) => { const q = all.find((x) => x.id === id); if (q) by[q.m] = (by[q.m] || 0) + 1; });
    CARDS.forEach((c) => { if (S.status[c.id] === 0) by[c.m] = (by[c.m] || 0) + 1; });
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }

  // ---------- 冲刺台 ----------
  function renderSprint() {
    const S = api.S;
    if (!S.sprintStart) S.sprintStart = isoToday();
    if (!S.examDate) S.examDate = "2026-10-24"; // 2026 年下半年软考高级笔试日，以准考证为准
    const start = dayNum(S.sprintStart), now = api.today();
    const cur = start == null ? 1 : now - start + 1;
    const view = Math.min(7, Math.max(1, +S.sprintView || Math.min(7, Math.max(1, cur))));
    const d = SPRINT[view - 1];
    const exam = dayNum(S.examDate || "");
    const left = exam == null ? null : exam - now;
    const st = stats(), weak = weakMods();
    const doneOf = (day) => { let n = 0, t = 0; day.blocks.forEach(([, items], bi) => items.forEach((_, ii) => { t++; if (S.sprintDone[day.day + "-" + bi + "-" + ii]) n++; })); return [n, t]; };
    const curLabel = cur < 1 ? `冲刺还没开始（${1 - cur} 天后）` : cur > 7 ? "7 天冲刺已结束，进入考前保温" : `今天是冲刺第 ${cur} 天`;
    return `
      <div class="grid g3">
        <div class="panel"><div class="label">冲刺进度</div><div class="big">${esc(curLabel)}</div>
          <div class="row" style="margin-top:8px"><span class="faint">开始日</span><input type="date" data-bind="sprintStart" value="${esc(S.sprintStart)}"></div>
          <div class="row" style="margin-top:6px"><span class="faint">考试日</span><input type="date" data-bind="examDate" value="${esc(S.examDate || "")}">${left != null ? `<b>${left >= 0 ? "还剩 " + left + " 天" : "已过"}</b>` : ""}</div><p class="faint">考试日默认 10 月 24 日，以准考证为准，不对请直接改。</p></div>
        <div class="panel"><div class="label">今日待办</div><div class="big">${st.due} 张到期卡</div>
          <p class="faint">背卡会了 ${st.sc[2]} / ${CARDS.length} · 错题本 ${S.wrong.length} 题</p>
          <div class="row">${goBtn("cards:mod=all:filter=due", "去复习", "primary")}${goBtn("quiz:qMode=wrong", "清错题")}</div></div>
        <div class="panel"><div class="label">当前最薄弱</div>
          ${weak.length ? weak.map(([m, n]) => `<div class="row" style="justify-content:space-between;margin:4px 0"><span>${esc(api.modName(m))}</span><span class="faint">${n} 处没拿下</span>${goBtn("cards:mod=" + m + ":filter=todo", "补")}</div>`).join("") : `<p class="faint">还没有数据。先背卡、刷题，这里会自动列出错得最多的模块。</p>`}</div>
      </div>
      <div class="grid g3" style="margin-top:14px">
        <div class="panel flat"><div class="label">刷题正确率</div><div class="big">${S.quiz.done ? pct(S.quiz.right, S.quiz.done) + "%" : "—"}</div><p class="faint">已答 ${S.quiz.done} 题 · 题库 ${api.allQ().length} 题</p></div>
        <div class="panel flat"><div class="label">判官 / 顺序默写</div><div class="big">${st.jn ? pct(st.jr, st.jn) + "%" : "—"}</div><p class="faint">判官 ${st.jn} 题 · 顺序零失误 ${st.seqOk} / ${SEQS.length} 组</p></div>
        <div class="panel flat"><div class="label">案例 / 论文</div><div class="big">${st.realOk} / ${st.realN}</div><p class="faint">真题小问会了 · 论文套题背熟 ${st.kitDone} / ${st.kitN} 套 · 草稿 ${st.essayLen} 字</p></div>
      </div>
      <h2>7 天作战表</h2>
      <div class="row" style="margin-bottom:12px">${SPRINT.map((x) => { const [n, t] = doneOf(x); return `<button class="pill ${x.day === view ? "on" : ""}" data-act="sprintday" data-v="${x.day}">第 ${x.day} 天${x.day === cur ? "（今天）" : ""} ${n}/${t}</button>`; }).join("")}</div>
      <div class="panel">
        <h2 style="margin-top:0">第 ${d.day} 天 · ${esc(d.title)}</h2>
        <p class="muted">${esc(d.goal)}</p>
        <div class="grid g3">${d.blocks.map(([when, items], bi) => `<div class="panel flat"><b>${esc(when)}</b>${items.map(([text, target], ii) => {
          const id = d.day + "-" + bi + "-" + ii, on = S.sprintDone[id];
          return `<div class="task"><label class="check"><input type="checkbox" data-act="sprintcheck" data-v="${id}" ${on ? "checked" : ""}><span class="${on ? "faint" : ""}">${esc(text)}</span></label>${goBtn(target, "去做 →", "ghost")}</div>`;
        }).join("")}</div>`).join("")}</div>
      </div>
      <p class="faint">节奏按每天 8 小时左右设计：上午攻新内容，下午做题和案例，晚上写论文、清错题。时间不够时砍 B、C 级内容，不砍 S 级。</p>`;
  }

  // ---------- 考点雷达 ----------
  function renderRadar() {
    const S = api.S, P = api.book().points || {};
    const tiers = ["all", "S", "A", "B", "C"];
    const list = HOURS.filter((h) => S.radarTier === "all" || h.tier === S.radarTier);
    const cov = (h) => { const pts = P[h.h] || []; const n = pts.filter((_, i) => S.pts[h.h + "-" + i]).length; return [n, pts.length]; };
    let tn = 0, tt = 0; HOURS.forEach((h) => { const [n, t] = cov(h); tn += n; tt += t; });
    const max = Math.max(...WEIGHTS.map(([, v]) => v));
    return `
      <div class="grid g3">
        <div class="panel"><div class="label">三科满分 / 及格线</div><div class="big">75 / 45</div><p class="faint">综合知识、案例分析、论文三科同次全部及格才拿证</p></div>
        <div class="panel"><div class="label">必会点覆盖</div><div class="big">${tn} / ${tt}</div><div class="bar"><span style="width:${pct(tn, tt)}%;background:var(--ok)"></span></div><p class="faint">能脱口说出来才打勾</p></div>
        <div class="panel"><div class="label">案例怎么考</div><p>第 1 题必答（质量属性 + 架构评估），后 4 题选 2。数据库、Web、嵌入式、安全、大数据轮流出。</p><p class="faint">题量与时长以当年报名公告为准</p></div>
      </div>
      <div class="panel flat" style="margin-top:14px">
        <h3 style="margin-top:0">综合知识分值分布（估算）</h3>
        ${WEIGHTS.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="track"><div class="fillbar" style="width:${v / max * 100}%"></div></div><span>${v} 分</span></div>`).join("")}
      </div>
      <h2>26 小时考点雷达</h2>
      <p class="muted">分值和题型取自原书每小时开头的“章节考点分析”。点一行展开必会点清单，打勾的进度保存在本机。</p>
      <div class="row" style="margin:10px 0">${tiers.map((t) => `<button class="pill ${S.radarTier === t ? "on" : ""}" data-act="radartier" data-v="${t}">${t === "all" ? "全部" : esc(TIERS[t].name)}</button>`).join("")}
        ${S.radarTier !== "all" ? `<span class="faint">${esc(TIERS[S.radarTier].note)}</span>` : ""}</div>
      <table class="radar">
        <tr><th>小时</th><th>主题</th><th>级别</th><th>分值与题型</th><th>覆盖</th></tr>
        ${list.map((h) => {
          const [n, t] = cov(h), open = S.radarOpen === String(h.h);
          return `<tr class="click" data-act="radaropen" data-v="${h.h}"><td>${h.h}</td><td><b>${esc(h.name)}</b></td><td><span class="tier t${h.tier}">${h.tier}</span></td><td>${esc(h.score)} ${h.types.map((x) => `<span class="tag">${x}</span>`).join("")}</td><td>${t ? `${n}/${t}` : "—"}</td></tr>
          ${open ? `<tr><td></td><td colspan="4">
            <p><b>邪修策略：</b>${esc(h.tip)}</p>
            ${(P[h.h] || []).map((p, i) => { const id = h.h + "-" + i; return `<label class="check"><input type="checkbox" data-act="ptcheck" data-v="${id}" ${S.pts[id] ? "checked" : ""}><span class="${S.pts[id] ? "faint" : ""}">${esc(p)}</span></label>`; }).join("")}
            <div class="row" style="margin-top:8px">${goBtn("cards:mod=all:filter=all:cHour=" + h.h, "背本小时卡片")}${goBtn("quiz:qMod=all:qMode=rand:qSrc=h" + h.h, "刷本小时练习")}${goBtn("cards:mod=" + h.mod + ":filter=due", "背" + api.modName(h.mod) + "模块")}</div>
          </td></tr>` : ""}`;
        }).join("")}
      </table>`;
  }

  // ---------- 考场兵法 ----------
  function renderTactics() {
    const S = api.S;
    return `
      <p class="muted">考场策略来自原书模拟卷与历年考试经验；考试时长、题量以当年报名公告为准。</p>
      <div class="grid g2">${TACTICS.map((t) => `<div class="panel"><h3 style="margin-top:0">${esc(t.title)}</h3><ol style="padding-left:20px;margin:0">${t.items.map((x) => `<li style="margin:6px 0">${esc(x)}</li>`).join("")}</ol></div>`).join("")}</div>
      <h2>邪修记忆心法：本系统每个功能背后的方法</h2>
      <div class="grid g2">${METHODS.map(([name, desc, target]) => `<div class="panel flat"><div class="row" style="justify-content:space-between"><b>${esc(name)}</b>${goBtn(target, "去练 →", "ghost")}</div><p style="margin-top:6px">${esc(desc)}</p></div>`).join("")}</div>
      <h2>项目记忆宫殿：把考点挂到你做过的系统上</h2>
      <p class="muted">闭眼走一遍你最熟的系统，从前端到数据库，每到一个部件就说出挂在上面的考点。点“看卡”展开对应背卡。</p>
      <table><tr><th style="width:18%">系统部件</th><th>挂在上面的考点</th><th style="width:80px"></th></tr>
        ${PALACE.map(([part, pts, cid], i) => {
          const c = CARDS.find((x) => x.id === cid), open = S.palOpen === String(i);
          return `<tr><td><b>${esc(part)}</b></td><td>${esc(pts)}${open && c ? `<div class="sec"><b>${esc(c.q)}</b>${api.cardBody(c)}</div>` : ""}</td><td>${c ? `<button class="ghost" data-act="palopen" data-v="${i}">${open ? "收起" : "看卡"}</button>` : ""}</td></tr>`;
        }).join("")}
      </table>`;
  }

  return {
    defaults: { sprintStart: "", examDate: "", sprintView: 0, sprintDone: {}, radarTier: "all", radarOpen: "", pts: {}, palOpen: "" },
    tabs: {
      sprint: { name: "冲刺台", render: renderSprint },
      radar: { name: "考点雷达", render: renderRadar },
      tactics: { name: "兵法·心法", render: renderTactics }
    },
    acts: {
      sprintday: (v) => { api.S.sprintView = +v; },
      sprintcheck: (v, el) => { api.S.sprintDone[v] = el.checked; },
      radartier: (v) => { api.S.radarTier = v; },
      radaropen: (v, el) => { if (el.tagName === "INPUT") return false; api.S.radarOpen = api.S.radarOpen === v ? "" : v; },
      ptcheck: (v, el) => { api.S.pts[v] = el.checked; },
      palopen: (v) => { api.S.palOpen = api.S.palOpen === v ? "" : v; }
    }
  };
});
