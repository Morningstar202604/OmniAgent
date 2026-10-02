# OmniAgent Changelog

OmniAgent follows the upstream [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) release line; upstream changelog entries are preserved in the repository history.

## v0.2.0-omniagent.1 (2026-10-01)

First branded release, based on upstream DeepSeek Harness `0.2.0-rc.2` (`639ed01`).

**Brand**
- Physical re-base onto the official latest (0.2.0-rc.2) with full ecosystem compatibility.
- Rebranded CLI (`oa`) and UI copy (26 locale strings), OmniAgent geometric mark logo, brand homepage, official CI suite.
- Branded bilingual README (build chain, upstream-following workflow, extension catalog, custom model sources).

**Extensions (first-party, 14 packages)**
- finance-agent / ecommerce-agent domain agents with UI workspaces and bundles.
- memory (cross-session memory on the official injection chain), report-export, tool-git, tool-notify.
- ui-status-bar, ui-session-history, subagent agent-team (experimental), plugin-template bundle.
- Removed 4 packages duplicating upstream (`tool-task`, `ui-command-palette`, `ui-plugin-market`, `permission-rules`).

**Model sources**
- Rides upstream `llm-pi-ai`; profile-patch example for an OpenAI-compatible `u2-flash` provider is documented in the README.

**Release**
- Published to gitcode (`badhope/OmniAgent`), gitee (`badhope/omniagent`), GitHub (`Morningstar202604/OmniAgent`, `X33834/OmniAgent`); upstream remote retained for `git merge` following.

_Upstream changes remain authoritative for anything not listed here; see the upstream repository for its own changelog._
