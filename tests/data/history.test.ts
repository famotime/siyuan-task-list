import { describe, expect, it } from "vitest"
import {
  addHistoryRecord,
  formatRelativeTime,
  getStatusText,
  markHistoryUndone,
  MAX_HISTORY_ITEMS,
  sanitizeHistory,
} from "@/data/history"
import type { TaskHistoryItem } from "@/data/types"

describe("src/data/history.ts", () => {
  const sampleItem: TaskHistoryItem = {
    id: "item-1",
    taskId: "block-1",
    rootId: "doc-1",
    docTitle: "/日常/工作",
    content: "完成代码审查",
    fromMarker: " ",
    toMarker: "x",
    fromStatus: "todo",
    toStatus: "done",
    timestamp: 1000000,
    undone: false,
  }

  describe("sanitizeHistory", () => {
    it("returns empty array for non-array input", () => {
      expect(sanitizeHistory(null)).toEqual([])
      expect(sanitizeHistory(undefined)).toEqual([])
      expect(sanitizeHistory("not array")).toEqual([])
      expect(sanitizeHistory({})).toEqual([])
    })

    it("filters out invalid items and normalizes fields", () => {
      const raw = [
        sampleItem,
        { invalid: true },
        { id: "item-2", taskId: "block-2", content: "任务2", timestamp: 12345, fromMarker: "/", toMarker: "x" },
      ]
      const sanitized = sanitizeHistory(raw)
      expect(sanitized).toHaveLength(2)
      expect(sanitized[0].id).toBe("item-1")
      expect(sanitized[1].id).toBe("item-2")
      expect(sanitized[1].fromStatus).toBe("in_progress")
      expect(sanitized[1].toStatus).toBe("done")
      expect(sanitized[1].undone).toBe(false)
    })

    it("caps at MAX_HISTORY_ITEMS", () => {
      const raw = Array.from({ length: 150 }, (_, i) => ({
        ...sampleItem,
        id: `item-${i}`,
      }))
      const sanitized = sanitizeHistory(raw)
      expect(sanitized).toHaveLength(MAX_HISTORY_ITEMS)
    })
  })

  describe("addHistoryRecord", () => {
    it("prepends new item to history and respects max limit", () => {
      const existing = [sampleItem]
      const newItem: TaskHistoryItem = {
        ...sampleItem,
        id: "item-new",
      }
      const res = addHistoryRecord(existing, newItem, 2)
      expect(res).toHaveLength(2)
      expect(res[0].id).toBe("item-new")
      expect(res[1].id).toBe("item-1")

      const thirdItem: TaskHistoryItem = {
        ...sampleItem,
        id: "item-third",
      }
      const capped = addHistoryRecord(res, thirdItem, 2)
      expect(capped).toHaveLength(2)
      expect(capped[0].id).toBe("item-third")
      expect(capped[1].id).toBe("item-new")
    })
  })

  describe("markHistoryUndone", () => {
    it("marks the matching item as undone", () => {
      const list = [sampleItem, { ...sampleItem, id: "item-2" }]
      const res = markHistoryUndone(list, "item-1")
      expect(res[0].undone).toBe(true)
      expect(res[1].undone).toBe(false)
    })
  })

  describe("formatRelativeTime", () => {
    const now = 1000000000000

    it("formats just now", () => {
      expect(formatRelativeTime(now - 10000, now)).toBe("刚刚")
    })

    it("formats minutes ago", () => {
      expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe("5分钟前")
    })

    it("formats hours ago", () => {
      expect(formatRelativeTime(now - 3 * 3600 * 1000, now)).toBe("3小时前")
    })

    it("formats days ago", () => {
      expect(formatRelativeTime(now - 2 * 86400 * 1000, now)).toBe("2天前")
    })
  })

  describe("getStatusText", () => {
    it("returns correct status labels", () => {
      expect(getStatusText("todo", " ")).toBe("待办")
      expect(getStatusText("done", "x")).toBe("完成")
      expect(getStatusText("in_progress", "/")).toBe("进行中")
      expect(getStatusText("canceled", "-")).toBe("放弃")
      expect(getStatusText("custom", "!")).toBe("[!]")
    })
  })
})
