<template>
  <div
    class="tl-row"
    :class="{ 'tl-row--done': task.done }"
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
    <span class="tl-content">{{ task.content || "…" }}</span>
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
import { usePlugin } from "@/main"

const props = defineProps<{
  task: TaskItem
}>()

const emit = defineEmits<{
  toggle: [task: TaskItem]
  jump: [task: TaskItem]
}>()

const i18n = usePlugin().i18n

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
</script>
