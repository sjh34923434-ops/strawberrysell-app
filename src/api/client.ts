import axios, { AxiosError } from 'axios'

const API_BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL
  ?? 'http://localhost:3000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// Access token 자동 첨부
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 → refreshToken으로 재시도, 실패 시 전역 로그아웃 이벤트
let isRefreshing = false
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const url = error.config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/logout') || url.includes('/auth/refresh') || url.includes('/auth/login')
    if (error.response?.status !== 401 || isAuthEndpoint) return Promise.reject(error)

    const originalConfig = error.config! as typeof error.config & { _retry?: boolean }
    // 이미 재시도한 요청이 또 401을 받으면 무한루프 차단
    if (originalConfig._retry) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      return Promise.reject(error)
    }
    originalConfig._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((token) => {
        originalConfig.headers!.Authorization = `Bearer ${token}`
        return api(originalConfig)
      })
    }

    isRefreshing = true
    try {
      const stored = (window.electron?.store
        ? await window.electron.store.get('refreshToken')
        : localStorage.getItem('refreshToken')) as string | undefined
      if (!stored) throw new Error('no token')
      const { data } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken: stored })
      sessionStorage.setItem('accessToken', data.accessToken)
      if (window.electron?.store) await window.electron.store.set('refreshToken', data.refreshToken)
      else localStorage.setItem('refreshToken', data.refreshToken)
      pendingQueue.forEach(p => p.resolve(data.accessToken))
      pendingQueue = []
      originalConfig.headers!.Authorization = `Bearer ${data.accessToken}`
      return api(originalConfig)
    } catch {
      pendingQueue.forEach(p => p.reject(error))
      pendingQueue = []
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

function parseError(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? `서버 오류가 발생했습니다. (${error.response?.status ?? '연결 실패'})`
  }
  if (error instanceof Error) return error.message
  return '알 수 없는 오류가 발생했습니다.'
}

// ─── 인증 API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    try {
      const { data } = await api.post<{
        user:         { id: string; email: string }
        accessToken:  string
        refreshToken: string
      }>('/auth/login', { email, password })
      sessionStorage.setItem('accessToken', data.accessToken)
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },

  refreshToken: async (refreshToken: string) => {
    try {
      const { data } = await api.post<{
        accessToken:  string
        refreshToken: string
      }>('/auth/refresh', { refreshToken })
      sessionStorage.setItem('accessToken', data.accessToken)
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem('accessToken')
    }
  },

  me: async () => {
    const { data } = await api.get<{
      id: string
      email: string
      isAdmin: boolean
      status: string
      licenseExpiresAt: string | null
      licensePlan: string | null
    }>('/auth/me')
    return data
  },

  signup: async (email: string, password: string, deviceId?: string, name?: string, phone?: string) => {
    try {
      const { data } = await api.post<{ message: string }>('/auth/signup', { email, password, deviceId, name, phone })
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },

  activate: async (licenseKey: string) => {
    try {
      const { data } = await api.post<{
        user: {
          id: string
          email: string
          isAdmin: boolean
          status: string
          licenseExpiresAt: string | null
          licensePlan: string | null
        }
      }>('/auth/activate', { licenseKey })
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },
}

// ─── 라이선스 API ────────────────────────────────────────────────────────────

export const licenseApi = {
  activate: async (licenseKey: string, macAddress: string) => {
    try {
      const { data } = await api.post<{
        valid:       boolean
        expiresAt:   string
        activatedAt: string
      }>('/license/activate', { licenseKey, macAddress })
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },

  verify: async (licenseKey: string, macAddress: string) => {
    try {
      const { data } = await api.post<{
        valid:     boolean
        expiresAt: string
      }>('/license/verify', { licenseKey, macAddress })
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },
}

// ─── 쿠팡 API ─────────────────────────────────────────────────────────────────

export const coupangApi = {
  getOrders: async (bizId: string, connId: string, startDate: string, endDate: string, status: string) => {
    try {
      const { data } = await api.get<{ orders: any[]; total: number }>(
        `/businesses/${bizId}/connections/${connId}/coupang/orders`,
        { params: { startDate, endDate, status } }
      )
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },

  confirmShipments: async (
    bizId: string,
    connId: string,
    shipments: { shipmentBoxId: string; orderId?: string; vendorItemId?: string; deliveryCompanyCode: string; invoiceNumber: string }[]
  ) => {
    try {
      const { data } = await api.post<{ code: string; message: string; data?: unknown }>(
        `/businesses/${bizId}/connections/${connId}/coupang/shipments`,
        shipments
      )
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },
}

// ─── 스마트스토어 API ──────────────────────────────────────────────────────────

export const naverApi = {
  getOrders: async (bizId: string, connId: string, startDate: string, endDate: string, status: string) => {
    try {
      const { data } = await api.get<{ orders: any[]; total: number }>(
        `/businesses/${bizId}/connections/${connId}/naver/orders`,
        { params: { startDate, endDate, status } }
      )
      return data
    } catch (err) {
      throw new Error(parseError(err))
    }
  },
}
