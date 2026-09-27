/**
 * Generation-parameter sliders (temperature / maxTokens) for the Models
 * settings page. The Host `GenerateOptions` sampling vocabulary is
 * temperature / maxTokens / stop only — top_p was dropped as an inert knob —
 * so this surface exposes exactly those two scalars and nothing else.
 *
 * There is no client-side runtime API to rewrite a live Agent's request
 * header: the Host builds `LlmCallConfig` per step and the adapter owns the
 * effective maxTokens default. These values therefore persist in the
 * browser's localStorage only and are surfaced to the user as "applies to the
 * next new conversation"; wiring them into the Host request waterfall would
 * require Host changes outside this client package.
 *
 * @module dsh-client-ui-settings-models/model-params
 */

/** The two persisted generation scalars. */
export interface ModelGenerationParams {
  /** Sampling temperature, clamped to {@link TEMPERATURE}. */
  temperature: number
  /** Upper bound on generated tokens, clamped to {@link MAX_TOKENS}. */
  maxTokens: number
}

/** Temperature slider bounds and step (°C-free: 0.0–2.0, 0.1 steps). */
export const TEMPERATURE = {
  min: 0,
  max: 2,
  step: 0.1,
  defaultValue: 0.7,
} as const

/**
 * maxTokens slider bounds and step. The effective default an adapter applies
 * when the caller omits the field is adapter-owned and not readable from the
 * browser; 4096 is the sensible middle used until a Host default surface
 * exists.
 */
export const MAX_TOKENS = {
  min: 128,
  max: 32768,
  step: 128,
  defaultValue: 4096,
} as const

/** localStorage key holding the user's custom scalars. */
const STORAGE_KEY = 'dsh:model-generation-params:v1'

/** Clamp `value` into the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Nearest `step` multiple, then clamped to the range. */
function snapStep(value: number, min: number, max: number, step: number): number {
  return clamp(Math.round(value / step) * step, min, max)
}

/**
 * Normalize a raw temperature: clamp to [0, 2] and snap to 0.1 steps while
 * killing the 0.30000000004 floating-point residue.
 * @param value - the raw numeric input.
 * @returns a valid temperature.
 */
export function normalizeTemperature(value: number): number {
  return Math.round(clamp(value, TEMPERATURE.min, TEMPERATURE.max) * 10) / 10
}

/**
 * Normalize a raw maxTokens: clamp to [128, 32768] and snap to 128 steps.
 * @param value - the raw numeric input.
 * @returns a valid maxTokens.
 */
export function normalizeMaxTokens(value: number): number {
  return snapStep(value, MAX_TOKENS.min, MAX_TOKENS.max, MAX_TOKENS.step)
}

/** The built-in defaults, detached so callers never mutate the constants. */
export function defaultParams(): ModelGenerationParams {
  return { temperature: TEMPERATURE.defaultValue, maxTokens: MAX_TOKENS.defaultValue }
}

/**
 * Read the persisted scalars, tolerating a missing, corrupt, or out-of-range
 * document by clamping each field into range (or falling back to the default).
 * @returns the stored or default parameters.
 */
export function loadParams(): ModelGenerationParams {
  const fallback = defaultParams()
  let raw: string | null = null
  try {
    raw = globalThis.localStorage.getItem(STORAGE_KEY) ?? null
  } catch {
    return fallback
  }
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(raw) as Partial<ModelGenerationParams>
    return {
      temperature: normalizeTemperature(parsed.temperature ?? fallback.temperature),
      maxTokens: normalizeMaxTokens(parsed.maxTokens ?? fallback.maxTokens),
    }
  } catch {
    return fallback
  }
}

/**
 * Persist the scalars. A write failure (private mode, quota) is non-fatal:
 * the UI keeps its in-memory values.
 * @param params - the scalars to store.
 */
export function saveParams(params: ModelGenerationParams): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    /* persistence is best-effort; the in-memory values still drive the UI */
  }
}

/**
 * Compact human label for a token count: 4096 → "4k", 32768 → "32k", small
 * counts stay raw (128 → "128").
 * @param value - the token count.
 * @returns the short label.
 */
export function formatTokens(value: number): string {
  if (value < 1024) return String(value)
  const k = value / 1024
  // Trim a trailing ".0" so whole thousands read "4k" not "4.0k".
  return `${Number(k.toFixed(1))}k`
}
