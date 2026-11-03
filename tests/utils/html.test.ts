import { describe, expect, it } from "vitest"
import { decodeHtmlEntities, stripHtml } from "@/utils/html"

describe("src/utils/html.ts", () => {
  describe("stripHtml", () => {
    it("should strip simple HTML tags", () => {
      expect(stripHtml("<h1>Title</h1>")).toBe("Title")
      expect(stripHtml("<span>Hello</span> <b>World</b>")).toBe("Hello World")
      expect(stripHtml("<div class=\"test\">Content</div>")).toBe("Content")
    })

    it("should handle nested tags and attributes", () => {
      expect(stripHtml("<a href=\"https://example.com\" target=\"_blank\">Link <i>text</i></a>")).toBe("Link text")
      expect(stripHtml("<span style=\"color: red;\">Styled</span>")).toBe("Styled")
    })

    it("should decode common HTML entities", () => {
      expect(stripHtml("&lt;Hello&gt; &amp; &quot;World&quot;")).toBe("<Hello> & \"World\"")
      expect(stripHtml("A&nbsp;&nbsp;B")).toBe("A  B")
      expect(stripHtml("It&#39;s fine")).toBe("It's fine")
    })

    it("should handle null, undefined, or empty strings gracefully", () => {
      expect(stripHtml("")).toBe("")
      expect(stripHtml(null as unknown as string)).toBe("")
      expect(stripHtml(undefined as unknown as string)).toBe("")
      expect(stripHtml("   ")).toBe("")
    })

    it("should preserve pure plain text without tags", () => {
      expect(stripHtml("Normal heading text")).toBe("Normal heading text")
    })
  })

  describe("decodeHtmlEntities", () => {
    it("should decode numeric and named entities", () => {
      expect(decodeHtmlEntities("&amp;")).toBe("&")
      expect(decodeHtmlEntities("&lt;")).toBe("<")
      expect(decodeHtmlEntities("&gt;")).toBe(">")
      expect(decodeHtmlEntities("&quot;")).toBe("\"")
      expect(decodeHtmlEntities("&#39;")).toBe("'")
      expect(decodeHtmlEntities("&#x2F;")).toBe("/")
      expect(decodeHtmlEntities("&nbsp;")).toBe(" ")
    })
  })
})
