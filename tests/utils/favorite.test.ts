import { describe, expect, it } from "vitest"
import { arraysEqual, isFavoriteMatching } from "@/utils/favorite"
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
  })
})
