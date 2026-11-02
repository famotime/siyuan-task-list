/**
 * 汇总范围解析：把 ScopeSelection 翻译成任务主查询的 SQL 谓词。
 *
 * 内核事实：
 * - 任务项为 blocks.type='i' AND subtype='t'
 * - 子文档在存储上是 /<父文档id>/<子文档id>.sy，故子树前缀为 /<docId>/
 * - 出链文档取 refs 表（块引用+嵌入块），一层不递归：
 *   SELECT DISTINCT def_block_root_id FROM refs WHERE root_id IN (...)
 * - 查询必须显式 LIMIT（否则内核按 search.limit=64 截断）
 */
import { sql, sqlWithMeta } from "@/api"
import type {
  DocEntry,
  ScopeSelection,
} from "@/data/types"

const IN_CHUNK = 400

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

function inList(ids: string[]): string {
  return ids.map((id) => `'${esc(id)}'`).join(",")
}

/**
 * 子文档存储路径前缀：思源文档路径为 /<各级祖先id>/<文档id>.sy，
 * 其子文档位于 <自身路径去 .sy>/${文档id}.sy 形态之下，故子树前缀
 * = 自身路径去 ".sy" 加 "/"（覆盖全部后代层级）。
 */
function subdocPrefix(path: string): string {
  return `${path.replace(/\.sy$/, "")}/`
}

export const TASK_QUERY_COLUMNS = "id, parent_id, root_id, box, path, hpath, content, markdown, updated"

export interface ScopeContext {
  selection: ScopeSelection
  /** 语句外层 LIMIT（显式携带，避免内核 64 条默认截断） */
  limit: number
  /** 笔记本列表（用于解析以笔记本名开头的排除路径） */
  notebooks?: { id: string, name: string }[]
}

/** 解析出指定范围涉及的基准文档 id（activeDoc/path 档用于链接文档回溯） */
export async function resolveScopeDocIds(sel: ScopeSelection): Promise<string[]> {
  if (sel.mode === "activeDoc" && sel.docId) {
    return [sel.docId]
  }
  if (sel.mode === "path" && sel.box && sel.path) {
    const sub = sel.includeSubdocs
      ? ` OR path LIKE '${esc(subdocPrefix(sel.path))}%'`
      : ""
    const rows = await sql(
      `SELECT id FROM blocks WHERE type='d' AND box='${esc(sel.box)}' AND (path='${esc(sel.path)}'${sub}) LIMIT ${sel.includeSubdocs ? 2000 : 1}`,
    )
    return rows.map((row: any) => row.id as string)
  }
  return []
}

/** 链接文档：出链目标文档（一层、去重、排除范围自身） */
export async function resolveLinkedDocIds(baseDocIds: string[]): Promise<string[]> {
  if (baseDocIds.length === 0) {
    return []
  }
  const chunks = chunk(baseDocIds)
  const linked = new Set<string>()
  const baseSet = new Set(baseDocIds)
  for (const ids of chunks) {
    // join blocks 限定目标必须真实存在且为文档块
    const rows = await sql(
      `SELECT DISTINCT r.def_block_root_id AS id FROM refs r ` +
      `JOIN blocks b ON b.id = r.def_block_root_id AND b.type='d' ` +
      `WHERE r.root_id IN (${inList(ids)}) LIMIT 2000`,
    )
    for (const row of rows as any[]) {
      if (row.id && !baseSet.has(row.id)) {
        linked.add(row.id)
      }
    }
  }
  return [...linked]
}

/** 构造任务主查询语句 */
export async function buildTaskQuery(ctx: ScopeContext): Promise<string> {
  const { selection: sel, limit } = ctx

  // 范围信息不完整（如路径档尚未选择文档）时，返回空结果而不是退化成全库查询
  const incomplete
    = (sel.mode === "activeDoc" && !sel.docId)
      || (sel.mode === "path" && (!sel.box || !sel.path))
      || (sel.mode === "notebook" && !sel.box)
  if (incomplete) {
    return `SELECT ${TASK_QUERY_COLUMNS} FROM blocks WHERE type='i' AND subtype='t' AND 1=0 LIMIT ${limit}`
  }

  let predicate = "1=1"

  if (sel.mode === "notebook" && sel.box) {
    predicate = `box='${esc(sel.box)}'`
  } else if (sel.mode === "path" && sel.box && sel.path) {
    const parts: string[] = []
    if (sel.includeSubdocs) {
      parts.push(`(box='${esc(sel.box)}' AND (path='${esc(sel.path)}' OR path LIKE '${esc(subdocPrefix(sel.path))}%'))`)
    } else {
      parts.push(`(box='${esc(sel.box)}' AND path='${esc(sel.path)}')`)
    }
    if (sel.includeLinked) {
      const baseIds = await resolveScopeDocIds(sel)
      const linkedIds = await resolveLinkedDocIds(baseIds)
      for (const ids of chunk(linkedIds)) {
        parts.push(`root_id IN (${inList(ids)})`)
      }
    }
    predicate = parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0]
  } else if (sel.mode === "activeDoc" && sel.docId) {
    const parts = [`root_id='${esc(sel.docId)}'`]
    if (sel.includeLinked) {
      const linkedIds = await resolveLinkedDocIds([sel.docId])
      for (const ids of chunk(linkedIds)) {
        parts.push(`root_id IN (${inList(ids)})`)
      }
    }
    predicate = parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0]
  }
  // mode === "all"：无谓词

  // 排除路径（notebook / all 档）：命中前缀的文档自身与子树一并排除
  if (sel.mode === "notebook" || sel.mode === "all") {
    const rawExcluded = normalizeExcludePaths(sel.excludePaths ?? [])
    if (rawExcluded.length > 0) {
      const nbs = ctx.notebooks ?? []
      const fallbackBox = sel.mode === "notebook" ? sel.box : undefined
      const conds: string[] = []
      for (const raw of rawExcluded) {
        const parsed = parseExcludePath(raw, nbs, fallbackBox)
        const sub = `(hpath = '${esc(parsed.hpath)}' OR hpath LIKE '${esc(parsed.hpath)}/%')`
        if (sel.mode === "all" && parsed.boxId) {
          conds.push(`(box = '${esc(parsed.boxId)}' AND ${sub})`)
        } else {
          conds.push(sub)
        }
      }
      if (conds.length > 0) {
        predicate += ` AND NOT (${conds.join(" OR ")})`
      }
    }
  }

  return (
    `SELECT ${TASK_QUERY_COLUMNS} FROM blocks ` +
    `WHERE type='i' AND subtype='t' AND ${predicate} ` +
    `ORDER BY root_id, updated LIMIT ${limit}`
  )
}

export interface ParsedExcludePath {
  /** 匹配到的笔记本 box id；未匹配任何已知笔记本时为 undefined（通配全部笔记本） */
  boxId?: string
  /** 笔记本内实际 hpath（以 / 开头） */
  hpath: string
  /** 规范的显示路径（从具体笔记本作为根目录显示，形如 /笔记本名/子路径） */
  displayPath: string
}

/**
 * 解析排除路径：支持前缀为笔记本名称的完整可读路径（形如 /笔记本名/文档路径）。
 * 若未匹配笔记本名称且处于具体笔记本模式，则自动以 fallbackBoxId 对应的笔记本为根补齐显示路径。
 */
export function parseExcludePath(
  rawPath: string,
  notebooks: { id: string, name: string }[],
  fallbackBoxId?: string,
): ParsedExcludePath {
  let p = (rawPath ?? "").trim()
  if (!p) {
    return { hpath: "/", displayPath: "/" }
  }
  if (!p.startsWith("/")) {
    p = `/${p}`
  }
  while (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1)
  }

  // 1. 检查是否以已知笔记本名称开头：/笔记本名/... 或 /笔记本名
  for (const nb of notebooks) {
    if (nb.name) {
      const prefix = `/${nb.name}`
      if (p === prefix) {
        return {
          boxId: nb.id,
          hpath: "/",
          displayPath: prefix,
        }
      }
      if (p.startsWith(`${prefix}/`)) {
        return {
          boxId: nb.id,
          hpath: p.slice(prefix.length),
          displayPath: p,
        }
      }
    }
  }

  // 2. 若未显式携带笔记本前缀，但处于单笔记本模式下，由当前笔记本作为根目录补全
  if (fallbackBoxId) {
    const matchedNb = notebooks.find((nb) => nb.id === fallbackBoxId)
    if (matchedNb?.name) {
      return {
        boxId: fallbackBoxId,
        hpath: p,
        displayPath: `/${matchedNb.name}${p}`,
      }
    }
  }

  return {
    boxId: undefined,
    hpath: p,
    displayPath: p,
  }
}

/** 规范化排除路径：补前导 /、去尾部 /，丢弃空值与根路径，去重 */
export function normalizeExcludePaths(paths: string[]): string[] {
  const out: string[] = []
  for (const raw of paths ?? []) {
    let p = (raw ?? "").trim()
    if (!p) {
      continue
    }
    if (!p.startsWith("/")) {
      p = `/${p}`
    }
    while (p.length > 1 && p.endsWith("/")) {
      p = p.slice(0, -1)
    }
    if (p === "/" || out.includes(p)) {
      continue
    }
    out.push(p)
  }
  return out
}

export interface TaskRow {
  id: string
  parent_id: string
  root_id: string
  box: string
  hpath: string
  content: string
  markdown: string
  updated: string
}

export async function queryTaskRows(stmt: string): Promise<{ rows: TaskRow[], truncated: boolean }> {
  const { rows, truncated } = await sqlWithMeta<TaskRow>(stmt)
  return { rows, truncated }
}

/** 文档选择器：按 hpath 拉取笔记本内文档（拉全量构建树，上限 2000） */
export async function listDocsOfNotebook(box: string): Promise<DocEntry[]> {
  const { rows } = await sqlWithMeta(
    `SELECT id, box, path, hpath, content FROM blocks ` +
    `WHERE type='d' AND box='${esc(box)}' ORDER BY hpath LIMIT 2000`,
  )
  return (rows as any[]).map((row) => ({
    id: row.id,
    box: row.box,
    path: row.path,
    hpath: row.hpath,
    title: row.content || row.hpath.split("/").pop() || row.hpath,
  }))
}

/** 检查文档 id 是否真实存在（activeDoc 档在切换文档后校验） */
export async function docExists(docId: string): Promise<boolean> {
  const rows = await sql(`SELECT id FROM blocks WHERE type='d' AND id='${esc(docId)}' LIMIT 1`)
  return rows.length > 0
}
