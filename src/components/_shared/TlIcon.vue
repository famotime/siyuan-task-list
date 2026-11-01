<template>
  <svg
    class="tl-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>

<script setup lang="ts">
/**
 * 内联线框图标（lucide 风格）。
 * fill="none" 等属性必须写在 svg 元素上：面板兜底 CSS 罩不到 Teleport 到
 * body 的容器（思源默认 svg fill 会把折线填充成色块），属性级声明不受作用域影响。
 * 多段子路径共用一个 <path> 的 d（M...M... 子路径），不能使用 v-html 注入裸
 * path 字符串——那是文本节点，不会渲染任何线条。
 * 尺寸由使用处的 CSS 控制（.tl-icon 默认 14px）。
 */
defineProps<{ path: string }>()
</script>
