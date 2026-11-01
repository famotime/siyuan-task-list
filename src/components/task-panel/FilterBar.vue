<template>
  <div class="tl-filter">
    <div class="tl-segments">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="tl-segment"
        :class="{ 'tl-segment--active': status === opt.value }"
        @click="emit('update:status', opt.value)"
      >
        {{ opt.text }}
      </button>
    </div>
    <input
      class="b3-text-field tl-search"
      :value="keyword"
      :placeholder="i18n.searchPlaceholder"
      @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
    >
    <button
      ref="levelsRef"
      type="button"
      class="tl-icon-btn tl-filter__levels ariaLabel"
      :class="{ 'tl-icon-btn--active': levelsNonDefault }"
      :aria-label="i18n.levelsLabel"
      @click="levelsOpen = !levelsOpen"
    >
      <TlIcon path="M4 5h16M8 12h12M12 19h8" />
    </button>

    <TlPopover
      :open="levelsOpen"
      :anchor="levelsRef"
      :width="220"
      align="right"
      @close="levelsOpen = false"
    >
      <div class="tl-levels">
        <label class="tl-levels__row">
          <input
            type="checkbox"
            :checked="showHeadings"
            @change="emit('update:showHeadings', ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ i18n.headingsShow }}</span>
        </label>
        <div
          v-if="showHeadings"
          class="tl-levels__grid"
        >
          <label
            v-for="lvl in 6"
            :key="lvl"
            class="tl-levels__opt"
          >
            <input
              type="checkbox"
              :checked="headingLevels.includes(lvl)"
              @change="toggleLevel(lvl, ($event.target as HTMLInputElement).checked)"
            >
            <span>H{{ lvl }}</span>
          </label>
        </div>
        <button
          type="button"
          class="tl-levels__reset"
          @click="resetLevels"
        >
          {{ i18n.resetDefault }}
        </button>
      </div>
    </TlPopover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import TlPopover from "@/components/_shared/TlPopover.vue"
import type { StatusFilter } from "@/data/tasks"
import { usePlugin } from "@/main"

const props = defineProps<{
  status: StatusFilter
  keyword: string
  showHeadings: boolean
  headingLevels: number[]
}>()

const emit = defineEmits<{
  'update:status': [value: StatusFilter]
  'update:keyword': [value: string]
  'update:showHeadings': [value: boolean]
  'update:headingLevels': [value: number[]]
}>()

const i18n = usePlugin().i18n

const levelsRef = ref<HTMLElement | null>(null)
const levelsOpen = ref(false)

const options = computed(() => [
  { value: "all" as StatusFilter, text: i18n.filterAll || "All" },
  { value: "todo" as StatusFilter, text: i18n.filterTodo || "Open" },
  { value: "done" as StatusFilter, text: i18n.filterDone || "Done" },
])

const levelsNonDefault = computed(() =>
  !props.showHeadings || props.headingLevels.length < 6,
)

function toggleLevel(level: number, on: boolean) {
  const next = on
    ? [...new Set([...props.headingLevels, level])].sort((a, b) => a - b)
    : props.headingLevels.filter((lvl) => lvl !== level)
  emit('update:headingLevels', next)
}

function resetLevels() {
  emit('update:showHeadings', true)
  emit('update:headingLevels', [1, 2, 3, 4, 5, 6])
}
</script>
