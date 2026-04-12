interface Window {
  electron: {
    store: {
      get:    (key: string) => Promise<unknown>
      set:    (key: string, value: unknown) => Promise<void>
      delete: (key: string) => Promise<void>
      clear:  () => Promise<void>
    }
    system: {
      getMacAddress:  () => Promise<string>
      getAppVersion:  () => Promise<string>
      getPresetSeed:  () => Promise<string | null>
    }
    updater: {
      checkForUpdates:    () => Promise<void>
      installUpdate:      () => Promise<void>
      onUpdateAvailable:  (cb: () => void) => void
      onUpdateDownloaded: (cb: () => void) => void
    }
  }
}
