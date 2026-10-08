const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const panel = path.join(root, "交互学习面板");
const md = fs.readFileSync(path.join(root, "背诵总提纲.md"), "utf8");
fs.writeFileSync(path.join(panel, "outline.js"), "window.OUTLINE_MD = " + JSON.stringify(md) + ";\n");

const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
for (const name of ["index.html", "style.css", "data.js", "md.js", "case.js", "case-real.js", "drill.js", "plan.js", "book.js", "bank.js", "ui-sprint.js", "ui-drill.js", "ui-case.js", "ui-essay.js", "app.js", "outline.js"]) {
  fs.copyFileSync(path.join(panel, name), path.join(dist, name));
}
console.log("outline.js + dist/ ready");
