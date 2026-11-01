<template>
  <div class="tl-scope">
    <select
      class="b3-select tl-scope__mode"
      :value="modelValue.mode"
      @change="onModeChange($event as any)"
    >
      <option
        v-for="opt in modeOptions"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.text }}
      </option>
    </select>

    <select
      v-if="modelValue.mode === 'notebook'"
      class="b3-select tl-scope__nb"
      :value="modelValue.box ?? ''"
      @change="onNotebookChange($event as any)"
    >
      <option
        v-for="nb in notebooks"
        :key="nb.id"
        :value="nb.id"
      >
        {{ nb.name }}
      </option>
    </select>

    <button
      v-if="modelValue.mode === 'path'"
      class="b3-button b3-button--outline tl-scope__pick"
      :title="modelValue.hpath || i18n.pickDoc"
      @click="pickerOpen = true"
    >
      <span class="tl-scope__pick-text">{{ modelValue.hpath || i18n.pickDoc }}</span>
    </button>

    <label
      v-if="modelValue.mode === 'path'"
      class="tl-scope__check"
    >
      <input
        type="checkbox"
        :checked="modelValue.includeSubdocs ?? false"
        @change="patch({ includeSubdocs: ($event.target as HTMLInputElement).checked })"
      >
      {{ i18n.includeSubdocs }}
    </label>

    <label
      v-if="showLinked"
      class="tl-scope__check"
    >
      <input
        type="checkbox"
        :checked="modelValue.includeLinked ?? false"
        @change="patch({ includeLinked: ($event.target as HTMLInputElement).checked })"
      >
      {{ i18n.includeLinked }}
    </label>

    <button
      class="b3-button b3-button--icon tl-scope__refresh"
      :title="i18n.refresh"
      @click="emit('refresh')"
    >
      <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
    </button>

    <DocPicker
      v-if="pickerOpen"
      :notebooks="notebooks"
      :selection="modelValue"
      @select="onPick"
      @close="pickerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import DocPicker from "@/components/task-panel/DocPicker.vue"
import type {
  DocEntry,
  ScopeMode,
  ScopeSelection,
} from "@/data/types"
import { usePlugin } from "@/main"

const props = defineProps<{
  modelValue: ScopeSelection
  notebooks: { id: string, name: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScopeSelection]
  refresh: []
}>()

const i18n = usePlugin().i18n

const pickerOpen = ref(false)

const modeOptions = computed(() => [
  { value: "activeDoc" as ScopeMode, text: i18n.scopeActiveDoc || "Current doc" },
  { value: "path" as ScopeMode, text: i18n.scopePath || "Path" },
  { value: "notebook" as ScopeMode, text: i18n.scopeNotebook || "Notebook" },
  { value: "all" as ScopeMode, text: i18n.scopeAll || "All notebooks" },
])

const showLinked = computed(() =>
  props.modelValue.mode === "path" || props.modelValue.mode === "activeDoc",
)

function patch(part: Partial<ScopeSelection>) {
  emit("update:modelValue", { ...props.modelValue, ...part })
}

function onModeChange(event: Event) {
  const mode = (event.target as HTMLSelectElement).value as ScopeMode
  const next: ScopeSelection = {
    mode,
    box: mode === "notebook" || mode === "path" ? props.modelValue.box ?? props.notebooks[0]?.id : undefined,
    includeSubdocs: mode === "path" ? props.modelValue.includeSubdocs ?? false : undefined,
    includeLinked: mode === "path" || mode === "activeDoc" ? props.modelValue.includeLinked ?? false : undefined,
  }
  if (mode === "path") {
    next.docId = props.modelValue.docId
    next.path = props.modelValue.path
    next.hpath = props.modelValue.hpath
  }
  emit("update:modelValue", next)
}

function onNotebookChange(event: Event) {
  patch({ box: (event.target as HTMLSelectElement).value })
}

function onPick(doc: DocEntry) {
  pickerOpen.value = false
  emit("update:modelValue", {
    mode: "path",
    docId: doc.id,
    box: doc.box,
    path: doc.path,
    hpath: doc.hpath,
    includeSubdocs: props.modelValue.includeSubdocs ?? false,
    includeLinked: props.modelValue.includeLinked ?? false,
  })
}
</script>
