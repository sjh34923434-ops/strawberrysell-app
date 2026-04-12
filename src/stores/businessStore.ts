import { create } from 'zustand'
import { api } from '../api/client'

export interface MarketplaceConnection {
  id:             string
  marketplace:    string
  displayName:    string | null
  vendorId:       string | null
  isActive:       boolean
  hasAccessKey:   boolean
  hasSecretKey:   boolean
  accessKey:      string | null
  secretKeyMask:  string | null
}

export interface Business {
  id:          string
  name:        string
  created_at:  string
  connections: MarketplaceConnection[]
}

interface BusinessState {
  businesses:  Business[]
  isLoading:   boolean
  error:       string | null
  fetch:       () => Promise<void>
  add:         (name: string) => Promise<void>
  update:      (id: string, name: string) => Promise<void>
  remove:      (id: string) => Promise<void>
  addConnection:    (businessId: string, data: ConnectionInput) => Promise<void>
  updateConnection: (businessId: string, connId: string, data: Partial<ConnectionInput>) => Promise<void>
  removeConnection: (businessId: string, connId: string) => Promise<void>
  testConnection:   (businessId: string, connId: string) => Promise<{ ok: boolean; message: string }>
}

export interface ConnectionInput {
  marketplace:  string
  displayName?: string
  accessKey?:   string
  secretKey?:   string
  vendorId?:    string
}

export const useBusinessStore = create<BusinessState>((set, get) => ({
  businesses: [],
  isLoading:  false,
  error:      null,

  fetch: async () => {
    if (import.meta.env.DEV) {
      set({ isLoading: false, error: null })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.get<Business[]>('/businesses')
      set({ businesses: data, isLoading: false })
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message ?? err?.message ?? '알 수 없는 오류'
      console.error('[businessStore] fetch 실패:', status, msg)
      set({ error: `데이터를 불러오지 못했습니다. (${status ?? 'network'}: ${msg})`, isLoading: false })
    }
  },

  add: async (name) => {
    const { data } = await api.post<Business>('/businesses', { name })
    const bizId = data.id
    // 기본 마켓 5개 자동 생성
    const defaultMarkets = ['coupang', 'smartstore', '11st', 'auction', 'gmarket']
    const defaultLabels:  Record<string, string> = {
      coupang: '쿠팡', smartstore: '스마트스토어', '11st': '11번가', auction: '옥션', gmarket: '지마켓'
    }
    const connections = await Promise.all(
      defaultMarkets.map(m =>
        api.post<{ id: string; marketplace: string; displayName: string | null; vendorId: string | null; isActive: boolean }>(
          `/businesses/${bizId}/connections`,
          { marketplace: m, displayName: defaultLabels[m] }
        ).then(r => ({ ...r.data, hasAccessKey: false, hasSecretKey: false, accessKey: null, secretKeyMask: null }))
      )
    )
    set({ businesses: [...get().businesses, { ...data, connections }] })
  },

  update: async (id, name) => {
    await api.patch(`/businesses/${id}`, { name })
    set({ businesses: get().businesses.map(b => b.id === id ? { ...b, name } : b) })
  },

  remove: async (id) => {
    await api.delete(`/businesses/${id}`)
    set({ businesses: get().businesses.filter(b => b.id !== id) })
  },

  addConnection: async (businessId, data) => {
    const { data: conn } = await api.post<MarketplaceConnection>(`/businesses/${businessId}/connections`, data)
    set({
      businesses: get().businesses.map(b =>
        b.id === businessId ? { ...b, connections: [...b.connections, conn] } : b
      )
    })
  },

  updateConnection: async (businessId, connId, data) => {
    await api.patch(`/businesses/${businessId}/connections/${connId}`, data)
    await get().fetch()
  },

  removeConnection: async (businessId, connId) => {
    await api.delete(`/businesses/${businessId}/connections/${connId}`)
    set({
      businesses: get().businesses.map(b =>
        b.id === businessId
          ? { ...b, connections: b.connections.filter(c => c.id !== connId) }
          : b
      )
    })
  },

  testConnection: async (businessId, connId) => {
    const { data } = await api.post<{ ok: boolean; message: string }>(
      `/businesses/${businessId}/connections/${connId}/test`
    )
    return data
  },
}))
