<template>
  <TlPopover
    :open="open"
    :anchor="anchor"
    :width="160"
    align="left"
    @close="emit('close')"
  >
    <div class="tl-menu">
      <button
        v-for="item in menuItems"
        :key="item.id"
        type="button"
        class="tl-menu__item"
        :class="{ 'tl-menu__item--active': item.active }"
        @click="onSelect(item.marker)"
      >
        <span class="tl-menu__icon">
          <TlIcon :path="item.iconPath" />
        </span>
        <span class="tl-menu__label">{{ item.label }}</span>
        <TlIcon
          v-if="item.active"
          path="M20 6 9 17l-5-5"
          class="tl-menu__check"
        />
      </button>

      <div class="tl-menu__divider" />

      <button
        type="button"
        class="tl-menu__item"
        :class="{ 'tl-menu__item--active': isCustomActive }"
        @click="emit('selectCustom')"
      >
        <span class="tl-menu__icon">
          <TlIcon path="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </span>
        <span class="tl-menu__label">{{ i18n.statusCustom }}</span>
        <span
          v-if="isCustomActive && currentMarker"
          class="tl-menu__badge"
        >[{{ currentMarker }}]</span>
        <TlIcon
          v-if="isCustomActive"
          path="M20 6 9 17l-5-5"
          class="tl-menu__check"
        />
      </button>
    </div>
  </TlPopover>
</template>

<script setup lang="ts">
import { computed } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import TlPopover from "@/components/_shared/TlPopover.vue"
import type { TaskStatus } from "@/data/types"
import { usePlugin } from "@/main"

const props = defineProps<{
  open: boolean
  anchor: HTMLElement | null
  status: TaskStatus
  currentMarker: string
}>()

const emit = defineEmits<{
  select: [marker: string]
  selectCustom: []
  close: []
}>()

const i18n = usePlugin().i18n

const ICON_UNCHECK = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
const ICON_IN_PROGRESS = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 15l6-6"
const ICON_CHECK = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 12l2 2 4-4"
const ICON_CANCELED = "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 12h8"

const menuItems = computed(() => [
  {
    id: "todo",
    marker: " ",
    label: i18n.statusTodo,
    iconPath: ICON_UNCHECK,
    active: props.status === "todo",
  },
  {
    id: "in_progress",
    marker: "/",
    label: i18n.statusInProgress,
    iconPath: ICON_IN_PROGRESS,
    active: props.status === "in_progress",
  },
  {
    id: "done",
    marker: "x",
    label: i18n.statusDone,
    iconPath: ICON_CHECK,
    active: props.status === "done",
  },
  {
    id: "canceled",
    marker: "-",
    label: i18n.statusCanceled,
    iconPath: ICON_CANCELED,
    active: props.status === "canceled",
  },
])

const isCustomActive = computed(() => props.status === "custom")

function onSelect(marker: string) {
  emit("select", marker)
  emit("close")
}
</script>
