/**
 * 标题归属解析。
 *
 * 内核事实：索引期 buildBlockFromNode 会用 treenode.HeadingParent 把标题下方块的
 * parent_id 改写为语义父标题（siyuan-note kernel/sql/database.go），因此沿
 * parent_id 链逐级回溯即可得到块的标题祖先链；标题的 parent_id 又指向更高一级
 * 标题或文档块，链路自然终止于 type='d'。
 *
 * 标题同级顺序：blocks 表无兄弟位置信息（sort 列是类型权重），用
 * /api/outline/getDocOutline 的文档序校正；大纲不收录的标题（引述/Callout/
 * 选项卡内）按块 id 兜底，排在其同级已收录标题之后。
 */
import { getDocOutline, sql } from "@/api"
import type { HeadingNode } from "@/data/types"
import { stripHtml } from "@/utils/html"

const IN_CHUNK = 400
const MAX_DEPTH = 40

interface AncestorRow {
  id: string
  parent_id: string
  type: string
  subtype: string
  content: string
}

function esc(value: string): string {
  return value.replace(/'/g, "''")
}

function chunk<T>(arr: T[], size = IN_CHUNK): T[][] {
  const ret: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    ret.push(arr.slice(i, i + size))
  }
  return ret
}

export function levelOf(subtype: string): number {
  const level = Number.parseInt((subtype ?? "").slice(1), 10)
  return Number.isFinite(level) && level >= 1 && level <= 6 ? level : 6
}

async function fetchAncestors(ids: string[], memo: Map<string, AncestorRow>): Promise<void> {
  for (const part of chunk(ids)) {
    const rows = await sql(
      `SELECT id, parent_id, type, subtype, content FROM blocks ` +
      `WHERE id IN (${part.map((id) => `'${esc(id)}'`).join(",")}) LIMIT ${part.length}`,
    )
    for (const row of rows as any[]) {
      memo.set(row.id, row)
    }
  }
}

/** 大纲文档序：headingId -> 全文档序号（DFS 计数） */
async function fetchOutlineOrder(rootId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const tree = await getDocOutline(rootId)
    let counter = 0
    // 实测结构：顶层为 h1 数组；子级标题挂在节点的 children 或 blocks 数组中
    const walk = (nodes: any[]) => {
      if (!Array.isArray(nodes)) {
        return
      }
      for (const node of nodes) {
        if (node?.id) {
          map.set(node.id, counter++)
        }
        if (Array.isArray(node?.children)) {
          walk(node.children)
        }
        if (Array.isArray(node?.blocks)) {
          walk(node.blocks)
        }
      }
    }
    if (Array.isArray(tree)) {
      walk(tree)
    } else if (Array.isArray(tree?.data)) {
      walk(tree.data)
    }
  } catch {
    // 大纲获取失败不阻塞主流程，顺序回退按 id
  }
  return map
}

export interface HeadingResolution {
  /** rootId -> 标题 id -> 节点（仅含任务祖先链上的标题） */
  docHeadings: Map<string, Map<string, HeadingNode>>
  /** 任务父块 id -> { path: 文档级→最近父标题, nearestId } */
  pathByParentId: Map<string, { path: HeadingNode[], nearestId: string | null }>
  /** 任务所属列表块 id -> 其父块 id（嵌套子列表时该父块为父任务项 id） */
  parentBlockIdByListId: Map<string, string>
}

/**
 * 解析所有任务父块的标题祖先链。
 * @param parentRootIds 任务父块（列表块）id -> 所在文档 id（同列表块任务必同文档）
 */
export async function resolveHeadingPaths(
  parentRootIds: Map<string, string>,
): Promise<HeadingResolution> {
  const memo = new Map<string, AncestorRow>()
  const parentIds = [...parentRootIds.keys()]

  // 1. 自底向上批量回溯祖先链
  let frontier = parentIds.filter((id) => !memo.has(id))
  for (let depth = 0; frontier.length > 0 && depth < MAX_DEPTH; depth++) {
    await fetchAncestors(frontier, memo)
    const next = new Set<string>()
    for (const id of frontier) {
      const row = memo.get(id)
      if (!row || row.type === "d") {
        continue
      }
      if (row.parent_id && !memo.has(row.parent_id)) {
        next.add(row.parent_id)
      }
    }
    frontier = [...next]
  }

  // 2. 每个文档的大纲顺序（每个刷新周期一次调用，失败静默回退）
  const outlineOrders = new Map<string, Map<string, number>>()
  const rootIds = [...new Set(parentRootIds.values())]
  await Promise.all(rootIds.map(async (rootId) => {
    outlineOrders.set(rootId, await fetchOutlineOrder(rootId))
  }))

  /** 沿 memo 向上收集标题祖先：最近 → 最远 */
  const collectHeadings = (startId: string): AncestorRow[] => {
    const headings: AncestorRow[] = []
    const visited = new Set<string>()
    let current: string | undefined = startId
    while (current && !visited.has(current) && memo.has(current)) {
      visited.add(current)
      const row = memo.get(current)!
      if (row.type === "d") {
        break
      }
      if (row.type === "h") {
        headings.push(row)
      }
      current = row.parent_id || undefined
    }
    return headings
  }

  const pathByParentId = new Map<string, { path: HeadingNode[], nearestId: string | null }>()
  const docHeadings = new Map<string, Map<string, HeadingNode>>()

  const buildNode = (row: AncestorRow, rootId: string): HeadingNode => {
    // 树父节点 = 最近标题祖先（容器块折叠）；用于渲染分组树
    const ancestors = collectHeadings(row.parent_id || "")
    const nearest = ancestors.length > 0 ? ancestors[0] : null
    const outlineOrder = outlineOrders.get(rootId)?.get(row.id)
    return {
      id: row.id,
      content: stripHtml(row.content),
      level: levelOf(row.subtype),
      parentId: nearest ? nearest.id : null,
      // 大纲未收录的标题排在其文档之后，按 id 稳定兜底
      order: outlineOrder ?? Number.MAX_SAFE_INTEGER,
    }
  }

  for (const parentId of parentIds) {
    const rootId = parentRootIds.get(parentId) ?? ""
    const chain = collectHeadings(parentId) // 最近 → 最远
    const nodePath = chain.slice().reverse().map((row) => buildNode(row, rootId))
    pathByParentId.set(parentId, {
      path: nodePath,
      nearestId: chain.length > 0 ? chain[0].id : null,
    })

    // 收集该链上的标题到文档标题集合
    if (rootId) {
      const headingMap = docHeadings.get(rootId) ?? new Map<string, HeadingNode>()
      for (const node of nodePath) {
        if (!headingMap.has(node.id)) {
          headingMap.set(node.id, node)
        }
      }
      docHeadings.set(rootId, headingMap)
    }
  }

  const parentBlockIdByListId = new Map<string, string>()
  for (const parentId of parentIds) {
    const row = memo.get(parentId)
    if (row?.parent_id) {
      parentBlockIdByListId.set(parentId, row.parent_id)
    }
  }

  return { docHeadings, pathByParentId, parentBlockIdByListId }
}
