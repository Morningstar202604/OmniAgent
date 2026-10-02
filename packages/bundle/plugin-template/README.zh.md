# dsh-plugin-template · 最小垂直插件模板

[English](README.md) | 中文

> 复制本目录 → 改个名 → 写自己的工具，5 分钟做出一个新的垂直领域插件。
> 完整背景与规则见 [`docs/plugin-dev.md`](../../../docs/plugin-dev.zh.md)。

本包是一个**自包含**的最小垂直插件：一个目录里同时放了 host 半边（工具 + 系统提示词）和 client 半边（UI 槽位标记），外加把自己挂进启动树的 `cordis.patch.yml`。它本身 `private: true`，**不会**被任何默认 profile 加载，仅作复制起点。

## 目录结构

```
packages/bundle/plugin-template/
├── package.json            # name / exports / dsh manifest (bundle.patch + client)
├── tsconfig.json           # project references (host + client deps)
├── tsdown.config.ts        # clientBundle(...): emits the Node half and the browser half
├── cordis.patch.yml        # inserts this package into the cordis boot tree
├── src/
│   ├── index.ts            # host half: template_hello tool + domain persona
│   └── client/
│       └── index.ts        # client half: registers a load marker on the shell.statusbar slot
└── README.md               # this file
```

两半各跑在哪：

| 半 | 文件 | 运行环境 | 职责 |
|---|---|---|---|
| host | `src/index.ts` | Node | `defineTool` 注册工具、`systemPrompt.section` 注入 persona |
| client | `src/client/index.ts` | 浏览器 | `slots.inject('shell.statusbar', …)` 注册 UI 槽位 |

## 五步做出你的插件

### 1. 复制并改名

```bash
cp -r packages/bundle/plugin-template packages/bundle/my-domain
cd packages/bundle/my-domain
```

把包名 `@deepseek-ai/dsh-plugin-template` 全局替换成你的新名，例如 `@deepseek-ai/dsh-my-domain`（`package.json` 的 `name`、`tsdown.config.ts` 第一个参数、`cordis.patch.yml` 的 `name` 字段）。同时把 `cordis.patch.yml` 里的 `id: plugin-template` 改成 `my-domain`。

### 2. 写你自己的工具

打开 `src/index.ts`：
- 把 `name = 'plugin-template'`、`Config`、`TEMPLATE_PERSONA` 改成你的领域；
- 删掉 `template_hello`，照它的样子用 `defineTool({...})` 写你的工具；
- 需要写操作时，按文件末尾注释在 `cordis.patch.yml` 里加 `permission-rules` 规则。

### 3. （可选）改 UI 槽位

`src/client/index.ts` 现在只在顶栏挂一个「模板插件已加载」小标记。
要做「整屏专业面板」就把槽位换成 `main`（中心对话区），参考 `packages/client/ui-finance`；
要在侧栏 / 底栏加控件就选别的槽位，参考 `packages/client/ui-status-bar`。

### 4. 接进 PROFILE_TEMPLATES

打开 `packages/boot/app-boot/src/profile.ts`，在 `PROFILE_TEMPLATES` 里加一条：

```ts
myDomain: {
  bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-general-full', '@deepseek-ai/dsh-my-domain', '@deepseek-ai/dsh-web-app'],
},
```

约定：第一个永远是 `@deepseek-ai/dsh-base`；需要通用增强就加 `dsh-general-full`；末尾 `dsh-web-app` 是 Web 形态（headless 换成 `dsh-headless`）；中间插你的领域 bundle。

### 5. 构建验证

```bash
npx tsc -b                 # 类型检查（host + client）
pnpm run build:lib:host    # 出 Node 半边 lib/index.js
pnpm run build:lib:client  # 出浏览器半边 lib/client.js
pnpm oa --profile myDomain --dump-config   # 打印启动树，确认你的插件出现
pnpm oa --profile myDomain --no-open       # 真正启动验证
```

## 注意

- 本包 `private: true`，且不在 `OPTIONAL_BUNDLES` / 任何 shipped profile 里——用户启动默认 `web` profile 时**不会**看到示例工具 `template_hello`。
- 复制走之后，记得把新包加进 `tsconfig.host.json` 和 `tsconfig.client.json` 的 `references`（否则 `tsc -b` 不会编译它）。
- 不要把复制出来的领域包留在默认 `web` profile 里，否则通用界面会被你的面板污染。
