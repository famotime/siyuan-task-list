import type { TPluginDataChangeReason } from "siyuan"
import { Plugin, Setting } from "siyuan"
import {
  DEFAULT_CONFIG,
  DOCK_TYPE,
  sanitizeConfig,
  STORAGE_NAME,
  type TaskListConfig,
} from "@/config"
import { mountPanel, unmountPanel } from "@/main"
import { pushErrMsg } from "@/api"
import "@/index.scss"

export type { TaskListConfig } from "@/config"

const CUSTOM_ICON_SVG = `<symbol id="iconTaskList" viewBox="0 0 1024 1024">
  <rect x="96" y="160" width="288" height="288" rx="48" fill="none" stroke="currentColor" stroke-width="72"/>
  <path fill="none" stroke="currentColor" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" d="M176 304l64 64 128-128"/>
  <rect x="512" y="216" width="416" height="80" rx="16" fill="none" stroke="currentColor" stroke-width="72"/>
  <rect x="96" y="576" width="288" height="288" rx="48" fill="none" stroke="currentColor" stroke-width="72"/>
  <path fill="none" stroke="currentColor" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" d="M176 720l64 64 128-128"/>
  <rect x="512" y="632" width="416" height="80" rx="16" fill="none" stroke="currentColor" stroke-width="72"/>
</symbol>`

export default class TaskListPlugin extends Plugin {
  public config: TaskListConfig = { ...DEFAULT_CONFIG, scope: { ...DEFAULT_CONFIG.scope } }

  /** 配置变更外部监听回调（设置对话框修改保存后通知 App 响应更新） */
  public onConfigUpdated?: (config: TaskListConfig) => void

  /** 配置加载完成信号：面板挂载可能早于异步 onload 完成，初始刷新前需等待 */
  public readyPromise: Promise<void> = Promise.resolve()

  /** 设置对话框（基类 Plugin 已占用 setting 属性名） */
  private settingDialog: Setting | null = null

  async onload() {
    this.addIcons(CUSTOM_ICON_SVG)

    // addDock 必须在 onload 内同步调用（任何 await 之前），否则冷启动时 dock 按钮不注册
    const self = this
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 320, height: 0 },
        icon: "iconTaskList",
        title: (this.i18n.panelTitle as string) || "Task List",
      },
      data: {},
      type: DOCK_TYPE,
      init(this: any) {
        this.element.classList.add("tl-dock")
        mountPanel(this.element, self)
      },
      destroy() {
        unmountPanel()
      },
    })

    this.readyPromise = (async () => {
      const saved = await this.loadData(STORAGE_NAME).catch(() => null)
      this.config = sanitizeConfig(saved, this.config)
    })()
  }

  /**
   * 插件存储数据变更钩子（跨前端实例同步时触发）。
   * 必须实现：前端生命周期在插件未覆盖 onDataChanged 时，会把内核的存储变更
   * 广播降级为整插件卸载重载（app/src/plugin/lifecycle.ts runDataChange），
   * 任何一次配置写入都会引发 unload/load 循环 → dock 面板反复折叠展开。
   * 这里只读更新内存配置，绝不写盘。
   */
  async onDataChanged(_reason?: TPluginDataChangeReason): Promise<void> {
    const saved = await this.loadData(STORAGE_NAME).catch(() => null)
    this.config = sanitizeConfig(saved, this.config)
    this.onConfigUpdated?.(this.config)
  }

  onunload() {
    if (this.settingDialog) {
      // Setting 无 destroy 方法，元素随对话框关闭移除；这里仅释放引用
      this.settingDialog = null
    }
  }

  /**
   * 仅在插件被卸载时触发：清理持久化配置，避免卸载后残留。
   * 注意 removeData 严禁移入 onunload —— 禁用插件或思源关闭时也会触发 onunload，
   * 在那里删数据会导致用户设置丢失。
   */
  async uninstall() {
    try {
      await this.removeData(STORAGE_NAME)
    } catch (e) {
      pushErrMsg(
        ((this.i18n.uninstallDataRemoveFailed as string) || "Failed to remove plugin data of ${name} on uninstall: ${error}")
          .replace("${name}", this.name)
          .replace("${error}", String(e)),
        4000,
      )
    }
  }

  openSetting() {
    this.initSetting()
    this.settingDialog!.open(this.displayName || this.name)
    this.bindSettingTooltips()
  }

  public async saveConfig() {
    await this.saveData(STORAGE_NAME, JSON.parse(JSON.stringify(this.config))).catch(() => {})
    this.onConfigUpdated?.(this.config)
  }

  private initSetting() {
    const setting = new Setting({
      width: "600px",
      height: "auto",
      destroyCallback: () => {
        this.settingDialog = null
      },
    })
    const sortTodoDesc = (this.i18n.settingsSortTodoFirstDesc as string) || ""
    setting.addItem({
      title: (this.i18n.settingsSortTodoFirst as string) || "Sort open tasks first",
      description: sortTodoDesc,
      createActionElement: () => {
        const switchEl = document.createElement("input")
        switchEl.className = "b3-switch fn__flex-center ariaLabel"
        switchEl.type = "checkbox"
        switchEl.checked = Boolean(this.config.sortTodoFirst)
        switchEl.setAttribute("aria-label", sortTodoDesc)
        switchEl.title = sortTodoDesc
        switchEl.addEventListener("change", () => {
          this.config.sortTodoFirst = switchEl.checked
          this.saveConfig()
        })
        return switchEl
      },
    })
    const countUnfinishedDesc = (this.i18n.settingsCountUnfinishedDesc as string) || ""
    setting.addItem({
      title: (this.i18n.settingsCountUnfinished as string) || "Count open tasks",
      description: countUnfinishedDesc,
      createActionElement: () => {
        const switchEl = document.createElement("input")
        switchEl.className = "b3-switch fn__flex-center ariaLabel"
        switchEl.type = "checkbox"
        switchEl.checked = Boolean(this.config.countUnfinished)
        switchEl.setAttribute("aria-label", countUnfinishedDesc)
        switchEl.title = countUnfinishedDesc
        switchEl.addEventListener("change", () => {
          this.config.countUnfinished = switchEl.checked
          this.saveConfig()
        })
        return switchEl
      },
    })
    const clickStatusMenuDesc = (this.i18n.settingsClickStatusMenuDesc as string) || ""
    setting.addItem({
      title: (this.i18n.settingsClickStatusMenu as string) || "Click icon to open status menu",
      description: clickStatusMenuDesc,
      createActionElement: () => {
        const switchEl = document.createElement("input")
        switchEl.className = "b3-switch fn__flex-center ariaLabel"
        switchEl.type = "checkbox"
        switchEl.checked = Boolean(this.config.clickStatusMenu)
        switchEl.setAttribute("aria-label", clickStatusMenuDesc)
        switchEl.title = clickStatusMenuDesc
        switchEl.addEventListener("change", () => {
          this.config.clickStatusMenu = switchEl.checked
          this.saveConfig()
        })
        return switchEl
      },
    })
    const limitDesc = (this.i18n.settingsLimitDesc as string) || ""
    setting.addItem({
      title: (this.i18n.settingsLimit as string) || "Aggregation limit",
      description: limitDesc,
      createActionElement: () => {
        const input = document.createElement("input")
        input.className = "b3-text-field fn__flex-center fn__size200 ariaLabel"
        input.type = "number"
        input.min = "100"
        input.max = "100000"
        input.step = "100"
        input.value = String(this.config.limit)
        input.setAttribute("aria-label", limitDesc)
        input.title = limitDesc
        input.addEventListener("change", () => {
          const value = Number.parseInt(input.value, 10)
          if (Number.isFinite(value) && value >= 100) {
            this.config.limit = Math.min(value, 100000)
            this.saveConfig()
          } else {
            input.value = String(this.config.limit)
          }
        })
        return input
      },
    })
    this.settingDialog = setting
  }

  /**
   * 为设置项行与标题绑定 Tooltip（思源 ariaLabel 机制），鼠标悬浮在设置项上时呈现简要说明。
   */
  private bindSettingTooltips() {
    const dialogEl = (this.settingDialog as any)?.dialog?.element as HTMLElement | null | undefined
    if (!dialogEl) {
      return
    }
    const items = dialogEl.querySelectorAll<HTMLElement>(".config-item")
    const descs = [
      (this.i18n.settingsSortTodoFirstDesc as string) || "",
      (this.i18n.settingsCountUnfinishedDesc as string) || "",
      (this.i18n.settingsClickStatusMenuDesc as string) || "",
      (this.i18n.settingsLimitDesc as string) || "",
    ]
    items.forEach((itemEl, idx) => {
      const desc = descs[idx]
      if (!desc) {
        return
      }
      itemEl.classList.add("ariaLabel")
      itemEl.setAttribute("aria-label", desc)
      itemEl.setAttribute("title", desc)

      const titleEl = itemEl.querySelector<HTMLElement>(".config-name")
      if (titleEl) {
        titleEl.classList.add("ariaLabel")
        titleEl.setAttribute("aria-label", desc)
        titleEl.setAttribute("title", desc)
      }
    })
  }
}
