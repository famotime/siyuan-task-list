<template>
  <div class="tl-scopebar">
    <button
      ref="chipRef"
      type="button"
      class="tl-chip"
      :class="{ 'ariaLabel': modelValue.mode === 'path' && Boolean(modelValue.hpath) }"
      :aria-label="modelValue.mode === 'path' ? modelValue.hpath : undefined"
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
    <button
      v-if="modelValue.mode === 'path' && modelValue.docId"
      type="button"
      class="tl-icon-btn tl-scopebar__fav ariaLabel"
      :class="{ 'tl-scopebar__fav--active': isFavorited }"
      :aria-label="isFavorited ? (i18n.unfavorite || '取消收藏') : (i18n.favorite || '收藏当前路径与筛选条件')"
      @click.stop="emit('toggle-favorite')"
    >
      <TlIcon :path="STAR_PATH" />
    </button>
    <span class="tl-scopebar__spacer"></span>
    <button
      ref="sortBtnRef"
      type="button"
      class="tl-icon-btn ariaLabel"
      :class="{ 'tl-icon-btn--active': sortOpen }"
      :aria-label="i18n.docSort || '文档排序'"
      @click="sortOpen = !sortOpen"
    >
      <TlIcon path="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4" />
    </button>
    <button
      type="button"
      class="tl-icon-btn tl-scopebar__refresh ariaLabel"
      :class="{ 'tl-scopebar__refresh--spinning': loading }"
      :aria-label="i18n.refresh"
      @click="emit('refresh')"
    >
      <TlIcon path="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    </button>

    <TlPopover
      :open="sortOpen"
      :anchor="sortBtnRef"
      :width="180"
      align="right"
      @close="sortOpen = false"
    >
      <div class="tl-sort-menu">
        <button
          v-for="opt in sortOptions"
          :key="opt.value"
          type="button"
          class="tl-sort-menu__item"
          :class="{ 'tl-sort-menu__item--active': (docSort || 'updated-desc') === opt.value }"
          @click="selectSort(opt.value)"
        >
          <span class="tl-sort-menu__text">{{ opt.text }}</span>
          <TlIcon
            v-if="(docSort || 'updated-desc') === opt.value"
            path="M20 6 9 17l-5-5"
            class="tl-sort-menu__check"
          />
        </button>
      </div>
    </TlPopover>

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
            @change="patch({ box: ($event.target as HTMLSelectElement).value })"
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
          <FavoriteList
            :favorites="favorites"
            :match-state="currentMatchState"
            @apply="pickFavorite"
            @remove="emit('remove-favorite', $event)"
          />

          <DocPicker
            ref="docPickerRef"
            :notebooks="notebooks"
            :selected-doc-id="modelValue.docId"
            :initial-box-id="modelValue.box"
            @pick="pickDoc"
            @change-box="patch({ box: $event })"
          />

          <label class="tl-scope-pop__check">
            <input
              type="checkbox"
              :checked="modelValue.includeSubdocs ?? false"
              @change="patch({ includeSubdocs: ($event.target as HTMLInputElement).checked })"
            >
            <span>{{ i18n.includeSubdocs }}</span>
          </label>

          <label class="tl-scope-pop__check">
            <input
              type="checkbox"
              :checked="modelValue.includeLinked ?? false"
              @change="patch({ includeLinked: ($event.target as HTMLInputElement).checked })"
            >
            <span>{{ i18n.includeLinked }}</span>
          </label>

          <div
            v-if="modelValue.docId"
            class="tl-fav-action"
          >
            <button
              type="button"
              class="b3-button tl-fav-action__btn"
              :class="{ 'b3-button--outline': !isFavorited }"
              @click="emit('toggle-favorite')"
            >
              <TlIcon
                :path="STAR_PATH"
                class="tl-fav-action__icon"
                :class="{ 'tl-icon--filled': isFavorited }"
              />
              <span>{{ isFavorited ? (i18n.favActionFavorited || "已收藏当前条件（点击取消）") : (i18n.favorite || "收藏当前路径与筛选条件") }}</span>
            </button>
          </div>
        </template>

        <label
          v-if="modelValue.mode === 'activeDoc' && showLinked"
          class="tl-scope-pop__check"
        >
          <input
            type="checkbox"
            :checked="modelValue.includeLinked ?? false"
            @change="patch({ includeLinked: ($event.target as HTMLInputElement).checked })"
          >
          <span>{{ i18n.includeLinked }}</span>
        </label>

        <ExcludeManager
          v-if="modelValue.mode === 'notebook' || modelValue.mode === 'all'"
          :notebooks="notebooks"
          :mode="modelValue.mode"
          :exclude-paths="modelValue.excludePaths"
          :current-box="modelValue.box"
          @update:exclude-paths="patch({ excludePaths: $event })"
        />
      </div>
    </TlPopover>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import TlIcon from "@/components/_shared/TlIcon.vue"
import TlPopover from "@/components/_shared/TlPopover.vue"
import DocPicker from "@/components/task-panel/scope/DocPicker.vue"
import ExcludeManager from "@/components/task-panel/scope/ExcludeManager.vue"
import FavoriteList from "@/components/task-panel/scope/FavoriteList.vue"
import { sql } from "@/api"
import type {
  DocEntry,
  DocSortMode,
  PathFavorite,
  ScopeMode,
  ScopeSelection,
  StatusFilter,
} from "@/data/types"
import type { FavoriteMatchState } from "@/utils/favorite"
import { usePlugin } from "@/main"

const FILE_TEXT_PATH = "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M16 13H8 M16 17H8 M10 9H8"
const BOOK_PATH = "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"
const FILES_PATH = "M20 7h-3a2 2 0 0 1-2-2V2 M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l5 5v9a2 2 0 0 1-2 2Z M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"
const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"

const props = defineProps<{
  modelValue: ScopeSelection
  notebooks: { id: string, name: string }[]
  resolvedDocId?: string
  favorites?: PathFavorite[]
  isFavorited?: boolean
  statusFilter?: StatusFilter
  showHeadings?: boolean
  headingLevels?: number[]
  docSort?: DocSortMode
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScopeSelection]
  'update:docSort': [value: DocSortMode]
  refresh: []
  'toggle-favorite': []
  'apply-favorite': [fav: PathFavorite]
  'remove-favorite': [id: string]
}>()

const i18n = usePlugin().i18n

const popoverOpen = ref(false)
const sortOpen = ref(false)
const chipRef = ref<HTMLElement | null>(null)
const sortBtnRef = ref<HTMLElement | null>(null)
const docPickerRef = ref<InstanceType<typeof DocPicker> | null>(null)

const sortOptions = computed(() => [
  { value: "updated-desc" as const, text: i18n.sortUpdatedDesc || "更新时间：最新在前" },
  { value: "updated-asc" as const, text: i18n.sortUpdatedAsc || "更新时间：最早在前" },
  { value: "created-desc" as const, text: i18n.sortCreatedDesc || "创建时间：最新在前" },
  { value: "created-asc" as const, text: i18n.sortCreatedAsc || "创建时间：最早在前" },
  { value: "title-asc" as const, text: i18n.sortTitleAsc || "文件名：正序 (A→Z)" },
  { value: "title-desc" as const, text: i18n.sortTitleDesc || "文件名：倒序 (Z→A)" },
])

function selectSort(mode: DocSortMode) {
  emit("update:docSort", mode)
  sortOpen.value = false
}

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

const currentMatchState = computed<FavoriteMatchState>(() => ({
  docId: props.modelValue.docId,
  includeSubdocs: props.modelValue.includeSubdocs,
  includeLinked: props.modelValue.includeLinked,
  status: props.statusFilter,
  showHeadings: props.showHeadings,
  headingLevels: props.headingLevels,
}))

function patch(part: Partial<ScopeSelection>) {
  emit("update:modelValue", { ...props.modelValue, ...part })
}

function onModeChange(mode: ScopeMode) {
  const next: ScopeSelection = {
    mode,
    box: mode === "notebook" || mode === "path" ? props.modelValue.box ?? props.notebooks[0]?.id : undefined,
    includeSubdocs: mode === "path" ? props.modelValue.includeSubdocs ?? false : undefined,
    includeLinked: mode === "path" || mode === "activeDoc" ? props.modelValue.includeLinked ?? false : undefined,
    excludePaths: props.modelValue.excludePaths,
  }
  if (mode === "path") {
    next.docId = props.modelValue.docId
    next.path = props.modelValue.path
    next.hpath = props.modelValue.hpath
  }
  emit("update:modelValue", next)
}

watch(popoverOpen, async (open) => {
  if (open && props.modelValue.mode === "path") {
    await nextTick()
    docPickerRef.value?.focus()
  }
})

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

function pickFavorite(fav: PathFavorite) {
  popoverOpen.value = false
  emit("apply-favorite", fav)
}
</script>
