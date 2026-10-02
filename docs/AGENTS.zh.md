# AGENTS.md — 文档标准

本文件定义文档结构、Markdown 层级、写作规则与 `verify-doc-budgets` 上限。使用 [dsh-doc](../.agents/skills/dsh-doc/SKILL.md) 进行定位与校验，使用 [dsh-prose-standard](../.agents/skills/dsh-prose-standard/SKILL.md) 保证覆盖度与编辑判断；理由参见 [doc-tiers Agent Note](../.agents/notes/implemented/process/2026-07-04-doc-tiers-and-budgets.md)。

## 文档结构

以下规则适用于面向人的文档；[Agent Notes](../.agents/notes/README.md) 不在其范围内。[postmortem](postmortem/README.md)（事后复盘）是事故范围内的参考；时间线记录证据而非教学顺序。文档的主题与树位置决定其范围：以适当细节描述自身主题，仅按目的、职责与高层行为指引子文档；更低层细节链接到拥有它的后代文档。文档类型不会扩大该范围。参考文档只能对其自身主题做到详尽。测试机制、夹具与 harness 属于最低拥有层级；上层文档只做链接。

将范围内每份文档分类为教程（tutorial）或参考（reference）。教程按有序路径通向结果，且只引入每步所需内容。参考定义查找范围与当前行为，不含教学顺序。将实质性的教程与参考内容分开；任一部分较小时用小节标注。

写教程前，先在私下分类读者的起点知识，并把每个概念分为初级、中级、高级。先建立先决条件再引入依赖概念，难度逐步提升，不必要的高级内容移入后续教程或参考。

写作顺序：在树中定位文档；设定其允许的细节；选择教程或参考；教程按先决条件与难度排列概念；下放后代文档拥有的细节；将底层解释替换为指向其拥有者的链接。

## 层级分类：每个事实只有一个家

每个事实只有一个家：负责它的层级；其他位置链接到那里。

| 层级 | 职责 | 不属于这里 |
|---|---|---|
| 根 `AGENTS.md` | 常设命令：agent 每会话上下文所需的规则，每条一到三行，链接其所在处 | 故事、示例、情景流程、任何从链接处复述的内容 |
| 子树 `AGENTS.md`（`packages/`、`docs/`、`.agents/notes/`） | 该子树专属的命令 | 根文件已承载的仓库级规则 |
| [architecture.md](architecture.md) | 有序地图：构成、核心包、循环、接缝、扩展点；改 `packages/` 前必读 | 类型定义（→ 子系统）、包级细节（→ 包 README）、决策理由（→ Agent Notes）、实现状态标注 |
| [subsystems/](subsystems/README.md) | 每个子系统一页参考：类型定义、语义与生成的 Cordis API | 行为叙述（→ architecture.md） |
| [Agent Notes](../.agents/notes/README.md) | 活跃决策记录：为何、放弃了什么、需要哪些验证；`implemented/` 笔记以现在时描述已落地现实 | 迁移计划、验收任务清单、夹具讲解，以及决策落地后的规格腔（"should…"）；归档笔记是冻结历史，永远不是当前权威 |
| [postmortem/](postmortem/README.md) | 事故故事——唯一允许战争叙事风格的层级 | — |
| [Persistence history](persistence-changes/README.md) 与 [format references](persistence-changes/historical-formats/README.md) | 类型变更确认、版本对比与完整的历史格式 schema | 仅行为变更；当前运行时契约 |
| [cookbook/](cookbook/adding-a-package.md) | 带编号验证步骤的分步指南 | 设计理由（→ 每个指南链接的 Agent Note） |
| [user/](user/index.md) | 由文档网站发布的产品面向指南 | 生成的参考表、贡献者流程、决策历史 |
| 包 README | 包级契约：配置、语义、限制、扩展点与 [Model Experience](cookbook/adding-a-package.md#4-write-the-package-readme) | JSDoc 复述、生成目录复述（事件/工具表）、其他包的问题 |
| [development.md](development.md) | 贡献者环境搭建、日常流程与 CI 摘要；按 [i18n 契约](i18n/README.md) 成对双语 | 运行时/版本理由（→ Agent Notes）、随 `package.json` 脚本漂移的逐项清单 |
| 生成的参考：[subsystems/](subsystems/README.md) 中每页的 `cordis-surface` 区域、[Cordis 核心 API + 继承层级](cordis-api/context.md)、[tool-catalog](tool-catalog.md)、[config-catalog](config-catalog.md)、[persistence-catalog](persistence-catalog.md)、[module-graph.md](module-graph.md) | 从源码重新生成并做新鲜度门控的穷尽式英文源；中文对应版按 [pairing 流程](i18n/README.md#scope-and-exclusions) 评审 | 手工编辑生成的英文源或区域；中文对应版仅通过配对更新 |
| Skills（`.agents/skills/`） | 可复用工作流与专项决策标准 | 产品与运行时契约（→ docs 或源码） |

放置规则：bug → postmortems；理由 → Agent Notes；流程 → cookbooks；类型定义 → subsystems；包契约 → READMEs；常设命令 → 根 `AGENTS.md` 并附理由链接。

## 写作规则

- **记录当前状态。** 把历史留在 commit、PR、Agent Notes、postmortems 或限定范围的持久化记录中。其他散文命名的是机制，而非变更或堆叠位置。General Session 格式的散文链接[版本/状态权威](session-format-status.md)；版本特定的契约、示例或证据保留数字。
- **套用 Agent Note 创建标准。** 机械性/局部编辑豁免，包括局部 UI 变更；保持既有属主笔记准确（[范围](../.agents/notes/README.md#when-to-write-one)）。
- **每个段落占一行**（`verify-md-wrap`）：使用编辑器软换行。代码块、表格与列表结构保持其格式；代码注释保持在 linter 列限内。
- **围栏 `ts` 代码块必须可编译**（`doc-typecheck`）；粘贴的类型声明及其原始 JSDoc 使用 ` ```ts type-equiv `，剥离函数体的公共类声明使用 ` ```ts public-api `；两者都要登记进 manifest 以免漂移（[机制](development.md#documenting-types-verbatim-ts-type-equiv)）。
- **重塑文档化类型的同一变更须同步更新属主的 [subsystems 页面](subsystems/README.md)。** `verify-type-equiv` 只能捕获漂移的粘贴，无法捕获从未文档化的新类型；类型在其声明包组页面上文档化（[页面范围](../.agents/notes/implemented/process/2026-08-03-package-anchored-subsystem-pages.md)）。
- **双语配对同时更新**：[术语引导](i18n/terminology.md)、单遍活跃 agent 工作重新定位首用标注、保留未改散文并重新记录；`dsh-translate-docs` 保持用户主动调用（[契约](i18n/README.md)）。
- **注释与 JSDoc 陈述完整契约，而非推理记录。** 保留行为、失败、时序、归属、模态、异常、后果与非显而易见的取向；删除叙述、测试讲解、评审分析与代码复述。保留局部契约并链接其理由。详见 [dsh-prose-standard](../.agents/skills/dsh-prose-standard/SKILL.md)。
- **直接写作**：点名行动者与事实（[决策](../.agents/notes/implemented/process/2026-08-09-concrete-prose-names-actors-and-recorded-facts.md)）。`seam` 只用于定义过的能力。指名确切的检查、类型、API、操作或行为，而不是隐喻的 "gate"、"vocabulary" 或 "surface"。

## 字数预算

[scripts/doc-budgets.manifest.json](../scripts/doc-budgets.manifest.json) 设定常驻文档上限；`pnpm run verify-doc-budgets` 会拒绝超限或缺失的文件。

门禁变红时：

1. **迁移**属于其他层级的内容；必要时留一行链接。
2. **精简**属于此处但可以更短的内容。
3. **提高**上限仅当文字确实需要空间；在 PR 中说明 manifest 差异理由。过低的上限是预算 bug。

上限是护栏而非削减目标。在目标值或以下时保留至少 5% 余量；超限时冻结上限，直到迁移或精简使其回到目标以下。仅当文档仍有空间时才能降低上限。目标：根 `AGENTS.md` ≤ 1,960；`architecture.md` ≤ 2,400；子树 `AGENTS.md` ≤ 600，`packages/AGENTS.md` ≤ 750，本文件 ≤ 1,320；`packages/README.md` ≤ 994；另有 `cordis-primer.md` 600、`defensive-patterns.md` 550、`testing.md` 1,300、`examples/AGENTS.md` 310。无预算层级由评审把关。

## Slop 清单

在任何文档中排查以下内容；[dsh-doc](../.agents/skills/dsh-doc/SKILL.md) 会以此清单执行审计：

- 重复规则：搜索特征短语；只保留一个家，其余链接过去。
- 历史落在允许层级之外：陈述当前事实并链接历史属主。
- 散文或图表中的实现状态标注（"implemented!"、"future: …"）。状态会腐坏；仓库布局与包 manifest 才承载它。
- 当源码或生成器是权威时，手工复述的目录、JSDoc 或测试/包/状态清单。
- 推理记录：逐步实现叙述、显而易见分支的证明、测试讲解或被否决的局部替代方案。保留最终契约或持久理由；删除推导路径。
- 理由在相邻方法旁重复，而非在属主能力或辅助函数处一次说明。
- 段落墙：一个段落承载多条规则与括号离题。拆分或把细节降级到其所属处。
- 强调通胀：遍地加粗、大写或 "critically" 等于什么都没强调。只在改变行为的子句上保留强调。
- `implemented/` Agent Notes 中的规格腔："should"、迁移计划、验收清单。已实现的 Agent Note 按[已实现笔记说明](../.agents/notes/implemented/AGENTS.md)描述现状。

## 仓库引用

当前文件使用相对 Markdown 链接，历史引用使用 tag 或 PR 编号。`verify-md-links` 检查本地目标。[引用校验](../scripts/verify-repository-references.ts) 拒绝受维护文件中的真实 commit 标识与不允许的组织 URL。
