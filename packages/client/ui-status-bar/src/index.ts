/**
 * OmniAgent 顶部状态栏，host 半边。纯 UI 插件：空 apply 使插件出现在 host
 * cordis.yml / Loader 中；browser 半边经 package.json exports["./client"] 提供。
 */

/** Host plugin body — no host-side behavior. */
export function apply(): void {}
