<template>
  <div class="tl-status-select">
    <button
      ref="anchorRef"
      type="button"
      class="tl-status-btn"
      :class="{ 'tl-status-btn--active': isNonDefault }"
      :aria-label="i18n.statusFilter"
      @click="popOpen = !popOpen"
    >
      <span class="tl-status-btn__icon">
        <TlIcon :path="currentIconPath" />
      </span>
      <span class="tl-status-btn__text">{{ displayLabel }}</span>
      <TlIcon
        path="m6 9 6 6 6-6"
        class="tl-chip__caret"
        :class="{ 'tl-chip__caret--open': popOpen }"
      />
    </button>

    <TlPopover
      :open="popOpen"
      :anchor="anchorRef"
      :width="230"
      align="left"
      @close="popOpen = false"
    >
      <div class="tl-status-pop">
        <!-- 快捷预设按钮组 -->
        <div class="tl-status-pop__presets">
          <button
            type="button"
            class="tl-status-pop__preset"
            :class="{ 'tl-status-pop__preset--active': isPresetAll }"
            @click="selectPreset('all')"
          >
            {{ i18n.presetAll }}
          </button>
          <button
            type="button"
            class="tl-status-pop__preset"
            :class="{ 'tl-status-pop__preset--active': isPresetUnfinished }"
            @click="selectPreset('unfinished')"
          >
            {{ i18n.presetUnfinished }}
          </button>
          <button
            type="button"
            class="tl-status-pop__preset"
            :class="{ 'tl-status-pop__preset--active': isPresetInProgress }"
            @click="selectPreset('in_progress')"
          >
            {{ i18n.presetInProgress }}
          </button>
          <button
            type="button"
            class="tl-status-pop__preset"
            :class="{ 'tl-status-pop__preset--active': isPresetDone }"
            @click="selectPreset('done')"
          >
            {{ i18n.presetDone }}
          </button>
        </div>

        <div class="tl-status-pop__divider" />

        <!-- 细分状态多选列表 -->
        <div class="tl-status-pop__list">
          <label
            v-for="item in statusOptions"
            :key="item.type"
            class="tl-status-pop__row"
          >
            <input
              type="checkbox"
              :checked="isTypeChecked(item.type)"
              @change="toggleType(item.type, ($event.target as HTMLInputElement).checked)"
            >
            <span class="tl-status-pop__row-icon">
              <TlIcon :path="item.iconPath" />
            </span>
            <span class="tl-status-pop__row-label">{{ item.label }}</span>
          </label>
        </div>

        <!-- 动态检测到的自定义单字符过滤 Tag -->
        <div
          v-if="customMarkers && customMarkers.length > 0 && isTypeChecked('custom')"
          class="tl-status-pop__custom-sec"
        >
          <div class="tl-status-pop__divider" />
          <div class="tl-status-pop__sub-title">
            {{ i18n.detectedCustomMarkers }}
          </div>
          <div class="tl-status-pop__tags">
            <button
              v-for="item in customMarkers"
              :key="item.marker"
              type="button"
              class="tl-status-tag"
              :class="{ 'tl-status-tag--active': isMarkerActive(item.marker) }"
              @click="toggleCustomMarker(item.marker)"
            >
              <span class="tl-status-tag__marker">[{{ item.marker }}]</span>
              <span class="tl-status-tag__count">{{ item.count }}</span>
            </button>
          </div>
        </div>
      </div>
    </TlPopover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import TlPopover from "@/components/_shared/TlPopover.vue"
import {
  ALL_TASK_STATUSES,
  normalizeStatusFilter,
  UNFINISHED_TASK_STATUSES,
} from "@/data/status"
import type { StatusFilter, StatusFilterConfig, TaskStatus } from "@/data/types"
import { usePlugin } from "@/main"

const props = defineProps<{
  modelValue: StatusFilter
  customMarkers?: Array<{ marker: string, count: number }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: StatusFilter]
}>()

const i18n = usePlugin().i18n
const anchorRef = ref<HTMLElement | null>(null)
const popOpen = ref(false)

// 图标常量路径 (viewBox 0 0 24 24)
const ICON_UNCHECK = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
const ICON_IN_PROGRESS = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 15l6-6"
const ICON_CHECK = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 12l2 2 4-4"
const ICON_CANCELED = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 12h8"
const ICON_CUSTOM = "M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
const ICON_FILTER = "M22 3H2l8 9.46V19l4 2v-8.54L22 3z"

const statusOptions = computed(() => [
  { type: "todo" as TaskStatus, label: i18n.statusTodo, iconPath: ICON_UNCHECK },
  { type: "in_progress" as TaskStatus, label: i18n.statusInProgress, iconPath: ICON_IN_PROGRESS },
  { type: "done" as TaskStatus, label: i18n.statusDone, iconPath: ICON_CHECK },
  { type: "canceled" as TaskStatus, label: i18n.statusCanceled, iconPath: ICON_CANCELED },
  { type: "custom" as TaskStatus, label: i18n.statusCustom, iconPath: ICON_CUSTOM },
])

const normalized = computed(() => normalizeStatusFilter(props.modelValue))

const checkedTypes = computed(() => normalized.value.types)
const checkedCustomMarkers = computed(() => normalized.value.customMarkers)

const isPresetAll = computed(() => checkedTypes.value.size === ALL_TASK_STATUSES.length && !checkedCustomMarkers.value)

const isPresetUnfinished = computed(() => {
  if (checkedTypes.value.size !== UNFINISHED_TASK_STATUSES.length || checkedCustomMarkers.value) {
    return false
  }
  return UNFINISHED_TASK_STATUSES.every((t) => checkedTypes.value.has(t))
})

const isPresetInProgress = computed(() => checkedTypes.value.size === 1 && checkedTypes.value.has("in_progress"))

const isPresetDone = computed(() => checkedTypes.value.size === 1 && checkedTypes.value.has("done"))

const isNonDefault = computed(() => !isPresetAll.value)

function isTypeChecked(type: TaskStatus): boolean {
  return checkedTypes.value.has(type)
}

function isMarkerActive(marker: string): boolean {
  return !checkedCustomMarkers.value || checkedCustomMarkers.value.has(marker)
}

const displayLabel = computed(() => {
  if (isPresetAll.value) {
    return i18n.filterAll
  }
  if (isPresetUnfinished.value) {
    return i18n.presetUnfinished
  }
  if (checkedTypes.value.size === 1) {
    const single = [...checkedTypes.value][0]
    switch (single) {
      case "todo":
        return i18n.statusTodo
      case "in_progress":
        return i18n.statusInProgress
      case "done":
        return i18n.statusDone
      case "canceled":
        return i18n.statusCanceled
      case "custom":
        if (checkedCustomMarkers.value && checkedCustomMarkers.value.size === 1) {
          return `[${[...checkedCustomMarkers.value][0]}]`
        }
        return i18n.statusCustom
    }
  }
  const count = checkedTypes.value.size
  return (i18n.selectedCount || "${n} selected").replace("${n}", String(count))
})

const currentIconPath = computed(() => {
  if (isPresetAll.value) {
    return ICON_FILTER
  }
  if (checkedTypes.value.size === 1) {
    const single = [...checkedTypes.value][0]
    switch (single) {
      case "todo":
        return ICON_UNCHECK
      case "in_progress":
        return ICON_IN_PROGRESS
      case "done":
        return ICON_CHECK
      case "canceled":
        return ICON_CANCELED
      case "custom":
        return ICON_CUSTOM
    }
  }
  return ICON_FILTER
})

function selectPreset(preset: "all" | "unfinished" | "in_progress" | "done") {
  switch (preset) {
    case "all":
      emit("update:modelValue", "all")
      break
    case "unfinished":
      emit("update:modelValue", [...UNFINISHED_TASK_STATUSES])
      break
    case "in_progress":
      emit("update:modelValue", ["in_progress"])
      break
    case "done":
      emit("update:modelValue", ["done"])
      break
  }
}

function toggleType(type: TaskStatus, checked: boolean) {
  const next = new Set(checkedTypes.value)
  if (checked) {
    next.add(type)
  } else {
    next.delete(type)
  }
  // 至少保留选中一项，避免全空无法展示
  if (next.size === 0) {
    next.add(type)
  }

  if (next.size === ALL_TASK_STATUSES.length && !checkedCustomMarkers.value) {
    emit("update:modelValue", "all")
    return
  }

  const res: StatusFilterConfig = {
    types: [...next],
    customMarkers: checkedCustomMarkers.value ? [...checkedCustomMarkers.value] : undefined,
  }
  emit("update:modelValue", res)
}

function toggleCustomMarker(marker: string) {
  const current = checkedCustomMarkers.value
  let next: Set<string> | undefined

  if (!current) {
    // 首次点击特定 tag：只过滤该 marker
    next = new Set([marker])
  } else {
    next = new Set(current)
    if (next.has(marker)) {
      next.delete(marker)
      // 若全删除了，则恢复为全部自定义标记
      if (next.size === 0) {
        next = undefined
      }
    } else {
      next.add(marker)
    }
  }

  const types = new Set(checkedTypes.value)
  types.add("custom")

  const res: StatusFilterConfig = {
    types: [...types],
    customMarkers: next ? [...next] : undefined,
  }
  emit("update:modelValue", res)
}
</script>
