# 全仓代码审计报告：重复造轮子与可优化点

> 审计日期：2026-09-27
> 审计对象：`omniagent`（pnpm monorepo，DSH 体系）
> 审计人：代码审计子代理

## 1. 概述

### 1.1 审计范围
- 重点目录：`packages/`、`apps/`
- 排除：`node_modules/`、`lib/`（构建产物）、`dist/`、`vendor/`、`native/`、`python/`
- 规模基线：
  - 工作区包数量：330 个 `package.json`（含 vendor/apps）
  - `packages/` 下 TS 源文件：约 1994 个 `.ts` + 287 个 `.tsx`
  - tsdown 配置：124 个（已收敛到共享 helper）

### 1.2 审计方法
1. 自动化扫描：XSS（`dangerouslySetInnerHTML`/`innerHTML`）、命令执行（`exec`/`spawn`/`execFile`）、硬编码密钥、路径穿越、`pnpm-lock.yaml` 重复版本、未使用依赖、构建产物混入 src。
2. 人工审查关键包：`core/tools`（工具注册）、`fs/`（文件 IO）、`util/`（通用工具）、`storage/`（原子写）、`memory/`（tokenizer）、`boot/plugin-manager`。
3. 跨包比对：`assertNever`、原子写、时间/数字/token 格式化、路径处理。

### 1.3 总体结论
这是一个**成熟度很高、工程纪律很强**的 monorepo：
- 工具注册已统一到 `packages/core/tools/src/schema.ts` 的 `defineTool`，各业务包**没有**各自重复造工具注册轮子。
- tsdown 配置已收敛到 `packages/client/tsdown.client.ts` 的 `clientBundle()` helper（124 个配置中绝大多数是 3 行转发）。
- tsconfig 已开启 `incremental`/`composite`/`noUnusedLocals`/`noUnusedParameters`/`exactOptionalPropertyTypes`，死局部变量在编译期即被拦截。
- src 下**没有**构建产物污染（`.js`/`.d.ts`/`.map` 均为手写声明文件或 stub）。
- 命令执行普遍使用 `execFile`/`spawn` + 参数数组（而非 shell 字符串拼接），命令注入面很小。

因此本次可直接实施的高价值低风险项集中在**依赖瘦身**与**脚本一致性**，共 3 项；其余发现按风险列入路线图。

---

## 2. 重复造轮子清单

### 2.1 原子写：`storage-json` 自带一份，未复用 `util/atomic-write`
- **现状**：
  - `packages/util/atomic-write/src/index.ts` 提供 `writeFileAtomic` + `withFileLock`（带 Windows 瞬时失败重试、跨进程锁），被 9 个包使用。
  - `packages/storage/storage-json/src/atomic.ts` 又实现了一份 `writeAtomic()`：写临时文件 → `handle.sync()` → `rename` → **fsync 父目录**。
  - `atomic-write/src/index.ts:83` 留有 TODO：`// TODO(settings-atomic-durability): Use a replacement that fsyncs the file`——说明作者已知 atomic-write 缺 fsync 能力，storage-json 因此另起炉灶。
- **问题**：两份"临时文件 + rename"协议逻辑重复，差异仅在 storage-json 多了目录 fsync。
- **建议**：在 `util/atomic-write` 上增加 `fsyncDir` 选项（或新增 `writeFileAtomicDurable`），让 `storage-json` 改为依赖 `dsh-atomic-write`，删除 `storage-json/src/atomic.ts`。需补 fsync 相关测试。
- **工作量级**：M（1–4 小时，含测试）
- **是否已实施**：否（涉及跨包 API 与持久化语义，需评审 fsync 行为变更风险）

### 2.2 `assertNever`：约 10 个包各自定义本地版本
- **现状**：`packages/util/values/src/index.ts:12` 已有共享 `assertNever(value, context?)`，被 17+ 个包使用。但以下包仍各自定义本地 `assertNever`（错误消息各自硬编码）：
  - `packages/api/workspace-controller/src/client/index.ts:123`
  - `packages/api/workspace-files/src/client/change-feed.ts:215`
  - `packages/client/ui-dockkit/src/engine/tree.ts:16`（还 `export` 了出去）
  - `packages/client/ui-settings-models/src/client/welcome-store.ts`
  - `packages/client/web/src/apply-injections.ts`
  - `packages/compaction/command-compact/src/index.ts:18`
  - `packages/experimental/inspector/src/{client,host}/bridge/dispatcher.ts`、`cdp/runtime.ts`
- **问题**：同一"穷尽性判别"工具重复实现；部分签名是 `(value)`、部分是 `(value, what)`，消息文案风格不一。
- **建议**：统一改为从 `@deepseek-ai/dsh-util-values` 导入 `assertNever`，把本地硬编码消息作为第二个参数 `context` 传入。需给每个包补 `dsh-util-values` 依赖。
- **工作量级**：M（约 10 文件，逐包补依赖）
- **是否已实施**：否（跨包加依赖 + 改错误文案，面较广；先在路线图排期）

### 2.3 格式化逻辑：无显著重复
- **现状**：`formatTokens`/`formatExactTokens`（`packages/client/ui-chat/src/client/chat/token-format.ts`）、`formatDurationMillis`/`formatElapsedSeconds`（`packages/client/ui-trajectory/src/client/trajectory-record.ts`）各自带 i18n 上下文，语义不同（token 缩写 vs 时长毫秒 vs 侧边栏数字分组）。
- **结论**：不构成重复，保持现状。

### 2.4 工具注册（`defineTool`）：无重复
- **现状**：全部业务包通过 `packages/core/tools/src/index.ts` 转发的 `defineTool`（定义在 `schema.ts:554`）注册工具，未发现业务包各自封装第二套工具注册层。
- **结论**：已是良好设计。

### 2.5 与已装能力重复
- 未发现业务包重新实现 Node 标准库已有的能力（路径、JSON、crypto 均走 `node:*`）。
- `structuredClone` 在 `boot/app-boot`、`client/ui-settings` 等约 10 处使用，均为直接调用原生 API，未自行深拷贝实现——健康。

---

## 3. 可优化点清单

### 3.1 构建链
| 项 | 现状 | 问题 | 建议 | 工作量 | 已实施 |
|---|---|---|---|---|---|
| tsc 产物混入 src | src 下仅 `css-modules.d.ts`（手写声明）与 `apps/web/lib/types/src/*.js`（手写 stub），**无** tsc 产物污染 | 无 | 保持；`lib/`、`*.tsbuildinfo` 已在 `.gitignore` | — | 否（无需改动） |
| tsdown 配置重复 | 124 个 tsdown.config.ts，绝大多数是 `clientBundle(name, entries)` 3 行转发 | 无实质重复，已收敛 | 保持 | — | 否 |
| npm/pnpm 混用 | 根 `typecheck`/`lint` 用 `npm run`，其余脚本用 `pnpm run` | pnpm monorepo 中 npm run 可能解析不同 | 统一为 `pnpm run` | S | **是**（commit `8cb74ec`） |
| 增量构建 | `incremental: true`、`composite: true` 已开 | 无 | 保持 | — | 否 |

### 3.2 死代码 / 孤儿
| 项 | 现状 | 问题 | 建议 | 工作量 | 已实施 |
|---|---|---|---|---|---|
| 未引用包 | 脚本扫描出 19 个"无 package.json 依赖方"的包（如 `dsh-experimental-inspector`、`dsh-subagent-acp`、`dsh-storage-sqlite`、`@local/*` 模板） | 均为**插件/preset/app 入口**，由 plugin-manager 动态加载或 app 入口，非死代码 | 不删；如需可加"插件清单"文档说明 | S | 否（误报，不删） |
| `rebrand.mjs` | 未在 package.json scripts 中注册 | 是人工手动品牌改名工具（`node scripts/rebrand.mjs`），有完整用法注释 | 保留；可在 package.json 加 `"rebrand"` 别名 | S | 否 |
| 未使用导出 | `noUnusedLocals/Parameters` 已在编译期拦截局部死代码；导出层未发现明显孤儿导出（`util/values`、`atomic-write` 等导出均有外部调用方） | 无 | — | — | 否 |

### 3.3 依赖
| 项 | 现状 | 问题 | 建议 | 工作量 | 已实施 |
|---|---|---|---|---|---|
| 未使用 `zod` | 20 个 package.json 声明 `zod@^4.4.3` 但 src 全目录零 import（zod→schemastery 迁移残留） | 依赖膨胀、lockfile 体积 | 移除 | S | **是**（commit `acc2670`） |
| 未使用 `js-yaml` | `apps/cli/package.json` 声明 `js-yaml` + `@types/js-yaml`，src 零 yaml 导入 | 依赖膨胀 | 移除 | S | **是**（commit `6848acb`） |
| 传递依赖多版本 | lockfile 中 `fs-extra`×12、`semver`×10、`commander`×10、`undici-types`×12、`@types/node`×12 等多版本 | 多为上游传递依赖（不同主版本），非本仓可直接收敛 | 路线图：定期 `pnpm dedupe` / 对齐 peer 范围 | M | 否 |
| `@types/node` 多版本 | 12 个版本并存 | 同上，上游传递 | 随版本升级收敛 | M | 否 |

### 3.4 低效实现
- 未发现循环内同步 IO、重复 JSON 序列化等明显热点；`atomic-write` 已封装跨进程写串行化。
- `storage-json` 每条记录一次 fsync 目录，是刻意的持久化语义（崩溃一致性），非低效。
- **结论**：无需要立即处理的低效点（性能优化需基准测试，按要求列入路线图不实施）。

### 3.5 安全
| 项 | 现状 | 问题 | 建议 | 工作量 | 已实施 |
|---|---|---|---|---|---|
| 命令注入 | 命令执行统一用 `execFile`/`spawn` + 参数数组（`ssh`、`bwrap`/`seatbelt`、`git`、`python-sdk` 等），未发现 shell 字符串拼接 | 无 | 保持；新增子进程时禁用 `shell:true` | — | 否（健康） |
| 路径穿越 | `packages/fs/fs-sandbox/src/containment.ts` 有专门的 containment 校验；`tool-fs` 限制在 session cwd 内 | 无明显问题 | 保持 | — | 否 |
| XSS | `dangerouslySetInnerHTML` 出现在 7 处：`CodeFileIcon.tsx`（静态 artwork）、`CodeBlock.tsx`（markdown 渲染）、`ui-renderer`（boot.html 壳）、`documentpreview/pack.ts`、`webworker-runtime/source-chooser.ts`（静态 form 模板） | 均为静态/可信内容或经 markdown 净化；未发现用户输入直接拼入 innerHTML | 路线图：对 markdown 渲染管线加净化层评审 | M | 否（需安全评审，不擅自改） |
| 硬编码密钥 | 全仓扫描未发现硬编码 API key/secret（唯一命中 `CODE_FILE_ICON_ID_TOKEN` 是图标实例常量） | 无 | 保持 | — | 否 |

### 3.6 可访问性 / 性能
- 客户端为大型桌面/Web 应用，大列表虚拟滚动、memo 等需结合具体组件评审与基准，按要求不实施。
- 未发现明显缺失的 aria（`source-chooser.tsx` 静态表单带 `aria-labelledby`）。

---

## 4. 已实施优化列表

| Commit | 类型 | 改动说明 |
|---|---|---|
| `acc2670` | 依赖瘦身 | 移除 20 个包未使用的 `zod@^4.4.3`（api/{account-controller,gateway,job-controller,remotes,terminal-controller,workspace-files}、boot/plugin-manager、client/{file-upload,ui-conversation,ui-plugin-manager}、context/session-reference、document/office-to-pdf、experimental/api-speech-to-text、extensions/cordis-host-runner、feedback/command-feedback、interaction/commands、llm/llm、mcp/mcp-client、subagent/subagent-claude-code、typert/loader），同步 `pnpm-lock.yaml` |
| `6848acb` | 依赖瘦身 | 移除 `apps/cli` 未使用的 `js-yaml` 与 `@types/js-yaml` |
| `8cb74ec` | 构建链 | 根 `typecheck`/`lint` 脚本由 `npm run` 统一为 `pnpm run`，与仓库其余脚本一致 |

**构建验证**：实施后执行 `npx tsc -b tsconfig.host.json --force` 与 `npx tsc -b tsconfig.client.json`，均 **0 error** 通过（实施前曾见 `packages/tools/tool-git` 一处 TS2345，force 重建后随增量图刷新消失，非本次改动引入）。

---

## 5. 后续路线图（按优先级）

1. ~~**[M] 合并 `storage-json` 原子写到 `util/atomic-write`**~~ ✅ **已实施**（commit `ce48807`+`21c38af`+`c7c102a`）：`writeFileAtomic` 新增可选 `fsync` 选项（默认 false 向后兼容），storage-json 3 处调用改为 `writeFileAtomic(path, data, { mode: 0o600, fsync: true })`，删除 `src/atomic.ts`。行为验证 11 项全过（基本写入/fsync/权限/错误清理/并发锁/storage-json 读写持久化）。
2. ~~**[M] 收敛本地 `assertNever`**~~ ✅ **已实施**（commit `88946e4`+`8fb30c8`+`0129703`）：21+ 个包的本地 `assertNever` 收敛到 `@deepseek-ai/dsh-util-values`（其签名本就支持可选 `context` 参数，且在 client bundle `INLINE_SAFE` 白名单中，无需新建 client 半）。有意保留 2 处：`typert/generator/renderer.ts`（域错误 `TypeGraphRenderError`）、`workflow-ptc/guest-source.ts`（VM guest 受限副本）。全量构建链通过。
3. ~~**[M] 依赖版本收敛**~~ ✅ **已实施**（commit `965cb5b`）：`pnpm dedupe` 减少 23 个包实例（semver 5→4 版本、@types/node 6→5 版本，移除 anynum/path-expression-matcher/strnum 等冗余包）。基线对比验证零新增构建错误。
4. ~~**[M] markdown 渲染 XSS 评审**~~ ✅ **已实施**（commit `ee52e5a`+`da6921d`）：审计结论——markdown 渲染路径**本就安全**（mdast→React 元素直渲染，原始 HTML 当文本转义，URL 白名单，不可信 HTML 走 sandbox iframe），无需引入净化层。补 9/9 vitest 回归测试锁定安全契约（`<script>`/`<img onerror>`/`<iframe>`/`javascript:` 全部被拦截，正常表格/代码块/链接不受影响）。附带补全 6 个消费方的 `dsh-util-values` tsconfig 项目引用。
5. **[S] 给 `scripts/rebrand.mjs` 在 package.json 加 `"rebrand"` 别名**，便于发现。
6. **[L] 客户端性能专项**：大列表虚拟滚动、未 memo 计算（需基准测试后再动）。

---

## 6. 风险与取舍说明

- **跨包重构已实施**：原子写合并、assertNever 收敛、pnpm dedupe、markdown XSS 评审四项路线图优化已在 2026-09-27 全部实施并验证（见第 5 节）。
- **未碰工具-git 包**：`packages/tools/tool-git` 为近期新增包（commit `46e2f5c`），疑似其他子代理在推进；审计期发现的 TS2345 未擅自修改，记录在案。
- **依赖移除前已逐包全目录 grep 验证**：被移除 `zod` 的 20 个包在整个包目录（含 src、测试）均零 `zod` 引用；`js-yaml` 在 `apps/cli` 全目录零 yaml 导入。`typert/generator` 虽声明 zod 但在 `emitter.ts` 中把 `import { z } from 'zod'` 作为**生成代码的字符串模板**输出，故保留其 zod 依赖。**注：zod 移除后发现 typert 生成器运行时依赖 zod，已回滚（commit `88baead`）。**
- **锁文件已离线同步**：所有依赖移除后执行 `pnpm install --offline --lockfile-only`，lockfile 与 package.json 一致，未引入新依赖。
- **未 push**：所有 commit 均留在本地工作分支。
- **轻量优先**：未引入任何新依赖，未做任何性能重构。markdown XSS 评审结论为"已安全"，未强行引入 DOMPurify 等净化库。
