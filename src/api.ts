/**
 * Copyright (c) 2023 frostime. All rights reserved.
 * https://github.com/frostime/sy-plugin-template-vite
 *
 * See API Document in [API.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.md)
 * API 文档见 [API_zh_CN.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md)
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

export async function openNotebook(notebook: NotebookId) {
  const url = "/api/notebook/openNotebook"
  return request(url, { notebook })
}

export async function closeNotebook(notebook: NotebookId) {
  const url = "/api/notebook/closeNotebook"
  return request(url, { notebook })
}

export async function renameNotebook(notebook: NotebookId, name: string) {
  const url = "/api/notebook/renameNotebook"
  return request(url, {
    notebook,
    name,
  })
}

export async function createNotebook(name: string): Promise<Notebook> {
  const url = "/api/notebook/createNotebook"
  return request(url, { name })
}

export async function removeNotebook(notebook: NotebookId) {
  const url = "/api/notebook/removeNotebook"
  return request(url, { notebook })
}

export async function getNotebookConf(
  notebook: NotebookId,
): Promise<IResGetNotebookConf> {
  const data = { notebook }
  const url = "/api/notebook/getNotebookConf"
  return request(url, data)
}

export async function setNotebookConf(
  notebook: NotebookId,
  conf: NotebookConf,
): Promise<NotebookConf> {
  const data = {
    notebook,
    conf,
  }
  const url = "/api/notebook/setNotebookConf"
  return request(url, data)
}

// **************************************** File Tree ****************************************
export async function createDocWithMd(
  notebook: NotebookId,
  path: string,
  markdown: string,
): Promise<DocumentId> {
  const data = {
    notebook,
    path,
    markdown,
  }
  const url = "/api/filetree/createDocWithMd"
  return request(url, data)
}

export async function renameDoc(
  notebook: NotebookId,
  path: string,
  title: string,
): Promise<DocumentId> {
  const data = {
    doc: notebook,
    path,
    title,
  }
  const url = "/api/filetree/renameDoc"
  return request(url, data)
}

export async function removeDoc(notebook: NotebookId, path: string) {
  const data = {
    notebook,
    path,
  }
  const url = "/api/filetree/removeDoc"
  return request(url, data)
}

export async function moveDocs(
  fromPaths: string[],
  toNotebook: NotebookId,
  toPath: string,
) {
  const data = {
    fromPaths,
    toNotebook,
    toPath,
  }
  const url = "/api/filetree/moveDocs"
  return request(url, data)
}

export async function getHPathByPath(
  notebook: NotebookId,
  path: string,
): Promise<string> {
  const data = {
    notebook,
    path,
  }
  const url = "/api/filetree/getHPathByPath"
  return request(url, data)
}

export async function getHPathByID(id: BlockId): Promise<string> {
  const data = {
    id,
  }
  const url = "/api/filetree/getHPathByID"
  return request(url, data)
}

export async function getIDsByHPath(
  notebook: NotebookId,
  path: string,
): Promise<BlockId[]> {
  const data = {
    notebook,
    path,
  }
  const url = "/api/filetree/getIDsByHPath"
  return request(url, data)
}

// **************************************** Asset Files ****************************************

export async function upload(
  assetsDirPath: string,
  files: any[],
): Promise<IResUpload> {
  const form = new FormData()
  form.append("assetsDirPath", assetsDirPath)
  for (const file of files) {
    form.append("file[]", file)
  }
  const url = "/api/asset/upload"
  return request(url, form)
}

// **************************************** Block ****************************************
type DataType = "markdown" | "dom"
export async function insertBlock(
  dataType: DataType,
  data: string,
  nextID?: BlockId,
  previousID?: BlockId,
  parentID?: BlockId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    nextID,
    previousID,
    parentID,
  }
  const url = "/api/block/insertBlock"
  return request(url, payload)
}

export async function prependBlock(
  dataType: DataType,
  data: string,
  parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    parentID,
  }
  const url = "/api/block/prependBlock"
  return request(url, payload)
}

export async function appendBlock(
  dataType: DataType,
  data: string,
  parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    parentID,
  }
  const url = "/api/block/appendBlock"
  return request(url, payload)
}

export async function updateBlock(
  dataType: DataType,
  data: string,
  id: BlockId,
): Promise<IResdoOperations[]> {
  const payload = {
    dataType,
    data,
    id,
  }
  const url = "/api/block/updateBlock"
  return request(url, payload)
}

export async function deleteBlock(id: BlockId): Promise<IResdoOperations[]> {
  const data = {
    id,
  }
  const url = "/api/block/deleteBlock"
  return request(url, data)
}

export async function moveBlock(
  id: BlockId,
  previousID?: PreviousID,
  parentID?: ParentID,
): Promise<IResdoOperations[]> {
  const data = {
    id,
    previousID,
    parentID,
  }
  const url = "/api/block/moveBlock"
  return request(url, data)
}

export async function getBlockKramdown(
  id: BlockId,
): Promise<IResGetBlockKramdown> {
  const data = {
    id,
  }
  const url = "/api/block/getBlockKramdown"
  return request(url, data)
}

export async function getChildBlocks(
  id: BlockId,
): Promise<IResGetChildBlock[]> {
  const data = {
    id,
  }
  const url = "/api/block/getChildBlocks"
  return request(url, data)
}

export async function transferBlockRef(
  fromID: BlockId,
  toID: BlockId,
  refIDs: BlockId[],
) {
  const data = {
    fromID,
    toID,
    refIDs,
  }
  const url = "/api/block/transferBlockRef"
  return request(url, data)
}

// **************************************** Task List Item Marker (v3.7.3+) ****************************************

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

// **************************************** Attributes ****************************************
export async function setBlockAttrs(
  id: BlockId,
  attrs: { [key: string]: string },
) {
  const data = {
    id,
    attrs,
  }
  const url = "/api/attr/setBlockAttrs"
  return request(url, data)
}

export async function getBlockAttrs(
  id: BlockId,
): Promise<{ [key: string]: string }> {
  const data = {
    id,
  }
  const url = "/api/attr/getBlockAttrs"
  return request(url, data)
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

export async function getBlockByID(blockId: string): Promise<Block> {
  const sqlScript = `select * from blocks where id ='${blockId}'`
  const data = await sql(sqlScript)
  return data[0]
}

// **************************************** Template ****************************************

export async function render(
  id: DocumentId,
  path: string,
): Promise<IResGetTemplates> {
  const data = {
    id,
    path,
  }
  const url = "/api/template/render"
  return request(url, data)
}

export async function renderSprig(template: string): Promise<string> {
  const url = "/api/template/renderSprig"
  return request(url, { template })
}

// **************************************** File ****************************************

export async function getFile(path: string): Promise<any> {
  const data = {
    path,
  }
  const url = "/api/file/getFile"
  try {
    const file = await fetchSyncPost(url, data)
    return file
  } catch {
    return null
  }
}

export async function putFile(path: string, isDir: boolean, file: any) {
  const form = new FormData()
  form.append("path", path)
  form.append("isDir", isDir.toString())
  // Copyright (c) 2023, terwer.
  // https://github.com/terwer/siyuan-plugin-importer/blob/v1.4.1/src/api/kernel-api.ts
  form.append("modTime", Math.floor(Date.now() / 1000).toString())
  form.append("file", file)
  const url = "/api/file/putFile"
  return request(url, form)
}

export async function removeFile(path: string) {
  const data = {
    path,
  }
  const url = "/api/file/removeFile"
  return request(url, data)
}

export async function readDir(path: string): Promise<IResReadDir> {
  const data = {
    path,
  }
  const url = "/api/file/readDir"
  return request(url, data)
}

// **************************************** Export ****************************************

export async function exportMdContent(
  id: DocumentId,
): Promise<IResExportMdContent> {
  const data = {
    id,
  }
  const url = "/api/export/exportMdContent"
  return request(url, data)
}

export async function exportResources(
  paths: string[],
  name: string,
): Promise<IResExportResources> {
  const data = {
    paths,
    name,
  }
  const url = "/api/export/exportResources"
  return request(url, data)
}

// **************************************** Convert ****************************************

export type PandocArgs = string
export async function pandoc(args: PandocArgs[]) {
  const data = {
    args,
  }
  const url = "/api/convert/pandoc"
  return request(url, data)
}

// **************************************** Notification ****************************************

// /api/notification/pushMsg
// {
//     "msg": "test",
//     "timeout": 7000
//   }
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

// **************************************** Network ****************************************
export async function forwardProxy(
  url: string,
  method: string = "GET",
  payload: any = {},
  headers: any[] = [],
  timeout: number = 7000,
  contentType: string = "text/html",
): Promise<IResForwardProxy> {
  const data = {
    url,
    method,
    timeout,
    contentType,
    headers,
    payload,
  }
  const url1 = "/api/network/forwardProxy"
  return request(url1, data)
}

// **************************************** System ****************************************

export async function bootProgress(): Promise<IResBootProgress> {
  return request("/api/system/bootProgress", {})
}

export async function version(): Promise<string> {
  return request("/api/system/version", {})
}

export async function currentTime(): Promise<number> {
  return request("/api/system/currentTime", {})
}

// **************************************** Storage / Criteria (v3.8.3+) ****************************************

export async function getCriteria(): Promise<any[]> {
  return request("/api/storage/getCriteria", {})
}

export async function setCriterion(criterion: any): Promise<void> {
  return request("/api/storage/setCriterion", { criterion })
}

export async function removeCriterion(name: string): Promise<void> {
  return request("/api/storage/removeCriterion", { name })
}

// **************************************** Sort & Reorder (v3.8.3+) ****************************************

export async function reorderNotebooks(notebooks: NotebookId[]): Promise<void> {
  return request("/api/notebook/reorder", { notebooks })
}

export async function setFiletreeSort(notebook: NotebookId, sort: number): Promise<void> {
  return request("/api/filetree/setSort", {
    notebook,
    sort,
  })
}

export async function setDocSortMode(doc: DocumentId, mode: number): Promise<void> {
  return request("/api/filetree/setDocSortMode", {
    doc,
    mode,
  })
}

export async function reorderDocs(notebook: NotebookId, parentID: string, docIDs: string[]): Promise<void> {
  return request("/api/filetree/reorderDocs", {
    notebook,
    parentID,
    docIDs,
  })
}

// **************************************** Database / AV (v3.8.3+) ****************************************

export async function setAttrViewContextFilter(avID: string, keyID: string): Promise<void> {
  return request("/api/av/setAttrViewContextFilter", {
    avID,
    keyID,
  })
}

export async function getAttributeViewRelationCandidates(avID: string, keyID: string, keyword: string = ""): Promise<any> {
  return request("/api/av/getAttributeViewRelationCandidates", {
    avID,
    keyID,
    k: keyword,
  })
}

// **************************************** File Tree & Asset (v3.8.4 / v3.8.5+) ****************************************

export async function duplicateDocTree(id: DocumentId): Promise<DocumentId> {
  return request("/api/filetree/duplicateDocTree", { id })
}

export async function replaceAssetRef(oldPath: string, newPath: string): Promise<void> {
  return request("/api/asset/replaceAssetRef", {
    oldPath,
    newPath,
  })
}

// **************************************** Plugin Publishing (v3.8.4 / v3.8.5+) ****************************************

export async function getPluginPublishInfo(packageName: string): Promise<{
  resources: string[]
  fields: string[]
  granted: boolean
}> {
  return request("/api/petal/getPluginPublishInfo", { packageName })
}

export async function setPluginPublishDataGrant(packageName: string, fields: string[], enabled: boolean): Promise<void> {
  return request("/api/petal/setPluginPublishDataGrant", {
    packageName,
    fields,
    enabled,
  })
}

export async function savePluginPublishData(packageName: string, data: Record<string, string | number | boolean | null>): Promise<void> {
  return request("/api/petal/savePluginPublishData", {
    packageName,
    data,
  })
}

export async function loadPluginPublishData(packageName: string): Promise<Record<string, string | number | boolean | null>> {
  return request("/api/petal/loadPluginPublishData", { packageName })
}


