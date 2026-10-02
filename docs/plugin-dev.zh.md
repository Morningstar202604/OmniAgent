# 插件开发

[English](plugin-dev.md) | 中文

**OmniAgent** 保持上游 DSH 插件模型不变：一切皆插件，由 [Cordis](https://github.com/cordiverse/cordis) 在运行时组合。

## 新增包（插件）

遵循上游 cookbook——它是权威文档，且中英双语：

- [Adding a package](cookbook/adding-a-package.zh.md)（英文原版见该页语言切换器）

要点：

- 插件是通过 profile/bundle patch（`cordis.patch.yml`）挂载的包；见[配置目录](config-catalog.zh.md)与 OmniAgent 自带的[组合包模板](../../packages/bundle/plugin-template/README.zh.md)。
- 客户端 UI 包通过[能力接缝](capability-seams.zh.md)注册；[subsystems 参考](subsystems/README.zh.md) 文档化生成的 Cordis API。
- 用完整构建链测试与验证：`pnpm run build` 后 `pnpm oa web`。

## 第一方示例

OmniAgent 随附 14 个第一方扩展包作为参考实现（finance-agent、ecommerce-agent、ui-status-bar、ui-session-history、agent-team 等——见 [README](../README.zh.md#omniagent-extensions)）。

上游插件生态约定见 [dsh-plugin 话题](https://github.com/topics/dsh-plugin)。
