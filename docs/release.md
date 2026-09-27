# OmniAgent 发布指南（Release Guide）

本指南面向维护者，说明 OmniAgent 从 RC 候选版发布到 GitCode 仓库、并准备好向 npm 发布 workspace 包的完整流程。

> 仓库地址：<https://gitcode.com/badhope/omniagent>
> 本次目标版本：**0.1.7**（由 `0.1.7-rc.1` 晋升为稳定版）
> 根包为 `private: true`，不直接发布；真正发布的是 `packages/**` 与 `apps/cli` 下的 `@deepseek-ai/*` 包。

---

## 1. npm 发布命令与注意事项

在仓库根目录执行（**本指南只说明，不替你真正 publish**）：

```bash
pnpm install                       # 确保依赖与 lockfile 一致
pnpm run prepublishOnly            # 全量构建 + 冒烟（tsc → host → client → web）
pnpm -r publish --access public
```

### 1.1 workspace 协议（`workspace:*` / `workspace:~`）

- 仓库内部依赖统一使用 `workspace:*`、`workspace:~` 等协议声明（见 `apps/cli/package.json`、`packages/bundle/*`）。
- `pnpm -r publish` 在发布时会**自动**把 `workspace:*` 改写为具体的语义化版本号（例如 `0.1.7`），**无需手工替换**。
- 前提：被依赖的内部包**必须也在本次发布集合里**，且版本号一致；否则改写后会指向一个尚未发布的版本，npm 上安装失败。

### 1.2 版本同步

- 发布前，所有待发布的 `@deepseek-ai/*` 包的 `version` 必须**统一为本次发布版**（当前为 `0.1.7`）。
- 根 `package.json` 的 `version` 已晋升为 `0.1.7`（见第 3 节版本策略）。
- 可批量核对：

  ```bash
  # 列出所有仍停留在 rc 版本、需要一并晋升的包
  grep -rl '"version": "0.1.7-rc.1"' --include=package.json packages apps | grep -v node_modules
  ```

- 建议用 `pnpm -r version 0.1.7` 或维护脚本统一 bump，避免漏包。

### 1.3 access public

- 各公开包已在 `publishConfig.access` 声明 `"public"`（见 `apps/cli`、`packages/bundle/base` 等）。
- 即便如此，仍建议在命令行显式带上 `--access public`，确保 scoped 包（`@deepseek-ai/*`）以 public 方式发布，而非默认 restricted。
- 根包 `private: true` 会被 pnpm 自动跳过，不会误发布。

### 1.4 不做的事

- **不要** `npm publish` 根目录——根包是私有的。
- **不要**绕过 `pnpm -r publish` 直接进某个子目录 `npm publish`，会丢失 workspace 协议改写与版本一致性校验。
- 本仓库**不推送 GitCode、不真正执行 npm publish**，以上命令仅供维护者在确认后手动执行。

---

## 2. GitCode 仓库发布检查单

发布一个可读、可跑、可复现的仓库 Tag，至少满足：

- [x] **README.md / README.zh.md** 双语文档就位，顶部含产品截图区（见 `frontend-screens/`）。
- [x] **LICENSE** 齐备：MIT，版权行保留 `Copyright (c) 2026 DeepSeek`（合规要求，不擅改法律文本）。
- [x] **THIRD_PARTY_NOTICES.md** 齐备：第三方依赖许可证清单。
- [x] **CHANGELOG.md** 完整：按阶段记录功能演进与关键提交。
- [x] **docs/ 文档**就位：`architecture.md`（架构）、`plugin-dev.md`（插件开发）、`usage-guide.md`（用户手册）、`acceptance-report.md`（验收报告）。
- [x] **产品截图**：`frontend-screens/` 下代表性截图已归档，并在 README 中以相对路径引用。
- [x] **config/agnes-ai.patch.yml**：Agnes AI 示例 overlay 随仓库提供。
- [ ] GitCode 远端已对齐本地 Tag（`v0.1.7`），由维护者在发布时手动推送。

> 说明：本仓库为基于 DSH（DeepSeek Harness）体系的改造发布；已在 README / THIRD_PARTY_NOTICES 注明，法律文本（LICENSE）保持原样。

---

## 3. 版本策略

遵循[语义化版本](https://semver.org/lang/zh-CN/)：`MAJOR.MINOR.PATCH`。

- **MAJOR**：不兼容的 API / 配置 breaking change。
- **MINOR**：向下兼容的新功能（新插件、新工具、新面板）。
- **PATCH**：向下兼容的问题修复。

### RC → Stable 流程

```
0.1.7-rc.1  ──(验收通过、截图归档、文档齐备)──▶  0.1.7 (stable)
```

1. 开发期间使用预发布标签：`0.1.7-rc.1`、`0.1.7-rc.2` …，用于内部验收与冒烟。
2. 验收报告（`docs/acceptance-report.md`）全部项闭环后，把根 `package.json` 与所有待发布包的版本号去掉 `-rc.N`，晋升为 `0.1.7`。
3. 晋升后打 `v0.1.7` Tag；下一个开发周期从 `0.1.8-rc.1` 继续。

本次即由 `0.1.7-rc.1` 晋升为 **0.1.7 stable**：根版本号已更新，验收报告与截图归档均已完成。

---

## 4. 用户侧配置模型（Agnes Key）

OmniAgent 通过 OpenAI 兼容协议接入任意大模型端点。发布后，终端用户按以下任一方式配置模型：

### 4.1 环境变量（推荐）

```bash
export AGNES_API_KEY=sk-...
```

随后启动时挂上仓库自带的示例 overlay：

```bash
pnpm oa web --patch config/agnes-ai.patch.yml
# 或一次性提问：
pnpm oa --profile finance --patch config/agnes-ai.patch.yml "查一下贵州茅台行情"
```

`config/agnes-ai.patch.yml` 已声明：

- provider：`agnes-ai`，`api: openai-completions`
- baseURL：`https://api.agnes-ai.cn/v1`
- 读取的环境变量：`AGNES_API_KEY`
- 内置模型：`agnes-3.0-flash`（131072 上下文）、`agnes-2.5-pro`（131072 上下文）

### 4.2 长期写入 profile

把 `config/agnes-ai.patch.yml` 中的两段（`agent-default-model` 与 `llm-pi-ai` provider 声明）合并进自己 profile 的 `cordis.patch.yml`，即可免去每次 `--patch`。

### 4.3 Web 设置页图形化配置

启动 `pnpm oa web` 后，在顶部状态栏/设置页的「模型」区可：

- 切换 provider（Agnes AI / DeepSeek / 通义千问 / 智谱 GLM / Ollama 本地等）；
- 调节 `temperature`、`maxTokens`（localStorage 持久化）；
- 填入对应环境变量名的 key 即可。

> 任意 OpenAI 兼容端点（vLLM、本地模型网关等）都可照 `agnes-ai` 的例子替换 `baseURL` 与 `apiKeyEnv` 接入。

---

## 5. 常见发布问题

### 5.1 workspace 依赖未构建就发布

**现象**：用户安装后报 `Cannot find module '.../lib/index.js'` 或类型缺失。
**原因**：发布的是 `lib/` 产物（见各包 `files` 字段），但发布前没跑构建。
**解决**：发布前务必执行 `pnpm run prepublishOnly`（tsc → build:lib:host → build:lib:client → build:web），确保 `lib/` 与 web 前端产物已生成。

### 5.2 files 字段遗漏

**现象**：包里缺 `cordis.patch.yml`、`.d.ts` 类型声明或 web 静态资源，插件加载失败 / 无类型提示。
**核对**（以 `packages/bundle/base` 为例）：

```json
"files": ["lib/index.js", "cordis.patch.yml", "lib/types/**/*.d.ts"]
```

新增产物目录后，记得把对应 glob 补进 `files`，否则 `npm publish` 不会带上。

### 5.3 版本不同步

**现象**：`pnpm -r publish` 报 workspace 依赖指向未发布版本；或用户装上后版本错配。
**原因**：个别包仍停留在 `0.1.7-rc.1`，没跟齐到 `0.1.7`。
**解决**：发布前用第 1.2 节的 grep 命令排查残留 rc 版本，统一 bump 后再发布。

### 5.4 scoped 包被发布成 restricted

**现象**：`@deepseek-ai/*` 包私有可见，匿名用户无法安装。
**解决**：命令行加 `--access public`，并确认每个包的 `publishConfig.access` 为 `"public"`。

### 5.5 根包被误发布

**现象**：`npm publish` 报根包私有错误。
**说明**：根 `package.json` 为 `private: true`，设计上不发布；统一用 `pnpm -r publish`，根包会被自动跳过。

---

## 6. 发布就绪清单（Release Readiness Checklist）

> 本清单基于本次发布（0.1.7）的实际验证结果逐项勾选。

- [x] 构建链四步全绿（`tsc -b tsconfig.host.json` / `build:lib:host` / `build:lib:client` / `build:web`）。
- [x] `git status` 干净（提交前无未提交变更；本次变更提交后即干净）。
- [x] README 双语文档含截图（`README.md` / `README.zh.md` 顶部产品截图区）。
- [x] LICENSE / THIRD_PARTY_NOTICES 齐备（MIT，DeepSeek 版权行保留）。
- [x] CHANGELOG 完整（`CHANGELOG.md` 按阶段记录）。
- [x] 关键文档就位：`docs/architecture.md`（架构）、`docs/plugin-dev.md`（插件开发）、`docs/usage-guide.md`（用户手册）、`docs/acceptance-report.md`（验收报告）。
- [x] 关键包 files/exports 完整（`apps/cli`、`packages/bundle/*` 等均含 `files` 与 `exports`/`publishConfig`）。
- [x] 无未提交变更（本次改动按功能分 commit 后提交）。
- [x] version 已更新为发布版（根 `package.json`：`0.1.7-rc.1` → `0.1.7`）。
- [x] `repository` / `homepage` / `bugs` / `engines` / `license` 字段完整（指向 GitCode，node ≥22.19、pnpm ≥11，MIT）。

> 待维护者手动完成（本脚本/本指南不代劳）：同步 workspace 子包版本到 `0.1.7`、执行 `pnpm -r publish --access public`、推送 `v0.1.7` Tag 到 GitCode。
