/**
 * Client-facing types for the fine-grained permission-rules host service.
 * Re-exported through `./client` so browser code imports only this namespace.
 *
 * @module @deepseek-ai/dsh-permission-rules/types
 */

import type { PermissionLevel, PermissionRule } from './rules.ts'

export type { PermissionLevel, PermissionRule }

/** One built-in preset advertised to the settings UI. */
export interface PermissionRulesPresetInfo {
  /** Preset key. */
  name: string
  /** Chinese display label. */
  label: string
  /** One-line Chinese description. */
  description: string
}

/**
 * Snapshot of the whole rules engine state, returned by the Remote read and
 * after every write. The settings editor renders directly from this object.
 */
export interface PermissionRulesState {
  /** Currently active preset key (normal / full-auto / strict / custom). */
  preset: string
  /** Fallback level when no rule matches a tool. */
  fallback: PermissionLevel
  /** Effective custom rules (preset rules merged with user rules). */
  rules: PermissionRule[]
  /** Built-in preset catalog. */
  presets: PermissionRulesPresetInfo[]
}
