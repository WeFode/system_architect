// 从《32 小时通关》Markdown 抽取练习题与两套上午模拟卷，生成 交互学习面板/bank.js。
// 原书 Markdown 不进仓库，所以 bank.js 是提交进去的产物；改了抽取规则再手动跑一次。
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const SRC = path.join(root, "2. 彩色 考试32小时通关-第2版（2024).md");
const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

const clean = (s) => s
  .replace(/<\/?u>|<\/?mark>|\*\*|<sup>|<\/sup>|<br>|~~[^~]*~~/g, "")
  .replace(/^[\s\-#]+/, "")
  .replace(/淘宝店铺：跨时代图书会提供/g, "")
  .trim();
const noise = (l) => !l || /^(系统架构设计师考试 32 小时通关|模拟试题 ?[ⅠⅡ])/.test(l) || /^\d{1,3}$/.test(l) || (/第 ?\d+ ?小时\s*\S*$/.test(l) && l.length < 40);
const CJK = "\\u4e00-\\u9fa5，。；：、“”（）《》？！";
const tidy = (s) => s
  .replace(new RegExp(`([${CJK}])\\s+(?=[${CJK}])`, "g"), "$1")
  .replace(/\s+/g, " ")
  .trim();

const sections = [];
let cur = null;
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  const head = L.match(/^# .*?\*\*<u>(\d+)<\/u>\*\*/) || L.match(/^# .*?第\s*(\d+)\s*小时/);
  if (/^# /.test(L) && head && i > 380) {
    if (cur) sections.push(cur);
    const h = +head[1];
    cur = h === 27 || h === 30 ? { hour: h, kind: "mock", lines: [] } : null;
    continue;
  }
  const pr = L.match(/^###### (\d+)\.\d+ <u>练习题/);
  if (pr) {
    if (cur) sections.push(cur);
    cur = { hour: +pr[1], kind: "practice", lines: [] };
    continue;
  }
  if (cur) cur.lines.push(L);
}
if (cur) sections.push(cur);

const HOUR_MOD = { 1: "base", 2: "emb", 3: "base", 4: "sys", 5: "sec", 6: "sys", 7: "se", 8: "base", 9: "arch", 10: "arch", 11: "arch", 12: "arch", 13: "sys", 14: "sys", 15: "sys", 16: "arch", 17: "arch", 18: "arch", 19: "emb", 20: "emb", 21: "sec", 22: "arch", 23: "misc", 24: "misc", 25: "misc" };
const GUESS = [
  ["misc", /著作权|专利|商标|知识产权|侵权|保护期|不确定型决策|决策树|后悔值|最大流|线性规划|最小生成树|动态规划|关键路径/],
  ["arch", /架构|风格|质量属性|ATAM|SAAM|构件|连接件|DSSA|ABSD|演化|可靠性|容错|检错|SOA|微服务|云原生|容器|无服务器|ESB|中间件|MVC|缓存|Redis|大数据|管道|过滤器|Active\/Standby/],
  ["sec", /加密|签名|密钥|攻击|安全威胁|安全模型|安全策略|安全协议|访问控制|证书|防火墙|入侵|病毒|BLP|Biba|MD5|哈希|安全保护等级|远程登录|上网痕迹/],
  ["sys", /ERP|CRM|SCM|电子政务|电子商务|信息系统|系统工程|霍尔|切克兰德|TOGAF|企业集成|物联网|数字孪生|边缘计算|人工智能|云计算|系统规划|可行性|数据仓库/],
  ["emb", /嵌入式|实时操作系统|RTOS|航电|ARINC|DSP|鸿蒙|传感器|5G|交换机|路由器|局域网|以太网|IPv6|网络/],
  ["se", /需求|测试|维护|用例|UML|耦合|内聚|设计模式|敏捷|RUP|CMM|净室|项目|开发模型|面向对象|螺旋|原型|快速应用开发|首席程序员|软件过程|用户界面/],
  ["base", /./]
];
const english = (s) => s.length > 80 && (s.match(/[A-Za-z]/g) || []).length > s.replace(/\s/g, "").length * 0.75;
const guess = (s) => english(s) ? "misc" : GUESS.find(([, re]) => re.test(s))[0];

const ansRe = /(?:参考)?答案[：:]\s*((?:（\d+）\s*)?[A-D](?:[\s、，,]*(?:（\d+）\s*)?[A-D])*)/g;
const out = [];
let skipped = 0;
for (const s of sections) {
  const text = s.lines.map(clean).filter((l) => !noise(l)).join(" ").replace(/\s+/g, " ");
  let last = 0, m;
  ansRe.lastIndex = 0;
  while ((m = ansRe.exec(text))) {
    const chunk = text.slice(last, m.index);
    last = m.index + m[0].length;
    const answers = [...m[1].matchAll(/(?:（(\d+)）)?\s*([A-D])/g)].map((x) => ({ n: x[1], r: x[2] }));
    const wi = chunk.search(/试题解析|解析[：:]/);
    const qpart = wi >= 0 ? chunk.slice(0, wi) : chunk;
    const why = wi >= 0 ? chunk.slice(wi).replace(/^(试题解析|解析[：:])\s*/, "") : "";
    const multi = [...qpart.matchAll(/（(\d+)）\s*A[．.]\s*(.*?)\s*B[．.]\s*(.*?)\s*C[．.]\s*(.*?)\s*D[．.]\s*(.*?)(?=\s*（\d+）\s*A[．.]|$)/g)];
    let stem, groups;
    if (multi.length) {
      stem = qpart.slice(0, qpart.indexOf(multi[0][0]));
      groups = multi.map((g) => ({ n: g[1], o: [g[2], g[3], g[4], g[5]] }));
    } else {
      const g = qpart.match(/^(.*?)\s*A[．.]\s*(.*?)\s*B[．.]\s*(.*?)\s*C[．.]\s*(.*?)\s*D[．.]\s*(.*?)$/);
      if (!g) { skipped++; continue; }
      stem = g[1];
      groups = [{ n: null, o: [g[2], g[3], g[4], g[5]] }];
    }
    stem = tidy(stem)
      .replace(/^\d{2,3}\s*\[\s*/, "")
      .replace(/^[^\u4e00-\u9fa5A-Za-z0-9（(“"]+/, "")
      .replace(/^\d+[．.]\s*/, "");
    const cap = english(stem) ? 1600 : 520;
    if (stem.length > cap) stem = "……" + stem.slice(-cap);
    groups.forEach((g, k) => {
      const a = (g.n && answers.find((x) => x.n === g.n)) || answers[k];
      const o = g.o.map(tidy);
      if (!a || o.some((x) => !x || x.length > 150) || stem.length < 6) { skipped++; return; }
      const mod = s.kind === "mock" ? guess(stem) : HOUR_MOD[s.hour] || "base";
      out.push({
        id: "k" + (out.length + 1),
        m: mod,
        src: s.kind === "mock" ? (s.hour === 27 ? "模拟卷Ⅰ" : "模拟卷Ⅱ") : "第 " + s.hour + " 小时练习",
        q: stem + (g.n && groups.length > 1 ? `（本题问第（${g.n}）空）` : ""),
        o,
        r: "ABCD".indexOf(a.r),
        w: tidy(why).slice(0, 320)
      });
    });
  }
}

const body = "// 由 scripts/build-bank.js 从《32 小时通关》练习题与模拟卷生成，勿手改。\nwindow.BANK = " + JSON.stringify(out) + ";\n";
fs.writeFileSync(path.join(root, "交互学习面板", "bank.js"), body);
const by = {};
out.forEach((q) => { by[q.m] = (by[q.m] || 0) + 1; });
console.log("bank.js:", out.length, "questions, skipped", skipped, JSON.stringify(by));
