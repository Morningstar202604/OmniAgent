# OmniAgent

[English](README.md) | 中文

OmniAgent（`oa`）是一个**全自动科研 AI Agent**。给定一个科研目标，它会自主完成选题、文献检索、数据分析到成稿的完整科研闭环，全程无需人工逐步驱动。

由 [badhope](https://github.com/X33834) 维护，已在四个平台同步镜像：[GitHub · X33834](https://github.com/X33834/OmniAgent) · [GitHub · Morningstar202604](https://github.com/Morningstar202604/OmniAgent) · [GitCode · badhope](https://gitcode.com/badhope/OmniAgent) · [Gitee · badhope](https://gitee.com/badhope/OmniAgent)。

## 一切皆插件

底座是一个通用全能 Agent：不挂任何插件时，文件、执行、搜索、推理、工具链与 Web UI 全部可用。领域插件在此基础上扩展——挂上插件即获得该领域的专业工具与 persona，通用能力不受影响；插件可随时装卸，零代码改动。

以金融插件为例，它带来 17 个工具：行情、财务、估值指标、选股、金融计算器、技术指标、汇率、利率、K线、资金流、公告、资讯、宏观、板块、风险、固收、券商研报。

> 数据源默认内置示例数据（mock）。接入真实数据服务时把 `source` 改为 `http`，并配置 `baseURL` 与 `apiKeyEnv`。

## 运行

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
  title={OmniAgent: A Fully-Automated Research Agent},
  author={badhope},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/X33834/OmniAgent}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
