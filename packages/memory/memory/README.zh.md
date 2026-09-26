# memory（长期记忆 / 知识库）

跨会话长期记忆与知识库宿主插件，对标 Claude Memory / Kimi 知识库的最小可用版。
让 agent 能记住用户偏好、项目知识、历史决策，并在新会话中自动注入系统提示词。

## 存储

- 基于 `node:sqlite`（DatabaseSync，同步 API）持久化，不引入重型数据库。
- 默认数据库路径 `~/.omniagent/memory.db`，可用配置 `path` 或环境变量 `DSH_MEMORY_DB_PATH` 覆盖。
- 表：
  - `memories`：id / content / tags(JSON) / source / importance(0~1) / access_count / created_at / updated_at
  - `knowledge`：导入文档的分块（source / chunk_index / content）。

## 模型可见工具

| 工具 | 作用 |
|---|---|
| `memory_add` | 添加一条记忆（content/tags/importance/source） |
| `memory_search` | 关键词（LIKE）+ 标签搜索记忆 |
| `memory_update` | 更新记忆内容/标签/重要性 |
| `memory_delete` | 删除记忆 |
| `memory_list` | 列出记忆（按重要度/新近） |
| `knowledge_import` | 导入本地 txt/md（按段落切分入库） |
| `knowledge_search` | 关键词检索知识库分块 |

## 系统提示词注入

- 通过 `systemPrompt.section` 注册一个同步 provider，每次拼装系统提示词时
  注入"最重要 + 最近使用"的若干条记忆。
- 受 token 预算约束：`injectMaxEntries`（默认 6 条）、`injectMaxChars`（默认 1500 字符），
  避免系统提示词过长。

## 配置

```yaml
- id: memory
  name: '@deepseek-ai/dsh-memory'
  config:
    injectMaxEntries: 6
    injectMaxChars: 1500
    # path: /abs/path/to/memory.db   # 可选；默认 ~/.omniagent/memory.db
```

## 设计取舍与后续路线（不做静默降级）

- 当前检索为关键词 LIKE 匹配 + 重要度/新近排序；
  **语义/向量召回（embedding + 向量索引）列为后续路线**，本版不引入向量数据库。
- 注入发生在同步 system-prompt provider，拿不到当前用户消息，
  因此注入的是全局重要记忆；**按当前轮次语义召回**待后续接入。
- 每次对话结束后自动提取关键信息（auto-extract）列为后续路线。
