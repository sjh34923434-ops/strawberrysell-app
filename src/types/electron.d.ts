interface UpdateStatus {
  status:          'idle' | 'checking' | 'downloading' | 'ready' | 'error'
  version?:        string
  progress?:       number
  bytesPerSecond?: number
  transferred?:    number
  total?:          number
  error?:          string
}

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
      getUpdateInfo:  () => Promise<{ version: string; updatedAt: string }>
      getPresetSeed:  () => Promise<string | null>
    }
    updater: {
      checkForUpdates:    () => Promise<{ ok: boolean; version?: string; error?: string }>
      installUpdate:      () => Promise<void>
      openDownloadPage:   () => Promise<void>
      onStatus:           (cb: (s: UpdateStatus) => void) => () => void
    }
  }
}
