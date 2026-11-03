export class Plugin {
  i18n: Record<string, any> = {}
  app: any = {}
  eventBus: any = { on: () => {}, off: () => {} }
  addIcons() {}
  addDock() {}
  loadData() { return Promise.resolve(null) }
  saveData() { return Promise.resolve() }
}

export class Setting {
  constructor(_opts?: any) {}
  addItem() {}
  open() {}
}

export async function fetchSyncPost(_url: string, _data: any) {
  return { code: 0, data: null }
}

export function getActiveEditor() {
  return null
}

export function openTab() {}
