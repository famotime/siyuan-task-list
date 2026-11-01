<template>
  <div
    class="tl-tree"
    :style="{ '--tl-depth': String(depth) }"
  >
    <div
      v-for="group in groups"
      :key="group.key"
      class="tl-group"
    >
      <div
        class="tl-group__head"
        :class="{ 'ariaLabel': group.kind === 'doc' && group.hpath }"
        :aria-label="group.kind === 'doc' ? group.hpath : undefined"
        @click="emit('toggleFold', group.key)"
      >
        <TlIcon
          path="m9 18 6-6-6-6"
          class="tl-caret"
          :class="{ 'tl-caret--folded': folded.has(group.key) }"
        />
        <TlIcon
          v-if="group.kind === 'doc'"
          path="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M16 13H8 M16 17H8 M10 9H8"
          class="tl-group__docicon"
        />
        <span
          v-if="group.kind === 'heading'"
          class="tl-hash"
        >{{ '#'.repeat(group.level) }}</span>
        <span
          class="tl-group__title"
          :class="titleClass(group)"
        >
          <span
            v-if="group.kind === 'doc' && group.parentPath"
            class="tl-group__parent"
          >{{ group.parentPath }} / </span><span>{{ group.title }}</span>
        </span>
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
          :depth="depth + 1"
          :folded="folded"
          @toggle="emit('toggle', $event)"
          @jump="emit('jump', $event)"
          @toggle-fold="emit('toggleFold', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TaskGroup, TaskItem } from "@/data/types"
import TaskRow from "@/components/task-panel/TaskRow.vue"
import TlIcon from "@/components/_shared/TlIcon.vue"

const props = withDefaults(defineProps<{
  groups: TaskGroup[]
  /** 折叠态由 App 统一持有（面板递归共享 + 持久化） */
  folded: Set<string>
  /** 树深度：注入 --tl-depth，组头与任务行按同一网格缩进 */
  depth?: number
}>(), { depth: 0 })

const emit = defineEmits<{
  toggle: [task: TaskItem]
  jump: [task: TaskItem]
  toggleFold: [key: string]
}>()

function titleClass(group: TaskGroup): string {
  if (group.kind === "doc") {
    return "tl-title--doc"
  }
  if (group.kind === "heading") {
    return "tl-title--h" + group.level
  }
  return "tl-title--notebook"
}
</script>
