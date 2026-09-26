# OmniAgent (`oa`) — a plugin-based universal agent

> One base, N professions. With no plugin it is a general-purpose all-round agent; load a plugin and it instantly becomes a professional agent for that vertical — detach and it is back to general.

## Positioning

OmniAgent is not a single-industry specialized agent; it is a **everything-is-a-plugin** agent platform:

- **The base is a full-featured general-purpose agent**: files, execution, search, reasoning, toolchain and Web UI all work out of the box with no plugin attached — a complete base agent that handles any everyday task.
- **All domain capabilities come from plugins**: package a vertical's professional knowledge, tools (and even UI) into a plugin. Load it, and the same agent instantly gains that domain's professional capabilities and persona; detach it, and the general base is restored — **general capabilities are never weakened**.
- **Open and download when you need it**: when you need a vertical, open the plugin page, download/install, and enable. The moment the plugin loads, the UI and toolset transform into the corresponding pro-grade application. When not in use, it remains a general-purpose all-round agent.
- **One base unifies every vertical**: the ever-proliferating, never-unified vertical-agent landscape is solved by "one unified base + a plugin ecosystem" — domain capabilities are additive increments, not reinvented wheels.

Maintained by [badhope](https://github.com/X33834), mirrored across four platforms — [GitHub · X33834](https://github.com/X33834/OmniAgent) · [GitHub · Morningstar202604](https://github.com/Morningstar202604/OmniAgent) · [GitCode · badhope](https://gitcode.com/badhope/OmniAgent) · [Gitee · badhope](https://gitee.com/badhope/OmniAgent).

## Quick start

```sh
git clone https://github.com/X33834/OmniAgent.git
cd OmniAgent
pnpm install
pnpm run build
pnpm oa web
```

`pnpm run build` prepares the repository artifacts; `pnpm oa web` uses those built artifacts without rebuilding. The Web UI starts at `http://127.0.0.1:3080` by default. Pass `--no-open` to run the server without opening a browser.

### Try the official domain plugins

The Web sidebar **Plugins** page toggles the official bundles shipped with the installation (off by default) — enabling one injects that domain plugin into the current profile.

CLI one-shot (the matching profile templates ship built-in):

```bash
oa --profile finance "查一下贵州茅台的最新行情和估值"
oa --profile finance "筛选 A 股中 PE 低于 20 的公司"
oa --profile ecommerce "帮我给'无线蓝牙耳机'拓词，看下数码配件类目市场"
oa --profile ecommerce "分析这条评论：物流太慢了，包装都压坏了，客服还不回复"
```

> Domain plugins ship with built-in sample data by default (deterministic, verifiable, flagged). Switch to a real data service by setting the data source to `http` and configuring `baseURL` and `apiKeyEnv` per the plugin docs.

## Official domain plugins

| Plugin | Bundle | Tools | Profile | Coverage |
|---|---|---|---|---|
| Finance | `@deepseek-ai/dsh-finance` | 17 | `finance` | quotes, financials, valuation, screening, K-line, money flow, announcements, news, macro, sector, risk, fixed income, financial calculator, technical analysis, FX, rates |
| Ecommerce operations | `@deepseek-ai/dsh-ecommerce` | 8 | `ecommerce` | keyword expansion, title optimization, market insight, product evaluation, review analysis, price-band analysis, selling scripts, campaign planning |

More domain plugins keep shipping under the same pattern (see "Build a domain plugin" below).

## Where plugins come from

1. **Official bundles**: shipped with the installation, off by default, enabled in one click on the Web plugin page (`OPTIONAL_BUNDLES`).
2. **Install external plugins**: via the Web plugin page or `oa plugin --profile <p> add <spec>` — npm package / Git URL / tarball / local path.
3. **Write your own**: package it with the domain-plugin pattern (data contract + pure logic + tools + persona + bundle), publish, and anyone can install it.

## Development

`pnpm run dev:web` builds, serves, and rebuilds client bundles on source edits in one terminal; `make help` lists the matching Make targets for Web and Desktop.

## Build a domain plugin

A domain plugin = one agent plugin package + one profile bundle. Follow the two shipped examples:

```
packages/<domain>/<domain>-agent/        # the domain plugin package
  src/source.ts                          # data contract + data source (mock / http swappable)
  src/engine.ts                          # pure logic (deterministic, verifiable rules/calculations)
  src/tools.ts                           # defineTool model-callable tools
  src/index.ts                           # Cordis entry: persona injection + tool registration
  smoke.mjs                              # smoke tests for the source and pure logic
packages/bundle/<domain>/                # the profile bundle
  cordis.patch.yml                       # inserts the plugin row + default model route
  package.json                           # declares dsh.bundle.patch
```

Mount it in any profile:

```yaml
- id: <domain>-agent
  name: '@deepseek-ai/dsh-<domain>-agent'
  config:
    source: mock
```

Add the new bundle to `PROFILE_TEMPLATES` (CLI one-shot profile) and `OPTIONAL_BUNDLES` (official Web plugin page bundle) to ship it with the installation. Tools depend only on the data contract, decoupled from the concrete source; sample data must carry a `mock` flag and be disclosed to the user.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/X33834/OmniAgent/discussions).
- The same project is mirrored across four platforms — [GitHub · X33834](https://github.com/X33834) · [GitHub · Morningstar202604](https://github.com/Morningstar202604) · [GitCode · badhope](https://gitcode.com/badhope) · [Gitee · badhope](https://gitee.com/badhope).
- Blog: [CSDN](https://blog.csdn.net/weixin_56622231) · [Juejin](https://juejin.cn/user/2350111542479753).

## Citation

```bibtex
@misc{omniagent2026,
  title={OmniAgent: A Plugin-Based Universal Agent — Everything Is a Plugin},
  author={badhope},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/X33834/OmniAgent}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
