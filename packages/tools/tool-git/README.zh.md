# @deepseek-ai/dsh-tool-git

OmniAgent git 工具包：让 agent 在任务收尾时能主动、受控地完成本地 git 操作。

## 提供的工具

| 工具 | 说明 | 性质 |
| --- | --- | --- |
| `git_status` | 查看当前分支、已暂存 / 未暂存 / 未跟踪文件 | 只读 |
| `git_diff` | 查看未暂存差异；`staged=true` 查看已暂存差异（numstat + 截断 diff 正文） | 只读 |
| `git_add` | 暂存指定文件；`paths` 留空时等价 `git add -A` | 写 |
| `git_commit` | 提交已暂存内容（`message` 必填；`addAll=true` 先全量暂存） | 写 |

## 实现约束

- 直接用 `node:child_process.execFileSync` 调用系统 git，**不引入** simple-git / isomorphic-git 等第三方依赖。
- 工作目录固定为 `process.cwd()`（agent 工作区），不操作其他目录。
- **绝不自动 push**；commit 只写本地历史。
- `git_commit` 拒绝空 message；暂存区为空时明确报错。

## 权限分级（permission-rules 集成）

本包注册后自然进入 `tools/pre-execute` 决策链，**不做任何绕过**。工具名统一前缀 `git_`，可用通配符规则整组管控：

- `git_status` / `git_diff`：只读，默认 allow。
- `git_add` / `git_commit`：写操作，建议配置为 ask 或 deny。

示例（cordis.patch.yml 的 permission-rules 行）：

```yaml
- id: permission-rules
  name: '@deepseek-ai/dsh-permission-rules'
  config:
    preset: custom
    rules:
      - { pattern: 'git_*', level: 'allow' }   # 默认放行
      - { pattern: 'git_commit', level: 'ask' } # 提交需用户审批
      - { pattern: 'git_add', level: 'ask' }
```

运行时也可用 `permission_set` 动态调整。
