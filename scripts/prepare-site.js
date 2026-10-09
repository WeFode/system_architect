const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const panel = path.join(root, "交互学习面板");
const md = fs.readFileSync(path.join(root, "背诵总提纲.md"), "utf8");
fs.writeFileSync(path.join(panel, "outline.js"), "window.OUTLINE_MD = " + JSON.stringify(md) + ";\n");

// 论文终版模板.md + 论文套题库.md → essay-data.js
const { buildEssayData } = require("./build-essay-data.js");
buildEssayData(root, panel);

const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
const FILES = [
  "index.html", "style.css", "data.js", "md.js", "case.js", "case-real.js", "drill.js", "plan.js", "book.js", "bank.js",
  "essay-data.js", "essay-matrix.js", "essay-vocab.js", "graph-data.js",
  "ui-sprint.js", "ui-drill.js", "ui-case.js", "ui-essay.js", "ui-anim.js", "sim-a.js", "sim-b.js", "ui-graph.js",
  "app.js", "outline.js"
];
for (const name of FILES) {
  fs.copyFileSync(path.join(panel, name), path.join(dist, name));
}
console.log("outline.js + essay-data.js + dist/ ready");
