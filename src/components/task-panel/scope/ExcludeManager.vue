<template>
  <div class="tl-scope-pop__sec">
    <div class="tl-scope-pop__label">
      {{ i18n.excludePathsLabel }}
    </div>
    <div
      v-if="displayExcludeList.length"
      class="tl-exclude-list"
    >
      <div
        v-for="item in displayExcludeList"
        :key="item.raw"
        class="tl-exclude-row"
      >
        <span
          class="tl-exclude-row__text"
          :title="item.display"
        >{{ item.display }}</span>
        <button
          type="button"
          class="tl-icon-btn tl-exclude-row__remove ariaLabel"
          :aria-label="i18n.removeExclude"
          @click="removeExclude(item.raw)"
        >
          <TlIcon path="M18 6 6 18M6 6l12 12" />
        </button>
      </div>
    </div>

    <div class="tl-scope-pop__sec tl-exclude-picker">
      <select
        v-if="mode === 'all'"
        class="b3-select tl-scope-pop__select"
        :value="excludePickBox"
        @change="onExcludePickBoxChange"
      >
        <option
          v-for="nb in notebooks"
          :key="nb.id"
          :value="nb.id"
        >
          {{ nb.name }}
        </option>
      </select>
      <div class="tl-exclude-add">
        <input
          ref="excludeFilterRef"
          v-model="excludeDocFilter"
          class="b3-text-field tl-scope-pop__filter"
          type="text"
          :placeholder="i18n.excludePathPlaceholder"
          @keydown.down.prevent="moveExcludeKb(1)"
          @keydown.up.prevent="moveExcludeKb(-1)"
          @keydown.enter.prevent="confirmExcludeKb"
        >
        <button
          type="button"
          class="tl-icon-btn ariaLabel"
          :aria-label="i18n.addExclude"
          @click="confirmExcludeKb"
        >
          <TlIcon path="M12 5v14M5 12h14" />
        </button>
      </div>
      <div
        v-if="visibleExcludeDocs.length > 0 || (excludeDocFilter.trim() && !loadingExcludeDocs)"
        class="tl-scope-pop__list tl-exclude-doc-list"
      >
        <button
          v-for="(doc, i) in visibleExcludeDocs"
          :key="doc.id"
          type="button"
          class="tl-doc-item"
          :class="{
            'tl-doc-item--kb': i === excludeKbIndex,
            'tl-doc-item--excluded': isDocExcluded(doc),
          }"
          :style="{ paddingLeft: (8 + docDepth(doc) * 14) + 'px' }"
          @click="pickExcludeDoc(doc)"
          @mousemove="excludeKbIndex = -1"
        >
          <TlIcon
            :path="FILE_TEXT_PATH"
            class="tl-doc-item__icon"
          />
          <span
            class="tl-doc-item__name"
            v-html="highlightExclude(doc.title)"
          ></span>
          <span
            v-if="docParentOf(doc)"
            class="tl-doc-item__parent"
          >{{ docParentOf(doc) }}</span>
          <span
            v-if="isDocExcluded(doc)"
            class="tl-doc-item__badge"
          >{{ i18n.docAlreadyExcluded || "已排除" }}</span>
        </button>
        <div
          v-if="visibleExcludeDocs.length === 0 && !loadingExcludeDocs"
          class="tl-scope-pop__empty"
        >
          {{ i18n.noMatchedDoc }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import { listDocsOfNotebook, normalizeExcludePaths, parseExcludePath } from "@/data/scope"
import type { DocEntry, ScopeMode } from "@/data/types"
import { highlightText, normalizeKeyword } from "@/utils/text"
import { usePlugin } from "@/main"

const FILE_TEXT_PATH = "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M16 13H8 M16 17H8 M10 9H8"
const VISIBLE_DOC_CAP = 300

const props = defineProps<{
  notebooks: { id: string, name: string }[]
  mode: ScopeMode
  excludePaths?: string[]
  currentBox?: string
}>()

const emit = defineEmits<{
  'update:excludePaths': [paths: string[]]
}>()

const i18n = usePlugin().i18n

const excludeFilterRef = ref<HTMLInputElement | null>(null)
const excludeDocFilter = ref("")
const excludeKbIndex = ref(-1)
const excludePickBox = ref(props.notebooks[0]?.id ?? "")
const excludeDocs = ref<DocEntry[]>([])
const loadingExcludeDocs = ref(false)

const activeExcludeBox = computed(() => {
  if (props.mode === "notebook") {
    return props.currentBox ?? props.notebooks[0]?.id ?? ""
  }
  return excludePickBox.value || props.notebooks[0]?.id || ""
})

const docsCache = new Map<string, DocEntry[]>()

async function loadDocsForBox(boxId: string): Promise<DocEntry[]> {
  if (!boxId) {
    return []
  }
  if (docsCache.has(boxId)) {
    return docsCache.get(boxId)!
  }
  const loaded = await listDocsOfNotebook(boxId)
  docsCache.set(boxId, loaded)
  return loaded
}

async function loadExcludeDocs() {
  const box = activeExcludeBox.value
  if (!box) {
    excludeDocs.value = []
    return
  }
  loadingExcludeDocs.value = true
  try {
    excludeDocs.value = await loadDocsForBox(box)
  } catch {
    excludeDocs.value = []
  } finally {
    loadingExcludeDocs.value = false
  }
}

function onExcludePickBoxChange(event: Event) {
  excludePickBox.value = (event.target as HTMLSelectElement).value
}

watch(activeExcludeBox, () => {
  excludeKbIndex.value = -1
  loadExcludeDocs()
}, { immediate: true })

watch(() => props.notebooks.length, () => {
  if (!excludePickBox.value) {
    excludePickBox.value = props.currentBox ?? props.notebooks[0]?.id ?? ""
  }
})

const displayExcludeList = computed(() => {
  return (props.excludePaths ?? []).map((raw) => {
    const parsed = parseExcludePath(
      raw,
      props.notebooks,
      props.mode === "notebook" ? props.currentBox : undefined,
    )
    return {
      raw,
      display: parsed.displayPath,
    }
  })
})

function removeExclude(path: string) {
  emit(
    "update:excludePaths",
    (props.excludePaths ?? []).filter((p) => p !== path),
  )
}

const filteredExcludeDocs = computed(() => {
  const kw = normalizeKeyword(excludeDocFilter.value)
  if (!kw) {
    return excludeDocs.value
  }
  return excludeDocs.value.filter((doc) =>
    doc.title.toLowerCase().includes(kw) || doc.hpath.toLowerCase().includes(kw),
  )
})

const visibleExcludeDocs = computed(() => filteredExcludeDocs.value.slice(0, VISIBLE_DOC_CAP))

function docDepth(doc: DocEntry): number {
  return Math.max(0, doc.hpath.split("/").filter(Boolean).length - 1)
}

function docParentOf(doc: DocEntry): string {
  const segs = doc.hpath.replace(/^\/+/, "").split("/").filter(Boolean)
  return segs.slice(0, -1).join(" / ")
}

function highlightExclude(text: string): string {
  return highlightText(text, excludeDocFilter.value, "")
}

function isDocExcluded(doc: DocEntry): boolean {
  const nbName = props.notebooks.find((nb) => nb.id === doc.box)?.name || ""
  const fullPath = nbName ? `/${nbName}${doc.hpath}` : doc.hpath
  const current = props.excludePaths ?? []
  return current.includes(fullPath) || current.includes(doc.hpath)
}

function pickExcludeDoc(doc: DocEntry) {
  const nbName = props.notebooks.find((nb) => nb.id === doc.box)?.name || ""
  const fullPath = nbName ? `/${nbName}${doc.hpath}` : doc.hpath
  const current = props.excludePaths ?? []
  if (current.includes(fullPath) || current.includes(doc.hpath)) {
    return
  }
  const merged = normalizeExcludePaths([...current, fullPath])
  emit("update:excludePaths", merged)
  excludeDocFilter.value = ""
}

function moveExcludeKb(delta: number) {
  if (visibleExcludeDocs.value.length === 0) {
    return
  }
  const next = excludeKbIndex.value + delta
  excludeKbIndex.value = Math.max(0, Math.min(next, visibleExcludeDocs.value.length - 1))
}

function confirmExcludeKb() {
  if (excludeKbIndex.value >= 0 && visibleExcludeDocs.value[excludeKbIndex.value]) {
    pickExcludeDoc(visibleExcludeDocs.value[excludeKbIndex.value])
    return
  }
  const raw = excludeDocFilter.value.trim()
  if (!raw) {
    return
  }
  const activeBox = activeExcludeBox.value
  const nbName = props.notebooks.find((nb) => nb.id === activeBox)?.name || ""
  let pathToAdd = raw
  if (nbName && !pathToAdd.startsWith(`/${nbName}/`) && pathToAdd !== `/${nbName}`) {
    pathToAdd = pathToAdd.startsWith("/") ? `/${nbName}${pathToAdd}` : `/${nbName}/${pathToAdd}`
  }
  const merged = normalizeExcludePaths([...(props.excludePaths ?? []), pathToAdd])
  emit("update:excludePaths", merged)
  excludeDocFilter.value = ""
}

defineExpose({
  reload: loadExcludeDocs,
})
</script>
