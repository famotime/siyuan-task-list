/**
 * 常用路径与筛选条件收藏项辅助工具。
 */
import type { PathFavorite, StatusFilter } from "@/data/types"
import { statusFiltersEqual } from "@/data/status"

/**
 * 比较两个数字数组（元素集合与频次一致，忽略顺序）。
 */
export function arraysEqual(a?: number[], b?: number[]): boolean {
  const arrA = a ?? []
  const arrB = b ?? []
  if (arrA.length !== arrB.length) {
    return false
  }
  const sortedA = [...arrA].sort((x, y) => x - y)
  const sortedB = [...arrB].sort((x, y) => x - y)
  return sortedA.every((val, idx) => val === sortedB[idx])
}

export interface FavoriteMatchState {
  docId?: string
  includeSubdocs?: boolean
  includeLinked?: boolean
  status?: StatusFilter
  showHeadings?: boolean
  headingLevels?: number[]
}

/**
 * 判断指定收藏项是否与当前面板过滤状态一致。
 */
export function isFavoriteMatching(
  fav: PathFavorite,
  state: FavoriteMatchState,
): boolean {
  if (fav.docId !== state.docId) {
    return false
  }
  if (Boolean(fav.includeSubdocs) !== Boolean(state.includeSubdocs)) {
    return false
  }
  if (Boolean(fav.includeLinked) !== Boolean(state.includeLinked)) {
    return false
  }
  if (state.status !== undefined && !statusFiltersEqual(fav.status, state.status)) {
    return false
  }
  if (state.showHeadings !== undefined && fav.showHeadings !== state.showHeadings) {
    return false
  }
  if (state.headingLevels !== undefined && !arraysEqual(fav.headingLevels, state.headingLevels)) {
    return false
  }
  return true
}

/**
 * 构造一个文档的默认常用路径收藏项（用于当前文档/笔记本/所有笔记本视图下的快速收藏）。
 * 统一采用标准默认预设：全部状态任务、开启包含子文档、不包含反链、展开 1-6 全级标题。
 */
export function createDefaultDocFavorite(params: {
  docId: string
  box: string
  path: string
  hpath: string
  title: string
  untitledLabel?: string
}): PathFavorite {
  const leafTitle
    = params.hpath.replace(/^\/+/, "").split("/").filter(Boolean).pop()
    || params.title
    || params.untitledLabel
    || "未命名文档"

  return {
    id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    docId: params.docId,
    box: params.box,
    path: params.path,
    hpath: params.hpath,
    title: leafTitle,
    includeSubdocs: true,
    includeLinked: false,
    status: "all",
    showHeadings: true,
    headingLevels: [1, 2, 3, 4, 5, 6],
    createdAt: Date.now(),
  }
}
