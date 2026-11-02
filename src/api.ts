/**
 * 任务清单汇总插件用到的内核 API 封装。
 * 完整 API 文档见 [API.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.md)
 * 中文文档见 [API_zh_CN.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md)
 */

import {
  fetchSyncPost,
  IWebSocketData,
} from "siyuan"

async function request(url: string, data: any) {
  const response: IWebSocketData = await fetchSyncPost(url, data)
  const res = response.code === 0 ? response.data : null
  return res
}

// **************************************** Noteboook ****************************************

export async function lsNotebooks(): Promise<IReslsNotebooks> {
  const url = "/api/notebook/lsNotebooks"
  return request(url, "")
}

// **************************************** Block ****************************************

/**
 * 修改任务列表项勾选标记。只改标记节点、嵌套子列表原样保留，
 * 不得用 updateBlock 改勾选（整子树替换会丢失嵌套子块）。
 * marker 为单字符且不能是 "[" 或 "]"：未完成为 " "，完成为 "x"。
 * 写回失败必须抛出（区别于 request() 的静默 null），供乐观更新回滚。
 */
export async function updateTaskListItemMarker(
  id: BlockId,
  marker: string,
): Promise<IResdoOperations[]> {
  const response: IWebSocketData = await fetchSyncPost("/api/block/updateTaskListItemMarker", { id, marker })
  if (response.code !== 0) {
    throw new Error(response.msg || "updateTaskListItemMarker failed")
  }
  return response.data as IResdoOperations[]
}

export async function batchUpdateTaskListItemMarker(
  items: { id: BlockId, marker: string }[],
): Promise<IResdoOperations[]> {
  const response: IWebSocketData = await fetchSyncPost("/api/block/batchUpdateTaskListItemMarker", { items })
  if (response.code !== 0) {
    throw new Error(response.msg || "batchUpdateTaskListItemMarker failed")
  }
  return response.data as IResdoOperations[]
}

export async function getBlockKramdowns(
  ids: BlockId[],
): Promise<IResGetBlockKramdown[]> {
  const url = "/api/block/getBlockKramdowns"
  return request(url, { ids })
}

// **************************************** Outline ****************************************

export async function getDocOutline(id: DocumentId): Promise<any> {
  const url = "/api/outline/getDocOutline"
  return request(url, { id })
}

// **************************************** SQL ****************************************

export async function sql(sql: string): Promise<any[]> {
  const sqldata = {
    stmt: sql,
  }
  const url = "/api/query/sql"
  return request(url, sqldata)
}

export interface ISQLResult<T = any> {
  rows: T[]
  /** 服务端默认限制（search.limit）截断时为 true；显式写 LIMIT 时不截断 */
  truncated: boolean
  /** 本次生效的服务端默认上限；语句自带外层 LIMIT 时为 0 */
  limit: number | null
}

/**
 * 带截断元信息的 SQL 查询。内核在不带外层 LIMIT 时默认按 search.limit（64）截断，
 * 汇总查询必须显式携带 LIMIT 并检查 truncated。
 */
export async function sqlWithMeta<T = any>(stmt: string): Promise<ISQLResult<T>> {
  const response: IWebSocketData = await fetchSyncPost("/api/query/sql", { stmt })
  if (response.code !== 0) {
    throw new Error(response.msg || "SQL query failed")
  }
  return {
    rows: (response.data ?? []) as T[],
    truncated: Boolean((response as any).truncated),
    limit: (response as any).limit ?? null,
  }
}

// **************************************** Notification ****************************************

export async function pushMsg(msg: string, timeout: number = 7000) {
  const payload = {
    msg,
    timeout,
  }
  const url = "/api/notification/pushMsg"
  return request(url, payload)
}

export async function pushErrMsg(msg: string, timeout: number = 7000) {
  const payload = {
    msg,
    timeout,
  }
  const url = "/api/notification/pushErrMsg"
  return request(url, payload)
}
