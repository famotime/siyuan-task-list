import { beforeEach, describe, expect, it, vi } from "vitest"
import { sql } from "@/api"
import { resolveTaskContents } from "@/data/block-ref"

vi.mock("@/api", () => ({ sql: vi.fn() }))

const ids = ["20261113120000-aaaaaaa", "20261113120000-bbbbbbb", "20261113120000-ccccccc"]

async function resolveTexts(texts: string[]): Promise<string[]> {
  return (await resolveTaskContents(texts)).map((content) => content.text)
}

describe("resolveTaskContents", () => {
  beforeEach(() => vi.resetAllMocks())

  it("uses saved anchors without making extra API requests", async () => {
    const texts = ["普通任务", `((${ids[0]} "静态名称"))`, `((${ids[0]} '动态文字'))`]
    expect(await resolveTexts(texts)).toEqual(["普通任务", "静态名称", "动态文字"])
    expect(sql).not.toHaveBeenCalled()
  })

  it("resolves block names, container first-leaf text, and document titles", async () => {
    vi.mocked(sql).mockResolvedValue([
      { id: ids[0], name: "块名称", fcontent: "首段", content: "全文" },
      { id: ids[1], name: "", fcontent: "父任务 &amp; 首段", content: "父任务 子任务" },
      { id: ids[2], name: "", fcontent: "", content: "文档标题" },
    ])
    const texts = ids.map((id) => `阅读 ((${id}))`)
    texts.push(`再次 ((${ids[0]}))，((${ids[0]} "自定义锚文本"))`)
    expect(await resolveTexts(texts)).toEqual([
      "阅读 块名称", "阅读 父任务 & 首段", "阅读 文档标题", "再次 块名称，自定义锚文本",
    ])
    expect(sql).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sql).mock.calls[0][0]).toContain(`'${ids[0]}','${ids[1]}','${ids[2]}'`)
    expect(vi.mocked(sql).mock.calls[0][0]).toMatch(/LIMIT 3$/)
  })

  it("chunks large sets with explicit limits above the kernel default of 64", async () => {
    vi.mocked(sql).mockResolvedValue([])
    const texts = Array.from({ length: 401 }, (_, i) => `((${String(20261113120000 + i)}-abcdefg))`)
    expect(await resolveTexts(texts)).toEqual(texts)
    expect(sql).toHaveBeenCalledTimes(2)
    expect(vi.mocked(sql).mock.calls[0][0]).toMatch(/LIMIT 400$/)
    expect(vi.mocked(sql).mock.calls[1][0]).toMatch(/LIMIT 1$/)
  })

  it.each([null, []])("preserves unresolved references when the API returns %s", async (rows) => {
    vi.mocked(sql).mockResolvedValue(rows)
    const text = `((${ids[0]}))，((${ids[1]} '仍可显示'))`
    expect(await resolveTexts([text])).toEqual([`((${ids[0]}))，仍可显示`])
  })

  it("does not let a failed lookup prevent task rendering", async () => {
    vi.mocked(sql).mockRejectedValue(new Error("offline"))
    const text = `((${ids[0]}))，((${ids[1]} "固定名称"))`
    expect(await resolveTexts([text])).toEqual([`((${ids[0]}))，固定名称`])
  })
})
