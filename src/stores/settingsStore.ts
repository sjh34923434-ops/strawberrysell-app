import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ColumnMapping } from '../utils/fillMapper'

interface MatchingSettings {
  lastOrderColumn:  string | null
  lastB2bColumn:    string | null
  trimWhitespace:   boolean
  caseInsensitive:  boolean
  outputFilePrefix: string
}

export interface MappingPreset {
  id:            string
  name:          string
  mode?:         'order' | 'invoice'  // 없으면 'order' 로 취급 (하위 호환)
  mapping:       ColumnMapping
  appendValues?: Record<string, string>
  b2bFileName?:  string
  b2bFileData?:  string   // B2B 파일 base64 — 저장 시 함께 포함
  createdAt:     string
}

export interface B2bTemplate {
  id:       string
  name:     string    // 표시 이름
  fileName: string    // 원본 파일명
  data:     string    // base64
  size:     number
  savedAt:  string
}

export interface PartnerRule {
  id:             string
  partnerName:    string    // 거래처 표시명
  matchValues:    string[]  // 분류 컬럼에서 이 값들이면 이 파트너로 분류
  b2bTemplateId:  string    // 저장된 B2B 양식 ID
  mappingPresetId:string    // 저장된 매핑 프리셋 ID
}

export interface MultiMatchConfig {
  id:             string
  name:           string
  classifyColumn: string
  rules:          PartnerRule[]
  createdAt:      string
}

export interface CoupangPartner {
  id:              string
  partnerName:     string              // 파트너 표시명
  prefix:          string              // 업체상품코드 앞글자 (예: "DA")
  b2bFileName?:    string
  b2bFileData?:    string              // base64
  b2bHeaders:      string[]
  marketFileName?: string             // 마켓 주문 원본 엑셀 파일명
  marketFileData?: string             // base64
  marketHeaders?:  string[]           // 마켓 주문 컬럼 목록
  mapping:         ColumnMapping
  appendValues:    Record<string, string>
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
  headerFingerprint: string    // 정렬된 헤더 목록 join → 파일 형식 식별자
  headers:           string[]  // 거래처 파일 원본 헤더
  keyPairs:          Array<{ orderCol: string; supplierCol: string }>
  invoiceCol:        string
  carrierCol:        string
  createdAt:         string
  usageCount:        number
  lastUsedAt:        string
}

export type SavedOrderSource = 'coupang-api' | 'matching' | 'multi-match'

export interface SavedOrder {
  id:       string
  label:    string                        // 표시명 (예: "2026-04-14 쿠팡API")
  date:     string                        // YYYY-MM-DD
  source:   SavedOrderSource
  headers:  string[]
  rows:     Record<string, unknown>[]
  savedAt:  string
}

interface SettingsState {
  theme:            'dark' | 'light'
  fontSize:         number
  matchingSettings: MatchingSettings
  mappingPresets:   MappingPreset[]
  b2bTemplates:     B2bTemplate[]

  setTheme:               (theme: 'dark' | 'light') => void
  toggleTheme:            () => void
  setFontSize:            (size: number) => void
  updateMatchingSettings: (s: Partial<MatchingSettings>) => void
  savePreset:             (name: string, mapping: ColumnMapping, appendValues?: Record<string, string>, b2bFileName?: string, b2bFileData?: string, mode?: 'order' | 'invoice') => void
  deletePreset:           (id: string) => void
  reorderPresets:         (ids: string[]) => void
  updatePreset:           (id: string, name: string) => void
  replacePreset:          (id: string, mapping: ColumnMapping, appendValues?: Record<string, string>, b2bFileName?: string, b2bFileData?: string) => void
  saveB2bTemplate:        (name: string, fileName: string, data: string, size: number) => void
  deleteB2bTemplate:      (id: string) => void

  multiMatchConfigs:       MultiMatchConfig[]
  saveMultiMatchConfig:   (name: string, classifyColumn: string, rules: PartnerRule[]) => void
  deleteMultiMatchConfig: (id: string) => void

  coupangPartners:        CoupangPartner[]
  saveCoupangPartner:     (data: Omit<CoupangPartner, 'id' | 'createdAt'>) => void
  updateCoupangPartner:   (id: string, data: Partial<Omit<CoupangPartner, 'id' | 'createdAt'>>) => void
  deleteCoupangPartner:   (id: string) => void

  marketTemplates:        MarketTemplate[]
  saveMarketTemplate:     (data: Omit<MarketTemplate, 'id' | 'createdAt'>) => void
  updateMarketTemplate:   (id: string, data: Partial<Omit<MarketTemplate, 'id' | 'createdAt'>>) => void
  deleteMarketTemplate:   (id: string) => void

  savedOrders:            SavedOrder[]
  saveOrder:              (source: SavedOrderSource, headers: string[], rows: Record<string, unknown>[]) => void
  deleteSavedOrder:       (id: string) => void

  supplierMappingPresets:        SupplierMappingPreset[]
  saveSupplierMappingPreset:     (name: string, headers: string[], keyPairs: SupplierMappingPreset['keyPairs'], invoiceCol: string, carrierCol: string) => SupplierMappingPreset
  updateSupplierMappingPreset:   (id: string, patch: Partial<Pick<SupplierMappingPreset, 'name' | 'keyPairs' | 'invoiceCol' | 'carrierCol'>>) => void
  deleteSupplierMappingPreset:   (id: string) => void
  touchSupplierMappingPreset:    (id: string) => void   // 사용 시 usageCount/lastUsedAt 업데이트
  findSupplierMappingPreset:     (headers: string[]) => SupplierMappingPreset | undefined
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      fontSize: 18,
      matchingSettings: {
        lastOrderColumn:  null,
        lastB2bColumn:    null,
        trimWhitespace:   true,
        caseInsensitive:  true,
        outputFilePrefix: '매칭결과',
      },
      mappingPresets:      [],
      b2bTemplates:        [],
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

      savePreset: (name, mapping, appendValues, b2bFileName, b2bFileData, mode) => {
        const preset: MappingPreset = {
          id:           Date.now().toString(),
          name,
          mode:         mode ?? 'order',
          mapping,
          appendValues,
          b2bFileName,
          b2bFileData,
          createdAt:    new Date().toISOString(),
        }
        set({ mappingPresets: [...get().mappingPresets, preset] })
      },

      deletePreset: (id) =>
        set({ mappingPresets: get().mappingPresets.filter((p) => p.id !== id) }),

      reorderPresets: (ids) =>
        set({ mappingPresets: ids.map(id => get().mappingPresets.find(p => p.id === id)!).filter(Boolean) }),

      updatePreset: (id, name) =>
        set({
          mappingPresets: get().mappingPresets.map((p) =>
            p.id === id ? { ...p, name } : p
          ),
        }),

      replacePreset: (id, mapping, appendValues, b2bFileName, b2bFileData) =>
        set({
          mappingPresets: get().mappingPresets.map((p) =>
            p.id === id ? { ...p, mapping, appendValues, b2bFileName, b2bFileData } : p
          ),
        }),

      saveB2bTemplate: (name, fileName, data, size) => {
        const t: B2bTemplate = {
          id: Date.now().toString(), name, fileName, data, size,
          savedAt: new Date().toISOString(),
        }
        set({ b2bTemplates: [...get().b2bTemplates, t] })
      },

      deleteB2bTemplate: (id) =>
        set({ b2bTemplates: get().b2bTemplates.filter((t) => t.id !== id) }),

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

      saveMarketTemplate: (data) => {
        const t: MarketTemplate = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() }
        set({ marketTemplates: [...get().marketTemplates, t] })
      },

      updateMarketTemplate: (id, data) =>
        set({ marketTemplates: get().marketTemplates.map(t => t.id === id ? { ...t, ...data } : t) }),

      deleteMarketTemplate: (id) =>
        set({ marketTemplates: get().marketTemplates.filter(t => t.id !== id) }),

      saveOrder: (source, headers, rows) => {
        const now   = new Date()
        const date  = now.toISOString().slice(0, 10)
        const time  = now.toTimeString().slice(0, 5)   // "HH:MM"
        const sourceLabel = source === 'coupang-api' ? '쿠팡API' : source === 'matching' ? '주문매칭' : '일괄매칭'
        const label = `${date} ${time} ${sourceLabel} (${rows.length}건)`
        const order: SavedOrder = {
          id:      Date.now().toString(),
          label,
          date,
          source,
          headers,
          rows,
          savedAt: now.toISOString(),
        }
        // 최근 30개만 유지 (오래된 것부터 제거)
        const existing = get().savedOrders
        const next = [...existing, order].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 30)
        set({ savedOrders: next })
      },

      deleteSavedOrder: (id) =>
        set({ savedOrders: get().savedOrders.filter(o => o.id !== id) }),

      saveSupplierMappingPreset: (name, headers, keyPairs, invoiceCol, carrierCol) => {
        const fingerprint = [...headers].sort().join('|')
        // 같은 헤더 구조가 이미 있으면 덮어씀
        const existing = get().supplierMappingPresets.find(p => p.headerFingerprint === fingerprint)
        const now = new Date().toISOString()
        if (existing) {
          const updated = { ...existing, name, keyPairs, invoiceCol, carrierCol, lastUsedAt: now }
          set({ supplierMappingPresets: get().supplierMappingPresets.map(p => p.id === existing.id ? updated : p) })
          return updated
        }
        const preset: SupplierMappingPreset = {
          id: Date.now().toString(), name, headerFingerprint: fingerprint,
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

      findSupplierMappingPreset: (headers) => {
        const fingerprint = [...headers].sort().join('|')
        return get().supplierMappingPresets.find(p => p.headerFingerprint === fingerprint)
      },
    }),
    { name: 'strawberrysell-settings' }
  )
)
