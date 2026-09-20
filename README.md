# dengwangtao.github.io

个人 GitHub Pages 站点。首页目录由脚本自动扫描仓库内的 HTML 文件生成，并通过 GitHub Actions 部署。

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

## 本地生成

```bash
npm run generate
```

该命令会更新根目录的 `index.html`，便于直接预览。

## 构建检查

```bash
npm run build
npm run check
```

构建结果位于 `_site/`。推送到 `main` 后，GitHub Actions 会执行相同流程并部署到 GitHub Pages。

目录标题、说明、排除文件及置顶顺序可以在 `directory.config.json` 中调整。

首次使用 Actions 部署时，在仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。
