import React, { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Play, RotateCcw, AlertCircle, CheckCircle2,
  Plus, Trash2, Download, ChevronDown, ChevronUp,
  Save, FolderOpen, X, AlertTriangle, Layers, Truck, Tag,
} from 'lucide-react'
import { FileUploader } from '../components/FileUploader'
import { InvoiceMatchTab } from '../components/InvoiceMatchTab'
import { readExcelFile, type ParsedExcel } from '../utils/excelReader'
import { runMultiMatch, getUniqueValuesWithCount, type PartnerMatchResult } from '../utils/multiMatcher'
import { downloadFilledB2b, buildExportFileName } from '../utils/excelWriter'
import { useSettingsStore, type PartnerRule, type CoupangPartner } from '../stores/settingsStore'
import type { ColumnMapping } from '../utils/fillMapper'

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const RECOMMEND_COLS = ['업체상품코드', '등록상품명', '옵션id', '옵션ID']

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────────

function base64ToFile(base64: string, fileName: string): File {
  // data URL 접두사 제거 (data:...;base64, 형태 처리)
  const raw = base64.includes(',') ? base64.split(',')[1] : base64
  const byteStr = atob(raw)
  const arr = new Uint8Array(byteStr.length)
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i)
  return new File([arr], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface LocalPartner {
  id:               string
  partnerName:      string
  b2bTemplateId:    string
  b2bHeaders:       string[]
  b2bFileName?:     string   // CoupangPartner에서 자동 분류 시 직접 저장
  mappingPresetId:  string
  mapping:          ColumnMapping
  appendValues:     Record<string, string>
  matchValues:      string[]
  loadingTemplate:  boolean
  expanded:         boolean
}

// ─── 스텝 인디케이터 ───────────────────────────────────────────────────────────

type Step = 1 | 2 | 3
const STEPS = [
  { num: 1, label: '파일 업로드' },
  { num: 2, label: '파트너 설정' },
  { num: 3, label: '결과 다운로드' },
] as const

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map(({ num, label }, idx) => {
        const done   = num < current
        const active = num === current
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                transition-all duration-300
                ${done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-primary-500 text-white ring-4 ring-primary-500/20'
                :          'bg-dark-hover dark:bg-dark-hover bg-gray-200 text-slate-500 dark:text-slate-500 text-gray-400'}
              `}>
                {done ? <CheckCircle2 size={16} /> : num}
              </div>
              <span className={`text-xs whitespace-nowrap transition-colors ${active ? 'text-primary-400 font-medium' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-16 mx-2 mb-5 transition-colors duration-300 ${num < current ? 'bg-emerald-500' : 'bg-dark-border dark:bg-dark-border bg-gray-200'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── 결과 카드 (미리보기 포함) ────────────────────────────────────────────────

const PREVIEW_ROWS = 5

function ResultCard({ result, onDownload }: { result: PartnerMatchResult; onDownload: (r: PartnerMatchResult) => void }) {
  const [open, setOpen] = React.useState(false)
  const previewHeaders = result.b2bHeaders.slice(0, 8)   // 최대 8컬럼
  const previewRows    = result.rows.slice(0, PREVIEW_ROWS)

  return (
    <div className="rounded-xl bg-dark-card border border-dark-border overflow-hidden">
      {/* 헤더 행 */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 shrink-0">
          <CheckCircle2 size={18} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">{result.partnerName}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            총 <span className="text-emerald-400 font-medium">{result.rowCount.toLocaleString()}행</span> 처리됨
            {' · '}컬럼 {result.b2bHeaders.length}개
          </p>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-dark-border hover:border-slate-600 transition-all shrink-0"
        >
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {open ? '접기' : '미리보기'}
        </button>
        <button
          onClick={() => onDownload(result)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shrink-0"
        >
          <Download size={13} /> 다운로드
        </button>
      </div>

      {/* 미리보기 테이블 */}
      {open && (
        <div className="border-t border-dark-border/60 overflow-x-auto">
          {result.rows.length === 0 ? (
            <p className="text-xs text-slate-500 px-5 py-3">데이터가 없습니다.</p>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-dark-hover/60">
                    {previewHeaders.map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-400 whitespace-nowrap border-r border-dark-border/40 last:border-r-0">
                        {h}
                      </th>
                    ))}
                    {result.b2bHeaders.length > 8 && (
                      <th className="px-3 py-2 text-slate-600 whitespace-nowrap">+{result.b2bHeaders.length - 8}개</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-transparent' : 'bg-dark-hover/20'}>
                      {previewHeaders.map(h => (
                        <td key={h} className="px-3 py-1.5 text-slate-300 whitespace-nowrap border-r border-dark-border/30 last:border-r-0 max-w-[180px] truncate">
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                      {result.b2bHeaders.length > 8 && <td />}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > PREVIEW_ROWS && (
                <p className="text-[10px] text-slate-600 px-4 py-2 border-t border-dark-border/40">
                  상위 {PREVIEW_ROWS}행 표시 중 — 전체 {result.rows.length}행은 다운로드 후 확인
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

export function MultiMatchPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab]         = useState<'match' | 'invoice'>('match')
  const [step, setStep]                   = useState<Step>(1)
  const [orderFile, setOrderFile]         = useState<File | null>(null)
  const [orderData, setOrderData]         = useState<ParsedExcel | null>(null)
  const [classifyColumn, setClassifyColumn] = useState<string>('')
  const [partners, setPartners]           = useState<LocalPartner[]>([])
  const [results, setResults]             = useState<PartnerMatchResult[] | null>(null)
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [isProcessing, setIsProcessing]   = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadPanel, setShowLoadPanel] = useState(false)
  const [saveName, setSaveName]           = useState('')
  const [showValuePicker, setShowValuePicker] = useState<string | null>(null)

  const {
    coupangPartners,
    multiMatchConfigs, saveMultiMatchConfig, deleteMultiMatchConfig,
    saveOrder,
    fileNameDateEnabled, fileNameDateFormat,
  } = useSettingsStore()

  // ─── 파생 데이터 ─────────────────────────────────────────────────────────────

  const uniqueValues = useMemo(() => {
    if (!orderData || !classifyColumn) return []
    return getUniqueValuesWithCount(orderData.rows, classifyColumn)
  }, [orderData, classifyColumn])

  const assignedValues = useMemo(() =>
    new Set(partners.flatMap(p => p.matchValues)),
  [partners])

  const sortedHeaders = useMemo(() => {
    if (!orderData) return []
    const headers = orderData.headers
    const rec = RECOMMEND_COLS.filter(c => headers.includes(c))
    const rest = headers.filter(c => !RECOMMEND_COLS.includes(c))
    return [...rec, ...rest]
  }, [orderData])

  // ─── 파일 파싱 ───────────────────────────────────────────────────────────────

  const handleOrderFile = useCallback(async (file: File | null) => {
    setOrderFile(file)
    setOrderData(null)
    setClassifyColumn('')
    setError(null)
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      setOrderData(parsed)
      // 업체상품코드가 있으면 자동 선택
      const autoCol = parsed.headers.find(h => /업체상품코드/i.test(h))
      if (autoCol) setClassifyColumn(autoCol)
      saveOrder('multi-match', parsed.headers, parsed.rows as Record<string, unknown>[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '주문 파일을 읽는 중 오류가 발생했습니다.')
      setOrderFile(null)
    }
  }, [saveOrder])

  // ─── 접두어 자동 분류 ──────────────────────────────────────────────────────────

  const handleAutoClassify = async () => {
    if (!orderData || !classifyColumn || coupangPartners.length === 0) {
      return
    }
    const currentVals = new Set(uniqueValues.map(v => v.value))
    const loaded: LocalPartner[] = []

    for (const cp of coupangPartners) {
      const rawPrefix = (cp.prefix || cp.partnerName).trim()
      if (!rawPrefix) continue
      const prefixKey = rawPrefix.slice(0, 2)
      const matched = [...currentVals].filter(v => v.slice(0, 2) === prefixKey)

      if (matched.length === 0) continue

      let headers: string[] = cp.b2bHeaders ?? []
      if (headers.length === 0 && cp.b2bFileData) {
        try {
          const file   = base64ToFile(cp.b2bFileData, cp.b2bFileName ?? 'B2B양식.xlsx')
          const parsed = await readExcelFile(file)
          headers = parsed.headers
        } catch { /* ignore */ }
      }

      loaded.push({
        id:              Date.now().toString() + Math.random().toString(36).slice(2),
        partnerName:     cp.partnerName,
        b2bTemplateId:   cp.id,
        b2bHeaders:      headers,
        b2bFileName:     cp.b2bFileName?.replace(/\.[^/.]+$/, ''),
        mappingPresetId: cp.id,
        mapping:         cp.mapping,
        appendValues:    cp.appendValues,
        matchValues:     matched,
        loadingTemplate: false,
        expanded:        false,
      })
    }

    if (loaded.length === 0) return
    setPartners(loaded)

    // 분류 완료 후 바로 매칭 실행 → step 3 결과로 직행
    setIsProcessing(true)
    setError(null)
    try {
      const res = await new Promise<ReturnType<typeof runMultiMatch>>((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(runMultiMatch(
              orderData.rows,
              classifyColumn,
              loaded.map(p => ({
                partnerName:  p.partnerName,
                matchValues:  p.matchValues,
                b2bHeaders:   p.b2bHeaders,
                mapping:      p.mapping,
                appendValues: p.appendValues,
                b2bFileName:  p.b2bFileName,
              })),
            ))
          } catch (e) { reject(e) }
        }, 0)
      })
      setResults(res.partners)
      setUnmatchedCount(res.unmatchedCount)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : '자동 매칭 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── 파트너 조작 ──────────────────────────────────────────────────────────────

  const addPartner = () => {
    setPartners(prev => [...prev, {
      id:              Date.now().toString(),
      partnerName:     '',
      b2bTemplateId:   '',
      b2bHeaders:      [],
      mappingPresetId: '',
      mapping:         {},
      appendValues:    {},
      matchValues:     [],
      loadingTemplate: false,
      expanded:        true,
    }])
  }

  const removePartner = (id: string) =>
    setPartners(prev => prev.filter(p => p.id !== id))

  const updatePartner = (id: string, patch: Partial<LocalPartner>) =>
    setPartners(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))

  const selectTemplate = async (localPartnerId: string, cpId: string) => {
    if (!cpId) { updatePartner(localPartnerId, { b2bTemplateId: '', b2bHeaders: [], mappingPresetId: '', mapping: {}, appendValues: {} }); return }
    const cp = coupangPartners.find(p => p.id === cpId && p.b2bFileData)
    if (!cp) return
    updatePartner(localPartnerId, { b2bTemplateId: cpId, loadingTemplate: true })
    try {
      const file   = base64ToFile(cp.b2bFileData!, cp.b2bFileName ?? 'B2B양식.xlsx')
      const parsed = await readExcelFile(file)
      updatePartner(localPartnerId, {
        b2bHeaders:      parsed.headers,
        loadingTemplate: false,
        mappingPresetId: cpId,
        mapping:         cp.mapping,
        appendValues:    cp.appendValues ?? {},
      })
    } catch {
      updatePartner(localPartnerId, { b2bTemplateId: '', b2bHeaders: [], loadingTemplate: false })
      setError('B2B 양식 파일을 불러오는 중 오류가 발생했습니다.')
    }
  }

  const toggleMatchValue = (partnerId: string, value: string) => {
    setPartners(prev => prev.map(p => {
      if (p.id !== partnerId) return p
      const has = p.matchValues.includes(value)
      return { ...p, matchValues: has ? p.matchValues.filter(v => v !== value) : [...p.matchValues, value] }
    }))
  }

  // ─── 설정 저장/불러오기 ───────────────────────────────────────────────────────

  const handleSaveConfig = () => {
    if (!saveName.trim() || !classifyColumn) return
    const rules: PartnerRule[] = partners.map(p => ({
      id:              p.id,
      partnerName:     p.partnerName,
      matchValues:     p.matchValues,
      partnerId:       p.b2bTemplateId,
    }))
    saveMultiMatchConfig(saveName.trim(), classifyColumn, rules)
    setSaveName('')
    setShowSaveModal(false)
  }

  const handleLoadConfig = async (configId: string) => {
    const cfg = multiMatchConfigs.find(c => c.id === configId)
    if (!cfg) return
    setClassifyColumn(cfg.classifyColumn)
    const loaded: LocalPartner[] = []
    for (const rule of cfg.rules) {
      const cp = coupangPartners.find(p => p.id === rule.partnerId && p.b2bFileData)
      let headers: string[] = []
      if (cp) {
        try {
          const file   = base64ToFile(cp.b2bFileData!, cp.b2bFileName ?? 'B2B양식.xlsx')
          const parsed = await readExcelFile(file)
          headers = parsed.headers
        } catch { /* ignore */ }
      }
      loaded.push({
        id:              rule.id,
        partnerName:     rule.partnerName,
        b2bTemplateId:   rule.partnerId,
        b2bHeaders:      headers,
        mappingPresetId: rule.partnerId,
        mapping:         cp?.mapping ?? {},
        appendValues:    cp?.appendValues ?? {},
        matchValues:     rule.matchValues,
        loadingTemplate: false,
        expanded:        false,
      })
    }
    setPartners(loaded)
    setShowLoadPanel(false)
  }

  // ─── 실행 ─────────────────────────────────────────────────────────────────────

  const canExecute = !!orderData && !!classifyColumn && partners.length > 0
    && partners.every(p => p.partnerName && p.b2bHeaders.length > 0 && p.matchValues.length > 0)

  const handleExecute = async () => {
    if (!orderData) return
    setIsProcessing(true)
    setError(null)
    try {
      const res = await new Promise<ReturnType<typeof runMultiMatch>>((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(runMultiMatch(
              orderData.rows,
              classifyColumn,
              partners.map(p => ({
                partnerName:  p.partnerName,
                matchValues:  p.matchValues,
                b2bHeaders:   p.b2bHeaders,
                mapping:      p.mapping,
                appendValues: p.appendValues,
                b2bFileName:  p.b2bFileName ?? coupangPartners.find(m => m.id === p.b2bTemplateId)?.b2bFileName?.replace(/\.[^/.]+$/, ''),
              })),
            ))
          } catch (e) { reject(e) }
        }, 0)
      })
      setResults(res.partners)
      setUnmatchedCount(res.unmatchedCount)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setStep(1); setOrderFile(null); setOrderData(null)
    setClassifyColumn(''); setPartners([]); setResults(null)
    setUnmatchedCount(0); setError(null)
  }

  // ─── 다운로드 ─────────────────────────────────────────────────────────────────

  const handleDownload = (result: PartnerMatchResult) => {
    const name = buildExportFileName(result.b2bFileName ?? result.partnerName, fileNameDateEnabled, fileNameDateFormat)
    downloadFilledB2b(result.rows, name)
  }

  const handleDownloadAll = () => {
    results?.forEach((r, i) => {
      const name = buildExportFileName(r.b2bFileName ?? r.partnerName, fileNameDateEnabled, fileNameDateFormat)
      setTimeout(() => downloadFilledB2b(r.rows, name), i * 300)
    })
  }

  // ─── 유효성 확인 메시지 ───────────────────────────────────────────────────────

  const validationMsg = (() => {
    if (!orderData || !classifyColumn) return null
    if (partners.length === 0) return '파트너를 1개 이상 추가하세요'
    for (const p of partners) {
      if (!p.partnerName)          return `거래처명을 입력하세요`
      if (!p.b2bHeaders.length)    return `"${p.partnerName || '파트너'}"의 B2B 양식을 선택하세요`
      if (!p.mappingPresetId)      return `"${p.partnerName}"의 매핑 설정을 선택하세요`
      if (!p.matchValues.length)   return `"${p.partnerName}"의 분류 값을 선택하세요`
    }
    return null
  })()

  // ─── 렌더 ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 animate-fade-in">

        {/* 탭 */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-dark-card border border-dark-border">
          <button
            onClick={() => setActiveTab('match')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all
              ${activeTab === 'match'
                ? 'bg-primary-500/15 text-primary-300 border-primary-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Layers size={15} /> 일괄 매칭
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all
              ${activeTab === 'invoice'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Truck size={15} /> 송장번호 추가
          </button>
        </div>

        {/* 송장 탭 */}
        {activeTab === 'invoice' && <InvoiceMatchTab source="multi-match" />}

        {/* 매칭 탭 */}
        {activeTab === 'match' && <div className="space-y-6">

        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100 dark:text-slate-100 text-gray-900 flex items-center gap-3 flex-wrap">
              일괄 매칭
              <span className="text-sm font-semibold text-red-400">거래처관리에서 B2B 주문양식 컬럼 매핑을 완성해야 적용됩니다.</span>
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 mt-1">
              하나의 주문 파일을 여러 거래처 B2B 양식으로 분류 출력
            </p>
          </div>
          {step > 1 && (
            <button onClick={handleReset} className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
              <RotateCcw size={13} /> 처음부터
            </button>
          )}
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex justify-center py-2">
          <StepIndicator current={step} />
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="bg-dark-card dark:bg-dark-card bg-white border border-dark-border dark:border-dark-border border-gray-200 rounded-2xl p-6 space-y-5 animate-slide-up">

            <FileUploader label="주문 파일 (통합 데이터)" file={orderFile} onFileChange={handleOrderFile} />

            {orderData && (
              <>
                <p className="text-xs text-slate-500">
                  총 <span className="text-slate-300 dark:text-slate-300 text-gray-700 font-medium">{orderData.rows.length.toLocaleString()}행</span>
                  {' · '}컬럼 {orderData.headers.length}개 감지됨
                </p>

                {/* 분류 기준 컬럼 선택 */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    분류 기준 컬럼 선택
                    <span className="text-slate-500 normal-case tracking-normal font-normal">(보통 업체상품코드)</span>
                  </p>
                  <select
                    value={classifyColumn}
                    onChange={e => setClassifyColumn(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 text-slate-200 dark:text-slate-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                  >
                    <option value="">— 컬럼을 선택하세요 —</option>
                    {RECOMMEND_COLS.filter(c => orderData.headers.includes(c)).length > 0 && (
                      <optgroup label="추천 컬럼">
                        {RECOMMEND_COLS.filter(c => orderData.headers.includes(c)).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="전체 컬럼">
                      {sortedHeaders.filter(c => !RECOMMEND_COLS.includes(c)).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>

                  {/* 고유값 미리보기 */}
                  {classifyColumn && uniqueValues.length > 0 && (
                    <div className="rounded-xl bg-dark-hover/40 dark:bg-dark-hover/40 bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 p-3 animate-fade-in">
                      <p className="text-xs text-slate-500 mb-2">
                        감지된 고유값 <span className="text-primary-400 font-medium">{uniqueValues.length}개</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {uniqueValues.map(({ value, count }) => (
                          <span key={value} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-dark-surface dark:bg-dark-surface bg-white border border-dark-border dark:border-dark-border border-gray-200 text-slate-300 dark:text-slate-300 text-gray-700">
                            {value}
                            <span className="text-slate-500 text-[10px]">{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              disabled={!orderData || !classifyColumn}
              onClick={() => {
                setPartners([])
                setResults(null)
                if (coupangPartners.length > 0) {
                  handleAutoClassify()
                } else {
                  setStep(2)
                }
              }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20"
            >
              {coupangPartners.length > 0 ? '매칭 실행 →' : '다음: 파트너 설정 →'}
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-dark-border dark:border-dark-border border-gray-200 text-slate-300 dark:text-slate-300 text-gray-700 hover:bg-dark-muted transition-all"
            >
              ← 뒤로가기
            </button>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && orderData && (
          <div className="space-y-4 animate-slide-up">

            {/* 툴바 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                분류 기준: <span className="text-primary-400 font-medium">{classifyColumn}</span>
                {' · '}고유값 {uniqueValues.length}개
              </p>
              <div className="flex gap-2 flex-wrap justify-end">
                {coupangPartners.length > 0 && (
                  <button
                    onClick={handleAutoClassify}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-300 border border-primary-500/30 hover:bg-primary-500/25 transition-all"
                  >
                    <Tag size={11} /> 접두어로 자동 분류 + 실행
                  </button>
                )}
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={partners.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 transition-all"
                >
                  <Save size={11} /> 설정 저장
                </button>
                <button
                  onClick={() => setShowLoadPanel(!showLoadPanel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${showLoadPanel ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}`}
                >
                  <FolderOpen size={11} /> 불러오기 {multiMatchConfigs.length > 0 && `(${multiMatchConfigs.length})`}
                </button>
              </div>
            </div>

            {/* 저장된 설정 불러오기 */}
            {showLoadPanel && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 animate-fade-in">
                <p className="text-xs font-medium text-amber-400">저장된 일괄 매칭 설정</p>
                {multiMatchConfigs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-2">저장된 설정이 없습니다</p>
                ) : (
                  multiMatchConfigs.map(cfg => (
                    <div key={cfg.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 hover:border-amber-500/30 group transition-colors">
                      <button onClick={() => handleLoadConfig(cfg.id)} className="flex-1 text-left">
                        <p className="text-sm font-medium text-slate-200 dark:text-slate-200 text-gray-800 group-hover:text-amber-300 transition-colors">{cfg.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          분류: {cfg.classifyColumn} · 파트너 {cfg.rules.length}개 · {new Date(cfg.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </button>
                      <button onClick={() => deleteMultiMatchConfig(cfg.id)} className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 파트너 카드 목록 */}
            {partners.map((p, idx) => (
              <PartnerCard
                key={p.id}
                partner={p}
                index={idx}
                uniqueValues={uniqueValues}
                assignedValues={assignedValues}
                coupangPartners={coupangPartners}
                showValuePicker={showValuePicker === p.id}
                onToggleExpand={() => updatePartner(p.id, { expanded: !p.expanded })}
                onToggleValuePicker={() => setShowValuePicker(showValuePicker === p.id ? null : p.id)}
                onRemove={() => removePartner(p.id)}
                onNameChange={(name) => updatePartner(p.id, { partnerName: name })}
                onSelectTemplate={(tplId) => selectTemplate(p.id, tplId)}
                onToggleMatchValue={(val) => toggleMatchValue(p.id, val)}
              />
            ))}

            {/* 파트너 추가 버튼 */}
            <button
              onClick={addPartner}
              className="w-full py-3 rounded-xl text-sm font-medium border-2 border-dashed border-dark-border dark:border-dark-border border-gray-300 text-slate-500 hover:border-primary-500/40 hover:text-primary-400 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={15} /> 파트너 추가
            </button>

            {/* 유효성 경고 */}
            {validationMsg && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                <AlertTriangle size={13} /> {validationMsg}
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-dark-border dark:border-dark-border border-gray-200 text-slate-300 dark:text-slate-300 text-gray-700 hover:bg-dark-muted transition-all"
              >
                ← 이전
              </button>
              <button
                disabled={!canExecute || isProcessing}
                onClick={handleExecute}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20"
              >
                {isProcessing
                  ? <><Loader2 size={15} className="animate-spin" /> 분류 처리 중...</>
                  : <><Play size={15} /> 일괄 매칭 실행</>}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
        {step === 3 && results && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300 dark:text-slate-300 text-gray-700">
                완료 — 파트너 <span className="text-primary-400">{results.length}</span>개 처리
              </p>
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-all shadow-lg shadow-primary-500/20"
              >
                <Download size={14} /> 전체 다운로드
              </button>
            </div>

            {/* 결과 카드 */}
            <div className="space-y-3">
              {results.map((r) => (
                <ResultCard key={r.partnerName} result={r} onDownload={handleDownload} />
              ))}

              {/* 미분류 경고 */}
              {unmatchedCount > 0 && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">미분류 행: {unmatchedCount.toLocaleString()}개</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">분류 값이 설정된 파트너에 포함되지 않아 건너뜀</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { setStep(1); setPartners([]); setResults(null) }}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover dark:bg-dark-hover bg-gray-100 border border-dark-border dark:border-dark-border border-gray-200 text-slate-300 dark:text-slate-300 text-gray-700 hover:bg-dark-muted transition-all"
            >
              ← 이전 (파일 업로드로)
            </button>
          </div>
        )}

        {/* 설정 저장 모달 */}
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-80 bg-dark-card dark:bg-dark-card bg-white rounded-2xl border border-dark-border p-5 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-200 dark:text-slate-200 text-gray-800">설정 저장</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                파트너 {partners.length}개 · 분류 기준: {classifyColumn}
              </p>
              <input
                autoFocus type="text" placeholder="예: 3사 통합 매칭"
                value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveConfig()}
                className="w-full px-3 py-2.5 rounded-xl text-sm mb-3 bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border text-slate-200 dark:text-slate-200 text-gray-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2 rounded-xl text-sm text-slate-400 bg-dark-hover hover:bg-dark-muted transition-colors">취소</button>
                <button onClick={handleSaveConfig} disabled={!saveName.trim()} className="flex-[2] py-2 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 transition-colors">저장</button>
              </div>
            </div>
          </div>
        )}

        </div>}

      </div>
    </div>
  )
}

// ─── 파트너 카드 컴포넌트 ──────────────────────────────────────────────────────

interface PartnerCardProps {
  partner:           LocalPartner
  index:             number
  uniqueValues:      { value: string; count: number }[]
  assignedValues:    Set<string>
  coupangPartners:   CoupangPartner[]
  showValuePicker:   boolean
  onToggleExpand:    () => void
  onToggleValuePicker: () => void
  onRemove:          () => void
  onNameChange:      (name: string) => void
  onSelectTemplate:  (id: string) => void
  onToggleMatchValue:(val: string) => void
}

function PartnerCard({
  partner, index, uniqueValues, assignedValues,
  coupangPartners,
  showValuePicker, onToggleExpand, onToggleValuePicker,
  onRemove, onNameChange, onSelectTemplate, onToggleMatchValue,
}: PartnerCardProps) {
  const availablePartners = coupangPartners.filter(p => p.b2bFileData)

  const isComplete = partner.partnerName && partner.b2bHeaders.length > 0
    && partner.mappingPresetId && partner.matchValues.length > 0

  return (
    <div className={`
      rounded-xl border transition-colors
      ${isComplete
        ? 'bg-dark-card dark:bg-dark-card bg-white border-emerald-500/20'
        : 'bg-dark-card dark:bg-dark-card bg-white border-dark-border dark:border-dark-border border-gray-200'}
    `}>
      {/* 카드 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary-500/20 text-primary-400'}`}>
          {isComplete ? <CheckCircle2 size={13} /> : index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 dark:text-slate-200 text-gray-800 truncate">
            {partner.partnerName || `파트너 ${index + 1}`}
          </p>
          {isComplete && (
            <p className="text-xs text-slate-500 truncate">
              분류값 {partner.matchValues.length}개 · {availablePartners.find(p => p.id === partner.b2bTemplateId)?.partnerName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {partner.matchValues.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400">
              {partner.matchValues.length}개
            </span>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove() }} className="p-1 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={13} />
          </button>
          {partner.expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </div>

      {/* 카드 바디 */}
      {partner.expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-dark-border dark:border-dark-border border-gray-100">
          <div className="pt-3 space-y-3">
            {/* 거래처명 */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">거래처명</label>
              <input
                type="text" value={partner.partnerName}
                onChange={e => onNameChange(e.target.value)}
                placeholder="예: 도매처, B2B, 쿠팡, 네이버, 11번가"
                className="w-full px-3 py-2 rounded-lg text-sm bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 text-slate-200 dark:text-slate-200 text-gray-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 거래처 선택 (B2B 양식 + 매핑 통합) */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">거래처 (B2B 양식 + 매핑)</label>
              <select
                value={partner.b2bTemplateId}
                onChange={e => onSelectTemplate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg text-xs bg-dark-hover dark:bg-dark-hover bg-gray-50 border border-dark-border dark:border-dark-border border-gray-200 text-slate-200 dark:text-slate-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
              >
                <option value="">— 거래처 선택 —</option>
                {availablePartners.map(p => (
                  <option key={p.id} value={p.id}>{p.partnerName}{p.prefix ? ` (${p.prefix})` : ''}</option>
                ))}
              </select>
              {partner.loadingTemplate && <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><Loader2 size={9} className="animate-spin" /> 로딩 중...</p>}
              {partner.b2bHeaders.length > 0 && <p className="text-[10px] text-emerald-400 mt-0.5">컬럼 {partner.b2bHeaders.length}개 · 매핑 {Object.values(partner.mapping).filter(Boolean).length}개 적용</p>}
            </div>

            {/* 분류 값 선택 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-500">분류 값 선택</label>
                <button
                  onClick={onToggleValuePicker}
                  className={`text-xs px-2 py-0.5 rounded-lg border transition-colors ${showValuePicker ? 'bg-primary-500/20 text-primary-300 border-primary-500/30' : 'bg-dark-hover dark:bg-dark-hover bg-gray-100 text-slate-400 border-dark-border dark:border-dark-border border-gray-200 hover:text-slate-200'}`}
                >
                  {showValuePicker ? '닫기' : '값 선택 ▼'}
                </button>
              </div>

              {/* 선택된 값 목록 */}
              {partner.matchValues.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {partner.matchValues.map(v => (
                    <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-primary-500/15 text-primary-300 border border-primary-500/25">
                      {v}
                      <button onClick={() => onToggleMatchValue(v)} className="hover:text-red-400 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 mb-2">선택된 값 없음 — 아래에서 선택하세요</p>
              )}

              {/* 값 선택 피커 */}
              {showValuePicker && (
                <div className="rounded-xl border border-primary-500/20 bg-dark-surface dark:bg-dark-surface bg-gray-50 p-2 max-h-48 overflow-y-auto animate-fade-in">
                  {uniqueValues.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">감지된 고유값 없음</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueValues.map(({ value, count }) => {
                        const selected      = partner.matchValues.includes(value)
                        const otherAssigned = !selected && assignedValues.has(value)
                        return (
                          <button
                            key={value}
                            onClick={() => !otherAssigned && onToggleMatchValue(value)}
                            disabled={otherAssigned}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border transition-all
                              ${selected      ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                              : otherAssigned ? 'opacity-30 cursor-not-allowed bg-dark-hover dark:bg-dark-hover bg-gray-100 text-slate-500 border-transparent'
                              :                 'bg-dark-hover dark:bg-dark-hover bg-white text-slate-300 dark:text-slate-300 text-gray-700 border-dark-border dark:border-dark-border border-gray-200 hover:border-primary-500/40 hover:text-primary-300'}`}
                          >
                            {value}
                            <span className="text-[10px] opacity-60">{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
