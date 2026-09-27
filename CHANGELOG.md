# 更新日志（CHANGELOG）

本仓库自 `9bfa886` 初始化以来的功能演进，按阶段组织。所有提交日期均集中在 2026-09-26 ~ 2026-09-27，故按提交先后排序。

---

## 1. 跑通与定位

以本仓库为唯一代码基线初始化，清理上游无关工具链，确立产品定位。

- `9bfa886` 以本仓库为唯一代码基线初始化
- `33e3b12` 修正项目定位、清理无用的上游 CI/CD
- `04a6b27` 删除全部 CI/CD 与本地钩子
- `653d41c` 统一为 OmniAgent 星夜金品牌视觉
- `c8ca354` 删除 `.github` 剩余流程文件
- `83e5632` 砍掉上游校验门禁/发布/翻译/文档/基准工具链与整套测试
- `91bdd6e` / `b36e472` / `550da41` / `caa9499` / `3caac72` 多轮清理 `package.json` 断引用与脚本清单
- `0d8e977` 补齐收尾（非 ASCII 快照、`run-web-snapshots`、`test:web:ci`）
- `9a3793b` 清理 `scripts/` 下孤儿辅助模块

## 2. 插件链：电商插件、官方插件接入、Agnes overlay

落地「万物皆可插件」定位，接入官方领域插件并新增电商运营插件。

- `6d4c987` 万物皆可插件定位落地——官方领域插件接入、新增电商运营插件、修正项目定位与存量构建
- `c05daa9` 新增 Agnes AI（OpenAI 兼容）接入示例 overlay（`config/agnes-ai.patch.yml`）

## 3. 通用增强组合包 dsh-general-full

把 2026 通用 Agent 基础设施一次性补齐，默认挂载、惰性运行。

- `f9376fa` 新增通用增强组合包 `dsh-general-full`：LSP 语言服务器缝 / 定时任务调度 / 产物交付 / 工作区变更追踪 / computer-use 与 browser-use 自动化注册表

## 4. 前端品牌化

Web 界面品牌化、特色区域与全局命令面板。

- `117e1f0` OmniAgent 前端品牌化与特色区域（Hero / 能力卡 / 欢迎区）
- `c640cd7` 前端美学升级 + 全局命令面板

## 5. 对标补齐

前后端对标差距集中补齐：状态栏、会话历史、金融面板、插件市场、权限规则、长期记忆、回测量化、报告导出、任务队列、多智能体。

- `a354be7` 新增顶部状态栏（模型/会话/token/连接状态）
- `24bcd04` 新增会话历史面板（按时间分组）
- `5a745c4` web 端注册状态栏与会话历史浏览器名册
- `26bf76e` 新增细粒度工具权限规则包 `permission-rules`
- `1bda007` 新增长期记忆/知识库包 `memory`
- `67fc6fe` 接入 permission-rules 与 memory 到构建图与 base bundle
- `307c36c` 新增插件在线市场 UI
- `ca95872` 新增金融专业面板 client 包 `ui-finance`
- `06ba78f` 金融组合包挂载 `ui-finance` 面板，finance profile 切换 Web 终端
- `dc2d8ca` 新增选股回测引擎与自然语言转量化代码
- `875d1ac` 新增报告导出插件 `report_export`
- `6e9acc2` 新增后台任务工具 `task_run/status/list/cancel`
- `337f619` 新增多智能体团队编排工具 `agent_team_run`
- `0802920` 补齐 base/finance 组合包对新插件的 dependencies 声明
- `ef71922` 修复 permission-rules 与 memory 插件运行时加载失败（inject 声明 + bundle 依赖）
- `bd7a569` / `ca78105` / `8ff915d` lockfile 更新与对标/P0 完成记录

## 6. 后续路线

按对标报告后续路线逐项落地：token 真实统计、PDF 真实渲染、BM25 语义检索、移动端响应式、DAG 编排、向量 hybrid、PDF 复杂排版、git 工具、OS 通知、模型参数滑杆、会话分支时间线。

**记忆与语义检索**
- `e8fc706` 中文 bigram 分词器与中英文停用词表
- `38ffa48` 纯 TypeScript BM25 倒排索引
- `67e91ec` 记忆/知识库检索由 LIKE 升级为 BM25 打分
- `73c1ff3` 向量召回打分模块与 BM25 词项视图
- `cff7e4a` 可插拔 embedding 提供方接口与两种实现（本地 TF / OpenAI 兼容）
- `4d171aa` 存储层接入 BM25+向量 hybrid 检索
- `dc9857a` 插件新增 embedding 配置项（工具签名兼容）
- `ad48073` hybrid 召回 headless 验证脚本

**移动端响应式（768px / 480px 断点）**
- `ca98235` 窄屏隐藏拖拽手柄、禁横向溢出
- `43f1ce5` / `5690b29` / `25ede51` / `63d6c94` / `65065bc` / `2edd7a5` 状态栏 / Hero / 历史列表 / 插件市场 / 命令面板 / 金融面板窄屏适配

**PDF 真实渲染与复杂排版**
- `f6b86ba` 引入 pdfkit/fontkit
- `f6b30d4` 新增 `markdownToPdf`（pdfkit 真实 PDF）
- `9a0c09e` `report_export` 的 pdf 格式输出真实 `.pdf`
- `12d7701` Markdown 图片嵌入渲染（本地/远程 URL，失败占位降级）
- `a80bc0e` `<!-- chart:bar|line -->` 矢量柱状图/折线图

**状态栏 / 多智能体 / 设置 / 通知 / git / 时间线**
- `e3a47af` / `3e58bb6` 状态栏 token 接入真实会话用量
- `faf5101` `agent_team_run` 升级为 DAG 依赖编排与角色间消息传递
- `f057742` / `066832f` / `53322a9` 模型参数滑杆（temperature / maxTokens，localStorage 持久化）
- `409cbfe` / `383cae7` OS 级通知工具包 `tool-notify` 并接入 base bundle
- `20840aa` / `a890e0e` 会话分支时间线视图 + 列表/时间线切换
- `46e2f5c` / `068c8e1` git 工具包（status/diff/add/commit，绝不 push）接入 base
- `57d9bad` / `5b00d18` / `9c6a9b5` 对标报告多轮更新与 DAG 真实模型验证状态

## 7. 代码审计优化

基于 `docs/code-audit.md` 实施收敛与安全加固。

- `07e5b3f` 新增全仓代码审计报告（重复造轮子与可优化点）
- `acc2670` 移除 20 个包未使用 zod → `88baead` 回滚（typert 运行时仍依赖）
- `6848acb` 移除 apps/cli 未使用的 js-yaml
- `8cb74ec` typecheck/lint 脚本统一使用 pnpm run
- `965cb5b` pnpm dedupe 收敛传递依赖多版本
- `ce48807` `writeFileAtomic` 新增 fsync 选项
- `21c38af` storage-json 复用 `dsh-atomic-write`
- `c7c102a` / `da6921d` lockfile 与 tsconfig 引用补齐
- `88946e4` / `8fb30c8` / `0129703` host / client / experimental 本地 `assertNever` 收敛到 `dsh-util-values`
- `ee52e5a` markdown 渲染 XSS 防护评估报告与回归测试
- `e09840a` 审计路线图 4 项优化全部实施并验证
- `d37aa53` 新增 rebrand 脚本别名

## 8. 本轮收尾

消息操作、Web 端通知、embedding 端点验证、金融面板补齐、性能优化、代码块交互。

- `6c11f8e` 会话历史列表行 memo 化并稳定回调
- `71c0a9d` 会话历史窗口化虚拟滚动（仅渲染可视窗口 + overscan）
- `51ccc70` 会话大列表 500 条优化前后实测数据归档
- `6f24555` 消息操作栏新增导出为 Markdown 下载
- `8540b21` 用户消息支持编辑后 fork 截断重生成
- `fe39404` embedding 端点探测与国产替代接入形态验证脚本
- `8ed580c` 记录 embedding 配置、Agnes 不支持结论与国产端点接入形态
- `1772f71` 选股工具支持 PE/PB/ROE/涨跌幅多因子确定性筛选
- `e9c2f6c` 新增选股器面板（多条件筛选 + 可复核结果表格）
- `6418cd9` 行情条定时轮询刷新与产业链图谱可视化
- `bfd642a` / `160b08a` 代码块工具栏「新标签打开」按钮与中英文案
- `c8de9ff` 内嵌代码编辑器三方案评估与轻量实现报告
- `5e052e8` 新增 Web 端浏览器通知客户端半边
- `c655208` Web 通知接入 client bundle 构建与注册
- `3532ba5` 归档 Web 通知浏览器实测截图

---

> 仍在路线上、尚未完成：真 embedding 端点端到端验证（需 API key）、消息级 fork 的后端完善、内嵌代码 diff 编辑器的落地实现。
