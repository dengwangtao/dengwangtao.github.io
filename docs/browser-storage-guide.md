---
title: 浏览器本地存储快速指南
description: 对比 Cookie、localStorage、sessionStorage 和 IndexedDB 的适用场景。
order: 20
---

# 浏览器本地存储快速指南

前端应用经常需要在浏览器中保存少量状态、用户偏好或离线数据。常见方案包括 Cookie、`localStorage`、`sessionStorage` 和 IndexedDB。

## 方案对比

| 方案 | 生命周期 | 容量特点 | 常见用途 |
| --- | --- | --- | --- |
| Cookie | 可以设置过期时间 | 容量较小，会随请求发送 | 登录状态、服务端会话标识 |
| localStorage | 手动删除前长期保留 | 适合少量字符串数据 | 主题、语言、用户偏好 |
| sessionStorage | 当前标签页关闭后清除 | 适合临时字符串数据 | 表单草稿、单次访问状态 |
| IndexedDB | 手动删除前长期保留 | 支持大量结构化数据 | 离线应用、缓存和复杂数据 |

## localStorage 示例

```js
const settings = {
  theme: "dark",
  language: "zh-CN"
};

localStorage.setItem("settings", JSON.stringify(settings));

const savedSettings = JSON.parse(
  localStorage.getItem("settings") ?? "{}"
);
```

`localStorage` 只能直接保存字符串，因此对象和数组通常需要通过 `JSON.stringify()` 转换，读取时再使用 `JSON.parse()` 恢复。

## sessionStorage 示例

```js
sessionStorage.setItem("draft", "尚未提交的内容");

const draft = sessionStorage.getItem("draft");
```

同一网站的不同标签页拥有各自的 `sessionStorage`，适合保存只在当前页面会话中有效的数据。

## IndexedDB 的适用场景

当数据量较大、需要建立索引或存储结构化对象时，可以考虑 IndexedDB：

- 离线保存文章或文档；
- 缓存接口返回的数据；
- 保存图片、文件等二进制内容；
- 构建支持离线访问的 Web 应用。

## 安全建议

> 不要在浏览器本地存储中保存密码、私钥或其他高敏感信息。

还需要注意：

1. 页面中的 JavaScript 通常可以读取 `localStorage` 和 `sessionStorage`；
2. 应避免将敏感令牌长期保存在可被脚本访问的位置；
3. 写入数据前应考虑容量限制和异常处理；
4. 用户清理浏览器数据后，本地内容可能丢失。

## 选择建议

- 需要随 HTTP 请求发送的小型数据：使用 Cookie；
- 需要长期保存简单偏好：使用 `localStorage`；
- 只在当前标签页临时保存：使用 `sessionStorage`；
- 需要大量、复杂或离线数据：使用 IndexedDB。
