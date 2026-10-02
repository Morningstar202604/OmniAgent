# dsh-plugin-template · Minimal vertical plugin template

English | [中文](README.zh.md)

> Copy this directory → rename it → write your own tools: a new vertical-domain plugin in 5 minutes.
> Background and rules: [`docs/plugin-dev.md`](../../../docs/plugin-dev.md).

This package is a **self-contained** minimal vertical plugin: one directory holding the host half (tools + system prompt) and the client half (UI slot registration), plus a `cordis.patch.yml` that inserts it into the boot tree. It is `private: true` and is **not** loaded by any default profile — it exists purely as a copy starting point.

## Layout

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

Where each half runs:

| Half | File | Runtime | Job |
|---|---|---|---|
| host | `src/index.ts` | Node | `defineTool` registers tools, `systemPrompt.section` injects the persona |
| client | `src/client/index.ts` | Browser | `slots.inject('shell.statusbar', …)` registers a UI slot |

## Five steps to your plugin

### 1. Copy and rename

```bash
cp -r packages/bundle/plugin-template packages/bundle/my-domain
cd packages/bundle/my-domain
```

Globally replace the package name `@deepseek-ai/dsh-plugin-template` with yours, e.g. `@deepseek-ai/dsh-my-domain` (the `name` in `package.json`, the first argument of `tsdown.config.ts`, and the `name` field in `cordis.patch.yml`). Also change `id: plugin-template` to `my-domain` in `cordis.patch.yml`.

### 2. Write your own tools

Open `src/index.ts`:
- Change `name = 'plugin-template'`, `Config`, and `TEMPLATE_PERSONA` to your domain;
- Remove `template_hello` and write your tools with `defineTool({...})` following its shape;
- For write operations, add `permission-rules` in `cordis.patch.yml` per the comment at the end of the file.

### 3. (Optional) Change the UI slot

`src/client/index.ts` currently registers a small "template plugin loaded" marker in the top bar.
For a full-screen professional panel, switch the slot to `main` (the central conversation area) — see `packages/client/ui-finance`;
to add controls in the sidebar/bottom bar, pick another slot — see `packages/client/ui-status-bar`.

### 4. Hook into PROFILE_TEMPLATES

Open `packages/boot/app-boot/src/profile.ts` and add an entry to `PROFILE_TEMPLATES`:

```ts
myDomain: {
  bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-general-full', '@deepseek-ai/dsh-my-domain', '@deepseek-ai/dsh-web-app'],
},
```

Convention: the first bundle is always `@deepseek-ai/dsh-base`; add `dsh-general-full` for general enhancements; `dsh-web-app` at the end is the Web form (use `dsh-headless` for headless); your domain bundle goes in between.

### 5. Build and verify

```bash
npx tsc -b                 # typecheck (host + client)
pnpm run build:lib:host    # emit the Node half lib/index.js
pnpm run build:lib:client  # emit the browser half lib/client.js
pnpm oa --profile myDomain --dump-config   # print the boot tree, confirm your plugin appears
pnpm oa --profile myDomain --no-open       # actually boot and verify
```

## Notes

- This package is `private: true` and is not in `OPTIONAL_BUNDLES` / any shipped profile — the default `web` profile does **not** expose the sample tool `template_hello`.
- After copying, add the new package to the `references` of `tsconfig.host.json` and `tsconfig.client.json` (otherwise `tsc -b` will not compile it).
- Do not leave the copied domain package in the default `web` profile, or your panel will pollute the general UI.
