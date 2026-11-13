/**
 * HTML 工具函数（无 DOM 环境依赖，支持 Node 与前端运行环境）。
 */

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
}

/**
 * 解码 HTML 实体（命名实体与十进制/十六进制编码）。
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) {
    return ""
  }
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (match) => NAMED_ENTITIES[match] ?? match)
    .replace(/&#([0-9]+);/g, (_, code) => {
      const num = Number.parseInt(code, 10)
      return Number.isFinite(num) && num <= 0x10FFFF ? String.fromCodePoint(num) : _
    })
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => {
      const num = Number.parseInt(hex, 16)
      return Number.isFinite(num) && num <= 0x10FFFF ? String.fromCodePoint(num) : _
    })
}

/**
 * 剥除 HTML 标签并解码实体，返回纯文本。
 */
export function stripHtml(html: string): string {
  if (!html) {
    return ""
  }
  // 1. 去除 HTML 注释
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "")
  // 2. 去除所有 HTML 标签
  const noTags = noComments.replace(/<[^>]*>/g, "")
  // 3. 解码实体并清理空白
  return decodeHtmlEntities(noTags).trim()
}
