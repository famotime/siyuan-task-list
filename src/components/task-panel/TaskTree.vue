<template>
  <div class="tl-tree">
    <div
      v-for="group in groups"
      :key="group.key"
      class="tl-group"
    >
      <div
        class="tl-group__head"
        @click="toggleFold(group.key)"
      >
        <svg
          class="tl-caret"
          :class="{ 'tl-caret--folded': folded.has(group.key) }"
          viewBox="0 0 24 24"
        ><path d="M9 6l6 6-6 6" /></svg>
        <span
          class="tl-group__title"
          :class="'tl-title--h' + group.level"
        >{{ group.title }}</span>
        <span class="tl-group__count">{{ group.total - group.done }}/{{ group.total }}</span>
      </div>
      <div
        v-show="!folded.has(group.key)"
        class="tl-group__body"
      >
        <div
          v-for="cluster in group.listGroups"
          :key="cluster.key"
          class="tl-cluster"
        >
          <TaskRow
            v-for="task in cluster.tasks"
            :key="task.id"
            :task="task"
            @toggle="emit('toggle', $event)"
            @jump="emit('jump', $event)"
          />
        </div>
        <TaskTree
          v-if="group.children.length"
          :groups="group.children"
          @toggle="emit('toggle', $event)"
          @jump="emit('jump', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import type { TaskGroup, TaskItem } from "@/data/types"
import TaskRow from "@/components/task-panel/TaskRow.vue"

defineProps<{
  groups: TaskGroup[]
}>()

const emit = defineEmits<{
  toggle: [task: TaskItem]
  jump: [task: TaskItem]
}>()

/** 每个递归实例管理自己这一层分组的折叠态 */
const folded = ref(new Set<string>())

function toggleFold(key: string) {
  const next = new Set(folded.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  folded.value = next
}
</script>
