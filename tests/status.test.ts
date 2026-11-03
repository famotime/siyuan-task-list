import { describe, expect, it } from "vitest"
import { isTaskDone, markerForStatus, parseTaskLine, parseTaskMarker } from "@/data/status"

describe("src/data/status.ts", () => {
  describe("parseTaskLine", () => {
    it("should parse standard markdown task list items", () => {
      expect(parseTaskLine("- [ ] simple task")).toEqual({
        marker: " ",
        text: " simple task",
      })
      expect(parseTaskLine("- [x] completed task")).toEqual({
        marker: "x",
        text: " completed task",
      })
      expect(parseTaskLine("* [X] uppercase done")).toEqual({
        marker: "X",
        text: " uppercase done",
      })
      expect(parseTaskLine("+ [ ] plus task")).toEqual({
        marker: " ",
        text: " plus task",
      })
      expect(parseTaskLine("1. [ ] ordered task")).toEqual({
        marker: " ",
        text: " ordered task",
      })
    })

    it("should parse custom markers", () => {
      expect(parseTaskLine("- [/] in progress")).toEqual({
        marker: "/",
        text: " in progress",
      })
      expect(parseTaskLine("- [-] cancelled")).toEqual({
        marker: "-",
        text: " cancelled",
      })
      expect(parseTaskLine("- [!] important")).toEqual({
        marker: "!",
        text: " important",
      })
    })

    it("should return null for non-task markdown", () => {
      expect(parseTaskLine("Just normal text")).toBeNull()
      expect(parseTaskLine("- Normal list item")).toBeNull()
      expect(parseTaskLine("")).toBeNull()
    })
  })

  describe("parseTaskMarker", () => {
    it("should extract marker or default to space", () => {
      expect(parseTaskMarker("- [x] done")).toBe("x")
      expect(parseTaskMarker("- [/] ongoing")).toBe("/")
      expect(parseTaskMarker("regular text")).toBe(" ")
    })
  })

  describe("isTaskDone", () => {
    it("should treat only 'x' or 'X' as done", () => {
      expect(isTaskDone("x")).toBe(true)
      expect(isTaskDone("X")).toBe(true)
      expect(isTaskDone(" x ")).toBe(true)
      expect(isTaskDone(" ")).toBe(false)
      expect(isTaskDone("/")).toBe(false)
      expect(isTaskDone("-")).toBe(false)
      expect(isTaskDone("!")).toBe(false)
    })
  })

  describe("markerForStatus", () => {
    it("should return 'x' for done and ' ' for open", () => {
      expect(markerForStatus(true)).toBe("x")
      expect(markerForStatus(false)).toBe(" ")
    })
  })
})
