(window.KD_PLUG = window.KD_PLUG || []).push(function (api) {
  const esc = (s) => api.esc(s);
  const SUBS = [["profile", "项目档案"], ["topic", "选题与骨架"], ["write", "限时写作"], ["rules", "结构与雷区"]];
  const FIELDS = [
    ["name", "项目名称", "某地级市智慧政务协同办公平台"],
    ["time", "时间", "2024 年 2 月开工，2025 年 1 月上线，周期 8 个月"],
    ["scale", "规模与业务", "市本级 32 家委办局共用，用户约 2.5 万，覆盖公文流转、联合会签、审批督办、考勤和消息通知"],
    ["team", "团队与环境", "研发连我 8 人，部署在政务外网，没有专职运维"],
    ["role", "我的角色", "系统架构师，负责架构选型、模块划分、数据隔离方案，并在试运行期间驻场调优"],
    ["tech", "技术方案一句话", "用 Go 和 GoFrame 做按领域分模块的单体，没有拆微服务"],
    ["p1", "关键设计 1", "安全性：共享库按部门做行级隔离，数据访问层统一补部门条件，不信前端传值"],
    ["p2", "关键设计 2", "可靠性：公文状态、会签意见、督办时限放在同一个本地事务；通知移出主事务，失败补推"],
    ["p3", "关键设计 3", "性能：打卡先进队列再批量落库，组织机构用进程内缓存加 Redis，通知走 WebSocket 长连接"],
    ["p4", "关键设计 4", "可维护性：按限界上下文分成公文、审批、督办、考勤、通知五个模块，模块之间只依赖接口"],
    ["effect", "效果数字", "上线后办文超过 80 万件，核心接口 P95 约 25 毫秒，一年运行费用约少六成"],
    ["issue", "不足与改进", "试运行时跨部门报表把主库 CPU 打高，临时改到从库；后续单独建统计库，并把通知和考勤先拆出去"]
  ];
  const SEGS = [["选题", 5], ["列提纲", 10], ["摘要", 15], ["正文", 80], ["检查", 10]];
  const COLORS = ["var(--faint)", "var(--mid)", "var(--accent)", "var(--ok)", "var(--bad)"];
  const prof = (k) => { const P = api.S.prof || {}; return P[k] != null && P[k] !== "" ? P[k] : (FIELDS.find((f) => f[0] === k) || [])[2]; };

  function renderProfile() {
    return `
      <p class="muted">论文 4 选 1，所有题目都用这一个项目写。先把档案填准，选题页会用它自动生成摘要和段落骨架。默认值取自你的《论文背诵稿》，改了会保存在本机。</p>
      <div class="panel">${FIELDS.map(([k, label]) => `<div class="form-row"><label>${esc(label)}</label><textarea class="note short" data-bind="prof.${k}" data-quiet>${esc(prof(k))}</textarea></div>`).join("")}
        <div class="row" style="margin-top:8px"><button class="ghost" data-act="profreset">恢复背诵稿默认值</button></div></div>
      <p class="faint">项目要写近几年、已经上线的；数字只写你真能讲清来源的，没测过的数不要编。</p>`;
  }

  function skeleton(t) {
    const theme = t.name.replace(/^论/, "");
    const pts = ["p1", "p2", "p3", "p4"].map(prof);
    return `${t.name}

【摘要】（300–400 字，按当年试卷要求）
${prof("time").split("，")[0]}，我作为${prof("role").split("，")[0]}参加了${prof("name")}的建设。${prof("scale")}。${prof("team")}。本文以该项目为例，论述${theme}。项目中，${prof("tech")}；${pts.map((p) => p.split("：")[1] || p).join("；")}。${prof("effect")}。

一、项目概述与我的工作（答第 1 问，400–500 字）
时间：${prof("time")}
规模：${prof("scale")}
团队：${prof("team")}
我的职责：${prof("role")}

二、${theme}的理论要点（答第 2 问，300–500 字）
${t.theory.map((x, i) => `${i + 1}. ${x}`).join("\n")}

三、项目中的具体实践（答第 3 问，1200–1500 字；每点“问题 → 方案 → 效果”）
${pts.map((p, i) => `（${i + 1}）${p}`).join("\n")}
本题怎么改：${t.swap}

四、不足与改进（200–300 字）
${prof("issue")}`;
  }
  function renderTopic() {
    const S = api.S;
    const t = ESSAY_TOPICS.find((x) => x.id === S.essayTopic) || ESSAY_TOPICS[0];
    const fitCls = { "高": "ok", "中": "", "低": "faint", "避开": "bad" };
    return `
      <p class="muted">考场 5 分钟选题：选和项目重合最多的。下面按你的项目给每个常见题目标了契合度，点一个看理论要点、改写提示和自动骨架。</p>
      <div class="row" style="margin:10px 0">${ESSAY_TOPICS.map((x) => `<button class="pill ${x.id === t.id ? "on" : ""}" data-act="essaytopic" data-v="${x.id}">${esc(x.name.replace(/^论/, ""))} <span class="${fitCls[x.fit]}">${esc(x.fit)}</span></button>`).join("")}</div>
      <div class="grid g2">
        <div class="panel flat"><h3 style="margin-top:0">${esc(t.name)}</h3>
          <p>契合度：<b class="${fitCls[t.fit]}">${esc(t.fit)}</b></p>
          <h3>第 2 问理论要点</h3><ol style="padding-left:20px">${t.theory.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
          <h3>换题改哪几句</h3><p>${esc(t.swap)}</p></div>
        <div class="panel flat"><div class="row" style="justify-content:space-between"><h3 style="margin:0">自动骨架</h3><button data-act="essaycopy">复制</button></div>
          <pre class="skeleton" id="essaySkel">${esc(skeleton(t))}</pre></div>
      </div>`;
  }

  function writeStat() {
    const S = api.S, len = (S.essayText || "").replace(/\s/g, "").length;
    const run = S.essayStart ? Math.max(1, (Date.now() - S.essayStart) / 60000) : 0;
    const speed = run ? Math.round(len / run) : 0;
    const left = S.essayStart ? Math.max(0, 120 - Math.floor(run)) : 120;
    return `已写 <b>${len}</b> 字 · ${S.essayStart ? `用时 ${Math.floor(run)} 分钟 · 速度 <b class="${speed >= 25 ? "ok" : "bad"}">${speed}</b> 字/分钟 · 剩余 ${left} 分钟` : "未开始计时"} · 目标 2500 字 / 每分钟 25 字`;
  }
  function renderWrite() {
    const S = api.S;
    return `
      <p class="muted">机考论文要打字。按真实时长计时写一篇，盯住字数和速度：120 分钟里正文约 80 分钟，2500 字需要每分钟 25 字以上。</p>
      <div class="bar" style="height:14px">${SEGS.map(([n, v], i) => `<span title="${n}" style="width:${v / 120 * 100}%;background:${COLORS[i]}"></span>`).join("")}</div>
      <div class="row" style="margin:6px 0 12px">${SEGS.map(([n, v], i) => `<span class="faint"><span class="dot" style="background:${COLORS[i]}"></span>${n} ${v} 分钟</span>`).join("")}</div>
      <div class="row" style="margin-bottom:8px">
        ${S.essayStart ? `<button data-act="essaystop">停止计时</button>` : `<button class="primary" data-act="essaystart">开始 120 分钟计时</button>`}
        <button class="ghost" data-act="essayskel">把当前选题骨架填进来</button>
        <button class="ghost" data-act="essayclear">清空</button>
      </div>
      <p id="region-essayStat">${writeStat()}</p>
      <textarea class="note essay" data-bind="essayText" data-region="essayStat" placeholder="先打摘要和四个小标题占位，再填正文。">${esc(S.essayText || "")}</textarea>`;
  }

  function renderRules() {
    return `
      <div class="grid g2">
        <div class="panel flat"><h3 style="margin-top:0">结构与字数</h3>
          <table>
            <tr><td>摘要</td><td>300–400 字</td><td>项目 + 规模 + 我的角色 + 方法 + 效果</td></tr>
            <tr><td>项目背景</td><td>400–500 字</td><td>时间、单位、规模、周期、团队、我的职责</td></tr>
            <tr><td>理论论述</td><td>300–500 字</td><td>回答题目第 2 问：概念 + 分类/步骤</td></tr>
            <tr><td>实践展开</td><td>1200–1500 字</td><td>3–4 个点，每点“问题 → 方案 → 效果（带数字）”</td></tr>
            <tr><td>总结</td><td>200–300 字</td><td>成果 + 不足 + 改进方向</td></tr>
          </table>
          <p class="faint">正文段落按题目三问的顺序写，阅卷老师是对着三问找答案的。</p></div>
        <div class="panel flat"><h3 style="margin-top:0">质量属性 → 策略素材库</h3>
          <p><b>性能</b>：多级缓存、异步削峰、读写分离、分库分表、CDN、连接池、索引优化</p>
          <p><b>可用性</b>：集群 + 负载均衡、主备切换、限流熔断降级、异地多活、健康检查</p>
          <p><b>安全性</b>：统一认证（OAuth2/JWT）、RBAC、HTTPS、加密脱敏、审计日志、WAF</p>
          <p><b>可修改性</b>：分层、模块化、DDD 限界上下文、接口隔离、配置中心、插件化</p>
          <p><b>可伸缩性</b>：无状态服务、容器弹性伸缩、数据分片</p></div>
      </div>
      <div class="panel" style="margin-top:14px"><h3 style="margin-top:0">雷区</h3>
        <ul style="padding-left:18px">
          <li>摘要和正文对不上（两套项目故事混着写）。</li>
          <li>通篇理论定义，没有项目细节和数字。</li>
          <li>把微服务、3PC、云原生写成银弹，不讲代价。</li>
          <li>跑题写成项目管理或功能清单。</li>
          <li>没有结尾的不足与改进。</li>
          <li>字数不够：正文少于 2000 字风险很大。</li>
        </ul></div>`;
  }

  function renderEssay() {
    const S = api.S;
    const inner = { profile: renderProfile, topic: renderTopic, write: renderWrite, rules: renderRules }[S.essaySub]();
    return `<div class="row" style="margin-bottom:14px">${SUBS.map(([v, n]) => `<button class="pill ${S.essaySub === v ? "on" : ""}" data-act="essaysub" data-v="${v}">${n}</button>`).join("")}</div>${inner}`;
  }

  setInterval(() => {
    const S = api.S;
    if (S.tab !== "essay" || S.essaySub !== "write" || !S.essayStart) return;
    const el = document.getElementById("region-essayStat");
    if (el) el.innerHTML = writeStat();
  }, 15000);

  const curTopic = () => ESSAY_TOPICS.find((x) => x.id === api.S.essayTopic) || ESSAY_TOPICS[0];
  return {
    defaults: { essaySub: "profile", essayTopic: "nfr", prof: {}, essayText: "", essayStart: 0 },
    tabs: { essay: { name: "论文工坊", render: renderEssay } },
    subs: { essay: "essaySub" },
    regions: { essayStat: writeStat },
    acts: {
      essaysub: (v) => { api.S.essaySub = v; },
      essaytopic: (v) => { api.S.essayTopic = v; },
      essaycopy: (v, el) => {
        const text = skeleton(curTopic());
        const done = () => { el.textContent = "已复制"; setTimeout(() => { el.textContent = "复制"; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
        return false;
      },
      profreset: () => { if (!confirm("恢复成背诵稿的默认档案？")) return false; api.S.prof = {}; },
      essaystart: () => { api.S.essayStart = Date.now(); },
      essaystop: () => { api.S.essayStart = 0; },
      essayskel: () => {
        const S = api.S;
        if (S.essayText && !confirm("覆盖当前草稿？")) return false;
        S.essayText = skeleton(curTopic());
      },
      essayclear: () => { if (!confirm("清空草稿？")) return false; api.S.essayText = ""; api.S.essayStart = 0; }
    }
  };
});
