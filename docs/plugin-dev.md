# 垂直领域插件开发指南

> 本文是「万物皆可插件」核心卖点的开发者文档。读完本文，你应当能照着做出一个新的垂直领域插件（host 工具 + 可选 UI 面板 + profile 接入），并让它在 `oa --profile <你的领域>` 下把通用界面瞬变为专业应用。

---

## 0. 从模板开始（5 分钟快速入门）

不想先读完整篇？直接复制现成模板，照五步走：

**模板位置**：[`packages/bundle/plugin-template/`](../packages/bundle/plugin-template/)
它是一个**自包含**的最小垂直插件——一个目录里同时放好了 host 半边（示例工具 `template_hello` + 领域 persona）、client 半边（往 `shell.statusbar` 槽位挂一个加载标记），以及把自己挂进启动树的 `cordis.patch.yml`。包已 `private: true`，不会被任何默认 profile 加载。

```bash
# 1) 复制模板，改成你的领域
cp -r packages/bundle/plugin-template packages/bundle/my-domain
cd packages/bundle/my-domain

# 2) 全局重命名：把 @deepseek-ai/dsh-plugin-template 换成你的新包名
#    （package.json 的 name、tsdown.config.ts 第一个参数、cordis.patch.yml 的 name 字段）
#    同时把 cordis.patch.yml 与 src/index.ts 里的 id/name "plugin-template" 改掉

# 3) 打开 src/index.ts，把 template_hello 换成你自己的领域工具
#    （defineTool + ValueSchemaSpec DSL 的写法见文件内中文注释 / 本文第 5.1 节）

# 4) 在 packages/boot/app-boot/src/profile.ts 的 PROFILE_TEMPLATES 里加一条：
#    myDomain: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-general-full',
#                         '@deepseek-ai/dsh-my-domain', '@deepseek-ai/dsh-web-app'] },
#    并把新包路径加进 tsconfig.host.json 与 tsconfig.client.json 的 references

# 5) 构建验证
npx tsc -b
pnpm run build:lib:host
pnpm run build:lib:client
pnpm oa --profile myDomain --dump-config   # 确认你的插件出现在启动树
```

模板里每个文件都有逐行中文注释解释「为什么这么写」。复制走之后，再回来读本文第 1～8 节了解每一处的设计理由与边界规则。下面是完整指南。

---

## 1. 定位与理念

OmniAgent 的底座是一个**通用全能 Agent**（文件、执行、搜索、推理、工具链、Web UI 全部开箱可用）。垂直领域的专业知识、专业工具、乃至专业界面，全部以**插件**形式打包：

- **插件 = 专业知识 + 工具 + （可选）UI 面板的打包**。
- **用时装载**：把插件挂到某个 profile 上，底座的工具集与系统提示词被增量叠加，Web 界面的某个槽位被替换/填充——同一 agent 瞬间变成该领域的专业应用。
- **不用即回退**：卸载插件，新增的工具与面板消失，通用底座行为不受任何影响。
- **通用能力全程在线**：领域 persona 只负责"遇到本领域问题优先用专业工具"，不接管、不削弱通用能力。

一个插件在工程上被拆成两半：

| 半 | 运行环境 | 职责 | 典型包 |
|---|---|---|---|
| **host 半** | Node（CLI / headless / web 服务端） | 注册模型可调用工具、注入领域系统提示词、声明 cordis 配置 schema | `@deepseek-ai/dsh-finance-agent`、`@deepseek-ai/dsh-tool-git` |
| **client 半** | 浏览器（Web UI） | 向 UI 槽位注册面板/控件、注册文案命名空间、订阅 host 推送 | `@deepseek-ai/dsh-client-ui-finance`、`@deepseek-ai/dsh-client-ui-status-bar` |

纯工具插件可以没有 client 半；纯 UI 插件的 host 半只是一个空 `apply()`（让插件在 host loader 里有一行注册项即可）。

---

## 2. 插件结构

一个最小可工作的 host 插件包目录长这样：

```
packages/<领域>/<你的插件>/
├── src/
│   ├── index.ts          # host 入口：name / inject / Config / apply
│   ├── source.ts         # （可选）数据契约 + mock/http 数据源
│   ├── engine.ts         # （可选）纯逻辑（确定性、可复核的规则/计算）
│   └── tools.ts          # （可选）defineTool 工具集
├── package.json          # name / exports / dsh 清单
├── tsconfig.json         # project references
└── smoke.mjs             # （可选）source 与纯逻辑冒烟测试
```

### 2.1 host 半（`src/index.ts`）

host 插件是一个 cordis 插件，必须导出四样东西：`name`、`inject`、`Config`（schemastery schema）、`apply(ctx, config)`。

```ts
// packages/<领域>/<你的插件>/src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'          // 工具注册表服务
import type {} from '@deepseek-ai/dsh-system-prompt'  // 系统提示词服务
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'

/** cordis 插件名（loader 诊断用）。 */
export const name = 'my-domain-agent'

/** 声明依赖的 cordis 服务；必须与 apply 里实际 ctx.xxx 访问的一致。 */
export const inject = ['tools', 'systemPrompt']

/** 插件配置（密钥走环境变量，配置文件不落明文）。 */
export interface Config {
  /** 数据源：mock=内置示例；http=自定义网关。 */
  source?: 'mock' | 'http'
  /** http 数据源根地址。 */
  baseURL?: string
  /** 读取 API key 的环境变量名。 */
  apiKeyEnv?: string
}

export const Config: z<Config> = z.object({
  source: z.union([z.const('mock'), z.const('http')]).default('mock'),
  baseURL: z.string().default(''),
  apiKeyEnv: z.string().default('MY_DOMAIN_API_KEY'),
})

/** 领域系统提示词（挂载时注入 systemPrompt）。 */
const DOMAIN_PERSONA = `你是本领域专业助手。在通用能力之上叠加本领域专业能力……
遇到本领域问题优先用专业工具；非本领域问题照常走通用能力。`

export function apply(ctx: Context, config: Config): void {
  // 1) 注入领域 persona 到系统提示词
  ctx.systemPrompt.section({
    name: 'mydomain-persona',
    order: -900,
    text: () => DOMAIN_PERSONA,
  })

  // 2) 注册工具
  const tools: ToolDefinition[] = [ /* 见第 5 节 */ ]
  for (const tool of tools) ctx.tools.register(tool)
}
```

要点：

- `inject` 声明的是 **cordis 服务名**（不是 npm 包名），例如 `'tools'`、`'systemPrompt'`。`apply` 内凡用到 `ctx.tools` / `ctx.systemPrompt`，都必须在 `inject` 里声明，否则 loader 启动时报缺依赖。
- `Config` 用 schemastery 声明；`z<Config>` 是类型与 schema 对齐的写法。敏感配置（API key）只放**环境变量名**，不写明文。
- `systemPrompt.section({ name, order, text })`：`order` 越小越靠前；`finance` / `ecommerce` 都用 `-900` 把领域 persona 放到靠前位置。

### 2.2 client 半（`src/client/index.ts`）

client 插件同样是 cordis 插件，但跑在浏览器端。host 半边（`src/index.ts`）对纯 UI 插件是空 `apply()`：

```ts
// packages/client/<你的-ui>/src/index.ts —— host 半边：空 apply
export function apply(): void {}
```

```ts
// packages/client/<你的-ui>/src/client/index.ts —— 浏览器半边
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ILayout, MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { MyPanel } from './MyPanel.tsx'
import { en, NS, zh } from './locales.ts'
import type { MyKey } from './locales.ts'

// 把本插件的文案命名空间登记进全局 LocaleNamespaceMap
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    mydomain: MyKey
  }
}

export const PANEL_ID = 'mydomain' as MainPanelId

/** 浏览器端需要的 cordis 服务。 */
export const inject = ['locale', 'slots', 'layout']

export function apply(ctx: ClientContext): void {
  // 注册文案字典
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'my-ui: dictionaries')

  const slots = (ctx as unknown as { slots: SlotRegistry }).slots
  const layout = ctx.layout as ILayout

  // 向 main 槽位注册一个全局面板
  slots.inject('main', () => slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => ({ backToChat: () => layout.selectPanel(null) }),
  }, MyPanel))
}
```

> 参考实现：`packages/client/ui-finance/src/client/index.ts`（main 全局面板 + 自动选中）、`packages/client/ui-status-bar/src/client/index.ts`（`shell.statusbar` 顶栏槽位 + order 排序）。

### 2.3 package.json

host 半（纯工具插件，无 client bundle）：

```jsonc
{
  "name": "@deepseek-ai/dsh-my-domain-agent",
  "version": "0.1.7-rc.1",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/types/**/*.d.ts"],
  "license": "MIT",
  "dependencies": { "@deepseek-ai/schemastery": "workspace:~" },
  "peerDependencies": {
    "@deepseek-ai/cordis": "workspace:~",
    "@deepseek-ai/dsh-system-prompt": "workspace:*",
    "@deepseek-ai/dsh-tools": "workspace:*"
  }
}
```

client 半（含浏览器 bundle）多两个关键字段：

```jsonc
{
  "name": "@deepseek-ai/dsh-client-ui-my-domain",
  "exports": {
    ".":         { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client":  { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/client.js", "lib/types/**/*.d.ts"],
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-slots"
      ]
    }
  },
  "scripts": { "bundle": "tsdown", "watch": "tsdown --watch" }
}
```

要点：

- `exports["./client"]` 指向浏览器入口（`lib/client.js`），由 web 构建经 `dsh.client` 声明发现。
- `dsh.client.inject` 列出本 client bundle 运行时需要的**其他 client 包**（按 npm 包名，不是服务名）。loader 据此把浏览器 bundle 串成正确的加载顺序。
- `dsh.client.platform: "web"` 表示该 bundle 只在 Web 端加载。

### 2.4 tsconfig.json（project references）

host 包：

```jsonc
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "lib/types" },
  "include": ["src"],
  "references": [
    { "path": "../../../vendor/cordis" },
    { "path": "../../../vendor/schemastery" },
    { "path": "../../core/tools" },
    { "path": "../../core/system-prompt" }
  ]
}
```

client 包继承 client 基座：

```jsonc
{
  "extends": "../../../tsconfig.base.client.json",
  "compilerOptions": { "rootDir": "src", "outDir": "lib/types" },
  "include": ["src"],
  "references": [
    { "path": "../../../vendor/cordis" },
    { "path": "../locale/tsconfig.client.json" },
    { "path": "../ui-layout" },
    { "path": "../ui-renderer" },
    { "path": "../ui-slots" }
  ]
}
```

> 你 `import` 到的每一个 workspace 包，都必须在 `references` 里补一条，否则 `tsc -b` 不会先编译它，类型会对不上。vendor 三方（cordis / schemastery / cosmokit）也按需引用。

### 2.5 tsdown.config.ts

绝大多数包**不需要**自己的 tsdown 配置——仓库根 `tsdown.config.ts` 用 `workspace: [...]` 一次性构建所有包，靠环境变量 `DSH_BUILD_FACE=host|client` 区分两面：

- `build:lib:host` → `tsc -b tsconfig.host.json && tsdown --env.DSH_BUILD_FACE host`
- `build:lib:client` → `tsc -b tsconfig.client.json && tsdown --env.DSH_BUILD_FACE client`

client 包内的 `scripts.bundle = "tsdown"` 是给单包增量开发用的；默认不要新建包级 tsdown 配置，保持与仓库一致。

---

## 3. PROFILE_TEMPLATES / OPTIONAL_BUNDLES 接入

插件单独存在时不会被加载；必须通过一个 **bundle 组合包**把它挂进某个 profile。

### 3.1 bundle 组合包是什么

bundle 是一个声明了 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 的小包。它本身不写逻辑（`src/index.ts` 往往是 `export {}`），只靠 `cordis.patch.yml` 把一组插件 `insert` 进启动树。

参考 `packages/bundle/finance/`：

```jsonc
// packages/bundle/finance/package.json
{
  "name": "@deepseek-ai/dsh-finance",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "cordis.patch.yml", "lib/types/**/*.d.ts"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "dependencies": {
    "@deepseek-ai/dsh-finance-agent": "workspace:*",
    "@deepseek-ai/dsh-client-ui-finance": "workspace:*"
    // ...
  }
}
```

```yaml
# packages/bundle/finance/cordis.patch.yml
- insert:
    - id: finance-agent
      name: '@deepseek-ai/dsh-finance-agent'
      config:
        source: mock
        # source: http
        # baseURL: https://your-finance-gateway.example/v1
        # apiKeyEnv: FINANCE_API_KEY
    - id: ui-finance
      name: '@deepseek-ai/dsh-client-ui-finance'

- id: agent-default-model
  config: { provider: deepseek-openai, model: deepseek-chat }
```

patch 语法：顶层是一个 YAML 列表；`- insert:` 下逐行 `id + name + config` 注册插件；不带 `insert` 的裸 `- id:` 行是**按 id 覆盖配置**（如 `agent-default-model` / `llm-pi-ai`）。

### 3.2 在 profile 模板里注册插件

打开 `packages/boot/app-boot/src/profile.ts`，在 `PROFILE_TEMPLATES` 里加一条：

```ts
export const PROFILE_TEMPLATES: Record<string, ProfileTemplate> = {
  // ...既有模板
  finance: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-general-full', '@deepseek-ai/dsh-finance', '@deepseek-ai/dsh-web-app'],
  },
  ecommerce: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-ecommerce', '@deepseek-ai/dsh-web-app'],
  },
  // 新增你的领域：
  mydomain: {
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-general-full', '@deepseek-ai/dsh-mydomain', '@deepseek-ai/dsh-web-app'],
  },
}
```

约定：

- 第一个包永远是 `@deepseek-ai/dsh-base`（通用底座）。
- 需要通用增强（LSP、定时任务、产物交付、桌面/浏览器自动化注册表等）就加 `@deepseek-ai/dsh-general-full`。
- 末尾加 `@deepseek-ai/dsh-web-app` 才是 Web 形态；headless 形态末尾换成 `@deepseek-ai/dsh-headless`。
- 中间插入你的领域 bundle。

首次运行 `oa --profile mydomain` 时，boot 会自动用该模板初始化 `$DSH_HOME/profiles/mydomain/`（生成 package.json + 空 cordis.patch.yml + pnpm-workspace.yaml）。

### 3.3 让插件在 Web 插件市场可一键启停

把你的 bundle 名加进 `OPTIONAL_BUNDLES`（同文件内），它就会随安装提供、默认关闭，并出现在 Web 侧栏「插件」页：

```ts
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@deepseek-ai/dsh-finance',
  '@deepseek-ai/dsh-ecommerce',
  '@deepseek-ai/dsh-mydomain', // 新增
  '@deepseek-ai/dsh-general-full',
  // ...
]
```

> 已经在 `web` / `headless` profile 里默认加载的包（如 `general-full`）也列在这里，表示"可在插件页停用"。

---

## 4. client 包规则（重点）

### 4.1 inject 声明必须与实际访问的服务一致

`src/client/index.ts` 顶层 `export const inject = [...]` 列出的服务名，必须等于 `apply` 里 `ctx.xxx` / `ctx.inject([...])` 真正用到的服务。漏声明 → loader 注入失败；多声明无害但不规范。

对比两个范例：

- `ui-finance` 只用了 `locale / slots / layout`，顶层 `inject = ['locale','slots','layout']`。
- `ui-status-bar` 用了 `sessions / modelDirectories / connection / theme / uiWorkspace`，顶层 inject 全部列齐，并在 `apply` 内用 `ctx.inject([...], scope => {...})` 取作用域。

### 4.2 client bundle purity：禁止跨插件 value import

浏览器 bundle 是按包独立打包的。**禁止在 client 代码里 `import { 某运行时值 } from '@deepseek-ai/dsh-client-ui-别的包'`**（例如从 ui-finance 直接 import 一个 React 组件或常量）。允许的只有：

- `import type { ... } from '别的包/client'` —— **type-only import 可以**，会在编译期被擦除。
- 通过 cordis 服务（`ctx.locale`、`ctx.slots`、`ctx.sessions` 等）跨包通信。

> 违反后果：两个 bundle 各自打包同一份运行时模块，状态/实例不一致，界面行为诡异且难排查。

### 4.3 每包自建 css-modules.d.ts

每个带 `.module.css` 的 client 包，在 `src/css-modules.d.ts` 放一份（**不要跨包复用**）：

```ts
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
```

参考：`packages/client/ui-finance/src/css-modules.d.ts`、`packages/client/ui-status-bar/src/css-modules.d.ts`。

### 4.4 槽位 slots 注册机制

UI 包通过 `slots.inject(槽位名, () => slots.register(选项, 组件))` 把 React 组件挂进宿主布局：

```ts
// main 全局面板（中心区整体替换，如金融终端）
slots.inject('main', () => slots.register({
  name: 'main',
  key: PANEL_ID,        // 面板 id；layout.selectPanel(PANEL_ID) 切换
  locale: NS,
  inject: () => ({ /* 传给组件的 props/服务 */ }),
}, MyPanel))

// 命名槽位（如顶部状态栏，多个插件可共存，用 order 排序）
slots.inject('shell.statusbar', () => slots.register({
  name: 'shell.statusbar',
  id: 'ui-status-bar',
  order: 100,           // 同槽位内排序
  locale: NS,
  inject: () => injected,
}, StatusBar))
```

- `main` 槽位：中心对话区，同一时刻只显示一个面板；领域插件常用它做"瞬变专业应用"。
- `shell.statusbar` 等壳层槽位：多个插件可并列挂入，`order` 控制先后。
- `inject: () => ({...})` 返回的对象会作为 props 传给你的组件；需要订阅响应式数据时，在 `apply` 侧把 host 投影包成 `{ getSnapshot, subscribe }` 的 observable（见 ui-status-bar 的 `createModelLabelSource` / `createTokenUsageSource`）。

### 4.5 locale NS 声明

```ts
// src/client/locales.ts
export const NS = 'mydomain'
export const zh = { panelTitle: '我的领域', /* ... */ } satisfies Record<string, string>
export type MyKey = keyof typeof zh
export const en: Record<MyKey, string> = { panelTitle: 'My Domain', /* ... */ }
```

```ts
// 在 index.ts 里登记命名空间并注册字典
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { mydomain: MyKey }
}
ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'my-ui: dictionaries')
```

zh 是 key-set 的唯一真源；en 必须用 `Record<MyKey, string>` 做完整性检查，漏一个 key 编译报错。

### 4.6 主题变量用 `--dsw-alias-*` 系列

写 CSS Module 时**不要硬编码颜色/间距**，一律用主题别名变量：

```css
.panel {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}
.subtitle { color: var(--dsw-alias-label-tertiary); }
.badge {
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-brand-primary);
}
```

常用别名：`--dsw-alias-bg-base` / `--dsw-alias-bg-layer-1`、`--dsw-alias-label-primary/secondary/tertiary`、`--dsw-alias-border-l1/l2`、`--dsw-alias-brand-primary`、`--dsw-alias-state-*`。这样浅色/深色/跟随系统主题自动生效。

---

## 5. host 包规则

### 5.1 工具注册：`defineTool` + ValueSchemaSpec DSL

用 `defineTool({...})` 定义一个模型可调用工具，再 `ctx.tools.register(tool)`：

```ts
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'

const myTool: ToolDefinition = defineTool({
  name: 'mydomain_query',
  description: '查询本领域数据：一句话告诉模型这个工具干什么、何时用。',
  parameters: {
    symbol: { type: 'string', required: true, description: '对象代码' },
    market: { type: 'string', enum: ['cn', 'hk', 'us'], description: '市场，默认 cn' },
  },
  output: {
    schema: {
      type: 'object', additionalProperties: false,
      properties: {
        symbol: { type: 'string', required: true },
        price:  { type: 'number', required: true },
        mock:   { oneOf: [{ type: 'boolean' }, { type: 'null' }], required: true },
      },
    },
    // render：把结构化结果渲染成模型/用户可读的文本块
    render: (_args, value) => [{
      type: 'text',
      text: `${value.symbol} 最新价 ${value.price}${value.mock === true ? '（示例数据）' : ''}`,
    }],
  },
  async execute(args: { symbol: string; market?: string }) {
    // 真正的取数/计算逻辑；失败时 throw 带中文、可行动的错误
    return { symbol: args.symbol, price: 123.45, mock: true }
  },
})

ctx.tools.register(myTool)
```

Schema DSL 要点（与 `ValueSchemaSpec` 对齐）：

- 基本类型：`{ type: 'string' | 'number' | 'integer' | 'boolean' }`；枚举加 `enum: [...]`；可选字段不加 `required: true`。
- 数组：`{ type: 'array', items: { ... } }`。
- 对象：`{ type: 'object', properties: {...}, additionalProperties: false, required: [...] }`。
- 可空字段用 `oneOf: [{ type: 'boolean' }, { type: 'null' }]`。
- `parameters` 是入参 schema（字段值即描述）；`output.schema` 是返回值 schema；`output.render` 负责把返回值渲染成文本块（`{ type: 'text', text }`），模型与用户都看它。

> 完整范例见 `packages/finance/finance-agent/src/tools.ts`（19 个工具，含只读查询、纯计算、回测引擎、代码生成四种形态）。

### 5.2 权限集成（permission-rules）

插件**自己不做权限绕过**，写操作交给 `@deepseek-ai/dsh-permission-rules` 统一接管：

- 只读工具（如 `git_status` / `git_diff`）：默认兜底 `allow`。
- 写工具（如 `git_add` / `git_commit`）：建议在文档/patch 里建议用户把它配成 `ask`：

```yaml
- id: permission-rules
  name: '@deepseek-ai/dsh-permission-rules'
  config:
    preset: normal
    rules:
      - { pattern: 'git_commit', level: ask }
      - { pattern: 'git_add', level: ask }
      - { pattern: 'mydomain_write_*', level: ask }   # 你的写工具整组管控
```

`level` 四档：`allow` / `auto` / `ask` / `deny`。`ask` 会弹审批，`deny` 直接拦截。详见 `packages/guard/permission-rules/README.zh.md`。

### 5.3 系统提示词注入

```ts
ctx.systemPrompt.section({
  name: '<domain>-persona',   // 唯一 section 名
  order: -900,                // 领域 persona 放靠前
  text: () => DOMAIN_PERSONA, // 函数返回最新文案
})
```

persona 文案的写法约定（参考 finance/ecommerce）：

1. 列明"哪些数据必须用本领域工具取，不得编造"。
2. 带 mock 标记的数据必须明示"示例数据，不可用于真实决策"。
3. 区分"已查证数据 / 规则计算结果 / 分析观点"，涉及钱/投资/投放时给风险提示、不承诺收益。
4. 明确"遇到本领域问题优先用专业工具；非本领域问题照常走通用能力"。

### 5.4 cordis 服务依赖注入

`apply(ctx, config)` 里用到的每个服务（`ctx.tools`、`ctx.systemPrompt`、`ctx.schedule` 等）都要在顶层 `export const inject = [...]` 声明。需要在运行时条件取服务时，用 `ctx.inject([...], scope => { ... })`（client 半同理，见 ui-status-bar）。

---

## 6. 参考插件速查

| 插件 | 路径 | 形态 | 学什么 |
|---|---|---|---|
| **plugin-template**（最小模板） | `packages/bundle/plugin-template` | 自包含：host 工具 + client 槽位 + bundle patch | 5 分钟起步：defineTool + persona + slots 注册 + cordis.patch.yml 自举，逐行中文注释。新插件先复制它 |
| **dsh-finance**（金融） | `packages/finance/finance-agent` + `packages/client/ui-finance` + `packages/bundle/finance` | 工具 + UI 面板 + profile 接入 | 完整范式：host 工具集 + persona、client main 面板瞬变终端、bundle patch、profile 模板 |
| **dsh-ecommerce**（电商） | `packages/ecommerce/ecommerce-agent` + `packages/bundle/ecommerce` | host 工具 + persona（无独立 UI） | 第二个领域插件，证明"任意垂直领域皆可打包"；mock 数据源契约 |
| **dsh-general-full**（通用增强组合包） | `packages/bundle/general-full` | bundle 组合 | 一个 bundle 串联 LSP/定时任务/产物/桌面自动化注册表等通用增强的 patch 写法 |
| **tool-git** | `packages/tools/tool-git` | 纯 host 工具 | 4 个工具、只读/写权限分级、execFileSync 调系统命令、无第三方 git 依赖 |
| **tool-notify** | `packages/tools/tool-notify` | host 工具 + client 半边 | 同一包内 `src/index.ts`（host）+ `src/client/index.ts`（浏览器通知），降级链设计 |
| **ui-status-bar** | `packages/client/ui-status-bar` | 纯 UI | host 半空 apply、`shell.statusbar` 槽位 + order、响应式 observable 投影、多服务 inject |

---

## 7. 验证流程

```bash
# 1) 类型检查（host / client 两个项目都要过）
pnpm run build:lib:host     # tsc -b tsconfig.host.json && tsdown host
pnpm run build:lib:client   # tsc -b tsconfig.client.json && tsdown client

# 2) 前端构建（改了 client bundle 才需要）
pnpm run build:web

# 3) 打印组合后的启动树是否符合预期（不真正启动）
pnpm oa --profile mydomain --dump-config

# 4) 启动验证你的 profile（首次会自动初始化 profile 目录）
pnpm oa --profile mydomain --no-open

# 5) 浏览器 / CLI 实测
#    - Web：打开打印的 URL，确认面板/槽位出现、自动选中、文案中英切换正常
#    - CLI 一次性对话：
pnpm oa --profile mydomain "用一句话验证你的领域工具被调用"
```

自检清单：

- [ ] `tsc -b` host/client 两边都无错。
- [ ] 你的工具在 `--dump-config` 里出现、config 正确合并。
- [ ] Web 启动后面板出现在对应槽位；切到通用 `web` profile 时你的面板**不出现**（不污染通用界面）。
- [ ] mock 数据在 render 文本里带"（示例数据）"标记。
- [ ] 写工具在 `permission_set` 查得到、可被 `ask`/`deny` 管控。

---

## 8. 常见坑

1. **`failed to import` / bundle dependencies 缺失**
   bundle（`packages/bundle/<x>`）的 `dependencies` 必须把它 patch 里 `insert` 的每个插件包都列上；漏一个，启动时 loader 找不到该包。

2. **inject 声明错误**
   `ctx.tools` 用了却没在 `inject: ['tools']` 声明 → 启动即报缺服务。client 侧同理（顶层 `export const inject` 与 `dsh.client.inject` 都要对）。

3. **client purity 违规**
   在 client 代码里 `import { 运行时值 }` 自别的 UI 包 → 两份运行时实例，状态错乱。跨包只允许 type-only import 或走 cordis 服务。

4. **tsconfig project reference 缺失**
   import 了某个 workspace 包却没在 `references` 里加 `{ path: ... }` → `tsc -b` 不编译它，类型/产物对不上。

5. **构建产物混入 src**
   产物固定输出到 `lib/`（`rootDir: src`、`outDir: lib/types` + tsdown 出 `lib/index.js`）。不要把编译产物、`tsconfig.tsbuildinfo` 提交进 git；`.gitignore` 已忽略 `lib/`、`*.tsbuildinfo`。

6. **配置文件写明文密钥**
   API key 走环境变量（`apiKeyEnv: 'XXX_API_KEY'`），patch 里只写变量名，不写 `sk-...`。

7. **在通用 profile 里漏挂 UI 包**
   领域 client 面板只在领域 bundle 的 patch 里 `insert`，**不要**塞进 `dsh-general-full`，否则通用 `web` profile 也会被替换界面。
