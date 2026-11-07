/**
 * 任务汇集与分组树组装。
 * 查询编排：范围谓词 → 任务主查询 → 标题归属解析 + 源顺序解析 → 组装视图模型。
 */
import { lsNotebooks, sql } from "@/api"
import { resolveHeadingPaths } from "@/data/heading"
import { resolveDocBlockOrders } from "@/data/order"
import { buildTaskQuery, queryTaskRows } from "@/data/scope"
import { isTaskDone, parseTaskLine } from "@/data/status"
import type {
  DocMeta,
  DocSortMode,
  HeadingNode,
  ScopeSelection,
  TaskGroup,
  TaskItem,
  TaskListGroup,
  StatusFilter,
} from "@/data/types"

export type { StatusFilter } from "@/data/types"

export interface TaskCollection {
  tasks: TaskItem[]
  /** 服务端默认限制截断时为 true（显式 LIMIT 命中上限也视为截断） */
  truncated: boolean
  notebookNames: Map<string, string>
  docMetas: Map<string, DocMeta>
}

/** 批量获取文档根块的元数据（标题、创建时间、更新时间） */
export async function resolveDocMetas(docIds: string[]): Promise<Map<string, DocMeta>> {
  const result = new Map<string, DocMeta>()
  if (docIds.length === 0) {
    return result
  }
  const chunks: string[][] = []
  const CHUNK_SIZE = 400
  for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
    chunks.push(docIds.slice(i, i + CHUNK_SIZE))
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const inClause = chunk.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
      const rows = await sql(
        `SELECT id, content, created, updated FROM blocks WHERE id IN (${inClause}) AND type='d' LIMIT ${chunk.length}`,
      )
      for (const row of rows || []) {
        result.set(row.id, {
          id: row.id,
          title: row.content || "",
          created: row.created || "",
          updated: row.updated || "",
        })
      }
    }),
  )

  return result
}

/** 汇集任务：一次完整的取数周期 */
export async function collectTasks(sel: ScopeSelection, limit: number): Promise<TaskCollection> {
  const rawNotebooks: { id: string, name: string }[] = []
  const notebookNames = new Map<string, string>()
  try {
    const result = await lsNotebooks()
    for (const nb of result?.notebooks ?? []) {
      if (!nb.closed) {
        rawNotebooks.push({ id: nb.id, name: nb.name })
        notebookNames.set(nb.id, nb.name)
      }
    }
  } catch {
    // 笔记本名获取失败时用 id 兜底展示
  }

  const stmt = await buildTaskQuery({ selection: sel, limit, notebooks: rawNotebooks })
  const { rows, truncated } = await queryTaskRows(stmt)

  const docIds = [...new Set(rows.map((row) => row.root_id))]
  // 同一列表块的任务必属同一文档
  const parentRootIds = new Map<string, string>()
  for (const row of rows) {
    if (!parentRootIds.has(row.parent_id)) {
      parentRootIds.set(row.parent_id, row.root_id)
    }
  }

  const [headingRes, orderRes, docMetas] = await Promise.all([
    resolveHeadingPaths(parentRootIds),
    resolveDocBlockOrders(docIds, [...parentRootIds.keys()]),
    resolveDocMetas(docIds),
  ])

  const tasks: TaskItem[] = rows.map((row) => {
    const parsed = parseTaskLine(row.markdown)
    const marker = parsed?.marker ?? " "
    const resolved = headingRes.pathByParentId.get(row.parent_id)
    const childOrder = orderRes.get(row.root_id)?.get(row.id)
      ?? orderRes.get(row.parent_id)?.get(row.id)
    const parentTaskId = headingRes.parentBlockIdByListId.get(row.parent_id) ?? null
    return {
      id: row.id,
      // 展示/搜索用任务自身文本：含嵌套子项的父任务 blocks.content 会拼接子项文本
      // 且带标记遗留的前导空格，故取 markdown 首行标记后的文本，解析失败回退 content
      content: (parsed?.text ?? row.content ?? "").trim(),
      marker,
      done: isTaskDone(marker),
      box: row.box,
      rootId: row.root_id,
      hpath: row.hpath,
      parentId: row.parent_id,
      parentTaskId,
      updated: row.updated,
      headingPath: resolved?.path ?? [],
      headingId: resolved?.nearestId ?? null,
      srcOrder: childOrder ?? Number.MAX_SAFE_INTEGER,
    }
  })

  return {
    tasks,
    truncated: truncated || tasks.length >= limit,
    notebookNames,
    docMetas,
  }
}

/** 搜索过滤：支持任务内容、文档名称与路径、祖先标题名称；命中任务的嵌套子任务随父保留 */
export function filterTasksByKeyword(tasks: TaskItem[], keyword: string): TaskItem[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) {
    return tasks
  }
  const matched = new Set<string>()
  for (const task of tasks) {
    if (
      task.content.toLowerCase().includes(kw)
      || (task.hpath && task.hpath.toLowerCase().includes(kw))
      || (task.headingPath && task.headingPath.some((h) => h.content.toLowerCase().includes(kw)))
    ) {
      matched.add(task.id)
    }
  }
  if (matched.size === 0) {
    return []
  }

  // 命中任务的嵌套子任务随父展示（对齐源文档中子列表的展开观感）：
  // 沿 parentTaskId 逐层收编全部后代，仅向下不回溯（子任务自身命中时父任务不出现）
  const childrenByParent = new Map<string, TaskItem[]>()
  for (const task of tasks) {
    const pid = task.parentTaskId
    if (!pid) {
      continue
    }
    const arr = childrenByParent.get(pid)
    if (arr) {
      arr.push(task)
    } else {
      childrenByParent.set(pid, [task])
    }
  }
  const keep = new Set(matched)
  const frontier = [...matched]
  while (frontier.length > 0) {
    const pid = frontier.pop()!
    for (const child of childrenByParent.get(pid) ?? []) {
      if (!keep.has(child.id)) {
        keep.add(child.id)
        frontier.push(child.id)
      }
    }
  }
  return tasks.filter((task) => keep.has(task.id))
}

/** 状态过滤：仅按完成状态过滤 */
export function filterTasksByStatus(tasks: TaskItem[], status: StatusFilter): TaskItem[] {
  if (status === "all") {
    return tasks
  }
  return tasks.filter((task) => (status === "todo" ? !task.done : task.done))
}

/** 前端筛选：完成状态三态 + 内容关键字 */
export function filterTasks(
  tasks: TaskItem[],
  status: StatusFilter,
  keyword: string,
): TaskItem[] {
  return filterTasksByStatus(filterTasksByKeyword(tasks, keyword), status)
}

interface TaskTreeNode {
  task: TaskItem
  children: TaskTreeNode[]
}

/**
 * 组装局部任务树并按规则排序：
 * 1. 识别直接父子关系：若任务的 parentTaskId 也在当前任务集中，则挂为子任务；
 * 2. 同一层级内重排序：开启 sortTodoFirst 时，同级内未完成优先，同状态保持文档源顺序；
 * 3. 深度优先遍历拍平，并赋予任务相对当前层级的子深度 subDepth（0 为顶级，1 为子级...）。
 */
export function buildAndSortTaskTree(taskList: TaskItem[], sortTodoFirst = false): TaskItem[] {
  if (taskList.length === 0) {
    return []
  }

  const taskMap = new Map<string, TaskTreeNode>()
  for (const t of taskList) {
    taskMap.set(t.id, { task: t, children: [] })
  }

  const roots: TaskTreeNode[] = []
  for (const node of taskMap.values()) {
    const pid = node.task.parentTaskId
    if (pid && taskMap.has(pid)) {
      taskMap.get(pid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: TaskTreeNode[]) => {
    nodes.sort((a, b) => {
      if (sortTodoFirst) {
        const doneDiff = Number(a.task.done) - Number(b.task.done)
        if (doneDiff !== 0) {
          return doneDiff
        }
      }
      return a.task.srcOrder - b.task.srcOrder || a.task.id.localeCompare(b.task.id)
    })
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children)
      }
    }
  }

  sortNodes(roots)

  const flatten = (nodes: TaskTreeNode[], depth = 0, out: TaskItem[] = []): TaskItem[] => {
    for (const node of nodes) {
      out.push({ ...node.task, subDepth: depth })
      if (node.children.length > 0) {
        flatten(node.children, depth + 1, out)
      }
    }
    return out
  }

  return flatten(roots)
}

function groupByList(tasks: TaskItem[], sortTodoFirst = false): TaskListGroup[] {
  if (tasks.length === 0) {
    return []
  }
  const sorted = buildAndSortTaskTree(tasks, sortTodoFirst)
  return [{ key: "tasks", tasks: sorted }]
}

function makeGroup(
  key: string,
  kind: TaskGroup["kind"],
  title: string,
  level: number,
  listGroups: TaskListGroup[],
  children: TaskGroup[],
  total: number,
  done: number,
  extra?: { parentPath?: string, hpath?: string, box?: string },
): TaskGroup {
  return { key, kind, title, level, listGroups, children, total, done, ...extra }
}

/** 分组组装选项：标题分组层的可见性与任务排序规则 */
export interface GroupingOptions {
  /** 是否以标题作为分组层；false 时任务平铺在文档分组下 */
  showHeadings: boolean
  /** 作为分组层展示的标题层级（1-6 子集） */
  headingLevels: number[]
  /** 是否将未完成任务排在已完成任务前面（同列表块内） */
  sortTodoFirst?: boolean
  /** 任务完成状态过滤（仅影响列表中展示的任务行与空分组剪枝，不影响 total/done 统计） */
  statusFilter?: StatusFilter
  /** 文档排序规则（更新时间/创建时间/文件名 的正序或倒序） */
  docSort?: DocSortMode
  /** 文档元数据集合（标题、创建时间、更新时间） */
  docMetas?: Map<string, DocMeta>
}

export interface DocSortEntry {
  rootId: string
  hpath: string
  tasks: TaskItem[]
}

/**
 * 依据选定排序模式对文档进行排序（纯函数，无 DOM 依赖）。
 * 兜底采用稳定排序：时间或标题相同时按路径正序与 rootId 排序。
 */
export function sortDocEntries(
  docs: DocSortEntry[],
  sortMode: DocSortMode = "updated-desc",
  docMetas?: Map<string, DocMeta>,
): DocSortEntry[] {
  return [...docs].sort((a, b) => {
    const metaA = docMetas?.get(a.rootId)
    const metaB = docMetas?.get(b.rootId)

    const titleA = (metaA?.title || a.hpath.split("/").pop() || a.hpath).trim()
    const titleB = (metaB?.title || b.hpath.split("/").pop() || b.hpath).trim()
    const updatedA = metaA?.updated || ""
    const updatedB = metaB?.updated || ""
    const createdA = metaA?.created || ""
    const createdB = metaB?.created || ""

    let cmp = 0
    switch (sortMode) {
      case "updated-desc":
        cmp = updatedB.localeCompare(updatedA)
        break
      case "updated-asc":
        cmp = updatedA.localeCompare(updatedB)
        break
      case "created-desc":
        cmp = createdB.localeCompare(createdA)
        break
      case "created-asc":
        cmp = createdA.localeCompare(createdB)
        break
      case "title-asc":
        cmp = titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: "base" })
        break
      case "title-desc":
        cmp = titleB.localeCompare(titleA, undefined, { numeric: true, sensitivity: "base" })
        break
    }

    if (cmp !== 0) {
      return cmp
    }
    return a.hpath.localeCompare(b.hpath) || a.rootId.localeCompare(b.rootId)
  })
}

/** 组装分组树：笔记本 → 文档 → 标题树 → 列表块簇（纯函数，可随筛选重算） */
export function buildTaskGroups(
  tasks: TaskItem[],
  notebookNames: Map<string, string>,
  untitledLabel: string,
  opts: Partial<GroupingOptions> = {},
): TaskGroup[] {
  if (tasks.length === 0) {
    return []
  }
  const showHeadings = opts.showHeadings ?? true
  const sortTodoFirst = opts.sortTodoFirst ?? false
  const statusFilter = opts.statusFilter ?? "all"
  const levels = new Set(
    opts.headingLevels && opts.headingLevels.length > 0
      ? opts.headingLevels
      : [1, 2, 3, 4, 5, 6],
  )

  // 文档 -> 任务
  const byDoc = new Map<string, { box: string, hpath: string, tasks: TaskItem[] }>()
  for (const task of tasks) {
    const doc = byDoc.get(task.rootId)
    if (doc) {
      doc.tasks.push(task)
    } else {
      byDoc.set(task.rootId, { box: task.box, hpath: task.hpath || "/", tasks: [task] })
    }
  }

  // 笔记本 -> 文档
  const byBox = new Map<string, { rootId: string, hpath: string, tasks: TaskItem[] }[]>()
  for (const [rootId, doc] of byDoc) {
    const docs = byBox.get(doc.box)
    const entry = { rootId, hpath: doc.hpath, tasks: doc.tasks }
    if (docs) {
      docs.push(entry)
    } else {
      byBox.set(doc.box, [entry])
    }
  }

  // 笔记本排序：按 lsNotebooks 顺序在前，未知笔记本殿后
  const knownBoxes = [...notebookNames.keys()].filter((box) => byBox.has(box))
  const unknownBoxes = [...byBox.keys()].filter((box) => !notebookNames.has(box))

  const docSort = opts.docSort ?? "updated-desc"
  const docMetas = opts.docMetas

  const groups: TaskGroup[] = []
  for (const box of [...knownBoxes, ...unknownBoxes]) {
    const rawDocs = byBox.get(box)!
    const docs = sortDocEntries(rawDocs, docSort, docMetas)
    let nbTotal = 0
    let nbDone = 0
    const visibleDocGroups: TaskGroup[] = []

    for (const doc of docs) {
      const res = buildDocGroup(
        doc.rootId,
        box,
        doc.hpath,
        doc.tasks,
        untitledLabel,
        showHeadings,
        levels,
        sortTodoFirst,
        statusFilter,
      )
      nbTotal += res.total
      nbDone += res.done
      if (res.hasVisible && res.group) {
        visibleDocGroups.push(res.group)
      }
    }

    if (visibleDocGroups.length > 0) {
      groups.push(
        makeGroup(
          `nb:${box}`,
          "notebook",
          notebookNames.get(box) ?? box,
          0,
          [],
          visibleDocGroups,
          nbTotal,
          nbDone,
        ),
      )
    }
  }
  return groups
}

/** hpath（如 "/a/b/c"）拆为父路径与叶名；根文档父路径为空串 */
function splitHpath(hpath: string): { parentPath: string, leaf: string } {
  const segs = hpath.replace(/^\/+/, "").split("/").filter(Boolean)
  return {
    parentPath: segs.slice(0, -1).join(" / "),
    leaf: segs[segs.length - 1] ?? "",
  }
}

function buildDocGroup(
  rootId: string,
  box: string,
  hpath: string,
  tasks: TaskItem[],
  untitledLabel: string,
  showHeadings: boolean,
  levels: ReadonlySet<number>,
  sortTodoFirst = false,
  statusFilter: StatusFilter = "all",
): { group: TaskGroup | null, hasVisible: boolean, total: number, done: number } {
  const { parentPath, leaf } = splitHpath(hpath)
  const title = leaf || untitledLabel

  if (!showHeadings) {
    const total = tasks.length
    const done = tasks.filter((t) => t.done).length
    const visibleTasks = filterTasksByStatus(tasks, statusFilter)
    const hasVisible = visibleTasks.length > 0
    const group = hasVisible
      ? makeGroup(
          `d:${rootId}`,
          "doc",
          title,
          0,
          groupByList(visibleTasks, sortTodoFirst),
          [],
          total,
          done,
          { parentPath, hpath, box },
        )
      : null
    return { group, hasVisible, total, done }
  }

  // 每个 headingId -> 从文档级到自身的祖先链（任务路径天然覆盖全部相关标题）
  const chainById = new Map<string, HeadingNode[]>()
  for (const task of tasks) {
    const path = task.headingPath
    for (let i = 0; i < path.length; i++) {
      if (!chainById.has(path[i].id)) {
        chainById.set(path[i].id, path.slice(0, i + 1))
      }
    }
  }

  // 任务改挂最近可见祖先标题（层级被隐藏时逐级上浮，直至文档层）
  const byHeading = new Map<string | null, TaskItem[]>()
  for (const task of tasks) {
    let key: string | null = null
    for (let i = task.headingPath.length - 1; i >= 0; i--) {
      if (levels.has(task.headingPath[i].level)) {
        key = task.headingPath[i].id
        break
      }
    }
    const arr = byHeading.get(key)
    if (arr) {
      arr.push(task)
    } else {
      byHeading.set(key, [task])
    }
  }

  // 可见标题节点 + 其最近可见父链接（中间层级被隐藏时跨级连接）
  const nodes = new Map<string, HeadingNode>()
  const visibleParent = new Map<string, string | null>()
  for (const [id, chain] of chainById) {
    const self = chain[chain.length - 1]
    if (!levels.has(self.level) || nodes.has(id)) {
      continue
    }
    nodes.set(id, self)
    let parent: string | null = null
    for (let i = chain.length - 2; i >= 0; i--) {
      if (levels.has(chain[i].level)) {
        parent = chain[i].id
        break
      }
    }
    visibleParent.set(id, parent)
  }

  // 可见标题树：可见父不在集合内视为根
  const childrenMap = new Map<string, HeadingNode[]>()
  const roots: HeadingNode[] = []
  for (const node of nodes.values()) {
    const pid = visibleParent.get(node.id) ?? null
    if (pid && nodes.has(pid)) {
      const arr = childrenMap.get(pid)
      if (arr) {
        arr.push(node)
      } else {
        childrenMap.set(pid, [node])
      }
    } else {
      roots.push(node)
    }
  }
  const siblingOrder = (a: HeadingNode, b: HeadingNode) =>
    a.order - b.order || a.level - b.level || a.id.localeCompare(b.id)
  for (const arr of childrenMap.values()) {
    arr.sort(siblingOrder)
  }
  roots.sort(siblingOrder)

  const buildHeadingGroup = (
    node: HeadingNode,
  ): { group: TaskGroup | null, hasVisible: boolean, total: number, done: number } => {
    const directTasks = byHeading.get(node.id) ?? []
    const directTotal = directTasks.length
    const directDone = directTasks.filter((t) => t.done).length

    const childNodes = childrenMap.get(node.id) ?? []
    const childResults = childNodes.map(buildHeadingGroup)

    let total = directTotal
    let done = directDone
    const visibleChildren: TaskGroup[] = []

    for (const res of childResults) {
      total += res.total
      done += res.done
      if (res.hasVisible && res.group) {
        visibleChildren.push(res.group)
      }
    }

    const visibleDirectTasks = filterTasksByStatus(directTasks, statusFilter)
    const hasVisible = visibleDirectTasks.length > 0 || visibleChildren.length > 0

    if (!hasVisible) {
      return { group: null, hasVisible: false, total, done }
    }

    const group = makeGroup(
      `h:${node.id}`,
      "heading",
      node.content || "…",
      node.level,
      groupByList(visibleDirectTasks, sortTodoFirst),
      visibleChildren,
      total,
      done,
    )

    return { group, hasVisible: true, total, done }
  }

  const docDirectTasks = byHeading.get(null) ?? []
  const docDirectTotal = docDirectTasks.length
  const docDirectDone = docDirectTasks.filter((t) => t.done).length

  const headingResults = roots.map(buildHeadingGroup)

  let docTotal = docDirectTotal
  let docDone = docDirectDone
  const visibleHeadingChildren: TaskGroup[] = []

  for (const res of headingResults) {
    docTotal += res.total
    docDone += res.done
    if (res.hasVisible && res.group) {
      visibleHeadingChildren.push(res.group)
    }
  }

  const visibleDocDirectTasks = filterTasksByStatus(docDirectTasks, statusFilter)
  const hasVisible = visibleDocDirectTasks.length > 0 || visibleHeadingChildren.length > 0

  if (!hasVisible) {
    return { group: null, hasVisible: false, total: docTotal, done: docDone }
  }

  const group = makeGroup(
    `d:${rootId}`,
    "doc",
    title,
    0,
    groupByList(visibleDocDirectTasks, sortTodoFirst),
    visibleHeadingChildren,
    docTotal,
    docDone,
    { parentPath, hpath, box },
  )

  return { group, hasVisible: true, total: docTotal, done: docDone }
}
