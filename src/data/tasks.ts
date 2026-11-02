/**
 * 任务汇集与分组树组装。
 * 查询编排：范围谓词 → 任务主查询 → 标题归属解析 + 源顺序解析 → 组装视图模型。
 */
import { lsNotebooks } from "@/api"
import { resolveHeadingPaths } from "@/data/heading"
import { resolveListChildOrder } from "@/data/order"
import { buildTaskQuery, queryTaskRows } from "@/data/scope"
import { isTaskDone, parseTaskLine } from "@/data/status"
import type {
  HeadingNode,
  ScopeSelection,
  TaskGroup,
  TaskItem,
  TaskListGroup,
} from "@/data/types"

export type StatusFilter = "all" | "todo" | "done"

export interface TaskCollection {
  tasks: TaskItem[]
  /** 服务端默认限制截断时为 true（显式 LIMIT 命中上限也视为截断） */
  truncated: boolean
  notebookNames: Map<string, string>
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

  // 同一列表块的任务必属同一文档
  const parentRootIds = new Map<string, string>()
  for (const row of rows) {
    if (!parentRootIds.has(row.parent_id)) {
      parentRootIds.set(row.parent_id, row.root_id)
    }
  }

  const [headingRes, orderRes] = await Promise.all([
    resolveHeadingPaths(parentRootIds),
    resolveListChildOrder([...parentRootIds.keys()]),
  ])

  const tasks: TaskItem[] = rows.map((row) => {
    const parsed = parseTaskLine(row.markdown)
    const marker = parsed?.marker ?? " "
    const resolved = headingRes.pathByParentId.get(row.parent_id)
    const childOrder = orderRes.get(row.parent_id)?.get(row.id)
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
  }
}

/** 搜索过滤：仅按内容关键字过滤 */
export function filterTasksByKeyword(tasks: TaskItem[], keyword: string): TaskItem[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) {
    return tasks
  }
  return tasks.filter((task) => task.content.toLowerCase().includes(kw))
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

/** 列表块簇内显示顺序：未完成在前（可选），同状态按源顺序，再按块 id 兜底 */
function sortListTasks(tasks: TaskItem[], sortTodoFirst = false): TaskItem[] {
  return tasks.slice().sort((a, b) => {
    if (sortTodoFirst) {
      const doneDiff = Number(a.done) - Number(b.done)
      if (doneDiff !== 0) {
        return doneDiff
      }
    }
    return a.srcOrder - b.srcOrder || a.id.localeCompare(b.id)
  })
}

function groupByList(tasks: TaskItem[], sortTodoFirst = false): TaskListGroup[] {
  const byList = new Map<string, TaskItem[]>()
  for (const task of tasks) {
    const arr = byList.get(task.parentId)
    if (arr) {
      arr.push(task)
    } else {
      byList.set(task.parentId, [task])
    }
  }
  const groups: TaskListGroup[] = []
  for (const [key, listTasks] of byList) {
    const sorted = sortListTasks(listTasks, sortTodoFirst)
    groups.push({ key, tasks: sorted })
  }
  // 多个列表块之间按簇内最小源顺序稳定排列
  groups.sort((a, b) => minSrcOrder(a) - minSrcOrder(b))
  return groups
}

function minSrcOrder(group: TaskListGroup): number {
  let min = Number.MAX_SAFE_INTEGER
  for (const task of group.tasks) {
    if (task.srcOrder < min) {
      min = task.srcOrder
    }
  }
  return min
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

  const groups: TaskGroup[] = []
  for (const box of [...knownBoxes, ...unknownBoxes]) {
    const docs = byBox.get(box)!.sort((a, b) => a.hpath.localeCompare(b.hpath))
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
