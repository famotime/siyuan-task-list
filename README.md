# SiYuan Task List

[简体中文](./README_zh_CN.md)

Aggregate task lists scattered across your SiYuan documents into one unified dock panel.

![preview](https://raw.githubusercontent.com/famotime/siyuan-task-list/main/preview.webp)

## Features

- **Unified panel** (dock, right side): all checkbox tasks (list items with `[ ]` / `[X]` markers, including nested sub-items) collected in one place.
- **Flexible scope**: current doc / a picked doc path (toggle subdocs & linked docs) / a whole notebook / all notebooks. *Linked docs* are the docs referenced by block refs & embed blocks of the scope root (one level, deduplicated).
- **Filter**: completion status (all / open / done) plus keyword search over task content.
- **Tree grouping**: notebook → document → heading tree → task clusters. Tasks belonging to the same list block stay adjacent and are re-sorted by completion (open first) with the original source order kept as a stable secondary order. The source documents are never reordered — the panel is a read-only projection of your docs, except that checking a task writes the checkbox state back.
- **Write back & jump**: toggle a task's completion directly from the panel (via the kernel API `updateTaskListItemMarker`, which preserves nested sub-lists), or click a task to jump to its source block.

## Compatibility

- SiYuan `3.8.5` or later (uses `/api/block/updateTaskListItemMarker` added in 3.7.3).

## Development

```bash
pnpm install
pnpm dev      # build --watch, output goes to the workspace configured in .env
pnpm build    # production build -> dist + package.zip + verify
pnpm typecheck
```

Set `VITE_SIYUAN_WORKSPACE_PATH` in `.env` to your SiYuan workspace so that `pnpm dev` deploys the plugin into `<workspace>/data/plugins/siyuan-task-list`.

Architecture notes: [GLOSSARY.md](./GLOSSARY.md) (domain terms) and [docs/adr/0001](./docs/adr/0001-汇总视图为只读投影仅写回勾选状态.md) (why the panel never rewrites source order).
