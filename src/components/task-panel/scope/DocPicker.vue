<template>
  <div class="tl-scope-pop__sec">
    <select
      class="b3-select tl-scope-pop__select"
      :value="pickBox"
      @change="onPickBoxChange"
    >
      <option
        v-for="nb in notebooks"
        :key="nb.id"
        :value="nb.id"
      >
        {{ nb.name }}
      </option>
    </select>
    <input
      ref="filterRef"
      v-model="docFilter"
      class="b3-text-field tl-scope-pop__filter"
      type="text"
      :placeholder="i18n.filterDocPlaceholder"
      @keydown.down.prevent="moveKb(1)"
      @keydown.up.prevent="moveKb(-1)"
      @keydown.enter.prevent="confirmKb"
    >
    <div class="tl-scope-pop__list">
      <button
        v-for="(doc, i) in visibleDocs"
        :key="doc.id"
        type="button"
        class="tl-doc-item"
        :class="{
          'tl-doc-item--active': doc.id === selectedDocId,
          'tl-doc-item--kb': i === kbIndex,
        }"
        :style="{ paddingLeft: (8 + docDepth(doc) * 14) + 'px' }"
        @click="pickDoc(doc)"
        @mousemove="kbIndex = -1"
      >
        <TlIcon
          :path="FILE_TEXT_PATH"
          class="tl-doc-item__icon"
        />
        <span
          class="tl-doc-item__name"
          v-html="highlight(doc.title)"
        ></span>
        <span
          v-if="docParentOf(doc)"
          class="tl-doc-item__parent"
        >{{ docParentOf(doc) }}</span>
      </button>
      <div
        v-if="visibleDocs.length === 0 && !loadingDocs"
        class="tl-scope-pop__empty"
      >
        {{ i18n.noMatchedDoc }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import { listDocsOfNotebook } from "@/data/scope"
import type { DocEntry } from "@/data/types"
import { highlightText, normalizeKeyword } from "@/utils/text"
import { usePlugin } from "@/main"

const FILE_TEXT_PATH = "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M16 13H8 M16 17H8 M10 9H8"
const VISIBLE_DOC_CAP = 300

const props = defineProps<{
  notebooks: { id: string, name: string }[]
  selectedDocId?: string
  initialBoxId?: string
}>()

const emit = defineEmits<{
  pick: [doc: DocEntry]
  'change-box': [boxId: string]
}>()

const i18n = usePlugin().i18n

const filterRef = ref<HTMLInputElement | null>(null)
const pickBox = ref(props.initialBoxId || props.notebooks[0]?.id || "")
const docFilter = ref("")
const kbIndex = ref(-1)
const docs = ref<DocEntry[]>([])
const loadingDocs = ref(false)

const docsCache = new Map<string, DocEntry[]>()

async function loadDocs() {
  if (!pickBox.value) {
    docs.value = []
    return
  }
  if (docsCache.has(pickBox.value)) {
    docs.value = docsCache.get(pickBox.value)!
    return
  }
  loadingDocs.value = true
  try {
    const loaded = await listDocsOfNotebook(pickBox.value)
    docsCache.set(pickBox.value, loaded)
    docs.value = loaded
  } catch {
    docs.value = []
  } finally {
    loadingDocs.value = false
  }
}

function onPickBoxChange(event: Event) {
  const box = (event.target as HTMLSelectElement).value
  pickBox.value = box
  emit("change-box", box)
}

watch(pickBox, () => {
  kbIndex.value = -1
  loadDocs()
}, { immediate: true })

watch(() => props.initialBoxId, (newBox) => {
  if (newBox && newBox !== pickBox.value) {
    pickBox.value = newBox
  }
})

watch(() => props.notebooks.length, () => {
  if (!pickBox.value) {
    pickBox.value = props.initialBoxId || props.notebooks[0]?.id || ""
  }
})

const filteredDocs = computed(() => {
  const kw = normalizeKeyword(docFilter.value)
  if (!kw) {
    return docs.value
  }
  return docs.value.filter((doc) =>
    doc.title.toLowerCase().includes(kw) || doc.hpath.toLowerCase().includes(kw),
  )
})

const visibleDocs = computed(() => filteredDocs.value.slice(0, VISIBLE_DOC_CAP))

function docDepth(doc: DocEntry): number {
  return Math.max(0, doc.hpath.split("/").filter(Boolean).length - 1)
}

function docParentOf(doc: DocEntry): string {
  const segs = doc.hpath.replace(/^\/+/, "").split("/").filter(Boolean)
  return segs.slice(0, -1).join(" / ")
}

function highlight(text: string): string {
  return highlightText(text, docFilter.value, "")
}

function moveKb(delta: number) {
  if (visibleDocs.value.length === 0) {
    return
  }
  const next = kbIndex.value + delta
  kbIndex.value = Math.max(0, Math.min(next, visibleDocs.value.length - 1))
  nextTick(() => {
    const el = document.querySelector(".tl-doc-item--kb")
    el?.scrollIntoView({ block: "nearest" })
  })
}

function confirmKb() {
  const doc = visibleDocs.value[kbIndex.value]
  if (doc) {
    pickDoc(doc)
  }
}

function pickDoc(doc: DocEntry) {
  emit("pick", doc)
}

function focus() {
  nextTick(() => {
    filterRef.value?.focus()
  })
}

defineExpose({
  focus,
  reload: loadDocs,
})
</script>
