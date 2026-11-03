/**
 * 常用路径与筛选条件收藏项辅助工具。
 */
import type { PathFavorite, StatusFilter } from "@/data/types"

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
  if (state.status !== undefined && fav.status !== state.status) {
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
