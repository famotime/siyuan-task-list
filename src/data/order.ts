/**
 * 任务源顺序解析。
 *
 * 内核事实：
 * 1. blocks.sort 是按块类型取的固定权重（siyuan-note kernel/sql/database.go nSort），不是同级位置序；
 * 2. 块在文档中的真实先后顺序可通过内核 /api/block/getDocBlocksOrders(rootId) 取得（AST 深度优先先序遍历顺序）；
 * 3. 若内核接口不可用，回退至通过 getBlockKramdowns 解析列表块 kramdown 中的 IAL 出现序。
 */
import { getBlockKramdowns, getDocBlocksOrders } from "@/api"

const CHUNK_DOCS = 20
const CHUNK_LISTS = 50

/** 思源块 ID：14 位时间戳 + "-" + 7 位随机后缀 */
const BLOCK_ID_RE = /[0-9]{14}-[0-9a-z]{7}/g

/**
 * 解析文档内所有块的绝对文档序。
 * @param docIds 涉及的文档 root_id 列表
 * @param fallbackListIds 备用的列表父块 id 列表（用于降级时分析列表块 Kramdown）
 * @returns 文档 id 或列表块 id -> (块 id -> 绝对位置索引)
 */
export async function resolveDocBlockOrders(
  docIds: string[],
  fallbackListIds: string[] = [],
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>()
  const uniqueDocIds = [...new Set(docIds.filter(Boolean))]
  const failedDocIds: string[] = []

  // 1. 分批并发请求 getDocBlocksOrders 获取全局绝对文档序
  for (let i = 0; i < uniqueDocIds.length; i += CHUNK_DOCS) {
    const part = uniqueDocIds.slice(i, i + CHUNK_DOCS)
    await Promise.all(
      part.map(async (docId) => {
        try {
          const orders = await getDocBlocksOrders(docId)
          if (Array.isArray(orders)) {
            const orderMap = new Map<string, number>()
            for (let idx = 0; idx < orders.length; idx++) {
              orderMap.set(orders[idx], idx)
            }
            result.set(docId, orderMap)
            return
          }
        } catch {
          // 接口异常时回退
        }
        failedDocIds.push(docId)
      }),
    )
  }

  // 2. 若存在获取失败的文档且传入了 fallbackListIds，回退到按列表块 Kramdown 兜底解析
  if (failedDocIds.length > 0 && fallbackListIds.length > 0) {
    const fallbackOrders = await resolveListChildOrder(fallbackListIds)
    for (const [listId, map] of fallbackOrders) {
      result.set(listId, map)
    }
  }

  return result
}

/**
 * 解析列表块的直接子项文档序（降级兜底方案）。
 * @returns 列表块 id -> (子块 id -> 首次出现序)；解析失败的块不出现
 */
export async function resolveListChildOrder(
  listIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>()
  const unique = [...new Set(listIds.filter(Boolean))]
  for (let i = 0; i < unique.length; i += CHUNK_LISTS) {
    const part = unique.slice(i, i + CHUNK_LISTS)
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
