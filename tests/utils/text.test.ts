import { describe, expect, it } from "vitest"
import { escapeHtml, highlightText, normalizeKeyword } from "@/utils/text"

describe("src/utils/text.ts", () => {
  describe("escapeHtml", () => {
    it("should escape special characters", () => {
      expect(escapeHtml("<script>alert('xss')&\"test\"</script>")).toBe(
        "&lt;script&gt;alert('xss')&amp;&quot;test&quot;&lt;/script&gt;",
      )
    })

    it("should handle empty or normal text", () => {
      expect(escapeHtml("")).toBe("")
      expect(escapeHtml("Hello World")).toBe("Hello World")
    })
  })

  describe("normalizeKeyword", () => {
    it("should trim and lower-case keyword", () => {
      expect(normalizeKeyword("  Hello World  ")).toBe("hello world")
      expect(normalizeKeyword("")).toBe("")
      expect(normalizeKeyword(null as unknown as string)).toBe("")
    })
  })

  describe("highlightText", () => {
    it("should return escaped text when keyword is empty", () => {
      expect(highlightText("Hello <b>World</b>", "")).toBe("Hello &lt;b&gt;World&lt;/b&gt;")
    })

    it("should highlight single match with mark tag", () => {
      expect(highlightText("Apple Banana Orange", "banana")).toBe(
        "Apple <mark class=\"tl-highlight\">Banana</mark> Orange",
      )
    })

    it("should highlight multiple matches", () => {
      expect(highlightText("test 1, test 2, test 3", "test")).toBe(
        "<mark class=\"tl-highlight\">test</mark> 1, <mark class=\"tl-highlight\">test</mark> 2, <mark class=\"tl-highlight\">test</mark> 3",
      )
    })

    it("should support custom highlight mark class or no class", () => {
      expect(highlightText("item test", "test", "")).toBe("item <mark>test</mark>")
    })

    it("should safely escape non-matching parts", () => {
      expect(highlightText("<Hello> world", "world")).toBe(
        "&lt;Hello&gt; <mark class=\"tl-highlight\">world</mark>",
      )
    })
  })
})
