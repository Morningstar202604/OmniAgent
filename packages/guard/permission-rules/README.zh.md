# permission-rules（细粒度工具权限规则）

在现有沙箱 + 审批（user-approval）体系之上，提供**工具级**细粒度权限控制，
对标 Claude Code 的四档权限 + 通配符 allow/deny 规则。

## 四档权限

| 等级 | 含义 | 对工具调用的影响 |
|---|---|---|
| `allow` | 允许 | 放行（next()），交由下游策略继续 |
| `auto` | 自动允许、无需确认 | 同 allow，仅语义/日志上区分"自动放行" |
| `ask` | 调用前询问 | 返回 `ask`，走现有 user-approval 审批弹窗 |
| `deny` | 拒绝 | 直接 `deny`，附中文原因 |

## 规则匹配

- 按工具名做 `*` 通配符匹配，如 `shell.*`、`finance_*`、`file.write`、`*`。
- **优先级**：`deny > ask > allow > auto`；同档时**更具体**（非通配符字符更多）的规则胜出。
- 未命中任何规则走 `fallback`（默认 `allow`，放行）。

## 内置预设

| 预设 | 规则 | 说明 |
|---|---|---|
| `normal`（默认） | 无 | 不改变现有行为，沿用底层沙箱 + 审批 |
| `full-auto` | `* → auto` | 全部自动允许 |
| `strict` | `* → ask` | 全部调用前询问 |
| `custom` | 用户自定义 | 用 `permission_set` 设置的规则 |

## 配置

```yaml
- id: permission-rules
  name: '@deepseek-ai/dsh-permission-rules'
  config:
    preset: normal        # normal / full-auto / strict / custom
    fallback: allow
    rules:
      - { pattern: 'shell.*', level: ask }
      - { pattern: 'finance_*', level: auto }
      - { pattern: 'file.write', level: ask }
      - { pattern: 'file.read', level: auto }
```

环境变量 `DSH_PERMISSION_PRESET` 可覆盖启动预设。

## 模型可见工具

- `permission_presets`：列出全部预设与当前预设。
- `permission_get(tool_name?)`：查看当前规则，可选查询某工具的生效等级。
- `permission_set(preset?, rules?)`：运行时切换预设或设置自定义规则。

## 决策审计

每次工具调用记录一条决策（工具名、命中模式、等级、结果），内存环形缓冲保留最近 100 条。

## 后续路线

- 规则持久化到 profile（当前运行时规则为会话内生效，配置为持久来源）。
- 审批弹窗中"始终允许此类"一键写入规则。
