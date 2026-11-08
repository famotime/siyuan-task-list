import { describe, expect, it } from "vitest"
import {
  computeTaskStatusCounts,
  extractCustomMarkers,
  formatStatusFilterLabel,
  isTaskCanceled,
  isTaskCustom,
  isTaskDone,
  isTaskInProgress,
  isTaskTodo,
  isValidTaskMarker,
  markerForStatus,
  matchTaskStatus,
  normalizeStatusFilter,
  parseTaskLine,
  parseTaskMarker,
  resolveTaskStatus,
  UNFINISHED_TASK_STATUSES,
} from "@/data/status"

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

  describe("predicate functions", () => {
    it("isTaskDone should treat only 'x' or 'X' as done", () => {
      expect(isTaskDone("x")).toBe(true)
      expect(isTaskDone("X")).toBe(true)
      expect(isTaskDone(" x ")).toBe(true)
      expect(isTaskDone(" ")).toBe(false)
      expect(isTaskDone("/")).toBe(false)
      expect(isTaskDone("-")).toBe(false)
      expect(isTaskDone("!")).toBe(false)
    })

    it("isTaskInProgress should identify '/'", () => {
      expect(isTaskInProgress("/")).toBe(true)
      expect(isTaskInProgress(" / ")).toBe(true)
      expect(isTaskInProgress(" ")).toBe(false)
      expect(isTaskInProgress("x")).toBe(false)
    })

    it("isTaskCanceled should identify '-'", () => {
      expect(isTaskCanceled("-")).toBe(true)
      expect(isTaskCanceled(" - ")).toBe(true)
      expect(isTaskCanceled("x")).toBe(false)
    })

    it("isTaskTodo should identify space or empty", () => {
      expect(isTaskTodo(" ")).toBe(true)
      expect(isTaskTodo("")).toBe(true)
      expect(isTaskTodo("/")).toBe(false)
    })

    it("isTaskCustom should identify other single characters", () => {
      expect(isTaskCustom("!")).toBe(true)
      expect(isTaskCustom("?")).toBe(true)
      expect(isTaskCustom("A")).toBe(true)
      expect(isTaskCustom("1")).toBe(true)
      expect(isTaskCustom(" ")).toBe(false)
      expect(isTaskCustom("/")).toBe(false)
      expect(isTaskCustom("x")).toBe(false)
      expect(isTaskCustom("-")).toBe(false)
    })
  })

  describe("resolveTaskStatus", () => {
    it("should resolve correct TaskStatus for any marker", () => {
      expect(resolveTaskStatus(" ")).toBe("todo")
      expect(resolveTaskStatus("")).toBe("todo")
      expect(resolveTaskStatus("/")).toBe("in_progress")
      expect(resolveTaskStatus("x")).toBe("done")
      expect(resolveTaskStatus("X")).toBe("done")
      expect(resolveTaskStatus("-")).toBe("canceled")
      expect(resolveTaskStatus("!")).toBe("custom")
      expect(resolveTaskStatus("?")).toBe("custom")
    })
  })

  describe("isValidTaskMarker", () => {
    it("should validate legal ASCII markers except brackets", () => {
      expect(isValidTaskMarker(" ")).toBe(true)
      expect(isValidTaskMarker("/")).toBe(true)
      expect(isValidTaskMarker("x")).toBe(true)
      expect(isValidTaskMarker("-")).toBe(true)
      expect(isValidTaskMarker("!")).toBe(true)
      expect(isValidTaskMarker("A")).toBe(true)

      expect(isValidTaskMarker("")).toBe(false)
      expect(isValidTaskMarker("ab")).toBe(false)
      expect(isValidTaskMarker("[")).toBe(false)
      expect(isValidTaskMarker("]")).toBe(false)
      expect(isValidTaskMarker("\n")).toBe(false)
    })
  })

  describe("markerForStatus", () => {
    it("should return 'x' for done and ' ' for open (boolean overload)", () => {
      expect(markerForStatus(true)).toBe("x")
      expect(markerForStatus(false)).toBe(" ")
    })

    it("should return correct marker for TaskStatus enum", () => {
      expect(markerForStatus("todo")).toBe(" ")
      expect(markerForStatus("in_progress")).toBe("/")
      expect(markerForStatus("done")).toBe("x")
      expect(markerForStatus("canceled")).toBe("-")
      expect(markerForStatus("custom", "?")).toBe("?")
      expect(markerForStatus("custom")).toBe("!")
    })
  })

  describe("normalizeStatusFilter & matchTaskStatus", () => {
    it("should match 'all' preset to any status", () => {
      expect(matchTaskStatus({ status: "todo", marker: " " }, "all")).toBe(true)
      expect(matchTaskStatus({ status: "in_progress", marker: "/" }, "all")).toBe(true)
      expect(matchTaskStatus({ status: "done", marker: "x" }, "all")).toBe(true)
      expect(matchTaskStatus({ status: "canceled", marker: "-" }, "all")).toBe(true)
      expect(matchTaskStatus({ status: "custom", marker: "!" }, "all")).toBe(true)
    })

    it("should match single status string", () => {
      expect(matchTaskStatus({ status: "in_progress", marker: "/" }, "in_progress")).toBe(true)
      expect(matchTaskStatus({ status: "todo", marker: " " }, "in_progress")).toBe(false)
    })

    it("should match array of statuses", () => {
      const filter = ["todo", "in_progress"] as const
      expect(matchTaskStatus({ status: "todo", marker: " " }, [...filter])).toBe(true)
      expect(matchTaskStatus({ status: "in_progress", marker: "/" }, [...filter])).toBe(true)
      expect(matchTaskStatus({ status: "done", marker: "x" }, [...filter])).toBe(false)
      expect(matchTaskStatus({ status: "canceled", marker: "-" }, [...filter])).toBe(false)
    })

    it("should match StatusFilterConfig with customMarkers", () => {
      const config = {
        types: ["custom"] as const,
        customMarkers: ["!"],
      }
      expect(matchTaskStatus({ status: "custom", marker: "!" }, { types: [...config.types], customMarkers: config.customMarkers })).toBe(true)
      expect(matchTaskStatus({ status: "custom", marker: "?" }, { types: [...config.types], customMarkers: config.customMarkers })).toBe(false)
    })
  })

  describe("extractCustomMarkers", () => {
    it("should extract and sort custom markers by frequency", () => {
      const tasks = [
        { status: "custom" as const, marker: "!" },
        { status: "custom" as const, marker: "?" },
        { status: "custom" as const, marker: "!" },
        { status: "in_progress" as const, marker: "/" },
        { status: "custom" as const, marker: "A" },
        { status: "custom" as const, marker: "!" },
      ]
      const extracted = extractCustomMarkers(tasks)
      expect(extracted).toEqual([
        { marker: "!", count: 3 },
        { marker: "?", count: 1 },
        { marker: "A", count: 1 },
      ])
    })
  })

  describe("computeTaskStatusCounts", () => {
    it("should count all statuses accurately", () => {
      const tasks = [
        { status: "todo" as const },
        { status: "todo" as const },
        { status: "in_progress" as const },
        { status: "done" as const },
        { status: "canceled" as const },
        { status: "custom" as const },
        { status: "custom" as const },
      ]
      expect(computeTaskStatusCounts(tasks)).toEqual({
        todo: 2,
        inProgress: 1,
        done: 1,
        canceled: 1,
        custom: 2,
      })
    })
  })

  describe("UNFINISHED_TASK_STATUSES & formatStatusFilterLabel", () => {
    it("should include canceled in UNFINISHED_TASK_STATUSES", () => {
      expect(UNFINISHED_TASK_STATUSES).toEqual([
        "todo",
        "in_progress",
        "canceled",
        "custom",
      ])
    })

    it("should format label for unfinished preset correctly", () => {
      expect(formatStatusFilterLabel([...UNFINISHED_TASK_STATUSES])).toBe("未完成")
      expect(formatStatusFilterLabel(["done"])).toBe("完成")
      expect(formatStatusFilterLabel("all")).toBe("全部")
    })
  })
})
