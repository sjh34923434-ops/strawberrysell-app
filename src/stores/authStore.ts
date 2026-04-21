import { create } from 'zustand'
import { authApi } from '../api/client'

interface User {
  id:               string
  email:            string
  isAdmin:          boolean
  status:           string
  licenseExpiresAt: string | null
  licensePlan:      string | null
}

interface AuthState {
  user:            User | null
  isAuthenticated: boolean
  isLoading:       boolean
  error:           string | null
  login:     (email: string, password: string) => Promise<void>
  logout:    () => Promise<void>
  checkAuth: () => Promise<void>
  clearError:() => void
  activate:  (licenseKey: string) => Promise<void>
}

// Electron store 없으면 localStorage 폴백
const tokenStore = {
  get: async (key: string): Promise<string | undefined> => {
    if (window.electron?.store) return window.electron.store.get(key) as Promise<string | undefined>
    return localStorage.getItem(key) ?? undefined
  },
  set: async (key: string, value: string): Promise<void> => {
    if (window.electron?.store) return window.electron.store.set(key, value)
    localStorage.setItem(key, value)
  },
  delete: async (key: string): Promise<void> => {
    if (window.electron?.store) return window.electron.store.delete(key)
    localStorage.removeItem(key)
  },
}

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  isAuthenticated: false,
  isLoading:       false,
  error:           null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { refreshToken } = await authApi.login(email, password)
      await tokenStore.set('refreshToken', refreshToken)
      const user = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (err) {
      set({
        error:     err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.',
        isLoading: false,
      })
      throw err
    }
  },

  logout: async () => {
    if (!useAuthStore.getState().isAuthenticated) return
    set({ user: null, isAuthenticated: false })
    await authApi.logout()
    await tokenStore.delete('refreshToken')
  },

  checkAuth: async () => {
    set({ isLoading: true })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    )
    try {
      const storedToken = await tokenStore.get('refreshToken')
      if (!storedToken) {
        set({ isLoading: false })
        return
      }
      const { refreshToken: newRefresh } = await Promise.race([
        authApi.refreshToken(storedToken),
        timeout,
      ])
      await tokenStore.set('refreshToken', newRefresh)
      const user = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.message !== 'timeout') {
        await tokenStore.delete('refreshToken')
      }
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),

  activate: async (licenseKey) => {
    set({ isLoading: true, error: null })
    try {
      const { user } = await authApi.activate(licenseKey)
      set({ user, isLoading: false })
    } catch (err) {
      set({
        error:     err instanceof Error ? err.message : '활성화 중 오류가 발생했습니다.',
        isLoading: false,
      })
      throw err
    }
  },
}))

// 전역 인증 만료 이벤트 구독 (HMR 중복 방지)
if (typeof window !== 'undefined') {
  if (!(window as any).__authListenerAdded) {
    ;(window as any).__authListenerAdded = true
    window.addEventListener('auth:unauthorized', () => {
      useAuthStore.getState().logout()
    })
  }
}
