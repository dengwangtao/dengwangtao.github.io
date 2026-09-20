import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const ignoredTopLevelEntries = new Set([
  ".git",
  ".github",
  ".codegraph",
  "_site",
  "node_modules",
  "scripts"
]);
const unpublishedTopLevelEntries = new Set([
  ...ignoredTopLevelEntries,
  ".gitignore",
  "directory.config.json",
  "package-lock.json",
  "package.json",
  "README.md"
]);

const outputFlagIndex = process.argv.indexOf("--output");
const outputArgument = outputFlagIndex === -1 ? null : process.argv[outputFlagIndex + 1];

if (outputFlagIndex !== -1 && !outputArgument) {
  throw new Error("--output 需要指定输出目录，例如：--output _site");
}

const outputDirectory = outputArgument ? path.resolve(projectRoot, outputArgument) : null;
if (outputDirectory) validateOutputDirectory(outputDirectory);

const config = JSON.parse(
  await fs.readFile(path.join(projectRoot, "directory.config.json"), "utf8")
);
const excludedPages = new Set((config.exclude ?? []).map(normalizePath));
const pinnedPages = new Map(
  (config.pinned ?? []).map((pagePath, index) => [normalizePath(pagePath), index])
);

const htmlFiles = await collectHtmlFiles(projectRoot, "");
const pages = [];

for (const relativePath of htmlFiles) {
  const normalizedPath = normalizePath(relativePath);
  if (excludedPages.has(normalizedPath)) continue;

  const source = await fs.readFile(path.join(projectRoot, relativePath), "utf8");
  const metadata = readMetadata(source);
  if (metadata.hidden) continue;

  const pathSegments = normalizedPath.split("/");
  const fileName = pathSegments.at(-1);
  const fallbackTitle = humanize(fileName.replace(/\.html?$/i, ""));

  pages.push({
    title: metadata.directoryTitle || metadata.title || fallbackTitle,
    description: metadata.description || `打开 ${fallbackTitle}`,
    relativePath: normalizedPath,
    href: toPublicHref(normalizedPath),
    folderSegments: pathSegments.slice(0, -1),
    order: metadata.order,
    pinnedOrder: pinnedPages.get(normalizedPath) ?? Number.MAX_SAFE_INTEGER,
    kind: detectPageKind(metadata.title, normalizedPath)
  });
}

pages.sort(comparePages);

const tree = createFolderNode("", []);
for (const page of pages) insertPage(tree, page);
sortTree(tree);

const folderCount = countFolders(tree);
const generatedHtml = renderDocument({ config, tree, pages, folderCount });
const targetDirectory = outputDirectory ?? projectRoot;

if (outputDirectory) {
  await prepareOutputDirectory(outputDirectory);
  await copyPublishedFiles(projectRoot, outputDirectory, "");
}

await fs.writeFile(path.join(targetDirectory, "index.html"), generatedHtml, "utf8");

if (outputDirectory) {
  console.log(`已生成 ${pages.length} 个页面、${folderCount} 个目录到 ${path.relative(projectRoot, outputDirectory)}/`);
} else {
  console.log(`已生成首页：${pages.length} 个页面、${folderCount} 个目录。`);
}

async function collectHtmlFiles(currentDirectory, relativeDirectory) {
  if (outputDirectory && path.resolve(currentDirectory) === outputDirectory) return [];

  const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!relativeDirectory && ignoredTopLevelEntries.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      results.push(...await collectHtmlFiles(absolutePath, relativePath));
    } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
      results.push(relativePath);
    }
  }

  return results;
}

function validateOutputDirectory(directory) {
  const rootPrefix = `${projectRoot}${path.sep}`;
  if (directory === projectRoot || !directory.startsWith(rootPrefix)) {
    throw new Error("输出目录必须位于项目目录内部，且不能是项目根目录。");
  }
}

async function prepareOutputDirectory(directory) {
  validateOutputDirectory(path.resolve(directory));
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
}

async function copyPublishedFiles(sourceDirectory, targetDirectory, relativeDirectory) {
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    if (!relativeDirectory && unpublishedTopLevelEntries.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const sourcePath = path.join(sourceDirectory, entry.name);
    if (outputDirectory && path.resolve(sourcePath) === outputDirectory) continue;

    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await copyPublishedFiles(sourcePath, targetPath, path.join(relativeDirectory, entry.name));
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

function readMetadata(source) {
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metadata = {
    title: cleanText(titleMatch?.[1] ?? ""),
    directoryTitle: "",
    description: "",
    hidden: false,
    order: Number.MAX_SAFE_INTEGER
  };

  for (const tag of source.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = readAttributes(tag);
    const name = (attributes.name ?? "").toLowerCase();
    const content = cleanText(attributes.content ?? "");

    if (name === "description") metadata.description = content;
    if (name === "directory-title") metadata.directoryTitle = content;
    if (name === "directory-hidden") metadata.hidden = content.toLowerCase() === "true";
    if (name === "directory-order" && Number.isFinite(Number(content))) {
      metadata.order = Number(content);
    }
  }

  return metadata;
}

function readAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = pattern.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attributes;
}

function cleanText(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value) {
  const entities = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function normalizePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function toPublicHref(relativePath) {
  const segments = normalizePath(relativePath).split("/");
  const fileName = segments.at(-1).toLowerCase();

  if (fileName === "index.html" || fileName === "index.htm") {
    const folderSegments = segments.slice(0, -1).map(encodeURIComponent);
    return folderSegments.length ? `${folderSegments.join("/")}/` : "./";
  }

  return segments.map(encodeURIComponent).join("/");
}

function humanize(value) {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch {}
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim() || "未命名页面";
}

function detectPageKind(title, relativePath) {
  const value = `${title} ${relativePath}`.toLowerCase();
  if (/about|profile|home|个人|主页/.test(value)) return "profile";
  if (/tool|generator|生成|转换|计算/.test(value)) return "tool";
  if (/guide|ielts|学习|指南|教程|文档/.test(value)) return "guide";
  return "page";
}

function comparePages(left, right) {
  return left.pinnedOrder - right.pinnedOrder
    || left.order - right.order
    || left.title.localeCompare(right.title, "zh-CN");
}

function createFolderNode(name, segments) {
  return { name, segments, folders: new Map(), pages: [] };
}

function insertPage(root, page) {
  let node = root;
  for (const segment of page.folderSegments) {
    if (!node.folders.has(segment)) {
      node.folders.set(segment, createFolderNode(segment, [...node.segments, segment]));
    }
    node = node.folders.get(segment);
  }
  node.pages.push(page);
}

function sortTree(node) {
  node.pages.sort(comparePages);
  node.folders = new Map(
    [...node.folders.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"))
  );
  for (const child of node.folders.values()) sortTree(child);
}

function countFolders(node) {
  let count = node.folders.size;
  for (const child of node.folders.values()) count += countFolders(child);
  return count;
}

function countPages(node) {
  let count = node.pages.length;
  for (const child of node.folders.values()) count += countPages(child);
  return count;
}

function renderDocument({ config, tree, pages: allPages, folderCount }) {
  const rootPages = tree.pages.map(renderPageCard).join("\n");
  const folders = [...tree.folders.values()].map(folder => renderFolder(folder, 0)).join("\n");
  const content = [rootPages && `<div class="page-grid">${rootPages}</div>`, folders]
    .filter(Boolean)
    .join("\n");
  const generatedDate = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "long",
    timeZone: "Asia/Shanghai"
  }).format(new Date());

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeAttribute(config.description)}" />
  <meta name="color-scheme" content="dark" />
  <title>${escapeHtml(config.title)}</title>
  <link rel="stylesheet" href="assets/directory.css" />
</head>
<body>
  <main class="shell">
    <nav class="topbar" aria-label="站点导航">
      <a class="brand" href="./" aria-label="返回目录首页"><span class="brand-mark">DW</span><span>Deng Wangtao</span></a>
      <a class="repository-link" href="${escapeAttribute(config.repositoryUrl)}" target="_blank" rel="noreferrer">
        ${icon("github", 17)}<span class="repository-label">查看 GitHub 仓库</span>
      </a>
    </nav>
    <header class="hero">
      <div class="eyebrow">Auto-generated index</div>
      <h1><span class="gradient-text">${escapeHtml(config.heading)}</span></h1>
      <p class="intro">${escapeHtml(config.description)}</p>
      <div class="stats" aria-label="目录统计">
        <span class="stat"><strong>${allPages.length}</strong> 个页面</span>
        <span class="stat"><strong>${folderCount}</strong> 个文件夹</span>
        <span class="stat">支持递归目录与即时搜索</span>
      </div>
    </header>
    <label class="search-panel" for="directory-search">
      ${icon("search", 20)}
      <input id="directory-search" type="search" placeholder="搜索页面名称、说明或路径…" autocomplete="off" />
      <button class="clear-search" type="button" aria-label="清除搜索">清除</button>
    </label>
    <section class="directory" aria-label="页面目录">
      ${content || '<div class="empty-state"><strong>还没有可展示的页面</strong><span>添加 HTML 文件后重新运行生成脚本。</span></div>'}
      <div class="empty-state" data-search-empty hidden><strong>没有找到匹配页面</strong><span>尝试使用更短的关键词或文件夹名称。</span></div>
    </section>
    <footer><span>目录由仓库内的 HTML 文件自动生成</span><span>最后生成：${escapeHtml(generatedDate)}</span></footer>
  </main>
  <script src="assets/directory.js"></script>
</body>
</html>
`;
}

function renderFolder(folder, depth) {
  const pageCards = folder.pages.map(renderPageCard).join("\n");
  const childFolders = [...folder.folders.values()].map(child => renderFolder(child, depth + 1)).join("\n");
  const folderPath = `${folder.segments.join("/")}/`;

  return `<details class="folder" data-folder${depth === 0 ? " open" : ""}>
  <summary class="folder-summary">
    <span class="folder-icon">${icon("folder", 20)}</span>
    <span><span class="folder-name">${escapeHtml(humanize(folder.name))}</span><span class="folder-path">${escapeHtml(folderPath)}</span></span>
    <span class="folder-count">${countPages(folder)} 个页面</span>
    <span class="folder-chevron">${icon("chevron", 17)}</span>
  </summary>
  <div class="folder-content">
    ${pageCards ? `<div class="page-grid">${pageCards}</div>` : ""}
    ${childFolders}
  </div>
</details>`;
}

function renderPageCard(page) {
  const searchValue = `${page.title} ${page.description} ${page.relativePath}`;
  return `<a class="page-card" data-page-card data-search="${escapeAttribute(searchValue)}" href="${escapeAttribute(page.href)}">
  <span class="page-icon">${icon(page.kind, 23)}</span>
  <span class="page-copy"><span class="page-title">${escapeHtml(page.title)}</span><span class="page-description">${escapeHtml(page.description)}</span><span class="page-path">${escapeHtml(page.relativePath)}</span></span>
  <span class="page-arrow">${icon("arrow", 18)}</span>
</a>`;
}

function icon(name, size) {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
    github: '<path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.8a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.79c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
    guide: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22z"/>',
    page: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5-5L7 4l3 3-2.7 2.7a4 4 0 0 0-5 5L9 8l7 7-6.7 6.7a4 4 0 0 0 5-5L12 14l3-3 2.7 2.7a4 4 0 0 0 5-5L16 15 9 8z"/>'
  };
  const fill = name === "github" ? ' fill="currentColor" stroke="none"' : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"${fill} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.page}</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
