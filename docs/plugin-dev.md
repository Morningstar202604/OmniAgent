# Plugin Development

English | [中文](plugin-dev.zh.md)

**OmniAgent** keeps the upstream DSH plugin model unchanged: everything is a plugin, composed at runtime by [Cordis](https://github.com/cordiverse/cordis).

## Add a package (plugin)

Follow the upstream cookbook — it is authoritative and bilingual:

- [Adding a package](cookbook/adding-a-package.md) (English)
- [Adding a package](cookbook/adding-a-package.md) (Chinese version available via the page's language switcher)

Key points:

- A plugin is a package mounted through a profile/bundle patch (`cordis.patch.yml`); see the [configuration catalog](config-catalog.md) and the [bundle template](../../packages/bundle/plugin-template/README.md) shipped with OmniAgent.
- Client-side UI packages register through the [capability seams](capability-seams.md); the [subsystems reference](subsystems/README.md) documents the generated Cordis API.
- Test and verify with the full build chain: `pnpm run build` then `pnpm oa web`.

## First-party examples

OmniAgent ships 14 first-party extension packages as reference implementations (finance-agent, ecommerce-agent, ui-status-bar, ui-session-history, agent-team, and more — see the [README](../README.md#omniagent-extensions)).

For upstream plugin ecosystem conventions, see the [plugin-dev topic](https://github.com/topics/dsh-plugin).
