/**
 * 任务清单领域模型与视图模型。
 * 术语见仓库根目录 GLOSSARY.md。
 */

/** 任务项完成状态（自定义标记 [/][-][!] 按"未完成"归组） */
export type TaskStatus = "todo" | "done"

/** 标题树节点（文档内标题） */
export interface HeadingNode {
  id: string
  /** 标题纯文本 */
  content: string
  /** 1-6 */
  level: number
  /** 语义父标题 id；文档级标题为 null */
  parentId: string | null
  /** 同级顺序（getDocOutline 提供的文档序；大纲外标题排在末尾） */
  order: number
}

/** 汇总视图中的任务行 */
export interface TaskItem {
  /** 源块 id */
  id: string
  /** 纯文本内容（不含任务标记） */
  content: string
  /** 任务标记字符：" " 未完成、"x" 已完成、"/" "-" "!" 等自定义标记 */
  marker: string
  done: boolean
  box: string
  /** 所在文档 id */
  rootId: string
  /** 文档可读路径 */
  hpath: string
  /** 直接父块（列表块）id */
  parentId: string
  updated: string
  /** 从文档级到最近父标题的标题路径（不含文档自身） */
  headingPath: HeadingNode[]
  /** 最近父标题 id；无标题祖先时为 null（归入文档"无标题"分组） */
  headingId: string | null
  /** 在父列表块内的源顺序；获取失败时为 Number.MAX_SAFE_INTEGER（按 id 兜底） */
  srcOrder: number
  /** 运行时字段：本会话中被勾选前的自定义标记，取消勾选时还原，避免丢失 */
  prevMarker?: string
}

/** 列表块任务簇：同一列表块的任务，显示顺序 = 未完成在前 + 源顺序稳定排序 */
export interface TaskListGroup {
  /** 列表块（父块）id */
  key: string
  tasks: TaskItem[]
}

/** 汇总视图分组树节点：笔记本 → 文档 → 标题树 → 列表块簇 */
export interface TaskGroup {
  key: string
  /** 分组种类：渲染层据此决定图标（doc）与 # 层级前缀（heading） */
  kind: "notebook" | "doc" | "heading"
  title: string
  /** doc 档：所在笔记本 box id */
  box?: string
  /** doc 档：去掉叶名后的可读父路径（如 "/传送目录"，根文档为空串） */
  parentPath?: string
  /** doc 档：完整可读路径（tooltip / aria-label 用） */
  hpath?: string
  /** 标题层级 1-6，非标题分组为 0 */
  level: number
  children: TaskGroup[]
  listGroups: TaskListGroup[]
  /** 该分组下全部任务的统计（未完成 = total - done，全部 = total；基于当前搜索关键字过滤集） */
  total: number
  done: number
}

/** 汇总范围四档 */
export type ScopeMode = "activeDoc" | "path" | "notebook" | "all"

/** 任务状态过滤 */
export type StatusFilter = "all" | TaskStatus

/** 常用路径与筛选条件收藏项（最多10项） */
export interface PathFavorite {
  id: string
  /** 根文档 id */
  docId: string
  /** 笔记本 id */
  box: string
  /** 根文档 .sy 路径 */
  path: string
  /** 根文档可读路径 */
  hpath: string
  /** 文档展示标题 */
  title: string
  /** 是否包含子文档 */
  includeSubdocs?: boolean
  /** 是否包含链接文档 */
  includeLinked?: boolean
  /** 任务完成状态过滤（全部/未完成/已完成） */
  status: StatusFilter
  /** 是否开启标题分组 */
  showHeadings: boolean
  /** 标题分组层级（1-6） */
  headingLevels: number[]
  /** 收藏时间戳 */
  createdAt: number
}

export interface ScopeSelection {
  mode: ScopeMode
  /** activeDoc / path 档：根文档 id */
  docId?: string
  /** notebook / path 档：笔记本 id */
  box?: string
  /** path 档：根文档 .sy 路径（blocks.path 形态，如 /20240101120000-abc.sy） */
  path?: string
  /** path 档：根文档可读路径（用于展示） */
  hpath?: string
  /** path 档：是否包含子文档 */
  includeSubdocs?: boolean
  /** activeDoc / path 档：是否包含链接文档（块引用+嵌入块，一层） */
  includeLinked?: boolean
  /** notebook / all 档：排除的文档路径前缀（hpath，如 "/日记"；文档自身与子树一并排除） */
  excludePaths?: string[]
}

/** 文档选择器中的文档条目 */
export interface DocEntry {
  id: string
  box: string
  path: string
  hpath: string
  title: string
}
