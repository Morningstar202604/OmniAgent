> 本产品 **OmniAgent** 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）构建，兼容其生态。

# OmniAgent

English | [中文](README.zh.md)

OmniAgent (`oa`) is an open-source agent harness forked from [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH), keeping full ecosystem compatibility while shipping its own brand, extensions, and release line.

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

Brand repositories (mirrored):
- gitcode: [https://gitcode.com/badhope/OmniAgent](https://gitcode.com/badhope/OmniAgent)
- gitee: [https://gitee.com/badhope/omniagent](https://gitee.com/badhope/omniagent)
- GitHub: [https://github.com/Morningstar202604/OmniAgent](https://github.com/Morningstar202604/OmniAgent) · [https://github.com/X33834/OmniAgent](https://github.com/X33834/OmniAgent)
- Upstream: [https://github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)

## Developer preview

OmniAgent is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from the OmniAgent repository checkout:

```sh
git clone https://gitcode.com/badhope/OmniAgent.git
cd OmniAgent
pnpm install
pnpm run build
pnpm oa web
```

`pnpm run build` runs the full chain (lib host + client + native system + web) and prepares all repository artifacts. `pnpm oa web` uses those built artifacts without rebuilding.

> The `npx @deepseek-ai/dsh web` one-liner above runs the official upstream package; OmniAgent's own npm release will be published from this repository in a later milestone.

## Following upstream

The repository keeps the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) as its `origin` remote and tracks it with plain `git merge`, so every upstream feature and fix lands through the normal merge flow:

```sh
git remote add origin https://github.com/deepseek-ai/deepseek-harness.git   # already configured
git fetch origin
git merge origin/master
pnpm install && pnpm run build
```

The brand release line is published to the mirrored remotes (branch `main`):

```sh
git remote add brand  https://gitcode.com/badhope/OmniAgent.git                       # already configured
git remote add gitee  https://gitee.com/badhope/omniagent.git                         # already configured
git remote add github https://github.com/Morningstar202604/OmniAgent.git              # already configured
git remote add githubx https://github.com/X33834/OmniAgent.git                        # already configured
git push --no-verify --force brand gitee github githubx master:main
git push --no-verify brand gitee github githubx v0.2.0-omniagent.1                    # bump the tag per release
```

Brand adjustments (naming, UI copy, homepage, extensions) live on top of upstream commits and survive every merge; upstream changes may reshape parts of the UI, which is accepted in favor of staying current.

## Community and support

- Brand homepage: [https://gitcode.com/badhope/OmniAgent](https://gitcode.com/badhope/OmniAgent)
- Upstream feedback and bug reports: [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

`pnpm run dev:web` builds, serves, and rebuilds client bundles on source edits in one terminal, and `make help` lists the matching Make targets for Web and Desktop; the guide's application commands section owns the full table.

For agents, follow [AGENTS.md](AGENTS.md).

## OmniAgent extensions

The following first-party packages ship with the OmniAgent brand line (all official upstream packages remain unchanged and compatible):

| Package | Purpose |
| --- | --- |
| `packages/finance/finance-agent` | Finance-domain agent (quotes, fundamentals, market news) |
| `packages/ecommerce/ecommerce-agent` | E-commerce domain agent (listings, content, analytics) |
| `packages/client/ui-finance` | Finance workspace UI |
| `packages/bundle/finance` | Finance bundle (domain agent + UI) |
| `packages/bundle/ecommerce` | E-commerce bundle (domain agent + UI) |
| `packages/bundle/general-full` | General-purpose full bundle |
| `packages/bundle/plugin-template` | Plugin authoring template bundle |
| `packages/memory/memory` | Cross-session memory layer (rides official injection chain, `order=9500`) |
| `packages/report-export/report-export` | Report/artifact export |
| `packages/tools/tool-git` | Git tool for agents |
| `packages/tools/tool-notify` | Notification tool for agents |
| `packages/client/ui-status-bar` | Workspace status bar UI |
| `packages/client/ui-session-history` | Session history panel UI |
| `packages/subagent/agent-team` | Multi-agent team ("智能体团队", experimental) |

## Custom model sources

OmniAgent rides the official `llm-pi-ai` multi-provider adapter, so any OpenAI-compatible (or Anthropic) endpoint can be wired in via a profile patch. Example — a `u2-flash` model on an OpenAI-compatible gateway:

```yaml
# $DSH_HOME/profiles/<profile>/cordis.patch.yml
llm-pi-ai:
  providers:
    unisound-u2:
      api: openai-completions
      baseURL: https://maas-api.unisound.com/v1
      transport: sse
      apiKeyEnv: UNISOUND_API_KEY
  models:
    u2-flash: { provider: unisound-u2, model: u2-flash }
agent-default-model: { provider: unisound-u2, model: u2-flash }
```

Start the Web UI with `UNISOUND_API_KEY=<key> pnpm oa web`. The model picker in Settings additionally lists every configured provider.

## Citation

```bibtex
@misc{deepseek-harness2026,
  title={OmniAgent: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
