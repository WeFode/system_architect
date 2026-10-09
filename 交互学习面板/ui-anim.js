// 动画剧场：框架。具体动画写在 sim-*.js 里，往 window.KD_SIMS 里注册：
//   KD_SIMS.push({
//     id, name, tag,            // 唯一 id、胶囊按钮名、右上角小标签（对应的考点/论文题材）
//     intro,                    // 一句话说明这个动画要看懂什么
//     render(api) -> html,      // 静态骨架；里面的 id/class 请带上 sim-<id>- 前缀
//     mount(root, ctx) -> fn?,  // 骨架插入页面后调用；自己绑事件、起定时器；可返回清理函数
//     say: ["考场 / 论文话术", ...],
//     cards: ["a33", ...],      // 看完动画顺手去背的卡片 id
//     kit: "K02"                // 对应的论文套题 id（可选）
//   })
// ctx = { api, root, alive(), every(fn, ms) }：every 起的定时器在切走 / 重新渲染时自动清除。
// 动画内部的交互请直接用 addEventListener，不要用 data-act（data-act 会触发整页重绘，动画会被重置）。
(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  let cleanup = null;
  const sims = () => window.KD_SIMS || [];
  const cur = () => sims().find((s) => s.id === api.S.simId) || sims()[0];

  if (!document.getElementById("kd-anim-style")) {
    const st = document.createElement("style");
    st.id = "kd-anim-style";
    st.textContent = `
      .sim-stage { padding: 14px 16px; }
      .sim-ctl { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 8px 0 12px; }
      .sim-ctl label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
      .sim-ctl input[type=range] { width: 130px; padding: 0; }
      .sim-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 10px 0; }
      .sim-kpi > div { background: var(--fill); border-radius: 8px; padding: 8px 10px; }
      .sim-kpi .v { font-size: 20px; font-weight: 600; }
      .sim-note { margin: 10px 0 0; padding: 8px 12px; border-left: 3px solid var(--accent); background: var(--accent-soft); border-radius: 0 6px 6px 0; font-size: 13px; }
      .sim-note.bad { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); }
      .sim-note.ok { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 10%, transparent); }
      .sim-stage svg { max-width: 100%; height: auto; }
      .sim-say li { margin: 6px 0; }
      .sim-links details { margin: 6px 0; border-bottom: 1px dashed var(--line); padding-bottom: 6px; }
      .sim-links summary { cursor: pointer; font-weight: 600; }
    `;
    document.head.appendChild(st);
  }

  function render() {
    const list = sims();
    if (!list.length) return `<div class="panel"><p>动画还没有装载。</p></div>`;
    const s = cur();
    const cards = (s.cards || []).map((id) => api.card(id)).filter(Boolean);
    const pills = list.map((x) => `<button class="pill ${x.id === s.id ? "on" : ""}" data-act="simpick" data-v="${esc(x.id)}">${esc(x.name)}${x.tag ? ` <span class="faint">${esc(x.tag)}</span>` : ""}</button>`).join("");
    return `
      <div class="row" style="margin-bottom:10px">${pills}</div>
      <p class="muted">${esc(s.intro || "")}</p>
      <div class="panel sim-stage" id="sim-root">${s.render(api)}</div>
      <div class="grid g2" style="margin-top:14px">
        <div class="panel flat"><h3 style="margin-top:0">看完这个动画，考场 / 论文这样说</h3>
          <ul class="sim-say" style="padding-left:18px;margin:6px 0">${(s.say || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          ${s.kit ? `<div class="row" style="margin-top:8px"><button class="primary" data-act="go" data-v="essay:recall:kitId=${esc(s.kit)}">去背对应的论文套题 ${esc(s.kit)}</button></div>` : ""}</div>
        <div class="panel flat sim-links"><h3 style="margin-top:0">顺手去背的卡片</h3>
          ${cards.length ? cards.map((c) => `<details><summary>${esc(c.q)}</summary><div style="margin-top:6px">${api.cardBody(c)}</div></details>`).join("") : `<p class="faint">没有挂卡片。</p>`}</div>
      </div>`;
  }

  function after() {
    if (cleanup) { cleanup(); cleanup = null; }
    const s = cur(), root = document.getElementById("sim-root");
    if (!s || !root || !s.mount) return;
    const timers = [];
    const ctx = {
      api, root,
      alive: () => document.body.contains(root),
      every: (fn, ms) => {
        const id = setInterval(() => { if (!document.body.contains(root)) { clearInterval(id); return; } fn(); }, ms);
        timers.push(id);
        return () => clearInterval(id);
      }
    };
    let res;
    try { res = s.mount(root, ctx); } catch (e) { root.insertAdjacentHTML("beforeend", `<p class="bad">动画出错：${esc(e.message)}</p>`); console.error(e); }
    cleanup = () => { timers.forEach(clearInterval); if (typeof res === "function") res(); };
  }

  return {
    defaults: { simId: "" },
    tabs: { anim: { name: "动画剧场", render, after } },
    subs: { anim: "simId" },
    acts: { simpick: (v) => { api.S.simId = v; } }
  };
});
