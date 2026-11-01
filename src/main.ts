import type {
  Plugin,
} from "siyuan"
import {
  createApp,
} from "vue"
import TaskPanelApp from "@/App.vue"

let plugin: Plugin | null = null

export function usePlugin(pluginInstance?: Plugin): Plugin {
  if (pluginInstance) {
    plugin = pluginInstance
  }
  return plugin!
}

let app: ReturnType<typeof createApp> | null = null

/** 把任务清单面板挂载到 Dock 容器元素（必须先绑定插件实例，App 内 usePlugin 依赖它） */
export function mountPanel(el: HTMLElement, pluginInstance?: Plugin) {
  usePlugin(pluginInstance)
  app = createApp(TaskPanelApp)
  app.mount(el)
}

export function unmountPanel() {
  if (app) {
    app.unmount()
    app = null
  }
}
