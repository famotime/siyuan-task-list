import { describe, expect, it } from "vitest"
import { arraysEqual, createDefaultDocFavorite, isFavoriteMatching } from "@/utils/favorite"
import type { PathFavorite } from "@/data/types"

function createMockFavorite(overrides: Partial<PathFavorite> = {}): PathFavorite {
  return {
    id: "fav-1",
    docId: "doc-1",
    box: "box-1",
    path: "/doc.sy",
    hpath: "/doc",
    title: "Doc",
    includeSubdocs: false,
    includeLinked: false,
    status: "all",
    showHeadings: true,
    headingLevels: [1, 2, 3, 4, 5, 6],
    createdAt: 1000,
    ...overrides,
  }
}

describe("src/utils/favorite.ts", () => {
  describe("arraysEqual", () => {
    it("should compare arrays ignoring order", () => {
      expect(arraysEqual([1, 2, 3], [3, 2, 1])).toBe(true)
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false)
      expect(arraysEqual([], [])).toBe(true)
      expect(arraysEqual(undefined, undefined)).toBe(true)
    })
  })

  describe("isFavoriteMatching", () => {
    const fav = createMockFavorite({
      docId: "doc-100",
      includeSubdocs: true,
      includeLinked: false,
      status: "todo",
      showHeadings: true,
      headingLevels: [1, 2],
    })

    it("should match identical state", () => {
      expect(
        isFavoriteMatching(fav, {
          docId: "doc-100",
          includeSubdocs: true,
          includeLinked: false,
          status: "todo",
          showHeadings: true,
          headingLevels: [2, 1],
        }),
      ).toBe(true)
    })

    it("should fail when docId differs", () => {
      expect(
        isFavoriteMatching(fav, {
          docId: "doc-999",
          includeSubdocs: true,
          includeLinked: false,
          status: "todo",
          showHeadings: true,
          headingLevels: [1, 2],
        }),
      ).toBe(false)
    })

    it("should fail when flags differ", () => {
      expect(
        isFavoriteMatching(fav, {
          docId: "doc-100",
          includeSubdocs: false,
          includeLinked: false,
          status: "todo",
          showHeadings: true,
          headingLevels: [1, 2],
        }),
      ).toBe(false)
    })

    it("should fail when status or heading levels differ", () => {
      expect(
        isFavoriteMatching(fav, {
          docId: "doc-100",
          includeSubdocs: true,
          includeLinked: false,
          status: "done",
          showHeadings: true,
          headingLevels: [1, 2],
        }),
      ).toBe(false)

      expect(
        isFavoriteMatching(fav, {
          docId: "doc-100",
          includeSubdocs: true,
          includeLinked: false,
          status: "todo",
          showHeadings: true,
          headingLevels: [1, 2, 3],
        }),
      ).toBe(false)
    })

    it("should match equivalent status arrays or configs", () => {
      // 字符串 "todo" 与单元素数组 ["todo"] 语义等价
      expect(
        isFavoriteMatching(fav, {
          docId: "doc-100",
          includeSubdocs: true,
          includeLinked: false,
          status: ["todo"],
          showHeadings: true,
          headingLevels: [1, 2],
        }),
      ).toBe(true)

      // 复合多选状态收藏项
      const multiFav = createMockFavorite({
        docId: "doc-200",
        status: ["todo", "in_progress"],
      })
      expect(
        isFavoriteMatching(multiFav, {
          docId: "doc-200",
          status: ["in_progress", "todo"],
        }),
      ).toBe(true)
      expect(
        isFavoriteMatching(multiFav, {
          docId: "doc-200",
          status: ["todo"],
        }),
      ).toBe(false)
    })
  })

  describe("createDefaultDocFavorite", () => {
    it("should create standard default favorite with includeSubdocs enabled and all statuses", () => {
      const fav = createDefaultDocFavorite({
        docId: "doc-99",
        box: "box-nb",
        path: "/20240101-doc.sy",
        hpath: "/Folder/My Target Doc",
        title: "My Target Doc",
      })

      expect(fav.docId).toBe("doc-99")
      expect(fav.box).toBe("box-nb")
      expect(fav.path).toBe("/20240101-doc.sy")
      expect(fav.hpath).toBe("/Folder/My Target Doc")
      expect(fav.title).toBe("My Target Doc")
      expect(fav.includeSubdocs).toBe(true)
      expect(fav.includeLinked).toBe(false)
      expect(fav.status).toBe("all")
      expect(fav.showHeadings).toBe(true)
      expect(fav.headingLevels).toEqual([1, 2, 3, 4, 5, 6])
      expect(fav.id).toMatch(/^fav-\d+-[a-z0-9]+$/)
      expect(typeof fav.createdAt).toBe("number")
    })

    it("should resolve leaf name correctly from hpath or fallback to title/untitledLabel", () => {
      const fav1 = createDefaultDocFavorite({
        docId: "doc-1",
        box: "box-1",
        path: "/1.sy",
        hpath: "/A/B/Leaf",
        title: "Raw Title",
      })
      expect(fav1.title).toBe("Leaf")

      const fav2 = createDefaultDocFavorite({
        docId: "doc-2",
        box: "box-1",
        path: "/2.sy",
        hpath: "",
        title: "",
        untitledLabel: "自定义无标题",
      })
      expect(fav2.title).toBe("自定义无标题")
    })
  })
})
