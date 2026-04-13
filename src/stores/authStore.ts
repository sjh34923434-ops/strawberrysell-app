import { create } from 'zustand'
import { authApi } from '../api/client'

interface User {
  id:      string
  email:   string
  isAdmin: boolean
  status:  string
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

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  isAuthenticated: false,
  isLoading:       false,
  error:           null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { refreshToken } = await authApi.login(email, password)
      await window.electron.store.set('refreshToken', refreshToken)
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
    await window.electron.store.delete('refreshToken')
  },

  checkAuth: async () => {
    set({ isLoading: true })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    )
    try {
      const storedToken = await window.electron.store.get('refreshToken') as string | undefined
      if (!storedToken) {
        set({ isLoading: false })
        return
      }
      const { refreshToken: newRefresh } = await Promise.race([
        authApi.refreshToken(storedToken),
        timeout,
      ])
      await window.electron.store.set('refreshToken', newRefresh)
      const user = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (err: unknown) {
      // 타임아웃은 토큰 유지 (서버 느린 것), 인증 실패(401)만 토큰 삭제
      if (!(err instanceof Error) || err.message !== 'timeout') {
        await window.electron.store.delete('refreshToken')
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
