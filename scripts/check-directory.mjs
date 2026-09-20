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
  "node_modules",
  "scripts"
]);
const config = JSON.parse(
  await fs.readFile(path.join(projectRoot, "directory.config.json"), "utf8")
);
const excludedPages = new Set((config.exclude ?? []).map(normalizePath));
const sourcePages = (await collectHtmlFiles(projectRoot, ""))
  .map(normalizePath)
  .filter(page => !excludedPages.has(page));
const listedPages = [];

for (const page of sourcePages) {
  const source = await fs.readFile(path.join(projectRoot, ...page.split("/")), "utf8");
  if (!/<meta\b[^>]*name=["']directory-hidden["'][^>]*content=["']true["'][^>]*>/i.test(source)
    && !/<meta\b[^>]*content=["']true["'][^>]*name=["']directory-hidden["'][^>]*>/i.test(source)) {
    listedPages.push(page);
  }
}

const generatedIndex = await fs.readFile(path.join(buildDirectory, "index.html"), "utf8");

assert(generatedIndex.includes("data-page-card"), "生成首页中没有页面卡片");
if (listedPages.some(page => page.includes("/"))) {
  assert(generatedIndex.includes("data-folder"), "生成首页缺少嵌套目录结构");
}

for (const page of sourcePages) {
  await fs.access(path.join(buildDirectory, ...page.split("/")));
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

console.log(`目录校验通过：${listedPages.length} 个页面已收录，${sourcePages.length} 个 HTML 文件已复制。`);

async function collectHtmlFiles(currentDirectory, relativeDirectory) {
  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!relativeDirectory && ignoredTopLevelEntries.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectHtmlFiles(path.join(currentDirectory, entry.name), relativePath));
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
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
