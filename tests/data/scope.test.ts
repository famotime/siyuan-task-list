import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildTaskQuery,
  normalizeExcludePaths,
  parseExcludePath,
} from "@/data/scope"
import * as api from "@/api"

vi.mock("@/api", () => ({
  sql: vi.fn(),
  sqlWithMeta: vi.fn(),
}))

describe("src/data/scope.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("normalizeExcludePaths", () => {
    it("should normalize leading and trailing slashes", () => {
      expect(normalizeExcludePaths(["folder/sub", "/docs/page/"])).toEqual([
        "/folder/sub",
        "/docs/page",
      ])
    })

    it("should discard empty, whitespace, and root path '/'", () => {
      expect(normalizeExcludePaths(["", "   ", "/", "///", "/valid"])).toEqual(["/valid"])
    })

    it("should deduplicate paths", () => {
      expect(normalizeExcludePaths(["/a/b", "a/b", "/a/b/"])).toEqual(["/a/b"])
    })

    it("should handle null or undefined input gracefully", () => {
      expect(normalizeExcludePaths(null as unknown as string[])).toEqual([])
    })
  })

  describe("parseExcludePath", () => {
    const notebooks = [
      { id: "box-work", name: "工作笔记" },
      { id: "box-life", name: "生活日志" },
    ]

    it("should match known notebook prefix", () => {
      const res = parseExcludePath("/工作笔记/项目A/计划", notebooks)
      expect(res).toEqual({
        boxId: "box-work",
        hpath: "/项目A/计划",
        displayPath: "/工作笔记/项目A/计划",
      })
    })

    it("should match exact notebook name", () => {
      const res = parseExcludePath("/工作笔记", notebooks)
      expect(res).toEqual({
        boxId: "box-work",
        hpath: "/",
        displayPath: "/工作笔记",
      })
    })

    it("should fallback to current notebook in single-notebook mode", () => {
      const res = parseExcludePath("/日常/待办", notebooks, "box-life")
      expect(res).toEqual({
        boxId: "box-life",
        hpath: "/日常/待办",
        displayPath: "/生活日志/日常/待办",
      })
    })

    it("should return unboxed path if no match and no fallback", () => {
      const res = parseExcludePath("/未知笔记本/文档", notebooks)
      expect(res).toEqual({
        boxId: undefined,
        hpath: "/未知笔记本/文档",
        displayPath: "/未知笔记本/文档",
      })
    })
  })

  describe("buildTaskQuery", () => {
    it("should short-circuit with 1=0 if scope is incomplete", async () => {
      const sqlActive = await buildTaskQuery({
        selection: { mode: "activeDoc" },
        limit: 100,
      })
      expect(sqlActive).toContain("1=0")
      expect(sqlActive).toContain("LIMIT 100")

      const sqlPath = await buildTaskQuery({
        selection: { mode: "path", box: "b1" }, // missing path
        limit: 100,
      })
      expect(sqlPath).toContain("1=0")

      const sqlNotebook = await buildTaskQuery({
        selection: { mode: "notebook" }, // missing box
        limit: 100,
      })
      expect(sqlNotebook).toContain("1=0")
    })

    it("should build notebook scope query correctly", async () => {
      const sqlStr = await buildTaskQuery({
        selection: { mode: "notebook", box: "box-1" },
        limit: 2000,
      })
      expect(sqlStr).toContain("box='box-1'")
      expect(sqlStr).toContain("ORDER BY root_id, updated LIMIT 2000")
    })

    it("should build path scope query with subdocs", async () => {
      const sqlStr = await buildTaskQuery({
        selection: {
          mode: "path",
          box: "box-1",
          path: "/20240101-doc.sy",
          includeSubdocs: true,
        },
        limit: 1000,
      })
      expect(sqlStr).toContain("box='box-1'")
      expect(sqlStr).toContain("path='/20240101-doc.sy'")
      expect(sqlStr).toContain("path LIKE '/20240101-doc/%'")
      expect(sqlStr).toContain("LIMIT 1000")
    })

    it("should append exclude paths under notebook mode", async () => {
      const notebooks = [{ id: "box-1", name: "MyNotebook" }]
      const sqlStr = await buildTaskQuery({
        selection: {
          mode: "notebook",
          box: "box-1",
          excludePaths: ["/Templates", "/Archive"],
        },
        notebooks,
        limit: 2000,
      })
      expect(sqlStr).toContain("box='box-1'")
      expect(sqlStr).toContain("NOT (")
      expect(sqlStr).toContain("hpath = '/Templates' OR hpath LIKE '/Templates/%'")
      expect(sqlStr).toContain("hpath = '/Archive' OR hpath LIKE '/Archive/%'")
    })

    it("should handle exclude paths with boxId under all mode", async () => {
      const notebooks = [{ id: "box-life", name: "Life" }]
      const sqlStr = await buildTaskQuery({
        selection: {
          mode: "all",
          excludePaths: ["/Life/Private"],
        },
        notebooks,
        limit: 500,
      })
      expect(sqlStr).toContain("box = 'box-life'")
      expect(sqlStr).toContain("hpath = '/Private' OR hpath LIKE '/Private/%'")
      expect(sqlStr).toContain("LIMIT 500")
    })
  })
})
