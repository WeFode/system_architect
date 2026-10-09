const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const mdName = process.argv[2] || "论文通用满分模板.md";
const pdfName = process.argv[3] || "论文背诵稿.pdf";
const htmlPath = path.join(root, "dist", path.basename(mdName, ".md") + ".html");
const pdfPath = path.join(root, pdfName);
const md = fs.readFileSync(path.join(root, mdName), "utf8");

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "交互学习面板", "md.js"), "utf8"), ctx);
const { html } = ctx.window.renderMarkdown(md);

const page = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>论文背诵稿</title>
<style>
  @page { size: 120mm 190mm; margin: 10mm 8mm 12mm; }
  body { margin: 0; color: #1d1d1f; font: 11pt/1.7 "Microsoft YaHei", "PingFang SC", sans-serif; }
  h1 { font-size: 16pt; line-height: 1.35; margin: 0 0 8px; }
  h2 { font-size: 13pt; margin: 16px 0 6px; page-break-before: always; }
  h2:first-of-type { page-break-before: auto; }
  h3 { font-size: 12pt; margin: 12px 0 4px; }
  h4 { font-size: 11.5pt; margin: 10px 0 4px; }
  p { margin: 0 0 8px; }
  .md h1 + p, .note { color: #444; }
</style></head>
<body><article class="md">${html}</article></body></html>`;

fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
fs.writeFileSync(htmlPath, page, "utf8");

const chrome = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].find((p) => fs.existsSync(p));
const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
const run = spawnSync(chrome, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-pdf-header-footer",
  "--print-to-pdf=" + pdfPath, fileUrl
], { stdio: "inherit", timeout: 120000 });
if (run.status !== 0) process.exit(run.status || 1);
console.log("PDF", pdfPath, Math.round(fs.statSync(pdfPath).size / 1024) + " KB");
