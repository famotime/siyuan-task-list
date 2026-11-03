/**
 * 分组树操作工具：递归收集节点标识等。
 */
import type { TaskGroup } from "@/data/types"

/**
 * 递归收集分组自身及其所有后代分组的 key。
 */
export function collectGroupKeys(group: TaskGroup): string[] {
  const keys: string[] = [group.key]
  function walk(g: TaskGroup) {
    for (const child of g.children) {
      keys.push(child.key)
      walk(child)
    }
  }
  walk(group)
  return keys
}
