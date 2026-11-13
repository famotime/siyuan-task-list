<template>
  <div
    class="tl-row"
    :class="{
      'tl-row--done': task.status === 'done',
      'tl-row--canceled': task.status === 'canceled',
      'tl-row--in-progress': task.status === 'in_progress',
    }"
    :style="rowStyle"
    @click="emit('jump', task)"
  >
    <button
      ref="checkBtnRef"
      type="button"
      class="tl-check ariaLabel"
      role="button"
      :aria-label="i18n.statusFilter || '切换状态'"
      @click.stop="onClickCheck"
      @contextmenu.stop.prevent="openMenu"
    >
      <!-- 完成打勾 -->
      <TlIcon
        v-if="task.status === 'done'"
        path="M20 6 9 17l-5-5"
        class="tl-check__icon tl-check__icon--done"
      />
      <!-- 进行中斜杠 -->
      <TlIcon
        v-else-if="task.status === 'in_progress'"
        path="M9 15l6-6"
        class="tl-check__icon tl-check__icon--progress"
      />
      <!-- 放弃减号横杠 -->
      <TlIcon
        v-else-if="task.status === 'canceled'"
        path="M8 12h8"
        class="tl-check__icon tl-check__icon--canceled"
      />
      <!-- 自定义单字符 -->
      <span
        v-else-if="task.status === 'custom' && displayMarker"
        class="tl-marker"
      >{{ displayMarker }}</span>
    </button>

    <span
      class="tl-content"
      v-html="renderedContent"
    ></span>

    <span
      class="tl-jump ariaLabel"
      :aria-label="i18n.jump"
    >
      <TlIcon
        path="M7 17 17 7M9 7h8v8"
        class="tl-jump__icon"
      />
    </span>

    <!-- 轻量状态切换菜单 (仅在打开时挂载) -->
    <TaskStatusMenu
      v-if="menuOpen"
      :open="menuOpen"
      :anchor="checkBtnRef"
      :status="task.status"
      :current-marker="task.marker"
      @select="onSelectMarker"
      @select-custom="onSelectCustom"
      @close="menuOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { openInputDialog } from "siyuan"
import type { TaskItem } from "@/data/types"
import TlIcon from "@/components/_shared/TlIcon.vue"
import TaskStatusMenu from "@/components/task-panel/TaskStatusMenu.vue"
import { isValidTaskMarker } from "@/data/status"
import { highlightText } from "@/utils/text"
import { usePlugin } from "@/main"

const props = withDefaults(defineProps<{
  task: TaskItem
  keyword?: string
  /** 是否点击状态图标弹出细分状态菜单（默认 false，直接切换待办与完成） */
  clickStatusMenu?: boolean
}>(), { keyword: "", clickStatusMenu: false })

const emit = defineEmits<{
  toggle: [task: TaskItem]
  updateMarker: [task: TaskItem, marker: string]
  jump: [task: TaskItem]
}>()

const i18n = usePlugin().i18n
const checkBtnRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

const renderedContent = computed(() =>
  highlightText(props.task.content || "…", props.keyword, "tl-highlight", props.task.blockRefRanges),
)

const displayMarker = computed(() => {
  const marker = (props.task.marker ?? "").trim()
  return marker && marker.toLowerCase() !== "x" ? marker : ""
})

const rowStyle = computed(() => {
  const subDepth = props.task.subDepth ?? 0
  if (subDepth <= 0) {
    return undefined
  }
  return {
    "--tl-sub-depth": subDepth,
  }
})

function onClickCheck() {
  if (props.clickStatusMenu) {
    openMenu()
  } else {
    emit("toggle", props.task)
  }
}

function openMenu() {
  menuOpen.value = !menuOpen.value
}

function onSelectMarker(marker: string) {
  menuOpen.value = false
  emit("updateMarker", props.task, marker)
}

function onSelectCustom() {
  menuOpen.value = false
  const current = props.task.status === "custom" ? props.task.marker : ""

  if (typeof openInputDialog === "function") {
    openInputDialog({
      title: i18n.customStatusInputTitle || "自定义任务状态",
      value: current || "",
      maxLength: 1,
      placeholder: i18n.customStatusInputHint || "输入单字符",
      onConfirm: (value, dialog) => {
        const next = (value || "").trim()
        if (!isValidTaskMarker(next)) {
          return
        }
        emit("updateMarker", props.task, next)
        dialog.destroy()
      },
    })
  } else {
    const input = window.prompt(i18n.customStatusInputTitle || "自定义任务状态", current || "!")
    if (input && isValidTaskMarker(input.trim())) {
      emit("updateMarker", props.task, input.trim())
    }
  }
}
</script>
