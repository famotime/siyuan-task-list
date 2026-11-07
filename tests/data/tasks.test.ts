import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildAndSortTaskTree,
  buildTaskGroups,
  collectTasks,
  filterTasks,
  filterTasksByKeyword,
  filterTasksByStatus,
  sortDocEntries,
} from "@/data/tasks"
import type { DocMeta, TaskItem } from "@/data/types"
import * as api from "@/api"
import * as heading from "@/data/heading"
import * as order from "@/data/order"

vi.mock("@/api", () => ({
  lsNotebooks: vi.fn(),
  sql: vi.fn(),
  sqlWithMeta: vi.fn(),
  getDocBlocksOrders: vi.fn(),
  getDocOutline: vi.fn(),
}))

vi.mock("@/data/heading", () => ({
  resolveHeadingPaths: vi.fn(),
}))

vi.mock("@/data/order", () => ({
  resolveDocBlockOrders: vi.fn(),
}))

function createMockTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "task-1",
    content: "Task Content",
    marker: " ",
    done: false,
    box: "nb-1",
    rootId: "doc-1",
    hpath: "/Doc 1",
    parentId: "list-1",
    parentTaskId: null,
    updated: "20240101120000",
    headingPath: [],
    headingId: null,
    srcOrder: 0,
    ...overrides,
  }
}

describe("src/data/tasks.ts", () => {
  describe("filtering", () => {
    const tasks: TaskItem[] = [
      createMockTask({ id: "1", content: "Buy milk", done: false }),
      createMockTask({ id: "2", content: "Buy coffee", done: true }),
      createMockTask({ id: "3", content: "Read book", done: false }),
    ]

    it("filterTasksByKeyword should filter case-insensitively", () => {
      expect(filterTasksByKeyword(tasks, "buy")).toHaveLength(2)
      expect(filterTasksByKeyword(tasks, "MILK")).toHaveLength(1)
      expect(filterTasksByKeyword(tasks, "  ")).toHaveLength(3)
      expect(filterTasksByKeyword(tasks, "nonexistent")).toHaveLength(0)
    })

    it("filterTasksByKeyword should match document path or heading content", () => {
      const complexTasks: TaskItem[] = [
        createMockTask({
          id: "t1",
          content: "Clean desk",
          hpath: "/Work/ProjectAlpha",
          headingPath: [{ id: "h1", content: "Architecture Plan", level: 1, parentId: null, order: 0 }],
        }),
        createMockTask({
          id: "t2",
          content: "Write code",
          hpath: "/Personal/Diary",
          headingPath: [{ id: "h2", content: "Daily Notes", level: 2, parentId: null, order: 0 }],
        }),
      ]

      // 匹配任务内容
      expect(filterTasksByKeyword(complexTasks, "desk")).toHaveLength(1)
      expect(filterTasksByKeyword(complexTasks, "desk")[0].id).toBe("t1")

      // 匹配文档名或文档路径
      expect(filterTasksByKeyword(complexTasks, "ProjectAlpha")).toHaveLength(1)
      expect(filterTasksByKeyword(complexTasks, "ProjectAlpha")[0].id).toBe("t1")
      expect(filterTasksByKeyword(complexTasks, "personal")).toHaveLength(1)
      expect(filterTasksByKeyword(complexTasks, "personal")[0].id).toBe("t2")

      // 匹配祖先标题名称
      expect(filterTasksByKeyword(complexTasks, "Architecture")).toHaveLength(1)
      expect(filterTasksByKeyword(complexTasks, "Architecture")[0].id).toBe("t1")
      expect(filterTasksByKeyword(complexTasks, "Daily")).toHaveLength(1)
      expect(filterTasksByKeyword(complexTasks, "Daily")[0].id).toBe("t2")
    })

    it("filterTasksByKeyword should keep descendants of matched tasks", () => {
      const tree: TaskItem[] = [
        createMockTask({ id: "p1", content: "导航栏设计", parentTaskId: null }),
        createMockTask({ id: "c1", content: "移动端折叠菜单", done: true, parentTaskId: "p1" }),
        createMockTask({ id: "c2", content: "桌面端多级下拉", parentTaskId: "p1" }),
        createMockTask({ id: "g1", content: "动效细节打磨", parentTaskId: "c2" }),
        createMockTask({ id: "x1", content: "无关任务", parentTaskId: null }),
        createMockTask({ id: "x2", content: "无关子任务", parentTaskId: "x1" }),
      ]

      // 命中父任务时，未命中关键词的嵌套子任务（含孙级）随父保留
      const kept = filterTasksByKeyword(tree, "设计")
      expect(kept.map((t) => t.id)).toEqual(["p1", "c1", "c2", "g1"])

      // 命中与保留的子任务保持源数组相对顺序
      expect(kept.map((t) => t.content)).toEqual([
        "导航栏设计",
        "移动端折叠菜单",
        "桌面端多级下拉",
        "动效细节打磨",
      ])
    })

    it("filterTasksByKeyword should not backtrack to ancestors of matched children", () => {
      const tree: TaskItem[] = [
        createMockTask({ id: "p1", content: "重构列表组件", parentTaskId: null }),
        createMockTask({ id: "c1", content: "折叠菜单设计", parentTaskId: "p1" }),
        createMockTask({ id: "s1", content: "无关任务", parentTaskId: null }),
      ]

      // 子任务自身命中时仅保留该子任务，父任务与兄弟分支不出现
      expect(filterTasksByKeyword(tree, "设计").map((t) => t.id)).toEqual(["c1"])
    })

    it("filterTasksByStatus should filter correctly", () => {
      expect(filterTasksByStatus(tasks, "all")).toHaveLength(3)
      expect(filterTasksByStatus(tasks, "todo")).toHaveLength(2)
      expect(filterTasksByStatus(tasks, "done")).toHaveLength(1)
    })

    it("filterTasks should combine keyword and status", () => {
      expect(filterTasks(tasks, "todo", "buy")).toHaveLength(1)
      expect(filterTasks(tasks, "done", "buy")).toHaveLength(1)
      expect(filterTasks(tasks, "done", "milk")).toHaveLength(0)
    })

    it("filterTasks should apply status filter to retained descendants", () => {
      const tree: TaskItem[] = [
        createMockTask({ id: "p1", content: "导航栏设计", parentTaskId: null }),
        createMockTask({ id: "c1", content: "移动端折叠菜单", done: true, parentTaskId: "p1" }),
        createMockTask({ id: "c2", content: "桌面端多级下拉", parentTaskId: "p1" }),
      ]

      // 状态筛选照常作用于随父保留的后代：未完成下隐藏已完成子任务
      expect(filterTasks(tree, "todo", "设计").map((t) => t.id)).toEqual(["p1", "c2"])
      expect(filterTasks(tree, "done", "设计").map((t) => t.id)).toEqual(["c1"])
    })
  })

  describe("buildAndSortTaskTree", () => {
    it("should handle empty list", () => {
      expect(buildAndSortTaskTree([])).toEqual([])
    })

    it("should sort flat tasks by srcOrder", () => {
      const tasks = [
        createMockTask({ id: "t3", srcOrder: 3 }),
        createMockTask({ id: "t1", srcOrder: 1 }),
        createMockTask({ id: "t2", srcOrder: 2 }),
      ]
      const sorted = buildAndSortTaskTree(tasks, false)
      expect(sorted.map((t) => t.id)).toEqual(["t1", "t2", "t3"])
      expect(sorted.map((t) => t.subDepth)).toEqual([0, 0, 0])
    })

    it("should nest child tasks under parent task with subDepth", () => {
      const tasks = [
        createMockTask({ id: "t1", srcOrder: 1, parentTaskId: null }),
        createMockTask({ id: "t2", srcOrder: 2, parentTaskId: "t1" }),
        createMockTask({ id: "t3", srcOrder: 3, parentTaskId: "t2" }),
        createMockTask({ id: "t4", srcOrder: 4, parentTaskId: null }),
      ]
      const sorted = buildAndSortTaskTree(tasks, false)
      expect(sorted.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4"])
      expect(sorted.map((t) => t.subDepth)).toEqual([0, 1, 2, 0])
    })

    it("should elevate open tasks first when sortTodoFirst is true", () => {
      const tasks = [
        createMockTask({ id: "t1", done: true, srcOrder: 1 }),
        createMockTask({ id: "t2", done: false, srcOrder: 2 }),
        createMockTask({ id: "t3", done: true, srcOrder: 3 }),
        createMockTask({ id: "t4", done: false, srcOrder: 4 }),
      ]
      const sorted = buildAndSortTaskTree(tasks, true)
      // 未完成 t2, t4 靠前，且保持源顺序；已完成 t1, t3 靠后，保持源顺序
      expect(sorted.map((t) => t.id)).toEqual(["t2", "t4", "t1", "t3"])
    })

    it("should sort nested children with sortTodoFirst independently within level", () => {
      const tasks = [
        createMockTask({ id: "parent", done: true, srcOrder: 1, parentTaskId: null }),
        createMockTask({ id: "child-done", done: true, srcOrder: 2, parentTaskId: "parent" }),
        createMockTask({ id: "child-todo", done: false, srcOrder: 3, parentTaskId: "parent" }),
      ]
      const sorted = buildAndSortTaskTree(tasks, true)
      expect(sorted.map((t) => t.id)).toEqual(["parent", "child-todo", "child-done"])
      expect(sorted.map((t) => t.subDepth)).toEqual([0, 1, 1])
    })
  })

  describe("buildTaskGroups", () => {
    const notebookNames = new Map([
      ["nb-1", "Notebook 1"],
      ["nb-2", "Notebook 2"],
    ])

    it("should return empty array for empty tasks", () => {
      expect(buildTaskGroups([], notebookNames, "Untitled")).toEqual([])
    })

    it("should flatten tasks into doc group when showHeadings is false", () => {
      const tasks = [
        createMockTask({ id: "t1", rootId: "doc-1", box: "nb-1", hpath: "/Notes/Today", done: false }),
        createMockTask({ id: "t2", rootId: "doc-1", box: "nb-1", hpath: "/Notes/Today", done: true }),
      ]
      const groups = buildTaskGroups(tasks, notebookNames, "Untitled", { showHeadings: false })
      expect(groups).toHaveLength(1)
      const nbGroup = groups[0]
      expect(nbGroup.kind).toBe("notebook")
      expect(nbGroup.total).toBe(2)
      expect(nbGroup.done).toBe(1)

      expect(nbGroup.children).toHaveLength(1)
      const docGroup = nbGroup.children[0]
      expect(docGroup.kind).toBe("doc")
      expect(docGroup.title).toBe("Today")
      expect(docGroup.parentPath).toBe("Notes")
      expect(docGroup.children).toHaveLength(0) // No heading children
      expect(docGroup.listGroups[0].tasks).toHaveLength(2)
    })

    it("should build hierarchical heading groups", () => {
      const h1Node = { id: "h1", content: "Section 1", level: 1, parentId: null, order: 0 }
      const h2Node = { id: "h2", content: "SubSection", level: 2, parentId: "h1", order: 1 }

      const tasks = [
        createMockTask({
          id: "t1",
          rootId: "doc-1",
          box: "nb-1",
          hpath: "/Doc",
          done: false,
          headingPath: [h1Node],
          headingId: "h1",
        }),
        createMockTask({
          id: "t2",
          rootId: "doc-1",
          box: "nb-1",
          hpath: "/Doc",
          done: true,
          headingPath: [h1Node, h2Node],
          headingId: "h2",
        }),
      ]

      const groups = buildTaskGroups(tasks, notebookNames, "Untitled", { showHeadings: true })
      expect(groups).toHaveLength(1)
      const docGroup = groups[0].children[0]
      expect(docGroup.children).toHaveLength(1)

      const h1Group = docGroup.children[0]
      expect(h1Group.kind).toBe("heading")
      expect(h1Group.title).toBe("Section 1")
      expect(h1Group.total).toBe(2) // h1 directly (1) + h2 child (1)
      expect(h1Group.done).toBe(1)

      expect(h1Group.children).toHaveLength(1)
      const h2Group = h1Group.children[0]
      expect(h2Group.kind).toBe("heading")
      expect(h2Group.title).toBe("SubSection")
      expect(h2Group.total).toBe(1)
      expect(h2Group.done).toBe(1)
    })

    it("should float tasks up when intermediate heading levels are hidden", () => {
      // h1 (level 1) -> h2 (level 2)
      // 如果仅展示 headingLevels: [1]，h2 下的任务应上浮到 h1 中展示
      const h1Node = { id: "h1", content: "Chapter 1", level: 1, parentId: null, order: 0 }
      const h2Node = { id: "h2", content: "Details", level: 2, parentId: "h1", order: 1 }

      const tasks = [
        createMockTask({
          id: "t1",
          rootId: "doc-1",
          box: "nb-1",
          hpath: "/Doc",
          headingPath: [h1Node, h2Node],
          headingId: "h2",
        }),
      ]

      const groups = buildTaskGroups(tasks, notebookNames, "Untitled", {
        showHeadings: true,
        headingLevels: [1], // 只显示 H1
      })

      const docGroup = groups[0].children[0]
      expect(docGroup.children).toHaveLength(1)
      const h1Group = docGroup.children[0]
      expect(h1Group.title).toBe("Chapter 1")
      expect(h1Group.children).toHaveLength(0) // H2 没有作为子分组出现
      expect(h1Group.listGroups[0].tasks).toHaveLength(1)
      expect(h1Group.listGroups[0].tasks[0].id).toBe("t1")
    })

    it("should prune empty groups under statusFilter while preserving total/done counts", () => {
      const h1Node = { id: "h1", content: "Done Section", level: 1, parentId: null, order: 0 }
      const tasks = [
        createMockTask({
          id: "t1",
          rootId: "doc-1",
          box: "nb-1",
          hpath: "/Doc",
          done: true,
          headingPath: [h1Node],
          headingId: "h1",
        }),
      ]

      // 过滤只看 "todo" 未完成任务，此时全部完成，整个组应被剪枝
      const groups = buildTaskGroups(tasks, notebookNames, "Untitled", {
        showHeadings: true,
        statusFilter: "todo",
      })

      expect(groups).toHaveLength(0) // 完全无可见任务的分组被修剪
    })
  })

  describe("collectTasks", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("should orchestrate task collection pipeline correctly", async () => {
      vi.mocked(api.lsNotebooks).mockResolvedValue({
        notebooks: [{ id: "nb-1", name: "Notebook 1", closed: false }],
      } as any)

      vi.mocked(api.sqlWithMeta).mockResolvedValue({
        rows: [
          {
            id: "task-1",
            parent_id: "list-1",
            root_id: "doc-1",
            box: "nb-1",
            hpath: "/MyDoc",
            content: "Do homework",
            markdown: "- [ ] Do homework",
            updated: "20240101",
          },
        ],
        truncated: false,
        limit: 2000,
      })

      vi.mocked(heading.resolveHeadingPaths).mockResolvedValue({
        docHeadings: new Map(),
        pathByParentId: new Map([
          ["list-1", { path: [], nearestId: null }],
        ]),
        parentBlockIdByListId: new Map(),
      })

      vi.mocked(order.resolveDocBlockOrders).mockResolvedValue(new Map([
        ["doc-1", new Map([["task-1", 0]])],
      ]))

      const result = await collectTasks({ mode: "notebook", box: "nb-1" }, 2000)

      expect(result.truncated).toBe(false)
      expect(result.notebookNames.get("nb-1")).toBe("Notebook 1")
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0]).toMatchObject({
        id: "task-1",
        content: "Do homework",
        done: false,
        marker: " ",
        srcOrder: 0,
      })
    })
  })

  describe("sortDocEntries", () => {
    const docEntries = [
      { rootId: "doc-1", hpath: "/B-Doc", tasks: [] },
      { rootId: "doc-2", hpath: "/A-Doc", tasks: [] },
      { rootId: "doc-3", hpath: "/C-Doc", tasks: [] },
    ]
    const docMetas = new Map<string, DocMeta>([
      ["doc-1", { id: "doc-1", title: "B Document", created: "20240101100000", updated: "20240103100000" }],
      ["doc-2", { id: "doc-2", title: "A Document", created: "20240102100000", updated: "20240101100000" }],
      ["doc-3", { id: "doc-3", title: "C Document", created: "20240103100000", updated: "20240102100000" }],
    ])

    it("should sort by updated descending", () => {
      const sorted = sortDocEntries(docEntries, "updated-desc", docMetas)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-1", "doc-3", "doc-2"])
    })

    it("should sort by updated ascending", () => {
      const sorted = sortDocEntries(docEntries, "updated-asc", docMetas)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-2", "doc-3", "doc-1"])
    })

    it("should sort by created descending", () => {
      const sorted = sortDocEntries(docEntries, "created-desc", docMetas)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-3", "doc-2", "doc-1"])
    })

    it("should sort by created ascending", () => {
      const sorted = sortDocEntries(docEntries, "created-asc", docMetas)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-1", "doc-2", "doc-3"])
    })

    it("should sort by title ascending", () => {
      const sorted = sortDocEntries(docEntries, "title-asc", docMetas)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-2", "doc-1", "doc-3"])
    })

    it("should sort by title descending", () => {
      const sorted = sortDocEntries(docEntries, "title-desc", docMetas)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-3", "doc-1", "doc-2"])
    })

    it("should fallback to hpath when docMetas is absent", () => {
      const sorted = sortDocEntries(docEntries, "title-asc", undefined)
      expect(sorted.map((d) => d.rootId)).toEqual(["doc-2", "doc-1", "doc-3"])
    })
  })
})
