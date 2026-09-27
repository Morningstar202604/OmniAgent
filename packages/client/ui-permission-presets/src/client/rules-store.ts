/**
 * Controller backing the settings-page fine-grained rule editor. Reads the
 * engine state through the `permissionRules` Remote face and writes the full
 * rule list back with `setRules`. The editor holds an `enabled` flag per row
 * locally; only enabled rows are sent to the engine.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-store'
import type {
  PermissionLevel, PermissionRule, PermissionRulesState,
} from '@deepseek-ai/dsh-permission-rules/client'

/** One row in the editor, including the local enable toggle. */
export interface EditableRule extends PermissionRule {
  /** Stable local row key. */
  id: string
  /** Whether this row is active (sent to the engine when saving). */
  enabled: boolean
}

/** Editor snapshot consumed by the section component. */
export interface RulesEditorState {
  /** Lifecycle status. */
  status: 'loading' | 'ready' | 'saving' | 'error'
  /** Human-readable error, when any. */
  error: string | null
  /** Current rows being edited. */
  rules: EditableRule[]
  /** Current preset reported by the engine. */
  preset: string
  /** Built-in preset catalog for quick-apply. */
  presets: PermissionRulesState['presets']
}

let rowCounter = 0
/** Mint a stable local row id. */
function nextId(): string {
  rowCounter += 1
  return `rule-${Date.now()}-${rowCounter}`
}

/** Adapt a wire rule list into editable rows. */
function toEditable(rules: readonly PermissionRule[]): EditableRule[] {
  return rules.map(rule => ({ ...rule, id: nextId(), enabled: true }))
}

/** Read/write controller for the rule editor. */
export class RulesEditorController {
  /** Snapshot store bound by the renderer. */
  readonly store: SnapshotStore<RulesEditorState> = createSnapshotStore({
    status: 'loading',
    error: null,
    rules: [],
    preset: '',
    presets: [],
  })

  private disposed = false
  private saving = false

  /** @param ctx - client root context carrying the typed Remote. */
  constructor(private readonly ctx: ClientContext) {}

  /** Load the current engine state. */
  async load(): Promise<void> {
    if (this.disposed) return
    this.store.update(state => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const result = await this.ctx.remote.permissionRules.getState()
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      const { preset, rules, presets } = result.value
      this.store.update(state => {
        state.status = 'ready'
        state.error = null
        state.preset = preset
        state.presets = presets
        state.rules = toEditable(rules)
      })
    } catch (error) {
      this.store.update(state => {
        state.status = 'error'
        state.error = error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Replace the whole editable list and push the enabled subset to the engine.
   * @param rules - the new editable rows.
   */
  async save(rules: EditableRule[]): Promise<void> {
    if (this.disposed || this.saving) return
    this.saving = true
    this.store.update(state => {
      state.status = 'saving'
      state.error = null
      state.rules = rules
    })
    const active: PermissionRule[] = rules
      .filter(rule => rule.enabled)
      .map(rule => ({ pattern: rule.pattern, level: rule.level }))
    try {
      const result = await this.ctx.remote.permissionRules.setRules(active)
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
      const value = result.value
      this.store.update(state => {
        state.status = 'ready'
        state.error = null
        state.preset = value.preset
        state.rules = toEditable(value.rules)
      })
    } catch (error) {
      this.store.update(state => {
        state.status = 'error'
        state.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.saving = false
    }
  }

  /** Stop the controller. */
  dispose(): void {
    this.disposed = true
  }
}

/** Re-export for the component's dropdown. */
export type { PermissionLevel }
