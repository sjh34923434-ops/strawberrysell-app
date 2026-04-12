import { create } from 'zustand'
import { licenseApi } from '../api/client'

// 브라우저 고유 ID (MAC 주소 대신 사용)
function getDeviceId(): string {
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('deviceId', id)
  }
  return id
}

interface LicenseState {
  licenseKey:  string | null
  isActivated: boolean
  expiresAt:   string | null
  isLoading:   boolean
  error:       string | null
  activate:     (key: string) => Promise<void>
  checkLicense: () => Promise<void>
  clearError:   () => void
}

export const useLicenseStore = create<LicenseState>((set) => ({
  licenseKey:  null,
  isActivated: false,
  expiresAt:   null,
  isLoading:   false,
  error:       null,

  activate: async (key) => {
    set({ isLoading: true, error: null })
    try {
      const deviceId = getDeviceId()
      const { expiresAt } = await licenseApi.activate(key, deviceId)
      localStorage.setItem('licenseKey', key)
      set({ licenseKey: key, isActivated: true, expiresAt, isLoading: false })
    } catch (err) {
      set({
        error:     err instanceof Error ? err.message : '라이선스 활성화 중 오류가 발생했습니다.',
        isLoading: false,
      })
      throw err
    }
  },

  checkLicense: async () => {
    set({ isLoading: true })
    try {
      const storedKey = localStorage.getItem('licenseKey')
      if (!storedKey) {
        set({ isLoading: false })
        return
      }
      const deviceId = getDeviceId()
      const { valid, expiresAt } = await licenseApi.verify(storedKey, deviceId)
      if (valid) {
        set({ licenseKey: storedKey, isActivated: true, expiresAt, isLoading: false })
      } else {
        localStorage.removeItem('licenseKey')
        set({ isActivated: false, isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
