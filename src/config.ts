/**
 * 插件配置定义与规范化校验。
 */
import type { DocSortMode, PathFavorite, ScopeSelection } from "@/data/types"

export const STORAGE_NAME = "config.json"
export const DOCK_TYPE = "tasklist-dock"

export interface TaskListConfig {
  /** 单次汇集条数上限（同时作为查询 LIMIT，避免内核 search.limit=64 默认截断） */
  limit: number
  /** 上次使用的汇总范围 */
  scope: ScopeSelection
  /** 是否以标题作为分组层（false = 任务平铺到文档层） */
  showHeadings: boolean
  /** 作为分组层展示的标题层级（1-6 子集） */
  headingLevels: number[]
  /** 折叠的分组 key（notebook/doc/heading） */
  foldedKeys: string[]
  /** 未完成任务排序靠前（同级列表块内） */
  sortTodoFirst: boolean
  /** 分组徽标统计未完成项（开启时分子显示所有未完成项数量，关闭时显示已完成数量） */
  countUnfinished: boolean
  /** 点击任务状态图标弹出细分状态菜单（开启时左键弹出菜单，关闭时直接切换待办/完成） */
  clickStatusMenu: boolean
  /** 文档排序规则（更新时间/创建时间/文件名 的正序或倒序） */
  docSort: DocSortMode
  /** 常用路径与筛选条件收藏项（最多10项） */
  favorites: PathFavorite[]
}

export const DEFAULT_CONFIG: Readonly<TaskListConfig> = Object.freeze({
  limit: 2000,
  scope: { mode: "activeDoc" as const, includeLinked: false },
  showHeadings: true,
  headingLevels: [1, 2, 3, 4, 5, 6],
  foldedKeys: [],
  sortTodoFirst: false,
  countUnfinished: false,
  clickStatusMenu: false,
  docSort: "updated-desc",
  favorites: [],
})

/**
 * 校验并规范化从 storage 或外部传入的配置数据。
 * @param saved 未受信任的配置数据对象
 * @param base 基准配置（默认为 DEFAULT_CONFIG）
 */
export function sanitizeConfig(
  saved: any,
  base: TaskListConfig = DEFAULT_CONFIG,
): TaskListConfig {
  const result: TaskListConfig = {
    ...base,
    scope: { ...base.scope },
    headingLevels: [...base.headingLevels],
    foldedKeys: [...base.foldedKeys],
    favorites: [...base.favorites],
  }

  if (!saved || typeof saved !== "object") {
    return result
  }

  if (Number.isFinite(saved.limit) && saved.limit >= 100) {
    result.limit = Math.min(Math.floor(saved.limit), 100000)
  }

  if (saved.scope && typeof saved.scope === "object" && saved.scope.mode) {
    result.scope = { ...saved.scope }
  }

  if (typeof saved.showHeadings === "boolean") {
    result.showHeadings = saved.showHeadings
  }

  if (Array.isArray(saved.headingLevels)) {
    const levels = [...new Set<number>(saved.headingLevels)]
      .filter((lvl) => Number.isInteger(lvl) && lvl >= 1 && lvl <= 6)
    if (levels.length > 0) {
      result.headingLevels = levels.sort((a, b) => a - b)
    }
  }

  if (Array.isArray(saved.foldedKeys)) {
    result.foldedKeys = saved.foldedKeys.filter((key: any) => typeof key === "string")
  }

  if (typeof saved.sortTodoFirst === "boolean") {
    result.sortTodoFirst = saved.sortTodoFirst
  }

  if (typeof saved.countUnfinished === "boolean") {
    result.countUnfinished = saved.countUnfinished
  }

  if (typeof saved.clickStatusMenu === "boolean") {
    result.clickStatusMenu = saved.clickStatusMenu
  }

  const VALID_DOC_SORTS: ReadonlySet<string> = new Set([
    "updated-desc",
    "updated-asc",
    "created-desc",
    "created-asc",
    "title-asc",
    "title-desc",
  ])
  if (typeof saved.docSort === "string" && VALID_DOC_SORTS.has(saved.docSort)) {
    result.docSort = saved.docSort as DocSortMode
  } else {
    result.docSort = base.docSort ?? "updated-desc"
  }

  if (Array.isArray(saved.favorites)) {
    result.favorites = saved.favorites
      .filter((fav: any) => fav && typeof fav.id === "string" && typeof fav.docId === "string")
      .slice(0, 10)
  }

  return result
}
