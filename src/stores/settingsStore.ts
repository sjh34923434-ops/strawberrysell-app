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
      multiMatchConfigs:   [],

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
    }),
    { name: 'strawberrysell-settings' }
  )
)
