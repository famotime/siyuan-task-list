<template>
  <div
    class="tl-row"
    :class="{ 'tl-row--done': task.done }"
    :title="task.hpath"
    @click="emit('jump', task)"
  >
    <button
      class="tl-check"
      :title="i18n.toggle"
      :aria-checked="task.done"
      role="checkbox"
      @click.stop="emit('toggle', task)"
    >
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
    </button>
    <span
      v-if="customMarker"
      class="tl-marker"
      :title="customMarker"
    >{{ customMarker }}</span>
    <span class="tl-content">{{ task.content || "…" }}</span>
    <span
      class="tl-jump"
      :title="i18n.jump"
    >
      <svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8" /></svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { TaskItem } from "@/data/types"
import { usePlugin } from "@/main"

const props = defineProps<{
  task: TaskItem
}>()

const emit = defineEmits<{
  toggle: [task: TaskItem]
  jump: [task: TaskItem]
}>()

const i18n = usePlugin().i18n

/** 自定义任务标记（/ - ! 等）以角标展示，便于与普通未完成区分 */
const customMarker = computed(() => {
  const marker = (props.task.marker ?? "").trim()
  return marker && marker.toLowerCase() !== "x" ? marker : ""
})
</script>
