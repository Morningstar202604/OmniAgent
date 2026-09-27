# 内嵌代码编辑器方案评估与轻量实现

> 日期：2026-09-27
> 范围：客户端代码块渲染（`packages/client/ui-primitives`）
> 结论：**采用方案 C（轻量只读增强），已落地；Monaco / CodeMirror 列入路线图，本期不引入。**

---

## 1. 背景与现状

客户端代码块由 `packages/client/ui-primitives/src/markdown/CodeBlock.tsx` 渲染：

- 高亮：shiki（按需懒加载语法 grammar，流式增量高亮）。
- 工具栏：`CodeToolbar.tsx`，已有 **语言标签**、**自动换行切换**、**复制** 三个控件。
- 行号：`lineNumbers` prop 可选开启（基于 CSS counter，不进入复制文本），文件预览等场景已使用。
- 无内嵌编辑器：代码块为只读展示，不可就地编辑。

生产路径全部走 `toolbarLabels`（卡片式工具栏）；`CodeBlock` 在无 `toolbarLabels` 时退化为简版 banner。

---

## 2. 三方案对比

| 维度 | 方案 A：Monaco Editor（VS Code 内核） | 方案 B：CodeMirror 6 | 方案 C：轻量只读增强（本期） |
|---|---|---|---|
| 新增依赖体积 | ~2 MB（核心 + worker，gzip 后仍 ~500 KB+） | ~300 KB（按需 language 包，gzip ~100 KB 起） | **0 KB 新增**（复用现有 shiki 与图标） |
| 功能 | 语法高亮、智能补全、多光标、定义跳转、minimap、diff | 语法高亮、可扩展 extension、轻量编辑 | 只读高亮 + 复制 + 新标签打开 + 语言标签 + 行号 |
| 加载性能 | 需独立 worker、异步加载首屏明显变慢 | 需异步注入、按需加载 grammar | 随首包，无额外请求 |
| 与现有流式高亮的关系 | 需替换/重写 shiki 流式渲染，改造面大 | 需替换 shiki，重写流式 token 化 | 完全复用，零冲突 |
| 维护成本 | 高（worker、主题同步、体积治理） | 中（扩展生态、版本升级） | 极低（约 60 行新增，无依赖） |
| client bundle purity | 需跨包引入 worker，易触达纯度约束 | 中 | 纯前端 value，无跨插件 value import |
| 适用场景 | 真正的 IDE 级编辑体验 | 需要就地编辑但要轻量 | 阅读/复制/外看为主 |

> 体积量级为业界通用经验值（Moncore/CodeMirror 官方 bundle）。本仓库实际约束更严：客户端包要求 bundle purity、禁止跨插件 value import，且首屏已加载 shiki 多语言 grammar。

### 取舍结论

- **方案 A 不推荐**：~2 MB 体积与 worker 模型与本项目"轻量聊天前端"定位冲突，收益（就地编辑）在聊天代码块场景下低频。
- **方案 B 备选**：若未来确需"就地编辑代码片段并回传"，CodeMirror 6 是更合理的编辑器内核（体积可控、可按需加载）。
- **方案 C 推荐并落地**：聊天场景 95% 诉求是**看清、复制、外看**，只读增强已覆盖，零依赖、零风险。

---

## 3. 本期已实施（方案 C）

### 3.1 代码块操作增强

在 `CodeToolbar` 工具栏、**复制按钮左侧**新增"新标签打开"按钮：

- 图标：复用现有 `IconRightUpOutlineRegular`（对角箭头，即标准"外链/新窗口"语义）。
- 行为（`CodeBlock.tsx` `onOpenInNewTab`）：
  - 将当前代码序列化为一个**自包含只读 HTML 文档**（深色背景、等宽字体、`white-space: pre`）。
  - 所有动态内容经 `& < >` 转义后再注入文档，杜绝 XSS。
  - 通过 `Blob URL` + `window.open(..., '_blank', 'noopener')` 打开；1 秒后 `URL.revokeObjectURL` 回收。
  - **不引入任何新依赖**，不发起网络请求。
- 文案：新增 locale 键 `codeBlock.openInNewTab`（中："新标签打开" / 英："Open in new tab"），经 `CodeToolbarLabels.openInNewTabLabel` 透传；缺省即隐藏按钮，向后兼容。

### 3.2 语言标签 / 行号确认

- **语言标签**：`CodeToolbar` 左侧已显示 `lang`（受支持语法）或回退到 `codeLabel`（"代码块"）。本期确认工作正常。
- **行号**：`lineNumbers` prop 已实现（CSS counter，不污染复制文本），文件预览 `CodeBody` 已开启。本期未改动，确认可用。
- **复制**：保留原有复制逻辑，未改动。

### 3.3 改动清单（12 文件，+60 / -12，无新依赖）

| 文件 | 改动 |
|---|---|
| `ui-primitives/src/CodeToolbar.tsx` | 新增 `openInNewTabLabel` 标签与 `onOpenInNewTab` 按钮（含 Tooltip） |
| `ui-primitives/src/markdown/CodeBlock.tsx` | 新增 `onOpenInNewTab`（Blob URL + 转义 HTML 只读视图）并接入工具栏 |
| `locale/src/locales/{zh,en}.ts` | 新增 `codeBlock.openInNewTab` 文案 |
| `ui-chat/.../markdown-labels.ts` | 透传新文案 |
| `ui-tool/.../primitive-labels.ts` | 透传新文案 |
| `ui-agent-preset/.../PresetGuideDialog.tsx` | 两处内联 toolbarLabels 透传 |
| `ui-plan/.../PlanPreview.tsx` | 透传 |
| `ui-sidebar-documentpreview/.../{code/CodeBody,markdown/MarkdownBody}.tsx` | 透传 |
| `ui-user-questions/.../QuestionComposer.tsx` | 透传 |
| `ui-cordis/.../CordisDefineRow.tsx` | 透传 |

---

## 4. 验证记录

构建链全绿：

1. `tsc -b tsconfig.client.json` 通过；
2. `pnpm run build:lib:client` 通过；
3. `pnpm run build:web` 通过（主包 index ~596 KB / gzip ~200 KB，无新增 chunk）。

浏览器实测（web profile，历史会话 `headless 用 Python 打印 hello world`）：

- 代码块工具栏出现第三个图标（换行 / **新标签打开 ↗** / 复制）；
- 悬停显示 tooltip「新标签打开」；
- 点击后新开 `blob:` 标签页，深色只读视图正确渲染代码；
- 语言/回退标签（"代码块"）显示正常；复制按钮行为不变。

截图归档：`frontend-screens/01-代码块工具栏-三按钮.png`、`02-新标签打开按钮-tooltip.png`、`03-blob新标签-只读代码视图.png`。

---

## 5. 路线图（重型方案，后续按需）

| 阶段 | 方案 | 触发条件 | 要点 |
|---|---|---|---|
| P1（已完成） | 方案 C 轻量只读增强 | 本期 | 新标签打开 / 语言标签 / 行号 / 复制 |
| P2 | 方案 B：CodeMirror 6 只读增强或轻编辑 | 用户明确要求"就地编辑代码片段"或"在聊天内改代码后应用" | 按需异步加载 language 包；保留 shiki 流式高亮作为回退；隔离在独立懒加载 chunk，不进首包 |
| P3 | 方案 A：Monaco 编辑器 | 出现 IDE 级诉求（多文件、智能补全、diff、定义跳转），例如内置文件编辑器/调试器 | 独立 worker、按需加载；与文件预览面板合并，不放进聊天消息流 |

**原则**：聊天消息流内的代码块保持只读轻量；真正的编辑诉求收敛到文件预览/侧边栏等独立面板，避免把 ~2 MB 编辑器塞进每条消息。
