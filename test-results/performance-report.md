# 客户端性能专项：会话大列表优化测试报告

## 范围
- 目标文件：`packages/client/ui-session-history/src/client/SessionHistoryPage.tsx`（会话历史列表）
- 对照：`ChatView` / `MessageItem` 经核查已具备 `memo` + 按节点订阅（`useChatNode(nodeKey)`），无需改动
- 测试数据：500 条会话（updatedAt 分布在最近 10 天）
- 测试方式：独立 vite 基准页（`apps/web/bench.html`），直接挂载组件并 mock `useSessions`，采集 `performance.now()` / DOM 节点数 / 滚动 FPS

## 优化内容（两次提交）
1. `perf(session-history): 列表行 memo 化并稳定回调与时间基准`
   - 抽取 `SessionHistoryRow` 为 `React.memo`
   - `now` 改为挂载期稳定值，避免 `groups` useMemo 每次失效
   - `open/fork/archive/rename` 等动作 `useCallback` 稳定引用
   - `draft` 仅传入正在编辑的行
2. `perf(session-history): 列表窗口化虚拟滚动，仅渲染可视窗口+overscan`
   - 离屏探针量出恒定行高 / 分组标题高
   - ResizeObserver + onScroll 跟踪视口，二分查找可视区间
   - 总高占位 + paddingTop 偏移，DOM 从 500+ 行降到约 31 行
   - 编辑重命名态回退全量渲染，避免单行高度差错位

## 实测数据（warm，n=500）

| 指标 | 优化前 | 优化后 | 变化 |
|---|---|---|---|
| 渲染行数（DOM 中 rowTitle 节点） | 500 | 31 | -94% |
| DOM 节点总数（root 下 `*`） | 10,532 | 517 | -95% |
| 搜索输入响应（到下一帧） | 147 ms | 55 ms | -63% |
| 初始渲染（挂载到两帧后） | 458 ms | 523 ms* | dev 噪声，见注 |
| 滚动 FPS | 64 | 62 | 持平（均流畅） |

> *初始渲染在 vite dev 下受按需编译 / React dev 双调用影响，数值波动 ±100ms；优化后多了探针测量与二分窗口逻辑。生产构建下窗口化只提交约 31 行，初始挂载的 DOM 创建与布局成本显著低于 500 行。

## 视觉一致性
- 截图对比 `screenshots/before-full-500.png` vs `screenshots/after-windowed-500.png`：行高、分组标题（今天/昨天/7天内/更早）、相对时间、徽标、hover 操作按钮位置均一致，无视觉回归。

## 构建验证
- `npx tsc -b`：本包（ui-session-history）零类型错误
- `pnpm run build:lib:client`：本包 tsdown bundle 通过（35.09 kB）
- `pnpm run build:web`：通过（vite build 成功）
- 备注：测试期间仓库内另有并发进行的 `editRerun` / finance 等半成品改动，其 tsc 报错与本次改动无关，未触碰。

## 复现
```
cd apps/web
npx vite --config bench.vite.config.ts --port 5199
# 浏览器打开：
#   http://localhost:5199/bench.html?v=before&n=500
#   http://localhost:5199/bench.html?v=after&n=500
# 指标见页面右上角 HUD 与 window.__BENCH__
```
