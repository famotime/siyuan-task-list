<template>
  <div class="tl-scope-pop__sec tl-fav-sec">
    <div class="tl-scope-pop__label tl-fav-label">
      <span>{{ i18n.favoritesTitle || "常用收藏" }}</span>
      <span class="tl-fav-count">{{ favorites?.length || 0 }}/10</span>
    </div>
    <div
      v-if="favorites && favorites.length > 0"
      class="tl-fav-list"
    >
      <div
        v-for="fav in favorites"
        :key="fav.id"
        class="tl-fav-item"
        :class="{ 'tl-fav-item--active': isItemActive(fav) }"
      >
        <div
          class="tl-fav-item__main"
          @click="emit('apply', fav)"
        >
          <div
            class="tl-fav-item__title"
            :class="{ 'ariaLabel': Boolean(fav.hpath) }"
            :aria-label="fav.hpath"
            :title="fav.hpath"
          >
            {{ fav.title || hpathLeaf(fav.hpath) }}
          </div>
          <div class="tl-fav-item__tags">
            <span class="tl-fav-tag tl-fav-tag--status">
              {{ statusTagText(fav.status) }}
            </span>
            <span
              v-if="fav.includeSubdocs"
              class="tl-fav-tag"
            >
              {{ i18n.suffixSub || "＋子" }}
            </span>
            <span
              v-if="fav.includeLinked"
              class="tl-fav-tag"
            >
              {{ i18n.suffixLinked || "＋链" }}
            </span>
            <span
              v-if="!fav.showHeadings"
              class="tl-fav-tag"
            >
              {{ i18n.noHeadingsTag || "平铺" }}
            </span>
            <span
              v-else-if="fav.headingLevels && fav.headingLevels.length < 6"
              class="tl-fav-tag"
            >
              H{{ fav.headingLevels.join(',') }}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="tl-icon-btn tl-fav-item__del ariaLabel"
          :aria-label="i18n.removeFavorite || '删除该收藏'"
          @click.stop.prevent="emit('remove', fav.id)"
          @pointerdown.stop
          @mousedown.stop
        >
          <TlIcon path="M18 6 6 18M6 6l12 12" />
        </button>
      </div>
    </div>
    <div
      v-else
      class="tl-fav-empty"
    >
      {{ i18n.noFavoritesHint || "暂无收藏，选中文档后点击下方按钮可收藏" }}
    </div>
  </div>
</template>

<script setup lang="ts">
import TlIcon from "@/components/_shared/TlIcon.vue"
import type { PathFavorite, StatusFilter } from "@/data/types"
import { formatStatusFilterLabel } from "@/data/status"
import { type FavoriteMatchState, isFavoriteMatching } from "@/utils/favorite"
import { usePlugin } from "@/main"

const props = defineProps<{
  favorites?: PathFavorite[]
  matchState: FavoriteMatchState
}>()

const emit = defineEmits<{
  apply: [fav: PathFavorite]
  remove: [id: string]
}>()

const i18n = usePlugin().i18n

function hpathLeaf(hpath?: string): string {
  return (hpath || "").replace(/^\/+/, "").split("/").filter(Boolean).pop() ?? ""
}

function isItemActive(fav: PathFavorite): boolean {
  return isFavoriteMatching(fav, props.matchState)
}

function statusTagText(status?: StatusFilter): string {
  return formatStatusFilterLabel(status, i18n)
}
</script>
