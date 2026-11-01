# 任务清单面板 UI/UX 评审与优化方案

> 评审日期：2026-11-01
> 评审对象：siyuan-task-list 汇总面板（dock 右下）
> 实测环境：思源笔记 v3.8.7 桌面端（`http://127.0.0.1:9394/stage/build/desktop/`），亮 / 暗两主题实测，面板宽度 488px，任务规模 465 条 / 139 分组（全部笔记本档）
> 评审方法：源码走读 + 浏览器逐主题实测（计算样式取值）+ 思源源码核对（`app/src/assets/scss/component/_button.scss`、`protyle/_task.scss`、`dialog/tooltip.ts`、`assets/icon/task-*.svg`）。**所有颜色与对比度结论均取自运行时计算样式，非目测推断。**

---

## 一、总体判断

面板的信息架构（范围 → 筛选 → 分组树 → 任务行）是清晰的，树形缩进、字重分级、悬停渐显跳转图标这些基础功都做对了。当前的问题不在布局骨架，而在三处"跟主题系统的接口"上：

1. **误用了思源 token 的语义**（`primary-lightest` 是悬停底色不是文字色 → 分段控件蓝底蓝字）；
2. **误用了思源组件的默认态**（`b3-button` 基类自带实心主色背景 → 图标按钮变成蓝色色块）；
3. **样式作用域假设被 Teleport 打破**（`fill:none` 兜底规则罩不到弹窗 → 关闭图标变白色实心块）。

这三类问题有一个共同解法：**贴着思源自己的语言走**——用它定义好的 token、组件形态和 tooltip 通道，而不是在插件里另起一套。这也同时是避免"AI 味儿"设计的答案：不引入渐变、大圆角、重投影、自定义 tooltip 库，靠对齐宿主的既有秩序获得协调感。

### 问题分级汇总

| 级别 | 问题 | 位置 |
|---|---|---|
| P0-1 | 分段控件激活态蓝底蓝字，两主题下文字均不可读 | `index.scss:122-125` |
| P0-2 | DocPicker 关闭图标成白色实心块（`fill:none` 兜底被 Teleport 绕过） | `DocPicker.vue:2` + `index.scss:19-25` |
| P1-3 | 刷新 / 关闭按钮渲染成实心蓝色块（`b3-button` 基类默认主色背景） | `ScopeBar.vue:66`、`DocPicker.vue:11` |
| P1-4 | tooltip 全部用原生 `title`，与思源 `ariaLabel` 体系脱节 | `TaskRow.vue`、`ScopeBar.vue` 等 |
| P1-5 | 任务勾选框语言与思源编辑器不一致（圆形 vs 思源方角矩形；marker 外挂徽标 vs 思源内嵌勾选框） | `index.scss:278-331` |
| P1-6 | 完成态文字 opacity 叠加过度，低于可读下限；与思源编辑器的完成态样式不一致 | `index.scss:314-318` |
| P1-7 | DocPicker 无文档过滤、关闭按钮命中区仅 22px | `DocPicker.vue` |
| P2-8~14 | 字号阶梯碎片化、计数徽标低对比、分段无 hover、范围栏窄面板换行、jump 命中区小、空状态缺图标、dock 图标半实心等 | 详见下文 |
| P2-15 | `SiyuanTheme/` 目录 5 个组件为死代码 | `src/components/SiyuanTheme/` |

---

## 二、P0：可读性硬伤（必须修）

### P0-1 分段控件激活态：蓝底蓝字

**现象（实测计算样式）**

| 主题 | 激活段背景 | 激活段文字 | 对比度 |
|---|---|---|---|
| 亮色 | `rgb(53,117,240)` | `rgba(53,117,240,0.12)` | ≈ 1.1 : 1 |
| 暗色 | `rgb(53,117,240)` | `rgba(53,117,240,0.24)` | ≈ 1.2 : 1 |

截图确认「全部 / 未完成 / 已完成」激活项文字完全不可辨认。两个主题都坏，不是主题特例。

**根因**

`index.scss:122-125`：

```scss
&--active {
  background-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary-lightest, #fff);   // ← 错误
}
```

思源对 `--b3-theme-primary-lightest` 的全部用法都是 `background-color`（`_button.scss:91/125`、`_custom.scss:335` 等十余处，无一处用于文字）。它是"半透明主色"，用来给悬停/选中刷底色；值本身在两主题下分别是 `rgba(53,117,240,.12)` / `.24`，叠在实心主色背景上等于隐形。`#fff` 兜底永远不会生效（变量有定义）。

**修复**

```scss
&--active {
  background-color: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);        // 思源标准"主色上的文字"token，两主题均为 #fff
}
```

原则：**写在 `var(--b3-theme-primary)` 背景之上的文字，一律用 `--b3-theme-on-primary`**。本文档其余同类问题同此原则。

### P0-2 DocPicker 关闭图标：白色实心块

**现象（实测计算样式）**：`.tl-picker__close svg` → `fill: rgb(255,255,255)`，`stroke: none`。X 图标的两条折线被整体填充，14px 视窗内糊成一个白色色块，按钮看起来是一个没有任何图形的蓝色方块（亮暗主题一致）。

**根因**

`DocPicker.vue:2` 把弹窗 `<Teleport to="body">` 挂到了面板之外，而线框兜底规则只写在面板作用域里：

```scss
// index.scss:19-25 —— 只罩住 .tl-panel 内部的 svg
.tl-panel {
  svg { fill: none; stroke: currentColor; ... }
}
```

弹窗内的 svg 失去兜底后回落到思源默认（`fill: currentColor` 类规则），折线闭合图形被填充。

**修复（两层，缺一不可）**

1. **组件层（根治）**：所有内联 `<svg>` 显式携带线框属性，不依赖任何祖先选择器——这正是"把 `fill:none` 放在 svg 元素上"的要求。建议统一封装一个极薄的 `TlIcon.vue`：

```vue
<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" v-html="path" />
</template>
<script setup lang="ts">
defineProps<{ path: string }>()   // 即 lucide 的 path d 串
</script>
```

2. **样式层（防御）**：兜底选择器覆盖 Teleport 出去的容器，并按用户要求加 `!important` 防主题覆盖：

```scss
.tl-panel, .tl-picker-mask {
  svg { fill: none !important; stroke: currentColor; }
}
// 例外：任务完成勾（有意填充的形状）单独放开
.tl-check { svg { fill: none !important; } }
```

---

## 三、P1：一致性与交互质量

### P1-3 图标按钮渲染成实心蓝色块

**现象（实测）**：`.tl-scope__refresh` 与 `.tl-picker__close` 的 `background-color` 均为 `rgb(53,117,240)`（hover 仅叠加阴影）。一个"刷新"动作获得了面板里权重最高的视觉元素，比任务内容文字抢眼得多。

**根因**（思源源码核对）：`_button.scss:7` `.b3-button` 基类自带 `background-color: var(--b3-theme-primary)`；`&--icon` 修饰符（`:194-200`）只调 padding，**不改背景**。思源自家工具栏 / dock 图标按钮用的是透明底形态（`.b3-button--text` 或 `.block__icon`）。

**修复**：插件内自建一个轻量图标按钮（推荐，尺寸可控），替换 `b3-button b3-button--icon` 组合：

```scss
.tl-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--b3-border-radius);
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;

  &:hover  { background-color: var(--b3-list-hover); color: var(--b3-theme-on-background); }
  &:active { background-color: var(--b3-list-icon-hover, var(--b3-list-hover)); }
  &:focus-visible { box-shadow: inset 0 0 0 2px var(--b3-theme-primary-lightest); }

  svg { width: 14px; height: 14px; }
}
```

应用范围：刷新按钮（`ScopeBar.vue:66`）、弹窗关闭按钮（`DocPicker.vue:11`）。

### P1-4 tooltip：从原生 `title` 迁移到思源 `ariaLabel` 通道

**现状**：全部提示用原生 `title`（TaskRow 行 = hpath、勾选 = "切换完成状态"、跳转 = "跳转到源块"、刷新 = "刷新"、选择文档按钮 = hpath）。原生 tooltip 有三个体验缺陷：

1. 约 1s 延迟、操作系统级样式，与思源界面气质脱节；
2. 定位由浏览器决定，面板贴着窗口右缘时，长 hpath 单行 tooltip 被窗口边缘挤压 / 截断；
3. 思源核心 UI（dock、顶栏、设置）统一走的是 `.ariaLabel` + `aria-label` 通道（`dialog/tooltip.ts` 的 `initTooltips` 全局 mouseover 监听 → `showTooltip`，带空间计算与翻转定位），插件显得"外来"。

**修复**

- 删除所有 `:title` 绑定（**这是避免双 tooltip 的唯一正确方式，不是再加一层自定义 tooltip**）；
- 纯图标按钮换成 `class="tl-icon-btn ariaLabel"` + `:aria-label="..."`；
- 有可见文本的控件（范围下拉、选择文档按钮、分段按钮）不加任何 tooltip——可见文本即说明；
- 行级 `title="hpath"` 移除：任务来源路径的信息放到所属文档分组头上（`aria-label="hpath"`），行内跳转按钮保留"跳转到源块"。避免整行悬停都弹长路径的噪音。

```html
<!-- ScopeBar.vue -->
<button class="tl-icon-btn ariaLabel" :aria-label="i18n.refresh" @click="emit('refresh')">
  <svg ...>...</svg>
</button>

<!-- TaskRow.vue：行本身不再有 title；jump 为图标按钮 -->
<button class="tl-jump ariaLabel" :aria-label="i18n.jump" @click.stop="emit('jump', task)">
  <svg ...>...</svg>
</button>
```

### P1-5 任务勾选框：向思源编辑器的图形语言对齐

**思源编辑器内任务列表的真实形态**（`assets/icon/task-unchecked.svg` 等核对）：

- 勾选框是 **18×18 方角矩形（rx=2）**，`fill="none" stroke="currentColor" stroke-width="1.7"` 的 lucide 风格；
- 自定义标记（`/` `-` `!` 等）**渲染在勾选框内部**（`_task.scss` 中 mask 图标 + `::before content: var(--task-marker)`），`/` 与 `-` 还有专属图标（斜线、横线）；
- 完成文字：`color: var(--b3-theme-on-surface-light); text-decoration: line-through`（`completed-text` mixin），**不叠加 opacity**。

**面板现状的偏差**：

1. `tl-check` 是 15px **圆形**（`border-radius: 50%`）——圆形勾选框是原生 checkbox / GTD 应用的语言，与思源文档内的方角框不同族。面板作为文档任务的"投影"，勾选框形状与编辑器一致能显著降低认知迁移成本（同一任务在两边看起来是同一个东西）；
2. 自定义 marker 外挂为 10px 橙色描边小徽标（`tl-marker`），字号低于可读下限，且与编辑器"标记在框内"的形态不一致；
3. `-`（取消）任务在编辑器中按完成态渲染（有删除线），面板中仅显示徽标。

**修复**

- 勾选框改方角：`border-radius: 3px; border: 1.5px solid var(--b3-theme-on-surface)`，去掉 `opacity: .75`（未完成任务不应预设弱化），完成态填充主色、勾线用 `var(--b3-theme-on-primary)`（替换现在硬凑的 `var(--b3-theme-surface, #fff)`）；
- marker 徽标：保留在框外但升级为 11px、无边框、纯文字弱色 `var(--b3-theme-on-surface)`（或并入勾选框内显示字符，与编辑器完全一致——推荐后者，实现也不复杂：勾选框内直接显示 marker 字符）；`-` 与 `/` 可用 lucide `minus` / 斜线思路后续跟进，非必做；
- 完成文字见 P1-6。

### P1-6 完成态文字对比度不足

**现象（实测）**：完成内容 = `--b3-theme-on-surface`（亮 `#5f6368` / 暗 `#9aa0a6`）× `opacity: .55`：

| 主题 | 有效前景 | 背景 | 对比度 |
|---|---|---|---|
| 亮色 | ≈ `#a3a8ac` | `#fff` | ≈ 2.4 : 1 |
| 暗色 | ≈ `#55565a` | `#1e1e1e` | ≈ 2.6 : 1 |

删除线本身已足以传达"完成"，再乘 0.55 的 opacity 使其低于 WCAG AA 正文 4.5:1 / 大字 3:1 下限。

**修复**：与编辑器完成态完全一致（视觉上两边也确实应该一致）：

```scss
.tl-row--done .tl-content {
  color: var(--b3-theme-on-surface-light);   // 思源 completed-text 同款
  text-decoration: line-through;
  // 删除 opacity
}
```

同类：分组计数徽标 `opacity: .6`（实测 ≈ 2.5:1）→ 去掉 opacity，改用 `var(--b3-theme-on-surface-light)`；`tl-check` 的 `opacity: .75` 移除。

### P1-7 DocPicker：缺过滤 + 关闭命中区小

弹窗内文档列表为纯滚动长列表（实测某笔记本 271 条），没有过滤输入框；关闭按钮实测 22×22px，低于最小命中区建议（≥ 28px）。

**修复**

1. 弹窗标题下方加一个 `b3-text-field` 过滤框，纯客户端 `filter`（标题 includes，忽略大小写）即可，不必走搜索 API；
2. 关闭按钮与刷新按钮共用 `.tl-icon-btn`（26px），并把弹窗头部按钮区域 hover 反馈统一；
3. 顺手补键盘路径：`Esc` 关闭、列表 `↑/↓` + `Enter` 选中（低成本高感知）。

---

## 四、P2：打磨项

### P2-8 字号阶梯收敛

现状 11 / 12 / 13 / 13.5px 四档硬编码（13.5px 有半像素渲染模糊风险），且与思源全局 `--b3-font-size: 14px`（文档树、列表同为 14px）并存。dock 面板整体小一档是合理的密度选择，但四档过碎。

**收敛为两档**：正文 / 分组标题 13px，次要信息（筛选、计数、时间性文字）12px，徽标最小 11px。删除 13.5px 档（h1/h2 层级靠 `font-weight: 600` 与缩进区分即可）。

### P2-9 分段控件补 hover 与 focus 态

`.tl-segment` 无 hover 反馈（对比：组头与任务行都有 `--b3-list-hover`）。补：

```scss
.tl-segment:not(&--active):hover { background-color: var(--b3-list-hover); }
.tl-segment:focus-visible { box-shadow: inset 0 0 0 2px var(--b3-theme-primary-lightest); }
```

（此处 `primary-lightest` 用于**背景**语义，正确。）

### P2-10 范围栏窄面板换行秩序

path 模式下（下拉 132px + 文档按钮 160px + 两个 checkbox + 刷新）在默认 320px dock 宽度下会折行，checkbox 与按钮行间 `gap: 6px` 与筛选栏 `8px` 不一致。建议：统一间距 token（8px），并允许 pick 按钮整行独占（`flex: 1 1 100%` 断点由 `flex-wrap` 自然处理），checkbox 行整体成行，避免出现"半行"的破碎感。

### P2-11 jump 图标命中区

`.tl-jump` 图标 13px 且无 padding，可点击区域过小。给它 `width/height: 20px`（图标仍 13px）+ `margin: -3px` 视觉补偿，命中区即达标。

### P2-12 空状态与错误状态

空状态纯文字居中，可读但平淡。建议在标题上方放一个 32px lucide 线框图标（`list-todo` 或 `check-square`），颜色 `--b3-theme-on-surface-light`，明暗主题自动适配；错误态保持红字即可，不加图标（错误要醒目不要装饰）。

### P2-13 dock 图标风格统一

`index.ts` 的 `CUSTOM_ICON_SVG` 中两个横条是 `fill="currentColor"` 实心、checkbox 部分线框——单图标内混用两种填充方式。建议横条改 `stroke` 线框（或整体改实心简化块面），与思源 dock 的单色线性图标密度一致。低优先级。

### P2-14 折叠状态不持久化

`TaskTree` 的 `folded` 为内存态，插件重载 / 重启后 139 个分组全部展开。建议把折叠 key 集合写入插件 config（防抖），与 scope 持久化同一通道。数据量极小，成本一小时内。

### P2-15 清理死代码

`src/components/SiyuanTheme/`（SyButton / SyCheckbox / SyIcon / SyInput / SySelect / SyTextarea）在业务代码中零引用，且 `SyIcon` 是 `<use xlink:href>` 旧模式，与本项目内联 lucide path 的现行做法冲突。直接删除，避免后续误用。

---

## 五、设计规范（收敛后的面板 Token 表）

落实以上修改后，面板应遵守的完整规范——也是后续新增功能的约束：

### 颜色

| 用途 | Token | 说明 |
|---|---|---|
| 主色之上的文字 / 图标 | `var(--b3-theme-on-primary)` | 分段激活态、完成勾线。**禁止用 `primary-lightest` 当文字色** |
| 主色 / 次色之上的弱背景 | `var(--b3-theme-primary-lightest)` | 仅限 background 语义（hover、选中刷色） |
| 正文 | 继承面板 `--b3-theme-on-background` | |
| 次要文字 | `var(--b3-theme-on-surface-light)` | 完成文字、计数徽标、空状态提示。**不再叠加 opacity** |
| 图标默认色 | `var(--b3-theme-on-surface)`，hover 提至 `on-background` | |
| 自定义 marker | `var(--b3-theme-secondary)`，仅文字色 / 图标色，不做底色块 | |
| 错误 | `var(--b3-theme-error)` | |
| 悬停背景 | `var(--b3-list-hover)` | 与思源列表行为一致 |

### 字号

| 档位 | 值 | 用途 |
|---|---|---|
| 正文 / 分组标题 | 13px（标题 600 字重） | 任务内容、组头 |
| 次要 | 12px | 筛选控件、计数徽标 |
| 最小 | 11px | marker 字符（若保留外挂形态） |

### 图标

- 全部 lucide 风格内联 svg：`viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`，**属性写在 svg 元素上**，CSS 兜底加 `!important` 并覆盖 Teleport 容器；
- 常规图标 14px，行内跳转 13px，空状态装饰 32px；
- 图标按钮统一 `.tl-icon-btn`（26px、透明底、`--b3-list-hover` hover）；
- 同一图标内不混用填充与线框。

### tooltip

- 通道唯一：思源 `ariaLabel` 类 + `aria-label` 属性；**全项目零 `title` 属性**；
- 只有纯图形控件配 tooltip；有可见文本的控件不配；
- 行级不挂 tooltip，长路径挂在文档分组头。

### 布局间距

- 统一 8px 间距基准（行内 gap 6px 仅限勾选框与文字之间）；
- 分区边界用 `--b3-border-color` 1px 分隔线（现状保留）。

---

## 六、明确不做的事（反"AI Slop"边界）

以下方案在评审中考虑过并主动放弃，理由记录在此防止回潮：

1. **不引入自定义 tooltip 组件 / 浮层库**——思源 `ariaLabel` 通道已解决样式、定位、遮挡三个问题，自制必然产生双 tooltip 或与宿主不一致；
2. **不加渐变、彩色底卡片、大圆角、重投影**——面板是宿主工作区的一部分，视觉噪音按思源标准衡量；计数徽标保持素色胶囊；
3. **不做虚拟滚动**——465 行 DOM 实测流畅；上限默认 2000，届时优先调小 limit 或用分组折叠缓解，不为臆测的规模上工程复杂度；
4. **不把范围选项折叠进"更多"菜单**——四个模式 + 两个开关是本面板的核心操作频次，可见性优先于整洁；
5. **不重绘 dock 图标为彩色 / 实心大块**——与思源 dock 单色线性语言对齐即可。

---

## 七、实施清单（按文件）

| 文件 | 改动 | 对应问题 |
|---|---|---|
| `src/index.scss` | 分段激活色换 `on-primary`；新增 `.tl-icon-btn`；勾选框圆改方角（rx 3px）；完成态文字换 `on-surface-light` 去 opacity；计数徽标去 opacity；svg 兜底规则扩至 `.tl-picker-mask` 并加 `!important`；字号收敛；分段 hover/focus；jump 命中区；间距统一 | P0-1、P1-3、P1-5、P1-6、P0-2、P2-8~11 |
| `src/components/_shared/TlIcon.vue`（新增） | 内联图标统一封装，svg 元素显式携带 `fill="none"` 等属性 | P0-2 |
| `src/components/task-panel/ScopeBar.vue` | 刷新按钮换 `.tl-icon-btn ariaLabel`；删 `:title`；间距统一 | P1-3、P1-4、P2-10 |
| `src/components/task-panel/DocPicker.vue` | 关闭按钮换 `.tl-icon-btn ariaLabel`；删 `:title`；新增过滤输入框；Esc/键盘导航 | P0-2、P1-7 |
| `src/components/task-panel/TaskRow.vue` | 删行级 `:title`；勾选框与 jump 换 aria-label；marker 徽标样式内联化（框内字符优先） | P1-4、P1-5 |
| `src/components/task-panel/TaskTree.vue` | 文档分组头挂 `aria-label="hpath"`；折叠态上报持久化 | P1-4、P2-14 |
| `src/index.ts` | dock 图标横条改线框（可选） | P2-13 |
| `src/components/SiyuanTheme/` | 整目录删除 | P2-15 |

**验收口径**：亮 / 暗两主题下——① 三个分段文字均清晰可读（对比度 ≥ 4.5:1）；② 面板与弹窗内无任何实心色块状按钮；③ 弹窗关闭图标 X 清晰可辨；④ 悬停所有图标按钮出现思源风格 tooltip，全项目 `title` 属性数量为 0；⑤ 任务勾选框与编辑器内形状一致；⑥ DevTools 无 `title` 属性残留告警。

---

## 八、第二轮需求扩展（2026-11-02 grilling 共识）

> 首轮评审发布后追加 5 项需求，经两轮决策访谈逐项确认。以下为最终共识，实施时以本节为准；与上文冲突处，本节覆盖（P1-7 的"独立弹窗"被 A-2 取代，P2-10 的"范围栏间距改良"被 A-1 取代）。

### A. 范围区重构（需求 2）

- **A-1 摘要条 + 浮层**：顶行改为「范围摘要 chip」——图标 + 主范围名（当前文档名 / 指定路径叶名 / 笔记本名 / 全部笔记本），右侧保留刷新按钮。点击 chip 弹出范围浮层（Teleport 到 body，锚定 chip 下方，空间不足自动上翻）：模式四选一 radio、`包含子文档` / `包含链接文档` 开关。
- **A-2 文档选择集成进浮层**：模式为「指定路径」时，浮层内直接内嵌笔记本下拉 + 文档过滤框 + 文档列表，单层交互；原 `DocPicker` 独立弹窗退役删除。
- **A-3 chip 状态后缀**：勾选子文档 / 链接文档时，chip 追加弱色小字 `＋子` / `＋链`，窄面板自动截断。

### B. 文档搜索（需求 3）

- **B-1 过滤行为**：标题包含匹配、忽略大小写、命中 `<mark>` 高亮；列表项 = 线框文档图标 + 叶名 + 弱色父路径后缀；客户端过滤零请求。
- **B-2 前缀兼容**：输入以 `[[` 或 `【【` 开头时自动剥离前缀再搜（对齐编辑器 `[[` 搜文档的肌肉记忆）。
- **B-3 键盘路径**：过滤框 `↑/↓` 移动、`Enter` 选中、`Esc` 关闭浮层；浮层全局 `Esc` 关闭 + 点击外部关闭。

### C. 树渲染重构（需求 1 + 4）

- **C-1 任务行随深度缩进**：任务行 padding-left 跟随 `--tl-depth`（12px/级，与组头同网格），修复当前任务行贴左边缘、脱离所属标题的问题；`--tl-depth` 改由 TaskTree 递归 prop 内联注入，去掉 CSS 深度链选择器（原 5 层封顶）。
- **C-2 文档标记**：文档分组行加 lucide `file-text` 线框图标（中性图标，不取文档自身 emoji 图标）；标题文字拆分为「弱色父路径 + 叶名」，完整 hpath 移入 tooltip / aria-label。
- **C-3 标题原始层级标记**：标题分组行显示 `#`×level 弱色等宽前缀（H3 → `###`）；字号统一 13px，层级感由字重（h1/h2 600、h3/h4 500、h5/h6 400）+ `#` 数量 + 缩进共同表达。

### D. 标题显示控制（需求 5）

- **D-1 语义**：`标题分组` 总开关（关 = 任务平铺到文档层，无标题分组）；`H1~H6` 层级勾选（勾选的层级作为分组出现，**任务与分组均改挂最近可见祖先**，纯前端由 `headingPath` 重算，零新查询）；`恢复默认` = 显示标题 + 全选 H1~H6。即时生效，不做撤销历史栈。
- **D-2 入口**：筛选栏右侧「层级」图标按钮 → popover；设置非默认时按钮带激活态。配置（含 `foldedKeys` 折叠态）持久化到插件 config。

### E. 实施范围

评审文档全部条目（P0×2、P1×5、P2×8）+ 本节 5 项需求一次做完，统一验收（亮/暗双主题实测）。

### F. 新增配置与 i18n

- config 新增：`showHeadings: boolean`（默认 true）、`headingLevels: number[]`（默认 [1..6]）、`foldedKeys: string[]`。
- i18n 新增：`scopeModeLabel` / `suffixSub` / `suffixLinked` / `filterDocPlaceholder` / `headingsShow` / `resetDefault` / `noActiveDoc`。

---

## 附：实测数据备忘

- 思源 `--b3-theme-primary-lightest`：亮 `rgba(53,117,240,.12)` / 暗 `rgba(53,117,240,.24)`（半透明主色，仅背景语义）；
- 思源 `--b3-theme-on-primary`：亮暗均 `#fff`；
- 思源 `--b3-theme-on-surface`：亮 `#5f6368` / 暗 `#9aa0a6`；`on-surface-light`：亮 `rgba(95,99,104,.68)`；
- 思源 `--b3-font-size`：14px；文档树列表项 14px；
- `.b3-button` 基类背景 = `var(--b3-theme-primary)`（`_button.scss:7`），`--icon` 仅调 padding（`:194`）；
- 思源任务勾选框图标：`task-unchecked.svg` = 18×18 rect rx=2, stroke 1.7, fill none；进行中 `/`、取消 `-` 均有专属图标；
- 思源 tooltip 通道：`dialog/tooltip.ts` `initTooltips()` 监听 `.ariaLabel[aria-label]`。
