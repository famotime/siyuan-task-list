/**
 * 本插件用到的思源内核数据结构（全局类型声明）。
 * 完整定义以 npm `siyuan` 包与内核源码为准。
 */

type DocumentId = string
type BlockId = string
type NotebookId = string

interface Notebook {
  id: NotebookId
  name: string
  icon: string
  sort: number
  closed: boolean
}

interface doOperation {
  action: string
  data: string
  id: BlockId
  parentID: BlockId | DocumentId
  previousID: BlockId
  retData: null
}
