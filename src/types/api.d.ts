/**
 * 本插件用到的内核 API 响应结构（全局类型声明）。
 */

interface IReslsNotebooks {
  notebooks: Notebook[]
}

interface IResdoOperations {
  doOperations: doOperation[]
  undoOperations: doOperation[] | null
}

interface IResGetBlockKramdown {
  id: BlockId
  kramdown: string
}
