import { describe, expect, it } from "vitest"
import { collectGroupKeys } from "@/utils/tree"
import type { TaskGroup } from "@/data/types"

function createMockGroup(key: string, children: TaskGroup[] = []): TaskGroup {
  return {
    key,
    kind: "doc",
    title: key,
    level: 0,
    children,
    listGroups: [],
    total: 0,
    done: 0,
  }
}

describe("src/utils/tree.ts", () => {
  describe("collectGroupKeys", () => {
    it("should return single key for leaf group", () => {
      const g = createMockGroup("doc-1")
      expect(collectGroupKeys(g)).toEqual(["doc-1"])
    })

    it("should recursively collect keys in depth-first order", () => {
      const g = createMockGroup("doc-1", [
        createMockGroup("h-1", [
          createMockGroup("h-1-1"),
        ]),
        createMockGroup("h-2"),
      ])
      expect(collectGroupKeys(g)).toEqual(["doc-1", "h-1", "h-1-1", "h-2"])
    })
  })
})
