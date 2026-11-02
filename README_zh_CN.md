# 思源笔记任务清单汇总

[English](./README.md)

将分散在不同文档中的任务列表汇集为一个统一的 Dock 侧边面板，便于集中查看与管理。

![preview](https://raw.githubusercontent.com/famotime/siyuan-task-list/main/preview.webp)

## 功能

- **统一面板**（右侧 Dock）：汇集所有列表勾选任务（`[ ]` / `[X]` 任务项，含嵌套子项）。
- **灵活范围**：当前文档 / 指定文档路径（可开关「包含子文档」「包含链接文档」）/ 指定笔记本 / 全部笔记本。*链接文档* 指范围根文档中通过块引用、嵌入块引用到的其他文档（一层、去重）。
- **便捷筛选**：按完成状态三态筛选（全部/未完成/已完成）+ 任务内容关键字搜索。
- **树状归类**：笔记本 → 文档 → 文档内标题树 → 任务簇。归属同一个列表块的任务相邻聚合显示，并按完成状态重排（未完成在前），同状态保持原文档相对顺序。汇总视图是原文档的只读投影——不改写原文档顺序，唯一写操作是勾选状态写回。
- **勾选写回与跳转**：在面板中直接勾选/取消任务完成状态（走内核 `updateTaskListItemMarker`，不影响嵌套子列表），点击任务跳转定位到源块。

## 兼容性

- 思源 `3.8.5` 及以上（依赖 3.7.3 新增的 `/api/block/updateTaskListItemMarker`）。

## 开发

```bash
pnpm install
pnpm dev      # watch 构建，产物直接输出到 .env 配置的工作区
pnpm build    # 生产构建 -> dist + package.zip + 产物校验
pnpm typecheck
```

在 `.env` 中配置 `VITE_SIYUAN_WORKSPACE_PATH` 指向思源工作区，`pnpm dev` 会把插件部署到 `<工作区>/data/plugins/siyuan-task-list`。

设计说明：[GLOSSARY.md](./GLOSSARY.md)（领域术语）、[docs/adr/0001](./docs/adr/0001-汇总视图为只读投影仅写回勾选状态.md)（为什么面板不改写源文档顺序）。
