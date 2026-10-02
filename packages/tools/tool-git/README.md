# @deepseek-ai/dsh-tool-git

OmniAgent git tool kit: lets the agent perform local git operations proactively and in a controlled way when wrapping up tasks.

## Tools

| Tool | Description | Nature |
| --- | --- | --- |
| `git_status` | Current branch, staged / unstaged / untracked files | read-only |
| `git_diff` | Unstaged diff; `staged=true` shows the staged diff (numstat + truncated diff body) | read-only |
| `git_add` | Stage given paths; empty `paths` behaves like `git add -A` | write |
| `git_commit` | Commit staged content (`message` required; `addAll=true` stages everything first) | write |

## Implementation constraints

- Uses `node:child_process.execFileSync` to call system git directly — **no** third-party deps (simple-git / isomorphic-git).
- Working directory is fixed at `process.cwd()` (the agent workspace); other directories are not touched.
- **Never auto-pushes**; commit only writes local history.
- `git_commit` rejects empty messages and errors clearly on an empty index.

## Permission tiers (permission-rules integration)

Once registered, this package naturally joins the `tools/pre-execute` decision chain — **no bypassing**. Tool names share the `git_` prefix, so wildcard rules can govern the whole group:

- `git_status` / `git_diff`: read-only, allowed by default.
- `git_add` / `git_commit`: write operations; configuring `ask` or `deny` is recommended.

Example (permission-rules lines in `cordis.patch.yml`):

```yaml
- id: permission-rules
  name: '@deepseek-ai/dsh-permission-rules'
  config:
    preset: custom
    rules:
      - { pattern: 'git_*', level: 'allow' }   # allow by default
      - { pattern: 'git_commit', level: 'ask' } # commits need user approval
      - { pattern: 'git_add', level: 'ask' }
```

At runtime, `permission_set` can adjust dynamically.
