// 覆盖本提纲实际用到的 Markdown：标题、表格、列表、引用、加粗、行内代码、公式。
window.renderMarkdown = function (src) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => esc(s)
    .replace(/\\\((.+?)\\\)/g, "<span class=\"math\">$1</span>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const toc = [];
  let html = "";
  let i = 0;
  const slug = (t) => "s" + toc.length + "-" + t.replace(/\s+/g, "").slice(0, 24);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = slug(text);
      if (level >= 2) toc.push({ id, level, text: text.replace(/\*\*/g, "") });
      html += `<h${level} id="${id}">${inline(text)}</h${level}>`;
      i++; continue;
    }
    if (/^---\s*$/.test(line)) { html += "<hr>"; i++; continue; }

    if (line.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      html += `<blockquote>${buf.map(inline).join("<br>")}</blockquote>`;
      continue;
    }

    if (line.trim().startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      html += "<div class=\"md-table\"><table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>"
        + body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("")
        + "</tbody></table></div>";
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      html += "<ul>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ul>";
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      html += "<ol>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ol>";
      continue;
    }

    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\||---\s*$)/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    html += `<p>${buf.map(inline).join("<br>")}</p>`;
  }
  return { html, toc };
};
