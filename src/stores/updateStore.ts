import { create } from 'zustand'

interface UpdateState {
  status:          'idle' | 'checking' | 'downloading' | 'ready' | 'error'
  version?:        string
  progress:        number     // 0~100
  bytesPerSecond?: number
  transferred?:    number
  total?:          number
  error?:          string
  dismissed:       boolean    // 사용자가 토스트 닫음

  setStatus:  (s: UpdateStatus) => void
  dismiss:    () => void
  reset:      () => void
  installNow: () => Promise<void>
  openManualDownload: () => Promise<void>
  checkNow:   () => Promise<{ ok: boolean; version?: string; error?: string }>
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status:    'idle',
  progress:  0,
  dismissed: false,

  setStatus: (s) =>
    set({
      status:         s.status,
      version:        s.version,
      progress:       typeof s.progress === 'number' ? s.progress : (s.status === 'ready' ? 100 : 0),
      bytesPerSecond: s.bytesPerSecond,
      transferred:    s.transferred,
      total:          s.total,
      error:          s.error,
      dismissed:      false,    // 새 상태 오면 닫힘 해제
    }),

  dismiss: () => set({ dismissed: true }),

  reset: () => set({
    status: 'idle', progress: 0, version: undefined,
    bytesPerSecond: undefined, transferred: undefined, total: undefined,
    error: undefined, dismissed: false,
  }),

  installNow: async () => {
    await window.electron.updater.installUpdate()
  },

  openManualDownload: async () => {
    await window.electron.updater.openDownloadPage()
  },

  checkNow: async () => {
    return await window.electron.updater.checkForUpdates()
  },
}))
