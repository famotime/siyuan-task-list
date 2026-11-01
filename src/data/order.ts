/**
 * 同列表块源顺序解析。
 *
 * 内核事实：blocks.sort 是按块类型取的固定权重（siyuan-note kernel/sql/database.go
 * nSort），不是同级位置序；blocktrees 表亦无顺序列。列表项在原文档中的真实先后
 * 只能从父列表块的 kramdown 导出中还原（块 ID 以 IAL 形式按文档序出现）。
 */
import { getBlockKramdowns } from "@/api"

const CHUNK = 50

/** 思源块 ID：14 位时间戳 + "-" + 7 位随机后缀 */
const BLOCK_ID_RE = /[0-9]{14}-[0-9a-z]{7}/g

/**
 * 解析列表块的直接子项文档序。
 * @returns 列表块 id -> (子块 id -> 首次出现序)；解析失败的块不出现
 */
export async function resolveListChildOrder(
  listIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>()
  const unique = [...new Set(listIds)]
  for (let i = 0; i < unique.length; i += CHUNK) {
    const part = unique.slice(i, i + CHUNK)
    let raw: any
    try {
      raw = await getBlockKramdowns(part)
    } catch {
      continue
    }
    // 实测响应：data 为 { blockId: kramdown } 映射；兼容数组形态
    let entries: [string, string][] = []
    if (Array.isArray(raw)) {
      entries = raw
        .filter((item: any) => item?.id && typeof item.kramdown === "string")
        .map((item: any) => [item.id as string, item.kramdown as string])
    } else if (Array.isArray(raw?.data)) {
      entries = raw.data
        .filter((item: any) => item?.id && typeof item.kramdown === "string")
        .map((item: any) => [item.id as string, item.kramdown as string])
    } else if (raw && typeof raw === "object") {
      const map = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw
      entries = Object.entries(map).filter(([, value]) => typeof value === "string") as [string, string][]
    }
    for (const [id, kramdown] of entries) {
      const order = new Map<string, number>()
      let matched: RegExpExecArray | null
      const re = new RegExp(BLOCK_ID_RE)
      while ((matched = re.exec(kramdown)) !== null) {
        if (!order.has(matched[0])) {
          order.set(matched[0], order.size)
        }
      }
      result.set(id, order)
    }
  }
  return result
}
