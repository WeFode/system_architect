(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  const SUBS = [["cmp", "对比题背默"], ["real", "真题演练"], ["pack", "选答题主题包"], ["tpl", "答题模板"]];
  const MARKS = [["0", "不会"], ["1", "模糊"], ["2", "会了"]];
  const markRow = (act, id, cur) => MARKS.map(([v, n]) => `<button class="pill ${String(cur) === v ? "on" : ""}" data-act="${act}" data-v="${id}:${v}">${n}</button>`).join("");

  // ---------- 对比题背默 ----------
  function caseShown(S, item, ri, ci) {
    if (S.caseMode !== "write" || ci === 0 || S.caseAll) return true;
    return !!S.caseOpen[item.id + "-" + ri + "-" + ci];
  }
  function caseKeys(item) {
    const keys = [];
    item.rows.forEach((row, ri) => row.forEach((_, ci) => { if (ci) keys.push(item.id + "-" + ri + "-" + ci); }));
    return keys;
  }
  function materialize(S) {
    if (!S.caseAll) return;
    S.caseAll = false;
    CASE_COMPARE.forEach((item) => caseKeys(item).forEach((k) => { S.caseOpen[k] = 1; }));
  }
  function caseList() {
    const S = api.S, k = S.caseQ.trim().toLowerCase();
    const items = CASE_COMPARE.filter((item) => {
      if (S.caseCat !== "all" && item.category !== S.caseCat) return false;
      if (!k) return true;
      return [item.title, item.tip, item.category, ...item.headers, ...item.rows.flat()].join(" ").toLowerCase().includes(k);
    });
    if (!items.length) return `<div class="panel"><p>没有对上的对比题。换个分类，或把搜索词缩短。</p></div>`;
    const write = S.caseMode === "write";
    return items.map((item) => {
      const head = item.headers.map((h) => `<th>${esc(h)}</th>`).join("");
      const body = item.rows.map((row, ri) => `<tr>${row.map((cell, ci) => {
        const shown = caseShown(S, item, ri, ci);
        const act = write && ci > 0 ? ` data-act="casecell" data-v="${item.id}-${ri}-${ci}"` : "";
        const inner = shown ? esc(cell) : `<span class="mask">点击显示</span>`;
        return `<td${act}>${ci === 0 ? `<b>${inner}</b>` : inner}</td>`;
      }).join("")}</tr>`).join("");
      return `<div class="panel" style="margin-bottom:14px">
        <div class="row" style="justify-content:space-between"><b>${item.id}. ${esc(item.title)}</b><span class="tag">${esc(item.category)}</span></div>
        <div class="case-scroll"><table><tr>${head}</tr>${body}</table></div>
        <p class="sec pre" style="margin-top:10px"><span class="tag">踩分</span>${esc(item.tip)}</p>
        ${write ? `<textarea class="note" data-bind="caseDraft.${item.id}" data-quiet placeholder="先写结论一句，再按维度列差异，最后扣题干原词。">${esc(S.caseDraft[item.id] || "")}</textarea>
          <div class="row" style="margin-top:8px"><button data-act="casecard" data-v="${item.id}">显隐本题答案</button>${markRow("casemark", item.id, S.caseMark[item.id])}</div>` : `<div class="row" style="margin-top:8px">${markRow("casemark", item.id, S.caseMark[item.id])}</div>`}
      </div>`;
    }).join("");
  }
  function renderCmp() {
    const S = api.S;
    const cats = ["all"].concat([...new Set(CASE_COMPARE.map((c) => c.category))]);
    const known = CASE_COMPARE.filter((c) => S.caseMark[c.id] === 2).length;
    return `
      <p class="muted">对比选型题：背题直接看表，默写先遮住方案列，自己写完再点开核对。</p>
      <div class="grid g3" style="margin:12px 0">
        ${CASE_RULES.map(([t, d]) => `<div class="panel"><b>${esc(t)}</b><p class="faint" style="margin-top:6px">${esc(d)}</p></div>`).join("")}
      </div>
      <p class="faint">${esc(CASE_FRAME)} 已掌握 ${known} / ${CASE_COMPARE.length} 题。</p>
      <div class="row" style="margin:12px 0">
        ${cats.map((c) => `<button class="pill ${S.caseCat === c ? "on" : ""}" data-act="casecat" data-v="${esc(c)}">${esc(c === "all" ? "全部" : c)}</button>`).join("")}
      </div>
      <div class="row" style="margin-bottom:14px">
        <button class="pill ${S.caseMode === "read" ? "on" : ""}" data-act="casemode" data-v="read">背题</button>
        <button class="pill ${S.caseMode === "write" ? "on" : ""}" data-act="casemode" data-v="write">默写</button>
        <input class="wide" data-bind="caseQ" data-region="case" placeholder="搜索对比题，如 gRPC、权衡点" value="${esc(S.caseQ)}">
        ${S.caseMode === "write" ? `<button data-act="caseall">${S.caseAll ? "隐藏全部答案" : "显示全部答案"}</button>` : ""}
      </div>
      <div id="region-case">${caseList()}</div>`;
  }

  // ---------- 真题演练 ----------
  function renderReal() {
    const S = api.S;
    const c = CASE_REAL.find((x) => x.id === S.realId) || CASE_REAL[0];
    const score = (id) => c.qs.map((_, i) => S.realMark[id + "-" + i]).filter((x) => x != null);
    const pills = CASE_REAL.map((x) => {
      const m = x.qs.map((_, i) => S.realMark[x.id + "-" + i]);
      const done = m.every((v) => v === 2) ? " ✓" : m.some((v) => v != null) ? " …" : "";
      return `<button class="pill ${x.id === c.id ? "on" : ""}" data-act="realpick" data-v="${x.id}">${esc(x.src.replace(/（必答）/, ""))}${done}</button>`;
    }).join("");
    const total = c.qs.reduce((a, q) => a + (+(/（(\d+) 分）/.exec(q.n) || [0, 0])[1]), 0);
    return `
      <p class="muted">模拟卷Ⅰ、Ⅱ共 10 道案例题。流程：读说明 → 自己写答案（按分值估要点数）→ 点开参考答案逐条对 → 自评。建议每道题限时 30 分钟。</p>
      <div class="row" style="margin:10px 0 14px">${pills}</div>
      <div class="panel">
        <div class="row" style="justify-content:space-between"><b>${esc(c.src)}：${esc(c.topic)}</b><span class="faint">本页合计 ${total} 分 · 已自评 ${score(c.id).length}/${c.qs.length}</span></div>
        <p class="pre" style="margin-top:8px">${esc(c.story)}</p>
      </div>
      ${c.qs.map((q, i) => {
        const key = c.id + "-" + i, open = S.realOpen[key];
        const pts = Math.max(2, Math.ceil((+(/（(\d+) 分）/.exec(q.n) || [0, 6])[1]) / 2));
        return `<div class="panel" style="margin-top:12px">
          <b>${esc(q.n)}</b><p class="pre">${esc(q.q)}</p>
          <textarea class="note" data-bind="realDraft.${key}" data-quiet placeholder="至少写 ${pts} 个要点：术语 + 题干原词 + 因果。">${esc(S.realDraft[key] || "")}</textarea>
          <div class="row" style="margin-top:8px"><button data-act="realopen" data-v="${key}">${open ? "收起参考答案" : "显示参考答案"}</button><span style="flex:1"></span>${markRow("realmark", key, S.realMark[key])}</div>
          ${open ? `<div class="sec pre" style="margin-top:10px"><span class="tag">参考答案</span>${esc(q.a)}</div><div class="sec pre"><span class="tag">套路</span>${esc(q.how)}</div>` : ""}
        </div>`;
      }).join("")}`;
  }

  // ---------- 选答题主题包 ----------
  function renderPack() {
    const S = api.S;
    const p = CASE_PACKS.find((x) => x.id === S.packId) || CASE_PACKS[0];
    const hide = S.packHide;
    return `
      <p class="muted">后 4 题选 2 时用：先看“怎么选”，再把每个主题的必背答题点过一遍。打开遮挡模式后只显示考点名，自己说出要点再点开。</p>
      <div class="row" style="margin:10px 0">${CASE_PACKS.map((x) => `<button class="pill ${x.id === p.id ? "on" : ""}" data-act="packpick" data-v="${x.id}">${esc(x.name)}</button>`).join("")}</div>
      <div class="row" style="margin-bottom:12px"><button class="pill ${hide ? "on" : ""}" data-act="packhide">遮挡模式</button></div>
      <div class="panel"><b>怎么选</b><p>${esc(p.when)}</p></div>
      <table style="margin-top:12px"><tr><th style="width:22%">考点</th><th>答题点</th></tr>
        ${p.items.map(([k, v], i) => {
          const key = p.id + "-" + i, shown = !hide || S.packOpen[key];
          return `<tr><td><b>${esc(k)}</b></td><td ${hide ? `data-act="packcell" data-v="${key}"` : ""}>${shown ? esc(v) : `<span class="mask">点击显示</span>`}</td></tr>`;
        }).join("")}
      </table>`;
  }

  // ---------- 答题模板 ----------
  function renderTpl() {
    return `
    <h2 style="margin-top:0">案例第 1 题（必答）答题模板</h2>
    <table>
      <tr><th>题型</th><th>答题骨架</th></tr>
      <tr><td>质量属性归类</td><td>“属于 <b>XX</b> 质量属性，原因是该描述关注 <b>……（引用题干原词）</b>。”判定：时间/并发 → 性能；故障/恢复 → 可用性；攻击/授权/审计 → 安全性；改动/人·天 → 可修改性；调试/诊断 → 可测试性。</td></tr>
      <tr><td>敏感点 / 权衡点 / 风险点</td><td>看这个决策影响几个质量属性：一个 → 敏感点；多个且此消彼长 → 权衡点；可能出问题 → 风险点；论证可行 → 非风险点。</td></tr>
      <tr><td>架构风格对比选择</td><td>风格特点 → 与本系统需求的匹配 → 结论；每一点都带题干原词。可以组合：哪部分用 A、哪部分用 B。</td></tr>
      <tr><td>效用树填空</td><td>第二层填质量属性名，叶子填场景编号；功能需求和约束是干扰项。</td></tr>
    </table>
    <p class="faint">得分三件套：术语 + 题干原词 + 因果。每小问按分值写要点，一般 1 个要点 1–2 分。</p>
    <h2>其他案例题型</h2>
    <table>
      <tr><th>题型</th><th>答题骨架</th></tr>
      <tr><td>对比题（A vs B）</td><td>按题目给的维度画表；没给维度就用“性能、可用性、可修改性、成本、复杂度”五维；最后一句给结论。</td></tr>
      <tr><td>是否合适 / 判断题</td><td>先写“不合适 / 合适”，再列 3–5 条理由；绝对化方案（每条 SQL 都建索引、全部改微服务）一律答不合适。</td></tr>
      <tr><td>架构图填空</td><td>按请求路径从外到内：CDN → 负载均衡/Web → 网关 → 服务层 → 缓存 → 数据层（主写从读）。</td></tr>
      <tr><td>数据库 / 缓存</td><td>问题成因 → 方案（布隆过滤器、互斥锁、随机过期、Cache Aside）→ 优缺点</td></tr>
      <tr><td>Redis 选型</td><td>数据类型匹配（ZSet 排行、Hash 对象、List 队列、Set 去重）+ 持久化选择（RDB/AOF）</td></tr>
      <tr><td>反规范化</td><td>手段 → 性能收益 → 一致性保障（触发器 / 应用同步 / 批处理）</td></tr>
      <tr><td>Web / 微服务</td><td>网关、注册中心、负载均衡、熔断限流降级、消息队列削峰解耦、三池（连接池、对象池、线程池）</td></tr>
      <tr><td>嵌入式</td><td>分层架构（TLS）、实时调度、余度与容错、ARINC 653 时空分区、串口计算</td></tr>
      <tr><td>系统建模</td><td>DFD 补全（找黑洞、奇迹、灰洞）、E-R 补全、用例/类/顺序/状态图</td></tr>
    </table>
    <h2>兜底通用答案</h2>
    <div class="grid g2">
      <div class="panel flat"><b>性能</b><p>多级缓存、异步削峰、读写分离、分库分表、CDN、连接池、索引优化、负载均衡</p>
        <b>可用性</b><p>集群 + 负载均衡、主备切换、心跳检测、限流熔断降级、异地多活、数据备份</p></div>
      <div class="panel flat"><b>安全性</b><p>统一认证（OAuth2/JWT）、RBAC、HTTPS、加密脱敏、审计日志、WAF、入侵检测</p>
        <b>可修改性</b><p>分层、模块化、接口隔离、依赖倒置、配置化、插件化、DDD 限界上下文</p></div>
    </div>`;
  }

  function renderCase() {
    const S = api.S;
    const known = CASE_COMPARE.filter((c) => S.caseMark[c.id] === 2).length;
    const realDone = Object.values(S.realMark).filter((v) => v === 2).length;
    const realTotal = CASE_REAL.reduce((a, c) => a + c.qs.length, 0);
    return `<div class="row" style="margin-bottom:14px">${SUBS.map(([v, n]) => `<button class="pill ${S.caseSub === v ? "on" : ""}" data-act="casesub" data-v="${v}">${n}</button>`).join("")}
      <span style="flex:1"></span><span class="faint">对比题掌握 ${known}/${CASE_COMPARE.length} · 真题小问会了 ${realDone}/${realTotal}</span></div>
      ${{ cmp: renderCmp, real: renderReal, pack: renderPack, tpl: renderTpl }[S.caseSub]()}`;
  }

  const setMark = (store, v) => { const i = v.lastIndexOf(":"); store[v.slice(0, i)] = +v.slice(i + 1); };
  return {
    defaults: { caseSub: "cmp", caseMode: "read", caseCat: "all", caseQ: "", caseOpen: {}, caseDraft: {}, caseMark: {}, caseAll: false,
      realId: "28-1", realDraft: {}, realOpen: {}, realMark: {}, packId: "q1", packHide: false, packOpen: {} },
    tabs: { case: { name: "案例", render: renderCase, wide: true } },
    subs: { case: "caseSub" },
    regions: { case: caseList },
    acts: {
      casesub: (v) => { api.S.caseSub = v; },
      casemode: (v) => { api.S.caseMode = v; },
      casecat: (v) => { api.S.caseCat = v; },
      caseall: () => { const S = api.S; if (S.caseAll) { S.caseAll = false; S.caseOpen = {}; } else S.caseAll = true; },
      casecell: (v) => {
        const S = api.S;
        if (S.caseMode !== "write") return false;
        materialize(S);
        if (S.caseOpen[v]) delete S.caseOpen[v]; else S.caseOpen[v] = 1;
      },
      casecard: (v) => {
        const S = api.S, item = CASE_COMPARE.find((x) => String(x.id) === v);
        if (!item) return false;
        materialize(S);
        const keys = caseKeys(item), allOn = keys.every((k) => S.caseOpen[k]);
        keys.forEach((k) => { if (allOn) delete S.caseOpen[k]; else S.caseOpen[k] = 1; });
      },
      casemark: (v) => setMark(api.S.caseMark, v),
      realpick: (v) => { api.S.realId = v; window.scrollTo(0, 0); },
      realopen: (v) => { const o = api.S.realOpen; if (o[v]) delete o[v]; else o[v] = 1; },
      realmark: (v) => setMark(api.S.realMark, v),
      packpick: (v) => { api.S.packId = v; },
      packhide: () => { api.S.packHide = !api.S.packHide; api.S.packOpen = {}; },
      packcell: (v) => { const o = api.S.packOpen; if (o[v]) delete o[v]; else o[v] = 1; }
    }
  };
});
