import { describe, expect, it } from "vitest"
import { parseBlockReferences, projectBlockReferences } from "@/utils/block-ref"
import { highlightText } from "@/utils/text"

const id = "20261113120000-abcdefg"

function display(text: string, fallbacks = new Map<string, string>()) {
  return projectBlockReferences(text, parseBlockReferences(text), fallbacks).text
}

describe("block reference text projection", () => {
  it("shows static and dynamic anchors, including consecutive references", () => {
    expect(display(`完成 ((${id} "固定名称")) 与 ((${id} '动态名称'))`))
      .toBe("完成 固定名称 与 动态名称")
    expect(display(`((${id} '甲'))((${id} "乙"))`)).toBe("甲乙")
  })

  it("supports escaped quotes, entities, and parentheses inside anchors", () => {
    expect(display(String.raw`((${id} "say \"hello\" &amp; &lt;world&gt; ))"))`))
      .toBe('say "hello" & <world> ))')
    expect(display(String.raw`((${id} 'it\'s \\done'))`)).toBe("it's \\done")
  })

  it("uses target text for bare or empty anchors and preserves missing references", () => {
    const fallbacks = new Map([[id, "目标正文"]])
    expect(display(`阅读 ((${id}))`, fallbacks)).toBe("阅读 目标正文")
    expect(display(`(( ${id} '' ))`, fallbacks)).toBe("目标正文")
    expect(display(`((${id} ""))`, fallbacks)).toBe("目标正文")
    expect(display(`((${id}))`)).toBe(`((${id}))`)
  })

  it("preserves inline code, escaped references, and malformed syntax", () => {
    const samples = [
      `\`((${id} 'literal'))\``,
      `\`\`code \` ((${id} 'literal'))\`\``,
      String.raw`\((${id} 'literal'))`,
      `((invalid-id 'literal'))`,
      `((${id} 'unclosed))`,
      `((${id} "invalid "quote""))`,
      "normal ((parentheses))",
    ]
    for (const text of samples) {
      expect(display(text)).toBe(text)
    }
    expect(display(`\`unclosed ((${id} '引用'))`)).toBe("`unclosed 引用")
    expect(display(`\`((${id} '代码'))\` 后 ((${id} '引用'))`))
      .toBe(`\`((${id} '代码'))\` 后 引用`)
  })

  it("keeps anchors as text and safely highlights their visible labels", () => {
    const text = display(`((${id} '&lt;img src=x onerror=alert(1)&gt; Review'))`)
    expect(highlightText(text, "review")).toBe(
      '&lt;img src=x onerror=alert(1)&gt; <mark class="tl-highlight">Review</mark>',
    )
    const nested = `((${id} 'nested'))`
    expect(display(`((${id} "${nested}"))`)).toBe(nested)
  })

  it("does not crash the panel on out-of-range numeric entities in an anchor", () => {
    expect(display(`((${id} '保留 &#1114112; 和 &#x110000;，有效 &#x1F600;'))`))
      .toBe("保留 &#1114112; 和 &#x110000;，有效 😀")
  })

  it("underlines only reference text even when ordinary text has the same label", () => {
    const source = `资料 与 ((${id} '资料'))`
    const { text, referenceRanges } = projectBlockReferences(source, parseBlockReferences(source), new Map())
    expect(highlightText(text, "", "tl-highlight", referenceRanges))
      .toBe('资料 与 <span class="tl-block-ref">资料</span>')
    expect(highlightText(text, "资料", "tl-highlight", referenceRanges)).toBe(
      '<mark class="tl-highlight">资料</mark> 与 <mark class="tl-highlight"><span class="tl-block-ref">资料</span></mark>',
    )
    // 搜索词跨过普通正文与块引的边界时仍然完整命中。
    expect(highlightText(text, "与 资", "tl-highlight", referenceRanges)).toBe(
      '资料 <mark class="tl-highlight">与 <span class="tl-block-ref">资</span></mark><span class="tl-block-ref">料</span>',
    )
  })

  it("tracks fallback text positions and leaves unresolved or code references unstyled", () => {
    const source = `阅读 ((${id})) / ((${id} '')) / \`((${id} '代码'))\``
    const fallbacks = new Map([[id, "<目标>"]])
    const { text, referenceRanges } = projectBlockReferences(source, parseBlockReferences(source), fallbacks)
    expect(highlightText(text, "", "tl-highlight", referenceRanges)).toBe(
      `阅读 <span class="tl-block-ref">&lt;目标&gt;</span> / <span class="tl-block-ref">&lt;目标&gt;</span> / \`((${id} '代码'))\``,
    )
    expect(projectBlockReferences(source, parseBlockReferences(source), new Map()).referenceRanges)
      .toEqual([])
  })

  it("removes exported text spans around an icon while keeping the reference underline aligned", () => {
    const source = `<span data-type="text">📄</span>((${id} "论文标题"))`
    const { text, referenceRanges } = projectBlockReferences(source, parseBlockReferences(source), new Map())
    expect(text).toBe("📄论文标题")
    expect(referenceRanges.map((range) => text.slice(range.start, range.end))).toEqual(["论文标题"])
    expect(highlightText(text, "标题", "tl-highlight", referenceRanges)).toBe(
      '📄<span class="tl-block-ref">论文</span><mark class="tl-highlight"><span class="tl-block-ref">标题</span></mark>',
    )
  })

  it("handles nested or surrounding spans, quoted greater-than signs, and entity text", () => {
    const source = `<span data-type="text" title="1 > 0">📄<span data-type='strong'>A &amp; B</span> ((${id} '引用'))</span> <span data-type="text">末尾</span>`
    const { text, referenceRanges } = projectBlockReferences(source, parseBlockReferences(source), new Map())
    expect(text).toBe("📄A & B 引用 末尾")
    expect(referenceRanges.map((range) => text.slice(range.start, range.end))).toEqual(["引用"])
    expect(display('<span data-type="text">&#128196; &lt;目标&gt;</span>')).toBe("📄 <目标>")
    expect(display('<span data-type="text">只有图标 📄</span>')).toBe("只有图标 📄")
  })

  it("preserves code and escaped span examples without reinterpreting decoded markup", () => {
    const literal = '<span data-type="text">📄</span>'
    const examples = [
      `\`${literal} ((${id} '示例'))\``,
      `\`\`${literal} \` &amp;\`\``,
      String.raw`\<span data-type="text">📄\</span>`,
    ]
    for (const example of examples) {
      expect(display(example)).toBe(example)
    }
    expect(display('&lt;span data-type=&quot;text&quot;&gt;📄&lt;/span&gt;')).toBe(literal)
    expect(display('比较 <目标> 和 1 < 2，不是包装')).toBe('比较 <目标> 和 1 < 2，不是包装')
  })

  it("does not parse reference-shaped span attribute values as visible references", () => {
    const source = `<span data-type="text" title="((${id} '属性'))">📄</span>正文`
    const { text, referenceRanges } = projectBlockReferences(source, parseBlockReferences(source), new Map())
    expect(text).toBe("📄正文")
    expect(referenceRanges).toEqual([])
  })
})
