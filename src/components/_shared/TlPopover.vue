<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="popRef"
      class="tl-pop"
      :style="popStyle"
    >
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue"

/**
 * 轻量锚定浮层：Teleport 到 body（dock 面板 overflow 会裁剪浮层），
 * 锚元素下方展开，空间不足自动上翻，越界收敛到视口内。
 * 关闭路径：点击外部（capture 捕获，早于面板内交互）、Esc、窗口尺寸变化重定位。
 */
const props = withDefaults(defineProps<{
  open: boolean
  anchor: HTMLElement | null
  width?: number
  align?: "left" | "right"
}>(), { width: 280, align: "left" })

const emit = defineEmits<{ close: [] }>()

const popRef = ref<HTMLElement | null>(null)
const popStyle = ref<Record<string, string>>({})

function place() {
  const el = popRef.value
  const anchor = props.anchor
  if (!el || !anchor) {
    return
  }
  const rect = anchor.getBoundingClientRect()
  let left = props.align === "right" ? rect.right - props.width : rect.left
  left = Math.max(8, Math.min(left, window.innerWidth - props.width - 8))
  let top = rect.bottom + 6
  if (top + el.offsetHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - el.offsetHeight - 6)
  }
  popStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${props.width}px`,
  }
}

function onDocPointerDown(event: PointerEvent) {
  const el = popRef.value
  if (!el) {
    return
  }
  const target = event.target as Node
  if (el.contains(target) || props.anchor?.contains(target)) {
    return
  }
  emit("close")
}

function onDocKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close")
  }
}

function detach() {
  document.removeEventListener("pointerdown", onDocPointerDown, true)
  document.removeEventListener("keydown", onDocKeydown)
  window.removeEventListener("resize", onReposition)
}

function onReposition() {
  place()
}

watch(() => props.open, async (open) => {
  if (open) {
    // 先在视口外渲染以测量高度，再定位
    popStyle.value = { left: "-9999px", top: "0px", width: `${props.width}px` }
    await nextTick()
    place()
    document.addEventListener("pointerdown", onDocPointerDown, true)
    document.addEventListener("keydown", onDocKeydown)
    window.addEventListener("resize", onReposition)
  } else {
    detach()
  }
})

onBeforeUnmount(detach)
</script>
