import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, AlertCircle,
  Clock, CheckCircle2, Loader2, Download,
  RotateCcw, Package, RefreshCw, Building2,
  FlaskConical, FileSpreadsheet, Users,
  Send, Truck, XCircle,
  FolderOpen, Play,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useBusinessStore } from '../stores/businessStore'
import { useSettingsStore } from '../stores/settingsStore'
import { coupangApi } from '../api/client'
import { FileUploader }   from '../components/FileUploader'
import { ColumnMapper }   from '../components/ColumnMapper'
import { MatchingPreview } from '../components/MatchingPreview'
import { DownloadButton } from '../components/DownloadButton'
import { readExcelFile, type ParsedExcel } from '../utils/excelReader'
import {
  fillB2bFromOrder, autoMatchColumns,
  type ColumnMapping, type FillResult,
} from '../utils/fillMapper'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Tab  = 'match' | 'invoice'
type Step = 1 | 2 | 3

const STEPS = [
  { num: 1, label: '주문 가져오기' },
  { num: 2, label: '파트너 설정' },
  { num: 3, label: '결과 다운로드' },
] as const

const ORDER_STATUSES = [
  { value: 'ALL',        label: '전체' },
  { value: 'ACCEPT',     label: '신규주문' },
  { value: 'INSTRUCT',   label: '상품준비중' },
  { value: 'DEPARTURE',  label: '배송지시' },
  { value: 'DELIVERING', label: '배송중' },
  { value: 'FINAL_DELIVERY', label: '배송완료' },
] as const

const CARRIER_MAP: Record<string, string> = {
  'CJ대한통운': 'CJGLS',
  '한진택배':   'HANJIN',
  '롯데택배':   'LOTTE',
  '우체국택배': 'EPOST',
  '로젠택배':   'KGB',
  '경동택배':   'KDEXP',
  '대신택배':   'DAESIN',
  '일양택배':   'ILYANG',
  '천일택배':   'CHUNIL',
}

// 가상 주문 데이터 (DEV 테스트용)
const MOCK_ORDERS = [
  { 번호: 1,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-001', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 45000 },
  { 번호: 2,  묶음배송번호: 'B-002', 주문번호: 'C-20240101-002', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 18000 },
  { 번호: 3,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-003', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 2, 주문상태: '상품준비중', 금액: 30000 },
  { 번호: 4,  묶음배송번호: 'B-003', 주문번호: 'C-20240101-004', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',    옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 5, 주문상태: '배송준비중', 금액: 75000 },
  { 번호: 5,  묶음배송번호: 'B-002', 주문번호: 'C-20240101-005', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 2, 주문상태: '결제완료',   금액: 36000 },
  { 번호: 6,  묶음배송번호: 'B-004', 주문번호: 'C-20240101-006', 업체상품코드: 'A00000004', 등록상품명: '딸기 선물세트', 옵션ID: 'OPT-004', 거래처명: '거래처D(달롬)', 수량: 1, 주문상태: '상품준비중', 금액: 22000 },
  { 번호: 7,  묶음배송번호: 'B-001', 주문번호: 'C-20240101-007', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 4, 주문상태: '배송준비중', 금액: 60000 },
  { 번호: 8,  묶음배송번호: 'B-003', 주문번호: 'C-20240101-008', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',    옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 2, 주문상태: '배송중',     금액: 30000 },
  { 번호: 9,  묶음배송번호: 'B-005', 주문번호: 'C-20240101-009', 업체상품코드: 'A00000005', 등록상품명: '딸기잼',       옵션ID: 'OPT-005', 거래처명: '거래처E(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 15000 },
  { 번호: 10, 묶음배송번호: 'B-002', 주문번호: 'C-20240101-010', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 54000 },
  { 번호: 11, 묶음배송번호: 'B-004', 주문번호: 'C-20240101-011', 업체상품코드: 'A00000004', 등록상품명: '딸기 선물세트', 옵션ID: 'OPT-004', 거래처명: '거래처D(달롬)', 수량: 2, 주문상태: '배송준비중', 금액: 44000 },
  { 번호: 12, 묶음배송번호: 'B-001', 주문번호: 'C-20240101-012', 업체상품코드: 'A00000001', 등록상품명: '딸기 1kg',     옵션ID: 'OPT-001', 거래처명: '거래처A(달롬)', 수량: 1, 주문상태: '배송중',     금액: 15000 },
  { 번호: 13, 묶음배송번호: 'B-005', 주문번호: 'C-20240101-013', 업체상품코드: 'A00000005', 등록상품명: '딸기잼',       옵션ID: 'OPT-005', 거래처명: '거래처E(달롬)', 수량: 3, 주문상태: '상품준비중', 금액: 45000 },
  { 번호: 14, 묶음배송번호: 'B-003', 주문번호: 'C-20240101-014', 업체상품코드: 'A00000003', 등록상품명: '딸기 500g',    옵션ID: 'OPT-003', 거래처명: '거래처C(달롬)', 수량: 1, 주문상태: '결제완료',   금액: 15000 },
  { 번호: 15, 묶음배송번호: 'B-002', 주문번호: 'C-20240101-015', 업체상품코드: 'A00000002', 등록상품명: '딸기 2kg',     옵션ID: 'OPT-002', 거래처명: '거래처B(달롬)', 수량: 2, 주문상태: '배송준비중', 금액: 36000 },
]

const RECOMMENDED_CLASSIFY_COLS = ['업체상품코드', '등록상품명', '옵션ID']

// ─── 단계 인디케이터 ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map(({ num, label }, i) => {
        const done   = current > num
        const active = current === num
        return (
          <React.Fragment key={num}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                transition-all duration-300
                ${done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-primary-500 text-white ring-4 ring-primary-500/25'
                :          'bg-dark-hover text-slate-500'}
              `}>
                {done ? <CheckCircle2 size={14} /> : num}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap
                ${active ? 'text-primary-400' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 h-px mb-5 mx-1 transition-colors duration-300
                ${current > num ? 'bg-emerald-500/50' : 'bg-dark-border'}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export function CoupangAutoPage() {
  const navigate = useNavigate()
  const { businesses, isLoading: bizLoading, fetch: fetchBiz } = useBusinessStore()
  const { mappingPresets, multiMatchConfigs, b2bTemplates } = useSettingsStore()

  const [activeTab, setActiveTab] = useState<Tab>('match')

  // ── 주문 매칭 상태 ──────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<Step>(1)
  const [selectedBizId,  setSelectedBizId]  = useState<string>('')
  const [selectedConnId, setSelectedConnId] = useState<string>('')
  const [orderStatus,    setOrderStatus]    = useState<string>('ALL')
  const [startDate,      setStartDate]      = useState<string>(() => new Date().toISOString().split('T')[0])
  const [endDate,        setEndDate]        = useState<string>(() => new Date().toISOString().split('T')[0])
  const [isFetching,     setIsFetching]     = useState(false)
  const [fetchProgress,  setFetchProgress]  = useState(0)
  const [fetchedOrders,  setFetchedOrders]  = useState<typeof MOCK_ORDERS | null>(null)
  const [isMockMode,       setIsMockMode]       = useState(false)
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [classifyColumn,   setClassifyColumn]   = useState<string>('업체상품코드')
  const [isMatching,       setIsMatching]        = useState(false)
  const [matchResult,      setMatchResult]       = useState<Record<string, any[]>>({})
  const [showOrderList,    setShowOrderList]     = useState(false)

  // ── 송장번호 전송 상태 ──────────────────────────────────────────────────────
  const [invBizId,         setInvBizId]         = useState<string>('')
  const [invConnId,        setInvConnId]         = useState<string>('')
  const [invOrderFile,     setInvOrderFile]      = useState<File | null>(null)
  const [invB2bFile,       setInvB2bFile]        = useState<File | null>(null)
  const [invOrderData,     setInvOrderData]      = useState<ParsedExcel | null>(null)
  const [invB2bData,       setInvB2bData]        = useState<ParsedExcel | null>(null)
  const [invMapping,       setInvMapping]        = useState<ColumnMapping>({})
  const [invAppendValues,  setInvAppendValues]   = useState<Record<string, string>>({})
  const [invResult,        setInvResult]         = useState<FillResult | null>(null)
  const [invIsProcessing,  setInvIsProcessing]   = useState(false)
  const [invError,         setInvError]          = useState<string | null>(null)
  const [invB2bFileBase64, setInvB2bFileBase64]  = useState<string>('')
  const [invLoadedPresetId,setInvLoadedPresetId] = useState<string | undefined>(undefined)
  const [showInvPresets,   setShowInvPresets]    = useState(false)
  const [isSending,        setIsSending]         = useState(false)
  const [sendResult,       setSendResult]        = useState<{ ok: boolean; message: string } | null>(null)
  const invSkipAutoMatch = useRef(false)
  const invResultRef     = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchBiz() }, [])

  const coupangBizList = businesses.map(b => ({
    ...b,
    coupangConns: b.connections.filter(c => c.marketplace === 'coupang'),
  })).filter(b => b.coupangConns.length > 0)

  const multiMatchPresets = mappingPresets.filter((p: any) => p.mode === 'multi' || !p.mode)

  const handleBizChange = (bizId: string) => {
    setSelectedBizId(bizId)
    const biz = coupangBizList.find(b => b.id === bizId)
    setSelectedConnId(biz?.coupangConns[0]?.id ?? '')
    setFetchedOrders(null)
    setIsMockMode(false)
  }

  const handleInvBizChange = (bizId: string) => {
    setInvBizId(bizId)
    const biz = coupangBizList.find(b => b.id === bizId)
    setInvConnId(biz?.coupangConns[0]?.id ?? '')
  }

  const canFetch = !!selectedConnId && !!startDate && !!endDate

  const handleMockFetch = async () => {
    setIsFetching(true)
    setFetchedOrders(null)
    await new Promise(r => setTimeout(r, 1200))
    setFetchedOrders(MOCK_ORDERS)
    setIsMockMode(true)
    setIsFetching(false)
  }

  const handleFetch = async () => {
    if (!selectedBizId || !selectedConnId) return
    setIsFetching(true)
    setFetchedOrders(null)
    setFetchProgress(0)

    // 진행률 애니메이션 (API 응답 대기 중)
    const progressInterval = setInterval(() => {
      setFetchProgress(p => p < 85 ? p + 5 : p)
    }, 200)

    try {
      const result = await coupangApi.getOrders(selectedBizId, selectedConnId, startDate, endDate, orderStatus)
      clearInterval(progressInterval)
      setFetchProgress(100)
      await new Promise(r => setTimeout(r, 300))
      setFetchedOrders(result.orders as any)
    } catch (err: any) {
      clearInterval(progressInterval)
      setFetchProgress(0)
      alert(err.message || '주문 조회 중 오류가 발생했습니다.')
    } finally {
      setIsFetching(false)
    }
  }

  const handleMatch = async () => {
    setIsMatching(true)
    await new Promise(r => setTimeout(r, 500))

    const config = multiMatchConfigs.find(c => c.id === selectedConfigId)
    if (!config || !fetchedOrders) { setIsMatching(false); return }

    const result: Record<string, any[]> = {}
    const unmatched: any[] = []

    for (const order of fetchedOrders) {
      const val = String((order as any)[config.classifyColumn] ?? '')
      const rule = config.rules.find(r =>
        r.matchValues.some(mv => mv.trim() === val.trim())
      )
      const key = rule ? rule.partnerName : '(미매칭)'
      if (!result[key]) result[key] = []
      result[key].push(order)
      if (!rule) unmatched.push(order)
    }

    setMatchResult(result)
    setIsMatching(false)
    setStep(3)
  }

  const partnerSummary = fetchedOrders
    ? Object.entries(
        fetchedOrders.reduce((acc, o) => {
          const key = String((o as Record<string, unknown>)[classifyColumn] ?? '(없음)')
          if (!acc[key]) acc[key] = { count: 0, amount: 0 }
          acc[key].count  += o.수량
          acc[key].amount += o.금액
          return acc
        }, {} as Record<string, { count: number; amount: number }>)
      )
    : []

  const orderColumns    = fetchedOrders?.length ? Object.keys(fetchedOrders[0]) : []
  const recommendedCols = orderColumns.filter(c => RECOMMENDED_CLASSIFY_COLS.includes(c))
  const otherCols       = orderColumns.filter(c => !RECOMMENDED_CLASSIFY_COLS.includes(c))
  const today           = new Date().toISOString().split('T')[0]

  // ── 송장 탭: 두 파일 로드 시 자동 매핑 ─────────────────────────────────────
  useEffect(() => {
    if (invOrderData && invB2bData && !invSkipAutoMatch.current) {
      setInvMapping(autoMatchColumns(invOrderData.headers, invB2bData.headers))
      setInvAppendValues({})
      setInvResult(null)
    }
  }, [invOrderData, invB2bData])

  // ── 송장 탭: 파일 파싱 ──────────────────────────────────────────────────────
  const handleInvOrderFile = useCallback(async (file: File | null) => {
    setInvOrderFile(file); setInvOrderData(null); setInvError(null); setInvResult(null)
    if (!file) return
    try { setInvOrderData(await readExcelFile(file)) }
    catch (err) { setInvError(err instanceof Error ? err.message : '파일 읽기 오류'); setInvOrderFile(null) }
  }, [])

  const handleInvB2bFile = useCallback(async (file: File | null) => {
    setInvB2bFile(file); setInvB2bData(null); setInvB2bFileBase64(''); setInvError(null); setInvResult(null)
    if (!file) return
    try {
      setInvB2bData(await readExcelFile(file))
      const r = new FileReader()
      r.onload = () => setInvB2bFileBase64((r.result as string).split(',')[1])
      r.readAsDataURL(file)
    } catch (err) { setInvError(err instanceof Error ? err.message : '파일 읽기 오류'); setInvB2bFile(null) }
  }, [])

  // ── 송장 탭: 프리셋 불러오기 ────────────────────────────────────────────────
  const handleInvLoadPreset = async (presetId: string) => {
    const preset = mappingPresets.find((p: any) => p.id === presetId)
    if (!preset) return
    invSkipAutoMatch.current = true
    if (preset.b2bFileData) {
      const byteStr = atob(preset.b2bFileData)
      const arr = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i)
      const file = new File([arr], preset.b2bFileName ?? 'B2B양식.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      await handleInvB2bFile(file)
      setInvB2bFileBase64(preset.b2bFileData)
    }
    setInvMapping(preset.mapping)
    setInvAppendValues(preset.appendValues ?? {})
    setInvLoadedPresetId(preset.id)
    setShowInvPresets(false)
    invSkipAutoMatch.current = false
  }

  // ── 송장 탭: 매핑 실행 ──────────────────────────────────────────────────────
  const handleInvFill = async () => {
    if (!invOrderData || !invB2bData) return
    setInvIsProcessing(true); setInvError(null)
    try {
      const res = await new Promise<FillResult>((resolve, reject) => {
        setTimeout(() => {
          try { resolve(fillB2bFromOrder(invOrderData.rows, invB2bData.headers, invMapping, invAppendValues)) }
          catch (e) { reject(e) }
        }, 0)
      })
      setInvResult(res)
      setTimeout(() => invResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err) {
      setInvError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    } finally { setInvIsProcessing(false) }
  }

  // ── 송장 탭: 쿠팡 API 전송 ──────────────────────────────────────────────────
  const handleInvSendToApi = async () => {
    if (!invResult || !invBizId || !invConnId) return
    setIsSending(true); setSendResult(null)
    try {
      const headers = invB2bData?.headers ?? []
      const findCol = (...kw: string[]) => headers.find(h => kw.some(k => h.includes(k))) ?? ''
      const colBox     = findCol('묶음배송')
      const colCarrier = findCol('배송업체', '택배사', '배송사')
      const colInvoice = findCol('운송장', '송장번호')

      const shipments = invResult.rows
        .map(row => ({
          shipmentBoxId:       String(row[colBox]     ?? '').trim(),
          deliveryCompanyCode: CARRIER_MAP[String(row[colCarrier] ?? '').trim()] ?? String(row[colCarrier] ?? '').trim(),
          invoiceNumber:       String(row[colInvoice] ?? '').trim(),
        }))
        .filter(s => s.deliveryCompanyCode && s.invoiceNumber)

      if (shipments.length === 0) {
        setSendResult({ ok: false, message: '전송할 데이터가 없습니다. 컬럼 매핑을 확인해주세요.' }); return
      }
      const res = await coupangApi.confirmShipments(invBizId, invConnId, shipments)
      if (res.code === '200' || res.code === '0' || res.message?.toLowerCase().includes('success')) {
        setSendResult({ ok: true, message: `${shipments.length}건 쿠팡 전송 완료!` })
      } else {
        setSendResult({ ok: false, message: res.message || '전송 실패' })
      }
    } catch (err: any) {
      setSendResult({ ok: false, message: err.message || '전송 오류가 발생했습니다.' })
    } finally { setIsSending(false) }
  }

  // ── 송장 탭: 초기화 ─────────────────────────────────────────────────────────
  const handleInvReset = () => {
    setInvOrderFile(null); setInvB2bFile(null)
    setInvOrderData(null); setInvB2bData(null)
    setInvMapping({}); setInvAppendValues({})
    setInvResult(null); setInvError(null)
    setInvB2bFileBase64(''); setInvLoadedPresetId(undefined)
    setShowInvPresets(false); setSendResult(null)
  }

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-dark-bg dark:bg-dark-bg bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5 animate-fade-in">

        {/* 헤더 */}
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-400" />
            쿠팡 자동매칭
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            쿠팡 API로 주문을 가져와 거래처별로 자동 분류·출력합니다
          </p>
        </div>

        {/* ── 탭 ──────────────────────────────────────────────────────────── */}
        <div className="flex rounded-xl overflow-hidden border border-dark-border bg-dark-card">
          <button
            onClick={() => setActiveTab('match')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all
              ${activeTab === 'match'
                ? 'bg-primary-500/20 text-primary-300 border-b-2 border-primary-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-dark-hover'
              }`}
          >
            <ShoppingCart size={14} /> 주문 매칭
          </button>
          <button
            onClick={() => setActiveTab('invoice')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all
              ${activeTab === 'invoice'
                ? 'bg-amber-500/15 text-amber-300 border-b-2 border-amber-400'
                : 'bg-[#0d2d3d] text-[#5ba8c4] border-b-2 border-[#1a4a60]'
              }`}
          >
            <Truck size={14} /> 송장번호 전송
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            탭 1: 주문 매칭
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'match' && (
          <>
            {/* 배너 */}
            {isMockMode ? (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">쿠팡 API 인증 확인 중</p>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    쿠팡 Wing에서 API 인증이 승인되면 주문 가져오기가 활성화됩니다. (보통 1영업일 소요)
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
                <FlaskConical size={16} className="text-violet-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-violet-400">테스트 모드</p>
                  <p className="text-xs text-violet-300/80 mt-0.5">가상 주문 데이터로 전체 흐름을 테스트하고 있습니다.</p>
                </div>
              </div>
            )}

            <StepIndicator current={step} />

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-5">

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Building2 size={12} /> 사업자 선택
                    </label>
                    {bizLoading ? (
                      <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                        <Loader2 size={13} className="animate-spin" /> 불러오는 중...
                      </div>
                    ) : coupangBizList.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        <AlertCircle size={13} />
                        쿠팡 연동된 사업자가 없습니다. 사업자 관리에서 쿠팡 API 키를 먼저 등록해주세요.
                      </div>
                    ) : (
                      <select
                        value={selectedBizId}
                        onChange={e => handleBizChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50"
                      >
                        <option value="">— 사업자를 선택하세요 —</option>
                        {coupangBizList.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-2">
                      주문 기간
                      <span className="text-slate-600 font-normal">오늘 날짜 수집 기본 적용됩니다.</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={startDate} max={today} onChange={e => setStartDate(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50" />
                      <span className="text-slate-500 text-xs">~</span>
                      <input type="date" value={endDate} max={today} onChange={e => setEndDate(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-primary-500/50" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <Package size={12} /> 주문 상태
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ORDER_STATUSES.map(({ value, label }) => (
                        <button key={value} onClick={() => setOrderStatus(value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                            ${orderStatus === value
                              ? 'bg-primary-500/20 text-primary-300 border-primary-500/40'
                              : 'bg-dark-hover border-dark-border text-slate-400 hover:border-primary-500/30 hover:text-primary-400'
                            }`}
                        >{label}</button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-600"><span className="text-slate-400">상태 선택</span> 후 아래 <span className="text-slate-400">쿠팡 주문 가져오기</span> 버튼을 눌러주세요.</p>
                  </div>

                  {fetchedOrders !== null && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
                      <CheckCircle2 size={14} />
                      주문 <span className="font-bold">{fetchedOrders.length}건</span> 가져왔습니다
                      {isMockMode && <span className="text-xs text-violet-400 ml-1">(가상 데이터)</span>}
                    </div>
                  )}
                </div>

                <p className="text-xs text-center text-slate-400 bg-dark-hover border border-dark-border rounded-xl px-4 py-2.5">
                  💡 <span className="text-amber-400 font-medium">일괄매칭</span>에서 미리 설정 해놓아야 자동매칭됩니다!
                </p>

                <button disabled={!canFetch || isFetching || coupangBizList.length === 0} onClick={handleFetch}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20">
                  {isFetching ? <><Loader2 size={15} className="animate-spin" /> 주문 가져오는 중...</> : <><RefreshCw size={15} /> 쿠팡 주문 가져오기</>}
                </button>

                {/* 진행률 바 */}
                {isFetching && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>쿠팡 주문 수집 중...</span>
                      <span className="font-mono text-orange-400">{fetchProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-dark-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${fetchProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 수집 완료 표시 */}
                {!isFetching && fetchProgress === 100 && fetchedOrders !== null && (
                  fetchedOrders.length > 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
                      <CheckCircle2 size={14} /> 수집 완료 — <span className="font-bold">{fetchedOrders.length}건</span> 주문이 수집되었습니다
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-sm text-slate-400">
                      <AlertCircle size={14} /> 해당 기간에 주문이 없습니다
                    </div>
                  )
                )}

                {import.meta.env.DEV && (
                  <button disabled={isFetching} onClick={handleMockFetch}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {isFetching ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</> : <><FlaskConical size={14} /> 가상 주문 15건으로 테스트</>}
                  </button>
                )}

                <button disabled={fetchedOrders === null} onClick={() => setStep(2)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/20">
                  다음: 파트너 설정 →
                </button>
                <button onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                  ← 뒤로가기
                </button>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-dark-border bg-dark-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">가져온 주문 요약</p>
                    {fetchedOrders && fetchedOrders.length > 0 && (
                      <button
                        onClick={() => setShowOrderList(v => !v)}
                        className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                      >
                        <Package size={12} />
                        {showOrderList ? '목록 닫기 ▲' : `주문 ${fetchedOrders.length}건 보기 ▼`}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">총 주문</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-100">{partnerSummary.length}</p>
                      <p className="text-xs text-slate-500">거래처 수</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.reduce((s, o) => s + o.수량, 0) ?? 0}</p>
                      <p className="text-xs text-slate-500">총 수량</p>
                    </div>
                  </div>

                  {/* 주문 목록 */}
                  {showOrderList && fetchedOrders && fetchedOrders.length > 0 && (
                    <div className="mt-1 rounded-xl border border-dark-border overflow-hidden">
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-dark-bg">
                            <tr>
                              {Object.keys(fetchedOrders[0]).map(col => (
                                <th key={col} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap border-b border-dark-border">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fetchedOrders.map((order, i) => (
                              <tr key={i} className={`border-b border-dark-border/50 ${i % 2 === 0 ? 'bg-dark-hover/30' : ''}`}>
                                {Object.values(order).map((val, j) => (
                                  <td key={j} className="px-3 py-2 text-slate-300 whitespace-nowrap">
                                    {String(val ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* 주문 전체 다운로드 */}
                <button
                  disabled={!fetchedOrders?.length}
                  onClick={() => {
                    if (!fetchedOrders?.length) return
                    const ws = XLSX.utils.json_to_sheet(fetchedOrders)
                    const wb = XLSX.utils.book_new()
                    XLSX.utils.book_append_sheet(wb, ws, '주문목록')
                    XLSX.writeFile(wb, `쿠팡주문_${startDate}_${endDate}.xlsx`)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Download size={14} /> 매칭전 주문 전체 다운로드 (Excel)
                </button>

                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-primary-400" />
                    <p className="text-sm font-semibold text-slate-200">파트너 매핑 설정</p>
                  </div>

                  {multiMatchConfigs.length === 0 ? (
                    <div className="px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                      일괄매칭 설정이 없습니다. 일괄매칭 메뉴에서 먼저 설정을 저장해주세요.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-500">사용할 일괄매칭 설정 선택</label>
                      <div className="space-y-2">
                        {multiMatchConfigs.map((c: any) => (
                          <button key={c.id} onClick={() => {
                            setSelectedConfigId(c.id)
                            setClassifyColumn(c.classifyColumn)
                          }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                              ${selectedConfigId === c.id ? 'border-primary-500/50 bg-primary-500/10' : 'border-dark-border bg-dark-hover hover:border-primary-500/30'}`}>
                            <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${selectedConfigId === c.id ? 'border-primary-400 bg-primary-400' : 'border-slate-600'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">분류기준: {c.classifyColumn} · 거래처 {c.rules.length}개</p>
                            </div>
                            {selectedConfigId === c.id && <CheckCircle2 size={14} className="text-primary-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                      {selectedConfigId && (
                        <p className="text-xs text-slate-500 px-1">
                          <span className="text-primary-400 font-medium">"{classifyColumn}"</span> 기준으로 거래처별 분류합니다
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                    ← 이전
                  </button>
                  <button disabled={!selectedConfigId || isMatching} onClick={handleMatch}
                    className="flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    {isMatching ? <><Loader2 size={14} className="animate-spin" /> 매칭 중...</> : '매칭 실행 →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-400">매칭 완료</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-slate-100">{fetchedOrders?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">전체 주문</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-400">
                        {Object.entries(matchResult).filter(([k]) => k !== '(미매칭)').reduce((s, [, v]) => s + v.length, 0)}
                      </p>
                      <p className="text-xs text-slate-500">매칭 성공</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-400">{matchResult['(미매칭)']?.length ?? 0}</p>
                      <p className="text-xs text-slate-500">미매칭</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 space-y-3">
                  <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Users size={12} /> 거래처별 분류 결과
                  </p>
                  <div className="space-y-2">
                    {Object.entries(matchResult).map(([name, orders]) => (
                      <div key={name} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${name === '(미매칭)' ? 'bg-red-500/5 border-red-500/20' : 'bg-dark-hover border-dark-border'}`}>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${name === '(미매칭)' ? 'text-red-400' : 'text-slate-200'}`}>{name}</p>
                          <p className="text-xs text-slate-500">{orders.length}건</p>
                        </div>
                        {name !== '(미매칭)' && (
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 text-primary-400 border border-primary-500/20 hover:bg-primary-500/25 transition-all">
                            <FileSpreadsheet size={11} /> B2B 다운로드
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/20">
                  <Download size={15} /> 전체 ZIP 다운로드
                </button>

                {isMockMode && (
                  <p className="text-center text-xs text-violet-400/70">* 테스트 모드 — 실제 파일이 생성되지 않습니다</p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-300 hover:bg-dark-muted transition-all">
                    ← 이전
                  </button>
                  <button onClick={() => { setStep(1); setFetchedOrders(null); setIsMockMode(false); setSelectedConfigId('') }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-dark-hover border border-dark-border text-slate-400 hover:text-slate-200 transition-all">
                    <RotateCcw size={13} /> 처음부터
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            탭 2: 송장번호 전송
        ════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'invoice' && (
          <div className="space-y-5 animate-fade-in">

            {/* 헤더: 불러오기 + 처음부터 */}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                  <Truck size={15} /> 송장번호 전송
                </p>
                <p className="text-xs text-slate-500 mt-0.5">거래처에서 받은 송장번호 포함 B2B 파일을 쿠팡 API로 전송합니다</p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const cnt = mappingPresets.filter((p: any) => p.mode === 'invoice' && p.b2bFileData).length
                  return (
                    <button
                      onClick={() => setShowInvPresets(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                        ${showInvPresets
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}`}
                    >
                      <FolderOpen size={12} /> 불러오기{cnt > 0 && ` (${cnt})`}
                    </button>
                  )
                })()}
                {(invOrderFile || invB2bFile) && (
                  <button onClick={handleInvReset} className="flex items-center gap-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                    <RotateCcw size={13} /> 처음부터
                  </button>
                )}
              </div>
            </div>

            {/* 불러오기 패널 */}
            {showInvPresets && (() => {
              const filtered = mappingPresets.filter((p: any) => p.mode === 'invoice' && p.b2bFileData)
              return (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 animate-fade-in">
                  {filtered.length > 0 ? filtered.map((p: any) => (
                    <button key={p.id} onClick={() => handleInvLoadPreset(p.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-hover border border-amber-500/20 hover:border-amber-500/40 transition-colors text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-200 truncate">{p.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap shrink-0">클릭 적용</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {p.b2bFileName} · 매핑 {Object.values(p.mapping).filter(Boolean).length}개 · {new Date(p.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </button>
                  )) : (
                    <p className="text-xs text-slate-500 py-2 text-center">저장된 송장 양식 없음 — 주문매칭에서 매핑 저장 후 생성됩니다</p>
                  )}
                </div>
              )
            })()}

            {/* 사업자 선택 */}
            <div className="rounded-2xl border border-amber-500/30 bg-dark-card p-5 space-y-3">
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Building2 size={14} className="text-amber-400" /> 쿠팡 계정 선택
              </p>
              {bizLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> 불러오는 중...</div>
              ) : coupangBizList.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle size={13} /> 쿠팡 연동된 사업자가 없습니다. 사업자 관리에서 먼저 API 키를 등록해주세요.
                </div>
              ) : (
                <div className="space-y-2.5">
                  <select value={invBizId} onChange={e => handleInvBizChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                    <option value="">— 사업자를 선택하세요 —</option>
                    {coupangBizList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {invBizId && (
                    <select value={invConnId} onChange={e => setInvConnId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-dark-hover border border-dark-border text-slate-200 focus:outline-none focus:border-amber-500/50">
                      <option value="">— 쿠팡 계정을 선택하세요 —</option>
                      {coupangBizList.find(b => b.id === invBizId)?.coupangConns.map(c => (
                        <option key={c.id} value={c.id}>{c.displayName || c.vendorId || c.id}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* 에러 */}
            {invError && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{invError}</p>
              </div>
            )}

            {/* 파일 업로드 */}
            <div className="rounded-2xl border border-amber-500/30 bg-dark-card p-6 space-y-4">
              {/* 파일 1: B2B 파일 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80">B2B 파일 (송장번호 포함)</p>
                <FileUploader label="" file={invOrderFile} onFileChange={handleInvOrderFile} />
                {invOrderData && (
                  <p className="text-xs text-slate-500">
                    <span className="text-slate-300 font-medium">{invOrderData.rows.length.toLocaleString()}행</span> · 컬럼 {invOrderData.headers.length}개
                  </p>
                )}
              </div>
              <div className="border-t border-amber-500/20" />
              {/* 파일 2: 마켓 업로드 양식 */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80">마켓 업로드 양식 (쿠팡·11번가 등)</p>
                <FileUploader label="" file={invB2bFile} onFileChange={handleInvB2bFile} />
                {invB2bData && (
                  <p className="text-xs text-slate-500">
                    <span className="text-slate-300 font-medium">컬럼 {invB2bData.headers.length}개</span> 감지됨
                  </p>
                )}
              </div>
            </div>

            {/* 컬럼 매핑 */}
            {invOrderData && invB2bData && (
              <div className="rounded-2xl border border-amber-500/30 bg-dark-card p-6 space-y-5 animate-slide-up">
                <ColumnMapper
                  orderHeaders={invOrderData.headers}
                  b2bHeaders={invB2bData.headers}
                  mapping={invMapping}
                  appendValues={invAppendValues}
                  b2bFileName={invB2bFile?.name}
                  b2bFileData={invB2bFileBase64}
                  loadedPresetId={invLoadedPresetId}
                  mode="invoice"
                  onMappingChange={m => { setInvMapping(m); setInvLoadedPresetId(undefined) }}
                  onAppendValuesChange={setInvAppendValues}
                />
                <button
                  disabled={invIsProcessing}
                  onClick={handleInvFill}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
                >
                  {invIsProcessing
                    ? <><Loader2 size={15} className="animate-spin" /> 처리 중...</>
                    : <><Play size={15} /> 매핑 실행</>
                  }
                </button>
              </div>
            )}

            {/* 결과 */}
            {invResult && (
              <div ref={invResultRef} className="space-y-4 animate-slide-up">
                <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-emerald-500/30 border border-emerald-400/50">
                  <CheckCircle2 size={18} className="text-emerald-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-200">송장번호 매핑이 완료되었습니다.</p>
                    <p className="text-xs text-emerald-300/80 mt-0.5">아래에서 파일 다운로드 또는 쿠팡 API로 바로 전송하세요!</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-300">
                    총 <span className="text-amber-400">{invResult.totalRows.toLocaleString()}</span>행
                  </p>
                  <DownloadButton
                    rows={invResult.rows}
                    fileName={invB2bFile?.name.replace(/\.[^/.]+$/, '') ?? '송장결과'}
                    label="매칭완료 엑셀다운"
                  />
                </div>

                <MatchingPreview result={invResult} />

                {/* 전송 결과 */}
                {sendResult && (
                  <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${
                    sendResult.ok ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    {sendResult.ok
                      ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      : <XCircle size={16} className="text-red-400 shrink-0" />
                    }
                    <p className={`text-sm font-semibold ${sendResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sendResult.message}
                    </p>
                  </div>
                )}

                {/* 쿠팡 API 전송 버튼 */}
                <button
                  disabled={!invBizId || !invConnId || isSending}
                  onClick={handleInvSendToApi}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20"
                >
                  {isSending
                    ? <><Loader2 size={15} className="animate-spin" /> 쿠팡 전송 중...</>
                    : <><Send size={15} /> 쿠팡 API 전송</>
                  }
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
