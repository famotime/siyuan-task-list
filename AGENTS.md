# AI Agent 开发指南 (AGENTS.md)

## 1. 核心约束与参考工程

重要：在涉及解析思源笔记文档块结构和内容、确认 API 行为时，务必查看 `developer_docs` 目录（仓库根目录下开发者文档）和 `siyuan-note` 项目源码确认，切勿凭空猜测。

- **siyuan-note 源码参考路径**：
  - Windows 开发机：`D:\MyCodingProjects\siyuan-note`
  - Linux 开发机：`/home/quincyzou/projects/siyuan-note`
  - 核对内核行为以 Go 源码为准（`kernel/server/serve.go`、`kernel/model/assets.go`、`kernel/sql/database.go`），前端为 `app/src`。
- **只读投影设计**：除点击勾选框调用 `updateTaskListItemMarker` 纯写回标记外，绝不篡改用户的源文档块结构与顺序。
- **纯函数无 DOM 依赖**：`src/data/` 与 `src/utils/` 下逻辑严禁使用 `document` / `window` 等 DOM API，确保 Node/Vitest 环境可无缝测试。
- **SQL 显式 LIMIT**：思源内核默认按 `search.limit=64` 截断，所有汇总查询必须显式传递外层 `LIMIT`。

---

## 2. 常用开发与验证命令

```bash
# 运行全量自动化单元测试
pnpm test

# 运行 TypeScript 类型检查
pnpm typecheck

# 本地生产构建与打包校验（输出至 dist 并生成 package.zip）
pnpm run build

# 启动 Vite 监听热更新开发模式
pnpm dev
```

---

## 3. 架构速览

- `src/index.ts`: 插件主入口（继承 `siyuan.Plugin`），管理生命周期与 Dock 注册。
- `src/config.ts`: 插件配置定义（`TaskListConfig`）与防御性校验函数（`sanitizeConfig`）。
- `src/api.ts`: 思源内核 API 封装。
- `src/data/`: 领域核心层：
  - `types.ts`: 核心类型定义（`TaskItem`, `TaskGroup`, `ScopeSelection` 等）。
  - `status.ts`: 任务勾选标记解析（支持标准 `- [ ]` 与自定义 `[/]`, `[-]`, `[!]`）。
  - `heading.ts`: 标题祖先链回溯与大纲顺序校正。
  - `order.ts`: 绝对文档序解析与降级兜底。
  - `scope.ts`: 汇总范围转译为 SQL 与排除路径解析规范化。
  - `tasks.ts`: 数据汇集编排、树形嵌套排序与多级分组构建。
- `src/utils/`: 通用纯函数工具库（`html.ts`, `text.ts`, `favorite.ts`, `tree.ts`）。
- `src/components/task-panel/`: Vue 3 任务面板组件（`ScopeBar.vue`, `FilterBar.vue`, `TaskTree.vue`, `TaskRow.vue`，及 `scope/` 子面板）。
- `tests/`: Vitest 自动化单元测试套件（9 个测试文件，65 个测试用例）。
- 详尽架构说明参见 [docs/project-structure.md](file:///d:/MyCodingProjects/siyuan-task-list/docs/project-structure.md)。
