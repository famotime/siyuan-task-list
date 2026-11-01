<template>
  <div class="tl-panel">
    <ScopeBar
      v-model="scope"
      :notebooks="notebooks"
      :resolved-doc-id="resolvedDocId"
      @refresh="refresh()"
    />
    <FilterBar
      v-model:status="statusFilter"
      v-model:keyword="keyword"
      v-model:show-headings="showHeadings"
      v-model:heading-levels="headingLevels"
    />
    <div class="tl-body">
      <div
        v-if="loading"
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
          @toggle="onToggle"
          @jump="onJump"
          @toggle-fold="onToggleFold"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IWebSocketData } from "siyuan"
import { getActiveEditor, openTab } from "siyuan"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import FilterBar from "@/components/task-panel/FilterBar.vue"
import ScopeBar from "@/components/task-panel/ScopeBar.vue"
import TaskTree from "@/components/task-panel/TaskTree.vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import { lsNotebooks, pushErrMsg, updateTaskListItemMarker } from "@/api"
import { markerForStatus } from "@/data/status"
import {
  buildTaskGroups,
  collectTasks,
  filterTasks,
  type StatusFilter,
  type TaskCollection,
} from "@/data/tasks"
import type {
  ScopeSelection,
  TaskGroup,
  TaskItem,
} from "@/data/types"
import { usePlugin } from "@/main"

const plugin = usePlugin()
const i18n = plugin.i18n

const scope = ref<ScopeSelection>({ ...plugin.config.scope })
const statusFilter = ref<StatusFilter>("all")
const keyword = ref("")
const notebooks = ref<{ id: string, name: string }[]>([])
const collection = ref<TaskCollection | null>(null)
const loading = ref(false)
const errorMessage = ref("")
const truncated = ref(false)
/** 当前文档档解析出的文档 id（用于 switch-protyle 变更检测与范围摘要回显） */
const resolvedDocId = ref<string>("")

// ---------- 视图状态（标题分组层级 + 折叠态，持久化到插件 config） ----------

const showHeadings = ref(true)
const headingLevels = ref<number[]>([1, 2, 3, 4, 5, 6])
const folded = ref(new Set<string>())

const groups = computed<TaskGroup[]>(() => {
  if (!collection.value) {
    return []
  }
  const visible = filterTasks(collection.value.tasks, statusFilter.value, keyword.value)
  return buildTaskGroups(visible, collection.value.notebookNames, i18n.untitledGroup, {
    showHeadings: showHeadings.value,
    headingLevels: headingLevels.value,
  })
})

const truncatedText = computed(() =>
  (i18n.truncated || "").replace("${n}", String(plugin.config.limit)),
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
      if (task && task.done !== pending.done) {
        task.done = pending.done
        task.marker = markerForStatus(pending.done)
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
const pendingConfirm = new Map<string, { done: boolean, until: number }>()

function prunePendingConfirm() {
  const now = Date.now()
  for (const [id, pending] of pendingConfirm) {
    if (now > pending.until) {
      pendingConfirm.delete(id)
    }
  }
}

async function onToggle(task: TaskItem) {
  const previousDone = task.done
  const previousMarker = task.marker
  const targetDone = !previousDone

  // 写回值：勾选为 "x"；取消时优先还原本会话中勾选前的自定义标记（/ - ! 等）
  let writeMarker: string
  if (targetDone) {
    writeMarker = markerForStatus(true)
  } else {
    const customPrevious = task.prevMarker
    writeMarker = customPrevious && customPrevious.trim() && customPrevious.trim().toLowerCase() !== "x"
      ? customPrevious
      : markerForStatus(false)
  }

  // 乐观更新：视图即时重排，失败回滚
  task.prevMarker = targetDone ? previousMarker : undefined
  task.done = targetDone
  task.marker = writeMarker
  try {
    await updateTaskListItemMarker(task.id, writeMarker)
    // 写回成功：短窗口内保护乐观状态，并在索引稳定后做一次确认刷新
    pendingConfirm.set(task.id, { done: targetDone, until: Date.now() + 6000 })
    clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      refresh()
    }, 2600)
  } catch {
    task.done = previousDone
    task.marker = previousMarker
    task.prevMarker = undefined
    pushErrMsg(i18n.toggleFailed || "Failed to write back", 4000)
  }
}

function onJump(task: TaskItem) {
  // app 必须传宿主 App 实例（plugin.app），传插件实例会导致 openFile 内部
  // 模型/页签归属判断失配，跳转在 getBlockInfo 之后静默中断
  openTab({
    app: plugin.app,
    doc: {
      id: task.id,
      action: ["cb-get-focus", "cb-get-hl"],
    },
  })
}

const WS_REFRESH_CMDS = new Set(["savedoc", "transactions", "rename"])

function onWsMain(event: CustomEvent<IWebSocketData>) {
  if (WS_REFRESH_CMDS.has(event.detail?.cmd)) {
    // transactions 常伴索引重建，稍长防抖减少读过期索引
    scheduleRefresh(1200)
  }
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
  plugin.eventBus.on("ws-main", onWsMain)
  plugin.eventBus.on("switch-protyle", onSwitchProtyle)
  // 面板挂载可能早于插件 onload 的配置加载完成，先等待再初始化范围与视图状态
  await (plugin as any).readyPromise?.catch?.(() => {})
  scope.value = { ...plugin.config.scope }
  showHeadings.value = plugin.config.showHeadings !== false
  headingLevels.value = Array.isArray(plugin.config.headingLevels) && plugin.config.headingLevels.length > 0
    ? [...plugin.config.headingLevels]
    : [1, 2, 3, 4, 5, 6]
  folded.value = new Set(Array.isArray(plugin.config.foldedKeys) ? plugin.config.foldedKeys : [])
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
  plugin.eventBus.off("ws-main", onWsMain)
  plugin.eventBus.off("switch-protyle", onSwitchProtyle)
  clearTimeout(debounceTimer)
  clearTimeout(saveTimer)
  clearTimeout(confirmTimer)
  clearTimeout(viewSaveTimer)
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

// 视图状态（标题层级开关 / 折叠态）改动：防抖持久化。三个 ref 均以整体替换
// 方式更新（折叠态每次生成新 Set），plain watch 即可感知
watch([showHeadings, headingLevels, folded], () => {
  clearTimeout(viewSaveTimer)
  viewSaveTimer = setTimeout(() => {
    plugin.config.showHeadings = showHeadings.value
    plugin.config.headingLevels = [...headingLevels.value]
    plugin.config.foldedKeys = [...folded.value]
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
</script>
