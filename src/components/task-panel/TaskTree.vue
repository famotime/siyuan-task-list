<template>
  <div
    class="tl-tree"
    :class="{ 'tl-tree--sub': depth > 0 }"
    :style="{ '--tl-depth': String(depth) }"
  >
    <div
      v-for="group in groups"
      :key="group.key"
      class="tl-group"
    >
      <div
        class="tl-group__head"
        :class="{
          'ariaLabel': group.kind === 'doc' && group.hpath,
          'tl-group__head--folded': folded.has(group.key),
          'tl-group__head--has-actions': hasActions(group),
          'tl-group__head--can-exclude': canExcludeDoc(group),
        }"
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
          class="tl-group__title"
          :class="[
            titleClass(group),
            { 'ariaLabel': group.kind === 'doc' && group.hpath },
          ]"
          :aria-label="group.kind === 'doc' ? group.hpath : undefined"
        >
          <span v-html="renderGroupTitle(group)"></span>
        </span>
        <span
          class="tl-pill"
          :class="'tl-pill--' + group.kind"
        >{{ pillText(group) }}</span>
        <span
          class="tl-group__count ariaLabel"
          :aria-label="countTooltip(group)"
        >{{ group.total - group.done }}/{{ group.total }}</span>
        <div
          v-if="hasActions(group)"
          class="tl-group__actions"
        >
          <button
            v-if="canFoldAll(group)"
            type="button"
            class="tl-group__action-btn ariaLabel"
            :aria-label="isAllExpanded(group) ? (i18n.collapseAll || '全部折叠') : (i18n.expandAll || '全部展开')"
            @click.stop="emit('toggleFoldAll', group)"
          >
            <TlIcon
              :path="isAllExpanded(group) ? ICON_CHEVRONS_UP : ICON_CHEVRONS_DOWN"
              class="tl-group__action-icon"
            />
          </button>
          <button
            v-if="canExcludeDoc(group)"
            type="button"
            class="tl-group__action-btn tl-group__action-btn--exclude ariaLabel"
            :aria-label="i18n.excludeDocBtn"
            @click.stop="emit('excludeDoc', group)"
          >
            <TlIcon
              :path="ICON_EXCLUDE"
              class="tl-group__action-icon"
            />
          </button>
        </div>
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
            :keyword="keyword"
            @toggle="emit('toggle', $event)"
            @jump="emit('jump', $event)"
          />
        </div>
        <TaskTree
          v-if="group.children.length"
          :groups="group.children"
          :depth="depth + 1"
          :folded="folded"
          :can-exclude="canExclude"
          :keyword="keyword"
          @toggle="emit('toggle', $event)"
          @jump="emit('jump', $event)"
          @toggle-fold="emit('toggleFold', $event)"
          @toggle-fold-all="emit('toggleFoldAll', $event)"
          @exclude-doc="emit('excludeDoc', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TaskGroup, TaskItem } from "@/data/types"
import TaskRow from "@/components/task-panel/TaskRow.vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import { escapeHtml, highlightText } from "@/utils/text"
import { collectGroupKeys } from "@/utils/tree"
import { usePlugin } from "@/main"

const props = withDefaults(defineProps<{
  groups: TaskGroup[]
  /** 折叠态由 App 统一持有（面板递归共享 + 持久化） */
  folded: Set<string>
  /** 树深度：注入 --tl-depth，组头与任务行按同一网格缩进 */
  depth?: number
  /** 是否显示文档级排除按钮：排除谓词仅在 notebook / all 档生效（App 计算） */
  canExclude?: boolean
  /** 搜索关键字：透传至任务行进行命中内容强调色高亮 */
  keyword?: string
}>(), { depth: 0, canExclude: false, keyword: "" })

const emit = defineEmits<{
  toggle: [task: TaskItem]
  jump: [task: TaskItem]
  toggleFold: [key: string]
  toggleFoldAll: [group: TaskGroup]
  excludeDoc: [group: TaskGroup]
}>()

const i18n = usePlugin().i18n

function countTooltip(group: TaskGroup): string {
  const todo = group.total - group.done
  const total = group.total
  return (i18n.groupCountTooltip || "未完成 ${todo} / 全部 ${total}")
    .replace("${todo}", String(todo))
    .replace("${total}", String(total))
}

const ICON_CHEVRONS_DOWN = "m7 6 5 5 5-5 M7 13l5 5 5-5"
const ICON_CHEVRONS_UP = "m17 11-5-5-5 5 M17 18l-5-5-5 5"
const ICON_EXCLUDE = "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20 M4.93 4.93l14.14 14.14"

/** 仅在存在标题子层级时提供全部展开/折叠按钮 */
function canFoldAll(group: TaskGroup): boolean {
  return group.kind === "doc" && group.children.length > 0
}

/** 是否满足排除文档操作条件 */
function canExcludeDoc(group: TaskGroup): boolean {
  return props.canExclude && group.kind === "doc" && Boolean(group.hpath)
}

/** 是否拥有悬浮操作栏 */
function hasActions(group: TaskGroup): boolean {
  return canFoldAll(group) || canExcludeDoc(group)
}

/** 判断该文档是否已完全展开（自身展开且下属所有标题层级皆展开） */
function isAllExpanded(group: TaskGroup): boolean {
  const allKeys = collectGroupKeys(group)
  return allKeys.every((k) => !props.folded.has(k))
}

function titleClass(group: TaskGroup): string {
  if (group.kind === "doc") {
    return "tl-title--doc"
  }
  if (group.kind === "heading") {
    return "tl-title--h" + group.level
  }
  return "tl-title--notebook"
}

/** 类型胶囊文案：标题按层级显示（如“3级标题”） */
function pillText(group: TaskGroup): string {
  if (group.kind === "doc") {
    return i18n.pillDoc || "Doc"
  }
  if (group.kind === "heading") {
    return (i18n.headingPill || "${n}级标题").replace("${n}", String(group.level))
  }
  return i18n.pillNotebook || "Notebook"
}

function renderGroupTitle(group: TaskGroup): string {
  if (group.kind === "doc" || group.kind === "heading") {
    return highlightText(group.title, props.keyword)
  }
  return escapeHtml(group.title)
}
</script>
