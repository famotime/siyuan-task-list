/** 思源块引的纯文本投影；语法以 Lute parse/block_ref.go、parse/link.go 为准。 */
import { decodeHtmlEntities } from "@/utils/html"
import type { TextRange } from "@/utils/text"

export interface BlockReference {
  id: string
  text?: string
  start: number
  end: number
}

export interface BlockReferenceProjection {
  text: string
  referenceRanges: TextRange[]
}

// 双引号为静态锚文本，单引号为动态锚文本；也允许省略锚文本。
const BLOCK_REF_RE = /^\(\([ \t]*(\d{14}-[0-9a-z]{7})(?:[ \t]+(?:"((?:\\.|[^"\\\r\n])*)"|'((?:\\.|[^'\\\r\n])*)'))?[ \t]*\)\)/

// Lute 的 TextMark 会以 span 导出（包括纯文本图标）。属性中的 > 不是标签结尾。
const SPAN_TAG_RE = /^<\/?span(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*>/i

/** 返回转义字符或行内代码的结束位置；它们应完整保留，不参与投影解析。 */
function markdownLiteralEnd(text: string, pos: number): number | null {
  if (text[pos] === "\\") {
    return Math.min(pos + 2, text.length)
  }
  if (text[pos] !== "`") {
    return null
  }
  const fence = /^`+/.exec(text.slice(pos))![0]
  let next = pos + fence.length
  while ((next = text.indexOf("`", next)) !== -1) {
    const run = /^`+/.exec(text.slice(next))![0]
    next += run.length
    if (run.length === fence.length) {
      return next
    }
  }
  return pos + fence.length
}

/** 去除正文中的 span 包装，保留文字、图标、代码以及被转义的 HTML 示例。 */
function projectInlineText(text: string): string {
  let result = ""
  let start = 0
  let pos = 0
  while (pos < text.length) {
    const literalEnd = markdownLiteralEnd(text, pos)
    if (literalEnd !== null) {
      result += decodeHtmlEntities(text.slice(start, pos)) + text.slice(pos, literalEnd)
      pos = start = literalEnd
      continue
    }
    const tag = text[pos] === "<" ? SPAN_TAG_RE.exec(text.slice(pos)) : null
    if (tag) {
      result += decodeHtmlEntities(text.slice(start, pos))
      pos += tag[0].length
      start = pos
      continue
    }
    pos++
  }
  return result + decodeHtmlEntities(text.slice(start))
}

/** 提取块引位置，跳过 Markdown 反斜杠转义和完整的行内代码。 */
export function parseBlockReferences(text: string): BlockReference[] {
  const refs: BlockReference[] = []
  let pos = 0
  while (pos < text.length) {
    const literalEnd = markdownLiteralEnd(text, pos)
    if (literalEnd !== null) {
      pos = literalEnd
      continue
    }
    const tag = text[pos] === "<" ? SPAN_TAG_RE.exec(text.slice(pos)) : null
    if (tag) {
      pos += tag[0].length
      continue
    }
    if (text.startsWith("((", pos)) {
      const match = BLOCK_REF_RE.exec(text.slice(pos))
      if (match) {
        const anchor = match[2] ?? match[3]
        refs.push({
          id: match[1],
          text: anchor === undefined
            ? undefined
            : decodeHtmlEntities(anchor.replace(/\\([!-/:-@[-`{-~])/g, "$1")),
          start: pos,
          end: pos + match[0].length,
        })
        pos += match[0].length
        continue
      }
    }
    pos++
  }
  return refs
}

/** 替换引用并保留显示文字的位置；锚文本始终作为纯文本处理。 */
export function projectBlockReferences(
  text: string,
  refs: BlockReference[],
  fallbackTexts: ReadonlyMap<string, string>,
): BlockReferenceProjection {
  let result = ""
  const referenceRanges: TextRange[] = []
  let pos = 0
  for (const ref of refs) {
    const label = ref.text?.trim() ? ref.text : fallbackTexts.get(ref.id)
    result += projectInlineText(text.slice(pos, ref.start))
    if (label) {
      referenceRanges.push({ start: result.length, end: result.length + label.length })
    }
    result += label || text.slice(ref.start, ref.end)
    pos = ref.end
  }
  return { text: result + projectInlineText(text.slice(pos)), referenceRanges }
}
