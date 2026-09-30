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

## 检索与召回

- 检索为 **BM25 + 向量 hybrid 融合**：`final = alpha*bm25 + (1-alpha)*vector`，`alpha` 默认 0.5。
- 向量路两档：
  - **默认本地 TF（离线零依赖）**：不发网络请求，复用词项表实时算稀疏余弦，开箱即用；
    只能召回「共享词项」的文档，对纯同义词/上位词改写会漏召。
  - **真稠密向量（配置 embedding API 后启用）**：把文本编码为稠密向量入库，
    可召回「与原文无共同词但语义相近」的记忆。未配置 key 或网络失败时自动降级回本地 TF/BM25，不抛错。
- 两路都未命中时仍退化为 LIKE 关键词匹配，保留旧有精确检索体验。

## embedding 配置（可选，升级为真稠密语义召回）

在 memory 插件 `config.embedding` 填入任意 **OpenAI 兼容 `/v1/embeddings`** 端点即可：

```yaml
- id: memory
  name: '@deepseek-ai/dsh-memory'
  config:
    injectMaxEntries: 6
    injectMaxChars: 1500
    embedding:
      baseURL: 'https://open.bigmodel.cn/api/paas/v4'  # 不含末尾 /embeddings
      apiKey: '${ZHIPU_API_KEY}'                        # 留空则自动用本地 TF
      model: 'embedding-3'
      alpha: 0.5                                        # BM25 权重；0=纯向量，1=纯 BM25
```

> 出于安全，`apiKey` 一律走环境变量/外层 secret 注入，不要明文提交进仓库。

### 已验证可接入的 OpenAI 兼容端点（2026-09-27 实探）

| 平台 | baseURL | 模型 | 接入形态 |
|---|---|---|---|
| 智谱 BigModel | `https://open.bigmodel.cn/api/paas/v4` | `embedding-3` | Bearer，`POST {baseURL}/embeddings` |
| 阿里 DashScope 兼容模式 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `text-embedding-v3` | Bearer，OpenAI 完全兼容 |
| 百度千帆 v2 | `https://qianfan.baidubce.com/v2` | `embedding-async-v1` | Bearer(IAM token)，同上 |

请求体统一为 `{ model, input }`，响应取 `data[0].embedding`；换模型/换端点后旧向量空间不可比，
插件启动时按 provider 名自动清空旧稠密向量并重建。

### Agnes 探测结论（2026-09-27）

`https://apihub.agnes-ai.com/v1` **当前分组不提供 embedding 渠道**，不可用于 memory 稠密召回：

- `POST /v1/embeddings {model: agnes-3.0-flash}` → HTTP 400：
  *"This model does not appear to be an embedding model by default ... try another model."*
- `model: text-embedding-3-small` / `embedding-3` → `model_not_found`（默认分组无渠道）。
- `GET /v1/models` 仅列出 chat / video / image，无 embedding 模型。

### 验证脚本

- `verify-hybrid.ts`：BM25+向量 hybrid 管线 headless 验证（含网络失败优雅降级、请求形态打桩）。
- `verify-embedding-providers.ts`：本地 TF 召回基线 + 三家国产端点形状打桩适配 + Agnes 实时/固化探测结论。
  带 `AGNES_API_KEY` 环境变量运行会实时复核 Agnes 是否仍不支持；否则用固化结论。

## 设计取舍与后续路线（不做静默降级）

- 检索已是 BM25 + 向量 hybrid（见上）；本地 TF 为默认离线档，配置国产 embedding API 后升级真稠密。
- 注入发生在同步 system-prompt provider，拿不到当前用户消息，
  因此注入的是全局重要记忆；**按当前轮次语义召回**待后续接入。
- 每次对话结束后自动提取关键信息（auto-extract）列为后续路线。
