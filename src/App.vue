<template>
  <div class="tl-panel">
    <ScopeBar
      v-model="scope"
      v-model:doc-sort="docSort"
      :loading="loading"
      :notebooks="notebooks"
      :resolved-doc-id="resolvedDocId"
      :favorites="favorites"
      :is-favorited="isCurrentFavorited"
      :status-filter="statusFilter"
      :show-headings="showHeadings"
      :heading-levels="headingLevels"
      :history="historyList"
      @refresh="refresh()"
      @toggle-favorite="onToggleFavorite"
      @apply-favorite="onApplyFavorite"
      @remove-favorite="onRemoveFavorite"
      @jump-history="onJumpHistory"
      @undo-history="onUndoHistory"
      @clear-history="onClearHistory"
    />
    <FilterBar
      v-model:status="statusFilter"
      v-model:keyword="keyword"
      v-model:show-headings="showHeadings"
      v-model:heading-levels="headingLevels"
      :custom-markers="customMarkers"
    />
    <div class="tl-body">
      <div
        v-if="!collection && loading"
        class="tl-placeholder"
      >
        {{ i18n.loading }}
      </div>
      <div
        v-else-if="errorMessage"
        class="tl-placeholder tl-placeholder--error"
      >
        {{ errorMessage }}
      </div>
      <template v-else>
        <div
          v-if="truncated"
          class="tl-truncated"
        >
          {{ truncatedText }}
        </div>
        <div
          v-if="groups.length === 0"
          class="tl-placeholder"
        >
          <TlIcon
            path="M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01"
            class="tl-empty__icon"
          />
          <div class="tl-empty__title">
            {{ i18n.empty }}
          </div>
          <div class="tl-empty__hint">
            {{ i18n.emptyHint }}
          </div>
        </div>
        <TaskTree
          v-else
          :groups="groups"
          :folded="folded"
          :can-exclude="canExclude"
          :keyword="keyword"
          :count-unfinished="countUnfinished"
          :click-status-menu="clickStatusMenu"
          @toggle="onToggle"
          @update-marker="onUpdateMarker"
          @jump="onJump"
          @toggle-fold="onToggleFold"
          @toggle-fold-all="onToggleFoldAll"
          @exclude-doc="onExcludeDoc"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getActiveEditor, openTab } from "siyuan"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import FilterBar from "@/components/task-panel/FilterBar.vue"
import ScopeBar from "@/components/task-panel/ScopeBar.vue"
import TaskTree from "@/components/task-panel/TaskTree.vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import {
  batchUpdateTaskListItemMarker,
  lsNotebooks,
  pushErrMsg,
  pushMsg,
  updateTaskListItemMarker,
} from "@/api"
import { normalizeExcludePaths } from "@/data/scope"
import { addHistoryRecord, markHistoryUndone, sanitizeHistory } from "@/data/history"
import {
  extractCustomMarkers,
  isTaskDone,
  markerForStatus,
  resolveTaskStatus,
} from "@/data/status"
import { isFavoriteMatching } from "@/utils/favorite"
import { collectGroupKeys } from "@/utils/tree"
import {
  buildTaskGroups,
  collectTasks,
  filterTasksByKeyword,
  type StatusFilter,
  type TaskCollection,
} from "@/data/tasks"
import type {
  DocSortMode,
  PathFavorite,
  ScopeSelection,
  TaskGroup,
  TaskHistoryItem,
  TaskItem,
  TaskStatus,
} from "@/data/types"
import { HISTORY_STORAGE_NAME } from "@/index"
import { usePlugin } from "@/main"

const plugin = usePlugin()
const i18n = plugin.i18n

const scope = ref<ScopeSelection>({ ...plugin.config.scope })
const statusFilter = ref<StatusFilter>("all")
const keyword = ref("")
const notebooks = ref<{ id: string, name: string }[]>([])
const favorites = ref<PathFavorite[]>([])
const collection = ref<TaskCollection | null>(null)
const loading = ref(false)
const errorMessage = ref("")
const truncated = ref(false)
const historyList = ref<TaskHistoryItem[]>([])
/** 当前文档档解析出的文档 id（用于 switch-protyle 变更检测与范围摘要回显） */
const resolvedDocId = ref<string>("")

async function saveHistory() {
  await plugin.saveData(HISTORY_STORAGE_NAME, historyList.value).catch(() => {})
}

// ---------- 视图状态（标题分组层级 + 折叠态 + 文档排序，持久化到插件 config） ----------

const showHeadings = ref(true)
const headingLevels = ref<number[]>([1, 2, 3, 4, 5, 6])
const folded = ref(new Set<string>())
const sortTodoFirst = ref(plugin.config.sortTodoFirst ?? false)
const countUnfinished = ref(plugin.config.countUnfinished ?? false)
const clickStatusMenu = ref(plugin.config.clickStatusMenu ?? false)
const docSort = ref<DocSortMode>(plugin.config.docSort ?? "updated-desc")

const groups = computed<TaskGroup[]>(() => {
  if (!collection.value) {
    return []
  }
  const baseTasks = filterTasksByKeyword(collection.value.tasks, keyword.value)
  return buildTaskGroups(baseTasks, collection.value.notebookNames, i18n.untitledGroup, {
    showHeadings: showHeadings.value,
    headingLevels: headingLevels.value,
    sortTodoFirst: sortTodoFirst.value,
    statusFilter: statusFilter.value,
    docSort: docSort.value,
    docMetas: collection.value.docMetas,
  })
})

const customMarkers = computed(() =>
  extractCustomMarkers(collection.value?.tasks ?? []),
)

const truncatedText = computed(() =>
  (i18n.truncated || "").replace("${n}", String(plugin.config.limit)),
)

/** 文档级排除按钮的显示条件：排除谓词仅在 notebook / all 档下推到查询 */
const canExclude = computed(() =>
  scope.value.mode === "notebook" || scope.value.mode === "all",
)

async function refresh() {
  loading.value = true
  errorMessage.value = ""
  try {
    const sel: ScopeSelection = { ...scope.value }
    if (sel.mode === "activeDoc") {
      // 当前文档档在查询时解析活动编辑器，不回写 scope（避免与 watch 死循环）
      sel.docId = getActiveEditor()?.protyle?.block?.rootID || undefined
      resolvedDocId.value = sel.docId ?? ""
    }
    collection.value = await collectTasks(sel, plugin.config.limit)
    truncated.value = collection.value.truncated
    // 索引延迟窗口保护：刷新后短时保留刚写回的勾选状态
    prunePendingConfirm()
    for (const [id, pending] of pendingConfirm) {
      const task = collection.value.tasks.find((t) => t.id === id)
      if (task && (task.marker !== pending.marker || task.done !== pending.done)) {
        task.marker = pending.marker
        task.done = pending.done
        task.status = resolveTaskStatus(pending.marker)
      }
    }
    // 防抖待落盘队列中的最新状态优先覆盖（避免刷新冲刷掉尚未落盘的前台即时修改）
    for (const [id, item] of pendingWrites) {
      const task = collection.value.tasks.find((t) => t.id === id)
      if (task && task.marker !== item.marker) {
        task.marker = item.marker
        task.done = isTaskDone(item.marker)
        task.status = resolveTaskStatus(item.marker)
      }
    }
    // 注意：refresh 内严禁写插件存储——每次写盘都会触发内核存储变更广播，
    // 极易与面板刷新形成自激励循环（范围持久化仅在 scope watch 中防抖执行）
  } catch (error: any) {
    errorMessage.value = (i18n.queryFailed || "Query failed: ${msg}").replace(
      "${msg}",
      error?.message ?? String(error),
    )
  } finally {
    loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
let confirmTimer: ReturnType<typeof setTimeout> | undefined

function scheduleRefresh(delay = 500) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    refresh()
  }, delay)
}

/**
 * 最近写回成功的任务（id -> 期望状态）。内核对勾选写回的重新索引有 1~2 秒
 * 延迟窗口，期间的自动刷新会读到过期状态并覆盖乐观更新；此映射在刷新后
 * 短时间内强制保留写回结果，超时后恢复以服务端数据为准。
 */
const pendingConfirm = new Map<string, { marker: string, done: boolean, until: number }>()

function prunePendingConfirm() {
  const now = Date.now()
  for (const [id, pending] of pendingConfirm) {
    if (now > pending.until) {
      pendingConfirm.delete(id)
    }
  }
}

/**
 * 待落盘队列结构：前台即时变更，后台防抖统一写盘。
 * 记录任务初始状态以便落盘失败时精准回滚，并避免连续反悔时的多余网络开销。
 */
interface PendingWriteItem {
  id: string
  marker: string
  task: TaskItem
  initialState: {
    marker: string
    done: boolean
    status: TaskStatus
    prevMarker?: string
  }
}

const pendingWrites = new Map<string, PendingWriteItem>()
let debounceWriteTimer: ReturnType<typeof setTimeout> | undefined

async function onUpdateMarker(task: TaskItem, newMarker: string) {
  const targetMarker = newMarker
  const targetDone = isTaskDone(targetMarker)
  const targetStatus = resolveTaskStatus(targetMarker)

  // 1. 同步记录进入防抖队列前的真实初始状态
  const rawTask = collection.value?.tasks.find((t) => t.id === task.id)
  let writeItem = pendingWrites.get(task.id)
  if (!writeItem) {
    writeItem = {
      id: task.id,
      marker: targetMarker,
      task,
      initialState: {
        marker: rawTask ? rawTask.marker : task.marker,
        done: rawTask ? rawTask.done : task.done,
        status: rawTask ? rawTask.status : task.status,
        prevMarker: rawTask ? rawTask.prevMarker : task.prevMarker,
      },
    }
  } else {
    writeItem.marker = targetMarker
  }

  // 计算 prevMarker 还原标记
  if (targetDone) {
    task.prevMarker = task.marker !== targetMarker ? task.marker : task.prevMarker
  } else if (task.done) {
    task.prevMarker = undefined
  }

  // 2. 前台即时切换状态（0ms 视觉响应）：同步更新 TaskRow 引用与 collection 中的底层对象
  task.done = targetDone
  task.marker = targetMarker
  task.status = targetStatus

  if (collection.value) {
    if (rawTask && rawTask !== task) {
      rawTask.done = targetDone
      rawTask.marker = targetMarker
      rawTask.status = targetStatus
      rawTask.prevMarker = task.prevMarker
    }
    // 触发响应式重绘
    collection.value = { ...collection.value, tasks: [...collection.value.tasks] }
  }

  // 3. 乐观保护：立即记录，防止期间意外触发刷新导致前台闪退回旧状态
  pendingConfirm.set(task.id, { marker: targetMarker, done: targetDone, until: Date.now() + 6000 })

  // 4. 后台防抖落盘
  pendingWrites.set(task.id, writeItem)
  scheduleFlushPendingWrites(350)
}

function scheduleFlushPendingWrites(delay = 350) {
  clearTimeout(debounceWriteTimer)
  debounceWriteTimer = setTimeout(() => {
    void flushPendingWrites()
  }, delay)
}

/**
 * 后台批量/单项落盘：防抖结束后统一向思源内核写入，彻底消除前台点击卡顿与网络竞态。
 */
async function flushPendingWrites() {
  clearTimeout(debounceWriteTimer)
  debounceWriteTimer = undefined

  if (pendingWrites.size === 0) {
    return
  }

  const batch = Array.from(pendingWrites.values())
  pendingWrites.clear()

  // 过滤快速点击反悔后最终状态与初始状态完全一致的项
  const toSave = batch.filter((item) => item.marker !== item.initialState.marker)
  if (toSave.length === 0) {
    return
  }

  try {
    if (toSave.length === 1) {
      await updateTaskListItemMarker(toSave[0].id, toSave[0].marker)
    } else {
      await batchUpdateTaskListItemMarker(toSave.map((item) => ({ id: item.id, marker: item.marker })))
    }

    // 落盘成功：记入操作历史
    for (const item of toSave) {
      historyList.value = addHistoryRecord(historyList.value, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        taskId: item.id,
        rootId: item.task.rootId,
        docTitle: item.task.hpath || "",
        content: item.task.content || "",
        fromMarker: item.initialState.marker,
        toMarker: item.marker,
        fromStatus: item.initialState.status,
        toStatus: item.task.status,
        timestamp: Date.now(),
      })
    }
    void saveHistory()

    // 落盘成功：在内核索引稳定后做一次确认刷新
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      refresh()
    }, 2600)
  } catch (err) {
    // 落盘失败：对未产生新一轮变更的任务执行安全回滚
    for (const item of toSave) {
      if (pendingWrites.has(item.id)) {
        continue
      }
      item.task.done = item.initialState.done
      item.task.marker = item.initialState.marker
      item.task.status = item.initialState.status
      item.task.prevMarker = item.initialState.prevMarker
      pendingConfirm.delete(item.id)

      if (collection.value) {
        const raw = collection.value.tasks.find((t) => t.id === item.id)
        if (raw) {
          raw.done = item.initialState.done
          raw.marker = item.initialState.marker
          raw.status = item.initialState.status
          raw.prevMarker = item.initialState.prevMarker
        }
      }
    }
    if (collection.value) {
      collection.value = { ...collection.value, tasks: [...collection.value.tasks] }
    }
    pushErrMsg(i18n.toggleFailed || "Failed to write back", 4000)
  }
}

async function onToggle(task: TaskItem) {
  // 对齐思源原生切换行为：未完成项（待办/进行中/放弃/自定义）点击直接标记为完成；完成项点击切换为待办（若有先前自定义标记则优先恢复）
  if (task.status !== "done") {
    return onUpdateMarker(task, "x")
  }
  const customPrevious = task.prevMarker
  const restoreMarker = customPrevious && customPrevious.trim() && customPrevious.trim().toLowerCase() !== "x"
    ? customPrevious
    : " "
  return onUpdateMarker(task, restoreMarker)
}

function onJump(task: TaskItem) {
  // app 必须传宿主 App 实例（plugin.app），传插件实例会导致 openFile 内部
  // 模型/页签归属判断失配，跳转在 getBlockInfo 之后静默中断
  // cb-get-context：渲染文档全文（否则聚焦模式只渲染目标块附近），
  // cb-get-focus：滚动定位到目标块；高亮由下方 afterOpen 自绘闪烁动画承担
  // （cb-get-hl 的常驻高亮不符合"闪烁后消失"的预期，故不使用）
  openTab({
    app: plugin.app,
    doc: {
      id: task.id,
      action: ["cb-get-focus", "cb-get-context"],
    },
    afterOpen: (model: any) => flashBlock(model, task.id),
  })
}

function onJumpHistory(item: TaskHistoryItem) {
  openTab({
    app: plugin.app,
    doc: {
      id: item.taskId,
      action: ["cb-get-focus", "cb-get-context"],
    },
    afterOpen: (model: any) => flashBlock(model, item.taskId),
  })
}

async function onUndoHistory(item: TaskHistoryItem) {
  if (item.undone) {
    return
  }
  try {
    const currentTask = collection.value?.tasks.find((t) => t.id === item.taskId)
    if (currentTask) {
      await onUpdateMarker(currentTask, item.fromMarker)
    } else {
      await updateTaskListItemMarker(item.taskId, item.fromMarker)
    }
    historyList.value = markHistoryUndone(historyList.value, item.id)
    await saveHistory()
    pushMsg(i18n.undoSuccess || "已还原任务状态", 3000)
  } catch (err: any) {
    pushErrMsg(
      (i18n.undoFailed || "还原任务状态失败") + ": " + (err?.message ?? String(err)),
      4000,
    )
  }
}

async function onClearHistory() {
  historyList.value = []
  await saveHistory()
}

/** 目标块渲染完成后加一次性闪烁框（约 1.8s 后自动移除） */
function flashBlock(model: any, blockId: string) {
  const protyle = model?.editor?.protyle
  if (!protyle?.element) {
    return
  }
  let tries = 0
  const timer = window.setInterval(() => {
    tries++
    const el = protyle.element.querySelector(`[data-node-id="${blockId}"]`) as HTMLElement | null
    if (el) {
      window.clearInterval(timer)
      el.classList.remove("tl-jump-flash")
      // 强制回流以重启动画
      void el.offsetWidth
      el.classList.add("tl-jump-flash")
      window.setTimeout(() => el.classList.remove("tl-jump-flash"), 1900)
    } else if (tries > 30) {
      window.clearInterval(timer)
    }
  }, 100)
}

function onSwitchProtyle(event: CustomEvent<any>) {
  if (scope.value.mode !== "activeDoc") {
    return
  }
  const rootId = event.detail?.protyle?.block?.rootID
  if (rootId && rootId !== resolvedDocId.value) {
    scheduleRefresh(100)
  }
}

onMounted(async () => {
  plugin.eventBus.on("switch-protyle", onSwitchProtyle)
  // 监听插件设置保存通知，即时响应排序等首选项变更
  ;(plugin as any).onConfigUpdated = (cfg: any) => {
    sortTodoFirst.value = Boolean(cfg.sortTodoFirst)
    countUnfinished.value = Boolean(cfg.countUnfinished)
    clickStatusMenu.value = Boolean(cfg.clickStatusMenu)
  }
  // 面板挂载可能早于插件 onload 的配置加载完成，先等待再初始化范围与视图状态
  await (plugin as any).readyPromise?.catch?.(() => {})
  scope.value = { ...plugin.config.scope }
  showHeadings.value = plugin.config.showHeadings !== false
  headingLevels.value = Array.isArray(plugin.config.headingLevels) && plugin.config.headingLevels.length > 0
    ? [...plugin.config.headingLevels]
    : [1, 2, 3, 4, 5, 6]
  folded.value = new Set(Array.isArray(plugin.config.foldedKeys) ? plugin.config.foldedKeys : [])
  sortTodoFirst.value = Boolean(plugin.config.sortTodoFirst)
  countUnfinished.value = Boolean(plugin.config.countUnfinished)
  clickStatusMenu.value = Boolean(plugin.config.clickStatusMenu)
  favorites.value = Array.isArray(plugin.config.favorites) ? [...plugin.config.favorites] : []
  const savedHistory = await plugin.loadData(HISTORY_STORAGE_NAME).catch(() => null)
  historyList.value = sanitizeHistory(savedHistory)
  try {
    const result = await lsNotebooks()
    notebooks.value = (result?.notebooks ?? [])
      .filter((nb: any) => !nb.closed)
      .map((nb: any) => ({ id: nb.id, name: nb.name }))
  } catch {
    notebooks.value = []
  }
  refresh()
})

onUnmounted(() => {
  plugin.eventBus.off("switch-protyle", onSwitchProtyle)
  if ((plugin as any).onConfigUpdated) {
    (plugin as any).onConfigUpdated = undefined
  }
  clearTimeout(debounceTimer)
  clearTimeout(saveTimer)
  clearTimeout(confirmTimer)
  clearTimeout(viewSaveTimer)
  if (debounceWriteTimer) {
    clearTimeout(debounceWriteTimer)
    void flushPendingWrites()
  }
})

let saveTimer: ReturnType<typeof setTimeout> | undefined
let viewSaveTimer: ReturnType<typeof setTimeout> | undefined

// 用户改动范围时：防抖刷新 + 防抖持久化（refresh 路径绝不写盘）
watch(scope, () => {
  scheduleRefresh(100)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    plugin.config.scope = { ...scope.value }
    plugin.saveConfig()
  }, 800)
}, { deep: true })

// 视图状态（标题层级开关 / 折叠态 / 文档排序）改动：防抖持久化。几个 ref 均以整体替换
// 方式更新（折叠态每次生成新 Set），plain watch 即可感知
watch([showHeadings, headingLevels, folded, docSort], () => {
  clearTimeout(viewSaveTimer)
  viewSaveTimer = setTimeout(() => {
    plugin.config.showHeadings = showHeadings.value
    plugin.config.headingLevels = [...headingLevels.value]
    plugin.config.foldedKeys = [...folded.value]
    plugin.config.docSort = docSort.value
    plugin.saveConfig()
  }, 600)
})

function onToggleFold(key: string) {
  const next = new Set(folded.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  folded.value = next
}

/**
 * 文档节点悬浮操作：全部展开 / 全部折叠该文档的所有层级。
 * - 若文档自身折叠或存在任意未展开的子标题：全部展开（从 folded 移除文档及所有子层级 key）
 * - 若文档自身及所有子标题均处于展开态：全部折叠（将文档及所有子层级 key 全部写入 folded）
 */
function onToggleFoldAll(group: TaskGroup) {
  const allKeys = collectGroupKeys(group)
  const isExpanded = allKeys.every((k) => !folded.value.has(k))
  const next = new Set(folded.value)
  if (isExpanded) {
    for (const key of allKeys) {
      next.add(key)
    }
  } else {
    for (const key of allKeys) {
      next.delete(key)
    }
  }
  folded.value = next
}

/**
 * 文档节点悬浮按钮：将该文档（含子文档）加入排除清单。
 * 路径从具体笔记本作为根目录显示（形如 /笔记本名/文档路径）。
 * 整体替换 scope 触发既有 deep watch（100ms 防抖刷新、800ms 防抖持久化），此处不再手动刷新。
 * 移除仍走范围浮层的"排除路径"列表。
 */
function onExcludeDoc(group: TaskGroup) {
  const hpath = (group.hpath ?? "").trim()
  if (!hpath || hpath === "/") {
    return
  }
  const nbName
    = (group.box ? notebooks.value.find((nb) => nb.id === group.box)?.name : "")
    || (scope.value.mode === "notebook" && scope.value.box ? notebooks.value.find((nb) => nb.id === scope.value.box)?.name : "")
    || ""
  const fullPath = nbName ? `/${nbName}${hpath}` : hpath

  scope.value = {
    ...scope.value,
    excludePaths: normalizeExcludePaths([...(scope.value.excludePaths ?? []), fullPath]),
  }
}

// ---------- 常用路径收藏 ----------

const isCurrentFavorited = computed(() => {
  if (scope.value.mode !== "path" || !scope.value.docId) {
    return false
  }
  return favorites.value.some((fav) => matchesCurrentState(fav))
})

function matchesCurrentState(fav: PathFavorite): boolean {
  return isFavoriteMatching(fav, {
    docId: scope.value.docId,
    includeSubdocs: scope.value.includeSubdocs,
    includeLinked: scope.value.includeLinked,
    status: statusFilter.value,
    showHeadings: showHeadings.value,
    headingLevels: headingLevels.value,
  })
}

function onToggleFavorite() {
  if (scope.value.mode !== "path" || !scope.value.docId) {
    return
  }
  const matchIdx = favorites.value.findIndex((fav) => matchesCurrentState(fav))
  if (matchIdx >= 0) {
    favorites.value.splice(matchIdx, 1)
    favorites.value = [...favorites.value]
    plugin.config.favorites = [...favorites.value]
    plugin.saveConfig()
    return
  }
  if (favorites.value.length >= 10) {
    pushMsg(i18n.favoriteLimitReached || "收藏已达 10 个上限，请先删除不需要的项", 4000)
    return
  }
  const leafTitle = (scope.value.hpath || "").replace(/^\/+/, "").split("/").filter(Boolean).pop() || ""
  const newFav: PathFavorite = {
    id: `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    docId: scope.value.docId,
    box: scope.value.box || "",
    path: scope.value.path || "",
    hpath: scope.value.hpath || "",
    title: leafTitle || (i18n.untitledGroup || "未命名文档"),
    includeSubdocs: Boolean(scope.value.includeSubdocs),
    includeLinked: Boolean(scope.value.includeLinked),
    status: statusFilter.value,
    showHeadings: showHeadings.value,
    headingLevels: [...headingLevels.value].sort((a, b) => a - b),
    createdAt: Date.now(),
  }
  favorites.value = [newFav, ...favorites.value]
  plugin.config.favorites = [...favorites.value]
  plugin.saveConfig()
}

function onApplyFavorite(fav: PathFavorite) {
  scope.value = {
    mode: "path",
    docId: fav.docId,
    box: fav.box,
    path: fav.path,
    hpath: fav.hpath,
    includeSubdocs: fav.includeSubdocs ?? false,
    includeLinked: fav.includeLinked ?? false,
    excludePaths: scope.value.excludePaths,
  }
  statusFilter.value = fav.status
  showHeadings.value = fav.showHeadings
  headingLevels.value = [...fav.headingLevels]
}

function onRemoveFavorite(favId: string) {
  favorites.value = favorites.value.filter((f) => f.id !== favId)
  plugin.config.favorites = [...favorites.value]
  plugin.saveConfig()
}
</script>
