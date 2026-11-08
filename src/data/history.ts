/**
 * 任务状态变更历史领域逻辑与纯函数处理。
 * 遵循架构约定：严禁依赖 DOM / window，确保 Node/Vitest 环境可无缝测试。
 */
import type { TaskHistoryItem, TaskStatus } from "@/data/types"
import { isValidTaskMarker, resolveTaskStatus } from "@/data/status"

/** 历史记录最大持久化保留条数 */
export const MAX_HISTORY_ITEMS = 100

/**
 * 校验并清理从插件存储加载的原始历史数据，防御性过滤非法或损坏的条目
 */
export function sanitizeHistory(raw: unknown): TaskHistoryItem[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const result: TaskHistoryItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue
    }
    const candidate = item as Partial<TaskHistoryItem>
    if (
      typeof candidate.id !== "string"
      || typeof candidate.taskId !== "string"
      || typeof candidate.content !== "string"
      || typeof candidate.timestamp !== "number"
      || typeof candidate.fromMarker !== "string"
      || typeof candidate.toMarker !== "string"
    ) {
      continue
    }

    const fromStatus: TaskStatus = candidate.fromStatus ?? resolveTaskStatus(candidate.fromMarker)
    const toStatus: TaskStatus = candidate.toStatus ?? resolveTaskStatus(candidate.toMarker)

    result.push({
      id: candidate.id,
      taskId: candidate.taskId,
      rootId: typeof candidate.rootId === "string" ? candidate.rootId : undefined,
      docTitle: typeof candidate.docTitle === "string" ? candidate.docTitle : undefined,
      content: candidate.content,
      fromMarker: candidate.fromMarker,
      toMarker: candidate.toMarker,
      fromStatus,
      toStatus,
      timestamp: candidate.timestamp,
      undone: Boolean(candidate.undone),
    })
    if (result.length >= MAX_HISTORY_ITEMS) {
      break
    }
  }
  return result
}

/**
 * 追加一条新历史记录（置顶），并按容量上限裁剪
 */
export function addHistoryRecord(
  history: readonly TaskHistoryItem[],
  record: TaskHistoryItem,
  maxItems = MAX_HISTORY_ITEMS,
): TaskHistoryItem[] {
  const next = [record, ...history]
  if (next.length > maxItems) {
    return next.slice(0, maxItems)
  }
  return next
}

/**
 * 将指定历史条目标记为已撤销
 */
export function markHistoryUndone(
  history: readonly TaskHistoryItem[],
  recordId: string,
): TaskHistoryItem[] {
  return history.map((item) => (item.id === recordId ? { ...item, undone: true } : item))
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(
  timestamp: number,
  now = Date.now(),
  i18n?: Record<string, string>,
): string {
  const diff = Math.max(0, now - timestamp)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) {
    return i18n?.timeJustNow || "刚刚"
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return (i18n?.timeMinutesAgo || "${n}分钟前").replace("${n}", String(minutes))
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return (i18n?.timeHoursAgo || "${n}小时前").replace("${n}", String(hours))
  }
  const days = Math.floor(hours / 24)
  if (days < 7) {
    return (i18n?.timeDaysAgo || "${n}天前").replace("${n}", String(days))
  }

  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, "0")
  const m = pad(d.getMonth() + 1)
  const date = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())

  const currentYear = new Date(now).getFullYear()
  if (d.getFullYear() === currentYear) {
    return `${m}-${date} ${h}:${min}`
  }
  return `${d.getFullYear()}-${m}-${date}`
}

/**
 * 获取状态简述文案
 */
export function getStatusText(
  status: TaskStatus,
  marker: string,
  i18n?: Record<string, string>,
): string {
  switch (status) {
    case "todo":
      return i18n?.statusTodo || "待办"
    case "in_progress":
      return i18n?.statusInProgress || "进行中"
    case "done":
      return i18n?.statusDone || "完成"
    case "canceled":
      return i18n?.statusCanceled || "放弃"
    case "custom":
      return marker && marker.trim() ? `[${marker}]` : (i18n?.statusCustom || "自定义")
  }
}
