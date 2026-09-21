# 自动目录配置说明

站点首页由 `scripts/generate-directory.mjs` 自动生成。通常情况下，只需要新增 HTML 文件并推送到 `main` 分支，不需要手动修改目录首页或配置文件。

## 自动生成流程

推送代码后，GitHub Actions 会自动执行：

```bash
npm run build
npm run check
```

生成器会递归扫描仓库中的所有 `.html`、`.htm` 和 `.md` 文件，将页面与文件夹层级写入 `_site/index.html`，然后部署 `_site/`。Markdown 会转换为同路径、同文件名的 `.html` 页面。

本地预览时可以运行：

```bash
npm run generate
```

该命令会生成完整的 `_site/` 发布目录。使用浏览器打开 `_site/index.html` 即可预览。

## 全局配置

首页的全局设置位于 `directory.config.json`：

```json
{
  "title": "Deng Wangtao · 页面目录",
  "heading": "探索这个站点",
  "description": "这里汇集了个人主页、在线工具、学习资料以及后续新增的独立页面。",
  "repositoryUrl": "https://github.com/dengwangtao/dengwangtao.github.io",
  "exclude": [
    "index.html",
    "404.html",
    "README.md",
    "DIRECTORY_CONFIG.md"
  ],
  "pinned": [
    "about.html",
    "cell.html",
    "ielts.html"
  ]
}
```

### 配置字段

| 字段 | 必填 | 作用 |
| --- | --- | --- |
| `title` | 是 | 浏览器标签页中显示的标题。 |
| `heading` | 是 | 首页顶部的大标题。 |
| `description` | 是 | 首页顶部的站点介绍。 |
| `repositoryUrl` | 是 | 首页右上角的 GitHub 仓库链接。 |
| `exclude` | 否 | 不显示在目录中的页面路径。路径相对于仓库根目录。 |
| `pinned` | 否 | 置顶页面及其排列顺序。未列出的页面仍会自动显示。 |

新增普通页面时不需要修改这个文件。只有修改首页文案、隐藏页面或调整置顶顺序时才需要更新它。

## 添加页面

HTML 和 Markdown 文件都可以放在仓库根目录，也可以放入任意层级的文件夹：

```text
tools/
  text/
    formatter.html
notes/
  english/
    vocabulary.md
```

目录结构会自动按照实际文件夹层级生成。新增文件后直接提交并推送即可。

每个页面至少建议设置 `<title>`：

```html
<head>
  <meta charset="UTF-8">
  <title>文本格式化工具</title>
  <meta name="description" content="整理和转换常见文本格式。">
</head>
```

如果没有 `<title>`，生成器会根据文件名生成标题；如果没有描述，则会生成简单的默认描述。

### Markdown 页面

Markdown 文件支持顶部 front matter 配置：

```markdown
---
title: JavaScript 学习笔记
description: JavaScript 基础知识整理
order: 10
hidden: false
---

# JavaScript 学习笔记

## 变量

使用 `const` 声明不需要重新赋值的变量。
```

字段含义：

| 字段 | 作用 |
| --- | --- |
| `title` | 页面标题和目录标题。没有配置时读取正文中的第一个一级标题。 |
| `description` | 目录卡片和页面顶部的简介。 |
| `order` | 同一文件夹中的排列顺序，数值越小越靠前。 |
| `hidden` | 设置为 `true` 时不显示在目录中，但仍会生成 HTML。 |
| `directory-title` | 只覆盖目录卡片标题。 |

例如 `notes/javascript/basic.md` 会生成 `_site/notes/javascript/basic.html`。Markdown 中指向其他 `.md` 文件的链接也会自动改写为 `.html`。

带语言名称的代码围栏会在构建时自动生成语法高亮，例如：

````markdown
```cpp
#include <iostream>

int main() {
    std::cout << "Hello";
}
```
````

### Mermaid 图表

Markdown 页面支持 Mermaid。在代码围栏中把语言标记为 `mermaid`：

````markdown
```mermaid
flowchart LR
    A[开始] --> B[构建 Markdown]
    B --> C[生成 HTML]
    C --> D[浏览器渲染图表]
```
````

构建器会自动把代码块转换为 Mermaid 容器，并且只在包含图表的页面加载 `assets/mermaid.js`。浏览器需要能够访问 Mermaid 使用的 CDN；加载失败时页面会保留图表源代码并在控制台输出错误。

## 页面级配置

页面可以通过 `<meta>` 标签覆盖目录中的显示方式。

### 自定义目录标题

只修改目录中显示的标题，不影响浏览器标题：

```html
<meta name="directory-title" content="文本格式化">
```

### 自定义排列顺序

数值越小，在同一文件夹中越靠前：

```html
<meta name="directory-order" content="10">
```

`directory.config.json` 中的 `pinned` 优先级高于 `directory-order`。

### 隐藏页面

页面仍会被复制到发布目录并可以通过链接访问，但不会出现在首页目录中：

```html
<meta name="directory-hidden" content="true">
```

如果不希望页面被发布，应将其放在生成器忽略的开发目录中，或者调整构建脚本，而不仅仅是设置 `directory-hidden`。

## 排除页面

可以通过 `exclude` 排除指定路径：

```json
{
  "exclude": [
    "index.html",
    "404.html",
    "drafts/preview.html"
  ]
}
```

路径必须使用 `/`，并且相对于仓库根目录。`exclude` 只控制目录展示，不会阻止文件复制到发布目录。

## 置顶页面

通过 `pinned` 指定页面的置顶顺序：

```json
{
  "pinned": [
    "about.html",
    "tools/cell.html",
    "notes/english/ielts.html"
  ]
}
```

不需要将所有页面都加入 `pinned`。未配置的页面会按照页面级 `directory-order` 和标题自动排序。

如果不需要置顶，可以设置为空数组：

```json
{
  "pinned": []
}
```

## GitHub Pages 设置

首次部署时，在仓库中打开：

**Settings → Pages → Build and deployment → Source → GitHub Actions**

之后每次向 `main` 分支推送代码，`.github/workflows/pages.yml` 都会自动重新生成并部署目录。
