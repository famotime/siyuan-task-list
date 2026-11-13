/** 任务块引的只读文本解析：已有锚文本直接展示，裸引用批量补齐。 */
import { sql } from "@/api"
import { parseBlockReferences, projectBlockReferences } from "@/utils/block-ref"
import type { BlockReferenceProjection } from "@/utils/block-ref"
import { decodeHtmlEntities } from "@/utils/html"

export async function resolveTaskContents(texts: string[]): Promise<BlockReferenceProjection[]> {
  const refsByText = texts.map(parseBlockReferences)
  const ids = [...new Set(refsByText.flat()
    .filter((ref) => !ref.text?.trim())
    .map((ref) => ref.id))]
  const fallbackTexts = new Map<string, string>()

  // 与现有汇总查询一致：去重、分批，并显式 LIMIT，避免内核默认 64 条截断。
  for (let i = 0; i < ids.length; i += 400) {
    const part = ids.slice(i, i + 400)
    try {
      const rows = await sql(
        `SELECT id, name, fcontent, content FROM blocks WHERE id IN (${part.map((id) => `'${id}'`).join(",")}) LIMIT ${part.length}`,
      )
      for (const row of rows ?? []) {
        // 内核引用文本优先使用块名；容器的 fcontent 仅含首个叶块，避免拼入子任务。
        const label = row.name?.trim() || row.fcontent?.trim() || row.content?.trim() || ""
        if (label) {
          fallbackTexts.set(row.id, decodeHtmlEntities(label))
        }
      }
    } catch {
      // 目标被删除或查询失败时保留原文；一个坏引用不能让整个任务面板加载失败。
    }
  }

  return texts.map((text, i) => projectBlockReferences(text, refsByText[i], fallbackTexts))
}
