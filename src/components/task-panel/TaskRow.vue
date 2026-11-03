<template>
  <div
    class="tl-row"
    :class="{ 'tl-row--done': task.done }"
    :style="rowStyle"
    @click="emit('jump', task)"
  >
    <button
      type="button"
      class="tl-check ariaLabel"
      role="checkbox"
      :aria-checked="task.done"
      :aria-label="i18n.toggle"
      @click.stop="emit('toggle', task)"
    >
      <TlIcon
        v-if="task.done"
        path="M20 6 9 17l-5-5"
        class="tl-check__icon"
      />
      <span
        v-else-if="displayMarker"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { TaskItem } from "@/data/types"
import TlIcon from "@/components/_shared/TlIcon.vue"
import { highlightText } from "@/utils/text"
import { usePlugin } from "@/main"

const props = withDefaults(defineProps<{
  task: TaskItem
  keyword?: string
}>(), { keyword: "" })

const emit = defineEmits<{
  toggle: [task: TaskItem]
  jump: [task: TaskItem]
}>()

const i18n = usePlugin().i18n

const renderedContent = computed(() =>
  highlightText(props.task.content || "…", props.keyword),
)

/**
 * 自定义任务标记（/ - ! 等）渲染进勾选框内，与思源编辑器
 * （_task.scss ::before content: var(--task-marker)）形态一致。
 */
const displayMarker = computed(() => {
  if (props.task.done) {
    return ""
  }
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
</script>
