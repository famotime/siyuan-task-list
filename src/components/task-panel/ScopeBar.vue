<template>
  <div class="tl-scopebar">
    <button
      ref="chipRef"
      type="button"
      class="tl-chip"
      @click="popoverOpen = !popoverOpen"
    >
      <TlIcon
        :path="chipIcon"
        class="tl-chip__icon"
      />
      <span class="tl-chip__main">{{ chipMain }}</span>
      <span
        v-if="chipSuffix"
        class="tl-chip__sub"
      >{{ chipSuffix }}</span>
      <TlIcon
        path="m6 9 6 6 6-6"
        class="tl-chip__caret"
        :class="{ 'tl-chip__caret--open': popoverOpen }"
      />
    </button>
    <span class="tl-scopebar__spacer"></span>
    <button
      type="button"
      class="tl-icon-btn ariaLabel"
      :aria-label="i18n.refresh"
      @click="emit('refresh')"
    >
      <TlIcon path="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </button>

    <TlPopover
      :open="popoverOpen"
      :anchor="chipRef"
      :width="300"
      @close="popoverOpen = false"
    >
      <div class="tl-scope-pop">
        <div class="tl-scope-pop__label">
          {{ i18n.scopeModeLabel }}
        </div>
        <div class="tl-scope-pop__modes">
          <label
            v-for="opt in modeOptions"
            :key="opt.value"
            class="tl-scope-pop__radio"
          >
            <input
              type="radio"
              name="tl-scope-mode"
              :value="opt.value"
              :checked="modelValue.mode === opt.value"
              @change="onModeChange(opt.value)"
            >
            <span>{{ opt.text }}</span>
          </label>
        </div>

        <div
          v-if="modelValue.mode === 'notebook'"
          class="tl-scope-pop__sec"
        >
          <select
            class="b3-select tl-scope-pop__select"
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
        </div>

        <template v-if="modelValue.mode === 'path'">
          <div class="tl-scope-pop__sec">
            <select
              class="b3-select tl-scope-pop__select"
              :value="pickBox"
              @change="onPickBoxChange($event as any)"
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
                  'tl-doc-item--active': doc.id === modelValue.docId,
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

        <label
          v-if="modelValue.mode === 'path'"
          class="tl-scope-pop__check"
        >
          <input
            type="checkbox"
            :checked="modelValue.includeSubdocs ?? false"
            @change="patch({ includeSubdocs: ($event.target as HTMLInputElement).checked })"
          >
          <span>{{ i18n.includeSubdocs }}</span>
        </label>
        <label
          v-if="showLinked"
          class="tl-scope-pop__check"
        >
          <input
            type="checkbox"
            :checked="modelValue.includeLinked ?? false"
            @change="patch({ includeLinked: ($event.target as HTMLInputElement).checked })"
          >
          <span>{{ i18n.includeLinked }}</span>
        </label>

        <div
          v-if="modelValue.mode === 'notebook' || modelValue.mode === 'all'"
          class="tl-scope-pop__sec"
        >
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
              v-if="modelValue.mode === 'all'"
              class="b3-select tl-scope-pop__select"
              :value="excludePickBox"
              @change="onExcludePickBoxChange($event as any)"
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
      </div>
    </TlPopover>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import TlPopover from "@/components/_shared/TlPopover.vue"
import { sql } from "@/api"
import { listDocsOfNotebook, normalizeExcludePaths, parseExcludePath } from "@/data/scope"
import type {
  DocEntry,
  ScopeMode,
  ScopeSelection,
} from "@/data/types"
import { usePlugin } from "@/main"

const FILE_TEXT_PATH = "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M16 13H8 M16 17H8 M10 9H8"
const BOOK_PATH = "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
const FILES_PATH = "M20 7h-3a2 2 0 0 1-2-2V2 M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l5 5v9a2 2 0 0 1-2 2Z M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"

const props = defineProps<{
  modelValue: ScopeSelection
  notebooks: { id: string, name: string }[]
  /** activeDoc 档在查询时解析出的文档 id（用于摘要名回显） */
  resolvedDocId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScopeSelection]
  refresh: []
}>()

const i18n = usePlugin().i18n

const popoverOpen = ref(false)
const chipRef = ref<HTMLElement | null>(null)
const filterRef = ref<HTMLInputElement | null>(null)

// ---------- 摘要 chip ----------

const activeDocName = ref("")

watch(() => props.resolvedDocId, async (id) => {
  if (props.modelValue.mode !== "activeDoc" || !id) {
    activeDocName.value = ""
    return
  }
  try {
    const rows = await sql(`SELECT content FROM blocks WHERE id='${id.replace(/'/g, "''")}' AND type='d' LIMIT 1`)
    activeDocName.value = rows?.[0]?.content || ""
  } catch {
    activeDocName.value = ""
  }
}, { immediate: true })

function hpathLeaf(hpath?: string): string {
  return (hpath || "").replace(/^\/+/, "").split("/").filter(Boolean).pop() ?? ""
}

const chipMain = computed(() => {
  switch (props.modelValue.mode) {
    case "activeDoc":
      return activeDocName.value || i18n.scopeActiveDoc
    case "path":
      return hpathLeaf(props.modelValue.hpath) || i18n.pickDoc
    case "notebook":
      return props.notebooks.find((nb) => nb.id === props.modelValue.box)?.name || i18n.scopeNotebook
    default:
      return i18n.scopeAll
  }
})

const chipSuffix = computed(() => {
  const parts: string[] = []
  if (props.modelValue.mode === "path" && props.modelValue.includeSubdocs) {
    parts.push(i18n.suffixSub || "＋子")
  }
  if (showLinked.value && props.modelValue.includeLinked) {
    parts.push(i18n.suffixLinked || "＋链")
  }
  return parts.join(" ")
})

const chipIcon = computed(() => {
  switch (props.modelValue.mode) {
    case "notebook":
      return BOOK_PATH
    case "all":
      return FILES_PATH
    default:
      return FILE_TEXT_PATH
  }
})

// ---------- 范围浮层 ----------

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

function onModeChange(mode: ScopeMode) {
  const next: ScopeSelection = {
    mode,
    box: mode === "notebook" || mode === "path" ? props.modelValue.box ?? props.notebooks[0]?.id : undefined,
    includeSubdocs: mode === "path" ? props.modelValue.includeSubdocs ?? false : undefined,
    includeLinked: mode === "path" || mode === "activeDoc" ? props.modelValue.includeLinked ?? false : undefined,
    // 排除路径跨模式保留，切回 notebook/all 时无需重填
    excludePaths: props.modelValue.excludePaths,
  }
  if (mode === "path") {
    next.docId = props.modelValue.docId
    next.path = props.modelValue.path
    next.hpath = props.modelValue.hpath
  }
  emit("update:modelValue", next)
}

// ---------- 排除路径（notebook / all 档） ----------

const excludeFilterRef = ref<HTMLInputElement | null>(null)
const excludeDocFilter = ref("")
const excludeKbIndex = ref(-1)
const excludePickBox = ref(props.notebooks[0]?.id ?? "")
const excludeDocs = ref<DocEntry[]>([])
const loadingExcludeDocs = ref(false)

const activeExcludeBox = computed(() => {
  if (props.modelValue.mode === "notebook") {
    return props.modelValue.box ?? props.notebooks[0]?.id ?? ""
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
  if (popoverOpen.value && (props.modelValue.mode === "notebook" || props.modelValue.mode === "all")) {
    loadExcludeDocs()
  }
})

watch(
  [popoverOpen, () => props.modelValue.mode],
  ([open, mode]) => {
    if (open && (mode === "notebook" || mode === "all")) {
      if (!excludePickBox.value) {
        excludePickBox.value = props.modelValue.box ?? props.notebooks[0]?.id ?? ""
      }
      loadExcludeDocs()
    }
  },
  { immediate: true },
)

const displayExcludeList = computed(() => {
  return (props.modelValue.excludePaths ?? []).map((raw) => {
    const parsed = parseExcludePath(
      raw,
      props.notebooks,
      props.modelValue.mode === "notebook" ? props.modelValue.box : undefined,
    )
    return {
      raw,
      display: parsed.displayPath,
    }
  })
})

function removeExclude(path: string) {
  patch({ excludePaths: (props.modelValue.excludePaths ?? []).filter((p) => p !== path) })
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

function highlightExclude(text: string): string {
  const kw = normalizeKeyword(excludeDocFilter.value)
  const safe = escapeHtml(text)
  if (!kw) {
    return safe
  }
  const idx = text.toLowerCase().indexOf(kw)
  if (idx < 0) {
    return safe
  }
  const before = escapeHtml(text.slice(0, idx))
  const hit = escapeHtml(text.slice(idx, idx + kw.length))
  const after = escapeHtml(text.slice(idx + kw.length))
  return `${before}<mark>${hit}</mark>${after}`
}

function isDocExcluded(doc: DocEntry): boolean {
  const nbName = props.notebooks.find((nb) => nb.id === doc.box)?.name || ""
  const fullPath = nbName ? `/${nbName}${doc.hpath}` : doc.hpath
  const current = props.modelValue.excludePaths ?? []
  return current.includes(fullPath) || current.includes(doc.hpath)
}

function pickExcludeDoc(doc: DocEntry) {
  const nbName = props.notebooks.find((nb) => nb.id === doc.box)?.name || ""
  const fullPath = nbName ? `/${nbName}${doc.hpath}` : doc.hpath
  const current = props.modelValue.excludePaths ?? []
  if (current.includes(fullPath) || current.includes(doc.hpath)) {
    return
  }
  const merged = normalizeExcludePaths([...current, fullPath])
  patch({ excludePaths: merged })
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
  const merged = normalizeExcludePaths([...(props.modelValue.excludePaths ?? []), pathToAdd])
  patch({ excludePaths: merged })
  excludeDocFilter.value = ""
}

function onNotebookChange(event: Event) {
  patch({ box: (event.target as HTMLSelectElement).value })
}

// ---------- 文档选择（path 档，内嵌于浮层） ----------

const pickBox = ref(props.modelValue.box ?? props.notebooks[0]?.id ?? "")
const docs = ref<DocEntry[]>([])
const loadingDocs = ref(false)
const docFilter = ref("")
const kbIndex = ref(-1)

async function loadDocs() {
  if (!pickBox.value) {
    docs.value = []
    return
  }
  loadingDocs.value = true
  try {
    docs.value = await loadDocsForBox(pickBox.value)
  } catch {
    docs.value = []
  } finally {
    loadingDocs.value = false
  }
}

function onPickBoxChange(event: Event) {
  pickBox.value = (event.target as HTMLSelectElement).value
}

watch(pickBox, () => {
  kbIndex.value = -1
  loadDocs()
})

// notebooks 由 App 异步加载，到达后补齐初始 pickBox 与 excludePickBox
watch(() => props.notebooks.length, () => {
  if (!pickBox.value) {
    pickBox.value = props.modelValue.box ?? props.notebooks[0]?.id ?? ""
  }
  if (!excludePickBox.value) {
    excludePickBox.value = props.modelValue.box ?? props.notebooks[0]?.id ?? ""
  }
})

// 浮层已开时切换到 path 档（含初始化）也要确保文档列表就绪
watch(() => props.modelValue.mode, (mode) => {
  if (popoverOpen.value && mode === "path") {
    pickBox.value = props.modelValue.box ?? (pickBox.value || props.notebooks[0]?.id || "")
    if (docs.value.length === 0) {
      loadDocs()
    }
  }
})

watch(popoverOpen, async (open) => {
  if (!open) {
    return
  }
  if (props.modelValue.mode === "path") {
    pickBox.value = props.modelValue.box ?? (pickBox.value || props.notebooks[0]?.id || "")
    if (docs.value.length === 0) {
      loadDocs()
    }
    await nextTick()
    filterRef.value?.focus()
  } else if (props.modelValue.mode === "notebook" || props.modelValue.mode === "all") {
    loadExcludeDocs()
  }
})

/** 直接用关键词搜索过滤（支持大小写不敏感匹配） */
function normalizeKeyword(input: string): string {
  return (input ?? "").trim().toLowerCase()
}

const filteredDocs = computed(() => {
  const kw = normalizeKeyword(docFilter.value)
  if (!kw) {
    return docs.value
  }
  return docs.value.filter((doc) =>
    doc.title.toLowerCase().includes(kw) || doc.hpath.toLowerCase().includes(kw),
  )
})

const VISIBLE_DOC_CAP = 300

const visibleDocs = computed(() => filteredDocs.value.slice(0, VISIBLE_DOC_CAP))

function docDepth(doc: DocEntry): number {
  return Math.max(0, doc.hpath.split("/").filter(Boolean).length - 1)
}

function docParentOf(doc: DocEntry): string {
  const segs = doc.hpath.replace(/^\/+/, "").split("/").filter(Boolean)
  return segs.slice(0, -1).join(" / ")
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 命中关键字高亮（首处），其余按纯文本转义 */
function highlight(text: string): string {
  const kw = normalizeKeyword(docFilter.value)
  const safe = escapeHtml(text)
  if (!kw) {
    return safe
  }
  const idx = text.toLowerCase().indexOf(kw)
  if (idx < 0) {
    return safe
  }
  const before = escapeHtml(text.slice(0, idx))
  const hit = escapeHtml(text.slice(idx, idx + kw.length))
  const after = escapeHtml(text.slice(idx + kw.length))
  return `${before}<mark>${hit}</mark>${after}`
}

function moveKb(delta: number) {
  if (visibleDocs.value.length === 0) {
    return
  }
  const next = kbIndex.value + delta
  kbIndex.value = Math.max(0, Math.min(next, visibleDocs.value.length - 1))
  scrollKbIntoView()
}

function confirmKb() {
  const doc = visibleDocs.value[kbIndex.value]
  if (doc) {
    pickDoc(doc)
  }
}

function scrollKbIntoView() {
  nextTick(() => {
    const el = document.querySelector(".tl-doc-item--kb")
    el?.scrollIntoView({ block: "nearest" })
  })
}

function pickDoc(doc: DocEntry) {
  popoverOpen.value = false
  emit("update:modelValue", {
    mode: "path",
    docId: doc.id,
    box: doc.box,
    path: doc.path,
    hpath: doc.hpath,
    includeSubdocs: props.modelValue.includeSubdocs ?? false,
    includeLinked: props.modelValue.includeLinked ?? false,
    excludePaths: props.modelValue.excludePaths,
  })
}
</script>
