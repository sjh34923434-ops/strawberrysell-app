import { useState, useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Loader2, Play, RotateCcw, AlertCircle, CheckCircle2, FolderOpen, GitMerge, Truck, ChevronLeft, ChevronsUpDown } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { useSettingsStore, type MappingPreset } from '../stores/settingsStore'
import type { ExcelRow } from '../utils/excelReader'

// 드래그 가능한 프리셋 아이템
function SortablePresetItem({ preset, onLoad }: { preset: MappingPreset; onLoad: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: preset.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-hover border border-emerald-500/20 hover:border-emerald-500/40 transition-colors group"
    >
      {/* 드래그 핸들 */}
      <button {...attributes} {...listeners} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <ChevronsUpDown size={14} />
      </button>
      <button onClick={() => onLoad(preset.id)} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-200 group-hover:text-emerald-300 transition-colors truncate">{preset.name}</p>
          <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap shrink-0">클릭 적용</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {preset.b2bFileName} · 매핑 {Object.values(preset.mapping).filter(Boolean).length}개 · {new Date(preset.createdAt).toLocaleDateString('ko-KR')}
        </p>
      </button>
    </div>
  )
}

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
    label:        '주문 → B2B 입력',
    desc:         '주문 파일 정보를 B2B 양식에 맞게 채워 다운로드합니다',
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

  const [showTemplates,  setShowTemplates]  = useState(false)
  const [b2bFileBase64,  setB2bFileBase64]  = useState<string>('')
  const [_presetLoaded,  setPresetLoaded]   = useState(false)
  const [loadedPresetId, setLoadedPresetId] = useState<string | undefined>(undefined)

  const { mappingPresets, reorderPresets, saveOrder } = useSettingsStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
    setShowTemplates(false)
  }

  // 두 파일 모두 로드되면 자동 매핑
  useEffect(() => {
    if (orderData && b2bData && !skipAutoMatchRef.current) {
      setMapping(autoMatchColumns(orderData.headers, b2bData.headers))
      setAppendValues({})
      setResult(null)
    }
  }, [orderData, b2bData])

  // ─── 통합 프리셋 불러오기 ────────────────────────────────────────────────────

  const handleLoadUnifiedPreset = async (presetId: string) => {
    const preset = mappingPresets.find((p) => p.id === presetId)
    if (!preset) return
    skipAutoMatchRef.current = true
    if (preset.b2bFileData) {
      const file = base64ToFile(preset.b2bFileData, preset.b2bFileName ?? 'B2B양식.xlsx')
      await handleB2bFile(file)
      setB2bFileBase64(preset.b2bFileData)
    }
    setMapping(preset.mapping)
    setAppendValues(preset.appendValues ?? {})
    setPresetLoaded(true)
    setLoadedPresetId(preset.id)
    setShowTemplates(false)
    skipAutoMatchRef.current = false
  }

  // ─── 파일 파싱 ───────────────────────────────────────────────────────────────

  const handleOrderFile = useCallback(async (file: File | null) => {
    setOrderFile(file)
    setOrderData(null)
    setError(null)
    setResult(null)
    if (!file) return
    try {
      const parsed = await readExcelFile(file)
      setOrderData(parsed)
      saveOrder('matching', parsed.headers, parsed.rows as Record<string, unknown>[])
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.')
      setOrderFile(null)
    }
  }, [saveOrder])

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
            resolve(fillB2bFromOrder(orderData.rows, b2bData.headers, mapping, appendValues))
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
    setShowTemplates(false)
  }

  const hasAnyFile   = !!orderFile || !!b2bFile
  const bothFilesReady = !!orderData && !!b2bData

  const outputFileName = b2bFile
    ? b2bFile.name.replace(/\.[^/.]+$/, '')
    : `결과_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

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
            주문 → B2B 입력
          </button>
          <button
            onClick={() => handleModeChange('invoice-saved')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all duration-200
              ${mode === 'invoice-saved'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-[#0d2d3d] text-[#5ba8c4] border-[#1a4a60]'}`}
          >
            <Truck size={15} />
            송장번호 추가
          </button>
        </div>

        {/* ── 헤더 ────────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-xl font-bold transition-colors duration-200
              ${false ? 'text-amber-300' : 'text-slate-100 dark:text-slate-100 text-gray-900'}`}>
              {cfg.label}
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-400 text-gray-500 mt-1">
              {cfg.desc}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${showTemplates
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}`}
            >
              <FolderOpen size={12} />
              불러오기
              {mappingPresets.filter(p => p.b2bFileData && (p.mode ?? 'order') === mode).length > 0 &&
                ` (${mappingPresets.filter(p => p.b2bFileData && (p.mode ?? 'order') === mode).length})`}
            </button>
            {hasAnyFile && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <RotateCcw size={13} />
                처음부터
              </button>
            )}
          </div>
        </div>

        {/* 송장입력 모드 안내 배너 */}
        {false && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 animate-fade-in">
            <Truck size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/90 leading-relaxed">
              <span className="font-semibold text-amber-300">사용 방법:</span>
              {' '}거래처에서 받은 <span className="font-medium">송장번호 포함 B2B 파일</span>을 위에,
              {' '}<span className="font-medium">마켓 송장 업로드 양식</span>을 아래에 넣고 컬럼을 매핑하세요.
            </p>
          </div>
        )}

        {/* 불러오기 패널 */}
        {showTemplates && (() => {
          const filtered = mappingPresets.filter(p => p.b2bFileData && (p.mode ?? 'order') === mode)
          return (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 animate-fade-in">
              {filtered.length > 0 ? (
                <>
                  <p className="text-[13px] text-slate-600 px-1">≡ 드래그로 순서 변경 가능</p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event
                      if (!over || active.id === over.id) return
                      const allIds  = mappingPresets.map(p => p.id)
                      const fromIdx = allIds.indexOf(String(active.id))
                      const toIdx   = allIds.indexOf(String(over.id))
                      reorderPresets(arrayMove(allIds, fromIdx, toIdx))
                    }}
                  >
                    <SortableContext items={filtered.map(p => p.id)} strategy={verticalListSortingStrategy}>
                      {filtered.map(preset => (
                        <SortablePresetItem key={preset.id} preset={preset} onLoad={handleLoadUnifiedPreset} />
                      ))}
                    </SortableContext>
                  </DndContext>
                </>
              ) : (
                <p className="text-xs text-slate-500 py-2 text-center">저장된 통합 양식 없음 — 매핑 저장 후 생성됩니다</p>
              )}
            </div>
          )
        })()}

        {/* 에러 */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* ── 파일 업로드 섹션 ────────────────────────────────────────────────── */}
        <div className={`
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

          {/* B2B 양식 미로드 시 안내 */}
          {orderData && !b2bData && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary-500/8 border border-primary-500/20 text-xs text-primary-400/80">
              <FolderOpen size={12} className="shrink-0" />
              위 <span className="font-semibold text-primary-300">불러오기</span>에서 등록된 거래처 B2B 양식을 선택하세요
            </div>
          )}
        </div>

        {/* ── 컬럼 매핑 ───────────────────────────────────────────────────────── */}
        {bothFilesReady && (
          <div className={`
            bg-dark-card dark:bg-dark-card bg-white rounded-2xl p-6 space-y-5 animate-slide-up
            border transition-colors duration-300
            ${false
              ? 'border-amber-500/30 dark:border-amber-500/30'
              : 'border-dark-border dark:border-dark-border border-gray-200'}
          `}>
            <ColumnMapper
              orderHeaders={orderData!.headers}
              b2bHeaders={b2bData!.headers}
              mapping={mapping}
              appendValues={appendValues}
              b2bFileName={b2bFile?.name}
              b2bFileData={b2bFileBase64}
              loadedPresetId={loadedPresetId}
              mode={mode as 'order' | 'invoice'}
              onMappingChange={(m) => { setMapping(m); setPresetLoaded(false) }}
              onAppendValuesChange={setAppendValues}
            />

            <button
              disabled={isProcessing}
              onClick={handleFill}
              className={`
                w-full flex items-center justify-center gap-2
                py-3 rounded-xl text-sm font-semibold text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150 active:scale-[0.99] shadow-lg
                ${false
                  ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/20'
                  : 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 shadow-primary-500/20'}
              `}
            >
              {isProcessing
                ? <><Loader2 size={15} className="animate-spin" /> 처리 중...</>
                : <><Play size={15} /> {cfg.actionLabel}</>
              }
            </button>
          </div>
        )}

        {/* ── 결과 섹션 ───────────────────────────────────────────────────────── */}
        {result && (
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

        {/* ── 뒤로가기 ─────────────────────────────────────────────────────────── */}
        <div className="pt-2 pb-4">
          <button
            onClick={() => navigate(-1)}
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

        {/* ── 송장번호 전송 탭 ─────────────────────────────────────────────────── */}
        {mode === 'invoice-saved' && (
          <InvoiceMatchTab source="matching" />
        )}

      </div>
    </div>
  )
}
