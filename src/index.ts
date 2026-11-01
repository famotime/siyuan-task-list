import type { TPluginDataChangeReason } from "siyuan"
import type { ScopeSelection } from "@/data/types"
import { Plugin, Setting, showMessage } from "siyuan"
import { mountPanel, unmountPanel } from "@/main"
import "@/index.scss"

const CUSTOM_ICON_SVG = `<symbol id="iconTaskList" viewBox="0 0 1024 1024">
  <rect x="96" y="160" width="288" height="288" rx="48" fill="none" stroke="currentColor" stroke-width="72"/>
  <path fill="none" stroke="currentColor" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" d="M176 304l64 64 128-128"/>
  <rect x="512" y="216" width="416" height="80" rx="16" fill="none" stroke="currentColor" stroke-width="72"/>
  <rect x="96" y="576" width="288" height="288" rx="48" fill="none" stroke="currentColor" stroke-width="72"/>
  <path fill="none" stroke="currentColor" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" d="M176 720l64 64 128-128"/>
  <rect x="512" y="632" width="416" height="80" rx="16" fill="none" stroke="currentColor" stroke-width="72"/>
</symbol>`

const STORAGE_NAME = "config.json"
const DOCK_TYPE = "tasklist-dock"

export interface TaskListConfig {
  /** 单次汇集条数上限（同时作为查询 LIMIT，避免内核 search.limit=64 默认截断） */
  limit: number
  /** 上次使用的汇总范围 */
  scope: ScopeSelection
  /** 是否以标题作为分组层（false = 任务平铺到文档层） */
  showHeadings: boolean
  /** 作为分组层展示的标题层级（1-6 子集） */
  headingLevels: number[]
  /** 折叠的分组 key（notebook/doc/heading） */
  foldedKeys: string[]
}

const DEFAULT_CONFIG: TaskListConfig = {
  limit: 2000,
  scope: { mode: "activeDoc", includeLinked: false },
  showHeadings: true,
  headingLevels: [1, 2, 3, 4, 5, 6],
  foldedKeys: [],
}

export default class TaskListPlugin extends Plugin {
  public config: TaskListConfig = { ...DEFAULT_CONFIG, scope: { ...DEFAULT_CONFIG.scope } }

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
      this.applySavedConfig(saved)
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
    this.applySavedConfig(saved)
  }

  private applySavedConfig(saved: any) {
    if (saved && Number.isFinite(saved.limit) && saved.limit >= 100) {
      this.config.limit = Math.min(saved.limit, 100000)
    }
    if (saved && saved.scope && saved.scope.mode) {
      this.config.scope = { ...saved.scope }
    }
    if (saved && typeof saved.showHeadings === "boolean") {
      this.config.showHeadings = saved.showHeadings
    }
    if (saved && Array.isArray(saved.headingLevels)) {
      const levels = [...new Set<number>(saved.headingLevels)]
        .filter((lvl) => Number.isInteger(lvl) && lvl >= 1 && lvl <= 6)
      if (levels.length > 0) {
        this.config.headingLevels = levels.sort((a, b) => a - b)
      }
    }
    if (saved && Array.isArray(saved.foldedKeys)) {
      this.config.foldedKeys = saved.foldedKeys.filter((key: any) => typeof key === "string")
    }
  }

  onunload() {
    if (this.settingDialog) {
      // Setting 无 destroy 方法，元素随对话框关闭移除；这里仅释放引用
      this.settingDialog = null
    }
  }

  openSetting() {
    if (!this.settingDialog) {
      this.initSetting()
    }
    this.settingDialog!.open(this.name)
  }

  public async saveConfig() {
    await this.saveData(STORAGE_NAME, JSON.parse(JSON.stringify(this.config))).catch(() => {})
  }

  private initSetting() {
    const setting = new Setting({
      width: "600px",
      height: "180px",
      confirmCallback: () => {
        this.saveConfig()
        showMessage((this.i18n.saved as string) || "Settings saved")
      },
    })
    setting.addItem({
      title: (this.i18n.settingsLimit as string) || "Aggregation limit",
      description: (this.i18n.settingsLimitDesc as string) || "",
      direction: "row",
      createActionElement: () => {
        const input = document.createElement("input")
        input.className = "b3-text-field fn__flex-center fn__size200"
        input.type = "number"
        input.min = "100"
        input.max = "100000"
        input.step = "100"
        input.value = String(this.config.limit)
        input.addEventListener("change", () => {
          const value = Number.parseInt(input.value, 10)
          if (Number.isFinite(value) && value >= 100) {
            this.config.limit = Math.min(value, 100000)
          } else {
            input.value = String(this.config.limit)
          }
        })
        return input
      },
    })
    this.settingDialog = setting
  }
}
