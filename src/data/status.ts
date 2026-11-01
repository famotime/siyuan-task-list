/**
 * 任务标记解析。
 * 内核事实：blocks.markdown 保留原始任务标记（索引路径不归一化，见
 * siyuan-note kernel/util/lute.go SetExportNormalizeTaskListMarker(false)），
 * content 不含标记。任务项自身的标记一定在其 markdown 首行（嵌套子列表
 * 即便被并入 markdown 列也只出现在后续行）。
 */

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

/** 完成判定：仅 "x"/"X" 视为已完成；空格与自定义标记（/ - ! 等）均为未完成 */
export function isTaskDone(marker: string): boolean {
  return marker.trim().toLowerCase() === "x"
}

/** 写回用标记值：内核约束为单字符且不能是 "["/"]"，未完成为 " " */
export function markerForStatus(done: boolean): string {
  return done ? "x" : " "
}
