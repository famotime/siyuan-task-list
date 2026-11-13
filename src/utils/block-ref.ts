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

/** 提取块引位置，跳过 Markdown 反斜杠转义和完整的行内代码。 */
export function parseBlockReferences(text: string): BlockReference[] {
  const refs: BlockReference[] = []
  let pos = 0
  while (pos < text.length) {
    if (text[pos] === "\\") {
      pos += 2
      continue
    }
    if (text[pos] === "`") {
      const fence = /^`+/.exec(text.slice(pos))![0]
      let next = pos + fence.length
      let closed = false
      while ((next = text.indexOf("`", next)) !== -1) {
        const run = /^`+/.exec(text.slice(next))![0]
        next += run.length
        if (run.length === fence.length) {
          pos = next
          closed = true
          break
        }
      }
      if (!closed) {
        pos += fence.length
      }
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
    result += text.slice(pos, ref.start)
    if (label) {
      referenceRanges.push({ start: result.length, end: result.length + label.length })
    }
    result += label || text.slice(ref.start, ref.end)
    pos = ref.end
  }
  return { text: result + text.slice(pos), referenceRanges }
}
