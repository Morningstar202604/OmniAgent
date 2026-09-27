# OmniAgent 用户操作手册

> 本手册面向日常使用者：如何启动、对话、管理会话、配置模型与权限、使用官方领域插件（金融 / 电商），以及常见问题排查。
>
> 概念一句话：**底座是通用全能 Agent，专业能力靠插件装载**。不用插件时它是通用助手；在「插件」页启用或用 `--profile` 进入领域 profile，它就变成专业应用。

---

## 1. Web 日常使用

### 1.1 启动

```bash
pnpm oa web                 # 等价于 oa --profile web
# 或指定端口 / 不自动开浏览器
pnpm oa web --no-open --port 8080
```

- 默认在 `http://127.0.0.1:3080` 启动，启动后通常自动打开默认浏览器。
- `--no-open`：只起服务、不打开浏览器（SSH / 远程场景用），手动访问打印出的 URL。
- `--port <端口>`：换端口；传 `0` 让系统随机分配。
- `--host <host>`：绑定地址（**不支持 `0.0.0.0`**，出于安全只监听 loopback）。
- `--trusted-host <authority...>`：额外放行的浏览器信任来源（host 或 host:port，可重复）。

> 启动 URL 带一次性进程 token，浏览器打开后会自动换签名 cookie。若前端未构建，启动会提示先跑 `pnpm run build`。

### 1.2 对话

- 底部输入框直接输入自然语言即可。Agent 会自动决定是否调用工具（文件读写、执行命令、搜索、领域工具等）。
- 工具调用过程会在消息流里展示；需要审批的写操作会弹出确认卡片。
- 用户消息支持**编辑后重跑**：悬停自己的消息可编辑并 fork 截断重生成。
- 消息操作栏可把单条消息**导出为 Markdown** 下载。

### 1.3 会话管理

- 左侧「会话历史」列出全部会话，可搜索、切换；大列表已做虚拟滚动。
- 顶部状态栏显示当前会话标题 / id、当前模型、token 用量、连接状态、时钟，并可一键切换浅色/深色/跟随系统主题。
- 「新建会话」开始一个全新上下文；「分支 / fork」从某条消息截断重生成。

### 1.4 命令面板

按快捷键（或顶栏入口）唤起命令面板，可快速切换模型、跳转设置、执行已注册命令，无需点进多级菜单。

### 1.5 状态栏

顶部状态栏常驻：当前模型、会话标题/id、累计 token 用量、连接状态、时钟、主题切换按钮。

### 1.6 插件市场（侧栏「插件」页）

- 随安装提供的官方组合包默认**关闭**，在插件页一键启用即向当前 profile 注入该领域能力。
- 可启停的官方包包括：金融 `@deepseek-ai/dsh-finance`、电商 `@deepseek-ai/dsh-ecommerce`、通用增强 `@deepseek-ai/dsh-general-full` 等。
- 也可在此安装外部插件（npm 包 / Git 地址 / tarball / 本地路径）。

---

## 2. CLI 日常使用

### 2.1 启动

```bash
oa web                      # 启动 Web UI（最常用）
oa --profile web            # 同上，显式写法
oa finance "你的问题"        # 领域 profile 一次性对话（见第 4 节）
```

启动器只认自己的几个 flag（`--profile` / `--patch` / `--dump-config` 等），其后的参数原样透传给被启动的 app。

### 2.2 headless 一次性模式

```bash
oa headless "跑一下测试并总结失败原因"
```

headless 模式回答一个任务、打印结果后退出，适合脚本 / CI / 无人值守。

### 2.3 `--patch`：临时叠加配置

```bash
oa web --patch ./extra.yml
oa web --patch ./a.yml --patch ./b.yml   # 可重复，按顺序叠加
```

`--patch` 在你自己的 profile 层之后再叠加一层 patch 列表，不改 profile 文件，适合临时试验。

### 2.4 `--profile <name>`：选择 profile

```bash
oa --profile finance "查一下贵州茅台行情"
oa --profile ecommerce "给无线蓝牙耳机拓词"
```

内置 profile：`web`（通用 Web）、`headless`（一次性）、`finance`（金融）、`ecommerce`（电商）、`acp` / `sdk` / `sdk-minimal`。首次进入某 profile 会自动初始化 `$DSH_HOME/profiles/<name>/`。

### 2.5 其他诊断命令

```bash
oa --profile web --dump-config            # 打印组合后的完整配置树并退出
oa --profile web --dump-default-config    # 只看 bundle 层（不含用户层/patch）
oa --profile web --dump-config-schema     # 打印配置项 JSON Schema
oa plugin --profile web add <package>     # 往 web profile 安装一个插件包
```

---

## 3. 设置详解

Web 侧栏「设置」页分多个标签：

- **通用设置**：界面语言、主题、启动行为等。
- **模型配置（Models）**：配置 LLM provider 与模型。默认走 OpenAI 兼容端点；在 Models 页填入 `baseURL`、API key（走环境变量）、模型 id 与上下文窗口。
- **权限模式（Permissions）**：切换权限预设或自定义规则（见第 6 节）。
- **生成参数**：模型相关的采样 / 上下文等参数。
- **插件管理（Plugins）**：查看 / 启停已加载插件，管理插件清单。

> API key 不落配置文件明文：配置里只填**环境变量名**（如 `DEEPSEEK_API_KEY`），真实密钥通过环境变量注入。

---

## 4. 金融插件使用场景

进入金融领域：Web 侧栏「插件」启用 `@deepseek-ai/dsh-finance`，或直接 `oa --profile finance`。加载后中心对话区瞬变为**金融终端**（行情条 / 标的详情+K线 / 研报公告资讯 / 专业功能面板）。

可直接用自然语言驱动以下能力（共 19 个金融工具）：

| 场景 | 示例提问 |
|---|---|
| **行情查看** | "查一下 600519 最新行情"、"看下港股 0700 和美股 AAPL" |
| **选股** | "筛选 A 股里 PE 低于 20、ROE 大于 15% 的公司"、"食品饮料行业市值前 10" |
| **财务/估值** | "贵州茅台的营收、净利、ROE、毛利率"、"算一下它的 PE/PB 和股息率" |
| **K线/技术分析** | "拉一下 600519 近 60 日日K，算 RSI 和 MACD" |
| **回测** | "对 600519 跑一个双均线交叉回测，初始资金 100 万"、"用定投策略回测 000858" |
| **量化代码** | "把这个均线交叉策略生成 backtrader 风格 Python 代码" |
| **风险指标** | "算一下它相对沪深300 的 Beta、夏普、最大回撤、VaR" |
| **资金流/公告/资讯** | "今天主力资金流向"、"最近有什么公告"、"最新财经快讯" |
| **宏观/板块/利率汇率** | "最新 CPI 和 PMI"、"今天哪个行业板块领涨"、"现在 LPR 和 USD/CNY" |
| **基金/债券/可转债/研报** | "510300 净值"、"可转债溢价率"、"看下 600519 的券商研报评级和目标价" |
| **报告导出** | 让助手把分析整理成 Markdown / HTML 专业报告（`report-export`）。 |

> **重要**：金融插件默认使用**内置示例数据（mock）**，所有带"（示例数据）"标记的结果仅供演示、不可用于真实投资决策。接入真实行情/财务数据服务时，在 profile patch 里把 `source` 改为 `http` 并配 `baseURL` + `apiKeyEnv`（见金融 bundle 的 `cordis.patch.yml` 注释）。所有计算类工具（风险指标、回测、金融计算器、技术指标）均为本地确定性计算，返回公式与中间值可逐行复核。

---

## 5. 电商插件使用场景

进入电商领域：Web 插件页启用 `@deepseek-ai/dsh-ecommerce`，或 `oa --profile ecommerce`。共 8 个电商运营工具：

| 场景 | 示例提问 |
|---|---|
| **关键词拓词** | "给'无线蓝牙耳机'拓展搜索关键词" |
| **标题优化** | "帮我优化这条商品标题，给出高点击版本" |
| **类目市场洞察** | "看下数码配件类目的市场规模和趋势" |
| **选品评估** | "评估一下这款产品值不值得做" |
| **评论分析** | "分析这条评论：物流太慢了，包装都压坏了" |
| **价格带分析** | "这个品类主流价格带分布" |
| **带货脚本** | "给这条产品写一段带货口播脚本" |
| **活动方案** | "帮我做一份 618 促销活动方案" |

> 电商数据同样为**内置示例（mock，确定性可复核）**，带货脚本与活动方案是方法论建议，不承诺销量/转化。接入真实电商数据时按 `EcommerceDataSource` 契约扩展。

---

## 6. 记忆与权限管理

### 6.1 跨会话记忆

底座提供 SQLite 持久化记忆，模型会按需主动调用：

- `memory_add`：记录用户偏好 / 项目知识 / 历史决策（跨会话保留）。
- `memory_search`：按语义/关键词检索历史记忆。
- `memory_list` / `memory_update` / `memory_delete`：查看、修改、删除记忆。

你也可以直接说"记住我偏好简洁回答"，助手会调用 `memory_add` 持久化。

### 6.2 权限模式

`@deepseek-ai/dsh-permission-rules` 提供四档预设（设置页「权限」或让模型调用）：

| 预设 | 行为 |
|---|---|
| `normal`（默认） | 不额外加规则，沿用底层沙箱 + 按需审批 |
| `full-auto` | 全部自动允许 |
| `strict` | 全部工具调用前都询问 |
| `custom` | 用 `permission_set` 自定义通配规则 |

模型可见工具：

- `permission_presets`：列出全部预设与当前预设。
- `permission_get(tool_name?)`：查看当前规则，可查某工具的生效等级。
- `permission_set(preset?, rules?)`：运行时切预设或加自定义规则。

规则按工具名通配匹配，`level` 取 `allow` / `auto` / `ask` / `deny`。例如让助手把所有写操作设为询问：

```
permission_set rules=[{pattern:'git_*', level:'ask'},{pattern:'shell.*', level:'ask'}]
```

---

## 7. 常见问题（FAQ）

### 7.1 API key 怎么配？

本底座默认走 OpenAI 兼容端点。设置「模型」页或 profile patch 里配置 provider，真实密钥放环境变量：

```bash
export DEEPSEEK_API_KEY=sk-...
```

金融/电商 bundle 已内置默认路由（`deepseek-openai` → `https://api.deepseek.com/v1`），配好 `DEEPSEEK_API_KEY` 即可对话。接任意 OpenAI 兼容端点（通义/智谱/本地 vLLM 等）只需换 `baseURL` 与模型 id，参考 `config/agnes-ai.patch.yml` 示例：

```bash
export AGNES_API_KEY=sk-...
oa web --patch config/agnes-ai.patch.yml
```

### 7.2 插件加载失败 / `failed to import`

- 确认该 profile 的 bundle 已 `oa plugin --profile <p> add <pkg>` 安装。
- 看 `oa --profile <p> --dump-config` 里该插件行是否出现、config 是否合并。
- bundle 包的 `dependencies` 是否把它 patch 里 `insert` 的每个插件都列全（漏一个就 import 失败）。
- 改了插件源码后需重新构建：`pnpm run build:lib:host`（+ `build:lib:client` 若改了 UI）。

### 7.3 构建问题

```bash
pnpm run build:lib:host     # host 侧类型 + 产物
pnpm run build:lib:client   # client 侧
pnpm run build:web          # 前端
pnpm oa web                 # 用产物启动
```

- `tsc -b` 报错多半是漏了 tsconfig project reference（见插件开发指南第 2.4 节）。
- 前端未构建时 Web 启动会提示先 build；dev 模式用 `pnpm run dev:web`（源码改动自动重建 client bundle）。

### 7.4 性能问题

- 会话历史大列表已做虚拟滚动；若仍卡顿，检查是否挂了过多插件。
- 长任务用 headless 一次性跑；Web 端长时间任务可配合 `notify_send`（任务完成自动通知）。
- token 用量见顶部状态栏；上下文过长时底座会自动压缩（compaction）。

### 7.5 领域数据是真的吗？

官方领域插件默认是 **mock 示例数据**，结果会带"（示例数据）"标记，仅供演示与开发调试。接真实数据服务需按各插件数据源契约配置（金融：`source: http` + `baseURL` + `apiKeyEnv`）。
