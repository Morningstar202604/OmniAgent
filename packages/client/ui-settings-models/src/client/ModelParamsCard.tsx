/**
 * Generation-parameter sliders rendered at the bottom of the Models settings
 * section through the `settings.models.footer` list slot. Two scalars only —
 * temperature and maxTokens — because the Host `GenerateOptions` sampling
 * vocabulary is exactly those two plus `stop` (top_p was dropped). Values are
 * clamped into range, snapped to the slider step, mirrored into a numeric box
 * for direct entry, and persisted to localStorage; a reset restores the
 * built-in defaults. The card carries its own state and writes, so the Models
 * section itself needs no change.
 */
import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import styles from './ModelParamsCard.module.css'
import {
  TEMPERATURE, MAX_TOKENS, defaultParams, loadParams, saveParams,
  normalizeTemperature, normalizeMaxTokens, formatTokens,
  type ModelGenerationParams,
} from './model-params.ts'

/**
 * Parse a numeric text-box entry, applying the row's own normalizer (which
 * clamps to range and snaps to step). Blank or non-numeric input is ignored so
 * a half-typed value never snaps the committed slider.
 * @param raw - the input's current string value.
 * @param normalize - the row's range/step normalizer.
 * @param apply - commit the normalized value.
 */
function commitNumber(raw: string, normalize: (value: number) => number, apply: (value: number) => void): void {
  if (raw.trim() === '') return
  const parsed = Number(raw)
  if (Number.isNaN(parsed)) return
  apply(normalize(parsed))
}

/** One labeled slider row: a numeric box and its range track, optional end labels. */
interface SliderRowProps {
  /** Row caption. */
  label: string
  /** Accessible name for the controls. */
  ariaLabel: string
  /** Current committed value. */
  value: number
  /** Inclusive lower bound. */
  min: number
  /** Inclusive upper bound. */
  max: number
  /** Range-track step. */
  step: number
  /** Numeric-box step. */
  numberStep: number
  /** Commit a (raw) value; the row normalizer already clamped/snapped it. */
  onValue: (next: number) => void
  /** Normalizer for direct numeric entry. */
  normalize: (value: number) => number
  /** Short right-side token label (maxTokens only). */
  tokenLabel?: string
  /** Optional low end label under the track. */
  scaleLow?: string
  /** Optional high end label under the track. */
  scaleHigh?: string
}

/**
 * Render one slider row.
 * @param props - the row's bounds, value, and copy.
 * @returns the row.
 */
function SliderRow(props: SliderRowProps) {
  const onRange = (event: ChangeEvent<HTMLInputElement>): void => {
    props.onValue(props.normalize(Number(event.target.value)))
  }
  return (
    <div className={styles['field']}>
      <div className={styles['fieldRow']}>
        <span className={styles['fieldLabel']}>{props.label}</span>
        <span className={styles['valueBox']}>
          <input
            className={styles['valueInput']}
            type="number"
            inputMode="decimal"
            min={props.min}
            max={props.max}
            step={props.numberStep}
            value={props.value}
            aria-label={props.ariaLabel}
            onChange={(event) => { commitNumber(event.target.value, props.normalize, props.onValue) }}
          />
          {props.tokenLabel === undefined
            ? null
            : <span className={styles['tokenHint']}>{props.tokenLabel}</span>}
        </span>
      </div>
      <input
        className={styles['slider']}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        aria-label={props.ariaLabel}
        onChange={onRange}
      />
      {props.scaleLow === undefined && props.scaleHigh === undefined
        ? null
        : (
          <div className={styles['scaleLabels']}>
            <span>{props.scaleLow}</span>
            <span>{props.scaleHigh}</span>
          </div>
        )}
    </div>
  )
}

/**
 * Render the generation-parameters card.
 * @param props - slot-delivered locale seat.
 * @returns the card.
 */
export function ModelParamsCard({ t }: PropsRuntime<'settings.models.footer'> & PropsLocale<'settings.models'>) {
  const [params, setParams] = useState<ModelGenerationParams>(loadParams)
  // Every committed value (slider drag, typed entry, reset) persists through
  // one effect; a write failure is non-fatal (see saveParams).
  useEffect(() => { saveParams(params) }, [params])

  const setTemperature = (next: number): void => {
    setParams(previous => ({ ...previous, temperature: normalizeTemperature(next) }))
  }
  const setMaxTokens = (next: number): void => {
    setParams(previous => ({ ...previous, maxTokens: normalizeMaxTokens(next) }))
  }
  const reset = (): void => { setParams(defaultParams()) }

  return (
    <div className={styles['card']}>
      <div className={styles['head']}>
        <span className={styles['cardTitle']}>{t('paramsTitle')}</span>
        <button type="button" className={styles['resetButton']} onClick={reset}>
          {t('paramsReset')}
        </button>
      </div>
      <p className={styles['cardIntro']}>{t('paramsIntro')}</p>
      <div className={styles['fields']}>
        <SliderRow
          label={t('paramsTemperature')}
          ariaLabel={t('paramsTemperature')}
          value={params.temperature}
          min={TEMPERATURE.min}
          max={TEMPERATURE.max}
          step={TEMPERATURE.step}
          numberStep={TEMPERATURE.step}
          onValue={setTemperature}
          normalize={normalizeTemperature}
          scaleLow={t('paramsTemperatureLow')}
          scaleHigh={t('paramsTemperatureHigh')}
        />
        <SliderRow
          label={t('paramsMaxTokens')}
          ariaLabel={t('paramsMaxTokens')}
          value={params.maxTokens}
          min={MAX_TOKENS.min}
          max={MAX_TOKENS.max}
          step={MAX_TOKENS.step}
          numberStep={MAX_TOKENS.step}
          onValue={setMaxTokens}
          normalize={normalizeMaxTokens}
          tokenLabel={formatTokens(params.maxTokens)}
        />
      </div>
      <p className={styles['appliedHint']}>{t('paramsAppliedHint')}</p>
    </div>
  )
}
