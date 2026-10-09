// 把《论文终版模板.md》与《论文套题库.md》解析成 交互学习面板/essay-data.js。
// 面板里的“终版模板 / 套题背诵 / 组装与默写”都读这份数据；改完两个 md 之后运行 node scripts/prepare-site.js 即可。
const fs = require("fs");
const path = require("path");

const lenOf = (s) => String(s || "").replace(/[\s【】]/g, "").length;
const paras = (text) => text.split("\n").map((x) => x.trim()).filter(Boolean);

function sectionBody(md, h2Prefix) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && l.includes(h2Prefix));
  if (start < 0) return [];
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end);
}

function parseTemplate(md) {
  const body = sectionBody(md, "终版正文");
  const out = {};
  let key = null;
  for (const line of body) {
    const h = /^###\s+(.+?)\s*$/.exec(line);
    if (h) { key = h[1]; out[key] = []; continue; }
    if (key && line.trim()) out[key].push(line.trim());
  }
  const need = ["标题", "摘要", "第一段", "第二段", "第三段（完整版）", "第三段（简版）", "第四段"];
  for (const k of need) if (!out[k] || !out[k].length) throw new Error("论文终版模板.md 缺少小节：" + k);
  return {
    title: out["标题"].join("\n"),
    abstract: out["摘要"],
    p1: out["第一段"],
    p2: out["第二段"],
    p3full: out["第三段（完整版）"],
    p3short: out["第三段（简版）"],
    p4: out["第四段"]
  };
}

function parseFacts(md) {
  const rows = sectionBody(md, "项目事实表").filter((l) => l.trim().startsWith("|"));
  return rows.slice(2).map((r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())).filter((r) => r.length >= 3);
}

function parseKits(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const kits = [];
  let cur = null, slot = null;
  const flush = () => {
    if (!cur) return;
    for (const k of Object.keys(cur.slots)) cur.slots[k] = cur.slots[k].join("\n").trim();
    kits.push(cur);
  };
  for (const line of lines) {
    const k = /^###\s+(K\d\d)\s+(.+?)\s*$/.exec(line);
    if (k) { flush(); cur = { id: k[1], name: k[2], meta: {}, note: "", slots: {} }; slot = null; continue; }
    if (/^##\s/.test(line)) { flush(); cur = null; slot = null; continue; }
    if (!cur) continue;
    const s = /^\*\*([A-Z]\d?)\s+(.+?)\*\*\s*$/.exec(line);
    if (s) { slot = s[1]; cur.slots[slot] = []; cur.slotNames = cur.slotNames || {}; cur.slotNames[slot] = s[2]; continue; }
    const m = /^-\s+(.+?)：(.*)$/.exec(line);
    if (m && !slot) { cur.meta[m[1]] = m[2].trim(); continue; }
    if (line.startsWith(">")) { cur.note += line.replace(/^>\s?/, "") + "\n"; continue; }
    if (slot && line.trim()) cur.slots[slot].push(line.trim());
  }
  flush();
  return kits
    .filter((k) => k.slots.A && k.slots.B)
    .map((k) => ({
      id: k.id,
      name: k.name,
      tier: k.meta["梯队"] || "选背",
      exams: k.meta["真题"] || "",
      heat: k.meta["热度"] || "",
      quad: k.meta["象限"] || "",
      p3: k.meta["第三段"] === "简版" ? "简版" : "完整",
      note: k.note.trim(),
      slots: k.slots
    }));
}

function assemble(tpl, kit) {
  const fill = (text) => text
    .replace(/【S】/g, kit.slots.S || "")
    .replace(/【A】/g, kit.slots.A || "")
    .replace(/【B2】/g, kit.slots.B2 || "")
    .replace(/【B】/g, kit.slots.B || "")
    .replace(/【C】/g, kit.slots.C || "")
    .replace(/【E】/g, kit.slots.E || "")
    .replace(/【D】/g, kit.slots.D || "");
  const p3 = kit.p3 === "简版" ? tpl.p3short : tpl.p3full;
  return { abstract: tpl.abstract.map(fill), body: [].concat(tpl.p1, tpl.p2, p3, tpl.p4).map(fill) };
}

function buildEssayData(root, panel) {
  const tplMd = fs.readFileSync(path.join(root, "论文终版模板.md"), "utf8");
  const kitMd = fs.readFileSync(path.join(root, "论文套题库.md"), "utf8");
  const template = parseTemplate(tplMd);
  const kits = parseKits(kitMd);

  const stats = { template: {}, kits: {} };
  const cnt = (arr) => lenOf(arr.join(""));
  // 母版本身（不含槽位）
  const strip = (arr) => arr.map((x) => x.replace(/【[A-Z]\d?】/g, ""));
  stats.template = {
    abstract: cnt(strip(template.abstract)), p1: cnt(strip(template.p1)), p2: cnt(strip(template.p2)),
    p3full: cnt(strip(template.p3full)), p3short: cnt(strip(template.p3short)), p4: cnt(strip(template.p4))
  };
  for (const k of kits) {
    const a = assemble(template, k);
    const abs = cnt(a.abstract), body = cnt(a.body);
    const fillP = (arr) => cnt(assemble({ abstract: [], p1: arr, p2: [], p3full: [], p3short: [], p4: [] }, k).body);
    const parts = {
      p1: fillP(template.p1), p2: fillP(template.p2), p3: fillP(k.p3 === "简版" ? template.p3short : template.p3full), p4: fillP(template.p4)
    };
    stats.kits[k.id] = { abstract: abs, body, total: abs + body, parts, slots: Object.fromEntries(Object.entries(k.slots).map(([s, t]) => [s, lenOf(t)])) };
  }
  const facts = parseFacts(tplMd);
  const data = { template, kits, facts, stats, md: { template: tplMd.replace(/\r\n/g, "\n"), fallback: sectionBody(kitMd, "兜底法").join("\n").trim() } };
  fs.writeFileSync(path.join(panel, "essay-data.js"), "window.ESSAY_FINAL = " + JSON.stringify(data) + ";\n");
  return data;
}

module.exports = { buildEssayData, parseTemplate, parseKits, assemble, lenOf };

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const d = buildEssayData(root, path.join(root, "交互学习面板"));
  console.log("母版字数（不含槽位）", JSON.stringify(d.stats.template));
  for (const k of d.kits) {
    const s = d.stats.kits[k.id];
    console.log(k.id, k.name, "| 摘要", s.abstract, "正文", s.body, "合计", s.total, "| 第三段", k.p3, "| 槽位", JSON.stringify(s.slots));
  }
}
