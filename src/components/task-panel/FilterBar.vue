<template>
  <div class="tl-filter">
    <div class="tl-segments">
      <button
        v-for="opt in options"
        :key="opt.value"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { StatusFilter } from "@/data/tasks"
import { usePlugin } from "@/main"

defineProps<{
  status: StatusFilter
  keyword: string
}>()

const emit = defineEmits<{
  'update:status': [value: StatusFilter]
  'update:keyword': [value: string]
}>()

const i18n = usePlugin().i18n

const options = computed(() => [
  { value: "all" as StatusFilter, text: i18n.filterAll || "All" },
  { value: "todo" as StatusFilter, text: i18n.filterTodo || "Open" },
  { value: "done" as StatusFilter, text: i18n.filterDone || "Done" },
])
</script>
