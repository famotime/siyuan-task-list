# 重构计划：siyuan-task-list 代码模块分析与重构

## 1. 项目快照

- 生成日期：2026-11-03
- 范围：`siyuan-task-list` 全仓库（重点关注 `src/` 核心领域层与控制层）
- 目标：建立自动化测试基础设施（Vitest），解除无 DOM 环境依赖，解耦核心领域数据流（标题祖先解析、树形聚合排序、SQL 与排除路径转译），消除组件间重复逻辑，拆解超大组件 `ScopeBar.vue`，提高代码可测性与可维护性。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`README_zh_CN.md`、`AGENTS.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与生命周期 | `src/index.ts`<br>`src/main.ts` | 插件生命周期（`onload`/`onDataChanged`/`onunload`）、Dock 挂载、配置加载校验与存储、思源原生设置项弹窗。 | `applySavedConfig` 配置校验与边界约束逻辑内嵌于主类中；配置与 `types.ts` 耦合；缺乏配置校验的独立测试。 | 0%（无自动化测试） |
| 内核 API 交互 | `src/api.ts` | 封装思源内核 API（Notebook、Block、Outline、SQL、Notification）。 | `request` 与 `sqlWithMeta` 错误处理策略不统一（吞错返回 null vs 抛出异常）；缺少 mock 接口以支持独立测试。 | 0%（无测试） |
| 领域状态与类型 | `src/data/types.ts`<br>`src/data/status.ts` | 定义任务项、标题节点、分组、汇总范围等核心类型；解析 Markdown 中的任务标记与完成判定。 | `StatusFilter` 在 `types.ts` 与 `tasks.ts` 重复定义；纯函数解析逻辑未建立基准单元测试。 | 0%（无测试） |
| 任务源顺序解析 | `src/data/order.ts` | 调用 `getDocBlocksOrders` 批量获取文档块绝对先序，降级调用 `getBlockKramdowns` 正则解析 IAL。 | 正则全局标识符 `/g` 状态重置需谨慎；I/O 与排序计算未解耦。 | 0%（无测试） |
| 标题归属解析 | `src/data/heading.ts` | 沿 `parent_id` 链自底向上批量回溯标题祖先链，结合 `getDocOutline` 校正同级标题顺序。 | **强依赖浏览器 DOM**（`stripHtml` 直接调用 `document.createElement("div")`），导致在 Node/Vitest 无 DOM 纯测试环境下抛出异常；树拓扑计算与 SQL I/O 混杂。 | 0%（无测试） |
| 范围与 SQL 构建 | `src/data/scope.ts` | 把 `ScopeSelection` 转换为针对 `blocks` 表的 SQL 查询；解析与规范化排除路径（多笔记本/单笔记本补全）；出链文档解析。 | `parseExcludePath` 与 `normalizeExcludePaths` 逻辑分支多但零测试；SQL 拼接复杂度高；`TaskRow` 接口定义分散。 | 0%（无测试） |
| 任务汇集与分组树 | `src/data/tasks.ts` | 汇集任务全流程编排；搜索与状态过滤；组装局部任务树与未完成优先排序 (`buildAndSortTaskTree`)；组装多级分组树 (`buildTaskGroups`，处理跨级标题上浮与空组剪枝)。 | 超过 500 行，核心树形算法极其复杂，闭包深，是全插件核心资产，但无任何自动化测试守护，极易引入静默回归。 | 0%（无测试） |
| 主应用与控制层 | `src/App.vue` | 协调状态（范围、筛选、折叠、收藏、设置）、WebSocket 监听防抖刷新、任务勾选乐观更新与 6 秒回滚保护、跨文档跳转与闪烁高亮。 | 超过 530 行；常用收藏匹配比较（`matchesCurrentState`/`arraysEqual`）与 `ScopeBar.vue` 完全重复；折叠递归遍历存在重复逻辑。 | 0%（无测试） |
| 汇总范围控制栏 | `src/components/task-panel/ScopeBar.vue` | 顶部 Chip 摘要展示、浮层内模式切换、收藏列表交互、路径选择搜索、排除路径管理与选择。 | **904 行超大单文件组件**；同时负责 4 类不同功能交互；与 `App.vue` 重复实现收藏比较；与 `TaskRow.vue` 重复实现 HTML 转义高亮；两套文档搜索选择逻辑（path 档 vs exclude 档）高度重复。 | 0%（无测试） |
| 视图过滤与展示 | `src/components/task-panel/FilterBar.vue`<br>`TaskTree.vue`<br>`TaskRow.vue` | 状态三态切换、关键字搜索、标题层级多选；树形分组渲染与全部展开/折叠；任务行渲染与自定义标记显示。 | `TaskRow.vue` 自定义实现 `escapeHtml` 与 `highlightText`；`TaskTree.vue` 的 `collectGroupKeys` 与 `App.vue` 遍历重复。 | 0%（无测试） |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **RF-001** | **P0** | 基础设施：引入自动化测试套件 | `package.json`<br>`vite.config.ts` | 引入 `vitest` 测试框架，添加 `pnpm test` 脚本，确立项目首个自动化测试基线。 | 低 | - [x] 运行 `pnpm test` 成功通过且退出码为 0；<br>- [x] 支持 TypeScript 与 `@/` 路径别名解析。 | `package.json`：新增 test 脚本；`docs/project-structure.md`：记录测试架构 | done |
| **RF-002** | **P0** | 标题解析：移除 DOM 依赖与纯函数测试 | `src/data/heading.ts`<br>`src/utils/html.ts` (新建) | 抽离 `stripHtml` 为环境无关的无 DOM 纯函数，解除对浏览器的强绑定；补全标题节点构建与层级映射单元测试。 | 中 | - [x] `stripHtml` 准确去除 span/font/b 等标签并解码实体；<br>- [x] 空值、无标签文本处理符合预期；<br>- [x] `levelOf` 严格限制 1~6 范围并提供兜底；<br>- [x] 运行 Node/Vitest 环境下无 `document is not defined` 报错。 | `docs/project-structure.md`：新增 `src/utils/html.ts` | done |
| **RF-003** | **P0** | 领域核心：任务树排序与分组聚合算法测试及模块化 | `src/data/tasks.ts`<br>`src/data/status.ts` | 为状态判断、子任务父子嵌套关系识别、同级未完成优先稳定排序、标题跨级挂载、全层级计数统计建立全面测试保护，并梳理精简 `tasks.ts`。 | 高 | - [x] `parseTaskLine`/`isTaskDone` 覆盖自定义标记 `[/]`, `[-]`, `[!]` 与标准标记；<br>- [x] `buildAndSortTaskTree` 正确保持同状态文档源顺序与未完成优先；<br>- [x] 子任务深层嵌套正确赋予 `subDepth`；<br>- [x] `buildTaskGroups` 针对跨级隐藏（如仅显示 H1/H3）正确将任务上浮至最近可见标题；<br>- [x] 状态过滤（open/done）下正确剪枝空组，但父级汇总 `total`/`done` 准确不变。 | `docs/project-structure.md`：更新领域模型与算法说明 | done |
| **RF-004** | **P0** | 范围与查询：排除路径规范化与 SQL 谓词构建 | `src/data/scope.ts` | 强化 `parseExcludePath`、`normalizeExcludePaths` 和 `buildTaskQuery` 边界分支的单元测试，重构优化路径解析与谓词构造逻辑。 | 中 | - [x] `normalizeExcludePaths` 正确过滤空白、根路径 `/`，规范首尾斜杠并去重；<br>- [x] `parseExcludePath` 正确匹配已知笔记本前缀，单笔记本模式下正确回退补全；<br>- [x] `buildTaskQuery` 在 activeDoc、path、notebook、all 四档及配合 subdocs/linked/exclude 时生成合法 SQL，且必须包含外层 `LIMIT`。 | `docs/project-structure.md`：更新查询构造说明 | done |
| **RF-005** | **P1** | 代码复用：抽取通用文本、收藏比较与树辅助工具 | `src/utils/text.ts` (新建)<br>`src/utils/favorite.ts` (新建)<br>`src/utils/tree.ts` (新建)<br>`src/App.vue`<br>`src/components/task-panel/ScopeBar.vue`<br>`src/components/task-panel/TaskRow.vue`<br>`src/components/task-panel/TaskTree.vue` | 抽取组件间重复的 HTML 转义与关键词高亮、收藏项相等判定与排序对比、折叠键递归收集纯函数，消除代码重复（DRY）。 | 低 | - [x] 字符串转义 `escapeHtml` 覆盖 `&`, `<`, `>`, `"` 字符；<br>- [x] `highlightText` 准确高亮多个命中片段并保留安全转义；<br>- [x] `isFavoriteMatching` 准确比对 docId、subdocs、linked、status、showHeadings 及 headingLevels 数组；<br>- [x] `collectGroupKeys` 递归收集全部节点 key。 | `docs/project-structure.md`：记录 `src/utils/` 目录职责 | done |
| **RF-006** | **P1** | 组件解耦：拆分超大组件 `ScopeBar.vue` (904 行) | `src/components/task-panel/ScopeBar.vue`<br>`src/components/task-panel/scope/DocPicker.vue` (新建)<br>`src/components/task-panel/scope/FavoriteList.vue` (新建)<br>`src/components/task-panel/scope/ExcludeManager.vue` (新建) | 将 `ScopeBar.vue` 拆分为职责单一的子组件（通用文档选择器、收藏列表、排除路径管理），使单文件代码量控制在合理范围（<250 行）。 | 中 | - [x] 顶部 Chip 点击与 Popover 展开定位正常；<br>- [x] 路径档文档实时搜索、键盘上下移动与回车选择正常；<br>- [x] 排除路径选择器正常复用文档搜索能力并支持手动添加；<br>- [x] 常用收藏列表的展示、标签高亮、应用与删除正常；<br>- [x] 样式类名与视觉层级保持不变。 | `docs/project-structure.md`：更新组件层次树结构 | done |
| **RF-007** | **P2** | 配置与规范：解耦插件配置管理与状态类型定义 | `src/config.ts` (新建)<br>`src/index.ts`<br>`src/data/types.ts` | 提取 `TaskListConfig` 默认值定义、防御性规范化与校验逻辑（`sanitizeConfig`），消除 `StatusFilter` 的重复定义，保持主类精简。 | 低 | - [x] 非法 limit 边界值（<100, >100000, NaN）正确截断为合法区间；<br>- [x] 非法 headingLevels（包含 0 或 >6）正确过滤排序；<br>- [x] `config.json` 加载与保存数据结构完全保持向后兼容。 | `docs/project-structure.md`：记录配置模块；`README.md` / `AGENTS.md`：核对配置说明 | done |

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-11-03 | 2026-11-03 | `pnpm test` | pass | `package.json` | 成功引入 vitest 并建立 status.test.ts 测试基线 |
| RF-002 | 2026-11-03 | 2026-11-03 | `pnpm test -- tests/data/heading.test.ts` | pass | `src/utils/html.ts` | 移除 document DOM 依赖，支持 Node/无 DOM 环境 |
| RF-003 | 2026-11-03 | 2026-11-03 | `pnpm test -- tests/data/tasks.test.ts` | pass | `src/data/tasks.ts` | 建立树排序、未完成优先、跨级标题上浮与剪枝测试 |
| RF-004 | 2026-11-03 | 2026-11-03 | `pnpm test -- tests/data/scope.test.ts` | pass | `src/data/scope.ts` | 建立排除路径解析、规范化及 SQL 谓词测试 |
| RF-005 | 2026-11-03 | 2026-11-03 | `pnpm test -- tests/utils/` | pass | `src/utils/` | 抽取 text、favorite、tree 工具库，消除跨组件重复 |
| RF-006 | 2026-11-03 | 2026-11-03 | `pnpm build && pnpm typecheck` | pass | `src/components/task-panel/scope/` | 成功拆解 ScopeBar 为 DocPicker、FavoriteList、ExcludeManager |
| RF-007 | 2026-11-03 | 2026-11-03 | `pnpm test -- tests/config.test.ts` | pass | `src/config.ts` | 抽取 sanitizeConfig 纯函数并统一 StatusFilter |

## 5. 决策与确认

- 用户批准的条目：全量条目已获用户批准（RF-001、RF-002、RF-003、RF-004、RF-005、RF-006、RF-007）
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：[已完成] 全面系统化编写了架构概览图（Mermaid）、目录模块职责清单、测试套件分布与关键设计约束。
- `README.md` 与 `README_zh_CN.md`：[已完成] 新增「开发与测试」章节，补充 `pnpm test`、`pnpm typecheck` 等指令说明。
- `AGENTS.md`：[已完成] 精简更新 AI Agent 开发指南，包含核心约束、测试命令与模块速查。
- 最终同步检查：
  - `pnpm test`：9 个测试套件，共 65 个测试用例全部通过（耗时约 270ms）。
  - `pnpm typecheck`：TypeScript 类型检查通过（无错误）。
  - `pnpm run build`：生产构建及 package.zip 集市规范校验全部通过。

## 7. 交付总结

所有获批条目（RF-001 ~ RF-007）均已高质量交付并完成双向验证。代码库现已具备完善的自动化测试基础设施，核心算法和工具函数已完成解耦，超大组件已拆解为职责单一的子组件。
