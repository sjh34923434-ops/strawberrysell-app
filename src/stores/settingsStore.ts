import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuthStore } from './authStore'

// 현재 로그인 사용자별로 키를 분리해서 같은 PC라도 계정마다 데이터 격리
// 비로그인 상태(가입 화면 등)는 'guest'로 처리
function userKey(baseName: string): string {
  const uid = useAuthStore.getState().user?.id ?? 'guest'
  return `${baseName}__${uid}`
}

// electron-store를 Zustand persist storage로 사용 (사용자별 키 분리)
const electronStorage = createJSONStorage(() => ({
  getItem: async (name: string): Promise<string | null> => {
    const key = userKey(name)
    let value = await window.electron.store.get(key)
    // 마이그레이션: 사용자별 키가 없는데 기존 단일 키 데이터가 있으면 1회 복사
    if (value == null && useAuthStore.getState().user?.id) {
      const legacy = await window.electron.store.get(name)
      if (legacy != null) {
        await window.electron.store.set(key, legacy)
        // legacy는 일단 보존 (다른 계정도 마이그레이션 필요할 수 있음)
        value = legacy
      }
    }
    return (value as string) ?? null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await window.electron.store.set(userKey(name), value)
  },
  removeItem: async (name: string): Promise<void> => {
    await window.electron.store.delete(userKey(name))
  },
}))
import type { ColumnMapping } from '../utils/fillMapper'

interface MatchingSettings {
  lastOrderColumn:  string | null
  lastB2bColumn:    string | null
  trimWhitespace:   boolean
  caseInsensitive:  boolean
  outputFilePrefix: string
}

export interface PartnerRule {
  id:             string
  partnerName:    string    // 거래처 표시명
  matchValues:    string[]  // 분류 컬럼에서 이 값들이면 이 파트너로 분류
  partnerId:      string    // 거래처관리에서 등록된 CoupangPartner ID
}

export interface MultiMatchConfig {
  id:             string
  name:           string
  classifyColumn: string
  rules:          PartnerRule[]
  createdAt:      string
}

export const MARKET_TYPES = ['쿠팡', '스마트스토어', '옥션', '지마켓', '11번가', '기타'] as const
export type MarketType = typeof MARKET_TYPES[number]

export interface PerMarketMapping {
  marketType:      MarketType
  marketFileName?: string
  marketFileData?: string
  marketHeaders?:  string[]
  mapping:         ColumnMapping
  appendValues:    Record<string, string>
}

export interface CoupangPartner {
  id:              string
  partnerName:     string              // 파트너 표시명
  prefix:          string              // 업체상품코드 앞글자 (예: "DA")
  b2bFileName?:    string
  b2bFileData?:    string              // base64
  b2bHeaders:      string[]
  marketFileName?: string             // 마켓 주문 원본 엑셀 파일명 (레거시 - 쿠팡 기본)
  marketFileData?: string             // base64 (레거시)
  marketHeaders?:  string[]           // 마켓 주문 컬럼 목록 (레거시)
  mapping:         ColumnMapping      // 레거시 (쿠팡 기본 매핑)
  appendValues:    Record<string, string> // 레거시
  marketMappings?: PerMarketMapping[] // 마켓별 매핑 목록
  createdAt:       string
}

export interface MarketTemplate {
  id:              string
  marketName:      string              // 마켓명 (예: 쿠팡, 스마트스토어)
  fileName?:       string
  fileData?:       string              // base64
  headers:         string[]
  marketFileName?: string             // 마켓 주문 원본 엑셀 파일명
  marketFileData?: string             // base64
  marketHeaders?:  string[]           // 마켓 주문 컬럼 목록
  mapping:         ColumnMapping
  appendValues:    Record<string, string>
  createdAt:       string
}

// 거래처 송장 매핑 프리셋 — 한 번 저장하면 같은 헤더 파일 자동 적용
export interface SupplierMappingPreset {
  id:                string
  name:              string    // 거래처 이름 (예: "A거래처", "쿠팡물류")
  marketType?:       MarketType  // 마켓별 분리 저장
  headerFingerprint: string    // 정렬된 헤더 목록 + 마켓타입 → 파일 형식 식별자
  headers:           string[]  // 거래처 파일 원본 헤더
  keyPairs:          Array<{ orderCol: string; supplierCol: string }>
  invoiceCol:        string
  carrierCol:        string
  createdAt:         string
  usageCount:        number
  lastUsedAt:        string
}

export type FileNameDateFormat = 'YYYYMMDD' | 'YYYY-MM-DD' | 'YYYYMMDD_HHmmss'

export type SavedOrderSource = 'coupang-api' | 'matching' | 'multi-match'

export interface SavedOrder {
  id:       string
  label:    string                        // 표시명 (예: "2026-04-14 쿠팡API")
  date:     string                        // YYYY-MM-DD
  source:   SavedOrderSource
  headers:  string[]
  rows:     Record<string, unknown>[]
  savedAt:  string
  fileName?: string                       // 원본 업로드 파일명 (있으면 라벨에 노출)
}

interface SettingsState {
  theme:                'dark' | 'light'
  fontSize:             number
  matchingSettings:     MatchingSettings
  fileNameDateEnabled:  boolean
  fileNameDateFormat:   FileNameDateFormat

  setTheme:               (theme: 'dark' | 'light') => void
  toggleTheme:            () => void
  setFontSize:            (size: number) => void
  updateMatchingSettings: (s: Partial<MatchingSettings>) => void
  setFileNameDateEnabled: (v: boolean) => void
  setFileNameDateFormat:  (f: FileNameDateFormat) => void

  multiMatchConfigs:       MultiMatchConfig[]
  saveMultiMatchConfig:   (name: string, classifyColumn: string, rules: PartnerRule[]) => void
  deleteMultiMatchConfig: (id: string) => void

  coupangPartners:           CoupangPartner[]
  saveCoupangPartner:        (data: Omit<CoupangPartner, 'id' | 'createdAt'>) => void
  updateCoupangPartner:      (id: string, data: Partial<Omit<CoupangPartner, 'id' | 'createdAt'>>) => void
  deleteCoupangPartner:      (id: string) => void
  savePerMarketMapping:      (partnerId: string, mapping: PerMarketMapping) => void
  deletePerMarketMapping:    (partnerId: string, marketType: MarketType) => void

  marketTemplates:        MarketTemplate[]
  saveMarketTemplate:     (data: Omit<MarketTemplate, 'id' | 'createdAt'>) => void
  updateMarketTemplate:   (id: string, data: Partial<Omit<MarketTemplate, 'id' | 'createdAt'>>) => void
  deleteMarketTemplate:   (id: string) => void

  savedOrders:            SavedOrder[]
  saveOrder:              (source: SavedOrderSource, headers: string[], rows: Record<string, unknown>[], fileName?: string) => void
  deleteSavedOrder:       (id: string) => void

  supplierMappingPresets:        SupplierMappingPreset[]
  saveSupplierMappingPreset:     (name: string, headers: string[], keyPairs: SupplierMappingPreset['keyPairs'], invoiceCol: string, carrierCol: string, marketType?: MarketType) => SupplierMappingPreset
  updateSupplierMappingPreset:   (id: string, patch: Partial<Pick<SupplierMappingPreset, 'name' | 'keyPairs' | 'invoiceCol' | 'carrierCol'>>) => void
  deleteSupplierMappingPreset:   (id: string) => void
  touchSupplierMappingPreset:    (id: string) => void   // 사용 시 usageCount/lastUsedAt 업데이트
  findSupplierMappingPreset:     (headers: string[], marketType?: MarketType) => SupplierMappingPreset | undefined
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      fontSize: 18,
      fileNameDateEnabled: true,
      fileNameDateFormat:  'YYYYMMDD_HHmmss' as FileNameDateFormat,
      matchingSettings: {
        lastOrderColumn:  null,
        lastB2bColumn:    null,
        trimWhitespace:   true,
        caseInsensitive:  true,
        outputFilePrefix: '매칭결과',
      },
      multiMatchConfigs:        [],
      coupangPartners:          [],
      marketTemplates:          [],
      savedOrders:              [],
      supplierMappingPresets:   [],

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setFontSize: (size) => set({ fontSize: Math.min(24, Math.max(15, size)) }),
      updateMatchingSettings: (s) =>
        set({ matchingSettings: { ...get().matchingSettings, ...s } }),

      setFileNameDateEnabled: (v) => set({ fileNameDateEnabled: v }),
      setFileNameDateFormat:  (f) => set({ fileNameDateFormat: f }),

      saveMultiMatchConfig: (name, classifyColumn, rules) => {
        const cfg: MultiMatchConfig = {
          id:             Date.now().toString(),
          name,
          classifyColumn,
          rules,
          createdAt:      new Date().toISOString(),
        }
        set({ multiMatchConfigs: [...get().multiMatchConfigs, cfg] })
      },

      deleteMultiMatchConfig: (id) =>
        set({ multiMatchConfigs: get().multiMatchConfigs.filter((c) => c.id !== id) }),

      saveCoupangPartner: (data) => {
        const partner: CoupangPartner = {
          id: Date.now().toString(),
          ...data,
          createdAt: new Date().toISOString(),
        }
        set({ coupangPartners: [...get().coupangPartners, partner] })
      },

      updateCoupangPartner: (id, data) =>
        set({
          coupangPartners: get().coupangPartners.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }),

      deleteCoupangPartner: (id) =>
        set({ coupangPartners: get().coupangPartners.filter((p) => p.id !== id) }),

      savePerMarketMapping: (partnerId, pm) =>
        set({
          coupangPartners: get().coupangPartners.map(p => {
            if (p.id !== partnerId) return p
            const existing = (p.marketMappings ?? []).filter(m => m.marketType !== pm.marketType)
            return { ...p, marketMappings: [...existing, pm] }
          }),
        }),

      deletePerMarketMapping: (partnerId, marketType) =>
        set({
          coupangPartners: get().coupangPartners.map(p =>
            p.id !== partnerId ? p : { ...p, marketMappings: (p.marketMappings ?? []).filter(m => m.marketType !== marketType) }
          ),
        }),

      saveMarketTemplate: (data) => {
        const t: MarketTemplate = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() }
        set({ marketTemplates: [...get().marketTemplates, t] })
      },

      updateMarketTemplate: (id, data) =>
        set({ marketTemplates: get().marketTemplates.map(t => t.id === id ? { ...t, ...data } : t) }),

      deleteMarketTemplate: (id) =>
        set({ marketTemplates: get().marketTemplates.filter(t => t.id !== id) }),

      saveOrder: (source, headers, rows, fileName) => {
        const now   = new Date()
        const date  = now.toISOString().slice(0, 10)
        const time  = now.toTimeString().slice(0, 5)   // "HH:MM"
        const sourceLabel = source === 'coupang-api' ? '쿠팡API' : source === 'matching' ? '주문매칭' : '일괄매칭'
        const cleanName = fileName ? fileName.replace(/\.[^.]+$/, '') : ''
        const label = `${date} ${time} ${sourceLabel} (${rows.length}건)${cleanName ? ` · ${cleanName}` : ''}`
        const order: SavedOrder = {
          id:      Date.now().toString(),
          label,
          date,
          source,
          headers,
          rows,
          savedAt: now.toISOString(),
          fileName,
        }
        const existing = get().savedOrders
        // 100개 초과 시 전체 초기화 후 새 항목만 저장
        const next = existing.length >= 100 ? [order] : [...existing, order]
        set({ savedOrders: next })
      },

      deleteSavedOrder: (id) =>
        set({ savedOrders: get().savedOrders.filter(o => o.id !== id) }),

      saveSupplierMappingPreset: (name, headers, keyPairs, invoiceCol, carrierCol, marketType) => {
        const fingerprint = [...headers].sort().join('|') + '::' + (marketType ?? 'default')
        // 같은 헤더 구조 + 마켓이 이미 있으면 덮어씀
        const existing = get().supplierMappingPresets.find(p => p.headerFingerprint === fingerprint)
        const now = new Date().toISOString()
        if (existing) {
          const updated = { ...existing, name, keyPairs, invoiceCol, carrierCol, marketType, lastUsedAt: now }
          set({ supplierMappingPresets: get().supplierMappingPresets.map(p => p.id === existing.id ? updated : p) })
          return updated
        }
        const preset: SupplierMappingPreset = {
          id: Date.now().toString(), name, marketType, headerFingerprint: fingerprint,
          headers, keyPairs, invoiceCol, carrierCol,
          createdAt: now, usageCount: 0, lastUsedAt: now,
        }
        set({ supplierMappingPresets: [...get().supplierMappingPresets, preset] })
        return preset
      },

      updateSupplierMappingPreset: (id, patch) =>
        set({ supplierMappingPresets: get().supplierMappingPresets.map(p => p.id === id ? { ...p, ...patch } : p) }),

      deleteSupplierMappingPreset: (id) =>
        set({ supplierMappingPresets: get().supplierMappingPresets.filter(p => p.id !== id) }),

      touchSupplierMappingPreset: (id) =>
        set({
          supplierMappingPresets: get().supplierMappingPresets.map(p =>
            p.id === id ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: new Date().toISOString() } : p
          ),
        }),

      findSupplierMappingPreset: (headers, marketType) => {
        const fingerprint = [...headers].sort().join('|') + '::' + (marketType ?? 'default')
        return get().supplierMappingPresets.find(p => p.headerFingerprint === fingerprint)
      },
    }),
    {
      name: 'strawberrysell-settings',
      storage: electronStorage,
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // electron-store가 비어있으면 localStorage에서 마이그레이션
        if (state.coupangPartners.length === 0) {
          try {
            const raw = localStorage.getItem('strawberrysell-settings')
            if (!raw) return
            const old = JSON.parse(raw)?.state
            if (!old?.coupangPartners?.length) return
            useSettingsStore.setState({
              coupangPartners:          old.coupangPartners          ?? [],
              marketTemplates:          old.marketTemplates          ?? [],
              savedOrders:              old.savedOrders              ?? [],
              supplierMappingPresets:   old.supplierMappingPresets   ?? [],
              multiMatchConfigs:        old.multiMatchConfigs        ?? [],
            })
          } catch { /* 마이그레이션 실패 시 무시 */ }
        }
      },
    }
  )
)
