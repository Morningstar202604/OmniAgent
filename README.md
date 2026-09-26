# OmniAgent

English | [中文](README.zh.md)

OmniAgent (`oa`) is an open-source agent harness maintained by [badhope](https://github.com/X33834). It is mirrored across four platforms — [GitHub · X33834](https://github.com/X33834/OmniAgent) · [GitHub · Morningstar202604](https://github.com/Morningstar202604/OmniAgent) · [GitCode · badhope](https://gitcode.com/badhope/OmniAgent) · [Gitee · badhope](https://gitee.com/badhope/OmniAgent).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis).

## Developer preview

OmniAgent is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

Clone the repository and run from source:

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
  title={OmniAgent: Everything is a Plugin},
  author={badhope},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/X33834/OmniAgent}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
