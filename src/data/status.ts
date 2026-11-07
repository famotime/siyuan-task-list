/**
 * 任务标记解析与状态计算。
 * 内核事实：blocks.markdown 保留原始任务标记（索引路径不归一化，见
 * siyuan-note kernel/util/lute.go SetExportNormalizeTaskListMarker(false)），
 * content 不含标记。任务项自身的标记一定在其 markdown 首行（嵌套子列表
 * 即便被并入 markdown 列也只出现在后续行）。
 */
import type { StatusFilter, TaskStatus, TaskStatusCounts } from "@/data/types"

/** 匹配列表项首行的勾选标记：`- [x] `、`* [ ] `、`1. [X] ` 等 */
const TASK_MARKER_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[([^\]]*)\]/

interface ParsedTaskLine {
  marker: string
  /** 标记后的任务自身文本（不含嵌套子项） */
  text: string
}

/** 从任务项 markdown 中解析任务标记与自身文本 */
export function parseTaskLine(markdown: string): ParsedTaskLine | null {
  const lines = (markdown ?? "").split("\n")
  // 防御 IAL 行：只在最前几行内找列表项标记
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const matched = TASK_MARKER_RE.exec(lines[i])
    if (matched) {
      return { marker: matched[1], text: lines[i].slice(matched[0].length) }
    }
  }
  return null
}

/** 从任务项 markdown 中解析任务标记字符；无法解析时按未完成 " " 处理 */
export function parseTaskMarker(markdown: string): string {
  return parseTaskLine(markdown)?.marker ?? " "
}

/** 完成判定：仅 "x"/"X" 视为已完成；空格与其它标记均为未完成 */
export function isTaskDone(marker: string): boolean {
  return marker.trim().toLowerCase() === "x"
}

/** 进行中判定：仅 "/" 视为进行中 */
export function isTaskInProgress(marker: string): boolean {
  return marker.trim() === "/"
}

/** 放弃判定：仅 "-" 视为已放弃 */
export function isTaskCanceled(marker: string): boolean {
  return marker.trim() === "-"
}

/** 待办判定：仅纯空格或空串视为待办 */
export function isTaskTodo(marker: string): boolean {
  return marker.trim() === ""
}

/** 自定义状态判定：除 待办/进行中/完成/放弃 外的非空单字符 */
export function isTaskCustom(marker: string): boolean {
  return !isTaskDone(marker) && !isTaskInProgress(marker) && !isTaskCanceled(marker) && !isTaskTodo(marker)
}

/** 解析 marker 对应的五类状态 */
export function resolveTaskStatus(marker: string): TaskStatus {
  if (isTaskDone(marker)) {
    return "done"
  }
  if (isTaskInProgress(marker)) {
    return "in_progress"
  }
  if (isTaskCanceled(marker)) {
    return "canceled"
  }
  if (isTaskTodo(marker)) {
    return "todo"
  }
  return "custom"
}

/**
 * 校验是否为思源合法的任务标记字符：
 * 长度必须为 1，必须为可见/空格 ASCII 字符，且不能是 "[" 或 "]"。
 */
export function isValidTaskMarker(marker: string): boolean {
  if (!marker || marker.length !== 1) {
    return false
  }
  if (marker === "[" || marker === "]") {
    return false
  }
  const code = marker.charCodeAt(0)
  return code >= 32 && code <= 126
}

/** 写回用标记值：支持 boolean (兼容历史用法) 与 TaskStatus 枚举 */
export function markerForStatus(
  statusOrDone: TaskStatus | boolean,
  customMarker?: string,
): string {
  if (typeof statusOrDone === "boolean") {
    return statusOrDone ? "x" : " "
  }
  switch (statusOrDone) {
    case "done":
      return "x"
    case "in_progress":
      return "/"
    case "canceled":
      return "-"
    case "todo":
      return " "
    case "custom":
      return customMarker && isValidTaskMarker(customMarker) ? customMarker : "!"
  }
}

/** 全部状态类型列表 */
export const ALL_TASK_STATUSES: readonly TaskStatus[] = Object.freeze([
  "todo",
  "in_progress",
  "done",
  "canceled",
  "custom",
])

/** 未完成任务状态类型（待办 + 进行中 + 自定义） */
export const UNFINISHED_TASK_STATUSES: readonly TaskStatus[] = Object.freeze([
  "todo",
  "in_progress",
  "custom",
])

export interface NormalizedStatusFilter {
  types: Set<TaskStatus>
  customMarkers?: Set<string>
}

/**
 * 规范化状态筛选条件为高效的 Set 结构
 */
export function normalizeStatusFilter(filter?: StatusFilter): NormalizedStatusFilter {
  if (!filter || filter === "all") {
    return { types: new Set(ALL_TASK_STATUSES) }
  }

  if (typeof filter === "string") {
    return { types: new Set([filter]) }
  }

  if (Array.isArray(filter)) {
    return { types: new Set(filter) }
  }

  const types = new Set<TaskStatus>(filter.types)
  const customMarkers = filter.customMarkers && filter.customMarkers.length > 0
    ? new Set(filter.customMarkers)
    : undefined
  return { types, customMarkers }
}

/**
 * 判定任务项是否匹配给定的状态筛选条件
 */
export function matchTaskStatus(
  task: { status?: TaskStatus, marker?: string, done?: boolean },
  filter: StatusFilter,
): boolean {
  if (filter === "all") {
    return true
  }

  // 防御性推导 status 与 marker
  const marker = task.marker ?? (task.done ? "x" : " ")
  const status = task.status ?? resolveTaskStatus(marker)

  const { types, customMarkers } = normalizeStatusFilter(filter)
  if (!types.has(status)) {
    return false
  }

  if (status === "custom" && customMarkers && customMarkers.size > 0) {
    return customMarkers.has(marker)
  }

  return true
}

/**
 * 从任务列表中提取所有出现的自定义标记字符，并按出现频次降序排序
 */
export function extractCustomMarkers(
  tasks: Array<{ status: TaskStatus, marker: string }>,
): Array<{ marker: string, count: number }> {
  const map = new Map<string, number>()
  for (const t of tasks) {
    if (t.status === "custom" && t.marker) {
      map.set(t.marker, (map.get(t.marker) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([marker, count]) => ({ marker, count }))
    .sort((a, b) => b.count - a.count || a.marker.localeCompare(b.marker))
}

/**
 * 统计任务列表中的细分状态数量
 */
export function computeTaskStatusCounts(
  tasks: Array<{ status: TaskStatus }>,
): TaskStatusCounts {
  const counts: TaskStatusCounts = {
    todo: 0,
    inProgress: 0,
    done: 0,
    canceled: 0,
    custom: 0,
  }

  for (const t of tasks) {
    switch (t.status) {
      case "todo":
        counts.todo++
        break
      case "in_progress":
        counts.inProgress++
        break
      case "done":
        counts.done++
        break
      case "canceled":
        counts.canceled++
        break
      case "custom":
        counts.custom++
        break
    }
  }

  return counts
}

/**
 * 比较两个状态筛选条件是否语义等价
 */
export function statusFiltersEqual(a?: StatusFilter, b?: StatusFilter): boolean {
  if (a === b) {
    return true
  }
  const normA = normalizeStatusFilter(a)
  const normB = normalizeStatusFilter(b)
  if (normA.types.size !== normB.types.size) {
    return false
  }
  for (const t of normA.types) {
    if (!normB.types.has(t)) {
      return false
    }
  }
  const custA = normA.customMarkers
  const custB = normB.customMarkers
  if (!custA && !custB) {
    return true
  }
  if (!custA || !custB || custA.size !== custB.size) {
    return false
  }
  for (const m of custA) {
    if (!custB.has(m)) {
      return false
    }
  }
  return true
}

/**
 * 将状态筛选转换为简洁可读标签文案
 */
export function formatStatusFilterLabel(filter?: StatusFilter, i18n: any = {}): string {
  const norm = normalizeStatusFilter(filter)
  if (norm.types.size === ALL_TASK_STATUSES.length && !norm.customMarkers) {
    return i18n.filterAll || "全部"
  }

  // 检查是否恰为未完成全集 (待办 + 进行中 + 自定义)
  if (
    norm.types.size === UNFINISHED_TASK_STATUSES.length &&
    !norm.customMarkers &&
    UNFINISHED_TASK_STATUSES.every((t) => norm.types.has(t))
  ) {
    return i18n.presetUnfinished || i18n.filterTodo || "未完成"
  }

  if (norm.types.size === 1) {
    const single = [...norm.types][0]
    switch (single) {
      case "todo":
        return i18n.statusTodo || "待办"
      case "in_progress":
        return i18n.statusInProgress || "进行中"
      case "done":
        return i18n.statusDone || i18n.filterDone || "已完成"
      case "canceled":
        return i18n.statusCanceled || "已放弃"
      case "custom":
        if (norm.customMarkers && norm.customMarkers.size === 1) {
          return `[${[...norm.customMarkers][0]}]`
        }
        return i18n.statusCustom || "自定义"
    }
  }

  const count = norm.types.size
  return (i18n.selectedCount || "已选 ${n} 项").replace("${n}", String(count))
}
