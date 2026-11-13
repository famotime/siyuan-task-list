/**
 * 文本处理工具：HTML 转义、关键词规范化与搜索高亮渲染。
 */

export interface TextRange {
  start: number
  end: number
}

/** 渲染纯文本的一段；引用范围相对于完整文本，搜索分段不会改变其位置。 */
function renderTextRange(text: string, start: number, end: number, referenceRanges: TextRange[]): string {
  if (end <= start) {
    return ""
  }
  let result = ""
  let cursor = start
  for (const range of referenceRanges) {
    if (range.end <= cursor) {
      continue
    }
    if (range.start >= end) {
      break
    }
    const from = Math.max(cursor, range.start)
    const to = Math.min(end, range.end)
    result += escapeHtml(text.slice(cursor, from))
    result += `<span class="tl-block-ref">${escapeHtml(text.slice(from, to))}</span>`
    cursor = to
  }
  return result + escapeHtml(text.slice(cursor, end))
}

/**
 * 转义特殊 HTML 字符，防止 XSS 与破损渲染。
 */
export function escapeHtml(text: string): string {
  if (!text) {
    return ""
  }
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * 规范化搜索关键字（去除首尾空白并转小写）。
 */
export function normalizeKeyword(input?: string): string {
  return (input ?? "").trim().toLowerCase()
}

/**
 * 对目标文本中的关键字进行高亮渲染。
 * 命中部分包裹在 <mark> 中，非命中部分转义为安全 HTML。
 * @param text 待高亮纯文本
 * @param keyword 搜索关键字
 * @param markClass <mark> 标签附加的 CSS 类名（为空时不加 class）
 * @param referenceRanges 已按位置排序的块引文字范围，用下划线与普通文本区分
 */
export function highlightText(
  text: string,
  keyword?: string,
  markClass = "tl-highlight",
  referenceRanges: TextRange[] = [],
): string {
  if (!text) {
    return ""
  }
  const kw = (keyword ?? "").trim()
  if (!kw) {
    return renderTextRange(text, 0, text.length, referenceRanges)
  }

  const lowerText = text.toLowerCase()
  const lowerKw = kw.toLowerCase()
  let result = ""
  let start = 0
  let idx = lowerText.indexOf(lowerKw, start)

  if (idx === -1) {
    return renderTextRange(text, 0, text.length, referenceRanges)
  }

  const markOpen = markClass ? `<mark class="${markClass}">` : "<mark>"
  const markClose = "</mark>"

  while (idx !== -1) {
    result += renderTextRange(text, start, idx, referenceRanges)
    result += `${markOpen}${renderTextRange(text, idx, idx + kw.length, referenceRanges)}${markClose}`
    start = idx + kw.length
    idx = lowerText.indexOf(lowerKw, start)
  }

  result += renderTextRange(text, start, text.length, referenceRanges)
  return result
}
