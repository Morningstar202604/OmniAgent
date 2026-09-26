# OmniAgent

[English](README.md) | 中文

OmniAgent（`oa`）是由 [badhope](https://github.com/X33834) 维护的开源 agent harness（智能体框架），已在四个平台同步镜像：[GitHub · X33834](https://github.com/X33834/OmniAgent) · [GitHub · Morningstar202604](https://github.com/Morningstar202604/OmniAgent) · [GitCode · badhope](https://gitcode.com/badhope/OmniAgent) · [Gitee · badhope](https://gitee.com/badhope/OmniAgent)。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动。

## 开发者预览

OmniAgent 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

<a id="run"></a>

## 运行

克隆仓库后从源码运行：

```sh
git clone https://github.com/X33834/OmniAgent.git
cd OmniAgent
pnpm install
pnpm run build
pnpm oa web
```

`pnpm run build` 会准备仓库产物。`pnpm oa web` 会直接使用这些已构建产物，不会重新构建。

Web UI 默认在 `http://127.0.0.1:3080` 启动，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/X33834/OmniAgent/discussions) 提交反馈或 bug 报告。
- 同一项目在四个平台同步镜像：[GitHub · X33834](https://github.com/X33834) · [GitHub · Morningstar202604](https://github.com/Morningstar202604) · [GitCode · badhope](https://gitcode.com/badhope) · [Gitee · badhope](https://gitee.com/badhope)。
- 博客：[CSDN](https://blog.csdn.net/weixin_56622231) · [掘金](https://juejin.cn/user/2350111542479753)。

## 开发

`pnpm run dev:web` 会在一个终端里完成构建、启动，并在源码修改时重建 client bundle；`make help` 列出 Web 与 Desktop 对应的 Make target。

## 引用

```bibtex
@misc{omniagent2026,
  title={OmniAgent: Everything is a Plugin},
  author={badhope},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/X33834/OmniAgent}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
