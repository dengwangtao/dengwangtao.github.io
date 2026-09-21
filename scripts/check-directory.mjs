import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(projectRoot, "_site");
const ignoredTopLevelEntries = new Set([
  ".git",
  ".github",
  ".codegraph",
  "_site",
  "DIRECTORY_CONFIG.md",
  "node_modules",
  "README.md",
  "scripts"
]);
const config = JSON.parse(
  await fs.readFile(path.join(projectRoot, "directory.config.json"), "utf8")
);
const excludedPages = new Set((config.exclude ?? []).map(normalizePath));
const sourcePages = (await collectContentFiles(projectRoot, ""))
  .map(normalizePath)
  .filter(page => !excludedPages.has(page));
const listedPages = [];

for (const page of sourcePages) {
  const source = await fs.readFile(path.join(projectRoot, ...page.split("/")), "utf8");
  const htmlHidden = /<meta\b[^>]*name=["']directory-hidden["'][^>]*content=["']true["'][^>]*>/i.test(source)
    || /<meta\b[^>]*content=["']true["'][^>]*name=["']directory-hidden["'][^>]*>/i.test(source);
  const markdownHidden = /^---\s*$[\s\S]*?^(?:hidden|directory-hidden):\s*true\s*$[\s\S]*?^---\s*$/im.test(source);

  if (!htmlHidden && !markdownHidden) {
    listedPages.push(page);
  }
}

const generatedIndex = await fs.readFile(path.join(buildDirectory, "index.html"), "utf8");

assert(generatedIndex.includes("data-page-card"), "生成首页中没有页面卡片");
if (listedPages.some(page => page.includes("/"))) {
  assert(generatedIndex.includes("data-folder"), "生成首页缺少嵌套目录结构");
}

for (const page of sourcePages) {
  const outputPage = page.replace(/\.md$/i, ".html");
  await fs.access(path.join(buildDirectory, ...outputPage.split("/")));

  if (/\.md$/i.test(page)) {
    const source = await fs.readFile(
      path.join(projectRoot, ...page.split("/")),
      "utf8"
    );
    const renderedMarkdown = await fs.readFile(
      path.join(buildDirectory, ...outputPage.split("/")),
      "utf8"
    );
    assert(renderedMarkdown.includes('class="markdown-body"'), `Markdown 未正确渲染：${page}`);
    assert(renderedMarkdown.includes("assets/markdown.css"), `Markdown 页面缺少样式：${page}`);

    const hasMermaid = /^(?:`{3,}|~{3,})\s*mermaid(?:\s|$)/im.test(source);
    if (hasMermaid) {
      assert(renderedMarkdown.includes('class="mermaid"'), `Mermaid 未正确转换：${page}`);
      assert(renderedMarkdown.includes("assets/mermaid.js"), `Mermaid 页面缺少渲染脚本：${page}`);
    }

    const hasHighlightedCode = /^(?:`{3,}|~{3,})\s*(?:cpp|c\+\+|javascript|js|json|html|css|bash)(?:\s|$)/im.test(source);
    if (hasHighlightedCode) {
      assert(renderedMarkdown.includes('class="hljs language-'), `代码块未正确高亮：${page}`);
    }

    const tocDisabled = /^---\s*$[\s\S]*?^toc:\s*false\s*$[\s\S]*?^---\s*$/im.test(source);
    const hasTocHeadings = /^#{2,4}\s+\S/m.test(source);
    if (hasTocHeadings && !tocDisabled) {
      assert(renderedMarkdown.includes('class="article-toc"'), `Markdown 页面缺少文章目录：${page}`);
      assert(renderedMarkdown.includes("assets/toc.js"), `文章目录缺少交互脚本：${page}`);
      assert(/<h[2-4] id="[^"]+">/.test(renderedMarkdown), `Markdown 标题缺少跳转锚点：${page}`);
    }
  }
}

for (const page of listedPages) {
  assert(generatedIndex.includes(escapeHtml(page)), `目录中缺少页面：${page}`);
}

for (const unpublishedPath of ["scripts", ".github", "package.json", "directory.config.json"]) {
  const candidate = path.join(buildDirectory, unpublishedPath);
  try {
    await fs.access(candidate);
    throw new Error(`构建目录不应包含：${unpublishedPath}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await fs.access(path.join(buildDirectory, "assets", "markdown.css"));
await fs.access(path.join(buildDirectory, "assets", "mermaid.js"));
await fs.access(path.join(buildDirectory, "assets", "toc.js"));

console.log(`目录校验通过：${listedPages.length} 个页面已收录，${sourcePages.length} 个内容文件已发布。`);

async function collectContentFiles(currentDirectory, relativeDirectory) {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!relativeDirectory && ignoredTopLevelEntries.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectContentFiles(path.join(currentDirectory, entry.name), relativePath));
    } else if (entry.isFile() && /\.(?:html?|md)$/i.test(entry.name)) {
      results.push(relativePath);
    }
  }

  return results;
}

function normalizePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
