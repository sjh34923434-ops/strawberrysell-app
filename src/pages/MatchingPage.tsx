import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Play, RotateCcw, AlertCircle, CheckCircle2, FolderOpen, GitMerge, Truck, ChevronLeft } from 'lucide-react'

import { FileUploader }    from '../components/FileUploader'
import { ColumnMapper }    from '../components/ColumnMapper'
import { MatchingPreview } from '../components/MatchingPreview'
import { DownloadButton }  from '../components/DownloadButton'
import { InvoiceMatchTab } from '../components/InvoiceMatchTab'
import { readExcelFile, type ParsedExcel } from '../utils/excelReader'
import {
  fillB2bFromOrder,
  autoMatchColumns,
  type ColumnMapping,
  type FillResult,
} from '../utils/fillMapper'
import { useSettingsStore, type CoupangPartner, MARKET_TYPES, type MarketType } from '../stores/settingsStore'
import { buildExportFileName } from '../utils/excelWriter'
import type { ExcelRow } from '../utils/excelReader'

// base64 → File 변환
function base64ToFile(base64: string, fileName: string): File {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64
  const byteStr = atob(raw)
  const arr = new Uint8Array(byteStr.length)
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i)
  return new File([arr], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// File → base64 변환
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── 모드 정의 ────────────────────────────────────────────────────────────────

type PageMode = 'order' | 'invoice-saved'

const MODE_CONFIG = {
  order: {
    label:        '주문데이터 → B2B 입력',
    desc:         '주문파일을 넣으시면 자동으로 B2B파일에 맞게 채워진 엑셀파일이 생성됩니다.',
    file1Label:   '주문 파일 (데이터 원본)',
    file2Label:   'B2B 양식 파일',
    actionLabel:  'B2B 파일 생성',
    accent:       'primary',
    tabBg:        'bg-primary-500',
    tabText:      'text-primary-400',
    tabBorder:    'border-primary-500/40',
    tabActiveBg:  'bg-primary-500/15 text-primary-300 border-primary-500/40',
    tabInactive:  'text-slate-500 border-transparent hover:text-slate-300',
    btnClass:     'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 shadow-primary-500/20',
    cardBorder:   'border-dark-border dark:border-dark-border border-gray-200',
    completeBg:   'bg-orange-500/40 border-orange-400/50',
    completeText: 'text-orange-200',
    completeSub:  'text-orange-300/80',
    completeIcon: 'text-orange-300',
    resultAccent: 'text-primary-400',
  },
  invoice: {
    label:        '송장번호 입력',
    desc:         '송장번호가 담긴 B2B 파일을 마켓 업로드 양식으로 변환합니다',
    file1Label:   'B2B 파일 (송장번호 포함)',
    file2Label:   '마켓 업로드 양식 (쿠팡·11번가 등)',
    actionLabel:  '마켓 파일 생성',
    accent:       'amber',
    tabBg:        'bg-amber-500',
    tabText:      'text-amber-400',
    tabBorder:    'border-amber-500/40',
    tabActiveBg:  'bg-amber-500/15 text-amber-300 border-amber-500/40',
    tabInactive:  'text-slate-500 border-transparent hover:text-slate-300',
    btnClass:     'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20',
    cardBorder:   'border-amber-500/30 dark:border-amber-500/30',
    completeBg:   'bg-emerald-500/30 border-emerald-400/50',
    completeText: 'text-emerald-200',
    completeSub:  'text-emerald-300/80',
    completeIcon: 'text-emerald-300',
    resultAccent: 'text-amber-400',
  },
} as const

export function MatchingPage() {
  const location = useLocation()
  const navigate  = useNavigate()
  const [mode, setMode] = useState<PageMode>(
    (location.state as { mode?: PageMode })?.mode ?? 'order'
  )

  const [orderFile, setOrderFile] = useState<File | null>(null)
  const [b2bFile,   setB2bFile]   = useState<File | null>(null)
  const [orderData, setOrderData] = useState<ParsedExcel | null>(null)
  const [b2bData,   setB2bData]   = useState<ParsedExcel | null>(null)

  const [mapping,      setMapping]      = useState<ColumnMapping>({})
  const [appendValues, setAppendValues] = useState<Record<string, string>>({})
  const [result,       setResult]       = useState<FillResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const [b2bFileBase64,      setB2bFileBase64]      = useState<string>('')
  const [_presetLoaded,      setPresetLoaded]        = useState(false)
  const [loadedPresetId,     setLoadedPresetId]      = useState<string | undefined>(undefined)
  const [selectedMarketType, setSelectedMarketType]  = useState<MarketType>('쿠팡')

  const { coupangPartners, updateCoupangPartner, saveOrder, fileNameDateEnabled, fileNameDateFormat } = useSettingsStore()

  const resultRef = useRef<HTMLDivElement>(null)
  const skipAutoMatchRef = useRef(false)

  const cfg = MODE_CONFIG['order']

  // 모드 전환 시 초기화
  const handleModeChange = (newMode: PageMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setOrderFile(null); setB2bFile(null)
    setOrderData(null); setB2bData(null)
    setMapping({});     setAppendValues({})
    setResult(null);    setError(null)
    setB2bFileBase64(''); setPresetLoaded(false); setLoadedPresetId(undefined)

  }

  // 두 파일 모두 로드되면 자동 매핑
  useEffect(() => {
    if (orderData && b2bData && !skipAutoMatchRef.current) {
      setMapping(autoMatchColumns(orderData.headers, b2bData.headers))
      setAppendValues({})
      setResult(null)
    }
  }, [orderData, b2bData])

  // ─── 거래처관리에서 불러오기 ──────────────────────────────────────────────────

  const handleLoadPartner = async (partnerId: string, marketType: MarketType = '쿠팡') => {
    const partner = coupangPartners.find((p) => p.id === partnerId)
    if (!partner) return
    skipAutoMatchRef.current = true
    if (partner.b2bFileData) {
      const file = base64ToFile(partner.b2bFileData, partner.b2bFileName ?? 'B2B양식.xlsx')
      await handleB2bFile(file)
      setB2bFileBase64(partner.b2bFileData)
    }
    // 선택된 마켓 타입의 매핑 사용, 없으면 레거시 매핑 폴백
    const mm = partner.marketMappings?.find(m => m.marketType === marketType)
    setMapping(mm?.mapping ?? partner.mapping)
    setAppendValues(mm?.appendValues ?? partner.appendValues ?? {})
    setSelectedMarketType(marketType)
    setPresetLoaded(true)
    setLoadedPresetId(partner.id)
    setTimeout(() => { skipAutoMatchRef.current = false }, 0)
  }

  // ─── 파일 파싱 ───────────────────────────────────────────────────────────────

  // ─── 자동 매칭 실행 (거래처 감지 → B2B 로드 → 결과) ──────────────────────────

  const autoMatchAndFill = async (parsed: ParsedExcel) => {
    if (coupangPartners.length === 0) return

    // 업체상품코드 컬럼 찾기
    const codeCol = parsed.headers.find(h => /업체상품코드/i.test(h))
    if (!codeCol) return

    // 첫 번째 값의 앞 2글자로 거래처 감지
    const firstCode = String(parsed.rows[0]?.[codeCol] ?? '')
    if (!firstCode) return
    const codeKey = firstCode.slice(0, 2)

    const partner = coupangPartners.find(p => {
      const prefix = (p.prefix || p.partnerName).trim()
      return prefix && prefix.slice(0, 2) === codeKey
    })
    if (!partner?.b2bFileData) return

    // 거래처 B2B 로드
    skipAutoMatchRef.current = true
    const b2bFile = base64ToFile(partner.b2bFileData, partner.b2bFileName ?? 'B2B양식.xlsx')
    await handleB2bFile(b2bFile)
    setB2bFileBase64(partner.b2bFileData)
    setPresetLoaded(true)
    setLoadedPresetId(partner.id)

    const partnerMapping = partner.mapping
    const partnerAppend = partner.appendValues ?? {}
    setMapping(partnerMapping)
    setAppendValues(partnerAppend)
    setTimeout(() => { skipAutoMatchRef.current = false }, 0)

    // B2B 파일 파싱 후 바로 매칭 실행
    const b2bParsed = await readExcelFile(b2bFile)
    setIsProcessing(true)
    try {
      const res = await new Promise<FillResult>((resolve, reject) => {
        setTimeout(() => {
          try {
            // 해당 거래처 prefix에 맞는 행만 필터링
            const codeColFill = parsed.headers.find(h => /업체상품코드/i.test(h))
            const filteredRows = codeColFill
              ? parsed.rows.filter(r => String(r[codeColFill] ?? '').slice(0, 2) === codeKey)
              : parsed.rows
            resolve(fillB2bFromOrder(filteredRows, b2bParsed.headers, partnerMapping, partnerAppend))
          } catch (e) { reject(e) }
        }, 0)
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : '자동 매칭 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOrderFile = useCallback(async (file: File | null) => {
    setOrderFile(file)
    setOrderData(null)
    setError(null)
    setResult(null)
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      setOrderData(parsed)
      saveOrder('matching', parsed.headers, parsed.rows as Record<string, unknown>[], file.name)
      // 주문→B2B 모드일 때만 자동 매칭
      if (mode === 'order') await autoMatchAndFill(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.')
      setOrderFile(null)
    }
  }, [saveOrder, coupangPartners])

  const handleB2bFile = useCallback(async (file: File | null) => {
    setB2bFile(file)
    setB2bData(null)
    setB2bFileBase64('')
    setError(null)
    setResult(null)
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      setB2bData(parsed)
      const base64 = await fileToBase64(file)
      setB2bFileBase64(base64)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.')
      setB2bFile(null)
    }
  }, [])

  // ─── 파일 생성 ───────────────────────────────────────────────────────────────

  const handleFill = async () => {
    if (!orderData || !b2bData) return
    setIsProcessing(true)
    setError(null)
    try {
      const res = await new Promise<FillResult>((resolve, reject) => {
        setTimeout(() => {
          try {
            // 거래처 프리셋이 로드된 경우 prefix 기준으로 행 필터링
            let rowsToFill = orderData.rows
            if (loadedPresetId) {
              const loadedPartner = coupangPartners.find(p => p.id === loadedPresetId)
              if (loadedPartner?.prefix) {
                const codeColFill = orderData.headers.find(h => /업체상품코드/i.test(h))
                if (codeColFill) {
                  const pfx = loadedPartner.prefix.slice(0, 2)
                  rowsToFill = orderData.rows.filter(r => String(r[codeColFill] ?? '').slice(0, 2) === pfx)
                }
              }
            }
            resolve(fillB2bFromOrder(rowsToFill, b2bData.headers, mapping, appendValues))
          } catch (e) { reject(e) }
        }, 0)
      })
      setResult(res)
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── 초기화 ──────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setOrderFile(null); setB2bFile(null)
    setOrderData(null); setB2bData(null)
    setMapping({});     setAppendValues({})
    setResult(null);    setError(null)
    setB2bFileBase64(''); setPresetLoaded(false); setLoadedPresetId(undefined)

  }

  const hasAnyFile   = !!orderFile || !!b2bFile
  const bothFilesReady = !!orderData && !!b2bData

  const outputFileName = buildExportFileName(
    b2bFile ? b2bFile.name.replace(/\.[^/.]+$/, '') : '결과',
    fileNameDateEnabled,
    fileNameDateFormat,
  )

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5 animate-fade-in">

        {/* ── 모드 탭 ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-dark-card dark:bg-dark-card bg-white border border-dark-border dark:border-dark-border border-gray-200">
          <button
            onClick={() => handleModeChange('order')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200
              ${mode === 'order'
                ? 'bg-primary-500/15 text-primary-300 border-primary-500/40 shadow-sm'
                : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <GitMerge size={15} />
            주문데이터 → B2B 입력
          </button>
          <button
            onClick={() => handleModeChange('invoice-saved')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200
              ${mode === 'invoice-saved'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Truck size={15} />
            송장번호 추가
          </button>
        </div>

        {/* ── 헤더 ────────────────────────────────────────────────────────────── */}
        {mode !== 'invoice-saved' && <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-xl font-bold transition-colors duration-200
              ${false ? 'text-amber-300' : 'text-slate-100 dark:text-slate-100 text-gray-900'}`}>
              {cfg.label}
            </h1>
            <p className="text-sm font-semibold text-red-400 mt-1">1개 B2B 사이트만 매칭됩니다.</p>
            <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 mt-0.5">
              {cfg.desc}
            </p>
          </div>
          {hasAnyFile && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              <RotateCcw size={13} />
              처음부터
            </button>
          )}
        </div>}

        {/* 에러 */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* ── 파일 업로드 섹션 ────────────────────────────────────────────────── */}
        {mode !== 'invoice-saved' && <div className={`
          bg-dark-card dark:bg-dark-card bg-white rounded-2xl p-6 space-y-4
          border transition-colors duration-300
          ${false
            ? 'border-amber-500/30 dark:border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.07)]'
            : 'border-dark-border dark:border-dark-border border-gray-200'}
        `}>
          {/* 주문 파일 (데이터 원본) */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {cfg.file1Label}
            </p>
            <FileUploader label="" file={orderFile} onFileChange={handleOrderFile} />
            {orderData && (
              <p className="text-xs text-slate-500">
                <span className="text-slate-300 dark:text-slate-300 text-gray-700 font-medium">{orderData.rows.length.toLocaleString()}행</span>
                {' · '}컬럼 {orderData.headers.length}개
              </p>
            )}
          </div>

          {/* 주문 파일 로드 후 → 거래처 선택 목록 */}
          {orderData && !b2bData && (() => {
            const filtered = coupangPartners.filter(p => p.b2bFileData)
            return filtered.length > 0 ? (
              <div className="space-y-2 animate-fade-in">
                <p className="text-xs font-medium text-emerald-400">거래처를 선택하세요</p>
                {filtered.map(partner => (
                  <div key={partner.id} className="rounded-lg border border-emerald-500/20 bg-dark-hover overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-200 truncate">{partner.partnerName}</p>
                          {partner.prefix && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-400 border border-primary-500/30 shrink-0">{partner.prefix}</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{partner.b2bFileName}</p>
                      </div>
                    </div>
                    {/* 마켓 타입 선택 버튼 */}
                    <div className="flex flex-wrap gap-1 px-3 pb-2">
                      {MARKET_TYPES.map(mt => {
                        const hasMM = partner.marketMappings?.some(m => m.marketType === mt && (m.marketHeaders?.length ?? 0) > 0)
                        const isActive = loadedPresetId === partner.id && selectedMarketType === mt
                        return (
                          <button
                            key={mt}
                            onClick={() => handleLoadPartner(partner.id, mt)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-all
                              ${isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : hasMM
                                  ? 'bg-primary-500/10 text-primary-300 border-primary-500/20 hover:border-primary-400'
                                  : 'bg-dark-muted text-slate-500 border-slate-700 hover:text-slate-300'}`}
                          >
                            {mt}
                            {hasMM && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary-500/8 border border-primary-500/20 text-xs text-primary-400/80">
                <FolderOpen size={12} className="shrink-0" />
                거래처관리에서 거래처를 먼저 등록하세요
              </div>
            )
          })()}
        </div>}

        {/* ── 컬럼 매핑 (자동 매칭 실패 시 수동 조정용) ──────────────────────── */}
        {bothFilesReady && !result && mode === 'order' && (
          <div className={`
            bg-dark-card dark:bg-dark-card bg-white rounded-2xl p-6 space-y-5 animate-slide-up
            border transition-colors duration-300 border-dark-border dark:border-dark-border border-gray-200
          `}>
            <ColumnMapper
              orderHeaders={orderData!.headers}
              b2bHeaders={b2bData!.headers}
              mapping={mapping}
              appendValues={appendValues}
              b2bFileName={b2bFile?.name}
              b2bFileData={b2bFileBase64}
              loadedPresetId={loadedPresetId}
              selectedMarketType={selectedMarketType}
              mode={mode as 'order' | 'invoice'}
              onMappingChange={(m) => { setMapping(m); setPresetLoaded(false) }}
              onAppendValuesChange={setAppendValues}
              onPresetLoaded={(id) => { setLoadedPresetId(id ?? undefined); setPresetLoaded(true) }}
            />

            <button
              disabled={isProcessing}
              onClick={handleFill}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.99] shadow-lg bg-primary-500 hover:bg-primary-600 active:bg-primary-700 shadow-primary-500/20"
            >
              {isProcessing
                ? <><Loader2 size={15} className="animate-spin" /> 처리 중...</>
                : <><Play size={15} /> {cfg.actionLabel}</>
              }
            </button>
          </div>
        )}

        {/* ── 결과 섹션 ───────────────────────────────────────────────────────── */}
        {result && mode === 'order' && (
          <div ref={resultRef} className="space-y-4 animate-slide-up">
            <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl animate-fade-in
              ${false
                ? 'bg-emerald-500/30 border border-emerald-400/50'
                : 'bg-orange-500/40 border border-orange-400/50'}`}>
              <CheckCircle2 size={18} className={`shrink-0 mt-0.5 ${false ? 'text-emerald-300' : 'text-orange-300'}`} />
              <div>
                <p className={`text-sm font-semibold ${false ? 'text-emerald-200' : 'text-orange-200'}`}>
                  {false ? '송장번호 입력이 완료되었습니다.' : '변환이 완료되었습니다.'}
                </p>
                <p className={`text-xs mt-0.5 ${false ? 'text-emerald-300/80' : 'text-orange-300/80'}`}>
                  아래 내용을 확인하시고 파일을 다운로드하세요!
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-300 dark:text-slate-300 text-gray-700">
                총{' '}
                <span className={false ? 'text-amber-400' : 'text-primary-400'}>
                  {result.totalRows.toLocaleString()}
                </span>행
              </p>
              <DownloadButton rows={result.rows} fileName={outputFileName} />
            </div>
            <MatchingPreview result={result} />
          </div>
        )}

        {/* ── 송장번호 전송 탭 ─────────────────────────────────────────────────── */}
        {mode === 'invoice-saved' && (
          <InvoiceMatchTab source="matching" marketType={selectedMarketType} />
        )}

        {/* ── 뒤로가기 ─────────────────────────────────────────────────────────── */}
        <div className="pt-2 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-medium
              bg-dark-card dark:bg-dark-card bg-white
              border border-dark-border dark:border-dark-border border-gray-200
              text-slate-400 hover:text-slate-100 hover:border-slate-500
              transition-all duration-150 active:scale-95"
          >
            <ChevronLeft size={18} />
            뒤로가기
          </button>
        </div>

      </div>
    </div>
  )
}
