import { beforeEach, describe, expect, it, vi } from "vitest"
import { levelOf, resolveHeadingPaths } from "@/data/heading"
import * as api from "@/api"

vi.mock("@/api", () => ({
  sql: vi.fn(),
  getDocOutline: vi.fn(),
}))

describe("src/data/heading.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("levelOf", () => {
    it("should parse subtype h1-h6 correctly", () => {
      expect(levelOf("h1")).toBe(1)
      expect(levelOf("h2")).toBe(2)
      expect(levelOf("h3")).toBe(3)
      expect(levelOf("h4")).toBe(4)
      expect(levelOf("h5")).toBe(5)
      expect(levelOf("h6")).toBe(6)
    })

    it("should fallback to 6 for invalid or missing subtypes", () => {
      expect(levelOf("")).toBe(6)
      expect(levelOf("h7")).toBe(6)
      expect(levelOf("h0")).toBe(6)
      expect(levelOf("invalid")).toBe(6)
      expect(levelOf(null as unknown as string)).toBe(6)
    })
  })

  describe("resolveHeadingPaths", () => {
    it("should resolve single heading parent correctly", async () => {
      // 模拟 blocks 数据：
      // list-1 (parentId: h-1, type: 'l')
      // h-1 (parentId: doc-1, type: 'h', subtype: 'h2', content: 'Section 1')
      // doc-1 (type: 'd')
      const mockSql = vi.mocked(api.sql)
      mockSql.mockResolvedValueOnce([
        { id: "list-1", parent_id: "h-1", type: "l", subtype: "", content: "" },
      ])
      mockSql.mockResolvedValueOnce([
        { id: "h-1", parent_id: "doc-1", type: "h", subtype: "h2", content: "Section 1" },
      ])
      mockSql.mockResolvedValueOnce([
        { id: "doc-1", parent_id: "", type: "d", subtype: "", content: "My Doc" },
      ])

      const mockOutline = vi.mocked(api.getDocOutline)
      mockOutline.mockResolvedValueOnce([
        { id: "h-1", children: [] },
      ])

      const parentRootIds = new Map([["list-1", "doc-1"]])
      const res = await resolveHeadingPaths(parentRootIds)

      expect(res.pathByParentId.has("list-1")).toBe(true)
      const pathInfo = res.pathByParentId.get("list-1")!
      expect(pathInfo.nearestId).toBe("h-1")
      expect(pathInfo.path).toHaveLength(1)
      expect(pathInfo.path[0]).toEqual({
        id: "h-1",
        content: "Section 1",
        level: 2,
        parentId: null,
        order: 0,
      })

      expect(res.docHeadings.get("doc-1")?.has("h-1")).toBe(true)
      expect(res.parentBlockIdByListId.get("list-1")).toBe("h-1")
    })

    it("should resolve nested headings (H1 -> H2)", async () => {
      // list-1 -> h-2 -> h-1 -> doc-1
      const mockSql = vi.mocked(api.sql)
      mockSql.mockResolvedValueOnce([
        { id: "list-1", parent_id: "h-2", type: "l", subtype: "", content: "" },
      ])
      mockSql.mockResolvedValueOnce([
        { id: "h-2", parent_id: "h-1", type: "h", subtype: "h2", content: "Sub Section" },
      ])
      mockSql.mockResolvedValueOnce([
        { id: "h-1", parent_id: "doc-1", type: "h", subtype: "h1", content: "Chapter 1" },
      ])
      mockSql.mockResolvedValueOnce([
        { id: "doc-1", parent_id: "", type: "d", subtype: "", content: "Doc" },
      ])

      const mockOutline = vi.mocked(api.getDocOutline)
      mockOutline.mockResolvedValueOnce([
        { id: "h-1", children: [{ id: "h-2" }] },
      ])

      const parentRootIds = new Map([["list-1", "doc-1"]])
      const res = await resolveHeadingPaths(parentRootIds)

      const pathInfo = res.pathByParentId.get("list-1")!
      expect(pathInfo.nearestId).toBe("h-2")
      expect(pathInfo.path).toHaveLength(2)
      expect(pathInfo.path[0].id).toBe("h-1")
      expect(pathInfo.path[0].level).toBe(1)
      expect(pathInfo.path[1].id).toBe("h-2")
      expect(pathInfo.path[1].level).toBe(2)
      expect(pathInfo.path[1].parentId).toBe("h-1")
    })
  })
})
