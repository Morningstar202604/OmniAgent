# Markdown 渲染净化层 — XSS 防护评估报告

> 结论：**markdown 渲染主路径在设计上已免疫 XSS，无需引入净化层（DOMPurify / 自研白名单均不需要）。**
> 本报告逐点给出评级与依据，并附带回归测试锁定既有安全契约。

## 1. 评估范围

- markdown 渲染主路径：`packages/client/ui-primitives/src/markdown/`
- 全仓 `dangerouslySetInnerHTML` / `innerHTML` / `insertAdjacentHTML` 使用点（见 §3）
- 数据来源属性：用户输入 / 模型（assistant）输出 / 工具返回 / 静态生成

## 2. markdown 主路径为何天然安全

### 2.1 解析器

`parse.ts` 使用 `mdast-util-from-markdown`（micromark 生态），仅挂载
`gfm()` 与 `math()` 扩展，**未挂载任何 rehype-raw / HTML 透传扩展**：

```ts
fromMarkdown(text, { extensions: [gfm(), cjkFriendlyStrong(), mathCompatibility(), math()],
                     mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()] })
```

### 2.2 原始 HTML 的处理（关键防线）

`render.tsx` 是「mdast → React 元素」的直渲染器，**全程不产生 HTML 字符串、不调用
`dangerouslySetInnerHTML`**。对解析出的 `html` 节点：

```ts
case 'html':
  // No HTML parser enters the pipeline: raw HTML stays literal text.
  return node.value
```

`node.value` 作为 React 子节点字符串返回，React 自动转义。因此 markdown 里写
`<script>alert(1)</script>` 只会被渲染成可见文本 `&lt;script&gt;…`，**从不进入 DOM、不执行**。

### 2.3 链接 / 图片 URL 协议白名单

- 链接：`sanitizeUrl()` 仅放行 `http:` / `https:` / `mailto:`，其余一律置空；
  再叠加 `micromark-util-sanitize-uri` 的 `normalizeUri()`。
- 图片：`remoteImageUrl()` 仅放行绝对 `http:` / `https:`；`data:` / `blob:` 只能由
  owner 可信回调 `pathImages.resolve()` 改写后二次校验协议。
- 外链统一 `target="_blank" rel="noopener noreferrer"`。

`MarkdownText` 组件文档字符串明确声明：「raw HTML and unsafe protocols are disabled」，
面向不可信的 assistant markdown 输出。

### 2.4 运行时实证（回归测试）

`tests/markdown-xss.client.spec.tsx` 通过 `react-dom/server`（Node 环境，无需 jsdom）
渲染 `MarkdownText`，9 条用例全部通过：

| 输入 | 预期行为 | 结果 |
|---|---|---|
| `<script>alert(1)</script>` | 转义为文本，无 `<script>` 元素 | ✅ |
| `<img src=x onerror=alert(1)>` | 转义为文本 `&lt;img…&gt;`，不挂载 `<img>` | ✅ |
| `[x](javascript:alert(1))` | 丢弃 href，不产生可点击锚点 | ✅ |
| `[x](JaVaScRiPt:alert(1))` | 大小写混淆同样被丢弃 | ✅ |
| `<iframe src="https://evil…">` | 转义为文本，无 `<iframe>` | ✅ |
| `![x](data:text/html,…)` | data: 图片被拒，不挂载 `<img>` | ✅ |
| `[ok](https://example.com)` | 正常渲染 `<a href>` | ✅ |
| `![alt](https://example.com/a.png)` | 正常渲染 `<img src alt>` | ✅ |
| GFM 表格 / 代码块 / 标题 | 渲染不受影响 | ✅ |

## 3. 全部 innerHTML / dangerouslySetInnerHTML 使用点评级

| # | 位置 | 数据来源 | 评级 | 依据 |
|---|---|---|---|---|
| 1 | `markdown/CodeBlock.tsx:184` | shiki 对代码块**源码**做语法高亮产出的 span 树 | 🟢 安全（可信生成器） | 输入是代码文本，shiki 自身转义；非用户 HTML 透传。注释亦说明。 |
| 2 | `CodeFileIcon.tsx:25` | 内置静态图标 artwork 常量表 | 🟢 安全（静态） | 包测试拒绝该表中的不安全标记；仅做 `useId` 替换。 |
| 3 | `markdown/katex.tsx` | KaTeX 对 TeX 产出的固定 span/MathML/SVG 词汇表 | 🟢 安全（可信生成器） | 用 `DOMParser` 解析后逐节点映射为 React 元素（文本被转义），非原始 HTML 注入。 |
| 4 | `ui-renderer/src/client/index.ts:67` | 服务端下发的 `index.html` 启动 loading DOM（`[data-dsh-boot]`） | 🟢 安全（框架静态） | 读取的是宿主页面自身的启动 markup，非用户/模型内容；用于 hydration 过渡。 |
| 5 | `web/src/apply-injections.ts:46` | host webserver 的结构化注入表 `IndexInjection` | 🟢 安全（应用受控） | 来源是宿主 webserver 生成的启动脚本/样式表清单，非 attacker 可控；由宿主进程而非不可信内容提供。 |
| 6 | `ui-sidebar-documentpreview/.../html/pack.ts:41` | 用户 HTML 文件字节 | 🟢 安全（脱模板解析） | 写入**已脱离文档的 `<template>`**，仅用于查询 `script[src]`/`link[href]` 打包静态资源；模板不渲染、不执行脚本。 |
| 7 | `ui-sidebar-documentpreview/.../html/HtmlBody.tsx:68/101` | 用户 HTML 文件 | 🟢 安全（沙箱隔离） | 通过 `<iframe sandbox="allow-scripts">`（交互）或 `<iframe sandbox="">`（静态）+ Blob/srcDoc 加载，与父应用同源隔离，无 DOM 访问。 |
| 8 | `experimental/webworker-runtime/.../source-chooser.ts:239` | 实验性预览数据源选择器 | 🟢 安全（实验工具+已转义） | 插值的 `label`/`description` 经 `escapeMarkup()`；`id` 来自内置 fixture 清单。 |

> 无 🔴 高风险点。所有面向不可信内容（模型输出 / 用户文件）的路径要么：
> 转成文本（markdown），要么沙箱 iframe（HTML 文档预览），要么走可信生成器（shiki/KaTeX）。

## 4. 为何不强行加净化层

- 主路径**根本不把 markdown 里的 HTML 交给 DOM**，白名单净化无的放矢；
- 唯一真正渲染「不可信 HTML」的场景（HTML 文档预览）已用 `sandbox` iframe 隔离，
  这是比字符串白名单净化更强的隔离边界；
- 引入 DOMPurify / 自研白名单会增加体积与维护面，且在本架构下不提升安全性。

## 5. 回归测试运行方式

```bash
npx vitest run --config packages/client/ui-primitives/vitest.config.ts
```

Node 环境（`environment: 'node'`），用 `react-dom/server` 静态渲染，**不依赖 jsdom**。
`vitest.config.ts` 仅用于本地/CI 跑该包单测，不进入 `build:lib:client` / `build:web` 产物。
