import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG, sanitizeConfig } from "@/config"

describe("src/config.ts", () => {
  it("should return default config when saved data is null or undefined", () => {
    const config = sanitizeConfig(null)
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  describe("limit sanitization", () => {
    it("should clamp limit between 100 and 100000", () => {
      expect(sanitizeConfig({ limit: 50 }).limit).toBe(DEFAULT_CONFIG.limit) // <100 ignored
      expect(sanitizeConfig({ limit: 500 }).limit).toBe(500)
      expect(sanitizeConfig({ limit: 200000 }).limit).toBe(100000)
      expect(sanitizeConfig({ limit: "invalid" as any }).limit).toBe(DEFAULT_CONFIG.limit)
    })
  })

  describe("headingLevels sanitization", () => {
    it("should filter valid 1-6 integers, deduplicate, and sort", () => {
      const config = sanitizeConfig({ headingLevels: [4, 2, 2, 1, 7, 0, -1] })
      expect(config.headingLevels).toEqual([1, 2, 4])
    })

    it("should keep base levels if provided array is empty or invalid", () => {
      const config = sanitizeConfig({ headingLevels: [9, 10] })
      expect(config.headingLevels).toEqual(DEFAULT_CONFIG.headingLevels)
    })
  })

  describe("favorites sanitization", () => {
    it("should keep valid favorites and slice to at most 10", () => {
      const manyFavs = Array.from({ length: 15 }, (_, i) => ({
        id: `fav-${i}`,
        docId: `doc-${i}`,
        box: "b",
        path: "/p",
        hpath: "/h",
        title: `Fav ${i}`,
        status: "all" as const,
        showHeadings: true,
        headingLevels: [1],
        createdAt: 1000,
      }))

      const config = sanitizeConfig({ favorites: manyFavs })
      expect(config.favorites).toHaveLength(10)
      expect(config.favorites[0].id).toBe("fav-0")
      expect(config.favorites[9].id).toBe("fav-9")
    })

    it("should filter out malformed favorite items", () => {
      const config = sanitizeConfig({
        favorites: [
          { id: "fav-1", docId: "doc-1" },
          { id: "fav-no-doc" },
          null,
          "invalid",
        ],
      })
      expect(config.favorites).toHaveLength(1)
      expect(config.favorites[0].id).toBe("fav-1")
    })
  })

  describe("scope and flags", () => {
    it("should safely merge scope and boolean flags", () => {
      const config = sanitizeConfig({
        scope: { mode: "notebook", box: "nb-1" },
        showHeadings: false,
        sortTodoFirst: true,
        countUnfinished: true,
        clickStatusMenu: true,
        foldedKeys: ["k1", "k2", 123 as any],
        docSort: "title-desc",
      })
      expect(config.scope.mode).toBe("notebook")
      expect(config.scope.box).toBe("nb-1")
      expect(config.showHeadings).toBe(false)
      expect(config.sortTodoFirst).toBe(true)
      expect(config.countUnfinished).toBe(true)
      expect(config.clickStatusMenu).toBe(true)
      expect(config.foldedKeys).toEqual(["k1", "k2"])
      expect(config.docSort).toBe("title-desc")
    })

    it("should fallback docSort to default when invalid", () => {
      expect(sanitizeConfig({ docSort: "unknown-sort" }).docSort).toBe("updated-desc")
      expect(sanitizeConfig({ docSort: 123 as any }).docSort).toBe("updated-desc")
    })
  })
})
