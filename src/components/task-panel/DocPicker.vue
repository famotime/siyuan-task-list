<template>
  <Teleport to="body">
    <div
      class="tl-picker-mask"
      @click.self="emit('close')"
    >
      <div class="tl-picker">
        <div class="tl-picker__head">
          <span>{{ i18n.pickerTitle }}</span>
          <button
            class="b3-button b3-button--icon tl-picker__close"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <select
          class="b3-select tl-picker__nb"
          :value="box"
          @change="onBoxChange($event as any)"
        >
          <option
            v-for="nb in notebooks"
            :key="nb.id"
            :value="nb.id"
          >
            {{ nb.name }}
          </option>
        </select>
        <div class="tl-picker__list">
          <div
            v-for="doc in docs"
            :key="doc.id"
            class="tl-picker__item"
            :class="{ 'tl-picker__item--active': doc.id === selection?.docId }"
            :style="{ paddingLeft: 8 + depth(doc) * 14 + 'px' }"
            :title="doc.hpath"
            @click="emit('select', doc)"
          >
            {{ doc.title }}
          </div>
          <div
            v-if="docs.length === 0 && !loadingDocs"
            class="tl-picker__empty"
          >
            {{ i18n.empty }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import { listDocsOfNotebook } from "@/data/scope"
import type {
  DocEntry,
  ScopeSelection,
} from "@/data/types"
import { usePlugin } from "@/main"

const props = defineProps<{
  notebooks: { id: string, name: string }[]
  selection: ScopeSelection
}>()

const emit = defineEmits<{
  select: [doc: DocEntry]
  close: []
}>()

const i18n = usePlugin().i18n

const box = ref(props.selection.box ?? props.notebooks[0]?.id ?? "")
const docs = ref<DocEntry[]>([])
const loadingDocs = ref(false)

async function loadDocs() {
  if (!box.value) {
    docs.value = []
    return
  }
  loadingDocs.value = true
  try {
    docs.value = await listDocsOfNotebook(box.value)
  } catch {
    docs.value = []
  } finally {
    loadingDocs.value = false
  }
}

function onBoxChange(event: Event) {
  box.value = (event.target as HTMLSelectElement).value
}

function depth(doc: DocEntry): number {
  return Math.max(0, doc.hpath.split("/").filter(Boolean).length - 1)
}

onMounted(loadDocs)
watch(box, loadDocs)
</script>
