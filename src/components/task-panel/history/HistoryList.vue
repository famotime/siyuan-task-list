<template>
  <div class="tl-history-panel">
    <div class="tl-history-header">
      <div class="tl-history-header__title">
        <span>{{ i18n.historyTitle || "操作历史" }}</span>
        <span
          v-if="items.length > 0"
          class="tl-history-header__count"
        >{{ items.length }}</span>
      </div>

      <div class="tl-history-header__actions">
        <template v-if="items.length > 0">
          <div
            v-if="confirmingClear"
            class="tl-history-header__confirm"
          >
            <span class="tl-history-header__confirm-tip">{{ i18n.clearHistoryConfirm || "确定清空？" }}</span>
            <button
              type="button"
              class="tl-btn tl-btn--danger tl-btn--mini"
              @click="onClearConfirm"
            >
              {{ i18n.presetDone || "确定" }}
            </button>
            <button
              type="button"
              class="tl-btn tl-btn--secondary tl-btn--mini"
              @click="confirmingClear = false"
            >
              取消
            </button>
          </div>
          <button
            v-else
            type="button"
            class="tl-icon-btn tl-history-clear-btn ariaLabel"
            :aria-label="i18n.clearHistory || '清空历史'"
            @click="confirmingClear = true"
          >
            <TlIcon path="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </button>
        </template>
      </div>
    </div>

    <div
      v-if="items.length === 0"
      class="tl-history-empty"
    >
      {{ i18n.emptyHistory || "暂无操作历史" }}
    </div>

    <div
      v-else
      class="tl-history-list"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="tl-history-item"
        :class="{ 'tl-history-item--undone': item.undone }"
      >
        <div
          class="tl-history-item__main"
          @click="emit('jump', item)"
        >
          <div class="tl-history-item__meta">
            <span
              v-if="item.docTitle"
              class="tl-history-item__doc"
              :title="item.docTitle"
            >
              {{ leafDocTitle(item.docTitle) }}
            </span>
            <span
              v-if="item.docTitle"
              class="tl-history-item__dot"
            >·</span>
            <span class="tl-history-item__time">
              {{ formatRelativeTime(item.timestamp, nowTime, i18n) }}
            </span>
          </div>

          <div class="tl-history-item__content-row">
            <div class="tl-history-item__status">
              <span
                class="tl-history-badge"
                :class="'tl-history-badge--' + item.fromStatus"
              >
                {{ getStatusText(item.fromStatus, item.fromMarker, i18n) }}
              </span>
              <span class="tl-history-arrow">➜</span>
              <span
                class="tl-history-badge"
                :class="'tl-history-badge--' + item.toStatus"
              >
                {{ getStatusText(item.toStatus, item.toMarker, i18n) }}
              </span>
            </div>
            <div
              class="tl-history-item__text"
              :title="item.content"
            >
              {{ item.content }}
            </div>
          </div>
        </div>

        <div class="tl-history-item__action">
          <span
            v-if="item.undone"
            class="tl-history-undone-tag"
          >
            {{ i18n.undone || "已撤销" }}
          </span>
          <button
            v-else
            type="button"
            class="tl-icon-btn tl-history-undo-btn ariaLabel"
            :aria-label="i18n.undo || '撤销还原'"
            @click.stop="emit('undo', item)"
          >
            <TlIcon path="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import { formatRelativeTime, getStatusText } from "@/data/history"
import type { TaskHistoryItem } from "@/data/types"
import { usePlugin } from "@/main"

const props = defineProps<{
  items: TaskHistoryItem[]
}>()

const emit = defineEmits<{
  jump: [item: TaskHistoryItem]
  undo: [item: TaskHistoryItem]
  clear: []
}>()

const i18n = usePlugin().i18n
const confirmingClear = ref(false)
const nowTime = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowTime.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

function onClearConfirm() {
  confirmingClear.value = false
  emit("clear")
}

function leafDocTitle(pathOrTitle?: string): string {
  if (!pathOrTitle) {
    return ""
  }
  return pathOrTitle.replace(/^\/+/, "").split("/").filter(Boolean).pop() ?? pathOrTitle
}
</script>
