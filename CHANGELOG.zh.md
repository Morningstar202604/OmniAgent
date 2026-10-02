# OmniAgent 更新日志

OmniAgent 跟随上游 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 发布线；上游变更记录保留在仓库历史中。

## v0.2.0-omniagent.1 (2026-10-01)

首个品牌发布版，基于上游 DeepSeek Harness `0.2.0-rc.2`（`639ed01`）。

**品牌**
- 基于官方最新版（0.2.0-rc.2）物理重铺，完整兼容生态。
- 品牌重建：CLI（`oa`）、UI 文案（26 处 locale 字符串）、OmniAgent 几何 logo、品牌官网、官方全套 CI。
- 品牌化双语 README（构建链、跟进上游流程、扩展清单、自定义模型源）。

**扩展（第一方 14 包）**
- finance-agent / ecommerce-agent 领域智能体及对应 UI 工作台与组合包。
- memory（跨会话记忆，走官方注入链）、report-export、tool-git、tool-notify。
- ui-status-bar、ui-session-history、subagent agent-team（实验性）、plugin-template 模板包。
- 删除 4 个与上游重复的包（`tool-task`、`ui-command-palette`、`ui-plugin-market`、`permission-rules`）。

**模型源**
- 复用上游 `llm-pi-ai`；OpenAI 兼容 `u2-flash` 提供商的 profile patch 示例见 README。

**发布**
- 发布到 gitcode（`badhope/OmniAgent`）、gitee（`badhope/omniagent`）、GitHub（`Morningstar202604/OmniAgent`、`X33834/OmniAgent`）；保留上游远程以 `git merge` 跟进。

_未在此列出的事项以上游变更为准；上游自身的变更记录见上游仓库。_
