// 修正 bank.js 里的已知问题（幂等，可重复运行）：
//  1. 答案和原解析矛盾的题（按解析订正）；
//  2. OCR 混进选项/题干的残片（别的选项、下一空的选项、表格、HTML 注释）；
//  3. 无法修复的题（缺图、选项重复）打上 x:1，刷题与模考不再出这些题。
// build-bank.js 重新生成 bank.js 之后会自动调用本脚本。
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "交互学习面板", "bank.js");

const ANSWER_FIX = { k142: 1, k61: 3, k73: 2, k22: 2, k123: 1 };
const EXCLUDE = { k77: "缺图（图 24.12 没有保留）", k51: "选项 B 与 C 文字完全相同" };
const OPT_FIX = {
  k35: { 3: "领域应用" },
  k80: { 2: "software architecture" },
  k111: { 1: "极限编程（XP）开发方法" },
  k210: { 1: "class model，interaction model and state model" },
  k105: { 2: "可用性", 3: "可修改性" },
  k106: { 2: "可测试性", 3: "可修改性" }
};
const STEM_FIX = {
  k78: (s) => s.replace(/\|\s*\|---\|\s*\||\|\s*\|/g, ""),
  k35: (s) => s.replace(/^88 1 3．/, "").replace(/（1）A1）A）A/, "").replace(/（本题问第（1）空）$/, "") + "（本题问第（1）空）",
  k156: (s) => s.replace(/^.*?此描\s+/, ""),
  k157: (s) => s.replace(/^11）C ）C C\s+/, ""),
  k108: (s) => s.replace(/（本题问第（32）空）$/, "") + "（本题问第（32）空）"
};

const cleanOpt = (s) => String(s)
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\s*[|｜]\s*[|｜]?\s*-{3}[\s\S]*$/, "")
  .replace(/\|\s*\|[\s\S]*$/, "")
  .replace(/（\d+）\s*[A-D]．[\s\S]*$/, "")
  .replace(/\s+[A-D]．[\s\S]*$/, "")
  .replace(/\s+\d+\s*[“"][A-Za-z\s.]*$/, "")
  .replace(/[\s;；¢|｜]+$/, "")
  .trim();

function run() {
  const text = fs.readFileSync(file, "utf8");
  const m = /window\.BANK = (\[[\s\S]*\]);/.exec(text);
  if (!m) throw new Error("bank.js 格式不对");
  const bank = JSON.parse(m[1]);
  let nAns = 0, nOpt = 0, nStem = 0, nEx = 0;
  bank.forEach((q) => {
    const o = q.o.map(cleanOpt);
    const fix = OPT_FIX[q.id] || {};
    Object.keys(fix).forEach((i) => { o[+i] = fix[i]; });
    if (o.some((x, i) => x !== q.o[i])) { q.o = o; nOpt++; }
    if (STEM_FIX[q.id]) { const s = STEM_FIX[q.id](q.q); if (s !== q.q) { q.q = s; nStem++; } }
    if (ANSWER_FIX[q.id] != null && q.r !== ANSWER_FIX[q.id]) { q.r = ANSWER_FIX[q.id]; nAns++; }
    if (EXCLUDE[q.id] && !q.x) { q.x = 1; nEx++; }
  });
  const head = "// 由 scripts/build-bank.js 从《32 小时通关》练习题与模拟卷生成；已用 scripts/patch-bank.js 订正答案、清理 OCR 残片。\n";
  fs.writeFileSync(file, head + "window.BANK = " + JSON.stringify(bank) + ";\n");
  console.log(`patch-bank: 订正答案 ${nAns}，清理选项 ${nOpt}，整理题干 ${nStem}，排除 ${nEx}`);
}
module.exports = { run };
if (require.main === module) run();
