# 插件开发指南（Plugin Development）

本指南说明如何为 OmniAgent 编写一个领域插件。两个随包范例可直接参照：

- host 半边：`packages/finance/finance-agent/`、`packages/ecommerce/ecommerce-agent/`
- profile 组合包：`packages/bundle/finance/`、`packages/bundle/ecommerce/`

## 一个领域插件 = 两部分

```
packages/<domain>/<domain>-agent/        # ① host 半边：Cordis 插件
  src/source.ts                          #    数据契约 + 数据源（mock / http 可切换）
  src/engine.ts                          #    纯逻辑（确定性、可复核的规则/计算）
  src/tools.ts                           #    defineTool 注册模型可调用的工具
  src/index.ts                           #    Cordis 入口：inject + 人设注入 + 工具注册
  smoke.mjs                              #    source 与纯逻辑的冒烟测试
packages/bundle/<domain>/                # ② profile 组合包
  cordis.patch.yml                       #    插入插件行 + 默认模型路由（可选 client 半边）
  package.json                           #    声明 dsh.bundle.patch: ./cordis.patch.yml
```

## 约定

- **inject 必须显式声明**：插件访问 `ctx.tools`、`ctx.systemPrompt` 等服务时，`export const inject = [...]` 必须列出，否则运行时 import 失败。
- **工具只依赖数据契约**：工具函数签名面向 `source.ts` 定义的接口，不直接耦合具体数据源；mock 数据须带 `mock` 标记并向用户明示。
- **纯逻辑可复核**：计算/规则放在 `engine.ts`，保持确定性，便于冒烟测试与结果复核（如回测的交易明细、选股的筛选条件）。
- **可选 client 半边 UI**：若需要专业界面，再加一个 `@deepseek-ai/dsh-client-ui-<domain>` React 包，挂到 host 暴露的槽位上；不要在 host 包里 import React。

## 接入 profile

在 `cordis.patch.yml` 中插入插件行并声明配置：

```yaml
- insert:
    - id: <domain>-agent
      name: '@deepseek-ai/dsh-<domain>-agent'
      config:
        source: mock
```

然后把新 bundle 加入 `PROFILE_TEMPLATES`（CLI 一次性 profile）与 `OPTIONAL_BUNDLES`（Web 插件市场可选包），即可随安装发布。

## 安装与调试

```bash
# 本地路径安装到某个 profile
pnpm oa plugin --profile web add /path/to/<domain>-agent

# 打印组合后的配置树，确认 patch 层叠加结果
pnpm oa <profile> --dump-config
```

架构原理见 [`architecture.md`](architecture.md)。
