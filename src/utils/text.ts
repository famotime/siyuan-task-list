/**
 * 文本处理工具：HTML 转义、关键词规范化与搜索高亮渲染。
 */

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
 */
export function highlightText(
  text: string,
  keyword?: string,
  markClass = "tl-highlight",
): string {
  if (!text) {
    return ""
  }
  const kw = (keyword ?? "").trim()
  if (!kw) {
    return escapeHtml(text)
  }

  const lowerText = text.toLowerCase()
  const lowerKw = kw.toLowerCase()
  let result = ""
  let start = 0
  let idx = lowerText.indexOf(lowerKw, start)

  if (idx === -1) {
    return escapeHtml(text)
  }

  const markOpen = markClass ? `<mark class="${markClass}">` : "<mark>"
  const markClose = "</mark>"

  while (idx !== -1) {
    result += escapeHtml(text.slice(start, idx))
    result += `${markOpen}${escapeHtml(text.slice(idx, idx + kw.length))}${markClose}`
    start = idx + kw.length
    idx = lowerText.indexOf(lowerKw, start)
  }

  result += escapeHtml(text.slice(start))
  return result
}
