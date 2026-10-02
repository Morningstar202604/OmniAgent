# Usage Guide

English | [中文](usage-guide.zh.md)

This is the entry point for using **OmniAgent** (`oa`).

## Start the Web UI

From a repository checkout:

```sh
pnpm install
pnpm run build
pnpm oa web
```

The Web UI starts at `http://127.0.0.1:3080` by default and opens in your browser; pass `--no-open` to skip that. See the [Web UI guide](user/guide/index.md) for the full product walkthrough (sessions, plugins, automation, history, workspace, settings).

## Connect a custom model

Any OpenAI-compatible (or Anthropic) endpoint rides the upstream `llm-pi-ai` adapter via a profile patch; the `u2-flash` example lives in the [README](../README.md#custom-model-sources).

## Brand repositories

- gitcode: https://gitcode.com/badhope/OmniAgent
- gitee: https://gitee.com/badhope/omniagent
- GitHub: https://github.com/Morningstar202604/OmniAgent · https://github.com/X33834/OmniAgent
