# OmniAgent

English | [中文](README.zh.md)

OmniAgent (`oa`) is a **fully-automated research agent**. Given a research goal, it carries the work through topic selection, literature retrieval, data analysis, and writing the final draft — the whole research loop, end to end.

It is maintained by [badhope](https://github.com/X33834) and mirrored across four platforms — [GitHub · X33834](https://github.com/X33834/OmniAgent) · [GitHub · Morningstar202604](https://github.com/Morningstar202604/OmniAgent) · [GitCode · badhope](https://gitcode.com/badhope/OmniAgent) · [Gitee · badhope](https://gitee.com/badhope/OmniAgent).

## Everything is a plugin

The base is a general-purpose agent: files, execution, search, reasoning, toolchain and Web UI all work with no plugin attached. Domain plugins then extend it — attaching a plugin adds that field's professional tools and persona without weakening the general capabilities, and plugins can be attached or detached at any time with no code changes.

The finance plugin, for example, adds 17 tools: quotes, financials, valuation metrics, screening, a financial calculator, technical indicators, FX, rates, K-line, money flow, announcements, news, macro, sector, risk, fixed income and broker research.

> Data sources ship with built-in sample data by default. Switch to a real data service by setting `source: http` plus `baseURL` and `apiKeyEnv`.

## Run

```sh
git clone https://github.com/X33834/OmniAgent.git
cd OmniAgent
pnpm install
pnpm run build
pnpm oa web
```

`pnpm run build` prepares the repository artifacts. `pnpm oa web` uses those built artifacts without rebuilding.

The Web UI starts at `http://127.0.0.1:3080` by default and opens in the default browser for a local launch. An SSH launch only prints the host URL, because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/X33834/OmniAgent/discussions).
- The same project is mirrored across four platforms — [GitHub · X33834](https://github.com/X33834) · [GitHub · Morningstar202604](https://github.com/Morningstar202604) · [GitCode · badhope](https://gitcode.com/badhope) · [Gitee · badhope](https://gitee.com/badhope).
- Blog: [CSDN](https://blog.csdn.net/weixin_56622231) · [Juejin](https://juejin.cn/user/2350111542479753).

## Development

`pnpm run dev:web` builds, serves, and rebuilds client bundles on source edits in one terminal; `make help` lists the matching Make targets for Web and Desktop.

## Citation

```bibtex
@misc{omniagent2026,
  title={OmniAgent: A Fully-Automated Research Agent},
  author={badhope},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/X33834/OmniAgent}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
