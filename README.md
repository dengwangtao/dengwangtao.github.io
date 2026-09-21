# dengwangtao.github.io

个人 GitHub Pages 站点。首页目录由脚本自动扫描仓库内的 HTML 和 Markdown 文件生成，并通过 GitHub Actions 部署。

## 添加页面

将 HTML 文件放在仓库任意目录中即可，文件夹可以任意嵌套：

```text
tools/
  text/
    formatter.html
notes/
  english/
    vocabulary.html
```

生成器默认读取页面的 `<title>` 和 `<meta name="description">`：

```html
<title>文本格式化工具</title>
<meta name="description" content="整理和转换常见文本格式。">
```

还可以使用以下可选元数据：

```html
<meta name="directory-title" content="目录中显示的标题">
<meta name="directory-order" content="10">
<meta name="directory-hidden" content="true">
```

Markdown 文件会在构建时自动转换为同路径的 `.html` 页面：

```markdown
---
title: JavaScript 学习笔记
description: JavaScript 基础知识整理
order: 10
---

# JavaScript 学习笔记

正文支持表格、代码块、引用和常用 Markdown 语法。
```

## 本地生成

```bash
npm run generate
```

该命令会生成完整的 `_site/` 目录。使用浏览器打开 `_site/index.html` 即可预览。

## 构建检查

```bash
npm run build
npm run check
```

构建结果位于 `_site/`。推送到 `main` 后，GitHub Actions 会执行相同流程并部署到 GitHub Pages。

目录标题、说明、排除文件及置顶顺序可以在 `directory.config.json` 中调整。

完整配置方法请查看 [`DIRECTORY_CONFIG.md`](DIRECTORY_CONFIG.md)。

首次使用 Actions 部署时，在仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
