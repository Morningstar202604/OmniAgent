/**
 * 插件在线市场主页面：顶部搜索 + 分类标签 + 排序，精选横幅，插件卡片网格，
 * 点击卡片进入详情（功能、版本、作者、启用/停用、卸载）。安装状态保存在本地，
 * 操作后通过顶部 Toast 反馈并提示下次启动生效。
 */

import { useMemo, useState, type CSSProperties } from 'react'
import {
  Button, IconCheckCircleFillRegular, IconCloseOutlineRegular, IconDownloadOutlineRegular,
  IconSearchOutlineRegular, Input, Switch, Tag, Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginMarketKey } from './locales.ts'
import {
  CATEGORY_ORDER, CATALOG, filterCatalog, type CatalogEntry, type PluginCategory, type SortMode,
} from './catalog.ts'
import {
  installPlugin, loadInstallMap, setPluginEnabled, uninstallPlugin, type InstallMap,
} from './store.ts'
import css from './PluginMarketPage.module.css'

/** 完整组件 props：main 槽位运行时 + pluginMarket 字典。 */
export type PluginMarketPageProps = PropsRuntime<'main'> & PropsLocale<'pluginMarket'>

/** 分类 id → 字典 key。 */
const CATEGORY_KEY: Record<PluginCategory, PluginMarketKey> = {
  finance: 'catFinance',
  ecommerce: 'catEcommerce',
  programming: 'catProgramming',
  writing: 'catWriting',
  data: 'catData',
  tools: 'catTools',
}

/** 一条顶部 Toast。 */
interface Notice {
  readonly text: string
  readonly seq: number
}

/**
 * 渲染市场页。
 * @param props.t - pluginMarket 字典翻译函数。
 * @returns 市场页元素树。
 */
export function PluginMarketPage({ t }: PluginMarketPageProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<PluginCategory | 'all'>('all')
  const [sort, setSort] = useState<SortMode>('recommended')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [installMap, setInstallMap] = useState<InstallMap>(() => loadInstallMap())
  const [notice, setNotice] = useState<Notice | null>(null)

  const filtered = useMemo(
    () => filterCatalog(CATALOG, query, category, sort),
    [query, category, sort],
  )
  const featured = useMemo(() => CATALOG.filter(entry => entry.featured), [])
  const selected = useMemo(
    () => CATALOG.find(entry => entry.id === selectedId) ?? null,
    [selectedId],
  )

  /** 弹一条顶部反馈。 */
  const flash = (text: string): void => {
    setNotice({ text, seq: Date.now() })
  }

  /** 写状态并持久化。 */
  const commit = (next: InstallMap): void => {
    setInstallMap(next)
  }

  /** 安装：标记已安装并启用，提示重启。 */
  const handleInstall = (entry: CatalogEntry): void => {
    commit(installPlugin(installMap, entry.id))
    flash(t('installedRestart'))
  }

  /** 启用/停用切换。 */
  const handleToggle = (entry: CatalogEntry, enabled: boolean): void => {
    commit(setPluginEnabled(installMap, entry.id, enabled))
    flash(enabled ? t('enabledNotice') : t('disabledNotice'))
  }

  /** 卸载。 */
  const handleUninstall = (entry: CatalogEntry): void => {
    commit(uninstallPlugin(installMap, entry.id))
    flash(t('uninstalledNotice'))
  }

  const renderActionButton = (entry: CatalogEntry) => {
    if (entry.comingSoon) {
      return (
        <Button size="sm" variant="outline" disabled>
          {t('comingSoon')}
        </Button>
      )
    }
    const state = installMap[entry.id]
    if (state?.installed) {
      return (
        <Button
          size="sm"
          variant={state.enabled ? 'ghost' : 'primary'}
          icon={<IconCheckCircleFillRegular size={14} />}
          onClick={() => { handleToggle(entry, !state.enabled) }}
        >
          {state.enabled ? t('enabledBadge') : t('disabledBadge')}
        </Button>
      )
    }
    return (
      <Button
        size="sm"
        variant="primary"
        icon={<IconDownloadOutlineRegular size={14} />}
        onClick={() => { handleInstall(entry) }}
      >
        {t('install')}
      </Button>
    )
  }

  const renderCard = (entry: CatalogEntry) => {
    const state = installMap[entry.id]
    const installed = state?.installed === true
    return (
      <div key={entry.id} className={css.card} onClick={() => { setSelectedId(entry.id) }}>
        <div className={css.cardHead}>
          <span className={css.iconTile} style={{ '--hue': entry.hue } as CSSProperties}>
            <span className={css.iconGlyph}>{entry.icon}</span>
          </span>
          <div className={css.cardTitles}>
            <span className={css.cardName}>{entry.name}</span>
            <span className={css.cardMeta}>
              {t(entry.official ? 'officialTag' : 'communityTag')}
              <span className={css.dot}>·</span>
              {t('versionTag', { version: entry.version })}
            </span>
          </div>
        </div>
        <p className={css.cardDesc}>{entry.description}</p>
        <div className={css.cardFooter}>
          <span className={css.tagRow}>
            <Tag tone="outline">{t(CATEGORY_KEY[entry.category])}</Tag>
            {installed && <Tag tone="success">{t('installedBadge')}</Tag>}
            {entry.comingSoon && <Tag tone="warning">{t('comingSoon')}</Tag>}
          </span>
          <span onClick={(event) => { event.stopPropagation() }}>{renderActionButton(entry)}</span>
        </div>
      </div>
    )
  }

  // 详情视图：占据主列，带返回。
  if (selected !== null) {
    const state = installMap[selected.id]
    const installed = state?.installed === true
    return (
      <div className={css.root}>
        {notice !== null && (
          <Toast key={notice.seq} tone="success" text={notice.text} onDone={() => { setNotice(null) }} />
        )}
        <div className={css.detail}>
          <button type="button" className={css.back} onClick={() => { setSelectedId(null) }}>
            <IconCloseOutlineRegular size={14} />
            {t('backToMarket')}
          </button>
          <div className={css.detailHead}>
            <span className={css.iconTileLg} style={{ '--hue': selected.hue } as CSSProperties}>
              <span className={css.iconGlyphLg}>{selected.icon}</span>
            </span>
            <div className={css.detailTitles}>
              <h1 className={css.detailName}>{selected.name}</h1>
              <p className={css.detailMeta}>
                <Tag tone={selected.official ? "info" : "outline"}>
                  {t(selected.official ? 'officialTag' : 'communityTag')}
                </Tag>
                <span className={css.detailMetaText}>{selected.packageName}</span>
              </p>
            </div>
            <div className={css.detailAction}>{renderActionButton(selected)}</div>
          </div>
          <p className={css.detailDesc}>{selected.description}</p>
          <dl className={css.detailInfo}>
            <div><dt>{t('authorLabel')}</dt><dd>{selected.author}</dd></div>
            <div><dt>{t('versionTag', { version: selected.version })}</dt><dd>{selected.packageName}</dd></div>
            <div><dt>{t('categoryAll')}</dt><dd>{t(CATEGORY_KEY[selected.category])}</dd></div>
          </dl>
          <section className={css.section}>
            <h2 className={css.sectionTitle}>{t('featuresTitle')}</h2>
            <ul className={css.featureList}>
              {selected.features.map(feature => <li key={feature}>{feature}</li>)}
            </ul>
          </section>
          {selected.comingSoon
            ? <p className={css.comingSoonNote}>{t('comingSoonDesc')}</p>
            : (
              <div className={css.detailBottom}>
                {installed && (
                  <div className={css.switchRow}>
                    <Switch
                      checked={state?.enabled === true}
                      onChange={(next) => { handleToggle(selected, next) }}
                      label={t('enable')}
                    />
                    <span className={css.restartNote}>{t('restartNotice')}</span>
                  </div>
                )}
                {installed && (
                  <Button variant="ghost" onClick={() => { handleUninstall(selected) }}>
                    {t('uninstall')}
                  </Button>
                )}
              </div>
            )}
        </div>
      </div>
    )
  }

  return (
    <div className={css.root}>
      {notice !== null && (
        <Toast key={notice.seq} tone="success" text={notice.text} onDone={() => { setNotice(null) }} />
      )}
      <header className={css.header}>
        <h1 className={css.gradientTitle}>{t('title')}</h1>
        <p className={css.subtitle}>{t('subtitle')}</p>
      </header>

      <div className={css.toolbar}>
        <Input
          className={css.search ?? ''}
          icon={<IconSearchOutlineRegular size={15} />}
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <div className={css.sortRow}>
          {(['recommended', 'newest', 'installs'] as SortMode[]).map(mode => (
            <button
              key={mode}
              type="button"
              className={css.sortChip + (sort === mode ? ` ${css.sortChipActive}` : '')}
              onClick={() => { setSort(mode) }}
            >
              {t(mode === 'recommended' ? 'sortRecommended' : mode === 'newest' ? 'sortNewest' : 'sortInstalls')}
            </button>
          ))}
        </div>
      </div>

      <div className={css.categoryRow}>
        <button
          type="button"
          className={css.categoryChip + (category === 'all' ? ` ${css.categoryChipActive}` : '')}
          onClick={() => { setCategory('all') }}
        >
          {t('categoryAll')}
        </button>
        {CATEGORY_ORDER.map(id => (
          <button
            key={id}
            type="button"
            className={css.categoryChip + (category === id ? ` ${css.categoryChipActive}` : '')}
            onClick={() => { setCategory(id) }}
          >
            {t(CATEGORY_KEY[id])}
          </button>
        ))}
      </div>

      {featured.length > 0 && (
        <section className={css.featured}>
          <h2 className={css.sectionTitle}>{t('featuredTitle')}</h2>
          <div className={css.featuredGrid}>
            {featured.map(entry => (
              <button
                key={entry.id}
                type="button"
                className={css.featuredCard}
                style={{ '--hue': entry.hue } as CSSProperties}
                onClick={() => { setSelectedId(entry.id) }}
              >
                <span className={css.featuredIcon}>{entry.icon}</span>
                <span className={css.featuredBody}>
                  <span className={css.featuredName}>{entry.name}</span>
                  <span className={css.featuredDesc}>{entry.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0
        ? (
          <div className={css.empty}>
            <p className={css.emptyTitle}>{t('noResults')}</p>
            <p className={css.emptyHint}>{t('noResultsHint')}</p>
          </div>
        )
        : <div className={css.grid}>{filtered.map(renderCard)}</div>}
    </div>
  )
}
